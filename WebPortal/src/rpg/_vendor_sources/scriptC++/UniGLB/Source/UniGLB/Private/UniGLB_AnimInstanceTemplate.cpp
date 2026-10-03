// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.


#include "UniGLB_AnimInstanceTemplate.h"
#include "Animation/AnimNodeBase.h"

FUniGLBAnimInstanceTemplateProxy::FUniGLBAnimInstanceTemplateProxy()
{
}

FUniGLBAnimInstanceTemplateProxy::FUniGLBAnimInstanceTemplateProxy(UAnimInstance* InAnimInstance)
	: FAnimInstanceProxy(InAnimInstance)
{
}

/////

UUniGLBAnimInstanceTemplate::UUniGLBAnimInstanceTemplate(const FObjectInitializer& ObjectInitializer)
	:Super(ObjectInitializer)
{
}

FAnimInstanceProxy* UUniGLBAnimInstanceTemplate::CreateAnimInstanceProxy() {
	myProxy = new FUniGLBAnimInstanceTemplateProxy(this);
	return myProxy;
}
