---
name: train-hermes
description: Boucle d'apprentissage du studio NARVOS PRIME. À invoquer APRÈS chaque correction, ajout ou diagnostic — c'est l'étape qui transforme ce qui vient d'être appris en règle réutilisable, et qui met à jour les skills narvos-* pour qu'ils suivent le code réel.
---

# train-hermes

Les skills `narvos-*` ne valent que s'ils restent synchronisés avec le code. Sans
étape d'écriture explicite, chaque session redécouvre les mêmes pièges et les
compteurs des skills dérivent (le `narvos-project-map` annonçait 411 tests quand
la suite en comptait plus de 1600).

Ce skill est cette étape. **Il ne produit pas de code — il produit de la mémoire.**

---

## 1. Quand l'invoquer

- Après avoir corrigé un bug (même trivial)
- Après avoir ajouté un système
- Après un diagnostic qui a **réfuté** une hypothèse — un cul-de-sac documenté
  vaut autant qu'un correctif, il évite qu'un agent y retourne
- Après avoir constaté qu'un skill mentait (chiffre périmé, chemin disparu)

Ne PAS l'invoquer pour : une reformulation, une question sans modification, un
`git status`.

---

## 2. Table de routage — quelle connaissance va dans quel skill

| Ce que tu viens d'apprendre | Destination |
|---|---|
| Un agent (ou toi) a affirmé un faux | `narvos-error-log` — erreur / réalité / cause racine / règle |
| Une méthode de diagnostic s'est révélée creuse | `narvos-measure-first` — nouvelle règle numérotée |
| Une métrique de gameplay/collision/spawn mesurée | `narvos-level-design` |
| Un comportement du pipeline GLB → chunks → KTX2 | `narvos-mesh-pipeline` |
| Un compteur, un chemin, une taille de fichier | `narvos-project-map` (avec la commande de vérif) |
| Une vérification à faire avant de publier | `narvos-preflight` (nouvelle case) |
| Une vérification à faire après avoir modifié | `narvos-iteration-guard` |
| Un piège d'architecture durable | `CLAUDE.md` § « Pièges connus » |
| Un état d'avancement, un bug ouvert | `.hermes/RAPPORT_PROJET_<date>.md` + `.hermes/STUDIO.md` |

Si la connaissance ne rentre nulle part, elle va dans `narvos-error-log` — c'est
le journal par défaut, jamais la poubelle.

---

## 3. Règle d'écriture — factuel ou rien

Chaque entrée ajoutée DOIT porter sa preuve. Une affirmation sans commande de
vérification est une future erreur.

**Gabarit (à copier tel quel) :**

```markdown
### <AAAA-MM-JJ> — <titre court>
- **Symptôme** : ce que l'utilisateur voit (pas ce que tu supposes)
- **Cause racine** : le mécanisme, pas la ligne
- **Preuve** : commande / test qui l'établit, avec son résultat
- **Correctif** : fichier:ligne
- **Règle** : la phrase qui empêche la récidive
```

Interdits :
- un numéro de ligne non vérifié par `grep` à l'instant
- un compteur repris d'une session précédente
- « probablement », « sans doute » — soit c'est mesuré, soit c'est marqué
  `[À VÉRIFIER]`

---

## 4. Règles nées de la session 2026-07-31 (P0 « TPS écran noir »)

### Règle A — Après 3 correctifs échoués, arrêter de corriger et instrumenter

Sur le P0 « TPS écran noir », quatre correctifs ont été appliqués à l'aveugle
avant tout diagnostic : clamp de pitch ±86°, `near: 0.3`, collision caméra
désactivée, spawn forge déplacé de `y=5` à `y=-26`. **Aucun n'a rien changé au
symptôme**, et trois d'entre eux sont restés dans le code, dont une
fonctionnalité désactivée (`resolveCameraPosition` mise en commentaire).

Un correctif qui ne change pas le symptôme doit être **retiré**, pas empilé.
Empilés, ils deviennent la nouvelle cause : le rapport note lui-même
« fonctionnait puis cassé par changements agents ».

**Règle.** Au 3ᵉ correctif sans effet, interdiction d'en écrire un 4ᵉ. Passer à
l'instrumentation : `window.__narvosTest.getState()` expose déjà `playerPos` et
`cameraView` (`PlayerRig.tsx`, `registerStateProvider`). Une valeur observée vaut
dix hypothèses.

### Règle B — Isoler une asymétrie par grep exhaustif avant de théoriser

Symptôme : « TPS noir, FPS marche ». Au lieu de deviner, énumérer **tout** ce qui
distingue les deux modes :

```bash
grep -rnE 'view === "tps"|view === "fps"|view !== "fps"' src/rpg
```

Résultat : 4 différences seulement dans 44k lignes — la branche `FpsCamera`, le
`g.visible = s.view === "tps"` des 4 composants perso, le zoom molette, et le
viewmodel FPS de `RpgGameWorld`. L'espace de recherche passe de « tout le
runtime » à quatre endroits, en une commande.

**Règle.** Face à « X marche, Y non », la première commande est le grep qui
énumère les différences X/Y. Pas une lecture de fichier.

### Règle C — Un accumulateur persistant peut verrouiller un NaN à vie

`FpsCamera.tpsSmoothed` (position TPS lissée) est un état persistant entre
frames. `NaN.lerp(valide, α)` reste `NaN` : **une seule** frame polluée verrouille
la caméra définitivement. Le FPS y échappe parce qu'il réécrit
`cam.position.set(...)` intégralement à chaque frame — il s'auto-répare.

