# HANDOFF — 2026-09-11, 00:30 → nuit. Écrit par Fable 5.1 pour Opus 5.

Hanibes a joué une heure sur le build du 10/09 et a rendu son verdict, preuves à
l'appui (captures, vidéo) : **« rien n'a été branché visuellement, à part les
maps »**. Il a raison. Ce document dit pourquoi, ce qui est corrigé, et ce qui
t'attend. Lis d'abord §1 — c'est l'oubli, et il est structurel, pas ponctuel.

---

## 1. L'oubli : « cuit » n'est pas « appelé » — et tes générateurs ne pouvaient pas le voir

Tu as écrit la règle toi-même le 10/09, pour le Lua : **écrit → câblé → appelé,
et les deux premiers états sont muets**. Elle vaut pour les assets, et c'est là
qu'elle a manqué.

Mesure (`node scripts/narvos-assets-cuits-jamais-appeles.mjs`, nouveau) — la
jointure entre `Assets.toml` et toute référence `narvos::<clé>` dans nos
packages :

```
67 797 clés déclarées dans Assets.toml, 8 080 référencées dans packages/.
42 paquets sur 90 sans AUCUNE référence dans notre code — 1 115 clés cuites pour rien.
```

Parmi les muets : `Sewer` (243 clés), `Megastructure_Scifi_World` (58),
`Weapon` (46), `MetaCustom` (136), `Meshes` (104), `Common`, `Kellan`,
`GameAnimationSample`, `Audio` (280 sons)… Et `Defender` : **0 clé — jamais
cuit** (§2).

Pendant ce temps, ce que le joueur VOIT vient de :
- **PNJ** : `Spawnables.lua` = 25 `Meshy_AI_biped_*` + 19 `SK_Mannequin*` —
  les bouche-trous du prototype web, gris par nature ;
- **joueur** : le corps morphable de base ;
- **monde** : les sous-niveaux (`CITY_PACK`, `OpenWorlds`) — les « maps » que
  Hanibes reconnaît comme la seule chose branchée. Elles passent par le
  niveau Unreal, pas par un catalogue : c'est POUR ÇA qu'elles sont les seules
  visibles.

**Le mécanisme.** Tes générateurs (`narvos-catalogs-to-lua.mjs`,
`narvos-spawnables-to-lua.mjs`, Merchants, Npc…) lisent les catalogues **TS du
prototype web** puis FILTRENT sur `Assets.toml`. Ils ne peuvent donc émettre
que ce que le web connaissait déjà — les GLB Meshy et les mannequins. Un pack
Unreal acheté n'a **aucun pendant TS** : il est structurellement invisible à
toute la chaîne, quel que soit le nombre de fois où on le cuit. Les seuls
paquets achetés visibles sont ceux qui ont reçu un générateur DÉDIÉ lisant le
pack (`narvos-pack-props-to-lua.mjs`, `narvos-modular-to-lua.mjs`, et tes deux
d'hier : `narvos-pas-to-lua.mjs`, `narvos-animaux-to-lua.mjs`). Ce patron
existe. Il n'a pas été appliqué aux personnages, aux armes ni aux décors.

Corollaire que tu as aussi écrit, et qui s'applique ici : *le compteur était
juste, son étiquette mentait*. `narvos-pack-props-to-lua.mjs` imprimait à
chaque exécution « 243 dossier sans categorie : Sewer » — sous « écartés »,
à côté de 40 000 meshes de carte légitimement écartés. Personne ne lisait
cette ligne.

## 2. Defender : exclu du cook sur le NOM d'un dossier

`DefaultGame.ini`, vague 5 (07/09) : *« on exclut Demo/ SEUL — Defender
apporte 15 pièces modulaires qu'on veut garder »*. Prémisse fausse, mesurée
cette nuit dans `_assets-inventory.json` : **les 1 525 assets du pack Defender
sont TOUS sous `Demo/`** (0 hors Demo). L'exclusion retirait le pack entier —
60 SkeletalMesh texturés — pour UNE animation de démonstration,
`Demo/Characters/Gruntling/Enemy_Anim_Sword_Combat_Swing`, qui avait tué le
5ᵉ cook. C'est la seule AnimSequence de `Demo/` hors de `Demo/Animations/`
(déjà exclu, ligne 105).

Fait : l'animation est déplacée dans `adk/_quarantaine/` (même chemin, avec
`POURQUOI.md`), la ligne 148 est retirée et commentée. Le cook de nuit
(§ résultat, en bas) dit si ça suffit. Attendu : 60 SkeletalMesh Defender dans
`Assets.toml`.

