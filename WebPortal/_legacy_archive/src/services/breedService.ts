/**
 * 🎭 SERVICE DE GESTION DES CLASSES DOFUS
 * Intègre les 18 classes Dofus au système de jeu
 */

import { DOFUS_BREEDS, DofusBreed, getBreedById as getDofusBreedById } from '../data/dofusBreeds';
import { NARVOS_BREEDS, getOriginalClassId } from '../data/narvosBreeds';
import { DOFUS_SPELLS, DofusSpell } from '../data/dofusSpells';

// TOGGLE THIS TO SWITCH BETWEEN GAMES
const USE_NARVOS_CLASSES = true;

const ALL_BREEDS = USE_NARVOS_CLASSES ? NARVOS_BREEDS : DOFUS_BREEDS;

export interface BreedStats {
    hp: number;
    maxHp: number;
    ap: number;
    maxAp: number;
    mp: number;
    maxMp: number;
    vitality: number;
    wisdom: number;
    strength: number;
    intelligence: number;
    chance: number;
    agility: number;
}

export interface CharacterBreed {
    breed: DofusBreed;
    level: number;
    stats: BreedStats;
    spells: DofusSpell[];
    statPoints: number; // Points à distribuer
    spellPoints: number;
}

/**
 * Calcule les stats d'un personnage selon sa classe et son niveau
 */
export function calculateStats(breed: DofusBreed, level: number): BreedStats {
    const base = breed.baseStats;

    // Formule Dofus: Stats de base + bonus par niveau
    return {
        hp: base.vitality * 5 + (level * 5), // Vitalité donne 5 HP
        maxHp: base.vitality * 5 + (level * 5),
        ap: base.ap,
        maxAp: base.ap,
        mp: base.mp,
        maxMp: base.mp,
        vitality: base.vitality + Math.floor(level / 5),
        wisdom: base.wisdom,
        strength: base.strength,
        intelligence: base.intelligence,
        chance: base.chance,
        agility: base.agility
    };
}

/**
 * Récupère les sorts disponibles pour une classe à un niveau donné
 */
export function getAvailableSpells(breed: DofusBreed, level: number): DofusSpell[] {
    return breed.starterSpells
        .map(id => DOFUS_SPELLS.find(s => s.id === id))
        .filter((s): s is DofusSpell => s !== undefined);
}

/**
 * Crée un nouveau personnage avec une classe
 */
export function createCharacterWithBreed(breedId: number, name: string): CharacterBreed | null {
    const breed = getBreedById(breedId);
    if (!breed) return null;

    return {
        breed,
        level: 1,
        stats: calculateStats(breed, 1),
        spells: getAvailableSpells(breed, 1),
        statPoints: 0,
        spellPoints: 1
    };
}

/**
 * Convertit une classe Dofus vers le format ClassData existant
 */
export function convertBreedToClassData(breed: DofusBreed) {
    return {
        name: breed.name,
        faction: 'HUMAN',
        difficulty: breed.difficulty,
        archetype: breed.role === 'Tank' ? 'TANK' :
            breed.role === 'DPS' ? 'DPS' :
                breed.role === 'Healer' ? 'SUPPORT' : 'DPS',
        description: breed.description,
        baseStats: {
            hp: breed.baseStats.vitality * 5,
            maxHp: breed.baseStats.vitality * 5,
            ap: breed.baseStats.ap,
            mp: breed.baseStats.mp,
            strength: breed.baseStats.strength,
            intelligence: breed.baseStats.intelligence,
            chance: breed.baseStats.chance,
            agility: breed.baseStats.agility
        },
        starterSpells: breed.starterSpells.map(String),
        spriteConfig: null, // À définir par classe
        icon: getBreedIcon(breed.id),
        colors: breed.colors
    };
}

/**
 * Retourne l'icône emoji pour une classe
 */
export function getBreedIcon(breedId: number): string {
    // Narvos Icons Mapping
    const narvosIcons: Record<number, string> = {
        1001: '🛡️', // Gardien Prime
        1002: '🗡️', // Eclipseur
        1003: '🔮', // Crystalmage
        1004: '🎯', // Sentinelle
        1005: '🩸', // Siphonneur
        1006: '🔨', // Martel
        1007: '🧪', // Alchimiste
        1008: '🌌', // Navigateur
        1009: '🤖', // Technomandien
        1010: '👁️', // Pretresse
        1011: '🃏', // Aurion
        1012: '🌱'  // Sylvestre
    };

    // Dofus Icons Mapping
    const dofusIcons: Record<number, string> = {
        1: '🛡️',   // Feca
        2: '🐉',   // Osamodas
        3: '💰',   // Enutrof
        4: '🗡️',   // Sram
        5: '⏰',   // Xelor
        6: '🎲',   // Ecaflip
        7: '💚',   // Eniripsa
        8: '⚔️',   // Iop
        9: '🏹',   // Cra
        10: '🌿',  // Sadida
        11: '🩸',  // Sacrieur
        12: '🍺',  // Pandawa
        13: '💣',  // Roublard
        14: '🎭',  // Zobal
        15: '⚙️',  // Steamer
        16: '🌀',  // Eliotrope
        17: '✨',  // Huppermage
        18: '🐕'   // Ouginak
    };

    return narvosIcons[breedId] || dofusIcons[breedId] || '❓';
}

/**
 * Liste toutes les classes disponibles
 */
export function getAllBreeds(): DofusBreed[] {
    return ALL_BREEDS;
}

/**
 * Récupère une classe par ID
 */
export function getBreedById(id: number): DofusBreed | undefined {
    return ALL_BREEDS.find(breed => breed.id === id);
}

/**
 * Récupère une classe par nom
 */
export function getBreedByName(name: string): DofusBreed | undefined {
    return ALL_BREEDS.find(breed =>
        breed.name.toLowerCase() === name.toLowerCase() ||
        breed.shortName.toLowerCase() === name.toLowerCase()
    );
}

/**
 * Filtre les classes par rôle
 */
export function getBreedsByRole(role: DofusBreed['role']): DofusBreed[] {
    return ALL_BREEDS.filter(b => b.role === role);
}

export const breedService = {
    getBreedById,
    getBreedByName,
    getAllBreeds,
    getBreedsByRole,
    calculateStats,
    getAvailableSpells,
    createCharacterWithBreed,
    convertBreedToClassData,
    getBreedIcon,
    getOriginalClassId
};

export default breedService;
