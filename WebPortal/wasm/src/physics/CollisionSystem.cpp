#include "physics/CollisionSystem.h"

namespace nv
{
    CollisionSystem g_CollisionSystem;

    void CollisionSystem::Init()
    {
        m_StaticColliders.clear();
        m_DynamicColliders.clear();
        m_BVH.Clear();
    }

    void CollisionSystem::RegisterStatic(Entity e, const AABB& localBounds, const Transform& t)
    {
        StaticCollider sc;
        sc.entity = e;
        sc.worldBounds.min = localBounds.min * t.scale + t.position;
        sc.worldBounds.max = localBounds.max * t.scale + t.position;
        glm::vec3 actualMin = glm::min(sc.worldBounds.min, sc.worldBounds.max);
        glm::vec3 actualMax = glm::max(sc.worldBounds.min, sc.worldBounds.max);
        sc.worldBounds.min = actualMin;
        sc.worldBounds.max = actualMax;
        m_StaticColliders.push_back(sc);
    }

    void CollisionSystem::Clear()
    {
        m_StaticColliders.clear();
        m_DynamicColliders.clear();
        m_BVH.Clear();
    }

    void CollisionSystem::BuildBVH()
    {
        if (m_StaticColliders.empty())
        {
            m_BVH.Clear();
            return;
        }

        std::vector<AABB> boxes(m_StaticColliders.size());
        std::vector<Entity> entities(m_StaticColliders.size());
        for (u32 i = 0; i < (u32)m_StaticColliders.size(); ++i)
        {
            boxes[i] = m_StaticColliders[i].worldBounds;
            entities[i] = m_StaticColliders[i].entity;
        }
        m_BVH.Build(boxes.data(), entities.data(), (u32)m_StaticColliders.size());
    }

    // ── Dynamic colliders ──────────────────────────────────────

    void CollisionSystem::RegisterDynamic(Entity e, const AABB& localBounds)
    {
        for (auto& dc : m_DynamicColliders)
        {
            if (dc.entity == e)
            {
                dc.localBounds = localBounds;
                return;
            }
        }
        DynamicCollider dc;
        dc.entity = e;
        dc.localBounds = localBounds;
        dc.worldBounds = localBounds;
        m_DynamicColliders.push_back(dc);
    }

    void CollisionSystem::UpdateDynamic(Entity e, const Transform& t)
    {
        for (auto& dc : m_DynamicColliders)
        {
            if (dc.entity == e)
            {
                dc.worldBounds.min = dc.localBounds.min * t.scale + t.position;
                dc.worldBounds.max = dc.localBounds.max * t.scale + t.position;
                glm::vec3 actualMin = glm::min(dc.worldBounds.min, dc.worldBounds.max);
                glm::vec3 actualMax = glm::max(dc.worldBounds.min, dc.worldBounds.max);
                dc.worldBounds.min = actualMin;
                dc.worldBounds.max = actualMax;
                return;
            }
        }
    }

    void CollisionSystem::RemoveDynamic(Entity e)
    {
        for (auto it = m_DynamicColliders.begin(); it != m_DynamicColliders.end(); ++it)
        {
            if (it->entity == e)
            {
                m_DynamicColliders.erase(it);
                return;
            }
        }
    }

    bool CollisionSystem::CheckDynamic(const AABB& worldAABB, Entity& outEntity) const
    {
        for (const auto& dc : m_DynamicColliders)
        {
            bool intersect = (worldAABB.min.x <= dc.worldBounds.max.x && worldAABB.max.x >= dc.worldBounds.min.x) &&
                             (worldAABB.min.y <= dc.worldBounds.max.y && worldAABB.max.y >= dc.worldBounds.min.y) &&
                             (worldAABB.min.z <= dc.worldBounds.max.z && worldAABB.max.z >= dc.worldBounds.min.z);
            if (intersect) { outEntity = dc.entity; return true; }
        }
        return false;
    }

    float CollisionSystem::SegmentCastDynamic(const glm::vec3& from, const glm::vec3& to, Entity ignore) const
    {
        glm::vec3 delta = to - from;
        f32 length = glm::length(delta);
        if (length < 1e-4f) return 0.0f;
        glm::vec3 dir = delta / length;
        Ray ray{from, dir, length};
        f32 nearest = length;
        for (const auto& dc : m_DynamicColliders)
        {
            if (dc.entity == ignore) continue;
            if (dc.worldBounds.Contains(from)) continue;
            f32 tHit = 0.0f;
            if (dc.worldBounds.IntersectRay(ray, tHit) && tHit > 1e-4f && tHit < nearest)
                nearest = tHit;
        }
        return nearest;
    }

    // ── Queries (BVH + dynamic fallback) ──────────────────────

