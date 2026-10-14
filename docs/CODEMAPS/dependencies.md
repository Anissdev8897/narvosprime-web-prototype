# Dependencies Architecture

<!-- Generated: 2026-10-03 | Files scanned: ~500 | Token estimate: ~700 -->

## Core Stack
- **Frontend**: React, Three.js (`@react-three/fiber`, `@react-three/drei`), Tailwind CSS.
- **Engine**: C++/WASM (NarvosEngine) for physics and combat logic.
- **Backend**: Node.js, Lua 5.4 (Nanos World), SQLite (`better-sqlite3`).
- **Desktop Shell**: Electron.

## Key Libraries & Tools
- **Graphics/3D**: `three`, `three-stdlib` (KTX2 support), `three-mesh-bvh`.
- **Build/Tooling**: Vite, Esbuild, `gltf-transform`, Draco3dGltf, Sharp.
- **Testing**: Vitest, Playwright (E2E).
- **Persistence**: `better-sqlite3`, `dotenv`.

## Integration Points
- **WASM Bridge**: TS/JS bindings for NarvosEngine logic.
- **Lua Harness**: Validation and deployment of Nanos World scripts.
- **Asset Pipeline**: Scripts for KTX2 transcoding, Draco compression, and manifest generation.

## External Services
- **Poly Haven / Sketchfab**: Source for 3D assets (models, textures).
- **GitHub**: Version control and repository search.
