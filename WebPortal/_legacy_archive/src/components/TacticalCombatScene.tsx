// ═══════════════════════════════════════════════════════════════════════════
// NARVOS PRIME - Tactical Combat Scene
// Combat tactique sur grille avec phase de préparation
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Swords, Shield, Heart, Zap, Wind, Droplets, Flame, Mountain, Circle,
    Clock, SkipForward, Target, Move, ArrowRight, Skull, Crown, Star,
    ChevronLeft, ChevronRight, X, AlertTriangle, Sparkles
} from 'lucide-react';
import type {
    CombatState, CombatGrid, GridCell, Combatant, Spell, Element,
    CombatPhase, CombatLogEntry, SpellEffect, ActiveEffect, AIBehavior,
    ZoneShape, ElementalStats, SpellAnimationConfig, CombatantStats
} from '../types';
import { NARVOS_CLASSES, MONSTER_BANK } from '../narvos-data';
import { deepSeekApiService } from '../services/deepSeekApiService';
import { lysringLocalApiService } from '../services/lysringLocalApiService';
import type { MapProp } from '../types';
import animationManager, { AnimationState } from '../services/CharacterAnimationManager';
import { ColoredSprite } from './ColoredSprite';
import { SpritesheetAnimator, AnimationState as TiphonAnimationState } from './SpritesheetAnimator';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════

const PREPARATION_TIME = 40; // Secondes
const GRID_SIZE = { width: 14, height: 10 }; // Taille de la grille
// Cell sizes are now % of the map container
const CELL_W = 100 / GRID_SIZE.width;
const CELL_H = 100 / GRID_SIZE.height;

const ELEMENT_COLORS: Record<Element, string> = {
    eau: '#3b82f6',      // Bleu
    feu: '#ef4444',      // Rouge
    air: '#22c55e',      // Vert
    terre: '#a16207',    // Marron
    neutre: '#9ca3af'    // Gris
};

const ELEMENT_ICONS: Record<Element, React.ReactNode> = {
    eau: <Droplets size={14} />,
    feu: <Flame size={14} />,
    air: <Wind size={14} />,
    terre: <Mountain size={14} />,
    neutre: <Circle size={14} />
};

// ═══════════════════════════════════════════════════════════════════════════
// GÉNÉRATION DE GRILLE INTELLIGENTE
// ═══════════════════════════════════════════════════════════════════════════

const generateCombatGrid = (mapProps: MapProp[] = []): CombatGrid => {
    const cells: GridCell[][] = [];
    const playerSpawnZones: { x: number; y: number }[] = [];
    const monsterSpawnZones: { x: number; y: number }[] = [];

    // Helper to check if a grid cell is blocked by a MapProp or collision zone
    const isBlocked = (gx: number, gy: number) => {
        // Grid is 14x10. Map is 0-100%.
        // Cell center Percentage X: (gx + 0.5) * (100/14)
        // Check if any prop is close to this center
        const cx = (gx + 0.5) * (100 / GRID_SIZE.width);
        const cy = (gy + 0.5) * (100 / GRID_SIZE.height);

        return mapProps.some(p => {
            // Monsters move or die, don't block
            if (p.type === 'monster') return false;

            // Collision zones have priority and use rectangle collision
            if (p.type === 'collision' || (p as any).isCollisionZone) {
                // Calculate collision zone bounds in percentage
                const halfWidthPct = (p.width / 2) / 10; // Approximate conversion
                const halfHeightPct = (p.height / 2) / 10;

                const isInXRange = cx >= (p.x - halfWidthPct) && cx <= (p.x + halfWidthPct);
                const isInYRange = cy >= (p.y - halfHeightPct) && cy <= (p.y + halfHeightPct);

                return isInXRange && isInYRange;
            }

            // Other solid props (trees, rocks, etc.) use circular collision
            const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
            return dist < 4.0; // Slightly larger threshold for safety
        });
    };

    // Pre-calculate spawn positions (5 for each side)
    const blueSpawns = [
        { x: 1, y: 2 }, { x: 2, y: 4 }, { x: 1, y: 5 }, { x: 2, y: 7 }, { x: 1, y: 8 }
    ];
    const redSpawns = [
        { x: 12, y: 2 }, { x: 11, y: 4 }, { x: 12, y: 5 }, { x: 11, y: 7 }, { x: 12, y: 8 }
    ];

    for (let y = 0; y < GRID_SIZE.height; y++) {
        cells[y] = [];
        for (let x = 0; x < GRID_SIZE.width; x++) {
            // Déterminer le type de case
            let type: GridCell['type'] = 'normal';
            let walkable = true;
            let blocksLineOfSight = false;

            // Check Obstacles from Map Props
            if (isBlocked(x, y)) {
                type = 'obstacle';
                walkable = false;
                blocksLineOfSight = true;
            } else {
                // Assign specific 5 spawn cases
                const isBlue = blueSpawns.some(s => s.x === x && s.y === y);
                const isRed = redSpawns.some(s => s.x === x && s.y === y);

                if (isBlue) {
                    type = 'player_spawn';
                    playerSpawnZones.push({ x, y });
                } else if (isRed) {
                    type = 'monster_spawn';
                    monsterSpawnZones.push({ x, y });
                }
            }

            cells[y][x] = {
                x,
                y,
                type,
                walkable,
                isWalkable: walkable,
                isObstacle: !walkable || type === 'obstacle',
                blocksLineOfSight,
                occupiedBy: undefined
            };
        }
    }

    return {
        width: GRID_SIZE.width,
        height: GRID_SIZE.height,
        cells,
        playerSpawnZones,
        monsterSpawnZones
    };
};

// --- SUB-COMPONENTS (Moved outside for performance & correctness) ---

interface ProjectileProps {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    element: Element;
    duration: number;
}

interface SpellAnimationProps {
    config: SpellAnimationConfig;
    gridX: number;
    gridY: number;
    onComplete: () => void;
}

const SpellAnimationOverlay: React.FC<SpellAnimationProps> = ({ config, gridX, gridY, onComplete }) => {
    const [frame, setFrame] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    // Timestamp unique pour forcer le rechargement du GIF et éviter la boucle
    const [uniqueId] = useState(() => Date.now());

    // Calculer le chemin du GIF basé sur le folder
    const gifPath = config.folder ? `${config.folder}.gif` : null;

    useEffect(() => {
        if (gifPath) console.log(`[Animation] Lancement GIF: ${gifPath}`);

        const animationDuration = (config.frameCount / 30) * 1000;
        const effectiveDuration = Math.max(500, Math.min(animationDuration, 5000));

        if (gifPath) {
            const timer = setTimeout(() => {
                setIsComplete(true);
                onComplete();
            }, effectiveDuration);
            return () => clearTimeout(timer);
        } else {
            const frameTime = 1000 / 30;
            const timer = setInterval(() => {
                setFrame(f => {
                    if (f >= config.frameCount - 1) {
                        clearInterval(timer);
                        setIsComplete(true);
                        onComplete();
                        return f;
                    }
                    return f + 1;
                });
            }, frameTime);
            return () => clearInterval(timer);
        }
    }, [config, onComplete, gifPath]);

    let src: string;
    if (gifPath) {
        src = `${gifPath}?t=${uniqueId}`;
    } else {
        const frameStr = frame.toString().padStart(3, '0');
        src = `${config.folder}/${config.prefix}${frameStr}.png`;
    }

    if (isComplete) return null;

    return (
        <div
            className="absolute pointer-events-none z-[150]"
            style={{
                left: `${(gridX + 0.5) * 48}px`, // Centré sur la case
                top: `${(gridY + 0.5) * 48}px`,
                width: '160px',
                height: '160px',
                transform: 'translate(-50%, -60%) rotateZ(-45deg) rotateX(-60deg)',
                transformOrigin: 'center center'
            }}
        >
            <img
                src={src}
                alt="spell-anim"
                className="w-full h-full object-contain"
                style={{
                    imageRendering: gifPath ? 'auto' : 'pixelated',
                    filter: 'drop-shadow(0 0 10px rgba(255, 200, 100, 0.5))',
                    display: 'block'
                }}
            />
        </div>
    );
};

