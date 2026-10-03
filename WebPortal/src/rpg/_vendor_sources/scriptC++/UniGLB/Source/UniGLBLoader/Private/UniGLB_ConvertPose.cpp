// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_ConvertRig.h"
#include "UniGLB_Convert.h"
#include "UniGLBAssimpScene.h"
#include "UniGLB_Util.h"

#include "UniGLB_AssetListObject.h"
#include "UniGLB_MetaObject.h"
#include "UniGLB_BPFunctionLibrary.h"

#include "Engine/SkeletalMesh.h"

#include "Animation/MorphTarget.h"
#include "Animation/NodeMappingContainer.h"
#include "Animation/PoseAsset.h"
#include "Animation/Skeleton.h"
#include "Animation/SkeletalMeshActor.h"
#include "Components/SkeletalMeshComponent.h"
#include "CommonFrameRates.h"
// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(5, 4, 0)] all below target floor (5, 7, 0)).


#if WITH_EDITOR
#include "IPersonaToolkit.h"
#include "PersonaModule.h"
#include "Modules/ModuleManager.h"
#include "Animation/DebugSkelMeshComponent.h"
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "Rigs/RigHierarchy.h"
#endif

#include <assimp/Importer.hpp>
#include <assimp/scene.h>
#include <assimp/mesh.h>
#include <assimp/postprocess.h>
#include <assimp/GltfMaterial.h>
#include <assimp/vrm/vrmmeta.h>

//#include "Engine/.h"

#if WITH_EDITOR

namespace {
	TSharedRef<IPersonaToolkit> LocalCreatePersonaToolkit(USkeletalMesh* sk) {

		FPersonaModule& PersonaModule = FModuleManager::LoadModuleChecked<FPersonaModule>("Persona");

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
		bool b = GIsGameThreadIdInitialized;
		//GIsGameThreadIdInitialized = false;
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.

		static auto f = [](const TSharedRef<IPersonaPreviewScene>& InPersonaPreviewScene) {
		};

		FPersonaToolkitArgs args;
		args.OnPreviewSceneCreated = FOnPreviewSceneCreated::FDelegate::CreateStatic(f);
		//args.OnPreviewSceneCreated = FOnPreviewSceneCreated::FDelegate::CreateSP(this, &FControlRigEditor::HandlePreviewSceneCreated);
		auto PersonaToolkit = PersonaModule.CreatePersonaToolkit(sk, args);

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
		//GIsGameThreadIdInitialized = b;
		return PersonaToolkit;
	}

	class AutoDestroy {
	public:
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
		TObjectPtr<AActor> actor;
		AutoDestroy(AActor* a) {
			actor = a;
		}
		~AutoDestroy() {
			if (actor) {
				actor->Destroy();
			}
		}
	};
}

#endif

