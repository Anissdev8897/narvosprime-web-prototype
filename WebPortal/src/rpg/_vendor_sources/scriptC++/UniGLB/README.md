# UniGLB — Universal GLB/FBX Character Importer

Universal **GLB / FBX / OBJ character importer onto the Unreal Engine 5 Manny skeleton.**

Every imported humanoid character is automatically normalized onto the **standard UE5 Manny skeleton**
(`SKM_Manny_Simple`, 89 bones, A-pose). One skeleton for all characters → **one universal animation
library** plays on every model. Zero-config.

- **Engine:** Unreal Engine 5.7.x
- **Author:** hanibes — derived from the VRM4U plugin by ruyo (Haruyoshi Yamamoto). MIT License.
- **Plugin id / content mount:** `UniGLB` (`/UniGLB/...`). Display name: *UniGLB - Universal GLB/FBX Character Importer*.

### Documentation

| Doc | Purpose |
|---|---|
| [`README.md`](README.md) | This file — user guide (install, usage, troubleshooting) + developer architecture (§8). |
| [`CHANGELOG.md`](CHANGELOG.md) | Applied fixes per revision. |

Internal audit/remediation-plan documents are kept outside the shipped plugin (with the project's
`PluginAudits/` working files), not inside `Plugins/UniGLB/`.

---

## 1. What it does

Imported character → clean Manny in 4 stages, all automatic:

1. **Detect convention** — recognizes the source skeleton's bone-naming scheme.
2. **Rename + map** — renames the source bones to Manny names; the **source skin weights are preserved**
   (they ride along on the renamed bones).
3. **Inject + prune** — adds every Manny bone the source lacks (twist, IK, `spine_04/05`, `neck_02`,
   fingers) and **deletes every non-Manny source bone** (belt, accessory, extra spine…), collapsing its
   weights onto the nearest Manny parent → a **clean 89-bone Manny**.
4. **Compatible skeleton** — marks Manny compatible so Manny / GASP animations play with no retarget.

The source **bind pose and skin are kept as-is** (no T→A re-posing — that deformed already-A-pose
sources). The result looks like the original model, on the canonical Manny rig.

---

## 2. Requirements

- **A Manny mesh must exist in the project**, anywhere under `/Game`, with `Manny`/`Mannequin` in its
  name. The importer resolves it automatically (fast path: the stock UE5 Third Person template at
  `/Game/ThirdPerson/Characters/Mannequins/Meshes/SKM_Manny_Simple`; otherwise an AssetRegistry
  name+signature search). **Without a Manny, the GASP conversion aborts** and the mesh is left as
  imported (renamed only). To add one: enable the **Third Person** feature/template, or import a Manny
  FBX (e.g. `SK_Mannequin_MANNY_APOSE.fbx`) into `/Game`.
- The `GeometryScripting` engine plugin (auto-enabled — listed as a dependency).

---

## 3. Install

1. Copy the `UniGLB` folder into your project's `Plugins/` directory.
2. Because the plugin was renamed from **VRM4U**, it ships **CoreRedirects** in
   `Plugins/UniGLB/Config/DefaultEngine.ini` (`/Script/VRM4U`→`/Script/UniGLB`, `/VRM4U/`→`/UniGLB/`).
   These travel with the plugin so assets authored against the old names — including the plugin's own
   bundled blueprints — load in any project. **Keep that `Config/` folder when copying the plugin.**
3. Launch the project; let it compile the `UniGLB*` modules. The plugin appears in the Plugins browser
   as **UniGLB - Universal GLB/FBX Character Importer**.

---

## 4. Usage

Two entry points, both lead to the same two actions:

- **Top menu bar → `UniGLB`**, or
- **Content Browser → `+ Add` → `UniGLB Import`**, or right-click a folder → `UniGLB Import`.

Two actions:

| Action | What it does |
|---|---|
| **Import Universal Character (recommended)** | One-click. Convert any character → clean 89-bone Manny, **retarget any animation in the same file**, no dialog. |
| **Import Universal Character (options…)** | Same, but opens the options dialog so you can toggle the individual passes. |

- A destination folder is **created automatically**: `/Game/ModelPort001`, `002`, … (first free index).
- Accepted files: `*.fbx; *.glb; *.gltf; *.obj; *.dae; *.pmx`.
- The "recommended" path forces `bUniversalMannyGASP` + `bRetargetAnimToManny` (the anim retarget is a
  no-op when the file carries no animation, so it is safe to leave on for plain character imports).

### What gets created (per import, in `ModelPortNNN/`)

`SK_*` SkeletalMesh, `SKEL_*` Skeleton, `IK_*` / `IK_UEFN_*` IK Rigs, `RTG_*` IK Retargeters, `A_*`
AnimSequence (if the file has animation), `ABP_Post_*` post-process AnimBP, `MI_*` materials, `T_*`
textures, `VA_*` asset list, `VM_*` meta, `SP_*` subsurface profile, `POSE_*` retarget pose.

---

## 5. Supported skeleton conventions

The importer tries these in order; the first whose **20 required humanoid bones** all resolve wins
(matching is case-insensitive and strips a leading namespace / `mixamorig`):

