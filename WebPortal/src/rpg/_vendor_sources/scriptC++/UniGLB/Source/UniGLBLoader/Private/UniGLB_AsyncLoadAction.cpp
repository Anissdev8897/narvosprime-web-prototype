// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_AsyncLoadAction.h"
#include "Async/TaskGraphInterfaces.h"
#include "Engine/Texture2D.h"
#include "Misc/FileHelper.h"

#include "UniGLB_LoaderBPFunctionLibrary.h"
#include "UniGLB_AssetListObject.h"
#include "UniGLBLoaderLog.h"

#include "UniGLBAssimpScene.h"

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 23, 0)] (target floor (5, 7, 0)); kept #else branch only.

// One instance per FUniGLBAsyncLoadAction (held by TUniquePtr). Not a global anymore: concurrent async
// loads must not share the assimp Importer/scene or the file buffer.
class UniGLBLocalAsyncAsset {
public:
	TArray<bool> NormalBoolTable;
	TArray<bool> MaskBoolTable;
	TArray<uint8> uniGLBLocalRes;

	TUniquePtr<Assimp::Importer> Importer;
	const aiScene* ScenePtr = nullptr;

	void Reset() {
		Importer.Reset();
		ScenePtr = nullptr;

		NormalBoolTable.Empty();
		MaskBoolTable.Empty();
		uniGLBLocalRes.Empty();
	}
};

static bool ConvTex(UniGLBLocalAsyncAsset& localAsset, UUniGLBAssetListObject* uniGLBAssetList, const aiScene* mScenePtr, const FUniGLBImportOptionData* option, const int TexCount, const int SubCount) {
	if (uniGLBAssetList == nullptr || mScenePtr == nullptr) {
		return true;
	}
	if ((int)mScenePtr->mNumTextures <= TexCount) {
		return true;
	}

	if (TexCount == 0 && SubCount==0) {
		localAsset.NormalBoolTable.Empty();
		localAsset.MaskBoolTable.Empty();
		uniGLBAssetList->Textures.Empty();

		localAsset.NormalBoolTable.SetNum(mScenePtr->mNumTextures);
		localAsset.MaskBoolTable.SetNum(mScenePtr->mNumTextures);
		uniGLBAssetList->Textures.SetNum(mScenePtr->mNumTextures);

		const VRM::VRMMetadata* meta = static_cast<const VRM::VRMMetadata*>(mScenePtr->mVRMMeta);
		if (meta) {
			for (int i = 0; i < meta->materialNum; ++i) {
				int t = 0;

				t = meta->material[i].textureProperties._BumpMap;
				if (localAsset.NormalBoolTable.IsValidIndex(t)) {
					localAsset.NormalBoolTable[t] = true;
				}

				t = meta->material[i].textureProperties._OutlineWidthTexture;
				if (localAsset.MaskBoolTable.IsValidIndex(t)) {
					localAsset.MaskBoolTable[t] = true;
				}
			}
		}
	}

	if (mScenePtr->HasTextures()) {
		// Note: PNG format.  Other formats are supported

		//for (uint32_t i = 0; i < mScenePtr->mNumTextures; ++i) {
		{
			uint32_t i = TexCount;
			if (SubCount == 0) {
				auto& t = *mScenePtr->mTextures[i];
				int Width = t.mWidth;
				int Height = t.mHeight;

				FString baseName = UniGLBConverter::NormalizeFileName(t.mFilename.C_Str());
				if (baseName.Len() == 0) {
					baseName = TEXT("texture") + FString::FromInt(i);
				}
				bool bNormalGreenFlip = localAsset.NormalBoolTable[i];
				if (bNormalGreenFlip) {
					baseName += TEXT("_N");
				}

				FString name = FString(TEXT("T_")) + baseName;
				auto* pkg = GetTransientPackage();
				UTexture2D* NewTexture2D = UniGLBLoaderUtil::CreateTextureFromImage(name, pkg, t.pcData, t.mWidth, false, localAsset.NormalBoolTable[i], bNormalGreenFlip&&(UniGLBConverter::IsImportMode() == false));
				uniGLBAssetList->Textures[i] = NewTexture2D;
			}

			if (SubCount == 1) {
				UTexture2D* NewTexture2D = uniGLBAssetList->Textures[i];

#if WITH_EDITOR
				NewTexture2D->DeferCompression = false;
#endif

				// Set options
				if (localAsset.NormalBoolTable[i]) {
					NewTexture2D->CompressionSettings = TC_Normalmap;
					NewTexture2D->SRGB = 0;
#if WITH_EDITOR
					if (UniGLBConverter::IsImportMode()) {
						NewTexture2D->bFlipGreenChannel = true;
					}
#endif
				}
				if (localAsset.MaskBoolTable[i]) {
					// comment for material warning...
					//NewTexture2D->SRGB = 0;
				}

				if (NewTexture2D->SRGB) {
					if (option->bBC7Mode) {
						NewTexture2D->CompressionSettings = TC_BC7;
					}
				}
				if (option->bMipmapGenerateMode == false) {
#if WITH_EDITORONLY_DATA
					NewTexture2D->MipGenSettings = TMGS_NoMipmaps;
#endif
				}

				NewTexture2D->UpdateResource();
#if WITH_EDITOR
				//NewTexture2D->PostEditChange();
#endif

			}
		}
	}
	return false;
}




FUniGLBAsyncLoadAction::FUniGLBAsyncLoadAction(const FLatentActionInfo& LatentInfo, FUniGLBAsyncLoadActionParam &p)
	: ExecutionFunction(LatentInfo.ExecutionFunction)
	, OutputLink(LatentInfo.Linkage)
	, CallbackTarget(LatentInfo.CallbackTarget)
	, LocalAsset(MakeUnique<UniGLBLocalAsyncAsset>())
	, param(p)
	{
}

