// Copyright Epic Games, Inc. All Rights Reserved.
/*===========================================================================
	Generated code exported from UnrealHeaderTool.
	DO NOT modify this manually! Edit the corresponding .h files instead!
===========================================================================*/

#include "UObject/GeneratedCppIncludes.h"
#include "NanimationComponent.h"
#include "NanimationTypes.h"
#include "UObject/CoreNet.h"

PRAGMA_DISABLE_DEPRECATION_WARNINGS
static_assert(!UE_WITH_CONSTINIT_UOBJECT, "This generated code can only be compiled with !UE_WITH_CONSTINIT_UOBJECT");
void EmptyLinkFunctionForGeneratedCodeNanimationComponent() {}

// ********** Begin Cross Module References ********************************************************
ENGINE_API UClass* Z_Construct_UClass_UActorComponent(ETypeConstructPhase);
// ********** End Cross Module References **********************************************************

// ********** Begin Same Module References *********************************************************
UPackage* Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase);
NANIMATION_API UEnum* Z_Construct_UEnum_Nanimation_ENanimCategory(ETypeConstructPhase);
NANIMATION_API UEnum* Z_Construct_UEnum_Nanimation_ENanimDirection(ETypeConstructPhase);
NANIMATION_API UEnum* Z_Construct_UEnum_Nanimation_ENanimStance(ETypeConstructPhase);
NANIMATION_API UScriptStruct* Z_Construct_UScriptStruct_FNanimActionPulse(ETypeConstructPhase);
NANIMATION_API UScriptStruct* Z_Construct_UScriptStruct_FNanimVariant(ETypeConstructPhase);
NANIMATION_API UClass* Z_Construct_UClass_UNanimationComponent(ETypeConstructPhase);
NANIMATION_API UFunction* Z_Construct_UDelegateFunction_Nanimation_OnNanimVariantChosen__DelegateSignature(ETypeConstructPhase);
NANIMATION_API UClass* Z_Construct_UClass_UNanimationComponent(ETypeConstructPhase);
NANIMATION_API UClass* Z_Construct_UClass_UNanimationSet(ETypeConstructPhase);
// ********** End Same Module References ***********************************************************
#define UHT_STRUCT_BASE(INIT) UE::CodeGen::ConstInit::TCompiledInObjectPtr<const FStructBaseChain>(UE::Private::AsStructBaseChain(INIT))

// ********** Begin Delegate FOnNanimVariantChosen *************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UDelegateFunction_Nanimation_OnNanimVariantChosen__DelegateSignature_Statics
struct UHT_STATICS
{
	struct _Script_Nanimation_eventOnNanimVariantChosen_Parms
	{
		ENanimCategory Category;
		FNanimVariant Variant;
	};
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Broadcast when a category resolves to a concrete variant (after async load).\n *  UI / character BP binds this to actually play the chosen anim. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationComponent.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Broadcast when a category resolves to a concrete variant (after async load).\nUI / character BP binds this to actually play the chosen anim." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin Delegate FOnNanimVariantChosen constinit property declarations *****************
	static const UECodeGen_Private::FBytePropertyParams NewProp_Category_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Category;
	static const UECodeGen_Private::FStructPropertyParams NewProp_Variant;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Delegate FOnNanimVariantChosen constinit property declarations *******************
	static const UECodeGen_Private::FDelegateFunctionParams FuncParams;
};

// ********** Begin Delegate FOnNanimVariantChosen Property Definitions ****************************
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Category_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Category = { "Category", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(_Script_Nanimation_eventOnNanimVariantChosen_Parms, Category), Z_Construct_UEnum_Nanimation_ENanimCategory, METADATA_PARAMS(0, nullptr) }; // aa849c0533a1b8ada989c9b7cd65620151f02da6
const UECodeGen_Private::FStructPropertyParams UHT_STATICS::NewProp_Variant = { "Variant", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Struct, nullptr, nullptr, 1, STRUCT_OFFSET(_Script_Nanimation_eventOnNanimVariantChosen_Parms, Variant), Z_Construct_UScriptStruct_FNanimVariant, METADATA_PARAMS(0, nullptr) }; // 58696e072a219f4dc97076853fd1b508ff301064
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Variant,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Delegate FOnNanimVariantChosen Property Definitions ******************************
const UECodeGen_Private::FDelegateFunctionParams UHT_STATICS::FuncParams = { { (FTypeConstructFunc*)Z_Construct_UPackage__Script_Nanimation, nullptr, "OnNanimVariantChosen__DelegateSignature", UHT_STATICS::PropPointers, UE_ARRAY_COUNT(UHT_STATICS::PropPointers), DataSizeOf<UHT_STATICS::_Script_Nanimation_eventOnNanimVariantChosen_Parms>(), RF_Public|RF_Transient|RF_MarkAsNative, (EFunctionFlags)0x00130000, 0, 0, METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)},  };
static_assert(sizeof(UHT_STATICS::_Script_Nanimation_eventOnNanimVariantChosen_Parms) < MAX_uint16);
UFunction* Z_Construct_UDelegateFunction_Nanimation_OnNanimVariantChosen__DelegateSignature(ETypeConstructPhase Phase)
{
	static UFunction* ReturnFunction = nullptr;
	if (!ReturnFunction)
	{
		UECodeGen_Private::ConstructUDelegateFunction(&ReturnFunction, UHT_STATICS::FuncParams);
	}
	return ReturnFunction;
}
#undef UHT_STATICS
// ********** End Delegate FOnNanimVariantChosen ***************************************************

