// Copyright (c) 2026 hanibes. All Rights Reserved.

using UnrealBuildTool;

public class NanimationEditor : ModuleRules
{
	public NanimationEditor(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"UnrealEd",
			"Slate",
			"SlateCore",

			"Nanimation",     // runtime module: shared types, UNanimationSet, FAnimNode_NanimSelect

			"AnimGraph",      // UAnimGraphNode_Base (editor wrapper for the AnimNode)
			"AnimGraphRuntime",
			"BlueprintGraph",
			"ToolMenus",      // Tools-menu button to run the scanner
			"AssetRegistry",  // IAssetRegistry / FARFilter / AssetCreated (scanner)
			"DeveloperSettings", // UDeveloperSettings base class (NanimationEditorSettings)
		});

		// AssetRegistry is a hard dependency above (scanner links IAssetRegistry).
		// AssetTools stays dynamically loaded (not needed at link time).
		PrivateIncludePathModuleNames.AddRange(new string[]
		{
			"AssetTools",
		});

		DynamicallyLoadedModuleNames.AddRange(new string[]
		{
			"AssetTools",
		});
	}
}
