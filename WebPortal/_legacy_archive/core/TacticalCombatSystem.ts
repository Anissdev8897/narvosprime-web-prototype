import * as THREE from 'three';
import { PlayerEntity, MonsterEntity } from '../types';
import { DofusSpell } from '../data/dofusSpells';
import { DofusRenderer } from './DofusRenderer';
import { DofusBreed } from '../data/dofusBreeds';
import { breedService } from '../services/breedService';

export enum FightState {
    PLACEMENT,
    FIGHTING,
    FINISHED
}

export interface Fighter {
    id: string;
    type: 'PLAYER' | 'MONSTER' | 'SUMMON';
    name: string;
    level: number;
    teamId: number; // 0 = Rouge (Joueur), 1 = Bleu (Ennemi)
    cellId: number; // Position actuelle sur la grille (0-559)
    stats: {
        hp: number;
        maxHp: number;
        ap: number;
        mp: number;
        initiative: number;
        range: number;
    };
    spells: DofusSpell[];
    isDead: boolean;
    mesh?: THREE.Object3D;
}

/**
 * SYSTÈME DE COMBAT TACTIQUE TOUR PAR TOUR (Style Dofus)
 */
export class TacticalCombatSystem {
    private scene: THREE.Scene;
    private renderer: DofusRenderer; // Pour les conversions de coordonnées

    private fighters: Fighter[] = [];
    private currentFighterIndex: number = 0;
    private state: FightState = FightState.PLACEMENT;
    private turnTimer: number = 30; // Secondes par tour
    private turnStartTime: number = 0;
    private roundnumber: number = 1;

    constructor(scene: THREE.Scene, renderer: DofusRenderer) {
        this.scene = scene;
        this.renderer = renderer;
    }

    /**
     * Initialiser un combat
     */
    public startFight(player: PlayerEntity, monsters: MonsterEntity[]) {
        this.fighters = [];
        this.roundnumber = 1;
        this.state = FightState.PLACEMENT;

        // 1. Ajouter le Joueur
        const breed = breedService.getBreedById(player.userData?.breedId || 1) || breedService.getBreedById(1)!;
        const playerStats = breedService.calculateStats(breed, player.level);

        // Déterminer la cellule de départ (Zone rouge)
        const startCell = this.findFreeStartCell(0);

        const playerFighter: Fighter = {
            id: 'player',
            type: 'PLAYER',
            name: player.name,
            level: player.level,
            teamId: 0,
            cellId: startCell,
            stats: {
                hp: playerStats.hp,
                maxHp: playerStats.maxHp,
                ap: playerStats.ap,
                mp: playerStats.mp,
                initiative: 100 + (playerStats.intelligence + playerStats.strength + playerStats.chance + playerStats.agility),
                range: 0
            },
            spells: breedService.getAvailableSpells(breed, player.level),
            isDead: false,
            mesh: player.mesh
        };
        this.fighters.push(playerFighter);

        // 2. Ajouter les Monstres
        monsters.forEach((monster, index) => {
            const startCell = this.findFreeStartCell(1);
            const mStats = monster.userData?.stats || { hp: 100, ap: 6, mp: 3 };

            this.fighters.push({
                id: `monster_${index}`,
                type: 'MONSTER',
                name: monster.name || 'Monstre',
                level: monster.level || 1,
                teamId: 1,
                cellId: startCell,
                stats: {
                    hp: mStats.hp,
                    maxHp: mStats.hp,
                    ap: mStats.ap,
                    mp: mStats.mp,
                    initiative: mStats.initiative || 10,
                    range: 0
                },
                spells: [], // TODO: Charger les sorts du monstre
                isDead: false,
                mesh: monster.mesh
            });
        });

        // 3. Trier par Initiative
        this.fighters.sort((a, b) => b.stats.initiative - a.stats.initiative);

        console.log(`⚔️ Combat démarré ! ${this.fighters.length} combattants.`);
        this.updateFighterPositions();

        // Démarrer direct pour l'instant (skip placement phase pour MVP)
        this.startTurn();
    }

    /**
     * Trouver une case de départ libre pour une équipe
     */
    private findFreeStartCell(teamId: number): number {
        // Simple mapping pour l'instant
        // Team 0 (Joueur): Bas de la map (cellules 400-500)
        // Team 1 (Monstres): Haut de la map (cellules 0-100)

        const min = teamId === 0 ? 400 : 0;
        const max = teamId === 0 ? 500 : 100;

        // Chercher une case libre aléatoire
        for (let i = 0; i < 100; i++) {
            const cellId = Math.floor(Math.random() * (max - min + 1)) + min;
            if (!this.isCellOccupied(cellId)) return cellId;
        }
        return min; // Fallback
    }

