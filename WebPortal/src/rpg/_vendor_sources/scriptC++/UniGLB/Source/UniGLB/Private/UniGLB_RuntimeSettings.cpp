// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_RuntimeSettings.h"

#if WITH_EDITOR
#include "Editor/EditorEngine.h"
#include "Misc/MessageDialog.h"
#include "UnrealEdMisc.h"
#include "Misc/ConfigCacheIni.h"
#include "HAL/PlatformFileManager.h"
#endif

#define LOCTEXT_NAMESPACE "UniGLB"


UUniGLBRuntimeSettings::UUniGLBRuntimeSettings(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	bDropUniGLBFileEnable = false;
	AssetListObject.SetPath(TEXT("/UniGLB/VrmAssetListObjectBP.VrmAssetListObjectBP"));
}

#if WITH_EDITOR
void UUniGLBRuntimeSettings::PostEditChangeProperty(struct FPropertyChangedEvent& PropertyChangedEvent) {

	Super::PostEditChangeProperty(PropertyChangedEvent);

	if (PropertyChangedEvent.Property != nullptr
		&& PropertyChangedEvent.Property->GetFName() == GET_MEMBER_NAME_CHECKED(UUniGLBRuntimeSettings, bAllowAllAssimpFormat)
		&& bAllowAllAssimpFormat)
	{
		FString FullPath = FPaths::ConvertRelativePathToFull(GetDefaultConfigFilename());
		FPlatformFileManager::Get().GetPlatformFile().SetReadOnly(*FullPath, false);

		auto DialogText(LOCTEXT("UniGLBImportWarning", "Please check the license of the model before using it.\n\nAssImp対応フォーマットのインポートを有効化しました。\nモデルのライセンスに従ってご利用ください。"));
		FMessageDialog::Open(EAppMsgType::Ok, DialogText);
	}
}
#endif
