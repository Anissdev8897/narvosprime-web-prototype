#pragma once
#include "core/Types.h"
#include <vector>
#include <unordered_map>

namespace nv
{
    enum class StatusKind : u8 { Root, Burn, Stun };

    struct StatusFx
    {
        StatusKind kind;
        f32 remaining = 0.0f;
        f32 dps = 0.0f;
        f32 acc = 0.0f;
    };

    class StatusEffects
    {
    public:
        static constexpr f32 kBurnTick = 0.5f;

        void ApplyRoot(Entity e, f32 duration);
        void ApplyStun(Entity e, f32 duration);
        void ApplyBurn(Entity e, f32 dps, f32 duration);
        void ApplyInvisibility(f32 duration);

        bool IsRooted(Entity e) const;
        bool IsStunned(Entity e) const;
        bool IsBurning(Entity e) const;
        bool IsPlayerInvisible() const { return m_InvisRemaining > 0.0f; }

        void Tick(f32 dt);
        void Reset();

    private:
        void Add(Entity e, const StatusFx& fx);
        std::unordered_map<Entity, std::vector<StatusFx>> m_Effects;
        f32 m_InvisRemaining = 0.0f;
    };

    extern StatusEffects g_StatusEffects;
}
