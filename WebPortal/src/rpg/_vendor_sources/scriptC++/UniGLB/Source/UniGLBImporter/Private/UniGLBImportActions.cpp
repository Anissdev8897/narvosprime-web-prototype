// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.
#include "UniGLBImportActions.h"
#include "UniGLBImporterFactory.h"

#include "AssetToolsModule.h"
#include "IAssetTools.h"
#include "AssetImportTask.h"
#include "DesktopPlatformModule.h"
#include "IDesktopPlatform.h"
#include "Framework/Application/SlateApplication.h"
#include "Framework/Commands/UIAction.h"
#include "Modules/ModuleManager.h"
#include "ToolMenus.h"
#include "Textures/SlateIcon.h"
#include "Misc/Paths.h"
#include "HAL/FileManager.h"
#include "Widgets/Notifications/SNotificationList.h"
#include "Framework/Notifications/NotificationManager.h"

#define LOCTEXT_NAMESPACE "UniGLB"

namespace
{
	// Surface an abort to the user as an editor toast, matching UniGLBLoader's UniGLB_NotifyImport
	// (module-local duplicate: that helper lives in the UniGLBLoader module's anonymous namespace and
	// is not exported for cross-module reuse).
	void UniGLBImportActions_NotifyError(const FText& Message)
	{
		if (!FSlateApplication::IsInitialized())
		{
			return;
		}
		FNotificationInfo Info(Message);
		Info.ExpireDuration = 12.0f;
		Info.bFireAndForget = true;
		TSharedPtr<SNotificationItem> Item = FSlateNotificationManager::Get().AddNotification(Info);
		if (Item.IsValid())
		{
			Item->SetCompletionState(SNotificationItem::CS_Fail);
		}
	}
	const FName UniGLBMenuOwner("UniGLBImportActions");

	const TCHAR* DialogTitle(EUniGLBImportMode Mode)
	{
		switch (Mode)
		{
		case EUniGLBImportMode::RetargetAnim: return TEXT("Retarget Animation to Manny");
		case EUniGLBImportMode::AdaptToManny: return TEXT("Adapt Character to Manny (convert + re-skin)");
		default:                             return TEXT("Import Universal Character (A-pose / GASP)");
		}
	}

	const TCHAR* DialogFilter(EUniGLBImportMode Mode)
	{
		switch (Mode)
		{
		case EUniGLBImportMode::RetargetAnim: return TEXT("Animation (*.fbx;*.vrma;*.bvh)|*.fbx;*.vrma;*.bvh");
		default:                             return TEXT("Character (*.fbx;*.glb;*.gltf;*.obj;*.dae;*.pmx)|*.fbx;*.glb;*.gltf;*.obj;*.dae;*.pmx");
		}
	}

	// Each import goes into its own auto-created, auto-incremented /Game/ModelPortNNN folder so the assets
	// are self-contained instead of cluttering the Content root. Returns an empty string if all 999 slots
	// are taken (caller must treat that as a hard failure, not silently collide into ModelPort999).
	FString NextModelPortPath()
	{
		for (int32 i = 1; i < 1000; ++i)
		{
			const FString Dir = FPaths::ProjectContentDir() / FString::Printf(TEXT("ModelPort%03d"), i);
			if (!IFileManager::Get().DirectoryExists(*Dir))
			{
				return FString::Printf(TEXT("/Game/ModelPort%03d"), i);
			}
		}
		return FString();
	}

	void RunImport(EUniGLBImportMode Mode, bool bRecommended)
	{
		const FString DestinationPath = NextModelPortPath();
		if (DestinationPath.IsEmpty())
		{
			UniGLBImportActions_NotifyError(LOCTEXT("Error_NoModelPortSlot",
				"UniGLB: all 999 /Game/ModelPortNNN folders are in use. Delete/rename some ModelPortNNN "
				"folders and try again. Import aborted."));
			return;
		}
		UniGLBImportActions::ExecuteImport(Mode, bRecommended, DestinationPath);
	}

	void PopulateImportEntries(FToolMenuSection& Section)
	{
		auto AddEntry = [&Section](const TCHAR* Name, const FText& Label, EUniGLBImportMode Mode, bool bRecommended)
		{
			Section.AddMenuEntry(
				FName(Name),
				Label,
				FText::GetEmpty(),
				FSlateIcon(),
				FUIAction(FExecuteAction::CreateLambda([Mode, bRecommended]() { RunImport(Mode, bRecommended); })));
		};

		// Only two entries, per user request: the all-in-one Universal import (recommended = baked
		// defaults: convert any character to Manny, prune to clean 89 bones, retarget anims if present)
		// and the same with the options dialog exposed.
		AddEntry(TEXT("UniGLB_Universal_Recommended"), LOCTEXT("MenuEntry_UniversalRecommended", "Import Universal Character (recommended)"), EUniGLBImportMode::Universal, true);
		AddEntry(TEXT("UniGLB_Universal_Options"),     LOCTEXT("MenuEntry_UniversalOptions", "Import Universal Character (options...)"),  EUniGLBImportMode::Universal, false);
	}
}

