# narvos-error-log

Journal des erreurs factuelles commises par tout agent sur NARVOS PRIME. Chaque entrée documente l'erreur, la réalité, la cause racine et la règle qui empêche la récidive.

**NE PAS EFFACER les entrées. Ajouter les nouvelles à la suite.**

---

### 2026-07-21 — Safety timeout 60s dans RpgGameWorld
- **Erreur** : « Safety timeout de 60 secondes dans RpgGameWorld L1044 »
- **Réalité** : Timeout de 30s dans `App.tsx:82` (pas RpgGameWorld, pas 60s, pas L1044)
- **Cause racine** : Citation de mémoire — l'agent a inventé le fichier, la ligne ET la durée
- **Règle ajoutée** : TOUJOURS vérifier par grep avant d'écrire un numéro de ligne, nom de fichier ou valeur

---

### 2026-07-21 — GPU reload = perte d'état classé CRIT
- **Erreur** : « GPU context lost → reload brutal → perte d'état classée CRIT »
- **Réalité** : Tous les stores (reputationStore, petStore, questStore, progressionStore, gameSettings, equippedWeaponStore, etc.) persistent en localStorage synchrone sur chaque mutation. Un `window.location.reload()` ne perd RIEN.
- **Cause racine** : Impact non vérifié — l'agent a supposé une perte sans vérifier le mécanisme de persistance
- **Règle ajoutée** : AVANT de classer un reload/crash comme « perte d'état », vérifier la persistance de tous les stores : `grep -rn "localStorage.setItem\|saveNow\|persistToStorage" src/rpg/`

---

### 2026-07-21 — PuzzleMap pas de retry
- **Erreur** : « PuzzleMap — pas de retry, chunks échoués sans notification »
- **Réalité** : Le retry existait déjà (lignes 162-167, `withTimeout` + 2e `loadAsync`). Il manquait seulement une notification eventBus, qui a été ajoutée.
- **Cause racine** : Lecture partielle du fichier — l'agent a cité quelques lignes sans lire le fichier en entier
- **Règle ajoutée** : TOUJOURS lire le fichier ENTIER avant de conclure « manquant ». Si >500 lignes, lire en 2 passes.

---

### 2026-07-21 — Test count 344/62
- **Erreur** : « 344 tests / 62 fichiers »
- **Réalité** : 411 tests / 65 fichiers (3 suites ajoutées la session précédente)
- **Cause racine** : Compteur mémorisé d'une session antérieure — pas de `npm test` frais
- **Règle ajoutée** : Compter les tests au moment du rapport avec `npm test 2>&1 | tail -5`

---

### 2026-07-21 — recordCollect pas implémenté
- **Erreur** : « recordCollect pas implémenté dans questStore.ts — aucune quête collect définie »
- **Réalité** : `recordCollect` existe et fonctionne à `questStore.ts:142`. Seul le catalogue (`questCatalog.ts`) n'a pas de quête collect.
- **Cause racine** : Conclusion sans grep — l'agent a écrit « pas implémenté » sans vérifier le fichier
- **Règle ajoutée** : Grep le pattern AVANT d'écrire « pas implémenté » / « manquant »

---

### 2026-07-21 — 412 fichiers rpg/
- **Erreur** : « 412 fichiers TS/TSX (rpg/) »
- **Réalité** : 421 fichiers (vérifié par `find` et `Get-ChildItem`)
- **Cause racine** : Compteur mémorisé — pas de commande de vérification
- **Règle ajoutée** : Compter fichiers et LOC par commande au moment du rapport, pas de mémoire

---

### 2026-07-21 — ~47k LOC
- **Erreur** : « ~47k Lignes de code » (rapport HTML)
- **Réalité** : ~44k LOC (PowerShell `Measure-Object -Line`)
- **Cause racine** : Compteur estimé sans commande de vérification
- **Règle ajoutée** : Les compteurs (fichiers, LOC) se vérifient par commande. Si deux commandes donnent des résultats différents, comprendre pourquoi.

---

### 2026-07-21 — ~24k LOC (sous-estimation par l'agent correcteur)
- **Erreur** : « 24,352 lignes de code » (agent correcteur dans son audit)
- **Réalité** : ~44k LOC. L'écart de 80% venait de l'utilisation de `find ... -exec cat + | wc -l` au lieu de `Get-ChildItem + Measure-Object -Line` qui compte différemment les lignes.
- **Cause racine** : Commande bash non compatible avec le format du projet (MSYS path mangling, exclusion implicite)
- **Règle ajoutée** : Utiliser PowerShell pour les métriques de fichiers sous Windows. Vérifier que la commande utilisée donne le même résultat que la commande de référence.

---

### 2026-07-21 — RpgGameWorld 3999 lignes
- **Erreur** : « RpgGameWorld.tsx 3999 lignes » (agent correcteur)
- **Réalité** : 3753 lignes (PowerShell `Measure-Object -Line`)
- **Cause racine** : `wc -l` sous MSYS/bash et PowerShell comptent différemment les fins de ligne
- **Règle ajoutée** : Pour les tailles de fichiers, utiliser PowerShell `Measure-Object -Line` qui est la référence du projet. `wc -l` peut donner un résultat différent selon le format de fin de ligne.

### 2026-07-21 — ShipFlightUI et AutoAttackSystem : compteurs gonflés
- **Erreur** : « ShipFlightUI.tsx 148 lignes, AutoAttackSystem.tsx 210 lignes »
- **Réalité** : ShipFlightUI = **132**, AutoAttackSystem = **170** (132 → 148 = +12%, 170 → 210 = +24%)
- **Cause racine** : Approximation au lieu de `Measure-Object -Line` après écriture. Les compteurs ont été mémorisés avant la sauvegarde finale (contenu allégé ensuite).
- **Règle ajoutée** : TOUJOURS mesurer les fichiers APRÈS l'écriture avec `Measure-Object -Line`, pas avant ni de mémoire. Les compteurs s'écrivent au moment du rapport, pas à la création.

### 2026-07-22 — forgeChunks.ts désynchronisé (32→8)
- **Erreur** : manifest `forgeChunks.ts` dit `length: 32`, disque a 8 chunks
- **Impact** : PuzzleMap timeout 10s × 24 chunks fantômes
- **Cause racine** : re-génération des assets sans update du manifest TS
- **Règle ajoutée** : après re-génération d'assets, synchroniser le manifest correspondant

### 2026-07-22 — Diagnostic loading 88% : erreur de priorité (lock vs completion)
- **Erreur de diagnostic** : J'ai traité le symptôme (loading figé → forcer complete) au lieu de la cause (loadBusy lock dans processLoadQueue)
- **Réalité** : Le deadlock venait de `loadBusyRef.current` qui restait `true` parce que `processLoadQueue` n'avait pas de try/catch. Une ligne pré-try qui throw (setStatus/qualityVariant sur context perdu) → loadBusy jamais reset → plus aucun chunk chargé
- **Fix correct** : try/catch/finally dans processLoadQueue (finally reset loadBusyRef) + code pré-try déplacé dans le try + soupape 30s
- **Leçon** : Quand un système est bloqué, chercher le MÉCANISME DE VERROUILLAGE (loadBusyRef, lock, mutex) en premier. Ne pas traiter le symptôme sans comprendre pourquoi le lock n'est pas libéré.

### 2026-07-21 — electron:rebuild cassé (binaire introuvable)
- **Erreur** : `npm run electron:dev` → `'electron-rebuild' n'est pas reconnu`
- **Réalité** : `@electron/rebuild@4.0.1` est installé mais n'a PAS de binaire dans `node_modules/.bin/`. `npx @electron/rebuild` ne peut pas le trouver.
- **Fix** : Remplacer `npx @electron/rebuild` par `node node_modules/@electron/rebuild/lib/cli.js` dans `package.json`.
- **Règle ajoutée** : Vérifier que le binaire existe dans `.bin/` avant d'utiliser `npx <package>`.

---

### 2026-07-31 — Compteur de tests faux dans le rapport de session
- **Erreur** : `RAPPORT_PROJET_2026-07-31.md` annonce « 1685/1701 passent (16 pré-existants) »
- **Réalité** : `npm test` le même jour → **1664 passés / 1705, 41 en échec, 15 fichiers rouges**. Hors le fichier ajouté pendant le diagnostic : **40 échecs**, pas 16.
- **Cause racine** : compteur repris d'une session antérieure au lieu d'être re-mesuré — exactement ce que `narvos-preflight` case 4 interdit. La case existait ; elle n'a pas été appliquée.
- **Règle ajoutée** : un rapport qui cite un compteur DOIT contenir la sortie brute de `npm test 2>&1 | tail -5` collée. Sans la sortie, le chiffre est réputé faux.

### 2026-07-31 — CTRL toggle : 22 tests cassés, non détectés, déclarés « pré-existants »
- **Symptôme** : `CharacterController.wall.test.ts` → 22 échecs sur 26, tous `TypeError: input.consumeCrouch is not a function`
- **Cause racine** : le passage du crouch de « maintenu » à « toggle » a ajouté `consumeCrouch()` à `InputManager` et l'a appelé depuis `CharacterController.update()`. Les mocks d'input des tests n'exposent pas la méthode → toute la suite tombe. Le contrat d'entrée de `update()` a changé sans que ses appelants de test suivent.
- **Preuve** : `npx vitest run src/rpg/runtime/movement/CharacterController.wall.test.ts`
- **Non-impact runtime** : en jeu, `im` est un vrai `InputManager` qui possède la méthode. Le bug est de couverture, pas de production — mais il aveugle 26 tests de collision murale et de détection de sol.
- **Règle ajoutée** : élargir la signature d'un objet passé en paramètre (ajout d'une méthode appelée sans garde) est un **changement de contrat**. Grep les mocks avant de committer : `grep -rn "consumeJump\|consumeCrouch" src/**/*.test.ts`. Alternative sûre : appel optionnel `input.consumeCrouch?.()`.

### 2026-07-31 — Quatre correctifs à l'aveugle sur le P0 « TPS écran noir »
- **Erreur** : clamp pitch ±86°, `near: 0.3`, collision caméra désactivée, spawn forge `y=5 → y=-26` — appliqués successivement **sans diagnostic préalable**, aucun n'a changé le symptôme
- **Réalité** : trois sont restés dans le code, dont `resolveCameraPosition` mise en commentaire — une fonctionnalité perdue au profit d'une hypothèse fausse. Le rapport constate lui-même « fonctionnait puis cassé par changements agents » : les correctifs sont devenus la cause.
- **Cause racine** : aucune mesure entre deux tentatives. Chaque agent a supposé la cause au lieu de l'observer.
- **Règle ajoutée** : au 3ᵉ correctif sans effet sur le symptôme, **interdiction d'en écrire un 4ᵉ**. Retirer les correctifs sans effet, puis instrumenter — `window.__narvosTest.getState()` expose déjà `playerPos` et `cameraView`. Voir `train-hermes` règle A.

### 2026-07-31 — FpsCamera.ts : le fichier au cœur du P0 n'avait aucun test
- **Erreur** : la formule d'orbite TPS était réputée couverte parce que `camera/cameraPose.test.ts` existe
- **Réalité** : `cameraPose.ts` porte la même formule **mais n'est pas ce que le runtime appelle**. `PlayerRig` appelle `movement/FpsCamera.ts`, qui n'avait **zéro test**. Duplication non testée = divergence en attente.
- **Preuve** : `grep -rn "from.*FpsCamera" src/rpg` → `PlayerRig.tsx`
- **Ce que le test a révélé** (`FpsCamera.tps.test.ts`) : la math d'orbite est saine (position finie, distance correcte, bien derrière la tête), mais `tpsSmoothed` **verrouille un NaN à vie** — `NaN.lerp(valide)` reste `NaN`. Une seule frame polluée = caméra NaN = tout culled par Three.js = noir absolu avec HUD DOM intact. Le FPS y échappe car il réécrit `cam.position.set(...)` chaque frame.
- **Règle ajoutée** : tout état lissé entre frames (`lerp`, `damp`, moyenne glissante) doit valider son entrée et se réinitialiser si sa valeur devient non-finie. `Math.max`/`Math.min`/`THREE.MathUtils.clamp` **ne filtrent pas** le NaN : `Math.max(1.5, Math.min(12, NaN)) === NaN`.

