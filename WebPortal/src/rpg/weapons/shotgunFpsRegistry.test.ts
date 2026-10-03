import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  SHOTGUN_FPS_REGISTRY, FPS_ARMS_MESH, getShotgunFps, getWeaponFps,
  type ShotgunFpsAnimSet,
} from "./shotgunFpsRegistry";
import { WEAPON_CATALOG } from "./weaponCatalog";

const PUBLIC = path.resolve(__dirname, "../../../public");
const surDisque = (url: string) => fs.existsSync(path.join(PUBLIC, url.replace(/^\//, "")));
const clips = (s: ShotgunFpsAnimSet) => Object.values(s).filter(Boolean) as string[];

describe("registre d'animations FPS", () => {
  it("CHAQUE chemin existe réellement sur le disque", () => {
    // LE test de ce fichier. Le fallback SPA de Vite renvoie du text/html en
    // 200 pour un fichier absent : un chemin faux ne lève rien, l'animation
    // ne joue simplement jamais. Aucune autre barrière ne l'attraperait.
    const manquants: string[] = [];
    for (const e of SHOTGUN_FPS_REGISTRY) {
      if (!surDisque(e.weaponPath)) manquants.push(`${e.label} · mesh → ${e.weaponPath}`);
      for (const u of clips(e.weapon)) if (!surDisque(u)) manquants.push(`${e.label} · arme → ${u}`);
      for (const u of clips(e.arms))   if (!surDisque(u)) manquants.push(`${e.label} · bras → ${u}`);
    }
    if (!surDisque(FPS_ARMS_MESH)) manquants.push(`mesh de bras FPS → ${FPS_ARMS_MESH}`);
    expect(manquants, `chemins absents :\n${manquants.join("\n")}`).toEqual([]);
  });

  it("toute arme du registre est équipable via le catalogue", () => {
    // Une entrée d'animation pour une arme qu'on ne peut pas équiper est du
    // code mort : l'animation ne serait jamais atteinte.
    const equipables = new Set(WEAPON_CATALOG.map((w) => w.path));
    const orphelines = SHOTGUN_FPS_REGISTRY
      .filter((e) => !equipables.has(e.weaponPath))
      .map((e) => `${e.label} → ${e.weaponPath}`);
    expect(orphelines, `armes animées mais non équipables :\n${orphelines.join("\n")}`).toEqual([]);
  });

  it("le minimum de combat est présent partout : repos, tir, rechargement", () => {
    for (const e of SHOTGUN_FPS_REGISTRY) {
      expect(e.weapon.idleHip, `${e.label} idle`).toBeTruthy();
      expect(e.weapon.hipFire, `${e.label} tir`).toBeTruthy();
      expect(e.weapon.reload, `${e.label} rechargement`).toBeTruthy();
    }
  });

  it("aucun doublon de chemin d'arme", () => {
    const p = SHOTGUN_FPS_REGISTRY.map((e) => e.weaponPath);
    expect(p.length).toBe(new Set(p).size);
  });

  it("le revolver est couvert", () => {
    const rev = SHOTGUN_FPS_REGISTRY.filter((e) => /Revolver/i.test(e.label));
    expect(rev.length, "les deux variantes de mesh doivent être servies").toBe(2);
    for (const e of rev) expect(e.weapon.hipFire).toMatch(/Revolver_Fire/);
  });

  it("getShotgunFps résout, et getWeaponFps est le même point d'entrée", () => {
    const p = SHOTGUN_FPS_REGISTRY[0].weaponPath;
    expect(getShotgunFps(p)).toBeDefined();
    expect(getWeaponFps(p)).toBe(getShotgunFps(p));
    expect(getShotgunFps("/models/armes/inexistant.glb")).toBeUndefined();
  });
});
