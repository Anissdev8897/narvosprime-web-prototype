// Copyright Epic Games, Inc. All Rights Reserved.
/*===========================================================================
	Generated code exported from UnrealHeaderTool.
	DO NOT modify this manually! Edit the corresponding .h files instead!
===========================================================================*/

#include "UObject/GeneratedCppIncludes.h"
#include "NanimationTypes.h"

PRAGMA_DISABLE_DEPRECATION_WARNINGS
static_assert(!UE_WITH_CONSTINIT_UOBJECT, "This generated code can only be compiled with !UE_WITH_CONSTINIT_UOBJECT");
void EmptyLinkFunctionForGeneratedCodeNanimationTypes() {}

// ********** Begin Cross Module References ********************************************************
ENGINE_API UClass* Z_Construct_UClass_UAnimSequenceBase(ETypeConstructPhase);
// ********** End Cross Module References **********************************************************

// ********** Begin Same Module References *********************************************************
UPackage* Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase);
NANIMATION_API UEnum* Z_Construct_UEnum_Nanimation_ENanimCategory(ETypeConstructPhase);
NANIMATION_API UEnum* Z_Construct_UEnum_Nanimation_ENanimDirection(ETypeConstructPhase);
NANIMATION_API UEnum* Z_Construct_UEnum_Nanimation_ENanimNetMode(ETypeConstructPhase);
NANIMATION_API UEnum* Z_Construct_UEnum_Nanimation_ENanimPolicy(ETypeConstructPhase);
NANIMATION_API UEnum* Z_Construct_UEnum_Nanimation_ENanimStance(ETypeConstructPhase);
NANIMATION_API UScriptStruct* Z_Construct_UScriptStruct_FNanimAction(ETypeConstructPhase);
NANIMATION_API UScriptStruct* Z_Construct_UScriptStruct_FNanimActionPulse(ETypeConstructPhase);
NANIMATION_API UScriptStruct* Z_Construct_UScriptStruct_FNanimPickContext(ETypeConstructPhase);
NANIMATION_API UScriptStruct* Z_Construct_UScriptStruct_FNanimVariant(ETypeConstructPhase);
// ********** End Same Module References ***********************************************************
#define UHT_STRUCT_BASE(INIT) UE::CodeGen::ConstInit::TCompiledInObjectPtr<const FStructBaseChain>(UE::Private::AsStructBaseChain(INIT))

// ********** Begin Enum ENanimCategory ************************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UEnum_Nanimation_ENanimCategory_Statics
template<> NANIMATION_NON_ATTRIBUTED_API UEnum* StaticEnum<ENanimCategory>()
{
	return Z_Construct_UEnum_Nanimation_ENanimCategory(ETypeConstructPhase::Outer);
}
struct UHT_STATICS
{
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "Aim.DisplayName", "Aim" },
		{ "Aim.Name", "ENanimCategory::Aim" },
		{ "Attack.DisplayName", "Attack" },
		{ "Attack.Name", "ENanimCategory::Attack" },
		{ "BlueprintType", "true" },
		{ "Climb.DisplayName", "Climb" },
		{ "Climb.Name", "ENanimCategory::Climb" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n * ENanimCategory\n * --------------\n * The NORMALIZED action vocabulary. The token parser (editor-side scanner, NOT\n * part of these runtime files) maps a raw <Action> token from an asset name onto\n * exactly one of these. Locomotion AND one-shots share the same enum because v1\n * scope is \"a generic scanner\" -- the system never special-cases a category, it\n * just groups variants under whichever category the parser resolved.\n *\n * uint8 underlying type so it is a cheap, blittable TMap key (see UNanimationSet)\n * and trivially network-friendly if ever needed (we replicate seeds, not this).\n */" },
#endif
		{ "Crouch.DisplayName", "Crouch" },
		{ "Crouch.Name", "ENanimCategory::Crouch" },
		{ "Death.DisplayName", "Death" },
		{ "Death.Name", "ENanimCategory::Death" },
		{ "Emote.DisplayName", "Emote" },
		{ "Emote.Name", "ENanimCategory::Emote" },
		{ "Fall.DisplayName", "Fall" },
		{ "Fall.Name", "ENanimCategory::Fall" },
		{ "Fire.DisplayName", "Fire" },
		{ "Fire.Name", "ENanimCategory::Fire" },
		{ "Hit.DisplayName", "Hit" },
		{ "Hit.Name", "ENanimCategory::Hit" },
		{ "Idle.DisplayName", "Idle" },
		{ "Idle.Name", "ENanimCategory::Idle" },
		{ "Jog.DisplayName", "Jog" },
		{ "Jog.Name", "ENanimCategory::Jog" },
		{ "Jump.DisplayName", "Jump" },
		{ "Jump.Name", "ENanimCategory::Jump" },
		{ "Land.DisplayName", "Land" },
		{ "Land.Name", "ENanimCategory::Land" },
		{ "Mantle.DisplayName", "Mantle" },
		{ "Mantle.Name", "ENanimCategory::Mantle" },
		{ "MAX.Comment", "// Sentinel: iteration bound AND canonical \"invalid / no pending action\".\n" },
		{ "MAX.Hidden", "" },
		{ "MAX.Name", "ENanimCategory::MAX" },
		{ "MAX.ToolTip", "Sentinel: iteration bound AND canonical \"invalid / no pending action\"." },
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
		{ "Pivot.DisplayName", "Pivot" },
		{ "Pivot.Name", "ENanimCategory::Pivot" },
		{ "Reload.DisplayName", "Reload" },
		{ "Reload.Name", "ENanimCategory::Reload" },
		{ "Roll.DisplayName", "Roll" },
		{ "Roll.Name", "ENanimCategory::Roll" },
		{ "Run.DisplayName", "Run" },
		{ "Run.Name", "ENanimCategory::Run" },
		{ "Slide.DisplayName", "Slide" },
		{ "Slide.Name", "ENanimCategory::Slide" },
		{ "Sprint.DisplayName", "Sprint" },
		{ "Sprint.Name", "ENanimCategory::Sprint" },
		{ "Start.DisplayName", "Start" },
		{ "Start.Name", "ENanimCategory::Start" },
		{ "Stop.DisplayName", "Stop" },
		{ "Stop.Name", "ENanimCategory::Stop" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "ENanimCategory\n--------------\nThe NORMALIZED action vocabulary. The token parser (editor-side scanner, NOT\npart of these runtime files) maps a raw <Action> token from an asset name onto\nexactly one of these. Locomotion AND one-shots share the same enum because v1\nscope is \"a generic scanner\" -- the system never special-cases a category, it\njust groups variants under whichever category the parser resolved.\n\nuint8 underlying type so it is a cheap, blittable TMap key (see UNanimationSet)\nand trivially network-friendly if ever needed (we replicate seeds, not this)." },
#endif
		{ "Turn.DisplayName", "Turn" },
		{ "Turn.Name", "ENanimCategory::Turn" },
		{ "Vault.DisplayName", "Vault" },
		{ "Vault.Name", "ENanimCategory::Vault" },
		{ "Walk.DisplayName", "Walk" },
		{ "Walk.Name", "ENanimCategory::Walk" },
	};
