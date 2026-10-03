// Copyright Epic Games, Inc. All Rights Reserved.
/*===========================================================================
	Generated code exported from UnrealHeaderTool.
	DO NOT modify this manually! Edit the corresponding .h files instead!
===========================================================================*/

#include "UObject/GeneratedCppIncludes.h"
#include "NanimEditorLibrary.h"

PRAGMA_DISABLE_DEPRECATION_WARNINGS
static_assert(!UE_WITH_CONSTINIT_UOBJECT, "This generated code can only be compiled with !UE_WITH_CONSTINIT_UOBJECT");
void EmptyLinkFunctionForGeneratedCodeNanimEditorLibrary() {}

// ********** Begin Cross Module References ********************************************************
ENGINE_API UClass* Z_Construct_UClass_UBlueprintFunctionLibrary(ETypeConstructPhase);
NANIMATION_API UClass* Z_Construct_UClass_UNanimationSet(ETypeConstructPhase);
// ********** End Cross Module References **********************************************************

// ********** Begin Same Module References *********************************************************
UPackage* Z_Construct_UPackage__Script_NanimationEditor(ETypeConstructPhase);
NANIMATIONEDITOR_API UClass* Z_Construct_UClass_UNanimEditorLibrary(ETypeConstructPhase);
NANIMATIONEDITOR_API UClass* Z_Construct_UClass_UNanimEditorLibrary(ETypeConstructPhase);
// ********** End Same Module References ***********************************************************
#define UHT_STRUCT_BASE(INIT) UE::CodeGen::ConstInit::TCompiledInObjectPtr<const FStructBaseChain>(UE::Private::AsStructBaseChain(INIT))

// ********** Begin Class UNanimEditorLibrary Function ExportInventoryCsv **************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UFunction_UNanimEditorLibrary_ExportInventoryCsv_Statics
struct UHT_STATICS
{
	struct NanimEditorLibrary_eventExportInventoryCsv_Parms
	{
		FString SourcePath;
		FString CsvFilePath;
		int32 ReturnValue;
	};
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "Category", "Nanimation|Editor" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n\x09 * Scan only -> write a CSV inventory. Returns the number of rows written,\n\x09 * or -1 on file write failure.\n\x09 */" },
#endif
		{ "ModuleRelativePath", "Public/NanimEditorLibrary.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Scan only -> write a CSV inventory. Returns the number of rows written,\nor -1 on file write failure." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_SourcePath_MetaData[] = {
		{ "NativeConst", "" },
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_CsvFilePath_MetaData[] = {
		{ "NativeConst", "" },
	};
#endif // WITH_METADATA

// ********** Begin Function ExportInventoryCsv constinit property declarations ********************
	static const UECodeGen_Private::FStrPropertyParams NewProp_SourcePath;
	static const UECodeGen_Private::FStrPropertyParams NewProp_CsvFilePath;
	static const UECodeGen_Private::FIntPropertyParams NewProp_ReturnValue;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Function ExportInventoryCsv constinit property declarations **********************
	static const UECodeGen_Private::FFunctionParams FuncParams;
};

// ********** Begin Function ExportInventoryCsv Property Definitions *******************************
const UECodeGen_Private::FStrPropertyParams UHT_STATICS::NewProp_SourcePath = { "SourcePath", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Str, nullptr, nullptr, 1, STRUCT_OFFSET(NanimEditorLibrary_eventExportInventoryCsv_Parms, SourcePath), METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_SourcePath_MetaData), NewProp_SourcePath_MetaData) };
const UECodeGen_Private::FStrPropertyParams UHT_STATICS::NewProp_CsvFilePath = { "CsvFilePath", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Str, nullptr, nullptr, 1, STRUCT_OFFSET(NanimEditorLibrary_eventExportInventoryCsv_Parms, CsvFilePath), METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_CsvFilePath_MetaData), NewProp_CsvFilePath_MetaData) };
const UECodeGen_Private::FIntPropertyParams UHT_STATICS::NewProp_ReturnValue = { "ReturnValue", nullptr, (EPropertyFlags)0x0010000000000580, UECodeGen_Private::EPropertyGenFlags::Int, nullptr, nullptr, 1, STRUCT_OFFSET(NanimEditorLibrary_eventExportInventoryCsv_Parms, ReturnValue), METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_SourcePath,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_CsvFilePath,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ReturnValue,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Function ExportInventoryCsv Property Definitions *********************************
const UECodeGen_Private::FFunctionParams UHT_STATICS::FuncParams = { { (FTypeConstructFunc*)Z_Construct_UClass_UNanimEditorLibrary, nullptr, "ExportInventoryCsv", UHT_STATICS::PropPointers, UE_ARRAY_COUNT(UHT_STATICS::PropPointers), DataSizeOf<UHT_STATICS::NanimEditorLibrary_eventExportInventoryCsv_Parms>(), RF_Public|RF_Transient|RF_MarkAsNative, (EFunctionFlags)0x04022401, 0, 0, METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)},  };
static_assert(sizeof(UHT_STATICS::NanimEditorLibrary_eventExportInventoryCsv_Parms) < MAX_uint16);
UFunction* Z_Construct_UFunction_UNanimEditorLibrary_ExportInventoryCsv(ETypeConstructPhase Phase)
{
	static UFunction* ReturnFunction = nullptr;
	if (!ReturnFunction)
	{
		UECodeGen_Private::ConstructUFunction(&ReturnFunction, UHT_STATICS::FuncParams);
	}
	return ReturnFunction;
}
#undef UHT_STATICS
DEFINE_FUNCTION(UNanimEditorLibrary::execExportInventoryCsv)
{
	P_GET_PROPERTY(FStrProperty,Z_Param_SourcePath);
	P_GET_PROPERTY(FStrProperty,Z_Param_CsvFilePath);
	P_FINISH;
	P_NATIVE_BEGIN;
	*(int32*)Z_Param__Result=UNanimEditorLibrary::ExportInventoryCsv(Z_Param_SourcePath,Z_Param_CsvFilePath);
	P_NATIVE_END;
}
// ********** End Class UNanimEditorLibrary Function ExportInventoryCsv ****************************

