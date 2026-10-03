/**
 * 💬 NARVOS PRIME - Dialogue System
 * Système de dialogue interactif pour PNJs et Monstres
 */

import React, { useState, useEffect } from 'react';
import { X, ChevronRight, MessageCircle, Gift, Skull, Heart } from 'lucide-react';

// Types de dialogue
export interface DialogueNode {
    id: string;
    speaker: string;
    text: string;
    emotion?: 'neutral' | 'happy' | 'angry' | 'sad' | 'scared';
    choices?: DialogueChoice[];
    next?: string; // ID du prochain nœud si pas de choices
    action?: DialogueAction;
}

export interface DialogueChoice {
    text: string;
    nextId: string;
    condition?: () => boolean; // Condition pour afficher ce choix
    consequence?: DialogueAction;
}

export interface DialogueAction {
    type: 'give_item' | 'give_xp' | 'give_gold' | 'start_combat' | 'heal' | 'teleport' | 'unlock_quest';
    value?: number;
    itemId?: string;
    questId?: string;
    targetMap?: { x: number; y: number };
}

export interface DialogueTree {
    id: string;
    startNodeId: string;
    nodes: DialogueNode[];
}

interface DialogueSystemProps {
    dialogue: DialogueTree;
    speakerName: string;
    speakerImage?: string;
    onClose: () => void;
    onAction?: (action: DialogueAction) => void;
    playerName?: string;
}

