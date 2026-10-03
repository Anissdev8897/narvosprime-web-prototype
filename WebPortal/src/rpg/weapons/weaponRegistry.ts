// weapons/weaponRegistry.ts — singleton (hors React) + builder pur testable
//
// Deux sources fusionnées :
//   1. catalogProfiles()  → TOUTES les armes du dossier weapon/ (auto-classifiées).
//   2. weaponProfiles.json → profils réglés à la main (arch_*, staffs…) PRIORITAIRES.
// Les profils JSON écrasent les profils catalogue de même id (réglage manuel gagne).
import profilesJson from "./weaponProfiles.json";
import { catalogProfiles } from "./weaponCatalog";
import type { WeaponProfile } from "./weaponTypes";

function isValid(p: unknown): boolean {
  const o = p as Record<string, unknown> | null;
  return !!o && typeof o.id === "string" && typeof o.path === "string"
    && typeof o.socket === "string" && !!o.offset && typeof o.offset === "object";
}

/** Construit le registre : valide, normalise les défauts, ignore (warn) le malformé. */
export function buildRegistry(json: Record<string, unknown>): Record<string, WeaponProfile> {
  const out: Record<string, WeaponProfile> = {};
  for (const [id, raw] of Object.entries(json)) {
    if (!isValid(raw)) { console.warn(`[weaponRegistry] profil ignoré (malformé) : ${id}`); continue; }
    out[id] = { grip: "one_hand", visibility: "always", ...(raw as WeaponProfile) };
  }
  return out;
}

// Base = catalogue auto-généré ; les profils JSON réglés à la main passent par-dessus.
const REGISTRY: Record<string, WeaponProfile> = {
  ...Object.fromEntries(catalogProfiles().map((p) => [p.id, p])),
  ...buildRegistry(profilesJson as Record<string, unknown>),
};

export const weaponRegistry = {
  get(id: string | undefined): WeaponProfile | undefined { return id ? REGISTRY[id] : undefined; },
  has(id: string): boolean { return id in REGISTRY; },
  all(): WeaponProfile[] { return Object.values(REGISTRY); },
};
