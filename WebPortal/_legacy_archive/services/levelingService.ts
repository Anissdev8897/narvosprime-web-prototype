/**
 * 🎓 SYSTÈME DE PROGRESSION DOFUS
 * Gère l'XP et les niveaux basés sur la courbe réelle.
 */
import { DOFUS_EXPERIENCE } from '../data/dofusExperience';

export const LevelingService = {
    /**
     * Retourne l'XP nécessaire pour atteindre un niveau donné
     */
    getExperienceForLevel(level: number): number {
        const expData = DOFUS_EXPERIENCE.find(e => e.level === level);
        if (expData) return expData.player;

        // Interpolation simple si le niveau n'est pas dans notre échantillon
        const lower = [...DOFUS_EXPERIENCE].reverse().find(e => e.level <= level);
        const upper = DOFUS_EXPERIENCE.find(e => e.level > level);

        if (!upper && lower) return lower.player * (level / lower.level);
        if (upper && lower) {
            const ratio = (level - lower.level) / (upper.level - lower.level);
            return Math.floor(lower.player + (upper.player - lower.player) * ratio);
        }

        return level * level * 100; // Fallback mathématique
    },

    /**
     * Calcule le niveau correspondant à un montant d'XP
     */
    getLevelFromExperience(experience: number): number {
        let currentLevel = 1;
        for (let i = 0; i < DOFUS_EXPERIENCE.length; i++) {
            if (experience >= DOFUS_EXPERIENCE[i].player) {
                currentLevel = DOFUS_EXPERIENCE[i].level;
            } else {
                break;
            }
        }
        return currentLevel;
    },

    /**
     * Calcule le pourcentage de progression vers le prochain niveau
     */
    getProgressPercentage(experience: number): number {
        const currentLevel = this.getLevelFromExperience(experience);
        const currentLevelXP = this.getExperienceForLevel(currentLevel);
        const nextLevelXP = this.getExperienceForLevel(currentLevel + 1);

        if (nextLevelXP === currentLevelXP) return 100;

        const progress = ((experience - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
        return Math.min(100, Math.max(0, progress));
    }
};

export default LevelingService;
