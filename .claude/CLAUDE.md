# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, invoke the Skill tool with `skill: "graphify"` before doing anything else.

# nanos-world
- **nanos-world** (`.claude/skills/nanos-world/SKILL.md`) — base vérifiée pour le pivot NARVOS → nanos world : architecture (asset packs UE 5.7 + packages Lua), API personnages/caméra/autorité/événements lue à la source (`nanos-world/api`), formats `Package.toml`/`Assets.toml`, whitelist de plugins, et tous les pièges déjà payés (chemins `.uasset` absolus, squelette **UE4** ≠ Manny UE5, `Package.Require` vs `require`, `VA_*` à ne jamais cuire). **Invoquer ce skill AVANT tout code Lua nanos, tout export d'asset vers nanos, toute modification sous `C:\Users\aniss\Documents\nanos_world\`.** Ne jamais affirmer une signature d'API sans l'avoir lue dans `nanos-world/api` : la doc locale ne les contient pas.

# wasm-engine
- **wasm-engine** (`.claude/skills/wasm-engine/SKILL.md`) — mémoire d'implémentation du moteur hybride C++/WASM (NarvosEngine). **Invoquer ce skill AVANT toute modification touchant `WebPortal/wasm/` (C++), `WebPortal/src/rpg/wasm/` (pont TS), ou du code interagissant avec l'IA/physique/combat/animation WASM.** Il encode l'architecture, l'ordre de tick, les conventions embind, les règles gameplay inviolables et les erreurs déjà commises.