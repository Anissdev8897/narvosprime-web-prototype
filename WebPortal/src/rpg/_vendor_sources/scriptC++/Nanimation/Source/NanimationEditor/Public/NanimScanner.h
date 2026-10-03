// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimScanner.h
// ==============
// EDITOR-ONLY tooling: scans the AssetRegistry for animation assets, classifies
// each by the project naming convention via a pure TOKEN PARSER (no AI), and
// builds/populates UNanimationSet assets + a CSV inventory.
//
// Naming convention handled:
//   GASP Motion Matching : M[F]_<Stance>_<Action>_<Dir>_<Variant...>
//   Classic locomotion   : MF_<Weapon>_<Action>_<Dir>_<Variant...>

#pragma once

#include "CoreMinimal.h"
#include "NanimationTypes.h"

class UNanimationSet;

struct FNanimParsedName
{
	ENanimCategory Category = ENanimCategory::MAX;
	ENanimDirection Dir = ENanimDirection::None;
	ENanimStance Stance = ENanimStance::None;
	FString ActionToken;
	FString VariantKey;

	bool IsClassified() const { return Category != ENanimCategory::MAX; }
};

class NANIMATIONEDITOR_API FNanimScanner
{
public:
	struct FRow
	{
		FNanimParsedName Parsed;
		FSoftObjectPath  Path;
		FName            AssetName;
		FString          ClassName;
		bool             bIsSequenceBase = false;
	};

	// --- Parser (pure, unit-testable) ------------------------------------

	static FNanimParsedName ParseAssetName(const FString& AssetName);

	// --- Scan / export / generate ----------------------------------------

	static int32 ScanPath(const FString& PackagePath, TArray<FRow>& OutRows);

	static bool ExportCsv(const TArray<FRow>& Rows, const FString& CsvFilePath);

	/**
	 * Build a UNanimationSet from rows. If bOverwriteExisting=false (default),
	 * merges with an existing asset at the same path: preserves user-edited
	 * Policy/NetMode per category and Weight/Dir/Stance of existing variants.
	 * New variants are added alongside; missing variants are logged but kept.
	 */
	static UNanimationSet* GenerateSet(const TArray<FRow>& Rows, const FString& OutPackagePath, const FString& SetAssetName, bool bOverwriteExisting = false);

	/**
	 * Full pipeline: scan, optionally export CSV, generate set.
	 */
	static UNanimationSet* ScanFolderAndGenerate(const FString& SourcePath, const FString& OutPackagePath, const FString& SetAssetName, bool bExportCsv, bool bOverwriteExisting, FString* OutCsvPath = nullptr);

private:
	static ENanimCategory  MatchCategory(const FString& Token);
	static ENanimDirection MatchDirection(const FString& Token);
	static ENanimStance    MatchStance(const FString& Token);
};
