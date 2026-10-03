// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimationComponent.cpp

#include "NanimationComponent.h"
#include "NanimationSet.h"
#include "NanimationLibrary.h"
#include "NanimationLog.h"
#include "Net/UnrealNetwork.h"
#include "Engine/AssetManager.h"
#include "Engine/StreamableManager.h"
#include "Misc/Guid.h"

UNanimationComponent::UNanimationComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
	SetIsReplicatedByDefault(true);
}

void UNanimationComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);

	// ActiveSet is now replicated so late-joiners get the current set.
	DOREPLIFETIME(UNanimationComponent, ActiveSet);

	// Pulse array: one entry per category, REPNOTIFY_Always so every change fires.
	FDoRepLifetimeParams PulseParams;
	PulseParams.RepNotifyCondition = REPNOTIFY_Always;
	DOREPLIFETIME_WITH_PARAMS(UNanimationComponent, ActionPulses, PulseParams);
}

void UNanimationComponent::BeginPlay()
{
	Super::BeginPlay();

	if (GetOwnerRole() == ROLE_Authority)
	{
		GlobalSeed = static_cast<int32>(GetTypeHash(FGuid::NewGuid()));
	}

	const uint32 LocalSeed = GetUniqueID() ^ static_cast<uint32>(reinterpret_cast<UPTRINT>(this));
	LocalCosmeticStream.Initialize(static_cast<int32>(LocalSeed));
}

void UNanimationComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	CancelAllAsyncLoads();
	Super::EndPlay(EndPlayReason);
}

void UNanimationComponent::CancelAllAsyncLoads()
{
	for (auto& Pair : ActiveLoadHandles)
	{
		if (Pair.Value.IsValid())
		{
			Pair.Value->CancelHandle();
			Pair.Value.Reset();
		}
	}
	ActiveLoadHandles.Empty();
}

int32 UNanimationComponent::ComputeBaseSeed(ENanimCategory Category) const
{
	return static_cast<int32>(HashCombine(static_cast<uint32>(GlobalSeed), static_cast<uint32>(static_cast<uint8>(Category))));
}

// ---------------------------------------------------------------------------
// SetActiveSet — authority-side setter with state reset
// ---------------------------------------------------------------------------
void UNanimationComponent::SetActiveSet(UNanimationSet* NewSet)
{
	if (GetOwnerRole() != ROLE_Authority)
	{
		UE_LOG(LogNanimation, Warning, TEXT("SetActiveSet: called on non-authority (ignored). Only the server can change the active set."));
		return;
	}

	ActiveSet = NewSet;

	// Changing the set invalidates all draw counters (variant arrays differ) AND
	// the current base seeds (a new set is a brand-new draw universe — reusing a
	// rebased seed from the previous set would be an arbitrary, meaningless value
	// here).
	DrawCounts.Empty();
	CurrentBaseSeeds.Empty();
	ActionPulses.Empty();

	if (NewSet)
	{
		UE_LOG(LogNanimation, Verbose, TEXT("SetActiveSet: changed to '%s' (draw state reset)."), *NewSet->GetName());
	}
	else
	{
		UE_LOG(LogNanimation, Warning, TEXT("SetActiveSet: set to nullptr."));
	}
}

// ---------------------------------------------------------------------------
// RequestAction / RequestActionWithContext
// ---------------------------------------------------------------------------
void UNanimationComponent::RequestAction(ENanimCategory Category)
{
	RequestActionWithContext(Category, ENanimDirection::None, ENanimStance::None);
}

void UNanimationComponent::RequestActionWithContext(ENanimCategory Category, ENanimDirection Dir, ENanimStance Stance)
{
	if (!ActiveSet)
	{
		UE_LOG(LogNanimation, Warning, TEXT("RequestAction: ActiveSet is null (category=%d). Assign a UNanimationSet to the component."),
			static_cast<int32>(Category));
		return;
	}

	const FNanimAction* Action = ActiveSet->FindAction(Category);
	if (!Action || !Action->IsValid())
	{
		UE_LOG(LogNanimation, Verbose, TEXT("RequestAction: category %d absent or empty in set '%s'."),
			static_cast<int32>(Category), *ActiveSet->GetName());
		return;
	}

	if (Action->NetMode == ENanimNetMode::LocalCosmetic)
	{
		PlayLocalCosmetic(Category);
		return;
	}

	// --- Replicated route ---
	if (GetOwnerRole() == ROLE_Authority)
	{
		FNanimPickContext Ctx;
		Ctx.Dir = Dir;
		Ctx.Stance = Stance;
		AdvancePulseForCategory(Category, Ctx);
	}
	else if (GetOwnerRole() == ROLE_AutonomousProxy)
	{
		ServerRequestAction(Category, Dir, Stance);
	}
	else
	{
		UE_LOG(LogNanimation, Warning,
			TEXT("RequestAction ignored: component owner is not locally controlled (Role=%d, Category=%d). Only AutonomousProxy or Authority may trigger actions."),
			static_cast<int32>(GetOwnerRole()), static_cast<int32>(Category));
	}
}

