// modularEditorState.test.ts — navigation aux flèches dans l'éditeur modulaire.
//
// Toute la mécanique ◀ ▶ est vérifiée ici, sans monter de Canvas : c'est ce que
// permet la séparation logique pure / composant.

import { describe, it, expect } from "vitest";
import {
  optionsForSlot, currentIndex, cycleSlot, setSlot, editableSlots, switchGender, randomSelection,
  activeCategories, slotSummary, pruneUnknown, windowAround, initialSelection,
  DEFAULT_SKIN_TINT, DEFAULT_EYE_TINT,
} from "./modularEditorState";
import { CATEGORY_ORDER, REQUIRED_SLOTS } from "./bodySlots";
import { getPart, starterOutfit } from "./partCatalog";

describe("optionsForSlot", () => {
  it("ouvre les emplacements facultatifs par « Aucune »", () => {
    // Sans cette entrée, les flèches ne pourraient jamais RETIRER une pièce :
    // on passerait d'un chapeau à l'autre sans pouvoir se découvrir.
    const o = optionsForSlot("headwear", "male");
    expect(o[0].id).toBeNull();
    expect(o[0].label).toBe("Aucune");
  });

  it("n'offre pas « Aucune » sur un emplacement obligatoire", () => {
    expect(REQUIRED_SLOTS).toContain("body");
    expect(optionsForSlot("body", "male").every((o) => o.id !== null)).toBe(true);
  });

  it("mêle les pièces universelles aux pièces genrées", () => {
    // Une pièce sans genre doit apparaître pour les deux.
    //
    // L'exemple était `wraith` — écarté depuis la liste blanche d'anatomie
    // (05/08/2026) : Wraith est un personnage blindé, pas un corps nu. MPFB2 le
    // remplace, et le rend même plus juste : c'est LE corps neutre du créateur,
    // importé de l'addon Blender, non dimorphique par construction.
    const h = optionsForSlot("head", "male");
    const f = optionsForSlot("head", "female");
    expect(h.some((o) => o.source === "mpfb")).toBe(true);
    expect(f.some((o) => o.source === "mpfb")).toBe(true);
  });

  it("écarte les pièces de l'autre genre", () => {
    const f = optionsForSlot("top", "female");
    expect(f.every((o) => !o.part || o.part.gender !== "male")).toBe(true);
  });
});

describe("currentIndex", () => {
  it("trouve la pièce équipée", () => {
    const o = optionsForSlot("head", "male");
    const cible = o[2];
    expect(currentIndex(o, cible.id ?? undefined)).toBe(2);
  });

  it("retombe sur 0 pour un identifiant obsolète", () => {
    // Un pack retiré ne doit pas bloquer les flèches sur un index négatif.
    expect(currentIndex(optionsForSlot("head", "male"), "pièce_supprimée")).toBe(0);
  });

  it("un emplacement vide pointe sur « Aucune »", () => {
    expect(currentIndex(optionsForSlot("headwear", "male"), undefined)).toBe(0);
  });
});

describe("cycleSlot", () => {
  it("avance d'un cran", () => {
    const o = optionsForSlot("head", "male");
    const après = cycleSlot({}, "head", 1, "male");
    expect(après.head).toBe(o[1].id ?? undefined);
  });

  it("boucle en fin de liste", () => {
    const o = optionsForSlot("head", "male");
    const dernier = o[o.length - 1];
    const après = cycleSlot({ head: dernier.id! }, "head", 1, "male");
    expect(après.head ?? null).toBe(o[0].id);
  });

  it("boucle en arrière depuis le début — le modulo négatif de JS", () => {
    // (-1 % n) vaut -1 en JavaScript : sans le `+ options.length`, la flèche ◀
    // depuis la première pièce sortirait du tableau.
    const o = optionsForSlot("head", "male");
    const après = cycleSlot({}, "head", -1, "male");
    expect(après.head).toBe(o[o.length - 1].id ?? undefined);
  });

  it("revenir sur « Aucune » retire la pièce", () => {
    const o = optionsForSlot("headwear", "male");
    const équipé = { headwear: o[1].id! };
    expect(cycleSlot(équipé, "headwear", -1, "male").headwear).toBeUndefined();
  });

  it("ne mute pas la tenue d'origine", () => {
    // Règle d'immutabilité du projet : une flèche produit un NOUVEL état.
    const avant = { head: "m_head_01" };
    const après = cycleSlot(avant, "head", 1, "male");
    expect(avant.head).toBe("m_head_01");
    expect(après).not.toBe(avant);
  });

  it("laisse la tenue intacte sur un emplacement sans pièce", () => {
    const avant = { body: "m_body" };
    expect(cycleSlot(avant, "beard", 1, "female")).toEqual(avant);
  });
});

