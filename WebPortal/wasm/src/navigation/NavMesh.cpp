#include "navigation/NavMesh.h"
#include <algorithm>
#include <cmath>
#include <queue>
#include <limits>

namespace nv
{
    NavMesh g_NavMesh;

    void NavMesh::Init(f32 originX, f32 originZ, f32 cellSize, u32 width, u32 depth)
    {
        m_OriginX = originX;
        m_OriginZ = originZ;
        m_CellSize = cellSize;
        m_Width = width;
        m_Depth = depth;
        m_Cells.resize(width * depth);
        for (auto& c : m_Cells) { c.y = 0.0f; c.walkable = false; }
    }

    void NavMesh::Clear()
    {
        m_Cells.clear();
        m_Width = 0;
        m_Depth = 0;
    }

    void NavMesh::SetCell(u32 x, u32 z, f32 y, bool walkable)
    {
        if (x >= m_Width || z >= m_Depth) return;
        auto& c = m_Cells[CellIndex(x, z)];
        c.y = y;
        c.walkable = walkable;
    }

    void NavMesh::BakeFromHeightmap(const f32* heights, const u8* walkFlags, u32 count)
    {
        u32 total = m_Width * m_Depth;
        u32 n = std::min(count, total);
        for (u32 i = 0; i < n; ++i)
        {
            m_Cells[i].y = heights[i];
            m_Cells[i].walkable = walkFlags[i] != 0;
        }
    }

    bool NavMesh::WorldToGrid(const glm::vec3& pos, u32& gx, u32& gz) const
    {
        f32 lx = (pos.x - m_OriginX) / m_CellSize;
        f32 lz = (pos.z - m_OriginZ) / m_CellSize;
        if (lx < 0.0f || lz < 0.0f) return false;
        gx = (u32)lx;
        gz = (u32)lz;
        return gx < m_Width && gz < m_Depth;
    }

    glm::vec3 NavMesh::GridToWorld(u32 gx, u32 gz) const
    {
        f32 x = m_OriginX + (gx + 0.5f) * m_CellSize;
        f32 z = m_OriginZ + (gz + 0.5f) * m_CellSize;
        f32 y = (gx < m_Width && gz < m_Depth) ? m_Cells[CellIndex(gx, gz)].y : 0.0f;
        return glm::vec3(x, y, z);
    }

    bool NavMesh::IsWalkable(u32 gx, u32 gz) const
    {
        if (gx >= m_Width || gz >= m_Depth) return false;
        return m_Cells[CellIndex(gx, gz)].walkable;
    }

    glm::vec3 NavMesh::SnapToNavMesh(const glm::vec3& pos) const
    {
        u32 gx, gz;
        if (WorldToGrid(pos, gx, gz) && IsWalkable(gx, gz))
            return glm::vec3(pos.x, m_Cells[CellIndex(gx, gz)].y, pos.z);

        // Chercher la cellule walkable la plus proche (spirale)
        f32 bestDist = std::numeric_limits<f32>::max();
        glm::vec3 bestPos = pos;
        u32 range = 10;
        for (u32 r = 1; r <= range; ++r)
        {
            for (u32 dx = 0; dx <= r; ++dx)
            {
                u32 dz = r - dx;
                // 4 quadrants
                u32 coords[4][2] = {
                    {gx + dx, gz + dz}, {gx + dx, gz - dz},
                    {gx - dx, gz + dz}, {gx - dx, gz - dz}
                };
                for (auto& c : coords)
                {
                    if (c[0] < m_Width && c[1] < m_Depth && IsWalkable(c[0], c[1]))
                    {
                        glm::vec3 wp = GridToWorld(c[0], c[1]);
                        f32 d = glm::distance(glm::vec2(pos.x, pos.z), glm::vec2(wp.x, wp.z));
                        if (d < bestDist) { bestDist = d; bestPos = wp; }
                    }
                }
            }
            if (bestDist < std::numeric_limits<f32>::max()) break;
        }
        return bestPos;
    }

    f32 NavMesh::Heuristic(u32 ax, u32 az, u32 bx, u32 bz) const
    {
        f32 dx = (f32)((i32)bx - (i32)ax);
        f32 dz = (f32)((i32)bz - (i32)az);
        return std::sqrt(dx * dx + dz * dz);
    }

