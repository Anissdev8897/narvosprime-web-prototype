/**
 * =============================================================================
 * NARVOS PRIME - DONNÉES STATIQUES GÉNÉRÉES
 * =============================================================================
 * Ce fichier contient les items et marchands de base du jeu.
 * Généré le 2026-01-20
 */

import { Item, Merchant } from '../types';

export const STATIC_ITEMS: Item[] = [
    {
        "id": "cons_medkit",
        "name": "Nano Medkit",
        "description": "Un kit de soin avancé restaurer 200 PV.",
        "icon": "💉",
        "type": "consumable",
        "rarity": "uncommon",
        "level": 10,
        "basePrice": 150,
        "effect": { "type": "heal", "value": 200 },
        "spriteUrl": "/textures/objet/consomable/station_item_nano_medkit.png",
        "quantity": 1
    },
    {
        "id": "res_aqua_processor",
        "name": "Aqua Processor",
        "description": "Composant technologique pour filtrage d'eau.",
        "icon": "⚙️",
        "type": "resource",
        "rarity": "rare",
        "level": 15,
        "basePrice": 450,
        "spriteUrl": "/textures/objet/item/item_aqua_processor.png",
        "quantity": 1
    },
    {
        "id": "res_fossil_spore",
        "name": "Spore Fossile",
        "description": "Une spore ancienne hautement réactive.",
        "icon": "🍄",
        "type": "resource",
        "rarity": "epic",
        "level": 25,
        "basePrice": 1200,
        "spriteUrl": "/textures/objet/item/item_fossil_spore.png",
        "quantity": 1
    },
    {
        "id": "qst_quantum_keycard",
        "name": "Quantum Keycard",
        "description": "Accès de sécurité de haut niveau.",
        "icon": "💳",
        "type": "quest",
        "rarity": "legendary",
        "level": 1,
        "basePrice": 0,
        "spriteUrl": "/textures/objet/item/station_item_quantum_keycard.png",
        "quantity": 1
    },
    {
        "id": "res_1",
        "name": "Poussière Magique",
        "description": "Une ressource précieuse de rareté COMMON.",
        "icon": "📦",
        "type": "resource",
        "rarity": "common",
        "level": 1,
        "weight": 1,
        "basePrice": 10,
        "stackable": true,
        "quantity": 1
    },
    {
        "id": "res_2",
        "name": "Éclat d'Éther",
        "description": "Une ressource précieuse de rareté UNCOMMON.",
        "icon": "📦",
        "type": "resource",
        "rarity": "uncommon",
        "level": 2,
        "weight": 1,
        "basePrice": 50,
        "stackable": true,
        "quantity": 1
    },
    {
        "id": "res_3",
        "name": "Cristal Pur",
        "description": "Une ressource précieuse de rareté RARE.",
        "icon": "📦",
        "type": "resource",
        "rarity": "rare",
        "level": 3,
        "weight": 1,
        "basePrice": 200,
        "stackable": true,
        "quantity": 1
    },
    {
        "id": "res_4",
        "name": "Pierre d'Âme",
        "description": "Une ressource précieuse de rareté EPIC.",
        "icon": "📦",
        "type": "resource",
        "rarity": "epic",
        "level": 4,
        "weight": 1,
        "basePrice": 1000,
        "stackable": true,
        "quantity": 1
    },
    {
        "id": "res_5",
        "name": "Orbe Céleste",
        "description": "Une ressource précieuse de rareté LEGENDARY.",
        "icon": "📦",
        "type": "resource",
        "rarity": "legendary",
        "level": 5,
        "weight": 1,
        "basePrice": 5000,
        "stackable": true,
        "quantity": 1
    },
    {
        "id": "res_6",
        "name": "Fer Lunaire",
        "description": "Une ressource précieuse de rareté COMMON.",
        "icon": "📦",
        "type": "resource",
        "rarity": "common",
        "level": 1,
        "weight": 1,
        "basePrice": 15,
        "stackable": true,
        "quantity": 1
    },
    {
        "id": "res_7",
        "name": "Bois d'Épine",
        "description": "Une ressource précieuse de rareté COMMON.",
        "icon": "📦",
        "type": "resource",
        "rarity": "common",
        "level": 1,
        "weight": 1,
        "basePrice": 12,
        "stackable": true,
        "quantity": 1
    },
    {
        "id": "res_8",
        "name": "Fleur de Nébuleuse",
        "description": "Une ressource précieuse de rareté UNCOMMON.",
        "icon": "📦",
        "type": "resource",
        "rarity": "uncommon",
        "level": 5,
        "weight": 1,
        "basePrice": 45,
        "stackable": true,
        "quantity": 1
    },
    {
        "id": "res_9",
        "name": "Ecaille de Dragon d'Eau",
        "description": "Une ressource précieuse de rareté RARE.",
        "icon": "📦",
        "type": "resource",
        "rarity": "rare",
        "level": 15,
        "weight": 1,
        "basePrice": 250,
        "stackable": true,
        "quantity": 1
    },
    {
        "id": "cons_1",
        "name": "Potion de Rappel",
        "description": "Consommable : teleport (0).",
        "icon": "🧪",
        "type": "consumable",
        "rarity": "common",
        "level": 1,
        "basePrice": 20,
        "effect": {
            "type": "teleport",
            "value": 0
        },
        "stackable": true,
        "quantity": 1
    },
    {
        "id": "cons_2",
        "name": "Petite Potion de Vie",
        "description": "Consommable : heal (50).",
        "icon": "🧪",
        "type": "consumable",
        "rarity": "common",
        "level": 1,
        "basePrice": 10,
        "effect": {
            "type": "heal",
            "value": 50
        },
        "stackable": true,
        "quantity": 1
    },
    {
        "id": "cons_3",
        "name": "Potion de Vie Moyenne",
        "description": "Consommable : heal (200).",
        "icon": "🧪",
        "type": "consumable",
        "rarity": "uncommon",
        "level": 10,
        "basePrice": 50,
        "effect": {
            "type": "heal",
            "value": 200
        },
        "stackable": true,
        "quantity": 1
    },
    {
        "id": "cons_4",
        "name": "Grande Potion de Vie",
        "description": "Consommable : heal (500).",
        "icon": "🧪",
        "type": "consumable",
        "rarity": "rare",
        "level": 30,
        "basePrice": 150,
        "effect": {
            "type": "heal",
            "value": 500
        },
        "stackable": true,
        "quantity": 1
    },
    {
        "id": "cons_5",
        "name": "Élixir de Puissance",
        "description": "Consommable : buff_puissance (50).",
        "icon": "🧪",
        "type": "consumable",
        "rarity": "rare",
        "level": 20,
        "basePrice": 300,
        "effect": {
            "type": "buff_puissance",
            "value": 50
        },
        "stackable": true,
        "quantity": 1
    },
    {
        "id": "eq_helmet_1_common",
        "name": "Helmet Commun (Niv.1)",
        "description": "Un équipement de type helmet pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 1,
        "basePrice": 100,
        "statsBonus": {
            "hp": 1,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_helmet_1_rare",
        "name": "Helmet Rare (Niv.1)",
        "description": "Un équipement de type helmet pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 1,
        "basePrice": 200,
        "statsBonus": {
            "hp": 2,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_helmet_1_epic",
        "name": "Helmet Épique (Niv.1)",
        "description": "Un équipement de type helmet pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 1,
        "basePrice": 300,
        "statsBonus": {
            "hp": 3,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_amulet_1_common",
        "name": "Amulet Commun (Niv.1)",
        "description": "Un équipement de type amulet pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 1,
        "basePrice": 100,
        "statsBonus": {
            "puissance": 1,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_amulet_1_rare",
        "name": "Amulet Rare (Niv.1)",
        "description": "Un équipement de type amulet pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 1,
        "basePrice": 200,
        "statsBonus": {
            "puissance": 2,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_amulet_1_epic",
        "name": "Amulet Épique (Niv.1)",
        "description": "Un équipement de type amulet pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 1,
        "basePrice": 300,
        "statsBonus": {
            "puissance": 3,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_weapon_1_common",
        "name": "Weapon Commun (Niv.1)",
        "description": "Un équipement de type weapon pour aventurier de niveau 1.",
        "icon": "⚔️",
        "type": "weapon",
        "rarity": "common",
        "level": 1,
        "basePrice": 100,
        "statsBonus": {
            "puissance": 1,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_weapon_1_rare",
        "name": "Weapon Rare (Niv.1)",
        "description": "Un équipement de type weapon pour aventurier de niveau 1.",
        "icon": "⚔️",
        "type": "weapon",
        "rarity": "rare",
        "level": 1,
        "basePrice": 200,
        "statsBonus": {
            "puissance": 2,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_weapon_1_epic",
        "name": "Weapon Épique (Niv.1)",
        "description": "Un équipement de type weapon pour aventurier de niveau 1.",
        "icon": "⚔️",
        "type": "weapon",
        "rarity": "epic",
        "level": 1,
        "basePrice": 300,
        "statsBonus": {
            "puissance": 3,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_armor_1_common",
        "name": "Armor Commun (Niv.1)",
        "description": "Un équipement de type armor pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "armor",
        "rarity": "common",
        "level": 1,
        "basePrice": 100,
        "statsBonus": {
            "hp": 1,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_armor_1_rare",
        "name": "Armor Rare (Niv.1)",
        "description": "Un équipement de type armor pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "armor",
        "rarity": "rare",
        "level": 1,
        "basePrice": 200,
        "statsBonus": {
            "hp": 2,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_armor_1_epic",
        "name": "Armor Épique (Niv.1)",
        "description": "Un équipement de type armor pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "armor",
        "rarity": "epic",
        "level": 1,
        "basePrice": 300,
        "statsBonus": {
            "hp": 3,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_shield_1_common",
        "name": "Shield Commun (Niv.1)",
        "description": "Un équipement de type shield pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 1,
        "basePrice": 100,
        "statsBonus": {
            "puissance": 1,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_shield_1_rare",
        "name": "Shield Rare (Niv.1)",
        "description": "Un équipement de type shield pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 1,
        "basePrice": 200,
        "statsBonus": {
            "puissance": 2,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_shield_1_epic",
        "name": "Shield Épique (Niv.1)",
        "description": "Un équipement de type shield pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 1,
        "basePrice": 300,
        "statsBonus": {
            "puissance": 3,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_belt_1_common",
        "name": "Belt Commun (Niv.1)",
        "description": "Un équipement de type belt pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 1,
        "basePrice": 100,
        "statsBonus": {
            "puissance": 1,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_belt_1_rare",
        "name": "Belt Rare (Niv.1)",
        "description": "Un équipement de type belt pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 1,
        "basePrice": 200,
        "statsBonus": {
            "puissance": 2,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_belt_1_epic",
        "name": "Belt Épique (Niv.1)",
        "description": "Un équipement de type belt pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 1,
        "basePrice": 300,
        "statsBonus": {
            "puissance": 3,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_boots_1_common",
        "name": "Boots Commun (Niv.1)",
        "description": "Un équipement de type boots pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 1,
        "basePrice": 100,
        "statsBonus": {
            "puissance": 1,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_boots_1_rare",
        "name": "Boots Rare (Niv.1)",
        "description": "Un équipement de type boots pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 1,
        "basePrice": 200,
        "statsBonus": {
            "puissance": 2,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_boots_1_epic",
        "name": "Boots Épique (Niv.1)",
        "description": "Un équipement de type boots pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 1,
        "basePrice": 300,
        "statsBonus": {
            "puissance": 3,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_cloak_1_common",
        "name": "Cloak Commun (Niv.1)",
        "description": "Un équipement de type cloak pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 1,
        "basePrice": 100,
        "statsBonus": {
            "puissance": 1,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_cloak_1_rare",
        "name": "Cloak Rare (Niv.1)",
        "description": "Un équipement de type cloak pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 1,
        "basePrice": 200,
        "statsBonus": {
            "puissance": 2,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_cloak_1_epic",
        "name": "Cloak Épique (Niv.1)",
        "description": "Un équipement de type cloak pour aventurier de niveau 1.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 1,
        "basePrice": 300,
        "statsBonus": {
            "puissance": 3,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_helmet_10_common",
        "name": "Helmet Commun (Niv.10)",
        "description": "Un équipement de type helmet pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 10,
        "basePrice": 1000,
        "statsBonus": {
            "hp": 10,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_helmet_10_rare",
        "name": "Helmet Rare (Niv.10)",
        "description": "Un équipement de type helmet pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 10,
        "basePrice": 2000,
        "statsBonus": {
            "hp": 20,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_helmet_10_epic",
        "name": "Helmet Épique (Niv.10)",
        "description": "Un équipement de type helmet pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 10,
        "basePrice": 3000,
        "statsBonus": {
            "hp": 30,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_amulet_10_common",
        "name": "Amulet Commun (Niv.10)",
        "description": "Un équipement de type amulet pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 10,
        "basePrice": 1000,
        "statsBonus": {
            "puissance": 10,
            "pa": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_amulet_10_rare",
        "name": "Amulet Rare (Niv.10)",
        "description": "Un équipement de type amulet pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 10,
        "basePrice": 2000,
        "statsBonus": {
            "puissance": 20,
            "pa": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_amulet_10_epic",
        "name": "Amulet Épique (Niv.10)",
        "description": "Un équipement de type amulet pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 10,
        "basePrice": 3000,
        "statsBonus": {
            "puissance": 30,
            "pa": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_weapon_10_common",
        "name": "Weapon Commun (Niv.10)",
        "description": "Un équipement de type weapon pour aventurier de niveau 10.",
        "icon": "⚔️",
        "type": "weapon",
        "rarity": "common",
        "level": 10,
        "basePrice": 1000,
        "statsBonus": {
            "puissance": 10,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_weapon_10_rare",
        "name": "Weapon Rare (Niv.10)",
        "description": "Un équipement de type weapon pour aventurier de niveau 10.",
        "icon": "⚔️",
        "type": "weapon",
        "rarity": "rare",
        "level": 10,
        "basePrice": 2000,
        "statsBonus": {
            "puissance": 20,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_weapon_10_epic",
        "name": "Weapon Épique (Niv.10)",
        "description": "Un équipement de type weapon pour aventurier de niveau 10.",
        "icon": "⚔️",
        "type": "weapon",
        "rarity": "epic",
        "level": 10,
        "basePrice": 3000,
        "statsBonus": {
            "puissance": 30,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_armor_10_common",
        "name": "Armor Commun (Niv.10)",
        "description": "Un équipement de type armor pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "armor",
        "rarity": "common",
        "level": 10,
        "basePrice": 1000,
        "statsBonus": {
            "hp": 10,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_armor_10_rare",
        "name": "Armor Rare (Niv.10)",
        "description": "Un équipement de type armor pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "armor",
        "rarity": "rare",
        "level": 10,
        "basePrice": 2000,
        "statsBonus": {
            "hp": 20,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_armor_10_epic",
        "name": "Armor Épique (Niv.10)",
        "description": "Un équipement de type armor pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "armor",
        "rarity": "epic",
        "level": 10,
        "basePrice": 3000,
        "statsBonus": {
            "hp": 30,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_shield_10_common",
        "name": "Shield Commun (Niv.10)",
        "description": "Un équipement de type shield pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 10,
        "basePrice": 1000,
        "statsBonus": {
            "puissance": 10,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_shield_10_rare",
        "name": "Shield Rare (Niv.10)",
        "description": "Un équipement de type shield pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 10,
        "basePrice": 2000,
        "statsBonus": {
            "puissance": 20,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_shield_10_epic",
        "name": "Shield Épique (Niv.10)",
        "description": "Un équipement de type shield pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 10,
        "basePrice": 3000,
        "statsBonus": {
            "puissance": 30,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_belt_10_common",
        "name": "Belt Commun (Niv.10)",
        "description": "Un équipement de type belt pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 10,
        "basePrice": 1000,
        "statsBonus": {
            "puissance": 10,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_belt_10_rare",
        "name": "Belt Rare (Niv.10)",
        "description": "Un équipement de type belt pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 10,
        "basePrice": 2000,
        "statsBonus": {
            "puissance": 20,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_belt_10_epic",
        "name": "Belt Épique (Niv.10)",
        "description": "Un équipement de type belt pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 10,
        "basePrice": 3000,
        "statsBonus": {
            "puissance": 30,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_boots_10_common",
        "name": "Boots Commun (Niv.10)",
        "description": "Un équipement de type boots pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 10,
        "basePrice": 1000,
        "statsBonus": {
            "puissance": 10,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_boots_10_rare",
        "name": "Boots Rare (Niv.10)",
        "description": "Un équipement de type boots pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 10,
        "basePrice": 2000,
        "statsBonus": {
            "puissance": 20,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_boots_10_epic",
        "name": "Boots Épique (Niv.10)",
        "description": "Un équipement de type boots pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 10,
        "basePrice": 3000,
        "statsBonus": {
            "puissance": 30,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_cloak_10_common",
        "name": "Cloak Commun (Niv.10)",
        "description": "Un équipement de type cloak pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 10,
        "basePrice": 1000,
        "statsBonus": {
            "puissance": 10,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_cloak_10_rare",
        "name": "Cloak Rare (Niv.10)",
        "description": "Un équipement de type cloak pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 10,
        "basePrice": 2000,
        "statsBonus": {
            "puissance": 20,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_cloak_10_epic",
        "name": "Cloak Épique (Niv.10)",
        "description": "Un équipement de type cloak pour aventurier de niveau 10.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 10,
        "basePrice": 3000,
        "statsBonus": {
            "puissance": 30,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_helmet_20_common",
        "name": "Helmet Commun (Niv.20)",
        "description": "Un équipement de type helmet pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 20,
        "basePrice": 2000,
        "statsBonus": {
            "hp": 20,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_helmet_20_rare",
        "name": "Helmet Rare (Niv.20)",
        "description": "Un équipement de type helmet pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 20,
        "basePrice": 4000,
        "statsBonus": {
            "hp": 40,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_helmet_20_epic",
        "name": "Helmet Épique (Niv.20)",
        "description": "Un équipement de type helmet pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 20,
        "basePrice": 6000,
        "statsBonus": {
            "hp": 60,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_amulet_20_common",
        "name": "Amulet Commun (Niv.20)",
        "description": "Un équipement de type amulet pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 20,
        "basePrice": 2000,
        "statsBonus": {
            "puissance": 20,
            "pa": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_amulet_20_rare",
        "name": "Amulet Rare (Niv.20)",
        "description": "Un équipement de type amulet pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 20,
        "basePrice": 4000,
        "statsBonus": {
            "puissance": 40,
            "pa": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_amulet_20_epic",
        "name": "Amulet Épique (Niv.20)",
        "description": "Un équipement de type amulet pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 20,
        "basePrice": 6000,
        "statsBonus": {
            "puissance": 60,
            "pa": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_weapon_20_common",
        "name": "Weapon Commun (Niv.20)",
        "description": "Un équipement de type weapon pour aventurier de niveau 20.",
        "icon": "⚔️",
        "type": "weapon",
        "rarity": "common",
        "level": 20,
        "basePrice": 2000,
        "statsBonus": {
            "puissance": 20,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_weapon_20_rare",
        "name": "Weapon Rare (Niv.20)",
        "description": "Un équipement de type weapon pour aventurier de niveau 20.",
        "icon": "⚔️",
        "type": "weapon",
        "rarity": "rare",
        "level": 20,
        "basePrice": 4000,
        "statsBonus": {
            "puissance": 40,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_weapon_20_epic",
        "name": "Weapon Épique (Niv.20)",
        "description": "Un équipement de type weapon pour aventurier de niveau 20.",
        "icon": "⚔️",
        "type": "weapon",
        "rarity": "epic",
        "level": 20,
        "basePrice": 6000,
        "statsBonus": {
            "puissance": 60,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_armor_20_common",
        "name": "Armor Commun (Niv.20)",
        "description": "Un équipement de type armor pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "armor",
        "rarity": "common",
        "level": 20,
        "basePrice": 2000,
        "statsBonus": {
            "hp": 20,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_armor_20_rare",
        "name": "Armor Rare (Niv.20)",
        "description": "Un équipement de type armor pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "armor",
        "rarity": "rare",
        "level": 20,
        "basePrice": 4000,
        "statsBonus": {
            "hp": 40,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_armor_20_epic",
        "name": "Armor Épique (Niv.20)",
        "description": "Un équipement de type armor pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "armor",
        "rarity": "epic",
        "level": 20,
        "basePrice": 6000,
        "statsBonus": {
            "hp": 60,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_shield_20_common",
        "name": "Shield Commun (Niv.20)",
        "description": "Un équipement de type shield pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 20,
        "basePrice": 2000,
        "statsBonus": {
            "puissance": 20,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_shield_20_rare",
        "name": "Shield Rare (Niv.20)",
        "description": "Un équipement de type shield pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 20,
        "basePrice": 4000,
        "statsBonus": {
            "puissance": 40,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_shield_20_epic",
        "name": "Shield Épique (Niv.20)",
        "description": "Un équipement de type shield pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 20,
        "basePrice": 6000,
        "statsBonus": {
            "puissance": 60,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_belt_20_common",
        "name": "Belt Commun (Niv.20)",
        "description": "Un équipement de type belt pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 20,
        "basePrice": 2000,
        "statsBonus": {
            "puissance": 20,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_belt_20_rare",
        "name": "Belt Rare (Niv.20)",
        "description": "Un équipement de type belt pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 20,
        "basePrice": 4000,
        "statsBonus": {
            "puissance": 40,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_belt_20_epic",
        "name": "Belt Épique (Niv.20)",
        "description": "Un équipement de type belt pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 20,
        "basePrice": 6000,
        "statsBonus": {
            "puissance": 60,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_boots_20_common",
        "name": "Boots Commun (Niv.20)",
        "description": "Un équipement de type boots pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 20,
        "basePrice": 2000,
        "statsBonus": {
            "puissance": 20,
            "pm": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_boots_20_rare",
        "name": "Boots Rare (Niv.20)",
        "description": "Un équipement de type boots pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 20,
        "basePrice": 4000,
        "statsBonus": {
            "puissance": 40,
            "pm": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_boots_20_epic",
        "name": "Boots Épique (Niv.20)",
        "description": "Un équipement de type boots pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 20,
        "basePrice": 6000,
        "statsBonus": {
            "puissance": 60,
            "pm": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_cloak_20_common",
        "name": "Cloak Commun (Niv.20)",
        "description": "Un équipement de type cloak pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 20,
        "basePrice": 2000,
        "statsBonus": {
            "puissance": 20,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_cloak_20_rare",
        "name": "Cloak Rare (Niv.20)",
        "description": "Un équipement de type cloak pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 20,
        "basePrice": 4000,
        "statsBonus": {
            "puissance": 40,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_cloak_20_epic",
        "name": "Cloak Épique (Niv.20)",
        "description": "Un équipement de type cloak pour aventurier de niveau 20.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 20,
        "basePrice": 6000,
        "statsBonus": {
            "puissance": 60,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_helmet_50_common",
        "name": "Helmet Commun (Niv.50)",
        "description": "Un équipement de type helmet pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 50,
        "basePrice": 5000,
        "statsBonus": {
            "hp": 50,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_helmet_50_rare",
        "name": "Helmet Rare (Niv.50)",
        "description": "Un équipement de type helmet pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 50,
        "basePrice": 10000,
        "statsBonus": {
            "hp": 100,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_helmet_50_epic",
        "name": "Helmet Épique (Niv.50)",
        "description": "Un équipement de type helmet pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 50,
        "basePrice": 15000,
        "statsBonus": {
            "hp": 150,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_amulet_50_common",
        "name": "Amulet Commun (Niv.50)",
        "description": "Un équipement de type amulet pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 50,
        "basePrice": 5000,
        "statsBonus": {
            "puissance": 50,
            "pa": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_amulet_50_rare",
        "name": "Amulet Rare (Niv.50)",
        "description": "Un équipement de type amulet pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 50,
        "basePrice": 10000,
        "statsBonus": {
            "puissance": 100,
            "pa": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_amulet_50_epic",
        "name": "Amulet Épique (Niv.50)",
        "description": "Un équipement de type amulet pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 50,
        "basePrice": 15000,
        "statsBonus": {
            "puissance": 150,
            "pa": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_weapon_50_common",
        "name": "Weapon Commun (Niv.50)",
        "description": "Un équipement de type weapon pour aventurier de niveau 50.",
        "icon": "⚔️",
        "type": "weapon",
        "rarity": "common",
        "level": 50,
        "basePrice": 5000,
        "statsBonus": {
            "puissance": 50,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_weapon_50_rare",
        "name": "Weapon Rare (Niv.50)",
        "description": "Un équipement de type weapon pour aventurier de niveau 50.",
        "icon": "⚔️",
        "type": "weapon",
        "rarity": "rare",
        "level": 50,
        "basePrice": 10000,
        "statsBonus": {
            "puissance": 100,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_weapon_50_epic",
        "name": "Weapon Épique (Niv.50)",
        "description": "Un équipement de type weapon pour aventurier de niveau 50.",
        "icon": "⚔️",
        "type": "weapon",
        "rarity": "epic",
        "level": 50,
        "basePrice": 15000,
        "statsBonus": {
            "puissance": 150,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_armor_50_common",
        "name": "Armor Commun (Niv.50)",
        "description": "Un équipement de type armor pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "armor",
        "rarity": "common",
        "level": 50,
        "basePrice": 5000,
        "statsBonus": {
            "hp": 50,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_armor_50_rare",
        "name": "Armor Rare (Niv.50)",
        "description": "Un équipement de type armor pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "armor",
        "rarity": "rare",
        "level": 50,
        "basePrice": 10000,
        "statsBonus": {
            "hp": 100,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_armor_50_epic",
        "name": "Armor Épique (Niv.50)",
        "description": "Un équipement de type armor pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "armor",
        "rarity": "epic",
        "level": 50,
        "basePrice": 15000,
        "statsBonus": {
            "hp": 150,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_shield_50_common",
        "name": "Shield Commun (Niv.50)",
        "description": "Un équipement de type shield pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 50,
        "basePrice": 5000,
        "statsBonus": {
            "puissance": 50,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_shield_50_rare",
        "name": "Shield Rare (Niv.50)",
        "description": "Un équipement de type shield pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 50,
        "basePrice": 10000,
        "statsBonus": {
            "puissance": 100,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_shield_50_epic",
        "name": "Shield Épique (Niv.50)",
        "description": "Un équipement de type shield pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 50,
        "basePrice": 15000,
        "statsBonus": {
            "puissance": 150,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_belt_50_common",
        "name": "Belt Commun (Niv.50)",
        "description": "Un équipement de type belt pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 50,
        "basePrice": 5000,
        "statsBonus": {
            "puissance": 50,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_belt_50_rare",
        "name": "Belt Rare (Niv.50)",
        "description": "Un équipement de type belt pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 50,
        "basePrice": 10000,
        "statsBonus": {
            "puissance": 100,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_belt_50_epic",
        "name": "Belt Épique (Niv.50)",
        "description": "Un équipement de type belt pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 50,
        "basePrice": 15000,
        "statsBonus": {
            "puissance": 150,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_boots_50_common",
        "name": "Boots Commun (Niv.50)",
        "description": "Un équipement de type boots pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 50,
        "basePrice": 5000,
        "statsBonus": {
            "puissance": 50,
            "pm": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_boots_50_rare",
        "name": "Boots Rare (Niv.50)",
        "description": "Un équipement de type boots pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 50,
        "basePrice": 10000,
        "statsBonus": {
            "puissance": 100,
            "pm": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_boots_50_epic",
        "name": "Boots Épique (Niv.50)",
        "description": "Un équipement de type boots pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 50,
        "basePrice": 15000,
        "statsBonus": {
            "puissance": 150,
            "pm": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_cloak_50_common",
        "name": "Cloak Commun (Niv.50)",
        "description": "Un équipement de type cloak pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "common",
        "level": 50,
        "basePrice": 5000,
        "statsBonus": {
            "puissance": 50,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_cloak_50_rare",
        "name": "Cloak Rare (Niv.50)",
        "description": "Un équipement de type cloak pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "rare",
        "level": 50,
        "basePrice": 10000,
        "statsBonus": {
            "puissance": 100,
            "critique": 1
        },
        "quantity": 1
    },
    {
        "id": "eq_cloak_50_epic",
        "name": "Cloak Épique (Niv.50)",
        "description": "Un équipement de type cloak pour aventurier de niveau 50.",
        "icon": "🛡️",
        "type": "accessory",
        "rarity": "epic",
        "level": 50,
        "basePrice": 15000,
        "statsBonus": {
            "puissance": 150,
            "critique": 1
        },
        "quantity": 1
    }
];

export const STATIC_MERCHANTS: Merchant[] = [
    {
        "id": "npc_general_astrub",
        "name": "Vendeur de Bric-à-Brac",
        "subtitle": "Marchand Général",
        "type": "general",
        "spriteUrl": "/textures/npcs/merchant_general.png",
        "buyFactor": 0.5,
        "sellMultiplier": 1.2,
        "inventory": [
            {
                "id": "res_1",
                "name": "Poussière Magique",
                "description": "Une ressource précieuse de rareté COMMON.",
                "icon": "📦",
                "type": "resource",
                "rarity": "common",
                "level": 1,
                "weight": 1,
                "basePrice": 10,
                "stackable": true,
                "quantity": 1
            },
            {
                "id": "res_2",
                "name": "Éclat d'Éther",
                "description": "Une ressource précieuse de rareté UNCOMMON.",
                "icon": "📦",
                "type": "resource",
                "rarity": "uncommon",
                "level": 2,
                "weight": 1,
                "basePrice": 50,
                "stackable": true,
                "quantity": 1
            },
            {
                "id": "res_6",
                "name": "Fer Lunaire",
                "description": "Une ressource précieuse de rareté COMMON.",
                "icon": "📦",
                "type": "resource",
                "rarity": "common",
                "level": 1,
                "weight": 1,
                "basePrice": 15,
                "stackable": true,
                "quantity": 1
            },
            {
                "id": "cons_1",
                "name": "Potion de Rappel",
                "description": "Consommable : teleport (0).",
                "icon": "🧪",
                "type": "consumable",
                "rarity": "common",
                "level": 1,
                "basePrice": 20,
                "effect": {
                    "type": "teleport",
                    "value": 0
                },
                "stackable": true,
                "quantity": 1
            },
            {
                "id": "cons_2",
                "name": "Petite Potion de Vie",
                "description": "Consommable : heal (50).",
                "icon": "🧪",
                "type": "consumable",
                "rarity": "common",
                "level": 1,
                "basePrice": 10,
                "effect": {
                    "type": "heal",
                    "value": 50
                },
                "stackable": true,
                "quantity": 1
            }
        ]
    },
    {
        "id": "npc_alchemist_incarnam",
        "name": "Alchimiste de l'Envol",
        "subtitle": "Apothicaire",
        "type": "consumable",
        "spriteUrl": "/textures/npcs/merchant_alchemist.png",
        "buyFactor": 0.4,
        "sellMultiplier": 1.5,
        "inventory": [
            {
                "id": "cons_1",
                "name": "Potion de Rappel",
                "description": "Consommable : teleport (0).",
                "icon": "🧪",
                "type": "consumable",
                "rarity": "common",
                "level": 1,
                "basePrice": 20,
                "effect": {
                    "type": "teleport",
                    "value": 0
                },
                "stackable": true,
                "quantity": 1
            },
            {
                "id": "cons_2",
                "name": "Petite Potion de Vie",
                "description": "Consommable : heal (50).",
                "icon": "🧪",
                "type": "consumable",
                "rarity": "common",
                "level": 1,
                "basePrice": 10,
                "effect": {
                    "type": "heal",
                    "value": 50
                },
                "stackable": true,
                "quantity": 1
            },
            {
                "id": "cons_3",
                "name": "Potion de Vie Moyenne",
                "description": "Consommable : heal (200).",
                "icon": "🧪",
                "type": "consumable",
                "rarity": "uncommon",
                "level": 10,
                "basePrice": 50,
                "effect": {
                    "type": "heal",
                    "value": 200
                },
                "stackable": true,
                "quantity": 1
            },
            {
                "id": "cons_4",
                "name": "Grande Potion de Vie",
                "description": "Consommable : heal (500).",
                "icon": "🧪",
                "type": "consumable",
                "rarity": "rare",
                "level": 30,
                "basePrice": 150,
                "effect": {
                    "type": "heal",
                    "value": 500
                },
                "stackable": true,
                "quantity": 1
            },
            {
                "id": "cons_5",
                "name": "Élixir de Puissance",
                "description": "Consommable : buff_puissance (50).",
                "icon": "🧪",
                "type": "consumable",
                "rarity": "rare",
                "level": 20,
                "basePrice": 300,
                "effect": {
                    "type": "buff_puissance",
                    "value": 50
                },
                "stackable": true,
                "quantity": 1
            }
        ]
    },
    {
        "id": "npc_blacksmith",
        "name": "Forgeron de la Station",
        "subtitle": "Maître d'Armes",
        "type": "general",
        "spriteUrl": "/textures/npcs/merchant_blacksmith.png",
        "buyFactor": 0.6,
        "sellMultiplier": 2.0,
        "inventory": [
            {
                "id": "eq_weapon_1_common",
                "name": "Weapon Commun (Niv.1)",
                "description": "Un équipement de type weapon pour aventurier de niveau 1.",
                "icon": "⚔️",
                "type": "weapon",
                "rarity": "common",
                "level": 1,
                "basePrice": 100,
                "statsBonus": {
                    "puissance": 1,
                    "critique": 1
                },
                "quantity": 1
            },
            {
                "id": "eq_shield_1_common",
                "name": "Shield Commun (Niv.1)",
                "description": "Un équipement de type shield pour aventurier de niveau 1.",
                "icon": "🛡️",
                "type": "accessory",
                "rarity": "common",
                "level": 1,
                "basePrice": 100,
                "statsBonus": {
                    "puissance": 1,
                    "critique": 1
                },
                "quantity": 1
            },
            {
                "id": "eq_weapon_10_common",
                "name": "Weapon Commun (Niv.10)",
                "description": "Un équipement de type weapon pour aventurier de niveau 10.",
                "icon": "⚔️",
                "type": "weapon",
                "rarity": "common",
                "level": 10,
                "basePrice": 1000,
                "statsBonus": {
                    "puissance": 10,
                    "critique": 1
                },
                "quantity": 1
            }
        ]
    }
];

export const getStaticItemById = (id: string) => STATIC_ITEMS.find(i => i.id === id);
export const getStaticMerchantById = (id: string) => STATIC_MERCHANTS.find(m => m.id === id);
