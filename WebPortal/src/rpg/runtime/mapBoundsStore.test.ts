import { describe, it, expect, beforeEach } from "vitest";
import { mapBoundsStore, type MapWall } from "./mapBoundsStore";

/** Mur prêt à l'emploi — seuls les champs qui comptent pour le test sont passés. */
function mur(p: Partial<MapWall> = {}): Omit<MapWall, "id"> {
  return {
    label: "test",
    mode: "block",
    center: [0, 0, 0],
    size: [10, 10, 10],
    yaw: 0,
    enabled: true,
    ...p,
  };
}

beforeEach(() => mapBoundsStore.__resetForTest());

describe("mapBoundsStore — mode block (volume interdit)", () => {
  it("bloque à l'intérieur, laisse passer à l'extérieur", () => {
    mapBoundsStore.add("forge", mur());
    expect(mapBoundsStore.blocks("forge", 0, 0, 0)).toBe(true);
    expect(mapBoundsStore.blocks("forge", 100, 0, 0)).toBe(false);
  });

  it("le rayon du joueur ÉLARGIT le volume — on l'arrête avant le contact", () => {
    // Sans marge, le joueur pénètre le mur jusqu'à la moitié du corps avant que
    // son centre n'entre dans le volume. C'est visible à l'écran.
    mapBoundsStore.add("forge", mur());
    expect(mapBoundsStore.blocks("forge", 6, 0, 0, 0)).toBe(false);
    expect(mapBoundsStore.blocks("forge", 6, 0, 0, 2)).toBe(true);
  });

  it("teste AUSSI la hauteur — on passe au-dessus d'un volume bas", () => {
    // Un `block` est un obstacle réel : sauter par-dessus doit fonctionner,
    // sinon il se comporte comme un mur infini et rend des zones inatteignables.
    mapBoundsStore.add("forge", mur({ size: [10, 4, 10] }));
    expect(mapBoundsStore.blocks("forge", 0, 0, 0)).toBe(true);
    expect(mapBoundsStore.blocks("forge", 0, 50, 0)).toBe(false);
  });

  it("suit la rotation yaw", () => {
    // Mur long et fin, tourné à 90° : ce qui était bloqué sur X l'est sur Z.
    mapBoundsStore.add("forge", mur({ size: [100, 10, 2], yaw: Math.PI / 2 }));
    expect(mapBoundsStore.blocks("forge", 0, 0, 40)).toBe(true);
    expect(mapBoundsStore.blocks("forge", 40, 0, 0)).toBe(false);
  });
});

describe("mapBoundsStore — mode keepIn (limite de map)", () => {
  it("bloque DEHORS et laisse libre DEDANS — l'inverse de block", () => {
    mapBoundsStore.add("forge", mur({ mode: "keepIn", size: [100, 100, 100] }));
    expect(mapBoundsStore.blocks("forge", 0, 0, 0)).toBe(false);
    expect(mapBoundsStore.blocks("forge", 200, 0, 0)).toBe(true);
  });

  it("le rayon du joueur RÉTRÉCIT la zone permise", () => {
    mapBoundsStore.add("forge", mur({ mode: "keepIn", size: [100, 100, 100] }));
    expect(mapBoundsStore.blocks("forge", 49, 0, 0, 0)).toBe(false);
    expect(mapBoundsStore.blocks("forge", 49, 0, 0, 3)).toBe(true);
  });

  it("N'EST PAS un plafond — l'altitude ne bloque jamais", () => {
    // Le contrat qui compte. Si `keepIn` testait Y, sauter ou décoller
    // déclencherait la limite de map : le joueur se cognerait au ciel.
    mapBoundsStore.add("forge", mur({ mode: "keepIn", size: [100, 10, 100] }));
    expect(mapBoundsStore.blocks("forge", 0, 5000, 0)).toBe(false);
    expect(mapBoundsStore.blocks("forge", 0, -5000, 0)).toBe(false);
  });
});

