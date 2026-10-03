# CLAUDE.md
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
## Projet
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
## Commandes (depuis `WebPortal/`)
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
## Flux de navigation (`src/App.tsx`)
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
## Architecture du runtime 3D (`src/rpg/`)
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
### Système d'assets et chargement (critique — source des freezes)
- **Draco offline-safe** : decoders servis depuis `public/draco/` (pas le CDN Google). Configuré à 2 endroits qui doivent rester cohérents : `main.tsx` (`useGLTF.setDecoderPath('/draco/')` pour drei) **et** chaque `new DRACOLoader()` manuel (`runtime/loading/AssetPreloader.ts`, `runtime/PuzzleMap.tsx`). Oublier le 2e → "No DRACOLoader instance provided".
- **KTX2 câblé globalement** (`loaders/installKtx2Everywhere.ts`, appelé dans `main.tsx`) : contrairement à Draco, drei n'a PAS de configuration globale pour KTX2 — il faut un `extendLoader` en 4e argument de `useGLTF`, que 37 appels sur 40 oubliaient. On patche donc `parse` sur le prototype des DEUX `GLTFLoader` (`three-stdlib` pour drei, `three/examples` pour les loaders manuels) : plus aucun call-site ne peut rater le transcodeur. **Ne pas "nettoyer" ce patch en repassant à des `extendLoader` explicites** — le prochain `useGLTF(path)` écrit sans 4e argument casserait silencieusement tous les assets KTX2. `KTX2Loader` exige `detectSupport(renderer)` avant tout transcodage : monter `<RendererRegistrar />` dans chaque `<Canvas>` qui charge des GLB, sinon `attachKTX2` fabrique un renderer jetable (ça marche, mais ça consomme un contexte WebGL).
- **Textures des assets → KTX2** (`scripts/assets-to-ktx2.mjs`) : la VRAM ne dépend PAS du poids du fichier — une texture PNG/WebP est décompressée en RGBA8 sur le GPU (un 2048² = 22 Mo, mipmaps compris). Mesuré : `Wraith.glb` 832 Mo, `Murdock_Executioner.glb` 1024 Mo. C'est LA cause des "Context Lost". Le script ne touche QUE les textures — **ni `draco()`, ni `prune()`, ni `dedup()`** : Draco réordonne les sommets et désaligne les morph targets (Wraith, Rampage en ont), et `prune()` supprime les nœuds vides qui SONT les points d'attache d'armes cherchés par nom au runtime. Originaux archivés en `<pack>_original/` **et non** `_ktx2_backup/` — vérifié sur disque le 2026-09-03 : aucun `_ktx2_backup` n'existe, le seul original conservé est `personnages/ZombieSoldierPack_original` (41,7 Go, rollback documenté dans `WebPortal/export/README.md`). Cibler la liste produite par `scripts/audit-runtime-assets.mjs` (le runtime ne charge que ~4,7 Go des ~120 Go de `public/models/`).
- **Variantes qualité** (`loaders/assetQuality.ts`) : `<name>.glb` (high) / `.med.glb` (1024) / `.low.glb` (512). `precomputeQualityCache()` au boot fait des HEAD checks ; `qualityVariant(path)` retourne le path optimal en synchrone, fallback silencieux sur high si la variante manque.
- **PuzzleMap** (`runtime/PuzzleMap.tsx`) : les grosses maps sont **découpées en chunks** chargés **séquentiellement** (`await loadAsync` + `await requestAnimationFrame` entre chaque) → le navigateur respire → pas de freeze. Activé quand `MAPS[id].chunks` est défini dans `loaders/assetManifest.ts` ; sinon fallback `MapModel` (GLB unique). Chaque chunk garde sa transform monde, donc l'assemblage est invisible.
- **Génération des chunks** : `scripts/puzzle-chunks.mjs <input.glb> <outputDir> <chunkCount> [maxTexSize]` (ex: `node scripts/puzzle-chunks.mjs public/models/Maps/forge_map/halo_map.glb public/models/Maps/forge_map/chunks 8`). Default maxTexSize = 2048 (cap GPU runtime). Pipeline : `flatten()` → bucketing greedy LPT équilibré → `prune()` + `dedup()` → `textureCompress(WebP, maxTexSize)` → `draco()`. Nécessite `gltf-transform`, `draco3dgltf`, `sharp` (déjà en devDependencies).
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
### Catalogues = source de vérité statique
Le contenu de jeu vit dans des objets/maps TS, pas en base : `classes/classes.ts`, `elements/elements.ts`, `spells/spellCatalog.ts`, `loot/LootRegistry.ts` (+ `SHOP_CATALOG` dans `Inventory.ts`), `npc/npcCatalog.ts` & `merchants.ts`, `runtime/vehicles/vehicleCatalog.ts`, `loaders/assetManifest.ts` (maps, PNJ, armes, tenues).

