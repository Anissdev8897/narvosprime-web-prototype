// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_Skeleton.h"
#include "UniGLB_AssetListObject.h"
#include "UniGLB_MetaObject.h"
#include "Engine/SkeletalMesh.h"
//#include "UnStringConv.h

#include "UniGLB_Convert.h"
#include "UniGLBAssimpScene.h"
#include "UniGLB_Util.h"
#include "UniGLBLoaderLog.h"

#include <assimp/scene.h>       // Output data structure
#include <assimp/mesh.h>       // Output data structure

static int countParent(const aiNode *node, TArray<const aiNode*> &t, int c) {
	for (auto &a : t) {
		for (uint32_t i = 0; i < a->mNumChildren; ++i) {
			if (node == a->mChildren[i]) {
				return countParent(a, t, c + 1);
			}
		}
	}
	return c;
}

static int countChild(aiNode *node, int c) {
	c += node->mNumChildren;
	for (uint32_t i = 0; i < node->mNumChildren; ++i) {
		c = countChild(node->mChildren[i], c);
	}
	return c;
}

static bool findActiveBone(const aiNode *node, TArray<FString> &table) {

	if (table.Find(node->mName.C_Str()) != INDEX_NONE) {
		return true;
	}
	for (uint32_t i = 0; i < node->mNumChildren; ++i) {
		if (findActiveBone(node->mChildren[i], table)) {
			return true;
		}
	}
	return false;
}

static TArray<FString> makeActiveBone(const aiScene *scene) {
	TArray <FString> boneNameTable;
	for (uint32 m = 0; m < scene->mNumMeshes; ++m) {
		const auto &aiM = *scene->mMeshes[m];

		for (uint32 b = 0; b < aiM.mNumBones; ++b) {
			const auto &aiB = *aiM.mBones[b];
			boneNameTable.AddUnique(aiB.mName.C_Str());
		}
	}
	return boneNameTable;
}

static TMap<const aiNode*, const aiBone* > makeAiBoneTable(const aiScene* scene, TArray<const aiNode*> &nodeArray) {
	TMap<const aiNode*, const aiBone*> table;

	for (uint32 m = 0; m < scene->mNumMeshes; ++m) {
		const auto& aiM = *scene->mMeshes[m];

		for (uint32 b = 0; b < aiM.mNumBones; ++b) {
			const auto& aiB = aiM.mBones[b];
			if (nodeArray.Find(aiB->mNode)){
				table.Add(aiB->mNode, aiB);
				//break;
			}
		}
	}

	return table;
}

static TMap<const aiNode*, const aiSkeletonBone* > makeAiSkeletonBoneTable(const aiScene* scene, TArray<const aiNode*>& nodeArray) {
	TMap<const aiNode*, const aiSkeletonBone*> table;

	for (uint32 m = 0; m < scene->mNumSkeletons; ++m) {
		const auto& aiS = *scene->mSkeletons[m];

		for (uint32 b = 0; b < aiS.mNumBones; ++b) {
			const auto& aiB = aiS.mBones[b];
			if (nodeArray.Find(aiB->mNode)) {
				table.Add(aiB->mNode, aiB);
				//break;
			}
		}
	}
	return table;
}

