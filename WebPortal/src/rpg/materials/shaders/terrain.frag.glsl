// ══════════════════════════════════════════════════════════════════════════════
// terrain.frag.glsl — Terrain auto-material FRAGMENT injection (WebGL/Three.js)
//
// Injected into Three.js's MeshStandardMaterial at these points:
//   - FRAG_DECL:  after  #include <common>
//   - FRAG_COLOR: inside <map_fragment>
//   - FRAG_NORMAL: after <normal_fragment_maps>
//
// Relies on:
//   diffuseColor, normal, faceDirection, viewMatrix  (Three.js built-in)
//   uFlatMap, uSteepMap, uMidMap, uVariation, etc.   (custom uniforms)
// ══════════════════════════════════════════════════════════════════════════════

// ── FRAG_DECL ────────────────────────────────────────────────────────────────
varying vec3 vAutoWorldPos;
varying vec3 vAutoWorldNormal;

uniform sampler2D uFlatMap;
uniform sampler2D uFlatNrm;
uniform sampler2D uMidMap;
uniform sampler2D uMidNrm;
uniform sampler2D uSteepMap;
uniform sampler2D uSteepNrm;
uniform sampler2D uVariation;
uniform vec4 uTileSizes;
uniform vec4 uBlend;
uniform float uHasMid;

/**
 * Poids de projection triplanaire.
 *
 * On élève à une puissance élevée pour resserrer les zones de recouvrement :
 * un simple abs(n) mélange les trois plans sur de larges bandes et produit un
 * flou caractéristique sur les arêtes. La puissance 4 garde une transition
 * courte tout en restant continue.
 */
vec3 triWeights(vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  return w / max(w.x + w.y + w.z, 1e-5);
}

/** Échantillonne une texture en projection monde sur les trois plans. */
vec4 triSample(sampler2D tex, vec3 wp, vec3 w, float tile) {
  float s = 1.0 / max(tile, 1e-3);
  vec4 x = texture2D(tex, wp.zy * s);
  vec4 y = texture2D(tex, wp.xz * s);
  vec4 z = texture2D(tex, wp.xy * s);
  return x * w.x + y * w.y + z * w.z;
}

/**
 * Mélange de normal maps en triplanaire, méthode « whiteout ».
 *
 * Un mélange naïf des vecteurs aplatit le relief là où deux plans se
 * rencontrent. La whiteout conserve la composante Z de chaque plan et n'additionne
 * que les composantes tangentes — le relief survit aux jonctions.
 */
vec3 triNormal(sampler2D tex, vec3 wp, vec3 w, float tile, vec3 geoN) {
  float s = 1.0 / max(tile, 1e-3);
  vec3 nx = texture2D(tex, wp.zy * s).xyz * 2.0 - 1.0;
  vec3 ny = texture2D(tex, wp.xz * s).xyz * 2.0 - 1.0;
  vec3 nz = texture2D(tex, wp.xy * s).xyz * 2.0 - 1.0;
  nx = vec3(nx.xy + geoN.zy, abs(nx.z) * geoN.x);
  ny = vec3(ny.xy + geoN.xz, abs(ny.z) * geoN.y);
  nz = vec3(nz.xy + geoN.xy, abs(nz.z) * geoN.z);
  return normalize(nx.zyx * w.x + ny.xzy * w.y + nz.xyz * w.z);
}

// ── FRAG_COLOR ───────────────────────────────────────────────────────────────
// Injected in place of <map_fragment>
  vec3 autoN   = normalize(vAutoWorldNormal);
  vec3 autoW   = triWeights(autoN);
  vec3 autoPos = vAutoWorldPos;

  // Pente : 0 à l'horizontale, 1 à la verticale. La VALEUR ABSOLUE DE Y est
  // volontaire — le dessous d'une arche est aussi « plat » que le dessus, et
  // cette map en est pleine. Sans abs(), tous les surplombs recevraient de la
  // roche de paroi sur une face pourtant horizontale.
  float autoSlope = 1.0 - min(1.0, abs(autoN.y));

  // Masque basse fréquence : décale localement les seuils de pente. C'est ce
  // qui empêche l'œil de lire le carrelage — sans lui, la limite neige/roche
  // suit une courbe de niveau parfaite et trahit le procédé.
  float autoVar = texture2D(uVariation, autoPos.xz / max(uTileSizes.w, 1e-3)).r;
  autoSlope += (autoVar - 0.5) * uBlend.z;

  float autoT = smoothstep(uBlend.x, uBlend.y, autoSlope);

  vec4 cFlat  = triSample(uFlatMap,  autoPos, autoW, uTileSizes.x);
  vec4 cSteep = triSample(uSteepMap, autoPos, autoW, uTileSizes.z);

  // La couche intermédiaire culmine au milieu de la transition (parabole
  // 4t(1-t)) et s'efface aux deux bouts. Les poids somment toujours à 1 : aucune
  // zone ne s'assombrit ni ne sature au passage d'une couche à l'autre.
  float wMid  = uHasMid > 0.5 ? 4.0 * autoT * (1.0 - autoT) : 0.0;
  float rest  = 1.0 - wMid;
  vec4 cMid   = uHasMid > 0.5 ? triSample(uMidMap, autoPos, autoW, uTileSizes.y) : vec4(0.0);

  vec4 autoCol = cFlat * (rest * (1.0 - autoT)) + cMid * wMid + cSteep * (rest * autoT);

  diffuseColor.rgb = autoCol.rgb;

// ── FRAG_NORMAL ──────────────────────────────────────────────────────────────
// Injected after #include <normal_fragment_maps>
  {
    // DÉPENDANCE ASSUMÉE — on RÉUTILISE autoN / autoW / autoT posés par FRAG_COLOR
    // au lieu de les recalculer. FRAG_COLOR est injecté dans <map_fragment>, donc
    // plus haut dans main() et au MÊME niveau d'accolades.
    vec3 gN = autoN;
    vec3 gW = autoW;
    float t = autoT;   // porte le décalage du masque de variation
    float wm = uHasMid > 0.5 ? 4.0 * t * (1.0 - t) : 0.0;
    float rs = 1.0 - wm;

    vec3 nFlat  = triNormal(uFlatNrm,  vAutoWorldPos, gW, uTileSizes.x, gN);
    vec3 nSteep = triNormal(uSteepNrm, vAutoWorldPos, gW, uTileSizes.z, gN);
    vec3 nMid   = uHasMid > 0.5 ? triNormal(uMidNrm, vAutoWorldPos, gW, uTileSizes.y, gN) : vec3(0.0);

    vec3 wN = normalize(nFlat * (rs * (1.0 - t)) + nMid * wm + nSteep * (rs * t));
    wN = normalize(mix(gN, wN, uBlend.w));
    // faceDirection (posé par <normal_fragment_begin>) : le matériau est en
    // DoubleSide et ce bloc ÉCRASE la normale — sans ce flip, les faces
    // arrière, désormais rendues, seraient éclairées à l'envers (noires).
    wN *= faceDirection;
    // MeshStandardMaterial raisonne en espace VUE : sans cette conversion,
    // l'éclairage tournerait avec la caméra.
    normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
  }
