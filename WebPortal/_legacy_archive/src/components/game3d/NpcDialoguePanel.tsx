/**
 * NpcDialoguePanel.tsx - Modale de dialogue avec NPC + systeme de quete simple.
 *
 * Format des NPC :
 *   id, name, dialogue (lignes a afficher), questOffer? (quete a donner)
 *
 * Quete : tuer N monstres. Reward : XP + item optionnel.
 * Persistance : localStorage par perso.
 */

import React, { useState } from 'react';
import { User, Sparkles, X, Check, Sword } from 'lucide-react';

export interface NpcDef {
  id: string;
  name: string;
  faction: string;
  cellX: number; cellY: number;
  dialogue: string[];
  questOffer?: QuestDef;
}

export interface QuestDef {
  id: string;
  name: string;
  description: string;
  killTarget: number;
  xpReward: number;
  itemReward?: string;
}

export type QuestState = 'available' | 'active' | 'completed' | 'rewarded';

export interface QuestProgress {
  questId: string;
  state: QuestState;
  killCount: number;
  npcId: string;
}

export const DEFAULT_NPCS: NpcDef[] = [
  {
    id: 'npc_alex',
    name: 'Alex',
    faction: 'akarlys',
    cellX: 4, cellY: 4,
    dialogue: [
      "Bienvenue dans le Hub Orbital, voyageur.",
      "Les biotech zayan se sont réveillés à proximité.",
      "Aide-moi à les éliminer et je te récompenserai.",
    ],
    questOffer: {
      id: 'q_first_blood',
      name: 'Premier Sang',
      description: 'Élimine 3 créatures hostiles.',
      killTarget: 3,
      xpReward: 100,
      itemReward: 'potion_01',
    },
  },
  {
    id: 'npc_lyria',
    name: 'Lyria',
    faction: 'mezalayis',
    cellX: 11, cellY: 11,
    dialogue: [
      "Les mercenaires Mezalayis sont nos alliés temporaires.",
      "Reste vigilant, voyageur. Le désert ne pardonne pas.",
    ],
  },
];

interface Props {
  open: boolean;
  npc: NpcDef | null;
  questProgress: Record<string, QuestProgress>;
  onClose: () => void;
  onAcceptQuest: (questId: string, npcId: string) => void;
  onClaimReward: (questId: string) => void;
}

export const NpcDialoguePanel: React.FC<Props> = ({ open, npc, questProgress, onClose, onAcceptQuest, onClaimReward }) => {
  const [page, setPage] = useState(0);
  if (!open || !npc) return null;

  const quest = npc.questOffer;
  const progress = quest ? questProgress[quest.id] : null;
  const lastPage = page >= npc.dialogue.length - 1;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]">
      <div className="bg-stone-950 border-4 border-cyan-700 rounded-2xl p-8 shadow-2xl w-[600px]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-cyan-900/40 border-2 border-cyan-500 rounded-full flex items-center justify-center">
              <User size={24} className="text-cyan-300" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase text-white tracking-wider">{npc.name}</h2>
              <div className="text-xs uppercase tracking-widest text-cyan-400">{npc.faction}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-800 rounded">
            <X size={20} className="text-stone-400" />
          </button>
        </div>

        {/* Dialogue */}
        <div className="bg-stone-900 border border-stone-700 rounded-lg p-5 mb-4 min-h-[100px]">
          <p className="text-stone-200 text-base leading-relaxed">"{npc.dialogue[page]}"</p>
        </div>

        {/* Quest section */}
        {lastPage && quest && (
          <div className="bg-amber-900/20 border-2 border-amber-700 rounded-lg p-5 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={18} className="text-amber-400" />
              <h3 className="font-bold text-amber-300 uppercase tracking-wider">{quest.name}</h3>
            </div>
            <p className="text-stone-300 text-sm mb-3">{quest.description}</p>
            <div className="flex items-center gap-4 text-xs text-stone-400 mb-3">
              <div className="flex items-center gap-1"><Sword size={12} /> {quest.killTarget} kills</div>
              <div>+{quest.xpReward} XP</div>
              {quest.itemReward && <div>+1 item</div>}
            </div>

            {!progress && (
              <button onClick={() => onAcceptQuest(quest.id, npc.id)}
                className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold uppercase tracking-widest rounded">
                Accepter
              </button>
            )}
            {progress?.state === 'active' && (
              <div className="text-center">
                <div className="text-sm text-amber-300 mb-2">Progression : <b>{progress.killCount}/{quest.killTarget}</b></div>
                {progress.killCount >= quest.killTarget ? (
                  <button onClick={() => onClaimReward(quest.id)}
                    className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest rounded flex items-center justify-center gap-2">
                    <Check size={16} /> Récupérer la récompense
                  </button>
                ) : (
                  <div className="text-xs text-stone-500">Reviens quand tu auras éliminé tes cibles.</div>
                )}
              </div>
            )}
            {progress?.state === 'completed' && (
              <div className="text-center text-emerald-400 font-bold uppercase text-sm">✓ Quête déjà accomplie</div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <div className="text-xs text-stone-600">{page + 1} / {npc.dialogue.length}</div>
          <div className="flex gap-2">
            {page > 0 && (
              <button onClick={() => setPage(p => p - 1)} className="px-4 py-2 bg-stone-800 text-stone-300 rounded hover:bg-stone-700 text-sm">
                Précédent
              </button>
            )}
            {!lastPage ? (
              <button onClick={() => setPage(p => p + 1)} className="px-4 py-2 bg-cyan-700 text-cyan-100 rounded hover:bg-cyan-600 text-sm font-bold">
                Suivant
              </button>
            ) : (
              <button onClick={onClose} className="px-4 py-2 bg-stone-800 text-stone-300 rounded hover:bg-stone-700 text-sm">
                Fermer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
