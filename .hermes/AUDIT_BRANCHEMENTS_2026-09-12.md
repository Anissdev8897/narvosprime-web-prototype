# Audit de BRANCHEMENT — 2026-09-12

Règle appliquée (demandée par Hanibes) : **asset présent ≠ système branché**.
Trois états, et un seul est une preuve :

- ✅ **vu en jeu** — un journal ou une capture le montre
- 🟡 **branché, jamais vu** — référencé, appelé par la logique, atteignable par une touche
- ❌ **non branché** — l'asset existe, rien ne l'appelle

---

## 1. Système modulaire — ce qui a changé cette nuit

| avant | après | preuve |
|---|---|---|
| 42 pièces, 1 famille | **119 pièces, 7 corps, 5 familles** | sortie du générateur |
| slots `bras`, `épaules`, `pieds` vides | garnis | `Modular.SLOTS` |
| 0 pièce Trooper | 76 (M 32, F 22, PF 22) | catalogue |
| 0 pièce Defender | 3 (les 15 grises sont écartées, motivé) | catalogue |

**Trois causes trouvées, toutes silencieuses :**

1. **Le builder de pack taisait les Blueprints** (correctif du 11/09) : 257 BP cuits
   n'étaient jamais déclarés — dont TOUT le Meta Customization System.
2. **Le générateur lisait des dossiers GLB**, pas le pack cuit. Il produisait 94
   pièces Trooper… écartées juste après par la règle « famille sans corps », en
   une ligne de console. Le jeu n'en a jamais vu une seule.
3. **Ma propre portée de recherche était fausse** : j'ai conclu que les corps nus
   `SK_*_Form_*` « n'avaient jamais été cuits ». Ils sont importés, cuits ET
   déclarés depuis le début, dans `Narvos/Meshes/BodyForms/` — un dossier voisin
   de `Trooper_Set/` que mon manifeste ne regardait pas. Mesurés : 182 cm (M),
   180 (F), 173 (PF), deux textures de projet chacun, zéro slot vide.

**Chaîne obtenue** : `corps nu → peau → pièces modulaires → armure`, avec une
tenue nue par famille (tête comprise, donc le porteur devient cachable).

**Gardes ajoutées** (une preuve dans un fichier, jamais un drapeau) :
- `scripts/narvos-manifeste-squelettes.mjs` — prouve clé par clé l'attachement à
  `SKEL_Mannequin`. Mesure : Trooper 94/94, Defender 18/18, MetaCustom **0/57**
  (Skel_Dummy / metahuman_base_skel — d'où le pont, ou le BP, jamais l'attachement).
- garde « pièce grise » : une pièce sans AUCUNE texture de projet n'entre pas au
  catalogue, et l'en-tête généré dit lesquelles et pourquoi.

**Contrôles** : `Aucune reference morte` · **7184 assertions, 0 rouge**
(7087 avant : +97, aucune régression).

**Aucun cook n'est nécessaire** pour cette partie : ces assets étaient déjà cuits.

---

## 2. LE VIRAGE : piloter les Blueprints, ne pas les réimplémenter

Hanibes le répétait depuis deux jours. C'est maintenant **mesuré** :

- `Blueprint:CallBlueprintEvent(nom, args…)` est d'autorité **BOTH** — le serveur
  déclenche la logique d'un Blueprint Unreal (`Stable/Classes/Blueprint.json`).
  `SetBlueprintPropertyValue` et les dispatchers sont **client seulement**.
- `BP_Playable_MH` **dérive de Character** : CollisionCylinder, CharacterMesh0,
  CharMoveComp, SpringArm, Camera — plus Body, Face, Torso, Legs, Feet, Prop,
  Orc_Teeth, LODSync et six Grooms (Hair, Beard, Eyebrows, Eyelashes, Fuzz,
  Mustache).
- Son API de personnalisation, relevée dans la table de noms du paquet :
  `Change_Top`, `Change_Bottoms`, `Change_Shoes`, `Change_Outfit`, `Change_Prop`,
  `Change_Hair`, `Change_Hair_Colour`, `Change_Eyes`, `Change_Skin`,
  `Change_Skin_Mat`, `Change_Skin_Tint`, `Change_Skin_Color_Value`,
  `Change_Tattoo`, `Change_face`, `FaceTypeSlider`, `EyeBrow_Slider`,
  `Eye_Color_Inner_Value`… → `.hermes/API_BP_METACUSTOM_2026-09-12.md`.

⚠ L'éditeur ne sait PAS lister ces fonctions : `dir()` sur l'objet par défaut
d'une classe générée rend **zéro** fonction Blueprint. L'outil qui les lit est
`scripts/narvos-noms-uasset.mjs`, et il marche éditeur fermé.

**Conséquence** : le pont par retarget (14 pièces, vu en jeu le 11/09) reste un
repli utile, mais ce n'est plus la voie principale pour MetaHuman. La voie
principale est : spawner le BP et l'appeler par événements.

---

## 3. Locomotion — verdict mesuré

- L'API nanos veut des **Blend Spaces 2D** :
  `SetAnimationIdleWalkRunStanding / Crouching / Proning`, plus `SetGaitMode`,
  `SetStanceMode` (autorité serveur).
- **Aucun de ces appels n'existe dans notre code.** Seul `SetSpeedMultiplier` est
  utilisé (classe, voyage, commande de vitesse).
- Le pack ne déclare **qu'un seul** blend space : `BS_EnemyWalk`. Deux autres sont
  cuits mais non déclarés (`BS_MM_WalkRun`, `BS_MF_Unarmed_WalkRun`) ; l'ADK en
  contient 33 au total, dont les `BlendSpace1D` et les `AimOffset*` que le builder
  **n'expose pas** (classes absentes de `SECTION_PAR_CLASSE`).

