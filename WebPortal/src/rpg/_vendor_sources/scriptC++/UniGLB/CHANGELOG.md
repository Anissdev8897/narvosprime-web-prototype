<!-- Docs: [README](README.md) · [Changelog](CHANGELOG.md) -->

# Changelog

## Unreleased — bug fixes

Concrete code/config defects fixed. Internal audit/remediation-plan documents are kept outside the
shipped plugin. Behavioural functionality (the Manny/GASP pipeline) is unchanged.

### Fixed

- **GC-safety: dangling static UObject pointer (audit #37).**
  `UVrmDropFilesComponent::s_LatestActiveComponent` was a raw `UVrmDropFilesComponent*` — invisible to the
  GC, so it dangled once the component was destroyed outside `OnUnregister` (level GC / actor kill),
  crashing `getLatestActiveComponent()`. Now a `TWeakObjectPtr`; the getter returns null when stale.
  Files: `Source/UniGLB/Public/VrmDropFiles.h`, `Source/UniGLB/Private/VrmDropFiles.cpp`.

- **Async import race + manual memory (audit #37, #41).**
  `VrmAsyncLoadAction.cpp` used a file-scope global `localAsset` (holding a raw `Assimp::Importer*`) plus
  `static` locals (`TexCount/SubCount/FrameCount/StartTime`). Two concurrent `LoadVRMFileAsync` calls
  trampled the same assimp scene and counters → corruption / leak / crash, and the importer was leaked on
  any early return. Moved to per-action members; importer is a `TUniquePtr` (RAII). No global state left on
  the async path. Files: `Source/UniGLBLoader/Private/VrmAsyncLoadAction.{h,cpp}`.

- **Threading: `GetWindParameters_GameThread` off the game thread (audit #39).**
  Spring-bone anim evaluation can run on a worker thread (`bAllowMultiThreadedAnimationUpdate`), where the
  `_GameThread` wind call asserts. Guarded with `IsInGameThread()` (wind is skipped that frame off-thread
  rather than crashing). File: `Source/UniGLB/Private/VrmSpringBone.cpp`.

- **Silent hijack of standard FBX/glTF import (audit #16, B4).**
  `UVrmRuntimeSettings::bAllowAllAssimpFormat` now defaults to `false` instead of `true`. A freshly enabled
  plugin no longer takes over drag-and-drop import of `.fbx/.glb/.gltf/.obj/.dae/.pmx`. The explicit
  "UniGLB Import" menu still enables it temporarily via `FScopedAllowAssimp`, so that flow is unchanged.
  File: `Source/UniGLB/Public/VrmRuntimeSettings.h`.

- **Crash guard: `PostEditChangeProperty` null property.**
  `PropertyChangedEvent.Property` can be null (some change types); it was dereferenced unconditionally.
  Added a null check. File: `Source/UniGLB/Private/VrmRuntimeSettings.cpp`.

- **Dead build switch (audit #12).**
  `UniGLBLoader.Build.cs` had `bool bDebug = false;` with degenerate ternaries
  (`(Config != Debug) ? "Release" : "Release"`). Removed; the Win64 Release path is linked directly.
  File: `Source/UniGLBLoader/UniGLBLoader.Build.cs`.

- **Engine version reconciliation (audit #6).**
  The README claimed UE 5.7.x but the host project (`RMHLipSync.uproject`, `EngineAssociation "5.8"`) and
  the only installed engine are **UE 5.8**. The `.uplugin` `EngineVersion` is `5.8.0` (correct for this
  machine); the README was the stale side and is now updated to 5.8.x. File: `UniGLB.uplugin`.

- **Dead platform link branches (audit #36, B2).**
  `UniGLBLoader.Build.cs` linked `libassimp.a` for Android/iOS/Mac, but those `ThirdParty/assimp/lib/*`
  folders hold only `dummy.txt` placeholders — a guaranteed link failure on any of those platforms.
  Removed the branches; only the real Win64 Release lib is linked.

- **Dead Quest/Oculus build block (audit #10).**
  `UniGLB.Build.cs` had a `bUseQuestTracking = false` block that could never run; collapsed to the single
  `WITH_UniGLB_HMD_TRACKER=0` define it always produced.

### Round 3 — mechanical + UX (user compiles)

- **Silent Manny/GASP failures now surfaced (audit #17).** Added an editor toast helper
  (`UniGLB_NotifyImport`, `FSlateNotificationManager`, `#if WITH_EDITOR`) fired on every abort of the
  pipeline: no Manny found, convention unrecognized, skeleton rebuild failed. The import no longer looks
  like a success when the Manny conversion silently bailed. File: `LoaderBPFunctionLibrary.cpp`.
- **Inverted log verbosity fixed (audit #18).** Success/progress lines (`Mannequin = %s`, `pruning %d`,
  `after rebuild %d`) moved from `Warning` to `Log`; failures stay `Error`. File: same.
- **UI typos (audit #8).** `VrmImportUI.h`: "Eable"→"Enable", "Validataion"→"Validation",
  "insted"→"instead", "Materal"→"Material".
- **VRM4U naming residues (audit #5).** rapidjson namespace `vrm4u::local::rapid_json`→`uniglb::...`
  (`VrmJson.h`, macro-internal — all uses go through `RAPIDJSON_NAMESPACE`), generated bone suffixes
  `_renamed_vrm4u`→`_renamed_uniglb` (`VrmConvertHumanoid.cpp`), `%s_vrm4u%02d`→`%s_uniglb%02d`
  (`VrmSkeleton.cpp`), `_vrm4u_dummy_tail`→`_uniglb_dummy_tail` (`LoaderBPFunctionLibrary.cpp`; write-only
  / inert `.Contains` for new imports).
- **Dead shader removed (audit #11).** Deleted `Shaders/Private/TestShader.usf` (only `BaseColorCS.usf`
  is referenced).
- **Engine version reconciliation (audit #6, corrected).** Host is **UE 5.8** (`.uproject`
  `EngineAssociation "5.8"`, only `UE_5.8` installed). Reverted an earlier wrong `5.7.0` edit: `.uplugin`
  `EngineVersion` = `5.8.0`; README updated 5.7→5.8.

### Legal / packaging (audit #7, B5, B6; plan phases 0/2/9)

- Added `LICENSE` (MIT, dual copyright: VRM4U © Haruyoshi Yamamoto + UniGLB modifications © hanibes).
- Added `docs/ThirdPartyNotices.md` (assimp BSD-3, RapidJSON MIT, VRM spec MIT, derived Epic code).
- Added `ThirdParty/assimp/README_ORIGIN.md` (fork provenance + rebuild steps + CVE risk note).
- Added `ThirdParty/vrm_specification/LICENSE.md` (MIT, vrm-c) — was shipped with no license.
- Added `Config/FilterPlugin.ini` for clean `RunUAT BuildPlugin` packaging.
- Added copyright headers to the 13 header-less source files and replaced the template placeholder in
  `UniGLB_AnimSubsystem.h`. (`grep -rLi copyright Source --include=*.h --include=*.cpp` is now empty.)

### Docs

- Cross-linked `README.md` and `CHANGELOG.md`.
- Removed the dead roadmap link (`docs/superpowers/specs/2026-06-21-universal-rig-roadmap.md`) from README §8.
- Moved internal audit/remediation-plan/features-plan documents out of the shipped plugin folder.

### Not addressed here (need an engine build / editor / product decisions)

- `.uplugin` identity fields beyond `EngineVersion` (FriendlyName/Category/URLs/Version/
  SupportedTargetPlatforms/Mac allowlist, audit #6/#30): the descriptor file was being renamed on/off
  rapidly (build toggling) during this session, so editing it raced. Apply from the plan Phase 1 when the
  file is stable.
- CoreRedirects `MatchSubstring` on `/Script/VRM4U` (audit #23): removing safely requires resaving the
  bundled `Content/` assets in-editor first. Left in place.
- `Binaries/`+`Intermediate/` shipped (audit #27), ~150 MB legacy `Content/` (audit #14): purge needs the
  editor + reference checks (FilterPlugin.ini now scopes the packaged set).
- Forked/dated assimp rebuild (audit #40): documented in `README_ORIGIN.md`, binary not rebuilt.
- Mass removal of `UE_VERSION_OLDER_THAN(4,x)/(5,0)/(5,1)` guards (audit #9), module consolidation 8→4
  (audit #1/#4), god-file split (audit #2), `#if WITH_EDITOR` in the Runtime loader, Renderer private
  includes (audit #31), `FScopedAllowAssimp`→factory-flag (audit #19), assimp in public headers
  (audit #34): structural refactors that must be done with a compiler in the loop — not safe blind.
