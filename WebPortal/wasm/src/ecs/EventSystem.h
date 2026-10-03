#pragma once
#include "core/Types.h"
#include <functional>
#include <vector>
#include <typeindex>
#include <unordered_map>

namespace nv
{
    // ── Lightweight event system for ECS lifecycle events ──
    // Entity created/destroyed/component changed.
    // Uses std::function for simplicity — this is called rarely
    // (entity creation/destruction) so inlining isn't critical.

    enum class EntityEvent : u8
    {
        Created       = 0,  // Entity was created (no components yet)
        Destroyed     = 1,  // Entity is being destroyed
        ComponentAdded   = 2,  // Component added to entity
        ComponentRemoved = 3,  // Component removed from entity
    };

    using EntityListener = std::function<void(EntityEvent, Entity)>;
    using ComponentListener = std::function<void(EntityEvent, Entity, std::type_index)>;

    class EventSystem
    {
    public:
        // ── Entity lifecycle listeners ──
        void OnEntityEvent(EntityListener listener)
        {
            m_EntityListeners.push_back(std::move(listener));
        }

        // ── Component change listeners ──
        void OnComponentEvent(ComponentListener listener)
        {
            m_ComponentListeners.push_back(std::move(listener));
        }

        // ── Emit ──
        void EmitEntityEvent(EntityEvent evt, Entity e)
        {
            for (auto& listener : m_EntityListeners)
                listener(evt, e);
        }

        void EmitComponentEvent(EntityEvent evt, Entity e, std::type_index componentType)
        {
            for (auto& listener : m_ComponentListeners)
                listener(evt, e, componentType);
        }

        void Clear()
        {
            m_EntityListeners.clear();
            m_ComponentListeners.clear();
        }

        u32 ListenerCount() const
        {
            return (u32)(m_EntityListeners.size() + m_ComponentListeners.size());
        }

    private:
        std::vector<EntityListener> m_EntityListeners;
        std::vector<ComponentListener> m_ComponentListeners;
    };

    extern EventSystem g_EventSystem;
}
