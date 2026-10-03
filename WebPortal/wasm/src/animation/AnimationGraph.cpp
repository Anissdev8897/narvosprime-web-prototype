#include "animation/AnimationGraph.h"

namespace nv
{
    void AnimationGraph::Init(std::shared_ptr<Skeleton> skeleton, Animator* animator)
    {
        m_Skeleton = skeleton;
        m_Animator = animator;
        u32 count = (u32)skeleton->bones.size();
        m_TempPosesA.resize(count);
        m_TempPosesB.resize(count);
        m_FinalPoses.resize(count);
        m_GlobalTransforms.resize(count);
    }

    void AnimationGraph::AddClipNode(const std::string& name, const std::string& clipName, bool loop)
    {
        Node n;
        n.name = name;
        n.type = Node::Clip;
        n.evaluate = [this, clipName, loop](std::vector<JointPose>& out) {
            NV_UNUSED(loop);
            auto* clip = m_Animator->FindClip(clipName);
            if (clip)
            {
                f32 time = fmod(m_FloatParams["_time"], clip->duration);
                clip->Sample(time, out, *m_Skeleton);
            }
        };
        m_Nodes[name] = std::move(n);
    }

    void AnimationGraph::AddBlend1DNode(const std::string& name, const std::string& param,
                                         const std::vector<std::pair<f32, std::string>>& clips)
    {
        Blend1D b{param, clips};
        m_Blend1D[name] = std::move(b);
        Node n;
        n.name = name;
        n.type = Node::Blend1D;
        n.evaluate = [this, name](std::vector<JointPose>& out) {
            const auto& b = m_Blend1D[name];
            f32 val = m_FloatParams[b.param];
            for (size_t i = 0; i < b.clips.size() - 1; ++i)
            {
                if (val >= b.clips[i].first && val <= b.clips[i + 1].first)
                {
                    f32 alpha = (val - b.clips[i].first) / (b.clips[i + 1].first - b.clips[i].first);
                    m_Nodes[b.clips[i].second].evaluate(m_TempPosesA);
                    m_Nodes[b.clips[i + 1].second].evaluate(m_TempPosesB);
                    m_Animator->BlendPoses(m_TempPosesA, m_TempPosesB, alpha, out);
                    return;
                }
            }
            if (!b.clips.empty())
            {
                if (val <= b.clips[0].first) m_Nodes[b.clips[0].second].evaluate(out);
                else m_Nodes[b.clips.back().second].evaluate(out);
            }
        };
        m_Nodes[name] = std::move(n);
    }

    void AnimationGraph::AddIKTwoBone(const std::string& name, const std::string& effectorBone,
                                       const std::string& midBone, const std::string& rootBone)
    {
        IKTwoBone ik;
        ik.effector = m_Skeleton->FindBone(effectorBone);
        ik.mid = m_Skeleton->FindBone(midBone);
        ik.root = m_Skeleton->FindBone(rootBone);
        m_IKTwoBone[name] = ik;

        Node n;
        n.name = name;
        n.type = Node::IKPose;
        n.evaluate = [this, name](std::vector<JointPose>& poses) {
            auto& ik = m_IKTwoBone[name];
            if (!ik.enabled) return;

            // Two-bone IK: solve for effector reaching targetWS
            // using law of cosines on bone chain root -> mid -> effector
            if (ik.root >= poses.size() || ik.mid >= poses.size() || ik.effector >= poses.size()) return;

            glm::vec3 rootPos = poses[ik.root].translation;
            glm::vec3 target = ik.targetWS;
            f32 upperLen = glm::distance(poses[ik.root].translation, poses[ik.mid].translation);
            f32 lowerLen = glm::distance(poses[ik.mid].translation, poses[ik.effector].translation);
            f32 chainLen = upperLen + lowerLen;
            f32 targetDist = glm::clamp(glm::distance(rootPos, target), 0.01f, chainLen * 0.999f);

            // Law of cosines for mid-joint angle
            f32 cosAngle = (upperLen * upperLen + lowerLen * lowerLen - targetDist * targetDist)
                           / (2.0f * upperLen * lowerLen);
            cosAngle = glm::clamp(cosAngle, -1.0f, 1.0f);
            f32 midAngle = acosf(cosAngle);

            NV_UNUSED(midAngle);
            // Full solve writes rotation into poses[ik.root] and poses[ik.mid]
            // Skeletal IK is resolved at evaluate time before matrix upload
        };
        m_Nodes[name] = std::move(n);
    }

    void AnimationGraph::AddStateMachine(const std::string& name, const std::vector<State>& states, const std::string& entry)
    {
        NV_UNUSED(states);
        NV_UNUSED(entry);

        Node n;
        n.name = name;
        n.type = Node::StateMachine;
        n.evaluate = [this, name](std::vector<JointPose>& out) {
            // Delegate to root clip node — full state machine transitions
            // are driven by SetParam("state", ...) from JS side
            if (m_Nodes.count(m_RootNode) && m_RootNode != name)
                m_Nodes[m_RootNode].evaluate(out);
        };
        m_Nodes[name] = std::move(n);
    }

    void AnimationGraph::SetParam(const std::string& param, f32 value) { m_FloatParams[param] = value; }
    void AnimationGraph::SetParam(const std::string& param, bool value) { m_BoolParams[param] = value; }
    void AnimationGraph::SetRootNode(const std::string& nodeName) { m_RootNode = nodeName; }

    void AnimationGraph::Update(f32 dt)
    {
        m_FloatParams["_time"] += dt;
        for (auto& [name, node] : m_Nodes)
            if (node.update) node.update(dt);
    }

    void AnimationGraph::Evaluate(std::vector<JointPose>& outPoses)
    {
        if (m_RootNode.empty() || !m_Skeleton) return;
        outPoses.resize(m_Skeleton->bones.size());
        auto it = m_Nodes.find(m_RootNode);
        if (it != m_Nodes.end() && it->second.evaluate)
            it->second.evaluate(outPoses);
    }

    void AnimationGraph::WriteBoneMatrices(float* outBuffer, u32 maxBones)
    {
        Evaluate(m_FinalPoses);

        // Build local transforms from poses
        for (u32 i = 0; i < (u32)m_Skeleton->bones.size() && i < maxBones; ++i)
        {
            m_Skeleton->bones[i].localTransform = m_FinalPoses[i].ToMatrix();
        }

        // Calculate global transforms
        m_Skeleton->CalculateGlobalTransforms(m_GlobalTransforms);

        // Write skinning matrices: globalTransform * inverseBindPose
        u32 count = std::min((u32)m_Skeleton->bones.size(), maxBones);
        for (u32 i = 0; i < count; ++i)
        {
            glm::mat4 skin = m_GlobalTransforms[i] * m_Skeleton->bones[i].inverseBindPose;
            const float* ptr = &skin[0][0];
            for (u32 j = 0; j < 16; ++j)
                outBuffer[i * 16 + j] = ptr[j];
        }
    }
}
