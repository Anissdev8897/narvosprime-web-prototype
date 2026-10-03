# RESTE À FAIRE — lot Claude

Document de reprise. Tout ce qui suit a été **re-vérifié dans le code le 02/08/2026**,
pas recopié depuis les audits. Quand un audit se trompe, c'est écrit ici avec la
mesure qui le réfute.

## Compteurs (re-mesurer, ne jamais recopier)

```powershell
npm test 2>&1 | Select-Object -Last 5
npx tsc --noEmit 2>&1 | Select-String "error TS" | Measure-Object
npm test 2>&1 | Select-String "\(0 test\)"        # doit être VIDE
```

Au 02/08/2026 : **1758 / 1758 tests** (171 fichiers), **0 erreur tsc**,
**734 fichiers** et **97 364 LOC** dans `src/rpg/`.

⚠️ `Measure-Object -Line` doit être précédé de `Get-Content`, sinon il compte les
objets `FileInfo` (une ligne par fichier). Cf. `narvos-preflight` §6.

---

## ✅ SOLDÉ — ne pas refaire

| Lot | Résultat |
|---|---|
| Suite de tests | 37 échecs + 2 suites qui ne se chargeaient pas → **0** |
| tsc, lot Claude | 38 erreurs → **0** (le total projet est à 0, Hermes a fini le sien) |
| `sharp` | DLL `libvips-cpp` orpheline restaurée — tout le pipeline d'assets était hors service |
| A1 | Clip dominant cherché sans la table de repli → pose figée en diagonale accroupie |
| A3 | Events d'overlay cadencés par le cycle de locomotion |
| A4 | `mixer.timeScale` passé là où un framerate est attendu |

Six bugs de PRODUCTION corrigés au passage sur la suite de tests : `RagdollSystem`
(API Babylon dans du Three.js), `ObjectPool.warmupPool` (pré-créait 1 objet au lieu
de N), `MappingContext.activateOnly` (écriture sur getter → levée), `InputModifiers`
(division par zéro → `Infinity`), `Benchmark.tick` (muet sans renderer),
`MonitoringService` (fuite de `setInterval`).

---

## ⛔ RÉFUTÉ — ne pas « corriger », c'est un piège

Ces constats d'audit ressortiront. Chacun est faux, mesure à l'appui.

### A2 — « le bassin ne descend jamais »
Les trois mécanismes décrits sont EXACTS (remap qui droppe les `.position`, masque
`legsOnly` qui exclut le bassin, clip qui porte sa descente dans une piste
`.position`). **La conclusion est fausse.** L'abaissement est appliqué au groupe :
`og.position.y -= CROUCH_PELVIS_DROP × échelle` (`OwnAnimPlayerCharacter:327`).

Et il est exact, pas approximatif — mesuré sur `Anim_Crouch_Idle_Hip` : bassin
0,968→0,595, genou 0,574→0,202, cheville 0,583→0,211, pointe 0,393→0,021.
**Écart identique de 0,373 partout** : la pose se translate en bloc.

J'ai écrit le correctif, ses tests passaient, je l'ai retiré : il aurait ajouté
~0,21 par-dessus, soit **+57 % de descente**, personnage enfoncé dans le sol.
`AnimationController.crouch.test.ts` devient rouge si quelqu'un recommence.

### A5 — « `quantizeDirection` aurait évité A1 »
Faux deux fois. `blendWeightsForAngle` est **déjà continu** (à 44° puis 46°, le clip
dominant ne change pas, seul un troisième clip à poids ~0,02 permute) : il n'y a pas
de clignotement à corriger. Et `quantizeDirection` puise dans `ORDER`, qui contient
les diagonales — elle aurait rendu `forwardRight`, exactement la clé absente en
accroupi.

### A6 — « idle joué en apesanteur »
`MM_Jump.glb` dure **0,867 s** (mesuré dans le GLB). Le seuil `velocity.y < -1` est
atteint à **(6,2 + 1) / 22 = 0,327 s**. Facteur 2,6. De plus
`busy = cur === "jump"` empêche tout repilotage pendant le saut.

