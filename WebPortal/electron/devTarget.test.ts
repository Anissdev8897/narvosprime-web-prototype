import { describe, it, expect } from "vitest";
import { portDev, cheminPrototype, resolveDevTarget, PORT_PAR_DEFAUT } from "./devTarget";

describe("portDev", () => {
  it("garde un port valide", () => {
    expect(portDev("3006")).toBe(3006);
    expect(portDev("1")).toBe(1);
    expect(portDev("65535")).toBe(65535);
  });

  it("retombe sur le port du jeu quand la variable est absente ou vide", () => {
    expect(portDev(undefined)).toBe(PORT_PAR_DEFAUT);
    expect(portDev("")).toBe(PORT_PAR_DEFAUT);
  });

  it("refuse tout ce qui n'est pas un nombre — c'est la liste blanche d'origine", () => {
    // Chacune de ces valeurs, interpolée telle quelle dans
    // `http://localhost:${x}`, produirait une origine ATTAQUANTE ou un
    // `will-navigate` qui n'autorise plus rien. D'où le refus strict.
    for (const hostile of ["3005 evil.com", "3005/../..", "3005#", "3005:80", "abc", "-1", "3e3"]) {
      expect(portDev(hostile), `« ${hostile} » doit être refusé`).toBe(PORT_PAR_DEFAUT);
    }
  });

  it("refuse un port hors plage TCP", () => {
    expect(portDev("0")).toBe(PORT_PAR_DEFAUT);
    expect(portDev("70000")).toBe(PORT_PAR_DEFAUT);
  });
});

describe("cheminPrototype", () => {
  it("construit le chemin d'un prototype nommé", () => {
    expect(cheminPrototype("Proto_editeur")).toBe("/Prototype/Proto_editeur/");
    expect(cheminPrototype("Proto_charactere")).toBe("/Prototype/Proto_charactere/");
  });

  it("« . » ouvre la page d'accueil des prototypes", () => {
    expect(cheminPrototype(".")).toBe("/Prototype/");
  });

  it("sans variable, ouvre le jeu", () => {
    expect(cheminPrototype(undefined)).toBe("/");
    expect(cheminPrototype("")).toBe("/");
  });

  it("refuse toute traversée ou injection de chemin", () => {
    for (const hostile of ["..", "../..", "a/b", "/etc/passwd", "http://evil.com", "Proto?x=1", "Proto#f"]) {
      expect(cheminPrototype(hostile), `« ${hostile} » doit ramener au jeu`).toBe("/");
    }
  });
});

describe("resolveDevTarget", () => {
  it("le jeu par défaut, sur 3005", () => {
    expect(resolveDevTarget({})).toEqual({
      origine: "http://localhost:3005",
      url: "http://localhost:3005/",
    });
  });

  it("un prototype sur son propre port", () => {
    expect(resolveDevTarget({ NARVOS_DEV_PORT: "3006", NARVOS_PROTO: "Proto_editeur" })).toEqual({
      origine: "http://localhost:3006",
      url: "http://localhost:3006/Prototype/Proto_editeur/",
    });
  });

  it("l'URL commence TOUJOURS par l'origine autorisée", () => {
    // C'est l'invariant qui protège `will-navigate` : si l'URL chargée pouvait
    // sortir de `origine`, la fenêtre bloquerait sa propre page — ou pire,
    // la liste blanche autoriserait autre chose que ce qu'on affiche.
    const cas = [
      {},
      { NARVOS_PROTO: "." },
      { NARVOS_PROTO: "../evil" },
      { NARVOS_DEV_PORT: "3005 evil.com", NARVOS_PROTO: "http://evil.com" },
    ];
    for (const env of cas) {
      const { origine, url } = resolveDevTarget(env);
      expect(url.startsWith(origine), `${JSON.stringify(env)} → ${url}`).toBe(true);
      expect(new URL(url).origin).toBe(origine);
    }
  });
});