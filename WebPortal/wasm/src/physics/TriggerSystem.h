#pragma once
#include "core/Types.h"
#include "physics/Raycast.h"
#include <vector>
#include <unordered_set>
#include <unordered_map>

namespace nv
{
    enum class TriggerType : u8
    {
        Generic   = 0, // zone logique (quête, cinématique)
        Damage    = 1, // zone de dégâts (lave, poison)
        Heal      = 2, // zone de soin
        Teleport  = 3, // portail
        Quest     = 4, // objectif
    };

    struct TriggerZone
    {
        Entity entity = INVALID_ENTITY;
        AABB bounds;
        TriggerType type = TriggerType::Generic;
        f32 value = 0.0f; // dps pour Damage, hps pour Heal, targetMapId pour Teleport
        bool active = true;
    };

    struct TriggerEvent
    {
        Entity zone;      // entité de la zone
        Entity occupant;  // entité qui entre/sort
        u8 type;          // TriggerType cast
        u8 entered;       // 1 = enter, 0 = exit
        f32 value;        // copie de zone.value
    };

    // Détecte les entrées/sorties d'entités dans des zones trigger.
    // Chaque tick : teste les entités avec Transform vs zones actives.
    // Émet TriggerEvents dans un ring buffer drainable depuis JS.
    class TriggerSystem
    {
    public:
        void Init();
        void Clear();

        Entity RegisterZone(const AABB& bounds, TriggerType type, f32 value);
        void RemoveZone(Entity zoneEntity);
        void SetZoneActive(Entity zoneEntity, bool active);

        // Appelé chaque tick par WorldCoordinator
        void Tick();

        // Drain vers JS : écrit dans un buffer plat (8 floats par event)
        // Layout : [zoneEntity, occupantEntity, type, entered, value, 0, 0, 0]
        void DrainEvents(float* outBuffer, u32* outCount, u32 maxEvents);
        u32 PendingCount() const { return m_PendingCount; }
        u32 ZoneCount() const { return (u32)m_Zones.size(); }

    private:
        std::vector<TriggerZone> m_Zones;
        // Pour chaque zone : set des entités actuellement dedans
        std::unordered_map<Entity, std::unordered_set<Entity>> m_Occupants;

        // Ring buffer d'events
        static constexpr u32 kMaxEvents = 128;
        TriggerEvent m_EventBuffer[kMaxEvents];
        u32 m_WriteIdx = 0;
        u32 m_PendingCount = 0;

        void EmitEvent(Entity zone, Entity occupant, TriggerType type, bool entered, f32 value);
        Entity m_NextZoneId = 80000; // namespace séparé des entités gameplay (< 80k) et colliders batch (90k+)
    };

    extern TriggerSystem g_TriggerSystem;
}
