import React from 'react';
import { ClassData, Spell, Region, City } from './types';
import manifest from './data/assets-manifest.json';

// Head variants for character customization
export const HEAD_VARIANTS = [
    { id: 0, name: 'Standard' },
    { id: 1, name: 'Alternatif A' },
    { id: 2, name: 'Alternatif B' },
    { id: 3, name: 'Rare' }
];

const createSpell = (
    id: string,
    name: string,
    description: string,
    icon: string,
    apCost: number,
    range: number,
    damageElement: 'earth' | 'fire' | 'water' | 'air' | 'neutral' | 'heal',
    vfxFolder: string,
    vfxIndex: number
): Spell => ({
    id,
    name,
    description,
    icon,
    apCost,
    paCost: apCost,
    pmCost: 0,
    range,
    minRange: 1,
    maxRange: range,
    damage: { min: apCost * 10, max: apCost * 15, element: damageElement },
    effectType: 'projectile',
    color: '#ffffff',
    animationConfig: {
        folder: `/textures/new_asset/asset_principal/Speel/${vfxFolder}/VFX${vfxIndex}/sprite-sheet`,
        prefix: `VFX${vfxIndex}`,
        frameCount: 8
    },
    lineOfSight: true,
    modifiableRange: true,
    zoneShape: 'single',
    zoneSize: 1,
    cooldown: 0,
    usesPerTurn: 2,
    currentLevel: 1,
    maxLevel: 5,
    levelRequired: 1,
    type: 'offense',
    effects: [{
        type: damageElement === 'heal' ? 'heal' : 'damage',
        element: (damageElement === 'earth' ? 'terre' : damageElement === 'water' ? 'eau' : damageElement) as any,
        value: apCost * 12,
        valuePerLevel: 2
    }]
});

// Helper to format names from folder names
const formatName = (folder: string) => folder.replace(/_/g, ' ');

// VFX Mapping for Classes
const CLASS_VFX_MAP: Record<string, string> = {
    'halberdwarrior': 'Pixel Art Warrior Animations - Full Version',
    'knight_girl': 'Pixel Art VFX - Paladin - FULL Version',
    'knight_man': 'Blood Knight VFX',
    'thief': 'Pixel Art VFX - Warlock - FULL Version',
    'prototyping_hero': 'Pixel Art VFX - Fire Mage - FULL Version',
    'assembled_shadow_optimized_spritesheets': 'Pixel Art VFX - Dark Mage'
};

const ELEMENT_MAP: Record<string, any> = {
    'halberdwarrior': 'earth',
    'knight_girl': 'neutral',
    'knight_man': 'fire',
    'thief': 'air',
    'prototyping_hero': 'fire',
    'assembled_shadow_optimized_spritesheets': 'neutral'
};

// ═══════════════════════════════════════════════════════════════
// NARVOS_CLASSES — basé sur les 10 classes officielles 3D
// (modeles GLB Meshy AI dans /models/iso_poc/<class_id>/)
// L'ancien systeme spriteConfig 2D legacy (manifest.heroes -> /textures/new_asset/...)
// est supprime au profit de model3D. Voir src/data/narvos-classes.ts.
// ═══════════════════════════════════════════════════════════════
import { NARVOS_CLASSES as NARVOS_CLASSES_3D } from './data/narvos-classes';

// On etend chaque classe avec un VFX legacy (pour les sorts) afin de rester
// compatible avec le SpritesheetAnimator des sorts. Le rendu visuel du perso
// utilise model3D.
export const NARVOS_CLASSES: ClassData[] = NARVOS_CLASSES_3D.map((cls: any) => {
    const vfxFolder = CLASS_VFX_MAP[cls.id] || 'Pixel Art Warrior Animations - Full Version';
    const element = ELEMENT_MAP[cls.id] || 'neutral';
    return {
        ...cls,
        roleTitle: cls.roleTitle || "Héros",
        element,
        icon: "Shield",
        // model3D deja present dans cls (defini dans data/narvos-classes.ts)
        // spriteConfig conserve si present (pour fallback) ; sinon undefined
        spells: cls.spells && cls.spells.length > 0
            ? cls.spells
            : [1, 2, 3].map(i =>
                createSpell(`${cls.id}_spell_${i}`, `Sort ${i}`, `Sort de classe ${cls.name}.`, "Zap", 3, 5, element, vfxFolder, i)
            )
    };
});

