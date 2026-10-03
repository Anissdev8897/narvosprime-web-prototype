// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimationTypes.h
// =================
// SINGLE SOURCE OF TRUTH for every enum / struct shared across the Nanimation
// runtime. Every other runtime file (Set, Library, Component, AnimNode) includes
// THIS header and nothing redefines these symbols. Keeping the vocabulary in one
// place is what makes the system "data-driven": the scanner/classifier, the data
// asset, the picker library and the anim node all speak the exact same enums.
//
// WHY a dedicated types header (and not, say, putting these on the DataAsset):
//   * The AnimNode lives in AnimGraphRuntime-land and must NOT depend on the
//     DataAsset/Component to know about ENanimDirection/ENanimStance. A leaf
//     types header avoids circular includes (Set -> Types, Node -> Types, etc.).
//   * UENUM/USTRUCT reflection data is generated once, here.
//
// NAMING CONVENTION (intentional, not an inconsistency):
//   * "Nanim*"      = plain data types (enums/structs): FNanimAction, FNanimVariant,
//                     FNanimPickContext, FNanimActionPulse, ENanimCategory, etc.
//   * "Nanimation*" = higher-level UObjects/API surfaces that operate on that
//                     data: UNanimationSet, UNanimationComponent, UNanimationLibrary,
//                     FAnimNode_NanimSelect (the "Nanimation" module itself).
//   The shorter "Nanim" prefix on data types keeps USTRUCT/UENUM identifiers (and
//   their serialized tag names) compact across large data assets; it is a
//   deliberate two-tier vocabulary, not an accidental double-prefix.

#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"
#include "UObject/SoftObjectPtr.h"          // TSoftObjectPtr<UAnimSequenceBase>
class UAnimSequenceBase;                     // forward decl (TSoftObjectPtr only needs ptr)

#include "NanimationTypes.generated.h"      // MUST be last include.

/**
 * ENanimCategory
 * --------------
 * The NORMALIZED action vocabulary. The token parser (editor-side scanner, NOT
 * part of these runtime files) maps a raw <Action> token from an asset name onto
 * exactly one of these. Locomotion AND one-shots share the same enum because v1
 * scope is "a generic scanner" -- the system never special-cases a category, it
 * just groups variants under whichever category the parser resolved.
 *
 * uint8 underlying type so it is a cheap, blittable TMap key (see UNanimationSet)
 * and trivially network-friendly if ever needed (we replicate seeds, not this).
 */
UENUM(BlueprintType)
enum class ENanimCategory : uint8
{
	Idle    UMETA(DisplayName = "Idle"),
	Walk    UMETA(DisplayName = "Walk"),
	Jog     UMETA(DisplayName = "Jog"),
	Run     UMETA(DisplayName = "Run"),
	Sprint  UMETA(DisplayName = "Sprint"),
	Crouch  UMETA(DisplayName = "Crouch"),
	Jump    UMETA(DisplayName = "Jump"),
	Fall    UMETA(DisplayName = "Fall"),
	Land    UMETA(DisplayName = "Land"),
	Slide   UMETA(DisplayName = "Slide"),
	Roll    UMETA(DisplayName = "Roll"),
	Turn    UMETA(DisplayName = "Turn"),
	Pivot   UMETA(DisplayName = "Pivot"),
	Start   UMETA(DisplayName = "Start"),
	Stop    UMETA(DisplayName = "Stop"),
	Mantle  UMETA(DisplayName = "Mantle"),
	Vault   UMETA(DisplayName = "Vault"),
	Climb   UMETA(DisplayName = "Climb"),
	Aim     UMETA(DisplayName = "Aim"),
	Fire    UMETA(DisplayName = "Fire"),
	Reload  UMETA(DisplayName = "Reload"),
	Attack  UMETA(DisplayName = "Attack"),
	Hit     UMETA(DisplayName = "Hit"),
	Death   UMETA(DisplayName = "Death"),
	Emote   UMETA(DisplayName = "Emote"),

	// Sentinel: iteration bound AND canonical "invalid / no pending action".
	MAX     UMETA(Hidden)
};

/**
 * ENanimDirection
 * ---------------
 * Sub-axis parsed from the <Dir> token (Fwd/Bwd/Left/Right). "None" is the
 * non-directional default used by one-shots (e.g. a Reload has no facing).
 */