static FMatrix convertAiMatToFMatrix(aiMatrix4x4 t, bool bOffsetMode = false) {
	FMatrix m;

	m.M[0][0] = t.a1; m.M[1][0] = t.a2; m.M[2][0] = t.a3; m.M[3][0] = -t.a4 * 100.f;
	m.M[0][1] = t.b1; m.M[1][1] = t.b2; m.M[2][1] = t.b3; m.M[3][1] = t.c4 * 100.f;//t.b4*100.f;
	m.M[0][2] = t.c1; m.M[1][2] = t.c2; m.M[2][2] = t.c3; m.M[3][2] = t.b4 * 100.f;//t.c4*100.f;
	m.M[0][3] = t.d1; m.M[1][3] = t.d2; m.M[2][3] = t.d3; m.M[3][3] = t.d4;

	// BASIS FIX (Manny/GASP import path only): the block above converts each bone's TRANSLATION to UE
	// Z-up (the -a4,c4,b4 swap = B*t with B=[[-1,0,0],[0,0,1],[0,1,0]]) but copies the ROTATION 3x3
	// straight from assimp, leaving it in glTF Y-up axes. That basis mismatch is invisible for
	// identity-rotation rigs (VRoid/VRM: spec forces T-pose, no local bone rotation) but SCRAMBLES every
	// descendant of any bone carrying an arbitrary bone-roll quaternion (Blender/Meshy export): composing
	// parent_rotation(Y-up) * child_translation(Z-up) down the hierarchy is geometrically wrong and the
	// error compounds, leaving only the root/pelvis correct. Fix = conjugate the rotation by the SAME
	// basis B (R_ue = B*R*B). B is symmetric, its own inverse, det +1 (a proper rotation: the X-negate +
	// Y<->Z swap net to orientation-preserving), so no extra quaternion sign flip is needed. Verified
	// numerically against the GLB: this turns the scramble into the exact clean A-pose. Gated to the
	// Manny-target import so plain VRM/FBX/PMX/BVH imports are untouched; UniGLB10 has its own conjugation
	// below and is excluded; VRoid-via-GASP is a provable no-op (identity rotations: B*I*B=I).
	if (!UniGLBConverter::Options::Get().IsVRM10Model()
		&& (UniGLBConverter::Options::Get().IsNativeMannyGASP() || UniGLBConverter::Options::Get().IsUniversalMannyGASP())) {
		FMatrix Bmat = FMatrix::Identity;
		Bmat.M[0][0] = -1.0; Bmat.M[1][1] = 0.0; Bmat.M[1][2] = 1.0; Bmat.M[2][1] = 1.0; Bmat.M[2][2] = 0.0;
		// Conjugate ONLY the 3x3 (translation already = B*t and must not be re-converted): zero the
		// translation row during the conjugation, then restore it.
		const double Tx = m.M[3][0], Ty = m.M[3][1], Tz = m.M[3][2];
		m.M[3][0] = 0.0; m.M[3][1] = 0.0; m.M[3][2] = 0.0;
		m = Bmat * m * Bmat;
		m.M[3][0] = Tx; m.M[3][1] = Ty; m.M[3][2] = Tz;
	}

	if (UniGLBConverter::Options::Get().IsVRM10Model()) {
		m.M[0][0] = t.a1; m.M[1][0] = t.a2; m.M[2][0] = t.a3; m.M[3][0] = t.a4 * 100.f;
		m.M[0][1] = t.b1; m.M[1][1] = t.b2; m.M[2][1] = t.b3; m.M[3][1] = t.b4 * 100.f;//t.b4*100.f;
		m.M[0][2] = t.c1; m.M[1][2] = t.c2; m.M[2][2] = t.c3; m.M[3][2] = t.c4 * 100.f;//t.c4*100.f;
		m.M[0][3] = t.d1; m.M[1][3] = t.d2; m.M[2][3] = t.d3; m.M[3][3] = t.d4;

		// rot
		{
			FTransform f;
			if (bOffsetMode) {
				//f.SetRotation(FRotator(0, 0, 180).Quaternion());
				f.SetRotation(FRotator(0, 0, 90).Quaternion());
			} else {
				f.SetRotation(FRotator(0, 0, 90).Quaternion());
			}

			m = f.ToMatrixNoScale() * m * f.ToMatrixNoScale().Inverse();
		}
	}

	if (UniGLBConverter::Options::Get().IsPMXModel() || UniGLBConverter::Options::Get().IsBVHModel()) {
		m.M[3][0] *= -1.f;
		m.M[3][1] *= -1.f;
	}
	{
		m.M[3][0] *= UniGLBConverter::Options::Get().GetModelScale();
		m.M[3][1] *= UniGLBConverter::Options::Get().GetModelScale();
		m.M[3][2] *= UniGLBConverter::Options::Get().GetModelScale();
		//m.M[3][3] *= UniGLBConverter::Options::Get().GetModelScale();
	}
	return m;
}


static bool hasMeshInChild(aiNode *node) {
	if (node == nullptr) {
		return false;
	}
	if (node->mNumMeshes > 0) {
		return true;
	}
	for (uint32_t i = 0; i < node->mNumChildren; ++i) {
		bool b = hasMeshInChild(node->mChildren[i]);
		if (b) {
			return true;
		}
	}
	return false;
}


