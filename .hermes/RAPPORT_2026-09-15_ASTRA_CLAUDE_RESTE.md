# Relevé NARVOS du 15 septembre 2026 — Astra, Claude, et ce qui reste

Écrit par Claude le 15/09 au soir, à la demande de Hanibes : « fais le rapport de ce qui a été fait par Astra, de ce que tu n'as pas fait et de ce qui reste à faire ».

**Règle de lecture.** Trois états, jamais confondus :
- **VU EN JEU** — observé dans le client nanos.
- **ÉCRIT** — code en place, harnais verts, mais jamais observé en jeu.
- **À FAIRE** — demandé, pas fait.

État du dépôt au moment du relevé : batterie `node scripts/lua-harness/tout.mjs` → **100 harnais, 11 604 assertions, 0 rouge**. Serveur actif lancé à 18:04 (`--playtest`) : il contient le départ, la cité, `/revive` et les sorts arme en main, **mais pas** l'IA des PNJ, les niveaux, la défense des PNJ ni la mêlée par famille (écrits après). Client ouvert.

---

## 1. Ce qu'a fait Astra (15/09, jusqu'à ~15 h)

Source : `.hermes/REPRISE_ASTRA_2026-09-15.md` et ses journaux `ASTRA_*`.

### Pack d'assets — six livraisons vérifiées (cook → staging → SHA → sauvegarde de l'ancien pack)
| Lot | Contenu | Paquets |
|---|---|---|
| lot3 | Map_Narvos / Orbital / Megastructure, 9 meshes MCS, BP MetaHuman M/F, rigs et retargeteurs, tenue Work, 5 vaisseaux | 6 081 |
| lot4 | BP M/F + post-process facial (15 contrôles faciaux, 90 mesures géométriques) | 485 |
| lot5 | Collision `ComplexAsSimple` des 623 meshes de la Forge | 3 433 |
| lot6 | 78 liaisons coiffure × visage, recherche de composant insensible à la casse, `NarvosMorph` | 751 |
| lot7 | Fonctions de diagnostic de maillage (LOD) dans les BP | 485 |
| lot8 | 2 BP + 2 coiffures (LOD « strands » pour Longs lisses / Carré dégradé) | 4 racines |

Outils : `scripts/nanos-livraison-lot.py` (staging indépendant, SHA, refus d'un cook en erreur, retour arrière), builder à `--staging` obligatoire + `pack-staging-check.mjs`, règles de cook (sortie courte `Saved/CkN`, `-DisablePlugins=UnrealMCPServer`).

### Création / Meta Customization System
- **Cause du visage invisible prouvée** : `GetObjectName` rend `face` en shipping, `Face` dans l'éditeur → comparaison sensible à la casse. BP corrigés (livré lot6).
- Adaptateurs corps (246 nœuds de démo retirés) et visage ; post-process des 9 meshes MCS ; matériaux des coiffures réaffectés ; 78 liaisons (65 nouvelles) ; 5 coupes compatibles avec les 6 visages, noms français ; duvet corrigé ; cache client `MetaCustom` qui retente.
- Tenue Work réparée (livrée, **pas testée en jeu**). FBIK des mains (4 objectifs) livré, **mains encore décalées de quelques cm**.
- Package temporaire `astra-mcs-diagnostic` (sondes, restauration du brouillon) — **à retirer**.

### Mondes, ciel, véhicules
- Mégastructure distincte d'Azur ; portails orbital ↔ Mégastructure / Sylve (franchis en test) ; nouvelle arrivée de Sylve ; Forge : `DeclarerCharge` passe par `Charger` (décor enfin posé) ; `Depart.Via` corrigé.
- Map_Narvos (ville) : 109 redirections exactes, 64 dépendances dupliquées, 224 assets ré-enregistrés, 23 matériaux restaurés, repli ORM neutre sur 2 parents.
- Ciel client : `SetSkyMode` + `Reconstruct` (harnais `ciel-client.mjs`). Ciel spatial encore faux (moitié basse bleue).
- Véhicules : HoverVehicles et DD_Vehicles copiés et qualifiés (41 BP, ChaosVehiclesPlugin) mais **non livrés** ; 5 vaisseaux assemblés **non pilotables** ; touche U et catégorie Vaisseaux.

### Gameplay (après 12 h)
- Recharges des sorts **5 / 4 / 60 s** (`spellCatalog.ts` → `Catalogs/Spells.lua`).
- `/give`, `/armes`, `Narvos:DonnerArme` → **dans le sac** (`DonnerAuSac`), ramassage au sac sans équipement automatique, harnais `armes-sac-integration.mjs`.
- Lancement serveur `--playtest` résolu (script + skill). 98 harnais / 10 850 assertions à 14:58.

### Laissé ouvert par Astra (ses propres notes)
7 Material Instances MCS + `MF_Accent` absents des sources · transparence des PNJ non reproduite · ciel spatial · pilotage des vaisseaux · qualification en jeu du visage, des 2 coupes (correctif LOD lot8 non vu), des yeux · joues (aucun morph convaincant) et ventre (réglage osseux, pas un morph) · Kellan / CoreC incomplets · Forge visuellement refusée.

---

## 2. Ce que j'ai fait (Claude, 15/09)

### VU EN JEU
- **Inventaire** : personnage filmé dans le cadre (`Client/ApercuInventaire.lua`) ; chaque arme photographiée en studio et détourée (`Client/VignettesObjets.lua`, `InvDetourer`) — AK-74U, Lewis Gun, fusil à pompe, Desert Eagle vus. *Deux retouches écrites après, non revues* : orientation (canon à droite, −90°) et exposition (Lewis Gun brûlé) ; **le cadre du personnage est redevenu vide** après la coupure d'`EyeAdaptation` → correctif de détection écrit, non revu.
- **Forge : mort à l'arrivée prouvée** (chute de 33 m, VIE 0/132, sol réel 143 102 contre arrivée 146 475) → `decalage_decor.Z` 133 153 → 136 374 ; vivant 132/132 ensuite. `/mapz` rendu relatif au calage.
- **Écran de départ** : Forge retirée (`depart = false`), **Akarlys par défaut** — vu.
- **Bug d'uid** : après un redémarrage, un objet reçu prenait l'uid d'une pile relue (fiche de l'AK au clic sur le Desert Eagle) → `Inventory.ReserverUids` au spawn. Effet vu : le Desert Eagle de test, déjà en double en base, a disparu au rechargement suivant.
- **Sort avec arme** : le geste de la main gauche s'est joué (vu furtivement pendant une chute) — effet au canon et synchronisation **non vus**.

