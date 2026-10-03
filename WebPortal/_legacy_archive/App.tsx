
import React, { useState, useEffect, useRef } from 'react';
import { MainMenu } from './components/MainMenu';
import { GameEngine } from './components/GameEngine';
import { LoadingScreen } from './components/LoadingScreen';
import { LoginScreen } from './components/LoginScreen';
import { ServerSelection } from './components/ServerSelection';
import { SettingsMenu } from './components/SettingsMenu';
import { GameState, GlobalSettings, GameServer, PlayerClass, Faction, CharacterCustomization } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { ClassSelectionMenu } from './components/ClassSelectionMenu';
import { Settings as SettingsIcon } from 'lucide-react';
import { databaseService, CharacterData } from './services/databaseService';
import { audioService } from './services/audioService';
import { TilesetEditor } from './components/TilesetEditor';
import { networkService } from './services/networkService';
import { IsometricPocViewer } from './components/iso_poc/IsometricPocViewer';

const App: React.FC = () => {
  const [currentGameState, setCurrentGameState] = useState<GameState>(GameState.LOGIN);
  const [showSettings, setShowSettings] = useState(false);
  const [showTilesetEditor, setShowTilesetEditor] = useState(false);
  // Sprint 1 POC: vue 3D iso temps reel (toggle F11). Isole, ne casse pas le moteur 2D.
  const [showIsoPoc, setShowIsoPoc] = useState(false);

  // User & Server State
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<GameServer | null>(null);

  // Keyboard Navigation (Escape Key)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSettings) {
          setShowSettings(false);
          return;
        }

        // Action based on state
        switch (currentGameState) {
          case GameState.SERVER_SELECTION:
            // Retour au login
            audioService.playLoginMusic(); // Relancer si on revient au login
            setCurrentGameState(GameState.LOGIN);
            break;
          case GameState.MENU:
            setCurrentGameState(GameState.SERVER_SELECTION);
            // Si on revient au menu de sélection serveur, on pourrait relancer la musique de login
            // audioService.playLoginMusic(); 
            break;
          case GameState.CHARACTER_SELECTION:
            setCurrentGameState(GameState.MENU);
            break;
          case GameState.PLAYING:
            // In GameEngine, Esc might open the in-game menu or pause
            break;
        }
      }

      // F10 to toggle Tileset Editor (PERSONAL TOOL)
      if (e.key === 'F10') {
        setShowTilesetEditor(prev => !prev);
      }

      // F11 to toggle Isometric 3D POC (DEV TOOL — Sprint 1)
      if (e.key === 'F11') {
        e.preventDefault(); // empeche le mode plein-ecran navigateur
        setShowIsoPoc(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentGameState, showSettings]);

  // Platform Integration (Narvos Native)
  useEffect(() => {
    console.log("🌌 [Narvos Engine] Initialisation de la plateforme native...");

    // LOAD CLIENT CONFIGURATION (TITAN ARCHITECTURE)
    fetch('/config.json')
      .then(res => res.json())
      .then(config => {
        console.log(`🔌 [Network] Configuration chargée: Serveur ${config.connection.host}:${config.connection.port}`);
        console.log(`v${config.game.version}`);

        // Connect to Gateway (Defaulting to ws://localhost:8082/ws for now as per config.json points to the PROXY Gateway)
        // In full config, gateway port should be specified.
        networkService.connect("ws://localhost:8082/ws");
      })
      .catch(err => console.warn("⚠️ [Network] Impossible de charger config.json, utilisation des valeurs par défaut."));

  }, []);

  // Settings
  const loadSettings = (): GlobalSettings => {
    try {
      const saved = localStorage.getItem('gameSettings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) { console.warn('[Settings] Failed to load saved settings:', e); }
    return DEFAULT_SETTINGS;
  };
  const [settings, setSettings] = useState<GlobalSettings>(loadSettings());

  // Appliquer les volumes initiaux
  useEffect(() => {
    audioService.setMasterVolume(settings.audio.masterVolume);
    audioService.setMusicVolume(settings.audio.masterVolume);
    audioService.playLoginMusic();
  }, []);

  const handleUpdateSettings = (newSettings: GlobalSettings) => {
    setSettings(newSettings);
    localStorage.setItem('gameSettings', JSON.stringify(newSettings));

    // Update audio volume in real-time
    audioService.setMasterVolume(newSettings.audio.masterVolume);
    audioService.setMusicVolume(newSettings.audio.masterVolume);
  };

  const [launchMode, setLaunchMode] = useState<'PLAYING' | 'EDITOR'>('PLAYING');
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedMapFaction, setSelectedMapFaction] = useState<string | null>(null);

  const handleStateChange = (newState: GameState, mode?: 'PLAYING' | 'EDITOR', mapId?: string, faction?: string) => {
    if (newState === GameState.EXIT) {
      setCurrentGameState(GameState.LOGIN);
      return;
    }

    if (mode) setLaunchMode(mode);
    if (mapId) setSelectedMapId(mapId);
    if (faction) setSelectedMapFaction(faction);
    setCurrentGameState(newState);
  };

  // ✅ Gestion Centralisée de la Musique (Transitions de States)
  useEffect(() => {
    if ([GameState.PLAYING, GameState.LOADING].includes(currentGameState)) {
      audioService.enterGame();
    } else {
      audioService.playLoginMusic();
      // On s'assure que si on revient au menu, la musique in-game s'arrête
      if (currentGameState === GameState.MENU || currentGameState === GameState.LOGIN) {
        audioService.stopGameMusic();
      }
    }
  }, [currentGameState]);

  // Flow Handlers
  const handleLoginSuccess = (name: string) => {
    setCurrentUser(name);
    setCurrentGameState(GameState.SERVER_SELECTION);
  };

  const handleServerSelect = async (server: GameServer) => {
    setSelectedServer(server);
    if (currentUser) {
      const chars = await databaseService.getCharacters(currentUser, server.id);
      setUserCharacters(chars);
    }
    setCurrentGameState(GameState.MENU);
  };

  const [characterData, setCharacterData] = useState<CharacterData | null>(null);

  const [userCharacters, setUserCharacters] = useState<CharacterData[]>([]);

  const handleCharacterSelected = async (data: {
    name: string,
    class: PlayerClass,
    faction: Faction,
    customization: CharacterCustomization
  }) => {
    if (currentUser) {
      const getStartingMap = (faction: Faction) => {
        switch (faction) {
          case Faction.HUMAN: return { fact: 'AQUARYS', map: 'AQUARYS_VILLE_01', p: 'aquarys' };
          case Faction.ALIEN: return { fact: 'FUNGARIA', map: 'FUNGARIA_VILLE_01', p: 'mycelion' };
          case Faction.MERCENARY: return { fact: 'DÉSERTICA', map: 'DÉSERTICA_VILLE_01', p: 'desertica' };
          default: return { fact: 'AQUARYS', map: 'AQUARYS_VILLE_01', p: 'aquarys' };
        }
      };

      const start = getStartingMap(data.faction);

      const newChar: CharacterData = {
        id: `char_${Date.now()}`,
        name: data.name,
        class: data.class,
        faction: data.faction,
        customization: data.customization,
        level: 1,
        experience: 0,
        lastPlanetId: start.p,
        lastFactionName: start.fact,
        lastMapName: start.map,
        createdAt: Date.now()
      };

      const result = await databaseService.createCharacter(currentUser, selectedServer?.id || 'normal_1', newChar);

      if (result.success) {
        setCharacterData(newChar);
        // On force le chargement de la map du personnage
        setSelectedMapId(newChar.lastMapName || 'Station_Spatiale_VILLE_01');
        setSelectedMapFaction(newChar.lastFactionName || 'Station_Spatiale');
        handleStateChange(GameState.LOADING);

        // Refresh user characters
        const updatedChars = await databaseService.getCharacters(currentUser, selectedServer?.id || 'normal_1');
        setUserCharacters(updatedChars);
      } else {
        alert("Erreur de création : " + result.message);
      }
    }
  };

  const handleCharacterLoad = (char: CharacterData) => {
    setCharacterData(char);
    if (char.lastMapName) setSelectedMapId(char.lastMapName);
    if (char.lastFactionName) setSelectedMapFaction(char.lastFactionName);
    handleStateChange(GameState.LOADING);
  };

  // Dev Tool & Portal Listener: Change Map on the fly
  useEffect(() => {
    const handleNavMap = (e: any) => {
      const { faction, mapId } = e.detail;
      setSelectedMapFaction(faction);
      setSelectedMapId(mapId);

      // Enregistrer la position si on a un personnage actif
      if (characterData && currentUser) {
        const updatedChar = {
          ...characterData,
          lastFactionName: faction,
          lastMapName: mapId
        };
        databaseService.createCharacter(currentUser, selectedServer?.id || 'normal_1', updatedChar);
        setCharacterData(updatedChar);
      }

      setCurrentGameState(GameState.LOADING);
    };

    window.addEventListener('nav-map', handleNavMap);
    return () => window.removeEventListener('nav-map', handleNavMap);
  }, [characterData, currentUser, selectedServer, currentGameState]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950 relative selection:bg-blue-500/30">

      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black -z-10"></div>



      {/* Floating Gear Icon (Settings) - Hidden during loading/playing (it's in HUD) */}
      {![GameState.LOADING, GameState.PLAYING].includes(currentGameState) && (
        <button
          onClick={() => setShowSettings(true)}
          className="absolute top-6 right-6 z-50 p-3 bg-slate-900/50 border border-white/10 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-xl"
        >
          <SettingsIcon size={24} />
        </button>
      )}

      {/* Settings Overlay */}
      {showSettings && (
        <SettingsMenu
          settings={settings}
          onUpdate={handleUpdateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Isometric 3D POC (Dev Tool, F11) - isolated, ne touche pas le moteur 2D */}
      {showIsoPoc && (
        <>
          <IsometricPocViewer fullscreen faction="AKARLYS" />
          <button
            onClick={() => setShowIsoPoc(false)}
            style={{
              position: 'fixed', top: 12, right: 12, zIndex: 10000,
              padding: '8px 14px', background: 'rgba(11,15,21,0.85)',
              color: '#cfe8ff', border: '1px solid #2a3848', borderRadius: 6,
              fontFamily: 'ui-monospace, monospace', fontSize: 12, cursor: 'pointer',
            }}
          >
            Fermer (F11)
          </button>
        </>
      )}

      {/* Tileset Editor (Dev Tool) */}
      <TilesetEditor
        isOpen={showTilesetEditor}
        onClose={() => setShowTilesetEditor(false)}
        onTestMap={(faction, mapId) => {
          setShowTilesetEditor(false);
          handleStateChange(GameState.LOADING, 'PLAYING', mapId, faction);
        }}
      />

      {/* Login Screen */}
      {currentGameState === GameState.LOGIN && (
        <LoginScreen onLogin={handleLoginSuccess} />
      )}

      {/* Server Selection */}
      {currentGameState === GameState.SERVER_SELECTION && (
        <ServerSelection onSelect={handleServerSelect} />
      )}

      {/* Main Menu / Character Selection */}
      {currentGameState === GameState.MENU && (
        <MainMenu
          onStateChange={handleStateChange}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          currentUser={currentUser}
          characters={userCharacters}
          onSelectCharacter={(charId) => {
            const char = userCharacters.find(c => c.id === charId);
            if (char) handleCharacterLoad(char);
          }}
          onCreateCharacter={() => handleStateChange(GameState.CHARACTER_SELECTION)}
        />
      )}

      {currentGameState === GameState.LOADING && (
        <LoadingScreen
          onComplete={() => setCurrentGameState(GameState.PLAYING)}
          targetMapId={selectedMapId}
          mode={launchMode}
        />
      )}

      {currentGameState === GameState.CHARACTER_SELECTION && (
        <ClassSelectionMenu onSelect={handleCharacterSelected} />
      )}

      {currentGameState === GameState.PLAYING && (
        <GameEngine
          onExit={() => handleStateChange(GameState.MENU)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          initialMapId={selectedMapId}
          initialFaction={selectedMapFaction}
          characterData={characterData}
        />
      )}
    </div>
  );
};

export default App;
