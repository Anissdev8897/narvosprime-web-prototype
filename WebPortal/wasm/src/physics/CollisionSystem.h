#pragma once
#include "core/Types.h"
#include "physics/Raycast.h"
#include "physics/BVH.h"
#include "components/Transform.h"
#include <vector>

namespace nv
{
    struct StaticCollider
    {
        Entity entity;
        AABB worldBounds;
    };

    struct DynamicCollider
    {
        Entity entity;
        AABB localBounds;
        AABB worldBounds;
    };

    class CollisionSystem
    {
    public:
        void Init();
        void RegisterStatic(Entity e, const AABB& localBounds, const Transform& t);
        void Clear();

        // Construit le BVH depuis les colliders statiques enregistrés.
        // Appelé une fois après batch registration, pas chaque frame.
        void BuildBVH();

        // Colliders dynamiques (entités mobiles : PNJ, véhicules)
        void RegisterDynamic(Entity e, const AABB& localBounds);
        void UpdateDynamic(Entity e, const Transform& t);
        void RemoveDynamic(Entity e);
        u32 DynamicCount() const { return (u32)m_DynamicColliders.size(); }

        bool CheckCollision(const AABB& worldAABB, Entity& outEntity) const;
        glm::vec3 Resolve(AABB& a, const AABB& b) const;
        float RaycastDown(const glm::vec3& start, float maxDist = 10000.0f) const;
        bool SegmentBlocked(const glm::vec3& from, const glm::vec3& to, Entity ignore = INVALID_ENTITY) const;
        float SegmentCastDistance(const glm::vec3& from, const glm::vec3& to, Entity ignore = INVALID_ENTITY) const;
        u32 ColliderCount() const { return (u32)m_StaticColliders.size() + (u32)m_DynamicColliders.size(); }
        u32 BVHNodeCount() const { return m_BVH.NodeCount(); }
        bool IsBVHBuilt() const { return m_BVH.IsBuilt(); }

    private:
        // Fallback linéaire pour les dynamiques
        bool CheckDynamic(const AABB& worldAABB, Entity& outEntity) const;
        float SegmentCastDynamic(const glm::vec3& from, const glm::vec3& to, Entity ignore) const;

        std::vector<StaticCollider> m_StaticColliders;
        std::vector<DynamicCollider> m_DynamicColliders;
        BVH m_BVH;
    };

    extern CollisionSystem g_CollisionSystem;
}
