#include "physics/BVH.h"
#include <glm/common.hpp>
#include <glm/geometric.hpp>
#include <algorithm>
#include <numeric>
#include <cstring>

namespace nv
{
    static bool AABBOverlap(const AABB& a, const AABB& b)
    {
        return (a.min.x <= b.max.x && a.max.x >= b.min.x) &&
               (a.min.y <= b.max.y && a.max.y >= b.min.y) &&
               (a.min.z <= b.max.z && a.max.z >= b.min.z);
    }

    AABB BVH::ComputeBounds(const AABB* boxes, const u32* indices, u32 start, u32 end)
    {
        AABB result;
        result.min = glm::vec3(1e18f);
        result.max = glm::vec3(-1e18f);
        for (u32 i = start; i < end; ++i)
        {
            const AABB& b = boxes[indices[i]];
            result.min = glm::min(result.min, b.min);
            result.max = glm::max(result.max, b.max);
        }
        return result;
    }

    void BVH::Build(const AABB* boxes, const Entity* entities, u32 count)
    {
        m_Nodes.clear();
        m_LeafBoxes.clear();
        m_LeafEntities.clear();
        m_LeafCount = 0;

        if (count == 0) return;

        m_LeafBoxes.assign(boxes, boxes + count);
        m_LeafEntities.assign(entities, entities + count);
        m_LeafCount = count;

        // Indices triés pendant la construction
        std::vector<u32> indices(count);
        std::iota(indices.begin(), indices.end(), 0u);

        m_Nodes.reserve(count * 2);

        // Pile de construction (itératif, pas de récursion)
        struct StackEntry
        {
            u32 start, end;
            i32 nodeIdx;
        };

        // Noeud racine
        m_Nodes.push_back({});
        m_Nodes[0].bounds = ComputeBounds(boxes, indices.data(), 0, count);

        StackEntry stack[64];
        i32 stackTop = 0;
        stack[0] = {0, count, 0};

        while (stackTop >= 0)
        {
            StackEntry entry = stack[stackTop--];
            u32 start = entry.start;
            u32 end = entry.end;
            i32 nodeIdx = entry.nodeIdx;
            u32 n = end - start;

            if (n <= 1)
            {
                m_Nodes[nodeIdx].leafIndex = (i32)indices[start];
                continue;
            }

            // Trouver l'axe le plus long
            AABB& nodeBounds = m_Nodes[nodeIdx].bounds;
            glm::vec3 extent = nodeBounds.max - nodeBounds.min;
            int axis = 0;
            if (extent.y > extent.x) axis = 1;
            if (extent.z > extent[axis]) axis = 2;

            // Trier par centre sur cet axe (median split)
            u32* idxPtr = indices.data();
            std::sort(idxPtr + start, idxPtr + end, [&](u32 a, u32 b) {
                float ca = (boxes[a].min[axis] + boxes[a].max[axis]) * 0.5f;
                float cb = (boxes[b].min[axis] + boxes[b].max[axis]) * 0.5f;
                return ca < cb;
            });

            u32 mid = start + n / 2;

            // Créer enfants
            i32 leftIdx = (i32)m_Nodes.size();
            m_Nodes.push_back({});
            m_Nodes[leftIdx].bounds = ComputeBounds(boxes, indices.data(), start, mid);

            i32 rightIdx = (i32)m_Nodes.size();
            m_Nodes.push_back({});
            m_Nodes[rightIdx].bounds = ComputeBounds(boxes, indices.data(), mid, end);

            m_Nodes[nodeIdx].left = leftIdx;
            m_Nodes[nodeIdx].right = rightIdx;

            // Pousser sur la pile (droite d'abord pour que gauche soit traité en premier)
            ++stackTop;
            stack[stackTop] = {mid, end, rightIdx};
            ++stackTop;
            stack[stackTop] = {start, mid, leftIdx};
        }
    }

    void BVH::Clear()
    {
        m_Nodes.clear();
        m_LeafBoxes.clear();
        m_LeafEntities.clear();
        m_LeafCount = 0;
    }

    bool BVH::QueryAABB(const AABB& query, Entity& outEntity) const
    {
        if (m_Nodes.empty()) return false;

        i32 stack[64];
        i32 top = 0;
        stack[0] = 0;

        while (top >= 0)
        {
            i32 idx = stack[top--];
            const BVHNode& node = m_Nodes[idx];

            if (!AABBOverlap(query, node.bounds)) continue;

            if (node.leafIndex >= 0)
            {
                outEntity = m_LeafEntities[node.leafIndex];
                return true;
            }

            if (node.left >= 0) stack[++top] = node.left;
            if (node.right >= 0) stack[++top] = node.right;
        }
        return false;
    }

