#pragma once
#include "core/Types.h"

namespace nv
{
    struct WorldStats
    {
        u32 entityCount = 0;
        u32 colliderCount = 0;
        u32 aiEntityCount = 0;
        u32 deadEntityCount = 0;
        u32 statusEffectCount = 0;
        u32 activePathCount = 0;
        u32 navMeshWidth = 0;
        u32 navMeshDepth = 0;
        u32 bvhNodeCount = 0;
        u32 dynamicColliderCount = 0;
        u32 triggerZoneCount = 0;
        u32 triggerPendingEvents = 0;
        f32 timeScale = 1.0f;
        bool paused = false;
        bool bvhBuilt = false;
    };

    class WorldCoordinator
    {
    public:
        void Init();
        void Tick(f32 rawDt);
        void Reset();

        void Pause()  { m_Paused = true; }
        void Resume() { m_Paused = false; }
        bool IsPaused() const { return m_Paused; }

        void SetTimeScale(f32 scale) { m_TimeScale = (scale < 0.0f) ? 0.0f : scale; }
        f32 GetTimeScale() const { return m_TimeScale; }

        f64 GetWorldTime() const { return m_WorldTime; }
        u32 GetTickCount() const { return m_TickCount; }

        WorldStats GetStats() const;

        Entity CreateNPCEntity(f32 x, f32 y, f32 z, u8 role, f32 health);
        Entity CreatePlayerEntity(f32 x, f32 y, f32 z);
        void DestroyEntity(Entity e);

    private:
        void TickHealthSystem(f32 dt);
        void TickDeathCleanup(f32 dt);

        bool m_Paused = false;
        f32 m_TimeScale = 1.0f;
        f64 m_WorldTime = 0.0;
        u32 m_TickCount = 0;
        f32 m_CleanupAcc = 0.0f;
        static constexpr f32 kCleanupInterval = 2.0f;
        static constexpr f32 kDeathGracePeriod = 5.0f;
    };

    extern WorldCoordinator g_WorldCoordinator;
}
