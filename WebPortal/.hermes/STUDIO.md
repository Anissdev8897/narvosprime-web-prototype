# NARVOS PRIME — Studio Knowledge Base
# Mémoire partagée par tous les agents du studio

## 🏗️ Architecture Moteur
- Runtime: React 18 + Three.js (R3F) + Emscripten WASM (C++20)
- Build: Vite 6.4, Electron 39, TypeScript strict
- Backend: Node.js + MySQL (worldnevaros), WebSocket :8082
- Assets: GLB (Draco), KTX2 textures, WAV/MP3 audio
- Tests: Vitest — **1743 tests / 168 fichiers, 0 en échec** (mesuré 02/08/2026)
  ⚠️ Ne jamais recopier ce chiffre : re-mesurer avec `npm test 2>&1 | tail -5`
- tsc: **105 erreurs**, dont **102 dans `src/rpg/`** (mesuré 02/08/2026).
  `npm run build` (= `tsc && vite build`) reste donc CASSÉ. Concentration :
  `wasm/MathWasm.ts` (28), `runtime/debug/gameplayDebugger/` (15),
  `animation/IKController.ts` (11), `wasm/NavMeshBenchmark.ts` (9),
  `benchmarks/*.bench.ts` (10) — voir `narvos-project-map`.

## 📂 Structure
```
src/
├── rpg/
│   ├── runtime/        # Boucle de jeu principale
│   │   ├── RpgGameWorld.tsx (4011 lignes — cœur du jeu)
│   │   ├── movement/   # PlayerRig, CharacterController, FpsCamera
│   │   ├── StreamingPuzzleMap.tsx # Chunks streaming
│   │   └── testing/    # testInputBridge (API agents)
│   ├── animation/      # AnimationController (922 lignes)
│   ├── characters/     # OwnAnimPlayerCharacter, avatarAssets
│   ├── camera/         # cameraViewStore
│   ├── combat/         # weapons, ammoStore
│   ├── quests/         # questStore, questCatalog
│   ├── forge/          # Éditeur de map Forge
│   ├── npc/            # Npc.tsx, factionsAI, respawnManager
│   ├── wasm/           # MathWasm, NavMeshBaker
│   └── network/        # ReplicationManager (WebSocket)
├── components/         # UI: Login, MainMenu, CharacterSelect, etc.
└── electron/           # main.ts, preload.ts, database.ts
```

## 🎮 Systèmes implémentés
✅ Login/registre (offline + MySQL)
✅ Création personnage (classes, avatars, couleurs)
✅ Streaming map (8 chunks, BVH, LOD, culling)
✅ Mouvement (WASD, sprint, jump, crouch, slide, climb)
✅ Combat (sorts 1-2-3, attaque, ADS, armes)
✅ Animation (54 clips, locomotion blend, additive crouch)
✅ Caméra FPS/TPS (V toggle, zoom OK). **Correction de cette fiche le 02/08** :
   elle annonçait « collision murs DÉSACTIVÉE, `FpsCamera.ts:114` commentée ».
   C'est faux sur les deux points — L114 est un commentaire de SONDE, et
   l'anti-clip est bien appelé (`FpsCamera.ts:150-156`). Il est simplement
   conditionné par `cameraCollisionStore`, **OFF par défaut à la demande
   explicite de l'utilisateur** (il ne veut pas que la caméra se rapproche quand
   un mur passe derrière lui). Ce n'est pas une régression à réparer, c'est un
   réglage. Le plancher sol, lui, reste actif quel que soit ce toggle.
✅ Audio (ambiance, musique, SFX spatialisés)
✅ UI (menus, HUD, talents, quêtes, chat)
✅ Sauvegarde (localStorage + MySQL, progressionStore)
✅ NavMesh (baking, pathfinding A*)
✅ Forge Editor (édition map, gizmos, undo/redo)
⏳ Multijoueur (client WS présent, serveur à builder)

## 🖥️ Infrastructure Test
- Serveur Vite: http://127.0.0.1:3005
- Navigateur test: accessible via browser tools
- API test: window.__narvosTest (20+ commandes, getState())
- Comptes admin: testagent1-4 / testpass1-4
- Smoke test: scripts/smoke-test-game.js
- Régression: scripts/regression-test.js

