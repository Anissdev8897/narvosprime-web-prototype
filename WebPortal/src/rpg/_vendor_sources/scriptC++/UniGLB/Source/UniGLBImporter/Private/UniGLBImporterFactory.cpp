// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLBImporterFactory.h"
#include "UniGLBImporterLog.h"

#include "Misc/EngineVersionComparison.h"

#include "AssetToolsModule.h"
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "AssetRegistry/AssetRegistryModule.h"
#include "PackageTools.h"
#include "Misc/Paths.h"
#include "Engine/SkeletalMesh.h"
#include "EditorFramework/AssetImportData.h"
#include "Components/SkeletalMeshComponent.h"
//#include "Runtime/CoreUObject/Public/UObject/ConstructorHelpers.h"
#include "UObject/ConstructorHelpers.h"
#include "UniGLB_LoaderBPFunctionLibrary.h"
#include "UniGLB_AssetListObject.h"
#include "UniGLB_RuntimeSettings.h"
#include "UniGLB_OptionWindow.h"
#include "Engine/Blueprint.h"
#include "Templates/SharedPointer.h"
#include "Misc/FeedbackContext.h"
#include "FileHelpers.h"
#include "TickableEditorObject.h"

#include "Interfaces/IMainFrameModule.h"
#include "Widgets/SWindow.h"
#include "Framework/Application/SlateApplication.h"
#include "HAL/PlatformApplicationMisc.h"
#include "UniGLB_OptionWindow.h"
#include "UniGLB_ImportUI.h"
#include "UniGLB_Convert.h"
#include "UniGLB_LicenseObject.h"
#include "UniGLB_1LicenseObject.h"

#define LOCTEXT_NAMESPACE "UniGLBImporter"

// for tick Editor Object
class SWindow2 : public SWindow{
public:
	//		bCanTick = false;
	SWindow2() : SWindow() {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 21, 0)] (target floor (5, 7, 0)); kept #else branch only.
		SetCanTick(true);
	}

public:
	virtual void Tick(const FGeometry& AllottedGeometry, const double InCurrentTime, const float InDeltaTime) {
		SWindow::Tick(AllottedGeometry, InCurrentTime, InDeltaTime);
		FTickableEditorObject::TickObjects(InDeltaTime);
		//FAssetRegistryModule::TickAssetRegistry(-1.0f);
	}
	bool OnIsActiveChanged(const FWindowActivateEvent& ActivateEvent) {
		bool r = SWindow::OnIsActiveChanged(ActivateEvent);
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 21, 0)] (target floor (5, 7, 0)); kept #else branch only.
		SetCanTick(true);
		return r;
	}
};


