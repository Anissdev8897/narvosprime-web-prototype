// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimEditorLibrary.h
// ====================
// Blueprint-callable front door to FNanimScanner.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "NanimEditorLibrary.generated.h"

class UNanimationSet;

UCLASS()
class NANIMATIONEDITOR_API UNanimEditorLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/**
	 * Scan a content folder, (optionally) write a CSV inventory, and generate +
	 * save a UNanimationSet. Default behaviour is MERGE (preserves manual edits).
	 *
	 * @param bOverwriteExisting  If true, destroys existing data. Default: false (merge).
	 */
	UFUNCTION(BlueprintCallable, Category = "Nanimation|Editor")
	static UNanimationSet* GenerateSetFromFolder(const FString& SourcePath, const FString& OutPackagePath, const FString& SetAssetName, bool bExportCsv = true, bool bOverwriteExisting = false);

	/**
	 * Scan only -> write a CSV inventory. Returns the number of rows written,
	 * or -1 on file write failure.
	 */
	UFUNCTION(BlueprintCallable, Category = "Nanimation|Editor")
	static int32 ExportInventoryCsv(const FString& SourcePath, const FString& CsvFilePath);
};
