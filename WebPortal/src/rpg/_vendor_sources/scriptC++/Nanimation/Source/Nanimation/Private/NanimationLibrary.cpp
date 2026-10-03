// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimationLibrary.cpp
//
// All draws are PURE on (FRandomStream, bag). FRandomStream is a fixed LCRNG
// (cheat-sheet: Seed = Seed*196314165 + 907633515), so identical seed+state ->
// identical index on every networked client. NO FMath::Rand is used.

#include "NanimationLibrary.h"
#include "NanimationSet.h"
#include "NanimationLog.h"
#include "Animation/AnimMontage.h"
#include "Animation/AnimSequenceBase.h"
#include "Animation/AnimInstance.h"
#include "Components/SkeletalMeshComponent.h"

// ---------------------------------------------------------------------------
// Filter helper: build the subset of variant indices matching the context.
// Called once per pick, BEFORE the policy runs, so the subset is deterministic
// (order derives from the original array order).
// ---------------------------------------------------------------------------
void UNanimationLibrary::BuildFilteredIndices(const FNanimAction& Action, const FNanimPickContext& Ctx, TArray<int32>& OutIndices)
{
	OutIndices.Reset();
	if (!Ctx.IsActive())
	{
		// No filter: all indices pass through.
		for (int32 i = 0; i < Action.Variants.Num(); ++i)
		{
			OutIndices.Add(i);
		}
		return;
	}

	for (int32 i = 0; i < Action.Variants.Num(); ++i)
	{
		const FNanimVariant& V = Action.Variants[i];
		if (Ctx.Dir != ENanimDirection::None && V.Dir != ENanimDirection::None && V.Dir != Ctx.Dir)
		{
			continue; // Direction mismatch
		}
		if (Ctx.Stance != ENanimStance::None && V.Stance != ENanimStance::None && V.Stance != Ctx.Stance)
		{
			continue; // Stance mismatch
		}
		OutIndices.Add(i);
	}

	// If filtering removed everything, fall back to the full set (graceful
	// degradation: a too-restrictive context still plays *something*).
	if (OutIndices.Num() == 0)
	{
		UE_LOG(LogNanimation, Warning, TEXT("PickVariantIndex: filter (Dir=%d, Stance=%d) eliminated all %d variants; falling back to full set."),
			static_cast<int32>(Ctx.Dir), static_cast<int32>(Ctx.Stance), Action.Variants.Num());
		for (int32 i = 0; i < Action.Variants.Num(); ++i)
		{
			OutIndices.Add(i);
		}
	}
}

int32 UNanimationLibrary::DrawWeighted(const FNanimAction& Action, const TArray<int32>& Indices, FRandomStream& Stream, int32 ForbiddenIndex)
{
	// Sum positive weights from the pre-filtered index subset.
	float Total = 0.0f;
	for (const int32 i : Indices)
	{
		if (i == ForbiddenIndex)
		{
			continue;
		}
		if (Action.Variants[i].Weight > 0.0f)
		{
			Total += Action.Variants[i].Weight;
		}
	}

	// All-positive-weight filter: exclude zero-weight variants.
	if (Total <= 0.0f)
	{
		// No positive weight in the filtered subset. Fall back to Uniform over
		// non-forbidden filtered indices (deterministic: same seed → same fallback).
		TArray<int32> Candidates;
		for (const int32 i : Indices)
		{
			if (i != ForbiddenIndex)
			{
				Candidates.Add(i);
			}
		}
		if (Candidates.Num() == 0)
		{
			return INDEX_NONE;
		}
		return Candidates[Stream.RandRange(0, Candidates.Num() - 1)];
	}

	const float Roll = Stream.GetFraction() * Total;
	float Accum = 0.0f;
	for (const int32 i : Indices)
	{
		if (i == ForbiddenIndex)
		{
			continue;
		}
		if (Action.Variants[i].Weight > 0.0f)
		{
			Accum += Action.Variants[i].Weight;
			if (Roll <= Accum)
			{
				return i;
			}
		}
	}

	// Floating-point edge: return last positive-weight index.
	for (int32 idx = Indices.Num() - 1; idx >= 0; --idx)
	{
		const int32 i = Indices[idx];
		if (i != ForbiddenIndex && Action.Variants[i].Weight > 0.0f)
		{
			return i;
		}
	}
	return INDEX_NONE;
}

