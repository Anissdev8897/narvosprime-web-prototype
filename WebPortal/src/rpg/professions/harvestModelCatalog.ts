// professions/harvestModelCatalog.ts — Catalogue des MODÈLES 3D de récolte (nature).
//
// Remplace les visuels procéduraux (arbres/buissons) par de vrais GLB issus de
// public/models/nature/retro_nature_pack. Chaque nœud pioche un modèle de façon
// DÉTERMINISTE par son id → variété visuelle stable (le même nœud garde son arbre
// entre les sessions / respawns).
//
// ⚠️ Les GLB retro n'ont NI matériau NI texture embarqués (0 images dans le glTF),
// seulement des UV (TEXCOORD_0) → ils DOIVENT recevoir la texture saisonnière externe,
// sinon ils s'affichent en couleur unie. On câble la variante « été ».
// Nommage incohérent du pack : arbres = tree01_summer.png (zéro-paddé) MAIS
// buissons = bush1_summer.png (sans zéro) → on stocke les paires explicitement.
//
// Note : les « 24 Free Ores and Minerals » sont des PNG (icônes 2D), pas des meshes —
// le métier MINEUR conserve donc son rocher procédural (voir HarvestNode.tsx).

import { useGLTF, useTexture } from "@react-three/drei";

const RETRO_GLB = "/models/nature/retro_nature_pack/models/glTF";
const RETRO_TEX = "/models/nature/retro_nature_pack/textures";

/** Un modèle de récolte = un GLB (géométrie + UV) + sa texture d'été externe. */
export interface HarvestModel { glb: string; tex: string; }

/** Arbres (bûcheron) — 8 variantes, texture d'été. */
export const TREE_MODELS: HarvestModel[] = Array.from({ length: 8 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0"); // tree01..tree08
  return { glb: `${RETRO_GLB}/trees/tree${n}.glb`, tex: `${RETRO_TEX}/trees/tree${n}_summer.png` };
});

/** Buissons (récolteur) — 8 variantes. GLB zéro-paddé, texture SANS zéro (bush1…). */
export const BUSH_MODELS: HarvestModel[] = Array.from({ length: 8 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0"); // bush01..bush08
  return { glb: `${RETRO_GLB}/bushes/bush${n}.glb`, tex: `${RETRO_TEX}/bushes/bush${i + 1}_summer.png` };
});

/** Hauteur cible (m) à laquelle le modèle est normalisé (indépendant de l'échelle source). */
export const TREE_TARGET_HEIGHT = 5.0;
export const BUSH_TARGET_HEIGHT = 1.1;

/** Hash stable d'un id → entier positif (variété déterministe, pas d'aléatoire). */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Choisit un modèle de la liste de façon déterministe par id de nœud. */
export function pickHarvestModel(list: HarvestModel[], id: string): HarvestModel {
  return list[hashId(id) % list.length];
}

/** Précharge tous les modèles + textures de récolte (évite un hitch au 1er rendu). */
export function preloadHarvestModels(): void {
  for (const m of [...TREE_MODELS, ...BUSH_MODELS]) {
    useGLTF.preload(m.glb);
    useTexture.preload(m.tex);
  }
}
