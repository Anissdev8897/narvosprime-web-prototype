// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/morphSliders.ts — 1 250 cibles MakeHuman → curseurs. PUR.
//
// LE PROBLÈME QUE ÇA RÉSOUT
// `_body/morphs/` contient 24 régions et 1 250 morphs, convertis et posés sur le
// disque. Le créateur n'en charge QU'UNE (`macrodetails`) : 910 morphs — nez,
// joues, oreilles, ventre, menton, front, cou, hanches… — dorment. Pas parce
// qu'ils manquent, mais parce que rien ne les expose.
//
// On ne peut pas faire 1 250 curseurs. MakeHuman n'en fait pas non plus : ses
// cibles vont par COUPLES OPPOSÉS, et un couple = un curseur bidirectionnel.
//
// ── LA CONVENTION, RELEVÉE SUR LES 808 CIBLES (hors macro/expression) ────────
//
//   <zone>-<propriété>-<direction>
//
//   decr/incr           179 + 179     nose-flaring-decr | nose-flaring-incr
//   down/up              36 +  36     nose-base-down    | nose-base-up
//   in/out               24 +  24     stomach-navel-in  | stomach-navel-out
//   backward/forward     14 +  14     l-ear-rot-backward
//   concave/convex        3 +   3     nose-curve-concave
//   compress/uncompress   1 +   1     nose-compression-compress
//
// Les comptes s'équilibrent EXACTEMENT dans chaque couple — c'est ce qui rend
// l'appariement sûr plutôt que devinable.
//
// DEUX CAS QUI NE SONT PAS DES COUPLES, et qu'il serait faux de forcer :
//   • `min|average|maxfirmness` (81/54/81) — un axe à TROIS ancres, comme les
//     macro-morphs. Un couple min/max perdrait l'ancre du milieu.
//   • formes discrètes (`triangle`, `round`, `oval`, `diamond`, `square`,
//     `pointed`, `rectangular`, `triangular`, `invertedtriangular`) — un CHOIX,
//     pas un continuum. Les mettre sur un curseur mélangerait des formes qui ne
//     s'interpolent pas.
//
// ── SYMÉTRIE ────────────────────────────────────────────────────────────────
// Joues et oreilles sont préfixées `l-`/`r-` (et 31 cibles portent un SUFFIXE
// `-l`/`-r`). Par défaut on les pilote ENSEMBLE : un visage humain est
// symétrique, et deux curseurs par oreille en ferait 22 au lieu de 11. La
// région `asym` existe précisément pour rompre cette symétrie quand on le veut.
// ══════════════════════════════════════════════════════════════════════════════

import type { MorphRegion } from "./morphLoader";

/**
 * Couples opposés, relevés sur les données.
 *
 * L'ordre du couple est [négatif, positif] : le curseur va du premier au
 * second. `decr` à gauche, `incr` à droite — sens de lecture attendu.
 */
export const COUPLES: readonly (readonly [string, string])[] = [
  ["decr", "incr"],
  ["down", "up"],
  ["in", "out"],
  ["backward", "forward"],
  ["concave", "convex"],
  ["compress", "uncompress"],
];

const DIRECTIONS = new Map<string, { couple: number; positif: boolean }>();
COUPLES.forEach(([neg, pos], i) => {
  DIRECTIONS.set(neg, { couple: i, positif: false });
  DIRECTIONS.set(pos, { couple: i, positif: true });
});

/** Suffixes d'un axe à trois ancres — pas un couple. */
const FERMETE = new Set(["minfirmness", "averagefirmness", "maxfirmness"]);

/** Formes discrètes : un choix, jamais un curseur. */
const FORMES = new Set([
  "triangle", "round", "square", "oval", "diamond", "pointed",
  "rectangular", "triangular", "invertedtriangular",
]);

export type Cote = "gauche" | "droite" | "centre";

export interface MorphAnalyse {
  /** Nom complet de la cible, tel qu'il est dans le pack. */
  nom: string;
  /** Identifiant de l'axe, côté et direction retirés — la clé d'appariement. */
  axe: string;
  cote: Cote;
  /** Indice dans `COUPLES`, ou -1 si la cible n'appartient à aucun couple. */
  couple: number;
  positif: boolean;
}

/**
 * Décompose un nom de cible.
 *
 * Le côté peut être un PRÉFIXE (`l-cheek-bones-incr`) ou un SUFFIXE
 * (`…-l`) — les deux existent dans les packs. Retirer les deux formes est ce
 * qui permet à la gauche et à la droite de tomber sur le MÊME axe.
 */
