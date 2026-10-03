# AUDIT SYSTÈMES — 2026-09-11 (soir) — système ↔ asset ↔ Lua

Demande de Hanibes : « vérifie chaque système, ses assets, ses Blueprints et ses
dépendances afin de déterminer ce qui n'a pas été intégré ou connecté correctement ».
Ce rapport couvre le versant **système ↔ asset cuit ↔ Lua** (le versant
« références mortes dans les `.uasset` » est mesuré à part, dans l'éditeur).

Lecture seule. Aucun fichier modifié hors ce rapport ; aucun serveur, client ni
Unreal lancé par l'audit. Il **prolonge** `.hermes/AUDIT_INTEGRATION_2026-09-11.md`
(le matin) : chaque point de son §0/§1 est revérifié dans le code tel qu'il est ce
soir, puis l'audit s'étend à tous les systèmes qu'il ne couvrait pas.

## État du dépôt au moment de l'audit (à lire avant les tableaux)

- Audit effectué entre 19:00 et 19:40. **Une session parallèle éditait le code
  pendant l'audit** : `Client/UI/metahumain.js` 19:24, `Client/UI/index.html` 19:25,
  `Client/Index.lua` 19:25, **`Server/Index.lua` 19:33** (+33 lignes : `PeutGerer`,
  `GardeGestion`, gardes posées sur Spawner, Voitures et l'export F3), puis **encore
  `Server/Index.lua` à 19:42** (+17 lignes). Les numéros de ligne de `S/Index.lua` cités
  ici sont ceux de la version **19:42:29** ; chaque citation porte aussi le nom de la
  fonction ou de l'événement — si le fichier a bougé depuis, `grep -n` le retrouve. Les
  autres fichiers cités n'ont pas changé pendant l'audit (mtimes vérifiés à 19:34).
- `UnrealEditor.exe` (pid 14396, 34 Go) était **ouvert** pendant l'audit. Le pack cuit
  n'a pas bougé : `Assets.toml` date de 18:48 (cook « squelettes », `Packages Remain 0`).
- Aucun journal serveur postérieur au **2026-09-10 13:39** (`.hermes/serveur_orphelins.log`)
  n'existe dans `.hermes/`. Tout ce qui a été écrit après cette heure n'a **jamais tourné**
  dans le moteur, sauf mention contraire. « EN JEU prouvé » s'appuie sur ce journal et
  sur la session d'une heure de Hanibes du 10/09 (`HANDOFF_FABLE_2026-09-11.md`).

### Abréviations de chemins

| préfixe | chemin |
|---|---|
| `SI` | `WebPortal/Server/nanos_world/packages/narvos/Shared/Index.lua` |
| `L/` | `…/packages/narvos/Shared/Logic/` |
| `K/` | `…/packages/narvos/Shared/Catalogs/` |
| `S/` | `…/packages/narvos-map-proto/Server/` |
| `C/` | `…/packages/narvos-map-proto/Client/` |
| `UI/` | `…/packages/narvos-map-proto/Client/UI/` |
| `A.toml` | `WebPortal/Server/Assets/narvos/Assets.toml` (68 372 lignes, 68 306 clés) |

### États employés

| état | sens |
|---|---|
| **EN JEU prouvé** | un journal serveur ou une observation en jeu le montre |
| **atteignable, jamais vu** | écrit, câblé dans `SI`, appelé par un exécutant, joignable par le joueur (touche, commande, UI) — mais aucune trace d'exécution |
| **câblé jamais appelé** | présent dans `SI`, aucun appelant hors de lui-même |
| **écrit non câblé** | le code ou la donnée existe, personne ne le charge/le lit |
| **cassé** | câblé et appelé, mais un maillon manque ou est faux |
| **absent** | rien n'existe (ou le moteur ne le permet pas) |

---

## 0. Ce que les outils mesurent ce soir (commandes exécutées, sorties verbatim)

```
node scripts/narvos-assets-cuits-jamais-appeles.mjs
  68306 clé(s) déclarées dans Assets.toml, 8523 clé(s) référencées dans packages/.
  39 paquet(s) sur 91 sans AUCUNE référence dans notre code — 710 clé(s) cuites pour rien.
  (matin : 42/90 — 1 115 clés ; nuit : 40/91 — 814 ; ce soir : 39/91 — 710)

node scripts/narvos-verifier-catalogues.mjs
  15 contrôles (Modular, Spawnables, Patches, Vegetation, Props, Vfx, Emotes, Vehicles,
  Apparence peau, Map ×3, Widgets, Plans) : Aucune reference morte.
  ⚠ ne vérifie ni Animaux, ni Pas, ni MetaHumain, ni ArmesBase, ni Logic/Character.lua
    (vérifiés à la main ci-dessous : toutes les clés citées sont déclarées).

node scripts/lua-harness/cablage-check.mjs        113 fichiers · 86 modules câblés · OK (90 lus, 146 champs)
node scripts/lua-harness/modules-orphelins-check.mjs   88 fichiers, 2 tolérances (Map_Orbital, Map_tower_map). Aucun orphelin.
node scripts/lua-harness/ui-liens.mjs             à 19:0x : 11 liens MANQUANTS (#metahumain) ; à 19:34 : tout OK
                                                  → la page était en cours d'écriture (index.html 19:25)
node scripts/lua-harness/appels-check.mjs         597 fonctions ; 157 jamais appelées · 170 confinées (rapporte, ne bloque pas)
node scripts/lua-harness/appels-distants-check.mjs   149 réussi(s)
node scripts/lua-harness/incarnations-check.mjs   52 réussi(s) — 8 marchands incarnés, Character, échelle 1
node scripts/lua-harness/tout.mjs                 67 harnais · 7031 assertions · 0 rouge (19:1x)
```

Mesure complémentaire (script de l'audit, pas du dépôt) : pour chacun des 86 modules
câblés dans `SI`, nombre d'occurrences de `Narvos.<Module>` hors `SI` et hors le module
lui-même. **20 modules à 0** : `Archetypes, ArchetypesJoueur, Arenes, ArmesBase(*),
Cameras, Chat, Competences(*), Elements(*), GenerateurCartes, Menottes, Npc, Pas(*),
Patches, Reputations, Sons(*), Talents(*), TalentsLogic, Vegetation, WidgetsLogic,
WorldSim` — (*) = consommé par un `Configurer(...)` dans `SI` lui-même, donc câblé, mais
le module qui les reçoit n'est lui-même appelé par personne (voir §2.12).

Sections d'`A.toml` : maps 47 · static_meshes 43 597 · skeletal_meshes 2 215 ·
sounds 947 · animations 3 480 · particles 75 · materials 17 900 · **blueprints 45** · others 0.

---

## 1. Revérification de l'audit du matin

### 1.1 §0 « corrigé aujourd'hui, sans cook » — tous confirmés dans le code

| cassure (matin) | preuve ce soir |
|---|---|
| relais `Narvos:Crafter` / `Narvos:Recolter` | `C/Index.lua:1657` et `:1660` (`Page("hud", …)` → `CallRemote(…, Reliability.Reliable, …)`) ; serveur `S/Index.lua:970`, `:1136` |
| panneau atelier/gisement + souris | `C/Index.lua:713-735` (`Basculer("atelier")`, `Basculer("gisement")`) ; `#atelier` `#gisement` dans `PANNEAUX` (`UI/index.js:119`) |
| `level` au lieu de `niveau` | `S/Index.lua:930` (craft), `:1006` (`EtatJoueur`), `:1147` (rendement) ; `S/Combat.lua:177` (`perso.classId, perso.level`) ; `S/Sorts.lua:194-195` |
| `Narvos.Inventory.` | `S/Index.lua:1133-1136` |
| `Narvos:Gisement false` à la sortie | `S/Index.lua:1046` |
| 21 `CallRemote` sans fiabilité | `appels-distants-check` : 149 ok. **Reste un** appel sans fiabilité ni charge : `S/Index.lua:1338` `Events.CallRemote("Narvos:DialogueFin", player)` — toléré par le garde (pas de charge), personne ne l'écoute côté client de toute façon (§2.4) |
| radar touche H | `L/Commandes.lua:65` (`menu_radar`, défaut `H`) ; `C/Index.lua:1316` |
| `ui-liens` élargi à `Lua("` | vert à 19:34 |

### 1.2 §1 « encore cassé » — état ce soir : **rien de cette liste n'est résolu**

| point | état | preuve |
|---|---|---|
| butin procédural mort-né | **cassé** | `L/Loot.lua:349` (`rng() < 0.5` → `GenerateItem`), `:234` (`gen_%s_%s_%d_%d`) ; aucun `gen_*` dans `K/Items.lua` |
| boutique et dialogues sans client | **cassé** | `grep 'Narvos:Boutique\|Narvos:Dialogue' C/ UI/` → **0** ; `UI/index.js` : 0 `NarvosBoutique`/`NarvosDialogue` ; serveur émet à `S/Index.lua:1382` (boutique), `:1324/:1340` (dialogue) |
| quêtes inertes | **cassé** | `Quetes.Accepter` : **0 appelant** hors `L/Quetes.lua` ; `S/Index.lua:1191` écrit `s.perso.niveau` (le personnage porte `level`) ; état en mémoire (`quetes_etats`) jamais persisté ; action de dialogue `give_quest` (`K/Dialogues.lua:27`) **ignorée** par l'exécuteur d'actions (`S/Index.lua:1286-1314` ne traite que `ouvrir_boutique`) |
| équipement jamais persisté | **cassé** | `S/Index.lua:670` `{ grid = grille, equipment = {} }` |
| Compétences/Talents câblés jamais appelés | **câblé jamais appelé** | 0 référence hors `SI` (mesure §0) |
| outils de récolte inatteignables | **cassé** | `pioche/foreuse/collecteur` : `K/Items.lua` 2 chacun ; `K/Loot.lua` 0 · `K/Merchants.lua` 0 · `K/Recettes.lua` 0 · `K/Plans.lua` 0 → 5 gisements sur 6 exigent un outil (`K/Gisements.lua:69-146`) ; seule `veine_vie` est récoltable |
| tout le mobilier à la Forge | inchangé | tout est posé autour de `ANCRE = Mondes.Trouver("forge").arrivee` (`S/Index.lua:55`) |
| inventaire WebUI lecture seule | inchangé | `UI/index.js` : 0 `draggable`/`dragstart` ; aucun événement page→Lua d'inventaire dans `ui-liens` |

### 1.3 Constats transversaux du matin

- **Constat n°2 (Animations.lua périmé, 3 216 vs 3 480)** : **corrigé** par le cook de
  18:48 — `K/Animations.lua` porte **3 480** noms (`grep -c '^\s*"'`), = `[assets.animations]`.
- **Constat n°1 (Defender/Freeflow squelettes)** : cook « squelettes » terminé 18:49,
  `Defender au menu de spawn : 12` (`.hermes/cook_squelettes_2026-09-11.log`), 60 SK
  Defender déclarés (`awk` sur la section). **Reste** : `apres_cook_2026-09-11.out` →
  « dependances encore mortes vers Defender : **1** » [À VÉRIFIER : laquelle].
- **§6 pont MetaHuman** : voir §2.2 — écrit, câblé, UI livrée à 19:25, **non cuit**.
- **Nouveau depuis le matin (19:33, session parallèle)** : `PeutGerer`/`GardeGestion`
  (`S/Index.lua:489-504`) ferment trois portes qui n'avaient aucune garde : invocation
  (`S/Index.lua:572`), véhicules (`:639`), export à la sortie de F3 (`:597`).

---

## 2. Tableau par système

Colonnes : **système** · assets attendus · déclarés / cuits · appelé par Lua (file:line) ·
Blueprints · état · preuve · correctif proposé (RÉUTILISER) · impact sur l'existant.

### 2.1 Comptes, création, apparence modulaire

| système | assets attendus | déclarés / cuits | appelé par Lua | Blueprints | état | preuve | correctif (réutiliser) | impact |
|---|---|---|---|---|---|---|---|---|
| Comptes / roster / session (3 voies de connexion) | aucun (SQLite) | — | `S/Index.lua:447` `Comptes.Ouvrir` ; `S/Session.lua:518-714` (Steam, identifiant, inscription, `CreerPerso` :596, `ChoisirDepart` :692) | — | **EN JEU prouvé** | journal 10/09 « NARVOS : base des comptes ouverte » ; 6 connexions de Hanibes la veille (HANDOFF §REPRISE 1) | — | — |
| Aperçu 3D de création | `narvos::ANIM_IP_customer_idle_Anim` ; corps `Modular.CORPS` | déclaré (1) | `S/Session.lua:294`, `:371` `Character(pos, rot, mesh)`, `:402` `PlayAnimation` | — | EN JEU (vu le 04/09, skill nanos-world §13) — non revu depuis | `S/Session.lua:481-492` trace « Narvos:Apercu recu » | — | — |
| Corps par classe (`CharacterBuilder`) | `SK_CyberpunkSamurai_WithHelmet/WithoutHelmet`, `SM_ZombieSoldierTankman_UE4`, `SK_Valkiria` + accessoires `SK_CyberpunkSamurai_Bag/Helmet/Hair` + armes `SM_Katana`, `SM_AssaultRifle`, `SM_Katana_Sheath` | **10/10 déclarés** (grep `^\s+<clé> = ` → 1 chacun). ⚠ `SM_ZombieSoldierTankman_UE4` est bien un **SkeletalMesh** (A.toml:45549, section `[assets.skeletal_meshes]`) malgré son préfixe | `L/Character.lua:66-96` ; spawn `S/Index.lua:321` ; armurier `:2729` | — | **EN JEU prouvé** (le joueur a un corps depuis le 09/09) | HANDOFF §1 « joueur : le corps morphable de base » | — | — |
| Modulaire — corps + pièces (tailleur, garde-robe) | `Modular.CORPS` (2) + 40 pièces `smc__SK_*` (stylized) | 42 déclarés (verifier « Modular 42 ok », liens 52 ok) | `S/Vestiaire.lua:235-241`, `L/Vestiaire.lua:158` `Stock` ; `/tenue` `S/Index.lua` | — | atteignable, jamais vu (rhabillage/achat) | `K/Modular.lua:8` « 2 corps, 40 pièces, **1 familles** » | voir ligne suivante | — |
| Modulaire — familles **Trooper (M/F/PF)** et pièces CyberpunkSamurai | 67 clés `SK_*_Trooper_*` (`Narvos/Meshes/Trooper_Set/…`), formes nues `tr_*` (8 packs × 2-8 clés), pièces `cs_torso/helmet/arm/hair/hand/jacket` | **cuits et déclarés, jamais référencés** (`cuits-jamais-appeles` : `Meshes` 104/6 employées, `tr_*` 0, `cs_*` 0) | aucun : le générateur **écarte** volontairement le corps Trooper (`scripts/narvos-modular-to-lua.mjs:1051` « Ne pas le remettre sans avoir VU en jeu qu'il se tient debout et texturé ») → ses pièces deviennent orphelines et sont filtrées (`:1084-1086`) | — | **écrit non câblé** (choix délibéré) | `K/Modular.lua:40` `FAMILLES = { "stylized" }` ; HANDOFF §2 bis : les formes nues `tr_*_body` sont **sans texture** (`MTL_BodyForms`) | régénérer avec le corps Trooper réactivé **après** un test visuel `/spawn` d'un Trooper complet (déjà au menu de spawn : 6 entrées « Troopers ») | +3 familles au tailleur ; risque = corps nus gris sous les armures |
| Accessoires stylized (chapeaux, barbes, sourcils) | pack `StylizedModularChar` : 53 `SM_*` (`SM_Aviator_Hat`, `SM_Beard_01…`, `SM_Eyebrow_*`) | cuits, **0 référence** | aucun — le générateur modulaire ne lit que des `SK_` ; `Modular.SLOTS` a pourtant `barbe` et `tete` | — | **écrit non câblé** | `cuits-jamais-appeles` : `StylizedModularChar 53 0 JAMAIS EMPLOYÉ` | ajouter au générateur une source `SM_` → `AddStaticMeshAttached(id, mesh, socket)` (patron officiel `hair_female`, skill §6) | slots `tete`/`barbe` remplis ; sockets à mesurer |
| Morphs / macros / apparence (couleurs, silhouette) | `personnages` 11 clés (corps mpfb) | déclarés ; 1 référencé (`K/Morphs.lua`) | `S/Session.lua:152-173` (options), `L/Character.lua` `Habiller` | — | EN JEU (branché 04-05/09, skill) | mémoire `project_apparence_couleurs` | 10 clés `personnages` non référencées [À VÉRIFIER : autres corps morphables ?] | — |

### 2.2 Pont MetaHuman (Meta Customization System)

| système | assets attendus | déclarés / cuits | appelé par Lua | Blueprints | état | preuve | correctif (réutiliser) | impact |
|---|---|---|---|---|---|---|---|---|
| Pièces du pont (14, toutes F) | `narvos::BP_NarvosMH_*` ×14 (blueprints), `Mat_Invisible`, `SK_Meta_Female_Base` + 13 SK vêtements, `ABP/RTG/IK ×2` | `Mat_Invisible` 1 ✓, `SK_Meta_Female_Base` 1 ✓, `SK_Set_3_Work_Skirt/SK_Pants/SK_Boots/SK_Sci_Fi_Armor` ✓ ; **`BP_NarvosMH_*` : 0 dans `[assets.blueprints]`**, `Narvos/PontMetaHuman/` **absent du pack** (`ls` → n'existe pas), présent dans l'ADK (18 `.uasset`) | `SI:342-344` ; `S/Index.lua:731` ; `S/MetaHumain.lua:104` `Blueprint(…, piece.blueprint, NoCollision)`, `:112` `AttachTo(character, SnapToTarget, "root")` ; `/metahumain` `S/Index.lua:2476` ; touche **U** (`L/Commandes.lua:73`) ; relais `C/Index.lua:1246-1273` ; page `UI/index.html:504` + `metahumain.js` | 14 `BP_NarvosMH_*` **non déclarés** | **écrit, câblé, atteignable — NON CUIT** : en jeu ce soir, chaque pièce est refusée « non cuite » (`L/MetaHumain.lua`), le panneau liste 14 pièces grisées | `K/MetaHumain.lua:7-8` « 0 réellement posable(s) … Pont cuit : NON — manque ABP/RTG/IK ×2 » ; `cuit = false` ×14 ; `.hermes/cook_pont_metahuman_2026-09-11.sh` (19:02) **sans journal** → jamais lancé ; `UnrealEditor.exe` ouvert (le script exige l'éditeur fermé) | lancer le cook du pont (éditeur fermé), régénérer `K/MetaHumain.lua`, puis `/metahumain corps_f_base` — le témoin est `[METAHUMAIN] pose …` (`S/MetaHumain.lua:115`) ; ce que le client VOIT (pose copiée ou figée) ne se lit qu'à l'écran | 1 entité `Blueprint` répliquée **par pièce et par joueur** |
| Persistance de la tenue MetaHuman | colonne `personnages.*` | — | `S/MetaHumain.lua:43` `tenues` = table par Character, **0 mention dans `L/Roster.lua`** | — | **absent** (état de session) | `grep -ci metahum L/Roster.lua` → 0 | codec `Roster.Encoder*` + colonne, patron `animaux` (`Roster.EncoderAnimaux`) | migration `Comptes.Ouvrir` |
| Blueprints MetaCustom déclarés (10) | `BP_MH_Female/Male`, `BP_MH_Male_Playable`, `BP_MH_Playable_Female1`, `BP_Playable_MH`, `BP_RPG_MH_Female/Male`, `BP_Meta_Body_Tool`, `BP_Meta_Face_Tool` | déclarés (`[assets.blueprints]`) | **0 `Blueprint(...)`** ; `BP_Meta_Body_Tool`/`Face_Tool` cités comme *données* dans `K/Widgets.lua` seulement | 10 | **câblé (déclaré) jamais appelé** | grep sur `packages/` → 0 (sauf Widgets.lua) | les « Playable » sont la démonstration du pack du patron retarget (skill §18 bis) — spawnable en `Blueprint()` comme PNJ de vitrine [À VÉRIFIER], **jamais possédable** (`Character` ne traverse pas le pont, skill §17) | — |
| Widgets UMG MetaCustom (16) + DGGUI (17) | `Widget_Customizer`… | 29 cuits non déclarés, 15 ADK seuls, 1 déclaré (`K/Widgets.lua:31,431`) | `L/WidgetsLogic.lua` : **0 appelant** ; stratégie `umg_differe` (`:82`) | — | **câblé jamais appelé** (par choix : l'UI est WebUI) | mesure §0 (WidgetsLogic 0) | aucun — la page `metahumain.js` remplace `Widget_Customizer` | — |
| 13 pièces Metawardrobe sur `metahuman_base_skel`, corps masculin | — | `metahuman_base_skel` : 0 dans A.toml | — | — | **absent** | audit matin §6.5 | 2ᵉ ABP + corps M sur `Skel_Dummy` | — |

### 2.3 Économie — inventaire, butin, boutique, craft, récolte, assemblage, agriculture, roue

| système | assets attendus | déclarés / cuits | appelé par Lua | Blueprints | état | preuve | correctif (réutiliser) | impact |
|---|---|---|---|---|---|---|---|---|
| Inventaire (grille, persistance) | icônes `iconFile` (UI) | — | `L/Inventory.lua` (27 réf.) ; `S/Index.lua:664` `EnregistrerSac` ; `C/Index.lua:679` → `#inventaire` | — | **EN JEU prouvé** (HUD depuis le 08/09), **lecture seule** | `UI/index.js` 0 drag/drop ; aucun événement page→Lua d'inventaire | grille + glisser-déposer (matin §3.4) | — |
| Butin (coffres) | 3 coffres `nanos-world::SM_Cube` (Forge) | pack de base | `S/Index.lua` `PoserCoffres` → `VerserButin` → `LootLogic.RollLoot` | — | **cassé** (50 % des tirages hors `ITEM_DB`) | `L/Loot.lua:349`, `:234` | tirer dans `LOOT_CATALOG` seul en consommant quand même les `rng()` (parité harnais) **ou** enregistrer les `gen_*` (question Q3) | harnais `loot-smoke.mjs` |
| Boutique (8 marchands) | — | — | `S/Index.lua:1382` `EnvoyerBoutique` → `Narvos:Boutique` ; achats `:1511` ; `/acheter` `/vendre` (chat) | — | **cassé** (aucun client) | 0 abonné `Narvos:Boutique` côté client ; `EstEquipementier` → vestiaire ✓ | panneau `#boutique` + relais `Narvos:Boutique`/`BoutiqueErreur`/`BoutiqueFait` et page→Lua `NarvosBoutique:Acheter/Vendre` → **handlers serveur déjà écrits** (`:1511`, `:1514`) ; patron `Basculer("atelier")` | — |
| Craft (4 stations) | stations = `nanos-world::SM_Cube` ; recettes 26 (`K/Recettes.lua`) | pack de base ; meshes de stations (Survival Crafting Stations) **non cuits** | `S/Index.lua:943` `PoserAteliers`, `:913` `Fabriquer`, relais `C/Index.lua:1657` | — | atteignable, **jamais vu** (corrigé ce matin) | §1.1 | — | — |
| Récolte (6 gisements) | gisements = `SM_Cube` ; 16 meshes RPG Engine **non importés** (`K/Gisements.lua:33-40`) | pack de base | `S/Index.lua:1026` `PoserGisements`, `:1136` `Recolter` | — | **cassé** pour 5/6 (outil inatteignable) ; `veine_vie` atteignable jamais vue | §1.2 | ajouter `pioche/foreuse/collecteur` au stock `mer_resources` dans **`src/rpg/npc/merchants.ts`** puis régénérer `K/Merchants.lua` (généré) — ou une recette `workbench` | web + nanos (catalogue partagé) |
| Assemblage (établi, 43 plans) | établi `SM_Cube` ; `K/Plans.lua` 206 réf. ok | ✓ | `S/Assemblage.lua:494` `PoserEtabli`, handlers `:258-447` ; `S/Index.lua:695` `Brancher` ; relais `C/Index.lua:1188-1212` ; `UI/assemblage.js` | — | atteignable, **jamais vu** | `tout.mjs` vert (`assemblage-ui.mjs`) ; témoin boot « etabli d'assemblage pose » absent des journaux (tous antérieurs) | — | — |
| Agriculture | aucun nommé par choix (`L/Agriculture.lua:32`) ; meshes Hyper Inventory **non cuits** | — | `SI:259` ; `S/Index.lua:452` **`UtiliserBase` seulement** (table `parcelles` créée) ; aucun exécutant (`Server/Agriculture.lua` n'existe pas) | — | **câblé jamais appelé** | mesure §0 (1 réf. = `UtiliserBase`) | exécutant sur le patron `S/Animaux.lua` (Trigger parcelle + timer `TickParcelle`) ; 3 `SM_Prop_Hydroponic_Plant_*` à cuire pour les stades | — |
| Roue d'objets (TAB, 5 emplacements persistés) | — | — | `S/Index.lua` `Narvos:RoueAssigner/Activer/Retirer` ; `C/Index.lua:1077-1107` ; `#roue` | — | atteignable, jamais vu [À VÉRIFIER] | aucun journal | — | — |

### 2.4 Marchands, dialogues, quêtes, réputation

| système | assets attendus | déclarés / cuits | appelé par Lua | Blueprints | état | preuve | correctif (réutiliser) | impact |
|---|---|---|---|---|---|---|---|---|
| Marchands posés (8) | 7 corps de packs : `SK_Valkiria`, `SK_CyberpunkSamurai_WithHelmet`, 4 Troopers `standalone`, `SK_CyberpunkSamurai_WithoutHelmet` | ✓ (`incarnations-check` 52 ok) | `S/Index.lua:1584` `INCARNATION_MARCHANDS`, `:1615` `PoserMarchands` (`Character` pour SKEL_Mannequin) | — | **EN JEU prouvé** posés (journal 10/09 « Marchands : 8/8 ») ; **corps de packs jamais vus** (écrits le 11/09) | HANDOFF §4.1 : Hanibes a vu « PNJ très grands sans texture » = les Meshy ×100 d'avant | — | — |
| Dialogues | `K/Dialogues.lua` : **1 échantillon** (`maitre_forgeron`) « à remplacer par le YAML porté » ; dialogues marchands **générés** au boot (`S/Index.lua:1523`) | — | `S/Index.lua:1286` `Dialogue.Callbacks`, `:1316` `DialogueDebut` (déclenché au BeginOverlap marchand), `:1344` handlers | — | **cassé** : le dialogue démarre côté serveur et **n'est affiché nulle part** (0 abonné `Narvos:Dialogue` client, 0 émetteur `Narvos:DialogueChoisir`) | grep C/ UI/ → 0 | panneau `#dialogue` + relais, page→Lua `NarvosDialogue:Choisir` → handler serveur **déjà écrit** (`:1345`) | — |
| Quêtes (9) | — | — | `S/Index.lua:1172` `Initialiser` ; hooks `Death` `:1229`, craft `:1243` ; `Quetes.Accepter` **jamais appelée** ; `give_quest` non exécuté | — | **cassé** (aucune quête ne devient active ; XP écrite dans un champ inexistant `niveau` `:1191` ; état en mémoire) | §1.2 | (1) exécuter `give_quest` dans le 2ᵉ callback de `Dialogue.Callbacks` (`:1286`) → `Quetes.Accepter` ; (2) persister `quetes_etats` par le patron `Roster.EncoderAnimaux` ; (3) XP : question Q4 | schéma |
| Réputation | — | — | `S/Index.lua:1271` `Reputation.EtatVide` **seul appel** ; `K/Reputations` 0 réf. | — | **câblé jamais appelé** (aucun gain de réputation nulle part) | mesure §0 | brancher sur les hooks kill/quête existants | — |

### 2.5 Combat, sorts, armes

| système | assets attendus | déclarés / cuits | appelé par Lua | Blueprints | état | preuve | correctif (réutiliser) | impact |
|---|---|---|---|---|---|---|---|---|
| Mêlée (6 armes, enchaînement, contre) | meshes `nanos-world::SM_Crowbar_01…` (pack de base) ; animations `ACB_Attack_01/02/03`, `ACB_Hurt*`, contre `Counter_<Dir>` | `ACB_*` ✓ (`K/Animations.lua:74`) ; **contre : les montages cuits s'appellent `AM_CounterFront_A`… (A.toml:47331-47338, 8 clés)** | `S/Combat.lua:203` `Equiper` (`Melee`), `:350` `Attack`, `:329` `PoserAnimation(player, a.entite, plan.action)` avec `plan.action = "Counter_Front"` (`L/Combat.lua:358`) ; `/arme` (ouverte à tous) ; touches `melee_contrer`/`melee_ranger` (`C/Index.lua:1362-1368`) | — | atteignable, jamais vu ; **contre : cassé** — `Animations.Choisir(sets, "Counter_Front")` ne trouve rien (base décomposée = `AM_CounterFront`) → « aucune animation pour l'action » → contre **sans geste** | `L/Combat.lua:371` `MontageContre` (résolveur par motif `_Front_`) écrit pour ça : **0 appelant** ; `S/Combat.lua:79` et `:325` affirment que les armes/montages Freeflow « ne sont PAS cuits » — **périmé** : `SM_Weapon_Crowbar/Pipe/Sledgehammer/Baseball_01/02` (A.toml:43639-43644, `K/PropsNarvos.lua:58-62`) et 8 `AM_Counter*` sont déclarés | `S/Combat.lua:329` → `Combat.MontageContre(Narvos.AnimNoms.NOMS, plan.direction)` puis `AddAnimationCharacterUse` ; passer `ARMES` aux `narvos::SM_Weapon_*` Freeflow ; [À VÉRIFIER : `AddAnimationCharacterUse` accepte-t-il un AnimMontage `AM_`] | corriger les 2 commentaires |
| Armes à feu (3 écrites + 24 `ArmesBase` générées) | `nanos-world::SK_AK47`… (pack de base, vérifiées Steam) | ✓ | `L/Weapons.lua` `Donner` ; armurier PNJ `S/Index.lua:2729` ; menu **O** / `/armes` (garde `PeutGerer`) `:2536`, `:2554` ; HUD lit `narvos_arme` (`L/Weapons.lua:232`) | — | atteignable, non prouvé | — | pack `Weapon` (46 clés : `SK_Barrel/Body/Grip/Mag_*` = **kit modulaire**, pas d'arme complète) → source naturelle de **plans d'assemblage d'armes** (`K/Plans.lua`) | — |
| Sorts (barre 1-4, mana) | VFX `nanos-world::P_ky_*` (`K/Vfx.lua`, 106 réf. ok) ; 40+ particules `Defender` (`P_Skill_*`, `P_HealingProbe`, `P_Mana_Potion`…) et `SpaceScenes` **cuites, non référencées** | ✓ / ✓ | `S/Sorts.lua:142` `Particle`, `:344` `LancerSort`, `ApplyDamage` ; `C/Index.lua:1373` | — | atteignable, non prouvé | — | remplacer les `P_ky_*` du pack de base par les particules Defender/SpaceScenes dans `Vfx.PAR_ELEMENT` (catalogue **généré** : étendre `narvos-nanos-base-to-lua.mjs` ou un second catalogue `VfxNarvos`) | visuel |
| Stats / armure HUD | — | — | `C/Index.lua:645` : `narvos_stats.defense` **statique** (« aucune logique ne la consomme ») | — | câblé, inerte | commentaire `C/Index.lua:642-644` | — | — |

### 2.6 PNJ, IA, peuplement, spawner, compagnons

| système | assets attendus | déclarés / cuits | appelé par Lua | Blueprints | état | preuve | correctif (réutiliser) | impact |
|---|---|---|---|---|---|---|---|---|
| Menu de spawn (74 invocables) | 25 Meshy (`simple`, `echelle = 100`), 19 `SK_Mannequin*`, 6 Troopers, **12 Defender** (`sk_hero`… `K/Spawnables.lua:89-100`), 2 modulaires, samouraï | 74/74 (verifier) ; Defender depuis 18:49 | `S/Spawner.lua:264` `Character`/`CharacterSimple`, `:131` `ANIM_REPOS`, `:316` → IA ; relais `C/Index.lua:1616` ; garde `PeutGerer` (`S/Index.lua:572`, 19:33) | — | **EN JEU prouvé** (les Meshy géants gris vus par Hanibes le 10/09 = ce menu) ; Defender/Troopers **jamais vus** | HANDOFF §4.1-2 ; rapport `[DIAG]` (taille rendue) **jamais lu** (aucun journal depuis) | lire `[DIAG]` avant de toucher aux échelles (HANDOFF §5.1) | — |
| Peuplement (24 points, 2 mondes) | espèces **Meshy** codées en dur : `gronomi_*`, `venom_stalker`, `canopy_*`, `mycelium_*`, `parasite_*` | ✓ | `S/Index.lua:2920` `PEUPLEMENT_PAR_MONDE` → `:2962` `Peuplement.Charger` ; `S/Peuplement.lua:281` passe | — | **EN JEU prouvé** (journal 10/09 « 24 points, 0 vivant » ; vivants dépendent de la proximité) — **peuplé de bouche-trous gris** | le monde ne contient aucun Defender/Trooper : ils ne sont que marchands + menu | remplacer les ids Meshy de la table par `sk_trooper`, `sk_hero`, `sk_shadowops`… (Character, animations moteur) ; garder les Meshy pour les monstres | 1 table |
| Boucle export → catalogue → repose | `Catalogs/Peuplement.lua`, `Catalogs/DecorPose.lua` écrits par `/exporter` | — | `S/Export.lua:147`, `:210` écrivent ; **rien ne les lit** (`SI` ne les câble pas ; fichiers absents de `K/`) ; `MapLoader.PoserPatches` (`L/MapLoader.lua:204`) **0 appelant** | — | **écrit non câblé** (la boucle promise `S/Export.lua:14` n'est pas fermée) | `ls K/ \| grep -i 'decor\|peuplement'` → vide | au `Load` : `pcall(Package.Require, "Catalogs/DecorPose.lua")` → `MapLoader.PoserPatches(…, {decalage})` ; `Peuplement.Charger(LISTE_exportée ∪ PEUPLEMENT_PAR_MONDE)` | — |
| IA (profils par rôle, MoveTo/ApplyDamage) | — | — | `S/Ia.lua:293` tick, `:197` `ApplyDamage` ; nourri par Spawner et Peuplement | — | atteignable (automatique), **jamais vu** (aucune trace de l'IA dans les journaux ; `IaServeur.Compte` jamais appelé) | `appels-check` | témoin boot « IA : n PNJ suivis » | — |
| Compagnons (41 espèces JSAnimals) | `narvos::SK_<espece>` + 227 anims | **41/41 `cuit = true`** (`K/Animaux.lua:22`) ; `SK_Ammonite`/`A_AmmoniteAnimations1` ✓ | `S/Animaux.lua:131` `CharacterSimple`, `:153` repos ; `/compagnon` `S/Index.lua:2420` (ouvert à tous) ; persistance `Roster.EncoderAnimaux` | — | atteignable (chat seulement), **jamais vu** | `tout.mjs` (`animaux.mjs`) ; ⚠ commentaire périmé `S/Index.lua:717` « AUCUNE n'est cuite » | UI : aucune (chat) | — |

### 2.7 Véhicules

| système | assets attendus | déclarés / cuits | appelé par Lua | Blueprints | état | preuve | correctif (réutiliser) | impact |
|---|---|---|---|---|---|---|---|---|
| 12 voitures City_Traffic_Pro | 12 `SK_*` sur `Car_Skeleton`, `SM_RegPlate01-04`, `S_Car_Engine_*`, `S_Horn` | ✓ (verifier « Vehicles 21 ok ») | `S/Voitures.lua:47` `VehicleWheeled.Inherit`, `:196` `EnterVehicle` ; `/vehicule` (`S/Index.lua:2390`, DEV/admin) ; `Narvos:DemanderVehicule` (`S/Voitures.lua:224`) **sans émetteur** | 8 BP de trafic du pack (`BP_Vehicle_Manager`, `BP_Road`, `BP_Intersection`…) : **0 spawnés** | atteignable (chat DEV), **jamais vu** ; `VehicleWheeled`+`Car_Skeleton` non prouvé ; 12 PhysicsAssets avec corps sur les roues (défaut mesuré, non corrigé — skill narvos-lua §7) | aucun journal ; `K/Vehicles.lua` = catalogue **web** (`/models/vehicule/*.glb`, `type_nanos`) | tester `/vehicule executive_sedan` ; recook après retrait des corps de roues | — |
| Vaisseaux / vol orbital | `chasseur_avion`, `longsword`, `phamtom`, `wraith` (`K/Vehicles.lua`, `type_nanos = "decor"`) | GLB web, **non cuits** | `/vaisseau` pose `narvos_vol` (DEV) ; `S/Voyage.lua:165` `PiloteVol` ; 4 liaisons `exige_vol` | — | **absent** (nanos : `VehicleWheeled`/`VehicleWater` seulement) → les 4 rampes orbitales sont **fermées** à tout joueur non-DEV | journal 10/09 « (vaisseau requis) » ×4 | question Q2 | architecture |
| Motos (Ridable Motor Bikes) | — | **non cuits** ; convention `digital_dive_moto` écrite (`L/OsVehicules.lua`) | aucun exécutant (`Server/Motos.lua` n'existe pas) | — | **écrit non câblé** | audit matin §2 | migration + `MOTOS_NANOS` + exécutant (patron `S/Voitures.lua`) | cook |

### 2.8 Mondes, voyage, ciel, portails

| système | assets attendus | déclarés / cuits | appelé par Lua | Blueprints | état | preuve | correctif (réutiliser) | impact |
|---|---|---|---|---|---|---|---|---|
| 6 mondes (sous-niveaux) + 10 portails | `Map_Narvos`, `Map_Forge/Tower/Alien/Orbital`, `OpenWorlds`/`ForestKitONE`, capitale (`CITY_PACK` persistant) | 47 maps déclarées ✓ | `S/Voyage.lua:266` `PoserPortails`, `:210` téléport ; `S/Index.lua:2864` `DeclarerCharge` (par propriété) | `BP_GodRay`, `BP_GodRay_Sun` (SpaceScenes) : décor spawnable, **0 spawnés** | **EN JEU prouvé** (journal 10/09 : 10 portails posés ; Hanibes : « les maps » sont ce qui est branché) | `.hermes/serveur_orphelins.log:28-37` | — | — |
| Ciel par monde (UDS natif) | `Sky` client | — | `C/Ciel.lua:79` `Spawn(true, true)` ; `C/Index.lua:1715` sur `Narvos:Voyage` | — | atteignable, non prouvé (côté client, muet au serveur) | — | — | — |
| Décor GLB via `MapLoader` (`Charger`) | `K/Map_Orbital.lua` (1 546 réf.), `K/Map_tower_map.lua` (1 451), `K/Map_forge_map.lua` (623) | ✓ (verifier « ok ») | **aucun monde n'a plus de champ `catalogue`** (`K/Mondes.lua:148-160`) ; `Map_Orbital`/`Map_tower_map` **non câblés** (tolérés) ; `MapForge` ne sert qu'à `/mapz` | — | **écrit non câblé** — 3 660 lignes de catalogues générés **morts** mais « valides » | `modules-orphelins-check` TOLERES ; `Voyage.CatalogueDe` sans monde `decor_glb` | supprimer (ou exclure `halo_map`/`tower_map`/`Orbital`/`chunks_unreal_v3` du cook : 56 750 clés) — question Q7 | pack client −? Go |
| Patches (17 dalles) / Végétation (300 touffes) | `narvos::SM_Patch_Sol` ✓, `SM_MWAM_Grass*` ✓ | ✓ | `SI:306-307` câblés ; `MapLoader.PoserPatches` 0 appelant ; **`MapLoader.PoserVegetation` n'existe pas** (`SI:303-305` la nomme) ; les deux visent `CARTE = "chunks_unreal_v3"` = l'ancien décor GLB de la Forge | — | **câblé jamais appelé**, probablement **obsolète** (la Forge est un niveau Unreal depuis le 06/09) | `grep '^function MapLoader\.' L/MapLoader.lua` → 5 fonctions, pas de `PoserVegetation` | question Q7 | — |

### 2.9 Édition de map, props, zones, export

| système | assets attendus | déclarés / cuits | appelé par Lua | Blueprints | état | preuve | correctif (réutiliser) | impact |
|---|---|---|---|---|---|---|---|---|
| Props (449 base + 698 NARVOS) | `K/Props.lua`, `K/PropsNarvos.lua` (Sewer 113, Mars 138, nature 123, mégastructure 41, armes 20…) | ✓ (verifier « Props 449 ok ») | `S/Props.lua:62` garde fermée par défaut, `:130` `Poser`, `:436` gizmo ; relais `C/Index.lua:1608` ; garde réelle `S/Index.lua:545` (Zones) | — | atteignable, **jamais vu** (skill narvos-lua §7) | — | — | — |
| Zones d'édition | `K/Zones.lua:52` 1 zone `bac_forge` (60 m) | — | `L/Zones.lua` `PeutEditer` via `S/Index.lua:560` | — | atteignable, **jamais vu** (aucun refus observé) | skill §7 | — | — |
| Mode édition F3 (souris libre, gizmo, export à la sortie) | — | — | `C/Edition.lua:106` `Narvos:ExporterProps` → `S/Index.lua:594` (garde `PeutGerer` 19:33) ; `C/Gizmo.lua` | — | atteignable, **jamais vu** ; `Edition.FermerDepuisUI`/`Ouverte` **jamais appelées** (la « croix du panneau » annoncée `C/Edition.lua:121` n'est reliée à rien) ; `Events.Call("NarvosEdition:Etat")`/`NarvosGizmo:Message` : **0 abonné** | `appels-check` ; grep `NarvosEdition` C/ UI/ → 0 | brancher les deux `Events.Call` sur le HUD (`NarvosMessage`) | — |

### 2.10 Bruits de pas, sons

| système | assets attendus | déclarés / cuits | appelé par Lua | Blueprints | état | preuve | correctif (réutiliser) | impact |
|---|---|---|---|---|---|---|---|---|
| Pas (490 échantillons, 25 catégories) | `Footsteps_Sound_Effects_Pro` (554 clés, 490 employées) | ✓ (`crystal_walk1` → 1) | `C/Pas.lua:108` `Sound(…, "narvos::" .. cle)` ; `SI:322` `Audio.Configurer(Sons, Pas)` ; `/pas` | `AN_Footsteps` (AutoFootsteps, AnimNotify) **inutilisable** et **remplacé** | atteignable (client, automatique), **jamais entendu** ; matériaux physiques des maps inconnus | skill narvos-lua §7 | — | retirer `AutoFootsteps` (61 clés) du cook |
| Sons d'événement (boss, annonces de zone, séries de kills) | `aoe.mp3`, `entre_de_la_mapforge.mp3`, `double_kils.mp3`… (13) | **0/13 cuits** (`K/Sons.lua:6-10`) | `L/Audio.lua:42-60` `BossEngage`/`AnnounceZone` : **0 appelant** | — | **absent** | mesure §0 | cuire les 13 mp3 du web dans le pack, puis appeler `Audio.AnnounceZone` dans le handler client `Narvos:Voyage` (`C/Index.lua:1715`) | cook |
| Pack `Audio` (281 : foley corps/sneaker, `BackgroundMix` ambiance) | — | cuits, **0 référence** | — | `AC_FoleyEvents` (composant, non spawnable) | **écrit non câblé** | `cuits-jamais-appeles` | foley « chute »/« saut » → `C/Pas.lua` (`JouerPas(perso, "chute")`) ; `BackgroundMix` → ambiance par monde (`K/Mondes.lua.ciel`) | — |

### 2.11 UI — HUD, panneaux, radar, commandes, graphismes, émotes, diagnostic

| système | assets attendus | déclarés / cuits | appelé par Lua | Blueprints | état | preuve | correctif (réutiliser) | impact |
|---|---|---|---|---|---|---|---|---|
| HUD WebUI (15 sections, 14 panneaux) | `UI/index.html`, `index.js`, `ateliers.js`, `assemblage.js`, `metahumain.js` | — | `C/Index.lua:448` `WebUI`, `:2046` `BrancherPage` ; touches par `L/Commandes.lua` (O armes, H radar, U MetaHuman, F3 édition, TAB roue, 1-4 sorts) | — | **EN JEU prouvé** (menus vus les 08-10/09) ; `ui-liens` vert 19:34 | — | panneaux manquants : boutique, dialogue, quêtes, compagnons | — |
| Zoom molette (vue iso) | — | — | `C/Index.lua:427-428` `MouseScrollUp/Down` **refusés par le client 1.152** | — | **cassé** (documenté, non résolu — skill nanos-world §15) | log client cité au commentaire | lire le vrai nom dans `nanos-world/api` `StaticClasses/Input.json` | — |
| Radar | — | — | `S/Index.lua:1089` ; `L/Radar.lua` ; H | — | atteignable, jamais vu (corrigé ce matin) | — | — | — |
| Commandes / Graphismes / Émotes (166 anims, menu B) / Diagnostic `/diag` | émotes : `WW100IdleAnimPack`, `Tactical_HandSignals`, `Loot_Anim_Set`, `BlacksmithAnimations`… | ✓ (verifier « Emotes 166 ok ») | `S/Commandes.lua`, `S/Emotes.lua:59` `PlayAnimation`, `C/Index.lua:1408/1443`, `C/Diagnostic.lua` | — | EN JEU (menus, 08-10/09) ; `[DIAG]` jamais lu | — | — | — |
| Widgets UMG achetés (45 dans `K/Widgets.lua`) | — | 29 cuits non déclarés, 15 ADK, 1 déclaré (`BC_MutableShowcaseHud`) | `L/WidgetsLogic.lua` 0 appelant | `BC_MutableShowcaseHud`, `BC_DGGUHandler`, `BC_ToggleWireframe`, `PlayerCharacter` (Showcase) | **câblé jamais appelé** — par choix (WebUI) | mesure §0 | supprimer `Widgets`/`WidgetsLogic` de `SI` ou les garder comme inventaire documentaire (question Q10) | — |

### 2.12 Câblés dans `SI`, sans aucun exécutant (0 appelant mesuré)

| module | ce qu'il attend | verdict |
|---|---|---|
| `WorldSim` (`SI:348`) | un timer serveur qui appelle `Simuler` et diffuse les événements | câblé jamais appelé |
| `Chat` (`SI:149`) | — | **à supprimer** : doublon du chat nanos (`Chat.SendMessage` déjà employé partout, skill narvos-lua §7) |
| `GenerateurCartes` | bornes de map + hub → points de peuplement | câblé jamais appelé ; **réutilisable** pour alimenter `Peuplement.Charger` au lieu de la table écrite en dur |
| `Competences` / `TalentsLogic` / `Talents` / `Archetypes` / `ArchetypesJoueur` / `Arenes` / `Elements` / `Stats` / `Reputations` | progression, arènes | câblés jamais appelés (aucun système de progression n'est branché : `level` n'est jamais mis à jour) |
| `Menottes` (`SI:257`) | mesh des menottes + anim « menotté » (**aucun asset nommé**, `L/Menottes.lua:15`) ; pack Handcuff **non cuit** | câblé jamais appelé |
| `Cameras` (`SI:258`) | meshes de caméra (**aucun nommé**, `L/Cameras.lua:16`) ; pack Security Camera **non cuit** ; le Defender a des props militaires cuits | câblé jamais appelé ; exécutant à écrire (audit matin §2) |
| `Npc` (`K/Npc.lua`) | — | 0 réf. à l'exécution : ne sert qu'au générateur de `Spawnables` |
| `Widgets` / `WidgetsLogic` | voir §2.11 | câblés jamais appelés |
| `Patches` / `Vegetation` | voir §2.8 | câblés jamais appelés, poseur inexistant |
| `Agriculture` | voir §2.3 | `UtiliserBase` seulement |

---

## 3. Blueprints — les 45 entrées de `[assets.blueprints]`

Un seul `Blueprint(...)` existe dans tout le Lua : `S/MetaHumain.lua:104`, et il vise
des clés `BP_NarvosMH_*` qui **ne sont pas dans cette section**. Donc : **45 déclarés,
0 spawnés**. Groupés par pack (grep sur `packages/` : 0 occurrence sauf 3 citées comme
données dans `K/Widgets.lua`).

| pack | entrées | nature (mesurée sur le nom/chemin) | système NARVOS | verdict |
|---|---|---|---|---|
| **MetaCustom** (10) | `BP_MH_Female`, `BP_MH_Male`, `BP_MH_Male_Playable`, `BP_MH_Playable_Female1`, `BP_Playable_MH`, `BP_RPG_MH_Female`, `BP_RPG_MH_Male`, `BP_Meta_Body_Tool`, `BP_Meta_Face_Tool` | personnages MetaHuman prémontés (les « Playable » portent le patron pilote-invisible + retarget, skill §18 bis) ; 2 outils de morphs (dépendances des widgets) | pont MetaHuman (§2.2) | **réutilisable en vitrine** (`Blueprint()` posé dans le monde) [À VÉRIFIER] ; **jamais possédable** (§17) ; notre pont refait en 14 `BP_NarvosMH_*` ce que `BP_MH_Playable_*` fait déjà pour UN corps — question Q6 |
| **City_Traffic_Pro** (8) | `BP_Vehicle_Manager`, `BP_Road`, `BP_Road_Switcher`, `BP_Roadside_Parking`, `BP_Intersection`, `BP_Change_Lane`, `BP_Do_Not_Change_Lane`, `BP_Stop_Here` | le système de trafic du pack (splines + gestionnaire) ; pilote les voitures BP du pack, qui sont des **stubs cuits** (`L/Voitures.lua:25-27` : `BP_ParentBP_Drivable_Car` = 1 431 octets) | véhicules (§2.7) | démo/éditeur en l'état ; trafic ambiant de la capitale = **test `Blueprint()`** à faire avant de conclure — question Q9 |
| **SmartLocomotion** (7) | `AC_Camera`, `AC_CombatStances`, `AC_Movement`, `AC_Parkour`, `AC_Ragdoll`, `AC_Swimming`, `BP_Character` | 6 **ActorComponents** (non spawnables par `Blueprint()`) + 1 Character (ne traverse pas le pont) | locomotion joueur | **inutilisables** dans nanos ; seule valeur : blend spaces/roulade (**A**, retarget) — audit matin §2 |
| **Blueprints/** GAS (7) | `AC_PreCMCTick`, `AC_SmartObjectAnimation`, `AC_TraversalLogic`, `AC_VisualOverrideManager`, `AIC_NPC_SmartObject`, `BFL_HelpfulFunctions`, `SandboxCharacter_CMC` | composants, AIController, bibliothèque de fonctions, Character | — | **démo (Game Animation Sample)** : à sortir du cook |
| **Showcase / Infinite / Lobby** (5) | `BC_DGGUHandler`, `BC_MutableShowcaseHud`, `BC_ToggleWireframe`, `PlayerCharacter`, `ASSP_Infinite` | démos Mutable (`K/Widgets.lua:368-437`) | — | **démo** : à sortir du cook |
| **CITY_PACK** (3) | `BP_GameInstanceErik`, `BP_Spline`, `BP_LightStudio` | GameInstance (non spawnable), outils d'éditeur | capitale | **éditeur** : sans usage |
| **SpaceScenes** (2) | `BP_GodRay`, `BP_GodRay_Sun` | acteurs de décor (rayons de lumière) | hub orbital / ciel (§2.8) | **réutilisable tel quel** : `Blueprint(pos, rot, "narvos::BP_GodRay_Sun")` dans `Ciel`/décor orbital |
| **Audio / AutoFootsteps** (2) | `AC_FoleyEvents`, `AN_Footsteps` | composant + AnimNotify | pas/sons (§2.10) | **remplacés** par `C/Pas.lua` |
| **Sewer** (1) | `BP_ThirdPersonCharacter` | gabarit Epic | — | démo |
| **Locomotor** (1) | `BP_Walker` (+ `SKM_Mech`) | marcheur procédural (mécha) | aucun système | question Q11 |

Conclusion Blueprints : **2 réutilisables directement** (`BP_GodRay*`), **1 famille à
tester** (`BP_MH_Playable_*` en vitrine ; trafic CTP), **le reste est démo/éditeur/composant**
et n'a rien à faire dans le pack client.

---

## 4. Paquets cuits jamais référencés (39) → quel système ils serviraient

D'après `narvos-assets-cuits-jamais-appeles.mjs` (ce soir). Le générateur dédié
« lit le pack, pas le TS » est le patron qui manque (HANDOFF §1) : `Pas`, `Animaux`,
`PropsNarvos`, `ArmesBase`, `MetaHumain` l'appliquent déjà.

| paquet (clés) | contenu | système servi | verdict |
|---|---|---|---|
| **Audio** (281) | foley corps/pas de sneakers, `BackgroundMix` | Pas (chute/saut), ambiance par monde | à brancher (§2.10) |
| **AutoFootsteps** (61) | système de pas par AnimNotify | remplacé par `C/Pas.lua` | **sortir du cook** |
| **StylizedModularChar** (53 SM) | chapeaux, barbes, sourcils, casquettes (Male/Hair) | modulaire, slots `tete`/`barbe` | générateur : source `SM_` par socket (§2.1) |
| **Weapon** (46) | kit modulaire d'arme (`SK_Barrel/Body/Grip/Mag/…`) | assemblage (plans d'armes) | à brancher via `K/Plans.lua` ; pas une arme `Weapon` complète |
| **UI** (39 SM) | meshes du projecteur/gizmo DGGUI (Mutable) | aucun (WebUI) | **sortir du cook** |
| **Meshes** (104, 6 employées), **tr_\*** (12 packs, 2-8 clés), **cs_\*** (6 packs), `_body`, `_parts`, `assets_character`, `Character`, **personnages** (11, 1 employée) | 67 pièces d'armure Trooper (3 morphologies), formes nues Trooper (sans texture), pièces CyberpunkSamurai, corps morphables | modulaire / vestiaire (§2.1) | écartés par le générateur — question Q1 |
| **Common** (31 SK), **Kellan** (3), **murdock** (15), **samurai** (10), **GameAnimationSample** (32), **ue4_mannequin** (8), **Shared** (5), **Tutorials** (5), **Demo** (6, 1) | personnages et mannequins de référence | Spawnables / marchands / peuplement | `narvos-personnages-to-lua.mjs` (HANDOFF §5.2) — **non écrit** ; `Common`/`Kellan` : nature à mesurer avant [À VÉRIFIER] |
| **Defender** (509, 80) | 12 personnages (déjà au menu), 15 pièces modulaires, **40+ particules** (`P_Skill_*`, potions, impacts), props militaires | sorts (VFX), modulaire | particules → `Vfx` (§2.5) ; pièces → question Q1 |
| **FreeflowCombatSystem** (161, 138) | 118 anims (réparées), 5 armes de mêlée, `AM_Counter*` ×8, FX `FXS_Counter/Strike/…` | combat | contre cassé par le nom (§2.5) ; armes/FX à substituer au pack de base |
| **SmartLocomotion** (51, 1) | BP inutilisables, anims exclues | — | sortir du cook ou retarget des blend spaces |
| **ProceduralWeaponAnimationSystem** (3) | bras FPS | — | **sortir du cook** (NeverCook prévu, 3 clés restent) |
| **FPS_Arms** / **CG_ShotgunPack** (444 chacun, 215 anims employées) | bras 1ʳᵉ personne + anims | animations | les `SK_` de bras n'ont pas d'usage en iso |
| **Locomotor** (13) | `SKM_Mech` + `BP_Walker` | aucun | question Q11 |
| **Levels** (14 maps), **Blueprints** (7), **Infinite** (5), **Lobby** (4), **Showcase** (55, 33 props employés), **_scratch** (1 map `BalayageChunksV3`) | démos / brouillon | — | **sortir du cook** (garder les 33 props Showcase si voulus) |
| **CITY_PACK** (1 575, 1) | capitale (consommée par le niveau persistant, donc « 0 référence » est normal) + **12 maps d'intérieurs** (`APARTMENT`, `HOSPITAL`, `LIBRARY`, `TERMINAL`, `LABORATORY`, `WEAPON_CENTER`, `GENERATOR_ROOM`, `DJ_HALL`…) | capitale, intérieurs | intérieurs non streamés (`Level.*` est client-only) — question Q8 |
| **OpenWorlds** (793, 1) | forêt (sous-niveau) | monde `foret` | normal (consommé par le niveau) |
| **halo_map** (25 954, 131), **tower_map** (27 607, 1 375), **Orbital** (1 858, 1 493), **chunks_unreal_v3** (1 331, 626) | géométrie de map | mondes | les références viennent de `K/Map_*.lua` **non câblés** : ces 56 750 clés ne sont employées par rien de vivant — question Q7 |
| **Planet_Project** (16, 3), **SFSHelmet** (4, 1), **Mars/Sewer/SpaceScenes/Megastructure/nature/ExternalAssets/MWLandscape** | décor | props | ok via `PropsNarvos` (blueprints/particules Sewer/SpaceScenes non employés) |
| **JSAnimals**, **Footsteps**, **Locomotion** (1 332/1 332), **pnj**, **pnj_monstre**, **ZombieSoldierPack_original**, **Valkiria**, **CyberpunkSamurai**, **stylized_modular**, **City_Traffic_Pro**, **Maps**, packs d'anims (WW100, Tactical, Loot, Blacksmith, MoCap, Crossbow, ThirdPerson, Stealth, FPP) | — | compagnons, pas, animations, PNJ, modulaire, voitures, mondes, émotes | employés |

---

## 5. Correctifs priorisés (petits, chirurgicaux, réutiliser d'abord)

| # | correctif | où | réutilise | témoin |
|---|---|---|---|---|
| 1 | **Contre sans geste** : résoudre le montage par `Combat.MontageContre(Narvos.AnimNoms.NOMS, plan.direction)` au lieu de `plan.action` | `S/Combat.lua:329` | `L/Combat.lua:371` (écrit, 0 appelant) ; 8 `AM_Counter*` déjà cuits | boot sans « aucune animation pour l'action 'Counter_…' » |
| 2 | **Boutique + dialogue visibles** : 2 sections HUD + relais (`Narvos:Boutique*`, `Narvos:Dialogue*`) + page→Lua (`NarvosBoutique:Acheter/Vendre`, `NarvosDialogue:Choisir`) ; ajouter `Reliability.Reliable` à `S/Index.lua:1338` | `UI/index.html`, `UI/index.js`, `C/Index.lua` | handlers serveur **déjà écrits** (`S/Index.lua:1511`, `:1514`, `:1345`) ; patron `Basculer("atelier")` | `ui-liens` |
| 3 | **Quêtes vivantes** : exécuter `give_quest` → `Quetes.Accepter` dans le 2ᵉ callback de `Dialogue.Callbacks` ; persister `quetes_etats` | `S/Index.lua:1286-1314` | `L/Quetes.lua:114` ; codec patron `Roster.EncoderAnimaux` | un dialogue marchand accepte une quête ; `SurKill` progresse |
| 4 | **Outils de récolte atteignables** : `pioche`, `foreuse`, `collecteur` au stock de `mer_resources` | `src/rpg/npc/merchants.ts` → régénérer `K/Merchants.lua` | catalogue généré (ne pas éditer le Lua) | `/acheter pioche` chez Drog |
| 5 | **Butin** : ne plus émettre de `gen_*` hors `ITEM_DB` (consommer les `rng()` pour garder la parité) | `L/Loot.lua:349` | `loot-smoke.mjs` | coffre → objets vendables |
| 6 | **Peupler avec de vrais corps** : `PEUPLEMENT_PAR_MONDE` → ids Defender/Trooper pour les humanoïdes | `S/Index.lua:2920` | `K/Spawnables.lua:89-100` | `[DIAG]` : plus de GEANT |
| 7 | **Pont MetaHuman** : lancer `.hermes/cook_pont_metahuman_2026-09-11.sh` (éditeur fermé), régénérer `K/MetaHumain.lua` | — | tout est écrit et câblé | `[METAHUMAIN] pose …` puis l'écran |
| 8 | **Fermer la boucle export** : charger `Catalogs/DecorPose.lua` et `Catalogs/Peuplement.lua` s'ils existent → `MapLoader.PoserPatches` / `Peuplement.Charger` | `S/Index.lua` (`Load`) | `L/MapLoader.lua:204`, `S/Export.lua:127-145` (format déjà celui de `PoserPatches`) | un prop posé au gizmo survit au redémarrage |
| 9 | **Commentaires périmés qui trompent** : `S/Combat.lua:79` et `:325` (Freeflow « pas cuit »), `S/Index.lua:717` (compagnons « aucune n'est cuite »), `SI:303-305` (`PoserVegetation` n'existe pas) | — | — | — |
| 10 | **Gardes** : ajouter `narvos-assets-cuits-jamais-appeles.mjs` à `tout.mjs` en mode garde pour les packs de personnages/armes (HANDOFF §5.3) ; corriger le faux positif d'`appels-check` sur les alias (`Catalogue.Trouver`) | `scripts/lua-harness/tout.mjs` | — | — |
| 11 | **VFX de sorts** : `Vfx.PAR_ELEMENT` sur les particules Defender/SpaceScenes cuites | générateur `narvos-nanos-base-to-lua.mjs` (ou catalogue `VfxNarvos`) | `[assets.particles]` (75) | — |
| 12 | **Sons d'événement** : cuire les 13 mp3, appeler `Audio.AnnounceZone` sur `Narvos:Voyage` | `C/Index.lua:1715` | `L/Audio.lua:51` | — |
| 13 | **`commandes_dev = true`** dans `Package.toml` (téléchargé par chaque client) : passer à `false` avant toute ouverture ; `admins_steam` porte déjà 1 ID (`Config.toml:59-61`) | `narvos-map-proto/Package.toml` | `PeutGerer` (19:33) | — |

---

## 6. Questions pour Hanibes

Chaque question : ce qui a été trouvé / ce qui manque / pourquoi modifier / impact.

**Q1 — Famille Trooper et pièces CyberpunkSamurai au tailleur.**
Trouvé : 67 pièces d'armure Trooper (`Narvos/Meshes/Trooper_Set/…`, 3 morphologies),
les formes nues `tr_*` et les pièces `cs_*` sont **cuites et déclarées**, et le générateur
modulaire les écarte parce que le corps Trooper n'a jamais été « vu debout et texturé »
(`narvos-modular-to-lua.mjs:1051`). Manque : une décision + un test visuel. Pourquoi :
c'est le seul contenu d'armure jouable déjà dans le pack ; le tailleur ne vend que 40
pièces stylized. Impact : 3 familles de plus au vestiaire ; risque connu = formes nues
sans texture (`MTL_BodyForms`), donc corps gris sous les armures partielles.

**Q2 — Vaisseaux et rampes orbitales.** Trouvé : nanos n'a aucun véhicule volant ; les
4 liaisons `exige_vol` sont fermées à tout joueur non-DEV (`/vaisseau` pose `narvos_vol`).
Manque : le mécanisme de « vol » retenu. Options : (a) `SetFlyingMode` + vitesse ×40 (déjà
ce que fait le monde orbital) en guise de vaisseau, sans véhicule ; (b) un `VehicleWheeled`
décoratif + téléportation au franchissement ; (c) laisser fermé. Impact : architecture du
voyage (le `narvos_vol` est déjà lu par `S/Voyage.lua:165`, aucune ligne n'y change).

**Q3 — Butin procédural.** Trouvé : 50 % des tirages produisent un `gen_*` inconnu de
`ITEM_DB` (invendable, refusé par la roue). Manque : soit un registre d'objets générés
persisté en base (schéma nouveau), soit la suppression de la branche (perte de parité avec
le web et le harnais). Impact : schéma ou comportement de jeu.

**Q4 — Progression (XP, niveau, talents, compétences, réputation).** Trouvé : `level`
n'est jamais mis à jour ; `Competences`, `TalentsLogic`, `Reputation` sont câblés et jamais
appelés ; les quêtes écrivent l'XP dans un champ inexistant. Manque : le modèle de
progression (où vit l'XP, qui monte le niveau, quand). Impact : colonne(s) `personnages`,
et trois modules à brancher — c'est un système, pas un correctif.

**Q5 — « Équipement ».** Trouvé : `EnregistrerSac` écrit `equipment = {}` à chaque fois
(`S/Index.lua:670`). Trois candidats existent et aucun n'écrit ce champ : la roue
(5 emplacements, déjà persistée à part), la garde-robe (déjà persistée), l'arme tenue.
Manque : la définition. Impact : soit retirer le champ, soit y ranger l'arme tenue.

**Q6 — Pont MetaHuman : quelle voie ?** Trouvé : le pont (14 `BP_NarvosMH_*`) est écrit,
câblé, avec UI, **non cuit** ; le pack fournit déjà `BP_MH_Playable_*` (même patron, un
corps prémonté) déclarés et jamais spawnés ; le skill §33 rappelle que la garde-robe
MetaHuman n'est pas portable par attachement et que `CharacterSimple` habille des PNJ
gratuitement. Manque : le cook (éditeur ouvert ce soir), la persistance, le corps masculin.
Pourquoi : le coût est 1 `Blueprint` répliqué **par pièce et par joueur** (400 joueurs →
milliers d'entités) — à mesurer avant d'en faire la voie du joueur. Impact : architecture
de l'apparence joueur.

**Q7 — Catalogues de map GLB, patches, végétation, `chunks_unreal_v3`, `_scratch`.**
Trouvé : les mondes sont des sous-niveaux ; `K/Map_Orbital.lua`, `K/Map_tower_map.lua`
(3 025 lignes) ne sont plus câblés, aucun monde n'a de `catalogue`, `Patches`/`Vegetation`
visent l'ancien décor `chunks_unreal_v3` et n'ont pas de poseur. Manque : la décision de
supprimer. Impact : −56 750 clés du pack (`halo_map`, `tower_map`, `Orbital`,
`chunks_unreal_v3`) si on exclut ces dossiers du cook — le niveau les embarque déjà ; le
pack client fait 69,8 Go (journal 10/09).

**Q8 — Intérieurs de la capitale (12 maps CITY_PACK déclarées).** Trouvé : `Level.*` est
d'autorité client, aucun Lua ne les ouvre. Manque : les copier dans `Map_Narvos` comme la
ville (décor persistant) ou les monter en sous-niveaux. Impact : éditeur + cook.

**Q9 — Trafic City_Traffic_Pro (8 Blueprints).** Trouvé : déclarés, jamais spawnés, leurs
voitures BP sont des stubs. Manque : un test `Blueprint("narvos::BP_Vehicle_Manager")` en
jeu. Impact : trafic ambiant de la capitale, ou abandon.

**Q10 — Sortir du cook** : `Infinite`, `Lobby`, `Showcase` (hors 33 props), `Levels`,
`Blueprints/`, `UI`, `_scratch`, `AutoFootsteps`, `ProceduralWeaponAnimationSystem`,
`SmartLocomotion` (BP), `FPS_Arms`/`CG_ShotgunPack` (SK), `Widgets`/`WidgetsLogic` de `SI`.
Trouvé : ~600 clés sans usage possible. Pourquoi : pack client plus léger, et moins
d'assets tiers distribués (licences, audit matin §4). Impact : `DefaultGame.ini` + cook.

**Q11 — `Locomotor` (mécha `SKM_Mech` + `BP_Walker`).** Aucun système ne l'attend.

**Q12 — Priorité entre § 5.2 (boutique/dialogue/quêtes) et § 5.6-5.7 (corps/MetaHuman).**
Le premier rend jouable ce qui est déjà écrit côté serveur (0 asset) ; le second est ce
que Hanibes verra. Les deux sont indépendants.

---

## 7. Annexe — commandes exécutées (toutes en lecture seule)

```
node scripts/narvos-assets-cuits-jamais-appeles.mjs
node scripts/narvos-verifier-catalogues.mjs
node scripts/lua-harness/cablage-check.mjs
node scripts/lua-harness/modules-orphelins-check.mjs
node scripts/lua-harness/ui-liens.mjs              (19:0x rouge, 19:34 vert)
node scripts/lua-harness/appels-check.mjs
node scripts/lua-harness/appels-distants-check.mjs
node scripts/lua-harness/incarnations-check.mjs
node scripts/lua-harness/tout.mjs                  (67 harnais · 7031 · 0 rouge)
grep sur Assets.toml : sections, [assets.blueprints] (45), sondes de clés (Mat_Invisible 1,
  SK_Meta_Female_Base 1, BP_NarvosMH 0, PontMetaHuman 0, ABP_ 0, AM_Counter 8,
  SM_Crowbar_01 0, ANIM_IP_customer_idle_Anim 1, Car_Skeleton 0, SK_MannequinMainUE4M 0,
  metahuman_base_skel 0, SM_ZombieSoldierTankman_UE4 → ligne 45549 (skeletal), Trooper 67)
grep 'Narvos.<Module>' par module câblé (86)      → 20 modules à 0 appelant
grep des 45 clés de blueprints dans packages/     → 0 spawn
grep 'Narvos:Boutique|Narvos:Dialogue' Client/ UI/ → 0
grep 'Quetes.Accepter' hors Logic/Quetes.lua      → 0
grep 'MontageContre' hors Logic/Combat.lua        → 0
ls .hermes (journaux), Server/adk/Content/Narvos/PontMetaHuman (18 .uasset), Assets/narvos/Narvos/ (pas de PontMetaHuman)
tasklist | grep UnrealEditor                      → UnrealEditor.exe pid 14396
```

Journal serveur le plus récent lu : `.hermes/serveur_orphelins.log` (2026-09-10 13:39) —
base ouverte, 10 portails posés, « Animations : 2784 actions », « Peuplement : 24 points »,
« Marchands : 8/8 », « 4 classes, 3 zones de loot ». Rien de plus récent n'existe.