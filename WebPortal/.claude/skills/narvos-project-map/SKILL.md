# narvos-project-map

Carte mentale du projet NARVOS PRIME. À invoquer AVANT toute modification de code.

## Métriques vérifiées (2 août 2026)

⚠️ Ces chiffres dérivent vite. Les valeurs du 21 juillet étaient fausses d'un
facteur 2 à 4 au 31 juillet (421 → 727 fichiers, 411 → 1705 tests). **Toujours
re-mesurer avant de citer**, cf. `train-hermes` §3.

Commandes de référence sous Windows (PowerShell) — voir l'avertissement plus bas
sur `Measure-Object -Line` :

| Métrique | Valeur | Commande de vérification |
|----------|--------|--------------------------|
| Fichiers TS/TSX (src/rpg/) | **731** | `(Get-ChildItem src/rpg -Recurse -Include *.ts,*.tsx).Count` |
| Lignes de code (src/rpg/) | **96 739** | `(Get-ChildItem src/rpg -Recurse -Include *.ts,*.tsx \| Get-Content \| Measure-Object -Line).Lines` |
| Tests | **1743 / 1743** — **168 fichiers, 0 en échec** | `npm test 2>&1 \| tail -5` |
| Erreurs tsc | **105** dont **102 dans `src/rpg/`** | `npx tsc --noEmit 2>&1 \| Select-String "error TS" \| Measure-Object` |
| RpgGameWorld.tsx | **3787 lignes** | `(Get-Content src/rpg/runtime/RpgGameWorld.tsx \| Measure-Object -Line).Lines` |

> ⚠️ **`Measure-Object -Line` ne compte PAS le contenu des fichiers** si on lui
> passe des `FileInfo`. `Get-ChildItem … | Measure-Object -Line` mesure la
> représentation texte des objets — une ligne par fichier. C'est ainsi qu'on
> obtient « 731 fichiers / 731 LOC » et « RpgGameWorld = 1 ligne ».
> **Il faut interposer `Get-Content`.** (Cette erreur était inscrite dans
> `narvos-preflight` §6 ; corrigée le 02/08.)

> ⚠️ L'ancienne commande bash annonçait **106 562** LOC là où PowerShell en
> compte **96 739** (écart 10 %). Non résolu — `[À VÉRIFIER]`. En attendant, la
> référence du projet reste PowerShell (cf. `narvos-error-log`, entrées « ~47k »
> et « ~24k LOC »).

### ✅ Suite de tests verte au 02/08/2026

Les 15 suites rouges du 31/07 sont corrigées (détail : `narvos-error-log`,
entrées du 02/08). Deux d'entre elles ne se **chargeaient pas** et étaient
rapportées « (0 test) » — 18 tests invisibles depuis leur écriture.

**Six correctifs portaient sur du code de PRODUCTION, pas sur les tests** :
`RagdollSystem` (API Babylon dans du Three.js), `ObjectPool.warmupPool`
(pré-créait 1 objet au lieu de N), `MappingContext.activateOnly` (écriture sur
getter → levée), `InputModifiers` (division par zéro → `Infinity`),
`Benchmark.tick` (muet sans renderer), `MonitoringService` (fuite de `setInterval`).

### 🔴 `npm run build` reste CASSÉ

`npm run build` = `tsc && vite build` : **il ne peut pas passer avec 105 erreurs.**
La règle de `CLAUDE.md` (« zéro nouvelle erreur dans `src/rpg/**` ») reste
franchie — le socle est à 102 erreurs sur `src/rpg` seul. C'est le prochain
chantier.

Concentration des erreurs (à traiter en priorité, ce sont des blocs entiers) :

| Zone | Nature |
|---|---|
| `src/rpg/wasm/MathWasm.ts` | méthodes absentes de `NarvosWasmModule` (`mat4Mul`, `quatFromTwoVectors`, `batchVec3Normalize`…) — le binding embind et le type TS ont divergé |
| `src/rpg/wasm/NavMeshBenchmark.ts` | importe 9 symboles que `NavMeshBridge` n'exporte pas |
| `src/rpg/wasm/WasmAnimationGraph.ts` | `animGraphAddBlendDirectional`, `animGraphGetBlendDecisions` absents |
| `src/ui/components/` | `Modal.tsx`, `Tooltip.tsx` — props incompatibles |

⚠️ Le pont WASM domine. Invoquer le skill `wasm-engine` avant d'y toucher
(cf. `.claude/CLAUDE.md`).
| ShipFlightUI.tsx | **132 lignes** | Module extrait (ShipTelemetry, SpaceLandingTrigger) |
| AutoAttackSystem.tsx | **170 lignes** | Factory extraite (auto-attack bow/gun/melee) |

## Architecture

