// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_BPFunctionLibrary.h"
#include "Materials/MaterialInterface.h"
#include "TextureResource.h"

#include "Engine/Engine.h"
#include "Engine/TextureRenderTarget2D.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/Canvas.h"
#include "Engine/GameViewportClient.h"
#include "Logging/MessageLog.h"
#include "Materials/MaterialInstanceConstant.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Animation/MorphTarget.h"
#include "Misc/EngineVersionComparison.h"

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "AssetRegistry/AssetRegistryModule.h"
#include "AssetRegistry/ARFilter.h"
#include "AssetRegistry/AssetData.h"

#include "Components/SkeletalMeshComponent.h"
#include "Components/LightComponent.h"

#include "Rendering/SkeletalMeshLODModel.h"
#include "Rendering/SkeletalMeshLODRenderData.h"
#include "Rendering/SkeletalMeshRenderData.h"
#include "Rendering/SkeletalMeshModel.h"

#include "UniGLB_RigHeader.h"

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "RenderCounters.h"

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 5, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "Kismet/KismetRenderingLibrary.h"

// WITH_UNIGLB_MRQ_CORE is defined by UniGLB.Build.cs, set to 1 only when the MovieRenderPipelineCore
// module is actually present (MovieRenderPipeline plugin is "Optional" in UniGLB.uplugin, so a client
// project may disable it — the dependency and this macro must always agree).
#if WITH_UNIGLB_MRQ_CORE && PLATFORM_WINDOWS
#define UniGLB_USE_MRQ 1
#else
#define UniGLB_USE_MRQ 0
#endif


#if UniGLB_USE_MRQ
#include "MoviePipelineQueueSubsystem.h"
#endif


#include "Animation/AnimInstance.h"
#include "UniGLB_AnimInstanceCopy.h"
#include "UniGLB_Util.h"

#if PLATFORM_WINDOWS
#include "Engine/Engine.h"
#include "Engine/GameViewportClient.h"
#include "Widgets/SWindow.h"
#endif

#include "HAL/ConsoleManager.h"


#if WITH_EDITOR
#include "Editor.h"
#include "EditorViewportClient.h"
#include "EditorSupportDelegates.h"
#include "LevelEditorActions.h"
#include "Editor/EditorPerProjectUserSettings.h"
#include "AssetNotifications.h"
#endif

#include "Animation/AnimSequence.h"
#include "Kismet/GameplayStatics.h"

#if PLATFORM_WINDOWS
#include "Windows/AllowWindowsPlatformTypes.h"
#include <windows.h>
#include "Windows/HideWindowsPlatformTypes.h"
#endif

//#include "UniGLB.h"

void UUniGLBBPFunctionLibrary::UniGLBTransMatrix(const FTransform &transform, TArray<FLinearColor> &matrix, TArray<FLinearColor> &matrix_inv){

	FMatrix m = transform.ToMatrixWithScale();
	FMatrix mi = transform.ToMatrixWithScale().Inverse();

	matrix.SetNum(4);
	matrix_inv.SetNum(4);

	for (int i = 0; i < 4; ++i) {
		matrix[i] = FLinearColor(m.M[i][0], m.M[i][1], m.M[i][2], m.M[i][3]);
		matrix_inv[i] = FLinearColor(mi.M[i][0], mi.M[i][1], mi.M[i][2], mi.M[i][3]);
	}

	return;
}

void UUniGLBBPFunctionLibrary::UniGLBGetMorphTargetList(const USkeletalMesh *target, TArray<FString> &morphTargetList) {
	morphTargetList.Empty();

	if (target == nullptr) {
		return;
	}
	for (const auto &a : UniGLBGetMorphTargets(target)) {
		morphTargetList.Add(a->GetName());
	}
}

bool UUniGLBBPFunctionLibrary::UniGLBGetRefBoneTransform(const USkeleton *target, const FName boneName, FTransform &boneTransform){
	if (target == nullptr) {
		return false;
	}
	const FReferenceSkeleton& r = target->GetReferenceSkeleton();
	int i = r.FindBoneIndex(boneName);
	if (i < 0) {
		return false;
	}

	boneTransform = r.GetRefBonePose()[i];

	return true;
}

void UUniGLBBPFunctionLibrary::UniGLBGetHumanoidBoneNameList(TArray<FString> &boneNameListString, TArray<FName> &boneNameListName) {
	boneNameListString = UniGLBUtil::uniGLB_humanoid_bone_list;
	boneNameListName = UniGLBUtil::uniGLB_humanoid_bone_list_name;
}

void UUniGLBBPFunctionLibrary::UniGLBGetEpicSkeletonBoneNameList(TArray<FString>& boneNameListString, TArray<FName>& boneNameListName) {
	boneNameListString = UniGLBUtil::ue4_humanoid_bone_list;
	boneNameListName = UniGLBUtil::ue4_humanoid_bone_list_name;
}

void UUniGLBBPFunctionLibrary::UniGLBGetEpicSkeletonToHumanoid(TMap<FString, FString>& table) {
	table.Empty();
	for (auto &a : UniGLBUtil::table_ue4_vrm) {
		table.Add(a.BoneUE4, a.BoneVRM);
	}
}


bool UUniGLBBPFunctionLibrary::UniGLBGetHumanoidParentBone(const FName boneName, FName &parentBoneName) {

	int i = UniGLBUtil::uniGLB_humanoid_bone_list_name.Find(boneName);
	if (i < 0) {
		return false;
	}
	parentBoneName = *UniGLBUtil::uniGLB_humanoid_parent_list[i];

	if (parentBoneName.IsNone()) {
		return false;
	}

	return true;
}


void UUniGLBBPFunctionLibrary::UniGLBInitAnim(USkeletalMeshComponent *target) {
	if (target == nullptr) return;
	auto *anim_orig = target->GetAnimInstance();
	if (anim_orig == nullptr) return;

	auto *anim = Cast<UUniGLBAnimInstanceCopy>(anim_orig);
	if (anim == nullptr) {
		target->InitAnim(true);
		return;
	}

	auto *p = anim->GetProxy();
	if (p == nullptr) return;

	{
		bool b = p->bIgnoreVRMSwingBone;
		p->bIgnoreVRMSwingBone = true;

		target->InitAnim(true);

		p->bIgnoreVRMSwingBone = b;
	}

	//CalcBoneVertInfos
	//target->GetBoneTransform
}

