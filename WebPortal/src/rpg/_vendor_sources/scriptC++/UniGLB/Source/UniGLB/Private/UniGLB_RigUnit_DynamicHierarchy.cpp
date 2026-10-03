// Copyright Epic Games, Inc. All Rights Reserved.


#include "UniGLB_RigUnit_DynamicHierarchy.h"
#include "Engine/SkeletalMesh.h"
#include "Rigs/RigHierarchyController.h"
#include "Units/RigUnitContext.h"
#include "ControlRig.h"
#include "Components/SkeletalMeshComponent.h"

#include "UniGLB_Util.h"
#include "UniGLB_AssetListObject.h"
#include "UniGLB_MetaObject.h"

//#include "Units/Execution/RigUnit_PrepareForExecution.h"

//#include UE_INLINE_GENERATED_CPP_BY_NAME(RigUnit_DynamicHierarchy)

FRigUnit_UniGLBInitControllerTransform_Execute() {

	const USkeletalMeshComponent* skc = ExecuteContext.UnitContext.DataSourceRegistry->RequestSource<USkeletalMeshComponent>(UControlRig::OwnerComponent);
	if (skc == nullptr) return;

	auto* sk = UniGLBGetSkeletalMeshAsset(skc);
	if (sk == nullptr) return;

	auto* k = sk->GetSkeleton();
	if (k == nullptr) return;


	URigHierarchyController* Controller = ExecuteContext.Hierarchy->GetController(true);
	if (Controller == nullptr) return;

	UUniGLBAssetListObject* assetList = UniGLBUtil::GetAssetListObject(sk);

	if (assetList == nullptr) return;
	//Controller->

	TArray<FRigControlElement*> controlList = ExecuteContext.Hierarchy->GetControls();
	TArray<FRigNullElement*> nullList = ExecuteContext.Hierarchy->GetNulls();
	//contollerList[0]->GetNameString();

	//ExecuteContext.Hierarchy->SetInitialGlobalTransform
	//Controller


	TMap<FRigElementKey, FTransform> elemInitTransformList;
	for (auto& table : UniGLBUtil::table_ue4_vrm) {

		auto* elem = nullList.FindByPredicate(
			[&table](FRigNullElement* e) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
				if (e->GetName().Compare(table.BoneUE4 + "_s") == 0) {
					return true;
				}
				return false;
			});

		if (elem == nullptr) continue;

		FRigElementKey bone;
		{
			const auto& assetBoneTable = assetList->UniGLBMetaObject->humanoidBoneTable;

			auto* str = assetBoneTable.Find(table.BoneVRM);
			if (str == nullptr) continue;

			bone.Type = ERigElementType::Bone;
			bone.Name = *(*str);
		}


		FRigElementKey a;
		a.Name = *(table.BoneUE4 + "_s");
		a.Type = ERigElementType::Null;


		auto index = k->GetReferenceSkeleton().FindBoneIndex(bone.Name);
		auto refPose = k->GetReferenceSkeleton().GetRefBonePose();

		elemInitTransformList.Add(a, refPose[index]);
	}

	for (auto& c : controlList) {
		//ExecuteContext.Hierarchy->SetInitialLocalTransform(c->GetKey(), FTransform::Identity);
		//ExecuteContext.Hierarchy->SetLocalTransform(c->GetKey(), FTransform::Identity);
	}
	for (auto& c : nullList) {
		auto *f = elemInitTransformList.Find(c->GetKey());
		if (f) {
			ExecuteContext.Hierarchy->SetInitialGlobalTransform(c->GetKey(), *f);
			ExecuteContext.Hierarchy->SetLocalTransform(c->GetKey(), *f);
		} else {
			ExecuteContext.Hierarchy->SetInitialLocalTransform(c->GetKey(), FTransform::Identity);
			ExecuteContext.Hierarchy->SetLocalTransform(c->GetKey(), FTransform::Identity);
		}
	}

}


