// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/hairCatalog.ts — Coiffures posables sur le mannequin nu.
//
// ── POURQUOI UNE LISTE ÉCRITE ET PAS UN FILTRE SUR `region === "hair"` ───────
//
// Le découpeur classe par OS DOMINANT, pas par intention. Il range donc en
// « hair » tout ce qui est pondéré sur `head` — y compris `bk_m_beard`, qui est
// une BARBE. Un filtre automatique proposerait donc une barbe dans la liste des
// coupes de cheveux.
//
// Casques, bandanas et chapeaux ne sont PAS dans cette région (le découpeur les
// a classés ailleurs), mais on ne s'appuie pas sur cette chance : la liste est
// explicite, donc un pack ajouté demain n'entre pas ici tout seul.
//
// ── COMPATIBILITÉ MESURÉE (2026-08-10) ──────────────────────────────────────
//
// Corps morphable = 89 os Manny. Os communs par coiffure :
//
//   bk_f_hair        10 / 10   ✓ toutes ses influences existent
//   cs_hair          68 / 68   ✓
//   samurai          68 / 68   ✓
//   bk_m_hair_wild   89 / 161  tout Manny + 72 correctifs Biker
//   bk_m_hair        80 / 150
//   boris            71 / 168
//
// Les os NON appariés sont des correctifs d'AVANT-BRAS du rig Biker
// (`lowerarm_correctiveRoot_l`, `lowerarm_in_l`…). Sur un maillage de cheveux
// ils portent zéro poids : la chevelure est pondérée sur `head`, que le corps
// possède. `rebindSkinnedMesh` les écarte sans conséquence — et c'est LUI qui
// tranche, via sa couverture PAR POIDS, pas ce catalogue.
// ══════════════════════════════════════════════════════════════════════════════

export interface Coiffure {
  id: string;
  label: string;
  path: string;
  /** Indicatif pour l'UI. Le verdict réel vient de `rebindSkinnedMesh`. */
  genre?: "male" | "female";
}

const P = "/models/personnages/_parts";

/**
 * Coiffures RÉELLES, à l'exclusion des barbes et de tout couvre-chef.
 *
 * `bk_m_beard` est délibérément absent : c'est une barbe, elle a sa place dans
 * l'emplacement `beard`, pas dans un sélecteur de coupe.
 */
export const COIFFURES: readonly Coiffure[] = [
  { id: "bk_f_hair",      label: "Longs",        path: `${P}/bk_f_hair/hair.glb`,      genre: "female" },
  { id: "bk_m_hair",      label: "Courts",       path: `${P}/bk_m_hair/hair.glb`,      genre: "male" },
  { id: "bk_m_hair_wild", label: "Ébouriffés",   path: `${P}/bk_m_hair_wild/hair.glb`, genre: "male" },
  { id: "cs_hair",        label: "Militaires",   path: `${P}/cs_hair/hair.glb` },
  { id: "samurai",        label: "Chignon",      path: `${P}/samurai/hair.glb` },
  { id: "boris",          label: "Broussailleux", path: `${P}/boris/hair.glb` },
];

export function coiffureById(id: string | undefined): Coiffure | undefined {
  return id ? COIFFURES.find((c) => c.id === id) : undefined;
}
