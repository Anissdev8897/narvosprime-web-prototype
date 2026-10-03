// rpg/loaders/sharedLoaders.ts — Singletons DRACOLoader / KTX2Loader avec Workers.
//
// Phase 8 NarvosEngine : TOUT le decodage Draco/KTX2 passe par ces singletons.
// Workers activés → decodage off main thread → zero jank pendant le chargement.
// Avant : 6 DRACOLoader séparés × 0 worker = decode main thread = freeze.
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { WebGLRenderer } from "three"; // valeur ET type : ensureDetectSupport instancie un renderer de secours

// ── Draco singleton (WASM + 4 worker threads) ──────────────────────────────
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");
dracoLoader.setDecoderConfig({ type: "wasm" });
dracoLoader.setWorkerLimit(4);
// `preload()` va CHERCHER /draco/draco_wasm_wrapper.js immédiatement. Hors
// navigateur (vitest tourne en env `node`), l'URL relative est invalide et le
// rejet remonte en erreur non gérée qui fait échouer le fichier de test entier.
// Même garde que AudioManager — cf. « SSR / tests » dans CLAUDE.md.
if (typeof document !== "undefined") dracoLoader.preload();

// ── KTX2/Basis singleton (transcodeur local /basis/) ────────────────────────
let ktx2Loader: KTX2Loader | null = null;
let ktx2Detected = false;
let storedRenderer: WebGLRenderer | null = null;

function getKTX2Loader(): KTX2Loader {
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader().setTranscoderPath("/basis/");
    // PLAFOND DE WORKERS = 1. Les maps Forge ont 40+ textures KTX2 par chunk,
    // chaque worker alloue ses propres buffers. À 4 workers × 40 textures × 2 chunks
    // concurrents, on dépasse la RAM dispo → `Array buffer allocation failed`.
    // 1 seul worker = décodage séquentiel = mémoire stable, 0 OOM.
    ktx2Loader.setWorkerLimit(1);
  }
  return ktx2Loader;
}

/**
 * Enregistre le renderer WebGL pour detectSupport KTX2.
 *
 * RE-DÉTECTE si le sondage précédent avait été fait sur un renderer JETABLE.
 * Le drapeau `ktx2Detected` se verrouillait au premier appel : quand un GLB se
 * parsait avant le montage du Canvas (préchargement au boot), c'était la sonde
 * qui fixait la liste des formats compressés, et le vrai renderer n'était plus
 * jamais consulté. Si ce contexte de sonde n'exposait pas S3TC/ETC/ASTC — cas
 * observé, il est créé sur un canvas détaché et peut être dégradé — KTX2Loader
 * transcodait TOUT en RGBA32 non compressé. Mesuré en jeu : un chunk à 1698 Mo
 * de VRAM contre 88-146 Mo pour ses voisins, soit 4,36 Mo par texture = RGBA8.
 */
export function registerRenderer(r: WebGLRenderer): void {
  const wasProbe = ktx2Detected && storedRenderer === null;
  storedRenderer = r;
  if (wasProbe && ktx2Loader) {
    ktx2Loader.detectSupport(r);
    if (import.meta.env?.DEV) {
      console.info("[KTX2] re-détection sur le renderer réel (le sondage initial venait d'un renderer jetable)");
    }
  }
}

/**
 * Loader KTX2 partagé, prêt à l'emploi (detectSupport déjà lancé).
 *
 * Exposé pour les textures AUTONOMES — celles qui ne sont pas embarquées dans un
 * GLB, comme les couches de l'auto-material paysage. Passer par ce singleton
 * plutôt que d'instancier un KTX2Loader évite de re-télécharger le transcodeur
 * et de re-sonder les capacités GPU pour chaque appelant.
 *
 * Retourne null hors navigateur (tests vitest en environnement `node`).
 */
export function getKTX2(): KTX2Loader | null {
  if (typeof document === "undefined") return null;
  const k = getKTX2Loader();
  ensureDetectSupport(k);
  return k;
}

/**
 * Renderer de la scène, s'il est déjà enregistré.
 *
 * Exposé pour les textures autonomes (auto-material) qui doivent être uploadées
 * sur le GPU AVANT la révélation de la map : `collectTextures` de
 * StreamingPuzzleMap ne parcourt que les propriétés des matériaux et ne peut
 * pas les voir. Retourne null tant qu'aucun Canvas n'est monté.
 */
export function getRegisteredRenderer(): WebGLRenderer | null {
  return storedRenderer;
}

/** Formats compressés retenus par le transcodeur — pour diagnostic. */
export function ktx2SupportSummary(): string {
  const k = ktx2Loader as unknown as { workerConfig?: Record<string, boolean> } | null;
  if (!k?.workerConfig) return "non détecté";
  const on = Object.entries(k.workerConfig).filter(([, v]) => v === true).map(([n]) => n);
  return on.length ? on.join(",") : "AUCUN FORMAT COMPRESSÉ → transcodage RGBA32";
}

/**
 * Lance `detectSupport` une seule fois. OBLIGATOIRE avant tout transcodage : sans
 * lui, KTX2Loader lève "Missing initialization with .detectSupport( renderer )"
 * et le GLB entier échoue.
 *
 * Le renderer du jeu est enregistré par les composants in-Canvas (`registerRenderer`),
 * mais depuis que KTX2 est câblé GLOBALEMENT (installKtx2Everywhere) un GLB peut se
 * parser AVANT qu'un Canvas soit monté — préchargement au boot, aperçu de la Forge…
 * D'où le filet : un renderer jetable. `detectSupport` ne fait qu'interroger les
 * extensions GPU et `capabilities.isWebGL2` ; il n'a pas besoin du renderer de la
 * scène, et les formats supportés ne dépendent que de la machine.
 */
function ensureDetectSupport(k: KTX2Loader): void {
  if (ktx2Detected) return;
  if (storedRenderer) {
    k.detectSupport(storedRenderer);
    ktx2Detected = true;
    return;
  }
  if (typeof document === "undefined") return; // SSR / vitest : pas de WebGL
  try {
    const probe = new WebGLRenderer();
    k.detectSupport(probe);
    probe.dispose(); // libère le contexte immédiatement : ils sont plafonnés (~16)
    ktx2Detected = true;
  } catch (err) {
    // Pas de WebGL du tout : inutile d'insister, le GLB KTX2 échouera avec un
    // message explicite plutôt qu'un crash silencieux ici.
    console.warn("[KTX2] detectSupport impossible (aucun contexte WebGL) :", err);
  }
}

/** Attache KTX2 à n'importe quel GLTFLoader (maps, persos, armes, PNJ). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function attachKTX2(target: any): void {
  if (!target || typeof target.setKTX2Loader !== "function") return;
  const k = getKTX2Loader();
  ensureDetectSupport(k);
  target.setKTX2Loader(k);
}

/** Attache DRACOLoader + KTX2Loader à un GLTFLoader. Point d'entrée unique. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function configureGLTFLoader(loader: any): void {
  if (loader && typeof loader.setDRACOLoader === "function") {
    loader.setDRACOLoader(dracoLoader);
  }
  attachKTX2(loader);
}

/** Pour drei useGLTF extendLoader callback. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapLoaderExtend(loaderInstance: any): void {
  configureGLTFLoader(loaderInstance);
}

export { dracoLoader, getKTX2Loader };