    bool CollisionSystem::CheckCollision(const AABB& worldAABB, Entity& outEntity) const
    {
        if (m_BVH.IsBuilt())
        {
            if (m_BVH.QueryAABB(worldAABB, outEntity))
                return true;
        }
        else
        {
            // Fallback linéaire si BVH pas encore construit
            for (const auto& sc : m_StaticColliders)
            {
                bool intersect = (worldAABB.min.x <= sc.worldBounds.max.x && worldAABB.max.x >= sc.worldBounds.min.x) &&
                                 (worldAABB.min.y <= sc.worldBounds.max.y && worldAABB.max.y >= sc.worldBounds.min.y) &&
                                 (worldAABB.min.z <= sc.worldBounds.max.z && worldAABB.max.z >= sc.worldBounds.min.z);
                if (intersect) { outEntity = sc.entity; return true; }
            }
        }
        return CheckDynamic(worldAABB, outEntity);
    }

    glm::vec3 CollisionSystem::Resolve(AABB& a, const AABB& b) const
    {
        glm::vec3 overlapMin = glm::max(a.min, b.min);
        glm::vec3 overlapMax = glm::min(a.max, b.max);
        glm::vec3 overlapSize = overlapMax - overlapMin;
        int axis = 0;
        if (overlapSize.y < overlapSize.x) axis = 1;
        if (overlapSize.z < overlapSize[axis]) axis = 2;
        glm::vec3 correction(0.0f);
        float aCenter = (a.min[axis] + a.max[axis]) * 0.5f;
        float bCenter = (b.min[axis] + b.max[axis]) * 0.5f;
        if (aCenter < bCenter) correction[axis] = -overlapSize[axis];
        else correction[axis] = overlapSize[axis];
        return correction;
    }

    bool CollisionSystem::SegmentBlocked(const glm::vec3& from, const glm::vec3& to, Entity ignore) const
    {
        if (m_BVH.IsBuilt())
        {
            if (m_BVH.SegmentBlocked(from, to, ignore))
                return true;
        }
        else
        {
            glm::vec3 delta = to - from;
            float length = glm::length(delta);
            if (length < 1e-4f) return false;
            glm::vec3 dir = delta / length;
            Ray ray{from, dir, length};
            for (const auto& sc : m_StaticColliders)
            {
                if (sc.entity == ignore) continue;
                if (sc.worldBounds.Contains(from)) continue;
                float tHit = 0.0f;
                if (sc.worldBounds.IntersectRay(ray, tHit) && tHit > 1e-4f && tHit <= length)
                    return true;
            }
        }

        // Vérifier les dynamiques
        glm::vec3 delta = to - from;
        f32 length = glm::length(delta);
        if (length < 1e-4f) return false;
        glm::vec3 dir = delta / length;
        Ray ray{from, dir, length};
        for (const auto& dc : m_DynamicColliders)
        {
            if (dc.entity == ignore) continue;
            if (dc.worldBounds.Contains(from)) continue;
            f32 tHit = 0.0f;
            if (dc.worldBounds.IntersectRay(ray, tHit) && tHit > 1e-4f && tHit <= length)
                return true;
        }
        return false;
    }

    float CollisionSystem::SegmentCastDistance(const glm::vec3& from, const glm::vec3& to, Entity ignore) const
    {
        glm::vec3 delta = to - from;
        float length = glm::length(delta);
        if (length < 1e-4f) return 0.0f;

        f32 nearest = length;

        if (m_BVH.IsBuilt())
        {
            f32 bvhDist = m_BVH.SegmentCast(from, to, ignore);
            if (bvhDist < nearest) nearest = bvhDist;
        }
        else
        {
            glm::vec3 dir = delta / length;
            Ray ray{from, dir, length};
            for (const auto& sc : m_StaticColliders)
            {
                if (sc.entity == ignore) continue;
                if (sc.worldBounds.Contains(from)) continue;
                float tHit = 0.0f;
                if (sc.worldBounds.IntersectRay(ray, tHit) && tHit > 1e-4f && tHit < nearest)
                    nearest = tHit;
            }
        }

        f32 dynDist = SegmentCastDynamic(from, to, ignore);
        if (dynDist < nearest) nearest = dynDist;

        return nearest;
    }

    float CollisionSystem::RaycastDown(const glm::vec3& start, float maxDist) const
    {
        Ray ray{start, glm::vec3(0.0f, -1.0f, 0.0f), maxDist};
        float nearest = maxDist;
        bool hit = false;

        if (m_BVH.IsBuilt())
        {
            f32 t = 0.0f;
            Entity e = INVALID_ENTITY;
            if (m_BVH.RayCast(ray, t, e) && t > 1e-4f)
            {
                nearest = t;
                hit = true;
            }
        }
        else
        {
            for (const auto& sc : m_StaticColliders)
            {
                if (sc.worldBounds.Contains(start)) continue;
                float tHit = 0.0f;
                if (sc.worldBounds.IntersectRay(ray, tHit) && tHit > 1e-4f && tHit < nearest)
                {
                    nearest = tHit;
                    hit = true;
                }
            }
        }

        // Dynamiques aussi
        for (const auto& dc : m_DynamicColliders)
        {
            if (dc.worldBounds.Contains(start)) continue;
            f32 tHit = 0.0f;
            if (dc.worldBounds.IntersectRay(ray, tHit) && tHit > 1e-4f && tHit < nearest)
            {
                nearest = tHit;
                hit = true;
            }
        }

        return hit ? (start.y - nearest) : (start.y - maxDist);
    }
}
