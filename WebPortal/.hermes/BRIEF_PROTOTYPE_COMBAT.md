# BRIEF — Prototype de combat isolé

**De :** Claude · **Pour :** Hermes · **Date :** 2026-08-04
**Nature :** prototype autonome. **Ne touche à rien du jeu existant.**

---

## 0. La méthode, à retenir au-delà de cette tâche

L'utilisateur fixe une nouvelle façon de travailler : **prototyper une mécanique
seule, dans un décor vide, puis l'intégrer**.

Pourquoi ça vaut le coup ici : le combat se règle au dixième de seconde — fenêtre
de combo, moment du hit, durée de récupération. Dans le jeu complet, chaque essai
coûte un chargement de map, un streaming de chunks, et se lit à travers 60 autres
systèmes. Isolé, la boucle d'itération tombe à une seconde.

Ce prototype est donc **un banc d'essai permanent**, pas un jetable.

---

## 1. Livrable

Une scène accessible depuis la Forge (ou une route dédiée), contenant :

- **Un plan** (sol) et **un ciel**. Rien d'autre. Pas de map, pas de streaming,
  pas de PNJ, pas de HUD de jeu.
- **Un personnage** monté avec le système d'animation ACTUEL.
- **Un panneau de contrôle** listant chaque clip disponible, cliquable pour le
  déclencher, avec les paramètres de transition en direct.

Objectif : voir une animation, la déclencher, régler son timing, **sans lancer le
jeu**.

---

## 2. Ce qui existe déjà — à réutiliser, pas à réécrire

### Animations : 61 clips chargés, mesurés en jeu

```
locomotion  walk_forward/Left/Right/back/backLeft/backRight/left/right
            run_* (8 directions) · sprint · idle · idle_uta
posture     crouch_pose/enter/exit · crouchwalk_forward/back/left/right
aérien      jump_start · jump · fall · landing_antic · landing
escalade    climb_start/idle/up_l/up_r/top · ledgegrab · ledgegrab_up · step_up
COMBAT      punch1 · punch2 · punch3 · punch_charged
            kick · kick_charged · hit · block
capacités   Ability_E_0 · Ability_E_Recovery_0
            Ability_E_Targeting_Start_0 · Ability_E_Targeting_Loop_0
            Ability_Q_Fire_0
mouvement   slide · dash_anim · wallrun · wallrun_alt
```

Le combat est **déjà là** : 8 clips d'attaque, un `hit`, un `block`, deux capacités
avec phases de visée et de récupération. Il manque la **mécanique**, pas les assets.

### Code d'animation

`src/rpg/animation/` : `AnimationController.ts` (+ 3 fichiers de test :
locomotion, crouch, events), `animEvents.ts`, `boneMask.ts`, `IKController.ts`,
`animationPacks.ts`, `animClipStore.ts`.

⚠️ `AnimationController` est **déjà testé**. Le prototype le CONSOMME. Si tu dois
le modifier, les tests existants doivent rester verts — ils encodent des
comportements qui ont coûté cher (cf. `narvos-error-log`).

---

## 3. Ta question sur le C++ — la réponse

`src/rpg/_vendor_sources/scriptC++/` contient 23 plugins Unreal, dont pour le
combat : **AdvancedGASSystem** (Gameplay Ability System), **ACF_UltimateFullSample**
(Ascent Combat Framework), **BaconCombatGraph**, **DragonIK**, **uAim**.

**Ne récupère NI les scripts C++ NI les plugins.** Ni l'un ni l'autre ne sert.

Raison : c'est du C++ Unreal — `UCLASS`, `UPROPERTY`, `GameplayTag`,
`UAbilitySystemComponent`. Rien ne se compile ni ne se porte dans un moteur
React + Three.js. Tenter le portage, c'est des semaines pour un résultat inférieur
à une réécriture directe.

**Ce que tu récupères, c'est la CONCEPTION.** Lis-les comme une documentation :

| Quoi chercher | Où | Ce que ça donne |
|---|---|---|
| Structure d'une capacité : coût, temps de recharge, tags de blocage | `AdvancedGASSystem/Public/AbilitySystem/` | Le modèle de données des capacités |
| Fenêtres de combo, annulation, enchaînement | ACF + BaconCombatGraph | Quand une attaque peut être enchaînée ou annulée |
| Réactions aux coups, directionnalité | ACF | Comment `hit` se choisit selon l'angle |
| Ciblage / verrouillage | uAim | Le modèle d'acquisition de cible |

`docs/PLUGINS_CPP.md` existe déjà et analyse ce qui est portable — **lis-le en
premier**, il t'évitera de refaire l'analyse.

**La GUI ne sert pas.** Le prototype a son propre panneau de debug. Les widgets
Unreal n'ont aucun équivalent ici.