static void rr3(const aiNode *node, TArray<const aiNode*> &t, bool &bHasMesh, const bool bOnlyRootBone) {
	bHasMesh = false;
	if (node == nullptr) {
		return;
	}
	if (node->mNumMeshes > 0) {
		bHasMesh = true;
	}

	t.Push(node);
	for (uint32_t i = 0; i < node->mNumChildren; ++i) {
		bool b = false;
		rr3(node->mChildren[i], t, b, bOnlyRootBone);

		if (b) {
			bHasMesh = true;
		}
	}
	if (bHasMesh==false && bOnlyRootBone) {
		//t.Remove(node);
	}
}

static void rr(const aiNode *node, TArray<const aiNode*> &t, bool &bHasMesh, const bool bOnlyRootBone, aiScene *scene) {

	auto target = node;

	if (bOnlyRootBone) {

		int maxIndex = -1;
		int maxChild = 0;

		// find deep tree
		for (uint32 i = 0; i < node->mNumChildren; ++i) {
			int cc = countChild(node->mChildren[i], 0);

			if (cc > maxChild) {
				maxChild = cc;
				maxIndex = i;
			}

		}

		auto tableBone = makeActiveBone(scene);

		for (uint32 i = 0; i < node->mNumChildren; ++i) {
			if (i == maxIndex) {
				continue;
			}
			if (findActiveBone(node->mChildren[i], tableBone)){
				maxIndex = -1;
				break;
			}
		}

		if (maxIndex >= 0) {

			const auto trans = node->mChildren[maxIndex]->mTransformation;
			float f = 0.f;
			f += FMath::Abs(trans.a4) + FMath::Abs(trans.b4) + FMath::Abs(trans.c4);
			if (f < 1.e-8f) {
				target = node->mChildren[maxIndex];
			} else {
				// root transform must zero.
			}
		}
	}

	rr3(target, t, bHasMesh, bOnlyRootBone);
}

/////////////////////////

