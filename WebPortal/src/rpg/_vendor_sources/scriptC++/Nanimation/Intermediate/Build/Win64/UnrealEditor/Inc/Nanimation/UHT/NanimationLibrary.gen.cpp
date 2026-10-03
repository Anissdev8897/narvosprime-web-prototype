// Copyright Epic Games, Inc. All Rights Reserved.
/*===========================================================================
	Generated code exported from UnrealHeaderTool.
	DO NOT modify this manually! Edit the corresponding .h files instead!
===========================================================================*/

#include "UObject/GeneratedCppIncludes.h"
#include "NanimationLibrary.h"
#include "NanimationTypes.h"

PRAGMA_DISABLE_DEPRECATION_WARNINGS
static_assert(!UE_WITH_CONSTINIT_UOBJECT, "This generated code can only be compiled with !UE_WITH_CONSTINIT_UOBJECT");
void EmptyLinkFunctionForGeneratedCodeNanimationLibrary() {}

// ********** Begin Cross Module References ********************************************************
ENGINE_API UClass* Z_Construct_UClass_UBlueprintFunctionLibrary(ETypeConstructPhase);
ENGINE_API UClass* Z_Construct_UClass_UAnimMontage(ETypeConstructPhase);
ENGINE_API UClass* Z_Construct_UClass_USkeletalMeshComponent(ETypeConstructPhase);
// ********** End Cross Module References **********************************************************

// ********** Begin Same Module References *********************************************************
UPackage* Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase);
NANIMATION_API UEnum* Z_Construct_UEnum_Nanimation_ENanimCategory(ETypeConstructPhase);
NANIMATION_API UScriptStruct* Z_Construct_UScriptStruct_FNanimVariant(ETypeConstructPhase);
NANIMATION_API UClass* Z_Construct_UClass_UNanimationLibrary(ETypeConstructPhase);
NANIMATION_API UClass* Z_Construct_UClass_UNanimationLibrary(ETypeConstructPhase);
NANIMATION_API UClass* Z_Construct_UClass_UNanimationSet(ETypeConstructPhase);
// ********** End Same Module References ***********************************************************
#define UHT_STRUCT_BASE(INIT) UE::CodeGen::ConstInit::TCompiledInObjectPtr<const FStructBaseChain>(UE::Private::AsStructBaseChain(INIT))

// ********** Begin Class UNanimationLibrary Function PickVariant **********************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UFunction_UNanimationLibrary_PickVariant_Statics
struct UHT_STATICS
{
	struct NanimationLibrary_eventPickVariant_Parms
	{
		const UNanimationSet* Set;
		ENanimCategory Category;
		int32 Seed;
		FNanimVariant ReturnValue;
	};
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "Category", "Nanimation|Library" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n\x09 * Convenience wrapper: deterministically pick the FIRST draw (DrawCount = 1)\n\x09 * from the set's group for Category and return the variant by value. Fully\n\x09 * deterministic in Seed.\n\x09 */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationLibrary.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Convenience wrapper: deterministically pick the FIRST draw (DrawCount = 1)\nfrom the set's group for Category and return the variant by value. Fully\ndeterministic in Seed." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Set_MetaData[] = {
		{ "NativeConst", "" },
	};
#endif // WITH_METADATA

// ********** Begin Function PickVariant constinit property declarations ***************************
	static const UECodeGen_Private::FObjectPropertyParams NewProp_Set;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Category_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Category;
	static const UECodeGen_Private::FIntPropertyParams NewProp_Seed;
	static const UECodeGen_Private::FStructPropertyParams NewProp_ReturnValue;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Function PickVariant constinit property declarations *****************************
	static const UECodeGen_Private::FFunctionParams FuncParams;
};