### ÉCRIT (harnais verts, jamais vu en jeu)
- **Cité conservée** : colonne `personnages.cite` écrite au choix du départ, présélectionnée ensuite ; **`/revive`** (et `/revive <joueur>` admin) + **panneau RÉAPPARAÎTRE** (vérifié hors jeu dans un navigateur) ; retour à l'arrivée de la cité, 50 % PV / 30 % mana (règle web). Harnais `reapparition.mjs` 31/0, `depart.mjs` 82/0, `roster.mjs` 142/0.
- **Sorts arme en main** : gestes `Tactical_HandSignals` selon la prise (`Rifle_` / `Pistol_`, cuits sur SKEL_Mannequin), durée réelle lue dans les sources (2,333 s), **libération synchronisée** (`Logic/Sorts.RYTHMES`, fractions à régler à l'œil), **effet attaché au socket `muzzle`**, départ au canon annoncé par le client (borné à 2 m), bouclier et soin ne « tirent » plus, geste de zone en `AS_` (le montage importait des assets absents), un mort ne lance rien, horloge en temps réel. `sorts.mjs` 495/0.
- **HUD des recharges** : balayage conique fluide, chiffres, éclat quand le sort redevient prêt, trait bleu pour le manque de mana (vérifié hors jeu).
- **IA des PNJ** : perception réparée (**aucun PNJ n'avait jamais vu un joueur** : cibles `{x,y,z}` alors que la décision lit `position`) ; ordres de déplacement limités ; course / marche ; orientation ; ancre recalée au sol ; coup à l'impact avec portée revérifiée (on peut esquiver) et défense du joueur ; échecs de `MoveTo` signalés ; cadavres détruits après 20 s. Nouveau harnais `ia-serveur.mjs` 30/0 **qui rougit sur l'ancien code** (9 échecs), `ia.mjs` 371/0.
- **Niveaux des PNJ** : PV, dégâts, défense, résistance, cadence, XP selon le niveau (port de `npcLeveling.ts`, `Npc.tsx`, `npcStatPresets.ts`) ; niveau et couleur synchronisés ; défense des PNJ appliquée à la mêlée et aux sorts. Parité TS `progression.mjs` 2 235/0.
- **Mêlée par famille** : `Logic/Melee.lua` (8 familles : épée, épée à deux mains, dague, hache, contondant, lance, bâton, torche ; classement des objets ; meshes des 8 lames NARVOS ; montages de mêlée du pack de base ; sons officiels) ; `CombatServeur.Equiper` pose prise, échelle, gestes et sons par objet ; « une épée = une batte » supprimé. `roue.mjs` 102/0. **Pas de harnais dédié.**
- Enquêtes archivées : `ENQUETE_ARMES_SORTS`, `ENQUETE_FORGE_DEFAUTS`, `ENQUETE_IA_PNJ_NIVEAUX`, `ENQUETE_LOCOMOTION_AVANCEE`, `ENQUETE_MELEE` (tous du 2026-09-15).

---

## 3. Ce que je n'ai PAS fait

1. **Aucun essai en jeu** de l'IA, des niveaux, de la mêlée par famille, de `/revive` et du panneau, de l'effet au canon et de la synchro des sorts, du HUD des recharges, des vignettes et du cadre corrigés, des consommables. Le serveur n'a pas été relancé avec l'IA et la mêlée.
2. **Locomotion avancée** (esquive, roulade, escalade, glissade) : enquête seulement. Rien n'existe côté nanos.
3. **Touches** (chiffres 1-0, AZERTY `é " ' ( - è _ ç à ) =`, ponctuation, codes physiques, sauvegarde) : rien.
4. **Inventaire en 9 catégories** et effets des consommables : rien.
5. **Craft** (tenues MetaWardrobe, toutes les armes classées, consommables) : rien.
6. **Forge** : seulement la chute et le retrait du départ. Refonte non commencée.
7. **Armes à feu en main** (arme tenue par la main invisible du porteur, mains MetaHuman à ~8 cm, réglages du fusil à pompe, son `A_Moss500_Shot` absent) : rien.
8. **Validation finale (tests 1 à 16)** : non faite.
9. Test sans chat : Entrée n'ouvre pas la saisie sous pilotage d'écran → `/give` et `/revive` jamais essayés par moi. Le canal de commandes par fichier que j'ai voulu ajouter a été **refusé par la sécurité** (non écrit).

---

## 4. Reste à faire

### Bloqueurs
- **B1 · NavMesh absente de toutes les maps** → `MoveTo` probablement inopérant : les PNJ ne poursuivront pas. Mesurer d'abord (PNJ du menu N, bilan `[IA]`), puis ADK : `NavMeshBoundsVolume` + construction + cook + livraison. *Qui : mesure Claude, niveau Astra.*
- **B2 · La Tour : arrivée sans sol chargé** (joueur à Z 149 157 sous le sol mesuré 151 834, « sol : absent », chute sans fin) — et La Tour est proposée au départ. Retirer du départ en attendant, réparer le chargement du sous-niveau, vérifier les autres arrivées (Azur, Mégastructure, Sylve, Hub, Akarlys). *Qui : Claude + Astra.*
- **B3 · Marchands, pads, armurier, coffres, ateliers autour de la Forge** (ANCRE) → invisibles pour un joueur qui démarre à Akarlys. Les poser dans la cité. *Qui : Claude.*
- **B4 · Relancer le serveur et tester en jeu tout l'« ÉCRIT »** de la section 2. *Qui : Claude.*

### Demandes du 15/09, dans l'ordre
1. **Mêlée** : harnais `melee.mjs` ; régler prise et échelle par famille à l'œil ; contre (`AS_CounterFront_A` + riposte) ; enchaînement bloqué à l'étape 1 (horloge `Server.GetTime`) ; filtres épées / bâtons / distance ; générateurs (`DT_Equipment` Hyper, mêlées officielles perdues) ; boucliers.
2. **Locomotion** : mesurer le root motion (`AS_Dodge_*`, Mantle, Land_Roll, Slide) ; `Logic/Mouvements.lua` + serveur + touches (souris 4/5) ; invulnérabilité brève ; remise à zéro à la mort, au respawn, en véhicule et en voyage ; escalade native à vérifier.
3. **Touches** AZERTY / chiffres / ponctuation + sauvegarde ; défauts Z et Q à revoir.
4. **Armes à feu en main** : première personne, main MetaHuman, pompe (valeurs officielles du Moss500, sons), origine au canon.
5. **Inventaire** 9 catégories, consommables utilisables (quantité − 1), `/give` vérifié (bonne catégorie, pas d'auto-équipement).
6. **Craft** : tenues MetaWardrobe en objets, armes classées craftables et équipables, consommables, 21 recettes sans station.
7. **Forge refaite** : noms uniques par morceau, pas de Draco sur les UV, 259 matériaux gris, trous (`PoserPatches`), collision de repli Nanite, dossier `halo_map` de 18 Go mort (déplacer d'abord `SM_Patch_Sol`).
8. **Création** (Astra) : 2 coupes (lot8 à voir), joues / ventre, yeux, 7 MIC + `MF_Accent`, retrait d'`astra-mcs-diagnostic`.

### À vérifier (doutes relevés, non corrigés)
- Catalogue ISP généré : `isp_health_potion` → `SM_PotionFood`, `isp_food_potion` → `SM_PotionHealth`, `isp_apple` → `SM_TreasureBags02`. Vérifier les Data Assets source avant de corriger.
- Journaux serveur et client mis en tampon : les témoins `[IA]`, `[SORTS]`, `[MELEE]`, `[REAPPARITION]` n'apparaissent qu'avec du retard.

---

## 5. Décisions de Hanibes (tranchées le 15/09 au soir)

Les choix de gameplay que le code ne pouvait pas trancher seul. Chaque décision est suivie du travail qui en découle.

### D1 — Niveaux par monde et PNJ
- **Tranché** : les plages actuelles conviennent (Azur, Akarlys, Sylve, Mégastructure : 1–20 par défaut ; La Tour démarre au niveau 30 ; le personnage commence niveau 5).
- **À faire** : pouvoir **définir à la main le niveau de chaque PNJ ou ennemi placé dans le monde**. Hanibes place lui-même les PNJ et choisit leur niveau ; la valeur est **sauvegardée et persistante**, jamais réinitialisée.
- **À venir** : des **vaisseaux ennemis dans l'espace** qui attaquent le joueur, sur le même principe que les PNJ hostiles.

### D2 — Rythme d'attaque et combat des PNJ
- **Tranché** : le rythme d'attaque ne dépend plus uniquement de la recharge des sorts.
- **À faire** :
  - PNJ **à distance** : équipés d'armes, ils **visent et tirent** sur le joueur avec des animations adaptées ;
  - monstres et PNJ **de mêlée** : vraies animations de corps à corps — attaque, déplacement vers la cible, enchaînements ;
  - le système **distingue automatiquement** un ennemi à distance d'un ennemi de mêlée.

### D3 — Blessures, mort et butin
- **Tranché** : sous 25 % de PV, le PNJ peut **fuir temporairement**, éventuellement **récupérer de la vie**, puis **retourner au combat**.
- **À faire** : **butin aléatoire à la mort** — armes et équipements selon cinq raretés, les meilleures de plus en plus rares, les objets normaux et communs beaucoup plus fréquents :
  - Gris : Normal
  - Vert : Commun
  - Bleu : Rare
  - Violet : Épique
  - Légendaire
- Les ennemis font aussi tomber des **ressources de craft** (consommables, équipements et autres objets des ateliers).
- Le système de butin est **modulaire** : objets disponibles, raretés et probabilités faciles à modifier.

### D4 — Mort, réapparition et points de sauvegarde
- **Tranché** : à la mort, **réapparition automatique**.
- **À faire** : un prop **Zaap**. Activer un Zaap en fait le **nouveau point de réapparition** du joueur.
- Ordre de retour : **dernier Zaap activé**, sinon **point de spawn choisi au début du jeu**.
- La réapparition manuelle et la commande **`/revive` sont conservées**.

### D5 — Forge
- **Tranché** : la Forge **reste retirée du choix de départ**.
- La retravailler (textures, éclairage, environnement, trous, collisions, optimisation) **seulement si c'est peu coûteux** ; sinon la **supprimer temporairement**. La priorité reste aux systèmes de gameplay et aux maps qui fonctionnent.
- **Évaluation (Claude)** : les défauts relevés (259 matériaux sans texture, UV écrasés, trous, noms en collision entre morceaux) se corrigent à la source par un **réimport complet des 8 morceaux dans l'ADK puis un cook de ~3 400 paquets** — un chantier lourd. Recommandation : **retrait temporaire** (décor non chargé, portails fermés), marchands et pads déplacés vers Akarlys.

### Travail qui découle des décisions (s'ajoute à la section 4)
1. **D4** Réapparition automatique + prop Zaap (point de retour persistant par personnage) + `/revive` conservé.
2. **D5** Retrait temporaire de la Forge ; marchands, pads, armurier, coffres et ateliers déplacés vers Akarlys (rejoint B3).
3. **D1** Niveau choisi à la main par PNJ placé, enregistré et relu à chaque démarrage.
4. **D3** Fuite temporaire avec récupération de vie et retour au combat ; butin modulaire par rareté (Normal, Commun, Rare, Épique, Légendaire) et ressources de craft ; libellés de rareté de l'inventaire alignés sur ces cinq noms.
5. **D2** PNJ à distance armés (visée, tir, animations), PNJ de mêlée animés (attaque, approche, enchaînements), distinction automatique distance / mêlée ; rythme d'attaque propre au combat.
6. **D1 (plus tard)** Vaisseaux ennemis dans l'espace.