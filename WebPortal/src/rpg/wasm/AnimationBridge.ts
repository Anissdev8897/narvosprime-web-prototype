/**
 * AnimationBridge — pont entre squelettes Three.js et AnimationGraph WASM.
 *
 * Cold path : upload skeleton + clips depuis GLB vers C++ (une fois par modèle).
 * Hot path  : chaque frame, update le graph et écrire les bone matrices
 *             directement dans SkinnedMesh.skeleton.boneMatrices.
 */
import * as THREE from 'three';
import { getEngine } from './WasmBridge';

export interface WasmSkeletonHandle {
  skelId: number;
  graphId: number;
  boneCount: number;
  boneBufferPtr: number;
}

const FLOATS_PER_MATRIX = 16;

/**
 * Extrait le skeleton d'un SkinnedMesh et l'uploade vers WASM.
 * Retourne le skelId (pas encore de graph — appeler createAnimGraph après les clips).
 */
export function uploadSkeleton(mesh: THREE.SkinnedMesh): number {
  const engine = getEngine();
  if (!engine) return -1;

  const skeleton = mesh.skeleton;
  if (!skeleton || skeleton.bones.length === 0) return -1;

  const skelId = engine.animCreateSkeleton();

  const boneIndexMap = new Map<THREE.Bone, number>();
  skeleton.bones.forEach((bone, i) => boneIndexMap.set(bone, i));

  const invBindPtr = engine._malloc(FLOATS_PER_MATRIX * 4);

  for (let i = 0; i < skeleton.bones.length; i++) {
    const bone = skeleton.bones[i];
    const parentIdx = bone.parent instanceof THREE.Bone
      ? (boneIndexMap.get(bone.parent as THREE.Bone) ?? -1)
      : -1;

    const invBind = skeleton.boneInverses[i];
    engine.HEAPF32.set(invBind.elements, invBindPtr >> 2);

    engine.animAddBone(skelId, bone.name, parentIdx, invBindPtr);
  }

  engine._free(invBindPtr);
  engine.animFinalizeSkeleton(skelId);

  return skelId;
}

/**
 * Uploade un AnimationClip Three.js vers WASM.
 * Les tracks sont parsés en channels (position / quaternion / scale) par bone.
 */
export function uploadClip(skelId: number, clip: THREE.AnimationClip): number {
  const engine = getEngine();
  if (!engine) return -1;

  const clipId = engine.animCreateClip(skelId, clip.name, clip.duration);
  if (clipId < 0) return -1;

  const channelsByBone = new Map<string, {
    posTimes?: Float32Array; posVals?: Float32Array;
    rotTimes?: Float32Array; rotVals?: Float32Array;
    scaleTimes?: Float32Array; scaleVals?: Float32Array;
  }>();

  for (const track of clip.tracks) {
    const dotIdx = track.name.lastIndexOf('.');
    if (dotIdx === -1) continue;

    const boneName = track.name.substring(0, dotIdx);
    const prop = track.name.substring(dotIdx + 1);

    let entry = channelsByBone.get(boneName);
    if (!entry) { entry = {}; channelsByBone.set(boneName, entry); }

    const times = new Float32Array(track.times);
    const values = new Float32Array(track.values);

    if (prop === 'position') {
      entry.posTimes = times;
      entry.posVals = values;
    } else if (prop === 'quaternion') {
      entry.rotTimes = times;
      entry.rotVals = values;
    } else if (prop === 'scale') {
      entry.scaleTimes = times;
      entry.scaleVals = values;
    }
  }

  for (const [boneName, ch] of channelsByBone) {
    const ptCount = ch.posTimes?.length ?? 0;
    const rtCount = ch.rotTimes?.length ?? 0;
    const stCount = ch.scaleTimes?.length ?? 0;

    const totalFloats = (ptCount + ptCount * 3) + (rtCount + rtCount * 4) + (stCount + stCount * 3);
    if (totalFloats === 0) continue;

    const bufPtr = engine._malloc(totalFloats * 4);
    let offset = bufPtr >> 2;

    const writeTimes = (times: Float32Array | undefined, count: number): number => {
      if (!times || count === 0) return bufPtr;
      const ptr = offset;
      engine.HEAPF32.set(times, offset);
      offset += count;
      return ptr << 2;
    };
    const writeVals = (vals: Float32Array | undefined, count: number): number => {
      if (!vals || count === 0) return bufPtr;
      const ptr = offset;
      engine.HEAPF32.set(vals, offset);
      offset += count;
      return ptr << 2;
    };

    const ptTimesPtr = writeTimes(ch.posTimes, ptCount);
    const ptValsPtr = writeVals(ch.posVals, ptCount * 3);
    const rtTimesPtr = writeTimes(ch.rotTimes, rtCount);
    const rtValsPtr = writeVals(ch.rotVals, rtCount * 4);
    const stTimesPtr = writeTimes(ch.scaleTimes, stCount);
    const stValsPtr = writeVals(ch.scaleVals, stCount * 3);

    engine.animAddClipChannel(
      clipId, boneName,
      ptTimesPtr, ptValsPtr, ptCount,
      rtTimesPtr, rtValsPtr, rtCount,
      stTimesPtr, stValsPtr, stCount,
    );

    engine._free(bufPtr);
  }

  return clipId;
}