// --- LEGACY HEROES (NOW NPCS) ---
export const NARVOS_NPCS: ClassData[] = [
    { id: "alex", name: "Alex", lore: "Ancien héros devenu guide.", roleTitle: "PNJ", element: "neutral", icon: "User", colors: { primary: "#3b82f6", secondary: "#ef4444", skin: "#fcd34d" }, stats: { hp: 200, pa: 6, pm: 3, puissance: 10, critique: 5, initiative: 100 }, spriteConfig: { isFlatSpritesheet: true, assetType: 'LEGACY_NPC', malePath: "/textures/new_asset/Character and Portrait/Character/Pre-made/Alex", femalePath: "/textures/new_asset/Character and Portrait/Character/Pre-made/Alex" }, spells: [] },
    { id: "josh", name: "Josh", lore: "Ancien héros devenu marchand.", roleTitle: "PNJ", element: "neutral", icon: "User", colors: { primary: "#3b82f6", secondary: "#ef4444", skin: "#fcd34d" }, stats: { hp: 200, pa: 6, pm: 3, puissance: 10, critique: 5, initiative: 100 }, spriteConfig: { isFlatSpritesheet: true, assetType: 'LEGACY_NPC', malePath: "/textures/new_asset/Character and Portrait/Character/Pre-made/Josh", femalePath: "/textures/new_asset/Character and Portrait/Character/Pre-made/Josh" }, spells: [] },
    { id: "lyria", name: "Lyria", lore: "Ancienne héroïne devenue protectrice.", roleTitle: "PNJ", element: "neutral", icon: "User", colors: { primary: "#3b82f6", secondary: "#ef4444", skin: "#fcd34d" }, stats: { hp: 200, pa: 6, pm: 3, puissance: 10, critique: 5, initiative: 100 }, spriteConfig: { isFlatSpritesheet: true, assetType: 'LEGACY_NPC', malePath: "/textures/new_asset/Character and Portrait/Character/Pre-made/Lyria", femalePath: "/textures/new_asset/Character and Portrait/Character/Pre-made/Lyria" }, spells: [] },
    { id: "manu", name: "Manu", lore: "Forgeron renommé.", roleTitle: "PNJ", element: "fire", icon: "User", colors: { primary: "#ef4444", secondary: "#f59e0b", skin: "#fcd34d" }, stats: { hp: 300, pa: 6, pm: 3, puissance: 15, critique: 5, initiative: 80 }, spriteConfig: { isFlatSpritesheet: true, assetType: 'LEGACY_NPC', malePath: "/textures/new_asset/Character and Portrait/Character/Pre-made/Manu", femalePath: "/textures/new_asset/Character and Portrait/Character/Pre-made/Manu" }, spells: [] },
    { id: "tori", name: "Tori", lore: "Marchande itinérante.", roleTitle: "PNJ", element: "water", icon: "User", colors: { primary: "#3b82f6", secondary: "#10b981", skin: "#fcd34d" }, stats: { hp: 150, pa: 6, pm: 4, puissance: 5, critique: 10, initiative: 120 }, spriteConfig: { isFlatSpritesheet: true, assetType: 'LEGACY_NPC', malePath: "/textures/new_asset/Character and Portrait/Character/Pre-made/Tori", femalePath: "/textures/new_asset/Character and Portrait/Character/Pre-made/Tori" }, spells: [] }
];

// --- DYNAMIC MONSTERS ---
export const NARVOS_MONSTERS: ClassData[] = manifest.monsters.map(monsterFolder => ({
    id: monsterFolder.toLowerCase().replace(/ /g, '_'),
    name: formatName(monsterFolder),
    description: `Monstre redoutable : ${formatName(monsterFolder)}.`,
    roleTitle: "Monstre",
    element: "neutral",
    icon: "Skull",
    colors: { primary: "#000", secondary: "#fff", skin: "#444" },
    stats: { hp: 150, pa: 4, pm: 3, puissance: 15, critique: 2, initiative: 50 },
    spriteConfig: {
        malePath: `/textures/new_asset/asset_principal/monstre/${monsterFolder}`,
        femalePath: `/textures/new_asset/asset_principal/monstre/${monsterFolder}`,
        useHero8Dir: true,
        assetType: 'V4_MONSTER'
    },
    spells: []
}));

export const MONSTER_BANK = NARVOS_MONSTERS;
export const PROP_FOLDERS = manifest.props;
export const SPELL_FOLDERS = manifest.spells;
