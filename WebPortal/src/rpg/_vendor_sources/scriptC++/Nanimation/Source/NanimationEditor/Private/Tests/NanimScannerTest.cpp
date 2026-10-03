// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimScannerTest.cpp
// Automation tests for the asset-name token parser.

#include "NanimScanner.h"
#include "NanimationEditorSettings.h"

#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FNanimScanner_ParseAssetName,
	"Nanimation.Scanner.ParseAssetName",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::SmokeFilter)

bool FNanimScanner_ParseAssetName::RunTest(const FString& Parameters)
{
	// Standard GASP patterns
	{
		const FNanimParsedName P = FNanimScanner::ParseAssetName(TEXT("M_Neutral_Slide_FootOut_Loop"));
		TestEqual(TEXT("M_Slide -> Slide"), P.Category, ENanimCategory::Slide);
		TestEqual(TEXT("M_Slide -> Neutral"), P.Stance, ENanimStance::Neutral);
		TestEqual(TEXT("M_Slide -> None dir"), P.Dir, ENanimDirection::None);
		TestTrue(TEXT("M_Slide -> classified"), P.IsClassified());
	}

	{
		const FNanimParsedName P = FNanimScanner::ParseAssetName(TEXT("MF_Pistol_Walk_Fwd_Left"));
		TestEqual(TEXT("MF_Walk -> Walk"), P.Category, ENanimCategory::Walk);
		TestEqual(TEXT("MF_Walk -> None stance"), P.Stance, ENanimStance::None);
		TestEqual(TEXT("MF_Walk -> Fwd"), P.Dir, ENanimDirection::Fwd);
	}

	{
		const FNanimParsedName P = FNanimScanner::ParseAssetName(TEXT("M_Crouch_Idle"));
		TestEqual(TEXT("M_Crouch_Idle -> Idle"), P.Category, ENanimCategory::Idle);
		TestEqual(TEXT("M_Crouch_Idle -> Crouch"), P.Stance, ENanimStance::Crouch);
	}

	{
		const FNanimParsedName P = FNanimScanner::ParseAssetName(TEXT("M_Crouch_Entry"));
		TestEqual(TEXT("M_Crouch_Entry -> Crouch"), P.Category, ENanimCategory::Crouch);
	}

	// Synonyms
	{
		const FNanimParsedName P = FNanimScanner::ParseAssetName(TEXT("M_Dodge_Fwd"));
		TestEqual(TEXT("dodge -> Roll"), P.Category, ENanimCategory::Roll);
	}

	{
		const FNanimParsedName P = FNanimScanner::ParseAssetName(TEXT("M_AO_Pistol"));
		TestEqual(TEXT("ao -> Aim"), P.Category, ENanimCategory::Aim);
	}

	// Unclassified
	{
		const FNanimParsedName P = FNanimScanner::ParseAssetName(TEXT("M_UnknownToken_Fwd"));
		TestEqual(TEXT("UnknownToken -> MAX"), P.Category, ENanimCategory::MAX);
		TestFalse(TEXT("UnknownToken -> not classified"), P.IsClassified());
	}

	// Short forms
	{
		const FNanimParsedName P = FNanimScanner::ParseAssetName(TEXT("M_Walk_F"));
		TestEqual(TEXT("F -> Fwd"), P.Dir, ENanimDirection::Fwd);
	}
	{
		const FNanimParsedName P = FNanimScanner::ParseAssetName(TEXT("M_Walk_B"));
		TestEqual(TEXT("B -> Bwd"), P.Dir, ENanimDirection::Bwd);
	}
	{
		const FNanimParsedName P = FNanimScanner::ParseAssetName(TEXT("M_Walk_L"));
		TestEqual(TEXT("L -> Left"), P.Dir, ENanimDirection::Left);
	}
	{
		const FNanimParsedName P = FNanimScanner::ParseAssetName(TEXT("M_Walk_R"));
		TestEqual(TEXT("R -> Right"), P.Dir, ENanimDirection::Right);
	}

	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FNanimScanner_ExtraCategoryTokenSetting,
	"Nanimation.Scanner.ExtraCategoryTokenSetting",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::SmokeFilter)

bool FNanimScanner_ExtraCategoryTokenSetting::RunTest(const FString& Parameters)
{
	// Without a synonym configured, an unrecognised token stays unclassified.
	{
		const FNanimParsedName P = FNanimScanner::ParseAssetName(TEXT("M_Swim_Fwd"));
		TestEqual(TEXT("swim (no synonym) -> MAX"), P.Category, ENanimCategory::MAX);
	}

	// Inject a synonym via the mutable default settings object, verify the
	// scanner picks it up, then clean up so other tests are unaffected.
	UNanimationEditorSettings* MutableSettings = GetMutableDefault<UNanimationEditorSettings>();
	if (!TestNotNull(TEXT("GetMutableDefault<UNanimationEditorSettings>()"), MutableSettings))
	{
		return false;
	}

	const bool bHadSwim = MutableSettings->ExtraCategoryTokens.Contains(TEXT("swim"));
	const ENanimCategory PreviousValue = bHadSwim ? MutableSettings->ExtraCategoryTokens[TEXT("swim")] : ENanimCategory::MAX;

	MutableSettings->ExtraCategoryTokens.Add(TEXT("swim"), ENanimCategory::Idle);

	{
		const FNanimParsedName P = FNanimScanner::ParseAssetName(TEXT("M_Swim_Fwd"));
		TestEqual(TEXT("swim (synonym -> Idle) -> Idle"), P.Category, ENanimCategory::Idle);
	}

	// Clean up: restore prior state so this test has no side effects on others.
	if (bHadSwim)
	{
		MutableSettings->ExtraCategoryTokens.Add(TEXT("swim"), PreviousValue);
	}
	else
	{
		MutableSettings->ExtraCategoryTokens.Remove(TEXT("swim"));
	}

	return true;
}
#endif // WITH_DEV_AUTOMATION_TESTS
