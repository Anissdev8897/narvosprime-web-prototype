import { describe, it, expect } from "vitest";
import {
  resolveVisibleSlots, SLOT_ORDER, SLOT_CATEGORY,
  slotSource, CREATOR_SLOTS, MERCHANT_SLOTS, type BodySlot,
  carouselLabel, SLOT_LABELS,
  EDITOR_TABS, SLOTS_COUVERTS_PAR_MORPHS, slotsInTab, tabForSlot, isCreationTab,
} from "./bodySlots";
import { MODULAR_PARTS, getPart, partsFor, starterOutfit, availableSlots } from "./partCatalog";

describe("resolveVisibleSlots", () => {
  it("respecte l'ordre d'assemblage, pas l'ordre de saisie", () => {
    const v = resolveVisibleSlots({ feet: "x", body: "y", head: "z" });
    expect(v).toEqual(["body", "head", "feet"]);
  });

  it("les gants masquent les mains nues (anti z-fighting)", () => {
    const v = resolveVisibleSlots({ body: "b", hands: "h", gloves: "g" });
    expect(v).toContain("gloves");
    expect(v).not.toContain("hands");
  });

  it("sans gants, les mains restent visibles", () => {
    const v = resolveVisibleSlots({ body: "b", hands: "h" });
    expect(v).toContain("hands");
  });

  it("ignore les emplacements vides", () => {
    const v = resolveVisibleSlots({ body: "b", torso: undefined });
    expect(v).toEqual(["body"]);
  });
});

