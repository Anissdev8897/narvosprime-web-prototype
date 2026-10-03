// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_LoaderBPFunctionLibrary.h"

//#include "UniGLB.h"
#include "UniGLB_SkeletalMesh.h"
#include "UniGLB_ModelActor.h"
#include "UniGLB_AssetListObject.h"
#include "UniGLB_MetaObject.h"
#include "UniGLB_LicenseObject.h"
#include "UniGLB_1LicenseObject.h"

#include "UniGLB_AsyncLoadAction.h"

#include "UniGLB_Convert.h"
#include "UniGLBAssimpScene.h"
#include "UniGLB_Util.h"
#include "UniGLBMannyResolver.h"
#include "UniGLBLoaderLog.h"

#include "Components/SkeletalMeshComponent.h"
#include "Rendering/SkeletalMeshLODRenderData.h"
#include "Rendering/SkeletalMeshRenderData.h"
#include "Animation/Skeleton.h"
#include "Animation/MorphTarget.h"
#include "Animation/NodeMappingContainer.h"
#include "Animation/PoseAsset.h"

//#include ".h"

#include "RenderingThread.h"
#include "Rendering/SkeletalMeshModel.h"
#include "Rendering/SkeletalMeshLODModel.h"
#include "SkeletalMeshTypes.h"
#if WITH_EDITOR
#include "SkinnedAssetCompiler.h"
#include "HAL/IConsoleManager.h"
#include "Misc/MessageDialog.h"
#include "Framework/Notifications/NotificationManager.h"
#include "Widgets/Notifications/SNotificationList.h"
#include "Framework/Application/SlateApplication.h"
#include "Editor.h"
#include "Subsystems/AssetEditorSubsystem.h"
#endif

namespace {
	// Surface a UniGLB import outcome to the user as an editor toast, in addition to the log, so a
	// failed Manny/GASP conversion is not a silent "success". No-op outside the editor / headless.
	static void UniGLB_NotifyImport(const FString& Message, bool bError)
	{
#if WITH_EDITOR
		if (!FSlateApplication::IsInitialized()) return;
		FNotificationInfo Info(FText::FromString(Message));
		Info.ExpireDuration = bError ? 12.0f : 5.0f;
		Info.bFireAndForget = true;
		TSharedPtr<SNotificationItem> Item = FSlateNotificationManager::Get().AddNotification(Info);
		if (Item.IsValid())
		{
			Item->SetCompletionState(bError ? SNotificationItem::CS_Fail : SNotificationItem::CS_Success);
		}
#endif
	}
}
#include "UniGLB_ConvertHumanoid.h"
#include "PhysicsEngine/PhysicsAsset.h"
#include "PhysicsEngine/PhysicsConstraintTemplate.h"
#include "Misc/FeedbackContext.h"
#include "Misc/FileHelper.h"
#include "UObject/Package.h"
#include "Engine/SkeletalMeshSocket.h"
#include "EditorFramework/AssetImportData.h"
#include "TextureResource.h"
#include "Engine/Texture2D.h"
#include "IImageWrapper.h"
#include "IImageWrapperModule.h"
#include "Engine/Blueprint.h"

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "AssetRegistry/AssetRegistryModule.h"

#include "UObject/Package.h"
#include "Engine/Engine.h"


//#include "Windows/WindowsSystemIncludes.h"

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "EditorFramework/AssetImportData.h"
#include "UObject/SavePackage.h"

#if WITH_EDITOR
#include "ContentBrowserModule.h"
#include "IContentBrowserSingleton.h"
#endif


#include "UniGLB_RigHeader.h"

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "Misc/FieldAccessor.h"

#if PLATFORM_WINDOWS
#include "Windows/AllowWindowsPlatformTypes.h"
#include <windows.h>
#include "Windows/HideWindowsPlatformTypes.h"
#endif

#include <assimp/Importer.hpp>
#include <assimp/scene.h>
#include <assimp/mesh.h>
#include <assimp/postprocess.h>
#include <assimp/GltfMaterial.h>
#include <assimp/vrm/vrmmeta.h>

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 23, 0)] (target floor (5, 7, 0)); kept #else branch only.


// tem
namespace {
	UPackage *s_vrm_package = nullptr;
	FString baseFileName;
}

namespace {
	class RenderControl {
		bool tmp = false;
	public:
		RenderControl() {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
		}
		~RenderControl() {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
		}
	};

}


static std::string GetExtAndSetModelTypeLocal(std::string e, const uint8* pDataLocal, size_t sizeLocal) {
	std::string e_tmp = e;
	UniGLBConverter::Options::Get().ClearModelType();

	if (e.compare("vrm") == 0 || e.compare("glb") == 0 || e.compare("gltf") == 0) {

		UniGLBConverter::Options::Get().SetVRM0Model(true);

		extern bool VRMIsVRM10(const uint8 * pData, size_t size);
		if (VRMIsVRM10(pDataLocal, sizeLocal)) {
			UniGLBConverter::Options::Get().SetVRM10Model(true);
		}
	}

	if (e.compare("vrma") == 0) {
		UniGLBConverter::Options::Get().SetVRMAModel(true);
		UniGLBConverter::Options::Get().SetNoMesh(true);
		UniGLBConverter::Options::Get().SetVRM10Model(true);
		e_tmp = "vrm";
	}

	if (e.compare("bvh") == 0) {
		UniGLBConverter::Options::Get().SetBVHModel(true);
	}
	if (e.compare("pmx") == 0) {
		UniGLBConverter::Options::Get().SetPMXModel(true);
	}
	return e_tmp;
}

static bool RemoveObject(UObject* u) {
	if (u == nullptr) return true;
#if WITH_EDITOR

	u->ClearFlags(EObjectFlags::RF_Standalone);
	u->SetFlags(EObjectFlags::RF_Public | RF_Transient);
	u->ConditionalBeginDestroy();
#endif
	return true;
}

static bool RemoveAssetList(UUniGLBAssetListObject *&assetList) {
	if (assetList == nullptr) return false;
#if WITH_EDITOR

	for (auto& t : assetList->Textures) {
		RemoveObject(t);
	}
	for (auto& t : assetList->Materials) {
		RemoveObject(t);
	}
	for (auto& t : assetList->OutlineMaterials) {
		RemoveObject(t);
	}
	if (assetList->SkeletalMesh) {
		RemoveObject(UniGLBGetSkeleton(assetList->SkeletalMesh));
		RemoveObject(UniGLBGetPhysicsAsset(assetList->SkeletalMesh));
		RemoveObject(assetList->SkeletalMesh);
	}
	RemoveObject(assetList->UniGLBMetaObject);
	RemoveObject(assetList->UniGLBLicenseObject);
	RemoveObject(assetList->UniGLB1LicenseObject);
	RemoveObject(assetList->HumanoidSkeletalMesh);
	RemoveObject(assetList->HumanoidRig);

	RemoveObject(assetList);
	assetList = nullptr;
#endif
	return true;
}

static bool RenewPkgAndSaveObject(UObject *u, bool bSave) {
#if WITH_EDITOR
	if (u == nullptr) return false;

	//if (UniGLBConverter::Options::Get().IsSingleUAssetFile()) {
		if (UniGLBConverter::IsImportMode()) {
			u->PostEditChange();
		}
		if (bSave) {
			s_vrm_package->MarkPackageDirty();
			FAssetRegistryModule::AssetCreated(u);
#if	UE_VERSION_OLDER_THAN(5,0,0)
			bool bSaved = UPackage::SavePackage(s_vrm_package, u, EObjectFlags::RF_Standalone, *(s_vrm_package->GetName()), GError, nullptr, true, true, SAVE_NoError);
#elif UE_VERSION_OLDER_THAN(5,1,0)
			FSavePackageArgs SaveArgs = { nullptr, EObjectFlags::RF_Standalone, SAVE_NoError, true,
					true, true, FDateTime::MinValue(), GError };
			bool bSaved = UPackage::SavePackage(s_vrm_package, u, *(s_vrm_package->GetName()), SaveArgs);
#elif UE_VERSION_OLDER_THAN(5,8,0)
PRAGMA_DISABLE_DEPRECATION_WARNINGS
			FSavePackageArgs SaveArgs = { nullptr, nullptr, EObjectFlags::RF_Standalone, SAVE_NoError, true,
					true, true, FDateTime::MinValue(), GError };
PRAGMA_ENABLE_DEPRECATION_WARNINGS
			bool bSaved = UPackage::SavePackage(s_vrm_package, u, *(s_vrm_package->GetName()), SaveArgs);
#else
			FSavePackageArgs SaveArgs;
			SaveArgs.ArchiveCookData = nullptr;
			SaveArgs.TopLevelFlags = EObjectFlags::RF_Standalone;
			SaveArgs.SaveFlags = SAVE_NoError;
			SaveArgs.bForceByteSwapping = true;
			SaveArgs.bWarnOfLongFilename = true;
			SaveArgs.bSlowTask = true;
			SaveArgs.FinalTimeStamp = FDateTime::MinValue();
			SaveArgs.Error = GError;
			SaveArgs.SavePackageContext = nullptr;

			bool bSaved = UPackage::SavePackage(s_vrm_package, u, *(s_vrm_package->GetName()), SaveArgs);
#endif
		}
		/*
	}else{
		FString objPath = u->GetPathName();
		if (objPath.IsEmpty()) return false;

		const FString PackageName = FPackageName::ObjectPathToPackageName(objPath);
		const FString PackagePath = FPaths::GetPath(PackageName);
		const FString AssetName = FPaths::GetBaseFilename(PackageName);

		FString NewPackageName = FPaths::Combine(*PackagePath, *(u->GetFName().ToString()));
		UPackage* Pkg = CreatePackage(nullptr, *NewPackageName);
		u->Rename(nullptr, Pkg);

		if (UniGLBConverter::IsImportMode()) {
			u->PostEditChange();
		}

		if (bSave) {
			UPackage::SavePackage(Pkg, u, RF_Standalone,
				*FPackageName::LongPackageNameToFilename(NewPackageName, FPackageName::GetAssetPackageExtension()),
				GError, nullptr, false, true, SAVE_NoError);
		}
	}
	*/

#endif
	return true;
}

static UTexture2D* LocalGetTexture(const aiScene* mScenePtr, int texIndex) {

	if (texIndex < 0 || texIndex >= (int)mScenePtr->mNumTextures) {
		return nullptr;
	}

	IImageWrapperModule& ImageWrapperModule = FModuleManager::LoadModuleChecked<IImageWrapperModule>(FName("ImageWrapper"));
	TSharedPtr<IImageWrapper> ImageWrapper;
	// Note: PNG format.  Other formats are supported
	ImageWrapper = ImageWrapperModule.CreateImageWrapper(EImageFormat::PNG);

	auto& t = *mScenePtr->mTextures[texIndex];
	int Width = t.mWidth;
	int Height = t.mHeight;
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 25, 0)] (target floor (5, 7, 0)); kept #else branch only.
	TArray<uint8> RawData;
	const TArray<uint8>* pRawData = nullptr;

	if (Height == 0) {
		if (ImageWrapper->SetCompressed(t.pcData, t.mWidth)) {

		}
		Width = ImageWrapper->GetWidth();
		Height = ImageWrapper->GetHeight();

		if (Width == 0 || Height == 0) {
			return nullptr;
		}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 25, 0)] (target floor (5, 7, 0)); kept #else branch only.
		ImageWrapper->GetRaw(ERGBFormat::BGRA, 8, RawData);
		pRawData = &RawData;
	}
	FString baseName;

	auto *NewTexture2D = UniGLBLoaderUtil::CreateTexture(Width, Height, FString(TEXT("T_")) + baseName, GetTransientPackage());
	//UTexture2D* NewTexture2D = _CreateTransient(Width, Height, PF_B8G8R8A8, t.mFilename.C_Str());

	// Fill in the base mip for the texture we created
	uint8* MipData = (uint8*)GetPlatformData(NewTexture2D)->Mips[0].BulkData.Lock(LOCK_READ_WRITE);
	if (pRawData) {
		FMemory::Memcpy(MipData, pRawData->GetData(), pRawData->Num());
	}
	else {
		for (int32 y = 0; y < Height; y++)
		{
			const aiTexel* c = &(t.pcData[y * Width]);
			uint8* DestPtr = &MipData[y * Width * sizeof(FColor)];
			for (int32 x = 0; x < Width; x++)
			{
				*DestPtr++ = c->b;
				*DestPtr++ = c->g;
				*DestPtr++ = c->r;
				*DestPtr++ = c->a;
				c++;
			}
		}
	}
	GetPlatformData(NewTexture2D)->Mips[0].BulkData.Unlock();

	// Set options
	NewTexture2D->SRGB = true;// bUseSRGB;
	NewTexture2D->CompressionSettings = TC_Default;
	NewTexture2D->AddressX = TA_Wrap;
	NewTexture2D->AddressY = TA_Wrap;

#if WITH_EDITORONLY_DATA
	NewTexture2D->CompressionNone = false;
	NewTexture2D->DeferCompression = true;

	// nomipmap for tmporary thumbnail
	//if (UniGLBConverter::Options::Get().IsMipmapGenerateMode()) {
	//	NewTexture2D->MipGenSettings = TMGS_FromTextureGroup;
	//} else {
	NewTexture2D->MipGenSettings = TMGS_NoMipmaps;
	//}
	NewTexture2D->Source.Init(Width, Height, 1, 1, ETextureSourceFormat::TSF_BGRA8, pRawData->GetData());
	//NewTexture2D->Source.Compress();
#endif

// Update the remote texture data
	NewTexture2D->UpdateResource();
#if WITH_EDITOR
	NewTexture2D->PostEditChange();
#endif
	return NewTexture2D;
}

static void UpdateProgress(int prog) {
#if WITH_EDITOR
	GWarn->UpdateProgress( prog, 100 );
#endif
}

////

static void ReTransformHumanoidBone(USkeleton *targetHumanoidSkeleton, const UUniGLBMetaObject *meta, const USkeleton *displaySkeleton) {

	FReferenceSkeleton &ReferenceSkeleton = const_cast<FReferenceSkeleton&>(targetHumanoidSkeleton->GetReferenceSkeleton());
	auto &allbone = const_cast<TArray<FMeshBoneInfo> &>(targetHumanoidSkeleton->GetReferenceSkeleton().GetRawRefBoneInfo());

	//auto &humanoidTrans = humanoidSkeleton->GetReferenceSkeleton().GetRawRefBonePose();

	FReferenceSkeletonModifier RefSkelModifier(ReferenceSkeleton, targetHumanoidSkeleton);

	for (int ind_target = 0; ind_target < targetHumanoidSkeleton->GetReferenceSkeleton().GetRawBoneNum(); ++ind_target) {
		FTransform t;
		t.SetIdentity();
		RefSkelModifier.UpdateRefPoseTransform(ind_target, t);

		auto boneName = ReferenceSkeleton.GetBoneName(ind_target);
		//auto &info = targetHumanoidSkeleton->GetReferenceSkeleton().GetRefBoneInfo();
		//auto &a = info[ind_target];

		int32 ind_disp = 0;

		if (meta) {
			auto p = meta->humanoidBoneTable.Find(boneName.ToString());
			if (p == nullptr) {
				continue;
			}
			ind_disp = displaySkeleton->GetReferenceSkeleton().FindBoneIndex(**p);
		}else {
			ind_disp = displaySkeleton->GetReferenceSkeleton().FindBoneIndex(boneName);
		}

		if (ind_disp == INDEX_NONE) {
			continue;
		}
		t = displaySkeleton->GetReferenceSkeleton().GetRefBonePose()[ind_disp];

		auto parent = displaySkeleton->GetReferenceSkeleton().GetParentIndex(ind_disp);
		while (parent != INDEX_NONE) {

			auto s = displaySkeleton->GetReferenceSkeleton().GetBoneName(parent);

			if (meta) {
				if (meta->humanoidBoneTable.FindKey(s.ToString()) != nullptr) {
					// parent == humanoidBone
					break;
				}
			}
			//t.SetLocation(t.GetLocation() + displaySkeleton->GetReferenceSkeleton().GetRefBonePose()[parent].GetLocation());;
			parent = displaySkeleton->GetReferenceSkeleton().GetParentIndex(parent);
		}
		RefSkelModifier.UpdateRefPoseTransform(ind_target, t);
	}

	ReferenceSkeleton.RebuildRefSkeleton(targetHumanoidSkeleton, true);

}

bool UUniGLBLoaderBPFunctionLibrary::UniGLBReTransformHumanoidBone(USkeletalMeshComponent *targetHumanoidSkeleton, const UUniGLBMetaObject *meta, const USkeletalMeshComponent *displaySkeleton) {

	if (targetHumanoidSkeleton == nullptr) return false;
	if (UniGLBGetSkinnedAsset(targetHumanoidSkeleton) == nullptr) return false;

	if (displaySkeleton == nullptr) return false;
	if (UniGLBGetSkinnedAsset(displaySkeleton) == nullptr) return false;

	// no meta. use default name.
	//if (meta == nullptr) return false;

	ReTransformHumanoidBone(UniGLBGetSkeleton( UniGLBGetSkinnedAsset(targetHumanoidSkeleton) ), meta, UniGLBGetSkeleton( UniGLBGetSkinnedAsset(displaySkeleton) ));
	auto *sk = UniGLBGetSkinnedAsset(targetHumanoidSkeleton);
	auto *k = UniGLBGetSkeleton(sk);

	UniGLBSetRefSkeleton(sk, k->GetReferenceSkeleton());
	//sk->RefSkeleton.RebuildNameToIndexMap();

	//sk->RefSkeleton.RebuildRefSkeleton(sk->Skeleton, true);
	//sk->Proc();

	//out->RefSkeleton = sk->RefSkeleton;
	
	UniGLBSetSkeleton(sk, k);
	UniGLBSetRefSkeleton(sk, k->GetReferenceSkeleton());

	sk->CalculateInvRefMatrices();
	sk->CalculateExtendedBounds();

#if WITH_EDITORONLY_DATA
	sk->ConvertLegacyLODScreenSize();
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0)] (target floor (5, 7, 0)); kept #else branch only.
	sk->UpdateGenerateUpToData();
#endif

#if WITH_EDITORONLY_DATA
	k->SetPreviewMesh(sk);
#endif
	k->RecreateBoneTree(sk);

	return true;
}



void UUniGLBLoaderBPFunctionLibrary::SetImportMode(bool bIm, class UPackage *p) {
	UniGLBConverter::SetImportMode(bIm);
	s_vrm_package = p;
}

namespace {
#if PLATFORM_WINDOWS
	std::string utf_16_to_shift_jis(const std::wstring& str) {
		static_assert(sizeof(wchar_t) == 2, "this function is windows only");
		const int len = ::WideCharToMultiByte(932/*CP_ACP*/, 0, str.c_str(), -1, nullptr, 0, nullptr, nullptr);
		std::string re(len * 2, '\0');
		if (!::WideCharToMultiByte(CP_ACP, 0, str.c_str(), -1, &re[0], len, nullptr, nullptr)) {
			const auto ec = ::GetLastError();
			switch (ec)
			{
			case ERROR_INSUFFICIENT_BUFFER:
				//throw std::runtime_error("in function utf_16_to_shift_jis, WideCharToMultiByte fail. cause: ERROR_INSUFFICIENT_BUFFER"); break;
			case ERROR_INVALID_FLAGS:
				//throw std::runtime_error("in function utf_16_to_shift_jis, WideCharToMultiByte fail. cause: ERROR_INVALID_FLAGS"); break;
			case ERROR_INVALID_PARAMETER:
				//throw std::runtime_error("in function utf_16_to_shift_jis, WideCharToMultiByte fail. cause: ERROR_INVALID_PARAMETER"); break;
			default:
				//throw std::runtime_error("in function utf_16_to_shift_jis, WideCharToMultiByte fail. cause: unknown(" + std::to_string(ec) + ')'); break;
				break;
			}
		}
		const std::size_t real_len = std::strlen(re.c_str());
		re.resize(real_len);
		re.shrink_to_fit();
		return re;
	}
#endif
}

bool UUniGLBLoaderBPFunctionLibrary::IsValidUniGLBFile(FString filepath) {

	UE_LOG(LogUniGLBLoader, Log, TEXT("IsValidVRM: OrigFileName=%s"), *filepath);

	const FString ext = FPaths::GetExtension(filepath);
	if (ext.Compare(TEXT("vrm"), ESearchCase::IgnoreCase) && ext.Compare(TEXT("vrma"), ESearchCase::IgnoreCase)) {
		// vrm, vrma以外は素通し
		return true;
	}

	std::string file;
#if PLATFORM_WINDOWS
	file = utf_16_to_shift_jis(*filepath);
#else
	file = TCHAR_TO_UTF8(*filepath);
#endif

	UE_LOG(LogUniGLBLoader, Log, TEXT("IsValidVRM: std::stringFileName=%hs"), file.c_str());

	TArray<uint8> Res;
	if (FFileHelper::LoadFileToArray(Res, *filepath)) {
		UE_LOG(LogUniGLBLoader, Log, TEXT("IsValidVRM: filesize=%d"), Res.Num());

		extern bool UniGLBIsValid(const uint8_t * pData, size_t size);
			
		return UniGLBIsValid(Res.GetData(), Res.Num());
	}
	return false;
}

void UUniGLBLoaderBPFunctionLibrary::GetUniGLBMeta(FString filepath, UUniGLBLicenseObject*& a, UUniGLB1LicenseObject*& b) {

	UE_LOG(LogUniGLBLoader, Log, TEXT("GetUniGLBMeta:OrigFileName=%s"), *filepath);

	std::string file;
#if PLATFORM_WINDOWS
	file = utf_16_to_shift_jis(*filepath);
#else
	file = TCHAR_TO_UTF8(*filepath);
#endif

	UE_LOG(LogUniGLBLoader, Log, TEXT("GetUniGLBMeta:std::stringFileName=%hs"), file.c_str());

	Assimp::Importer mImporter;
	mImporter.SetPropertyBool(AI_CONFIG_IMPORT_REMOVE_EMPTY_BONES, false);
	const aiScene *mScenePtr = nullptr; // delete by Assimp::Importer::~Importer

	UniGLBConverter vc;
	{
		TArray<uint8> Res;
		if (FFileHelper::LoadFileToArray(Res, *filepath)) {
		}
		UE_LOG(LogUniGLBLoader, Log, TEXT("GetUniGLBMeta: filesize=%d"), Res.Num());

		const FString ext = FPaths::GetExtension(filepath);
#if PLATFORM_WINDOWS
		std::string e = utf_16_to_shift_jis(*ext);
#else
		std::string e = TCHAR_TO_UTF8(*ext);
#endif

		e = GetExtAndSetModelTypeLocal(e, Res.GetData(), Res.Num());

		mScenePtr = mImporter.ReadFileFromMemory(Res.GetData(), Res.Num(),
			aiProcess_Triangulate | aiProcess_MakeLeftHanded | aiProcess_CalcTangentSpace | aiProcess_GenSmoothNormals | aiProcess_OptimizeMeshes,
			e.c_str());

		UE_LOG(LogUniGLBLoader, Log, TEXT("GetUniGLBMeta: mScenePtr=%p"), mScenePtr);

		if (mScenePtr == nullptr) {
			return;
		}

		//UE_LOG(LogUniGLBLoader, Log, TEXT("VRM:(%3.3lf secs) ReadFileFromMemory"), FPlatformTime::Seconds() - StartTime);


		{
			// vrm version check

			extern bool VRMIsVRM10(const uint8 * pData, size_t size);
			if (VRMIsVRM10(Res.GetData(), Res.Num())) {
				UniGLBConverter::Options::Get().SetVRM10Model(true);
				vc.Init(Res.GetData(), Res.Num(), nullptr);
			}
		}
	}

	UTexture2D* NewTexture2D = nullptr;

	if (UniGLBConverter::Options::Get().IsVRM10Model()) {
		int texIndex = vc.GetThumbnailTextureIndex();
		NewTexture2D = LocalGetTexture(mScenePtr, texIndex);
	}else{
		VRM::VRMMetadata* meta = reinterpret_cast<VRM::VRMMetadata*>(mScenePtr->mVRMMeta);

		if (meta) {
			for (int i = 0; i < meta->license.licensePairNum; ++i) {

				auto& p = meta->license.licensePair[i];

				if (FString(TEXT("texture")) != p.Key.C_Str()) {
					continue;
				}

				unsigned int texIndex = FCString::Atoi(*FString(p.Value.C_Str()));
				NewTexture2D = LocalGetTexture(mScenePtr, texIndex);
				if (NewTexture2D) {
					break;
				}
			}
		}
	}

	UUniGLBLicenseObject* m = nullptr;
	UUniGLB1LicenseObject* m1 = nullptr;
	vc.GetUniGLBMeta(mScenePtr, m, m1);

	if (m) m->thumbnail = NewTexture2D;
	if (m1) m1->thumbnail = NewTexture2D;

	a = m;
	b = m1;
}

