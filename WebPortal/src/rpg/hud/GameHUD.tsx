// ══════════════════════════════════════════════════════════════════════════════
// hud/GameHUD.tsx — HUD complet NARVOS PRIME
//
// Refonte visuelle "visière Spartan techno-arcane" du HUD de jeu.
// Barres HP/Mana/Shield/Stamina/XP, barre de sorts avec cooldowns,
// textes flottants de dégâts/soins.
//
// Extrait de RpgGameWorld.tsx (monolithe 3995 lignes).
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Sword, Shield, Zap, Target, Coins,
  Flame, ShieldPlus, HeartPulse, Sparkles, type LucideIcon,
} from "lucide-react";
import type { PlayerStats } from "../stats/PlayerStats";
import { spendMana, applyHeal, isCrit, xpForLevel, MAX_LEVEL } from "../stats/PlayerStats";
import { aggregateTalents } from "../talents/talentEffects";
import { calcDamage } from "../spells/SpellDef";
import { getSpellsForClass } from "../spells/spellCatalog";
import type { SpellDef } from "../spells/SpellDef";
import type { InventoryState } from "../loot/Inventory";
import { CLASSES } from "../classes/classes";
import { ELEMENTS } from "../elements/elements";
import { gameSettings } from "../settings/gameSettings";
import { spellIcon } from "../loaders/launcherAssets";
import { MAPS } from "../loaders/assetManifest";
import styles from "./GameHUD.module.css";

interface GameHUDProps {
  stats: PlayerStats;
  onStatsChange: (s: PlayerStats) => void;
  inventory: InventoryState;
  zoneId?: string;
  /** Callback pour déclencher un VFX de sort dans la scène 3D */
  onCastSpell?: (spell: SpellDef) => void;
  /** Jeu en pause → ignore les entrées clavier du HUD. */
  paused?: boolean;
}

interface FloatText { id: number; text: string; color: string; big?: boolean; }

/** Icône d'un sort selon son archétype (remplace les emojis). */
function spellIconFor(spell: SpellDef): LucideIcon {
  if (spell.heal > 0) return HeartPulse;
  if (spell.archetype === "aoe") return Flame;
  if (spell.archetype === "shield") return ShieldPlus;
  return Sparkles;
}

/** Gradient de la barre HP selon le seuil (vert >40%, jaune >20%, rouge sinon). */
function hpGradient(pct: number): string {
  if (pct > 40) return "linear-gradient(90deg,#22c55e,#84cc16)";
  if (pct > 20) return "linear-gradient(90deg,#eab308,#facc15)";
  return "linear-gradient(90deg,#dc2626,#f87171)";
}

