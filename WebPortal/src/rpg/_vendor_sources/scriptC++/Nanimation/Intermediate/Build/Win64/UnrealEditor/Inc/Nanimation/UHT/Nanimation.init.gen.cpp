// Copyright Epic Games, Inc. All Rights Reserved.
/*===========================================================================
	Generated code exported from UnrealHeaderTool.
	DO NOT modify this manually! Edit the corresponding .h files instead!
===========================================================================*/

#include "UObject/GeneratedCppIncludes.h"
PRAGMA_DISABLE_DEPRECATION_WARNINGS
void EmptyLinkFunctionForGeneratedCodeNanimation_init() {}
static_assert(!UE_WITH_CONSTINIT_UOBJECT, "This generated code can only be compiled with !UE_WITH_CONSTINIT_OBJECT");
	NANIMATION_API UFunction* Z_Construct_UDelegateFunction_Nanimation_OnNanimVariantChosen__DelegateSignature(ETypeConstructPhase);
	static FPackageRegistrationInfo Z_Registration_Info_UPackage__Script_Nanimation;
	FORCENOINLINE UPackage* Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase)
	{
		if (!Z_Registration_Info_UPackage__Script_Nanimation.OuterSingleton)
		{
		static FTypeConstructFunc* SingletonFuncArray[] = {
			(FTypeConstructFunc*)Z_Construct_UDelegateFunction_Nanimation_OnNanimVariantChosen__DelegateSignature,
		};
		static const UECodeGen_Private::FPackageParams PackageParams = {
			"/Script/Nanimation",
			SingletonFuncArray,
			UE_ARRAY_COUNT(SingletonFuncArray),
			PKG_CompiledIn | 0x00000000,
			0xB99E349E,
			0xE014A46A,
			METADATA_PARAMS(0, nullptr)
		};
		UECodeGen_Private::ConstructUPackage(Z_Registration_Info_UPackage__Script_Nanimation.OuterSingleton, PackageParams);
	}
	return Z_Registration_Info_UPackage__Script_Nanimation.OuterSingleton;
}
static FRegisterCompiledInInfo Z_CompiledInDeferPackage_UPackage__Script_Nanimation(Z_Construct_UPackage__Script_Nanimation, TEXT("/Script/Nanimation"), Z_Registration_Info_UPackage__Script_Nanimation, CONSTRUCT_RELOAD_VERSION_INFO(FPackageReloadVersionInfo, 0xB99E349E, 0xE014A46A));
PRAGMA_ENABLE_DEPRECATION_WARNINGS
