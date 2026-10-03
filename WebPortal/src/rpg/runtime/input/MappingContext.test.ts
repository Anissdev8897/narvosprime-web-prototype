import { describe, it, expect } from "vitest";
import { MappingContext, MappingContextManager } from "./MappingContext";
import { EContextPriority } from "./types";

describe("MappingContext", () => {
  it("crée un contexte avec priorité", () => {
    const ctx = new MappingContext("game", EContextPriority.Game);
    expect(ctx.name).toBe("game");
    expect(ctx.priority).toBe(EContextPriority.Game);
    expect(ctx.active).toBe(false);
  });

  it("active/désactive", () => {
    const ctx = new MappingContext("test", EContextPriority.UI);
    expect(ctx.active).toBe(false);
    ctx.activate();
    expect(ctx.active).toBe(true);
    ctx.deactivate();
    expect(ctx.active).toBe(false);
  });

  it("gère les mappings", () => {
    const ctx = new MappingContext("game", EContextPriority.Game);
    ctx.setMapping("move", { keys: ["KeyW", "KeyS", "KeyA", "KeyD"] });

    const mapping = ctx.getMapping("move");
    expect(mapping).toBeDefined();
    expect(mapping!.keys).toEqual(["KeyW", "KeyS", "KeyA", "KeyD"]);

    expect(ctx.getMapping("nonexistent")).toBeUndefined();
  });

  it("supprime un mapping", () => {
    const ctx = new MappingContext("game", EContextPriority.Game);
    ctx.setMapping("jump", { keys: ["Space"] });
    ctx.removeMapping("jump");
    expect(ctx.getMapping("jump")).toBeUndefined();
  });

  it("vide tous les mappings", () => {
    const ctx = new MappingContext("game", EContextPriority.Game);
    ctx.setMapping("a", { keys: ["KeyA"] });
    ctx.setMapping("b", { keys: ["KeyB"] });
    ctx.clear();
    expect(ctx.getMapping("a")).toBeUndefined();
    expect(ctx.getMapping("b")).toBeUndefined();
  });

  it("liste les IDs d'actions", () => {
    const ctx = new MappingContext("game", EContextPriority.Game);
    ctx.setMapping("move", { keys: [] });
    ctx.setMapping("jump", { keys: [] });
    const ids = [...ctx.actionIds];
    expect(ids).toEqual(expect.arrayContaining(["move", "jump"]));
  });
});

describe("MappingContextManager", () => {
  it("ajoute et récupère des contextes", () => {
    const mgr = new MappingContextManager();
    const ctx = new MappingContext("game", EContextPriority.Game);
    mgr.addContext(ctx);
    expect(mgr.getContext("game")).toBe(ctx);
    expect(mgr.getContext("nonexistent")).toBeUndefined();
  });

  it("remplace un contexte existant par le nom", () => {
    const mgr = new MappingContextManager();
    mgr.addContext(new MappingContext("game", EContextPriority.Game));
    const ctx2 = new MappingContext("game", EContextPriority.Menu);
    mgr.addContext(ctx2);
    expect(mgr.getContext("game")!.priority).toBe(EContextPriority.Menu);
  });

  it("supprime un contexte", () => {
    const mgr = new MappingContextManager();
    mgr.addContext(new MappingContext("game", EContextPriority.Game));
    mgr.removeContext("game");
    expect(mgr.getContext("game")).toBeUndefined();
  });

  it("résout le mapping du contexte actif de plus haute priorité", () => {
    const mgr = new MappingContextManager();

    // Le contexte 'menu' a une priorité plus basse que 'game'
    const menu = new MappingContext("menu", EContextPriority.Menu);
    menu.setMapping("jump", { keys: ["Escape"] });
    mgr.addContext(menu);

    const game = new MappingContext("game", EContextPriority.Game);
    game.setMapping("jump", { keys: ["Space"] });
    mgr.addContext(game);

    // Les deux sont inactifs → pas de résolution
    expect(mgr.resolveMapping("jump")).toBeUndefined();

    // Active seulement menu
    menu.activate();
    const r1 = mgr.resolveMapping("jump");
    expect(r1).toBeDefined();
    expect(r1!.keys).toEqual(["Escape"]);

    // Active game (priorité supérieure)
    game.activate();
    const r2 = mgr.resolveMapping("jump");
    expect(r2).toBeDefined();
    expect(r2!.keys).toEqual(["Space"]);
  });

  it("retourne undefined si aucun contexte actif n'a le mapping", () => {
    const mgr = new MappingContextManager();
    mgr.addContext(new MappingContext("game", EContextPriority.Game));
    expect(mgr.resolveMapping("nonexistent")).toBeUndefined();
  });

  it("activateOnly désactive tous les autres contextes", () => {
    const mgr = new MappingContextManager();
    mgr.addContext(new MappingContext("a", EContextPriority.UI));
    mgr.addContext(new MappingContext("b", EContextPriority.Menu));
    mgr.addContext(new MappingContext("c", EContextPriority.Game));

    mgr.activate("a");
    mgr.activate("b");
    expect(mgr.activeContexts).toContain("a");
    expect(mgr.activeContexts).toContain("b");

    mgr.activateOnly(["c"]);
    expect(mgr.activeContexts).toEqual(["c"]);
  });

  it("deactivateAll désactive tout", () => {
    const mgr = new MappingContextManager();
    mgr.addContext(new MappingContext("a", EContextPriority.UI));
    mgr.addContext(new MappingContext("b", EContextPriority.Game));
    mgr.activate("a");
    mgr.activate("b");
    mgr.deactivateAll();
    expect(mgr.activeContexts).toEqual([]);
  });

  it("gère la priorité effective", () => {
    const mgr = new MappingContextManager();
    mgr.addContext(new MappingContext("game", EContextPriority.Game));
    mgr.addContext(new MappingContext("menu", EContextPriority.Menu));

    // Aucun actif → UI (priorité la plus faible)
    expect(mgr.effectivePriority).toBe(EContextPriority.UI);

    mgr.activate("menu");
    expect(mgr.effectivePriority).toBe(EContextPriority.Menu);

    mgr.activate("game");
    expect(mgr.effectivePriority).toBe(EContextPriority.Game);
  });

  it("hasAction vérifie la présence d'un mapping dans un contexte actif", () => {
    const mgr = new MappingContextManager();
    const game = new MappingContext("game", EContextPriority.Game);
    game.setMapping("move", { keys: ["KeyW"] });
    mgr.addContext(game);
    game.activate();

    expect(mgr.hasAction("move")).toBe(true);
    expect(mgr.hasAction("jump")).toBe(false);
  });
});