#endif // WITH_METADATA
	static constexpr UECodeGen_Private::FEnumeratorParam Enumerators[] = {
		{ "ENanimCategory::Idle", (int64)ENanimCategory::Idle },
		{ "ENanimCategory::Walk", (int64)ENanimCategory::Walk },
		{ "ENanimCategory::Jog", (int64)ENanimCategory::Jog },
		{ "ENanimCategory::Run", (int64)ENanimCategory::Run },
		{ "ENanimCategory::Sprint", (int64)ENanimCategory::Sprint },
		{ "ENanimCategory::Crouch", (int64)ENanimCategory::Crouch },
		{ "ENanimCategory::Jump", (int64)ENanimCategory::Jump },
		{ "ENanimCategory::Fall", (int64)ENanimCategory::Fall },
		{ "ENanimCategory::Land", (int64)ENanimCategory::Land },
		{ "ENanimCategory::Slide", (int64)ENanimCategory::Slide },
		{ "ENanimCategory::Roll", (int64)ENanimCategory::Roll },
		{ "ENanimCategory::Turn", (int64)ENanimCategory::Turn },
		{ "ENanimCategory::Pivot", (int64)ENanimCategory::Pivot },
		{ "ENanimCategory::Start", (int64)ENanimCategory::Start },
		{ "ENanimCategory::Stop", (int64)ENanimCategory::Stop },
		{ "ENanimCategory::Mantle", (int64)ENanimCategory::Mantle },
		{ "ENanimCategory::Vault", (int64)ENanimCategory::Vault },
		{ "ENanimCategory::Climb", (int64)ENanimCategory::Climb },
		{ "ENanimCategory::Aim", (int64)ENanimCategory::Aim },
		{ "ENanimCategory::Fire", (int64)ENanimCategory::Fire },
		{ "ENanimCategory::Reload", (int64)ENanimCategory::Reload },
		{ "ENanimCategory::Attack", (int64)ENanimCategory::Attack },
		{ "ENanimCategory::Hit", (int64)ENanimCategory::Hit },
		{ "ENanimCategory::Death", (int64)ENanimCategory::Death },
		{ "ENanimCategory::Emote", (int64)ENanimCategory::Emote },
		{ "ENanimCategory::MAX", (int64)ENanimCategory::MAX },
	};
	static const UECodeGen_Private::FEnumParams EnumParams;
}; // struct UHT_STATICS 
const UECodeGen_Private::FEnumParams UHT_STATICS::EnumParams = {
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_Nanimation,
	nullptr,
	"ENanimCategory",
	"ENanimCategory",
	UHT_STATICS::Enumerators,
	RF_Public|RF_Transient|RF_MarkAsNative,
	UE_ARRAY_COUNT(UHT_STATICS::Enumerators),
	EEnumFlags::None,
	(uint8)UEnum::ECppForm::EnumClass,
	(uint8)UEnum::EUnderlyingType::uint8,
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
static FEnumRegistrationInfo ZRIE_ENanimCategory;
UEnum* Z_Construct_UEnum_Nanimation_ENanimCategory(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Outer)
	{
		if (!ZRIE_ENanimCategory.OuterSingleton)
		{
			ZRIE_ENanimCategory.OuterSingleton = GetStaticEnum(Z_Construct_UEnum_Nanimation_ENanimCategory, (UObject*)Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase::Outer), TEXT("ENanimCategory"));
		}
		return ZRIE_ENanimCategory.OuterSingleton;
	}
	if (!ZRIE_ENanimCategory.InnerSingleton)
	{
		UECodeGen_Private::ConstructUEnum(ZRIE_ENanimCategory.InnerSingleton, UHT_STATICS::EnumParams);
	}
	return ZRIE_ENanimCategory.InnerSingleton;
}
#undef UHT_STATICS
// ********** End Enum ENanimCategory **************************************************************

// ********** Begin Enum ENanimDirection ***********************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UEnum_Nanimation_ENanimDirection_Statics
template<> NANIMATION_NON_ATTRIBUTED_API UEnum* StaticEnum<ENanimDirection>()
{
	return Z_Construct_UEnum_Nanimation_ENanimDirection(ETypeConstructPhase::Outer);
}
struct UHT_STATICS
{
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "BlueprintType", "true" },
		{ "Bwd.DisplayName", "Backward" },
		{ "Bwd.Name", "ENanimDirection::Bwd" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n * ENanimDirection\n * ---------------\n * Sub-axis parsed from the <Dir> token (Fwd/Bwd/Left/Right). \"None\" is the\n * non-directional default used by one-shots (e.g. a Reload has no facing).\n */" },
#endif
		{ "Fwd.DisplayName", "Forward" },
		{ "Fwd.Name", "ENanimDirection::Fwd" },
		{ "Left.DisplayName", "Left" },
		{ "Left.Name", "ENanimDirection::Left" },
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
		{ "None.DisplayName", "None" },
		{ "None.Name", "ENanimDirection::None" },
		{ "Right.DisplayName", "Right" },
		{ "Right.Name", "ENanimDirection::Right" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "ENanimDirection\n---------------\nSub-axis parsed from the <Dir> token (Fwd/Bwd/Left/Right). \"None\" is the\nnon-directional default used by one-shots (e.g. a Reload has no facing)." },
#endif
	};
#endif // WITH_METADATA
	static constexpr UECodeGen_Private::FEnumeratorParam Enumerators[] = {
		{ "ENanimDirection::None", (int64)ENanimDirection::None },
		{ "ENanimDirection::Fwd", (int64)ENanimDirection::Fwd },
		{ "ENanimDirection::Bwd", (int64)ENanimDirection::Bwd },
		{ "ENanimDirection::Left", (int64)ENanimDirection::Left },
		{ "ENanimDirection::Right", (int64)ENanimDirection::Right },
	};
	static const UECodeGen_Private::FEnumParams EnumParams;
}; // struct UHT_STATICS 
const UECodeGen_Private::FEnumParams UHT_STATICS::EnumParams = {
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_Nanimation,
	nullptr,
	"ENanimDirection",
	"ENanimDirection",
	UHT_STATICS::Enumerators,
	RF_Public|RF_Transient|RF_MarkAsNative,
	UE_ARRAY_COUNT(UHT_STATICS::Enumerators),
	EEnumFlags::None,
	(uint8)UEnum::ECppForm::EnumClass,
	(uint8)UEnum::EUnderlyingType::uint8,
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
static FEnumRegistrationInfo ZRIE_ENanimDirection;
UEnum* Z_Construct_UEnum_Nanimation_ENanimDirection(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Outer)
	{
		if (!ZRIE_ENanimDirection.OuterSingleton)
		{
			ZRIE_ENanimDirection.OuterSingleton = GetStaticEnum(Z_Construct_UEnum_Nanimation_ENanimDirection, (UObject*)Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase::Outer), TEXT("ENanimDirection"));
		}
		return ZRIE_ENanimDirection.OuterSingleton;
	}
	if (!ZRIE_ENanimDirection.InnerSingleton)
	{
		UECodeGen_Private::ConstructUEnum(ZRIE_ENanimDirection.InnerSingleton, UHT_STATICS::EnumParams);
	}
	return ZRIE_ENanimDirection.InnerSingleton;
}
#undef UHT_STATICS
// ********** End Enum ENanimDirection *************************************************************

