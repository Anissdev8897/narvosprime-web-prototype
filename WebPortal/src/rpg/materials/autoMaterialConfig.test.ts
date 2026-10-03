import { describe, it, expect } from "vitest";
import {
  slopeOf, layerWeights, smoothstep, FORGE_AUTO_MATERIAL,
  TERRAIN_LAYERS, TERRAIN_LAYER_ORDER, buildAutoMaterial,
} from "./autoMaterialConfig";
import fs from "node:fs";
import path from "node:path";

describe("slopeOf", () => {
  it("retourne 0 pour une face horizontale", () => {
    expect(slopeOf(1)).toBe(0);
  });

  it("retourne 1 pour une face verticale", () => {
    expect(slopeOf(0)).toBe(1);
  });

  it("traite un plafond comme une face plate", () => {
    // Cette map est pleine d'arches et de surplombs. Sans la valeur absolue,
    // leur face inférieure (normalY = -1) serait vue comme verticale et
    // recevrait de la roche de paroi sur une surface pourtant horizontale.
    expect(slopeOf(-1)).toBe(0);
    expect(slopeOf(-0.5)).toBeCloseTo(slopeOf(0.5));
  });

  it("borne à 1 même si la normale n'est pas unitaire", () => {
    expect(slopeOf(1.4)).toBe(0);
    expect(slopeOf(-2)).toBe(0);
  });
});

describe("smoothstep", () => {
  it("sature aux deux bornes", () => {
    expect(smoothstep(0.2, 0.6, 0.1)).toBe(0);
    expect(smoothstep(0.2, 0.6, 0.9)).toBe(1);
  });

  it("vaut 0,5 au milieu", () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
  });

  it("ne divise pas par zéro quand les bornes sont égales", () => {
    expect(smoothstep(0.5, 0.5, 0.4)).toBe(0);
    expect(smoothstep(0.5, 0.5, 0.6)).toBe(1);
  });
});