// ********** Begin Class UNanimationComponent Function OnRep_ActionPulses *************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UFunction_UNanimationComponent_OnRep_ActionPulses_Statics
struct UHT_STATICS
{
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** RepNotify: re-derive picks for every pulse whose DrawCount changed. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationComponent.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "RepNotify: re-derive picks for every pulse whose DrawCount changed." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin Function OnRep_ActionPulses constinit property declarations ********************
// ********** End Function OnRep_ActionPulses constinit property declarations **********************
	static const UECodeGen_Private::FFunctionParams FuncParams;
};
const UECodeGen_Private::FFunctionParams UHT_STATICS::FuncParams = { { (FTypeConstructFunc*)Z_Construct_UClass_UNanimationComponent, nullptr, "OnRep_ActionPulses", nullptr, 0, 0, RF_Public|RF_Transient|RF_MarkAsNative, (EFunctionFlags)0x00080401, 0, 0, METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)},  };
UFunction* Z_Construct_UFunction_UNanimationComponent_OnRep_ActionPulses(ETypeConstructPhase Phase)
{
	static UFunction* ReturnFunction = nullptr;
	if (!ReturnFunction)
	{
		UECodeGen_Private::ConstructUFunction(&ReturnFunction, UHT_STATICS::FuncParams);
	}
	return ReturnFunction;
}
#undef UHT_STATICS
DEFINE_FUNCTION(UNanimationComponent::execOnRep_ActionPulses)
{
	P_FINISH;
	P_NATIVE_BEGIN;
	P_THIS->OnRep_ActionPulses();
	P_NATIVE_END;
}
// ********** End Class UNanimationComponent Function OnRep_ActionPulses ***************************

// ********** Begin Class UNanimationComponent Function OnRep_ActiveSet ****************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UFunction_UNanimationComponent_OnRep_ActiveSet_Statics
struct UHT_STATICS
{
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** RepNotify for ActiveSet: log + re-derive pending pulses. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationComponent.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "RepNotify for ActiveSet: log + re-derive pending pulses." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin Function OnRep_ActiveSet constinit property declarations ***********************
// ********** End Function OnRep_ActiveSet constinit property declarations *************************
	static const UECodeGen_Private::FFunctionParams FuncParams;
};
const UECodeGen_Private::FFunctionParams UHT_STATICS::FuncParams = { { (FTypeConstructFunc*)Z_Construct_UClass_UNanimationComponent, nullptr, "OnRep_ActiveSet", nullptr, 0, 0, RF_Public|RF_Transient|RF_MarkAsNative, (EFunctionFlags)0x00080401, 0, 0, METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)},  };
UFunction* Z_Construct_UFunction_UNanimationComponent_OnRep_ActiveSet(ETypeConstructPhase Phase)
{
	static UFunction* ReturnFunction = nullptr;
	if (!ReturnFunction)
	{
		UECodeGen_Private::ConstructUFunction(&ReturnFunction, UHT_STATICS::FuncParams);
	}
	return ReturnFunction;
}
#undef UHT_STATICS
DEFINE_FUNCTION(UNanimationComponent::execOnRep_ActiveSet)
{
	P_FINISH;
	P_NATIVE_BEGIN;
	P_THIS->OnRep_ActiveSet();
	P_NATIVE_END;
}
// ********** End Class UNanimationComponent Function OnRep_ActiveSet ******************************

