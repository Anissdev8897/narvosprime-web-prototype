# Audit complet & plan de migration — Narvos Prime Web

> Audit demandé avant toute implémentation. Stack : React 19 · R3F 9 · drei 10 · Three.js 0.181 · TS 5.8 · Vite 6.

---

## 0. Conclusion majeure (à lire en premier)

**Le projet web ne contient AUCUN code Godot.** Les systèmes caméra, animation et
personnage sont **déjà** écrits en TypeScript / Three.js / React Three Fiber natif.
La "migration depuis Godot" redoutée est **déjà faite** dans les sessions précédentes.

Le vrai problème n'est donc PAS du legacy Godot, mais de la **duplication** :
deux systèmes de personnage coexistent, dont un **orphelin** (jamais branché).

---

## 1. Système CAMÉRA — `components/fps/FPSCamera.tsx`

| Critère | État |
|---|---|
| Web-native (R3F/Three.js) | ✅ Oui — `useThree` + `useFrame` + `PerspectiveCamera` |
| FPS / TPS | ✅ Toggle F1 (FPS) / F3 (TPS) |
| Rotation souris fluide | ✅ Pointer lock + `movementX/Y` + sensibilité |
| Zoom dynamique | ✅ Molette en TPS (`tpsDistance` 1.5–12m) |
| Collision caméra | ✅ **AJOUTÉ cette session** (voir §6) |
| Détails AAA | ✅ ADS (FOV lerp), head bobbing, sway, recoil recovery |
| Gimbal lock | ✅ Évité (`rotation.order = "YXZ"`) |

**Verdict : SYSTÈME PROPRE — conservé.** Aucun nettoyage requis. C'est une base
caméra de qualité AAA. Le seul manque (collision caméra TPS) a été comblé.

---

## 2. Système ANIMATION — `components/fps/AnimationStateMachine.tsx`

| Critère | État |
|---|---|
| Web-native | ✅ `THREE.AnimationMixer` |
| États | ✅ idle / walk / run / sprint / jump_up / jump_fall / land / aim / death |
| Blending | ✅ Crossfade `fadeIn`/`fadeOut` (transitions fluides) |
| Fallback animation | ✅ Essaie plusieurs noms de clips par état (Meshy + Halo) |
| Transitions auto | ✅ Basées sur vitesse / grounded / ADS |
| Support Mixamo / GLB | ✅ Compatible (clip name matching tolérant) |

**Autres briques animation présentes :**
- `services/CharacterAnimationManager.ts`
- `hooks/useHeroAnimation.ts`
- `data/animation-configs.ts`

**Verdict : SYSTÈME PRINCIPAL PROPRE — conservé.** ⚠️ Duplication potentielle entre
`AnimationStateMachine` (fps) et `CharacterAnimationManager` (services) +
`useHeroAnimation` (hooks) → à consolider (voir §5).

---

## 3. Système PERSONNAGE — DEUX systèmes en conflit

### 3.A `components/character/` — Meshy GLB (BRANCHÉ ✅)
- Utilisé par `App.tsx` (create/select) et `GameWorld3D` (in-game).
- Héros = GLB Meshy mergés (`/models/characters/<folder>/Meshy_..._Merged_Animations.glb`).
- `HeroPreview3D` (orbit + idle), `heroes-catalog.ts` (data), `useCharacterStorage`.
- **Modularité** : ❌ NON — chaque héros est un GLB mono-bloc (pas de vêtements
  interchangeables). Le rig est partagé (preview = in-game), c'est cohérent mais
  PAS modulaire au sens "swap clothes/head".

### 3.B `src/rpg/` — Quaternius modulaire (ORPHELIN ⚠️)
- Créé la session précédente. **Rien ne l'importe** (`grep` = 0 référence externe).
- `ModularCharacter.tsx` : assemblage Body/Arms/Legs/Feet/Head/Shoulders interchangeables.
- Genre M/F, glTF, PBR recoloration, thèmes Peasant/Ranger.
- **Modularité** : ✅ OUI — c'est le vrai système modulaire demandé.
- **Mais** : pas branché, pas d'animation (assemblage statique), duplique le concept perso.

### 3.C RPG data layer — `src/rpg/{elements,classes,skills}` (ORPHELIN, mais SANS conflit)
- 10 éléments + 10 classes + 100 skills générés + mapping animations.
- **Aucun équivalent ailleurs** → pure valeur ajoutée, à brancher (pas à supprimer).

---

## 4. Legacy / obsolète détecté

| Élément | Statut | Action |
|---|---|---|
| `components/SpritesheetAnimator.tsx` (2D) | encore importé par qq fichiers | 🟡 Vérifier avant suppression |
| `components/ColoredSprite.tsx` (2D) | encore importé | 🟡 idem |
| `components/Character3DPreview.tsx` | legacy (remplacé par HeroPreview3D) | 🟡 candidat suppression |
| `components/GameWorld.tsx` (2D, ≠ GameWorld3D) | legacy 2D iso | 🟡 candidat suppression |
| `data/dofusBreeds.ts`, `dofusSpells.ts`, `narvosBreeds.ts` | héritage Dofus | 🟡 candidat suppression |
| `components/CombatScene.tsx`, `TacticalCombatScene.tsx` | combat tactique 2D | 🟡 à clarifier (gardé ?) |

⚠️ **Aucune suppression de masse exécutée** : ces fichiers sont encore référencés
par plusieurs imports. Les supprimer casserait le build. La suppression nécessite
une passe ciblée fichier par fichier (voir §7) — et ta validation.

