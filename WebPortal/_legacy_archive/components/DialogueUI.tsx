import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, ArrowRight } from 'lucide-react';
import { DofusNpc } from '../data/dofusNpcs';

interface DialogueUIProps {
    npc: DofusNpc | null;
    onClose: () => void;
}

export const DialogueUI: React.FC<DialogueUIProps> = ({ npc, onClose }) => {
    const [currentText, setCurrentText] = useState("");

    useEffect(() => {
        if (npc) {
            // Simulation de texte basé sur l'ID de dialogue (En vrai, on extrairait npcs_messages)
            const mockDialogues: Record<number, string> = {
                428977: "Bonjour citoyen. Je veille sur les richesses de cette contrée pour le bien de ma guilde.",
                144341: "Bienvenue à Astrub ! Faites attention aux Bouftous dans les champs.",
                764016: "Besoin de provisions pour votre voyage ? J'ai tout ce qu'il vous faut.",
                581067: "Voulez-vous tester votre bravoure ? Le Bouftou Royal n'attend que vous.",
                621842: "Le travail de la terre est rude, mais gratifiant. Vous cherchez du blé ?",
                189020: "Vos kamas sont en sécurité avec moi. Voulez-vous consulter votre coffre ?"
            };
            setCurrentText(mockDialogues[npc.dialogIds[0]] || "Salutations, voyageur.");
        }
    }, [npc]);

    if (!npc) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-32 left-1/2 -translate-x-1/2 w-[600px] z-[100]"
            >
                <div className="bg-slate-900/95 border-2 border-slate-700 rounded-2xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                    {/* Header PNJ */}
                    <div className="flex items-center gap-4 mb-4 border-b border-slate-700 pb-3">
                        <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center text-2xl border border-blue-500/30">
                            👤
                        </div>
                        <div>
                            <div className="text-white font-black uppercase text-sm tracking-widest">{npc.name}</div>
                            <div className="text-[10px] text-blue-400 font-bold uppercase italic">PNJ de Niveau 100</div>
                        </div>
                        <button onClick={onClose} className="ml-auto text-slate-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Texte du Dialogue */}
                    <div className="text-slate-200 text-lg leading-relaxed font-medium italic mb-6">
                        "{currentText}"
                    </div>

                    {/* Options de réponse */}
                    <div className="space-y-2">
                        <button className="w-full text-left bg-white/5 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/30 p-3 rounded-xl flex items-center justify-between group transition-all">
                            <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">En savoir plus...</span>
                            <ArrowRight size={14} className="text-slate-600 group-hover:text-blue-400 transition-all group-hover:translate-x-1" />
                        </button>
                        <button onClick={onClose} className="w-full text-left bg-white/5 hover:bg-red-600/20 border border-white/5 hover:border-red-500/30 p-3 rounded-xl flex items-center justify-between group transition-all">
                            <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">Au revoir.</span>
                            <MessageSquare size={14} className="text-slate-600 group-hover:text-red-400" />
                        </button>
                    </div>

                    {/* Grille de fond décorative */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full" />
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