void UUniGLBBPFunctionLibrary::UniGLBUpdateRefPose(USkeletalMeshComponent* target, bool bForceAlignGlobal, bool bForceUE4Humanoid) {
#if WITH_EDITOR
	if (target == nullptr) return;
	if (UniGLBGetSkinnedAsset(target) == nullptr) return;

	{
		auto *sk = UniGLBGetSkinnedAsset(target);
		auto *k = UniGLBGetSkeleton( UniGLBGetSkinnedAsset(target) );

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 23, 0)] (target floor (5, 7, 0)); kept #else branch only.
		const auto &transTable = target->GetBoneSpaceTransforms();

		TArray<FTransform> origGlobalTransform;
		TArray<FTransform> origGlobalTransformInv;
		TArray<FTransform> destGlobalTransform;

		TArray<FTransform> destGlobalAlignedTransform;
		TArray<FTransform> destLocalAlignedTransform;

		{
			const auto& refPose = k->GetReferenceSkeleton().GetRefBonePose();
			
			// orig all
			for (int boneNo = 0; boneNo < refPose.Num(); ++boneNo) {
				auto t = refPose[boneNo];
				int parent = k->GetReferenceSkeleton().GetParentIndex(boneNo);
				if (parent >= 0) {
					t *= origGlobalTransform[parent];
				}
				origGlobalTransform.Add(t);
			}

			//orig inv
			for (int i = 0; i < origGlobalTransform.Num(); ++i) {
				origGlobalTransformInv.Add(origGlobalTransform[i].Inverse());
			}
		}

		{
			// dest all
			for (int boneNo = 0; boneNo < transTable.Num(); ++boneNo) {
				auto t = transTable[boneNo];
				int parent = k->GetReferenceSkeleton().GetParentIndex(boneNo);
				if (parent >= 0) {
					t *= destGlobalTransform[parent];
				}
				destGlobalTransform.Add(t);

				{
					auto t2 = t;
					t2.SetRotation(FQuat::Identity);
					destGlobalAlignedTransform.Add(t2);
				}

				{
					FVector v = t.GetLocation();
					if (parent >= 0) {
						v -= destGlobalTransform[parent].GetLocation();
					}
					destLocalAlignedTransform.Add(FTransform(v));
				}
			}
		}

		{
			FReferenceSkeletonModifier RefSkelModifier(UniGLBGetRefSkeleton(sk), k);
			for (int i = 0; i < transTable.Num(); ++i) {
				if (bForceAlignGlobal) {
					auto t = transTable[i];
					t.SetRotation(FQuat::Identity);
					RefSkelModifier.UpdateRefPoseTransform(i, destLocalAlignedTransform[i]);
				} else {
					RefSkelModifier.UpdateRefPoseTransform(i, transTable[i]);
				}
			}
		}

		k->UpdateReferencePoseFromMesh(sk);
		FAssetNotifications::SkeletonNeedsToBeSaved(k);

		UniGLBSetRefSkeleton(sk, k->GetReferenceSkeleton());
		UniGLBGetRefSkeleton(sk).RebuildRefSkeleton(k, true);
		sk->CalculateInvRefMatrices();
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0)] (target floor (5, 7, 0)); kept #else branch only.
		sk->UpdateGenerateUpToData();

		k->RecreateBoneTree(sk);
		{
			TArray<FName> BonesToRemove;
			k->RemoveVirtualBones(BonesToRemove);
		}
		// skeleton end

		//vertex begin

		{
			FSkeletalMeshModel* ImportedResource = sk->GetImportedModel();
			if (ImportedResource->LODModels.Num() == 0)
				return;

			FSkeletalMeshLODModel* LODModel = &ImportedResource->LODModels[0];
			for (int32 SectionIndex = 0; SectionIndex < LODModel->Sections.Num(); SectionIndex++)
			{
				FSkelMeshSection& Section = LODModel->Sections[SectionIndex];

				FSkelMeshSection SectionOrg = Section;
				for (int32 i = 0; i < Section.SoftVertices.Num(); i++)
				{
					FSoftSkinVertex* SoftVert = &Section.SoftVertices[i];
					const FSoftSkinVertex* SoftVertOrg = &SectionOrg.SoftVertices[i];

					{
						for (int32 j = 0; j < MAX_TOTAL_INFLUENCES; j++)
						{
							if (SoftVert->InfluenceWeights[j] > 0)
							{
								int32 BoneIndex = Section.BoneMap[SoftVert->InfluenceBones[j]];
							}
						}
					}

					for (int32 j = 0; j < MAX_TOTAL_INFLUENCES; j++)
					{
						if (SoftVert->InfluenceWeights[j] > 0)
						{
							if (j == 0) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
								SoftVert->Position = FVector4f::Zero();
								SoftVert->TangentZ = FVector4f::Zero();
							}
							int32 BoneIndex = Section.BoneMap[SoftVert->InfluenceBones[j]];

							FVector p = origGlobalTransformInv[BoneIndex].TransformPosition(FVector(SoftVertOrg->Position));
							p = destGlobalTransform[BoneIndex].TransformPosition(p);



// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
							FVector n = origGlobalTransformInv[BoneIndex].TransformVector(FVector3d(SoftVertOrg->TangentZ));
							n = destGlobalTransform[BoneIndex].TransformVector(n);

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0), (5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
							SoftVert->Position += FVector3f(p * (float)SoftVert->InfluenceWeights[j] / 255.f);
							SoftVert->TangentZ += FVector4f(FVector3f(n * (float)SoftVert->InfluenceWeights[j] / 255.f), 1.f);
						}
					}
				}
			}
		}

		k->MarkPackageDirty();
		sk->MarkPackageDirty();

		k->PostEditChange();
		sk->PostEditChange();
	}
#endif
}


void UUniGLBBPFunctionLibrary::UniGLBGetMaterialPropertyOverrides(const UMaterialInterface *Material, TEnumAsByte<EBlendMode> &BlendMode, TEnumAsByte<EMaterialShadingModel> &ShadingModel, bool &IsTwoSided, bool &IsMasked){
	if (Material == nullptr) {
		return;
	}
	BlendMode		= Material->GetBlendMode();
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 23, 0)] (target floor (5, 7, 0)); kept #else branch only.
	ShadingModel = Material->GetShadingModels().GetFirstShadingModel();
	IsTwoSided		= Material->IsTwoSided();
	IsMasked		= Material->IsMasked();
}


void UUniGLBBPFunctionLibrary::UniGLBGetMobileMode(bool &IsMobile, bool &IsAndroid, bool &IsIOS) {
	IsMobile = false;
	IsAndroid = false;
	IsIOS = false;

#if PLATFORM_ANDROID
	IsMobile = true;
	IsAndroid = true;
#endif

#if PLATFORM_IOS
	IsMobile = true;
	IsIOS = true;
#endif

}



void UUniGLBBPFunctionLibrary::UniGLBDrawMaterialToRenderTarget(UObject* WorldContextObject, UTextureRenderTarget2D* TextureRenderTarget, UMaterialInterface* Material)
{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0), (4, 25, 0), (5, 5, 0)] (target floor (5, 7, 0)); kept #else branch only.
	// 5.5.0
	UKismetRenderingLibrary::DrawMaterialToRenderTarget(WorldContextObject, TextureRenderTarget, Material);
}

void UUniGLBBPFunctionLibrary::UniGLBUpdateTextureProperty(UTexture* Texture) {
	if (Texture == nullptr) return;

	Texture->UpdateResource();
#if WITH_EDITOR
	Texture->PostEditChange();
#endif
}

