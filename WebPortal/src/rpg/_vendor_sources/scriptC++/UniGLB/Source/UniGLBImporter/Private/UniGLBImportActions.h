// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.
// UniGLB dedicated import menu actions (sous-projet A).
#pragma once

#include "CoreMinimal.h"

enum class EUniGLBImportMode : uint8
{
	Universal,    // forces bUniversalMannyGASP; accepts FBX/GLB/GLTF
	RetargetAnim, // forces bRetargetAnimToManny; imports an anim and bakes it onto Manny
	AdaptToManny, // forces bUniversalMannyGASP + bAutoSkinToManny; converts + re-skins a mesh onto Manny
};

namespace UniGLBImportActions
{
	// Open a file dialog and import the chosen file(s) through the UniGLB factory with the Manny/GASP
	// path pre-selected. bRecommended=true suppresses the options dialog (one-click). DestinationPath
	// is a content path like "/Game/Foo"; falls back to "/Game" when empty.
	void ExecuteImport(EUniGLBImportMode Mode, bool bRecommended, const FString& DestinationPath);

	// Register / unregister the Content Browser toolbar + folder context-menu entries.
	void RegisterImportMenus();
	void UnregisterImportMenus();
}
