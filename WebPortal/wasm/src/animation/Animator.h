#pragma once
#include "animation/Skeleton.h"
#include <vector>
#include <memory>
#include <algorithm>

namespace nv
{
    class Animator
    {
    public:
        void SetSkeleton(std::shared_ptr<Skeleton> skeleton) { m_Skeleton = skeleton; }
        std::shared_ptr<Skeleton> GetSkeleton() const { return m_Skeleton; }

        void AddClip(const AnimationClip& clip) { m_Clips.push_back(clip); }
        const std::vector<AnimationClip>& GetClips() const { return m_Clips; }

        void BlendPoses(const std::vector<JointPose>& a, const std::vector<JointPose>& b, f32 alpha, std::vector<JointPose>& out)
        {
            size_t count = std::min(a.size(), b.size());
            out.resize(count);
            for (size_t i = 0; i < count; ++i)
            {
                out[i].translation = glm::mix(a[i].translation, b[i].translation, alpha);
                out[i].rotation = glm::slerp(a[i].rotation, b[i].rotation, alpha);
                out[i].scale = glm::mix(a[i].scale, b[i].scale, alpha);
            }
        }

        AnimationClip* FindClip(const std::string& name)
        {
            for (auto& c : m_Clips)
                if (c.name == name) return &c;
            return nullptr;
        }

    private:
        std::shared_ptr<Skeleton> m_Skeleton;
        std::vector<AnimationClip> m_Clips;
    };
}