void UUniGLBBPFunctionLibrary::UniGLBChangeMaterialTexture(UMaterialInstanceConstant *dst, const FName texName, UTexture *texture) {
	bool bFound = false;

	for (auto &a : dst->TextureParameterValues) {
		if (a.ParameterInfo.Name != texName) {
			continue;
		}
		a.ParameterValue = texture;
		bFound = true;
		break;
	}

	if (bFound == false) {
		FTextureParameterValue *v = new (dst->TextureParameterValues) FTextureParameterValue();
		v->ParameterInfo.Index = INDEX_NONE;
		v->ParameterInfo.Name = texName;
		v->ParameterInfo.Association = EMaterialParameterAssociation::GlobalParameter;
		v->ParameterValue = texture;
		bFound = true;
	}

#if WITH_EDITOR
	if (bFound) {
		dst->MarkPackageDirty();
		dst->PreEditChange(NULL);
		dst->PostEditChange();
	}
#endif

}

void UUniGLBBPFunctionLibrary::UniGLBChangeMaterialParent(UMaterialInstanceConstant *dst, UMaterialInterface* NewParent, USkeletalMesh *UseSkeletalMesh) {
	if (dst == nullptr) {
		return;
	}

	if (dst->Parent == NewParent) {
		return;
	}
	dst->MarkPackageDirty();

	if (UseSkeletalMesh) {
		UseSkeletalMesh->MarkPackageDirty();
	}

#if WITH_EDITOR
	if (GIsEditor == false) {
		return;
	}

	dst->SetParentEditorOnly(NewParent);

	FMaterialUpdateContext UpdateContext(FMaterialUpdateContext::EOptions::Default, GMaxRHIShaderPlatform);
	UpdateContext.AddMaterialInstance(dst);

	dst->PreEditChange(NULL);
	dst->PostEditChange();

	// remove dynamic materials
	for (TObjectIterator<UMaterialInstanceDynamic> Itr; Itr; ++Itr) {
		if (Itr->Parent == dst) {
			Itr->ConditionalBeginDestroy();
		}
	}

#else
	dst->Parent = NewParent;
	dst->PostLoad();
#endif
}

// mat
#if WITH_EDITOR
namespace {
	static UMaterialInstanceConstant *LocalMaterialCache = nullptr;
}
#endif

void UUniGLBBPFunctionLibrary::UniGLBChangeMaterialSkipEditChange(UMaterialInstanceConstant *material, USkeletalMesh *UseSkeletalMesh, bool bSkip) {

#if WITH_EDITOR
	if (GIsEditor == false) {
		return;
	}
	if (material == nullptr) {
		return;
	}

	LocalMaterialCache = material;

	if (bSkip == false) {
		if (UseSkeletalMesh) {
			UseSkeletalMesh->PreEditChange(NULL);
		}
		material->PreEditChange(NULL);

	
		if (UseSkeletalMesh) {
			UseSkeletalMesh->PostEditChange();
		}
		material->PostEditChange();

		FMaterialUpdateContext UpdateContext(FMaterialUpdateContext::EOptions::Default, GMaxRHIShaderPlatform);
		UpdateContext.AddMaterialInstance(material);

		if (UseSkeletalMesh) {
			UseSkeletalMesh->MarkPackageDirty();
		}
		material->MarkPackageDirty();

		LocalMaterialCache = nullptr;
	}
#endif
}

void UUniGLBBPFunctionLibrary::UniGLBChangeMaterialShadingModel(UMaterialInstanceConstant *material, EMaterialShadingModel ShadingModel, bool bOverride, bool bForce) {
	if (material == nullptr) return;

#if WITH_EDITOR
	if (GIsEditor == false) {
		return;
	}

	bool bChange = bForce;

	if (bOverride) {
		const auto &p = material->Parent;

		if (p == nullptr) {
			bChange = true;
		} else {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 23, 0)] (target floor (5, 7, 0)); kept #else branch only.
			auto s = p->GetShadingModels().GetFirstShadingModel();

			if (s == ShadingModel) {
				bOverride = false;
			}
		}
	}
	{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 23, 0)] (target floor (5, 7, 0)); kept #else branch only.
		auto s = material->GetShadingModels().GetFirstShadingModel();

		bChange |= material->BasePropertyOverrides.bOverride_ShadingModel != bOverride;
		bChange |= s != ShadingModel;
	}


	if (bChange) {
		material->BasePropertyOverrides.bOverride_ShadingModel = bOverride;
		material->BasePropertyOverrides.ShadingModel = ShadingModel;

		if (LocalMaterialCache != material) {
			material->PreEditChange(NULL);
			material->PostEditChange();

			FMaterialUpdateContext UpdateContext(FMaterialUpdateContext::EOptions::Default, GMaxRHIShaderPlatform);
			UpdateContext.AddMaterialInstance(material);
			material->MarkPackageDirty();
		}
	}
#endif
}

void UUniGLBBPFunctionLibrary::UniGLBChangeMaterialBlendMode(UMaterialInstanceConstant *material, EBlendMode BlendMode, bool bOverride, bool bForce) {
	if (material == nullptr) return;

#if WITH_EDITOR
	if (GIsEditor == false) {
		return;
	}

	bool bChange = bForce;

	if (bOverride) {
		const auto& p = material->Parent;
		if (p == nullptr) {
			bChange = true;
		} else {
			if (p->GetBlendMode() == BlendMode) {
				bOverride = false;
			}
		}
	}


	bChange |= material->BasePropertyOverrides.bOverride_BlendMode != bOverride;
	bChange |= material->GetBlendMode() != BlendMode;


	if (bChange) {
		material->BasePropertyOverrides.bOverride_BlendMode = bOverride;
		material->BasePropertyOverrides.BlendMode = BlendMode;

		if (LocalMaterialCache != material) {

			material->PreEditChange(NULL);
			material->PostEditChange();

			FMaterialUpdateContext UpdateContext(FMaterialUpdateContext::EOptions::Default, GMaxRHIShaderPlatform);
			UpdateContext.AddMaterialInstance(material);
			material->MarkPackageDirty();
		}
	}
#endif
}

void UUniGLBBPFunctionLibrary::UniGLBChangeMaterialScalarParameter(UMaterialInstanceConstant *material, FName paramName, float param, bool bEnable) {
	if (material == nullptr) return;

#if WITH_EDITOR
	if (GIsEditor == false) {
		return;
	}

	FScalarParameterValue *v = nullptr;
	int i = -1;
	for (auto &a : material->ScalarParameterValues) {
		++i;
		if (a.ParameterInfo.Name == paramName) {
			v = &a;
			if (bEnable == false) {
				material->ScalarParameterValues.RemoveAt(i);

				{
					const auto a1 = material->ScalarParameterValues;
					const auto a2 = material->VectorParameterValues;
					const auto a3 = material->TextureParameterValues;
					const auto a4 = material->FontParameterValues;

					material->ClearParameterValuesEditorOnly();

					material->ScalarParameterValues = a1;
					material->VectorParameterValues = a2;
					material->TextureParameterValues = a3;
					material->FontParameterValues = a4;
				}

				if (LocalMaterialCache != material) {
					material->PreEditChange(NULL);
					material->PostEditChange();
				}
			}
			break;
		}
	}
	if (bEnable == false) {
		return;
	}
	if (v == nullptr) {
		v = new (material->ScalarParameterValues) FScalarParameterValue();
	}
	v->ParameterInfo.Index = INDEX_NONE;
	v->ParameterInfo.Name = paramName;
	v->ParameterInfo.Association = EMaterialParameterAssociation::GlobalParameter;
	v->ParameterValue = param;

	if (LocalMaterialCache != material) {
		material->PreEditChange(NULL);
		material->PostEditChange();
	}
#endif
}

