// Copyright (c) 2026 hanibes. All Rights Reserved.

#include "NanimationEditorModule.h"
#include "NanimationEditorSettings.h"
#include "NanimationEditorLog.h"
#include "NanimScanner.h"
#include "NanimationSet.h"

#include "ToolMenus.h"
#include "ToolMenuSection.h"
#include "Framework/Notifications/NotificationManager.h"
#include "Widgets/Notifications/SNotificationList.h"
#include "Misc/MessageDialog.h"
#include "Styling/AppStyle.h"

#define LOCTEXT_NAMESPACE "FNanimationEditorModule"

void FNanimationEditorModule::StartupModule()
{
	UToolMenus::RegisterStartupCallback(
		FSimpleMulticastDelegate::FDelegate::CreateRaw(this, &FNanimationEditorModule::RegisterMenus));
}

void FNanimationEditorModule::ShutdownModule()
{
	UToolMenus::UnRegisterStartupCallback(this);
	UToolMenus::UnregisterOwner(this);
}

void FNanimationEditorModule::RegisterMenus()
{
	FToolMenuOwnerScoped OwnerScoped(this);

	if (UToolMenu* ToolsMenu = UToolMenus::Get()->ExtendMenu("LevelEditor.MainMenu.Tools"))
	{
		FToolMenuSection& Section = ToolsMenu->FindOrAddSection(
			"Nanimation", LOCTEXT("NanimSection", "Nanimation"));

		Section.AddMenuEntry(
			"NanimGenerateSet",
			LOCTEXT("NanimGenLabel", "Generate Nanimation Set..."),
			LOCTEXT("NanimGenTooltip", "Scan for animation assets using the configured default path, classify by naming convention, and generate or merge a UNanimationSet data asset."),
			FSlateIcon(FAppStyle::GetAppStyleSetName(), "ClassIcon.AnimSequence"),
			FUIAction(FExecuteAction::CreateRaw(this, &FNanimationEditorModule::GenerateNanimationSet)));
	}
}

void FNanimationEditorModule::GenerateNanimationSet()
{
	const UNanimationEditorSettings* Settings = GetDefault<UNanimationEditorSettings>();

	const FString SourcePath = Settings->DefaultScanPath;
	const FString OutPath    = Settings->DefaultOutputPath;
	const FString SetName    = Settings->DefaultSetName;

	UE_LOG(LogNanimationEditor, Log, TEXT("GenerateNanimationSet: scanning '%s' -> '%s/%s'."),
		*SourcePath, *OutPath, *SetName);

	// Check if asset already exists — ask for confirmation before overwriting.
	const FString PackageName = OutPath / SetName;
	bool bOverwrite = false;
	if (FPackageName::DoesPackageExist(PackageName))
	{
		const EAppReturnType::Type Answer = FMessageDialog::Open(
			EAppMsgType::YesNoCancel,
			FText::Format(LOCTEXT("OverwriteConfirm",
				"A set already exists at '{0}'.\n\n"
				"Yes = OVERWRITE (destroys manual edits)\n"
				"No  = MERGE (preserves existing Policy/NetMode/Weights)\n"
				"Cancel = abort"),
				FText::FromString(PackageName)),
			LOCTEXT("OverwriteTitle", "Nanimation Set Exists"));

		if (Answer == EAppReturnType::Cancel)
		{
			return;
		}
		bOverwrite = (Answer == EAppReturnType::Yes);
	}

	FString CsvPath;
	UNanimationSet* Set = FNanimScanner::ScanFolderAndGenerate(
		SourcePath, OutPath, SetName, /*bExportCsv*/ true, bOverwrite, &CsvPath);

	if (Set)
	{
		const FText Msg = FText::Format(
			LOCTEXT("NanimGenOk", "Nanimation: generated {0} ({1} categories, {2} mode). CSV: {3}"),
			FText::FromName(Set->GetFName()),
			FText::AsNumber(Set->Actions.Num()),
			bOverwrite ? LOCTEXT("ModeOverwrite", "overwrite") : LOCTEXT("ModeMerge", "merge"),
			FText::FromString(CsvPath));

		FNotificationInfo Info(Msg);
		Info.ExpireDuration = 6.0f;
		FSlateNotificationManager::Get().AddNotification(Info);
	}
	else
	{
		const FText Msg = LOCTEXT("NanimGenFail",
			"Nanimation: no classifiable animation assets found. Check your naming convention or scan path in Project Settings → Plugins → Nanimation.");

		FNotificationInfo Info(Msg);
		Info.ExpireDuration = 8.0f;
		Info.bFireAndForget = false;
		Info.Image = FCoreStyle::Get().GetBrush(TEXT("MessageLog.Warning"));
		FSlateNotificationManager::Get().AddNotification(Info);
	}
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FNanimationEditorModule, NanimationEditor)
