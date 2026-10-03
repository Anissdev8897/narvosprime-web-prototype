# Audit des assets — Système RPG/MMORPG futuriste fantasy

> Généré automatiquement après scan complet des 3 assets fournis.
> Stack cible : React 19 + React Three Fiber 9 + Three.js 0.181 + TypeScript 5.8 (Vite 6).

> **⚠ MISE À JOUR (modèle unique).** Le personnage joueur in-game est désormais
> **uniquement** le Sorcier (`Sorceres_hi_poly`, composant `HumanCharacter`). Le pack
> **`pack50_3DAsset` (ninja) a été retiré** : composant `NinjaCharacter` supprimé,
> constantes `NINJA_PATHS`/`NINJA_ASSET_ROOT` retirées du manifeste, et les fichiers
> mesh/anim correspondants ne sont plus présents sur disque. Les 10 classes partagent
> ce modèle unique ; elles ne diffèrent que par élément, rôle, arme et teinte.
> Les sections ci-dessous reflètent le scan d'origine (valeur historique).

---

## 1. Résumé exécutif

| Asset | Modularité M/F | Rôle retenu | Verdict |
|---|---|---|---|
| **Modular Character Outfits - Fantasy [Standard]** | ✅ COMPLÈTE | **Base personnage jouable** | ✅ **RETENU** |
| **Sorceres_hi_poly** | ❌ Personnage unique | **Source d'animations** (Mixamo) + armes | ✅ RETENU (anims/armes) |
| **pack50_3DAsset** | ❌ Personnage unique | **Source d'animations** (secondaire) | 🟡 RETENU (anims only) |

**Conclusion** : un seul asset (`Modular Character Outfits`) satisfait la contrainte absolue
(modularité complète, homme/femme, parties interchangeables). C'est lui qui sert de
**base de personnalisation**. Les deux autres ne sont PAS des personnages modulaires
mais fournissent les **animations humanoïdes** que le système réutilisera via retarget.

---

## 2. Détail par asset

### 2.1 ✅ Modular Character Outfits - Fantasy [Standard]  (Quaternius)

**Type** : Kit modulaire compatible "Universal Base Characters" (Quaternius, CC0).
**Format web** : glTF (`.gltf` + `.bin`) — dossier `Exports/glTF (Godot-Unreal)/`.
**Textures** : PBR complètes (BaseColor, Normal, ORM/Roughness).

#### Modularité confirmée

| Slot | Female | Male |
|---|---|---|
| Body | ✅ Peasant, Ranger | ✅ Peasant, Ranger |
| Arms | ✅ Peasant, Ranger | ✅ Peasant, Ranger |
| Legs | ✅ Peasant, Ranger | ✅ Peasant, Ranger |
| Feet | ✅ Peasant, Ranger | ✅ Peasant (Boots Ranger) |
| Head | ✅ Ranger (Hood) | ✅ Ranger (Hood) |
| Accessoires | ✅ Pauldrons (Ranger) | ✅ Pauldron (Ranger) |

**Structure** :
```
Exports/glTF (Godot-Unreal)/
  Modular Parts/      ← parties séparées (Arms, Body, Legs, Feet, Head, Acc)
    Female_Peasant_Arms.gltf + .bin
    Female_Ranger_Head_Hood.gltf + .bin
    ... (20 parties)
  Outfits/            ← tenues complètes pré-assemblées
    Female_Peasant.gltf, Female_Ranger.gltf
    Male_Peasant.gltf, Male_Ranger.gltf
  T_*.png             ← textures PBR
```

**Note clé (Readme)** : les vêtements remplacent le corps. Seule la **tête** de la
base est requise (le reste du corps de base cause du clipping → on le masque pour la perf).

**Limites** : 2 thèmes de tenue (Peasant, Ranger) × 2 genres. À étendre avec d'autres
packs Quaternius (CC0) ou en re-texturant via le système de recoloration PBR.

---

### 2.2 ✅ Sorceres_hi_poly  (personnage Mixamo + animations)

**Type** : Personnage unique (Sorcerer) riggé **Mixamo** + ~60 animations + armes.
**Format** : FBX (perso + anims), GLB (armes).
**Modularité** : ❌ NON (mesh mono-bloc) → **NON retenu comme personnage jouable**.
**Rôle retenu** : **banque d'animations** (squelette Mixamo standard) + **armes GLB**.

#### Meshes
- `Sorcerer_hi_poly.fbx` (haute déf) + `Sorcerer_mid_poly.fbx` (LOD)

#### Armes (GLB — directement utilisables web)
- `arcane+staff+3d+model_epic_GLB.glb`  → staff épique
- `fantasy+staff+3d+model_GLB.glb`       → staff fantasy
- `wooden+wand+3d+model_GLB.glb`         → baguette
- `fantasy+robe+character+3d+model_GLB.glb` → robe (personnage entier)

