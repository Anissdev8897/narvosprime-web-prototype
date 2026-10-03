// forgeOps.test.ts — arbitrage de la co-édition Forge Live.
//
// Constat M11-v2 : la sync diffusait un SNAPSHOT COMPLET et le récepteur
// l'appliquait tel quel. « Dernier enregistrement gagne » — y compris quand les
// deux personnes touchaient des objets DIFFÉRENTS, puisque tout l'état voyageait
// à chaque message. Le travail du plus lent disparaissait sans conflit visible.
//
// Ces tests portent sur la règle d'arbitrage elle-même, sans réseau ni store :
// c'est elle qui décide qui garde son travail.

import { describe, it, expect } from "vitest";
import { diffScenes, applyOps } from "./forgeOps";
import type { SceneSnapshot } from "./forgeSceneStore";

const obj = (id: string, x = 0) => ({
  id, model: "/m.glb",
  pos: [x, 0, 0] as [number, number, number],
  rot: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
});

const scene = (over: Partial<SceneSnapshot> = {}): SceneSnapshot =>
  ({ objects: [], waters: [], ...over }) as SceneSnapshot;

describe("diffScenes", () => {
  it("ne produit RIEN quand rien ne change", () => {
    const s = scene({ objects: [obj("a")] });
    expect(diffScenes(s, s)).toEqual([]);
  });

  it("repère une création", () => {
    const ops = diffScenes(scene(), scene({ objects: [obj("a")] }));
    expect(ops).toEqual([{ op: "upsert", coll: "objects", items: [obj("a")] }]);
  });

  it("repère une modification, et ELLE SEULE", () => {
    const avant = scene({ objects: [obj("a", 0), obj("b", 5)] });
    const apres = scene({ objects: [obj("a", 9), obj("b", 5)] });
    const ops = diffScenes(avant, apres);
    // `b` n'a pas bougé : il ne doit pas voyager.
    expect(ops).toEqual([{ op: "upsert", coll: "objects", items: [obj("a", 9)] }]);
  });

  it("repère une suppression", () => {
    const ops = diffScenes(scene({ objects: [obj("a")] }), scene());
    expect(ops).toEqual([{ op: "remove", coll: "objects", ids: ["a"] }]);
  });

  it("repère un changement d'ambiance sans toucher aux objets", () => {
    const avant = scene({ objects: [obj("a")] });
    const apres = scene({ objects: [obj("a")], weather: { sunAngle: 10, preset: "night", fogDensity: 0, shadows: true } });
    const ops = diffScenes(avant, apres);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: "set" });
  });

  it("part d'une base nulle sans planter (première diffusion)", () => {
    const ops = diffScenes(null, scene({ objects: [obj("a")] }));
    expect(ops).toEqual([{ op: "upsert", coll: "objects", items: [obj("a")] }]);
  });
});

describe("applyOps", () => {
  it("crée, modifie et supprime", () => {
    let s = scene({ objects: [obj("a")] });
    s = applyOps(s, [{ op: "upsert", coll: "objects", items: [obj("b")] }]);
    expect(s.objects.map((o) => o.id)).toEqual(["a", "b"]);

    s = applyOps(s, [{ op: "upsert", coll: "objects", items: [obj("a", 7)] }]);
    expect(s.objects.find((o) => o.id === "a")!.pos[0]).toBe(7);

    s = applyOps(s, [{ op: "remove", coll: "objects", ids: ["a"] }]);
    expect(s.objects.map((o) => o.id)).toEqual(["b"]);
  });

  it("ne mute pas l'entrée", () => {
    const s = scene({ objects: [obj("a")] });
    applyOps(s, [{ op: "remove", coll: "objects", ids: ["a"] }]);
    expect(s.objects).toHaveLength(1);
  });
});

describe("Co-édition — le test qui compte", () => {
  it("deux éditeurs déplaçant des objets DIFFÉRENTS gardent chacun leur travail", () => {
    // État partagé de départ.
    const base = scene({ objects: [obj("a", 0), obj("b", 0)] });

    // Alice bouge `a`, Bob bouge `b`, chacun de son côté.
    const chezAlice = scene({ objects: [obj("a", 10), obj("b", 0)] });
    const chezBob = scene({ objects: [obj("a", 0), obj("b", 20)] });

    const opsAlice = diffScenes(base, chezAlice);
    const opsBob = diffScenes(base, chezBob);

    // Chacun reçoit les opérations de l'autre et les fusionne dans SON état.
    const finalAlice = applyOps(chezAlice, opsBob);
    const finalBob = applyOps(chezBob, opsAlice);

    // Avec l'ancien snapshot complet, le dernier message écrasait tout : l'un des
    // deux déplacements était perdu. Ici les deux survivent, des deux côtés.
    for (const [qui, s] of [["Alice", finalAlice], ["Bob", finalBob]] as const) {
      expect(s.objects.find((o) => o.id === "a")!.pos[0], `${qui} garde le déplacement d'Alice`).toBe(10);
      expect(s.objects.find((o) => o.id === "b")!.pos[0], `${qui} garde le déplacement de Bob`).toBe(20);
    }

    // Et les deux convergent vers le MÊME état — pas seulement « chacun le sien ».
    expect(finalAlice.objects).toEqual(finalBob.objects);
  });

  it("sur le MÊME objet, le dernier appliqué gagne — sans effacer le reste", () => {
    const base = scene({ objects: [obj("a", 0), obj("b", 0)] });
    const opsAlice = diffScenes(base, scene({ objects: [obj("a", 10), obj("b", 0)] }));
    const opsBob = diffScenes(base, scene({ objects: [obj("a", 99), obj("b", 5)] }));

    const fusion = applyOps(applyOps(base, opsAlice), opsBob);
    // Conflit réel sur `a` : Bob arrive après, il l'emporte. Acceptable.
    expect(fusion.objects.find((o) => o.id === "a")!.pos[0]).toBe(99);
    // Mais le déplacement de `b` par Bob ne coûte rien à personne.
    expect(fusion.objects.find((o) => o.id === "b")!.pos[0]).toBe(5);
  });

  it("une suppression distante ne réapparaît pas au diff suivant", () => {
    const base = scene({ objects: [obj("a"), obj("b")] });
    const ops = diffScenes(base, scene({ objects: [obj("a")] }));
    const apres = applyOps(base, ops);
    // Une fois la suppression appliquée, l'état est stable : plus rien à diffuser.
    expect(diffScenes(apres, apres)).toEqual([]);
    expect(apres.objects.map((o) => o.id)).toEqual(["a"]);
  });
});
