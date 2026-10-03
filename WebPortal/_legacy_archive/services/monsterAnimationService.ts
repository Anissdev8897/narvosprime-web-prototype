import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { MonsterEntity } from '../types';

class MonsterAnimationService {
    private static instance: MonsterAnimationService;

    private constructor() { }

    public static getInstance(): MonsterAnimationService {
        if (!MonsterAnimationService.instance) {
            MonsterAnimationService.instance = new MonsterAnimationService();
        }
        return MonsterAnimationService.instance;
    }

    /**
     * Jouer l'animation d'attaque d'un monstre
     */
    public playAttackAnimation(monster: MonsterEntity, mixer: THREE.AnimationMixer): void {
        if (!monster.mesh) return;

        const attackAnimationPath = monster.mesh.userData.attackAnimationPath;
        if (attackAnimationPath) {
            const loader = new FBXLoader();
            loader.load(attackAnimationPath, (fbx) => {
                if (fbx.animations && fbx.animations.length > 0) {
                    // Arrêter l'animation actuelle
                    mixer.stopAllAction();

                    // Jouer l'animation d'attaque
                    const attackAction = mixer.clipAction(fbx.animations[0]);
                    attackAction.setLoop(THREE.LoopOnce, 1);
                    attackAction.clampWhenFinished = true;
                    attackAction.play();

                    // Revenir à l'animation précédente après l'attaque
                    const onAttackFinished = (e: any) => {
                        if (e.action === attackAction) {
                            mixer.removeEventListener('finished', onAttackFinished);
                            // Note: Idéalement il faudrait rejouer l'animation de marche/idle stockée
                            // Pour l'instant, mirroring du comportement existant
                            if (fbx.animations[0]) {
                                // Comportement original potentiellement buggé mais conservé lors du refactoring
                                const nextAction = mixer.clipAction(fbx.animations[0]);
                                nextAction.play();
                            }
                        }
                    };
                    mixer.addEventListener('finished', onAttackFinished);
                }
            });
        }
    }

    /**
     * Jouer l'animation de dégâts (Hit) d'un monstre
     */
    public playHitAnimation(monster: MonsterEntity, mixer: THREE.AnimationMixer): void {
        if (!monster.mesh) return;

        const basePath = monster.mesh.userData.modelPath || '/characer_mob';
        // Essayer de déduire le chemin si non présent
        // Note: Le chemin exact dépend de la structure des dossiers
        const hitAnimationPath = monster.mesh.userData.hitAnimationPath || `${basePath}/Animation_BeHit_FlyUp_withSkin.fbx`;

        const loader = new FBXLoader();
        loader.load(hitAnimationPath, (fbx) => {
            if (fbx.animations && fbx.animations.length > 0) {
                const hitAction = mixer.clipAction(fbx.animations[0]);
                hitAction.setLoop(THREE.LoopOnce, 1);
                hitAction.clampWhenFinished = true;
                hitAction.play();

                // Revenir à l'animation normale après
                const onHitFinished = (e: any) => {
                    if (e.action === hitAction) {
                        mixer.removeEventListener('finished', onHitFinished);
                        // Comportement original conservé
                        if (fbx.animations[0]) {
                            const nextAction = mixer.clipAction(fbx.animations[0]);
                            nextAction.play();
                        }
                    }
                };
                mixer.addEventListener('finished', onHitFinished);
            }
        }, undefined, () => {
            // Fallback: secouer le monstre si pas d'animation
            if (monster.mesh) {
                const originalPosition = monster.mesh.position.clone();
                monster.mesh.position.x += 0.1;
                setTimeout(() => {
                    if (monster.mesh) {
                        monster.mesh.position.copy(originalPosition);
                    }
                }, 100);
            }
        });
    }

    /**
     * Jouer l'animation de mort d'un monstre
     */
    public playDeathAnimation(monster: MonsterEntity, mixer: THREE.AnimationMixer, scene: THREE.Scene): void {
        if (!monster.mesh) return;

        const basePath = monster.mesh.userData.modelPath || '/characer_mob';
        const deathAnimationPath = `${basePath}/Animation_Dead_withSkin.fbx`;

        const loader = new FBXLoader();
        loader.load(deathAnimationPath, (fbx) => {
            if (fbx.animations && fbx.animations.length > 0) {
                mixer.stopAllAction();
                const deathAction = mixer.clipAction(fbx.animations[0]);
                deathAction.setLoop(THREE.LoopOnce, 1);
                deathAction.clampWhenFinished = true;
                deathAction.play();
            }
        }, undefined, () => {
            // Fallback: faire tomber le monstre
            if (monster.mesh) {
                monster.mesh.rotation.x = Math.PI / 2;
                setTimeout(() => {
                    if (monster.mesh && scene) {
                        scene.remove(monster.mesh);
                    }
                }, 2000);
            }
        });
    }
}

export const monsterAnimationService = MonsterAnimationService.getInstance();
