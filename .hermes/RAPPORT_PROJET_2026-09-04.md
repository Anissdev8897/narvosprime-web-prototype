# Rapport de session — 2026-09-04

Port **nanos world** de NARVOS. Écran de création, garde-robe, apparence.

---

## Métriques à la clôture

| mesure | valeur | commande |
|---|---|---|
| Fichiers Lua du port | 50 | `find WebPortal/Server/nanos_world/packages -name "*.lua" \| wc -l` |
| Pages WebUI (JS) | 4 | `find … -name "*.js" \| wc -l` |
| Harnais de test | 21 `.mjs` | `ls scripts/lua-harness/*.mjs \| wc -l` |
| Générateurs de catalogue | 22 `narvos-*.mjs` | `ls scripts/narvos-*.mjs \| wc -l` |
| **Assertions Lua** | **881, 0 échec** | boucle sur les 15 harnais |
| Fichiers `node --check` | 43 | `node scripts/lua-harness/syntaxe-check.mjs` |
| Assets cuits (pack narvos) | 11 067 | `grep -c` sur `Assets.toml` |
| Références mortes | 0 | `node scripts/narvos-verifier-catalogues.mjs` |

---

## 1. Apparence — silhouette et couleurs, branchées de bout en bout

`Shared/Logic/Apparence.lua` existait mais n'était **câblé nulle part**. Chaîne
complète posée : écran → aperçu → base → spawn → rhabillage.

### Pourquoi ce module existe à côté de `Morphs.lua`

Les deux corps Stylized — Opérateur et Valkiria, ceux que le joueur choisit en
pratique — n'ont **aucun morph target**. Et `SetMorphTarget(name, value)` n'a pas
d'`attachable_id` : il ne touche que le mesh de BASE, qui est caché. Sans ce
module, ces corps n'auraient **strictement aucun réglage**.

`SetMaterialColorParameter(param, Color, index, attachable_id)` **a** un
`attachable_id`. Toute l'architecture découle de cette asymétrie.

### Ce qui n'est pas recolorable : la peau

Sondé sur les 27 matériaux du pack (`scripts/adk-sonder-parametres-materiaux.py`) :
`MI_Body` et `MI_Female_Body` n'exposent **aucun paramètre vectoriel** — leur
teinte est cuite dans la texture. Recolorables : vêtements (`Color 1` / `Color 2`),
yeux (`Color 1`), cheveux (`Hair Color`).

Proposer un curseur de teint qui ne ferait rien serait pire que ne rien proposer.

### Deux conventions à ne pas confondre

| donnée | table | préfixe | application |
|---|---|---|---|
| morphs de visage | `morphs` | aucun | `SetMorphTarget` |
| macros de corps | `morphs` | `@` | `SetMorphTarget` |
| **silhouette** | `morphs` | **`#`** | **`SetScale`** |
| **couleurs** | `couleurs` | — | `SetMaterialColorParameter` |

La silhouette voyage dans la table des morphs parce qu'elle se **persiste** avec
elle (une colonne, une migration), mais ne s'**applique** pas par le même chemin.
Bornée à ±12 % : au-delà, la capsule de collision — calculée sur les bounds du
mesh au spawn — ne suit plus la silhouette.

**Hauteur en Z, largeur en X/Y.** Unreal est Z-up ; intervertir aplatit le
personnage au sol sans lever d'erreur, ce qui se lit comme un bug de modèle.

### Ordre d'application, non négociable

Dans `Builder.Habiller` : **pièces → morphs → apparence**, cette dernière recevant
la table des slots réellement posés. Une teinte vise une pièce par son
`attachable_id`, qui n'existe qu'une fois la pièce attachée ; appelée plus tôt,
elle ne peint rien **sans erreur**. Et il faut réappliquer à chaque rhabillage :
`AddSkeletalMeshAttached` repose un matériau neuf, sans teinte.

---

## 2. Quatre défauts silencieux, trouvés en branchant

### 2.1 `Roster.EncoderCouleurs` itérait une liste morte

