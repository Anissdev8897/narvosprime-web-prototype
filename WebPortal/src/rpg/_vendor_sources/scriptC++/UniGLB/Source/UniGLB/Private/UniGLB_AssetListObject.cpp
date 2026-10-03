// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.


#include "UniGLB_AssetListObject.h"
#include "EditorFramework/AssetImportData.h"
//#include "UniGLB_LoaderBPFunctionLibrary.h"



UUniGLBAssetListObject::UUniGLBAssetListObject(const FObjectInitializer& ObjectInitializer)
	:Super(ObjectInitializer)
{
	Package = GetTransientPackage();

	//Result = new FUniGLBReturnedData();
}


void UUniGLBAssetListObject::CopyMember(UUniGLBAssetListObject *dst) const {
	dst->bAssetSave = bAssetSave;
	dst->bSkipMorphTarget = bSkipMorphTarget;

	dst->MtoonLitSet = MtoonLitSet;
	dst->MtoonUnlitSet = MtoonUnlitSet;
	dst->SSSSet = SSSSet;
	dst->SSSProfileSet = SSSProfileSet;
	dst->UnlitSet = UnlitSet;
	dst->GLTFSet = GLTFSet;
	dst->UEFNUnlitSet = UEFNUnlitSet;
	dst->UEFNLitSet = UEFNLitSet;
	dst->UEFNSSSProfileSet = UEFNSSSProfileSet;
	dst->CustomSet = CustomSet;


	dst->BaseMToonLitOpaqueMaterial = BaseMToonLitOpaqueMaterial;
	dst->BaseMToonLitTranslucentMaterial = BaseMToonLitTranslucentMaterial;
	dst->OptMToonLitOpaqueMaterial = OptMToonLitOpaqueMaterial;
	dst->OptMToonLitOpaqueTwoSidedMaterial = OptMToonLitOpaqueTwoSidedMaterial;
	dst->OptMToonLitTranslucentMaterial = OptMToonLitTranslucentMaterial;
	dst->OptMToonLitTranslucentTwoSidedMaterial = OptMToonLitTranslucentTwoSidedMaterial;

	dst->BaseMToonUnlitOpaqueMaterial = BaseMToonUnlitOpaqueMaterial;
	dst->BaseMToonUnlitTranslucentMaterial = BaseMToonUnlitTranslucentMaterial;
	dst->OptMToonUnlitOpaqueMaterial = OptMToonUnlitOpaqueMaterial;
	dst->OptMToonUnlitOpaqueTwoSidedMaterial = OptMToonUnlitOpaqueTwoSidedMaterial;
	dst->OptMToonUnlitTranslucentMaterial = OptMToonUnlitTranslucentMaterial;
	dst->OptMToonUnlitTranslucentTwoSidedMaterial = OptMToonUnlitTranslucentTwoSidedMaterial;

	dst->OptMToonOutlineMaterial = OptMToonOutlineMaterial;

	dst->BaseUnlitOpaqueMaterial			= BaseUnlitOpaqueMaterial;
	dst->BaseUnlitTranslucentMaterial = BaseUnlitTranslucentMaterial;
	dst->BasePBROpaqueMaterial = BasePBROpaqueMaterial;


	dst->BaseSkeletalMesh = BaseSkeletalMesh;
	dst->UniGLBMetaObject = UniGLBMetaObject;
	dst->UniGLBLicenseObject = UniGLBLicenseObject;
	dst->UniGLB1LicenseObject = UniGLB1LicenseObject;
	dst->SkeletalMesh = SkeletalMesh;
	dst->Textures = Textures;
	dst->Materials = Materials;
	dst->HumanoidRig = HumanoidRig;
	dst->Package = Package;
	dst->FileFullPathName = FileFullPathName;
	dst->OrigFileName = OrigFileName;
	dst->BaseFileName = BaseFileName;
	dst->HumanoidSkeletalMesh = HumanoidSkeletalMesh;
}

#if WITH_EDITOR
void UUniGLBAssetListObject::GetAssetRegistryTags(TArray<FAssetRegistryTag>& OutTags) const
{
	if (AssetImportData)
	{
		OutTags.Add(FAssetRegistryTag(SourceFileTagName(), AssetImportData->GetSourceData().ToJson(), FAssetRegistryTag::TT_Hidden));

		OutTags.Add(FAssetRegistryTag("UniGLB", SourceFileTagName().ToString(), FAssetRegistryTag::TT_Hidden));
	}
PRAGMA_DISABLE_DEPRECATION_WARNINGS
	Super::GetAssetRegistryTags(OutTags);
PRAGMA_ENABLE_DEPRECATION_WARNINGS
}

void UUniGLBAssetListObject::WaitUntilAsyncPropertyReleased() const {
	if (IsValid(SkeletalMesh) == false) {
		return;
	}
	//SkeletalMesh->WaitUntilAsyncPropertyReleased(AsyncProperties);
}


#endif
