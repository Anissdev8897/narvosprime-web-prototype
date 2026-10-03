// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// AnimNode_NanimSelect.cpp
//
// Implements the LOCAL, cosmetic variant-cycling sequence player. KEY behaviours:
//   * Pick a variant on Initialize (state-entry) and on cycle wrap (loop), never
//     per frame. ALSO re-pick if Seed/Direction/Stance changed since last pick.
//   * Share one Sync Group across variants (no foot-phase pop on re-pick).
//   * Let the sync/tick system own InternalTimeAccumulator.

#include "AnimNode_NanimSelect.h"
#include "NanimationLibrary.h"
#include "Animation/AnimInstanceProxy.h"
#include "Animation/AnimationPoseData.h"
#include "Animation/AnimationAsset.h"
#include "Animation/AnimSyncScope.h"
#include "Animation/AnimSync.h"

void FAnimNode_NanimSelect::Initialize_AnyThread(const FAnimationInitializeContext& Context)
{
	FAnimNode_Base::Initialize_AnyThread(Context);

	GetEvaluateGraphExposedInputs().Execute(Context);

	// Seed the LOCAL cycling stream.
	NodeStream.Initialize(Seed);
	SnapshotPinState();

	InternalTimeAccumulator = 0.0f;
	PreviousPositionRatio   = 0.0f;
	LastVariantIndex        = INDEX_NONE;
	DeltaTimeRecord         = FDeltaTimeRecord();
	MarkerTickRecord.Reset();
	Bag.Reset();

	SelectVariant();
}

void FAnimNode_NanimSelect::CacheBones_AnyThread(const FAnimationCacheBonesContext& Context)
{
}

void FAnimNode_NanimSelect::Update_AnyThread(const FAnimationUpdateContext& Context)
{
	// Refresh pin inputs each update. If Seed/Direction/Stance changed since the
	// last pick, re-seed the stream and trigger a re-pick at the next cycle
	// boundary (or immediately if no variant is playing).
	GetEvaluateGraphExposedInputs().Execute(Context);

	if (HasPinStateChanged())
	{
		// Pin change detected: re-seed + force re-pick.
		NodeStream.Initialize(Seed);
		SnapshotPinState();
		Bag.Reset();

		// If we're mid-playback, let the current clip finish its cycle, then
		// the next cycle-wrap logic in SelectVariant will pick from the new
		// stream+bag. If nothing is playing, re-pick immediately.
		if (!CurrentSequence || InternalTimeAccumulator <= 0.0f)
		{
			SelectVariant();
		}
		// else: will be picked at next cycle boundary (the HasPinStateChanged
		// flag naturally clears after the re-seed+snapshot; the bag is fresh).
	}

	UAnimSequenceBase* Sequence = ResolveCurrentSequence();
	if (!Sequence || !Sequence->GetSkeleton())
	{
		return;
	}

	// CYCLE-BOUNDARY re-pick detection.
	const float Length = Sequence->GetPlayLength();
	if (bLoop && bRepickOnCycle && Length > 0.0f && PlayRate >= 0.0f)
	{
		const float Ratio = FMath::Clamp(InternalTimeAccumulator / Length, 0.0f, 1.0f);
		if (Ratio + 0.5f < PreviousPositionRatio)
		{
			SelectVariant();
			Sequence = ResolveCurrentSequence();
			if (!Sequence || !Sequence->GetSkeleton())
			{
				PreviousPositionRatio = 0.0f;
				return;
			}
		}

		const float CurLength = Sequence->GetPlayLength();
		PreviousPositionRatio = (CurLength > 0.0f)
			? FMath::Clamp(InternalTimeAccumulator / CurLength, 0.0f, 1.0f)
			: 0.0f;
	}

	// Build tick record for shared sync group.
	UE::Anim::FAnimSyncGroupScope& SyncScope = Context.GetMessageChecked<UE::Anim::FAnimSyncGroupScope>();

	FAnimTickRecord TickRecord(
		Sequence,
		bLoop,
		PlayRate,
		/*bIsEvaluator*/ false,
		/*FinalBlendWeight*/ Context.GetFinalBlendWeight(),
		/*InOutCurrentTime*/ InternalTimeAccumulator,
		MarkerTickRecord);

	TickRecord.DeltaTimeRecord = &DeltaTimeRecord;
	TickRecord.GatherContextData(Context);

	UE::Anim::FAnimSyncParams SyncParams;
	SyncParams.GroupName = SyncGroupName;
	SyncParams.Role      = GroupRole;
	SyncParams.Method    = (SyncGroupName != NAME_None) ? EAnimSyncMethod::SyncGroup : EAnimSyncMethod::DoNotSync;

	SyncScope.AddTickRecord(TickRecord, SyncParams);
}

void FAnimNode_NanimSelect::Evaluate_AnyThread(FPoseContext& Output)
{
	UAnimSequenceBase* Sequence = ResolveCurrentSequence();
	if (Sequence && Sequence->GetSkeleton())
	{
		FAnimationPoseData PoseData(Output);
		Sequence->GetAnimationPose(
			PoseData,
			FAnimExtractContext(
				(double)InternalTimeAccumulator,
				Output.AnimInstanceProxy->ShouldExtractRootMotion(),
				DeltaTimeRecord,
				bLoop));
	}
	else
	{
		Output.ResetToRefPose();
	}
}

void FAnimNode_NanimSelect::GatherDebugData(FNodeDebugData& DebugData)
{
	FString DebugLine = DebugData.GetNodeName(this);
	DebugLine += FString::Printf(
		TEXT("(Variant: %d/%d  Time: %.2f  SyncGroup: %s  Dir: %d  Stance: %d)"),
		CurrentVariantIndex,
		Action.Variants.Num(),
		InternalTimeAccumulator,
		*SyncGroupName.ToString(),
		static_cast<int32>(Direction),
		static_cast<int32>(Stance));
	DebugData.AddDebugItem(DebugLine, /*bPoseSource*/ true);
}

void FAnimNode_NanimSelect::SelectVariant()
{
	if (!Action.IsValid())
	{
		CurrentVariantIndex = INDEX_NONE;
		CurrentSequence = nullptr;
		return;
	}

	// Build the filter context from the current Direction/Stance pins.
	FNanimPickContext Ctx;
	Ctx.Dir = Direction;
	Ctx.Stance = Stance;

	// Pass the context through: filtered indices before policy.
	const int32 Index = UNanimationLibrary::PickVariantIndex(Action, NodeStream, LastVariantIndex, Bag, Ctx);

	LastVariantIndex    = Index;
	CurrentVariantIndex = Index;

	InternalTimeAccumulator = 0.0f;
	PreviousPositionRatio   = 0.0f;
	DeltaTimeRecord         = FDeltaTimeRecord();
	MarkerTickRecord.Reset();

	CurrentSequence = ResolveCurrentSequence();
}

UAnimSequenceBase* FAnimNode_NanimSelect::ResolveCurrentSequence() const
{
	if (!Action.Variants.IsValidIndex(CurrentVariantIndex))
	{
		return nullptr;
	}

	const FNanimVariant& Variant = Action.Variants[CurrentVariantIndex];

	if (CurrentSequence && CurrentSequence == Variant.Animation.Get())
	{
		return CurrentSequence;
	}

	return Variant.Animation.Get();
}
