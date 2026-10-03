
// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications (c) hanibes. See LICENSE.

using UnrealBuildTool;

public class UniGLBRender : ModuleRules
{
	public UniGLBRender(ReadOnlyTargetRules Target) : base(Target)
	{
        PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		// Only UniGLB_RenderSubsystem.cpp still needs this (FSceneTextures, declared in Renderer/Private,
		// used by OnResolvedSceneColor_RenderThread's signature). UniGLBRender.cpp and
		// VrmSceneViewExtension.cpp no longer include the private Renderer headers -- their only
		// private-type usages were already-dead/commented code; FPostProcessMaterialInputs itself has
		// been public since 5.3 via PostProcess/PostProcessMaterialInputs.h and no longer requires this.
		PrivateIncludePaths.AddRange(
			new string[] {
				System.IO.Path.Combine(GetModuleDirectory("Renderer"), "Private"), //required for FSceneTextures (UniGLB_RenderSubsystem.cpp)
				System.IO.Path.Combine(GetModuleDirectory("Renderer"), "Internal"),
			});



		PrivateDependencyModuleNames.AddRange(
			new string[] {
				"Core",
				"CoreUObject",
                "Engine",
				"Projects",
				"RenderCore",

                "RHI",
                //"ShaderCore",
                "Renderer",
				"UniGLB",
			});
		if (Target.bBuildEditor)
		{
			PrivateDependencyModuleNames.Add("UnrealEd");
		}
	}
}
