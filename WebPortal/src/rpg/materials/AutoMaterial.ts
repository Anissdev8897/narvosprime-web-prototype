// ══════════════════════════════════════════════════════════════════════════════
// materials/AutoMaterial.ts — Auto-material paysage reproduit AU RUNTIME.
//
// POURQUOI CE FICHIER EXISTE — mesuré, pas supposé :
// L'auto-material d'Unreal (MWLandscapeAutoMaterial) mélange plusieurs couches
// de sol selon la pente, chacune répétée à l'échelle du MONDE. L'exportateur
// glTF ne sait pas exprimer ça : il « bake » le résultat dans UNE texture par
// objet, à taille fixe. Relevé sur halo_map.glb :
//
//     objet                 diagonale     densité obtenue
//     10 % les + petits         2,3 u     450 texels/unité
//     médiane                    37 u      27,6 texels/unité
//     le + grand              2 258 u       0,45 texel/unité   ← bouillie
//
// D'où des cailloux nets et des pans de terrain délavés. Le carrelage monde
// n'a pas ce problème : la densité est la même partout, par construction.
//
// Coût : 7 textures KTX2 ≈ 26 Mo de VRAM, contre ~500 Mo pour les 241 bakes.
//
// IMPLÉMENTATION : on PATCHE un MeshStandardMaterial via `onBeforeCompile`
// plutôt que d'écrire un ShaderMaterial. C'est ce qui garde gratuitement les
// ombres, le brouillard, l'IBL, le tone mapping et les lumières de la scène —
// un ShaderMaterial obligerait à tout réimplémenter et divergerait du reste
// du rendu à la première évolution.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import type { AutoMaterialConfig } from "./autoMaterialConfig";
import { TERRAIN_LAYERS, FORGE_AUTO_MATERIAL } from "./autoMaterialConfig";

/** Uniforms injectés — exposés pour permettre un réglage à chaud. */
export interface AutoMaterialUniforms {
  uFlatMap: { value: THREE.Texture | null };
  uFlatNrm: { value: THREE.Texture | null };
  uMidMap: { value: THREE.Texture | null };
  uMidNrm: { value: THREE.Texture | null };
  uSteepMap: { value: THREE.Texture | null };
  uSteepNrm: { value: THREE.Texture | null };
  uVariation: { value: THREE.Texture | null };
  /** x = flat, y = mid, z = steep, w = variation — tailles de carreau en unités monde. */
  uTileSizes: { value: THREE.Vector4 };
  /** x = slopeStart, y = slopeEnd, z = variationStrength, w = intensité normal. */
  uBlend: { value: THREE.Vector4 };
  uHasMid: { value: number };
}

const VERT_DECL = /* glsl */ `
varying vec3 vAutoWorldPos;
varying vec3 vAutoWorldNormal;
`;

const VERT_BODY = /* glsl */ `
  // objectNormal est posé par <beginnormal_vertex>, qui s'exécute AVANT
  // <begin_vertex> : on peut donc le lire ici en toute sécurité.
  vAutoWorldPos    = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vAutoWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
`;

const FRAG_DECL = /* glsl */ `
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
`;

const FRAG_COLOR = /* glsl */ `
  vec3 autoN   = normalize(vAutoWorldNormal);
  vec3 autoW   = triWeights(autoN);
  vec3 autoPos = vAutoWorldPos;

  // Pente : 0 à l'horizontale, 1 à la verticale. La VALEUR ABSOLUE de Y est
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
`;

