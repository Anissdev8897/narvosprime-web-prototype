// ══════════════════════════════════════════════════════════════════════════════
// Proto_combat/combatClips.test.ts — Le manifeste, vérifié CONTRE LE DISQUE.
//
// Pourquoi ce test existe : un GLB déclaré mais absent ne produit AUCUNE erreur
// visible. `AnimationController` retombe sur son filet de sécurité, le
// personnage reste en idle, et on cherche le bug dans la machine à états —
// ce qui vient exactement d'arriver avec le GLB Meshy à un seul clip.
//
// Pire sous Vite : un chemin manquant renvoie du `text/html` en 200 (fallback
// SPA), pas un 404. `existsSync` est donc le seul contrôle qui dise la vérité.
// ══════════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  CHEMINS_UNIQUES,
  HAUTEUR_CIBLE,
  JOBS_ACTION,
  PERSONNAGE,
  TOUS_LES_JOBS,
} from "./combatClips";

const PUBLIC_ROOT = join(process.cwd(), "public");
const surDisque = (urlPath: string) => existsSync(join(PUBLIC_ROOT, urlPath));

describe("combatClips — personnage", () => {
  it("le GLB du personnage existe sur disque", () => {
    expect(surDisque(PERSONNAGE)).toBe(true);
  });

  it("normalise à la même hauteur que le joueur en jeu", () => {
    expect(HAUTEUR_CIBLE).toBe(1.8);
  });
});

describe("combatClips — couverture des actions", () => {
  it("couvre TOUTES les actions que la machine peut demander", () => {
    const actions = new Set(JOBS_ACTION.map((j) => j.action));
    // Cette liste EST le contrat entre la machine et la scène : chaque `anim`
    // qu'elle émet doit trouver un clip. Un manque ici = un coup invisible.
    for (const requise of [
      "idle",
      "punch1",
      "punch2",
      "punch3",
      "kick",
      "punch_charged",
      "block",
      "hit",
      "stun",
    ]) {
      expect(actions, `action manquante : ${requise}`).toContain(requise);
    }
  });

  it("alterne la latéralité du combo (droite → gauche → droite)", () => {
    const parAction = new Map(JOBS_ACTION.map((j) => [j.action, j.path]));
    expect(parAction.get("punch1")).toContain("Rhand");
    expect(parAction.get("punch2")).toContain("Lhand");
    expect(parAction.get("punch3")).toContain("Rhand");
  });
});

describe("combatClips — existence sur disque", () => {
  it("tous les fichiers d'action existent", () => {
    const manquants = JOBS_ACTION.filter((j) => !surDisque(j.path)).map((j) => j.path);
    expect(manquants).toEqual([]);
  });

  it("tous les fichiers du manifeste existent", () => {
    const manquants = CHEMINS_UNIQUES.filter((p) => !surDisque(p));
    expect(manquants).toEqual([]);
  });
});

describe("combatClips — ordre de résolution", () => {
  it("les jobs d'action passent AVANT les clips bruts", () => {
    // `resolveActions` retient le premier clip qui correspond. Un clip brut
    // nommé `attack_hook_Rhand_02` correspondrait aussi à `punch2` : s'il
    // passait devant, le mapping explicite (et sa latéralité) serait ignoré.
    const premierBrut = TOUS_LES_JOBS.findIndex((j) => j.action === undefined);
    const dernierAction = TOUS_LES_JOBS.map((j) => j.action !== undefined).lastIndexOf(true);
    expect(dernierAction).toBeLessThan(premierBrut);
  });

  it("aucun chemin n'est déclaré deux fois dans les jobs bruts", () => {
    const bruts = TOUS_LES_JOBS.filter((j) => j.action === undefined).map((j) => j.path);
    expect(bruts.length).toBe(new Set(bruts).size);
  });
});
