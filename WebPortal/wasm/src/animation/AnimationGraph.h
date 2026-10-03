#pragma once
#include "animation/Animator.h"
#include <glm/vec2.hpp>
#include <functional>
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>

namespace nv
{
    class AnimationGraph
    {
    public:
        struct Node
        {
            std::string name;
            enum Type { Clip, Blend1D, Blend2D, StateMachine, IKPose, AimOffset } type;
            std::function<void(f32 dt)> update;
            std::function<void(std::vector<JointPose>&)> evaluate;
        };

        struct State
        {
            std::string name;
            std::string clip;
            std::vector<std::pair<std::string, std::function<bool()>>> transitions;
        };

        void Init(std::shared_ptr<Skeleton> skeleton, Animator* animator);
        void AddClipNode(const std::string& name, const std::string& clipName, bool loop);
        void AddBlend1DNode(const std::string& name, const std::string& param,
                            const std::vector<std::pair<f32, std::string>>& clips);
        void AddStateMachine(const std::string& name, const std::vector<State>& states, const std::string& entry);
        void AddIKTwoBone(const std::string& name, const std::string& effectorBone,
                          const std::string& midBone, const std::string& rootBone);

        void SetParam(const std::string& param, f32 value);
        void SetParam(const std::string& param, bool value);
        void SetRootNode(const std::string& nodeName);

        void Update(f32 dt);
        void Evaluate(std::vector<JointPose>& outPoses);

        u32 BoneCount() const { return m_Skeleton ? (u32)m_Skeleton->bones.size() : 0; }
        std::shared_ptr<Skeleton> GetSkeleton() { return m_Skeleton; }

        void WriteBoneMatrices(float* outBuffer, u32 maxBones);

    private:
        struct Blend1D {
            std::string param;
            std::vector<std::pair<f32, std::string>> clips;
        };
        struct IKTwoBone {
            u32 effector, mid, root;
            glm::vec3 targetWS{0.0f};
            bool enabled = true;
        };

        std::shared_ptr<Skeleton> m_Skeleton;
        Animator* m_Animator = nullptr;
        std::unordered_map<std::string, Node> m_Nodes;
        std::unordered_map<std::string, f32> m_FloatParams;
        std::unordered_map<std::string, bool> m_BoolParams;
        std::unordered_map<std::string, Blend1D> m_Blend1D;
        std::unordered_map<std::string, IKTwoBone> m_IKTwoBone;
        std::string m_RootNode;
        std::vector<JointPose> m_TempPosesA, m_TempPosesB;
        std::vector<JointPose> m_FinalPoses;
        std::vector<glm::mat4> m_GlobalTransforms;
    };
}