- **Symptôme** : rien. Les couleurs partaient en base **effacées**.
- **Cause racine** : la fonction itérait `{ "skin", "hair", "jacket" }`, palette
  héritée de la base Dofus. Les vraies cibles s'appellent `tenue`, `tenue2`,
  `yeux`, `cheveux` : aucune clé ne correspondait, `table.concat` rendait `""`.
- **Ironie** : son propre commentaire mettait en garde contre exactement cette
  panne, un cran plus bas (`ne pas réutiliser EncoderTenue`). Elle est revenue un
  cran plus haut.
- **Correctif** : `Shared/Logic/Roster.lua` — itère `Apparence.CIBLES`, le
  catalogue. Ajout de `Roster.DecoderCouleurs`, symétrique et normalisante.
- **Règle** : **une liste de clés recopiée finit toujours par diverger de sa
  source.** Itérer le catalogue, jamais une copie.

### 2.2 `Creation.Construire` rendait `COULEURS_DEFAUT`

- **Symptôme** : le choix du joueur était jeté à l'endroit exact censé le porter.
- **Cause racine** : `colors = { skin = …, hair = …, jacket = … }` écrit en dur,
  conservé « parce que le schéma persisté les attend ».
- **Correctif** : `Shared/Logic/CharacterCreation.lua` — `colors` transmis tel
  quel ; `COULEURS_DEFAUT` **supprimée**.
- **Règle** : **une valeur morte gardée « au cas où » n'est pas neutre.** Elle
  occupe la place de la vraie et la masque le jour où celle-ci arrive.

### 2.3 `Rhabiller` perdait les morphs et les couleurs

- **Symptôme** : acheter une chemise remettait le visage au neutre et effaçait
  les teintes. Rien ne le signalait — le personnage changeait, c'était l'effet
  attendu.
- **Cause racine** : `Server/Vestiaire.lua` appelait `Habiller(character, corps,
  tenue)` sans les 4ᵉ et 5ᵉ arguments. `Morphs.Resoudre(nil)` rend une table vide,
  et les pièces ré-attachées avaient un matériau neuf.
- **Correctif** : `Server/Vestiaire.lua:144`.

### 2.4 `perso.equipement` — un champ qui n'existe pas

- **Symptôme** : les vêtements achetés n'étaient **jamais portés après
  reconnexion**.
- **Preuve** : `grep -rn "equipement" --include=*.lua packages/` → **une seule**
  occurrence, la lecture. Les vêtements portés vivent dans `perso.gardeRobe.porte`.
- **Pourquoi c'était muet** : `pairs(nil or {})` itère une table vide sans
  broncher, et le personnage sortait habillé — de son identité seule.
- **Correctif** : `Server/Index.lua:273` — délègue à `Vestiaire.Tenue`, la MÊME
  fonction qu'emploie le rhabillage en jeu.
- **Règle** : deux fusions écrites séparément divergent. Celle-ci ne se voyait
  qu'après une reconnexion.

---

## 3. Frontière création / marchand — elle a cédé deux fois

**LA CRÉATION DONNE UN CORPS, LE MARCHAND L'HABILLE.**

`Vestiaire.Identites` a rendu un temps **toutes** les pièces de la famille,
registres de boutique compris. L'écran offrait sept torses, dont six à vendre :
le joueur composait gratuitement ce que le tailleur devait lui vendre.

Rien ne le signalait — l'écran marchait *mieux* qu'avant.

Filtre rétabli sur le registre `base`. **Trois tests le verrouillent maintenant
dans les deux sens** (`vestiaire-tests.lua`) : aucune pièce vendable à la
création, aucun trait d'identité en boutique, et au moins un slot garde un vrai
choix.

Reste après filtrage : 3 visages par genre sur `stylized` ; sur `mpfb`, une pièce
par slot, donc l'étape n'affiche que silhouette et couleurs — avec un message qui
le dit, plutôt qu'un panneau vide qui se lirait comme une panne.

---

## 4. Le garde-fou qui ne gardait qu'un tiers du terrain