UUniGLBImporterFactory::UUniGLBImporterFactory(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{

	TArray<FString> table = {
		TEXT("vrm"),
		TEXT("vrma"),
		TEXT("glb"),
		TEXT("bvh"),
	};

	const UUniGLBRuntimeSettings* Settings = GetDefault<UUniGLBRuntimeSettings>();
	for (auto& a : Settings->extList) {
		table.AddUnique(a);
	}

	if (Settings->bAllowAllAssimpFormat || bUniGLBAcceptAllFormats) {
		TArray<FString> tmp = {
			TEXT("pmx"),
			TEXT("obj"),
			TEXT("fbx"),
			TEXT("dae"),
			TEXT("gltf"),
		};
		for (auto& a : tmp) {
			table.AddUnique(a);
		}
	}

	for (auto &a : table) {
		Formats.Add(a + TEXT(";Model UniGLB"));
	}

	bCreateNew = false;
	bEditorImport = true;

	ImportPriority = FMath::Max(1, Settings->ImportPriority);
}


bool UUniGLBImporterFactory::FactoryCanImport(const FString& Filename)
{
	fullFileName.Empty();

	const FString Extension = FPaths::GetExtension(Filename);
	bool allowAll = false;

	const UUniGLBRuntimeSettings* Settings = GetDefault<UUniGLBRuntimeSettings>();
	if (Settings) {
		if (Settings->bAllowAllAssimpFormat || bUniGLBAcceptAllFormats) {
			allowAll = true;
		}

		for (auto& a : Settings->extList) {
			if (Extension == a) {
				allowAll = true;
			}
		}
	}


	//if( Extension == TEXT("vrm") || Extension == TEXT("gltf") || Extension == TEXT("glb"))
	if(allowAll
		|| Extension == TEXT("vrm")
		|| Extension == TEXT("vrma")
		|| Extension == TEXT("glb")
		|| Extension == TEXT("bvh"))
	{
		fullFileName = Filename;
		return true;
	}

	return false;
}

UClass* UUniGLBImporterFactory::ResolveSupportedClass()
{
	UClass* ImportClass = USkeletalMesh::StaticClass();

	return ImportClass;
}

/*
UObject* UUniGLBImporterFactory::FactoryCreateFile
(
	UClass* Class,
	UObject* InParent,
	FName Name,
	EObjectFlags Flags,
	const FString& InFilename,
	const TCHAR* Parms,
	FFeedbackContext* Warn,
	bool& bOutOperationCanceled
)
{
	return nullptr;
}
*/

UObject* UUniGLBImporterFactory::FactoryCreateBinary(UClass* InClass, UObject* InParent, FName InName, EObjectFlags Flags, UObject* Context, const TCHAR* Type, const uint8*& Buffer, const uint8* BufferEnd, FFeedbackContext* Warn, bool& bOutOperationCanceled)
{
	if (fullFileName.IsEmpty()) {
		return nullptr;
	}

	{
		const UUniGLBRuntimeSettings* Settings = GetDefault<UUniGLBRuntimeSettings>();
		const bool bSkipValidation = Settings->bSkipValidationOnImport
			|| UniGLBConverter::Options::Get().IsDebugIgnoreVRMValidation();
		if (!bSkipValidation) {
			if (UUniGLBLoaderBPFunctionLibrary::IsValidUniGLBFile(fullFileName) == false) {
				return nullptr;
			}
		}
	}	

	static UUniGLBImportUI* ImportUI = nullptr;
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	TSoftObjectPtr<UObject> refPointerToLic;
	{
		if (ImportUI == nullptr) {
			ImportUI = NewObject<UUniGLBImportUI>(this, NAME_None, RF_NoFlags);
			ImportUI->AddToRoot();
		}

		// to default
		{
			ImportUI->bRemoveRootBoneRotation = true;
			ImportUI->bRemoveRootBonePosition = false;
			ImportUI->bVrm10RemoveLocalRotation = false;

			ImportUI->ModelScale = 1.0f;
			ImportUI->bMergeMaterial = false;
			ImportUI->bMergePrimitive = false;
			ImportUI->TitleAuthor.Empty();
			ImportUI->Thumbnail = nullptr;

			ImportUI->TitleAuthor.Empty();
			ImportUI->Thumbnail = nullptr;
			ImportUI->allowedUserName.Empty();
			ImportUI->violentUsageName.Empty();
			ImportUI->sexualUsageName.Empty();
			ImportUI->commercialUsageName.Empty();
			ImportUI->otherPermissionUrl.Empty();
			ImportUI->licenseName.Empty();
			ImportUI->otherLicenseUrl.Empty();

			ImportUI->LicenseString.Empty();
			ImportUI->LicenseBool.Empty();
			ImportUI->LicenseStringArray.Empty();
		}

		if (1) {
			UUniGLBLicenseObject* a = nullptr;
			UUniGLB1LicenseObject* b = nullptr;
			UUniGLBLoaderBPFunctionLibrary::GetUniGLBMeta(fullFileName, a, b);
			if (a) {
				ImportUI->TitleAuthor = TEXT("\"") + a->title + TEXT("\"") + TEXT(" / ") + TEXT("\"") + a->author + TEXT("\"");
				ImportUI->Thumbnail = a->thumbnail;
				ImportUI->allowedUserName = a->allowedUserName;
				ImportUI->violentUsageName = a->violentUsageName;
				ImportUI->sexualUsageName = a->sexualUsageName;
				ImportUI->commercialUsageName = a->commercialUsageName;
				ImportUI->otherPermissionUrl = a->otherPermissionUrl;
				ImportUI->licenseName = a->licenseName;
				ImportUI->otherLicenseUrl = a->otherLicenseUrl;

				refPointerToLic = a;
			}
			if (b) {
				{
					auto *p = b->LicenseString.FindByPredicate([](const FUniGLBLicenseStringDataPair &pair) {
						if (pair.key == TEXT("name")) return true;
						return false;
						});
					if (p) {
						ImportUI->TitleAuthor = p->value;
					}
				}
				ImportUI->Thumbnail = b->thumbnail;
				ImportUI->LicenseString = b->LicenseString;
				ImportUI->LicenseBool = b->LicenseBool;
				ImportUI->LicenseStringArray = b->LicenseStringArray;
				refPointerToLic = b;
			}
			{
				const FString Extension = FPaths::GetExtension(fullFileName);
				if (Extension.ToLower() == TEXT("pmx")) {
					ImportUI->ModelScale = 0.1f;
					ImportUI->bMergeMaterial = false;
					ImportUI->bMergePrimitive = false;
					ImportUI->bForceTwoSided = true;
				}
				if (Extension.ToLower() == TEXT("bvh")) {
					ImportUI->ModelScale = 0.01f;
				}
			}
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 2, 0)] (target floor (5, 7, 0)); kept #else branch only.
			// 5.2でも動くが、デフォルトをOFFにする


// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
			// for thumbnail update
			if (GEditor){
				auto* s = GEditor->GetEditorSubsystem<UAssetEditorSubsystem>();
				if (s && ImportUI->Thumbnail) {
					s->OpenEditorForAsset(ImportUI->Thumbnail);
					s->CloseAllEditorsForAsset(ImportUI->Thumbnail);
				}
			}
		}


		// UniGLB import actions: pre-select the Manny/GASP path on the options object.
		// Universal = the single all-in-one path: convert any character onto a clean Manny AND retarget
		// any animation present in the same file onto Manny (the retarget is a no-op when the file has
		// no animation, so it is safe to leave on for plain character imports).
		if (bUniGLBForceUniversalGASP) { ImportUI->bUniversalMannyGASP = true; } // RTG built Manny->char (play Manny lib on the character; retarget handles orientation = no skin deform)
		if (bUniGLBForceRetargetAnim) { ImportUI->bRetargetAnimToManny = true; }
		if (bUniGLBForceAdaptToManny) { ImportUI->bUniversalMannyGASP = true; ImportUI->bAutoSkinToManny = true; }

		// "Recommended" one-click import suppresses the options dialog; "options..." still shows it.
		if (!bUniGLBSuppressDialog)
		{
		TSharedPtr<SWindow> ParentWindow;

		if (FModuleManager::Get().IsModuleLoaded("MainFrame"))
		{
			IMainFrameModule& MainFrame = FModuleManager::LoadModuleChecked<IMainFrameModule>("MainFrame");
			ParentWindow = MainFrame.GetParentWindow();
		}

		// Compute centered window position based on max window size, which include when all categories are expanded
		const float FbxImportWindowWidth = 410.0f * 2.f;
		const float FbxImportWindowHeight = 750.0f;
		FVector2D FbxImportWindowSize = FVector2D(FbxImportWindowWidth, FbxImportWindowHeight); // Max window size it can get based on current slate


		FSlateRect WorkAreaRect = FSlateApplicationBase::Get().GetPreferredWorkArea();
		FVector2D DisplayTopLeft(WorkAreaRect.Left, WorkAreaRect.Top);
		FVector2D DisplaySize(WorkAreaRect.Right - WorkAreaRect.Left, WorkAreaRect.Bottom - WorkAreaRect.Top);

		float ScaleFactor = FPlatformApplicationMisc::GetDPIScaleFactorAtPoint(DisplayTopLeft.X, DisplayTopLeft.Y);
		FbxImportWindowSize *= ScaleFactor;

		FVector2D WindowPosition = (DisplayTopLeft + (DisplaySize - FbxImportWindowSize) / 2.0f) / ScaleFactor;


		TSharedRef<SWindow2> Window = SNew(SWindow2)
			.Title(NSLOCTEXT("UnrealEd", "UniGLBImportOptionsTitle", "UniGLB Import Options"))
			.SizingRule(ESizingRule::Autosized)
			.AutoCenter(EAutoCenter::None)
			.ClientSize(FbxImportWindowSize)
			.ScreenPosition(WindowPosition);

		TSharedPtr<SUniGLBOptionWindow> UniGLBOptionWindow;
		Window->SetContent
		(
			SAssignNew(UniGLBOptionWindow, SUniGLBOptionWindow)
			.ImportUI(ImportUI)
			.WidgetWindow(Window)
			.FullPath(FText::FromString(fullFileName))
			//.ForcedImportType( bForceImportType ? TOptional<EFBXImportType>( ImportType ) : TOptional<EFBXImportType>() )
			//.IsObjFormat( bIsObjFormat )
			.MaxWindowHeight(FbxImportWindowHeight)
			.MaxWindowWidth(FbxImportWindowWidth)
		);

		// @todo: we can make this slow as showing progress bar later
		FSlateApplication::Get().AddModalWindow(Window, ParentWindow);

		if (UniGLBOptionWindow->ShouldImport() == false) {
			bOutOperationCanceled = true;

			return nullptr;
		}

		} // end if (!bUniGLBSuppressDialog)

	}

	//static ConstructorHelpers::FObjectFinder<UObject> MatClass(TEXT("/Game/test/NewMaterial.NewMaterial"));
	//static ConstructorHelpers::FObjectFinder<UClass> MatClass(TEXT("Blueprint'/UniGLB/VrmAssetListObjectBP.VrmAssetListObjectBP_C'"));
	//static ConstructorHelpers::FObjectFinder<UUniGLBAssetListObject> MatClass(TEXT("Blueprint'/UniGLB/UniGLBObjectListBP'"));
	//static ConstructorHelpers::FObjectFinder<UObject> MatClass(TEXT("/UniGLB/VrmAssetListObjectBP.VrmAssetListObjectBP"));
	//UUniGLBAssetListObject *m = Cast<UUniGLBAssetListObject>(MatClass.Object);

	//UObject* objFinder = StaticLoadObject(UUniGLBAssetListObject::StaticClass(), nullptr, TEXT("/UniGLB/VrmAssetListObjectBP.VrmAssetListObjectBP_C"));
	//UObject* objFinder = NewObject<UUniGLBAssetListObject>(InParent, NAME_None, RF_Transactional);

	auto& importOption = UniGLBConverter::Options::Get();
	importOption.SetUniGLBOption(ImportUI->GenerateOptionData());


// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	TSoftObjectPtr<UUniGLBAssetListObject> uniGLBAssetList;
	TArray< TSoftObjectPtr<UObject> > tt;
	tt.Add(InParent);

	//TRefCountPtr<UUniGLBAssetListObject> m;
	//UUniGLBAssetListObject *m = nullptr;
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
	TSoftObjectPtr<UClass> c;
	{
		const UUniGLBRuntimeSettings* Settings = GetDefault<UUniGLBRuntimeSettings>();

		// A template BP whose serialized parent resolved to a foreign class (e.g. a separately
		// installed VRM4U plugin's VrmAssetListObject) would make NewObject<UUniGLBAssetListObject>
		// assert and crash the editor -- reject it here and fall through to the next candidate.
		auto GetValidatedGeneratedClass = [](UObject* u) -> UClass* {
			UBlueprint* bp = Cast<UBlueprint>(u);
			UClass* gc = bp ? (UClass*)bp->GeneratedClass : nullptr;
			if (gc && !gc->IsChildOf(UUniGLBAssetListObject::StaticClass())) {
				UE_LOG(LogUniGLBImporter, Error, TEXT("UniGLB: AssetList template '%s' is not a child of UniGLBAssetListObject (parent resolved to '%s') - ignoring it. Re-save the plugin's bundled assets against /Script/UniGLB."),
					*u->GetPathName(), *gc->GetSuperClass()->GetPathName());
				return nullptr;
			}
			return gc;
		};

		{
			FSoftObjectPath r = Settings->AssetListObject; //(TEXT("/UniGLB/VrmAssetListObjectBP.VrmAssetListObjectBP"));
			c = GetValidatedGeneratedClass(r.TryLoad());
		}
		if (c == nullptr || UniGLBConverter::Options::Get().IsUE5Material()) {
			FSoftObjectPath r(TEXT("/UniGLB/VrmAssetListObjectBPUE5.VrmAssetListObjectBPUE5"));
			UClass* ue5c = GetValidatedGeneratedClass(r.TryLoad());
			if (ue5c) { c = ue5c; }
		}
		if (c == nullptr){
			FSoftObjectPath r(TEXT("/UniGLB/VrmAssetListObjectBP.VrmAssetListObjectBP"));
			c = GetValidatedGeneratedClass(r.TryLoad());
		}

		if (c == nullptr) {
			// Without the BP template no master materials are configured: the import still succeeds
			// but every mesh section ends up with the default gray material.
			UE_LOG(LogUniGLBImporter, Error, TEXT("UniGLB: AssetList template BP not found (/UniGLB/VrmAssetListObjectBP[UE5]) - falling back to bare C++ class, imported meshes will have NO materials."));
			c = UUniGLBAssetListObject::StaticClass();
		}

		{
			if (ReimportBase) {
				uniGLBAssetList = ReimportBase;
				UniGLBUtil::CloseEditorWindowByFolderPath(uniGLBAssetList.Get());
			}
			if (uniGLBAssetList) {
				uniGLBAssetList->MarkPackageDirty();
			}else{
				uniGLBAssetList = NewObject<UUniGLBAssetListObject>((UObject*)GetTransientPackage(), c.Get());
			}
		}

	}

	//UUniGLBAssetListObject *m = Cast<UUniGLBAssetListObject>(u);
	//FSoftClassPath r(TEXT("/UniGLB/VrmAssetListObjectBP.VrmAssetListObjectBP"));
	//UObject *u = r.TryLoad();
	//auto aaa = NewObject<UObject>(c);

	UUniGLBAssetListObject* mret = nullptr;
	if (uniGLBAssetList) {
		//auto a = NewObject<UUniGLBAssetListObject>(MatClass.Object, NAME_None, RF_Transactional);
		//MatClass.Object; 
		//UUniGLBLoaderBPFunctionLibrary::LoadVRMFile(nullptr, fullFileName);

		GWarn->BeginSlowTask( NSLOCTEXT("UnrealEd", "UniGLBImportingCharacter", "Importing character..."), true );

		int ret = true;

		UUniGLBLoaderBPFunctionLibrary::SetImportMode(true, Cast<UPackage>(InParent));
		{
			ret = UUniGLBLoaderBPFunctionLibrary::LoadVRMFileLocal(uniGLBAssetList.Get(), mret, fullFileName);
		}

		UUniGLBLoaderBPFunctionLibrary::SetImportMode(false, nullptr);
		importOption.SetUniGLBOption(nullptr);

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 22, 0)] (target floor (5, 7, 0)); kept #else branch only.
		if (GEditor) {
			GEditor->GetEditorSubsystem<UImportSubsystem>()->BroadcastAssetPostImport(this, mret);
		}


		GWarn->EndSlowTask();

		//bool bDeleteSucceeded = ObjectTools::DeleteSingleObject( ExistingObject );
		CollectGarbage( GARBAGE_COLLECTION_KEEPFLAGS );

		if (ret == false) {
			return nullptr;
		}
	}
	//return InParent;
	return mret;// ->GetOuter();
}
UObject* UUniGLBImporterFactory::FactoryCreateText(UClass* InClass, UObject* InParent, FName InName, EObjectFlags Flags, UObject* Context, const TCHAR* Type, const TCHAR*& Buffer, const TCHAR* BufferEnd, FFeedbackContext* Warn)
{
	return nullptr;
}

