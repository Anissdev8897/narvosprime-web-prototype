/**
 * @deprecated LEGACY — ClassCard (utilisé dans l'ancien menu création).
 *
 * REMPLACÉ PAR : src/components/character/CharacterCreateScreen.tsx (UI inline,
 * pas de carte séparée — fusion identité + stats + créer).
 *
 * À supprimer dans un cleanup ultérieur.
 */
import React from 'react';
import { ClassData } from '../types';
import { Star, Sword, Shield, Zap, Heart } from 'lucide-react';

interface Props {
  data: ClassData;
}

const RoleIcon: React.FC<{ type: string }> = ({ type }) => {
  const style = "w-8 h-8 p-1.5 rounded rotate-45 border-2 border-stone-600 shadow-lg mb-2";
  switch (type) {
    case 'damage': return <div className={`${style} bg-orange-700 text-white`}><Sword className="-rotate-45 w-full h-full" /></div>;
    case 'tank': return <div className={`${style} bg-blue-700 text-white`}><Shield className="-rotate-45 w-full h-full" /></div>;
    case 'support': return <div className={`${style} bg-pink-600 text-white`}><Heart className="-rotate-45 w-full h-full" /></div>;
    default: return <div className={`${style} bg-gray-600 text-white`}><Zap className="-rotate-45 w-full h-full" /></div>;
  }
};

export const ClassCard: React.FC<Props> = ({ data }) => {
  // Fallback for missing difficulty
  const difficulty = data.difficulty || 2;

  return (
    <div className="w-[350px] bg-stone-900/90 border-4 border-stone-700 rounded-lg overflow-hidden flex flex-col shadow-2xl backdrop-blur-sm z-10 relative">
      {/* Header */}
      <div className="bg-gradient-to-r from-stone-800 to-stone-700 p-4 border-b-4 border-stone-950 flex items-center gap-4">
        {/* Class Emblem */}
        <div
          className="w-16 h-16 rounded-full border-2 flex items-center justify-center shadow-lg"
          style={{
            backgroundColor: data.colors?.primary || '#1e293b',
            borderColor: data.colors?.secondary || '#84cc16'
          }}
        >
          <Sword style={{ color: data.colors?.secondary || '#84cc16' }} className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-3xl font-bold uppercase text-white tracking-wider">{data.name}</h2>
          <div style={{ color: data.colors?.primary || '#84cc16' }} className="font-bold uppercase text-sm tracking-widest">{data.roleTitle}</div>
          <div className="flex gap-1 mt-1">
            <span className="text-xs text-stone-400 mr-1 uppercase">Difficulté :</span>
            {[1, 2, 3].map(s => (
              <Star
                key={s}
                size={14}
                className={`${s <= difficulty ? 'fill-lime-400 text-lime-400' : 'text-stone-600'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content - Description */}
      <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        <p className="text-stone-300 text-sm leading-relaxed">{data.description}</p>

        {/* Stats Preview */}
        {data.stats && (
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="bg-stone-800/50 p-2 rounded text-center">
              <div className="text-red-400 text-xs font-bold">PV</div>
              <div className="text-white font-bold">{data.stats.hp || data.baseStats?.hp || '?'}</div>
            </div>
            <div className="bg-stone-800/50 p-2 rounded text-center">
              <div className="text-blue-400 text-xs font-bold">PA</div>
              <div className="text-white font-bold">{data.stats.pa || data.baseStats?.ap || '?'}</div>
            </div>
            <div className="bg-stone-800/50 p-2 rounded text-center">
              <div className="text-green-400 text-xs font-bold">PM</div>
              <div className="text-white font-bold">{data.stats.pm || data.baseStats?.mp || '?'}</div>
            </div>
          </div>
        )}

        {/* Spells Preview */}
        {data.spells && data.spells.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-stone-400 uppercase mb-2">Sorts</div>
            <div className="flex gap-2 flex-wrap">
              {data.spells.slice(0, 3).map((spell, idx) => (
                <div
                  key={idx}
                  className="px-2 py-1 bg-stone-800 rounded text-xs text-stone-300 border border-stone-600"
                  title={spell.description}
                >
                  {spell.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-2 bg-stone-950/50 text-center">
        <button className="text-xs text-lime-400 hover:text-white underline uppercase font-bold">En savoir plus</button>
      </div>
    </div>
  );
};