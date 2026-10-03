// rpg/loaders/ktx2.ts — décodage KTX2 / Basis Universal (textures GPU compressées).
//
// POURQUOI : les textures PNG/WebP sont DÉCOMPRESSÉES en RGBA brut en VRAM (un 4096²
// = 64 Mo, peu importe le poids du fichier). Les maps (Forge 112 Mo, OrbitalHub 163 Mo…)
// saturent donc la VRAM → context loss WebGL → freeze. KTX2/Basis reste COMPRESSÉ sur le
// GPU (~6-8× moins de VRAM, BC7/ETC selon la machine) → plus de saturation.
//
// drei `useGLTF` ne câble PAS KTX2 nativement (contrairement à Draco via setDecoderPath).
// On expose donc : un KTX2Loader SINGLETON (transcodeur servi en local depuis /basis/ →
// marche offline en Electron) + un `extendLoader` à passer aux useGLTF/GLTFLoader des MAPS.
//
// detectSupport(renderer) est OBLIGATOIRE avant tout transcodage (il interroge les formats
// GPU supportés). On le fait PARESSEUSEMENT au moment du chargement (extendLoader), à partir
// du renderer enregistré par un composant in-Canvas → aucune fragilité d'ordre de montage.
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import type { WebGLRenderer } from "three";

let loader: KTX2Loader | null = null;
let detected = false;
let renderer: WebGLRenderer | null = null;

/** KTX2Loader singleton (transcodeur local /basis/). */
function getKTX2Loader(): KTX2Loader {
  if (!loader) loader = new KTX2Loader().setTranscoderPath("/basis/");
  return loader;
}

/** Enregistre le renderer (appelé une fois par un composant in-Canvas). Idempotent. */
export function registerRendererForKTX2(r: WebGLRenderer): void {
  renderer = r;
}

/** Attache le KTX2Loader à un loader de GLB de map (useGLTF extendLoader ou GLTFLoader).
 *  detectSupport est déclenché ici, paresseusement, dès qu'un renderer est dispo (à ce
 *  stade — temps de chargement — le Canvas est monté depuis longtemps). No-op si le GLB
 *  ne contient pas de KTX2 (extendLoader inoffensif sur les maps non encodées).
 *
 *  Typage `any` volontaire : drei (useGLTF) utilise le GLTFLoader de `three-stdlib`, alors
 *  que PuzzleMap utilise celui de `three` → leurs types KTX2Loader diffèrent bien que
 *  l'implémentation runtime soit identique (mêmes méthodes load/detectSupport). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function attachKTX2(target: any): void {
  if (!target || typeof target.setKTX2Loader !== "function") return;
  const k = getKTX2Loader();
  if (!detected && renderer) { k.detectSupport(renderer); detected = true; }
  target.setKTX2Loader(k);
}

/** extendLoader prêt à l'emploi pour `useGLTF(path, true, true, mapLoaderExtend)`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapLoaderExtend(loaderInstance: any): void {
  attachKTX2(loaderInstance);
}

/** Attache KTX2 à n'importe quel GLTFLoader (AssetPreloader, caractères, armes, PNJ).
 *  Alias sémantique d'attachKTX2 pour les call-sites hors maps. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function globalLoaderExtend(loaderInstance: any): void {
  attachKTX2(loaderInstance);
}