void UNanimationComponent::AdvancePulseForCategory(ENanimCategory Category, const FNanimPickContext& Ctx)
{
	const FNanimAction* Action = ActiveSet ? ActiveSet->FindAction(Category) : nullptr;
	if (!Action || !Action->IsValid())
	{
		return;
	}

	int32& Count = DrawCounts.FindOrAdd(Category); // default 0 -> first increment gives 1

	// The authority's CURRENT base seed for this category. Lazily initialised to
	// ComputeBaseSeed(Category) on first use, then rebased in place every time
	// the threshold is crossed. This is the seed that actually goes into the
	// pulse — ComputeBaseSeed() is never read again after the first draw.
	int32* ExistingBaseSeed = CurrentBaseSeeds.Find(Category);
	int32& BaseSeed = ExistingBaseSeed ? *ExistingBaseSeed : CurrentBaseSeeds.Add(Category, ComputeBaseSeed(Category));

	// --- Seed rebase: keep O(DrawCount) replay bounded ---
	if (Count >= NanimationConstants::RebaseThreshold)
	{
		const int32 OldSeed = BaseSeed;
		const int32 NewSeed = static_cast<int32>(HashCombine(static_cast<uint32>(OldSeed), static_cast<uint32>(Count)));
		BaseSeed = NewSeed; // Actually applied — the pulse below uses BaseSeed, not ComputeBaseSeed().
		Count = 0; // will become 1 below
		UE_LOG(LogNanimation, Verbose, TEXT("Seed rebase: category %d reached %d draws, base seed %d -> %d."),
			static_cast<int32>(Category), NanimationConstants::RebaseThreshold, OldSeed, NewSeed);
	}

	++Count;

	FNanimActionPulse Pulse;
	Pulse.Seed      = BaseSeed;
	Pulse.DrawCount = Count;
	Pulse.Category  = Category;
	Pulse.Dir       = Ctx.Dir;
	Pulse.Stance    = Ctx.Stance;

	// Upsert the pulse for this category (one entry per category).
	bool bFound = false;
	for (FNanimActionPulse& Existing : ActionPulses)
	{
		if (Existing.Category == Category)
		{
			Existing = Pulse;
			bFound = true;
			break;
		}
	}
	if (!bFound)
	{
		ActionPulses.Add(Pulse);
	}

	// --- Authority-local delivery ---
	// The authority (standalone / listen server / dedicated server) is NEVER a
	// late-joiner: it just produced this pulse itself, so the late-joiner
	// suppression logic in OnRep_ActionPulses (bFirstPulseReceived) must not
	// apply to it. Deliver directly instead of routing through the RepNotify
	// path, which would incorrectly swallow the very first action of the
	// session on the authority (see P4 / N3).
	LastSeenDrawCount.Add(Category, Pulse.DrawCount);
	const int32 Index = UNanimationLibrary::PickIndexDeterministic(*Action, Pulse.Seed, Pulse.DrawCount, Ctx);
	UE_LOG(LogNanimation, Verbose, TEXT("AdvancePulseForCategory (authority): category %d -> variant %d (Seed=%d, DrawCount=%d)."),
		static_cast<int32>(Category), Index, Pulse.Seed, Pulse.DrawCount);
	ResolveIndexAndBroadcast(Category, Index);
}

// ---------------------------------------------------------------------------
// Server RPC
// ---------------------------------------------------------------------------
bool UNanimationComponent::ServerRequestAction_Validate(ENanimCategory Category, ENanimDirection Dir, ENanimStance Stance)
{
	// Category: MAX is a reflected enum value (sentinel "no category") but must
	// never be accepted as a real request target, so it is excluded explicitly
	// in addition to the general enum-value validity check.
	return Category != ENanimCategory::MAX
		&& StaticEnum<ENanimCategory>()->IsValidEnumValue(static_cast<int64>(Category))
		&& StaticEnum<ENanimDirection>()->IsValidEnumValue(static_cast<int64>(Dir))
		&& StaticEnum<ENanimStance>()->IsValidEnumValue(static_cast<int64>(Stance));
}

