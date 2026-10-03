// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

using UnrealBuildTool;
using System.IO;

public class UniGLB : ModuleRules
{
    private string ModulePath
    {
        get { return ModuleDirectory; }
    }

    private string ThirdPartyPath
    {
        get { return Path.GetFullPath(Path.Combine(ModulePath, "../../ThirdParty/")); }
    }

    // GetModuleDirectory() throws a BuildException when the named module cannot be resolved
    // (module missing / owning plugin disabled). Used to make optional-plugin dependencies
    // (LevelSequence*, MovieRenderPipeline*) genuinely conditional instead of hardcoded.
    private bool IsModuleAvailable(string ModuleName)
    {
        try
        {
            GetModuleDirectory(ModuleName);
            return true;
        }
        catch (System.Exception)
        {
            return false;
        }
    }

    public UniGLB(ReadOnlyTargetRules Target) : base(Target)
	{
	    PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicIncludePaths.AddRange(
			new string[] {
                //"UniGLB/Public",
				// ... add public include paths required here ...
			}
		);
				
		
		PrivateIncludePaths.AddRange(
			new string[] {
                //"UniGLB/Private",
                // ... add other private include paths required here ...
			}
			);
			
		
		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
                "CoreUObject",
                "Engine",
                "RHI",
                "RenderCore",
                "AnimGraphRuntime",
				"LiveLinkInterface",
				"CinematicCamera",

                // ... add other public dependencies that you statically link with here ...
			}
			);


        PrivateDependencyModuleNames.AddRange(
			new string[]
			{
				"Slate",
				"SlateCore",
                "Engine",
				"AssetRegistry",
				"InputCore",
				"ControlRig",
				"AnimationCore",
				// ... add private dependencies that you statically link with here ...	
			}
			);

		if (Target.bBuildEditor)
		{
			PrivateDependencyModuleNames.Add("UnrealEd");
			PrivateDependencyModuleNames.Add("LevelEditor");

			PrivateDependencyModuleNames.Add("ControlRigDeveloper");

			// LevelSequence / LevelSequenceEditor / Sequencer are declared "Optional" in UniGLB.uplugin,
			// meaning a client project may legitimately disable them. Detect real module presence via
			// GetModuleDirectory (throws BuildException when the module does not exist) instead of
			// linking unconditionally, so the dependency and the .uplugin flag tell the same story.
			bool bHasSequencerModules = IsModuleAvailable("LevelSequence") && IsModuleAvailable("LevelSequenceEditor") && IsModuleAvailable("Sequencer");
			if (bHasSequencerModules)
			{
				PrivateDependencyModuleNames.Add("LevelSequence");
				PrivateDependencyModuleNames.Add("LevelSequenceEditor");
				PrivateDependencyModuleNames.Add("Sequencer");

				PublicDefinitions.Add("WITH_UNIGLB_SEQUENCER=1");
			}
			else
			{
				PublicDefinitions.Add("WITH_UNIGLB_SEQUENCER=0");
			}
		}
		else
		{
			PublicDefinitions.Add("WITH_UNIGLB_SEQUENCER=0");
		}

		// MovieRenderPipeline is declared "Optional" in UniGLB.uplugin. MovieRenderPipelineCore is
		// used even outside the editor (VRMIsMovieRendering), so gate both editor and runtime paths
		// on real module presence rather than assuming UE5 == present.
		{
			bool bHasMRQCore = IsModuleAvailable("MovieRenderPipelineCore");
			if (bHasMRQCore)
			{
				PrivateDependencyModuleNames.Add("MovieRenderPipelineCore");
				PublicDefinitions.Add("WITH_UNIGLB_MRQ_CORE=1");
			}
			else
			{
				PublicDefinitions.Add("WITH_UNIGLB_MRQ_CORE=0");
			}

			if (Target.bBuildEditor && bHasMRQCore && IsModuleAvailable("MovieRenderPipelineEditor"))
			{
				PrivateDependencyModuleNames.Add("MovieRenderPipelineEditor");
				PublicDefinitions.Add("WITH_UNIGLB_MRQ_EDITOR=1");
			}
			else
			{
				PublicDefinitions.Add("WITH_UNIGLB_MRQ_EDITOR=0");
			}
		}

		DynamicallyLoadedModuleNames.AddRange(
			new string[]
			{
            }
            );

		BuildVersion Version;
		if (BuildVersion.TryRead(BuildVersion.GetDefaultFileName(), out Version))
		{
			//if (Version.MajorVersion == X && Version.MinorVersion == Y)
			if (Version.MajorVersion == 5)
			{
				PrivateDependencyModuleNames.Add("RigVM");
				PrivateDependencyModuleNames.Add("IKRig");
				if (Target.bBuildEditor)
				{
					PrivateDependencyModuleNames.Add("IKRigEditor");
				}

				PrivateDependencyModuleNames.Add("InterchangeCore");
			}
		}

	}
}
