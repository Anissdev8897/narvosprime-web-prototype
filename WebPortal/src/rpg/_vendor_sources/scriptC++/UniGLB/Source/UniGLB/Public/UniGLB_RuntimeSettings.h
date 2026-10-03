// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
//#include "UniGLB_AssetListObject.h"
#include "UniGLB_RuntimeSettings.generated.h"

/**
 * 
 */
UCLASS(config=Engine, defaultconfig)
class UNIGLB_API UUniGLBRuntimeSettings : public UObject
{
	
	GENERATED_UCLASS_BODY()

		// Enables experimental *incomplete and unsupported* texture atlas groups that sprites can be assigned to
		//UPROPERTY(EditAnywhere, config, Category=Settings)
		//bool bEnableSpriteAtlasGroups;

	/** For runtime load sample map */
	UPROPERTY(config, EditAnywhere, Category = Settings, meta = (
		ConfigRestartRequired=true
		))
	uint32 bDropUniGLBFileEnable:1;

	/**
	 * Advanced: when true, UniGLB takes over drag-and-drop import of standard fbx/glb/gltf/obj/dae/pmx
	 * files (ImportPriority above Epic's importers). Default false so a freshly enabled plugin does NOT
	 * silently hijack the project's normal FBX/glTF pipeline. The explicit "UniGLB Import" menu enables
	 * it temporarily for its own imports regardless of this setting (see FScopedAllowAssimp).
	 */
	UPROPERTY(config, EditAnywhere, Category = Settings, meta = (
		ConfigRestartRequired = true
		))
	bool bAllowAllAssimpFormat = false;

	//UPROPERTY(config, EditAnywhere, Category = Settings, meta = (AllowedClasses = "UniGLBAssetListObject", ExactClass = false))

	/** Default material set for runtimeload */
	UPROPERTY(config, EditAnywhere, Category = Settings, meta = (
		AllowedClasses = "/Script/CoreUObject.Object",
		ExactClass = false
		))
	FSoftObjectPath AssetListObject;

	/** Skip VRM validation check on import */
	UPROPERTY(config, EditAnywhere, Category = Settings)
	bool bSkipValidationOnImport = false;

	/** priority<100 for UniGLB. Default plugins priority=100 */
	UPROPERTY(config, EditAnywhere, Category = Settings, meta = (
		ConfigRestartRequired = true
		))
	int32 ImportPriority = 90;

	UPROPERTY(config, EditAnywhere, Category = Settings, meta = (
		ConfigRestartRequired = true
		))
	TArray<FString> extList;


#if WITH_EDITOR
	virtual void PostEditChangeProperty(struct FPropertyChangedEvent& PropertyChangedEvent);
#endif

};