bool UUniGLBLoaderBPFunctionLibrary::UniGLBSetLoadMaterialType(EUniGLBImportMaterialType type) {
	UniGLBConverter::Options::Get().SetMaterialType(type);
	return true;
}

bool UUniGLBLoaderBPFunctionLibrary::LoadVRMFile(const UUniGLBAssetListObject *InUniGLBAsset, UUniGLBAssetListObject *&OutUniGLBAsset, const FString filepath, const FUniGLBImportOptionData &OptionForRuntimeLoad) {
	UniGLBConverter::Options::Get().SetUniGLBOption(&OptionForRuntimeLoad);
	OutUniGLBAsset = nullptr;

	return LoadVRMFileLocal(InUniGLBAsset, OutUniGLBAsset, filepath);
}

void UUniGLBLoaderBPFunctionLibrary::LoadVRMFileAsync(const UObject* WorldContextObject, const class UUniGLBAssetListObject* InUniGLBAsset, class UUniGLBAssetListObject*& OutUniGLBAsset, const FString filepath, const FUniGLBImportOptionData& OptionForRuntimeLoad, struct FLatentActionInfo LatentInfo) {
	UniGLBConverter::Options::Get().SetUniGLBOption(&OptionForRuntimeLoad);
	OutUniGLBAsset = nullptr;

	if (UWorld* World = GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::LogAndReturnNull))
	{
		FLatentActionManager& LatentActionManager = World->GetLatentActionManager();
		if (LatentActionManager.FindExistingAction<FUniGLBAsyncLoadAction>(LatentInfo.CallbackTarget, LatentInfo.UUID) == NULL)
		{
			FUniGLBAsyncLoadActionParam p = { InUniGLBAsset, OutUniGLBAsset, OptionForRuntimeLoad, filepath, nullptr, 0 };
			LatentActionManager.AddNewAction(LatentInfo.CallbackTarget, LatentInfo.UUID, new FUniGLBAsyncLoadAction(LatentInfo, p));
		}
	}
	return;
}


bool UUniGLBLoaderBPFunctionLibrary::LoadVRMFileLocal(const UUniGLBAssetListObject* InUniGLBAsset, UUniGLBAssetListObject*& OutUniGLBAsset, const FString filepath) {
	TArray<uint8> Res;
	if (FFileHelper::LoadFileToArray(Res, *filepath)) {
	}

	return LoadVRMFileFromMemory(InUniGLBAsset, OutUniGLBAsset, filepath, Res.GetData(), Res.Num());
}

#if WITH_EDITOR
// Structural skeleton edit expressed by bone NAME (never by index, which is volatile).
struct FNativeBoneEdit {
	// Local: transform relative to parent (used when bWorld == false).
	// World: absolute transform (used when bWorld == true) - lets us place a bone at an explicit
	//        world spot regardless of the parent's (possibly different) bone-axis orientation.
	struct FInject { FName Name; FName Parent; FTransform Local; bool bWorld = false; FTransform World; };
	TArray<FInject> Inject;            // injected bones, resolved in array order
	TMap<FName, FName> Reparent;       // child name -> new parent name
	TSet<FName> Remove;                // bones to DROP; their children + skin weights collapse to the
	                                   // nearest surviving ancestor (used to prune non-Manny source bones)
};

// Rebuild the reference skeleton in strict parent-before-child order after structural edits,
// preserving each existing bone's WORLD transform (so reparented limbs don't move), and remap
// skin-weight bone references so existing skinning stays valid.
static bool RebuildSkeletonOrdered(USkeletalMesh* sk, USkeleton* Skeleton, const FNativeBoneEdit& Edit) {
	FReferenceSkeleton& RefSkeleton = UniGLBGetRefSkeleton(sk);
	const int32 OldNum = RefSkeleton.GetRawBoneNum();
	if (OldNum == 0) return false;

	auto CompXform = [](const FReferenceSkeleton& Ref, int32 BoneIdx) -> FTransform {
		FTransform T = FTransform::Identity;
		for (int32 i = BoneIdx; i != INDEX_NONE; i = Ref.GetParentIndex(i)) T = T * Ref.GetRefBonePose()[i];
		return T;
	};

	TArray<FName> OldNames; OldNames.SetNum(OldNum);
	TMap<FName, FName> ParentOf;
	TMap<FName, FTransform> WorldOf;
	for (int32 i = 0; i < OldNum; ++i) {
		const FName Name = RefSkeleton.GetBoneName(i);
		OldNames[i] = Name;
		const int32 P = RefSkeleton.GetParentIndex(i);
		ParentOf.Add(Name, (P == INDEX_NONE) ? NAME_None : RefSkeleton.GetBoneName(P));
		WorldOf.Add(Name, CompXform(RefSkeleton, i));
	}

	TArray<FName> NewBoneNames;
	for (const FNativeBoneEdit::FInject& In : Edit.Inject) {
		if (ParentOf.Contains(In.Name)) continue; // already present -> skip
		if (In.Parent.IsNone()) {
			// Virtual root inject: Mixamo/Blender-class rigs have NO origin root (pelvis is the top bone),
			// so the Manny-bone inject loop queues "root" with a NAME_None parent. Accept it (the old filter
			// rejected every NAME_None-parent inject) so GASP root motion + the root/pelvis translation-
			// retarget split work; the Reparent loop below then puts pelvis under it. Root has no skin weights
			// (vertices untouched). Rigs that already have a root never queue this (the inject loop skips
			// bones already present), so no double-root.
			ParentOf.Add(In.Name, NAME_None);
			WorldOf.Add(In.Name, In.bWorld ? In.World : In.Local); // root: no parent to multiply by
			NewBoneNames.Add(In.Name);
			continue;
		}
		if (!ParentOf.Contains(In.Parent)) continue; // non-root inject needs a known parent
		ParentOf.Add(In.Name, In.Parent);
		WorldOf.Add(In.Name, In.bWorld ? In.World : (In.Local * WorldOf[In.Parent]));
		NewBoneNames.Add(In.Name);
	}
	for (const TPair<FName, FName>& Pair : Edit.Reparent) {
		if (ParentOf.Contains(Pair.Key) && ParentOf.Contains(Pair.Value)) ParentOf[Pair.Key] = Pair.Value;
	}

	// Removal: any bone in Edit.Remove is dropped; its surviving descendants reparent to, and its
	// skin weights collapse onto, the nearest ancestor that is NOT being removed.
	auto SurvivingAncestor = [&](FName N) -> FName {
		while (!N.IsNone() && Edit.Remove.Contains(N)) N = ParentOf.Contains(N) ? ParentOf[N] : NAME_None;
		return N;
	};

	TMap<FName, TArray<FName>> Children;
	auto AddChild = [&](FName Parent, FName Child) { if (!Parent.IsNone()) Children.FindOrAdd(Parent).Add(Child); };
	for (int32 i = 0; i < OldNum; ++i) {
		const FName N = OldNames[i];
		if (Edit.Remove.Contains(N)) continue;
		AddChild(SurvivingAncestor(ParentOf[N]), N);
	}
	for (const FName& N : NewBoneNames) {
		if (Edit.Remove.Contains(N)) continue;
		AddChild(SurvivingAncestor(ParentOf[N]), N);
	}

	FName RootName = OldNames[0];
	if (Edit.Remove.Contains(RootName) || !ParentOf[RootName].IsNone()) {
		RootName = NAME_None;
		for (const TPair<FName, FName>& Pair : ParentOf) {
			if (Edit.Remove.Contains(Pair.Key)) continue;
			if (SurvivingAncestor(Pair.Value).IsNone()) { RootName = Pair.Key; break; }
		}
		if (RootName.IsNone()) {
			UE_LOG(LogUniGLBLoader, Warning, TEXT("NativeMannyGASP: no surviving root, skip rebuild"));
			return false;
		}
	}

	int32 ExpectedNum = 0;
	for (const TPair<FName, FName>& Pair : ParentOf) if (!Edit.Remove.Contains(Pair.Key)) ++ExpectedNum;

	TArray<FName> Order; Order.Reserve(ExpectedNum);
	TFunction<void(FName)> Visit = [&](FName N) {
		Order.Add(N);
		if (const TArray<FName>* C = Children.Find(N)) for (const FName& Ch : *C) Visit(Ch);
	};
	Visit(RootName);
	if (Order.Num() != ExpectedNum) {
		UE_LOG(LogUniGLBLoader, Warning, TEXT("NativeMannyGASP: topo incomplete (%d/%d), skip rebuild"), Order.Num(), ExpectedNum);
		return false;
	}

	TMap<FName, int32> NewIndexOf;
	for (int32 i = 0; i < Order.Num(); ++i) {
		if (NewIndexOf.Contains(Order[i])) {
			UE_LOG(LogUniGLBLoader, Warning, TEXT("NativeMannyGASP: duplicate bone '%s', skip rebuild"), *Order[i].ToString());
			return false;
		}
		NewIndexOf.Add(Order[i], i);
	}
	TArray<int32> OldToNew; OldToNew.SetNum(OldNum);
	for (int32 i = 0; i < OldNum; ++i) {
		const FName N = OldNames[i];
		const FName Surv = Edit.Remove.Contains(N) ? SurvivingAncestor(N) : N;
		const int32* NewIdx = NewIndexOf.Find(Surv);
		OldToNew[i] = NewIdx ? *NewIdx : 0;
	}

	{
		RefSkeleton.Empty(Order.Num());
		FReferenceSkeletonModifier Modifier(RefSkeleton, Skeleton);
		for (const FName& N : Order) {
			FMeshBoneInfo Info;
			Info.Name = N;
			Info.ExportName = N.ToString();
			const FName P = SurvivingAncestor(ParentOf[N]);   // a surviving bone whose direct parent was pruned reparents up
			Info.ParentIndex = P.IsNone() ? INDEX_NONE : NewIndexOf[P];
			const FTransform ParentWorld = P.IsNone() ? FTransform::Identity : WorldOf[P];
			Modifier.Add(Info, WorldOf[N].GetRelativeTransform(ParentWorld));
		}
	}

	TArray<int32> NewBoneIndices;
	for (const FName& N : NewBoneNames) NewBoneIndices.Add(NewIndexOf[N]);
	auto RemapArray = [&](TArray<FBoneIndexType>& Arr, bool bAddNewAndSort) {
		for (FBoneIndexType& B : Arr) if ((int32)B < OldToNew.Num()) B = (FBoneIndexType)OldToNew[B];
		if (bAddNewAndSort) {
			for (int32 Idx : NewBoneIndices) Arr.AddUnique((FBoneIndexType)Idx);
			Arr.Sort();
			// Pruning collapses several old bones onto one ancestor, so the remap can produce
			// duplicates; ActiveBoneIndices / RequiredBones must stay sorted-UNIQUE. (BoneMap is left
			// with duplicates on purpose: per-vertex influences index it by position.)
			TArray<FBoneIndexType> Unique; Unique.Reserve(Arr.Num());
			for (FBoneIndexType B : Arr) if (Unique.Num() == 0 || Unique.Last() != B) Unique.Add(B);
			Arr = MoveTemp(Unique);
		}
	};
	if (FSkeletalMeshModel* Model = sk->GetImportedModel()) {
		for (FSkeletalMeshLODModel& LOD : Model->LODModels) {
			for (FSkelMeshSection& Sec : LOD.Sections) RemapArray(Sec.BoneMap, false);
			RemapArray(LOD.ActiveBoneIndices, true);
			RemapArray(LOD.RequiredBones, true);
		}
	}
	if (FSkeletalMeshRenderData* RenderData = sk->GetResourceForRendering()) {
		for (FSkeletalMeshLODRenderData& LOD : RenderData->LODRenderData) {
			for (FSkelMeshRenderSection& Sec : LOD.RenderSections) RemapArray(Sec.BoneMap, false);
			RemapArray(LOD.ActiveBoneIndices, true);
			RemapArray(LOD.RequiredBones, true);
		}
	}
	return true;
}
#endif

// ---- Universal (non-VRM FBX/GLB) -> Manny/GASP support -----------------------------------------
// A real VRM carries a humanoid bone map; an FBX/GLB does not. We detect the source skeleton's
// naming convention and fill the UniGLBMetaObject's humanoidBoneTable with
// { VRM-humanoid-name -> actual source bone name }. Once filled, renameToUE4Bone +
// ProcessNativeMannyGASP run UNCHANGED (same rename -> Manny topology injection -> A-pose bake ->
// GASP-compatible path as a real VRM), so no existing logic is duplicated or modified.
struct FUniGLBUniBone { const TCHAR* UniGLB; const TCHAR* Src; };

// Mixamo ("mixamorig:*") AND Ready Player Me (identical names, no prefix). Source tokens are the
// bare bone names; matching strips a leading namespace / "mixamorig" so one table serves both.
static const FUniGLBUniBone GUniGLBMixamoRPM[] = {
	{ TEXT("hips"), TEXT("Hips") }, { TEXT("spine"), TEXT("Spine") }, { TEXT("chest"), TEXT("Spine1") }, { TEXT("upperChest"), TEXT("Spine2") },
	{ TEXT("neck"), TEXT("Neck") }, { TEXT("head"), TEXT("Head") },
	{ TEXT("leftShoulder"), TEXT("LeftShoulder") }, { TEXT("leftUpperArm"), TEXT("LeftArm") }, { TEXT("leftLowerArm"), TEXT("LeftForeArm") }, { TEXT("leftHand"), TEXT("LeftHand") },
	{ TEXT("rightShoulder"), TEXT("RightShoulder") }, { TEXT("rightUpperArm"), TEXT("RightArm") }, { TEXT("rightLowerArm"), TEXT("RightForeArm") }, { TEXT("rightHand"), TEXT("RightHand") },
	{ TEXT("leftUpperLeg"), TEXT("LeftUpLeg") }, { TEXT("leftLowerLeg"), TEXT("LeftLeg") }, { TEXT("leftFoot"), TEXT("LeftFoot") }, { TEXT("leftToes"), TEXT("LeftToeBase") },
	{ TEXT("rightUpperLeg"), TEXT("RightUpLeg") }, { TEXT("rightLowerLeg"), TEXT("RightLeg") }, { TEXT("rightFoot"), TEXT("RightFoot") }, { TEXT("rightToes"), TEXT("RightToeBase") },
	{ TEXT("leftThumbProximal"), TEXT("LeftHandThumb1") }, { TEXT("leftThumbIntermediate"), TEXT("LeftHandThumb2") }, { TEXT("leftThumbDistal"), TEXT("LeftHandThumb3") },
	{ TEXT("leftIndexProximal"), TEXT("LeftHandIndex1") }, { TEXT("leftIndexIntermediate"), TEXT("LeftHandIndex2") }, { TEXT("leftIndexDistal"), TEXT("LeftHandIndex3") },
	{ TEXT("leftMiddleProximal"), TEXT("LeftHandMiddle1") }, { TEXT("leftMiddleIntermediate"), TEXT("LeftHandMiddle2") }, { TEXT("leftMiddleDistal"), TEXT("LeftHandMiddle3") },
	{ TEXT("leftRingProximal"), TEXT("LeftHandRing1") }, { TEXT("leftRingIntermediate"), TEXT("LeftHandRing2") }, { TEXT("leftRingDistal"), TEXT("LeftHandRing3") },
	{ TEXT("leftLittleProximal"), TEXT("LeftHandPinky1") }, { TEXT("leftLittleIntermediate"), TEXT("LeftHandPinky2") }, { TEXT("leftLittleDistal"), TEXT("LeftHandPinky3") },
	{ TEXT("rightThumbProximal"), TEXT("RightHandThumb1") }, { TEXT("rightThumbIntermediate"), TEXT("RightHandThumb2") }, { TEXT("rightThumbDistal"), TEXT("RightHandThumb3") },
	{ TEXT("rightIndexProximal"), TEXT("RightHandIndex1") }, { TEXT("rightIndexIntermediate"), TEXT("RightHandIndex2") }, { TEXT("rightIndexDistal"), TEXT("RightHandIndex3") },
	{ TEXT("rightMiddleProximal"), TEXT("RightHandMiddle1") }, { TEXT("rightMiddleIntermediate"), TEXT("RightHandMiddle2") }, { TEXT("rightMiddleDistal"), TEXT("RightHandMiddle3") },
	{ TEXT("rightRingProximal"), TEXT("RightHandRing1") }, { TEXT("rightRingIntermediate"), TEXT("RightHandRing2") }, { TEXT("rightRingDistal"), TEXT("RightHandRing3") },
	{ TEXT("rightLittleProximal"), TEXT("RightHandPinky1") }, { TEXT("rightLittleIntermediate"), TEXT("RightHandPinky2") }, { TEXT("rightLittleDistal"), TEXT("RightHandPinky3") },
};

// Character Creator 4 / iClone "CC_Base_*" (full prefixed names; AccuRig/ActorCore bare-token variant
// is handled later by prefix stripping). Reallusion's dominant character pipeline.
static const FUniGLBUniBone GUniGLBCharacterCreator[] = {
	{ TEXT("hips"), TEXT("CC_Base_Hip") }, { TEXT("spine"), TEXT("CC_Base_Waist") }, { TEXT("chest"), TEXT("CC_Base_Spine01") }, { TEXT("upperChest"), TEXT("CC_Base_Spine02") },
	{ TEXT("neck"), TEXT("CC_Base_NeckTwist01") }, { TEXT("head"), TEXT("CC_Base_Head") },
	{ TEXT("leftShoulder"), TEXT("CC_Base_L_Clavicle") }, { TEXT("leftUpperArm"), TEXT("CC_Base_L_Upperarm") }, { TEXT("leftLowerArm"), TEXT("CC_Base_L_Forearm") }, { TEXT("leftHand"), TEXT("CC_Base_L_Hand") },
	{ TEXT("rightShoulder"), TEXT("CC_Base_R_Clavicle") }, { TEXT("rightUpperArm"), TEXT("CC_Base_R_Upperarm") }, { TEXT("rightLowerArm"), TEXT("CC_Base_R_Forearm") }, { TEXT("rightHand"), TEXT("CC_Base_R_Hand") },
	{ TEXT("leftUpperLeg"), TEXT("CC_Base_L_Thigh") }, { TEXT("leftLowerLeg"), TEXT("CC_Base_L_Calf") }, { TEXT("leftFoot"), TEXT("CC_Base_L_Foot") }, { TEXT("leftToes"), TEXT("CC_Base_L_ToeBase") },
	{ TEXT("rightUpperLeg"), TEXT("CC_Base_R_Thigh") }, { TEXT("rightLowerLeg"), TEXT("CC_Base_R_Calf") }, { TEXT("rightFoot"), TEXT("CC_Base_R_Foot") }, { TEXT("rightToes"), TEXT("CC_Base_R_ToeBase") },
	{ TEXT("leftThumbProximal"), TEXT("CC_Base_L_Thumb1") }, { TEXT("leftThumbIntermediate"), TEXT("CC_Base_L_Thumb2") }, { TEXT("leftThumbDistal"), TEXT("CC_Base_L_Thumb3") },
	{ TEXT("leftIndexProximal"), TEXT("CC_Base_L_Index1") }, { TEXT("leftIndexIntermediate"), TEXT("CC_Base_L_Index2") }, { TEXT("leftIndexDistal"), TEXT("CC_Base_L_Index3") },
	{ TEXT("leftMiddleProximal"), TEXT("CC_Base_L_Mid1") }, { TEXT("leftMiddleIntermediate"), TEXT("CC_Base_L_Mid2") }, { TEXT("leftMiddleDistal"), TEXT("CC_Base_L_Mid3") },
	{ TEXT("leftRingProximal"), TEXT("CC_Base_L_Ring1") }, { TEXT("leftRingIntermediate"), TEXT("CC_Base_L_Ring2") }, { TEXT("leftRingDistal"), TEXT("CC_Base_L_Ring3") },
	{ TEXT("leftLittleProximal"), TEXT("CC_Base_L_Pinky1") }, { TEXT("leftLittleIntermediate"), TEXT("CC_Base_L_Pinky2") }, { TEXT("leftLittleDistal"), TEXT("CC_Base_L_Pinky3") },
	{ TEXT("rightThumbProximal"), TEXT("CC_Base_R_Thumb1") }, { TEXT("rightThumbIntermediate"), TEXT("CC_Base_R_Thumb2") }, { TEXT("rightThumbDistal"), TEXT("CC_Base_R_Thumb3") },
	{ TEXT("rightIndexProximal"), TEXT("CC_Base_R_Index1") }, { TEXT("rightIndexIntermediate"), TEXT("CC_Base_R_Index2") }, { TEXT("rightIndexDistal"), TEXT("CC_Base_R_Index3") },
	{ TEXT("rightMiddleProximal"), TEXT("CC_Base_R_Mid1") }, { TEXT("rightMiddleIntermediate"), TEXT("CC_Base_R_Mid2") }, { TEXT("rightMiddleDistal"), TEXT("CC_Base_R_Mid3") },
	{ TEXT("rightRingProximal"), TEXT("CC_Base_R_Ring1") }, { TEXT("rightRingIntermediate"), TEXT("CC_Base_R_Ring2") }, { TEXT("rightRingDistal"), TEXT("CC_Base_R_Ring3") },
	{ TEXT("rightLittleProximal"), TEXT("CC_Base_R_Pinky1") }, { TEXT("rightLittleIntermediate"), TEXT("CC_Base_R_Pinky2") }, { TEXT("rightLittleDistal"), TEXT("CC_Base_R_Pinky3") },
};

