# Nanimation — Quick Start Guide

## Installation

1. Copy the `Nanimation` folder into your project's `Plugins/` directory.
2. Regenerate project files (right-click `.uproject` → Generate Visual Studio project files).
3. Build your project (Development Editor, Win64).
4. Open the editor. The plugin is active by default.

## Naming Convention

The scanner classifies animation assets by parsing their short name into tokens separated by underscores (`_`):

```
M_[Stance]_[Action]_[Direction]_[Variant...]
MF_[Weapon]_[Action]_[Direction]_[Variant...]
```

**Examples:**

| Asset Name | Category | Stance | Direction |
|---|---|---|---|
| `M_Neutral_Slide_FootOut_Loop` | Slide | Neutral | None |
| `MF_Pistol_Walk_Fwd_Left` | Walk | None | Fwd |
| `M_Crouch_Idle` | Idle | Crouch | None |
| `M_Crouch_Entry` | Crouch | — | None |
| `M_Land_Fwd` | Land | None | Fwd |

**Token reference** (case insensitive):

- **Categories**: idle, walk/walking, jog, run/running, sprint, crouch, jump, fall/falling, land/landing, slide/sliding, roll/dodge, turn/turning, pivot, start, stop, mantle, vault, climb/climbing, aim/ao, fire/shoot, reload, attack/melee, hit/hitreact, death/die/dead, emote/dance
- **Directions**: fwd/forward/f, bwd/backward/back/b, left/l, right/r
- **Stances**: neutral, crouch/crouching, ads/aiming

## Generating a Set

### Via Tools Menu
**Tools → Nanimation → Generate Nanimation Set…**

Configure the default scan path in **Project Settings → Plugins → Nanimation**. The first run creates a new `UNanimationSet`; subsequent runs merge (preserve manual edits) unless you choose Overwrite.

### Via Commandlet
```
UnrealEditor-Cmd.exe MyProject.uproject -run=NanimGenerateSet -Source=/Game/MyAnims -Out=/Game/Nanimation -Name=DA_MySet
```
Add `-Overwrite` to replace an existing set instead of merging.

### Via Blueprint / Python
```python
import unreal
unreal.NanimEditorLibrary.generate_set_from_folder("/Game/MyAnims", "/Game/Nanimation", "DA_MySet", True, False)
```

## Using the Component

1. Add a **Nanimation Component** to your Character Blueprint.
2. Set **Active Set** to your `DA_Nanim_*` asset (same on server + clients).
3. On gameplay events, call **Request Action** (route is automatic: Replicated vs LocalCosmetic).
4. Bind **On Variant Chosen** → play the resolved animation (montage / AnimBP variable).

### Directional Picks (Locomotion)
Use **Request Action With Context** to pass a Direction/Stance filter. The context travels inside the replicated pulse, so all machines filter identically.

## Using the AnimGraph Node

1. In your Animation Blueprint, add a **Nanim Select** node (category: *Nanimation*).
2. Set **Action** to the variant group for the current state.
3. Enable **bLoop** and **bRepickOnCycle** for locomotion cycling.
4. Set **Sync Group Name** (same across states) to prevent phase pop.
5. Optional: set **Direction** and **Stance** pins to filter the pool.

The node is for LOCAL cosmetic cycling (each machine picks independently). For synchronised one-shots (Fire/Reload), use the Component.

## Network Model

- **Replicated**: The server advances a `FNanimActionPulse` (seed + draw count + category + context). Each machine re-derives the pick as a PURE function → identical result everywhere. ~20 bytes per event. Multi-category safe (TArray, one entry per category). Seed rebase keeps replay cost bounded, and the rebased seed is what actually gets used for subsequent draws (the sequence genuinely changes, it does not loop).
- **LocalCosmetic**: Each client picks locally using its own stateful bag. No replication.
- **Late-joiners**: A client's FIRST-EVER pulse batch after replication starts is recorded but not broadcast, so a client joining mid-session doesn't replay old one-shots. Nuance: if the server fires an action before a given client has received its initial replication of `ActionPulses`, that specific client will not see that one action (by design — this is the late-join safety trade-off). The authority itself is never subject to this suppression, and set changes (`SetActiveSet`) do not re-trigger it either — only a client's very first pulse reception in its lifetime is suppressed.

## Asset Manager (Primary Asset)

`UNanimationSet` exposes a `PrimaryAssetType = "NanimationSet"`. To enable async streaming by `FPrimaryAssetId`:
1. **Project Settings → Asset Manager → Primary Asset Types to Scan**.
2. Add an entry: `Primary Asset Type = NanimationSet`, `Asset Base Class = UNanimationSet`, `Has Blueprint Classes = false`, `Directories = /Game/Nanimation`.
3. The Component async-loads picked variants only (soft refs → on-demand).

## Limitations (v1.0)

- Dir/Stance filter degrades gracefully: if filtering eliminates all variants, the full set is used as fallback.
- Token vocabulary is defined in code (`FNanimScanner`). Extra synonyms can be added via `NanimationEditorSettings`.
- The AnimNode resolves sequences synchronously on the anim worker (works if the Component warmed the assets; otherwise falls back to ref pose). Use the Component for heavy volumes.
- `ActiveSet` is now replicated as a standard UObject reference. Assign it once on the server; clients receive it automatically.
