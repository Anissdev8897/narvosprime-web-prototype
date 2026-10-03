// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_ConvertTexture.h"
#include "UniGLB_Convert.h"
#include "UniGLBAssimpScene.h"
#include "UniGLB_Util.h"

#include "Materials/MaterialExpressionTextureSampleParameter2D.h"

#include "Modules/ModuleManager.h"
#include "IImageWrapper.h"
#include "IImageWrapperModule.h"
#include "PixelFormat.h"
#include "RenderUtils.h"
#include "Engine/Texture.h"
#include "Engine/Texture2D.h"
#include "Materials/Material.h"
#include "Engine/SubsurfaceProfile.h"
#include "Materials/MaterialInstanceConstant.h"
#include "UniGLB_AssetListObject.h"
#include "Async/ParallelFor.h"
#include "UObject/UObjectHash.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"

#if WITH_EDITOR
#include "Factories.h"
#include "Factories/TextureFactory.h"

#endif

#include <assimp/Importer.hpp>
#include <assimp/scene.h>
#include <assimp/mesh.h>
#include <assimp/postprocess.h>
#include <assimp/material.h>
#include <assimp/GltfMaterial.h>
#include <assimp/vrm/vrmmeta.h>

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 23, 0)] (target floor (5, 7, 0)); kept #else branch only.


namespace {

	bool bDefaultUniGLBMaterial = false;
	bool LocalIsOriginalUniGLBMaterial() {
		return bDefaultUniGLBMaterial;
	}
	void LocalSetOriginalUniGLBMaterial(bool b) {
		bDefaultUniGLBMaterial = b;
	}

	void LocalMaterialSetParent(UMaterialInstanceConstant *material, UMaterialInterface *parent) {
#if WITH_EDITOR
		if (UniGLBConverter::IsImportMode()) {
			material->SetParentEditorOnly(parent);
		} else {
			material->Parent = parent;
		}
		FMaterialUpdateContext UpdateContext(FMaterialUpdateContext::EOptions::Default, GMaxRHIShaderPlatform);
		UpdateContext.AddMaterialInstance(material);
#else
		material->Parent = parent;
#endif
	}

	void LocalTextureSet(UMaterialInstanceConstant *dm, FName name, UTexture2D * tex) {
#if WITH_EDITOR
		if (UniGLBConverter::IsImportMode()) {
			dm->SetTextureParameterValueEditorOnly(name, tex);
		}else{
			FTextureParameterValue *v = new (dm->TextureParameterValues) FTextureParameterValue();
			v->ParameterInfo.Index = INDEX_NONE;
			v->ParameterInfo.Name = name;
			v->ParameterInfo.Association = EMaterialParameterAssociation::GlobalParameter;
			v->ParameterValue = tex;
		}
#else
		FTextureParameterValue *v = new (dm->TextureParameterValues) FTextureParameterValue();
		v->ParameterInfo.Index = INDEX_NONE;
		v->ParameterInfo.Name = name;
		v->ParameterInfo.Association = EMaterialParameterAssociation::GlobalParameter;
		v->ParameterValue = tex;
#endif
	}

	void LocalScalarParameterSet(UMaterialInstanceConstant *dm, FName name, float f) {
		bool bSet = false;
#if WITH_EDITOR
		if (UniGLBConverter::IsImportMode()) {
			dm->SetScalarParameterValueEditorOnly(name, f);
			bSet = true;
		}
#endif
		if (bSet == false) {
			FScalarParameterValue *v = nullptr;
			for (auto &a : dm->ScalarParameterValues) {
				if (a.ParameterInfo.Name == name) {
					v = &a;
				}
			}
			if (v == nullptr) {
				v = new (dm->ScalarParameterValues) FScalarParameterValue();
			}
			v->ParameterInfo.Index = INDEX_NONE;
			v->ParameterInfo.Name = name;
			v->ParameterInfo.Association = EMaterialParameterAssociation::GlobalParameter;
			v->ParameterValue = f;
		}
	}

	void LocalVectorParameterSet(UMaterialInstanceConstant *dm, FName name, FLinearColor c) {
		bool bSet = false;
#if WITH_EDITOR
		if (UniGLBConverter::IsImportMode()) {
			dm->SetVectorParameterValueEditorOnly(name, c);
			bSet = true;
		}
#endif
		if (bSet == false) {
			FVectorParameterValue *v = nullptr;
			for (auto &a : dm->VectorParameterValues) {
				if (a.ParameterInfo.Name == name) {
					v = &a;
				}
			}
			if (v == nullptr) {
				v = new (dm->VectorParameterValues) FVectorParameterValue();
			}

			v->ParameterInfo.Index = INDEX_NONE;
			v->ParameterInfo.Name = name;
			v->ParameterInfo.Association = EMaterialParameterAssociation::GlobalParameter;
			v->ParameterValue = c;
		}
	}


	void LocalMaterialFinishParam(UMaterialInstanceConstant *material) {
#if WITH_EDITOR
		if (UniGLBConverter::IsImportMode()) {
			material->PreEditChange(NULL);
			material->PostEditChange();
		} else {
			material->PostLoad();
		}
#else
		material->PostLoad();
#endif
	}