describe("mapBoundsStore — édition", () => {
  it("un mur désactivé ne bloque plus, sans être supprimé", () => {
    const w = mapBoundsStore.add("forge", mur());
    expect(mapBoundsStore.blocks("forge", 0, 0, 0)).toBe(true);
    mapBoundsStore.update("forge", w.id, { enabled: false });
    expect(mapBoundsStore.blocks("forge", 0, 0, 0)).toBe(false);
    expect(mapBoundsStore.walls("forge")).toHaveLength(1);
  });

  it("déplacer un mur déplace la zone bloquée", () => {
    const w = mapBoundsStore.add("forge", mur());
    mapBoundsStore.update("forge", w.id, { center: [100, 0, 0] });
    expect(mapBoundsStore.blocks("forge", 0, 0, 0)).toBe(false);
    expect(mapBoundsStore.blocks("forge", 100, 0, 0)).toBe(true);
  });

  it("les maps sont indépendantes", () => {
    // Un mur posé sur la Forge ne doit pas cerner l'Orbital : c'est tout
    // l'intérêt de retirer la limite globale codée en dur.
    mapBoundsStore.add("forge", mur());
    expect(mapBoundsStore.blocks("orbital", 0, 0, 0)).toBe(false);
  });

  it("update/remove sur un id inconnu ne casse rien", () => {
    mapBoundsStore.update("forge", "fantome", { enabled: false });
    mapBoundsStore.remove("forge", "fantome");
    expect(mapBoundsStore.walls("forge")).toEqual([]);
  });
});

describe("mapBoundsStore — map active", () => {
  it("sans map active, rien n'est bloqué", () => {
    // Filet : si le runtime oublie `setActiveMap`, le joueur doit pouvoir
    // bouger librement — jamais se retrouver figé par des murs d'une autre map.
    mapBoundsStore.add("forge", mur());
    expect(mapBoundsStore.blocksActive(0, 0, 0)).toBe(false);
  });

  it("blocksActive lit les murs de la map déclarée", () => {
    mapBoundsStore.add("forge", mur());
    mapBoundsStore.setActiveMap("forge");
    expect(mapBoundsStore.blocksActive(0, 0, 0)).toBe(true);
    mapBoundsStore.setActiveMap("orbital");
    expect(mapBoundsStore.blocksActive(0, 0, 0)).toBe(false);
  });
});

describe("mapBoundsStore — altitude de chute", () => {
  it("sans réglage ni mur, rend le repli fourni par l'appelant", () => {
    // Le repli vient du SOL RÉEL de la map. C'est le remplacement direct de la
    // constante -50 qui, sur la Forge (sol à -27,8), ne laissait que 22 unités.
    expect(mapBoundsStore.fallFloor("forge", -80)).toBe(-80);
  });

  it("un réglage admin prime sur tout", () => {
    mapBoundsStore.setFallY("forge", -120);
    expect(mapBoundsStore.fallFloor("forge", -80)).toBe(-120);
  });

  it("à défaut, descend LARGEMENT sous la base du keepIn le plus bas", () => {
    mapBoundsStore.add("forge", mur({ mode: "keepIn", center: [0, 0, 0], size: [100, 60, 100] }));
    // base = 0 - 30 = -30 → seuil -330 (marge 300)
    expect(mapBoundsStore.fallFloor("forge", 999)).toBe(-330);
  });

  it("la marge est assez large pour ne pas gêner le déplacement normal", () => {
    // Régression mesurée : une marge de 20 avait donné un seuil à -38,18 pour un
    // sol d'apparition à -27,8, soit dix unités. Descendre d'un talus renvoyait
    // au départ. Le contrat : la marge dépasse largement un dénivelé de map.
    mapBoundsStore.add("forge", mur({ mode: "keepIn", center: [0, 0, 0], size: [100, 60, 100] }));
    const base = -30;
    expect(base - mapBoundsStore.fallFloor("forge", 999)).toBeGreaterThanOrEqual(200);
  });

  it("ignore les murs block et les murs désactivés pour ce calcul", () => {
    mapBoundsStore.add("forge", mur({ mode: "block", center: [0, -500, 0] }));
    const off = mapBoundsStore.add("forge", mur({ mode: "keepIn", center: [0, -900, 0] }));
    mapBoundsStore.update("forge", off.id, { enabled: false });
    expect(mapBoundsStore.fallFloor("forge", -80)).toBe(-80);
  });
});
