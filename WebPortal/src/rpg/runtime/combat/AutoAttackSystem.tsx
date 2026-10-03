// ══════════════════════════════════════════════════════════════════════════════
// runtime/combat/AutoAttackSystem.tsx — Auto-attack + unarmed strike handlers
//
// Factory functions that return closures for autoAttackRef and unarmedStrikeRef.
// Extracted from RpgGameWorld.tsx to reduce the god-component.
//
// Stores and utilities are imported directly (singletons); only component-local
// refs (camState, effRef, playerPos, pushToastRef, comboRef) are passed in.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import type { MutableRefObject } from "react";

import { rollDamage } from "../../combat/rollDamage";
import { damageEvents } from "../../combat/damageEvents";
import { npcHitReact, type HitReactKind } from "../../combat/npcHitReact";
import { statusEffects } from "../../combat/statusEffects";
import { advanceCombo, CHARGE_MS } from "../../combat/unarmedCombat";
import type { ComboState } from "../../combat/unarmedCombat";
import { strikeDamage } from "../../combat/unarmedStrikes";
import type { StrikeId } from "../../combat/unarmedStrikes";
import { ammoStore } from "../../combat/ammoStore";
import { ARCHETYPES } from "../../archetypes/archetypeCatalog";
import { archetypeStore } from "../../archetypes/archetypeStore";
import { magazineStore } from "../../weapons/magazineStore";
import { arrowMutationStore } from "./arrowMutationStore";
import { arrowPool } from "./arrowSystem";
import { screenShake } from "../screenShake";
import { npcRegistry } from "../../npc/npcRegistry";
import { gunVfx } from "../../weapons/GunVfx";

import type { PlayerState } from "../movement/playerState";
import type { PlayerStats } from "../../stats/PlayerStats";

// ── Dependencies: what must be injected (component-local refs) ──────────────

export interface AutoAttackDeps {
  camState: MutableRefObject<PlayerState>;
  effRef: MutableRefObject<PlayerStats>;
  playerPos: MutableRefObject<THREE.Vector3>;
  pushToastRef: MutableRefObject<((text: string, color: string) => void) | null>;
}

export interface UnarmedStrikeDeps {
  effRef: MutableRefObject<PlayerStats>;
  camState: MutableRefObject<PlayerState>;
  comboRef: MutableRefObject<ComboState>;
  playerPos: MutableRefObject<THREE.Vector3>;
}

// ── Auto-attack handler (weapons: bow / gun / staff / melee) ────────────────

export function createAutoAttackHandler(deps: AutoAttackDeps): () => void {
  const { camState, effRef, playerPos, pushToastRef } = deps;

  return () => {
    camState.current.attackToken += 1; // déclenche l'anim "attack" côté perso
    const arch = archetypeStore.get();
    const wt = arch ? ARCHETYPES[arch].weaponType : null;
    const ranged = wt === "bow" || wt === "gun" || wt === "staff";
    // Jet de CRITIQUE (la stat critique devient réelle) : ×1,75 + chiffre orange.
    const { amount: dmg, isCrit } = rollDamage(
      8 + effRef.current.puissance * 0.6,
      effRef.current.critique,
    );

    // ARC : tire de VRAIES flèches DROITES selon la direction de visée (aucun homing) +
    // mutations (multishot en éventail, perforation, éclatement à l'impact).
    if (wt === "bow") {
      // Munitions archer : pas de flèche si carquois vide (réappro chez le forgeron).
      if (!ammoStore.consume("arrows")) {
        pushToastRef.current?.("Plus de flèches ! (achète un carquois)", "#f87171");
        return;
      }
      const yaw = camState.current.yaw;
      const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)); // avant du joueur
      const from = playerPos.current.clone(); from.y += 1.4;            // hauteur ~poitrine
      const mut = arrowMutationStore.get();
      const mods = { pierce: mut.pierce, splitOnHit: mut.split };
      const n = Math.max(1, mut.multishot);
      const UP = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < n; i++) {
        const ang = (i - (n - 1) / 2) * 0.16; // éventail multishot
        arrowPool.spawn(from, dir.clone().applyAxisAngle(UP, ang), dmg, mods);
      }
      screenShake.add(0.05);
      return;
    }

    // Munitions gun : vérifier le chargeur d'abord, puis la réserve de cellules.
    if (wt === "gun") {
      if (magazineStore.get().isReloading) return;
      if (!magazineStore.canFire()) {
        if (!magazineStore.reload()) {
          // P0 fix : stock épuisé → click à vide, pas de rechargement
          pushToastRef.current?.("Click — plus de cellules en réserve !", "#f87171");
          return;
        }
        camState.current.reloadToken += 1;
        pushToastRef.current?.("Rechargement auto…", "#a8d4ff");
        return;
      }
      // UN SEUL DÉBIT PAR TIR — celui du chargeur.
      //
      // Le tir consommait AUSSI `ammoStore.consume("cells")`, alors que le
      // rechargement puise déjà dans cette même réserve. Chaque balle était donc
      // payée deux fois, et le chargeur se remplissait gratuitement : la réserve
      // fondait à raison d'une cellule par tir sans jamais rien remplir.
      //
      // La réserve est désormais débitée UNIQUEMENT au rechargement
      // (`magazineStore.reload`), qui est le seul endroit où le transfert
      // réserve → chargeur a un sens.
      magazineStore.fire();
    }

    // Autres armes (gun/staff distance, mêlée) : dégâts instantanés au plus proche.
    const range = ranged ? 20 : 3;
    let best: (import("../../npc/npcRegistry").NpcHandle) | null = null;
    let bestD = Infinity;
    for (const e of npcRegistry.queryEnemiesInRadius(playerPos.current, range)) {
      const d = e.getPosition().distanceToSquared(playerPos.current);
      if (d < bestD) { bestD = d; best = e; }
    }

    // VFX gun : muzzle flash à la position du joueur + tracer/impact vers la cible.
    if (wt === "gun") {
      const yaw = camState.current.yaw;
      const muzzlePos = playerPos.current.clone();
      muzzlePos.y += 1.4;
      muzzlePos.x -= Math.sin(yaw) * 0.6;
      muzzlePos.z -= Math.cos(yaw) * 0.6;
      gunVfx.muzzleFlash(muzzlePos);
      if (best) {
        gunVfx.tracer(muzzlePos, best.getPosition());
        gunVfx.impact(best.getPosition());
      }
    }

    if (best) {
      if (isCrit) damageEvents.markNextCrit();
      best.applyDamage(dmg);
      screenShake.add(isCrit ? 0.1 : 0.06);
    }
  };
}