void UUniGLBBPFunctionLibrary::UniGLBChangeMaterialVectorParameter(UMaterialInstanceConstant *material, FName paramName, FLinearColor param, bool bEnable) {
	if (material == nullptr) return;

#if WITH_EDITOR
	if (GIsEditor == false) {
		return;
	}

	FVectorParameterValue *v = nullptr;
	int i = -1;
	for (auto &a : material->VectorParameterValues) {
		++i;
		if (a.ParameterInfo.Name == paramName) {
			v = &a;
			if (bEnable == false) {
				material->VectorParameterValues.RemoveAt(i);

				{
					const auto a1 = material->ScalarParameterValues;
					const auto a2 = material->VectorParameterValues;
					const auto a3 = material->TextureParameterValues;
					const auto a4 = material->FontParameterValues;

					material->ClearParameterValuesEditorOnly();

					material->ScalarParameterValues = a1;
					material->VectorParameterValues = a2;
					material->TextureParameterValues = a3;
					material->FontParameterValues = a4;
				}

				if (LocalMaterialCache != material) {
					material->PreEditChange(NULL);
					material->PostEditChange();
				}
			}
			break;
		}
	}
	if (bEnable == false) {
		return;
	}
	if (v == nullptr) {
		v = new (material->VectorParameterValues) FVectorParameterValue();
	}
	v->ParameterInfo.Index = INDEX_NONE;
	v->ParameterInfo.Name = paramName;
	v->ParameterInfo.Association = EMaterialParameterAssociation::GlobalParameter;
	v->ParameterValue = param;

	if (LocalMaterialCache != material) {
		material->PreEditChange(NULL);
		material->PostEditChange();
	}
#endif
}

void UUniGLBBPFunctionLibrary::UniGLBChangeMaterialStaticSwitch(UMaterialInstanceConstant *material, FName paramName, bool bEnable) {
	if (material == nullptr) return;

#if WITH_EDITORONLY_DATA
	if (GIsEditor == false) {
		return;
	}

	TArray<FMaterialParameterInfo> OutParameterInfo;
	TArray<FGuid> OutParameterIds;
	material->GetAllStaticSwitchParameterInfo(OutParameterInfo, OutParameterIds);

	FStaticParameterSet paramSet;
	material->GetStaticParameterValues(paramSet);

	for (const auto &info : OutParameterInfo) {
		if (info.Name != paramName) continue;

		bool bDef = false;
		FGuid guid;
		material->GetStaticSwitchParameterDefaultValue(info, bDef, guid);


// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0), (5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
		auto& params = paramSet.StaticSwitchParameters;
		int i = 0;
		for (i = 0; i < params.Num(); ++i) {
			if (params[i].ParameterInfo.Name == info.Name) {
				break;
			}
		}
		if (i < 0 || i >= params.Num()) {
			// default.
			if (bDef == bEnable) {
				continue;
			}
			i = params.AddDefaulted(1);

			params[i].ParameterInfo = info;
		}
		if (i < 0) {
			continue;
		}

		if (bEnable == bDef) {
			params.RemoveAt(i);
			i = -1;
		} else {
			params[i].bOverride = true;
			params[i].Value = bEnable;
		}
	}

	// apply always. for remove params.
	//if (paramSet.StaticSwitchParameters.Num() <= 0) {
	//	return;
	//}

	// update

	material->UpdateStaticPermutation(paramSet);
	if (LocalMaterialCache != material) {
		material->PreEditChange(NULL);
		material->PostEditChange();
	}
#endif
}

void UUniGLBBPFunctionLibrary::UniGLBGetMaterialStaticSwitch(UMaterialInstance* material, FName paramName, bool& bHasParam, bool& bEnable) {

	bHasParam = false;
	bEnable = false;
	if (material == nullptr) return;

#if WITH_EDITORONLY_DATA
	if (GIsEditor == false) {
		return;
	}

	bool Value = false;
	FGuid ExpressionGuid;
	if (material->GetStaticSwitchParameterValue(paramName, Value, ExpressionGuid))
	{
		bHasParam = true;
		bEnable = Value;
		return;
	}
	return;
#endif
}



UObject* UUniGLBBPFunctionLibrary::UniGLBDuplicateAsset(UObject *src, FString name, UObject *thisOwner) {
	if (src == nullptr) {
		return nullptr;
	}
	if (thisOwner == nullptr) {
		return nullptr;
	}

	auto *a = DuplicateObject<UObject>(src, thisOwner->GetOuter(), *name);
	return a;
}


void UUniGLBBPFunctionLibrary::UniGLBSetMaterial(USkeletalMesh *target, int no, UMaterialInterface *material) {
	if (target == nullptr) {
		return;
	}
	if (no < UniGLBGetMaterials(target).Num()) {
		UniGLBGetMaterials(target)[no].MaterialInterface = material;
	}
}

void UUniGLBBPFunctionLibrary::UniGLBSetImportedBounds(USkeletalMesh *target, FVector min, FVector max) {
	if (target == nullptr) {
		return;
	}
	FBox BoundingBox(min, max);
	target->SetImportedBounds(FBoxSphereBounds(BoundingBox));
}

bool UUniGLBBPFunctionLibrary::UniGLBGetAssetsByPackageName(FName PackageName, TArray<FAssetData>& OutAssetData, bool bIncludeOnlyOnDiskAssets){

	OutAssetData.Empty();

	FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>(TEXT("AssetRegistry"));
	auto &AssetRegistry = AssetRegistryModule.Get();

	return AssetRegistry.GetAssetsByPackageName(PackageName, OutAssetData, bIncludeOnlyOnDiskAssets);
}

void UUniGLBBPFunctionLibrary::UniGLBSetIsDirty(UObject* obj) {
	if (obj == nullptr) return;
	obj->MarkPackageDirty();
}

UTextureRenderTarget2D* UUniGLBBPFunctionLibrary::UniGLBCreateRenderTarget2D(UObject* WorldContextObject, int32 Width, int32 Height, ETextureRenderTargetFormat Format, FLinearColor ClearColor)
{
	UWorld* World = GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::LogAndReturnNull);

	if (Width > 0 && Height > 0 && World)
	{
		UTextureRenderTarget2D* NewRenderTarget2D = NewObject<UTextureRenderTarget2D>(WorldContextObject);
		check(NewRenderTarget2D);
		NewRenderTarget2D->RenderTargetFormat = Format;
		NewRenderTarget2D->ClearColor = ClearColor;
		NewRenderTarget2D->InitAutoFormat(Width, Height);
		NewRenderTarget2D->UpdateResourceImmediate(true);

		return NewRenderTarget2D;
	}

	return nullptr;
}