// ********** Begin Enum ENanimStance **************************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UEnum_Nanimation_ENanimStance_Statics
template<> NANIMATION_NON_ATTRIBUTED_API UEnum* StaticEnum<ENanimStance>()
{
	return Z_Construct_UEnum_Nanimation_ENanimStance(ETypeConstructPhase::Outer);
}
struct UHT_STATICS
{
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "ADS.DisplayName", "ADS" },
		{ "ADS.Name", "ENanimStance::ADS" },
		{ "BlueprintType", "true" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n * ENanimStance\n * ------------\n * Sub-axis parsed from the <Stance> token. Mirrors GASP-style naming\n * (Neutral / Crouch / ADS). \"None\" = stance-agnostic.\n */" },
#endif
		{ "Crouch.DisplayName", "Crouch" },
		{ "Crouch.Name", "ENanimStance::Crouch" },
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
		{ "Neutral.DisplayName", "Neutral" },
		{ "Neutral.Name", "ENanimStance::Neutral" },
		{ "None.DisplayName", "None" },
		{ "None.Name", "ENanimStance::None" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "ENanimStance\n------------\nSub-axis parsed from the <Stance> token. Mirrors GASP-style naming\n(Neutral / Crouch / ADS). \"None\" = stance-agnostic." },
#endif
	};
#endif // WITH_METADATA
	static constexpr UECodeGen_Private::FEnumeratorParam Enumerators[] = {
		{ "ENanimStance::None", (int64)ENanimStance::None },
		{ "ENanimStance::Neutral", (int64)ENanimStance::Neutral },
		{ "ENanimStance::Crouch", (int64)ENanimStance::Crouch },
		{ "ENanimStance::ADS", (int64)ENanimStance::ADS },
	};
	static const UECodeGen_Private::FEnumParams EnumParams;
}; // struct UHT_STATICS 
const UECodeGen_Private::FEnumParams UHT_STATICS::EnumParams = {
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_Nanimation,
	nullptr,
	"ENanimStance",
	"ENanimStance",
	UHT_STATICS::Enumerators,
	RF_Public|RF_Transient|RF_MarkAsNative,
	UE_ARRAY_COUNT(UHT_STATICS::Enumerators),
	EEnumFlags::None,
	(uint8)UEnum::ECppForm::EnumClass,
	(uint8)UEnum::EUnderlyingType::uint8,
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
static FEnumRegistrationInfo ZRIE_ENanimStance;
UEnum* Z_Construct_UEnum_Nanimation_ENanimStance(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Outer)
	{
		if (!ZRIE_ENanimStance.OuterSingleton)
		{
			ZRIE_ENanimStance.OuterSingleton = GetStaticEnum(Z_Construct_UEnum_Nanimation_ENanimStance, (UObject*)Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase::Outer), TEXT("ENanimStance"));
		}
		return ZRIE_ENanimStance.OuterSingleton;
	}
	if (!ZRIE_ENanimStance.InnerSingleton)
	{
		UECodeGen_Private::ConstructUEnum(ZRIE_ENanimStance.InnerSingleton, UHT_STATICS::EnumParams);
	}
	return ZRIE_ENanimStance.InnerSingleton;
}
#undef UHT_STATICS
// ********** End Enum ENanimStance ****************************************************************

// ********** Begin Enum ENanimPolicy **************************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UEnum_Nanimation_ENanimPolicy_Statics
template<> NANIMATION_NON_ATTRIBUTED_API UEnum* StaticEnum<ENanimPolicy>()
{
	return Z_Construct_UEnum_Nanimation_ENanimPolicy(ETypeConstructPhase::Outer);
}
struct UHT_STATICS
{
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "BlueprintType", "true" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n * ENanimPolicy\n * ------------\n * How a single FNanimAction chooses among its variants. ALL policies are\n * evaluated as PURE functions of (FRandomStream state, bag state) so that two\n * machines replaying the same (seed, draw-count) pick the same variant -- this is\n * the backbone of the seed-replication network model.\n *\n *   Uniform          : flat random pick (RandRange).\n *   Weighted         : pick proportional to FNanimVariant::Weight.\n *   NoImmediateRepeat: like Uniform/Weighted but never returns LastIndex twice.\n *   ShuffleBag       : draw without replacement from a shuffled bag, refill when\n *                      empty (default policy -- best perceived randomness).\n */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
		{ "NoImmediateRepeat.DisplayName", "No Immediate Repeat" },
		{ "NoImmediateRepeat.Name", "ENanimPolicy::NoImmediateRepeat" },
		{ "ShuffleBag.DisplayName", "Shuffle Bag" },
		{ "ShuffleBag.Name", "ENanimPolicy::ShuffleBag" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "ENanimPolicy\n------------\nHow a single FNanimAction chooses among its variants. ALL policies are\nevaluated as PURE functions of (FRandomStream state, bag state) so that two\nmachines replaying the same (seed, draw-count) pick the same variant -- this is\nthe backbone of the seed-replication network model.\n\n  Uniform          : flat random pick (RandRange).\n  Weighted         : pick proportional to FNanimVariant::Weight.\n  NoImmediateRepeat: like Uniform/Weighted but never returns LastIndex twice.\n  ShuffleBag       : draw without replacement from a shuffled bag, refill when\n                     empty (default policy -- best perceived randomness)." },
#endif
		{ "Uniform.DisplayName", "Uniform" },
		{ "Uniform.Name", "ENanimPolicy::Uniform" },
		{ "Weighted.DisplayName", "Weighted" },
		{ "Weighted.Name", "ENanimPolicy::Weighted" },
	};
