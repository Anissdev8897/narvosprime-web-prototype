// ══════════════════════════════════════════════════════════════════════════════
// professions/professionStore.ts — État runtime des métiers (singleton hors-React).
//
// Persistance PAR PERSONNAGE (localStorage), même patron que questStore → "prêt
// serveur" : l'état est sérialisable et passe par setCharacter(id) ; demain on
// remplace le load/save local par un appel réseau sans toucher au gameplay.
//
// Contenu : niveau + XP par métier (1→50) + UNE jauge d'endurance partagée
// (récolte). useSyncExternalStore : getVersion() bump à chaque mutation.
// ══════════════════════════════════════════════════════════════════════════════

import { MAX_PROFESSION_LEVEL, xpForLevel, type ProfessionId } from "./professionTypes";
import { PROFESSION_IDS } from "./professionCatalog";
import { loadCharacterDb, saveCharacterDb } from "../persistence/dbStore";

/** Clé d'état en base (table character_state). */
const DB_KEY = "professions";

export interface ProfProgress { level: number; xp: number; } // xp = progression DANS le niveau courant

export interface ProfessionState {
  profs: Record<ProfessionId, ProfProgress>;
  stamina: number;
  /** Sac de ressources métier : itemId → quantité (économie / artisanat). */
  resources: Record<string, number>;
}

export const STAMINA_MAX = 100;
const STAMINA_REGEN_PER_SEC = 6;

function freshState(): ProfessionState {
  const profs = {} as Record<ProfessionId, ProfProgress>;
  for (const id of PROFESSION_IDS) profs[id] = { level: 1, xp: 0 };
  return { profs, stamina: STAMINA_MAX, resources: {} };
}

const keyOf = (charId: string) => `narvos:professions:${charId}`;

/** Fusion défensive d'un état (partiel) sauvegardé → état complet valide. */
function fromPartial(p: Partial<ProfessionState> | null | undefined): ProfessionState {
  const base = freshState();
  if (!p || typeof p !== "object") return base;
  for (const id of PROFESSION_IDS) {
    const saved = p.profs?.[id];
    if (saved && typeof saved.level === "number" && typeof saved.xp === "number") {
      base.profs[id] = { level: Math.min(MAX_PROFESSION_LEVEL, Math.max(1, saved.level)), xp: Math.max(0, saved.xp) };
    }
  }
  if (typeof p.stamina === "number") base.stamina = Math.min(STAMINA_MAX, Math.max(0, p.stamina));
  if (p.resources && typeof p.resources === "object") {
    for (const [k, v] of Object.entries(p.resources)) if (typeof v === "number" && v > 0) base.resources[k] = v;
  }
  return base;
}

function load(charId: string): ProfessionState {
  if (!charId) return freshState();
  try { const raw = localStorage.getItem(keyOf(charId)); return fromPartial(raw ? JSON.parse(raw) : null); }
  catch { return freshState(); }
}

class ProfessionStore {
  private charId = "";
  private state: ProfessionState = freshState();
  private version = 0;
  private listeners = new Set<() => void>();

  /** À appeler au boot du gameworld (comme questStore.setCharacter). */
  setCharacter(charId: string): void {
    this.charId = charId;
    this.state = load(charId);   // localStorage : affichage instantané
    this.bump();
    // Hydratation depuis la BASE (source de vérité en Electron) si une sauvegarde existe.
    if (charId) {
      loadCharacterDb<Partial<ProfessionState>>(charId, DB_KEY).then((db) => {
        if (db && this.charId === charId) { this.state = fromPartial(db); this.bump(); }
      });
    }
  }

  get(): ProfessionState { return this.state; }
  getVersion = (): number => this.version;
  level(id: ProfessionId): number { return this.state.profs[id]?.level ?? 1; }
  xp(id: ProfessionId): number { return this.state.profs[id]?.xp ?? 0; }
  stamina(): number { return this.state.stamina; }