int32 UNanimationLibrary::PickVariantIndex(const FNanimAction& Action, FRandomStream& Stream, int32 LastIndex, TArray<int32>& Bag, const FNanimPickContext& Ctx)
{
	if (!Action.IsValid())
	{
		return INDEX_NONE;
	}

	// Build filtered subset ONCE per pick (deterministic, order-stable).
	TArray<int32> Indices;
	BuildFilteredIndices(Action, Ctx, Indices);

	const int32 Count = Indices.Num();
	if (Count == 0)
	{
		return INDEX_NONE;
	}
	if (Count == 1)
	{
		return Indices[0]; // Degenerate: only one choice.
	}

	switch (Action.Policy)
	{
	case ENanimPolicy::Uniform:
	{
		return Indices[Stream.RandRange(0, Count - 1)];
	}

	case ENanimPolicy::Weighted:
	{
		return DrawWeighted(Action, Indices, Stream, /*ForbiddenIndex*/ INDEX_NONE);
	}

	case ENanimPolicy::NoImmediateRepeat:
	{
		return DrawWeighted(Action, Indices, Stream, LastIndex);
	}

	case ENanimPolicy::ShuffleBag:
	default:
	{
		if (Bag.Num() == 0)
		{
			// Refill: push each filtered index round(Weight) times. Weight ≤ 0
			// means 0 copies (never enters the bag — FIXED from v0.1).
			Bag.Reset();
			bool bHasPositiveWeight = false;
			for (const int32 i : Indices)
			{
				const float W = FMath::Max(0.0f, Action.Variants[i].Weight);
				if (W > 0.0f)
				{
					bHasPositiveWeight = true;
					const int32 Copies = FMath::Max(1, FMath::RoundToInt(W));
					for (int32 c = 0; c < Copies; ++c)
					{
						Bag.Add(i);
					}
				}
			}

			// If ALL variants are zero-weight, fall back to uniform bag (1 copy
			// of each filtered index). Deterministic: same seed → same bag.
			if (!bHasPositiveWeight)
			{
				UE_LOG(LogNanimation, Warning, TEXT("PickVariantIndex: all %d filtered variants have weight <= 0; ShuffleBag degrading to Uniform."), Count);
				Bag.Reset();
				for (const int32 i : Indices)
				{
					Bag.Add(i);
				}
			}

			// Deterministic Fisher-Yates using the SAME stream -> same shuffle on
			// every client given the same seed history.
			for (int32 i = Bag.Num() - 1; i > 0; --i)
			{
				const int32 j = Stream.RandRange(0, i);
				Bag.Swap(i, j);
			}

			// Avoid an immediate repeat across the bag boundary.
			if (Bag.Num() > 1 && Bag.Last() == LastIndex)
			{
				Bag.Swap(Bag.Num() - 1, 0);
			}
		}

		// Pop from the end (cheap, no shift).
		const int32 Picked = Bag.Pop(EAllowShrinking::No);
		return Picked;
	}
	}
}

int32 UNanimationLibrary::PickIndexDeterministic(const FNanimAction& Action, int32 Seed, int32 DrawCount, const FNanimPickContext& Ctx)
{
	if (!Action.IsValid())
	{
		return INDEX_NONE;
	}

	// Clamp draw count to [1, cap] — identically on every machine, so still pure.
	// With seed rebase (NanimationConstants::RebaseThreshold = 1024) this clamp
	// is a safety ceiling for extreme edge cases, not a normal code path.
	const int32 Draws = FMath::Clamp(DrawCount <= 0 ? 1 : DrawCount, 1, MaxDeterministicReplay);

	// Reconstruct the WHOLE draw history from a fresh stream + empty bag.
	FRandomStream Stream(Seed);
	TArray<int32> Bag;
	int32 Last  = INDEX_NONE;
	int32 Index = INDEX_NONE;
	for (int32 i = 0; i < Draws; ++i)
	{
		Index = PickVariantIndex(Action, Stream, Last, Bag, Ctx);
		Last  = Index;
	}
	return Index;
}

FNanimVariant UNanimationLibrary::PickVariant(const UNanimationSet* Set, ENanimCategory Category, int32 Seed)
{
	if (!Set)
	{
		return FNanimVariant();
	}

	const FNanimAction* Action = Set->FindAction(Category);
	if (!Action || !Action->IsValid())
	{
		return FNanimVariant();
	}

	const int32 Index = PickIndexDeterministic(*Action, Seed, /*DrawCount*/ 1);
	return Action->Variants.IsValidIndex(Index) ? Action->Variants[Index] : FNanimVariant();
}

UAnimMontage* UNanimationLibrary::PlayRandomMontage(USkeletalMeshComponent* MeshComp, const UNanimationSet* Set, ENanimCategory Category, int32 Seed)
{
	if (!MeshComp || !Set)
	{
		return nullptr;
	}

	const FNanimVariant Variant = PickVariant(Set, Category, Seed);
	if (Variant.Animation.IsNull())
	{
		UE_LOG(LogNanimation, Warning, TEXT("PlayRandomMontage: picked variant for category %d has no animation set."),
			static_cast<int32>(Category));
		return nullptr;
	}

	UAnimSequenceBase* Resolved = Variant.Animation.LoadSynchronous();
	UAnimMontage* Montage = Cast<UAnimMontage>(Resolved);
	if (!Montage)
	{
		UE_LOG(LogNanimation, Warning,
			TEXT("PlayRandomMontage: picked variant for category %d resolved to a %s, not a UAnimMontage. Use PlayRandomSequence for AnimSequence-based sets."),
			static_cast<int32>(Category),
			Resolved ? *Resolved->GetClass()->GetName() : TEXT("nullptr"));
		return nullptr;
	}

	if (UAnimInstance* AnimInst = MeshComp->GetAnimInstance())
	{
		AnimInst->Montage_Play(Montage);
		return Montage;
	}

	return nullptr;
}

UAnimMontage* UNanimationLibrary::PlayRandomSequence(USkeletalMeshComponent* MeshComp, const UNanimationSet* Set, ENanimCategory Category, int32 Seed, FName SlotName)
{
	if (!MeshComp || !Set)
	{
		return nullptr;
	}

	const FNanimVariant Variant = PickVariant(Set, Category, Seed);
	if (Variant.Animation.IsNull())
	{
		UE_LOG(LogNanimation, Warning, TEXT("PlayRandomSequence: picked variant for category %d has no animation set."),
			static_cast<int32>(Category));
		return nullptr;
	}

	UAnimSequenceBase* Resolved = Variant.Animation.LoadSynchronous();
	if (!Resolved)
	{
		UE_LOG(LogNanimation, Warning, TEXT("PlayRandomSequence: failed to resolve variant for category %d."),
			static_cast<int32>(Category));
		return nullptr;
	}

	if (UAnimInstance* AnimInst = MeshComp->GetAnimInstance())
	{
		return AnimInst->PlaySlotAnimationAsDynamicMontage(Resolved, SlotName, 0.25f, 0.25f, 1.0f, 1);
	}

	return nullptr;
}
