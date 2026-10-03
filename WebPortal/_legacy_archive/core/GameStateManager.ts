import * as THREE from 'three';
import { PlayerEntity, SceneMode, GlobalSettings } from '../types';
import { saveService } from '../services/saveService';
import { currencyService } from '../services/currencyService';

/**
 * Gestionnaire d'État du Jeu (Game State Manager)
 * Gère la sauvegarde et le chargement de l'état du jeu
 */
export class GameStateManager {
    /**
     * Sauvegarder l'état actuel du jeu
     */
    public async saveGame(
        player: PlayerEntity,
        sceneMode: SceneMode,
        activePlanetId: string | null,
        originPlanetId: string | null,
        cameraMode: string,
        settings: GlobalSettings,
        playTime: number
    ): Promise<void> {
        try {
            const currencies = currencyService.getPlayerCurrencies([]);
            const progression = {
                discoveredPlanets: [activePlanetId || 'hub'].filter(Boolean),
                completedQuests: [],
                defeatedBosses: [],
                unlockedCrafts: [],
                visitedZones: []
            };

            await saveService.saveData(
                player,
                {
                    sceneMode,
                    activePlanetId,
                    originPlanetId,
                    cameraMode
                },
                currencies,
                progression,
                settings,
                playTime
            );

            console.log('✅ Jeu sauvegardé avec succès');
        } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde:', error);
            throw error;
        }
    }
}