export function GameHUD({
  stats,
  onStatsChange,
  inventory,
  zoneId = "forge",
  onCastSpell,
  paused = false,
}: GameHUDProps) {
  // Ref pour que le handler clavier voie l'état pause courant sans se ré-abonner.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const spells = getSpellsForClass(stats.classId);
  const cls = CLASSES[stats.classId];
  const element = ELEMENTS[cls.element];

  // Cooldowns (spell index → remaining seconds)
  const [cooldowns, setCooldowns] = useState<number[]>(() => new Array(spells.length).fill(0));
  const [floatingTexts, setFloatingTexts] = useState<FloatText[]>([]);
  const ftId = useRef(0);

  const showFloat = useCallback((text: string, color: string, big = false) => {
    const id = ftId.current++;
    setFloatingTexts((prev) => [...prev, { id, text, color, big }]);
    setTimeout(() => setFloatingTexts((prev) => prev.filter((t) => t.id !== id)), 1800);
  }, []);

  // Cooldown ticker (la régén PV/mana est gérée par RpgGameWorld via un updater
  // fonctionnel — l'ancienne régén ici écrasait dégâts/coûts via une closure périmée).
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      setCooldowns((prev) => prev.map((cd) => Math.max(0, cd - dt)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Touches claviers : 1–6 lance un sort (inventaire géré par RpgGameWorld).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pausedRef.current) return; // menu ouvert → ignore
      const code = e.code;
      const K = gameSettings.keys;
      for (let i = 0; i < 6 && i < spells.length; i++) {
        if (K["skill" + (i + 1)]?.includes(code)) { castSpell(i); return; }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, inventory, cooldowns, spells]);

  const castSpell = (idx: number) => {
    const spell = spells[idx];
    if (!spell || cooldowns[idx] > 0) return;
    // Coût réduit par la branche Mana des talents (manaCostMult ≤ 1).
    const cost = Math.round(spell.manaCost * aggregateTalents(stats.talents).manaCostMult);
    const newStats = spendMana(stats, cost);
    if (!newStats) { showFloat("Mana insuffisant !", "#f87171"); return; }

    const crit = isCrit(stats);
    if (spell.damage > 0) {
      const dmg = calcDamage(spell, stats.puissance, crit);
      showFloat(crit ? `CRITIQUE ${Math.round(dmg)}` : `-${Math.round(dmg)} DMG`, crit ? "#f59e0b" : "#f87171", crit);
    }
    if (spell.heal > 0) {
      const healed = applyHeal(newStats, spell.heal);
      showFloat(`+${spell.heal} HP`, "#4ade80");
      onStatsChange(healed);
    } else {
      onStatsChange(newStats);
    }

    // Déclenche le VFX 3D
    onCastSpell?.(spell);

    // Pose le cooldown
    setCooldowns((prev) => {
      const next = [...prev];
      next[idx] = spell.cooldown;
      return next;
    });
  };

  const hpPct = stats.currentHp / stats.maxHp * 100;
  const shieldPct = stats.maxShield > 0 ? stats.currentShield / stats.maxShield * 100 : 0;
  const staminaPct = stats.maxStamina > 0 ? stats.currentStamina / stats.maxStamina * 100 : 0;
  const manaPct = stats.currentMana / stats.maxMana * 100;
  const lowMana = manaPct < 25;
  const xpNeed = xpForLevel(stats.level);
  const xpPct = stats.level >= MAX_LEVEL ? 100 : Math.min(100, (stats.xp / xpNeed) * 100);

  // Couleur d'accent de la classe injectée comme variable CSS
  const accentStyle = { ["--accent" as string]: element.color } as React.CSSProperties;

  const zoneLabel = (MAPS as Record<string, { label: string }>)[zoneId]?.label ?? zoneId;

  return (
    <div className={styles.hud} style={accentStyle}>
      <style>{`@keyframes narvosLowMana{0%,100%{filter:brightness(1)}50%{filter:brightness(1.7)}}`}</style>

      {/* ── Zone indicator (haut-droit) ──────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 18, right: 22, zIndex: 10,
        display: "flex", alignItems: "center", gap: 6,
        background: "rgba(5,8,16,0.70)", backdropFilter: "blur(4px)",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
        padding: "5px 12px",
      }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" }} />
        <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", fontFamily: "monospace" }}>
          {zoneLabel}
        </span>
      </div>

      {/* ── Réticule sci-fi ──────────────────────────────────────────────── */}
      <div className={styles.reticle}>
        <div className={styles.reticleH} />
        <div className={styles.reticleDot} />
      </div>

      {/* ── Bloc stats haut-gauche ───────────────────────────────────────── */}
      <div className={`${styles.statsPanel} ${styles.panelAccent} ${styles.scanline}`}>
        <div className={styles.classHeader}>
          <span className={styles.className}>{cls.label}</span>
          <span className={styles.classBadge}>NIV {stats.level}</span>
        </div>

        {/* XP */}
        <div className={styles.barLabel}>
          <span>XP</span>
          <span>{stats.level >= MAX_LEVEL ? "MAX" : `${Math.round(stats.xp)}/${xpNeed}`}</span>
        </div>
        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{ width: `${xpPct}%`, background: "linear-gradient(90deg,#65a30d,#a3e635)" }} />
          <div className={styles.barSegments} />
        </div>

        {/* HP */}
        <div className={styles.barLabel}><span>HP</span><span>{stats.currentHp}/{stats.maxHp}</span></div>
        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{ width: `${hpPct}%`, background: hpGradient(hpPct) }} />
          <div className={styles.barSegments} />
        </div>

        {/* Shield */}
        <div className={styles.barLabel}><span>Shield</span><span>{Math.round(stats.currentShield)}/{stats.maxShield}</span></div>
        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{
            width: `${shieldPct}%`,
            background: "linear-gradient(90deg, var(--nv-shield-dim), var(--nv-shield))",
            boxShadow: shieldPct > 0 ? "inset 0 0 12px rgba(56, 189, 248, 0.4), 0 0 8px rgba(56, 189, 248, 0.2)" : undefined,
          }} />
          <div className={styles.barSegments} />
        </div>

        {/* Mana (pulse orange si faible) */}
        <div className={styles.barLabel}>
          <span>Mana</span>
          <span style={lowMana ? { color: "#fbbf24", fontWeight: 800 } : undefined}>{Math.round(stats.currentMana)}/{stats.maxMana}</span>
        </div>
        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{
            width: `${manaPct}%`,
            background: lowMana ? "linear-gradient(90deg,#b45309,#f59e0b)" : "linear-gradient(90deg,#0ea5e9,#38bdf8)",
            animation: lowMana ? "narvosLowMana 0.9s ease-in-out infinite" : undefined,
          }} />
          <div className={styles.barSegments} />
        </div>

        {/* Stamina */}
        <div className={styles.barLabel}><span>Stamina</span><span>{Math.round(stats.currentStamina)}/{stats.maxStamina}</span></div>
        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{
            width: `${staminaPct}%`,
            background: "linear-gradient(90deg, var(--nv-stamina-dim), var(--nv-stamina))",
          }} />
          <div className={styles.barSegments} />
        </div>

        {/* Statistiques clés */}
        <div className={styles.statRow}>
          <span className={styles.statItem} title="Puissance"><Sword size={14} />{stats.puissance}</span>
          <span className={styles.statItem} title="Défense"><Shield size={14} />{stats.defense}</span>
          <span className={styles.statItem} title="Critique"><Zap size={14} />{stats.critique}%</span>
          <span className={styles.statItem} title="Initiative"><Target size={14} />{stats.initiative}</span>
        </div>
        <div className={styles.credits}><Coins size={13} />{inventory.credits} crédits</div>
      </div>

      {/* ── Barre de sorts (bas-centre) ──────────────────────────────────── */}
      <div className={styles.spellBar}>
        {spells.slice(0, 6).map((spell, i) => {
          const cd = cooldowns[i];
          const ready = cd <= 0;
          const Icon = spellIconFor(spell);
          const img = spellIcon(spell.element, i); // icône pixel-art par élément
          const sweep = spell.cooldown > 0 ? (cd / spell.cooldown) * 360 : 0;
          return (
            <button
              key={spell.id}
              className={`${styles.spellSlot} ${styles.clickable} ${ready ? styles.spellSlotReady : styles.spellSlotCooling}`}
              onClick={() => castSpell(i)}
              title={`${spell.label} (${spell.manaCost} mana)\n${spell.description}`}
            >
              <span className={styles.spellKey}>{i + 1}</span>
              {img ? (
                <img src={img} alt="" className={styles.spellIcon} style={{ width: 30, height: 30, objectFit: "contain", imageRendering: "pixelated" }}
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
              ) : (
                <Icon size={20} className={styles.spellIcon} />
              )}
              <span className={styles.spellName}>{spell.label.replace(/ de .*/, "")}</span>
              {cd > 0 && (
                <>
                  <div className={styles.cdSweep} style={{ ["--p" as string]: `${sweep}deg` } as React.CSSProperties} />
                  <div className={styles.cdText}>{cd.toFixed(1)}</div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Textes flottants ─────────────────────────────────────────────── */}
      <div className={styles.floatContainer}>
        {floatingTexts.map((ft) => (
          <div key={ft.id} className={ft.big ? styles.floatCrit : styles.floatText} style={{ color: ft.color }}>
            {ft.text}
          </div>
        ))}
      </div>

      {/* Le butin est désormais ramassé sur les cadavres (auto-pillage de proximité)
          et notifié via les toasts de RpgGameWorld. */}

    </div>
  );
}
