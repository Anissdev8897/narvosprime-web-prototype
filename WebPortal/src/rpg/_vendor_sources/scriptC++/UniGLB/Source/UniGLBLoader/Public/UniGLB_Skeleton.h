// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#pragma once

#include "CoreMinimal.h"
#include "Animation/Skeleton.h"
#include "Misc/EngineVersionComparison.h"
//#include "UniGLB_Skeleton.generated.h"

class USkeletalMesh;
class UUniGLBAssetListObject;

class UNIGLBLOADER_API UniGLBSkeleton {
public:
	static void readUniGLBBone(struct aiScene* scene, int& boneOffset, FReferenceSkeleton& RefSkeleton, UUniGLBAssetListObject* assetList);

	static void addIKBone(class UUniGLBAssetListObject* uniGLBAssetList, USkeletalMesh* sk);
};
