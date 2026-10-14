# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current State — recovery in progress (read first)

The E: drive was formatted on 2026-09-26. The project was reassembled here (the only copy, a git repo since 2026-10-03) from disk recovery, the nanos client cache and agent histories.

- **Resume point**: `.hermes/RAPPORT_RECUPERATION_2026-10-03.md` §0 quater — what is done, what is next, the exact commands.
- **Recovery tools and their rules**: `scripts/recuperation/README.md`.

Where the three blockers between the code and a game that can be seen running stand (`.hermes/AUDIT_REFONTE_2026-10-03.md` §0, state of 2026-10-04):

1. **The cooked asset pack is staged, not promoted.** The ADK sources (`WebPortal/Server/adk/Content/Narvos`) were rebuilt folder by folder from `WebPortal/public` and from off-disk copies — measure with `python scripts/recuperation/etat-adk.py` (what is deliberately left is listed in the resume point). The latest cook is staged under `WebPortal/Server/AssetBuilds/chaine-*/narvos/`; `WebPortal/Server/Assets/narvos` still holds only a reconstructed `Assets.toml`. Promoting the staging is the user's call — check it first with `python scripts/recuperation/pack-contre-lua.py <staging>/narvos/Assets.toml`. Do NOT run the catalog generators (`scripts/narvos-*-to-lua.mjs`) before that decision: they rewrite the Lua catalogs from the active pack.
2. **`Map_Narvos` and `Map_Alien` are rebuilt** (full-editor sessions under `scripts/recuperation/`: `adk-session-monde.py`, `adk-session-capitale.py`, `adk-session-alien.sh`), and the ground sits where `Shared/Catalogs/Mondes.lua` puts the player (`adk-sonder-monde.py`). Nothing has run in game yet.
3. **Only the NAMES of the `UnrealMCPServer` plugin are left** (`mes_projet/Nouveau dossier/$F10497/Plugins/UnrealMCPServer`: content overwritten, the DLL is not an executable; disabled in the `.uproject`). Scripted editor sessions (`scripts/recuperation/adk-session.sh`) replace it for levels, materials, blend spaces and the Python part of `PontMetaHuman` (21 of 27 packages rebuilt, not cooked yet). Blueprint GRAPH surgery still waits: the 6 remaining `PontMetaHuman` packages (`BP_NarvosMH_M/F`, face without LiveLink, sculpt adapters) and NavMesh. The older `UnrealMCP` plugin survives, built for this engine, under `C:\Users\aniss\Documents\Plugins57\` — a different API. Only one UnrealEditor process at a time, commandlets included.

Before calling anything lost, search for its NAME across the whole project, recovery lots included (`python scripts/recuperation/chercher-nom.py <regex>`), then probe the CONTENT (`sonder-contenu.py <dir>`): second-pass lots keep right names over overwritten bytes.

`mes_projet/` holds the recovery lots (1.2 TB) and recovered credentials. It is excluded through `.git/info/exclude`: never let it into a commit. `WebPortal/public` and `WebPortal/Server/adk` are junctions into it.

## Project Overview
**NARVOS PRIME** is a sci-fi MMORPG prototype with two live runtimes sharing one universe:
- **Frontend**: React, Three.js (via `@react-three/fiber` and `@react-three/drei`), Tailwind CSS, and Electron for the desktop shell.
- **Engine**: A custom C++/WASM engine (**NarvosEngine**) handles core gameplay logic, physics, and combat.
- **nanos world**: the runtime the game is being ported to — a shipping Unreal Engine 5.7 client, a server running **Lua 5.4** packages, and **WebUI** pages (HTML/JS). Gameplay is Lua; Unreal (the ADK project) only cooks asset packs. No third-party C++ plugin runs there.

## Development Commands

> All npm commands must be run from the `WebPortal/` directory (`cd WebPortal`). The repository root has no `package.json`.

### Core Workflow
- **Install Dependencies**: `npm install`
- **Development Mode** (Electron + Vite): `npm run electron:dev`
- **Build Production App**: `npm run build`
- **Preview Build**: `npm run preview`
- **Type Checking**: `npm run typecheck`

### Assets & Engine
- **Generate Asset Manifests**: `npm run assets:catalog`
- **Convert Assets (KTX2/Draco)**: `npm run generate:assets`
- **Build WASM Engine**: `npm run build:wasm`
- **Copy WASM to Public**: `npm run copy:wasm`

### Testing & Quality
- **Run All Tests**: `npm run test`
- **Watch Tests**: `npm run test:watch`
- **Smoke Test Game**: `npm run smoke`
- **Regression Tests**: `npm run regression`
- **Typecheck Prototypes**: `npm run typecheck:proto`

### nanos world (run from the repository root, not `WebPortal/`)
- **Whole Lua battery, one verdict**: `node scripts/lua-harness/tout.mjs`
- **One harness**: `node scripts/lua-harness/<name>.mjs`
- **Regenerate a catalog**: `node scripts/narvos-<name>-to-lua.mjs --apply` (simulation without `--apply`; never hide its output)

## Architecture & Structure

### Core Directories
- `WebPortal/`: The main web application and Electron shell.
  - `renderer/`: React frontend components and UI logic.
  - `electron/`: Main process code for the desktop wrapper.
  - `wasm/`: C++/WASM engine source and build artifacts.
  - `src/rpg/`: Core RPG systems, including vehicle controllers, combat logic, and state management.
  - `public/`: Static assets (WASM, models, Draco decoders in `public/draco/`).
  - `scripts/`: Web asset processing (KTX2 conversion, Draco compression, manifests) — what the npm scripts call.
  - `Server/nanos_world/packages/narvos/Shared/`: `Catalogs/` (GENERATED) and `Logic/` (hand-written, pure Lua under test).
  - `Server/nanos_world/packages/narvos-map-proto/`: `Server/` (session, spawn, world) and `Client/` (relays, WebUI).
  - `Server/adk/`: `NanosWorldADK.uproject`, the editor project that cooks the asset pack.
  - `Server/Assets/narvos/Assets.toml`: manifest of the cooked pack (GENERATED).
- `scripts/` (repository root): nanos tooling — catalog generators `narvos-*.mjs`, ADK import/cook scripts `adk-*.py`, the Lua harness `lua-harness/`, recovery tools `recuperation/`.
- `.hermes/`: session reports and handoffs.

### Key Architectural Patterns
1. **Hybrid Engine Bridge**: Communication between the Three.js frontend and NarvosEngine occurs via WASM bindings. Use `WebPortal/src/rpg/wasm/` to understand the TS-to-WASM bridge.
2. **Static Source of Truth**: Game data (classes, elements, spells, loot) is stored in static TypeScript objects (`classes/`, `elements/`, etc.) rather than a live database for high-performance access.
3. **Chunked Map Loading**: Large maps are split into chunks and loaded sequentially to prevent browser main-thread freezes.
4. **nanos world port**: Decision lives in `Shared/Logic/` (pure Lua, covered by the harness), execution in `narvos-map-proto/Server/` (touches the engine). Invoke the `nanos-world` skill before any nanos Lua, any asset export to nanos, or any change under `WebPortal/Server/nanos_world/`.

## Skills

Invoke a skill with `/<name>` (example: `/narvos-preflight`).

- In `.claude/skills/` (repo root): `nanos-world`, `wasm-engine`
- In `WebPortal/.claude/skills/`: `narvos-error-log`, `narvos-iteration-guard`, `narvos-level-design`, `narvos-lua`, `narvos-measure-first`, `narvos-mesh-pipeline`, `narvos-preflight`, `narvos-project-map`, `train-hermes`

## Critical Constraints & Pitfalls
- **Draco Offline-Safe**: Decoders must be served from `public/draco/`. Ensure consistency between `main.tsx` and manual loader instances.
- **KTX2 Global Patch**: KTX2 support is patched globally on the `GLTFLoader` prototype. Do not remove this patch; it ensures all assets use the shared transcoder.
- **VRAM Management**: Texture compression (KTX2) is mandatory to prevent "Context Lost" errors. Never ship raw PNG/WebP for large textures.
- **Asset Paths**: NEVER rename top-level folders in `public/models/`. Many paths are hardcoded across the codebase.
- **Lua Logic**: Do not edit Lua catalogs manually; they are generated by scripts. Use the provided harness tools to verify syntax and schema.
