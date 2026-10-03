// Copyright Epic Games, Inc. All Rights Reserved.
/*===========================================================================
	Generated code exported from UnrealHeaderTool.
	DO NOT modify this manually! Edit the corresponding .h files instead!
===========================================================================*/

// IWYU pragma: private, include "NanimationSet.h"

#ifdef NANIMATION_NanimationSet_generated_h
#error "NanimationSet.generated.h already included, missing '#pragma once' in NanimationSet.h"
#endif
#define NANIMATION_NanimationSet_generated_h

#include "UObject/ObjectMacros.h"
#include "UObject/ReflectedTypeAccessors.h"
#include "UObject/ScriptMacros.h"

PRAGMA_DISABLE_DEPRECATION_WARNINGS
enum class ENanimCategory : uint8;
struct FNanimAction;

// ********** Begin Class UNanimationSet ***********************************************************
#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationSet_h_25_RPC_WRAPPERS_NO_PURE_DECLS \
	DECLARE_FUNCTION(execGetAction); \
	DECLARE_FUNCTION(execHasAction);


struct Z_Construct_UClass_UNanimationSet_Statics;
NANIMATION_API UClass* Z_Construct_UClass_UNanimationSet(ETypeConstructPhase);

#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationSet_h_25_INCLASS_NO_PURE_DECLS \
private: \
	friend struct ::Z_Construct_UClass_UNanimationSet_Statics; \
	friend NANIMATION_API UClass* ::Z_Construct_UClass_UNanimationSet(ETypeConstructPhase); \
public: \
	DECLARE_CLASS2(UNanimationSet, UPrimaryDataAsset, COMPILED_IN_FLAGS(0), CASTCLASS_None, TEXT("/Script/Nanimation"), Z_Construct_UClass_UNanimationSet) \
	DECLARE_SERIALIZER(UNanimationSet)


#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationSet_h_25_ENHANCED_CONSTRUCTORS \
	/** Standard constructor, called after all reflected properties have been initialized */ \
	NO_API UNanimationSet(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get()); \
	/** Deleted move- and copy-constructors, should never be used */ \
	UNanimationSet(UNanimationSet&&) = delete; \
	UNanimationSet(const UNanimationSet&) = delete; \
	DECLARE_VTABLE_PTR_HELPER_CTOR(NO_API, UNanimationSet); \
	DEFINE_VTABLE_PTR_HELPER_CTOR_CALLER(UNanimationSet); \
	DEFINE_DEFAULT_OBJECT_INITIALIZER_CONSTRUCTOR_CALL(UNanimationSet) \
	NO_API virtual ~UNanimationSet();


#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationSet_h_22_PROLOG
#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationSet_h_25_GENERATED_BODY \
PRAGMA_DISABLE_DEPRECATION_WARNINGS \
public: \
	FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationSet_h_25_RPC_WRAPPERS_NO_PURE_DECLS \
	FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationSet_h_25_INCLASS_NO_PURE_DECLS \
	FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationSet_h_25_ENHANCED_CONSTRUCTORS \
private: \
PRAGMA_ENABLE_DEPRECATION_WARNINGS


class UNanimationSet;

// ********** End Class UNanimationSet *************************************************************

#undef CURRENT_FILE_ID
#define CURRENT_FILE_ID FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationSet_h

PRAGMA_ENABLE_DEPRECATION_WARNINGS