```
WebPortal/
├── src/rpg/               ← Runtime RPG (421 fichiers, ~44k LOC)
│   ├── animation/         AnimationController, mixamoRetarget, emotes
│   ├── characters/        Persos jouables (Wraith, Murdock, Meshy, Humain)
│   ├── runtime/           RpgGameWorld (god-component 3753l), CollisionWorld, maps
│   ├── wasm/              Bridge C++/WASM (15 fichiers TS)
│   ├── persistence/       dbStore (MySQL IPC + localStorage fallback)
│   ├── weapons/           WeaponSocket, FpsWeaponViewmodel, ammoStore
│   ├── npc/               NpcCatalog, NpcController, Npc.tsx
│   ├── quests/            questCatalog, questStore (recordCollect L142)
│   ├── reputation/        reputationStore, reputationCatalog, ReputationPanel
│   ├── pets/              petStore, CompanionPet, PetPanel
│   ├── loot/              LootRegistry, proceduralLoot
│   ├── stats/             Progression, characteristics, effectiveStats
│   ├── classes/           6 classes (source de vérité statique)
│   ├── archetypes/        5 archétypes avec sorts liés
│   ├── talents/           12 talents, 4 branches
│   ├── factions/          FSM IA, alliances, guerres dynamiques
│   ├── combat/            ammoStore, magazineStore, GunVfxPool
│   ├── forge/             Éditeur de placement in-game
│   ├── professions/       3 récolte + 3 craft
│   ├── ambient/           Animaux ambiants (7 defs)
│   ├── audio/             AudioManager singleton, musique adaptative
│   └── ...                (+25 sous-dossiers)
├── wasm/src/              Moteur C++ → WASM (Emscripten)
├── electron/              Electron main + preload
└── public/models/         Assets statiques (~20k+ fichiers)
```

## Singletons hors-React (lecture AVANT modification)

| Singleton | Fichier | Persistance | Notes |
|-----------|---------|-------------|-------|
| `collisionWorld` | runtime/CollisionWorld.ts | mémoire | BVH, triggers |
| `eventBus` | runtime/world-events/ | mémoire | EventEmitter pattern |
| `gameSettings` | runtime/ | localStorage synchrone | slider volumes, qualité |
| `npcRegistry` | npc/npcRegistry.ts | mémoire | Handle NPCs vivants |
| `ammoStore` | combat/ | localStorage synchrone | |
| `magazineStore` | combat/ | localStorage synchrone | |
| `equippedWeaponStore` | weapons/ | localStorage synchrone | primary/secondary + slot |
| `reputationStore` | reputation/ | localStorage per-character | |
| `petStore` | pets/ | localStorage per-character | |
| `questStore` | quests/questStore.ts | localStorage per-character | |
| `chatStore` | chat/ | mémoire | |
| `AudioManager` | audio/ | localStorage | singleton avec guard SSR |

**Règle d'or : tous les stores persistent en localStorage synchrone sur chaque mutation. Aucune perte sur reload.**

## Patterns récurrents

1. **Singleton hors-React** — état mutable + `Set<() => void>` listeners + hook `useSyncExternalStore` pour le pont React
2. **Logique pure/coquille impure** — contrôleurs TS pur (zéro R3F), tests en `node` sans DOM. Un seul `useFrame` dans PlayerRig.tsx assemble tout
3. **Catalogues = vérité statique** — classes, éléments, sorts, loot, NPCs, maps, véhicules définis dans des objets/maps TS
4. **WASM hybride** — C++ pour compute (IA, physics, animation blend), JS pour rendering (Three.js) et UI (React)
5. **WASM fallback** — `getEngine()` guard null partout, fallback JS silencieux si WASM absent

## Fichiers critiques (lire EN ENTIER avant de modifier)

| Fichier | Lignes | Risque |
|---------|--------|--------|
| `src/rpg/runtime/RpgGameWorld.tsx` | **3586** | God-component. TDZ potentiel (useRef pattern). Ne JAMAIS modifier sans lire en entier. |
| `src/rpg/runtime/vehicles/ShipFlightUI.tsx` | **132** | Module extrait (ShipTelemetry, SpaceLandingTrigger, etc.) |
| `src/rpg/runtime/combat/AutoAttackSystem.tsx` | **170** | Factory extraite (auto-attack bow/gun/melee + unarmed) |
| `src/rpg/npc/Npc.tsx` | 647 | Logique NPC + WASM AI Takeover. Contient le T-pose warning (L257). |
| `src/rpg/animation/AnimationController.ts` | 448 | debugBindings() L422-438. Tracks non liées diagnostic. |
| `src/rpg/weapons/WeaponSocket.tsx` | 229 | boneForMode() L106, appelée L140. Fallback RightHand manquant. |
| `src/rpg/quests/questStore.ts` | 225 | recordCollect L142, recordKill, recordReach. |
| `src/rpg/runtime/PuzzleMap.tsx` | ~250 | Retry L162-167. Chunk loading avec timeout. |

## Commandes essentielles

```bash
npm run dev                # Vite dev server port 3005
npm run build              # tsc + vite build
npm test                   # vitest run
npx tsc --noEmit           # type-check
npm run electron:dev       # Electron dev
```

## Pièges connus

