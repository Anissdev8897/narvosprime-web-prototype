// ambient/ambientAnimals.ts — Catalogue des ANIMAUX AMBIANTS (décor vivant).
//
// Animaux non agressifs qui peuplent les maps : ils errent ou broutent, jouent
// leurs anims passives, et n'ont AUCUN rôle de combat (pas de PV, pas de cible,
// pas enregistrés dans npcRegistry). But : rendre les zones vivantes.
//
// Échelle normalisée par bounding-box (targetSize, m) → robuste à l'échelle source.

export interface AmbientAnimalDef {
  id: string;
  label: string;
  path: string;
  /** Hauteur cible (m) — normalisation par bbox. */
  targetSize: number;
  /** Peut se déplacer (idle ↔ marche vers un point proche). false = reste sur place. */
  wander: boolean;
  /** Animal volant (papillon) : flotte/dérive en hauteur, anim "fly". */
  flying?: boolean;
  /**
   * Clips en FICHIERS SÉPARÉS (convention UE : maillage et animations exportés
   * à part, ex. GoatWithGroom). Le clip est pris dans le 1er GLB indiqué.
   * Le squelette doit être celui du maillage — packs de même origine uniquement.
   */
  idleClipPath?: string;
  walkClipPath?: string;
  /**
   * Nom EXACT du clip, quand la recherche par mot-clé échoue — typiquement un
   * export Mixamo dont le clip s'appelle "Armature|Armature|…|mixamo.com|Layer0".
   */
  idleClipName?: string;
  walkClipName?: string;
}

const PET = "/models/pet";
const CRE = "/models/creatures";

export const AMBIENT_ANIMALS: Record<string, AmbientAnimalDef> = {
  cow:       { id: "cow",       label: "Vache",     path: `${PET}/Cow.glb`,       targetSize: 1.7, wander: true },
  dog:       { id: "dog",       label: "Chien",     path: `${PET}/dog.glb`,       targetSize: 0.7, wander: true },
  girafe:    { id: "girafe",    label: "Girafe",    path: `${PET}/girafe.glb`,    targetSize: 4.5, wander: false },
  butterfly: { id: "butterfly", label: "Papillon",  path: `${PET}/butterfly.glb`, targetSize: 0.3, wander: true, flying: true },

  // ── Remplacent chat / poule / coccinelle ──────────────────────────────────
  // Ces trois GLB ne contenaient AUCUN clip d'animation (vérifié en lisant les
  // fichiers) : ils s'affichaient en maillages figés. Remplacés par des assets
  // réellement animés. Note : les packs AnimalsVol01 (ours, loup, renard…) et
  // VOL2_Birds sont eux aussi dépourvus d'animations — inutilisables ici.
  lion:      { id: "lion",      label: "Lion",      path: `${PET}/lion/PSX_lion.glb`, targetSize: 1.2, wander: true },
  // ⚠ PAS de `GoatWithGroom/` dans le chemin. Le pack a été décompressé À PLAT
  // dans `creatures/`, ses dossiers `Characters/` et `Animations/` se retrouvant
  // à la racine de la catégorie. Le chemin d'origine renvoyait donc du HTML
  // (fallback SPA de Vite, 200 au lieu de 404) et la chèvre ne chargeait pas —
  // sans erreur visible. Vérifié sur disque le 2026-09-03.
  goat:      { id: "goat",      label: "Chèvre",    path: `${CRE}/Characters/Mesh_GoatLowPoly.glb`,
               targetSize: 0.9, wander: true,
               idleClipPath: `${CRE}/Animations/Anim_GoatIdle.glb`,
               walkClipPath: `${CRE}/Animations/Anim_GoatWalkForward.glb` },
  horse:     { id: "horse",     label: "Cheval",    path: `${PET}/mobtribunindin/horse.glb`, targetSize: 2.2, wander: true,
               idleClipName: "Armature|Armature|Armature.001|mixamo.com|Layer0" },
};

export function getAmbientAnimal(id: string): AmbientAnimalDef | undefined {
  return AMBIENT_ANIMALS[id];
}
