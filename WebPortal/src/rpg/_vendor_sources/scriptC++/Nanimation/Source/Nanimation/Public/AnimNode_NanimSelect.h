// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// AnimNode_NanimSelect.h
// ======================
// FAnimNode_NanimSelect is a custom FAnimNode_Base that embeds & DRIVES a single
// sequence player, but the sequence it plays is one of several interchangeable
// VARIANTS chosen by the Nanimation picker. The pick happens ONLY on state-entry
// (first Initialize) or at a CYCLE boundary (loop wrap) -- never per frame -- so
// the character does not "twitch" between variants mid-cycle.
//
// SCOPE / NETWORK: this node is the LOCAL, COSMETIC loop-variant cycler. Each
// machine cycles its own variants using a LOCAL stream + bag; the exact variant
// shown on a given loop need not match across machines. For gameplay one-shots
// that MUST agree across the network, use UNanimationComponent.
//
// SEED: the Seed pin is read on Initialize AND when it changes in Update_AnyThread.
// A changed Seed triggers a re-pick at the next cycle boundary (or immediately if
// no variant is currently playing). Previously, only Initialize seeded the stream,
// making a mid-state Seed change invisible — this is now FIXED for v1.0.
//
// DIRECTION / STANCE: two optional pins (Dir, Stance) filter the variant pool.
// Both default to None (no filter). The filter is applied BEFORE the policy picks,
// so the subset is deterministic.

#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
#include "Animation/AnimNodeBase.h"
#include "Animation/AnimSequenceBase.h"
#include "Animation/AnimationAsset.h"
#include "Math/RandomStream.h"
#include "NanimationTypes.h"

#include "AnimNode_NanimSelect.generated.h"

USTRUCT(BlueprintInternalUseOnly)
struct NANIMATION_API FAnimNode_NanimSelect : public FAnimNode_Base
{
	GENERATED_BODY()

public:
	/** The variant group to choose from. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Settings", meta = (PinHiddenByDefault))
	FNanimAction Action;

	/**
	 * LOCAL base seed for this node's cosmetic variant cycling. Exposed as a pin.
	 * A change in Seed is detected in Update_AnyThread and triggers a re-pick.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Settings", meta = (PinShownByDefault))
	int32 Seed = 0;

	/**
	 * Optional direction filter. Only variants matching this direction (or None)
	 * are eligible. Default: None (no filter).
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Settings", meta = (PinHiddenByDefault))
	ENanimDirection Direction = ENanimDirection::None;

	/**
	 * Optional stance filter. Only variants matching this stance (or None)
	 * are eligible. Default: None (no filter).
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Settings", meta = (PinHiddenByDefault))
	ENanimStance Stance = ENanimStance::None;

	/** Shared sync group across variants. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sync")
	FName SyncGroupName = NAME_None;

	/** Role within the shared sync group. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sync")
	TEnumAsByte<EAnimGroupRole::Type> GroupRole = EAnimGroupRole::CanBeLeader;

	/** Should the chosen variant loop? */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Settings")
	bool bLoop = true;

	/** Re-pick a different variant each loop wrap. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Settings")
	bool bRepickOnCycle = true;

	/** Play rate. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Settings")
	float PlayRate = 1.0f;

public:
	FAnimNode_NanimSelect() = default;

	//~ Begin FAnimNode_Base interface
	virtual void Initialize_AnyThread(const FAnimationInitializeContext& Context) override;
	virtual void CacheBones_AnyThread(const FAnimationCacheBonesContext& Context) override;
	virtual void Update_AnyThread(const FAnimationUpdateContext& Context) override;
	virtual void Evaluate_AnyThread(FPoseContext& Output) override;
	virtual void GatherDebugData(FNodeDebugData& DebugData) override;
	//~ End FAnimNode_Base interface

private:
	float InternalTimeAccumulator = 0.0f;
	FDeltaTimeRecord DeltaTimeRecord;
	int32 CurrentVariantIndex = INDEX_NONE;
	int32 LastVariantIndex = INDEX_NONE;
	TArray<int32> Bag;
	FRandomStream NodeStream;
	FMarkerTickRecord MarkerTickRecord;
	float PreviousPositionRatio = 0.0f;

	/** The Seed value that was last applied (detects pin changes). */
	int32 AppliedSeed = 0;

	/** The Direction value that was last applied. */
	ENanimDirection AppliedDirection = ENanimDirection::None;

	/** The Stance value that was last applied. */
	ENanimStance AppliedStance = ENanimStance::None;

	UPROPERTY(Transient)
	TObjectPtr<UAnimSequenceBase> CurrentSequence = nullptr;

	void SelectVariant();
	UAnimSequenceBase* ResolveCurrentSequence() const;

	/** Check if Seed/Direction/Stance changed since last pick. */
	bool HasPinStateChanged() const
	{
		return Seed != AppliedSeed || Direction != AppliedDirection || Stance != AppliedStance;
	}

	/** Snapshot current pin values as applied. */
	void SnapshotPinState()
	{
		AppliedSeed = Seed;
		AppliedDirection = Direction;
		AppliedStance = Stance;
	}
};