// ********** Begin Function PickVariant Property Definitions **************************************
const UECodeGen_Private::FObjectPropertyParams UHT_STATICS::NewProp_Set = { "Set", nullptr, (EPropertyFlags)0x0010000000000082, UECodeGen_Private::EPropertyGenFlags::Object, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationLibrary_eventPickVariant_Parms, Set), Z_Construct_UClass_UNanimationSet, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Set_MetaData), NewProp_Set_MetaData) };
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Category_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Category = { "Category", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationLibrary_eventPickVariant_Parms, Category), Z_Construct_UEnum_Nanimation_ENanimCategory, METADATA_PARAMS(0, nullptr) }; // aa849c0533a1b8ada989c9b7cd65620151f02da6
const UECodeGen_Private::FIntPropertyParams UHT_STATICS::NewProp_Seed = { "Seed", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Int, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationLibrary_eventPickVariant_Parms, Seed), METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FStructPropertyParams UHT_STATICS::NewProp_ReturnValue = { "ReturnValue", nullptr, (EPropertyFlags)0x0010000000000580, UECodeGen_Private::EPropertyGenFlags::Struct, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationLibrary_eventPickVariant_Parms, ReturnValue), Z_Construct_UScriptStruct_FNanimVariant, METADATA_PARAMS(0, nullptr) }; // 58696e072a219f4dc97076853fd1b508ff301064
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Set,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Seed,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ReturnValue,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Function PickVariant Property Definitions ****************************************
const UECodeGen_Private::FFunctionParams UHT_STATICS::FuncParams = { { (FTypeConstructFunc*)Z_Construct_UClass_UNanimationLibrary, nullptr, "PickVariant", UHT_STATICS::PropPointers, UE_ARRAY_COUNT(UHT_STATICS::PropPointers), DataSizeOf<UHT_STATICS::NanimationLibrary_eventPickVariant_Parms>(), RF_Public|RF_Transient|RF_MarkAsNative, (EFunctionFlags)0x04022401, 0, 0, METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)},  };
static_assert(sizeof(UHT_STATICS::NanimationLibrary_eventPickVariant_Parms) < MAX_uint16);
UFunction* Z_Construct_UFunction_UNanimationLibrary_PickVariant(ETypeConstructPhase Phase)
{
	static UFunction* ReturnFunction = nullptr;
	if (!ReturnFunction)
	{
		UECodeGen_Private::ConstructUFunction(&ReturnFunction, UHT_STATICS::FuncParams);
	}
	return ReturnFunction;
}
#undef UHT_STATICS
DEFINE_FUNCTION(UNanimationLibrary::execPickVariant)
{
	P_GET_OBJECT(UNanimationSet,Z_Param_Set);
	P_GET_ENUM(ENanimCategory,Z_Param_Category);
	P_GET_PROPERTY(FIntProperty,Z_Param_Seed);
	P_FINISH;
	P_NATIVE_BEGIN;
	*(FNanimVariant*)Z_Param__Result=UNanimationLibrary::PickVariant(Z_Param_Set,ENanimCategory(Z_Param_Category),Z_Param_Seed);
	P_NATIVE_END;
}
// ********** End Class UNanimationLibrary Function PickVariant ************************************