bool UUniGLBImporterFactory::CanReimport(UObject* Obj, TArray<FString>& OutFilenames) {

	UUniGLBAssetListObject* assetList= Cast<UUniGLBAssetListObject>(Obj);
	TArray<FString> FactoryExtensions;
	GetSupportedFileExtensions(FactoryExtensions);

	if (assetList)
	{
		if (UAssetImportData* AssetImportData = assetList->GetAssetImportData())
		{
			AssetImportData->ExtractFilenames(OutFilenames);
			return true;
		}
		else
		{
			OutFilenames.Add(TEXT(""));
		}
		return true;
	}
	return false;
}
void UUniGLBImporterFactory::SetReimportPaths(UObject* Obj, const TArray<FString>& NewReimportPaths) {
	UUniGLBAssetListObject* assetList = Cast<UUniGLBAssetListObject>(Obj);
	if (assetList && ensure(NewReimportPaths.Num() == 1))
	{
		assetList->AssetImportData->UpdateFilenameOnly(NewReimportPaths[0]);
	}
}
EReimportResult::Type UUniGLBImporterFactory::Reimport(UObject* Obj) {

	UUniGLBAssetListObject* asset = Cast<UUniGLBAssetListObject>(Obj);
	if (asset == nullptr)
	{
		return EReimportResult::Failed;
	}
	if (asset->AssetImportData == nullptr) {
		return EReimportResult::Failed;
	}
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 22, 0)] (target floor (5, 7, 0)); kept #else branch only.
	if (asset->AssetImportData->GetSourceFileCount() <= 0) {
		return EReimportResult::Failed;
	}

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
	ReimportBase = asset;
	asset->Package = asset->GetPackage();
	asset->ReimportBase = asset;

	{
		FString str = asset->AssetImportData->GetSourceData().SourceFiles[0].RelativeFilename;
		fullFileName = UAssetImportData::ResolveImportFilename(str, asset->Package);
	}

	const uint8_t *buf_dummy = nullptr;
	bool b_dummy = false;

	UObject* n = FactoryCreateBinary(nullptr, asset->Package, "name", (EObjectFlags)0, nullptr, nullptr, buf_dummy, buf_dummy, nullptr, b_dummy);

	ReimportBase = nullptr;
	fullFileName = "";

	if (n == nullptr) {
		return EReimportResult::Failed;
	}
	return EReimportResult::Succeeded;
}
int32 UUniGLBImporterFactory::GetPriority() const {
	return ImportPriority;
}