void UNanimationComponent::ServerRequestAction_Implementation(ENanimCategory Category, ENanimDirection Dir, ENanimStance Stance)
{
	// Minimal anti-spam: at most one accepted request per category per tick.
	// A client hammering the RPC for the same category within the same frame
	// gets dropped silently (Verbose log only) instead of advancing the pulse
	// multiple times per tick.
	const UWorld* World = GetWorld();
	const float Now = World ? World->GetTimeSeconds() : 0.0f;
	float* LastTime = LastAcceptedServerRequestTime.Find(Category);
	if (LastTime && World && FMath::IsNearlyEqual(*LastTime, Now, KINDA_SMALL_NUMBER))
	{
		UE_LOG(LogNanimation, Verbose, TEXT("ServerRequestAction: rate-limited (category=%d already accepted this tick)."),
			static_cast<int32>(Category));
		return;
	}
	LastAcceptedServerRequestTime.Add(Category, Now);

	RequestActionWithContext(Category, Dir, Stance);
}

// ---------------------------------------------------------------------------
// OnRep_ActionPulses — per-category delta detection
// ---------------------------------------------------------------------------
void UNanimationComponent::OnRep_ActionPulses()
{
	if (!ActiveSet)
	{
		UE_LOG(LogNanimation, Warning, TEXT("OnRep_ActionPulses: ActiveSet is null — a pulse arrived but no set is assigned on this client. Assign the same UNanimationSet as the server."));
		return;
	}

	for (const FNanimActionPulse& Pulse : ActionPulses)
	{
		if (Pulse.DrawCount <= 0 || Pulse.Category >= ENanimCategory::MAX)
		{
			continue;
		}

		const int32* PrevPtr = LastSeenDrawCount.Find(Pulse.Category);
		const int32  PrevCount = PrevPtr ? *PrevPtr : 0;

		if (Pulse.DrawCount == PrevCount)
		{
			continue; // No change for this category — skip re-derivation.
		}

		LastSeenDrawCount.Add(Pulse.Category, Pulse.DrawCount);

		if (!bFirstPulseReceived)
		{
			// First batch: record the counters but DON'T broadcast.
			// Late-joiners should not replay minutes-old one-shots.
			UE_LOG(LogNanimation, Verbose, TEXT("OnRep_ActionPulses: initial sync for category %d (DrawCount=%d) — suppressed broadcast."),
				static_cast<int32>(Pulse.Category), Pulse.DrawCount);
			continue;
		}

		const FNanimAction* Action = ActiveSet->FindAction(Pulse.Category);
		if (!Action || !Action->IsValid())
		{
			UE_LOG(LogNanimation, Verbose, TEXT("OnRep_ActionPulses: category %d absent or empty."),
				static_cast<int32>(Pulse.Category));
			continue;
		}

		FNanimPickContext Ctx;
		Ctx.Dir = Pulse.Dir;
		Ctx.Stance = Pulse.Stance;

		const int32 Index = UNanimationLibrary::PickIndexDeterministic(*Action, Pulse.Seed, Pulse.DrawCount, Ctx);
		UE_LOG(LogNanimation, Verbose, TEXT("OnRep_ActionPulses: category %d -> variant %d (Seed=%d, DrawCount=%d)."),
			static_cast<int32>(Pulse.Category), Index, Pulse.Seed, Pulse.DrawCount);

		ResolveIndexAndBroadcast(Pulse.Category, Index);
	}

	bFirstPulseReceived = true;
}

