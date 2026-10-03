// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimationEditorSettings.h
// ===========================
// UDeveloperSettings for the Nanimation editor module. Configure default scan
// paths, output paths, and extra token synonyms from Project Settings.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DeveloperSettings.h"
#include "NanimationTypes.h"
#include "NanimationEditorSettings.generated.h"

UCLASS(config = Editor, defaultconfig, meta = (DisplayName = "Nanimation"))
class NANIMATIONEDITOR_API UNanimationEditorSettings : public UDeveloperSettings
{
	GENERATED_BODY()

public:
	/** Default content path to scan for animation assets. */
	UPROPERTY(config, EditAnywhere, Category = "Scanner", meta = (ContentDir, LongPackageName))
	FString DefaultScanPath = TEXT("/Game");

	/** Default output path for generated UNanimationSet assets. */
	UPROPERTY(config, EditAnywhere, Category = "Scanner", meta = (ContentDir, LongPackageName))
	FString DefaultOutputPath = TEXT("/Game/Nanimation");

	/** Default asset name for generated sets. */
	UPROPERTY(config, EditAnywhere, Category = "Scanner")
	FString DefaultSetName = TEXT("DA_Nanim_Default");

	/** Extra category token synonyms (e.g. "swim" -> Idle). Consulted by
	 *  FNanimScanner::MatchCategory AFTER the built-in token table, keyed by
	 *  lowercase token. Actually wired — see NanimScanner.cpp. */
	UPROPERTY(config, EditAnywhere, Category = "Tokens")
	TMap<FString, ENanimCategory> ExtraCategoryTokens;

	/** Extra direction token synonyms. Consulted by FNanimScanner::MatchDirection
	 *  AFTER the built-in token table, keyed by lowercase token. */
	UPROPERTY(config, EditAnywhere, Category = "Tokens")
	TMap<FString, ENanimDirection> ExtraDirectionTokens;

	/** Extra stance token synonyms. Consulted by FNanimScanner::MatchStance AFTER
	 *  the built-in token table, keyed by lowercase token. */
	UPROPERTY(config, EditAnywhere, Category = "Tokens")
	TMap<FString, ENanimStance> ExtraStanceTokens;

	//~ UDeveloperSettings
	virtual FName GetCategoryName() const override { return TEXT("Plugins"); }
	virtual FName GetSectionName() const override { return TEXT("Nanimation"); }
#if WITH_EDITOR
	virtual FText GetSectionText() const override { return NSLOCTEXT("NanimationSettings", "SectionText", "Nanimation"); }
	virtual FText GetSectionDescription() const override { return NSLOCTEXT("NanimationSettings", "SectionDesc", "Configure the Nanimation animation-variant scanner defaults."); }
#endif
};
