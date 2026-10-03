// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.


/*

// VRMSpringBone.cs (UniVRM reference implementation)
MIT License

Copyright (c) 2018 DWANGO Co., Ltd. for UniVRM
Copyright (c) 2018 ousttrue for UniGLTF, UniHumanoid
Copyright (c) 2018 Masataka SUMI for MToon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

#pragma once

#include "UniGLB_AnimNode_SpringBone.h"
#include "AnimationRuntime.h"
#include "Animation/AnimInstanceProxy.h"
#include "Kismet/KismetSystemLibrary.h"
#include "SceneInterface.h"
#include "DrawDebugHelpers.h"

#include "UniGLB_MetaObject.h"
#include "UniGLB_Util.h"

#include <algorithm>
/////////////////////////////////////////////////////
// FAnimNode_ModifyBone


namespace UniGLBSpringBone {
	class UniGLBSpringManagerBase {
	public:
		UniGLBSpringManagerBase() {}
		virtual ~UniGLBSpringManagerBase() {}
		bool bInit = false;
		USkeletalMesh* skeletalMesh = nullptr;
		const UUniGLBMetaObject* uniGLBMetaObject = nullptr;

		virtual void init(const UUniGLBMetaObject* meta, FComponentSpacePoseContext& Output) {}
		virtual void update(const FAnimNode_UniGLBSpringBone* animNode, float DeltaTime, FComponentSpacePoseContext& Output, TArray<FBoneTransform>& OutBoneTransforms) {}
		virtual void reset() {}
		virtual void applyToComponent(FComponentSpacePoseContext& Output, TArray<FBoneTransform>& OutBoneTransforms) {}

	};
}

namespace UniGLBSpringBone {

	class UniGLBSpringCollider {
	public:
		FVector offset = FVector::ZeroVector;
		float radius = 0.f;
	};
	class UniGLBSpringColliderGroup {
	public:
		int node = 0;
		FName node_name;

		TArray<UniGLBSpringCollider> colliders;
	};

	class UniGLBSpringData {
	public:
		int boneIndex = -1;
		FName boneName;
		FVector m_currentTail = FVector::ZeroVector;
		FVector m_prevTail = FVector::ZeroVector;
		//FTransform m_transform = FTransform::Identity;
		FVector m_boneAxis = FVector::ForwardVector;
		float m_length = 1.f;

		FQuat m_resultQuat = FQuat::Identity;
	};

	class UniGLBSpring {
	public:
		float stiffness = 0.f;
		float gravityPower = 0.f;
		FVector gravityDir = { 0,0,0 };
		float dragForce = 0.f;
		float hitRadius = 0.f;

		//int boneNum = 0;
		//int *bones;
		//FString bones_name;

		//int colliderGourpNum = 0;
		//int* colliderGroups = nullptr;
		TArray<int> ColliderGroupIndexArray;


		TArray< TArray<UniGLBSpringData> > SpringDataChain;
		TArray<UniGLBSpringData> RootSpringData;

		USkeletalMesh* skeletalMesh = nullptr;
		~UniGLBSpring() {
			skeletalMesh = nullptr;
		}

		void Update(const FAnimNode_UniGLBSpringBone* animNode, float DeltaTime, FTransform center,
			const TArray<UniGLBSpringColliderGroup>& colliderGroup,
			FComponentSpacePoseContext& Output);
	};

	class UniGLBSpringManager : public UniGLBSpringManagerBase {
	public:

		virtual void init(const UUniGLBMetaObject* meta, FComponentSpacePoseContext& Output) override;
		virtual void update(const FAnimNode_UniGLBSpringBone* animNode, float DeltaTime, FComponentSpacePoseContext& Output, TArray<FBoneTransform>& OutBoneTransforms) override;
		virtual void reset() override;

		virtual void applyToComponent(FComponentSpacePoseContext& Output, TArray<FBoneTransform>& OutBoneTransforms) override;

		TArray<UniGLBSpring> spring;
		TArray<UniGLBSpringColliderGroup> colliderGroup;
	};

}


namespace UniGLB1Spring {

	class SpringBoneJointState {
	public:
		FVector prevTail;
		FVector currentTail;

		FVector initialTail;
		FVector boneAxis;
		float boneLength = 0.f;
		FTransform initialLocalMatrix;
		FQuat initialLocalRotation;

		FQuat resultQuat;
	};


	class UniGLB1SpringManager : public UniGLBSpringBone::UniGLBSpringManagerBase {
	public:

		TMap< int, SpringBoneJointState > JointStateMap;

		virtual void init(const UUniGLBMetaObject* meta, FComponentSpacePoseContext& Output) override;
		virtual void update(const FAnimNode_UniGLBSpringBone* animNode, float DeltaTime, FComponentSpacePoseContext& Output, TArray<FBoneTransform>& OutBoneTransforms) override;
		virtual void reset() override;
		virtual void applyToComponent(FComponentSpacePoseContext& Output, TArray<FBoneTransform>& OutBoneTransforms) override;
	};
}
