
import React, { useState, useEffect } from 'react';
import { GlobalSettings, KeyBindings, AudioSettings, VideoSettings, GraphicsQuality, TextureQuality, AntiAliasing, MaxFPS, DisplayMode } from '../types';
import { Keyboard, Volume2, Music, Upload, Monitor, Settings } from 'lucide-react';

interface SettingsMenuProps {
  settings: GlobalSettings;
  onUpdate: (newSettings: GlobalSettings) => void;
  onClose: () => void;
  onReset?: () => void; // ✅ Callback pour la réinitialisation
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ settings, onUpdate, onClose, onReset }) => {
  const [activeTab, setActiveTab] = useState<'CONTROLS' | 'AUDIO' | 'VIDEO' | 'GAMEPLAY'>('CONTROLS');
  const [listeningFor, setListeningFor] = useState<keyof KeyBindings | null>(null);

  // Effect: Listen for the next keypress when a button is clicked
  useEffect(() => {
    if (!listeningFor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Normalize key name (Space bar usually returns ' ' or 'Space')
      const keyName = e.key === ' ' ? ' ' : e.key.toLowerCase();

      onUpdate({
        ...settings,
        keys: { ...settings.keys, [listeningFor]: keyName }
      });

      setListeningFor(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [listeningFor, settings, onUpdate]);

  const handleAudioChange = (key: keyof AudioSettings, value: number) => {
    onUpdate({
      ...settings,
      audio: { ...settings.audio, [key]: value }
    });
  };

  const handleImportAudio = () => {
    const fakeTrack = `Track_Import_${Math.floor(Math.random() * 1000)}.wav`;
    onUpdate({
      ...settings,
      audio: {
        ...settings.audio,
        customTracks: [...settings.audio.customTracks, fakeTrack]
      }
    });
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm text-white z-50">
      <div className="w-[800px] bg-slate-900/95 border border-cyan-500/30 rounded-lg flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.2)]">
        {/* Header - Style NARVOS PRIME */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 p-6 border-b border-cyan-500/30 flex justify-between items-center rounded-t-lg">
          <div className="flex items-center gap-3">
            <Settings className="text-cyan-400" size={24} />
            <h2 className="text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-200">PARAMÈTRES</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('CONTROLS')}
              className={`px-4 py-2 text-sm font-bold transition-all flex items-center gap-2 rounded ${activeTab === 'CONTROLS' ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-cyan-400'}`}
            >
              <Keyboard size={16} /> CONTRÔLES
            </button>
            <button
              onClick={() => setActiveTab('AUDIO')}
              className={`px-4 py-2 text-sm font-bold transition-all flex items-center gap-2 rounded ${activeTab === 'AUDIO' ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-cyan-400'}`}
            >
              <Volume2 size={16} /> AUDIO
            </button>
            <button
              onClick={() => setActiveTab('VIDEO')}
              className={`px-4 py-2 text-sm font-bold transition-all flex items-center gap-2 rounded ${activeTab === 'VIDEO' ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-cyan-400'}`}
            >
              <Monitor size={16} /> VIDÉO
            </button>
            <button
              onClick={() => setActiveTab('GAMEPLAY')}
              className={`px-4 py-2 text-sm font-bold transition-all flex items-center gap-2 rounded ${activeTab === 'GAMEPLAY' ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-cyan-400'}`}
            >
              <Settings size={16} /> JEU
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 h-[400px] overflow-y-auto">

          {/* CONTROLS TAB */}
          {activeTab === 'CONTROLS' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2 text-xs text-slate-500 uppercase mb-4 border-b border-slate-700 pb-2">MOVEMENT & VIEW</div>

              {/* Sensibilité de la caméra */}
              <div className="col-span-2 flex items-center gap-4 bg-slate-800/50 p-3 rounded border border-white/5">
                <span className="w-48 text-sm font-mono text-slate-300">Camera Sensitivity</span>
                <input
                  type="range"
                  min="0.001"
                  max="0.01"
                  step="0.0005"
                  value={settings.cameraSensitivity || 0.002}
                  onChange={(e) => onUpdate({
                    ...settings,
                    cameraSensitivity: parseFloat(e.target.value)
                  })}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="w-16 text-right text-xs text-blue-400 font-mono">
                  {(settings.cameraSensitivity || 0.002).toFixed(4)}
                </span>
              </div>

              {Object.entries(settings.keys).map(([action, key]) => (
                <div key={action} className="flex justify-between items-center bg-slate-800/50 p-3 rounded border border-white/5">
                  <span className="text-sm font-mono text-slate-300 uppercase">{action.replace(/([A-Z])/g, ' $1').trim()}</span>

                  <button
                    onClick={() => setListeningFor(action as keyof KeyBindings)}
                    className={`
                        w-32 h-8 border border-white/20 rounded flex items-center justify-center text-xs font-bold transition-all
                        ${listeningFor === action
                        ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                        : 'bg-slate-900 border-white/20 text-white hover:bg-slate-800 hover:border-white/40'}
                    `}
                  >
                    {listeningFor === action
                      ? 'PRESS KEY...'
                      : (key === ' ' ? 'SPACE' : String(key).toUpperCase())}
                  </button>
                </div>
              ))}
              <div className="col-span-2 mt-4 text-[10px] text-slate-500 text-center">
                * Click on a button above and press any key to rebind.
              </div>
            </div>
          )}

          {/* VIDEO TAB */}
          {activeTab === 'VIDEO' && (
            <div className="space-y-6">
              <div className="text-xs text-slate-500 uppercase border-b border-slate-700 pb-1">Display & Graphics</div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">Résolution</label>
                  <select
                    value={settings.video.resolution}
                    onChange={(e) => onUpdate({ ...settings, video: { ...settings.video, resolution: e.target.value } })}
                    className="w-full bg-slate-800 border border-white/10 rounded p-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="1920x1080">1920 x 1080 (FHD)</option>
                    <option value="2560x1440">2560 x 1440 (QHD)</option>
                    <option value="3840x2160">3840 x 2160 (4K)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">Qualité Globale</label>
                  <select
                    value={settings.video.graphicsQuality}
                    onChange={(e) => onUpdate({ ...settings, video: { ...settings.video, graphicsQuality: e.target.value as any } })}
                    className="w-full bg-slate-800 border border-white/10 rounded p-2 text-sm"
                  >
                    <option value="ULTRA">Ultra / Cinematic</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low / Performance</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">Mode d'affichage</label>
                  <select
                    value={settings.video.displayMode}
                    onChange={(e) => onUpdate({ ...settings, video: { ...settings.video, displayMode: e.target.value as any } })}
                    className="w-full bg-slate-800 border border-white/10 rounded p-2 text-sm"
                  >
                    <option value="FULLSCREEN">Plein Écran</option>
                    <option value="WINDOWED">Fenêtré</option>
                    <option value="BORDERLESS">Fenêtré Sans Bordure</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">Limite FPS</label>
                  <select
                    value={settings.video.maxFPS}
                    onChange={(e) => onUpdate({ ...settings, video: { ...settings.video, maxFPS: parseInt(e.target.value) as any } })}
                    className="w-full bg-slate-800 border border-white/10 rounded p-2 text-sm"
                  >
                    <option value="30">30 FPS</option>
                    <option value="60">60 FPS</option>
                    <option value="120">120 FPS</option>
                    <option value="144">144 FPS</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.video.antiAliasing > 0}
                    onChange={(e) => onUpdate({ ...settings, video: { ...settings.video, antiAliasing: e.target.checked ? 4 : 0 } })}
                    className="w-4 h-4 rounded bg-slate-800 border-white/10"
                  />
                  <span className="text-sm font-mono text-slate-300">ACTIVER L'ANTI-ALIASING (4x)</span>
                </label>
              </div>
            </div>
          )}

          {/* AUDIO TAB */}
          {activeTab === 'AUDIO' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="text-xs text-slate-500 uppercase border-b border-slate-700 pb-1">Mixer Levels</div>
                {[
                  { label: 'Master Volume', key: 'masterVolume', icon: Volume2 },
                  { label: 'World Ambience', key: 'worldVolume', icon: Music },
                  { label: 'Character Voice', key: 'characterVolume', icon: Keyboard }, // reusing icon
                  { label: 'SFX', key: 'effectsVolume', icon: Volume2 }
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-4">
                    <item.icon size={18} className="text-slate-400" />
                    <span className="w-32 text-sm font-mono text-slate-300">{item.label}</span>
                    <input
                      type="range"
                      min="0" max="1" step="0.05"
                      // @ts-ignore
                      value={settings.audio[item.key]}
                      onChange={(e) => handleAudioChange(item.key as keyof AudioSettings, parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    {/* @ts-ignore */}
                    <span className="w-12 text-right text-xs text-blue-400">{(settings.audio[item.key] * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-slate-700">
                <div className="text-xs text-slate-500 uppercase mb-4">Custom Audio Injection</div>
                <div className="bg-slate-800 p-4 rounded border border-dashed border-slate-600 flex flex-col items-center justify-center gap-2">
                  <button onClick={handleImportAudio} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors">
                    <Upload size={16} /> Import Audio File
                  </button>
                  <div className="text-xs text-slate-500">Supported: .WAV, .OGG (Mock)</div>
                </div>
                {settings.audio.customTracks.length > 0 && (
                  <div className="mt-4 space-y-1">
                    <div className="text-[10px] text-slate-500">IMPORTED TRACKS:</div>
                    {settings.audio.customTracks.map((track, idx) => (
                      <div key={idx} className="text-xs font-mono text-green-400 flex items-center gap-2">
                        <Music size={10} /> {track}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* GAMEPLAY TAB */}
          {activeTab === 'GAMEPLAY' && (
            <div className="space-y-6">
              <div className="border border-red-500/30 bg-red-900/20 p-6 rounded-lg">
                <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                  ⚠️ DANGER ZONE
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  Si vous rencontrez des problèmes majeurs ou des bugs visuels sur la carte actuelle,
                  vous pouvez réinitialiser tous les changements. Cela effacera vos constructions et modifications.
                </p>
                {onReset && (
                  <button
                    onClick={() => {
                      if (confirm("Êtes-vous sûr de vouloir tout réinitialiser pour cette planète ? Cette action est irréversible.")) {
                        onReset();
                      }
                    }}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded border border-red-500 w-full transition-all"
                  >
                    RÉINITIALISER LA PLANÈTE ACTUELLE
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Style NARVOS PRIME */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 p-6 border-t border-cyan-500/30 flex justify-end gap-4 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-bold rounded hover:from-cyan-500 hover:to-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]"
          >
            SAUVEGARDER & FERMER
          </button>
        </div>
      </div>
    </div>
  );
};