UENUM(BlueprintType)
enum class ENanimDirection : uint8
{
	None   UMETA(DisplayName = "None"),
	Fwd    UMETA(DisplayName = "Forward"),
	Bwd    UMETA(DisplayName = "Backward"),
	Left   UMETA(DisplayName = "Left"),
	Right  UMETA(DisplayName = "Right")
};

/**
 * ENanimStance
 * ------------
 * Sub-axis parsed from the <Stance> token. Mirrors GASP-style naming
 * (Neutral / Crouch / ADS). "None" = stance-agnostic.
 */
UENUM(BlueprintType)
enum class ENanimStance : uint8
{
	None     UMETA(DisplayName = "None"),
	Neutral  UMETA(DisplayName = "Neutral"),
	Crouch   UMETA(DisplayName = "Crouch"),
	ADS      UMETA(DisplayName = "ADS")
};

/**
 * ENanimPolicy
 * ------------
 * How a single FNanimAction chooses among its variants. ALL policies are
 * evaluated as PURE functions of (FRandomStream state, bag state) so that two
 * machines replaying the same (seed, draw-count) pick the same variant -- this is
 * the backbone of the seed-replication network model.
 *
 *   Uniform          : flat random pick (RandRange).
 *   Weighted         : pick proportional to FNanimVariant::Weight.
 *   NoImmediateRepeat: like Uniform/Weighted but never returns LastIndex twice.
 *   ShuffleBag       : draw without replacement from a shuffled bag, refill when
 *                      empty (default policy -- best perceived randomness).
 */
UENUM(BlueprintType)
enum class ENanimPolicy : uint8
{
	Uniform           UMETA(DisplayName = "Uniform"),
	Weighted          UMETA(DisplayName = "Weighted"),
	NoImmediateRepeat UMETA(DisplayName = "No Immediate Repeat"),
	ShuffleBag        UMETA(DisplayName = "Shuffle Bag")
};

/**
 * ENanimNetMode
 * -------------
 * Per-category routing flag (LOCKED decision: HYBRID networking).
 *   Replicated   : gameplay-relevant; the chosen variant must agree across the
 *                  network. We replicate ONLY a tiny pulse (base seed + draw
 *                  counter + category, see FNanimActionPulse) and re-derive the
 *                  pick locally as a PURE function. NEVER replicate the asset or
 *                  an index by RPC.
 *   LocalCosmetic: cosmetic flourish (idle-breaks); each client picks its own
 *                  using a LOCAL stateful bag, no replication, no bandwidth.
 */
UENUM(BlueprintType)
enum class ENanimNetMode : uint8
{
	Replicated    UMETA(DisplayName = "Replicated (seed-synced)"),
	LocalCosmetic UMETA(DisplayName = "Local Cosmetic")
};

/**
 * FNanimVariant
 * -------------
 * One concrete animation choice inside an action group.
 *
 * WHY TSoftObjectPtr: per LOCKED decision, big volumes (GASP ~1828 seqs) must
 * not be hard-referenced or they all cook+load resident. Soft refs let the
 * Component/Library async-resolve only the variant that was actually picked.
 * (Hot, small sets can still be assigned and will simply resolve instantly.)
 */
USTRUCT(BlueprintType)
struct NANIMATION_API FNanimVariant
{
	GENERATED_BODY()

	/** The animation (sequence or montage-source) for this variant. Soft so huge
	 *  libraries stay off-resident until picked & async-loaded. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Nanimation|Variant")
	TSoftObjectPtr<UAnimSequenceBase> Animation;

	/** Relative weight for Weighted / ShuffleBag. Values <= 0 are treated as
	 *  "never pick" by the library; if ALL variants are zero-weight, every policy
	 *  degrades to a Uniform fallback (documented in NanimationLibrary.h). Default
	 *  1 = equal odds. MUST be identical bits on every machine (it comes from the
	 *  same cooked asset and is never computed at runtime) or replicated picks
	 *  could diverge. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Nanimation|Variant", meta = (ClampMin = "0.0"))
	float Weight = 1.0f;

	/** Direction sub-axis this variant satisfies (filter key for locomotion). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Nanimation|Variant")
	ENanimDirection Dir = ENanimDirection::None;

	/** Stance sub-axis this variant satisfies (filter key for stance blends). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Nanimation|Variant")
	ENanimStance Stance = ENanimStance::None;
};

/**
 * FNanimAction
 * ------------
 * A group of interchangeable variants for ONE category, plus the policy used to
 * pick among them and the network routing for that category. This is the unit
 * the picker operates on and the unit the AnimNode embeds.
 */
USTRUCT(BlueprintType)
struct NANIMATION_API FNanimAction
{
	GENERATED_BODY()

