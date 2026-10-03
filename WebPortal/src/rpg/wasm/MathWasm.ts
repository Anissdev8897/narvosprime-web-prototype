// ══════════════════════════════════════════════════════════════════════════════
// wasm/MathWasm.ts — Bridge TypeScript ↔ WASM pour les calculs mathématiques
//
// Architecture :
//   • Les opérations scalaires sont appelées directement via embind (approach, lerp, …)
//   • Les opérations vectorielles/quaternion utilisent des buffers HeapF32 partagés
//     pour éviter la copie de données JS ↔ WASM
//   • Chaque opération a un fallback JS pur quand le binding WASM est absent
//
// ⚠️ ÉTAT RÉEL AU 02/08/2026 — AUCUN de ces bindings math n'existe côté C++.
// `Bindings.cpp` en déclare 118, pas un seul de ceux-ci, et les noms sont
// absents du binaire `public/wasm/narvos-engine.wasm` (où `tickWorld`,
// `navRequestPath` et `buildBVH`, eux, sont bien présents). Ce fichier tourne
// donc à 100 % sur ses fallbacks JS.
//
// C'est pourquoi le garde est `if (e?.nom)` et non `if (e)` : tester « moteur
// chargé » ne dit RIEN sur la présence d'un binding donné. Avec l'ancien garde,
// chaque méthode levait `is not a function` dès que le WASM se chargeait, et le
// fallback juste en dessous n'était jamais atteint. Seul `approach` — la seule
// méthode réellement appelée en production (CharacterController, chemin chaud) —
// avait été rustinée au cas par cas.
//
// ⚠️ Limite du fallback : l'API est à base de POINTEURS dans le tas WASM. Sans
// moteur chargé il n'y a pas de `HEAPF32`, donc les fallbacks vectoriels sortent
// sans rien écrire. Seules les opérations scalaires (approach, lerp, smoothStep…)
// fonctionnent réellement hors WASM.
// ══════════════════════════════════════════════════════════════════════════════

import { getEngine, isEngineLoaded, type NarvosWasmModule } from "./WasmBridge";

// ── Constantes de layout mémoire (HeapF32) ────────────────────────────────────
// Tous les offsets sont en BYTES (doivent être alignés sur 4 pour f32)
/** Taille d'un vec3 dans le buffer (3 × f32 = 12 octets). */
export const VEC3_STRIDE = 12;
/** Taille d'un quaternion dans le buffer (4 × f32 = 16 octets). */
export const QUAT_STRIDE = 16;
/** Taille d'une mat4 dans le buffer (16 × f32 = 64 octets). */
export const MAT4_STRIDE = 64;
/** Nombre max de poids de blend directionnel. */
export const BLEND_DIR_COUNT = 8;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Vec3Buffer {
  /** Pointeur WASM (bytes) vers le début du vec3 dans HEAPF32. */
  ptr: number;
}

export interface QuatBuffer {
  ptr: number;
}

export interface Mat4Buffer {
  ptr: number;
}

export interface BlendWeightsResult {
  weights: Float32Array;
  ptr: number;
}

// ── Allocation helper ─────────────────────────────────────────────────────────

/**
 * Alloue `floatCount` f32 dans le tas WASM.
 * @returns le pointeur (bytes) ou 0 si WASM non dispo.
 */
function mallocF32(floatCount: number): number {
  const eng = getEngine();
  if (!eng) return 0;
  return eng._malloc(floatCount * 4);
}

function freeWasm(ptr: number): void {
  const eng = getEngine();
  if (!eng || ptr <= 0) return;
  eng._free(ptr);
}

// ══════════════════════════════════════════════════════════════════════════════
//  MathWasm — Fonctions mathématiques avec fallback JS
// ══════════════════════════════════════════════════════════════════════════════

