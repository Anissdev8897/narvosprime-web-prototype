// Copyright Epic Games, Inc. All Rights Reserved.
/*===========================================================================
	Generated code exported from UnrealHeaderTool.
	DO NOT modify this manually! Edit the corresponding .h files instead!
===========================================================================*/

// IWYU pragma: private, include "NanimationTypes.h"

#ifdef NANIMATION_NanimationTypes_generated_h
#error "NanimationTypes.generated.h already included, missing '#pragma once' in NanimationTypes.h"
#endif
#define NANIMATION_NanimationTypes_generated_h

#include "UObject/ObjectMacros.h"
#include "UObject/ReflectedTypeAccessors.h"
#include "Templates/IsUEnumClass.h"
#include "UObject/ScriptMacros.h"

PRAGMA_DISABLE_DEPRECATION_WARNINGS

// ********** Begin ScriptStruct FNanimVariant *****************************************************
struct Z_Construct_UScriptStruct_FNanimVariant_Statics;
NANIMATION_API UScriptStruct* Z_Construct_UScriptStruct_FNanimVariant(ETypeConstructPhase);

#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationTypes_h_167_GENERATED_BODY \
	friend struct ::Z_Construct_UScriptStruct_FNanimVariant_Statics; \
	UE_NODEBUG static UScriptStruct* StaticStruct() { return Z_Construct_UScriptStruct_FNanimVariant(ETypeConstructPhase::Inner); }


struct FNanimVariant;
// ********** End ScriptStruct FNanimVariant *******************************************************

// ********** Begin ScriptStruct FNanimAction ******************************************************
struct Z_Construct_UScriptStruct_FNanimAction_Statics;
NANIMATION_API UScriptStruct* Z_Construct_UScriptStruct_FNanimAction(ETypeConstructPhase);

#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationTypes_h_202_GENERATED_BODY \
	friend struct ::Z_Construct_UScriptStruct_FNanimAction_Statics; \
	UE_NODEBUG static UScriptStruct* StaticStruct() { return Z_Construct_UScriptStruct_FNanimAction(ETypeConstructPhase::Inner); }


struct FNanimAction;
// ********** End ScriptStruct FNanimAction ********************************************************

// ********** Begin ScriptStruct FNanimPickContext *************************************************
struct Z_Construct_UScriptStruct_FNanimPickContext_Statics;
NANIMATION_API UScriptStruct* Z_Construct_UScriptStruct_FNanimPickContext(ETypeConstructPhase);

#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationTypes_h_243_GENERATED_BODY \
	friend struct ::Z_Construct_UScriptStruct_FNanimPickContext_Statics; \
	UE_NODEBUG static UScriptStruct* StaticStruct() { return Z_Construct_UScriptStruct_FNanimPickContext(ETypeConstructPhase::Inner); }


struct FNanimPickContext;
// ********** End ScriptStruct FNanimPickContext ***************************************************

// ********** Begin ScriptStruct FNanimActionPulse *************************************************
struct Z_Construct_UScriptStruct_FNanimActionPulse_Statics;
NANIMATION_API UScriptStruct* Z_Construct_UScriptStruct_FNanimActionPulse(ETypeConstructPhase);

#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationTypes_h_287_GENERATED_BODY \
	friend struct ::Z_Construct_UScriptStruct_FNanimActionPulse_Statics; \
	UE_NODEBUG static UScriptStruct* StaticStruct() { return Z_Construct_UScriptStruct_FNanimActionPulse(ETypeConstructPhase::Inner); }


struct FNanimActionPulse;
// ********** End ScriptStruct FNanimActionPulse ***************************************************

#undef CURRENT_FILE_ID
#define CURRENT_FILE_ID FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationTypes_h

