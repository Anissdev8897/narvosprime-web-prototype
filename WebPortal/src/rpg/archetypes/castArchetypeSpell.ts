// ══════════════════════════════════════════════════════════════════════════════
// archetypes/castArchetypeSpell.ts — Exécuteur de sort d'archétype (cœur du combat).
//
// Relie les systèmes : cooldownStore (gate des ultimes) + spellDamage (% PV joueur)
// + statusEffects (root/burn/invisibility) + npcRegistry (cibles) + callbacks de
// présentation (télégraphe AoE, téléportation). Hors-React, appelable depuis le
// handler de touche de RpgGameWorld.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { npcRegistry, type NpcHandle } from "../npc/npcRegistry";
import { statusEffects } from "../combat/statusEffects";
import { cooldownStore } from "../combat/cooldownStore";
import { calcArchetypeDamage } from "../combat/spellDamage";
import { screenShake } from "../runtime/screenShake";
import type { ArchetypeSpell } from "./archetypeCatalog";

export interface CastContext {
  playerPos: THREE.Vector3;
  playerMaxHp: number;
  playerAtk: number;
  /** Réduction de cooldown (équipement) 0..0.8. */
  cdReduction?: number;
  /** Direction du regard (téléport / projectiles). */
  facing?: THREE.Vector3;
  /** charge 0..1 pour le tir chargé (1 = pleine charge). */
  charge?: number;
  /** Téléporte le joueur (RpgGameWorld déplace playerPos). */
  onTeleport?: (target: THREE.Vector3) => void;
  /**
   * Spawne un télégraphe AoE ESQUIVABLE (réutilise BossAoeZone côté RpgGameWorld,
   * en mode targetEnemies). Les dégâts sont appliqués à la détonation, aux ennemis
   * ENCORE dans le rayon → la zone est esquivable.
   */
  onAoe?: (center: THREE.Vector3, radius: number, damage: number, windup: number) => void;
}

/** Fenêtre d'avertissement (s) avant détonation d'une AoE joueur esquivable. */
const AOE_WINDUP = 0.8;
/** Portée de visée pour poser le centre de l'AoE sur une cible. */
const AOE_TARGET_RANGE = 30;

export interface CastResult { ok: boolean; reason?: "cooldown"; hits: number; }

function nearestEnemy(center: THREE.Vector3, maxDist: number): NpcHandle | null {
  let best: NpcHandle | null = null;
  let bestD = Infinity;
  for (const e of npcRegistry.queryEnemiesInRadius(center, maxDist)) {
    const d = e.getPosition().distanceToSquared(center);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

export function executeArchetypeSpell(spell: ArchetypeSpell, ctx: CastContext): CastResult {
  // Gate cooldown (ultimes uniquement).
  if (spell.isUltimate && !cooldownStore.isReady(spell.id)) return { ok: false, reason: "cooldown", hits: 0 };

  // Dégâts d'archétype : %PV joueur × puissance × atténuation par la DÉFENSE de la
  // cible (les dégâts dépendent du joueur ET de l'ennemi). target absent → def 0.
  const dmg = (pct: number, target?: NpcHandle, crit?: boolean) => calcArchetypeDamage({
    pctPlayerHp: pct, playerMaxHp: ctx.playerMaxHp, playerAtk: ctx.playerAtk,
    enemyDefense: target?.getDefense?.() ?? 0, crit,
  });
  let hits = 0;

  switch (spell.effect) {
    case "aoe_dodge": {
      // AoE ESQUIVABLE (Mage/Archer) : pose un télégraphe sur l'ennemi le plus
      // proche (ou devant le joueur), dégâts appliqués à la détonation → esquivable.
      const radius = spell.radius ?? 5;
      const near = nearestEnemy(ctx.playerPos, AOE_TARGET_RANGE);
      let center: THREE.Vector3;
      if (near) {
        center = near.getPosition().clone();
      } else {
        const dir = (ctx.facing ?? new THREE.Vector3(0, 0, -1)).clone();
        dir.y = 0;
        if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
        dir.normalize();
        center = ctx.playerPos.clone().addScaledVector(dir, radius + 2);
      }
      center.y = 0; // au sol
      // Défense représentative = celle de l'ennemi visé (centre de la zone).
      ctx.onAoe?.(center, radius, spell.pctPlayerHp ? dmg(spell.pctPlayerHp, near ?? undefined) : 0, AOE_WINDUP);
      screenShake.add(0.15); // léger feedback de lancement (pas l'impact)
      // hits = 0 : les dégâts seront comptés à la détonation par la zone.
      break;
    }
    case "root_aoe": {
      // Frappe de mêlée INSTANTANÉE autour du joueur (Guerrier) : pas de télégraphe.
      const radius = spell.radius ?? 5;
      for (const e of npcRegistry.queryEnemiesInRadius(ctx.playerPos, radius)) {
        if (spell.pctPlayerHp) e.applyDamage(dmg(spell.pctPlayerHp, e));
        if (spell.duration) statusEffects.applyRoot(e.id, spell.duration);
        hits++;
      }
      screenShake.add(spell.isUltimate ? 0.35 : 0.2);
      break;
    }
    case "burn_shot": {
      const t = nearestEnemy(ctx.playerPos, 30);
      if (t && spell.pctPlayerHp && spell.duration) {
        statusEffects.applyBurn(t.id, dmg(spell.pctPlayerHp, t) / spell.duration, spell.duration);
        hits = 1;
      }
      break;
    }
    case "charged": {
      const t = nearestEnemy(ctx.playerPos, 30);
      // clic court (charge 0) = petits dégâts · maintien (charge 1) = ×3.
      const mult = 1 + 2 * Math.max(0, Math.min(1, ctx.charge ?? 0));
      if (t && spell.pctPlayerHp) { t.applyDamage(Math.round(dmg(spell.pctPlayerHp, t) * mult)); hits = 1; }
      break;
    }
    case "ranged":
    case "stealth_strike": {
      const t = nearestEnemy(ctx.playerPos, spell.effect === "stealth_strike" ? 6 : 30);
      if (t && spell.pctPlayerHp) {
        const crit = spell.effect === "stealth_strike"; // la frappe furtive crit
        t.applyDamage(dmg(spell.pctPlayerHp, t, crit));
        hits = 1;
      }
      break;
    }
    case "invisibility": {
      if (spell.duration) statusEffects.applyInvisibility(spell.duration);
      break;
    }
    case "teleport": {
      const dir = (ctx.facing ?? new THREE.Vector3(0, 0, -1)).clone();
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
      dir.normalize();
      ctx.onTeleport?.(ctx.playerPos.clone().addScaledVector(dir, 12));
      break;
    }
  }

  if (spell.isUltimate) cooldownStore.trigger(spell.id, spell.baseCooldown, ctx.cdReduction ?? 0);
  return { ok: true, hits };
}