// ********** Begin Class UNanimationComponent Function PlayLocalCosmetic **************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UFunction_UNanimationComponent_PlayLocalCosmetic_Statics
struct UHT_STATICS
{
	struct NanimationComponent_eventPlayLocalCosmetic_Parms
	{
		ENanimCategory Category;
	};
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "Category", "Nanimation" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n\x09 * LOCAL cosmetic pick. Never touches the network.\n\x09 */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationComponent.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "LOCAL cosmetic pick. Never touches the network." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin Function PlayLocalCosmetic constinit property declarations *********************
	static const UECodeGen_Private::FBytePropertyParams NewProp_Category_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Category;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Function PlayLocalCosmetic constinit property declarations ***********************
	static const UECodeGen_Private::FFunctionParams FuncParams;
};

// ********** Begin Function PlayLocalCosmetic Property Definitions ********************************
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Category_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Category = { "Category", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationComponent_eventPlayLocalCosmetic_Parms, Category), Z_Construct_UEnum_Nanimation_ENanimCategory, METADATA_PARAMS(0, nullptr) }; // aa849c0533a1b8ada989c9b7cd65620151f02da6
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Function PlayLocalCosmetic Property Definitions **********************************
const UECodeGen_Private::FFunctionParams UHT_STATICS::FuncParams = { { (FTypeConstructFunc*)Z_Construct_UClass_UNanimationComponent, nullptr, "PlayLocalCosmetic", UHT_STATICS::PropPointers, UE_ARRAY_COUNT(UHT_STATICS::PropPointers), DataSizeOf<UHT_STATICS::NanimationComponent_eventPlayLocalCosmetic_Parms>(), RF_Public|RF_Transient|RF_MarkAsNative, (EFunctionFlags)0x04020401, 0, 0, METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)},  };
static_assert(sizeof(UHT_STATICS::NanimationComponent_eventPlayLocalCosmetic_Parms) < MAX_uint16);
UFunction* Z_Construct_UFunction_UNanimationComponent_PlayLocalCosmetic(ETypeConstructPhase Phase)
{
	static UFunction* ReturnFunction = nullptr;
	if (!ReturnFunction)
	{
		UECodeGen_Private::ConstructUFunction(&ReturnFunction, UHT_STATICS::FuncParams);
	}
	return ReturnFunction;
}
#undef UHT_STATICS
DEFINE_FUNCTION(UNanimationComponent::execPlayLocalCosmetic)
{
	P_GET_ENUM(ENanimCategory,Z_Param_Category);
	P_FINISH;
	P_NATIVE_BEGIN;
	P_THIS->PlayLocalCosmetic(ENanimCategory(Z_Param_Category));
	P_NATIVE_END;
}
// ********** End Class UNanimationComponent Function PlayLocalCosmetic ****************************

// ********** Begin Class UNanimationComponent Function RequestAction ******************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UFunction_UNanimationComponent_RequestAction_Statics
struct UHT_STATICS
{
	struct NanimationComponent_eventRequestAction_Parms
	{
		ENanimCategory Category;
	};
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "Category", "Nanimation" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n\x09 * REQUEST a new pick for a category. Routing is decided from the category's\n\x09 * FNanimAction.NetMode.\n\x09 */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationComponent.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "REQUEST a new pick for a category. Routing is decided from the category's\nFNanimAction.NetMode." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin Function RequestAction constinit property declarations *************************
	static const UECodeGen_Private::FBytePropertyParams NewProp_Category_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Category;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Function RequestAction constinit property declarations ***************************
	static const UECodeGen_Private::FFunctionParams FuncParams;
};

// ********** Begin Function RequestAction Property Definitions ************************************
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Category_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Category = { "Category", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationComponent_eventRequestAction_Parms, Category), Z_Construct_UEnum_Nanimation_ENanimCategory, METADATA_PARAMS(0, nullptr) }; // aa849c0533a1b8ada989c9b7cd65620151f02da6
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Function RequestAction Property Definitions **************************************
const UECodeGen_Private::FFunctionParams UHT_STATICS::FuncParams = { { (FTypeConstructFunc*)Z_Construct_UClass_UNanimationComponent, nullptr, "RequestAction", UHT_STATICS::PropPointers, UE_ARRAY_COUNT(UHT_STATICS::PropPointers), DataSizeOf<UHT_STATICS::NanimationComponent_eventRequestAction_Parms>(), RF_Public|RF_Transient|RF_MarkAsNative, (EFunctionFlags)0x04020401, 0, 0, METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)},  };
static_assert(sizeof(UHT_STATICS::NanimationComponent_eventRequestAction_Parms) < MAX_uint16);
UFunction* Z_Construct_UFunction_UNanimationComponent_RequestAction(ETypeConstructPhase Phase)
{
	static UFunction* ReturnFunction = nullptr;
	if (!ReturnFunction)
	{
		UECodeGen_Private::ConstructUFunction(&ReturnFunction, UHT_STATICS::FuncParams);
	}
	return ReturnFunction;
}
#undef UHT_STATICS
DEFINE_FUNCTION(UNanimationComponent::execRequestAction)
{
	P_GET_ENUM(ENanimCategory,Z_Param_Category);
	P_FINISH;
	P_NATIVE_BEGIN;
	P_THIS->RequestAction(ENanimCategory(Z_Param_Category));
	P_NATIVE_END;
}
// ********** End Class UNanimationComponent Function RequestAction ********************************

