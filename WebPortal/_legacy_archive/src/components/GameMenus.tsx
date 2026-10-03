// ═══════════════════════════════════════════════════════════════════════════
// NARVOS PRIME - Game Menus (C/S/I)
// Menus de caractéristiques, sorts et inventaire
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
    X, Droplets, Flame, Wind, Mountain, Circle, Zap, Heart, Shield,
    Swords, Star, ArrowUp, Lock, ChevronRight, Package, Coins,
    Gem, Sparkles, Target, Move, Eye, Clock, TrendingUp, Award, Loader2,
    Wand2, ArrowLeft, ArrowRight
} from 'lucide-react';
import type { Element, CombatantStats, Spell, Item, Inventory, Equipment, EquipmentSlot } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES & HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const ELEMENT_CONFIG: Record<Element, { color: string; bgColor: string; icon: React.ReactNode; name: string }> = {
    eau: { color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: <Droplets size={16} />, name: 'Eau' },
    feu: { color: 'text-red-400', bgColor: 'bg-red-500/20', icon: <Flame size={16} />, name: 'Feu' },
    air: { color: 'text-green-400', bgColor: 'bg-green-500/20', icon: <Wind size={16} />, name: 'Air' },
    terre: { color: 'text-amber-400', bgColor: 'bg-amber-500/20', icon: <Mountain size={16} />, name: 'Terre' },
    neutre: { color: 'text-stone-400', bgColor: 'bg-stone-500/20', icon: <Circle size={16} />, name: 'Neutre' }
};

const RARITY_COLORS: Record<string, string> = {
    common: 'border-stone-500 text-stone-300',
    uncommon: 'border-green-500 text-green-300',
    rare: 'border-blue-500 text-blue-300',
    epic: 'border-purple-500 text-purple-300',
    legendary: 'border-orange-500 text-orange-300',
    mythic: 'border-red-500 text-red-300'
};

// ═══════════════════════════════════════════════════════════════════════════
// MENU CARACTÉRISTIQUES (Touche C)
// ═══════════════════════════════════════════════════════════════════════════

interface CharacterMenuProps {
    isOpen: boolean;
    onClose: () => void;
    stats: CombatantStats;
    statPoints: number;
    onAllocateStat: (stat: keyof CombatantStats | string, amount: number) => void;
    characterName: string;
    className: string;
    level: number;
}

