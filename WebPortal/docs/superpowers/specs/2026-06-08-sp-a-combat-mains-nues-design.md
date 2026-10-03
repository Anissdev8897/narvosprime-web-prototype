# SP-A — Combat à mains nues (punch / impact / esquive / K.O.) — Design

**Date** : 2026-06-08
**Statut** : approuvé (brainstorming)
**Périmètre** : 1er des 6 sous-projets du lot armes/combat. Client uniquement.

## Objectif

Remplacer les « coups de poing temporaires » (anim sans dégât) par un vrai combat à mains
nues : combo de 3 coups infligeant des **dégâts réels**, réaction d'**impact** quand le joueur
est touché, **esquive** avec i-frames, et **K.O.** de l'ennemi sur le coup final. Le tout
relié à la logique de dégâts/combat existante. Plus un **dummy d'entraînement** (IA) pour
tester.

## Décisions (brainstorming)

- **Combo 3 coups** : Punching → Cross Punch → Uppercut, finisher = kick aléatoire
  (Roundhouse / Martelo).
- **K.O. = ennemi étourdi par le finisher** (contrôle de foule), PAS le joueur.
- **Esquive** = réutilise un clip existant (saut/roulade) + **i-frames** (aucun FBX d'esquive
  fourni).
- **Répertoire** : le dossier `animation_punch` est **déclaré comme pack** dans le catalogue
  d'anims (`animationPacks.ts`). Pas d'UI d'ajout dynamique (choix utilisateur).
- Mains nues actives quand **aucune arme n'est dégainée** (`!weaponDrawn`).
- Esquive sur **LShift**. Dégâts mains nues faibles (`round(5 + puissance*0.4)`/coup, finisher ×2).

## Contexte (exploré)

- Punch actuel = action `attack` **anim seulement** ; les dégâts viennent d'un scan mêlée
  séparé (`RpgGameWorld.tsx:1668-1678`) gaté sur `weaponDrawn`. `hit`/`dodge` sont des
  `ActionId` **déjà déclarés mais jamais joués** (`AnimationController.ts:32,34`).
- Chokepoint dégâts entrants joueur = `handleNpcHitPlayer(dmg, element?)`
  (`RpgGameWorld.tsx:1526-1545`).
- `statusEffects.ts` : `root` (immobilise PNJ), `burn`, `invisibility`. Pas de `stun`.
- `AnimationController` supporte des **AnimEvents frame-exacts** (`:51,256-272`) → dégâts sur
  la frame d'impact.
- Pipeline FBX→GLB anim-only : `tools/blender_anim_only.py` (strip meshes, export anim-only).
- 10 FBX présents : `public/models/assets_character/Sorceres_hi_poly/animation_punch/`.
- Clips PNJ : `Npc.tsx` construit l'`AnimationController` SANS `avatarKey` (pas de remap) ;
  le set vient de `soldat_humain` + pack éventuel (stripé pour rig Meshy).

## Assets — conversion + déclaration du répertoire

1. **Convertir** les 10 FBX → GLB anim-only via `tools/blender_anim_only.py`, sortie dans
   `animation_punch/*.glb` (même dossier, extension .glb). Si Blender headless indisponible
   dans l'environnement : fallback chargement FBX direct au runtime (FBXLoader), mais GLB
   préféré (parse off-thread, pas de freeze).
2. **Déclarer le répertoire** dans `animation/animationPacks.ts` :
   - `UNARMED_PACK` (joueur) : `punch1`→Punching, `punch2`→Cross Punch, `punch3`→Uppercut,
     `kick`→Roundhouse Kick (+ Martelo 2 en variante), `hit`→Hit Reaction (+ Big Hit To Head).
   - `REACTIONS_PACK` (PNJ) : `stun`→Stunned (stripé `mixamorig:` → matche rig Meshy).
   - `Punch Combo.fbx` : non utilisé en v1 (combo géré par enchaînement de clips distincts).

## ActionIds (types.ts)

Ajouter à l'union `ActionId` : `punch1`, `punch2`, `punch3`, `kick`, `stun`.
Réutiliser l'existant : `hit` (impact reçu), `dodge` (esquive).
Étendre `CLIP_CANDIDATES` (`AnimationController.ts:20-36`) avec les noms de clips
correspondants (ex : `punch1: ["punch1","Punching"]`, `kick: ["kick","Roundhouse Kick","Martelo"]`,
`stun: ["stun","Stunned"]`, `hit: [...existant, "Hit Reaction","Big Hit To Head"]`).

## Volet 2 — Combat joueur

### `useUnarmedCombat` (nouveau hook, piloté par `HumanCharacter`)
Machine d'état de combo :
- État : `step` (0..3), `comboTimer`, `lastHitAt`.
- Entrée : clic gauche (quand `!weaponDrawn` ET pas en train de jouer un coup non-interruptible
  ET joueur vivant). *(Note : SP-D fera clic-gauche = garde pour le Guerrier → branchement
  archétype ajouté ici, conflit géré à SP-D.)*
- Sur clic : si `comboTimer > 0` et `step < 3` → avance ; sinon redémarre à `punch1`.
  - `step=1` → `punch1`, `step=2` → `punch2`, `step=3` → `punch3` (ou `kick` aléatoire) = finisher.
  - Fenêtre de combo : **0.6 s** après la frame d'impact ; au-delà → reset.
- **Dégâts sur frame d'impact** : chaque clip de coup porte un `AnimEvent` (cf. `animEvents.ts`)
  à ~40-60 % de sa durée → au franchissement, scan mêlée (rayon **2.5 m**, plan XZ + bande Y,
  réutilise `npcRegistry.forEachEnemyInRadius`) → `applyDamage` sur le plus proche dans le cône
  avant. Dégât = `round(5 + puissance*0.4)` ; **finisher ×2** + applique le stun (volet 3).