	void createSmallThumbnail(UUniGLBAssetListObject *uniGLBAssetList, const aiScene *aiData) {
#if WITH_EDITORONLY_DATA
		UTexture2D *src = nullptr;

		VRM::VRMMetadata *meta = reinterpret_cast<VRM::VRMMetadata*>(aiData->mVRMMeta);
		if (meta == nullptr) {
			return;
		}

		int TextureID = -1;
		for (int i = 0; i < meta->license.licensePairNum; ++i) {
			auto &p = meta->license.licensePair[i];

			if (FString(TEXT("texture")) == p.Key.C_Str()) {

				int t = FCString::Atoi(*FString(p.Value.C_Str()));
				if (t >= 0 && t < uniGLBAssetList->Textures.Num()) {
					src = uniGLBAssetList->Textures[t];
					TextureID = t;
					break;
				}
			}
		}
		if (src == nullptr) {
			// todo small texture uniGLB1license
		}
		if (src == nullptr) {
			return;
		}

		
		const int W = src->GetSurfaceWidth();
		const int H = src->GetSurfaceHeight();

		int dW = FMath::Min(256, W);
		int dH = FMath::Min(256, H);

		uniGLBAssetList->SmallThumbnailTexture = src;
		if (W == dW && H == dH) {
			return;
		}
		if (W != H) {
			return;
		}
		if (TextureID < 0 || TextureID >= (int)aiData->mNumTextures) {
			return;
		}
		if (aiData->mTextures[TextureID] == nullptr) {
			return;
		}


		TArray<uint8> sData;
		sData.SetNum(W * H * 4);
		TArray<uint8> dData;
		dData.SetNum(256*256 * 4);

		FString baseName = (src->GetFName()).ToString();
		baseName += TEXT("_small");

		{
			UniGLBUtil::FImportImage img;
			auto *a = aiData->mTextures[TextureID];
			if (UniGLBLoaderUtil::LoadImageFromMemory(a->pcData, a->mWidth, img) == false) {
				return;
			}
			if (img.RawData.GetData() == nullptr) {
				return;
			}
			FMemory::Memcpy(sData.GetData(), img.RawData.GetData(), img.RawData.Num());
		}


		UPackage* pkg = uniGLBAssetList->Package;
		if (UniGLBConverter::Options::Get().IsSingleUAssetFile() == false) {
			pkg = UniGLB_CreatePackage(uniGLBAssetList->Package, *baseName);
		}
		UTexture2D* NewTexture2D = UniGLBLoaderUtil::CreateTexture(W, H, baseName, pkg);

		// scale texture
		{
			ParallelFor(dH, [&](int32 y){
			//for (int32 y = 0; y < dH; y++){
				float s = (float)H / dH;

				for (int32 x = 0; x < dW; x++){
					int32 xx = (s * (0.5f + x));
					int32 yy = (s * (0.5f + y));
					uint8* dp = &dData[(y * dW + x) * sizeof(uint8) * 4];

					int c = 0;
					int tmp[4] = {};
					int n = (float)W / dW / 2;
					for (int ry = yy - n; ry <= yy + n; ry++) {
						for (int rx = xx - n; rx <= xx + n; rx++) {
							if (rx < 0 || ry < 0) continue;
							if (rx >= W || ry >= H) continue;

							const uint8* rp = &sData[(ry * W + rx) * sizeof(uint8) * 4];
							tmp[0] += rp[0];
							tmp[1] += rp[1];
							tmp[2] += rp[2];
							tmp[3] += rp[3];

							++c;
						}
					}
					dp[0] = tmp[0] / c;
					dp[1] = tmp[1] / c;
					dp[2] = tmp[2] / c;
					dp[3] = tmp[3] / c;
				}
			});

			// Set options
			NewTexture2D->SRGB = true;// bUseSRGB;
			NewTexture2D->CompressionSettings = TC_Default;

			NewTexture2D->AddressX = TA_Wrap;
			NewTexture2D->AddressY = TA_Wrap;

			NewTexture2D->CompressionNone = false;
			NewTexture2D->DeferCompression = true;
			if (UniGLBConverter::Options::Get().IsMipmapGenerateMode() && FMath::IsPowerOfTwo(dW) && FMath::IsPowerOfTwo(dH)) {
				NewTexture2D->MipGenSettings = TMGS_FromTextureGroup;
			} else {
				NewTexture2D->MipGenSettings = TMGS_NoMipmaps;
			}
			NewTexture2D->Source.Init(dW, dH, 1, 1, ETextureSourceFormat::TSF_BGRA8, dData.GetData());
			//NewTexture2D->Source.Compress();

			// Update the remote texture data
			NewTexture2D->UpdateResource();
			NewTexture2D->PostEditChange();
			uniGLBAssetList->SmallThumbnailTexture = NewTexture2D;
		}
#endif
	}

