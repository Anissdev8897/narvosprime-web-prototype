# Inventaire des animations de métier — lot 5

Pour l'agent Hermes. Rédigé le 2026-09-07, après validation du lot 4.

## Le lot 4 est validé

92 assertions vertes, câblage correct dans `Shared/Index.lua`, et le piège des
`uid` traité par un plan `(uid, prise)` appliqué sur un instantané — c'était la
vraie difficulté, elle est bien résolue. Ton atomicité par construction est
meilleure que le rollback que je proposais.

Deux remarques, l'une pour toi, l'autre contre moi :

- **Le craft n'a pas été porté.** 7 recettes inventées contre 9 dans
  `craftingSystem.ts`, zéro identifiant commun, station `refinery` disparue. Ton
  motif écrit — « aucun item n'est inventé ici » — ne tient pas : j'ai vérifié
  les 13 ingrédients des 9 recettes TS, **tous les 13 sont dans les 26 objets**.
  Le portage était possible tel quel.
- **Sur la récolte, tu ne pouvais pas obéir, et c'est ma faute.**
  `professionCatalog.ts` déclare 42 ressources dont **zéro sur 42** n'existe dans
  les 26 objets. Mon brief disait « porte `professions/` » ET « ne crée aucun
  objet ». Incompatible. Ta sortie était la bonne.

---

# La tâche : dire ce que le personnage sait faire, et ce qu'il ne sait pas

NARVOS a sept métiers. Il faut savoir, **fichier par fichier**, quelles
animations existent pour chacun.

```
minage · forge · travail du bois · couture · alchimie · récolte · fabrication
```

## ⚠ LE PIÈGE, ET IL M'A EU

**Je me suis planté sur cette question ce matin, deux fois de suite.**

D'abord j'ai annoncé « **0 animation de forge** » sur 3 169 animations cuites.
C'était faux : elles existent, elles s'appellent **`ANIM_IP_*`** — *in place* —
et pas « forge », ni « blacksmith », ni « anvil ». Vingt animations complètes
(`hit_loop`, `three_hit_loop`, `polish_loop`, `inspect`, `get_tools`,
`put_away_tools`, `discuss`, `customer_idle`) que mon filtre par mot-clé a
toutes ratées.

Ensuite j'ai failli annoncer « 436 animations de bûcheron » : mon motif
contenait `axe`, qui matche **Rel*axe*d**.

**Conclusion : ne cherche pas par mot-clé.** Un nom d'animation ne dit pas le
métier. Il faut **énumérer puis classer**, pas filtrer.

## Où chercher — les trois emplacements, ils ne disent pas la même chose

| emplacement | ce que ça contient | comment le lire |
|---|---|---|
| `WebPortal/Server/Assets/narvos/Assets.toml` | ce qui est **CUIT**, donc jouable aujourd'hui | section `[assets.animations]`, 3 169 entrées |
| `WebPortal/Server/adk/Content/Narvos/` | ce qui est dans l'éditeur, cuit **ou pas** | `*.uasset` |
| `WebPortal/public/models/animations/` et `public/asset_game/` | GLB/FBX **jamais importés** | fichiers bruts |

Un pack peut être dans l'ADK sans être dans le pack cuit — c'est le cas de
plusieurs, et la différence est ce qui décide du travail à faire.

## Ce que tu produis

`.hermes/ANIMATIONS_METIERS.md`, avec :

### 1. Un tableau par métier

Pour chacun des sept, et **avec les noms d'assets exacts** :

| état | ce que ça veut dire |
|---|---|
| **CUIT** | dans `Assets.toml`, utilisable dès maintenant |
| **ADK** | dans l'éditeur, absent du pack — un cook suffit |
| **DISQUE** | GLB/FBX non importé — import + cook |
| **ABSENT** | rien, nulle part |

### 2. Les réemplois possibles

Une animation de marteau sert au **minage** autant qu'à la **forge**. Un
ramassage au sol sert à la **récolte**. Dis lesquelles se réemploient et pour
quel métier — c'est ce qui évite d'acheter ce qu'on a déjà.

### 3. Les squelettes

nanos impose **`SKEL_Mannequin`, le Mannequin UE4, 68 os** — pas Manny UE5, qui
en a 89. Une animation sur un autre squelette exige un retargeting.

Pour chaque pack trouvé, dis sur quel squelette il est. `scripts/adk-verify-skeletons.py`
et `scripts/narvos-skeleton-compat.mjs` existent déjà — lis-les avant d'écrire
quoi que ce soit de neuf.

### 4. Ce qui manque vraiment

La liste courte de ce qu'aucun asset du dépôt ne couvre. **C'est la section qui
sert à décider un achat**, donc sois précis : « aucune animation de couture,
vérifié sur les trois emplacements » vaut mieux que « il manque des animations ».

## Ce que tu ne fais pas

- **Aucune modification de fichier du jeu.** Ce lot est un **relevé**. Tu écris
  un seul fichier, `.hermes/ANIMATIONS_METIERS.md`.
