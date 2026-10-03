#pragma once
#include "core/Types.h"
#include "physics/Raycast.h"
#include <vector>

namespace nv
{
    struct BVHNode
    {
        AABB bounds;
        i32 left = -1;
        i32 right = -1;
        i32 leafIndex = -1; // index into collider array, -1 for internal nodes
    };

    // BVH (Bounding Volume Hierarchy) — accélère les requêtes spatiales de O(n) à O(log n).
    // Construction top-down par median-split sur l'axe le plus long.
    // Traversée itérative par pile (pas de récursion — mieux pour WASM).
    class BVH
    {
    public:
        void Build(const AABB* boxes, const Entity* entities, u32 count);
        void Clear();

        bool QueryAABB(const AABB& query, Entity& outEntity) const;
        void QueryAABBAll(const AABB& query, Entity* results, u32 maxResults, u32& outCount) const;
        bool RayCast(const Ray& ray, f32& outT, Entity& outEntity) const;
        f32 SegmentCast(const glm::vec3& from, const glm::vec3& to, Entity ignore) const;
        bool SegmentBlocked(const glm::vec3& from, const glm::vec3& to, Entity ignore) const;

        u32 NodeCount() const { return (u32)m_Nodes.size(); }
        u32 LeafCount() const { return m_LeafCount; }
        bool IsBuilt() const { return !m_Nodes.empty(); }

    private:
        struct BuildEntry
        {
            u32 start, end;
            i32 parentIdx;
            bool isLeft;
        };

        static AABB ComputeBounds(const AABB* boxes, const u32* indices, u32 start, u32 end);

        std::vector<BVHNode> m_Nodes;
        std::vector<AABB> m_LeafBoxes;
        std::vector<Entity> m_LeafEntities;
        u32 m_LeafCount = 0;
    };
}
