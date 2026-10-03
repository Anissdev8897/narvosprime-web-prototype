import React, { useState, useEffect } from 'react';
import { CharacterModel } from './CharacterSelection';
import { characterKeyConfigService, CharacterKeyConfig, CharacterAnimationAction } from '../services/characterKeyConfigService';
import { Faction } from '../types';

interface CharacterKeyConfigMenuProps {
  character: CharacterModel | null;
  onClose: () => void;
}

export const CharacterKeyConfigMenu: React.FC<CharacterKeyConfigMenuProps> = ({ character, onClose }) => {
  const [config, setConfig] = useState<CharacterKeyConfig | null>(null);
  const [listeningFor, setListeningFor] = useState<keyof CharacterAnimationAction | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  useEffect(() => {
    if (character) {
      const characterConfig = characterKeyConfigService.getConfig(
        character.id,
        character.name,
        character.faction
      );
      setConfig(characterConfig);
    }
  }, [character]);

  // Gérer la fermeture avec ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && character) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [character, onClose]);

  useEffect(() => {
    if (!listeningFor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Gérer les combinaisons de touches (Ctrl, Alt, Shift)
      let keyString = '';
      if (e.ctrlKey) keyString += 'ctrl+';
      if (e.altKey) keyString += 'alt+';
      if (e.shiftKey) keyString += 'shift+';
      
      // Normaliser la touche
      if (e.key === ' ') {
        keyString += ' ';
      } else {
        keyString += e.key.toLowerCase();
      }

      if (config && character) {
        // Vérifier les conflits
        const conflict = characterKeyConfigService.checkKeyConflict(character.id, keyString, listeningFor);
        if (conflict) {
          setConflictWarning(`⚠️ Cette touche est déjà utilisée par ${conflict}`);
          setTimeout(() => setConflictWarning(null), 3000);
          setListeningFor(null);
          return;
        }

        // Mettre à jour la configuration
        characterKeyConfigService.updateAction(character.id, listeningFor, keyString);
        const updated = characterKeyConfigService.getConfig(character.id, character.name, character.faction);
        setConfig(updated);
        setConflictWarning(null);
      }

      setListeningFor(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [listeningFor, config, character]);

  if (!character || !config) {
    return null;
  }

  // Obtenir les animations disponibles pour ce personnage
  const availableAnimations = character.animations || {};
  const animationLabels: Record<string, string> = {
    jump: 'Sauter',
    sprint: 'Sprint',
    dance: 'Danser',
    sit: 'S\'asseoir',
    lieDown: 'S\'allonger',
    drink: 'Boire',
    collect: 'Collecter',
    interact: 'Interagir',
    swimUp: 'Nager vers le haut',
    swimDown: 'Nager vers le bas',
    ability1: 'Compétence 1',
    ability2: 'Compétence 2',
    ability3: 'Compétence 3'
  };

  // Filtrer les actions disponibles selon les animations du personnage
  const availableActions: Array<keyof CharacterAnimationAction> = [];
  
  // Actions de base (toujours disponibles)
  availableActions.push('jump', 'sprint');
  
  // Actions conditionnelles selon les animations disponibles
  if (availableAnimations.dance) availableActions.push('dance');
  if (availableAnimations.sit) availableActions.push('sit');
  if (availableAnimations.lieDown) availableActions.push('lieDown');
  if (availableAnimations.drink) availableActions.push('drink');
  if (availableAnimations.collect) availableActions.push('collect');
  if (availableAnimations.swim || availableAnimations.swimIdle) {
    availableActions.push('swimUp', 'swimDown');
  }
  
  // Compétences (toujours disponibles pour l'avenir)
  availableActions.push('ability1', 'ability2', 'ability3');

  const formatKey = (key: string): string => {
    if (key === ' ') return 'ESPACE';
    return key.toUpperCase().replace('+', ' + ');
  };

  const handleReset = () => {
    if (character) {
      characterKeyConfigService.resetConfig(character.id, character.name, character.faction);
      const resetConfig = characterKeyConfigService.getConfig(character.id, character.name, character.faction);
      setConfig(resetConfig);
    }
  };

  const getFactionColor = (faction: Faction): string => {
    switch (faction) {
      case Faction.HUMAN:
        return 'border-blue-500 bg-blue-500/10';
      case Faction.ALIEN:
        return 'border-purple-500 bg-purple-500/10';
      case Faction.MERCENARY:
        return 'border-yellow-500 bg-yellow-500/10';
      default:
        return 'border-slate-500 bg-slate-500/10';
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-md text-white z-50">
      <div className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900/95 border-2 ${getFactionColor(character.faction)} rounded-lg shadow-2xl`}>
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 border-b border-white/10 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Configuration des Touches</h2>
            <p className="text-sm text-slate-400">{character.name}</p>
            <p className="text-xs text-slate-500 mt-1">
              {availableActions.length} actions disponibles pour ce personnage
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-300 rounded transition-all"
          >
            Fermer [ESC]
          </button>
        </div>

        {/* Conflict Warning */}
        {conflictWarning && (
          <div className="mx-6 mt-4 p-3 bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 rounded text-sm">
            {conflictWarning}
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableActions.map((action) => {
              const hasAnimation = action === 'jump' || action === 'sprint' || 
                                   (action === 'dance' && availableAnimations.dance) ||
                                   (action === 'sit' && availableAnimations.sit) ||
                                   (action === 'lieDown' && availableAnimations.lieDown) ||
                                   (action === 'drink' && availableAnimations.drink) ||
                                   (action === 'collect' && availableAnimations.collect) ||
                                   (action.startsWith('swim') && (availableAnimations.swim || availableAnimations.swimIdle)) ||
                                   action.startsWith('ability');

              return (
                <div
                  key={action}
                  className={`p-4 rounded-lg border ${
                    hasAnimation
                      ? 'bg-slate-800/50 border-white/10'
                      : 'bg-slate-900/30 border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm font-semibold text-white">
                        {animationLabels[action] || action}
                      </span>
                      {!hasAnimation && (
                        <span className="ml-2 text-xs text-slate-500">(Non disponible)</span>
                      )}
                    </div>
                    <button
                      onClick={() => hasAnimation && setListeningFor(action)}
                      disabled={!hasAnimation}
                      className={`
                        w-40 h-10 border rounded flex items-center justify-center text-xs font-bold transition-all
                        ${listeningFor === action
                          ? 'bg-red-500/30 border-red-500 text-red-300 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.6)]'
                          : hasAnimation
                          ? 'bg-slate-700/50 border-white/20 text-white hover:bg-slate-600 hover:border-white/40'
                          : 'bg-slate-900/50 border-white/5 text-slate-500 cursor-not-allowed'}
                      `}
                    >
                      {listeningFor === action
                        ? 'APPUYEZ...'
                        : config.animations[action]
                        ? formatKey(config.animations[action])
                        : 'NON DÉFINI'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-4 justify-end border-t border-white/10 pt-6">
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-slate-700/50 hover:bg-slate-600 border border-white/20 text-white rounded transition-all"
            >
              Réinitialiser
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-300 rounded transition-all"
            >
              Sauvegarder
            </button>
          </div>

          {/* Info */}
          <div className="mt-4 text-xs text-slate-500 text-center">
            * Cliquez sur un bouton et appuyez sur une touche pour la redéfinir
            <br />
            * Les configurations sont sauvegardées automatiquement par personnage
            <br />
            * Chaque personnage possède sa propre configuration isolée
          </div>
        </div>
      </div>
    </div>
  );
};

