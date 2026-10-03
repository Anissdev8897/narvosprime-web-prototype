#include "bridge/AnimationBridge.h"
#include <glm/gtc/type_ptr.hpp>
#include <algorithm>

namespace nv::bridge
{
    AnimationBridgeManager g_AnimBridge;

    // ── Skeleton ──────────────────────────────────────────────

    i32 AnimationBridgeManager::CreateSkeleton()
    {
        i32 id = m_NextSkelId++;
        m_Skeletons[id].skeleton = std::make_shared<Skeleton>();
        return id;
    }

    void AnimationBridgeManager::AddBone(i32 skelId, const std::string& name, i32 parentIdx,
                                          const float* invBindMatrix16)
    {
        auto it = m_Skeletons.find(skelId);
        if (it == m_Skeletons.end()) return;

        Bone bone;
        bone.name = name;
        bone.parentIndex = parentIdx;
        for (int i = 0; i < 16; ++i)
            (&bone.inverseBindPose[0][0])[i] = invBindMatrix16[i];

        it->second.skeleton->bones.push_back(std::move(bone));
    }

    void AnimationBridgeManager::FinalizeSkeleton(i32 skelId)
    {
        auto it = m_Skeletons.find(skelId);
        if (it == m_Skeletons.end()) return;

        auto& skel = *it->second.skeleton;
        skel.boneMap.clear();
        for (u32 i = 0; i < (u32)skel.bones.size(); ++i)
            skel.boneMap[skel.bones[i].name] = i;

        it->second.animator.SetSkeleton(it->second.skeleton);
    }

    u32 AnimationBridgeManager::GetBoneCount(i32 skelId) const
    {
        auto it = m_Skeletons.find(skelId);
        if (it == m_Skeletons.end()) return 0;
        return (u32)it->second.skeleton->bones.size();
    }

    // ── Clip ──────────────────────────────────────────────────

    i32 AnimationBridgeManager::CreateClip(i32 skelId, const std::string& name, f32 duration)
    {
        auto sit = m_Skeletons.find(skelId);
        if (sit == m_Skeletons.end()) return -1;

        i32 id = m_NextClipId++;
        ClipEntry& entry = m_Clips[id];
        entry.skelId = skelId;
        entry.clip.name = name;
        entry.clip.duration = duration;
        return id;
    }

    void AnimationBridgeManager::AddClipChannel(i32 clipId, const std::string& boneName,
                                                 const float* posTimes, const float* posVals, u32 posCount,
                                                 const float* rotTimes, const float* rotVals, u32 rotCount,
                                                 const float* scaleTimes, const float* scaleVals, u32 scaleCount)
    {
        auto it = m_Clips.find(clipId);
        if (it == m_Clips.end()) return;

        AnimationClip::Channel ch;
        ch.boneName = boneName;

        ch.posKeys.reserve(posCount);
        for (u32 i = 0; i < posCount; ++i)
            ch.posKeys.emplace_back(posTimes[i], glm::vec3(posVals[i*3], posVals[i*3+1], posVals[i*3+2]));

        ch.rotKeys.reserve(rotCount);
        for (u32 i = 0; i < rotCount; ++i)
            ch.rotKeys.emplace_back(rotTimes[i], glm::quat(rotVals[i*4+3], rotVals[i*4], rotVals[i*4+1], rotVals[i*4+2]));

        ch.scaleKeys.reserve(scaleCount);
        for (u32 i = 0; i < scaleCount; ++i)
            ch.scaleKeys.emplace_back(scaleTimes[i], glm::vec3(scaleVals[i*3], scaleVals[i*3+1], scaleVals[i*3+2]));

        it->second.clip.channels.push_back(std::move(ch));
    }

    // ── AnimGraph ─────────────────────────────────────────────

    i32 AnimationBridgeManager::CreateAnimGraph(i32 skelId)
    {
        auto sit = m_Skeletons.find(skelId);
        if (sit == m_Skeletons.end()) return -1;

        // Enregistre tous les clips associés à ce skeleton dans l'Animator
        for (auto& [clipId, entry] : m_Clips)
        {
            if (entry.skelId == skelId)
                sit->second.animator.AddClip(entry.clip);
        }

        i32 id = m_NextGraphId++;
        GraphEntry& g = m_Graphs[id];
        g.skelId = skelId;
        g.graph.Init(sit->second.skeleton, &sit->second.animator);
        return id;
    }