void UniGLBImportActions::ExecuteImport(EUniGLBImportMode Mode, bool bRecommended, const FString& DestinationPath)
{
	IDesktopPlatform* Desktop = FDesktopPlatformModule::Get();
	if (Desktop == nullptr)
	{
		return;
	}

	const void* ParentHandle = FSlateApplication::Get().FindBestParentWindowHandleForDialogs(nullptr);

	TArray<FString> OutFiles;
	const bool bPicked = Desktop->OpenFileDialog(
		ParentHandle,
		DialogTitle(Mode),
		TEXT(""),
		TEXT(""),
		DialogFilter(Mode),
		EFileDialogFlags::Multiple,
		OutFiles);

	if (!bPicked || OutFiles.Num() == 0)
	{
		return; // user cancelled
	}

	const FString Dest = DestinationPath.IsEmpty() ? TEXT("/Game") : DestinationPath;

	// Accept the assimp formats (fbx/gltf/obj/dae/pmx) for the import duration only — set a transient
	// flag on the factory instance rather than mutating the global CDO.
	// vrm/vrma/glb/bvh are always accepted by the factory regardless.

	TArray<UAssetImportTask*> Tasks;
	for (const FString& File : OutFiles)
	{
		UUniGLBImporterFactory* Factory = NewObject<UUniGLBImporterFactory>();
		Factory->bUniGLBForceUniversalGASP = (Mode == EUniGLBImportMode::Universal);
		Factory->bUniGLBForceRetargetAnim  = (Mode == EUniGLBImportMode::RetargetAnim);
		Factory->bUniGLBForceAdaptToManny  = (Mode == EUniGLBImportMode::AdaptToManny);
		Factory->bUniGLBSuppressDialog     = bRecommended;
		Factory->bUniGLBAcceptAllFormats   = true;  // per-instance gate, replaces FScopedAllowAssimp

		UAssetImportTask* Task = NewObject<UAssetImportTask>();
		Task->Filename = File;
		Task->DestinationPath = Dest;
		Task->bAutomated = bRecommended;
		Task->bReplaceExisting = true;
		Task->bSave = false;
		Task->Factory = Factory;
		Tasks.Add(Task);
	}

	IAssetTools& AssetTools = FModuleManager::LoadModuleChecked<FAssetToolsModule>("AssetTools").Get();
	AssetTools.ImportAssetTasks(Tasks);
}

void UniGLBImportActions::RegisterImportMenus()
{
	if (!UToolMenus::IsToolMenuUIEnabled())
	{
		return;
	}

	FToolMenuOwnerScoped OwnerScoped(UniGLBMenuOwner);

	// (a) Content Browser toolbar: a combo button "UniGLB Import" exposing the 4 entries as a submenu.
	if (UToolMenu* ToolBar = UToolMenus::Get()->ExtendMenu("ContentBrowser.ToolBar"))
	{
		FToolMenuSection& Section = ToolBar->FindOrAddSection("UniGLB");
		Section.AddEntry(FToolMenuEntry::InitComboButton(
			"UniGLBImport",
			FToolUIActionChoice(),
			FNewToolMenuChoice(FNewToolMenuDelegate::CreateLambda([](UToolMenu* SubMenu)
			{
				FToolMenuSection& Sub = SubMenu->AddSection("UniGLBImport", LOCTEXT("Section_UniGLBImport", "UniGLB Import"));
				PopulateImportEntries(Sub);
			})),
			LOCTEXT("ToolbarButton_UniGLBImport", "UniGLB Import"),
			LOCTEXT("ToolbarButton_UniGLBImport_Tooltip", "Import GLB/FBX/OBJ characters onto the Manny skeleton"),
			FSlateIcon()));
	}

	// (b) Folder right-click: a dedicated section with the same entries.
	if (UToolMenu* FolderMenu = UToolMenus::Get()->ExtendMenu("ContentBrowser.FolderContextMenu"))
	{
		FToolMenuSection& Section = FolderMenu->AddSection("UniGLBImport", LOCTEXT("Section_UniGLBImport", "UniGLB Import"));
		PopulateImportEntries(Section);
	}

	// (c) The prominent "+Add" button / right-click-empty-space menu.
	if (UToolMenu* AddNewMenu = UToolMenus::Get()->ExtendMenu("ContentBrowser.AddNewContextMenu"))
	{
		FToolMenuSection& Section = AddNewMenu->AddSection("UniGLBImport", LOCTEXT("Section_UniGLBImport", "UniGLB Import"));
		PopulateImportEntries(Section);
	}

	// (d) Main editor menu bar: a top-level "UniGLB" menu next to File/Edit/Window/Tools — always
	//     visible at the very top of the editor, the most discoverable entry point.
	if (UToolMenu* MainMenu = UToolMenus::Get()->ExtendMenu("LevelEditor.MainMenu"))
	{
		FToolMenuSection& Section = MainMenu->FindOrAddSection("UniGLB");
		Section.AddSubMenu(
			"UniGLBImport",
			LOCTEXT("MainMenu_UniGLB", "UniGLB"),
			LOCTEXT("MainMenu_UniGLB_Tooltip", "Import / adapt characters & animations onto the Manny skeleton"),
			FNewToolMenuChoice(FNewToolMenuDelegate::CreateLambda([](UToolMenu* Sub)
			{
				FToolMenuSection& S = Sub->AddSection("UniGLBImport", LOCTEXT("Section_UniGLBImport", "UniGLB Import"));
				PopulateImportEntries(S);
			})));
	}
}

void UniGLBImportActions::UnregisterImportMenus()
{
	if (UObjectInitialized() && UToolMenus::Get())
	{
		UToolMenus::Get()->UnregisterOwnerByName(UniGLBMenuOwner);
	}
}

#undef LOCTEXT_NAMESPACE