- Pas d'import, pas de cook, pas de retargeting.
- N'invente aucun nom d'asset. Si tu ne l'as pas vu sur disque, il n'existe pas.

## Ce que je sais déjà, et que tu dois vérifier plutôt que recopier

Relevé le 2026-09-07 sur `Assets.toml` seul — **incomplet par construction**,
puisque je n'ai regardé ni l'ADK ni le disque :

- **forge / fabrication** — 20 `ANIM_IP_*` (pack `Narvos/BlacksmithAnimations`,
  205 uasset dans l'ADK)
- **récolte** — 17 `Loot_*` / `PickUp`, plus 10 `Loot_TableTop_*`
- **postures assises** — 72 `sit_*`
- **minage** — rien trouvé sous ce nom ; `ANIM_IP_hit_loop` est un coup de
  marteau, à évaluer en réemploi
- **bois, couture, alchimie** — rien trouvé

⚠ **Ces chiffres sont les miens et ils ont déjà été faux une fois.** Recompte.
Si tu me contredis avec une mesure, tu as raison — c'est arrivé aux lots 1 et 4.

## Vérifie

Colle les commandes que tu as réellement lancées et leur sortie. Un compte sans
la commande qui l'a produit ne vaut rien sur ce dépôt : plusieurs opérations s'y
sont déjà déclarées réussies sans avoir rien écrit.

---

# Pour information — ce que j'ai trouvé sur Fab

Ne t'en sers pas comme source ; c'est le contexte de la décision qui suivra ton
relevé. Deux paquets couvrent nos trous, **tous deux sur le rig UE4**, donc sur
notre squelette sans retargeting :

| paquet | prix | note | ce qu'il couvre |
|---|---|---|---|
| **Crafting Animations** (Excalibur Studios) | 15,48–25,81 € | 5,0/5 | **potion + mortier et pilon**, abattage d'arbre, fendage de bois, minage, forge, cuisine, poterie, orpaillage |
| **Crafting Anims** (Explosive LLC) | 25,81 € | 3,3/5 | 130 anims : martelage, hachage, creusage, sciage, ramassage, portage, escalade |

**Aucun des deux ne couvre la couture.** Et « 37 Blacksmith NPC Mocap
Animations » correspond très probablement au pack qu'on possède déjà — ton
relevé le confirmera ou l'infirmera.

---

# Tâche 2 — Inventaire des RESSOURCES : minerais, cristaux, matières

Même méthode, même rigueur, autre sujet. **Ce qu'un mineur peut réellement
extraire, et à quoi ça ressemble à l'écran.**

## Le trou est écrit dans notre propre code

`WebPortal/src/rpg/professions/harvestModelCatalog.ts`, en commentaire :

> « les *24 Free Ores and Minerals* sont des PNG (icônes 2D), pas des meshes —
> le métier **MINEUR** conserve donc son **rocher procédural** »

Un métier entier tourne sur un caillou générique faute de modèles. Le bûcheron,
lui, a ses **8 arbres** câblés dans ce même fichier. Va lire comment il est
branché : c'est le gabarit à reproduire.

## Ce que tu relèves

Pour chaque ressource ou matière trouvée dans le dépôt :

| colonne | ce qu'on veut |
|---|---|
| nom | l'identifiant exact de l'asset |
| forme | **mesh 3D** (GLB/FBX/uasset) ou **icône 2D** seulement |
| emplacement | CUIT / ADK / DISQUE (mêmes trois seaux que la tâche 1) |
| registre | apparaît-il dans un catalogue ? (`Items.lua`, `professionCatalog.ts`, `harvestModelCatalog.ts`…) |
| ton | médiéval-fantasy ou **sci-fi** |

**La colonne « ton » décide.** NARVOS est futuriste-fantasy : un minerai de fer
médiéval et un cristal de plasma ne se rangent pas au même endroit. Dis lesquels
sont utilisables tels quels et lesquels jureraient.

## Trois points de départ MESURÉS, à vérifier et non à recopier

1. **16 meshes GLB de matières**, jamais importés dans l'ADK —
   `public/models/systemes/RPGEngineUltimateMultip/RPG_Engine/CraftingSystem/Meshes/` :
   `SM_OreMetal` `SM_Metal` `SM_Cooper` `SM_Glass` `SM_Gunpowder` `SM_CompLens`
   `SM_Microchip` `SM_Transistor` `SM_Screw` `SM_Nylon` `SM_Rubber` `SM_Leather`
   `SM_Textile` `SM_Leaf` `SM_Stick` `SM_Lamp`.
   ⚠ **Zéro sur seize est dans le pack cuit** — vérifié contre `Assets.toml` le
   2026-09-07. Microchip, Transistor et CompLens sont déjà sci-fi.
2. **432 icônes en WebP**, 18 familles — `public/textures/icons/craft/` :
   `bone cloth container feather gemstone herbs ingots leather meat mushrooms
   reagent recipes seeds spare_parts stone strings tools wood`.
3. **~50 GLB de rochers** dispersés dans `public/models/` — dont plusieurs
   pourraient servir de gisement.

## Ce qui manque, et c'est le livrable

La liste des ressources **futuristes** dont on n'a ni mesh ni icône. NARVOS a
`powernax`, `noyau_plasma`, `cristal_energie`, `adn_alien` dans son catalogue —
**ont-ils un visuel ?** Si non, dis-le, c'est ce qui déclenchera un achat.

## Livrable

`.hermes/RESSOURCES_VISUELS.md`. **Aucune modification de fichier du jeu.**

---

# Tâche 3 — Le « Survival Crafting System » : dire ce qui vaut la peine

`WebPortal/public/asset_game/a_trier/animation_craf/Survival Crafting System/`
510 Mo, 364 uasset. **Personne ne l'a jamais ouvert.** C'est un système
d'inventaire et d'artisanat COMPLET, et il recouvre presque exactement ce qui a
été demandé le 2026-09-07 : liste d'objets par catégories, menu de création de
recettes, inventaire en grille.

## Ce qu'il contient — compté le 2026-09-07

| nature | nombre | valeur pour nous |
|---|---|---|
| **DataTables** | **4** | `DT_ItemList` `DT_CraftingList` `DT_CategoryList` `DT_ActionList` — **la donnée, c'est là** |
| **écrans UMG** | **27** | la MAQUETTE de l'interface |
| structures / enums | 38 | le modèle de types |
| Blueprints `BP_*` | 63 | la logique |
| meshes / textures | 173 | assets |

## ⚠ Trois choses à savoir avant de juger

**1. C'est de l'UE 4.21.** Six générations avant notre 5.7. Une conversion de
Blueprint sur six versions casse, c'est la règle et non l'exception.

**2. La logique Blueprint ne nous sert pas.** Dans nanos le gameplay est en Lua ;
un Blueprint cuit s'exécute, mais notre craft et notre inventaire existent déjà
en Lua et sont testés. **On ne remplace pas du Lua éprouvé par du Blueprint 4.21.**

**3. Le contenu est du survival moderne, pas de la sci-fi.** Relevé dans
`DT_ItemList` : `Aspirin`, `Bandage`, `CanOfTuna`, `Flashlight`, `Chocolate`,
`FirstAidKit`, `CampFire`, `Backpack`. **La STRUCTURE est réutilisable, le
CONTENU ne l'est pas.** Ne propose pas d'importer des boîtes de thon dans NARVOS.

## La technique pour lire un `.uasset` sans Unreal — vérifiée, elle marche

Un `.uasset` est binaire mais porte ses chaînes en clair. `strings` n'existe pas
sur cette machine ; ce script les sort, et il a rendu **563 chaînes dont 429
utiles** sur `DT_ItemList.uasset` :

```js
const fs=require("fs"); const b=fs.readFileSync(CHEMIN);
let out=[],cur="";
for(const c of b){ if(c>=32&&c<127){cur+=String.fromCharCode(c);} else {if(cur.length>=6)out.push(cur);cur="";} }
if(cur.length>=6)out.push(cur);
```

Les noms de champs sortent suffixés d'un index et d'un GUID —
`AngularDamping_13_D7C7ED4B…`, `BoneName_20_8160FDE3…`. **C'est le modèle de
données**, lisible tel quel une fois le suffixe retiré.

## Ce que tu produis — `.hermes/SURVIVAL_KIT.md`

1. **Le modèle de données des 4 DataTables.** Les champs de chaque table, nom par
   nom. C'est le livrable principal.
2. **La liste des objets et des catégories** telle qu'elle sort de
   `DT_ItemList` et `DT_CategoryList`.
3. **Le rôle de chacun des 27 écrans UMG**, déduit de son nom. Groupe-les :
   artisanat, inventaire, personnage, HUD.
4. **La comparaison avec ce qu'on a.** Notre `Logic/Inventory.lua` (grille,
   piles, équipement), `Logic/Craft.lua` et `Catalogs/Recettes.lua` existent et
   sont testés. **Qu'est-ce que ce paquet a que nous n'avons pas ?** Une notion,
   un champ, une mécanique — pas un fichier.
5. **Ton verdict, en trois seaux** :
   - à **reprendre** (structure de données, disposition d'écran, meshes) ;
   - à **ignorer** (Blueprints 4.21, contenu survival) ;
   - à **vérifier dans l'éditeur** parce que tu ne peux pas trancher hors Unreal.

## Ce que tu ne fais pas

**Aucune modification de fichier du jeu, aucun import.** Ce lot entier est un
relevé : trois fichiers Markdown dans `.hermes/`, rien d'autre.

## Pourquoi cette tâche compte

Le 2026-09-07, j'ai recommandé d'acheter deux paquets d'animations à 41 € —
**ils étaient déjà sur le disque**, dans le dossier voisin de celui-ci. Quatrième
fois de la journée qu'on allait payer ou réécrire ce qu'on possède déjà.

Ce relevé sert à ce que ça n'arrive pas une cinquième fois.