# FAB — ACHATS 2026-09-09 — Synthèse finale de la mission de recherche d'assets

Date : 2026-09-09 · Projet : narvosprime · Racine : `E:\narvosprime-web-prototype`
Mission : [MISSION_KIMI_FAB_20260909.md](MISSION_KIMI_FAB_20260909.md) (Claude → Kimi)
Sources consolidées : [FAB_RECHERCHE_P1_P2.md](FAB_RECHERCHE_P1_P2.md),
[FAB_RECHERCHE_P3_P7.md](FAB_RECHERCHE_P3_P7.md),
[MODULAR_GARDEROBE_CUITE.md](MODULAR_GARDEROBE_CUITE.md).

---

## 1. Résumé exécutif (autonome)

**La moitié du besoin est déjà payée.** Le vrai chantier n'est pas d'acheter, c'est de
cuire et de rebinder ce que nous possédons déjà.

**Gratuit (déjà possédé, à cuire) :**

- **12 voitures squelettiques complètes** dans `City_Traffic_Pro` (lyoshko, UE 5.6,
  présent dans l'ADK et dans `asset_game/`) : os de roues `Wheel_FL/FR/RL/RR` vérifiés
  dans le binaire, `ChaosWheeledVehicleMovementComponent` (plugin **moteur Epic**, pas
  tiers), PhysicsAsset et WheelData par voiture, noms propres sans `+`. Elles ne sont
  **pas cuites** (0 hit dans le toml) — le manque véhicules est un problème de
  **cuisson, pas d'achat**. Couvre ~90 % de P1.
- **3 cartes d'accréditation Defender** (`BP_LootSecurityClearanceLvl1/2/3` + parent,
  ADK, non cuites) : la moitié « carte » de P4 probablement couverte, sous réserve que
  les BP référencent bien un mesh de carte exploitable **[NV]**.
- **Animations de communication déjà cuites/importées** : 23 anims `AS_Sit_Phone*`
  (WW100, assis) et `Pistol/Rifle_HandSignal_Radio` (Tactical_HandSignals). Il ne
  manque que les **meshes** à attacher — et une anim phone debout.
- **Talkie sci-fi gratuit** (Sketchfab, licence CC-BY vérifiée) et **keypad CC0
  gratuit** (plaggy, FBX/glTF) pour prototyper P2 et P4 sans dépenser.
- **Outils + anims de récolte** : le « Farming And Mining Pack » local (pioche, houe,
  pelle, râteau + AnimBP UE4 Mannequin) — complément gratuit de P3/P6, sans aucun mesh
  de culture ou de minerai.
- **37 vêtements MetaCustom cuits** (sur 57 skeletal meshes MetaCustom dans le toml) :
  inutilisables aujourd'hui non pas pour une question de volume mais parce qu'ils sont
  **liés à `Skel_Dummy` / `metahuman_base_skel`**, pas à `SKEL_Mannequin` — rebind
  éditeur requis avant tout catalogue (voir §0-correction).

**Ce qui coûte quelque chose (les trous réels) :**

- Variantes **police/taxi** de véhicules et motos (P1) — aucune dans le gisement.
- **Lecteurs muraux** de badge (P4) — les cartes locales ne suffisent pas.
- **Caméras de surveillance** (P5) — zéro mesh local.
- **Hydroponie / cultures** (P6) — zéro mesh local de plante cultivée.
- **Menottes, cellules, mobilier de commissariat** (P7) — zéro local.
- **Minerais / cristaux récoltables** (P3) — zéro nœud récoltable local.

**Panier recommandé (détaillé au §5) :**

| Poste | Couvre | Prix |
|---|---|---|
| À 0 € : cuisson City_Traffic_Pro + 3 cartes Defender + talkie CC-BY + keypad CC0 | P1 (90 %), P4 cartes, P2, P4 prototype | **0 €** |
| POLYGON Police Station (Synty) | P7 + P4 badges + P5 appoint | **73,62 € vérifié** (syntystore.com, licence 5 postes, 2026-09-09) |
| Drivable Cars: Advanced Multiplayer (Digital Dive) | P1 police/taxi/convoi | non vérifié (Fab bloqué 403) |
| Sci-Fi Props (iThappy) | P5 + P6 | non vérifié |
| Customizable Pulsating Fantasy Crystals | P3 | non vérifié |
| Ultimate Keypad Bundle *(ou le CC0 gratuit)* | P4 lecteurs | non vérifié *(ou 0 €)* |