FUniGLBAsyncLoadAction::~FUniGLBAsyncLoadAction() = default;


void FUniGLBAsyncLoadAction::UpdateOperation(FLatentResponse& Response)
{
	TRACE_CPUPROFILER_EVENT_SCOPE(TEXT("UniGLBLoad UpdateOperation"))

	enum class ESequenceNo : uint32{
		Init,
		FileWait,
		AssImp,
		TextureLoop,
		AssetCreate,
		Finish,
	};

	// TexCount / SubCount / FrameCount / StartTime are per-action members now (see header).
	++FrameCount;

	auto logFunc = [&](FString str="") {
		UE_LOG(LogUniGLBLoader, Log, TEXT("AsyncLoad frame=%04d(%02.2lf),  SequenceNo=%02d %s"), FrameCount, FPlatformTime::Seconds()-StartTime, SequenceCount, *str);
	};
	auto logTexFunc = [&](int TexCount) {
		UE_LOG(LogUniGLBLoader, Log, TEXT("AsyncLoad frame=%04d(%02.2lf),  SequenceNo=%02d  TextureCount=%02d"), FrameCount, FPlatformTime::Seconds() - StartTime, SequenceCount, TexCount);
	};

	// async file load
	if (SequenceCount == (int)ESequenceNo::Init) {
		TRACE_CPUPROFILER_EVENT_SCOPE(TEXT("UniGLBLoad UpdateOperation init"))
		TexCount = 0;
		SubCount = 0;
		FrameCount = 0;
		StartTime = FPlatformTime::Seconds();
		logFunc("Begin");
		++SequenceCount;


		TFunction< void() > f = [this] {
			if (FFileHelper::LoadFileToArray(LocalAsset->uniGLBLocalRes, *param.filepath)) {
				param.pData = LocalAsset->uniGLBLocalRes.GetData();
				param.dataSize = LocalAsset->uniGLBLocalRes.Num();
			}
		};

		auto p2 = ENamedThreads::AnyBackgroundThreadNormalTask;
		//p2 = ENamedThreads::AnyBackgroundThreadNormalTask;
		//p2 = ENamedThreads::GameThread_Local;
		t2 = FFunctionGraphTask::CreateAndDispatchWhenReady(f, TStatId(), nullptr, p2);
		return;
	}

	if (SequenceCount == (int)ESequenceNo::FileWait) {
		if (t2->IsComplete()) {
			logFunc();
			++SequenceCount;

			param.OutUniGLBAsset = Cast<UUniGLBAssetListObject>(StaticDuplicateObject(param.InUniGLBAsset, GetTransientPackage(), NAME_None));
		}
		return;
	}

	if (SequenceCount == (int)ESequenceNo::AssImp) {
		TRACE_CPUPROFILER_EVENT_SCOPE(TEXT("UniGLBLoad UpdateOperation assimp"))
		logFunc();
		++SequenceCount;

		LocalAsset->Importer = MakeUnique<Assimp::Importer>();
		LocalAsset->ScenePtr = LocalAsset->Importer->ReadFileFromMemory(LocalAsset->uniGLBLocalRes.GetData(), LocalAsset->uniGLBLocalRes.Num(),
			aiProcess_Triangulate | aiProcess_MakeLeftHanded | aiProcess_CalcTangentSpace | aiProcess_GenSmoothNormals | aiProcess_OptimizeMeshes,
			"vrm");
		return;
	}

	if (SequenceCount == (int)ESequenceNo::TextureLoop) {
		TRACE_CPUPROFILER_EVENT_SCOPE_TEXT(*FString::Printf(TEXT("UniGLBLoad UpdateOperation texture %d"), SubCount))
		if (LocalAsset->ScenePtr == nullptr) {
			Response.FinishAndTriggerIf(true, ExecutionFunction, OutputLink, CallbackTarget);
			LocalAsset->Reset();
			return;
		}

		if (TexCount < (int)LocalAsset->ScenePtr->mNumTextures) {

			if (SubCount == 0) {
				ConvTex(*LocalAsset, param.OutUniGLBAsset, LocalAsset->ScenePtr, &param.OptionForRuntimeLoad, TexCount, 0);
			}
			if (SubCount == 2) {
				ConvTex(*LocalAsset, param.OutUniGLBAsset, LocalAsset->ScenePtr, &param.OptionForRuntimeLoad, TexCount, 1);
			}
			++SubCount;

			if (SubCount >= 4) {
				logTexFunc(TexCount);
				++TexCount;
				SubCount = 0;
			}
		} else {
			logFunc();
			++SequenceCount;
		}
		return;
	}


	if (SequenceCount == (int)ESequenceNo::AssetCreate) {
		TRACE_CPUPROFILER_EVENT_SCOPE(TEXT("UniGLBLoad UpdateOperation asset"))
		logFunc();
		++SequenceCount;
		if (param.pData) {
			UUniGLBLoaderBPFunctionLibrary::LoadVRMFileFromMemory(param.InUniGLBAsset, param.OutUniGLBAsset, param.filepath, param.pData, param.dataSize);
		} else {
			UUniGLBLoaderBPFunctionLibrary::LoadVRMFile(param.InUniGLBAsset, param.OutUniGLBAsset, param.filepath, param.OptionForRuntimeLoad);
		}
		return;
	}

	if (SequenceCount == (int)ESequenceNo::Finish) {
		logFunc("End");

		Response.FinishAndTriggerIf(true, ExecutionFunction, OutputLink, CallbackTarget);
		LocalAsset->Reset();
	}
}