bool UUniGLBBPFunctionLibrary::UniGLBRenderingThreadEnable(bool bEnable) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
	return true;
}

int UUniGLBBPFunctionLibrary::UniGLBGetMeshSectionNum(const USkeletalMesh* mesh) {
	if (mesh == nullptr) return 0;
	return mesh->GetResourceForRendering()->LODRenderData[0].RenderSections.Num();

/*
	FSkeletalMeshRenderData* SkelMeshRenderData = GetResourceForRendering();
	for (int32 LODIndex = MinLODIndex; LODIndex < SkelMeshRenderData->LODRenderData.Num(); LODIndex++)
	{
		FSkeletalMeshLODRenderData& LODRenderData = SkelMeshRenderData->LODRenderData[LODIndex];
		const FSkeletalMeshLODInfo& Info = *(GetLODInfo(LODIndex));

		// Check all render sections for the used material indices
		for (int32 SectionIndex = 0; SectionIndex < LODRenderData.RenderSections.Num(); SectionIndex++)
		{
			FSkelMeshRenderSection& RenderSection = LODRenderData.RenderSections[SectionIndex];

			// By default use the material index of the render section


*/
}

bool UUniGLBBPFunctionLibrary::UniGLBRemoveMeshSection(USkeletalMesh* mesh, int LODIndex, int SectionIndex) {
#if WITH_EDITOR
	if (mesh == nullptr) return false;

	if (mesh->GetResourceForRendering()->LODRenderData.IsValidIndex(LODIndex)) {

		mesh->RemoveMeshSection(LODIndex, SectionIndex);
		mesh->MarkPackageDirty();
		return true;
	}
#endif
	return false;
}


bool UUniGLBBPFunctionLibrary::UniGLBGetShadowEnable(const USkeletalMesh *mesh, int MaterialIndex) {

	if (mesh == nullptr) {
		return false;
	}
	if (mesh->GetResourceForRendering() == nullptr) {
		return false;
	}

	const FSkeletalMeshLODRenderData &rd = mesh->GetResourceForRendering()->LODRenderData[0];

	bool bShadow = false;

	for (const auto &a : rd.RenderSections) {
		if (a.MaterialIndex != MaterialIndex) continue;
		if (a.bDisabled) continue;

		if (a.NumVertices == 0) return false;
		if (a.NumTriangles == 0) return false;

		bShadow |= a.bCastShadow;
	}

	return bShadow;
}

void UUniGLBBPFunctionLibrary::UniGLBSetLightingChannelPrim(UPrimitiveComponent* prim, bool bChannel0, bool bChannel1, bool bChannel2) {
	if (prim == nullptr) {
		return;
	}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 25, 0)] (target floor (5, 7, 0)); kept #else branch only.
	prim->SetLightingChannels(bChannel0, bChannel1, bChannel2);
}

void UUniGLBBPFunctionLibrary::UniGLBSetLightingChannelLight(ULightComponent *light, bool bChannel0, bool bChannel1, bool bChannel2) {
	if (light == nullptr) {
		return;
	}
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 25, 0)] (target floor (5, 7, 0)); kept #else branch only.
	light->SetLightingChannels(bChannel0, bChannel1, bChannel2);
}

void UUniGLBBPFunctionLibrary::UniGLBSetCastRaytracedShadow(ULightComponent *light, bool bEnable){
	if (light == nullptr) {
		return;
	}
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 24, 0)] (target floor (5, 7, 0)); kept #else branch only.
	light->SetCastRaytracedShadow(bEnable);
}

void UUniGLBBPFunctionLibrary::UniGLBSetShadowSlopeBias(ULightComponent *light, float bias) {
	if (light == nullptr) {
		return;
	}
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 23, 0)] (target floor (5, 7, 0)); kept #else branch only.
	light->SetShadowSlopeBias(bias);
}

void UUniGLBBPFunctionLibrary::UniGLBSetSpecularScale(ULightComponent* light, float scale) {
	if (light == nullptr) {
		return;
	}
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 22, 0)] (target floor (5, 7, 0)); kept #else branch only.
	light->SetSpecularScale(scale);
}


bool UUniGLBBPFunctionLibrary::UniGLBGetCameraFilmback(UCineCameraComponent *c, FCameraFilmbackSettings &s) {
	if (c) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0), (4, 24, 0)] (target floor (5, 7, 0)); kept #else branch only.
		s = c->Filmback;
	
		return true;
	}
	return false;
}

bool UUniGLBBPFunctionLibrary::UniGLBSetCameraFilmback(UCineCameraComponent *c, const FCameraFilmbackSettings &s) {
	if (c) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0), (4, 24, 0)] (target floor (5, 7, 0)); kept #else branch only.
		c->Filmback= s;
		return true;
	}
	return false;
}

bool UUniGLBBPFunctionLibrary::UniGLBSetPostProcessSettingFromCineCamera(FPostProcessSettings &OutSettings, const FPostProcessSettings &InSettings, const UCineCameraComponent *CineCamera){
	if (CineCamera == nullptr) {
		return false;
	}

	OutSettings = InSettings;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0)] (target floor (5, 7, 0)); kept #else branch only.

	OutSettings.bOverride_DepthOfFieldFstop = true;
	OutSettings.DepthOfFieldFstop = CineCamera->CurrentAperture;

	OutSettings.bOverride_DepthOfFieldMinFstop = true;
	OutSettings.DepthOfFieldMinFstop = CineCamera->LensSettings.MinFStop;

	OutSettings.bOverride_DepthOfFieldBladeCount = true;
	OutSettings.DepthOfFieldBladeCount = CineCamera->LensSettings.DiaphragmBladeCount;

	OutSettings.bOverride_DepthOfFieldFocalDistance = true;
	OutSettings.DepthOfFieldFocalDistance = CineCamera->CurrentFocusDistance;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 24, 0)] (target floor (5, 7, 0)); kept #else branch only.
	OutSettings.bOverride_DepthOfFieldSensorWidth = true;
	OutSettings.DepthOfFieldSensorWidth = CineCamera->Filmback.SensorWidth;


	return true;
}

void UUniGLBBPFunctionLibrary::UniGLBSetPostProcessToneCurveAmount(FPostProcessSettings& OutSettings, const FPostProcessSettings& InSettings, bool bOverride, float Amount) {
	OutSettings = InSettings;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
	OutSettings.ToneCurveAmount = Amount;
	OutSettings.bOverride_ToneCurveAmount = bOverride;
}


void UUniGLBBPFunctionLibrary::UniGLBMakeCameraTrackingFocusSettings(AActor *ActorToTrack, FVector RelativeOffset, bool bDrawDebugTrackingFocusPoint, FCameraTrackingFocusSettings &Settings){
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0)] (target floor (5, 7, 0)); kept #else branch only.
	Settings.ActorToTrack = ActorToTrack;
	Settings.RelativeOffset = RelativeOffset;
	Settings.bDrawDebugTrackingFocusPoint = bDrawDebugTrackingFocusPoint;
}