// ********** Begin Class UNanimationComponent Function RequestActionWithContext *******************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UFunction_UNanimationComponent_RequestActionWithContext_Statics
struct UHT_STATICS
{
	struct NanimationComponent_eventRequestActionWithContext_Parms
	{
		ENanimCategory Category;
		ENanimDirection Dir;
		ENanimStance Stance;
	};
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "Category", "Nanimation" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n\x09 * REQUEST a new pick with a directional/stance context (for locomotion).\n\x09 * The context travels inside the pulse so all machines filter identically.\n\x09 */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationComponent.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "REQUEST a new pick with a directional/stance context (for locomotion).\nThe context travels inside the pulse so all machines filter identically." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin Function RequestActionWithContext constinit property declarations **************
	static const UECodeGen_Private::FBytePropertyParams NewProp_Category_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Category;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Dir_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Dir;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Stance_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Stance;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Function RequestActionWithContext constinit property declarations ****************
	static const UECodeGen_Private::FFunctionParams FuncParams;
};

// ********** Begin Function RequestActionWithContext Property Definitions *************************
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Category_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Category = { "Category", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationComponent_eventRequestActionWithContext_Parms, Category), Z_Construct_UEnum_Nanimation_ENanimCategory, METADATA_PARAMS(0, nullptr) }; // aa849c0533a1b8ada989c9b7cd65620151f02da6
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Dir_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Dir = { "Dir", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationComponent_eventRequestActionWithContext_Parms, Dir), Z_Construct_UEnum_Nanimation_ENanimDirection, METADATA_PARAMS(0, nullptr) }; // b25cabd55150fca584aaae69fed07d8ad672b0d7
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Stance_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Stance = { "Stance", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationComponent_eventRequestActionWithContext_Parms, Stance), Z_Construct_UEnum_Nanimation_ENanimStance, METADATA_PARAMS(0, nullptr) }; // 39f444116cccb25a5b0e4dc3fbfa9c6314e45569
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Dir_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Dir,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Stance_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Stance,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Function RequestActionWithContext Property Definitions ***************************
const UECodeGen_Private::FFunctionParams UHT_STATICS::FuncParams = { { (FTypeConstructFunc*)Z_Construct_UClass_UNanimationComponent, nullptr, "RequestActionWithContext", UHT_STATICS::PropPointers, UE_ARRAY_COUNT(UHT_STATICS::PropPointers), DataSizeOf<UHT_STATICS::NanimationComponent_eventRequestActionWithContext_Parms>(), RF_Public|RF_Transient|RF_MarkAsNative, (EFunctionFlags)0x04020401, 0, 0, METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)},  };
static_assert(sizeof(UHT_STATICS::NanimationComponent_eventRequestActionWithContext_Parms) < MAX_uint16);
UFunction* Z_Construct_UFunction_UNanimationComponent_RequestActionWithContext(ETypeConstructPhase Phase)
{
	static UFunction* ReturnFunction = nullptr;
	if (!ReturnFunction)
	{
		UECodeGen_Private::ConstructUFunction(&ReturnFunction, UHT_STATICS::FuncParams);
	}
	return ReturnFunction;
}
#undef UHT_STATICS
DEFINE_FUNCTION(UNanimationComponent::execRequestActionWithContext)
{
	P_GET_ENUM(ENanimCategory,Z_Param_Category);
	P_GET_ENUM(ENanimDirection,Z_Param_Dir);
	P_GET_ENUM(ENanimStance,Z_Param_Stance);
	P_FINISH;
	P_NATIVE_BEGIN;
	P_THIS->RequestActionWithContext(ENanimCategory(Z_Param_Category),ENanimDirection(Z_Param_Dir),ENanimStance(Z_Param_Stance));
	P_NATIVE_END;
}
// ********** End Class UNanimationComponent Function RequestActionWithContext *********************

