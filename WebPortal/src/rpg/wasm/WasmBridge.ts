/**
 * WasmBridge — charge et expose le module NarvosEngine WASM.
 * Singleton : un seul .wasm chargé, partagé par tous les systèmes.
 */

export interface WasmWorldStats {
  entityCount: number;
  colliderCount: number;
  aiEntityCount: number;
  deadEntityCount: number;
  statusEffectCount: number;
  activePathCount: number;
  navMeshWidth: number;
  navMeshDepth: number;
  bvhNodeCount: number;
  dynamicColliderCount: number;
  triggerZoneCount: number;
  triggerPendingEvents: number;
  timeScale: number;
  paused: boolean;
  bvhBuilt: boolean;
}

/**
 * Résultat du benchmark IK côté moteur.
 *
 * `IKController.ts` l'importait DEPUIS ce module alors qu'il n'y était pas
 * déclaré — ni ici, ni ailleurs dans le projet. Le type manquant faisait tomber
 * l'import entier du fichier.
 */
export interface IKBenchmarkResult {
  /** Longueur de chaîne testée (nombre d'os). */
  chainLength: number;
  /** Nombre d'itérations effectuées. */
  iterations: number;
  /** Temps total du run, en microsecondes. */
  totalUs: number;
  /** Temps moyen par itération, en microsecondes. */
  avgUs: number;
}

export interface NarvosWasmModule {
  // World / Coordinator
  tickWorld(dt: number): void;
  resetWorld(): void;
  initWorld(): void;
  pauseWorld(): void;
  resumeWorld(): void;
  isWorldPaused(): boolean;
  setTimeScale(scale: number): void;
  getTimeScale(): number;
  getWorldTime(): number;
  getTickCount(): number;
  getWorldStats(): WasmWorldStats;

  // ECS
  createNPC(x: number, y: number, z: number, role: number, health: number): number;
  createPlayer(x: number, y: number, z: number): number;
  destroyEntity(entity: number): void;
  setEntityPosition(entity: number, x: number, y: number, z: number): void;
  setEntityRotation(entity: number, pitch: number, yaw: number, roll: number): void;
  isEntityValid(entity: number): boolean;
  getEntityCount(): number;

