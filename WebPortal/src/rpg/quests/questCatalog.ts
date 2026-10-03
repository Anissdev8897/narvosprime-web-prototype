// ══════════════════════════════════════════════════════════════════════════════
// quests/questCatalog.ts — Catalogue statique des quêtes (source de vérité)
//
// Même philosophie que spellCatalog / LootRegistry : le contenu de jeu vit dans
// des objets TS, pas en base. Pour AJOUTER une quête → ajoute une entrée dans
// QUESTS. Le reste (suivi, récompenses, UI) est générique et s'adapte.
//
// Types d'objectifs supportés (v1) :
//   • "kill"  : tuer N ennemis (n'importe lesquels, ou un folder précis).
//   • "reach" : atteindre une zone monde (cercle x/z + rayon) sur une map.
//   • "collect": posséder N exemplaires d'un item (itemId de LOOT_CATALOG).
//
// Récompenses : XP (montée de niveau auto), crédits, et items (itemIds).
// ══════════════════════════════════════════════════════════════════════════════

export type QuestObjectiveKind =
  | "kill"
  | "reach"
  | "collect"
  | "talk"
  | "survive"
  | "escort"
  | "use"
  | "craft";

export interface QuestObjective {
  kind: QuestObjectiveKind;
  /** Libellé affiché dans le journal / tracker (ex: "Éliminer des ennemis"). */
  label: string;
  /** Quantité requise. Pour "reach" → toujours 1. */
  target: number;
  /** "kill" : folder d'ennemi requis (cf NPC_FOLDERS). undefined = n'importe lequel. */
  enemyFolder?: string;
  /** "collect" : itemId requis (clé de LOOT_CATALOG). */
  itemId?: string;
  /** "reach" : zone cible — centre monde (x,z) + rayon (m) + map. */
  mapId?: string;
  zone?: { x: number; z: number; radius: number };
  /** "talk" / "escort" : PNJ cible. undefined = n'importe lequel. */
  npcId?: string;
  /** "survive" : duree a tenir (secondes). */
  duration?: number;
  /** "escort" : nombre de PNJs a escorter. */
  escortCount?: number;
}

export interface QuestReward {
  xp?: number;
  credits?: number;
  /** itemIds de LOOT_CATALOG octroyés à la complétion. */
  items?: string[];
}

/** Un choix au sein d'une branche narrative. */
export interface QuestBranchChoice {
  id: string;
  label: string;
  /** id de la quête vers laquelle ce choix mène. */
  leadsTo: string;
}

/** Un embranchement narratif : le joueur choisit parmi plusieurs choix. */
export interface QuestBranch {
  choices: QuestBranchChoice[];
}

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  /** Map où la quête est proposée. undefined = disponible partout. */
  mapId?: string;
  /** Faction associée (gain de rep à la complétion). */
  factionId?: import("../runtime/core/worldTypes").FactionId;
  objectives: QuestObjective[];
  reward: QuestReward;
  /** id d'une quête prérequise (chaîne narrative). undefined = dispo d'emblée. */
  requires?: string;
  /** Embranchements narratifs proposés après complétion. */
  branches?: QuestBranch[];
  /** Groupe d'exclusion : une seule quête de ce groupe peut être active/terminée. */
  exclusiveGroup?: string;
}