Une caméra en NaN fait échouer tous les tests de frustum de Three.js : tout est
cullé → noir absolu, HUD DOM intact.

Vérifié par `src/rpg/runtime/movement/FpsCamera.tps.test.ts` : 3 tests confirment
que la math d'orbite est saine, 1 test démontre le verrouillage NaN.

**Règle.** Tout état lissé entre frames (`lerp`, `damp`, moyenne glissante) doit
valider son entrée AVANT de l'absorber, et se réinitialiser si sa propre valeur
devient non-finie. `Math.max`/`Math.min`/`THREE.MathUtils.clamp` **ne protègent
pas** du NaN : `Math.max(1.5, Math.min(12, NaN))` vaut `NaN`.

### Règle D — Un garde-fou anti-division-par-zéro peut fabriquer pire

`OwnAnimPlayerCharacter.tsx:136` :

```ts
const h = Math.max(0.001, box.max.y - box.min.y);
return { object: c, baseScale: (TARGET_HEIGHT / h) * scaleMul };
```

Une `Box3` vide vaut `min = +Infinity`, `max = -Infinity` → la hauteur vaut
`-Infinity`, clampée à `0.001` → `baseScale = 1.8 / 0.001 = 1800`. Le personnage
passe de 1,8 m à ~2,3 km, caméra TPS à l'intérieur du maillage. Le garde-fou a
converti un `NaN` visible en géant invisible.

Le même motif existe dans `FpsWeaponViewmodel.tsx`, `FpsUnarmedViewmodel.tsx`,
`BucheronAxeViewmodel.tsx`, `HumanCharacter.tsx`.

**Règle.** Un clamp de dénominateur doit s'accompagner d'un test de validité de
la mesure : si la bbox est vide (`box.isEmpty()`), utiliser une échelle neutre
(`1`) et le signaler — jamais diviser par la borne.

### Règle E — Tester le fichier réellement utilisé

`camera/cameraPose.ts` porte la formule d'orbite TPS **et ses tests**.
`movement/FpsCamera.ts` porte la même formule, tourne en production, et n'avait
**aucun test**. Le fichier au cœur du P0 était le seul non couvert.

**Règle.** Quand deux fichiers implémentent la même formule, vérifier lequel le
runtime appelle (`grep -rn "from.*FpsCamera"`), et exiger la couverture sur
celui-là. Une duplication non testée est une divergence qui attend.

### Règle F — Instrumenter par COUCHES, pas par point unique

Poser un `console.log` là où on soupçonne le bug ne prouve rien : si la valeur y
est déjà fausse, on ignore qui l'a produite. Instrumenter **chaque frontière que
la valeur traverse** transforme le débogage en lecture : le premier tag qui tire
désigne la couche fautive, les suivants ne font que propager.

Pour le P0 TPS, la chaîne est `CharacterController → PlayerRig → FpsCamera → caméra` :

```
1-CharacterController.position   ← le mouvement produit la position
1b-EtatJoueurNonFini             ← dt / yaw / pitch
2-FpsCamera.entrees              ← d, cp, eyeHeight (après les clamps)
2c-FpsCamera.tpsSmoothed         ← l'accumulateur persistant
3-Camera.position                ← ce que Three.js reçoit vraiment
4-PersoEchelleAberrante          ← hypothèse concurrente (perso géant)
```

Trois contraintes non négociables sur ce projet :

1. **Un report par tag, jamais plus.** La sonde vit dans `useFrame` : sans
   garde-fou elle écrit 60 lignes/seconde et noie le premier déclenchement — le
   seul qui compte.
2. **Aucun accès DOM au chargement du module.** Les tests vitest tournent en env
   `node` (cf. `CLAUDE.md`) : toute exposition sur `window` doit être gardée par
   `typeof window !== "undefined"`.
3. **Ne pas sérialiser avec `JSON.stringify`.** Il écrit `null` pour `NaN` ET
   pour `±Infinity`. Or la distinction EST le diagnostic : `NaN` vient d'un
   `0/0` ou d'un `undefined` arithmétique, `±Infinity` d'une division par zéro
   ou d'une `Box3` vide. Les confondre coûte la moitié de l'information.

La sonde doit aussi couvrir l'**hypothèse concurrente**, pas seulement la
préférée : une partie qui ne déclenche rien élimine alors deux pistes au lieu
d'une.

**Règle.** Instrumenter la chaîne complète avant de lancer, pas le point
suspect. Et poser la sonde AVANT d'écrire le correctif — une sonde ajoutée après
coup ne peut plus rien réfuter.

---

## 5. Procédure

1. Identifier la connaissance produite (correctif, réfutation, métrique)
2. Router via la table du §2
3. Écrire avec le gabarit du §3 — **vérifier chaque chiffre par commande**
4. Si un skill existant contredit ce qu'on vient d'observer : **corriger le
   skill**, ne pas ajouter une entrée contradictoire
5. Rafraîchir les compteurs de `narvos-project-map` si la session a ajouté des
   tests ou des fichiers :
   ```bash
   npm test 2>&1 | tail -5
   npx tsc --noEmit 2>&1 | tail -5
   ```
6. Reporter les bugs ouverts dans `.hermes/RAPPORT_PROJET_<date>.md`

---

## 6. Ce qui ne doit PAS entrer dans les skills

- Ce que le code dit déjà clairement (structure de dossiers, signatures)
- Ce que `git log` raconte (historique des correctifs)
- Un état transitoire propre à une session (« l'agent 12 travaille sur X »)
- Une opinion de style sans conséquence mesurée

Un skill qui grossit sans que sa densité d'information monte devient un skill
qu'on ne lit plus.