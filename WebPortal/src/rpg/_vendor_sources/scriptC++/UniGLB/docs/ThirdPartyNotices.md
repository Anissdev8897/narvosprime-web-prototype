<!-- Docs: [README](../README.md) · [Changelog](../CHANGELOG.md) -->

# Third-Party Notices

UniGLB bundles the following third-party components. Each is licensed under its own terms.

## Open Asset Import Library (assimp)

- **License:** BSD-3-Clause. See [`ThirdParty/assimp/LICENSE`](../ThirdParty/assimp/LICENSE).
- **Usage:** static import (`ThirdParty/assimp/lib/x64/Release/assimp-vc141-mt.lib`) + runtime DLL
  (`assimp-vc141-mt.dll`). Used to parse GLB/glTF/FBX/OBJ/DAE/PMX files.
- **Provenance:** this is a *fork* of assimp with a custom `assimp/vrm/vrmmeta.h` extension, inherited
  from VRM4U. See [`ThirdParty/assimp/README_ORIGIN.md`](../ThirdParty/assimp/README_ORIGIN.md).
- **Note:** the shipped binary is built with the VS2017 toolset (vc141) and predates recent assimp
  security fixes. Files are parsed both at editor import time and at runtime (`LoadVRMFile`). Treat
  untrusted input with caution until assimp is rebuilt from a current release.

## RapidJSON

- **License:** MIT (with a BSD-licensed `msinttypes` component). See
  [`ThirdParty/rapidjson/license.txt`](../ThirdParty/rapidjson/license.txt).
- **Usage:** header-only JSON parsing.

## VRM specification (schemas)

- **License:** MIT — vrm-c / vrm-specification (https://github.com/vrm-c/vrm-specification).
  See [`ThirdParty/vrm_specification/LICENSE.md`](../ThirdParty/vrm_specification/LICENSE.md).
- **Usage:** JSON schemas staged as runtime dependencies (`vrm0/`, `vrm1/`).

## Derived engine code

- `Source/UniGLB/Private/VrmDropFiles.cpp` derives from Epic's `ApplicationLifecycleComponent`
  (Copyright Epic Games, Inc.). The Epic attribution line is retained in that file.