// DAZ Studio Genesis 8 / 8.1 (camelCase, no prefix). NOTE: weights sometimes live on the *Bend
// sub-bone (lShldrBend, lThighBend, lForearmBend) — a Bend/Twist fallback is added with the prefix work.
static const FUniGLBUniBone GUniGLBDazG8[] = {
	{ TEXT("hips"), TEXT("hip") }, { TEXT("spine"), TEXT("abdomenLower") }, { TEXT("chest"), TEXT("chestLower") }, { TEXT("upperChest"), TEXT("chestUpper") },
	{ TEXT("neck"), TEXT("neckLower") }, { TEXT("head"), TEXT("head") },
	{ TEXT("leftShoulder"), TEXT("lCollar") }, { TEXT("leftUpperArm"), TEXT("lShldr") }, { TEXT("leftLowerArm"), TEXT("lForearm") }, { TEXT("leftHand"), TEXT("lHand") },
	{ TEXT("rightShoulder"), TEXT("rCollar") }, { TEXT("rightUpperArm"), TEXT("rShldr") }, { TEXT("rightLowerArm"), TEXT("rForearm") }, { TEXT("rightHand"), TEXT("rHand") },
	{ TEXT("leftUpperLeg"), TEXT("lThigh") }, { TEXT("leftLowerLeg"), TEXT("lShin") }, { TEXT("leftFoot"), TEXT("lFoot") }, { TEXT("leftToes"), TEXT("lToe") },
	{ TEXT("rightUpperLeg"), TEXT("rThigh") }, { TEXT("rightLowerLeg"), TEXT("rShin") }, { TEXT("rightFoot"), TEXT("rFoot") }, { TEXT("rightToes"), TEXT("rToe") },
	{ TEXT("leftThumbProximal"), TEXT("lThumb1") }, { TEXT("leftThumbIntermediate"), TEXT("lThumb2") }, { TEXT("leftThumbDistal"), TEXT("lThumb3") },
	{ TEXT("leftIndexProximal"), TEXT("lIndex1") }, { TEXT("leftIndexIntermediate"), TEXT("lIndex2") }, { TEXT("leftIndexDistal"), TEXT("lIndex3") },
	{ TEXT("leftMiddleProximal"), TEXT("lMid1") }, { TEXT("leftMiddleIntermediate"), TEXT("lMid2") }, { TEXT("leftMiddleDistal"), TEXT("lMid3") },
	{ TEXT("leftRingProximal"), TEXT("lRing1") }, { TEXT("leftRingIntermediate"), TEXT("lRing2") }, { TEXT("leftRingDistal"), TEXT("lRing3") },
	{ TEXT("leftLittleProximal"), TEXT("lPinky1") }, { TEXT("leftLittleIntermediate"), TEXT("lPinky2") }, { TEXT("leftLittleDistal"), TEXT("lPinky3") },
	{ TEXT("rightThumbProximal"), TEXT("rThumb1") }, { TEXT("rightThumbIntermediate"), TEXT("rThumb2") }, { TEXT("rightThumbDistal"), TEXT("rThumb3") },
	{ TEXT("rightIndexProximal"), TEXT("rIndex1") }, { TEXT("rightIndexIntermediate"), TEXT("rIndex2") }, { TEXT("rightIndexDistal"), TEXT("rIndex3") },
	{ TEXT("rightMiddleProximal"), TEXT("rMid1") }, { TEXT("rightMiddleIntermediate"), TEXT("rMid2") }, { TEXT("rightMiddleDistal"), TEXT("rMid3") },
	{ TEXT("rightRingProximal"), TEXT("rRing1") }, { TEXT("rightRingIntermediate"), TEXT("rRing2") }, { TEXT("rightRingDistal"), TEXT("rRing3") },
	{ TEXT("rightLittleProximal"), TEXT("rPinky1") }, { TEXT("rightLittleIntermediate"), TEXT("rPinky2") }, { TEXT("rightLittleDistal"), TEXT("rPinky3") },
};

// DAZ Studio Genesis 9 (snake_case l_/r_, a DIFFERENT scheme from G8). spine1/2/3 (spine4 prunes).
static const FUniGLBUniBone GUniGLBDazG9[] = {
	{ TEXT("hips"), TEXT("hip") }, { TEXT("spine"), TEXT("spine1") }, { TEXT("chest"), TEXT("spine2") }, { TEXT("upperChest"), TEXT("spine3") },
	{ TEXT("neck"), TEXT("neck1") }, { TEXT("head"), TEXT("head") },
	{ TEXT("leftShoulder"), TEXT("l_shoulder") }, { TEXT("leftUpperArm"), TEXT("l_upperarm") }, { TEXT("leftLowerArm"), TEXT("l_forearm") }, { TEXT("leftHand"), TEXT("l_hand") },
	{ TEXT("rightShoulder"), TEXT("r_shoulder") }, { TEXT("rightUpperArm"), TEXT("r_upperarm") }, { TEXT("rightLowerArm"), TEXT("r_forearm") }, { TEXT("rightHand"), TEXT("r_hand") },
	{ TEXT("leftUpperLeg"), TEXT("l_thigh") }, { TEXT("leftLowerLeg"), TEXT("l_shin") }, { TEXT("leftFoot"), TEXT("l_foot") }, { TEXT("leftToes"), TEXT("l_toes") },
	{ TEXT("rightUpperLeg"), TEXT("r_thigh") }, { TEXT("rightLowerLeg"), TEXT("r_shin") }, { TEXT("rightFoot"), TEXT("r_foot") }, { TEXT("rightToes"), TEXT("r_toes") },
	{ TEXT("leftThumbProximal"), TEXT("l_thumb1") }, { TEXT("leftThumbIntermediate"), TEXT("l_thumb2") }, { TEXT("leftThumbDistal"), TEXT("l_thumb3") },
	{ TEXT("leftIndexProximal"), TEXT("l_index1") }, { TEXT("leftIndexIntermediate"), TEXT("l_index2") }, { TEXT("leftIndexDistal"), TEXT("l_index3") },
	{ TEXT("leftMiddleProximal"), TEXT("l_mid1") }, { TEXT("leftMiddleIntermediate"), TEXT("l_mid2") }, { TEXT("leftMiddleDistal"), TEXT("l_mid3") },
	{ TEXT("leftRingProximal"), TEXT("l_ring1") }, { TEXT("leftRingIntermediate"), TEXT("l_ring2") }, { TEXT("leftRingDistal"), TEXT("l_ring3") },
	{ TEXT("leftLittleProximal"), TEXT("l_pinky1") }, { TEXT("leftLittleIntermediate"), TEXT("l_pinky2") }, { TEXT("leftLittleDistal"), TEXT("l_pinky3") },
	{ TEXT("rightThumbProximal"), TEXT("r_thumb1") }, { TEXT("rightThumbIntermediate"), TEXT("r_thumb2") }, { TEXT("rightThumbDistal"), TEXT("r_thumb3") },
	{ TEXT("rightIndexProximal"), TEXT("r_index1") }, { TEXT("rightIndexIntermediate"), TEXT("r_index2") }, { TEXT("rightIndexDistal"), TEXT("r_index3") },
	{ TEXT("rightMiddleProximal"), TEXT("r_mid1") }, { TEXT("rightMiddleIntermediate"), TEXT("r_mid2") }, { TEXT("rightMiddleDistal"), TEXT("r_mid3") },
	{ TEXT("rightRingProximal"), TEXT("r_ring1") }, { TEXT("rightRingIntermediate"), TEXT("r_ring2") }, { TEXT("rightRingDistal"), TEXT("r_ring3") },
	{ TEXT("rightLittleProximal"), TEXT("r_pinky1") }, { TEXT("rightLittleIntermediate"), TEXT("r_pinky2") }, { TEXT("rightLittleDistal"), TEXT("r_pinky3") },
};

// Blender Rigify generated rig, deform bones "DEF-*" with .L/.R sides. Core chain only (Rigify finger
// names vary by metarig; fingers are optional and not required for the match).
static const FUniGLBUniBone GUniGLBRigifyDEF[] = {
	{ TEXT("hips"), TEXT("DEF-spine") }, { TEXT("spine"), TEXT("DEF-spine.001") }, { TEXT("chest"), TEXT("DEF-spine.002") }, { TEXT("upperChest"), TEXT("DEF-spine.003") },
	{ TEXT("neck"), TEXT("DEF-spine.004") }, { TEXT("head"), TEXT("DEF-spine.006") },
	{ TEXT("leftShoulder"), TEXT("DEF-shoulder.L") }, { TEXT("leftUpperArm"), TEXT("DEF-upper_arm.L") }, { TEXT("leftLowerArm"), TEXT("DEF-forearm.L") }, { TEXT("leftHand"), TEXT("DEF-hand.L") },
	{ TEXT("rightShoulder"), TEXT("DEF-shoulder.R") }, { TEXT("rightUpperArm"), TEXT("DEF-upper_arm.R") }, { TEXT("rightLowerArm"), TEXT("DEF-forearm.R") }, { TEXT("rightHand"), TEXT("DEF-hand.R") },
	{ TEXT("leftUpperLeg"), TEXT("DEF-thigh.L") }, { TEXT("leftLowerLeg"), TEXT("DEF-shin.L") }, { TEXT("leftFoot"), TEXT("DEF-foot.L") }, { TEXT("leftToes"), TEXT("DEF-toe.L") },
	{ TEXT("rightUpperLeg"), TEXT("DEF-thigh.R") }, { TEXT("rightLowerLeg"), TEXT("DEF-shin.R") }, { TEXT("rightFoot"), TEXT("DEF-foot.R") }, { TEXT("rightToes"), TEXT("DEF-toe.R") },
};

// (VRoid J_Bip convention removed — this plugin targets GLB/FBX/OBJ characters, not VRoid/VRM avatars.)

// Meshy AI biped export (GLB). Mixamo-style names WITHOUT the "mixamorig:" prefix, neck is lowercase,
// no finger bones. CRITICAL: Meshy's spine chain is named in REVERSE of the bone order. The actual
// hierarchy is Hips -> Spine02 -> Spine01 -> Spine -> neck, i.e. "Spine02" is the LOWEST spine bone
// (just above the hips) and "Spine" is the HIGHEST (where neck/shoulders attach). Verified from the GLB
// node graph + world Z (Spine02=108, Spine01=120, Spine=131 cm). So map the VRM spine chain bottom->top
// onto Spine02->Spine01->Spine (NOT Spine->Spine01->Spine02, which folds the spine). Verified identical
// for both the human and the alien "creature biped" templates.
static const FUniGLBUniBone GUniGLBMeshy[] = {
	{ TEXT("hips"), TEXT("Hips") }, { TEXT("spine"), TEXT("Spine02") }, { TEXT("chest"), TEXT("Spine01") }, { TEXT("upperChest"), TEXT("Spine") },
	{ TEXT("neck"), TEXT("neck") }, { TEXT("head"), TEXT("Head") },
	{ TEXT("leftShoulder"), TEXT("LeftShoulder") }, { TEXT("leftUpperArm"), TEXT("LeftArm") }, { TEXT("leftLowerArm"), TEXT("LeftForeArm") }, { TEXT("leftHand"), TEXT("LeftHand") },
	{ TEXT("rightShoulder"), TEXT("RightShoulder") }, { TEXT("rightUpperArm"), TEXT("RightArm") }, { TEXT("rightLowerArm"), TEXT("RightForeArm") }, { TEXT("rightHand"), TEXT("RightHand") },
	{ TEXT("leftUpperLeg"), TEXT("LeftUpLeg") }, { TEXT("leftLowerLeg"), TEXT("LeftLeg") }, { TEXT("leftFoot"), TEXT("LeftFoot") }, { TEXT("leftToes"), TEXT("LeftToeBase") },
	{ TEXT("rightUpperLeg"), TEXT("RightUpLeg") }, { TEXT("rightLowerLeg"), TEXT("RightLeg") }, { TEXT("rightFoot"), TEXT("RightFoot") }, { TEXT("rightToes"), TEXT("RightToeBase") },
};

// Unity Humanoid / VRChat / generic glTF-GLB avatar convention. Bare PascalCase HumanBodyBones
// (Hips, LeftUpperArm/LeftLowerArm, LeftUpperLeg/LeftLowerLeg, UpperChest...). DISTINCT from Mixamo
// (LeftArm/LeftForeArm + LeftUpLeg/LeftLeg + Spine1/Spine2). VRoid/VRM "J_Bip_*" rows folded in as
// ALIASES (same humanoid token set, side-coded prefix + numeric fingers + ToeBase); resolved-only, so
// listing both spellings per vrm key is safe (whichever exists wins; absent ones are skipped).
static const FUniGLBUniBone GUniGLBUnityHumanoid[] = {
	{ TEXT("hips"), TEXT("Hips") }, { TEXT("spine"), TEXT("Spine") }, { TEXT("chest"), TEXT("Chest") }, { TEXT("upperChest"), TEXT("UpperChest") },
	{ TEXT("neck"), TEXT("Neck") }, { TEXT("head"), TEXT("Head") },
	{ TEXT("leftShoulder"), TEXT("LeftShoulder") }, { TEXT("leftUpperArm"), TEXT("LeftUpperArm") }, { TEXT("leftLowerArm"), TEXT("LeftLowerArm") }, { TEXT("leftHand"), TEXT("LeftHand") },
	{ TEXT("rightShoulder"), TEXT("RightShoulder") }, { TEXT("rightUpperArm"), TEXT("RightUpperArm") }, { TEXT("rightLowerArm"), TEXT("RightLowerArm") }, { TEXT("rightHand"), TEXT("RightHand") },
	{ TEXT("leftUpperLeg"), TEXT("LeftUpperLeg") }, { TEXT("leftLowerLeg"), TEXT("LeftLowerLeg") }, { TEXT("leftFoot"), TEXT("LeftFoot") }, { TEXT("leftToes"), TEXT("LeftToes") },
	{ TEXT("rightUpperLeg"), TEXT("RightUpperLeg") }, { TEXT("rightLowerLeg"), TEXT("RightLowerLeg") }, { TEXT("rightFoot"), TEXT("RightFoot") }, { TEXT("rightToes"), TEXT("RightToes") },
	{ TEXT("leftThumbProximal"), TEXT("LeftThumbProximal") }, { TEXT("leftThumbIntermediate"), TEXT("LeftThumbIntermediate") }, { TEXT("leftThumbDistal"), TEXT("LeftThumbDistal") },
	{ TEXT("leftIndexProximal"), TEXT("LeftIndexProximal") }, { TEXT("leftIndexIntermediate"), TEXT("LeftIndexIntermediate") }, { TEXT("leftIndexDistal"), TEXT("LeftIndexDistal") },
	{ TEXT("leftMiddleProximal"), TEXT("LeftMiddleProximal") }, { TEXT("leftMiddleIntermediate"), TEXT("LeftMiddleIntermediate") }, { TEXT("leftMiddleDistal"), TEXT("LeftMiddleDistal") },
	{ TEXT("leftRingProximal"), TEXT("LeftRingProximal") }, { TEXT("leftRingIntermediate"), TEXT("LeftRingIntermediate") }, { TEXT("leftRingDistal"), TEXT("LeftRingDistal") },
	{ TEXT("leftLittleProximal"), TEXT("LeftLittleProximal") }, { TEXT("leftLittleIntermediate"), TEXT("LeftLittleIntermediate") }, { TEXT("leftLittleDistal"), TEXT("LeftLittleDistal") },
	{ TEXT("rightThumbProximal"), TEXT("RightThumbProximal") }, { TEXT("rightThumbIntermediate"), TEXT("RightThumbIntermediate") }, { TEXT("rightThumbDistal"), TEXT("RightThumbDistal") },
	{ TEXT("rightIndexProximal"), TEXT("RightIndexProximal") }, { TEXT("rightIndexIntermediate"), TEXT("RightIndexIntermediate") }, { TEXT("rightIndexDistal"), TEXT("RightIndexDistal") },
	{ TEXT("rightMiddleProximal"), TEXT("RightMiddleProximal") }, { TEXT("rightMiddleIntermediate"), TEXT("RightMiddleIntermediate") }, { TEXT("rightMiddleDistal"), TEXT("RightMiddleDistal") },
	{ TEXT("rightRingProximal"), TEXT("RightRingProximal") }, { TEXT("rightRingIntermediate"), TEXT("RightRingIntermediate") }, { TEXT("rightRingDistal"), TEXT("RightRingDistal") },
	{ TEXT("rightLittleProximal"), TEXT("RightLittleProximal") }, { TEXT("rightLittleIntermediate"), TEXT("RightLittleIntermediate") }, { TEXT("rightLittleDistal"), TEXT("RightLittleDistal") },
	{ TEXT("leftLittleProximal"), TEXT("LeftPinkyProximal") }, { TEXT("leftLittleIntermediate"), TEXT("LeftPinkyIntermediate") }, { TEXT("leftLittleDistal"), TEXT("LeftPinkyDistal") },
	{ TEXT("rightLittleProximal"), TEXT("RightPinkyProximal") }, { TEXT("rightLittleIntermediate"), TEXT("RightPinkyIntermediate") }, { TEXT("rightLittleDistal"), TEXT("RightPinkyDistal") },
	// VRoid / three-vrm "J_Bip_*" aliases (UniGLB_StripBonePrefix does NOT strip J_Bip_, so full verbatim names):
	{ TEXT("hips"), TEXT("J_Bip_C_Hips") }, { TEXT("spine"), TEXT("J_Bip_C_Spine") }, { TEXT("chest"), TEXT("J_Bip_C_Chest") }, { TEXT("upperChest"), TEXT("J_Bip_C_UpperChest") },
	{ TEXT("neck"), TEXT("J_Bip_C_Neck") }, { TEXT("head"), TEXT("J_Bip_C_Head") },
	{ TEXT("leftShoulder"), TEXT("J_Bip_L_Shoulder") }, { TEXT("leftUpperArm"), TEXT("J_Bip_L_UpperArm") }, { TEXT("leftLowerArm"), TEXT("J_Bip_L_LowerArm") }, { TEXT("leftHand"), TEXT("J_Bip_L_Hand") },
	{ TEXT("rightShoulder"), TEXT("J_Bip_R_Shoulder") }, { TEXT("rightUpperArm"), TEXT("J_Bip_R_UpperArm") }, { TEXT("rightLowerArm"), TEXT("J_Bip_R_LowerArm") }, { TEXT("rightHand"), TEXT("J_Bip_R_Hand") },
	{ TEXT("leftUpperLeg"), TEXT("J_Bip_L_UpperLeg") }, { TEXT("leftLowerLeg"), TEXT("J_Bip_L_LowerLeg") }, { TEXT("leftFoot"), TEXT("J_Bip_L_Foot") }, { TEXT("leftToes"), TEXT("J_Bip_L_ToeBase") },
	{ TEXT("rightUpperLeg"), TEXT("J_Bip_R_UpperLeg") }, { TEXT("rightLowerLeg"), TEXT("J_Bip_R_LowerLeg") }, { TEXT("rightFoot"), TEXT("J_Bip_R_Foot") }, { TEXT("rightToes"), TEXT("J_Bip_R_ToeBase") },
	{ TEXT("leftThumbProximal"), TEXT("J_Bip_L_Thumb1") }, { TEXT("leftThumbIntermediate"), TEXT("J_Bip_L_Thumb2") }, { TEXT("leftThumbDistal"), TEXT("J_Bip_L_Thumb3") },
	{ TEXT("leftIndexProximal"), TEXT("J_Bip_L_Index1") }, { TEXT("leftIndexIntermediate"), TEXT("J_Bip_L_Index2") }, { TEXT("leftIndexDistal"), TEXT("J_Bip_L_Index3") },
	{ TEXT("leftMiddleProximal"), TEXT("J_Bip_L_Middle1") }, { TEXT("leftMiddleIntermediate"), TEXT("J_Bip_L_Middle2") }, { TEXT("leftMiddleDistal"), TEXT("J_Bip_L_Middle3") },
	{ TEXT("leftRingProximal"), TEXT("J_Bip_L_Ring1") }, { TEXT("leftRingIntermediate"), TEXT("J_Bip_L_Ring2") }, { TEXT("leftRingDistal"), TEXT("J_Bip_L_Ring3") },
	{ TEXT("leftLittleProximal"), TEXT("J_Bip_L_Little1") }, { TEXT("leftLittleIntermediate"), TEXT("J_Bip_L_Little2") }, { TEXT("leftLittleDistal"), TEXT("J_Bip_L_Little3") },
	{ TEXT("rightThumbProximal"), TEXT("J_Bip_R_Thumb1") }, { TEXT("rightThumbIntermediate"), TEXT("J_Bip_R_Thumb2") }, { TEXT("rightThumbDistal"), TEXT("J_Bip_R_Thumb3") },
	{ TEXT("rightIndexProximal"), TEXT("J_Bip_R_Index1") }, { TEXT("rightIndexIntermediate"), TEXT("J_Bip_R_Index2") }, { TEXT("rightIndexDistal"), TEXT("J_Bip_R_Index3") },
	{ TEXT("rightMiddleProximal"), TEXT("J_Bip_R_Middle1") }, { TEXT("rightMiddleIntermediate"), TEXT("J_Bip_R_Middle2") }, { TEXT("rightMiddleDistal"), TEXT("J_Bip_R_Middle3") },
	{ TEXT("rightRingProximal"), TEXT("J_Bip_R_Ring1") }, { TEXT("rightRingIntermediate"), TEXT("J_Bip_R_Ring2") }, { TEXT("rightRingDistal"), TEXT("J_Bip_R_Ring3") },
	{ TEXT("rightLittleProximal"), TEXT("J_Bip_R_Little1") }, { TEXT("rightLittleIntermediate"), TEXT("J_Bip_R_Little2") }, { TEXT("rightLittleDistal"), TEXT("J_Bip_R_Little3") },
};

