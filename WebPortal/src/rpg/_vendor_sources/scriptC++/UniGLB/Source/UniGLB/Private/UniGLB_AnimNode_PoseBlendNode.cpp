// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.


#include "UniGLB_AnimNode_PoseBlendNode.h"
#include "AnimationRuntime.h"
#include "Animation/AnimInstanceProxy.h"
#include "Kismet/KismetSystemLibrary.h"
#include "DrawDebugHelpers.h"

#include "UniGLB_MetaObject.h"
#include "UniGLB_AssetListObject.h"
#include "UniGLB_Util.h"

#include <algorithm>
/////////////////////////////////////////////////////
// FAnimNode_ModifyBone


FAnimNode_UniGLBPoseBlendNode::FAnimNode_UniGLBPoseBlendNode() {
}

void FAnimNode_UniGLBPoseBlendNode::Initialize_AnyThread(const FAnimationInitializeContext& Context) {
	bCallInitialized = true;

	if (EnableAutoSearchMetaData) {
		auto v = UniGLBUtil::GetAssetListObject(UniGLBGetSkinnedAsset(Context.AnimInstanceProxy->GetSkelMeshComponent()));
		if (v) {
			PoseAsset = v->PoseFace;
			//SetPoseAsset(v->PoseFace);
		}
	}

	Super::Initialize_AnyThread(Context);
}

void FAnimNode_UniGLBPoseBlendNode::Evaluate_AnyThread(FPoseContext& Output) {
	Super::Evaluate_AnyThread(Output);

	if (bRemovePoseCurve) {
		auto* sk = UniGLBGetSkinnedAsset(Output.AnimInstanceProxy->GetSkelMeshComponent());



// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0), (5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
		auto& MorphList = sk->GetMorphTargets();
		TArray<FName> removeList;

		Output.Curve.ForEachElement([&removeList, &MorphList](const UE::Anim::FCurveElement& InCurveElement)
			{
				FString CurveElementName = InCurveElement.Name.ToString();
				auto* ind = MorphList.FindByPredicate([&CurveElementName](const TObjectPtr<UMorphTarget > morph) {
					if (CurveElementName.Compare(morph->GetName(), ESearchCase::IgnoreCase) == 0) return true;
					return false;
					});

				if (ind == nullptr) {
					removeList.Add(InCurveElement.Name);
				}
			});

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0), (5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
		for (auto a : removeList) {
			Output.Curve.InvalidateCurveWeight(a);
		}
	}
}