    // A* sur grille 8-connexe
    NavPath NavMesh::FindPath(const glm::vec3& from, const glm::vec3& to) const
    {
        NavPath result;
        u32 sx, sz, ex, ez;

        if (!WorldToGrid(from, sx, sz) || !WorldToGrid(to, ex, ez))
            return result;

        // Snap start/end au plus proche walkable
        if (!IsWalkable(sx, sz))
        {
            glm::vec3 snapped = SnapToNavMesh(from);
            if (!WorldToGrid(snapped, sx, sz)) return result;
        }
        if (!IsWalkable(ex, ez))
        {
            glm::vec3 snapped = SnapToNavMesh(to);
            if (!WorldToGrid(snapped, ex, ez)) return result;
        }

        u32 startIdx = CellIndex(sx, sz);
        u32 endIdx = CellIndex(ex, ez);
        if (startIdx == endIdx)
        {
            result.waypoints.push_back(to);
            return result;
        }

        u32 totalCells = m_Width * m_Depth;
        std::vector<f32> gScore(totalCells, std::numeric_limits<f32>::max());
        std::vector<u32> cameFrom(totalCells, 0xFFFFFFFF);
        std::vector<bool> closed(totalCells, false);

        struct PQNode { f32 f; u32 idx; };
        auto cmp = [](const PQNode& a, const PQNode& b) { return a.f > b.f; };
        std::priority_queue<PQNode, std::vector<PQNode>, decltype(cmp)> open(cmp);

        gScore[startIdx] = 0.0f;
        open.push({Heuristic(sx, sz, ex, ez), startIdx});

        // Directions 8-connexes
        static const i32 dx8[] = {-1, 0, 1, -1, 1, -1, 0, 1};
        static const i32 dz8[] = {-1, -1, -1, 0, 0, 1, 1, 1};
        static const f32 cost8[] = {1.41421f, 1.0f, 1.41421f, 1.0f, 1.0f, 1.41421f, 1.0f, 1.41421f};

        // Pente max traversable (hauteur Y entre voisins)
        const f32 maxSlope = m_CellSize * 1.5f;

        u32 iterations = 0;
        const u32 MAX_ITERATIONS = 50000;

        while (!open.empty() && iterations < MAX_ITERATIONS)
        {
            ++iterations;
            PQNode current = open.top();
            open.pop();

            if (current.idx == endIdx) break;
            if (closed[current.idx]) continue;
            closed[current.idx] = true;

            u32 cx = current.idx % m_Width;
            u32 cz = current.idx / m_Width;

            for (u32 d = 0; d < 8; ++d)
            {
                i32 nx = (i32)cx + dx8[d];
                i32 nz = (i32)cz + dz8[d];
                if (nx < 0 || nz < 0 || (u32)nx >= m_Width || (u32)nz >= m_Depth) continue;

                u32 nIdx = CellIndex((u32)nx, (u32)nz);
                if (closed[nIdx] || !m_Cells[nIdx].walkable) continue;

                // Bloquer diagonal si les deux adjacents orthogonaux ne sont pas walkable
                if (dx8[d] != 0 && dz8[d] != 0)
                {
                    if (!IsWalkable(cx + dx8[d], cz) || !IsWalkable(cx, cz + dz8[d]))
                        continue;
                }

                // Pente
                f32 dy = std::abs(m_Cells[nIdx].y - m_Cells[current.idx].y);
                if (dy > maxSlope) continue;

                f32 tentG = gScore[current.idx] + cost8[d] + dy * 0.5f;
                if (tentG < gScore[nIdx])
                {
                    gScore[nIdx] = tentG;
                    cameFrom[nIdx] = current.idx;
                    f32 h = Heuristic((u32)nx, (u32)nz, ex, ez);
                    open.push({tentG + h, nIdx});
                }
            }
        }

        // Reconstruire le chemin
        if (cameFrom[endIdx] == 0xFFFFFFFF && startIdx != endIdx)
            return result; // pas de chemin

        std::vector<u32> rawPath;
        u32 cur = endIdx;
        while (cur != 0xFFFFFFFF && cur != startIdx)
        {
            rawPath.push_back(cur);
            cur = cameFrom[cur];
        }
        rawPath.push_back(startIdx);
        std::reverse(rawPath.begin(), rawPath.end());

        result.waypoints = SmoothPath(rawPath);
        // Remplacer le dernier waypoint par la destination exacte
        if (!result.waypoints.empty())
            result.waypoints.back() = to;

        return result;
    }

    // String-pulling simplifié : garder les points où la direction change
    std::vector<glm::vec3> NavMesh::SmoothPath(const std::vector<u32>& rawPath) const
    {
        if (rawPath.size() <= 2)
        {
            std::vector<glm::vec3> pts;
            for (u32 idx : rawPath) pts.push_back(GridToWorld(idx % m_Width, idx / m_Width));
            return pts;
        }

        std::vector<glm::vec3> smoothed;
        smoothed.push_back(GridToWorld(rawPath[0] % m_Width, rawPath[0] / m_Width));

        i32 prevDx = (i32)(rawPath[1] % m_Width) - (i32)(rawPath[0] % m_Width);
        i32 prevDz = (i32)(rawPath[1] / m_Width) - (i32)(rawPath[0] / m_Width);

        for (u32 i = 2; i < (u32)rawPath.size(); ++i)
        {
            i32 dx = (i32)(rawPath[i] % m_Width) - (i32)(rawPath[i-1] % m_Width);
            i32 dz = (i32)(rawPath[i] / m_Width) - (i32)(rawPath[i-1] / m_Width);

            if (dx != prevDx || dz != prevDz)
            {
                smoothed.push_back(GridToWorld(rawPath[i-1] % m_Width, rawPath[i-1] / m_Width));
                prevDx = dx;
                prevDz = dz;
            }
        }

        smoothed.push_back(GridToWorld(rawPath.back() % m_Width, rawPath.back() / m_Width));
        return smoothed;
    }
}