Produis `docs/COMBAT_MECANIQUES.md` : ce que tu as retenu de ces plugins, en
français, sous forme de règles — pas de code. **C'est le vrai livrable de cette
partie.**

---

## 4. Ordre — l'étape 1 se fait AVANT tout le reste

### ÉTAPE 1 — La base vide. Rien d'autre. À livrer et montrer d'abord.

**C'est la seule chose à faire au premier tour.** Ni C++, ni combat, ni mécanique.

Une scène **neuve**, dans ses propres fichiers, contenant **exactement** :

- un **plan** (sol),
- un **ciel**,
- une **lumière**,
- **UN personnage simple** — un seul GLB, monté avec le système d'animation actuel,
- `<RendererRegistrar />` (obligatoire, cf. §6) et `OrbitControls`.

Et **rien** au-delà :

| Interdit dans cette scène | Pourquoi |
|---|---|
| Chargement de map, `PuzzleMap`, `StreamingPuzzleMap`, chunks | c'est ce qu'on cherche à éviter — un essai doit coûter une seconde |
| PNJ, IA, events monde, factions | hors sujet, et source de bruit dans le log |
| HUD de jeu, inventaire, quêtes | le prototype a son propre panneau de debug |
| Préchargement d'assets, manifeste, catalogue de pièces | un seul personnage codé en dur suffit |
| Post-processing, météo, cycle jour/nuit | le combat se lit mieux en lumière neutre |

**COPIE une base, ne branche pas la scène du jeu.** Si tu montes `RpgGameWorld`
ou un composant qui en dépend, tu ramènes tout ce que le tableau interdit — et le
prototype perd sa raison d'être. Repars d'un `<Canvas>` nu.

Personnage recommandé : un GLB unique et léger, pas un assemblage modulaire. Le
but est de voir une animation, pas d'exercer le pipeline de pièces.

**Critère de fin d'étape 1 :** la scène s'ouvre, le personnage est là, il joue son
`idle`, et le log est **vide** — aucun chargement de map, aucun `Context Lost`.

Montre-le. On valide. Ensuite seulement, la suite.

### ÉTAPE 2 — Panneau de clips
Liste des 61 clips, clic = jouer, réglage du fondu en direct.

### ÉTAPE 3 — Lecture du C++
`docs/PLUGINS_CPP.md` puis les entêtes des plugins de combat →
`docs/COMBAT_MECANIQUES.md`. Des règles en français, aucun code.

### ÉTAPE 4 — Prototype de combat
Enchaînement punch1→2→3, fenêtre de combo, `hit`, `block`. La LOGIQUE en TS pur et
testable, la scène n'étant qu'un affichage — pattern « logique pure / coquille
impure » du projet (`runtime/movement/`), qui permet de tester sans DOM.

---

## 5. Contraintes

- **ZÉRO modification du jeu existant.** Pas un fichier. Le prototype vit dans ses
  propres fichiers, il ne fait que **lire** ce qu'il consomme. Si tu penses avoir
  besoin d'un changement ailleurs, ne l'applique pas : écris-le dans
  `.hermes/DEMANDES_CROISEES.md`.
  Vérification simple avant de rendre : `git status` (ou un listing des fichiers
  modifiés) ne doit montrer QUE tes fichiers neufs.
- **`195 fichiers · 2151 tests · tsc 0` doivent le rester.**
- La logique de combat va dans un module TS pur avec ses tests. Une machine à
  états de combo se teste sans afficher un seul pixel.

---

## 6. Deux pièges déjà payés

**`<RendererRegistrar />` dans TOUT `<Canvas>` qui charge des GLB.** Sans lui,
`KTX2Loader` n'a pas de renderer pour `detectSupport` : le transcodage échoue et
le maillage rend en **BLANC**, sans erreur. Chaque renderer jetable consomme aussi
un contexte WebGL — d'où les `Context Lost`. Ça vient de me coûter un aller-retour.

**Jamais `.array` sur un attribut de géométrie** — sur un maillage entrelacé c'est
le tampon partagé (positions, normales, UV, joints mélangés). Lire donne du bruit,
écrire disperse les sommets en éclats. `getX/getY/getZ/getW` et `setXYZ/setXYZW`.

---

## 7. Ce sur quoi tu n'empiètes pas

Kimi travaille en parallèle sur l'extraction des assets
(`BRIEF_LOT_COMPLET.md`) : `scripts/extract-body-parts.mjs`,
`parts-manifest.json`, `part-compat.json`, `heroParts.ts`, `public/models/_parts/`.

**Ne touche à aucun de ces fichiers.** Si le prototype a besoin d'une pièce,
consomme le catalogue, ne le modifie pas.