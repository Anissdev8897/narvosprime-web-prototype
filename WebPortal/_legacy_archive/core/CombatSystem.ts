import * as THREE from 'three';
import { PlayerEntity, MonsterEntity, Missile, Faction } from '../types';
import { weaponService } from '../services/weaponService';
import { LevelingService } from '../services/levelingService';

/**
 * Système de Combat (Combat System)
 * Gère les armes, les projectiles, les dégâts et les animations de combat
 */
export class CombatSystem {
    private scene: THREE.Scene;
    private missiles: Missile[] = [];
    private lastShotTime = 0;
    private lastMissileTime = 0;
    private spellCooldowns: Map<string, number> = new Map();

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    /**
     * Tirer avec l'arme équipée du joueur
     */
    public fireWeapon(
        player: PlayerEntity,
        playerMesh: THREE.Object3D
    ): boolean {
        if (!player.currentWeapon || !playerMesh) return false;

        const weaponDef = weaponService.getWeapon(player.currentWeapon);
        if (!weaponDef) return false;

        const now = Date.now();

        // Cooldown Check (Style LoL/MMO)
        const spellId = player.selectedSpellId || player.currentWeapon;
        const lastUsed = this.spellCooldowns.get(spellId) || 0;
        const cooldownMs = 1000 / (weaponDef.fireRate || 1);

        if (now - lastUsed < cooldownMs) {
            console.log(`⏳ [CombatSystem] Sort sous cooldown: ${Math.round((cooldownMs - (now - lastUsed)) / 100) / 10}s`);
            return false;
        }

        this.spellCooldowns.set(spellId, now);

        // Consommer une munition
        if (weaponDef.type !== 'MELEE') {
            player.weaponAmmo = (player.weaponAmmo || 0) - 1;
        }

        // Créer le projectile
        if (weaponDef.type !== 'MELEE') {
            this.createProjectile(player.faction, playerMesh, weaponDef.damage);
        }

        return true;
    }

    /**
     * Créer un projectile
     */
    private createProjectile(
        faction: Faction,
        playerMesh: THREE.Object3D,
        damage: number
    ): void {
        const projectileColor = faction === Faction.HUMAN ? 0xff6600 :
            faction === Faction.ALIEN ? 0x00ff00 :
                faction === Faction.MERCENARY ? 0xffaa00 : 0xffffff;

        // Direction du projectile
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(playerMesh.quaternion);

        // Créer le mesh du projectile
        const projectileGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const projectileMat = new THREE.MeshStandardMaterial({
            color: projectileColor,
            emissive: projectileColor,
            emissiveIntensity: 2.0
        });
        const projectileMesh = new THREE.Mesh(projectileGeo, projectileMat);

        // Position initiale
        const startPos = playerMesh.position.clone();
        startPos.add(forward.clone().multiplyScalar(1.5));
        startPos.y += 1.5; // Hauteur de l'arme
        projectileMesh.position.copy(startPos);

        this.scene.add(projectileMesh);

        // Créer l'entité projectile
        const projectile: Missile = {
            id: `projectile_${Date.now()}_${Math.random()}`,
            position: { x: startPos.x, y: startPos.y, z: startPos.z },
            velocity: {
                x: forward.x * 3,
                y: forward.y * 3,
                z: forward.z * 3
            },
            faction: faction,
            mesh: projectileMesh,
            lifetime: 2000 // 2 secondes
        };

        this.missiles.push(projectile);

        // Lumière du projectile
        const projectileLight = new THREE.PointLight(projectileColor, 10, 3);
        projectileMesh.add(projectileLight);
    }

    /**
     * Tirer un missile (véhicule/vaisseau)
     */
    public fireMissile(
        player: PlayerEntity,
        playerMesh: THREE.Object3D
    ): boolean {
        const now = Date.now();
        if (now - this.lastMissileTime < 500) return false;
        this.lastMissileTime = now;

        const faction = player.faction;
        const missileColor = faction === Faction.HUMAN ? 0x3b82f6 :
            faction === Faction.ALIEN ? 0x22c55e :
                faction === Faction.MERCENARY ? 0xeab308 : 0xffffff;

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion);