#endif // WITH_METADATA
	static constexpr UECodeGen_Private::FEnumeratorParam Enumerators[] = {
		{ "ENanimPolicy::Uniform", (int64)ENanimPolicy::Uniform },
		{ "ENanimPolicy::Weighted", (int64)ENanimPolicy::Weighted },
		{ "ENanimPolicy::NoImmediateRepeat", (int64)ENanimPolicy::NoImmediateRepeat },
		{ "ENanimPolicy::ShuffleBag", (int64)ENanimPolicy::ShuffleBag },
	};
	static const UECodeGen_Private::FEnumParams EnumParams;
}; // struct UHT_STATICS 
const UECodeGen_Private::FEnumParams UHT_STATICS::EnumParams = {
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_Nanimation,
	nullptr,
	"ENanimPolicy",
	"ENanimPolicy",
	UHT_STATICS::Enumerators,
	RF_Public|RF_Transient|RF_MarkAsNative,
	UE_ARRAY_COUNT(UHT_STATICS::Enumerators),
	EEnumFlags::None,
	(uint8)UEnum::ECppForm::EnumClass,
	(uint8)UEnum::EUnderlyingType::uint8,
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
static FEnumRegistrationInfo ZRIE_ENanimPolicy;
UEnum* Z_Construct_UEnum_Nanimation_ENanimPolicy(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Outer)
	{
		if (!ZRIE_ENanimPolicy.OuterSingleton)
		{
			ZRIE_ENanimPolicy.OuterSingleton = GetStaticEnum(Z_Construct_UEnum_Nanimation_ENanimPolicy, (UObject*)Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase::Outer), TEXT("ENanimPolicy"));
		}
		return ZRIE_ENanimPolicy.OuterSingleton;
	}
	if (!ZRIE_ENanimPolicy.InnerSingleton)
	{
		UECodeGen_Private::ConstructUEnum(ZRIE_ENanimPolicy.InnerSingleton, UHT_STATICS::EnumParams);
	}
	return ZRIE_ENanimPolicy.InnerSingleton;
}
#undef UHT_STATICS
// ********** End Enum ENanimPolicy ****************************************************************

// ********** Begin Enum ENanimNetMode *************************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UEnum_Nanimation_ENanimNetMode_Statics
template<> NANIMATION_NON_ATTRIBUTED_API UEnum* StaticEnum<ENanimNetMode>()
{
	return Z_Construct_UEnum_Nanimation_ENanimNetMode(ETypeConstructPhase::Outer);
}
struct UHT_STATICS
{
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "BlueprintType", "true" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n * ENanimNetMode\n * -------------\n * Per-category routing flag (LOCKED decision: HYBRID networking).\n *   Replicated   : gameplay-relevant; the chosen variant must agree across the\n *                  network. We replicate ONLY a tiny pulse (base seed + draw\n *                  counter + category, see FNanimActionPulse) and re-derive the\n *                  pick locally as a PURE function. NEVER replicate the asset or\n *                  an index by RPC.\n *   LocalCosmetic: cosmetic flourish (idle-breaks); each client picks its own\n *                  using a LOCAL stateful bag, no replication, no bandwidth.\n */" },
#endif
		{ "LocalCosmetic.DisplayName", "Local Cosmetic" },
		{ "LocalCosmetic.Name", "ENanimNetMode::LocalCosmetic" },
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
		{ "Replicated.DisplayName", "Replicated (seed-synced)" },
		{ "Replicated.Name", "ENanimNetMode::Replicated" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "ENanimNetMode\n-------------\nPer-category routing flag (LOCKED decision: HYBRID networking).\n  Replicated   : gameplay-relevant; the chosen variant must agree across the\n                 network. We replicate ONLY a tiny pulse (base seed + draw\n                 counter + category, see FNanimActionPulse) and re-derive the\n                 pick locally as a PURE function. NEVER replicate the asset or\n                 an index by RPC.\n  LocalCosmetic: cosmetic flourish (idle-breaks); each client picks its own\n                 using a LOCAL stateful bag, no replication, no bandwidth." },
#endif
	};
#endif // WITH_METADATA
	static constexpr UECodeGen_Private::FEnumeratorParam Enumerators[] = {
		{ "ENanimNetMode::Replicated", (int64)ENanimNetMode::Replicated },
		{ "ENanimNetMode::LocalCosmetic", (int64)ENanimNetMode::LocalCosmetic },
	};
	static const UECodeGen_Private::FEnumParams EnumParams;
}; // struct UHT_STATICS 
const UECodeGen_Private::FEnumParams UHT_STATICS::EnumParams = {
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_Nanimation,
	nullptr,
	"ENanimNetMode",
	"ENanimNetMode",
	UHT_STATICS::Enumerators,
	RF_Public|RF_Transient|RF_MarkAsNative,
	UE_ARRAY_COUNT(UHT_STATICS::Enumerators),
	EEnumFlags::None,
	(uint8)UEnum::ECppForm::EnumClass,
	(uint8)UEnum::EUnderlyingType::uint8,
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
static FEnumRegistrationInfo ZRIE_ENanimNetMode;
UEnum* Z_Construct_UEnum_Nanimation_ENanimNetMode(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Outer)
	{
		if (!ZRIE_ENanimNetMode.OuterSingleton)
		{
			ZRIE_ENanimNetMode.OuterSingleton = GetStaticEnum(Z_Construct_UEnum_Nanimation_ENanimNetMode, (UObject*)Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase::Outer), TEXT("ENanimNetMode"));
		}
		return ZRIE_ENanimNetMode.OuterSingleton;
	}
	if (!ZRIE_ENanimNetMode.InnerSingleton)
	{
		UECodeGen_Private::ConstructUEnum(ZRIE_ENanimNetMode.InnerSingleton, UHT_STATICS::EnumParams);
	}
	return ZRIE_ENanimNetMode.InnerSingleton;
}
#undef UHT_STATICS
// ********** End Enum ENanimNetMode ***************************************************************

