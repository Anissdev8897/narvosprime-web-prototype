// ══════════════════════════════════════════════════════════════════════════════
// settings/gameSettings.ts — Réglages du jeu (touches / vidéo / audio)
//
// Source de vérité UNIQUE, persistée dans localStorage. Mutée EN PLACE pour que
// les références live (ex: playerConfig.KEYBINDINGS = gameSettings.keys) restent
// valides après un rebind — pas de bus d'événements ni de ré-instanciation.
// ══════════════════════════════════════════════════════════════════════════════

import { audioManager } from "../../utils/AudioManager";
import { loadUserDb, saveUserDb } from "../persistence/dbStore";

const STORAGE_KEY = "narvos:settings:v1";
const DB_KEY = "settings";

// ── Touches ───────────────────────────────────────────────────────────────────
export type KeyBindings = Record<string, string[]>;

/** Liste des actions rebindables (ordre + libellés pour l'UI). */
export const BINDABLE_ACTIONS: { id: string; label: string; group: string }[] = [
  { id: "forward",   label: "Avancer",        group: "Déplacement" },
  { id: "back",      label: "Reculer",        group: "Déplacement" },
  { id: "left",      label: "Gauche",         group: "Déplacement" },
  { id: "right",     label: "Droite",         group: "Déplacement" },
  { id: "jump",      label: "Saut",           group: "Déplacement" },
  { id: "crouch",    label: "S'accroupir",    group: "Déplacement" },
  { id: "sprint",    label: "Sprint",         group: "Déplacement" },
  { id: "drawWeapon",label: "Dégainer / Ranger l'arme", group: "Combat" },
  { id: "kick",      label: "Coup de pied (maintien = chargé)", group: "Combat" },
  { id: "parry",     label: "Parade",          group: "Combat" },
  { id: "dodge",     label: "Esquive (i-frames)", group: "Combat" },
  { id: "viewFps",   label: "Vue FPS",        group: "Caméra" },
  { id: "viewTps",   label: "Vue TPS",        group: "Caméra" },
  { id: "interact",       label: "Interagir",       group: "Interface" },
  { id: "minimap",        label: "Minimap",         group: "Interface" },
  { id: "galaxy",         label: "État galactique", group: "Interface" },
  { id: "worldmap",       label: "Carte du monde",  group: "Interface" },
  { id: "inventory",      label: "Inventaire",      group: "Interface" },
  { id: "characteristics",label: "Caractéristiques",group: "Interface" },
  { id: "pause",          label: "Menu / Pause",    group: "Interface" },
  { id: "noclip",         label: "Noclip (vol libre)",group: "Debug" },
  { id: "flyDown",        label: "Vol bas (noclip)", group: "Debug" },
  { id: "skill1",    label: "Compétence 1",   group: "Compétences" },
  { id: "skill2",    label: "Compétence 2",   group: "Compétences" },
  { id: "skill3",    label: "Compétence 3",   group: "Compétences" },
  { id: "skill4",    label: "Compétence 4",   group: "Compétences" },
  { id: "skill5",    label: "Compétence 5",   group: "Compétences" },
  { id: "skill6",    label: "Compétence 6",   group: "Compétences" },
];

const DEFAULT_KEYS: KeyBindings = {
  forward:   ["KeyW", "KeyZ", "ArrowUp"],
  back:      ["KeyS", "ArrowDown"],
  left:      ["KeyA", "KeyQ", "ArrowLeft"],
  right:     ["KeyD", "ArrowRight"],
  jump:      ["Space"],
  crouch:    ["ControlLeft", "ControlRight"], // accroupi (au sol)
  sprint:    ["ShiftLeft", "ShiftRight"],
  // ── Combat (tout est REBINDABLE depuis Réglages → Touches) ──────────────────
  drawWeapon: ["KeyF"],
  kick:       ["KeyH", "Numpad1"],   // tap = coup de pied · maintien = chargé
  parry:      ["KeyP", "Numpad2"],   // parade (fenêtre d'annulation des coups mêlée)
  dodge:      ["KeyG"],              // esquive + i-frames
  wallrun:    ["KeyX"],              // course murale
  minimap:    ["KeyM"],              // afficher/masquer la minimap
  galaxy:     ["KeyN"],              // état galactique (univers vivant)
  worldmap:   ["KeyU"],              // carte du monde plein écran
  flyDown:   ["ControlRight"],       // noclip : descendre (Ctrl droit uniquement, évite conflit crouch)
  // F1 et F3 sont CAPTURÉES PAR LE NAVIGATEUR — F1 ouvre l'aide, F3 la
  // recherche dans la page. Aucune des deux ne parvenait au jeu : le
  // changement de vue était injouable au clavier, quoi qu'en dise le réglage.
  // `KeyV` (View) est libre et ne déclenche rien côté navigateur.
  viewFps:   ["KeyV"],
  viewTps:   ["KeyV"],   // même touche : elle BASCULE, cf. InputManager
  interact:       ["KeyE"],
  inventory:      ["KeyI"],
  characteristics:["KeyK"],
  pause:          ["Escape"],
  noclip:         ["F4"],
  skill1:    ["Digit1"],
  skill2:    ["Digit2"],
  skill3:    ["Digit3"],
  skill4:    ["Digit4"],
  skill5:    ["Digit5"],
  skill6:    ["Digit6"],
};

