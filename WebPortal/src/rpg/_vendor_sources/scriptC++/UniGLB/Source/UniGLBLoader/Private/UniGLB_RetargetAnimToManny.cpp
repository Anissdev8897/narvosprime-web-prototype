// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.
// Sub-project C1: bake an imported web animation onto the standard Manny skeleton via the IK Retargeter.
#include "UniGLB_Convert.h"
#include "UniGLB_AssetListObject.h"
#include "UniGLBLoaderLog.h"

#include "Engine/SkeletalMesh.h"

#if WITH_EDITOR
#include "Animation/AnimSequence.h"
#include "Retargeter/IKRetargeter.h"
#include "RetargetEditor/IKRetargetBatchOperation.h"
#include "EditorAnimUtils.h"
#include "UObject/UObjectHash.h"
#include "UObject/UObjectGlobals.h"
#include "UObject/Package.h"
#include "Misc/PackageName.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "AssetRegistry/IAssetRegistry.h"
#endif

#include "UniGLBMannyResolver.h"

bool UniGLBConverter::RetargetAnimToManny(UUniGLBAssetListObject* uniGLBAssetList)
{
#if WITH_EDITOR
	if (uniGLBAssetList == nullptr || uniGLBAssetList->SkeletalMesh == nullptr || uniGLBAssetList->Package == nullptr)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("RetargetAnimToManny: missing source mesh/package; abort."));
		return false;
	}

	// 1. The RTG_ IKRetargeter that ConvertIKRig produced for this import (anim=Source, Manny=Target).
	const FString RtgName = FString(TEXT("RTG_")) + uniGLBAssetList->BaseFileName;
	UIKRetargeter* Rtg = FindObject<UIKRetargeter>(uniGLBAssetList->Package, *RtgName);
	if (Rtg == nullptr)
	{
		// bSingleUAssetFile is OFF by default in UE5.7, so UniGLB_NewObject re-parents RTG_ into a
		// sub-package. Search the import folder via AssetRegistry (scoped to THIS import's folder,
		// never a stale RTG_ from a previous import).
		const FString ImportFolder = FPackageName::GetLongPackagePath(uniGLBAssetList->Package->GetName());
		IAssetRegistry& AR = FModuleManager::LoadModuleChecked<FAssetRegistryModule>(TEXT("AssetRegistry")).Get();
		TArray<FAssetData> Found;
		AR.GetAssetsByPath(FName(*ImportFolder), Found, /*bRecursive=*/false);
		for (const FAssetData& Data : Found)
		{
			if (Data.AssetName.ToString() == RtgName)
			{
				Rtg = Cast<UIKRetargeter>(Data.GetAsset());
				if (Rtg) break;
			}
		}
	}
	if (Rtg == nullptr)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("RetargetAnimToManny: RTG asset '%s' not found (IK rig gen off, or Manny rig could not be built); abort."), *RtgName);
		return false;
	}

	// 2. Target Manny mesh (this project ships it under /Game/ThirdPerson/Characters/...).
	USkeletalMesh* MannyMesh = UniGLB_ResolveMannySkeletalMesh();
	if (MannyMesh == nullptr)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("RetargetAnimToManny: could not resolve a Manny SkeletalMesh; abort."));
		return false;
	}

	// 3. Collect the imported source AnimSequence(s) (named A_<Base>; skip A_face_*).
	//    With bSingleUAssetFile OFF (the default), UniGLB_NewObject re-parents each A_<Base> into a
	//    sibling top-level package under the same import folder, so GetObjectsWithOuter(Package) misses
	//    them. Scan the import folder via the AssetRegistry instead (mirrors the RTG_ by-name fallback).
	TArray<TWeakObjectPtr<UObject>> AnimAssets;
	const FString ImportFolder = FPackageName::GetLongPackagePath(uniGLBAssetList->Package->GetName());
	{
		IAssetRegistry& AssetRegistry = FModuleManager::LoadModuleChecked<FAssetRegistryModule>(TEXT("AssetRegistry")).Get();
		TArray<FAssetData> Found;
		AssetRegistry.GetAssetsByPath(FName(*ImportFolder), Found, /*bRecursive=*/false);
		for (const FAssetData& Data : Found)
		{
			if (Data.AssetClassPath != UAnimSequence::StaticClass()->GetClassPathName())
			{
				continue;
			}
			const FString AssetName = Data.AssetName.ToString();
			if (!AssetName.StartsWith(TEXT("A_")) || AssetName.StartsWith(TEXT("A_face")))
			{
				continue;
			}
			if (UAnimSequence* Seq = Cast<UAnimSequence>(Data.GetAsset()))
			{
				AnimAssets.Add(Seq);
			}
		}
	}
	// Fallback: also sweep in-memory children of the package (covers bSingleUAssetFile ON).
	if (AnimAssets.Num() == 0)
	{
		TArray<UObject*> PackageObjects;
		GetObjectsWithOuter(uniGLBAssetList->Package, PackageObjects, false);
		for (UObject* O : PackageObjects)
		{
			UAnimSequence* Seq = Cast<UAnimSequence>(O);
			if (Seq && Seq->GetName().StartsWith(TEXT("A_")) && !Seq->GetName().StartsWith(TEXT("A_face")))
			{
				AnimAssets.Add(Seq);
			}
		}
	}
	if (AnimAssets.Num() == 0)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("RetargetAnimToManny: no source AnimSequence to bake (searched folder '%s')."), *ImportFolder);
		return false;
	}

	// 4. Batch bake. RunRetarget shows only a (cancelable) FScopedSlowTask progress bar, no modal dialog.
	FIKRetargetBatchOperationContext Ctx;
	Ctx.AssetsToRetarget = AnimAssets;
	Ctx.SourceMesh = uniGLBAssetList->SkeletalMesh;
	Ctx.TargetMesh = MannyMesh;
	Ctx.IKRetargetAsset = Rtg;
	Ctx.NameRule.Suffix = TEXT("_Manny");
	Ctx.NameRule.FolderPath = FPackageName::GetLongPackagePath(uniGLBAssetList->Package->GetName());
	Ctx.bExportOnlyAnimatedBones = true;
	Ctx.bRetainAdditiveFlags = true;

	UIKRetargetBatchOperation* Op = NewObject<UIKRetargetBatchOperation>();
	Op->RunRetarget(Ctx);

	UE_LOG(LogUniGLBLoader, Display, TEXT("RetargetAnimToManny: baked %d sequence(s) onto Manny via '%s'."), AnimAssets.Num(), *RtgName);
	return true;
#else
	return false;
#endif
}
