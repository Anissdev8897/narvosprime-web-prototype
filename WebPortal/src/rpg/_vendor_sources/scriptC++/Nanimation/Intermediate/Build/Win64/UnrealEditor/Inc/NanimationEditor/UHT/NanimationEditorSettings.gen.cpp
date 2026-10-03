// Copyright Epic Games, Inc. All Rights Reserved.
/*===========================================================================
	Generated code exported from UnrealHeaderTool.
	DO NOT modify this manually! Edit the corresponding .h files instead!
===========================================================================*/

#include "UObject/GeneratedCppIncludes.h"
#include "NanimationEditorSettings.h"

PRAGMA_DISABLE_DEPRECATION_WARNINGS
static_assert(!UE_WITH_CONSTINIT_UOBJECT, "This generated code can only be compiled with !UE_WITH_CONSTINIT_UOBJECT");
void EmptyLinkFunctionForGeneratedCodeNanimationEditorSettings() {}

// ********** Begin Cross Module References ********************************************************
DEVELOPERSETTINGS_API UClass* Z_Construct_UClass_UDeveloperSettings(ETypeConstructPhase);
NANIMATION_API UEnum* Z_Construct_UEnum_Nanimation_ENanimCategory(ETypeConstructPhase);
NANIMATION_API UEnum* Z_Construct_UEnum_Nanimation_ENanimDirection(ETypeConstructPhase);
NANIMATION_API UEnum* Z_Construct_UEnum_Nanimation_ENanimStance(ETypeConstructPhase);
// ********** End Cross Module References **********************************************************

// ********** Begin Same Module References *********************************************************
UPackage* Z_Construct_UPackage__Script_NanimationEditor(ETypeConstructPhase);
NANIMATIONEDITOR_API UClass* Z_Construct_UClass_UNanimationEditorSettings(ETypeConstructPhase);
NANIMATIONEDITOR_API UClass* Z_Construct_UClass_UNanimationEditorSettings(ETypeConstructPhase);
// ********** End Same Module References ***********************************************************
#define UHT_STRUCT_BASE(INIT) UE::CodeGen::ConstInit::TCompiledInObjectPtr<const FStructBaseChain>(UE::Private::AsStructBaseChain(INIT))

