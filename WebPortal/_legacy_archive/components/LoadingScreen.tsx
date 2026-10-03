import React, { useEffect, useState, useRef } from 'react';
import { PreloadProgress } from '../services/preloadService';
import { preloadService } from '../services/preloadService';
import { Loader2, CheckCircle, AlertCircle, Database, ShieldCheck } from 'lucide-react';
import { audioService } from '../services/audioService';

interface LoadingScreenProps {
  onComplete: () => void;
  targetMapId: string | null;
  mode: 'PLAYING' | 'EDITOR';
}

const STAGE_LABELS: Record<PreloadProgress['stage'], string> = {
  'AI_MODEL': 'Chargement de l\'IA locale...',
  'MODELS': 'Construction du monde en cours...',
  'TEXTURES': 'Génération des paysages et de l\'atmosphère...',
  'ANIMATIONS': 'Assemblage des structures et des installations...',
  'MOBS': 'Formation des entités vivantes et des créatures...',
  'SHADERS': 'Initialisation des océans et des environnements...',
  'MAPS': 'Téléchargement et mise en cache des environnements...',
  'COMPLETE': 'Monde prêt. Bienvenue dans Narvos Prime.'
};

const STAGE_ICONS: Record<PreloadProgress['stage'], React.ReactNode> = {
  'AI_MODEL': <Loader2 className="animate-spin" size={20} />,
  'MODELS': <Loader2 className="animate-spin" size={20} />,
  'TEXTURES': <Loader2 className="animate-spin" size={20} />,
  'ANIMATIONS': <Loader2 className="animate-spin" size={20} />,
  'MOBS': <Loader2 className="animate-spin" size={20} />,
  'SHADERS': <Loader2 className="animate-spin" size={20} />,
  'MAPS': <Database className="animate-pulse" size={20} />,
  'COMPLETE': <CheckCircle size={20} className="text-green-400" />
};

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete, targetMapId, mode }) => {
  const [progress, setProgress] = useState<PreloadProgress>({
    total: 100,
    loaded: 0,
    currentItem: 'Initialisation...',
    stage: 'AI_MODEL',
    percentage: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const loadingAmbienceRef = useRef<string | null>(null);

  useEffect(() => {
    // Utiliser la musique de login comme ambiance (valide dans /audio/music/)
    const ambiencePath = '/audio/music/login.wav';
    loadingAmbienceRef.current = ambiencePath;

    const startAmbience = async () => {
      try {
        // Charger et jouer l'ambiance en loop
        await audioService.loadAudio(ambiencePath, { loop: true, volume: 0.6 });
        await audioService.playSound(ambiencePath, { loop: true, volume: 0.6 });
        console.log('✅ Ambiance de chargement démarrée');
      } catch (err) {
        console.warn("⚠️ Ambiance de chargement non disponible:", err);
      }
    };

    startAmbience();

    const loadAssets = async () => {
      try {
        // Nettoyer le cache AVANT le chargement pour forcer le rechargement
        const { cacheService } = await import('../services/cacheService');
        try {
          await cacheService.clearCache();
          console.log('🧹 [LOADING] Cache nettoyé - Rechargement complet des ressources');
        } catch (cacheError) {
          console.warn('⚠️ [LOADING] Impossible de nettoyer le cache:', cacheError);
        }

        // Charger toutes les ressources
        await preloadService.preloadAll((prog) => {
          setProgress(prog);

          if (prog.stage === 'COMPLETE') {
            setIsComplete(true);
            // Arrêter l'ambiance de chargement avant de passer au jeu
            if (loadingAmbienceRef.current) {
              audioService.stopSound(loadingAmbienceRef.current);
              console.log('✅ Ambiance de chargement arrêtée');
            }
            // Attendre 500ms avant de passer directement au jeu (pas de menu)
            setTimeout(() => {
              onComplete(); // Appelle handleStateChange(GameState.PLAYING)
            }, 500);
          }
        });
      } catch (err) {
        console.error('❌ Erreur lors du préchargement:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      }
    };

    loadAssets();

    // Cleanup: arrêter l'ambiance si le composant est démonté
    return () => {
      if (loadingAmbienceRef.current) {
        audioService.stopSound(loadingAmbienceRef.current);
      }
    };
  }, [onComplete]);

  const getStageProgress = (): number => {
    const stageWeights: Record<PreloadProgress['stage'], number> = {
      'AI_MODEL': 10,
      'MAPS': 40, // Les maps sont lourdes
      'MODELS': 20,
      'TEXTURES': 15,
      'ANIMATIONS': 5,
      'MOBS': 5,
      'SHADERS': 3,
      'COMPLETE': 2
    };

    const stages: PreloadProgress['stage'][] = ['AI_MODEL', 'MAPS', 'MODELS', 'TEXTURES', 'ANIMATIONS', 'MOBS', 'SHADERS', 'COMPLETE'];
    const currentStageIndex = stages.indexOf(progress.stage);

    let totalProgress = 0;
    for (let i = 0; i < currentStageIndex; i++) {
      totalProgress += stageWeights[stages[i]];
    }

    // Ajouter le progrès de l'étape actuelle
    if (progress.stage !== 'COMPLETE') {
      const stageProgress = (progress.loaded / progress.total) * stageWeights[progress.stage];
      totalProgress += stageProgress;
    } else {
      totalProgress = 100;
    }

    return Math.min(totalProgress, 100);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 z-50">
      <div className="w-full max-w-2xl px-8">
        {/* Logo/Titre */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-4">
            NARVOS PRIME
          </h1>
          <p className="text-slate-400 text-lg font-mono mb-6">Initialisation du système planétaire...</p>

          {/* Messages d'avertissement immersifs */}
          <div className="space-y-3 mt-8">
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-left max-w-md mx-auto">
              <p className="text-red-400 font-bold text-sm mb-2">⚠️ AVERTISSEMENT</p>
              <p className="text-red-300 text-xs leading-relaxed">
                La mort est définitive. Vos choix influenceront la communication et la réputation dans votre faction.
              </p>
            </div>
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-left max-w-md mx-auto">
              <p className="text-blue-400 font-bold text-sm mb-2">ℹ️ RAPPEL</p>
              <p className="text-blue-300 text-xs leading-relaxed">
                Chaque décision compte. Les alliances et les trahisons façonnent votre destin dans l'univers de Narvos.
              </p>
            </div>
          </div>
        </div>

        {/* Barre de progression principale */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {STAGE_ICONS[progress.stage]}
              <span className="text-white font-bold text-lg">{STAGE_LABELS[progress.stage]}</span>
            </div>
            <span className="text-blue-400 font-mono text-lg">{getStageProgress().toFixed(0)}%</span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 ease-out relative"
              style={{ width: `${getStageProgress()}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            </div>
          </div>
        </div>

        {/* Détails du chargement */}
        <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-6 mb-6">
          <div className="space-y-3">
            {/* Étape actuelle */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Phase d'initialisation:</span>
              <span className="text-white font-mono text-sm capitalize">{progress.stage.toLowerCase().replace('_', ' ')}</span>
            </div>

            {/* Item en cours - version immersive */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Génération:</span>
              <span className="text-blue-400 font-mono text-xs truncate max-w-md text-right">
                {progress.currentItem.split('/').pop()?.replace(/_/g, ' ').replace(/\.(fbx|obj|gltf|glb|mtl)/gi, '') || 'Création en cours...'}
              </span>
            </div>

            {/* Progression détaillée */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Éléments générés:</span>
              <span className="text-green-400 font-mono text-sm">
                {progress.loaded} / {progress.total} composants
              </span>
            </div>

            {/* Cache Size & Security */}
            {progress.cacheSize && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 mt-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-green-400" />
                  <span className="text-slate-400 text-xs">Cache Sécurisé:</span>
                </div>
                <span className="text-yellow-400 font-mono text-xs">
                  {progress.cacheSize} installés
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Indicateurs d'étapes - Version immersive */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {([
            { stage: 'AI_MODEL', label: 'IA Locale' },
            { stage: 'MAPS', label: 'Maps' },
            { stage: 'MODELS', label: 'Monde' },
            { stage: 'TEXTURES', label: 'Paysages' },
            { stage: 'ANIMATIONS', label: 'Structures' },
            { stage: 'MOBS', label: 'Créatures' },
            { stage: 'SHADERS', label: 'Shaders' },
            { stage: 'COMPLETE', label: 'Prêt' }
          ] as { stage: PreloadProgress['stage'], label: string }[]).map(({ stage, label }) => {
            const isActive = progress.stage === stage;
            const isCompleted = ['COMPLETE', 'SHADERS', 'MOBS', 'ANIMATIONS', 'TEXTURES', 'MODELS', 'MAPS'].indexOf(progress.stage) > ['COMPLETE', 'SHADERS', 'MOBS', 'ANIMATIONS', 'TEXTURES', 'MODELS', 'MAPS'].indexOf(stage) || progress.stage === 'COMPLETE';

            // Logique simplifiée pour l'affichage
            const stagesOrder: PreloadProgress['stage'][] = ['AI_MODEL', 'MAPS', 'MODELS', 'TEXTURES', 'ANIMATIONS', 'MOBS', 'SHADERS', 'COMPLETE'];
            const currentIndex = stagesOrder.indexOf(progress.stage);
            const stageIndex = stagesOrder.indexOf(stage);
            const isDone = currentIndex > stageIndex || progress.stage === 'COMPLETE';

            return (
              <div
                key={stage}
                className={`p-2 rounded-lg border transition-all ${isDone
                  ? 'bg-green-900/20 border-green-500/30'
                  : isActive
                    ? 'bg-blue-900/20 border-blue-500/50'
                    : 'bg-slate-800/30 border-slate-700/30'
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {isDone ? (
                    <CheckCircle size={12} className="text-green-400" />
                  ) : isActive ? (
                    <Loader2 size={12} className="text-blue-400 animate-spin" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                  )}
                  <span className={`text-[10px] font-semibold uppercase ${isDone ? 'text-green-400' : isActive ? 'text-blue-400' : 'text-slate-500'
                    }`}>
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="text-red-400" size={20} />
            <div>
              <div className="text-red-400 font-bold text-sm">Erreur de chargement</div>
              <div className="text-red-300 text-xs mt-1">{error}</div>
            </div>
          </div>
        )}

        {/* Message de complétion */}
        {isComplete && (
          <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4 flex flex-col items-center gap-3 animate-pulse">
            <CheckCircle className="text-green-400" size={24} />
            <div className="text-center">
              <div className="text-green-400 font-bold text-lg mb-1">Monde initialisé avec succès</div>
              <div className="text-green-300 text-sm">Démarrage de la simulation en cours...</div>
            </div>
          </div>
        )}

        {/* Messages immersifs selon l'étape - Messages dynamiques */}
        <div className="text-center mt-8">
          <p className="text-slate-400 text-sm font-mono italic leading-relaxed max-w-lg mx-auto animate-pulse">
            {progress.message || (
              <>
                {progress.stage === 'AI_MODEL' && 'L\'IA locale analyse votre environnement...'}
                {progress.stage === 'MAPS' && 'Téléchargement des données topographiques haute résolution...'}
                {progress.stage === 'MODELS' && 'Les civilisations prennent forme. Les factions se préparent à l\'exploration interplanétaire...'}
                {progress.stage === 'TEXTURES' && 'Les océans se remplissent, les déserts s\'étendent, les forêts fongiques poussent...'}
                {progress.stage === 'ANIMATIONS' && 'Les structures s\'élèvent. Les installations militaires et civiles prennent vie...'}
                {progress.stage === 'MOBS' && 'Les créatures natives émergent de leurs habitats. La faune locale s\'active...'}
                {progress.stage === 'SHADERS' && 'L\'atmosphère se stabilise. Les conditions environnementales se normalisent...'}
                {progress.stage === 'COMPLETE' && 'Le monde est prêt. Votre aventure peut commencer. Que la fortune vous sourie, explorateur.'}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
