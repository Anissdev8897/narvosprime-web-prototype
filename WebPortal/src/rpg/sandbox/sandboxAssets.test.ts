// sandbox/sandboxAssets.test.ts — contrat d'assets du prototype sandbox.
//
// Le prototype ne pardonne pas les fausses pistes : un GLB déclaré mais absent
// du disque, ou une action de combat sans clip, et le personnage reste figé en
// idle (filet de sécurité d'AnimationController) SANS aucune erreur visible.
// Ces tests vérifient donc le manifeste CONTRE LE DISQUE, pas seulement sa
// cohérence interne.

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  SANDBOX_CHARACTER,
  SANDBOX_CLIP_JOBS,
  SANDBOX_CLIP_PATHS,
  SANDBOX_TARGET_HEIGHT,
} from "./sandboxAssets";
import { WRAITH_BASE } from "../characters/avatarAssets";

const PUBLIC_ROOT = join(process.cwd(), "public");
const surDisque = (urlPath: string) => existsSync(join(PUBLIC_ROOT, urlPath));

describe("sandboxAssets — personnage", () => {
  it("utilise Wraith (rig UE4 = cible exacte des clips)", () => {
    expect(SANDBOX_CHARACTER).toBe(WRAITH_BASE);
  });

  it("le GLB du personnage existe sur disque", () => {
    expect(surDisque(SANDBOX_CHARACTER)).toBe(true);
  });

  it("normalise à la même hauteur que le joueur en jeu (1,8 m)", () => {
    expect(SANDBOX_TARGET_HEIGHT).toBe(1.8);
  });
});

describe("sandboxAssets — jobs de clips", () => {
  it("couvre les actions indispensables du prototype de combat", () => {
    const actions = new Set(
      SANDBOX_CLIP_JOBS.map((j) => j.action).filter(Boolean),
    );
    // Sans idle : T-pose. Sans punch/hit : le futur prototype de combat
    // (ÉTAPE 2+) n'a rien à tester. Sans jump/fall : la traversée est muette.
    for (const action of [
      "idle",
      "punch1",
      "punch2",
      "punch3",
      "punch_charged",
      "kick",
      "hit",
      "jump",
      "fall",
    ]) {
      expect(actions.has(action), `action "${action}" sans clip`).toBe(true);
    }
  });

  it("embarque les capacités Wraith (clips déjà nommés Ability_*)", () => {
    const noms = SANDBOX_CLIP_JOBS.filter((j) => !j.action).map((j) =>
      j.path.split("/").pop() ?? "",
    );
    expect(noms.some((n) => n.startsWith("Ability_E"))).toBe(true);
    expect(noms.some((n) => n.startsWith("Ability_Q"))).toBe(true);
  });

  it("ne déclare aucune PAIRE (chemin, action) en double", () => {
    // Un même FICHIER peut servir deux actions (run/sprint sur Jog_Fwd, kick/
    // kick_charged sur attack_special_kick — choix assumés du catalogue). Ce
    // qui n'a pas de sens, c'est deux jobs identiques : même fichier, même nom.
    const cles = SANDBOX_CLIP_JOBS.map((j) => `${j.path}#${j.action ?? ""}`);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("ne télécharge chaque fichier qu'UNE fois (dédup par chemin)", () => {
    expect(SANDBOX_CLIP_PATHS.length).toBeLessThan(SANDBOX_CLIP_JOBS.length);
    expect(new Set(SANDBOX_CLIP_PATHS).size).toBe(SANDBOX_CLIP_PATHS.length);
    // Chaque job trouve son chemin dans la liste de fetch, dans le même ordre.
    const rang = new Map(SANDBOX_CLIP_PATHS.map((p, i) => [p, i]));
    const ordre = SANDBOX_CLIP_JOBS.map((j) => rang.get(j.path)!);
    expect(ordre).toEqual([...ordre].sort((a, b) => a - b));
  });

  it("reste dans une enveloppe raisonnable (≥ 40 fichiers, pas le pack entier)", () => {
    // Assemblage jeu ≈ 60 fichiers. Un effondrement (< 40) signalerait une
    // liste source vidée par erreur ; firstPerAction borne le haut (~43 → 7).
    expect(SANDBOX_CLIP_JOBS.length).toBeGreaterThanOrEqual(40);
  });

  it("chaque fichier déclaré EXISTE sur disque", () => {
    // C'est le test qui compte : le jeu tolère des absents (il a des
    // fallbacks), la sandbox non — elle est là pour révéler ces trous.
    const absents = SANDBOX_CLIP_JOBS.map((j) => j.path).filter(
      (p) => !surDisque(p),
    );
    expect(absents).toEqual([]);
  });
});