- Câblage anim : le hook appelle `animCtrl.play("punch1"|...|"kick")` (one-shot, retour auto
  à idle via le système one-shot existant).

### Impact (coup reçu)
- `handleNpcHitPlayer` (chokepoint) déclenche, sur dégât subi > 0, un `hitToken` (incrément).
- `HumanCharacter` observe `hitToken` (comme `attackToken`) → `animCtrl.play("hit")`
  (one-shot bref, n'interrompt pas la mort ; cède la priorité à `death`).

### Esquive (LShift + i-frames)
- Touche **LShift** (gérée dans le handler clavier de `RpgGameWorld`) → si joueur vivant et
  pas déjà en esquive → `animCtrl.play("dodge")` + arme une fenêtre d'invulnérabilité **0.4 s**
  (`dodgeIFrameUntil` ref).
- `handleNpcHitPlayer` : si dans la fenêtre i-frame → **ignore les dégâts** (return tôt, pas de
  HP perdu, pas de flash).

## Volet 3 — K.O. ennemi (statusEffects + Npc)

- `statusEffects.ts` : nouveau `kind: "stun"` (ciblé PNJ par id, durée ~**2 s**). API
  `statusEffects.applyStun(id, dur)` + `isStunned(id)` (miroir de `isRooted`).
- Le **finisher** du joueur (volet 2) appelle `applyStun(targetId, 2)` sur le PNJ touché.
- `Npc.tsx` (boucle IA) : si `isStunned(id)` → **gèle l'IA** (pas de déplacement, pas
  d'attaque, pas de cast) ET `animCtrl.play("stun")` (le clip Stunned, fourni via
  `REACTIONS_PACK` ajouté au set de clips du PNJ). À l'expiration → reprend idle/chase.
- Le clip Stunned doit être présent dans le set du PNJ : merger `REACTIONS_PACK` (stripé) dans
  les clips construits par `Npc.tsx` (à côté du set canonique soldat_humain).

## Volet 4 — Dummy d'entraînement (test IA)

- Étendre `StressBots`/`stressStore` (SP perf précédent) : preset « dummy » = N petit (1-3)
  ennemis mêlée, PV bas, près du joueur → cible pour valider punch (dégâts), impact (ils
  ripostent), K.O. (Stunned visible sur eux). Réutilise le panneau F7 existant.

## Frontières / unités

- `useUnarmedCombat.ts` (NEW) — machine de combo + dégâts, isolée, testable.
- `statusEffects.ts` (MODIFY) — +1 `kind` `stun`, API stun.
- `animationPacks.ts` (MODIFY) — +UNARMED_PACK, +REACTIONS_PACK (déclaration du répertoire).
- `types.ts` + `AnimationController.ts` (MODIFY) — +ActionId + candidats de clips.
- `HumanCharacter.tsx` (MODIFY) — branche le hook + `hit`/`dodge`.
- `Npc.tsx` (MODIFY) — lecture stun (gel IA + clip Stunned), merge REACTIONS_PACK.
- `RpgGameWorld.tsx` (MODIFY) — `hitToken` dans le chokepoint, i-frames esquive, LShift, finisher→stun.
- `StressBots.tsx`/`stressStore.ts` (MODIFY) — preset dummy.
- Tests : `useUnarmedCombat.test.ts` (avance/reset combo par timing, dégât finisher), 
  `statusEffects.test.ts` (stun apply/expire) — convention vitest existante.

## Stratégie de test

1. **Unitaire** : machine de combo (clic dans/hors fenêtre → step correct/reset) ; dégât
   mains nues (`5+puissance*0.4`, finisher ×2) ; stun apply/expire (`isStunned` true puis false).
2. **Manuel** (F7 dummy) : 3 clics rapides sans arme → combo 3 coups, dummy perd des PV ;
   finisher → dummy joue Stunned + gelé ~2 s ; se faire toucher → réaction `hit` ; LShift au
   moment d'un coup ennemi → 0 dégât (i-frames).
3. **Non-régression** : combat ARMÉ inchangé (arme dégainée → attaque arme comme avant) ;
   sorts inchangés ; `tsc` 0, suite existante verte.

## Hors périmètre (explicite)

- Catalogue/équipement d'armes, prix (SP-B).
- Arme secondaire 1H/2H (SP-C).
- Garde Guerrier clic-gauche (SP-D) — note : SP-D modifiera le branchement clic-gauche.
- Munitions (SP-E).
- UI dynamique d'ajout de répertoire (le dossier punch est déclaré en dur, choix validé).

## Risques

- **Blender headless indisponible** → fallback FBX runtime (perf moindre, à valider). Mitigation :
  tester la conversion tôt (1 FBX) ; si KO, charger FBX direct + noter la dette perf.
- **Clip Stunned sur rig PNJ** (Meshy, os sans préfixe) : nécessite strip `mixamorig:` (pack
  strip=true). Mitigation : vérifier le binding (mêmes os normalisés) comme pour le joueur.
- **Conflit clic-gauche** futur (SP-D garde) : prévoir dès maintenant un point de branchement
  archétype dans `onMouseDown` (pas de garde ici, juste l'emplacement).
- **AnimEvent d'impact** : si un clip n'a pas d'event défini, le coup ne fait pas de dégât.
  Mitigation : fallback — si aucun AnimEvent, appliquer les dégâts à mi-durée du one-shot.