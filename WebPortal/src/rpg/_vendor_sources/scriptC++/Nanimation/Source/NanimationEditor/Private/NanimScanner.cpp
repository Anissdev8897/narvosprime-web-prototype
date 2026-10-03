// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimScanner.cpp

#include "NanimScanner.h"
#include "NanimationSet.h"
#include "NanimationEditorLog.h"
#include "NanimationEditorSettings.h"

#include "AssetRegistry/AssetRegistryModule.h"
#include "AssetRegistry/IAssetRegistry.h"
#include "AssetRegistry/ARFilter.h"

#include "Animation/AnimSequenceBase.h"
#include "UObject/Package.h"
#include "UObject/SavePackage.h"
#include "Misc/PackageName.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"

// ---------------------------------------------------------------------------
// Token tables (lowercased, exact-token match).
// ---------------------------------------------------------------------------

ENanimCategory FNanimScanner::MatchCategory(const FString& TokenLower)
{
	static const TMap<FString, ENanimCategory> Map = {
		{ TEXT("idle"),    ENanimCategory::Idle },
		{ TEXT("walk"),    ENanimCategory::Walk },
		{ TEXT("walking"), ENanimCategory::Walk },
		{ TEXT("jog"),     ENanimCategory::Jog },
		{ TEXT("run"),     ENanimCategory::Run },
		{ TEXT("running"), ENanimCategory::Run },
		{ TEXT("sprint"),  ENanimCategory::Sprint },
		{ TEXT("jump"),    ENanimCategory::Jump },
		{ TEXT("fall"),    ENanimCategory::Fall },
		{ TEXT("falling"), ENanimCategory::Fall },
		{ TEXT("land"),    ENanimCategory::Land },
		{ TEXT("landing"), ENanimCategory::Land },
		{ TEXT("slide"),   ENanimCategory::Slide },
		{ TEXT("sliding"), ENanimCategory::Slide },
		{ TEXT("roll"),    ENanimCategory::Roll },
		{ TEXT("dodge"),   ENanimCategory::Roll },
		{ TEXT("turn"),    ENanimCategory::Turn },
		{ TEXT("turning"), ENanimCategory::Turn },
		{ TEXT("pivot"),   ENanimCategory::Pivot },
		{ TEXT("start"),   ENanimCategory::Start },
		{ TEXT("stop"),    ENanimCategory::Stop },
		{ TEXT("mantle"),  ENanimCategory::Mantle },
		{ TEXT("vault"),   ENanimCategory::Vault },
		{ TEXT("climb"),   ENanimCategory::Climb },
		{ TEXT("climbing"),ENanimCategory::Climb },
		{ TEXT("aim"),     ENanimCategory::Aim },
		{ TEXT("ao"),      ENanimCategory::Aim },
		{ TEXT("fire"),    ENanimCategory::Fire },
		{ TEXT("shoot"),   ENanimCategory::Fire },
		{ TEXT("reload"),  ENanimCategory::Reload },
		{ TEXT("attack"),  ENanimCategory::Attack },
		{ TEXT("melee"),   ENanimCategory::Attack },
		{ TEXT("hit"),     ENanimCategory::Hit },
		{ TEXT("hitreact"),ENanimCategory::Hit },
		{ TEXT("death"),   ENanimCategory::Death },
		{ TEXT("die"),     ENanimCategory::Death },
		{ TEXT("dead"),    ENanimCategory::Death },
		{ TEXT("emote"),   ENanimCategory::Emote },
		{ TEXT("dance"),   ENanimCategory::Emote },
	};
	const ENanimCategory* Found = Map.Find(TokenLower);
	if (Found)
	{
		return *Found;
	}

	// Fall back to user-configured synonyms from Project Settings → Plugins →
	// Nanimation (Tokens). Consulted only after the built-in table misses.
	if (const UNanimationEditorSettings* Settings = GetDefault<UNanimationEditorSettings>())
	{
		if (const ENanimCategory* ExtraFound = Settings->ExtraCategoryTokens.Find(TokenLower))
		{
			return *ExtraFound;
		}
	}

	return ENanimCategory::MAX;
}

