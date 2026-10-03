#include "bridge/WorldCoordinator.h"
#include "ecs/Registry.h"
#include "components/Transform.h"
#include "components/Health.h"
#include "components/Weapon.h"
#include "components/PlayerTag.h"
#include "components/AITactical.h"
#include "physics/CollisionSystem.h"
#include "ai/AISystem.h"
#include "combat/DamageEvents.h"
#include "combat/StatusEffects.h"
#include "navigation/PathManager.h"
#include "physics/TriggerSystem.h"
#include <vector>
#include <functional>

namespace nv
{
    WorldCoordinator g_WorldCoordinator;

    void WorldCoordinator::Init()
    {
        m_Paused = false;
        m_TimeScale = 1.0f;
        m_WorldTime = 0.0;
        m_TickCount = 0;
        m_CleanupAcc = 0.0f;
        g_CollisionSystem.Init();
        g_TriggerSystem.Init();
    }

    // Deterministic tick order:
    //   1. AI decisions (reads transforms, emits commands)
    //   2. PathManager (advance waypoints for entities following paths)
    //   3. TriggerSystem (enter/exit zone detection)
    //   4. Status effects (burn damage, duration countdown)
    //   5. Health system (shield regen, death detection)
    //   6. Death cleanup (destroy entities dead > grace period)
    void WorldCoordinator::Tick(f32 rawDt)
    {
        if (m_Paused) return;

        f32 dt = rawDt * m_TimeScale;
        if (dt <= 0.0f) return;

        m_WorldTime += (f64)dt;
        m_TickCount++;

        AISystem::Update(dt);
        g_PathManager.Update();
        g_TriggerSystem.Tick();
        g_StatusEffects.Tick(dt);
        TickHealthSystem(dt);
        TickDeathCleanup(dt);
    }

    void WorldCoordinator::TickHealthSystem(f32 dt)
    {
        std::function<void(Entity, Health&)> healthTick = [&](Entity e, Health& h) {
            NV_UNUSED(e);
            if (h.isDead) return;

            f64 sinceLastHit = m_WorldTime - h.lastDamageTime;
            if (sinceLastHit > (f64)h.shieldRechargeDelay && h.currentShield < h.maxShield)
            {
                h.currentShield += h.shieldRechargeRate * dt;
                if (h.currentShield > h.maxShield) h.currentShield = h.maxShield;
            }

            if (h.currentHealth <= 0.0f)
            {
                h.currentHealth = 0.0f;
                h.isDead = true;
                h.lastDamageTime = m_WorldTime;

                AITactical* ai = g_Registry.GetComponent<AITactical>(e);
                if (ai) ai->state = AIState::Dead;
            }
        };
        g_Registry.ForEach<Health>(healthTick);
    }

    void WorldCoordinator::TickDeathCleanup(f32 dt)
    {
        m_CleanupAcc += dt;
        if (m_CleanupAcc < kCleanupInterval) return;
        m_CleanupAcc = 0.0f;

        std::vector<Entity> toDestroy;
        std::function<void(Entity, Health&)> deathScan = [&](Entity e, Health& h) {
            if (!h.isDead) return;
            f64 deathDuration = m_WorldTime - h.lastDamageTime;
            if (deathDuration >= (f64)kDeathGracePeriod)
                toDestroy.push_back(e);
        };
        g_Registry.ForEach<Health>(deathScan);

        for (Entity e : toDestroy)
            g_Registry.DestroyEntity(e);
    }

    void WorldCoordinator::Reset()
    {
        g_Registry.Clear();
        g_CollisionSystem.Clear();
        g_StatusEffects.Reset();
        g_DamageEvents.Clear();
        g_PathManager.ClearAll();
        g_NavMesh.Clear();
        g_TriggerSystem.Clear();
        m_WorldTime = 0.0;
        m_TickCount = 0;
        m_CleanupAcc = 0.0f;
        m_Paused = false;
        m_TimeScale = 1.0f;
    }

    WorldStats WorldCoordinator::GetStats() const
    {
        WorldStats s;
        s.entityCount = g_Registry.EntityCount();
        s.colliderCount = g_CollisionSystem.ColliderCount();
        s.timeScale = m_TimeScale;
        s.paused = m_Paused;

        auto& aiPool = g_Registry.GetOrCreatePool<AITactical>();
        s.aiEntityCount = aiPool.Size();

        u32 dead = 0;
        u32 fxCount = 0;
        auto& healthPool = g_Registry.GetOrCreatePool<Health>();
        for (u32 i = 0; i < healthPool.Size(); ++i)
        {
            if (healthPool.Data()[i].isDead) dead++;
        }
        s.deadEntityCount = dead;
        s.statusEffectCount = fxCount;
        s.activePathCount = g_PathManager.ActivePathCount();
        s.navMeshWidth = g_NavMesh.Width();
        s.navMeshDepth = g_NavMesh.Depth();
        s.bvhNodeCount = g_CollisionSystem.BVHNodeCount();
        s.dynamicColliderCount = g_CollisionSystem.DynamicCount();
        s.triggerZoneCount = g_TriggerSystem.ZoneCount();
        s.triggerPendingEvents = g_TriggerSystem.PendingCount();
        s.bvhBuilt = g_CollisionSystem.IsBVHBuilt();
        return s;
    }

    Entity WorldCoordinator::CreateNPCEntity(f32 x, f32 y, f32 z, u8 role, f32 health)
    {
        Entity e = g_Registry.CreateEntity();
        auto& t = g_Registry.AddComponent<Transform>(e);
        t.position = {x, y, z};
        auto& h = g_Registry.AddComponent<Health>(e);
        h.maxHealth = health;
        h.currentHealth = health;
        g_Registry.AddComponent<Weapon>(e);
        auto& ai = g_Registry.AddComponent<AITactical>(e);
        ai.role = static_cast<AISquadRole>(role);
        return e;
    }

    Entity WorldCoordinator::CreatePlayerEntity(f32 x, f32 y, f32 z)
    {
        Entity e = g_Registry.CreateEntity();
        auto& t = g_Registry.AddComponent<Transform>(e);
        t.position = {x, y, z};
        g_Registry.AddComponent<Health>(e);
        g_Registry.AddComponent<PlayerTag>(e);
        return e;
    }

    void WorldCoordinator::DestroyEntity(Entity e)
    {
        g_Registry.DestroyEntity(e);
    }
}