// ********** Begin Class UNanimationLibrary Function PlayRandomMontage ****************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UFunction_UNanimationLibrary_PlayRandomMontage_Statics
struct UHT_STATICS
{
	struct NanimationLibrary_eventPlayRandomMontage_Parms
	{
		USkeletalMeshComponent* MeshComp;
		const UNanimationSet* Set;
		ENanimCategory Category;
		int32 Seed;
		UAnimMontage* ReturnValue;
	};
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "Category", "Nanimation|Library" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n\x09 * Resolve (sync-load if needed) the picked variant as a montage and play it on\n\x09 * the mesh's anim instance. Returns the montage played (or nullptr).\n\x09 *\n\x09 * The pick itself is deterministic in Seed; only the asset RESOLUTION is a\n\x09 * side effect. For the heavy GASP volume prefer the async path on the\n\x09 * Component; this helper is the simple one-shot convenience.\n\x09 *\n\x09 * NOTE: silently returns nullptr if the picked variant is not a UAnimMontage\n\x09 * (e.g. it's an AnimSequence \xe2\x80\x94 use PlayRandomSequence instead). Logs a\n\x09 * Warning in that case via LogNanimation.\n\x09 */" },
#endif
		{ "DefaultToSelf", "MeshComp" },
		{ "ModuleRelativePath", "Public/NanimationLibrary.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Resolve (sync-load if needed) the picked variant as a montage and play it on\nthe mesh's anim instance. Returns the montage played (or nullptr).\n\nThe pick itself is deterministic in Seed; only the asset RESOLUTION is a\nside effect. For the heavy GASP volume prefer the async path on the\nComponent; this helper is the simple one-shot convenience.\n\nNOTE: silently returns nullptr if the picked variant is not a UAnimMontage\n(e.g. it's an AnimSequence \xe2\x80\x94 use PlayRandomSequence instead). Logs a\nWarning in that case via LogNanimation." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_MeshComp_MetaData[] = {
		{ "EditInline", "true" },
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Set_MetaData[] = {
		{ "NativeConst", "" },
	};
#endif // WITH_METADATA

// ********** Begin Function PlayRandomMontage constinit property declarations *********************
	static const UECodeGen_Private::FObjectPropertyParams NewProp_MeshComp;
	static const UECodeGen_Private::FObjectPropertyParams NewProp_Set;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Category_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Category;
	static const UECodeGen_Private::FIntPropertyParams NewProp_Seed;
	static const UECodeGen_Private::FObjectPropertyParams NewProp_ReturnValue;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Function PlayRandomMontage constinit property declarations ***********************
	static const UECodeGen_Private::FFunctionParams FuncParams;
};

// ********** Begin Function PlayRandomMontage Property Definitions ********************************
const UECodeGen_Private::FObjectPropertyParams UHT_STATICS::NewProp_MeshComp = { "MeshComp", nullptr, (EPropertyFlags)0x0010000000080080, UECodeGen_Private::EPropertyGenFlags::Object, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationLibrary_eventPlayRandomMontage_Parms, MeshComp), Z_Construct_UClass_USkeletalMeshComponent, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_MeshComp_MetaData), NewProp_MeshComp_MetaData) };
const UECodeGen_Private::FObjectPropertyParams UHT_STATICS::NewProp_Set = { "Set", nullptr, (EPropertyFlags)0x0010000000000082, UECodeGen_Private::EPropertyGenFlags::Object, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationLibrary_eventPlayRandomMontage_Parms, Set), Z_Construct_UClass_UNanimationSet, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Set_MetaData), NewProp_Set_MetaData) };
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Category_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Category = { "Category", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationLibrary_eventPlayRandomMontage_Parms, Category), Z_Construct_UEnum_Nanimation_ENanimCategory, METADATA_PARAMS(0, nullptr) }; // aa849c0533a1b8ada989c9b7cd65620151f02da6
const UECodeGen_Private::FIntPropertyParams UHT_STATICS::NewProp_Seed = { "Seed", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Int, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationLibrary_eventPlayRandomMontage_Parms, Seed), METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FObjectPropertyParams UHT_STATICS::NewProp_ReturnValue = { "ReturnValue", nullptr, (EPropertyFlags)0x0010000000000580, UECodeGen_Private::EPropertyGenFlags::Object, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationLibrary_eventPlayRandomMontage_Parms, ReturnValue), Z_Construct_UClass_UAnimMontage, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_MeshComp,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Set,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Seed,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ReturnValue,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Function PlayRandomMontage Property Definitions **********************************
const UECodeGen_Private::FFunctionParams UHT_STATICS::FuncParams = { { (FTypeConstructFunc*)Z_Construct_UClass_UNanimationLibrary, nullptr, "PlayRandomMontage", UHT_STATICS::PropPointers, UE_ARRAY_COUNT(UHT_STATICS::PropPointers), DataSizeOf<UHT_STATICS::NanimationLibrary_eventPlayRandomMontage_Parms>(), RF_Public|RF_Transient|RF_MarkAsNative, (EFunctionFlags)0x04022401, 0, 0, METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)},  };
static_assert(sizeof(UHT_STATICS::NanimationLibrary_eventPlayRandomMontage_Parms) < MAX_uint16);
UFunction* Z_Construct_UFunction_UNanimationLibrary_PlayRandomMontage(ETypeConstructPhase Phase)
{
	static UFunction* ReturnFunction = nullptr;
	if (!ReturnFunction)
	{
		UECodeGen_Private::ConstructUFunction(&ReturnFunction, UHT_STATICS::FuncParams);
	}
	return ReturnFunction;
}
#undef UHT_STATICS
DEFINE_FUNCTION(UNanimationLibrary::execPlayRandomMontage)
{
	P_GET_OBJECT(USkeletalMeshComponent,Z_Param_MeshComp);
	P_GET_OBJECT(UNanimationSet,Z_Param_Set);
	P_GET_ENUM(ENanimCategory,Z_Param_Category);
	P_GET_PROPERTY(FIntProperty,Z_Param_Seed);
	P_FINISH;
	P_NATIVE_BEGIN;
	*(UAnimMontage**)Z_Param__Result=UNanimationLibrary::PlayRandomMontage(Z_Param_MeshComp,Z_Param_Set,ENanimCategory(Z_Param_Category),Z_Param_Seed);
	P_NATIVE_END;
}
// ********** End Class UNanimationLibrary Function PlayRandomMontage ******************************