void UUniGLBBPFunctionLibrary::UniGLBSetActorLabel(AActor *Actor, const FString& NewActorLabel) {
	if (Actor == nullptr) return;

#if WITH_EDITOR
	bool b1 = false;
	bool b2 = false;
	bool b3 = false;
	UniGLBGetPlayMode(b1, b2, b3);
	if (b1 == false) {
		Actor->SetActorLabel(NewActorLabel);
	}
#endif
}



void UUniGLBBPFunctionLibrary::UniGLBGetCameraTransform(const UObject* WorldContextObject, int32 PlayerIndex, bool bGameOnly, FTransform &transform, float &fovDegree) {

	bool bSet = false;
	transform.SetIdentity();
	fovDegree = 0;

	auto *c = UGameplayStatics::GetPlayerCameraManager(WorldContextObject, PlayerIndex);

#if WITH_EDITOR
	if (bGameOnly == false) {
		if (GEditor) {
			if (GEditor->bIsSimulatingInEditor || c==nullptr) {
				if (GEditor->GetActiveViewport()) {
					FEditorViewportClient* ViewportClient = StaticCast<FEditorViewportClient*>(GEditor->GetActiveViewport()->GetClient());
					if (ViewportClient) {
						if (ViewportClient->AspectRatio > 0.f) {
							const auto &a = ViewportClient->ViewTransformPerspective;
							transform.SetLocation(a.GetLocation());
							transform.SetRotation(a.GetRotation().Quaternion());
							fovDegree = ViewportClient->ViewFOV;
							bSet = true;
						}
					}
				}
			}
		}
	}
#endif
	if (bSet == false) {
		if (c) {
			transform.SetLocation(c->GetCameraLocation());
			transform.SetRotation(c->GetCameraRotation().Quaternion());
			fovDegree = c->GetFOVAngle();
		}
	}
}


void UUniGLBBPFunctionLibrary::UniGLBGetPlayMode(bool &bPlay, bool &bSIE, bool &bEditor) {
	bPlay = false;
	bSIE = false;
	bEditor = false;
#if WITH_EDITOR
	if (GEditor) {
		if (GEditor->bIsSimulatingInEditor) {
			bSIE = true;
		}
	}
	if (GIsEditor) {
		bEditor = true;
	}
	if (GIsEditor == false) {
		bPlay = true;
	}
	if (GEngine) {
		if (GEngine->GameViewport) {
			bPlay = true;
		}
	}

	if (GWorld) {
		if (GWorld->HasBegunPlay() && GWorld->IsGameWorld()) {
			bPlay = true;
		}
	}

#else
	bPlay = true;
#endif
}

bool UUniGLBBPFunctionLibrary::UniGLBGetAnimationAssetData(const UAnimationAsset *animAsset, USkeleton *&skeleton) {
	if (animAsset == nullptr) {
		return false;
	}
	skeleton = animAsset->GetSkeleton();

	return true;
}

namespace {
	bool setTransParent(bool bEnable, FLinearColor crKey) {
#if PLATFORM_WINDOWS
		if (GEngine == nullptr)					return false;
		if (GEngine->GameViewport == nullptr)	return false;
		if (GEngine->GameViewport->GetWindow().IsValid() == false) return false;
		if (GEngine->GameViewport->GetWindow()->GetNativeWindow().IsValid() == false) return false;

#if WITH_EDITOR
		if (GEditor == nullptr)  return false;
		if (GEditor->GetActiveViewport() == nullptr) return false;
		if (GEditor->GetActiveViewport()->GetClient() == GEngine->GameViewport) {
			// skip editor viewport for cpu load
			// editor style cannnot be restored
			return false;
		}
#endif
		HWND h = reinterpret_cast<HWND>(GEngine->GameViewport->GetWindow()->GetNativeWindow()->GetOSWindowHandle());

		if (h == nullptr) {
			return false;
		}

		{
			LONG lStyle = ::GetWindowLong(h, GWL_STYLE);
			LONG lexStyle = ::GetWindowLong(h, GWL_EXSTYLE);
			if (bEnable) {
				lStyle &= (~WS_BORDER);
				lStyle &= (~WS_THICKFRAME);
				lStyle &= (~WS_CAPTION);
				lStyle &= (~WS_OVERLAPPEDWINDOW);
				

				lexStyle |= WS_EX_LAYERED;
				//lexStyle &= (~WS_EX_WINDOWEDGE);
				//lexStyle &= (~WS_EX_CLIENTEDGE);
			} else {
				lStyle |= WS_BORDER;
				lStyle |= (WS_THICKFRAME);
				lStyle |= (WS_CAPTION);
				lStyle |= (WS_OVERLAPPEDWINDOW);

				lexStyle &= (~WS_EX_LAYERED);
				//lexStyle |= (WS_EX_WINDOWEDGE);
				//lexStyle |= (WS_EX_CLIENTEDGE);
			}
			//::SetWindowLong(h, GWL_STYLE, lStyle);
			::SetWindowLong(h, GWL_EXSTYLE, lexStyle);

			//SetWindowPos(h, NULL, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE |SWP_NOZORDER | SWP_FRAMECHANGED);
		}

		uint32_t cr = 0;
		cr |= ((int)(crKey.R*255.f) & 0xFF);
		cr |= ((int)(crKey.G*255.f) & 0xFF) << 8;
		cr |= ((int)(crKey.B*255.f) & 0xFF) << 16;

		uint8_t a = 0;
		a |= ((int)(crKey.A*255.f) & 0xFF);

		DWORD dwFlags = LWA_ALPHA;
		if (bEnable) {
			dwFlags = LWA_COLORKEY;
		} else {
			cr = 0;
			a = 255;
		}
		BOOL b = SetLayeredWindowAttributes(h, cr, a, dwFlags);
		return b != 0;
#else
		return false;
#endif
	}
	void setDefaultWindow(const bool) {
		setTransParent(false, FLinearColor(1, 1, 1, 1));
	}
}

bool UUniGLBBPFunctionLibrary::UniGLBSetTransparentWindow(bool bEnable, FLinearColor crKey) {
	bool ret = false;
#if PLATFORM_WINDOWS
	ret = setTransParent(bEnable, crKey);

#if WITH_EDITOR
	if (bEnable) {
		static bool bFirst = true;
		if (bFirst) {
			bFirst = false;
			FEditorDelegates::PrePIEEnded.AddStatic(&setDefaultWindow);
		}
	}
#endif

#endif
	return ret;
}

void UUniGLBBPFunctionLibrary::UniGLBExecuteConsoleCommand(UObject* WorldContextObject, const FString &cmd){
	if (cmd.IsEmpty()) {
		return;
	}

	UWorld* World = GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::LogAndReturnNull);
	if (World == nullptr) {
		return;
	}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 5, 0)] (target floor (5, 7, 0)); kept #else branch only.

	FOutputDevice& EffectiveOutputDevice = (FOutputDevice&)(*GLog);
	auto& ConsoleManager = IConsoleManager::Get();
	ConsoleManager.ProcessUserConsoleInput(&(cmd.GetCharArray()[0]), EffectiveOutputDevice, World);

}


