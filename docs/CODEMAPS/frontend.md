# Frontend Architecture

<!-- Generated: 2026-10-03 | Files scanned: ~500 | Token estimate: ~700 -->

## Page Tree & Navigation
- **Intro** (`IntroScreen`) -> **Menu** (`MainMenu`)
- **Login** (`LoginScreen`) -> **Server Selection** (`ServerSelection`)
- **List** (`CharacterSelectScreen`) -> **Play** (`RpgGameWorld`) / **Create** (`CharacterCreateScreen`)

## Component Hierarchy
- `WebPortal/renderer/`: React components (UI, HUD, Menus).
- `src/rpg/`: Core RPG systems (Vehicle controllers, Combat logic).
- `WebPortal/src/rpg/wasm/`: TS bridge for WASM engine interaction.

## State Management Flow
1. **Global UI State**: Managed in `App.tsx` (Stage, Username, Role).
2. **Character State**: `SavedCharacter` object + local appearance cache (`localStorage`).
3. **Game World State**: Owned by `RpgGameWorld`; synced with WASM engine via bridge.

## Key Files
- `WebPortal/src/App.tsx`: Main navigation machine and stage management.
- `src/rpg/types.ts`: Shared RPG types (ClassId, etc.).
- `WebPortal/src/utils/AudioManager.js`: Global audio state.
