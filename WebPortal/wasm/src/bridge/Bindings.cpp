// Emscripten embind bindings — exposes NarvosEngine C++ to JavaScript
#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
#include <emscripten/val.h>
#endif

#include "ecs/Registry.h"
#include "components/Transform.h"
#include "components/Health.h"
#include "components/Weapon.h"
#include "components/PlayerTag.h"
#include "components/AITactical.h"
#include "animation/AnimationGraph.h"
#include "physics/CollisionSystem.h"
#include "physics/Vehicle.h"
#include "ai/AISystem.h"
#include "combat/DamageEvents.h"
#include "combat/StatusEffects.h"
#include "bridge/AnimationBridge.h"
#include "bridge/WorldCoordinator.h"
#include "streaming/ChunkStreamingManager.h"
#include "streaming/AssetBudgetManager.h"
#include "navigation/NavMesh.h"
#include "navigation/PathManager.h"
#include "physics/TriggerSystem.h"

namespace nv
{
    // Coordinator delegates — thin wrappers for embind
    void TickWorld(f32 dt)   { g_WorldCoordinator.Tick(dt); }
    void ResetWorld()        { g_WorldCoordinator.Reset(); }
    void InitWorld()         { g_WorldCoordinator.Init(); }

    Entity CreateNPC(f32 x, f32 y, f32 z, u8 role, f32 health)
    {
        return g_WorldCoordinator.CreateNPCEntity(x, y, z, role, health);
    }

    Entity CreatePlayer(f32 x, f32 y, f32 z)
    {
        return g_WorldCoordinator.CreatePlayerEntity(x, y, z);
    }

    void DestroyEntityJS(Entity e) { g_WorldCoordinator.DestroyEntity(e); }

    void SetEntityPosition(Entity e, f32 x, f32 y, f32 z)
    {
        Transform* t = g_Registry.GetComponent<Transform>(e);
        if (t) t->position = {x, y, z};
    }

    void SetEntityRotation(Entity e, f32 pitch, f32 yaw, f32 roll)
    {
        Transform* t = g_Registry.GetComponent<Transform>(e);
        if (t) t->rotation = {pitch, yaw, roll};
    }

    // Physics bridge: register collider from JS (box bounds from Three.js)
    void RegisterCollider(Entity e, f32 minX, f32 minY, f32 minZ, f32 maxX, f32 maxY, f32 maxZ,
                          f32 posX, f32 posY, f32 posZ, f32 scaleX, f32 scaleY, f32 scaleZ)
    {
        AABB bounds;
        bounds.min = {minX, minY, minZ};
        bounds.max = {maxX, maxY, maxZ};
        Transform t;
        t.position = {posX, posY, posZ};
        t.scale = {scaleX, scaleY, scaleZ};
        g_CollisionSystem.RegisterStatic(e, bounds, t);
    }

    float RaycastDownFromJS(f32 x, f32 y, f32 z)
    {
        return g_CollisionSystem.RaycastDown({x, y, z});
    }

    bool IsSegmentBlocked(f32 ax, f32 ay, f32 az, f32 bx, f32 by, f32 bz)
    {
        return g_CollisionSystem.SegmentBlocked({ax, ay, az}, {bx, by, bz});
    }

    float SegmentCastDist(f32 ax, f32 ay, f32 az, f32 bx, f32 by, f32 bz)
    {
        return g_CollisionSystem.SegmentCastDistance({ax, ay, az}, {bx, by, bz});
    }

    // Batch registration: flat array of (minX,minY,minZ, maxX,maxY,maxZ, posX,posY,posZ, scaleX,scaleY,scaleZ) per collider
    // Entity IDs assigned incrementally from a starting value
    void RegisterColliderBatch(uintptr_t dataPtr, int count, Entity startEntity)
    {
        const float* data = reinterpret_cast<const float*>(dataPtr);
        for (int i = 0; i < count; ++i)
        {
            const float* c = data + i * 12;
            AABB bounds;
            bounds.min = {c[0], c[1], c[2]};
            bounds.max = {c[3], c[4], c[5]};
            Transform t;
            t.position = {c[6], c[7], c[8]};
            t.scale = {c[9], c[10], c[11]};
            g_CollisionSystem.RegisterStatic(startEntity + (Entity)i, bounds, t);
        }
    }

