// ══════════════════════════════════════════════════════════════════════════════
// combat/statusEffects.ts — Moteur d'effets de statut (singleton hors-React).
//
// Fondation MODULAIRE des sorts spéciaux des archétypes :
//   • burn  (DoT)        → tir brûlant du Guerrier Spatial (dégâts sur la durée)
//   • root  (immobilise) → frappe AoE du Guerrier (ennemis cloués sur place)
//   • invisibility       → sort défensif du Guerrier (joueur non ciblable 10 s)
//
// Le moteur APPLIQUE ce qu'il peut seul (burn → applyDamage existant) et EXPOSE
// l'état que les consommateurs lisent (isRooted → IA PNJ ; isPlayerInvisible →
// rendu joueur). Ajouter un effet = un nouveau `kind` + sa logique dans tick().
//
// Un seul tick(dt) central (appelé par un composant useFrame, comme screenShake).
// ══════════════════════════════════════════════════════════════════════════════

import { npcRegistry } from "../npc/npcRegistry";

interface RootFx { kind: "root"; remaining: number; }
interface BurnFx { kind: "burn"; remaining: number; dps: number; acc: number; }
interface StunFx { kind: "stun"; remaining: number; }
type NpcFx = RootFx | BurnFx | StunFx;

// ── Effets joueur (buffs/debuffs visibles dans le HUD) ──────────────────────
export type PlayerFxKind = "invisibility" | "shield_regen" | "speed_boost" | "damage_boost";

export interface PlayerFx {
  kind: PlayerFxKind;
  remaining: number;
  total: number;
}

export type PlayerFxSnapshot = readonly PlayerFx[];

/** Cadence d'application du DoT (paliers, évite d'appeler applyDamage chaque frame). */
const BURN_TICK = 0.5;

const HUD_REFRESH = 0.5;

class StatusEffects {
  private npc = new Map<string, NpcFx[]>();
  private invis = 0;
  private invisTotal = 0;
  private playerFx: PlayerFx[] = [];

  // ── Souscription React (useSyncExternalStore) ─────────────────────────────────
  private _ver = 0;
  private _subs = new Set<() => void>();
  private _snap: PlayerFxSnapshot = [];
  private _hudTimer = 0;

  subscribe(cb: () => void): () => void {
    this._subs.add(cb);
    return () => { this._subs.delete(cb); };
  }

  getSnapshot(): PlayerFxSnapshot { return this._snap; }

  private emitSnap(): void {
    this._ver++;
    for (const cb of this._subs) cb();
  }

  // ── Application ───────────────────────────────────────────────────────────────
  applyRoot(npcId: string, duration: number): void {
    this.add(npcId, { kind: "root", remaining: duration });
  }
  applyStun(npcId: string, duration: number): void {
    if (duration <= 0) return;
    this.add(npcId, { kind: "stun", remaining: duration });
  }
  applyBurn(npcId: string, dps: number, duration: number): void {
    if (dps <= 0 || duration <= 0) return;
    this.add(npcId, { kind: "burn", remaining: duration, dps, acc: 0 });
  }
  applyInvisibility(duration: number): void {
    this.invis = Math.max(this.invis, duration);
    this.invisTotal = this.invis;
    npcRegistry.playerTargetable = false;
    this.rebuildSnap();
  }

  applyPlayerBuff(kind: PlayerFxKind, duration: number): void {
    if (duration <= 0) return;
    if (kind === "invisibility") { this.applyInvisibility(duration); return; }
    const existing = this.playerFx.find((f) => f.kind === kind);
    if (existing) {
      existing.remaining = Math.max(existing.remaining, duration);
      existing.total = existing.remaining;
    } else {
      this.playerFx.push({ kind, remaining: duration, total: duration });
    }
    this.rebuildSnap();
  }

  // ── Lecture ────────────────────────────────────────────────────────────────────
  isRooted(npcId: string): boolean {
    const list = this.npc.get(npcId);
    return !!list && list.some((e) => e.kind === "root" && e.remaining > 0);
  }
  isStunned(npcId: string): boolean {
    const list = this.npc.get(npcId);
    return !!list && list.some((e) => e.kind === "stun" && e.remaining > 0);
  }
  isBurning(npcId: string): boolean {
    const list = this.npc.get(npcId);
    return !!list && list.some((e) => e.kind === "burn" && e.remaining > 0);
  }
  isPlayerInvisible(): boolean { return this.invis > 0; }

  /** Effets actifs sur un PNJ (pour les indicateurs visuels). */
  getNpcEffects(npcId: string): readonly NpcFx[] {
    return this.npc.get(npcId) ?? [];
  }

  // ── Tick central ──────────────────────────────────────────────────────────────
  tick(dt: number): void {
    if (this.npc.size > 0) {
      for (const [id, list] of this.npc) {
        const h = npcRegistry.get(id);
        const alive = h?.isAlive() ?? false;
        for (const e of list) {
          e.remaining -= dt;
          if (e.kind === "burn" && alive && h) {
            e.acc += dt;
            if (e.acc >= BURN_TICK) { h.applyDamage(e.dps * e.acc); e.acc = 0; }
          }
        }
        const kept = alive ? list.filter((e) => e.remaining > 0) : [];
        if (kept.length > 0) this.npc.set(id, kept);
        else this.npc.delete(id);
      }
    }

    let changed = false;

    if (this.invis > 0) {
      this.invis -= dt;
      if (this.invis <= 0) { this.invis = 0; this.invisTotal = 0; npcRegistry.playerTargetable = true; changed = true; }
    }

    for (const f of this.playerFx) f.remaining -= dt;
    const before = this.playerFx.length;
    this.playerFx = this.playerFx.filter((f) => f.remaining > 0);
    if (this.playerFx.length !== before) changed = true;

    if (changed) {
      this.rebuildSnap();
    } else if ((this.invis > 0 || this.playerFx.length > 0) && this._subs.size > 0) {
      this._hudTimer += dt;
      if (this._hudTimer >= HUD_REFRESH) { this._hudTimer = 0; this.rebuildSnap(); }
    }
  }

  reset(): void {
    this.npc.clear();
    this.invis = 0;
    this.invisTotal = 0;
    this.playerFx = [];
    this._hudTimer = 0;
    npcRegistry.playerTargetable = true;
    this.rebuildSnap();
  }

  private add(npcId: string, fx: NpcFx): void {
    const list = this.npc.get(npcId);
    if (list) list.push(fx);
    else this.npc.set(npcId, [fx]);
  }

  private rebuildSnap(): void {
    const merged: PlayerFx[] = [...this.playerFx];
    if (this.invis > 0) {
      merged.unshift({ kind: "invisibility", remaining: this.invis, total: this.invisTotal });
    }
    this._snap = merged.length > 0 ? merged.map((f) => ({ ...f })) : [];
    this._hudTimer = 0;
    this.emitSnap();
  }
}

export const statusEffects = new StatusEffects();
