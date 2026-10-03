# ARCHITECTURE — NARVOS PRIME WebPortal

> Généré automatiquement par `scripts/gen-docs.mjs`

## Vue d'ensemble

Le projet **WebPortal** est le client web du MMORPG NARVOS PRIME.  
Il est structuré en **46 modules** organisés dans `src/rpg/`, avec un point d'entrée public via `src/rpg/index.ts`.

### Stack technique

| Couche | Technologie |
|--------|------------|
| Framework | React 19 + TypeScript 5.8 |
| Rendu 3D | Three.js + @react-three/fiber + @react-three/drei |
| Post-processing | @react-three/postprocessing |
| Build | Vite 6 |
| Tests | Vitest |
| Desktop | Electron 39 |
| Calcul natif | WebAssembly (C++ → Emscripten) |
|

## Architecture par couches

```
┌──────────────────────────────────────────────────┐
│                    UI Layer                       │
│  src/components/   src/rpg/ui/   src/rpg/hud/    │
├──────────────────────────────────────────────────┤
│              Gameplay Layer                       │
│  runtime/  combat/  weapons/  characters/   npc/  │
│  spells/   loot/    quests/   professions/        │
├──────────────────────────────────────────────────┤
│              Simulation Layer                     │
│  animation/  audio/  camera/  materials/  render/│
│  nature/     props/  ambient/  mapgen/           │
├──────────────────────────────────────────────────┤
│           Data / Persistence Layer                │
│  cache/  memory/  persistence/  network/  chat/   │
│  settings/  loaders/  forge/                     │
├──────────────────────────────────────────────────┤
│           WASM Bridge Layer                       │
│  wasm/  threading/                               │
└──────────────────────────────────────────────────┘
```

## Diagramme des dépendances entre modules

```mermaid
graph TD
  ambient["Système d'ambiance"]
  animation["Système d'animation"]
  animations["Maps d'animations"]
  archetypes["Archétypes de classes"]
  audio["Système audio"]
  benchmarks["Benchmarks"]
  cache["Système de cache"]
  camera["Système de caméra"]
  characters["Personnages"]
  chat["Système de chat"]
  classes["Définition des classes"]
  combat["Système de combat"]
  elements["Système d'éléments"]
  factions["Système de factions"]
  forge["Éditeur Forge"]
  hud["Affichage tête-haute"]
  loaders["Chargeurs d'assets"]
  loot["Système de butin"]
  mapgen["Génération procédurale"]
  materials["Système de matériaux"]
  memory["Gestion mémoire"]
  monitoring["Monitoring"]
  nature["Système nature"]
  network["Réseau"]
  npc["PNJs"]
  persistence["Persistance"]
  pets["Familiers"]
  professions["Métiers"]
  props["Props / décors"]
  quests["Système de quêtes"]
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->