// ********** Begin Class UNanimationLibrary Function PlayRandomSequence ***************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UFunction_UNanimationLibrary_PlayRandomSequence_Statics
struct UHT_STATICS
{
	struct NanimationLibrary_eventPlayRandomSequence_Parms
	{
		USkeletalMeshComponent* MeshComp;
		const UNanimationSet* Set;
		ENanimCategory Category;
		int32 Seed;
		FName SlotName;
		UAnimMontage* ReturnValue;
	};
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "Category", "Nanimation|Library" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n\x09 * Pick a variant deterministically from the set and play it as a dynamic\n\x09 * montage on the mesh's anim instance via PlaySlotAnimationAsDynamicMontage.\n\x09 * This is the AnimSequence counterpart to PlayRandomMontage \xe2\x80\x94 use this when\n\x09 * the set contains AnimSequences (the scanner's default output).\n\x09 *\n\x09 * @param SlotName  The slot node name the dynamic montage will play in.\n\x09 * @return the played UAnimMontage (dynamic), or nullptr on failure.\n\x09 */" },
#endif
		{ "CPP_Default_SlotName", "DefaultSlot" },
		{ "DefaultToSelf", "MeshComp" },
		{ "ModuleRelativePath", "Public/NanimationLibrary.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Pick a variant deterministically from the set and play it as a dynamic\nmontage on the mesh's anim instance via PlaySlotAnimationAsDynamicMontage.\nThis is the AnimSequence counterpart to PlayRandomMontage \xe2\x80\x94 use this when\nthe set contains AnimSequences (the scanner's default output).\n\n@param SlotName  The slot node name the dynamic montage will play in.\n@return the played UAnimMontage (dynamic), or nullptr on failure." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_MeshComp_MetaData[] = {
		{ "EditInline", "true" },
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Set_MetaData[] = {
		{ "NativeConst", "" },
	};
#endif // WITH_METADATA

// ********** Begin Function PlayRandomSequence constinit property declarations ********************
	static const UECodeGen_Private::FObjectPropertyParams NewProp_MeshComp;
	static const UECodeGen_Private::FObjectPropertyParams NewProp_Set;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Category_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Category;
	static const UECodeGen_Private::FIntPropertyParams NewProp_Seed;
	static const UECodeGen_Private::FNamePropertyParams NewProp_SlotName;
	static const UECodeGen_Private::FObjectPropertyParams NewProp_ReturnValue;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Function PlayRandomSequence constinit property declarations **********************
	static const UECodeGen_Private::FFunctionParams FuncParams;
};

// ********** Begin Function PlayRandomSequence Property Definitions *******************************
const UECodeGen_Private::FObjectPropertyParams UHT_STATICS::NewProp_MeshComp = { "MeshComp", nullptr, (EPropertyFlags)0x0010000000080080, UECodeGen_Private::EPropertyGenFlags::Object, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationLibrary_eventPlayRandomSequence_Parms, MeshComp), Z_Construct_UClass_USkeletalMeshComponent, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_MeshComp_MetaData), NewProp_MeshComp_MetaData) };
const UECodeGen_Private::FObjectPropertyParams UHT_STATICS::NewProp_Set = { "Set", nullptr, (EPropertyFlags)0x0010000000000082, UECodeGen_Private::EPropertyGenFlags::Object, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationLibrary_eventPlayRandomSequence_Parms, Set), Z_Construct_UClass_UNanimationSet, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Set_MetaData), NewProp_Set_MetaData) };
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Category_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Category = { "Category", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationLibrary_eventPlayRandomSequence_Parms, Category), Z_Construct_UEnum_Nanimation_ENanimCategory, METADATA_PARAMS(0, nullptr) }; // aa849c0533a1b8ada989c9b7cd65620151f02da6
const UECodeGen_Private::FIntPropertyParams UHT_STATICS::NewProp_Seed = { "Seed", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Int, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationLibrary_eventPlayRandomSequence_Parms, Seed), METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FNamePropertyParams UHT_STATICS::NewProp_SlotName = { "SlotName", nullptr, (EPropertyFlags)0x0010000000000080, UECodeGen_Private::EPropertyGenFlags::Name, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationLibrary_eventPlayRandomSequence_Parms, SlotName), METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FObjectPropertyParams UHT_STATICS::NewProp_ReturnValue = { "ReturnValue", nullptr, (EPropertyFlags)0x0010000000000580, UECodeGen_Private::EPropertyGenFlags::Object, nullptr, nullptr, 1, STRUCT_OFFSET(NanimationLibrary_eventPlayRandomSequence_Parms, ReturnValue), Z_Construct_UClass_UAnimMontage, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_MeshComp,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Set,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Seed,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_SlotName,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_ReturnValue,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Function PlayRandomSequence Property Definitions *********************************
const UECodeGen_Private::FFunctionParams UHT_STATICS::FuncParams = { { (FTypeConstructFunc*)Z_Construct_UClass_UNanimationLibrary, nullptr, "PlayRandomSequence", UHT_STATICS::PropPointers, UE_ARRAY_COUNT(UHT_STATICS::PropPointers), DataSizeOf<UHT_STATICS::NanimationLibrary_eventPlayRandomSequence_Parms>(), RF_Public|RF_Transient|RF_MarkAsNative, (EFunctionFlags)0x04022401, 0, 0, METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)},  };
static_assert(sizeof(UHT_STATICS::NanimationLibrary_eventPlayRandomSequence_Parms) < MAX_uint16);
UFunction* Z_Construct_UFunction_UNanimationLibrary_PlayRandomSequence(ETypeConstructPhase Phase)
{
	static UFunction* ReturnFunction = nullptr;
	if (!ReturnFunction)
	{
		UECodeGen_Private::ConstructUFunction(&ReturnFunction, UHT_STATICS::FuncParams);
	}
	return ReturnFunction;
}
#undef UHT_STATICS
DEFINE_FUNCTION(UNanimationLibrary::execPlayRandomSequence)
{
	P_GET_OBJECT(USkeletalMeshComponent,Z_Param_MeshComp);
	P_GET_OBJECT(UNanimationSet,Z_Param_Set);
	P_GET_ENUM(ENanimCategory,Z_Param_Category);
	P_GET_PROPERTY(FIntProperty,Z_Param_Seed);
	P_GET_PROPERTY(FNameProperty,Z_Param_SlotName);
	P_FINISH;
	P_NATIVE_BEGIN;
	*(UAnimMontage**)Z_Param__Result=UNanimationLibrary::PlayRandomSequence(Z_Param_MeshComp,Z_Param_Set,ENanimCategory(Z_Param_Category),Z_Param_Seed,Z_Param_SlotName);
	P_NATIVE_END;
}
// ********** End Class UNanimationLibrary Function PlayRandomSequence *****************************

