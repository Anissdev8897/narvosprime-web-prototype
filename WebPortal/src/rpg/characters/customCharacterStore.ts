// characters/customCharacterStore.ts — PERSOS COMPOSÉS dans le Forge Personnages (persistés).
//
// Un perso custom = un CORPS (avatar existant : sorcier/meshy/own → réutilise tout le
// système d'anims) + des ATTACHEMENTS rigides (casque/cape/arme sur sockets) + teinte +
// échelle. Persisté (localStorage + base). Enregistré dans le roster → jouable + choisissable
// à la création de personnage.
import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";
import type { CharAttachment } from "./BoneAttachment";

import type { BodySlot } from "./modular/bodySlots";
import { migrateLegacyOutfit } from "./modular/bodySlots";

export interface CustomCharacter {
  id: string;           // slug unique (préfixé "cc_") — sert d'avatar id
  name: string;
  baseAvatar: string;   // avatar de base (corps + rig + anims) : "wraith" | folder meshy | own | "modular"
  attachments: CharAttachment[];
  tint: string;         // teinte tenue (#ffffff = inchangé)
  scaleMult: number;    // échelle globale
  updatedAt: number;
  /** v2 : équipement modulaire BikerBundle. Absent → v1 (migré par bridge.migrateCustomCharacter). */
  equipped?: Partial<Record<BodySlot, string>>;
  /** v3 : archétype et morphologie du corps de base (cf. modular/bodyArchetypes). */
  archetype?: string;
  build?: string;
  /**
   * Genre du corps de base. `undefined` = personnages d'avant la bascule.
   *
   * Le créateur lisait `DEFAULT_FORGE_CONFIG.gender`, codé en dur sur `"male"` :
   * le genre n'était donc JAMAIS persisté, et rouvrir un personnage féminin le
   * ramenait au catalogue masculin. Le stocker ici est ce qui rend la bascule
   * durable.
   */
  gender?: "male" | "female";
  /** Réglages fins de silhouette. Absent = morphologie d'origine. */
  proportions?: { shoulderWidth: number; waistHeight: number; armLength: number };
  /**
   * Teinte de PEAU — distincte de `tint`, qui colore la tenue. Les confondre
   * teindrait le blouson en même temps que le visage.
   */
  skinTint?: string;
  /** Couleur des iris — distincte de `skinTint`, même maillage, autre matériau. */
  eyeTint?: string;
  /**
   * Morphologie fine : position de chaque curseur, de -1 à +1.
   * Clé `<région>.<axe>`. Seuls les curseurs DÉPLACÉS sont stockés — un
   * personnage neutre n'occupe donc rien, et un axe retiré d'un pack disparaît
   * de lui-même. Absent = personnage d'avant les curseurs, corps neutre.
   */
  morphs?: Record<string, number>;
  /** Coiffure choisie — ID de `COIFFURES`, jamais un chemin. */
  hairId?: string;
  hairTint?: string;
}

const STORAGE_KEY = "narvos:custom_characters:v1";
const DB_KEY = "custom_characters";

/**
 * Remet une tenue sauvegardée dans la taxonomie courante.
 *
 * Avant la séparation anatomie/vêtements (02/08/2026), une veste était rangée
 * dans `torso`, un jean dans `legs`, des bottes dans `feet`. Ces emplacements
 * désignent désormais le buste, les jambes et les pieds NUS : sans conversion,
 * chaque personnage déjà créé verrait ses vêtements interprétés comme des
 * pièces d'anatomie et disparaîtrait sous le corps de base.
 */
function migrate(list: CustomCharacter[]): CustomCharacter[] {
  return list.map((c) =>
    c.equipped ? { ...c, equipped: migrateLegacyOutfit(c.equipped as Record<string, string | undefined>) } : c,
  );
}

function loadInitial(): CustomCharacter[] {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    return r ? migrate(JSON.parse(r)) : [];
  } catch { return []; }
}
let chars: CustomCharacter[] = loadInitial();
let version = 0;
const listeners = new Set<() => void>();
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chars)); } catch { /* quota */ }
  saveWorldDb(DB_KEY, chars);
}
function notify() { version++; for (const l of listeners) l(); }
const uid = () => "cc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const customCharacterStore = {
  list(): CustomCharacter[] { return chars; },
  get(id: string): CustomCharacter | undefined { return chars.find((c) => c.id === id); },

  create(name: string, baseAvatar: string): CustomCharacter {
    const c: CustomCharacter = { id: uid(), name: name.trim() || "Perso", baseAvatar, attachments: [], tint: "#ffffff", scaleMult: 1, updatedAt: Date.now() };
    chars = [...chars, c];
    persist(); notify();
    return c;
  },
  save(id: string, patch: Partial<Omit<CustomCharacter, "id">>): void {
    const i = chars.findIndex((c) => c.id === id);
    if (i < 0) return;
    chars = chars.slice();
    chars[i] = { ...chars[i], ...patch, updatedAt: Date.now() };
    persist(); notify();
  },
  remove(id: string): void { chars = chars.filter((c) => c.id !== id); persist(); notify(); },

  async hydrate(): Promise<void> {
    const db = await loadWorldDb<CustomCharacter[]>(DB_KEY);
    // Même migration qu'au chargement local : la base peut contenir des tenues
    // enregistrées avant la séparation des couches.
    if (db && Array.isArray(db)) { chars = migrate(db); notify(); }
  },

  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
  getVersion: () => version,
};

export function useCustomCharacters(): CustomCharacter[] {
  useSyncExternalStore(customCharacterStore.subscribe, customCharacterStore.getVersion, customCharacterStore.getVersion);
  return chars;
}

/** true si l'id désigne un perso custom (préfixe cc_). */
export function isCustomCharacter(id: string | undefined): boolean {
  return !!id && id.startsWith("cc_") && !!customCharacterStore.get(id);
}
