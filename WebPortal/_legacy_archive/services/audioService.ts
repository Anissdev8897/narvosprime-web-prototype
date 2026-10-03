/**
 * Service de gestion audio avec anti-spam et normalisation du volume
 * Gère le chargement des buffers, la lecture des sons et la prévention des spams
 */

export interface AudioConfig {
  volume?: number; // Volume normalisé (0.0 à 1.0)
  loop?: boolean;
  antiSpamDelay?: number; // Délai anti-spam en millisecondes
}

class AudioService {
  private static instance: AudioService;
  private audioBuffers: Map<string, HTMLAudioElement> = new Map();
  private playingSounds: Map<string, HTMLAudioElement> = new Map();
  private lastPlayTime: Map<string, number> = new Map();
  private masterVolume: number = 1.0;
  private musicVolume: number = 0.7;
  private defaultAntiSpamDelay: number = 150;

  // Login & Game music
  private loginMusic: HTMLAudioElement | null = null;
  private gameMusic: HTMLAudioElement | null = null;
  private isLoginMusicPlaying: boolean = false;
  private isGameMusicPlaying: boolean = false;
  private isInGame: boolean = false;

  // Chemins des musiques (Mis à jour vers /audio/music/)
  private readonly LOGIN_MUSIC_PATH = '/audio/music/login.wav';
  private readonly GAME_MUSIC_PATH = '/audio/music/station.wav';

  private constructor() {
    this.initAudio();
  }

  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  /**
   * Initialise les musiques
   */
  private initAudio(): void {
    // Musique de Login
    this.loginMusic = new Audio(this.LOGIN_MUSIC_PATH);
    this.loginMusic.loop = true;
    this.loginMusic.volume = 0;
    this.loginMusic.load();

    // Musique In-Game (Station)
    this.gameMusic = new Audio(this.GAME_MUSIC_PATH);
    this.gameMusic.loop = true;
    this.gameMusic.volume = 0;
    this.gameMusic.load();

    console.log('🎵 [AudioService] Musiques initialisées');
  }

  /**
   * Démarre la musique de login avec fade in
   */
  public playLoginMusic(): void {
    if (this.isInGame || this.isLoginMusicPlaying || !this.loginMusic) return;

    this.loginMusic.currentTime = 0;
    this.loginMusic.volume = 0;

    this.loginMusic.play().then(() => {
      this.isLoginMusicPlaying = true;
      this.fadeIn(this.loginMusic!, this.musicVolume * this.masterVolume, 2000);
      console.log('🎵 [AudioService] Musique de login démarrée');
    }).catch((e) => {
      console.warn('🎵 [AudioService] Autoplay bloqué:', e.message);
    });
  }

  /**
   * Arrête la musique de login avec fade out
   */
  public stopLoginMusic(): void {
    if (!this.loginMusic || !this.isLoginMusicPlaying) return;

    this.fadeOut(this.loginMusic, 1500, () => {
      if (this.loginMusic) {
        this.loginMusic.pause();
        this.loginMusic.currentTime = 0;
      }
      this.isLoginMusicPlaying = false;
      console.log('🎵 [AudioService] Musique de login arrêtée');
    });
  }

  /**
   * Démarre la musique In-Game
   */
  public playGameMusic(): void {
    if (this.isGameMusicPlaying || !this.gameMusic) return;

    this.gameMusic.currentTime = 0;
    this.gameMusic.volume = 0;

    this.gameMusic.play().then(() => {
      this.isGameMusicPlaying = true;
      this.fadeIn(this.gameMusic!, this.musicVolume * this.masterVolume, 2000);
      console.log('🎵 [AudioService] Musique In-Game démarrée');
    }).catch((e) => {
      console.warn('🎵 [AudioService] Autoplay bloqué In-Game:', e.message);
    });
  }

  /**
   * Arrête la musique In-Game
   */
  public stopGameMusic(): void {
    if (!this.gameMusic || !this.isGameMusicPlaying) return;

    this.fadeOut(this.gameMusic, 1500, () => {
      if (this.gameMusic) {
        this.gameMusic.pause();
        this.gameMusic.currentTime = 0;
      }
      this.isGameMusicPlaying = false;
      console.log('🎵 [AudioService] Musique In-Game arrêtée');
    });
  }

  /**
   * Appelé quand le joueur entre en jeu
   */
  public enterGame(): void {
    this.isInGame = true;
    this.stopLoginMusic();
    this.playGameMusic();
  }

  /**
   * Appelé quand le joueur quitte le jeu
   */
  public exitGame(): void {
    this.isInGame = false;
    this.stopGameMusic();
    this.playLoginMusic();
  }

