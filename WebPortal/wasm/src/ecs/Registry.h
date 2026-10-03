#pragma once
#include "core/Types.h"
#include "ecs/ComponentPool.h"
#include <vector>
#include <unordered_map>
#include <typeindex>
#include <functional>
#include <tuple>

namespace nv
{
    class Registry
    {
    public:
        Entity CreateEntity();
        void DestroyEntity(Entity e);
        bool IsValid(Entity e) const;
        void Clear();
        u32 EntityCount() const { return (u32)m_Entities.size() - (u32)m_FreeList.size(); }

        template<typename T, typename... Args>
        T& AddComponent(Entity e, Args&&... args)
        {
            auto& pool = GetOrCreatePool<T>();
            return pool.Add(e, std::forward<Args>(args)...);
        }

        template<typename T>
        T* GetComponent(Entity e)
        {
            auto& pool = GetOrCreatePool<T>();
            return pool.Get(e);
        }

        template<typename T>
        void RemoveComponent(Entity e) { GetOrCreatePool<T>().Remove(e); }

        template<typename T>
        bool HasComponent(Entity e) const
        {
            auto it = m_ComponentPools.find(typeid(T));
            if (it == m_ComponentPools.end()) return false;
            return static_cast<ComponentPool<T>*>(it->second)->Has(e);
        }

        void RemoveAnyComponents(Entity e)
        {
            for (auto& kv : m_ComponentPools)
            {
                if (kv.second) kv.second->RemoveIfPresent(e);
            }
        }

        template<typename T>
        ComponentPool<T>& GetPool() { return GetOrCreatePool<T>(); }

        template<typename... Ts>
        void ForEach(const std::function<void(Entity, Ts&...)>& func)
        {
            static_assert(sizeof...(Ts) > 0, "ForEach requires at least one component type");
            using First = std::tuple_element_t<0, std::tuple<Ts...>>;
            auto& firstPool = GetOrCreatePool<First>();
            std::vector<Entity> entities = firstPool.Entities();
            for (Entity e : entities)
            {
                if (!(HasComponent<Ts>(e) && ...)) continue;
                func(e, *GetComponent<Ts>(e)...);
            }
        }

        template<typename T>
        ComponentPool<T>& GetOrCreatePool()
        {
            auto it = m_ComponentPools.find(typeid(T));
            if (it == m_ComponentPools.end())
            {
                auto* pool = new ComponentPool<T>();
                m_ComponentPools[typeid(T)] = pool;
                return *pool;
            }
            return *static_cast<ComponentPool<T>*>(it->second);
        }

        ~Registry()
        {
            for (auto& kv : m_ComponentPools) delete kv.second;
            m_ComponentPools.clear();
        }

    private:
        std::vector<Entity> m_Entities;
        std::vector<u32> m_Generations;
        std::vector<u32> m_FreeList;
        std::unordered_map<std::type_index, IComponentPool*> m_ComponentPools;
    };

    extern Registry g_Registry;
}