    void AnimationBridgeManager::AnimGraphAddClipNode(i32 graphId, const std::string& name,
                                                       const std::string& clipName, bool loop)
    {
        auto it = m_Graphs.find(graphId);
        if (it == m_Graphs.end()) return;
        it->second.graph.AddClipNode(name, clipName, loop);
    }

    void AnimationBridgeManager::AnimGraphAddBlend1DEntry(i32 graphId, const std::string& nodeName,
                                                           const std::string& param, f32 threshold,
                                                           const std::string& clipNodeName)
    {
        auto it = m_Graphs.find(graphId);
        if (it == m_Graphs.end()) return;

        auto& pending = it->second.pendingBlend1D[nodeName];
        pending.param = param;
        pending.clips.emplace_back(threshold, clipNodeName);
    }

    void AnimationBridgeManager::AnimGraphFinalizeBlend1D(i32 graphId, const std::string& nodeName)
    {
        auto it = m_Graphs.find(graphId);
        if (it == m_Graphs.end()) return;

        auto pit = it->second.pendingBlend1D.find(nodeName);
        if (pit == it->second.pendingBlend1D.end()) return;

        auto& p = pit->second;
        std::sort(p.clips.begin(), p.clips.end(),
                  [](auto& a, auto& b) { return a.first < b.first; });
        it->second.graph.AddBlend1DNode(nodeName, p.param, p.clips);

        it->second.pendingBlend1D.erase(pit);
    }

    void AnimationBridgeManager::AnimGraphSetParamFloat(i32 graphId, const std::string& param, f32 value)
    {
        auto it = m_Graphs.find(graphId);
        if (it == m_Graphs.end()) return;
        it->second.graph.SetParam(param, value);
    }

    void AnimationBridgeManager::AnimGraphSetParamBool(i32 graphId, const std::string& param, bool value)
    {
        auto it = m_Graphs.find(graphId);
        if (it == m_Graphs.end()) return;
        it->second.graph.SetParam(param, value);
    }

    void AnimationBridgeManager::AnimGraphSetRoot(i32 graphId, const std::string& nodeName)
    {
        auto it = m_Graphs.find(graphId);
        if (it == m_Graphs.end()) return;
        it->second.graph.SetRootNode(nodeName);
    }

    void AnimationBridgeManager::AnimGraphUpdate(i32 graphId, f32 dt)
    {
        auto it = m_Graphs.find(graphId);
        if (it == m_Graphs.end()) return;
        it->second.graph.Update(dt);
    }

    u32 AnimationBridgeManager::AnimGraphBoneCount(i32 graphId) const
    {
        auto it = m_Graphs.find(graphId);
        if (it == m_Graphs.end()) return 0;
        return it->second.graph.BoneCount();
    }

    u32 AnimationBridgeManager::AnimGraphWriteBones(i32 graphId, float* outBuffer, u32 maxBones)
    {
        auto it = m_Graphs.find(graphId);
        if (it == m_Graphs.end()) return 0;

        u32 count = it->second.graph.BoneCount();
        if (count == 0) return 0;
        u32 actual = std::min(count, maxBones);
        it->second.graph.WriteBoneMatrices(outBuffer, actual);
        return actual;
    }

    void AnimationBridgeManager::DestroyAnimGraph(i32 graphId)
    {
        m_Graphs.erase(graphId);
    }

    void AnimationBridgeManager::DestroySkeleton(i32 skelId)
    {
        m_Skeletons.erase(skelId);
        // Supprime aussi les clips et graphs associés
        for (auto it = m_Clips.begin(); it != m_Clips.end();)
        {
            if (it->second.skelId == skelId) it = m_Clips.erase(it);
            else ++it;
        }
        for (auto it = m_Graphs.begin(); it != m_Graphs.end();)
        {
            if (it->second.skelId == skelId) it = m_Graphs.erase(it);
            else ++it;
        }
    }

    void AnimationBridgeManager::Clear()
    {
        m_Skeletons.clear();
        m_Clips.clear();
        m_Graphs.clear();
    }
}