namespace {
// utility function 
#if WITH_EDITOR
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
	FName GetUniquePoseName(USkeleton* Skeleton, const FString& Name, bool bFind = false)
	{
		if (Skeleton == nullptr) {
			return "";
		}

		if (bFind) {
			bool bSame = false;
			Skeleton->ForEachCurveMetaData([Name, &bSame](FName InCurveName, const FCurveMetaData& InMetaData)
			{
					if (InCurveName.ToString().ToLower() == Name.ToLower()) {
						bSame = true;

					}
			});
			if (bSame) {
				return *Name;
			}
		}

		int32 NameIndex = 0;
		FName NewName;

		do
		{
			NewName = FName(*FString::Printf(TEXT("%s_%d"), *Name, NameIndex++));

			if (NameIndex == 1) {
				NewName = *Name;
			}
		} while (Skeleton->AddCurveMetaData(NewName) == false);


		return NewName;
	}

#endif 

#if WITH_EDITOR
	static void localFaceMorphConv(UUniGLBAssetListObject* uniGLBAssetList, const aiScene* aiData) {
		// Native Manny/GASP and Universal restructure the skeleton afterwards (ProcessNativeMannyGASP
		// -> RecreateBoneTree), which invalidates these facial-expression assets (A_face AnimSequence
		// / POSE_face PoseAsset) built here against the pre-restructure skeleton. Their compression
		// then crashes on heavy skeletons (SkeletonToCompactPose.IsValidIndex ensure / "array index 0
		// into an array of size 0"). GASP does not use them, so skip their creation for those paths.
		if (UniGLBConverter::Options::Get().IsNativeMannyGASP() || UniGLBConverter::Options::Get().IsUniversalMannyGASP()) {
			return;
		}
		const TArray<FString> arkitMorphName = {
			// Left eye blend shapes
			TEXT("EyeBlinkLeft"),
			TEXT("EyeLookDownLeft"),
			TEXT("EyeLookInLeft"),
			TEXT("EyeLookOutLeft"),
			TEXT("EyeLookUpLeft"),
			TEXT("EyeSquintLeft"),
			TEXT("EyeWideLeft"),
			// Right eye blend shapes
			TEXT("EyeBlinkRight"),
			TEXT("EyeLookDownRight"),
			TEXT("EyeLookInRight"),
			TEXT("EyeLookOutRight"),
			TEXT("EyeLookUpRight"),
			TEXT("EyeSquintRight"),
			TEXT("EyeWideRight"),
			// Jaw blend shapes
			TEXT("JawForward"),
			TEXT("JawLeft"),
			TEXT("JawRight"),
			TEXT("JawOpen"),
			// Mouth blend shapes
			TEXT("MouthClose"),
			TEXT("MouthFunnel"),
			TEXT("MouthPucker"),
			TEXT("MouthLeft"),
			TEXT("MouthRight"),
			TEXT("MouthSmileLeft"),
			TEXT("MouthSmileRight"),
			TEXT("MouthFrownLeft"),
			TEXT("MouthFrownRight"),
			TEXT("MouthDimpleLeft"),
			TEXT("MouthDimpleRight"),
			TEXT("MouthStretchLeft"),
			TEXT("MouthStretchRight"),
			TEXT("MouthRollLower"),
			TEXT("MouthRollUpper"),
			TEXT("MouthShrugLower"),
			TEXT("MouthShrugUpper"),
			TEXT("MouthPressLeft"),
			TEXT("MouthPressRight"),
			TEXT("MouthLowerDownLeft"),
			TEXT("MouthLowerDownRight"),
			TEXT("MouthUpperUpLeft"),
			TEXT("MouthUpperUpRight"),
			// Brow blend shapes
			TEXT("BrowDownLeft"),
			TEXT("BrowDownRight"),
			TEXT("BrowInnerUp"),
			TEXT("BrowOuterUpLeft"),
			TEXT("BrowOuterUpRight"),
			// Cheek blend shapes
			TEXT("CheekPuff"),
			TEXT("CheekSquintLeft"),
			TEXT("CheekSquintRight"),
			// Nose blend shapes
			TEXT("NoseSneerLeft"),
			TEXT("NoseSneerRight"),
			TEXT("TongueOut"),
			// Treat the head rotation as curves for LiveLink support
			TEXT("HeadYaw"),
			TEXT("HeadPitch"),
			TEXT("HeadRoll"),
			// Treat eye rotation as curves for LiveLink support
			TEXT("LeftEyeYaw"),
			TEXT("LeftEyePitch"),
			TEXT("LeftEyeRoll"),
			TEXT("RightEyeYaw"),
			TEXT("RightEyePitch"),
			TEXT("RightEyeRoll"),
		};

		FString name = FString(TEXT("POSE_face_")) + uniGLBAssetList->BaseFileName;


		auto &sk = uniGLBAssetList->SkeletalMesh;
		auto *k = UniGLBGetSkeleton(sk);

		UPoseAsset* pose = nullptr;
		{
			pose = UniGLB_NewObject<UPoseAsset>(uniGLBAssetList->Package, *name, RF_Public | RF_Standalone);
			pose->SetSkeleton(k);
			pose->SetPreviewMesh(sk);
			pose->Modify();

			uniGLBAssetList->PoseFace = pose;
		}

		TArray<FString> MorphNameList;
		{
			for (uint32_t m = 0; m < aiData->mNumMeshes; ++m) {
				const aiMesh& aiM = *(aiData->mMeshes[m]);
				for (uint32_t a = 0; a < aiM.mNumAnimMeshes; ++a) {
					const aiAnimMesh& aiA = *(aiM.mAnimMeshes[a]);
					FString morphName = UTF8_TO_TCHAR(aiA.mName.C_Str());
					MorphNameList.AddUnique(morphName);
				}
			}
		}

		{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0), (5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
			USkeletalMeshComponent* skc = nullptr;
			//if (GWorld) {
				ASkeletalMeshActor* ska = GWorld->SpawnActor<ASkeletalMeshActor>(ASkeletalMeshActor::StaticClass(), FTransform::Identity);
				AutoDestroy autoDestroy(ska);
				skc = Cast<USkeletalMeshComponent>(ska->GetRootComponent());
				skc->SetSkeletalMeshAsset(sk);
			//}
			skc->SetComponentSpaceTransformsDoubleBuffering(false);
		}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
		TArray < FName > SmartNamePoseList;
		{
			auto n = GetUniquePoseName(k, TEXT("DefaultRefPose"), true);
			SmartNamePoseList.Add(n);
		}

		UAnimSequence* ase = nullptr;
		{
			/*
			auto LocalGetCurveData = [](UAnimSequence* ase) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
				return ase->GetCurveData();
			};
			*/


			FString AnimName = FString(TEXT("A_face_")) + uniGLBAssetList->BaseFileName;
			ase = UniGLB_NewObject<UAnimSequence>(uniGLBAssetList->Package, *AnimName, RF_Public | RF_Standalone);
			ase->SetSkeleton(k);

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0), (5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.

			IAnimationDataController& DataController = ase->GetController();
			IAnimationDataController::FScopedBracket ScopedBracket(&DataController, FText());

			DataController.ResetModel();
			DataController.InitializeModel();
			DataController.NotifyPopulated();

			FFrameRate f(1, 1);
			DataController.SetFrameRate(f);
			//DataController.SetFrameRate(FCommonFrameRates::FPS_30());
			DataController.SetNumberOfFrames(10);

			DataController.UpdateWithSkeleton(k);

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0), (5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
			auto GetCurves = [&DataController]() {
				return DataController.GetModel()->GetFloatCurves();
			};

			auto GetCurveName = [](FFloatCurve& c) {
				return c.GetName();
			};
			auto GetCurveSmartName = [](FFloatCurve& c) {
				return c.GetName();
			};
			// arkit blendshape
			for (auto& arkitMorph : arkitMorphName) {

				int no = MorphNameList.Find(arkitMorph);

				FString modelMorph;
				if (no >= 0) {
					modelMorph = arkitMorph;
				} else {
					auto ar = arkitMorph.ToLower();
					FString* find_s = MorphNameList.FindByPredicate(
						[&ar, &modelMorph](const FString& str) {
						//
						auto s = str.ToLower();
						if (s == ar) {
							modelMorph = str;
							return true;
						}
						FString tmp;
						tmp = ar.Replace(TEXT("Left"), TEXT("_L")).ToLower();
						if (s == tmp) {
							modelMorph = str;
							return true;
						}
						tmp = ar.Replace(TEXT("Right"), TEXT("_R")).ToLower();
						if (s == tmp) {
							modelMorph = str;
							return true;
						}
						return false;
					}
					);
					if (find_s) {
						no = MorphNameList.Find(*find_s);
					}
				}
				// no morph. add no weight curve
				//if (no < 0) {
				//	continue;
				//}

				auto SmartPoseName = GetUniquePoseName(k, *arkitMorph, true);
				auto curveName = GetUniquePoseName(nullptr, "");

				int targetNo = 0;
				bool bSameName = false;
				if (arkitMorph == modelMorph) {
					// same name. no curve weight
					curveName = SmartPoseName;
					bSameName = true;
				} else if (modelMorph == "") {
					// no morph. norcurve weight
					curveName = SmartPoseName;
					bSameName = true;
				} else {
					bool bFind = false;
					for (decltype(auto) c : GetCurves()) {
						if (GetCurveName(c).ToString().ToLower() == modelMorph.ToLower()) {
							// found curve in list
							bFind = true;
							curveName = GetCurveSmartName(c);
							break;
						}
						++targetNo;
					}
					if (bFind == false) {
						// create new curve
						curveName = GetUniquePoseName(k, *modelMorph, true);
						targetNo = GetCurves().Num();
					}
				}
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
				FAnimationCurveIdentifier id(curveName, ERawCurveTrackTypes::RCT_Float);
				DataController.AddCurve(id);

				// Anim to Pose
				if (bSameName == false) {
					decltype(auto) c = GetCurves();
					auto& a = c[targetNo];

					a.SetCurveTypeFlag(AACF_Editable, true);

					// for default +1
					int targetFrame = GetCurves().Num() + 1;

					// 0 for prev and forward frame
					if (a.Evaluate(targetFrame - 2) == 0) {
						a.UpdateOrAddKey(0, targetFrame - 2);
					}
					if (a.Evaluate(targetFrame + 0) == 0) {
						a.UpdateOrAddKey(0, targetFrame + 0);
					}
					a.UpdateOrAddKey(1, targetFrame - 1);

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
					FAnimationCurveIdentifier CurveId(curveName, ERawCurveTrackTypes::RCT_Float);
					DataController.AddCurve(CurveId);
					DataController.SetCurveKeys(CurveId, a.FloatCurve.GetConstRefOfKeys());
				}
				auto newName = SmartPoseName;
				SmartNamePoseList.Add(newName);
			}


			// vrm blendshape
			{
				// for add and offset
				int targetFrame = GetCurves().Num() + 1 + 1;

				for (auto& group : uniGLBAssetList->UniGLBMetaObject->BlendShapeGroup) {

					if (group.name == "") continue;
					if (group.BlendShape.Num() == 0) continue;

					auto SmartPoseName = GetUniquePoseName(k, *group.name, true);

					// !! vrm blend shape !!
					bool addCurve = false;
					for (auto& shape : group.BlendShape) {
						if (shape.morphTargetName == "") continue;

						auto curveName = GetUniquePoseName(nullptr, "");
						int targetNo = 0;

						bool bSameName = false;
						if (group.name.ToLower() == shape.morphTargetName.ToLower()) {
							// same name
							curveName = SmartPoseName;
							bSameName = true;
						} else {
							bool bFind = false;
							for (decltype(auto) c : GetCurves()) {
								if (GetCurveName(c).ToString().ToLower() == shape.morphTargetName.ToLower()) {
									// found curve name in list
									bFind = true;
									curveName = GetCurveSmartName(c);
									break;
								}
								++targetNo;
							}
							if (bFind == false) {
								// create new curve
								curveName = GetUniquePoseName(k, *shape.morphTargetName, true);
								targetNo = GetCurves().Num();
							}
						}
						{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.

							// Poseで登録しようとする名前と 同じMorphがある場合はスキップ
							auto& MorphList = sk->GetMorphTargets();
							auto* ind = MorphList.FindByPredicate([&SmartPoseName](const TObjectPtr<UMorphTarget > morph) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
								if (morph->GetName().Compare(SmartPoseName.ToString())) return false;
								return true;
								});
							if (ind) {
								bSameName = true;
							}
						}

						{
							// DisplayName check
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
							FName n = UniGLBUtil::GetSanitizedName(curveName.ToString());
							if (n == NAME_None) {
								continue;
							}
						}
						

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
						FAnimationCurveIdentifier id(curveName, ERawCurveTrackTypes::RCT_Float);
						DataController.AddCurve(id);

						if (bSameName == false) {
							decltype(auto) c = GetCurves();
							auto& a = c[targetNo];

							a.SetCurveTypeFlag(AACF_Editable, true);

							// 0 for prev and forward frame
							if (a.Evaluate(targetFrame - 2) == 0) {
								a.UpdateOrAddKey(0, targetFrame - 2);
							}
							if (a.Evaluate(targetFrame + 0) == 0) {
								a.UpdateOrAddKey(0, targetFrame + 0);
							}
							a.UpdateOrAddKey((float)(shape.weight) / 100.f, targetFrame - 1);

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
							FAnimationCurveIdentifier CurveId(curveName, ERawCurveTrackTypes::RCT_Float);
							//DataController.AddCurve(CurveId);
							DataController.SetCurveKeys(CurveId, a.FloatCurve.GetConstRefOfKeys());
						}
						addCurve = true;
					}

					if (addCurve) {
						// new pose
						SmartNamePoseList.Add(SmartPoseName);
						targetFrame += 1;
					}
				}
			}

			// support arkit from vrm
			{
				TArray<FString> BlendFrom = {
					TEXT("EyeBlinkLeft"),
					TEXT("EyeBlinkRight"),
					TEXT("JawOpen"),
				};
				TArray<FString> BlendTo = {
					TEXT("Blink_L"),
					TEXT("Blink_R"),
					TEXT("A"),
				};
				for (auto& arkitMorph : arkitMorphName) {
					int tableNo = BlendFrom.Find(arkitMorph);
					if (tableNo < 0) {
						continue;
					}
					const FString uniGLBMorph = BlendTo[tableNo];

					// arkit MorphName check
					{
						FString* s = MorphNameList.FindByPredicate(
							[&arkitMorph](const FString& str) {
							return (arkitMorph.ToLower() == str.ToLower());
						});
						if (s) {
							// has same arkit morph name
							continue;
						}
					}

					int arMorphFrameNo = -1;
					{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
						FName* m = SmartNamePoseList.FindByPredicate(
							[&arkitMorph](FName& name) {
								return (arkitMorph.ToLower() == name.ToString().ToLower());
							});
						if (m == nullptr) continue;
						arMorphFrameNo = SmartNamePoseList.Find(*m);
					}
					int uniGLBMorphFrameNo = -1;
					{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
						FName* m = SmartNamePoseList.FindByPredicate(
							[&uniGLBMorph](FName& name) {
								return (uniGLBMorph.ToLower() == name.ToString().ToLower());
							});
						if (m == nullptr) continue;
						uniGLBMorphFrameNo = SmartNamePoseList.Find(*m);
					}

					decltype(auto) curves = GetCurves();
					if (curves.Num() <= arMorphFrameNo || curves.Num() <= uniGLBMorphFrameNo) {
						// range check
						continue;
					}

					bool bHasCurve = false;
					for (auto& c : curves) {
						if (c.Evaluate(arMorphFrameNo) >= 0.5f) {
							bHasCurve = true;
							break;
						}
					}
					if (bHasCurve == true) {
						// has armorph value
						continue;
					}

					for (auto& c : curves) {
						if (c.Evaluate(arMorphFrameNo) == c.Evaluate(uniGLBMorphFrameNo)) {
							continue;
						}

						// 0 for prev and forward frame
						if (c.Evaluate(arMorphFrameNo - 1) == 0) {
							c.UpdateOrAddKey(0, arMorphFrameNo - 1);
						}
						if (c.Evaluate(arMorphFrameNo + 1) == 0) {
							c.UpdateOrAddKey(0, arMorphFrameNo + 1);
						}
						c.UpdateOrAddKey(c.Evaluate(uniGLBMorphFrameNo), arMorphFrameNo);
					}
				}
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
				//FAnimationCurveIdentifier CurveId(curveName, ERawCurveTrackTypes::RCT_Float);
				//DataController.AddCurve(CurveId);
				//DataController.SetCurveKeys(CurveId, a.FloatCurve.GetConstRefOfKeys());

			}


// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(4, 22, 0), (5, 0, 0)] all below target floor (5, 7, 0)).

			ase->RateScale = 24.f;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0), (5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
			{
				//DataController.InitializeModel();
				FFrameRate ff(1, 1); 
				//DataController.SetFrameRate(FCommonFrameRates::FPS_30());
				DataController.SetFrameRate(ff);
				DataController.SetNumberOfFrames(SmartNamePoseList.Num() - 1);

				ase->SetPreviewMesh(sk);

// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(5, 3, 0)] all below target floor (5, 7, 0)).
				DataController.NotifyPopulated();
			}
		}

