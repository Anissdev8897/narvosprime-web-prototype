// Copyright Epic Games, Inc. All Rights Reserved.
/*===========================================================================
	Generated code exported from UnrealHeaderTool.
	DO NOT modify this manually! Edit the corresponding .h files instead!
===========================================================================*/

#include "UObject/GeneratedCppIncludes.h"
#include "NanimationSet.h"
#include "NanimationTypes.h"

PRAGMA_DISABLE_DEPRECATION_WARNINGS
static_assert(!UE_WITH_CONSTINIT_UOBJECT, "This generated code can only be compiled with !UE_WITH_CONSTINIT_UOBJECT");
void EmptyLinkFunctionForGeneratedCodeNanimationSet() {}

// ********** Begin Cross Module References ********************************************************
ENGINE_API UClass* Z_Construct_UClass_UPrimaryDataAsset(ETypeConstructPhase);
// ********** End Cross Module References **********************************************************

// ********** Begin Same Module References *********************************************************
UPackage* Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase);
NANIMATION_API UEnum* Z_Construct_UEnum_Nanimation_ENanimCategory(ETypeConstructPhase);
NANIMATION_API UScriptStruct* Z_Construct_UScriptStruct_FNanimAction(ETypeConstructPhase);
NANIMATION_API UClass* Z_Construct_UClass_UNanimationSet(ETypeConstructPhase);
NANIMATION_API UClass* Z_Construct_UClass_UNanimationSet(ETypeConstructPhase);
// ********** End Same Module References ***********************************************************
#define UHT_STRUCT_BASE(INIT) UE::CodeGen::ConstInit::TCompiledInObjectPtr<const FStructBaseChain>(UE::Private::AsStructBaseChain(INIT))

// ********** Begin Class UNanimationSet Function GetAction ****************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UFunction_UNanimationSet_GetAction_Statics
struct UHT_STATICS
{
	struct NanimationSet_eventGetAction_Parms
	{
		ENanimCategory Category;
		bool bOutFound;
		FNanimAction ReturnValue;
	};
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "Category", "Nanimation|Set" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n\x09 * Returns the action group for a category. bOutFound distinguishes\n\x09 * \"missing\" from \"present but empty\". NOTE: HasAction requires IsValid()\n\x09 * (non-empty), while GetAction's bOutFound only tests presence in the map.\n\x09 * They can differ: HasAction=false && bOutFound=true means the entry exists\n\x09 * but its Variants array is empty.\n\x09 */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationSet.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Returns the action group for a category. bOutFound distinguishes\n\"missing\" from \"present but empty\". NOTE: HasAction requires IsValid()\n(non-empty), while GetAction's bOutFound only tests presence in the map.\nThey can differ: HasAction=false && bOutFound=true means the entry exists\nbut its Variants array is empty." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin Function GetAction constinit property declarations *****************************
	static const UECodeGen_Private::FBytePropertyParams NewProp_Category_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Category;
	static void NewProp_bOutFound_SetBit(void* Obj)
	{
		((NanimationSet_eventGetAction_Parms*)Obj)->bOutFound = 1;
	}
	static const UECodeGen_Private::FBoolPropertyParams NewProp_bOutFound;
	static const UECodeGen_Private::FStructPropertyParams NewProp_ReturnValue;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Function GetAction constinit property declarations *******************************
	static const UECodeGen_Private::FFunctionParams FuncParams;
};

