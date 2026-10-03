// partCatalog.test.ts — fusion du pack Biker et des pièces héros découpées.
//
// Ce que ces tests protègent : l'éditeur modulaire promet « toutes les têtes
// dans une même liste ». Une régression silencieuse serait un catalogue qui
// re-partitionne par genre ou par pack et n'affiche plus que la moitié des
// pièces — visible seulement en ouvrant l'UI.

import { describe, it, expect } from "vitest";
import {
  MODULAR_PARTS, partsFor, partsForSlot, availableSlots, allAvailableSlots, getPart,
} from "./partCatalog";
import { HERO_PARTS, HERO_SOURCES } from "./heroParts";
import { SLOT_ORDER } from "./bodySlots";

describe("heroParts — traduction du manifest", () => {
  it("expose les six héros découpés", () => {
    expect(HERO_SOURCES.map((s) => s.id)).toEqual(
      expect.arrayContaining(["wraith", "murdock", "boris", "steel", "echo", "samurai"]),
    );
  });

  it("chaque héros fournit une tête — l'exemple d'ouverture du cahier des charges", () => {
    // « remplacer la tête d'un Wraith par la tête d'un autre modèle »
    for (const s of HERO_SOURCES) {
      const pieces = HERO_PARTS.filter((p) => p.source === s.id);
      // Une source 100 % « author » n'est PAS un corps : c'est un vêtement
      // livré déjà séparé (jean, gilet, holster nuc_*). Exiger d'elle une
      // tête n'a pas de sens — l'exigence vaut pour les corps découpés.
      if (pieces.length > 0 && pieces.every((p) => p.cut === "author")) continue;
      // Découpe volontairement PARTIELLE (onlyRegions : un blouson n'est
      // catalogué que torse+bras). Exiger une tête d'un vêtement n'a pas de
      // sens — l'exigence vaut pour les corps, partiels ou non.
      if (s.partial) continue;
      const tetes = pieces.filter((p) => p.slot === "head");
      if (tetes.length > 0) continue;
      // Corps SANS tête livré en fichiers séparés (Lot B : ZombieSoldierPack,
      // SciFi_Trooper_Set) — le personnage est alors découpé en plusieurs
      // sources `<tige>_body` + `<tige>_head…`. L'exigence « une tête » vaut
      // pour le PERSONNAGE, pas pour le fichier : la tête peut vivre dans la
      // source sœur. Sans suffixe `_body`/`_form`, pas de dérogation —
      // `biker_m` ne peut pas se couvrir avec la tête de `biker_f`.
      const tige = s.id.replace(/_(body|form)$/, "");
      const teteSoeur =
        tige !== s.id &&
        HERO_PARTS.some((p) => p.slot === "head" && p.source.startsWith(`${tige}_`));
      expect(teteSoeur, `${s.id} n'a pas de tête (ni de source sœur ${tige}_head*)`).toBe(true);
    }
  });

  it("le sac à dos de Wraith va au dos, pas dans les bijoux", () => {
    // Le découpeur classe sac/cape/ailes en `accessory` faute de vocabulaire ;
    // `BodySlot` réserve `accessory` aux bagues et bracelets.
    const sac = HERO_PARTS.find((p) => p.id === "wraith_accessory");
    expect(sac?.slot).toBe("back");
  });

  it("porte le nombre d'os, indispensable pour prévenir avant l'assemblage", () => {
    const samurai = HERO_PARTS.filter((p) => p.source === "samurai");
    expect(samurai.length).toBeGreaterThan(0);
    // Mesuré : 68 os contre 131-168 pour les autres → remap sous le seuil.
    for (const p of samurai) expect(p.bones).toBe(68);
  });

  it("n'utilise que des emplacements déclarés", () => {
    for (const p of HERO_PARTS) expect(SLOT_ORDER).toContain(p.slot);
  });
});

describe("MODULAR_PARTS — fusion", () => {
  it("contient les deux origines", () => {
    const sources = new Set(MODULAR_PARTS.map((p) => p.source));
    expect(sources.has("biker")).toBe(true);
    expect(sources.has("wraith")).toBe(true);
  });

  it("aucun identifiant en double", () => {
    // Deux pièces de même id rendraient `getPart` non déterministe.
    const ids = MODULAR_PARTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tous les chemins pointent vers /models/", () => {
    for (const p of MODULAR_PARTS) expect(p.path.startsWith("/models/")).toBe(true);
  });

  it("getPart retrouve une pièce héros comme une pièce Biker", () => {
    expect(getPart("m_body")?.source).toBe("biker");
    expect(getPart("wraith_head")?.source).toBe("wraith");
  });
});

describe("partsForSlot — toutes les têtes dans une même liste", () => {
  it("mélange les packs pour un même emplacement", () => {
    const têtes = partsForSlot("head");
    const sources = new Set(têtes.map((p) => p.source));
    expect(sources.has("biker")).toBe(true);
    expect(sources.size).toBeGreaterThan(2);
  });

  it("ignore le genre, contrairement à partsFor", () => {
    expect(partsForSlot("head").length).toBeGreaterThanOrEqual(partsFor("male", "head").length);
  });
});

describe("partsFor — les pièces sans genre restent visibles", () => {
  it("le catalogue féminin reçoit les têtes héros", () => {
    // Le vrai piège : le pack Biker n'a AUCUNE tête féminine. Avant la fusion,
    // `partsFor("female", "head")` était vide — donc aucune flèche de sélection.
    const f = partsFor("female", "head");
    expect(f.length).toBeGreaterThan(0);
    expect(f.every((p) => p.gender === undefined || p.gender === "female")).toBe(true);
  });

  it("n'expose pas les pièces de l'autre genre", () => {
    expect(partsFor("female", "torso").some((p) => p.gender === "male")).toBe(false);
    expect(partsFor("male", "torso").some((p) => p.gender === "female")).toBe(false);
  });

  it("availableSlots inclut désormais les emplacements héros pour la femme", () => {
    // `arms` et `hands` n'existaient qu'en masculin dans le pack Biker.
    expect(availableSlots("female")).toContain("head");
    expect(allAvailableSlots()).toEqual(expect.arrayContaining(availableSlots("female")));
  });
});
