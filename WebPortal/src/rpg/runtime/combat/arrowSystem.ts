// runtime/combat/arrowSystem.ts — flèches du JOUEUR (archer) : projectiles DROITS.
//
// La flèche part en LIGNE DROITE selon la direction de visée du joueur (aucun homing) et
// frappe le 1er ennemi sur sa trajectoire (collision par proximité vs npcRegistry).
// Supporte des MUTATIONS : perforation (pierce), éclatement à l'impact (split). Le tir
// multiple (multishot) est géré au point de spawn (éventail) côté appelant.
//
// Pool sans allocation par frame : free-list O(1) au spawn, forEachActive sans alloc au
// rendu, broadphase spatiale (forEachEnemyInRadius) pour la collision.
import * as THREE from "three";
import { npcRegistry, type NpcHandle } from "../../npc/npcRegistry";

export interface ArrowMods {
  /** Ennemis traversés EN PLUS du premier (0 = s'arrête au 1er touché). */
  pierce?: number;
  /** À l'impact, projette N flèches filles en éventail (dégâts réduits). */
  splitOnHit?: number;
}

interface Arrow {
  active: boolean;
  idx: number;          // position stable dans le pool (free-list)
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  ttl: number;
  damage: number;
  pierceLeft: number;
  splitOnHit: number;
  hit: Set<NpcHandle>; // ennemis déjà touchés (évite les multi-hits en perforation)
}

const SPEED = 62;      // m/s — vitesse de la flèche
const TTL = 3;         // s avant disparition
const HIT_R = 1.3;     // rayon de collision HORIZONTAL (m)
const HIT_R2 = HIT_R * HIT_R;
const VBAND = 2.4;     // tolérance VERTICALE (m) : la flèche vole à ~1,4 m, les PNJ ont leur
                       // origine au sol (y≈0) → on teste un CYLINDRE (XZ + bande Y), pas une
                       // sphère 3D (sinon l'écart de hauteur empêchait tout impact).
const SPLIT_SPREAD = 0.26; // rad entre flèches filles
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _fanDir = new THREE.Vector3(); // scratch éventail (zéro alloc/tir)

export class ArrowPool {
  private pool: Arrow[] = [];
  private free: number[] = [];   // pile d'indices libres → spawn O(1)

  private make(): Arrow {
    const a: Arrow = {
      active: false, idx: this.pool.length, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
      ttl: 0, damage: 0, pierceLeft: 0, splitOnHit: 0, hit: new Set(),
    };
    this.pool.push(a);
    return a;
  }

  private release(a: Arrow): void {
    if (!a.active) return;
    a.active = false;
    this.free.push(a.idx);
  }

  /** Tire une flèche DROITE depuis `from` vers `dir` (horizontalisé). */
  spawn(from: THREE.Vector3, dir: THREE.Vector3, damage: number, mods: ArrowMods = {}): void {
    const i = this.free.pop();
    const a = i !== undefined ? this.pool[i] : this.make();
    a.active = true;
    a.pos.copy(from);
    a.vel.copy(dir).setY(0).normalize().multiplyScalar(SPEED); // DROIT, plan horizontal
    a.ttl = TTL;
    a.damage = damage;
    a.pierceLeft = mods.pierce ?? 0;
    a.splitOnHit = mods.splitOnHit ?? 0;
    a.hit.clear();
  }

  /** Éventail de flèches filles (mutation split) autour de `baseVel`. */
  private fan(from: THREE.Vector3, baseVel: THREE.Vector3, damage: number, n: number): void {
    _fanDir.copy(baseVel).normalize();
    for (let k = 0; k < n; k++) {
      const ang = (k - (n - 1) / 2) * SPLIT_SPREAD;
      _dir.copy(_fanDir).applyAxisAngle(_up, ang); // scratch, pas de clone()
      this.spawn(from, _dir, damage, {}); // filles sans mutation (pas de cascade infinie)
    }
  }

  update(dt: number): void {
    for (const a of this.pool) {
      if (!a.active) continue;
      a.ttl -= dt;
      if (a.ttl <= 0) { this.release(a); continue; }
      a.pos.addScaledVector(a.vel, dt);

      // Collision CYLINDRE via broadphase : distance horizontale (XZ) sous HIT_R ET écart
      // vertical sous VBAND. La flèche vole à hauteur poitrine, les PNJ ont leur origine au
      // sol → un test sphérique 3D ne toucherait jamais (l'écart Y dépasse le rayon).
      let stop = false;
      npcRegistry.forEachEnemyInRadius(a.pos, HIT_R + VBAND, (e) => {
        if (stop || a.hit.has(e)) return;
        const ep = e.getPosition();
        const dx = ep.x - a.pos.x, dz = ep.z - a.pos.z;
        if (dx * dx + dz * dz > HIT_R2) return;
        if (Math.abs(ep.y - a.pos.y) > VBAND) return;
        e.applyDamage(a.damage);
        a.hit.add(e);
        if (a.splitOnHit > 0) { this.fan(a.pos, a.vel, Math.round(a.damage * 0.5), a.splitOnHit); a.splitOnHit = 0; }
        if (a.pierceLeft > 0) { a.pierceLeft--; } // perfore : continue
        else { stop = true; }                      // sinon s'arrête au 1er
      });
      if (stop) this.release(a);
    }
  }

  /** Visite chaque flèche active (zéro alloc). */
  forEachActive(cb: (a: Arrow, i: number) => void): void {
    let i = 0;
    for (const a of this.pool) { if (a.active) cb(a, i++); }
  }
  size(): number { return this.pool.length; }
  activeCount(): number { let n = 0; for (const a of this.pool) if (a.active) n++; return n; }
  clear(): void { for (const a of this.pool) { if (a.active) { a.active = false; this.free.push(a.idx); } } }
}

export const arrowPool = new ArrowPool();
export type { Arrow };
