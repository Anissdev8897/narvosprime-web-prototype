// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

using UnrealBuildTool;

public class UniGLBEditor : ModuleRules
{
	public UniGLBEditor(ReadOnlyTargetRules Target) : base(Target)
	{
        PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

        PrivateDependencyModuleNames.AddRange(
			new string[] {
				"Core",
				"CoreUObject",
                "InputCore",
                "EditorStyle",
                "Engine",
				"UnrealEd",
                "Slate",
                "SlateCore",

                "MovieSceneCapture",

				"MovieScene",
				"MovieSceneTracks",

				//"ControlRigEditor",

				"UniGLB",
			});

		PrivateIncludePathModuleNames.AddRange(
			new string[] {
				"AssetTools",
				"AssetRegistry",
            });

		DynamicallyLoadedModuleNames.AddRange(
			new string[] {
				"AssetTools",
				"AssetRegistry"
			});

        PrivateIncludePaths.AddRange(
        new string[] {
			//"../Runtime/Renderer/Private",
        });
    }
}
