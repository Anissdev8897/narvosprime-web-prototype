// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications (c) hanibes. See LICENSE.

#include "CoreMinimal.h"
#include "UniGLBImporterLog.h"
#include "UniGLBDetailCustomize.h"
#include "UniGLB_AssetListThumbnailRenderer.h"
#include "UniGLB_AssetListObject.h"
#include "UniGLB_LicenseObject.h"
#include "UniGLB_1LicenseObject.h"
#include "UniGLB_MetaObject.h"
#include "UniGLB_CustomStruct.h"
#include "UniGLB_Convert.h"

#include "AssetToolsModule.h"
#include "Modules/ModuleManager.h"
#include "Internationalization/Internationalization.h"
#include "ThumbnailRendering/ThumbnailManager.h"
#include "Editor/PropertyEditor/Public/PropertyEditorModule.h"
#include "UniGLBImportActions.h"
#include "ToolMenus.h"



#define LOCTEXT_NAMESPACE "UniGLBImporter"

DEFINE_LOG_CATEGORY(LogUniGLBImporter);

//////////////////////////////////////////////////////////////////////////
// FSpriterImporterModule

class FUniGLBImporterModule : public FDefaultModuleImpl
{
	TArray< TSharedPtr<IAssetTypeActions> >  AssetTypeActions;

public:

	void OnObjectImported(UFactory* ImportFactory, UObject* InObject) {
		// Sub-project B: run the adapt-to-Manny (auto-skin/rig) pass POST-import. By the time OnAssetPostImport
		// fires, the mesh is fully built, so the geometry-script conversion is safe (unlike mid-import where it
		// crashed in MeshConversion).
		if (UUniGLBAssetListObject* AssetList = Cast<UUniGLBAssetListObject>(InObject)) {
			if (AssetList->bUniGLBPendingAdapt) {
				AssetList->bUniGLBPendingAdapt = false;
				UniGLBConverter Conv;
				Conv.AdaptToMannyPostImport(AssetList);
			}
		}
	}

	void OnObjectReimported(UObject* InObject)	{
		// Mirror OnObjectImported: a REIMPORT (OnAssetReimport) must ALSO run the post-import adapt-to-Manny
		// auto-rig. The adapt is POST-import (deferred), so without this, re-importing an FBX to pick up changes
		// would land the raw source skeleton with NO Manny fit (the user testing via reimport would see "nothing
		// happened"). The dispatcher re-runs during reimport and re-sets bUniGLBPendingAdapt, so honor it here too.
		if (UUniGLBAssetListObject* AssetList = Cast<UUniGLBAssetListObject>(InObject)) {
			if (AssetList->bUniGLBPendingAdapt) {
				AssetList->bUniGLBPendingAdapt = false;
				UniGLBConverter Conv;
				Conv.AdaptToMannyPostImport(AssetList);
			}
		}
	}

	void OnPostEngineInit() {
		if (GEditor)
		{
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 22, 0)] (target floor (5, 7, 0)); kept #else branch only.
			GEditor->GetEditorSubsystem<UImportSubsystem>()->OnAssetPostImport.AddRaw(this, &FUniGLBImporterModule::OnObjectImported);
			GEditor->GetEditorSubsystem<UImportSubsystem>()->OnAssetReimport.AddRaw(this, &FUniGLBImporterModule::OnObjectReimported);
		}

		// Register the UniGLB menus via the ToolMenus startup callback — the robust pattern that fires once
		// UToolMenus is fully ready (extending menus directly at OnPostEngineInit can be too early and get dropped).
		UToolMenus::RegisterStartupCallback(
			FSimpleMulticastDelegate::FDelegate::CreateStatic(&UniGLBImportActions::RegisterImportMenus));
	}


	virtual void StartupModule() override
	{
		{
			auto &a = UThumbnailManager::Get();
			a.RegisterCustomRenderer(UUniGLBAssetListObject::StaticClass(), UUniGLBAssetListThumbnailRenderer::StaticClass());
			a.RegisterCustomRenderer(UUniGLBLicenseObject::StaticClass(), UUniGLBAssetListThumbnailRenderer::StaticClass());
			a.RegisterCustomRenderer(UUniGLB1LicenseObject::StaticClass(), UUniGLBAssetListThumbnailRenderer::StaticClass());
			a.RegisterCustomRenderer(UUniGLBMetaObject::StaticClass(), UUniGLBAssetListThumbnailRenderer::StaticClass());
		}

		// NOTE: the asset type UI (display name, colour, thumbnail overlay) is provided by the modern
		// UAssetDefinition_UniGLB* classes (auto-registered UCLASS assets). We intentionally do NOT also
		// register the legacy FAssetTypeActions_UniGLB* here: registering both for the same UClass makes
		// UE emit "already registered" warnings and pick the display name non-deterministically (the two
		// VRM licences even collided on one name). The legacy classes are kept only as the thumbnail
		// helper base and are no longer registered as asset type actions.

		{
			FPropertyEditorModule& PropertyEditorModule = FModuleManager::LoadModuleChecked<FPropertyEditorModule>("PropertyEditor");

			PropertyEditorModule.RegisterCustomPropertyTypeLayout(
				("UniGLBRetargetSrcAnimSequence"),
				FOnGetPropertyTypeCustomizationInstance::CreateStatic(&FUniGLBRetargetSrcAnimSequenceCustomization::MakeInstance)
			);

			PropertyEditorModule.NotifyCustomizationModuleChanged();
		}
		{
			if (GIsEditor)
			{
				FCoreDelegates::OnPostEngineInit.AddRaw(this, &FUniGLBImporterModule::OnPostEngineInit);
			}
		}
	}

	virtual void ShutdownModule() override
	{
		if (UObjectInitialized()){
			UniGLBImportActions::UnregisterImportMenus();

			UThumbnailManager::Get().UnregisterCustomRenderer(UUniGLBAssetListObject::StaticClass());
			UThumbnailManager::Get().UnregisterCustomRenderer(UUniGLBLicenseObject::StaticClass());
			UThumbnailManager::Get().UnregisterCustomRenderer(UUniGLB1LicenseObject::StaticClass());
			UThumbnailManager::Get().UnregisterCustomRenderer(UUniGLBMetaObject::StaticClass());

			FPropertyEditorModule& PropertyEditorModule = FModuleManager::LoadModuleChecked<FPropertyEditorModule>("PropertyEditor");
			PropertyEditorModule.UnregisterCustomPropertyTypeLayout(("UniGLBRetargetSrcAnimSequence"));


			IAssetTools& AssetTools = FModuleManager::LoadModuleChecked<FAssetToolsModule>("AssetTools").Get();
			for (decltype(auto) a : AssetTypeActions) {
				AssetTools.UnregisterAssetTypeActions(a.ToSharedRef());
				a.Reset();
			}
			AssetTypeActions.Empty();
		}
	}
};

//////////////////////////////////////////////////////////////////////////

IMPLEMENT_MODULE(FUniGLBImporterModule, UniGLBImporter);

//////////////////////////////////////////////////////////////////////////

#undef LOCTEXT_NAMESPACE