// ********** Begin Function GetAction Property Definitions ****************************************
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Category_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Category = { "Category", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationSet_eventGetAction_Parms, Category), Z_Construct_UEnum_Nanimation_ENanimCategory, METADATA_PARAMS(0, nullptr) }; // aa849c0533a1b8ada989c9b7cd65620151f02da6
const UECodeGen_Private::FBoolPropertyParams UHT_STATICS::NewProp_bOutFound = { "bOutFound", nullptr, (EPropertyFlags)0x0010000000000180, UECodeGen_Private::EPropertyGenFlags::Bool | UECodeGen_Private::EPropertyGenFlags::NativeBool, nullptr, nullptr, 1, sizeof(bool), sizeof(NanimationSet_eventGetAction_Parms), &UHT_STATICS::NewProp_bOutFound_SetBit, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FStructPropertyParams UHT_STATICS::NewProp_ReturnValue = { "ReturnValue", nullptr, (EPropertyFlags)0x0010000000000580, UECodeGen_Private::EPropertyGenFlags::Struct, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationSet_eventGetAction_Parms, ReturnValue), Z_Construct_UScriptStruct_FNanimAction, METADATA_PARAMS(0, nullptr) }; // 436b741e631e47780a8723c4f4535c7e62a8344d
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_bOutFound,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ReturnValue,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Function GetAction Property Definitions ******************************************
const UECodeGen_Private::FFunctionParams UHT_STATICS::FuncParams = { { (FTypeConstructFunc*)Z_Construct_UClass_UNanimationSet, nullptr, "GetAction", UHT_STATICS::PropPointers, UE_ARRAY_COUNT(UHT_STATICS::PropPointers), DataSizeOf<UHT_STATICS::NanimationSet_eventGetAction_Parms>(), RF_Public|RF_Transient|RF_MarkAsNative, (EFunctionFlags)0x54420401, 0, 0, METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)},  };
static_assert(sizeof(UHT_STATICS::NanimationSet_eventGetAction_Parms) < MAX_uint16);
UFunction* Z_Construct_UFunction_UNanimationSet_GetAction(ETypeConstructPhase Phase)
{
	static UFunction* ReturnFunction = nullptr;
	if (!ReturnFunction)
	{
		UECodeGen_Private::ConstructUFunction(&ReturnFunction, UHT_STATICS::FuncParams);
	}
	return ReturnFunction;
}
#undef UHT_STATICS
DEFINE_FUNCTION(UNanimationSet::execGetAction)
{
	P_GET_ENUM(ENanimCategory,Z_Param_Category);
	P_GET_UBOOL_REF(Z_Param_Out_bOutFound);
	P_FINISH;
	P_NATIVE_BEGIN;
	*(FNanimAction*)Z_Param__Result=P_THIS->GetAction(ENanimCategory(Z_Param_Category),Z_Param_Out_bOutFound);
	P_NATIVE_END;
}
// ********** End Class UNanimationSet Function GetAction ******************************************

// ********** Begin Class UNanimationSet Function HasAction ****************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UFunction_UNanimationSet_HasAction_Statics
struct UHT_STATICS
{
	struct NanimationSet_eventHasAction_Parms
	{
		ENanimCategory Category;
		bool ReturnValue;
	};
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "Category", "Nanimation|Set" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** True if a (non-empty) action group exists for the category. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationSet.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "True if a (non-empty) action group exists for the category." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin Function HasAction constinit property declarations *****************************
	static const UECodeGen_Private::FBytePropertyParams NewProp_Category_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Category;
	static void NewProp_ReturnValue_SetBit(void* Obj)
	{
		((NanimationSet_eventHasAction_Parms*)Obj)->ReturnValue = 1;
	}
	static const UECodeGen_Private::FBoolPropertyParams NewProp_ReturnValue;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Function HasAction constinit property declarations *******************************
	static const UECodeGen_Private::FFunctionParams FuncParams;
};

// ********** Begin Function HasAction Property Definitions ****************************************
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Category_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Category = { "Category", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationSet_eventHasAction_Parms, Category), Z_Construct_UEnum_Nanimation_ENanimCategory, METADATA_PARAMS(0, nullptr) }; // aa849c0533a1b8ada989c9b7cd65620151f02da6
const UECodeGen_Private::FBoolPropertyParams UHT_STATICS::NewProp_ReturnValue = { "ReturnValue", nullptr, (EPropertyFlags)0x0010000000000580, UECodeGen_Private::EPropertyGenFlags::Bool | UECodeGen_Private::EPropertyGenFlags::NativeBool, nullptr, nullptr, 1, sizeof(bool), sizeof(NanimationSet_eventHasAction_Parms), &UHT_STATICS::NewProp_ReturnValue_SetBit, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ReturnValue,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Function HasAction Property Definitions ******************************************
const UECodeGen_Private::FFunctionParams UHT_STATICS::FuncParams = { { (FTypeConstructFunc*)Z_Construct_UClass_UNanimationSet, nullptr, "HasAction", UHT_STATICS::PropPointers, UE_ARRAY_COUNT(UHT_STATICS::PropPointers), DataSizeOf<UHT_STATICS::NanimationSet_eventHasAction_Parms>(), RF_Public|RF_Transient|RF_MarkAsNative, (EFunctionFlags)0x54020401, 0, 0, METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)},  };
static_assert(sizeof(UHT_STATICS::NanimationSet_eventHasAction_Parms) < MAX_uint16);
UFunction* Z_Construct_UFunction_UNanimationSet_HasAction(ETypeConstructPhase Phase)
{
	static UFunction* ReturnFunction = nullptr;
	if (!ReturnFunction)
	{
		UECodeGen_Private::ConstructUFunction(&ReturnFunction, UHT_STATICS::FuncParams);
	}
	return ReturnFunction;
}
#undef UHT_STATICS
DEFINE_FUNCTION(UNanimationSet::execHasAction)
{
	P_GET_ENUM(ENanimCategory,Z_Param_Category);
	P_FINISH;
	P_NATIVE_BEGIN;
	*(bool*)Z_Param__Result=P_THIS->HasAction(ENanimCategory(Z_Param_Category));
	P_NATIVE_END;
}
// ********** End Class UNanimationSet Function HasAction ******************************************

