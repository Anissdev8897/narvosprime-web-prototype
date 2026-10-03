#include "physics/Raycast.h"
#include <algorithm>
#include <cmath>

namespace nv
{
    bool AABB::IntersectRay(const Ray& ray, f32& t) const
    {
        f32 tmin = 0.0f;
        f32 tmax = ray.length;

        for (int i = 0; i < 3; ++i)
        {
            if (std::abs(ray.direction[i]) < 1e-6f)
            {
                if (ray.origin[i] < min[i] || ray.origin[i] > max[i]) return false;
            }
            else
            {
                f32 invD = 1.0f / ray.direction[i];
                f32 t1 = (min[i] - ray.origin[i]) * invD;
                f32 t2 = (max[i] - ray.origin[i]) * invD;
                if (t1 > t2) std::swap(t1, t2);
                tmin = std::max(tmin, t1);
                tmax = std::min(tmax, t2);
                if (tmin > tmax) return false;
            }
        }
        t = tmin;
        return true;
    }

    bool AABB::Contains(const glm::vec3& p) const
    {
        return p.x >= min.x && p.x <= max.x &&
               p.y >= min.y && p.y <= max.y &&
               p.z >= min.z && p.z <= max.z;
    }
}
