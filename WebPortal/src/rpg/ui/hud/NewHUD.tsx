// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/NewHUD.tsx — Nouveau composant HUD principal complet
//
// Orchestre HealthBar, ArmorBar, ManaBar, Minimap (Canvas 2D), QuestTracker,
// SpellBar, BuffDisplay, QuickInventory.
// React.memo : pas de re-render si les props n'ont pas changé.
// ══════════════════════════════════════════════════════════════════════════════

import { memo, useMemo } from "react";
import { Faction } from "../../../types";
import type { ExtendedStats, WeaponData, PlayerStatus } from "./hudTypes";
import type { SpellSlotData, BuffData, QuestDisplayData, QuickSlotItem } from "./hudTypes";
import type { RadarEntity, MapData } from "./hudTypes";
import { getFactionColors } from "./hudConstants";
import { HealthBar } from "./HealthBar";
import { ArmorBar } from "./ArmorBar";
import { ManaBar } from "./ManaBar";
import { SpellBar } from "./SpellBar";
import { QuestTracker } from "./QuestTracker";
import { BuffDisplay } from "./BuffDisplay";
import { Minimap } from "./Minimap";
import { QuickInventory } from "./QuickInventory";
import styles from "./NewHUD.module.css";

export interface NewHUDProps {
  playerFaction: Faction;
  stats: ExtendedStats;
  weapon?: WeaponData;
  planetId?: string | null;
  playerStatus?: PlayerStatus;
  spells?: SpellSlotData[];
  buffs?: BuffData[];
  quests?: QuestDisplayData[];
  quickItems?: QuickSlotItem[];
  radarEntities?: RadarEntity[];
  mapData?: MapData | null;
  playerX?: number;
  playerZ?: number;
  playerYaw?: number;
  onCastSpell?: (index: number) => void;
  onUseItem?: (index: number) => void;
}

// ── Sous-composants memoïsés ──────────────────────────────────────────────────

const StatsBars = memo(function StatsBars({
  stats,
  colors,
}: {
  stats: ExtendedStats;
  colors: ReturnType<typeof getFactionColors>;
}) {
  return (
    <div className={styles.statsArea}>
      <HealthBar
        hp={stats.hp}
        maxHp={stats.maxHp}
        color={colors.health}
        faction={Faction.HUMAN}
      />
      <ArmorBar
        armor={stats.armor}
        maxArmor={stats.maxArmor}
        color={colors.armor}
        faction={Faction.HUMAN}
      />
      <ManaBar
        mana={stats.mana}
        maxMana={stats.maxMana}
        color={colors.mana}
        faction={Faction.HUMAN}
      />
    </div>
  );
});

const BuffArea = memo(function BuffArea({
  buffs,
}: {
  buffs: BuffData[];
}) {
  if (buffs.length === 0) return null;
  return (
    <div className={styles.buffArea}>
      <BuffDisplay buffs={buffs} />
    </div>
  );
});

const BottomBar = memo(function BottomBar({
  spells,
  quickItems,
  onCastSpell,
  onUseItem,
}: {
  spells: SpellSlotData[];
  quickItems: QuickSlotItem[];
  onCastSpell?: (index: number) => void;
  onUseItem?: (index: number) => void;
}) {
  return (
    <div className={styles.spellBarArea}>
      <QuickInventory items={quickItems} onUseItem={onUseItem} />
      <SpellBar spells={spells} onCastSpell={onCastSpell} />
    </div>
  );
});

const RightPanel = memo(function RightPanel({
  playerX,
  playerZ,
  playerYaw,
  entities,
  mapData,
  quests,
}: {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  entities: RadarEntity[];
  mapData?: MapData | null;
  quests: QuestDisplayData[];
}) {
  return (
    <>
      <div className={styles.minimapArea}>
        <div className={styles.minimapBackground}>
          <Minimap
            playerX={playerX}
            playerZ={playerZ}
            playerYaw={playerYaw}
            entities={entities}
            mapData={mapData ?? undefined}
          />
        </div>
      </div>
      {quests.length > 0 && (
        <div className={styles.questArea}>
          <QuestTracker quests={quests} />
        </div>
      )}
    </>
  );
});

// ── Composant principal ───────────────────────────────────────────────────────

export const NewHUD = memo(function NewHUD({
  playerFaction,
  stats,
  spells = [],
  buffs = [],
  quests = [],
  quickItems = [],
  radarEntities = [],
  mapData = null,
  playerX = 0,
  playerZ = 0,
  playerYaw = 0,
  onCastSpell,
  onUseItem,
}: NewHUDProps) {
  const colors = useMemo(() => getFactionColors(playerFaction), [playerFaction]);

  return (
    <div className={styles.hudContainer}>
      <StatsBars stats={stats} colors={colors} />
      <BuffArea buffs={buffs} />
      <BottomBar
        spells={spells}
        quickItems={quickItems}
        onCastSpell={onCastSpell}
        onUseItem={onUseItem}
      />
      <RightPanel
        playerX={playerX}
        playerZ={playerZ}
        playerYaw={playerYaw}
        entities={radarEntities}
        mapData={mapData}
        quests={quests}
      />
    </div>
  );
});
NewHUD.displayName = "NewHUD";

// Ré-export des sous-composants pour import simplifié
export { HealthBar } from "./HealthBar";
export { ArmorBar } from "./ArmorBar";
export { ManaBar } from "./ManaBar";
export { SpellBar } from "./SpellBar";
export { QuestTracker } from "./QuestTracker";
export { BuffDisplay } from "./BuffDisplay";
export { Minimap } from "./Minimap";
export { QuickInventory } from "./QuickInventory";
