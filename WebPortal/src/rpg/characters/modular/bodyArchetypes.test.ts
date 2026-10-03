// bodyArchetypes.test.ts — archétypes, morphologies et séparation des couches.
//
// Deux contrats sont verrouillés ici :
//   • une combinaison DÉCLARÉE mais non modélisée reste visible (`path: null`),
//     sinon l'UI ne pourrait pas distinguer « n'existe pas » de « à venir » ;
//   • anatomie et vêtements n'occupent JAMAIS le même emplacement — la collision
//     qui faisait qu'un blouson effaçait le buste de Wraith.

import { describe, it, expect } from "vitest";
import {
  ARCHETYPES, BUILDS, BASE_BODIES, availableBodies, buildsFor, findBody,
  isArchetypePlayable, getArchetype, getBuild, getBaseBody,
} from "./bodyArchetypes";
import {
  type BodySlot,
  SLOT_CATEGORY, SLOT_ORDER, SLOT_LABELS, SLOT_HIDES, CATEGORY_ORDER,
  slotsInCategory, migrateLegacyOutfit, resolveVisibleSlots, slotSource,
} from "./bodySlots";
import { partsForSlot, getPart, starterOutfit } from "./partCatalog";
import { gearSlotForBodySlot } from "../../loot/modularItems";
import { initialSelection, pruneUnknown } from "./modularEditorState";
import { HERO_PARTS } from "./heroParts";
import { compatOf } from "./creator/partCompat";

describe("taxonomie des emplacements", () => {
  it("chaque emplacement a une catégorie et un libellé", () => {
    for (const s of SLOT_ORDER) {
      expect(SLOT_CATEGORY[s], `${s} sans catégorie`).toBeDefined();
      expect(SLOT_LABELS[s], `${s} sans libellé`).toBeTruthy();
    }
  });

  it("les trois catégories couvrent tous les emplacements", () => {
    const vus = CATEGORY_ORDER.flatMap(slotsInCategory);
    expect(new Set(vus).size).toBe(SLOT_ORDER.length);
  });

  it("anatomie et vêtements sont des emplacements DISTINCTS", () => {
    // Le bug d'origine : `torso` servait aux vestes ET aux bustes nus.
    const anat = slotsInCategory("anatomy");
    const vet = slotsInCategory("clothing");
    for (const s of vet) expect(anat).not.toContain(s);
    expect(anat).toContain("torso");
    expect(vet).toContain("top");
  });

  it("chaque vêtement masque l'anatomie qu'il habille", () => {
    expect(SLOT_HIDES.top).toContain("torso");
    expect(SLOT_HIDES.pants).toContain("legs");
    expect(SLOT_HIDES.shoes).toContain("feet");
    expect(SLOT_HIDES.gloves).toContain("hands");
  });

  it("un haut ne masque pas les bras — un débardeur les laisse nus", () => {
    expect(SLOT_HIDES.top ?? []).not.toContain("arms");
  });

  it("un personnage habillé ne rend pas l'anatomie recouverte", () => {
    const v = resolveVisibleSlots({ body: "b", torso: "t", top: "veste", legs: "l", pants: "jean" });
    expect(v).toContain("top");
    expect(v).toContain("pants");
    expect(v).not.toContain("torso");
    expect(v).not.toContain("legs");
  });
});

describe("migrateLegacyOutfit", () => {
  it("déplace une ancienne tenue vers la couche vêtements", () => {
    const out = migrateLegacyOutfit({ body: "m_body", torso: "m_tanktop", legs: "m_jeans", feet: "m_boots_half" });
    expect(out.top).toBe("m_tanktop");
    expect(out.pants).toBe("m_jeans");
    expect(out.shoes).toBe("m_boots_half");
    expect(out.torso).toBeUndefined();
  });

  it("ne touche pas une tenue déjà au nouveau format", () => {
    // Ici `torso` est un BUSTE NU volontaire : le migrer en `top` remplacerait
    // une pièce d'anatomie par un vêtement.
    const out = migrateLegacyOutfit({ torso: "wraith_torso", top: "m_tanktop" });
    expect(out.torso).toBe("wraith_torso");
    expect(out.top).toBe("m_tanktop");
  });

  it("ignore les emplacements vides", () => {
    expect(migrateLegacyOutfit({ torso: undefined, body: "x" })).toEqual({ body: "x" });
  });
});

