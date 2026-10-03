// Copyright Epic Games, Inc. All Rights Reserved.
/*===========================================================================
	Generated code exported from UnrealHeaderTool.
	DO NOT modify this manually! Edit the corresponding .h files instead!
===========================================================================*/

// IWYU pragma: private, include "NanimationComponent.h"

#ifdef NANIMATION_NanimationComponent_generated_h
#error "NanimationComponent.generated.h already included, missing '#pragma once' in NanimationComponent.h"
#endif
#define NANIMATION_NanimationComponent_generated_h

#include "UObject/ObjectMacros.h"
#include "UObject/ReflectedTypeAccessors.h"
#include "UObject/ScriptMacros.h"

PRAGMA_DISABLE_DEPRECATION_WARNINGS
class UNanimationSet;
enum class ENanimCategory : uint8;
enum class ENanimDirection : uint8;
enum class ENanimStance : uint8;
struct FNanimVariant;

// ********** Begin Class UNanimationComponent *****************************************************
#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationComponent_h_42_RPC_WRAPPERS_NO_PURE_DECLS \
	virtual bool ServerRequestAction_Validate(ENanimCategory , ENanimDirection , ENanimStance ); \
	virtual void ServerRequestAction_Implementation(ENanimCategory Category, ENanimDirection Dir, ENanimStance Stance); \
	DECLARE_FUNCTION(execOnRep_ActiveSet); \
	DECLARE_FUNCTION(execOnRep_ActionPulses); \
	DECLARE_FUNCTION(execServerRequestAction); \
	DECLARE_FUNCTION(execSetActiveSet); \
	DECLARE_FUNCTION(execPlayLocalCosmetic); \
	DECLARE_FUNCTION(execRequestActionWithContext); \
	DECLARE_FUNCTION(execRequestAction);


#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationComponent_h_42_CALLBACK_WRAPPERS
struct Z_Construct_UClass_UNanimationComponent_Statics;
NANIMATION_API UClass* Z_Construct_UClass_UNanimationComponent(ETypeConstructPhase);

#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationComponent_h_42_INCLASS_NO_PURE_DECLS \
private: \
	friend struct ::Z_Construct_UClass_UNanimationComponent_Statics; \
	friend NANIMATION_API UClass* ::Z_Construct_UClass_UNanimationComponent(ETypeConstructPhase); \
public: \
	DECLARE_CLASS2(UNanimationComponent, UActorComponent, COMPILED_IN_FLAGS(0 | CLASS_Config), CASTCLASS_None, TEXT("/Script/Nanimation"), Z_Construct_UClass_UNanimationComponent) \
	DECLARE_SERIALIZER(UNanimationComponent) \
	enum class ENetFields_Private : uint16 \
	{ \
		NETFIELD_REP_START=(uint16)((int32)Super::ENetFields_Private::NETFIELD_REP_END + (int32)1), \
		ActiveSet=NETFIELD_REP_START, \
		ActionPulses, \
		NETFIELD_REP_END=ActionPulses	}; \
	DECLARE_VALIDATE_GENERATED_REP_ENUMS(NO_API)


#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationComponent_h_42_ENHANCED_CONSTRUCTORS \
	/** Deleted move- and copy-constructors, should never be used */ \
	UNanimationComponent(UNanimationComponent&&) = delete; \
	UNanimationComponent(const UNanimationComponent&) = delete; \
	DECLARE_VTABLE_PTR_HELPER_CTOR(NO_API, UNanimationComponent); \
	DEFINE_VTABLE_PTR_HELPER_CTOR_CALLER(UNanimationComponent); \
	DEFINE_DEFAULT_CONSTRUCTOR_CALL(UNanimationComponent) \
	NO_API virtual ~UNanimationComponent();


#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationComponent_h_39_PROLOG
#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationComponent_h_42_GENERATED_BODY \
PRAGMA_DISABLE_DEPRECATION_WARNINGS \
public: \
	FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationComponent_h_42_RPC_WRAPPERS_NO_PURE_DECLS \
	FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationComponent_h_42_CALLBACK_WRAPPERS \
	FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationComponent_h_42_INCLASS_NO_PURE_DECLS \
	FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationComponent_h_42_ENHANCED_CONSTRUCTORS \
private: \
PRAGMA_ENABLE_DEPRECATION_WARNINGS


class UNanimationComponent;

// ********** End Class UNanimationComponent *******************************************************

#undef CURRENT_FILE_ID
#define CURRENT_FILE_ID FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationComponent_h

PRAGMA_ENABLE_DEPRECATION_WARNINGS