describe("setSlot", () => {
  it("équipe une pièce précise", () => {
    expect(setSlot({}, "head", "wraith_head").head).toBe("wraith_head");
  });

  it("null retire l'emplacement au lieu de stocker null", () => {
    // Laisser `head: null` ferait échouer les `if (equipped[slot])` en aval.
    const après = setSlot({ head: "x" }, "head", null);
    expect("head" in après).toBe(false);
  });
});

describe("editableSlots", () => {
  it("ne retient que les emplacements réellement pourvus", () => {
    // Un emplacement n'ayant que « Aucune » afficherait deux flèches inertes.
    for (const s of editableSlots("clothing", "male")) {
      expect(optionsForSlot(s, "male").length).toBeGreaterThan(1);
    }
  });

  it("l'anatomie et les vêtements sont tous deux éditables", () => {
    expect(editableSlots("anatomy", "male").length).toBeGreaterThan(0);
    expect(editableSlots("clothing", "male")).toContain("top");
    expect(editableSlots("clothing", "male")).toContain("pants");
  });

  it("les trois catégories sont actives pour les deux genres", () => {
    for (const g of ["male", "female"] as const) {
      expect(activeCategories(g, CATEGORY_ORDER)).toEqual(CATEGORY_ORDER);
    }
  });
});

describe("slotSummary", () => {
  it("annonce la position dans la liste", () => {
    const s = slotSummary("head", {}, "male");
    expect(s.position).toBe(1);
    expect(s.total).toBe(optionsForSlot("head", "male").length);
  });

  it("nomme la pièce équipée et son pack", () => {
    const s = slotSummary("head", { head: "mpfb_head" }, "male");
    expect(s.source).toBe("mpfb");
    expect(s.position).toBeGreaterThan(0);
  });

  it("nomme quand même une pièce sortie du catalogue, et le signale", () => {
    // Un personnage sauvegardé avant la liste blanche d'anatomie porte encore
    // une tête de Wraith. Elle n'est plus proposée, mais elle est toujours
    // RENDUE : annoncer la première option à sa place serait un mensonge muet.
    const s = slotSummary("head", { head: "wraith_head" }, "male");
    expect(s.source).toBe("wraith");
    expect(s.label).toContain("Wraith");
    expect(s.label).toContain("hors catalogue");
    expect(s.position).toBe(0); // hors liste : aucune position valide
  });
});

describe("pruneUnknown", () => {
  it("retire les pièces absentes du catalogue", () => {
    // `useGLTF` sur un chemin inexistant suspend indéfiniment et fige l'écran
    // de création, sans message d'erreur.
    const out = pruneUnknown({ body: "m_body", head: "pack_disparu_head" });
    expect(out.body).toBe("m_body");
    expect(out.head).toBeUndefined();
  });

  it("conserve une tenue entièrement valide", () => {
    const t = { body: "m_body", head: "m_head_01" };
    expect(pruneUnknown(t)).toEqual(t);
  });
});

describe("windowAround", () => {
  it("centre la fenêtre sur la sélection", () => {
    // 20 pièces, curseur au 10e, fenêtre de 5 → départ 8, sélection au milieu.
    expect(windowAround(20, 10, 5)).toBe(8);
  });

  it("borne au début — pas de départ négatif", () => {
    // Le calcul brut donnerait -2. Un `slice(-2)` renverrait la FIN de la liste.
    expect(windowAround(20, 0, 5)).toBe(0);
    expect(windowAround(20, 1, 5)).toBe(0);
  });

  it("borne à la fin — pas de cases vides", () => {
    expect(windowAround(20, 19, 5)).toBe(15);
    expect(windowAround(20, 18, 5)).toBe(15);
  });

  it("liste plus courte que la fenêtre → tout afficher", () => {
    // Cas réel : `beard` n'a que 2 entrées pour une fenêtre de 5. Le calcul
    // borné donnerait `min(brut, 2-5) = -3` sans ce cas particulier.
    expect(windowAround(3, 2, 5)).toBe(0);
    expect(windowAround(0, 0, 5)).toBe(0);
  });

  it("fenêtre paire — décalage vers le bas, jamais de départ négatif", () => {
    expect(windowAround(10, 0, 4)).toBe(0);
    expect(windowAround(10, 5, 4)).toBe(3);
  });

  it("le départ garde toujours la sélection dans la fenêtre", () => {
    // Propriété qui compte plus que les valeurs exactes : quel que soit
    // l'index, la pièce sélectionnée doit être visible.
    for (const total of [1, 3, 7, 20, 47]) {
      for (let i = 0; i < total; i++) {
        const d = windowAround(total, i, 5);
        expect(d, `total=${total} i=${i}`).toBeGreaterThanOrEqual(0);
        expect(i, `total=${total} i=${i}`).toBeGreaterThanOrEqual(d);
        expect(i).toBeLessThan(d + 5);
      }
    }
  });
});

