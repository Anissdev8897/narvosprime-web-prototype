import { describe, it, expect, beforeEach } from "vitest";
import {
  sanitize, toConfig, DEFAULT_SELECTION,
  getTerrainSelection, setTerrainSelection, resetTerrainSelection,
} from "./terrainMaterialStore";
import { FORGE_AUTO_MATERIAL, TERRAIN_LAYERS } from "./autoMaterialConfig";
import {
  autoMaterialGeneration, getAutoMaterialConfig, disposeStaleAutoMaterials,
  __registerLiveMaterialForTest, isLandscapeFallback,
} from "./autoMaterialStore";
import * as THREE from "three";

beforeEach(() => { resetTerrainSelection(); });

describe("sanitize", () => {
  it("retombe sur le défaut pour une entrée qui n'est pas un objet", () => {
    expect(sanitize(null)).toEqual(DEFAULT_SELECTION);
    expect(sanitize("neige")).toEqual(DEFAULT_SELECTION);
    expect(sanitize(42)).toEqual(DEFAULT_SELECTION);
  });

  it("rejette une couche inconnue sans casser le reste", () => {
    // Cas réel : le stockage local survit aux mises à jour du jeu. Une couche
    // retirée entre deux versions y resterait indéfiniment et produirait un
    // `undefined` au moment de construire la config — loin de la cause.
    const s = sanitize({ ...DEFAULT_SELECTION, flat: "lave_en_fusion" });
    expect(s.flat).toBe(DEFAULT_SELECTION.flat);
    expect(s.steep).toBe(DEFAULT_SELECTION.steep);
  });

  it("accepte null pour la couche de transition", () => {
    expect(sanitize({ ...DEFAULT_SELECTION, mid: null }).mid).toBeNull();
  });

  it("garde slopeEnd strictement au-dessus de slopeStart", () => {
    // À égalité, le smoothstep divise par zéro : la frontière devient une arête
    // franche qui suit les triangles — exactement le défaut visuel qu'on a mis
    // des heures à écarter en le prenant pour de la géométrie manquante.
    const s = sanitize({ ...DEFAULT_SELECTION, slopeStart: 0.5, slopeEnd: 0.5 });
    expect(s.slopeEnd).toBeGreaterThan(s.slopeStart);

    const inverse = sanitize({ ...DEFAULT_SELECTION, slopeStart: 0.8, slopeEnd: 0.2 });
    expect(inverse.slopeEnd).toBeGreaterThan(inverse.slopeStart);
  });

  it("borne les valeurs numériques hors plage", () => {
    const s = sanitize({ ...DEFAULT_SELECTION, slopeStart: -3, variationStrength: 99 });
    expect(s.slopeStart).toBe(0);
    expect(s.variationStrength).toBeLessThanOrEqual(0.5);
  });

  it("ignore un NaN plutôt que de le propager dans le shader", () => {
    const s = sanitize({ ...DEFAULT_SELECTION, slopeStart: NaN });
    expect(Number.isFinite(s.slopeStart)).toBe(true);
  });
});

describe("toConfig", () => {
  it("la sélection par défaut reproduit exactement le préréglage Forge", () => {
    expect(toConfig(DEFAULT_SELECTION)).toEqual(FORGE_AUTO_MATERIAL);
  });

  it("traduit les identifiants en chemins de textures réels", () => {
    const cfg = toConfig({ ...DEFAULT_SELECTION, flat: "herbe", steep: "terre", mid: null });
    expect(cfg.flat.colorMap).toBe(TERRAIN_LAYERS.herbe.colorMap);
    expect(cfg.steep.colorMap).toBe(TERRAIN_LAYERS.terre.colorMap);
    expect(cfg.mid).toBeUndefined();
  });

  it("reporte la taille de carreau propre à chaque matière", () => {
    const cfg = toConfig({ ...DEFAULT_SELECTION, flat: "sable_clair" });
    expect(cfg.flat.tileSize).toBe(TERRAIN_LAYERS.sable_clair.tileSize);
  });
});