// Emotion to color/icon mapping
const EMOTION_CONFIG = {
    neutral: { color: 'text-white', bg: 'bg-slate-700' },
    happy: { color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
    angry: { color: 'text-red-400', bg: 'bg-red-900/30' },
    sad: { color: 'text-blue-400', bg: 'bg-blue-900/30' },
    scared: { color: 'text-purple-400', bg: 'bg-purple-900/30' }
};

export const DialogueSystem: React.FC<DialogueSystemProps> = ({
    dialogue,
    speakerName,
    speakerImage,
    onClose,
    onAction,
    playerName = 'Joueur'
}) => {
    const [currentNodeId, setCurrentNodeId] = useState(dialogue.startNodeId);
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(true);
    const [showChoices, setShowChoices] = useState(false);

    const currentNode = dialogue.nodes.find(n => n.id === currentNodeId);

    // Typewriter effect
    useEffect(() => {
        if (!currentNode) return;

        setDisplayedText('');
        setIsTyping(true);
        setShowChoices(false);

        const text = currentNode.text.replace('{player}', playerName);
        let index = 0;

        const typeInterval = setInterval(() => {
            if (index < text.length) {
                setDisplayedText(text.substring(0, index + 1));
                index++;
            } else {
                setIsTyping(false);
                clearInterval(typeInterval);
                // Show choices after a small delay
                setTimeout(() => setShowChoices(true), 300);
            }
        }, 30); // 30ms per character

        return () => clearInterval(typeInterval);
    }, [currentNodeId, currentNode, playerName]);

    const handleChoice = (choice: DialogueChoice) => {
        // Execute consequence if any
        if (choice.consequence && onAction) {
            onAction(choice.consequence);
        }

        // Move to next node
        setCurrentNodeId(choice.nextId);
    };

    const handleContinue = () => {
        if (isTyping) {
            // Skip typing animation
            if (currentNode) {
                setDisplayedText(currentNode.text.replace('{player}', playerName));
                setIsTyping(false);
                setShowChoices(true);
            }
            return;
        }

        // Execute action if any
        if (currentNode?.action && onAction) {
            onAction(currentNode.action);
        }

        // If no choices and has next, go to next
        if (currentNode?.next) {
            setCurrentNodeId(currentNode.next);
        } else if (!currentNode?.choices || currentNode.choices.length === 0) {
            // End of dialogue
            onClose();
        }
    };

    if (!currentNode) {
        onClose();
        return null;
    }

    const emotion = currentNode.emotion || 'neutral';
    const emotionStyle = EMOTION_CONFIG[emotion];

    return (
        <div className="fixed inset-0 z-[600] flex items-end justify-center p-4 bg-black/60 animate-in fade-in duration-200">
            {/* Dialogue Box */}
            <div className="w-full max-w-3xl mb-8 animate-in slide-in-from-bottom duration-300">
                {/* Speaker Header */}
                <div className="flex items-center gap-3 mb-2">
                    {/* Speaker Portrait */}
                    <div className={`w-16 h-16 rounded-xl border-2 ${emotionStyle.bg} border-white/20 overflow-hidden flex items-center justify-center shadow-xl`}>
                        {speakerImage ? (
                            <img src={speakerImage} alt={speakerName} className="w-full h-full object-cover" />
                        ) : (
                            <MessageCircle size={28} className={emotionStyle.color} />
                        )}
                    </div>

                    {/* Speaker Name */}
                    <div className="flex flex-col">
                        <span className={`text-lg font-black uppercase tracking-wider ${emotionStyle.color}`}>
                            {currentNode.speaker || speakerName}
                        </span>
                        <span className="text-xs text-white/50 capitalize">{emotion}</span>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="ml-auto p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Text Box */}
                <div
                    className={`${emotionStyle.bg} backdrop-blur-md border border-white/20 rounded-xl p-6 shadow-2xl cursor-pointer`}
                    onClick={handleContinue}
                >
                    {/* Dialogue Text */}
                    <p className="text-white text-lg leading-relaxed min-h-[60px]">
                        {displayedText}
                        {isTyping && <span className="animate-pulse">▌</span>}
                    </p>

                    {/* Continue Indicator */}
                    {!isTyping && (!currentNode.choices || currentNode.choices.length === 0) && (
                        <div className="flex items-center justify-end gap-2 mt-4 text-white/50 text-sm">
                            <span>Cliquez pour continuer</span>
                            <ChevronRight size={16} className="animate-pulse" />
                        </div>
                    )}
                </div>

                {/* Choices */}
                {showChoices && currentNode.choices && currentNode.choices.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        {currentNode.choices
                            .filter(c => !c.condition || c.condition())
                            .map((choice, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleChoice(choice)}
                                    className="w-full text-left px-4 py-3 bg-slate-800/90 hover:bg-slate-700 border border-white/10 hover:border-cyan-500/50 rounded-lg text-white transition-all flex items-center gap-3 group"
                                >
                                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold group-hover:bg-cyan-500 group-hover:text-black transition-colors">
                                        {index + 1}
                                    </span>
                                    <span className="flex-1">{choice.text}</span>
                                    <ChevronRight size={16} className="text-white/30 group-hover:text-cyan-400 transition-colors" />
                                </button>
                            ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// DIALOGUES PRÉDÉFINIS
// ═══════════════════════════════════════════════════════════════

export const MONSTER_DIALOGUES: Record<string, DialogueTree> = {
    // Lyseur - Monstre peureux qui peut donner du loot
    lyseur_peaceful: {
        id: 'lyseur_peaceful',
        startNodeId: 'start',
        nodes: [
            {
                id: 'start',
                speaker: 'Lyseur',
                text: "*Tremble* Tu... tu ne vas pas me faire de mal, n'est-ce pas {player} ?",
                emotion: 'scared',
                choices: [
                    { text: "Non, je veux juste discuter.", nextId: 'friendly' },
                    { text: "Donne-moi ton butin et je partirai.", nextId: 'demand' },
                    { text: "Prépare-toi à mourir !", nextId: 'fight' }
                ]
            },
            {
                id: 'friendly',
                speaker: 'Lyseur',
                text: "Oh... *soulagement* Merci ! Les autres aventuriers sont si violents... Tiens, prends ceci en gage de ma gratitude.",
                emotion: 'happy',
                action: { type: 'give_item', itemId: 'lyseur_gift' },
                next: 'end_friendly'
            },
            {
                id: 'demand',
                speaker: 'Lyseur',
                text: "D-d'accord ! Prends tout ce que j'ai, mais laisse-moi en vie !",
                emotion: 'scared',
                action: { type: 'give_gold', value: 50 },
                next: 'end_demand'
            },
            {
                id: 'fight',
                speaker: 'Lyseur',
                text: "NON ! Je n'ai pas le choix alors... Je dois me défendre !",
                emotion: 'angry',
                action: { type: 'start_combat' }
            },
            {
                id: 'end_friendly',
                speaker: 'Lyseur',
                text: "Tu es vraiment quelqu'un de bien, {player}. Reviens me voir si tu as besoin d'aide !",
                emotion: 'happy'
            },
            {
                id: 'end_demand',
                speaker: 'Lyseur',
                text: "*Part en courant* Au revoir !!",
                emotion: 'scared'
            }
        ]
    },

    // Dialogue générique pour monstres agressifs
    aggressive_monster: {
        id: 'aggressive_monster',
        startNodeId: 'start',
        nodes: [
            {
                id: 'start',
                speaker: 'Monstre',
                text: "*Grogne menaçant* Tu oses t'approcher de mon territoire ?!",
                emotion: 'angry',
                choices: [
                    { text: "Je ne cherche pas les ennuis.", nextId: 'peace' },
                    { text: "Ton territoire ? C'est le mien maintenant !", nextId: 'provoke' }
                ]
            },
            {
                id: 'peace',
                speaker: 'Monstre',
                text: "*Renifle l'air* Hmm... Tu ne sens pas comme les autres. Pars, et je t'épargnerai... cette fois.",
                emotion: 'neutral'
            },
            {
                id: 'provoke',
                speaker: 'Monstre',
                text: "INSOLENT ! Tu vas MOURIR !",
                emotion: 'angry',
                action: { type: 'start_combat' }
            }
        ]
    }
};

export const NPC_DIALOGUES: Record<string, DialogueTree> = {
    // Marchand générique
    merchant_greeting: {
        id: 'merchant_greeting',
        startNodeId: 'start',
        nodes: [
            {
                id: 'start',
                speaker: 'Marchand',
                text: "Bienvenue, voyageur ! Que puis-je faire pour vous aujourd'hui ?",
                emotion: 'happy',
                choices: [
                    { text: "Je voudrais voir vos marchandises.", nextId: 'shop' },
                    { text: "Avez-vous des informations sur cette région ?", nextId: 'info' },
                    { text: "Au revoir.", nextId: 'bye' }
                ]
            },
            {
                id: 'shop',
                speaker: 'Marchand',
                text: "Excellent choix ! Voici mes meilleures pièces. N'hésitez pas à regarder !",
                emotion: 'happy'
                // Le système ouvrira le menu marchand via action handler
            },
            {
                id: 'info',
                speaker: 'Marchand',
                text: "Cette zone est dangereuse. Les monstres deviennent de plus en plus agressifs ces derniers temps. Soyez prudent !",
                emotion: 'sad',
                next: 'start'
            },
            {
                id: 'bye',
                speaker: 'Marchand',
                text: "À bientôt ! Revenez quand vous voulez !",
                emotion: 'happy'
            }
        ]
    },

    // Guérisseur
    healer_npc: {
        id: 'healer_npc',
        startNodeId: 'start',
        nodes: [
            {
                id: 'start',
                speaker: 'Guérisseur',
                text: "Paix soit avec vous, voyageur. Vous semblez fatigué. Voulez-vous que je soigne vos blessures ?",
                emotion: 'neutral',
                choices: [
                    { text: "Oui, soignez-moi s'il vous plaît.", nextId: 'heal' },
                    { text: "Non merci, je vais bien.", nextId: 'decline' }
                ]
            },
            {
                id: 'heal',
                speaker: 'Guérisseur',
                text: "Que la lumière vous guide... *Vos blessures se referment* Voilà, vous êtes comme neuf !",
                emotion: 'happy',
                action: { type: 'heal' }
            },
            {
                id: 'decline',
                speaker: 'Guérisseur',
                text: "Comme vous voulez. N'hésitez pas à revenir si vous changez d'avis.",
                emotion: 'neutral'
            }
        ]
    }
};

export default DialogueSystem;