// ********** Begin Class UNanimationComponent Function ServerRequestAction ************************
struct NanimationComponent_eventServerRequestAction_Parms
{
	ENanimCategory Category;
	ENanimDirection Dir;
	ENanimStance Stance;
};
static FName NAME_UNanimationComponent_ServerRequestAction = FName(TEXT("ServerRequestAction"));
void UNanimationComponent::ServerRequestAction(ENanimCategory Category, ENanimDirection Dir, ENanimStance Stance)
{
	NanimationComponent_eventServerRequestAction_Parms Parms;
	Parms.Category=Category;
	Parms.Dir=Dir;
	Parms.Stance=Stance;
	UFunction* Func = FindFunctionChecked(NAME_UNanimationComponent_ServerRequestAction);
	ProcessEvent(Func,&Parms);
}
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UFunction_UNanimationComponent_ServerRequestAction_Statics
struct UHT_STATICS
{
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Server RPC: client asks the authority to advance the pulse for a category.\n\x09 *  Simple anti-spam: rate-limited server-side to at most one accepted\n\x09 *  request per category per tick (see ServerRequestAction_Implementation). */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationComponent.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Server RPC: client asks the authority to advance the pulse for a category.\nSimple anti-spam: rate-limited server-side to at most one accepted\nrequest per category per tick (see ServerRequestAction_Implementation)." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin Function ServerRequestAction constinit property declarations *******************
	static const UECodeGen_Private::FBytePropertyParams NewProp_Category_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Category;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Dir_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Dir;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Stance_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Stance;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Function ServerRequestAction constinit property declarations *********************
	static const UECodeGen_Private::FFunctionParams FuncParams;
};

// ********** Begin Function ServerRequestAction Property Definitions ******************************
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Category_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Category = { "Category", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationComponent_eventServerRequestAction_Parms, Category), Z_Construct_UEnum_Nanimation_ENanimCategory, METADATA_PARAMS(0, nullptr) }; // aa849c0533a1b8ada989c9b7cd65620151f02da6
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Dir_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Dir = { "Dir", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationComponent_eventServerRequestAction_Parms, Dir), Z_Construct_UEnum_Nanimation_ENanimDirection, METADATA_PARAMS(0, nullptr) }; // b25cabd55150fca584aaae69fed07d8ad672b0d7
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Stance_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Stance = { "Stance", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationComponent_eventServerRequestAction_Parms, Stance), Z_Construct_UEnum_Nanimation_ENanimStance, METADATA_PARAMS(0, nullptr) }; // 39f444116cccb25a5b0e4dc3fbfa9c6314e45569
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Dir_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Dir,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Stance_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Stance,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Function ServerRequestAction Property Definitions ********************************
const UECodeGen_Private::FFunctionParams UHT_STATICS::FuncParams = { { (FTypeConstructFunc*)Z_Construct_UClass_UNanimationComponent, nullptr, "ServerRequestAction", UHT_STATICS::PropPointers, UE_ARRAY_COUNT(UHT_STATICS::PropPointers), DataSizeOf<NanimationComponent_eventServerRequestAction_Parms>(), RF_Public|RF_Transient|RF_MarkAsNative, (EFunctionFlags)0x80280CC0, 0, 0, METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)},  };
static_assert(sizeof(NanimationComponent_eventServerRequestAction_Parms) < MAX_uint16);
UFunction* Z_Construct_UFunction_UNanimationComponent_ServerRequestAction(ETypeConstructPhase Phase)
{
	static UFunction* ReturnFunction = nullptr;
	if (!ReturnFunction)
	{
		UECodeGen_Private::ConstructUFunction(&ReturnFunction, UHT_STATICS::FuncParams);
	}
	return ReturnFunction;
}
#undef UHT_STATICS
DEFINE_FUNCTION(UNanimationComponent::execServerRequestAction)
{
	P_GET_ENUM(ENanimCategory,Z_Param_Category);
	P_GET_ENUM(ENanimDirection,Z_Param_Dir);
	P_GET_ENUM(ENanimStance,Z_Param_Stance);
	P_FINISH;
	P_NATIVE_BEGIN;
	if (!P_THIS->ServerRequestAction_Validate(ENanimCategory(Z_Param_Category),ENanimDirection(Z_Param_Dir),ENanimStance(Z_Param_Stance)))
	{
		RPC_ValidateFailed(TEXT("ServerRequestAction_Validate"));
		return;
	}
	P_THIS->ServerRequestAction_Implementation(ENanimCategory(Z_Param_Category),ENanimDirection(Z_Param_Dir),ENanimStance(Z_Param_Stance));
	P_NATIVE_END;
}
// ********** End Class UNanimationComponent Function ServerRequestAction **************************

