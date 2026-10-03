// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimGenerateSetCommandlet.cpp

#include "NanimGenerateSetCommandlet.h"
#include "NanimationEditorSettings.h"
#include "NanimationEditorLog.h"
#include "NanimScanner.h"
#include "NanimationSet.h"

int32 UNanimGenerateSetCommandlet::Main(const FString& Params)
{
	const UNanimationEditorSettings* Settings = GetDefault<UNanimationEditorSettings>();

	FString Source = Settings->DefaultScanPath;
	FString Out    = Settings->DefaultOutputPath;
	FString Name   = Settings->DefaultSetName;
	bool bOverwrite = false;

	FParse::Value(*Params, TEXT("Source="), Source);
	FParse::Value(*Params, TEXT("Out="),    Out);
	FParse::Value(*Params, TEXT("Name="),   Name);
	bOverwrite = FParse::Param(*Params, TEXT("Overwrite"));

	UE_LOG(LogNanimationEditor, Display, TEXT("[NanimGenerateSet] Scanning '%s' -> %s/%s (Overwrite=%d)..."),
		*Source, *Out, *Name, bOverwrite);

	FString CsvPath;
	UNanimationSet* Set = FNanimScanner::ScanFolderAndGenerate(Source, Out, Name, /*bExportCsv*/ true, bOverwrite, &CsvPath);

	if (!Set)
	{
		UE_LOG(LogNanimationEditor, Error, TEXT("[NanimGenerateSet] FAILED (no set generated). Check naming convention and scan path."));
		return 1;
	}

	int32 TotalVariants = 0;
	for (const TPair<ENanimCategory, FNanimAction>& Pair : Set->Actions)
	{
		const int32 Num = Pair.Value.Variants.Num();
		TotalVariants += Num;
		UE_LOG(LogNanimationEditor, Display, TEXT("[NanimGenerateSet]   %s: %d variants"),
			*StaticEnum<ENanimCategory>()->GetNameStringByValue(static_cast<int64>(Pair.Key)), Num);
	}

	UE_LOG(LogNanimationEditor, Display, TEXT("[NanimGenerateSet] DONE: %s -> %d categories, %d variants. CSV: %s"),
		*Set->GetName(), Set->Actions.Num(), TotalVariants, *CsvPath);
	return 0;
}
