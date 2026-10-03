// ══════════════════════════════════════════════════════════════════════════════
// scripts/lib/soft-raster.mjs — Micro-rendu logiciel pour les vignettes.
//
// Logique PURE : des tableaux typés entrent, un buffer RGBA sort. Ni GPU, ni
// navigateur, ni Three.js.
//
// ── POURQUOI PAS UN RENDU WEBGL ──────────────────────────────────────────────
//
// Générer 40 vignettes ne justifie ni `headless-gl` (compilation native sur
// Windows) ni Playwright (téléchargement d'un Chromium, serveur statique, et un
// aller-retour asynchrone par pièce). Une vignette de 256 px n'a besoin ni de
// textures, ni d'ombres, ni d'antialiasing matériel : une projection
// orthographique avec z-buffer et un éclairage lambert suffisent à rendre une
// tête reconnaissable d'un bras.
//
// ⚠ La géométrie est prise en POSE DE BIND. C'est voulu : les pièces sont
// affichées bras écartés, ce qui est exactement ce qu'on veut voir sur une
// vignette de sélection.
// ══════════════════════════════════════════════════════════════════════════════

/** Direction de la lumière (normalisée), depuis l'avant-haut-gauche. */
const LIGHT = (() => {
  const v = [-0.4, 0.6, 0.8];
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

/**
 * Boîte englobante d'un nuage de points (stride 3).
 * @returns {{min: number[], max: number[]}}
 */
export function bounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 2 < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return { min, max };
}

/**
 * Cadre la géométrie dans l'image : échelle isotrope + centrage.
 *
 * L'échelle est la MÊME sur X et Y — la déformer pour remplir le cadre
 * écraserait une tête en largeur et étirerait une jambe, rendant les vignettes
 * incomparables entre elles.
 */
export function fitTransform(positions, width, height, margin = 0.12) {
  const { min, max } = bounds(positions);
  const spanX = max[0] - min[0] || 1;
  const spanY = max[1] - min[1] || 1;
  const usable = 1 - margin * 2;
  const scale = Math.min((width * usable) / spanX, (height * usable) / spanY);
  return {
    scale,
    cx: (min[0] + max[0]) / 2,
    cy: (min[1] + max[1]) / 2,
    zMin: min[2],
    zMax: max[2],
  };
}

/**
 * Rastérise des triangles en projection orthographique frontale.
 *
 * @param {Float32Array|number[]} positions  xyz par sommet
 * @param {ArrayLike<number>|null} indices   triangles ; `null` = suite directe
 * @param {{width:number,height:number,color:number[],bg:number[]}} opts
 * @returns {Uint8ClampedArray} RGBA, `width * height * 4`
 */
export function rasterize(positions, indices, opts) {
  const { width, height, color = [176, 186, 200], bg = [0, 0, 0, 0] } = opts;
  const buf = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    buf[i * 4] = bg[0]; buf[i * 4 + 1] = bg[1]; buf[i * 4 + 2] = bg[2]; buf[i * 4 + 3] = bg[3] ?? 0;
  }
  // Le z-buffer démarre à -Infini : on garde le triangle le PLUS PROCHE, et Z
  // croît vers l'observateur en projection frontale glTF (+Z sort de l'écran).
  const depth = new Float32Array(width * height).fill(-Infinity);

  const count = indices ? indices.length : positions.length / 3;
  if (count < 3) return buf;

  const t = fitTransform(positions, width, height);
  const at = (i) => (indices ? indices[i] : i);
  const px = (v) => (positions[v * 3] - t.cx) * t.scale + width / 2;
  // Y s'inverse : l'image croît vers le BAS, le modèle vers le haut.
  const py = (v) => height / 2 - (positions[v * 3 + 1] - t.cy) * t.scale;
  const pz = (v) => positions[v * 3 + 2];

  const ax = [0, 0, 0], bx = [0, 0, 0];

  for (let f = 0; f + 2 < count; f += 3) {
    const i0 = at(f), i1 = at(f + 1), i2 = at(f + 2);
    const x0 = px(i0), y0 = py(i0), z0 = pz(i0);
    const x1 = px(i1), y1 = py(i1), z1 = pz(i1);
    const x2 = px(i2), y2 = py(i2), z2 = pz(i2);

    // Aire signée : nulle = triangle dégénéré, rien à remplir.
    const aire = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (aire === 0) continue;

    // Normale géométrique dans l'espace MODÈLE (pas écran) : c'est elle qui
    // porte l'éclairage. La calculer en espace écran perdrait la composante Z.
    ax[0] = positions[i1 * 3] - positions[i0 * 3];
    ax[1] = positions[i1 * 3 + 1] - positions[i0 * 3 + 1];
    ax[2] = positions[i1 * 3 + 2] - positions[i0 * 3 + 2];
    bx[0] = positions[i2 * 3] - positions[i0 * 3];
    bx[1] = positions[i2 * 3 + 1] - positions[i0 * 3 + 1];
    bx[2] = positions[i2 * 3 + 2] - positions[i0 * 3 + 2];
    let nx = ax[1] * bx[2] - ax[2] * bx[1];
    let ny = ax[2] * bx[0] - ax[0] * bx[2];
    let nz = ax[0] * bx[1] - ax[1] * bx[0];
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;

    // Valeur absolue : les GLB mélangent les orientations de faces, et une
    // normale retournée donnerait un trou noir au milieu du maillage.
    const lambert = Math.abs(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
    const shade = 0.28 + 0.72 * lambert;

    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(y0, y1, y2)));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cx = x + 0.5, cy = y + 0.5;
        const w0 = ((x1 - x0) * (cy - y0) - (cx - x0) * (y1 - y0)) / aire;
        const w1 = ((cx - x0) * (y2 - y0) - (x2 - x0) * (cy - y0)) / aire;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;

        const z = z0 * w2 + z1 * w1 + z2 * w0;
        const o = y * width + x;
        if (z <= depth[o]) continue;
        depth[o] = z;

        buf[o * 4] = color[0] * shade;
        buf[o * 4 + 1] = color[1] * shade;
        buf[o * 4 + 2] = color[2] * shade;
        buf[o * 4 + 3] = 255;
      }
    }
  }
  return buf;
}