describe("partCatalog", () => {
  it("chaque pièce a un id unique", () => {
    const ids = MODULAR_PARTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chaque chemin finit en .glb et vient d'un pack connu", () => {
    // Le catalogue ne venait QUE de BikerBundle jusqu'au 02/08/2026. Depuis, il
    // agrège aussi les pièces découpées des héros (`_parts/`). L'assertion porte
    // désormais sur l'origine déclarée, pas sur une sous-chaîne de chemin — un
    // nouveau pack devra s'ajouter ici sciemment.
    for (const p of MODULAR_PARTS) {
      expect(p.path.endsWith(".glb")).toBe(true);
      const attendu = p.source === "biker" ? "CharacterParts_Biker" : "/_parts/";
      expect(p.path, `${p.id} (source ${p.source})`).toContain(attendu);
    }
  });

  it("chaque emplacement de pièce est un emplacement connu", () => {
    for (const p of MODULAR_PARTS) expect(SLOT_ORDER).toContain(p.slot);
  });

  it("la tenue par défaut ne référence que des pièces existantes du bon genre", () => {
    for (const gender of ["male", "female"] as const) {
      const outfit = starterOutfit(gender);
      for (const [slot, id] of Object.entries(outfit)) {
        const part = getPart(id as string);
        expect(part, `${gender}/${slot} → ${id}`).toBeDefined();
        expect(part!.gender).toBe(gender);
        expect(part!.slot).toBe(slot);
      }
    }
  });

  it("la tenue par défaut couvre toujours l'emplacement corps", () => {
    expect(starterOutfit("male").body).toBeDefined();
    expect(starterOutfit("female").body).toBeDefined();
  });

  it("partsFor filtre par genre ET emplacement", () => {
    const maleTorso = partsFor("male", "torso");
    expect(maleTorso.length).toBeGreaterThan(0);
    // `gender === undefined` = pièce universelle (héros découpés), volontairement
    // proposée aux deux genres : c'est ce qui rend l'échange de pièces possible.
    expect(maleTorso.every((p) => (p.gender ?? "male") === "male" && p.slot === "torso")).toBe(true);
    // Aucune fuite entre genres pour autant.
    expect(maleTorso.some((p) => p.gender === "female")).toBe(false);
  });

  it("les deux genres sont habillables ET ont un corps", () => {
    // Depuis la séparation anatomie/vêtements, exiger `torso`/`legs`/`feet` ne
    // prouve plus rien sur l'habillement : ce sont des slots d'ANATOMIE,
    // pourvus par les pièces héros. Les deux couches sont donc vérifiées
    // séparément — sinon ce test resterait vert avec zéro vêtement au catalogue.
    for (const gender of ["male", "female"] as const) {
      const slots = availableSlots(gender);
      for (const anat of ["body", "torso", "legs", "feet"] as const) {
        expect(slots, `${gender} manque l'anatomie ${anat}`).toContain(anat);
      }
      for (const vet of ["top", "pants", "shoes"] as const) {
        expect(slots, `${gender} manque le vêtement ${vet}`).toContain(vet);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Créateur vs marchand — le créateur ne règle QUE l'anatomie.
// ══════════════════════════════════════════════════════════════════════════════

describe("slotSource — créateur vs marchand", () => {
  it("l'anatomie se règle au créateur", () => {
    for (const s of ["body", "head", "hair", "beard", "torso", "arms", "hands", "legs", "feet"] as const) {
      expect(slotSource(s), `${s} devrait être réglé au créateur`).toBe("creator");
    }
  });

  it("l'équipement porté s'obtient chez un marchand", () => {
    // Casque, plastron, gants, bottes, sac : ce que le joueur PORTE, pas ce
    // qu'il EST. Ces emplacements ne doivent plus apparaître à la création.
    for (const s of ["top", "pants", "shoes", "gloves", "headwear", "eyewear", "back", "accessory"] as const) {
      expect(slotSource(s), `${s} devrait s'acheter`).toBe("merchant");
    }
  });

  it("les deux listes partitionnent SLOT_ORDER — aucun oubli, aucun doublon", () => {
    // Le vrai risque n'est pas qu'un slot soit du mauvais côté : c'est qu'un slot
    // AJOUTÉ plus tard n'apparaisse NULLE PART. Il serait alors invisible au
    // créateur comme au marchand, sans que rien ne le signale.
    expect([...CREATOR_SLOTS, ...MERCHANT_SLOTS].sort()).toEqual([...SLOT_ORDER].sort());
    const inter = CREATOR_SLOTS.filter((s) => MERCHANT_SLOTS.includes(s));
    expect(inter).toEqual([]);
  });

  it("chaque slot de la taxonomie a une source", () => {
    for (const s of Object.keys(SLOT_CATEGORY) as BodySlot[]) {
      expect(["creator", "merchant"]).toContain(slotSource(s));
    }
  });

  it("CREATOR_SLOTS conserve l'ordre d'assemblage", () => {
    const attendu = SLOT_ORDER.filter((s) => CREATOR_SLOTS.includes(s));
    expect(CREATOR_SLOTS).toEqual(attendu);
  });
});

describe("carouselLabel — titres explicites des carrousels", () => {
  it("rend un titre anatomique là où le rail reste court", () => {
    // Deux jeux de libellés : le rail navigue (« Buste »), le carrousel dit ce
    // qu'on y choisit (« Anatomie du buste »).
    expect(carouselLabel("torso")).toBe("Anatomie du buste");
    expect(carouselLabel("hands")).toBe("Types de mains");
    expect(SLOT_LABELS.torso).toBe("Buste");
  });

  it("aucun emplacement ne rend un titre vide", () => {
    // Le repli sur `SLOT_LABELS` existe pour ça : ajouter un slot sans penser au
    // carrousel doit donner un titre court, jamais rien.
    for (const s of SLOT_ORDER) {
      expect(carouselLabel(s), `${s} sans titre`).toBeTruthy();
    }
  });

  it("chaque emplacement du créateur a un titre RÉÉCRIT, pas le repli", () => {
    // Les emplacements que le joueur voit méritent le libellé long. Ce test
    // échouera si l'on ajoute un slot d'anatomie sans lui donner son titre.
    for (const s of CREATOR_SLOTS) {
      expect(carouselLabel(s), `${s} retombe sur le libellé court`).not.toBe(SLOT_LABELS[s]);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Les trois onglets de l'éditeur (Corps / Création / Marchand)
// ══════════════════════════════════════════════════════════════════════════════

describe("onglets de l'éditeur", () => {
  it("range chaque emplacement dans un onglet et un seul", () => {
    const vus = new Set<BodySlot>();
    for (const tab of EDITOR_TABS) {
      for (const s of slotsInTab(tab)) {
        expect(vus.has(s), `${s} apparaît dans deux onglets`).toBe(false);
        vus.add(s);
      }
    }
    // ── L'INVARIANT A CHANGÉ LE 10/08/2026 ──────────────────────────────
    // Il exigeait `vus.size === SLOT_ORDER.length` : aucun emplacement
    // orphelin. Depuis le retrait du doublon, les emplacements couverts par la
    // morphologie continue (`SLOTS_COUVERTS_PAR_MORPHS`) n'appartiennent
    // volontairement à AUCUN onglet — les régler par pièces discrètes ferait
    // doublon avec 199 curseurs continus.
    //
    // Ce qui reste vérifié, et qui est le vrai garde-fou : un emplacement ne
    // disparaît de l'UI que s'il figure EXPLICITEMENT dans cette liste. Un slot
    // oublié par mégarde fait toujours tomber le test.
    const absents = SLOT_ORDER.filter((s) => !vus.has(s));
    expect(absents.sort()).toEqual([...SLOTS_COUVERTS_PAR_MORPHS].sort());
  });

  it("CORPS ne contient que le corps de base", () => {
    // C'est la base modulaire : le mannequin nu sur lequel tout se pose.
    expect(slotsInTab("corps")).toEqual(["body"]);
  });

  it("CRÉATION ne contient que de l'anatomie, jamais d'équipement", () => {
    // La règle métier du cahier des charges : pas d'équipement dans la création.
    for (const s of slotsInTab("creation")) {
      expect(SLOT_CATEGORY[s], `${s} n'est pas de l'anatomie`).toBe("anatomy");
      expect(slotSource(s)).toBe("creator");
    }
    expect(slotsInTab("creation")).toContain("head");
    expect(slotsInTab("creation")).not.toContain("body");
  });

  it("MARCHAND reçoit tout l'équipement, et rien d'autre", () => {
    expect(slotsInTab("marchand")).toEqual(MERCHANT_SLOTS);
    for (const s of slotsInTab("marchand")) {
      expect(SLOT_CATEGORY[s]).not.toBe("anatomy");
    }
    // Les pièces que le joueur PORTE, nommément.
    for (const s of ["top", "pants", "shoes", "gloves", "headwear", "back"] as BodySlot[]) {
      expect(slotsInTab("marchand"), `${s} devrait être chez le marchand`).toContain(s);
    }
  });

  it("corps + création reconstituent exactement les emplacements du créateur", () => {
    // Garantit que déplacer un slot d'un onglet à l'autre ne le fait pas sortir
    // de la création par accident. Le RETRAIT, lui, doit être délibéré : d'où la
    // soustraction explicite de `SLOTS_COUVERTS_PAR_MORPHS` plutôt qu'une
    // comparaison relâchée qui laisserait passer n'importe quelle disparition.
    const creation = [...slotsInTab("corps"), ...slotsInTab("creation")]
      .sort((a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b));
    const attendu = CREATOR_SLOTS.filter((s) => !SLOTS_COUVERTS_PAR_MORPHS.includes(s));
    expect(creation).toEqual(attendu);
  });

  it("seul le Marchand est hors création", () => {
    expect(isCreationTab("corps")).toBe(true);
    expect(isCreationTab("creation")).toBe(true);
    expect(isCreationTab("marchand")).toBe(false);
  });

  it("tabForSlot est cohérent avec slotsInTab", () => {
    for (const tab of EDITOR_TABS) {
      for (const s of slotsInTab(tab)) expect(tabForSlot(s)).toBe(tab);
    }
  });
});