// ********** Begin ScriptStruct FNanimVariant *****************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UScriptStruct_FNanimVariant_Statics
struct UHT_STATICS
{
	static inline consteval int32 GetStructSize() { return DataSizeOf<FNanimVariant>(); }
	static inline consteval int16 GetStructAlignment() { return alignof(FNanimVariant); }
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "BlueprintType", "true" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n * FNanimVariant\n * -------------\n * One concrete animation choice inside an action group.\n *\n * WHY TSoftObjectPtr: per LOCKED decision, big volumes (GASP ~1828 seqs) must\n * not be hard-referenced or they all cook+load resident. Soft refs let the\n * Component/Library async-resolve only the variant that was actually picked.\n * (Hot, small sets can still be assigned and will simply resolve instantly.)\n */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "FNanimVariant\n-------------\nOne concrete animation choice inside an action group.\n\nWHY TSoftObjectPtr: per LOCKED decision, big volumes (GASP ~1828 seqs) must\nnot be hard-referenced or they all cook+load resident. Soft refs let the\nComponent/Library async-resolve only the variant that was actually picked.\n(Hot, small sets can still be assigned and will simply resolve instantly.)" },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Animation_MetaData[] = {
		{ "Category", "Nanimation|Variant" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** The animation (sequence or montage-source) for this variant. Soft so huge\n\x09 *  libraries stay off-resident until picked & async-loaded. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "The animation (sequence or montage-source) for this variant. Soft so huge\nlibraries stay off-resident until picked & async-loaded." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Weight_MetaData[] = {
		{ "Category", "Nanimation|Variant" },
		{ "ClampMin", "0.0" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Relative weight for Weighted / ShuffleBag. Values <= 0 are treated as\n\x09 *  \"never pick\" by the library; if ALL variants are zero-weight, every policy\n\x09 *  degrades to a Uniform fallback (documented in NanimationLibrary.h). Default\n\x09 *  1 = equal odds. MUST be identical bits on every machine (it comes from the\n\x09 *  same cooked asset and is never computed at runtime) or replicated picks\n\x09 *  could diverge. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Relative weight for Weighted / ShuffleBag. Values <= 0 are treated as\n\"never pick\" by the library; if ALL variants are zero-weight, every policy\ndegrades to a Uniform fallback (documented in NanimationLibrary.h). Default\n1 = equal odds. MUST be identical bits on every machine (it comes from the\nsame cooked asset and is never computed at runtime) or replicated picks\ncould diverge." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Dir_MetaData[] = {
		{ "Category", "Nanimation|Variant" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Direction sub-axis this variant satisfies (filter key for locomotion). */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Direction sub-axis this variant satisfies (filter key for locomotion)." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Stance_MetaData[] = {
		{ "Category", "Nanimation|Variant" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Stance sub-axis this variant satisfies (filter key for stance blends). */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Stance sub-axis this variant satisfies (filter key for stance blends)." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin ScriptStruct FNanimVariant constinit property declarations *********************
	static const UECodeGen_Private::FSoftObjectPropertyParams NewProp_Animation;
	static const UECodeGen_Private::FFloatPropertyParams NewProp_Weight;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Dir_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Dir;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Stance_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Stance;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End ScriptStruct FNanimVariant constinit property declarations ***********************
	static void* NewStructOps()
	{
		return (UScriptStruct::ICppStructOps*)new UScriptStruct::TCppStructOps<FNanimVariant>();
	}
	static const UECodeGen_Private::FStructParams StructParams;
}; // struct UHT_STATICS

// ********** Begin ScriptStruct FNanimVariant Property Definitions ********************************
const UECodeGen_Private::FSoftObjectPropertyParams UHT_STATICS::NewProp_Animation = { "Animation", nullptr, (EPropertyFlags)0x0014000000000005, UECodeGen_Private::EPropertyGenFlags::SoftObject, nullptr, nullptr, 1, STRUCT_OFFSET(FNanimVariant, Animation), Z_Construct_UClass_UAnimSequenceBase, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Animation_MetaData), NewProp_Animation_MetaData) };
const UECodeGen_Private::FFloatPropertyParams UHT_STATICS::NewProp_Weight = { "Weight", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Float, nullptr, nullptr, 1, STRUCT_OFFSET(FNanimVariant, Weight), METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Weight_MetaData), NewProp_Weight_MetaData) };
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Dir_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Dir = { "Dir", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(FNanimVariant, Dir), Z_Construct_UEnum_Nanimation_ENanimDirection, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Dir_MetaData), NewProp_Dir_MetaData) }; // b25cabd55150fca584aaae69fed07d8ad672b0d7
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Stance_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Stance = { "Stance", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(FNanimVariant, Stance), Z_Construct_UEnum_Nanimation_ENanimStance, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Stance_MetaData), NewProp_Stance_MetaData) }; // 39f444116cccb25a5b0e4dc3fbfa9c6314e45569
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Animation,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Weight,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Dir_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Dir,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Stance_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Stance,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End ScriptStruct FNanimVariant Property Definitions **********************************
const UECodeGen_Private::FStructParams UHT_STATICS::StructParams = {
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_Nanimation,
	nullptr,
	&NewStructOps,
	"NanimVariant",
	UHT_STATICS::PropPointers,
	UE_ARRAY_COUNT(UHT_STATICS::PropPointers),
	DataSizeOf<FNanimVariant>(),
	alignof(FNanimVariant),
	RF_Public|RF_Transient|RF_MarkAsNative,
	EStructFlags(0x00000201),
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
static FStructRegistrationInfo Z_Registration_Info_UScriptStruct_FNanimVariant;
UScriptStruct* Z_Construct_UScriptStruct_FNanimVariant(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Outer)
	{
		if (!Z_Registration_Info_UScriptStruct_FNanimVariant.OuterSingleton)
		{
			Z_Registration_Info_UScriptStruct_FNanimVariant.OuterSingleton = GetStaticStruct(Z_Construct_UScriptStruct_FNanimVariant, (UObject*)Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase::Outer), TEXT("NanimVariant"));
		}
		return Z_Registration_Info_UScriptStruct_FNanimVariant.OuterSingleton;
	}
	if (!Z_Registration_Info_UScriptStruct_FNanimVariant.InnerSingleton)
	{
		UECodeGen_Private::ConstructUScriptStruct(Z_Registration_Info_UScriptStruct_FNanimVariant.InnerSingleton, UHT_STATICS::StructParams);
	}
	return CastChecked<UScriptStruct>(Z_Registration_Info_UScriptStruct_FNanimVariant.InnerSingleton);
}
#undef UHT_STATICS
// ********** End ScriptStruct FNanimVariant *******************************************************

