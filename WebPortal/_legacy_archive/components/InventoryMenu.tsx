
import React from 'react';
import { InventoryItem, Equipment, Rarity } from '../types';
import { ITEMS_DB } from '../constants';
import { X, Shield, Sword, Zap, Heart, Box } from 'lucide-react';

interface InventoryMenuProps {
    inventory: InventoryItem[];
    equippedItems: { [slot: string]: string };
    onClose: () => void;
    onEquip: (itemId: string) => void;
}

export const InventoryMenu: React.FC<InventoryMenuProps> = ({ inventory, equippedItems, onClose, onEquip }) => {
    const getRarityColor = (rarity: Rarity) => {
        switch (rarity) {
            case Rarity.COMMON: return 'text-slate-400 border-slate-700';
            case Rarity.RARE: return 'text-blue-400 border-blue-700';
            case Rarity.EPIC: return 'text-purple-400 border-purple-700';
            case Rarity.LEGENDARY: return 'text-yellow-400 border-yellow-700';
            default: return 'text-white border-white/10';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="w-[900px] h-[600px] bg-slate-900 border-2 border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                    <div className="flex items-center gap-4">
                        <Box className="text-blue-400" size={32} />
                        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Inventaire</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="text-slate-400" size={24} />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Character Slots (Left) */}
                    <div className="w-1/3 p-8 border-r border-slate-700 bg-slate-950/30 flex flex-col items-center">
                        <div className="relative w-48 h-64 bg-slate-900 rounded-2xl border border-white/5 flex items-center justify-center mb-8">
                            <div className="text-white/10 font-black text-6xl uppercase transform -rotate-12">NARVOS</div>

                            {/* Equipment Slots */}
                            <Slot icon={<Shield size={20} />} label="Tête" pos="top-[-20px] left-1/2 -translate-x-1/2" item={equippedItems['HEAD']} />
                            <Slot icon={<Sword size={20} />} label="Arme" pos="top-1/2 -translate-y-1/2 left-[-20px]" item={equippedItems['WEAPON']} />
                            <Slot icon={<Zap size={20} />} label="Cape" pos="top-1/2 -translate-y-1/2 right-[-20px]" item={equippedItems['CAPE']} />
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full">
                            <StatBox icon={<Heart size={16} />} label="PV" value="100" color="text-red-400" />
                            <StatBox icon={<Shield size={16} />} label="Armure" value="0" color="text-blue-400" />
                        </div>
                    </div>

                    {/* Inventory Grid (Right) */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-900/50">
                        <div className="text-[10px] text-slate-500 font-black tracking-widest uppercase mb-4">// OBJETS POSSÉDÉS</div>
                        <div className="grid grid-cols-5 gap-3">
                            {inventory.map((item, idx) => {
                                const details = ITEMS_DB[item.id];
                                if (!details) return null;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => onEquip(item.id)}
                                        className={`group relative aspect-square bg-slate-950 border-2 rounded-xl flex items-center justify-center cursor-pointer transition-all hover:scale-105
                                            ${getRarityColor(details.rarity)}
                                        `}
                                    >
                                        <div className="text-2xl opacity-50 font-bold group-hover:opacity-100 uppercase tracking-tighter">{details.name[0]}</div>
                                        <div className="absolute bottom-1 right-1 px-1 bg-slate-800 text-[8px] font-black rounded border border-white/5">x{item.count}</div>

                                        {/* Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-slate-950 border border-slate-700 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity w-48 z-50 shadow-2xl">
                                            <div className={`text-[10px] font-black uppercase mb-1 ${getRarityColor(details.rarity).split(' ')[0]}`}>{details.name}</div>
                                            <div className="text-[9px] text-slate-400 leading-tight mb-2">Objet tactique de rareté {details.rarity}.</div>
                                            {details.statsBonus && Object.entries(details.statsBonus).map(([k, v]) => (
                                                <div key={k} className="text-[8px] text-green-400 font-bold">+{v} {k.toUpperCase()}</div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Empty Slots */}
                            {Array.from({ length: Math.max(0, 20 - inventory.length) }).map((_, i) => (
                                <div key={i} className="aspect-square bg-slate-950/30 border border-white/5 rounded-xl"></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Slot = ({ icon, label, pos, item }: { icon: React.ReactNode, label: string, pos: string, item?: string }) => {
    const details = item ? ITEMS_DB[item] : null;
    return (
        <div className={`absolute ${pos} group`}>
            <div className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center cursor-pointer transition-all
                ${item ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-800 border-white/10 hover:border-white/20'}
            `}>
                {item ? <div className="text-blue-400 font-black uppercase text-[10px]">{details?.name[0]}</div> : <div className="text-slate-600">{icon}</div>}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-black text-[8px] font-black text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap uppercase tracking-tighter">
                {details?.name || label}
            </div>
        </div>
    );
};

const StatBox = ({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) => (
    <div className="bg-slate-900 border border-white/5 p-3 rounded-xl flex flex-col items-center gap-1">
        <div className={color}>{icon}</div>
        <div className="text-white font-black text-lg leading-none">{value}</div>
        <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest">{label}</div>
    </div>
);