Trois backticks glissés dans du texte Lua ont cassé trois générateurs
`narvos-*.mjs` (ils terminent le template literal JS). J'ai ajouté un
`node --check` — **sur les seuls fichiers `narvos-*`**.

La **quatrième** occurrence, le même jour, était dans `parcours.mjs` et
`roster.mjs` : des harnais, donc hors du filtre. Le garde-fou était en place et
n'a rien vu.

**Règle.** Le filtre doit porter sur la **forme** du défaut, pas sur le **lieu**
du premier incident. La forme ici : « du texte Lua interpolé dans un template
literal JS » — elle vit partout où un `.mjs` fabrique du Lua.

`syntaxe-check.mjs` couvre désormais `scripts/narvos-*.mjs` **et**
`scripts/lua-harness/*.mjs` : 43 fichiers au lieu de 22.

---

## 5. Audit multi-agents — INTERROMPU

7 dimensions en parallèle + réfutation adversariale à deux lentilles. **Arrêté
manuellement** à ~53 agents (coût de contexte).

- **68 constats bruts** → `.hermes/AUDIT_CREATION_2026-09-04.md`
- **58 verdicts de réfutation sur ~136 attendus, dont 31 réfutations**

**Aucun constat n'est confirmé.** Plus d'une piste jugée sur deux était fausse —
c'est la raison d'être de l'étape de réfutation, et elle n'a pas fini de tourner.
Corriger sur cette liste sans relire le code reviendrait à modifier du code qui
marche.

Un seul a été vérifié à la main et corrigé : `perso.equipement` (§2.4).

Pistes lourdes restant à vérifier : `Macros.Resoudre` n'émettrait aucun zéro ·
`Modular.TENUE_BASE` référencerait 15 pièces absentes · `Weapons.lua`, 12
références mortes · `Assets.toml`, 19,1 Go de poids mort sur 32,0.

---

## 6. Mutable — deux verdicts antérieurs étaient faux

Relevé dans la source UE 5.7 sur disque
(`D:/Epic Games/UE_5.7/Engine/Plugins/Mutable/Source/CustomizableObject/Public/MuCO/`) :

| ce qui était écrit | ce qui est vrai |
|---|---|
| « client nanos sans binaire → runtime impossible, définitivement » | **Mutable est dans les plugins NATIFS whitelistés** de nanos |
| « nanos fait déjà la modularité, mauvais outil » | vrai pour la modularité, **faux pour ce qui compte** : l'attachement ne sait pas masquer les sections du corps sous un vêtement |

**Le chemin Blueprint pur existe. Aucun C++ à écrire.**

- `UCustomizableSkeletalComponent` — `Blueprintable, BlueprintType,
  BlueprintSpawnableComponent`, 10 fonctions `BlueprintCallable`
- `UCustomizableObjectInstance` — ~30 `BlueprintCallable`
  (`SetIntParameterSelectedOption`, `SetColorParameterSelectedOption`…)
- `ACustomizableSkeletalMeshActor` — `UCLASS(Blueprintable)`, on en dérive un BP
- `UpdateSkeletalMeshAsync` + `UpdatedDelegate` (`BlueprintAssignable`)

**Le BP est nécessairement événementiel** : poser les paramètres, lancer
l'update, **attendre le délégué**. Lire le mesh à la ligne suivante ne rend rien.
C'est ce que voulait dire Sayato par « ça fonctionne par threads ».

**Le blocage restant n'est pas Mutable, c'est le pont.** `Character` ne traverse
pas vers le Blueprint, et `Character:SetMesh` prend un chemin d'asset — un mesh
généré au runtime n'en a pas. Comment le corps fusionné rejoint le `Character`
nanos reste **non prouvé**.

### Correction de perf, aussi

`AddSkeletalMeshAttached` a `use_base_leader_pose_component = true` par défaut :
les pièces attachées **n'évaluent pas leur propre anim graph**, elles copient les
transforms du leader. **Une évaluation par personnage, pas une par pièce.**

Le coût réel est ailleurs : **9 composants skeletal par joueur** (corps + 8
slots) → draw calls, skinning GPU, tick par composant. 450 pour 50 joueurs,
3 600 pour 400. C'est ça que Mutable réduit à un mesh et un matériau.

