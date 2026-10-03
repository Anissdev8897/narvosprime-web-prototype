// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_ConvertMetadata.h"
#include "UniGLB_Convert.h"
#include "UniGLBAssimpScene.h"
#include "UniGLBLoaderLog.h"


#include "UniGLB_AssetListObject.h"
#include "UniGLB_MetaObject.h"
#include "UniGLB_LicenseObject.h"
#include "UniGLB_1LicenseObject.h"

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "AssetRegistry/AssetRegistryModule.h"
#include "UObject/Package.h"
#include "UObject/UObjectGlobals.h"

#include "UniGLB_Json.h"

#include <assimp/Importer.hpp>
#include <assimp/scene.h>
#include <assimp/mesh.h>
#include <assimp/postprocess.h>
#include <assimp/GltfMaterial.h>
#include <assimp/vrm/vrmmeta.h>

bool UniGLBConverter::ValidateSchema() {
	return jsonData.validateSchema();
}

bool UniGLBConverter::Init(const uint8* pFileData, size_t dataSize, const aiScene *pScene) {
	aiData = pScene;
	return InitJSON(pFileData, dataSize);
}

bool UniGLBConverter::InitJSON(const uint8* pFileData, size_t dataSize) {

	// little endian
	// skip size check
	auto readData = [](const uint8* data, size_t offset) {
		return static_cast<uint32_t>(data[offset]) |
			(static_cast<uint32_t>(data[offset + 1]) << 8) |
			(static_cast<uint32_t>(data[offset + 2]) << 16) |
			(static_cast<uint32_t>(data[offset + 3]) << 24);
		};

	if (dataSize < 20 || pFileData[0] != 'g' || pFileData[1] != 'l' || pFileData[2] != 'T' || pFileData[3] != 'F') {
		return false;
	}
	const uint32_t glTFversion = readData(pFileData, 4);
	const uint32_t total_length = readData(pFileData, 8);
	if (total_length != static_cast<uint32_t>(dataSize)) {
		return false;
	}


	uint32_t jsonSize = 0;
	if (glTFversion == 1) {
		// glTF 1.0 GLB VRM的には不要だが念のため
		const uint32_t content_length = readData(pFileData, 12);
		const uint32_t content_format = readData(pFileData, 16);
		if (content_format != 0) {
			UE_LOG(LogUniGLBLoader, Warning, TEXT("Content format is not JSON (glTF 1.0)"));
			return false;
		}
		if (20 + content_length > dataSize) {
			UE_LOG(LogUniGLBLoader, Warning, TEXT("Content length exceeds file size"));
			return false;
		}
		jsonSize = content_length;

	} else if (glTFversion == 2) {
		const uint32_t chunk_length = readData(pFileData, 12);
		if (pFileData[16] != 'J' || pFileData[17] != 'S' || pFileData[18] != 'O' || pFileData[19] != 'N') {
			UE_LOG(LogUniGLBLoader, Warning, TEXT("First chunk is not JSON"));
			return false;
		}
		if (20 + chunk_length > dataSize) {
			UE_LOG(LogUniGLBLoader, Warning, TEXT("Chunk length exceeds file size"));
			return false;
		}
		jsonSize = chunk_length;
	}
	else {
		UE_LOG(LogUniGLBLoader, Warning, TEXT("glbVersion error"));
		return false;
	}

	return jsonData.init(pFileData + 20, jsonSize);
}


static UUniGLBLicenseObject* tmpLicense0 = nullptr;
static UUniGLB1LicenseObject* tmpLicense1 = nullptr;
void UniGLBConverter::GetUniGLBMeta(const aiScene *mScenePtr, UUniGLBLicenseObject *& a, UUniGLB1LicenseObject *& b) {
	tmpLicense0 = nullptr;
	tmpLicense1 = nullptr;
	ConvertUniGLBMeta(nullptr, mScenePtr, nullptr, 0);

	a = tmpLicense0;
	b = tmpLicense1;
}

bool UniGLBConverter::ConvertUniGLBFirst(UUniGLBAssetListObject* uniGLBAssetList, const uint8* pData, size_t dataSize) {

	// material
	if (UniGLBConverter::Options::Get().IsVRM10Model()) {
		// mtoon params
		uniGLBAssetList->MaterialHasMToon.Empty();
		for (auto& mat : jsonData.doc["materials"].GetArray()) {
			bool b = false;
			if (mat.HasMember("extensions")) {
				if (mat["extensions"].HasMember("VRMC_materials_mtoon")) {
					b = true;
				}
			}
			uniGLBAssetList->MaterialHasMToon.Add(b);
		}
	} else {
		// alpha cutoff flag
		uniGLBAssetList->MaterialHasAlphaCutoff.Empty();
		if (jsonData.IsEnable()) {
			for (auto& mat : jsonData.doc["materials"].GetArray()) {
				bool b = false;
				if (mat.HasMember("alphaCutoff")) {
					b = true;
				}
				uniGLBAssetList->MaterialHasAlphaCutoff.Add(b);
			}
		}
	}

	return true;
}