    /**
     * Démarrer un nouveau tour
     */
    public startTurn() {
        this.state = FightState.FIGHTING;

        // Vérifier si combat fini
        if (this.checkVictory()) return;

        const currentFighter = this.fighters[this.currentFighterIndex];
        if (currentFighter.isDead) {
            this.nextTurn();
            return;
        }

        console.log(`⏱️ Tour de ${currentFighter.name} (HP: ${currentFighter.stats.hp}, PA: ${currentFighter.stats.ap}, PM: ${currentFighter.stats.mp})`);

        // Reset PA/PM
        // TODO: Gérer les buffs/debuffs persistants
        // currentFighter.stats.ap = currentFighter.stats.maxAp; 
        // currentFighter.stats.mp = currentFighter.stats.maxMp;

        this.turnStartTime = Date.now();

        // Si c'est un monstre, jouer l'IA
        if (currentFighter.type === 'MONSTER') {
            setTimeout(() => this.playMonsterTurn(), 1000);
        }
    }

    /**
     * Passer au tour suivant
     */
    public nextTurn() {
        this.currentFighterIndex++;
        if (this.currentFighterIndex >= this.fighters.length) {
            this.currentFighterIndex = 0;
            this.roundnumber++;
            console.log(`🔄 Fin du Round ${this.roundnumber - 1}`);
        }
        this.startTurn();
    }

    /**
     * IA Basique Monstre
     */
    private playMonsterTurn() {
        const monster = this.fighters[this.currentFighterIndex];
        if (!monster || monster.isDead) return;

        console.log(`🤖 IA joue pour ${monster.name}...`);

        // Simuler une action (déplacement vers joueur)
        // TODO: A* Pathfinding

        // Fin du tour après 1s
        setTimeout(() => this.nextTurn(), 1000);
    }

    /**
     * Mettre à jour les positions visuelles des meshes
     */
    private updateFighterPositions() {
        this.fighters.forEach(f => {
            if (f.mesh && !f.isDead) {
                const worldPos = this.renderer.cellIdToWorld(f.cellId);
                f.mesh.position.set(worldPos.x, worldPos.y, worldPos.z);
            }
        });
    }

    /**
     * Vérifier victoire/défaite
     */
    private checkVictory(): boolean {
        const team0Alive = this.fighters.some(f => f.teamId === 0 && !f.isDead);
        const team1Alive = this.fighters.some(f => f.teamId === 1 && !f.isDead);

        if (!team0Alive) {
            console.log("💀 DÉFAITE !");
            this.state = FightState.FINISHED;
            return true;
        }
        if (!team1Alive) {
            console.log("🏆 VICTOIRE !");
            this.state = FightState.FINISHED;
            return true;
        }
        return false;
    }

    public isCellOccupied(cellId: number): boolean {
        return this.fighters.some(f => f.cellId === cellId && !f.isDead);
    }

    public getFighterAtCell(cellId: number): Fighter | undefined {
        return this.fighters.find(f => f.cellId === cellId && !f.isDead);
    }
    /**
     * Mettre à jour le système (à appeler dans la boucle de jeu)
     */
    public update(delta: number): void {
        if (this.state !== FightState.FIGHTING) return;

        // check Timer
        if (this.turnStartTime > 0) {
            const elapsed = (Date.now() - this.turnStartTime) / 1000;
            if (elapsed > this.turnTimer) {
                console.log("⏰ Temps écoulé !");
                this.nextTurn();
            }
        }
    }

    public isFightActive(): boolean {
        return this.state === FightState.FIGHTING || this.state === FightState.PLACEMENT;
    }

    public getCurrentTurnTimeRemaining(): number {
        if (this.state !== FightState.FIGHTING || this.turnStartTime === 0) return 30;
        const elapsed = (Date.now() - this.turnStartTime) / 1000;
        return Math.max(0, Math.ceil(this.turnTimer - elapsed));
    }

    public isPlayerTurn(): boolean {
        const current = this.fighters[this.currentFighterIndex];
        return current && current.type === 'PLAYER';
    }
}