// ********** Begin Class UNanimationEditorSettings ************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UClass_UNanimationEditorSettings_Statics
struct UHT_STATICS
{
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "DisplayName", "Nanimation" },
		{ "IncludePath", "NanimationEditorSettings.h" },
		{ "ModuleRelativePath", "Public/NanimationEditorSettings.h" },
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_DefaultScanPath_MetaData[] = {
		{ "Category", "Scanner" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Default content path to scan for animation assets. */" },
#endif
		{ "ContentDir", "" },
		{ "LongPackageName", "" },
		{ "ModuleRelativePath", "Public/NanimationEditorSettings.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Default content path to scan for animation assets." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_DefaultOutputPath_MetaData[] = {
		{ "Category", "Scanner" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Default output path for generated UNanimationSet assets. */" },
#endif
		{ "ContentDir", "" },
		{ "LongPackageName", "" },
		{ "ModuleRelativePath", "Public/NanimationEditorSettings.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Default output path for generated UNanimationSet assets." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_DefaultSetName_MetaData[] = {
		{ "Category", "Scanner" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Default asset name for generated sets. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationEditorSettings.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Default asset name for generated sets." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_ExtraCategoryTokens_MetaData[] = {
		{ "Category", "Tokens" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Extra category token synonyms (e.g. \"swim\" -> Idle). Consulted by\n\x09 *  FNanimScanner::MatchCategory AFTER the built-in token table, keyed by\n\x09 *  lowercase token. Actually wired \xe2\x80\x94 see NanimScanner.cpp. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationEditorSettings.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Extra category token synonyms (e.g. \"swim\" -> Idle). Consulted by\nFNanimScanner::MatchCategory AFTER the built-in token table, keyed by\nlowercase token. Actually wired \xe2\x80\x94 see NanimScanner.cpp." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_ExtraDirectionTokens_MetaData[] = {
		{ "Category", "Tokens" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Extra direction token synonyms. Consulted by FNanimScanner::MatchDirection\n\x09 *  AFTER the built-in token table, keyed by lowercase token. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationEditorSettings.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Extra direction token synonyms. Consulted by FNanimScanner::MatchDirection\nAFTER the built-in token table, keyed by lowercase token." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_ExtraStanceTokens_MetaData[] = {
		{ "Category", "Tokens" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Extra stance token synonyms. Consulted by FNanimScanner::MatchStance AFTER\n\x09 *  the built-in token table, keyed by lowercase token. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationEditorSettings.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Extra stance token synonyms. Consulted by FNanimScanner::MatchStance AFTER\nthe built-in token table, keyed by lowercase token." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin Class UNanimationEditorSettings constinit property declarations ****************
	static const UECodeGen_Private::FStrPropertyParams NewProp_DefaultScanPath;
	static const UECodeGen_Private::FStrPropertyParams NewProp_DefaultOutputPath;
	static const UECodeGen_Private::FStrPropertyParams NewProp_DefaultSetName;
	static const UECodeGen_Private::FBytePropertyParams NewProp_ExtraCategoryTokens_ValueProp_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_ExtraCategoryTokens_ValueProp;
	static const UECodeGen_Private::FStrPropertyParams NewProp_ExtraCategoryTokens_Key_KeyProp;
	static const UECodeGen_Private::FMapPropertyParams NewProp_ExtraCategoryTokens;
	static const UECodeGen_Private::FBytePropertyParams NewProp_ExtraDirectionTokens_ValueProp_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_ExtraDirectionTokens_ValueProp;
	static const UECodeGen_Private::FStrPropertyParams NewProp_ExtraDirectionTokens_Key_KeyProp;
	static const UECodeGen_Private::FMapPropertyParams NewProp_ExtraDirectionTokens;
	static const UECodeGen_Private::FBytePropertyParams NewProp_ExtraStanceTokens_ValueProp_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_ExtraStanceTokens_ValueProp;
	static const UECodeGen_Private::FStrPropertyParams NewProp_ExtraStanceTokens_Key_KeyProp;
	static const UECodeGen_Private::FMapPropertyParams NewProp_ExtraStanceTokens;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Class UNanimationEditorSettings constinit property declarations ******************
	static FTypeConstructFunc* DependentSingletons[];
	static constexpr FCppClassTypeInfoStatic StaticCppClassTypeInfo = {
		TCppClassTypeTraits<UNanimationEditorSettings>::IsAbstract,
	};
	static const UECodeGen_Private::FClassParams ClassParams;
}; // struct UHT_STATICS

// ********** Begin Class UNanimationEditorSettings Property Definitions ***************************
const UECodeGen_Private::FStrPropertyParams UHT_STATICS::NewProp_DefaultScanPath = { "DefaultScanPath", nullptr, (EPropertyFlags)0x0010000000004001, UECodeGen_Private::EPropertyGenFlags::Str, nullptr, nullptr, 1, STRUCT_OFFSET(UNanimationEditorSettings, DefaultScanPath), METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_DefaultScanPath_MetaData), NewProp_DefaultScanPath_MetaData) };
const UECodeGen_Private::FStrPropertyParams UHT_STATICS::NewProp_DefaultOutputPath = { "DefaultOutputPath", nullptr, (EPropertyFlags)0x0010000000004001, UECodeGen_Private::EPropertyGenFlags::Str, nullptr, nullptr, 1, STRUCT_OFFSET(UNanimationEditorSettings, DefaultOutputPath), METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_DefaultOutputPath_MetaData), NewProp_DefaultOutputPath_MetaData) };
const UECodeGen_Private::FStrPropertyParams UHT_STATICS::NewProp_DefaultSetName = { "DefaultSetName", nullptr, (EPropertyFlags)0x0010000000004001, UECodeGen_Private::EPropertyGenFlags::Str, nullptr, nullptr, 1, STRUCT_OFFSET(UNanimationEditorSettings, DefaultSetName), METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_DefaultSetName_MetaData), NewProp_DefaultSetName_MetaData) };
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_ExtraCategoryTokens_ValueProp_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_ExtraCategoryTokens_ValueProp = { "ExtraCategoryTokens", nullptr, (EPropertyFlags)0x0000000000004001, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, 1, Z_Construct_UEnum_Nanimation_ENanimCategory, METADATA_PARAMS(0, nullptr) }; // aa849c0533a1b8ada989c9b7cd65620151f02da6
const UECodeGen_Private::FStrPropertyParams UHT_STATICS::NewProp_ExtraCategoryTokens_Key_KeyProp = { "ExtraCategoryTokens_Key", nullptr, (EPropertyFlags)0x0000000000004001, UECodeGen_Private::EPropertyGenFlags::Str, nullptr, nullptr, 1, 0, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FMapPropertyParams UHT_STATICS::NewProp_ExtraCategoryTokens = { "ExtraCategoryTokens", nullptr, (EPropertyFlags)0x0010000000004001, UECodeGen_Private::EPropertyGenFlags::Map, nullptr, nullptr, 1, STRUCT_OFFSET(UNanimationEditorSettings, ExtraCategoryTokens), EMapPropertyFlags::None, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_ExtraCategoryTokens_MetaData), NewProp_ExtraCategoryTokens_MetaData) }; // aa849c0533a1b8ada989c9b7cd65620151f02da6
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_ExtraDirectionTokens_ValueProp_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_ExtraDirectionTokens_ValueProp = { "ExtraDirectionTokens", nullptr, (EPropertyFlags)0x0000000000004001, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, 1, Z_Construct_UEnum_Nanimation_ENanimDirection, METADATA_PARAMS(0, nullptr) }; // b25cabd55150fca584aaae69fed07d8ad672b0d7
const UECodeGen_Private::FStrPropertyParams UHT_STATICS::NewProp_ExtraDirectionTokens_Key_KeyProp = { "ExtraDirectionTokens_Key", nullptr, (EPropertyFlags)0x0000000000004001, UECodeGen_Private::EPropertyGenFlags::Str, nullptr, nullptr, 1, 0, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FMapPropertyParams UHT_STATICS::NewProp_ExtraDirectionTokens = { "ExtraDirectionTokens", nullptr, (EPropertyFlags)0x0010000000004001, UECodeGen_Private::EPropertyGenFlags::Map, nullptr, nullptr, 1, STRUCT_OFFSET(UNanimationEditorSettings, ExtraDirectionTokens), EMapPropertyFlags::None, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_ExtraDirectionTokens_MetaData), NewProp_ExtraDirectionTokens_MetaData) }; // b25cabd55150fca584aaae69fed07d8ad672b0d7
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_ExtraStanceTokens_ValueProp_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_ExtraStanceTokens_ValueProp = { "ExtraStanceTokens", nullptr, (EPropertyFlags)0x0000000000004001, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, 1, Z_Construct_UEnum_Nanimation_ENanimStance, METADATA_PARAMS(0, nullptr) }; // 39f444116cccb25a5b0e4dc3fbfa9c6314e45569
const UECodeGen_Private::FStrPropertyParams UHT_STATICS::NewProp_ExtraStanceTokens_Key_KeyProp = { "ExtraStanceTokens_Key", nullptr, (EPropertyFlags)0x0000000000004001, UECodeGen_Private::EPropertyGenFlags::Str, nullptr, nullptr, 1, 0, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FMapPropertyParams UHT_STATICS::NewProp_ExtraStanceTokens = { "ExtraStanceTokens", nullptr, (EPropertyFlags)0x0010000000004001, UECodeGen_Private::EPropertyGenFlags::Map, nullptr, nullptr, 1, STRUCT_OFFSET(UNanimationEditorSettings, ExtraStanceTokens), EMapPropertyFlags::None, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_ExtraStanceTokens_MetaData), NewProp_ExtraStanceTokens_MetaData) }; // 39f444116cccb25a5b0e4dc3fbfa9c6314e45569
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_DefaultScanPath,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_DefaultOutputPath,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_DefaultSetName,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ExtraCategoryTokens_ValueProp_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ExtraCategoryTokens_ValueProp,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ExtraCategoryTokens_Key_KeyProp,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ExtraCategoryTokens,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ExtraDirectionTokens_ValueProp_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ExtraDirectionTokens_ValueProp,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ExtraDirectionTokens_Key_KeyProp,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ExtraDirectionTokens,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ExtraStanceTokens_ValueProp_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ExtraStanceTokens_ValueProp,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ExtraStanceTokens_Key_KeyProp,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ExtraStanceTokens,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Class UNanimationEditorSettings Property Definitions *****************************
FTypeConstructFunc* UHT_STATICS::DependentSingletons[] = {
	(FTypeConstructFunc*)Z_Construct_UClass_UDeveloperSettings,
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_NanimationEditor,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::DependentSingletons) < 16);
const UECodeGen_Private::FClassParams UHT_STATICS::ClassParams = {
	&Z_Construct_UClass_UNanimationEditorSettings,
	"Editor",
	&StaticCppClassTypeInfo,
	DependentSingletons,
	nullptr,
	UHT_STATICS::PropPointers,
	nullptr,
	UE_ARRAY_COUNT(DependentSingletons),
	0,
	UE_ARRAY_COUNT(UHT_STATICS::PropPointers),
	0,
	0x001000A6u,
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
FClassRegistrationInfo Z_Registration_Info_UClass_UNanimationEditorSettings;
UClass* Z_Construct_UClass_UNanimationEditorSettings(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Inner)
	{
		using TClass = UNanimationEditorSettings;
		if (!Z_Registration_Info_UClass_UNanimationEditorSettings.InnerSingleton)
		{
			GetPrivateStaticClassBody(
				TClass::StaticPackage(),
				TEXT("NanimationEditorSettings"),
				Z_Registration_Info_UClass_UNanimationEditorSettings.InnerSingleton,
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
		return Z_Registration_Info_UClass_UNanimationEditorSettings.InnerSingleton;
	}
	if (!Z_Registration_Info_UClass_UNanimationEditorSettings.OuterSingleton)
	{
		UECodeGen_Private::ConstructUClass(Z_Registration_Info_UClass_UNanimationEditorSettings.OuterSingleton, UHT_STATICS::ClassParams);
	}
	return Z_Registration_Info_UClass_UNanimationEditorSettings.OuterSingleton;
}
#undef UHT_STATICS
UNanimationEditorSettings::UNanimationEditorSettings(const FObjectInitializer& ObjectInitializer) : Super(ObjectInitializer) {}
DEFINE_VTABLE_PTR_HELPER_CTOR_NS(, UNanimationEditorSettings);
UNanimationEditorSettings::~UNanimationEditorSettings() {}
// ********** End Class UNanimationEditorSettings **************************************************

// ********** Begin Registration *******************************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_NanimationEditor_Public_NanimationEditorSettings_h__Script_NanimationEditor_Statics
struct UHT_STATICS
{
	static constexpr FClassRegisterCompiledInInfo ClassInfo[] = {
		{ Z_Construct_UClass_UNanimationEditorSettings, TEXT("UNanimationEditorSettings"), &Z_Registration_Info_UClass_UNanimationEditorSettings, CONSTRUCT_RELOAD_VERSION_INFO(FClassReloadVersionInfo, sizeof(UNanimationEditorSettings), 8017806U) },
	};
}; // UHT_STATICS 
static FRegisterCompiledInInfo Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_NanimationEditor_Public_NanimationEditorSettings_h__Script_NanimationEditor_130d64dff4615144c54da47829dff52a591d7ef6{
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