// Auto-Rig Pro "Universal"/native deform export: dotted .l/.r/.x sides. Core skins on BARE names
// (root.x=hips, spine_01/02/03.x, neck.x, head.x, shoulder/arm/forearm/hand.l/.r, thigh/leg/foot.l/.r --
// lower-leg is 'leg' NOT 'calf'). Fingers: proximal on bare bone, intermediate/distal on the c_-prefixed
// deform bone. StripBonePrefix does NOT strip 'c_' nor '.l/.r/.x', so every Src is the full verbatim name.
static const FUniGLBUniBone GUniGLBAutoRigPro[] = {
	{ TEXT("hips"), TEXT("root.x") }, { TEXT("spine"), TEXT("spine_01.x") }, { TEXT("chest"), TEXT("spine_02.x") }, { TEXT("upperChest"), TEXT("spine_03.x") },
	{ TEXT("neck"), TEXT("neck.x") }, { TEXT("head"), TEXT("head.x") },
	{ TEXT("leftShoulder"), TEXT("shoulder.l") }, { TEXT("leftUpperArm"), TEXT("arm.l") }, { TEXT("leftLowerArm"), TEXT("forearm.l") }, { TEXT("leftHand"), TEXT("hand.l") },
	{ TEXT("rightShoulder"), TEXT("shoulder.r") }, { TEXT("rightUpperArm"), TEXT("arm.r") }, { TEXT("rightLowerArm"), TEXT("forearm.r") }, { TEXT("rightHand"), TEXT("hand.r") },
	{ TEXT("leftUpperLeg"), TEXT("thigh.l") }, { TEXT("leftLowerLeg"), TEXT("leg.l") }, { TEXT("leftFoot"), TEXT("foot.l") }, { TEXT("leftToes"), TEXT("toes_01.l") },
	{ TEXT("rightUpperLeg"), TEXT("thigh.r") }, { TEXT("rightLowerLeg"), TEXT("leg.r") }, { TEXT("rightFoot"), TEXT("foot.r") }, { TEXT("rightToes"), TEXT("toes_01.r") },
	{ TEXT("leftThumbProximal"), TEXT("thumb1.l") }, { TEXT("leftThumbIntermediate"), TEXT("c_thumb2.l") }, { TEXT("leftThumbDistal"), TEXT("c_thumb3.l") },
	{ TEXT("leftIndexProximal"), TEXT("index1.l") }, { TEXT("leftIndexIntermediate"), TEXT("c_index2.l") }, { TEXT("leftIndexDistal"), TEXT("c_index3.l") },
	{ TEXT("leftMiddleProximal"), TEXT("middle1.l") }, { TEXT("leftMiddleIntermediate"), TEXT("c_middle2.l") }, { TEXT("leftMiddleDistal"), TEXT("c_middle3.l") },
	{ TEXT("leftRingProximal"), TEXT("ring1.l") }, { TEXT("leftRingIntermediate"), TEXT("c_ring2.l") }, { TEXT("leftRingDistal"), TEXT("c_ring3.l") },
	{ TEXT("leftLittleProximal"), TEXT("pinky1.l") }, { TEXT("leftLittleIntermediate"), TEXT("c_pinky2.l") }, { TEXT("leftLittleDistal"), TEXT("c_pinky3.l") },
	{ TEXT("rightThumbProximal"), TEXT("thumb1.r") }, { TEXT("rightThumbIntermediate"), TEXT("c_thumb2.r") }, { TEXT("rightThumbDistal"), TEXT("c_thumb3.r") },
	{ TEXT("rightIndexProximal"), TEXT("index1.r") }, { TEXT("rightIndexIntermediate"), TEXT("c_index2.r") }, { TEXT("rightIndexDistal"), TEXT("c_index3.r") },
	{ TEXT("rightMiddleProximal"), TEXT("middle1.r") }, { TEXT("rightMiddleIntermediate"), TEXT("c_middle2.r") }, { TEXT("rightMiddleDistal"), TEXT("c_middle3.r") },
	{ TEXT("rightRingProximal"), TEXT("ring1.r") }, { TEXT("rightRingIntermediate"), TEXT("c_ring2.r") }, { TEXT("rightRingDistal"), TEXT("c_ring3.r") },
	{ TEXT("rightLittleProximal"), TEXT("pinky1.r") }, { TEXT("rightLittleIntermediate"), TEXT("c_pinky2.r") }, { TEXT("rightLittleDistal"), TEXT("c_pinky3.r") },
	{ TEXT("leftThumbIntermediate"), TEXT("thumb2.l") }, { TEXT("leftThumbDistal"), TEXT("thumb3.l") }, { TEXT("leftIndexIntermediate"), TEXT("index2.l") }, { TEXT("leftIndexDistal"), TEXT("index3.l") },
	{ TEXT("leftMiddleIntermediate"), TEXT("middle2.l") }, { TEXT("leftMiddleDistal"), TEXT("middle3.l") }, { TEXT("leftRingIntermediate"), TEXT("ring2.l") }, { TEXT("leftRingDistal"), TEXT("ring3.l") },
	{ TEXT("leftLittleIntermediate"), TEXT("pinky2.l") }, { TEXT("leftLittleDistal"), TEXT("pinky3.l") },
	{ TEXT("rightThumbIntermediate"), TEXT("thumb2.r") }, { TEXT("rightThumbDistal"), TEXT("thumb3.r") }, { TEXT("rightIndexIntermediate"), TEXT("index2.r") }, { TEXT("rightIndexDistal"), TEXT("index3.r") },
	{ TEXT("rightMiddleIntermediate"), TEXT("middle2.r") }, { TEXT("rightMiddleDistal"), TEXT("middle3.r") }, { TEXT("rightRingIntermediate"), TEXT("ring2.r") }, { TEXT("rightRingDistal"), TEXT("ring3.r") },
	{ TEXT("rightLittleIntermediate"), TEXT("pinky2.r") }, { TEXT("rightLittleDistal"), TEXT("pinky3.r") },
};

// MMD / PMX (MikuMikuDance) Japanese bone names. Stored as \uXXXX escapes so the file stays pure ASCII
// (no UTF-8-BOM dependency; \u in a TEXT()/wide literal is always 4 hex digits, trailing 0-3 are literal).
// hips=lower-body (U+4E0B U+534A U+8EAB), side is a PREFIX U+5DE6(L)/U+53F3(R). Pure CJK => zero collision
// with ASCII conventions. upperChest (U+4E0A U+534A U+8EAB '3') is often absent -> handled by the gate.
static const FUniGLBUniBone GUniGLBMMD[] = {
	{ TEXT("hips"), TEXT("\u4E0B\u534A\u8EAB") }, { TEXT("spine"), TEXT("\u4E0A\u534A\u8EAB") }, { TEXT("chest"), TEXT("\u4E0A\u534A\u8EAB2") }, { TEXT("upperChest"), TEXT("\u4E0A\u534A\u8EAB3") },
	{ TEXT("neck"), TEXT("\u9996") }, { TEXT("head"), TEXT("\u982D") },
	{ TEXT("leftShoulder"), TEXT("\u5DE6\u80A9") }, { TEXT("leftUpperArm"), TEXT("\u5DE6\u8155") }, { TEXT("leftLowerArm"), TEXT("\u5DE6\u3072\u3058") }, { TEXT("leftHand"), TEXT("\u5DE6\u624B\u9996") },
	{ TEXT("rightShoulder"), TEXT("\u53F3\u80A9") }, { TEXT("rightUpperArm"), TEXT("\u53F3\u8155") }, { TEXT("rightLowerArm"), TEXT("\u53F3\u3072\u3058") }, { TEXT("rightHand"), TEXT("\u53F3\u624B\u9996") },
	{ TEXT("leftUpperLeg"), TEXT("\u5DE6\u8DB3") }, { TEXT("leftLowerLeg"), TEXT("\u5DE6\u3072\u3056") }, { TEXT("leftFoot"), TEXT("\u5DE6\u8DB3\u9996") }, { TEXT("leftToes"), TEXT("\u5DE6\u3064\u307E\u5148") },
	{ TEXT("rightUpperLeg"), TEXT("\u53F3\u8DB3") }, { TEXT("rightLowerLeg"), TEXT("\u53F3\u3072\u3056") }, { TEXT("rightFoot"), TEXT("\u53F3\u8DB3\u9996") }, { TEXT("rightToes"), TEXT("\u53F3\u3064\u307E\u5148") },
	{ TEXT("leftThumbProximal"), TEXT("\u5DE6\u89AA\u63070") }, { TEXT("leftThumbIntermediate"), TEXT("\u5DE6\u89AA\u63071") }, { TEXT("leftThumbDistal"), TEXT("\u5DE6\u89AA\u63072") },
	{ TEXT("leftIndexProximal"), TEXT("\u5DE6\u4EBA\u63071") }, { TEXT("leftIndexIntermediate"), TEXT("\u5DE6\u4EBA\u63072") }, { TEXT("leftIndexDistal"), TEXT("\u5DE6\u4EBA\u63073") },
	{ TEXT("leftMiddleProximal"), TEXT("\u5DE6\u4E2D\u63071") }, { TEXT("leftMiddleIntermediate"), TEXT("\u5DE6\u4E2D\u63072") }, { TEXT("leftMiddleDistal"), TEXT("\u5DE6\u4E2D\u63073") },
	{ TEXT("leftRingProximal"), TEXT("\u5DE6\u85AC\u63071") }, { TEXT("leftRingIntermediate"), TEXT("\u5DE6\u85AC\u63072") }, { TEXT("leftRingDistal"), TEXT("\u5DE6\u85AC\u63073") },
	{ TEXT("leftLittleProximal"), TEXT("\u5DE6\u5C0F\u63071") }, { TEXT("leftLittleIntermediate"), TEXT("\u5DE6\u5C0F\u63072") }, { TEXT("leftLittleDistal"), TEXT("\u5DE6\u5C0F\u63073") },
	{ TEXT("rightThumbProximal"), TEXT("\u53F3\u89AA\u63070") }, { TEXT("rightThumbIntermediate"), TEXT("\u53F3\u89AA\u63071") }, { TEXT("rightThumbDistal"), TEXT("\u53F3\u89AA\u63072") },
	{ TEXT("rightIndexProximal"), TEXT("\u53F3\u4EBA\u63071") }, { TEXT("rightIndexIntermediate"), TEXT("\u53F3\u4EBA\u63072") }, { TEXT("rightIndexDistal"), TEXT("\u53F3\u4EBA\u63073") },
	{ TEXT("rightMiddleProximal"), TEXT("\u53F3\u4E2D\u63071") }, { TEXT("rightMiddleIntermediate"), TEXT("\u53F3\u4E2D\u63072") }, { TEXT("rightMiddleDistal"), TEXT("\u53F3\u4E2D\u63073") },
	{ TEXT("rightRingProximal"), TEXT("\u53F3\u85AC\u63071") }, { TEXT("rightRingIntermediate"), TEXT("\u53F3\u85AC\u63072") }, { TEXT("rightRingDistal"), TEXT("\u53F3\u85AC\u63073") },
	{ TEXT("rightLittleProximal"), TEXT("\u53F3\u5C0F\u63071") }, { TEXT("rightLittleIntermediate"), TEXT("\u53F3\u5C0F\u63072") }, { TEXT("rightLittleDistal"), TEXT("\u53F3\u5C0F\u63073") },
	// Aliases (resolved-only): elbow U+8098, knee U+819D, toe-tip EX, full-width finger digits U+FF10-U+FF13.
	{ TEXT("leftLowerArm"), TEXT("\u5DE6\u8098") }, { TEXT("rightLowerArm"), TEXT("\u53F3\u8098") }, { TEXT("leftLowerLeg"), TEXT("\u5DE6\u819D") }, { TEXT("rightLowerLeg"), TEXT("\u53F3\u819D") },
	{ TEXT("leftToes"), TEXT("\u5DE6\u8DB3\u5148EX") }, { TEXT("rightToes"), TEXT("\u53F3\u8DB3\u5148EX") },
	{ TEXT("leftThumbProximal"), TEXT("\u5DE6\u89AA\u6307\uFF10") }, { TEXT("leftThumbIntermediate"), TEXT("\u5DE6\u89AA\u6307\uFF11") }, { TEXT("leftThumbDistal"), TEXT("\u5DE6\u89AA\u6307\uFF12") },
	{ TEXT("leftIndexProximal"), TEXT("\u5DE6\u4EBA\u6307\uFF11") }, { TEXT("leftIndexIntermediate"), TEXT("\u5DE6\u4EBA\u6307\uFF12") }, { TEXT("leftIndexDistal"), TEXT("\u5DE6\u4EBA\u6307\uFF13") },
	{ TEXT("leftMiddleProximal"), TEXT("\u5DE6\u4E2D\u6307\uFF11") }, { TEXT("leftMiddleIntermediate"), TEXT("\u5DE6\u4E2D\u6307\uFF12") }, { TEXT("leftMiddleDistal"), TEXT("\u5DE6\u4E2D\u6307\uFF13") },
	{ TEXT("leftRingProximal"), TEXT("\u5DE6\u85AC\u6307\uFF11") }, { TEXT("leftRingIntermediate"), TEXT("\u5DE6\u85AC\u6307\uFF12") }, { TEXT("leftRingDistal"), TEXT("\u5DE6\u85AC\u6307\uFF13") },
	{ TEXT("leftLittleProximal"), TEXT("\u5DE6\u5C0F\u6307\uFF11") }, { TEXT("leftLittleIntermediate"), TEXT("\u5DE6\u5C0F\u6307\uFF12") }, { TEXT("leftLittleDistal"), TEXT("\u5DE6\u5C0F\u6307\uFF13") },
	{ TEXT("rightThumbProximal"), TEXT("\u53F3\u89AA\u6307\uFF10") }, { TEXT("rightThumbIntermediate"), TEXT("\u53F3\u89AA\u6307\uFF11") }, { TEXT("rightThumbDistal"), TEXT("\u53F3\u89AA\u6307\uFF12") },
	{ TEXT("rightIndexProximal"), TEXT("\u53F3\u4EBA\u6307\uFF11") }, { TEXT("rightIndexIntermediate"), TEXT("\u53F3\u4EBA\u6307\uFF12") }, { TEXT("rightIndexDistal"), TEXT("\u53F3\u4EBA\u6307\uFF13") },
	{ TEXT("rightMiddleProximal"), TEXT("\u53F3\u4E2D\u6307\uFF11") }, { TEXT("rightMiddleIntermediate"), TEXT("\u53F3\u4E2D\u6307\uFF12") }, { TEXT("rightMiddleDistal"), TEXT("\u53F3\u4E2D\u6307\uFF13") },
	{ TEXT("rightRingProximal"), TEXT("\u53F3\u85AC\u6307\uFF11") }, { TEXT("rightRingIntermediate"), TEXT("\u53F3\u85AC\u6307\uFF12") }, { TEXT("rightRingDistal"), TEXT("\u53F3\u85AC\u6307\uFF13") },
	{ TEXT("rightLittleProximal"), TEXT("\u53F3\u5C0F\u6307\uFF11") }, { TEXT("rightLittleIntermediate"), TEXT("\u53F3\u5C0F\u6307\uFF12") }, { TEXT("rightLittleDistal"), TEXT("\u53F3\u5C0F\u6307\uFF13") },
};

// "mixamorig:Hips", "mixamorigHips", "Armature|Hips" and "Hips" all reduce to "Hips".
static FString UniGLB_StripBonePrefix(const FString& In) {
	FString S = In;
	int32 Idx = INDEX_NONE;
	if (S.FindLastChar(TEXT(':'), Idx)) S = S.RightChop(Idx + 1);
	if (S.FindLastChar(TEXT('|'), Idx)) S = S.RightChop(Idx + 1);
	if (S.StartsWith(TEXT("mixamorig"), ESearchCase::IgnoreCase)) {
		S = S.RightChop(9);
		if (S.StartsWith(TEXT("_")) || S.StartsWith(TEXT(":"))) S = S.RightChop(1);
	}
	return S;
}

// Detect the convention and fill UniGLBMetaObject->humanoidBoneTable. Returns false (clean abort,
// logged) if no supported convention covers the bones ProcessNativeMannyGASP requires.
static bool UniGLB_BuildHumanoidTableFromConvention(UUniGLBAssetListObject* InUniGLBAsset) {
	if (InUniGLBAsset == nullptr || InUniGLBAsset->SkeletalMesh == nullptr || InUniGLBAsset->UniGLBMetaObject == nullptr) {
		UE_LOG(LogUniGLBLoader, Error, TEXT("UniversalMannyGASP: missing SkeletalMesh/UniGLBMetaObject, aborting."));
		return false;
	}
	USkeleton* Skeleton = UniGLBGetSkeleton(InUniGLBAsset->SkeletalMesh);
	if (Skeleton == nullptr) {
		UE_LOG(LogUniGLBLoader, Error, TEXT("UniversalMannyGASP: SkeletalMesh has no skeleton, aborting."));
		return false;
	}
	const FReferenceSkeleton& Ref = Skeleton->GetReferenceSkeleton();
	const int32 BoneNum = Ref.GetRawBoneNum();
	if (BoneNum == 0) {
		UE_LOG(LogUniGLBLoader, Error, TEXT("UniversalMannyGASP: skeleton has 0 bones, aborting."));
		return false;
	}

	// If a humanoid map already exists (option enabled on a real VRM, or a re-import), keep it --
	// never overwrite a VRM-provided mapping with a convention guess.
	if (InUniGLBAsset->UniGLBMetaObject->humanoidBoneTable.Num() > 0) {
		UE_LOG(LogUniGLBLoader, Log, TEXT("UniversalMannyGASP: humanoidBoneTable already populated (%d entries); using it as-is."), InUniGLBAsset->UniGLBMetaObject->humanoidBoneTable.Num());
		return true;
	}

	TArray<FString> BoneNames;
	BoneNames.Reserve(BoneNum);
	for (int32 i = 0; i < BoneNum; ++i) {
		BoneNames.Add(Ref.GetBoneName(i).ToString());
	}

	// Resolve a convention token to the ACTUAL bone name in the skeleton (exact, then prefix-stripped).
	auto FindActualBone = [&BoneNames](const FString& Token) -> FString {
		for (const FString& B : BoneNames) {
			if (B.Equals(Token, ESearchCase::IgnoreCase)) return B;
		}
		for (const FString& B : BoneNames) {
			if (UniGLB_StripBonePrefix(B).Equals(Token, ESearchCase::IgnoreCase)) return B;
		}
		return FString();
	};

	// VRM humanoid names that MUST resolve for ProcessNativeMannyGASP (its required Manny bones:
	// pelvis, spine_01..03, neck_01, head, both arm chains incl. middle_01 used for the A-pose
	// direction, both leg chains). 'root' is synthesised by renameToUE4Bone, so it is not listed.
	static const TCHAR* const RequiredUniGLB[] = {
		TEXT("hips"), TEXT("spine"), TEXT("chest"), TEXT("neck"), TEXT("head"), // upperChest OPTIONAL: 2-spine rigs (Unity w/o UpperChest, MMD w/o upper-body-3) - dynamic spine injects spine_03/04/05
		TEXT("leftShoulder"), TEXT("leftUpperArm"), TEXT("leftLowerArm"), TEXT("leftHand"),
		TEXT("rightShoulder"), TEXT("rightUpperArm"), TEXT("rightLowerArm"), TEXT("rightHand"),
		TEXT("leftUpperLeg"), TEXT("leftLowerLeg"), TEXT("leftFoot"),
		TEXT("rightUpperLeg"), TEXT("rightLowerLeg"), TEXT("rightFoot"),
	};

	struct FCand { FString Name; TArray<TPair<FString, FString>> Pairs; }; // Pairs: uniGLBName -> srcToken
	TArray<FCand> Cands;
	{
		FCand C; C.Name = TEXT("Mixamo/ReadyPlayerMe");
		for (const FUniGLBUniBone& M : GUniGLBMixamoRPM) C.Pairs.Emplace(FString(M.UniGLB), FString(M.Src));
		Cands.Add(MoveTemp(C));
	}
	{
		FCand C; C.Name = TEXT("Meshy AI biped");
		for (const FUniGLBUniBone& M : GUniGLBMeshy) C.Pairs.Emplace(FString(M.UniGLB), FString(M.Src));
		Cands.Add(MoveTemp(C));
	}
	{
		FCand C; C.Name = TEXT("Character Creator / iClone");
		for (const FUniGLBUniBone& M : GUniGLBCharacterCreator) C.Pairs.Emplace(FString(M.UniGLB), FString(M.Src));
		Cands.Add(MoveTemp(C));
	}
	{
		FCand C; C.Name = TEXT("DAZ Genesis 8");
		for (const FUniGLBUniBone& M : GUniGLBDazG8) C.Pairs.Emplace(FString(M.UniGLB), FString(M.Src));
		Cands.Add(MoveTemp(C));
	}
	{
		FCand C; C.Name = TEXT("DAZ Genesis 9");
		for (const FUniGLBUniBone& M : GUniGLBDazG9) C.Pairs.Emplace(FString(M.UniGLB), FString(M.Src));
		Cands.Add(MoveTemp(C));
	}
	{
		FCand C; C.Name = TEXT("Blender Rigify (DEF-)");
		for (const FUniGLBUniBone& M : GUniGLBRigifyDEF) C.Pairs.Emplace(FString(M.UniGLB), FString(M.Src));
		Cands.Add(MoveTemp(C));
	}
	{
		FCand C; C.Name = TEXT("Already UE/Manny");
		for (const UniGLBUtil::UniGLBBoneTable& T : UniGLBUtil::table_ue4_vrm) {
			if (T.BoneVRM.IsEmpty() || T.BoneUE4.IsEmpty()) continue;
			C.Pairs.Emplace(T.BoneVRM, T.BoneUE4);
		}
		Cands.Add(MoveTemp(C));
	}
	{
		FCand C; C.Name = TEXT("Unity Humanoid / VRChat");
		for (const FUniGLBUniBone& M : GUniGLBUnityHumanoid) C.Pairs.Emplace(FString(M.UniGLB), FString(M.Src));
		Cands.Add(MoveTemp(C));
	}
	{
		FCand C; C.Name = TEXT("Auto-Rig Pro (Universal)");
		for (const FUniGLBUniBone& M : GUniGLBAutoRigPro) C.Pairs.Emplace(FString(M.UniGLB), FString(M.Src));
		Cands.Add(MoveTemp(C));
	}
	{
		FCand C; C.Name = TEXT("MMD / PMX");
		for (const FUniGLBUniBone& M : GUniGLBMMD) C.Pairs.Emplace(FString(M.UniGLB), FString(M.Src));
		Cands.Add(MoveTemp(C));
	}

	for (const FCand& Cand : Cands) {
		TMap<FString, FString> Resolved; // uniGLBName -> actual source bone name
		for (const TPair<FString, FString>& P : Cand.Pairs) {
			const FString Actual = FindActualBone(P.Value);
			if (!Actual.IsEmpty()) Resolved.Add(P.Key, Actual);
		}

		TArray<FString> Missing;
		for (const TCHAR* R : RequiredUniGLB) {
			if (!Resolved.Contains(FString(R))) Missing.Add(FString(R));
		}

		if (Missing.Num() == 0) {
			TMap<FString, FString>& Table = InUniGLBAsset->UniGLBMetaObject->humanoidBoneTable;
			for (const TPair<FString, FString>& P : Resolved) {
				Table.Add(P.Key, P.Value);
			}
			UE_LOG(LogUniGLBLoader, Log, TEXT("UniversalMannyGASP: convention '%s' matched, %d humanoid bones mapped. Proceeding."), *Cand.Name, Resolved.Num());
			return true;
		}

		UE_LOG(LogUniGLBLoader, Log, TEXT("UniversalMannyGASP: convention '%s' rejected (%d/%d required bones missing, first: %s)."),
			*Cand.Name, Missing.Num(), (int32)UE_ARRAY_COUNT(RequiredUniGLB), *Missing[0]);
	}

	UE_LOG(LogUniGLBLoader, Error, TEXT("UniversalMannyGASP: no supported humanoid convention recognized (tried Mixamo/ReadyPlayerMe, Meshy AI biped, Character Creator/iClone, DAZ Genesis 8, DAZ Genesis 9, Blender Rigify, Manny, Unity Humanoid/VRChat, Auto-Rig Pro, MMD/PMX). Aborting; mesh left as imported. The source needs a full humanoid bone set under one of those naming schemes."));
	UniGLB_NotifyImport(TEXT("UniGLB: source skeleton not recognized (Mixamo/RPM, Meshy, CC4/iClone, DAZ G8/G9, Rigify, Manny, Unity, AutoRigPro, MMD). Character imported as-is (no Manny conversion). See Output Log."), true);
	return false;
}