/**
 * Crée un AnimationGraph WASM pour un squelette donné.
 * Les clips doivent être uploadés AVANT cet appel.
 * Alloue le buffer de sortie pour les bone matrices.
 */
export function createAnimGraph(skelId: number): WasmSkeletonHandle | null {
  const engine = getEngine();
  if (!engine) return null;

  const graphId = engine.animCreateGraph(skelId);
  if (graphId < 0) return null;

  const boneCount = engine.animGraphBoneCount(graphId);
  const boneBufferPtr = engine._malloc(boneCount * FLOATS_PER_MATRIX * 4);

  return { skelId, graphId, boneCount, boneBufferPtr };
}

/**
 * Met à jour le graph et écrit les bone matrices directement
 * dans le skeleton Three.js. HOT PATH — appelé chaque frame.
 */
export function updateAndApplyBones(handle: WasmSkeletonHandle, dt: number, skeleton: THREE.Skeleton): void {
  const engine = getEngine();
  if (!engine || handle.boneCount === 0) return;

  engine.animGraphUpdate(handle.graphId, dt);
  const written = engine.animGraphWriteBones(handle.graphId, handle.boneBufferPtr, handle.boneCount);

  if (written > 0) {
    const src = engine.HEAPF32.subarray(
      handle.boneBufferPtr >> 2,
      (handle.boneBufferPtr >> 2) + written * FLOATS_PER_MATRIX,
    );
    skeleton.boneMatrices.set(src);
    if (skeleton.boneTexture) skeleton.boneTexture.needsUpdate = true;
  }
}

/**
 * Libère toutes les ressources WASM associées à un handle.
 */
export function destroyAnimGraph(handle: WasmSkeletonHandle): void {
  const engine = getEngine();
  if (!engine) return;

  if (handle.boneBufferPtr) engine._free(handle.boneBufferPtr);
  engine.animDestroyGraph(handle.graphId);
}

/**
 * Setup helpers pour construire le graph depuis JS.
 */
export function addClipNode(graphId: number, name: string, clipName: string, loop = true): void {
  getEngine()?.animGraphAddClipNode(graphId, name, clipName, loop);
}

export function addBlend1DEntry(graphId: number, nodeName: string, param: string, threshold: number, clipNodeName: string): void {
  getEngine()?.animGraphAddBlend1DEntry(graphId, nodeName, param, threshold, clipNodeName);
}

export function finalizeBlend1D(graphId: number, nodeName: string): void {
  getEngine()?.animGraphFinalizeBlend1D(graphId, nodeName);
}

export function setParamFloat(graphId: number, param: string, value: number): void {
  getEngine()?.animGraphSetParamFloat(graphId, param, value);
}

export function setParamBool(graphId: number, param: string, value: boolean): void {
  getEngine()?.animGraphSetParamBool(graphId, param, value);
}

export function setRootNode(graphId: number, nodeName: string): void {
  getEngine()?.animGraphSetRoot(graphId, nodeName);
}