bool UniGLBConverter::ConvertUniGLBMeta(UUniGLBAssetListObject* uniGLBAssetList, const aiScene* mScenePtr, const uint8* pData, size_t dataSize) {

	//auto GetDataJSON = [](const RAPIDJSON_NAMESPACE::Value& root, std::initializer_list<const char*> path) -> std::optional<const RAPIDJSON_NAMESPACE::Value*> {
	auto GetDataJSON = [](const RAPIDJSON_NAMESPACE::Value& root, std::initializer_list<const char*> path) -> std::pair<bool, const RAPIDJSON_NAMESPACE::Value*> {
		const RAPIDJSON_NAMESPACE::Value* current = &root;

		for (const char* key : path) {
			if (current->IsObject() == false) {
				return { false, nullptr };
			}
			auto itr = current->FindMember(key);
			if (itr == current->MemberEnd()) {
				return { false, nullptr };
			}
			current = &itr->value;
		}
		return { true, current };
		};


	tmpLicense0 = nullptr;
	tmpLicense1 = nullptr;
	VRM::VRMMetadata* SceneMeta = reinterpret_cast<VRM::VRMMetadata*>(mScenePtr->mVRMMeta);

	UUniGLBMetaObject* MetaObject = nullptr;
	UUniGLBLicenseObject* lic0 = nullptr;
	UUniGLB1LicenseObject* lic1 = nullptr;

	{
		UPackage* package = GetTransientPackage();

		if (uniGLBAssetList) {
			package = uniGLBAssetList->Package;
		}

		if (package == GetTransientPackage() || uniGLBAssetList == nullptr) {
			MetaObject = UniGLB_NewObject<UUniGLBMetaObject>(package, NAME_None, EObjectFlags::RF_Public | RF_Transient, NULL);
			if (UniGLBConverter::Options::Get().IsVRM10Model()) {
				lic1 = UniGLB_NewObject<UUniGLB1LicenseObject>(package, NAME_None, EObjectFlags::RF_Public | RF_Transient, NULL);
			} else {
				lic0 = UniGLB_NewObject<UUniGLBLicenseObject>(package, NAME_None, EObjectFlags::RF_Public | RF_Transient, NULL);
			}
		}
		else {

			if (uniGLBAssetList->ReimportBase) {
				MetaObject = uniGLBAssetList->ReimportBase->UniGLBMetaObject;
				lic0 = uniGLBAssetList->ReimportBase->UniGLBLicenseObject;
				lic1 = uniGLBAssetList->ReimportBase->UniGLB1LicenseObject;
			}
			if (MetaObject == nullptr) {
				MetaObject = UniGLB_NewObject<UUniGLBMetaObject>(package, *(FString(TEXT("VM_")) + uniGLBAssetList->BaseFileName + TEXT("_UniGLBMeta")), EObjectFlags::RF_Public | EObjectFlags::RF_Standalone);
			}

			if (UniGLBConverter::Options::Get().IsVRM10Model()) {
				if (lic1 == nullptr) {
					lic1 = UniGLB_NewObject<UUniGLB1LicenseObject>(package, *(FString(TEXT("VL_")) + uniGLBAssetList->BaseFileName + TEXT("_UniGLB1License")), EObjectFlags::RF_Public | EObjectFlags::RF_Standalone);
				}
			}
			else {
				if (lic0 == nullptr) {
					lic0 = UniGLB_NewObject<UUniGLBLicenseObject>(package, *(FString(TEXT("VL_")) + uniGLBAssetList->BaseFileName + TEXT("_UniGLBLicense")), EObjectFlags::RF_Public | EObjectFlags::RF_Standalone);
				}
			}

		}
		if (MetaObject) MetaObject->MarkPackageDirty();
		if (lic0) lic0->MarkPackageDirty();
		if (lic1) lic1->MarkPackageDirty();

		if (uniGLBAssetList) {
			uniGLBAssetList->UniGLBMetaObject = MetaObject;
			uniGLBAssetList->UniGLBLicenseObject = lic0;
			uniGLBAssetList->UniGLB1LicenseObject = lic1;
			MetaObject->UniGLBAssetListObject = uniGLBAssetList;
		}
		else {
			tmpLicense0 = lic0;
			tmpLicense1 = lic1;
		}

		if (UniGLBConverter::Options::Get().IsVRM10Model()) {
		}

	}

	if (SceneMeta == nullptr) {
		return false;
	}


	MetaObject->Version = 0;
	if (UniGLBConverter::Options::Get().IsVRM10Model()) {
		MetaObject->Version = 1;
	}

	// bone
	if (UniGLBConverter::Options::Get().IsVRM10Model()){
		// UniGLB10
		if (pData && dataSize) {
			auto &humanBone = jsonData.doc["extensions"]["VRMC_vrm"]["humanoid"]["humanBones"];
			auto &origBone = jsonData.doc["nodes"];

			for (auto& g : humanBone.GetObject()) {
				int node = g.value["node"].GetInt();

				if (node >= 0 && node < (int)origBone.Size()) {
					FString str = UTF8_TO_TCHAR(origBone[node]["name"].GetString());

					if (UniGLBConverter::Options::Get().IsForceOriginalBoneName()) {
					}else{
						str = UniGLBUtil::MakeName(str, true);
					}

					MetaObject->humanoidBoneTable.Add(UTF8_TO_TCHAR(g.name.GetString())) = str;
				} else {
					MetaObject->humanoidBoneTable.Add(UTF8_TO_TCHAR(g.name.GetString())) = "";
				}
			}
		}
	} else {
		for (auto& a : SceneMeta->humanoidBone) {
			if (FString(a.humanBoneName.C_Str()) == "") {
				continue;
			}
			FString str = UTF8_TO_TCHAR(a.nodeName.C_Str());
			if (UniGLBConverter::Options::Get().IsForceOriginalBoneName()) {
			} else {
				str = UniGLBUtil::MakeName(str, true);
			}
			MetaObject->humanoidBoneTable.Add(UTF8_TO_TCHAR(a.humanBoneName.C_Str())) = str;
		}
	}

	//shape
	if (UniGLBConverter::Options::Get().IsVRM10Model()) {
		// UniGLB10
		auto &presets = jsonData.doc["extensions"]["VRMC_vrm"]["expressions"]["preset"];

		MetaObject->BlendShapeGroup.SetNum(presets.Size());
		int presetIndex = -1;
		for (auto& presetData : presets.GetObject()){
			++presetIndex;

			MetaObject->BlendShapeGroup[presetIndex].name = UTF8_TO_TCHAR(presetData.name.GetString()); // ex happy

			auto &bindData = presetData.value["morphTargetBinds"];

			MetaObject->BlendShapeGroup[presetIndex].BlendShape.SetNum(bindData.Size());

			MetaObject->BlendShapeGroup[presetIndex].isBinary = presetData.value["isBinary"].GetBool();
			MetaObject->BlendShapeGroup[presetIndex].overrideBlink = presetData.value["overrideBlink"].GetString();
			MetaObject->BlendShapeGroup[presetIndex].overrideLookAt = presetData.value["overrideLookAt"].GetString();
			MetaObject->BlendShapeGroup[presetIndex].overrideMouth = presetData.value["overrideMouth"].GetString();

			int bindIndex = -1;
			for (auto &bind : bindData.GetArray()) {
				++bindIndex;

				//m->BlendShapeGroup[presetIndex].BlendShape[bindIndex].morphTargetName = UTF8_TO_TCHAR(aiGroup.bind[b].blendShapeName.C_Str());
				auto &targetShape = MetaObject->BlendShapeGroup[presetIndex].BlendShape[bindIndex];
				//targetShape.morphTargetName = UTF8_TO_TCHAR(aiGroup.bind[b].blendShapeName.C_Str());
				//targetShape.meshName = UTF8_TO_TCHAR(aiGroup.bind[b].meshName.C_Str());
				//targetShape.nodeName = UTF8_TO_TCHAR(aiGroup.bind[b].nodeName.C_Str());
				//targetShape.weight = aiGroup.bind[b].weight;
				targetShape.shapeIndex = bind["index"].GetInt();

				{
					int tmpNodeID = bind["node"].GetInt(); // adjust offset
					auto& jsonNode = jsonData.doc["nodes"];

					if (tmpNodeID >= 0 && tmpNodeID < (int)jsonNode.Size()) {
						if (GetDataJSON(jsonNode.GetArray()[tmpNodeID], { "mesh" }).second){
							int tmpMeshID = jsonNode.GetArray()[tmpNodeID]["mesh"].GetInt();

							//meshID offset
							int offset = 0;
							for (int meshNo = 0; meshNo < tmpMeshID; ++meshNo) {
								if (jsonData.doc["meshes"].GetArray()[meshNo].HasMember("primitives") == false) continue;
								//offset += jsonData.doc["meshes"].GetArray()[meshNo]["primitives"].Size() - 1;
							}
							targetShape.meshID = tmpMeshID + offset;
						}
					}
				}

				if (targetShape.meshID < (int)jsonData.doc["meshes"].Size()) {
					{
						auto& targetNames = jsonData.doc["meshes"].GetArray()[targetShape.meshID]["extras"]["targetNames"];
						if (targetShape.shapeIndex < (int)targetNames.Size()) {
							targetShape.morphTargetName = UTF8_TO_TCHAR(targetNames.GetArray()[targetShape.shapeIndex].GetString());
						}
					}

					{
						auto& tmp = jsonData.doc["meshes"][targetShape.meshID]["primitives"]["extras"]["targetNames"];
						if (targetShape.shapeIndex < (int)tmp.Size()) {
							targetShape.morphTargetName = tmp[targetShape.shapeIndex].GetString();

							if (UniGLBConverter::Options::Get().IsForceOriginalMorphTargetName()) {
							}else{
								targetShape.morphTargetName = UniGLBUtil::MakeName(targetShape.morphTargetName);
							}
						}
					}
					targetShape.meshName = UTF8_TO_TCHAR(jsonData.doc["meshes"].GetArray()[targetShape.meshID]["name"].GetString());
				}
			}
		}
	} else {
		MetaObject->BlendShapeGroup.SetNum(SceneMeta->blendShapeGroupNum);
		for (int i = 0; i < SceneMeta->blendShapeGroupNum; ++i) {
			auto& aiGroup = SceneMeta->blendShapeGroup[i];

			FString s = UTF8_TO_TCHAR(aiGroup.groupName.C_Str());
			if (UniGLBConverter::Options::Get().IsRemoveBlendShapeGroupPrefix()) {
				int32 ind = 0;
				if (s.FindLastChar('.', ind)) {
					if (ind < s.Len() - 1) {
						s = s.RightChop(ind+1);
					}
				}
			}
			MetaObject->BlendShapeGroup[i].name = s;

			MetaObject->BlendShapeGroup[i].BlendShape.SetNum(aiGroup.bindNum);
			for (int b = 0; b < aiGroup.bindNum; ++b) {
				auto& bind = MetaObject->BlendShapeGroup[i].BlendShape[b];
				bind.morphTargetName = UTF8_TO_TCHAR(aiGroup.bind[b].blendShapeName.C_Str());
				bind.meshName = UTF8_TO_TCHAR(aiGroup.bind[b].meshName.C_Str());
				bind.nodeName = UTF8_TO_TCHAR(aiGroup.bind[b].nodeName.C_Str());
				bind.weight = aiGroup.bind[b].weight;
				bind.meshID = aiGroup.bind[b].meshID;
				bind.shapeIndex = aiGroup.bind[b].shapeIndex;

				if (UniGLBConverter::Options::Get().IsForceOriginalMorphTargetName()) {
				}else{
					bind.morphTargetName = UniGLBUtil::MakeName(bind.morphTargetName);
				}
			}
		}
	}

	// tmp shape...
	if (pData && uniGLBAssetList) {
		if (UniGLBConverter::Options::Get().IsVRM10Model()) {
		} else {
			TMap<FString, FString> ParamTable;

			ParamTable.Add("_Color", "mtoon_Color");
			ParamTable.Add("_RimColor", "mtoon_RimColor");
			ParamTable.Add("_EmisionColor", "mtoon_EmissionColor");
			ParamTable.Add("_OutlineColor", "mtoon_OutColor");

			auto groupp = GetDataJSON(jsonData.doc, {"extensions", "VRM", "blendShapeMaster", "blendShapeGroups"});
			if (groupp.second) {
				const auto &group = *(groupp.second);
				for (int i = 0; i < (int)group.Size(); ++i) {
					if (MetaObject->BlendShapeGroup.IsValidIndex(i) == false) break;

					auto& bind = MetaObject->BlendShapeGroup[i];
					auto& shape = group[i];

					if (shape.HasMember("materialValues") == false) continue;
					if (shape["materialValues"].IsArray() == false) continue;

					for (auto& mat : shape["materialValues"].GetArray()) {
						if (mat.IsObject() == false) continue;
						if (mat.HasMember("materialName") == false || mat.HasMember("propertyName") == false || mat.HasMember("targetValue") == false) continue;

						FUniGLBBlendShapeMaterialList mlist;
						mlist.materialName = mat["materialName"].GetString();
						mlist.propertyName = mat["propertyName"].GetString();

						FString* tmp = uniGLBAssetList->MaterialNameOrigToAsset.Find(NormalizeFileName(mlist.materialName));
						if (tmp == nullptr) {
							continue;
						}
						mlist.materialName = *tmp;
						if (ParamTable.Find(mlist.propertyName)) {
							mlist.propertyName = ParamTable[mlist.propertyName];
						}
						mlist.color = FLinearColor(
							mat["targetValue"].GetArray()[0].GetFloat(),
							mat["targetValue"].GetArray()[1].GetFloat(),
							mat["targetValue"].GetArray()[2].GetFloat(),
							mat["targetValue"].GetArray()[3].GetFloat());
						bind.MaterialList.Add(mlist);
					}
				}
			}
		}
	}

	if (UniGLBConverter::Options::Get().IsVRM10Model()) {
		auto pp = GetDataJSON(jsonData.doc, { "extensions", "VRMC_springBone", "springs"});
		if (pp.second) {
			const auto& jsonSpring = *pp.second;

			auto& sMeta = MetaObject->UniGLB1SpringBoneMeta.Springs;
			sMeta.SetNum(jsonSpring.Size());
			for (uint32 springNo = 0; springNo < jsonSpring.Size(); ++springNo) {
				auto& jsonJoints = jsonSpring.GetArray()[springNo]["joints"];
				auto& dstSpring = sMeta[springNo];
				dstSpring.joints.SetNum(jsonJoints.Size());
				for (uint32 jointNo = 0; jointNo < jsonJoints.Size(); ++jointNo) {
					auto& jj = jsonJoints.GetArray()[jointNo];

					auto& s = dstSpring.joints[jointNo];

					s.dragForce = jj["dragForce"].GetFloat();
					s.gravityPower = jj["gravityPower"].GetFloat();
					if (jj.HasMember("gravityDir")) {
						if (jj["gravityDir"].GetArray().Size() == 3) {
							s.gravityDir.X = jj["gravityDir"][0].GetFloat();
							s.gravityDir.Y = jj["gravityDir"][1].GetFloat();
							s.gravityDir.Z = jj["gravityDir"][2].GetFloat();
						}
					}
					int node = jj["node"].GetInt();
					s.boneNo = -1;// node; // reset after bone optimize

					{
						auto& jsonNode = jsonData.doc["nodes"];
						if (node >= 0 && node < (int)jsonNode.Size()) {
							s.boneName = UniGLBUtil::GetSafeNewName(UTF8_TO_TCHAR(jsonNode[node]["name"].GetString()));
						}
					}

					s.hitRadius = jj["hitRadius"].GetFloat();
					s.stiffness = jj["stiffness"].GetFloat();

				}
				auto& jsonColliderGroups = jsonSpring.GetArray()[springNo]["colliderGroups"];

				dstSpring.colliderGroups.SetNum(jsonColliderGroups.Size());
				for (uint32 colNo = 0; colNo < jsonColliderGroups.Size(); ++colNo) {
					dstSpring.colliderGroups[colNo] = jsonColliderGroups[colNo].GetInt();
				}
			}

			auto& colMeta = MetaObject->UniGLB1SpringBoneMeta.Colliders;
			auto& jsonColliders = jsonData.doc["extensions"]["VRMC_springBone"]["colliders"];
			colMeta.SetNum(jsonColliders.Size());
			for (int colNo = 0; colNo < (int)jsonColliders.Size(); ++colNo) {
				auto& jsonCol = jsonColliders[colNo];
				auto& cMeta = colMeta[colNo];

				int node = jsonCol["node"].GetInt();
				{
					auto& jsonNode = jsonData.doc["nodes"];
					if (node >= 0 && node < (int)jsonNode.Size()) {
						cMeta.boneName = UniGLBUtil::GetSafeNewName(UTF8_TO_TCHAR(jsonNode[node]["name"].GetString()));
					}
				}
				if (jsonCol["shape"].HasMember("sphere")) {
					if (GetDataJSON(jsonCol, { "shape", "sphere", "offset" }).second && GetDataJSON(jsonCol, { "shape", "sphere", "radius" }).second) {
						cMeta.offset.Set(
							jsonCol["shape"]["sphere"]["offset"][0].GetFloat(),
							jsonCol["shape"]["sphere"]["offset"][1].GetFloat(),
							jsonCol["shape"]["sphere"]["offset"][2].GetFloat());
						cMeta.radius = jsonCol["shape"]["sphere"]["radius"].GetFloat();
						cMeta.shapeType = TEXT("sphere");
					}
				}

				if (jsonCol["shape"].HasMember("capsule")) {
					if (GetDataJSON(jsonCol, { "shape", "capsule", "offset" }).second && GetDataJSON(jsonCol, { "shape", "capsule", "radius" }).second && GetDataJSON(jsonCol, { "shape", "capsule", "tail" }).second) {
						cMeta.offset.Set(
							jsonCol["shape"]["capsule"]["offset"][0].GetFloat(),
							jsonCol["shape"]["capsule"]["offset"][1].GetFloat(),
							jsonCol["shape"]["capsule"]["offset"][2].GetFloat());
						cMeta.radius = jsonCol["shape"]["capsule"]["radius"].GetFloat();
						cMeta.tail.Set(
							jsonCol["shape"]["capsule"]["tail"][0].GetFloat(),
							jsonCol["shape"]["capsule"]["tail"][1].GetFloat(),
							jsonCol["shape"]["capsule"]["tail"][2].GetFloat());
						cMeta.shapeType = TEXT("capsule");
					}
				}
			}


			{
				auto& cogMeta = MetaObject->UniGLB1SpringBoneMeta.ColliderGroups;
				auto& jsonColliderGroups = jsonData.doc["extensions"]["VRMC_springBone"]["colliderGroups"];

				cogMeta.SetNum(jsonColliderGroups.Size());
				for (int cgNo = 0; cgNo < (int)jsonColliderGroups.Size(); ++cgNo) {

					cogMeta[cgNo].name = jsonColliderGroups[cgNo].GetString();
					for (int colNo = 0; colNo < (int)jsonColliderGroups[cgNo]["colliders"].Size(); ++colNo) {
						cogMeta[cgNo].colliders.Add(jsonColliderGroups[cgNo]["colliders"][colNo].GetInt());
					}
				}
			}

			//sMeta.SetNum(jsonSpring.Size());

			//auto& jsonColliderGroups = jsonSpring.GetArray()[springNo]["collidergroups"];
		}
	} else {
		// spring
		MetaObject->UniGLBSpringMeta.SetNum(SceneMeta->springNum);
		for (int i = 0; i < SceneMeta->springNum; ++i) {
			const auto& vrms = SceneMeta->springs[i];

			auto& s = MetaObject->UniGLBSpringMeta[i];
			s.stiffness = vrms.stiffness;
			s.gravityPower = vrms.gravityPower;
			s.gravityDir.Set(vrms.gravityDir[0], vrms.gravityDir[1], vrms.gravityDir[2]);
			s.dragForce = vrms.dragForce;
			s.hitRadius = vrms.hitRadius;

			s.bones.SetNum(vrms.boneNum);
			s.boneNames.SetNum(vrms.boneNum);
			for (int b = 0; b < vrms.boneNum; ++b) {
				s.bones[b] = vrms.bones[b];
				s.boneNames[b] = UTF8_TO_TCHAR(vrms.bones_name[b].C_Str());
			}


			s.ColliderIndexArray.SetNum(vrms.colliderGourpNum);
			for (int c = 0; c < vrms.colliderGourpNum; ++c) {
				s.ColliderIndexArray[c] = vrms.colliderGroups[c];
			}
		}

		//collider
		MetaObject->UniGLBColliderMeta.SetNum(SceneMeta->colliderGroupNum);
		for (int i = 0; i < SceneMeta->colliderGroupNum; ++i) {
			const auto& uniGLBc = SceneMeta->colliderGroups[i];

			auto& c = MetaObject->UniGLBColliderMeta[i];
			c.bone = uniGLBc.node;
			c.boneName = UTF8_TO_TCHAR(uniGLBc.node_name.C_Str());

			c.collider.SetNum(uniGLBc.colliderNum);
			for (int b = 0; b < uniGLBc.colliderNum; ++b) {
				c.collider[b].offset = FVector(uniGLBc.colliders[b].offset[0], uniGLBc.colliders[b].offset[1], uniGLBc.colliders[b].offset[2]);
				c.collider[b].radius = uniGLBc.colliders[b].radius;
			}
		}
	}

	//constraint
	if (UniGLBConverter::Options::Get().IsVRM10Model()) {
		// UniGLB10
		auto& nodes = jsonData.doc["nodes"];
		for (auto& node : nodes.GetArray()) {

			auto pp = GetDataJSON(jsonData.doc, { "extensions", "VRMC_node_constraint", "constraint" });

			if (!pp.second) continue;
			auto& constraint = *pp.second;

			if (constraint.HasMember("roll")) {
				FUniGLBConstraintRoll c;

				c.source = constraint["roll"]["source"].GetInt();
				if (c.source < (int)nodes.Size()) {
					c.sourceName = nodes.GetArray()[c.source]["name"].GetString();
				}
				c.rollAxis = constraint["roll"]["rollAxis"].GetString();
				c.weight = constraint["roll"]["weight"].GetFloat();

				FString n = node["name"].GetString();
				if (UniGLBConverter::Options::Get().IsForceOriginalBoneName() == false) {
					n = UniGLBUtil::MakeName(n, true);
					c.sourceName = UniGLBUtil::MakeName(c.sourceName, true);
				}

				FUniGLBConstraint cc;
				cc.constraintRoll = c;
				cc.type = EUniGLBConstraintType::Roll;

				MetaObject->UniGLBConstraintMeta.Add(n, cc);
			}
			if (constraint.HasMember("aim")) {
				FUniGLBConstraintAim c;

				c.source = constraint["aim"]["source"].GetInt();
				if (c.source < (int)nodes.Size()) {
					c.sourceName = nodes.GetArray()[c.source]["name"].GetString();
				}
				c.aimAxis = constraint["aim"]["aimAxis"].GetString();
				c.weight = constraint["aim"]["weight"].GetFloat();

				FString n = node["name"].GetString();
				if (UniGLBConverter::Options::Get().IsForceOriginalBoneName() == false) {
					n = UniGLBUtil::MakeName(n, true);
					c.sourceName = UniGLBUtil::MakeName(c.sourceName, true);
				}

				FUniGLBConstraint cc;
				cc.constraintAim = c;
				cc.type = EUniGLBConstraintType::Aim;

				MetaObject->UniGLBConstraintMeta.Add(n, cc);
			}
			if (constraint.HasMember("rotation")) {
				FUniGLBConstraintRotation c;

				c.source = constraint["rotation"]["source"].GetInt();
				if (c.source < (int)nodes.Size()) {
					c.sourceName = nodes.GetArray()[c.source]["name"].GetString();
				}
				c.weight = constraint["rotation"]["weight"].GetFloat();

				FString n = node["name"].GetString();
				if (UniGLBConverter::Options::Get().IsForceOriginalBoneName() == false) {
					n = UniGLBUtil::MakeName(n, true);
					c.sourceName = UniGLBUtil::MakeName(c.sourceName, true);
				}

				FUniGLBConstraint cc;
				cc.constraintRotation = c;
				cc.type = EUniGLBConstraintType::Rotation;

				MetaObject->UniGLBConstraintMeta.Add(n, cc);
			}
		}
	}

	// vrma
	if (UniGLBConverter::Options::Get().IsVRMAModel()) {
		if (pData && dataSize) {
			{

				auto ppBone = GetDataJSON(jsonData.doc, { "extensions", "VRMC_vrm_animation", "humanoid", "humanBones" });

				if (ppBone.second) {
					auto& humanBone = *ppBone.second;
					auto& origBone = jsonData.doc["nodes"];

					for (auto& g : humanBone.GetObject()) {
						int nodeNo = g.value["node"].GetInt();

						if (FString(g.name.GetString()) == "") {
							continue;
						}

						if (nodeNo >= 0 && nodeNo < (int)origBone.Size()) {
							MetaObject->humanoidBoneTable.Add(UTF8_TO_TCHAR(g.name.GetString())) = UTF8_TO_TCHAR(origBone[nodeNo]["name"].GetString());
						}
						else {
							MetaObject->humanoidBoneTable.Add(UTF8_TO_TCHAR(g.name.GetString())) = "";
						}
					}
				}
			}
			{
				auto ppPreset = GetDataJSON(jsonData.doc, { "extensions", "VRMC_vrm_animation", "expressions", "preset" });

				if (ppPreset.second) {
					auto& p = *ppPreset.second;
					for (auto& m : p.GetObject()) {
						FUniGLBAnimationExpressionPreset meta;
						meta.expressionName = m.name.GetString();
						meta.expressionNode = m.value["node"].GetInt();
						meta.expressionNodeName = jsonData.doc["nodes"].GetArray()[meta.expressionNode]["name"].GetString();

						uniGLBAssetList->UniGLBMetaObject->UniGLBAnimationMeta.expressionPreset.Add(meta);
					}
				}
			}
			{
				auto pp = GetDataJSON(jsonData.doc, { "extensions", "VRMC_vrm_animation", "lookAt", "node" });
				if (pp.second) {
					auto& at = *pp.second;
					if (at.IsInt()) {
						uniGLBAssetList->UniGLBMetaObject->UniGLBAnimationMeta.lookAt.lookAtNode = at.GetInt();
					}
				}
			}
		}
	}


	// license
		// license
	if (UniGLBConverter::Options::Get().IsVRM10Model()) {
		auto ppMeta = GetDataJSON(jsonData.doc, { "extensions", "VRMC_vrm_animation", "meta" });

		if (ppMeta.second) {
			auto& meta = *ppMeta.second;
			for (auto m = meta.MemberBegin(); m != meta.MemberEnd(); ++m) {

				FString key = UTF8_TO_TCHAR((*m).name.GetString());

				if (key.Find("allow") == 0) {
					FUniGLBLicenseBoolDataPair p;
					p.key = key;
					p.value = (*m).value.GetBool();
					lic1->LicenseBool.Add(p);
				} else if (key == "thumbnailImage") {
					if (uniGLBAssetList) {
						int t = (*m).value.GetInt();
						if (t >= 0 && t < uniGLBAssetList->Textures.Num()) {
							lic1->thumbnail = uniGLBAssetList->Textures[t];
#if WITH_EDITORONLY_DATA
							uniGLBAssetList->SmallThumbnailTexture = lic1->thumbnail;
#endif
						}
					}
				} else {
					if ((*m).value.IsArray()) {
						int ind = 0;
						bool bFound = false;
						for (auto& a : lic1->LicenseStringArray) {
							if (a.key != key) {
								++ind;
								continue;
							}
							bFound = true;
							break;
						}
						if (bFound == false) {
							ind = lic1->LicenseStringArray.AddDefaulted();
							lic1->LicenseStringArray[ind].key = key;
						}
						for (auto& a : (*m).value.GetArray()) {
							lic1->LicenseStringArray[ind].value.Add(UTF8_TO_TCHAR(a.GetString()));
						}
					} else {
						FUniGLBLicenseStringDataPair p;
						p.key = key;
						p.value = UTF8_TO_TCHAR((*m).value.GetString());
						lic1->LicenseString.Add(p);
					}
				}
			}
		}
	}else {
		struct TT {
			FString key;
			FString &dst;
		};
		const TT table[] = {
			{TEXT("version"),		lic0->version},
			{TEXT("author"),			lic0->author},
			{TEXT("contactInformation"),	lic0->contactInformation},
			{TEXT("reference"),		lic0->reference},
				// texture skip
			{TEXT("title"),			lic0->title},
			{TEXT("allowedUserName"),	lic0->allowedUserName},
			{TEXT("violentUsageName"),	lic0->violentUsageName},
			{TEXT("sexualUsageName"),	lic0->sexualUsageName},
			{TEXT("commercialUsageName"),	lic0->commercialUsageName},
			{TEXT("otherPermissionUrl"),		lic0->otherPermissionUrl},
			{TEXT("licenseName"),			lic0->licenseName},
			{TEXT("otherLicenseUrl"),		lic0->otherLicenseUrl},

			{TEXT("violentUssageName"),	lic0->violentUsageName},
			{TEXT("sexualUssageName"),	lic0->sexualUsageName},
			{TEXT("commercialUssageName"),	lic0->commercialUsageName},
		};
		for (int i = 0; i < SceneMeta->license.licensePairNum; ++i) {

			auto &p = SceneMeta->license.licensePair[i];

			for (auto &t : table) {
				if (t.key == p.Key.C_Str()) {
					t.dst = UTF8_TO_TCHAR(p.Value.C_Str());
				}
			}
			if (uniGLBAssetList) {
				if (FString(TEXT("texture")) == p.Key.C_Str()) {
					int t = FCString::Atoi(*FString(p.Value.C_Str()));
					if (t >= 0 && t < uniGLBAssetList->Textures.Num()) {
						lic0->thumbnail = uniGLBAssetList->Textures[t];
					}
				}
			}
		}
	}

	return true;
}