## 🐛 Bugs Connus (P0)
- ~~**TPS écran noir**~~ — ✅ **RÉSOLU 31/07/2026**. La caméra TPS passait SOUS le
  sol dès 16,8° de regard vers le haut (mesuré : y = −28,83 pour un sol à −26).
  Cause : `resolveCameraPosition` faisait `Math.max(minDist, impact)` — la borne
  de confort l'emportait sur la géométrie et poussait la caméra à travers le sol.
  Un agent a ensuite désactivé l'anti-clip au lieu de corriger `minDist`, retirant
  la dernière protection. Détail complet dans `narvos-error-log`.
  **Ni NaN, ni échelle perso, ni système d'animation** — les trois éliminés par mesure.
- WebSocket serveur hors-ligne (port 8082)
- Chunks lents en mode navigateur (non-Electron)
- DB connection failed en mode navigateur
- ~~SSAO NormalPass manquant~~ — corrigé 30/07 (`PostProcessingPipeline.tsx`)
- ~~Modèle 3D ne charge pas (coerceAvatarId force WRAITH)~~ — remplacé par :
  `Murdock.glb` fait **93 Mo** et dépasse le timeout de 15 s (filet déclenché 4×)

## ⌨️ Commandes de chat (slash-commands)

Registre : `chatStore.registerCommand(name, handler)`. Déclarations : **un seul
endroit**, `src/rpg/chat/registerAdminCommands.ts`. `/help` se construit depuis
`getCommandNames()` — aucune liste à maintenir en double.

`/help` · `/clear` · `/adminmode` · `/noclip` · `/tp <x> <y> <z>` · **`/give`** · **`/respawn`**

### ⚠️ La position de départ n'est PAS `MAP_SPAWN`

`RpgGameWorld.tsx:501` — un personnage démarre à sa **dernière position
sauvegardée** (`progressionStore.position`, écrite par `saveProgression`).
`MAP_SPAWN` n'est lu que pour un personnage sans sauvegarde.

Conséquence : un perso sauvegardé sous la carte ou enfermé dans une structure y
renaît à chaque connexion **et s'y re-sauvegarde**. La sauvegarde est empoisonnée
définitivement, et corriger `MAP_SPAWN` n'y change rien.

C'est pourquoi un même build peut donner un écran noir sur un serveur et
fonctionner sur un autre : la différence est dans les DONNÉES du personnage, pas
dans le code. Avant de chercher un bug de rendu, **tester avec un perso neuf**.

Cure : `/respawn` (admin) — renvoie au point d'apparition de la map et
re-sauvegarde là.

Depuis le 31/07/2026, l'écriture est protégée à deux niveaux : `saveNow` ne
persiste la position que si le joueur est `grounded` (sinon il réécrit le dernier
point au sol), et `saveProgression` refuse toute coordonnée non finie ou au-delà
de ±20 000. Les deux serveurs sont donc désormais identiques en gameplay : plus
aucune donnée de personnage ne peut diverger du comportement du code.

📄 Détail de toutes les corrections de la session : `.hermes/CORRECTIONS_2026-07-31.md`

```
/give                      liste les profils equipables
/give arch_sword           equipe en primaire
/give arch_gun secondary   equipe en secondaire
/give none                 desequipe → combo de poings actif
```

Profils réglés à la main : `arch_sword`, `arch_shield`, `arch_bow`, `arch_arrow`,
`arch_staff`, `arch_gun`, `arch_dagger` (55 au total, le reste auto-généré).

⚠️ **Le combo de poings ne se déclenche que si aucune arme PRIMAIRE n'est
équipée** (`RpgGameWorld.tsx:1663`). D'où `/give none` : sans lui, les animations
de frappe à mains nues sont intestables.

⚠️ Le mode admin s'ouvre avec **F8**, pas F12 (capturé par Electron pour ses
DevTools). Plusieurs commentaires du code parlent encore de F12 : ils sont périmés.

## 🔬 SONDE P0 — ✅ MESURE OBTENUE, la sonde est à RETIRER (statut au 02/08/2026)

