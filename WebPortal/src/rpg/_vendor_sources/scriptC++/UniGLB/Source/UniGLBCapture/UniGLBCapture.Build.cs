// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

using UnrealBuildTool;

public class UniGLBCapture : ModuleRules
{
	public UniGLBCapture(ReadOnlyTargetRules Target) : base(Target)
	{
        PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

        PrivateDependencyModuleNames.AddRange(
			new string[] {
				"Core",
				"CoreUObject",
                "Engine",
                "Networking",
                "Sockets",
				"OSC",
				"AnimGraphRuntime",

				"UniGLB",
            });

		if (Target.bBuildEditor)
		{
			PrivateDependencyModuleNames.Add("UnrealEd");
		}


		PrivateIncludePathModuleNames.AddRange(
			new string[] {
            });

		DynamicallyLoadedModuleNames.AddRange(
			new string[] {
			});

        PrivateIncludePaths.AddRange(
        new string[] {
			// Relative to Engine\Plugins\Runtime\Oculus\OculusVR\Source
			//"../Runtime/Renderer/Private",
        });
    }
}