		if (SmartNamePoseList.Num() > 0) {
			pose->CreatePoseFromAnimation(ase, &SmartNamePoseList);
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
			pose->UpdatePoseFromAnimation(ase);
			// for additive
			pose->ConvertSpace(false, 0);
			pose->ConvertSpace(true, 0);

		}
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
		ase->PostEditChange();

	} // AnimSequence



#endif
}// namespace


bool UniGLBConverter::ConvertPose(UUniGLBAssetListObject *uniGLBAssetList) {

	if (UniGLBConverter::Options::Get().IsDebugOneBone() || UniGLBConverter::Options::Get().IsSkipRetargeter()) {
		return true;
	}

	if (uniGLBAssetList->SkeletalMesh == nullptr) {
		return false;
	}

	bool bPlay = false;
	{
		bool b1, b2, b3;
		b1 = b2 = b3 = false;
		UUniGLBBPFunctionLibrary::UniGLBGetPlayMode(b1, b2, b3);
		bPlay = b1 || b2;
	}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0)] (target floor (5, 7, 0)); kept #else branch only.
#if WITH_EDITOR

	// pose asset
	if (bPlay==false){
		USkeletalMesh *sk = uniGLBAssetList->SkeletalMesh;
		USkeleton* k = UniGLBGetSkeleton(sk);

		FString name = FString(TEXT("POSE_retarget_")) + uniGLBAssetList->BaseFileName;
		
		UPoseAsset *pose = nullptr;

		//if (UniGLBConverter::Options::Get().IsSingleUAssetFile()) {
			pose = UniGLB_NewObject<UPoseAsset>(uniGLBAssetList->Package, *name, RF_Public | RF_Standalone);

			uniGLBAssetList->PoseBody = pose;
		//} else {
		//	FString originalPath = uniGLBAssetList->Package->GetPathName();
		//	const FString PackagePath = FPaths::GetPath(originalPath);

		//	FString NewPackageName = FPaths::Combine(*PackagePath, *name);
		//	UPackage* Pkg = CreatePackage(nullptr, *NewPackageName);

		//	pose = UniGLB_NewObject<UPoseAsset>(Pkg, *name, RF_Public | RF_Standalone);
		//}



		pose->SetSkeleton(k);
		pose->SetPreviewMesh(sk);
		pose->Modify();

		{
			/*
			type 0:
				poseasset +1: T-pose,
			type 1:
				poseasset +1: A-pose,
				retarget +1 : T-pose or A-pose
			type 2:
				poseasset +1: T-pose(footA)
			type 3:
				poseasset +1: A-pose(footT)
			*/
			enum class PoseType {
				TYPE_T,
				TYPE_A,
			};
			PoseType poseType_hand;
			PoseType poseType_foot;
			for (int poseCount = 0; poseCount < 4; ++poseCount) {

				switch (poseCount) {
				case 0:
					poseType_hand = PoseType::TYPE_T;
					poseType_foot = PoseType::TYPE_T;
					break;
				case 1:
					poseType_hand = PoseType::TYPE_A;
					poseType_foot = PoseType::TYPE_A;
					break;
				case 2:
					poseType_hand = PoseType::TYPE_T;
					poseType_foot = PoseType::TYPE_A;
					break;
				case 3:
				default:
					poseType_hand = PoseType::TYPE_A;
					poseType_foot = PoseType::TYPE_T;
					break;
				}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0), (5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
				USkeletalMeshComponent* skc = nullptr;
				//if (GWorld) {
					ASkeletalMeshActor* ska = GWorld->SpawnActor<ASkeletalMeshActor>(ASkeletalMeshActor::StaticClass(), FTransform::Identity);
					AutoDestroy autoDestroy(ska);
					skc = Cast<USkeletalMeshComponent>(ska->GetRootComponent());
					skc->SetSkeletalMeshAsset(sk);
				//}



				skc->SetComponentSpaceTransformsDoubleBuffering(false);

				{
					UniGLBRetargetData retargetData;
					retargetData.Setup(uniGLBAssetList,
						UniGLBConverter::Options::Get().IsVRMModel(),
						UniGLBConverter::Options::Get().IsBVHModel(),
						UniGLBConverter::Options::Get().IsPMXModel());

					// default A-pose
					//retargetTable = retargetData.retargetTable;

					//TArray<UniGLBRetargetData::RetargetParts> retargetTable;
					if (UniGLBConverter::Options::Get().IsVRMModel() || UniGLBConverter::Options::Get().IsBVHModel()) {

						if (poseType_hand == PoseType::TYPE_T) {
							TArray<FString> strTable = {
								TEXT("Thigh_R"),
								TEXT("Thigh_L"),
								TEXT("calf_r"),
								TEXT("calf_l"),
								TEXT("Foot_R"),
								TEXT("Foot_L") 
							};

							// 手の情報を消す
							bool bLoop = true;
							while (bLoop) {
								bLoop = false;
								for (auto r : retargetData.retargetTable) {
									if (strTable.Find(r.BoneUE4) < 0) {
										retargetData.Remove(r.BoneUE4);
										bLoop = true;
										break;
									}
								}
							}
						}
					}
					if (UniGLBConverter::Options::Get().IsPMXModel()) {
						if (poseType_hand == PoseType::TYPE_T) {
							auto& poseList = k->GetReferenceSkeleton().GetRefBonePose();
							FString* boneName = uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable.Find(TEXT("rightLowerArm"));
							float degRot = 0.f;
							if (boneName) {
								int ind = k->GetReferenceSkeleton().FindBoneIndex(**boneName);
								if (ind >= 0) {
									FVector v = poseList[ind].GetLocation();
									v.Z = FMath::Abs(v.Z);
									v.X = FMath::Abs(v.X);
									degRot = FMath::Abs(FMath::Atan2(v.Z, v.X)) * 180.f / PI;
								}
							}
							if (degRot) {
								{
									UniGLBRetargetData::RetargetParts t;
									t.BoneUE4 = TEXT("UpperArm_R");
									t.rot = FRotator(-degRot, 0, 0);
									retargetData.Remove(t.BoneUE4);
									retargetData.retargetTable.Push(t);
								}
								{
									UniGLBRetargetData::RetargetParts t;
									t.BoneUE4 = TEXT("UpperArm_L");
									t.rot = FRotator(degRot, 0, 0);
									retargetData.Remove(t.BoneUE4);
									retargetData.retargetTable.Push(t);
								}
							}
						}
						if (poseType_hand == PoseType::TYPE_A) {
							{
								UniGLBRetargetData::RetargetParts t;
								t.BoneUE4 = TEXT("lowerarm_r");
								t.rot = FRotator(0, -30, 0);
								retargetData.Remove(t.BoneUE4);
								retargetData.retargetTable.Push(t);
							}
							{
								UniGLBRetargetData::RetargetParts t;
								t.BoneUE4 = TEXT("Hand_R");
								t.rot = FRotator(10, 0, 0);
								retargetData.Remove(t.BoneUE4);
								retargetData.retargetTable.Push(t);
							}
							{
								UniGLBRetargetData::RetargetParts t;
								t.BoneUE4 = TEXT("lowerarm_l");
								t.rot = FRotator(-0, 30, 0);
								retargetData.Remove(t.BoneUE4);
								retargetData.retargetTable.Push(t);
							}
							{
								UniGLBRetargetData::RetargetParts t;
								t.BoneUE4 = TEXT("Hand_L");
								t.rot = FRotator(-10, 0, 0);
								retargetData.Remove(t.BoneUE4);
								retargetData.retargetTable.Push(t);
							}
						}
					}
					if (poseType_foot == PoseType::TYPE_T) {
						// 足の情報を消す
						TArray<FString> strTable = {
							TEXT("Thigh_R"),
							TEXT("Thigh_L"),
							TEXT("calf_r"),
							TEXT("calf_l"),
							TEXT("Foot_R"),
							TEXT("Foot_L")
						};

						for (auto s : strTable) {
							retargetData.Remove(s);
						}
					}

					retargetData.UpdateBoneName();

					for (auto& a : retargetData.retargetTable) {
						int32 BoneIndex = UniGLBGetRefSkeleton(sk).FindBoneIndex(*a.BoneModel);
						if (BoneIndex < 0) continue;

						FTransform dstTrans;
						auto dstIndex = BoneIndex;
						
						const auto BoneTrans = UniGLBGetRefSkeleton(sk).GetRefBonePose()[dstIndex];

						while (dstIndex >= 0)
						{
							dstIndex = UniGLBGetRefSkeleton(sk).GetParentIndex(dstIndex);
							if (dstIndex < 0) {
								break;
							}
							dstTrans = UniGLBGetRefSkeleton(sk).GetRefBonePose()[dstIndex].GetRelativeTransform(dstTrans);
						}

						// p, y, r
						//a.rot = (FRotator(a.rot.Yaw, a.rot.Pitch, a.rot.Roll));

						auto q = (dstTrans.GetRotation().Inverse() * FQuat(a.rot) * dstTrans.GetRotation());
						//auto q = (dstTrans.GetRotation() * FQuat(a.rot) * dstTrans.GetRotation().Inverse());

						//a.rot = (FRotator(a.rot.Yaw, a.rot.Pitch, -a.rot.Roll));
						//DeltaRotation = FQuat(FRotator(rot.Pitch, rot.Roll, rot.Yaw));
						////DeltaRotation = FQuat(FRotator(rot.Roll, rot.Pitch, rot.Yaw));
						////DeltaRotation = FQuat(FRotator(rot.Yaw, rot.Roll, rot.Pitch));
						//DeltaRotation = FQuat(FRotator(rot.Roll, rot.Yaw, rot.Pitch));
						////DeltaRotation = FQuat(FRotator(rot.Pitch, rot.Yaw, rot.Roll));

						q = BoneTrans.GetRotation() * q;
						//q = q * BoneTrans.GetRotation();
						a.rot = q.Rotator();
					}


					TMap<FString, UniGLBRetargetData::RetargetParts> mapTable;
					for (auto &a : retargetData.retargetTable) {
						bool bFound = false;
						//vrm
						for (auto &t : UniGLBUtil::table_ue4_vrm) {
							if (t.BoneUE4.Compare(a.BoneUE4) != 0) {
								continue;
							}
							auto *m = uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable.Find(t.BoneVRM);
							if (m) {
								bFound = true;
								a.BoneVRM = t.BoneVRM;
								a.BoneModel = *m;
								mapTable.Add(a.BoneModel, a);
							}
							break;
						}
						if (bFound) {
							continue;
						}
						//pmx
						for (auto &t : UniGLBUtil::table_ue4_pmx) {
							if (t.BoneUE4.Compare(a.BoneUE4) != 0) {
								continue;
							}
							FString pmxBone;
							UniGLBUtil::GetReplacedPMXBone(pmxBone, t.BoneVRM);

							FString target[2] = {
								pmxBone,
								t.BoneVRM,
							};
							bool finish = false;
							for (int i = 0; i < 2; ++i) {
								auto* m = uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable.Find(target[i]);
								if (m) {
									bFound = true;
									a.BoneVRM = target[i];
									a.BoneModel = *m;
									mapTable.Add(a.BoneModel, a);
								}
								finish = true;
								break;
							}

							if (finish) break;
						}
						//bvh
						{
							UNodeMappingContainer* mc = uniGLBAssetList->HumanoidRig;
							if (mc) {
								const auto& m = mc->GetNodeMappingTable();
								auto* value = m.Find(*a.BoneUE4);
								if (value) {
									bFound = true;
									mapTable.Add(value->ToString(), a);
								}
							}
						}
						if (bFound) {
							continue;
						}
					}

					auto &rk = k->GetReferenceSkeleton();
					auto &dstTrans = skc->GetEditableComponentSpaceTransforms();

					// init retarget pose
					for (int i = 0; i < dstTrans.Num(); ++i) {
						auto &t = dstTrans[i];
						t = rk.GetRefBonePose()[i];
					}
					if (poseCount == 1) {
						UniGLBSetRetargetBasePose(sk, dstTrans);
					}

					// override
					for (int i = 0; i < dstTrans.Num(); ++i) {
						auto &t = dstTrans[i];

						auto *m = mapTable.Find(rk.GetBoneName(i).ToString());
						if (m) {
							t.SetRotation(FQuat(m->rot));
						}
					}

					// current pose retarget. local
					if (UniGLBConverter::Options::Get().IsAPoseRetarget() == true) {
						if (poseCount == 1) {
							UniGLBSetRetargetBasePose(sk, dstTrans);
						}
					}

					// for rig asset. world
					for (int i = 0; i < dstTrans.Num(); ++i) {
						int parent = rk.GetParentIndex(i);
						if (parent == INDEX_NONE) continue;

						dstTrans[i] = dstTrans[i] * dstTrans[parent];
					}
					// ik bone hand
					{
						int32 ik_g = UniGLBGetRefSkeleton(sk).FindBoneIndex(TEXT("ik_hand_gun"));
						int32 ik_r = UniGLBGetRefSkeleton(sk).FindBoneIndex(TEXT("ik_hand_r"));
						int32 ik_l = UniGLBGetRefSkeleton(sk).FindBoneIndex(TEXT("ik_hand_l"));

						if (ik_g >= 0 && ik_r >= 0 && ik_l >= 0) {
							const VRM::VRMMetadata *meta = reinterpret_cast<VRM::VRMMetadata*>(aiData->mVRMMeta);

							auto ar = uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable.Find(TEXT("rightHand"));
							auto al = uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable.Find(TEXT("leftHand"));
							if (ar && al) {
								int32 kr = UniGLBGetRefSkeleton(sk).FindBoneIndex(**ar);
								int32 kl = UniGLBGetRefSkeleton(sk).FindBoneIndex(**al);

								dstTrans[ik_g] = dstTrans[kr];
								dstTrans[ik_r] = dstTrans[kr];
								dstTrans[ik_l] = dstTrans[kl];

// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(5, 3, 0)] all below target floor (5, 7, 0)).
							}
						}
					}
					// ik bone foot
					{
						int32 ik_r = UniGLBGetRefSkeleton(sk).FindBoneIndex(TEXT("ik_foot_r"));
						int32 ik_l = UniGLBGetRefSkeleton(sk).FindBoneIndex(TEXT("ik_foot_l"));

						if (ik_r >= 0 && ik_l >= 0) {
							const VRM::VRMMetadata *meta = reinterpret_cast<VRM::VRMMetadata*>(aiData->mVRMMeta);

							auto ar = uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable.Find(TEXT("rightFoot"));
							auto al = uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable.Find(TEXT("leftFoot"));
							if (ar && al) {
								int32 kr = UniGLBGetRefSkeleton(sk).FindBoneIndex(**ar);
								int32 kl = UniGLBGetRefSkeleton(sk).FindBoneIndex(**al);

								dstTrans[ik_r] = dstTrans[kr];
								dstTrans[ik_l] = dstTrans[kl];

// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(5, 3, 0)] all below target floor (5, 7, 0)).
							}
						}
					}

				}
				{
					auto  PoseName = GetUniquePoseName(nullptr, "");
					switch(poseCount) {
					case 0:
						PoseName = GetUniquePoseName(UniGLBGetSkeleton(sk), TEXT("POSE_T"), true);
						break;
					case 1:
						PoseName = GetUniquePoseName(UniGLBGetSkeleton(sk), TEXT("POSE_A"), true);
						break;
					case 2:
						PoseName = GetUniquePoseName(UniGLBGetSkeleton(sk), TEXT("POSE_T(foot_A)"), true);
						break;
					case 3:
					default:
						PoseName = GetUniquePoseName(UniGLBGetSkeleton(sk), TEXT("POSE_A(foot_T)"), true);
						break;
					}
					//pose->AddOrUpdatePose(PoseName, Cast<USkeletalMeshComponent>(PreviewComponent));

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 3, 0)] (target floor (5, 7, 0)); kept #else branch only.
					auto newName = pose->AddPoseWithUniqueName(skc);
					pose->ModifyPoseName(newName, PoseName);
				}
			}
		}
	}

	bool bUseFace = true;
	if (UniGLBConverter::Options::Get().IsNoMesh()) {
		bUseFace = false;
	}
	if (UniGLBConverter::Options::Get().IsBVHModel()) {
		bUseFace = false;
	}
	if (bUseFace){
		localFaceMorphConv(uniGLBAssetList, aiData);
	}

#endif // editor

	return true;

}