  /**
   * Octroie de l'XP à un métier. Gère les montées de niveau en cascade (clamp 50).
   * Retourne le nombre de niveaux gagnés (0 si aucun).
   */
  addXp(id: ProfessionId, amount: number): number {
    if (amount <= 0) return 0;
    const p = { ...this.state.profs[id] };
    let gained = 0;
    p.xp += amount;
    while (p.level < MAX_PROFESSION_LEVEL && p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level += 1;
      gained += 1;
    }
    if (p.level >= MAX_PROFESSION_LEVEL) p.xp = 0;
    this.state = { ...this.state, profs: { ...this.state.profs, [id]: p } };
    this.persist(); this.bump();
    return gained;
  }

  /** Tente de dépenser de l'endurance. false si insuffisante. */
  spendStamina(n: number): boolean {
    if (this.state.stamina < n) return false;
    this.state = { ...this.state, stamina: this.state.stamina - n };
    this.persist(); this.bump();
    return true;
  }

  /** Régénère l'endurance (appelé en boucle avec un dt en secondes). */
  regen(dt: number): void {
    if (this.state.stamina >= STAMINA_MAX) return;
    const next = Math.min(STAMINA_MAX, this.state.stamina + STAMINA_REGEN_PER_SEC * dt);
    this.state = { ...this.state, stamina: next };
    this.bump(); // pas de persist à chaque tick — sauvé à la prochaine dépense/XP
  }

  /** Restaure de l'endurance (nourriture / potion). */
  restoreStamina(n: number): void {
    this.state = { ...this.state, stamina: Math.min(STAMINA_MAX, this.state.stamina + n) };
    this.persist(); this.bump();
  }

  /** Ajoute une ressource récoltée au sac métier. */
  addResource(itemId: string, qty: number): void {
    if (qty <= 0) return;
    const resources = { ...this.state.resources, [itemId]: (this.state.resources[itemId] ?? 0) + qty };
    this.state = { ...this.state, resources };
    this.persist(); this.bump();
  }
  getResources(): Record<string, number> { return this.state.resources; }
  resource(itemId: string): number { return this.state.resources[itemId] ?? 0; }

  /** Vérifie que le sac contient tous les ingrédients d'une recette. */
  hasResources(inputs: { itemId: string; qty: number }[]): boolean {
    return inputs.every((i) => (this.state.resources[i.itemId] ?? 0) >= i.qty);
  }

  /**
   * Fabrique une recette : consomme les ingrédients (du sac), octroie l'XP métier
   * (× xpMult), et RETOURNE l'objet produit pour qu'il aille dans l'inventaire
   * principal (équipable / consommable / vendable). Atomique : rien n'est consommé
   * si niveau/ressources insuffisants.
   */
  craft(
    recipe: { profession: ProfessionId; minLevel: number; baseXp: number;
      inputs: { itemId: string; qty: number }[]; output: { itemId: string; qty: number } },
    bonusQty = 0,
    xpMult = 1,
  ): { ok: boolean; levels: number; output?: { itemId: string; qty: number } } {
    if (this.level(recipe.profession) < recipe.minLevel) return { ok: false, levels: 0 };
    if (!this.hasResources(recipe.inputs)) return { ok: false, levels: 0 };
    const resources = { ...this.state.resources };
    for (const i of recipe.inputs) resources[i.itemId] = (resources[i.itemId] ?? 0) - i.qty;
    this.state = { ...this.state, resources };
    this.persist(); this.bump();
    const levels = this.addXp(recipe.profession, Math.max(1, Math.round(recipe.baseXp * xpMult)));
    return { ok: true, levels, output: { itemId: recipe.output.itemId, qty: recipe.output.qty + bonusQty } };
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  private persist(): void {
    if (!this.charId) return;
    try { localStorage.setItem(keyOf(this.charId), JSON.stringify(this.state)); }
    catch { /* quota / privé */ }
    saveCharacterDb(this.charId, DB_KEY, this.state); // → base (débouncé, no-op hors Electron)
  }
  private bump(): void { this.version++; for (const fn of this.listeners) fn(); }
}

export const professionStore = new ProfessionStore();