export class MathWasm {
  // ── Buffer de travail (alloué une fois, réutilisé) ───────────────────────
  /** Buffer de travail pour les opérations temporaires (taille: 1024 f32 = 4KB). */
  private workPtr = 0;
  private workF32Count = 1024;
  private workAllocated = false;

  /** Buffer pour les résultats de blend (8 f32). */
  private blendPtr = 0;

  /** Alloue les buffers de travail si WASM dispo. */
  init(): void {
    const eng = getEngine();
    if (!eng) return;
    if (!this.workAllocated) {
      this.workPtr = eng._malloc(this.workF32Count * 4);
      this.blendPtr = eng._malloc(BLEND_DIR_COUNT * 4);
      this.workAllocated = true;
    }
  }

  /** Libère les buffers WASM. */
  dispose(): void {
    const eng = getEngine();
    if (!eng) return;
    if (this.workAllocated) {
      eng._free(this.workPtr);
      eng._free(this.blendPtr);
      this.workAllocated = false;
      this.workPtr = 0;
      this.blendPtr = 0;
    }
  }

  /** Retourne true si WASM est chargé ET les buffers sont alloués. */
  get ready(): boolean {
    return this.workAllocated && isEngineLoaded();
  }

  /** Raccourci vers l'engine WASM (undefined si pas prêt). */
  private get eng(): NarvosWasmModule | undefined {
    return this.ready ? getEngine()! : undefined;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Operations scalaires (appel embind direct)
  // ════════════════════════════════════════════════════════════════════════

  approach(current: number, target: number, maxDelta: number): number {
    const e = this.eng;
    if (e?.approach) return e.approach(current, target, maxDelta);
    // Fallback JS
    const d = target - current;
    if (Math.abs(d) <= maxDelta) return target;
    return current + Math.sign(d) * maxDelta;
  }

  lerp(a: number, b: number, t: number): number {
    const e = this.eng;
    if (e?.lerp) return e.lerp(a, b, t);
    return a + (b - a) * t;
  }

  lerpClamped(a: number, b: number, t: number): number {
    const e = this.eng;
    if (e?.lerpClamped) return e.lerpClamped(a, b, t);
    if (t <= 0) return a;
    if (t >= 1) return b;
    return a + (b - a) * t;
  }

  inverseLerp(a: number, b: number, v: number): number {
    const e = this.eng;
    if (e?.inverseLerp) return e.inverseLerp(a, b, v);
    const d = b - a;
    if (Math.abs(d) < 1e-10) return 0;
    return (v - a) / d;
  }

  smoothStep(edge0: number, edge1: number, x: number): number {
    const e = this.eng;
    if (e?.smoothStep) return e.smoothStep(edge0, edge1, x);
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Vec3 operations (buffer-based)
  // ════════════════════════════════════════════════════════════════════════

  /** Écrit un vec3 [x,y,z] dans le buffer WASM à l'offset (bytes). */
  writeVec3(ptr: number, x: number, y: number, z: number): void {
    const e = getEngine();
    if (e) {
      e.HEAPF32[ptr >> 2] = x;
      e.HEAPF32[(ptr >> 2) + 1] = y;
      e.HEAPF32[(ptr >> 2) + 2] = z;
    }
  }

  /** Lit un vec3 depuis le buffer WASM. */
  readVec3(ptr: number): [number, number, number] {
    const e = getEngine();
    if (e) {
      const idx = ptr >> 2;
      return [e.HEAPF32[idx], e.HEAPF32[idx + 1], e.HEAPF32[idx + 2]];
    }
    return [0, 0, 0];
  }

  /** Écrit un quaternion [x,y,z,w] dans le buffer WASM. */
  writeQuat(ptr: number, x: number, y: number, z: number, w: number): void {
    const e = getEngine();
    if (e) {
      e.HEAPF32[ptr >> 2] = x;
      e.HEAPF32[(ptr >> 2) + 1] = y;
      e.HEAPF32[(ptr >> 2) + 2] = z;
      e.HEAPF32[(ptr >> 2) + 3] = w;
    }
  }

  /** Lit un quaternion [x,y,z,w] depuis le buffer WASM. */
  readQuat(ptr: number): [number, number, number, number] {
    const e = getEngine();
    if (e) {
      const idx = ptr >> 2;
      return [e.HEAPF32[idx], e.HEAPF32[idx + 1], e.HEAPF32[idx + 2], e.HEAPF32[idx + 3]];
    }
    return [0, 0, 0, 1];
  }

  /** Norme un vec3 in-place dans le buffer HeapF32. */
  vec3Normalize(ptr: number): void {
    const e = this.eng;
    if (e?.vec3Normalize) {
      e.vec3Normalize(ptr);
      return;
    }
    // Fallback JS
    const idx = ptr >> 2;
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const x = heap[idx], y = heap[idx + 1], z = heap[idx + 2];
    const lenSq = x * x + y * y + z * z;
    if (lenSq > 1e-10) {
      const invLen = 1 / Math.sqrt(lenSq);
      heap[idx] = x * invLen;
      heap[idx + 1] = y * invLen;
      heap[idx + 2] = z * invLen;
    }
  }

  /**
   * Vec3 add: lit a et b du buffer écrit le résultat dans dst.
   * Tous les offsets sont en bytes.
   */
  vec3Add(aPtr: number, bPtr: number, dstPtr: number): void {
    const e = this.eng;
    if (e?.vec3Add) {
      e.vec3Add(aPtr, bPtr, dstPtr);
      return;
    }
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const ai = aPtr >> 2, bi = bPtr >> 2, di = dstPtr >> 2;
    heap[di] = heap[ai] + heap[bi];
    heap[di + 1] = heap[ai + 1] + heap[bi + 1];
    heap[di + 2] = heap[ai + 2] + heap[bi + 2];
  }

  vec3Sub(aPtr: number, bPtr: number, dstPtr: number): void {
    const e = this.eng;
    if (e?.vec3Sub) { e.vec3Sub(aPtr, bPtr, dstPtr); return; }
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const ai = aPtr >> 2, bi = bPtr >> 2, di = dstPtr >> 2;
    heap[di] = heap[ai] - heap[bi];
    heap[di + 1] = heap[ai + 1] - heap[bi + 1];
    heap[di + 2] = heap[ai + 2] - heap[bi + 2];
  }

  vec3Mul(aPtr: number, bPtr: number, dstPtr: number): void {
    const e = this.eng;
    if (e?.vec3Mul) { e.vec3Mul(aPtr, bPtr, dstPtr); return; }
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const ai = aPtr >> 2, bi = bPtr >> 2, di = dstPtr >> 2;
    heap[di] = heap[ai] * heap[bi];
    heap[di + 1] = heap[ai + 1] * heap[bi + 1];
    heap[di + 2] = heap[ai + 2] * heap[bi + 2];
  }

  vec3Scale(vPtr: number, s: number, dstPtr: number): void {
    const e = this.eng;
    if (e?.vec3Scale) { e.vec3Scale(vPtr, s, dstPtr); return; }
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const vi = vPtr >> 2, di = dstPtr >> 2;
    heap[di] = heap[vi] * s;
    heap[di + 1] = heap[vi + 1] * s;
    heap[di + 2] = heap[vi + 2] * s;
  }

  vec3Dot(aPtr: number, bPtr: number): number {
    const e = this.eng;
    if (e?.vec3Dot) return e.vec3Dot(aPtr, bPtr);
    const heap = getEngine()?.HEAPF32;
    if (!heap) return 0;
    const ai = aPtr >> 2, bi = bPtr >> 2;
    return heap[ai] * heap[bi] + heap[ai + 1] * heap[bi + 1] + heap[ai + 2] * heap[bi + 2];
  }

  vec3Cross(aPtr: number, bPtr: number, dstPtr: number): void {
    const e = this.eng;
    if (e?.vec3Cross) { e.vec3Cross(aPtr, bPtr, dstPtr); return; }
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const ai = aPtr >> 2, bi = bPtr >> 2, di = dstPtr >> 2;
    const ax = heap[ai], ay = heap[ai + 1], az = heap[ai + 2];
    const bx = heap[bi], by = heap[bi + 1], bz = heap[bi + 2];
    heap[di] = ay * bz - az * by;
    heap[di + 1] = az * bx - ax * bz;
    heap[di + 2] = ax * by - ay * bx;
  }

  vec3Length(ptr: number): number {
    const e = this.eng;
    if (e?.vec3Length) return e.vec3Length(ptr);
    const heap = getEngine()?.HEAPF32;
    if (!heap) return 0;
    const i = ptr >> 2;
    return Math.sqrt(heap[i] * heap[i] + heap[i + 1] * heap[i + 1] + heap[i + 2] * heap[i + 2]);
  }

  vec3Distance(aPtr: number, bPtr: number): number {
    const e = this.eng;
    if (e?.vec3Distance) return e.vec3Distance(aPtr, bPtr);
    const heap = getEngine()?.HEAPF32;
    if (!heap) return 0;
    const ai = aPtr >> 2, bi = bPtr >> 2;
    const dx = heap[ai] - heap[bi], dy = heap[ai + 1] - heap[bi + 1], dz = heap[ai + 2] - heap[bi + 2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  vec3LengthSq(ptr: number): number {
    const e = this.eng;
    if (e?.vec3LengthSq) return e.vec3LengthSq(ptr);
    const heap = getEngine()?.HEAPF32;
    if (!heap) return 0;
    const i = ptr >> 2;
    return heap[i] * heap[i] + heap[i + 1] * heap[i + 1] + heap[i + 2] * heap[i + 2];
  }

  vec3Lerp(aPtr: number, bPtr: number, t: number, dstPtr: number): void {
    const e = this.eng;
    if (e?.vec3Lerp) { e.vec3Lerp(aPtr, bPtr, t, dstPtr); return; }
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const ai = aPtr >> 2, bi = bPtr >> 2, di = dstPtr >> 2;
    heap[di] = heap[ai] + (heap[bi] - heap[ai]) * t;
    heap[di + 1] = heap[ai + 1] + (heap[bi + 1] - heap[ai + 1]) * t;
    heap[di + 2] = heap[ai + 2] + (heap[bi + 2] - heap[ai + 2]) * t;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Quaternion operations
  // ════════════════════════════════════════════════════════════════════════

  quatNormalize(ptr: number): void {
    const e = this.eng;
    if (e?.quatNormalize) { e.quatNormalize(ptr); return; }
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const i = ptr >> 2;
    const x = heap[i], y = heap[i + 1], z = heap[i + 2], w = heap[i + 3];
    const lenSq = x * x + y * y + z * z + w * w;
    if (lenSq > 1e-10) {
      const invLen = 1 / Math.sqrt(lenSq);
      heap[i] = x * invLen; heap[i + 1] = y * invLen;
      heap[i + 2] = z * invLen; heap[i + 3] = w * invLen;
    }
  }

  quatSlerp(aPtr: number, bPtr: number, t: number, dstPtr: number): void {
    const e = this.eng;
    if (e?.quatSlerp) { e.quatSlerp(aPtr, bPtr, t, dstPtr); return; }
    // Fallback JS slerp
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const ai = aPtr >> 2, bi = bPtr >> 2, di = dstPtr >> 2;
    let ax = heap[ai], ay = heap[ai + 1], az = heap[ai + 2], aw = heap[ai + 3];
    let bx = heap[bi], by = heap[bi + 1], bz = heap[bi + 2], bw = heap[bi + 3];

    let cosOmega = ax * bx + ay * by + az * bz + aw * bw;
    if (cosOmega < 0) {
      bx = -bx; by = -by; bz = -bz; bw = -bw;
      cosOmega = -cosOmega;
    }
    let k0, k1;
    if (cosOmega > 0.9999) {
      k0 = 1 - t;
      k1 = t;
    } else {
      const sinOmega = Math.sqrt(1 - cosOmega * cosOmega);
      const omega = Math.atan2(sinOmega, cosOmega);
      const invSinOmega = 1 / sinOmega;
      k0 = Math.sin((1 - t) * omega) * invSinOmega;
      k1 = Math.sin(t * omega) * invSinOmega;
    }
    heap[di] = ax * k0 + bx * k1;
    heap[di + 1] = ay * k0 + by * k1;
    heap[di + 2] = az * k0 + bz * k1;
    heap[di + 3] = aw * k0 + bw * k1;
  }

  quatMul(aPtr: number, bPtr: number, dstPtr: number): void {
    const e = this.eng;
    if (e?.quatMul) { e.quatMul(aPtr, bPtr, dstPtr); return; }
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const ai = aPtr >> 2, bi = bPtr >> 2, di = dstPtr >> 2;
    const ax = heap[ai], ay = heap[ai + 1], az = heap[ai + 2], aw = heap[ai + 3];
    const bx = heap[bi], by = heap[bi + 1], bz = heap[bi + 2], bw = heap[bi + 3];
    heap[di] = aw * bx + ax * bw + ay * bz - az * by;
    heap[di + 1] = aw * by - ax * bz + ay * bw + az * bx;
    heap[di + 2] = aw * bz + ax * by - ay * bx + az * bw;
    heap[di + 3] = aw * bw - ax * bx - ay * by - az * bz;
  }

  quatConjugate(ptr: number): void {
    const e = this.eng;
    if (e?.quatConjugate) { e.quatConjugate(ptr); return; }
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const i = ptr >> 2;
    heap[i] = -heap[i];
    heap[i + 1] = -heap[i + 1];
    heap[i + 2] = -heap[i + 2];
  }

  quatLength(ptr: number): number {
    const e = this.eng;
    if (e?.quatLength) return e.quatLength(ptr);
    const heap = getEngine()?.HEAPF32;
    if (!heap) return 1;
    const i = ptr >> 2;
    return Math.sqrt(heap[i] * heap[i] + heap[i + 1] * heap[i + 1] +
                     heap[i + 2] * heap[i + 2] + heap[i + 3] * heap[i + 3]);
  }

  eulerToQuatDeg(pitchDeg: number, yawDeg: number, rollDeg: number, dstPtr: number): void {
    const e = this.eng;
    if (e?.eulerToQuatDeg) { e.eulerToQuatDeg(pitchDeg, yawDeg, rollDeg, dstPtr); return; }
    // Fallback JS
    const p = pitchDeg * Math.PI / 180, y = yawDeg * Math.PI / 180, r = rollDeg * Math.PI / 180;
    const cx = Math.cos(p * 0.5), sx = Math.sin(p * 0.5);
    const cy = Math.cos(y * 0.5), sy = Math.sin(y * 0.5);
    const cz = Math.cos(r * 0.5), sz = Math.sin(r * 0.5);
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const di = dstPtr >> 2;
    heap[di] = sx * cy * cz + cx * sy * sz;     // x
    heap[di + 1] = cx * sy * cz - sx * cy * sz; // y
    heap[di + 2] = cx * cy * sz + sx * sy * cz; // z
    heap[di + 3] = cx * cy * cz - sx * sy * sz; // w
  }

  quatToEulerDeg(ptr: number, dstPtr: number): void {
    const e = this.eng;
    if (e?.quatToEulerDeg) { e.quatToEulerDeg(ptr, dstPtr); return; }
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const i = ptr >> 2, di = dstPtr >> 2;
    const x = heap[i], y = heap[i + 1], z = heap[i + 2], w = heap[i + 3];
    // ZYX Euler angles (roll, pitch, yaw)
    const sinPitch = 2 * (w * y - z * x);
    if (Math.abs(sinPitch) >= 1) {
      heap[di] = 0;
      heap[di + 1] = (sinPitch > 0 ? 1 : -1) * Math.PI / 2;
      heap[di + 2] = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    } else {
      heap[di] = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
      heap[di + 1] = Math.asin(sinPitch);
      heap[di + 2] = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    }
    heap[di] *= 180 / Math.PI;
    heap[di + 1] *= 180 / Math.PI;
    heap[di + 2] *= 180 / Math.PI;
  }

  quatFromTwoVectors(fromPtr: number, toPtr: number, dstPtr: number): void {
    const e = this.eng;
    if (e?.quatFromTwoVectors) { e.quatFromTwoVectors(fromPtr, toPtr, dstPtr); return; }
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const fi = fromPtr >> 2, ti = toPtr >> 2, di = dstPtr >> 2;
    const fx = heap[fi], fy = heap[fi + 1], fz = heap[fi + 2];
    const tx = heap[ti], ty = heap[ti + 1], tz = heap[ti + 2];
    const flen = Math.sqrt(fx * fx + fy * fy + fz * fz);
    const tlen = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (flen < 1e-10 || tlen < 1e-10) {
      heap[di] = 0; heap[di + 1] = 0; heap[di + 2] = 0; heap[di + 3] = 1;
      return;
    }
    const fxn = fx / flen, fyn = fy / flen, fzn = fz / flen;
    const txn = tx / tlen, tyn = ty / tlen, tzn = tz / tlen;
    const dot = fxn * txn + fyn * ty + fzn * tzn;
    if (dot > 0.9999) {
      heap[di] = 0; heap[di + 1] = 0; heap[di + 2] = 0; heap[di + 3] = 1;
      return;
    }
    if (dot < -0.9999) {
      // 180-degree rotation: rotate around an arbitrary perpendicular axis
      const axisX = 1, axisY = 0, axisZ = 0;
      const s = Math.sin(Math.PI / 2);
      heap[di] = axisX * s; heap[di + 1] = axisY * s;
      heap[di + 2] = axisZ * s; heap[di + 3] = 0;
      return;
    }
    const cx = fyn * tzn - fzn * tyn;
    const cy = fzn * txn - fxn * tzn;
    const cz = fxn * tyn - fyn * txn;
    const w = 1 + dot;
    const invLen = 1 / Math.sqrt(cx * cx + cy * cy + cz * cz + w * w);
    heap[di] = cx * invLen; heap[di + 1] = cy * invLen;
    heap[di + 2] = cz * invLen; heap[di + 3] = w * invLen;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Matrix operations
  // ════════════════════════════════════════════════════════════════════════

  mat4Mul(aPtr: number, bPtr: number, dstPtr: number): void {
    const e = this.eng;
    if (e?.mat4Mul) { e.mat4Mul(aPtr, bPtr, dstPtr); return; }
    // Fallback JS
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const ai = aPtr >> 2, bi = bPtr >> 2, di = dstPtr >> 2;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += heap[ai + row + k * 4] * heap[bi + k + col * 4];
        }
        heap[di + row + col * 4] = sum;
      }
    }
  }

  mat4Transpose(ptr: number): void {
    const e = this.eng;
    if (e?.mat4Transpose) { e.mat4Transpose(ptr); return; }
    const heap = getEngine()?.HEAPF32;
    if (!heap) return;
    const i = ptr >> 2;
    for (let row = 0; row < 4; row++) {
      for (let col = row + 1; col < 4; col++) {
        const a = row + col * 4, b = col + row * 4;
        const tmp = heap[i + a];
        heap[i + a] = heap[i + b];
        heap[i + b] = tmp;
      }
    }
  }

  mat4Inverse(ptr: number): boolean {
    const e = this.eng;
    if (e?.mat4Inverse) return e.mat4Inverse(ptr);
    // Fallback JS (Gauss-Jordan)
    const heap = getEngine()?.HEAPF32;
    if (!heap) return false;
    const i = ptr >> 2;
    const m = new Float32Array(heap.buffer, ptr, 16);
    const inv = new Float32Array(16);
    for (let j = 0; j < 16; j++) inv[j] = (j % 5 === 0) ? 1 : 0; // identity
    for (let col = 0; col < 4; col++) {
      // Find pivot
      let pivot = col;
      let maxAbs = Math.abs(m[col + col * 4]);
      for (let row = col + 1; row < 4; row++) {
        const a = Math.abs(m[row + col * 4]);
        if (a > maxAbs) { maxAbs = a; pivot = row; }
      }
      if (maxAbs < 1e-10) return false; // singular
      // Swap rows
      if (pivot !== col) {
        for (let j = 0; j < 4; j++) {
          let tmp = m[col + j * 4]; m[col + j * 4] = m[pivot + j * 4]; m[pivot + j * 4] = tmp;
          tmp = inv[col + j * 4]; inv[col + j * 4] = inv[pivot + j * 4]; inv[pivot + j * 4] = tmp;
        }
      }
      const pivotVal = m[col + col * 4];
      for (let j = 0; j < 4; j++) {
        m[col + j * 4] /= pivotVal;
        inv[col + j * 4] /= pivotVal;
      }
      for (let row = 0; row < 4; row++) {
        if (row === col) continue;
        const factor = m[row + col * 4];
        if (factor === 0) continue;
        for (let j = 0; j < 4; j++) {
          m[row + j * 4] -= factor * m[col + j * 4];
          inv[row + j * 4] -= factor * inv[col + j * 4];
        }
      }
    }
    for (let j = 0; j < 16; j++) heap[i + j] = inv[j];
    return true;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Batch operations
  // ════════════════════════════════════════════════════════════════════════

  /** Norme N vec3 consécutifs dans le buffer (stride = 12 bytes). */
  batchVec3Normalize(basePtr: number, count: number): void {
    const e = this.eng;
    if (e?.batchVec3Normalize) { e.batchVec3Normalize(basePtr, count); return; }
    for (let i = 0; i < count; i++) {
      this.vec3Normalize(basePtr + i * VEC3_STRIDE);
    }
  }

  /**
   * Calcule les 8 poids de blend directionnel à partir de la vitesse
   * et de la direction (degrés, 0=avant).
   * Retourne un Float32Array de 8 poids.
   */
  calcBlendWeights(speed: number, directionDeg: number): Float32Array {
    const e = this.eng;
    if (e?.calcBlendWeights && this.blendPtr > 0) {
      e.calcBlendWeights(speed, directionDeg, this.blendPtr);
      return new Float32Array(e.HEAPF32.buffer, this.blendPtr, BLEND_DIR_COUNT);
    }
    // Fallback JS
    const weights = new Float32Array(BLEND_DIR_COUNT);
    const dirRad = directionDeg * Math.PI / 180;
    const cosDir = Math.cos(dirRad);
    const sinDir = Math.sin(dirRad);
    const CARD_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
    let total = 0;
    for (let i = 0; i < 8; i++) {
      const cardRad = CARD_ANGLES[i] * Math.PI / 180;
      const dot = Math.cos(dirRad - cardRad);
      let w = dot > 0 ? dot * dot : 0;
      w *= (speed > 0.01) ? 1 : 0.125;
      weights[i] = w;
      total += w;
    }
    if (total > 1e-10) {
      const invTotal = 1 / total;
      for (let i = 0; i < 8; i++) weights[i] *= invTotal;
    } else {
      weights[0] = 1;
    }
    return weights;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  Singleton global de MathWasm
// ══════════════════════════════════════════════════════════════════════════════

/** Instance partagée de MathWasm. */
export const mathWasm = new MathWasm();