ENanimDirection FNanimScanner::MatchDirection(const FString& TokenLower)
{
	static const TMap<FString, ENanimDirection> Map = {
		{ TEXT("fwd"),      ENanimDirection::Fwd },
		{ TEXT("forward"),  ENanimDirection::Fwd },
		{ TEXT("f"),        ENanimDirection::Fwd },
		{ TEXT("bwd"),      ENanimDirection::Bwd },
		{ TEXT("backward"), ENanimDirection::Bwd },
		{ TEXT("back"),     ENanimDirection::Bwd },
		{ TEXT("b"),        ENanimDirection::Bwd },
		{ TEXT("left"),     ENanimDirection::Left },
		{ TEXT("l"),        ENanimDirection::Left },
		{ TEXT("right"),    ENanimDirection::Right },
		{ TEXT("r"),        ENanimDirection::Right },
	};
	const ENanimDirection* Found = Map.Find(TokenLower);
	if (Found)
	{
		return *Found;
	}

	if (const UNanimationEditorSettings* Settings = GetDefault<UNanimationEditorSettings>())
	{
		if (const ENanimDirection* ExtraFound = Settings->ExtraDirectionTokens.Find(TokenLower))
		{
			return *ExtraFound;
		}
	}

	return ENanimDirection::None;
}