---

## 5. Duplication à consolider (le vrai "nettoyage")

```
ANIMATION : 3 implémentations
  ├── fps/AnimationStateMachine.tsx     ← garder (state machine + crossfade)
  ├── services/CharacterAnimationManager.ts  ← fusionner ou supprimer
  └── hooks/useHeroAnimation.ts          ← fusionner ou supprimer

PERSONNAGE : 2 systèmes
  ├── components/character/ (Meshy, branché, non-modulaire)
  └── src/rpg/characters/ (Quaternius, orphelin, modulaire)   ← LE FORK

GAMEPLAY RPG : 1 seul (pas de conflit)
  └── src/rpg/{elements,classes,skills}  ← à brancher au jeu
```

---

## 6. Fait — Refonte runtime (Option A : Quaternius modulaire canonique)

Décision validée : **Quaternius modulaire** devient le système canonique.
L'ancien runtime FPS/Meshy/caméra/animation/déplacement a été **supprimé**.

### Nouveau runtime créé dans `src/rpg/`
| Fichier | Rôle |
|---|---|
| `runtime/CollisionWorld.ts` | Raycast collision (murs + sol + **caméra TPS**) |
| `runtime/RpgCamera.tsx` | Caméra FPS/TPS web-native (souris, F1/F3, zoom, collision, bobbing) |
| `runtime/PlayerController.tsx` | Déplacement WASD/ZQSD relatif caméra + saut + gravité + collision |
| `animation/AnimationController.ts` | AnimationMixer + crossfade + fallback multi-noms + one-shot |
| `characters/AnimatedModularCharacter.tsx` | Perso modulaire animé (clips embarqués OU animation procédurale) |
| `npc/Npc.tsx` + `npc/npcCatalog.ts` | 19 PNJ Meshy animés + classe assignée (sorts) |
| `runtime/RpgGameWorld.tsx` | Assemble map + joueur + caméra + PNJ + HUD (remplace GameWorld3D) |

### Câblage
- `App.tsx` stage "game" → **`RpgGameWorld`** (genre + classe dérivés du perso).
- Chemins d'assets pointent vers `public/models/` (réorganisé par l'utilisateur).

### Suppressions exécutées (vérifiées orphelines, erreurs tsc 29 → 27)
- ❌ `components/GameWorld3D.tsx`
- ❌ `components/fps/` (FPSCamera, AnimationStateMachine, PlayerController,
  CollisionSystem, MeshyArmsViewModel, ViewModelFPS, WeaponRegistry, …)
- ❌ `components/world/` (environnements, véhicules, téléport, maps-catalog)

⚠️ **Pas de git** dans WebPortal → suppressions NON récupérables. Les retraits
suivants (UI Meshy + hooks/services d'anim + 2D legacy) sont reportés (tâche #9)
car ils cassent le flux create/select et nécessitent un test runtime.

### Limite connue (animation squelettique)
Les parties Quaternius ont un squelette mais **pas de clips**. Le perso joueur
utilise donc une **animation procédurale** (idle breathing + bob de marche).
Pour de vraies anims squelettiques : convertir les FBX Mixamo (Sorceres) en GLB
et retarget sur le squelette Quaternius (`MIXAMO_BONE_MAP` déjà préparé).
Les PNJ Meshy, eux, sont animés nativement (clips embarqués).

### RPG gameplay branché
- 10 éléments + 10 classes + 100 skills (`src/rpg/{elements,classes,skills}`).
- HUD in-game affiche classe + élément + barre de 6 sorts.
- PNJ mappés à une classe (`npcCatalog`) → sorts assignés.

---

## 7. Plan de migration recommandé (par priorité, stabilité d'abord)

### Étape 1 — Décision stratégique (LE FORK, à trancher)
**Quel système de personnage devient canonique ?**
- **Option A — Quaternius modulaire** (`src/rpg`) : vrai modulaire M/F + vêtements
  interchangeables (req #1), mais il faut le brancher + ajouter l'animation +
  remplacer le système Meshy actuel (= refonte du flux create/select/game).
- **Option B — Meshy héros** (`components/character`) : déjà branché et stable,
  mais PAS modulaire (pas de swap vêtements). On y ajoute juste la data RPG.
- **Option C — Hybride** : garder Meshy pour les héros "signature" + Quaternius
  pour les persos "joueur custom". Plus de travail mais le plus riche.

### Étape 2 — Brancher la data RPG (sans conflit, pure valeur)
- Importer `src/rpg/{elements,classes,skills}` dans le gameplay (sorts, VFX, scaling).
- 100 skills + 10 classes + 10 éléments déjà prêts.

### Étape 3 — Consolider l'animation (1 seule source)
- Garder `AnimationStateMachine`, supprimer/fusionner `CharacterAnimationManager`
  + `useHeroAnimation` après vérification des usages.

### Étape 4 — Nettoyage legacy (ciblé, après validation)
- Supprimer les fichiers 2D/Dofus orphelins un par un (build vert après chaque).

---

## 8. Recommandation

Le projet est **plus sain que prévu** : pas de Godot, caméra/anim AAA déjà en place.
Le travail le plus rentable n'est pas de "tout réécrire" mais de :
1. **Trancher le fork personnage** (Option A/B/C)
2. **Brancher la data RPG** (gros gain, zéro risque)
3. **Dédupliquer l'animation**
4. **Nettoyer le legacy ciblé**

Priorité respectée : **stabilité > features, nettoyage > ajout**.