// ── Vidéo ───────────────────────────────────────────────────────────────────
export type GraphicsQuality = "low" | "medium" | "high";
export type RendererBackend = "webgpu" | "webgl";

export interface VideoSettings {
  fullscreen: boolean;
  shadows: boolean;
  quality: GraphicsQuality;
  renderDistance: number;   // far plane / portée de rendu (m)
  postProcessing: boolean;
  dayNightCycle: boolean;   // cycle jour/nuit dynamique (maps terrain)
  dynamicWeather: boolean;  // météo dynamique (pluie, neige, orage…)
  renderer: RendererBackend; // WebGPU (moderne) ou WebGL (legacy)
}
const DEFAULT_VIDEO: VideoSettings = {
  fullscreen: false,
  shadows: true,
  // "medium" et non "high" : depuis la génération des variantes de map, "high"
  // signifie des textures 2048 — mesuré 1055-1648 Mo de VRAM par chunk, 11,2 Go
  // les 8 résidents. C'est une option pour grosse configuration, pas un défaut.
  // "medium" (1024) reproduit exactement la netteté d'avant tout en tenant dans
  // ~2,8 Go. Les assets sans variante retombent silencieusement sur high.
  quality: "medium",
  renderDistance: 1500,
  postProcessing: true,
  dayNightCycle: true,
  dynamicWeather: true,
  renderer: "webgl" as RendererBackend,
};

/** dpr (device pixel ratio) selon la qualité. */
export const QUALITY_DPR: Record<GraphicsQuality, [number, number]> = {
  low:    [0.6, 1],
  medium: [1, 1.5],
  high:   [1, 2],
};

/**
 * Taille de la shadow map (pixels, par côté) selon la qualité.
 * Low  : 512  → 1 Mo VRAM, ombres pixelisées acceptables.
 * Med  : 1024 → 4 Mo VRAM, bon équilibre qualité/perf.
 * High : 2048 → 16 Mo VRAM, ombres nettes (suffisant pour cette scène).
 */
export const QUALITY_SHADOW_MAP: Record<GraphicsQuality, number> = {
  low:    512,
  medium: 1024,
  high:   2048,
};

// ── Audio (0..1) ──────────────────────────────────────────────────────────────
export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  voice: number; // réservé
  ui: number;    // réservé
}
const DEFAULT_AUDIO: AudioSettings = { master: 1, music: 0.4, sfx: 0.5, voice: 1, ui: 1 };

// ── État global muté EN PLACE ─────────────────────────────────────────────────
export const gameSettings = {
  keys:  structuredClone(DEFAULT_KEYS) as KeyBindings,
  video: { ...DEFAULT_VIDEO },
  audio: { ...DEFAULT_AUDIO },
};

function persist() {
  // `migration` est écrit À CÔTÉ des réglages, pas dans `gameSettings` : celui-ci
  // est la source de vérité du GAMEPLAY et est mutée en place par des refs live.
  // Sans ce champ dans la charge sérialisée, une migration ne se graverait jamais
  // et se rejouerait à chaque démarrage — écrasant à l'infini un réglage que le
  // joueur aurait délibérément remis.
  const payload = { ...gameSettings, migration: SETTINGS_MIGRATION };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch { /* quota */ }
  saveUserDb(DB_KEY, payload); // → base (par utilisateur, débouncé, no-op hors Electron)
}

/** Hydrate les réglages depuis la base (mutation EN PLACE → références live conservées). */
export async function hydrateSettingsFromDb(): Promise<void> {
  const s = await loadUserDb<typeof gameSettings & { migration?: number }>(DB_KEY);
  if (!s) return;
  if (s.keys)  Object.assign(gameSettings.keys, s.keys);
  if (s.video) Object.assign(gameSettings.video, s.video);
  if (s.audio) Object.assign(gameSettings.audio, s.audio);
  // MÊME MIGRATION QUE `load()` — l'hydratation base arrive APRÈS et écraserait
  // sinon la valeur corrigée : le joueur repartirait sur « high » (2048, 9,6 Go)
  // dès que la base répond, sans rien avoir touché.
  const applied = typeof s.migration === "number" ? s.migration : 0;
  if (applied < 1 && gameSettings.video.quality === "high") {
    gameSettings.video.quality = "medium";
    persist();
  }
  // Idem pour les touches : la base répond APRÈS `load()` et réécraserait
  // sinon la correction avec les F1/F3 enregistrés.
  if (applied < 2 && migrateViewKeys()) persist();
  applyAudio();
}

/** Pousse les volumes vers l'AudioManager (master multiplie music & sfx). */
export function applyAudio() {
  const a = gameSettings.audio;
  audioManager.setMusicVolume(a.music * a.master);
  audioManager.setSfxVolume(a.sfx * a.master);
  audioManager.setVoiceVolume(a.voice * a.master);
}

