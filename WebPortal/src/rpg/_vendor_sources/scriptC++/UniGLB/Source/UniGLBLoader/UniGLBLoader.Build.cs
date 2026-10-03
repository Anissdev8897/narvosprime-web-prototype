// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

using UnrealBuildTool;
using System.IO;


public class UniGLBLoader : ModuleRules
{
    private string ModulePath
    {
        get { return ModuleDirectory; }
    }

    private string ThirdPartyPath
    {
        get { return Path.GetFullPath(Path.Combine(ModulePath, "../../ThirdParty/")); }
    }

	public UniGLBLoader(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		// for thirdparty header
		//bUseUnityBuild = false;

		PublicIncludePaths.AddRange(
			new string[] {
				Path.Combine(ThirdPartyPath, "assimp/include"),
				Path.Combine(ThirdPartyPath, "rapidjson/include")
                // ... add public include paths required here ...
            }
		);

		PrivateDependencyModuleNames.AddRange(
			new string[] {
				"Slate",
				"SlateCore",
				"Core",
				"CoreUObject",
				"Engine",
				"RHI",
				"RenderCore",
				"CinematicCamera",
				"AnimGraphRuntime",
				"Projects",
				"AssetRegistry",
				"UniGLB",
			});
		PrivateDependencyModuleNames.Add("TimeManagement");

		if (Target.bBuildEditor) {
			PrivateDependencyModuleNames.Add("Persona");
		}

		BuildVersion Version;
		if (BuildVersion.TryRead(BuildVersion.GetDefaultFileName(), out Version))
		{
			//if (Version.MajorVersion == X && Version.MinorVersion == Y)
			if (Version.MajorVersion == 5)
			{
				PrivateDependencyModuleNames.Add("IKRig");
				PrivateDependencyModuleNames.Add("GeometryScriptingCore");
				PrivateDependencyModuleNames.Add("GeometryFramework");
				PrivateDependencyModuleNames.Add("SkeletalMeshDescription");
				if (Target.bBuildEditor)
				{
					PrivateDependencyModuleNames.Add("IKRigEditor");
					// Sub-project B2 (auto-rig): FSkinBindingOp + CreateSkeletalMeshAsset.
					PrivateDependencyModuleNames.Add("ModelingOperators");
					PrivateDependencyModuleNames.Add("ModelingComponentsEditorOnly");
					PrivateDependencyModuleNames.Add("DynamicMesh");
					PrivateDependencyModuleNames.Add("GeometryCore");
					PrivateDependencyModuleNames.Add("MeshConversion");
				}
			}
		}
		
		DynamicallyLoadedModuleNames.AddRange(
			new string[]
			{
			}
			);

		RuntimeDependencies.Add(Path.Combine(ThirdPartyPath, "vrm_specification", "vrm0", "schema", "*"));
		RuntimeDependencies.Add(Path.Combine(ThirdPartyPath, "vrm_specification", "vrm1", "*", "schema", "*"));

		if (Target.bBuildEditor == true)
		{
			PrivateDependencyModuleNames.Add("UnrealEd");
			//PrivateDependencyModuleNames.Add("UniGLBImporter");
			//PrivateIncludePaths.Add("UniGLBImporter/Private");

			//CircularlyReferencedDependentModules.Add("UniGLBImporter");
		}

		if (Target.Platform == UnrealTargetPlatform.Win64)
		{
			// Only prebuilt Win64 Release assimp libs are shipped, so link Release unconditionally.
			// (The former bDebug switch was dead code: both ternary branches resolved to the same path.)
			const string PlatformString = "x64";

			PublicDefinitions.Add("WITH_UniGLB_ASSIMP_DEBUG=0");
			PublicAdditionalLibraries.Add(Path.Combine(ThirdPartyPath, "assimp", "lib", PlatformString, "Release", "assimp-vc141-mt.lib"));

			PublicDelayLoadDLLs.Add("assimp-vc141-mt.dll");
			RuntimeDependencies.Add(Path.Combine(ThirdPartyPath, "assimp", "bin", PlatformString, "assimp-vc141-mt.dll"));
		}
		// Android / iOS / Mac branches removed: ThirdParty/assimp/lib/{Mac,IOS,armeabi-v7a,arm64-v8a}
		// contain only placeholder dummy.txt files, so those links would fail. Only real Win64 Release
		// assimp libs are shipped. Re-add a platform here only once genuine libraries exist for it.
	}
}
