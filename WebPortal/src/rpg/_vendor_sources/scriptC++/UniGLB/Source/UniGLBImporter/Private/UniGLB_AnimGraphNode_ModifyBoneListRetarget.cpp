// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_AnimGraphNode_ModifyBoneListRetarget.h"
#include "Misc/EngineVersionComparison.h"
#include "UnrealWidget.h"
#include "AnimNodeEditModes.h"
#include "AnimationRuntime.h"
#include "Animation/AnimInstance.h"
#include "Kismet2/CompilerResultsLog.h"
#include "Components/SkeletalMeshComponent.h"
#include "UniGLB_MetaObject.h"
#include "UniGLB_Util.h"

/////////////////////////////////////////////////////
// UAnimGraphNode_ModifyBone

#define LOCTEXT_NAMESPACE "A3Nodesaaaa"
////////////////////


UAnimGraphNode_UniGLBModifyBoneListRetarget::UAnimGraphNode_UniGLBModifyBoneListRetarget(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	CurWidgetMode = UE::Widget::EWidgetMode::WM_Rotate;
}

void UAnimGraphNode_UniGLBModifyBoneListRetarget::ValidateAnimNodePostCompile(FCompilerResultsLog& MessageLog, UAnimBlueprintGeneratedClass* CompiledClass, int32 CompiledNodeIndex) {

	if (Node.UniGLBMetaObject == nullptr) {
		//MessageLog.Warning(*LOCTEXT("UniGLBNoMetaObject", "@@ - You must set UniGLBMetaObject").ToString(), this);
	} else {
		if (Node.UniGLBMetaObject->SkeletalMesh) {
			if (UniGLBGetSkeleton(Node.UniGLBMetaObject->SkeletalMesh) != CompiledClass->GetTargetSkeleton()) {
				MessageLog.Warning(*LOCTEXT("UniGLBDifferentSkeleton", "@@ - You must set UniGLBMetaObject has same skeleton").ToString(), this);
			}
		}
		if (CompiledClass->GetTargetSkeleton()->GetReferenceSkeleton().GetRawBoneNum() <= 0) {
			MessageLog.Warning(*LOCTEXT("UniGLBNoBone", "@@ - Skeleton bad data").ToString(), this);
		}
	}

	Super::ValidateAnimNodePostCompile(MessageLog, CompiledClass, CompiledNodeIndex);
}

void UAnimGraphNode_UniGLBModifyBoneListRetarget::ValidateAnimNodeDuringCompilation(USkeleton* ForSkeleton, FCompilerResultsLog& MessageLog)
{
	// Temporary fix where skeleton is not fully loaded during AnimBP compilation and thus virtual bone name check is invalid UE-39499 (NEED FIX) 
	if (ForSkeleton && !ForSkeleton->HasAnyFlags(RF_NeedPostLoad))
	{
		if (Node.UniGLBMetaObject == nullptr) {
			//MessageLog.Warning(*LOCTEXT("UniGLBNoMetaObject", "@@ - You must set UniGLBMetaObject").ToString(), this);
		} else {
			if (Node.UniGLBMetaObject->SkeletalMesh){
				if (UniGLBGetSkeleton(Node.UniGLBMetaObject->SkeletalMesh) != ForSkeleton) {
			//		MessageLog.Warning(*LOCTEXT("UniGLBDifferentSkeleton", "@@ - You must set UniGLBMetaObject has same skeleton").ToString(), this);
				}
			}
			if (ForSkeleton->GetReferenceSkeleton().GetRawBoneNum() <= 0) {
			//	MessageLog.Warning(*LOCTEXT("UniGLBNoBone", "@@ - Skeleton bad data").ToString(), this);
			}
		}


		/*
		//if (ForSkeleton->GetReferenceSkeleton().FindBoneIndex(Node.BoneToModify.BoneName) == INDEX_NONE)
		if (ForSkeleton->GetReferenceSkeleton().FindBoneIndex(Node.BoneNameToModify) == INDEX_NONE)
		{
			//if (Node.BoneToModify.BoneName == NAME_None)
			if (Node.BoneNameToModify == NAME_None)
			{
				MessageLog.Warning(*LOCTEXT("NoBoneSelectedToModify", "@@ - You must pick a bone to modify").ToString(), this);
			}
			else
			{
				FFormatNamedArguments Args;
				//Args.Add(TEXT("BoneName"), FText::FromName(Node.BoneToModify.BoneName));
				Args.Add(TEXT("BoneName"), FText::FromName(Node.BoneNameToModify));

				FText Msg = FText::Format(LOCTEXT("NoBoneFoundToModify", "@@ - Bone {BoneName} not found in Skeleton"), Args);

				MessageLog.Warning(*Msg.ToString(), this);
			}
		}
		*/
	}

	//if ((Node.TranslationMode == BMM_Ignore) && (Node.RotationMode == BMM_Ignore) && (Node.ScaleMode == BMM_Ignore))
	{
	//	MessageLog.Warning(*LOCTEXT("NothingToModify", "@@ - No components to modify selected.  Either Rotation, Translation, or Scale should be set to something other than Ignore").ToString(), this);
	}

	Super::ValidateAnimNodeDuringCompilation(ForSkeleton, MessageLog);
}