//////////////////////////////////////////////////////////////////////////






////

UUniGLBImportUI::UUniGLBImportUI(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	bIsReimport = false;
	//bAutomatedImportShouldDetectType = true;
	//Make sure we are transactional to allow undo redo
	this->SetFlags(RF_Transactional);

	/*
	StaticMeshImportData = CreateDefaultSubobject<UFbxStaticMeshImportData>(TEXT("StaticMeshImportData"));
	StaticMeshImportData->SetFlags(RF_Transactional);
	StaticMeshImportData->LoadOptions();

	SkeletalMeshImportData = CreateDefaultSubobject<UFbxSkeletalMeshImportData>(TEXT("SkeletalMeshImportData"));
	SkeletalMeshImportData->SetFlags(RF_Transactional);
	SkeletalMeshImportData->LoadOptions();

	AnimSequenceImportData = CreateDefaultSubobject<UFbxAnimSequenceImportData>(TEXT("AnimSequenceImportData"));
	AnimSequenceImportData->SetFlags(RF_Transactional);
	AnimSequenceImportData->LoadOptions();

	TextureImportData = CreateDefaultSubobject<UFbxTextureImportData>(TEXT("TextureImportData"));
	TextureImportData->SetFlags(RF_Transactional);
	TextureImportData->LoadOptions();
	*/
}

