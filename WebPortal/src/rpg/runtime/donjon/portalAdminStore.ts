// runtime/donjon/portalAdminStore.ts — config de l'éditeur Donjon.
// La plupart des champs sont TRANSITOIRES (état d'édition de session : cible, placement,
// sélection, gizmo). SEUL `adminUnlock` est PERSISTÉ et PARTAGÉ (world_state MySQL) : quand
// un admin ouvre le donjon, il RESTE ouvert pour TOUS les utilisateurs (même après reload),
// jusqu'à ce qu'un admin le referme.
import type { LockMode } from "./portalStore";
import { loadWorldDb, saveWorldDb } from "../../persistence/dbStore";

const UNLOCK_STORAGE_KEY = "narvos:donjon_admin_unlock:v1";
const UNLOCK_DB_KEY = "donjon_admin_unlock";

function loadInitialUnlock(): boolean {
  try { return localStorage.getItem(UNLOCK_STORAGE_KEY) === "1"; } catch { return false; }
}

export interface PortalAdminConfig {
  /** mapId cible du prochain portail posé. */
  target: string;
  /** quête de déverrouillage du prochain portail ("" = aucune). */
  unlockQuest: string;
  lockMode: LockMode;
  /** Ouverture admin : force TOUS les portails ouverts. PERSISTÉ + PARTAGÉ (tous les
   *  utilisateurs, survit au reload) tant qu'un admin ne le referme pas. */
  adminUnlock: boolean;
  /** Mode placement actif → un clic dans la scène pose un portail. */
  placementActive: boolean;
  /** id du portail sélectionné pour le gizmo de transformation (null = aucun). */
  selectedId: string | null;
  /** mode du gizmo : déplacement (axes) ou rotation. */
  gizmoMode: "translate" | "rotate";
}

let cfg: PortalAdminConfig = {
  target: "donjon_furiste",
  unlockQuest: "acces_donjon_furiste",
  lockMode: "active",
  adminUnlock: loadInitialUnlock(), // restauré du cache local (puis écrasé par la base au hydrate)
  placementActive: false,
  selectedId: null,
  gizmoMode: "translate",
};
let version = 0;
const listeners = new Set<() => void>();
function notify() { version++; for (const fn of listeners) fn(); }

/** Persiste UNIQUEMENT l'état d'ouverture (partagé) — pas l'état d'édition transitoire. */
function persistUnlock(): void {
  try { localStorage.setItem(UNLOCK_STORAGE_KEY, cfg.adminUnlock ? "1" : "0"); } catch { /* quota */ }
  saveWorldDb(UNLOCK_DB_KEY, { adminUnlock: cfg.adminUnlock }); // → base (partagé, no-op hors Electron)
}

export const portalAdminStore = {
  get(): PortalAdminConfig { return cfg; },
  set(patch: Partial<PortalAdminConfig>): void {
    cfg = { ...cfg, ...patch };
    if (patch.adminUnlock !== undefined) persistUnlock(); // l'ouverture du donjon survit + se partage
    notify();
  },
  subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getVersion(): number { return version; },
  /** Charge l'état d'ouverture partagé depuis la base (À appeler une fois au boot). */
  async hydrate(): Promise<void> {
    const db = await loadWorldDb<{ adminUnlock: boolean }>(UNLOCK_DB_KEY);
    if (db && typeof db.adminUnlock === "boolean") {
      cfg = { ...cfg, adminUnlock: db.adminUnlock };
      // Aligne le cache local sur la VÉRITÉ base → au prochain démarrage à froid (avant que
      // hydrate réponde), loadInitialUnlock lit l'état partagé correct, pas une valeur périmée.
      try { localStorage.setItem(UNLOCK_STORAGE_KEY, db.adminUnlock ? "1" : "0"); } catch { /* quota */ }
      notify();
    }
  },
};