bool UUniGLBBPFunctionLibrary::UniGLBAddTickPrerequisite(UActorComponent *dst, UActorComponent *src, bool bRemove) {
	if (dst == nullptr || src == nullptr) {
		return false;
	}

	if (bRemove == false) {
		dst->PrimaryComponentTick.AddPrerequisite(src, src->PrimaryComponentTick);
	} else {
		dst->PrimaryComponentTick.RemovePrerequisite(src, src->PrimaryComponentTick);
	}
	return true;
}

void UUniGLBBPFunctionLibrary::UniGLBAllowTranslucentSelection(bool bEnable) {
#if WITH_EDITOR
	{
		auto* Settings = GetMutableDefault<UEditorPerProjectUserSettings>();

		if (Settings == nullptr) {
			return;
		}
		if (Settings->bAllowSelectTranslucent == bEnable) {
			return;
		}

		FLevelEditorActionCallbacks::OnAllowTranslucentSelection();
	}
#endif

}


void UUniGLBBPFunctionLibrary::UniGLBSetWidgetMode(const EUniGLBWidgetMode mode) {
#if WITH_EDITOR
/*
	if (GEditor) {
		if (GEditor->GetActiveViewport()) {
			FEditorViewportClient* ViewportClient = StaticCast<FEditorViewportClient*>(GEditor->GetActiveViewport()->GetClient());
			if (ViewportClient) {
				FWidget::EWidgetMode tmp[] = {
					FWidget::WM_Translate,
					FWidget::WM_Rotate,
					FWidget::WM_Scale,
				};
				ViewportClient->SetWidgetMode(tmp[(int)mode]);
			}
		}
	}
	*/
#endif
}

/*
bool UUniGLBBPFunctionLibrary::UniGLBLiveLinkEvaluate(const FName Name, TArray<FName> & PropertyNames, TArray<float> & PropertyValues, int &FrameNo){
	const FLiveLinkSubjectName Subject(Name);
	PropertyNames.Empty();
	PropertyValues.Empty();
	FrameNo = 0;

	IModularFeatures& ModularFeatures = IModularFeatures::Get();
	if (ModularFeatures.IsModularFeatureAvailable(ILiveLinkClient::ModularFeatureName))
	{
		ILiveLinkClient& LiveLinkClient = ModularFeatures.GetModularFeature<ILiveLinkClient>(ILiveLinkClient::ModularFeatureName);
		FLiveLinkSubjectFrameData FrameData;

		//UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Live Link")
		TSubclassOf<ULiveLinkRole> Role = ULiveLinkBasicRole::StaticClass();

		if (LiveLinkClient.EvaluateFrame_AnyThread(Subject, Role, FrameData) == false) {
			return false;
		}

		{
			auto* p = FrameData.StaticData.GetBaseData();
			if (p) {
				PropertyNames = p->PropertyNames;
			}
		}
		{
			auto* p = FrameData.FrameData.GetBaseData();
			if (p) {
				PropertyValues = p->PropertyValues;
				FrameNo = p->MetaData.SceneTime.Time.GetFrame().Value;

			}
		}
		return true;
	}

	return false;
}
*/


void UUniGLBBPFunctionLibrary::UniGLBSetPostProcessSettingAO(FPostProcessSettings& OutSettings, const FPostProcessSettings& InSettings, bool bOverride, float AOIntensity, float Radius, bool bRayTracing){

	OutSettings = InSettings;

	FPostProcessSettings &o = OutSettings;

	o.AmbientOcclusionRadius = Radius;
	o.AmbientOcclusionIntensity = AOIntensity;
	o.bOverride_AmbientOcclusionRadius = bOverride;
	o.bOverride_AmbientOcclusionIntensity = bOverride;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 24, 0)] (target floor (5, 7, 0)); kept #else branch only.
	o.RayTracingAO = bRayTracing;
	o.bOverride_RayTracingAO = bOverride;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
	o.RayTracingAORadius = Radius;
	o.RayTracingAOIntensity = AOIntensity;
	o.bOverride_RayTracingAORadius = bOverride;
	o.bOverride_RayTracingAOIntensity = bOverride;
}


////

bool UUniGLBBPFunctionLibrary::UniGLBBakeAnim(const USkeletalMeshComponent* skc, const FString& FilePath2, const FString& AssetFileName2){
#if WITH_EDITOR
	if (skc == nullptr) {
		return false;
	}

	FString FilePath = FilePath2;
	FString AssetFileName = AssetFileName2;

	FString dummy[2] = {
		"/Game/",
		"tmpAnimSequence",
	};
	if (FilePath == "") {
		FilePath = dummy[0];
	}
	if (AssetFileName == "") {
		AssetFileName = dummy[1];
	}
	FilePath += TEXT("/");

	while (FilePath.Find(TEXT("//")) >= 0) {
		FilePath = FilePath.Replace(TEXT("//"), TEXT("/"));
	}

	while (AssetFileName.Find(TEXT("/")) >= 0) {
		AssetFileName = AssetFileName.Replace(TEXT("/"), TEXT(""));
	}

	USkeletalMesh* sk = UniGLBGetSkinnedAsset(skc);
	USkeleton* k = UniGLBGetSkeleton( UniGLBGetSkinnedAsset(skc) );

	//FString NewPackageName = "/Game/aaaa";
	FString NewPackageName = FilePath + AssetFileName;
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
	UPackage* Package = CreatePackage(*NewPackageName);

	UAnimSequence* ase;
	ase = NewObject<UAnimSequence>(Package, *(TEXT("A_") + AssetFileName), EObjectFlags::RF_Public | EObjectFlags::RF_Standalone);

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	ase->GetController().ResetModel();

	ase->SetSkeleton(k);

	float totalTime = 0.f;
	int totalFrameNum = 0;

	const auto componentTransInv = skc->GetComponentTransform().Inverse();

	for (int i = 0; i < k->GetRefLocalPoses().Num(); ++i) {
		FRawAnimSequenceTrack RawTrack;

		const auto BoneName = skc->GetBoneName(i);

		FTransform parentBoneInv = FTransform::Identity;
		if (i > 0) {
			const auto ParentBoneName = skc->GetParentBone(BoneName);
			const auto parentTrans = skc->GetBoneTransform(skc->GetBoneIndex(ParentBoneName));
			auto parentCompTrans = parentTrans * componentTransInv;

			//auto r = parentCompTrans.GetRotation();
			//r = FRotator(0, -90, 0).Quaternion() * r * FRotator(0, 90, 0).Quaternion();
			//parentCompTrans.SetRotation(r);

			parentBoneInv = parentCompTrans.Inverse();
			{

			}
		}

		{
			const auto refPose = UniGLBGetRefSkeleton(sk).GetRawRefBonePose()[i];
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
			RawTrack.PosKeys.Add(FVector3f(refPose.GetLocation()));

		}

		const auto srcTrans = skc->GetBoneTransform(i);
		auto compTrans = srcTrans * componentTransInv;
		{
			//auto r = compTrans.GetRotation();
			//r = FRotator(0, -90, 0).Quaternion() * r * FRotator(0, 90, 0).Quaternion();
			//compTrans.SetRotation(r);
		}
		const auto boneTrans = compTrans * parentBoneInv;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
		FQuat4f q(boneTrans.GetRotation());

		RawTrack.RotKeys.Add(q);

		//FVector s = srcTrans.GetScale3D();
		FVector s(1, 1, 1);
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
		RawTrack.ScaleKeys.Add(FVector3f(s));
		if (RawTrack.PosKeys.Num() == 0) {
			RawTrack.PosKeys.Add(FVector3f::ZeroVector);
		}
		if (RawTrack.RotKeys.Num() == 0) {
			RawTrack.RotKeys.Add(FQuat4f::Identity);
		}
		if (RawTrack.ScaleKeys.Num() == 0) {
			RawTrack.ScaleKeys.Add(FVector3f::OneVector);
		}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0), (5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
		ase->GetController().AddBoneCurve(BoneName);
		ase->GetController().SetBoneTrackKeys(BoneName, RawTrack.PosKeys, RawTrack.RotKeys, RawTrack.ScaleKeys);

		totalFrameNum = 1;
		totalTime = 1;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 22, 0), (5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
		ase->GetController().SetFrameRate(FFrameRate(totalFrameNum, 1));

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0), (5, 2, 0), (5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
		ase->GetController().SetNumberOfFrames(ase->GetController().ConvertSecondsToFrameNumber(totalTime));
		//ase->SetUseRawDataOnly(true);
		ase->FlagDependentAnimationsAsRawDataOnly();
		ase->UpdateDependentStreamingAnimations();


	}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0), (5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
		// todo

#endif // editor

	return true;
}


