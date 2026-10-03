import { DOFUS_SPELLS, DofusSpell } from '../data/dofusSpells';
import { DOFUS_ITEMS, DofusItem } from '../data/dofusItems';
import { DOFUS_MONSTERS, DofusMonster } from '../data/dofusMonsters';

/**
 * 🛠️ SERVICE DE DONNÉES DOFUS ADAPTÉES
 * Centralise l'accès aux sorts, items, classes et monstres extraits du dump SQL.
 */
export const DofusDataService = {
    // --- SORTS ---
    getAllSpells(): DofusSpell[] {
        return DOFUS_SPELLS;
    },

    getSpellById(id: number): DofusSpell | undefined {
        return DOFUS_SPELLS.find(s => s.id === id);
    },

    getSpellsByCategory(category: DofusSpell['category']): DofusSpell[] {
        return DOFUS_SPELLS.filter(s => s.category === category);
    },

    // --- ITEMS ---
    getAllItems(): DofusItem[] {
        return DOFUS_ITEMS;
    },

    getItemById(id: number): DofusItem | undefined {
        return DOFUS_ITEMS.find(i => i.id === id);
    },

    getItemsByType(type: string): DofusItem[] {
        return DOFUS_ITEMS.filter(i => i.type === type);
    },

    // --- MONSTRES ---
    getAllMonsters(): DofusMonster[] {
        return DOFUS_MONSTERS;
    },

    getMonsterById(id: number): DofusMonster | undefined {
        return DOFUS_MONSTERS.find(m => m.id === id);
    },

    getMonstersByLevel(minLevel: number, maxLevel: number): DofusMonster[] {
        return DOFUS_MONSTERS.filter(m => m.level >= minLevel && m.level <= maxLevel);
    }
};

export default DofusDataService;
