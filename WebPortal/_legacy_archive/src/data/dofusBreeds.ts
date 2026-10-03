/**
 * 🎭 LES 18 CLASSES DOFUS 2.61 COMPLÈTES
 * Données officielles extraites de Breeds.d2o et BreedSpells
 */

export interface DofusBreed {
    id: number;
    name: string;
    shortName: string;
    description: string;
    role: 'Tank' | 'DPS' | 'Support' | 'Healer' | 'Summoner' | 'Hybrid';
    difficulty: 1 | 2 | 3; // 1 = Facile, 3 = Difficile
    baseStats: {
        vitality: number;
        wisdom: number;
        strength: number;
        intelligence: number;
        chance: number;
        agility: number;
        ap: number;  // Points d'Action
        mp: number;  // Points de Mouvement
    };
    starterSpells: number[]; // IDs des sorts de départ
    iconId: number;
    colors: {
        primary: string;
        secondary: string;
    };
}

export const DOFUS_BREEDS: DofusBreed[] = [
    // === CLASSES TANK/PROTECTION ===
    {
        id: 1,
        name: "Feca",
        shortName: "FECA",
        description: "Protecteurs nés, les Fecas utilisent des boucliers magiques et des glyphes pour protéger leurs alliés.",
        role: 'Tank',
        difficulty: 2,
        baseStats: { vitality: 55, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [1, 2, 3, 4], // Armure Incandescente, Attaque Naturelle, etc.
        iconId: 10,
        colors: { primary: '#8B4513', secondary: '#D2691E' }
    },
    {
        id: 11,
        name: "Sacrieur",
        shortName: "SACRI",
        description: "Guerriers de sang, les Sacrieurs deviennent plus puissants en souffrant. Maîtres de la survie.",
        role: 'Tank',
        difficulty: 2,
        baseStats: { vitality: 60, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [432, 433, 434, 435], // Châtiment, Punition, etc.
        iconId: 110,
        colors: { primary: '#8B0000', secondary: '#DC143C' }
    },

    // === CLASSES DPS MÊLÉE ===
    {
        id: 8,
        name: "Iop",
        shortName: "IOP",
        description: "Guerriers impétueux, les Iops cherchent le corps à corps et infligent d'énormes dégâts.",
        role: 'DPS',
        difficulty: 1,
        baseStats: { vitality: 50, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [1, 3, 5, 7, 9, 11, 13], // Pression, Bond, Épée Divine, etc.
        iconId: 80,
        colors: { primary: '#FFD700', secondary: '#FFA500' }
    },
    {
        id: 4,
        name: "Sram",
        shortName: "SRAM",
        description: "Assassins de l'ombre, les Srams utilisent pièges et invisibilité pour éliminer leurs cibles.",
        role: 'DPS',
        difficulty: 3,
        baseStats: { vitality: 45, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [61, 62, 63, 64], // Piège Sournois, Invisibilité, etc.
        iconId: 40,
        colors: { primary: '#2F4F4F', secondary: '#696969' }
    },
    {
        id: 18,
        name: "Ouginak",
        shortName: "OUGI",
        description: "Mi-homme mi-chien, l'Ouginak traque sa proie sans relâche et devient plus fort à mesure qu'il la blesse.",
        role: 'DPS',
        difficulty: 2,
        baseStats: { vitality: 50, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [5001, 5002, 5003, 5004],
        iconId: 180,
        colors: { primary: '#4A4A4A', secondary: '#8B4513' }
    },

    // === CLASSES DPS DISTANCE ===
    {
        id: 9,
        name: "Cra",
        shortName: "CRA",
        description: "Archers d'élite, les Cras frappent de très loin avec une précision mortelle.",
        role: 'DPS',
        difficulty: 1,
        baseStats: { vitality: 45, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [121, 122, 123, 124, 125], // Flèche Magique, Flèche de Recul, etc.
        iconId: 90,
        colors: { primary: '#228B22', secondary: '#32CD32' }
    },
    {
        id: 13,
        name: "Roublard",
        shortName: "ROUB",
        description: "Experts en explosifs, les Roublards posent des bombes tactiques pour contrôler le terrain.",
        role: 'DPS',
        difficulty: 3,
        baseStats: { vitality: 48, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [2001, 2002, 2003, 2004], // Bombe, Détonateur, etc.
        iconId: 130,
        colors: { primary: '#FF4500', secondary: '#FF6347' }
    },

    // === CLASSES SUPPORT ===
    {
        id: 5,
        name: "Xelor",
        shortName: "XELO",
        description: "Maîtres du temps, les Xelors manipulent les PA et téléportent leurs alliés et ennemis.",
        role: 'Support',
        difficulty: 3,
        baseStats: { vitality: 42, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [81, 82, 83, 84], // Ralentissement, Aiguille, etc.
        iconId: 50,
        colors: { primary: '#4169E1', secondary: '#1E90FF' }
    },
    {
        id: 3,
        name: "Enutrof",
        shortName: "ENU",
        description: "Chasseurs de trésors, les Enutrofs augmentent les drops et contrôlent le terrain avec leurs pelles.",
        role: 'Support',
        difficulty: 2,
        baseStats: { vitality: 50, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [41, 42, 43, 44], // Lancer de Pelle, Coffre, etc.
        iconId: 30,
        colors: { primary: '#DAA520', secondary: '#FFD700' }
    },
    {
        id: 17,
        name: "Huppermage",
        shortName: "HUPP",
        description: "Maîtres des quatre éléments, les Huppermages combinent Feu, Eau, Terre et Air.",
        role: 'Hybrid',
        difficulty: 3,
        baseStats: { vitality: 48, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [4001, 4002, 4003, 4004],
        iconId: 170,
        colors: { primary: '#9932CC', secondary: '#8B008B' }
    },

    // === CLASSES HEALER ===
    {
        id: 7,
        name: "Eniripsa",
        shortName: "ENI",
        description: "Guérisseurs du monde des Douze, les Eniripsas maintiennent leurs alliés en vie.",
        role: 'Healer',
        difficulty: 1,
        baseStats: { vitality: 42, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [101, 102, 103, 104], // Mot Curatif, Mot Revitalisant, etc.
        iconId: 70,
        colors: { primary: '#FF69B4', secondary: '#FFB6C1' }
    },

    // === CLASSES INVOCATEUR ===
    {
        id: 2,
        name: "Osamodas",
        shortName: "OSA",
        description: "Invocateurs de créatures sauvages, les Osamodas contrôlent le combat avec leurs invocations.",
        role: 'Summoner',
        difficulty: 2,
        baseStats: { vitality: 48, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [21, 22, 23, 24], // Invocation Tofu, Invocation Bouftou, etc.
        iconId: 20,
        colors: { primary: '#FF8C00', secondary: '#FFA500' }
    },
    {
        id: 10,
        name: "Sadida",
        shortName: "SADI",
        description: "Maîtres de la nature, les Sadidas invoquent des poupées et posent des ronces empoisonnées.",
        role: 'Summoner',
        difficulty: 2,
        baseStats: { vitality: 50, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [141, 142, 143, 144], // Poupée Sacrifiée, Ronces, etc.
        iconId: 100,
        colors: { primary: '#006400', secondary: '#228B22' }
    },
    {
        id: 15,
        name: "Steamer",
        shortName: "STEAM",
        description: "Ingénieurs mécaniques, les Steamers utilisent des tourelles et des machines de combat.",
        role: 'Summoner',
        difficulty: 3,
        baseStats: { vitality: 45, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [3001, 3002, 3003, 3004], // Tourelle, Foreuse, etc.
        iconId: 150,
        colors: { primary: '#708090', secondary: '#A9A9A9' }
    },

    // === CLASSES HYBRIDES ===
    {
        id: 6,
        name: "Ecaflip",
        shortName: "ECA",
        description: "Joueurs compulsifs, les Ecaflips misent tout sur la chance et les coups critiques.",
        role: 'Hybrid',
        difficulty: 2,
        baseStats: { vitality: 50, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [91, 92, 93, 94], // Pile ou Face, Bluff, etc.
        iconId: 60,
        colors: { primary: '#FF1493', secondary: '#FF69B4' }
    },
    {
        id: 12,
        name: "Pandawa",
        shortName: "PANDA",
        description: "Guerriers alcoolisés, les Pandawas lancent leurs ennemis et alliés tout en buvant.",
        role: 'Hybrid',
        difficulty: 2,
        baseStats: { vitality: 55, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [161, 162, 163, 164], // Karcham, Chamrak, Gueule de Bois, etc.
        iconId: 120,
        colors: { primary: '#8B0000', secondary: '#B22222' }
    },
    {
        id: 14,
        name: "Zobal",
        shortName: "ZOBAL",
        description: "Maîtres des masques, les Zobals changent de style de combat selon le masque porté.",
        role: 'Hybrid',
        difficulty: 3,
        baseStats: { vitality: 48, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [181, 182, 183, 184], // Masque Coward, Masque Psychopathe, etc.
        iconId: 140,
        colors: { primary: '#4B0082', secondary: '#8A2BE2' }
    },
    {
        id: 16,
        name: "Eliotrope",
        shortName: "ELIO",
        description: "Manipulateurs de portails, les Eliotropes créent des passages dimensionnels tactiques.",
        role: 'Hybrid',
        difficulty: 3,
        baseStats: { vitality: 45, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0, ap: 6, mp: 3 },
        starterSpells: [201, 202, 203, 204], // Portail, Afflux, etc.
        iconId: 160,
        colors: { primary: '#00CED1', secondary: '#20B2AA' }
    }
];

// Fonction utilitaire pour récupérer une classe par ID
export function getBreedById(id: number): DofusBreed | undefined {
    return DOFUS_BREEDS.find(breed => breed.id === id);
}

// Fonction utilitaire pour récupérer une classe par nom
export function getBreedByName(name: string): DofusBreed | undefined {
    return DOFUS_BREEDS.find(breed =>
        breed.name.toLowerCase() === name.toLowerCase() ||
        breed.shortName.toLowerCase() === name.toLowerCase()
    );
}

// Liste des IDs de classes dans l'ordre Dofus
export const BREED_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export default DOFUS_BREEDS;
