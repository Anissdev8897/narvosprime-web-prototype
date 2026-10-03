// Copyright Epic Games, Inc. All Rights Reserved.
/*===========================================================================
	Generated code exported from UnrealHeaderTool.
	DO NOT modify this manually! Edit the corresponding .h files instead!
===========================================================================*/

#include "UObject/GeneratedCppIncludes.h"
#include "AnimNode_NanimSelect.h"
#include "NanimationTypes.h"

PRAGMA_DISABLE_DEPRECATION_WARNINGS
static_assert(!UE_WITH_CONSTINIT_UOBJECT, "This generated code can only be compiled with !UE_WITH_CONSTINIT_UOBJECT");
void EmptyLinkFunctionForGeneratedCodeAnimNode_NanimSelect() {}

// ********** Begin Cross Module References ********************************************************
ENGINE_API UScriptStruct* Z_Construct_UScriptStruct_FAnimNode_Base(ETypeConstructPhase);
ENGINE_API UEnum* Z_Construct_UEnum_Engine_EAnimGroupRole(ETypeConstructPhase);
ENGINE_API UClass* Z_Construct_UClass_UAnimSequenceBase(ETypeConstructPhase);
// ********** End Cross Module References **********************************************************

// ********** Begin Same Module References *********************************************************
UPackage* Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase);
NANIMATION_API UScriptStruct* Z_Construct_UScriptStruct_FAnimNode_NanimSelect(ETypeConstructPhase);
NANIMATION_API UEnum* Z_Construct_UEnum_Nanimation_ENanimDirection(ETypeConstructPhase);
NANIMATION_API UEnum* Z_Construct_UEnum_Nanimation_ENanimStance(ETypeConstructPhase);
NANIMATION_API UScriptStruct* Z_Construct_UScriptStruct_FNanimAction(ETypeConstructPhase);
// ********** End Same Module References ***********************************************************
#define UHT_STRUCT_BASE(INIT) UE::CodeGen::ConstInit::TCompiledInObjectPtr<const FStructBaseChain>(UE::Private::AsStructBaseChain(INIT))

