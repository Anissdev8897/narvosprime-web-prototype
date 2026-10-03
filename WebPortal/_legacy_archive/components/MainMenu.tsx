import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GlobalSettings } from '../types';
import { SettingsMenu } from './SettingsMenu';
import { MapSelector } from './MapSelector';
import { Gamepad2, Settings, Power, Globe2, Volume2, Edit3, Grid } from 'lucide-react';
import { audioService } from '../services/audioService';

import { breedService } from '../services/breedService';
import { CharacterData } from '../services/databaseService';
import { User, UserPlus, Trash2, ArrowRight } from 'lucide-react';
import { CLASSES_DB } from '../constants';

interface MainMenuProps {
  onStateChange: (newState: GameState, mode?: 'PLAYING' | 'EDITOR', mapId?: string) => void;
  settings: GlobalSettings;
  onUpdateSettings: (s: GlobalSettings) => void;
  currentUser: string | null;
  characters: CharacterData[];
  onSelectCharacter: (id: string) => void;
  onCreateCharacter: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onStateChange,
  settings,
  onUpdateSettings,
  currentUser,
  characters,
  onSelectCharacter,
  onCreateCharacter
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [pendingLaunchMode, setPendingLaunchMode] = useState<'PLAYING' | 'EDITOR' | null>(null);

  // Sync Volume with Settings
  useEffect(() => {
    audioService.setMasterVolume(settings.audio.masterVolume);
    audioService.setMusicVolume(settings.audio.masterVolume);
  }, [settings.audio.masterVolume]);

  const handleLaunch = (mode: 'PLAYING' | 'EDITOR') => {
    setPendingLaunchMode(mode);
    setShowMapSelector(true);
  };

  const handleMapSelected = (mapId: string) => {
    if (pendingLaunchMode) {
      onStateChange(GameState.LOADING, pendingLaunchMode, mapId);
    }
    setShowMapSelector(false);
    setPendingLaunchMode(null);
  };

  const menuItems = [
    {
      label: 'REJOINDRE LE ROLEPLAY',
      icon: Globe2,
      action: () => onStateChange(GameState.LOADING, 'PLAYING', 'aquarys') // ✅ Lancement direct sur AQUARYS
    },

    {
      label: 'SYSTEM OPTIONS',
      icon: Settings,
      action: () => setShowSettings(true)
    },
    {
      label: 'TERMINATE',
      icon: Power,
      action: () => onStateChange(GameState.EXIT)
    }
  ];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (showSettings || showMapSelector) return;

    if (e.key === 'ArrowUp' || e.key === 'w') {
      setSelectedIndex(prev => (prev - 1 + menuItems.length) % menuItems.length);
    } else if (e.key === 'ArrowDown' || e.key === 's') {
      setSelectedIndex(prev => (prev + 1) % menuItems.length);
    } else if (e.key === 'Enter') {
      menuItems[selectedIndex].action();
    }
  }, [selectedIndex, menuItems, showSettings, showMapSelector]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="absolute inset-0 flex flex-col items-start justify-center bg-[url('/textures/launcher/ui/server_warrior.png')] bg-cover bg-center"
      style={{
        pointerEvents: 'auto',
        cursor: 'default',
        zIndex: 9999
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent" style={{ pointerEvents: 'none' }}></div>

      {showSettings && (
        <SettingsMenu
          settings={settings}
          onUpdate={onUpdateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showMapSelector && pendingLaunchMode && (
        <MapSelector
          isOpen={true}
          onSelect={handleMapSelected}
          onCancel={() => {
            setShowMapSelector(false);
            setPendingLaunchMode(null);
          }}
          mode={pendingLaunchMode} // ✅ Passer le mode ici
        />
      )}

      {!showSettings && !showMapSelector && (
        <div className="relative z-10 ml-24 w-full max-w-2xl" style={{ pointerEvents: 'auto' }}>
          <div className="mb-12 space-y-4 border-l-4 border-blue-600 pl-8">
            <h1 className="text-8xl font-black tracking-tighter text-white">
              NARVOS
              <span className="text-blue-500">.</span>
            </h1>
            <div className="flex items-center gap-4 text-blue-400/80 font-mono tracking-[0.3em] text-sm">
              <span>// BIENVENUE, {currentUser?.toUpperCase()}</span>
              <span className="w-12 h-[1px] bg-blue-500/50"></span>
              <span>SÉLECTIONNEZ VOTRE ÂME</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 mb-8">
            {characters.length > 0 ? (
              characters.map((char) => {
                const breed = char.breedId ? breedService.getBreedById(char.breedId) : null;
                const icon = breed ? breedService.getBreedIcon(breed.id) : CLASSES_DB[char.class]?.icon;
                const className = breed ? breed.name : CLASSES_DB[char.class]?.name;

                return (
                  <button
                    key={char.id}
                    onClick={() => onSelectCharacter(char.id)}
                    className="group relative flex items-center w-full p-4 bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl hover:bg-blue-600/20 hover:border-blue-500/50 transition-all duration-300 transform hover:translate-x-4"
                  >
                    <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center text-4xl mr-6 border border-white/10 group-hover:bg-blue-500 transition-colors">
                      {icon}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-2xl font-black text-white uppercase italic tracking-tighter">{char.name}</div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">{className}</span>
                        <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                        <span className="text-[10px] text-yellow-500 font-bold">LVL {char.level}</span>
                      </div>
                    </div>
                    <div className="mr-8 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">[ CHARGER ]</span>
                      <ArrowRight size={16} className="text-blue-400" />
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="p-8 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center opacity-30">
                <User size={48} className="mb-4" />
                <div className="text-sm font-bold uppercase tracking-widest text-center">Aucun personnage trouvé sur ce secteur</div>
              </div>
            )}

            {characters.length < 5 && (
              <button
                onClick={onCreateCharacter}
                className="group flex items-center w-full p-5 bg-blue-600/10 border-2 border-dashed border-blue-500/30 rounded-2xl hover:bg-blue-600/20 hover:border-blue-500/80 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mr-6 shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                  <UserPlus size={24} />
                </div>
                <div className="text-left">
                  <div className="text-xl font-black text-white uppercase italic tracking-tighter">Créer une nouvelle âme</div>
                  <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Initialiser une nouvelle simulation</div>
                </div>
              </button>
            )}
          </div>

          <div className="flex gap-4">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={item.action}
                  className="flex items-center gap-3 px-6 py-3 bg-slate-900 border border-white/5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all text-xs font-black uppercase tracking-widest"
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="absolute bottom-12 left-12 flex gap-8 text-[10px] text-slate-500 font-mono uppercase tracking-widest z-10">
        <div>Engine: 3D_WEBGL_RENDERER</div>
        <div>Build: v0.5.0-ALPHA</div>
        <div className="flex items-center gap-2">
          <Volume2 size={10} className={audioService.isLoginPlaying() ? "text-green-500 animate-pulse" : ""} />
          Audio: {Math.round(settings.audio.masterVolume * 100)}%
        </div>
      </div>
    </div>
  );
};