- **TDZ dans RpgGameWorld** — useEffect référence des useCallback déclarés plus bas → pattern `fooRef.current?.()`
- **Audio Vite SPA fallback** — fichier manquant renvoie text/html 200 au lieu de 404
- **SSR/tests** — garder `if (typeof document === "undefined") return;` dans le code DOM au module-load
- **Draco offline** — configuré à 2 endroits (main.tsx + chaque new DRACOLoader())
- **WASM import** — spécificateur en variable + `@vite-ignore` dans WasmBridge.ts
- **HEAPF32 invalidé** — ne jamais cacher la vue TypedArray entre frames (memory growth)
- **Fichiers .bak** — sauvegardes mortes, ne pas éditer

---

## Côté nanos world — mesuré le 3 septembre 2026 (soir)

Le portage nanos vit dans `WebPortal/Server/`, indépendant du runtime React.
Il a sa propre suite de tests (wasmoon, Lua 5.4 réel) et son propre pack d'assets.

| Métrique | Valeur | Commande |
|---|---|---|
| Fichiers Lua (packages) | **43** | `find WebPortal/Server/nanos_world/packages -name '*.lua' \| wc -l` |
| Lignes Lua | **17 042** | `find … -name '*.lua' \| xargs wc -l \| tail -1` |
| Tests Lua | **980 / 980**, 11 suites, 0 en échec | `cd scripts/lua-harness && node <suite>.mjs` |
| Pack cuit | **98 111 fichiers**, `Assets.toml` 902,7 Ko | `nanos-build-asset-pack.mjs` |
| Assets nommés | 1 966 skeletal · 1 634 anims · 1 464 static · 1 966 matériaux | `Assets.toml` |
| Références de catalogue vérifiées | **2 356**, 0 morte | `node scripts/narvos-verifier-catalogues.mjs` |
| Pièces modulaires | **116**, 4 familles, **17 corps**, 8 slots | `Shared/Catalogs/Modular.lua` |
| Animations contextuelles | **166**, 7 catégories | `Shared/Catalogs/Emotes.lua` |
| Particules (pack de base) | **106**, 7 familles dont 21 de magie | `Shared/Catalogs/Vfx.lua` |
| Props plaçables (pack de base) | **449**, 13 catégories | `Shared/Catalogs/Props.lua` |
| PNJ invocables | **41** vérifiés présents | `Shared/Catalogs/Spawnables.lua` |
| Commandes reconfigurables | **13**, 4 catégories | `Shared/Logic/Commandes.lua` |

Les 11 suites : `run` (Inventory, 160) · `modular` (174) · `sorts` (168) ·
`commandes` (101) · `voyage` (80) · `creation` (72) · `anims` (55) ·
`roster` (53) · `raccourcis` (52) · `comptes` (44) · `crypto` (21).

```bash
cd scripts/lua-harness
for h in run creation anims modular crypto comptes roster raccourcis commandes sorts voyage; do
  node "$h.mjs" 2>&1 | grep -iE "^[0-9]+ (reussis|réussis)"
done
node syntaxe-check.mjs          # la GRAMMAIRE de chaque fichier Lua
node portee-check.mjs           # un nom employé AVANT son `local`
```

⚠ **Les deux contrôles sont complémentaires.** `syntaxe-check` appelle `load()`,
qui valide la grammaire et pas la portée : un `local function` déclaré après son
appelant compile parfaitement et lève à l'exécution. `portee-check` cherche
exactement ça — il a trouvé `SansBalise` (déclarée l. 554, appelée l. 210 et 444)
dès sa première exécution.

Depuis le 2026-09-03, `syntaxe-check` **parcourt le disque** au lieu de tenir une
liste : la liste écrite à la main ne couvrait plus que 13 fichiers sur 40.

⚠ Les catalogues de `Shared/Catalogs/` sont **générés** — ne pas les éditer :
`narvos-modular-to-lua.mjs`, `narvos-emotes-to-lua.mjs`, `narvos-anims-to-lua.mjs`,
`narvos-catalogs-to-lua.mjs`, `narvos-nanos-base-to-lua.mjs` (Vfx + Props),
`narvos-spawnables-to-lua.mjs`, `narvos-map-to-lua.mjs`.
Deux exceptions écrites à la main : `Factions.lua` et `Mondes.lua` — ce sont des
tables de correspondance et de level design, pas des transpositions.

### Les systèmes de jeu, et où ils vivent

| Système | Décision (pur, testé) | Exécution (impur) |
|---|---|---|
| Pouvoirs | `Logic/Sorts.lua` | `Server/Sorts.lua` |
| Props | `Catalogs/Props.lua` | `Server/Props.lua` |
| PNJ / monstres | `Catalogs/Spawnables.lua` | `Server/Spawner.lua` |
| Touches | `Logic/Commandes.lua` | `Server/Commandes.lua` |
| Voyage entre mondes | `Logic/Voyage.lua` | `Server/Voyage.lua` |
| Animations contextuelles | `Logic/Raccourcis.lua` | `Server/Emotes.lua` |

Même séparation que `CharacterController` / `PlayerRig` côté web : ce qui se
teste hors moteur d'un côté, ce qui touche aux entités nanos de l'autre.

**Non prouvé** : rien de ce portage n'a encore été vu fonctionner en jeu. Les
tests couvrent la logique pure ; l'affichage des personnages, l'aperçu 3D, les
menus et les portails restent à valider à l'écran.