#pragma once
#include "core/Types.h"
#include "core/Math.h"
#include <vector>
#include <unordered_map>

namespace nv
{
    // NavMesh basé sur une grille 2D (XZ) avec hauteur Y par cellule.
    // Chaque cellule est walkable ou non. A* sur la grille.
    // Simple, rapide, suffisant pour les maps indoor/outdoor de NARVOS.
    struct NavCell
    {
        f32 y = 0.0f;         // hauteur du sol
        bool walkable = false;
    };

    struct NavPath
    {
        std::vector<glm::vec3> waypoints;
        u32 currentIndex = 0;

        bool IsComplete() const { return currentIndex >= (u32)waypoints.size(); }
        glm::vec3 CurrentWaypoint() const
        {
            if (currentIndex < (u32)waypoints.size()) return waypoints[currentIndex];
            return glm::vec3(0.0f);
        }
        void Advance() { if (currentIndex < (u32)waypoints.size()) ++currentIndex; }
    };

    class NavMesh
    {
    public:
        void Init(f32 originX, f32 originZ, f32 cellSize, u32 width, u32 depth);
        void Clear();

        // Remplir depuis les données de collision (hauteurs + walkability)
        void SetCell(u32 x, u32 z, f32 y, bool walkable);
        void BakeFromHeightmap(const f32* heights, const u8* walkFlags, u32 count);

        // A* pathfinding (retourne un chemin lissé)
        NavPath FindPath(const glm::vec3& from, const glm::vec3& to) const;

        // Conversion world ↔ grid
        bool WorldToGrid(const glm::vec3& pos, u32& gx, u32& gz) const;
        glm::vec3 GridToWorld(u32 gx, u32 gz) const;

        // Queries
        bool IsWalkable(u32 gx, u32 gz) const;
        glm::vec3 SnapToNavMesh(const glm::vec3& pos) const;

        u32 Width() const { return m_Width; }
        u32 Depth() const { return m_Depth; }
        f32 CellSize() const { return m_CellSize; }

    private:
        struct AStarNode
        {
            u32 idx;
            f32 g, f;
            u32 parent;
        };

        u32 CellIndex(u32 x, u32 z) const { return z * m_Width + x; }
        f32 Heuristic(u32 ax, u32 az, u32 bx, u32 bz) const;
        std::vector<glm::vec3> SmoothPath(const std::vector<u32>& rawPath) const;

        f32 m_OriginX = 0.0f;
        f32 m_OriginZ = 0.0f;
        f32 m_CellSize = 1.0f;
        u32 m_Width = 0;
        u32 m_Depth = 0;
        std::vector<NavCell> m_Cells;
    };

    // Singleton global
    extern NavMesh g_NavMesh;
}
