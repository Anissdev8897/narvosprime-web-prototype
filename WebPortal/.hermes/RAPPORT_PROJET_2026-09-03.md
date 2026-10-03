# Rapport de session — 3 septembre 2026

Portage nanos world. Deux temps dans la journée :

- **matin** — écran connexion → sélection → création → jeu, menu d'animations,
  système modulaire, intégration de SciFi_Trooper_Set ;
- **soir** — pouvoirs et VFX, menu de props, menu de PNJ/monstres, écran de
  commandes reconfigurables, voyage entre mondes, import des PNJ et des maps.

Tous les chiffres de ce rapport ont été vérifiés par commande le jour même.

---

## Livré et vérifié

| Module | Rôle | Tests |
|---|---|---|
| `Catalogs/Modular.lua` | **116 pièces**, 17 corps, 4 familles, 8 slots | 174 |
| `Catalogs/Vfx.lua` | **106 particules** du pack de base, 7 familles | — |
| `Catalogs/Props.lua` | **449 props** plaçables, 13 catégories | — |
| `Catalogs/Spawnables.lua` | **72 PNJ/monstres** invocables, vérifiés présents | — |
| `Catalogs/Mondes.lua` | 3 mondes, 4 passages, dimensions | 80 |
| `Catalogs/Emotes.lua` | 166 animations contextuelles | — |
| `Logic/Sorts.lua` | 12 pouvoirs : coût, recharge, mise en scène | 168 |
| `Logic/Commandes.lua` | 13 touches reconfigurables, conflits arbitrés | 101 |
| `Logic/Voyage.lua` | règles de passage entre mondes | (dans les 80) |
| `Logic/Crypto` · `Comptes` · `Roster` · `Raccourcis` | comptes, roster, touches | 170 |
| `Server/{Sorts,Props,Spawner,Commandes,Voyage,Emotes}.lua` | l'exécution | — |
| `Client/UI/ateliers.{css,js}` | trois panneaux + barre de pouvoirs | — |

**992 tests, 11 suites, 0 en échec.** 43 fichiers Lua, 17 042 lignes.
Pack cuit : **111 079 fichiers**, `Assets.toml` 1 356 ko.
**5 384 références d'assets vérifiées, 0 morte.**

### Ce qui a été ajouté aux assets

| Pack | Importé | Note |
|---|---|---|
| SciFi_Trooper_Set | **94 pièces** | 38 renommées `Root` → `root` |
| `public/models/pnj` | **45 fichiers** | SkeletalMesh sur rig Meshy, `CharacterSimple` |
| `public/models/pnj_monstre` | **15 fichiers** | dont 12 après transcodage WebP → PNG |
| Map Tower | **8 chunks, cuite** | 1 451 meshes — le monolithe en faisait 33 978 |
| Map Orbital | **8 chunks, cuite** | 1 546 meshes — le monolithe en aurait fait ~26 000 |

---

## Outils nés de la session

| Script | Ce qu'il empêche |
|---|---|
| `narvos-verifier-catalogues.mjs` | une référence d'asset morte — nanos les ignore **en silence** |
| `lua-harness/portee-check.mjs` | un nom employé avant son `local` (= `nil`) |
| `narvos-nanos-base-to-lua.mjs` | catalogue VFX + props depuis le contenu Steam installé |
| `narvos-spawnables-to-lua.mjs` | catalogue de spawn, croisé avec `Assets.toml` |
| `narvos-manifeste-brut.mjs` | import sans contrôle de squelette, chemins absolus |
| `narvos-textures-vers-png.mjs` | `EXT_texture_webp` qui fait refuser tout le GLB |

`syntaxe-check.mjs` **parcourt désormais le disque** au lieu de tenir une liste :
la liste ne couvrait plus que 13 fichiers sur 40.

---

## Bugs corrigés

### `SansBalise` — deux plantages certains

