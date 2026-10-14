# Architecture Overview

<!-- Generated: 2026-10-03 | Files scanned: ~500 | Token estimate: ~700 -->

## System Diagram
[Client (Electron)] <--> [WebPortal (React/Three.js)] <--> [NarvosEngine (WASM)]
                               |
                        [Nanos World (Node.js/Lua)]

## Service Boundaries
- **Frontend**: React components, Three.js scene graph, UI state management.
- **Game Engine**: C++ logic compiled to WASM; handles physics, combat, and entity behavior.
- **World Server**: Lua scripts managing persistent world states, NPC behaviors, and server-side authority.

## Data Flow
1. **Input**: User interaction (Keyboard/Mouse) -> React Event Handlers.
2. **Logic**: TS Bridge -> WASM Engine (Physics/Combat) or Node.js (Persistence).
3. **Output**: Three.js Render Loop -> WebGL Canvas.

## Key Components
- `WebPortal/`: Entry point, UI, and Electron shell.
- `src/rpg/`: Core RPG systems & TS bridge to WASM.
- `scripts/`: Asset pipeline (KTX2, Draco) and Lua harness tools.