Le P0 « TPS écran noir » est **résolu** (cause : `Math.max(minDist, impact)` dans
`resolveCameraPosition`, cf. `narvos-error-log` 31/07). La condition « ne pas
retirer avant d'avoir la mesure » est donc levée : **cette instrumentation est
maintenant du code mort dans un chemin chaud** (`probeTick()` et deux `probeVec3`
tournent dans le `useFrame` de `PlayerRig`).

Encore présente dans 4 fichiers (vérifié par
`grep -rn "PROBE P0\|tpsBlackScreenProbe" src/`) :
`runtime/diagnostics/tpsBlackScreenProbe.ts` (le module), `PlayerRig.tsx`
(L31-32, 184, 417, 443), `FpsCamera.ts` (L19-20, 114, 225),
`OwnAnimPlayerCharacter.tsx` (L50-51, 142).

La procédure de relevé ci-dessous est conservée à titre de **modèle
d'instrumentation par couches** (cf. `train-hermes` règle F) — pas parce que la
sonde doit rester branchée.

Fichier : `src/rpg/runtime/diagnostics/tpsBlackScreenProbe.ts`

### Procédure de relevé — AUCUNE manipulation requise

```
npm run go     # entrer en jeu (map forge), la vue démarre en TPS
```

La sonde **affiche son verdict à l'écran** au bout de ~3 s (180 frames), en
overlay DOM par-dessus le canvas. Le symptôme diagnostiqué étant justement un
écran noir, l'overlay y est parfaitement lisible : **un screenshot suffit**.

- **Cadre vert** = sonde active, 0 déclenchement → H1 et H2 toutes deux éliminées
- **Cadre rouge** = déclenchement(s), avec `>>> COUCHE FAUTIVE :` en tête

⚠️ Distinguer « cadre vert » de « aucun overlay » : pas d'overlay du tout =
`PlayerRig` ne tourne pas (le `useFrame` n'est jamais atteint) — c'est en soi un
résultat, et il oriente vers le montage de la scène, pas vers la caméra.

Console toujours dispo si besoin : `__probeP0.summary()`.

### Lecture du résultat — le PREMIER tag désigne la couche fautive

| Tag | Ce que ça prouve | Correctif visé |
|---|---|---|
| `1-CharacterController.position` | La valeur fautive naît dans le **mouvement**. La caméra ne fait que la propager. | `CharacterController.ts` |
| `1b-EtatJoueurNonFini` | `dt`, `yaw` ou `pitch` non-fini → l'entrée souris/temps est corrompue | `PlayerRig` / `InputManager` |
| `2-FpsCamera.entrees` | `d`, `cp` ou `eyeHeight` non-fini — le clamp ne filtre PAS le NaN | `playerConfig` / stores offset-échelle |
| `2c-FpsCamera.tpsSmoothed` **seul** | H1 confirmée : l'accumulateur s'est verrouillé (`NaN.lerp` reste NaN) | `FpsCamera.ts:129-134` |
| `4-PersoEchelleAberrante` | H2 confirmée : bbox vide → `baseScale = 1800` → perso de 2,3 km | `OwnAnimPlayerCharacter.tsx:136` |
| **aucun déclenchement** | Ni H1 ni H2. Relever `__narvosTest.getState()` → comparer `playerPos` et `cameraPos`. | à ré-ouvrir |

`__narvosTest.getState()` expose désormais `playerPos` ET `cameraPos` séparément
(avant, `playerPos` renvoyait en fait la position de la CAMÉRA — inexploitable
en TPS où les deux diffèrent de `tpsDistance`), plus `probeHits`.

### Retrait
Supprimer `tpsBlackScreenProbe.ts` + les 3 blocs marqués `PROBE P0` dans
`PlayerRig.tsx`, `FpsCamera.ts`, `OwnAnimPlayerCharacter.tsx`.

## 📋 Conventions
- Langue: français (rapports), anglais (code)
- Format bug: [SÉVÉRITÉ] Description + Fichier:ligne + Reproduction
- Tests: avant chaque fix, vérifier vitest + tsc
- Commit: descriptif, atomique, jamais force-push