---

## 7. Samples Unreal — ce qui est récupérable

`C:\Users\aniss\OneDrive\Documents\Unreal Projects\` — les deux en **UE 5.7**,
même version que l'ADK. **`Mutable` est déjà activé dans `NanosWorldADK.uproject`.**

### GameAnimationSample — la trouvaille

`Content/Characters/UE4_Mannequin/Rigs/RTG_UEFN_to_UE4_Mannequin.uasset` : un IK
Retargeter **écrit par Epic**, UEFN → **UE4 Mannequin, qui EST le squelette
nanos** (68 os). Plus `RTG_UE5Manny_UE4Manny` dans CoreC.

Derrière : **1 701 animations**, 1,9 Go —
Run 360 · Walk 353 · Crouch 215 · MotionMatching 193 · Traversal 143 · Jump 142 ·
Sprint 65 · Idle 47 · AimOffset 45 · Slide 40 · Poses 40 · Interactions 27.

C'est la voie directe pour **« animations de locomotion multiples »**, ouvert
depuis des semaines. Pas de correspondance d'os à deviner.

⚠ Non prouvé : nanos joue l'animation en Lua par `PlayAnimation`, pas par AnimBP.
Qu'un AnimBP de motion matching se cuise dans un asset pack reste à démontrer.
Les AnimSequences retargetées, elles, sont des assets ordinaires.

Plugins whitelistés parmi les siens : AnimationWarping, RigLogic,
LiveLinkControlRig, PoseSearch, AnimationLocomotionLibrary, MotionWarping,
HairStrands, Chooser, Mover. **Hors whitelist** : LiveLink seul,
NetworkPrediction, SmartObjects, Locomotor, CurveExpression, GameplayInteractions.

### CoreC — découpage identique au nôtre, mauvais squelette

Face, Eyes, Teeth, Torso, Legs, Hands, Feet en M **et** F, un ensemble Techwear
(Upper/Lower/Shoes), deux coiffures. Exactement nos slots. Mais bindé à
`SK_Mannequin` (UE5).

### MutableSample — la méthode

Clipping meshes (masquer le corps sous un vêtement), remove mesh, blend shapes
avec normal maps par morphologie, skin variations par texture, stickers
multicouches, modular pants, casque multimatériau, grooms Hair Strands.

⚠ Squelette `SKEL_BaseBody` : **spine_01..05 + neck_01/02**, topologie
MetaHuman/UE5. nanos veut spine_01..03 + neck_01.

**Les meshes des deux packs ne se transposent pas. La méthode, si. Le
retargeter d'animation, lui, franchit ce mur — c'est son rôle.**

### Licence — à trancher avant de livrer

Contenu Epic (samples, Paragon, MetaHumans) licencié pour produits Unreal Engine.
nanos EST Unreal, mais **non vérifié** que redistribuer via un asset pack nanos
entre dans le cadre.

---

## 8. Ce qui n'a jamais été vu tourner

Rien de cette session n'a été observé en jeu. Ni les couleurs, ni la silhouette,
ni l'orbite caméra, ni les vêtements du corps morphable, ni le corps morphable
debout. Les 881 assertions prouvent la logique, pas le rendu.

---

## Reste ouvert

1. Vérifier les 67 pistes non confirmées de l'audit — **une par une, contre le code**
2. Retarget des 1 701 animations UEFN → UE4 Mannequin (script `adk-retarget-anims.py`)
3. `BP_Test` Mutable minimal + `BindBlueprintEventDispatcher` — le baby step de Sayato
4. Coiffures : mesurer l'offset ou réexporter, puis `COIFFURES_ACTIVES = true`
5. 5 monstres bloqués KTX2 · 25 PNJ sans mesh · 15 descriptions de faction vides
6. Retirer les sondes de diagnostic (`sonde`, traces `Apercu` / `CreerPerso`)
7. Tri des assets : 65 Go identifiés, **rien supprimé**
8. La peau non recolorable — demanderait un matériau parent avec paramètre