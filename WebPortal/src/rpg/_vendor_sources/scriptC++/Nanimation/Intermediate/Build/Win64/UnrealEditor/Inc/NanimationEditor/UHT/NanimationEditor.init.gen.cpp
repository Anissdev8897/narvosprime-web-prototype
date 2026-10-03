// Copyright Epic Games, Inc. All Rights Reserved.
/*===========================================================================
	Generated code exported from UnrealHeaderTool.
	DO NOT modify this manually! Edit the corresponding .h files instead!
===========================================================================*/

#include "UObject/GeneratedCppIncludes.h"
PRAGMA_DISABLE_DEPRECATION_WARNINGS
void EmptyLinkFunctionForGeneratedCodeNanimationEditor_init() {}
static_assert(!UE_WITH_CONSTINIT_UOBJECT, "This generated code can only be compiled with !UE_WITH_CONSTINIT_OBJECT");
	static FPackageRegistrationInfo Z_Registration_Info_UPackage__Script_NanimationEditor;
	FORCENOINLINE UPackage* Z_Construct_UPackage__Script_NanimationEditor(ETypeConstructPhase)
	{
		if (!Z_Registration_Info_UPackage__Script_NanimationEditor.OuterSingleton)
		{
		static const UECodeGen_Private::FPackageParams PackageParams = {
			"/Script/NanimationEditor",
			nullptr,
			0,
			PKG_CompiledIn | 0x00000100,
			0x1ED86814,
			0xE874BF7A,
			METADATA_PARAMS(0, nullptr)
		};
		UECodeGen_Private::ConstructUPackage(Z_Registration_Info_UPackage__Script_NanimationEditor.OuterSingleton, PackageParams);
	}
	return Z_Registration_Info_UPackage__Script_NanimationEditor.OuterSingleton;
}
static FRegisterCompiledInInfo Z_CompiledInDeferPackage_UPackage__Script_NanimationEditor(Z_Construct_UPackage__Script_NanimationEditor, TEXT("/Script/NanimationEditor"), Z_Registration_Info_UPackage__Script_NanimationEditor, CONSTRUCT_RELOAD_VERSION_INFO(FPackageReloadVersionInfo, 0x1ED86814, 0xE874BF7A));
PRAGMA_ENABLE_DEPRECATION_WARNINGS