// ********** Begin Class UNanimationSet ***********************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UClass_UNanimationSet_Statics
struct UHT_STATICS
{
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "BlueprintType", "true" },
		{ "IncludePath", "NanimationSet.h" },
		{ "ModuleRelativePath", "Public/NanimationSet.h" },
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Actions_MetaData[] = {
		{ "Category", "Nanimation|Set" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** The core data table. One action group per category. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationSet.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "The core data table. One action group per category." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_SetName_MetaData[] = {
		{ "Category", "Nanimation|Set" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n\x09 * Optional human label / config name used purely for tooling & logging.\n\x09 * NOTE: this is set by the scanner to match the asset name. It is not read\n\x09 * at runtime; the UObject's GetFName() is the canonical name.\n\x09 */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationSet.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Optional human label / config name used purely for tooling & logging.\nNOTE: this is set by the scanner to match the asset name. It is not read\nat runtime; the UObject's GetFName() is the canonical name." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin Class UNanimationSet constinit property declarations ***************************
	static const UECodeGen_Private::FStructPropertyParams NewProp_Actions_ValueProp;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Actions_Key_KeyProp_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Actions_Key_KeyProp;
	static const UECodeGen_Private::FMapPropertyParams NewProp_Actions;
	static const UECodeGen_Private::FNamePropertyParams NewProp_SetName;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Class UNanimationSet constinit property declarations *****************************
	static constexpr UE::CodeGen::FClassNativeFunction Funcs[] = {
		{ .NameUTF8 = UTF8TEXT("GetAction"), .Pointer = &UNanimationSet::execGetAction },
		{ .NameUTF8 = UTF8TEXT("HasAction"), .Pointer = &UNanimationSet::execHasAction },
	};
	static FTypeConstructFunc* DependentSingletons[];
	static constexpr FClassFunctionLinkInfo FuncInfo[] = {
		{ &Z_Construct_UFunction_UNanimationSet_GetAction, "GetAction" }, // e793437a26620b70db9b5faf2fb6537f9e019cc6
		{ &Z_Construct_UFunction_UNanimationSet_HasAction, "HasAction" }, // 58abf40af320cdddb9841c0629bcc235340a827e
	};
	static_assert(UE_ARRAY_COUNT(FuncInfo) < 2048);
	static constexpr FCppClassTypeInfoStatic StaticCppClassTypeInfo = {
		TCppClassTypeTraits<UNanimationSet>::IsAbstract,
	};
	static const UECodeGen_Private::FClassParams ClassParams;
}; // struct UHT_STATICS

// ********** Begin Class UNanimationSet Property Definitions **************************************
const UECodeGen_Private::FStructPropertyParams UHT_STATICS::NewProp_Actions_ValueProp = { "Actions", nullptr, (EPropertyFlags)0x0000000000000001, UECodeGen_Private::EPropertyGenFlags::Struct, nullptr, nullptr, 1, 1, Z_Construct_UScriptStruct_FNanimAction, METADATA_PARAMS(0, nullptr) }; // 436b741e631e47780a8723c4f4535c7e62a8344d
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Actions_Key_KeyProp_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Actions_Key_KeyProp = { "Actions_Key", nullptr, (EPropertyFlags)0x0000000000000001, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, 0, Z_Construct_UEnum_Nanimation_ENanimCategory, METADATA_PARAMS(0, nullptr) }; // aa849c0533a1b8ada989c9b7cd65620151f02da6
const UECodeGen_Private::FMapPropertyParams UHT_STATICS::NewProp_Actions = { "Actions", nullptr, (EPropertyFlags)0x0010000000000015, UECodeGen_Private::EPropertyGenFlags::Map, nullptr, nullptr, 1, STRUCT_OFFSET(UNanimationSet, Actions), EMapPropertyFlags::None, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Actions_MetaData), NewProp_Actions_MetaData) }; // aa849c0533a1b8ada989c9b7cd65620151f02da6 436b741e631e47780a8723c4f4535c7e62a8344d
const UECodeGen_Private::FNamePropertyParams UHT_STATICS::NewProp_SetName = { "SetName", nullptr, (EPropertyFlags)0x0010000000000015, UECodeGen_Private::EPropertyGenFlags::Name, nullptr, nullptr, 1, STRUCT_OFFSET(UNanimationSet, SetName), METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_SetName_MetaData), NewProp_SetName_MetaData) };
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Actions_ValueProp,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Actions_Key_KeyProp_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Actions_Key_KeyProp,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Actions,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_SetName,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Class UNanimationSet Property Definitions ****************************************
FTypeConstructFunc* UHT_STATICS::DependentSingletons[] = {
	(FTypeConstructFunc*)Z_Construct_UClass_UPrimaryDataAsset,
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_Nanimation,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::DependentSingletons) < 16);
const UECodeGen_Private::FClassParams UHT_STATICS::ClassParams = {
	&Z_Construct_UClass_UNanimationSet,
	nullptr,
	&StaticCppClassTypeInfo,
	DependentSingletons,
	FuncInfo,
	UHT_STATICS::PropPointers,
	nullptr,
	UE_ARRAY_COUNT(DependentSingletons),
	UE_ARRAY_COUNT(FuncInfo),
	UE_ARRAY_COUNT(UHT_STATICS::PropPointers),
	0,
	0x001000A0u,
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
static void UNanimationSet_StaticRegisterNativesUNanimationSet()
{
	UClass* Class = UNanimationSet::StaticClass();
	FNativeFunctionRegistrar::RegisterFunctions(Class, 		MakeConstArrayView(UHT_STATICS::Funcs));
}
FClassRegistrationInfo Z_Registration_Info_UClass_UNanimationSet;
UClass* Z_Construct_UClass_UNanimationSet(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Inner)
	{
		using TClass = UNanimationSet;
		if (!Z_Registration_Info_UClass_UNanimationSet.InnerSingleton)
		{
			GetPrivateStaticClassBody(
				TClass::StaticPackage(),
				TEXT("NanimationSet"),
				Z_Registration_Info_UClass_UNanimationSet.InnerSingleton,
				UNanimationSet_StaticRegisterNativesUNanimationSet,
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
		return Z_Registration_Info_UClass_UNanimationSet.InnerSingleton;
	}
	if (!Z_Registration_Info_UClass_UNanimationSet.OuterSingleton)
	{
		UECodeGen_Private::ConstructUClass(Z_Registration_Info_UClass_UNanimationSet.OuterSingleton, UHT_STATICS::ClassParams);
	}
	return Z_Registration_Info_UClass_UNanimationSet.OuterSingleton;
}
#undef UHT_STATICS
UNanimationSet::UNanimationSet(const FObjectInitializer& ObjectInitializer) : Super(ObjectInitializer) {}
DEFINE_VTABLE_PTR_HELPER_CTOR_NS(, UNanimationSet);
UNanimationSet::~UNanimationSet() {}
// ********** End Class UNanimationSet *************************************************************

// ********** Begin Registration *******************************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationSet_h__Script_Nanimation_Statics
struct UHT_STATICS
{
	static constexpr FClassRegisterCompiledInInfo ClassInfo[] = {
		{ Z_Construct_UClass_UNanimationSet, TEXT("UNanimationSet"), &Z_Registration_Info_UClass_UNanimationSet, CONSTRUCT_RELOAD_VERSION_INFO(FClassReloadVersionInfo, sizeof(UNanimationSet), 2673168771U) },
	};
}; // UHT_STATICS 
static FRegisterCompiledInInfo Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationSet_h__Script_Nanimation_3e3cdc792345aca5d4e7fe9dd31348fbf9e02e76{
	TEXT("/Script/Nanimation"),
	UHT_STATICS::ClassInfo, UE_ARRAY_COUNT(UHT_STATICS::ClassInfo),
	nullptr, 0,
	nullptr, 0,
	nullptr, 0,
};
#undef UHT_STATICS
// ********** End Registration *********************************************************************
#undef UHT_STRUCT_BASE

PRAGMA_ENABLE_DEPRECATION_WARNINGS
