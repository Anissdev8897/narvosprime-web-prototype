/**
 * PhysicsSync — pont entre CollisionSystem WASM et Three.js
 *
 * Enregistre les bounding boxes des meshes Three.js dans le WASM,
 * et expose raycast/segment depuis le C++.
 */
import * as THREE from 'three';
import { getEngine } from './WasmBridge';

const _box = new THREE.Box3();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();

export function registerMeshCollider(entity: number, mesh: THREE.Object3D): void {
  const engine = getEngine();
  if (!engine) return;

  _box.setFromObject(mesh);
  mesh.getWorldPosition(_pos);
  mesh.getWorldScale(_scale);

  const localMin = _box.min.clone().sub(_pos).divide(_scale);
  const localMax = _box.max.clone().sub(_pos).divide(_scale);

  engine.registerCollider(
    entity,
    localMin.x, localMin.y, localMin.z,
    localMax.x, localMax.y, localMax.z,
    _pos.x, _pos.y, _pos.z,
    _scale.x, _scale.y, _scale.z,
  );
}

export function wasmRaycastDown(x: number, y: number, z: number): number {
  const engine = getEngine();
  if (!engine) return y - 10000;
  return engine.raycastDown(x, y, z);
}

export function wasmSegmentBlocked(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): boolean {
  const engine = getEngine();
  if (!engine) return false;
  return engine.isSegmentBlocked(ax, ay, az, bx, by, bz);
}

export function wasmSegmentCastDistance(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): number {
  const engine = getEngine();
  if (!engine) return Math.sqrt((bx-ax)**2 + (by-ay)**2 + (bz-az)**2);
  return engine.segmentCastDistance(ax, ay, az, bx, by, bz);
}

export function syncAllColliders(scene: THREE.Scene, entityMap: Map<THREE.Object3D, number>): void {
  const engine = getEngine();
  if (!engine) return;

  engine.clearColliders();
  entityMap.forEach((entityId, obj) => {
    registerMeshCollider(entityId, obj);
  });
}

/**
 * Enregistre tous les meshes collidables d'un sous-arbre en batch WASM.
 * Traverse le scene graph, calcule les AABBs monde, les upload en un
 * seul appel via flat Float32Array → HEAPF32 → registerColliderBatch.
 *
 * Retourne le nombre de colliders enregistrés.
 */
export function batchRegisterSceneColliders(
  root: THREE.Object3D,
  filter?: (o: THREE.Object3D) => boolean,
): number {
  const engine = getEngine();
  if (!engine) return 0;

  const meshes: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (obj.userData?.noCollide) return;
    if (filter && !filter(obj)) return;
    meshes.push(mesh);
  });

  if (meshes.length === 0) return 0;

  const FLOATS_PER = 12;
  const totalFloats = meshes.length * FLOATS_PER;
  const ptr = engine._malloc(totalFloats * 4);
  const offset = ptr >> 2;

  const box = new THREE.Box3();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();

  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i];
    box.setFromObject(mesh);
    mesh.getWorldPosition(pos);
    mesh.getWorldScale(scale);

    const sx = Math.abs(scale.x) < 1e-6 ? 1 : scale.x;
    const sy = Math.abs(scale.y) < 1e-6 ? 1 : scale.y;
    const sz = Math.abs(scale.z) < 1e-6 ? 1 : scale.z;

    const base = offset + i * FLOATS_PER;
    // localMin
    engine.HEAPF32[base    ] = (box.min.x - pos.x) / sx;
    engine.HEAPF32[base + 1] = (box.min.y - pos.y) / sy;
    engine.HEAPF32[base + 2] = (box.min.z - pos.z) / sz;
    // localMax
    engine.HEAPF32[base + 3] = (box.max.x - pos.x) / sx;
    engine.HEAPF32[base + 4] = (box.max.y - pos.y) / sy;
    engine.HEAPF32[base + 5] = (box.max.z - pos.z) / sz;
    // worldPos
    engine.HEAPF32[base + 6] = pos.x;
    engine.HEAPF32[base + 7] = pos.y;
    engine.HEAPF32[base + 8] = pos.z;
    // scale
    engine.HEAPF32[base + 9]  = sx;
    engine.HEAPF32[base + 10] = sy;
    engine.HEAPF32[base + 11] = sz;
  }

  const startEntity = 90000;
  engine.registerColliderBatch(ptr, meshes.length, startEntity);
  engine._free(ptr);

  return meshes.length;
}
