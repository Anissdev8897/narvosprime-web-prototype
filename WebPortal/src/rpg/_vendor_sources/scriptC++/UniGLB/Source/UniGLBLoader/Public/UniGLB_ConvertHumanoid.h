// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"

/**
 * 
 */
class UNIGLBLOADER_API UniGLBConvertHumanoid
{
public:
	UniGLBConvertHumanoid();
	~UniGLBConvertHumanoid();

	static void renameToUE4Bone(class USkeletalMesh *targetSK, class UUniGLBMetaObject *meta, const class USkeletalMesh *srcSK);
};