  // Collision
  initCollisionSystem(): void;
  registerCollider(
    entity: number,
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
    posX: number, posY: number, posZ: number,
    scaleX: number, scaleY: number, scaleZ: number,
  ): void;
  clearColliders(): void;
  raycastDown(x: number, y: number, z: number): number;
  isSegmentBlocked(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean;
  segmentCastDistance(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number;
  registerColliderBatch(dataPtr: number, count: number, startEntity: number): void;
  getColliderCount(): number;

  // BVH + Dynamic colliders
  buildBVH(): void;
  bvhNodeCount(): number;
  isBVHBuilt(): boolean;
  dynamicColliderCount(): number;
  registerDynamicCollider(
    entity: number,
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
  ): void;
  updateDynamicCollider(
    entity: number,
    posX: number, posY: number, posZ: number,
    scaleX: number, scaleY: number, scaleZ: number,
  ): void;
  removeDynamicCollider(entity: number): void;

  // Trigger zones
  triggerRegisterZone(
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
    type: number, value: number,
  ): number;
  triggerRemoveZone(zoneEntity: number): void;
  triggerSetActive(zoneEntity: number, active: boolean): void;
  triggerDrainEvents(bufPtr: number, countPtr: number, maxEvents: number): void;
  triggerPendingCount(): number;
  triggerZoneCount(): number;
  triggerClear(): void;

  // Vehicle
  initVehicle(): void;
  updateVehicle(dt: number, throttle: number, brake: number, steer: number, handbrake: boolean): void;

  // Status effects
  applyBurn(entity: number, dps: number, duration: number): void;
  applyRoot(entity: number, duration: number): void;
  applyStun(entity: number, duration: number): void;
  isRooted(entity: number): boolean;
  isStunned(entity: number): boolean;

  // Damage
  emitDamage(x: number, y: number, z: number, amount: number, kind: number): void;
  drainDamageEvents(bufferPtr: number, countPtr: number, maxEvents: number): void;
  pendingDamageCount(): number;

  // Animation bridge
  animCreateSkeleton(): number;
  animAddBone(skelId: number, name: string, parentIdx: number, invBindPtr: number): void;
  animFinalizeSkeleton(skelId: number): void;
  animGetBoneCount(skelId: number): number;

  animCreateClip(skelId: number, name: string, duration: number): number;
  animAddClipChannel(
    clipId: number, boneName: string,
    ptPtr: number, pvPtr: number, posCount: number,
    rtPtr: number, rvPtr: number, rotCount: number,
    stPtr: number, svPtr: number, scaleCount: number,
  ): void;

  animCreateGraph(skelId: number): number;
  animGraphAddClipNode(graphId: number, name: string, clipName: string, loop: boolean): void;
  animGraphAddBlend1DEntry(graphId: number, nodeName: string, param: string, threshold: number, clipNodeName: string): void;
  animGraphFinalizeBlend1D(graphId: number, nodeName: string): void;
  animGraphSetParamFloat(graphId: number, param: string, value: number): void;
  animGraphSetParamBool(graphId: number, param: string, value: boolean): void;
  animGraphSetRoot(graphId: number, nodeName: string): void;
  animGraphUpdate(graphId: number, dt: number): void;
  animGraphBoneCount(graphId: number): number;
  animGraphWriteBones(graphId: number, outPtr: number, maxBones: number): number;
  animDestroyGraph(graphId: number): void;
  animDestroySkeleton(skelId: number): void;
  animClearAll(): void;

  // Chunk streaming
  streamingInit(budgetMB: number, maxLoaded: number, loadRadius: number, unloadRadius: number): void;
  streamingRegisterChunk(id: number, cx: number, cy: number, cz: number, radius: number, estimatedMB: number): void;
  streamingMarkLoaded(id: number): void;
  streamingMarkUnloaded(id: number): void;
  streamingTick(px: number, py: number, pz: number): void;
  streamingDrainCommands(outPtr: number, maxCount: number): number;
  streamingPendingCount(): number;
  streamingBudgetUsedMB(): number;
  streamingLoadedCount(): number;
  streamingChunkCount(): number;
  streamingSetRadii(loadRadius: number, unloadRadius: number): void;
  streamingClear(): void;
  streamingCacheFingerprint(): number;
  streamingUpdateChunkRadius(id: number, newRadius: number): void;

  // Asset budget manager (VRAM global, toutes catégories)
  budgetInit(totalBudgetMB: number): void;
  budgetSetCategoryBudget(category: number, budgetMB: number): void;
  budgetRegisterAsset(
    id: number, category: number, spatial: boolean,
    px: number, py: number, pz: number,
    sizeLow: number, sizeMed: number, sizeHigh: number,
    essential: boolean,
  ): void;
  budgetSetAssetPosition(id: number, px: number, py: number, pz: number): void;
  budgetMarkLoaded(id: number, tier: number): void;
  budgetMarkUnloaded(id: number): void;
  budgetTick(px: number, py: number, pz: number, loadRadius: number, unloadRadius: number): void;
  budgetDrainCommands(outPtr: number, maxCount: number): number;
  budgetPendingCount(): number;
  budgetTotalUsedMB(): number;
  budgetTotalBudgetMB(): number;
  budgetCategoryUsedMB(category: number): number;
  budgetLoadedCount(): number;
  budgetAssetCount(): number;
  budgetRecommendedTier(id: number, px: number, py: number, pz: number): number;
  budgetClear(): void;
  budgetCacheFingerprint(): number;

  // Navigation / NavMesh
  navInit(originX: number, originZ: number, cellSize: number, width: number, depth: number): void;
  navSetCell(x: number, z: number, y: number, walkable: boolean): void;
  navBakeFromHeightmap(heightsPtr: number, walkPtr: number, count: number): void;
  navIsWalkable(x: number, z: number): boolean;
  navSnapToNavMesh(x: number, y: number, z: number): [number, number, number];
  navClear(): void;
  navWidth(): number;
  navDepth(): number;
  navCellSize(): number;

  // PathManager
  navRequestPath(entity: number, tx: number, ty: number, tz: number): void;
  navCancelPath(entity: number): void;
  navClearAllPaths(): void;
  navHasPath(entity: number): boolean;
  navIsPathComplete(entity: number): boolean;
  navGetNextWaypoint(entity: number): [number, number, number];
  navActivePathCount(): number;
  navReadWaypoints(bufPtr: number, countPtr: number, maxEntries: number): void;

  // AISystem — écrit les décisions tactiques dans le buffer partagé
  aiWriteCommands(bufPtr: number, countPtr: number, maxCommands: number): void;

  // ── Math — bindings OPTIONNELS, NON IMPLÉMENTÉS côté C++ à ce jour ────────
  //
  // `MathWasm.ts` a été écrit en anticipation de ces bindings. Ils n'existent
  // ni dans `Bindings.cpp` (118 `function(...)`, aucun de ceux-ci), ni dans le
  // binaire livré — vérifié en cherchant les noms dans `public/wasm/narvos-engine.wasm`,
  // où `tickWorld`/`navRequestPath`/`buildBVH` sont bien présents et ceux-ci absents.
  //
  // Le `?` n'est donc PAS de la prudence décorative : c'est l'état réel du
  // module. Il oblige chaque appelant à tester la présence du binding avant de
  // l'invoquer, ce que `MathWasm.approach` faisait déjà seul (via un `as any`
  // qui, en supprimant l'erreur tsc, avait aussi supprimé le signal pour les 28
  // autres méthodes — elles lèvent `is not a function` dès que le WASM charge).
  //
  // Le jour où le C++ les implémente, il suffit de retirer les `?` : les gardes
  // `e?.nom` restent corrects et deviennent simplement toujours vrais.
  lerp?(a: number, b: number, t: number): number;
  lerpClamped?(a: number, b: number, t: number): number;
  inverseLerp?(a: number, b: number, v: number): number;
  smoothStep?(edge0: number, edge1: number, x: number): number;
  approach?(current: number, target: number, maxDelta: number): number;

  vec3Normalize?(ptr: number): void;
  vec3Add?(aPtr: number, bPtr: number, dstPtr: number): void;
  vec3Sub?(aPtr: number, bPtr: number, dstPtr: number): void;
  vec3Mul?(aPtr: number, bPtr: number, dstPtr: number): void;
  vec3Scale?(aPtr: number, scalar: number, dstPtr: number): void;
  vec3Dot?(aPtr: number, bPtr: number): number;
  vec3Cross?(aPtr: number, bPtr: number, dstPtr: number): void;
  vec3Length?(ptr: number): number;
  vec3LengthSq?(ptr: number): number;
  vec3Distance?(aPtr: number, bPtr: number): number;
  vec3Lerp?(aPtr: number, bPtr: number, t: number, dstPtr: number): void;

  quatNormalize?(ptr: number): void;
  quatSlerp?(aPtr: number, bPtr: number, t: number, dstPtr: number): void;
  quatMul?(aPtr: number, bPtr: number, dstPtr: number): void;
  /** In-place : conjugue le quaternion à `ptr` (pas de destination séparée). */
  quatConjugate?(ptr: number): void;
  quatLength?(ptr: number): number;
  quatFromTwoVectors?(fromPtr: number, toPtr: number, dstPtr: number): void;
  eulerToQuatDeg?(x: number, y: number, z: number, dstPtr: number): void;
  quatToEulerDeg?(ptr: number, dstPtr: number): void;

  mat4Mul?(aPtr: number, bPtr: number, dstPtr: number): void;
  /** In-place. */
  mat4Transpose?(ptr: number): void;
  /** In-place ; `false` si la matrice est singulière. */
  mat4Inverse?(ptr: number): boolean;

  batchVec3Normalize?(ptr: number, count: number): void;
  /** Écrit `BLEND_DIR_COUNT` poids de blend directionnel à `dstPtr`. */
  calcBlendWeights?(speed: number, directionDeg: number, dstPtr: number): void;

  // ── IK / AnimationGraph — bindings OPTIONNELS, NON IMPLÉMENTÉS côté C++ ────
  //
  // Même situation que le bloc math ci-dessus : `IKController.ts` et
  // `WasmAnimationGraph.ts` ont été écrits en anticipation. Aucun de ces noms
  // n'est présent dans `Bindings.cpp` ni dans `public/wasm/narvos-engine.wasm`.
  // `animGraphSetRoot`, lui, existe — d'où le « Did you mean 'animGraphSetRoot'? »
  // de tsc, qui indiquait bien que le voisin réel était à côté.
  animGraphAddIKTwoBone?(
    graphId: number, targetName: string,
    effector: string, mid: string, root: string,
  ): void;
  animGraphAddFABRIK?(
    graphId: number, targetName: string,
    bones: string[], maxIterations: number,
  ): void;
  animGraphAddChainLookAt?(
    graphId: number, targetName: string,
    bones: string[], weights: number[],
  ): void;
  animGraphAddFootLock?(
    graphId: number, name: string,
    feet: string[], ankles: string[], ikRoots: string[],
  ): void;
  animGraphSetTarget?(graphId: number, name: string, x: number, y: number, z: number): void;
  animGraphAddBlendDirectional?(
    graphId: number, nodeName: string, clipPrefix: string,
    speedParam: string, directionParam: string,
  ): void;
  /** Retourne le nombre de décisions écrites dans le buffer. */
  animGraphGetBlendDecisions?(graphId: number, bufPtr: number, capacity: number): number;
  animRunBenchmark?(chainLength: number, iterations: number): IKBenchmarkResult;

  // Emscripten memory
  HEAPF32: Float32Array;
  HEAPU32: Uint32Array;
  _malloc(size: number): number;
  _free(ptr: number): void;
}

let wasmModule: NarvosWasmModule | null = null;
let loadPromise: Promise<NarvosWasmModule> | null = null;

export async function loadNarvosEngine(): Promise<NarvosWasmModule> {
  if (wasmModule) return wasmModule;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (typeof document === "undefined") {
      throw new Error("WASM requires a browser environment");
    }
    // Emscripten MODULARIZE=1 EXPORT_NAME=NarvosEngine produit un UMD
    // (var NarvosEngine = ...), PAS un ES module. import() échoue :
    //   - Vite bloque les import() sur public/ ("should not be imported from source code")
    //   - Pas de export default → .default serait undefined
    // Solution : <script> tag classique → factory sur globalThis.
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/wasm/narvos-engine.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load /wasm/narvos-engine.js"));
      document.head.appendChild(script);
    });

    const factory = (globalThis as unknown as Record<string, unknown>).NarvosEngine as
      ((opts: Record<string, unknown>) => Promise<NarvosWasmModule>) | undefined;
    if (!factory) throw new Error("NarvosEngine factory not found on globalThis");

    const mod = await factory({
      locateFile: (path: string) => `/wasm/${path}`,
    });
    wasmModule = mod as NarvosWasmModule;
    return wasmModule;
  })();

  return loadPromise;
}

export function getEngine(): NarvosWasmModule | null {
  return wasmModule;
}

export function isEngineLoaded(): boolean {
  return wasmModule !== null;
}
