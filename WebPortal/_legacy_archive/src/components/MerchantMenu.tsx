
import React, { useState } from 'react';
import { X, ShoppingCart, Tag, Coins, Package, Info, ArrowRight, ArrowLeft, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { Merchant, Item, Inventory } from '../types';
import { VisualGeneratorService } from '../utils/VisualGeneratorService';
import { saveMerchant } from '../utils/storage';

interface MerchantMenuProps {
    merchant: Merchant;
    playerInventory: Inventory;
    onBuy: (item: Item) => void;
    onSell: (item: Item) => void;
    onClose: () => void;
    apiKey: string;
    backupApiKey?: string;
}

export const MerchantMenu: React.FC<MerchantMenuProps> = ({
    merchant,
    playerInventory,
    onBuy,
    onSell,
    onClose,
    apiKey,
    backupApiKey
}) => {
    const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [localMerchant, setLocalMerchant] = useState(merchant);

    const buyPrice = (item: Item) => Math.floor((item.basePrice || 10) * (merchant.sellMultiplier || 1.0));
    const sellPrice = (item: Item) => Math.floor((item.basePrice || 10) * (merchant.buyFactor || 0.1));

    const handleAction = () => {
        if (!selectedItem) return;
        if (activeTab === 'buy') {
            if (playerInventory.aros >= buyPrice(selectedItem)) {
                onBuy(selectedItem);
            }
        } else {
            onSell(selectedItem);
            setSelectedItem(null); // Deselect after selling
        }
    };

    const handleGenerateMerchantVisual = async () => {
        if (!apiKey || isGenerating) return;
        setIsGenerating(true);
        try {
            const url = await VisualGeneratorService.generateNPCVisual(localMerchant, apiKey, backupApiKey);
            setLocalMerchant(prev => ({ ...prev, spriteUrl: url }));
        } catch (e) {
            console.error(e);
            alert("Erreur de génération du visuel PNJ");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateItemVisual = async () => {
        if (!selectedItem || !apiKey || isGenerating) return;
        setIsGenerating(true);
        try {
            const url = await VisualGeneratorService.generateItemVisual(selectedItem, apiKey, backupApiKey);
            const updatedItem = { ...selectedItem, icon: '', spriteUrl: url };

            if (activeTab === 'buy') {
                setLocalMerchant(prev => ({
                    ...prev,
                    inventory: prev.inventory.map(i => i.id === selectedItem.id ? updatedItem : i)
                }));
            }
            setSelectedItem(updatedItem);
        } catch (e) {
            console.error(e);
            alert("Erreur de génération du visuel objet");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateEverything = async () => {
        if (!apiKey || isGenerating) return;
        if (!confirm("Attention : Cela va générer des visuels pour TOUS les objets de ce marchand un par un. Cela peut prendre du temps et consommer des crédits. Continuer ?")) return;

        setIsGenerating(true);
        try {
            let currentMerchant = { ...localMerchant };
            if (!currentMerchant.spriteUrl || currentMerchant.spriteUrl.length < 10) {
                const npcUrl = await VisualGeneratorService.generateNPCVisual(currentMerchant, apiKey, backupApiKey);
                currentMerchant.spriteUrl = npcUrl;
                setLocalMerchant({ ...currentMerchant });
            }

            const newInventory = [...currentMerchant.inventory];
            for (let i = 0; i < newInventory.length; i++) {
                const item = newInventory[i];
                if (!(item as any).spriteUrl) {
                    try {
                        const itemUrl = await VisualGeneratorService.generateItemVisual(item, apiKey, backupApiKey);
                        newInventory[i] = { ...item, icon: '', spriteUrl: itemUrl };
                        setLocalMerchant(prev => ({
                            ...prev,
                            spriteUrl: currentMerchant.spriteUrl,
                            inventory: [...newInventory]
                        }));
                        await new Promise(r => setTimeout(r, 1000));
                    } catch (err) {
                        console.error(`Failed to generate for item ${item.name}`, err);
                    }
                }
            }

            const finalMerchant = { ...currentMerchant, inventory: [...newInventory] };
            setLocalMerchant(finalMerchant);
            await saveMerchant(finalMerchant);
            alert("Génération terminée et marchand sauvegardé !");
        } catch (e) {
            console.error(e);
            alert("Erreur lors de la génération globale.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] backdrop-blur-md px-4" onClick={onClose}>
            <div
                className="w-full max-w-[1000px] h-[750px] relative shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
                style={{
                    backgroundImage: 'url("/textures/ui/menu_panel.png")',
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                    borderRadius: '32px'
                }}
            >
                {/* Header Section */}
                <div className="p-8 pb-4 flex items-center justify-between border-b border-white/5 bg-black/20">
                    <div className="flex items-center gap-6">
                        <div className="relative group">
                            <div className="w-24 h-24 bg-black/40 rounded-3xl border-2 border-amber-500/50 overflow-hidden shadow-2xl relative">
                                <img src={localMerchant.spriteUrl} alt={localMerchant.name} className="w-full h-full object-cover pixelated" />
                                {apiKey && (
                                    <button
                                        onClick={handleGenerateMerchantVisual}
                                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Sparkles size={24} className="text-amber-400" />
                                    </button>
                                )}
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-amber-500 text-black p-1.5 rounded-xl shadow-lg border border-amber-300 animate-bounce">
                                <ShoppingCart size={16} />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white px-1 uppercase tracking-widest drop-shadow-lg">
                                {localMerchant.name}
                            </h2>
                            <div className="mt-2 flex items-center gap-4">
                                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-amber-500/30">
                                    {localMerchant.subtitle || 'Commerçant'}
                                </span>
                                <div className="h-4 w-px bg-white/10" />
                                <div className="flex items-center gap-2 text-yellow-500 font-bold">
                                    <div className="w-4 h-4 rounded-full bg-yellow-500 border border-yellow-300 shadow-md" />
                                    <span className="text-lg tracking-tighter">{playerInventory.aros.toLocaleString()} Aros</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {apiKey && (
                            <button
                                onClick={handleGenerateEverything}
                                disabled={isGenerating}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50"
                            >
                                {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                Alchimie IA
                            </button>
                        )}
                        <button onClick={onClose} className="w-12 h-12 bg-white/5 hover:bg-red-500/20 hover:border-red-500/50 rounded-2xl flex items-center justify-center text-white/50 hover:text-white transition-all border border-white/10 group">
                            <X size={24} className="group-hover:rotate-90 transition-transform" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Column: Grid & Tabs */}
                    <div className="w-2/3 p-8 flex flex-col border-r border-white/5 bg-black/10">
                        {/* Custom Tabs */}
                        <div className="flex gap-4 mb-8">
                            <button
                                onClick={() => { setActiveTab('buy'); setSelectedItem(null); }}
                                className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 border ${activeTab === 'buy'
                                        ? 'bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-600/20'
                                        : 'bg-white/5 text-stone-500 border-white/5 hover:bg-white/10'
                                    }`}
                            >
                                <ShoppingCart size={18} /> Acheter
                            </button>
                            <button
                                onClick={() => { setActiveTab('sell'); setSelectedItem(null); }}
                                className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 border ${activeTab === 'sell'
                                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/20'
                                        : 'bg-white/5 text-stone-500 border-white/5 hover:bg-white/10'
                                    }`}
                            >
                                <Tag size={18} /> Vendre
                            </button>
                        </div>

                        {/* Items Grid */}
                        <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
                            <div className="grid grid-cols-5 gap-4">
                                {(activeTab === 'buy' ? localMerchant.inventory : playerInventory.items).map((item, i) => (
                                    <div
                                        key={`${item.id}-${i}`}
                                        onClick={() => setSelectedItem(item)}
                                        className={`aspect-square rounded-2xl border-2 flex items-center justify-center text-4xl cursor-pointer transition-all relative overflow-hidden group
                                            ${selectedItem?.id === item.id
                                                ? 'border-white bg-white/10 scale-95 shadow-2xl z-20'
                                                : 'border-white/5 bg-black/40 hover:bg-black/60 hover:border-white/20'}
                                        `}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        {(item as any).spriteUrl ? (
                                            <img src={(item as any).spriteUrl} className="w-[85%] h-[85%] object-contain pixelated relative z-10" alt={item.name} />
                                        ) : (
                                            <span className="relative z-10 grayscale-[0.5] group-hover:grayscale-0 transition-all">{item.icon}</span>
                                        )}

                                        {item.quantity > 1 && (
                                            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-black px-1.5 py-0.5 rounded-lg border border-white/10 z-20">
                                                {item.quantity}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {Array.from({ length: Math.max(0, 20 - (activeTab === 'buy' ? localMerchant.inventory.length : playerInventory.items.length)) }).map((_, i) => (
                                    <div key={i} className="aspect-square rounded-2xl border border-white/5 bg-white/5 opacity-10" />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Inspector */}
                    <div className="w-1/3 p-8 flex flex-col bg-black/30 backdrop-blur-md">
                        {selectedItem ? (
                            <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="text-center mb-8">
                                    <div className="relative group mx-auto mb-6">
                                        <div className="w-32 h-32 rounded-3xl border-2 border-white/20 bg-black/40 flex items-center justify-center text-6xl shadow-2xl relative overflow-hidden">
                                            {(selectedItem as any).spriteUrl ? (
                                                <img src={(selectedItem as any).spriteUrl} className="w-[80%] h-[80%] object-contain pixelated" alt={selectedItem.name} />
                                            ) : (
                                                selectedItem.icon
                                            )}
                                        </div>
                                        {apiKey && (
                                            <button
                                                onClick={handleGenerateItemVisual}
                                                disabled={isGenerating}
                                                className="absolute -top-3 -right-3 bg-indigo-500 hover:bg-indigo-400 p-3 rounded-2xl shadow-xl transition-all hover:scale-110 active:scale-90 disabled:opacity-50"
                                            >
                                                {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                                            </button>
                                        )}
                                    </div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">{selectedItem.name}</h3>
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-stone-500 uppercase tracking-widest border border-white/5">
                                            Niv.{selectedItem.level || 1} • {selectedItem.rarity || 'Commun'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex-1 bg-black/40 border border-white/5 rounded-[2rem] p-6 mb-8 overflow-y-auto scrollbar-hide">
                                    <h4 className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] mb-4">Description</h4>
                                    <p className="text-stone-400 text-sm italic leading-relaxed mb-6">"{selectedItem.description}"</p>

                                    {selectedItem.statsBonus && Object.keys(selectedItem.statsBonus).length > 0 && (
                                        <div className="space-y-2">
                                            {Object.entries(selectedItem.statsBonus).map(([key, val]) => (
                                                <div key={key} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                                    <span className="text-stone-500 text-[10px] font-black uppercase tracking-widest leading-none">{key}</span>
                                                    <span className="text-emerald-400 font-black">+{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-auto pt-6 border-t border-white/10">
                                    <div className="flex justify-between items-center mb-6 px-2">
                                        <span className="text-stone-500 text-xs font-bold uppercase tracking-widest">
                                            {activeTab === 'buy' ? 'Prix d\'achat' : 'Prix de vente'}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-3xl font-black tracking-tighter ${activeTab === 'buy' && playerInventory.aros < buyPrice(selectedItem) ? 'text-red-500' : 'text-yellow-500'}`}>
                                                {(activeTab === 'buy' ? buyPrice(selectedItem) : sellPrice(selectedItem)).toLocaleString()}
                                            </span>
                                            <div className="w-5 h-5 rounded-full bg-yellow-500 border border-yellow-300" />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleAction}
                                        disabled={(activeTab === 'buy' && playerInventory.aros < buyPrice(selectedItem)) || isGenerating}
                                        className={`w-full py-5 rounded-3xl font-black uppercase tracking-widest text-sm shadow-2xl transition-all active:scale-95 disabled:opacity-30 disabled:grayscale
                                            ${activeTab === 'buy'
                                                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
                                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                                            }
                                        `}
                                    >
                                        {activeTab === 'buy' ? 'Acheter' : 'Vendre'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center px-10 opacity-30">
                                <Package size={64} className="mb-6" />
                                <p className="text-white font-black text-[10px] uppercase tracking-[0.4em] leading-relaxed">
                                    Sélectionnez un artefact
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer bar */}
                <div className="h-12 bg-black/40 flex items-center justify-center">
                    <span className="text-[10px] text-white/20 font-black uppercase tracking-[0.5em]">Guilde des Marchands de Narvos</span>
                </div>
            </div>
        </div>
    );
};