// ********** Begin Class UNanimationComponent Function SetActiveSet *******************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UFunction_UNanimationComponent_SetActiveSet_Statics
struct UHT_STATICS
{
	struct NanimationComponent_eventSetActiveSet_Parms
	{
		UNanimationSet* NewSet;
	};
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "Category", "Nanimation" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n\x09 * Set the active set (authority only). Resets draw state because a different\n\x09 * set means different variant arrays \xe2\x80\x94 old indices are invalid.\n\x09 */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationComponent.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Set the active set (authority only). Resets draw state because a different\nset means different variant arrays \xe2\x80\x94 old indices are invalid." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin Function SetActiveSet constinit property declarations **************************
	static const UECodeGen_Private::FObjectPropertyParams NewProp_NewSet;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Function SetActiveSet constinit property declarations ****************************
	static const UECodeGen_Private::FFunctionParams FuncParams;
};

// ********** Begin Function SetActiveSet Property Definitions *************************************
const UECodeGen_Private::FObjectPropertyParams UHT_STATICS::NewProp_NewSet = { "NewSet", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Object, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationComponent_eventSetActiveSet_Parms, NewSet), Z_Construct_UClass_UNanimationSet, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_NewSet,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Function SetActiveSet Property Definitions ***************************************
const UECodeGen_Private::FFunctionParams UHT_STATICS::FuncParams = { { (FTypeConstructFunc*)Z_Construct_UClass_UNanimationComponent, nullptr, "SetActiveSet", UHT_STATICS::PropPointers, UE_ARRAY_COUNT(UHT_STATICS::PropPointers), DataSizeOf<UHT_STATICS::NanimationComponent_eventSetActiveSet_Parms>(), RF_Public|RF_Transient|RF_MarkAsNative, (EFunctionFlags)0x04020401, 0, 0, METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)},  };
static_assert(sizeof(UHT_STATICS::NanimationComponent_eventSetActiveSet_Parms) < MAX_uint16);
UFunction* Z_Construct_UFunction_UNanimationComponent_SetActiveSet(ETypeConstructPhase Phase)
{
	static UFunction* ReturnFunction = nullptr;
	if (!ReturnFunction)
	{
		UECodeGen_Private::ConstructUFunction(&ReturnFunction, UHT_STATICS::FuncParams);
	}
	return ReturnFunction;
}
#undef UHT_STATICS
DEFINE_FUNCTION(UNanimationComponent::execSetActiveSet)
{
	P_GET_OBJECT(UNanimationSet,Z_Param_NewSet);
	P_FINISH;
	P_NATIVE_BEGIN;
	P_THIS->SetActiveSet(Z_Param_NewSet);
	P_NATIVE_END;
}
// ********** End Class UNanimationComponent Function SetActiveSet *********************************

