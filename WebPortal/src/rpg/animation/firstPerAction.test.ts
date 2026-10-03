// firstPerAction.test.ts — sélection de la variante de clip par action.
//
// Le catalogue déclare plusieurs variantes par action (12 pour `punch1`). Une
// seule est chargée, car `renameClip` leur donnerait de toute façon le même nom.
// LAQUELLE est retenue décide donc de la latéralité du combo — et c'était le
// premier fichier déclaré, sans égard pour la préférence de CLIP_CANDIDATES.

import { describe, it, expect } from "vitest";
import { firstPerAction, UNARMED_PACK } from "./animationPacks";
import { CLIP_CANDIDATES } from "./AnimationController";

const nomFichier = (p: string) => p.split("/").pop()!.replace(/\.glb$/i, "");

describe("firstPerAction", () => {
  it("ne garde qu'une seule variante par action", () => {
    const retenus = firstPerAction(UNARMED_PACK);
    const actions = retenus.map((s) => s.action);
    expect(new Set(actions).size).toBe(actions.length);
  });

  it("couvre TOUTES les actions déclarées par le catalogue", () => {
    const attendues = new Set(UNARMED_PACK.map((s) => s.action));
    const obtenues = new Set(firstPerAction(UNARMED_PACK).map((s) => s.action));
    expect(obtenues).toEqual(attendues);
  });

  it("respecte la préférence de CLIP_CANDIDATES quand le fichier existe", () => {
    // `punch2` demande une main GAUCHE en tête (`attack_hook_Lhand_01`) alors
    // que le catalogue déclare les variantes main DROITE en premier. Sans la
    // préférence, l'alternance gauche/droite du combo n'existe pas.
    const punch2 = firstPerAction(UNARMED_PACK).find((s) => s.action === "punch2");
    expect(punch2).toBeDefined();
    expect(nomFichier(punch2!.path)).toBe(CLIP_CANDIDATES.punch2[0]);
    expect(punch2!.path).toMatch(/Lhand/);
  });

  it("garde la main DROITE là où CLIP_CANDIDATES la demande", () => {
    const punch1 = firstPerAction(UNARMED_PACK).find((s) => s.action === "punch1");
    expect(nomFichier(punch1!.path)).toBe(CLIP_CANDIDATES.punch1[0]);
    expect(punch1!.path).toMatch(/Rhand/);
  });

  it("retombe sur la première variante quand aucune ne correspond", () => {
    const pack = [
      { action: "punch1" as const, path: "/a/inconnu_01.glb" },
      { action: "punch1" as const, path: "/a/inconnu_02.glb" },
    ];
    expect(firstPerAction(pack)).toEqual([pack[0]]);
  });

  it("préserve l'ordre du catalogue (indices strictement croissants)", () => {
    // On compare la position des SPECS RETENUES, pas celle de la première
    // déclaration de leur action : la variante choisie peut être plus loin dans
    // le tableau (c'est le cas de `punch2`, dont la main gauche est déclarée
    // après les six variantes main droite).
    const retenus = firstPerAction(UNARMED_PACK);
    const indices = retenus.map((s) => UNARMED_PACK.indexOf(s));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(indices.every((i) => i >= 0)).toBe(true);
  });
});
