/**
 * 🗺️ WORLD SYSTEM
 * Gère les zones, les sous-zones et la transition entre les cartes.
 */
import { DOFUS_SUBAREAS, DofusSubArea } from '../data/dofusWorld';

export class WorldSystem {
    private currentSubAreaId: number = 95; // Astrub par défaut

    constructor() { }

    public getSubAreaById(id: number): DofusSubArea | undefined {
        return DOFUS_SUBAREAS.find(s => s.id === id);
    }

    public getCurrentSubArea(): DofusSubArea {
        return this.getSubAreaById(this.currentSubAreaId) || DOFUS_SUBAREAS[0];
    }

    public setSubArea(id: number) {
        this.currentSubAreaId = id;
        console.log(`🌍 Entrée dans la zone : ${this.getCurrentSubArea().name}`);
    }

    /**
     * Calcule le niveau d'un monstre en fonction de la sous-zone
     */
    public getMonsterLevelForZone(): number {
        const area = this.getCurrentSubArea();
        return Math.floor(Math.random() * (area.levelMax - area.levelMin + 1)) + area.levelMin;
    }
}

export const worldSystem = new WorldSystem();
