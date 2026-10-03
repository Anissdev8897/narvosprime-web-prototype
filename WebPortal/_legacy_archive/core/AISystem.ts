import * as THREE from 'three';
import { MonsterEntity, PlayerEntity, AIState, PlanetConfig } from '../types';
import { aiService, AIBehaviorResponse } from '../services/aiService';

/**
 * Système d'IA (AI System)
 * Gère le comportement des monstres et leur intelligence artificielle
 */
export class AISystem {
    private aiStatusChecked = false;
    private scene: THREE.Scene;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    /**
     * Mettre à jour l'IA de tous les monstres
     */
    public async updateAI(
        monsters: MonsterEntity[],
        player: PlayerEntity,
        playerMesh: THREE.Object3D | null,
        activePlanetId: string | null
    ): Promise<void> {
        if (!playerMesh || monsters.length === 0) return;

        const playerPos = player.position;
        const playerHealth = player.stats.hp;

        // Vérifier le statut de l'IA (une seule fois au démarrage)
        if (!this.aiStatusChecked) {
            const { localAIService } = await import('../services/localAIService');
            const isLoaded = localAIService.isModelLoaded();
            if (isLoaded) {
                console.log('✅ IA locale détectée et chargée - Les monstres utiliseront l\'IA pour leurs comportements');
            } else {
                console.warn('⚠️ IA locale non chargée - Les monstres utiliseront le comportement de fallback');
                console.warn('💡 Pour activer l\'IA, vérifiez que le dossier /LysringV4 existe dans public/');
            }
            this.aiStatusChecked = true;
        }

        // Mettre à jour l'IA de chaque monstre
        for (const monster of monsters) {
            if (!monster.mesh || monster.stats.hp <= 0) continue;

            // Calculer la distance au joueur
            const dx = playerPos.x - monster.position.x;
            const dy = playerPos.y - monster.position.y;
            const dz = playerPos.z - monster.position.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // Mettre à jour l'IA toutes les 2 secondes (pour éviter trop d'appels API)
            const now = Date.now();
            if (now - monster.lastAIUpdate < 2000) {
                // Appliquer le comportement actuel
                this.applyMonsterBehavior(monster, distance, playerPos);
                continue;
            }

            // Appeler l'IA locale ou fallback
            try {
                const biome = activePlanetId || 'unknown';
                const aiResponse = await aiService.getMonsterBehavior(
                    monster.monsterDef.name,
                    monster.monsterDef.aggressiveness,
                    monster.currentState as any,
                    distance,
                    playerHealth,
                    monster.stats.hp,
                    biome,
                    `Player at distance ${distance.toFixed(1)}, monster health: ${monster.stats.hp}/${monster.stats.maxHp}`
                );

                // ✅ Log amélioré pour debug (seulement pour le premier monstre et toutes les 10 secondes)
                if (monster.id === monsters[0]?.id && now % 10000 < 100) {
                    const { localAIService } = await import('../services/localAIService');
                    const isAILoaded = localAIService.isModelLoaded();
                    console.log(`🤖 [AI STATUS] ${isAILoaded ? '✅ IA Chargée' : '⚠️ Fallback'} | Monstre: ${monster.monsterDef.name} | Type: ${monster.aiModelType} | Action: ${aiResponse.action} | Distance: ${distance.toFixed(1)}m | Reasoning: ${aiResponse.reasoning?.substring(0, 50) || 'N/A'}...`);
                }

                // Mettre à jour l'état du monstre
                monster.currentState = aiResponse.action as AIState;
                monster.lastAIUpdate = now;

                // Définir la position cible selon l'action
                if (aiResponse.direction) {
                    if (aiResponse.action === 'CHASE' || aiResponse.action === 'ATTACK') {
                        monster.targetPosition = { ...playerPos };
                    } else if (aiResponse.action === 'FLEE') {
                        // Fuir dans la direction opposée
                        monster.targetPosition = {
                            x: monster.position.x - dx * 2,
                            y: monster.position.y,
                            z: monster.position.z - dz * 2
                        };
                    } else if (aiResponse.action === 'PATROL') {
                        // Patrouille aléatoire
                        const angle = Math.random() * Math.PI * 2;
                        const patrolDist = 20;
                        monster.targetPosition = {
                            x: monster.position.x + Math.cos(angle) * patrolDist,
                            y: monster.position.y,
                            z: monster.position.z + Math.sin(angle) * patrolDist
                        };
                    } else if (aiResponse.action === 'AMBUSH') {
                        // Embuscade: se positionner près du joueur mais hors de vue
                        const ambushAngle = Math.atan2(dz, dx) + Math.PI / 2;
                        monster.targetPosition = {
                            x: playerPos.x + Math.cos(ambushAngle) * 10,
                            y: playerPos.y,
                            z: playerPos.z + Math.sin(ambushAngle) * 10
                        };
                    }
                }
            } catch (error) {
                console.warn('AI update failed for monster:', monster.id, error);
                // Fallback: comportement basique
                if (distance < 5) {
                    monster.currentState = AIState.ATTACK;
                    monster.targetPosition = { ...playerPos };
                } else if (distance < 20) {
                    monster.currentState = AIState.CHASE;
                    monster.targetPosition = { ...playerPos };
                } else {
                    monster.currentState = AIState.PATROL;
                }
            }

            // Appliquer le comportement
            this.applyMonsterBehavior(monster, distance, playerPos);
        }
    }