bool UniGLBConverter::ConvertUniGLBMetaPost(UUniGLBAssetListObject* uniGLBAssetList, const aiScene* mScenePtr, const uint8* pData, size_t dataSize) {

	//sort
	if (uniGLBAssetList && uniGLBAssetList->UniGLBMetaObject){
		auto& t = uniGLBAssetList->UniGLBMetaObject->humanoidBoneTable;
		if (uniGLBAssetList->SkeletalMesh) {
			auto& rk = UniGLBGetRefSkeleton(uniGLBAssetList->SkeletalMesh);
			for (int i = 0; i < t.Num() - 1; ++i) {

				t.ValueSort([&rk](const FString A, const FString B) {
					return rk.FindBoneIndex(*A) < rk.FindBoneIndex(*B);
					}
				);
			}
		}
	}

	if (UniGLBConverter::Options::Get().IsGenerateHumanoidRenamedMesh()) {
		UPackage* package = GetTransientPackage();

		if (uniGLBAssetList) {
			package = uniGLBAssetList->Package;
		}

		UUniGLBMetaObject* m = uniGLBAssetList->UniGLBMetaObject;

		//m2 = UniGLB_NewObject<UUniGLBMetaObject>(package, *(FString(TEXT("VM_")) + uniGLBAssetList->BaseFileName + TEXT("_UniGLBMeta")), EObjectFlags::RF_Public | EObjectFlags::RF_Standalone);
		{
			TMap<FString, FString> BoneTable;

			UUniGLBMetaObject* m2 = UniGLB_DuplicateObject<UUniGLBMetaObject>(m, package, *(FString(TEXT("VM_")) + uniGLBAssetList->BaseFileName + TEXT("_ue4mannequin_UniGLBMeta")));
			uniGLBAssetList->UniGLBMannequinMetaObject = m2;
			for (auto& a : m2->humanoidBoneTable) {
				auto c = UniGLBUtil::table_ue4_vrm.FindByPredicate([a](const UniGLBUtil::UniGLBBoneTable& data) {
					// meta humanoid key == utiltable uniGLBbone
					return a.Key.ToLower() == data.BoneVRM.ToLower();
				});
				if (c) {
					if (a.Value != "") {
						BoneTable.Add(a.Value, c->BoneUE4);
						a.Value = c->BoneUE4;
					}
				}
			}
			for (auto& a : m2->UniGLBColliderMeta) {
				auto c = BoneTable.Find(a.boneName);
				if (c) {
					if (a.boneName != "") {
						a.boneName = *c;
					}
				}
			}
			for (auto& a : m2->UniGLBSpringMeta) {
				for (auto& b : a.boneNames) {
					auto c = BoneTable.Find(b);
					//auto c = UniGLBUtil::table_ue4_vrm.FindByPredicate([b](const UniGLBUtil::UniGLBBoneTable& data) { return b.ToLower() == data.BoneVRM.ToLower(); });
					if (c) {
						if (b != "") {
							b = *c;
						}
					}
				}
			}
		}

		{
			TMap<FString, FString> BoneTable;

			UUniGLBMetaObject* m3 = UniGLB_DuplicateObject<UUniGLBMetaObject>(m, package, *(FString(TEXT("VM_")) + uniGLBAssetList->BaseFileName + TEXT("_humanoid_UniGLBMeta")));
			uniGLBAssetList->UniGLBHumanoidMetaObject = m3;
			for (auto& a : m3->humanoidBoneTable) {
				if (a.Value != "") {
					BoneTable.Add(a.Value, a.Key);
					a.Value = a.Key;
				}
			}
			for (auto& a : m3->UniGLBColliderMeta) {
				auto c = BoneTable.Find(a.boneName);
				if (c) {
					if (a.boneName != "") {
						a.boneName = *c;
					}
				}
			}
			for (auto& a : m3->UniGLBSpringMeta) {
				for (auto& b : a.boneNames) {
					auto c = BoneTable.Find(b);
					//auto c = UniGLBUtil::table_ue4_vrm.FindByPredicate([b](const UniGLBUtil::UniGLBBoneTable& data) { return b.ToLower() == data.BoneVRM.ToLower(); });
					if (c) {
						if (b != "") {
							b = *c;
						}
					}
				}
			}
		}
	}


	// vrm1
	if (uniGLBAssetList->SkeletalMesh){
		auto& sk = uniGLBAssetList->SkeletalMesh;
		auto& refSkeleton = UniGLBGetRefSkeleton(sk);

		{
			auto& sMeta = uniGLBAssetList->UniGLBMetaObject->UniGLB1SpringBoneMeta.Springs;

			for (auto& s : sMeta) {
				for (auto& j : s.joints) {
					j.boneNo = refSkeleton.FindBoneIndex(*j.boneName);
				}
			}
		}
		{
			auto& cMeta = uniGLBAssetList->UniGLBMetaObject->UniGLB1SpringBoneMeta.Colliders;

			for (auto& s : cMeta) {
				s.boneNo = refSkeleton.FindBoneIndex(*s.boneName);
			}
		}
	}

	return true;
}


UniGLBConvertMetadata::UniGLBConvertMetadata()
{
}

UniGLBConvertMetadata::~UniGLBConvertMetadata()
{
}