Même faute que `WorldGridMaterial` (mémoire *juger sur la nature, pas sur le
nom*) : un dossier qui s'appelle « Demo » n'est pas forcément de la démo.

## 3. Ce qui est corrigé cette nuit (code, sans cook)

| quoi | où | preuve |
|---|---|---|
| **Menu de test des armes** — touche **O**, `/armes`, `/armes <id>` | `Logic/Weapons.lua` (`Configurer`, `Categories`), `Catalogs/ArmesBase.lua` (**GÉNÉRÉ** depuis `game-mod/default-weapons-master` par `scripts/narvos-armes-base-to-lua.mjs`), `Server/Index.lua`, `Client/Index.lua`, `UI/index.html` `#armes`, `UI/ateliers.js` | 24 armes retenues sur 28, 4 exclues **motivées** (`SK_ColtPython` absent du client Steam ; P90/AWP/DC15S portent des `AddStaticMeshAttached`/`AddAnimationCharacterUse` que le générateur refuse de transporter à moitié). Garde : `commandes_dev` ou admin. Hanibes l'a demandé pour tester ; **à retirer** quand le butin distribuera les armes. |
| **Égouts + Mégastructure** posables au gizmo | `narvos-pack-props-to-lua.mjs` → `PropsNarvos.lua` | 630 décors, 9 catégories (113 égouts, 41 mégastructure) |
| **Droits admin par Steam ID**, jamais par pseudo | `Logic/Droits.lua` (pur, 28 assertions), `Server/Session.lua` (3 voies de connexion), `Config.toml [custom_settings].admins_steam` | le pseudo n'est pas unique en base et se choisit dans Steam ; l'ID 64 bits ENTRE GUILLEMETS (17 chiffres > 2^53) |
| **Repères enterrés à 1,46 km sous le sol** (pads de classe, coffres, jalons) | `Server/Index.lua` `SOL_FORGE`, 4 `Prop` | garde `z-absolu-check.mjs` : X/Y relatifs à l'ancre, Z laissé absolu — vu mordre avant correction |
| Bandeau rouge « Sauvegarde : Aucun prop pose » à chaque sortie F3 | `Export.Props` rend `nil` (rien à sauver) vs `false` (panne) | 3 fois dans une session de jeu |
| Aide « F3 change de vue » alors que la vue est sur F4 | `Client/Index.lua` lit la liaison réelle | — |
| **Identité synchronisée sur chaque PNJ** (`narvos_pnj`, `narvos_echelle`) + **diagnostic de taille RENDUE** | 4 voies d'apparition, `Client/Diagnostic.lua`, `/diag` (le serveur demande, le client mesure, le serveur journalise) | `GetBounds` est d'autorité CLIENT — la sonde ADK mesure les bornes SOURCE (1,7 cm) et ne peut pas voir un os racine à ×100 |
| `Animaux.lua` : en-tête qui affirmait « aucune n'est cuite » | remplacée par le mécanisme | un ÉTAT dans un commentaire ment trois heures plus tard |

Batterie avant la nuit : voir la ligne écrite par le script en bas de ce
fichier. Gardes : `syntaxe`, `portee`, `cablage`, `orphelins`, `listes-recopiees`,
`z-absolu`, `ui-liens`, `schema` — tous verts au moment du lancement.

## 4. Ce que Hanibes a vu, et ce qui n'est PAS encore résolu

1. **« Les PNJ sont très grands »** — non tranché. `adk-bornes-pnj.py` dit
   « 0 géant » sur les bornes SOURCE ; la capture montre un géant. Hypothèse
   documentée dans `Client/Diagnostic.lua` : l'os racine des GLB Meshy porte
   déjà ×100, et `echelle = 100` fait 170 m. **La prochaine connexion écrit le
   rapport `[DIAG]` dans le journal serveur** (automatique 16 s après le
   démarrage, et à chaque arrivée dans un monde). Lis-le AVANT de toucher aux
   échelles. Si le géant est un `Meshy_AI_*` à `echelle=100`, la correction est
   dans `narvos-spawnables-to-lua.mjs` : mesurer la taille RENDUE, pas les
   bornes.
2. **« Pas leurs textures »** — `adk-sonder-textures.py` : capitale 117 gris
   sur 877 (lumières, écrans vidéo — normal), PNJ 2 gris (`lizard`,
   `mob_boss` qui est coloré par ses sommets). Les mannequins et Meshy sont
   « texturés » au sens du registre : ils sont gris **parce que ce sont des
   bouche-trous**. La vraie réponse est §5.
3. **« La création de personnage — l'ancienne »** : l'écran affiche le corps
   morphable de base. Aucune pièce des packs achetés (Defender, MetaCustom,
   Common) n'y entre — même cause que §1.
