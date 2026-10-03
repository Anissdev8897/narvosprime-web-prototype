/**
 * character/index.ts — Module de sélection / création de personnage (Quaternius).
 *
 * Migration Task #9 :
 *   - HeroPreview3D (Meshy) remplacé par ClassPreview3D (Quaternius)
 *   - heroes-catalog / HeroDef remplacés par CLASSES RPG + ELEMENTS
 *   - useCharacterStorage : CreateCharacterParams utilise classId + gender
 *
 * Fichiers legacy conservés sur disque mais NON ré-exportés :
 *   - HeroPreview3D.tsx  (peut être supprimé)
 *   - heroes-catalog.ts  (peut être supprimé)
 */

export { ClassPreview3D }          from "./ClassPreview3D";
export { CharacterSelectScreen }   from "./CharacterSelectScreen";
export { CharacterCreateScreen }   from "./CharacterCreateScreen";
export { useCharacterStorage }     from "./useCharacterStorage";
export type { CreateCharacterParams } from "./useCharacterStorage";
