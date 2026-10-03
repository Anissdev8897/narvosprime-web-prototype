
import React from 'react';
import { Faction, Stats, Spell } from '../types';
import { Heart, Zap, Sword, Shield, Briefcase, Book, Settings, Map as MapIcon, MessageSquare, Wind } from 'lucide-react';
import { DOFUS_SPELLS } from '../data/dofusSpells';

const FACTION_COLORS: Record<Faction, string> = {
    [Faction.HUMAN]: '#22d3ee', // Cyan
    [Faction.ALIEN]: '#a855f7', // Purple
    [Faction.MERCENARY]: '#eab308', // Yellow
    [Faction.HOSTILE]: '#ef4444', // Red
    [Faction.NEUTRAL]: '#94a3b8' // Slate
};

interface DofusHUDProps {
    playerFaction: Faction;
    stats: Stats;
    currentAp: number;
    currentMp: number;
    level: number;
    experience: number;
    xpToNextLevel: number;
    playerName: string;
    onSelectSpell: (spellId: string) => void;
    selectedSpellId: string | null;
    isEditMode?: boolean;
    onOpenInventory?: () => void;
    onOpenSettings?: () => void;

    // Combat Props
    isFightActive?: boolean;
    currentTurnTime?: number;
    onEndTurn?: () => void;
}

