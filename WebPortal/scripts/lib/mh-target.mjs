// ══════════════════════════════════════════════════════════════════════════════
// scripts/lib/mh-target.mjs — Lecture du format de cibles MakeHuman / MPFB2.
//
// Logique PURE : du texte entre, des tableaux typés sortent. Ni gzip, ni
// système de fichiers, ni glTF.
//
// ── LE FORMAT ────────────────────────────────────────────────────────────────
//
// Une cible `.target` est une liste de DELTAS ÉPARS, un par ligne :
//
//     161 0 -.011 0
//     184 0 -.005 0
//     ↑    ↑
//     │    └─ déplacement x y z, en unités du maillage de base
//     └────── indice de sommet dans `base.obj`
//
// Seuls les sommets déplacés sont listés. Un nez complet tient en ~310 lignes
// sur les ~13 000 sommets du maillage — d'où des fichiers de 1 Ko compressés,
// alors qu'un morph target glTF dense pèserait 150 Ko.
//
// ⚠ TROIS PIÈGES DE PARSING, tous présents dans les vrais fichiers :
//   • flottants sans zéro initial : `-.011` (valide en JS, pas partout)
//   • séparateurs multiples ou tabulations
//   • lignes de commentaire `#` et lignes vides en fin de fichier
//
// ── CE QUE CE MODULE NE FAIT PAS ─────────────────────────────────────────────
//
// Il ne combine pas les cibles MACRO (genre × âge × muscle × poids). Celles-ci
// suivent une interpolation propre à MakeHuman, différente d'une somme pondérée.
// Les cibles de détail (nez, oreilles, proportions) sont indépendantes et
// s'additionnent linéairement — ce sont celles qui alimentent les curseurs.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Analyse un fichier `.target` décompressé.
 *
 * @param {string} text
 * @param {number} [vertexCount] borne de validation ; les indices au-delà sont
 *   IGNORÉS plutôt que conservés — un indice hors bornes provoquerait une
 *   écriture mémoire invalide au moment d'appliquer le delta.
 * @returns {{indices: Uint32Array, deltas: Float32Array, skipped: number}}
 */
export function parseTarget(text, vertexCount = Infinity) {
  const idx = [];
  const del = [];
  let skipped = 0;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;

    const p = line.split(/\s+/);
    if (p.length < 4) { skipped++; continue; }

    const i = Number.parseInt(p[0], 10);
    const dx = Number.parseFloat(p[1]);
    const dy = Number.parseFloat(p[2]);
    const dz = Number.parseFloat(p[3]);

    if (!Number.isInteger(i) || i < 0 || i >= vertexCount) { skipped++; continue; }
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(dz)) { skipped++; continue; }

    idx.push(i);
    del.push(dx, dy, dz);
  }

  return { indices: Uint32Array.from(idx), deltas: Float32Array.from(del), skipped };
}

/**
 * Amplitude maximale d'un jeu de deltas — sert à décider d'une quantification.
 */
export function maxDelta(deltas) {
  let m = 0;
  for (let i = 0; i < deltas.length; i++) {
    const v = Math.abs(deltas[i]);
    if (v > m) m = v;
  }
  return m;
}

/**
 * Applique une cible à un tableau de positions, pondérée par `weight`.
 *
 * Mute `positions` EN PLACE. L'appelant travaille sur une copie du maillage de
 * base : repartir des positions déjà modifiées ferait dériver le résultat à
 * chaque mouvement de curseur.
 *
 * @returns nombre de sommets touchés
 */
export function applyTarget(positions, indices, deltas, weight) {
  if (weight === 0) return 0;
  for (let k = 0; k < indices.length; k++) {
    const o = indices[k] * 3;
    positions[o] += deltas[k * 3] * weight;
    positions[o + 1] += deltas[k * 3 + 1] * weight;
    positions[o + 2] += deltas[k * 3 + 2] * weight;
  }
  return indices.length;
}

/**
 * Positions d'un `.obj` — uniquement les lignes `v`.
 *
 * Les `vt` (UV) et `vn` (normales) commencent aussi par `v` : le test porte sur
 * le token complet, sinon le tableau contiendrait trois fois trop d'entrées et
 * tous les indices de cibles pointeraient à côté.
 */
export function parseObjPositions(text) {
  const out = [];
  for (const raw of text.split("\n")) {
    if (raw.charCodeAt(0) !== 118 /* v */) continue;   // filtre rapide
    const p = raw.trim().split(/\s+/);
    if (p[0] !== "v") continue;
    out.push(Number.parseFloat(p[1]), Number.parseFloat(p[2]), Number.parseFloat(p[3]));
  }
  return Float32Array.from(out);
}

/**
 * Identifiant stable et catégorie déduits du chemin relatif d'une cible.
 *
 * `macrodetails/height/height-baby-...target.gz` → catégorie `macrodetails/height`,
 * id `macrodetails.height.height-baby-...`. L'identifiant sert de clé dans le
 * manifeste : il doit survivre à une réorganisation de dossiers côté MPFB2,
 * donc il encode le chemin, pas un compteur.
 */
export function targetIdFromPath(relPath) {
  const clean = relPath
    .replace(/\\/g, "/")
    .replace(/\.target(\.gz)?$/i, "");
  const parts = clean.split("/").filter(Boolean);
  const name = parts.pop() ?? "";
  return {
    id: [...parts, name].join("."),
    category: parts.join("/") || "root",
    name,
  };
}
