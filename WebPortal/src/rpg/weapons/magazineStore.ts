// weapons/magazineStore.ts — système de CHARGEUR (magazine) par type d'arme.
//
// Gère le nombre de balles dans le chargeur actif, le rechargement temporisé,
// et les profils par type d'arme. Lié à ammoStore (réserve de munitions
// consommables) : le magazine est le chargeur en cours, la réserve est le stock.
// Le rechargement puise dans la réserve ; si stock = 0, le chargeur ne se remplit pas.
//
// Pattern singleton hors-React ; pont via useSyncExternalStore.
import { useSyncExternalStore } from "react";
import { ammoStore } from "../combat/ammoStore";

export interface MagazineProfile {
  maxMag: number;
  reloadMs: number;
}

const PROFILES: Record<string, MagazineProfile> = {
  pistol:  { maxMag: 12, reloadMs: 1800 },
  rifle:   { maxMag: 30, reloadMs: 2400 },
  shotgun: { maxMag: 6,  reloadMs: 3000 },
  sniper:  { maxMag: 5,  reloadMs: 3200 },
  smg:     { maxMag: 25, reloadMs: 1600 },
  default: { maxMag: 15, reloadMs: 2000 },
};

export interface MagazineState {
  current: number;
  max: number;
  reloadMs: number;
  isReloading: boolean;
}

let profile: MagazineProfile = PROFILES.default;
let state: MagazineState = { current: profile.maxMag, max: profile.maxMag, reloadMs: profile.reloadMs, isReloading: false };
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

export const magazineStore = {
  get: (): MagazineState => state,

  setWeaponType: (type: string): void => {
    profile = PROFILES[type] ?? PROFILES.default;
    if (reloadTimer) { clearTimeout(reloadTimer); reloadTimer = null; }
    state = { current: profile.maxMag, max: profile.maxMag, reloadMs: profile.reloadMs, isReloading: false };
    emit();
  },

  canFire: (): boolean => state.current > 0 && !state.isReloading,

  fire: (): boolean => {
    if (state.current <= 0 || state.isReloading) return false;
    state = { ...state, current: state.current - 1 };
    emit();
    return true;
  },

  /** Déclenche un rechargement temporisé. Vérifie la réserve :
   *  si stock = 0, ne fait rien (retourne false) pour éviter
   *  de remplir un chargeur à vide (P0 bug fix).
   *  Retourne true si le rechargement a démarré, false sinon. */
  reload: (): boolean => {
    if (state.isReloading || state.current >= state.max) return false;
    if (ammoStore.count("cells") <= 0) return false;

    state = { ...state, isReloading: true };
    emit();

    reloadTimer = setTimeout(() => {
      reloadTimer = null;

      // LE CHARGEUR PUISE DANS LA RÉSERVE — c'est ce que l'en-tête du fichier
      // annonce depuis toujours, et ce que le code ne faisait pas : il posait
      // `current = state.max` sans jamais débiter `ammoStore`. Le chargeur se
      // remplissait donc gratuitement, pendant que chaque tir débitait la
      // réserve en parallèle. Deux systèmes qui se contredisaient.
      //
      // Débit à la FIN et non au début : un rechargement annulé
      // (`cancelReload`) ne doit pas avoir consommé de munitions.
      const besoin = state.max - state.current;
      const dispo = Math.min(besoin, ammoStore.count("cells"));
      if (dispo > 0) ammoStore.consume("cells", dispo);

      state = { ...state, current: state.current + dispo, isReloading: false };
      emit();
    }, state.reloadMs);

    // Le rechargement a DÉMARRÉ. Ce `return` manquait : la fonction est typée
    // `: boolean`, sa JSDoc promet `true`, et elle renvoyait `undefined`. Côté
    // appelant, `if (!magazineStore.reload())` était donc toujours vrai —
    // l'interface affichait « plus de cellules en réserve ! » alors même que le
    // rechargement venait de se lancer.
    return true;
  },

  cancelReload: (): void => {
    if (!state.isReloading) return;
    if (reloadTimer) { clearTimeout(reloadTimer); reloadTimer = null; }
    state = { ...state, isReloading: false };
    emit();
  },

  subscribe: (l: () => void): (() => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useMagazine(): MagazineState {
  return useSyncExternalStore(magazineStore.subscribe, magazineStore.get, magazineStore.get);
}
