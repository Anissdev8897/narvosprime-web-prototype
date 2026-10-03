// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/macroWeights.ts — Curseurs → poids de morphs. PUR.
//
// C'est ici que naît le mannequin homme/femme. MakeHuman n'a pas de « corps
// masculin » et de « corps féminin » : il a UN maillage neutre et des morphs
// qui l'emmènent vers des extrêmes discrets. Le genre est un curseur continu.
//
// ── LES TROIS FAMILLES DE MACRO-MORPHS, MESURÉES ─────────────────────────────
//
//   <ethnie>-<genre>-<âge>                          24 morphs (3 × 2 × 4)
//   universal-<genre>-<âge>-<muscle>-<poids>        64 morphs (2 × 4 × 4 × 4)
//   height/<genre>-<âge>-<muscle>-<poids>-<min|max>height
//
// Chaque famille est une grille d'ANCRES. Une position de curseur ne tombe
// presque jamais sur une ancre : on répartit donc son poids entre les deux
// ancres qui l'encadrent, et on multiplie les facteurs entre eux. Un réglage
// « homme à 70 %, jeune, musclé à 30 % » active donc plusieurs morphs à la
// fois, chacun avec sa part.
//
// C'est la propriété qui rend la morphologie CONTINUE plutôt que catalogue :
// entre deux ancres, tout est atteignable.
//
// ── BÉBÉ ET ENFANT SONT HORS PÉRIMÈTRE ───────────────────────────────────────
// MakeHuman propose quatre âges (baby, child, young, old). NARVOS est un MMO
// dont les personnages jouables sont adultes. On n'expose que `young` → `old`,
// ce qui divise d'emblée par deux le nombre de morphs à charger, et évite
// surtout de produire des corps d'enfants.
// ══════════════════════════════════════════════════════════════════════════════

/** Réglages de haut niveau du corps. Tout est normalisé sur 0 → 1. */
export interface BodyMacro {
  /** 0 = féminin, 1 = masculin. Continu : 0,5 donne un corps androgyne. */
  gender: number;
  /** 0 = jeune adulte, 1 = âgé. */
  age: number;
  /** 0 = peu musclé, 0,5 = moyen, 1 = très musclé. */
  muscle: number;
  /** 0 = mince, 0,5 = moyen, 1 = corpulent. */
  weight: number;
  /** 0 = petit, 0,5 = taille de base, 1 = grand. */
  height: number;
  /** Mélange d'ethnies. Normalisé à la somme 1 — pas besoin qu'il le soit en entrée. */
  ethnicity: { african: number; asian: number; caucasian: number };
}

/** Réglage neutre : point de départ du créateur. */
export const DEFAULT_MACRO: BodyMacro = {
  gender: 0.5, age: 0.25, muscle: 0.5, weight: 0.5, height: 0.5,
  ethnicity: { african: 1 / 3, asian: 1 / 3, caucasian: 1 / 3 },
};

/** Ancres exposées. `baby` et `child` existent chez MakeHuman mais restent hors jeu. */
const AGES = ["young", "old"] as const;
const NIVEAUX = ["min", "average", "max"] as const;

type Part = readonly [string, number];

/**
 * Répartit un curseur 0→1 entre des ancres régulièrement espacées.
 *
 * Rend uniquement les ancres de poids non nul : `applyMorphs` saute déjà les
 * poids nuls, mais les produire alourdirait le produit cartésien plus bas pour
 * rien — sur trois familles croisées, l'économie est réelle.
 */
function repartir(valeur: number, ancres: readonly string[]): Part[] {
  const v = Math.min(1, Math.max(0, valeur));
  if (ancres.length === 1) return [[ancres[0], 1]];

  const pos = v * (ancres.length - 1);
  const bas = Math.min(Math.floor(pos), ancres.length - 2);
  const frac = pos - bas;

  const out: Part[] = [];
  if (frac < 1) out.push([ancres[bas], 1 - frac]);
  if (frac > 0) out.push([ancres[bas + 1], frac]);
  return out;
}

