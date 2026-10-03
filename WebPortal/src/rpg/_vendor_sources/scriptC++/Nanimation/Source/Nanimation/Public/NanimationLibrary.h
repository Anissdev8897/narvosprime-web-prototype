// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimationLibrary.h
// ===================
// Stateless blueprint function library that implements the variant DRAW. Every
// draw is a PURE FUNCTION of (FRandomStream state, bag state). This is the single
// most important contract in the whole system:
//
//   * Determinism: the SAME (seed, draw-count) -> the SAME index on every machine.
//     That is what lets the network model replicate a tiny FNanimActionPulse
//     instead of the asset or an index. NO FMath::Rand anywhere.
//   * Separation: the library knows nothing about replication or components; it
//     only turns randomness into an index/variant. The Component owns the pulse &
//     local bag state and feeds them in.
//
// TWO DRAW SURFACES:
//   * PickVariantIndex(...)        -- STATEFUL single draw (mutates Stream+Bag).
//                                     Used for the deterministic replay loop, the
//                                     Component's LocalCosmetic path, and the
//                                     AnimNode's local loop cycling.
//   * PickIndexDeterministic(...)  -- PURE replay of N stateful draws from a fresh
//                                     stream. The ONLY surface a Replicated pick
//                                     may use (no persistent per-machine state).
//
// WEIGHT-BEHAVIOUR CONTRACT (all policies):
//   * Variants with Weight <= 0 are excluded from selection.
//   * If ALL variants have Weight <= 0, every policy degrades to Uniform
//     (all indices equally likely, logged once per action via LogNanimation).
//   * The degradation is deterministic: same seed + all-zero weights → same
//     fallback index on every machine.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "Math/RandomStream.h"        // FRandomStream (deterministic, replicable RNG)
#include "NanimationTypes.h"          // FNanimAction / FNanimVariant / ENanimCategory

#include "NanimationLibrary.generated.h" // MUST be last include.

class UNanimationSet;
class UAnimMontage;
class UAnimSequenceBase;
class USkeletalMeshComponent;

/**
 * UNanimationLibrary
 * ------------------
 * Pure draw helpers. Marked BlueprintFunctionLibrary so designers can call the
 * same deterministic picks from BP and get identical results to C++.
 */
UCLASS()
class NANIMATION_API UNanimationLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/**
	 * Core STATEFUL picker. Given an action group, advance the supplied
	 * FRandomStream and return the chosen variant index according to Action.Policy.
	 *
	 * @param Action    The variant group to pick from.
	 * @param Stream    [in/out] Deterministic RNG. MUTATED by the draw (seed
	 *                  advances). This is the only randomness source -- no FMath::Rand.
	 * @param LastIndex The previously returned index (for NoImmediateRepeat). Pass
	 *                  INDEX_NONE (-1) when there is no history.
	 * @param Bag       [in/out] ShuffleBag working set. Refilled here when empty.
	 * @param Ctx       Optional filter context (Dir/Stance). None = no filter.
	 * @return          A valid index into Action.Variants after filtering,
	 *                  or INDEX_NONE if the group is empty / all filtered out.
	 *
	 * NOTE: not BlueprintCallable because it takes a by-ref FRandomStream and a
	 * mutable bag the BP layer should not own directly.
	 */
	static int32 PickVariantIndex(const FNanimAction& Action, FRandomStream& Stream, int32 LastIndex, TArray<int32>& Bag, const FNanimPickContext& Ctx = FNanimPickContext());

	/**
	 * PURE deterministic picker -- the backbone of the seed-replication model.
	 * Reconstructs a fresh FRandomStream(Seed) + empty bag and replays exactly
	 * DrawCount stateful draws, returning the index of the LAST draw. Because it
	 * depends ONLY on (Seed, DrawCount, Action, Ctx) it yields the identical index
	 * on every machine -- ShuffleBag's exhaust-before-repeat memory included.
	 *
	 * Cost is O(DrawCount); the Component's seed-rebase mechanism keeps DrawCount
	 * bounded by NanimationConstants::RebaseThreshold (1024) under normal operation.
	 * MaxDeterministicReplay (100k) is an absolute safety ceiling.
	 *
	 * @param DrawCount 1-based count of draws; values <= 0 are treated as 1.
	 * @param Ctx       Optional filter context (Dir/Stance). None = no filter.
	 */
	static int32 PickIndexDeterministic(const FNanimAction& Action, int32 Seed, int32 DrawCount, const FNanimPickContext& Ctx = FNanimPickContext());

	/**
	 * Convenience wrapper: deterministically pick the FIRST draw (DrawCount = 1)
	 * from the set's group for Category and return the variant by value. Fully
	 * deterministic in Seed.
	 */
	UFUNCTION(BlueprintCallable, Category = "Nanimation|Library")
	static FNanimVariant PickVariant(const UNanimationSet* Set, ENanimCategory Category, int32 Seed);

	/**
	 * Resolve (sync-load if needed) the picked variant as a montage and play it on
	 * the mesh's anim instance. Returns the montage played (or nullptr).
	 *
	 * The pick itself is deterministic in Seed; only the asset RESOLUTION is a
	 * side effect. For the heavy GASP volume prefer the async path on the
	 * Component; this helper is the simple one-shot convenience.
	 *
	 * NOTE: silently returns nullptr if the picked variant is not a UAnimMontage
	 * (e.g. it's an AnimSequence — use PlayRandomSequence instead). Logs a
	 * Warning in that case via LogNanimation.
	 */
	UFUNCTION(BlueprintCallable, Category = "Nanimation|Library", meta = (DefaultToSelf = "MeshComp"))
	static UAnimMontage* PlayRandomMontage(USkeletalMeshComponent* MeshComp, const UNanimationSet* Set, ENanimCategory Category, int32 Seed);

	/**
	 * Pick a variant deterministically from the set and play it as a dynamic
	 * montage on the mesh's anim instance via PlaySlotAnimationAsDynamicMontage.
	 * This is the AnimSequence counterpart to PlayRandomMontage — use this when
	 * the set contains AnimSequences (the scanner's default output).
	 *
	 * @param SlotName  The slot node name the dynamic montage will play in.
	 * @return the played UAnimMontage (dynamic), or nullptr on failure.
	 */
	UFUNCTION(BlueprintCallable, Category = "Nanimation|Library", meta = (DefaultToSelf = "MeshComp"))
	static UAnimMontage* PlayRandomSequence(USkeletalMeshComponent* MeshComp, const UNanimationSet* Set, ENanimCategory Category, int32 Seed, FName SlotName = "DefaultSlot");

private:
	/** Build the filtered subset of indices matching the pick context (once per pick). */
	static void BuildFilteredIndices(const FNanimAction& Action, const FNanimPickContext& Ctx, TArray<int32>& OutIndices);

	/** Weighted draw shared by Weighted policy and weighted ShuffleBag refill.
	 *  Operates on pre-filtered indices. */
	static int32 DrawWeighted(const FNanimAction& Action, const TArray<int32>& Indices, FRandomStream& Stream, int32 ForbiddenIndex);

	/** Hard cap on deterministic replay depth (identical on all machines).
	 *  With seed rebase active, this is a safety ceiling, not a normal code path. */
	static constexpr int32 MaxDeterministicReplay = 100000;
};