// ********** Begin Enum ENanimCategory ************************************************************
#define FOREACH_ENUM_ENANIMCATEGORY(op) \
	op(ENanimCategory::Idle) \
	op(ENanimCategory::Walk) \
	op(ENanimCategory::Jog) \
	op(ENanimCategory::Run) \
	op(ENanimCategory::Sprint) \
	op(ENanimCategory::Crouch) \
	op(ENanimCategory::Jump) \
	op(ENanimCategory::Fall) \
	op(ENanimCategory::Land) \
	op(ENanimCategory::Slide) \
	op(ENanimCategory::Roll) \
	op(ENanimCategory::Turn) \
	op(ENanimCategory::Pivot) \
	op(ENanimCategory::Start) \
	op(ENanimCategory::Stop) \
	op(ENanimCategory::Mantle) \
	op(ENanimCategory::Vault) \
	op(ENanimCategory::Climb) \
	op(ENanimCategory::Aim) \
	op(ENanimCategory::Fire) \
	op(ENanimCategory::Reload) \
	op(ENanimCategory::Attack) \
	op(ENanimCategory::Hit) \
	op(ENanimCategory::Death) \
	op(ENanimCategory::Emote) 

enum class ENanimCategory : uint8;
template<> struct TIsUEnumClass<ENanimCategory> { enum { Value = true }; };
template<> UE_NODEBUG NANIMATION_NON_ATTRIBUTED_API UEnum* StaticEnum<ENanimCategory>();
// ********** End Enum ENanimCategory **************************************************************

// ********** Begin Enum ENanimDirection ***********************************************************
#define FOREACH_ENUM_ENANIMDIRECTION(op) \
	op(ENanimDirection::None) \
	op(ENanimDirection::Fwd) \
	op(ENanimDirection::Bwd) \
	op(ENanimDirection::Left) \
	op(ENanimDirection::Right) 

enum class ENanimDirection : uint8;
template<> struct TIsUEnumClass<ENanimDirection> { enum { Value = true }; };
template<> UE_NODEBUG NANIMATION_NON_ATTRIBUTED_API UEnum* StaticEnum<ENanimDirection>();
// ********** End Enum ENanimDirection *************************************************************

// ********** Begin Enum ENanimStance **************************************************************
#define FOREACH_ENUM_ENANIMSTANCE(op) \
	op(ENanimStance::None) \
	op(ENanimStance::Neutral) \
	op(ENanimStance::Crouch) \
	op(ENanimStance::ADS) 

enum class ENanimStance : uint8;
template<> struct TIsUEnumClass<ENanimStance> { enum { Value = true }; };
template<> UE_NODEBUG NANIMATION_NON_ATTRIBUTED_API UEnum* StaticEnum<ENanimStance>();
// ********** End Enum ENanimStance ****************************************************************

// ********** Begin Enum ENanimPolicy **************************************************************
#define FOREACH_ENUM_ENANIMPOLICY(op) \
	op(ENanimPolicy::Uniform) \
	op(ENanimPolicy::Weighted) \
	op(ENanimPolicy::NoImmediateRepeat) \
	op(ENanimPolicy::ShuffleBag) 

enum class ENanimPolicy : uint8;
template<> struct TIsUEnumClass<ENanimPolicy> { enum { Value = true }; };
template<> UE_NODEBUG NANIMATION_NON_ATTRIBUTED_API UEnum* StaticEnum<ENanimPolicy>();
// ********** End Enum ENanimPolicy ****************************************************************

// ********** Begin Enum ENanimNetMode *************************************************************
#define FOREACH_ENUM_ENANIMNETMODE(op) \
	op(ENanimNetMode::Replicated) \
	op(ENanimNetMode::LocalCosmetic) 

enum class ENanimNetMode : uint8;
template<> struct TIsUEnumClass<ENanimNetMode> { enum { Value = true }; };
template<> UE_NODEBUG NANIMATION_NON_ATTRIBUTED_API UEnum* StaticEnum<ENanimNetMode>();
// ********** End Enum ENanimNetMode ***************************************************************

PRAGMA_ENABLE_DEPRECATION_WARNINGS
