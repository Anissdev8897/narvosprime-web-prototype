#pragma once
#include <glm/vec3.hpp>
#include "core/Types.h"

namespace nv
{
    struct Ray
    {
        glm::vec3 origin;
        glm::vec3 direction;
        f32 length;
    };

    struct RaycastHit
    {
        bool hit = false;
        Entity entity = INVALID_ENTITY;
        glm::vec3 point{0.0f};
        f32 distance = 0.0f;
    };

    struct AABB
    {
        glm::vec3 min{0.0f};
        glm::vec3 max{0.0f};
        bool IntersectRay(const Ray& ray, f32& t) const;
        bool Contains(const glm::vec3& p) const;
    };
}
