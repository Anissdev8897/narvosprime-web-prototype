#pragma once
#include "core/Types.h"
#include "navigation/NavMesh.h"
#include <unordered_map>

namespace nv
{
    // Gère les chemins actifs par entité. Intégré dans WorldCoordinator::Tick.
    class PathManager
    {
    public:
        void RequestPath(Entity e, const glm::vec3& target);
        void CancelPath(Entity e);
        void ClearAll();

        // Appelé chaque tick : avance les entités proches de leur waypoint
        void Update(f32 waypointReachDist = 1.0f);

        // Query par entité
        bool HasPath(Entity e) const;
        glm::vec3 GetNextWaypoint(Entity e) const;
        bool IsPathComplete(Entity e) const;
        u32 ActivePathCount() const { return (u32)m_Paths.size(); }

        // Buffer pour lecture JS (entity, x, y, z, hasPath, isComplete — 6 floats par entrée)
        void WriteWaypoints(float* outBuffer, u32* outCount, u32 maxEntries) const;

    private:
        std::unordered_map<Entity, NavPath> m_Paths;
    };

    extern PathManager g_PathManager;
}
