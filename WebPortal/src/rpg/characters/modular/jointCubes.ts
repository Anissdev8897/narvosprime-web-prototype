// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/jointCubes.ts — Le squelette suit la morphologie. PUR.
//
// ── LE MÉCANISME DE MPFB, REPRODUIT ─────────────────────────────────────────
//
// Un os MPFB n'est pas une donnée, c'est une FONCTION du maillage : sa position
// est le centroïde d'un « joint cube » — 8 sommets d'aide noyés dans le maillage
// de base (`joint-l-elbow` = sommets 14038→14045). Comme les morph targets
// déplacent AUSSI ces sommets, recalculer le centroïde après chaque passe fait
// suivre le squelette, sans une ligne de correctif par cas.
//
// ── POURQUOI C'EST NÉCESSAIRE, ET CE QUE ÇA CORRIGE ─────────────────────────
//
// Le GLB ne porte que la pose de BIND, calculée sur le maillage NEUTRE. Dès
// qu'un curseur déforme le corps, la peau bouge et les os restent. Deux
// conséquences visibles :
//   • la peau se déforme autour d'un squelette qui n'est plus le sien ;
//   • toute pièce accrochée à un os (une coiffure sur `head`) flotte — c'est
//     exactement ce qu'on observait sur un crâne rétréci.
//
// ── CE QUI N'EST PAS RECALCULÉ, ET POURQUOI ─────────────────────────────────
//
// Seuls les 53 os d'auteur ont un cube. Les 36 os Manny injérés (twists, IK,
// métacarpiens, `spine_04/05`) ont une translation locale NULLE : ils suivent
// leur parent par construction, donc les laisser tranquilles les fait suivre
// aussi. Leur inventer une position serait inventer une donnée.
// ══════════════════════════════════════════════════════════════════════════════

import { BODY_ROOT } from "./morphLoader";

export interface OsRecette {
  nom: string;
  parent: string | null;
  /** Indices CANONIQUES des sommets du cube. */
  cube: number[];
  /** Position MONDE au repos, en mètres, sol compris. Cf. `positionsMonde`. */
  neutre: [number, number, number];
}

export interface RecetteSquelette {
  /** Décimètres MakeHuman → mètres. */
  scale: number;
  /** Remontée appliquée à la construction pour poser les pieds au sol. */
  groundOffset: number;
  canonicalVertexCount: number | null;
  bones: OsRecette[];
}

const URL_RECETTE = `${BODY_ROOT}/joint-cubes.json`;
let enCours: Promise<RecetteSquelette> | null = null;

/**
 * Charge la recette une seule fois.
 *
 * ⚠ Le fallback SPA de Vite renvoie du `text/html` en 200 pour un fichier
 * ABSENT — `resp.ok` seul ferait donc croire au succès, puis `JSON.parse`
 * échouerait sur du HTML avec un message incompréhensible.
 */
export function loadJointCubes(): Promise<RecetteSquelette> {
  if (enCours) return enCours;
  enCours = (async () => {
    const resp = await fetch(URL_RECETTE);
    const ct = (resp.headers.get("content-type") ?? "").toLowerCase();
    if (!resp.ok || !ct.includes("json")) {
      throw new Error(`joint-cubes.json introuvable (HTTP ${resp.status}, ${ct || "sans type"})`);
    }
    return (await resp.json()) as RecetteSquelette;
  })().catch((e) => { enCours = null; throw e; });
  return enCours;
}

/**
 * Positions MONDE des os, recalculées depuis le maillage morphé.
 *
 * ⚠ `canonical` NE CONTIENT PAS DE POSITION AUX INDICES DES CUBES.
 *
 * Les joint cubes sont des HELPERS MakeHuman : ils n'appartiennent à aucune
 * face rendue, donc `gatherFromRender` les laisse à ZÉRO (il le documente).
 * `applyMorphs` y ajoute ensuite les deltas. À ces indices, le tableau porte
 * donc un **DÉPLACEMENT**, pas une position.
 *
 * On part donc de `neutre` — la position au repos calculée à la construction —
 * et on y ajoute le déplacement moyen du cube. Lire `canonical` comme une
 * position absolue effondrait TOUS les os à l'origine : corps écrasé, sans la
 * moindre erreur levée.
 *
 * `scale` convertit les décimètres MakeHuman en mètres. `groundOffset` est déjà
 * compris dans `neutre` — l'ajouter ici le compterait deux fois.
 */
export function positionsMonde(
  canonical: Float32Array,
  recette: RecetteSquelette,
  sortie: Map<string, [number, number, number]> = new Map(),
): Map<string, [number, number, number]> {
  const { scale } = recette;
  for (const b of recette.bones) {
    let dx = 0, dy = 0, dz = 0, n = 0;
    for (const v of b.cube) {
      const i = v * 3;
      // Un indice hors bornes donnerait `undefined`, donc NaN, donc un os à
      // l'infini et un corps invisible. On saute plutôt que d'empoisonner.
      if (i + 2 >= canonical.length) continue;
      dx += canonical[i]; dy += canonical[i + 1]; dz += canonical[i + 2];
      n++;
    }
    // Aucun sommet lisible : on rend la pose de repos, jamais rien. Un os
    // absent ferait diverger la soustraction du parent chez ses enfants.
    sortie.set(b.nom, n === 0 ? [...b.neutre] : [
      b.neutre[0] + (dx / n) * scale,
      b.neutre[1] + (dy / n) * scale,
      b.neutre[2] + (dz / n) * scale,
    ]);
  }
  return sortie;
}

/**
 * Translations LOCALES, prêtes à être posées sur les os.
 *
 * glTF et three composent les transforms : écrire la position monde sur chaque
 * os cumulerait celle de tous ses parents. On soustrait donc le parent — et on
 * ne rend QUE les os dont le parent a lui aussi été recalculé, sinon la
 * soustraction mélangerait deux repères.
 */
export function translationsLocales(
  monde: Map<string, [number, number, number]>,
  recette: RecetteSquelette,
): Map<string, [number, number, number]> {
  const out = new Map<string, [number, number, number]>();
  for (const b of recette.bones) {
    const p = monde.get(b.nom);
    if (!p) continue;
    const parent = b.parent ? monde.get(b.parent) : null;
    out.set(b.nom, parent
      ? [p[0] - parent[0], p[1] - parent[1], p[2] - parent[2]]
      : [p[0], p[1], p[2]]);
  }
  return out;
}
