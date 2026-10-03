/**
 * @deprecated LEGACY — GameWorld 2D iso (style Wakfu/Dofus).
 *
 * Ce composant est conservé temporairement pour ne pas casser les imports
 * de CombatScene / TacticalCombatScene qui en dépendent.
 *
 * REMPLACÉ PAR : GameWorld3D (FPS Halo-style avec FPSPlayer + ViewModelFPS).
 *
 * À FAIRE :
 *   1. Migrer les imports utiles (utils 2D, helpers) vers les composants combat
 *   2. Supprimer ce fichier (148 KB / 2935 lignes de code mort)
 *   3. Voir README_AUDIT_SYSTEMS.md section 3 pour la liste complète.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CharacterState, ClassData, MapProp, SavedCharacter, SavedMap, Item, Merchant } from '../types';
import { Heart, Star, Settings, Shield, Map as MapIcon, X, Bug, Sun, Loader2, Package, Plus, Minus, Trash2, MousePointer2, Move, ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Skull, Maximize2, RotateCw, GripVertical, Sparkles, Zap, Swords, LogOut, Menu, Save, Coins, ShoppingCart } from 'lucide-react';
import { makeImageTransparent } from '../utils';
import { getSavedMap, saveMap, getSavedObjects, saveObjectToBank, getFactionMaps, saveFactionMap, deleteFactionMap, saveCharacter, getSpellsByClassId, syncSpellsFromData, getAllMaps, getSavedMerchant, getSavedRegionMapByKey, saveRegionMap, getRegionMapKey } from '../utils/storage';
import { NarvosEngine } from '../utils/NarvosEngine';
import { MONSTER_BANK, NARVOS_CLASSES, PROP_FOLDERS, SPELL_FOLDERS } from '../narvos-data';
import { CombatScene } from './CombatScene';
import { TacticalCombatScene } from './TacticalCombatScene';
import { useCharacterController } from '../hooks/useCharacterController';
import type { CombatantStats, Inventory, Equipment, Spell, EquipmentSlot } from '../types';
import { NARVOS_REGIONS as REGIONS } from '../data/narvos-regions';
import { Region, City } from '../types';
import type { RegionMapType } from '../types/game.types';
import { MAX_MAPS_VILLE, MAX_MAPS_EXTERIEUR, MAX_MAPS_DONJON } from '../types/game.types';
import { useGameMenus, CharacterMenu, SpellMenu, InventoryMenu } from './GameMenus';
import { ColoredSprite } from './ColoredSprite';
import { SpritesheetAnimator } from './SpritesheetAnimator';
import { audioManager } from '../utils/AudioManager';
import { getSavedMerchants } from '../utils/storage';
import { MerchantMenu } from './MerchantMenu';
import { InteractionBubble } from './InteractionBubble';
import { DialogueSystem, DialogueTree, DialogueAction, MONSTER_DIALOGUES, NPC_DIALOGUES } from './DialogueSystem';
import { DEFAULT_MERCHANTS, getMerchantById } from '../data/narvos-npcs';
import { STATIC_ITEMS } from '../data/static-data';
import { MapGrid } from '../engine/MapGrid';
import { DisplayManager, RenderableEntity } from '../engine/DisplayManager';
import { AnimationState, EntityDirection } from './SpritesheetAnimator';

interface Props {
    character: CharacterState | SavedCharacter;
    classData: ClassData;
    spriteUrl: string | null;
    onExit: () => void;
    apiKey: string;
    backupApiKey?: string;
    processedMonsterBank?: any[];
    activeCharacterId?: string | null;
    username?: string | null;
    role?: string | null;
    serverId?: string;
    serverType?: 'NORMAL' | 'HEROIC'; // Heroic = permadeath mode
}

// Added 'monster' type to MapProp
// Extended MapProp to include monster data and other web-specific fields
interface ExtendedMapProp extends MapProp {
    isAlive?: boolean;
    imageUrl?: string;
    monsterId?: string;
    variant?: number;
    targetMap?: { x: number; y: number };
    teleportCost?: number;
    droppedItemData?: Item;
    // Aggro & Interaction System
    aggroRadius?: number; // % of screen distance, default 0 (passive)
    isAggressive?: boolean;
    canTalk?: boolean;
    canBuy?: boolean;
    canSell?: boolean;
    npcName?: string;
    dialogue?: string[];
    merchantId?: string; // For linking to merchant data
}

// ... (CssTree, CssRock, CssZaap components remain same, omitting for brevity to focus on integration) ...
const CssTree = ({ scale = 1, variant = 1 }: { scale?: number, variant?: number }) => (
    <div className="relative w-full h-full" style={{ transform: `scale(${scale})` }}>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-6 bg-black/20 rounded-[50%] blur-sm" />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-16 bg-[#5d4037] rounded-sm" />
        {variant === 1 ? (
            <>
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-[#4a7c18] rounded-full shadow-inner" />
                <div className="absolute bottom-20 left-1/2 -translate-x-2/3 w-20 h-20 bg-[#558b2f] rounded-full shadow-lg" />
            </>
        ) : (
            <>
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-28 h-20 bg-[#33691e] rounded-[40%] shadow-inner" />
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-24 h-24 bg-[#4a7c18] rounded-full shadow-lg" />
            </>
        )}
    </div>
);

const CssRock = ({ scale = 1 }) => (
    <div className="relative w-full h-full" style={{ transform: `scale(${scale})` }}>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-4 bg-black/20 rounded-[50%] blur-sm" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-8 bg-[#78909c] rounded-lg rounded-tl-[20px]" />
    </div>
);

const CssZaap = () => (
    <div className="relative w-full h-full flex items-end justify-center">
        <div className="absolute bottom-0 w-32 h-8 bg-black/30 rounded-[50%] blur-md" />
        <div className="absolute bottom-0 w-28 h-4 bg-[#5d4037] rounded" />
        <div className="absolute bottom-2 w-24 h-32 border-[12px] border-[#a1887f] rounded-t-full bg-[#3e2723] overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-200 via-cyan-500 to-blue-900 opacity-80 animate-pulse"></div>
        </div>
    </div>
);

const CssPortal = () => (
    <div className="relative w-full h-full flex items-center justify-center">
        <div className="absolute inset-0 animate-spin-slow opacity-50 border-4 border-dashed border-blue-400 rounded-full" />
        <div className="w-4/5 h-4/5 bg-blue-500/20 backdrop-blur-sm border-2 border-blue-400 rounded-full animate-pulse flex items-center justify-center">
            <Sparkles size={16} className="text-blue-300 animate-bounce" />
        </div>
        <div className="absolute -bottom-2 w-16 h-4 bg-black/20 rounded-[50%] blur-sm" />
    </div>
);

const INITIAL_PROPS: ExtendedMapProp[] = [];

const FACTION_MAPS_PRESETS = [
    { id: 'preset_forest', name: 'Forêt Céleste', theme: 'forest', imageUrl: '', prompt: 'Lush green celestial forest, Dofus style, vibrant colors' },
    { id: 'preset_mushroom', name: 'Forêt des Mycéliums', theme: 'alien', imageUrl: '', prompt: 'Giant purple mushrooms forest, magical bioluminescence, Wakfu style' },
    { id: 'preset_desert', name: 'Désert Aride', theme: 'desert', imageUrl: '', prompt: 'Arid desert dunes, ancient ruins, sun bleached rocks, Dofus style' },
    { id: 'preset_ice', name: 'Toundra Glacée', theme: 'ice', imageUrl: '', prompt: 'Frozen tundra, ice crystals, snow covered pine trees, winter fantasy' }
];

export const GameWorld: React.FC<Props> = ({
    character,
    classData,
    spriteUrl,
    onExit,
    apiKey,
    backupApiKey,
    processedMonsterBank = MONSTER_BANK,
    activeCharacterId = null,
    username = null,
    role = null,
    serverId,
    serverType = 'NORMAL'
}) => {
    // Navigation State
    const [mapCoords, setMapCoords] = useState({ x: 0, y: 0 });
    const [position, setPosition] = useState(character.lastPosition || { x: 50, y: 50 });
    const [target, setTarget] = useState(character.lastPosition || { x: 50, y: 50 });
    const [isMoving, setIsMoving] = useState(false);
    const [frame, setFrame] = useState(0);
    const [showDebug, setShowDebug] = useState(false);

    // Map Content State
    const [worldProps, setWorldProps] = useState<ExtendedMapProp[]>(INITIAL_PROPS);
    const [mapBgUrl, setMapBgUrl] = useState<string | null>(null);
    const [isGeneratingMap, setIsGeneratingMap] = useState(false);
    const [factionMaps, setFactionMaps] = useState<any[]>([]); // User saved faction maps

    // --- DOFUS STYLE CHARACTER CONTROLLER ---
    const checkCollision = useCallback((nx: number, ny: number) => {
        // Map Boundaries
        if (nx < 2 || nx > 98 || ny < 2 || ny > 98) return false;

        // Prop Obstacles (Sliding handled internally by the hook)
        const isBlocked = worldProps.some(p => 
            p.type === 'obstacle' && 
            Math.abs(p.x - nx) < 4 && 
            Math.abs(p.y - ny) < 4
        );
        
        return !isBlocked;
    }, [worldProps]);

    const { 
        visualPosition, 
        angle, 
        animation, 
        isMoving: hookIsMoving, 
        updateTarget, 
        stopMoving 
    } = useCharacterController(position, 2.5, checkCollision);

    // Sync physical position with visual position for logic (triggers, aggro)
    useEffect(() => {
        setPosition(visualPosition);
    }, [visualPosition]);
    const [activeMerchant, setActiveMerchant] = useState<Merchant | null>(null);

    const [merchants, setMerchants] = useState<Merchant[]>(DEFAULT_MERCHANTS);

    // Combat State
    const [isInCombat, setIsInCombat] = useState(false);
    const [activeFightMonsters, setActiveFightMonsters] = useState<{ id: string, monsterId: string, level: number }[]>([]);

    // Interaction Bubble State
    const [interactionTarget, setInteractionTarget] = useState<ExtendedMapProp | null>(null);

    // Dialogue State
    const [activeDialogue, setActiveDialogue] = useState<{ dialogue: DialogueTree; speakerName: string; speakerImage?: string; targetProp?: ExtendedMapProp } | null>(null);

    // Combat Report
    interface CombatReport {
        victory: boolean;
        xpGained: number;
        drops: Item[];
        kamasGained: number;
        isPermaDeath?: boolean; // For heroic mode permanent death
        message?: string; // Custom message for defeat
    }
    const [combatReport, setCombatReport] = useState<CombatReport | null>(null);

    // Game Menus (C/S/I shortcuts)
    const { characterMenuOpen, setCharacterMenuOpen, spellMenuOpen, setSpellMenuOpen, inventoryMenuOpen, setInventoryMenuOpen, closeAllMenus } = useGameMenus();

    // Region & Limits State
    const [currentRegion, setCurrentRegion] = useState<Region>(REGIONS[0]);
    const [showRegionMap, setShowRegionMap] = useState(false);
    const [mapsInRegion, setMapsInRegion] = useState<Record<string, number>>({}); // Count per region seed
    const [generatingRegionSlot, setGeneratingRegionSlot] = useState<{ regionId: string; mapType: RegionMapType; index: number } | null>(null);
    const activeMapRef = useRef({ x: mapCoords.x, y: mapCoords.y });

    // Monster State with processed images
    const [monsters, setMonsters] = useState(MONSTER_BANK);
    const [allWorldMaps, setAllWorldMaps] = useState<SavedMap[]>([]);

    // Load all discovered maps for the global map view
    const fetchAllWorldMaps = useCallback(async () => {
        const narvosLauncher = typeof window !== 'undefined' ? (window as any).narvosLauncher : null;
        if (narvosLauncher?.isElectron) {
            try {
                const res = await narvosLauncher.mysqlQuery('SELECT * FROM generated_maps_2d', []);
                if (res.data) {
                    setAllWorldMaps(res.data.map((row: any) => {
                        const [x, y] = (row.id || "0,0").split(',').map(Number);
                        return {
                            id: row.id,
                            x: x || 0,
                            y: y || 0,
                            imageUrl: row.image_url,
                            props: typeof row.props_json === 'string' ? JSON.parse(row.props_json) : row.props_json,
                            theme: row.theme
                        };
                    }));
                }
            } catch (e) {
                console.error("[GameWorld] Failed to fetch all world maps:", e);
            }
        } else {
            // Fallback for web environment if Electron is not available
            try {
                const maps = await getAllMaps();
                setAllWorldMaps(maps);
            } catch (e) {
                console.error("[GameWorld] Failed to fetch all world maps from local storage:", e);
            }
        }
    }, []);

    useEffect(() => {
        fetchAllWorldMaps();
    }, [fetchAllWorldMaps, mapBgUrl]); // Refresh when a new map is generated

    // Process Monster Sprites (Remove Background) on Load
    useEffect(() => {
        // Le système V4 et Pre-made de sprites (SpritesheetAnimator) gère nativement ses propres PNG.
        // Le vieux traitement makeImageTransparent n'est plus requis, évitant le crash startsWith(undefined).
        setMonsters(MONSTER_BANK as any);
        console.log('[GameWorld] Monsters loaded directly to state (V4/Pre-made scale ready).');
    }, []);

    // Player Stats Étendues (pour système tactique)
    const [playerStats, setPlayerStats] = useState<CombatantStats>(() => {
        // First, check what we have from the saved character
        const savedStats = character.stats || {};
        const savedLevel = character.level || (savedStats as any).niveau || 1;
        const savedXp = (savedStats as any).experience || 0;
        const savedXpMax = (savedStats as any).experienceMax || 1000;

        console.log(`[GameWorld] Initializing playerStats: Level=${savedLevel}, XP=${savedXp}/${savedXpMax}`);

        const baseStats: CombatantStats = {
            hp: classData.stats?.hp || 200,
            maxHp: classData.stats?.hp || 200,
            pa: classData.stats?.pa || 6,
            maxPa: classData.stats?.pa || 6,
            pm: classData.stats?.pm || 4,
            maxPm: classData.stats?.pm || 4,
            puissance: classData.stats?.puissance || 10,
            dommages: 0,
            domCritique: 50,
            domMelee: 0,
            domDistance: 0,
            critique: classData.stats?.critique || 5,
            esquive: 0,
            parade: 0,
            resMelee: 0,
            resDistance: 0,
            maitrise: { eau: 0, feu: 0, air: 0, terre: 0, neutre: 0 },
            resistances: { eau: 0, feu: 0, air: 0, terre: 0, neutre: 0 },
            initiative: classData.stats?.initiative || 100,
            vitesse: 100,
            niveau: savedLevel,
            experience: savedXp,
            experienceMax: savedXpMax
        };

        if (character.stats) {
            // Merge saved stats, but ensure our explicitly set values take priority if present
            const merged = { ...baseStats, ...character.stats };
            // Ensure niveau/experience from saved character are used
            merged.niveau = savedLevel;
            merged.experience = savedXp;
            merged.experienceMax = savedXpMax;
            return merged;
        }
        return baseStats;
    });

    // Système d'inventaire
    const [inventory, setInventory] = useState<Inventory>(() => {
        const savedInv = character.inventory;
        console.log(`[GameWorld] Initializing inventory: Aros=${savedInv?.aros || 0}`);
        return savedInv || {
            items: [],
            maxSlots: 40,
            aros: 0, // Start with 0, not 1000!
            lysAmount: 0,
            alakyrisAmount: 0,
            darniarAmount: 0
        };
    });

    const [statPoints, setStatPoints] = useState(character.stats?.statPoints ?? 5);
    const [spellPoints, setSpellPoints] = useState(character.stats?.spellPoints ?? 2);
    const [showWorldHUD, setShowWorldHUD] = useState(true);

    const [equipment, setEquipment] = useState<Equipment>(character.equipment || { slots: {} });

    // --- PERSISTENCE & MENU ---
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [lastSaveTime, setLastSaveTime] = useState(Date.now());
    const [isSaving, setIsSaving] = useState(false);

    // Save Character Data Helper
    const saveProgress = async () => {
        const { activeCharacterId: id, playerStats: stats, mapCoords: map, character: char, inventory: inv, statPoints: sp, spellPoints: spp, equipment: eq, position: pos } = autoSaveData.current;
        if (!id) return;

        setIsSaving(true);
        console.log('[GameWorld] Auto-saving...');

        const updatedChar: SavedCharacter = {
            id: id,
            name: char.name,
            classId: char.classId,
            level: stats.niveau,
            gender: char.gender,
            colors: char.colors,
            headIndex: char.headIndex,
            spriteDataUrl: spriteUrl || '',
            lastMap: { x: map.x, y: map.y },
            lastPosition: pos,
            createdAt: (char as SavedCharacter).createdAt || (char as any).created_at || Date.now(),
            inventory: inv,
            equipment: eq,
            spells: autoSaveData.current.playerSpells,
            stats: {
                hp: stats.hp,
                maxHp: stats.maxHp,
                pa: stats.pa,
                pm: stats.pm,
                puissance: stats.puissance,
                critique: stats.critique,
                initiative: stats.initiative,
                experience: stats.experience,
                experienceMax: stats.experienceMax,
                statPoints: sp,
                spellPoints: spp,
                maitrise: stats.maitrise,
                resistances: stats.resistances,
                statsInvested: stats.statsInvested || {
                    vitalite: (stats as any).vitalite || 0,
                    sagesse: (stats as any).sagesse || 0,
                    force: (stats as any).force || 0,
                    intelligence: (stats as any).intelligence || 0,
                    chance: (stats as any).chance || 0,
                    agilite: (stats as any).agilite || 0,
                },
            },
            serverType: (char as SavedCharacter).serverType || 'NORMAL',
            isDead: (char as SavedCharacter).isDead || false
        };

        try {
            await saveCharacter(updatedChar, username, serverId);
            console.log('[GameWorld] Progress saved successfully.');
        } catch (e) {
            console.error('[GameWorld] Save failed:', e);
        }

        setLastSaveTime(Date.now());
        setTimeout(() => setIsSaving(false), 500);
    };


    useEffect(() => {
        const interval = setInterval(() => {
            saveProgress();
        }, 30000);
        return () => clearInterval(interval);
    }, []);





    // Character Menu (Inventory/Stats)
    // const [characterMenuOpen, setCharacterMenuOpen] = useState(false); // REMOVED - using useGameMenus
    const [activeTab, setActiveTab] = useState<'stats' | 'inventory' | 'spells'>('stats');

    // Handle Escape Key (Updated with proper scope)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (characterMenuOpen) setCharacterMenuOpen(false);
                else {
                    setIsMenuOpen(prev => !prev);
                    setIsSettingsOpen(false); // Reset submenu
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [characterMenuOpen]);



    // Sorts du joueur (basé sur la classe)
    const [playerSpells, setPlayerSpells] = useState<Spell[]>([]);

    // Refs for Auto-Save to avoid resetting interval on state change
    const autoSaveData = useRef({ playerStats, mapCoords, activeCharacterId, character, inventory, statPoints, spellPoints, equipment, position, playerSpells });
    useEffect(() => {
        autoSaveData.current = { playerStats, mapCoords, activeCharacterId, character, inventory, statPoints, spellPoints, equipment, position, playerSpells };
    }, [playerStats, mapCoords, activeCharacterId, character, inventory, statPoints, spellPoints, equipment, position, playerSpells]);

    // Initialize player spells from database or class data
    useEffect(() => {
        const loadSpells = async () => {
            if (!classData?.id) return;

            // 1. Try to load from MySQL
            const dbSpells = await getSpellsByClassId(classData.id);

            if (dbSpells.length > 0) {
                // Spells found in DB - use them directly
                console.log('[GameWorld] Loaded spells from MySQL:', dbSpells.length);
                setPlayerSpells(dbSpells as any);
                return;
            }

            // 2. No spells in DB - sync from classData if available
            if (classData.spells && classData.spells.length > 0) {
                console.log('[GameWorld] No spells in DB, syncing from class data...');
                await syncSpellsFromData(classData.spells, classData.id);

                // 3. Reload from DB after sync
                const syncedSpells = await getSpellsByClassId(classData.id);
                if (syncedSpells.length > 0) {
                    console.log('[GameWorld] Loaded synced spells from MySQL:', syncedSpells.length);
                    setPlayerSpells(syncedSpells as any);
                    return;
                }

                // 4. Fallback: Convert locally if DB sync failed
                const elementMap: Record<string, 'eau' | 'feu' | 'air' | 'terre' | 'neutre'> = {
                    'earth': 'terre', 'fire': 'feu', 'water': 'eau', 'air': 'air', 'neutral': 'neutre', 'heal': 'neutre'
                };

                const convertedSpells: Spell[] = classData.spells.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    icon: s.icon,
                    paCost: s.apCost || 3,
                    pmCost: 0,
                    minRange: s.minRange || 1,
                    maxRange: s.range || 5,
                    lineOfSight: true,
                    modifiableRange: false,
                    zoneShape: s.effectType === 'area' ? 'circle' as const : 'single' as const,
                    zoneSize: s.effectType === 'area' ? 2 : 1,
                    color: s.color || '#ffffff',
                    animationConfig: s.animationConfig,
                    effectType: s.effectType || 'projectile',
                    targetType: s.damage?.element === 'heal' ? 'ally' as const : 'enemy' as const,
                    cooldown: 1,
                    usesPerTurn: 2,
                    effects: s.damage ? [{
                        type: s.damage.element === 'heal' ? 'heal' as const : 'damage' as const,
                        element: elementMap[s.damage.element] || 'neutre',
                        value: Math.floor((s.damage.min + s.damage.max) / 2),
                        valuePerLevel: 2
                    }] : [],
                    currentLevel: 1,
                    maxLevel: 9,
                    levelRequired: 1,
                    type: s.damage?.element === 'heal' ? 'support' as const : 'offense' as const
                }));

                setPlayerSpells(convertedSpells);
                console.log('[GameWorld] Initialized player spells from local data:', convertedSpells.length);
            }
        };

        loadSpells();
    }, [classData]);

    // Monster AI movement positions (id -> current position offset for wandering)
    const [monsterOffsets, setMonsterOffsets] = useState<Record<string, { dx: number, dy: number, animFrame: number, angle?: string, action?: string }>>({});

    // Tools
    const [isBankOpen, setIsBankOpen] = useState(false);
    const [bankItems, setBankItems] = useState<{ id: string, url: string, name: string }[]>([]);
    const [objectPrompt, setObjectPrompt] = useState("");
    const [isGeneratingObject, setIsGeneratingObject] = useState(false);
    const [objectCategory, setObjectCategory] = useState<'decoration' | 'prop' | 'item' | 'building'>('decoration');
    const [placingItem, setPlacingItem] = useState<{
        id: string,
        url?: string,
        name: string,
        type: 'custom' | 'monster' | 'trigger' | 'collision' | 'merchant',
        monsterId?: string,
        merchantId?: string,
        isCollisionZone?: boolean,
        collisionOpacity?: number,
        teleportCost?: number
    } | null>(null);
    const [currentMousePos, setCurrentMousePos] = useState({ x: 50, y: 50 });
    const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [initialSize, setInitialSize] = useState({ w: 0, h: 0 });

    // LOGIQUE ADMIN : Basée sur le rôle DB ou les comptes privilégiés
    const isAdmin = role?.toUpperCase() === 'ADMIN' ||
        ['admin', 'lysring', 'aniss', 'admin123'].includes(username?.toLowerCase() || '');

    const containerRef = useRef<HTMLDivElement>(null);

    // --- SOUND SYSTEM ---
    useEffect(() => {
        if (isInCombat) {
            audioManager.playMusic('combat');
        } else {
            audioManager.playMusic('exploration');
        }
    }, [isInCombat]);



    // Load initial assets
    useEffect(() => {
        const initWorld = async () => {
            const savedObjects = await getSavedObjects();

            // Add Trigger Circle to bank if missing
            const hasTrigger = savedObjects.find(o => o.id === 'obj_trigger_portal');
            const portalObj = { id: 'obj_trigger_portal', name: 'Portail (Trigger)', url: '/textures/ui/portal.png' };
            if (!hasTrigger) {
                await saveObjectToBank(portalObj);
                setBankItems((prev: any[]) => [...prev, portalObj]);
            } else {
                setBankItems(savedObjects);
            }

            // Add Teleport Beacon to bank if missing
            const hasBeacon = savedObjects.find(o => o.id === 'obj_teleport_beacon');
            const beaconObj = { id: 'obj_teleport_beacon', name: 'Balise de Téléport (10 K)', url: '/textures/ui/teleport_beacon.png' };
            if (!hasBeacon) {
                await saveObjectToBank(beaconObj);
                setBankItems((prev: any[]) => [...prev, beaconObj]);
            } else {
                setBankItems(savedObjects); // Ensure all saved objects are loaded
            }

            // --- ADD NEW GENERATED ITEMS TO BANK ---
            const newItems = [
                { id: 'cons_medkit', name: 'Nano Medkit', url: '/textures/objet/consomable/station_item_nano_medkit.png' },
                { id: 'res_aqua_processor', name: 'Aqua Processor', url: '/textures/objet/item/item_aqua_processor.png' },
                { id: 'res_fossil_spore', name: 'Spore Fossile', url: '/textures/objet/item/item_fossil_spore.png' },
                { id: 'qst_quantum_keycard', name: 'Quantum Keycard', url: '/textures/objet/item/station_item_quantum_keycard.png' }
            ];

            for (const item of newItems) {
                if (!savedObjects.find(o => o.id === item.id)) {
                    await saveObjectToBank(item);
                    setBankItems((prev: any[]) => [...prev, item]);
                }
            }


            // Load the forced starting map
            await loadMap(0, 0, true);

            // Add starting items for testing
            setInventory((prev: Inventory) => ({
                ...prev,
                items: [
                    {
                        id: 'item_1',
                        name: 'Pain d\'Alakyris',
                        description: 'Restaure 50 PV.',
                        icon: '🍞',
                        type: 'consumable',
                        rarity: 'common',
                        sellValue: 10,
                        buyValue: 20,
                        stackable: true,
                        quantity: 5,
                        maxStack: 100,
                        effect: { type: 'heal', value: 50 }
                    },
                    {
                        id: 'item_2',
                        name: 'Épée de Darniar',
                        description: 'Une lame forgée dans le métal le plus résistant.',
                        icon: '⚔️',
                        type: 'weapon',
                        rarity: 'uncommon',
                        sellValue: 100,
                        buyValue: 200,
                        stackable: false,
                        quantity: 1,
                        maxStack: 1,
                        statsBonus: { puissance: 15, dommages: 5 }
                    }
                ]
            }));
        };
        initWorld();

        // Charger les marchands additionnels de la BDD
        getSavedMerchants().then(saved => {
            if (saved && saved.length > 0) {
                setMerchants(prev => {
                    const existingIds = new Set(prev.map(m => m.id));
                    const newMerchants = saved.filter(m => !existingIds.has(m.id));
                    return [...prev, ...newMerchants];
                });
            }
        });
    }, []);

    // Initialisation des sorts du joueur selon sa classe
    useEffect(() => {
        if (classData && classData.spells) {
            const elementMap: Record<string, any> = {
                'earth': 'terre',
                'fire': 'feu',
                'water': 'eau',
                'air': 'air',
                'neutral': 'neutre',
                'heal': 'neutre'
            };

            const initialSpells: Spell[] = classData.spells.map((s: any) => ({
                id: s.id,
                name: s.name,
                description: s.description,
                icon: s.icon,
                paCost: s.apCost || 3,
                pmCost: 0,
                minRange: s.minRange || 1,
                maxRange: s.range || 1,
                lineOfSight: true,
                modifiableRange: false,
                zoneShape: s.effectType === 'area' ? 'circle' : 'single',
                zoneSize: s.effectType === 'area' ? 2 : 1,
                targetType: s.effectType === 'self' ? 'self' : (s.damage?.element === 'heal' ? 'ally' : 'enemy'),
                cooldown: 0,
                usesPerTurn: 2,
                currentLevel: 1,
                maxLevel: 9,
                levelRequired: 1,
                type: s.damage?.element === 'heal' ? 'support' : 'offense',
                color: s.color || '#3b82f6',
                effects: s.damage ? [{
                    type: s.damage.element === 'heal' ? 'heal' : 'damage',
                    element: elementMap[s.damage.element] || 'neutre',
                    value: Math.floor((s.damage.min + s.damage.max) / 2),
                    valuePerLevel: 2
                }] : []
            }));
            setPlayerSpells(initialSpells);
        }
    }, [classData]);

    // Reload map when region changes
    useEffect(() => {
        loadMap(mapCoords.x, mapCoords.y);
    }, [currentRegion.id]);

    // Load saved faction maps on mount
    useEffect(() => {
        getFactionMaps().then(maps => setFactionMaps(maps));
    }, []);

    // Monster Aggro Detection - Auto-start combat when player enters aggro range
    useEffect(() => {
        if (isInCombat || activeFightMonsters.length > 0) return; // Skip if already in combat

        const aggroCheck = setInterval(() => {
            for (const prop of worldProps) {
                if (prop.type === 'monster' && prop.isAggressive && prop.aggroRadius) {
                    const dist = Math.sqrt(
                        Math.pow(position.x - prop.x, 2) +
                        Math.pow(position.y - prop.y, 2)
                    );
                    if (dist < prop.aggroRadius) {
                        console.log(`[Aggro] ${prop.npcName || prop.monsterId} attacks player!`);
                        startCombat(prop);
                        break; // Only trigger one combat at a time
                    }
                }
            }
        }, 1000); // Check every second

        return () => clearInterval(aggroCheck);
    }, [position, worldProps, isInCombat, activeFightMonsters.length]);

    const handleBuy = (item: Item) => {
        if (!activeMerchant) return;
        const price = Math.floor((item.basePrice || 10) * (activeMerchant.sellMultiplier || 1.0));
        if (inventory.aros >= price) {
            setInventory(prev => {
                const nextInv = {
                    ...prev,
                    aros: prev.aros - price,
                    items: [...prev.items, { ...item, id: `${item.id}_${Date.now()}` }]
                };
                autoSaveData.current.inventory = nextInv;
                return nextInv;
            });
            audioManager.playSfx('buy');
            saveProgress().catch(console.error);
        } else {
            alert("Aros insuffisants !");
        }
    };

    const handleSell = (itemToSell: Item) => {
        if (!activeMerchant) return;
        const price = Math.floor((itemToSell.basePrice || 10) * (activeMerchant.buyFactor || 0.1));
        setInventory(prev => {
            const nextInv = {
                ...prev,
                aros: prev.aros + price,
                items: prev.items.filter(i => i.id !== itemToSell.id)
            };
            autoSaveData.current.inventory = nextInv;
            return nextInv;
        });
        audioManager.playSfx('sell');
        saveProgress().catch(console.error);
    };

    const handleSaveFactionMap = async () => {
        if (!mapBgUrl) return;
        const name = prompt("Nom de la carte de faction ?");
        if (!name) return;

        const newMap = {
            id: `faction_${Date.now()}`,
            name,
            imageUrl: mapBgUrl,
            props: worldProps,
            theme: 'custom'
        };
        await saveFactionMap(newMap as any);
        setFactionMaps(prev => [...prev, newMap]);
        alert("Carte sauvegardée dans les factions !");
    };

    // CRITICAL FIX: Keep autoSaveData in sync with latest state
    // This is placed here to ensure all state variables are defined
    useEffect(() => {
        if (!autoSaveData.current) return;

        const spellsToSave = typeof playerSpells !== 'undefined' ? playerSpells : [];

        autoSaveData.current = {
            activeCharacterId,
            playerStats,
            mapCoords,
            character: {
                ...character,
                stats: playerStats as any,
                inventory,
                equipment,
                spells: spellsToSave,
                serverType: (character as any).serverType || serverType
            },
            inventory,
            statPoints,
            spellPoints,
            equipment,
            position,
            playerSpells: spellsToSave
        };
    }, [activeCharacterId, playerStats, mapCoords, character, inventory, statPoints, spellPoints, equipment, position, playerSpells, serverType]);


    const handleLoadFactionMap = async (map: any) => {
        if (map.imageUrl) {
            setMapBgUrl(map.imageUrl);
            setWorldProps(map.props || []);
            // Save as current map coordinates too
            await saveMap(mapCoords.x, mapCoords.y, map.imageUrl, map.props || []);
        } else {
            console.warn("[Map] Generation presets are disabled.");
        }
        setIsBankOpen(false);
    };

    const loadingMapRef = useRef<{ x: number, y: number } | null>(null);

    const loadMap = async (x: number, y: number, isInitial: boolean = false) => {
        // Prevent double loading of the same map coordinates
        if (loadingMapRef.current && loadingMapRef.current.x === x && loadingMapRef.current.y === y) {
            console.log(`[Map] Already loading map (${x}, ${y}), skipping duplicate request.`);
            return;
        }

        loadingMapRef.current = { x, y };
        setIsGeneratingMap(true);
        console.log(`[Map] Loading map at (${x}, ${y})...`);
        try {
            // Check if it's a fixed starting map center
            // Initial load of map (0,0)
            if (isInitial && x === 0 && y === 0) {
                activeMapRef.current = { x: 0, y: 0 };
                setMapBgUrl(currentRegion.startingMap);
                setWorldProps(INITIAL_PROPS);
                setIsGeneratingMap(false);
                loadingMapRef.current = null;
                return;
            }

            const savedMap = await getSavedMap(x, y);
            activeMapRef.current = { x, y };

            if (savedMap && savedMap.imageUrl && savedMap.imageUrl.length > 10) {
                console.log(`[Map] Found saved map at (${x}, ${y}), URL length: ${savedMap.imageUrl.length}`);
                setMapBgUrl(savedMap.imageUrl);
                const rawProps = savedMap.props || [];
                const uniqueProps = rawProps.filter((p, index, self) =>
                    index === self.findIndex((t) => t.id === p.id)
                );
                setWorldProps(uniqueProps);
            } else {
                console.warn(`[Map] No saved map at (${x}, ${y}). Generation is disabled.`);
                setMapBgUrl(currentRegion.startingMap); // Fallback to starting map
                setWorldProps([]);
            }
        } catch (e) {
            console.error("Error loading map", e);
        } finally {
            setIsGeneratingMap(false);
            loadingMapRef.current = null;
        }
    };


    // --- MAP GENERATION REMOVED ---

    useEffect(() => {
        const animInterval = setInterval(() => setFrame(f => (f + 1) % 4), 150);
        return () => clearInterval(animInterval);
    }, []);

    // Monster Wandering AI - makes monsters move around their spawn point
    useEffect(() => {
        if (isInCombat) return;

        const wanderInterval = setInterval(() => {
            setMonsterOffsets(prev => {
                const next: Record<string, { dx: number, dy: number, animFrame: number, angle?: string, action?: string }> = {};

                worldProps.filter(p => p.type === 'monster').forEach(monster => {
                    const current = prev[monster.id] || { dx: 0, dy: 0, animFrame: 0, angle: 'S', action: 'Idle' };

                    // Random chance to change direction (40% for more activity)
                    if (Math.random() < 0.4) {
                        // Wander within 3% of spawn point
                        const moveX = (Math.random() - 0.5) * 4;
                        const moveY = (Math.random() - 0.5) * 3;
                        
                        const newDx = Math.max(-10, Math.min(10, current.dx + moveX));
                        const newDy = Math.max(-10, Math.min(10, current.dy + moveY));

                        // Calculate Angle
                        const angleRad = Math.atan2(moveY, moveX);
                        const angleDeg = (angleRad * 180) / Math.PI;
                        const norm = (angleDeg + 360) % 360;
                        let ang = 'S';
                        if (norm >= 337.5 || norm < 22.5) ang = 'E';
                        else if (norm >= 22.5 && norm < 67.5) ang = 'SE';
                        else if (norm >= 67.5 && norm < 112.5) ang = 'S';
                        else if (norm >= 112.5 && norm < 157.5) ang = 'SW';
                        else if (norm >= 157.5 && norm < 202.5) ang = 'W';
                        else if (norm >= 202.5 && norm < 247.5) ang = 'NW';
                        else if (norm >= 247.5 && norm < 292.5) ang = 'N';
                        else if (norm >= 292.5 && norm < 337.5) ang = 'NE';

                        next[monster.id] = {
                            dx: newDx,
                            dy: newDy,
                            animFrame: (current.animFrame + 1) % 4,
                            angle: ang,
                            action: (Math.abs(moveX) > 0.5 || Math.abs(moveY) > 0.5) ? 'Walk' : 'Idle'
                        };
                    } else {
                        // Stay put but maybe look elsewhere (10% chance)
                        next[monster.id] = {
                            ...current,
                            animFrame: (current.animFrame + 1) % 4,
                            action: 'Idle'
                        };
                    }
                });

                return next;
            });
        }, 800); // Move every 800ms

        return () => clearInterval(wanderInterval);
    }, [worldProps, isInCombat]);


    // Keep usePhysicalMovement for Collision & Triggers & Refractions only (logic side)
    useEffect(() => {
        if (!hookIsMoving || isInCombat) return;

        const checkInterval = setInterval(() => {
            // Map boundaries & transitions
            if (position.y > 99) { stopMoving(); handleMapTransition('DOWN'); return; }
            if (position.y < 1) { stopMoving(); handleMapTransition('UP'); return; }
            if (position.x > 99) { stopMoving(); handleMapTransition('RIGHT'); return; }
            if (position.x < 1) { stopMoving(); handleMapTransition('LEFT'); return; }

            // Trigger Collision Check
            const hitTrigger = worldProps.find(p => p.type === 'trigger' && Math.abs(p.x - position.x) < 3 && Math.abs(p.y - position.y) < 3);
            if (hitTrigger && hitTrigger.targetMap) {
                stopMoving();
                setMapCoords({ x: hitTrigger.targetMap.x, y: hitTrigger.targetMap.y });
                setPosition({ x: 50, y: 50 });
                setTarget({ x: 50, y: 50 });
                loadMap(hitTrigger.targetMap.x, hitTrigger.targetMap.y);
            }

            const hitMonster = worldProps.find(p => p.type === 'monster' && Math.abs(p.x - position.x) < 2 && Math.abs(p.y - position.y) < 2);
            if (hitMonster && hitMonster.monsterId) {
                stopMoving();
                startCombat(hitMonster);
            }
        }, 100);

        return () => clearInterval(checkInterval);
    }, [hookIsMoving, position, worldProps, isInCombat, mapCoords]);

    useEffect(() => {
        const timer = setTimeout(() => {
            // Only auto-save if the current props belong to the active coordinates
            if (mapBgUrl && activeMapRef.current.x === mapCoords.x && activeMapRef.current.y === mapCoords.y) {
                saveMap(mapCoords.x, mapCoords.y, mapBgUrl, worldProps)
                    .then(() => console.log(`[Map] Auto-saved at (${mapCoords.x}, ${mapCoords.y})`))
                    .catch(err => console.error("Auto-save failed", err));
            }
        }, 1000); // 1 second debounce to avoid MySQL spam
        return () => clearTimeout(timer);
    }, [worldProps, mapBgUrl, mapCoords]);

    const handleMapTransition = (dir: 'DOWN' | 'UP' | 'LEFT' | 'RIGHT') => {
        let newX = mapCoords.x;
        let newY = mapCoords.y;
        if (dir === 'DOWN') newY += 1;
        if (dir === 'UP') newY -= 1;
        if (dir === 'RIGHT') newX += 1;
        if (dir === 'LEFT') newX -= 1;

        let spawnPos = { ...position };
        if (dir === 'DOWN') { spawnPos.y = 2; }
        else if (dir === 'UP') { spawnPos.y = 98; }
        else if (dir === 'RIGHT') { spawnPos.x = 2; }
        else if (dir === 'LEFT') { spawnPos.x = 98; }

        setPosition(spawnPos);
        setTarget(spawnPos);
        setMapCoords({ x: newX, y: newY });
        loadMap(newX, newY);
    };

    // --- COMBAT ---

    // Handle interaction bubble actions
    const handleInteraction = useCallback((action: 'attack' | 'talk' | 'buy' | 'sell' | 'loot') => {
        if (!interactionTarget) return;

        switch (action) {
            case 'attack':
                startCombat(interactionTarget);
                break;
            case 'buy':
            case 'sell':
                // Find merchant and open menu
                const merchantId = interactionTarget.merchantId;
                if (merchantId) {
                    const merchant = getMerchantById(merchantId) || merchants.find(m => m.id === merchantId);
                    if (merchant) {
                        setActiveMerchant(merchant);
                    }
                }
                break;
            case 'talk':
                // Open dialogue system
                let dialogueTree: DialogueTree | undefined;
                let speakerName = interactionTarget.npcName || 'Inconnu';
                let speakerImage: string | undefined;

                if (interactionTarget.type === 'monster' && interactionTarget.monsterId) {
                    // Get monster data for image and dialogue
                    const monsterData = monsters.find(m => m.id === interactionTarget.monsterId);
                    speakerImage = monsterData?.spriteUrl;
                    speakerName = monsterData?.name || speakerName;

                    // Check if monster has specific dialogue
                    const dialogueId = (monsterData as any)?.dialogueId;
                    if (dialogueId && MONSTER_DIALOGUES[dialogueId]) {
                        dialogueTree = MONSTER_DIALOGUES[dialogueId];
                    } else {
                        // Use generic aggressive monster dialogue
                        dialogueTree = MONSTER_DIALOGUES['aggressive_monster'];
                    }
                } else if (interactionTarget.type === 'merchant' && interactionTarget.merchantId) {
                    // Use merchant dialogue
                    const merchantData = getMerchantById(interactionTarget.merchantId);
                    speakerImage = merchantData?.spriteUrl;
                    speakerName = merchantData?.name || speakerName;
                    dialogueTree = NPC_DIALOGUES['merchant_greeting'];
                }

                if (dialogueTree) {
                    setActiveDialogue({
                        dialogue: dialogueTree,
                        speakerName,
                        speakerImage,
                        targetProp: interactionTarget
                    });
                }
                break;
            case 'loot':
                // TODO: Implement loot pickup
                break;
        }
        setInteractionTarget(null);
    }, [interactionTarget, merchants, monsters]);

    // Handle dialogue actions (rewards, combat triggers, etc.)
    const handleDialogueAction = useCallback((action: DialogueAction) => {
        switch (action.type) {
            case 'give_xp':
                if (action.value) {
                    setPlayerStats(prev => {
                        let newXp = prev.experience + action.value!;
                        let newLevel = prev.niveau;
                        let newXpMax = prev.experienceMax;

                        while (newXp >= newXpMax) {
                            newXp -= newXpMax;
                            newLevel += 1;
                            newXpMax = Math.floor(newXpMax * 1.5);
                        }

                        return { ...prev, experience: newXp, niveau: newLevel, experienceMax: newXpMax };
                    });
                    console.log(`[Dialogue] Received ${action.value} XP!`);
                }
                break;
            case 'give_gold':
                if (action.value) {
                    setInventory(prev => ({ ...prev, aros: (prev.aros || 0) + action.value! }));
                    console.log(`[Dialogue] Received ${action.value} Aros!`);
                }
                break;
            case 'give_item':
                if (action.itemId) {
                    const newItem: Item = {
                        id: `gift_${Date.now()}`,
                        name: 'Cadeau du Lyseur',
                        description: 'Un objet offert par une créature reconnaissante.',
                        type: 'resource',
                        rarity: 'uncommon',
                        icon: '🎁',
                        basePrice: 50,
                        quantity: 1
                    };
                    setInventory(prev => ({ ...prev, items: [...prev.items, newItem] }));
                    console.log(`[Dialogue] Received item: ${newItem.name}!`);
                }
                break;
            case 'heal':
                setPlayerStats(prev => ({ ...prev, hp: prev.maxHp }));
                console.log(`[Dialogue] Fully healed!`);
                break;
            case 'start_combat':
                if (activeDialogue?.targetProp) {
                    setActiveDialogue(null);
                    startCombat(activeDialogue.targetProp);
                }
                break;
        }
    }, [activeDialogue]);

    const startCombat = (mainMonster: ExtendedMapProp) => {
        // Close interaction bubble if open
        setInteractionTarget(null);

        // Find nearby monsters to join fight (Area of 15% distance)
        const group = worldProps.filter(p =>
            p.type === 'monster' &&
            p.monsterId &&
            Math.sqrt(Math.pow(p.x - mainMonster.x, 2) + Math.pow(p.y - mainMonster.y, 2)) < 15
        ).slice(0, 5); // Max 5 monsters

        const fightList = group.map(p => ({
            id: p.id,
            monsterId: p.monsterId!,
            level: MONSTER_BANK.find((mb: any) => mb.id === p.monsterId)?.level || 1
        }));
        setActiveFightMonsters(fightList);
        audioManager.playSfx('Combat/Sword_Clash.wav'); // Sound for starting encounter
        // setIsInCombat(true); // Don't start immediately, show crossed swords first!
    };

    const handleCombatEnd = async (victory: boolean) => {
        if (victory) {
            // Remove dead monsters and save map state
            const remainingProps = worldProps.filter(p => !activeFightMonsters.some((m: any) => m.id === p.id));
            setWorldProps(remainingProps);
            if (mapBgUrl) {
                saveMap(mapCoords.x, mapCoords.y, mapBgUrl, remainingProps).catch(console.error);
            }

            // Calculate Rewards
            let totalXp = 0;
            let totalKamas = 0;
            const drops: Item[] = [];

            activeFightMonsters.forEach(m => {
                const monster = MONSTER_BANK.find((mb: any) => mb.id === m.monsterId);
                const level = monster?.level || 1;

                // XP Calculation
                totalXp += level * 25 * (1 + (level * 0.1));

                // Aros (Kamas) Calculation
                totalKamas += Math.floor(Math.random() * 10 * level) + 5;

                // Drops Calculation using STATIC_ITEMS
                // 40% chance of drop per monster
                if (Math.random() < 0.4) {
                    const rarityRoll = Math.random();
                    let targetRarity = 'common';
                    if (rarityRoll > 0.98) targetRarity = 'legendary';
                    else if (rarityRoll > 0.95) targetRarity = 'epic';
                    else if (rarityRoll > 0.85) targetRarity = 'rare';
                    else if (rarityRoll > 0.60) targetRarity = 'uncommon';

                    // Pick suitable items from bank based on level and rarity
                    const possibleDrops = STATIC_ITEMS.filter(i =>
                        (i.type === 'resource' || i.type === 'consumable') &&
                        i.rarity === targetRarity &&
                        (i.level || 1) <= level + 5
                    );

                    if (possibleDrops.length > 0) {
                        const randomItem = possibleDrops[Math.floor(Math.random() * possibleDrops.length)];
                        drops.push({
                            ...randomItem,
                            id: `drop_${Date.now()}_${Math.random()}`
                        });
                    }
                }
            });

            // Perform Level Up check and update stats
            let finalXp = Math.floor(playerStats.experience + totalXp);
            let finalLevel = playerStats.niveau;
            let finalXpMax = playerStats.experienceMax;
            let addedStatPoints = 0;
            let addedSpellPoints = 0;

            while (finalXp >= finalXpMax) {
                finalXp -= finalXpMax;
                finalLevel += 1;
                finalXpMax = Math.floor(finalXpMax * 1.5); // Harder curve
                addedStatPoints += 5;
                addedSpellPoints += 1;
            }

            const newStats: CombatantStats = {
                ...playerStats,
                experience: finalXp,
                niveau: finalLevel,
                experienceMax: finalXpMax,
                hp: playerStats.maxHp // Heal on victory
            };

            const newInventory: Inventory = {
                ...inventory,
                aros: (inventory.aros || 0) + totalKamas,
                items: [...inventory.items, ...drops]
            };

            const newStatPoints = statPoints + addedStatPoints;
            const newSpellPoints = spellPoints + addedSpellPoints;

            // Update States
            setPlayerStats(newStats);
            setInventory(newInventory);
            setStatPoints(newStatPoints);
            setSpellPoints(newSpellPoints);

            // Show Report
            setCombatReport({
                victory: true,
                xpGained: Math.floor(totalXp),
                kamasGained: totalKamas,
                drops: drops
            });

            // Force Auto-Save Immediately with the NEW data
            console.log(`[GameWorld] Combat victory! Level: ${finalLevel}, XP: ${finalXp}, Items: ${drops.length}`);
            autoSaveData.current = {
                playerStats: newStats,
                mapCoords,
                activeCharacterId,
                character: { ...character, level: finalLevel, stats: newStats as any }, // Ensure top-level level is updated
                inventory: newInventory,
                statPoints: newStatPoints,
                spellPoints: newSpellPoints,
                equipment,
                position,
                playerSpells // Add playerSpells here!
            };
            saveProgress().catch(err => console.error('[GameWorld] Victory save failed:', err));

        } else {
            // ═══════════════════════════════════════════════════════════════
            // DEFEAT - Different behavior based on server type
            // ═══════════════════════════════════════════════════════════════

            if (serverType === 'HEROIC') {
                // *** SERVEUR HÉROÏQUE - MORT DÉFINITIVE ***
                // Le personnage est entièrement réinitialisé
                console.log('[HEROIC] Défaite ! Réinitialisation complète du personnage...');

                // Reset stats to level 1 defaults
                const baseStats = classData.stats || { hp: 160, pa: 6, pm: 3, puissance: 10, initiative: 100, critique: 5 };
                setPlayerStats(prev => ({
                    ...prev,
                    hp: baseStats.hp || 160,
                    maxHp: baseStats.hp || 160,
                    pa: baseStats.pa || 6,
                    pm: baseStats.pm || 3,
                    puissance: baseStats.puissance || 10,
                    initiative: baseStats.initiative || 100,
                    critique: baseStats.critique || 5,
                    niveau: 1,
                    experience: 0,
                    experienceMax: 100
                }));

                // Reset inventory - NO ITEMS KEPT
                setInventory(prev => ({
                    ...prev,
                    items: [],
                    aros: 0, // No gold
                    lysAmount: 0,
                    alakyrisAmount: 0,
                    darniarAmount: 0
                }));

                // Reset equipment - NO EQUIPMENT KEPT
                setEquipment(prev => ({
                    ...prev,
                    slots: {}
                }));

                // Reset progression points
                setStatPoints(0);
                setSpellPoints(0);

                // Reset position to starting point
                setPosition({ x: 50, y: 50 });
                setTarget({ x: 50, y: 50 });
                setMapCoords({ x: 0, y: 0 });

                // Mark character as PERMANENTLY DEAD for heroic mode
                // This will be saved and the character will be hidden from selection
                autoSaveData.current = {
                    ...autoSaveData.current,
                    character: {
                        ...(autoSaveData.current.character as any),
                        isDead: true,
                        serverType: 'HEROIC'
                    }
                };

                // Save the reset state immediately (with isDead flag)
                saveProgress().catch(console.error);

                setCombatReport({
                    victory: false,
                    xpGained: 0,
                    kamasGained: 0,
                    drops: [],
                    isPermaDeath: true, // Flag for UI to show special message
                    message: '💀 MORT DÉFINITIVE ! Votre personnage héroïque a péri. Son âme rejoint les étoiles de Narvos...'
                });

            } else {
                // *** SERVEUR NORMAL/CLASSIQUE - Perte légère ***
                // Le joueur respawn avec 50% HP et conserve tout
                setPlayerStats((prev: CombatantStats) => ({ ...prev, hp: Math.max(1, Math.floor(prev.maxHp * 0.5)) }));
                setPosition({ x: 50, y: 50 });
                setTarget({ x: 50, y: 50 });

                setCombatReport({
                    victory: false,
                    xpGained: 0,
                    kamasGained: 0,
                    drops: [],
                    isPermaDeath: false,
                    message: 'Vous avez été vaincu, mais vous vous relevez avec 50% de vos HP.'
                });
            }
        }

        setIsInCombat(false);
        setActiveFightMonsters([]);
    };

    // --- CHARACTER PROGRESSION & MENUS ---



    const handleAllocateStat = (statKey: string | number | symbol, amount: number) => {
        const key = statKey as string;
        if (statPoints <= 0) return;
        setPlayerStats((prev: CombatantStats) => {
            const next = { ...prev };
            if (key.includes('.')) {
                const [parent, child] = key.split('.');
                (next as any)[parent] = {
                    ...(next as any)[parent],
                    [child]: ((next as any)[parent][child] || 0) + amount
                };
            } else {
                (next as any)[key] = ((next as any)[key] || 0) + amount;
                if (key === 'maxHp') next.hp = Math.min(next.hp + amount, next.maxHp);
            }
            // Update autoSaveData for immediate saveProgress() call
            autoSaveData.current.playerStats = next;
            return next;
        });
        setStatPoints((s: number) => {
            const nextVal = s - 1;
            // Update autoSaveData for immediate save
            autoSaveData.current.statPoints = nextVal;
            return nextVal;
        });
        saveProgress();
    };

    const handleUpgradeSpell = (spellId: string) => {
        if (spellPoints <= 0) return;
        setPlayerSpells((prev: Spell[]) => {
            const next = prev.map((s: Spell) =>
                s.id === spellId && s.currentLevel < s.maxLevel
                    ? { ...s, currentLevel: s.currentLevel + 1 }
                    : s
            );
            autoSaveData.current.playerSpells = next;
            return next;
        });
        setSpellPoints((s: number) => {
            const nextVal = s - 1;
            autoSaveData.current.spellPoints = nextVal;
            return nextVal;
        });
        saveProgress();
    };

    const handleEquipItem = (item: Item, slot: EquipmentSlot) => {
        // First, unequip whatever is there
        const oldItem = equipment.slots[slot];

        setInventory((prev: Inventory) => {
            const nextItems = prev.items.filter(i => i.id !== item.id);
            if (oldItem) {
                nextItems.push(oldItem);
            }
            const nextInv = { ...prev, items: nextItems };
            autoSaveData.current.inventory = nextInv;
            return nextInv;
        });

        setPlayerStats((prev: CombatantStats) => {
            const next = { ...prev };

            // Remove old stats if any
            if (oldItem && oldItem.statsBonus) {
                Object.entries(oldItem.statsBonus).forEach(([stat, val]) => {
                    (next as any)[stat] = ((next as any)[stat] || 0) - (val as number);
                });
            }

            // Add new stats
            if (item && item.statsBonus) {
                Object.entries(item.statsBonus).forEach(([stat, val]) => {
                    (next as any)[stat] = ((next as any)[stat] || 0) + (val as number);
                });
            }
            autoSaveData.current.playerStats = next;
            return next;
        });

        setEquipment((prev: Equipment) => {
            const nextEq = {
                slots: { ...prev.slots, [slot]: item }
            };
            autoSaveData.current.equipment = nextEq;
            return nextEq;
        });

        saveProgress().catch(console.error);
    };

    const handleUnequipItem = (slot: EquipmentSlot) => {
        const item = equipment.slots[slot];
        if (!item) return;

        setEquipment((prev: Equipment) => {
            const nextSlots = { ...prev.slots };
            delete nextSlots[slot];
            const nextEq = { slots: nextSlots };
            autoSaveData.current.equipment = nextEq;
            return nextEq;
        });

        setInventory((prev: Inventory) => {
            const nextInv = {
                ...prev,
                items: [...prev.items, item]
            };
            autoSaveData.current.inventory = nextInv;
            return nextInv;
        });

        if (item && item.statsBonus) {
            setPlayerStats((prev: CombatantStats) => {
                const next = { ...prev };
                Object.entries(item.statsBonus!).forEach(([stat, val]) => {
                    (next as any)[stat] = ((next as any)[stat] || 0) - (val as number);
                });
                autoSaveData.current.playerStats = next;
                return next;
            });
        }
        saveProgress().catch(console.error);
    };

    const handleUpdateItem = (updatedItem: Item) => {
        setInventory(prev => ({
            ...prev,
            items: prev.items.map(i => i.id === updatedItem.id ? updatedItem : i)
        }));
    };

    const handleUseItem = (item: any) => {
        if (item.effect && item.effect.type === 'heal') {
            setPlayerStats((prev: CombatantStats) => {
                const next = {
                    ...prev,
                    hp: Math.min(prev.maxHp || 100, prev.hp + item.effect.value)
                };
                autoSaveData.current.playerStats = next;
                return next;
            });
            // Remove 1 from inventory
            setInventory((prev: Inventory) => {
                const nextInv = {
                    ...prev,
                    items: item.quantity > 1
                        ? prev.items.map((i: any) => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i)
                        : prev.items.filter((i: any) => i.id !== item.id)
                };
                autoSaveData.current.inventory = nextInv;
                return nextInv;
            });
            saveProgress().catch(console.error);
        }
    };

    const handleDropItem = (item: Item) => {
        // Remove from inventory
        setInventory(prev => ({
            ...prev,
            items: prev.items.filter(i => i.id !== item.id)
        }));

        // Add to world props at player position
        const dropX = position.x + (Math.random() * 4 - 2);
        const dropY = position.y + (Math.random() * 4 - 2);

        const newProp: ExtendedMapProp = {
            id: `dropped_${item.id}_${Date.now()}`,
            x: dropX,
            y: dropY,
            width: 30, // Small iconic size
            height: 30,
            type: 'custom', // Reuse custom renderer logic or add specific 'item' type
            imageUrl: item.spriteUrl || item.icon, // Fallback to icon if no sprite (might look weird if emoji)
            name: item.name,
            droppedItemData: item,
            isSolid: false
        };

        setWorldProps(prev => {
            const next = [...prev, newProp];
            if (mapBgUrl) {
                saveMap(mapCoords.x, mapCoords.y, mapBgUrl, next).catch(console.error);
            }
            return next;
        });

        console.log(`Dropped ${item.name} at ${dropX}, ${dropY}`);
    };



    // --- PLACEMENT ---

    const startPlacement = (item: any) => {
        // Check if item is a collision zone
        if (item.type === 'collision' || item.isCollisionZone) {
            setPlacingItem({
                id: `collision_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                name: item.name || 'Zone de Collision',
                type: 'collision',
                isCollisionZone: true,
                collisionOpacity: 0.5
            });
        }
        // Check if item is a trigger portal
        else if (item.id === 'obj_trigger_portal') {
            setPlacingItem({ ...item, type: 'trigger' });
        }
        // Check if item is a teleport beacon
        else if (item.id === 'obj_teleport_beacon') {
            setPlacingItem({ ...item, type: 'trigger', teleportCost: 10 }); // Assign a cost
        }
        // Check if item is a merchant
        else if (item.merchantId) {
            setPlacingItem({
                id: `merchant_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                name: item.name,
                type: 'merchant',
                merchantId: item.merchantId,
                url: item.spriteUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + item.name
            });
        }
        // Check if item is from MONSTER_BANK (has spriteUrl and stats)
        else if ((item.spriteUrl || item.cssComponent) && item.stats) {
            // It's a monster from the bank
            setPlacingItem({
                id: `monster_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                name: item.name,
                type: 'monster',
                monsterId: item.id
            });
        } else if (item.monsterId) {
            // Legacy support
            setPlacingItem({
                id: item.id && !item.id.startsWith('item_') ? item.id : `monster_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                name: item.name,
                type: 'monster',
                monsterId: item.monsterId
            });
        } else {
            // Custom object from bank
            setPlacingItem({ ...item, type: 'custom' });
        }
        setIsBankOpen(false);
    };

    const handleDeleteProp = async (propId: string) => {
        if (!isAdmin) return;
        const newProps = worldProps.filter(p => p.id !== propId);
        setWorldProps(newProps);
        setSelectedPropId(null);
        // Force immediate save on deletion
        if (mapBgUrl) {
            await saveMap(mapCoords.x, mapCoords.y, mapBgUrl, newProps);
            console.log(`[Map] Prop ${propId} deleted and map synced.`);
        }
    };

    const handleMapMouseDown = (e: React.MouseEvent) => {
        if (!containerRef.current || isInCombat || !isAdmin) return;

        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
        const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

        // Check if we clicked a prop (handled in renderProp onClick/onMouseDown)
    };

    const handleMapMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current || isInCombat) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Optimization: Only update mouse pos state if we are in admin mode placing items OR dragging/resizing
        if (isAdmin && (placingItem || isDragging || isResizing)) {
            setCurrentMousePos({ x, y });

            if (isDragging && selectedPropId) {
                setWorldProps(prev => prev.map(p => p.id === selectedPropId
                    ? { ...p, x: x - dragOffset.x, y: y - dragOffset.y }
                    : p
                ));
            } else if (isResizing && selectedPropId) {
                setWorldProps(prev => prev.map(p => {
                    if (p.id !== selectedPropId) return p;
                    const newWidth = Math.max(30, Math.abs(x - p.x) * rect.width / 50);
                    const newHeight = Math.max(30, Math.abs(y - p.y) * rect.height / 50);
                    return { ...p, width: newWidth, height: newHeight };
                }));
            }
        }
    };

    const handleMapMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
    };

    const handleMapClick = (e: React.MouseEvent) => {
        if (!containerRef.current || isInCombat) return;

        // Prevent clicking the map if we are interacting with a prop menu
        if ((e.target as HTMLElement).closest('.prop-controls') || (e.target as HTMLElement).closest('.resize-handle')) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        if (placingItem && isAdmin) {
            const isCollision = placingItem.type === 'collision' || placingItem.isCollisionZone;
            const isTeleportBeacon = placingItem.id === 'obj_teleport_beacon';

            const newProp: ExtendedMapProp = {
                id: placingItem.id || `spawn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                x,
                y,
                width: isCollision ? 60 : (placingItem.type === 'trigger' ? 60 : 80),
                height: isCollision ? 60 : (placingItem.type === 'trigger' ? 60 : 80),
                type: isCollision ? 'collision' : ((placingItem.type === 'custom' ? 'decoration' : placingItem.type) as any),
                imageUrl: placingItem.url,
                monsterId: placingItem.monsterId,
                merchantId: placingItem.merchantId,
                targetMap: placingItem.type === 'trigger' ? { x: mapCoords.x + 1, y: mapCoords.y } : undefined,
                // Collision zone properties
                isCollisionZone: isCollision ? true : undefined,
                collisionOpacity: isCollision ? 0.5 : undefined,
                teleportCost: isTeleportBeacon ? placingItem.teleportCost : undefined // Assign teleport cost
            };

            setWorldProps((prev: ExtendedMapProp[]) => {
                if (prev.some(p => p.id === newProp.id)) return prev;
                const next = [...prev, newProp];
                if (mapBgUrl) {
                    saveMap(mapCoords.x, mapCoords.y, mapBgUrl, next).catch(console.error);
                }
                return next;
            });
            setPlacingItem(null);
            setSelectedPropId(newProp.id);
            return;
        }

        if (!isDragging && !isResizing) {
            setTarget({ x, y });
            updateTarget(x, y);
            setSelectedPropId(null);
        }
    };

    const renderProp = (prop: ExtendedMapProp) => {
        const isSelected = selectedPropId === prop.id;
        const offset = monsterOffsets[prop.id] || { dx: 0, dy: 0, animFrame: 0 };

        // Calculate actual position with wandering offset for monsters
        const actualX = prop.type === 'monster' ? prop.x + offset.dx : prop.x;
        const actualY = prop.type === 'monster' ? prop.y + offset.dy : prop.y;

        return (
            <div
                key={prop.id}
                onMouseDown={async (e) => {
                    e.stopPropagation();
                    if (isAdmin) {
                        setSelectedPropId(prop.id);
                        setIsDragging(true);

                        const rect = containerRef.current?.getBoundingClientRect();
                        if (rect) {
                            const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
                            const mouseY = ((e.clientY - rect.top) / rect.height) * 100;
                            setDragOffset({ x: mouseX - prop.x, y: mouseY - prop.y });
                        }
                    } else {
                        // Interaction logic for non-admins (or left click)
                        if (prop.type === 'merchant' && prop.merchantId) {
                            // Show interaction bubble for merchants
                            const defaultMerchant = getMerchantById(prop.merchantId);
                            setInteractionTarget({
                                ...prop,
                                npcName: defaultMerchant?.name || 'Marchand',
                                canBuy: true,
                                canSell: (defaultMerchant?.sellMultiplier || 0) > 0,
                                canTalk: true
                            });
                        } else if (prop.type === 'monster' && prop.monsterId) {
                            // Show interaction bubble for monsters
                            const monsterData = monsters.find(m => m.id === prop.monsterId);
                            setInteractionTarget({
                                ...prop,
                                npcName: monsterData?.name || 'Monstre',
                                canTalk: !!prop.canTalk, // Some monsters may have dialogue
                            });
                        } else if (prop.droppedItemData) {
                            // --- PICKUP LOGIC ---
                            const item = prop.droppedItemData;

                            // Add to inventory
                            setInventory(prev => ({
                                ...prev,
                                items: [...prev.items, { ...item, id: `${item.id.split('_')[0]}_${Date.now()}` }]
                            }));

                            // Remove from world and save
                            setWorldProps(prev => {
                                const next = prev.filter(p => p.id !== prop.id);
                                if (mapBgUrl) {
                                    saveMap(mapCoords.x, mapCoords.y, mapBgUrl, next).catch(console.error);
                                }
                                return next;
                            });

                            // Visual feedback log
                            console.log(`Picked up ${item.name}!`);
                            // TODO: Show floating text "+1 [Item Name]"
                        }
                    }
                }}
                className={`absolute group transition-all ${prop.type === 'monster' && !isDragging ? 'duration-700 ease-in-out' : 'duration-0'} ${isSelected ? 'z-[90]' : ''}`}
                style={{
                    left: `${actualX}%`,
                    top: `${actualY}%`,
                    width: '1px',
                    height: '1px',
                    overflow: 'visible',
                    transform: `translate(-50%, -100%)`,
                    zIndex: isSelected ? 30000 : Math.floor(actualY * 100),
                    cursor: isAdmin ? (isDragging ? 'grabbing' : 'grab') : 'default'
                }}
            >
                {prop.type === 'tree' && (
                    <div className="animate-wind origin-bottom">
                        <CssTree variant={prop.variant} />
                    </div>
                )}
                {prop.type === 'rock' && <CssRock />}
                {prop.type === 'zaap' && <CssZaap />}
                {prop.type === 'trigger' && (
                    <div className="animate-float">
                        <CssPortal />
                        {prop.teleportCost && (
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-yellow-600 text-black text-[10px] px-1.5 rounded-full font-bold shadow-md border border-yellow-800">
                                {prop.teleportCost} Aros
                            </div>
                        )}
                    </div>
                )}
                {prop.type === 'merchant' && prop.merchantId && (
                    <div className={`relative flex items-end justify-center ${isSelected ? 'drop-shadow-[0_0_12px_rgba(255,191,0,1)]' : 'drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]'} transition-all hover:scale-105 duration-300`}>
                        <div className="flex items-end justify-center">
                            <SpritesheetAnimator 
                                entityId={getMerchantById(prop.merchantId)?.id || "alex"}
                                basePath=""
                                state={AnimationState.IDLE}
                                direction="S"
                                scale={1.8}
                                debug={showDebug}
                            />
                        </div>
                        <div className="absolute bottom-[130px] left-1/2 -translate-x-1/2 bg-gradient-to-b from-amber-500 to-amber-700 text-white text-[10px] px-3 py-1 rounded-full shadow-2xl uppercase font-black whitespace-nowrap border-2 border-amber-300/30 backdrop-blur-sm z-10">
                            {getMerchantById(prop.merchantId)?.name || 'Marchand'}
                        </div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-3 bg-black/40 rounded-full blur-md" />

                        {/* Interactive indicator for non-admins */}
                        {!isAdmin && (
                            <div className="absolute -top-16 left-1/2 -translate-x-1/2 animate-bounce">
                                <div className="bg-amber-500 p-1 rounded-lg border border-white shadow-lg">
                                    <ShoppingCart size={12} className="text-white" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {prop.type === 'monster' && prop.monsterId && (
                    <div className={`relative w-full h-full ${isSelected ? 'drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]' : 'drop-shadow-md'}`}>
                        {/* Monster sprite with subtle animation */}
                        <div
                            className="w-full h-full flex items-center justify-center"
                            style={{
                                transform: `scaleX(${offset.dx > 0 ? -1 : 1}) translateY(${Math.sin(offset.animFrame * 0.5) * 2}px)`
                            }}
                        >
                            {(() => {
                                // Use 'monsters' state to get the processed spriteUrl
                                const mData = monsters.find(m => m.id === prop.monsterId) as any;
                                if (!mData) return null;
                                return (
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none drop-shadow-xl flex items-end justify-center">
                                        <SpritesheetAnimator
                                            entityId={mData.id}
                                            state={
                                                offset.action === "Run" ? AnimationState.RUN :
                                                offset.action === "Walk" ? AnimationState.WALK :
                                                AnimationState.IDLE
                                            }
                                            direction={(offset.angle as any) || "S"}
                                            basePath={mData.spriteConfig?.malePath || ""}
                                            scale={1.8}
                                            debug={showDebug}
                                        />
                                    </div>
                                );
                            })()}
                        </div>
                        {/* Level indicator */}
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] px-1.5 rounded-full font-bold shadow-md border border-red-800">
                            Niv.{monsters.find(m => m.id === prop.monsterId)?.level}
                        </div>

                        {/* Aggro Circle - Red ring on ground for aggressive monsters */}
                        {(() => {
                            const monsterData = monsters.find(m => m.id === prop.monsterId) as any;
                            const isAggro = monsterData?.isAggressive;
                            const aggroRadius = monsterData?.aggroRadius || 10;
                            const playerDist = Math.sqrt(Math.pow(position.x - actualX, 2) + Math.pow(position.y - actualY, 2));
                            const isPlayerNear = playerDist < aggroRadius;

                            if (!isAggro) return null;

                            return (
                                <>
                                    {/* Ground aggro circle */}
                                    <div
                                        className={`absolute pointer-events-none transition-all duration-300 ${isPlayerNear ? 'opacity-80' : 'opacity-30'}`}
                                        style={{
                                            bottom: '-10px',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            width: `${aggroRadius * 6}px`,
                                            height: `${aggroRadius * 2}px`,
                                            borderRadius: '50%',
                                            border: `2px solid ${isPlayerNear ? '#ef4444' : '#991b1b'}`,
                                            background: isPlayerNear
                                                ? 'radial-gradient(ellipse, rgba(239,68,68,0.3) 0%, transparent 70%)'
                                                : 'radial-gradient(ellipse, rgba(153,27,27,0.15) 0%, transparent 70%)',
                                            animation: isPlayerNear ? 'pulse 1s ease-in-out infinite' : 'none'
                                        }}
                                    />
                                    {/* Warning icon when player is in range */}
                                    {isPlayerNear && (
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-red-500 animate-bounce">
                                            <Skull size={16} />
                                        </div>
                                    )}
                                </>
                            );
                        })()}

                        {/* Talk bubble indicator for monsters with dialogue */}
                        {(() => {
                            const monsterData = monsters.find(m => m.id === prop.monsterId) as any;
                            if (!monsterData?.canTalk) return null;

                            return (
                                <div className="absolute -top-2 -right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-pulse">
                                    <span className="text-white text-[10px]">💬</span>
                                </div>
                            );
                        })()}
                    </div>
                )}
                {prop.type === 'custom' && prop.imageUrl && !prop.droppedItemData && (
                    <div className="animate-float w-full h-full">
                        <img src={prop.imageUrl} className="w-full h-full object-contain" alt="prop" style={{ maxWidth: 'none' }} />
                    </div>
                )}

                {/* Render Dropped Items specifically */}
                {prop.droppedItemData && (
                    <div className="animate-bounce-slow relative group cursor-pointer w-full h-full flex items-center justify-center">
                        <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-md animate-pulse"></div>
                        <img
                            src={prop.imageUrl}
                            className="w-full h-full object-contain drop-shadow-xl z-10 transition-transform hover:scale-125"
                            alt={prop.name}
                            title={`Ramasser ${prop.name}`}
                        />
                        {/* Hover info */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20 border border-yellow-500/30">
                            {prop.name}
                        </div>
                    </div>
                )}

                {/* Collision Zone Rendering */}
                {prop.type === 'collision' && (
                    <div
                        className={`w-full h-full rounded border-2 border-dashed flex items-center justify-center transition-all ${isSelected
                            ? 'border-orange-400 bg-orange-500/60'
                            : 'border-orange-500/50 bg-orange-500/30 hover:bg-orange-500/40'
                            }`}
                        style={{
                            opacity: prop.collisionOpacity || 0.5,
                            transform: 'translate(0, 50%)'
                        }}
                    >
                        <Shield size={20} className="text-orange-300 drop-shadow-lg" />
                    </div>
                )}

                {isSelected && (
                    <div className="prop-controls absolute -top-14 left-1/2 -translate-x-1/2 flex gap-1 bg-stone-900/95 p-1.5 rounded-lg z-[100] shadow-xl border border-stone-600">
                        {/* Size controls */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setWorldProps(prev => prev.map(p => p.id === prop.id
                                    ? { ...p, width: Math.max(30, p.width - 10), height: Math.max(30, p.height - 10) }
                                    : p
                                ));
                            }}
                            className="p-1.5 hover:bg-stone-700 rounded text-stone-300 hover:text-white transition-colors"
                            title="Réduire"
                        >
                            <Minus size={12} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setWorldProps(prev => prev.map(p => p.id === prop.id
                                    ? { ...p, width: Math.min(300, p.width + 10), height: Math.min(300, p.height + 10) }
                                    : p
                                ));
                            }}
                            className="p-1.5 hover:bg-stone-700 rounded text-stone-300 hover:text-white transition-colors"
                            title="Agrandir"
                        >
                            <Plus size={12} />
                        </button>

                        {/* Separator */}
                        <div className="w-px bg-stone-600 mx-0.5" />

                        {/* Move indicator */}
                        <div className="p-1.5 text-stone-500 cursor-move" title="Glisser pour déplacer">
                            <GripVertical size={12} />
                        </div>

                        {/* Separator */}
                        <div className="w-px bg-stone-600 mx-0.5" />

                        {/* Delete */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProp(prop.id);
                            }}
                            className="p-1.5 hover:bg-red-600 rounded text-red-400 hover:text-white transition-colors"
                            title="Supprimer"
                        >
                            <Trash2 size={12} />
                        </button>

                        {/* Trigger Config */}
                        {prop.type === 'trigger' && (
                            <div className="flex items-center gap-1 border-l border-stone-700 pl-1 ml-1">
                                <span className="text-[8px] text-stone-500 font-bold px-1">Vers:</span>
                                <input
                                    type="number"
                                    className="w-10 bg-stone-800 text-[10px] text-white px-1 rounded border border-stone-600 focus:border-blue-500 outline-none"
                                    value={prop.targetMap?.x ?? 0}
                                    onChange={(e) => {
                                        const xVal = parseInt(e.target.value);
                                        setWorldProps(prev => prev.map(p => p.id === prop.id ? { ...p, targetMap: { ...p.targetMap!, x: xVal } } : p));
                                    }}
                                />
                                <input
                                    type="number"
                                    className="w-10 bg-stone-800 text-[10px] text-white px-1 rounded border border-stone-600 focus:border-blue-500 outline-none"
                                    value={prop.targetMap?.y ?? 0}
                                    onChange={(e) => {
                                        const yVal = parseInt(e.target.value);
                                        setWorldProps(prev => prev.map(p => p.id === prop.id ? { ...p, targetMap: { ...p.targetMap!, y: yVal } } : p));
                                    }}
                                />
                                {prop.teleportCost !== undefined && (
                                    <>
                                        <span className="text-[8px] text-stone-500 font-bold px-1">Coût:</span>
                                        <input
                                            type="number"
                                            className="w-10 bg-stone-800 text-[10px] text-white px-1 rounded border border-stone-600 focus:border-blue-500 outline-none"
                                            value={prop.teleportCost ?? 0}
                                            onChange={(e) => {
                                                const costVal = parseInt(e.target.value);
                                                setWorldProps(prev => prev.map(p => p.id === prop.id ? { ...p, teleportCost: costVal } : p));
                                            }}
                                        />
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Resize handle (Bottom Right) */}
                {isSelected && isAdmin && (
                    <div
                        className="resize-handle absolute -right-1 -bottom-1 w-3 h-3 bg-white border-2 border-stone-800 rounded-full cursor-nwse-resize z-[101] shadow-md hover:scale-125 transition-transform"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            setIsResizing(true);
                            setIsDragging(false);
                        }}
                    />
                )}
            </div>
        );
    };

    // --- RENDER ---
    return (
        <div
            className="w-full h-full relative overflow-hidden bg-black font-sans select-none"
            onClick={handleMapClick}
            onMouseMove={handleMapMouseMove}
            onMouseUp={handleMapMouseUp}
            onMouseLeave={handleMapMouseUp}
        >

            {/* WORLD PROPS (Trees, Monsters, etc.) - Hidden during combat for clarity, or kept? Dofus hides them usually or fades them. */}


            {/* PLAYER CHARACTER (Exploration Mode) */}
            {!isInCombat && (
                <div
                    className="absolute pointer-events-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] flex items-end justify-center"
                    style={{
                        left: `${position.x}%`,
                        top: `${position.y}%`,
                        width: '1px',  // Size is irrelevant due to overflow: visible
                        height: '1px',
                        overflow: 'visible',
                        transform: 'translate(-50%, -100%)',
                        zIndex: Math.floor(position.y * 100) + 10 // High precision Y-sorting
                    }}
                >
                    {/* Player Name Tag */}
                    <div className="absolute bottom-[140px] left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/60 text-white text-[10px] px-3 py-1 rounded-full z-[100] border border-white/10 shadow-lg font-black uppercase tracking-widest">
                        {character.name}
                    </div>

                    <SpritesheetAnimator
                        entityId={classData.id}
                        layers={[
                            { id: 'body', basePath: classData.spriteConfig?.malePath || "", priority: 1, isVisible: true },
                            // Multiple layers synchronized (Head, Weapon, etc.)
                        ]}
                        state={
                            animation === "Run" ? AnimationState.RUN :
                            animation === "Walk" ? AnimationState.WALK :
                            animation === "Jump" ? AnimationState.JUMP :
                            AnimationState.IDLE
                        }
                        direction={(angle as any) || "S"}
                        scale={1.8}
                        visualOffset={{ x: 0, y: -10 }} // Small adjustment for foot alignment
                        debug={showDebug}
                        onAnimationEnd={() => setAnimation("Idle")}
                    />
                </div>
            )}
            {placingItem && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[200] bg-lime-500/90 text-black px-4 py-2 rounded-full font-bold animate-pulse flex items-center gap-2 pointer-events-none">
                    <MousePointer2 size={16} /> Placez : {placingItem.name}
                </div>
            )}

            {/* COMBAT SYSTEM IS NOW INTEGRATED IN VIEWPORT */}

            {/* ... Navigation Arrows (Same as before) ... */}

            {/* ACTIVE FIGHT MARKERS (Crossed Swords) */}
            {activeFightMonsters.length > 0 && !isInCombat && (
                <div
                    className="absolute z-50 animate-bounce pointer-events-auto cursor-pointer group"
                    style={{
                        left: `${position.x}%`,
                        top: `${position.y}%`,
                        transform: 'translate(-50%, -100%)'
                    }}
                    onClick={() => setIsInCombat(true)} // Click to join/view
                >
                    <div className="relative">
                        <Swords size={48} className="text-red-500 drop-shadow-[0_0_10px_rgba(255,0,0,0.8)] fill-current" />
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            Combat en cours !
                        </div>
                    </div>
                </div>
            )}

            {/* ========== WORLD HUD ========== */}
            {showWorldHUD && (
                <>
                    {/* HUD TOP - Player Stats Bar */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 bg-stone-900/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl px-8 py-3 shadow-[0_10px_60px_rgba(0,0,0,0.8)]">
                        {/* Character Portrait with Frame */}
                        <div className="relative w-16 h-16 group">
                            <img
                                src="/textures/ui/portrait_frame.png"
                                className="absolute inset-0 w-full h-full z-10 pointer-events-none drop-shadow-lg"
                                alt="Frame"
                            />
                            <div className="absolute inset-2 rounded-xl bg-stone-900 overflow-hidden flex items-center justify-center shadow-inner border border-white/10">
                                {/* Black & White Checkerboard Background */}
                                <div
                                    className="absolute inset-0 opacity-40"
                                    style={{
                                        backgroundImage: 'conic-gradient(#333 90deg, #fff 90deg 180deg, #333 180deg 270deg, #fff 270deg)',
                                        backgroundSize: '12px 12px'
                                    }}
                                ></div>

                                {(() => {
                                    const useSplitSprites = classData.spriteConfig?.useSplitSprites;
                                    const spriteFolder = ['M', 'male'].includes(character.gender as any)
                                        ? classData.spriteConfig?.maleSpritesFolder
                                        : classData.spriteConfig?.femaleSpritesFolder;

                                    if (useSplitSprites && spriteFolder) {
                                        // Use the first sprite (usually front-facing) for portrait
                                        const headSpriteUrl = `${spriteFolder}/1.png`;
                                        return (
                                            <div className="w-[200%] h-[200%] absolute top-[-10%] flex items-center justify-center">
                                                <ColoredSprite
                                                    src={headSpriteUrl}
                                                    colors={{
                                                        hair: character.colors.hair,
                                                        eyes: character.colors.eyes,
                                                        skin: character.colors.skin,
                                                        jacket: character.colors.jacket,
                                                        pants: character.colors.pants,
                                                        shoes: character.colors.shoes,
                                                    }}
                                                    className="w-full h-full object-contain pixelated relative z-10"
                                                    alt="Portrait"
                                                />
                                            </div>
                                        );
                                    } else if (spriteUrl) {
                                        return (
                                            <img
                                                src={spriteUrl}
                                                className="w-[450%] h-[450%] max-w-none absolute top-[-25%] left-[-175%] pixelated z-10"
                                                alt="Portrait"
                                            />
                                        );
                                    } else {
                                        return (
                                            <div className="w-full h-full flex items-center justify-center bg-stone-800 text-white font-black text-xl relative z-10">
                                                ?
                                            </div>
                                        );
                                    }
                                })()}
                            </div>
                            {/* Level Badge Overlay */}
                            <div className="absolute -bottom-1 -right-1 z-20 bg-lime-500 text-black text-[10px] px-2 py-0.5 rounded-md font-black shadow-md border border-lime-300">
                                {playerStats.niveau}
                            </div>
                        </div>

                        {/* Stats Container */}
                        <div className="flex flex-col gap-2 min-w-[180px]">
                            {/* Name & Class */}
                            <div className="flex items-baseline gap-2">
                                <span className="font-black text-white text-base tracking-tight uppercase">{character.name}</span>
                                <span className="text-lime-400/80 text-[10px] font-bold uppercase tracking-widest">{classData.name}</span>
                            </div>

                            {/* HP Bar */}
                            <div className="flex flex-col gap-0.5">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter">Vitalité</span>
                                    <span className="text-[9px] text-white/70 font-mono">{playerStats.hp}/{playerStats.maxHp}</span>
                                </div>
                                <div className="relative w-full h-3 bg-stone-950 rounded-full border border-stone-800 overflow-hidden shadow-inner">
                                    <img
                                        src="/textures/ui/health_bar.png"
                                        className="absolute left-0 top-0 h-full object-cover transition-all duration-500"
                                        style={{ width: `${(playerStats.hp / playerStats.maxHp) * 100}%` }}
                                        alt="HP Fill"
                                    />
                                </div>
                            </div>

                            {/* XP Bar */}
                            <div className="flex flex-col gap-0.5">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter">Expérience</span>
                                    <span className="text-[9px] text-white/70 font-mono">{Math.floor((playerStats.experience / playerStats.experienceMax) * 100)}%</span>
                                </div>
                                <div className="relative w-full h-2 bg-stone-950 rounded-full border border-stone-800 overflow-hidden shadow-inner">
                                    <img
                                        src="/textures/ui/xp_bar.png"
                                        className="absolute left-0 top-0 h-full object-cover transition-all duration-300"
                                        style={{ width: `${(playerStats.experience / playerStats.experienceMax) * 100}%` }}
                                        alt="XP Fill"
                                    />
                                </div>
                            </div>

                            {/* Aros (Currency) */}
                            <div className="flex items-center gap-2 mt-1 px-1">
                                <img src="/textures/ui/currency_aros.png" className="w-5 h-5 drop-shadow-md" alt="Aros" />
                                <span className="text-sm font-black text-yellow-500 tracking-tight">{inventory.aros?.toLocaleString() || 0}</span>
                                <span className="text-[9px] text-yellow-600 font-bold uppercase">Aros</span>
                            </div>
                        </div>

                        {/* Map Coords & Region */}
                        <div className="flex flex-col items-center border-l border-stone-700 pl-4">
                            <div className="text-[8px] font-black uppercase tracking-wider mb-0.5" style={{ color: currentRegion.color }}>{currentRegion.name}</div>
                            <div className="flex items-center gap-1">
                                <MapIcon size={12} className="text-lime-400" />
                                <span className="text-[10px] font-bold text-lime-400">{mapCoords.x},{mapCoords.y}</span>
                            </div>
                            <button onClick={() => setShowRegionMap(true)} className="text-[7px] text-stone-500 hover:text-blue-400 mt-1 underline">[M] Carte</button>
                        </div>
                    </div>

                    {/* HUD RIGHT - Quick Actions & Settings */}
                    <div className="absolute top-4 right-4 z-[100] flex flex-col gap-2">
                        <button
                            onClick={() => setShowDebug(!showDebug)}
                            className="w-10 h-10 bg-stone-900/90 border border-stone-600 rounded-lg flex items-center justify-center hover:border-lime-500 transition-colors"
                            title="Debug"
                        >
                            <Bug size={18} className="text-stone-400" />
                        </button>
                        <button
                            onClick={() => setShowWorldHUD(false)}
                            className="w-10 h-10 bg-stone-900/90 border border-stone-600 rounded-lg flex items-center justify-center hover:border-red-500 transition-colors"
                            title="Masquer HUD"
                        >
                            <X size={18} className="text-stone-400" />
                        </button>
                    </div>
                </>
            )}

            {/* Show HUD button when hidden */}
            {!showWorldHUD && (
                <button
                    onClick={() => setShowWorldHUD(true)}
                    className="absolute top-4 right-4 z-[100] bg-stone-900/50 border border-stone-600 px-3 py-1 rounded text-xs text-stone-400 hover:text-white"
                >
                    Afficher HUD
                </button>
            )}

            {/* HUD Left - Creation Tools (Reserved for Admin) */}
            {isAdmin && (
                <div className="absolute top-24 left-4 z-[100] flex flex-col gap-4 items-start pointer-events-auto">

                    <div className="relative">
                        <button onClick={() => setIsBankOpen(!isBankOpen)} className="flex items-center gap-2 bg-stone-900/90 border border-stone-600 text-stone-200 px-3 py-2 rounded shadow-lg hover:border-lime-500 transition-colors">
                            <Package size={18} /> <span className="text-xs font-bold uppercase">Création / Bestiaire</span>
                        </button>
                        {isBankOpen && (
                            <div className="absolute top-12 left-0 w-[300px] bg-stone-900/95 border-2 border-stone-600 rounded-lg shadow-2xl p-3 flex flex-col gap-3 backdrop-blur-sm animate-in slide-in-from-left-2 fade-in max-h-[80vh] overflow-y-auto">
                                <div className="flex justify-between items-center border-b border-stone-700 pb-2">
                                    <span className="text-xs font-bold uppercase text-stone-400">Ajouter...</span>
                                    <button onClick={() => setIsBankOpen(false)} className="text-stone-500 hover:text-white"><X size={14} /></button>
                                </div>

                                {/* FACTION MAPS SECTION */}
                                <div className="bg-blue-900/20 p-2 rounded border border-blue-900/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1"><MapIcon size={12} /> Cartes de Faction</div>
                                        <button onClick={handleSaveFactionMap} className="bg-blue-600 hover:bg-blue-500 text-[8px] px-2 py-0.5 rounded text-white flex gap-1 items-center" title="Sauvegarder la carte actuelle comme Map Faction"><Sparkles size={8} /> Sauvegarder Actuelle</button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Presets */}
                                        {FACTION_MAPS_PRESETS.map(map => (
                                            <button key={map.id} onClick={() => handleLoadFactionMap(map)} className="bg-stone-800 border border-stone-600 hover:border-blue-400 p-1 rounded text-left group relative h-16 overflow-hidden">
                                                {/* Placeholder Pattern since we don't have static assets */}
                                                <div className={`absolute inset-0 opacity-30 ${map.theme === 'forest' ? 'bg-green-500' : map.theme === 'alien' ? 'bg-purple-500' : map.theme === 'desert' ? 'bg-yellow-500' : 'bg-cyan-500'}`} />
                                                <span className="relative z-10 text-[9px] font-bold text-stone-200 block shadow-black drop-shadow-md">{map.name}</span>
                                                <span className="relative z-10 text-[7px] text-stone-400 block pt-1 leading-tight group-hover:text-blue-300">Générer (Preset)</span>
                                            </button>
                                        ))}
                                        {/* User Saved */}
                                        {factionMaps.map((map, idx) => (
                                            <button key={map.id || idx} onClick={() => handleLoadFactionMap(map)} className="bg-stone-800 border border-blue-500/30 hover:border-blue-400 p-1 rounded text-left group relative h-16 overflow-hidden">
                                                {map.imageUrl && <img src={map.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity" alt={map.name} />}
                                                <span className="relative z-10 text-[9px] font-bold text-white block shadow-black drop-shadow-md bg-black/50 px-1 rounded">{map.name}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteFactionMap(map.id); setFactionMaps(prev => prev.filter(m => m.id !== map.id)); }}
                                                    className="absolute top-1 right-1 z-20 text-red-400 hover:text-red-200 bg-black/50 rounded-full p-0.5"
                                                >
                                                    <X size={8} />
                                                </button>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* TRIGGERS / PORTALS SECTION */}
                                <div className="bg-blue-900/20 p-2 rounded border border-blue-900/50">
                                    <div className="text-[10px] font-bold text-blue-400 uppercase mb-2 flex items-center gap-1"><Sparkles size={12} /> Triggers / Portails</div>
                                    <p className="text-[8px] text-stone-500 mb-2">Placez un portail puis configurez ses coordonnées de destination.</p>
                                    <button
                                        onClick={() => startPlacement({ id: 'obj_trigger_portal', name: 'Portail de Transfert', url: '', type: 'trigger' })}
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-[10px] font-bold uppercase flex items-center justify-center gap-2 mb-1"
                                    >
                                        <Plus size={14} /> Portail (Zaap Local)
                                    </button>
                                    <button
                                        onClick={() => startPlacement({ id: 'obj_teleport_beacon', name: 'Balise de Téléport (10 Aros)', url: '', type: 'trigger' })}
                                        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded text-[10px] font-bold uppercase flex items-center justify-center gap-2"
                                    >
                                        <Plus size={14} /> Balise de Téléport (10 Aros)
                                    </button>
                                </div>

                                {/* NPC MERCHANTS SECTION */}
                                <div className="bg-amber-900/20 p-2 rounded border border-amber-900/50">
                                    <div className="text-[10px] font-bold text-amber-400 uppercase mb-2 flex items-center gap-1"><Package size={12} /> Marchands PNJ</div>
                                    <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto">
                                        {DEFAULT_MERCHANTS.map(m => (
                                            <button
                                                key={m.id}
                                                onClick={() => startPlacement({ ...m, merchantId: m.id })}
                                                className="bg-stone-800 border border-stone-600 hover:border-amber-500 p-1.5 rounded flex items-center gap-2 group"
                                            >
                                                <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-500/30">
                                                    <img src={m.spriteUrl} alt={m.name} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="text-left overflow-hidden">
                                                    <div className="text-[8px] font-bold text-white truncate">{m.name}</div>
                                                    <div className="text-[6px] text-stone-500 uppercase">{m.type}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* COLLISION ZONES SECTION */}
                                <div className="bg-orange-900/20 p-2 rounded border border-orange-900/50">
                                    <div className="text-[10px] font-bold text-orange-400 uppercase mb-2 flex items-center gap-1"><Shield size={12} /> Zones de Collision</div>
                                    <p className="text-[8px] text-stone-500 mb-2">Placez des obstacles invisibles pour bloquer le passage.</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => startPlacement({
                                                id: 'collision_zone_' + Date.now(),
                                                name: 'Zone de Collision',
                                                type: 'collision',
                                                isCollisionZone: true
                                            })}
                                            className="flex-1 flex items-center gap-2 bg-stone-800 border border-orange-500/50 rounded p-2 hover:bg-orange-900/50 transition-colors"
                                        >
                                            <div className="w-8 h-8 bg-orange-500/20 rounded flex items-center justify-center border border-orange-400">
                                                <Shield size={14} className="text-orange-300" />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-[10px] font-bold text-white">Zone Bloquante</div>
                                                <div className="text-[8px] text-stone-400">Obstacle invisible</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* MONSTER BANK SECTION */}
                                <div className="bg-red-900/20 p-2 rounded border border-red-900/50">
                                    <div className="text-[10px] font-bold text-red-400 uppercase mb-2 flex items-center gap-1"><Skull size={12} /> Monstres (Combat)</div>
                                    <div className="flex gap-2 overflow-x-auto">
                                        {monsters.map(m => (
                                            <button key={m.id} onClick={() => startPlacement(m)} className="min-w-[40px] w-10 h-10 bg-stone-800 border border-red-500/50 rounded hover:bg-stone-200 flex items-center justify-center relative group overflow-hidden" title={m.name}>
                                                <img
                                                    src={m.spriteUrl}
                                                    className="w-full h-full object-contain"
                                                    style={{ imageRendering: 'pixelated' }}
                                                    alt={m.name}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* NEW DYNAMIC PROPS SECTION */}
                                <div className="bg-lime-900/20 p-2 rounded border border-lime-900/50">
                                    <div className="text-[10px] font-bold text-lime-400 uppercase mb-2 flex items-center gap-1"><Package size={12} /> Bibliothèque d'Objets (Local)</div>
                                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                                        {PROP_FOLDERS.map(folder => (
                                            <button
                                                key={folder}
                                                onClick={() => startPlacement({
                                                    id: `prop_${folder}_${Date.now()}`,
                                                    name: folder.replace(/_/g, ' '),
                                                    imageUrl: `/textures/new_asset/asset_principal/props/${folder}/${folder}.png`,
                                                    type: 'custom'
                                                })}
                                                className="aspect-square bg-stone-800 border border-stone-600 rounded flex items-center justify-center hover:border-lime-500 hover:bg-stone-700 transition-all group overflow-hidden"
                                                title={folder}
                                            >
                                                <img 
                                                    src={`/textures/new_asset/asset_principal/props/${folder}/${folder}.png`} 
                                                    className="w-full h-full object-contain pixelated group-hover:scale-110 transition-transform" 
                                                    alt={folder}
                                                    onError={(e) => {
                                                        (e.target as any).src = '/textures/ui/portal.png';
                                                    }}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[7px] text-stone-500 mt-2 italic text-center">Tous les assets sont chargés dynamiquement depuis /new_asset/</p>
                                </div>

                                {/* Generated Objects Gallery */}
                                {bankItems.length > 0 && (
                                    <div className="border-t border-stone-700 pt-2 mt-2">
                                        <div className="text-[8px] text-stone-500 mb-1">Cliquez pour placer :</div>
                                        <div className="flex gap-1 flex-wrap max-h-24 overflow-y-auto">
                                            {bankItems.map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => startPlacement(item)}
                                                    className="w-12 h-12 bg-stone-800 border border-lime-500/30 rounded hover:border-lime-500 hover:scale-105 overflow-hidden transition-all relative group"
                                                    title={item.name}
                                                >
                                                    <img
                                                        src={item.url}
                                                        className="w-full h-full object-contain"
                                                        alt={item.name}
                                                        style={{ maxWidth: 'none' }}
                                                    />
                                                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                        <span className="text-[6px] text-white text-center px-0.5">{item.name}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}


                                {/* QUICK ACTIONS */}
                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    <button onClick={() => setShowRegionMap(true)} className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-500 py-2 rounded text-[8px] font-bold uppercase text-white shadow-lg transition-all active:scale-95">
                                        <MapIcon size={12} /> Carte (M)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Menu Carte des Régions (touche M) : Ville (10), Extérieur (10), Donjon (5) par région */}
            {showRegionMap && (
                <div className="absolute inset-0 z-[1000] bg-black/95 backdrop-blur-md flex flex-col p-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tight">CARTE DES RÉGIONS</h2>
                            <p className="text-stone-400 text-sm font-mono">Ville (max 10) · Extérieur (max 10) · Donjon (max 5) par région</p>
                        </div>
                        <button onClick={() => setShowRegionMap(false)} className="w-12 h-12 bg-stone-800 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto custom-scrollbar space-y-8">
                        {REGIONS.map(region => {
                            const limits = { ville: MAX_MAPS_VILLE, exterieur: MAX_MAPS_EXTERIEUR, donjon: MAX_MAPS_DONJON };
                            const labels = { ville: 'Ville', exterieur: 'Extérieur', donjon: 'Donjon' };
                            return (
                                <div key={region.id} className="bg-stone-900/70 rounded-xl border border-white/10 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3" style={{ borderLeft: `4px solid ${region.color}` }}>
                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: region.color }} />
                                        <h3 className="text-lg font-bold text-white uppercase tracking-wider">{region.name}</h3>
                                        <span className="text-stone-500 text-xs">{region.description}</span>
                                    </div>
                                    <div className="p-4 grid grid-cols-3 gap-6">
                                        {(['ville', 'exterieur', 'donjon'] as const).map(mapType => (
                                            <div key={mapType}>
                                                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">{labels[mapType]} (max {limits[mapType]})</h4>
                                                <div className="grid grid-cols-5 gap-2">
                                                    {Array.from({ length: limits[mapType] }, (_, index) => {
                                                        const key = getRegionMapKey(region.id, mapType, index);
                                                        const saved = allWorldMaps.find((m: any) => m.id === key);
                                                        const isGenerating = generatingRegionSlot?.regionId === region.id && generatingRegionSlot?.mapType === mapType && generatingRegionSlot?.index === index;
                                                        return (
                                                            <div key={key} className="aspect-video rounded-lg border border-stone-700 overflow-hidden bg-stone-800">
                                                                {saved?.imageUrl ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setMapBgUrl(saved.imageUrl);
                                                                            setWorldProps(saved.props || []);
                                                                            setShowRegionMap(false);
                                                                        }}
                                                                        className="relative w-full h-full block group"
                                                                    >
                                                                        <img src={saved.imageUrl} alt="" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                                                                        <span className="absolute bottom-0 left-0 right-0 text-[9px] bg-black/70 text-white py-0.5 text-center opacity-0 group-hover:opacity-100 transition-opacity">Charger</span>
                                                                    </button>
                                                                ) : (
                                                                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-stone-600">
                                                                            <MapIcon size={14} />
                                                                            <span className="text-[9px] font-bold uppercase">Slot Vide</span>
                                                                        </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Lien vers les cartes monde (coords x,y) */}
                        <div className="bg-stone-900/50 rounded-xl border border-dashed border-stone-600 p-4">
                            <h4 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-3">Cartes monde (exploration)</h4>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                                <button
                                    onClick={() => { setMapCoords({ x: 0, y: 0 }); setPosition({ x: 50, y: 50 }); loadMap(0, 0); setShowRegionMap(false); }}
                                    className="aspect-square rounded-lg bg-stone-800 border border-stone-600 flex flex-col items-center justify-center gap-1 hover:border-white text-stone-400 hover:text-white"
                                >
                                    <ArrowUp size={20} />
                                    <span className="text-[9px] font-bold uppercase">Point Zéro</span>
                                </button>
                                {allWorldMaps.filter((m: any) => m.id && String(m.id).includes(',')).map((map: any) => {
                                    const [mx, my] = map.id.split(',').map(Number);
                                    const isCurrent = mx === mapCoords.x && my === mapCoords.y;
                                    return (
                                        <button
                                            key={map.id}
                                            onClick={() => { setMapCoords({ x: mx, y: my }); setPosition({ x: 50, y: 50 }); loadMap(mx, my); setShowRegionMap(false); }}
                                            className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all hover:scale-105 ${isCurrent ? 'border-yellow-400 ring-2 ring-yellow-400/30' : 'border-stone-600 hover:border-white'}`}
                                        >
                                            <img src={map.imageUrl} className="w-full h-full object-cover opacity-80" alt={map.id} />
                                            <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-[9px] font-mono text-white text-center">[{map.id}]</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Viewport */}
            <div
                ref={containerRef}
                className="w-full h-full relative bg-[#76a928] origin-center transition-transform duration-500 ease-out"
                style={{
                    transform: isInCombat ? 'none' : 'scale(1.0)',
                    cursor: placingItem ? 'crosshair' : 'default'
                }}
                onClick={handleMapClick}
                onMouseMove={handleMapMouseMove}
                onMouseDown={handleMapMouseDown}
                onMouseUp={handleMapMouseUp}
                onKeyDown={(e) => {
                    if (e.key.toLowerCase() === 'm') setShowRegionMap(!showRegionMap);
                    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPropId && isAdmin) {
                        handleDeleteProp(selectedPropId);
                    }
                }}
                tabIndex={0}
            >
                {/* Shadow of item being placed */}
                {placingItem && isAdmin && (
                    <div
                        className="absolute z-[110] animate-in fade-in zoom-in slide-in-from-bottom-5 duration-300 pointer-events-none opacity-60"
                        style={{
                            left: `${currentMousePos.x}%`,
                            top: `${currentMousePos.y}%`,
                            width: placingItem.type === 'collision' ? '60px' : '80px',
                            height: placingItem.type === 'collision' ? '60px' : '80px',
                            transform: 'translate(-50%, -100%)'
                        }}
                    >
                        {placingItem.type === 'collision' ? (
                            <div className="w-full h-full border-2 border-dashed border-orange-400 bg-orange-500/30 flex items-center justify-center rounded">
                                <Shield size={20} className="text-orange-300" />
                            </div>
                        ) : placingItem.type === 'monster' ? (
                            <div className="w-full h-full bg-red-500/20 rounded-full border-2 border-red-500 animate-pulse" />
                        ) : placingItem.type === 'merchant' ? (
                            <div className="w-full h-full bg-amber-500/20 rounded-full border-2 border-amber-500 animate-bounce flex items-center justify-center">
                                <Coins size={24} className="text-amber-400" />
                            </div>
                        ) : (
                            <img src={placingItem.url} className="w-full h-full object-contain" alt="preview" />
                        )}
                    </div>
                )}
                {/* MAP BG */}
                <div className="absolute inset-0 pointer-events-none transition-opacity duration-1000">
                    {isGeneratingMap && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
                            <div className="text-white text-xl animate-pulse">Génération de la carte...</div>
                        </div>
                    )}
                    {mapBgUrl ? (
                        <img
                            src={mapBgUrl}
                            className="w-full h-full object-cover"
                            onLoad={() => console.log('[Map] Image loaded successfully')}
                            onError={(e) => {
                                console.error('[Map] Image failed to load!', e);
                                setMapBgUrl(null); // Reset to trigger regeneration
                            }}
                            alt="Map background"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-[#76a928] flex items-center justify-center">
                            <span className="text-white/50 text-sm">Pas de carte chargée</span>
                        </div>
                    )}
                </div>


                {/* WORLD PROPS - Filtered to avoid ghost player */}
                {!isInCombat && worldProps.filter(p => p.id !== 'player' && p.id !== (character as any).id).map(renderProp)}

                {/* COMBAT SYSTEM (In-situ overlay) */}
                {isInCombat && (
                    <TacticalCombatScene
                        playerData={{
                            ...character,
                            level: playerStats.niveau,
                            stats: playerStats,
                            spells: playerSpells,
                            spriteUrl: spriteUrl || undefined,
                            gender: character.gender,
                            splitSpritesFolder: classData?.spriteConfig?.useSplitSprites
                                ? (['M', 'male'].includes(character.gender as any)
                                    ? classData.spriteConfig.maleSpritesFolder
                                    : classData.spriteConfig.femaleSpritesFolder)
                                : undefined
                        }}
                        monsters={activeFightMonsters.map(m => ({
                            monsterId: m.monsterId,
                            level: playerStats.niveau + Math.floor(Math.random() * 3) - 1
                        }))}
                        onCombatEnd={handleCombatEnd}
                        mapType="forest"
                        mapProps={worldProps}
                        processedMonsterBank={monsters}
                    />
                )}


            </div>
            {/* --- ESCAPE MENU OVERLAY --- */}
            {isMenuOpen && (
                <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
                    <div className="w-96 bg-stone-900 border-4 border-stone-700 rounded-2xl p-8 shadow-2xl flex flex-col gap-4 text-center">
                        <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-6">Pause</h2>

                        {isSettingsOpen ? (
                            <div className="flex flex-col gap-4 animate-in slide-in-from-right">
                                <h3 className="text-xl text-emerald-400 font-bold uppercase">Paramètres</h3>
                                <div className="p-4 bg-black/40 rounded-lg text-stone-400 text-sm">
                                    Options audio et graphiques (À venir)
                                </div>
                                <button
                                    onClick={() => setIsSettingsOpen(false)}
                                    className="mt-4 px-6 py-3 bg-stone-700 hover:bg-stone-600 text-white font-bold rounded-lg uppercase tracking-wider"
                                >
                                    Retour
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => setIsMenuOpen(false)}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-lg shadow-lg hover:translate-y-[-2px] transition-all"
                                >
                                    Reprendre
                                </button>

                                <button
                                    onClick={() => { saveProgress(); setIsMenuOpen(false); }}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-lg shadow-lg hover:translate-y-[-2px] transition-all flex items-center justify-center gap-2"
                                >
                                    <Save size={20} /> Sauvegarder
                                </button>

                                <button
                                    onClick={() => setIsSettingsOpen(true)}
                                    className="w-full py-4 bg-stone-700 hover:bg-stone-600 text-stone-200 font-bold uppercase tracking-widest rounded-lg transition-all"
                                >
                                    Paramètres
                                </button>

                                <div className="h-px bg-stone-700 my-2"></div>

                                <button
                                    onClick={async () => {
                                        console.log('[GameWorld] Saving before logout...');
                                        await saveProgress();
                                        console.log('[GameWorld] Save complete, logging out.');
                                        onExit();
                                    }}
                                    className="w-full py-4 bg-red-900/50 hover:bg-red-800 text-red-200 hover:text-white font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2"
                                >
                                    <LogOut size={20} /> Déconnexion
                                </button>

                                <button
                                    onClick={async () => {
                                        console.log('[GameWorld] Saving before quit...');
                                        await saveProgress();
                                        console.log('[GameWorld] Save complete, quitting.');
                                        window.close();
                                    }}
                                    className="w-full py-4 bg-transparent hover:bg-red-950 text-red-500 hover:text-red-400 font-bold uppercase tracking-widest rounded-lg transition-all"
                                >
                                    Quitter le jeu
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* --- SAVE INDICATOR --- */}
            {isSaving && (
                <div className="absolute top-4 right-4 z-[100] bg-black/60 text-white px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
                    <Save size={16} className="text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-widest">Sauvegarde...</span>
                </div>
            )}

            {/* Menus (C/S/I) */}
            <CharacterMenu
                isOpen={characterMenuOpen}
                onClose={() => setCharacterMenuOpen(false)}
                stats={playerStats}
                statPoints={statPoints}
                onAllocateStat={handleAllocateStat}
                characterName={character.name}
                className={classData.name}
                level={playerStats.niveau}
            />

            <SpellMenu
                isOpen={spellMenuOpen}
                onClose={() => setSpellMenuOpen(false)}
                spells={playerSpells}
                spellPoints={spellPoints}
                playerLevel={playerStats.niveau}
                onUpgradeSpell={handleUpgradeSpell}
            />

            <InventoryMenu
                isOpen={inventoryMenuOpen}
                onClose={() => setInventoryMenuOpen(false)}
                inventory={inventory}
                equipment={equipment}
                onEquipItem={handleEquipItem}
                onUnequipItem={handleUnequipItem}
                onUseItem={handleUseItem}
                onDropItem={handleDropItem}
                onUpdateItem={handleUpdateItem}
                apiKey={apiKey}
                backupApiKey={backupApiKey}
            />

            {activeMerchant && (
                <MerchantMenu
                    merchant={activeMerchant}
                    playerInventory={inventory}
                    onBuy={handleBuy}
                    onSell={handleSell}
                    onClose={() => setActiveMerchant(null)}
                    apiKey={apiKey}
                    backupApiKey={backupApiKey}
                />
            )}

            {/* Interaction Bubble for Monsters/NPCs */}
            {interactionTarget && (
                <InteractionBubble
                    target={{
                        type: interactionTarget.type === 'merchant' ? 'merchant' : interactionTarget.type === 'monster' ? 'monster' : 'npc',
                        id: interactionTarget.id,
                        name: interactionTarget.npcName || interactionTarget.monsterId || 'Entité',
                        canTalk: interactionTarget.canTalk,
                        canBuy: interactionTarget.canBuy,
                        canSell: interactionTarget.canSell
                    }}
                    position={{ x: interactionTarget.x, y: interactionTarget.y }}
                    onAction={handleInteraction}
                    onClose={() => setInteractionTarget(null)}
                />
            )}

            {/* Dialogue System */}
            {activeDialogue && (
                <DialogueSystem
                    dialogue={activeDialogue.dialogue}
                    speakerName={activeDialogue.speakerName}
                    speakerImage={activeDialogue.speakerImage}
                    onClose={() => setActiveDialogue(null)}
                    onAction={handleDialogueAction}
                    playerName={character.name}
                />
            )}

            {/* COMBAT REPORT MODAL */}
            {combatReport && (
                <div className="absolute inset-0 z-[300] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-stone-900 border-2 border-amber-600 rounded-lg max-w-md w-full p-6 shadow-2xl relative flex flex-col items-center gap-4">

                        {/* Header */}
                        <div className="text-3xl font-black uppercase tracking-widest" style={{ color: combatReport.victory ? '#84cc16' : '#ef4444', textShadow: '0 0 20px currentColor' }}>
                            {combatReport.victory ? 'Victoire !' : 'Défaite...'}
                        </div>

                        {/* Rewards Grid */}
                        <div className="w-full grid grid-cols-2 gap-4 mt-2">
                            {/* XP */}
                            <div className="bg-stone-800 p-3 rounded border border-stone-700 flex flex-col items-center gap-1">
                                <Star className="text-yellow-400" size={24} />
                                <span className="text-xl font-bold text-white">+{combatReport.xpGained} XP</span>
                                <span className="text-[10px] text-stone-500 uppercase">Expérience</span>
                            </div>
                            {/* Aros */}
                            <div className="bg-stone-800 p-3 rounded border border-stone-700 flex flex-col items-center gap-1">
                                <div className="w-6 h-6 rounded-full bg-amber-500 border-2 border-amber-300 shadow-lg" />
                                <span className="text-xl font-bold text-white">+{combatReport.kamasGained}</span>
                                <span className="text-[10px] text-stone-500 uppercase">Aros</span>
                            </div>
                        </div>

                        {/* Drops */}
                        {combatReport.drops.length > 0 && (
                            <div className="w-full mt-2">
                                <div className="text-xs text-stone-400 uppercase font-bold mb-2 text-center">- Butin -</div>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {combatReport.drops.map((item, idx) => (
                                        <div key={idx} className="relative group w-12 h-12 bg-stone-800 border border-stone-600 rounded hover:border-amber-400 transition-colors flex items-center justify-center cursor-help">
                                            <img src={item.spriteUrl || item.icon} className="w-10 h-10 object-contain" alt={item.name} />
                                            {/* Tooltip */}
                                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/95 border border-stone-700 p-2 rounded w-40 text-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                                                <div className="text-xs font-bold text-white">{item.name}</div>
                                                <div className="text-[10px] text-amber-500">
                                                    {{
                                                        'common': 'Commun',
                                                        'uncommon': 'Peu Commun',
                                                        'rare': 'Rare',
                                                        'epic': 'Épique',
                                                        'legendary': 'Légendaire',
                                                        'mythic': 'Mythique'
                                                    }[item.rarity] || item.rarity}
                                                </div>
                                            </div>
                                            {/* Rarity Glow */}
                                            <div className="absolute inset-0 rounded shadow-[inset_0_0_10px_rgba(255,255,255,0.1)]" style={{ borderColor: item.rarity === 'legendary' ? '#eab308' : item.rarity === 'epic' ? '#a855f7' : '#57534e' }}></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Close Button */}
                        <button
                            onClick={() => setCombatReport(null)}
                            className="mt-4 px-8 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold rounded shadow-lg border border-amber-500 transition-transform active:scale-95"
                        >
                            Continuer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
