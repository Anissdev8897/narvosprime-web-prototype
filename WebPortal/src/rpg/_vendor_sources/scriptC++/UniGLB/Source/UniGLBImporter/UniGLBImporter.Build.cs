
// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications (c) hanibes. See LICENSE.

using System;
using UnrealBuildTool;

public class UniGLBImporter : ModuleRules
{
	public UniGLBImporter(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		PrivateDependencyModuleNames.AddRange(
			new string[] {
				"Core",
				"CoreUObject",
				"InputCore",
				"EditorStyle",
				"ApplicationCore",
				"Engine",
				"UnrealEd",
				"Slate",
				"SlateCore",
				"UniGLB",
				"UniGLBLoader",

				"AnimGraphRuntime",
				"AnimGraph",
				"BlueprintGraph",

				"PropertyEditor",
				"Persona",
				"MainFrame",
				"DesktopPlatform",


				//"ToolMenus",
			});

		BuildVersion Version;
		if (BuildVersion.TryRead(BuildVersion.GetDefaultFileName(), out Version)) {
			//if (Version.MajorVersion == X && Version.MinorVersion == Y)
			if (Version.MajorVersion == 4 && Version.MinorVersion <= 23)
			{
			}
			else {
				PrivateDependencyModuleNames.Add("ToolMenus");
			}

			if (Version.MajorVersion == 4 || (Version.MajorVersion == 5 && Version.MinorVersion <= 1))
			{
			}
			else
			{
				PrivateDependencyModuleNames.Add("AssetDefinition");
			}
		}

		PrivateIncludePathModuleNames.AddRange(
		new string[] {
			"AssetTools",
			"AssetRegistry"
		});

		DynamicallyLoadedModuleNames.AddRange(
			new string[] {
				"AssetTools",
				"AssetRegistry"
			});
	}
}
