import { DofusBreed } from './dofusBreeds';
import { NARVOS_CLASSES } from '../narvos-data';

// Map textual IDs to numeric IDs for compatibility with the new system
const ID_MAP: Record<string, number> = {
    'bio_scout': 1001,
    'current_breaker': 1002,
    'aquarys_shadow': 1003,
    'desert_mirage': 1004,
    'dust_juggernaut': 1005,
    'flux_scavenger': 1006,
    'canopy_prophet': 1007,
    'mycelium_host': 1008,
    'parasite_sower': 1009,
    'venom_stalker': 1010
};

export const NARVOS_BREEDS: DofusBreed[] = NARVOS_CLASSES.map(cls => {
    // Map Narvos stats to Dofus stats
    const vit = Math.floor((cls.stats?.hp || 100) / 5);
    const role = cls.roles?.[0]?.iconType;

    return {
        id: ID_MAP[cls.id] || 9999,
        name: cls.name,
        shortName: cls.name.substring(0, 4).toUpperCase(),
        description: cls.description || "Aucune description",
        role: role === 'tank' ? 'Tank' :
            role === 'support' ? 'Support' :
                role === 'damage' ? 'DPS' : 'Hybrid',
        difficulty: (cls.difficulty || 1) as 1 | 2 | 3,
        baseStats: {
            vitality: vit,
            wisdom: 0,
            strength: 0,
            intelligence: 0,
            chance: 0,
            agility: 0,
            ap: cls.stats?.pa || 6,
            mp: cls.stats?.pm || 3
        },
        starterSpells: [], // We'd need to map spells too, but let's leave empty for now or map dummy IDs
        iconId: 1, // Placeholder
        colors: {
            primary: cls.colors.primary,
            secondary: cls.colors.secondary
        }
    } as DofusBreed;
});

// Helper to get original class ID back
export function getOriginalClassId(breedId: number): string | undefined {
    const entry = Object.entries(ID_MAP).find(([key, val]) => val === breedId);
    return entry ? entry[0] : undefined;
}