4. **Pas de profondeur dans l'eau, bandes de terrain au-dessus de l'eau** (capture
   sur l'orbital) : pas regardé. Probablement le Landscape/water d'`OpenWorlds`
   ou de l'orbital ; à mesurer, pas à deviner.
5. Les 4 armes exclues du générateur, et le pack `Weapon` (23 SK : canons,
   crosses, chargeurs — un KIT modulaire, pas des armes complètes).

## 5. Ce que je te propose de faire en premier (et pourquoi dans cet ordre)

1. **Lire le rapport `[DIAG]`** dans le journal serveur après la première
   connexion. Il nomme chaque personnage anormal avec `narvos_pnj`,
   l'échelle demandée et la hauteur rendue. Une décision sur les échelles sans
   ce rapport serait une quatrième correction à l'aveugle.
2. **Un générateur `narvos-personnages-to-lua.mjs`** sur le patron de
   `narvos-animaux-to-lua.mjs` : lire `[assets.skeletal_meshes]` de
   `Assets.toml` pour `Defender`, `Common`, `GameAnimationSample`, `Kellan`,
   `MetaCustom`, `CyberpunkSamurai`, `Valkiria` → entrées `Spawnables`
   texturées, réelles, en centimètres (packs Unreal : pas de ×100). Puis faire
   pointer `Merchants` et `PEUPLEMENT_PAR_MONDE` dessus. C'est ce qui remplace
   les mannequins gris par de vrais personnages — la seule chose que Hanibes
   verra changer.
3. Étendre `narvos-assets-cuits-jamais-appeles.mjs` en GARDE (sortie 1 si un
   paquet de personnages ou d'armes reste à 0 référence) et l'ajouter à
   `tout.mjs`. Sans ça, le prochain pack cuit sera muet lui aussi.
4. Seulement ensuite : `Audio` (280 sons jamais joués), `Weapon` (kit), les
   4 armes exclues.

## 6. Les pièges de la nuit, pour ne pas les repayer

- `[^)]*?` dans une regex qui lit un constructeur : `Vector()` contient un `)`.
  28 classes sur 28 « illisibles » à la première exécution du générateur d'armes.
- `Package.toml` est **téléchargé par chaque client** (journal client :
  « Downloading 103 Package file(s) ») — rien de secret n'y va. La liste des
  admins vit dans `Config.toml`, lu par `Server.GetCustomSettings()`.
- `Actor:GetBounds()` est d'autorité **client**. Tout diagnostic de taille rendue
  passe par un aller-retour serveur → client → serveur.
- Un local nommé `Diagnostic` à côté de `PasClient.Diagnostic` : `portee-check`
  l'a pris pour un emploi avant déclaration. Renommé `DiagnosticPnj`.

## 7. Scripts nouveaux

`scripts/narvos-assets-cuits-jamais-appeles.mjs` · `scripts/narvos-armes-base-to-lua.mjs` ·
`scripts/adk-sonder-textures.py` · `scripts/adk-bornes-pnj.py` ·
`scripts/lua-harness/z-absolu-check.mjs` · `scripts/lua-harness/droits.mjs` ·
`.hermes/nuit_2026-09-11.sh` (celui qui a éteint la machine).

## RESULTAT DE LA NUIT (ecrit par nuit_2026-09-11.sh)

- ⚠ Cook fini (`Packages Remain 0`) mais **58 SkeletalMesh Defender declares** (attendu 60), 509 cles au total. Verifier `.hermes/pack_2026-09-11.log` (inventaire perime ? dossier non copie ?).
- Batterie apres la nuit : `64 harnais · 6676 assertion(s) réussie(s) · 0 échec(s) déclaré(s) · 0 harnais ROUGE(S)`
- Paquets cuits jamais employes apres la nuit : `40 paquet(s) sur 91 sans AUCUNE référence dans notre code — 814 clé(s) cuites pour rien.`

_Machine eteinte automatiquement a 01:42 le 2026-09-11, a la demande de Hanibes._
- Precision sur « 58 attendu 60 » : 60 SkeletalMesh Defender dans l'inventaire, 60 declares dans [assets.skeletal_meshes] ; absents = ['SKM_Manny', 'SKM_Manny_Simple', 'SK_Mannequin_Female'] ; declares sans prefixe SK_ (invisibles au temoin `^SK_`) = ['SKM_Manny_3', 'SKM_Manny_Simple_3']. Rien ne manque : 60 = 60. Les trois « absents » sont RENOMMES par la dedup du constructeur de pack (SKM_Manny -> SKM_Manny_3, SKM_Manny_Simple -> SKM_Manny_Simple_3, SK_Mannequin_Female -> suffixe), parce que d'autres paquets portent deja ces noms. Le temoin `^SK_` etait trop etroit, pas le pack. Corriger le temoin de nuit_2026-09-11.sh : compter la SECTION [assets.skeletal_meshes], pas le prefixe.

## REPRISE DU MATIN — 2026-09-11, Opus 5

**1. Personne ne pouvait se connecter : mon serveur n'avait pas `--playtest`.**
Le client (app Steam Playtest 2189700) expirait en `5003 Timed out attempting to connect`
et le serveur n'écrivait RIEN. Preuve : `Running Playtest App ID!` figure dans les journaux
des serveurs où Hanibes s'est connecté la veille (23:28, 00:23 — 6 connexions), dans aucun
des miens. Commande : `cd "D:/steam/steamapps/common/nanos-world-playtest/Server"; ./NanosWorldServer.exe --playtest`.
Déjà écrit dans le skill `nanos-world` (ligne ~380) — je ne l'ai pas relu avant de lancer.
Cinq hypothèses testées et fausses avant (sandbox TCP/UDP, écriture, proxy, accès Steam).
Et le premier démarrage après un cook recache le pack : 3 min où toute connexion expire aussi.

**2 bis. Six Troopers complets entrent au menu de spawn et chez les marchands** (règle dans
`narvos-spawnables-to-lua.mjs`, famille « Troopers »). Mesuré avant : squelette `SKEL_Mannequin`,
`M_Trooper_*` à 3 textures (BaseColor 1,4 Mo) résolues sur disque. Le « Trooper GRIS » du 04/09
venait des pièces NUES (`MTL_BodyForms` : zéro texture), pas des armures — jamais montrées en
jeu, le porteur étant caché. Distribution : 7 corps différents pour 8 marchands. **Jamais vu en jeu.**

**2. Les 8 marchands sont joués par des corps texturés** (`Server/Index.lua`,
`INCARNATION_MARCHANDS` + `IncarnationMarchand`) : Valkiria et CyberpunkSamurai (avec/sans
casque), en `Character` (animations du moteur), échelle 1. Critères MESURÉS : texturés
(Valkiria 16 textures, Samurai 32 — les pièces stylized en ont **0**), et sur
`/Game/NanosWorld/Characters/Common/SKEL_Mannequin` (lu dans leurs `.uasset`).
Garde : `scripts/lua-harness/incarnations-check.mjs` (52 contrôles). **Jamais vu en jeu.**
Témoin au boot : « Marchands : 8/8 … ; 8 incarne(s) par un personnage de pack, 0 par le corps du web ».

**3. ⚠ Defender est cuit mais son squelette est MORT.** Les SK humains (Hero, Trooper,
Murdock, ShadowOps, WraithLunarOps, TrainingSoldiers, pièces modulaires Head/Torso/Legs)
pointent `/Game/Defender/Demo/Meshes/UE4_Mannequin/SK_MannequinMainUE4M`, disparu à la
promotion. Journal du cook de nuit, 32 lignes : « has a dependency on package … which does
not exist ». Les 60 SK sont déclarés dans Assets.toml — et inutilisables en l'état.
Bonne nouvelle mesurée : les 68 os de `SK_Hero` sont TOUS dans `SKEL_Mannequin` de nanos
(`node scripts/narvos-os-uasset.mjs` : 0 os en plus). La réparation = réassigner leur
squelette à `SKEL_Mannequin` dans l'ADK (sans jamais sauver `SKEL_Mannequin`, contenu moteur),
puis cook. Ils deviennent alors des `Character` complets : 13 personnages + 15 pièces, 581
textures. **Exige d'arrêter serveur ET client (le pack est une jonction).** Gruntling et
Spider ont leur propre squelette : `CharacterSimple`, plus tard.

**4. Nouveautés nanos** : 1.155.1 publiée le 09/09 (`Character:SetWeaponShooterMode(bool)`
serveur, `Client.GetSettings()`, `GetSocketTransform` sur Attachable, `bStayBasedInAir` par
défaut, Lua 5.4.9) — **installé : 1.154.0**, donc indisponible tant que Steam n'a pas mis à
jour. Détail : skill `nanos-world` §38.

**5. Reste, dans l'ordre** : lire le `[DIAG]` (Meshy : menu de spawn → un soldat, puis `/diag`)
→ réparer le squelette Defender + cook (machine libre) → recaster marchands et peupler la
capitale avec Defender → garde « cuit jamais appelé » dans `tout.mjs`.