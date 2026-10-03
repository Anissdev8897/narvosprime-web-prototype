// Copyright (c) 2026 hanibes. All Rights Reserved.

using UnrealBuildTool;

public class Nanimation : ModuleRules
{
	public Nanimation(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		// Public: anything exposed via our public headers (types, DataAsset, AnimNode).
		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			});

		// Private: implementation-only deps.
		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"NetCore", // required for DOREPLIFETIME_WITH_PARAMS / FDoRepLifetimeParams
		});
	}
}
