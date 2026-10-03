// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

using UnrealBuildTool;

public class UniGLBCaptureEditor : ModuleRules
{
	public UniGLBCaptureEditor(ReadOnlyTargetRules Target) : base(Target)
	{
        PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

        PrivateDependencyModuleNames.AddRange(
			new string[] {
				"Core",
				"CoreUObject",
                "Engine",

				"AnimGraphRuntime",
				"AnimGraph",
				"BlueprintGraph",

				"UnrealEd",
				"AnimationEditMode",
				"Persona",

				"UniGLB",
				"UniGLBCapture",
			});

		PrivateIncludePathModuleNames.AddRange(
			new string[] {
            });

		DynamicallyLoadedModuleNames.AddRange(
			new string[] {
			});

        PrivateIncludePaths.AddRange(
        new string[] {
			//"../Runtime/Renderer/Private",
        });
    }
}
