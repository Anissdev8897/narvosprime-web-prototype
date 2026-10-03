// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/morphSet.ts — Application des morphs MakeHuman. PUR.
//
// Aucune dépendance à Three.js ni à React : ce module ne fait que de
// l'arithmétique sur des tableaux typés. C'est ce qui le rend testable en
// environnement `node` (cf. vitest.config.ts) et ce qui permet de le déplacer
// vers le WASM plus tard sans rien réécrire de la logique.
//
// ── DEUX ESPACES DE SOMMETS, ET C'EST TOUT LE SUJET ──────────────────────────
//
//   ESPACE CANONIQUE   19 158 sommets, l'ordre exact de `base.obj`. Les morphs
//                      y sont indexés. Il contient les helpers MakeHuman
//                      (5 778 sommets invisibles servant à ajuster les
//                      vêtements) : les morphs les déforment aussi, on ne peut
//                      donc pas les retirer.
//   ESPACE DE RENDU    14 517 sommets — le seul groupe `body`, avec 1 137
//                      sommets dupliqués aux coutures UV.
//
// On morphe dans l'espace canonique, PUIS on redistribue vers le rendu via
// `_MORPH_INDEX` (l'attribut que `mpfb-base-to-glb.mjs` embarque dans le GLB).
// Faire l'inverse — morpher directement le buffer de rendu — appliquerait deux
// fois le delta aux sommets dupliqués, et fendrait le maillage aux coutures.
//
// Format binaire produit par `scripts/mpfb-targets-to-bin.mjs` :
//   [uint32 LE] longueur de l'en-tête · [utf8] en-tête JSON · [données]
//   par morph : Uint16Array(count) indices, Int16Array(count*3) deltas quantifiés
// ══════════════════════════════════════════════════════════════════════════════

/** Un morph : les sommets qu'il touche et de combien. */
export interface Morph {
  name: string;
  count: number;
  /** Facteur de déquantification : delta réel = valeur Int16 × scale. */
  scale: number;
  indices: Uint16Array;
  /** Deltas quantifiés, entrelacés (dx, dy, dz) × count. */
  deltas: Int16Array;
}

export interface MorphSet {
  region: string;
  canonicalVertexCount: number;
  morphs: Map<string, Morph>;
}

interface EnteteMorph {
  name: string;
  count: number;
  scale: number;
  indexOffset: number;
  deltaOffset: number;
}

/**
 * Lit un fichier `.morphs`.
 *
 * Les vues typées pointent DANS le buffer d'origine (aucune copie) : les 46 Mo
 * de morphs ne sont lus qu'une fois. En contrepartie l'appelant doit garder le
 * `ArrayBuffer` vivant tant que le `MorphSet` sert.
 */
export function parseMorphSet(buffer: ArrayBuffer): MorphSet {
  const vue = new DataView(buffer);
  // Longueur ALIGNÉE sur 4 : elle inclut le bourrage, pour que le début des
  // données tombe juste, et que `new Int16Array(buffer, offset)` ne lève pas.
  const enteteLen = vue.getUint32(0, true);
  // Le bourrage est fait de `\0`, que `JSON.parse` refuse. On le retire donc
  // avant de parser — sans ça, un en-tête dont la longueur n'est pas déjà un
  // multiple de 4 fait échouer la lecture. C'est le cas de la plupart d'entre
  // eux : la taille du JSON dépend du nombre de morphs et de leurs noms.
  const brut = new TextDecoder().decode(new Uint8Array(buffer, 4, enteteLen));
  const json = brut.replace(/\0+$/, "");
  const entete = JSON.parse(json) as {
    region: string;
    canonicalVertexCount: number;
    morphs: EnteteMorph[];
  };

  const base = 4 + enteteLen;
  const morphs = new Map<string, Morph>();
  for (const m of entete.morphs) {
    morphs.set(m.name, {
      name: m.name,
      count: m.count,
      scale: m.scale,
      indices: new Uint16Array(buffer, base + m.indexOffset, m.count),
      deltas: new Int16Array(buffer, base + m.deltaOffset, m.count * 3),
    });
  }
  return { region: entete.region, canonicalVertexCount: entete.canonicalVertexCount, morphs };
}

/**
 * Vérifie qu'un jeu de morphs correspond au mesh chargé.
 *
 * SANS CE CONTRÔLE, LE MODE D'ÉCHEC EST SILENCIEUX : des indices calculés pour
 * une autre topologie déplacent des sommets au hasard, et on obtient un corps
 * difforme sans la moindre erreur. Le GLB porte `canonicalVertexCount` dans ses
 * `extras`, chaque `.morphs` dans son en-tête — ils doivent concorder.
 */
export function assertCompatible(set: MorphSet, canonicalVertexCount: number): void {
  if (set.canonicalVertexCount !== canonicalVertexCount) {
    throw new Error(
      `morphs « ${set.region} » : espace canonique ${set.canonicalVertexCount}, ` +
      `mesh ${canonicalVertexCount} — jeux incompatibles`,
    );
  }
}

/** Poids par nom de morph. Un morph absent de la table vaut 0. */
export type MorphWeights = Readonly<Record<string, number>>;