### Où trouver un asset (208 packs, 250 Go)
`public/models/CATALOG.md` indexe **tout** par catégorie ET par thème — c'est le point d'entrée, pas un `ls`. Version machine : `src/data/asset-catalog.json`. Regénérer après tout ajout : `npm run assets:catalog`. Taxonomie et placement : `scripts/lib/asset-taxonomy.mjs`.

⚠️ **Ne jamais renommer un dossier de premier niveau de `public/models/`.** 87 chemins sont codés en dur dans `src/` (`/models/vehicule/` ×29, `/models/Maps/` ×15, `/models/nature/` ×14…). Ce sont des chaînes : `tsc` ne verra jamais la rupture, et le fallback SPA de Vite renvoie du `text/html` en 200 au lieu d'un 404. Un pack vit dans **un seul** dossier (son type dominant) et porte **plusieurs tags** dans le catalogue — les thèmes recoupent les types, les ranger deux fois obligerait à dupliquer des dizaines de Go.

Analyse des plugins Unreal et de ce qui est portable dans le moteur : `docs/PLUGINS_CPP.md`.

### Sous-systèmes notables
- `runtime/vehicles/` : vaisseaux pilotables (PV, explosion, réparation), invoqués via clés consommables, marchand "Garagiste". `ShipController` injecté avec `applyVehicleDef()`.
- `runtime/space/` + `SpaceEnvironment.tsx` : hub orbital, combat spatial, univers infini (pas de barrière physique).
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
## Port nanos world (`WebPortal/Server/nanos_world/`)

⚠ **Deuxième runtime vivant, absent de ce fichier jusqu'au 2026-09-04.** Le jeu
est aussi porté sur **nanos world** — client Unreal 5.7 shipping + packages
**Lua 5.4** + pages **WebUI** (HTML/JS). Rien à voir avec React : même univers,
autre moteur.

```
WebPortal/Server/nanos_world/packages/
  narvos/Shared/       Catalogs/ (GÉNÉRÉS) + Logic/ (écrit à la main)
  narvos-map-proto/    Server/ (session, spawn, vestiaire) + Client/ (relais, WebUI)
WebPortal/Server/adk/  NanosWorldADK.uproject — l'éditeur qui cuit les assets
WebPortal/Server/Assets/narvos/Assets.toml   manifeste du pack cuit (GÉNÉRÉ)
```

**Les catalogues sont générés, la logique non.** 22 générateurs
`scripts/narvos-*.mjs` produisent `Shared/Catalogs/*.lua`. Ne jamais éditer un
catalogue à la main : le prochain `--apply` l'écrase.

```bash
node scripts/lua-harness/syntaxe-check.mjs          # Lua + les 43 .mjs
node scripts/lua-harness/portee-check.mjs           # emploi avant déclaration
node scripts/lua-harness/schema-check.mjs           # CREATE vs ALTER
node scripts/narvos-verifier-catalogues.mjs         # références ET types d'assets
node scripts/lua-harness/apparence.mjs              # un harnais (15 au total, 881 assertions)
```

Documentation complète : **skill `nanos-world`** (`.claude/skills/nanos-world/`).
L'invoquer AVANT tout code Lua nanos ou toute modification sous
`WebPortal/Server/nanos_world/`. État de session : `.hermes/RAPPORT_PROJET_*.md`.

## Base de données (Electron)
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
## Pièges connus