void UUniGLBLoaderBPFunctionLibrary::ProcessNativeMannyGASP(UUniGLBAssetListObject* InUniGLBAsset) {
	(void)InUniGLBAsset;
#if WITH_EDITOR
	if (InUniGLBAsset == nullptr || InUniGLBAsset->SkeletalMesh == nullptr) return;
	USkeletalMesh* sk = InUniGLBAsset->SkeletalMesh;
	USkeleton* Skeleton = UniGLBGetSkeleton(sk);
	if (Skeleton == nullptr) return;

	// The VRM import builds this SkeletalMesh asynchronously. We are about to mutate its
	// ImportedModel + RenderData and rebuild it; flush any in-flight async compilation FIRST,
	// otherwise the build task is destroyed mid-work => assert WorkNotFinishedCounter==0
	// (check builds) / Access Violation in CalculateInvRefMatrices (release) on complex meshes.
	USkinnedAsset* PendingAssets[] = { sk };
	FSkinnedAssetCompilingManager::Get().FinishCompilation(PendingAssets);
	sk->WaitForPendingInitOrStreaming();

	// Keep the VRoid's OWN skeleton + proportions; restructure it to the Mannequin bone names /
	// topology (inject the Manny-only bones incl. FK twist + IK), pose it to A-pose and bake the
	// mesh on its OWN skeleton (T->A, so only the arms move => no distortion). Then mark Manny as
	// a compatible skeleton so its / GASP animations play with NO IK retarget.

	// 1. rename VRoid bones to UE/Manny names.
	UniGLBConvertHumanoid::renameToUE4Bone(sk, InUniGLBAsset->UniGLBMetaObject, sk);

	// Guard: if the humanoid bone table is empty (non-VRM source with unrecognized naming convention),
	// the rename above was a no-op and the inject loop below would place every Manny bone at ZeroVector
	// (catastrophic collapse). Abort cleanly.
	if (InUniGLBAsset->UniGLBMetaObject)
	{
		int32 MappedCount = 0;
		for (auto& Pair : InUniGLBAsset->UniGLBMetaObject->humanoidBoneTable) { if (!Pair.Value.IsEmpty()) ++MappedCount; }
		if (MappedCount < 5)
		{
			UE_LOG(LogUniGLBLoader, Error, TEXT("NativeMannyGASP: humanoid bone table has only %d mapped entries (need >=5 for a valid humanoid). Source naming convention not recognized. Aborting; mesh left intact."), MappedCount);
			UniGLB_NotifyImport(TEXT("UniGLB: source skeleton naming not recognized for Native Manny conversion. Try 'Universal Manny/GASP' or import via 'Retarget Animation to Manny' only."), true);
			// Retargeting modes not set yet (SetSafeRetargetingModes defined after Skeleton check below).
			// But rename was a no-op (table empty), so bone names are still source-original → no Manny
			// anim will play via compatible skeleton → safe to return without mode override.
			return;
		}
	}

	// 2. load the Mannequin (source of A-pose direction + the Manny-only bones). Resolve via the shared
	//    resolver (stock paths + AssetRegistry name-match) so a user-imported Manny placed ANYWHERE
	//    under /Game is found with zero config.
	// Safe retargeting modes for abort paths: if we bail out mid-conversion, the bones are already
	// renamed to Manny names (step 1), so Manny anims may play via compatible-skeleton. Without
	// setting Skeleton mode, the default Animation mode stamps Manny bone TRANSLATIONS onto the
	// source proportions → squashed/stretched mesh. This lambda sets safe modes before any abort.
	auto SetSafeRetargetingModes = [&]() {
		const FReferenceSkeleton& SafeRef = Skeleton->GetReferenceSkeleton();
		for (int32 i = 0; i < SafeRef.GetRawBoneNum(); ++i)
		{
			Skeleton->SetBoneTranslationRetargetingMode(i, EBoneTranslationRetargetingMode::Skeleton);
		}
		const int32 ri = SafeRef.FindBoneIndex(TEXT("root"));
		if (ri != INDEX_NONE) Skeleton->SetBoneTranslationRetargetingMode(ri, EBoneTranslationRetargetingMode::Animation);
		const int32 pi = SafeRef.FindBoneIndex(TEXT("pelvis"));
		if (pi != INDEX_NONE) Skeleton->SetBoneTranslationRetargetingMode(pi, EBoneTranslationRetargetingMode::AnimationScaled);
	};

	USkeletalMesh* MannyMesh = UniGLB_ResolveMannySkeletalMesh();
	if (MannyMesh == nullptr) {
		UE_LOG(LogUniGLBLoader, Error, TEXT("NativeMannyGASP: no Manny SkeletalMesh found in the project. Import a UE5 Manny (e.g. SK_Mannequin_MANNY_APOSE.fbx) anywhere under /Game with 'Manny' or 'Mannequin' in its name, then re-import. Aborting; mesh left renamed-only (no Manny topology / no prune)."));
		UniGLB_NotifyImport(TEXT("UniGLB: no Manny skeletal mesh found under /Game. Import a UE5 Manny (name contains 'Manny'/'Mannequin'), then re-import. Character left renamed-only."), true);
		SetSafeRetargetingModes();
		return;
	}
	UE_LOG(LogUniGLBLoader, Log, TEXT("NativeMannyGASP: Mannequin = %s"), *MannyMesh->GetPathName());
	USkeleton* MannySkeleton = UniGLBGetSkeleton(MannyMesh);
	const FReferenceSkeleton MannyRef = UniGLBGetRefSkeleton(MannyMesh);

	auto CompXform = [](const FReferenceSkeleton& Ref, int32 BoneIdx) -> FTransform {
		FTransform T = FTransform::Identity;
		for (int32 i = BoneIdx; i != INDEX_NONE; i = Ref.GetParentIndex(i)) T = T * Ref.GetRefBonePose()[i];
		return T;
	};

	FReferenceSkeleton& RefSkeleton = UniGLBGetRefSkeleton(sk);

	// 3. restructure VRoid skeleton to the Mannequin topology. Inject every Manny bone the VRoid
	//    lacks (spine_04/05, neck_02, center_of_mass, FK twist, IK...) at Manny's local offset,
	//    then reparent the shared bones to the Manny hierarchy. VRoid bone WORLD positions are
	//    preserved by the rebuild, so the mesh keeps its proportions.
	{
		FNativeBoneEdit Edit;

		// VRoid landmark world position / rotation (current skeleton).
		auto Pos = [&](const TCHAR* n) -> FVector {
			const int32 idx = RefSkeleton.FindBoneIndex(n);
			return (idx != INDEX_NONE) ? CompXform(RefSkeleton, idx).GetLocation() : FVector::ZeroVector;
		};
		auto Rot = [&](const TCHAR* n) -> FQuat {
			const int32 idx = RefSkeleton.FindBoneIndex(n);
			return (idx != INDEX_NONE) ? CompXform(RefSkeleton, idx).GetRotation() : FQuat::Identity;
		};

		// Dynamic spine: place MISSING Manny spines between the TOPMOST EXISTING spine and neck_01, NOT over
		// the full pelvis->neck arc. This keeps the ORIGINAL behavior for 3-spine sources (Meshy: spine_03
		// present -> spine_04/05 land at Lerp(spine_03, neck, 1/3 & 2/3), strictly ABOVE spine_03), and
		// still handles 2-spine sources (spine_03 absent -> spine_03/04/05 distributed between spine_02 and
		// neck). Sampling the full arc folded the upper spine because spine_03 sits past 2/3 of it.
		int32 TopSpineIdx = 0; const TCHAR* TopSpine = TEXT("pelvis");
		if (RefSkeleton.FindBoneIndex(TEXT("spine_03")) != INDEX_NONE) { TopSpineIdx = 3; TopSpine = TEXT("spine_03"); }
		else if (RefSkeleton.FindBoneIndex(TEXT("spine_02")) != INDEX_NONE) { TopSpineIdx = 2; TopSpine = TEXT("spine_02"); }
		else if (RefSkeleton.FindBoneIndex(TEXT("spine_01")) != INDEX_NONE) { TopSpineIdx = 1; TopSpine = TEXT("spine_01"); }
		auto SpineSlot = [&](int32 k) -> FVector { // k in 3..5: fraction from the top EXISTING spine (idx TopSpineIdx) up to neck_01 (idx 6)
			const float frac = (float)(k - TopSpineIdx) / (float)(6 - TopSpineIdx);
			return FMath::Lerp(Pos(TopSpine), Pos(TEXT("neck_01")), FMath::Clamp(frac, 0.f, 1.f));
		};

		// Place each Manny-only bone by VRoid landmarks (world space) so it lands in the right
		// spot regardless of the VRoid vs Manny local bone-axis convention.
		auto Place = [&](const FName& Nm, FTransform& OutWorld) -> bool {
			const FString S = Nm.ToString();
			auto L = [&](const TCHAR* a, const TCHAR* b, float t, const TCHAR* r) { OutWorld = FTransform(Rot(r), FMath::Lerp(Pos(a), Pos(b), t)); return true; };
			auto A = [&](const TCHAR* a, const TCHAR* r) { OutWorld = FTransform(Rot(r), Pos(a)); return true; };
			// Spine slots sampled along the dynamic torso polyline (handles 2- and 3-spine sources). Only
			// MISSING spines reach here (present ones are skipped by the inject loop). Rotation is a
			// placeholder (overwritten by the axis re-base pass); only POSITION matters.
			if (S == TEXT("spine_03"))        { OutWorld = FTransform(Rot(TopSpine), SpineSlot(3)); return true; }
			if (S == TEXT("spine_04"))        { OutWorld = FTransform(Rot(TopSpine), SpineSlot(4)); return true; }
			if (S == TEXT("spine_05"))        { OutWorld = FTransform(Rot(TopSpine), SpineSlot(5)); return true; }
			if (S == TEXT("neck_02"))         return L(TEXT("neck_01"), TEXT("head"), 0.5f, TEXT("neck_01"));
			if (S == TEXT("center_of_mass"))  return A(TEXT("pelvis"), TEXT("pelvis"));
			if (S == TEXT("interaction"))     return A(TEXT("pelvis"), TEXT("pelvis"));
			if (S == TEXT("ik_foot_root"))    return A(TEXT("root"), TEXT("root"));
			if (S == TEXT("ik_hand_root"))    return A(TEXT("root"), TEXT("root"));
			if (S == TEXT("ik_hand_gun"))     return A(TEXT("hand_r"), TEXT("root"));
			if (S == TEXT("ik_foot_l"))       return A(TEXT("foot_l"), TEXT("foot_l"));
			if (S == TEXT("ik_foot_r"))       return A(TEXT("foot_r"), TEXT("foot_r"));
			if (S == TEXT("ik_hand_l"))       return A(TEXT("hand_l"), TEXT("hand_l"));
			if (S == TEXT("ik_hand_r"))       return A(TEXT("hand_r"), TEXT("hand_r"));
			struct FTw { const TCHAR* N; const TCHAR* A; const TCHAR* B; float T; };
			static const FTw Tw[] = {
				{ TEXT("upperarm_twist_01_l"), TEXT("upperarm_l"), TEXT("lowerarm_l"), 0.33f }, { TEXT("upperarm_twist_02_l"), TEXT("upperarm_l"), TEXT("lowerarm_l"), 0.66f },
				{ TEXT("lowerarm_twist_01_l"), TEXT("lowerarm_l"), TEXT("hand_l"), 0.33f },      { TEXT("lowerarm_twist_02_l"), TEXT("lowerarm_l"), TEXT("hand_l"), 0.66f },
				{ TEXT("thigh_twist_01_l"), TEXT("thigh_l"), TEXT("calf_l"), 0.33f },            { TEXT("thigh_twist_02_l"), TEXT("thigh_l"), TEXT("calf_l"), 0.66f },
				{ TEXT("calf_twist_01_l"), TEXT("calf_l"), TEXT("foot_l"), 0.33f },              { TEXT("calf_twist_02_l"), TEXT("calf_l"), TEXT("foot_l"), 0.66f },
				{ TEXT("upperarm_twist_01_r"), TEXT("upperarm_r"), TEXT("lowerarm_r"), 0.33f }, { TEXT("upperarm_twist_02_r"), TEXT("upperarm_r"), TEXT("lowerarm_r"), 0.66f },
				{ TEXT("lowerarm_twist_01_r"), TEXT("lowerarm_r"), TEXT("hand_r"), 0.33f },      { TEXT("lowerarm_twist_02_r"), TEXT("lowerarm_r"), TEXT("hand_r"), 0.66f },
				{ TEXT("thigh_twist_01_r"), TEXT("thigh_r"), TEXT("calf_r"), 0.33f },            { TEXT("thigh_twist_02_r"), TEXT("thigh_r"), TEXT("calf_r"), 0.66f },
				{ TEXT("calf_twist_01_r"), TEXT("calf_r"), TEXT("foot_r"), 0.33f },              { TEXT("calf_twist_02_r"), TEXT("calf_r"), TEXT("foot_r"), 0.66f },
			};
			for (const FTw& t : Tw) if (S == t.N) return L(t.A, t.B, t.T, t.A);
			return false;
		};

		// Uniform scale (source vs Manny torso height) used to size transplanted injected bones.
		float InjectScale = 1.f;
		{
			auto Dist = [&](const FReferenceSkeleton& R, const TCHAR* a, const TCHAR* b) -> float {
				const int32 ia = R.FindBoneIndex(a), ib = R.FindBoneIndex(b);
				if (ia == INDEX_NONE || ib == INDEX_NONE) return 0.f;
				return (float)(CompXform(R, ia).GetLocation() - CompXform(R, ib).GetLocation()).Size();
			};
			const float SrcH = Dist(RefSkeleton, TEXT("pelvis"), TEXT("head"));
			const float MannyH = Dist(MannyRef, TEXT("pelvis"), TEXT("head"));
			if (SrcH > 1.f && MannyH > 1.f) InjectScale = SrcH / MannyH;
		}

		for (int32 i = 0; i < MannyRef.GetRawBoneNum(); ++i) {
			const FName Nm = MannyRef.GetBoneName(i);
			if (RefSkeleton.FindBoneIndex(Nm) != INDEX_NONE) continue;
			const int32 P = MannyRef.GetParentIndex(i);
			const FName ParentNm = (P == INDEX_NONE) ? NAME_None : MannyRef.GetBoneName(P);
			FTransform World;
			if (Place(Nm, World)) {
				Edit.Inject.Add({ Nm, ParentNm, FTransform::Identity, true, World });
			} else {
				// Injected Manny-only bone the source lacks (mostly fingers). Manny's LOCAL offset lives
				// in Manny's bone-axis frame; applied to a source bone whose axes differ (e.g. a hand with
				// no fingers) it splays the bone outside the mesh. Transplant Manny's shape in WORLD space
				// instead: anchor to the nearest ancestor that EXISTS in the source, keep Manny's
				// world-relative offset (axis-convention independent), scaled to the source proportions.
				int32 AncM = P;
				while (AncM != INDEX_NONE && RefSkeleton.FindBoneIndex(MannyRef.GetBoneName(AncM)) == INDEX_NONE)
					AncM = MannyRef.GetParentIndex(AncM);
				const int32 SrcAncIdx = (AncM != INDEX_NONE) ? RefSkeleton.FindBoneIndex(MannyRef.GetBoneName(AncM)) : INDEX_NONE;
				if (SrcAncIdx != INDEX_NONE) {
					FTransform Rel = CompXform(MannyRef, i).GetRelativeTransform(CompXform(MannyRef, AncM));
					Rel.SetTranslation(Rel.GetTranslation() * InjectScale);
					const FTransform Target = Rel * CompXform(RefSkeleton, SrcAncIdx);
					Edit.Inject.Add({ Nm, ParentNm, FTransform::Identity, true, Target });
				} else {
					Edit.Inject.Add({ Nm, ParentNm, MannyRef.GetRefBonePose()[i], false, FTransform::Identity });
				}
			}
		}
		for (int32 i = 0; i < MannyRef.GetRawBoneNum(); ++i) {
			const FName Nm = MannyRef.GetBoneName(i);
			if (RefSkeleton.FindBoneIndex(Nm) == INDEX_NONE) continue;
			const int32 P = MannyRef.GetParentIndex(i);
			if (P != INDEX_NONE) Edit.Reparent.Add(Nm, MannyRef.GetBoneName(P));
		}
		// Prune every existing source bone that is NOT part of the canonical Manny skeleton, so the
		// rebuild yields a clean Manny (no source/Manny hybrid). Pruned bones' skin weights collapse
		// to their nearest surviving Manny ancestor. Never prune the current root (index 0).
		{
			TSet<FName> MannyNames;
			for (int32 i = 0; i < MannyRef.GetRawBoneNum(); ++i) MannyNames.Add(MannyRef.GetBoneName(i));
			for (int32 i = 1; i < RefSkeleton.GetRawBoneNum(); ++i) {
				const FName Nm = RefSkeleton.GetBoneName(i);
				if (!MannyNames.Contains(Nm)) Edit.Remove.Add(Nm);
			}
			UE_LOG(LogUniGLBLoader, Log, TEXT("NativeMannyGASP: pruning %d non-Manny source bones (source total %d, Manny=%d)"), Edit.Remove.Num(), RefSkeleton.GetRawBoneNum(), MannyRef.GetRawBoneNum());
		}
		if (!RebuildSkeletonOrdered(sk, Skeleton, Edit)) {
			UE_LOG(LogUniGLBLoader, Error, TEXT("NativeMannyGASP: skeleton rebuild failed (topo incomplete/duplicate), aborting; mesh left intact."));
			UniGLB_NotifyImport(TEXT("UniGLB: Manny skeleton rebuild failed (incomplete/duplicate topology). Character left intact (no Manny conversion). See Output Log."), true);
			SetSafeRetargetingModes();
			return;
		}
		UE_LOG(LogUniGLBLoader, Log, TEXT("NativeMannyGASP: after rebuild %d bones (Manny=%d)"), RefSkeleton.GetRawBoneNum(), MannyRef.GetRawBoneNum());
	}

	// 3b. UNIFORM SCALE-TO-MANNY. A source FBX authored in a different unit imports oversize/undersize (e.g. a
	//     Mixamo char at pelvis->head=3184, mesh bbox=10000 vs Manny ~70/180 -> ~50x). The rename+inject+prune
	//     above keeps SOURCE positions, so the result is a correct-topology but mis-SIZED Manny skeleton; then
	//     Manny/GASP retarget + AddCompatibleSkeleton break and the rig dwarfs/under-sizes the real Manny (this
	//     is the "bones don't match Manny" symptom - the NAMES match, the POSITIONS are 50x off). Measure source
	//     vs Manny pelvis->head and scale the WHOLE character uniformly to Manny size: the skeleton (folded into
	//     the re-base translation below) + the mesh verts + morph deltas (loop after the re-base). Uniform =>
	//     proportions preserved, only overall size normalized. ~1.0 (no-op) for sources already at Manny scale.
	float GlobalScale = 1.f;
	{
		auto PHDist = [&](const FReferenceSkeleton& R) -> float {
			const int32 ip = R.FindBoneIndex(TEXT("pelvis")), ih = R.FindBoneIndex(TEXT("head"));
			if (ip == INDEX_NONE || ih == INDEX_NONE) return 0.f;
			return (float)(CompXform(R, ih).GetLocation() - CompXform(R, ip).GetLocation()).Size();
		};
		const float SrcPH = PHDist(RefSkeleton), MannyPH = PHDist(MannyRef);
		if (SrcPH > KINDA_SMALL_NUMBER && MannyPH > KINDA_SMALL_NUMBER) GlobalScale = MannyPH / SrcPH;
		if (FMath::IsNearlyEqual(GlobalScale, 1.f, 0.02f)) GlobalScale = 1.f; // skip work when already Manny-scale
		UE_LOG(LogUniGLBLoader, Log, TEXT("NativeMannyGASP: global scale-to-Manny = %.4f (src pelvis->head=%.1f, Manny=%.1f)."), GlobalScale, SrcPH, MannyPH);
	}

	// 4. Re-base the skeleton onto Manny's CANONICAL bone AXES, keeping each bone's source world
	//    POSITION (so the character keeps its own proportions). THIS is what fixes the "desaxe"
	//    skeleton: after rename+inject+prune the bones carry Manny names/topology but still hold the
	//    GLB's arbitrary Blender bone-roll quaternions; here we overwrite each bone's REST ROTATION
	//    with Manny's so the bind axes match Manny -> the skeleton sits straight in the body and
	//    Manny/GASP animations play with correct roll/twist. The MESH is NOT re-baked: at the ref
	//    pose, linear-blend skinning returns the stored vertices for ANY bind orientation
	//    (Comp * Comp^-1 = I), so CalculateInvRefMatrices() further below rebuilds the inverse-bind
	//    and the imported A-pose skin is preserved EXACTLY. (Re-baking vertices to FOLLOW a bone
	//    reorientation is exactly what hunched/deformed the mesh before, so that bake is removed.)
	{
		FReferenceSkeletonModifier Modifier(RefSkeleton, Skeleton);
		TMap<int32, FTransform> TargetComp; // bone idx -> final component(world) transform, filled parent-first
		const int32 BoneCount = RefSkeleton.GetRawBoneNum();
		int32 ReorientedCount = 0;
		for (int32 i = 0; i < BoneCount; ++i) {
			// Skip the canonical root BY NAME (not index 0): Meshy/Blender put a synthetic
			// "Armature"->root at index 0, but Mixamo/ReadyPlayerMe put the skinned Hips->pelvis at
			// index 0. Skipping by name keeps the +X facing pass as the sole owner of "root" while
			// still re-basing a humanoid bone-0 when no separate root exists.
			if (RefSkeleton.GetBoneName(i) == TEXT("root")) continue;
			const int32 Mi = MannyRef.FindBoneIndex(RefSkeleton.GetBoneName(i));
			if (Mi == INDEX_NONE) continue; // every surviving bone is a Manny bone post-prune; guard anyway
			// Target component = Manny canonical world ROTATION + this bone's CURRENT source world
			// POSITION. Force UNIT scale: Manny bones are unit-scale and the character's proportions
			// live in the world TRANSLATIONS, so carrying a baked-in source bind scale would only
			// mis-scale retargeted GASP limbs at animation time (ref-pose skin is invariant either way).
			// CompXform reads stay STABLE during the pass because the modifier does not reflect
			// intermediate UpdateRefPoseTransform calls; so we feed each child its parent's FINAL target
			// from TargetComp (parent index < child index is guaranteed by the rebuild) rather than a
			// half-updated CompXform -> no akimbo/staleness.
			const FTransform Cur = CompXform(RefSkeleton, i);
			// World position scaled to Manny size (GlobalScale, uniform about the origin/root). Parent targets in
			// TargetComp are likewise scaled, so the parent-relative local transform carries the scaled offset.
			const FTransform Tgt(CompXform(MannyRef, Mi).GetRotation().GetNormalized(), Cur.GetTranslation() * GlobalScale, FVector::OneVector);
			TargetComp.Add(i, Tgt);
			const int32 Pi = RefSkeleton.GetParentIndex(i);
			const FTransform ParentTgt = (Pi != INDEX_NONE && TargetComp.Contains(Pi)) ? TargetComp[Pi] : CompXform(RefSkeleton, Pi);
			Modifier.UpdateRefPoseTransform(i, Tgt.GetRelativeTransform(ParentTgt));
			++ReorientedCount;
		}
		UE_LOG(LogUniGLBLoader, Log, TEXT("NativeMannyGASP: re-based %d bones onto Manny canonical axes (source positions kept)."), ReorientedCount);
	}
	RefSkeleton.RebuildRefSkeleton(Skeleton, true);

	// Apply the SAME global scale to the MESH + morph deltas so they match the now-scaled skeleton (the
	// hand-fit + facing passes below then measure the correctly-sized mesh). Scale about the origin (root is
	// at origin) -> uniform, proportions preserved. Skipped when GlobalScale==1 (already Manny-scale). The
	// inverse-bind + bounds are refreshed below (CalculateInvRefMatrices / CalculateExtendedBounds / Build).
	if (GlobalScale != 1.f) {
		if (FSkeletalMeshModel* Model = sk->GetImportedModel()) {
			for (FSkeletalMeshLODModel& LOD : Model->LODModels) {
				for (FSkelMeshSection& Sec : LOD.Sections) {
					for (FSoftSkinVertex& V : Sec.SoftVertices) {
						V.Position *= GlobalScale;
					}
				}
			}
		}
		for (UMorphTarget* MT : sk->GetMorphTargets()) {
			if (!MT) continue;
			for (FMorphTargetLODModel& MLOD : MT->GetMorphLODModels()) {
				for (FMorphTargetDelta& D : MLOD.Vertices) {
					D.PositionDelta *= GlobalScale;
				}
			}
		}
		UE_LOG(LogUniGLBLoader, Log, TEXT("NativeMannyGASP: scaled mesh + morph deltas by %.4f to Manny size."), GlobalScale);
	}

	// T-POSE -> A-POSE repose (arms). Per-SEGMENT measurement: check upperarm→lowerarm AND lowerarm→hand
	// separately. If both segments agree on being T-ish (drop < Manny's A-pose drop), rigid-rotate the
	// arm subtree to Manny's A-pose. If segments DISAGREE (one T-ish, one already dropped — meaning the
	// elbow is bent), SKIP the repose for this arm and log a warning. The old single-vector measurement
	// (upperarm→hand) gave wrong angles on bent elbows, cisailling the shoulder.
	{
		FSkeletalMeshModel* TModel = sk->GetImportedModel();
		struct FArmDef { const TCHAR* Up; const TCHAR* Lo; const TCHAR* Hand; const TCHAR* Suffix; };
		static const FArmDef Arms[] = {
			{ TEXT("upperarm_l"), TEXT("lowerarm_l"), TEXT("hand_l"), TEXT("_l") },
			{ TEXT("upperarm_r"), TEXT("lowerarm_r"), TEXT("hand_r"), TEXT("_r") }
		};
		for (const FArmDef& AD : Arms) {
			const int32 ui = RefSkeleton.FindBoneIndex(AD.Up), li = RefSkeleton.FindBoneIndex(AD.Lo), hi = RefSkeleton.FindBoneIndex(AD.Hand);
			const int32 mui = MannyRef.FindBoneIndex(AD.Up), mli = MannyRef.FindBoneIndex(AD.Lo), mhi = MannyRef.FindBoneIndex(AD.Hand);
			if (ui == INDEX_NONE || hi == INDEX_NONE || mui == INDEX_NONE || mhi == INDEX_NONE) continue;
			// If lowerarm exists, measure per-segment; otherwise fall back to overall measurement.
			const bool bHasLo = (li != INDEX_NONE && mli != INDEX_NONE);
			// Per-segment drop measurement (Z-only, frame-independent).
			auto MeasureDrop = [&](const FReferenceSkeleton& R, int32 a, int32 b) -> float {
				FVector Dir = CompXform(R, b).GetLocation() - CompXform(R, a).GetLocation();
				if (!Dir.Normalize()) return 0.f;
				return FMath::Asin(FMath::Clamp(-Dir.Z, -1.f, 1.f));
			};
			float SrcDropUpper, SrcDropLower, MannyDropUpper, MannyDropLower;
			if (bHasLo)
			{
				SrcDropUpper = MeasureDrop(RefSkeleton, ui, li);
				SrcDropLower = MeasureDrop(RefSkeleton, li, hi);
				MannyDropUpper = MeasureDrop(MannyRef, mui, mli);
				MannyDropLower = MeasureDrop(MannyRef, mli, mhi);
				// Coherence check: both segments should be T-ish (need repose) or both A-ish (no-op).
				// If they disagree, the arm is bent at the elbow → skip to avoid cisaille.
				const bool bUpperNeedsRepose = (SrcDropUpper < MannyDropUpper - 0.26f);
				const bool bLowerNeedsRepose = (SrcDropLower < MannyDropLower - 0.26f);
				if (bUpperNeedsRepose != bLowerNeedsRepose)
				{
					UE_LOG(LogUniGLBLoader, Warning, TEXT("NativeMannyGASP: T->A repose %s arm SKIPPED — segments disagree (upper needs=%d, lower needs=%d). Elbow likely bent; forcing repose would cisaille."), AD.Suffix, bUpperNeedsRepose, bLowerNeedsRepose);
					continue;
				}
				if (!bUpperNeedsRepose) continue; // both already A-ish → no-op
			}
			else
			{
				// No lowerarm bone: fallback to overall measurement.
				SrcDropUpper = MeasureDrop(RefSkeleton, ui, hi);
				MannyDropUpper = MeasureDrop(MannyRef, mui, mhi);
				if (SrcDropUpper >= MannyDropUpper - 0.26f) continue;
			}
			// Use OVERALL direction for the actual rotation (same as before, but now we know segments are coherent).
			const FVector Pivot = CompXform(RefSkeleton, ui).GetLocation();
			FVector SrcDir = CompXform(RefSkeleton, hi).GetLocation() - Pivot;
			FVector MannyDir = CompXform(MannyRef, mhi).GetLocation() - CompXform(MannyRef, mui).GetLocation();
			if (!SrcDir.Normalize() || !MannyDir.Normalize()) continue;
			const float SrcDrop = FMath::Asin(FMath::Clamp(-(float)SrcDir.Z, -1.f, 1.f));
			const float MannyDrop = FMath::Asin(FMath::Clamp(-(float)MannyDir.Z, -1.f, 1.f));
			if (SrcDrop >= MannyDrop - 0.26f) continue;
			const float AngleDeg = FMath::RadiansToDegrees(MannyDrop - SrcDrop);
			// Target = the arm at Manny's drop angle, keeping the source's OWN horizontal direction (no yaw change).
			FVector H(SrcDir.X, SrcDir.Y, 0.0); if (!H.Normalize()) continue;
			const FVector TargetDir = (FMath::Cos(MannyDrop) * H - FMath::Sin(MannyDrop) * FVector::UpVector).GetSafeNormal();
			const FQuat R = FQuat::FindBetweenNormals(SrcDir, TargetDir).GetNormalized();
			auto RotAbout = [&](const FVector& P) -> FVector { return Pivot + R.RotateVector(P - Pivot); };
			// arm subtree (upperarm/lowerarm/hand + twists + fingers on this side; NOT clavicle - pivot is the shoulder)
			TSet<int32> ArmSet;
			for (int32 b = 0; b < RefSkeleton.GetRawBoneNum(); ++b) {
				const FString Nm = RefSkeleton.GetBoneName(b).ToString();
				if (!Nm.EndsWith(AD.Suffix)) continue;
				if (Nm.StartsWith(TEXT("upperarm")) || Nm.StartsWith(TEXT("lowerarm")) || Nm.StartsWith(TEXT("hand")) ||
					Nm.Contains(TEXT("thumb")) || Nm.Contains(TEXT("index")) || Nm.Contains(TEXT("middle")) ||
					Nm.Contains(TEXT("ring")) || Nm.Contains(TEXT("pinky")) || Nm.Contains(TEXT("metacarpal")) ||
					Nm.Contains(TEXT("arm_twist"))) { ArmSet.Add(b); }
			}
			if (ArmSet.Num() == 0) continue;
			// (1) rotate arm-subtree BONE positions by R about the pivot (keep Manny rotations from the re-base).
			{
				FReferenceSkeletonModifier Mod(RefSkeleton, Skeleton);
				TMap<int32, FTransform> NewComp;
				const int32 BC = RefSkeleton.GetRawBoneNum();
				for (int32 b = 0; b < BC; ++b) {
					FTransform New = CompXform(RefSkeleton, b);
					if (ArmSet.Contains(b)) New.SetLocation(RotAbout(New.GetLocation()));
					NewComp.Add(b, New);
				}
				for (int32 b : ArmSet) {
					const int32 Pi = RefSkeleton.GetParentIndex(b);
					const FTransform ParentNew = (Pi != INDEX_NONE && NewComp.Contains(Pi)) ? NewComp[Pi] : FTransform::Identity;
					Mod.UpdateRefPoseTransform(b, NewComp[b].GetRelativeTransform(ParentNew));
				}
			}
			RefSkeleton.RebuildRefSkeleton(Skeleton, true);
			// (2) bake arm-weighted VERTICES by the SAME R about the pivot (forward repose: mesh follows bones).
			if (TModel && TModel->LODModels.Num() > 0) {
				for (FSkelMeshSection& Sec : TModel->LODModels[0].Sections) {
					for (FSoftSkinVertex& V : Sec.SoftVertices) {
						float armW = 0.f, totW = 0.f;
						for (int32 k = 0; k < MAX_TOTAL_INFLUENCES; ++k) {
							const uint32 w = (uint32)V.InfluenceWeights[k];
							if (w == 0) continue; totW += (float)w;
							const int32 Local = V.InfluenceBones[k];
							if (Sec.BoneMap.IsValidIndex(Local) && ArmSet.Contains(Sec.BoneMap[Local])) armW += (float)w;
						}
						if (totW <= 0.f || armW <= 0.f) continue;
						const float t = armW / totW;
						const FVector P0(V.Position.X, V.Position.Y, V.Position.Z);
						const FVector Pn = FMath::Lerp(P0, RotAbout(P0), t);
						V.Position = FVector3f((float)Pn.X, (float)Pn.Y, (float)Pn.Z);
						const FQuat Rt = FQuat::Slerp(FQuat::Identity, R, t).GetNormalized();
						const FVector TX = Rt.RotateVector(FVector(V.TangentX.X, V.TangentX.Y, V.TangentX.Z));
						const FVector TZ = Rt.RotateVector(FVector(V.TangentZ.X, V.TangentZ.Y, V.TangentZ.Z));
						V.TangentX = FVector3f((float)TX.X, (float)TX.Y, (float)TX.Z);
						V.TangentZ = FVector4f((float)TZ.X, (float)TZ.Y, (float)TZ.Z, V.TangentZ.W);
					}
				}
			}
			UE_LOG(LogUniGLBLoader, Log, TEXT("NativeMannyGASP: T->A repose %s arm (%.0f deg) - rotated %d bones + skin to Manny A-pose."), AD.Suffix, AngleDeg, ArmSet.Num());
		}
	}

	// Hands: the Meshy source has NO finger bones, so Manny's fingers were injected; and the reorient gave
	// each hand Manny's canonical world rotation. But this character's wrist HANGS (the mesh fingers point
	// nearly straight down) while Manny's hand continues the arm line - so the Manny-shaped fingers miss
	// the mesh hand entirely. Fit each hand to the MESH, derived from the hand's own skinned vertices:
	//   (A) finger bones get Manny's local pose scaled to the mesh hand length (wrist -> fingertip),
	//   (B) the hand bone is rotated so the fingers follow the mesh finger DIRECTION.
	// The mesh never moves (CalculateInvRefMatrices below refreshes the inverse-bind); only the bones move
	// to hug the mesh. Hand POSITION is unchanged (rotation about the wrist), so the arm chain + IK are safe.
	// Runs before the facing yaw; the yaw then rotates the aligned hands rigidly with everything else.
	{
		FSkeletalMeshModel* HModel = sk->GetImportedModel();
		auto BDist = [&](const FReferenceSkeleton& R, const TCHAR* a, const TCHAR* b) -> float {
			const int32 ia = R.FindBoneIndex(a), ib = R.FindBoneIndex(b);
			if (ia == INDEX_NONE || ib == INDEX_NONE) return 0.f;
			return (float)(CompXform(R, ia).GetLocation() - CompXform(R, ib).GetLocation()).Size();
		};
		struct FHandDef { const TCHAR* Hand; const TCHAR* Tip; const TCHAR* Suffix; };
		static const FHandDef HandDefs[] = {
			{ TEXT("hand_l"), TEXT("middle_03_l"), TEXT("_l") },
			{ TEXT("hand_r"), TEXT("middle_03_r"), TEXT("_r") },
		};
		for (const FHandDef& HD : HandDefs) {
			const int32 hi = RefSkeleton.FindBoneIndex(HD.Hand);
			if (hi == INDEX_NONE) continue;
			const FVector Wrist = CompXform(RefSkeleton, hi).GetLocation();

			// Mesh hand analysis: gather vertices whose DOMINANT bone is this hand; fingertip = centroid of
			// the farthest 25% from the wrist; MeshFwd = wrist -> fingertip; MeshLen = that distance.
			FVector MeshFwd = FVector::ZeroVector; float MeshLen = 0.f;
			if (HModel && HModel->LODModels.Num() > 0) {
				TArray<FVector> HV;
				for (FSkelMeshSection& Sec : HModel->LODModels[0].Sections) {
					for (FSoftSkinVertex& V : Sec.SoftVertices) {
						int32 best = INDEX_NONE; uint32 bestw = 0;
						for (int32 k = 0; k < MAX_TOTAL_INFLUENCES; ++k) { const uint32 w = (uint32)V.InfluenceWeights[k]; if (w > bestw) { bestw = w; best = k; } }
						if (best == INDEX_NONE) continue;
						const int32 Local = V.InfluenceBones[best];
						if (Sec.BoneMap.IsValidIndex(Local) && Sec.BoneMap[Local] == hi)
							HV.Add(FVector(V.Position.X, V.Position.Y, V.Position.Z));
					}
				}
				if (HV.Num() >= 8) {
					HV.Sort([&](const FVector& A, const FVector& B) { return (A - Wrist).SizeSquared() > (B - Wrist).SizeSquared(); });
					const int32 NFar = FMath::Max(1, HV.Num() / 4);
					FVector Tip(0, 0, 0); for (int32 t = 0; t < NFar; ++t) Tip += HV[t]; Tip /= (float)NFar;
					MeshFwd = Tip - Wrist; MeshLen = (float)MeshFwd.Size();
					if (MeshLen > 1.f) MeshFwd /= MeshLen; else MeshFwd = FVector::ZeroVector;
				}
			}

			// (A) finger locals = Manny local, scaled to the mesh hand length (fallback: forearm ratio).
			float Scale = 1.f;
			const float MannyLen = BDist(MannyRef, HD.Hand, HD.Tip);
			if (MeshLen > 1.f && MannyLen > 1.f) Scale = MeshLen / MannyLen;
			else {
				const TCHAR* Fore = (HD.Suffix[1] == TEXT('l')) ? TEXT("lowerarm_l") : TEXT("lowerarm_r");
				const float SrcArm = BDist(RefSkeleton, Fore, HD.Hand), MannyArm = BDist(MannyRef, Fore, HD.Hand);
				if (SrcArm > 1.f && MannyArm > 1.f) Scale = SrcArm / MannyArm;
			}
			{
				FReferenceSkeletonModifier Mod(RefSkeleton, Skeleton);
				for (int32 i = 0; i < RefSkeleton.GetRawBoneNum(); ++i) {
					const FString Nm = RefSkeleton.GetBoneName(i).ToString();
					if (!Nm.EndsWith(HD.Suffix)) continue;
					const bool bFinger = Nm.Contains(TEXT("thumb")) || Nm.Contains(TEXT("index")) || Nm.Contains(TEXT("middle"))
						|| Nm.Contains(TEXT("ring")) || Nm.Contains(TEXT("pinky")) || Nm.Contains(TEXT("metacarpal"));
					if (!bFinger) continue;
					const int32 mi = MannyRef.FindBoneIndex(RefSkeleton.GetBoneName(i));
					if (mi == INDEX_NONE) continue;
					FTransform L = MannyRef.GetRefBonePose()[mi];
					L.SetTranslation(L.GetTranslation() * Scale);
					Mod.UpdateRefPoseTransform(i, L);
				}
			}
			RefSkeleton.RebuildRefSkeleton(Skeleton, true);

			// (B) rotate the hand bone so the (now Manny-shaped) fingers follow the mesh finger direction.
			if (!MeshFwd.IsNearlyZero()) {
				const int32 ti = RefSkeleton.FindBoneIndex(HD.Tip);
				if (ti != INDEX_NONE) {
					FVector CurFwd = CompXform(RefSkeleton, ti).GetLocation() - Wrist;
					if (CurFwd.SizeSquared() > 1.f) {
						CurFwd.Normalize();
						const FQuat DeltaR = FQuat::FindBetweenNormals(CurFwd, MeshFwd);
						if (FMath::Abs(DeltaR.W) < 0.99995f) {
							const FTransform HW = CompXform(RefSkeleton, hi);
							const FTransform NewHW(DeltaR * HW.GetRotation(), HW.GetLocation(), HW.GetScale3D());
							const int32 Pi = RefSkeleton.GetParentIndex(hi);
							const FTransform ParentW = (Pi != INDEX_NONE) ? CompXform(RefSkeleton, Pi) : FTransform::Identity;
							FReferenceSkeletonModifier Mod(RefSkeleton, Skeleton);
							Mod.UpdateRefPoseTransform(hi, NewHW.GetRelativeTransform(ParentW));
						}
					}
				}
			}
			RefSkeleton.RebuildRefSkeleton(Skeleton, true);
		}
		UE_LOG(LogUniGLBLoader, Log, TEXT("NativeMannyGASP: fitted hands + fingers to the mesh (direction + length)."));
	}

		// Snap the IK bones onto the source-pose hands/feet. The modifier does NOT reflect
		// intermediate UpdateRefPoseTransform calls inside CompXform, so we precompute ALL target
		// world transforms FIRST, then set each local relative to its KNOWN final parent world
		// (ik_hand_l/r parent = ik_hand_gun whose final world = hand_r). This is what left
		// ik_hand_l floating above the head before.
		{
			auto W = [&](const TCHAR* n) -> FTransform {
				const int32 i = RefSkeleton.FindBoneIndex(n);
				return (i != INDEX_NONE) ? CompXform(RefSkeleton, i) : FTransform::Identity;
			};
			const FTransform HandR = W(TEXT("hand_r"));
			const FTransform HandL = W(TEXT("hand_l"));
			const FTransform FootR = W(TEXT("foot_r"));
			const FTransform FootL = W(TEXT("foot_l"));
			const FTransform IKHandRoot = W(TEXT("ik_hand_root"));
			const FTransform IKFootRoot = W(TEXT("ik_foot_root"));

			FReferenceSkeletonModifier Mod(RefSkeleton, Skeleton);
			auto SetWorld = [&](const TCHAR* bone, const FTransform& WorldT, const FTransform& ParentWorldT) {
				const int32 bi = RefSkeleton.FindBoneIndex(bone);
				if (bi != INDEX_NONE) Mod.UpdateRefPoseTransform(bi, WorldT.GetRelativeTransform(ParentWorldT));
			};
			SetWorld(TEXT("ik_hand_gun"), HandR, IKHandRoot); // parent ik_hand_root
			SetWorld(TEXT("ik_hand_l"),   HandL, HandR);      // parent ik_hand_gun (final = hand_r)
			SetWorld(TEXT("ik_hand_r"),   HandR, HandR);
			SetWorld(TEXT("ik_foot_l"),   FootL, IKFootRoot); // parent ik_foot_root
			SetWorld(TEXT("ik_foot_r"),   FootR, IKFootRoot);
		}
		RefSkeleton.RebuildRefSkeleton(Skeleton, true);

		// NO per-vertex re-bake. The bones were only RE-ORIENTED (rest rotation swapped to Manny axes,
		// world positions kept); at the ref pose the skin is invariant to bind orientation, and
		// CalculateInvRefMatrices() below rebuilds the inverse-bind so the imported A-pose mesh is
		// preserved EXACTLY. Baking vertices to FOLLOW the reorientation is what hunched the mesh.

	// Face the character toward the user / Manny's front (UE forward = +X) so it opens facing the editor
	// camera and the Manny animation library retargets without the character turned sideways/backward.
	// Forward is derived from the SHOULDER + HIP line (wide, always-present, reliable for any pose),
	// NOT the toes: the toe->heel horizontal span can fall below threshold and skip, which left the model
	// in its native (backward) orientation. UE convention: facing +X => the right side is at +Y, so
	// right = (upperarm_r - upperarm_l) + (thigh_r - thigh_l) and forward = right x up. The whole skeleton
	// is rigidly yawed about the root so forward == +X (self-correcting, incl. a full 180 deg back->front;
	// identity if already correct). A rigid root rotation moves mesh + bones together => no skin deform.
	{
		FReferenceSkeleton& Ref = UniGLBGetRefSkeleton(sk);
		auto WLoc = [&](const TCHAR* n) -> FVector {
			const int32 i = Ref.FindBoneIndex(n);
			return (i != INDEX_NONE) ? CompXform(Ref, i).GetLocation() : FVector::ZeroVector;
		};
		// Forward from the TOES: the ball (toe) sits ahead of the foot (heel), so ball-foot is the model's
		// TRUE front - anatomically unambiguous. (The shoulder cross-product is NOT reliable: this rig's
		// left/right handedness is mirrored vs Manny, so right x up points backward. Toes don't flip.)
		// Reliable now that the basis fix places the feet correctly (toe span ~20 cm, well above threshold).
		FVector Fwd = (WLoc(TEXT("ball_l")) - WLoc(TEXT("foot_l"))) + (WLoc(TEXT("ball_r")) - WLoc(TEXT("foot_r")));
		Fwd.Z = 0.f;
		// TARGET = MANNY's OWN forward, measured the SAME way from MannyRef, NOT a hardcoded +X. The UE
		// standard mesh (SKM_Manny) is authored facing +Y in asset space; the ThirdPerson Character BP
		// applies a -90 deg mesh-component yaw to turn that into the capsule's +X (movement forward).
		// Aligning the import to +X instead left it 90 deg off in gameplay (it ran sideways). Matching
		// Manny's asset-space forward makes the character drop into Manny's EXACT BP (same component yaw,
		// works in any rig where Manny works) and move/animate in the correct direction.
		auto MLoc = [&](const TCHAR* n) -> FVector {
			const int32 i = MannyRef.FindBoneIndex(n);
			return (i != INDEX_NONE) ? CompXform(MannyRef, i).GetLocation() : FVector::ZeroVector;
		};
		FVector MannyFwd = (MLoc(TEXT("ball_l")) - MLoc(TEXT("foot_l"))) + (MLoc(TEXT("ball_r")) - MLoc(TEXT("foot_r")));
		MannyFwd.Z = 0.f;
		if (MannyFwd.SizeSquared() <= 1.f) MannyFwd = FVector(1.f, 0.f, 0.f); // fallback if Manny toes degenerate
		MannyFwd.Normalize();
		if (Fwd.SizeSquared() > 1.f) {
			Fwd.Normalize();
			const FQuat Yaw = FQuat::FindBetweenNormals(Fwd, MannyFwd);
			if (FMath::Abs(Yaw.W) < 0.9995f) { // only correct a real (> ~3.6 deg) mis-facing
				FTransform RootT = Ref.GetRefBonePose()[0];
				RootT.SetRotation((Yaw * RootT.GetRotation()).GetNormalized());
				{
					FReferenceSkeletonModifier Mod(Ref, Skeleton);
					Mod.UpdateRefPoseTransform(0, RootT);
				}
				Ref.RebuildRefSkeleton(Skeleton, true);

				// Rotate the MESH GEOMETRY by the SAME yaw (about the root at origin). Rotating only the
				// skeleton does NOT turn the visible reference-pose mesh - LBS returns the stored vertices
				// regardless of bind orientation - so the vertices must be rotated too (this is what the
				// user saw: skeleton spun, mesh stayed facing away). The root-bind rotation above rotates
				// every bone's world position by exactly Yaw about origin, so Yaw.RotateVector(vertex)
				// keeps mesh and skeleton rigidly together (no skin deform). CalculateInvRefMatrices()
				// further below refreshes the inverse-bind for the rotated skeleton.
				if (FSkeletalMeshModel* Model = sk->GetImportedModel()) {
					for (FSkeletalMeshLODModel& LOD : Model->LODModels) {
						for (FSkelMeshSection& Sec : LOD.Sections) {
							for (FSoftSkinVertex& V : Sec.SoftVertices) {
								const FVector P  = Yaw.RotateVector(FVector(V.Position.X, V.Position.Y, V.Position.Z));
								const FVector TX = Yaw.RotateVector(FVector(V.TangentX.X, V.TangentX.Y, V.TangentX.Z));
								const FVector TY = Yaw.RotateVector(FVector(V.TangentY.X, V.TangentY.Y, V.TangentY.Z));
								const FVector TZ = Yaw.RotateVector(FVector(V.TangentZ.X, V.TangentZ.Y, V.TangentZ.Z));
								V.Position = FVector3f((float)P.X, (float)P.Y, (float)P.Z);
								V.TangentX = FVector3f((float)TX.X, (float)TX.Y, (float)TX.Z);
								V.TangentY = FVector3f((float)TY.X, (float)TY.Y, (float)TY.Z);
								V.TangentZ = FVector4f((float)TZ.X, (float)TZ.Y, (float)TZ.Z, V.TangentZ.W);
							}
						}
					}
				}
				// Blendshape deltas live on UMorphTarget objects (NOT in FSkeletalMeshLODModel), so the
				// vertex loop above misses them. Rotate each delta by the SAME rigid Yaw (deltas are
				// rotation-only - never translated) so face morphs (blink/jaw/visemes) fire in the corrected
				// frame instead of tearing the face. sk->Build() below regenerates render data from these.
				for (UMorphTarget* MT : sk->GetMorphTargets()) {
					if (!MT) continue;
					for (FMorphTargetLODModel& MLOD : MT->GetMorphLODModels()) {
						for (FMorphTargetDelta& D : MLOD.Vertices) {
							const FVector MPD = Yaw.RotateVector(FVector(D.PositionDelta.X, D.PositionDelta.Y, D.PositionDelta.Z));
							D.PositionDelta = FVector3f((float)MPD.X, (float)MPD.Y, (float)MPD.Z);
							const FVector MTZ = Yaw.RotateVector(FVector(D.TangentZDelta.X, D.TangentZDelta.Y, D.TangentZDelta.Z));
							D.TangentZDelta = FVector3f((float)MTZ.X, (float)MTZ.Y, (float)MTZ.Z);
						}
					}
				}
				UE_LOG(LogUniGLBLoader, Log, TEXT("NativeMannyGASP: rotated character (mesh + skeleton) to match Manny's asset-space forward."));
			}
		}
	}

	// REQUIRED after the axis re-base above: USkeletalMesh::CalculateInvRefMatrices() is a NO-OP when
	// RefBasesInvMatrix.Num() already equals the bone count (SkeletalMesh.cpp guard), which would keep
	// the STALE pre-reorient inverse-bind and DEFORM the mesh by the reorientation delta. Emptying the
	// cache first forces the recompute and preserves the bind EXACTLY (Comp * Comp^-1 = I), exactly as
	// the engine's own ref-pose-mutating path does (SkeletalMeshMerge.cpp). Do NOT remove the Empty().
	sk->GetRefBasesInvMatrix().Empty();
	sk->CalculateInvRefMatrices();
	sk->CalculateExtendedBounds();
	Skeleton->RecreateBoneTree(sk);

	// UniGLB's post-process AnimBP (spring bones) targets old VRoid bones; clear it.
	sk->SetPostProcessAnimBlueprint(nullptr);
	sk->Build();

	// 5. Translation retargeting modes so Manny/GASP anims retarget onto the VRoid's own
	//    proportions: limbs ROTATE only (use the VRoid bone lengths -> no knee squat / stretch),
	//    root takes the animation's motion, pelvis height is scaled to the avatar.
	{
		const FReferenceSkeleton& BoneRef = Skeleton->GetReferenceSkeleton();
		for (int32 i = 0; i < BoneRef.GetRawBoneNum(); ++i) {
			Skeleton->SetBoneTranslationRetargetingMode(i, EBoneTranslationRetargetingMode::Skeleton);
		}
		const int32 RootIdx   = BoneRef.FindBoneIndex(TEXT("root"));
		const int32 PelvisIdx = BoneRef.FindBoneIndex(TEXT("pelvis"));
		if (RootIdx   != INDEX_NONE) Skeleton->SetBoneTranslationRetargetingMode(RootIdx,   EBoneTranslationRetargetingMode::Animation);
		if (PelvisIdx != INDEX_NONE) Skeleton->SetBoneTranslationRetargetingMode(PelvisIdx, EBoneTranslationRetargetingMode::AnimationScaled);

		// IK bones live in root/world space and are driven by the animation's own IK tracks; they
		// must take the animation's TRANSLATION (not be frozen at the skeleton ref pose like the
		// limbs), otherwise they detach from the animated hands/feet -> the floating ik_hand_gun
		// seen under Show Bones during the run. Matches Epic's mannequin retarget defaults.
		static const TCHAR* IKBones[] = {
			TEXT("ik_foot_root"), TEXT("ik_foot_l"), TEXT("ik_foot_r"),
			TEXT("ik_hand_root"), TEXT("ik_hand_gun"), TEXT("ik_hand_l"), TEXT("ik_hand_r"),
		};
		for (const TCHAR* B : IKBones) {
			const int32 Idx = BoneRef.FindBoneIndex(B);
			if (Idx != INDEX_NONE) Skeleton->SetBoneTranslationRetargetingMode(Idx, EBoneTranslationRetargetingMode::Animation);
		}
	}

	// CONVERSION REPORT (section 5: APPLIED + size VERIFY + WARNINGS). Replaces the temporary per-bone DIAG
	// dump now that scale is confirmed - kept permanent + concise (one block per import). Also scans skin
	// weights for the section-2 'invalid weights' detection (NaN positions, zero-weight/unbound verts).
	{
		const FReferenceSkeleton& DRef = UniGLBGetRefSkeleton(sk);
		auto DComp = [&](const TCHAR* n) -> FVector {
			const int32 bi = DRef.FindBoneIndex(n);
			if (bi == INDEX_NONE) return FVector::ZeroVector;
			FTransform T = FTransform::Identity;
			for (int32 i = bi; i != INDEX_NONE; i = DRef.GetParentIndex(i)) T = T * DRef.GetRefBonePose()[i];
			return T.GetLocation();
		};
		FVector VMin(1e30), VMax(-1e30); int32 NV = 0, NNaN = 0, NUnbound = 0;
		if (FSkeletalMeshModel* DM = sk->GetImportedModel()) {
			for (FSkeletalMeshLODModel& LOD : DM->LODModels)
				for (FSkelMeshSection& Sec : LOD.Sections)
					for (FSoftSkinVertex& V : Sec.SoftVertices) {
						const FVector P(V.Position.X, V.Position.Y, V.Position.Z);
						if (P.ContainsNaN()) { ++NNaN; }
						int32 WSum = 0; for (int32 w = 0; w < (int32)UE_ARRAY_COUNT(V.InfluenceWeights); ++w) WSum += (int32)V.InfluenceWeights[w];
						if (WSum == 0) { ++NUnbound; }
						VMin = VMin.ComponentMin(P); VMax = VMax.ComponentMax(P); ++NV;
					}
		}
		const FVector Pelvis = DComp(TEXT("pelvis")), Head = DComp(TEXT("head"));
		UE_LOG(LogUniGLBLoader, Log, TEXT("UniGLB REPORT [APPLIED]: scale-to-Manny=%.4f; re-base+inject+prune+hands+facing applied (details above). Result: %d bones."), GlobalScale, DRef.GetRawBoneNum());
		UE_LOG(LogUniGLBLoader, Log, TEXT("UniGLB REPORT [VERIFY size]: skel pelvis->head Z=%.1f, mesh bbox X=%.1f Y=%.1f Z=%.1f (mesh T-pose => wide X ~= Z; A-pose => narrow X)."), (float)(Head.Z - Pelvis.Z), (float)(VMax.X - VMin.X), (float)(VMax.Y - VMin.Y), (float)(VMax.Z - VMin.Z));
		// Per-bone arm positions (vs Manny A-pose). Manny ref: upperarm_l ~ (X=-9 Y=14 Z=140), hand_l further
		// out+down. If our hand_l sits roughly out-and-down from upperarm_l (not horizontal/folded), arms are A.
		{
			auto MC = [&](const TCHAR* n) -> FVector {
				const int32 bi = MannyRef.FindBoneIndex(n);
				if (bi == INDEX_NONE) return FVector::ZeroVector;
				return CompXform(MannyRef, bi).GetLocation();
			};
			const TCHAR* AK[] = { TEXT("clavicle_l"), TEXT("upperarm_l"), TEXT("lowerarm_l"), TEXT("hand_l"), TEXT("middle_03_l"), TEXT("upperarm_r"), TEXT("hand_r"), TEXT("middle_03_r") };
			for (const TCHAR* K : AK) {
				const FVector O = DComp(K), M = MC(K) /* Manny ref, NOT scaled */;
				UE_LOG(LogUniGLBLoader, Log, TEXT("UniGLB REPORT [ARM] %-12s ours=%s | Manny(ref)=%s"), K, *O.ToString(), *M.ToString());
			}
		}
		if (NNaN > 0 || NUnbound > 0) {
			UE_LOG(LogUniGLBLoader, Warning, TEXT("UniGLB REPORT [WARNINGS]: %d/%d vert(s) NaN position, %d/%d vert(s) ZERO skin weight (unbound)."), NNaN, NV, NUnbound, NV);
		} else {
			UE_LOG(LogUniGLBLoader, Log, TEXT("UniGLB REPORT [WARNINGS]: none (%d verts, positions + weights valid)."), NV);
		}
	}

	// Manny / GASP animations play directly (no IK retarget) via compatible skeletons. Register every
	// Manny-family skeleton the project ships (same helper the Universal/AutoRig pipeline uses, so both
	// produce identical compatibility lists). The helper only mutates the imported Skeleton, never Manny.
	UniGLB_RegisterCompatibleMannySkeletons(Skeleton, MannySkeleton);
#endif
}