/**
 * Applique les morphs pondérés dans l'espace canonique.
 *
 * `out` reçoit `base` plus la somme des deltas. Les deux tableaux sont fournis
 * par l'appelant et réutilisés d'un appel à l'autre : cette fonction tourne à
 * chaque mouvement de curseur, elle ne doit rien allouer.
 *
 * Un poids nul est ignoré AVANT la boucle interne — sur 1 250 morphs dont une
 * poignée est active, c'est ce qui fait la différence entre un curseur fluide
 * et un curseur qui saccade.
 *
 * `unitScale` réconcilie deux unités qui ne peuvent pas être alignées à la
 * source. Les deltas MakeHuman sont en DÉCIMÈTRES ; le corps riggé, lui, est en
 * MÈTRES, parce qu'il hérite du squelette Mixamo du jeu et qu'on ne redimensionne
 * pas un squelette pour arranger un pack de morphs. Passer
 * `MAKEHUMAN_TO_METERS` remet les deux dans le même repère.
 *
 * L'oublier ne lève rien : le corps se déforme simplement DIX FOIS trop, et on
 * croit à un bug de morphs.
 */
export function applyMorphs(
  base: Float32Array,
  out: Float32Array,
  sets: readonly MorphSet[],
  weights: MorphWeights,
  unitScale = 1,
): void {
  out.set(base);

  for (const set of sets) {
    for (const nom in weights) {
      const poids = weights[nom];
      if (!poids) continue;              // 0, NaN et undefined : rien à faire
      const m = set.morphs.get(nom);
      if (!m) continue;

      const f = poids * m.scale * unitScale;
      const { indices, deltas, count } = m;
      for (let k = 0; k < count; k++) {
        const v = indices[k] * 3;
        const d = k * 3;
        out[v]     += deltas[d]     * f;
        out[v + 1] += deltas[d + 1] * f;
        out[v + 2] += deltas[d + 2] * f;
      }
    }
  }
}

/**
 * Redistribue les positions canoniques vers le buffer de rendu.
 *
 * `morphIndex[i]` donne, pour le sommet de rendu `i`, son indice canonique. Les
 * sommets dupliqués aux coutures UV partagent donc la même source et restent
 * cousus — c'est exactement ce qu'on perdrait en morphant le rendu directement.
 */
export function scatterToRender(
  canonical: Float32Array,
  morphIndex: Uint32Array,
  renderPositions: Float32Array,
): void {
  for (let i = 0; i < morphIndex.length; i++) {
    const src = morphIndex[i] * 3;
    const dst = i * 3;
    renderPositions[dst]     = canonical[src];
    renderPositions[dst + 1] = canonical[src + 1];
    renderPositions[dst + 2] = canonical[src + 2];
  }
}

/**
 * Reconstruit les positions canoniques depuis le mesh de rendu.
 *
 * POURQUOI C'EST NÉCESSAIRE — et pourquoi ça suffit.
 * Le GLB ne transporte que les 14 517 positions de RENDU ; les morphs, eux,
 * indexent les 19 158 positions CANONIQUES. Embarquer les deux listes
 * doublerait le fichier pour rien.
 *
 * On remplit donc l'espace canonique depuis ce qu'on a. Les 5 778 sommets
 * helpers restent à zéro : ils n'appartiennent à aucune face rendue, donc
 * `scatterToRender` ne les relira jamais. Un morph qui les déplace écrit dans
 * du vide, sans conséquence.
 *
 * Les doublons de couture partagent une source canonique et portent la MÊME
 * position — les réécrire est idempotent.
 *
 * ── PLUSIEURS SURFACES DANS UN SEUL ESPACE CANONIQUE ────────────────────────
 *
 * Le corps est livré en DEUX primitives (la peau, les yeux) qui indexent le même
 * espace canonique sur des plages DISJOINTES. Les rassembler dans un seul
 * tableau permet de ne faire qu'UNE passe de morphs pour tout le personnage.
 *
 * Mais la remise à zéro les rendrait exclusives : le second appel effacerait ce
 * que le premier vient d'écrire, et la peau retomberait à l'origine — un corps
 * réduit à deux yeux flottants. D'où `reset`, à laisser vrai pour la PREMIÈRE
 * surface seulement.
 */
export function gatherFromRender(
  renderPositions: Float32Array,
  morphIndex: Uint32Array,
  canonical: Float32Array,
  reset = true,
): void {
  if (reset) canonical.fill(0);
  for (let i = 0; i < morphIndex.length; i++) {
    const dst = morphIndex[i] * 3;
    const src = i * 3;
    canonical[dst]     = renderPositions[src];
    canonical[dst + 1] = renderPositions[src + 1];
    canonical[dst + 2] = renderPositions[src + 2];
  }
}

/**
 * Facteur d'échelle MakeHuman → mètres.
 *
 * Mesuré sur `base.obj` : emprise 9,95 × 16,95 × 4,36, soit une taille de 16,95.
 * MakeHuman travaille en décimètres — le corps fait donc 1,695 m, une taille
 * humaine plausible. Sans ce facteur, le personnage arriverait dix fois trop
 * grand dans une map dont les métriques sont en mètres (cf. narvos-level-design).
 */
export const MAKEHUMAN_TO_METERS = 0.1;
