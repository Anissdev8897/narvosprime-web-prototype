# Mission Kimi — 2026-09-09

Deux choses te sont demandées :

1. **Brancher** ce qui est écrit et jamais atteint.
2. **Chercher** dans les assets achetés ce qui vaut d'être branché, et le dire
   avant de coder.

Ce document te donne l'état **mesuré**, pas ressenti. Chaque chiffre vient d'un
outil que tu peux relancer.

---

## 0. Comment on décide qu'un système est « branché »

C'est la définition qui compte, parce que le dépôt est plein de code présent et
inatteignable. Un système n'est **FONCTIONNEL** que si les quatre conditions
tiennent, chacune vérifiable par un `fichier:ligne` :

1. son module est câblé dans `narvos/Shared/Index.lua`
   (`Narvos.X = Package.Require("…")`)
2. quelque chose **appelle** ses fonctions — pas seulement l'importe
3. il existe un chemin depuis une **entrée réelle** :
   `Input.Subscribe` / `Events.SubscribeRemote` / `Page("hud", …)` /
   `Character.Subscribe` / un `Timer` / **un trigger de proximité**
4. si le système a une interface : la `<section>` existe dans
   `UI/index.html`, le JS s'y abonne, **et les noms concordent dans les deux
   sens**

⚠ **La proximité est une entrée légitime.** Je m'y suis trompé en écrivant ce
document : j'ai d'abord conclu que le craft était mort parce qu'aucune touche ne
l'ouvre. Faux — le serveur envoie `Narvos:Atelier` quand le joueur entre dans une
station (`Server/Index.lua:661`), le client relaie
(`Client/Index.lua:663`), la page rend (`UI/ateliers.js:719`). La chaîne est
complète. **Ne conclus jamais « mort » sur l'absence de touche.**

### Les trois contrôles à relancer, ils coûtent zéro

```bash
node scripts/lua-harness/cablage-check.mjs   # module câblé + chaque champ accédé existe
node scripts/lua-harness/appels-check.mjs    # fonctions JAMAIS appelées
node scripts/lua-harness/ui-liens.mjs        # liens page <-> Lua, dans les deux sens
```

État au 2026-09-09 : `cablage-check` **VERT**, `ui-liens` **VERT**,
`appels-check` rapporte **134 jamais appelées / 141 confinées à leur fichier**
sur 457 fonctions publiques dans 90 fichiers.

⚠ `appels-check` **rapporte, il ne bloque pas**, et c'est voulu : une fonction
« jamais appelée » dans `Shared/` est souvent légitime (API réservée, appelée par
un harnais). Ce qui compte, c'est celles de `Server/` et `Client/`.

---

## 1. La surface de branchement, mesurée

| | |
|---|---:|
| touches liées (`ACTIONS.*`) | **18** |
| handlers serveur (`Events.SubscribeRemote`) | **43** |
| événements poussés vers la page (`HUD:CallEvent`) | **31** |
| sections `<section id>` dans `index.html` | **11** |
| entrées de `PANNEAUX` dans `index.js` | **9** |

⚠ **11 sections pour 9 panneaux déclarés** : `atelier` et `gisement` sont gérés
par `ateliers.js`, hors de la liste `PANNEAUX`. Ce n'est pas un défaut, mais
c'est un piège pour qui lit `PANNEAUX` en croyant qu'elle est exhaustive.

### Les 18 touches

```
equipement_retirer  gizmo_mode  gizmo_precedent  gizmo_prise  gizmo_suivant
melee_contrer  melee_ranger  menu_emotes  menu_garde_robe  menu_inventaire
menu_personnage  menu_props  menu_radar  menu_spawn  prop_pivoter
prop_poser  prop_retirer  vue
```

### Les 43 handlers serveur

```
Apercu  ArreterEmote  Boutique:Acheter  Boutique:Vendre  ChoisirClasse
ChoisirPerso  Connexion  ConnexionSteam  Contrer  Crafter  CreerPerso
DefinirCommande  DefinirRaccourci  DemanderCommandes  DemanderEmotes
DemanderMonde  DemanderProps  DemanderPropsListe  DemanderRadar  DemanderSorts
DemanderSpawnables  DialogueChoisir  DialogueDebut  GizmoBouger  Inscription
Invoquer  JouerEmote  LancerSort  PoserProp  RangerMelee  Recolter
ReinitialiserCommande  RetirerEquipement  RetirerInvocation  RetirerProp
RetirerRaccourci  SupprimerPerso  SupprimerProp  Vestiaire:Acheter
Vestiaire:Ouvrir  Vestiaire:Porter  ViderInvocations  ViderProps
```

