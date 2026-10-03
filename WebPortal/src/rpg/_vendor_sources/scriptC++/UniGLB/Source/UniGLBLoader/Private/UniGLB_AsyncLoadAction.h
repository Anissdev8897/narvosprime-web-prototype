// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/WeakObjectPtr.h"
#include "Engine/LatentActionManager.h"
#include "LatentActions.h"
#include "UniGLB_Util.h"

class UUniGLBAssetListObject;
struct FUniGLBImportOptionData;
// Per-action assimp/import scratch state. Defined in the .cpp so the assimp headers stay private.
class UniGLBLocalAsyncAsset;

class FUniGLBAsyncLoadActionParam {
public:
	const UUniGLBAssetListObject* InUniGLBAsset;
	UUniGLBAssetListObject*& OutUniGLBAsset;
	const FUniGLBImportOptionData OptionForRuntimeLoad;
	const FString filepath;
	const uint8* pData;
	size_t dataSize;
};


class FUniGLBAsyncLoadAction : public FPendingLatentAction
{
public:
	FName ExecutionFunction;
	int32 OutputLink;
	FWeakObjectPtr CallbackTarget;

	int SequenceCount = 0;
	FGraphEventRef t2 = nullptr;

	// Per-action progress counters. These were file-scope statics, so concurrent async loads shared
	// (and corrupted) each other's texture/sequence progress. One instance per latent action now.
	int TexCount = 0;
	int SubCount = 0;
	int FrameCount = 0;
	double StartTime = 0.0;

	// Per-action assimp scene + file buffer. Was a file-scope global -> two simultaneous
	// LoadVRMFileAsync calls trampled the same Importer/scene (corruption / leak / crash).
	TUniquePtr<UniGLBLocalAsyncAsset> LocalAsset;

	FUniGLBAsyncLoadActionParam param;

	FUniGLBAsyncLoadAction(const FLatentActionInfo& LatentInfo, FUniGLBAsyncLoadActionParam &);
	// Out-of-line so TUniquePtr<UniGLBLocalAsyncAsset> can delete a type only complete in the .cpp.
	virtual ~FUniGLBAsyncLoadAction() override;

	virtual void UpdateOperation(FLatentResponse& Response) override;

#if WITH_EDITOR
	// Returns a human readable description of the latent operation's current state
	virtual FString GetDescription() const override
	{
		//static const FNumberFormattingOptions DelayTimeFormatOptions = FNumberFormattingOptions()
		//	.SetMinimumFractionalDigits(3)
		//	.SetMaximumFractionalDigits(3);
		//return FText::Format(NSLOCTEXT("DelayAction", "DelayActionTimeFmt", "Delay ({0} seconds left)"), FText::AsNumber(TimeRemaining, &DelayTimeFormatOptions)).ToString();
		return FString("");
	}
#endif
};