Déclarée ligne 554 de `Server/Index.lua`, appelée lignes 210 et 444. Choisir une
classe et ouvrir un coffre levaient tous deux `attempt to call a nil value`.
Trouvé par `portee-check.mjs` à sa **première exécution**.

### La chèvre ambiante ne chargeait pas

`ambientAnimals.ts` pointait `creatures/GoatWithGroom/…` ; le pack a été
décompressé À PLAT, les fichiers sont sous `creatures/Characters/` et
`creatures/Animations/`. Le fallback SPA de Vite renvoyait du `text/html` en 200,
donc aucune erreur visible.

### `CLAUDE.md` annonçait un dossier inexistant

« Originaux archivés dans `_ktx2_backup/` » — aucun `_ktx2_backup` sur le disque.
Le seul original conservé est `personnages/ZombieSoldierPack_original` (41,7 Go).

---

## Bugs OUVERTS

### 1. ✅ LEVÉ le 2026-09-04 — le personnage s'affiche en jeu

Premier élément de ce portage vu à l'écran : le mannequin d'aperçu, en troisième
personne, face au joueur, dans l'écran de création. La cause du blocage était le
pont WebUI → Lua (voir §2).

Restent à voir : les menus Props / PNJ / Commandes, les pouvoirs, les portails.

### 1b. Les modèles sortaient GRIS — corrigé le 2026-09-04

Les GLB de `stylized_modular` portaient **`images = 0`** : c'étaient des
ré-exports produits hors de l'ADK, sans jamais embarquer les textures. Le pack
d'origine (`.uasset` UE 4.26) était complet — 61 textures, 27 matériaux — et
n'avait **jamais été importé**.