### 2026-07-31 — RÉSOLU : P0 « TPS écran noir » — une borne de confort autorisait la traversée
- **Symptôme** : en 3ᵉ personne, écran noir total, HUD intact. En FPS, tout marche.
- **Fausses pistes éliminées par mesure** (sonde `tpsBlackScreenProbe`, 0 déclenchement sur 180 frames) : NaN caméra, échelle perso aberrante, système d'animation de locomotion.
- **Cause racine** : `CollisionWorld.resolveCameraPosition:218` faisait
  `Math.max(minDist, hits[0].distance - padding)`. `minDist` est une borne de **confort** (ne pas coller à la tête) ; en `Math.max` elle l'emporte sur le point d'impact. Un agent l'ayant monté de `0.84` à `2.0`, et le sol étant touché à 1,16 m sous la tête, la fonction renvoyait 2,0 : **l'anti-clip poussait lui-même la caméra à travers le sol**.
- **Aggravation** : constatant que « la collision pousse la caméra dans le terrain », l'agent suivant a **désactivé l'anti-clip** au lieu de corriger `minDist`. La caméra est alors partie librement à d = 4 m sous la roche.
- **Preuve chiffrée** : au spawn forge (sol y = −26), caméra à **y = −28,83**, soit 2,83 m dans le sol, **dès 16,8° de regard vers le haut** — seuil = `asin(eyeHeight / tpsDistance)` = `asin(1.155 / 4)`.
- **Correctif** :
  1. `CollisionWorld.ts` — le point d'impact devient une contrainte dure : `safe = max(CAMERA_MIN_CLEARANCE, blocked)`. `minDist` ne sert plus de plancher.
  2. `FpsCamera.ts` — anti-clip réactivé, `minDist` remis à `max(0.4, 1.2·scale)`.
  3. `FpsCamera.ts` — **plancher sol indépendant du toggle** : `cameraCollisionStore` est OFF par défaut à la demande de l'utilisateur, mais « pas d'anti-clip mur » ne signifie pas « la caméra peut entrer dans le sol ».
  4. `FpsCamera.ts` — filet non-fini sur `tpsSmoothed` (défaut latent séparé).
- **Couverture** : `FpsCamera.tps.test.ts` — 6 tests, dont un balayage −90°→+90° vérifiant que la caméra ne passe jamais sous les pieds.
- **Règle ajoutée** : une borne de **confort** doit toujours CÉDER à une contrainte **physique**. Écrire `Math.max(confort, géométrie)` donne le dernier mot au confort — c'est-à-dire au côté qui traverse. Calculer d'abord la limite imposée par la géométrie, puis loger le confort dans ce qui reste.
- **Règle ajoutée** : quand un correctif ne change pas le symptôme, le **retirer** avant d'en essayer un autre. Ici quatre correctifs empilés (clamp pitch, `near`, anti-clip coupé, spawn déplacé) ont transformé un réglage erroné en panne durable, et le rapport a fini par constater « fonctionnait puis cassé par changements agents ».

### 2026-07-31 — Combo de poings câblé de bout en bout, mais aucun clip chargé
- **Symptôme** : clic gauche à mains nues → les dégâts partent, le personnage ne bouge pas. Se lit comme « les coups font mal mais il ne frappe pas ».
- **Cause racine** : la chaîne est complète (`mouseup` → `advanceCombo` → `oneShotAction` + `oneShotToken` → `play(action)`), mais `UNARMED_PACK` n'était **dans aucune liste de jobs** du renderer réellement monté (`OwnAnimPlayerCharacter`, lignes 639-655). Le seul consommateur du pack était `HumanCharacter` — le Sorcier legacy, jamais monté.
- **Ce qui a masqué la panne** : `ACTION_FALLBACK` n'a aucune entrée pour `punch*`/`kick`, donc `resolveAction` retombe sur `idle`, et le filet de secours d'`AnimationController` mappe `idle` sur `clips[0]`. Résultat : **ni erreur, ni avertissement** — le perso rejoue son idle. Le commentaire du fichier prévient lui-même que ce symptôme a déjà coûté trois cycles de correction.
- **Preuve** : `grep -rn UNARMED_PACK src/rpg` → 3 sites seulement (déclaration, `HumanCharacter`, préchargement `bootAssets`). Aucun dans le renderer joueur.
- **Piège associé** : `bootAssets.ts` précharge `UNARMED_PACK` en HTTP. **Précharger n'injecte rien dans le mixer** — le cache réseau est chaud, le personnage reste sans clip. Une ligne de préchargement donne l'illusion que le pack est branché.
- **Correctif** : `...firstPerAction(UNARMED_PACK)` ajouté à la liste de jobs + pack allégé (cf. `narvos-mesh-pipeline`).
- **Règle ajoutée** : un filet de secours qui substitue silencieusement une action rend toute panne d'animation invisible. Quand une action attendue ne se résout pas, il faut un `console.warn` nommant l'action manquante — sinon le diagnostic part sur la logique de combat, qui elle fonctionne.

### 2026-07-31 — 22 Go dans le processus de rendu après quelques rechargements
- **Mesure** : `Get-Process electron` → un renderer à **22 153 Mo**, après une poignée de rechargements HMR successifs.
- **Effet observé** : `[StreamingPuzzleMap] chunk 1 CHARGÉ en 14414ms · 73 MB VRAM · 1/8 résidents` — 14 s pour UN chunk sur 8, soit ~2 min pour une map déjà en cache IndexedDB.
- **Lien** : cohérent avec le bug P1 déjà listé (« colliders 71→1538, VRAM non libérée »), mais l'ampleur est bien supérieure à ce qui était noté.
- **Règle ajoutée** : ne pas juger une lenteur de chargement sans relever d'abord la RAM du renderer. Une session de développement avec plusieurs HMR n'est PAS représentative — mesurer sur un lancement propre, sinon on optimise un symptôme de fuite.

