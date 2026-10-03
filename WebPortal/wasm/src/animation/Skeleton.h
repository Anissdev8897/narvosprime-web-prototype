#pragma once
#include "core/Types.h"
#include "core/Math.h"
#include <vector>
#include <string>
#include <unordered_map>

namespace nv
{
    struct JointPose
    {
        glm::vec3 translation{0.0f};
        glm::quat rotation{1,0,0,0};
        glm::vec3 scale{1.0f};
        glm::mat4 ToMatrix() const;
    };

    struct Bone
    {
        std::string name;
        i32 parentIndex = -1;
        glm::mat4 inverseBindPose{1.0f};
        glm::mat4 localTransform{1.0f};
        glm::vec3 bindTranslation{0.0f};
        glm::quat bindRotation{1,0,0,0};
        glm::vec3 bindScale{1.0f};
    };

    struct Skeleton
    {
        std::vector<Bone> bones;
        std::unordered_map<std::string, u32> boneMap;
        u32 FindBone(const std::string& name) const;
        void CalculateGlobalTransforms(std::vector<glm::mat4>& outGlobals) const;
    };

    struct AnimationClip
    {
        std::string name;
        f32 duration = 0.0f;
        f32 ticksPerSecond = 30.0f;
        struct Channel {
            std::string boneName;
            std::vector<std::pair<f32, glm::vec3>> posKeys;
            std::vector<std::pair<f32, glm::quat>> rotKeys;
            std::vector<std::pair<f32, glm::vec3>> scaleKeys;
        };
        std::vector<Channel> channels;
        void Sample(f32 time, std::vector<JointPose>& outPoses, const Skeleton& skeleton) const;
    };
}
