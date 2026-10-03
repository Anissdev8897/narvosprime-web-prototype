#pragma once
#include "core/Math.h"

namespace nv
{
    struct Transform
    {
        glm::vec3 position{0.0f};
        glm::vec3 rotation{0.0f}; // Euler radians (pitch, yaw, roll)
        glm::vec3 scale{1.0f};

        glm::mat4 ToMatrix() const
        {
            glm::mat4 m = glm::translate(glm::mat4(1.0f), position);
            m = glm::rotate(m, rotation.z, {0,0,1});
            m = glm::rotate(m, rotation.y, {0,1,0});
            m = glm::rotate(m, rotation.x, {1,0,0});
            m = glm::scale(m, scale);
            return m;
        }

        glm::vec3 Forward() const
        {
            return glm::normalize(glm::vec3(
                sin(rotation.y) * cos(rotation.x),
                sin(rotation.x),
                cos(rotation.y) * cos(rotation.x)
            ));
        }

        glm::vec3 Right() const { return glm::normalize(glm::cross(Forward(), {0,1,0})); }
    };
}