export function analyseMorph(nom: string): MorphAnalyse | null {
  let reste = nom;
  let cote: Cote = "centre";

  const prefixe = /^([lr])-/.exec(reste);
  if (prefixe) {
    cote = prefixe[1] === "l" ? "gauche" : "droite";
    reste = reste.slice(2);
  }
  const suffixe = /-([lr])$/.exec(reste);
  if (suffixe) {
    cote = suffixe[1] === "l" ? "gauche" : "droite";
    reste = reste.slice(0, -2);
  }

  const morceaux = reste.split("-");
  const direction = morceaux[morceaux.length - 1];

  // Formes et fermeté sortent AVANT l'appariement : les forcer sur un curseur
  // interpolerait des états qui ne s'interpolent pas.
  if (FORMES.has(direction) || FERMETE.has(direction)) return null;

  const d = DIRECTIONS.get(direction);
  if (!d) return null;

  return {
    nom,
    axe: morceaux.slice(0, -1).join("-"),
    cote,
    couple: d.couple,
    positif: d.positif,
  };
}

export interface MorphSlider {
  /** Stable : région + axe. Sert de clé React et de clé de sauvegarde. */
  id: string;
  region: MorphRegion;
  /** L'axe, sans côté ni direction — base du libellé affiché. */
  axe: string;
  /** Cibles jouées quand la valeur est négative (valeur absolue en poids). */
  negatif: readonly string[];
  /** Cibles jouées quand la valeur est positive. */
  positif: readonly string[];
  /** Vrai si l'axe existe à gauche ET à droite, donc piloté symétriquement. */
  symetrique: boolean;
}

/**
 * Regroupe les cibles d'une région en curseurs.
 *
 * Un axe présent des deux côtés donne UN curseur symétrique dont chaque
 * extrémité porte les deux cibles. C'est ce qui fait passer les oreilles de
 * 44 cibles à 11 curseurs.
 */
export function construireSliders(
  region: MorphRegion,
  noms: readonly string[],
): MorphSlider[] {
  const parAxe = new Map<string, { neg: string[]; pos: string[]; cotes: Set<Cote> }>();

  for (const nom of noms) {
    const a = analyseMorph(nom);
    if (!a) continue;
    const cle = `${a.couple}|${a.axe}`;
    let e = parAxe.get(cle);
    if (!e) { e = { neg: [], pos: [], cotes: new Set() }; parAxe.set(cle, e); }
    (a.positif ? e.pos : e.neg).push(nom);
    e.cotes.add(a.cote);
  }

  const sliders: MorphSlider[] = [];
  for (const [cle, e] of parAxe) {
    // Un axe sans ses DEUX extrémités n'est pas un curseur : le pousser d'un
    // seul côté donnerait une course asymétrique et trompeuse.
    if (e.neg.length === 0 || e.pos.length === 0) continue;
    const iCouple = Number(cle.slice(0, cle.indexOf("|")));
    const axe = cle.slice(cle.indexOf("|") + 1);
    // ⚠ LE COUPLE FAIT PARTIE DE L'IDENTITÉ.
    // Un même axe existe sur PLUSIEURS couples : `head-trans` a une variante
    // `down/up` ET une variante `in/out`. Le regroupement les distingue déjà
    // (`${couple}|${axe}`) — pas l'id. Deux curseurs différents recevaient donc
    // `head.head-trans` : React en omettait un (« two children with the same
    // key ») et leurs valeurs sauvegardées s'écrasaient mutuellement.
    sliders.push({
      id: `${region}.${axe}-${COUPLES[iCouple][0]}_${COUPLES[iCouple][1]}`,
      region,
      axe,
      negatif: e.neg.slice().sort(),
      positif: e.pos.slice().sort(),
      symetrique: e.cotes.has("gauche") && e.cotes.has("droite"),
    });
  }
  return sliders.sort((a, b) => a.axe.localeCompare(b.axe));
}

/**
 * Position d'un curseur → poids par cible.
 *
 * `valeur` va de -1 à +1 ; 0 ne joue rien. Les deux extrémités ne sont JAMAIS
 * actives ensemble — sur des morphs opposés, ça se soustrairait à peu près, et
 * le curseur semblerait mort au milieu de sa course.
 */
export function poidsDuSlider(
  slider: MorphSlider,
  valeur: number,
  sortie: Record<string, number> = {},
): Record<string, number> {
  const v = Math.max(-1, Math.min(1, valeur));
  const cibles = v < 0 ? slider.negatif : slider.positif;
  const poids = Math.abs(v);
  for (const c of cibles) sortie[c] = poids;
  return sortie;
}

/** Agrège les positions de plusieurs curseurs en une table de poids. */
export function poidsDesSliders(
  sliders: readonly MorphSlider[],
  valeurs: Readonly<Record<string, number>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sliders) {
    const v = valeurs[s.id];
    if (!v) continue;               // 0, NaN et undefined : rien à jouer
    poidsDuSlider(s, v, out);
  }
  return out;
}
