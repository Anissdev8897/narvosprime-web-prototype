// Copyright (c) 2026 hanibes. All Rights Reserved.
//
// NanimEditorLibrary.cpp

#include "NanimEditorLibrary.h"
#include "NanimScanner.h"

UNanimationSet* UNanimEditorLibrary::GenerateSetFromFolder(const FString& SourcePath, const FString& OutPackagePath, const FString& SetAssetName, bool bExportCsv, bool bOverwriteExisting)
{
	FString CsvPath;
	return FNanimScanner::ScanFolderAndGenerate(SourcePath, OutPackagePath, SetAssetName, bExportCsv, bOverwriteExisting, &CsvPath);
}

int32 UNanimEditorLibrary::ExportInventoryCsv(const FString& SourcePath, const FString& CsvFilePath)
{
	TArray<FNanimScanner::FRow> Rows;
	FNanimScanner::ScanPath(SourcePath, Rows);
	const bool bOk = FNanimScanner::ExportCsv(Rows, CsvFilePath);
	return bOk ? Rows.Num() : -1;
}