bool UUniGLBLoaderBPFunctionLibrary::LoadVRMFileFromMemoryDefaultOption(UUniGLBAssetListObject*& OutUniGLBAsset, const FString filepath, const uint8* pData, size_t dataSize) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	TSoftObjectPtr<UClass> c;
	if (c == nullptr) {
		FSoftObjectPath r(TEXT("/UniGLB/VrmAssetListObjectBP.VrmAssetListObjectBP"));
		UBlueprint* bp = Cast<UBlueprint>(r.TryLoad());
		UClass* gc = bp ? (UClass*)bp->GeneratedClass : nullptr;
		// Reject a template whose serialized parent resolved to a foreign class (e.g. a separately
		// installed VRM4U plugin) -- NewObject below would assert otherwise.
		if (gc && gc->IsChildOf(UUniGLBAssetListObject::StaticClass())) {
			c = gc;
		}
	}

	if (c == nullptr) {
		UE_LOG(LogUniGLBLoader, Error, TEXT("UniGLB: AssetList template BP unavailable or invalid - falling back to bare C++ class, loaded meshes will have NO materials."));
		c = UUniGLBAssetListObject::StaticClass();
	}
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	TSoftObjectPtr<UUniGLBAssetListObject> m = NewObject<UUniGLBAssetListObject>((UObject*)GetTransientPackage(), c.Get());

	return LoadVRMFileFromMemory(m.Get(), OutUniGLBAsset, filepath, pData, dataSize);
}