	/** All interchangeable takes for this action (built by the scanner). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Nanimation|Action")
	TArray<FNanimVariant> Variants;

	/** Selection policy. ShuffleBag is the project default (best feel). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Nanimation|Action")
	ENanimPolicy Policy = ENanimPolicy::ShuffleBag;

	/** Replicated (seed-synced) vs LocalCosmetic. Drives Component routing. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Nanimation|Action")
	ENanimNetMode NetMode = ENanimNetMode::Replicated;

	/** Convenience: is this group usable at all? */
	bool IsValid() const { return Variants.Num() > 0; }
};

/**
 * Seed rebase threshold: when DrawCount reaches this value on the authority,
 * a new base seed is computed (HashCombine of current seed and counter) and
 * DrawCount resets to 1. This keeps the O(DrawCount) replay bounded and
 * prevents the 100k draw cap from ever being hit in normal play.
 * MaxDeterministicReplay in NanimationLibrary.h remains as an absolute safety
 * ceiling, unreachable after rebase is active.
 */
namespace NanimationConstants
{
	constexpr int32 RebaseThreshold = 1024;
}

/**
 * FNanimPickContext
 * -----------------
 * Optional filter axes passed to the picker. Dir/Stance = None means "don't
 * filter on this axis". The filter is applied BEFORE the policy picks, so the
 * subset is deterministic (derived from array order).
 */
USTRUCT(BlueprintType)
struct NANIMATION_API FNanimPickContext
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Nanimation|Context")
	ENanimDirection Dir = ENanimDirection::None;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Nanimation|Context")
	ENanimStance Stance = ENanimStance::None;

	bool IsActive() const { return Dir != ENanimDirection::None || Stance != ENanimStance::None; }
};

/**
 * FNanimActionPulse
 * -----------------
 * The ENTIRE network payload for a Replicated-category pick (~20 bytes). It is
 * replicated ATOMICALLY (one property, one RepNotify) so the category and the
 * draw context can never arrive split across bunches.
 *
 * Per-category coalescing: within a single category, multiple advances in one
 * net-update window coalesce harmlessly (latest DrawCount replays to the same
 * index). Across different categories, the component now maintains a
 * TArray<FNanimActionPulse> to avoid cross-category event loss.
 *
 * WHY (Seed + DrawCount) and not a single seed:
 *   A bare replicated int32 seed is STATE, not an event queue -- if the server
 *   advances it several times inside one net-update window the intermediate
 *   values coalesce and only the latest arrives. If the local pick depended on a
 *   persistent per-machine bag advanced once-per-arrival, clients would advance
 *   their bag fewer times than the server and desync. Replicating a monotonic
 *   DrawCount alongside a STABLE base Seed makes the pick a PURE function:
 *   "replay DrawCount deterministic draws from FRandomStream(Seed)". Coalescing
 *   is harmless (replay lands on the same index), late-joiners just replay from 0,
 *   and ShuffleBag's exhaust-before-repeat feel is preserved exactly.
 *
 * Seed rebase: when DrawCount reaches NanimationConstants::RebaseThreshold,
 * the authority recomputes its CURRENT base seed via HashCombine(Seed, DrawCount)
 * and resets DrawCount to 1. The rebased seed IS the one placed into the next
 * pulse (NanimationComponent::CurrentBaseSeeds tracks it per category on the
 * authority) — the sequence of variants therefore genuinely changes after a
 * rebase instead of looping back to the pre-rebase sequence.
 */
USTRUCT()
struct NANIMATION_API FNanimActionPulse
{
	GENERATED_BODY()

	/** Stable base seed for the category's deterministic draw sequence. */
	UPROPERTY()
	int32 Seed = 0;

	/** Monotonically increasing number of draws performed for this category. The
	 *  current pick is the result of the DrawCount-th draw. 0 = no action yet.
	 *  Also guarantees the property changes every action so the RepNotify fires. */
	UPROPERTY()
	int32 DrawCount = 0;

	/** Which category this pulse selects for. Valid only when DrawCount > 0. */
	UPROPERTY()
	ENanimCategory Category = ENanimCategory::MAX;

	/** Direction context (filter axis for locomotion picks). */
	UPROPERTY()
	ENanimDirection Dir = ENanimDirection::None;

	/** Stance context (filter axis for stance picks). */
	UPROPERTY()
	ENanimStance Stance = ENanimStance::None;
};
