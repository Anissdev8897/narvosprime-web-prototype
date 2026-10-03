
import React, { useState, useEffect } from 'react';
import { GlobalSettings, WorldSettings } from '../types';
import { Settings, Wind, Sun, Monitor, Save, Download, Upload, RotateCcw } from 'lucide-react';
import { saveService } from '../services/saveService';

interface InGameMenuProps {
  settings: GlobalSettings;
  onUpdate: (newSettings: GlobalSettings) => void;
  onResume: () => void;
  onOpenFullSettings?: () => void;
  onExit: () => void;
  onOpenBackups?: () => void;
  onSaveRequest?: () => Promise<void> | void;
  onOpenObjectCreation?: () => void;
}

export const InGameMenu: React.FC<InGameMenuProps> = ({
  settings, onUpdate, onResume, onOpenFullSettings, onExit, onOpenBackups
}) => {
  const [saveStats, setSaveStats] = useState<{ lastSaveTime: number; playTime: number; saveCount: number } | null>(null);

  useEffect(() => {
    saveService.getSaveStats().then(stats => setSaveStats(stats));
  }, []);

  const handleWorldChange = (key: keyof WorldSettings, value: any) => {
    onUpdate({
      ...settings,
      world: { ...settings.world, [key]: value }
    });
  };

  const handleExport = async () => {
    const data = await saveService.exportSaveData();
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nevaros_dofus_save_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        const success = await saveService.importSaveData(text);
        if (success) alert('Sauvegarde importée avec succès !');
        else alert('Erreur lors de l\'import.');
      }
    };
    input.click();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 bg-slate-950/70 backdrop-blur-md">
      <div className="w-[500px] bg-slate-900 border-l-4 border-cyan-500 shadow-2xl p-8 text-white relative">

        <h2 className="text-4xl font-black italic mb-1 text-cyan-500">PAUSE</h2>
        <div className="text-cyan-400/50 font-mono text-sm tracking-widest mb-8">// NEVAROS TACTICAL SYSTEM</div>

        <div className="space-y-8">

          {/* World Settings */}
          <div className="bg-black/30 p-5 rounded-xl border border-white/5">
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
              <Monitor size={14} /> Paramètres Visuels
            </h3>

            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <Sun size={16} className="text-yellow-500" />
                <span className="w-24 text-[10px] font-mono">LUMINOSITÉ</span>
                <input
                  type="range" min="0" max="2" step="0.1"
                  value={settings.world.brightness}
                  onChange={(e) => handleWorldChange('brightness', parseFloat(e.target.value))}
                  className="flex-1 h-1 bg-slate-800 accent-cyan-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <Wind size={16} className="text-blue-400" />
                <span className="w-24 text-[10px] font-mono">AMBIANCE</span>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={settings.world.windIntensity}
                  onChange={(e) => handleWorldChange('windIntensity', parseFloat(e.target.value))}
                  className="flex-1 h-1 bg-slate-800 accent-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Save System */}
          <div className="bg-black/30 p-5 rounded-xl border border-white/5">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onOpenBackups} className="flex items-center justify-center gap-2 py-3 px-4 text-xs font-bold bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/50 text-cyan-400 transition-all">
                <Save size={14} /> SAUVEGARDER
              </button>
              <button onClick={handleExport} className="flex items-center justify-center gap-2 py-3 px-4 text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 transition-all">
                <Download size={14} /> EXPORTER
              </button>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <button onClick={onResume} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 font-bold tracking-widest text-white transition-all transform hover:scale-[1.02]">
              REPRENDRE LA PARTIE
            </button>
            <button onClick={onExit} className="w-full py-4 bg-red-900/30 hover:bg-red-900/50 font-bold tracking-widest text-red-500 border border-red-900/50 transition-all">
              QUITTER
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};