	bool createAndAddMaterial(UMaterialInstanceConstant *dm, int matIndex, UUniGLBAssetListObject *uniGLBAssetList, const UniGLBConverter *vc,
		const TArray<int> &TextureTypeToIndex
	) {
		auto i = matIndex;

		// default set function
		auto SetLocalParamsForVector = [](auto* dm) {
			LocalVectorParameterSet(dm, TEXT("mtoon_Color"), FLinearColor(1, 1, 1, 1));
			LocalVectorParameterSet(dm, TEXT("mtoon_ShadeColor"), FLinearColor(1, 1, 1, 1));
			LocalVectorParameterSet(dm, TEXT("mtoon_OutlineColor"), FLinearColor(0, 0, 0, 1));
		};
		auto SetLocalParamsForScaler = [](auto* dm) {
			LocalScalarParameterSet(dm, TEXT("mtoon_BumpScale"), 1.f);
			LocalScalarParameterSet(dm, TEXT("mtoon_NormalScale"), 1.f);
			LocalScalarParameterSet(dm, TEXT("mtoon_ReceiveShadowRate"), 1.f);

			LocalScalarParameterSet(dm, TEXT("mtoon_OutlineLightingMix"), 1.f);
			LocalScalarParameterSet(dm, TEXT("mtoon_OutlineWidth"), 0.1f);
			LocalScalarParameterSet(dm, TEXT("mtoon_OutlineWidthMode"), 1.f);
		};

		// default for not vrm material
		if (dm) {
			if (LocalIsOriginalUniGLBMaterial() == false) {
				SetLocalParamsForVector(dm);
				SetLocalParamsForScaler(dm);
			}
		}

		// UniGLB1
		if (UniGLBConverter::Options::Get().IsVRM10Model()) {
			LocalScalarParameterSet(dm, TEXT("bVRM10Mode"), 1.f);
		}

		VRM::VRMMaterial uniGLBMat;
		if (vc->GetMatParam(uniGLBMat, i) == false) {
			return false;
		}
		{
			struct TT {
				FString key;
				float* value;
			};
			TT tableParam[] = {
				{TEXT("_Color"),			uniGLBMat.vectorProperties._Color},
				{TEXT("_ShadeColor"),	uniGLBMat.vectorProperties._ShadeColor},
				{TEXT("_MainTex"),		uniGLBMat.vectorProperties._MainTex},
				{TEXT("_ShadeTexture"),	uniGLBMat.vectorProperties._ShadeTexture},
				{TEXT("_BumpMap"),				uniGLBMat.vectorProperties._BumpMap},
				{TEXT("_ReceiveShadowTexture"),	uniGLBMat.vectorProperties._ReceiveShadowTexture},
				{TEXT("_ShadingGradeTexture"),		uniGLBMat.vectorProperties._ShadingGradeTexture},
				{TEXT("_RimColor"),					uniGLBMat.vectorProperties._RimColor},
				{TEXT("_RimTexture"),				uniGLBMat.vectorProperties._RimTexture},
				{TEXT("_SphereAdd"),				uniGLBMat.vectorProperties._SphereAdd},
				{TEXT("_EmissionColor"),			uniGLBMat.vectorProperties._EmissionColor},
				{TEXT("_EmissionMap"),			uniGLBMat.vectorProperties._EmissionMap},
				{TEXT("_OutlineWidthTexture"),	uniGLBMat.vectorProperties._OutlineWidthTexture},
				{TEXT("_OutlineColor"),			uniGLBMat.vectorProperties._OutlineColor},
				{TEXT("_UvAnimMaskTexture"),	uniGLBMat.vectorProperties._UvAnimMaskTexture},
			};
			for (auto &t : tableParam) {
				LocalVectorParameterSet(dm, *(TEXT("mtoon") + t.key), FLinearColor(t.value[0], t.value[1], t.value[2], t.value[3]));
			}

			// default for not vrm material
			if (LocalIsOriginalUniGLBMaterial() == false) {
				SetLocalParamsForVector(dm);
			}
		}
		{
			struct TT {
				FString key;
				float& value;
			};
			TT tableParam[] = {
				{TEXT("_Cutoff"),		uniGLBMat.floatProperties._Cutoff},
				{TEXT("_BumpScale"),	uniGLBMat.floatProperties._BumpScale},
				{TEXT("_NormalScale"),	uniGLBMat.floatProperties._BumpScale},	// UniGLB Custom
				{TEXT("_ReceiveShadowRate"),	uniGLBMat.floatProperties._ReceiveShadowRate},
				{TEXT("_ShadeShift"),			uniGLBMat.floatProperties._ShadeShift},
				{TEXT("_ShadeToony"),			uniGLBMat.floatProperties._ShadeToony},
				{TEXT("_LightColorAttenuation"),	uniGLBMat.floatProperties._LightColorAttenuation},
				{TEXT("_IndirectLightIntensity"),	uniGLBMat.floatProperties._IndirectLightIntensity},
				{TEXT("_RimLightingMix"),			uniGLBMat.floatProperties._RimLightingMix},
				{TEXT("_RimFresnelPower"),			uniGLBMat.floatProperties._RimFresnelPower},
				{TEXT("_RimLift"),					uniGLBMat.floatProperties._RimLift},
				{TEXT("_OutlineWidth"),			uniGLBMat.floatProperties._OutlineWidth},
				{TEXT("_OutlineScaledMaxDistance"),	uniGLBMat.floatProperties._OutlineScaledMaxDistance},
				{TEXT("_OutlineLightingMix"),			uniGLBMat.floatProperties._OutlineLightingMix},
				{TEXT("_UvAnimScrollX"),			uniGLBMat.floatProperties._UvAnimScrollX},
				{TEXT("_UvAnimScrollY"),			uniGLBMat.floatProperties._UvAnimScrollY},
				{TEXT("_UvAnimRotation"),			uniGLBMat.floatProperties._UvAnimRotation},
				{TEXT("_MToonVersion"),				uniGLBMat.floatProperties._MToonVersion},
				{TEXT("_DebugMode"),				uniGLBMat.floatProperties._DebugMode},
				{TEXT("_BlendMode"),				uniGLBMat.floatProperties._BlendMode},
				{TEXT("_OutlineWidthMode"),		uniGLBMat.floatProperties._OutlineWidthMode},
				{TEXT("_OutlineColorMode"),	uniGLBMat.floatProperties._OutlineColorMode},
				{TEXT("_CullMode"),			uniGLBMat.floatProperties._CullMode},
				{TEXT("_OutlineCullMode"),		uniGLBMat.floatProperties._OutlineCullMode},
				{TEXT("_SrcBlend"),			uniGLBMat.floatProperties._SrcBlend},
				{TEXT("_DstBlend"),			uniGLBMat.floatProperties._DstBlend},
				{TEXT("_ZWrite"),			uniGLBMat.floatProperties._ZWrite},
			};

			for (auto &t : tableParam) {
				LocalScalarParameterSet(dm, *(TEXT("mtoon") + t.key), t.value);
			}

			// default for not vrm material
			if (LocalIsOriginalUniGLBMaterial() == false) {
				SetLocalParamsForScaler(dm);
			}

			//if (uniGLBMat.floatProperties._CullMode == 0.f) {
			//	dm->BasePropertyOverrides.bOverride_TwoSided = true;
			//	dm->BasePropertyOverrides.TwoSided = 1;
			//}
			if (uniGLBMat.floatProperties._Cutoff != 0.f) {
				dm->BasePropertyOverrides.bOverride_OpacityMaskClipValue = true;
				dm->BasePropertyOverrides.OpacityMaskClipValue = uniGLBMat.floatProperties._Cutoff;
			}

			{
				switch ((int)(uniGLBMat.floatProperties._BlendMode)) {
				case 0:
				case 1:
					break;
				case 2:
				case 3:
					//dm->BasePropertyOverrides.bOverride_BlendMode = true;
					//dm->BasePropertyOverrides.BlendMode = EBlendMode::BLEND_Translucent;
					break;
				}
			}
		}
		{
			struct TT {
				FString key;
				int value;
			};
			TT tableParam[] = {
				{TEXT("mtoon_tex_MainTex"),		uniGLBMat.textureProperties._MainTex},
				{TEXT("mtoon_tex_ShadeTexture"),	uniGLBMat.textureProperties._ShadeTexture},
				{TEXT("mtoon_tex_Shade"),			uniGLBMat.textureProperties._ShadeTexture},	// vrm1
				{TEXT("mtoon_tex_BumpMap"),		uniGLBMat.textureProperties._BumpMap},
				{TEXT("mtoon_tex_ReceiveShadowTexture"),	uniGLBMat.textureProperties._ReceiveShadowTexture},
				{TEXT("mtoon_tex_ShadingGradeTexture"),	uniGLBMat.textureProperties._ShadingGradeTexture},
				{TEXT("mtoon_tex_RimTexture"),			uniGLBMat.textureProperties._RimTexture},
				{TEXT("mtoon_tex_RimMultiply"),					uniGLBMat.textureProperties._RimTexture},	// vrm1
				{TEXT("mtoon_tex_SphereAdd"),	uniGLBMat.textureProperties._SphereAdd},
				{TEXT("mtoon_tex_MatCap"),		uniGLBMat.textureProperties._SphereAdd},	// vrm1
				{TEXT("mtoon_tex_EmissionMap"),	uniGLBMat.textureProperties._EmissionMap},
				{TEXT("mtoon_tex_Emissive"),	uniGLBMat.textureProperties._EmissionMap},	// vrm1
				{TEXT("mtoon_tex_OutlineWidthTexture"),			uniGLBMat.textureProperties._OutlineWidthTexture},
				{TEXT("mtoon_tex_OutlineWidthMultiply"),		uniGLBMat.textureProperties._OutlineWidthTexture},		// vrm1
				{TEXT("mtoon_tex_UvAnimMaskTexture")	,	uniGLBMat.textureProperties._UvAnimMaskTexture},
				{TEXT("mtoon_tex_UvAnimationMask"),			uniGLBMat.textureProperties._UvAnimMaskTexture},		// vrm1
			};

			if (UniGLBConverter::Options::Get().IsVRM10Model()) {
				FSoftObjectPath r(TEXT("/UniGLB/MaterialUtil/T_DummyBlack.T_DummyBlack"));
				UObject* u = r.TryLoad();
				if (u) {
					auto r2 = Cast<UTexture2D>(u);
					if (r2) {
						LocalTextureSet(dm, "mtoon_tex_EmissionMap", r2);
					}
				}
			}

			// default texture
			{
				auto n = TextureTypeToIndex[aiTextureType_DIFFUSE];
				if (n >= 0) {
					LocalTextureSet(dm, TEXT("mtoon_tex_MainTex"), uniGLBAssetList->Textures[n]);
					LocalTextureSet(dm, TEXT("gltf_tex_diffuse"), uniGLBAssetList->Textures[n]);
					LocalTextureSet(dm, TEXT("mtoon_tex_Shade"), uniGLBAssetList->Textures[n]);
				}
			}

			// mtoon texture
			int count = 0;
			for (auto &t : tableParam) {
				++count;
				if (t.value < 0 || t.value >= uniGLBAssetList->Textures.Num()) {
					continue;
				}
				LocalTextureSet(dm, *t.key, uniGLBAssetList->Textures[t.value]);
				if (count == 1) {
					// main => shade tex
					LocalTextureSet(dm, *tableParam[1].key, uniGLBAssetList->Textures[t.value]);
					LocalTextureSet(dm, *tableParam[2].key, uniGLBAssetList->Textures[t.value]);
				}

				//FTextureParameterValue *v = new (dm->TextureParameterValues) FTextureParameterValue();
				//v->ParameterInfo.Index = INDEX_NONE;
				//v->ParameterInfo.Name = *t.key;
				//v->ParameterInfo.Association = EMaterialParameterAssociation::GlobalParameter;
				//v->ParameterValue = uniGLBAssetList->Textures[t.value];
			}

			// gltf default texture
			{
				auto n = TextureTypeToIndex[aiTextureType_NORMALS];
				if (0 <= n && n < uniGLBAssetList->Textures.Num()) {
					uniGLBAssetList->Textures[n]->SRGB = false;
					uniGLBAssetList->Textures[n]->CompressionSettings = TC_Normalmap;
					uniGLBAssetList->Textures[n]->UpdateResource();
					LocalTextureSet(dm, TEXT("mtoon_tex_Normal"), uniGLBAssetList->Textures[n]);
				}
			}
			{
				auto n = TextureTypeToIndex[aiTextureType_EMISSIVE];
				if (0 <= n && n < uniGLBAssetList->Textures.Num()) {
					LocalTextureSet(dm, TEXT("mtoon_tex_Emissive"), uniGLBAssetList->Textures[n]);
				}
			}


		}

		return true;
	}