- **TDZ dans RpgGameWorld** : composant monolithique où les `useEffect` (listeners clavier) référencent des `useCallback` déclarés plus bas → `ReferenceError`. Solution établie : pattern **ref** (`const fooRef = useRef(...); fooRef.current?.()` dans le listener, assigné après la déclaration du callback). Plusieurs instances existent (`quickHealRef`, `pushToastRef`, `useSlotRef`…).
- **Audio Vite SPA fallback** : un fichier manquant renvoie du `text/html` (200) au lieu d'un 404. Toujours vérifier le `Content-Type` avant de traiter une réponse comme un asset (cf. `assetExists` et `AudioManager`).
- **SSR / tests** : garder `if (typeof document === "undefined") return;` dans le code qui touche le DOM au module-load (ex: `AudioManager`), sinon les tests vitest (env `node`) crashent.
- Fichiers `*.bak` (ex: `RpgGameWorld.tsx.bak`, `vite.config.ts.bak`) = sauvegardes mortes. Ne pas éditer, ne pas s'y fier — le `.tsx.bak` est une version ANTÉRIEURE et divergente.
- Pas de Cursor/Copilot rules dans le repo. Pas de linter configuré (pas d'ESLint script) — la barrière qualité est `tsc`.
- **Backtick dans un template literal de générateur** : les `scripts/*.mjs` fabriquent du Lua par interpolation. Un backtick dans le texte généré termine la chaîne et casse le script — arrivé **quatre fois** le 2026-09-04. Symptôme trompeur : `--apply` échoue, mais si sa sortie est masquée on croit avoir régénéré le catalogue alors qu'on relit l'ancien. Garde-fou : `node scripts/lua-harness/syntaxe-check.mjs` (43 fichiers). **Ne jamais masquer la sortie d'un `--apply`.**
- **Une liste de clés recopiée diverge toujours de sa source.** `Roster.EncoderCouleurs` itérait `{skin, hair, jacket}` écrit en dur ; les vraies cibles s'appellent autrement, la fonction rendait une chaîne **vide** et les couleurs partaient en base effacées, sans le moindre signal. Itérer le catalogue, jamais une copie.
  - **Récidive mesurée le 2026-09-10**, côté Lua nanos : `narvos-map-proto/Server/Index.lua` déclarait les mondes chargés par `ipairs({ "orbital", "tower", "alien" })`, liste écrite quand il y avait quatre mondes. La capitale et la forêt, ajoutées le 09/09, n'y étaient pas : **7 portails posés sur 10** au premier lancement. Aucun signal — `MondePraticable` n'avait refusé personne (`Portail non posé` : 0 occurrence), le diagnostic annonçait les 4 passages « ouvert », zéro erreur Lua. La boucle n'était pas atteinte. Corrigé en itérant `Mondes.MONDES` filtré sur la **propriété** (`niveau` non vide ou `decor_persistant`) — `Index.lua:2367`.
  - **Le garde qui ferme la forme** : `node scripts/lua-harness/listes-recopiees-check.mjs`. Il refuse tout littéral de chaînes dont **tous** les éléments sont des clés d'un catalogue surveillé — c'est la définition d'une copie. Il ne vérifie pas qu'une copie est *complète* : une copie complète aujourd'hui est périmée demain, et c'est exactement le mode d'échec. Il a trouvé une **seconde** occurrence dans le même fichier (`ipairs({ "tower", "alien" })` doublant les clés de `PEUPLEMENT_PAR_MONDE`, `Index.lua:2419`) que la recherche manuelle avait manquée. Ajouter un catalogue à sa surveillance coûte trois lignes.
- **Une valeur morte gardée « au cas où » n'est pas neutre.** `COULEURS_DEFAUT` ne pilotait rien pendant des mois ; le jour où les couleurs ont été branchées, elle a pris la place du choix du joueur. Supprimer, pas conserver.
- **Un garde-fou doit filtrer sur la FORME du défaut, pas sur le LIEU du premier incident.** Le `node --check` ne couvrait que `narvos-*.mjs` ; la récidive est arrivée dans les harnais, et le contrôle en place n'a rien vu.
- **Une clé `narvos::X_3` n'est pas un NOM, c'est un RANG.** `nanos-build-asset-pack.mjs` suffixe les homonymes (`SK_Mannequin`, `_2`, `_3`…) dans l'ordre des dossiers sous `Narvos/`. Promouvoir un pack qui trie AVANT décale tout d'un cran : la clé existe toujours, tous les contrôles d'existence restent verts, et elle désigne un AUTRE asset. Mesuré le 2026-09-13 : la promotion de Farming a fait publier le mannequin de WW100IdleAnimPack « Infectée 4 » dans le menu des monstres (règle `SK_Mannequin_Female_[4-7]`), et `SKM_Manny_3` — le porteur de TOUS les corps MetaHuman — était écrit en dur à deux endroits. Règles : un générateur choisit par CHEMIN, jamais par suffixe (`narvos-spawnables-to-lua.mjs`, `narvos-modular-to-lua.mjs` `CHEMIN_PORTEUR`) ; une clé citée à la main est gardée par le **verrou d'identité** de `narvos-verifier-catalogues.mjs` (`adk/_manifests/cles-citees.lock.json`, clé → chemin ; `--reverrouiller` pour accepter un changement voulu). Les catalogues régénérés par la chaîne de cook (`REGENERES_PAR_LA_CHAINE`, sept au 2026-09-13 : Spawnables, PropsNarvos, Animations, ObjetsHyper, Modular, ObjetsDivers, Minimap) sont hors verrou — leurs générateurs DOIVENT tourner après chaque reconstruction du pack (`narvos-chaine-cook.sh` et les scripts de lot).

- **Contenu de PLUGIN cité par le pack = copie du CLIENT, pas la nôtre.** Mesuré le 2026-09-13 : 15 500 paquets cuits citaient `/InterchangeAssets/` (instances glTF) ; le client nanos a sa copie d'origine du plugin, notre `M_Default` modifié ne l'était pas chez lui → la Forge entière au damier. Correctif : copie sous `Content/Narvos/Interchange` + `PackageRedirects`. **Un redirect `MatchSubstring` dont la cible CONTIENT la source se réapplique à son résultat** (`/Game/Narvos/Game/Narvos/...`, 50 999 lignes « does not exist » en simple `Display`, cook arrêté). Gardes : `node scripts/narvos-dependances-moteur.mjs` (montages hors `/Game/ /Script/ /Engine/`) et `node scripts/lua-harness/redirects-idempotents-check.mjs`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
<!-- [FIN INCONNUE — la suite du fichier n'a jamais été lue dans sa dernière version] -->