// ********** Begin ScriptStruct FAnimNode_NanimSelect *********************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UScriptStruct_FAnimNode_NanimSelect_Statics
struct UHT_STATICS
{
	static inline consteval int32 GetStructSize() { return DataSizeOf<FAnimNode_NanimSelect>(); }
	static inline consteval int16 GetStructAlignment() { return alignof(FAnimNode_NanimSelect); }
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "BlueprintInternalUseOnly", "true" },
		{ "BlueprintType", "true" },
		{ "ModuleRelativePath", "Public/AnimNode_NanimSelect.h" },
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Action_MetaData[] = {
		{ "Category", "Settings" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** The variant group to choose from. */" },
#endif
		{ "ModuleRelativePath", "Public/AnimNode_NanimSelect.h" },
		{ "PinHiddenByDefault", "" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "The variant group to choose from." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Seed_MetaData[] = {
		{ "Category", "Settings" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n\x09 * LOCAL base seed for this node's cosmetic variant cycling. Exposed as a pin.\n\x09 * A change in Seed is detected in Update_AnyThread and triggers a re-pick.\n\x09 */" },
#endif
		{ "ModuleRelativePath", "Public/AnimNode_NanimSelect.h" },
		{ "PinShownByDefault", "" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "LOCAL base seed for this node's cosmetic variant cycling. Exposed as a pin.\nA change in Seed is detected in Update_AnyThread and triggers a re-pick." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Direction_MetaData[] = {
		{ "Category", "Settings" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n\x09 * Optional direction filter. Only variants matching this direction (or None)\n\x09 * are eligible. Default: None (no filter).\n\x09 */" },
#endif
		{ "ModuleRelativePath", "Public/AnimNode_NanimSelect.h" },
		{ "PinHiddenByDefault", "" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Optional direction filter. Only variants matching this direction (or None)\nare eligible. Default: None (no filter)." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Stance_MetaData[] = {
		{ "Category", "Settings" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n\x09 * Optional stance filter. Only variants matching this stance (or None)\n\x09 * are eligible. Default: None (no filter).\n\x09 */" },
#endif
		{ "ModuleRelativePath", "Public/AnimNode_NanimSelect.h" },
		{ "PinHiddenByDefault", "" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Optional stance filter. Only variants matching this stance (or None)\nare eligible. Default: None (no filter)." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_SyncGroupName_MetaData[] = {
		{ "Category", "Sync" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Shared sync group across variants. */" },
#endif
		{ "ModuleRelativePath", "Public/AnimNode_NanimSelect.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Shared sync group across variants." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_GroupRole_MetaData[] = {
		{ "Category", "Sync" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Role within the shared sync group. */" },
#endif
		{ "ModuleRelativePath", "Public/AnimNode_NanimSelect.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Role within the shared sync group." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_bLoop_MetaData[] = {
		{ "Category", "Settings" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Should the chosen variant loop? */" },
#endif
		{ "ModuleRelativePath", "Public/AnimNode_NanimSelect.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Should the chosen variant loop?" },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_bRepickOnCycle_MetaData[] = {
		{ "Category", "Settings" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Re-pick a different variant each loop wrap. */" },
#endif
		{ "ModuleRelativePath", "Public/AnimNode_NanimSelect.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Re-pick a different variant each loop wrap." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_PlayRate_MetaData[] = {
		{ "Category", "Settings" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Play rate. */" },
#endif
		{ "ModuleRelativePath", "Public/AnimNode_NanimSelect.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Play rate." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_CurrentSequence_MetaData[] = {
		{ "ModuleRelativePath", "Public/AnimNode_NanimSelect.h" },
	};
#endif // WITH_METADATA

// ********** Begin ScriptStruct FAnimNode_NanimSelect constinit property declarations *************
	static const UECodeGen_Private::FStructPropertyParams NewProp_Action;
	static const UECodeGen_Private::FIntPropertyParams NewProp_Seed;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Direction_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Direction;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Stance_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Stance;
	static const UECodeGen_Private::FNamePropertyParams NewProp_SyncGroupName;
	static const UECodeGen_Private::FBytePropertyParams NewProp_GroupRole;
	static void NewProp_bLoop_SetBit(void* Obj)
	{
		((FAnimNode_NanimSelect*)Obj)->bLoop = 1;
	}
	static const UECodeGen_Private::FBoolPropertyParams NewProp_bLoop;
	static void NewProp_bRepickOnCycle_SetBit(void* Obj)
	{
		((FAnimNode_NanimSelect*)Obj)->bRepickOnCycle = 1;
	}
	static const UECodeGen_Private::FBoolPropertyParams NewProp_bRepickOnCycle;
	static const UECodeGen_Private::FFloatPropertyParams NewProp_PlayRate;
	static const UECodeGen_Private::FObjectPropertyParams NewProp_CurrentSequence;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End ScriptStruct FAnimNode_NanimSelect constinit property declarations ***************
	static void* NewStructOps()
	{
		return (UScriptStruct::ICppStructOps*)new UScriptStruct::TCppStructOps<FAnimNode_NanimSelect>();
	}
	static const UECodeGen_Private::FStructParams StructParams;
}; // struct UHT_STATICS
static_assert(std::is_polymorphic<FAnimNode_NanimSelect>() == std::is_polymorphic<FAnimNode_Base>(), "USTRUCT FAnimNode_NanimSelect cannot be polymorphic unless super FAnimNode_Base is polymorphic");

// ********** Begin ScriptStruct FAnimNode_NanimSelect Property Definitions ************************
const UECodeGen_Private::FStructPropertyParams UHT_STATICS::NewProp_Action = { "Action", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Struct, nullptr, nullptr, 1, STRUCT_OFFSET(FAnimNode_NanimSelect, Action), Z_Construct_UScriptStruct_FNanimAction, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Action_MetaData), NewProp_Action_MetaData) }; // 436b741e631e47780a8723c4f4535c7e62a8344d
const UECodeGen_Private::FIntPropertyParams UHT_STATICS::NewProp_Seed = { "Seed", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Int, nullptr, nullptr, 1, STRUCT_OFFSET(FAnimNode_NanimSelect, Seed), METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Seed_MetaData), NewProp_Seed_MetaData) };
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Direction_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Direction = { "Direction", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(FAnimNode_NanimSelect, Direction), Z_Construct_UEnum_Nanimation_ENanimDirection, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Direction_MetaData), NewProp_Direction_MetaData) }; // b25cabd55150fca584aaae69fed07d8ad672b0d7
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Stance_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Stance = { "Stance", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(FAnimNode_NanimSelect, Stance), Z_Construct_UEnum_Nanimation_ENanimStance, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Stance_MetaData), NewProp_Stance_MetaData) }; // 39f444116cccb25a5b0e4dc3fbfa9c6314e45569
const UECodeGen_Private::FNamePropertyParams UHT_STATICS::NewProp_SyncGroupName = { "SyncGroupName", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Name, nullptr, nullptr, 1, STRUCT_OFFSET(FAnimNode_NanimSelect, SyncGroupName), METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_SyncGroupName_MetaData), NewProp_SyncGroupName_MetaData) };
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_GroupRole = { "GroupRole", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, STRUCT_OFFSET(FAnimNode_NanimSelect, GroupRole), Z_Construct_UEnum_Engine_EAnimGroupRole, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_GroupRole_MetaData), NewProp_GroupRole_MetaData) }; // e9d264fe67b49ce89b90332d699754beac5dd272
const UECodeGen_Private::FBoolPropertyParams UHT_STATICS::NewProp_bLoop = { "bLoop", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Bool | UECodeGen_Private::EPropertyGenFlags::NativeBool, nullptr, nullptr, 1, sizeof(bool), sizeof(FAnimNode_NanimSelect), &UHT_STATICS::NewProp_bLoop_SetBit, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_bLoop_MetaData), NewProp_bLoop_MetaData) };
const UECodeGen_Private::FBoolPropertyParams UHT_STATICS::NewProp_bRepickOnCycle = { "bRepickOnCycle", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Bool | UECodeGen_Private::EPropertyGenFlags::NativeBool, nullptr, nullptr, 1, sizeof(bool), sizeof(FAnimNode_NanimSelect), &UHT_STATICS::NewProp_bRepickOnCycle_SetBit, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_bRepickOnCycle_MetaData), NewProp_bRepickOnCycle_MetaData) };
const UECodeGen_Private::FFloatPropertyParams UHT_STATICS::NewProp_PlayRate = { "PlayRate", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Float, nullptr, nullptr, 1, STRUCT_OFFSET(FAnimNode_NanimSelect, PlayRate), METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_PlayRate_MetaData), NewProp_PlayRate_MetaData) };
const UECodeGen_Private::FObjectPropertyParams UHT_STATICS::NewProp_CurrentSequence = { "CurrentSequence", nullptr, (EPropertyFlags)0x0144000000002000, UECodeGen_Private::EPropertyGenFlags::Object | UECodeGen_Private::EPropertyGenFlags::ObjectPtr, nullptr, nullptr, 1, STRUCT_OFFSET(FAnimNode_NanimSelect, CurrentSequence), Z_Construct_UClass_UAnimSequenceBase, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_CurrentSequence_MetaData), NewProp_CurrentSequence_MetaData) };
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Action,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Seed,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Direction_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Direction,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Stance_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Stance,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_SyncGroupName,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_GroupRole,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_bLoop,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_bRepickOnCycle,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_PlayRate,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_CurrentSequence,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End ScriptStruct FAnimNode_NanimSelect Property Definitions **************************
const UECodeGen_Private::FStructParams UHT_STATICS::StructParams = {
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_Nanimation,
	Z_Construct_UScriptStruct_FAnimNode_Base,
	&NewStructOps,
	"AnimNode_NanimSelect",
	UHT_STATICS::PropPointers,
	UE_ARRAY_COUNT(UHT_STATICS::PropPointers),
	DataSizeOf<FAnimNode_NanimSelect>(),
	alignof(FAnimNode_NanimSelect),
	RF_Public|RF_Transient|RF_MarkAsNative,
	EStructFlags(0x00000201),
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
static FStructRegistrationInfo Z_Registration_Info_UScriptStruct_FAnimNode_NanimSelect;
UScriptStruct* Z_Construct_UScriptStruct_FAnimNode_NanimSelect(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Outer)
	{
		if (!Z_Registration_Info_UScriptStruct_FAnimNode_NanimSelect.OuterSingleton)
		{
			Z_Registration_Info_UScriptStruct_FAnimNode_NanimSelect.OuterSingleton = GetStaticStruct(Z_Construct_UScriptStruct_FAnimNode_NanimSelect, (UObject*)Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase::Outer), TEXT("AnimNode_NanimSelect"));
		}
		return Z_Registration_Info_UScriptStruct_FAnimNode_NanimSelect.OuterSingleton;
	}
	if (!Z_Registration_Info_UScriptStruct_FAnimNode_NanimSelect.InnerSingleton)
	{
		UECodeGen_Private::ConstructUScriptStruct(Z_Registration_Info_UScriptStruct_FAnimNode_NanimSelect.InnerSingleton, UHT_STATICS::StructParams);
	}
	return CastChecked<UScriptStruct>(Z_Registration_Info_UScriptStruct_FAnimNode_NanimSelect.InnerSingleton);
}
#undef UHT_STATICS
// ********** End ScriptStruct FAnimNode_NanimSelect ***********************************************

// ********** Begin Registration *******************************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_AnimNode_NanimSelect_h__Script_Nanimation_Statics
struct UHT_STATICS
{
	static constexpr FStructRegisterCompiledInInfo ScriptStructInfo[] = {
		{ Z_Construct_UScriptStruct_FAnimNode_NanimSelect, Z_Construct_UScriptStruct_FAnimNode_NanimSelect_Statics::NewStructOps, TEXT("AnimNode_NanimSelect"),&Z_Registration_Info_UScriptStruct_FAnimNode_NanimSelect, CONSTRUCT_RELOAD_VERSION_INFO(FStructReloadVersionInfo, sizeof(FAnimNode_NanimSelect), 1680644597U) },
	};
}; // UHT_STATICS 
static FRegisterCompiledInInfo Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_AnimNode_NanimSelect_h__Script_Nanimation_19d4c623159ecd3cdb665f0b6d6d57ed86664b84{
	TEXT("/Script/Nanimation"),
	nullptr, 0,
	UHT_STATICS::ScriptStructInfo, UE_ARRAY_COUNT(UHT_STATICS::ScriptStructInfo),
	nullptr, 0,
	nullptr, 0,
};
#undef UHT_STATICS
// ********** End Registration *********************************************************************
#undef UHT_STRUCT_BASE

PRAGMA_ENABLE_DEPRECATION_WARNINGS
