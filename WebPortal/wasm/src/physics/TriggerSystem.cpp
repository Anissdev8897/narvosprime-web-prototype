#include "physics/TriggerSystem.h"
#include "ecs/Registry.h"
#include "components/Transform.h"
#include <functional>
#include <cstring>

namespace nv
{
    TriggerSystem g_TriggerSystem;

    void TriggerSystem::Init()
    {
        m_Zones.clear();
        m_Occupants.clear();
        m_WriteIdx = 0;
        m_PendingCount = 0;
        m_NextZoneId = 80000;
    }

    void TriggerSystem::Clear()
    {
        Init();
    }

    Entity TriggerSystem::RegisterZone(const AABB& bounds, TriggerType type, f32 value)
    {
        Entity id = m_NextZoneId++;
        TriggerZone zone;
        zone.entity = id;
        zone.bounds = bounds;
        zone.type = type;
        zone.value = value;
        zone.active = true;
        m_Zones.push_back(zone);
        m_Occupants[id] = {};
        return id;
    }

    void TriggerSystem::RemoveZone(Entity zoneEntity)
    {
        for (auto it = m_Zones.begin(); it != m_Zones.end(); ++it)
        {
            if (it->entity == zoneEntity)
            {
                // Émettre exit pour tous les occupants
                auto occIt = m_Occupants.find(zoneEntity);
                if (occIt != m_Occupants.end())
                {
                    for (Entity occ : occIt->second)
                        EmitEvent(zoneEntity, occ, it->type, false, it->value);
                    m_Occupants.erase(occIt);
                }
                m_Zones.erase(it);
                return;
            }
        }
    }

    void TriggerSystem::SetZoneActive(Entity zoneEntity, bool active)
    {
        for (auto& z : m_Zones)
        {
            if (z.entity == zoneEntity)
            {
                if (z.active && !active)
                {
                    // Désactivation → exit pour tous les occupants
                    auto occIt = m_Occupants.find(zoneEntity);
                    if (occIt != m_Occupants.end())
                    {
                        for (Entity occ : occIt->second)
                            EmitEvent(zoneEntity, occ, z.type, false, z.value);
                        occIt->second.clear();
                    }
                }
                z.active = active;
                return;
            }
        }
    }

    void TriggerSystem::Tick()
    {
        for (auto& zone : m_Zones)
        {
            if (!zone.active) continue;

            auto& occupants = m_Occupants[zone.entity];
            std::unordered_set<Entity> currentInside;

            // Tester toutes les entités avec Transform
            std::function<void(Entity, Transform&)> check = [&](Entity e, Transform& t) {
                if (zone.bounds.Contains(t.position))
                    currentInside.insert(e);
            };
            g_Registry.ForEach<Transform>(check);

            // Détecter les entrées
            for (Entity e : currentInside)
            {
                if (occupants.find(e) == occupants.end())
                    EmitEvent(zone.entity, e, zone.type, true, zone.value);
            }

            // Détecter les sorties
            for (Entity e : occupants)
            {
                if (currentInside.find(e) == currentInside.end())
                    EmitEvent(zone.entity, e, zone.type, false, zone.value);
            }

            occupants = std::move(currentInside);
        }
    }

    void TriggerSystem::EmitEvent(Entity zone, Entity occupant, TriggerType type, bool entered, f32 value)
    {
        if (m_PendingCount >= kMaxEvents) return;

        u32 idx = (m_WriteIdx + m_PendingCount) % kMaxEvents;
        m_EventBuffer[idx].zone = zone;
        m_EventBuffer[idx].occupant = occupant;
        m_EventBuffer[idx].type = (u8)type;
        m_EventBuffer[idx].entered = entered ? 1 : 0;
        m_EventBuffer[idx].value = value;
        m_PendingCount++;
    }

    void TriggerSystem::DrainEvents(float* outBuffer, u32* outCount, u32 maxEvents)
    {
        u32 toDrain = (m_PendingCount < maxEvents) ? m_PendingCount : maxEvents;
        for (u32 i = 0; i < toDrain; ++i)
        {
            u32 idx = (m_WriteIdx + i) % kMaxEvents;
            const TriggerEvent& ev = m_EventBuffer[idx];
            float* dst = outBuffer + i * 8;
            dst[0] = (float)ev.zone;
            dst[1] = (float)ev.occupant;
            dst[2] = (float)ev.type;
            dst[3] = (float)ev.entered;
            dst[4] = ev.value;
            dst[5] = 0.0f;
            dst[6] = 0.0f;
            dst[7] = 0.0f;
        }
        *outCount = toDrain;
        m_WriteIdx = (m_WriteIdx + toDrain) % kMaxEvents;
        m_PendingCount -= toDrain;
    }
}
