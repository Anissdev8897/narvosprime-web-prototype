# assimp — origin & rebuild notes

This is a **fork** of the Open Asset Import Library (assimp), inherited from the VRM4U plugin.

- **Upstream:** https://github.com/assimp/assimp (BSD-3-Clause, see `LICENSE`).
- **Fork basis:** the VRM4U fork of assimp, which adds VRM support and a custom header
  `include/assimp/vrm/vrmmeta.h` (`VRM::VRMMetadata`, material/texture properties) consumed by
  `Source/UniGLBLoader/Private/*`.
- **Shipped binary:** `lib/x64/Release/assimp-vc141-mt.lib` + `bin/x64/assimp-vc141-mt.dll`,
  built with the Visual Studio 2017 toolset (vc141). Win64 only — the `Mac/`, `IOS/`,
  `armeabi-v7a/`, `arm64-v8a/` folders contain placeholder `dummy.txt` files, not real libraries.

## Known risk

The binary predates recent assimp releases and may carry known parser CVEs (FBX/OBJ/DAE). UniGLB
parses user-supplied files at both import time and runtime. Rebuilding assimp is recommended.

## To rebuild (Win64)

1. Clone assimp (target a current release, e.g. 5.4+).
2. Re-apply the `assimp/vrm/vrmmeta.*` extension from the VRM4U fork on top.
3. Configure with CMake for the UE-compatible toolset and build the Release static lib + DLL:
   - `assimp-vc141-mt.lib` -> `ThirdParty/assimp/lib/x64/Release/`
   - `assimp-vc141-mt.dll` -> `ThirdParty/assimp/bin/x64/`
4. Keep the include tree in sync under `ThirdParty/assimp/include/`.
