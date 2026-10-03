// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimInstanceProxy.h"
#include "Animation/AnimNodeBase.h"
#include "Misc/EngineVersionComparison.h"

#include "UniGLB_AnimInstanceTemplate.generated.h"

class UIKRetargeter;
class UUniGLBMetaObject;

USTRUCT()
struct UNIGLB_API FUniGLBAnimInstanceTemplateProxy : public FAnimInstanceProxy {

public:
	GENERATED_BODY()

	FUniGLBAnimInstanceTemplateProxy();
	FUniGLBAnimInstanceTemplateProxy(UAnimInstance* InAnimInstance);
};

/**
 * 
 */
UCLASS(Blueprintable, BlueprintType)
class UNIGLB_API UUniGLBAnimInstanceTemplate : public UAnimInstance
{
	GENERATED_UCLASS_BODY()

public:

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = UniGLB)
	UIKRetargeter *UniGLBRetargeter = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = UniGLB)
	UUniGLBMetaObject* UniGLBMetaObject = nullptr;

protected:
	virtual FAnimInstanceProxy* CreateAnimInstanceProxy() override;

	FUniGLBAnimInstanceTemplateProxy *myProxy = nullptr;
public:
	FUniGLBAnimInstanceTemplateProxy *GetProxy() { return myProxy; }
};