const FRAG_NORMAL = /* glsl */ `
  {
    // DÉPENDANCE ASSUMÉE — on RÉUTILISE autoN / autoW / autoT posés par FRAG_COLOR
    // au lieu de les recalculer. FRAG_COLOR est injecté dans <map_fragment>, donc
    // plus haut dans main() et au MÊME niveau d'accolades (vérifié dans
    // three/src/renderers/shaders/ShaderLib/meshphysical.glsl.js : map_fragment
    // puis normal_fragment_maps, aucune accolade entre les deux).
    //
    // Recalculer paraissait plus propre, mais perdait le décalage du masque de
    // variation appliqué à autoSlope : la couleur et le relief ne décrivaient
    // plus la même couche. Chiffré sur le préréglage Forge (bande 0,18→0,45,
    // variation 0,12) : à pente 0,30 la couleur donne 74 % de roche là où le
    // relief en donne 42 %. Résultat visible — la frontière du RELIEF suit une
    // courbe de niveau parfaite pendant que celle de la COULEUR serpente, soit
    // exactement le carrelage que le masque devait masquer, rétabli sur le canal
    // le plus lisible en lumière rasante.
    //
    // FRAG_COLOR est injecté inconditionnellement, FRAG_NORMAL seulement si
    // hasNormals : la dépendance tient toujours. NE PAS rendre FRAG_COLOR
    // conditionnel sans adapter ce bloc — le shader ne compilerait plus.
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
`;

/**
 * Charge les textures d'une config. Le loader KTX2 est fourni par l'appelant
 * (il a besoin du renderer pour `detectSupport`) — cf. `sharedLoaders.ts`.
 */
export type TextureLoaderFn = (url: string, srgb: boolean) => Promise<THREE.Texture>;

/**
 * Fabrique un MeshStandardMaterial patché en auto-material.
 *
 * `base` sert de gabarit : on hérite de sa rugosité, de son métallicité et de
 * ses réglages de rendu (side, transparence…) pour rester cohérent avec le
 * reste du chunk, et on ne remplace QUE la couleur et la normale.
 */
export function makeAutoMaterial(
  base: THREE.MeshStandardMaterial,
  cfg: AutoMaterialConfig,
  textures: Record<string, THREE.Texture | null>,
): THREE.MeshStandardMaterial {
  const mat = base.clone();
  mat.name = `${base.name || "auto"}__autoMaterial`;
  // DOUBLE FACE — même correctif que sur le matériau brut (cf.
  // StreamingPuzzleMap) : les matériaux MWAM sont les seuls simple-face de la
  // map (242/242 = terrain), et le culling de leurs faces arrière produisait
  // des trous dépendant de l'angle de caméra. Le clone hérite du side du
  // parent : sans cette ligne, activer l'auto-material RÉINTRODUIRAIT les trous.
  mat.side = THREE.DoubleSide;
  // Les couches portent leur propre couleur : une teinte de base héritée les
  // multiplierait et fausserait le rendu.
  mat.color = new THREE.Color(0xffffff);

  // LARGUER TOUTES LES CARTES BAKÉES, pas seulement map et normalMap.
  //
  // Compté sur les 8 chunks : 482 images bakées écartées, mais 481 CONSERVÉES
  // si l'on s'arrête à ces deux-là. Les matériaux MWAM portent aussi un
  // metallicRoughnessTexture — que GLTFLoader affecte à la FOIS à `roughnessMap`
  // et `metalnessMap` — et un KHR_materials_specular, qui en fait des
  // MeshPhysicalMaterial. Les garder annulait les deux bénéfices :
  //   • VRAM : `collectTextures` les voit toujours et les uploade (~80 Mo/chunk),
  //     donc le gain annoncé de 26 Mo contre 500 Mo était faux de moitié ;
  //   • rendu : <roughnessmap_fragment> continuait de moduler la rugosité avec
  //     un bake issu de l'ancienne UV, sans rapport avec le carrelage monde —
  //     des reflets suivant une découpe invisible.
  //
  // On retombe donc sur les scalaires roughness/metalness hérités du matériau
  // source, cohérents sur toute la surface.
  const physical = mat as THREE.MeshPhysicalMaterial;
  mat.map = null;
  mat.normalMap = null;
  mat.roughnessMap = null;
  mat.metalnessMap = null;
  mat.aoMap = null;
  mat.emissiveMap = null;
  mat.bumpMap = null;
  mat.displacementMap = null;
  if (physical.isMeshPhysicalMaterial) {
    physical.specularIntensityMap = null;
    physical.specularColorMap = null;
    physical.clearcoatMap = null;
    physical.clearcoatNormalMap = null;
    physical.clearcoatRoughnessMap = null;
    physical.sheenColorMap = null;
    physical.sheenRoughnessMap = null;
  }

  const uniforms: AutoMaterialUniforms = {
    uFlatMap:   { value: textures[cfg.flat.colorMap] ?? null },
    uFlatNrm:   { value: textures[cfg.flat.normalMap ?? ""] ?? null },
    uMidMap:    { value: textures[cfg.mid?.colorMap ?? ""] ?? null },
    uMidNrm:    { value: textures[cfg.mid?.normalMap ?? ""] ?? null },
    uSteepMap:  { value: textures[cfg.steep.colorMap] ?? null },
    uSteepNrm:  { value: textures[cfg.steep.normalMap ?? ""] ?? null },
    uVariation: { value: textures[cfg.variationMap ?? ""] ?? null },
    uTileSizes: { value: new THREE.Vector4(
      cfg.flat.tileSize, cfg.mid?.tileSize ?? 1, cfg.steep.tileSize, cfg.variationTileSize) },
    uBlend: { value: new THREE.Vector4(
      cfg.slopeStart, cfg.slopeEnd, cfg.variationStrength, 1.0) },
    uHasMid: { value: cfg.mid ? 1 : 0 },
  };

  const hasNormals = !!(uniforms.uFlatNrm.value && uniforms.uSteepNrm.value);

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_DECL}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERT_BODY}`);

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_DECL}`)
      .replace("#include <map_fragment>", FRAG_COLOR);

    if (hasNormals) {
      // On s'accroche APRÈS <normal_fragment_maps> : `normal` y est déjà
      // initialisée depuis la géométrie, on la remplace donc en connaissance de
      // cause plutôt que d'écraser une variable pas encore déclarée.
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <normal_fragment_maps>",
                 `#include <normal_fragment_maps>\n${FRAG_NORMAL}`);
    }
  };

  // Trois matériaux patchés différemment doivent compiler trois programmes
  // distincts. Sans clé propre, Three.js réutilise le programme du premier et
  // les suivants héritent silencieusement du mauvais shader.
  mat.customProgramCacheKey = () =>
    `autoMaterial|${cfg.flat.colorMap}|${cfg.steep.colorMap}|${cfg.mid?.colorMap ?? "-"}|${hasNormals}`;

  mat.needsUpdate = true;
  return mat;
}