#### Animations disponibles (~60, squelette Mixamo)
- **Idle** : Breathing Idle, Idle, Standing Idle 02/03/04
- **Walk** : Standing Walk Forward / Back / Left / Right
- **Run**  : Running, Standing Run Forward / Back / Left / Right
- **Sprint** : Standing Sprint Forward
- **Jump** : Standing Jump, Standing Jump Running (+ Landing)
- **Cast** : Standing 1H Magic Attack 01-03, Standing 2H Magic Attack 01-05
- **Channeling** : Standing 2H Cast Spell 01
- **AOE Cast** : Standing 2H Magic Area Attack 01-02
- **Hit/React** : Standing React Small/Large From Front/Back/Left/Right
- **Death** : Standing React Death Backward / Forward / Left / Right
- **Block** : Standing Block Idle / Start / End / React
- **Crouch** : Crouch Idle, Crouch Walk x4, Crouch Turn L/R
- **Climb** : Climbing Ladder

→ Couvre TOUS les besoins du mapping demandé (Idle/Walk/Run/Sprint/Jump/Attack/Cast/
   Channeling/Hit/Death/Dodge*/Ultimate*). (*) Dodge/Ultimate = mapping fallback.

---

### 2.3 🟡 pack50_3DAsset  (personnage + 6 animations)

**Type** : Personnage unique (noms de fichiers hashés) + 6 animations GLB.
**Format** : GLB (web ✓) + FBX + BLEND.
**Modularité** : ❌ NON → **NON retenu comme personnage jouable**.
**Rôle retenu** : animations secondaires de combat (Kick utile, Die alternatif).

#### Animations (GLB)
| Dossier | Fichier GLB |
|---|---|
| Tpose | `25308929755f462bc54d62ccf849427d.glb` (mesh base) |
| Walk  | `1227dad51cd9005aea4d65a57b7b0cbb.glb` |
| Run   | `c9ee255b85fb84ba825b822262fffac6.glb` |
| Jump  | `9428e3336a7c28ce5e9105ad71ffb573.glb` |
| Kick  | `a2cc6d33d4491cce423287cbb92abd07.glb` |
| Die   | `495e1f4569b892c47acf7370055bd506.glb` |

→ Squelette différent de Mixamo (à vérifier au retarget). Priorité basse :
   on privilégie Sorceres (Mixamo) comme source principale d'animations.

---

## 3. Décision d'architecture

```
PERSONNAGE JOUABLE   = Modular Character Outfits (glTF, M/F, parties swappables)
ANIMATIONS           = Sorceres (Mixamo, 60 anims) → source primaire
                       pack50 (6 anims)            → source secondaire / fallback
ARMES                = Sorceres weapons (staff, wand) GLB
RETARGET             = squelette Mixamo → squelette Quaternius via bone-name mapping
```

**Pipeline retenu** :
1. Charger la base modulaire (corps + parties) en glTF via `GLTFLoader` (R3F `useGLTF`).
2. Charger les clips Mixamo depuis Sorceres, **retarget** sur le squelette de la base.
3. Assembler dynamiquement : `Body + Arms + Legs + Feet + Head + Accessoires + Arme`.
4. Appliquer thème de classe (couleur PBR + emissive + VFX élémentaire).

**Compatibilité animation** : les deux squelettes étant humanoïdes, le retarget se fait
par correspondance de noms d'os (`mixamorig:*` → noms Quaternius). Si un clip manque,
fallback automatique (ex : `dodge` → `roll` → `walk_back` accéléré).

---

## 4. Modèles RETENUS (liste finale)

### Personnages modulaires (jouables)
- ✅ `Female_Peasant` / `Female_Ranger` (+ parties)
- ✅ `Male_Peasant` / `Male_Ranger` (+ parties)
- ✅ 20 parties modulaires (Arms/Body/Legs/Feet/Head/Acc × thème × genre)

### Sources d'animations (non jouables)
- ✅ Sorceres : 60 clips Mixamo
- 🟡 pack50 : 6 clips GLB (secondaire)

### Armes
- ✅ Sorceres : arcane staff, fantasy staff, wooden wand

### IGNORÉS (non conformes à la contrainte modularité)
- ❌ Sorcerer mesh comme personnage jouable (mono-bloc)
- ❌ pack50 character comme personnage jouable (mono-bloc)
- ❌ Tous les `.blend`, `.psd`, `.fbx` redondants (on prend glTF/GLB pour le web)

---

## 5. Prochaines étapes (plan technique)

Voir `src/rpg/ARCHITECTURE.md` pour le détail. Résumé :
1. `loaders/` — chargement glTF modulaire + retarget Mixamo
2. `elements/` — 10 éléments (data + VFX + shaders)
3. `classes/` — 10 classes (data + arme + élément + identité)
4. `animations/` — mapping clips → actions + fallback
5. `skills/` — générateur 10 archétypes × 10 classes = 100+ compétences
6. `characters/` — assemblage modulaire runtime
7. `ui/` — Character Creator (R3F Canvas + panneau de personnalisation)
8. `vfx/` — système de particules/shaders élémentaires
