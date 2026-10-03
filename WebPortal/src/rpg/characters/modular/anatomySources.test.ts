import { describe, it, expect } from "vitest";
import { ANATOMY_SOURCES, ANATOMY_FILTERED_SLOTS, isCreatorPart } from "./anatomySources";
import { optionsForSlot } from "./modularEditorState";
import { MODULAR_PARTS } from "./partCatalog";
import { slotSource } from "./bodySlots";
import { modularGearIds } from "../../npc/merchants";
import { MODULAR_ITEMS, partIdOfItem } from "../../loot/modularItems";

const GENRES = ["male", "female"] as const;

describe("liste blanche d'anatomie", () => {
  it("les carrousels d'anatomie ne proposent QUE des corps nus", () => {
    // Avant ce filtre : 40 options dans « torse », dont des vestes de zombie et
    // des plastrons de trooper. Le découpeur classe par région couverte, donc
    // une veste sort en `torso` — l'anatomie et l'armure se mélangeaient.
    const intrus: string[] = [];
    for (const genre of GENRES) {
      for (const slot of ANATOMY_FILTERED_SLOTS) {
        for (const o of optionsForSlot(slot, genre)) {
          if (o.id === null) continue; // l'entrée « Aucune »
          if (!o.source || !ANATOMY_SOURCES.has(o.source)) {
            intrus.push(`${slot}/${genre} → ${o.id} (source: ${o.source})`);
          }
        }
      }
    }
    expect(intrus, `sources non anatomiques dans le créateur :\n${intrus.join("\n")}`).toEqual([]);
  });

  it("le corps MPFB2 de l'addon Blender est proposé dans chaque emplacement d'anatomie", () => {
    // Il ÉTAIT déjà là — en 9ᵉ position sur 26 à 40 options, donc introuvable.
    // Ce test vérifie qu'il y reste, et le précédent qu'il n'y est plus noyé.
    for (const genre of GENRES) {
      for (const slot of ANATOMY_FILTERED_SLOTS) {
        const ids = optionsForSlot(slot, genre).map((o) => o.id);
        expect(ids, `${slot}/${genre}`).toContain(`mpfb_${slot}`);
      }
    }
  });

  it("les carrousels restent courts et lisibles", () => {
    for (const genre of GENRES) {
      for (const slot of ANATOMY_FILTERED_SLOTS) {
        const n = optionsForSlot(slot, genre).length;
        // Le corps neutre MPFB2 + le corps du genre + le pack Biker écrit à la
        // main. Une borne haute franche : si une extraction fait exploser ce
        // nombre, c'est que la liste blanche a été contournée.
        expect(n, `${slot}/${genre} : ${n} options`).toBeLessThanOrEqual(8);
      }
    }
  });

  it("les cheveux ne sont PAS filtrés — sinon le carrousel tombe à zéro", () => {
    // Ni les corps Biker ni MPFB2 n'ont de cheveux. Une coiffure n'est pas une
    // armure : elle reste au créateur, sans quoi « TÊTES ET CHEVEUX » perd sa
    // moitié. C'est un choix, pas un oubli.
    for (const genre of GENRES) {
      const cheveux = optionsForSlot("hair", genre).filter((o) => o.id !== null);
      expect(cheveux.length, `cheveux/${genre}`).toBeGreaterThan(0);
    }
  });
});

describe("partition créateur / marchand", () => {
  it("aucune pièce ne devient injoignable", () => {
    // La règle qui coûte cher si on l'oublie : une veste vit dans le slot
    // `torso`, donc `slotSource` la disait « créateur ». Le filtre l'en sort ;
    // sans la seconde règle de `modularGearIds`, elle n'était plus NULLE PART.
    const enVente = new Set(modularGearIds());
    const perdues: string[] = [];

    for (const item of MODULAR_ITEMS) {
      const partId = partIdOfItem(item.id);
      const part = partId ? MODULAR_PARTS.find((p) => p.id === partId) : undefined;
      if (!part) continue;
      const auCreateur = slotSource(part.slot) === "creator" && isCreatorPart(part);
      if (!auCreateur && !enVente.has(item.id)) perdues.push(`${part.id} (${part.slot})`);
    }

    expect(perdues, `pièces injoignables :\n${perdues.slice(0, 20).join("\n")}`).toEqual([]);
  });

  it("le marchand ne vend aucun corps nu", () => {
    const enVente = new Set(modularGearIds());
    const nus = MODULAR_ITEMS.filter((item) => {
      if (!enVente.has(item.id)) return false;
      const partId = partIdOfItem(item.id);
      const part = partId ? MODULAR_PARTS.find((p) => p.id === partId) : undefined;
      return part ? slotSource(part.slot) === "creator" && isCreatorPart(part) : false;
    });
    expect(nus.map((i) => i.id)).toEqual([]);
  });
});