// ---------------------------------------------------------------------------
// OnRep_ActiveSet
// ---------------------------------------------------------------------------
void UNanimationComponent::OnRep_ActiveSet()
{
	UE_LOG(LogNanimation, Verbose, TEXT("OnRep_ActiveSet: set changed to '%s'."),
		ActiveSet ? *ActiveSet->GetName() : TEXT("nullptr"));

	// Do NOT reset bFirstPulseReceived here. That flag exists ONLY to suppress
	// replay of stale pulses on the very first replication a client ever
	// receives (true late-join). A set change mid-session is a normal event
	// that must still broadcast the next action — resetting the flag here was
	// the root cause of every post-SetActiveSet action being silently dropped
	// (see P4 / N3).
	//
	// Changing sets DOES invalidate variant indices (different variant arrays),
	// but the pulses' DrawCounts are still "already seen" — silently resync
	// LastSeenDrawCount to the CURRENT ActionPulses values (no broadcast) so
	// that the NEXT genuine advance (DrawCount change) is what triggers
	// re-derivation, exactly like the steady-state per-category delta check.
	LastSeenDrawCount.Empty();
	for (const FNanimActionPulse& Pulse : ActionPulses)
	{
		if (Pulse.DrawCount > 0 && Pulse.Category < ENanimCategory::MAX)
		{
			LastSeenDrawCount.Add(Pulse.Category, Pulse.DrawCount);
		}
	}
}

// ---------------------------------------------------------------------------
// PlayLocalCosmetic
// ---------------------------------------------------------------------------
void UNanimationComponent::PlayLocalCosmetic(ENanimCategory Category)
{
	if (!ActiveSet)
	{
		UE_LOG(LogNanimation, Warning, TEXT("PlayLocalCosmetic: ActiveSet is null (category=%d)."),
			static_cast<int32>(Category));
		return;
	}

	const FNanimAction* Action = ActiveSet->FindAction(Category);
	if (!Action || !Action->IsValid())
	{
		UE_LOG(LogNanimation, Verbose, TEXT("PlayLocalCosmetic: category %d absent or empty."),
			static_cast<int32>(Category));
		return;
	}

	TArray<int32>& Bag = LocalBags.FindOrAdd(Category);
	const int32* LastPtr = LocalLastIndex.Find(Category);
	const int32 Last = LastPtr ? *LastPtr : INDEX_NONE;

	const int32 Index = UNanimationLibrary::PickVariantIndex(*Action, LocalCosmeticStream, Last, Bag);
	if (!Action->Variants.IsValidIndex(Index))
	{
		return;
	}
	LocalLastIndex.Add(Category, Index);

	ResolveIndexAndBroadcast(Category, Index);
}

// ---------------------------------------------------------------------------
// ResolveIndexAndBroadcast — per-category async load
// ---------------------------------------------------------------------------
void UNanimationComponent::ResolveIndexAndBroadcast(ENanimCategory Category, int32 Index)
{
	const FNanimAction* Action = ActiveSet ? ActiveSet->FindAction(Category) : nullptr;
	if (!Action || !Action->Variants.IsValidIndex(Index))
	{
		UE_LOG(LogNanimation, Warning, TEXT("ResolveIndexAndBroadcast: invalid index %d for category %d."),
			Index, static_cast<int32>(Category));
		return;
	}

	const FNanimVariant& Picked = Action->Variants[Index];
	if (Picked.Animation.IsNull())
	{
		UE_LOG(LogNanimation, Warning, TEXT("ResolveIndexAndBroadcast: picked variant index %d has null animation (category %d)."),
			Index, static_cast<int32>(Category));
		return;
	}

	// Already resident → broadcast immediately.
	if (Picked.Animation.IsValid())
	{
		OnVariantChosen.Broadcast(Category, Picked);
		return;
	}

	// Async load with PER-CATEGORY handle (cancels only previous load of THIS category).
	FStreamableManager& Streamable = UAssetManager::GetStreamableManager();
	const FSoftObjectPath Path = Picked.Animation.ToSoftObjectPath();

	// Cancel any in-flight load for this category.
	TSharedPtr<FStreamableHandle>* PrevHandle = ActiveLoadHandles.Find(Category);
	if (PrevHandle && PrevHandle->IsValid())
	{
		(*PrevHandle)->CancelHandle();
		PrevHandle->Reset();
	}

	TWeakObjectPtr<UNanimationComponent> WeakThis(this);
	FNanimVariant PickedCopy = Picked;

	TSharedPtr<FStreamableHandle> NewHandle = Streamable.RequestAsyncLoad(
		Path,
		FStreamableDelegate::CreateLambda([WeakThis, Category, PickedCopy]()
		{
			if (UNanimationComponent* Self = WeakThis.Get())
			{
				Self->OnVariantChosen.Broadcast(Category, PickedCopy);
			}
		}));

	ActiveLoadHandles.Add(Category, NewHandle);
}
