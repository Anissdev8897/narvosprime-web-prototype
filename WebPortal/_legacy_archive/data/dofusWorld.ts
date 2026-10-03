/**
 * 🗺️ MONDE DE DOFUS POUR NARVOS PRIME
 * Structuration des zones (SubAreas) extraites du SQL Stump.
 */

export interface DofusSubArea {
    id: number;
    name: string;
    levelMin: number;
    levelMax: number;
    parentAreaId: number;
    maps: number[]; // Liste des IDs de maps rattachées
}

export const DOFUS_SUBAREAS: DofusSubArea[] = [
    { id: 95, name: "Cité d'Astrub", levelMin: 1, levelMax: 20, parentAreaId: 5, maps: [1, 2, 3] },
    { id: 96, name: "Prisons d'Astrub", levelMin: 5, levelMax: 15, parentAreaId: 5, maps: [4, 5, 6] },
    { id: 1, name: "Champs d'Astrub", levelMin: 10, levelMax: 30, parentAreaId: 5, maps: [7, 8, 9] },
    { id: 2, name: "Forêt d'Astrub", levelMin: 15, levelMax: 40, parentAreaId: 5, maps: [10, 11, 12] },
    { id: 18, name: "Incarnam", levelMin: 1, levelMax: 10, parentAreaId: 30, maps: [20, 21, 22] },
    { id: 25, name: "Île d'Otomaï", levelMin: 60, levelMax: 200, parentAreaId: 11, maps: [30, 31, 32] }
];

export default DOFUS_SUBAREAS;