void UUniGLBImportUI::ParseFromJson(TSharedRef<class FJsonObject> ImportSettingsJson)
{
	/*
	// Skip instanced object references. 
	int64 SkipFlags = CPF_InstancedReference;
	FJsonObjectConverter::JsonObjectToUStruct(ImportSettingsJson, GetClass(), this, 0, SkipFlags);

	bAutomatedImportShouldDetectType = true;
	if(ImportSettingsJson->TryGetField("MeshTypeToImport").IsValid())
	{
		// Import type was specified by the user if MeshTypeToImport exists
		bAutomatedImportShouldDetectType = false;
	}

	const TSharedPtr<FJsonObject>* StaticMeshImportJson = nullptr;
	ImportSettingsJson->TryGetObjectField(TEXT("StaticMeshImportData"), StaticMeshImportJson);
	if(StaticMeshImportJson)
	{
		FJsonObjectConverter::JsonObjectToUStruct(StaticMeshImportJson->ToSharedRef(), StaticMeshImportData->GetClass(), StaticMeshImportData, 0, 0);
	}

	const TSharedPtr<FJsonObject>* SkeletalMeshImportJson = nullptr;
	ImportSettingsJson->TryGetObjectField(TEXT("SkeletalMeshImportData"), SkeletalMeshImportJson);
	if (SkeletalMeshImportJson)
	{
		FJsonObjectConverter::JsonObjectToUStruct(SkeletalMeshImportJson->ToSharedRef(), SkeletalMeshImportData->GetClass(), SkeletalMeshImportData, 0, 0);
	}

	const TSharedPtr<FJsonObject>* AnimImportJson = nullptr;
	ImportSettingsJson->TryGetObjectField(TEXT("AnimSequenceImportData"), AnimImportJson);
	if (AnimImportJson)
	{
		FJsonObjectConverter::JsonObjectToUStruct(AnimImportJson->ToSharedRef(), AnimSequenceImportData->GetClass(), AnimSequenceImportData, 0, 0);
	}

	const TSharedPtr<FJsonObject>* TextureImportJson = nullptr;
	ImportSettingsJson->TryGetObjectField(TEXT("TextureImportData"), TextureImportJson);
	if (TextureImportJson)
	{
		FJsonObjectConverter::JsonObjectToUStruct(TextureImportJson->ToSharedRef(), TextureImportData->GetClass(), TextureImportData, 0, 0);
	}
	*/
}

void UUniGLBImportUI::ResetToDefault()
{
	ReloadConfig();
}





#undef LOCTEXT_NAMESPACE