// ── Les quêtes ────────────────────────────────────────────────────────────────
// 💡 Pour étendre : ajoute des entrées ici. Les coordonnées "reach" ci-dessous
//    visent la ligne de front ennemie (z négatif), garantie atteignable.
export const QUESTS: QuestDef[] = [
  // ── Forge ──────────────────────────────────────────────────────────────────
  {
    id: "forge_first_blood",
    title: "Premier sang",
    description:
      "La Forge grouille d'hostiles. Fais tes preuves en éliminant une première vague.",
    mapId: "forge", factionId: "akarlys",
    objectives: [
      { kind: "kill", label: "Éliminer des ennemis", target: 5 },
    ],
    reward: { xp: 120, credits: 60 },
  },
  {
    id: "forge_collecte_essences",
    title: "Essences de la Forge",
    description:
      "Les cristaux de la Forge renferment une énergie brute. Collecte des fragments de vie et des cristaux d'énergie pour alimenter les relais akarlys.",
    mapId: "forge", factionId: "akarlys",
    requires: "forge_first_blood",
    objectives: [
      { kind: "collect", label: "Collecter des Fragments de Vie", target: 8, itemId: "fragment_vie" },
      { kind: "collect", label: "Collecter des Cristaux d'Énergie", target: 5, itemId: "cristal_energie" },
    ],
    reward: { xp: 160, credits: 90, items: ["potion_soin_majeure"] },
  },
  {
    id: "forge_frontline",
    title: "Ligne de front",
    description:
      "Avance jusqu'à la zone de combat avancée, au cœur des positions ennemies.",
    mapId: "forge", factionId: "akarlys",
    requires: "forge_first_blood",
    objectives: [
      {
        kind: "reach",
        label: "Atteindre la ligne de front",
        target: 1,
        mapId: "forge",
        zone: { x: 0, z: -50, radius: 14 },
      },
    ],
    reward: { xp: 100, credits: 40 },
  },
  {
    id: "forge_purge",
    title: "Purge de la Forge",
    description:
      "Nettoie la zone en profondeur. Le commandement récompensera ton efficacité.",
    mapId: "forge", factionId: "akarlys",
    requires: "forge_frontline",
    objectives: [
      { kind: "kill", label: "Éliminer des ennemis", target: 12 },
    ],
    reward: { xp: 320, credits: 180, items: ["potion_soin_majeure"] },
  },

  // ── Tower ──────────────────────────────────────────────────────────────────
  {
    id: "tower_hold",
    title: "Tenir la Tour",
    description:
      "Les assaillants convergent vers la Tour. Repousse-les avant qu'ils ne percent.",
    mapId: "tower", factionId: "akarlys",
    objectives: [
      { kind: "kill", label: "Repousser les assaillants", target: 10 },
    ],
    reward: { xp: 280, credits: 130 },
  },
  {
    id: "tower_summit",
    title: "Jusqu'au sommet",
    description: "Progresse jusqu'au poste avancé en surplomb de la Tour.",
    mapId: "tower", factionId: "akarlys",
    requires: "tower_hold",
    objectives: [
      {
        kind: "reach",
        label: "Atteindre le poste avancé",
        target: 1,
        mapId: "tower",
        zone: { x: 52, z: -80, radius: 16 },
      },
    ],
    reward: { xp: 140, credits: 70, items: ["potion_mana_majeure"] },
  },

  // ── Orbital — Missions spatiales ───────────────────────────────────────────
  {
    id: "orbital_patrouille",
    title: "Patrouille Spatiale",
    description:
      "L'orbital grouille de vaisseaux hostiles. Nettoie le secteur pour sécuriser la station.",
    mapId: "orbital", factionId: "akarlys",
    objectives: [
      { kind: "kill", label: "Détruire des vaisseaux ennemis", target: 6, enemyFolder: "space_ship" },
    ],
    reward: { xp: 350, credits: 200, items: ["repair_kit"] },
  },
  {
    id: "orbital_escadrille",
    title: "L'Escadrille Fantôme",
    description:
      "Une escadrille entière de chasseurs ennemis a été repérée aux abords de la station. Abats-les avant qu'ils ne lancent un assaut.",
    mapId: "orbital", factionId: "akarlys",
    requires: "orbital_patrouille",
    objectives: [
      { kind: "kill", label: "Éliminer l'escadrille spatiale", target: 12, enemyFolder: "space_ship" },
    ],
    reward: { xp: 700, credits: 450, items: ["potion_soin_supreme", "key_corvette"] },
  },

  // ── Donjon Furiste (déverrouillage de l'instance) ────────────────────────────
  {
    id: "acces_donjon_furiste",
    title: "L'Appel du Donjon Furiste",
    description:
      "Un portail instable pulse d'une énergie bestiale. Accepte cette quête pour en débloquer l'accès, puis franchis le portail pour pénétrer dans le donjon.",
    objectives: [
      { kind: "kill", label: "Prouver ta valeur (éliminer des ennemis)", target: 3 },
    ],
    reward: { xp: 200, credits: 120 },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

export function getQuest(id: string): QuestDef | undefined {
  return BY_ID[id];
}

/** Quêtes proposables sur une map donnée (mapId match ou quête globale). */
export function questsForMap(mapId: string): QuestDef[] {
  return QUESTS.filter((q) => q.mapId == null || q.mapId === mapId);
}
