/**
 * Composant de Dialogue NPC
 * Interface utilisateur pour les conversations avec les PNJ
 */

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, User, Bot } from 'lucide-react';
import { chatbotService, ChatMessage, NPCContext, ChatResponse } from '../services/chatbotService';

interface NPCDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    npcContext: NPCContext;
    playerName?: string;
}

export const NPCDialogue: React.FC<NPCDialogueProps> = ({
    isOpen,
    onClose,
    npcContext,
    playerName = 'Joueur'
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentResponse, setCurrentResponse] = useState<ChatResponse | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Message d'accueil
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const greeting = getGreeting(npcContext);
            setMessages([{ role: 'assistant', content: greeting }]);
            setCurrentResponse({
                message: greeting,
                emotion: 'NEUTRE',
                nextPrompts: getInitialPrompts(npcContext)
            });
        }
    }, [isOpen, npcContext]);

    const getGreeting = (ctx: NPCContext): string => {
        const greetings: Record<string, string> = {
            MARCHAND: `Bienvenue voyageur ! Je suis ${ctx.npcName}. Que puis-je vous proposer ?`,
            GARDE: `Halte ! Je suis ${ctx.npcName}. Que voulez-vous ?`,
            CIVIL: `Oh, bonjour ! Je suis ${ctx.npcName}. Belle journée, n'est-ce pas ?`,
            SAGE: `Bienvenue, chercheur de vérité. Je suis ${ctx.npcName}.`,
            ARTISAN: `Ah, un client ! Je suis ${ctx.npcName}, maître artisan.`
        };
        return greetings[ctx.npcType] || `Salutations. Je suis ${ctx.npcName}.`;
    };

    const getInitialPrompts = (ctx: NPCContext): string[] => {
        const prompts: Record<string, string[]> = {
            MARCHAND: ["Montrez-moi vos articles", "Achetez mes objets", "Des rumeurs ?"],
            GARDE: ["Que se passe-t-il ici ?", "Des dangers à signaler ?", "Laissez-moi passer"],
            CIVIL: ["Parlez-moi de cette planète", "Des nouvelles ?", "Que faites-vous ?"],
            SAGE: ["Enseignez-moi la sagesse", "Quelle est ma destinée ?", "Parlez-moi des étoiles"],
            ARTISAN: ["Que pouvez-vous créer ?", "Améliorez mon équipement", "Réparez mon arme"]
        };
        return prompts[ctx.npcType] || ["Bonjour", "Qui êtes-vous ?", "Au revoir"];
    };

    const handleSend = async (message: string) => {
        if (!message.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: message };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await chatbotService.chat(message, npcContext, messages);

            const assistantMessage: ChatMessage = { role: 'assistant', content: response.message };
            setMessages(prev => [...prev, assistantMessage]);
            setCurrentResponse(response);
        } catch (error) {
            console.error('Erreur dialogue:', error);
            const errorMessage: ChatMessage = {
                role: 'assistant',
                content: 'Hmm... Je ne me sens pas bien. Revenez plus tard.'
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePromptClick = (prompt: string) => {
        handleSend(prompt);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(inputValue);
        }
    };

    if (!isOpen) return null;

    const emotionColors: Record<string, string> = {
        CONTENT: 'text-green-400',
        TRISTE: 'text-blue-400',
        COLERE: 'text-red-400',
        SURPRISE: 'text-yellow-400',
        NEUTRE: 'text-slate-300'
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialogue Box */}
            <div className="relative w-[500px] max-h-[70vh] bg-gradient-to-b from-slate-900 to-slate-950 border border-blue-500/30 rounded-lg shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-blue-500/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <Bot size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold">{npcContext.npcName}</h3>
                            <span className="text-xs text-slate-400">{npcContext.npcType} • {npcContext.faction}</span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                    >
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[400px]">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user'
                                    ? 'bg-green-600'
                                    : 'bg-blue-600'
                                }`}>
                                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            <div className={`max-w-[70%] px-3 py-2 rounded-lg ${msg.role === 'user'
                                    ? 'bg-green-900/40 text-green-100 rounded-tr-none'
                                    : 'bg-slate-700/50 text-slate-100 rounded-tl-none'
                                }`}>
                                <p className="text-sm">{msg.content}</p>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                                <Bot size={16} />
                            </div>
                            <div className="bg-slate-700/50 px-4 py-2 rounded-lg">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Prompts */}
                {currentResponse?.nextPrompts && currentResponse.nextPrompts.length > 0 && (
                    <div className="px-4 py-2 flex flex-wrap gap-2 border-t border-slate-700/50">
                        {currentResponse.nextPrompts.map((prompt, idx) => (
                            <button
                                key={idx}
                                onClick={() => handlePromptClick(prompt)}
                                disabled={isLoading}
                                className="px-3 py-1 text-xs bg-blue-900/30 hover:bg-blue-800/50 text-blue-300 border border-blue-700/50 rounded-full transition-colors disabled:opacity-50"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input */}
                <div className="p-3 bg-slate-800/30 border-t border-slate-700/50">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Votre message..."
                            disabled={isLoading}
                            className="flex-1 px-4 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
                        />
                        <button
                            onClick={() => handleSend(inputValue)}
                            disabled={isLoading || !inputValue.trim()}
                            className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 rounded-lg transition-colors"
                        >
                            <Send size={18} className="text-white" />
                        </button>
                    </div>
                </div>

                {/* Status bar */}
                <div className="px-4 py-1 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                    <span>
                        {chatbotService.isModelLoaded()
                            ? '🤖 Qwen3-4B (Fusion Mode)'
                            : '⚡ Mode Fallback'}
                    </span>
                    {currentResponse?.emotion && (
                        <span className={emotionColors[currentResponse.emotion] || 'text-slate-400'}>
                            {currentResponse.emotion}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NPCDialogue;
