// ══════════════════════════════════════════════════════════════════════════════
// camera/cameraShake.ts — PerlinNoise + ShakePatterns + CameraShakeController
//
// POURQUOI CE FICHIER EXISTE :
// Le système précédent (screenShake + applyShake dans FpsCamera) utilisait des
// sin() basiques — efficace mais prévisible. Le bruit de Perlin produit des
// secousses organiques et non-répétitives, comme dans Unreal / AAA.
//
// ARCHITECTURE :
//   CameraShakePattern   → description d'un type de secousse (data)
//   CameraShakeInstance  → instance active d'un pattern (runtime)
//   CameraShakeController→ singleton qui tique toutes les instances et
//                          produit l'offset total pour la frame
//
// TROIS PATTERNS :
//   • PerlinShakePattern  : bruit de Perlin 3D par axe (fréquence, amplitude)
//   • WaveShakePattern    : sinusoïdes (comme l'ancien système, mais paramétrable)
//   • CompositePattern    : mélange de plusieurs patterns
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

// ══════════════════════════════════════════════════════════════════════════════
// 1. Perlin Noise 3D — standard (gradient vectors + permutation table)
// ══════════════════════════════════════════════════════════════════════════════

const GRAD3: [number, number, number][] = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
];

const P = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,
  142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,
  35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,
  139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,
  245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,
  196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,
  202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,
  170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,
  98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,
  144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,
  184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,
  141,128,195,78,66,215,61,156,180];

const PERM = new Array(512);
for (let i = 0; i < 512; i++) PERM[i] = P[i & 255];

function pgDot(g: [number, number, number], x: number, y: number, z: number): number {
  return g[0] * x + g[1] * y + g[2] * z;
}

function pgFade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function pgLerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/**
 * Bruit de Perlin 3D — retourne une valeur dans [-1, 1].
 * La fonction est DÉTERMINISTE (mêmes entrées → même résultat).
 */
