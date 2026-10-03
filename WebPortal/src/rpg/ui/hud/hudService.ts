// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/hudService.ts — Service de gestion central du HUD
//
// Singleton. Fournit l'état global du HUD étendu (stats, sorts, quêtes, buffs)
// aux composants du nouveau HUD.
// ══════════════════════════════════════════════════════════════════════════════

import type { Faction } from "../../../types";
import type {
  Stats,
  ExtendedStats,
  WeaponData,
  PlayerStatus,
  SpellSlotData,
  BuffData,
  QuestDisplayData,
  QuickSlotItem,
  RadarEntity,
  MapData,
} from "./hudTypes";

export interface HudState {
  faction: Faction;
  stats: Stats;
  extendedStats: ExtendedStats;
  weapon: WeaponData | null;
  planetId: string | null;
  playerStatus: PlayerStatus | null;
  visible: boolean;
  spells: SpellSlotData[];
  buffs: BuffData[];
  quests: QuestDisplayData[];
  quickItems: QuickSlotItem[];
  radarEntities: RadarEntity[];
  mapData: MapData | null;
  playerX: number;
  playerZ: number;
  playerYaw: number;
}

const DEFAULT_EXTENDED_STATS: ExtendedStats = {
  hp: 100,
  maxHp: 100,
  armor: 0,
  maxArmor: 0,
  mana: 100,
  maxMana: 100,
};

export class HudService {
  private static instance: HudService;
  private listeners = new Set<() => void>();

  private state: HudState = {
    faction: null as unknown as Faction,
    stats: { hp: 0, maxHp: 0, armor: 0, maxArmor: 0 },
    extendedStats: { ...DEFAULT_EXTENDED_STATS },
    weapon: null,
    planetId: null,
    playerStatus: null,
    visible: false,
    spells: [],
    buffs: [],
    quests: [],
    quickItems: [],
    radarEntities: [],
    mapData: null,
    playerX: 0,
    playerZ: 0,
    playerYaw: 0,
  };

  public static getInstance(): HudService {
    if (!HudService.instance) {
      HudService.instance = new HudService();
    }
    return HudService.instance;
  }

  public updateState(partial: Partial<HudState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  public getState(): HudState {
    return this.state;
  }

  public setVisible(visible: boolean): void {
    this.state.visible = visible;
    this.notify();
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  public getSnapshot = (): HudState => {
    return this.state;
  };

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}

export const hudService = HudService.getInstance();