describe("layerWeights", () => {
  const cfg = { slopeStart: 0.2, slopeEnd: 0.6, mid: FORGE_AUTO_MATERIAL.mid };

  it("somme toujours à 1", () => {
    // C'est la propriété qui garantit qu'aucune zone ne s'assombrit ni ne
    // sature au passage d'une couche à l'autre. Un mélange dont les poids ne
    // somment pas à 1 produit une bande visible sur toute la ligne de crête.
    for (let s = 0; s <= 1.0001; s += 0.05) {
      const w = layerWeights(s, cfg);
      expect(w.flat + w.mid + w.steep).toBeCloseTo(1, 6);
    }
  });

  it("donne 100 % de plat sous le seuil bas", () => {
    const w = layerWeights(0.1, cfg);
    expect(w.flat).toBeCloseTo(1);
    expect(w.mid).toBeCloseTo(0);
    expect(w.steep).toBeCloseTo(0);
  });

  it("donne 100 % de paroi au-dessus du seuil haut", () => {
    const w = layerWeights(0.8, cfg);
    expect(w.steep).toBeCloseTo(1);
    expect(w.flat).toBeCloseTo(0);
  });

  it("fait culminer la couche intermédiaire au milieu de la transition", () => {
    const mid = layerWeights(0.4, cfg).mid;
    expect(mid).toBeGreaterThan(layerWeights(0.25, cfg).mid);
    expect(mid).toBeGreaterThan(layerWeights(0.55, cfg).mid);
    expect(mid).toBeCloseTo(1, 5); // 4t(1-t) vaut 1 en t = 0,5
  });

  it("n'émet aucun poids intermédiaire quand la couche est absente", () => {
    const w = layerWeights(0.4, { slopeStart: 0.2, slopeEnd: 0.6, mid: undefined });
    expect(w.mid).toBe(0);
    expect(w.flat + w.steep).toBeCloseTo(1);
  });

  it("ne produit jamais de poids négatif", () => {
    for (let s = -0.5; s <= 1.5; s += 0.05) {
      const w = layerWeights(s, cfg);
      expect(w.flat).toBeGreaterThanOrEqual(0);
      expect(w.mid).toBeGreaterThanOrEqual(0);
      expect(w.steep).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("FORGE_AUTO_MATERIAL", () => {
  it("a des seuils ordonnés", () => {
    expect(FORGE_AUTO_MATERIAL.slopeStart).toBeLessThan(FORGE_AUTO_MATERIAL.slopeEnd);
  });

  it("tuile la variation BEAUCOUP plus large que les couches", () => {
    // Le masque de variation ne sert qu'à casser la répétition. S'il tuile à la
    // même échelle que les couches, il ajoute un motif au lieu d'en supprimer un.
    const maxLayer = Math.max(
      FORGE_AUTO_MATERIAL.flat.tileSize,
      FORGE_AUTO_MATERIAL.steep.tileSize,
      FORGE_AUTO_MATERIAL.mid?.tileSize ?? 0,
    );
    expect(FORGE_AUTO_MATERIAL.variationTileSize).toBeGreaterThan(maxLayer * 10);
  });

  it("garde la perturbation de variation plus petite que la transition", () => {
    // Sinon la variation peut à elle seule faire basculer une face plate en
    // paroi, et l'on voit des taches de roche au milieu d'un plateau.
    const band = FORGE_AUTO_MATERIAL.slopeEnd - FORGE_AUTO_MATERIAL.slopeStart;
    expect(FORGE_AUTO_MATERIAL.variationStrength).toBeLessThan(band);
  });
});

describe("bibliothèque de couches de terrain", () => {
  it("expose les 5 matières demandées pour l'éditeur Forge", () => {
    // herbe / roche / sable / neige / terre — le pack MW les contient toutes,
    // mais seules 3 avaient été converties en KTX2. Ce test verrouille le fait
    // qu'aucune ne redisparaisse silencieusement de la bibliothèque.
    for (const id of ["herbe", "roche", "sable_clair", "neige", "terre"] as const) {
      expect(TERRAIN_LAYERS[id], `couche manquante : ${id}`).toBeDefined();
    }
  });

  it("chaque couche pointe vers un .ktx2 réellement présent sur le disque", () => {
    // Le fallback SPA de Vite renvoie du text/html en 200 pour un fichier absent
    // (cf. CLAUDE.md) : un chemin faux ne lève PAS de 404, il produit une texture
    // silencieusement vide. Le seul moment où on peut l'attraper, c'est ici.
    const pub = path.resolve(__dirname, "../../../public");
    const missing: string[] = [];
    for (const [id, layer] of Object.entries(TERRAIN_LAYERS)) {
      for (const f of [layer.colorMap, layer.normalMap]) {
        if (!f) continue;
        if (!fs.existsSync(path.join(pub, f))) missing.push(`${id} → ${f}`);
      }
    }
    expect(missing, `textures absentes : ${missing.join(" · ")}`).toEqual([]);
  });

  it("l'ordre d'affichage couvre toute la bibliothèque, sans doublon", () => {
    expect([...TERRAIN_LAYER_ORDER].sort()).toEqual(Object.keys(TERRAIN_LAYERS).sort());
  });

  it("buildAutoMaterial reproduit exactement le préréglage Forge", () => {
    // Garde contre la dérive : si quelqu'un retouche FORGE_AUTO_MATERIAL à la
    // main sans toucher la bibliothèque, l'éditeur et le jeu ne peindraient plus
    // la même chose à partir des mêmes couches.
    const built = buildAutoMaterial("neige", "roche", "cailloux");
    expect(built).toEqual(FORGE_AUTO_MATERIAL);
  });

  it("respecte les surcharges de pente", () => {
    const built = buildAutoMaterial("herbe", "roche", undefined, { slopeStart: 0.3, slopeEnd: 0.6 });
    expect(built.slopeStart).toBe(0.3);
    expect(built.slopeEnd).toBe(0.6);
    expect(built.mid).toBeUndefined();
  });
});
