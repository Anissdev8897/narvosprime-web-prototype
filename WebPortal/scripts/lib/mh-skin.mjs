// ══════════════════════════════════════════════════════════════════════════════
// scripts/lib/mh-skin.mjs — Poids MakeHuman → attributs de skinning glTF.
//
// Logique PURE. Convertit la représentation MakeHuman (un groupe de sommets par
// OS) vers celle de glTF (quatre influences par SOMMET).
//
//   MakeHuman   weights["mixamorig:Head"] = [[0, 1], [1, 1], [2, 0.4], …]
//   glTF        JOINTS_0[v] = [i0,i1,i2,i3]   WEIGHTS_0[v] = [w0,w1,w2,w3]
//
// ── TROIS RÈGLES QUI CASSENT TOUT SI ON LES RATE ─────────────────────────────
//
// 1. glTF n'accepte que QUATRE influences par sommet. MakeHuman n'a pas cette
//    limite. On garde les quatre plus fortes — pas les quatre premières
//    rencontrées, ce qui donnerait un résultat dépendant de l'ordre des clés
//    JSON.
//
// 2. La somme des poids d'un sommet DOIT valoir 1. Tronquer à quatre la fait
//    baisser ; sans renormalisation, le sommet rétrécit vers l'origine dès que
//    le squelette bouge.
//
// 3. Un sommet sans aucune influence n'existe pas en glTF : il serait figé à
//    l'origine du modèle et tirerait une pointe depuis le centre. On le rattache
//    à un os de repli.
// ══════════════════════════════════════════════════════════════════════════════

/** Nombre d'influences par sommet imposé par glTF. */
export const INFLUENCES = 4;

/**
 * Construit `JOINTS_0` et `WEIGHTS_0` à partir des groupes MakeHuman.
 *
 * @param {Record<string, [number, number][]>} groups  os → [[sommet, poids], …]
 * @param {string[]} boneOrder  ordre des os dans le squelette ; l'index dans ce
 *   tableau devient l'indice de joint glTF. DOIT être le même tableau que celui
 *   utilisé pour construire les nœuds, sinon chaque sommet suit un autre os.
 * @param {number} vertexCount
 * @param {number} [fallbackBone=0]  os des sommets orphelins
 * @returns {{joints: Uint16Array, weights: Float32Array, orphans: number, truncated: number}}
 */
export function buildSkinAttributes(groups, boneOrder, vertexCount, fallbackBone = 0) {
  const boneIndex = new Map(boneOrder.map((n, i) => [n, i]));

  // Accumulation par sommet. Un tableau de tableaux plutôt qu'une Map : on
  // indexe 19 000 sommets, l'accès direct est nettement plus rapide.
  /** @type {([number, number][])[]} */
  const parVertex = Array.from({ length: vertexCount }, () => []);

  for (const [bone, entries] of Object.entries(groups)) {
    const bi = boneIndex.get(bone);
    if (bi === undefined) continue;          // os absent du squelette retenu
    for (const [v, w] of entries) {
      if (v < 0 || v >= vertexCount || !(w > 0)) continue;
      parVertex[v].push([bi, w]);
    }
  }

  const joints = new Uint16Array(vertexCount * INFLUENCES);
  const weights = new Float32Array(vertexCount * INFLUENCES);
  let orphans = 0, truncated = 0;

  for (let v = 0; v < vertexCount; v++) {
    const infl = parVertex[v];

    if (infl.length === 0) {
      joints[v * INFLUENCES] = fallbackBone;
      weights[v * INFLUENCES] = 1;
      orphans++;
      continue;
    }

    // Les QUATRE PLUS FORTES, pas les quatre premières : l'ordre des clés d'un
    // objet JSON n'a aucune signification anatomique.
    if (infl.length > INFLUENCES) {
      infl.sort((a, b) => b[1] - a[1]);
      truncated++;
    }

    let somme = 0;
    const n = Math.min(infl.length, INFLUENCES);
    for (let k = 0; k < n; k++) somme += infl[k][1];

    for (let k = 0; k < n; k++) {
      joints[v * INFLUENCES + k] = infl[k][0];
      // Renormalisation systématique : après troncature la somme est < 1, et
      // MakeHuman lui-même ne garantit pas des groupes normalisés.
      weights[v * INFLUENCES + k] = somme > 0 ? infl[k][1] / somme : 0;
    }
  }

  return { joints, weights, orphans, truncated };
}

/**
 * Position d'un os depuis le maillage : moyenne des sommets qui le définissent.
 *
 * C'est le mécanisme `strategy: "MEAN"` de MPFB2, et c'est ce qui permet au
 * squelette de SUIVRE la morphologie : quand les curseurs déforment le corps,
 * on recalcule les positions d'os depuis le maillage déformé, au lieu de garder
 * un squelette figé dans un corps qui a changé de taille.
 *
 * `fallback` sert quand la liste d'indices est vide ou hors bornes — la
 * position par défaut fournie par le fichier de rig.
 */
export function boneHeadPosition(positions, vertexIndices, fallback) {
  if (!vertexIndices?.length) return fallback;
  let x = 0, y = 0, z = 0, n = 0;
  for (const i of vertexIndices) {
    const o = i * 3;
    if (o < 0 || o + 2 >= positions.length) continue;
    x += positions[o]; y += positions[o + 1]; z += positions[o + 2];
    n++;
  }
  return n === 0 ? fallback : [x / n, y / n, z / n];
}

/**
 * Ordonne les os pour que chaque PARENT précède ses enfants.
 *
 * glTF n'impose pas cet ordre, mais le calcul des matrices monde le suppose :
 * traiter un enfant avant son parent donnerait une pose de bind fausse. Tri
 * topologique, les orphelins d'abord.
 *
 * @param {Record<string, {parent?: string}>} bones
 * @returns {string[]}
 */
export function topologicalBoneOrder(bones) {
  const out = [];
  const vus = new Set();
  // `enCours` marque les nœuds de la branche de récursion courante. Sans lui,
  // `A → B → A` boucle indéfiniment : `vus` n'est renseigné qu'APRÈS le retour
  // de la récursion, donc il ne peut pas rompre le cycle. Débordement de pile
  // au chargement, sans message exploitable.
  const enCours = new Set();

  const visiter = (nom) => {
    if (vus.has(nom) || enCours.has(nom) || !bones[nom]) return;
    enCours.add(nom);
    const p = bones[nom].parent;
    if (p && p !== nom) visiter(p);          // le parent d'abord
    enCours.delete(nom);
    if (vus.has(nom)) return;
    vus.add(nom);
    out.push(nom);
  };

  for (const nom of Object.keys(bones)) visiter(nom);
  return out;
}