void UniGLBSkeleton::readUniGLBBone(aiScene* scene, int& boneOffset, FReferenceSkeleton &RefSkeleton, UUniGLBAssetListObject* uniGLBAssetList) {
	boneOffset = 0;


	FReferenceSkeletonModifier RefSkelModifier(RefSkeleton, nullptr);

	{
		FTransform t;
		t.SetIdentity();

		for (int i = 0; i < RefSkeleton.GetRawBoneNum(); ++i) {
			RefSkelModifier.UpdateRefPoseTransform(i, t);
		}
	}


	TArray<const aiNode*> nodeArray;
	{
		bool dummy = false;
		bool bSimpleRootBone = false;
		bSimpleRootBone = UniGLBConverter::Options::Get().IsSimpleRootBone();
		rr(scene->mRootNode, nodeArray, dummy, bSimpleRootBone, scene);
	}
	{
		// rename bone
		TMap<FString, int> count;
		for (int i = 0; i < nodeArray.Num(); ++i) {
			auto& node = nodeArray[i];

			FString str = UTF8_TO_TCHAR(node->mName.C_Str());
			if (count.Contains(str)) {
				count[str]++;
			} else {
				count.Add(str, 1);
			}
		}
		for (int i = nodeArray.Num() - 1; i >= 0; --i) {
			aiNode* node = const_cast<aiNode*>(nodeArray[i]);

			FString str = UTF8_TO_TCHAR(node->mName.C_Str());
			if (count.Contains(str) == false) continue;

			auto c = count[str];
			if (c >= 2) {
				char tmp[512];
				snprintf(tmp, 512, "%s_%02d", node->mName.C_Str(), c);

				node->mName = tmp;
				count[str]--;
			}
		}
	}


	TMap<const aiNode*, const aiBone*> aiBoneTable = makeAiBoneTable(scene, nodeArray);
	//TMap<const aiNode*, const aiSkeletonBone*> aiBoneTable = makeAiSkeletonBoneTable(scene, nodeArray);

	{
		TArray<const aiBone*> v;
		aiBoneTable.GenerateValueArray(v);

		for (int i = 2; i < v.Num(); ++i) {
			if (v[i - 1]->mArmature != v[i]->mArmature) {
				// use armature
				break;
			}
		}
	}

	{
		int totalBoneCount = 0;

		TArray<FTransform> poseGlobal_bindpose;	// bone
		TArray<FTransform> poseGlobal_tpose;	// node
		TArray<FTransform> poseGlobal_tpose_rootIdentity;	// node rootIdentity

		TArray<FTransform> poseLocal_bindpose;				// bone
		TArray<FTransform> poseLocal_tpose;					// node
		TArray<FTransform> poseLocal_tpose_rootIdentity;	// node rootIdentity

		FTransform tpose_root;

		poseGlobal_bindpose.SetNum(nodeArray.Num());
		poseGlobal_tpose.SetNum(nodeArray.Num());
		poseGlobal_tpose_rootIdentity.SetNum(nodeArray.Num());

		poseLocal_bindpose.SetNum(nodeArray.Num());
		poseLocal_tpose.SetNum(nodeArray.Num());
		poseLocal_tpose_rootIdentity.SetNum(nodeArray.Num());

		// generate transform
		{
			// t-pose
			for (int nodeNo = 0; nodeNo < nodeArray.Num(); ++nodeNo) {
				auto node = nodeArray[nodeNo];
				FString nodeName = UTF8_TO_TCHAR(node->mName.C_Str());

				int32 ParentIndex = INDEX_NONE;
				if (nodeArray.Find(node->mParent, ParentIndex) == false) {
					ParentIndex = INDEX_NONE;
				}

				// t-pose (node pose)
				{
					FMatrix m = convertAiMatToFMatrix(node->mTransformation);

					FTransform localpose;
					localpose.SetFromMatrix(m);

					FTransform localpose_Identity = localpose;

					if (UniGLBConverter::Options::Get().IsRemoveRootBoneRotation()) {
						// localpose correct
						if (ParentIndex >= 0) {
							localpose_Identity = tpose_root.Inverse() * localpose * tpose_root;
						} else {
							tpose_root = localpose;
							localpose_Identity.SetIdentity();

							if (UniGLBConverter::Options::Get().IsRemoveRootBonePosition() == false) {
								localpose_Identity.SetTranslation(localpose.GetTranslation());
							}
						}
					}// identity set

					// pose
					if (ParentIndex >= 0) {
						poseGlobal_tpose[nodeNo]				= localpose * poseGlobal_tpose[ParentIndex];
						poseGlobal_tpose_rootIdentity[nodeNo]	= localpose_Identity * poseGlobal_tpose_rootIdentity[ParentIndex];
					} else {
						poseGlobal_tpose[nodeNo] = localpose;
						poseGlobal_tpose_rootIdentity[nodeNo] = localpose_Identity;
					}
					poseLocal_tpose[nodeNo] = localpose;
					poseLocal_tpose_rootIdentity[nodeNo] = localpose_Identity;
				}
			}// tpose
		}

		for (int nodeNo = 0; nodeNo < nodeArray.Num(); ++nodeNo) {
			auto node = nodeArray[nodeNo];
			FString nodeName = UTF8_TO_TCHAR(node->mName.C_Str());

			int32 ParentIndex = INDEX_NONE;
			if (nodeArray.Find(node->mParent, ParentIndex) == false) {
				ParentIndex = INDEX_NONE;
			}

			// bind-pose
			{
				auto pBone = aiBoneTable.Find(node);

				if (pBone == nullptr) {
					// generate from tpose matrix
					if (ParentIndex == INDEX_NONE) {
						poseLocal_bindpose[nodeNo] = poseLocal_tpose_rootIdentity[nodeNo];
						poseGlobal_bindpose[nodeNo] = poseLocal_bindpose[nodeNo];
					} else {
						poseLocal_bindpose[nodeNo] = poseLocal_tpose_rootIdentity[nodeNo];
						poseGlobal_bindpose[nodeNo] = poseLocal_bindpose[nodeNo] * poseGlobal_bindpose[ParentIndex];
					}
				}else{
					auto bone = *pBone;

					FMatrix m = convertAiMatToFMatrix(bone->mOffsetMatrix, true);
					if (ParentIndex == INDEX_NONE) {
					} else {
					}


					FTransform globalpose;
					globalpose.SetFromMatrix(m.Inverse());

					poseGlobal_bindpose[nodeNo] = globalpose;

					if (ParentIndex == INDEX_NONE) {
						poseLocal_bindpose[nodeNo] = globalpose;
					}else{
						poseLocal_bindpose[nodeNo] = globalpose * poseGlobal_bindpose[ParentIndex].Inverse();
					}
				}
			}
		} // bind pose


		for (int nodeNo = 0; nodeNo < nodeArray.Num(); ++nodeNo) {
			auto node = nodeArray[nodeNo];
			FMeshBoneInfo info;
			info.Name = UTF8_TO_TCHAR(node->mName.C_Str());
#if WITH_EDITORONLY_DATA
			info.ExportName = UTF8_TO_TCHAR(node->mName.C_Str());
#endif

			int32 ParentIndexByNode = INDEX_NONE;
			if (nodeArray.Find(node->mParent, ParentIndexByNode) == false) {
				ParentIndexByNode = INDEX_NONE;

				if (UniGLBConverter::Options::Get().IsBVHModel()) {
					// ダミーのRoot骨を追加する。BVHはRoot骨にTransが入っていることがある。
					// Transがあると、リターゲットがうまくできない
					FMeshBoneInfo inf;
					inf.Name = TEXT("root_dummy");
					inf.ParentIndex = INDEX_NONE;
					RefSkelModifier.Add(inf, FTransform());
				}
			}
			if (UniGLBConverter::Options::Get().IsBVHModel()) {
				info.ParentIndex = ParentIndexByNode + 1;
			} else {
				info.ParentIndex = ParentIndexByNode;
			}

			FMatrix m = convertAiMatToFMatrix(node->mTransformation);

			FTransform pose;
			
			if (UniGLBConverter::Options::Get().IsVRM10Bindpose()) {
				pose = poseLocal_bindpose[nodeNo];
			}else{
				pose = poseLocal_tpose_rootIdentity[nodeNo];
			}
			// remove local axis
			if (UniGLBConverter::Options::Get().IsVRM10Model()) {
				if (UniGLBConverter::Options::Get().IsVRM10RemoveLocalRotation()) {

					if (uniGLBAssetList){
						if (uniGLBAssetList->UniGLBMetaObject) {
							TArray<FString> v;
							uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable.GenerateValueArray(v);
							//if (v.Find(info.Name.ToString()) != INDEX_NONE) {
								pose.SetRotation(FQuat::Identity);
								if (ParentIndexByNode >= 0) {
									if (UniGLBConverter::Options::Get().IsVRM10Bindpose()) {
										pose.SetTranslation(poseGlobal_bindpose[nodeNo].GetLocation() - poseGlobal_bindpose[ParentIndexByNode].GetLocation());
									} else {
										pose.SetTranslation(poseGlobal_tpose[nodeNo].GetLocation() - poseGlobal_tpose[ParentIndexByNode].GetLocation());
									}
								}
							//}
						}
					}

				}
			}

			// bone name check
			{
				auto baseName = info.Name.ToString();
				for (int c = 0; c < 100; ++c) {
					if (RefSkeleton.FindRawBoneIndex(info.Name) == INDEX_NONE) {
						break;
					}
					info.Name = *FString::Printf(TEXT("%s_uniglb%02d"), *baseName, c);
				}
			}
			if (totalBoneCount > 0 && ParentIndexByNode == INDEX_NONE) {
				// bad bone. root?
				continue;
			}
			if (UniGLBConverter::Options::Get().IsVRMAModel()) {
				if (uniGLBAssetList->UniGLBMetaObject) {
					for (auto& t : uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable) {

						if (t.Value == info.Name.ToString()) {
							info.Name = *t.Key;
							break;
						}
					}
				}
			}

			RefSkelModifier.Add(info, pose);
			totalBoneCount++;

			if (uniGLBAssetList) {
				uniGLBAssetList->Pose_bind.Add(UTF8_TO_TCHAR(node->mName.C_Str()), poseGlobal_bindpose[nodeNo]);
				uniGLBAssetList->Pose_tpose.Add(UTF8_TO_TCHAR(node->mName.C_Str()), poseGlobal_tpose[nodeNo]);
				uniGLBAssetList->model_root_transform = tpose_root;
			}

			if (totalBoneCount == 1) {
				if (UniGLBConverter::Options::Get().IsDebugOneBone()) {
					// root only
					break;
				}
			}
		}
	}
}