// ── Unarmed-strike handler (combo / charged punch / kick / charged kick) ────

export function createUnarmedStrikeHandler(
  deps: UnarmedStrikeDeps,
): (kind: "combo" | "punch_charged" | "kick" | "kick_charged") => void {
  const { effRef, camState, comboRef, playerPos } = deps;

  return (kind) => {
    const now = performance.now();
    const p = effRef.current.puissance;
    let action: typeof camState.current.oneShotAction;
    let dmg: number; let react: HitReactKind; let stunSec = 0; let range = 2.8;
    if (kind === "combo") {
      const r = advanceCombo(comboRef.current, now);
      action = r.action;
      dmg = strikeDamage(r.strike, p, r.isFinisher);
      react = r.isFinisher ? "bighit" : "hit";
      if (r.isFinisher) stunSec = 2.0;
    } else if (kind === "punch_charged") {
      action = "punch_charged"; dmg = Math.round(strikeDamage("hook_r", p, false) * 2.5); react = "bighit";
    } else if (kind === "kick") {
      action = "kick"; dmg = Math.round(strikeDamage("kick_r", p, false) * 1.5); react = "hit"; range = 3.2;
    } else {
      action = "kick_charged"; dmg = strikeDamage("kick_r", p, false) * 3; react = "bighit"; stunSec = 1.5; range = 3.4;
    }
    camState.current.oneShotAction = action;
    camState.current.oneShotToken += 1; // déclenche l'anim côté perso

    const yaw = camState.current.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw); // avant du joueur (face caméra)
    let best: (import("../../npc/npcRegistry").NpcHandle) | null = null;
    let bestD = Infinity;
    npcRegistry.forEachEnemyInRadius(playerPos.current, range, (e) => {
      const ep = e.getPosition();
      const dx = ep.x - playerPos.current.x, dz = ep.z - playerPos.current.z;
      const d2 = dx * dx + dz * dz;
      const len = Math.sqrt(Math.max(d2, 1e-6));
      if ((dx * fx + dz * fz) / len < 0.25) return; // hors du cône avant
      if (d2 < bestD) { bestD = d2; best = e; }
    });
    if (best) {
      // Jet de CRITIQUE mains nues (même stat que les armes).
      const rolled = rollDamage(dmg, effRef.current.critique);
      if (rolled.isCrit) damageEvents.markNextCrit();
      best.applyDamage(rolled.amount);
      // Réaction/K.O. seulement si la cible a SURVÉCU (un cadavre joue sa mort, rien d'autre).
      if (best.isAlive()) {
        npcHitReact.trigger(best.id, react);
        if (stunSec > 0) statusEffects.applyStun(best.id, stunSec);
      }
      screenShake.add(react === "bighit" || rolled.isCrit ? 0.12 : 0.05);
    }
  };
}
