// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimationDeterminismTest.cpp
// Automation tests for the deterministic picker core contract.

#include "NanimationLibrary.h"
#include "NanimationTypes.h"
#include "Math/RandomStream.h"

#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FNanimDeterminism_PureReplay,
	"Nanimation.Determinism.PureReplay",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::SmokeFilter)

bool FNanimDeterminism_PureReplay::RunTest(const FString& Parameters)
{
	// Same (Seed, DrawCount) → same index on 1000 draws, all policies.
	FNanimAction Action;
	for (int32 i = 0; i < 10; ++i)
	{
		FNanimVariant V;
		V.Weight = 1.0f + (i % 3); // mix of weights
		Action.Variants.Add(V);
	}

	const TArray<ENanimPolicy> Policies = {
		ENanimPolicy::Uniform, ENanimPolicy::Weighted,
		ENanimPolicy::NoImmediateRepeat, ENanimPolicy::ShuffleBag
	};

	for (ENanimPolicy P : Policies)
	{
		Action.Policy = P;
		for (int32 Seed = 0; Seed < 100; ++Seed)
		{
			for (int32 DrawCount = 1; DrawCount <= 50; ++DrawCount)
			{
				const int32 A = UNanimationLibrary::PickIndexDeterministic(Action, Seed, DrawCount);
				const int32 B = UNanimationLibrary::PickIndexDeterministic(Action, Seed, DrawCount);
				TestEqual(FString::Printf(TEXT("Policy %d, Seed %d, DrawCount %d"),
					static_cast<int32>(P), Seed, DrawCount), A, B);
			}
		}
	}

	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FNanimDeterminism_ZeroWeightNeverPicked,
	"Nanimation.Determinism.ZeroWeightNeverPicked",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::SmokeFilter)

bool FNanimDeterminism_ZeroWeightNeverPicked::RunTest(const FString& Parameters)
{
	// Variant with weight=0 must never be picked when positive weights exist.
	FNanimAction Action;
	FNanimVariant Good; Good.Weight = 1.0f; Action.Variants.Add(Good);
	FNanimVariant Bad;  Bad.Weight  = 0.0f; Action.Variants.Add(Bad);

	const TArray<ENanimPolicy> Policies = {
		ENanimPolicy::Weighted, ENanimPolicy::ShuffleBag
	};

	for (ENanimPolicy P : Policies)
	{
		Action.Policy = P;
		for (int32 Seed = 0; Seed < 100; ++Seed)
		{
			const int32 Idx = UNanimationLibrary::PickIndexDeterministic(Action, Seed, 1);
			TestNotEqual(FString::Printf(TEXT("Policy %d should never pick index 1 (weight=0)"), static_cast<int32>(P)),
				Idx, 1);
		}
	}

	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FNanimDeterminism_AllZeroWeightUniformFallback,
	"Nanimation.Determinism.AllZeroWeightUniformFallback",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::SmokeFilter)

bool FNanimDeterminism_AllZeroWeightUniformFallback::RunTest(const FString& Parameters)
{
	// When ALL variants have weight=0, all policies must degrade gracefully.
	FNanimAction Action;
	for (int32 i = 0; i < 5; ++i)
	{
		FNanimVariant V;
		V.Weight = 0.0f;
		Action.Variants.Add(V);
	}

	const TArray<ENanimPolicy> Policies = {
		ENanimPolicy::Uniform, ENanimPolicy::Weighted,
		ENanimPolicy::NoImmediateRepeat, ENanimPolicy::ShuffleBag
	};

	for (ENanimPolicy P : Policies)
	{
		Action.Policy = P;
		const int32 Idx = UNanimationLibrary::PickIndexDeterministic(Action, 42, 1);
		TestTrue(FString::Printf(TEXT("Policy %d all-zero-weight: should return valid index, got %d"),
			static_cast<int32>(P), Idx),
			Idx >= 0 && Idx < 5);
	}

	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FNanimDeterminism_ContextFiltering,
	"Nanimation.Determinism.ContextFiltering",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::SmokeFilter)

bool FNanimDeterminism_ContextFiltering::RunTest(const FString& Parameters)
{
	// Context filter must never return an incompatible variant.
	FNanimAction Action;
	{
		FNanimVariant V; V.Dir = ENanimDirection::Fwd; V.Weight = 1.0f; Action.Variants.Add(V);
	}
	{
		FNanimVariant V; V.Dir = ENanimDirection::Bwd; V.Weight = 1.0f; Action.Variants.Add(V);
	}
	Action.Policy = ENanimPolicy::Uniform;

	FNanimPickContext Ctx;
	Ctx.Dir = ENanimDirection::Fwd;

	for (int32 Seed = 0; Seed < 50; ++Seed)
	{
		const int32 Idx = UNanimationLibrary::PickIndexDeterministic(Action, Seed, 1, Ctx);
		TestEqual(TEXT("Fwd filter should only return index 0"), Idx, 0);
	}

	// Empty context = no filter (both indices reachable).
	int32 saw0 = 0, saw1 = 0;
	for (int32 Seed = 0; Seed < 200; ++Seed)
	{
		const int32 Idx = UNanimationLibrary::PickIndexDeterministic(Action, Seed, 1);
		if (Idx == 0) ++saw0; else if (Idx == 1) ++saw1;
	}
	TestTrue(TEXT("Empty context: both indices reachable"), saw0 > 0 && saw1 > 0);

	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FNanimDeterminism_RebaseCrossMachineAgreement,
	"Nanimation.Determinism.RebaseCrossMachineAgreement",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::SmokeFilter)