ENanimStance FNanimScanner::MatchStance(const FString& TokenLower)
{
	static const TMap<FString, ENanimStance> Map = {
		{ TEXT("neutral"),  ENanimStance::Neutral },
		{ TEXT("crouch"),   ENanimStance::Crouch },
		{ TEXT("crouching"),ENanimStance::Crouch },
		{ TEXT("ads"),      ENanimStance::ADS },
		{ TEXT("aiming"),   ENanimStance::ADS },
	};
	const ENanimStance* Found = Map.Find(TokenLower);
	if (Found)
	{
		return *Found;
	}

	if (const UNanimationEditorSettings* Settings = GetDefault<UNanimationEditorSettings>())
	{
		if (const ENanimStance* ExtraFound = Settings->ExtraStanceTokens.Find(TokenLower))
		{
			return *ExtraFound;
		}
	}

	return ENanimStance::None;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

FNanimParsedName FNanimScanner::ParseAssetName(const FString& AssetName)
{
	FNanimParsedName Out;

	TArray<FString> Tokens;
	AssetName.ParseIntoArray(Tokens, TEXT("_"), /*CullEmpty*/ true);
	if (Tokens.Num() == 0)
	{
		return Out;
	}

	int32 StartIdx = 0;
	{
		const FString& First = Tokens[0];
		const FString FirstLower = First.ToLower();
		const bool bLooksLikePrefix = First.Len() <= 2
			&& MatchCategory(FirstLower) == ENanimCategory::MAX
			&& MatchDirection(FirstLower) == ENanimDirection::None
			&& MatchStance(FirstLower) == ENanimStance::None;
		if (bLooksLikePrefix)
		{
			StartIdx = 1;
		}
	}

	TArray<FString> VariantTokens;
	for (int32 i = StartIdx; i < Tokens.Num(); ++i)
	{
		const FString& Tok = Tokens[i];
		const FString TokLower = Tok.ToLower();

		const ENanimStance S = MatchStance(TokLower);
		if (S != ENanimStance::None)
		{
			if (Out.Stance == ENanimStance::None)
			{
				Out.Stance = S;
			}
			continue;
		}

		const ENanimCategory C = MatchCategory(TokLower);
		if (C != ENanimCategory::MAX)
		{
			if (Out.Category == ENanimCategory::MAX)
			{
				Out.Category = C;
				Out.ActionToken = Tok;
				continue;
			}
			VariantTokens.Add(Tok);
			continue;
		}

		const ENanimDirection D = MatchDirection(TokLower);
		if (D != ENanimDirection::None)
		{
			if (Out.Dir == ENanimDirection::None)
			{
				Out.Dir = D;
				continue;
			}
		}

		VariantTokens.Add(Tok);
	}

	if (Out.Category == ENanimCategory::MAX && Out.Stance == ENanimStance::Crouch)
	{
		Out.Category = ENanimCategory::Crouch;
	}

	Out.VariantKey = FString::Join(VariantTokens, TEXT("_"));
	return Out;
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

int32 FNanimScanner::ScanPath(const FString& PackagePath, TArray<FRow>& OutRows)
{
	FAssetRegistryModule& ARModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>(TEXT("AssetRegistry"));
	IAssetRegistry& AR = ARModule.Get();

	AR.ScanPathsSynchronous({ PackagePath });

	auto QueryClass = [&](const TCHAR* ClassName, bool bSequenceBase)
	{
		FARFilter Filter;
		Filter.bRecursivePaths = true;
		Filter.bRecursiveClasses = true;
		Filter.PackagePaths.Add(FName(*PackagePath));
		Filter.ClassPaths.Add(FTopLevelAssetPath(TEXT("/Script/Engine"), ClassName));

		TArray<FAssetData> Assets;
		AR.GetAssets(Filter, Assets);

		for (const FAssetData& AD : Assets)
		{
			FRow Row;
			Row.AssetName       = AD.AssetName;
			Row.Path            = AD.GetSoftObjectPath();
			Row.ClassName       = AD.AssetClassPath.GetAssetName().ToString();
			Row.bIsSequenceBase = bSequenceBase;
			Row.Parsed          = ParseAssetName(AD.AssetName.ToString());
			OutRows.Add(MoveTemp(Row));
		}
	};

	QueryClass(TEXT("AnimSequenceBase"), /*bSequenceBase*/ true);
	QueryClass(TEXT("BlendSpace"), /*bSequenceBase*/ false);

	UE_LOG(LogNanimationEditor, Log, TEXT("Nanim scan '%s': %d assets."), *PackagePath, OutRows.Num());
	return OutRows.Num();
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

static FString EnumToString_Category(ENanimCategory V)
{
	return StaticEnum<ENanimCategory>()->GetNameStringByValue(static_cast<int64>(V));
}
static FString EnumToString_Direction(ENanimDirection V)
{
	return StaticEnum<ENanimDirection>()->GetNameStringByValue(static_cast<int64>(V));
}
static FString EnumToString_Stance(ENanimStance V)
{
	return StaticEnum<ENanimStance>()->GetNameStringByValue(static_cast<int64>(V));
}

bool FNanimScanner::ExportCsv(const TArray<FRow>& Rows, const FString& CsvFilePath)
{
	FString Csv = TEXT("Category,ActionToken,Direction,Stance,VariantKey,Class,Asset,Path\n");
	for (const FRow& Row : Rows)
	{
		Csv += FString::Printf(TEXT("%s,%s,%s,%s,%s,%s,%s,%s\n"),
			*EnumToString_Category(Row.Parsed.Category),
			*Row.Parsed.ActionToken,
			*EnumToString_Direction(Row.Parsed.Dir),
			*EnumToString_Stance(Row.Parsed.Stance),
			*Row.Parsed.VariantKey,
			*Row.ClassName,
			*Row.AssetName.ToString(),
			*Row.Path.ToString());
	}

	const bool bOk = FFileHelper::SaveStringToFile(Csv, *CsvFilePath);
	UE_LOG(LogNanimationEditor, Log, TEXT("Nanim CSV %s -> '%s' (%d rows)."),
		bOk ? TEXT("written") : TEXT("FAILED"), *CsvFilePath, Rows.Num());
	return bOk;
}

// ---------------------------------------------------------------------------
// Generate / save UNanimationSet (MERGE MODE)
// ---------------------------------------------------------------------------

UNanimationSet* FNanimScanner::GenerateSet(const TArray<FRow>& Rows, const FString& OutPackagePath, const FString& SetAssetName, bool bOverwriteExisting)
{
	const FString PackageName = OutPackagePath / SetAssetName;
	if (!FPackageName::IsValidLongPackageName(PackageName))
	{
		UE_LOG(LogNanimationEditor, Error, TEXT("Nanim: invalid package name '%s'."), *PackageName);
		return nullptr;
	}

	// --- Check for existing asset (merge mode) ---
	// IMPORTANT: if we are merging, we must REUSE the existing UObject instead of
	// calling NewObject with the same name in the same package. NewObject on an
	// already-allocated name/outer pair triggers StaticAllocateObject's
	// replace-in-place path: the existing object's destructor runs (its TMap
	// Actions is destroyed) and the new object is constructed at the SAME address.
	// A "backup" copy taken from ExistingSet AFTER that call would therefore copy
	// an already-emptied map onto itself, silently discarding every manual edit
	// (Weight/Policy/NetMode) while claiming to preserve them. Reusing the object
	// avoids the destroy-then-copy race entirely.
	UNanimationSet* ExistingSet = nullptr;
	UPackage* Package = nullptr;
	bool bIsNewAsset = true;

	if (!bOverwriteExisting && FPackageName::DoesPackageExist(PackageName))
	{
		ExistingSet = LoadObject<UNanimationSet>(nullptr, *PackageName);
		if (ExistingSet)
		{
			UE_LOG(LogNanimationEditor, Log, TEXT("Nanim: existing set '%s' found — merging in place (preserving manual edits)."), *PackageName);
			Package = ExistingSet->GetPackage();
			bIsNewAsset = false;
		}
	}

	UNanimationSet* Set = nullptr;
	if (ExistingSet)
	{
		// Reuse the existing object directly: its Actions map (with all manual
		// edits) is never destroyed, so there is nothing to "back up" — we edit
		// it in place and only ADD new variants below.
		Set = ExistingSet;
	}
	else
	{
		Package = CreatePackage(*PackageName);
		if (!Package)
		{
			UE_LOG(LogNanimationEditor, Error, TEXT("Nanim: CreatePackage failed for '%s'."), *PackageName);
			return nullptr;
		}
		Set = NewObject<UNanimationSet>(Package, UNanimationSet::StaticClass(), FName(*SetAssetName), RF_Public | RF_Standalone);
		Set->SetName = FName(*SetAssetName);
	}

	// Snapshot of preserved variant counts per category (merge case only), taken
	// BEFORE any new variant is added, so the "preserved / added" log is honest.
	int32 PreservedVariantCount = 0;
	if (ExistingSet)
	{
		for (const auto& Pair : Set->Actions)
		{
			PreservedVariantCount += Pair.Value.Variants.Num();
		}
	}

	int32 VariantCount = 0;
	int32 NewVariants = 0;
	for (const FRow& Row : Rows)
	{
		if (!Row.bIsSequenceBase || !Row.Parsed.IsClassified())
		{
			continue;
		}

		FNanimAction& Action = Set->Actions.FindOrAdd(Row.Parsed.Category);

		// Merge: if a variant with this path already exists, skip it (preserve
		// the user's existing Weight/Dir/Stance edits for that variant).
		bool bAlreadyExists = false;
		for (FNanimVariant& Existing : Action.Variants)
		{
			if (Existing.Animation.ToSoftObjectPath() == Row.Path)
			{
				bAlreadyExists = true;
				break;
			}
		}
		if (bAlreadyExists)
		{
			continue; // Preserve the user's existing edit.
		}

		FNanimVariant Variant;
		Variant.Animation = TSoftObjectPtr<UAnimSequenceBase>(Row.Path);
		Variant.Weight    = 1.0f;
		Variant.Dir       = Row.Parsed.Dir;
		Variant.Stance    = Row.Parsed.Stance;
		Action.Variants.Add(MoveTemp(Variant));
		++NewVariants;
		++VariantCount;
	}

	// Log categories that exist but have no rows (existing data, nothing new).
	if (ExistingSet)
	{
		for (const auto& Pair : Set->Actions)
		{
			UE_LOG(LogNanimationEditor, Verbose, TEXT("  Category %s: %d variants (existing + new)."),
				*StaticEnum<ENanimCategory>()->GetNameStringByValue(static_cast<int64>(Pair.Key)),
				Pair.Value.Variants.Num());
		}
		UE_LOG(LogNanimationEditor, Log, TEXT("Nanim merge: %d variants preserved / %d new variants added across %d categories."),
			PreservedVariantCount, NewVariants, Set->Actions.Num());
	}

	// AssetCreated must only be called for a genuinely NEW asset — calling it on
	// an asset that already exists in the registry would be incorrect (and the
	// merge path never goes through CreatePackage/NewObject in the first place).
	if (bIsNewAsset)
	{
		FAssetRegistryModule::AssetCreated(Set);
	}
	Package->MarkPackageDirty();

	const FString FileName = FPackageName::LongPackageNameToFilename(PackageName, FPackageName::GetAssetPackageExtension());
	FSavePackageArgs SaveArgs;
	SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
	SaveArgs.SaveFlags     = SAVE_None;
	const bool bSaved = UPackage::SavePackage(Package, Set, *FileName, SaveArgs);

	UE_LOG(LogNanimationEditor, Log, TEXT("Nanim set '%s' %s: %d categories, %d new variants.%s"),
		*PackageName,
		bSaved ? TEXT("saved") : TEXT("SAVE FAILED"),
		Set->Actions.Num(), VariantCount,
		ExistingSet ? TEXT(" (merged)") : TEXT(""));

	return Set;
}

UNanimationSet* FNanimScanner::ScanFolderAndGenerate(const FString& SourcePath, const FString& OutPackagePath, const FString& SetAssetName, bool bExportCsv, bool bOverwriteExisting, FString* OutCsvPath)
{
	TArray<FRow> Rows;
	const int32 RowCount = ScanPath(SourcePath, Rows);

	if (bExportCsv)
	{
		const FString CsvPath = FPaths::ProjectSavedDir() / TEXT("Nanimation") / (SetAssetName + TEXT("_inventory.csv"));
		ExportCsv(Rows, CsvPath);
		if (OutCsvPath)
		{
			*OutCsvPath = CsvPath;
		}
	}

	// If no rows were classified at all, warn and skip asset creation.
	bool bHasClassified = false;
	for (const FRow& Row : Rows)
	{
		if (Row.bIsSequenceBase && Row.Parsed.IsClassified())
		{
			bHasClassified = true;
			break;
		}
	}

	if (!bHasClassified)
	{
		UE_LOG(LogNanimationEditor, Warning,
			TEXT("Nanim: no classifiable animation assets found under '%s'. Check naming convention or path. No asset created."),
			*SourcePath);
		return nullptr;
	}

	return GenerateSet(Rows, OutPackagePath, SetAssetName, bOverwriteExisting);
}