// ********** Begin Class UNanimationLibrary *******************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UClass_UNanimationLibrary_Statics
struct UHT_STATICS
{
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n * UNanimationLibrary\n * ------------------\n * Pure draw helpers. Marked BlueprintFunctionLibrary so designers can call the\n * same deterministic picks from BP and get identical results to C++.\n */" },
#endif
		{ "IncludePath", "NanimationLibrary.h" },
		{ "ModuleRelativePath", "Public/NanimationLibrary.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "UNanimationLibrary\n------------------\nPure draw helpers. Marked BlueprintFunctionLibrary so designers can call the\nsame deterministic picks from BP and get identical results to C++." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin Class UNanimationLibrary constinit property declarations ***********************
// ********** End Class UNanimationLibrary constinit property declarations *************************
	static constexpr UE::CodeGen::FClassNativeFunction Funcs[] = {
		{ .NameUTF8 = UTF8TEXT("PickVariant"), .Pointer = &UNanimationLibrary::execPickVariant },
		{ .NameUTF8 = UTF8TEXT("PlayRandomMontage"), .Pointer = &UNanimationLibrary::execPlayRandomMontage },
		{ .NameUTF8 = UTF8TEXT("PlayRandomSequence"), .Pointer = &UNanimationLibrary::execPlayRandomSequence },
	};
	static FTypeConstructFunc* DependentSingletons[];
	static constexpr FClassFunctionLinkInfo FuncInfo[] = {
		{ &Z_Construct_UFunction_UNanimationLibrary_PickVariant, "PickVariant" }, // 8c820491505987ded2880b29c04fa1e1977e83ec
		{ &Z_Construct_UFunction_UNanimationLibrary_PlayRandomMontage, "PlayRandomMontage" }, // a2bc4fe2c9882f05c91b06a50731dc5dbebf12f5
		{ &Z_Construct_UFunction_UNanimationLibrary_PlayRandomSequence, "PlayRandomSequence" }, // c818acdc08800292c766a7c2bf016e8f35526d6a
	};
	static_assert(UE_ARRAY_COUNT(FuncInfo) < 2048);
	static constexpr FCppClassTypeInfoStatic StaticCppClassTypeInfo = {
		TCppClassTypeTraits<UNanimationLibrary>::IsAbstract,
	};
	static const UECodeGen_Private::FClassParams ClassParams;
}; // struct UHT_STATICS
FTypeConstructFunc* UHT_STATICS::DependentSingletons[] = {
	(FTypeConstructFunc*)Z_Construct_UClass_UBlueprintFunctionLibrary,
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_Nanimation,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::DependentSingletons) < 16);
const UECodeGen_Private::FClassParams UHT_STATICS::ClassParams = {
	&Z_Construct_UClass_UNanimationLibrary,
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
static void UNanimationLibrary_StaticRegisterNativesUNanimationLibrary()
{
	UClass* Class = UNanimationLibrary::StaticClass();
	FNativeFunctionRegistrar::RegisterFunctions(Class, 		MakeConstArrayView(UHT_STATICS::Funcs));
}
FClassRegistrationInfo Z_Registration_Info_UClass_UNanimationLibrary;
UClass* Z_Construct_UClass_UNanimationLibrary(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Inner)
	{
		using TClass = UNanimationLibrary;
		if (!Z_Registration_Info_UClass_UNanimationLibrary.InnerSingleton)
		{
			GetPrivateStaticClassBody(
				TClass::StaticPackage(),
				TEXT("NanimationLibrary"),
				Z_Registration_Info_UClass_UNanimationLibrary.InnerSingleton,
				UNanimationLibrary_StaticRegisterNativesUNanimationLibrary,
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
		return Z_Registration_Info_UClass_UNanimationLibrary.InnerSingleton;
	}
	if (!Z_Registration_Info_UClass_UNanimationLibrary.OuterSingleton)
	{
		UECodeGen_Private::ConstructUClass(Z_Registration_Info_UClass_UNanimationLibrary.OuterSingleton, UHT_STATICS::ClassParams);
	}
	return Z_Registration_Info_UClass_UNanimationLibrary.OuterSingleton;
}
#undef UHT_STATICS
UNanimationLibrary::UNanimationLibrary(const FObjectInitializer& ObjectInitializer) : Super(ObjectInitializer) {}
DEFINE_VTABLE_PTR_HELPER_CTOR_NS(, UNanimationLibrary);
UNanimationLibrary::~UNanimationLibrary() {}
// ********** End Class UNanimationLibrary *********************************************************

// ********** Begin Registration *******************************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationLibrary_h__Script_Nanimation_Statics
struct UHT_STATICS
{
	static constexpr FClassRegisterCompiledInInfo ClassInfo[] = {
		{ Z_Construct_UClass_UNanimationLibrary, TEXT("UNanimationLibrary"), &Z_Registration_Info_UClass_UNanimationLibrary, CONSTRUCT_RELOAD_VERSION_INFO(FClassReloadVersionInfo, sizeof(UNanimationLibrary), 2346716373U) },
	};
}; // UHT_STATICS 
static FRegisterCompiledInInfo Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationLibrary_h__Script_Nanimation_c0faef7a599fe3f9fae14c2bfdd839101556ea90{
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