    void BVH::QueryAABBAll(const AABB& query, Entity* results, u32 maxResults, u32& outCount) const
    {
        outCount = 0;
        if (m_Nodes.empty()) return;

        i32 stack[64];
        i32 top = 0;
        stack[0] = 0;

        while (top >= 0 && outCount < maxResults)
        {
            i32 idx = stack[top--];
            const BVHNode& node = m_Nodes[idx];

            if (!AABBOverlap(query, node.bounds)) continue;

            if (node.leafIndex >= 0)
            {
                if (AABBOverlap(query, m_LeafBoxes[node.leafIndex]))
                {
                    results[outCount++] = m_LeafEntities[node.leafIndex];
                }
                continue;
            }

            if (node.left >= 0) stack[++top] = node.left;
            if (node.right >= 0) stack[++top] = node.right;
        }
    }

    bool BVH::RayCast(const Ray& ray, f32& outT, Entity& outEntity) const
    {
        if (m_Nodes.empty()) return false;

        f32 nearest = ray.length;
        bool hit = false;

        i32 stack[64];
        i32 top = 0;
        stack[0] = 0;

        while (top >= 0)
        {
            i32 idx = stack[top--];
            const BVHNode& node = m_Nodes[idx];

            f32 tNode = 0.0f;
            if (!node.bounds.IntersectRay(ray, tNode)) continue;
            if (tNode > nearest) continue;

            if (node.leafIndex >= 0)
            {
                f32 tLeaf = 0.0f;
                if (m_LeafBoxes[node.leafIndex].IntersectRay(ray, tLeaf) && tLeaf < nearest && tLeaf > 1e-4f)
                {
                    nearest = tLeaf;
                    outEntity = m_LeafEntities[node.leafIndex];
                    hit = true;
                }
                continue;
            }

            if (node.left >= 0) stack[++top] = node.left;
            if (node.right >= 0) stack[++top] = node.right;
        }

        if (hit) outT = nearest;
        return hit;
    }

    f32 BVH::SegmentCast(const glm::vec3& from, const glm::vec3& to, Entity ignore) const
    {
        glm::vec3 delta = to - from;
        f32 segLen = glm::length(delta);
        if (segLen < 1e-4f) return 0.0f;

        glm::vec3 dir = delta / segLen;
        Ray ray{from, dir, segLen};

        if (m_Nodes.empty())
            return segLen;

        f32 nearest = segLen;
        i32 stack[64];
        i32 top = 0;
        stack[0] = 0;

        while (top >= 0)
        {
            i32 idx = stack[top--];
            const BVHNode& node = m_Nodes[idx];

            f32 tNode = 0.0f;
            if (!node.bounds.IntersectRay(ray, tNode)) continue;
            if (tNode > nearest) continue;

            if (node.leafIndex >= 0)
            {
                if (m_LeafEntities[node.leafIndex] == ignore) continue;
                if (m_LeafBoxes[node.leafIndex].Contains(from)) continue;

                f32 tLeaf = 0.0f;
                if (m_LeafBoxes[node.leafIndex].IntersectRay(ray, tLeaf) && tLeaf > 1e-4f && tLeaf < nearest)
                    nearest = tLeaf;
                continue;
            }

            if (node.left >= 0) stack[++top] = node.left;
            if (node.right >= 0) stack[++top] = node.right;
        }

        return nearest;
    }

    bool BVH::SegmentBlocked(const glm::vec3& from, const glm::vec3& to, Entity ignore) const
    {
        glm::vec3 delta = to - from;
        f32 segLen = glm::length(delta);
        if (segLen < 1e-4f) return false;

        glm::vec3 dir = delta / segLen;
        Ray ray{from, dir, segLen};

        if (m_Nodes.empty())
            return false;

        i32 stack[64];
        i32 top = 0;
        stack[0] = 0;

        while (top >= 0)
        {
            i32 idx = stack[top--];
            const BVHNode& node = m_Nodes[idx];

            f32 tNode = 0.0f;
            if (!node.bounds.IntersectRay(ray, tNode)) continue;

            if (node.leafIndex >= 0)
            {
                if (m_LeafEntities[node.leafIndex] == ignore) continue;
                if (m_LeafBoxes[node.leafIndex].Contains(from)) continue;

                f32 tLeaf = 0.0f;
                if (m_LeafBoxes[node.leafIndex].IntersectRay(ray, tLeaf) && tLeaf > 1e-4f && tLeaf <= segLen)
                    return true;
                continue;
            }

            if (node.left >= 0) stack[++top] = node.left;
            if (node.right >= 0) stack[++top] = node.right;
        }

        return false;
    }
}
