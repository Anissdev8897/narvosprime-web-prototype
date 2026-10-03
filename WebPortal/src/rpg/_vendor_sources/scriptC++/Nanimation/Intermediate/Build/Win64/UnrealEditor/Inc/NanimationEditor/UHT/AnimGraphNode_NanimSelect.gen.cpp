// Copyright Epic Games, Inc. All Rights Reserved.
/*===========================================================================
	Generated code exported from UnrealHeaderTool.
	DO NOT modify this manually! Edit the corresponding .h files instead!
===========================================================================*/

#include "UObject/GeneratedCppIncludes.h"
#include "AnimGraphNode_NanimSelect.h"
#include "AnimNode_NanimSelect.h"

PRAGMA_DISABLE_DEPRECATION_WARNINGS
static_assert(!UE_WITH_CONSTINIT_UOBJECT, "This generated code can only be compiled with !UE_WITH_CONSTINIT_UOBJECT");
void EmptyLinkFunctionForGeneratedCodeAnimGraphNode_NanimSelect() {}

// ********** Begin Cross Module References ********************************************************
ANIMGRAPH_API UClass* Z_Construct_UClass_UAnimGraphNode_Base(ETypeConstructPhase);
NANIMATION_API UScriptStruct* Z_Construct_UScriptStruct_FAnimNode_NanimSelect(ETypeConstructPhase);
// ********** End Cross Module References **********************************************************

// ********** Begin Same Module References *********************************************************
UPackage* Z_Construct_UPackage__Script_NanimationEditor(ETypeConstructPhase);
NANIMATIONEDITOR_API UClass* Z_Construct_UClass_UAnimGraphNode_NanimSelect(ETypeConstructPhase);
NANIMATIONEDITOR_API UClass* Z_Construct_UClass_UAnimGraphNode_NanimSelect(ETypeConstructPhase);
// ********** End Same Module References ***********************************************************
#define UHT_STRUCT_BASE(INIT) UE::CodeGen::ConstInit::TCompiledInObjectPtr<const FStructBaseChain>(UE::Private::AsStructBaseChain(INIT))

// ********** Begin Class UAnimGraphNode_NanimSelect ***********************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_Construct_UClass_UAnimGraphNode_NanimSelect_Statics
struct UHT_STATICS
{
#if WITH_METADATA
	static constexpr UECodeGen_Private::FMetaDataPairParam Type_MetaData[] = {
		{ "IncludePath", "AnimGraphNode_NanimSelect.h" },
		{ "ModuleRelativePath", "Public/AnimGraphNode_NanimSelect.h" },
	};
	static constexpr UECodeGen_Private::FMetaDataPairParam NewProp_Node_MetaData[] = {
		{ "Category", "Settings" },
		{ "ModuleRelativePath", "Public/AnimGraphNode_NanimSelect.h" },
	};
#endif // WITH_METADATA

// ********** Begin Class UAnimGraphNode_NanimSelect constinit property declarations ***************
	static const UECodeGen_Private::FStructPropertyParams NewProp_Node;
	static const UECodeGen_Private::FPropertyParamsBase* const PropPointers[];
// ********** End Class UAnimGraphNode_NanimSelect constinit property declarations *****************
	static FTypeConstructFunc* DependentSingletons[];
	static constexpr FCppClassTypeInfoStatic StaticCppClassTypeInfo = {
		TCppClassTypeTraits<UAnimGraphNode_NanimSelect>::IsAbstract,
	};
	static const UECodeGen_Private::FClassParams ClassParams;
}; // struct UHT_STATICS

// ********** Begin Class UAnimGraphNode_NanimSelect Property Definitions **************************
const UECodeGen_Private::FStructPropertyParams UHT_STATICS::NewProp_Node = { "Node", nullptr, (EPropertyFlags)0x0010000000000001, UECodeGen_Private::EPropertyGenFlags::Struct, nullptr, nullptr, 1, STRUCT_OFFSET(UAnimGraphNode_NanimSelect, Node), Z_Construct_UScriptStruct_FAnimNode_NanimSelect, METADATA_PARAMS(UE_ARRAY_COUNT(NewProp_Node_MetaData), NewProp_Node_MetaData) }; // 642c99f536954c675cef7d644f165caba1a6457a
const UECodeGen_Private::FPropertyParamsBase* const UHT_STATICS::PropPointers[] = {
	(const UECodeGen_Private::FPropertyParamsBase*)&UHT_STATICS::NewProp_Node,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::PropPointers) < 2048);
