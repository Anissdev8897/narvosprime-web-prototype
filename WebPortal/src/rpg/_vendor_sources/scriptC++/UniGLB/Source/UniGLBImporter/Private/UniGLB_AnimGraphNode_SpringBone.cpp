// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_AnimGraphNode_SpringBone.h"
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

const FEditorModeID FUniGLBSpringBoneEditMode::UniGLBSpringBone("AnimGraph.SkeletalControl.UniGLBSpringBone");

/*
void FUniGLBSpringBoneEditMode::EnterMode(class UAnimGraphNode_Base* InEditorNode, struct FAnimNode_Base* InRuntimeNode)
{
	RuntimeNode = static_cast<FAnimNode_UniGLBSpringBone*>(InRuntimeNode);
	GraphNode = CastChecked<UAnimGraphNode_UniGLBSpringBone>(InEditorNode);

	FAnimNodeEditMode::EnterMode(InEditorNode, InRuntimeNode);
}

void FUniGLBSpringBoneEditMode::ExitMode()
{
	RuntimeNode = nullptr;
	GraphNode = nullptr;

	FAnimNodeEditMode::ExitMode();
}

FVector FUniGLBSpringBoneEditMode::GetWidgetLocation() const
{
	//USkeletalMeshComponent* SkelComp = GetAnimPreviewScene().GetPreviewMeshComponent();

	//FBoneSocketTarget& Target = RuntimeNode->EffectorTarget;
	//FVector Location = RuntimeNode->EffectorTransform.GetLocation();
	//EBoneControlSpace Space = RuntimeNode->EffectorTransformSpace;
	FVector WidgetLoc;// = ConvertWidgetLocation(SkelComp, RuntimeNode->ForwardedPose, Target, Location, Space);
	return WidgetLoc;
}

FWidget::EWidgetMode FUniGLBSpringBoneEditMode::GetWidgetMode() const
{
	// allow translation all the time for effectot target
	return FWidget::WM_Translate;
}

void FUniGLBSpringBoneEditMode::DoTranslation(FVector& InTranslation)
{
	//USkeletalMeshComponent* SkelComp = GetAnimPreviewScene().GetPreviewMeshComponent();
	//FVector Offset = ConvertCSVectorToBoneSpace(SkelComp, InTranslation, RuntimeNode->ForwardedPose, RuntimeNode->EffectorTarget, RuntimeNode->EffectorTransformSpace);

	//RuntimeNode->EffectorTransform.AddToTranslation(Offset);
	//GraphNode->Node.EffectorTransform.SetTranslation(RuntimeNode->EffectorTransform.GetTranslation());
}
*/

////////////////////


UAnimGraphNode_UniGLBSpringBone::UAnimGraphNode_UniGLBSpringBone(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	CurWidgetMode = UE::Widget::EWidgetMode::WM_Rotate;
}

void UAnimGraphNode_UniGLBSpringBone::ValidateAnimNodePostCompile(FCompilerResultsLog& MessageLog, UAnimBlueprintGeneratedClass* CompiledClass, int32 CompiledNodeIndex) {

	if (Node.UniGLBMetaObject_Internal == nullptr) {
		//MessageLog.Warning(*LOCTEXT("UniGLBNoMetaObject", "@@ - You must set UniGLBMetaObject").ToString(), this);
	} else {
		auto *targetSkeleton = CompiledClass->GetTargetSkeleton();
		if (targetSkeleton) {
			if (Node.UniGLBMetaObject_Internal->SkeletalMesh) {
				if (UniGLBGetSkeleton(Node.UniGLBMetaObject_Internal->SkeletalMesh) != targetSkeleton) {
					MessageLog.Warning(*LOCTEXT("UniGLBDifferentSkeleton", "@@ - You must set UniGLBMetaObject has same skeleton").ToString(), this);
				}
			}
			if (targetSkeleton->GetReferenceSkeleton().GetRawBoneNum() <= 0) {
				MessageLog.Warning(*LOCTEXT("UniGLBNoBone", "@@ - Skeleton bad data").ToString(), this);
			}
		}
		else {
			//MessageLog.Warning(*LOCTEXT("UniGLBNoBone", "@@ - no target skeleton").ToString(), this);
		}
	}

	Super::ValidateAnimNodePostCompile(MessageLog, CompiledClass, CompiledNodeIndex);
}

