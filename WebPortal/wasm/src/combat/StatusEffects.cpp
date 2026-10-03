#include "combat/StatusEffects.h"
#include "combat/DamageEvents.h"
#include "ecs/Registry.h"
#include "components/Health.h"
#include <algorithm>

namespace nv
{
    DamageEvents g_DamageEvents;
    StatusEffects g_StatusEffects;

    void StatusEffects::Add(Entity e, const StatusFx& fx)
    {
        m_Effects[e].push_back(fx);
    }

    void StatusEffects::ApplyRoot(Entity e, f32 duration)
    {
        Add(e, {StatusKind::Root, duration, 0.0f, 0.0f});
    }

    void StatusEffects::ApplyStun(Entity e, f32 duration)
    {
        Add(e, {StatusKind::Stun, duration, 0.0f, 0.0f});
    }

    void StatusEffects::ApplyBurn(Entity e, f32 dps, f32 duration)
    {
        Add(e, {StatusKind::Burn, duration, dps, 0.0f});
    }

    void StatusEffects::ApplyInvisibility(f32 duration)
    {
        m_InvisRemaining = duration;
    }

    bool StatusEffects::IsRooted(Entity e) const
    {
        auto it = m_Effects.find(e);
        if (it == m_Effects.end()) return false;
        for (const auto& fx : it->second)
            if (fx.kind == StatusKind::Root && fx.remaining > 0.0f) return true;
        return false;
    }

    bool StatusEffects::IsStunned(Entity e) const
    {
        auto it = m_Effects.find(e);
        if (it == m_Effects.end()) return false;
        for (const auto& fx : it->second)
            if (fx.kind == StatusKind::Stun && fx.remaining > 0.0f) return true;
        return false;
    }

    bool StatusEffects::IsBurning(Entity e) const
    {
        auto it = m_Effects.find(e);
        if (it == m_Effects.end()) return false;
        for (const auto& fx : it->second)
            if (fx.kind == StatusKind::Burn && fx.remaining > 0.0f) return true;
        return false;
    }

    void StatusEffects::Tick(f32 dt)
    {
        if (m_InvisRemaining > 0.0f) m_InvisRemaining -= dt;

        for (auto it = m_Effects.begin(); it != m_Effects.end();)
        {
            Entity e = it->first;
            auto& fxList = it->second;

            for (auto& fx : fxList)
            {
                fx.remaining -= dt;
                if (fx.kind == StatusKind::Burn && fx.remaining > 0.0f)
                {
                    fx.acc += dt;
                    if (fx.acc >= kBurnTick)
                    {
                        fx.acc -= kBurnTick;
                        f32 damage = fx.dps * kBurnTick;
                        Health* h = g_Registry.GetComponent<Health>(e);
                        if (h && !h->isDead)
                        {
                            h->currentHealth -= damage;
                            if (h->currentHealth <= 0.0f)
                            {
                                h->currentHealth = 0.0f;
                                h->isDead = true;
                            }
                        }
                    }
                }
            }

            fxList.erase(std::remove_if(fxList.begin(), fxList.end(),
                [](const StatusFx& fx) { return fx.remaining <= 0.0f; }), fxList.end());

            if (fxList.empty()) it = m_Effects.erase(it);
            else ++it;
        }
    }

    void StatusEffects::Reset()
    {
        m_Effects.clear();
        m_InvisRemaining = 0.0f;
    }
}
