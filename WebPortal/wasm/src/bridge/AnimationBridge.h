#pragma once
#include "core/Types.h"
#include "animation/Skeleton.h"
#include "animation/Animator.h"
#include "animation/AnimationGraph.h"
#include <memory>
#include <unordered_map>
#include <string>
#include <vector>

namespace nv::bridge
{
    // Gère des instances de Skeleton / Animator / AnimGraph par ID entier
    // pour exposition à JS via embind (pas de shared_ptr traversant la frontière).
    class AnimationBridgeManager
    {
    public:
        // ── Skeleton ──────────────────────────────────────────
        i32 CreateSkeleton();
        void AddBone(i32 skelId, const std::string& name, i32 parentIdx,
                     const float* invBindMatrix16);
        void FinalizeSkeleton(i32 skelId);
        u32  GetBoneCount(i32 skelId) const;

        // ── Clip ──────────────────────────────────────────────
        i32 CreateClip(i32 skelId, const std::string& name, f32 duration);
        void AddClipChannel(i32 clipId, const std::string& boneName,
                            const float* posTimes, const float* posVals, u32 posCount,
                            const float* rotTimes, const float* rotVals, u32 rotCount,
                            const float* scaleTimes, const float* scaleVals, u32 scaleCount);

        // ── AnimGraph ─────────────────────────────────────────
        i32  CreateAnimGraph(i32 skelId);
        void AnimGraphAddClipNode(i32 graphId, const std::string& name,
                                  const std::string& clipName, bool loop);
        void AnimGraphAddBlend1DEntry(i32 graphId, const std::string& nodeName,
                                      const std::string& param, f32 threshold,
                                      const std::string& clipNodeName);
        void AnimGraphFinalizeBlend1D(i32 graphId, const std::string& nodeName);
        void AnimGraphSetParamFloat(i32 graphId, const std::string& param, f32 value);
        void AnimGraphSetParamBool(i32 graphId, const std::string& param, bool value);
        void AnimGraphSetRoot(i32 graphId, const std::string& nodeName);
        void AnimGraphUpdate(i32 graphId, f32 dt);
        u32  AnimGraphBoneCount(i32 graphId) const;
        u32  AnimGraphWriteBones(i32 graphId, float* outBuffer, u32 maxBones);

        void DestroyAnimGraph(i32 graphId);
        void DestroySkeleton(i32 skelId);
        void Clear();

    private:
        struct SkeletonEntry {
            std::shared_ptr<Skeleton> skeleton;
            Animator animator;
        };

        struct Blend1DPending {
            std::string param;
            std::vector<std::pair<f32, std::string>> clips;
        };

        struct GraphEntry {
            i32 skelId = -1;
            AnimationGraph graph;
            std::unordered_map<std::string, Blend1DPending> pendingBlend1D;
        };

        struct ClipEntry {
            i32 skelId = -1;
            AnimationClip clip;
        };

        i32 m_NextSkelId = 1;
        i32 m_NextClipId = 1;
        i32 m_NextGraphId = 1;

        std::unordered_map<i32, SkeletonEntry> m_Skeletons;
        std::unordered_map<i32, ClipEntry>     m_Clips;
        std::unordered_map<i32, GraphEntry>    m_Graphs;
    };

    extern AnimationBridgeManager g_AnimBridge;
}