// ********** Begin Class UNanimationComponent *****************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UClass_UNanimationComponent_Statics
struct UHT_STATICS
{
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "BlueprintSpawnableComponent", "" },
		{ "ClassGroupNames", "Nanimation" },
		{ "IncludePath", "NanimationComponent.h" },
		{ "ModuleRelativePath", "Public/NanimationComponent.h" },
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_ActiveSet_MetaData[] = {
		{ "Category", "Nanimation" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** The active action set. Now REPLICATED as a standard UObject reference\n\x09 *  (ReplicatedUsing=OnRep_ActiveSet) to prevent cross-machine divergence.\n\x09 *  Assign via SetActiveSet() to clear draw state. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationComponent.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "The active action set. Now REPLICATED as a standard UObject reference\n(ReplicatedUsing=OnRep_ActiveSet) to prevent cross-machine divergence.\nAssign via SetActiveSet() to clear draw state." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_OnVariantChosen_MetaData[] = {
		{ "Category", "Nanimation" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Fired once the picked variant is resolved (sync or async). */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationComponent.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Fired once the picked variant is resolved (sync or async)." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_ActionPulses_MetaData[] = {
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n\x09 * Replicated pulse array \xe2\x80\x94 ONE ENTRY PER CATEGORY USED. No more cross-category\n\x09 * event loss (two actions in the same net-update window for different\n\x09 * categories each get their own RepNotify tick).\n\x09 */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationComponent.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Replicated pulse array \xe2\x80\x94 ONE ENTRY PER CATEGORY USED. No more cross-category\nevent loss (two actions in the same net-update window for different\ncategories each get their own RepNotify tick)." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin Class UNanimationComponent constinit property declarations *********************
	static const UECodeGen_Private::FObjectPropertyParams NewProp_ActiveSet;
	static const UECodeGen_Private::FMulticastDelegatePropertyParams NewProp_OnVariantChosen;
	static const UECodeGen_Private::FStructPropertyParams NewProp_ActionPulses_Inner;
	static const UECodeGen_Private::FArrayPropertyParams NewProp_ActionPulses;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Class UNanimationComponent constinit property declarations ***********************
	static constexpr UE::CodeGen::FClassNativeFunction Funcs[] = {
		{ .NameUTF8 = UTF8TEXT("OnRep_ActionPulses"), .Pointer = &UNanimationComponent::execOnRep_ActionPulses },
		{ .NameUTF8 = UTF8TEXT("OnRep_ActiveSet"), .Pointer = &UNanimationComponent::execOnRep_ActiveSet },
		{ .NameUTF8 = UTF8TEXT("PlayLocalCosmetic"), .Pointer = &UNanimationComponent::execPlayLocalCosmetic },
		{ .NameUTF8 = UTF8TEXT("RequestAction"), .Pointer = &UNanimationComponent::execRequestAction },
		{ .NameUTF8 = UTF8TEXT("RequestActionWithContext"), .Pointer = &UNanimationComponent::execRequestActionWithContext },
		{ .NameUTF8 = UTF8TEXT("ServerRequestAction"), .Pointer = &UNanimationComponent::execServerRequestAction },
		{ .NameUTF8 = UTF8TEXT("SetActiveSet"), .Pointer = &UNanimationComponent::execSetActiveSet },
	};
	static FTypeConstructFunc* DependentSingletons[];
	static constexpr FClassFunctionLinkInfo FuncInfo[] = {
		{ &Z_Construct_UFunction_UNanimationComponent_OnRep_ActionPulses, "OnRep_ActionPulses" }, // c69ce4a5025e15615500edfc16e2401c029a7c20
		{ &Z_Construct_UFunction_UNanimationComponent_OnRep_ActiveSet, "OnRep_ActiveSet" }, // 65bf114e74223ec28ddd7fc7540550676d48387a
		{ &Z_Construct_UFunction_UNanimationComponent_PlayLocalCosmetic, "PlayLocalCosmetic" }, // 4c5764dd5bcfc039bb90e3ea230cef61b6d49e06
		{ &Z_Construct_UFunction_UNanimationComponent_RequestAction, "RequestAction" }, // 84eddfb3590b02a635d85d8ecc45e9cd7fb93bee
		{ &Z_Construct_UFunction_UNanimationComponent_RequestActionWithContext, "RequestActionWithContext" }, // f707aa034fe2cfa7aaeea8103093ece9d0edc743
		{ &Z_Construct_UFunction_UNanimationComponent_ServerRequestAction, "ServerRequestAction" }, // 148661daa26f264dd2d9773785136bd9585f7dba
		{ &Z_Construct_UFunction_UNanimationComponent_SetActiveSet, "SetActiveSet" }, // 051e07494564004d66c01375be081a6ef4c8d9fe
	};
	static_assert(UE_ARRAY_COUNT(FuncInfo) < 2048);
	static constexpr FCppClassTypeInfoStatic StaticCppClassTypeInfo = {
		TCppClassTypeTraits<UNanimationComponent>::IsAbstract,
	};
	static const UECodeGen_Private::FClassParams ClassParams;
}; // struct UHT_STATICS

// ********** Begin Class UNanimationComponent Property Definitions ********************************
const UECodeGen_Private::FObjectPropertyParams UHT_STATICS::NewProp_ActiveSet = { "ActiveSet", "OnRep_ActiveSet", (EPropertyFlags)0x0114000100000025, UECodeGen_Private::EPropertyGenFlags::Object | UECodeGen_Private::EPropertyGenFlags::ObjectPtr, nullptr, nullptr, 1, STRUCT_OFFSET(UNanimationComponent, ActiveSet), Z_Construct_UClass_UNanimationSet, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_ActiveSet_MetaData), NewProp_ActiveSet_MetaData) };
const UECodeGen_Private::FMulticastDelegatePropertyParams UHT_STATICS::NewProp_OnVariantChosen = { "OnVariantChosen", nullptr, (EPropertyFlags)0x0010000010080000, UECodeGen_Private::EPropertyGenFlags::InlineMulticastDelegate, nullptr, nullptr, 1, STRUCT_OFFSET(UNanimationComponent, OnVariantChosen), Z_Construct_UDelegateFunction_Nanimation_OnNanimVariantChosen__DelegateSignature, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_OnVariantChosen_MetaData), NewProp_OnVariantChosen_MetaData) }; // 89606786bed521ec7bebd5d3d948759c81dd0275
const UECodeGen_Private::FStructPropertyParams UHT_STATICS::NewProp_ActionPulses_Inner = { "ActionPulses", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Struct, nullptr, nullptr, 1, 0, Z_Construct_UScriptStruct_FNanimActionPulse, METADATA_PARAMS(0, nullptr) }; // 301aa4a21f1af7d97086de071bb0f4f37dd4afcf
const UECodeGen_Private::FArrayPropertyParams UHT_STATICS::NewProp_ActionPulses = { "ActionPulses", "OnRep_ActionPulses", (EPropertyFlags)0x0020080100000020, UECodeGen_Private::EPropertyGenFlags::Array, nullptr, nullptr, 1, STRUCT_OFFSET(UNanimationComponent, ActionPulses), EArrayPropertyFlags::None, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_ActionPulses_MetaData), NewProp_ActionPulses_MetaData) }; // 301aa4a21f1af7d97086de071bb0f4f37dd4afcf
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ActiveSet,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_OnVariantChosen,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ActionPulses_Inner,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ActionPulses,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Class UNanimationComponent Property Definitions **********************************
FTypeConstructFunc* UHT_STATICS::DependentSingletons[] = {
	(FTypeConstructFunc*)Z_Construct_UClass_UActorComponent,
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_Nanimation,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::DependentSingletons) < 16);
const UECodeGen_Private::FClassParams UHT_STATICS::ClassParams = {
	&Z_Construct_UClass_UNanimationComponent,
	"Engine",
	&StaticCppClassTypeInfo,
	DependentSingletons,
	FuncInfo,
	UHT_STATICS::PropPointers,
	nullptr,
	UE_ARRAY_COUNT(DependentSingletons),
	UE_ARRAY_COUNT(FuncInfo),
	UE_ARRAY_COUNT(UHT_STATICS::PropPointers),
	0,
	0x00B000A4u,
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
static void UNanimationComponent_StaticRegisterNativesUNanimationComponent()
{
	UClass* Class = UNanimationComponent::StaticClass();
	FNativeFunctionRegistrar::RegisterFunctions(Class, 		MakeConstArrayView(UHT_STATICS::Funcs));
}
FClassRegistrationInfo Z_Registration_Info_UClass_UNanimationComponent;
UClass* Z_Construct_UClass_UNanimationComponent(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Inner)
	{
		using TClass = UNanimationComponent;
		if (!Z_Registration_Info_UClass_UNanimationComponent.InnerSingleton)
		{
			GetPrivateStaticClassBody(
				TClass::StaticPackage(),
				TEXT("NanimationComponent"),
				Z_Registration_Info_UClass_UNanimationComponent.InnerSingleton,
				UNanimationComponent_StaticRegisterNativesUNanimationComponent,
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
		return Z_Registration_Info_UClass_UNanimationComponent.InnerSingleton;
	}
	if (!Z_Registration_Info_UClass_UNanimationComponent.OuterSingleton)
	{
		UECodeGen_Private::ConstructUClass(Z_Registration_Info_UClass_UNanimationComponent.OuterSingleton, UHT_STATICS::ClassParams);
	}
	return Z_Registration_Info_UClass_UNanimationComponent.OuterSingleton;
}
#if VALIDATE_CLASS_REPS
void UNanimationComponent::ValidateGeneratedRepEnums(const TArray<struct FRepRecord>& ClassReps) const
{
	static FName Name_ActiveSet(TEXT("ActiveSet"));
	static FName Name_ActionPulses(TEXT("ActionPulses"));
	const bool bIsValid = true
		&& Name_ActiveSet == ClassReps[(int32)ENetFields_Private::ActiveSet].Property->GetFName()
		&& Name_ActionPulses == ClassReps[(int32)ENetFields_Private::ActionPulses].Property->GetFName();
	checkf(bIsValid, TEXT("UHT Generated Rep Indices do not match runtime populated Rep Indices for properties in UNanimationComponent"));
}
#endif
#undef UHT_STATICS
DEFINE_VTABLE_PTR_HELPER_CTOR_NS(, UNanimationComponent);
UNanimationComponent::~UNanimationComponent() {}
// ********** End Class UNanimationComponent *******************************************************

// ********** Begin Registration *******************************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationComponent_h__Script_Nanimation_Statics
struct UHT_STATICS
{
	static constexpr FClassRegisterCompiledInInfo ClassInfo[] = {
		{ Z_Construct_UClass_UNanimationComponent, TEXT("UNanimationComponent"), &Z_Registration_Info_UClass_UNanimationComponent, CONSTRUCT_RELOAD_VERSION_INFO(FClassReloadVersionInfo, sizeof(UNanimationComponent), 174833880U) },
	};
}; // UHT_STATICS 
static FRegisterCompiledInInfo Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationComponent_h__Script_Nanimation_c56cc778ecb7bb0217547a37714f4614f25b35b9{
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
