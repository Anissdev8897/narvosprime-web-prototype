// nature/natureDecor.ts — décor naturel NON interactif (herbe, touffes) par map.
//
// Pur visuel : aucune collision, aucune récolte. Dispersé en INSTANCES (InstancedMesh
// → 1 draw call par type) et calé au sol. Les GLB retro n'ont pas de matériau → on
// applique la texture d'été externe (comme les arbres/buissons récoltables).

const RG = "/models/nature/retro_nature_pack/models/glTF/grass";
const RT = "/models/nature/retro_nature_pack/textures/grass";

export interface DecorModel { glb: string; tex: string; targetSize: number; }

export const DECOR_MODELS: Record<string, DecorModel> = {
  grass:    { glb: `${RG}/grass03.glb`,    tex: `${RT}/grass_summer.png`,       targetSize: 0.6 },
  grass2:   { glb: `${RG}/grass07.glb`,    tex: `${RT}/grass_summer.png`,       targetSize: 0.5 },
  patch:    { glb: `${RG}/grass_patch.glb`,tex: `${RT}/grass_patch_summer.png`, targetSize: 0.4 },
  bushdecor:{ glb: `${RG}/grass_bush.glb`, tex: `${RT}/grass_bush_summer.png`,  targetSize: 0.85 },
};

export interface DecorField {
  model: string;       // clé de DECOR_MODELS
  count: number;       // nombre d'instances
  cx: number; cz: number; radius: number; // zone de dispersion
  seed: number;        // graine déterministe (dispersion stable)
}

export const NATURE_DECOR: Record<string, DecorField[]> = {
  forge: [
    { model: "grass",     count: 130, cx: 0, cz: 0, radius: 46, seed: 1337 },
    { model: "grass2",    count: 90,  cx: 0, cz: 0, radius: 46, seed: 7331 },
    { model: "patch",     count: 34,  cx: 0, cz: 0, radius: 42, seed: 4242 },
    { model: "bushdecor", count: 20,  cx: 0, cz: 0, radius: 44, seed: 9001 },
  ],
  tower: [
    { model: "grass",     count: 70,  cx: 0, cz: 0, radius: 36, seed: 222 },
    { model: "patch",     count: 22,  cx: 0, cz: 0, radius: 32, seed: 555 },
  ],
};

export function natureDecorForMap(mapId: string): DecorField[] {
  return NATURE_DECOR[mapId] ?? [];
}

export function getDecorModel(id: string): DecorModel | undefined {
  return DECOR_MODELS[id];
}
