// ══════════════════════════════════════════════════════════════════════════════
// dialogue/data/maitre_forgeron.ts — Définition TS du dialogue Maître Forgeron
//
// Équivalent TypeScript du YAML maitre_forgeron.yaml. Préféré pour le typage
// statique ; le YAML sert pour l'édition par des non-développeurs.
// ══════════════════════════════════════════════════════════════════════════════

import type { DialogueDef } from "../types";

export const MAITRE_FORGERON_DIALOGUE: DialogueDef = {
  id: "maitre_forgeron",
  title: "Le Maître Forgeron",
  npcFolder: "boris",
  npcName: "Boris",
  startNode: "accueil",
  tags: ["forge", "quest", "main"],

  nodes: [
    // ── Accueil ──────────────────────────────────────────────────────────
    {
      id: "accueil",
      speaker: "Boris",
      text: `Salut, {player}. La Forge a besoin de bras. T'as l'air d'un
combattant — t'auras ta part de gloire si tu tiens le choc.`,
      choices: [
        {
          text: "J'veux en découdre. Qu'est-ce qu'il y a à faire ?",
          nextNode: "proposer_premier_sang",
        },
        {
          text: "J'ai fait le tour des hostiles. Quoi d'autre ?",
          nextNode: "proposer_frontline",
          conditions: [
            { type: "quest_completed", params: { questId: "forge_first_blood" } },
            { type: "quest_not_active", params: { questId: "forge_frontline" } },
          ],
        },
        {
          text: "J'ai tenu la ligne de front. Donne-moi du lourd.",
          nextNode: "proposer_purge",
          conditions: [
            { type: "quest_completed", params: { questId: "forge_frontline" } },
            { type: "quest_not_active", params: { questId: "forge_purge" } },
          ],
        },
        {
          text: "J'ai besoin d'approvisionnement. T'as des ressources ?",
          nextNode: "proposer_collecte",
          conditions: [
            { type: "quest_completed", params: { questId: "forge_first_blood" } },
            { type: "quest_not_active", params: { questId: "forge_collecte_essences" } },
          ],
        },
        {
          text: "Dis donc, c'est quoi ta faction au juste ?",
          nextNode: "faction_info",
          conditions: [
            { type: "reputation_min", params: { faction: "akarlys", min: 100 } },
          ],
        },
        {
          text: "Je reviendrai.",
          nextNode: "au_revoir",
        },
      ],
    },

    // ── Proposer Premier Sang ────────────────────────────────────────────
    {
      id: "proposer_premier_sang",
      speaker: "Boris",
      text: `Des vagues d'hostiles déferlent par le nord. On tient la ligne,
mais on perd du terrain. Monte en première ligne, fais tes
preuves — abats-en cinq. Je te paierai en crédits et en XP.`,
      choices: [
        {
          text: "Compte sur moi. J'y vais.",
          nextNode: "accepte_mission_1",
          onSelect: [
            { type: "give_quest", params: { questId: "forge_first_blood" } },
            { type: "play_sound", params: { soundId: "quest_accept" } },
          ],
        },
        {
          text: "Pas maintenant. J'ai besoin de me préparer.",
          nextNode: "accueil",
        },
      ],
    },

    {
      id: "accepte_mission_1",
      speaker: "Boris",
      text: `Voilà qui est parlé ! La paie t'attend à ton retour.
Et n'oublie pas : vise la tête, ça va plus vite.`,
      choices: [
        {
          text: "Compris. J'y vais.",
          nextNode: "fin_dialogue",
        },
      ],
    },

    // ── Proposer Frontline ───────────────────────────────────────────────
    {
      id: "proposer_frontline",
      speaker: "Boris",
      text: `T'as fait du bon boulot, je te l'accorde. Mais ce n'est que
le début. Les grosses légumes veulent que tu pousses jusqu'à
la ligne de front ennemie — au nord, à une cinquantaine de
mètres. Repère le terrain et reviens me faire ton rapport.`,
      choices: [
        {
          text: "J'irai voir ce qu'il y a là-bas.",
          nextNode: "accepte_frontline",
          onSelect: [
            { type: "give_quest", params: { questId: "forge_frontline" } },
          ],
        },
        {
          text: "Je finis d'abord ce que j'ai commencé.",
          nextNode: "accueil",
        },
      ],
    },

    {
      id: "accepte_frontline",
      speaker: "Boris",
      text: `Bonne chance, soldat. La zone est chaude — blinde-toi bien
et reste en couverture.`,
    },

    // ── Proposer Purge ───────────────────────────────────────────────────
    {
      id: "proposer_purge",
      speaker: "Boris",
      text: `Bon sang, t'as tenu la ligne ! Le commandement est impressionné.
Maintenant, on va en profiter : je veux une purge totale de
la zone. Nettoie-moi ce secteur, abats-en douze.
La solde sera bonne.`,
      choices: [
        {
          text: "Je nettoie tout. Fini les rôdeurs.",
          nextNode: "accepte_purge",
          onSelect: [
            { type: "give_quest", params: { questId: "forge_purge" } },
          ],
        },
      ],
    },

    {
      id: "accepte_purge",
      speaker: "Boris",
      text: `C'est mon gars ! À ton retour, tu seras décoré. Et bien payé.`,
    },

    // ── Proposer Collecte ────────────────────────────────────────────────
    {
      id: "proposer_collecte",
      speaker: "Boris",
      text: `On manque de ressources. Les relais akarlys ont besoin de
fragments de vie et de cristaux d'énergie. Tu croises ce
genre de trucs sur les cadavres d'hostiles — ramène-m'en
un maximum, je te les paie au prix fort.`,
      choices: [
        {
          text: "Je peux te trouver ça, oui.",
          nextNode: "accepte_collecte",
          onSelect: [
            { type: "give_quest", params: { questId: "forge_collecte_essences" } },
          ],
        },
      ],
    },

    {
      id: "accepte_collecte",
      speaker: "Boris",
      text: `Parfait. Apporte-moi ça et je te file une potion de soin
majeure en prime. Bonne chasse !`,
    },

    // ── Faction info ─────────────────────────────────────────────────────
    {
      id: "faction_info",
      speaker: "Boris",
      text: `Moi ? Je suis un fidèle d'Akar'lys. On tient cette forge
depuis des générations. Les Mezalayis voudraient la main
dessus, et les Zayan — ces aliens — rôdent dans l'ombre.
Toi aussi t'as une faction, non ? Montre-toi digne et
t'auras notre confiance.`,
      choices: [
        {
          text: "Intéressant. Bon, revenons aux choses sérieuses.",
          nextNode: "accueil",
        },
      ],
    },

    // ── Au revoir ────────────────────────────────────────────────────────
    {
      id: "au_revoir",
      speaker: "Boris",
      text: `Reviens me voir quand t'as du sang neuf à verser.
La Forge a toujours besoin de héros.`,
    },

    // ── Fin du dialogue ──────────────────────────────────────────────────
    {
      id: "fin_dialogue",
      text: "",
    },
  ],
};