### 2026-07-31 — Marche accroupie : le poids des diagonales partait à la poubelle
- **Symptôme** (rapporté par l'utilisateur) : « l'animation accroupie vers l'avant suit mal la direction, pareil pour la droite ».
- **Cause racine** : `solveLocomotion` raisonne sur **8 directions** (un cran tous les 45°), mais `CROUCH_LOCOMOTION` ne fournit que **4 clips** (forward/back/left/right). `setLocomotionBlend` construisait la clé `crouchwalk_forwardRight`, qui ne correspond à aucune action : le poids était **perdu**, pas redistribué. Le personnage se déplaçait donc dans une direction que son animation ne montrait pas.
- **Cause aggravante** : la fonction ne fabriquait de toute façon QUE des clés `walk_<dir>` / `run_<dir>` (`AnimationController.ts:797-798`). Les clips `crouchwalk_*` étaient chargés et enregistrés dans `locoActions`, mais restaient à poids 0 en permanence — c'est la couche additive qui déformait une marche debout.
- **Preuve** : `CROUCH_LOCOMOTION` = 4 entrées (`avatarAssets.ts:139-144`) ; `ORDER` = 8 directions (`locomotionBlend.ts:37-40`).
- **Correctif** : branche `crouchwalk` dans `setLocomotionBlend` + table `CROUCH_FALLBACK` qui répartit chaque diagonale à parts égales sur les deux cardinales voisines. Ajout du getter `hasCrouchwalkLocomotion`.
- **Bénéfice annexe** : élimine les 3 erreurs tsc pré-existantes d'`OwnAnimPlayerCharacter` (112 → 109). Elles n'étaient pas cosmétiques : elles signalaient exactement ce trou fonctionnel.
- **Règle ajoutée** : quand un solveur produit plus de cas que le jeu de clips n'en couvre, la clé manquante ne doit JAMAIS être silencieusement ignorée — le poids doit être redistribué. Un `Map.get()` qui renvoie `undefined` dans une table de poids est une perte d'énergie invisible, pas une absence d'effet.

### 2026-07-31 — Régression de perf introduite par le plancher caméra
- **Erreur commise** : le plancher sol ajouté dans `FpsCamera.applyTps` appelait `collisionWorld.getGroundY()` **à chaque frame**, sans condition.
- **Pourquoi c'est cher** : `getGroundY` utilise `firstHitOnly = false` sur `GROUND_SEARCH_DEPTH = 1000` (`CollisionWorld.ts:183`) — elle **collecte tous les impacts** au lieu de s'arrêter au premier. Le `CharacterController` en fait déjà une par frame : le total avait doublé.
- **Correctif** : ne lancer le raycast que si `target.y < pos.y + CLEARANCE`, c'est-à-dire uniquement quand l'orbite menace de passer sous les pieds (au-delà de ~17° de regard vers le haut). Le reste du temps, un test scalaire suffit.
- **Règle ajoutée** : avant d'ajouter un appel dans `useFrame`, lire le corps de la fonction appelée. Ici le nom `getGroundY` suggère un raycast unique ; le code fait une collecte exhaustive sur 1000 unités. Le coût d'une fonction ne se lit pas dans son nom.

### 2026-07-31 — SAUVEGARDE EMPOISONNÉE : un serveur injouable, l'autre non, même build
- **Symptôme** : écran noir persistant sur un serveur, jeu parfaitement fonctionnel sur l'autre. Mêmes fichiers, mêmes correctifs, même exécutable.
- **Cause racine** : la position de départ d'un personnage n'est PAS `MAP_SPAWN` — c'est sa **dernière position sauvegardée** (`RpgGameWorld.tsx`, initialisation de `playerPos` : `saved?.position ?? mapSpawn(mapId)`). Et `saveProgression` réécrit `position: playerPos.current`.
- **Boucle de rétroaction** : un personnage sauvegardé sous la carte y renaît → y retombe → s'y re-sauvegarde. Le bug d'origine (chute pendant le chargement) est corrigé, mais **sa trace persiste dans les données** et se réinjecte à chaque session. Corriger `MAP_SPAWN` ne débloque pas ces personnages : la valeur n'est jamais lue pour eux.
- **Preuve** : `[PlayerRig] monde prêt — 959 colliders, joueur posé à y=-228.79` avec les 8 chunks chargés, alors que l'emprise jouable plafonne à −51.
- **Correctifs, trois couches** :
  1. `/respawn` (admin) — cure immédiate pour un personnage déjà empoisonné ; le chat reste utilisable même écran noir.
  2. `saveNow` ne persiste la position que si `grounded` ; en l'air, il réécrit le dernier point au sol, à défaut le point d'apparition.
  3. `saveProgression` refuse toute position non finie ou au-delà de ±20 000, et conserve l'ancienne plutôt que d'écraser.
- **Règle ajoutée** : une différence de comportement entre deux jeux de DONNÉES sur un binaire identique **élimine le code d'emblée**. Avant de chercher un bug de rendu, tester avec un personnage neuf. J'ai passé plusieurs tours à chercher une cause de rendu alors que la même version marchait ailleurs — la question « ça marche sur un autre profil ? » vaut dix mesures et coûte une phrase.
- **Règle ajoutée** : un état persistant dérivé du runtime (position, inventaire, map courante) doit être **validé à l'écriture**, pas seulement à la lecture. Une donnée invalide écrite une fois se relit à chaque démarrage : le bug survit à la correction de sa cause.

### 2026-07-31 — Point d'apparition de la Forge hors de la carte
- **Symptôme** : joueur en écran noir au spawn, sous ~60 m de structure.
- **Mesure** (accesseurs `POSITION` des 8 GLB + offset `[181,−401,−47]`) : emprise monde `X[−2125,1238] Y[−536,475] Z[−736,2160]`, géométrie jouable plafonnant à **Y = −51**.
- **Cause racine** : `MAP_SPAWN.forge = [0, -26, 10]` faux sur les DEUX axes — Y au-dessus de toute la map, XZ hors de 5 chunks sur 8. Deux corrections successives à l'aveugle (5 → −26) l'avaient laissé faux.
- **Correctif** : `[-444, -60, 712]` (centre de l'emprise mesurée) + avertissement au démarrage si `MAP_SPAWN` s'écarte du sol mesuré de plus de 20 m.
- **Règle ajoutée** : un filet de rattrapage qui ne dit pas qu'il a rattrapé transforme un bug bruyant en bug silencieux. Le recalage au sol masquait l'erreur — quelle que soit la valeur de `MAP_SPAWN`, le joueur finissait posé quelque part, donc plus rien ne signalait qu'elle était absurde.

### 2026-07-31 — NavMesh : « async » n'est pas un thread
- **Symptôme** : gels de ~1,8 s au moment précis où le joueur prend la main.
- **Cause racine** : `bakeNavMeshFromScene` portait le commentaire « asynchrone et NE DOIT PAS retarder l'affichage », mais `async` en JavaScript donne une **promesse, pas un thread**. Il rendait la main toutes les 16 rangées — 12 fois pour 197.
- **Arithmétique** : 22 395 ms / 197 rangées ≈ 114 ms par rangée → ~1,8 s de blocage entre deux respirations.
- **Correctif** : budget de temps (6 ms) au niveau **cellule**. Le test au niveau rangée ne suffit pas — une rangée coûte déjà 114 ms.
- **Règle ajoutée** : une granularité de découpage exprimée en *unités de travail* (rangées, éléments, lots) est toujours fausse quelque part, car le coût unitaire dépend de la scène. Exprimée en *millisecondes*, elle s'adapte seule.

### 2026-07-31 — Un GLB manquant détruit tout le monde 3D
- **Symptôme** : `Uncaught Error: Could not load /models/armes/weapon/Sci_fi/FBX/Gun_Pistol.glb: Unexpected token '<', "<!DOCTYPE "... is not valid JSON` → `[CanvasErrorBoundary] Crash 3D`.
- **Cause racine** : le chemin comportait un segment `weapon/` de trop. Le fichier existe, à `/models/armes/Sci_fi/FBX/Gun_Pistol.glb`.
- **Pourquoi ça CRASHE au lieu de 404** : le fallback SPA de Vite renvoie `index.html` en **200** avec `Content-Type: text/html`. Le loader GLTF reçoit du HTML et tente de le parser → exception non rattrapée → l'ErrorBoundary démonte le Canvas ENTIER. C'est le piège déjà documenté dans `CLAUDE.md` pour l'audio, qui vaut identiquement pour les GLB.
- **Gravité** : la commande `/give arch_gun` suffisait à détruire la partie.
- **Audit fait** : 7 profils de `weaponProfiles.json` vérifiés sur disque, 1 seul cassé. Corrigé.
- **Règle ajoutée** : après toute modification de chemin d'asset, **vérifier l'existence sur disque**, jamais seulement la cohérence apparente. Un chemin d'asset est une chaîne : `tsc` ne le voit pas, et le serveur de dev répond 200 à un fichier absent. Commande d'audit :
  ```bash
  node -e "const fs=require('fs');const j=require('./src/rpg/weapons/weaponProfiles.json');
  for(const p of Object.values(j)) console.log((fs.existsSync('public'+p.path)?'OK':'MANQUE'), p.id, p.path)"
  ```
- **Règle ajoutée** : une correction de chemin précédente (« Armes GLB 404 », `assets_character` → `armes/weapon`) avait été appliquée en masse et déclarée résolue sans vérification fichier par fichier. Un remplacement global de préfixe doit être suivi d'un audit d'existence, sinon il déplace le problème au lieu de le résoudre.

### 2026-07-31 — « idle » replié sur un coup de poing
- **Symptôme** : `[AnimCtrl] AUCUN clip "idle" résolu → repli sur "punch1"` pendant le chargement.
- **Cause racine** : les clips sont publiés par paliers, dans l'ordre où le RÉSEAU les termine — pas dans l'ordre du catalogue. Après le dégraissage des packs (§ `narvos-mesh-pipeline`), les clips de poing pèsent 0,83 Mo contre plusieurs Mo pour la locomotion : ils arrivent donc **en premier**, et le filet `clips[0]` mappait `idle` sur `punch1`.
- **Correctif** : le repli choisit le premier clip qui n'est PAS une frappe (croisement avec `ONE_SHOT` + garde par motif de nom).
- **Règle ajoutée** : un repli qui prend « le premier élément » suppose un ordre. Dès qu'un chargement est parallèle, cet ordre est celui des tailles de fichier, pas celui du code. Rendre un asset plus léger peut donc changer le comportement d'un repli — effet de bord invisible d'une optimisation.

### 2026-07-31 — Mon propre message de diagnostic désignait le mauvais coupable
- **Symptôme** : `[PlayerRig] POINT D'APPARITION SUSPECT — MAP_SPAWN annonce y=161.8` alors que `MAP_SPAWN.forge` valait `−60`.
- **Cause racine** : la valeur lue vient de `playerPos`, initialisé à la **position sauvegardée** du personnage, et ne retombe sur `MAP_SPAWN` qu'à défaut de sauvegarde. Mon avertissement nommait la mauvaise source.
- **Effet** : il aurait envoyé le prochain débogage corriger `mapConfig.ts`, un fichier qui n'avait rien à se reprocher.
- **Règle ajoutée** : un message de diagnostic doit nommer la **variable lue**, pas la source qu'on suppose derrière. Un message faux coûte plus cher que pas de message : il oriente activement dans la mauvaise direction, avec l'autorité d'une mesure.

### 2026-08-02 — Une API Babylon.js dans le ragdoll : tout ragdoll levait dès la 1ʳᵉ frame
- **Symptôme** : `TypeError: parent.getWorldMatrix is not a function` à la première frame de simulation d'un ragdoll.
- **Cause racine** : `getWorldMatrix(cible)` **n'existe pas dans Three.js** — c'est l'API de Babylon.js. Three.js expose la matrice en `matrixWorld`. Comme la branche n'est prise que si l'os a un parent (donc toujours, sauf la racine), **aucun ragdoll ne pouvait fonctionner**.
- **Preuve** : `npx vitest run src/rpg/ragdoll/RagdollSystem.test.ts` → `RagdollInstance.applyToSkeleton` `RagdollSystem.ts:638`.
- **Correctif** : `RagdollSystem.applyToSkeleton` — `parent.updateWorldMatrix(true, false)` puis lecture de `parent.matrixWorld`. Allocations par os et par frame (3 objets Three.js × N os × 60 fps pendant les 5 s de TTL) hissées en scratch de module.
- **Règle** : une méthode d'un objet Three.js qui « sonne juste » mais n'est appelée nulle part ailleurs dans le repo mérite un `grep` dans `node_modules/three/src` avant d'être crue. Le mélange d'API entre moteurs 3D ne produit aucune erreur tsc quand la variable est typée `Object3D` mais consommée dynamiquement.

### 2026-08-02 — `warmupPool` pré-créait UN objet au lieu de N
- **Symptôme** : `expected 100 to be greater than or equal to 116` — après `warmupPool(16, 8, 8)`, le compteur d'allocations n'avait pas bougé.
- **Cause racine** : la boucle faisait `acquire()` puis `release()` **au même tour**. L'objet retournait au pool juste avant d'être redemandé : la boucle recyclait le même exemplaire N fois. Sur un pool froid, la réserve finale valait **1**.
- **Effet réel** : la fonction existe pour déplacer les allocations vers l'écran de chargement. Elle ne déplaçait rien — les allocations retombaient en pleine frame, exactement ce qu'on croyait avoir supprimé.
- **Correctif** : `ObjectPool.warmupPool` — tout emprunter d'abord (`Array.from({length: N}, acquire)`), tout rendre ensuite.
- **Règle** : un « préchauffage » de pool doit se vérifier sur la **taille de la réserve** (`size`), pas sur le compteur d'allocations (`created`) — `created` ne bouge que si le pool était à court, donc l'assertion passe ou échoue selon les tests exécutés avant. Le test correct : « N emprunts d'affilée n'allouent rien ».

### 2026-08-02 — Écriture sur une propriété en lecture seule : `activateOnly` levait en production
- **Symptôme** : `TypeError: Cannot set property active of #<MappingContext> which has only a getter`.
- **Cause racine** : `MappingContext.active` est un getter seul (l'état vit dans `_active`, muté par `activate()`/`deactivate()`). `MappingContextManager.activateOnly` y affectait directement. Les modules ES étant toujours en mode strict, l'affectation **lève** au lieu d'être ignorée silencieusement.
- **Impact** : tout changement de contexte d'input passant par `activateOnly` (jeu ↔ menu ↔ dialogue) plantait.
- **Correctif** : `MappingContext.ts` — `activateOnly` passe par `activate()`/`deactivate()`.
- **Règle** : quand une classe expose un getter ET des mutateurs nommés, tout code interne doit passer par les mutateurs. Un `ctx.active = x` compile (TS voit la propriété) et ne casse qu'à l'exécution.

### 2026-08-02 — Zone morte : division par zéro jusque dans la vélocité du joueur
- **Symptôme** : `expected Infinity to be 1` sur `applyDeadZone3D`.
- **Cause racine** : `(mag - threshold) / (1 - threshold)`. Avec `threshold = 1`, le dénominateur vaut **zéro**. Aucune borne non plus sur la magnitude d'entrée : un axe brut non normalisé ressortait amplifié au lieu d'être saturé.
- **Gravité** : c'est le même motif que le NaN caméra du 31/07 — un `Infinity` injecté dans une position suffit à faire culler toute la scène par Three.js.
- **Correctif** : `InputModifiers.ts` — helper `remapAboveDeadZone` : seuil clampé à [0,1], dénominateur planché à 1e-6, sortie plafonnée à 1. Partagé par les variantes 1D/2D/3D.
- **Règle** : un seuil fourni par la configuration (donc modifiable par l'utilisateur, ici un slider de zone morte) qui apparaît au **dénominateur** doit être clampé à l'écriture de la formule, pas espéré valide. Test ajouté : balayage de seuils incluant `0`, `1`, `1.5` et `-1`, assertion `Number.isFinite`.

### 2026-08-02 — `needsUpdate` : une ligne qui ne fait rien et un test qui ne peut pas passer
- **Symptôme** : `expected undefined to be false` sur `clone.needsUpdate`.
- **Cause racine** : dans Three.js, `Material.needsUpdate` est un **setter sans getter**, dont le corps se réduit à `if (value === true) this.version++`. Donc : lui affecter `false` ne fait rien, et le relire rend toujours `undefined`. Le code posait `clone.needsUpdate = false` avec le commentaire « déjà compilé via le parent », le test l'assertait — les deux se trompaient sur le même malentendu.
- **Correctif** : `ShaderCache.cloneWithUniforms` — ligne retirée, commentaire expliquant que c'est le partage du source de shader qui fait réutiliser le programme WebGL. Test réécrit sur `vertexShader`/`fragmentShader`/`version`.
- **Règle** : une propriété d'API tierce qu'on écrit « pour être sûr » doit être vérifiée en lecture au moins une fois. Une assertion sur une propriété write-only ne teste rien et ne peut jamais devenir verte — elle finit classée « échec pré-existant ».

### 2026-08-02 — Le benchmark FPS exigeait un WebGLRenderer pour mesurer du temps
- **Symptôme** : `Benchmark.report()` rend `null` après 31 `tick()`.
- **Cause racine** : `tick()` commençait par `if (!this.gl) return`. Or FPS et temps de frame sont du **chronomètre pur** ; seuls les compteurs GPU (draw calls, triangles, VRAM) ont besoin du renderer. Le garde rendait tout le benchmark muet hors navigateur — y compris dans `src/rpg/benchmarks/*.bench.ts`, dont c'est la raison d'être.
- **Correctif** : `Benchmark.ts` — garde retiré de `tick()`, `_computeReport` ne bloque plus sur `gl`, compteurs GPU en `gl?.…?? 0`.
- **Bonus trouvé au passage** : `MonitoringService.start()` créait un `setInterval` **sans conserver son identifiant** — `stop()` arrêtait le RAF mais laissait le timer tourner à vie, et chaque cycle start/stop en empilait un de plus. Corrigé (`_exportTimer`).
- **Règle** : un garde « pas de renderer → je ne fais rien » doit être posé **au niveau de la mesure qui en dépend**, pas à l'entrée de la fonction. Placé trop tôt, il désactive aussi tout ce qui n'en avait pas besoin.

### 2026-08-02 — Un en-tête de rapport figé qui décrit la mauvaise colonne
- **Symptôme** : `expected '╔═…' to contain 'individual'`.
- **Cause racine** : `BatchProcessingProbe.formatReport(labelA, labelB)` reçoit les deux labels comparés, mais l'en-tête du tableau était écrit en dur `│ Individual │ Batch │`. Dès qu'on compare autre chose (deux variantes de LOD, deux tailles de lot), le rapport annonce des colonnes qui ne sont pas celles mesurées.
- **Correctif** : `BatchSystem.ts:167` — en-tête tiré de `labelA`/`labelB`, largeurs alignées sur les lignes de données.
- **Règle** : un rapport de mesure qui affiche un libellé constant alors qu'il reçoit le libellé en paramètre est un **faux témoignage**. C'est la même famille que « mon message de diagnostic désignait le mauvais coupable » (31/07) : plus le rapport a l'air soigné, plus il oriente loin.

### 2026-08-02 — Trois pannes de tests dues à un état PARTAGÉ, pas au code testé
- **Symptôme** : trois suites rouges pour trois raisons sans rapport avec leur sujet.
  1. `DisposeTracker` — le test précédent appelait `uninstallDisposeTracker()`, ce qui **rend son `dispose` d'origine à `THREE.Texture.prototype`**. Le test suivant comptait des `dispose()` que plus personne n'interceptait. Panne d'**ordre** via un prototype global.
  2. `dialogueBridge` — `require("../../runtime/core/EventBus")` dans une suite ESM sous Vite : le résolveur CommonJS ignore les chemins de Vite → `Cannot find module`. Le module EXISTE.
  3. `monitoring.test.ts` — importait `../rpg/monitoring/MonitoringService` depuis `src/rpg/monitoring/`, soit `src/rpg/rpg/monitoring/…`. Chemins hérités d'un emplacement `src/tests/` où le fichier n'a jamais été déposé.
- **Ce qui a masqué (2) et (3)** : un fichier qui ne se charge pas est rapporté **« (0 test) »**. Ça se lit comme « suite vide, rien à voir », pas comme « suite cassée ». 18 tests étaient invisibles depuis leur écriture.
- **Correctifs** : réinstallation explicite du tracker dans le test concerné ; import statique du module mocké (`vi.mock` est hoisté, l'import reçoit bien le mock) + `vi.clearAllMocks()` en `beforeEach` car `vitest.config.ts` n'active pas `clearMocks` ; chemins en `./`.
- **Règle** : dans le rapport vitest, **« (0 test) » est un ÉCHEC, pas un vide**. Le vérifier explicitement : `npm test 2>&1 | Select-String "\(0 test\)"`.
- **Règle** : un test qui monkey-patche un prototype global (`THREE.Texture.prototype.dispose`) doit restaurer **et** réinstaller dans un `beforeEach`, jamais compter sur l'état laissé par le test précédent. `globals: false` dans `vitest.config.ts` signifie aussi **pas de `clearMocks` automatique**.

### 2026-08-02 — `sharp` cassé par un fichier « .DELETE » orphelin, pas par le code
- **Symptôme** : `scripts/lib/ktx2-encode.test.mjs` → `(0 test)`, `ERR_DLOPEN_FAILED: Le module spécifié est introuvable`.
- **Cause racine** : `node_modules/@img/sharp-win32-x64/lib/` contenait `libvips-cpp-8.17.3.dll.DELETE.2b3d9c0fe99…` et **aucun** `libvips-cpp-8.17.3.dll`. npm renomme ainsi un fichier qu'il n'a pas pu supprimer (verrouillé par un process node en cours) — ici il a renommé sans jamais recopier.
- **Preuve** : même horodatage que `libvips-42.dll` (30/07 01:42:50) → même extraction, fichier d'origine intact (0,31 Mo).
- **Portée réelle** : ce n'était pas qu'un test. `sharp` est la dépendance de `scripts/puzzle-chunks.mjs` et `scripts/assets-to-ktx2.mjs` — **tout le pipeline d'assets était hors service sur cette machine**, sans que rien ne le signale.
- **Correctif** : renommage inverse (réversible, ne touche ni `package.json` ni le lock).
- **Règle** : un `ERR_DLOPEN_FAILED` se diagnostique en **listant le dossier `lib/` du paquet natif** avant toute réinstallation. Chercher les suffixes `.DELETE.<hash>` : ils indiquent un install interrompu, et la réponse est un renommage, pas un `npm install` qui peut en produire d'autres.
- **Règle** : quand un outil du pipeline d'assets casse, il ne le dit qu'au moment où on s'en sert. Sa suite de tests est le seul détecteur — d'où l'intérêt d'avoir inclus `scripts/**/*.test.mjs` dans `vitest.config.ts`.

### 2026-08-02 — 39 BINDINGS WASM FANTÔMES : le pont TS visait un moteur qui n'existe pas
- **Symptôme** : 50 des 109 erreurs tsc, toutes de la forme `Property 'X' does not exist on type 'NarvosWasmModule'`, réparties sur `MathWasm.ts` (28), `IKController.ts` (11), `NavMeshBenchmark.ts` (9), `WasmAnimationGraph.ts` (2).
- **Cause racine** : ces fichiers ont été écrits **en anticipation** de bindings C++ jamais implémentés. `Bindings.cpp` en déclare 118 ; **aucun** n'est un de ceux-là.
- **Preuve** (méthode à réutiliser — les noms embind vivent dans le `.wasm`, pas dans le `.js`) :
  ```powershell
  Select-String wasm/src/bridge/Bindings.cpp -Pattern 'function\("vec3Normalize'   # aucun résultat
  $b=[System.IO.File]::ReadAllBytes("public/wasm/narvos-engine.wasm")
  $t=[System.Text.Encoding]::ASCII.GetString($b)
  $t.Contains("vec3Normalize")   # False   ← alors que…
  $t.Contains("tickWorld")       # True    ← …les bindings réels, eux, sont là
  ```
- **Ce qui rendait la panne invisible** : `MathWasm.approach` — la SEULE méthode réellement appelée en production (`CharacterController`, chemin chaud, deux fois par frame) — avait été rustinée seule en `if (e && typeof (e as any).approach === 'function')`. Ce `as any` a **supprimé l'erreur tsc en même temps que le crash**. Plus d'erreur sur `approach` ⇒ plus personne ne regardait les 27 autres méthodes, restées en `if (e)`.
- **Gravité réelle** : le garde `if (e)` teste « moteur chargé », PAS « binding présent ». Dès que le WASM se charge (il l'est : `WasmWorldTicker` est monté dans `RpgGameWorld` depuis la phase 11), chaque appel lève `is not a function` — et le fallback JS écrit juste en dessous n'est jamais atteint. Le fichier annonçait « chaque opération a un fallback JS » ; le fallback était structurellement inaccessible.
- **Correctif** : bindings déclarés **optionnels** (`vec3Normalize?: (ptr: number) => void`) dans `NarvosWasmModule`, ce qui force le compilateur à exiger un garde ; 27 gardes convertis en `e?.nom`, appels IK en `?.()`. Le jour où le C++ les implémente, il suffit de retirer les `?`.
- **Règle** : `as any` sur un accès à une API externe ne « corrige » rien — il **débranche le seul détecteur**. Quand un membre manque, la question n'est jamais « comment faire taire tsc » mais « ce membre existe-t-il ? ». Ici la réponse tenait en une commande.
- **Règle** : un garde de disponibilité doit tester **exactement la chose utilisée**. « Le moteur est chargé » n'implique pas « ce binding existe » ; « le fichier existe » n'implique pas « il est valide ». Un garde trop large, c'est un `catch` vide qui s'ignore.
- **Règle** : quand un pont est écrit avant son moteur, le déclarer **optionnel**, jamais obligatoire. Un type qui ment sur ce qui existe transforme le compilateur — la seule barrière qualité du projet — en complice.

### 2026-08-02 — `export … from` ne crée aucune liaison locale
- **Symptôme** : 14 erreurs `TS2304: Cannot find name 'NpcDebugCategory'` (et 5 autres noms) dans `gameplayDebugger/index.ts`, un fichier qui les exporte pourtant tous.
- **Cause racine** : `export { X } from "./y"` est une **ré-exportation pure** — elle republie `X` pour les consommateurs du module mais ne l'introduit PAS dans la portée locale. `registerBuiltinCategories()`, dans ce même fichier, fait `new NpcDebugCategory()` et appelle `gameplayDebugger.register(...)` : aucun de ces noms n'y existait.
- **Correctif** : bloc d'`import` locaux en tête, à côté des ré-exports.
- **Règle** : un fichier baril (`index.ts`) qui contient aussi du CODE doit importer ce qu'il utilise. Ré-exporter n'est pas importer — et le message d'erreur (« nom introuvable » dans un fichier où le nom apparaît noir sur blanc) envoie chercher au mauvais endroit.
- **Bonus trouvé au passage** : 3 imports à `../../../` là où il fallait `../../../../` (le dossier `categories/` est à 4 niveaux de `src/rpg`), et un `require()` **dans une boucle** — donc à chaque quête active et à chaque rafraîchissement du debugger — dans un module ESM servi par Vite, où `require` n'existe pas. Même famille que le `require` de `dialogueBridge.test.ts` corrigé le matin même.

### 2026-08-02 — Un benchmark qui publiait des chiffres inventés
- **Symptôme** : `NavMeshBenchmark.ts` importait 9 symboles absents de `NavMeshBridge`.
- **Cause racine** : le fichier comparait un run « AVANT (sans cache) » à un run « APRÈS (avec cache) » et publiait un `cacheHitRate`… pour un cache de chemins qui n'existe **ni dans le pont TS, ni en C++, ni dans le binaire**. 243 lignes, zéro importateur.
- **Correctif** (arbitré avec l'utilisateur : élaguer plutôt que supprimer ou implémenter) : ne subsistent que les métriques adossées à des bindings réels — temps de requête, taux de succès, waypoints. Limite désormais écrite en tête du fichier : `requestPath` ne prend qu'une DESTINATION, le départ vient du `Transform` de l'entité — que les entités factices du benchmark n'ont pas. On mesure donc un coût de requête, pas une qualité de trajet.
- **Règle** : un outil de MESURE qui rapporte une métrique sur un système absent est plus nuisible qu'un outil manquant — il produit un chiffre que personne ne remettra en question. Avant d'écrire un benchmark, vérifier que chaque colonne du rapport a une source réelle.

### 2026-08-02 — A1 « crouchwalk diagonale figée » : la même information dérivée à DEUX endroits
- **Symptôme** : accroupi + W+D (ou toute diagonale) → les clips portent le bon poids mais restent sur leur première image. Le personnage glisse en statue.
- **Cause racine** : `setLocomotionBlend` calculait deux fois « quels clips jouent ». La **répartition des poids** passait par `CROUCH_FALLBACK` (l'accroupi n'a que 4 clips pour 8 directions, `crouchwalk_forwardRight` est éclaté sur `forward` + `right`). La recherche du **clip dominant**, elle, interrogeait la direction BRUTE : `locoActions.get("crouchwalk_forwardRight")` → `undefined` → `dominant = null` → `phase = 0`. Le bloc de recalage remet alors à `time = 0` tout clip « non dominant » — c'est-à-dire tous.
- **Pourquoi ça a survécu à un premier correctif** : le 31/07, la perte de poids sur les diagonales accroupies avait été corrigée (ajout de `CROUCH_FALLBACK`). **Un seul des deux consommateurs a été mis à jour.** Le bug a changé de symptôme — de « glisse dans une direction que l'animation ne montre pas » à « glisse en pose figée » — sans disparaître.
- **Preuve** : test avec l'ancien code → `expected 0.016666666666666666 to be greater than 0.5`. Le playhead plafonnait à UNE frame (le mixer avançait de `dt` juste après chaque remise à zéro) quel que soit le temps simulé.
- **Piège de rédaction du test** : dans une boucle `setLocomotionBlend()` puis `update(dt)`, une assertion `time > 0` PASSE même avec le bug, puisque le mixer avance d'une frame après le recalage. Il faut comparer le playhead au temps réellement SIMULÉ.
- **Correctif** : `AnimationController.setLocomotionBlend` — la table de poids par clip réel est construite EN PREMIER, le dominant s'y choisit. Le second chemin de dérivation disparaît. Couvert par `AnimationController.locomotion.test.ts` (6 tests).
- **Règle** : quand une table de correspondance traduit ce que demande un solveur vers ce que le jeu possède, **tout** consommateur doit passer par elle. Deux dérivations de la même information divergent au premier correctif partiel — et le second reste invisible parce que le symptôme, lui, a changé.

### 2026-08-02 — A2 « le bassin ne descend jamais » : mécanisme exact, conclusion fausse — et j'ai failli casser le jeu
- **Ce que l'audit affirme** : trois mécanismes suppriment la descente de bassin (remap qui droppe les `.position`, masque `legsOnly` qui exclut le bassin, clip accroupi qui porte sa descente dans une piste `.position`). Classé 🔴, « crouch structurellement cassé, pieds à travers le sol ».
- **Vérification** : les trois mécanismes sont **exacts**, vérifiés ligne à ligne. J'ai donc écrit un correctif — réinjection d'une descente de bassin après le remap, mise à l'échelle du rig — avec ses tests, et les tests passaient.
- **Ce que je n'avais pas vérifié** : que le personnage ne descend PAS en jeu. Il descend. `OwnAnimPlayerCharacter:327` applique `og.position.y -= CROUCH_PELVIS_DROP × baseScale × characterScale`.
- **Et ce report est exact, pas approximatif.** Mesure par cinématique directe sur `Anim_Crouch_Idle_Hip`, documentée en commentaire : bassin 0,968→0,595, genou 0,574→0,202, cheville 0,583→0,211, pointe 0,393→0,021. **Écart identique de 0,373 partout** : la pose se translate en bloc, donc un offset de groupe la reproduit exactement. Les rotations du clip plient les jambes, l'offset descend l'ensemble, les pieds retombent au sol.
- **Ce que mon correctif aurait produit** : 0,373 (groupe) + 0,22 × 0,968 (os) ≈ 0,586 au lieu de 0,373 — **+57 % de descente**, personnage enfoncé dans le sol. Correctif retiré.
- **Ce qui reste** : le commentaire de `boneMask.ts` était bel et bien faux (« ce sont les cuisses et les mollets qui abaissent le personnage » — non, `Hips` est le PARENT de la chaîne, fléchir les jambes remonte les pieds). Il porte désormais la vraie explication ET l'avertissement anti-double-comptage. `AnimationController.crouch.test.ts` verrouille la décision : il échoue si quelqu'un réinjecte une descente d'os.
- **Règle** : un audit peut être **exact sur le mécanisme et faux sur la conclusion**. Vérifier qu'un chemin est coupé ne dit rien sur l'existence d'un autre chemin. Avant de corriger un « X ne se produit jamais », chercher X ailleurs — ici un `grep -rn "CROUCH\|crouchDrop" src/rpg/characters/` suffisait.
- **Règle** : quand une valeur porte un commentaire de MESURE (quatre articulations, quatre chiffres, une méthode de re-mesure), ce commentaire est une preuve — le lire AVANT d'ajouter un mécanisme concurrent. Il était à 250 lignes du code que je modifiais.
- **Règle** : des tests qui passent ne valident que ce qu'ils regardent. Les miens vérifiaient que le bassin descendait ; aucun ne vérifiait de COMBIEN au total, seule quantité qui comptait.

### 2026-08-02 — A3 : les events d'attaque étaient cadencés par le cycle de marche
- **Symptôme** : recul de caméra et SFX d'attaque déclenchés à contretemps — parfois instantanément, parfois jamais.
- **Cause racine** : `playOverlay()` joue un clip upper-body qui vit dans `upperBodyActions` et **ne touche jamais `this.current`**. Deux déductions divergentes de la même chose en découlaient :
  * `armEvents(action)` calait le curseur sur `actions.get(action)` — l'action FULL-BODY du même nom, à l'arrêt ;
  * `update()` lisait le playhead de `actions.get(this.current)`, donc du clip d'idle ou de marche en cours.
- **Les deux faces du bug, mesurées par test** :
  * idle déjà à 50 % de son cycle → `norm = 0,5 > 0,30` dès la première frame → l'event part **immédiatement** ;
  * idle à 0 % (clip de 10 s) → il faudrait 3 s pour atteindre 30 %, l'attaque en dure 1 → l'event **ne part jamais**.
- **Correctif** : champ `eventAction` posé par `armEvents(action, act?)`, lu par `update()`. `playOverlay` passe explicitement son action upper-body. Désarmement à la fin de l'overlay (son action tourne encore pendant le fondu, et son playhead repasserait par 0). Couvert par `AnimationController.events.test.ts` (4 tests).
- **Règle** : dès qu'un système joue des clips sur PLUSIEURS couches (base, overlay, additif), « l'action courante » cesse d'être une notion unique. Mémoriser la référence dont on lit l'horloge, ne jamais la re-déduire au point de consommation.

### 2026-08-02 — A4 : un timeScale passé là où un framerate est attendu
- **Cause racine** : `THREE.AnimationUtils.makeClipAdditive(clip, referenceFrame, referenceClip, fps)` recevait `this.mixer.timeScale` (≈ 1) en 4ᵉ position. Le paramètre est un FRAMERATE, utilisé pour convertir `referenceFrame` en instant (`referenceFrame / fps`). Écart sémantique d'un facteur 30.
- **Pourquoi c'était invisible** : `referenceFrame` vaut 0, et 0/1 = 0/30 = 0. Le bug ne peut se manifester que le jour où quelqu'un prend la pose de référence ailleurs qu'à la première image — et il viserait alors un instant 30× trop loin, sans aucun signal.
- **Correctif** : argument retiré, le défaut (30) s'applique. Intention préservée : la référence est la première image d'`idle_uta`.
- **Règle** : un argument dont la valeur courante annule l'erreur reste une erreur. Le vérifier contre la SIGNATURE, pas contre le résultat observé.

### 2026-08-02 — A6 et A7 : RÉFUTÉS par le calcul (cul-de-sac documenté)
- **A6 annonçait** : « retour de saut en plein vol — idle joué en apesanteur entre la fin du clip de saut et le déclenchement de la chute ».
- **Mesure** : `MM_Jump.glb` dure **0,867 s** (lu dans le GLB via `@gltf-transform/core`). Le seuil `velocity.y < -1` est franchi à **(jumpVelocity 6,2 + 1) / gravity 22 = 0,327 s**. Quand le clip se termine, le joueur chute déjà depuis 0,54 s.
- **Second garde-fou ignoré par l'audit** : `OwnAnimPlayerCharacter` pose `busy = cur === "jump" || cur === "landing"` et **ne repilote rien** tant que le saut joue. Au pire subsiste une frame de 16 ms où un fondu vers idle est amorcé puis remplacé par `play("fall")`.
- **A7 annonçait** : « zone grise 0,2–0,3 m/s, l'additif crouch s'active sur un perso quasi immobile ».
- **Prédicat réel** : `useCrouchAdditive = (crouching || sliding) && !stationaryCrouch && !(crouching && hasCrouchwalkLocomotion)`. Avec le pack UTA chargé, `hasCrouchwalkLocomotion` est vrai → l'additif est désactivé quelle que soit la vitesse. La zone grise ne concerne que les personnages SANS clips crouchwalk, c'est-à-dire des PNJ qui ne s'accroupissent pas.
- **Règle** : un audit qui raisonne sur une constante isolée (`IDLE_SPEED`, seuils d'hystérésis) doit être confronté au PRÉDICAT COMPLET qui l'utilise. Ici deux conditions supplémentaires rendaient le conflit inatteignable.
- **Règle** : quand un audit compare une durée d'animation à un seuil physique, MESURER la durée du clip — elle est lisible hors runtime (`@gltf-transform/core`, déjà en devDependency). Sur A6, l'écart était d'un facteur 2,6 : aucune interprétation ne le rattrapait.

### 2026-08-02 — « build ✅ » ne voulait pas dire « application livrable »
- **Symptôme rapporté** : `npm run build` passe enfin — 13,5 s, 4 fichiers, 2,7 Mo, après le passage à `copyPublicDir: false`.
- **Réalité mesurée** : `dist/` contenait `index.html` + CSS + JS + worker, et **rien d'autre**. Ni modèles, ni textures, ni `/draco/`, ni `/basis/`, ni `/wasm/narvos-engine.{js,wasm}`. Or `package.json` → `build.files` vaut `["dist/**/*", "dist-electron/**/*.cjs", "package.json"]` : **aucun `extraResources`**. L'installeur n'aurait donc embarqué aucun asset.
- **Défaut plus ancien, découvert au passage** : `dist/index.html` référençait son propre bundle en chemin ABSOLU (`src="/assets/index-*.js"`). Electron charge la production par `loadFile()` → origine `file://` → `/assets/…` résout vers la RACINE DU DISQUE. Le packaging production n'avait donc jamais fonctionné, indépendamment des assets. Corrigé par `base: isDev ? '/' : './'`.
- **Correctifs** : `base` relatif en production ; plugin Vite `copyRuntimeDecoders` qui recopie `draco/` + `basis/` + `wasm/` (1,6 Mo au total) dans `dist/` — ce ne sont pas des assets de contenu mais des DÉCODEURS, sans lesquels chaque GLB échoue (« No DRACOLoader instance provided »).
- **Règle** : un build qui devient rapide en cessant de copier quelque chose doit être jugé sur son ARTEFACT, pas sur son code de sortie. Ici « 240 Go → 2,7 Mo » était présenté comme une victoire ; c'était la mesure exacte de ce qui manquait.
- **Règle** : vérifier qu'un `index.html` produit charge ses propres scripts avant de se demander s'il charge ses assets. Un `<script src="/…">` sous `file://` échoue avant tout le reste.

### 2026-08-02 — L'audit d'assets est aveugle aux chemins CONSTRUITS
- **Contexte** : pour livrer un sous-ensemble d'assets, `scripts/audit-runtime-assets.mjs` semblait la source évidente — il part du code et non du disque, ce qui est la bonne méthode.
- **Défaut** : ses expressions régulières excluent `$` et `{`. Elle ne voit donc **aucun chemin bâti par calcul**. Or c'est exactement ainsi que sont déclarés les chunks des deux maps qui comptent :
  * `forge` → `FORGE_CHUNKS = Array.from({length: 8}, …)` (`forgeChunks.ts`) — **raté** ;
  * `orbital` (**map de départ**) → `Array.from({length: 8}, …)` en ligne — **raté** ;
  * `donjon` → tableau de littéraux — capté.
- **Preuve chiffrée** : l'audit remonte **4** chemins contenant « chunk » ; `chunks_v3` seul en compte **25 (751,4 Mo)**, et `Orbital/chunks` **25 de plus (180,7 Mo)**.
- **Ce qu'un build curé naïf aurait produit** : un installeur où la map de départ ET la map principale ne chargent pas — sans erreur au build, sans test rouge, sans erreur tsc. Visible seulement une fois le jeu installé.
- **Parade** : ne pas tenter de résoudre les tableaux générés (indécidable en statique) mais s'appuyer sur `chunkDir`, que chaque map à chunks déclare à côté de son tableau, et embarquer le dossier entier. `scripts/stage-shippable-assets.mjs` **échoue** si une map construit ses chunks par calcul sans déclarer `chunkDir`.
- **Règle** : avant de bâtir quoi que ce soit sur la sortie d'un extracteur statique, chercher ce qu'il ne peut PAS voir. Ici la réponse tenait dans ses propres expressions régulières — `[^"'`${}\n]*` dit exactement qu'un chemin calculé lui échappe.
- **Règle** : un discriminant fiable vaut mieux qu'un compteur. Le premier garde-fou écrit comparait « nombre de `chunks:` » à « nombre de `chunkDir:` » et accusait à tort la map `donjon`, dont les littéraux sont pourtant couverts. Le bon test porte sur le premier caractère après `chunks:` — `[` = littéral (sûr), autre chose = calculé (à couvrir).

### 2026-08-02 — P4 « femme sans tête » : DEUX vérificateurs, deux erreurs opposées, tranché par la mesure
- **Chaîne des affirmations** :
  1. l'audit Forge dit « catalogue féminin incomplet : ni `head`, ni `arms`, ni `hands` » → correctif appliqué : `REQUIRED_SLOTS = ["body", "head"]` ;
  2. la contre-vérification signale que le correctif crée une contrainte **insatisfiable** côté femme (aucune pièce `head` au catalogue) ;
  3. j'ai confirmé ce point 2 et conclu « femme sans tête », en me fondant uniquement sur l'absence d'entrée `head` dans le catalogue ;
  4. Hermes a demandé une mesure avant d'arbitrer : et si `f_body` contenait déjà la tête ?
- **Mesure** (`@gltf-transform/core`, comptage des sommets dont un poids > 0,01 porte sur l'os `head`) :

  | mesh | sommets | `head` | « mains » |
  |---|---|---|---|
  | `m_body` | 17 306 | **43 %** | **15 %** |
  | `f_body` | 18 026 | **50 %** | **21 %** |
  | `m_head_01` | 8 053 | 93 % | 0 % |
  | `m_hands` | 2 801 | 0 % | 100 % |

- **Verdict** : les DEUX corps sont complets, tête et mains incluses. `m_body` porte ~7 450 sommets de tête, soit le compte de `m_head_01` lui-même. `head`/`hands`/`arms` sont des slots de **variante**, pas des pièces comblant une absence. Le trou n'a jamais existé — ni chez la femme, ni chez l'homme.
- **Correctif** : `REQUIRED_SLOTS = ["body"]`, avec le tableau de mesure inscrit dans le fichier.
- **Règle** : « la pièce X n'est pas au catalogue » ne prouve pas « X manque au personnage ». Un catalogue décrit ce qu'on peut CHANGER, pas ce qui est PRÉSENT. Vérifier dans la géométrie avant d'ajouter une contrainte.
- **Règle** : trois relectures successives — l'audit, la contre-vérification, la mienne — ont toutes conclu à un manque, chacune en s'appuyant sur la précédente. Aucune n'avait ouvert le GLB. Une chaîne de vérifications qui partagent la même source ne se renforce pas : elle propage l'erreur avec de plus en plus d'assurance.
- **Corollaire non tranché** : `defaultOutfit("male")` équipe `body` + `head_01` + `hands` alors que le corps porte déjà ces régions → géométrie superposée. Mesuré, pas constaté à l'écran — noté dans `bodySlots.ts`, à vérifier visuellement.

### 2026-08-02 — Le dash consommait l'endurance d'une capacité inexistante
- **Symptôme** : `PlayerRig.tsx:405-409`, commentaire « PLAYER P2 : consommation d'endurance pour le dash ».
- **Réalité** : `dashEnduranceSpent` et `dashStaminaCost` n'existaient nulle part ailleurs dans `src/` — ni sur `PlayerState`, ni sur `PLAYER_CONFIG`. Aucun code ne posait le drapeau : la condition était toujours fausse. Et le dash n'est pas implémenté du tout (`CharacterController.ts:8` le range en « extension future » ; `MoveState` déclare `"dash"` sans jamais l'assigner).
- **Ce qui l'a maintenu en vie** : `if ((s as any).dashEnduranceSpent && (C as any).dashStaminaCost)`. **Deux `as any` sur la même ligne.** Sans eux, `tsc` refusait les deux champs dès le premier jour.
- **Correctif** : bloc supprimé, avec la raison écrite à sa place.
- **Règle** (troisième occurrence du même motif aujourd'hui, après les 39 bindings WASM fantômes) : un `as any` sur un membre qui n'existe pas ne contourne pas une limite du typage — il **débranche le détecteur**. Quand du code ne compile pas sans cast, la question est « ce membre existe-t-il ? », jamais « comment faire taire tsc ? ».

### 2026-08-02 — `Date.now()` seul comme identifiant : 4 sites oubliés sur 9
- **Réalité** : `ForgeEditor.tsx` générait ses ids par `` `${prefix}_${Date.now()}_${Math.random()…}` `` à **5** endroits… et par `` `${prefix}_${Date.now()}` `` seul à **4** autres (`duplicateObject` pour les objets ET pour les eaux, création de préfab, création de calque). Deux duplications dans la même milliseconde produisent le même id, et le second élément écrase le premier dans la scène — sans erreur.
- **Correctif** : fonction `newId(prefix)` unique, les 9 sites y passent.
- **Règle** : quand une expression non triviale est recopiée à plus de deux endroits, le bug n'est pas dans les copies fausses mais dans l'absence de fonction. Corriger les sites oubliés un par un garantit qu'il en restera un — la contre-vérification en citait un, j'en ai trouvé un deuxième, Hermes deux de plus.

### 2026-08-02 — M1 Forge : TROIS mécanismes, l'audit n'en décrivait que deux
- **Symptôme** : sur la Forge (sol ≈ −51), chaque objet posé flotte ~50 m au-dessus du terrain.
- **Ce que décrivait l'audit** : le plan cliquable à `y = -0.01` et le clamp `Math.max(0, y)`.
- **Le troisième, non décrit** : `ForgeMapBackdrop` rend des `<primitive>` **sans** `raycast={null}` et **sans** gestionnaire. Le rayon les touche donc, mais personne n'écoute. Conséquences distinctes selon l'endroit :
  * DANS le carré de 500 × 500 centré sur l'origine → le plan est plus PROCHE de la caméra que le terrain, R3F trie par distance, il rafle le clic → pose à y ≈ 0 ;
  * HORS du carré — soit l'essentiel d'une carte qui s'étend sur X[−2125, 1238] Z[−736, 2160] → le clic atteint le terrain, aucun gestionnaire, **il ne se passe rien du tout**.
- **Correctif** : `onClick`/`onPointerMove` déplacés sur le backdrop (géométrie réelle) ; plan de secours rendu uniquement quand `!scene.baseMap` ; les deux planchers `Math.max(0, …)` retirés de `commitTransform` et `addObject`.
- **Règle** : corriger uniquement ce qu'un audit décrit peut produire un demi-correctif convaincant. Ici, plan + clamp corrigés sans le backdrop auraient donné un éditeur juste dans un carré de 500 m et inerte partout ailleurs — plus difficile à diagnostiquer que le bug d'origine, parce qu'il marche « parfois ».

### 2026-08-02 — M2 Forge : un historique partiel, et un test qui validait le bug
- **Constat** : `SceneSnapshot` valait `{ objects, waters }`. Routes, terrains et map de base n'étaient jamais annulables. `updateObject` — l'action la PLUS fréquente de l'éditeur, le déplacement au gizmo — ne poussait aucun historique : créer un objet était annulable, le bouger ne l'était pas.
- **Correctif structurel** : `SceneSnapshot = Omit<ForgeScene, "id" | "name" | "updatedAt">`, défini par SOUSTRACTION. Un champ ajouté un jour à `ForgeScene` devient annulable sans que personne y pense — c'est la propriété qui compte, pas la liste du jour. Historique ajouté à `updateObject` et `updateWater` (une entrée par DÉPÔT : `ForgeBuilderScene` commite sur `onMouseUp`, pas par frame).
- **Mémoire** : le snapshot inclut désormais les terrains, dont `heights` est une heightmap complète. Le plafond en nombre ne suffisait plus → budget en OCTETS (32 Mo) en plus du compte (100).
- **⚠️ Le test que j'ai d'abord écrit VALIDAIT le bug** : `expect(restaure.paths ?? []).toHaveLength(0)` passe quand `paths` est ABSENT de l'objet restauré — `undefined ?? []` vaut `[]`. Or l'absence EST le bug : `forgeSceneStore.save(id, patch)` **fusionne**, donc un patch qui ne mentionne pas `paths` laisse la route en place. L'assertion devait porter sur `hasOwnProperty("paths")`.
- **Règle** : quand la sémantique en aval est une FUSION, un test doit vérifier la **présence de la clé**, pas sa valeur. Un `?? []` ou un `?.` dans une assertion transforme « le champ n'existe pas » en « le champ est vide » — c'est-à-dire exactement la confusion que le correctif devait lever.
- **Règle** (troisième occurrence du motif aujourd'hui, après A1 et A3) : une assertion qui passe avant ET après le correctif ne teste rien. Systématiquement remettre le bug et EXIGER le rouge — c'est ce qui a révélé les trois.

### 2026-08-02 — « y = 0 » codé en dur : le MÊME défaut à quatre endroits
- **Constat** : quatre sites supposaient que le sol de toute map est à la cote zéro, alors que la Forge a le sien à ≈ −51.
  * `ForgeBuilderScene.commitTransform` — `Math.max(0, y)` (M1)
  * `ForgeEditor.addObject` — `Math.max(0, y)` (M1)
  * plan de placement à `y = -0.01` (M1)
  * `ForgeEditor.alignObjects` — `pos: [x, 0, z]` sur TOUS les objets (M10)
- **Effet du dernier** : « aligner » propulsait la scène entière 51 m en l'air, en un clic, sur toute la carte — pas seulement la sélection.
- **Correctifs** : altitude issue du raycast pour le placement ; alignement sur le minimum des Y (`floorY`), ce qui donne enfin à l'action le sens qu'annonce son nom.
- **Règle** : une constante monde codée en dur se répète. Après en avoir corrigé une, chercher les autres AVANT de conclure — `grep -n "0, sn(\|, 0, o.pos\|Math.max(0"` a suffi ici. Corriger le site signalé par l'audit et s'arrêter là laisse le bug vivant sous un autre nom.

### 2026-08-02 — M5 : le drag de spline lisait l'intersection avec sa propre poignée
- **Cause** : `onPointerMove` faisait `p[i] = e.point`, or `e.point` est l'intersection avec la SPHÈRE de contrôle (rayon 0,2), pas avec le sol. Le point de route glissait sur la surface de la bille et partait n'importe où dès que le curseur en effleurait le bord.
- **Correctif** : projection du rayon du curseur (`e.ray`) sur un plan horizontal passant par le point d'origine — suit la souris en X/Z, conserve l'altitude issue du terrain.
- **Règle** : dans un gestionnaire R3F, `e.point` est l'intersection avec le mesh QUI PORTE le gestionnaire. Sur une poignée de manipulation, c'est presque toujours la mauvaise valeur : il faut projeter `e.ray` sur la surface de référence voulue.

### 2026-08-02 — M8 : `persist()` réécrivait tout, à chaque mutation
- **Cause** : chaque `save()` déclenchait `localStorage.setItem(JSON.stringify(scenes))` **et** `saveWorldDb` — pour toutes les scènes, pas seulement celle modifiée. Un glisser de curseur ou un drag au gizmo sérialisait donc l'intégralité du contenu à chaque frame, et le bouton « Sauvegarder » réécrivait systématiquement un état identique.
- **Correctif** : anti-rebond 250 ms + dirty-check sur le JSON produit, avec écriture immédiate sur `pagehide` et `visibilitychange` pour ne pas perdre la dernière rafale à la fermeture de l'onglet.
- **Règle** : un anti-rebond sur une écriture persistante DOIT s'accompagner d'un point de vidange sur la sortie de page. Sans lui, on échange un problème de performance contre une perte de données — un pire marché.

### 2026-08-02 — M4 : le type de `save()` portait la même maladie que le snapshot
- **Symptôme** : ajouter `weather` à `ForgeScene` ne suffisait pas à pouvoir l'enregistrer — `tsc` refusait le champ.
- **Cause** : `save(id, patch: Partial<Pick<ForgeScene, "name" | "objects" | "waters" | "baseMap" | "terrain" | "terrains" | "paths">>)`. Une liste énumérée à la main, exactement le défaut que le snapshot d'historique venait de perdre (M2). **Deux listes indépendantes du même ensemble = deux occasions de diverger**, et rien ne les tenait synchronisées.
- **Correctif** : `Partial<Omit<ForgeScene, "id" | "updatedAt">>`. Désormais un champ ajouté à la scène est enregistrable ET annulable sans toucher à rien d'autre.
- **Règle** : quand deux endroits décrivent « les champs modifiables de X », l'un des deux finira périmé. Les définir par SOUSTRACTION depuis le type source supprime la classe entière de bugs, au lieu d'en corriger une instance.
- **Erreur évitée de justesse** : en extrayant `WEATHER` vers son nouveau fichier, j'avais RECOPIÉ DE MÉMOIRE le preset `space` (`#8899cc / 0.5 / 0.12`) au lieu du vrai (`#aab4ff / 0.6 / 0.22`). Rattrapé en relisant l'original avant de supprimer la source. Un déplacement de code se fait par copie vérifiée, jamais par réécriture.

### 2026-08-02 — La MÊME liste énumérée à TROIS endroits (M2 · M4 · M11)
- **Constat** : trois types décrivaient indépendamment « les champs modifiables d'une `ForgeScene` », chacun avec sa propre énumération à maintenir à la main :
  1. `SceneSnapshot` (historique) — `{ objects, waters }` → **routes, terrains et ambiance jamais annulables** ;
  2. `save(id, patch)` — `Partial<Pick<ForgeScene, "name" | "objects" | "waters" | "baseMap" | "terrain" | "terrains" | "paths">>` → **un champ ajouté à la scène n'était pas enregistrable** ;
  3. `RemoteMsg.FORGE_SCENE` (Forge Live) — `Pick<ForgeScene, "objects" | "waters" | "terrain" | "baseMap">` → **deux co-éditeurs divergeaient en silence** dès qu'un seul traçait une route.
- **Comment on s'en aperçoit** : en ajoutant `weather` à `ForgeScene`. Le champ existait, `tsc` refusait quand même `save({ weather })`. Une liste oubliée sur trois suffit à faire échouer la fonctionnalité entière — et les deux autres n'auraient rien signalé.
- **Correctif** : les trois passent à `Omit<ForgeScene, …>`. Définis par SOUSTRACTION, ils suivent d'eux-mêmes tout ajout futur. Vérifié après coup : plus aucune occurrence réelle de `Pick<ForgeScene` dans `src/` (la seule restante est dans le commentaire qui documente l'ancienne forme).
- **Règle** : quand plusieurs endroits décrivent « les champs de X », ils divergeront — la seule question est lequel en premier. Les dériver du type source supprime la CLASSE de bugs ; corriger l'instance signalée par un audit n'en règle qu'un tiers, et laisse les deux autres se manifester plus tard sous des symptômes sans rapport apparent (un undo incomplet, une sync qui perd des routes).
- **Bénéfice mesurable de la bonne abstraction** : une fois les trois convertis, ajouter `layers` à la scène (M3) l'a rendu du même geste persisté, annulable ET synchronisé. Aucun des trois sites n'a eu à être touché.

### 2026-08-02 — M3 : un état transitoire référencé par un état persisté
- **Cause** : `layers` vivait dans un `useState` de `ForgeEditor`, mais CHAQUE `ForgeObject` porte un `layerId` qui le référence — et les objets, eux, sont persistés.
- **Effet** : au rechargement, les calques disparaissaient et les objets pointaient vers des identifiants inexistants. `layerById.get(o.layerId)` rendait `undefined`, et le filtre de visibilité (`?.visible !== false`) les laissait alors passer **par défaut**. Masquage et verrouillage silencieusement annulés d'une session à l'autre — sans erreur, sans avertissement.
- **Correctif** : `layers` rejoint `ForgeScene` ; hydratation à l'ouverture, persistance anti-rebond. Le calque ACTIF est revalidé contre la liste rechargée, sinon les nouveaux objets naîtraient eux-mêmes sur un calque fantôme.
- **Règle** : un identifiant persisté doit désigner quelque chose d'aussi durable que lui. Si A référence B, B ne peut pas vivre dans un état plus court que A.
- **Règle** : un repli « en cas de doute, on affiche » transforme une donnée manquante en comportement normal. C'est ce qui a rendu ce bug invisible pendant des mois : le résultat d'un calque perdu est identique à celui d'un calque visible.

---

📄 **Récapitulatif complet de la session** : `.hermes/CORRECTIONS_2026-07-31.md`
(16 corrections, symptôme → cause mesurée → correctif → vérification).

---

- [ ] L'erreur est documentée avec sa date
- [ ] Les champs Erreur / Réalité sont précis et vérifiables
- [ ] La cause racine identifie POURQUOI (pas juste QUOI)
- [ ] La règle ajoutée est actionnable (pas un vœu pieux)

### 2026-09-03 — L'outil de compatibilité a validé des modèles inutilisables

- **Symptôme** : personnages MetaHuman importés et cuits, annoncés « compatibles
  sans retargeting ». Ils se seraient déformés faux en jeu — torse tordu, sans
  aucune erreur au chargement.
- **Cause racine** : `narvos-skeleton-compat.mjs` comparait des ENSEMBLES DE NOMS
  d'os, jamais la hiérarchie. MetaHuman porte bien les 68 noms de
  `SKEL_Mannequin`, mais intercale `spine_04`, `spine_05`, `neck_02` dans la
  chaîne (342 os contre 68) et le mesh est pondéré sur ces os intermédiaires.
  Liés à `SKEL_Mannequin` qui ne les a pas, ces poids disparaissent.
- **Preuve** :
  ```bash
  node scripts/narvos-skeleton-compat.mjs \
    WebPortal/public/models/personnages/GameAnimationSample/MetaHumans
  # avant : 7 IK SEULS · 7 importables
  # après : 7 INTERCALE · 0 importable
  ```
  Hiérarchie mesurée : `neck_01` pend de `spine_05` (MetaHuman) contre `spine_03`
  (Mannequin) ; `head` de `neck_02` contre `neck_01`.
- **Correctif** : `scripts/narvos-skeleton-compat.mjs` — fonction `arbreDe()` et
  verdicts `INTERCALE` / `REPARENTE`. MetaHuman retirés du catalogue via
  `METAHUMAN_ACTIF = false` dans `scripts/narvos-modular-to-lua.mjs`.
- **Règle** : un outil de compatibilité qui autorise une opération coûteuse doit
  être interrogé sur ce qu'il NE regarde pas, avant qu'on s'y fie. Voir
  `narvos-measure-first` Règle 12.

### 2026-09-03 — Vérifier un import contre les échecs au lieu des succès

- **Symptôme** : contrôle « 0 entrée morte » sur un catalogue dont 67 des 166
  entrées n'avaient aucun asset. Le menu se serait affiché au tiers vide.
- **Cause racine** : le contrôle comparait le catalogue à la liste des ÉCHECS
  d'import. Un fichier absent du manifeste n'est ni succès ni échec — il n'a
  jamais été tenté, et n'apparaît donc dans aucune liste d'erreurs.
- **Preuve** : comparaison contre les `.uasset` réellement présents :
  ```bash
  find WebPortal/Server/adk/Content/Narvos -name "*.uasset" | sed 's|.*/||;s|\.uasset$||'
  ```
  → 67 références du catalogue absentes du disque, alors que le contrôle par les
  échecs en annonçait 0.
- **Correctif** : contrôle refait contre le disque. Second import après
  dégraissage : 67 ok, 0 échec.
- **Règle** : la présence se vérifie sur ce qui EXISTE, jamais sur ce qui a
  échoué. Et jamais dans un log : un cook concurrent le rotate sous les pieds.

### 2026-09-03 (soir) — Le point-quelconque de JS ne franchit pas le retour chariot

- **Symptôme** : `scripts/lua-harness/portee-check.mjs`, tout neuf, sort **23
  alertes** sur des noms « employés avant leur déclaration ». Les 23 lignes
  incriminées sont des COMMENTAIRES français, dans lesquels le mot cherché
  apparaît en toutes lettres.
- **Cause racine** : les fichiers du dépôt sont en **CRLF**. Après un
  `split("\n")`, chaque ligne se termine par `\r`. En JavaScript, `.` ne
  franchit AUCUN terminateur de ligne — `\r` en fait partie. Le motif
  `/--.*$/` s'arrêtait donc avant le `\r` pendant que `$`, sans le drapeau `m`,
  exigeait la fin de chaîne située APRÈS. Aucun commentaire n'était retiré.
- **Preuve** : la ligne nettoyée, imprimée telle quelle :
  ```
  [nu] "--- Nil par défaut : sans arbitre, aucun conflit n''est ce qui\r"
  ```
  Le `--` est toujours là ; seul le retrait des apostrophes a opéré.
- **Correctif** : `.replace(/\r+$/, "")` en tête de la chaîne de nettoyage
  (`scripts/lua-harness/portee-check.mjs`).
- **Règle** : après un `split("\n")` sur un fichier Windows, retirer le `\r`
  AVANT toute expression employant `.` ou `$`. Le symptôme n'est jamais une
  erreur — c'est un filtre qui ne filtre rien.

### 2026-09-03 (soir) — Chemins relatifs dans un manifeste, deuxième fois

- **Symptôme** : `import : 0 ok, 15 en echec`. Interchange répond
  « There was no data to import in the provided source data » — un message qui
  accuse le fichier d'être vide.
- **Cause racine** : `scripts/narvos-manifeste-brut.mjs`, écrit le jour même,
  recopiait les chemins tels que fournis en ligne de commande. Passés en
  relatif, ils ont été résolus contre le répertoire courant du commandlet :
  ```
  D:/Epic Games/UE_5.7/Engine/Binaries/Win64/WebPortal/public/models/pnj/...
  ```
  Le fichier n'a jamais été ouvert.
- **Preuve** : le chemin complet figure dans `Saved/Logs/NanosWorldADK.log`,
  ligne `LogInterchangeEngine: Error`.
- **Correctif** : `path.resolve(f)` à l'écriture du manifeste. Après :
  `45 ok, 0 en echec`.
- **Règle** : c'est la DEUXIÈME fois (584 imports perdus la première). Tout
  chemin destiné à un commandlet Unreal passe par `path.resolve`, à l'écriture
  et jamais à la lecture. Le skill `nanos-world` le documentait déjà — le
  documenter ne suffit pas, il faut que le code l'applique.

### 2026-09-03 (soir) — L'outil de bash mange les antislashs des heredocs

- **Symptôme** : quatre scripts de suite refusés à l'exécution sur
  `SyntaxError: Invalid regular expression: missing /`, alors que la source
  écrite semblait correcte.
- **Cause racine** : le contenu passé par `cat > f <<'EOF'` perd ses `\` — les
  expressions régulières JavaScript en sortent avec un antislash de moins
  (`[^"\]` devient `[^"\]`), et un `\n` littéral devient un vrai saut de ligne
  qui coupe un littéral d'expression en deux.
- **Preuve** : le même contenu écrit avec l'outil `Write` s'exécute ; recopié
  par heredoc, il échoue au même endroit.
- **Correctif** : écrire tout fichier contenant des antislashs avec `Write` ou
  `Edit`, jamais par heredoc.
- **Règle** : le heredoc reste bon pour du texte sans échappement (SQL, Lua sans
  motif, listes). Dès qu'il y a une expression régulière ou une séquence
  d'échappement, passer par l'outil d'écriture de fichier.

### 2026-09-04 — `TaskStop` rend « succès » sans que le processus meure

- **Symptôme** : deux commandelets Unreal sur le même projet, lancés à 8 secondes
  d'intervalle par deux scripts différents. Deux instances qui se disputent le
  registre d'assets et le DerivedDataCache — précisément ce que la fonction
  `attendre()` de chaque script existe pour empêcher.
- **Cause racine** : `TaskStop` avait répondu `Successfully stopped task` sur
  l'ancienne chaîne. Le message atteste que le SUIVI a lâché la tâche, pas que
  le processus est mort. Le `bash` détaché tournait toujours, dans une boucle
  « attendre que plus aucun UnrealEditor-Cmd ne tourne ». Quand j'ai tué la
  fusion à l'échéance d'une heure, la condition est devenue vraie : le zombie a
  démarré son étape suivante au moment exact où j'en démarrais une autre.
- **Preuve** : les parents des deux processus, lus par WMI —
  ```powershell
  Get-CimInstance Win32_Process -Filter "Name='UnrealEditor-Cmd.exe'" |
    Select ProcessId, ParentProcessId
  ```
  29528 ← `chaine-maps.sh` (arrêté « avec succès »), 30936 ← `chaine-finale.sh`.
- **Correctif** : `Stop-Process -Id <bash> -Force` sur les parents d'abord, puis
  sur l'instance Unreal. Vérifier ensuite qu'il n'en reste qu'une.
- **Règle** : après un `TaskStop` sur un script qui a lancé des processus longs,
  CONFIRMER par la liste des processus — jamais par le message de retour. Et un
  script détaché qui boucle sur une condition est le plus dangereux à laisser
  vivre : il ne consomme rien, ne dit rien, et repart au moment précis où l'on
  croyait la place libre.

### 2026-09-04 — Mon garde-fou de chemin ignorait la forme qu'il recommandait

- **Symptôme** : `adk-verifier-textures.py`, tout neuf, annonce **2 026 meshes**
  pour un dossier qui en contient 40 — et le même chiffre pour un autre dossier.
- **Cause racine** : `_racine()` acceptait `/Game/x` et `C:/…/Game/x` mais PAS
  `Game/x` — précisément la forme que sa propre documentation recommande sous
  Git Bash, où MSYS réécrit toute valeur commençant par `/`. La valeur retombait
  sur le défaut `/Game/Narvos`, et l'outil mesurait le projet entier.
- **Preuve** : deux racines différentes rendant exactement le même bilan.
- **Correctif** : troisième forme acceptée (`scripts/adk-verifier-textures.py`).
- **Règle** : un garde-fou de conversion de chemin doit accepter TOUTES les
  formes qu'il documente, et un test le prouve. Ici c'est l'absurdité du chiffre
  qui a sauvé la mesure — 2 026 pour 40. Un écart de 10 % serait passé.

### 2026-09-04 — `adk-verify-import.py` ment sur les textures, deuxième fois

- **Symptôme** : « 40 mesh sur SKEL_Mannequin avec textures », 4 textures
  chacune. L'inventaire typé du même ADK compte **0 Texture2D** dans ce dossier.
- **Cause racine** : le repli cherche les textures dans TOUT le registre au lieu
  de suivre les matériaux du mesh, et ramasse celles des packs voisins.
- **Preuve** : `_assets-inventory.json`, filtré sur `/stylized_modular/` :
  `{'Material': 14, 'SkeletalMesh': 40, 'PhysicsAsset': 40}` — aucun Texture2D.
- **Correctif** : `scripts/adk-verifier-textures.py`, qui ne quitte jamais le
  mesh (slot -> MaterialInstance -> texture_parameter_values).
- **Règle** : c'est la DEUXIÈME fois que cet outil trompe (la première annonçait
  40 personnages gris qui ne l'étaient pas). Un instrument qui s'est trompé deux
  fois ne se répare pas par un correctif de plus : on écrit celui qui mesure la
  bonne chose, et on dit dans l'ancien qu'il n'est plus la référence.

### 2026-09-04 — « nanos ne charge aucun plugin » : vrai en general, faux en detail

- **Symptôme** : Mutable classé « réfuté, ne pas y retourner » dans le rapport de
  session, sur la base d'une règle générale. Un collaborateur signale que le
  résultat à l'écran « n'est pas du mutable » — et il a raison.
- **Cause racine** : j'ai généralisé « client shipping, pas de C++ chargeable »
  en « aucun plugin ». La doc tient DEUX listes, et je n'avais lu que la
  conclusion : `whitelisted-ue-plugins.mdx` autorise 2 plugins externes à version
  imposée **et 22 plugins natifs**, dont Mutable (ligne 53) et Rig Logic.
- **Preuve** :
  ```bash
  grep -in "mutable" docs/assets-modding/whitelisted-ue-plugins.mdx
  # 53:- Mutable      (section « Native Plugins »)
  ```
- **Correctif** : entrée retirée du rapport, section 16 ajoutée au skill
  `nanos-world` avec les deux listes.
- **Règle** : une règle générale ne réfute pas un cas particulier. Avant de
  classer quelque chose en « réfuté » — la classification la plus coûteuse, celle
  qui empêche d'y revenir — chercher la liste d'exceptions et la LIRE. Ici elle
  tenait en un `grep` d'un seul mot.

### 2026-09-10 — Un témoin de démarrage qui ne peut pas sortir au démarrage

- **Symptôme** : le handoff du 09/09 dit de chercher dans le log de boot
  `Monde 'Akarlys' : decor deja dans la map persistante`, comme preuve que la
  branche `decor_persistant` ajoutée ce jour-là est prise. Elle n'y est jamais —
  ni avant ni après le correctif des portails. On en conclut que la branche est
  morte.
- **Cause racine** : cette ligne appartient à `VoyageServeur.Charger`
  (`narvos-map-proto/Server/Voyage.lua:67`), qui ne tourne **qu'au
  franchissement d'un portail**. Le démarrage, lui, passe par
  `VoyageServeur.DeclarerCharge` (`Voyage.lua:312`), qui déclare le monde chargé
  et pose ses portails **sans passer par `Charger`** — délibérément : `Charger`
  irait chercher un catalogue de meshes que ces mondes n'ont pas. Les deux
  chemins sont corrects ; c'est le témoin qui désignait le mauvais.
- **Preuve** :
  ```bash
  grep -c "decor deja dans la map" .hermes/serveur_2026-09-10b.log   # 0
  grep -c "Portail pose"           .hermes/serveur_2026-09-10b.log   # 10
  ```
  Dix portails posés, dont les trois de la capitale et de la forêt : la branche
  fonctionne. Le témoin absent ne mesurait pas ça.
- **Correctif** : aucun code — le handoff était faux, pas le programme.
- **Règle** : avant d'écrire « cherche telle ligne dans le log » comme preuve,
  vérifier **quelle fonction l'imprime et qui l'appelle**. Un témoin qui mesure
  autre chose que ce qu'on veut savoir rassure quand il sort, et accuse à tort
  quand il ne sort pas. Le bon témoin ici est le **compte de portails**, qui se
  compare à `#Mondes.LIAISONS` — une relation, pas une chaîne.

---

### 2026-09-12 — « Ces meshes n ont jamais ete cuits » : ma PORTEE de recherche etait fausse
- **Erreur** : j ai annonce que les corps nus Trooper (`SK_*_Form_*`) n existaient
  pas dans le pack, et j ai commence a designer une couverture de remplacement.
- **Realite** : ils sont importes, cuits ET declares depuis le debut, dans
  `Narvos/Meshes/BodyForms/{Male,Tall_Female,Petite_Female}` — 27 cles, 182/180/173 cm,
  un materiau chacun, DEUX textures de projet, zero slot vide.
- **Cause racine** : mon manifeste de squelettes ne surveillait que le prefixe
  `Narvos/Meshes/Trooper_Set/`. Le pack range la peau dans un dossier VOISIN de
  l armure. Zero resultat a ete lu comme « ca n existe pas » au lieu de « je ne
  regarde pas au bon endroit ».
- **Preuve** : `grep -E "_Form_" WebPortal/Server/Assets/narvos/Assets.toml` — 27 lignes.
- **Correctif** : `scripts/narvos-manifeste-squelettes.mjs` accepte plusieurs
  prefixes par famille ; `Narvos/Meshes/BodyForms/` ajoute.
- **Regle** : quand une recherche rend ZERO sur un pack qu on sait riche, verifier
  d abord la PORTEE (le prefixe, le dossier, le filtre) avant de conclure a
  l absence. Une absence se prouve sur l inventaire complet, jamais sur un sous-dossier.

---

### 2026-09-12 — Un renommage a reecrit les trois manifestes A VIDE, sans une erreur
- **Erreur** : j ai renomme `prefixe` en `prefixes` dans la table des familles
  sans changer la boucle qui le lisait. Chaque famille a donc filtre sur
  `undefined` : zero cle retenue.
- **Realite** : le script a ecrit trois manifestes vides — la PREUVE de squelette
  effacee — et a affiche « 0 cle(s) » sans le moindre signal d anomalie.
- **Cause racine** : un script qui ECRIT un resultat n avait aucune garde sur le
  vide. Zero est une valeur legitime pour un compteur, pas pour une preuve.
- **Correctif** : `narvos-manifeste-squelettes.mjs` s ARRETE si une famille ne
  rend aucune cle : « filtre casse ou pack ampute : on n ecrase pas un manifeste
  avec du vide ».
- **Regle** : tout script qui remplace un fichier de preuve refuse d ecrire un
  resultat vide. Le bon echec est l arret, pas la page blanche.

---

### 2026-09-12 — L editeur ne sait PAS lister les fonctions d un Blueprint
- **Erreur** : sonde ecrite pour lire les evenements du Meta Customization System
  via `dir()` sur l objet par defaut de la classe generee.
- **Realite** : **zero** fonction propre rendue, sur les huit Blueprints sondes —
  les bindings Python d Unreal n exposent pas les fonctions Blueprint.
- **Ce qui marche** : la table de noms du `.uasset`, lue hors editeur —
  `scripts/narvos-noms-uasset.mjs`. Elle a rendu `Change_Top`, `Change_Skin`,
  `Change_Hair_Colour`, `Change_Eyes`, `Change_Tattoo`… (releve complet dans
  `.hermes/API_BP_METACUSTOM_2026-09-12.md`).
- **Regle** : pour savoir ce qu un Blueprint expose, lire le PAQUET, pas l API
  Python de l editeur. Et comme `CallBlueprintEvent` ne rend rien cote serveur,
  un nom faux ne leve RIEN : seul l appel vu en jeu fait foi.

---

### 2026-09-12 — J ai saute le balayage des animations, le cook est mort a 26 minutes
- **Symptome** : cook des stations de craft, mort a 68 952 paquets sur 85 612 —
  `Assertion failed: !Hash.IsZero()` (`AnimSequence.cpp:2151`), precede de
  `Animation Compression request for AS_BuildingFirstPerson failed, Skeleton == nullptr`.
- **Cause racine** : le pack importe 7 animations du PERSONNAGE de demonstration
  (Building/Idle, FirstPerson et ThirdPerson) qui visent un squelette jamais
  importe. Une AnimSequence sans squelette ne rate pas la compression : elle TUE
  le processus.
- **Ce qui rend l erreur impardonnable** : `scripts/adk-animations-sans-squelette.py`
  existe DEPUIS LE 2026-09-06 pour depister exactement ca avant de cuire, et son
  en-tete raconte les trois cooks deja perdus sur la meme assertion. Je ne l ai
  pas lance.
- **Preuve** : 7 fichiers sur 47 ne portent aucune chaine `SKEL_` / `_Skeleton` —
  verifiable sans Unreal :
  `for f in *.uasset; do grep -aqE "SKEL_|_Skeleton" "$f" || echo "$f"; done`
- **Correctif, en DEUX temps — et le premier etait faux** : les 7 deplacees dans
  `Content/Quarantaine/AnimsSansSquelette/`, en croyant que « hors de `Narvos/`,
  ce n est plus cuit ». FAUX : `unreal_folders` d Assets.toml borne le PACK, pas
  le COOK, qui parcourt tout `/Game`. Deuxieme cook, meme crash, memes trois
  noms, 32 paquets plus loin. Il a fallu
  `+DirectoriesToNeverCook=(Path="Quarantaine")` dans `Config/DefaultGame.ini`.
  Les 40 animations de stations gardent leur squelette et restent.
- **Regle** : AVANT tout cook qui suit un import d animations, balayer. Un pack
  acheté apporte presque toujours les animations de son personnage de demo, et
  ce sont elles qui tuent.

---

### 2026-09-12 — Une sonde qui CHARGE l asset meurt de la meme mort que le cook
- **Erreur** : sonde ecrite pour lister les animations sans squelette ; elle
  appelait `unreal.EditorAssetLibrary.load_asset` pour lire la propriete.
- **Realite** : sur une animation cassee, `load_asset` ne rend pas `None` — il
  LEVE `RuntimeError: Invalid USkeleton supplied`. La sonde mourait donc sur la
  PREMIERE coupable, exactement comme le cook qu elle devait prevenir.
- **Ce qui a marche** : lire le FICHIER. Une AnimSequence saine nomme son
  squelette dans sa table d imports ; un `grep -a` sur le `.uasset` suffit, sans
  Unreal, en une seconde pour 47 fichiers.
- **A noter aussi** : en COMMANDLET, `get_assets_by_path` a rendu 0 asset sur
  `/Game/Narvos` meme apres `scan_paths_synchronous` + `wait_for_completion`,
  alors que le meme appel rend 833 dans l editeur OUVERT. Cause non etablie.
- **Regle** : pour juger un asset CASSE, interroger le fichier ou le registre,
  jamais l objet charge. Charger, c est deja subir le defaut qu on cherche.

---

### 2026-09-12 — J ai retire la table et laisse la ligne qui la LIT
- **Symptome** : serveur demarre, puis meurt au premier spawn de PNJ :
  `Character.lua:158: attempt to index a nil value (global 'ARME_PAR_CLASSE')`
  — `ApplyClass` -> `Spawn` -> `PoserArmurier`.
- **Cause racine** : Hanibes voulait que le personnage arrive SANS arme. J ai
  supprime la table `ARME_PAR_CLASSE` et ecrit un long commentaire expliquant
  pourquoi... en laissant vingt lignes plus bas le `local arme = ARME_PAR_CLASSE[class_id]`
  qui la lit. J ai ensuite ANNONCE « batte retiree » sans l avoir vu tourner.
- **Pourquoi rien ne l a vu** : `syntaxe-check` compile (la syntaxe est valide),
  `portee-check` ne surveille que les LOCALES, et aucun harnais n appelait
  `ApplyClass`. En Lua, lire un global absent rend `nil` sans bruit ; seule
  l INDEXATION leve, et seulement quand la ligne est atteinte.
- **Correctif** : ligne supprimee, plus `scripts/lua-harness/constantes-mortes-check.mjs` —
  un nom en CAPITALES_SOULIGNEES, INDEXE, sans declaration dans le fichier.
  Verifie : il attrape le defaut quand on le reintroduit, et se tait sinon.
- **Regle** : supprimer une table, c est supprimer SES LECTEURS dans le meme
  geste. Un `grep` du nom AVANT de dire que c est fait.

---

### 2026-09-12 — Mon premier garde criait sur 18 constantes qui existaient
- **Erreur** : premiere version de `constantes-mortes-check.mjs`. Elle nettoyait
  commentaires et chaines a la main, puis signalait TOUTE lecture de constante
  non declaree. Verdict : 18 mortes, dont `SOL_Z` et `DEV_COMMANDES` — declarees
  toutes les deux, trois lignes plus haut.
- **Cause racine** : le nettoyage avalait les blocs `[[ ]]` et decalait les
  numeros de ligne ; et le critere « toute lecture » est bien plus large que la
  forme qui plante (l INDEXATION).
- **Correctif** : ne juger que `NOM[...]` ou `NOM.champ`, ignorer explicitement
  les lignes entierement en commentaire, et chercher la declaration LARGE
  (commentaires compris) — le doute profite au silence.
- **Regle** : un garde qui crie a tort finit ignore, donc il ne garde plus rien.
  Preferer RATER une detection plutot qu en inventer une, et le prouver dans les
  deux sens : reintroduire le defaut (il doit crier), le retirer (il doit se taire).