#include "ecs/Registry.h"

namespace nv
{
    Registry g_Registry;

    Entity Registry::CreateEntity()
    {
        Entity id;
        if (!m_FreeList.empty())
        {
            id = m_FreeList.back();
            m_FreeList.pop_back();
            m_Generations[id]++;
        }
        else
        {
            id = (u32)m_Entities.size();
            m_Entities.push_back(id);
            m_Generations.push_back(0);
        }
        return id;
    }

    void Registry::DestroyEntity(Entity e)
    {
        if (!IsValid(e)) return;
        RemoveAnyComponents(e);
        m_Generations[e]++;
        m_FreeList.push_back(e);
    }

    bool Registry::IsValid(Entity e) const
    {
        return e < m_Entities.size() && m_Generations[e] % 2 == 0;
    }

    void Registry::Clear()
    {
        for (auto& kv : m_ComponentPools)
        {
            if (kv.second) kv.second->Clear();
        }
        m_Entities.clear();
        m_Generations.clear();
        m_FreeList.clear();
    }
}