void UAnimGraphNode_UniGLBSpringBone::ValidateAnimNodeDuringCompilation(USkeleton* ForSkeleton, FCompilerResultsLog& MessageLog)
{
	// Temporary fix where skeleton is not fully loaded during AnimBP compilation and thus virtual bone name check is invalid UE-39499 (NEED FIX) 
	if (ForSkeleton && !ForSkeleton->HasAnyFlags(RF_NeedPostLoad))
	{
		if (Node.UniGLBMetaObject_Internal == nullptr) {
			//MessageLog.Warning(*LOCTEXT("UniGLBNoMetaObject", "@@ - You must set UniGLBMetaObject").ToString(), this);
		} else {
			if (Node.UniGLBMetaObject_Internal->SkeletalMesh){
				if (UniGLBGetSkeleton(Node.UniGLBMetaObject_Internal->SkeletalMesh) != ForSkeleton) {
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

FText UAnimGraphNode_UniGLBSpringBone::GetControllerDescription() const
{
	if (Node.EnableAutoSearchMetaData) {
		return LOCTEXT("UniGLBSpringBone", "UniGLBSpringBone(auto)");
	}else {
		return LOCTEXT("UniGLBSpringBone", "UniGLBSpringBone");
	}
}

FText UAnimGraphNode_UniGLBSpringBone::GetTooltipText() const
{
	return LOCTEXT("AnimGraphNode_UniGLBSpringBone_Tooltip", "UniGLBCopyHandBone");
}

FText UAnimGraphNode_UniGLBSpringBone::GetNodeTitle(ENodeTitleType::Type TitleType) const
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

void UAnimGraphNode_UniGLBSpringBone::CopyNodeDataToPreviewNode(FAnimNode_Base* InPreviewNode)
{
	FAnimNode_UniGLBSpringBone* node = static_cast<FAnimNode_UniGLBSpringBone*>(InPreviewNode);

	// no copy
}

FEditorModeID UAnimGraphNode_UniGLBSpringBone::GetEditorMode() const
{
	return Super::GetEditorMode();
	//return FUniGLBSpringBoneEditMode::UniGLBSpringBone;
}

void UAnimGraphNode_UniGLBSpringBone::Draw(FPrimitiveDrawInterface* PDI, USkeletalMeshComponent * PreviewSkelMeshComp) const
{
	if (PreviewSkelMeshComp)
	{
		/*
		if (FAnimNode_UniGLBSpringBone* ActiveNode = GetActiveInstanceNode<FAnimNode_UniGLBSpringBone>(PreviewSkelMeshComp->GetAnimInstance()))
		{
			if (bPreviewLive) {
				ActiveNode->ConditionalDebugDraw(PDI, PreviewSkelMeshComp, bPreviewForeground);
			}
		}
		*/
		if (bPreviewLive) {
			Node.ConditionalDebugDraw(PDI, PreviewSkelMeshComp, bPreviewForeground);
		}
	}
}


void UAnimGraphNode_UniGLBSpringBone::CopyPinDefaultsToNodeData(UEdGraphPin* InPin)
{
	/*
	if (InPin->GetName() == GET_MEMBER_NAME_STRING_CHECKED(FAnimNode_ModifyBone, Translation))
	{
		GetDefaultValue(GET_MEMBER_NAME_STRING_CHECKED(FAnimNode_ModifyBone, Translation), Node.Translation);
	}
	else if (InPin->GetName() == GET_MEMBER_NAME_STRING_CHECKED(FAnimNode_ModifyBone, Rotation))
	{
		GetDefaultValue(GET_MEMBER_NAME_STRING_CHECKED(FAnimNode_ModifyBone, Rotation), Node.Rotation);
	}
	else if (InPin->GetName() == GET_MEMBER_NAME_STRING_CHECKED(FAnimNode_ModifyBone, Scale))
	{
		GetDefaultValue(GET_MEMBER_NAME_STRING_CHECKED(FAnimNode_ModifyBone, Scale), Node.Scale);
	}
	*/
}



#undef LOCTEXT_NAMESPACE