#if WITH_EDITOR
// Force synchronous skeletal-mesh builds for the whole VRM import. UniGLB runs many manual
// sk->Build()/PostLoad()/save passes on the game thread; with async skinned-asset compilation ON,
// the in-flight FSkinnedAssetAsyncBuildTask is torn down with work still pending on heavy meshes
// (assert WorkNotFinishedCounter==0 / !QueuedPool in AsyncWork.h). Disabling async => every build
// is synchronous, so no FAsyncTask exists to race. The cvar is restored on scope exit.
struct FUniGLBForceSyncSkinnedBuild {
	IConsoleVariable* CVar = nullptr;
	int32 Prev = 0;
	FUniGLBForceSyncSkinnedBuild() {
		CVar = IConsoleManager::Get().FindConsoleVariable(TEXT("Editor.AsyncSkinnedAssetCompilation"));
		if (CVar) { Prev = CVar->GetInt(); CVar->Set(TEXT("0"), ECVF_SetByCode); }
	}
	~FUniGLBForceSyncSkinnedBuild() {
		if (CVar) { CVar->Set(*FString::FromInt(Prev), ECVF_SetByCode); }
	}
};
#endif

bool UUniGLBLoaderBPFunctionLibrary::LoadVRMFileFromMemory(const UUniGLBAssetListObject *InUniGLBAsset, UUniGLBAssetListObject *&OutUniGLBAsset, const FString filepath, const uint8 *pFileDataData, size_t dataSize) {
	TRACE_CPUPROFILER_EVENT_SCOPE(TEXT("LoadVRMFileFromMemory"))

	OutUniGLBAsset = nullptr;
	RenderControl _dummy_control;

	if (InUniGLBAsset == nullptr) {
		return false;
	}

#if WITH_EDITOR
	// Synchronous skinned-asset builds for this whole import (avoids the async build-task race that
	// asserts WorkNotFinishedCounter==0 / !QueuedPool on heavy UniGLBs).
	FUniGLBForceSyncSkinnedBuild UniGLBForceSyncSkinnedBuild;
#endif

	Assimp::Importer mImporter;
	mImporter.SetPropertyBool(AI_CONFIG_IMPORT_REMOVE_EMPTY_BONES, false);
	const aiScene* mScenePtr = nullptr; // delete by Assimp::Importer::~Importer

	if (filepath.IsEmpty())
	{
	}

	double StartTime = FPlatformTime::Seconds();
	auto LogAndUpdate = [&](FString logname) {
		UE_LOG(LogUniGLBLoader, Log, TEXT("VRM:(%02.2lf secs) %s"), FPlatformTime::Seconds() - StartTime, *logname);
		StartTime = FPlatformTime::Seconds();
	};

	UniGLBConverter::Options::Get().SetVRM0Model(true);
	{
		TRACE_CPUPROFILER_EVENT_SCOPE(TEXT("AssImpLoader"))

		const FString ext = FPaths::GetExtension(filepath).ToLower();
#if PLATFORM_WINDOWS
		std::string e = utf_16_to_shift_jis(*ext);
		std::string e_imp = utf_16_to_shift_jis(*ext);
#else
		std::string e = TCHAR_TO_UTF8(*ext);
		std::string e_imp = TCHAR_TO_UTF8(*ext);
#endif

		e_imp = GetExtAndSetModelTypeLocal(e, pFileDataData, dataSize);

		mScenePtr = mImporter.ReadFileFromMemory(pFileDataData, dataSize,
			aiProcess_Triangulate | aiProcess_MakeLeftHanded | aiProcess_CalcTangentSpace | aiProcess_GenSmoothNormals | aiProcess_OptimizeMeshes | aiProcess_PopulateArmatureData,
			e_imp.c_str());

		if (mScenePtr == nullptr) {
			std::string file;
#if PLATFORM_WINDOWS
			file = utf_16_to_shift_jis(*filepath);
#else
			file = TCHAR_TO_UTF8(*filepath);
#endif
			mScenePtr = mImporter.ReadFile(file, aiProcess_Triangulate | aiProcess_MakeLeftHanded | aiProcess_CalcTangentSpace | aiProcess_GenSmoothNormals | aiProcess_OptimizeMeshes | aiProcess_PopulateArmatureData);
		}

		UE_LOG(LogUniGLBLoader, Log, TEXT("VRM:(%3.3lf secs) ReadFileFromMemory"), FPlatformTime::Seconds() - StartTime);
		StartTime = FPlatformTime::Seconds();
	}

	UpdateProgress(20);
	if (mScenePtr == nullptr)
	{
		UE_LOG(LogUniGLBLoader, Warning, TEXT("UniGLB: read failure.\n"));
		return false;
	}

	{
		FString fullpath = FPaths::GameUserDeveloperDir() + TEXT("VRM/");
		FString basepath = FPackageName::FilenameToLongPackageName(fullpath);
		//FPackageName::RegisterMountPoint("/UniGLBImportData/", fullpath);

		baseFileName = FPaths::GetBaseFilename(filepath);


		if (s_vrm_package == nullptr) {
			s_vrm_package = GetTransientPackage();
		}
	}
	UUniGLBAssetListObject *out = OutUniGLBAsset;
	if (OutUniGLBAsset == nullptr) {
		if (s_vrm_package == GetTransientPackage()) {
			out = Cast<UUniGLBAssetListObject>(StaticDuplicateObject(InUniGLBAsset, s_vrm_package, NAME_None));
		} else {
			if (InUniGLBAsset->ReimportBase) {
				out = InUniGLBAsset->ReimportBase;
			}
			else {
				out = UniGLB_NewObject<UUniGLBAssetListObject>(s_vrm_package, *(FString(TEXT("VA_")) + UniGLBConverter::NormalizeFileName(baseFileName) + FString(TEXT("_UniGLBAssetList"))), EObjectFlags::RF_Public | EObjectFlags::RF_Standalone);
			}
			InUniGLBAsset->CopyMember(out);
		}
		OutUniGLBAsset = out;
	}
	if (out == nullptr) {
		UE_LOG(LogUniGLBLoader, Warning, TEXT("UniGLB: no UUniGLBAssetListObject.\n"));
		return false;
	}

#if WITH_EDITORONLY_DATA
	{
		out->AssetImportData = NewObject<UAssetImportData>(out, TEXT("AssetImportData"));
		out->AssetImportData->Update(filepath);
	}
#endif

	out->FileFullPathName = filepath;
	out->OrigFileName = baseFileName;
	out->BaseFileName = UniGLBConverter::NormalizeFileName(baseFileName);
	out->Package = s_vrm_package;

#if WITH_EDITOR
	// Reimport safety: if `out` carries a SkeletalMesh from a PREVIOUS import (ReimportBase case),
	// ConvertTextureAndMaterial (next) creates fresh Material assets that collide by name with the
	// old ones still referenced by that mesh -- NewObject renames the old material aside for GC while
	// an open Persona/viewport editor may still hold a live render proxy to it, which crashes with
	// "Cannot queue the Expression Cache for Material ... when it is about to be deleted"
	// (MaterialRenderProxy.cpp). Closing editors for the stale mesh + its materials and flushing the
	// render thread first ensures nothing is still rendering them when they get replaced.
	if (out->SkeletalMesh != nullptr && GEditor)
	{
		if (UAssetEditorSubsystem* AES = GEditor->GetEditorSubsystem<UAssetEditorSubsystem>())
		{
			AES->CloseAllEditorsForAsset(out->SkeletalMesh);
			for (const FSkeletalMaterial& OldMat : out->SkeletalMesh->GetMaterials())
			{
				if (OldMat.MaterialInterface) { AES->CloseAllEditorsForAsset(OldMat.MaterialInterface); }
			}
		}
		FlushRenderingCommands();
	}
#endif

	{
		bool ret = true;
		UniGLBConverter vc;
		vc.Init(pFileDataData, dataSize, mScenePtr);
		vc.ConvertUniGLBFirst(out, pFileDataData, dataSize);

		LogAndUpdate(TEXT("Begin convert"));
		ret &= vc.NormalizeBoneName(mScenePtr);
		LogAndUpdate(TEXT("NormalizeBoneName"));
		// PASS A (pre-import observation, log-only): surface the raw source snapshot up front so every
		// import's input state is visible. Counts are cheap here; units/scale via GlobalScale and
		// bbox/skeleton via the DIAG block during convert. Hook point for the future router/descriptor (P3).
		UE_LOG(LogUniGLBLoader, Log, TEXT("UniGLB PASS-A source '%s': meshes=%u materials=%u (units/bbox/bones reported during convert)."),
			*baseFileName, mScenePtr->mNumMeshes, mScenePtr->mNumMaterials);
		{
			TRACE_CPUPROFILER_EVENT_SCOPE(TEXT("VRM Texture and Material"))
			ret &= vc.ConvertTextureAndMaterial(out);
			LogAndUpdate(TEXT("ConvertTextureAndMaterial"));
		}
		UpdateProgress(40);
		{
			bool r = vc.ConvertUniGLBMeta(out, mScenePtr, pFileDataData, dataSize);	// use texture.
			if (UniGLBConverter::Options::Get().IsVRMModel() == true) {
				ret &= r;
			}
		}
		LogAndUpdate(TEXT("ConvertUniGLBMeta"));
		UpdateProgress(60);

		{
			TRACE_CPUPROFILER_EVENT_SCOPE(TEXT("VRM Skeleton"))
			ret &= vc.ConvertModel(out);
			LogAndUpdate(TEXT("ConvertModel"));
		}

		//meta rename
		vc.ConvertUniGLBMetaPost(out, mScenePtr, pFileDataData, dataSize);

		ret &= vc.ConvertRig(out);
		LogAndUpdate(TEXT("ConvertRig"));

		// Fill the humanoid bone table BEFORE ConvertIKRig so a non-VRM source (e.g. Mixamo FBX)
		// builds a correct source IK Rig. Required for ALL Manny paths (Native needs it for rename,
		// Universal needs it for source-driven fit, RetargetAnim needs it for IK chains). VRM sources
		// already have the table (no-op then).
		if (UniGLBConverter::Options::Get().IsRetargetAnimToManny()
			|| UniGLBConverter::Options::Get().IsNativeMannyGASP()
			|| UniGLBConverter::Options::Get().IsUniversalMannyGASP()) {
			UniGLB_BuildHumanoidTableFromConvention(out);
		}

		// Build the IK Rig + IK Retargeter NOW only for NON-GASP paths. For Universal/Native GASP the
		// skeleton is renamed + injected + pruned AFTER this point, which would leave the IK Rig's chains
		// pointing at pre-rename / pruned bones (e.g. the source "Armature" root) -> "bone chain could not
		// find start bone" -> broken retarget. Those paths build it AFTER GASP instead (below), on the
		// final Manny-named skeleton where every chain bone (root, spine_01..05, upperarm_l..hand_l,
		// thigh_l..ball_l) exists.
		const bool bGaspPath = UniGLBConverter::Options::Get().IsNativeMannyGASP() || UniGLBConverter::Options::Get().IsUniversalMannyGASP();
		if (!bGaspPath) {
			ret &= vc.ConvertIKRig(out);
			LogAndUpdate(TEXT("ConvertIKRig"));
		}

		// Anim-retarget: DEFERRED to after ConvertIKRig (post-GASP) so RTG_ exists when the bake runs.
		// Was here before (bug: RTG_ not yet created on GASP paths -> stale/missing retargeter).
		if (out->bSkipMorphTarget == false) {
			ret &= vc.ConvertMorphTarget(out);
			LogAndUpdate(TEXT("ConvertMorphTarget"));
		}
		ret &= vc.ConvertPose(out);
		LogAndUpdate(TEXT("ConvertPose"));
		ret &= vc.ConvertHumanoid(out);
		LogAndUpdate(TEXT("ConvertHumanoid"));
		UpdateProgress(80);

		OutUniGLBAsset->MeshReturnedData = nullptr;
		if (ret == false) {
			RemoveAssetList(out);
			return false;
		}

		bool bGaspConverted = false;
		if (UniGLBConverter::Options::Get().IsNativeMannyGASP() || UniGLBConverter::Options::Get().IsUniversalMannyGASP()) {
			// EXCEPTION - not-rigged model: a static mesh / model with no humanoid skeleton has nothing to
			// rename or inject, so it cannot be fitted to Manny. A real humanoid rig has many bones
			// (Meshy=24, Mixamo=52+, Manny=89+); an un-rigged import lands with 0-1. Detect that, tell the
			// user to auto-rig first, and skip the GASP convert (the mesh still imports as a static asset).
			const int32 SrcBones = (out && out->SkeletalMesh) ? UniGLBGetRefSkeleton(out->SkeletalMesh).GetRawBoneNum() : 0;
			if (SrcBones < 10) {
				// No usable source rig (unrigged / near-static, e.g. Tripo/photogrammetry). Route to the MESH-DRIVEN
				// auto-rig fallback: it fits the canonical Manny skeleton to the mesh GEOMETRY (ignores the source
				// skeleton) then geodesic re-skins, POST-import. If the mesh is not a fittable upright humanoid the
				// fallback's Tier-1 self-abort shows the Mixamo re-rig dialog. (P5: enables no-skeleton universality.)
				UE_LOG(LogUniGLBLoader, Log, TEXT("UniGLB: model has %d bone(s) (no usable rig); routing to auto-rig fallback (fit Manny to mesh)."), SrcBones);
				out->bUniGLBPendingAdapt = true;
				out->UniGLBAdaptMode = UUniGLBAssetListObject::EUniGLBAdapt::FitMannyFromMesh;
			} else if (UniGLBConverter::Options::Get().IsNativeMannyGASP()) {
				ProcessNativeMannyGASP(out);
				bGaspConverted = true;
			} else {
				// Universal (FBX/GLB): UNIVERSAL AUTO-RIG (user decision "Oui, auto-rig universel"). EVERY rigged
				// import - recognized convention or not - gets a clean Manny-topology skeleton whose joint POSITIONS
				// come from the mesh's OWN source skeleton (so they match the mesh in any pose), + geodesic re-skin.
				// We no longer take the in-place name-rename "convention" path here: it RE-BASED the bones (stamped
				// Manny A-pose ROTATIONS onto the source POSITIONS), which fans/desaxes T-pose rigs and is a
				// per-model failure mode the user explicitly rejected. The auto-rig is ONE uniform path for all.
				// MUST run POST-import - CopyMeshFromSkeletalMesh / FSkinBindingOp here crashes in MeshConversion
				// (geometry not committed mid-import). So we only FLAG it; OnObjectImported -> AdaptToMannyPostImport
				// runs it on the fully-built mesh. If the fit self-aborts (non-upright / fused legs / non-human
				// proportions) it shows the Mixamo re-rig dialog THEN (Tier-1).
				// Fill the humanoid bone table (VRM-name -> source bone name) NOW, at import time, where the static
				// convention tables are in scope. AutoRigToManny (POST-import) reads it back off out->UniGLBMetaObject
				// to source-DRIVE the fit (Manny bone <- source joint position). If the source naming is not a
				// recognized convention the table stays empty and AutoRigToManny aborts to the Mixamo re-rig dialog.
				UniGLB_BuildHumanoidTableFromConvention(out);
				UE_LOG(LogUniGLBLoader, Log, TEXT("UniGLB: Universal import (%d source bones) -> UNIVERSAL AUTO-RIG (source-driven Manny fit + geodesic re-skin) POST-import."), SrcBones);
				out->bUniGLBPendingAdapt = true;
				out->UniGLBAdaptMode = UUniGLBAssetListObject::EUniGLBAdapt::FitMannyFromMesh;
			}
		}

		// GASP paths: NOW build the IK Rig + IK Retargeter, on the FINAL Manny-named skeleton (post rename
		// + inject + prune). Every retarget chain bone exists and the root is "root" (not the pruned
		// "Armature"), so the Manny->character retargeter is valid and the Manny animation library
		// retargets onto the imported character with no skin deformation.
		if (bGaspPath && bGaspConverted) {
			ret &= vc.ConvertIKRig(out);
			LogAndUpdate(TEXT("ConvertIKRig (post-GASP)"));
		}

		// Anim-retarget: bake imported animations onto Manny via RTG_. Runs AFTER ConvertIKRig
		// (both GASP and non-GASP paths) so the RTG_ asset is guaranteed to exist. The FindObject
		// in RetargetAnimToManny matches by BaseFileName, scoped to the import package — no stale
		// RTG_ from a previous import can be picked up.
		if (UniGLBConverter::Options::Get().IsRetargetAnimToManny()) {
			vc.RetargetAnimToManny(out);
		}

		// Sub-project B (auto-skin/rig) — DISABLED in the import funnel. Running CopyMeshFromSkeletalMesh /
		// FSkinBindingOp here crashes in MeshConversion ("Array index out of bounds: 0 into size 0", AV at
		// 0x0) because the mesh's geometry data is not fully committed during FactoryCreateBinary (re-entrancy).
		// B must run as a POST-import step on the finished SkeletalMesh asset (TODO). The Universal/GASP
		// convert itself does NOT crash and still runs above.
		// Auto-skin / auto-rig (sub-project B) DISABLED per user direction: the post-import geodesic-voxel
		// re-skin bound the mesh against the hybrid 247-bone GASP skeleton and DEFORMED it. Recommended
		// method = stay on the GASP conversion (Manny skeleton assigned, original skin remapped). B will be
		// re-enabled once it binds cleanly to the CANONICAL 89-bone Manny skeleton.
		// (Sub-project B old trigger removed: the auto-rig fallback flag is now set precisely in the
		//  unrecognized-convention branch above, so recognized convention imports never queue an adapt.)

		{
			// 後処理。UE5.7ではCreateMeshDescription を呼ぶため必要
			// MUST run for the Native Manny/GASP path too. PostLoad() creates the source
			// MeshDescription; skipping it leaves the mesh without one, and OPENING it in the
			// Skeletal Mesh Editor then NULL-derefs in SkeletalMeshModelingTools (0xC0000005,
			// crash on open). The import-time ensure this used to trip is non-fatal and far less
			// bad than a fatal crash when the asset is opened.
			if (out->SkeletalMesh) {
				out->SkeletalMesh->PostLoad();
				// Async skinned-asset compilation is disabled for the whole import (see
				// FUniGLBForceSyncSkinnedBuild at the top of LoadVRMFileFromMemory), so PostLoad's
				// build runs synchronously and there is no in-flight FAsyncTask to flush here.
				out->SkeletalMesh->WaitForPendingInitOrStreaming();
			}
		}
	}
	out->UniGLBMetaObject->SkeletalMesh = out->SkeletalMesh;

	UniGLBSetPhysicsAsset(out->UniGLBMetaObject->SkeletalMesh, nullptr);


	{
		TRACE_CPUPROFILER_EVENT_SCOPE(TEXT("VRM Save"))
		
		LogAndUpdate(TEXT("BeginSave"));
		bool b = out->bAssetSave;
		RenewPkgAndSaveObject(out, b);
		for (auto &t : out->Textures) {
			RenewPkgAndSaveObject(t, b);
		}
		for (auto &t : out->Materials) {
			RenewPkgAndSaveObject(t, b);
		}
		for (auto &t : out->OutlineMaterials) {
			RenewPkgAndSaveObject(t, b);
		}
		RenewPkgAndSaveObject(out->SkeletalMesh, b);
		RenewPkgAndSaveObject(UniGLBGetSkeleton(out->SkeletalMesh), b);
		RenewPkgAndSaveObject(UniGLBGetPhysicsAsset(out->SkeletalMesh), b);
		RenewPkgAndSaveObject(out->UniGLBMetaObject, b);
		RenewPkgAndSaveObject(out->UniGLBHumanoidMetaObject, b);
		RenewPkgAndSaveObject(out->UniGLBMannequinMetaObject, b);
		RenewPkgAndSaveObject(out->UniGLBLicenseObject, b);
		RenewPkgAndSaveObject(out->UniGLB1LicenseObject, b);
		RenewPkgAndSaveObject(out->HumanoidSkeletalMesh, b);
		RenewPkgAndSaveObject(out->HumanoidRig, b);

		LogAndUpdate(TEXT("Save"));
	}

	if (UniGLBConverter::IsImportMode()){
#if WITH_EDITOR
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.

		// refresh content browser
		FContentBrowserModule& ContentBrowserModule = FModuleManager::Get().LoadModuleChecked<FContentBrowserModule>("ContentBrowser");
		{
			TArray<UObject*> a = { OutUniGLBAsset };
			//ContentBrowserModule.Get().SyncBrowserToAssets(a);
		}
		{
			auto path = FPaths::GetPath(OutUniGLBAsset->GetPathName());
			const TArray<FString> b = { path };
			ContentBrowserModule.Get().SyncBrowserToFolders(b);
			ContentBrowserModule.Get().SetSelectedPaths(b, true);
		}

#endif

	}
	UpdateProgress(100);
	return true;
}


