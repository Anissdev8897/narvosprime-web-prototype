#include "animation/Skeleton.h"

namespace nv
{
    glm::mat4 JointPose::ToMatrix() const
    {
        glm::mat4 m = glm::translate(glm::mat4(1.0f), translation);
        m *= glm::mat4_cast(rotation);
        m = glm::scale(m, scale);
        return m;
    }

    u32 Skeleton::FindBone(const std::string& name) const
    {
        auto it = boneMap.find(name);
        return it != boneMap.end() ? it->second : (u32)-1;
    }

    void Skeleton::CalculateGlobalTransforms(std::vector<glm::mat4>& outGlobals) const
    {
        outGlobals.resize(bones.size());
        for (u32 i = 0; i < (u32)bones.size(); ++i)
        {
            glm::mat4 local = bones[i].localTransform;
            if (bones[i].parentIndex >= 0)
                outGlobals[i] = outGlobals[bones[i].parentIndex] * local;
            else
                outGlobals[i] = local;
        }
    }

    static glm::vec3 LerpVec3(const std::vector<std::pair<f32, glm::vec3>>& keys, f32 t)
    {
        if (keys.empty()) return glm::vec3(0.0f);
        if (keys.size() == 1 || t <= keys.front().first) return keys.front().second;
        if (t >= keys.back().first) return keys.back().second;

        for (size_t i = 0; i < keys.size() - 1; ++i)
        {
            if (t >= keys[i].first && t <= keys[i + 1].first)
            {
                f32 alpha = (t - keys[i].first) / (keys[i + 1].first - keys[i].first);
                return glm::mix(keys[i].second, keys[i + 1].second, alpha);
            }
        }
        return keys.back().second;
    }

    static glm::quat LerpQuat(const std::vector<std::pair<f32, glm::quat>>& keys, f32 t)
    {
        if (keys.empty()) return glm::quat(1,0,0,0);
        if (keys.size() == 1 || t <= keys.front().first) return keys.front().second;
        if (t >= keys.back().first) return keys.back().second;

        for (size_t i = 0; i < keys.size() - 1; ++i)
        {
            if (t >= keys[i].first && t <= keys[i + 1].first)
            {
                f32 alpha = (t - keys[i].first) / (keys[i + 1].first - keys[i].first);
                return glm::slerp(keys[i].second, keys[i + 1].second, alpha);
            }
        }
        return keys.back().second;
    }

    void AnimationClip::Sample(f32 time, std::vector<JointPose>& outPoses, const Skeleton& skeleton) const
    {
        outPoses.resize(skeleton.bones.size());

        for (u32 i = 0; i < (u32)skeleton.bones.size(); ++i)
        {
            outPoses[i].translation = skeleton.bones[i].bindTranslation;
            outPoses[i].rotation = skeleton.bones[i].bindRotation;
            outPoses[i].scale = skeleton.bones[i].bindScale;
        }

        for (const auto& ch : channels)
        {
            u32 boneIdx = skeleton.FindBone(ch.boneName);
            if (boneIdx == (u32)-1) continue;

            if (!ch.posKeys.empty())
                outPoses[boneIdx].translation = LerpVec3(ch.posKeys, time);
            if (!ch.rotKeys.empty())
                outPoses[boneIdx].rotation = LerpQuat(ch.rotKeys, time);
            if (!ch.scaleKeys.empty())
                outPoses[boneIdx].scale = LerpVec3(ch.scaleKeys, time);
        }
    }
}
