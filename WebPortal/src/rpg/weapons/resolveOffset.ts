// weapons/resolveOffset.ts — fusion déterministe : override famille → base → identité
import type { RigFamily, WeaponProfile } from "./weaponTypes";

export interface ResolvedOffset {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export function resolveOffset(p: WeaponProfile, family: RigFamily): ResolvedOffset {
  const o  = p.offset ?? {};
  const ov = p.offsets?.[family] ?? {};
  return {
    position: ov.position ?? o.position ?? [0, 0, 0],
    rotation: ov.rotation ?? o.rotation ?? [0, 0, 0],
    scale:    ov.scale    ?? o.scale    ?? 1,
  };
}
