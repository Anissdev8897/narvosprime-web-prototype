import React, { useState } from 'react';
import { Faction, Gender } from '../types';

export interface CharacterModel {
  id: string;
  name: string;
  faction: Faction;
  gender: Gender;
  modelPath: string;
  basePath: string;
  animations?: {
    // Animations de base
    idle?: string;
    walk?: string;
    run?: string;
    jump?: string;
    // Animations de nage
    swim?: string;
    swimIdle?: string;
    swimForward?: string;
    // Animations sociales/émotes
    dance?: string;
    sit?: string;
    lieDown?: string;
    drink?: string;
    // Animations contextuelles
    collect?: string;
    crouch?: string;
    // Animations spécifiques par personnage
    [key: string]: string | undefined;
  };
}

const CHARACTER_MODELS: CharacterModel[] = [
  // AKARLYS (Humans)
  {
    id: 'civil_akarlys_homme',
    name: 'Citoyen Humain (Homme)',
    faction: Faction.HUMAN,
    gender: Gender.MALE,
    modelPath: '/character/civil_AKARLYS_homme/Animation_Walking_withSkin.fbx',
    basePath: '/character/civil_AKARLYS_homme',
    // ⚠️ ANIMATIONS DÉSACTIVÉES - Cause des bugs de mouvement
    // animations: {
    //   idle: '/character/civil_AKARLYS_homme/Animation_Stand_and_Drink_withSkin.fbx',
    //   walk: '/character/civil_AKARLYS_homme/Animation_Walking_withSkin.fbx',
    //   run: '/character/civil_AKARLYS_homme/Animation_Running_withSkin.fbx',
    //   jump: '/character/civil_AKARLYS_homme/Animation_Jump_Run_withSkin.fbx',
    //   sit: '/character/civil_AKARLYS_homme/Animation_Sit_and_Drink_withSkin.fbx',
    //   drink: '/character/civil_AKARLYS_homme/Animation_Stand_and_Drink_withSkin.fbx',
    //   dance: '/character/civil_AKARLYS_homme/Animation_Bass_Beats_withSkin.fbx',
    //   lieDown: '/character/civil_AKARLYS_homme/Animation_Lie_Down_Hands_Spread_withSkin.fbx'
    // }
  },
  {
    id: 'civil_akarlys_femme',
    name: 'Citoyenne Humaine (Femme)',
    faction: Faction.HUMAN,
    gender: Gender.FEMALE,
    modelPath: '/character/civil_AKARLYS_femme/Animation_Walking_withSkin.fbx',
    basePath: '/character/civil_AKARLYS_femme',
    // ⚠️ ANIMATIONS DÉSACTIVÉES - Cause des bugs de mouvement
    // animations: {
    //   idle: '/character/civil_AKARLYS_femme/Animation_Walking_withSkin.fbx',
    //   walk: '/character/civil_AKARLYS_femme/Animation_Walking_withSkin.fbx',
    //   run: '/character/civil_AKARLYS_femme/Animation_Running_withSkin.fbx',
    //   jump: '/character/civil_AKARLYS_femme/Animation_Jump_Run_withSkin.fbx',
    //   swim: '/character/civil_AKARLYS_femme/Animation_swimming_to_edge_withSkin.fbx',
    //   swimIdle: '/character/civil_AKARLYS_femme/Animation_Swim_Idle_withSkin.fbx',
    //   swimForward: '/character/civil_AKARLYS_femme/Animation_Swim_Forward_withSkin.fbx'
    // }
  },
  // ZAYAN (Aliens)
  {
    id: 'civil_zayan_homme',
    name: 'Citoyen Alien (Homme)',
    faction: Faction.ALIEN,
    gender: Gender.MALE,
    modelPath: '/character/civil_ZAYAN_homme/Animation_Walking_withSkin.fbx',
    basePath: '/character/civil_ZAYAN_homme',
    // ⚠️ ANIMATIONS DÉSACTIVÉES - Cause des bugs de mouvement
    // animations: {
    //   idle: '/character/civil_ZAYAN_homme/Animation_Stand_and_Drink_withSkin.fbx',
    //   walk: '/character/civil_ZAYAN_homme/Animation_Walking_withSkin.fbx',
    //   run: '/character/civil_ZAYAN_homme/Animation_Running_withSkin.fbx',
    //   jump: '/character/civil_ZAYAN_homme/Animation_Back_Jump_withSkin.fbx',
    //   sit: '/character/civil_ZAYAN_homme/Animation_Sit_and_Drink_withSkin.fbx',
    //   drink: '/character/civil_ZAYAN_homme/Animation_Stand_and_Drink_withSkin.fbx',
    //   dance: '/character/civil_ZAYAN_homme/Animation_Bass_Beats_withSkin.fbx',
    //   lieDown: '/character/civil_ZAYAN_homme/Animation_Lie_Down_Hands_Spread_withSkin.fbx'
    // }
  },
  {
    id: 'civil_zayan_femme',
    name: 'Citoyenne Alien (Femme)',
    faction: Faction.ALIEN,
    gender: Gender.FEMALE,
    modelPath: '/character/civil_ZAYAN_femme/Animation_Walking_withSkin.fbx',
    basePath: '/character/civil_ZAYAN_femme',
    // ⚠️ ANIMATIONS DÉSACTIVÉES - Cause des bugs de mouvement
    // animations: {
    //   idle: '/character/civil_ZAYAN_femme/Animation_Stand_and_Drink_withSkin.fbx',
    //   walk: '/character/civil_ZAYAN_femme/Animation_Walking_withSkin.fbx',
    //   run: '/character/civil_ZAYAN_femme/Animation_Running_withSkin.fbx',
    //   jump: '/character/civil_ZAYAN_femme/Animation_Jump_Run_withSkin.fbx',
    //   collect: '/character/civil_ZAYAN_femme/Animation_Collect_Object_withSkin.fbx',
    //   crouch: '/character/civil_ZAYAN_femme/Animation_Female_Crouch_Pick_Up_Place_Side_withSkin.fbx',
    //   sit: '/character/civil_ZAYAN_femme/Animation_Sit_and_Drink_withSkin.fbx',
    //   drink: '/character/civil_ZAYAN_femme/Animation_Stand_and_Drink_withSkin.fbx',
    //   lieDown: '/character/civil_ZAYAN_femme/Animation_Lie_Down_Hands_Spread_withSkin.fbx'
    // }
  },
  // MEZALAYIS (Mercenaries)
  {
    id: 'civil_mezalayis_homme',
    name: 'Citoyen Mercenaire (Homme)',
    faction: Faction.MERCENARY,
    gender: Gender.MALE,
    modelPath: '/character/civil_MEZALAYIS_homme/Animation_Walking_withSkin.fbx',
    basePath: '/character/civil_MEZALAYIS_homme',
    // ⚠️ ANIMATIONS DÉSACTIVÉES - Cause des bugs de mouvement
    // animations: {
    //   idle: '/character/civil_MEZALAYIS_homme/Animation_Stand_and_Drink_withSkin.fbx',
    //   walk: '/character/civil_MEZALAYIS_homme/Animation_Walking_withSkin.fbx',
    //   run: '/character/civil_MEZALAYIS_homme/Animation_Running_withSkin.fbx',
    //   jump: '/character/civil_MEZALAYIS_homme/Animation_Jump_Run_withSkin.fbx',
    //   sit: '/character/civil_MEZALAYIS_homme/Animation_Sit_and_Drink_withSkin.fbx',
    //   drink: '/character/civil_MEZALAYIS_homme/Animation_Stand_and_Drink_withSkin.fbx',
    //   dance: '/character/civil_MEZALAYIS_homme/Animation_Bass_Beats_withSkin.fbx',
    //   lieDown: '/character/civil_MEZALAYIS_homme/Animation_Lie_Down_Hands_Spread_withSkin.fbx'
    // }
  },
  {
    id: 'civil_mezalayis_femme',
    name: 'Citoyenne Mercenaire (Femme)',
    faction: Faction.MERCENARY,
    gender: Gender.FEMALE,
    modelPath: '/character/civil_MEZALAYIS_femme/Animation_Walking_withSkin.fbx',
    basePath: '/character/civil_MEZALAYIS_femme',
    // ⚠️ ANIMATIONS DÉSACTIVÉES - Cause des bugs de mouvement
    // animations: {
    //   idle: '/character/civil_MEZALAYIS_femme/Animation_Stand_and_Drink_withSkin.fbx',
    //   walk: '/character/civil_MEZALAYIS_femme/Animation_Walking_withSkin.fbx',
    //   run: '/character/civil_MEZALAYIS_femme/Animation_Running_withSkin.fbx',
    //   collect: '/character/civil_MEZALAYIS_femme/Animation_Collect_Object_withSkin.fbx',
    //   sit: '/character/civil_MEZALAYIS_femme/Animation_Sit_and_Drink_withSkin.fbx',
    //   drink: '/character/civil_MEZALAYIS_femme/Animation_Stand_and_Drink_withSkin.fbx',
    //   lieDown: '/character/civil_MEZALAYIS_femme/Animation_Lie_Down_Hands_Spread_withSkin.fbx'
    // }
  }
];

