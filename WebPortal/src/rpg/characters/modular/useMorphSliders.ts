// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/useMorphSliders.ts — Charge les régions et en tire les curseurs.
//
// Le pack d'une région porte les NOMS des cibles ; `construireSliders` en tire
// les axes. Il faut donc l'avoir chargé pour savoir quels curseurs afficher —
// d'où ce hook plutôt qu'une table écrite à la main, qui se désynchroniserait
// du jour où un pack change.
//
// ── CHARGEMENT À LA DEMANDE ──────────────────────────────────────────────────
// Les 23 régions pèsent de 4 Ko (`buttocks`) à 1,7 Mo (`breast`). Tout charger
// à l'ouverture de l'onglet ferait attendre pour des curseurs que le joueur ne
// touchera peut-être jamais. On ne charge donc que la région DÉPLIÉE.
//
// `loadMorphRegion` mémorise ses promesses (`enCours`) : le pack demandé ici et
// celui que `MorphedBody` charge pour morpher sont le MÊME téléchargement.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import { loadMorphRegions, type MorphRegion } from "./morphLoader";
import { construireSliders, type MorphSlider } from "./morphSliders";

/**
 * Régions de morphologie fine, dans l'ordre d'affichage.
 *
 * `macrodetails` en est ABSENT : il est piloté par les boutons Genre et
 * Morphologie, pas par des curseurs. L'exposer deux fois donnerait deux
 * contrôles qui se contredisent.
 *
 * `expression` en est absent aussi : ce sont des poses de visage (sourire,
 * colère), pas de la morphologie — leur place est dans l'animation.
 */
export const REGIONS_FINES: readonly MorphRegion[] = [
  "head", "nose", "mouth", "eyes", "ears", "cheek", "chin", "forehead",
  "eyebrows", "neck", "torso", "stomach", "breast", "hip", "pelvis",
  "buttocks", "arms", "hands", "legs", "feet", "genitals", "asym",
];

/** Libellés affichés. Le nom de région est technique, pas montrable. */
export const LIBELLE_REGION: Record<string, string> = {
  head: "Tête", nose: "Nez", mouth: "Bouche", eyes: "Yeux", ears: "Oreilles",
  cheek: "Joues", chin: "Menton", forehead: "Front", eyebrows: "Sourcils",
  neck: "Cou", torso: "Torse", stomach: "Ventre", breast: "Poitrine",
  hip: "Hanches", pelvis: "Bassin", buttocks: "Fessiers", arms: "Bras",
  hands: "Mains", legs: "Jambes", feet: "Pieds", genitals: "Entrejambe",
  asym: "Asymétrie",
};

/**
 * Libellé d'un axe : `l-ear-lobe` → « Ear lobe ».
 *
 * On retire le côté (l'axe pilote les DEUX) et on remet des espaces. Traduire
 * chaque axe demanderait 199 entrées écrites à la main, qui se périmeraient au
 * premier pack modifié — on lisibilise plutôt le nom d'origine.
 */
export function libelleAxe(axe: string): string {
  const propre = axe.replace(/^[lr]-/, "").replace(/-/g, " ");
  return propre.charAt(0).toUpperCase() + propre.slice(1);
}

export interface EtatSliders {
  sliders: MorphSlider[];
  chargement: boolean;
  erreur: string | null;
}

/**
 * Curseurs des régions demandées.
 *
 * Passer un tableau VIDE ne charge rien — c'est ainsi que le panneau évite de
 * télécharger 23 packs avant que le joueur n'ouvre une section.
 */
export function useMorphSliders(regions: readonly MorphRegion[]): EtatSliders {
  const [sliders, setSliders] = useState<MorphSlider[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Clé de CONTENU : le tableau est reconstruit à chaque rendu par l'appelant,
  // dépendre de son identité relancerait le chargement en boucle.
  const cle = useMemo(() => [...regions].sort().join("|"), [regions]);

  useEffect(() => {
    if (!cle) { setSliders([]); setChargement(false); setErreur(null); return; }

    let vivant = true;
    setChargement(true);
    setErreur(null);
    // ⚠ VIDER AVANT DE CHARGER.
    // Sans ça, les curseurs de la région PRÉCÉDENTE restent affichés sous le
    // titre de la nouvelle le temps du téléchargement — observé en vrai : un
    // curseur « Stomach » listé sous « Oreilles ». L'utilisateur croit à un
    // mélange de données, alors que les packs sont sains.
    setSliders([]);

    const demandees = cle.split("|") as MorphRegion[];
    loadMorphRegions(demandees)
      .then((sets) => {
        if (!vivant) return;   // région changée entre-temps : résultat périmé
        const out: MorphSlider[] = [];
        sets.forEach((set, i) => {
          out.push(...construireSliders(demandees[i], [...set.morphs.keys()]));
        });
        setSliders(out);
        setChargement(false);
      })
      .catch((e: unknown) => {
        if (!vivant) return;
        setErreur(e instanceof Error ? e.message : String(e));
        setChargement(false);
      });

    return () => { vivant = false; };
  }, [cle]);

  return { sliders, chargement, erreur };
}