**Le travail est là.** Compare cette liste aux 18 touches : `LancerSort`,
`DemanderSorts`, `Crafter`, `Vestiaire:Ouvrir` ont un handler serveur et
**aucune touche**. Certains s'ouvrent par proximité (craft, gisement) — vérifie
lequel avant de conclure.

---

## 2. Ce que je sais déjà être cassé ou absent

Chacun est mesuré, avec l'endroit exact. Ne les redécouvre pas.

| # | quoi | où | état |
|---|---|---|---|
| 1 | **`Radar.lua` non câblé** | corrigé le 09/09, `Shared/Index.lua` | ✅ fait |
| 2 | Radar : projetait **X contre Z (l'altitude)**, pas le plan du sol | `Server/Index.lua` handler radar | ✅ fait |
| 3 | Radar : seuil en **cm comparé à des mètres** (600 → 6 m) | idem | ✅ fait |
| 4 | **Vasska** : 231 articles morts, boutique vide | `Boutique.EstEquipementier` | ✅ fait |
| 5 | `NarvosContre` recevait `plan.cle`, champ inexistant | `Server/Combat.lua` | ✅ fait |
| 6 | 4 tests rouges (200 crédits recopié vs `DEFAULT_CREDITS = 500`) | `tests.lua` | ✅ fait |
| 7 | **La capitale était injoignable** : ni `niveau` ni `catalogue` | `Voyage.MondePraticable` | ✅ fait (`decor_persistant`) |
| 8 | **34 PNJ sur 56** reçoivent un Animation Blueprint **vide** | `Server/Spawner.lua:115` | ❌ **À TOI** |
| 9 | `SetDistanceOptimizationMultiplier` : **0 appel** dans tout le dépôt | corrigé dans le Spawner | ✅ fait |
| 10 | **Aucun aéronef dans nanos** : 2 classes seulement | voir §4 | ❌ **DÉCISION** |

### Le plus gros trou restant : les PNJ ne bougent pas

`Server/Spawner.lua` appelle
`CharacterSimple(position, rotation, asset, "", …)` — le **4ᵉ argument est
l'Animation Blueprint, et il est vide**. Les 34 PNJ concernés n'évaluent aucune
animation : ce sont des statues. Les 22 autres passent par `Character`, qui
impose `SKEL_Mannequin`.

⚠ **Et ce n'est pas un défaut de performance.** Mesuré : ces 34 PNJ sont déjà au
coût de tick minimal *parce qu'ils n'animent rien*. Les faire bouger **ajoutera**
du tick. C'est un gain de jeu, pas de performance — ne le vends pas comme une
optimisation.

---

## 3. Assets achetés : ce qu'il faut CHERCHER avant de coder

C'est la deuxième moitié de ta mission, et elle passe **avant** le code.

### 3.1 L'interface achetée n'est pas utilisée

**44 WidgetBlueprints** dorment dans le projet : `MetaCustom` 16, `DGGUI` 16, le
reste ailleurs. Nos menus sont écrits à la main en HTML/CSS, et le patron l'a dit
sans détour : « on fait des menu qui ressemble à riens ».

Ce que l'API nanos permet, **vérifié dans `libraries/api-main`**, pas supposé :

```
Widget:CallBlueprintEvent(string, any...)      [client]
Widget:BindBlueprintEventDispatcher(...)       [client]
Widget:SetBlueprintPropertyValue / Get         [client]
Widget:SetContentForSlot(...)                  [client]
Widget:AddChild(WebUI | Widget)                [client]   <- UMG et WebUI composent
Widget:AddToViewport(...)  /  SpawnWidget3D    [client]
```

⚠ **`SetBlueprintPropertyValue` ne lève PAS sur un nom inconnu.** Une faute de
frappe dans un nom de propriété est silencieuse. Chaque liaison doit être
vérifiée par une lecture (`GetBlueprintPropertyValue`), pas par l'absence
d'erreur.

**Ta mission ici** : ouvrir les 44 widgets, dire lesquels valent d'être branchés
et pour quel panneau, et produire `docs/UI_UMG_CONTRAT.md` — la liste des noms
d'événements et de propriétés de chacun. Sans ce contrat écrit, personne ne peut
les piloter depuis Lua.

### 3.2 Corps partagé : ce qui est réfuté, ne le refais pas

J'ai affirmé le 09/09 au matin que **50 GLB sur 81 partageaient un rig**. C'était
**FAUX**, et l'erreur venait de mon empreinte : je comparais les **noms d'os
triés**, rien d'autre.

Mesure dans Unreal (noms + **ordre** + **pose de référence**) :

| | |
|---|---|
| `Skeleton` sous `/Game/Narvos` | **90** |
| hiérarchies **distinctes** | **75** — donc seulement 15 vrais doublons |
| squelettes `Meshy_AI_biped` | **25**, mêmes noms d'os dans le même ordre… |
| …et rien de plus | hauteurs de 6 281 unités (**63 m**), ratio bras/cuisse de **0,049 à 0,539** (facteur 11), orientations de repos écartées de **52 à 178°** |

**Ce sont 25 rigs différents, pas 25 copies.** Les repointer déformerait.

⚠ **Deux `SKEL_Mannequin` existent et ce ne sont pas les mêmes.**
`/Game/NanosWorld/Characters/Common/SKEL_Mannequin` = **212 os, 183,9 unités**
(1,84 m — celui que le client résout).
`/Game/Narvos/Shared/Mannequins/Meshes/SKEL_Mannequin` = **161 os, 119,9**.
Viser le second produirait un mesh lié à un squelette que le jeu ne charge pas.

Le partage de corps passe donc obligatoirement par un **IK Retargeter**, jamais
par un renommage d'os. Détail : `docs/ANALYSE_SQUELETTE_PARTAGE.md`.

### 3.3 Quadrupèdes : la consigne ne concerne presque personne

**6 GLB quadrupèdes, dont UN SEUL sans animation** (`pet/cat.glb`, 283 os
Rigify). Les cinq autres ont leurs animations embarquées. Le « corps commun
spécial » demandé ne concerne qu'un modèle — et pour un seul modèle, un corps
commun n'a pas de sens.

### 3.4 Textures : les sources sont saines

**76 GLB sur 81** portent leurs textures embarquées. Le gris venait de
l'**import**, pas des fichiers. Pour les 5 sans image, les originaux sont sur
disque : **41 PNG** pour `HumanMage`, **6** pour `lizard`. **Rien à recréer.**

### 3.5 Véhicules volants : une décision, pas un chantier

nanos a **exactement deux** classes de véhicule : `VehicleWheeled` et
`VehicleWater`. **Aucun aéronef.** `Chaos Vehicles` est whitelisté mais **pas
activé** dans l'ADK.

Le catalogue promet donc ce que le moteur ne fait pas. Deux voies, et il faut en
choisir **une** :
- porter le vol en Lua sur un `Prop` piloté (contrôle manuel, pas de physique) ;
- l'abandonner et retirer les entrées volantes du catalogue.

Ne fais pas les deux à moitié. Dis laquelle tu recommandes, avec ce que ça coûte.

---

## 4. La roue TAB de changement d'arme — spécification

Demande du patron : **TAB** ouvre une roue de sélection rapide, 5 emplacements
assignables, et **la logique de l'objet se déclenche vraiment** (équipement,
animation, utilisation).

