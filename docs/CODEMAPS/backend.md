# Backend Architecture

<!-- Generated: 2026-10-03 | Files scanned: ~500 | Token estimate: ~700 -->

## Server Components
- **Nanos World**: Node.js server running Lua 5.4 for world logic, NPC behaviors, and persistent state.
- **Asset Build Pipeline**: Python/Node scripts for KTX2 conversion, Draco compression, and manifest generation.
- **Electron Main Process**: Handles window management, local SQLite persistence, and native OS integration.

## API & Logic Flow
- **Lua Harness**: Validates Lua script syntax, schema, and portee before deployment to Nanos World.
- **Asset Pipeline**: `scripts/` -> `public/models/` (Static Source of Truth).
- **Persistence**: `better-sqlite3` for local user profiles; static TS objects for game data.

## Key Files
- `WebPortal/Server/nanos_world/`: Lua scripts and server logic.
- `scripts/`: Automation tools (`lua-harness`, `asset-catalog`).
- `src/data/`: Static catalogs (classes, elements, spells).

## Dependencies
- **Lua 5.4**: Scripting engine for world behaviors.
- **SQLite**: Local data storage.
- **Node.js**: Server runtime and build toolchain.