    // Vehicle bridge
    static Vehicle s_Vehicle;
    void InitVehicle() { VehicleSystem::InitDefaultWarthog(s_Vehicle); }

    void UpdateVehicle(f32 dt, f32 throttle, f32 brake, f32 steer, bool handbrake)
    {
        VehicleSystem::ApplyInput(s_Vehicle, throttle, brake, steer, handbrake);
        VehicleSystem::Update(s_Vehicle, dt);
    }

    void GetVehicleTransform(float* out)
    {
        glm::mat4 m = s_Vehicle.GetTransform();
        const float* ptr = &m[0][0];
        for (int i = 0; i < 16; ++i) out[i] = ptr[i];
    }

    // Status info
    u32 GetEntityCount() { return g_Registry.EntityCount(); }
    u32 GetColliderCount() { return g_CollisionSystem.ColliderCount(); }
    bool IsEntityValid(Entity e) { return g_Registry.IsValid(e); }
}

// ── Emscripten bindings ─────────────────────────────────────────────
#ifdef __EMSCRIPTEN__
using namespace emscripten;

EMSCRIPTEN_BINDINGS(narvos_engine) {
    function("tickWorld", &nv::TickWorld);
    function("resetWorld", &nv::ResetWorld);
    function("initWorld", &nv::InitWorld);

    function("createNPC", &nv::CreateNPC);
    function("createPlayer", &nv::CreatePlayer);
    function("destroyEntity", &nv::DestroyEntityJS);

    // Coordinator controls
    function("pauseWorld", +[]() { nv::g_WorldCoordinator.Pause(); });
    function("resumeWorld", +[]() { nv::g_WorldCoordinator.Resume(); });
    function("isWorldPaused", +[]() -> bool { return nv::g_WorldCoordinator.IsPaused(); });
    function("setTimeScale", +[](float s) { nv::g_WorldCoordinator.SetTimeScale(s); });
    function("getTimeScale", +[]() -> float { return nv::g_WorldCoordinator.GetTimeScale(); });
    function("getWorldTime", +[]() -> double { return nv::g_WorldCoordinator.GetWorldTime(); });
    function("getTickCount", +[]() -> int { return (int)nv::g_WorldCoordinator.GetTickCount(); });
    function("getWorldStats", +[]() -> emscripten::val {
        nv::WorldStats s = nv::g_WorldCoordinator.GetStats();
        auto obj = emscripten::val::object();
        obj.set("entityCount", s.entityCount);
        obj.set("colliderCount", s.colliderCount);
        obj.set("aiEntityCount", s.aiEntityCount);
        obj.set("deadEntityCount", s.deadEntityCount);
        obj.set("statusEffectCount", s.statusEffectCount);
        obj.set("activePathCount", s.activePathCount);
        obj.set("navMeshWidth", s.navMeshWidth);
        obj.set("navMeshDepth", s.navMeshDepth);
        obj.set("bvhNodeCount", s.bvhNodeCount);
        obj.set("dynamicColliderCount", s.dynamicColliderCount);
        obj.set("triggerZoneCount", s.triggerZoneCount);
        obj.set("triggerPendingEvents", s.triggerPendingEvents);
        obj.set("timeScale", s.timeScale);
        obj.set("paused", s.paused);
        obj.set("bvhBuilt", s.bvhBuilt);
        return obj;
    });
    function("setEntityPosition", &nv::SetEntityPosition);
    function("setEntityRotation", &nv::SetEntityRotation);
    function("isEntityValid", &nv::IsEntityValid);
    function("getEntityCount", &nv::GetEntityCount);

    function("initCollisionSystem", +[]() { nv::g_CollisionSystem.Init(); });
    function("registerCollider", &nv::RegisterCollider);
    function("clearColliders", +[]() { nv::g_CollisionSystem.Clear(); });
    function("raycastDown", &nv::RaycastDownFromJS);
    function("isSegmentBlocked", &nv::IsSegmentBlocked);
    function("segmentCastDistance", &nv::SegmentCastDist);
    function("registerColliderBatch", &nv::RegisterColliderBatch);
    function("getColliderCount", &nv::GetColliderCount);

    function("initVehicle", &nv::InitVehicle);
    function("updateVehicle", &nv::UpdateVehicle);

    function("applyBurn", +[](uint32_t e, float dps, float dur) { nv::g_StatusEffects.ApplyBurn(e, dps, dur); });
    function("applyRoot", +[](uint32_t e, float dur) { nv::g_StatusEffects.ApplyRoot(e, dur); });
    function("applyStun", +[](uint32_t e, float dur) { nv::g_StatusEffects.ApplyStun(e, dur); });
    function("isRooted", +[](uint32_t e) -> bool { return nv::g_StatusEffects.IsRooted(e); });
    function("isStunned", +[](uint32_t e) -> bool { return nv::g_StatusEffects.IsStunned(e); });

    function("emitDamage", +[](float x, float y, float z, float amount, int kind) {
        nv::g_DamageEvents.Emit({x, y, z}, amount, static_cast<nv::DamageKind>(kind));
    });
    function("drainDamageEvents", +[](uintptr_t bufferPtr, uintptr_t countPtr, int maxEvents) {
        nv::g_DamageEvents.WritePending(reinterpret_cast<float*>(bufferPtr),
                                         reinterpret_cast<uint32_t*>(countPtr),
                                         static_cast<uint32_t>(maxEvents));
    });
    function("pendingDamageCount", +[]() -> int { return (int)nv::g_DamageEvents.Pending(); });

    // ── Animation bridge ──────────────────────────────────────
    function("animCreateSkeleton", +[]() -> int { return nv::bridge::g_AnimBridge.CreateSkeleton(); });
    function("animAddBone", +[](int skelId, const std::string& name, int parentIdx, uintptr_t invBindPtr) {
        nv::bridge::g_AnimBridge.AddBone(skelId, name, parentIdx, reinterpret_cast<const float*>(invBindPtr));
    });
    function("animFinalizeSkeleton", +[](int skelId) { nv::bridge::g_AnimBridge.FinalizeSkeleton(skelId); });
    function("animGetBoneCount", +[](int skelId) -> int { return (int)nv::bridge::g_AnimBridge.GetBoneCount(skelId); });

    function("animCreateClip", +[](int skelId, const std::string& name, float duration) -> int {
        return nv::bridge::g_AnimBridge.CreateClip(skelId, name, duration);
    });
    function("animAddClipChannel", +[](int clipId, const std::string& boneName,
                                       uintptr_t ptPtr, uintptr_t pvPtr, int pc,
                                       uintptr_t rtPtr, uintptr_t rvPtr, int rc,
                                       uintptr_t stPtr, uintptr_t svPtr, int sc) {
        nv::bridge::g_AnimBridge.AddClipChannel(clipId, boneName,
            reinterpret_cast<const float*>(ptPtr), reinterpret_cast<const float*>(pvPtr), (uint32_t)pc,
            reinterpret_cast<const float*>(rtPtr), reinterpret_cast<const float*>(rvPtr), (uint32_t)rc,
            reinterpret_cast<const float*>(stPtr), reinterpret_cast<const float*>(svPtr), (uint32_t)sc);
    });

    function("animCreateGraph", +[](int skelId) -> int { return nv::bridge::g_AnimBridge.CreateAnimGraph(skelId); });
    function("animGraphAddClipNode", +[](int gid, const std::string& name, const std::string& clip, bool loop) {
        nv::bridge::g_AnimBridge.AnimGraphAddClipNode(gid, name, clip, loop);
    });
    function("animGraphAddBlend1DEntry", +[](int gid, const std::string& node, const std::string& param,
                                             float threshold, const std::string& clipNode) {
        nv::bridge::g_AnimBridge.AnimGraphAddBlend1DEntry(gid, node, param, threshold, clipNode);
    });
    function("animGraphFinalizeBlend1D", +[](int gid, const std::string& node) {
        nv::bridge::g_AnimBridge.AnimGraphFinalizeBlend1D(gid, node);
    });
    function("animGraphSetParamFloat", +[](int gid, const std::string& param, float val) {
        nv::bridge::g_AnimBridge.AnimGraphSetParamFloat(gid, param, val);
    });
    function("animGraphSetParamBool", +[](int gid, const std::string& param, bool val) {
        nv::bridge::g_AnimBridge.AnimGraphSetParamBool(gid, param, val);
    });
    function("animGraphSetRoot", +[](int gid, const std::string& node) {
        nv::bridge::g_AnimBridge.AnimGraphSetRoot(gid, node);
    });
    function("animGraphUpdate", +[](int gid, float dt) { nv::bridge::g_AnimBridge.AnimGraphUpdate(gid, dt); });
    function("animGraphBoneCount", +[](int gid) -> int { return (int)nv::bridge::g_AnimBridge.AnimGraphBoneCount(gid); });
    function("animGraphWriteBones", +[](int gid, uintptr_t outPtr, int maxBones) -> int {
        return (int)nv::bridge::g_AnimBridge.AnimGraphWriteBones(gid, reinterpret_cast<float*>(outPtr), (uint32_t)maxBones);
    });
    function("animDestroyGraph", +[](int gid) { nv::bridge::g_AnimBridge.DestroyAnimGraph(gid); });
    function("animDestroySkeleton", +[](int sid) { nv::bridge::g_AnimBridge.DestroySkeleton(sid); });
    function("animClearAll", +[]() { nv::bridge::g_AnimBridge.Clear(); });

    // ── Chunk streaming ──────────────────────────────────────
    function("streamingInit", +[](float budgetMB, int maxLoaded, float loadR, float unloadR) {
        nv::g_ChunkStreaming.Init(budgetMB, (uint32_t)maxLoaded, loadR, unloadR);
    });
    function("streamingRegisterChunk", +[](int id, float cx, float cy, float cz, float radius, float mb) {
        nv::g_ChunkStreaming.RegisterChunk((uint32_t)id, cx, cy, cz, radius, mb);
    });
    function("streamingMarkLoaded", +[](int id) { nv::g_ChunkStreaming.MarkLoaded((uint32_t)id); });
    function("streamingMarkUnloaded", +[](int id) { nv::g_ChunkStreaming.MarkUnloaded((uint32_t)id); });
    function("streamingTick", +[](float px, float py, float pz) {
        nv::g_ChunkStreaming.Tick(px, py, pz);
    });
    function("streamingDrainCommands", +[](uintptr_t outPtr, int maxCount) -> int {
        return (int)nv::g_ChunkStreaming.DrainCommands(outPtr, (uint32_t)maxCount);
    });
    function("streamingPendingCount", +[]() -> int { return (int)nv::g_ChunkStreaming.PendingCount(); });
    function("streamingBudgetUsedMB", +[]() -> float { return nv::g_ChunkStreaming.BudgetUsedMB(); });
    function("streamingLoadedCount", +[]() -> int { return (int)nv::g_ChunkStreaming.LoadedCount(); });
    function("streamingChunkCount", +[]() -> int { return (int)nv::g_ChunkStreaming.ChunkCount(); });
    function("streamingSetRadii", +[](float loadR, float unloadR) { nv::g_ChunkStreaming.SetRadii(loadR, unloadR); });
    function("streamingUpdateChunkRadius", +[](int id, float newRadius) {
        nv::g_ChunkStreaming.UpdateChunkRadius((uint32_t)id, newRadius);
    });
    function("streamingClear", +[]() { nv::g_ChunkStreaming.Clear(); });
    function("streamingCacheFingerprint", +[]() -> int { return (int)nv::g_ChunkStreaming.CacheFingerprint(); });

    // ── Asset budget manager (VRAM global, toutes catégories) ──
    function("budgetInit", +[](float totalMB) {
        nv::g_AssetBudget.Init(totalMB);
    });
    function("budgetSetCategoryBudget", +[](int cat, float mb) {
        nv::g_AssetBudget.SetCategoryBudget((nv::AssetCategory)cat, mb);
    });
    function("budgetRegisterAsset", +[](int id, int cat, bool spatial,
                                        float px, float py, float pz,
                                        float sizeLow, float sizeMed, float sizeHigh,
                                        bool essential) {
        nv::g_AssetBudget.RegisterAsset((uint32_t)id, (nv::AssetCategory)cat, spatial,
                                         px, py, pz, sizeLow, sizeMed, sizeHigh, essential);
    });
    function("budgetSetAssetPosition", +[](int id, float px, float py, float pz) {
        nv::g_AssetBudget.SetAssetPosition((uint32_t)id, px, py, pz);
    });
    function("budgetMarkLoaded", +[](int id, int tier) {
        nv::g_AssetBudget.MarkLoaded((uint32_t)id, (nv::QualityTier)tier);
    });
    function("budgetMarkUnloaded", +[](int id) {
        nv::g_AssetBudget.MarkUnloaded((uint32_t)id);
    });
    function("budgetTick", +[](float px, float py, float pz, float loadR, float unloadR) {
        nv::g_AssetBudget.Tick(px, py, pz, loadR, unloadR);
    });
    function("budgetDrainCommands", +[](uintptr_t outPtr, int maxCount) -> int {
        return (int)nv::g_AssetBudget.DrainCommands(outPtr, (uint32_t)maxCount);
    });
    function("budgetPendingCount", +[]() -> int { return (int)nv::g_AssetBudget.PendingCount(); });
    function("budgetTotalUsedMB", +[]() -> float { return nv::g_AssetBudget.TotalUsedMB(); });
    function("budgetTotalBudgetMB", +[]() -> float { return nv::g_AssetBudget.TotalBudgetMB(); });
    function("budgetCategoryUsedMB", +[](int cat) -> float {
        return nv::g_AssetBudget.CategoryUsedMB((nv::AssetCategory)cat);
    });
    function("budgetLoadedCount", +[]() -> int { return (int)nv::g_AssetBudget.LoadedCount(); });
    function("budgetAssetCount", +[]() -> int { return (int)nv::g_AssetBudget.AssetCount(); });
    function("budgetRecommendedTier", +[](int id, float px, float py, float pz) -> int {
        return (int)nv::g_AssetBudget.RecommendedTier((uint32_t)id, px, py, pz);
    });
    function("budgetClear", +[]() { nv::g_AssetBudget.Clear(); });
    function("budgetCacheFingerprint", +[]() -> int { return (int)nv::g_AssetBudget.CacheFingerprint(); });

    // ── Navigation / NavMesh ──────────────────────────────────
    function("navInit", +[](float originX, float originZ, float cellSize, int width, int depth) {
        nv::g_NavMesh.Init(originX, originZ, cellSize, (uint32_t)width, (uint32_t)depth);
    });
    function("navSetCell", +[](int x, int z, float y, bool walkable) {
        nv::g_NavMesh.SetCell((uint32_t)x, (uint32_t)z, y, walkable);
    });
    function("navBakeFromHeightmap", +[](uintptr_t heightsPtr, uintptr_t walkPtr, int count) {
        nv::g_NavMesh.BakeFromHeightmap(
            reinterpret_cast<const float*>(heightsPtr),
            reinterpret_cast<const uint8_t*>(walkPtr),
            (uint32_t)count);
    });
    function("navIsWalkable", +[](int x, int z) -> bool {
        return nv::g_NavMesh.IsWalkable((uint32_t)x, (uint32_t)z);
    });
    function("navSnapToNavMesh", +[](float x, float y, float z) -> emscripten::val {
        glm::vec3 snapped = nv::g_NavMesh.SnapToNavMesh({x, y, z});
        auto arr = emscripten::val::array();
        arr.call<void>("push", snapped.x);
        arr.call<void>("push", snapped.y);
        arr.call<void>("push", snapped.z);
        return arr;
    });
    function("navClear", +[]() { nv::g_NavMesh.Clear(); });
    function("navWidth", +[]() -> int { return (int)nv::g_NavMesh.Width(); });
    function("navDepth", +[]() -> int { return (int)nv::g_NavMesh.Depth(); });
    function("navCellSize", +[]() -> float { return nv::g_NavMesh.CellSize(); });

    // ── PathManager ──────────────────────────────────────────
    function("navRequestPath", +[](uint32_t entity, float tx, float ty, float tz) {
        nv::g_PathManager.RequestPath(entity, {tx, ty, tz});
    });
    function("navCancelPath", +[](uint32_t entity) {
        nv::g_PathManager.CancelPath(entity);
    });
    function("navClearAllPaths", +[]() { nv::g_PathManager.ClearAll(); });
    function("navHasPath", +[](uint32_t entity) -> bool {
        return nv::g_PathManager.HasPath(entity);
    });
    function("navIsPathComplete", +[](uint32_t entity) -> bool {
        return nv::g_PathManager.IsPathComplete(entity);
    });
    function("navGetNextWaypoint", +[](uint32_t entity) -> emscripten::val {
        glm::vec3 wp = nv::g_PathManager.GetNextWaypoint(entity);
        auto arr = emscripten::val::array();
        arr.call<void>("push", wp.x);
        arr.call<void>("push", wp.y);
        arr.call<void>("push", wp.z);
        return arr;
    });
    function("navActivePathCount", +[]() -> int {
        return (int)nv::g_PathManager.ActivePathCount();
    });
    function("navReadWaypoints", +[](uintptr_t bufPtr, uintptr_t countPtr, int maxEntries) {
        nv::g_PathManager.WriteWaypoints(
            reinterpret_cast<float*>(bufPtr),
            reinterpret_cast<uint32_t*>(countPtr),
            (uint32_t)maxEntries);
    });

    // ── AISystem ─────────────────────────────────────────────
    // Écrit les décisions tactiques (attack/move/flee) dans le
    // buffer partagé, lues par readAICommands() côté JS.
    // ⚠️ N'ÉTAIT PAS BINDÉ — toute l'IA WASM tournait dans le vide,
    // les PNJ utilisaient uniquement le fallback JS NpcController.
    function("aiWriteCommands", +[](uintptr_t bufPtr, uintptr_t countPtr, int maxCommands) {
        nv::AISystem::WriteCommands(
            reinterpret_cast<float*>(bufPtr),
            reinterpret_cast<uint32_t*>(countPtr),
            (uint32_t)maxCommands);
    });

    // ── BVH + Dynamic colliders ──────────────────────────────
    function("buildBVH", +[]() { nv::g_CollisionSystem.BuildBVH(); });
    function("bvhNodeCount", +[]() -> int { return (int)nv::g_CollisionSystem.BVHNodeCount(); });
    function("isBVHBuilt", +[]() -> bool { return nv::g_CollisionSystem.IsBVHBuilt(); });
    function("dynamicColliderCount", +[]() -> int { return (int)nv::g_CollisionSystem.DynamicCount(); });

    function("registerDynamicCollider", +[](uint32_t entity,
        float minX, float minY, float minZ, float maxX, float maxY, float maxZ) {
        nv::AABB bounds;
        bounds.min = {minX, minY, minZ};
        bounds.max = {maxX, maxY, maxZ};
        nv::g_CollisionSystem.RegisterDynamic(entity, bounds);
    });
    function("updateDynamicCollider", +[](uint32_t entity,
        float posX, float posY, float posZ, float scaleX, float scaleY, float scaleZ) {
        nv::Transform t;
        t.position = {posX, posY, posZ};
        t.scale = {scaleX, scaleY, scaleZ};
        nv::g_CollisionSystem.UpdateDynamic(entity, t);
    });
    function("removeDynamicCollider", +[](uint32_t entity) {
        nv::g_CollisionSystem.RemoveDynamic(entity);
    });

    // ── Trigger zones ────────────────────────────────────────
    function("triggerRegisterZone", +[](float minX, float minY, float minZ,
                                        float maxX, float maxY, float maxZ,
                                        int type, float value) -> int {
        nv::AABB bounds;
        bounds.min = {minX, minY, minZ};
        bounds.max = {maxX, maxY, maxZ};
        return (int)nv::g_TriggerSystem.RegisterZone(bounds, (nv::TriggerType)type, value);
    });
    function("triggerRemoveZone", +[](uint32_t zoneEntity) {
        nv::g_TriggerSystem.RemoveZone(zoneEntity);
    });
    function("triggerSetActive", +[](uint32_t zoneEntity, bool active) {
        nv::g_TriggerSystem.SetZoneActive(zoneEntity, active);
    });
    function("triggerDrainEvents", +[](uintptr_t bufPtr, uintptr_t countPtr, int maxEvents) {
        nv::g_TriggerSystem.DrainEvents(
            reinterpret_cast<float*>(bufPtr),
            reinterpret_cast<uint32_t*>(countPtr),
            (uint32_t)maxEvents);
    });
    function("triggerPendingCount", +[]() -> int { return (int)nv::g_TriggerSystem.PendingCount(); });
    function("triggerZoneCount", +[]() -> int { return (int)nv::g_TriggerSystem.ZoneCount(); });
    function("triggerClear", +[]() { nv::g_TriggerSystem.Clear(); });
}
#endif