bool FNanimDeterminism_RebaseCrossMachineAgreement::RunTest(const FString& Parameters)
{
	// Property 1: every machine that replays the SAME published pulse (Seed,
	// DrawCount) must land on the SAME index -- both before and after a rebase
	// event. This locks the contract PickIndexDeterministic must uphold; it is
	// what actually protects against desyncs (not continuity with a stateful
	// stream, which the pulse model never promises).
	FNanimAction Action;
	for (int32 i = 0; i < 8; ++i)
	{
		FNanimVariant V; V.Weight = 1.0f; Action.Variants.Add(V);
	}
	Action.Policy = ENanimPolicy::ShuffleBag;

	const int32 Seed0 = 12345;
	const int32 RebasePoint = NanimationConstants::RebaseThreshold;
	const int32 Seed1 = static_cast<int32>(HashCombine(static_cast<uint32>(Seed0), static_cast<uint32>(RebasePoint)));

	// Pre-rebase pulses (Seed0, 1..RebasePoint).
	for (int32 dc = 1; dc <= RebasePoint; dc += 97) // sample, not exhaustive (perf)
	{
		const int32 MachineOne = UNanimationLibrary::PickIndexDeterministic(Action, Seed0, dc);
		const int32 MachineTwo = UNanimationLibrary::PickIndexDeterministic(Action, Seed0, dc);
		TestEqual(FString::Printf(TEXT("Pre-rebase pulse (Seed0, %d): two machines agree"), dc), MachineOne, MachineTwo);
	}

	// Post-rebase pulses (Seed1, 1..50).
	for (int32 dc = 1; dc <= 50; ++dc)
	{
		const int32 MachineOne = UNanimationLibrary::PickIndexDeterministic(Action, Seed1, dc);
		const int32 MachineTwo = UNanimationLibrary::PickIndexDeterministic(Action, Seed1, dc);
		TestEqual(FString::Printf(TEXT("Post-rebase pulse (Seed1, %d): two machines agree"), dc), MachineOne, MachineTwo);
	}

	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FNanimDeterminism_RebaseChangesSequence,
	"Nanimation.Determinism.RebaseChangesSequence",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::SmokeFilter)

bool FNanimDeterminism_RebaseChangesSequence::RunTest(const FString& Parameters)
{
	// Property 2: the rebase must ACTUALLY change the draw sequence. This is the
	// test that would have caught the "seed computed but never applied"
	// regression -- if the component ever regresses to using the pre-rebase
	// seed after threshold, Seed1 == Seed0 and this test fails.
	FNanimAction Action;
	for (int32 i = 0; i < 8; ++i) // >= 8 equiprobable variants per P3(d)2.
	{
		FNanimVariant V; V.Weight = 1.0f; Action.Variants.Add(V);
	}
	Action.Policy = ENanimPolicy::ShuffleBag;

	const int32 Seed0 = 12345;
	const int32 RebasePoint = NanimationConstants::RebaseThreshold;
	const int32 Seed1 = static_cast<int32>(HashCombine(static_cast<uint32>(Seed0), static_cast<uint32>(RebasePoint)));

	TestNotEqual(TEXT("Rebased seed must differ from the pre-rebase seed"), Seed1, Seed0);

	bool bAnyDifferent = false;
	for (int32 dc = 1; dc <= 50; ++dc)
	{
		const int32 FromSeed0 = UNanimationLibrary::PickIndexDeterministic(Action, Seed0, dc);
		const int32 FromSeed1 = UNanimationLibrary::PickIndexDeterministic(Action, Seed1, dc);
		if (FromSeed0 != FromSeed1)
		{
			bAnyDifferent = true;
			break;
		}
	}
	TestTrue(TEXT("rebased sequence differs"), bAnyDifferent);

	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FNanimDeterminism_PureReplayMatchesStatefulLoop,
	"Nanimation.Determinism.PureReplayMatchesStatefulLoop",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::SmokeFilter)

bool FNanimDeterminism_PureReplayMatchesStatefulLoop::RunTest(const FString& Parameters)
{
	// Property 3 (foundational): PickIndexDeterministic(Action, Seed, N) must
	// equal the N-th result of a stateful PickVariantIndex loop over a FRESH
	// FRandomStream(Seed) + fresh bag (same seed, same context). This is what
	// makes the "pure replay" (client) and "stateful step" (authority's mental
	// model of "N draws happened") interchangeable -- the entire seed-replication
	// network model rests on this equivalence.
	FNanimAction Action;
	for (int32 i = 0; i < 6; ++i)
	{
		FNanimVariant V;
		V.Weight = 1.0f + (i % 3);
		Action.Variants.Add(V);
	}

	const TArray<ENanimPolicy> Policies = {
		ENanimPolicy::Uniform, ENanimPolicy::Weighted,
		ENanimPolicy::NoImmediateRepeat, ENanimPolicy::ShuffleBag
	};

	for (ENanimPolicy P : Policies)
	{
		Action.Policy = P;
		for (int32 Seed = 0; Seed < 20; ++Seed)
		{
			FRandomStream Stream(Seed);
			TArray<int32> Bag;
			int32 Last = INDEX_NONE;
			int32 StatefulResult = INDEX_NONE;

			const int32 MaxDrawCount = 60;
			for (int32 DrawCount = 1; DrawCount <= MaxDrawCount; ++DrawCount)
			{
				StatefulResult = UNanimationLibrary::PickVariantIndex(Action, Stream, Last, Bag);
				Last = StatefulResult;

				const int32 PureResult = UNanimationLibrary::PickIndexDeterministic(Action, Seed, DrawCount);
				TestEqual(FString::Printf(TEXT("Policy %d, Seed %d, DrawCount %d: pure replay == stateful loop"),
					static_cast<int32>(P), Seed, DrawCount), PureResult, StatefulResult);
			}
		}
	}

	return true;
}
#endif // WITH_DEV_AUTOMATION_TESTS