FRigUnit_UniGLBGenerateBoneToControlTable_Execute()
{
	Items_MannequinBone.Empty();
	//Items_MannequinControl.Empty();
	Items_VRMBone.Empty();

	const USkeletalMeshComponent* skc = ExecuteContext.UnitContext.DataSourceRegistry->RequestSource<USkeletalMeshComponent>(UControlRig::OwnerComponent);
	if (skc == nullptr) return;

	auto* sk = UniGLBGetSkeletalMeshAsset(skc);
	if (sk == nullptr) return;

	auto* k = sk->GetSkeleton();
	if (k == nullptr) return;


	URigHierarchyController* Controller = ExecuteContext.Hierarchy->GetController(true);
	if (Controller == nullptr) return;

	UUniGLBAssetListObject *assetList = UniGLBUtil::GetAssetListObject(sk);

	if (assetList == nullptr) return;
	//Controller->

	TArray<FRigControlElement*> controllerList = ExecuteContext.Hierarchy->GetControls();
	//contollerList[0]->GetNameString();

	//ExecuteContext.Hierarchy->SetInitialGlobalTransform
	//Controller


	for (auto& table : UniGLBUtil::table_ue4_vrm) {

		auto* elem = controllerList.FindByPredicate(
			[&table](FRigControlElement* e) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
				if (e->GetName().Compare(table.BoneUE4 + "_c") == 0) {
					return true;
				}
				return false;
			});

		if (elem == nullptr) continue;

		FRigElementKey bone;
		{
			const auto& assetBoneTable = assetList->UniGLBMetaObject->humanoidBoneTable;

			auto* str = assetBoneTable.Find(table.BoneVRM);
			if (str == nullptr) continue;

			bone.Type = ERigElementType::Bone;
			bone.Name = *(*str);

			Items_VRMBone.Add(*(*str));
		}


		{
			FRigElementKey a;
			a.Name = *(table.BoneUE4);
			a.Type = ERigElementType::Control;
			Items_MannequinBone.Add(*(table.BoneUE4));
		}
		{
			FRigElementKey a;
			a.Name = *(table.BoneUE4 + "_c");
			a.Type = ERigElementType::Control;
			//Items_MannequinControl.Add(a);
		}
		//Items_VRMBone.Add(bone);
	}
}

FRigUnit_UniGLBGetCurveNameFromMesh_Execute() {
	FString ErrorMessage;

	Items_Curve.Reset();
	Items_Morph.Reset();

	const USkeletalMeshComponent* skc = ExecuteContext.UnitContext.DataSourceRegistry->RequestSource<USkeletalMeshComponent>(UControlRig::OwnerComponent);
	if (skc == nullptr) return;

	{
		auto* sk = skc->GetSkinnedAsset();
		auto* k = sk->GetSkeleton();
		auto morph = sk->GetMorphTargets();

		const FRigControlValue Value = FRigControlValue::Make<float>(0);
		const FTransform ShapeTransform;
		const FTransform OffsetTransform;

		for (auto& a : morph) {
			Items_Morph.Add(a.GetFName());
		}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
		k->ForEachCurveMetaData([&](const FName& InCurveName, const FCurveMetaData& InMetaData)
			{
				if (InMetaData.Type.bMorphtarget == true) {
					return;
				}
				Items_Curve.Add(InCurveName);
			});
	}

}

FRigUnit_UniGLBAddCurveFromMesh_Execute()
{
	FString ErrorMessage;

	Items_Curve.Reset();
	Items_Morph.Reset();

	const USkeletalMeshComponent* skc = ExecuteContext.UnitContext.DataSourceRegistry->RequestSource<USkeletalMeshComponent>(UControlRig::OwnerComponent);
	if (skc == nullptr) return;

	URigHierarchyController* Controller = ExecuteContext.Hierarchy->GetController(true);
	if (Controller == nullptr) return;

	FRigControlSettings ControlSettings;

	ControlSettings.ControlType = ERigControlType::Float;
	ControlSettings.PrimaryAxis = ERigControlAxis::X;

	ControlSettings.MinimumValue = FRigControlValue::Make<float>(0);
	ControlSettings.MaximumValue = FRigControlValue::Make<float>(1);

	ControlSettings.SetupLimitArrayForType(true, true, true);
	ControlSettings.SetVisible(false);

	FRigHierarchyControllerInstructionBracket InstructionBracket(Controller, ExecuteContext.GetInstructionIndex());

	{
		auto *sk = skc->GetSkinnedAsset();
		auto* k = sk->GetSkeleton();
		auto morph = sk->GetMorphTargets();

		const FRigControlValue Value = FRigControlValue::Make<float>(0);
		const FTransform ShapeTransform;
		const FTransform OffsetTransform;

		if (bIncludeMorphs) {
			auto root = Controller->AddNull(TEXT("UniGLB_Root_Morph"), FRigElementKey(), OffsetTransform);
			for (auto& a : morph) {
				FName n = *(Prefix + a.GetFName().ToString() + Suffix);
				Items_Morph.Add(Controller->AddControl(n, root, ControlSettings, Value, OffsetTransform, ShapeTransform, false, false));
			}
		}

		if (bIncludeCurves) {
			auto root = Controller->AddNull(TEXT("UniGLB_Root_Curve"), FRigElementKey(), OffsetTransform);

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
			k->ForEachCurveMetaData([&](const FName& InCurveName, const FCurveMetaData& InMetaData)
				{
					if (InMetaData.Type.bMorphtarget == true) {
						return;
					}
					FName n = *(Prefix + InCurveName.ToString() + Suffix);
					Items_Curve.Add(Controller->AddControl(n, root, ControlSettings, Value, OffsetTransform, ShapeTransform, false, false));
				});

		}
	}
}