describe("setTerrainSelection", () => {
  it("fusionne une modification partielle sans perdre le reste", () => {
    setTerrainSelection({ flat: "herbe" });
    const s = getTerrainSelection();
    expect(s.flat).toBe("herbe");
    expect(s.steep).toBe(DEFAULT_SELECTION.steep);
    expect(s.mid).toBe(DEFAULT_SELECTION.mid);
  });

  it("incrémente la génération — c'est ce qui déclenche le repeint des chunks", () => {
    const before = autoMaterialGeneration();
    setTerrainSelection({ flat: "sable_ocre" });
    expect(autoMaterialGeneration()).toBeGreaterThan(before);
  });

  it("pousse la nouvelle config dans le store d'auto-material", () => {
    setTerrainSelection({ flat: "terre" });
    expect(getAutoMaterialConfig().flat.colorMap).toBe(TERRAIN_LAYERS.terre.colorMap);
  });

  it("valide aussi ce qui arrive par l'UI, pas seulement ce qui vient du disque", () => {
    setTerrainSelection({ slopeStart: 0.9, slopeEnd: 0.1 });
    const s = getTerrainSelection();
    expect(s.slopeEnd).toBeGreaterThan(s.slopeStart);
  });

  it("resetTerrainSelection revient au préréglage Forge", () => {
    setTerrainSelection({ flat: "herbe", steep: "sable_ocre", mid: null, slopeStart: 0.7 });
    resetTerrainSelection();
    expect(getTerrainSelection()).toEqual(DEFAULT_SELECTION);
    expect(getAutoMaterialConfig()).toEqual(FORGE_AUTO_MATERIAL);
  });
});

describe("libération GPU des matériaux périmés", () => {
  it("ne libère rien tant qu'aucune config n'a changé", () => {
    expect(disposeStaleAutoMaterials()).toBe(0);
  });

  it("les périmés ne sont PAS libérés au moment du changement de config", () => {
    // Timing critique : au moment de `setAutoMaterialConfig`, les meshes des
    // chunks pointent ENCORE sur les anciens matériaux. Les libérer là
    // laisserait des matériaux détruits attachés à des meshes rendus la même
    // frame. La libération appartient à la boucle de rendu, après le repeint.
    const fake = new THREE.MeshStandardMaterial();
    let disposed = false;
    fake.addEventListener("dispose", () => { disposed = true; });

    __registerLiveMaterialForTest(fake);
    setTerrainSelection({ flat: "herbe" });
    expect(disposed, "libéré trop tôt").toBe(false);

    expect(disposeStaleAutoMaterials()).toBe(1);
    expect(disposed).toBe(true);
  });
});

describe("Landscape Unreal sans matériau", () => {
  // Mesuré sur la Forge réimportée : 10 primitives portent `WorldGridMaterial`,
  // 536 494 triangles (26 % de la map), TOUTES nommées Landscape*Component_*.
  it("reconnaît un composant de Landscape sans matériau", () => {
    expect(isLandscapeFallback("LandscapeComponent_4", "WorldGridMaterial")).toBe(true);
    expect(isLandscapeFallback("LandscapeNaniteComponent_0", "WorldGridMaterial")).toBe(true);
  });

  it("laisse tranquille un Landscape qui A un vrai matériau", () => {
    // Ceux-là sortent déjà texturés d'Unreal : les repeindre écraserait un
    // matériau que l'artiste a bel et bien assigné.
    expect(isLandscapeFallback("LandscapeComponent_4", "MTL_MWAM_Landscape_IslandExample")).toBe(false);
  });

  it("ne touche AUCUN autre objet portant le matériau par défaut", () => {
    // Le garde-fou qui compte : un décor sans matériau doit rester gris, pas
    // devenir de la neige. La mesure dit qu'il n'y en a pas aujourd'hui — ce
    // test empêche qu'un futur export en fasse apparaître sans qu'on le voie.
    for (const nom of ["-object1310___ff_unearthed", "Plane", "zone_a_box10", "LandscapeRock_01"]) {
      expect(isLandscapeFallback(nom, "WorldGridMaterial"), nom).toBe(false);
    }
  });

  it("supporte les noms manquants sans lever", () => {
    expect(isLandscapeFallback(undefined, "WorldGridMaterial")).toBe(false);
    expect(isLandscapeFallback("LandscapeComponent_1", undefined)).toBe(false);
  });
});