  /**
   * Fade in progressif
   */
  private fadeIn(audio: HTMLAudioElement, targetVolume: number, duration: number): void {
    const steps = 30;
    const stepTime = duration / steps;
    const volumeStep = targetVolume / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      audio.volume = Math.min(volumeStep * currentStep, targetVolume);
      if (currentStep >= steps) clearInterval(interval);
    }, stepTime);
  }

  /**
   * Fade out progressif
   */
  private fadeOut(audio: HTMLAudioElement, duration: number, onComplete?: () => void): void {
    const steps = 30;
    const stepTime = duration / steps;
    const startVolume = audio.volume;
    const volumeStep = startVolume / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      audio.volume = Math.max(startVolume - (volumeStep * currentStep), 0);
      if (currentStep >= steps) {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, stepTime);
  }

  /**
   * Met à jour le volume de la musique
   */
  public setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    const targetBus = this.musicVolume * this.masterVolume;

    if (this.loginMusic && this.isLoginMusicPlaying) {
      this.loginMusic.volume = targetBus;
    }
    if (this.gameMusic && this.isGameMusicPlaying) {
      this.gameMusic.volume = targetBus;
    }
  }

  public getMusicVolume(): number { return this.musicVolume; }
  public isLoginPlaying(): boolean { return this.isLoginMusicPlaying; }
  public isGamePlaying(): boolean { return this.isGameMusicPlaying; }

  /**
   * Définir le volume maître
   */
  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    // Mettre à jour le volume de tous les sons en cours
    this.playingSounds.forEach((audio) => {
      audio.volume = this.masterVolume;
    });
  }

  /**
   * Charger un buffer audio (préchargement)
   */
  public async loadAudio(path: string, config: AudioConfig = {}): Promise<HTMLAudioElement> {
    // Vérifier si déjà chargé
    if (this.audioBuffers.has(path)) {
      return this.audioBuffers.get(path)!;
    }

    return new Promise((resolve, reject) => {
      const audio = new Audio(path);

      audio.addEventListener('canplaythrough', () => {
        // Normaliser le volume
        const normalizedVolume = config.volume !== undefined
          ? Math.max(0, Math.min(1, config.volume))
          : 0.7; // Volume par défaut normalisé à 70%

        audio.volume = normalizedVolume * this.masterVolume;
        audio.loop = config.loop || false;

        this.audioBuffers.set(path, audio);
        console.log(`✅ Audio chargé: ${path}`);
        resolve(audio);
      });

      audio.addEventListener('error', (error) => {
        const audioElement = error.target as HTMLAudioElement;
        const errorMessage = audioElement?.error?.message || '';

        // ERR_CACHE_OPERATION_NOT_SUPPORTED est une erreur Electron connue qui n'empêche pas le chargement
        // On l'ignore car le fichier se charge généralement quand même (visible dans les logs)
        if (errorMessage.includes('ERR_CACHE_OPERATION_NOT_SUPPORTED') ||
          errorMessage.includes('CACHE_OPERATION_NOT_SUPPORTED')) {
          console.warn(`⚠️ [AUDIO] Erreur de cache Electron pour ${path} (ignorée, le chargement peut continuer)`);
          // Ne pas rejeter, laisser une chance au chargement de réussir
          return;
        }

        // Pour les autres erreurs, rejeter normalement
        console.error(`❌ Erreur lors du chargement de l'audio ${path}:`, error);
        reject(error);
      });

      // Démarrer le chargement
      audio.load();
    });
  }

  /**
   * Jouer un son avec anti-spam
   */
  public playSound(
    path: string,
    config: AudioConfig = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Vérifier l'anti-spam
      const antiSpamDelay = config.antiSpamDelay || this.defaultAntiSpamDelay;
      const lastPlay = this.lastPlayTime.get(path) || 0;
      const now = Date.now();

      if (now - lastPlay < antiSpamDelay) {
        // Anti-spam actif, ignorer cette requête
        resolve();
        return;
      }

      // Mettre à jour le temps de dernière lecture
      this.lastPlayTime.set(path, now);

      // Récupérer ou charger l'audio
      let audio: HTMLAudioElement;

      if (this.audioBuffers.has(path)) {
        // Cloner l'audio pour permettre plusieurs lectures simultanées
        audio = this.audioBuffers.get(path)!.cloneNode() as HTMLAudioElement;
      } else {
        // Charger à la volée si pas encore chargé
        audio = new Audio(path);
        audio.volume = (config.volume !== undefined ? Math.max(0, Math.min(1, config.volume)) : 0.7) * this.masterVolume;
        audio.loop = config.loop || false;
      }

      // Normaliser le volume
      const normalizedVolume = config.volume !== undefined
        ? Math.max(0, Math.min(1, config.volume))
        : 0.7;
      audio.volume = normalizedVolume * this.masterVolume;
      audio.loop = config.loop || false;

      // Gérer les événements
      audio.addEventListener('ended', () => {
        this.playingSounds.delete(path);
        resolve();
      });

      audio.addEventListener('error', (error) => {
        console.error(`❌ Erreur lors de la lecture de l'audio ${path}:`, error);
        this.playingSounds.delete(path);
        reject(error);
      });

      // Jouer le son
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.playingSounds.set(path, audio);
            // Si pas de loop, résoudre immédiatement (ended sera appelé plus tard)
            if (!audio.loop) {
              resolve();
            }
          })
          .catch((error) => {
            console.error(`❌ Erreur lors du play() de l'audio ${path}:`, error);
            this.playingSounds.delete(path);
            reject(error);
          });
      } else {
        // Fallback pour navigateurs plus anciens
        this.playingSounds.set(path, audio);
        resolve();
      }
    });
  }

  /**
   * Arrêter un son en cours
   */
  public stopSound(path: string): void {
    const audio = this.playingSounds.get(path);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      this.playingSounds.delete(path);
    }
  }

  /**
   * Arrêter tous les sons
   */
  public stopAllSounds(): void {
    this.playingSounds.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.playingSounds.clear();
  }

  /**
   * Précharger plusieurs sons
   * Continue même si certains sons échouent
   */
  public async preloadSounds(sounds: Array<{ path: string; config?: AudioConfig }>): Promise<void> {
    const promises = sounds.map(async ({ path, config }) => {
      try {
        return await this.loadAudio(path, config);
      } catch (error) {
        console.warn(`⚠️ [AUDIO] Impossible de charger ${path}:`, error);
        return null; // Retourner null au lieu de rejeter
      }
    });

    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
    console.log(`✅ ${successCount}/${sounds.length} sons préchargés`);
  }
}

export const audioService = AudioService.getInstance();