void UUniGLBBPFunctionLibrary::UniGLBGetAllActorsHasSceneComponent(const UObject* WorldContextObject, TSubclassOf<UObject> UObjectClass, TArray<AActor*>& OutActors){

	UWorld* World = GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::LogAndReturnNull);

	if (UObjectClass && World)
	{
		for (TObjectIterator<USceneComponent> it; it; ++it) {
			USceneComponent *c = *it;
			if (c->GetWorld() != World) continue;
			if (c->IsA(UObjectClass) == false) continue;
			

			auto a = c->GetOwner();
			if (a == nullptr) continue;
			if (IsValid(a) == false) continue;

			OutActors.AddUnique(a);
		}
	}
}

void UUniGLBBPFunctionLibrary::UniGLBGetRigNodeNameFromBoneName(const USkeleton* skeleton, const FName& boneName, FName& RigNodeName){
#if WITH_EDITOR
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
	RigNodeName = NAME_None;
#endif
}

void UUniGLBBPFunctionLibrary::UniGLBSetPerBoneMotionBlur(USkinnedMeshComponent* SkinnedMesh, bool bUsePerBoneMotionBlur) {
	if (SkinnedMesh == nullptr) return;

	SkinnedMesh->bPerBoneMotionBlur = bUsePerBoneMotionBlur;
}


//void UUniGLBBPFunctionLibrary::GetIKRigDefinition(UIKRetargeter, UIKRigDefinition*& src, UIKRigDefinition*& target) {
void UUniGLBBPFunctionLibrary::UniGLBGetIKRigDefinition(UObject *retargeter, UObject * &src, UObject * &target) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0), (5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
	UIKRetargeter* r = Cast<UIKRetargeter>(retargeter);
	if (r) {
		src = Cast<UIKRigDefinition>(r->GetIKRigWriteable(ERetargetSourceOrTarget::Source));
		target = Cast <UIKRigDefinition>(r->GetIKRigWriteable(ERetargetSourceOrTarget::Target));
	}
}

void UUniGLBBPFunctionLibrary::UniGLBGetPreviewMesh(UObject* target, USkeletalMesh*& mesh){
	if (target == nullptr) return;

	IInterface_PreviewMeshProvider *p = Cast<IInterface_PreviewMeshProvider>(target);
	if (p == nullptr) return;

	mesh = p->GetPreviewMesh();
}

void UUniGLBBPFunctionLibrary::UniGLBGetSkeletalMeshFromSkinnedMeshComponent(const USkinnedMeshComponent* target, USkeletalMesh*& skeletalmesh) {
	if (target == nullptr) {
		skeletalmesh = nullptr;
		return;
	}
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
	skeletalmesh = Cast<USkeletalMesh>(target->GetSkinnedAsset());
}

void UUniGLBBPFunctionLibrary::UniGLBGetTopLevelAssetName(const FAssetData& target, FName& AssetName) {
	AssetName = NAME_None;


// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
	AssetName = target.AssetClassPath.GetAssetName();

}


UUniGLBAssetListObject* UUniGLBBPFunctionLibrary::GetUniGLBAssetListObjectFromAsset(const UObject* Asset) {
	return UniGLBUtil::GetAssetListObjectAny(Asset);
}


bool UUniGLBBPFunctionLibrary::UniGLBIsMovieRendering() {
#if UniGLB_USE_MRQ
	if (GEditor) {
		UMoviePipelineQueueSubsystem* s = GEditor->GetEditorSubsystem<UMoviePipelineQueueSubsystem>();
		if (s == nullptr) return false;

		return s->IsRendering();
	}
#endif
	return false;
}

bool UUniGLBBPFunctionLibrary::UniGLBIsTemporaryObject(const UObject *obj) {
	if (obj == nullptr) return true;

	if (obj->HasAnyFlags(EObjectFlags::RF_Transient)) {
		return true;
	}
	return false;
}

bool UUniGLBBPFunctionLibrary::UniGLBIsEditorPreviewObject(const UObject* obj) {
	if (obj == nullptr) return true;

	const UWorld* World = obj->GetWorld();

	if (World == nullptr) return true;

	if (World->WorldType == EWorldType::EditorPreview)
	{
		return true;
	}

	return false;
}

void UUniGLBBPFunctionLibrary::UniGLBGetViewportSize(FIntPoint & ViewportSize, FIntPoint & BufferSize){

	ViewportSize = FIntPoint(0, 0);

#if WITH_EDITOR
	bool b1, b2, b3;
	UniGLBGetPlayMode(b1, b2, b3);

	bool bGameView = b1;
	if (b2) {
		bGameView = false;
	}

	if (GEditor == nullptr) bGameView = true;
	if (GEditor->GetActiveViewport() == nullptr) bGameView = true;

	if (bGameView == false) {
		ViewportSize = GEditor->GetActiveViewport()->GetRenderTargetTextureSizeXY();
		return;
	}
#endif

	if (GEngine == nullptr) return;
	if (GEngine->GameViewport == nullptr) return;
	if (GEngine->GameViewport->Viewport == nullptr) return;

	FViewport* Viewport = GEngine->GameViewport->Viewport;
	ViewportSize = Viewport->GetRenderTargetTextureSizeXY();

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
	BufferSize = GPixelRenderCounters.GetRenderResolution();

}


