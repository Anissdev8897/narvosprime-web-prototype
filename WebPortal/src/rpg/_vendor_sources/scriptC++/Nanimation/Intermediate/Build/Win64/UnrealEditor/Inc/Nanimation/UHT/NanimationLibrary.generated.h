// Copyright Epic Games, Inc. All Rights Reserved.
/*===========================================================================
	Generated code exported from UnrealHeaderTool.
	DO NOT modify this manually! Edit the corresponding .h files instead!
===========================================================================*/

// IWYU pragma: private, include "NanimationLibrary.h"

#ifdef NANIMATION_NanimationLibrary_generated_h
#error "NanimationLibrary.generated.h already included, missing '#pragma once' in NanimationLibrary.h"
#endif
#define NANIMATION_NanimationLibrary_generated_h

#include "UObject/ObjectMacros.h"
#include "UObject/ReflectedTypeAccessors.h"
#include "UObject/ScriptMacros.h"

PRAGMA_DISABLE_DEPRECATION_WARNINGS
class UAnimMontage;
class UNanimationSet;
class USkeletalMeshComponent;
enum class ENanimCategory : uint8;
struct FNanimVariant;

// ********** Begin Class UNanimationLibrary *******************************************************
#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationLibrary_h_55_RPC_WRAPPERS_NO_PURE_DECLS \
	DECLARE_FUNCTION(execPlayRandomSequence); \
	DECLARE_FUNCTION(execPlayRandomMontage); \
	DECLARE_FUNCTION(execPickVariant);


struct Z_Construct_UClass_UNanimationLibrary_Statics;
NANIMATION_API UClass* Z_Construct_UClass_UNanimationLibrary(ETypeConstructPhase);

#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationLibrary_h_55_INCLASS_NO_PURE_DECLS \
private: \
	friend struct ::Z_Construct_UClass_UNanimationLibrary_Statics; \
	friend NANIMATION_API UClass* ::Z_Construct_UClass_UNanimationLibrary(ETypeConstructPhase); \
public: \
	DECLARE_CLASS2(UNanimationLibrary, UBlueprintFunctionLibrary, COMPILED_IN_FLAGS(0), CASTCLASS_None, TEXT("/Script/Nanimation"), Z_Construct_UClass_UNanimationLibrary) \
	DECLARE_SERIALIZER(UNanimationLibrary)


#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationLibrary_h_55_ENHANCED_CONSTRUCTORS \
	/** Standard constructor, called after all reflected properties have been initialized */ \
	NO_API UNanimationLibrary(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get()); \
	/** Deleted move- and copy-constructors, should never be used */ \
	UNanimationLibrary(UNanimationLibrary&&) = delete; \
	UNanimationLibrary(const UNanimationLibrary&) = delete; \
	DECLARE_VTABLE_PTR_HELPER_CTOR(NO_API, UNanimationLibrary); \
	DEFINE_VTABLE_PTR_HELPER_CTOR_CALLER(UNanimationLibrary); \
	DEFINE_DEFAULT_OBJECT_INITIALIZER_CONSTRUCTOR_CALL(UNanimationLibrary) \
	NO_API virtual ~UNanimationLibrary();


#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationLibrary_h_52_PROLOG
#define FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationLibrary_h_55_GENERATED_BODY \
PRAGMA_DISABLE_DEPRECATION_WARNINGS \
public: \
	FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationLibrary_h_55_RPC_WRAPPERS_NO_PURE_DECLS \
	FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationLibrary_h_55_INCLASS_NO_PURE_DECLS \
	FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationLibrary_h_55_ENHANCED_CONSTRUCTORS \
private: \
PRAGMA_ENABLE_DEPRECATION_WARNINGS


class UNanimationLibrary;

// ********** End Class UNanimationLibrary *********************************************************

#undef CURRENT_FILE_ID
#define CURRENT_FILE_ID FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_Nanimation_Public_NanimationLibrary_h

PRAGMA_ENABLE_DEPRECATION_WARNINGS
