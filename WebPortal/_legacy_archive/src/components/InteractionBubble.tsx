/**
 * 🎯 NARVOS PRIME - Interaction Bubble Component
 * Bulle contextuelle pour les interactions Monster/NPC au clic
 */

import React from 'react';
import { Swords, MessageCircle, ShoppingCart, Tag, X } from 'lucide-react';

interface InteractionBubbleProps {
    target: {
        type: 'monster' | 'npc' | 'merchant';
        id: string;
        name: string;
        canTalk?: boolean;
        canBuy?: boolean;
        canSell?: boolean;
    };
    position: { x: number; y: number };
    onAction: (action: 'attack' | 'talk' | 'buy' | 'sell' | 'loot') => void;
    onClose: () => void;
}

export const InteractionBubble: React.FC<InteractionBubbleProps> = ({
    target,
    position,
    onAction,
    onClose
}) => {
    const isMonster = target.type === 'monster';
    const isNpc = target.type === 'npc' || target.type === 'merchant';

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[500]"
                onClick={onClose}
            />

            {/* Bubble */}
            <div
                className="absolute z-[501] animate-in fade-in zoom-in-95 duration-150"
                style={{
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                    transform: 'translate(-50%, -120%)'
                }}
            >
                {/* Speech Bubble Container */}
                <div className="relative bg-gradient-to-b from-slate-800/95 to-slate-900/95 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl shadow-black/50 p-1 min-w-[140px]">
                    {/* Target Name Header */}
                    <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white truncate max-w-[120px]">
                            {target.name}
                        </span>
                        <button
                            onClick={onClose}
                            className="text-white/50 hover:text-white transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="p-1.5 flex flex-col gap-1">
                        {/* Monster Actions */}
                        {isMonster && (
                            <>
                                <button
                                    onClick={() => onAction('attack')}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition-all font-medium text-sm w-full"
                                >
                                    <Swords size={16} />
                                    <span>Attaquer</span>
                                </button>
                                {target.canTalk && (
                                    <button
                                        onClick={() => onAction('talk')}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 hover:text-blue-300 transition-all font-medium text-sm w-full"
                                    >
                                        <MessageCircle size={16} />
                                        <span>Parler</span>
                                    </button>
                                )}
                            </>
                        )}

                        {/* NPC Actions */}
                        {isNpc && (
                            <>
                                {target.canBuy && (
                                    <button
                                        onClick={() => onAction('buy')}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/40 text-green-400 hover:text-green-300 transition-all font-medium text-sm w-full"
                                    >
                                        <ShoppingCart size={16} />
                                        <span>Acheter</span>
                                    </button>
                                )}
                                {target.canSell && (
                                    <button
                                        onClick={() => onAction('sell')}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 hover:text-yellow-300 transition-all font-medium text-sm w-full"
                                    >
                                        <Tag size={16} />
                                        <span>Vendre</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => onAction('talk')}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 hover:text-blue-300 transition-all font-medium text-sm w-full"
                                >
                                    <MessageCircle size={16} />
                                    <span>Parler</span>
                                </button>
                            </>
                        )}
                    </div>

                    {/* Speech Bubble Tail */}
                    <div
                        className="absolute left-1/2 -bottom-2 w-4 h-4 bg-slate-900/95 border-r border-b border-white/20 transform -translate-x-1/2 rotate-45"
                    />
                </div>
            </div>
        </>
    );
};

export default InteractionBubble;