describe("archétypes et morphologies", () => {
  it("propose les quatre archétypes demandés", () => {
    expect(ARCHETYPES.map((a) => a.id)).toEqual(["human", "alien", "synthetic", "mutant"]);
  });

  it("propose maigre, athlétique, musclé, corpulent", () => {
    expect(BUILDS.map((b) => b.id)).toEqual(["slim", "athletic", "muscular", "heavy"]);
  });

  it("les corpulences vont du plus fin au plus large", () => {
    const g = BUILDS.map((b) => b.girth);
    for (let i = 1; i < g.length; i++) expect(g[i]).toBeGreaterThan(g[i - 1]);
  });

  it("garde les combinaisons non modélisées au lieu de les cacher", () => {
    // Sans ça, l'UI ne pourrait pas afficher « alien » en grisé.
    const sansModele = BASE_BODIES.filter((b) => b.path === null);
    expect(sansModele.length).toBeGreaterThan(0);
    expect(BASE_BODIES.length).toBeGreaterThan(availableBodies().length);
  });

  it("seul l'humain est jouable aujourd'hui", () => {
    expect(isArchetypePlayable("human")).toBe(true);
    expect(isArchetypePlayable("alien")).toBe(false);
    expect(availableBodies().every((b) => b.archetype === "human")).toBe(true);
  });

  it("chaque corps référence un archétype et une morphologie connus", () => {
    for (const b of BASE_BODIES) {
      expect(getArchetype(b.archetype), `${b.id}`).toBeDefined();
      expect(getBuild(b.build), `${b.id}`).toBeDefined();
    }
  });

  it("aucun identifiant de corps en double", () => {
    const ids = BASE_BODIES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("findBody respecte le genre quand il existe", () => {
    expect(findBody("human", "athletic", "male")?.id).toBe("human_m_athletic");
    expect(findBody("human", "athletic", "female")?.id).toBe("human_f_athletic");
  });

  it("findBody ignore le genre sur un archétype non genré", () => {
    // Demander un alien « masculin » ne doit pas renvoyer vide : les corps
    // aliens ne déclarent aucun genre.
    expect(findBody("alien", "slim", "male")?.id).toBe("alien_slim");
    expect(findBody("alien", "slim")?.id).toBe("alien_slim");
  });

  it("buildsFor ne propose que les morphologies déclarées", () => {
    expect(buildsFor("mutant").map((b) => b.id)).toEqual(["muscular", "heavy"]);
    expect(buildsFor("human")).toHaveLength(4);
  });

  it("tout corps modélisé pointe vers une pièce RÉELLE du catalogue", () => {
    // Deux espaces d'identifiants cohabitent : `BaseBody.id` (human_m_athletic)
    // et `ModularPart.id` (m_body). Équiper un personnage avec le premier passe
    // tsc mais échoue au rendu — `pruneUnknown` ne le trouve pas et le retire,
    // laissant un personnage sans corps, sans aucune erreur.
    for (const b of BASE_BODIES.filter((x) => x.path !== null)) {
      expect(b.partId, `${b.id} sans partId`).toBeTruthy();
      const pièce = getPart(b.partId!);
      expect(pièce, `${b.id} → ${b.partId} absent du catalogue`).toBeDefined();
      expect(pièce!.slot).toBe("body");
    }
  });

  it("un corps non modélisé n'annonce aucune pièce", () => {
    for (const b of BASE_BODIES.filter((x) => x.path === null)) {
      expect(b.partId, `${b.id} annonce une pièce sans modèle`).toBeNull();
    }
  });

  it("la sélection de départ équipe un corps affichable", () => {
    for (const g of ["male", "female"] as const) {
      const sel = initialSelection(g);
      expect(sel.equipped.body, `${g} démarre sans corps`).toBeDefined();
      expect(pruneUnknown(sel.equipped).body, `${g} : corps retiré au nettoyage`).toBeDefined();
    }
  });

  it("getBaseBody retrouve un corps par identifiant", () => {
    expect(getBaseBody("human_m_athletic")?.path).toContain("SK_ma_UE5_meta_body");
    expect(getBaseBody("inconnu")).toBeUndefined();
  });
});

describe("tenue de départ — sans équipement ni accessoire", () => {
  const GENRES = ["male", "female"] as const;

  it("donne un CORPS, et rien qui le masque", () => {
    // Contrat inversé le 03/08/2026. Il exigeait `top` / `pants` / `shoes` —
    // le créateur affichait donc un personnage habillé, et l'anatomie qu'on
    // vient y régler (buste, bras, jambes, pieds) restait invisible sous le
    // tissu. L'équipement s'achète maintenant chez l'équipementier.
    for (const g of GENRES) {
      const t = starterOutfit(g);
      expect(t.body, `${g} sans corps`).toBeDefined();
    }
  });

  it("n'équipe QUE de l'anatomie — aucun vêtement ni accessoire", () => {
    // Garde par SOURCE, pas par liste d'ids : tout emplacement qui bascule
    // côté marchand sera automatiquement interdit ici, sans rien à mettre à
    // jour. Une liste en dur resterait verte en silence.
    for (const g of GENRES) {
      for (const [slot, id] of Object.entries(starterOutfit(g))) {
        if (!id) continue;
        expect(slotSource(slot as BodySlot), `${g}/${slot} masque le corps`).toBe("creator");
      }
    }
  });

  it("ne remplit AUCUN slot de catégorie accessoire", () => {
    // Garde par CATÉGORIE et non par liste d'ids : ajouter un slot
    // d'accessoire au projet fera échouer ce test automatiquement, alors
    // qu'une liste en dur resterait verte en silence.
    for (const g of GENRES) {
      for (const [slot, id] of Object.entries(starterOutfit(g))) {
        if (!id) continue;
        expect(SLOT_CATEGORY[slot as BodySlot], `${g}/${slot}`).not.toBe("accessory");
      }
    }
  });

  it("ne remplit aucun slot d'ÉQUIPEMENT — gants, casque, lunettes", () => {
    for (const g of GENRES) {
      const t = starterOutfit(g);
      for (const s of ["gloves", "headwear", "eyewear", "back", "accessory"] as const) {
        expect(t[s], `${g} démarre avec ${s}`).toBeUndefined();
      }
    }
  });

  it("aucune pièce de la tenue n'occupe un emplacement RPG", () => {
    // Une pièce dotée d'un `GearSlot` est de l'ÉQUIPEMENT : elle apparaîtrait
    // dans le panneau d'équipement et porterait des bonus.
    //
    // Deux exceptions documentées : `top` → `armor` et `shoes` → `boots` sont
    // les seuls emplacements RPG que le vocabulaire vestimentaire recoupe. Un
    // débardeur et des chaussures basses restent des vêtements de pauvre.
    const EXCEPTIONS = new Set<BodySlot>(["top", "shoes"]);
    for (const g of GENRES) {
      for (const [slot] of Object.entries(starterOutfit(g))) {
        const s = slot as BodySlot;
        if (EXCEPTIONS.has(s)) continue;
        expect(gearSlotForBodySlot(s), `${g}/${slot} est équipable`).toBeUndefined();
      }
    }
  });

  it("chaque pièce citée existe réellement au catalogue", () => {
    // Un id périmé passe le typage et disparaît en silence au rendu.
    for (const g of GENRES) {
      for (const [slot, id] of Object.entries(starterOutfit(g))) {
        expect(getPart(id!), `${g}/${slot} → ${id}`).toBeDefined();
      }
    }
  });
});

describe("catalogue vu par catégorie", () => {
  it("la couche vêtements est réellement pourvue", () => {
    for (const s of ["top", "pants", "shoes", "gloves"] as const) {
      expect(partsForSlot(s).length, `${s} vide`).toBeGreaterThan(0);
    }
  });

  it("les pièces héros peuplent l'anatomie, pas les vêtements", () => {
    // Un torse de Wraith est du buste, pas une veste.
    expect(partsForSlot("torso").some((p) => p.source === "wraith")).toBe(true);
    expect(partsForSlot("top").every((p) => p.source === "biker")).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Les 4 morphologies humaines sont jouables sur le corps Biker.
//
// État d'avant : 2 corps sur 8 avaient un `path` — « athlétique » pour chaque
// genre. Les six autres étaient à `null`, donc grisés dans le créateur : le
// joueur voyait quatre morphologies dont une seule cliquable.
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// Anatomie découpée des deux mannequins Biker.
//
// Avant le 03/08/2026 le catalogue féminin n'avait que `f_body` et `f_hair` :
// les carrousels buste / bras / mains / jambes / pieds étaient VIDES côté femme.
// ══════════════════════════════════════════════════════════════════════════════

describe("données de compatibilité — couverture du catalogue", () => {
  it("chaque pièce découpée a son verdict de compatibilité", () => {
    // `part-compat.json` alimente la pastille d'alerte des vignettes. Il est
    // produit par `audit-part-compat.mjs --json=…`, donc il PÉRIME dès qu'on
    // découpe de nouvelles sources.
    //
    // Constaté le 04/08/2026 : 39 entrées pour 69 pièces. Les 30 nouvelles
    // s'affichaient sans pastille — dont les 6 pièces `mpfb`, incompatibles à
    // 0 % avec le mannequin Biker. Le joueur pouvait les choisir, rien ne se
    // liait, et rien ne l'en avertissait.
    const sansVerdict = HERO_PARTS.filter((p) => compatOf(p.id) === undefined);
    expect(
      sansVerdict.map((p) => p.id),
      "pièces sans verdict — relancer `node scripts/audit-part-compat.mjs --json=src/data/part-compat.json`",
    ).toEqual([]);
  });
});

describe("anatomie découpée — les deux genres sont pourvus", () => {
  const REGIONS = ["torso", "head", "arms", "hands", "legs", "feet"] as const;

  it("chaque région existe pour l'homme ET pour la femme", () => {
    for (const slot of REGIONS) {
      for (const g of ["male", "female"] as const) {
        const src = g === "male" ? "biker_m" : "biker_f";
        const piece = partsForSlot(slot).find((p) => p.source === src);
        expect(piece, `${slot} manquant pour ${g}`).toBeTruthy();
      }
    }
  });

  it("une pièce de mannequin ne fuit pas vers l'autre genre", () => {
    // Sans `gender`, les 12 pièces apparaîtraient des deux côtés et le joueur
    // choisirait une anatomie de l'autre sexe sans avertissement.
    for (const slot of REGIONS) {
      for (const p of partsForSlot(slot)) {
        if (p.source === "biker_m") expect(p.gender, `${p.id}`).toBe("male");
        if (p.source === "biker_f") expect(p.gender, `${p.id}`).toBe("female");
      }
    }
  });

  it("les pièces de héros restent non genrées", () => {
    // Elles s'essaient sur n'importe quel corps ; c'est `rebindSkinnedMesh` qui
    // tranche, pas le catalogue. Leur imposer un genre les retirerait à tort.
    const heros = partsForSlot("torso").filter((p) => p.source === "wraith");
    expect(heros.length).toBeGreaterThan(0);
    expect(heros.every((p) => p.gender === undefined)).toBe(true);
  });
});

describe("morphologies humaines — toutes sur le corps Biker", () => {
  const humains = BASE_BODIES.filter((b) => b.archetype === "human");

  it("les 8 combinaisons genre × morphologie existent et sont jouables", () => {
    expect(humains).toHaveLength(BUILDS.length * 2); // 4 morphologies × 2 genres

    for (const g of ["male", "female"] as const) {
      for (const b of BUILDS) {
        const corps = findBody("human", b.id, g);
        expect(corps, `human/${g}/${b.id} absent`).toBeTruthy();
        // `path` ET `partId` : le premier charge le GLB, le second identifie la
        // pièce au catalogue. L'un sans l'autre donne un personnage sans corps.
        expect(corps!.path, `human/${g}/${b.id} sans path`).toBeTruthy();
        expect(corps!.partId, `human/${g}/${b.id} sans partId`).toBeTruthy();
      }
    }
  });

  it("toutes les morphologies d'un genre partagent le MÊME corps Biker", () => {
    // C'est le sens du choix : une seule géométrie, un seul squelette (161 os,
    // 100 % commun H/F — cf. scripts/inspect-base-bodies.mjs). La morphologie
    // n'est qu'un facteur d'épaisseur, pas un maillage distinct.
    for (const g of ["male", "female"] as const) {
      const chemins = new Set(humains.filter((b) => b.gender === g).map((b) => b.path));
      expect(chemins.size, `${g} devrait n'avoir qu'un seul corps`).toBe(1);
    }
  });

  it("chaque morphologie porte un girth distinct — sinon le choix ne sert à rien", () => {
    const girths = BUILDS.map((b) => b.girth);
    expect(new Set(girths).size).toBe(BUILDS.length);
  });

  it("girth croît de maigre à corpulent, et athlétique reste la référence à 1", () => {
    // `girth` pilote l'épaisseur au rendu (X/Z, jamais Y). Un ordre inversé
    // donnerait un « corpulent » plus fin qu'un « maigre » sans rien casser
    // ailleurs — c'est le genre d'erreur qu'aucun typage n'attrape.
    const par = (id: string) => getBuild(id as never)?.girth;
    expect(par("athletic")).toBe(1);
    expect(par("slim")!).toBeLessThan(par("athletic")!);
    expect(par("muscular")!).toBeGreaterThan(par("athletic")!);
    expect(par("heavy")!).toBeGreaterThan(par("muscular")!);
  });

  it("une morphologie inconnue ne déforme pas — repli sur 1", () => {
    // `modularPropsFromCustomCharacter` fait `getBuild(c.build)?.girth ?? 1`.
    // Les personnages d'avant n'ont pas de `build` : sans ce repli, ils
    // seraient silencieusement épaissis ou amincis au premier rendu.
    expect(getBuild("inexistant" as never)?.girth ?? 1).toBe(1);
    expect(getBuild(undefined as never)?.girth ?? 1).toBe(1);
  });

  it("les archétypes non humains restent déclarés sans modèle", () => {
    // Contrat d'origine préservé : `path: null` distingue « à venir » de
    // « n'existe pas ». Le forçage ne concerne QUE les humains.
    const autres = BASE_BODIES.filter((b) => b.archetype !== "human");
    expect(autres.length).toBeGreaterThan(0);
    expect(autres.every((b) => b.path === null)).toBe(true);
  });
});