/**
 * Migrations des réglages persistés.
 *
 * Numéro de la dernière migration appliquée, stocké AVEC les réglages. Il ne
 * remplace pas `STORAGE_KEY` : changer la clé jetterait aussi les touches et
 * l'audio, alors qu'on ne veut corriger qu'un champ.
 *
 * 1 — `quality` a CHANGÉ DE SENS. Avant les variantes de map, "high" servait des
 *     textures 1024 (les seules qui existaient). Depuis, "high" désigne du 2048 :
 *     mesuré 9,62 Go de VRAM pour les 8 chunks de la forge, contre 2,54 Go en
 *     "medium". Un joueur ayant "high" enregistré se retrouvait donc propulsé sur
 *     un palier qu'il n'avait jamais choisi, avec « RangeError: Array buffer
 *     allocation failed » dans le transcodeur Basis à la clé. On le ramène UNE
 *     fois sur "medium", qui reproduit la netteté d'avant. Rien n'empêche de
 *     remettre "high" ensuite : le choix est alors délibéré et il tient.
 *
 * 2 — `viewFps` / `viewTps` étaient sur F1 et F3, deux touches que le NAVIGATEUR
 *     intercepte (aide, recherche dans la page). Elles n'atteignaient jamais le
 *     jeu : changer de vue au clavier était impossible, et le viewmodel d'arme
 *     FPS restait donc invisible. On les ramène sur `KeyV`, qui bascule.
 *     Réécrit UNIQUEMENT si le joueur avait encore les anciens défauts — une
 *     touche qu'il a lui-même choisie n'est pas touchée.
 */
const SETTINGS_MIGRATION = 2;

/** Réécrit les touches de vue si elles sont restées sur les défauts capturés. */
function migrateViewKeys(): boolean {
  const est = (v: unknown, attendu: string) =>
    Array.isArray(v) && v.length === 1 && v[0] === attendu;
  let change = false;
  if (est(gameSettings.keys.viewFps, "F1")) { gameSettings.keys.viewFps = ["KeyV"]; change = true; }
  if (est(gameSettings.keys.viewTps, "F3")) { gameSettings.keys.viewTps = ["KeyV"]; change = true; }
  if (change) {
    console.info(
      "[Settings] touche de vue F1/F3 → V : le navigateur interceptait F1 (aide) " +
      "et F3 (recherche), le jeu ne les recevait jamais.",
    );
  }
  return change;
}

/** Charge depuis localStorage (mutation en place → références live conservées). */
function load() {
  let migrated = false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.keys)  Object.assign(gameSettings.keys, s.keys);
      if (s.video) Object.assign(gameSettings.video, s.video);
      if (s.audio) Object.assign(gameSettings.audio, s.audio);

      const applied = typeof s.migration === "number" ? s.migration : 0;
      if (applied < 1 && gameSettings.video.quality === "high") {
        gameSettings.video.quality = "medium";
        console.info(
          "[Settings] qualité graphique ramenée de « high » à « medium » : " +
          "« high » désigne désormais des textures 2048 (9,6 Go de VRAM sur la forge). " +
          "Repassez en « high » dans Paramètres → Vidéo si votre carte le permet.",
        );
      }
      if (applied < 2) migrateViewKeys();
      migrated = applied < SETTINGS_MIGRATION;
    }
  } catch { /* parse error → défauts */ }
  applyAudio();
  // Réécrit pour graver le numéro de migration : sans ça elle se rejouerait à
  // chaque démarrage et écraserait un « high » choisi volontairement après coup.
  if (migrated) persist();
}
load();

// ── API de modification ───────────────────────────────────────────────────────
/** Réassigne UNE touche à une action (remplace les anciennes). */
export function rebindKey(action: string, code: string) {
  if (!(action in gameSettings.keys)) return;
  gameSettings.keys[action] = [code];
  persist();
}

/** Restaure les touches par défaut. */
export function resetKeys() {
  Object.assign(gameSettings.keys, structuredClone(DEFAULT_KEYS));
  persist();
}

export function setVideo<K extends keyof VideoSettings>(key: K, value: VideoSettings[K]) {
  gameSettings.video[key] = value;
  persist();
}

export function setAudio<K extends keyof AudioSettings>(key: K, value: AudioSettings[K]) {
  gameSettings.audio[key] = value;
  applyAudio();
  persist();
}

/** Libellé lisible d'un code clavier (KeyW → W, Digit1 → 1, ArrowUp → ↑…). */
export function keyLabel(code?: string): string {
  if (!code) return "—";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return ({ ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" } as Record<string, string>)[code] ?? code;
  const map: Record<string, string> = {
    Space: "Espace", ShiftLeft: "Shift G", ShiftRight: "Shift D",
    ControlLeft: "Ctrl G", ControlRight: "Ctrl D", Escape: "Échap",
    Enter: "Entrée", Tab: "Tab",
  };
  return map[code] ?? code;
}
