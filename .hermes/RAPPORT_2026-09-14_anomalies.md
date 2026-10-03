# Rapport — 2026-09-14 (soir) : les 7 anomalies de jeu

Demande de Hanibes (captures à l'appui) : effets 3D, caméra 1ʳᵉ personne, inventaire
existant, menus MetaHuman, équipements manquants, caméra de personnalisation, cercle
gris. Règles : analyser, réutiliser, ne rien recréer, vérifier les assets, un seul menu,
corriger à la source, tester.

**Rien n'a tourné en jeu cette nuit** (Hanibes dort, pas d'accès à l'écran). Preuves :
92 harnais verts, gardes verts, serveur `--playtest` démarré sans erreur Lua
(`.hermes/serveur_test_2026-09-14_apparence.log` : `Server started!`), aperçu WebUI
hors jeu (Chrome sans tête).

Enquêtes lancées en parallèle (5 agents, lecture seule) : maquette HUD System, caméra
FPS/armes, menus MetaHuman, inventaire des assets de personnalisation, particules 3D.

## 1. Effets 3D

| | |
|---|---|
| Cause | (a) les billboards 2D du matin étaient les « effets pixel-art » ; (b) **`Vfx.lua` citait le pack de base par nom de fichier** (`P_ky_fireBall`) : 95 clés de particules sur 173 diffèrent (`P_FXVariety_FireBall`). Aucun effet 3D des sorts ne chargeait, sans erreur. |
| Correctif | Billboards supprimés (`Client/SortsVfx.lua`, `Sorts.Sprite`) ; icône seule (`img/sorts/<id>.png`). `Sorts.EFFETS_3D` : 12 sorts, particules cuites de NOTRE pack choisies au relevé (FXS_Strike, P_Attack_ComboFX, P_Explosion, NS_FlameThrower, P_powershield_constant, P_Health_Potion…), rôles lanceur/voyage/impact/zone/aura. `Server/Sorts.lua` : échelle, aura attachée (lifespan 0), extinction douce. `narvos-nanos-base-to-lua.mjs` et `narvos-verifier-catalogues.mjs` lisent `DefaultAssetPack.toml`. |
| Preuves | `sorts.mjs` 366/0 (couverture des 12 sorts, clés du pack de base connues) ; vérificateur « Citations Lua 659 ok », « Vfx 172 ok ». |

## 2. Caméra 1ʳᵉ personne et armes

| | |
|---|---|
| Cause mesurée | Porteur des MetaHumans = `SKM_Manny` de Defender : squelette `SK_MannequinMainUE5M`, sockets `hand_rSocket`/`foot_l_Socket`, ni `hand_r_socket` ni `head_socket`. Une arme ramassée s'attache à `hand_r_socket` (BasePickable.json) → origine du mesh = les pieds. |
| Correctif | Porteur → `nanos-world::SK_Mannequin` (squelette nanos : sockets, animations natives de tenue d'arme, locomotion SKEL_Mannequin), source exacte du retarget `IK_NanosMannequin`. Defender garde SKM_Manny. En FPS, visage et grooms du MetaHuman LOCAL vidés côté client (`Client/MetaCustom.lua`), rejoués à la sortie. |
| Non prouvé | Position exacte de la caméra FPS nanos (non documentée) ; qualité du retarget sur les proportions MetaHuman. |

## 3. Inventaire existant

Maquette « Inventaire NARVOS » portée et branchée au sac réel (session du 14/09 après-midi).
Maquette « NARVOS HUD System » analysée en détail (hotbar 6 emplacements 84 px, radial TAB
6 pods partageant l'état de la hotbar, module arme chargeur/réserve/modes de tir, 6 viseurs,
écran d'équipement 8 emplacements) : **portage à faire**, relevé conservé dans la sortie de
l'agent d'analyse.

## 4. Menus MetaHuman

| | |
|---|---|
| Cause | Trois menus pour habiller le même MetaHuman : panneau « pont » (U, `/metahumain` : pièces-Blueprints FÉMININES posées PAR-DESSUS le corps), `/mhbp` (événements inexistants dans le BP), garde-robe F8 (vide pour un MetaHuman). Vêtements d'office : `MetaCustom.Defaut` (Jacket/Pants/Boots), accessoire de rôle (`ApplyClass` : casque du tank, aussi sur les pads de classe), MetaHumans orphelins jamais détruits (deux corps superposés dans le rapport client). |
| Correctif | Pont supprimé (`Server/MetaHumain.lua`, `metahumain.js/css`, touche U, commandes). **Un seul menu** : inventaire → onglet **APPARENCE** (F8 y mène), éditeur MCS de la création réutilisé ; serveur `Vestiaire.lua` `Narvos:Apparence:*` (normalise, montre, écrit 1,5 s après le dernier geste). Défaut sans vêtement, teinte neutre ; pas d'accessoire de rôle sur corps Blueprint ; `ChoisirClasse` garde le corps choisi ; `AttachTo(…, 0)` + `Character.Subscribe("Destroy")`. « Composition aléatoire » masquée pour un MetaHuman. |
| Preuves | `metacustom.mjs` 454/0, `metahumain-bp.mjs` 35/0, `ui-liens` OK, aperçu de l'onglet (capture `scratchpad/inventaire-apparence-vetements.png`). |

## 5. Équipements manquants

| | |
|---|---|
| Cause | `Catalogs/MetaCustom.lua` régénéré le 13/09 à 20:28, AVANT la cuisson des MetaWardrobe (22:46) : 95 options sur 149 marquées « non cuites » alors que tous leurs paquets sont dans le pack. |
| Correctif | Régénéré : **148/148 cuites**. Coiffures/sourcils/cils filtrés par genre de LIAISON (une liaison de l'autre archétype « éclate » les cheveux). `SK_Sweater` rangé en haut. Mannequin `SK_Dummy` du Face Tool retiré des tenues. |
| Restent hors catalogue | Zombie UE4 (51 pièces) et CyberpunkSamurai (9) : familles absentes des générateurs ; grooms `ExternalAssets` (barbes, moustaches, 3 coupes) sans liaison cuite ; 5 iris ; curseurs du visage (`metacustom-curseurs-visage.json` jamais produit) ; Defender `SK_Head/Torso/Legs1..5` gris ; 42 props du pack de base plus récents que le manifeste recopié. |

## 6. Caméra pendant la personnalisation

Serveur : cadrage de départ UNE fois par session (`s.apercu_cadre`), plus à chaque réglage.
Client : la molette ne zoome plus quand la souris est sur un panneau (`NarvosCreation:Survol`).
En jeu, l'onglet APPARENCE cadre la caméra de face une fois à l'entrée, rend la vue à la sortie.

## 7. Cercle gris

Minimap Ako désactivée (`MinimapClient.ACTIVE = false`) — le radar WebUI (H) reste.

## ⚠ À regarder en premier en jeu

1. FPS (F4) : caméra aux yeux, arme en main (menu O), mains visibles.
2. Inventaire (I) → APPARENCE : changer haut/bas/coiffure ; **vêtement en T-pose ou gris ?** (la fonction Blueprint `NarvosMaillage` ne pose pas de leader pose ni de matériau → correctif éditeur + cook si oui).
3. Sorts 1–4 de chaque classe : effets 3D visibles, échelles.
4. Création : molette sur la liste, caméra immobile.
5. Personnages sauvés avant ce soir : retirer leurs vêtements d'office dans APPARENCE.

## Fichiers touchés

Générateurs : `narvos-modular-to-lua.mjs`, `narvos-metacustom-options.mjs`, `narvos-metacustom-to-lua.mjs`, `narvos-nanos-base-to-lua.mjs`, `narvos-sorts-vfx.mjs`, `narvos-verifier-catalogues.mjs`.
Catalogues régénérés : `Modular.lua`, `MetaCustom.lua`, `Vfx.lua`, `Props.lua`, `SortsVfx.lua`.
Logique : `Logic/MetaCustom.lua`, `Logic/Sorts.lua`, `Logic/Character.lua`, `Logic/Commandes.lua`, `Shared/Index.lua`.
Serveur : `Server/Index.lua`, `Server/Sorts.lua`, `Server/Session.lua`, `Server/Vestiaire.lua`, `Server/MetaHumainBP.lua` ; supprimé `Server/MetaHumain.lua`.
Client : `Client/Index.lua`, `Client/MetaCustom.lua`, `Client/Minimap.lua` ; supprimé `Client/SortsVfx.lua`.
UI : `index.html`, `index.js`, `inventaire.js/css`, `creation/index.js` ; supprimés `metahumain.js/css`.
Harnais : `sorts-tests.lua`, `sorts-vfx-check.mjs`, `metacustom.mjs`, `metahumain-bp.mjs`, `metahumain-bp-tests.lua`.