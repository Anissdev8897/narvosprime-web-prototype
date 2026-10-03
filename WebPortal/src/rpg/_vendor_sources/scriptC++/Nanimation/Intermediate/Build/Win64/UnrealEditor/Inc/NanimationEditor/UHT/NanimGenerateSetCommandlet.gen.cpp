// Copyright Epic Games, Inc. All Rights Reserved.
/*===========================================================================
	Generated code exported from UnrealHeaderTool.
	DO NOT modify this manually! Edit the corresponding .h files instead!
===========================================================================*/

#include "UObject/GeneratedCppIncludes.h"
#include "NanimGenerateSetCommandlet.h"

PRAGMA_DISABLE_DEPRECATION_WARNINGS
static_assert(!UE_WITH_CONSTINIT_UOBJECT, "This generated code can only be compiled with !UE_WITH_CONSTINIT_UOBJECT");
void EmptyLinkFunctionForGeneratedCodeNanimGenerateSetCommandlet() {}

// ********** Begin Cross Module References ********************************************************
ENGINE_API UClass* Z_Construct_UClass_UCommandlet(ETypeConstructPhase);
// ********** End Cross Module References **********************************************************

// ********** Begin Same Module References *********************************************************
UPackage* Z_Construct_UPackage__Script_NanimationEditor(ETypeConstructPhase);
NANIMATIONEDITOR_API UClass* Z_Construct_UClass_UNanimGenerateSetCommandlet(ETypeConstructPhase);
NANIMATIONEDITOR_API UClass* Z_Construct_UClass_UNanimGenerateSetCommandlet(ETypeConstructPhase);
// ********** End Same Module References ***********************************************************
#define UHT_STRUCT_BASE(INIT) UE::CodeGen::ConstInit::TCompiledInObjectPtr<const FStructBaseChain>(UE::Private::AsStructBaseChain(INIT))

// ********** Begin Class UNanimGenerateSetCommandlet **********************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UClass_UNanimGenerateSetCommandlet_Statics
struct UHT_STATICS
{
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "IncludePath", "NanimGenerateSetCommandlet.h" },
		{ "ModuleRelativePath", "Public/NanimGenerateSetCommandlet.h" },
	};
#endif // WITH_METADATA

// ********** Begin Class UNanimGenerateSetCommandlet constinit property declarations **************
// ********** End Class UNanimGenerateSetCommandlet constinit property declarations ****************
	static FTypeConstructFunc* DependentSingletons[];
	static constexpr FCppClassTypeInfoStatic StaticCppClassTypeInfo = {
		TCppClassTypeTraits<UNanimGenerateSetCommandlet>::IsAbstract,
	};
	static const UECodeGen_Private::FClassParams ClassParams;
}; // struct UHT_STATICS
FTypeConstructFunc* UHT_STATICS::DependentSingletons[] = {
	(FTypeConstructFunc*)Z_Construct_UClass_UCommandlet,
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_NanimationEditor,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::DependentSingletons) < 16);
const UECodeGen_Private::FClassParams UHT_STATICS::ClassParams = {
	&Z_Construct_UClass_UNanimGenerateSetCommandlet,
	nullptr,
	&StaticCppClassTypeInfo,
	DependentSingletons,
	nullptr,
	nullptr,
	nullptr,
	UE_ARRAY_COUNT(DependentSingletons),
	0,
	0,
	0,
	0x000000A8u,
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
FClassRegistrationInfo Z_Registration_Info_UClass_UNanimGenerateSetCommandlet;
UClass* Z_Construct_UClass_UNanimGenerateSetCommandlet(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Inner)
	{
		using TClass = UNanimGenerateSetCommandlet;
		if (!Z_Registration_Info_UClass_UNanimGenerateSetCommandlet.InnerSingleton)
		{
			GetPrivateStaticClassBody(
				TClass::StaticPackage(),
				TEXT("NanimGenerateSetCommandlet"),
				Z_Registration_Info_UClass_UNanimGenerateSetCommandlet.InnerSingleton,
				nullptr,
				DataSizeOf<TClass>(),
				alignof(TClass),
				TClass::StaticClassFlags,
				TClass::StaticClassCastFlags(),
				TClass::StaticConfigName(),
				(UClass::ClassConstructorType)InternalConstructor<TClass>,
				(UClass::ClassVTableHelperCtorCallerType)InternalVTableHelperCtorCaller<TClass>,
				UOBJECT_CPPCLASS_STATICFUNCTIONS_FORCLASS(TClass),
				&TClass::Super::StaticClass,
				&TClass::WithinClass::StaticClass
			);
		}
		return Z_Registration_Info_UClass_UNanimGenerateSetCommandlet.InnerSingleton;
	}
	if (!Z_Registration_Info_UClass_UNanimGenerateSetCommandlet.OuterSingleton)
	{
		UECodeGen_Private::ConstructUClass(Z_Registration_Info_UClass_UNanimGenerateSetCommandlet.OuterSingleton, UHT_STATICS::ClassParams);
	}
	return Z_Registration_Info_UClass_UNanimGenerateSetCommandlet.OuterSingleton;
}
#undef UHT_STATICS
UNanimGenerateSetCommandlet::UNanimGenerateSetCommandlet(const FObjectInitializer& ObjectInitializer) : Super(ObjectInitializer) {}
DEFINE_VTABLE_PTR_HELPER_CTOR_NS(, UNanimGenerateSetCommandlet);
UNanimGenerateSetCommandlet::~UNanimGenerateSetCommandlet() {}
// ********** End Class UNanimGenerateSetCommandlet ************************************************

// ********** Begin Registration *******************************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_NanimationEditor_Public_NanimGenerateSetCommandlet_h__Script_NanimationEditor_Statics
struct UHT_STATICS
{
	static constexpr FClassRegisterCompiledInInfo ClassInfo[] = {
		{ Z_Construct_UClass_UNanimGenerateSetCommandlet, TEXT("UNanimGenerateSetCommandlet"), &Z_Registration_Info_UClass_UNanimGenerateSetCommandlet, CONSTRUCT_RELOAD_VERSION_INFO(FClassReloadVersionInfo, sizeof(UNanimGenerateSetCommandlet), 2990962164U) },
	};
}; // UHT_STATICS 
static FRegisterCompiledInInfo Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_NanimationEditor_Public_NanimGenerateSetCommandlet_h__Script_NanimationEditor_0e5ffa1d4d9b6f43457bf8812cf5c3c6e82d1a2c{
	TEXT("/Script/NanimationEditor"),
	UHT_STATICS::ClassInfo, UE_ARRAY_COUNT(UHT_STATICS::ClassInfo),
	nullptr, 0,
	nullptr, 0,
	nullptr, 0,
};
#undef UHT_STATICS
// ********** End Registration *********************************************************************
#undef UHT_STRUCT_BASE

PRAGMA_ENABLE_DEPRECATION_WARNINGS