interface CharacterSelectionProps {
  onSelectCharacter: (character: CharacterModel) => void;
  faction?: Faction; // Faction du portail (optionnel, filtre les personnages)
}

export const CharacterSelection: React.FC<CharacterSelectionProps> = ({ onSelectCharacter, faction }) => {
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterModel | null>(null);

  // Filtrer les personnages selon la faction du portail
  const availableCharacters = faction
    ? CHARACTER_MODELS.filter(char => char.faction === faction)
    : CHARACTER_MODELS;

  const getFactionColor = (faction: Faction) => {
    switch (faction) {
      case Faction.HUMAN:
        return 'bg-blue-600 hover:bg-blue-700 border-blue-400';
      case Faction.ALIEN:
        return 'bg-purple-600 hover:bg-purple-700 border-purple-400';
      case Faction.MERCENARY:
        return 'bg-yellow-600 hover:bg-yellow-700 border-yellow-400';
      default:
        return 'bg-gray-600 hover:bg-gray-700 border-gray-400';
    }
  };

  const getFactionName = (faction: Faction) => {
    switch (faction) {
      case Faction.HUMAN:
        return 'Humains (AKARLYS)';
      case Faction.ALIEN:
        return 'Aliens (ZAYAN)';
      case Faction.MERCENARY:
        return 'Mercenaires (MEZALAYIS)';
      default:
        return 'Neutre';
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md z-50 text-white">
      <div className="max-w-6xl w-full px-8">
        <h2 className="text-5xl font-bold text-center mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-yellow-400 bg-clip-text text-transparent">
          SÉLECTION DE PERSONNAGE
        </h2>
        <p className="text-center text-slate-400 mb-8">
          Choisissez votre personnage. Ce choix déterminera votre faction, votre apparence et vos animations.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableCharacters.map((character) => (
            <button
              key={character.id}
              onClick={() => setSelectedCharacter(character)}
              className={`p-6 rounded-lg border-2 transition-all duration-300 ${selectedCharacter?.id === character.id
                  ? `${getFactionColor(character.faction)} scale-105 shadow-lg`
                  : 'bg-slate-800/50 border-slate-600 hover:border-slate-400 hover:bg-slate-800'
                }`}
            >
              <div className="text-center">
                <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold mb-3 ${character.faction === Faction.HUMAN ? 'bg-blue-500/20 text-blue-300' :
                    character.faction === Faction.ALIEN ? 'bg-purple-500/20 text-purple-300' :
                      'bg-yellow-500/20 text-yellow-300'
                  }`}>
                  {getFactionName(character.faction)}
                </div>
                <h3 className="text-xl font-bold mb-2">{character.name}</h3>
                <div className="text-sm text-slate-400">
                  {character.gender === Gender.MALE ? '👨' : '👩'} {character.gender === Gender.MALE ? 'Homme' : 'Femme'}
                </div>
              </div>
            </button>
          ))}
        </div>

        {selectedCharacter && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => onSelectCharacter(selectedCharacter)}
              className={`px-12 py-4 rounded-lg text-xl font-semibold transition-all duration-300 ${getFactionColor(selectedCharacter.faction)} shadow-lg hover:scale-105`}
            >
              CONFIRMER LE CHOIX
            </button>
          </div>
        )}

        <p className="text-center text-xs text-slate-500 mt-8">
          Ce choix est permanent et affecte votre faction, votre apparence et vos capacités.
        </p>
      </div>
    </div>
  );
};

export { CHARACTER_MODELS };

