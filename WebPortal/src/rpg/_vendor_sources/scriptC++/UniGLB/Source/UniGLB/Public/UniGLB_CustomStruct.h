// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "UObject/ObjectMacros.h"

#include "UniGLB_CustomStruct.generated.h"

USTRUCT(BlueprintType)
struct FUniGLBRetargetSrcAnimSequence
{
	GENERATED_USTRUCT_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UniGLB")
	class UAnimSequenceBase *AnimSequence = nullptr;
};


namespace {
	//bool operator<(const FBoneTransform &a, const FBoneTransform &b) {
	//	return a.BoneIndex < b.BoneIndex;
	//}
}