/** Liste dédupliquée des URLs de texture nécessaires à une config. */
/**
 * TOUTES les textures de la bibliothèque, pas seulement celles d'une config.
 *
 * L'éditeur laisse changer de couche à chaud. Si l'on ne chargeait que les
 * textures de la config courante, chaque changement déclencherait un aller-retour
 * réseau + transcodage KTX2 au milieu d'une frame — soit exactement le gel que
 * l'écran de chargement existe pour éviter.
 *
 * Les 7 couches pèsent ~56 Mo de VRAM une fois transcodées, contre ~570 Mo pour
 * les textures de chunks de la seule Forge. Tout charger d'emblée coûte donc
 * ~10 % de plus, et rend chaque changement de couche instantané.
 */
export function allLayerTextureUrls(): { url: string; srgb: boolean }[] {
  const out: { url: string; srgb: boolean }[] = [];
  const push = (url: string | undefined, srgb: boolean) => {
    if (url && !out.some((e) => e.url === url)) out.push({ url, srgb });
  };
  for (const layer of Object.values(TERRAIN_LAYERS)) {
    push(layer.colorMap, true);
    push(layer.normalMap, false);
  }
  push(FORGE_AUTO_MATERIAL.variationMap, false);
  return out;
}

export function autoMaterialTextureUrls(cfg: AutoMaterialConfig): { url: string; srgb: boolean }[] {
  const out: { url: string; srgb: boolean }[] = [];
  const push = (url: string | undefined, srgb: boolean) => {
    if (url && !out.some((e) => e.url === url)) out.push({ url, srgb });
  };
  for (const layer of [cfg.flat, cfg.mid, cfg.steep]) {
    if (!layer) continue;
    push(layer.colorMap, true);   // couleur → sRGB
    push(layer.normalMap, false); // normale → linéaire, sinon l'éclairage part de travers
  }
  push(cfg.variationMap, false);
  return out;
}