// ********** Begin ScriptStruct FNanimAction ******************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UScriptStruct_FNanimAction_Statics
struct UHT_STATICS
{
	static inline consteval int32 GetStructSize() { return DataSizeOf<FNanimAction>(); }
	static inline consteval int16 GetStructAlignment() { return alignof(FNanimAction); }
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "BlueprintType", "true" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n * FNanimAction\n * ------------\n * A group of interchangeable variants for ONE category, plus the policy used to\n * pick among them and the network routing for that category. This is the unit\n * the picker operates on and the unit the AnimNode embeds.\n */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "FNanimAction\n------------\nA group of interchangeable variants for ONE category, plus the policy used to\npick among them and the network routing for that category. This is the unit\nthe picker operates on and the unit the AnimNode embeds." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Variants_MetaData[] = {
		{ "Category", "Nanimation|Action" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** All interchangeable takes for this action (built by the scanner). */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "All interchangeable takes for this action (built by the scanner)." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Policy_MetaData[] = {
		{ "Category", "Nanimation|Action" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Selection policy. ShuffleBag is the project default (best feel). */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Selection policy. ShuffleBag is the project default (best feel)." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_NetMode_MetaData[] = {
		{ "Category", "Nanimation|Action" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Replicated (seed-synced) vs LocalCosmetic. Drives Component routing. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Replicated (seed-synced) vs LocalCosmetic. Drives Component routing." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin ScriptStruct FNanimAction constinit property declarations **********************
	static const UECodeGen_Private::FStructPropertyParams NewProp_Variants_Inner;
	static const UECodeGen_Private::FArrayPropertyParams NewProp_Variants;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Policy_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Policy;
	static const UECodeGen_Private::FBytePropertyParams NewProp_NetMode_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_NetMode;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End ScriptStruct FNanimAction constinit property declarations ************************
	static void* NewStructOps()
	{
		return (UScriptStruct::ICppStructOps*)new UScriptStruct::TCppStructOps<FNanimAction>();
	}
	static const UECodeGen_Private::FStructParams StructParams;
}; // struct UHT_STATICS

// ********** Begin ScriptStruct FNanimAction Property Definitions *********************************
const UECodeGen_Private::FStructPropertyParams UHT_STATICS::NewProp_Variants_Inner = { "Variants", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Struct, nullptr, nullptr, 1, 0, Z_Construct_UScriptStruct_FNanimVariant, METADATA_PARAMS(0, nullptr) }; // 58696e072a219f4dc97076853fd1b508ff301064
const UECodeGen_Private::FArrayPropertyParams UHT_STATICS::NewProp_Variants = { "Variants", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Array, nullptr, nullptr, 1, STRUCT_OFFSET(FNanimAction, Variants), EArrayPropertyFlags::None, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Variants_MetaData), NewProp_Variants_MetaData) }; // 58696e072a219f4dc97076853fd1b508ff301064
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Policy_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Policy = { "Policy", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(FNanimAction, Policy), Z_Construct_UEnum_Nanimation_ENanimPolicy, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Policy_MetaData), NewProp_Policy_MetaData) }; // ff2d4bf7a9956dc4a22bb10c4b61531d958176c8
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_NetMode_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_NetMode = { "NetMode", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(FNanimAction, NetMode), Z_Construct_UEnum_Nanimation_ENanimNetMode, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_NetMode_MetaData), NewProp_NetMode_MetaData) }; // c89fc8be8c49e3a5816d311854fd9912f3360c84
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Variants_Inner,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Variants,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Policy_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Policy,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_NetMode_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_NetMode,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End ScriptStruct FNanimAction Property Definitions ***********************************
const UECodeGen_Private::FStructParams UHT_STATICS::StructParams = {
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_Nanimation,
	nullptr,
	&NewStructOps,
	"NanimAction",
	UHT_STATICS::PropPointers,
	UE_ARRAY_COUNT(UHT_STATICS::PropPointers),
	DataSizeOf<FNanimAction>(),
	alignof(FNanimAction),
	RF_Public|RF_Transient|RF_MarkAsNative,
	EStructFlags(0x00000201),
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
static FStructRegistrationInfo Z_Registration_Info_UScriptStruct_FNanimAction;
UScriptStruct* Z_Construct_UScriptStruct_FNanimAction(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Outer)
	{
		if (!Z_Registration_Info_UScriptStruct_FNanimAction.OuterSingleton)
		{
			Z_Registration_Info_UScriptStruct_FNanimAction.OuterSingleton = GetStaticStruct(Z_Construct_UScriptStruct_FNanimAction, (UObject*)Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase::Outer), TEXT("NanimAction"));
		}
		return Z_Registration_Info_UScriptStruct_FNanimAction.OuterSingleton;
	}
	if (!Z_Registration_Info_UScriptStruct_FNanimAction.InnerSingleton)
	{
		UECodeGen_Private::ConstructUScriptStruct(Z_Registration_Info_UScriptStruct_FNanimAction.InnerSingleton, UHT_STATICS::StructParams);
	}
	return CastChecked<UScriptStruct>(Z_Registration_Info_UScriptStruct_FNanimAction.InnerSingleton);
}
#undef UHT_STATICS
// ********** End ScriptStruct FNanimAction ********************************************************

// ********** Begin ScriptStruct FNanimPickContext *************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UScriptStruct_FNanimPickContext_Statics
struct UHT_STATICS
{
	static inline consteval int32 GetStructSize() { return DataSizeOf<FNanimPickContext>(); }
	static inline consteval int16 GetStructAlignment() { return alignof(FNanimPickContext); }
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "BlueprintType", "true" },
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n * FNanimPickContext\n * -----------------\n * Optional filter axes passed to the picker. Dir/Stance = None means \"don't\n * filter on this axis\". The filter is applied BEFORE the policy picks, so the\n * subset is deterministic (derived from array order).\n */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "FNanimPickContext\n-----------------\nOptional filter axes passed to the picker. Dir/Stance = None means \"don't\nfilter on this axis\". The filter is applied BEFORE the policy picks, so the\nsubset is deterministic (derived from array order)." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Dir_MetaData[] = {
		{ "Category", "Nanimation|Context" },
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Stance_MetaData[] = {
		{ "Category", "Nanimation|Context" },
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
	};
#endif // WITH_METADATA

// ********** Begin ScriptStruct FNanimPickContext constinit property declarations *****************
	static const UECodeGen_Private::FBytePropertyParams NewProp_Dir_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Dir;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Stance_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Stance;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End ScriptStruct FNanimPickContext constinit property declarations *******************
	static void* NewStructOps()
	{
		return (UScriptStruct::ICppStructOps*)new UScriptStruct::TCppStructOps<FNanimPickContext>();
	}
	static const UECodeGen_Private::FStructParams StructParams;
}; // struct UHT_STATICS

// ********** Begin ScriptStruct FNanimPickContext Property Definitions ****************************
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Dir_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Dir = { "Dir", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(FNanimPickContext, Dir), Z_Construct_UEnum_Nanimation_ENanimDirection, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Dir_MetaData), NewProp_Dir_MetaData) }; // b25cabd55150fca584aaae69fed07d8ad672b0d7
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Stance_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Stance = { "Stance", nullptr, (EPropertyFlags)0x0010000000000005, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(FNanimPickContext, Stance), Z_Construct_UEnum_Nanimation_ENanimStance, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Stance_MetaData), NewProp_Stance_MetaData) }; // 39f444116cccb25a5b0e4dc3fbfa9c6314e45569
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Dir_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Dir,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Stance_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Stance,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End ScriptStruct FNanimPickContext Property Definitions ******************************
const UECodeGen_Private::FStructParams UHT_STATICS::StructParams = {
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_Nanimation,
	nullptr,
	&NewStructOps,
	"NanimPickContext",
	UHT_STATICS::PropPointers,
	UE_ARRAY_COUNT(UHT_STATICS::PropPointers),
	DataSizeOf<FNanimPickContext>(),
	alignof(FNanimPickContext),
	RF_Public|RF_Transient|RF_MarkAsNative,
	EStructFlags(0x00000201),
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
static FStructRegistrationInfo Z_Registration_Info_UScriptStruct_FNanimPickContext;
UScriptStruct* Z_Construct_UScriptStruct_FNanimPickContext(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Outer)
	{
		if (!Z_Registration_Info_UScriptStruct_FNanimPickContext.OuterSingleton)
		{
			Z_Registration_Info_UScriptStruct_FNanimPickContext.OuterSingleton = GetStaticStruct(Z_Construct_UScriptStruct_FNanimPickContext, (UObject*)Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase::Outer), TEXT("NanimPickContext"));
		}
		return Z_Registration_Info_UScriptStruct_FNanimPickContext.OuterSingleton;
	}
	if (!Z_Registration_Info_UScriptStruct_FNanimPickContext.InnerSingleton)
	{
		UECodeGen_Private::ConstructUScriptStruct(Z_Registration_Info_UScriptStruct_FNanimPickContext.InnerSingleton, UHT_STATICS::StructParams);
	}
	return CastChecked<UScriptStruct>(Z_Registration_Info_UScriptStruct_FNanimPickContext.InnerSingleton);
}
#undef UHT_STATICS
// ********** End ScriptStruct FNanimPickContext ***************************************************