/** Ethnies normalisées. Une somme nulle retombe sur un mélange égal. */
function ethnies(e: BodyMacro["ethnicity"]): Part[] {
  const a = Math.max(0, e.african), s = Math.max(0, e.asian), c = Math.max(0, e.caucasian);
  const total = a + s + c;
  if (total <= 0) return [["african", 1 / 3], ["asian", 1 / 3], ["caucasian", 1 / 3]];
  return ([["african", a / total], ["asian", s / total], ["caucasian", c / total]] as Part[])
    .filter(([, p]) => p > 0);
}

/** Ajoute un poids, en cumulant si l'entrée existe déjà. */
function ajouter(out: Record<string, number>, nom: string, poids: number): void {
  if (poids <= 0) return;
  out[nom] = (out[nom] ?? 0) + poids;
}

/**
 * Traduit les réglages en poids de morphs `macrodetails`.
 *
 * Le résultat se donne tel quel à `applyMorphs`. Les noms produits sont ceux du
 * pack généré par `scripts/mpfb-targets-to-bin.mjs` — s'ils divergeaient, les
 * morphs seraient introuvables et le corps resterait neutre, sans erreur. C'est
 * ce que verrouille `macroWeights.test.ts`.
 */
export function macroWeights(m: BodyMacro): Record<string, number> {
  const out: Record<string, number> = {};

  const genres = repartir(m.gender, ["female", "male"]);
  const ages = repartir(m.age, AGES);
  const muscles = repartir(m.muscle, NIVEAUX);
  const poids = repartir(m.weight, NIVEAUX);
  const eths = ethnies(m.ethnicity);

  // ── Famille 1 : ethnie × genre × âge ────────────────────────────────────────
  for (const [e, pe] of eths) {
    for (const [g, pg] of genres) {
      for (const [a, pa] of ages) ajouter(out, `${e}-${g}-${a}`, pe * pg * pa);
    }
  }

  // ── Famille 2 : composition corporelle ──────────────────────────────────────
  // Les suffixes MakeHuman ne sont pas `min`/`max` seuls mais `minmuscle`,
  // `maxweight`… Se tromper ici ne lève rien : les morphs sont simplement
  // introuvables et le corps reste neutre.
  for (const [g, pg] of genres) {
    for (const [a, pa] of ages) {
      for (const [mu, pmu] of muscles) {
        for (const [w, pw] of poids) {
          // `averagemuscle-averageweight` N'EXISTE PAS : sur les 9 combinaisons
          // possibles, MakeHuman n'en livre que 8. Le point moyen/moyen EST le
          // maillage de base — il n'y a rien à déplacer, donc pas de target.
          // Le poids correspondant n'est pas perdu : il reste implicitement sur
          // la base, ce qui est exactement le résultat voulu.
          //
          // La famille `height/` ne suit PAS cette règle et possède bien son
          // `averagemuscle-averageweight` : changer de taille déplace des
          // sommets même à corpulence moyenne. Deux familles voisines, deux
          // conventions — d'où le traitement séparé plus bas.
          if (mu === "average" && w === "average") continue;
          ajouter(out, `universal-${g}-${a}-${mu}muscle-${w}weight`, pg * pa * pmu * pw);
        }
      }
    }
  }

  // ── Famille 3 : taille ──────────────────────────────────────────────────────
  // Deux extrêmes seulement, autour d'un neutre. À 0,5 le curseur n'active RIEN :
  // la taille de base est celle du maillage, il n'existe pas de morph « moyen ».
  const ecart = (m.height - 0.5) * 2;              // -1 → +1
  if (Math.abs(ecart) > 1e-4) {
    const borne = ecart > 0 ? "max" : "min";
    const force = Math.min(1, Math.abs(ecart));
    for (const [g, pg] of genres) {
      for (const [a, pa] of ages) {
        for (const [mu, pmu] of muscles) {
          for (const [w, pw] of poids) {
            ajouter(
              out,
              `height/${g}-${a}-${mu}muscle-${w}weight-${borne}height`,
              pg * pa * pmu * pw * force,
            );
          }
        }
      }
    }
  }

  return out;
}