const SpellProjectile: React.FC<ProjectileProps> = ({ startX, startY, endX, endY, element, duration }) => {
    const [pos, setPos] = useState({ x: startX, y: startY });

    useEffect(() => {
        requestAnimationFrame(() => {
            setPos({ x: endX, y: endY });
        });
    }, [endX, endY]);

    const colors = {
        eau: 'from-blue-400 to-blue-600',
        feu: 'from-red-400 to-orange-600',
        air: 'from-green-400 to-teal-300',
        terre: 'from-amber-600 to-yellow-800',
        neutre: 'from-stone-300 to-white'
    };

    return (
        <div
            className="absolute z-40 pointer-events-none w-6 h-6"
            style={{
                left: `calc(${pos.x} * (100% / 14) + (100% / 28) - 12px)`,
                top: `calc(${pos.y} * (100% / 10) + (100% / 20) - 12px)`,
                transition: `left ${duration}ms linear, top ${duration}ms linear`
            }}
        >
            <div className={`w-full h-full rounded-full bg-gradient-to-br ${colors[element]} shadow-[0_0_15px_rgba(255,255,255,0.6)] animate-spin`}></div>
            {/* Trail */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-2 bg-gradient-to-r ${colors[element]} opacity-50 blur-sm rounded-full -z-10`} style={{
                transform: `rotate(${Math.atan2(endY - startY, endX - startY)}rad) translateX(-50%)`
            }}></div>
        </div>
    );
};

interface FloatingTextProps {
    x: number;
    y: number;
    value: string | number;
    color: string;
}

const FloatingText: React.FC<FloatingTextProps> = ({ x, y, value, color }) => {
    return (
        <div
            className="absolute z-50 pointer-events-none font-black text-xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] animate-[float-up_1s_ease-out_forwards]"
            style={{
                left: `calc(${x} * (100% / 14) + (100% / 28))`,
                top: `calc(${y} * (100% / 10))`,
                color: color,
                transform: 'translateX(-50%)' // Center text horizontally
            }}
        >
            {value}
        </div>
    );
};

const BattleTimeline = ({ turnOrder, combatants, currentTurnIndex }: { turnOrder: string[], combatants: Combatant[], currentTurnIndex: number }) => {
    // Separate allies and enemies for display
    const allies = combatants.filter(c => c.team === 'player' && c.isAlive);
    const enemies = combatants.filter(c => c.team === 'enemy' && c.isAlive);

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 z-20">
            {/* Player Team Section */}
            <div className="flex items-center gap-1 bg-gradient-to-r from-blue-900/80 to-blue-800/60 p-2 rounded-xl border border-blue-500/50 backdrop-blur-md shadow-xl">
                <div className="flex items-center gap-1">
                    {allies.map((c) => {
                        const turnIndex = turnOrder.indexOf(c.id);
                        const isCurrent = turnIndex === currentTurnIndex;

                        return (
                            <div
                                key={c.id}
                                className={`relative transition-all duration-300 ${isCurrent ? 'scale-110 z-10' : 'scale-95 opacity-90'}`}
                            >
                                <div
                                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 shadow-lg ${isCurrent
                                        ? 'border-yellow-400 ring-2 ring-yellow-400/50'
                                        : 'border-blue-400/50'
                                        } bg-gradient-to-br from-blue-700 to-blue-900`}
                                >
                                    {c.spriteUrl ? (
                                        <img
                                            src={c.spriteUrl}
                                            alt={c.name}
                                            className="w-full h-full object-cover"
                                            style={{ imageRendering: 'pixelated' }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                                            {c.name[0]}
                                        </div>
                                    )}
                                </div>
                                {/* HP Bar */}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-stone-900 rounded-full overflow-hidden border border-black/50">
                                    <div
                                        className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-300"
                                        style={{ width: `${(c.stats.hp / c.stats.maxHp) * 100}%` }}
                                    />
                                </div>
                                {/* Current Turn Indicator */}
                                {isCurrent && (
                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-yellow-400 rounded-full animate-pulse shadow-lg" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* VS Separator */}
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-stone-800 to-stone-900 rounded-full border-2 border-stone-600 shadow-xl">
                <Swords size={20} className="text-stone-400" />
            </div>

            {/* Enemy Team Section */}
            <div className="flex items-center gap-1 bg-gradient-to-r from-red-900/80 to-red-800/60 p-2 rounded-xl border border-red-500/50 backdrop-blur-md shadow-xl">
                <div className="flex items-center gap-1">
                    {enemies.map((c) => {
                        const turnIndex = turnOrder.indexOf(c.id);
                        const isCurrent = turnIndex === currentTurnIndex;

                        return (
                            <div
                                key={c.id}
                                className={`relative transition-all duration-300 ${isCurrent ? 'scale-110 z-10' : 'scale-95 opacity-90'}`}
                            >
                                <div
                                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 shadow-lg ${isCurrent
                                        ? 'border-yellow-400 ring-2 ring-yellow-400/50'
                                        : 'border-red-400/50'
                                        } bg-gradient-to-br from-red-700 to-red-900`}
                                >
                                    {c.spriteUrl ? (
                                        <img
                                            src={c.spriteUrl}
                                            alt={c.name}
                                            className="w-full h-full object-cover"
                                            style={{ imageRendering: 'pixelated' }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                                            {c.name[0]}
                                        </div>
                                    )}
                                </div>
                                {/* HP Bar */}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-stone-900 rounded-full overflow-hidden border border-black/50">
                                    <div
                                        className="h-full bg-gradient-to-r from-red-400 to-red-600 transition-all duration-300"
                                        style={{ width: `${(c.stats.hp / c.stats.maxHp) * 100}%` }}
                                    />
                                </div>
                                {/* Current Turn Indicator */}
                                {isCurrent && (
                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-yellow-400 rounded-full animate-pulse shadow-lg" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const SpellBar = ({ combatant, selectedSpellId, onSelect }: { combatant: Combatant, selectedSpellId: string | undefined, onSelect: (s: Spell | null) => void }) => {
    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 z-20">
            {/* Main Bar Container */}
            <div className="flex items-center bg-gradient-to-b from-stone-800/95 to-stone-900/95 rounded-2xl border-2 border-stone-600/50 shadow-2xl backdrop-blur-md overflow-hidden">
                {/* PA Status */}
                <div className="flex flex-col items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-900/80 to-blue-800/60 border-r border-stone-600/50">
                    <span className="text-3xl font-black text-blue-400 drop-shadow-lg">{combatant.stats.pa}</span>
                    <span className="text-[10px] text-blue-300 uppercase tracking-widest font-bold">PA</span>
                </div>

                {/* Spells Container */}
                <div className="flex items-center gap-2 px-4 py-2">
                    {combatant.spells.map(spell => {
                        const cooldown = combatant.spellCooldowns[spell.id] || 0;
                        const canUse = combatant.stats.pa >= spell.paCost && cooldown === 0;
                        const isSelected = selectedSpellId === spell.id;

                        // Get element color for border
                        const elementColors: Record<string, string> = {
                            'eau': 'border-blue-400 shadow-blue-500/30',
                            'water': 'border-blue-400 shadow-blue-500/30',
                            'feu': 'border-red-400 shadow-red-500/30',
                            'fire': 'border-red-400 shadow-red-500/30',
                            'air': 'border-cyan-400 shadow-cyan-500/30',
                            'terre': 'border-amber-400 shadow-amber-500/30',
                            'earth': 'border-amber-400 shadow-amber-500/30',
                            'neutre': 'border-stone-400 shadow-stone-500/30',
                            'neutral': 'border-stone-400 shadow-stone-500/30',
                        };
                        const spellElement = spell.effects?.[0]?.element || spell.damage?.element || 'neutral';
                        const elementStyle = elementColors[spellElement] || 'border-stone-500';

                        return (
                            <button
                                key={spell.id}
                                onClick={() => onSelect(isSelected ? null : spell)}
                                disabled={!canUse}
                                className={`relative w-16 h-16 rounded-xl transform transition-all duration-200 group overflow-hidden ${isSelected
                                    ? 'scale-110 ring-2 ring-yellow-400 z-10 -translate-y-3 shadow-[0_0_20px_rgba(250,204,21,0.6)]'
                                    : 'hover:scale-105 hover:-translate-y-1'
                                    } ${canUse
                                        ? `bg-gradient-to-br from-stone-700 to-stone-800 border-2 ${elementStyle} shadow-lg`
                                        : 'bg-stone-900 border border-stone-800 grayscale opacity-50 cursor-not-allowed'}`}
                            >
                                {/* Spell Icon */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {spell.icon && (spell.icon.startsWith('/') || spell.icon.startsWith('http')) ? (
                                        <img src={spell.icon} alt={spell.name} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                                    ) : (
                                        <span className="text-2xl">{spell.icon || '⚔️'}</span>
                                    )}
                                </div>

                                {/* PA Cost Badge */}
                                <div className="absolute top-0 right-0 bg-gradient-to-br from-blue-500 to-blue-700 text-white text-[10px] font-black px-1.5 py-0.5 rounded-bl-lg shadow-md flex items-center gap-0.5">
                                    <Zap size={10} />
                                    {spell.paCost}
                                </div>

                                {/* Range Badge */}
                                <div className="absolute bottom-0 left-0 bg-green-700/80 text-white text-[9px] font-bold px-1 py-0.5 rounded-tr-lg">
                                    {spell.minRange}-{spell.maxRange}
                                </div>

                                {/* Cooldown Overlay */}
                                {cooldown > 0 && (
                                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-[2px]">
                                        <div className="flex flex-col items-center">
                                            <Clock size={16} className="text-stone-400 mb-1" />
                                            <span className="text-white font-black text-lg">{cooldown}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Selected Indicator */}
                                {isSelected && (
                                    <div className="absolute inset-0 border-2 border-yellow-400 rounded-xl pointer-events-none animate-pulse" />
                                )}

                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-56 bg-gradient-to-br from-stone-900 to-stone-800 text-white text-xs p-3 rounded-xl border border-stone-600 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-2xl">
                                    <div className="font-black text-yellow-400 text-sm mb-1">{spell.name}</div>
                                    <div className="text-stone-300 mb-2 text-[11px]">{spell.description || 'Aucune description'}</div>
                                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                                        <div className="flex items-center gap-1 text-blue-400">
                                            <Zap size={10} /> Coût: {spell.paCost} PA
                                        </div>
                                        <div className="flex items-center gap-1 text-green-400">
                                            <Target size={10} /> Portée: {spell.minRange}-{spell.maxRange}
                                        </div>
                                        {spell.effects?.[0]?.value && (
                                            <div className="flex items-center gap-1 text-red-400 col-span-2">
                                                <Swords size={10} /> Dégâts: {spell.effects[0].value}
                                            </div>
                                        )}
                                    </div>
                                    {/* Arrow */}
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-stone-600" />
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* PM Status */}
                <div className="flex flex-col items-center justify-center w-20 h-20 bg-gradient-to-br from-green-900/80 to-green-800/60 border-l border-stone-600/50">
                    <span className="text-3xl font-black text-green-400 drop-shadow-lg">{combatant.stats.pm}</span>
                    <span className="text-[10px] text-green-300 uppercase tracking-widest font-bold">PM</span>
                </div>
            </div>
        </div>
    );
};
// ═══════════════════════════════════════════════════════════════════════════
// LYSRIN V4 - AI ENGINE (Fusion Model Mistral-7B + Qwen-4B)
// ═══════════════════════════════════════════════════════════════════════════
const LysrinV4 = {
    // Manhattan Distance
    distance: (x1: number, y1: number, x2: number, y2: number): number => {
        return Math.abs(x2 - x1) + Math.abs(y2 - y1);
    },

    // Trouver le chemin le plus court (BFS algorithme pour éviter les obstacles)
    findPath: (grid: CombatGrid, start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number }[] => {
        const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [{ ...start, path: [] }];
        const visited = new Set<string>();
        visited.add(`${start.x},${start.y}`);

        while (queue.length > 0) {
            const { x, y, path } = queue.shift()!;

            if (x === end.x && y === end.y) return path;

            const neighbors = [
                { nx: x + 1, ny: y }, { nx: x - 1, ny: y },
                { nx: x, ny: y + 1 }, { nx: x, ny: y - 1 }
            ];

            for (const { nx, ny } of neighbors) {
                if (nx >= 0 && nx < GRID_SIZE.width && ny >= 0 && ny < GRID_SIZE.height) {
                    const key = `${nx},${ny}`;
                    const cell = grid.cells[ny][nx];
                    // Correction: Autoriser la case destination même si occupée (pour cibler un joueur)
                    const isTarget = nx === end.x && ny === end.y;
                    if (!visited.has(key) && cell.type !== 'obstacle' && (!cell.occupiedBy || isTarget)) {
                        visited.add(key);
                        queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }] });
                    }
                }
            }
        }
        return [];
    },

    // Évaluer la menace d'un ennemi
    evaluateThreat: (enemy: Combatant, monster: Combatant): number => {
        let threat = 0;

        // Plus de HP = moins dangereux (priorise les faibles)
        threat += (1 - enemy.stats.hp / enemy.stats.maxHp) * 30;

        // Proximité
        const dist = Math.abs(enemy.gridX - monster.gridX) + Math.abs(enemy.gridY - monster.gridY);
        threat += Math.max(0, 10 - dist) * 5;

        // Dégâts potentiels (basé sur puissance)
        threat += enemy.stats.puissance * 0.5;

        return threat;
    },

    // Décider de l'action du monstre (Moteur Strategique Amélioré)
    decideAction: (
        monster: Combatant,
        state: CombatState
    ): { type: 'move' | 'spell' | 'pass'; targetX?: number; targetY?: number; spell?: Spell } => {

        const enemies = state.combatants.filter(c => c.team !== monster.team && c.isAlive);
        const allies = state.combatants.filter(c => c.team === monster.team && c.isAlive);
        const grid = state.grid;

        if (enemies.length === 0) return { type: 'pass' };

        // 1. TACTICAL TARGETING - Évaluation de la meilleure cible
        const target = enemies.reduce((best, current) => {
            const scoreB = LysrinV4.evaluateThreat(best, monster);
            const scoreC = LysrinV4.evaluateThreat(current, monster);
            return scoreC > scoreB ? current : best;
        });

        const distToTarget = LysrinV4.distance(monster.gridX, monster.gridY, target.gridX, target.gridY);

        // 2. SPELL SELECTION - Trouver le meilleur sort pour la situation
        let bestSpell: Spell | null = null;
        let pBestScore = -1;

        for (const spell of monster.spells) {
            if (monster.stats.pa < spell.paCost) continue;
            if ((monster.spellCooldowns[spell.id] || 0) > 0) continue;

            let score = 0;
            const inRange = distToTarget >= spell.minRange && distToTarget <= spell.maxRange;

            if (inRange) {
                score += 100; // Priorité aux sorts utilisables de suite
                const effect = spell.effects[0];
                if (effect && effect.type === 'damage' && effect.element) {
                    // Bonus si l'ennemi a des faiblesses dans cet élément
                    const res = target.stats.resistances[effect.element] || 0;
                    score += (20 - res); // Plus la résistance est basse, plus le score est haut
                }
            } else {
                // Sort pas à portée, mais on pourrait bouger
                if (distToTarget <= spell.maxRange + monster.stats.pm) {
                    score += 50;
                }
            }

            if (score > pBestScore) {
                pBestScore = score;
                bestSpell = spell;
            }
        }

        // 3. EXECUTION LOGIC
        if (bestSpell && distToTarget >= bestSpell.minRange && distToTarget <= bestSpell.maxRange) {
            return { type: 'spell', spell: bestSpell, targetX: target.gridX, targetY: target.gridY };
        }

        // 4. STRATEGIC MOVEMENT (Smarter)
        if (monster.stats.pm > 0) {
            // Si on a plus de PA, on recule de l'ennemi (Hit and Run)
            if (monster.stats.pa <= 0 || (bestSpell && distToTarget > bestSpell.maxRange)) {
                const path = LysrinV4.findPath(grid, { x: monster.gridX, y: monster.gridY }, { x: target.gridX, y: target.gridY });

                if (monster.stats.pa <= 0) {
                    // RETRAITE : S'éloigner de l'ennemi le plus proche
                    const directions = [
                        { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
                    ];
                    let bestFleePos = { x: monster.gridX, y: monster.gridY };
                    let maxDist = distToTarget;

                    // On teste toutes les positions atteignables avec les PM restants
                    // Pour simplifier, on teste juste les directions cardinales au max des PM
                    for (const dir of directions) {
                        for (let d = monster.stats.pm; d >= 1; d--) {
                            const tx = monster.gridX + dir.x * d;
                            const ty = monster.gridY + dir.y * d;
                            if (tx >= 0 && tx < GRID_SIZE.width && ty >= 0 && ty < GRID_SIZE.height) {
                                const cell = grid.cells[ty][tx];
                                if (!cell.occupiedBy && cell.type !== 'obstacle') {
                                    const newDist = LysrinV4.distance(tx, ty, target.gridX, target.gridY);
                                    if (newDist > maxDist) {
                                        maxDist = newDist;
                                        bestFleePos = { x: tx, y: ty };
                                    }
                                }
                            }
                        }
                    }
                    if (bestFleePos.x !== monster.gridX || bestFleePos.y !== monster.gridY) {
                        return { type: 'move', targetX: bestFleePos.x, targetY: bestFleePos.y };
                    }
                } else if (path.length > 0) {
                    // AVANCE : Se rapprocher pour être à portée du sort
                    const stepCount = Math.min(monster.stats.pm, path.length - 1);
                    if (stepCount > 0) {
                        const dest = path[stepCount - 1];
                        return { type: 'move', targetX: dest.x, targetY: dest.y };
                    }
                }
            }
        }

        return { type: 'pass' };
    },

    // Calculer les cases affectées par une zone (AoE)
    calculateAoE: (centerX: number, centerY: number, shape: ZoneShape, size: number): { x: number; y: number }[] => {
        const affected: { x: number; y: number }[] = [];
        const sx = Math.max(0, centerX - size);
        const ex = Math.min(GRID_SIZE.width - 1, centerX + size);
        const sy = Math.max(0, centerY - size);
        const ey = Math.min(GRID_SIZE.height - 1, centerY + size);

        for (let y = sy; y <= ey; y++) {
            for (let x = sx; x <= ex; x++) {
                const dist = Math.abs(x - centerX) + Math.abs(y - centerY);

                let isInside = false;
                switch (shape) {
                    case 'single':
                        isInside = (x === centerX && y === centerY);
                        break;
                    case 'circle':
                        isInside = dist <= size;
                        break;
                    case 'cross':
                        isInside = (x === centerX || y === centerY) && dist <= size;
                        break;
                    case 'line':
                        isInside = (x === centerX || y === centerY) && dist <= size;
                        break;
                    case 'square':
                        isInside = Math.abs(x - centerX) <= size && Math.abs(y - centerY) <= size;
                        break;
                }

                if (isInside) affected.push({ x, y });
            }
        }
        return affected;
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

interface TacticalCombatProps {
    playerData: {
        name: string;
        classId: string;
        level: number;
        stats: CombatantStats;
        spells: Spell[];
        spriteUrl?: string;
        gender?: string;
        splitSpritesFolder?: string;
    };
    monsters: { monsterId: string; level: number }[];
    onCombatEnd: (victory: boolean, rewards?: any) => void;
    mapType?: string;
    mapProps?: MapProp[]; // Pass world props for localized obstacle detection
    processedMonsterBank?: any[]; // Allow passing pre-processed monster data (e.g. transparent sprites)
}

export const TacticalCombatScene: React.FC<TacticalCombatProps> = ({
    playerData,
    monsters,
    onCombatEnd,
    mapType = 'forest',
    mapProps = [],
    processedMonsterBank = MONSTER_BANK
}) => {
    // --- ÉTAT COMBAT ---
    const [combatState, setCombatState] = useState<CombatState>(() => ({
        phase: 'preparation',
        grid: generateCombatGrid(mapProps),
        combatants: [],
        turnOrder: [],
        currentTurnIndex: 0,
        currentRound: 1,
        preparationTimeRemaining: PREPARATION_TIME,
        turnTimeRemaining: 50, // 50 seconds per turn
        selectedSpell: null,
        targetableCells: [],
        movableCells: [],
        combatLog: [],
        turn: 1,
        activeCombatantId: null,
        selectedSpellId: null,
        targetCell: null,
        log: []
    }));

    // RÉFÉRENCE CRITIQUE : Permet à l'IA d'accéder à l'état SYNCHRONE sans attendre le re-render
    const combatStateRef = useRef<CombatState>(combatState);
    useEffect(() => {
        combatStateRef.current = combatState;
    }, [combatState]);

    const [selectedCombatant, setSelectedCombatant] = useState<string | null>(null);
    const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
    const [showCombatLog, setShowCombatLog] = useState(false);
    const [animatingAction, setAnimatingAction] = useState<string | null>(null);
    const [lastTargetedCell, setLastTargetedCell] = useState<{ x: number, y: number, type: string } | null>(null);
    const [turnAnimation, setTurnAnimation] = useState<string | null>(null);

    // Animation States
    const [activeProjectiles, setActiveProjectiles] = useState<{ id: number, startX: number, startY: number, endX: number, endY: number, element: Element }[]>([]);
    const [floatingTexts, setFloatingTexts] = useState<{ id: number, x: number, y: number, value: string | number, color: string }[]>([]);
    const [globalFrame, setGlobalFrame] = useState(0);
    const [walkingCombatants, setWalkingCombatants] = useState<Record<string, { dx: number, dy: number }>>({});
    const [activeAnimations, setActiveAnimations] = useState<{ id: number, config: SpellAnimationConfig, gridX: number, gridY: number }[]>([]);
    const [hoveredCombatant, setHoveredCombatant] = useState<Combatant | null>(null);

    // Combat Result Screen State
    const [showResultScreen, setShowResultScreen] = useState(false);
    const [combatResult, setCombatResult] = useState<{
        victory: boolean;
        xpGained: number;
        arosGained: number;
        itemsLooted: { id: string; name: string; icon: string; rarity: string }[];
        monstersKilled: { name: string; level: number }[];
        combatDuration: number;
        damageDealt: number;
        damageTaken: number;
    } | null>(null);
    const combatStartTime = useRef(Date.now());
    const damageStats = useRef({ dealt: 0, taken: 0 });

    // Abandon Combat Modal State
    const [showAbandonModal, setShowAbandonModal] = useState(false);

    // Global Animation Loop
    useEffect(() => {
        const interval = setInterval(() => {
            setGlobalFrame(f => (f + 1) % 4);
        }, 150);
        return () => clearInterval(interval);
    }, []);

    // Derived State and Helpers
    const { grid, combatants, turnOrder, currentTurnIndex, phase, selectedSpell, combatLog } = combatState;
    const currentCombatant = combatants.find(c => c.id === turnOrder[currentTurnIndex]);

    const setSelectedSpell = (spell: Spell | null) => {
        setCombatState(prev => ({ ...prev, selectedSpell: spell }));
    };

    const hoveredAoECells = useMemo(() => {
        if (!selectedSpell || !hoveredCell) return [];
        const dist = LysrinV4.distance(currentCombatant?.gridX || 0, currentCombatant?.gridY || 0, hoveredCell.x, hoveredCell.y);
        if (dist > selectedSpell.maxRange || dist < selectedSpell.minRange) return [];
        return LysrinV4.calculateAoE(hoveredCell.x, hoveredCell.y, selectedSpell.zoneShape, selectedSpell.zoneSize);
    }, [selectedSpell, hoveredCell, currentCombatant]);

    const damagePreview = useMemo(() => {
        if (!selectedSpell || hoveredAoECells.length === 0) return null;
        const targets = hoveredAoECells
            .map(cell => combatants.find(c => c.gridX === cell.x && c.gridY === cell.y && c.isAlive))
            .filter((c): c is Combatant => c !== undefined);
        if (targets.length === 0) return null;
        const effect = selectedSpell.effects.find(e => e.type === 'damage' || e.type === 'heal');
        if (!effect) return null;
        return {
            targets: targets.map(t => t.id),
            value: effect.value,
            type: effect.type,
            element: effect.element
        };
    }, [selectedSpell, hoveredAoECells, combatants]);
    const initializeCombat = () => {
        const newCombatants: Combatant[] = [];
        const grid = generateCombatGrid(mapProps);

        // Créer le combattant joueur
        const playerSpawn = (grid.playerSpawnZones && grid.playerSpawnZones.length > 0)
            ? grid.playerSpawnZones[Math.floor(grid.playerSpawnZones.length / 2)]
            : { x: 1, y: 1 };

        // Construire l'URL du sprite - PRIORITÉ aux split sprites si disponible
        let playerSpriteUrl = '';
        let usesSplitSprites = false;

        if (playerData.splitSpritesFolder) {
            const folder = playerData.splitSpritesFolder.endsWith('/')
                ? playerData.splitSpritesFolder.slice(0, -1)
                : playerData.splitSpritesFolder;
            playerSpriteUrl = `${folder}/1.png`;
            usesSplitSprites = true;
        } else {
            playerSpriteUrl = playerData.spriteUrl || '';
            usesSplitSprites = false;
        }

        const playerCombatant: Combatant = {
            id: 'player',
            classId: playerData.classId,
            name: playerData.name || 'Héros',
            type: 'player',
            gridX: playerSpawn.x,
            gridY: playerSpawn.y,
            position: { x: playerSpawn.x, y: playerSpawn.y },
            stats: { ...playerData.stats },
            spells: [...playerData.spells],
            spellCooldowns: {},
            spellUsesThisTurn: {},
            activeEffects: [],
            spriteUrl: playerSpriteUrl || '',
            splitSpritesFolder: usesSplitSprites ? (playerData.splitSpritesFolder || '') : undefined,
            isSpriteSheet: false, // Now using individual frames
            animState: 'IDLE',
            animFrame: 0,
            orientation: 'S',
            isAlive: true,
            isDead: false,
            hasPlayed: false,
            team: 'player'
        };

        grid.cells[playerSpawn.y][playerSpawn.x].occupiedBy = 'player';
        newCombatants.push(playerCombatant);

        // Créer les monstres
        monsters.forEach((monster, index) => {
            const dataBank = processedMonsterBank || MONSTER_BANK;
            const monsterData = dataBank.find((m: any) => m.id === monster.monsterId) as any;
            if (!monsterData) return;

            const monsterSpawn = grid.monsterSpawnZones ? grid.monsterSpawnZones[index % grid.monsterSpawnZones.length] : { x: 0, y: 0 };
            const monsterId = `monster_${index}`;

            // LEVEL SCALING: Monsters get stronger based on their level
            const monsterLevel = monster.level || 1;
            const levelMultiplier = 1 + (monsterLevel - 1) * 0.15; // +15% stats per level
            const hpMultiplier = 1 + (monsterLevel - 1) * 0.20;    // +20% HP per level

            const scaledHp = Math.floor((monsterData.stats.hp || 100) * hpMultiplier);
            const scaledPuissance = Math.floor((monsterData.stats.puissance || 10) * levelMultiplier);

            const monsterCombatant: Combatant = {
                id: monsterId,
                name: monsterData.name,
                type: 'monster',
                gridX: monsterSpawn.x,
                gridY: monsterSpawn.y,
                position: { x: monsterSpawn.x, y: monsterSpawn.y },
                stats: {
                    hp: scaledHp,
                    maxHp: scaledHp,
                    pa: monsterData.stats.pa || 6,
                    maxPa: monsterData.stats.pa || 6,
                    pm: monsterData.stats.pm || 3,
                    maxPm: monsterData.stats.pm || 3,
                    puissance: scaledPuissance,
                    dommages: Math.floor((monsterData.stats.dommages || 0) * levelMultiplier),
                    critique: monsterData.stats.critique || 5,
                    domCritique: monsterData.stats.domCritique || 50,
                    domMelee: monsterData.stats.domMelee || 0,
                    domDistance: monsterData.stats.domDistance || 0,
                    esquive: monsterData.stats.esquive || 0,
                    parade: monsterData.stats.parade || 0,
                    resMelee: monsterData.stats.resMelee || 0,
                    resDistance: monsterData.stats.resDistance || 0,
                    maitrise: {
                        eau: monsterData.element === 'eau' ? 20 : 0,
                        feu: monsterData.element === 'feu' ? 20 : 0,
                        air: monsterData.element === 'air' ? 20 : 0,
                        terre: monsterData.element === 'terre' ? 20 : 0,
                        neutre: monsterData.element === 'neutre' ? 20 : 0,
                        ...(monsterData.stats.maitrise || {})
                    },
                    resistances: {
                        eau: monsterData.element === 'eau' ? 15 : -10,
                        feu: monsterData.element === 'feu' ? 15 : -10,
                        air: monsterData.element === 'air' ? 15 : -10,
                        terre: monsterData.element === 'terre' ? 15 : -10,
                        neutre: 0,
                        ...(monsterData.stats.resistances || {})
                    },
                    initiative: monsterData.stats.initiative || 80,
                    vitesse: monsterData.stats.pm || 3,
                    niveau: monster.level || 1,
                    experience: 0,
                    experienceMax: 1000
                },
                spells: monsterData.spells?.map((s: any) => {
                    const effects = [...(s.effects || [])];
                    if (s.damage && effects.length === 0) {
                        effects.push({
                            type: 'damage',
                            element: s.damage.element || 'neutre',
                            value: s.damage.min || 10 // Fallback to min damage
                        });
                    }

                    return {
                        ...s,
                        id: s.id || Math.random().toString(),
                        name: s.name || 'Attaque',
                        paCost: s.paCost || s.apCost || 3,
                        pmCost: 0,
                        maxRange: s.maxRange || s.range || 1,
                        minRange: s.minRange || 0,
                        cooldown: s.cooldown || 1,
                        usesPerTurn: s.usesPerTurn || 1,
                        currentLevel: 1,
                        maxLevel: 5,
                        levelRequired: 1,
                        type: 'damage',
                        lineOfSight: true,
                        modifiableRange: false,
                        zoneShape: 'single',
                        zoneSize: 1,
                        effects: effects
                    };
                }) || [],
                spellCooldowns: {},
                activeEffects: [],
                spriteUrl: monsterData.spriteUrl || '',
                isSpriteSheet: !!monsterData.isSpriteSheet,
                isAlive: true,
                isDead: false,
                hasPlayed: false,
                team: 'enemy',
                aiBehavior: monsterData.aiBehavior || 'aggressive'
            };

            grid.cells[monsterSpawn.y][monsterSpawn.x].occupiedBy = monsterId;
            newCombatants.push(monsterCombatant);
        });

        const allCombatants = [...newCombatants].sort((a, b) => b.stats.initiative - a.stats.initiative);

        setCombatState(prev => ({
            ...prev,
            grid,
            combatants: allCombatants,
            turnOrder: allCombatants.map(c => c.id),
            currentTurnIndex: 0
        }));
    };

    // === HANDLE END TURN ===
    const handleEndTurn = useCallback(() => {
        setTurnAnimation("TOUR SUIVANT");
        setTimeout(() => setTurnAnimation(null), 1500);

        setCombatState(prev => {
            let nextIndex = (prev.currentTurnIndex + 1) % prev.turnOrder.length;
            let nextRound = prev.currentRound;
            if (nextIndex === 0) nextRound += 1;

            // Trouver le prochain combattant VIVANT
            let attempts = 0;
            while (attempts < prev.turnOrder.length) {
                const potentialId = prev.turnOrder[nextIndex];
                const potentialC = prev.combatants.find(c => c.id === potentialId);

                if (potentialC && potentialC.isAlive) break;

                nextIndex = (nextIndex + 1) % prev.turnOrder.length;
                if (nextIndex === 0) nextRound += 1;
                attempts++;
            }

            const updatedCombatants = prev.combatants.map(c => {
                if (prev.turnOrder[prev.currentTurnIndex] === c.id) {
                    return { ...c, hasPlayed: true };
                }
                return c;
            });

            // Reset stats for the NEXT combatant
            const nextCombatantId = prev.turnOrder[nextIndex];
            const finalCombatants = updatedCombatants.map(c => {
                if (c.id === nextCombatantId) {
                    return {
                        ...c,
                        stats: {
                            ...c.stats,
                            pa: c.stats.maxPa || 6,
                            pm: c.stats.maxPm || 3
                        }
                    };
                }
                return c;
            });

            return {
                ...prev,
                currentTurnIndex: nextIndex,
                currentRound: nextRound,
                combatants: finalCombatants,
                selectedSpell: null,
                turnTimeRemaining: 50
            };
        });
    }, []);

    // ... (rest of actions: executeMove, etc.)

    // --- ACTIONS ---
    const executeMove = useCallback((destX: number, destY: number) => {
        if (!currentCombatant || currentCombatant.type !== 'player') return;
        if (phase !== 'active') return;

        // Vérifier que la case destination est valide
        const destCell = grid.cells[destY]?.[destX];
        if (!destCell || !destCell.walkable || destCell.occupiedBy || destCell.type === 'obstacle') {
            console.log('[Combat] Case destination invalide');
            return;
        }

        // Calculer le chemin complet vers la destination
        const path = LysrinV4.findPath(grid, { x: currentCombatant.gridX, y: currentCombatant.gridY }, { x: destX, y: destY });

        // Vérifier qu'un chemin existe
        if (path.length === 0) {
            console.log('[Combat] Aucun chemin vers la destination');
            return;
        }

        // Vérifier que le joueur a assez de PM pour atteindre la destination
        const pmNeeded = path.length;
        if (pmNeeded > currentCombatant.stats.pm) {
            console.log(`[Combat] PM insuffisants: ${pmNeeded} nécessaires, ${currentCombatant.stats.pm} disponibles`);
            return;
        }

        // La destination finale est exactement la case cliquée
        const finalDest = { x: destX, y: destY };
        const dx = finalDest.x - currentCombatant.gridX;
        const dy = finalDest.y - currentCombatant.gridY;
        const orientation = animationManager.getDirectionFromDiff(dx, dy);

        // Start walking animation and set state to RUN
        setWalkingCombatants(prev => ({ ...prev, [currentCombatant.id]: { dx, dy } }));
        setCombatState(prev => ({
            ...prev,
            combatants: prev.combatants.map(c =>
                c.id === currentCombatant.id ? { ...c, animState: 'RUN' as const, orientation } : c
            )
        }));

        setTimeout(() => {
            setCombatState(prev => {
                const newCombatants = prev.combatants.map(c => {
                    if (c.id === currentCombatant.id) {
                        return {
                            ...c,
                            gridX: finalDest.x,
                            gridY: finalDest.y,
                            stats: { ...c.stats, pm: c.stats.pm - pmNeeded },
                            animState: 'IDLE' as const
                        };
                    }
                    return c;
                });

                const newGrid = { ...prev.grid };
                newGrid.cells[currentCombatant.gridY][currentCombatant.gridX].occupiedBy = undefined;
                newGrid.cells[finalDest.y][finalDest.x].occupiedBy = currentCombatant.id;

                return { ...prev, combatants: newCombatants, grid: newGrid };
            });

            setWalkingCombatants(prev => {
                const next = { ...prev };
                delete next[currentCombatant.id];
                return next;
            });
        }, 500);
    }, [currentCombatant, grid, phase]);

    // ... (other handlers unchanged)


    const handleMovementEffect = useCallback((sourceId: string, targetId: string, type: 'push' | 'pull', distance: number) => {
        setCombatState(prev => {
            const source = prev.combatants.find(c => c.id === sourceId);
            const target = prev.combatants.find(c => c.id === targetId);
            if (!source || !target) return prev;
            const dx = Math.sign(target.gridX - source.gridX);
            const dy = Math.sign(target.gridY - source.gridY);
            let finalX = target.gridX;
            let finalY = target.gridY;

            const moveDir = type === 'push' ? 1 : -1;

            for (let i = 0; i < distance; i++) {
                const nextX = finalX + (dx * moveDir);
                const nextY = finalY + (dy * moveDir);
                if (nextX >= 0 && nextX < GRID_SIZE.width && nextY >= 0 && nextY < GRID_SIZE.height) {
                    const cell = prev.grid.cells[nextY][nextX];
                    if (cell.type !== 'obstacle' && !cell.occupiedBy) {
                        finalX = nextX;
                        finalY = nextY;
                    } else break;
                } else break;
            }

            if (finalX === target.gridX && finalY === target.gridY) return prev;

            const newGrid = { ...prev.grid };
            newGrid.cells[target.gridY][target.gridX].occupiedBy = undefined;
            newGrid.cells[finalY][finalX].occupiedBy = targetId;

            return {
                ...prev,
                grid: newGrid,
                combatants: prev.combatants.map(c => c.id === targetId ? { ...c, gridX: finalX, gridY: finalY } : c)
            };
        });
    }, []);

    const applyActiveEffect = useCallback((targetId: string, effect: ActiveEffect) => {
        setCombatState(prev => ({
            ...prev,
            combatants: prev.combatants.map(c => {
                if (c.id !== targetId) return c;

                // If stat affected, apply modification immediately for the duration
                const newStats = { ...c.stats };
                if (effect.statAffected) {
                    const mod = effect.type === 'buff' ? effect.value : -effect.value;
                    (newStats as any)[effect.statAffected] += mod;
                }

                return {
                    ...c,
                    stats: newStats,
                    activeEffects: [...(c.activeEffects || []), effect]
                };
            })
        }));
    }, []);

    const executeSpell = useCallback((spell: Spell, targetX: number, targetY: number) => {
        if (!currentCombatant) return;

        // Calculate all affected cells
        const affectedCells = LysrinV4.calculateAoE(targetX, targetY, spell.zoneShape, spell.zoneSize);
        const targetIds = affectedCells
            .map(cell => grid.cells[cell.y]?.[cell.x]?.occupiedBy)
            .filter((id): id is string => id !== undefined);

        // AP Cost deduction and set Casting state
        setCombatState(prev => ({
            ...prev,
            combatants: prev.combatants.map(c =>
                c.id === currentCombatant.id ? {
                    ...c,
                    stats: { ...c.stats, pa: c.stats.pa - spell.paCost },
                    isCasting: true,
                    castingSpellId: spell.id,
                    animState: 'ATTACK' as const,
                    orientation: animationManager.getDirectionFromDiff(targetX - c.gridX, targetY - c.gridY)
                } : c
            )
        }));

        // Reset casting state after animation
        setTimeout(() => {
            setCombatState(prev => ({
                ...prev,
                combatants: prev.combatants.map(c =>
                    c.id === currentCombatant.id ? { ...c, isCasting: false, castingSpellId: undefined, animState: 'IDLE' as const } : c
                )
            }));
        }, 1500);

        // Determine Timing
        const isProjectile = spell.effectType === 'projectile';
        const dist = LysrinV4.distance(currentCombatant.gridX, currentCombatant.gridY, targetX, targetY);
        const impactDelay = isProjectile ? 500 : 150;

        // 1. Launch Projectile Visual & Impact Animation
        if (spell.animationConfig) {
            const animId = Date.now() + Math.random();
            setActiveAnimations(prev => [...prev, {
                id: animId,
                config: spell.animationConfig!,
                gridX: targetX,
                gridY: targetY
            }]);
        }

        if (isProjectile) {
            const projId = Date.now();
            setActiveProjectiles(prev => [...prev, {
                id: projId,
                startX: currentCombatant.gridX,
                startY: currentCombatant.gridY,
                endX: targetX,
                endY: targetY,
                element: spell.effects[0]?.element || 'neutre'
            }]);
            setTimeout(() => setActiveProjectiles(prev => prev.filter(p => p.id !== projId)), impactDelay + 100);
        }

        // 2. Schedule Impact Effects (Damage/Heal)
        setTimeout(() => {
            // Apply Effects / Damage
            targetIds.forEach(tId => {
                const target = combatants.find(cb => cb.id === tId);
                if (!target) return;

                // Calculate distance from caster OR from center of AoE? Dofus usually logic is from caster for boosts.
                const distToTarget = LysrinV4.distance(currentCombatant.gridX, currentCombatant.gridY, target.gridX, target.gridY);
                const isMelee = distToTarget <= 1;

                spell.effects.forEach(effect => {
                    if (effect.type === 'damage') {
                        let dmg = Math.floor(effect.value + (Math.random() * 5));
                        if (isMelee) dmg = Math.floor(dmg * (1 + (currentCombatant.stats.domMelee || 0) / 100));
                        else dmg = Math.floor(dmg * (1 + (currentCombatant.stats.domDistance || 0) / 100));

                        if (isMelee) dmg = Math.floor(dmg * (1 - (target.stats.resMelee || 0) / 100));
                        else dmg = Math.floor(dmg * (1 - (target.stats.resDistance || 0) / 100));

                        applyDamage(target.id, dmg, effect.element || 'neutre');
                    } else if (effect.type === 'heal') {
                        applyHeal(target.id, Math.floor(effect.value));
                    } else if (effect.type === 'push' || effect.type === 'pull') {
                        handleMovementEffect(currentCombatant.id, target.id, effect.type, effect.distance || 1);
                    } else if (effect.type === 'buff' || effect.type === 'debuff') {
                        applyActiveEffect(target.id, {
                            id: Math.random().toString(36).substr(2, 9),
                            spellId: spell.id,
                            name: spell.name,
                            icon: spell.icon,
                            type: effect.type as any,
                            statAffected: effect.statAffected,
                            value: effect.value,
                            duration: effect.duration || 1,
                            casterId: currentCombatant.id
                        });
                    }
                });
            });
        }, impactDelay); // <--- SYNC DELAY

    }, [currentCombatant, combatants, grid, handleMovementEffect, applyActiveEffect]);

    const applyDamage = (targetId: string, amount: number, element: Element) => {
        setCombatState(prev => {
            const target = prev.combatants.find(c => c.id === targetId);
            if (!target) return prev;

            const newHp = Math.max(0, target.stats.hp - amount);
            const isAlive = newHp > 0;

            if (!isAlive) {
                const newGrid = { ...prev.grid };
                newGrid.cells[target.gridY][target.gridX].occupiedBy = undefined;
                return {
                    ...prev,
                    grid: newGrid,
                    combatants: prev.combatants.map(c => c.id === targetId ? { ...c, stats: { ...c.stats, hp: newHp }, isAlive: false } : c)
                };
            }

            return {
                ...prev,
                combatants: prev.combatants.map(c => c.id === targetId ? { ...c, stats: { ...c.stats, hp: newHp }, animState: 'HIT' as const } : c)
            };
        });

        // Reset animState after HIT
        setTimeout(() => {
            setCombatState(prev => ({
                ...prev,
                combatants: prev.combatants.map(c => c.id === targetId ? { ...c, animState: 'IDLE' as const } : c)
            }));
        }, 500);

        const target = combatants.find(c => c.id === targetId);
        if (target) {
            // Track damage stats for combat report
            if (target.team === 'enemy') {
                damageStats.current.dealt += amount;
            } else {
                damageStats.current.taken += amount;
            }

            const textId = Date.now() + Math.random();
            setFloatingTexts(prev => [...prev, { id: textId, x: target.gridX, y: target.gridY, value: `-${amount}`, color: ELEMENT_COLORS[element] }]);
            setTimeout(() => setFloatingTexts(prev => prev.filter(t => t.id !== textId)), 1000);
        }
    };

    const applyHeal = (targetId: string, amount: number) => {
        setCombatState(prev => ({
            ...prev,
            combatants: prev.combatants.map(c =>
                c.id === targetId ? { ...c, stats: { ...c.stats, hp: Math.min(c.stats.maxHp, c.stats.hp + amount) } } : c
            )
        }));

        const target = combatants.find(c => c.id === targetId);
        if (target) {
            const textId = Date.now() + Math.random();
            setFloatingTexts(prev => [...prev, { id: textId, x: target.gridX, y: target.gridY, value: `+${amount}`, color: '#22c55e' }]);
            setTimeout(() => setFloatingTexts(prev => prev.filter(t => t.id !== textId)), 1000);
        }
    };

    const handleCellClick = (x: number, y: number) => {
        // PREPARATION PHASE: Placement instantané sur les cases de spawn
        if (phase === 'preparation') {
            const cell = grid.cells[y]?.[x];
            // Permettre le déplacement UNIQUEMENT sur les cases player_spawn disponibles
            if (cell && cell.type === 'player_spawn' && !cell.occupiedBy) {
                setCombatState(prev => {
                    const newCombatants = prev.combatants.map(c => {
                        if (c.id === 'player') {
                            return { ...c, gridX: x, gridY: y };
                        }
                        return c;
                    });
                    const newGrid = { ...prev.grid };
                    // Libérer l'ancienne position
                    const current = prev.combatants.find(c => c.id === 'player');
                    if (current) {
                        newGrid.cells[current.gridY][current.gridX].occupiedBy = undefined;
                    }
                    // Occuper la nouvelle position
                    newGrid.cells[y][x].occupiedBy = 'player';
                    return { ...prev, combatants: newCombatants, grid: newGrid };
                });
                console.log(`[Combat] Joueur placé sur la case (${x}, ${y})`);
            }
            return;
        }

        // Vérifier que c'est le tour du joueur
        if (!currentCombatant || currentCombatant.type !== 'player') return;
        if (phase !== 'active') return;

        // === MODE SORT SÉLECTIONNÉ ===
        if (selectedSpell) {
            const distance = LysrinV4.distance(currentCombatant.gridX, currentCombatant.gridY, x, y);

            // Vérifier la portée min/max du sort
            if (distance < selectedSpell.minRange) {
                console.log(`[Combat] Cible trop proche: distance ${distance}, portée min ${selectedSpell.minRange}`);
                return;
            }
            if (distance > selectedSpell.maxRange) {
                console.log(`[Combat] Cible trop loin: distance ${distance}, portée max ${selectedSpell.maxRange}`);
                return;
            }

            // Vérifier les PA disponibles
            if (currentCombatant.stats.pa < selectedSpell.paCost) {
                console.log(`[Combat] PA insuffisants: ${selectedSpell.paCost} nécessaires, ${currentCombatant.stats.pa} disponibles`);
                return;
            }

            // Lancer le sort sur la case ciblée
            console.log(`[Combat] Lancement de ${selectedSpell.name} sur (${x}, ${y})`);
            executeSpell(selectedSpell, x, y);
            setSelectedSpell(null);
            return;
        }

        // === MODE DÉPLACEMENT ===
        // Cliquer sur la case où se trouve le joueur ne fait rien
        if (x === currentCombatant.gridX && y === currentCombatant.gridY) {
            return;
        }

        // Exécuter le déplacement vers la case cliquée
        executeMove(x, y);
    };

    // --- TOUS LES EFFECTS CI-DESSOUS POUR ÉVITER LES ERREURS DE DÉCLARATION ---



    // --- INITIALISATION ---
    useEffect(() => {
        initializeCombat();
    }, []);

    // --- PREPARATION TIMER LOOP ---
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (phase === 'preparation') {
            timer = setInterval(() => {
                setCombatState(prev => {
                    const remaining = prev.preparationTimeRemaining !== undefined ? prev.preparationTimeRemaining : PREPARATION_TIME;
                    if (remaining <= 1) { // Stop at 1 to transition at 0
                        return { ...prev, phase: 'active', turnTimeRemaining: 50 };
                    }
                    return { ...prev, preparationTimeRemaining: remaining - 1 };
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [phase]);

    // --- ACTIVE TURN TIMER LOOP ---
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (phase === 'active' && currentCombatant) {
            timer = setInterval(() => {
                setCombatState(prev => {
                    const remaining = prev.turnTimeRemaining !== undefined ? prev.turnTimeRemaining : 50;
                    if (remaining <= 0) {
                        return { ...prev, turnTimeRemaining: 0 };
                    }
                    return { ...prev, turnTimeRemaining: remaining - 1 };
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [phase, currentCombatant?.id]);

    // --- TRIGGER END TURN ON TIMEOUT ---
    useEffect(() => {
        if (phase === 'active' && (combatState.turnTimeRemaining !== undefined && combatState.turnTimeRemaining <= 0)) {
            console.log(`🔚 [Combat] Temps écoulé pour ${currentCombatant?.name}. Fin du tour.`);
            handleEndTurn();
        }
    }, [combatState.turnTimeRemaining, phase, handleEndTurn]);

    // --- AI TURN EFFECT ---
    useEffect(() => {
        if (phase === 'active' && currentCombatant && currentCombatant.type === 'monster' && currentCombatant.isAlive) {
            const runMonsterTurn = async () => {
                // Petit délai pour simuler la réflexion
                await new Promise(resolve => setTimeout(resolve, 800));

                let action: any = null;

                // --- INTEGRATION IA ---
                if (deepSeekApiService.isAvailable()) {
                    try {
                        console.log(`🧠 [Combat AI] DeepSeek analyse le tour de ${currentCombatant.name}...`);
                        const smartAction = await deepSeekApiService.generateTacticalAction(currentCombatant, combatStateRef.current.combatants);
                        console.log(`🧠 [Combat AI] Décision AI:`, smartAction);
                        action = smartAction;
                    } catch (e) {
                        console.warn('⚠️ [Combat AI] DeepSeek error, trying local AI...');
                    }
                }

                // Fallback sur l'IA Locale (LysringV4)
                if (!action && (await lysringLocalApiService.isAvailable())) {
                    try {
                        console.log(`🏠 [Combat AI] Lysring Local analyse le tour de ${currentCombatant.name}...`);
                        const localAction = await lysringLocalApiService.generateTacticalAction(currentCombatant, combatStateRef.current.combatants);
                        console.log(`🏠 [Combat AI] Décision IA Locale:`, localAction);
                        action = localAction;
                    } catch (e) {
                        console.warn('⚠️ [Combat AI] Local AI error, falling back to script...');
                    }
                }

                // Fallback final sur le moteur de règles LysrinV4
                if (!action) {
                    action = LysrinV4.decideAction(currentCombatant, combatStateRef.current);
                }

                // Conversion de la décision AI vers le format moteur (si c'est un sort)
                if (action.type === 'spell') {
                    const spell = currentCombatant.spells.find(s => s.id === action.spellId) || currentCombatant.spells[0];
                    action = { ...action, spell };
                }

                // 1. GESTION DU DÉPLACEMENT
                if (action.type === 'move' && action.targetX !== undefined && action.targetY !== undefined) {
                    const targetX = action.targetX;
                    const targetY = action.targetY;
                    const dx = targetX - (currentCombatant.gridX || 0);
                    const dy = targetY - (currentCombatant.gridY || 0);
                    const orientation = animationManager.getDirectionFromDiff(dx, dy);

                    setWalkingCombatants(prev => ({ ...prev, [currentCombatant.id]: { dx, dy } }));

                    setCombatState(prev => {
                        const newCombatants = prev.combatants.map(c => {
                            if (c.id === currentCombatant.id) {
                                // Consommer les PM correspondants
                                const dist = Math.abs(targetX - (c.gridX || 0)) + Math.abs(targetY - (c.gridY || 0));
                                return { 
                                    ...c, 
                                    gridX: targetX, 
                                    gridY: targetY, 
                                    stats: { ...c.stats, pm: Math.max(0, c.stats.pm - dist) },
                                    animState: 'RUN' as const,
                                    orientation
                                };
                            }
                            return c;
                        });
                        const newGrid = { ...prev.grid };
                        if (currentCombatant.gridY !== undefined && currentCombatant.gridX !== undefined) {
                            newGrid.cells[currentCombatant.gridY][currentCombatant.gridX].occupiedBy = undefined;
                        }
                        newGrid.cells[targetY][targetX].occupiedBy = currentCombatant.id;
                        return { ...prev, combatants: newCombatants, grid: newGrid };
                    });

                    // Attendre la fin du déplacement (anim 500ms)
                    await new Promise(resolve => setTimeout(resolve, 600));

                    setCombatState(prev => ({
                        ...prev,
                        combatants: prev.combatants.map(c => 
                            c.id === currentCombatant.id ? { ...c, animState: 'IDLE' as const } : c
                        )
                    }));

                    setWalkingCombatants(prev => {
                        const next = { ...prev };
                        delete next[currentCombatant.id];
                        return next;
                    });

                    // Re-évaluer l'action après déplacement (Recursivement ou via une boucle)
                    const updatedMonster = combatStateRef.current.combatants.find(c => c.id === currentCombatant.id);
                    if (updatedMonster && (updatedMonster.stats.pa > 0 || updatedMonster.stats.pm > 0)) {
                        // Utilisation du script pour la suite du tour (plus rapide après le move intelligent)
                        action = LysrinV4.decideAction(updatedMonster, combatStateRef.current);
                    }
                }

                // 2. GESTION DE L'ATTAQUE (Multi-attaques sécurisées)
                while (action.type === 'spell' && action.spell && action.targetX !== undefined && action.targetY !== undefined) {
                    executeSpell(action.spell, action.targetX, action.targetY);

                    // Attendre l'impact du sort et l'animation (total ~2s pour que le joueur voit bien)
                    const waitTime = action.spell.effectType === 'projectile' ? 1800 : 1500;
                    await new Promise(resolve => setTimeout(resolve, waitTime));

                    // VÉRIFICATION CRITIQUE : On récupère l'état le plus récent via la Ref
                    const stateAfterAttack = combatStateRef.current;
                    const currentSelf = stateAfterAttack.combatants.find(c => c.id === currentCombatant.id);

                    if (!currentSelf || currentSelf.stats.pa < action.spell.paCost || !currentSelf.isAlive) {
                        break;
                    }

                    action = LysrinV4.decideAction(currentSelf, stateAfterAttack);
                }

                // 2.5 GESTION DÉPLACEMENT APRÈS ATTAQUE (Hit and Run)
                const stateAfterAttacks = combatStateRef.current;
                const selfAfterAttacks = stateAfterAttacks.combatants.find(c => c.id === currentCombatant.id);
                if (selfAfterAttacks && selfAfterAttacks.isAlive && selfAfterAttacks.stats.pm > 0) {
                    const postAttackAction = LysrinV4.decideAction(selfAfterAttacks, stateAfterAttacks);
                    if (postAttackAction.type === 'move' && postAttackAction.targetX !== undefined && postAttackAction.targetY !== undefined) {
                        const targetX = postAttackAction.targetX;
                        const targetY = postAttackAction.targetY;
                        const dx = targetX - (selfAfterAttacks.gridX || 0);
                        const dy = targetY - (selfAfterAttacks.gridY || 0);

                        setWalkingCombatants(prev => ({ ...prev, [currentCombatant.id]: { dx, dy } }));
                        setCombatState(prev => {
                            const newCombatants = prev.combatants.map(c => {
                                if (c.id === currentCombatant.id) {
                                    const dist = Math.abs(targetX - (c.gridX || 0)) + Math.abs(targetY - (c.gridY || 0));
                                    return { ...c, gridX: targetX, gridY: targetY, stats: { ...c.stats, pm: Math.max(0, c.stats.pm - dist) } };
                                }
                                return c;
                            });
                            const newGrid = { ...prev.grid };
                            newGrid.cells[selfAfterAttacks.gridY][selfAfterAttacks.gridX].occupiedBy = undefined;
                            newGrid.cells[targetY][targetX].occupiedBy = currentCombatant.id;
                            return { ...prev, combatants: newCombatants, grid: newGrid };
                        });
                        await new Promise(resolve => setTimeout(resolve, 600));
                        setWalkingCombatants(prev => {
                            const next = { ...prev };
                            delete next[currentCombatant.id];
                            return next;
                        });
                    }
                }

                // 3. FIN DU TOUR
                console.log(`🔚 [Combat AI] ${currentCombatant.name} termine son tour.`);
                await new Promise(resolve => setTimeout(resolve, 500));
                handleEndTurn();
            };

            runMonsterTurn();
        }
    }, [currentTurnIndex, phase, currentCombatant?.id]);

    // --- CHECK VICTORY/DEFEAT ---
    useEffect(() => {
        if (phase === 'preparation' || showResultScreen) return;
        const livingPlayers = combatants.filter(c => c.team === 'player' && c.isAlive);
        const livingEnemies = combatants.filter(c => c.team === 'enemy' && c.isAlive);

        if (livingPlayers.length === 0 || livingEnemies.length === 0) {
            const victory = livingEnemies.length === 0;

            // Calculate rewards
            const deadMonsters = combatants.filter(c => c.team === 'enemy' && !c.isAlive);
            const totalMonsterLevels = deadMonsters.reduce((sum, m) => sum + (m.stats.niveau || 1), 0);

            // XP based on monster levels (scaled)
            const baseXp = victory ? totalMonsterLevels * 25 : Math.floor(totalMonsterLevels * 5);
            const xpGained = Math.floor(baseXp * (1 + Math.random() * 0.2)); // +/- 20% variance

            // Aros based on monster levels
            const arosGained = victory ? Math.floor(totalMonsterLevels * 15 + Math.random() * 50) : 0;

            // Random loot (only on victory)
            const possibleLoot = [
                { id: 'potion_hp_s', name: 'Potion de Vie (S)', icon: '🧪', rarity: 'common' },
                { id: 'potion_hp_m', name: 'Potion de Vie (M)', icon: '🧪', rarity: 'uncommon' },
                { id: 'crystal_fire', name: 'Cristal de Feu', icon: '🔥', rarity: 'rare' },
                { id: 'crystal_water', name: 'Cristal d\'Eau', icon: '💧', rarity: 'rare' },
                { id: 'scroll_power', name: 'Parchemin de Puissance', icon: '📜', rarity: 'epic' },
            ];

            const itemsLooted: typeof possibleLoot = [];
            if (victory) {
                const lootChance = Math.min(0.7, 0.3 + deadMonsters.length * 0.1);
                deadMonsters.forEach(() => {
                    if (Math.random() < lootChance) {
                        const roll = Math.random();
                        let item;
                        if (roll < 0.5) item = possibleLoot[0];
                        else if (roll < 0.75) item = possibleLoot[1];
                        else if (roll < 0.9) item = possibleLoot[Math.random() < 0.5 ? 2 : 3];
                        else item = possibleLoot[4];
                        itemsLooted.push(item);
                    }
                });
            }

            setCombatResult({
                victory,
                xpGained,
                arosGained,
                itemsLooted,
                monstersKilled: deadMonsters.map(m => ({ name: m.name, level: m.stats.niveau || 1 })),
                combatDuration: Math.floor((Date.now() - combatStartTime.current) / 1000),
                damageDealt: damageStats.current.dealt,
                damageTaken: damageStats.current.taken
            });
            setShowResultScreen(true);
        }
    }, [combatants, phase, showResultScreen]);

    // Handle closing the result screen
    const handleCloseResultScreen = () => {
        if (combatResult) {
            onCombatEnd(combatResult.victory, {
                xp: combatResult.xpGained,
                kamas: combatResult.arosGained,
                items: combatResult.itemsLooted
            });
        }
    };

    // --- RENDER ---
    return (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden font-sans select-none pointer-events-none">
            {/* Overlay background when combat is active to help visibility but keep map visible */}
            <div className="absolute inset-0 bg-black/30 pointer-events-none" />

            {/* Battle Timeline */}
            <BattleTimeline turnOrder={turnOrder} combatants={combatants} currentTurnIndex={currentTurnIndex} />

            {/* Turn Start Overlay */}
            {turnAnimation && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-[2px] animate-in fade-in zoom-in duration-300">
                    <div className="flex flex-col items-center">
                        <div className="text-[14px] font-black uppercase tracking-[0.3em] text-white/50 mb-2">Début du tour</div>
                        <div className="text-7xl font-black text-white italic tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.4)] gradiant-text">
                            {turnAnimation}
                        </div>
                        <div className="w-32 h-1 bg-yellow-400 mt-4 rounded-full animate-width-pulse" />
                    </div>
                </div>
            )}

            {/* Combat Result Screen */}
            {showResultScreen && combatResult && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center pointer-events-auto bg-black/70 backdrop-blur-sm animate-in fade-in duration-500">
                    <div className={`relative w-[600px] max-w-[90vw] rounded-2xl overflow-hidden shadow-2xl border-2 ${combatResult.victory ? 'border-yellow-500/50' : 'border-red-500/50'
                        }`}>
                        {/* Header */}
                        <div className={`relative py-8 px-6 text-center ${combatResult.victory
                            ? 'bg-gradient-to-b from-yellow-900/90 via-amber-800/80 to-stone-900/95'
                            : 'bg-gradient-to-b from-red-900/90 via-red-800/80 to-stone-900/95'
                            }`}>
                            {/* Victory/Defeat Icon */}
                            <div className={`absolute top-4 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full flex items-center justify-center ${combatResult.victory ? 'bg-yellow-500' : 'bg-red-600'
                                } shadow-lg`}>
                                {combatResult.victory ? (
                                    <Crown size={40} className="text-yellow-900" />
                                ) : (
                                    <Skull size={40} className="text-red-200" />
                                )}
                            </div>

                            <div className="mt-16">
                                <h1 className={`text-4xl font-black uppercase tracking-widest ${combatResult.victory ? 'text-yellow-400' : 'text-red-400'
                                    } drop-shadow-lg`}>
                                    {combatResult.victory ? 'VICTOIRE !' : 'DÉFAITE'}
                                </h1>
                                <p className="text-stone-400 text-sm mt-2">
                                    Combat terminé en {Math.floor(combatResult.combatDuration / 60)}m {combatResult.combatDuration % 60}s
                                </p>
                            </div>
                        </div>

                        {/* Rewards Section */}
                        <div className="bg-stone-900/95 p-6 space-y-4">
                            {/* XP and Aros */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* XP Gained */}
                                <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-xl p-4 border border-purple-500/30">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center">
                                            <Star size={24} className="text-purple-200" />
                                        </div>
                                        <div>
                                            <div className="text-purple-400 text-xs uppercase font-bold tracking-wider">Expérience</div>
                                            <div className="text-2xl font-black text-white">+{combatResult.xpGained} XP</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Aros Gained */}
                                <div className="bg-gradient-to-br from-yellow-900/50 to-amber-800/30 rounded-xl p-4 border border-yellow-500/30">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-yellow-600 flex items-center justify-center">
                                            <span className="text-2xl">💰</span>
                                        </div>
                                        <div>
                                            <div className="text-yellow-400 text-xs uppercase font-bold tracking-wider">Aros</div>
                                            <div className="text-2xl font-black text-white">+{combatResult.arosGained}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Items Looted */}
                            {combatResult.itemsLooted.length > 0 && (
                                <div className="bg-stone-800/50 rounded-xl p-4 border border-stone-700/50">
                                    <div className="text-stone-400 text-xs uppercase font-bold tracking-wider mb-3">Objets obtenus</div>
                                    <div className="flex flex-wrap gap-2">
                                        {combatResult.itemsLooted.map((item, i) => (
                                            <div
                                                key={i}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${item.rarity === 'common' ? 'bg-stone-700/50 border-stone-600' :
                                                    item.rarity === 'uncommon' ? 'bg-green-900/30 border-green-600/50' :
                                                        item.rarity === 'rare' ? 'bg-blue-900/30 border-blue-500/50' :
                                                            'bg-purple-900/30 border-purple-500/50'
                                                    } border`}
                                            >
                                                <span className="text-lg">{item.icon}</span>
                                                <span className={`text-sm font-bold ${item.rarity === 'common' ? 'text-stone-300' :
                                                    item.rarity === 'uncommon' ? 'text-green-400' :
                                                        item.rarity === 'rare' ? 'text-blue-400' :
                                                            'text-purple-400'
                                                    }`}>{item.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Combat Stats */}
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="bg-stone-800/50 rounded-lg p-3">
                                    <div className="text-red-400 text-xs uppercase font-bold">Dégâts infligés</div>
                                    <div className="text-xl font-black text-white">{combatResult.damageDealt}</div>
                                </div>
                                <div className="bg-stone-800/50 rounded-lg p-3">
                                    <div className="text-orange-400 text-xs uppercase font-bold">Dégâts subis</div>
                                    <div className="text-xl font-black text-white">{combatResult.damageTaken}</div>
                                </div>
                                <div className="bg-stone-800/50 rounded-lg p-3">
                                    <div className="text-green-400 text-xs uppercase font-bold">Monstres tués</div>
                                    <div className="text-xl font-black text-white">{combatResult.monstersKilled.length}</div>
                                </div>
                            </div>

                            {/* Monsters Killed List */}
                            {combatResult.monstersKilled.length > 0 && (
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {combatResult.monstersKilled.map((m, i) => (
                                        <span key={i} className="text-xs bg-red-900/30 text-red-300 px-2 py-1 rounded border border-red-700/50">
                                            {m.name} (Niv. {m.level})
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Close Button */}
                        <div className="bg-stone-900/95 px-6 pb-6">
                            <button
                                onClick={handleCloseResultScreen}
                                className={`w-full py-4 rounded-xl font-black uppercase tracking-wider text-lg transition-all ${combatResult.victory
                                    ? 'bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-400 text-yellow-900'
                                    : 'bg-gradient-to-r from-stone-600 to-stone-500 hover:from-stone-500 hover:to-stone-400 text-white'
                                    } shadow-lg hover:scale-[1.02] active:scale-[0.98]`}
                            >
                                {combatResult.victory ? 'Réclamer les récompenses' : 'Continuer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Abandon Combat Confirmation Modal (Custom In-Game Style) */}
            {showAbandonModal && (
                <div className="fixed inset-0 z-[4000] flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative w-[450px] max-w-[90vw] bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 rounded-2xl border-2 border-red-600/50 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-red-900/80 to-red-800/60 p-5 border-b border-red-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                                    <AlertTriangle size={28} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white uppercase tracking-wide">Abandonner le combat</h2>
                                    <p className="text-red-300 text-sm">Cette action est irréversible</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <p className="text-stone-300 text-center mb-6">
                                Êtes-vous sûr de vouloir <span className="text-red-400 font-bold">abandonner ce combat</span> ?
                                <br />
                                <span className="text-stone-500 text-sm">Cela compte comme une défaite et vous ne recevrez aucune récompense.</span>
                            </p>

                            {/* Warning Box */}
                            <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <Skull size={24} className="text-red-500 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm">
                                        <p className="text-red-400 font-bold mb-1">Conséquences :</p>
                                        <ul className="text-red-300/80 space-y-1 text-xs">
                                            <li>• Aucune expérience gagnée</li>
                                            <li>• Aucun Aros récupéré</li>
                                            <li>• Aucun objet looté</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowAbandonModal(false)}
                                    className="flex-1 py-3 px-4 bg-gradient-to-b from-stone-600 to-stone-700 hover:from-stone-500 hover:to-stone-600 text-white font-bold uppercase tracking-wide rounded-xl border border-stone-500/50 transition-all hover:scale-[1.02] shadow-lg"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={() => {
                                        setShowAbandonModal(false);
                                        onCombatEnd(false, { xp: 0, kamas: 0, items: [], abandoned: true });
                                    }}
                                    className="flex-1 py-3 px-4 bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold uppercase tracking-wide rounded-xl border border-red-500/50 transition-all hover:scale-[1.02] shadow-lg flex items-center justify-center gap-2"
                                >
                                    <X size={18} />
                                    Abandonner
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Combat Grid - Isometric Diamond Style (Dofus-like) */}
            <div className="absolute inset-0 pointer-events-auto z-[5]">
                {/* Isometric Grid Container */}
                <div
                    className="absolute left-1/2 top-1/2"
                    style={{
                        transform: 'translate(-50%, -50%) rotateX(60deg) rotateZ(45deg)',
                        transformStyle: 'preserve-3d',
                        width: `${GRID_SIZE.width * 48}px`,
                        height: `${GRID_SIZE.height * 48}px`,
                    }}
                >
                    {/* Les Cases */}
                    {grid.cells.map((row, y) => row.map((cell, x) => {
                        // Calculs pour le mode combat actif
                        const distanceFromPlayer = currentCombatant
                            ? LysrinV4.distance(currentCombatant.gridX, currentCombatant.gridY, x, y)
                            : Infinity;

                        // Vérification de portée pour les sorts
                        const isInSpellRange = selectedSpell && currentCombatant
                            ? distanceFromPlayer >= selectedSpell.minRange && distanceFromPlayer <= selectedSpell.maxRange
                            : false;

                        // Vérification de case accessible pour le déplacement
                        const isWalkableCell = cell.walkable && !cell.occupiedBy && cell.type !== 'obstacle';

                        // Calcul du chemin vers cette case (pour vérifier l'accessibilité réelle)
                        const pathToCell = (phase === 'active' && currentCombatant?.type === 'player' && !selectedSpell && isWalkableCell)
                            ? LysrinV4.findPath(grid, { x: currentCombatant.gridX, y: currentCombatant.gridY }, { x, y })
                            : [];

                        // Case accessible = chemin existe ET coût en PM suffisant
                        const isReachableByPM = pathToCell.length > 0 && pathToCell.length <= (currentCombatant?.stats.pm || 0);

                        // Case ciblable par un sort
                        const isTargetable = phase === 'active' && selectedSpell && isInSpellRange;

                        // Case accessible pour le déplacement
                        const isMovable = phase === 'active' && !selectedSpell && currentCombatant?.type === 'player' && isReachableByPM;

                        // Zone d'effet du sort survolé
                        const isInAoE = hoveredAoECells.some(hc => hc.x === x && hc.y === y);

                        // Case bloquée (dans la portée de mouvement mais pas de chemin)
                        const inMoveRange = phase === 'active' && !selectedSpell && currentCombatant?.type === 'player'
                            && distanceFromPlayer <= (currentCombatant?.stats.pm || 0);
                        const isBlocked = inMoveRange && !isReachableByPM && distanceFromPlayer > 0;

                        // Case de spawn joueur
                        const isPlayerSpawn = cell.type === 'player_spawn' && phase === 'preparation';
                        const isPlayerSpawnAvailable = isPlayerSpawn && !cell.occupiedBy;

                        // Case de spawn monstre
                        const isMonsterSpawn = cell.type === 'monster_spawn' && phase === 'preparation';

                        // PM nécessaires pour atteindre cette case
                        const pmCost = pathToCell.length;

                        return (
                            <div
                                key={`${x}-${y}`}
                                onClick={() => handleCellClick(x, y)}
                                onMouseEnter={() => setHoveredCell({ x, y })}
                                onMouseLeave={() => setHoveredCell(null)}
                                className={`absolute w-12 h-12 transition-all duration-150 cursor-pointer
                                    border border-cyan-400/20
                                    ${(x + y) % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-700/20'}
                                    ${cell.type === 'obstacle' ? 'bg-stone-900/80 border-stone-600/50 cursor-not-allowed' : ''}
                                    ${isTargetable && !isInAoE ? 'bg-red-500/20 border-red-400/40 hover:bg-red-500/40 hover:border-red-400' : ''}
                                    ${isMovable ? 'bg-blue-500/40 border-blue-400/60 hover:bg-blue-500/60 hover:border-blue-300' : ''}
                                    ${isBlocked ? 'bg-stone-800/60 border-stone-600/40' : ''}
                                    ${isInAoE ? 'bg-orange-500/60 border-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.7)]' : ''}
                                    ${isPlayerSpawnAvailable ? 'bg-green-600/60 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.6)] hover:bg-green-500/80 cursor-pointer' : ''}
                                    ${isPlayerSpawn && cell.occupiedBy ? 'bg-green-800/40 border-green-600/50' : ''}
                                    ${isMonsterSpawn ? 'bg-red-600/40 border-red-400/50' : ''}
                                    ${cell.occupiedBy && phase === 'active' ? 'border-yellow-400/50' : ''}
                                `}
                                style={{
                                    left: `${x * 48}px`,
                                    top: `${y * 48}px`,
                                }}
                            >
                                {/* Indicateur de coût PM sur la case survolée */}
                                {isMovable && hoveredCell?.x === x && hoveredCell?.y === y && pmCost > 0 && (
                                    <div
                                        className="absolute inset-0 flex items-center justify-center"
                                        style={{ transform: 'rotateZ(-45deg) rotateX(-60deg)' }}
                                    >
                                        <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                                            {pmCost} PM
                                        </span>
                                    </div>
                                )}
                                {/* Indicateur case bloquée */}
                                {isBlocked && hoveredCell?.x === x && hoveredCell?.y === y && (
                                    <div
                                        className="absolute inset-0 flex items-center justify-center"
                                        style={{ transform: 'rotateZ(-45deg) rotateX(-60deg)' }}
                                    >
                                        <X size={16} className="text-red-500" />
                                    </div>
                                )}
                                {/* Indicateur spawn disponible */}
                                {isPlayerSpawnAvailable && (
                                    <div
                                        className="absolute inset-0 flex items-center justify-center"
                                        style={{ transform: 'rotateZ(-45deg) rotateX(-60deg)' }}
                                    >
                                        <div className="w-3 h-3 bg-green-400 rounded-full animate-ping" />
                                    </div>
                                )}
                            </div>
                        );
                    }))}

                    {/* Les Combattants (directement sur la grille pour l'alignement) */}
                    {combatants.filter(c => c.isAlive).map(c => (
                        <div
                            key={c.id}
                            className={`absolute transition-all duration-500 flex flex-col items-center justify-center cursor-pointer ${selectedSpell && currentCombatant?.type === 'player' ? 'hover:scale-110' : ''
                                }`}
                            style={{
                                left: `${c.gridX * 48 + 24}px`, // Centré sur la case
                                top: `${c.gridY * 48 + 24}px`,
                                width: '0',
                                height: '0',
                                transform: 'translateZ(2px)', // Légère élévation pour l'ombre
                                transformStyle: 'preserve-3d',
                                zIndex: 100 + c.gridX + c.gridY,
                                pointerEvents: 'auto'
                            }}
                            onMouseEnter={() => setHoveredCombatant(c)}
                            onMouseLeave={() => setHoveredCombatant(null)}
                            onClick={(e) => {
                                e.stopPropagation();

                                // If a spell is selected and it's player's turn, cast spell on this combatant
                                if (selectedSpell && currentCombatant && currentCombatant.type === 'player' && phase === 'active') {
                                    const distance = LysrinV4.distance(currentCombatant.gridX, currentCombatant.gridY, c.gridX, c.gridY);

                                    // Check if target is in range
                                    if (distance >= selectedSpell.minRange && distance <= selectedSpell.maxRange) {
                                        // Check target validity (enemy for offense, ally for support)
                                        const isValidTarget = (
                                            (selectedSpell.targetType === 'enemy' && c.team === 'enemy') ||
                                            (selectedSpell.targetType === 'ally' && c.team === 'player') ||
                                            (selectedSpell.targetType === 'self' && c.id === currentCombatant.id) ||
                                            (selectedSpell.targetType === 'any')
                                        );

                                        if (isValidTarget || !selectedSpell.targetType) {
                                            // Execute spell on this cell
                                            executeSpell(selectedSpell, c.gridX, c.gridY);
                                        }
                                    }
                                }
                            }}
                        >
                            {/* Billboarding: Contre-rotation pour rester vertical */}
                            <div
                                className="relative flex flex-col items-center justify-end"
                                style={{
                                    transform: 'rotateZ(-45deg) rotateX(-60deg)',
                                    transformOrigin: 'center center'
                                }}
                            >
                                {/* Shadow */}
                                <div
                                    className="absolute w-16 h-4 bg-black/40 rounded-[50%] blur-[4px]"
                                    style={{
                                        bottom: '-8px',
                                        left: '50%',
                                        transform: 'translateX(-50%)'
                                    }}
                                />

                                {/* Indicateur de base (Garantit la visibilité) */}
                                <div
                                    className={`absolute w-12 h-12 rounded-full blur-[4px] -bottom-6 ${c.team === 'player' ? 'bg-blue-500/30' : 'bg-red-500/30'
                                        }`}
                                />

                                {/* Sprite Container */}
                                <div
                                    className={`relative transition-all duration-300 ${c.isCasting ? 'scale-110 -translate-y-4' : ''}`}
                                    style={{ marginBottom: '8px' }}
                                >
                                    {/* Spectral Glow when casting */}
                                    {c.isCasting && (
                                        <div className="absolute inset-0 z-0 animate-pulse">
                                            <div className="absolute inset-0 bg-white/40 blur-[20px] rounded-full" />
                                            <div className="absolute inset-x-[-20%] top-[-20%] bottom-0 bg-cyan-400/30 blur-[15px] rounded-full animate-ping" />
                                        </div>
                                    )}

                                    {c.spriteUrl ? (
                                        <div
                                            className={`relative flex items-end justify-center ${c.isCasting ? 'animate-bounce' : ''}`}
                                            style={{
                                                width: '1px', 
                                                height: '1px',
                                                overflow: 'visible',
                                                imageRendering: 'pixelated',
                                                animationDuration: '0.4s'
                                            }}
                                        >
                                            {(() => {
                                                // Removed legacy row mapping (handled by SpritesheetAnimator animation prop)

                                                // NOUVELLE LOGIQUE V4: Spritesheets haute fidélité
                                                if (c.isSpritesheetV4) {
                                                    // Map animState to folder names (Idle, Run, etc)
                                                    const animName = c.animState === 'RUN' ? 'Run' : 
                                                                   c.animState === 'JUMP' ? 'Jump' :
                                                                   c.animState === 'ATTACK' ? 'Attack_01' :
                                                                   c.animState === 'HIT' ? 'Hit' :
                                                                   c.animState === 'DEATH' ? 'Death' : 'Idle';
                                                    
                                                    // Mapping des couleurs pour le masque
                                                    const classData = c.classId ? NARVOS_CLASSES.find(cl => cl.id === c.classId) : null;
                                                    const spriteColors = classData?.colors || { primary: '#3b82f6', secondary: '#60a5fa', skin: '#f3f4f6' };

                                                    return (
                                                        <SpritesheetAnimator
                                                            entityId={c.classId || 'monstre'}
                                                            state={
                                                                animName === 'Run' ? TiphonAnimationState.RUN :
                                                                animName === 'Jump' ? TiphonAnimationState.JUMP :
                                                                animName === 'Attack_01' ? TiphonAnimationState.ATTACK :
                                                                animName === 'Hit' ? TiphonAnimationState.HIT :
                                                                animName === 'Death' ? TiphonAnimationState.DIE :
                                                                TiphonAnimationState.IDLE
                                                            }
                                                            direction={(c.orientation as any) || 'SE'}
                                                            basePath={c.splitSpritesFolder || ""}
                                                            scale={1.8}
                                                            debug={false}
                                                            style={{
                                                                filter: c.isAlive ? 'none' : 'grayscale(100%) opacity(0.5)'
                                                            }}
                                                        />
                                                    );
                                                }

                                                // LOGIQUE V3: Recoloration dynamique avec ColoredSprite
                                                const usesSplit = !!c.splitSpritesFolder;
                                                const spriteSrc = usesSplit && c.animState && c.orientation
                                                    ? animationManager.getFrameUrl(
                                                        { classId: c.classId || '', gender: 'M', basePath: c.splitSpritesFolder! }, 
                                                        c.animState as AnimationState,
                                                        c.orientation,
                                                        c.animFrame !== undefined ? c.animFrame : globalFrame
                                                      )
                                                    : c.spriteUrl;

                                                // Récupérer les couleurs de classe si disponibles
                                                const classData = c.classId ? NARVOS_CLASSES.find(cl => cl.id === c.classId) : null;
                                                const spriteColors = classData?.colors || { primary: '#3b82f6', secondary: '#60a5fa', skin: '#f3f4f6' };

                                                return (
                                                    <ColoredSprite
                                                        src={spriteSrc || ''}
                                                        colors={{
                                                            jacket: spriteColors.primary,
                                                            pants: spriteColors.primary,
                                                            hair: spriteColors.secondary,
                                                            eyes: spriteColors.secondary,
                                                            skin: spriteColors.skin
                                                        }}
                                                        className="relative max-w-none transition-none"
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            transform: 'translateY(-10%) scale(1.5)',
                                                            filter: c.isAlive ? 'none' : 'grayscale(100%) opacity(0.5)'
                                                        }}
                                                        alt={c.name}
                                                    />
                                                );
                                            })()}
                                        </div>
                                    ) : (
                                        <div className={`w-14 h-14 rounded-full shadow-lg border-2 border-white ${c.team === 'player' ? 'bg-gradient-to-br from-blue-400 to-blue-700' : 'bg-gradient-to-br from-red-400 to-red-700'}`}>
                                            <span className="flex items-center justify-center h-full text-white font-bold text-sm">
                                                {c.name.substring(0, 2).toUpperCase()}
                                            </span>
                                        </div>
                                    )}

                                    {/* HP Mini Bar */}
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-14 h-2 bg-stone-900/80 rounded-full overflow-hidden border border-black/60 shadow-md">
                                        <div
                                            className={`h-full transition-all duration-500 ${c.team === 'player' ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-red-400 to-red-600'}`}
                                            style={{ width: `${(c.stats.hp / c.stats.maxHp) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Damage/Heal Preview Overlay */}
                                {damagePreview && damagePreview.targets.includes(c.id) && (
                                    <div className={`absolute -top-20 left-1/2 -translate-x-1/2 z-[60] font-black text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,1)] animate-pulse ${damagePreview.type === 'damage' ? 'text-red-500' : 'text-green-400'}`}>
                                        {damagePreview.type === 'damage' ? '-' : '+'}{damagePreview.value}
                                    </div>
                                )}



                                {/* Name Tag */}
                                <div className="mt-1 bg-black/80 text-white text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap border border-white/30 shadow-xl font-bold">
                                    {c.name}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Projectiles */}
                    {activeProjectiles.map(p => (
                        <SpellProjectile key={p.id} {...p} duration={500} />
                    ))}

                    {/* Active Spell Animations (Moved outside combatants loop) */}
                    {activeAnimations.map(anim => (
                        <SpellAnimationOverlay
                            key={anim.id}
                            config={anim.config}
                            gridX={anim.gridX}
                            gridY={anim.gridY}
                            onComplete={() => {
                                setActiveAnimations(prev => prev.filter(a => a.id !== anim.id));
                            }}
                        />
                    ))}

                    {/* Floating Texts */}
                    {floatingTexts.map(t => (
                        <FloatingText key={t.id} {...t} />
                    ))}
                </div>

                {/* Preparation Controls */}
                {
                    phase === 'preparation' && (
                        <div className="absolute inset-x-0 bottom-32 flex flex-col items-center gap-4 animate-in slide-in-from-bottom duration-500 pointer-events-auto z-[200]">
                            <div className="text-white font-black text-2xl tracking-[0.3em] uppercase drop-shadow-md">Phase de Préparation</div>
                            <div className="text-yellow-400 text-lg font-mono drop-shadow-md bg-black/40 px-4 py-1 rounded-full border border-stone-600">Placez-vous... {Math.floor(combatState.preparationTimeRemaining || 0)}s</div>
                            <button
                                onClick={() => setCombatState(prev => ({ ...prev, phase: 'active' }))}
                                className="px-12 py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest rounded-lg shadow-2xl border-b-4 border-red-800 hover:border-b-2 hover:translate-y-[2px] transform transition-all active:scale-95"
                            >
                                Prêt !
                            </button>
                        </div>
                    )
                }

                {/* Active Turn HUD */}
                {
                    phase === 'active' && currentCombatant && (
                        <div className="absolute inset-0 pointer-events-none">
                            {/* Turn Timer Display */}
                            <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center z-[50]">
                                <div className={`text-4xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${(combatState.turnTimeRemaining || 0) <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                                    {combatState.turnTimeRemaining || 0}
                                </div>
                                <div className="text-[10px] text-white/80 uppercase tracking-widest bg-black/40 px-2 rounded">Temps Restant</div>
                            </div>

                            <div className="pointer-events-auto">
                                {currentCombatant.type === 'player' ? (
                                    <SpellBar
                                        combatant={currentCombatant}
                                        selectedSpellId={selectedSpell?.id}
                                        onSelect={setSelectedSpell}
                                    />
                                ) : (
                                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-900/40 p-4 rounded-xl border border-red-500/30 backdrop-blur-md animate-pulse">
                                        <span className="text-white font-black uppercase tracking-widest">Au tour de {currentCombatant.name}...</span>
                                    </div>
                                )}

                                {/* End Turn Button for Player */}
                                {currentCombatant.type === 'player' && (
                                    <div className="absolute bottom-8 right-8 flex gap-3 z-[200]">
                                        {/* Abandon Combat Button */}
                                        <button
                                            onClick={() => setShowAbandonModal(true)}
                                            className="px-6 py-4 bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-black uppercase tracking-tighter rounded-xl border-2 border-red-500/50 shadow-2xl flex items-center gap-2 transition-all hover:scale-105"
                                        >
                                            <X size={20} />
                                            Abandonner
                                        </button>
                                        {/* End Turn Button */}
                                        <button
                                            onClick={handleEndTurn}
                                            className="px-8 py-4 bg-gradient-to-b from-stone-100 to-stone-300 hover:from-white hover:to-stone-200 text-stone-900 font-black uppercase tracking-tighter rounded-xl border-2 border-stone-400/50 shadow-2xl transition-all hover:scale-105"
                                        >
                                            Passer mon tour
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }

                {/* Combatant Tooltip (Dofus-style) - Works for both players and monsters */}
                {hoveredCombatant && (
                    <div
                        className="fixed top-1/4 left-8 z-[500] pointer-events-none animate-in slide-in-from-left duration-200"
                        style={{ minWidth: '280px' }}
                    >
                        <div className={`bg-gradient-to-br from-stone-900/95 via-stone-800/95 to-stone-900/95 border rounded-xl shadow-2xl overflow-hidden backdrop-blur-md ${hoveredCombatant.team === 'player' ? 'border-blue-500/50' : 'border-red-500/50'
                            }`}>
                            {/* Header with Name and Level */}
                            <div className={`flex items-center gap-3 p-3 border-b border-stone-700/50 ${hoveredCombatant.team === 'player'
                                ? 'bg-gradient-to-r from-blue-900/40 to-transparent'
                                : 'bg-gradient-to-r from-red-900/40 to-transparent'
                                }`}>
                                {/* Portrait */}
                                <div className={`relative w-16 h-16 rounded-lg bg-stone-800 border-2 overflow-hidden flex-shrink-0 ${hoveredCombatant.team === 'player' ? 'border-blue-500' : 'border-red-500'
                                    }`}>
                                    {hoveredCombatant.spriteUrl && (
                                        <img
                                            src={hoveredCombatant.spriteUrl}
                                            alt={hoveredCombatant.name}
                                            className="w-full h-full object-contain"
                                            style={{ imageRendering: 'pixelated' }}
                                        />
                                    )}
                                    {/* Level Badge */}
                                    <div className={`absolute -bottom-1 -right-1 text-[10px] font-black px-1.5 py-0.5 rounded-full border shadow ${hoveredCombatant.team === 'player'
                                        ? 'bg-blue-500 text-white border-blue-300'
                                        : 'bg-yellow-500 text-black border-yellow-300'
                                        }`}>
                                        Niv. {hoveredCombatant.stats.niveau || 1}
                                    </div>
                                </div>

                                {/* Name and HP */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-black text-sm tracking-wide">{hoveredCombatant.name}</span>
                                        {hoveredCombatant.team === 'player' && (
                                            <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">ALLIÉ</span>
                                        )}
                                        {hoveredCombatant.type === 'player' && hoveredCombatant.id === 'player' && (
                                            <span className="text-[9px] bg-green-600 text-white px-1.5 py-0.5 rounded font-bold">VOUS</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Heart size={12} className="text-red-400" />
                                        <span className="text-green-400 font-bold text-xs">
                                            {hoveredCombatant.stats.hp} / {hoveredCombatant.stats.maxHp}
                                        </span>
                                        <span className="text-stone-500 text-[10px]">
                                            ({Math.floor((hoveredCombatant.stats.hp / hoveredCombatant.stats.maxHp) * 100)}%)
                                        </span>
                                    </div>
                                    {/* HP Bar */}
                                    <div className="w-full h-2 bg-stone-700 rounded-full mt-1 overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-300 ${hoveredCombatant.team === 'player'
                                                ? 'bg-gradient-to-r from-green-500 to-green-400'
                                                : 'bg-gradient-to-r from-red-500 to-red-400'
                                                }`}
                                            style={{ width: `${(hoveredCombatant.stats.hp / hoveredCombatant.stats.maxHp) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="p-3 grid grid-cols-3 gap-2 text-[10px]">
                                {/* PA */}
                                <div className="flex items-center gap-1.5 bg-blue-900/30 rounded px-2 py-1">
                                    <Zap size={12} className="text-blue-400" />
                                    <span className="text-blue-300 font-bold">{hoveredCombatant.stats.pa} PA</span>
                                </div>
                                {/* PM */}
                                <div className="flex items-center gap-1.5 bg-green-900/30 rounded px-2 py-1">
                                    <ArrowRight size={12} className="text-green-400" />
                                    <span className="text-green-300 font-bold">{hoveredCombatant.stats.pm} PM</span>
                                </div>
                                {/* Initiative */}
                                <div className="flex items-center gap-1.5 bg-yellow-900/30 rounded px-2 py-1">
                                    <Star size={12} className="text-yellow-400" />
                                    <span className="text-yellow-300 font-bold">{hoveredCombatant.stats.initiative}</span>
                                </div>
                                {/* Puissance */}
                                <div className="flex items-center gap-1.5 bg-red-900/30 rounded px-2 py-1">
                                    <Swords size={12} className="text-red-400" />
                                    <span className="text-red-300 font-bold">{hoveredCombatant.stats.puissance}</span>
                                </div>
                                {/* Critique */}
                                <div className="flex items-center gap-1.5 bg-orange-900/30 rounded px-2 py-1">
                                    <span className="text-orange-400 font-bold">⚡</span>
                                    <span className="text-orange-300 font-bold">{hoveredCombatant.stats.critique}%</span>
                                </div>
                                {/* Parade */}
                                <div className="flex items-center gap-1.5 bg-stone-700/50 rounded px-2 py-1">
                                    <Shield size={12} className="text-stone-400" />
                                    <span className="text-stone-300 font-bold">{hoveredCombatant.stats.parade || 0}</span>
                                </div>
                            </div>

                            {/* Resistances */}
                            <div className="px-3 pb-3 flex gap-1.5 flex-wrap">
                                {Object.entries(hoveredCombatant.stats.resistances || {}).map(([element, value]) => (
                                    <div
                                        key={element}
                                        className={`px-2 py-0.5 rounded text-[9px] font-bold ${element === 'eau' ? 'bg-blue-800/50 text-blue-300' :
                                            element === 'feu' ? 'bg-red-800/50 text-red-300' :
                                                element === 'air' ? 'bg-cyan-800/50 text-cyan-300' :
                                                    element === 'terre' ? 'bg-amber-800/50 text-amber-300' :
                                                        'bg-stone-700/50 text-stone-300'
                                            }`}
                                    >
                                        {element}: {value as number > 0 ? '+' : ''}{value as number}%
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Combat Log Mini */}
                <div className="absolute top-20 right-8 w-64 h-48 bg-black/40 border border-white/5 rounded-lg p-2 overflow-hidden flex flex-col-reverse text-[10px] gap-1 pointer-events-none">
                    {(combatState.log || []).slice(0, 8).map((log, i) => (
                        <div key={i} className="text-stone-400 border-l-2 border-stone-700 pl-2 py-0.5">
                            {log.text}
                        </div>
                    ))}
                </div>

                {/* Grid Cursor Info */}
                {
                    hoveredCell && (
                        <div className="absolute bottom-4 left-4 text-[10px] text-stone-500 font-mono">
                            COORD: [{hoveredCell.x}, {hoveredCell.y}] | TYPE: {grid.cells[hoveredCell.y][hoveredCell.x].type || 'unknown'}
                        </div>
                    )
                }
            </div>
        </div>
    );
};


