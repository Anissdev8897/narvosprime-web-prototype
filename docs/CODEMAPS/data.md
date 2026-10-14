# Data Architecture

<!-- Generated: 2026-10-03 | Files scanned: ~500 | Token estimate: ~700 -->

## Storage Strategy
- **Static Source of Truth**: Game data (classes, elements, spells, loot) is stored in static TypeScript objects for high-performance access.
- **Local Persistence**: `better-sqlite3` handles user profiles, configurations, and local state via Electron's main process.
- **Asset Manifests**: JSON/TS files mapping all models, textures, and animations; regenerated via `npm run assets:catalog`.

## Data Flow
1. **Boot**: Load static catalogs -> Check `localStorage` for appearance -> Fetch SQLite profile.
2. **Runtime**: Read from TS objects (classes/elements) -> Update local state -> Sync to WASM/Lua as needed.
3. **Persistence**: Write user-specific changes (inventory, progress) to SQLite; write global assets to `public/models/`.

## Key Files
- `src/data/`: Static catalogs for game content.
- `WebPortal/electron/`: SQLite database management and local storage logic.
- `loaders/assetManifest.ts`: Mapping of all available world assets.

## Relationships
- **Catalog -> Game**: Defines valid IDs, stats, and properties used by both WASM engine and Lua scripts.
- **SQLite -> User**: Maps unique user IDs to persistent character data and settings.