bool UUniGLBLoaderBPFunctionLibrary::CopyPhysicsAsset(USkeletalMesh *dstMesh, const USkeletalMesh *srcMesh, bool bResetCollisionTransform){
	//GetTransientPackage
#if WITH_EDITOR
// [UniGLB] removed dead UE_VERSION_OLDER_THAN guard block (no #else; thresholds [(5, 4, 0)] all below target floor (5, 7, 0)).
#endif // editor

	return true;
}


bool UUniGLBLoaderBPFunctionLibrary::CopyVirtualBone(USkeletalMesh *dstMesh, const USkeletalMesh *srcMesh) {
	if (dstMesh == nullptr || srcMesh == nullptr) {
		return false;
	}
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 4, 0)] (target floor (5, 7, 0)); kept #else branch only.
	// todo
	return true;
}


bool UUniGLBLoaderBPFunctionLibrary::CreateTailBone(USkeletalMesh *skeletalMesh, const TArray<FString> &boneName) {

	if (skeletalMesh == nullptr) {
		return false;
	}

	TArray<int32> tail;
	for (auto &b : boneName) {
		int first = UniGLBGetRefSkeleton(skeletalMesh).FindBoneIndex(*b);
		if (first < 0) {
			continue;
		}
		tail.AddUnique(first);
	}
	if (tail.Num() == 0) {
		return false;
	}

	USkeletalMesh *sk_tmp = skeletalMesh;// NewObject<USkeletalMesh>(GetTransientPackage(), NAME_None, EObjectFlags::RF_Public | RF_Transient);
	USkeleton *k_tmp = UniGLBGetSkeleton(skeletalMesh);//NewObject<UUniGLBSkeleton>(GetTransientPackage(), NAME_None, EObjectFlags::RF_Public | RF_Transient);

	/*
	k_tmp->RecreateBoneTree(skeletalMesh);
	sk_tmp->Skeleton = k_tmp;
	sk_tmp->RefSkeleton = k_tmp->GetReferenceSkeleton();
	sk_tmp->Skeleton->MergeAllBonesToBoneTree(sk_tmp);
	*/

	for (int i = 0; i < tail.Num(); ++i) {
		TArray<int32> children;
		UniGLBUtil::GetDirectChildBones(UniGLBGetRefSkeleton(sk_tmp), tail[i], children);
		if (children.Num()) {
			tail.RemoveAt(i);
			tail.Append(children);
			--i;
		}
	}

	bool bAdd = false;

	FReferenceSkeletonModifier RefSkelModifier(UniGLBGetRefSkeleton(sk_tmp), UniGLBGetSkeleton(sk_tmp));
	for (int i = 0; i < tail.Num(); ++i) {
		FMeshBoneInfo b;
		FTransform t;

		b.ParentIndex = tail[i];
		b.Name = UniGLBGetRefSkeleton(sk_tmp).GetBoneName(tail[i]);

		FString text = TEXT("_uniglb_dummy_tail");

		if (b.Name.ToString().Contains(text)) {
			continue;
		}
		b.Name = *(b.Name.ToString() + text);
		t = UniGLBGetRefSkeleton(sk_tmp).GetRefBonePose()[tail[i]];

		RefSkelModifier.Add(b, t);
		bAdd = true;
	}

	if (bAdd) {
		UniGLBGetRefSkeleton(sk_tmp).RebuildRefSkeleton(UniGLBGetSkeleton(sk_tmp), true);

		UniGLBGetSkeleton(skeletalMesh)->ClearCacheData();

		UniGLBGetSkeleton(skeletalMesh)->MergeAllBonesToBoneTree(sk_tmp);

		//skeletalMesh->RefSkeleton.RebuildRefSkeleton(skeletalMesh->Skeleton, true);

		{
			FSkeletalMeshLODRenderData &rd = skeletalMesh->GetResourceForRendering()->LODRenderData[0];

			{
				int boneNum = UniGLBGetSkeleton(skeletalMesh)->GetReferenceSkeleton().GetRawBoneNum();
				rd.RequiredBones.SetNum(boneNum);
				rd.ActiveBoneIndices.SetNum(boneNum);

#if WITH_EDITOR
				FSkeletalMeshLODModel *p = &(skeletalMesh->GetImportedModel()->LODModels[0]);
				p->ActiveBoneIndices.SetNum(boneNum);
				p->RequiredBones.SetNum(boneNum);
#endif

				for (int i = 0; i < boneNum; ++i) {
					rd.RequiredBones[i] = i;
					rd.ActiveBoneIndices[i] = i;

#if WITH_EDITOR
					p->ActiveBoneIndices[i] = i;
					p->RequiredBones[i] = i;
#endif
				}
			}
		}

		skeletalMesh->Modify();
		UniGLBGetSkeleton(skeletalMesh)->Modify();

#if WITH_EDITOR
		skeletalMesh->PostEditChange();
		UniGLBGetSkeleton(skeletalMesh)->PostEditChange();
#endif
	}

	return true;
}

#if WITH_EDITOR
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.

static void LocalEpicSkeletonSetup(UIKRigController *rigcon) {
	if (rigcon == nullptr) return;

	rigcon->SetRetargetRoot(TEXT("Pelvis"));
	while (rigcon->GetRetargetChains().Num()) {
		rigcon->RemoveRetargetChain(rigcon->GetRetargetChains()[0].ChainName);
	}
	UniGLBAddRetargetChain(rigcon, TEXT("root"), TEXT("root"), TEXT("root"));


	int sol_index = 0;
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
	auto* sol = rigcon->GetSolverAtIndex(sol_index);

	if (sol == nullptr) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0), (5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
		sol_index = rigcon->AddSolver(FIKRigFullBodyIKSolver::StaticStruct());
		sol = rigcon->GetSolverAtIndex(sol_index);
	}
	if (sol == nullptr) return;
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 6, 0)] (target floor (5, 7, 0)); kept #else branch only.
	sol->SetStartBone(TEXT("root"));

	{
		TArray<FString> a = {
			TEXT("Hand_L"),
			TEXT("Hand_R"),
			TEXT("ball_l"),
			TEXT("ball_r"),
		};
		for (int i = 0; i < a.Num(); ++i) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
			auto goal = rigcon->AddNewGoal(*(a[i] + TEXT("_Goal")), *a[i]);
			if (goal != NAME_None) {
				rigcon->ConnectGoalToSolver(goal, sol_index);
			}
		}
	}
}
#endif

//void UUniGLBLoaderBPFunctionLibrary::UniGLBGenerateEpicSkeletonToHumanoidIKRig(USkeletalMesh *skeletalMesh, UObject*& rig_o, UObject*& ikr_o){
void UUniGLBLoaderBPFunctionLibrary::UniGLBGenerateEpicSkeletonToHumanoidIKRig(USkeletalMesh * srcSkeletalMesh, UObject * &outRigIK, UObject * &outIKRetargeter, UObject * targetRigIK){

#if WITH_EDITOR
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	USkeletalMesh* sk = srcSkeletalMesh;
	if (sk == nullptr) {
		return;
	}

	auto LocalGetController = [](UIKRigDefinition * rig) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
		return UIKRigController::GetController(rig);
	};

	{
		const FString PkgPath = sk->GetPathName();// GetPackage().pathn
		const FString SavePackagePath = FPaths::GetPath(PkgPath);

		UIKRigDefinition* rig = nullptr;
		{
			FString name = FString(TEXT("IK_")) + sk->GetName() + TEXT("_UniGLBHumanoid");
			UPackage* pkg = CreatePackage(*(SavePackagePath +"/"+ name));

			{
				auto* a = FindObject<UIKRigDefinition>(NULL, *(SavePackagePath + "/" + name + TEXT(".") + name));
				if (a != nullptr) {
					rig = a;
				}
			}
			if (rig == nullptr) {
				rig = UniGLB_NewObject<UIKRigDefinition>(pkg, *name, RF_Public | RF_Standalone);
			}

			UIKRigController* rigcon = LocalGetController(rig);
			rigcon->SetSkeletalMesh(sk);
			LocalEpicSkeletonSetup(rigcon);

			// bone chain
			for (auto& modelName : UniGLBUtil::table_ue4_vrm) {
				if (modelName.BoneVRM == "") continue;
				//if (modelName.BoneUE4 == "") continue; // commentout add as none

				// spine
				int type = 0;
				if (modelName.BoneVRM == TEXT("spine")) {
					type = 1;
				}
				if (modelName.BoneVRM == TEXT("chest") || modelName.BoneVRM == TEXT("upperChest")) {
					type = 2;
				}

				switch (type) {
				case 0:
					UniGLBAddRetargetChain(rigcon, *modelName.BoneVRM, *modelName.BoneUE4, *modelName.BoneUE4);
						break;
				case 1:
					if (sk->GetRefSkeleton().FindBoneIndex(TEXT("spine_05")) != INDEX_NONE) {
						UniGLBAddRetargetChain(rigcon, TEXT("spine"), TEXT("spine_01"), TEXT("spine_05"));
					} else {
						UniGLBAddRetargetChain(rigcon, TEXT("spine"), TEXT("spine_01"), TEXT("spine_03"));
					}
					break;
				default:
					break;
				}
			}
			//UniGLBAddRetargetChain(rigcon, TEXT("leftEye"), NAME_None, NAME_None);
			//UniGLBAddRetargetChain(rigcon, TEXT("rightEye"), NAME_None, NAME_None);
		}

		{
			// sub epic bone
			UIKRigDefinition* rig_epic = nullptr;
			FString name = FString(TEXT("IK_")) + sk->GetName() + TEXT("_MannequinBone");
			UPackage* pkg = CreatePackage(*(SavePackagePath + "/" + name));

			{
				auto* a = FindObject<UIKRigDefinition>(NULL, *(SavePackagePath + "/" + name + TEXT(".") + name));
				if (a != nullptr) {
					rig_epic = a;
				}
			}
			if (rig_epic == nullptr) {
				rig_epic = UniGLB_NewObject<UIKRigDefinition>(pkg, *name, RF_Public | RF_Standalone);
			}

			UIKRigController* rigcon = LocalGetController(rig_epic);
			rigcon->SetSkeletalMesh(sk);
			LocalEpicSkeletonSetup(rigcon);

			// bone chain
			for (auto& modelName : UniGLBUtil::table_ue4_vrm) {
				if (modelName.BoneVRM == "") continue;
				if (modelName.BoneUE4 == "") continue;
				UniGLBAddRetargetChain(rigcon, *modelName.BoneUE4, *modelName.BoneUE4, *modelName.BoneUE4);
			}
		}

		/*
		{ // sub ik
			UIKRigDefinition* ik = nullptr;
			{
				FString name = FString(TEXT("IK_")) + sk->GetName() + TEXT("_EpicSkeleton_IK");
				UPackage* pkg = CreatePackage(*(SavePackagePath + "/" + name));

				{
					auto* a = FindObject<UIKRigDefinition>(NULL, *(SavePackagePath + "/" + name + TEXT(".") + name));
					if (a != nullptr) {
						ik = a;
					}
				}
				if (ik == nullptr) {
					ik = UniGLB_NewObject<UIKRigDefinition>(pkg, *name, RF_Public | RF_Standalone);
				}

				UIKRigController* rigcon = UIKRigController::GetIKRigController(ik);
				rigcon->SetSkeletalMesh(sk);
				LocalEpicSkeletonSetup(rigcon);

				struct TT {
					FString s1;
					FString s2;
					FString s3;
				};
				TArray<TT> table = {
					{TEXT("pelvis"),		TEXT("spine_03"),	TEXT(""),},
					{TEXT("neck_01"),		TEXT("head"),		TEXT(""),},
					{TEXT("clavicle_l"),	TEXT("hand_l"),		TEXT("hand_l_Goal"),},
					{TEXT("clavicle_r"),	TEXT("hand_r"),		TEXT("hand_r_Goal"),},
					{TEXT("thigh_l"),		TEXT("ball_l"),		TEXT("ball_l_Goal"),},
					{TEXT("thigh_r"),		TEXT("ball_r"),		TEXT("ball_r_Goal"),},

					{TEXT("thumb_01_l"),	TEXT("thumb_03_l"),		TEXT(""),},
					{TEXT("index_01_l"),	TEXT("index_03_l"),		TEXT(""),},
					{TEXT("middle_01_l"),	TEXT("middle_03_l"),	TEXT(""),},
					{TEXT("ring_01_l"),		TEXT("ring_03_l"),		TEXT(""),},
					{TEXT("pinky_01_l"),	TEXT("pinky_03_l"),		TEXT(""),},

					{TEXT("thumb_01_r"),	TEXT("thumb_03_r"),		TEXT(""),},
					{TEXT("index_01_r"),	TEXT("index_03_r"),		TEXT(""),},
					{TEXT("middle_01_r"),	TEXT("middle_03_r"),	TEXT(""),},
					{TEXT("ring_01_r"),		TEXT("ring_03_r"),		TEXT(""),},
					{TEXT("pinky_01_r"),	TEXT("pinky_03_r"),		TEXT(""),},
				};


				for (auto& a : table) {
					rigcon->AddRetargetChain(*a.s1, *a.s1, *a.s2);
					if (a.s3 != "") {
						rigcon->SetRetargetChainGoal(*a.s1, *a.s3);
					}
				}
			}
		}
		*/

		UIKRetargeter* ikr = nullptr;
		{
			FString name = FString(TEXT("RTG_")) + sk->GetName();
			UPackage* pkg = CreatePackage(*(SavePackagePath +"/"+ name));

			{
				auto* a = FindObject<UIKRetargeter>(NULL, *(SavePackagePath + "/" + name + TEXT(".") + name));
				if (a != nullptr) {
					ikr = a;
				}
			}
			if (ikr == nullptr) {
				ikr = UniGLB_NewObject<UIKRetargeter>(pkg, *name, RF_Public | RF_Standalone);
			}
			UIKRetargeterController* c = UIKRetargeterController::GetController(ikr);
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
			c->SetIKRig(ERetargetSourceOrTarget::Source, rig);
		}

		rig->PostEditChange();
		ikr->PostEditChange();

		outRigIK = rig;
		outIKRetargeter = ikr;
	}
#endif // editor
	return;
}


void UUniGLBLoaderBPFunctionLibrary::UniGLBGenerateIKRetargeterPose(UObject* IKRetargeter, UObject* targetRigIK, UPoseAsset* targetPose) {
#if WITH_EDITOR
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.

	if (targetPose == nullptr) return;

	UIKRetargeter* ikr = Cast<UIKRetargeter>(IKRetargeter);
	if (ikr == nullptr) return;

	UIKRetargeterController* c = UIKRetargeterController::GetController(ikr);
	if (c == nullptr) return;

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.

#endif // editor

}