import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { preloadService } from '../services/preloadService';
import { cacheService } from '../services/cacheService';
import { audioService } from '../services/audioService';

interface MapTransitionScreenProps {
  planetId: string;
  onComplete: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  'CACHE_CHECK': 'Vérification du cache...',
  'MODELS': 'Préparation de la planète...',
  'COMPLETE': 'Planète prête. Transition terminée.'
};

export const MapTransitionScreen: React.FC<MapTransitionScreenProps> = ({ planetId, onComplete }) => {
  const [currentStage, setCurrentStage] = useState<string>('CACHE_CHECK');
  const [progress, setProgress] = useState(0);
  const [currentItem, setCurrentItem] = useState<string>('Initialisation...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMapAssets = async () => {
      try {
        // Étape 1: Vérifier le cache
        setCurrentStage('CACHE_CHECK');
        setProgress(10);
        setCurrentItem('Vérification des assets en cache...');
        await new Promise(resolve => setTimeout(resolve, 200));

        // Étape 2: Chargement DÉSACTIVÉ (pour diagnostiquer le crash)
        setCurrentStage('MODELS');
        setProgress(50);
        setCurrentItem('Préparation de la planète (chargement désactivé)...');
        console.log(`⏭️ Chargement d'assets DÉSACTIVÉ pour diagnostiquer le crash STATUS_BREAKPOINT`);
        await new Promise(resolve => setTimeout(resolve, 300));

        // Terminé
        setCurrentStage('COMPLETE');
        setProgress(100);
        setCurrentItem('Planète prête !');

        await new Promise(resolve => setTimeout(resolve, 500));
        onComplete();
      } catch (err) {
        console.error('Erreur lors du chargement de la map:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    };

    loadMapAssets();
  }, [planetId, onComplete]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 z-50">
      <div className="w-full max-w-2xl px-8">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-4">
            TRANSITION PLANÉTAIRE
          </h1>
          <p className="text-slate-400 text-lg font-mono mb-6">
            Chargement de {planetId.toUpperCase()}...
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {currentStage === 'COMPLETE' ? (
                <CheckCircle size={20} className="text-green-400" />
              ) : (
                <Loader2 size={20} className="text-blue-400 animate-spin" />
              )}
              <span className="text-white font-bold text-lg">{STAGE_LABELS[currentStage] || currentStage}</span>
            </div>
            <span className="text-blue-400 font-mono text-lg">{progress.toFixed(0)}%</span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-6 mb-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Étape:</span>
              <span className="text-white font-mono text-sm capitalize">{currentStage.toLowerCase().replace('_', ' ')}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Statut:</span>
              <span className="text-blue-400 font-mono text-xs truncate max-w-md text-right">
                {currentItem}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="text-red-400" size={20} />
            <div>
              <div className="text-red-400 font-bold text-sm">Erreur de chargement</div>
              <div className="text-red-300 text-xs mt-1">{error}</div>
            </div>
          </div>
        )}

        {currentStage === 'COMPLETE' && (
          <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4 flex flex-col items-center gap-3 animate-pulse">
            <CheckCircle className="text-green-400" size={24} />
            <div className="text-center">
              <div className="text-green-400 font-bold text-lg mb-1">Planète chargée</div>
              <div className="text-green-300 text-sm">Transition en cours...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
