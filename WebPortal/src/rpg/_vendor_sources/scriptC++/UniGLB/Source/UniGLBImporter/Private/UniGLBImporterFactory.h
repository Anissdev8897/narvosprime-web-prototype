// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "EditorReimportHandler.h"
#include "Factories/Factory.h"
#include "UniGLBImporterFactory.generated.h"

UCLASS()
class UUniGLBImporterFactory : public UFactory, public FReimportHandler
{
	GENERATED_UCLASS_BODY()

	// UFactory interface
	//virtual FText GetToolTip() const override;
	virtual bool FactoryCanImport(const FString& Filename) override;
	virtual UClass* ResolveSupportedClass() override;
	virtual UObject* FactoryCreateText(UClass* InClass, UObject* InParent, FName InName, EObjectFlags Flags, UObject* Context, const TCHAR* Type, const TCHAR*& Buffer, const TCHAR* BufferEnd, FFeedbackContext* Warn) override;
	virtual UObject* FactoryCreateBinary(UClass* InClass, UObject* InParent, FName InName, EObjectFlags Flags, UObject* Context, const TCHAR* Type, const uint8*& Buffer, const uint8* BufferEnd, FFeedbackContext* Warn, bool& bOutOperationCanceled) override;
	// End of UFactory interface

		// FReimportHandler interface
	virtual bool CanReimport(UObject* Obj, TArray<FString>& OutFilenames) override;
	virtual void SetReimportPaths(UObject* Obj, const TArray<FString>& NewReimportPaths) override;
	virtual EReimportResult::Type Reimport(UObject* Obj) override;
	virtual int32 GetPriority() const override;
	// End of FReimportHandler interface

protected:

	FString fullFileName;
	class UUniGLBAssetListObject* ReimportBase = nullptr;

public:
	// --- UniGLB import-action plumbing -----------------------------------------------------------
	// Set by the UniGLB import menu actions (UniGLBImportActions.cpp) on the factory instance they hand
	// to UAssetImportTask. They pre-select the Manny/GASP path and, for the "recommended" one-click
	// variant, suppress the modal options window. Default false = stock behaviour (always shows window).
	UPROPERTY(Transient)
	bool bUniGLBForceUniversalGASP = false;

	UPROPERTY(Transient)
	bool bUniGLBSuppressDialog = false;

	// Sub-project C1: pre-select the "retarget animation to Manny" path (bakes the imported anim).
	UPROPERTY(Transient)
	bool bUniGLBForceRetargetAnim = false;

	// Sub-project B: pre-select "adapt to Manny" (Universal convert + geodesic-voxel auto-skin).
	UPROPERTY(Transient)
	bool bUniGLBForceAdaptToManny = false;

	// When true, this factory instance accepts all assimp formats (fbx/obj/dae/pmx/gltf) for a
	// single import — set by the UniGLB menu actions (UniGLBImportActions.cpp). The global
	// UUniGLBRuntimeSettings::bAllowAllAssimpFormat is still checked as a fallback for drag-drop
	// users who opt in, but the menu path no longer mutates the CDO.
	UPROPERTY(Transient)
	bool bUniGLBAcceptAllFormats = false;
	// --------------------------------------------------------------------------------------------
};