        // Créer le mesh du missile
        const missileGeo = new THREE.ConeGeometry(0.1, 0.5, 8);
        const missileMat = new THREE.MeshStandardMaterial({
            color: missileColor,
            emissive: missileColor,
            emissiveIntensity: 1.5
        });
        const missileMesh = new THREE.Mesh(missileGeo, missileMat);
        missileMesh.rotation.x = Math.PI / 2;

        const startPos = playerMesh.position.clone();
        startPos.add(forward.clone().multiplyScalar(1.5));
        missileMesh.position.copy(startPos);
        missileMesh.lookAt(startPos.clone().add(forward));

        this.scene.add(missileMesh);

        const missile: Missile = {
            id: `missile_${Date.now()}_${Math.random()}`,
            position: { x: startPos.x, y: startPos.y, z: startPos.z },
            velocity: {
                x: forward.x * 2,
                y: forward.y * 2,
                z: forward.z * 2
            },
            faction: faction,
            mesh: missileMesh,
            lifetime: 3000
        };

        this.missiles.push(missile);

        // Lumière du missile
        const missileLight = new THREE.PointLight(missileColor, 30, 5);
        missileLight.position.copy(startPos);
        missileMesh.add(missileLight);

        return true;
    }

    /**
     * Mettre à jour tous les projectiles
     */
    public updateMissiles(monsters: MonsterEntity[], entities: THREE.Object3D[], player: PlayerEntity): void {
        this.missiles = this.missiles.filter(missile => {
            if (!missile.mesh) return false;

            // Mettre à jour la position
            missile.position.x += missile.velocity.x;
            missile.position.y += missile.velocity.y;
            missile.position.z += missile.velocity.z;

            missile.mesh.position.set(missile.position.x, missile.position.y, missile.position.z);

            // Vérifier la durée de vie
            missile.lifetime -= 16;
            if (missile.lifetime <= 0) {
                this.scene.remove(missile.mesh);
                return false;
            }

            // Vérifier les collisions avec les monstres
            for (const monster of monsters) {
                if (monster.mesh && monster.stats.hp > 0) {
                    const dx = missile.position.x - monster.position.x;
                    const dy = missile.position.y - monster.position.y;
                    const dz = missile.position.z - monster.position.z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    if (dist < 1.5) {
                        // Impact !
                        const damage = 25;
                        monster.stats.hp -= damage;

                        if (monster.stats.hp <= 0) {
                            monster.stats.hp = 0;
                            // Récompense XP (Dofus Style)
                            const xpGained = 150 * (player.level || 1);
                            player.experience += xpGained;

                            // Check Level Up
                            const newLevel = LevelingService.getLevelFromExperience(player.experience);
                            if (newLevel > player.level) {
                                console.log(`✨ LEVEL UP! Vous êtes maintenant niveau ${newLevel}`);
                                player.level = newLevel;
                            }

                            console.log(`⚔️ Monstre vaincu ! +${xpGained} XP (Total: ${player.experience})`);
                        }

                        this.scene.remove(missile.mesh);
                        return false;
                    }
                }
            }

            // Vérifier les collisions avec les entités
            for (const entity of entities) {
                if (entity.userData.type === 'MERCHANT_NPC' || entity.userData.type === 'CIVIL_NPC') {
                    continue; // Ne pas toucher les PNJ
                }

                // Tir allié désactivé
                if (entity.userData.faction && entity.userData.faction === missile.faction) {
                    continue;
                }

                if (entity.position) {
                    const dx = missile.position.x - entity.position.x;
                    const dy = missile.position.y - entity.position.y;
                    const dz = missile.position.z - entity.position.z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    if (dist < 1.5) {
                        this.scene.remove(missile.mesh);
                        return false;
                    }
                }
            }

            return true;
        });
    }

    /**
     * Nettoyer tous les projectiles
     */
    public clear(): void {
        this.missiles.forEach(missile => {
            if (missile.mesh) {
                this.scene.remove(missile.mesh);
            }
        });
        this.missiles = [];
    }

    /**
     * Obtenir tous les missiles actifs
     */
    public getMissiles(): Missile[] {
        return this.missiles;
    }
}