Corrigé : matériaux et textures d'origine importés, rebranchés par appariement de
NOM (l'import GLB avait créé des matériaux vides aux mêmes noms), puis déplacés
sous `Narvos/` par `rename_directory` — qui répare les références, ce qu'un `mv`
n'aurait pas fait.

```
40/40 meshes rebranchés · 49 slots · 172 textures atteintes · 0 gris
61 textures + 27 matériaux dans le pack livré (255 Mo)
```

⚠ Les 67 pièces trooper utilisent un `Material` brut : leurs textures sont dans
le graphe, non mesurables par Python. Ni prouvées bonnes, ni prouvées grises.

Tests les plus courts pour trancher :
```
/tenue torse soldier_chest_m     le modulaire en jeu
/monde                           l'état des passages
/vaisseau puis marcher sur la rampe orbitale
```
Puis les touches : `P` props · `N` PNJ · `B` animations · `1`–`4` pouvoirs ·
`Échap` réglages.

### 2. Le bouton « Créer » et l'aperçu 3D — CAUSE TROUVÉE le 2026-09-04

**Le pont WebUI → Lua ne porte pas les objets JavaScript.** Il porte les chaînes
et les nombres ; un objet ne lève rien et l'événement n'arrive jamais.

Sur les huit appels de l'écran de création, les six qui passaient des chaînes
fonctionnaient. Les DEUX qui passaient un objet étaient morts :

| Appel | Symptôme visible |
|---|---|
| `NarvosCreation:Apercu` | aucun mannequin — une capsule de collision blanche |
| `NarvosCreation:Creer` | le bouton CRÉER sans aucun effet |

⚠ L'asymétrie est réelle : le sens Lua → WebUI porte bien les tables (c'est ainsi
qu'arrivent les 3 factions, 17 corps et 116 pièces). C'est ce raisonnement — « ça
marche dans un sens, donc dans l'autre » — qui a laissé le défaut ouvert un jour.

**Correctif** : `JSON.stringify` côté page, `JSON.parse` côté serveur, en
acceptant les deux formes pour ne rien casser si nanos évolue. Aucun autre appel
du projet ne passe d'objet — vérifié sur les quatre interfaces.

Le cadrage caméra existait déjà et n'avait jamais tourné, faute d'événement.
Recul porté de 190 à 300 cm : à 1,90 m un corps d'1,80 m était coupé.

### 3. Aucun véhicule dans le pack — le voyage orbital reste bridé

Les liaisons vers l'espace exigent `narvos_vol` sur le personnage. **Aucun
véhicule n'est dans le pack cuit**, et nanos n'a pas de classe de véhicule
volant (`VehicleWheeled` et `VehicleWater` seulement). La commande `/vaisseau`
pose la valeur à la main, pour tester ; le futur système de vaisseaux posera la
même et rien ne changera dans `Server/Voyage.lua`.

### 4. Cinq monstres bloqués par KTX2

`bandit`, `boss_mob`, `golem_glace`, `PSX_lion`, `zombie` : textures KTX2, dont
`sharp` n'a pas le décodeur Basis. À réexporter depuis la source, ou passer par
`toktx`/`basisu`.

### 5. `compatibility_version` en retard

Serveur en **1.152.2**, packages en **1.139**. Passer en 1.144 **réordonne les
paramètres** d'`AddSkeletalMeshAttached` — à traiter avec la signature sous les
yeux.

### 6. Sécurité — deux points fermés le 2026-09-04, un seul reste

**Fermé — limitation de débit.** 5 échecs puis 60 s de blocage. Le compteur ne
retombe QU'À une réussite : sinon l'attaquant reprendrait cinq essais gratuits
par minute. La limite vit sur la SESSION et non sur l'identifiant — l'y attacher
permettrait à un tiers de bloquer le compte d'autrui en échouant exprès.
12 tests.

**Fermé — commandes de développement.** `/noclip`, `/vitesse`, `/vaisseau` et
`/monde` sont désormais **fermées par défaut**, ouvertes par `commandes_dev` dans
`[custom_data]`. Retirer la ligne suffit à fermer ; le défaut est sûr. Ce n'est
pas un contrôle de droits : ça ne distingue pas les joueurs entre eux.

**Atténué — le sel.** Il mélange désormais quatre sources (horloge murale,
horloge processeur, compteur, adresse d'une table neuve) puis passe par SHA-256.
Connaître la graine de `math.random` ne suffit plus. ⚠ **Ce n'est toujours pas un
générateur cryptographique** — Lua n'en expose aucun, et nanos non plus.

**RESTE OUVERT — PBKDF2 à 1 000 itérations**, pas 120 000 : mesuré à
240 µs/itération en Lua pur, 120 000 gèlerait le serveur **29 secondes** par
connexion. ~200× plus faible que bcrypt. La correction réelle est de déporter le
hachage ET la génération du sel vers un service HTTP, le jour du VPS.

### 8. Trois mondes chargés ensemble feront ~4 460 entités

| Monde | meshes |
|---|---:|
| Forge | 1 461 |
| Orbital | 1 546 |
| Tower | 1 451 |

La Forge seule donne déjà un pic de **131 ms** au chargement (cible 33 ms). Le
chargement paresseux étale la note — un monde ne se pose qu'au premier voyage
vers lui — mais le coût de tick s'additionne une fois les trois posés. C'est le
prochain vrai sujet de performance, après avoir vu les maps à l'écran.

### 7. Pic de tick au chargement

131 ms mesurés (cible 33 ms) pendant la pose des meshes de la Forge.

---

## Le tri des assets — audit rendu, rien supprimé

Mesuré par énumération complète : **250,53 Go, 33 798 fichiers, 238 packs**.

| Gisement | Poids | Risque |
|---|---|---|
| `Maps/forge_map/` — 4 jeux de chunks périmés | **10,49 Go** | nul (`chunks_v3` seul câblé) |
| 17 dossiers `Mannequins/` dupliqués | **11,34 Go** | nul |
| `systemes/` + `export/` + `plugins_cpp/` hors de `public/` | 32,0 Go | nul (0 chemin en dur) |
| `ZombieSoldierPack_original` | **41,70 Go** | faible (rollback documenté) |
| `armes/` éclaté en double | 6,14 Go | faible |

**≈ 65 Go récupérables. Aucune suppression effectuée** — c'est destructif et
l'audit est une lecture, pas une décision.

Le catalogue **sous-déclare le désordre** : `environnements/` a 90 entrées de
niveau 2 sur le disque pour 11 packs catalogués. Et `asset-catalog.json` déclare
les VFX sous `/models/vfx/<pack>` alors qu'ils sont en `vfx/VFX/<pack>` — décalé
d'un niveau pour toute la catégorie.

---

## Réfuté — ne pas y retourner

### MetaHuman n'entre pas dans nanos en l'état

Les noms d'os concordent avec `SKEL_Mannequin`, mais MetaHuman **intercale**
`spine_04`, `spine_05`, `neck_02` — 342 os contre 68 — et le mesh est pondéré
dessus. Ces poids disparaissent à la liaison : le tronc se déforme faux, sans
erreur.

```bash
node scripts/narvos-skeleton-compat.mjs \
  WebPortal/public/models/personnages/GameAnimationSample/MetaHumans
# 7 INTERCALE · 0 GLB importables SANS retargeting
```

### Les 10 packs `vfx/VFX/` ne contiennent aucun système Niagara

Ce sont des **GLB**, pas des `.uasset`. Un système Niagara ne survit pas à un
export glTF : il n'en reste que des plans texturés. 2,4 Go inutilisables pour ce
qu'on en attendait. Les pouvoirs passent donc par les **106 particules du pack de
base nanos**, déjà chez chaque joueur.

### Les GLB de `pnj/` sont riggés — sur un AUTRE squelette

⚠ **Corrigé le 2026-09-04.** J'avais écrit qu'ils avaient « un ou deux os » et
n'étaient pas riggés : c'était une MAUVAISE LECTURE de la sortie de
`narvos-skeleton-compat.mjs`, dont le résumé aligne un nombre de FICHIERS devant
chaque verdict, pas un nombre d'os.

La mesure réelle, sous `--detail` : **24 os pour Grunt, 102 pour RobotGirl**,
nommés selon la convention Meshy. Le verdict `ETRANGER` est exact — l'outil
compare les NOMS — mais il ne dit rien du rig.

Confirmation après import, par `adk-verify-skeletons.py` : **60 SkeletalMesh,
37 squelettes créés, 208 AnimSequence**. Ce sont des personnages animés.

Conséquence inchangée : `Character` exige SKEL_Mannequin et leur donnerait une
capsule blanche. Ils passent par `CharacterSimple`, et le catalogue les marque
`simple = true`.

### ~~Mutable est le mauvais outil~~ — AFFIRMATION FAUSSE, retirée le 2026-09-04

J'avais écrit que nanos ne charge aucun plugin et classé Mutable en « réfuté ».
**C'est faux.** Mutable figure dans la whitelist officielle, section *Native
Plugins* — `docs/assets-modding/whitelisted-ue-plugins.mdx:53`, sous la mention
« You can just enable them in Plugins panel ».

Sont également whitelistés et pertinents ici : **Rig Logic (MetaHuman)**, Pose
Search, Motion Warping, Chooser, Gameplay Abilities.

Ce qui reste vrai : `AddSkeletalMeshAttached` fonctionne et l'a montré à l'écran.
Ce qui reste À TRANCHER : le Lua de nanos n'expose aucune fonction Mutable, donc
piloter un Customizable Object au runtime n'est pas prouvé possible. Le chemin
sûr est le **bake hors ligne** (commandlet `COIBakingTest`), qui rend des
SkeletalMesh ordinaires — fusionnés et sections masquées — livrables tels quels.

⚠ Ne PAS reclasser Mutable en réfuté sans avoir lu l'API Lua de nanos.

### Aucune map « Galaxie » sur le disque

Recherche sur `D:`, Downloads et Documents : zéro fichier `*galax*`.