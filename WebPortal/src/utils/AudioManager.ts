// ══════════════════════════════════════════════════════════════════════════════
// utils/AudioManager.ts — Gestionnaire audio NARVOS PRIME (singleton)
//
// Architecture duale :
//   • Musique thématique → HTMLAudioElement (stream, pas chargé en mémoire)
//   • Ambiances (boucles) → Web Audio API / AudioContext.decodeAudioData()
//     ∵ L'Electron "ungoogled" refuse les HTMLAudioElement MP3 et certains WAV
//       avec chunks non-standard (JUNK, etc.). AudioContext décode le PCM brut
//       directement depuis le ArrayBuffer → robuste sur toutes les variantes WAV.
//     ∵ AudioBufferSourceNode + GainNode permet un mix multi-piste propre.
//
// Déverrouillage autoplay :
//   • AudioContext est créé au 1er geste utilisateur (click/keydown/touchstart).
//   • Les demandes de play() avant déverrouillage sont mises en file et rejouées.
//
// Fallback MP3 → WAV :
//   • tryWavFallback() cherche un .wav homonyme si le .mp3 échoue.
//   • Permet de poser un .wav à côté du .mp3 sans toucher au code.
// ══════════════════════════════════════════════════════════════════════════════

export type MusicTheme = "login" | "exploration" | "combat";

const SFX_BASE = "/models/audio/sfx/";
const DEV = import.meta.env.DEV;

function sfxUrl(path: string)   { return `${SFX_BASE}${path}`; }
function voiceUrl(file: string) { return `/models/voice_characters/${file}`; }
function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

// ── Diagnostic d'échec audio ─────────────────────────────────────────────────
const diagnosedUrls = new Set<string>();
const MEDIA_ERROR_LABELS: Record<number, string> = {
  1: "MEDIA_ERR_ABORTED",
  2: "MEDIA_ERR_NETWORK",
  3: "MEDIA_ERR_DECODE (fichier corrompu)",
  4: "MEDIA_ERR_SRC_NOT_SUPPORTED (codec manquant)",
};
function diagnoseAudioFailure(url: string, audio?: HTMLAudioElement): void {
  if (diagnosedUrls.has(url)) return;
  diagnosedUrls.add(url);
  const errCode = audio?.error?.code ?? 0;
  const errLabel = errCode > 0 ? (MEDIA_ERROR_LABELS[errCode] ?? `code ${errCode}`) : "inconnu";
  fetch(url, { method: "HEAD" }).then((res) => {
    if (res.status === 404) {
      console.warn(`%c[Audio] 404 — ${url}`, "color:#f87171;font-weight:bold");
      return;
    }
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!ct.startsWith("audio/")) {
      console.warn(`%c[Audio] SPA fallback (index.html) au lieu de l'audio : ${url}`, "color:#f87171");
      return;
    }
    console.warn(
      `%c[Audio] décodage échoué — %c${errLabel}%c\n  URL  : ${url}\n  Serv : Content-Type=${ct}, ${res.headers.get("content-length") ?? "?"} octets`,
      "color:#ff6060;font-weight:bold", "color:#fbbf24", "color:#ffcc88",
    );
  }).catch(() => { /* réseau indispo */ });
}