export const DofusHUD: React.FC<DofusHUDProps> = ({
    playerFaction,
    stats,
    currentAp,
    currentMp,
    level,
    experience,
    xpToNextLevel,
    playerName,
    onSelectSpell,
    selectedSpellId,
    isEditMode = false,
    onOpenInventory,
    onOpenSettings,
    isFightActive = false,
    currentTurnTime = 30,
    onEndTurn
}) => {

    // Use player stats directly for level if passed, otherwise fallback
    const currentLevel = level || 1;

    // Get stats from props or default
    const maxHp = stats.maxHp || 100;
    const currentHp = stats.hp || 100;

    const healthPercent = (currentHp / maxHp) * 100;
    const xpPercent = (experience / xpToNextLevel) * 100;

    // Filter spells dynamically based on Breed (from spell DB or context)
    // Here we use the first X spells for now, but ideally we should filter by breedId
    // Since we don't have breedId props, we will use a service call or improved props later.
    // FOR NOW: Display first 6 spells of DOFUS_SPELLS for testing
    // IMPROVEMENT: If we had breedId in props, we could do:
    // const breedSpells = breedService.getAvailableSpells(breedId, currentLevel);
    const factionSpells = DOFUS_SPELLS.slice(0, 8); // Display 8 spells

    return (
        <div className={`fixed bottom-0 left-0 right-0 h-24 bg-slate-900/95 border-t-2 border-slate-700 flex items-center px-4 gap-4 z-40 ${isEditMode ? 'opacity-50' : ''}`}>

            {/* Globe de Vie (Style Dofus) */}
            <div className="relative w-24 h-24 mb-6 rounded-full bg-slate-950 border-4 border-slate-800 overflow-hidden shadow-2xl flex-shrink-0 pointer-events-auto">
                <div
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-red-900 via-red-600 to-red-400 transition-all duration-1000"
                    style={{ height: `${healthPercent}%` }}
                >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-white/30 animate-pulse"></div>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white font-black text-sm drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                    {Math.ceil(stats.hp)}
                </div>
            </div>

            {/* Barre d'Actions Centrale (Style LoL / MMO) */}
            <div className="flex-1 flex flex-col items-center gap-1 pointer-events-auto">
                {/* Barre d'Expérience Fine */}
                <div className="h-1 w-[60%] bg-slate-950 rounded-full overflow-hidden border border-slate-800 mb-1">
                    <div
                        className="h-full bg-gradient-to-r from-blue-700 to-cyan-400 transition-all duration-300"
                        style={{ width: `${xpPercent}%` }}
                    />
                </div>

                {/* Grille de Sorts QWERDF+12 */}
                <div className="flex gap-2 justify-center">
                    {['Q', 'W', 'E', 'R', 'D', 'F', '1', '2'].map((key, i) => {
                        const spell = factionSpells[i];
                        const isSelected = spell && selectedSpellId === spell.id.toString();

                        // Element colors
                        const elementColor = spell?.element === 'Fire' ? 'bg-red-500' :
                            spell?.element === 'Earth' ? 'bg-orange-950' :
                                spell?.element === 'Water' ? 'bg-blue-500' :
                                    spell?.element === 'Air' ? 'bg-emerald-400' : 'bg-slate-500';

                        return (
                            <div
                                key={key}
                                onClick={() => spell && onSelectSpell(spell.id.toString())}
                                className={`relative w-14 h-14 bg-slate-950 border-2 rounded-lg transition-all flex items-center justify-center cursor-pointer group overflow-hidden
                                    ${isSelected ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6)]' : 'border-slate-700 hover:border-slate-500'}
                                    ${!spell ? 'opacity-20' : ''}
                                `}
                            >
                                {spell ? (
                                    <>
                                        {/* Icon Placeholder based on type */}
                                        <div className="flex flex-col items-center justify-center">
                                            <div className={`w-8 h-8 rounded-md flex items-center justify-center ${elementColor}/20 border border-${elementColor}/30`}>
                                                {spell.category === 'Attack' && <Sword size={18} className="text-red-500" />}
                                                {spell.category === 'Healing' && <Heart size={18} className="text-pink-500" />}
                                                {spell.category === 'Utility' && <Zap size={18} className="text-blue-400" />}
                                                {spell.category === 'Support' && <Shield size={18} className="text-yellow-500" />}
                                            </div>
                                        </div>

                                        {/* PA Cost */}
                                        <span className="absolute top-0.5 right-1 bg-blue-600/80 text-[8px] font-black px-1 rounded text-white">{spell.paCost}</span>

                                        {/* Shortcut Key */}
                                        <span className="absolute bottom-0.5 right-1 text-slate-500 font-black text-[10px]">{key}</span>
                                    </>
                                ) : (
                                    <div className="w-2 h-2 rounded-full bg-slate-800" />
                                )}

                                {/* Hover Tooltip */}
                                {spell && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 bg-slate-900/95 border-2 border-slate-700 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all w-48 shadow-2xl z-50 backdrop-blur-md">
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="text-[11px] font-black text-white uppercase tracking-wider">{spell.name}</div>
                                            <div className="text-[9px] text-blue-400 font-bold">{spell.paCost} PA</div>
                                        </div>
                                        <div className="text-[10px] text-slate-400 leading-tight mb-2 italic">"{spell.description}"</div>
                                        <div className="h-px bg-slate-700 w-full mb-2"></div>
                                        <div className="flex justify-between text-[10px]">
                                            <span className={`font-bold ${spell.element ? 'text-yellow-400' : 'text-slate-400'}`}>{spell.element || 'NEUTRE'}</span>
                                            <span className="text-slate-500 font-bold">PORTÉE: {spell.range[1]}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Turn Management (Combat Mode) */}
            {isFightActive && (
                <div className="flex flex-col items-center gap-2 mr-4">
                    <div className="w-16 h-16 rounded-full border-4 border-orange-500 bg-orange-900/80 flex items-center justify-center text-2xl font-black text-white shadow-[0_0_20px_rgba(249,115,22,0.6)] animate-pulse">
                        {currentTurnTime}
                    </div>
                    <button
                        onClick={onEndTurn}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded shadow-lg border-2 border-orange-400 uppercase text-xs tracking-wider transition-all transform hover:scale-105 active:scale-95"
                    >
                        Fin du Tour
                    </button>
                </div>
            )}

            {/* Compteurs PA / PM */}
            <div className="flex gap-2 items-center flex-shrink-0 pointer-events-auto">
                {/* PA */}
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-slate-950 border-4 border-blue-900/50 flex items-center justify-center shadow-inner relative">
                        <Zap size={20} className="text-blue-400 absolute opacity-20" />
                        <span className="text-blue-400 font-black text-lg">{currentAp}</span>
                    </div>
                    <span className="text-[9px] font-bold text-blue-500 uppercase">PA</span>
                </div>

                {/* PM */}
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-slate-950 border-4 border-green-900/50 flex items-center justify-center shadow-inner relative">
                        <Wind size={20} className="text-green-400 absolute opacity-20" />
                        <span className="text-green-400 font-black text-lg">{currentMp}</span>
                    </div>
                    <span className="text-[9px] font-bold text-green-500 uppercase">PM</span>
                </div>
            </div>

            {/* Boutons Menu Droite */}
            <div className="grid grid-cols-2 gap-1 pointer-events-auto flex-shrink-0">
                <button onClick={onOpenInventory} className="p-2 bg-slate-950 border border-slate-800 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-all"><Briefcase size={14} /></button>
                <button onClick={onOpenSettings} className="p-2 bg-slate-950 border border-slate-800 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-all"><Settings size={14} /></button>
                <button className="p-2 bg-slate-950 border border-slate-800 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-all"><MapIcon size={14} /></button>
                <button className="p-2 bg-slate-950 border border-slate-800 rounded bg-cyan-900/20 border-cyan-500/50 text-cyan-400 hover:bg-cyan-800/40 transition-all font-black text-[9px] tracking-tighter">PASS</button>
            </div>

            {/* Identity Badge */}
            <div className="absolute -top-7 left-12 px-3 py-1 bg-slate-900/95 border-2 border-slate-800 border-b-0 rounded-t-xl text-white font-mono text-[10px] flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: FACTION_COLORS[playerFaction] }}></span>
                    <span className="text-yellow-500 font-bold">LVL {level}</span>
                </div>
                <span className="text-slate-600">|</span>
                <span className="uppercase font-black tracking-[0.2em]">{playerName}</span>
            </div>
        </div>
    );
};