| Convention | Notes |
|---|---|
| **Mixamo / Ready Player Me** | `mixamorig:*` and prefix-less; `Spine/Spine1/Spine2`. |
| **Meshy AI biped** | Mixamo-style names, no prefix, `Spine/Spine01/Spine02`, lowercase `neck`, no fingers. |
| **Character Creator 4 / iClone** | `CC_Base_*` (Hip / Waist / Spine01 / Spine02 …). |
| **DAZ Genesis 8 / 8.1** | camelCase (`hip`, `abdomenLower`, `lShldr`, `lForearm` …). |
| **DAZ Genesis 9** | snake_case `l_/r_` (`spine1/2/3`, `l_upperarm` …). |
| **Blender Rigify** | deform bones `DEF-*` with `.L/.R`. |
| **Already UE / Manny / MetaHuman** | already on the Manny naming; injection just fills the gaps. |
| **Unity Humanoid / VRChat** | Unity's Humanoid avatar bone names (as used by VRChat-authored humanoid rigs). |
| **Auto-Rig Pro (Universal)** | Blender Auto-Rig Pro's universal/humanoid bone naming scheme. |
| **MMD / PMX** | MikuMikuDance / PMX Japanese-convention bone naming. |

If **no** convention matches, the import currently **aborts** (mesh left as imported) and logs which
schemes were tried. Extending coverage (AccuRig, 3ds Max Biped, Maya HumanIK, Synty, Makehuman) and a
geometry-based **auto-rig fallback** for unknown skeletons are on the roadmap (see §8).

### Non-humanoid models

Animals, vehicles, props, drones, etc. are **not** mapped to Manny (a Manny is a humanoid biped) — they
import with their own rig. This is intended: only humanoid characters become Manny.

---

## 6. Animations

- An animation packaged **inside the character file** (e.g. a Meshy `*_Animation_Walking_withSkin.glb`)
  is retargeted onto Manny automatically by the recommended import.
- Standalone **Mixamo** animation clips retarget onto Manny via the same compatible-skeleton path.
- Because every imported character shares the Manny skeleton, a single animation library is reusable
  across all of them.

---

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Log: `NativeMannyGASP: no Manny SkeletalMesh found … Aborting` | No Manny in the project. Import one under `/Game` with `Manny`/`Mannequin` in the name (see §2). |
| Skeleton shows source-named bones, no twist/IK/fingers, `head_end` etc. kept | GASP aborted (usually: Manny missing). Fix the Manny, re-import. |
| `Unable to identify a valid mount point … /VRM4U/…` warnings | Old assets imported before the VRM4U→UniGLB rename. Fixed by the bundled CoreRedirects (§3); or delete the old `/Game/00/IMPORT`, `/Game/ModelPort*` folders. |
| `NewObject … must be a child of VrmAssetListObject` crash | The plugin's bundled blueprints reference the old module; ensure `Plugins/UniGLB/Config/DefaultEngine.ini` (CoreRedirects) is present, then restart. |
| `Water Body Collision profile … Add entry to DefaultEngine.ini?` | Generic UE **Water** plugin default — unrelated to UniGLB. Answer *Yes* or ignore. |
| `…/BP_GameMode`, `Lvl_ThirdPerson`, `__ExternalActors__` not available | The **host project's own** missing level/gamemode assets — unrelated to UniGLB. |
| Imported mesh looks deformed / hunched | Make sure you are on a build where the T→A repose bake is disabled (source pose preserved). Re-import. |

> Build note (for developers): the editor must be **closed** before recompiling the C++ modules (the
> DLLs are locked while it runs). Reimport the source file rather than reopening an already-imported asset.

---

## 8. Architecture (for developers)

- **Modules (8):** `UniGLB` (runtime core), `UniGLBLoader` (the import funnel + conversion), `UniGLBImporter`
  (editor factory + menus), `UniGLBEditor`, `UniGLBRender`, `UniGLBCapture`, `UniGLBCaptureEditor`,
  `UniGLBMisc`. Asset/data classes keep the `Vrm`/`VRM` prefix (e.g. `UVrmAssetListObject`, `VRMConverter`).
- **Import funnel:** `UUniGLBImporterFactory::FactoryCreateBinary` → `ULoaderBPFunctionLibrary::LoadVRMFileLocal`
  → convert chain → `ProcessNativeMannyGASP`.
- **Key functions** (`UniGLBLoader/Private/LoaderBPFunctionLibrary.cpp`):
  - `UniGLB_BuildHumanoidTableFromConvention()` — convention detection (the tables in §5).
  - `renameToUE4Bone()` — source bones → Manny names (remaps skin weights too).
  - `RebuildSkeletonOrdered()` — strict parent-before-child rebuild with bone **injection** and
    **pruning** (collapses pruned-bone weights onto the surviving Manny ancestor).
  - `ProcessNativeMannyGASP()` — orchestrates: resolve Manny → inject + prune → (repose disabled) →
    `AddCompatibleSkeleton`.
  - `VRM4U_ResolveMannySkeletalMesh()` (`VrmConvertIKRig.cpp`) — stock paths + AssetRegistry Manny search.

### Roadmap (universal coverage)

ROI-ordered:
1. ✅ More convention tables (CharacterCreator, DAZ G8/G9, Rigify) — *done*.
2. Name normalization (strip `CC_Base_` / `Character1_` / `Bip01` prefixes; space≡underscore; Bend/Twist
   fallback) → AccuRig, 3ds Max Biped, Maya HumanIK.
3. Post-prune per-vertex weight fix-up (merge duplicate collapsed influences + renormalize).
4. Magnitude-based influence reduction + NaN/Inf hardening at ingestion.
5. Funnel gate → explicit *map vs auto-rig* branch.
6. **Auto-rig fallback** for unknown / skeleton-less meshes: geometry landmark detection → fit a copy of
   the clean Manny → geodesic-voxel re-skin (never the hybrid).

---

## 9. Credits & license

MIT License. Derived from **VRM4U** © ruyo (Haruyoshi Yamamoto). UniGLB modifications © hanibes.
