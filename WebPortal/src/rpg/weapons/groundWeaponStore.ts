// ══════════════════════════════════════════════════════════════════════════════
// weapons/groundWeaponStore.ts — Armes POSÉES AU SOL, ramassables.
//
// Singleton hors-React (comme `collisionWorld`, `npcRegistry`, `equippedWeaponStore`),
// ponté vers React par `useSyncExternalStore` : le monde 3D lit la liste dans sa
// boucle de rendu, l'UI doit réagir au ramassage.
//
// CE QUE CE MODULE FAIT — et surtout CE QU'IL NE FAIT PAS :
//   • il tient la liste des armes au sol, par map ;
//   • il répond à « quelle arme est à portée du joueur ? » ;
//   • il RETIRE l'arme du sol au ramassage.
// Il ne touche NI à l'inventaire, NI à l'équipement, NI aux animations. Le
// ramassage complet est une séquence (animation → retrait → inventaire →
// équipement) qui appartient au composant : mêler les quatre ici rendrait la
// logique intestable sans un contexte 3D.
//
// Persisté par map : une arme jetée dans la Forge doit encore y être au retour.
// ══════════════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";

export interface GroundWeapon {
  /** Identifiant unique de CETTE instance posée — pas du type d'arme. */
  id: string;
  /** Chemin GLB, tel que le catalogue le déclare. */
  weaponPath: string;
  /** Nom lisible, affiché dans l'invite « Ramasser … ». */
  label: string;
  pos: [number, number, number];
  rot: [number, number, number];
}

/** Portée de ramassage, en mètres. Généreuse : viser un objet au sol est ingrat. */
export const PICKUP_RANGE = 2.5;

const STORAGE_KEY = "narvos.groundWeapons";

/** `mapId` → armes au sol. Une map absente n'a simplement rien au sol. */
let parMap: Record<string, GroundWeapon[]> = {};
let version = 0;
const listeners = new Set<() => void>();

function notify(): void {
  version++;
  for (const l of listeners) l();
}

function persist(): void {
  // Les tests tournent en environnement `node` sans DOM (cf. vitest.config.ts).
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(parMap)); } catch { /* quota */ }
}

/**
 * Valide une entrée venue du disque.
 *
 * Le stockage local survit aux mises à jour : une arme dont le GLB a été
 * renommé y resterait indéfiniment et produirait un mesh vide au sol — le
 * fallback SPA de Vite rend du `text/html` en 200, donc rien ne lèverait.
 * On ne peut pas vérifier l'existence du fichier ici (pas d'accès disque), mais
 * on peut au moins rejeter ce qui n'a pas la bonne FORME.
 */
function sain(w: unknown): w is GroundWeapon {
  if (!w || typeof w !== "object") return false;
  const g = w as Partial<GroundWeapon>;
  const triplet = (v: unknown): v is [number, number, number] =>
    Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));
  return typeof g.id === "string" && g.id.length > 0
    && typeof g.weaponPath === "string" && g.weaponPath.startsWith("/")
    && typeof g.label === "string"
    && triplet(g.pos) && triplet(g.rot);
}

export const groundWeaponStore = {
  /** Armes au sol de cette map. Tableau VIDE si aucune — jamais `undefined`. */
  list(mapId: string): GroundWeapon[] {
    return parMap[mapId] ?? [];
  },

  /** Pose une arme au sol. Retourne l'entrée créée. */
  drop(mapId: string, w: Omit<GroundWeapon, "id"> & { id?: string }): GroundWeapon {
    // L'id est propre à l'INSTANCE : deux fusils identiques au sol doivent
    // pouvoir être ramassés séparément.
    const entree: GroundWeapon = { ...w, id: w.id ?? `gw_${mapId}_${version}_${(parMap[mapId] ?? []).length}` };
    parMap = { ...parMap, [mapId]: [...(parMap[mapId] ?? []), entree] };
    persist();
    notify();
    return entree;
  },

  /** Retire une arme du sol. Retourne l'entrée retirée, ou `null` si absente. */
  take(mapId: string, id: string): GroundWeapon | null {
    const liste = parMap[mapId];
    if (!liste) return null;
    const w = liste.find((x) => x.id === id);
    if (!w) return null;
    parMap = { ...parMap, [mapId]: liste.filter((x) => x.id !== id) };
    persist();
    notify();
    return w;
  },

  /**
   * Arme la PLUS PROCHE du point donné, dans la portée. `null` sinon.
   *
   * Distance en 3D et non horizontale : une arme sur une passerelle au-dessus
   * du joueur ne doit pas être ramassable depuis le sol.
   */
  nearest(mapId: string, x: number, y: number, z: number, range = PICKUP_RANGE): GroundWeapon | null {
    let best: GroundWeapon | null = null;
    let bestD2 = range * range;
    for (const w of parMap[mapId] ?? []) {
      const dx = w.pos[0] - x, dy = w.pos[1] - y, dz = w.pos[2] - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= bestD2) { bestD2 = d2; best = w; }
    }
    return best;
  },

  /** Vide une map (changement de zone, réinitialisation d'éditeur). */
  clear(mapId: string): void {
    if (!parMap[mapId]?.length) return;
    parMap = { ...parMap, [mapId]: [] };
    persist();
    notify();
  },

  /** Recharge depuis le stockage local. Idempotent. */
  hydrate(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const brut = localStorage.getItem(STORAGE_KEY);
      if (!brut) return;
      const lu = JSON.parse(brut) as Record<string, unknown[]>;
      const propre: Record<string, GroundWeapon[]> = {};
      for (const [mapId, liste] of Object.entries(lu)) {
        if (Array.isArray(liste)) propre[mapId] = liste.filter(sain);
      }
      parMap = propre;
      notify();
    } catch { parMap = {}; }
  },

  getVersion(): number { return version; },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /** Réservé aux TESTS — repart d'un état vide. */
  __resetForTest(): void { parMap = {}; version = 0; },
};

/** Pont React. Re-rend quand une arme est posée ou ramassée. */
export function useGroundWeapons(mapId: string): GroundWeapon[] {
  useSyncExternalStore(
    groundWeaponStore.subscribe,
    groundWeaponStore.getVersion,
    groundWeaponStore.getVersion,
  );
  return groundWeaponStore.list(mapId);
}