	UMaterial* CreateDefaultMaterial(UUniGLBAssetListObject *uniGLBAssetList) {

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 20, 0)] (target floor (5, 7, 0)); kept #else branch only.
		UMaterial* UnrealMaterial = nullptr;
		if (uniGLBAssetList->Package == GetTransientPackage()) {
			UnrealMaterial = UniGLB_NewObject<UMaterial>(GetTransientPackage(), NAME_None, EObjectFlags::RF_Public | RF_Transient, nullptr);
		}
		else {
			UnrealMaterial = UniGLB_NewObject<UMaterial>(uniGLBAssetList->Package, TEXT("M_BaseMaterial"), RF_Standalone | RF_Public, nullptr);
		}

		if (UnrealMaterial != NULL)
		{
			//UnrealMaterialFinal = UnrealMaterial;
			// Notify the asset registry
			//FAssetRegistryModule::AssetCreated(UnrealMaterial);

			if(true)
			{
				bool bNeedsRecompile = true;
				UnrealMaterial->GetMaterial()->SetMaterialUsage(bNeedsRecompile, MATUSAGE_SkeletalMesh);
				UnrealMaterial->GetMaterial()->SetMaterialUsage(bNeedsRecompile, MATUSAGE_MorphTargets);
			}

			// Set the dirty flag so this package will get saved later
			//Package->SetDirtyFlag(true);

			// textures and properties

			{
#if WITH_EDITORONLY_DATA
				UMaterialExpressionTextureSampleParameter2D* UnrealTextureExpression = NewObject<UMaterialExpressionTextureSampleParameter2D>(UnrealMaterial);

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
				UnrealMaterial->GetEditorOnlyData()->ExpressionCollection.Expressions.Add(UnrealTextureExpression);
				
				UnrealTextureExpression->SamplerType = SAMPLERTYPE_Color;
				UnrealTextureExpression->ParameterName = TEXT("gltf_tex_diffuse");

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 1, 0)] (target floor (5, 7, 0)); kept #else branch only.
				UnrealMaterial->GetEditorOnlyData()->BaseColor.Expression = UnrealTextureExpression;

#endif
			}

			UnrealMaterial->BlendMode = BLEND_Masked;
			UnrealMaterial->SetShadingModel(MSM_DefaultLit);
		}
		return UnrealMaterial;
	}


	bool isSameMaterial(const UMaterialInterface *mi1, const UMaterialInterface *mi2) {
		const UMaterialInstanceConstant *m1 = Cast<UMaterialInstanceConstant>(mi1);
		const UMaterialInstanceConstant *m2 = Cast<UMaterialInstanceConstant>(mi2);

		if (m1 == nullptr || m2 == nullptr) {
			return false;
		}
		// tex
		{
			if (m1->TextureParameterValues.Num() != m2->TextureParameterValues.Num()) {
				return false;
			}
			for (int i = 0; i < m1->TextureParameterValues.Num(); ++i) {
				if (m1->TextureParameterValues[i].ParameterValue != m2->TextureParameterValues[i].ParameterValue) {
					return false;
				}
				if (m1->TextureParameterValues[i].ParameterInfo.Name != m2->TextureParameterValues[i].ParameterInfo.Name) {
					return false;
				}
			}
		}

		// scalar
		{
			if (m1->ScalarParameterValues.Num() != m2->ScalarParameterValues.Num()) {
				return false;
			}
			for (int i = 0; i < m1->ScalarParameterValues.Num(); ++i) {
				if (m1->ScalarParameterValues[i].ParameterValue != m2->ScalarParameterValues[i].ParameterValue) {
					return false;
				}
				if (m1->ScalarParameterValues[i].ParameterInfo.Name != m2->ScalarParameterValues[i].ParameterInfo.Name) {
					return false;
				}
			}
		}

		// vector
		{
			if (m1->VectorParameterValues.Num() != m2->VectorParameterValues.Num()) {
				return false;
			}
			for (int i = 0; i < m1->VectorParameterValues.Num(); ++i) {
				if (m1->VectorParameterValues[i].ParameterValue != m2->VectorParameterValues[i].ParameterValue) {
					return false;
				}
				if (m1->VectorParameterValues[i].ParameterInfo.Name != m2->VectorParameterValues[i].ParameterInfo.Name) {
					return false;
				}
			}
		}

		if (m1->BasePropertyOverrides != m2->BasePropertyOverrides) {
			return false;
		}

#define UniGLB_TMP_COMPARE(a) if (m1->a != m2->a) return false;
		UniGLB_TMP_COMPARE(OpacityMaskClipValue);
		UniGLB_TMP_COMPARE(BlendMode);
		UniGLB_TMP_COMPARE(TwoSided);
		UniGLB_TMP_COMPARE(DitheredLODTransition);
		UniGLB_TMP_COMPARE(bCastDynamicShadowAsMasked);
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 23, 0)] (target floor (5, 7, 0)); kept #else branch only.
		UniGLB_TMP_COMPARE(GetShadingModels());
#undef UniGLB_TMP_COMPARE

		return true;
	}
}// namespace