// ********** Begin ScriptStruct FNanimActionPulse *************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UScriptStruct_FNanimActionPulse_Statics
struct UHT_STATICS
{
	static inline consteval int32 GetStructSize() { return DataSizeOf<FNanimActionPulse>(); }
	static inline consteval int16 GetStructAlignment() { return alignof(FNanimActionPulse); }
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
#if !UE_BUILD_SHIPPING
		{ "Comment", "/**\n * FNanimActionPulse\n * -----------------\n * The ENTIRE network payload for a Replicated-category pick (~20 bytes). It is\n * replicated ATOMICALLY (one property, one RepNotify) so the category and the\n * draw context can never arrive split across bunches.\n *\n * Per-category coalescing: within a single category, multiple advances in one\n * net-update window coalesce harmlessly (latest DrawCount replays to the same\n * index). Across different categories, the component now maintains a\n * TArray<FNanimActionPulse> to avoid cross-category event loss.\n *\n * WHY (Seed + DrawCount) and not a single seed:\n *   A bare replicated int32 seed is STATE, not an event queue -- if the server\n *   advances it several times inside one net-update window the intermediate\n *   values coalesce and only the latest arrives. If the local pick depended on a\n *   persistent per-machine bag advanced once-per-arrival, clients would advance\n *   their bag fewer times than the server and desync. Replicating a monotonic\n *   DrawCount alongside a STABLE base Seed makes the pick a PURE function:\n *   \"replay DrawCount deterministic draws from FRandomStream(Seed)\". Coalescing\n *   is harmless (replay lands on the same index), late-joiners just replay from 0,\n *   and ShuffleBag's exhaust-before-repeat feel is preserved exactly.\n *\n * Seed rebase: when DrawCount reaches NanimationConstants::RebaseThreshold,\n * the authority recomputes its CURRENT base seed via HashCombine(Seed, DrawCount)\n * and resets DrawCount to 1. The rebased seed IS the one placed into the next\n * pulse (NanimationComponent::CurrentBaseSeeds tracks it per category on the\n * authority) \xe2\x80\x94 the sequence of variants therefore genuinely changes after a\n * rebase instead of looping back to the pre-rebase sequence.\n */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "FNanimActionPulse\n-----------------\nThe ENTIRE network payload for a Replicated-category pick (~20 bytes). It is\nreplicated ATOMICALLY (one property, one RepNotify) so the category and the\ndraw context can never arrive split across bunches.\n\nPer-category coalescing: within a single category, multiple advances in one\nnet-update window coalesce harmlessly (latest DrawCount replays to the same\nindex). Across different categories, the component now maintains a\nTArray<FNanimActionPulse> to avoid cross-category event loss.\n\nWHY (Seed + DrawCount) and not a single seed:\n  A bare replicated int32 seed is STATE, not an event queue -- if the server\n  advances it several times inside one net-update window the intermediate\n  values coalesce and only the latest arrives. If the local pick depended on a\n  persistent per-machine bag advanced once-per-arrival, clients would advance\n  their bag fewer times than the server and desync. Replicating a monotonic\n  DrawCount alongside a STABLE base Seed makes the pick a PURE function:\n  \"replay DrawCount deterministic draws from FRandomStream(Seed)\". Coalescing\n  is harmless (replay lands on the same index), late-joiners just replay from 0,\n  and ShuffleBag's exhaust-before-repeat feel is preserved exactly.\n\nSeed rebase: when DrawCount reaches NanimationConstants::RebaseThreshold,\nthe authority recomputes its CURRENT base seed via HashCombine(Seed, DrawCount)\nand resets DrawCount to 1. The rebased seed IS the one placed into the next\npulse (NanimationComponent::CurrentBaseSeeds tracks it per category on the\nauthority) \xe2\x80\x94 the sequence of variants therefore genuinely changes after a\nrebase instead of looping back to the pre-rebase sequence." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Seed_MetaData[] = {
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Stable base seed for the category's deterministic draw sequence. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Stable base seed for the category's deterministic draw sequence." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_DrawCount_MetaData[] = {
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Monotonically increasing number of draws performed for this category. The\n\x09 *  current pick is the result of the DrawCount-th draw. 0 = no action yet.\n\x09 *  Also guarantees the property changes every action so the RepNotify fires. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Monotonically increasing number of draws performed for this category. The\ncurrent pick is the result of the DrawCount-th draw. 0 = no action yet.\nAlso guarantees the property changes every action so the RepNotify fires." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Category_MetaData[] = {
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Which category this pulse selects for. Valid only when DrawCount > 0. */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Which category this pulse selects for. Valid only when DrawCount > 0." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Dir_MetaData[] = {
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Direction context (filter axis for locomotion picks). */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Direction context (filter axis for locomotion picks)." },
#endif
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Stance_MetaData[] = {
#if !UE_BUILD_SHIPPING
		{ "Comment", "/** Stance context (filter axis for stance picks). */" },
#endif
		{ "ModuleRelativePath", "Public/NanimationTypes.h" },
#if !UE_BUILD_SHIPPING
		{ "ToolTip", "Stance context (filter axis for stance picks)." },
#endif
	};
#endif // WITH_METADATA

// ********** Begin ScriptStruct FNanimActionPulse constinit property declarations *****************
	static const UECodeGen_Private::FIntPropertyParams NewProp_Seed;
	static const UECodeGen_Private::FIntPropertyParams NewProp_DrawCount;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Category_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Category;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Dir_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Dir;
	static const UECodeGen_Private::FBytePropertyParams NewProp_Stance_Underlying;
	static const UECodeGen_Private::FEnumPropertyParams NewProp_Stance;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End ScriptStruct FNanimActionPulse constinit property declarations *******************
	static void* NewStructOps()
	{
		return (UScriptStruct::ICppStructOps*)new UScriptStruct::TCppStructOps<FNanimActionPulse>();
	}
	static const UECodeGen_Private::FStructParams StructParams;
}; // struct UHT_STATICS

// ********** Begin ScriptStruct FNanimActionPulse Property Definitions ****************************
const UECodeGen_Private::FIntPropertyParams UHT_STATICS::NewProp_Seed = { "Seed", nullptr, (EPropertyFlags)0x0010000000000000, UECodeGen_Private::EPropertyGenFlags::Int, nullptr, nullptr, 1, STRUCT_OFFSET(FNanimActionPulse, Seed), METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Seed_MetaData), NewProp_Seed_MetaData) };
const UECodeGen_Private::FIntPropertyParams UHT_STATICS::NewProp_DrawCount = { "DrawCount", nullptr, (EPropertyFlags)0x0010000000000000, UECodeGen_Private::EPropertyGenFlags::Int, nullptr, nullptr, 1, STRUCT_OFFSET(FNanimActionPulse, DrawCount), METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_DrawCount_MetaData), NewProp_DrawCount_MetaData) };
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Category_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Category = { "Category", nullptr, (EPropertyFlags)0x0010000000000000, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(FNanimActionPulse, Category), Z_Construct_UEnum_Nanimation_ENanimCategory, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Category_MetaData), NewProp_Category_MetaData) }; // aa849c0533a1b8ada989c9b7cd65620151f02da6
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Dir_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Dir = { "Dir", nullptr, (EPropertyFlags)0x0010000000000000, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(FNanimActionPulse, Dir), Z_Construct_UEnum_Nanimation_ENanimDirection, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Dir_MetaData), NewProp_Dir_MetaData) }; // b25cabd55150fca584aaae69fed07d8ad672b0d7
const UECodeGen_Private::FBytePropertyParams UHT_STATICS::NewProp_Stance_Underlying = { "UnderlyingType", nullptr, (EPropertyFlags)0x0000000000000000, UECodeGen_Private::EPropertyGenFlags::Byte, nullptr, nullptr, 1, 0, nullptr, METADATA_PARAMS(0, nullptr) };
const UECodeGen_Private::FEnumPropertyParams UHT_STATICS::NewProp_Stance = { "Stance", nullptr, (EPropertyFlags)0x0010000000000000, UECodeGen_Private::EPropertyGenFlags::Enum, nullptr, nullptr, 1, STRUCT_OFFSET(FNanimActionPulse, Stance), Z_Construct_UEnum_Nanimation_ENanimStance, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Stance_MetaData), NewProp_Stance_MetaData) }; // 39f444116cccb25a5b0e4dc3fbfa9c6314e45569
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Seed,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_DrawCount,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Category,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Dir_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Dir,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Stance_Underlying,
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Stance,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End ScriptStruct FNanimActionPulse Property Definitions ******************************
const UECodeGen_Private::FStructParams UHT_STATICS::StructParams = {
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_Nanimation,
	nullptr,
	&NewStructOps,
	"NanimActionPulse",
	UHT_STATICS::PropPointers,
	UE_ARRAY_COUNT(UHT_STATICS::PropPointers),
	DataSizeOf<FNanimActionPulse>(),
	alignof(FNanimActionPulse),
	RF_Public|RF_Transient|RF_MarkAsNative,
	EStructFlags(0x00000201),
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
static FStructRegistrationInfo Z_Registration_Info_UScriptStruct_FNanimActionPulse;
UScriptStruct* Z_Construct_UScriptStruct_FNanimActionPulse(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Outer)
	{
		if (!Z_Registration_Info_UScriptStruct_FNanimActionPulse.OuterSingleton)
		{
			Z_Registration_Info_UScriptStruct_FNanimActionPulse.OuterSingleton = GetStaticStruct(Z_Construct_UScriptStruct_FNanimActionPulse, (UObject*)Z_Construct_UPackage__Script_Nanimation(ETypeConstructPhase::Outer), TEXT("NanimActionPulse"));
		}
		return Z_Registration_Info_UScriptStruct_FNanimActionPulse.OuterSingleton;
	}
	if (!Z_Registration_Info_UScriptStruct_FNanimActionPulse.InnerSingleton)
	{
		UECodeGen_Private::ConstructUScriptStruct(Z_Registration_Info_UScriptStruct_FNanimActionPulse.InnerSingleton, UHT_STATICS::StructParams);
	}
	return CastChecked<UScriptStruct>(Z_Registration_Info_UScriptStruct_FNanimActionPulse.InnerSingleton);
}
#undef UHT_STATICS
// ********** End ScriptStruct FNanimActionPulse ***************************************************