// ********** End Class UAnimGraphNode_NanimSelect Property Definitions ****************************
FTypeConstructFunc* UHT_STATICS::DependentSingletons[] = {
	(FTypeConstructFunc*)Z_Construct_UClass_UAnimGraphNode_Base,
	(FTypeConstructFunc*)Z_Construct_UPackage__Script_NanimationEditor,
};
static_assert(UE_ARRAY_COUNT(UHT_STATICS::DependentSingletons) < 16);
const UECodeGen_Private::FClassParams UHT_STATICS::ClassParams = {
	&Z_Construct_UClass_UAnimGraphNode_NanimSelect,
	nullptr,
	&StaticCppClassTypeInfo,
	DependentSingletons,
	nullptr,
	UHT_STATICS::PropPointers,
	nullptr,
	UE_ARRAY_COUNT(DependentSingletons),
	0,
	UE_ARRAY_COUNT(UHT_STATICS::PropPointers),
	0,
	0x008000A0u,
	METADATA_PARAMS(UE_ARRAY_COUNT(UHT_STATICS::Type_MetaData), UHT_STATICS::Type_MetaData)
};
FClassRegistrationInfo Z_Registration_Info_UClass_UAnimGraphNode_NanimSelect;
UClass* Z_Construct_UClass_UAnimGraphNode_NanimSelect(ETypeConstructPhase Phase)
{
	if (Phase == ETypeConstructPhase::Inner)
	{
		using TClass = UAnimGraphNode_NanimSelect;
		if (!Z_Registration_Info_UClass_UAnimGraphNode_NanimSelect.InnerSingleton)
		{
			GetPrivateStaticClassBody(
				TClass::StaticPackage(),
				TEXT("AnimGraphNode_NanimSelect"),
				Z_Registration_Info_UClass_UAnimGraphNode_NanimSelect.InnerSingleton,
				nullptr,
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
		return Z_Registration_Info_UClass_UAnimGraphNode_NanimSelect.InnerSingleton;
	}
	if (!Z_Registration_Info_UClass_UAnimGraphNode_NanimSelect.OuterSingleton)
	{
		UECodeGen_Private::ConstructUClass(Z_Registration_Info_UClass_UAnimGraphNode_NanimSelect.OuterSingleton, UHT_STATICS::ClassParams);
	}
	return Z_Registration_Info_UClass_UAnimGraphNode_NanimSelect.OuterSingleton;
}
#undef UHT_STATICS
UAnimGraphNode_NanimSelect::UAnimGraphNode_NanimSelect(const FObjectInitializer& ObjectInitializer) : Super(ObjectInitializer) {}
DEFINE_VTABLE_PTR_HELPER_CTOR_NS(, UAnimGraphNode_NanimSelect);
UAnimGraphNode_NanimSelect::~UAnimGraphNode_NanimSelect() {}
// ********** End Class UAnimGraphNode_NanimSelect *************************************************

// ********** Begin Registration *******************************************************************
#ifdef UHT_STATICS
#error UHT_STATICS already defined
#endif
#define UHT_STATICS Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_NanimationEditor_Public_AnimGraphNode_NanimSelect_h__Script_NanimationEditor_Statics
struct UHT_STATICS
{
	static constexpr FClassRegisterCompiledInInfo ClassInfo[] = {
		{ Z_Construct_UClass_UAnimGraphNode_NanimSelect, TEXT("UAnimGraphNode_NanimSelect"), &Z_Registration_Info_UClass_UAnimGraphNode_NanimSelect, CONSTRUCT_RELOAD_VERSION_INFO(FClassReloadVersionInfo, sizeof(UAnimGraphNode_NanimSelect), 2008537332U) },
	};
}; // UHT_STATICS 
static FRegisterCompiledInInfo Z_CompiledInDeferFile_FID_Users_aniss_Documents_TPSModelUE57_01_Plugins_Nanimation_Source_NanimationEditor_Public_AnimGraphNode_NanimSelect_h__Script_NanimationEditor_80b130e55cc22a82d4a9567c6d0e71cb5c0c680f{
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