**Donc la locomotion du jeu est celle du moteur nanos**, sur le squelette
`SKEL_Mannequin` — ce qui explique que les personnages marchent correctement
alors que nos 3 480 animations cuites ne servent qu'aux emotes, au combat et aux
PNJ. ❌ Notre locomotion n'est pas branchée.

---

## 4. PNJ — taille et textures

- **Bornes des meshes** : 210 personnages mesurés, **aucun géant**. Le plus grand
  fait 2,00 m ; les corps Defender/Trooper jamais mesurés jusqu'ici sont entre
  1,88 et 1,95 m.
- Donc les géants vus en jeu **ne viennent pas du catalogue** : un squelette
  importé peut porter une échelle sur son os racine, que les bornes ne voient pas.
  Seule la mesure EN JEU tranche — `/diag` côté client, module déjà écrit.
  **À faire au prochain test : se placer près d'un géant et lancer `/diag`.**
- **Textures** : un seul PNJ gris (`mob_boss`). Côté modulaire : 15 pièces Defender
  grises (leurs instances `MI_UE4ModularCharacter1..5` ont gardé leur parent mais
  ZÉRO surcharge de texture) — écartées du catalogue, réparables en séance éditeur.

---

## 5. Corrigé cette nuit (à voir au prochain test)

| quoi | état |
|---|---|
| Batte au spawn retirée (`ARME_PAR_CLASSE` supprimée, table morte incluse) | 🟡 |
| Radar : `player:GetLocation()` → le CHARACTER (erreur toutes les 600 ms) | 🟡 |
| Widget interface déclaré mais non spawnable (`interface = true`) | 🟡 |

## 6. Inventaire / craft / armes — ce qui est branché aujourd'hui

| système | touche / voie | état |
|---|---|---|
| Inventaire | **I** — grille persistée en base | 🟡 |
| Roue d'objets | **TAB** — 5 emplacements, équipe depuis le sac | 🟡 |
| Craft | **par PROXIMITÉ** d'un atelier (aucune touche) ; 43 plans | 🟡 |
| Armes à feu | `Weapons.Donner` via la roue ou `/arme` | 🟡 |
| Mêlée | `CombatServeur.Equiper`, rangement **V** | 🟡 |
| Équipement porté | ❌ non persisté (`equipment = {}`) |
| Son de tir du fusil à pompe | ❌ `A_Moss500_Shot` absent du pack de base (erreur serveur vue le 11/09) |

---

## Ordre proposé pour demain

1. **Éditeur** : réparer les 15 instances Defender (textures), puis re-mesurer —
   les pièces rentrent au catalogue toutes seules.
2. **BP maître** : spawner `BP_Playable_MH` attaché au joueur et appeler
   `Change_Skin` / `Change_Top` / `Change_Hair` depuis le serveur. Un seul appel
   réel suffit à valider ou invalider toute la voie.
3. **Locomotion** : fabriquer 2-3 blend spaces sur `SKEL_Mannequin` depuis nos
   animations déjà cuites, exposer `BlendSpace1D` dans le builder, puis appeler
   `SetAnimationIdleWalkRunStanding` à l'apparition.
4. **En jeu** : `/diag` près d'un géant — c'est la seule mesure qui tranche.
5. Cook map + BP, puis reconstruction du pack.

---

## 7. Écrit APRÈS la première version de ce rapport (même nuit)

| quoi | fichier | état |
|---|---|---|
| Module qui **pilote** le Meta Customization System par `CallBlueprintEvent` | `narvos-map-proto/Server/MetaHumainBP.lua` | 🟡 câblé, jamais appelé en jeu |
| Commande d'essai `/mhbp` (admin) : poser / cacher / retirer / appeler un événement | `Server/Index.lua` | 🟡 |
| Commande d'essai `/locomotion` (admin) : pose un blend space de déplacement | `Server/Index.lua` | 🟡 |
| Builder : `BlendSpace1D`, `AimOffsetBlendSpace`, `AimOffsetBlendSpace1D` exposés | `scripts/nanos-build-asset-pack.mjs` | effectif au prochain build du pack |

**Mesure des actions/animations** (question 3 de Hanibes) :
3 445 animations au catalogue, 166 émotes — et **4 points d'appel `PlayAnimation`
dans tout le serveur** (émotes, PNJ au repos, animaux, combat). La chaîne
Prototype → Action → Animation → Character → Gameplay n'est donc câblée que pour
les émotes et le combat ; le reste du catalogue est inatteignable.

**Craft et vestiaire, vérifiés au niveau du code APPELÉ :**
- `Narvos:Crafter` → `Fabriquer()` → `Craft.Fabriquer(grille, recette, station, niveau)`
  retire les entrées et rend la grille, puis sauvegarde. ✅ la boucle est fermée.
- `Vestiaire.Porter` → valide la famille et le genre → enregistre → **`Rhabiller`
  applique au personnage vivant**. ✅ la boucle est fermée.
- Reste ouvert : l'équipement porté n'est toujours pas persisté (`equipment = {}`).

## 8. À faire au prochain test, dans cet ordre

```
/mhbp poser            puis regarder : un MetaHuman apparaît-il sur le personnage ?
/mhbp cacher           masque le mesh nanos dessous
/mhbp Change_Top 2     le haut change-t-il ? (le verdict est à l'écran)
/locomotion narvos::BS_EnemyWalk    puis marcher — la démarche change-t-elle ?
/diag                  en se plaçant près d'un géant
```

Ces cinq lignes tranchent trois questions ouvertes : le Meta Customization System
se pilote-t-il depuis nanos, notre locomotion est-elle posable, et d'où vient la
taille des géants.