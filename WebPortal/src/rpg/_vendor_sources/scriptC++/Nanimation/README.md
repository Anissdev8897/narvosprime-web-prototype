# Nanimation

**Deterministic Animation Variant System for Unreal Engine 5.8**

Skeleton-agnostic, data-driven animation variant selection: scan your Content folder, classify animations by naming convention, and pick the right variant at runtime via a seed-replicated ShuffleBag. Multiplayer-safe with a ~20-byte network pulse.

- **Runtime**: `UNanimationSet` (DataAsset), `UNanimationLibrary` (pure deterministic picks), `UNanimationComponent` (hybrid network), `FAnimNode_NanimSelect` (AnimGraph node with Dir/Stance filtering)
- **Editor**: `FNanimScanner` (AssetRegistry scan + token parser), `UNanimationEditorSettings` (configurable paths/synonyms), Tools-menu integration, CSV export
- **Network**: Seed-replicated pulses (one per category, rebase-bounded replay), per-category async loading, late-joiners don't replay stale one-shots (see [Network Model](Docs/QuickStart.md#network-model) for the exact guarantee)

📖 **[Quick Start Guide](Docs/QuickStart.md)**

## Quick Setup
1. Drop `Nanimation/` in your project's `Plugins/`
2. **Tools → Nanimation → Generate Nanimation Set…**
3. Add a **Nanimation Component** to your Character, assign the Set, call `Request Action`

## License
Proprietary. See individual source files for copyright.
