#pragma once
#include "core/Types.h"
#include <vector>
#include <unordered_map>
#include <cassert>

namespace nv
{
    struct IComponentPool
    {
        virtual ~IComponentPool() = default;
        virtual void Clear() = 0;
        virtual void RemoveIfPresent(Entity e) = 0;
    };

    template<typename T>
    class ComponentPool : public IComponentPool
    {
    public:
        template<typename... Args>
        T& Add(Entity e, Args&&... args)
        {
            auto it = m_EntityToIndex.find(e);
            if (it != m_EntityToIndex.end())
            {
                m_Data[it->second] = T(std::forward<Args>(args)...);
                return m_Data[it->second];
            }
            u32 index = (u32)m_Data.size();
            m_EntityToIndex[e] = index;
            m_IndexToEntity.push_back(e);
            m_Data.emplace_back(std::forward<Args>(args)...);
            return m_Data.back();
        }

        T* Get(Entity e)
        {
            auto it = m_EntityToIndex.find(e);
            if (it == m_EntityToIndex.end()) return nullptr;
            return &m_Data[it->second];
        }

        bool Has(Entity e) const { return m_EntityToIndex.find(e) != m_EntityToIndex.end(); }

        void Remove(Entity e)
        {
            auto it = m_EntityToIndex.find(e);
            if (it == m_EntityToIndex.end()) return;
            u32 indexToRemove = it->second;
            u32 lastIndex = (u32)m_Data.size() - 1;
            Entity lastEntity = m_IndexToEntity[lastIndex];

            m_Data[indexToRemove] = std::move(m_Data[lastIndex]);
            m_IndexToEntity[indexToRemove] = lastEntity;
            m_EntityToIndex[lastEntity] = indexToRemove;

            m_Data.pop_back();
            m_IndexToEntity.pop_back();
            m_EntityToIndex.erase(e);
        }

        std::vector<Entity>& Entities() { return m_IndexToEntity; }
        std::vector<T>& Data() { return m_Data; }
        u32 Size() const { return (u32)m_Data.size(); }

        void Clear() override
        {
            m_Data.clear();
            m_IndexToEntity.clear();
            m_EntityToIndex.clear();
        }

        void RemoveIfPresent(Entity e) override { Remove(e); }

    private:
        std::vector<T> m_Data;
        std::vector<Entity> m_IndexToEntity;
        std::unordered_map<Entity, u32> m_EntityToIndex;
    };
}