// ── Fallback .mp3 → .wav ─────────────────────────────────────────────────────
function toWavUrl(url: string): string {
  const qIdx = url.indexOf("?");
  const path  = qIdx === -1 ? url : url.slice(0, qIdx);
  const query = qIdx === -1 ? ""  : url.slice(qIdx);
  if (!/\.mp3$/i.test(path)) return url;
  return path.replace(/\.mp3$/i, ".wav") + query;
}
const fallbackAttempted = new Set<string>();
function tryWavFallback(mp3Url: string, onSuccess: (wavUrl: string) => void): void {
  if (fallbackAttempted.has(mp3Url)) return;
  fallbackAttempted.add(mp3Url);
  const wavUrl = toWavUrl(mp3Url);
  if (wavUrl === mp3Url) return;
  fetch(wavUrl, { method: "HEAD" }).then((res) => {
    if (!res.ok) return;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!ct.startsWith("audio/")) return;
    if (DEV) console.info(`%c[Audio] fallback .mp3→.wav automatique : ${mp3Url}`, "color:#86efac;font-weight:bold");
    onSuccess(wavUrl);
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue ambiances
// ─────────────────────────────────────────────────────────────────────────────
interface AmbientTrack {
  url: string;
  vol?: number; // multiplicateur relatif (1.0 = défaut)
}

// ⚠ Tower : les fichiers sur disque sont en .wav (et non .mp3).
//   Les URLs ont été corrigées pour correspondre aux fichiers réels.
// ⚠ Forge : WAV avec chunk JUNK non-standard → utilise AudioContext (fetch+decode).
// ⚠ Orbital : ambiance MP3 → fallback WAV si présent, sinon AudioContext décode le MP3.
const AMBIENT: Record<string, AmbientTrack[]> = {
  forge: [
    { url: sfxUrl("ambiant_forge_map/SFX_Wind_001.WAV"),                 vol: 1.0 },
    { url: sfxUrl("ambiant_forge_map/SFX_CricketLongAwayNightLoop.WAV"), vol: 0.5 },
  ],
  tower: [
    // Fichiers disque : .wav (pas .mp3)
    { url: sfxUrl("ambian_tower_map/Ambience_Sound_In_The_Desert.wav"),  vol: 1.0 },
    { url: sfxUrl("ambian_tower_map/Desert_Winds.wav"),                  vol: 0.65 },
    { url: sfxUrl("ambian_tower_map/the_sound_of_the_wind.wav"),         vol: 0.5 },
  ],
  orbital: [
    { url: sfxUrl("ambiant_orbital/ambiant_environement.mp3"),           vol: 1.0 },
  ],
};

// One-shots aléatoires (25–55s entre chaque)
const AMBIENT_ONESHOT_MIN_MS = 25_000;
const AMBIENT_ONESHOT_MAX_MS = 55_000;
const AMBIENT_ONESHOTS: Record<string, string[]> = {
  tower: [
    sfxUrl("ambian_tower_map/Wind_sound_effect.wav"),
    sfxUrl("ambian_tower_map/Wind_Sound_Effect_Copyright_Free.wav"),
    sfxUrl("ambian_tower_map/Long_Cinematic_Whoosh_Sound_Effect.wav"),
    sfxUrl("ambian_tower_map/Desert_Air_Sound_Effects_No_Copyright_Cinematography.wav"),
    sfxUrl("ambian_tower_map/The_sound_of_insects_in_the_desert.wav"),
    sfxUrl("ambian_tower_map/Desert_Night_Ambience.wav"),
  ],
  orbital: [],
  forge:   [],
};

// Musique par carte (HTMLAudioElement — streaming)
const MAP_MUSIC: Record<string, string> = {
  forge:   sfxUrl("ambiant_forge_map/music/Cercle_de_Cendre.mp3"),
  tower:   sfxUrl("ambian_tower_map/music/Cercle_de_tower.mp3"),
  orbital: sfxUrl("ambiant_orbital/music/music_station.wav"),
  donjon_furiste: sfxUrl("dojon_s/exploration/exploration.ogg"),
};

// Musique ADAPTATIVE du donjon : exploration → combat → boss.
// Pilotée par audioManager.setDungeonPhase() depuis RpgGameWorld (selon l'activité).
// Variantes combat/boss tirées au hasard à chaque bascule.
const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
const DUNGEON_MUSIC: Record<"explore" | "combat" | "boss", () => string> = {
  explore: () => sfxUrl("dojon_s/exploration/exploration.ogg"),
  combat:  () => pickRandom([sfxUrl("dojon_s/combat/combat1.ogg"), sfxUrl("dojon_s/combat/combat2.ogg")]),
  boss:    () => pickRandom([sfxUrl("dojon_s/boss/boss1.ogg"),     sfxUrl("dojon_s/boss/boss2.ogg")]),
};

// SFX nommés
const SFX_KEYS: Record<string, string> = {
  levelUp:    sfxUrl("levelUP/Level_UPmp3.mp3"),
  login:      sfxUrl("login_connection/login.wav"),
  transition: sfxUrl("Transitions/TAH Digital SFX Transition 05.wav"),
  glitch:     sfxUrl("Cinematic Glitch/TAH Digital SFX Complex Glitch 01.wav"),
  loading:    sfxUrl("Loading/TAH Digital SFX Loading 01.wav"),
};

// Voix PNJ
export const NPC_VOICES = {
  greet:    voiceUrl("pnj_bonsoir.mp3"),
  farewell: voiceUrl("aurevoir_pnj.mp3"),
  quest:    voiceUrl("queteune.mp3"),
};

// Playlists thématiques (compat ancienne API)
const THEME_PLAYLISTS: Record<MusicTheme, string[]> = {
  login:       [sfxUrl("login_connection/login.wav")],
  exploration: Object.values(MAP_MUSIC),
  combat:      [sfxUrl("ambiant_forge_map/music/Cercle_de_Cendre.mp3")],
};

// ══════════════════════════════════════════════════════════════════════════════
// Nœud ambiance Web Audio API
// ══════════════════════════════════════════════════════════════════════════════
interface AmbientNode {
  source: AudioBufferSourceNode;
  gain:   GainNode;
  volMult: number;
}

// ─────────────────────────────────────────────────────────────────────────────
class AudioManager {
  private static _instance: AudioManager;

  // Musique (HTMLAudioElement — streaming MP3/WAV)
  private currentMusic:  HTMLAudioElement | null = null;
  private currentTheme:  MusicTheme | null = null;

  // Ambiances (Web Audio API)
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientNodes: AmbientNode[] = [];
  private oneshotTimer: ReturnType<typeof setTimeout> | null = null;
  private currentMapId = "";
  private dungeonPhase: "explore" | "combat" | "boss" | null = null;

  // Volumes
  private musicVolume = 0.4;
  private sfxVolume   = 0.5;
  private voiceVolume = 1;

  // Déverrouillage autoplay
  private unlocked = false;
  private pendingPlays: HTMLAudioElement[] = [];
  private pendingMapId = "";

  // File d'annonces (kill streak) : jouées UNE À LA FOIS, dans l'ordre. Une annonce attend
  // la FIN de la précédente (double kill → triple → … sans chevauchement).
  private announceQueue: { url: string; mult: number }[] = [];
  private announceBusy = false;

  // Suivi des fetches en cours (pour stopper si changement de map)
  private abortCtrl: AbortController | null = null;

  private constructor() {
    this.loadSettings();
    this.attachUnlockListeners();
  }

  static getInstance(): AudioManager {
    if (!AudioManager._instance) AudioManager._instance = new AudioManager();
    return AudioManager._instance;
  }

  // ── Volume ──────────────────────────────────────────────────────────────────
  setMusicVolume(vol: number) {
    this.musicVolume = clamp01(vol);
    if (this.currentMusic) this.currentMusic.volume = this.musicVolume;
    // Musique via AudioContext
    if (this.currentMusicNode && this.ctx) {
      this.currentMusicNode.gain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.1);
    }
    // Ambiances : préserve le ratio relatif
    for (const node of this.ambientNodes) {
      node.gain.gain.setTargetAtTime(
        clamp01(this.musicVolume * 0.28 * node.volMult),
        this.ctx!.currentTime, 0.1
      );
    }
    this.saveSettings();
  }
  setSfxVolume(vol: number) { this.sfxVolume = clamp01(vol); this.saveSettings(); }
  setVoiceVolume(vol: number) { this.voiceVolume = clamp01(vol); this.saveSettings(); }
  getMusicVolume() { return this.musicVolume; }
  getSfxVolume()   { return this.sfxVolume; }
  getVoiceVolume() { return this.voiceVolume; }

  // ── Carte courante ──────────────────────────────────────────────────────────
  setMap(mapId: string) {
    if (mapId === this.currentMapId) return;
    if (!this.unlocked) {
      if (DEV) console.log(`[Audio] setMap("${mapId}") différé — en attente du déverrouillage`);
      this.pendingMapId = mapId;
      return;
    }
    this.currentMapId = mapId;
    // Diagnostic : un volume musique 0 persisté rend musique ET ambiances inaudibles
    // (le gain d'ambiance est asservi au volume musique) alors que les logs disent "OK".
    if (this.musicVolume <= 0.001) {
      console.warn("[Audio] volume musique = 0 — musiques/ambiances coupées. Réglages → Audio pour les rétablir.");
    }
    this.stopAmbient();
    this.startAmbient(mapId);
    this.scheduleAmbientOneshot(mapId);
    this.dungeonPhase = mapId === "donjon_furiste" ? "explore" : null;
    const url = MAP_MUSIC[mapId];
    if (url) this.startMapMusic(url);
  }

  // ── Musique adaptative du donjon (explore / combat / boss) ───────────────────
  // Appelée par RpgGameWorld quand l'intensité change. No-op hors donjon ou si
  // la phase est inchangée (évite de relancer la piste en boucle).
  setDungeonPhase(phase: "explore" | "combat" | "boss") {
    if (this.currentMapId !== "donjon_furiste") return;
    if (phase === this.dungeonPhase) return;
    this.dungeonPhase = phase;
    this.startMapMusic(DUNGEON_MUSIC[phase]());
  }

  // ── Ambiances via Web Audio API ─────────────────────────────────────────────
  private ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private async loadAndPlayLoop(url: string, volMult: number): Promise<void> {
    const ctx = this.ensureContext();
    const signal = this.abortCtrl?.signal;

    // Tente l'URL d'origine; si MP3 et échec, essaie le .wav homonyme
    const urlsToTry = [url];
    if (/\.mp3$/i.test(url)) urlsToTry.push(toWavUrl(url));

    for (const tryUrl of urlsToTry) {
      if (signal?.aborted) return;
      try {
        const res = await fetch(tryUrl, { signal: signal ?? undefined });
        if (!res.ok) {
          if (DEV) console.warn(`[Audio] HTTP ${res.status} : ${tryUrl}`);
          continue;
        }
        const ct = (res.headers.get("content-type") ?? "").toLowerCase();
        if (!ct.startsWith("audio/")) {
          if (DEV) console.warn(`[Audio] SPA fallback (index.html) pour : ${tryUrl}`);
          continue;
        }

        if (signal?.aborted) return;
        const buf = await res.arrayBuffer();
        if (signal?.aborted) return;

        let decoded: AudioBuffer;
        try {
          decoded = await ctx.decodeAudioData(buf.slice(0)); // slice pour éviter le detach
        } catch (e) {
          if (DEV) console.warn(`[Audio] decodeAudioData échoué sur ${tryUrl}:`, e);
          continue; // essaie l'URL suivante
        }

        if (signal?.aborted) return;

        // Tout ok — crée le nœud source boucle + gain
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.connect(this.masterGain ?? ctx.destination);

        const source = ctx.createBufferSource();
        source.buffer = decoded;
        source.loop   = true;
        source.connect(gain);
        source.start();

        // Fade-in doux (1s)
        const targetVol = clamp01(this.musicVolume * 0.28 * volMult);
        gain.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + 1.0);

        this.ambientNodes.push({ source, gain, volMult });
        if (DEV) console.log(`%c[Audio] ambiance OK%c : ${tryUrl}`, "color:#86efac;font-weight:bold", "color:inherit");
        return; // succès → arrête de boucler sur les URLs

      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") return; // changement de map
        if (DEV) console.warn(`[Audio] fetch échoué : ${tryUrl}`, err);
      }
    }
    // Toutes les URLs ont échoué — log final
    if (DEV) console.warn(`%c[Audio] ambiance indisponible%c : ${url}`, "color:#f87171;font-weight:bold", "color:inherit");
  }

  private startAmbient(mapId: string) {
    this.abortCtrl = new AbortController();
    for (const track of AMBIENT[mapId] ?? []) {
      this.loadAndPlayLoop(track.url, track.vol ?? 1.0);
    }
  }

  private stopAmbient() {
    // Annule tous les fetches/decoders en cours
    this.abortCtrl?.abort();
    this.abortCtrl = null;

    // Arrête et libère les nœuds Web Audio
    if (this.ctx) {
      for (const node of this.ambientNodes) {
        try {
          // Fade-out rapide pour éviter le clic audio
          node.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
          node.source.stop(this.ctx.currentTime + 0.3);
        } catch { /* déjà arrêté */ }
      }
    }
    this.ambientNodes = [];

    if (this.oneshotTimer) {
      clearTimeout(this.oneshotTimer);
      this.oneshotTimer = null;
    }
  }

  // ── One-shots (sons surprises) ──────────────────────────────────────────────
  private scheduleAmbientOneshot(mapId: string) {
    const candidates = AMBIENT_ONESHOTS[mapId];
    if (!candidates || candidates.length === 0) return;
    const delay = AMBIENT_ONESHOT_MIN_MS
      + Math.random() * (AMBIENT_ONESHOT_MAX_MS - AMBIENT_ONESHOT_MIN_MS);
    this.oneshotTimer = setTimeout(async () => {
      if (this.currentMapId !== mapId) return;
      const url = candidates[Math.floor(Math.random() * candidates.length)];
      await this.playOneShotWebAudio(url, this.musicVolume * 0.22);
      this.scheduleAmbientOneshot(mapId);
    }, delay);
  }

  private async playOneShotWebAudio(url: string, vol: number): Promise<void> {
    const ctx = this.ensureContext();
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const ct = (res.headers.get("content-type") ?? "").toLowerCase();
      if (!ct.startsWith("audio/")) return;
      const buf = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(buf);
      const gain = ctx.createGain();
      gain.gain.value = clamp01(vol);
      gain.connect(ctx.destination);
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(gain);
      src.start();
    } catch { /* one-shot optionnel, échec silencieux */ }
  }

  // ── Musique thématique (AudioContext pour MP3/WAV via fetch+decode) ─────────
  // HTMLAudioElement refuse les MP3 dans Electron "ungoogled".
  // On charge la totalité du fichier en mémoire (6-11 Mo = acceptable pour une
  // musique qui joue en boucle), décode avec decodeAudioData, puis boucle.
  // Si décode échoue pour le MP3, essaie le .wav homonyme (fallback automatique).
  private currentMusicNode: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  // Génération de musique : incrémentée à chaque démarrage/arrêt. Un
  // startMapMusic asynchrone qui se découvre périmé (token changé pendant son
  // fetch/decode) ABANDONNE avant de créer son nœud → plus de nœud orphelin qui
  // jouerait en double (cause de "la musique se superpose / se répète").
  private musicToken = 0;

  private async startMapMusic(url: string): Promise<void> {
    const myToken = ++this.musicToken; // invalide toute lecture concurrente plus ancienne
    // Fade-out et arrêt de la musique précédente
    if (this.currentMusicNode) {
      const { gain } = this.currentMusicNode;
      const ctx = this.ctx;
      if (ctx) {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
        const src = this.currentMusicNode.source;
        try { setTimeout(() => src.stop(), 600); } catch { /* déjà stoppé */ }
      }
      this.currentMusicNode = null;
    }
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic.src = "";
      this.currentMusic = null;
    }

    const ctx = this.ensureContext();
    const urlsToTry = [url];
    if (/\.mp3$/i.test(url)) urlsToTry.push(toWavUrl(url));

    for (const tryUrl of urlsToTry) {
      try {
        const res = await fetch(tryUrl);
        if (!res.ok) continue;
        const ct = (res.headers.get("content-type") ?? "").toLowerCase();
        if (!ct.startsWith("audio/")) continue;
        const buf = await res.arrayBuffer();
        if (myToken !== this.musicToken) return; // périmé pendant le téléchargement
        const decoded = await ctx.decodeAudioData(buf.slice(0));
        // Une lecture plus récente (changement de map / stop) a pris la main →
        // on ABANDONNE avant de créer le nœud, sinon il devient orphelin et joue
        // en double indéfiniment.
        if (myToken !== this.musicToken) return;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.connect(ctx.destination);

        const source = ctx.createBufferSource();
        source.buffer = decoded;
        source.loop   = true;
        source.connect(gain);
        source.start();

        // Fade-in 2.5s
        gain.gain.linearRampToValueAtTime(this.musicVolume, ctx.currentTime + 2.5);
        this.currentMusicNode = { source, gain };
        this.currentTheme = "exploration";
        if (DEV) console.log(`%c[Audio] musique OK%c : ${tryUrl}`, "color:#86efac;font-weight:bold", "color:inherit");
        return;
      } catch (e) {
        if (DEV) console.warn(`[Audio] musique décode échoué : ${tryUrl}`, e);
      }
    }
    if (DEV) console.warn(`%c[Audio] musique indisponible : ${url}`, "color:#f87171;font-weight:bold");
  }

  // ── SFX nommés ──────────────────────────────────────────────────────────────
  playSfxKey(key: string, mult = 1.0) {
    const url = SFX_KEYS[key];
    if (url) this.fireOnce(url, mult);
  }

  // ── Voix spatiale PNJ ────────────────────────────────────────────────────────
  playVoice(url: string, playerX: number, playerZ: number, npcX: number, npcZ: number) {
    const dist = Math.hypot(playerX - npcX, playerZ - npcZ);
    const vol  = Math.max(0, 1 - dist / 14) * this.voiceVolume;
    if (vol < 0.02) return;
    const a = new Audio(url);
    a.volume = clamp01(vol);
    a.onerror = () => { if (DEV) diagnoseAudioFailure(url, a); };
    this.tryPlay(a);
  }

  // ── Bruits de pas ───────────────────────────────────────────────────────────
  private footstepFiles = [
    "sfx_mouvement/bruit-de-pas-dans-lherbe1.wav",
    "sfx_mouvement/pasdherbe.wav",
    "sfx_mouvement/pasdherbe2.wav",
  ];
  private lastFootstepIdx = -1;
  playFootstep(volMult = 1.0) {
    if (this.sfxVolume * volMult < 0.01) return;
    let idx = Math.floor(Math.random() * this.footstepFiles.length);
    if (idx === this.lastFootstepIdx) idx = (idx + 1) % this.footstepFiles.length;
    this.lastFootstepIdx = idx;
    this.fireOnce(sfxUrl(this.footstepFiles[idx]), volMult);
  }

  // ── Annonces vocales 2D (boss warning, killstreak, entrée de zone) ───────────
  // Non spatialisé, volume rehaussé (annonce prioritaire). `file` = nom du fichier
  // dans /models/voice_characters/.
  /** Annonce (kill streak) → EMPILÉE dans une file et jouée séquentiellement (pas de
   *  chevauchement) : chaque annonce attend la fin de la précédente. */
  playAnnouncement(file: string, mult = 1.6) {
    this.announceQueue.push({ url: voiceUrl(file), mult });
    if (this.announceQueue.length > 6) this.announceQueue.shift(); // anti-backlog runaway
    this.pumpAnnounce();
  }

  /** Joue la prochaine annonce de la file quand la précédente est finie. */
  private pumpAnnounce() {
    if (this.announceBusy) return;
    const next = this.announceQueue.shift();
    if (!next) return;
    const v = clamp01(this.sfxVolume * next.mult);
    let settled = false;
    const done = () => { if (settled) return; settled = true; this.announceBusy = false; this.pumpAnnounce(); };
    if (v < 0.001) { done(); return; }
    this.announceBusy = true;
    const a = new Audio(next.url);
    a.volume = v;
    // Filet : si 'ended' ne se déclenche pas (durée inconnue/échec), libère après un délai borné.
    const guard = setTimeout(done, 6000);
    const finish = () => { clearTimeout(guard); done(); };
    a.onended = finish;                                // fin → joue la suivante
    a.onerror = () => { if (DEV) diagnoseAudioFailure(next.url, a); finish(); };
    a.play().catch((e) => { if (DEV) console.warn("[Audio] annonce bloquée :", next.url, e.message); finish(); });
  }

  // ── Compat ancienne API ──────────────────────────────────────────────────────
  playSfx(name: string, mult = 1.0) { this.fireOnce(`/models/audio/sfx/${name}`, mult); }
  playButtonClick() { this.playSfx("Buttons/TAH Digital SFX Button 01.wav", 0.6); }

  // ── Musique thématique (login, combat) ───────────────────────────────────────
  async playMusic(theme: MusicTheme) {
    if (this.currentTheme === theme && theme !== "exploration") return;
    this.currentTheme = theme;
    const old = this.currentMusic;
    if (old) this.fadeOut(old, 1500).then(() => old.pause());
    this.playNextTrack(theme);
  }

  stopMusic() {
    this.musicToken++; // invalide tout startMapMusic asynchrone en cours (anti-orphelin)
    if (this.currentMusic) { this.currentMusic.pause(); this.currentMusic.src = ""; this.currentMusic = null; }
    // Arrête aussi le noeud musique AudioContext
    if (this.currentMusicNode && this.ctx) {
      try {
        this.currentMusicNode.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
        const src = this.currentMusicNode.source;
        setTimeout(() => { try { src.stop(); } catch { /* déjà arrêté */ } }, 400);
      } catch { /* ignore */ }
      this.currentMusicNode = null;
    }
    this.currentTheme = null;
  }

  stopAll() {
    this.stopMusic();
    this.stopAmbient();
    this.currentMapId = "";
    this.pendingMapId = ""; // sinon un setMap mis en attente AVANT le stop rejouerait au déverrouillage
  }

  // ── Déverrouillage autoplay ─────────────────────────────────────────────────
  private attachUnlockListeners() {
    if (typeof document === "undefined") return;
    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      if (DEV) console.log("[Audio] Déverrouillé par interaction utilisateur");

      // Reprend le contexte Web Audio si suspendu
      this.ctx?.resume().catch(() => {});

      document.removeEventListener("click",      unlock, true);
      document.removeEventListener("keydown",    unlock, true);
      document.removeEventListener("touchstart", unlock, true);

      // Relance les HTMLAudioElements en attente
      const pending = [...this.pendingPlays];
      this.pendingPlays = [];
      for (const a of pending) {
        a.play().catch((e) => { if (DEV) console.warn("[Audio] retry échoué:", a.src, e.message); });
      }

      // Relance la carte en attente
      if (this.pendingMapId) {
        const mapId = this.pendingMapId;
        this.pendingMapId = "";
        this.setMap(mapId);
      }
    };

    document.addEventListener("click",      unlock, true);
    document.addEventListener("keydown",    unlock, true);
    document.addEventListener("touchstart", unlock, true);
  }

  // ── Helpers privés (HTMLAudioElement pour musique/SFX) ──────────────────────
  private makeLoopingAudio(url: string, vol: number): HTMLAudioElement {
    const a = new Audio(url);
    a.loop   = true;
    a.volume = clamp01(vol);
    a.onerror = () => {
      if (DEV) diagnoseAudioFailure(url, a);
      if (a.error?.code === 4) {
        tryWavFallback(url, (wavUrl) => {
          a.src = wavUrl;
          a.play().catch(() => {});
        });
      }
    };
    return a;
  }

  private tryPlay(audio: HTMLAudioElement): Promise<void> {
    return audio.play().then(() => {
      this.pendingPlays = this.pendingPlays.filter((a) => a !== audio);
    }).catch((err: Error) => {
      if (DEV) console.warn(`[Audio] play() bloqué (${err.name}) — en file pour retry :`, audio.src);
      if (!this.pendingPlays.includes(audio)) this.pendingPlays.push(audio);
    });
  }

  private fireOnce(url: string, mult: number) {
    const v = clamp01(this.sfxVolume * mult);
    if (v < 0.001) return;
    const a = new Audio(url);
    a.volume = v;
    a.onerror = () => { if (DEV) diagnoseAudioFailure(url, a); };
    a.play().catch((e) => { if (DEV) console.warn("[Audio] SFX bloqué :", url, e.message); });
  }

  private playNextTrack(theme: MusicTheme) {
    if (this.currentTheme !== theme) return;
    const list = THEME_PLAYLISTS[theme];
    const url  = list[Math.floor(Math.random() * list.length)];
    const a    = new Audio(url);
    a.volume   = 0;
    a.onerror  = () => { this.currentMusic = null; };
    a.onended  = () => { if (this.currentTheme === theme) this.playNextTrack(theme); };
    this.currentMusic = a;
    a.play().then(() => this.fadeIn(a, this.musicVolume, 2000)).catch(() => {});
  }

  private fadeOut(audio: HTMLAudioElement, ms: number): Promise<void> {
    return new Promise((done) => {
      const start = audio.volume;
      if (start <= 0) { done(); return; }
      const step = 0.05;
      const iv = setInterval(() => {
        if (audio.volume > step) audio.volume -= step;
        else { audio.volume = 0; clearInterval(iv); done(); }
      }, (ms * step) / start);
    });
  }

  private fadeIn(audio: HTMLAudioElement, target: number, ms: number): Promise<void> {
    return new Promise((done) => {
      audio.volume = 0;
      if (target <= 0) { done(); return; }
      const step = 0.05;
      const iv = setInterval(() => {
        if (audio.volume < target - step) audio.volume += step;
        else { audio.volume = target; clearInterval(iv); done(); }
      }, (ms * step) / target);
    });
  }

  private loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem("narvos_audio_settings") ?? "{}");
      this.musicVolume = clamp01(s.music ?? 0.4);
      this.sfxVolume   = clamp01(s.sfx   ?? 0.5);
      this.voiceVolume = clamp01(s.voice ?? 1);
    } catch { /* ignore */ }
  }
  private saveSettings() {
    try {
      localStorage.setItem("narvos_audio_settings",
        JSON.stringify({ music: this.musicVolume, sfx: this.sfxVolume, voice: this.voiceVolume }));
    } catch { /* quota */ }
    // → base (par utilisateur). Import paresseux pour éviter tout cycle d'import.
    import("../rpg/persistence/dbStore").then((db) =>
      db.saveUserDb("audio_volumes", { music: this.musicVolume, sfx: this.sfxVolume, voice: this.voiceVolume })
    ).catch(() => { /* hors Electron */ });
  }

  /** Hydrate les volumes depuis la base (Electron). À appeler une fois au boot. */
  async hydrateFromDb(): Promise<void> {
    try {
      const db = await import("../rpg/persistence/dbStore");
      const s = await db.loadUserDb<{ music: number; sfx: number; voice?: number }>("audio_volumes");
      if (s) {
        if (typeof s.music === "number") this.setMusicVolume(clamp01(s.music));
        if (typeof s.sfx === "number") this.setSfxVolume(clamp01(s.sfx));
        if (typeof s.voice === "number") this.setVoiceVolume(clamp01(s.voice));
      }
    } catch { /* hors Electron */ }
  }
}

export const audioManager = AudioManager.getInstance();