FText UAnimGraphNode_UniGLBModifyBoneListRetarget::GetControllerDescription() const
{
	return LOCTEXT("UniGLBModifyBoneListRetarget", "UniGLBModifyBoneListRetarget");
}

FText UAnimGraphNode_UniGLBModifyBoneListRetarget::GetTooltipText() const
{
	return LOCTEXT("AnimGraphNode_UniGLBModifyBoneListRetarget_Tooltip", "UniGLBModifyBoneListRetarget");
}

FText UAnimGraphNode_UniGLBModifyBoneListRetarget::GetNodeTitle(ENodeTitleType::Type TitleType) const
{
	//if ((TitleType == ENodeTitleType::ListView || TitleType == ENodeTitleType::MenuTitle) && (Node.BoneToModify.BoneName == NAME_None))
	//if ((TitleType == ENodeTitleType::ListView || TitleType == ENodeTitleType::MenuTitle) && (Node.BoneNameToModify == NAME_None))
	//{
		return GetControllerDescription();
	//}
	// @TODO: the bone can be altered in the property editor, so we have to 
	//        choose to mark this dirty when that happens for this to properly work
		/*
	else //if (!CachedNodeTitles.IsTitleCached(TitleType, this))
	{
		FFormatNamedArguments Args;
		Args.Add(TEXT("ControllerDescription"), GetControllerDescription());
		//Args.Add(TEXT("BoneName"), FText::FromName(Node.BoneToModify.BoneName));
		Args.Add(TEXT("BoneName"), FText::FromName(Node.BoneNameToModify));

		// FText::Format() is slow, so we cache this to save on performance
		if (TitleType == ENodeTitleType::ListView || TitleType == ENodeTitleType::MenuTitle)
		{
			CachedNodeTitles.SetCachedTitle(TitleType, FText::Format(LOCTEXT("AnimGraphNode_ModifyBone_ListTitle", "{ControllerDescription} - Bone: {BoneName}"), Args), this);
		}
		else
		{
			CachedNodeTitles.SetCachedTitle(TitleType, FText::Format(LOCTEXT("AnimGraphNode_ModifyBone_Title", "{ControllerDescription}\nBone: {BoneName}"), Args), this);
		}
	}
	return CachedNodeTitles[TitleType];
	*/
}

//void UAnimGraphNode_UniGLBModifyBoneListRetarget::CopyNodeDataToPreviewNode(FAnimNode_Base* InPreviewNode)
//{
//}

FEditorModeID UAnimGraphNode_UniGLBModifyBoneListRetarget::GetEditorMode() const
{
	return Super::GetEditorMode();
}

void UAnimGraphNode_UniGLBModifyBoneListRetarget::Draw(FPrimitiveDrawInterface* PDI, USkeletalMeshComponent * PreviewSkelMeshComp) const
{
	if (PreviewSkelMeshComp)
	{
		if (FAnimNode_UniGLBModifyBoneListRetarget* ActiveNode = GetActiveInstanceNode<FAnimNode_UniGLBModifyBoneListRetarget>(PreviewSkelMeshComp->GetAnimInstance()))
		{
			if (bPreviewLive) {
				//ActiveNode->ConditionalDebugDraw(PDI, PreviewSkelMeshComp, bPreviewForeground);
			}
		}
	}
}

#undef LOCTEXT_NAMESPACE
