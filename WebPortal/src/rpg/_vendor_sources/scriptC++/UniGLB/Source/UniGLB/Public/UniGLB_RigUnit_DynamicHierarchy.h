// Copyright Epic Games, Inc. All Rights Reserved.

#pragma once


#include "Units/RigUnit.h"
#include "ControlRigDefines.h" 

#include "UniGLB_RigUnit_DynamicHierarchy.generated.h"


/**
 * get curve list
 */
USTRUCT(meta = (DisplayName = "UniGLB GetCurveNameFromMesh", Keywords = "UniGLB", Varying))
struct FRigUnit_UniGLBGetCurveNameFromMesh : public FRigUnitMutable
{
	GENERATED_BODY()

	FRigUnit_UniGLBGetCurveNameFromMesh()
	{
	}

	RIGVM_METHOD()
		virtual void Execute() override;

	UPROPERTY(meta = (Output))
	TArray<FName> Items_Morph;

	UPROPERTY(meta = (Output))
	TArray<FName> Items_Curve;
};


/**
 * add morph and curve
 */
USTRUCT(meta=(DisplayName="UniGLB AddCurveFromMesh", Keywords="AddCurve,Spawn", Varying))
struct FRigUnit_UniGLBAddCurveFromMesh : public FRigUnitMutable
{
	GENERATED_BODY()

	FRigUnit_UniGLBAddCurveFromMesh()
	{
	}

	RIGVM_METHOD()
	virtual void Execute() override;

	UPROPERTY(meta = (Input))
	FString Prefix = TEXT("");

	UPROPERTY(meta = (Input))
	FString Suffix = TEXT("_c");

	UPROPERTY(meta = (Input))
	bool bIncludeMorphs = true;

	UPROPERTY(meta = (Input))
	bool bIncludeCurves = true;

	UPROPERTY(meta = (Output))
	TArray<FRigElementKey> Items_Morph;

	UPROPERTY(meta = (Output))
	TArray<FRigElementKey> Items_Curve;
};


/**
 * generate contorl to bone table
 */
USTRUCT(meta = (DisplayName = "UniGLB GenerateTable", Keywords = "Table", Varying))
struct FRigUnit_UniGLBGenerateBoneToControlTable: public FRigUnitMutable
{
	GENERATED_BODY()

	FRigUnit_UniGLBGenerateBoneToControlTable()
	{
	}

	RIGVM_METHOD()
	virtual void Execute() override;

	UPROPERTY(meta = (Output))
	TArray<FName> Items_MannequinBone;

	UPROPERTY(meta = (Output))
	TArray<FName> Items_VRMBone;
};

/**
 * init controller transform
 */
USTRUCT(meta = (DisplayName = "UniGLB InitController Transform", Keywords = "Table", Varying))
struct FRigUnit_UniGLBInitControllerTransform: public FRigUnitMutable
{
	GENERATED_BODY()

	FRigUnit_UniGLBInitControllerTransform()
	{
	}

	RIGVM_METHOD()
	virtual void Execute() override;
};