void UniGLBSkeleton::addIKBone(UUniGLBAssetListObject* uniGLBAssetList, USkeletalMesh *sk) {

	if (UniGLBConverter::Options::Get().IsGenerateIKBone() == false) {
		return;
	}

	// refskeleton
	auto& BonePose = UniGLBGetRefSkeleton(sk).GetRefBonePose();
	FReferenceSkeletonModifier RefSkelModifier(UniGLBGetRefSkeleton(sk), UniGLBGetSkeleton(sk));

	{
		FString BoneCheckList[] = {
			TEXT("ik_foot_l"),
			TEXT("ik_foot_r"),
			TEXT("ik_hand_l"),
			TEXT("ik_hand_r"),
			TEXT("ik_hand_root"),
			TEXT("ik_foot_root"),
			TEXT("ik_hand_gun"),
		};
		for (auto& s : BoneCheckList) {
			if (RefSkelModifier.FindBoneIndex(*s) != INDEX_NONE) {
				return;
			}
		}
	}

	FTransform trans;
	FMeshBoneInfo info;
	info.ParentIndex = 0;

	info.Name = TEXT("ik_foot_root");
	RefSkelModifier.Add(info, trans);

	info.Name = TEXT("ik_hand_root");
	RefSkelModifier.Add(info, trans);

	// rebuild tmp
	UniGLBGetRefSkeleton(sk).RebuildRefSkeleton(UniGLBGetSkeleton(sk), true);
	{
		info.ParentIndex = RefSkelModifier.FindBoneIndex(TEXT("ik_foot_root"));
		info.Name = ("ik_foot_l");
		RefSkelModifier.Add(info, trans);
		info.Name = ("ik_foot_r");
		RefSkelModifier.Add(info, trans);

		info.ParentIndex = RefSkelModifier.FindBoneIndex(TEXT("ik_hand_root"));
		info.Name = ("ik_hand_gun");
		RefSkelModifier.Add(info, trans);
	}
	// rebuild tmp
	UniGLBGetRefSkeleton(sk).RebuildRefSkeleton(UniGLBGetSkeleton(sk), true);
	{

		info.ParentIndex = RefSkelModifier.FindBoneIndex(TEXT("ik_hand_gun"));
		info.Name = ("ik_hand_l");
		RefSkelModifier.Add(info, trans);
		info.Name = ("ik_hand_r");
		RefSkelModifier.Add(info, trans);

	}
	// rebuild tmp
	UniGLBGetRefSkeleton(sk).RebuildRefSkeleton(UniGLBGetSkeleton(sk), true);

	{
		FString orgBone[4];
		FString newBone[4] = {
			TEXT("ik_foot_l"),
			TEXT("ik_foot_r"),
			TEXT("ik_hand_l"),
			TEXT("ik_hand_r"),
		};
		FString parentBone[4] = {
			TEXT("ik_foot_root"),
			TEXT("ik_foot_root"),
			TEXT("ik_hand_gun"),
			TEXT("ik_hand_gun"),
		};
		{
			FString ue4bone[4] = {
				TEXT("foot_l"),
				TEXT("foot_r"),
				TEXT("hand_l"),
				TEXT("hand_r"),
			};
			for (int i = 0; i < 4; ++i) {
				FString humanoid;
				for (auto& t : UniGLBUtil::table_ue4_vrm) {
					if (t.BoneUE4 == ue4bone[i]) {
						humanoid = t.BoneVRM;
						break;
					}
				}
				for (auto& t : uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable) {
					if (t.Key == humanoid) {
						orgBone[i] = t.Value;
						break;
					}
				}
			}
		}

		// gun only
		FTransform gun_trans;
		{
			{
				const int i = 3;

				int32 ind = 0;
				ind = UniGLBGetRefSkeleton(sk).FindBoneIndex(*orgBone[i]);
				if (ind >= 0) {
					FTransform a;
					while (ind >= 0) {
						a *= BonePose[ind];
						ind = UniGLBGetRefSkeleton(sk).GetParentIndex(ind);
					}

					gun_trans = a;
					RefSkelModifier.UpdateRefPoseTransform(RefSkelModifier.FindBoneIndex(TEXT("ik_hand_gun")), a);
				}
			}
			// rebuild tmp
			UniGLBGetRefSkeleton(sk).RebuildRefSkeleton(UniGLBGetSkeleton(sk), true);
		}
		for (int i = 0; i < 4; ++i) {
			int32 ind = 0;
			ind = RefSkelModifier.FindBoneIndex(*orgBone[i]);
			if (ind >= 0) {
				bool first = true;
				FTransform a;
				while (ind >= 0) {
					a *= BonePose[ind];
					ind = UniGLBGetRefSkeleton(sk).GetParentIndex(ind);
				}
				if (i >= 2) {
					a = gun_trans.Inverse() * a;
				}
				RefSkelModifier.UpdateRefPoseTransform(RefSkelModifier.FindBoneIndex(*newBone[i]), a);
			}
		}
	}
}

