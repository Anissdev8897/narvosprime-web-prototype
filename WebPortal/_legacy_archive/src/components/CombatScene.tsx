
import React, { useState, useEffect, useRef } from 'react';
import { CharacterState, EntityStats, MonsterData, Spell, ClassData, CombatantStats } from '../types';
import { MONSTER_BANK } from '../narvos-data';
import { Heart, Zap, Footprints, Shield, Sword, XCircle, PlayCircle, Skull } from 'lucide-react';

interface CombatEntity {
    instanceId: string;
    type: 'player' | 'monster';
    name: string;
    level: number;
    stats: CombatantStats;
    pos: { x: number; y: number }; // Grid coordinates 0-11
    spells: Spell[];
    spriteUrl?: string;
    cssComponent?: React.FC<any>;
    team: 'A' | 'B'; // A = Player, B = Enemy
    classColors?: any;
    isDead: boolean;
}

interface Props {
    player: CharacterState;
    playerClass: ClassData;
    playerSprite: string | null;
    monsters: { id: string, monsterId: string }[]; // Monsters to fight
    onCombatEnd: (victory: boolean) => void;
}

const GRID_SIZE = 12;
const CELL_SIZE = 50; // px (scaled via transform)

export const CombatScene: React.FC<Props> = ({ player, playerClass, playerSprite, monsters, onCombatEnd }) => {
    const [entities, setEntities] = useState<CombatEntity[]>([]);
    const [turnIndex, setTurnIndex] = useState(0);
    const [turnCount, setTurnCount] = useState(1);
    const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);
    const [combatLog, setCombatLog] = useState<string[]>(["Combat lancé !"]);
    const [spellAnim, setSpellAnim] = useState<{ x: number, y: number, color: string, type: string } | null>(null);

    // Init Combat
    useEffect(() => {
        const initialEntities: CombatEntity[] = [];

        // 1. Add Player
        initialEntities.push({
            instanceId: 'player',
            type: 'player',
            name: player.name,
            level: 20, // Mock level
            stats: {
                hp: 200, maxHp: 200, pa: 6, maxPa: 6, pm: 3, maxPm: 3,
                puissance: 10, initiative: 100, critique: 5,
                dommages: 0, domCritique: 0, domMelee: 0, domDistance: 0,
                esquive: 0, parade: 0, resMelee: 0, resDistance: 0,
                maitrise: {}, resistances: {}, vitesse: 1,
                niveau: 20, experience: 0, experienceMax: 1000
            },
            pos: { x: 2, y: 6 },
            spells: playerClass.spells,
            spriteUrl: playerSprite || undefined,
            team: 'A',
            classColors: player.colors,
            isDead: false
        });

        // 2. Add Monsters
        monsters.forEach((mInstance, idx) => {
            const data = MONSTER_BANK.find((m: any) => m.id === mInstance.monsterId);
            if (data) {
                initialEntities.push({
                    instanceId: mInstance.id,
                    type: 'monster',
                    name: `${data.name} ${idx + 1}`,
                    level: data.level,
                    stats: {
                        ...data.stats,
                        maxPa: (data.stats as any).pa || 6,
                        maxPm: (data.stats as any).pm || 3,
                        dommages: 0, domCritique: 0, domMelee: 0, domDistance: 0,
                        esquive: 0, parade: 0, resMelee: 0, resDistance: 0,
                        maitrise: {}, resistances: {}, vitesse: 1,
                        niveau: data.level, experience: 0, experienceMax: 1000
                    } as any,
                    pos: { x: 9 - (Math.floor(idx / 2)), y: 4 + (idx * 2) }, // Scatter positions
                    spells: data.spells,
                    cssComponent: (data as any).cssComponent,
                    spriteUrl: data.spriteUrl,
                    team: 'B',
                    isDead: false
                });
            }
        });

        setEntities(initialEntities);
    }, []);

    const currentEntity = entities[turnIndex];
    const isPlayerTurn = currentEntity?.type === 'player' && !currentEntity.isDead;

    // --- TURN LOGIC ---

    const nextTurn = () => {
        // Reset AP/MP of ending turn entity
        setEntities(prev => prev.map((e, i) => {
            if (i === turnIndex) {
                return { ...e, stats: { ...e.stats, pa: e.stats.maxPa, pm: e.stats.maxPm } };
            }
            return e;
        }));

        // Find next living entity
        let nextIdx = (turnIndex + 1) % entities.length;
        let loopCount = 0;
        while (entities[nextIdx].isDead && loopCount < entities.length) {
            nextIdx = (nextIdx + 1) % entities.length;
            loopCount++;
        }

        if (loopCount >= entities.length) return; // Everyone dead?

        if (nextIdx === 0) setTurnCount(c => c + 1);
        setTurnIndex(nextIdx);
        setSelectedSpell(null);
    };

    // Check Victory/Defeat
    useEffect(() => {
        if (entities.length === 0) return;
        const livingPlayers = entities.filter(e => e.team === 'A' && !e.isDead);
        const livingMonsters = entities.filter(e => e.team === 'B' && !e.isDead);

        if (livingPlayers.length === 0) {
            setTimeout(() => onCombatEnd(false), 1000);
        } else if (livingMonsters.length === 0) {
            setTimeout(() => onCombatEnd(true), 1000);
        }
    }, [turnIndex, entities]);

    // --- AI LOGIC (Simple) ---
    useEffect(() => {
        if (!currentEntity || currentEntity.isDead) return;
        if (currentEntity.type === 'monster') {
            const aiTimeout = setTimeout(async () => {
                await playAITurn(currentEntity);
                nextTurn();
            }, 1000);
            return () => clearTimeout(aiTimeout);
        }
    }, [turnIndex]);

    const playAITurn = async (monster: CombatEntity) => {
        const target = entities.find(e => e.team === 'A' && !e.isDead);
        if (!target) return;

        // 1. Move towards target
        let currentPos = { ...monster.pos };
        let remainingPm = monster.stats.pm;

        // Simple pathfinding: reduce distance X then Y
        while (remainingPm > 0) {
            const dx = target.pos.x - currentPos.x;
            const dy = target.pos.y - currentPos.y;
            const dist = Math.abs(dx) + Math.abs(dy);

            if (dist <= 1) break; // In melee range

            let nextX = currentPos.x;
            let nextY = currentPos.y;

            if (Math.abs(dx) > Math.abs(dy)) {
                nextX += Math.sign(dx);
            } else {
                nextY += Math.sign(dy);
            }

            // Check collision
            if (!entities.some(e => e.pos.x === nextX && e.pos.y === nextY && !e.isDead)) {
                currentPos = { x: nextX, y: nextY };
                remainingPm--;
            } else {
                break; // Blocked
            }
        }

        // Apply Movement
        setEntities(prev => prev.map(e => e.instanceId === monster.instanceId ? { ...e, pos: currentPos, stats: { ...e.stats, pm: remainingPm } } : e));

        // 2. Attack if possible
        await new Promise(r => setTimeout(r, 500)); // Small pause
        const distToTarget = Math.abs(target.pos.x - currentPos.x) + Math.abs(target.pos.y - currentPos.y);
        const spell = monster.spells.find(s => {
            const range = s.maxRange || s.range || 0;
            const cost = s.paCost || s.apCost || 0;
            return range >= distToTarget && cost <= monster.stats.pa;
        });

        if (spell) {
            castSpell(monster, target, spell);
        }
    };

    // --- ACTIONS ---

    const moveEntity = (x: number, y: number) => {
        if (!isPlayerTurn) return;
        const dx = Math.abs(currentEntity.pos.x - x);
        const dy = Math.abs(currentEntity.pos.y - y);
        const dist = dx + dy;

        if (dist === 0) return;
        if (dist > currentEntity.stats.pm) {
            log("Trop loin !");
            return;
        }

        // Check occupancy
        if (entities.some(e => e.pos.x === x && e.pos.y === y && !e.isDead)) {
            log("Case occupée !");
            return;
        }

        // Update Position
        setEntities(prev => prev.map(e => {
            if (e.instanceId === currentEntity.instanceId) {
                return {
                    ...e,
                    pos: { x, y },
                    stats: { ...e.stats, pm: e.stats.pm - dist }
                };
            }
            return e;
        }));
    };

    const handleGridClick = (x: number, y: number) => {
        if (!isPlayerTurn) return;

        // If spell selected, try cast
        if (selectedSpell) {
            const target = entities.find(e => e.pos.x === x && e.pos.y === y && !e.isDead);
            if (target) {
                castSpell(currentEntity, target, selectedSpell);
                setSelectedSpell(null);
            } else {
                // Cast on empty cell? (Not supported for now except area)
                log("Cible invalide.");
            }
            return;
        }

        // Else move
        moveEntity(x, y);
    };

    const castSpell = (caster: CombatEntity, target: CombatEntity, spell: Spell) => {
        // Range check
        const dist = Math.abs(caster.pos.x - target.pos.x) + Math.abs(caster.pos.y - target.pos.y);
        const maxRange = spell.maxRange || spell.range || 0;
        if (dist > maxRange) {
            if (caster.type === 'player') log("Hors de portée !");
            return;
        }

        // AP Check
        const cost = spell.paCost || spell.apCost || 0;
        if (caster.stats.pa < cost) {
            if (caster.type === 'player') log("Pas assez de PA !");
            return;
        }

        // Visual
        setSpellAnim({ x: target.pos.x, y: target.pos.y, color: spell.color, type: spell.effectType || 'projectile' });
        setTimeout(() => setSpellAnim(null), 500);

        // Logic
        const minDmg = spell.damage?.min || 0;
        const maxDmg = spell.damage?.max || 0;
        const dmg = Math.floor(Math.random() * (maxDmg - minDmg + 1)) + minDmg;

        setEntities(prev => prev.map(e => {
            // Deduct AP from Caster
            if (e.instanceId === caster.instanceId) {
                const cost = spell.paCost || spell.apCost || 0;
                return { ...e, stats: { ...e.stats, pa: e.stats.pa - cost } };
            }
            // Deal Damage to Target (or Heal)
            if (e.instanceId === target.instanceId) {
                let newHp = e.stats.hp;
                if (spell.damage?.element === 'heal') {
                    newHp = Math.min(e.stats.maxHp, e.stats.hp + dmg);
                    log(`${caster.name} soigne ${target.name} de ${dmg} PV !`);
                } else {
                    newHp = Math.max(0, e.stats.hp - dmg);
                    log(`${caster.name} lance ${spell.name} et inflige ${dmg} dégâts à ${target.name} !`);
                }
                const dead = newHp <= 0;
                if (dead) log(`${target.name} est mort !`);
                return { ...e, isDead: dead, stats: { ...e.stats, hp: newHp } };
            }
            return e;
        }));
    };

    const log = (msg: string) => {
        setCombatLog(prev => [msg, ...prev].slice(0, 5));
    };

    // --- RENDERERS ---

    const getCellColor = (x: number, y: number) => {
        const isOdd = (x + y) % 2 === 1;

        // Highlight range if spell selected
        if (selectedSpell && isPlayerTurn) {
            const dist = Math.abs(currentEntity.pos.x - x) + Math.abs(currentEntity.pos.y - y);
            const range = selectedSpell.maxRange || selectedSpell.range || 0;
            if (dist <= range && dist >= (selectedSpell.minRange || 0)) {
                return 'bg-blue-500/30 cursor-crosshair';
            }
        }
        // Highlight MP range
        if (!selectedSpell && isPlayerTurn) {
            const dist = Math.abs(currentEntity.pos.x - x) + Math.abs(currentEntity.pos.y - y);
            if (dist <= currentEntity.stats.pm) {
                return 'bg-green-500/20 cursor-pointer hover:bg-green-500/40';
            }
        }

        return isOdd ? 'bg-white/5' : 'bg-transparent';
    };

    return (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
            {/* --- COMBAT UI --- */}

            {/* GRID CONTAINER */}
            <div className="relative" style={{ width: GRID_SIZE * CELL_SIZE, height: GRID_SIZE * CELL_SIZE }}>
                {/* GRID CELLS */}
                <div className="absolute inset-0 grid grid-cols-12 grid-rows-12 border-2 border-stone-600 bg-stone-900/80 shadow-2xl">
                    {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                        const x = i % GRID_SIZE;
                        const y = Math.floor(i / GRID_SIZE);
                        return (
                            <div
                                key={i}
                                onClick={() => handleGridClick(x, y)}
                                className={`border border-white/5 transition-colors ${getCellColor(x, y)}`}
                            ></div>
                        );
                    })}
                </div>

                {/* ENTITIES */}
                {entities.filter(e => !e.isDead).map(ent => (
                    <div
                        key={ent.instanceId}
                        className="absolute transition-all duration-300 ease-in-out flex items-center justify-center"
                        style={{
                            width: CELL_SIZE,
                            height: CELL_SIZE,
                            left: ent.pos.x * CELL_SIZE,
                            top: ent.pos.y * CELL_SIZE,
                            zIndex: 10 + ent.pos.y
                        }}
                    >
                        {/* Sprite */}
                        <div className={`relative w-12 h-16 -mt-8 ${ent.instanceId === currentEntity.instanceId ? 'scale-110 drop-shadow-[0_0_5px_white]' : ''}`}>
                            {ent.type === 'player' && ent.spriteUrl ? (
                                <img src={ent.spriteUrl} className="w-full h-full object-cover scale-[2] image-pixelated" style={{ objectPosition: 'top' }} />
                            ) : ent.cssComponent ? (
                                <ent.cssComponent />
                            ) : (
                                <div className={`w-8 h-8 rounded-full ${ent.team === 'A' ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                            )}

                            {/* HP Bar */}
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-black rounded-full overflow-hidden border border-black">
                                <div className="h-full bg-red-500" style={{ width: `${(ent.stats.hp / ent.stats.maxHp) * 100}%` }}></div>
                            </div>
                        </div>

                        {/* Turn Indicator */}
                        {ent.instanceId === currentEntity.instanceId && (
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 animate-bounce">
                                <div className="bg-yellow-400 w-4 h-4 rounded-full shadow-[0_0_10px_yellow]"></div>
                            </div>
                        )}
                    </div>
                ))}

                {/* SPELL ANIMATION */}
                {spellAnim && (
                    <div
                        className="absolute w-[50px] h-[50px] flex items-center justify-center z-[100] animate-ping"
                        style={{ left: spellAnim.x * CELL_SIZE, top: spellAnim.y * CELL_SIZE }}
                    >
                        <div className="w-full h-full rounded-full opacity-75" style={{ backgroundColor: spellAnim.color }}></div>
                    </div>
                )}
            </div>

            {/* --- HUD --- */}

            {/* Timeline */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-stone-900 border border-stone-600 p-2 rounded-lg flex gap-2 shadow-lg">
                {entities.filter(e => !e.isDead).map((ent, i) => (
                    <div key={ent.instanceId} className={`w-8 h-8 rounded border-2 overflow-hidden ${turnIndex === i ? 'border-yellow-400 scale-110' : 'border-stone-600 opacity-70'}`}>
                        <div className={`w-full h-full ${ent.team === 'A' ? 'bg-blue-900' : 'bg-red-900'} flex items-center justify-center text-[10px] font-bold text-white`}>
                            {ent.name.substring(0, 2)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Turn Bar (Bottom) */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[600px] h-[80px] bg-stone-900 border-2 border-stone-600 rounded-xl flex items-center px-4 gap-4 shadow-2xl">
                {/* Stats */}
                <div className="flex flex-col gap-1 w-24">
                    <div className="flex items-center gap-1 text-red-500 font-bold"><Heart size={14} fill="currentColor" /> {currentEntity.stats.hp}</div>
                    <div className="flex items-center gap-1 text-blue-400 font-bold"><Zap size={14} fill="currentColor" /> {currentEntity.stats.pa} PA</div>
                    <div className="flex items-center gap-1 text-green-500 font-bold"><Footprints size={14} fill="currentColor" /> {currentEntity.stats.pm} PM</div>
                </div>

                {/* Spells */}
                <div className="flex-1 flex justify-center gap-2">
                    {currentEntity.spells.map((spell, i) => (
                        <button
                            key={spell.id}
                            disabled={!isPlayerTurn || currentEntity.stats.pa < (spell.paCost || spell.apCost || 0)}
                            onClick={() => isPlayerTurn && setSelectedSpell(spell)}
                            className={`w-12 h-12 bg-stone-800 border-2 rounded hover:scale-105 transition-transform flex flex-col items-center justify-center relative group ${selectedSpell?.id === spell.id ? 'border-yellow-400 shadow-[0_0_10px_orange]' : 'border-stone-600'}`}
                        >
                            <div className="text-white font-bold text-xs">{spell.name.substring(0, 3)}</div>
                            <div className="absolute -top-2 -right-2 w-5 h-5 bg-blue-600 rounded-full text-[10px] flex items-center justify-center border border-white text-white font-bold">{spell.paCost || spell.apCost}</div>

                            {/* Tooltip */}
                            <div className="absolute bottom-14 bg-black/90 text-white text-xs p-2 rounded w-32 hidden group-hover:block pointer-events-none z-50 border border-stone-500">
                                <div className="font-bold text-yellow-400">{spell.name}</div>
                                <div>{spell.description}</div>
                                <div className="text-stone-400 mt-1">Dégâts: {spell.damage?.min || 0}-{spell.damage?.max || 0} ({spell.damage?.element || 'neutre'})</div>
                                <div className="text-stone-400">Portée: {spell.maxRange || spell.range}</div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* End Turn */}
                <button
                    onClick={nextTurn}
                    disabled={!isPlayerTurn}
                    className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 rounded border-2 border-orange-800 disabled:opacity-50 disabled:grayscale"
                >
                    Fin de tour
                </button>
            </div>

            {/* Combat Log */}
            <div className="absolute top-20 right-4 w-64 bg-black/70 p-2 rounded border border-stone-700 text-xs text-stone-300 font-mono h-32 overflow-hidden pointer-events-none">
                {combatLog.map((log, i) => (
                    <div key={i} className="mb-1 border-b border-white/10 pb-0.5">{log}</div>
                ))}
            </div>

        </div>
    );
};