### Ce qui existe déjà, à réutiliser — ne recrée rien

| brique | où |
|---|---|
| slots d'équipement | `Shared/Logic/Inventory.lua` (`equipment.weapon`, …) |
| retrait d'équipement | handler `Narvos:RetirerEquipement` + touche `equipement_retirer` |
| raccourcis persistés | handlers `Narvos:DefinirRaccourci` / `RetirerRaccourci` |
| consommables | `loot/consumableSlots` côté web ; côté nanos, à vérifier |
| mêlée | `Server/Combat.lua` — chaîne de coups, parade, contre |
| animations | 2 784 actions dans `Catalogs/Animations` |
| réglage des touches | `Server/Commandes.lua` + panneau `commandes` |

⚠ **`Narvos:DefinirRaccourci` existe déjà.** La roue TAB doit s'appuyer dessus,
pas inventer un second système d'assignation. Deux systèmes de raccourcis qui
s'ignorent, c'est le défaut que ce dépôt a déjà payé plusieurs fois.

### Contraintes à respecter

- **TAB doit être libre.** Vérifie-le : `grep -n "Tab" narvos-map-proto/Client/Index.lua`.
  Si `Input.Subscribe("KeyPress")` la consomme ailleurs, il faut arbitrer.
- L'assignation est **persistée par personnage**, comme les raccourcis.
- Le serveur **revalide** tout choix. Le client envoie une chaîne ; un client
  modifié en envoie une autre.
- Le déclenchement doit passer par la logique **existante** de chaque type
  (équiper une arme ≠ boire une potion ≠ utiliser un kit).
- Un emplacement vide ne fait **rien**, et le dit. Il ne tombe pas sur un
  défaut.

---

## 5. Les pièges du dépôt — je les ai tous payés, ne les repaie pas

### Écriture Unreal muette

**Quatre fois aujourd'hui.** Toujours la même forme : j'annonçais des succès sans
relire.

1. **Les structs Unreal sont rendus PAR VALEUR.**
   `slots[i].material_interface = mat` puis `set_editor_property(...)` n'écrit
   **rien**. Mesuré : mutation → `['VIDE']`, reconstruction → `['MI_…']`. Il faut
   fabriquer des `unreal.StaticMaterial()` neufs. Mes 466 rebranchements annoncés
   étaient des **no-ops**, sans une exception.
