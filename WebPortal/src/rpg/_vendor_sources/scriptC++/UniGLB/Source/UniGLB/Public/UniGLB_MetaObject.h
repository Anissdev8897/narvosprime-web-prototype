// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "UniGLB_MetaObject.generated.h"

USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLBSpringMeta{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	float stiffness = 0.2f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	float gravityPower = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FVector gravityDir = { 0,-1,0 };

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	float dragForce = 0.4f;
	
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	float hitRadius = 0.f;

	//UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	//int boneNum = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<int> bones;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<FString> boneNames;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<int> ColliderIndexArray;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<int> ColliderGroupArrayVRM10; // for datacheck
};

USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLBSpringColliderData {
	GENERATED_BODY()
		
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FVector offset = FVector::ZeroVector;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	float radius = 0.f;
};

USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLBColliderGroupMeta {
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString groupName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<int> colliderGroup;
};


USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLBColliderMeta {
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	int bone = -1;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString boneName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<FUniGLBSpringColliderData> collider;
};

USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLB1SpringJointMeta {
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	int boneNo = -1;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString boneName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	float hitRadius = 0.1f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	float stiffness = 0.5f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	float gravityPower = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FVector gravityDir = { 0,-1,0 };

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	float dragForce = 0.5f;

};

USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLB1SpringMeta {
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<FUniGLB1SpringJointMeta> joints;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<int> colliderGroups;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	int center = 0;
};

USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLB1SpringCollider {
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	int boneNo = -1;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString boneName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FName shapeType;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FVector offset = FVector::ZeroVector;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	float radius = 0.f;

	// for capsule. offset-tail cylinder
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FVector tail = FVector::ZeroVector;
};

USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLB1SpringColliderGroups {
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString name;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<int> colliders;
};

USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLB1SpringBoneMeta {
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<FUniGLB1SpringMeta> Springs;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<FUniGLB1SpringCollider> Colliders;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<FUniGLB1SpringColliderGroups> ColliderGroups;
};


//////



// BlendShape
USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLBBlendShape{
	GENERATED_BODY()
public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString morphTargetName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString nodeName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString meshName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	int meshID=0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	int shapeIndex=0;
	
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	int weight=100;
};

// BlendShape Material
USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLBBlendShapeMaterialList {
	GENERATED_BODY()
public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
		FString materialName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
		FString propertyName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
		FLinearColor color = FLinearColor::Black;
};

USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLBBlendShapeGroup {
	GENERATED_BODY()
public:

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString name;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<FUniGLBBlendShape> BlendShape;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<FUniGLBBlendShapeMaterialList> MaterialList;

	// vrm10
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	bool isBinary = false;

	// none, block, blend
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString overrideBlink;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString overrideLookAt;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString overrideMouth;

};

//struct UNIGLB_API FBUniGLBlendShapeGroup {
//	TArray<FUniGLBBlendShape> 
//};

UENUM(BlueprintType)
enum class EUniGLBConstraintType : uint8 {
	None, Roll, Aim, Rotation,
};

USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLBConstraintRoll {
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString sourceName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	int source = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString rollAxis;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	float weight = 1.f;
};

USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLBConstraintAim {
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString sourceName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	int source = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString aimAxis;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	float weight = 1.f;
};

USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLBConstraintRotation {
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString sourceName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	int source = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	float weight = 1.f;
};

USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLBAnimationLookAt {
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	int lookAtNode = -1;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString lookAtNodeName;
};

USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLBAnimationExpressionPreset {
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString expressionName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	int expressionNode = -1;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FString expressionNodeName;
};


USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLBAnimationMeta {
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FUniGLBAnimationLookAt lookAt;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<FUniGLBAnimationExpressionPreset> expressionPreset;
		
};


USTRUCT(Blueprintable, BlueprintType)
struct UNIGLB_API FUniGLBConstraint {
	GENERATED_BODY()


	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	EUniGLBConstraintType type = EUniGLBConstraintType::None;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FUniGLBConstraintRoll constraintRoll;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FUniGLBConstraintAim constraintAim;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FUniGLBConstraintRotation constraintRotation;
};


UCLASS(Blueprintable, BlueprintType)
class UNIGLB_API UUniGLBMetaObject : public UObject
{
	GENERATED_BODY()
	
public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	int Version = 0;

	UFUNCTION(BlueprintPure, Category = "UniGLB")
	int GetVRMVersion() const {
		return Version;
	}

	// humanoid name -> model name
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TMap<FString, FString> humanoidBoneTable;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<FUniGLBBlendShapeGroup> BlendShapeGroup;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<FUniGLBSpringMeta> UniGLBSpringMeta;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FUniGLB1SpringBoneMeta UniGLB1SpringBoneMeta;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<FUniGLBColliderMeta> UniGLBColliderMeta;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TArray<FUniGLBColliderGroupMeta> UniGLBColliderGroupMeta;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	TMap<FString, FUniGLBConstraint> UniGLBConstraintMeta;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	FUniGLBAnimationMeta UniGLBAnimationMeta;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	class USkeletalMesh *SkeletalMesh;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Rendering)
	class UUniGLBAssetListObject *UniGLBAssetListObject;


};