    /**
     * Appliquer le comportement d'un monstre
     */
    private applyMonsterBehavior(
        monster: MonsterEntity,
        distance: number,
        playerPos: { x: number; y: number; z: number }
    ): void {
        if (!monster.mesh) return;

        const speed = monster.monsterDef.speed;
        const detectionRadius = 15 + (monster.monsterDef.aggressiveness * 20);

        switch (monster.currentState) {
            case AIState.ATTACK:
                // Attaquer le joueur
                if (distance < 3) {
                    // Infliger des dégâts au joueur (sera géré par le système de combat)
                    // player.stats.hp -= 5;
                }
                // Continuer à poursuivre
                monster.targetPosition = { ...playerPos };
                break;

            case AIState.CHASE:
                // Poursuivre le joueur
                monster.targetPosition = { ...playerPos };
                break;

            case AIState.FLEE:
                // Fuir du joueur
                if (distance < 10) {
                    const fleeDir = {
                        x: monster.position.x - playerPos.x,
                        z: monster.position.z - playerPos.z
                    };
                    const fleeDist = Math.sqrt(fleeDir.x * fleeDir.x + fleeDir.z * fleeDir.z);
                    if (fleeDist > 0) {
                        monster.targetPosition = {
                            x: monster.position.x + (fleeDir.x / fleeDist) * 30,
                            y: monster.position.y,
                            z: monster.position.z + (fleeDir.z / fleeDist) * 30
                        };
                    }
                }
                break;

            case AIState.PATROL:
                // Patrouille: se déplacer vers la position cible ou en choisir une nouvelle
                if (!monster.targetPosition ||
                    Math.abs(monster.position.x - monster.targetPosition.x) < 2 &&
                    Math.abs(monster.position.z - monster.targetPosition.z) < 2) {
                    const angle = Math.random() * Math.PI * 2;
                    const patrolDist = 20;
                    monster.targetPosition = {
                        x: monster.position.x + Math.cos(angle) * patrolDist,
                        y: monster.position.y,
                        z: monster.position.z + Math.sin(angle) * patrolDist
                    };
                }
                break;

            case AIState.AMBUSH:
                // Embuscade: se déplacer vers la position d'embuscade
                if (distance > detectionRadius) {
                    monster.currentState = AIState.PATROL;
                }
                break;

            default:
                // IDLE: ne rien faire
                break;
        }

        // Déplacer le monstre vers sa position cible
        if (monster.targetPosition) {
            const moveDir = {
                x: monster.targetPosition.x - monster.position.x,
                y: monster.targetPosition.y - monster.position.y,
                z: monster.targetPosition.z - monster.position.z
            };
            const moveDist = Math.sqrt(moveDir.x * moveDir.x + moveDir.z * moveDir.z);

            if (moveDist > 0.5) {
                const moveSpeed = monster.currentState === AIState.FLEE ? speed * 1.5 : speed;
                monster.position.x += (moveDir.x / moveDist) * moveSpeed;
                monster.position.z += (moveDir.z / moveDist) * moveSpeed;
                monster.rotation = Math.atan2(moveDir.x, moveDir.z);

                if (monster.mesh) {
                    monster.mesh.position.set(monster.position.x, monster.position.y, monster.position.z);
                    monster.mesh.rotation.y = monster.rotation;
                }
            }
        }

        // Détection du joueur
        if (distance < detectionRadius && monster.currentState === AIState.PATROL) {
            monster.currentState = AIState.CHASE;
            monster.targetPosition = { ...playerPos };
        }
    }
}