describe("initialSelection", () => {
  it("équipe un corps réellement présent au catalogue", () => {
    for (const g of ["male", "female"] as const) {
      const sel = initialSelection(g);
      expect(sel.equipped.body, `${g} sans corps`).toBeDefined();
      expect(pruneUnknown(sel.equipped).body, `${g} : corps retiré au nettoyage`).toBeDefined();
    }
  });

  it("part sur des teintes neutres", () => {
    expect(initialSelection().skinTint).toBe(DEFAULT_SKIN_TINT);
    expect(initialSelection().eyeTint).toBe(DEFAULT_EYE_TINT);
  });
});

describe("valeurs par défaut", () => {
  it("la teinte neutre ne modifie rien", () => {
    expect(DEFAULT_SKIN_TINT).toBe("#ffffff");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// switchGender — les pièces sont GENRÉES.
//
// Changer le seul champ `gender` laisserait `m_body` sur une sélection féminine.
// `pruneUnknown` retirerait ensuite la pièce introuvable, `body` compris :
// personnage sans corps, sans erreur.
// ══════════════════════════════════════════════════════════════════════════════

describe("switchGender", () => {
  it("le personnage garde un CORPS après bascule", () => {
    const apres = switchGender(initialSelection("male"), "female");
    expect(apres.gender).toBe("female");
    expect(apres.equipped.body, "corps perdu à la bascule").toBeDefined();
  });

  it("aucune pièce de l'ancien genre ne survit", () => {
    // Le vrai risque : une pièce masculine restée sur une sélection féminine.
    // On vérifie par le CATALOGUE, pas par une liste d'ids en dur.
    //
    // ⚠ On part de la tenue COMPLÈTE, pas de `initialSelection` : celle-ci ne
    // pose que `body`, qui est réécrit dans tous les cas. Un test bâti dessus
    // reste vert même si la bascule conserve toutes les autres pièces —
    // vérifié en sabotant `switchGender`.
    const depart = { ...initialSelection("male"), equipped: starterOutfit("male") };
    const apres = switchGender(depart, "female");
    for (const id of Object.values(apres.equipped)) {
      if (!id) continue;
      const g = getPart(id)?.gender;
      expect(g === undefined || g === "female", `${id} est du mauvais genre`).toBe(true);
    }
  });

  it("la bascule est réversible et revient à un état sain", () => {
    const aller = switchGender(initialSelection("female"), "male");
    const retour = switchGender(aller, "female");
    expect(retour.gender).toBe("female");
    expect(retour.equipped.body).toBeDefined();
  });

  it("archétype, morphologie et teintes survivent", () => {
    // Basculer le genre ne doit pas réinitialiser les autres réglages : le
    // joueur les perdrait sans comprendre pourquoi.
    const avant = { ...initialSelection("male"), build: "heavy" as const, skinTint: "#c68642" };
    const apres = switchGender(avant, "female");
    expect(apres.build).toBe("heavy");
    expect(apres.skinTint).toBe("#c68642");
    expect(apres.archetype).toBe(avant.archetype);
  });

  it("basculer vers le même genre ne change rien", () => {
    const sel = initialSelection("male");
    expect(switchGender(sel, "male")).toBe(sel);
  });

  it("un tirage aléatoire donne toujours un personnage VIABLE", () => {
    // `rnd` injecté → déterministe. On balaie toute la plage : un tirage aux
    // extrémités (0 et ~1) est celui qui sort des tableaux si l'indexation
    // déborde. `% xs.length` existe pour ça.
    for (const r of [0, 0.25, 0.5, 0.75, 0.999999]) {
      for (const g of ["male", "female"] as const) {
        const s = randomSelection(g, () => r);
        expect(s.gender, `r=${r}`).toBe(g);          // le hasard ne change PAS le genre
        expect(s.archetype).toBe("human");            // alien/synth n'ont pas de corps
        expect(s.equipped.body, `r=${r} sans corps`).toBeDefined();
        for (const id of Object.values(s.equipped)) {
          if (id) expect(getPart(id), `${id} hors catalogue`).toBeTruthy();
        }
      }
    }
  });

  it("le tirage reste dans les bornes des proportions", () => {
    const s = randomSelection("female", () => 0.999999);
    for (const v of Object.values(s.proportions!)) {
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
  });

  it("un personnage NEUF démarre en femme, avec un corps", () => {
    // Choix produit du 04/08/2026. ⚠ Ne concerne QUE les nouveaux : les
    // personnages d'avant n'ont pas de `gender` stocké et portent des pièces
    // masculines ; leur repli reste `male` côté ForgePersonnages, sans quoi
    // `pruneUnknown` leur retirerait `m_body` et les laisserait sans corps.
    const neuf = initialSelection();
    expect(neuf.gender).toBe("female");
    expect(neuf.equipped.body, "corps féminin absent").toBeDefined();
  });
});