// ********** Begin Registration *******************************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationTypes_h__Script_Nanimation_Statics
struct UHT_STATICS
{
	static constexpr FEnumRegisterCompiledInInfo EnumInfo[] = {
		{ Z_Construct_UEnum_Nanimation_ENanimCategory, TEXT("ENanimCategory"), &ZRIE_ENanimCategory, CONSTRUCT_RELOAD_VERSION_INFO(FEnumReloadVersionInfo, 2860817413U) },
		{ Z_Construct_UEnum_Nanimation_ENanimDirection, TEXT("ENanimDirection"), &ZRIE_ENanimDirection, CONSTRUCT_RELOAD_VERSION_INFO(FEnumReloadVersionInfo, 2992417749U) },
		{ Z_Construct_UEnum_Nanimation_ENanimStance, TEXT("ENanimStance"), &ZRIE_ENanimStance, CONSTRUCT_RELOAD_VERSION_INFO(FEnumReloadVersionInfo, 972309521U) },
		{ Z_Construct_UEnum_Nanimation_ENanimPolicy, TEXT("ENanimPolicy"), &ZRIE_ENanimPolicy, CONSTRUCT_RELOAD_VERSION_INFO(FEnumReloadVersionInfo, 4281158647U) },
		{ Z_Construct_UEnum_Nanimation_ENanimNetMode, TEXT("ENanimNetMode"), &ZRIE_ENanimNetMode, CONSTRUCT_RELOAD_VERSION_INFO(FEnumReloadVersionInfo, 3365914814U) },
	};
	static constexpr FStructRegisterCompiledInInfo ScriptStructInfo[] = {
		{ Z_Construct_UScriptStruct_FNanimVariant, Z_Construct_UScriptStruct_FNanimVariant_Statics::NewStructOps, TEXT("NanimVariant"),&Z_Registration_Info_UScriptStruct_FNanimVariant, CONSTRUCT_RELOAD_VERSION_INFO(FStructReloadVersionInfo, sizeof(FNanimVariant), 1483304455U) },
		{ Z_Construct_UScriptStruct_FNanimAction, Z_Construct_UScriptStruct_FNanimAction_Statics::NewStructOps, TEXT("NanimAction"),&Z_Registration_Info_UScriptStruct_FNanimAction, CONSTRUCT_RELOAD_VERSION_INFO(FStructReloadVersionInfo, sizeof(FNanimAction), 1131115550U) },
		{ Z_Construct_UScriptStruct_FNanimPickContext, Z_Construct_UScriptStruct_FNanimPickContext_Statics::NewStructOps, TEXT("NanimPickContext"),&Z_Registration_Info_UScriptStruct_FNanimPickContext, CONSTRUCT_RELOAD_VERSION_INFO(FStructReloadVersionInfo, sizeof(FNanimPickContext), 3311303057U) },
		{ Z_Construct_UScriptStruct_FNanimActionPulse, Z_Construct_UScriptStruct_FNanimActionPulse_Statics::NewStructOps, TEXT("NanimActionPulse"),&Z_Registration_Info_UScriptStruct_FNanimActionPulse, CONSTRUCT_RELOAD_VERSION_INFO(FStructReloadVersionInfo, sizeof(FNanimActionPulse), 807052450U) },
	};
}; // UHT_STATICS 
static FRegisterCompiledInInfo Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationTypes_h__Script_Nanimation_594928e0ce68d8be9df9295e0943485800041b67{
	TEXT("/Script/Nanimation"),
	nullptr, 0,
	UHT_STATICS::ScriptStructInfo, UE_ARRAY_COUNT(UHT_STATICS::ScriptStructInfo),
	UHT_STATICS::EnumInfo, UE_ARRAY_COUNT(UHT_STATICS::EnumInfo),
	nullptr, 0,
};
#undef UHT_STATICS
// ********** End Registration *********************************************************************
#undef UHT_STRUCT_BASE

PRAGMA_ENABLE_DEPRECATION_WARNINGS