### A7 — « zone grise 0,2–0,3 m/s »
`useCrouchAdditive` exige `!(crouching && hasCrouchwalkLocomotion)`. Avec le pack
UTA chargé l'additif est désactivé quelle que soit la vitesse. Ne concerne que des
personnages sans clips crouchwalk — des PNJ, qui ne s'accroupissent pas.

---

## 🔴 RESTE — par ordre de valeur

### 1. Personnage modulaire (P1 · P2) — le plus gros morceau

**P1 vérifié le 02/08** : `src/rpg/characters/modular/` (7 fichiers) n'est importé
par **personne** hors du dossier.

> ⚠️ **PIÈGE DE NOMMAGE.** Deux fichiers s'appellent `ModularCharacter.tsx` :
> * `characters/ModularCharacter.tsx` — VIVANT (assembleur Quaternius, importé par
>   `ui/CharacterCreator.tsx:22` et `rpg/index.ts:51`) ;
> * `characters/modular/ModularCharacter.tsx` — MORT (le vrai pipeline, avec
>   `rebindSkinnedMesh` + `boneRemap`).
>
> Un `grep -i modular` fait croire que le second est branché. Commande correcte :
> ```powershell
> Get-ChildItem src -Recurse -Include *.ts,*.tsx |
>   Where-Object { $_.FullName -notmatch "characters\\modular" } |
>   Select-String -Pattern "characters/modular"
> ```

**P2** : l'objectif initial — découper les héros existants en parties de corps —
a été abandonné au profit d'un pack externe unique (BikerBundle). La voie par **os
dominant** (`skinIndex`/`skinWeight` par sommet → région corporelle) n'a jamais été
essayée, alors que `boneRemap.ts` (alias UE4↔Mixamo↔Meshy) et le garde-fou
`bindPoseDelta` de `rebindSkinnedMesh.ts` sont **écrits et testés**.

Architecture cible détaillée : `docs/AUDIT_FORGE_EDITION.md` §1.3.

**Avant de commencer** : demander un arbitrage. C'est une feature, pas un correctif,
et elle touche la persistance (`CustomCharacter` v1→v2).

### 2. `bodySlots.ts` — deux trous vérifiés, correctifs courts

* **P4** — `REQUIRED_SLOTS = ["body"]` (L51). Un personnage **sans tête** est donc
  valide. Le catalogue féminin n'a d'ailleurs ni `head`, ni `arms`, ni `hands`
  (`partCatalog.ts:108-112`).
* **P5** — `SLOT_HIDES = { gloves: ["hands"] }` (L36-40), alors que le commentaire
  du fichier promet qu'« un casque intégral remplace les cheveux ». Casque et
  cheveux se chevauchent donc visuellement.

Les deux se corrigent dans un fichier de données, avec les tests `bodySlots.test.ts`
déjà en place. **Mais** : tant que P1 n'est pas branché, ça ne se voit pas en jeu —
c'est de la préparation, pas une correction visible.

### 3. #17 — perception IA WASM : l'audit se trompe d'énoncé

**Ce que dit l'audit** : « après le fix PlayerTag, l'IA n'a AUCUNE perception ».
**Vérifié** : `AISystem::CanSeeTarget` (AISystem.cpp:156) existe et fait un vrai
tracé de ligne de vue à hauteur d'œil :
```cpp
return !EQS::TraceTest(t1->position + glm::vec3(0,1.6f,0),
                       t2->position + glm::vec3(0,1.6f,0));
```

**Le vrai manque** est ailleurs : `ChooseTarget` (AISystem.cpp:135-153) n'a **ni
limite de portée, ni cône de vision, ni mémoire**. Un PNJ acquiert le joueur à
distance infinie, à 360°, dès que la ligne de vue est dégagée.

C'est ça que porterait NPCEyesSightPRO (7 fichiers, cf.
`docs/BRIEF_RECUPERATION_SOURCES_CPP.md`). Écrire un LOS de plus serait du
travail perdu.

⚠️ Toute modification C++ impose d'invoquer le skill `wasm-engine` d'abord, et de
recompiler (emsdk) + copier vers `public/wasm/`.

### 4. Bindings WASM optionnels — décision en attente