// ********** Begin Class UNanimEditorLibrary Function GenerateSetFromFolder ***********************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UFunction_UNanimEditorLibrary_GenerateSetFromFolder_Statics
struct UHT_STATICS
{
	struct NanimEditorLibrary_eventGenerateSetFromFolder_Parms
	{
		FString SourcePath;
		FString OutPackagePath;
		FString SetAssetName;
		bool bExportCsv;
		bool bOverwriteExisting;
		UNanimationSet* ReturnValue;
	};
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "Category", "Nanimation|Editor" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n\x09 * Scan a content folder, (optionally) write a CSV inventory, and generate +\n\x09 * save a UNanimationSet. Default behaviour is MERGE (preserves manual edits).\n\x09 *\n\x09 * @param bOverwriteExisting  If true, destroys existing data. Default: false (merge).\n\x09 */" },
#endif
		{ "CPP_Default_bExportCsv", "true" },
		{ "CPP_Default_bOverwriteExisting", "false" },
		{ "ModuleRelativePath", "Public/NanimEditorLibrary.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Scan a content folder, (optionally) write a CSV inventory, and generate +\nsave a UNanimationSet. Default behaviour is MERGE (preserves manual edits).\n\n@param bOverwriteExisting  If true, destroys existing data. Default: false (merge)." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_SourcePath_MetaData[] = {
		{ "NativeConst", "" },
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_OutPackagePath_MetaData[] = {
		{ "NativeConst", "" },
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_SetAssetName_MetaData[] = {
		{ "NativeConst", "" },
	};
#endif // WITH_METADATA

// ********** Begin Function GenerateSetFromFolder constinit property declarations *****************
	static const UECodeGen_Private::FStrPropertyParams NewProp_SourcePath;
	static const UECodeGen_Private::FStrPropertyParams NewProp_OutPackagePath;
	static const UECodeGen_Private::FStrPropertyParams NewProp_SetAssetName;
	static void NewProp_bExportCsv_SetBit(void* Obj)
	{
		((NanimEditorLibrary_eventGenerateSetFromFolder_Parms*)Obj)->bExportCsv = 1;
	}
	static const UECodeGen_Private::FBoolPropertyParams NewProp_bExportCsv;
	static void NewProp_bOverwriteExisting_SetBit(void* Obj)
	{
		((NanimEditorLibrary_eventGenerateSetFromFolder_Parms*)Obj)->bOverwriteExisting = 1;
	}
	static const UECodeGen_Private::FBoolPropertyParams NewProp_bOverwriteExisting;
	static const UECodeGen_Private::FObjectPropertyParams NewProp_ReturnValue;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Function GenerateSetFromFolder constinit property declarations *******************
	static const UECodeGen_Private::FFunctionParams FuncParams;
};

// ********** Begin Function GenerateSetFromFolder Property Definitions ****************************
const UECodeGen_Private::FStrPropertyParams UHT_STATICS::NewProp_SourcePath = { "SourcePath", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Str, nullptr, nullptr, 1, STRUCT_OFFSET(NanimEditorLibrary_eventGenerateSetFromFolder_Parms, SourcePath), METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_SourcePath_MetaData), NewProp_SourcePath_MetaData) };
const UECodeGen_Private::FStrPropertyParams UHT_STATICS::NewProp_OutPackagePath = { "OutPackagePath", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Str, nullptr, nullptr, 1, STRUCT_OFFSET(NanimEditorLibrary_eventGenerateSetFromFolder_Parms, OutPackagePath), METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_OutPackagePath_MetaData), NewProp_OutPackagePath_MetaData) };
const UECodeGen_Private::FStrPropertyParams UHT_STATICS::NewProp_SetAssetName = { "SetAssetName", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Str, nullptr, nullptr, 1, STRUCT_OFFSET(NanimEditorLibrary_eventGenerateSetFromFolder_Parms, SetAssetName), METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_SetAssetName_MetaData), NewProp_SetAssetName_MetaData) };
const UECodeGen_Private::FBoolPropertyParams UHT_STATICS::NewProp_bExportCsv = { "bExportCsv", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Bool | UECodeGen_Private::EPropertyGenFlags::NativeBool, nullptr, nullptr, 1, sizeof(bool), sizeof(NanimEditorLibrary_eventGenerateSetFromFolder_Parms), &UHT_STATICS::NewProp_bExportCsv_SetBit, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FBoolPropertyParams UHT_STATICS::NewProp_bOverwriteExisting = { "bOverwriteExisting", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Bool | UECodeGen_Private::EPropertyGenFlags::NativeBool, nullptr, nullptr, 1, sizeof(bool), sizeof(NanimEditorLibrary_eventGenerateSetFromFolder_Parms), &UHT_STATICS::NewProp_bOverwriteExisting_SetBit, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FObjectPropertyParams UHT_STATICS::NewProp_ReturnValue = { "ReturnValue", nullptr, (EPropertyFlags)0x0010000000000580, UECodeGen_Private::EPropertyGenFlags::Object, nullptr, nullptr, 1, STRUCT_OFFSET(NanimEditorLibrary_eventGenerateSetFromFolder_Parms, ReturnValue), Z_Construct_UClass_UNanimationSet, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_SourcePath,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_OutPackagePath,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_SetAssetName,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_bExportCsv,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_bOverwriteExisting,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ReturnValue,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Function GenerateSetFromFolder Property Definitions ******************************
const UECodeGen_Private::FFunctionParams UHT_STATICS::FuncParams = { { (FTypeConstructFunc*)Z_Construct_UClass_UNanimEditorLibrary, nullptr, "GenerateSetFromFolder", UHT_STATICS::PropPointers, UE_ARRAY_COUNT(UHT_STATICS::PropPointers), DataSizeOf<UHT_STATICS::NanimEditorLibrary_eventGenerateSetFromFolder_Parms>(), RF_Public|RF_Transient|RF_MarkAsNative, (EFunctionFlags)0x04022401, 0, 0, METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)},  };
static_assert(sizeof(UHT_STATICS::NanimEditorLibrary_eventGenerateSetFromFolder_Parms) < MAX_uint16);
UFunction* Z_Construct_UFunction_UNanimEditorLibrary_GenerateSetFromFolder(ETypeConstructPhase Phase)
{
	static UFunction* ReturnFunction = nullptr;
	if (!ReturnFunction)
	{
		UECodeGen_Private::ConstructUFunction(&ReturnFunction, UHT_STATICS::FuncParams);
	}
	return ReturnFunction;
}
#undef UHT_STATICS
DEFINE_FUNCTION(UNanimEditorLibrary::execGenerateSetFromFolder)
{
	P_GET_PROPERTY(FStrProperty,Z_Param_SourcePath);
	P_GET_PROPERTY(FStrProperty,Z_Param_OutPackagePath);
	P_GET_PROPERTY(FStrProperty,Z_Param_SetAssetName);
	P_GET_UBOOL(Z_Param_bExportCsv);
	P_GET_UBOOL(Z_Param_bOverwriteExisting);
	P_FINISH;
	P_NATIVE_BEGIN;
	*(UNanimationSet**)Z_Param__Result=UNanimEditorLibrary::GenerateSetFromFolder(Z_Param_SourcePath,Z_Param_OutPackagePath,Z_Param_SetAssetName,Z_Param_bExportCsv,Z_Param_bOverwriteExisting);
	P_NATIVE_END;
}
// ********** End Class UNanimEditorLibrary Function GenerateSetFromFolder *************************

// ********** Begin Class UNanimEditorLibrary ******************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UClass_UNanimEditorLibrary_Statics
struct UHT_STATICS
{
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "IncludePath", "NanimEditorLibrary.h" },
		{ "ModuleRelativePath", "Public/NanimEditorLibrary.h" },
	};
#endif // WITH_METADATA

// ********** Begin Class UNanimEditorLibrary constinit property declarations **********************
// ********** End Class UNanimEditorLibrary constinit property declarations ************************
	static constexpr UE::CodeGen::FClassNativeFunction Funcs[] = {
		{ .NameUTF8 = UTF8TEXT("ExportInventoryCsv"), .Pointer = &UNanimEditorLibrary::execExportInventoryCsv },
		{ .NameUTF8 = UTF8TEXT("GenerateSetFromFolder"), .Pointer = &UNanimEditorLibrary::execGenerateSetFromFolder },
	};
	static FTypeConstructFunc* DependentSingletons[];
	static constexpr FClassFunctionLinkInfo FuncInfo[] = {
		{ &Z_Construct_UFunction_UNanimEditorLibrary_ExportInventoryCsv, "ExportInventoryCsv" }, // 6cb0b1fc7ceceb262a07e0976a41fb05f0eadc13
		{ &Z_Construct_UFunction_UNanimEditorLibrary_GenerateSetFromFolder, "GenerateSetFromFolder" }, // 6b693ada4d517228885dac3156958c483c915a66
	};
	static_assert(UE_ARRAY_COUNT(FuncInfo) < 2048);
	static constexpr FCppClassTypeInfoStatic StaticCppClassTypeInfo = {
		TCppClassTypeTraits<UNanimEditorLibrary>::IsAbstract,
	};
	static const UECodeGen_Private::FClassParams ClassParams;
}; // struct UHT_STATICS
FTypeConstructFunc* UHT_STATICS::DependentSingletons[] = {
	(FTypeConstructFunc*)Z_Construct_UClass_UBlueprintFunctionLibrary,
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_NanimationEditor,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::DependentSingletons) < 16);
const UECodeGen_Private::FClassParams UHT_STATICS::ClassParams = {
	&Z_Construct_UClass_UNanimEditorLibrary,
	nullptr,
	&StaticCppClassTypeInfo,
	DependentSingletons,
	FuncInfo,
	nullptr,
	nullptr,
	UE_ARRAY_COUNT(DependentSingletons),
	UE_ARRAY_COUNT(FuncInfo),
	0,
	0,
	0x001000A0u,
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
static void UNanimEditorLibrary_StaticRegisterNativesUNanimEditorLibrary()
{
	UClass* Class = UNanimEditorLibrary::StaticClass();
	FNativeFunctionRegistrar::RegisterFunctions(Class, 		MakeConstArrayView(UHT_STATICS::Funcs));
}
FClassRegistrationInfo Z_Registration_Info_UClass_UNanimEditorLibrary;
UClass* Z_Construct_UClass_UNanimEditorLibrary(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Inner)
	{
		using TClass = UNanimEditorLibrary;
		if (!Z_Registration_Info_UClass_UNanimEditorLibrary.InnerSingleton)
		{
			GetPrivateStaticClassBody(
				TClass::StaticPackage(),
				TEXT("NanimEditorLibrary"),
				Z_Registration_Info_UClass_UNanimEditorLibrary.InnerSingleton,
				UNanimEditorLibrary_StaticRegisterNativesUNanimEditorLibrary,
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
		return Z_Registration_Info_UClass_UNanimEditorLibrary.InnerSingleton;
	}
	if (!Z_Registration_Info_UClass_UNanimEditorLibrary.OuterSingleton)
	{
		UECodeGen_Private::ConstructUClass(Z_Registration_Info_UClass_UNanimEditorLibrary.OuterSingleton, UHT_STATICS::ClassParams);
	}
	return Z_Registration_Info_UClass_UNanimEditorLibrary.OuterSingleton;
}
#undef UHT_STATICS
UNanimEditorLibrary::UNanimEditorLibrary(const FObjectInitializer& ObjectInitializer) : Super(ObjectInitializer) {}
DEFINE_VTABLE_PTR_HELPER_CTOR_NS(, UNanimEditorLibrary);
UNanimEditorLibrary::~UNanimEditorLibrary() {}
// ********** End Class UNanimEditorLibrary ********************************************************

// ********** Begin Registration *******************************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_NanimationEditor_Public_NanimEditorLibrary_h__Script_NanimationEditor_Statics
struct UHT_STATICS
{
	static constexpr FClassRegisterCompiledInInfo ClassInfo[] = {
		{ Z_Construct_UClass_UNanimEditorLibrary, TEXT("UNanimEditorLibrary"), &Z_Registration_Info_UClass_UNanimEditorLibrary, CONSTRUCT_RELOAD_VERSION_INFO(FClassReloadVersionInfo, sizeof(UNanimEditorLibrary), 2582617918U) },
	};
}; // UHT_STATICS 
static FRegisterCompiledInInfo Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_NanimationEditor_Public_NanimEditorLibrary_h__Script_NanimationEditor_4366ee17ec350bc7c2c90a5e1483315195f9e100{
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