export function perlin3D(x: number, y: number, z: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const zf = z - Math.floor(z);
  const u = pgFade(xf);
  const v = pgFade(yf);
  const w = pgFade(zf);

  const aaa = PERM[PERM[PERM[X] + Y] + Z];
  const aba = PERM[PERM[PERM[X] + Y + 1] + Z];
  const aab = PERM[PERM[PERM[X] + Y] + Z + 1];
  const abb = PERM[PERM[PERM[X] + Y + 1] + Z + 1];
  const baa = PERM[PERM[PERM[X + 1] + Y] + Z];
  const bba = PERM[PERM[PERM[X + 1] + Y + 1] + Z];
  const bab = PERM[PERM[PERM[X + 1] + Y] + Z + 1];
  const bbb = PERM[PERM[PERM[X + 1] + Y + 1] + Z + 1];

  const x1 = pgLerp(
    pgLerp(pgDot(GRAD3[aaa % 12], xf, yf, zf), pgDot(GRAD3[baa % 12], xf - 1, yf, zf), u),
    pgLerp(pgDot(GRAD3[aba % 12], xf, yf - 1, zf), pgDot(GRAD3[bba % 12], xf - 1, yf - 1, zf), u),
    v,
  );
  const x2 = pgLerp(
    pgLerp(pgDot(GRAD3[aab % 12], xf, yf, zf - 1), pgDot(GRAD3[bab % 12], xf - 1, yf, zf - 1), u),
    pgLerp(pgDot(GRAD3[abb % 12], xf, yf - 1, zf - 1), pgDot(GRAD3[bbb % 12], xf - 1, yf - 1, zf - 1), u),
    v,
  );
  return pgLerp(x1, x2, w);
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. ShakePattern — data descriptions (comme les profils de recoil)
// ══════════════════════════════════════════════════════════════════════════════

/** Oscillation sinusoïdale simple. */
export interface WaveParams {
  freqX: number;  // Hz
  freqY: number;
  freqZ: number;
  ampX: number;   // mètres ou radians
  ampY: number;
  ampZ: number;
}

/** Bruit de Perlin paramétré par axe. */
export interface PerlinShakeParams {
  freq: number;   // fréquence de base du bruit (plus grand = plus rapide)
  ampX: number;
  ampY: number;
  ampZ: number;
}

export type ShakePattern =
  | { type: "perlin"; params: PerlinShakeParams }
  | { type: "wave";   params: WaveParams }
  | { type: "composite"; patterns: ShakePattern[] };

/**
 * Échantillonne un pattern à l'instant `t` (secondes).
 * Retourne un offset {x, y, z} — en mètres pour position, en radians pour rotation.
 * Le pattern est invariant par rapport à dt : l'appelant gère l'avancement du temps.
 */
export function samplePattern(pattern: ShakePattern, t: number): { x: number; y: number; z: number } {
  switch (pattern.type) {
    case "perlin": {
      const p = pattern.params;
      // 3 axes, 3 octaves chacun (empilés pour plus de détails)
      const octaves = 3;
      let ox = 0, oy = 0, oz = 0;
      let amp = 1;
      let freq = p.freq;
      for (let i = 0; i < octaves; i++) {
        ox += perlin3D(t * freq, 0, i * 1.7) * amp;
        oy += perlin3D(0, t * freq, i * 2.3) * amp;
        oz += perlin3D(i * 3.1, t * freq, 0) * amp;
        amp *= 0.5;   // octave suivante : moitié moins d'amplitude
        freq *= 2;    // double fréquence
      }
      return {
        x: ox * p.ampX,
        y: oy * p.ampY,
        z: oz * p.ampZ,
      };
    }
    case "wave": {
      const p = pattern.params;
      return {
        x: Math.sin(t * p.freqX * Math.PI * 2) * p.ampX,
        y: Math.sin(t * p.freqY * Math.PI * 2 + 1.3) * p.ampY,
        z: Math.sin(t * p.freqZ * Math.PI * 2 + 0.7) * p.ampZ,
      };
    }
    case "composite": {
      let x = 0, y = 0, z = 0;
      for (const sub of pattern.patterns) {
        const o = samplePattern(sub, t);
        x += o.x;
        y += o.y;
        z += o.z;
      }
      return { x, y, z };
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. CameraShakeInstance — une secousse active dans le controller
// ══════════════════════════════════════════════════════════════════════════════

export interface CameraShakeInstance {
  /** Le pattern qui pilote la secousse. */
  pattern: ShakePattern;
  /** Intensité initiale (multiplicateur d'amplitude). 1 = normale. */
  intensity: number;
  /** Durée de vie restante (secondes). <= 0 = terminée. */
  remaining: number;
  /** Temps écoulé depuis le début de l'instance (pour le pattern). */
  elapsed: number;
  /** Temps de montée (fade-in) en secondes. */
  attack: number;
  /** Temps de retombée (fade-out) en secondes. */
  decay: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. CameraShakeController — singleton qui tique et cumule toutes les secousses
// ══════════════════════════════════════════════════════════════════════════════

const TMP_VEC = new THREE.Vector3();

export class CameraShakeController {
  private instances: CameraShakeInstance[] = [];

  /**
   * Ajoute une secousse.
   * Retourne un identifiant pour cancellation anticipée (optionnel).
   */
  add(instance: CameraShakeInstance): void {
    this.instances.push(instance);
  }

  /**
   * Supprime toutes les instances qui matchent une condition.
   */
  removeIf(predicate: (inst: CameraShakeInstance) => boolean): void {
    this.instances = this.instances.filter((i) => !predicate(i));
  }

  /** Supprime toutes les secousses actives. */
  clear(): void {
    this.instances.length = 0;
  }

  /**
   * Avance toutes les instances de `dt` secondes et retourne l'offset total
   * (position et rotation) à appliquer à la caméra.
   * Coût proportionnel au nombre d'instances actives.
   */
  tick(dt: number, out: THREE.Vector3): boolean {
    out.set(0, 0, 0);
    if (this.instances.length === 0) return false;

    this.instances = this.instances.filter((inst) => {
      inst.elapsed += dt;
      inst.remaining -= dt;
      if (inst.remaining <= 0) return false;

      // Enveloppe d'intensité : attack puis decay
      let intensity = inst.intensity;
      // Phase d'attaque (montée progressive)
      if (inst.elapsed < inst.attack) {
        intensity *= inst.attack > 0 ? inst.elapsed / inst.attack : 1;
      }
      // Phase de décroissance (dans les dernières `decay` secondes)
      if (inst.remaining < inst.decay) {
        intensity *= inst.decay > 0 ? inst.remaining / inst.decay : 1;
      }

      const offset = samplePattern(inst.pattern, inst.elapsed);
      out.x += offset.x * intensity;
      out.y += offset.y * intensity;
      out.z += offset.z * intensity;
      return true;
    });

    return true;
  }

  /** Nombre d'instances actives. */
  get activeCount(): number {
    return this.instances.length;
  }
}

/**
 * Singleton global — utilisé par FpsCamera.
 * Comme screenShash, CameraRecoilController : un par application.
 */
export const cameraShakeController = new CameraShakeController();
