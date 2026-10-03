#include "navigation/PathManager.h"
#include "ecs/Registry.h"
#include "components/Transform.h"

namespace nv
{
    PathManager g_PathManager;

    void PathManager::RequestPath(Entity e, const glm::vec3& target)
    {
        Transform* t = g_Registry.GetComponent<Transform>(e);
        if (!t) return;

        NavPath path = g_NavMesh.FindPath(t->position, target);
        if (path.waypoints.empty()) return;

        m_Paths[e] = std::move(path);
    }

    void PathManager::CancelPath(Entity e)
    {
        m_Paths.erase(e);
    }

    void PathManager::ClearAll()
    {
        m_Paths.clear();
    }

    void PathManager::Update(f32 waypointReachDist)
    {
        f32 reachSq = waypointReachDist * waypointReachDist;
        std::vector<Entity> completed;

        for (auto& [e, path] : m_Paths)
        {
            if (path.IsComplete()) { completed.push_back(e); continue; }

            Transform* t = g_Registry.GetComponent<Transform>(e);
            if (!t) { completed.push_back(e); continue; }

            glm::vec3 wp = path.CurrentWaypoint();
            glm::vec2 delta(t->position.x - wp.x, t->position.z - wp.z);
            if (glm::dot(delta, delta) < reachSq)
                path.Advance();
        }

        for (Entity e : completed)
            m_Paths.erase(e);
    }

    bool PathManager::HasPath(Entity e) const
    {
        return m_Paths.count(e) > 0;
    }

    glm::vec3 PathManager::GetNextWaypoint(Entity e) const
    {
        auto it = m_Paths.find(e);
        if (it == m_Paths.end()) return glm::vec3(0.0f);
        return it->second.CurrentWaypoint();
    }

    bool PathManager::IsPathComplete(Entity e) const
    {
        auto it = m_Paths.find(e);
        if (it == m_Paths.end()) return true;
        return it->second.IsComplete();
    }

    void PathManager::WriteWaypoints(float* outBuffer, u32* outCount, u32 maxEntries) const
    {
        u32 count = 0;
        for (const auto& [e, path] : m_Paths)
        {
            if (count >= maxEntries) break;
            u32 base = count * 6;
            outBuffer[base + 0] = (f32)e;
            glm::vec3 wp = path.CurrentWaypoint();
            outBuffer[base + 1] = wp.x;
            outBuffer[base + 2] = wp.y;
            outBuffer[base + 3] = wp.z;
            outBuffer[base + 4] = path.IsComplete() ? 0.0f : 1.0f;
            outBuffer[base + 5] = (f32)path.currentIndex;
            ++count;
        }
        *outCount = count;
    }
}