**Total : 73,62 € vérifiés + 4 prix Fab non vérifiés** (fab.com renvoie 403 à tout
fetch direct — Cloudflare ; aucun prix Fab n'a pu être lu sur la fiche elle-même).
Les prix vérifiés sont distingués des non vérifiés tout au long du document
(**gras = vérifié**, `[NV]` = non vérifié).

---

## 2. §0-correction — erreurs de la mission corrigées en route

Trois affirmations de la mission ont été re-mesurées et corrigées. Les deux rapports
de recherche et le chiffrage garde-robe convergent ; on tranche ainsi :

1. **Les 37 vêtements : obstacle SQUELETTE, pas volume.** La mission §2 écrit « leurs
   noms d'os concordent avec SKEL_Mannequin, vérifié […] le seul obstacle est le mélange
   des VOLUMES ». **Faux**, re-mesuré par extraction de chaînes dans les `.uasset` :
   les pièces MetaCustom pointent sur `Skel_Dummy` (et `metahuman_base_skel` pour au
   moins `SK_Dress`) — os twist/correctifs MetaHuman, des centaines d'os contre 68.
   `AddSkeletalMeshAttached` exigeant le même squelette, ces pièces seront **refusées à
   l'attachement** avant même que les volumes se posent. L'en-tête de `Modular.lua` qui
   dit « concordent, vérifié » est une **chaîne codée en dur** dans le gabarit du
   générateur, contredite 400 lignes plus haut par sa propre contre-mesure MetaHuman
   (`METAHUMAN_ACTIF = false`). Bonus : la référence squelette est **pendante** dans le
   pack cuit (chemin `/Game/Metahuman_Customization_System/…` absent du pack). Le coût
   réel est un **rebind/retarget éditeur**, pas ~150 lignes de générateur.
   *Pourquoi on tranche ainsi : mesure binaire directe sur les `.uasset` contre une
   citation d'en-tête généré — la mesure gagne.*
2. **42 → 40 pièces.** `Modular.lua` contient **40 pièces**, 1 famille `stylized` ;
   l'en-tête généré dit lui-même « 2 corps, 40 pièces, 1 familles ». La mission a sans
   doute compté les 2 corps. *Preuve : re-comptage lignes 129–168 du fichier.*
3. **Véhicules : la cuisson est le problème, pas l'achat.** `City_Traffic_Pro` couvre
   déjà ~90 % du manque n°1 : 12 voitures squelettiques conformes à **toutes** les
   contraintes non négociables (os de roues nommés, Chaos natif Epic, pas de `+`,
   PhysicsAssets). Le seul trou réel de P1 est l'absence de variante **police/taxi**
   et de **moto**. Le même réflexe que la mission §2 (« chiffrer avant d'acheter »)
   s'applique donc à P1 : cuire d'abord.

Précision de composition (sans changer le total) : les 37 vêtements = 24 cités par la
mission + 13 omis ; 3 des 27 noms cités (`SK_Meta_Female_Base`, `SK_MetaP`, `SK_MetaP1`)
sont des corps de base, pas des vêtements — la mission tombe juste par compensation
(27 − 3 + 13 = 37).

---

## 3. Un tableau par manque (P1 à P7)

Format mission : **nom du pack · éditeur · prix · version UE · squelette (persos) ·
nombre de meshes utiles · lien Fab · risque en une phrase.** Chaque tableau est précédé
du verdict « nos gisements couvrent-ils déjà ? » avec preuve. Le **candidat recommandé
est en tête et en gras**. `[NV]` = non vérifié.

### P1 — Véhicules terrestres pilotables (bloque phases 2.15, 3.22, 5.42)

**Verdict gisements : OUI, couvert à ~90 % — le problème est la cuisson, pas l'achat.**
Preuves : `City_Traffic_Pro` (587 fichiers, ADK + asset_game) contient 12 voitures
squelettiques (`SK_Executive_Sedan`, `SK_Pickup`, `SK_Full-size_SUV`, etc.) +
`Car_Skeleton` partagé + PhysicsAssets + `BP_Drivable_*` ×12 + WheelData. Os de roues
`Wheel_FL/FR/RL/RR` extraits du binaire ; `ChaosWheeledVehicleMovementComponent` =
plugin moteur Epic ; 0 hit dans le toml cuit (non cuit) ; noms propres. Trou réel :
**aucune variante police/taxi, aucune moto**.

| Pack | Éditeur | Prix | Version UE | Squelette | Meshes utiles | Lien Fab | Risque en une phrase |
|---|---|---|---|---|---|---|---|
| **City Traffic Pro — RECOMMANDÉ (déjà possédé, à cuire)** | lyoshko | déjà payé | 5.0–5.6 déclaré (miroirs), 5.7 à tester | Car_Skeleton, os `Wheel_FL/FR/RL/RR` vérifiés | 12 voitures SK + BP Chaos + WheelData | [fiche](https://www.fab.com/listings/b4aedd9f-2ca9-499d-b283-0d9864520a0d) | Aucun achat : le travail est la cuisson ; pas de variante police/taxi. |
| **Drivable Cars: Advanced Multiplayer Vehicles — complément police/taxi recommandé** | Digital Dive Studio | [NV] | UE 5.4+ maintenu ; fix **UE 5.7** dans release notes v4.7 | « bone grid » maison — **noms d'os de roues à inspecter** | 3 voitures × variantes Base/Extras/**Police/Taxi**, 4 LODs | [fiche](https://www.fab.com/listings/65a0844c-6be4-4e38-9d7a-b9697681a274) | Seul pack avec variantes police ET taxi explicites, 100 % Blueprint ; squelette maison à vérifier avant cuisson. |
| Ridable Bikes: Advanced Multiplayer Vehicles | Digital Dive Studio | [NV] | UE 5.4+ ; fixes 5.6/5.7 (v4.4–v4.8) | squelette maison [NV] | 3 motos (Naked, Custom, Enduro), 4 LODs | lien pack [NV] ; [Sport Bike](https://www.fab.com/listings/d3a2d53f-75aa-4bb1-80ee-9e50830d48ec) | Seule offre moto sérieuse ; même vérification d'os requise. Optionnel. |
| Drivable Cars: Basic Vehicle System | Digital Dive Studio | [NV] | « Optimized for UE5 » [NV] | [NV] | 3 voitures, 4 LODs | [fiche](https://www.fab.com/listings/990042be-cdea-4411-b052-e994bfded322) | Doublon de City Traffic Pro — seulement si la cuisson locale échoue. |
| Vehicles - Police Car - Drivable | Yarrawah Interactive | **49,99 $ vérifié (yarrawah.com)** | **UE 4.25–4.27 / 5.0–5.1 seulement** | custom | 1 voiture de police | [page éditeur](https://www.yarrawah.com/products/vehicles-police-car-drivable) | Version ≤ 5.1 = risque 5.7 réel ; 1 voiture pour 50 $ = mauvais rapport. À écarter. |
| Race Car 4. Bundle | [NV] | [NV] | UE 5.0+ (Lumen 5.3) | ChaosVehiclesPlugin | 9 voitures de course | [fiche](https://www.fab.com/listings/0c4ca85d-b0f3-449b-8e79-35dacc27c375) | Voitures de course, hors besoin RP police/taxi/convoi. À écarter. |

### P2 — Props tenus en main : smartphone, talkie, radio (bloque phases 5.36/37)

**Verdict gisements : NON pour les meshes — mais les ANIMATIONS sont déjà là.**
Preuves : 0 smartphone/talkie/radio dans `asset_game/` (41 060 uasset), l'ADK
(~102 000) et le toml (`SM_(PHONE|CELL|MOBILE|WALKIE|TALKIE|RADIO)` = 0 ; les 111 hits
`phone` de la mission = microphones Halo). Faux positifs écartés un par un
(`PublicPhone` = cabine Defender, `Handheld` = camera shake, etc.). Déjà disponibles :
23 anims `AS_Sit_Phone*` (assis), `Pistol/Rifle_HandSignal_Radio`, et le fallback cuit
`SM_TABLET_PC` (prop posé, à tester en attach main).

| Pack / modèle | Éditeur | Prix | Version UE | Squelette | Meshes utiles | Lien Fab | Risque en une phrase |
|---|---|---|---|---|---|---|---|
| **SCI-FI Walkie-Talkie — RECOMMANDÉ (gratuit)** | CraigG124 (Sketchfab) | **Gratuit (vérifié)** | N/A (FBX/glTF, import manuel) | N/A (prop) | 1 talkie sci-fi PBR 2K, 28,7k tris | [fiche Sketchfab](https://sketchfab.com/3d-models/sci-fi-walkie-talkie-6e0290ce079f433ba29357ec3e1698bd) | Licence **CC-BY** (crédit obligatoire) ; 28,7k tris à décimer pour un prop main. |
| Ultimate Forest Survival Pack | [NV] | [NV] | [NV] — probable FBX multi-moteur | N/A | 1 walkie-talkie (+ 29 props survie) | [fiche](https://www.fab.com/listings/4e48c956-1fe3-4b81-b7ed-cf75afd63f3c) | Seul pack UE avec un talkie ; format FBX = import à la main, pas de socket main. |
| Makeshift Walkie-Talkie | bovee.senne (Sketchfab) | [NV] | N/A | N/A | 1 talkie post-apo | [fiche Sketchfab](https://sketchfab.com/3d-models/makeshift-walkie-talkie-game-ready-d01c3cd3168544a382fd671485f58067) | Licence et prix non vérifiés ; style survie, pas police. |
| Smartphone générique (ex. Redmi Note 14) | Taohid Animation (Sketchfab) | [NV] | N/A | N/A | 1 smartphone | [fiche Sketchfab](https://sketchfab.com/models/fb1cf9b59df7457aa2ef734a3301384e) | Aucun pack UE Fab avec smartphone trouvé ; licences à vérifier une par une ; préférer un modèle sans marque. |

### P3 — Minerai / cristal récoltable (bloque phases 2.18, 3.26, 4.34)

**Verdict gisements : PAS COUVERT.** Preuves : toml `cave_cristal`/`rockFormation`/
`lifeform`/`SM_Ore` = 0 chacun (les 19 `crystal` de la mission = sons de pas) ; ADK :
`ore`/`crystal`/`gem` ne rend que Claymore (épées), `ML_Gem` (matériau), `SM_BioReactor`
(machine). Rochers génériques cuits existants mais **aucun nœud récoltable, aucune
variante intact/entamé/vidé**.

| Pack | Éditeur | Prix | Version UE | Squelette | Meshes utiles | Lien Fab | Risque en une phrase |
|---|---|---|---|---|---|---|---|
| **Customizable Pulsating Fantasy Crystals — RECOMMANDÉ** | [NV] | [NV] | [NV] | N/A | 48 static meshes + 24 BP (matériau pulsant émissif) | [fiche](https://www.fab.com/listings/e5d5d7c8-a209-4f09-9ec5-6614cd716506) | L'émissif pilotable simule intact → vidé via instances de matériau — exactement le besoin. |
| Abandoned Mine | Thunder Cloud Studio | [NV] | « UE5 » [NV] | N/A | 84 meshes stylisés dont minerai, 42 matériaux, LODs : 0 | [fiche](https://www.fab.com/listings/fc473a6b-00ae-49a4-ac67-cdb00e2bf651) | Stylisé + zéro LOD + demo map dépendant d'un plugin (meshes exploitables seuls). |
| Stylized Crystal Pack | [NV] | [NV] | [NV] | N/A | 9 formations de cristaux émissives | [fiche](https://www.fab.com/listings/ac4247b8-e7b8-4826-92b2-1cf5ebfedeac) | Petit pack, variété faible pour des filons entiers. |
| POLYGON Sci-Fi Worlds (joker, cf. §4) | Synty Studios | [NV] | [NV] | N/A | Mining Drills, Crystals (1 200+ modèles low poly) | [fiche](https://www.fab.com/listings/dad680a5-fcaf-4863-b080-f9b4fdc2ac5e) | Low poly Synty ≠ réalisme CITY_PACK — cassure visuelle à assumer. |

Note : aucun pack trouvé avec variantes explicites « entamé » — l'état se fera par
échange de matériau/mesh en Lua nanos ; les rochers locaux cuits complètent les filons.

### P4 — Badge / accréditation / lecteur / scanner (bloque phases 4.31, 5.39)

**Verdict gisements : PARTIEL — cartes oui (probablement), lecteurs non.** Preuves :
ADK Defender `BP_LootSecurityClearanceLvl1/2/3` + parent, **non cuits**
(`SecurityClearance` = 0 dans le toml) ; ⚠ ce sont des BP de loot, le mesh de carte
référencé n'est pas identifié **[NV]**. Aucun lecteur mural (`keycard`/`badge`/
`cardreader`/`AccessCard` = 0). `SM_Xray_Scanner` ×3 cuit = portique d'aéroport
TERMINAL, pas un lecteur. `biometric` = 0.

| Pack | Éditeur | Prix | Version UE | Squelette | Meshes utiles | Lien Fab | Risque en une phrase |
|---|---|---|---|---|---|---|---|
| **Cuisson des 3 cartes Defender — RECOMMANDÉ (0 €, d'abord)** | (interne, ADK) | 0 € | N/A | N/A | 3 niveaux de cartes d'accréditation | — | Sous réserve que les BP référencent un mesh de carte exploitable **[NV]**. |
| **Ultimate Keypad Bundle — RECOMMANDÉ pour les lecteurs muraux** | [NV] | [NV] | [NV] | N/A | 6 panneaux d'accès muraux sci-fi/industriels | [fiche](https://www.fab.com/listings/f16f5d2f-4422-4663-86ab-f62ca8543b87) | Keypads (code), pas RFID — visuellement proche, fiction à adapter. |
| CC0 - Keypad Door Lock | plaggy | **Gratuit (CC0, vérifié)** | FBX/glTF/USDZ (import manuel) | N/A | 1 modèle (993 poly, PBR 4K) | [fiche](https://www.fab.com/listings/0addf94d-c016-4679-abfb-5a5a3142fba9) | Un seul modèle, import manuel, mais gratuit et CC0 sans condition. |
| Access Security Panel – Interactive Door Mechanism | [NV] | [NV] | [NV] | N/A | 1 panneau keypad + levier + écran | [fiche](https://www.fab.com/listings/26a0af50-a8f9-42d8-9c54-19b3aea9fc58) | Un seul modèle, low poly. |
| POLYGON Sci-Fi Worlds (joker, cf. §4) | Synty Studios | [NV] | [NV] | N/A | « Swipe Cards » listées | [fiche](https://www.fab.com/listings/dad680a5-fcaf-4863-b080-f9b4fdc2ac5e) | Cartes seules, pas de lecteur mural confirmé. |
| Sci Fi Orion Mars Med Lab | [NV] | [NV] | [NV] | N/A | « Bio scanners » + écrans | [fiche](https://www.fab.com/listings/b87d20b5-af04-4e23-9416-b272e3232801) | Scanners médicaux, pas contrôle d'accès. |

**Constat honnête** : aucun pack « lecteur de badge RFID mural + carte » dédié n'a été
trouvé sur Fab via la recherche web — les keypads muraux sont le plus proche. Le CC0
gratuit permet de prototyper sans dépenser.

### P5 — Caméras de surveillance (bloque phase 4.29)

**Verdict gisements : PAS COUVERT.** Preuves : toml `SM_CCTV` = 0 ; ADK `*camera*` =
code de caméra de jeu uniquement (CameraMode d'AdvancedARPGCombat ; `AC_Camera` =
ActorComponent SmartLocomotion). Les tourelles DMD (`SKM_Turret_MK1`, squelettique et
animée) et Defender sont des **tourelles armées**, réutilisables visuellement en
fallback mais c'est un canon.

| Pack | Éditeur | Prix | Version UE | Squelette | Meshes utiles | Lien Fab | Risque en une phrase |
|---|---|---|---|---|---|---|---|
| **Sci-Fi Props - Low Poly — RECOMMANDÉ (joker P5+P6, cf. §4)** | iThappy Studios | [NV] | [NV] | N/A | **Security Cameras ×13 murales « with rotation and tracking »** + Farm ×15 | [fiche](https://www.fab.com/listings/38048084-9468-4e8e-9f42-67cb23bcde64) | Low poly ; « rotation and tracking » à vérifier (meshes séparés ou BP ? **[NV]**). |
| Security Camera System Unlimited | [NV] | [NV] | [NV] | N/A | Acteurs caméra : patrouille, détection, suivi de cible | [fiche](https://www.fab.com/listings/31906998-a133-40a5-9989-0907f8ee05f7) | Système de gameplay — vérifier impérativement 100 % Blueprint et meshes inclus **[NV]**. |
| Security Cameras / 10 Assets | [NV] | [NV] | [NV] (2023) | N/A | 10 caméras PBR « AAA » | [fiche](https://www.fab.com/listings/08823ff3-064f-4fd9-bbca-9ef90d72c87e) | Fixes uniquement probablement ; pas de tourelle. |
| SC-Fi Security Camera Vol2 | [NV] | [NV] | [NV] | N/A | 10 caméras CCTV sci-fi | [fiche](https://www.fab.com/listings/b0a2ae43-dc43-49b1-8e0b-9d49fb7b273b) | Contenu exact (fixe/tourelle) [NV]. |
| ~~Ultimate C++ Security Camera Framework~~ | — | — | — | — | — | [fiche](https://www.fab.com/listings/b489f7a0-d098-4121-a3f0-00a78753b5f9) | **EXCLU : plugin C++ — inutilisable sur client shipping nanos.** |

### P6 — Agriculture futuriste (bloque phases 2/3 nourriture, survie)

**Verdict gisements : PAS COUVERT.** Preuves : toml `hydropon`/`greenhouse`/`SM_Seed`
= 0 ; ADK : seules plantes = plantes d'appartement `SM_PLANT_1/7`. Le « Farming And
Mining Pack » local (168 fichiers) inspecté : **animations + outils** (pioche, houe,
pelle, râteau + AnimBP UE4 Mannequin), **zéro mesh de culture, serre ou minerai** —
complément gratuit pour l'action, pas pour le décor.

| Pack | Éditeur | Prix | Version UE | Squelette | Meshes utiles | Lien Fab | Risque en une phrase |
|---|---|---|---|---|---|---|---|
| **Sci-Fi Props - Low Poly — RECOMMANDÉ (joker P5+P6, cf. §4)** | iThappy Studios | [NV] | [NV] | N/A | **Farm elements ×15 : tours verticales, racks hydroponiques, pods, cuves, plantes à plusieurs stades** | [fiche](https://www.fab.com/listings/38048084-9468-4e8e-9f42-67cb23bcde64) | Low poly ; « plantes à plusieurs stades » = les stades de croissance demandés, à confirmer visuellement. |
| Low Poly Sci-Fi Botanical Systems Pack G-002 | [NV] | [NV] | [NV] | N/A | Structures hydroponiques + botanique sci-fi (quantité [NV]) | [fiche](https://www.fab.com/listings/92559b59-5696-469d-b5cc-306a9495e78f) | Contenu et modularité exacts [NV]. |
| SurrounDead Bundle | [NV] | [NV] | [NV] | N/A | Garden : 7 plantes ×4 stades, 9 éléments de serre ; Bunker : 8 hydroponics + laitue ×4 stades | [fiche](https://www.fab.com/listings/5f628d76-fcb7-4b48-81a4-f3c84b9e2254) | Style post-apo handpainted ; ~1 500 assets pour 2 sous-packs. |
| POLYGON Sci-Fi Worlds (joker, cf. §4) | Synty | [NV] | [NV] | N/A | « Hydroponics » dans les props | [fiche](https://www.fab.com/listings/dad680a5-fcaf-4863-b080-f9b4fdc2ac5e) | Quantité inconnue (une ligne dans 444 props). |

### P7 — Menottes, commissariat, cellule (bloque phases 5.40/42)

**Verdict gisements : PAS COUVERT.** Preuves : toml `Handcuff` = 0 ; ADK
`handcuff`/`jail`/`prison`/`cell` ne rend que `BP_LootEnergyCell`, textures Voronoi et
sons « scuff ». Aucun mobilier de cellule ou commissariat. (`SK_Male_Police_Armor_Army`
et `SM_Cop_Hat` existent côté uniformes — §1 bis de la mission — mais rien côté
mobilier/menottes.)

| Pack | Éditeur | Prix | Version UE | Squelette | Meshes utiles | Lien Fab | Risque en une phrase |
|---|---|---|---|---|---|---|---|
| **POLYGON Police Station Pack — RECOMMANDÉ (joker P4+P5+P7, cf. §4)** | Synty Studios | **73,62 € vérifié (syntystore.com, licence 5 postes, 2026-09-09) ; prix Fab [NV]** | **Unreal 5.3+ vérifié (site éditeur)** ; 5.7 non listé | persos « rigged for retargeting », squelette [NV] | 680+ prefabs : **Handcuffs, Cuffs, Badges, cellules, mobilier complet, Security Cameras, Scanner, Metal Detector**, 11 persos | [fiche](https://www.fab.com/listings/5287f82c-e768-4796-b8d7-dba85222cfe9) | Projet 5.3 ouvert en 5.7 = migration à tester ; low poly ; le « Scanner » est vraisemblablement corporel/détecteur, pas un lecteur de badge. |
| Steel Handcuffs with Key — Double Lock Police Handcuffs AAA | [NV] | [NV] | [NV] | N/A | 1 modèle menottes PBR réaliste + clé | [fiche](https://www.fab.com/listings/2dce6bc4-14c6-4cda-8bfd-62ae8fb52537) | Un seul prop — règle les menottes, pas la cellule ni le mobilier. Appoint gros plan. |
| QA Police Station | QA | [NV] | pack de 2020, probablement 4.2x-5.x [NV] | N/A | 300+ objets modulaires, cellules ×2 versions, racks d'armes | [fiche](https://www.fab.com/listings/83668fdb-4b9c-402d-8ad3-fec91535652c) | Âge du pack = risque compat 5.7 ; pas de menottes confirmées. |
| Retro Police Station Environment | Leartes Studios | [NV] | UE 5.0+ (Nanite/Lumen, vérifié description) | N/A | 476 meshes : prison cell, interrogatoire, mobilier | [fiche](https://www.fab.com/listings/66d3cc64-7b22-49ce-8f27-1f8591e141a8) | Style rétro 1950-70 ; dépendance outil ULAT à vérifier [NV]. |

---

## 4. Les jokers vérifiés

Qualificatif de « joker » fondé sur le **contenu listé** (listes d'assets officielles
ou descriptions indexées), jamais sur le nom — leçon de la mission §0.

1. **POLYGON Police Station (Synty) → P7 + P4 + P5. LE vrai joker.** Repose sur la
   liste d'assets officielle Synty (680+ prefabs) : `Handcuffs`, `Cuffs`, cellules,
   mobilier complet de commissariat (P7) ; `Badges` (P4) ; `Security Cameras`,
   `Scanner`, `Metal Detector` (P5). **73,62 € vérifié sur syntystore.com**, UE 5.3+
   vérifié. Limites : low poly ; 5.7 à tester ; le « Scanner » est vraisemblablement
   un scanner corporel/détecteur de métaux, pas un lecteur de badge mural — il ne
   supprime pas le besoin P4 lecteurs.
2. **Sci-Fi Props - Low Poly (iThappy) → P5 + P6.** Repose sur la description indexée
   de la fiche Fab : **13 caméras de sécurité murales « with rotation and tracking »**
   (P5) + **15 éléments Farm : tours verticales, racks hydroponiques, pods de culture,
   cuves, plantes à plusieurs stades** (P6). Limites : low poly ; prix et version UE
   [NV] ; nature des caméras rotatives (meshes séparés / squelettes / BP) [NV].
3. **POLYGON Sci-Fi Worlds (Synty) → P3 + P4 + P6 partiel.** Repose sur la liste de
   props de la fiche : `Mining Drills`, `Crystals` (P3) ; `Swipe Cards` (P4) ;
   `Hydroponics` (P6) ; `Turrets` (armées, **pas** des caméras — ne compte pas pour
   P5). Limite décisive : chaque catégorie n'a que quelques assets (une ligne dans
   444 props) — **ne suffit à aucune priorité à lui seul** ; non retenu dans le panier.

---

## 5. LE PANIER MINIMAL

La plus petite combinaison qui débloque le plus de phases de la roadmap, en deux
étages : d'abord ce qui coûte 0 €, ensuite seulement ce qui reste.

### (a) À 0 € — cuisson et téléchargements gratuits (à faire AVANT tout achat)

| Action | Débloque | Preuve / base |
|---|---|---|
| **Cuire les 12 voitures de `City_Traffic_Pro`** (os `Wheel_FL/FR/RL/RR`, `ChaosWheeledVehicleMovementComponent` = plugin **moteur Epic**, PhysicsAssets prêts) | P1 à ~90 % → phases 2.15 (garage), 3.22 (convois), une partie de 5.42 (police) | FAB_RECHERCHE_P1_P2 §P1, preuves binaires |
| **Cuire les 3 cartes Defender** `BP_LootSecurityClearanceLvl1/2/3` | P4 côté cartes → phases 4.31, 5.39 | FAB_RECHERCHE_P3_P7 §0 (sous réserve mesh de carte [NV]) |
| **Talkie sci-fi CC-BY gratuit** (CraigG124, Sketchfab) à décimer + attacher aux anims radio déjà cuites | P2 → phases 5.36/37 | FAB_RECHERCHE_P1_P2 §P2 |
| **Keypad CC0 gratuit** (plaggy) pour prototyper les lecteurs muraux | P4 prototype → phase 4.31 | FAB_RECHERCHE_P3_P7 §P4 |
| Compléments déjà en gisement : anims `AS_Sit_Phone*` + `HandSignal_Radio`, outils/anims du Farming And Mining Pack, tourelle `SKM_Turret_MK1` en fallback visuel caméra motorisée | P2, P3/P6 actions, P5 appoint | les deux rapports |

### (b) Achats payants

| Achat | Débloque | Prix |
|---|---|---|
| **POLYGON Police Station** (Synty) | P7 (menottes, cellules, mobilier) + P4 badges + P5 caméras d'appoint → phases 5.40/42, 4.31, 4.29 | **73,62 € — vérifié** (syntystore.com, licence 5 postes) |
| Drivable Cars: Advanced Multiplayer (Digital Dive) | P1 variantes police/taxi (le seul trou véhicules restant) → phase 5.42 complète | *[NV — estimé, prix Fab illisible]* |
| Sci-Fi Props (iThappy) | P6 hydroponie complète + P5 caméras sci-fi rotatives → phases 2/3 survie, 4.29 | *[NV — estimé]* |
| Customizable Pulsating Fantasy Crystals | P3 minerais/cristaux récoltables → phases 2.18, 3.26, 4.34 | *[NV — estimé]* |
| Ultimate Keypad Bundle *(optionnel si le CC0 suffit)* | P4 lecteurs muraux définitifs → phase 4.31 | *[NV — estimé ; ou 0 € avec le CC0]* |

### Total

- **Vérifié : 73,62 €** (Synty Police Station, syntystore.com).
- **Non vérifié : 4 prix Fab** (Digital Dive Cars, iThappy Sci-Fi Props, Pulsating
  Crystals, Keypad Bundle) — fab.com bloque tout fetch (Cloudflare 403) ; aucun
  montant ne peut être avancé sans l'inventer. **Total maximum = 73,62 € + ces 4 prix
  à lire sur les fiches au moment de l'achat.**
- Écartés avec prix vérifié : Yarrawah Police Car **49,99 $** (UE ≤ 5.1, 1 voiture) —
  mauvais rapport, non retenu.

Ordre d'exécution : (a) cuissons 0 € d'abord — elles ferment P1 à 90 %, la moitié de
P4 et l'essentiel de P2 ; (b) achat Synty Police Station (joker triple) ; (c) Digital
Dive seulement si la phase 5.42 exige police/taxi avant que la cuisson locale ne soit
évaluée ; (d) iThappy puis Crystals selon l'ordre des phases.

---

## 6. Avant d'acheter — check-list par achat

Pour **chaque** pack retenu, dans l'ordre :

1. **Noms d'os de roues (Digital Dive Cars et Bikes)** : ouvrir le pack dans l'éditeur
   et extraire les noms d'os du squelette maison (« bone grid » décrit le système de
   dégâts, pas les os de roues). Condition suspensive : sans os de roues exploitables
   par `VehicleWheeled`, le pack ne résout pas P1. **C'est LE point de contrôle avant
   cuisson.**
2. **Absence de `+` et de caractères exotiques dans les noms d'assets** : non
   vérifiable avant téléchargement ; contrôler à la première ouverture — un `+` fait
   refuser le pack ENTIER par nanos (déjà payé une fois). (City_Traffic_Pro local =
   vérifié propre.)
3. **Version UE réelle après téléchargement** : ouvrir le projet dans UE 5.7 et tester
   la migration — aucune fiche consultée ne déclare explicitement 5.7 (Synty = 5.3+,
   City Traffic Pro = 5.0–5.6, Digital Dive = 5.4+ avec fix 5.7 en release notes).
4. **Licence** : lire la licence Fab Personal vs Professional par pack ; vérifier
   qu'aucun n'est « free for the month » avec conditions (les promotions tournent) ;
   pour le talkie Sketchfab, honorer le **crédit CC-BY** dans le jeu.
5. **Sans plugin C++ tiers** : vérifier que `Security Camera System Unlimited` (si
   retenu) est 100 % Blueprint ; rappel — nanos n'emporte que les meshes, les BP Chaos
   des packs véhicules restent inutilisés.
6. **Prix sur la fiche au moment de l'achat** : les prix de ce document sont
   majoritairement [NV] (Cloudflare 403) — les relire sur fab.com connecté avant de
   payer.

---

## 7. Ce que nous n'avons pas pu vérifier

Rubrique exigée par la mission §3 (« Dis ce que tu n'as pas pu vérifier ») —
consolidation des deux rapports et du chiffrage.

**Prix et accès Fab :**

- **Tous les prix fab.com** : fetch bloqué par Cloudflare 403 (pages de recherche ET
  fiches produits ; l'endpoint `fab.com/i/listings/…` répond 403 ; les prix sont
  rendus en JS, inaccessibles à FetchURL). Seuls prix vérifiés : **POLYGON Police
  Station 73,62 €** (syntystore.com — le prix Fab peut différer), **Yarrawah Police
  Car 49,99 $** (site éditeur), **Keypad plaggy gratuit CC0**, **talkie CraigG124
  gratuit CC-BY**.
- **Versions UE déclarées exactes** sur les fiches Fab (bandeau « supported versions »
  rendu en JS) : pour Digital Dive, appui sur les release notes éditeur (UE 5.4+, fix
  5.7) ; pour City Traffic Pro, sur des sites miroirs (5.0–5.6) — sources secondaires.
  **Aucune fiche consultée ne mentionne explicitement UE 5.7.**
- **Licences Fab Personal vs Professional** par pack, et éventuels « free for the
  month » en cours.

**Contenu des packs (impossible sans téléchargement) :**

- **Noms d'os de roues des packs Digital Dive** — le point de contrôle n°1 (§6).
- **Absence de `+` / caractères exotiques** dans les noms d'assets de chaque pack non
  téléchargé.
- Si les caméras iThappy « rotation and tracking » sont des meshes séparés
  articulables, des squelettes ou des BP.
- Si `Security Camera System Unlimited` est pur Blueprint et inclut les meshes.
- Le type exact du « Scanner » Synty (corporel ? détecteur de métaux ? lecteur ?).
- Si `Retro Police Station` (Leartes) fonctionne sans l'outil ULAT après migration.
- Le squelette exact des 11 persos Synty Police Station (« rigged for retargeting »).
- La fiche « Ultimate Forest Survival Pack » : version UE et format (FBX générique
  Unity/UE probable, pas des .uasset natifs).
- Le lien Fab du pack `Ridable Bikes: Advanced` (seuls la Sport Bike individuelle et
  les release notes éditeur sont vérifiés).

**Gisements locaux :**

- Si les BP Defender `SecurityClearanceLvl1/2/3` référencent un **mesh de carte**
  exploitable.
- L'**éditeur** du « Farming And Mining Pack » local et de plusieurs packs P3/P4.
- Les **licences Sketchfab** du « Makeshift Walkie-Talkie » et du smartphone Redmi
  (pages trouvées, licences non lues) — à valider une par une.
- Piste écartée par conception, non par inspection : les véhicules du « City Sample »
  d'Epic (StaticMeshes Mass AI majoritairement).

**Garde-robe MetaCustom (hors achats, pour mémoire) :** nature exacte de `SK_MetaP`/
`SK_MetaP1` ; pondération réelle des pièces (si par chance elles ne sont pondérées que
sur les 68 os communs, un simple rebind suffirait) ; comportement exact du client nanos
face à la référence squelette pendante ; `CompatibleSkeletons` éventuel entre
`Skel_Dummy` et `SKEL_Mannequin` — à trancher à l'étape d'audit éditeur.

---

*Fin du document. Aucune donnée de ce fichier ne provient d'autre chose que les quatre
sources citées en tête ; les divergences entre sources sont tranchées au §0-correction.*
