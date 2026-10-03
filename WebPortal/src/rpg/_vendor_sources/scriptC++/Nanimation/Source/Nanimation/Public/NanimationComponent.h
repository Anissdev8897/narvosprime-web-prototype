// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimationComponent.h
// =====================
// UNanimationComponent owns the NETWORK + STATE side of the system. It holds the
// active set, the per-category LOCAL ShuffleBag state (cosmetic only), and the
// replicated FNanimActionPulse array that synchronises Replicated-category picks
// across the network (one entry per category).
//
// HYBRID model (LOCKED):
//   * Replicated category   -> authority advances the pulse for that category
//                              (seed + monotonic draw counter + context); RepNotify
//                              re-derives the pick on every machine as a PURE
//                              function of the pulse (PickIndexDeterministic).
//                              We NEVER replicate the asset or an index by RPC.
//   * LocalCosmetic category -> picked locally with a STATEFUL local bag
//                              (idle-breaks etc.), no replication, no bandwidth.
//
// DETERMINISM RULE: replicated picks use ONLY the pure (Seed, DrawCount) replay.
// Persistent per-machine bag state is reserved for LocalCosmetic, so the two
// paths can never cross-contaminate and desync.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Math/RandomStream.h"
#include "NanimationTypes.h"

#include "NanimationComponent.generated.h" // MUST be last include.

class UNanimationSet;
struct FStreamableHandle;

/** Broadcast when a category resolves to a concrete variant (after async load).
 *  UI / character BP binds this to actually play the chosen anim. */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnNanimVariantChosen, ENanimCategory, Category, FNanimVariant, Variant);

UCLASS(ClassGroup = (Nanimation), meta = (BlueprintSpawnableComponent))
class NANIMATION_API UNanimationComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UNanimationComponent();

	//~ Begin UActorComponent interface
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	//~ End UActorComponent interface

	/** The active action set. Now REPLICATED as a standard UObject reference
	 *  (ReplicatedUsing=OnRep_ActiveSet) to prevent cross-machine divergence.
	 *  Assign via SetActiveSet() to clear draw state. */
	UPROPERTY(ReplicatedUsing = OnRep_ActiveSet, EditAnywhere, BlueprintReadWrite, Category = "Nanimation")
	TObjectPtr<UNanimationSet> ActiveSet;

	/** Fired once the picked variant is resolved (sync or async). */
	UPROPERTY(BlueprintAssignable, Category = "Nanimation")
	FOnNanimVariantChosen OnVariantChosen;

	/**
	 * REQUEST a new pick for a category. Routing is decided from the category's
	 * FNanimAction.NetMode.
	 */
	UFUNCTION(BlueprintCallable, Category = "Nanimation")
	void RequestAction(ENanimCategory Category);

	/**
	 * REQUEST a new pick with a directional/stance context (for locomotion).
	 * The context travels inside the pulse so all machines filter identically.
	 */
	UFUNCTION(BlueprintCallable, Category = "Nanimation")
	void RequestActionWithContext(ENanimCategory Category, ENanimDirection Dir, ENanimStance Stance);

	/**
	 * LOCAL cosmetic pick. Never touches the network.
	 */
	UFUNCTION(BlueprintCallable, Category = "Nanimation")
	void PlayLocalCosmetic(ENanimCategory Category);

	/**
	 * Set the active set (authority only). Resets draw state because a different
	 * set means different variant arrays — old indices are invalid.
	 */
	UFUNCTION(BlueprintCallable, Category = "Nanimation")
	void SetActiveSet(UNanimationSet* NewSet);

protected:
	/** Server RPC: client asks the authority to advance the pulse for a category.
	 *  Simple anti-spam: rate-limited server-side to at most one accepted
	 *  request per category per tick (see ServerRequestAction_Implementation). */
	UFUNCTION(Server, Reliable, WithValidation)
	void ServerRequestAction(ENanimCategory Category, ENanimDirection Dir, ENanimStance Stance);

	/**
	 * Replicated pulse array — ONE ENTRY PER CATEGORY USED. No more cross-category
	 * event loss (two actions in the same net-update window for different
	 * categories each get their own RepNotify tick).
	 */
	UPROPERTY(ReplicatedUsing = OnRep_ActionPulses)
	TArray<FNanimActionPulse> ActionPulses;

	/** RepNotify: re-derive picks for every pulse whose DrawCount changed. */
	UFUNCTION()
	void OnRep_ActionPulses();

	/** RepNotify for ActiveSet: log + re-derive pending pulses. */
	UFUNCTION()
	void OnRep_ActiveSet();

private:
	// --- AUTHORITY-ONLY state (server) -----------------------------------
	/** Per-component base entropy, set once on the authority in BeginPlay. */
	int32 GlobalSeed = 0;

	/** Authority's monotonic draw counter per category. */
	TMap<ENanimCategory, int32> DrawCounts;

	/** Authority-side anti-spam: last world time (seconds) a Server RPC was
	 *  ACCEPTED for a given category. A second RPC for the same category within
	 *  the same frame (same timestamp) is dropped with a Verbose log instead of
	 *  advancing the pulse again. Minimal, non-invasive rate limit — does not
	 *  affect the authority's own local RequestAction calls (those never go
	 *  through this RPC). */
	TMap<ENanimCategory, float> LastAcceptedServerRequestTime;

	/** Authority's CURRENT base seed per category. Starts at ComputeBaseSeed(Category)
	 *  on first use and is rebased (HashCombine) every time DrawCounts reaches
	 *  NanimationConstants::RebaseThreshold. This is the seed actually placed into
	 *  the pulse — ComputeBaseSeed() alone is only ever used to seed this map. */
	TMap<ENanimCategory, int32> CurrentBaseSeeds;

	// --- LOCAL COSMETIC state (every machine, NOT replicated) ------------
	TMap<ENanimCategory, TArray<int32>> LocalBags;
	TMap<ENanimCategory, int32>         LocalLastIndex;

	/** Local cosmetic stream — evolves independently per client. */
	FRandomStream LocalCosmeticStream;

	// --- ASYNC LOAD state (every machine) --------------------------------
	/** Per-category async load handles. A new request cancels only the
	 *  previous load of ITS category (no more cross-category cancellation). */
	TMap<ENanimCategory, TSharedPtr<FStreamableHandle>> ActiveLoadHandles;

	// --- CLIENT-SIDE tracking --------------------------------------------
	/** Last-seen DrawCount per category (to detect increments across pulses). */
	TMap<ENanimCategory, int32> LastSeenDrawCount;

	/** Have we received our first pulse batch? (suppress initial broadcast). */
	bool bFirstPulseReceived = false;

	/** Authority helper: compute the stable base seed for a category. */
	int32 ComputeBaseSeed(ENanimCategory Category) const;

	/** Resolve a KNOWN index to a variant and broadcast (async-load if needed). */
	void ResolveIndexAndBroadcast(ENanimCategory Category, int32 Index);

	/** Cancel all async loads in flight. Called from EndPlay. */
	void CancelAllAsyncLoads();

	/** Internal: route a single category draw through the authority path. */
	void AdvancePulseForCategory(ENanimCategory Category, const FNanimPickContext& Ctx);
};