bool UniGLBConverter::ConvertTextureAndMaterial(UUniGLBAssetListObject *uniGLBAssetList) {
	if (uniGLBAssetList == nullptr || aiData == nullptr) {
		return false;
	}
	if (UniGLBConverter::Options::Get().IsNoMesh()) {
		return true;
	}


	const bool bGenerateMips = UniGLBConverter::Options::Get().IsMipmapGenerateMode();

	// skip for preload
	// skip uniGLBAssetList->Textures.Reset(0);
	uniGLBAssetList->Materials.Reset(0);
	uniGLBAssetList->OutlineMaterials.Reset(0);

	TArray<bool> NormalBoolTable;
	NormalBoolTable.SetNum(aiData->mNumTextures);

	TArray<bool> MaskBoolTable;
	MaskBoolTable.SetNum(aiData->mNumTextures);

	TArray<UMaterialInterface*> matArray;
	TArray<bool> matFlagTranslucentArray;
	TArray<bool> matFlagTwoSidedArray;
	TArray<bool> matFlagOpaqueArray;
	TArray<EUniGLBImportTextureCompressType> textureCompressTypeArray;

	{
		const VRM::VRMMetadata *meta = static_cast<const VRM::VRMMetadata*>(aiData->mVRMMeta);
		if (meta) {
			for (int i = 0; i < meta->materialNum; ++i) {
				int t = 0;
				
				t = meta->material[i].textureProperties._BumpMap;
				if (NormalBoolTable.IsValidIndex(t)){
					NormalBoolTable[t] = true;
				}

				t = meta->material[i].textureProperties._OutlineWidthTexture;
				if (MaskBoolTable.IsValidIndex(t)){
					MaskBoolTable[t] = true;
				}
			}
		}
	}


	{
		if (aiData->HasTextures() && uniGLBAssetList->Textures.Num() != aiData->mNumTextures) {
			TArray<UTexture2D*> texArray;
			texArray.Reserve(aiData->mNumTextures);
			// Note: PNG format.  Other formats are supported

			for (uint32_t i = 0; i < aiData->mNumTextures; ++i) {
				auto& t = *aiData->mTextures[i];
				int Width = t.mWidth;
				int Height = t.mHeight;

				FString baseName = UniGLBConverter::NormalizeFileName(t.mFilename.C_Str());
				if (baseName.Len() == 0) {
					baseName = TEXT("texture") + FString::FromInt(i);
				}
				bool bNormalGreenFlip = NormalBoolTable[i];
				if (bNormalGreenFlip) {
					baseName += TEXT("_N");
				}

				FString name = FString(TEXT("T_")) + baseName;
				UPackage* pkg = uniGLBAssetList->Package;
				if (UniGLBConverter::Options::Get().IsSingleUAssetFile() == false) {
					pkg = UniGLB_CreatePackage(uniGLBAssetList->Package, *name);
				}
				UTexture2D* NewTexture2D = UniGLBLoaderUtil::CreateTextureFromImage(name, pkg, t.pcData, t.mWidth, bGenerateMips, NormalBoolTable[i], bNormalGreenFlip&&(UniGLBConverter::IsImportMode()==false));
#if WITH_EDITOR
				NewTexture2D->DeferCompression = false;
#endif

				bool bIsBC7 = false;
				// Set options
				if (NormalBoolTable[i]) {
					NewTexture2D->SRGB = 0;
#if WITH_EDITOR
					NewTexture2D->CompressionNoAlpha = true;
					if (UniGLBConverter::IsImportMode()) {
						NewTexture2D->bFlipGreenChannel = true;
					}
#endif
				} else {
					if (UniGLBConverter::Options::Get().IsBC7Mode()) {
						NewTexture2D->CompressionSettings = TC_BC7;
						bIsBC7 = true;
					}
				}
				if (MaskBoolTable[i]) {
					// comment for material warning...
					//NewTexture2D->SRGB = 0;
				}

				if (bIsBC7) {
					textureCompressTypeArray.Add(EUniGLBImportTextureCompressType::UniGLBITC_BC7);
				} else {
					textureCompressTypeArray.Add(EUniGLBImportTextureCompressType::UniGLBITC_DXT1);
				}


				NewTexture2D->UpdateResource();
#if WITH_EDITOR
				NewTexture2D->PostEditChange();
#endif

				if (NormalBoolTable[i]) {
					// UE5.5�ŃN���b�V������̂� update��ɍēx�X�V
					NewTexture2D->CompressionSettings = TC_Normalmap;
					NewTexture2D->UpdateResource();
#if WITH_EDITOR
					NewTexture2D->PostEditChange();
#endif
				}

				texArray.Push(NewTexture2D);
			}
			uniGLBAssetList->Textures = texArray;

			// small thumbnail
			{
				createSmallThumbnail(uniGLBAssetList, aiData);
			}
		}
	} // texture

	TArray<FString> pmxTexNameList;
	if (Options::Get().IsPMXModel()) {
		TArray<UTexture2D*> texArray;

		int MatNum = aiData->mNumMaterials;
		uniGLBAssetList->Materials.SetNum(MatNum);
		for (int32_t iMat = 0; iMat < MatNum; ++iMat) {
			auto& aiMat = *aiData->mMaterials[iMat];

			//
			aiString ais;
			if (aiMat.Get(AI_MATKEY_TEXTURE(aiTextureType_DIFFUSE, 0), ais) != AI_SUCCESS) {
				continue;
			}

			FString TextureFullPath = FPaths::GetPath(uniGLBAssetList->FileFullPathName) + TEXT("/") + UTF8_TO_TCHAR(ais.C_Str());
			
			FString baseName = FPaths::GetBaseFilename(UTF8_TO_TCHAR(ais.C_Str()));
			baseName = TEXT("T_") + FPaths::GetBaseFilename(baseName);
			baseName = NormalizeFileName(baseName);

			if (pmxTexNameList.Find(baseName) >= 0) {
				continue;
			}
			pmxTexNameList.Push(baseName);


			TArray<uint8> RawFileData;
			if (FFileHelper::LoadFileToArray(RawFileData, *TextureFullPath)){

				UPackage* pkg = uniGLBAssetList->Package;
				if (UniGLBConverter::Options::Get().IsSingleUAssetFile() == false) {
					pkg = UniGLB_CreatePackage(uniGLBAssetList->Package, *baseName);
				}
				UTexture2D* NewTexture2D = UniGLBLoaderUtil::CreateTextureFromImage(baseName, pkg, RawFileData.GetData(), RawFileData.Num(), bGenerateMips);

				texArray.Push(NewTexture2D);
			}
		}
		uniGLBAssetList->Textures = texArray;
	}

	if (aiData->HasMaterials()) {
		//TArray<FString> MatNameList;
		TMap<FString, int> MatNameList;

		int MatNum = FMath::Max(1, (int)aiData->mNumMaterials);

		// lastmaterial = gltf default material
		if (Options::Get().IsVRMModel()) {
			MatNum = FMath::Max(1, (int)aiData->mNumMaterials - 1);
		}

		uniGLBAssetList->Materials.SetNum(MatNum);
		for (int32_t iMat = 0; iMat < MatNum; ++iMat) {
			auto &aiMat = *aiData->mMaterials[iMat];

			UMaterialInterface *baseM = nullptr;
			UUniGLBImportMaterialSet *mset = nullptr;

			bool bMToon = false;
			{
				FString ShaderName = aiMat.mShaderName.C_Str();

				auto MaterialType = Options::Get().GetMaterialType();

				uniGLBAssetList->ImportMode = MaterialType;

				// native mtoon model ?
				LocalSetOriginalUniGLBMaterial(false);
				if (ShaderName.Find(TEXT("MToon")) >= 0) {
					// native
					LocalSetOriginalUniGLBMaterial(true);
				}
				if (UniGLBConverter::Options::Get().IsVRM10Model()) {
					// native
					LocalSetOriginalUniGLBMaterial(true);
				}

				if (Options::Get().GetMaterialType() == EUniGLBImportMaterialType::UniGLBIMT_Auto) {
					// default unlit
					MaterialType = EUniGLBImportMaterialType::UniGLBIMT_Unlit;

					if (ShaderName.Find(TEXT("MToon")) >= 0) {
						MaterialType = EUniGLBImportMaterialType::UniGLBIMT_MToonUnlit;
					}
					if (Options::Get().IsPMXModel()) {
						MaterialType = EUniGLBImportMaterialType::UniGLBIMT_MToonUnlit;
					}
					if (Options::Get().IsVRM10Model()) {
						MaterialType = EUniGLBImportMaterialType::UniGLBIMT_MToonUnlit;
					}
				}

				// select materialset
				switch (MaterialType) {
				case EUniGLBImportMaterialType::UniGLBIMT_MToon:
					mset = uniGLBAssetList->MtoonLitSet;
					bMToon = true;
					break;
				case EUniGLBImportMaterialType::UniGLBIMT_MToonUnlit:
					mset = uniGLBAssetList->MtoonUnlitSet;
					bMToon = true;
					break;
				case EUniGLBImportMaterialType::UniGLBIMT_SSS:
					mset = uniGLBAssetList->SSSSet;
					bMToon = true;	// MTOON TRUE!
					break;
				case EUniGLBImportMaterialType::UniGLBIMT_SSSProfile:
					mset = uniGLBAssetList->SSSProfileSet;
					bMToon = true;	// MTOON TRUE!
					break;
				case EUniGLBImportMaterialType::UniGLBIMT_Unlit:
					mset = uniGLBAssetList->UnlitSet;
					bMToon = false;
					break;
				case EUniGLBImportMaterialType::UniGLBIMT_glTF:
					mset = uniGLBAssetList->GLTFSet;
					bMToon = false;
					break;
				case EUniGLBImportMaterialType::UniGLBIMT_UEFNUnlit:
					mset = uniGLBAssetList->UEFNUnlitSet;
					bMToon = false;
					break;
				case EUniGLBImportMaterialType::UniGLBIMT_UEFNLit:
					mset = uniGLBAssetList->UEFNLitSet;
					bMToon = false;
					break;
				case EUniGLBImportMaterialType::UniGLBIMT_UEFNSSSProfile:
					mset = uniGLBAssetList->UEFNSSSProfileSet;
					bMToon = false;
					break;
				case EUniGLBImportMaterialType::UniGLBIMT_Custom:
					mset = uniGLBAssetList->CustomSet;
					bMToon = false;
					break;
				case EUniGLBImportMaterialType::UniGLBIMT_Auto:
				default:
					break;
				}
				if (mset == nullptr) {
					continue;
				}


				bool bTwoSided = false;
				bool bTranslucent = false;
				bool bOpaque = false;

				{
					aiString alphaMode;
					aiReturn result = aiMat.Get(AI_MATKEY_GLTF_ALPHAMODE, alphaMode);
					FString alpha = alphaMode.C_Str();
					if (alpha == TEXT("BLEND")) {
						// check also _ZWrite
						bTranslucent = true;
					}
					if (alpha == TEXT("MASK")) {
					}
					if (alpha == TEXT("OPAQUE")) {
						bOpaque = true;
						if (uniGLBAssetList->MaterialHasAlphaCutoff.IsValidIndex(iMat)) {
							if (uniGLBAssetList->MaterialHasAlphaCutoff[iMat]) {
								// force mask mode
								bOpaque = false;
							}
						}
					}
					bool b = false;
					aiReturn ret = aiMat.Get(AI_MATKEY_TWOSIDED, b);
					if (ret == AI_SUCCESS) {
						if (b) bTwoSided = true;
					}
				}

				if (ShaderName.Find(TEXT("MToon")) >= 0) {
					const VRM::VRMMetadata *meta = static_cast<const VRM::VRMMetadata*>(aiData->mVRMMeta);
					if (meta) {
						if ((int)iMat < meta->materialNum) {
							auto &uniGLBMat = meta->material[iMat];
							if (uniGLBMat.floatProperties._CullMode == 0.f || uniGLBMat.floatProperties._CullMode== 1.f) {
								bTwoSided = true;
							}
							if (uniGLBMat.floatProperties._ZWrite == 1.f) {
								bTranslucent = false;
							}
						}
					}
				}else{
					if (ShaderName.Find(TEXT("UnlitTexture")) >= 0) {
					}
					if (ShaderName.Find(TEXT("UnlitTransparent")) >= 0) {
						bTranslucent = true;
					}
				}
				if (Options::Get().IsForceOpaque()) {
					bTranslucent = false;
				}
				if (Options::Get().IsForceTwoSided()) {
					bTwoSided = true;
				}


				// material set

				if (bMToon) {
					// opaque/translucent, twoside
					UMaterialInterface *table_param[2][2] = {
						{
							mset->Opaque,
							mset->OpaqueTwoSided,
						},
						{
							mset->Translucent,
							mset->TranslucentTwoSided,
						},
					};

					int c[2] = {
						bTranslucent ? 1 : 0,
						bTwoSided ? 1 : 0,
					};
					baseM = table_param[c[0]][c[1]];

					if (matArray.Num() == matFlagTranslucentArray.Num()) {
						matFlagTranslucentArray.Add(c[0] != 0);
						matFlagTwoSidedArray.Add(c[1] != 0);
						matFlagOpaqueArray.Add(bOpaque);
					}

				}else{
					// not mtoon
					baseM = mset->Opaque;
					if (bTranslucent){
						baseM = mset->Translucent;
					}
				}
			}

			if (baseM == nullptr) {
				continue;
			}

			TArray<int> TextureTypeToIndex;
			{
				TextureTypeToIndex.SetNum(AI_TEXTURE_TYPE_MAX);
				for (auto& a : TextureTypeToIndex) {
					a = -1;
				}

				TArray<aiString> texName;
				texName.SetNum(AI_TEXTURE_TYPE_MAX);

				for (uint32_t t = 0; t < AI_TEXTURE_TYPE_MAX; ++t) {
					uint32_t n = aiMat.GetTextureCount((aiTextureType)t);
					for (uint32_t y = 0; y < FMath::Min((uint32_t)1, n); ++y) {
						aiMat.GetTexture((aiTextureType)t, y, &texName[t]);
					}
				}

				for (uint32_t i = 0; i < aiData->mNumTextures; ++i) {
					for (int32_t t = 0; t < texName.Num(); ++t) {
						if (aiData->mTextures[i]->mFilename == texName[t]) {
							TextureTypeToIndex[t] = i;
							break;
						}
					}
				}
			}

			for (uint32_t t = 0; t < AI_TEXTURE_TYPE_MAX; ++t) {
				aiString path;
				aiReturn r = aiMat.GetTexture(aiTextureType(t), 0, &path);
				if (r == AI_SUCCESS) {
					std::string s = path.C_Str();
					s = s.substr(s.find_last_of('*') + 1);
					TextureTypeToIndex[t] = atoi(s.c_str());

					if (Options::Get().IsPMXModel()) {
						for (int i = 0; i < pmxTexNameList.Num(); ++i) {

							FString baseName = FPaths::GetBaseFilename(UTF8_TO_TCHAR(path.C_Str()));
							baseName = TEXT("T_") + FPaths::GetBaseFilename(baseName);
							baseName = NormalizeFileName(baseName);

							if (pmxTexNameList[i] == baseName) {
								TextureTypeToIndex[t] = i;
								break;
							}
						}
					}
				}
			}

			//UMaterialInstanceDynamic* dm = UMaterialInstanceDynamic::Create(baseM, uniGLBAssetList, m.GetName().C_Str());
			//UMaterialInstanceDynamic* dm = UMaterialInstance::Create(baseM, uniGLBAssetList, m.GetName().C_Str());
			//MaterialInstance->TextureParameterValues

			//set paramater with Set***ParamaterValue
			//DynMaterial->SetScalarParameterValue("MyParameter", myFloatValue);
			//MyComponent1->SetMaterial(0, DynMaterial);
			//MyComponent2->SetMaterial(0, DynMaterial);

			// ALL!! no texture material.
			//if (indexDiffuse >= 0 && indexDiffuse < uniGLBAssetList->Textures.Num()) {
			//if (indexDiffuse >= 0) {
			{
				UMaterialInstanceConstant* dm = nullptr;
				{
					const FString origname = (FString(TEXT("MI_")) + NormalizeFileName(aiMat.GetName().C_Str()));
					FString name = origname;

					if (MatNameList.Find(origname)) {
						name += FString::Printf(TEXT("_%03d"), MatNameList[name]);
					}
					MatNameList.FindOrAdd(origname)++;

					if (uniGLBAssetList->Package == GetTransientPackage()) {
						dm = UniGLB_NewObject<UMaterialInstanceConstant>(GetTransientPackage(), NAME_None, EObjectFlags::RF_Public | RF_Transient);
					} else {
						TArray<UObject*> ret;
						GetObjectsWithOuter(uniGLBAssetList->Package, ret);
						for (auto *a : ret) {
							auto s = a->GetName().ToLower();
							if(s.IsEmpty()) continue;

							if (s == name.ToLower()) {
								//a->ClearFlags(EObjectFlags::RF_Standalone);
								//a->SetFlags(EObjectFlags::RF_Public | RF_Transient);
								//a->ConditionalBeginDestroy();
								static int ccc = 0;
								++ccc;
								a->Rename(*(FString(TEXT("need_reload_tex_VRM"))+FString::FromInt(ccc)), GetTransientPackage(), REN_DontCreateRedirectors | REN_NonTransactional | REN_ForceNoResetLoaders);

								break;
							}
						}
						dm = UniGLB_NewObject<UMaterialInstanceConstant>(uniGLBAssetList->Package, *name, EObjectFlags::RF_Public | EObjectFlags::RF_Standalone);
						uniGLBAssetList->MaterialNameOrigToAsset.Add(NormalizeFileName(aiMat.GetName().C_Str()), name);
					}
				}
				LocalMaterialSetParent(dm, baseM);

				if (dm) {
					{
						FVectorParameterValue *v = new (dm->VectorParameterValues) FVectorParameterValue();
						v->ParameterInfo.Index = INDEX_NONE;
						v->ParameterInfo.Name = TEXT("gltf_basecolor");
						v->ParameterInfo.Association = EMaterialParameterAssociation::GlobalParameter;

						aiColor4D col(1.f, 1.f, 1.f, 1.f);
						aiReturn result = aiMat.Get(AI_MATKEY_BASE_COLOR, col);
						if (result == 0) {
						}
						v->ParameterValue = FLinearColor(col.r, col.g, col.b, col.a);
					}

					{
						float f[2] = { 1,1 };
						aiReturn result0 = aiMat.Get(AI_MATKEY_ROUGHNESS_FACTOR, f[0]);
						aiReturn result1 = aiMat.Get(AI_MATKEY_METALLIC_FACTOR, f[1]);
						if (result0 == AI_SUCCESS || result1 == AI_SUCCESS) {
							f[0] = (result0 == AI_SUCCESS) ? f[0] : 1;
							f[1] = (result1 == AI_SUCCESS) ? f[1] : 1;
							if (f[0] == 0 && f[1] == 0) {
								f[0] = f[1] = 1.f;
							}
							FVectorParameterValue *v = new (dm->VectorParameterValues) FVectorParameterValue();
							v->ParameterInfo.Index = INDEX_NONE;
							v->ParameterInfo.Name = TEXT("gltf_RM");
							v->ParameterInfo.Association = EMaterialParameterAssociation::GlobalParameter;;
							v->ParameterValue = FLinearColor(f[0], f[1], 0, 0);
						}
					}
					int indexDiffuse = TextureTypeToIndex[aiTextureType::aiTextureType_DIFFUSE];
					if (indexDiffuse >= 0 && indexDiffuse < uniGLBAssetList->Textures.Num()) {
						LocalTextureSet(dm, TEXT("gltf_tex_diffuse"), uniGLBAssetList->Textures[indexDiffuse]);
						{
							FString str = TEXT("mtoon_tex_ShadeTexture");
							bool bFindShadeTex = false;
							for (auto &t : dm->TextureParameterValues) {
								if (str.Compare(t.ParameterInfo.Name.ToString(), ESearchCase::IgnoreCase) == 0) {
									if (t.ParameterValue) {
										bFindShadeTex = true;

										if (IsValid(uniGLBAssetList->Textures[indexDiffuse]) == false) {
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
											UTexture2D* tmp = Cast<UTexture2D>(t.ParameterValue.Get());
											if (tmp) {
												LocalTextureSet(dm, TEXT("gltf_tex_diffuse"), tmp);
											}
										}
									}
								}
							}
							if (bFindShadeTex == false) {
								LocalTextureSet(dm, *str, uniGLBAssetList->Textures[indexDiffuse]);
							}
						}
					} else {
						if (Options::Get().IsDefaultGridTextureMode() == false) {
							// set white texture for default
							UTexture2D* tex = LoadObject<UTexture2D>(nullptr, TEXT("/UniGLB/MaterialUtil/T_DummyWhite.T_DummyWhite"));
							if (tex) {
								LocalTextureSet(dm, TEXT("gltf_tex_diffuse"), tex);
								LocalTextureSet(dm, TEXT("mtoon_tex_ShadeTexture"), tex);
								LocalTextureSet(dm, TEXT("mtoon_tex_Shade"), tex);
							}
						}
					}
					if (bMToon == false){
						{
							aiString alphaMode;
							aiReturn result = aiMat.Get(AI_MATKEY_GLTF_ALPHAMODE, alphaMode);
							FString alpha = alphaMode.C_Str();
							if (alpha == TEXT("BLEND")) {
								if (Options::Get().IsForceOpaque() == false) {
									dm->BasePropertyOverrides.bOverride_BlendMode = true;;
									dm->BasePropertyOverrides.BlendMode = EBlendMode::BLEND_Translucent;
								}
							}
						}
					}


					// mtoon
					if (bMToon || UniGLBConverter::Options::Get().IsVRM10Model()) {
						createAndAddMaterial(dm, iMat, uniGLBAssetList, this, TextureTypeToIndex);

						if (matFlagOpaqueArray.IsValidIndex(iMat)) {
							if (matFlagOpaqueArray[iMat]) {
								LocalScalarParameterSet(dm, TEXT("bOpaque"), 1.f);
							}
						}
						if (uniGLBAssetList->MaterialHasMToon.IsValidIndex(iMat)) {
							if (uniGLBAssetList->MaterialHasMToon[iMat] == false) {
								for (auto& a : dm->VectorParameterValues) {
									if (a.ParameterInfo.Name == TEXT("mtoon_Color")) {
										auto c = a.ParameterValue;
										LocalVectorParameterSet(dm, TEXT("mtoon_ShadeColor"), c);
										break;
									}
								}
							}
						}
					} else {
						// gltf texture
						TArray<FString> materialParamName;
						materialParamName.SetNum(AI_TEXTURE_TYPE_MAX);
						materialParamName[aiTextureType::aiTextureType_DIFFUSE] = TEXT("gltf_tex_diffuse");
						materialParamName[aiTextureType::aiTextureType_NORMALS] = TEXT("gltf_tex_normal");
						materialParamName[aiTextureType::aiTextureType_EMISSIVE] = TEXT("gltf_tex_Emission");

						materialParamName[aiTextureType::aiTextureType_BASE_COLOR] = TEXT("gltf_tex_diffuse");
						materialParamName[aiTextureType::aiTextureType_EMISSION_COLOR] = TEXT("gltf_tex_Emission");
						materialParamName[aiTextureType::aiTextureType_METALNESS] = TEXT("gltf_tex_metalness");
						materialParamName[aiTextureType::aiTextureType_DIFFUSE_ROUGHNESS] = TEXT("gltf_tex_roughness");

						for (uint32_t t = 0; t < AI_TEXTURE_TYPE_MAX; ++t) {
							if (materialParamName[t] == "") continue;

							int index = TextureTypeToIndex[t];
							if (index < 0) continue;
							if (uniGLBAssetList->Textures.IsValidIndex(index) == false) continue;
							if (IsValid(uniGLBAssetList->Textures[index]) == false) continue;

							LocalTextureSet(dm, *(materialParamName[t]), uniGLBAssetList->Textures[index]);
						}
					}

					LocalMaterialFinishParam(dm);

					//dm->InitStaticPermutation();
					matArray.Add(dm);

					if (matArray.Num() != matFlagTranslucentArray.Num()) {
						matFlagTranslucentArray.SetNumZeroed(matArray.Num());
						matFlagTwoSidedArray.SetNumZeroed(matArray.Num());
						matFlagOpaqueArray.SetNumZeroed(matArray.Num());
					}

					TArray<FString> t;
					if (uniGLBAssetList->MaterialNameOrigToAsset.Num()) {
						uniGLBAssetList->MaterialNameOrigToAsset.GenerateValueArray(t);
						uniGLBAssetList->MaterialNameAssetToMatNo.Add(t[t.Num() - 1], matArray.Num() - 1);
					}
				}
			}
		}


		if (UniGLBConverter::Options::Get().IsBC7Mode()) {
			uniGLBAssetList->Texture_CompressType = EUniGLBImportTextureCompressType::UniGLBITC_BC7;
		}
		uniGLBAssetList->Texture_CompressTypeList = textureCompressTypeArray;
		if (Options::Get().IsMergeMaterial() == false) {
			uniGLBAssetList->Materials = matArray;
			uniGLBAssetList->MaterialFlag_Translucent = matFlagTranslucentArray;
			uniGLBAssetList->MaterialFlag_TwoSided = matFlagTwoSidedArray;
			uniGLBAssetList->MaterialFlag_Opaque = matFlagOpaqueArray;
		} else {
			TArray<UMaterialInterface*> tmp;
			TArray<bool> tmpTranslucent;
			TArray<bool> tmpTwoSided;
			TArray<bool> tmpOpaque;

			uniGLBAssetList->MaterialMergeTable.Reset();

			for (int i = 0; i < matArray.Num(); ++i) {

				uniGLBAssetList->MaterialMergeTable.Add(i, 0);

				bool bFind = false;
				for (int j = 0; j < tmp.Num(); ++j) {
					if (isSameMaterial(matArray[i], tmp[j]) == false) {
						continue;
					}
					bFind = true;
					uniGLBAssetList->MaterialMergeTable[i] = j;

					matArray[i]->Rename(nullptr, GetTransientPackage(), REN_DontCreateRedirectors | REN_NonTransactional | REN_ForceNoResetLoaders);

					break;
				}
				if (bFind == false) {
					int t = tmp.Add(matArray[i]);
					uniGLBAssetList->MaterialMergeTable[i] = t;

					tmpTranslucent.Add(matFlagTranslucentArray[i]);
					tmpTwoSided.Add(matFlagTwoSidedArray[i]);
					tmpOpaque.Add(matFlagOpaqueArray[i]);
				}
			}
			uniGLBAssetList->Materials = tmp;
			uniGLBAssetList->MaterialFlag_Translucent = tmpTranslucent;
			uniGLBAssetList->MaterialFlag_TwoSided = tmpTwoSided;
			uniGLBAssetList->MaterialFlag_Opaque = tmpOpaque;

			for (auto& a : uniGLBAssetList->MaterialNameAssetToMatNo) {
				a.Value = uniGLBAssetList->MaterialMergeTable[a.Value];
			}
		}

		// ouline Material
		if (UniGLBConverter::Options::Get().IsGenerateOutlineMaterial()) {
			if (uniGLBAssetList->OptMToonOutlineMaterial){
				for (const auto aa : uniGLBAssetList->Materials) {
					const UMaterialInstanceConstant *a = Cast<UMaterialInstanceConstant>(aa);

					FString s = a->GetName() + TEXT("_outline");
					//UMaterialInstanceConstant *m = Cast<UMaterialInstanceConstant>(StaticDuplicateObject(a->GetOuter(), a, *s, EObjectFlags::RF_Public | EObjectFlags::RF_Standalone, UMaterialInstanceConstant::StaticClass()));
					UMaterialInstanceConstant *m = UniGLB_NewObject<UMaterialInstanceConstant>(uniGLBAssetList->Package, *s, EObjectFlags::RF_Public | EObjectFlags::RF_Standalone);

					if (m) {
						LocalMaterialSetParent(m, uniGLBAssetList->OptMToonOutlineMaterial);

						m->VectorParameterValues = a->VectorParameterValues;
						m->ScalarParameterValues = a->ScalarParameterValues;
						m->TextureParameterValues = a->TextureParameterValues;

						LocalMaterialFinishParam(m);
						//m->InitStaticPermutation();
						uniGLBAssetList->OutlineMaterials.Add(m);
					}
				}
			}
		}

		{
			UPackage* package = GetTransientPackage();
			if (uniGLBAssetList) {
				package = uniGLBAssetList->Package;
			}
			auto sp = UniGLB_NewObject<USubsurfaceProfile>(package, *(FString(TEXT("SP_")) + uniGLBAssetList->BaseFileName), EObjectFlags::RF_Public | EObjectFlags::RF_Standalone);
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(5, 0, 0)] (target floor (5, 7, 0)); kept #else branch only.
			// default

#if WITH_EDITORONLY_DATA
			uniGLBAssetList->SSSProfile = sp;
#endif

			for (auto& a : uniGLBAssetList->Materials) {
				a->SubsurfaceProfile = sp;
				auto* c = Cast<UMaterialInstance>(a);
				if (c) {
					c->bOverrideSubsurfaceProfile = true;
				}
			}
		}
	}

	return true;
}

UniGLBConvertTexture::UniGLBConvertTexture()
{
}

UniGLBConvertTexture::~UniGLBConvertTexture()
{
}