~39 bindings de `NarvosWasmModule` sont déclarés **optionnels** parce qu'ils
n'existent ni dans `Bindings.cpp` ni dans le binaire : tout `MathWasm`, tout l'IK
(`animGraphAddIKTwoBone`, `FABRIK`, `ChainLookAt`, `FootLock`), `animRunBenchmark`,
`animGraphAddBlendDirectional`, `animGraphGetBlendDecisions`.

Le code tourne aujourd'hui à 100 % sur ses fallbacks JS, sans lever. Trois voies :
* les implémenter en C++ (le plus complet — mais pour la math scalaire, franchir la
  frontière JS↔WASM coûte plus cher que l'opération elle-même) ;
* supprimer les ponts spéculatifs jamais importés ;
* les laisser tels quels, l'état est honnête et documenté.

Méthode de vérification d'un binding, à réutiliser :
```powershell
Select-String wasm/src/bridge/Bindings.cpp -Pattern 'function\("nomDuBinding'
$b=[System.IO.File]::ReadAllBytes("public/wasm/narvos-engine.wasm")
[System.Text.Encoding]::ASCII.GetString($b).Contains("nomDuBinding")
```
⚠️ Les noms embind vivent dans le **`.wasm`**, pas dans le `.js`.

### 5. Nettoyages

* **Sonde P0 « TPS écran noir »** — le P0 est résolu depuis le 31/07, la sonde
  tourne encore dans le `useFrame` de `PlayerRig`. 4 fichiers :
  `runtime/diagnostics/tpsBlackScreenProbe.ts`, `PlayerRig.tsx`, `FpsCamera.ts`,
  `OwnAnimPlayerCharacter.tsx`. Vérifier avec
  `grep -rn "PROBE P0\|tpsBlackScreenProbe" src/`.
* **A5 / `quantizeDirection`** — exporté, testé, jamais appelé. Supprimer ou
  documenter pourquoi on le garde.
* **P6** — `ForgePersonnages.tsx:60-63` : `CharacterConfig` fictive en dur
  (`gender:"male"`, `classId:"warrior_bruiser"`), ids `att_${Date.now()}`
  collisionnables, offsets saisis à l'aveugle sans gizmo.

---

## 🟥 NON ATTRIBUÉ — ni Claude ni Hermes

### `npm run build` reste inexécutable
`vite.config.ts` n'a ni `publicDir: false` ni `build.copyPublicDir: false`, et porte
`emptyOutDir: true`. Vite viderait `dist/` puis y recopierait **34 583 fichiers,
240,8 Go** (mesuré). Ce n'est plus un problème TypeScript mais une décision
d'architecture d'assets.

### Risque de licence — indépendant et rapide
`public/models/export/` contient **6,2 Go de sources C++ de plugins Unreal
Marketplace PAYANTS** (ACF, DragonIK, UIWS, FlexiCam, NPCEyesSightPRO, FGear…),
servis en HTTP et téléchargeables par n'importe quel client. Deux références de
chemin à mettre à jour après déplacement — cf.
`docs/BRIEF_RECUPERATION_SOURCES_CPP.md` §0.1.

### #16 et #18
Économie de munitions incohérente, auto-attaque sans cooldown. Cités par le brief
C++ (portage ACF `ActionsSystem`), **jamais assignés** dans la répartition.
Non vérifiés par moi — ne pas les traiter comme acquis.

---

## Méthode — les trois règles qui ont le plus servi

1. **Un audit peut être exact sur le mécanisme et faux sur la conclusion.** Vérifier
   qu'un chemin est coupé ne dit rien sur l'existence d'un autre chemin. A2 et #17
   sont tous deux de ce type.
2. **Écrire le test qui ÉCHOUE d'abord.** Sur A1, une assertion `time > 0` passait
   malgré le bug (le mixer avance d'une frame après le recalage) — il fallait
   comparer au temps simulé. Systématiquement : remettre le bug, voir le test rouge,
   remettre le correctif.
3. **Ne jamais faire taire `tsc` avec `as any`.** Un seul `as any` sur
   `MathWasm.approach` a masqué 27 autres appels vers des bindings inexistants.

Détail complet de chaque entrée : `.claude/skills/narvos-error-log/SKILL.md`
(section 02/08/2026). Note de vérification en jeu : `.hermes/A_VERIFIER_2026-08-02.md`.