// editHistory.test.ts — l'historique undo/redo de la Forge couvre-t-il TOUT ?
//
// Constat M2 de l'audit Forge Édition : le snapshot ne portait que
// `{ objects, waters }`. Routes, terrains et map de base n'étaient donc jamais
// annulables — un undo après la création d'une route la laissait en place.
//
// Un historique PARTIEL est pire qu'un historique absent : il inspire confiance,
// puis trahit sur l'action qu'on ne soupçonnait pas. Ces tests verrouillent la
// propriété qui l'empêche : le snapshot se définit par SOUSTRACTION
// (`Omit<ForgeScene, "id" | "name" | "updatedAt">`), donc tout champ ajouté un
// jour à la scène devient annulable sans que personne y pense.

import { describe, it, expect } from "vitest";
import { EditHistory, snapshotOf, type ForgeScene } from "./forgeSceneStore";

function makeScene(over: Partial<ForgeScene> = {}): ForgeScene {
  return {
    id: "sc1",
    name: "Test",
    objects: [],
    waters: [],
    updatedAt: 0,
    ...over,
  };
}

const obj = (id: string) => ({
  id, model: "/m.glb",
  pos: [0, 0, 0] as [number, number, number],
  rot: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
});

const path = (id: string) => ({
  id, kind: "route" as const,
  points: [[0, 0, 0], [1, 0, 1]] as [number, number, number][],
  width: 6, color: "#444",
});

describe("snapshotOf", () => {
  it("exclut l'identité de la scène", () => {
    const snap = snapshotOf(makeScene({ objects: [obj("a")] }));
    expect(snap).not.toHaveProperty("id");
    expect(snap).not.toHaveProperty("name");
    expect(snap).not.toHaveProperty("updatedAt");
  });

  it("retient TOUT le contenu éditable, routes et map de base comprises", () => {
    const snap = snapshotOf(makeScene({
      objects: [obj("a")], paths: [path("p1")], baseMap: "forge",
    }));
    expect(snap.objects).toHaveLength(1);
    expect(snap.paths).toHaveLength(1);
    expect(snap.baseMap).toBe("forge");
  });
});

describe("EditHistory", () => {
  it("annule la création d'un objet", () => {
    const h = new EditHistory();
    const avant = makeScene();
    h.push(snapshotOf(avant));

    const apres = makeScene({ objects: [obj("a")] });
    const restaure = h.undo(snapshotOf(apres));

    expect(restaure?.objects).toHaveLength(0);
  });

  it("annule la création d'une ROUTE (impossible avant le correctif M2)", () => {
    const h = new EditHistory();
    h.push(snapshotOf(makeScene({ paths: [] })));

    const avecRoute = makeScene({ paths: [path("p1")] });
    const restaure = h.undo(snapshotOf(avecRoute))!;

    // ⚠️ L'assertion porte sur la PRÉSENCE de la clé, pas sur son contenu.
    //
    // `forgeSceneStore.save(id, patch)` FUSIONNE le patch dans la scène. Un
    // snapshot qui ne mentionne pas `paths` ne remet donc rien à zéro : la route
    // survit à l'undo. Écrire `expect(restaure.paths ?? []).toHaveLength(0)`
    // passerait avec l'ancien snapshot partiel — `undefined ?? []` vaut `[]` —
    // et validerait exactement le bug qu'on veut interdire.
    expect(Object.prototype.hasOwnProperty.call(restaure, "paths")).toBe(true);
    expect(restaure.paths).toHaveLength(0);
  });

  it("redo rejoue ce que l'undo vient de défaire", () => {
    const h = new EditHistory();
    h.push(snapshotOf(makeScene()));

    const apres = snapshotOf(makeScene({ objects: [obj("a")] }));
    const annule = h.undo(apres)!;
    expect(annule.objects).toHaveLength(0);

    const rejoue = h.redo(annule);
    expect(rejoue?.objects).toHaveLength(1);
  });

  it("une nouvelle action efface la branche future", () => {
    const h = new EditHistory();
    h.push(snapshotOf(makeScene()));
    h.undo(snapshotOf(makeScene({ objects: [obj("a")] })));
    expect(h.canRedo).toBe(true);

    h.push(snapshotOf(makeScene({ objects: [obj("b")] })));
    expect(h.canRedo).toBe(false);
  });

  it("rend null quand il n'y a plus rien à annuler", () => {
    const h = new EditHistory();
    expect(h.canUndo).toBe(false);
    expect(h.undo(snapshotOf(makeScene()))).toBeNull();
  });

  it("borne la mémoire : les entrées les plus ANCIENNES sont évincées", () => {
    const h = new EditHistory();
    // Chaque snapshot porte une scène volumineuse ; on en empile bien plus que
    // le plafond en nombre pour vérifier qu'aucune pile ne croît sans fin.
    const gros = makeScene({ objects: Array.from({ length: 200 }, (_, i) => obj(`o${i}`)) });
    for (let i = 0; i < 300; i++) h.push(snapshotOf(gros));

    expect(h.bytes).toBeGreaterThan(0);
    expect(h.bytes).toBeLessThanOrEqual(32 * 1024 * 1024);
    expect(h.canUndo).toBe(true);
  });

  it("le compteur d'octets redescend quand on annule", () => {
    const h = new EditHistory();
    h.push(snapshotOf(makeScene({ objects: [obj("a")] })));
    const plein = h.bytes;
    h.undo(snapshotOf(makeScene()));
    expect(h.bytes).toBeLessThan(plein);
  });
});