2. **Le squelette d'une animation ne se pose pas.** La propriété se **lit**, la
   classe n'expose que `get_skeleton`. 434 tentatives, 434 échecs.
3. **Mesurer pendant que les écritures sont en vol** donne un résultat faux. Il
   faut attendre le **silence du journal**.
4. **Une tolérance crée l'ambiguïté qu'elle doit résoudre.** L'inclusion de jeton
   (`Grassgroup2` ⊂ `Grassgroup2ABC`) faisait aussi correspondre `tree3` ⊂
   `tree3leaves` : deux prétendants, refus. **Tous les arbres de la forêt
   tombaient là.**

**La règle** : `save_asset` a `only_if_is_dirty=True` par défaut, et une écriture
ratée ne dit rien. **Seule une relecture prouve quelque chose.**

### Lua

- **Une fonction locale déclarée après son appelant** ne lève pas au chargement.
  Six fois dans ce dépôt. Déclare les tables par joueur en tête.
- **`Voyage.Arrivee` rend DEUX valeurs** `(dimension, position)`. Je l'ai
  attrapé grâce à un harnais, avant que ça plante devant un joueur.
- **Une liste de clés recopiée diverge toujours de sa source.**
  `Roster.EncoderCouleurs` itérait des clés écrites à la main, rendait une chaîne
  **vide**, et effaçait les couleurs en base **sans un signal**.

### Interface

- `$` vaut `document.getElementById`. **Un préfixe `#` rend `null`.** Neuf
  sélecteurs cassés dans `ateliers.js` — dont deux qui levaient et avalaient le
  reste du handler.
- Le pont WebUI ↔ Lua repose **entièrement** sur des chaînes. Rien ne les
  vérifie : ni `tsc`, ni `luac`. `ui-liens.mjs` existe pour ça — relance-le.
- **Grep sur une classe CSS quand le code utilise des id** donne un faux
  négatif. Je l'ai fait sur ton travail et j'ai eu tort : 29 règles existaient.
  Vérifie les deux.

### Cook

- Un `AnimSequence` **sans squelette tue le cook**. Il y en a **1 978** sous
  `/Game/Narvos` — et les 34 exclusions de `DefaultGame.ini` les couvrent
  **1 978 sur 1 978**. Ne touche pas à ces exclusions sans recompter.
- Le code de sortie du cook **ne dit pas** s'il a planté : il peut rendre 1 en
  ayant tout cuit. Le seul témoin est `Packages Remain 0` dans le journal.

---

## 6. État du monde au moment où tu prends la main

| | |
|---|---|
| mondes déclarés | **6** — forge, tower, alien, orbital, capitale, forêt |
| dont jouables **maintenant** | **4** — capitale et forêt portent `cuit = false` |
| acteurs dans `Map_Narvos` | **15 653**, rangés en **23 dossiers** d'Outliner |
| sous-niveaux | 6 (`Map_Forge/Tower/Alien/Orbital` + `ForestKitONE`) |
| cook | **en cours**, 82 879 paquets restants au démarrage |

⚠ **`cuit = false` est un garde temporaire.** `BIG_CITY_NIGHT_1` et
`ForestKitONE` apparaissent **0 fois** dans `Assets.toml`. À retirer après le
cook, et **à vérifier, pas à supposer** :

```bash
grep -c BIG_CITY_NIGHT_1 WebPortal/Server/Assets/narvos/Assets.toml
grep -c ForestKitONE     WebPortal/Server/Assets/narvos/Assets.toml
```

Sans ce garde, un joueur qui voyage vers la capitale tombe **sans fin**, sans un
message. Le garde doit rester dans `Voyage.MondePraticable` — c'est elle qui
décide si un portail est posé. Je l'avais d'abord mis dans `Charger`, après la
décision : **un garde placé après la décision ne garde rien.**

---

## 7. Ce qu'on attend de toi, dans cet ordre

1. **Chercher d'abord.** Les 44 widgets achetés, et `docs/UI_UMG_CONTRAT.md`
   comme livrable. Dis ce qui vaut d'être branché **avant** d'écrire du Lua.
2. **Trancher les véhicules volants.** Une voie, pas deux.
3. **Les 34 PNJ statues** — leur donner une animation, en sachant que ça ajoute
   du tick.
4. **La roue TAB**, sur les briques existantes.
5. Relancer les trois contrôles après chaque étape, et **ne masquer aucune
   sortie de `--apply`** : un générateur qui échoue en silence fait relire
   l'ancien catalogue en croyant l'avoir régénéré. Arrivé **quatre fois**.

Ne recrée rien qui existe. Si tu hésites : `grep` d'abord, et dis ce que tu as
trouvé.