export const CharacterMenu: React.FC<CharacterMenuProps> = ({
    isOpen,
    onClose,
    stats,
    statPoints,
    onAllocateStat,
    characterName,
    className,
    level
}) => {
    if (!isOpen) return null;

    const StatRow = ({
        label,
        value,
        icon,
        color = 'text-white',
        statKey,
        canAllocate = false
    }: {
        label: string;
        value: number | string;
        icon: React.ReactNode;
        color?: string;
        statKey?: string;
        canAllocate?: boolean;
    }) => (
        <div className="flex items-center justify-between py-2 border-b border-stone-700/50">
            <div className="flex items-center gap-2">
                <span className={color}>{icon}</span>
                <span className="text-stone-300">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className={`font-bold ${color}`}>{value}</span>
                {canAllocate && statPoints > 0 && statKey && (
                    <button
                        onClick={() => onAllocateStat(statKey, 1)}
                        className="w-5 h-5 bg-green-600 hover:bg-green-500 rounded text-white flex items-center justify-center text-xs"
                    >
                        +
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]" onClick={onClose}>
            <div
                className="w-[600px] max-h-[90vh] relative shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
                style={{
                    backgroundImage: 'url("/textures/ui/menu_panel.png")',
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                    borderRadius: '24px'
                }}
            >
                <div className="bg-gradient-to-r from-stone-900/40 to-indigo-950/40 backdrop-blur-sm p-6 flex items-center justify-between border-b border-white/5">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter drop-shadow-md">{characterName}</h2>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-indigo-600/40 rounded text-[10px] font-bold text-white uppercase border border-indigo-400/30">{className}</span>
                            <span className="text-indigo-300 text-xs font-bold uppercase tracking-widest">Niveau {level}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-all border border-white/10">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] scrollbar-hide flex flex-col items-center">
                    {statPoints > 0 && (
                        <div className="w-full mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center justify-between animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center text-yellow-500 shadow-inner">
                                    <Star size={24} />
                                </div>
                                <span className="text-yellow-100 font-bold uppercase text-sm tracking-wide">{statPoints} points à distribuer !</span>
                            </div>
                            <div className="bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-black">ACTION REQUISE</div>
                        </div>
                    )}

                    <div className="w-full max-w-[500px] flex flex-col gap-6">
                        <section>
                            <h3 className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mb-4 text-center">
                                STATS VITALITÉ
                            </h3>
                            <div className="bg-stone-950/60 backdrop-blur-md rounded-3xl p-4 border border-white/5 shadow-2xl">
                                <StatRow label="Points de Vie" value={`${stats.hp}/${stats.maxHp}`} icon={<Heart size={14} />} color="text-rose-400" statKey="maxHp" canAllocate />
                                <StatRow label="Points d'Action (PA)" value={`${stats.pa}/${stats.maxPa}`} icon={<Zap size={14} />} color="text-indigo-400" />
                                <StatRow label="Points de Mouvement (PM)" value={`${stats.pm}/${stats.maxPm}`} icon={<Move size={14} />} color="text-emerald-400" />
                                <StatRow label="Initiative" value={stats.initiative} icon={<TrendingUp size={14} />} color="text-amber-400" statKey="initiative" canAllocate />
                            </div>
                        </section>

                        <section>
                            <h3 className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mb-4 text-center">
                                PUISSANCE MILITAIRE
                            </h3>
                            <div className="bg-stone-950/60 backdrop-blur-md rounded-3xl p-4 border border-white/5 shadow-2xl">
                                <StatRow label="Puissance" value={`+${stats.puissance}%`} icon={<TrendingUp size={14} />} color="text-orange-400" statKey="puissance" canAllocate />
                                <StatRow label="Dommages fixes" value={`+${stats.dommages}`} icon={<Swords size={14} />} color="text-red-400" statKey="dommages" canAllocate />
                                <StatRow label="Critique" value={`${stats.critique}%`} icon={<Target size={14} />} color="text-yellow-400" statKey="critique" canAllocate />
                                <StatRow label="Dommages critiques" value={`+${stats.domCritique}%`} icon={<Sparkles size={14} />} color="text-amber-400" />
                            </div>
                        </section>

                        <section>
                            <h3 className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mb-4 text-center">
                                MAÎTRISES DE COMBAT
                            </h3>
                            <div className="grid grid-cols-5 gap-3">
                                {(Object.keys(ELEMENT_CONFIG) as Element[]).map(element => (
                                    <div
                                        key={element}
                                        className={`p-3 rounded-2xl bg-stone-950/60 border border-white/5 text-center relative overflow-hidden group hover:border-white/20 transition-all flex flex-col items-center justify-center`}
                                    >
                                        <div className={`absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity ${ELEMENT_CONFIG[element].bgColor}`}></div>
                                        <div className={`relative z-10 flex justify-center mb-1 ${ELEMENT_CONFIG[element].color}`}>
                                            {ELEMENT_CONFIG[element].icon}
                                        </div>
                                        <div className="relative z-10 text-[8px] text-stone-400 font-bold uppercase mb-1">{ELEMENT_CONFIG[element].name}</div>
                                        <div className={`relative z-10 font-black text-xs ${ELEMENT_CONFIG[element].color}`}>
                                            +{stats.maitrise[element]}%
                                        </div>
                                        {statPoints > 0 && (
                                            <button
                                                onClick={() => onAllocateStat(`maitrise.${element}`, 5)}
                                                className="relative z-10 mt-2 w-full text-[9px] bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-lg py-1 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                                            >
                                                UP
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>

                <div className="bg-black/40 backdrop-blur-md border-t border-white/5 p-4 text-center text-white/30 text-[10px] font-black uppercase tracking-[0.2em]">
                    Appuyez sur <kbd className="bg-white/10 px-2 py-0.5 rounded text-white/60">C</kbd> pour fermer
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MENU SORTS (Touche S)
// ═══════════════════════════════════════════════════════════════════════════

interface SpellMenuProps {
    isOpen: boolean;
    onClose: () => void;
    spells: Spell[];
    spellPoints: number;
    playerLevel: number;
    onUpgradeSpell: (spellId: string) => void;
}

export const SpellMenu: React.FC<SpellMenuProps> = ({
    isOpen,
    onClose,
    spells,
    spellPoints,
    playerLevel,
    onUpgradeSpell
}) => {
    const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);

    useEffect(() => {
        if (isOpen && spells.length > 0 && !selectedSpell) {
            setSelectedSpell(spells[0]);
        }
    }, [isOpen, spells, selectedSpell]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]" onClick={onClose}>
            <div
                className="w-[900px] h-[600px] relative shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
                style={{
                    backgroundImage: 'url("/textures/ui/menu_panel.png")',
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                    borderRadius: '24px'
                }}
            >
                <div className="p-8 pb-4 flex items-center justify-between border-b border-white/5 bg-black/20">
                    <div className="flex flex-col">
                        <h2 className="text-4xl font-black text-white uppercase tracking-[0.2em] drop-shadow-lg flex items-center gap-4">
                            <Wand2 className="text-indigo-400" size={32} />
                            Grimoire de Combat
                        </h2>
                        <div className="mt-2 text-indigo-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                            <Sparkles size={12} className="animate-pulse" />
                            {spellPoints > 0 ? `${spellPoints} points de sorts à utiliser` : 'Maîtrise Suprême'}
                        </div>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 bg-white/5 hover:bg-red-500/20 hover:border-red-500/50 rounded-2xl flex items-center justify-center text-white/50 hover:text-white transition-all border border-white/10 group">
                        <X size={24} className="group-hover:rotate-90 transition-transform" />
                    </button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-hidden relative">
                    <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                        <Sparkles size={400} className="text-indigo-500 animate-pulse" />
                    </div>

                    <div className="w-full flex items-center justify-between gap-8 z-10">
                        <button
                            onClick={() => {
                                const currentIndex = spells.findIndex(s => s.id === selectedSpell?.id);
                                if (currentIndex <= 0) setSelectedSpell(spells[spells.length - 1]);
                                else setSelectedSpell(spells[currentIndex - 1]);
                            }}
                            className="w-14 h-14 bg-stone-900/80 border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-indigo-600 hover:border-indigo-400 transition-all shadow-xl active:scale-90"
                        >
                            <ArrowLeft size={32} />
                        </button>

                        <div className="flex-1 flex items-center justify-center gap-6 overflow-hidden py-10">
                            {(() => {
                                const currentIndex = spells.findIndex(s => s.id === selectedSpell?.id);
                                const startIndex = Math.max(0, Math.min(Math.max(0, spells.length - 3), currentIndex - 1));
                                const visibleSpells = spells.slice(startIndex, startIndex + 3);

                                return visibleSpells.map((spell) => {
                                    const isSelected = selectedSpell?.id === spell.id;
                                    const isMaxLevel = spell.currentLevel >= spell.maxLevel;
                                    const canUpgrade = spellPoints > 0 && !isMaxLevel && playerLevel >= spell.levelRequired;

                                    let elementBg = "bg-stone-900";
                                    const firstEffect = spell.effects?.[0];
                                    if (firstEffect?.element === 'eau') elementBg = "url('/textures/ui/spell_water.png')";
                                    else if (firstEffect?.element === 'feu') elementBg = "url('/textures/ui/spell_fire.png')";
                                    else if (firstEffect?.element === 'air') elementBg = "url('/textures/ui/spell_air.png')";
                                    else if (firstEffect?.element === 'terre') elementBg = "url('/textures/ui/spell_earth.png')";
                                    else if (firstEffect?.type === 'heal') elementBg = "url('/textures/ui/spell_heal.png')";

                                    return (
                                        <div
                                            key={spell.id}
                                            onClick={() => setSelectedSpell(spell)}
                                            className={`transition-all duration-500 cursor-pointer flex flex-col items-center ${isSelected
                                                    ? 'scale-110 z-20 opacity-100'
                                                    : 'scale-90 opacity-40 hover:opacity-70 blur-[1px] hover:blur-0'
                                                }`}
                                        >
                                            <div
                                                className={`w-36 h-36 rounded-[40px] border-4 flex items-center justify-center text-6xl shadow-2xl relative overflow-hidden transition-all ${isSelected ? 'border-indigo-500 rotate-[5deg]' : 'border-white/10'
                                                    }`}
                                                style={{
                                                    backgroundImage: elementBg,
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: 'center'
                                                }}
                                            >
                                                <div className={`absolute inset-0 ${isSelected ? 'bg-indigo-500/10' : 'bg-black/40'}`}></div>
                                                <span className="relative z-10 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">{spell.icon}</span>
                                                <div className="absolute top-4 right-4 bg-black/80 text-white text-[10px] px-2 py-1 rounded-lg font-black border border-white/20">
                                                    NIV.{spell.currentLevel}
                                                </div>
                                            </div>

                                            <div className="mt-6 text-center">
                                                <div className={`text-sm font-black uppercase tracking-[0.2em] ${isSelected ? 'text-indigo-400' : 'text-stone-500'}`}>
                                                    {spell.name}
                                                </div>
                                                <div className="flex items-center justify-center gap-2 mt-1">
                                                    <span className="text-[10px] font-black text-indigo-300/60">{spell.paCost} PA</span>
                                                    {canUpgrade && (
                                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        <button
                            onClick={() => {
                                const currentIndex = spells.findIndex(s => s.id === selectedSpell?.id);
                                if (currentIndex >= spells.length - 1) setSelectedSpell(spells[0]);
                                else setSelectedSpell(spells[currentIndex + 1]);
                            }}
                            className="w-14 h-14 bg-stone-900/80 border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-indigo-600 hover:border-indigo-400 transition-all shadow-xl active:scale-90"
                        >
                            <ArrowRight size={32} />
                        </button>
                    </div>

                    {selectedSpell && (
                        <div className="mt-8 w-full max-w-2xl bg-stone-900/60 border-2 border-white/5 rounded-[32px] p-6 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Description de l'artefact</span>
                                        <span className="text-white font-medium italic opacity-70">"{selectedSpell.description}"</span>
                                    </div>
                                </div>
                                {spellPoints > 0 && selectedSpell.currentLevel < selectedSpell.maxLevel && playerLevel >= selectedSpell.levelRequired && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onUpgradeSpell(selectedSpell.id); }}
                                        className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-[0_10px_20px_rgba(16,185,129,0.3)] transition-all hover:translate-y-[-2px] active:scale-95"
                                    >
                                        <ArrowUp size={14} /> Améliorer (1pt)
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                {[
                                    { label: 'Portée', val: `${selectedSpell.minRange}-${selectedSpell.maxRange}`, icon: <Target size={14} />, color: 'rose' },
                                    { label: 'Relance', val: `${selectedSpell.cooldown} s`, icon: <Clock size={14} />, color: 'amber' },
                                    { label: 'Vue', val: selectedSpell.lineOfSight ? 'OUI' : 'NON', icon: <Eye size={14} />, color: 'cyan' },
                                    { label: 'Zone', val: 'Unique', icon: <Zap size={14} />, color: 'indigo' }
                                ].map((stat, i) => (
                                    <div key={i} className="bg-black/40 border border-white/5 rounded-2xl p-3 flex flex-col items-center text-center">
                                        <div className={`text-${stat.color}-400 mb-1`}>{stat.icon}</div>
                                        <div className="text-[7px] font-black text-stone-500 uppercase tracking-widest">{stat.label}</div>
                                        <div className="text-xs font-black text-white">{stat.val}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <div className="space-y-2">
                                    {selectedSpell.effects && selectedSpell.effects.map((effect: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between text-xs">
                                            <span className="text-stone-400 uppercase font-bold tracking-wider">
                                                {effect.type === 'damage' ? 'Dégâts élémentaires' : effect.type === 'heal' ? 'Soin prodigué' : 'Effet magique'}
                                            </span>
                                            <span className="text-white font-black">
                                                {effect.value} {effect.element && `(${effect.element.toUpperCase()})`}
                                                {effect.valuePerLevel > 0 && <span className="text-emerald-400 ml-1">+{effect.valuePerLevel * (selectedSpell.currentLevel - 1)}</span>}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-black/40 backdrop-blur-md flex items-center justify-center gap-10">
                    <div className="flex gap-2">
                        {spells.map(s => (
                            <div key={s.id} className={`w-2 h-2 rounded-full transition-all ${selectedSpell?.id === s.id ? 'bg-indigo-500 w-6' : 'bg-stone-700'}`} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MENU INVENTAIRE (Touche I)
// ═══════════════════════════════════════════════════════════════════════════

interface InventoryMenuProps {
    isOpen: boolean;
    onClose: () => void;
    inventory: Inventory;
    equipment: Equipment;
    onEquipItem: (item: Item, slot: EquipmentSlot) => void;
    onUnequipItem: (slot: EquipmentSlot) => void;
    onUseItem: (item: Item) => void;
    onDropItem: (item: Item) => void;
    onUpdateItem?: (item: Item) => void;
    apiKey?: string;
    backupApiKey?: string;
}

const EQUIPMENT_SLOTS: { slot: EquipmentSlot; label: string; icon: string }[] = [
    { slot: 'helmet', label: 'Casque', icon: '🪖' },
    { slot: 'amulet', label: 'Amulette', icon: '📿' },
    { slot: 'weapon', label: 'Arme', icon: '⚔️' },
    { slot: 'armor', label: 'Armure', icon: '🛡️' },
    { slot: 'shield', label: 'Bouclier', icon: '🛡️' },
    { slot: 'ring1', label: 'Anneau 1', icon: '💍' },
    { slot: 'ring2', label: 'Anneau 2', icon: '💍' },
    { slot: 'belt', label: 'Ceinture', icon: '🎗️' },
    { slot: 'boots', label: 'Bottes', icon: '👢' },
    { slot: 'cloak', label: 'Cape', icon: '🧥' }
];

export const InventoryMenu: React.FC<InventoryMenuProps> = ({
    isOpen,
    onClose,
    inventory,
    equipment,
    onEquipItem,
    onUnequipItem,
    onUseItem,
    onDropItem,
    onUpdateItem,
    apiKey,
    backupApiKey
}) => {
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [filter, setFilter] = useState<'all' | 'weapon' | 'armor' | 'consumable' | 'resource'>('all');

    if (!isOpen) return null;

    const filteredItems = inventory.items.filter(item => {
        if (filter === 'all') return true;
        if (filter === 'weapon') return item.type === 'weapon';
        if (filter === 'armor') return ['armor', 'accessory'].includes(item.type);
        if (filter === 'consumable') return item.type === 'consumable';
        if (filter === 'resource') return ['resource', 'quest'].includes(item.type);
        return true;
    });

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]" onClick={onClose}>
            <div
                className="w-[1000px] h-[700px] relative shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
                style={{
                    backgroundImage: 'url("/textures/ui/menu_panel.png")',
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                    borderRadius: '32px'
                }}
            >
                <div className="p-8 pb-4 flex items-center justify-between border-b border-white/5 bg-black/20">
                    <div className="flex flex-col">
                        <h2 className="text-4xl font-black text-white uppercase tracking-[0.2em] drop-shadow-lg flex items-center gap-4">
                            <Package className="text-emerald-400" size={32} />
                            Sac d'Aventurier
                        </h2>
                        <div className="mt-2 flex items-center gap-6">
                            <div className="flex items-center gap-2 text-amber-400 font-bold">
                                <img src="/textures/ui/currency_aros.png" className="w-5 h-5 object-contain" alt="Aros" />
                                <span className="text-lg tracking-tighter">{inventory.aros} Aros</span>
                            </div>
                            <div className="h-4 w-px bg-white/10" />
                            <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                                Encombrement: {inventory.items.length} / {inventory.maxSlots || 40}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 bg-white/5 hover:bg-red-500/20 hover:border-red-500/50 rounded-2xl flex items-center justify-center text-white/50 hover:text-white transition-all border border-white/10 group">
                        <X size={24} className="group-hover:rotate-90 transition-transform" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="w-2/3 p-6 flex flex-col border-r border-white/5 bg-black/10">
                        <div className="flex gap-2 mb-6">
                            {[
                                { id: 'all', label: 'Tous', icon: <Star size={14} /> },
                                { id: 'weapon', label: 'Armes', icon: <Swords size={14} /> },
                                { id: 'armor', label: 'Armures', icon: <Shield size={14} /> },
                                { id: 'consumable', label: 'Potions', icon: <Droplets size={14} /> },
                                { id: 'resource', label: 'Ressources', icon: <Package size={14} /> }
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setFilter(f.id as any)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${filter === f.id
                                            ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_4px_15px_rgba(16,185,129,0.3)]'
                                            : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    {f.icon} {f.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-hide pr-2">
                            <div className="grid grid-cols-5 gap-3">
                                {Array.from({ length: Math.max(25, Math.ceil(filteredItems.length / 5) * 5) }).map((_, i) => {
                                    const item = filteredItems[i];
                                    return (
                                        <div
                                            key={i}
                                            onClick={() => item && setSelectedItem(item)}
                                            className={`aspect-square rounded-2xl border-2 transition-all relative group flex items-center justify-center text-4xl cursor-pointer ${item
                                                    ? `bg-black/40 ${RARITY_COLORS[item.rarity || 'common']} hover:scale-105 active:scale-95 shadow-lg`
                                                    : 'bg-black/20 border-white/5 border-dashed pointer-events-none opacity-20'
                                                } ${selectedItem?.id === item?.id ? 'ring-4 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] z-10' : ''}`}
                                        >
                                            {item && (
                                                <>
                                                    <span className="drop-shadow-lg z-10 grayscale-[0.2] group-hover:grayscale-0 transition-all">{item.icon}</span>
                                                    {item.quantity && item.quantity > 1 && (
                                                        <div className="absolute bottom-1 right-2 text-[10px] font-black text-white bg-black/60 px-1.5 rounded-md border border-white/10">
                                                            x{item.quantity}
                                                        </div>
                                                    )}
                                                    {item.level && (
                                                        <div className="absolute top-1 left-1.5 text-[8px] font-black text-emerald-400 opacity-50">
                                                            Lv.{item.level}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="w-1/3 p-6 flex flex-col bg-black/30 backdrop-blur-md">
                        {selectedItem ? (
                            <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center text-5xl shadow-2xl ${RARITY_COLORS[selectedItem.rarity || 'common']} bg-black/40`}>
                                        {selectedItem.icon}
                                    </div>
                                    <div className="flex flex-col">
                                        <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${RARITY_COLORS[selectedItem.rarity || 'common'].replace('border-', 'text-')}`}>
                                            {selectedItem.rarity || 'COMMON'}
                                        </div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-tight leading-tight">{selectedItem.name}</h3>
                                        <div className="text-[10px] font-bold text-stone-500 mt-1 uppercase tracking-widest">
                                            {selectedItem.type.replace('_', ' ')} • Niv. {selectedItem.level || 1}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 bg-black/40 border border-white/5 rounded-3xl p-5 mb-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Sparkles size={120} />
                                    </div>
                                    <h4 className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] mb-4">Description de l'objet</h4>
                                    <p className="text-sm text-stone-300 font-medium leading-relaxed italic mb-6">"{selectedItem.description}"</p>

                                    {selectedItem.statsBonus && (
                                        <>
                                            <h4 className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] mb-3">Attributs bonus</h4>
                                            <div className="space-y-2">
                                                {Object.entries(selectedItem.statsBonus).map(([stat, val]) => (
                                                    <div key={stat} className="flex items-center justify-between text-xs p-2 bg-white/5 rounded-xl border border-white/5">
                                                        <span className="text-stone-400 font-bold uppercase tracking-widest">{stat}</span>
                                                        <span className="text-emerald-400 font-black">+{val}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {selectedItem.effect && (
                                        <>
                                            <h4 className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] mb-3">Effets Magiques</h4>
                                            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                                <span className="text-[10px] text-indigo-300 font-bold leading-tight">
                                                    {selectedItem.effect.type === 'heal' && `Rend ${selectedItem.effect.value} points de vie`}
                                                    {selectedItem.effect.type === 'teleport' && `Téléporte l'utilisateur`}
                                                    {selectedItem.effect.type?.startsWith('buff') && `Augmente ${selectedItem.effect.type.split('_')[1]} de ${selectedItem.effect.value}`}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {['weapon', 'armor', 'accessory'].includes(selectedItem.type) ? (
                                        <button
                                            onClick={() => {
                                                let slot: EquipmentSlot = 'weapon';
                                                if (selectedItem.type === 'armor') slot = 'armor';
                                                else if (selectedItem.type === 'accessory') {
                                                    if (selectedItem.name.toLowerCase().includes('casque') || selectedItem.id.includes('helmet')) slot = 'helmet';
                                                    else if (selectedItem.name.toLowerCase().includes('amulette') || selectedItem.id.includes('amulet')) slot = 'amulet';
                                                    else if (selectedItem.name.toLowerCase().includes('bouclier') || selectedItem.id.includes('shield')) slot = 'shield';
                                                    else if (selectedItem.name.toLowerCase().includes('ceinture') || selectedItem.id.includes('belt')) slot = 'belt';
                                                    else if (selectedItem.name.toLowerCase().includes('bottes') || selectedItem.id.includes('boots')) slot = 'boots';
                                                    else if (selectedItem.name.toLowerCase().includes('cape') || selectedItem.id.includes('cloak')) slot = 'cloak';
                                                    else slot = 'ring1';
                                                }
                                                onEquipItem(selectedItem, slot);
                                            }}
                                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(16,185,129,0.3)] transition-all active:scale-95"
                                        >
                                            Équiper l'objet
                                        </button>
                                    ) : selectedItem.type === 'consumable' ? (
                                        <button
                                            onClick={() => onUseItem(selectedItem)}
                                            className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(99,102,241,0.3)] transition-all active:scale-95"
                                        >
                                            Utiliser l'objet
                                        </button>
                                    ) : null}

                                    <button
                                        onClick={() => onDropItem(selectedItem)}
                                        className="w-full bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all border border-white/5 hover:border-red-500/30"
                                    >
                                        Jeter l'objet
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/5 text-white/10">
                                    <Sparkles size={48} className="animate-pulse" />
                                </div>
                                <p className="text-white/20 font-black text-[10px] uppercase tracking-[0.4em] leading-relaxed">
                                    Contemplez votre trésor<br />Sélectionnez un artefact
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 px-10 bg-black/40 backdrop-blur-md flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <img src="/textures/ui/currency_aros.png" className="w-4 h-4 object-contain" alt="Aros" />
                            <span className="text-xs font-black text-white/60 tracking-widest">{inventory.aros} Aros</span>
                        </div>
                    </div>
                    <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">
                        Touche I pour fermer
                    </div>
                </div>
            </div>
        </div>
    );
};

// Hook pour gérer les menus
export const useGameMenus = () => {
    const [characterMenuOpen, setCharacterMenuOpen] = useState(false);
    const [spellMenuOpen, setSpellMenuOpen] = useState(false);
    const [inventoryMenuOpen, setInventoryMenuOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.key.toLowerCase()) {
                case 'c':
                    setCharacterMenuOpen(prev => !prev);
                    setSpellMenuOpen(false);
                    setInventoryMenuOpen(false);
                    break;
                case 's':
                    setSpellMenuOpen(prev => !prev);
                    setCharacterMenuOpen(false);
                    setInventoryMenuOpen(false);
                    break;
                case 'i':
                    setInventoryMenuOpen(prev => !prev);
                    setCharacterMenuOpen(false);
                    setSpellMenuOpen(false);
                    break;
                case 'escape':
                    setCharacterMenuOpen(false);
                    setSpellMenuOpen(false);
                    setInventoryMenuOpen(false);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return {
        characterMenuOpen,
        setCharacterMenuOpen,
        spellMenuOpen,
        setSpellMenuOpen,
        inventoryMenuOpen,
        setInventoryMenuOpen,
        closeAllMenus: () => {
            setCharacterMenuOpen(false);
            setSpellMenuOpen(false);
            setInventoryMenuOpen(false);
        }
    };
};

export default { CharacterMenu, SpellMenu, InventoryMenu, useGameMenus };
