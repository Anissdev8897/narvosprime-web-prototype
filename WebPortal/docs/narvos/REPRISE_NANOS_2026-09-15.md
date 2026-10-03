# Reprise nanos — 15 septembre 2026

Ce bilan complète l'audit du 14 septembre. Les corrections ci-dessous sont sauvegardées, mais **aucun nouveau cook ni remplacement du pack n'a été effectué**. Les rendus en jeu, le pilotage des nouveaux véhicules et les nouveaux voyages restent à valider. Aucun nouvel arrêt du PC n'a été demandé pour cette reprise.

## Correctifs terminés dans l'ADK

- `BP_NarvosMH_M/F`, fonction `NarvosMaillage` : après affectation d'un vêtement, rétablir ses matériaux par défaut avant `EnableMasterPose`. Cela empêche les chaussures de conserver les matériaux du choix précédent. Traitement limité à Torso/Legs/Feet/Prop ; Face et Body préservés.
- Générateur conservé : `scripts/adk-mcs-fonctions.mjs` utilise le même raccordement que l'intervention ciblée, dans `scripts/lib/mcs-nettoyer-materiaux.mjs`.
- Deux Blueprints compilés et sauvegardés ; **28 contrôles** sur les remplacements M/F, retrait/remise, matériaux hérités, leader Body et préservation du visage. Sauvegardes indépendantes : `.hermes/sauvegardes/mcs-overrides-20260915/`.
- `Spaceship_Pack_1` était déjà rangé dans l'ADK sous un nom de dossier incompatible avec ses références `/Game/SpaceShips_Vol1`. Copie de travail replacée au bon chemin, sans supprimer les sources ni l'ancienne copie.
- Fermeture de dépendances de cinq assemblages : **109 assets** sauvegardés sous `/Game/Narvos/SpaceShips_Vol1`. Les cinq Blueprints compilent et peuvent être instanciés avec des meshes et matériaux affectés. Les 143 fichiers sources copiés sont inchangés par SHA-256. Les dossiers de staging sont exclus du cook ; le dossier promu reste inclus.

Assemblages : `BP_GB4_Fighter`, `BP_GB4_SuperCarrier`, `BP_GB5_NukeFrigate`, `BP_GB6_Dreadnought`, `BP_GB7_CommanderShip`. Leur existence et leur compilation ne prouvent pas un pilotage nanos : ce sont des Actors, pas des classes de véhicules natives.

## Menu des véhicules

- **U** ouvre la catégorie Vaisseaux du panneau existant. **Z** conserve l'accès général ; filtre Tous / Voitures et motos / Vaisseaux. L'action est dans `Commandes.lua`, donc reconfigurable par compte avec l'arbitrage existant des touches.
- Catalogue séparé `Shared/Catalogs/Vaisseaux.lua`, chargé dans `Shared/Index.lua`, envoyé par le même événement serveur que les voitures/motos. Aucun identifiant de manifeste n'est inventé avant cook.
- Les cinq vaisseaux apparaissent comme indisponibles au pilotage. Aucun clic de spawn n'est émis pour eux. Le serveur conserve son contrôle de session, de droits et de modèle dans le système de voitures existant.
- Contrôle WebUI : filtre avant réception du catalogue, compteur, refus des modèles non prêts et absence de clic actif sans droits ; voitures existantes toujours accessibles aux comptes autorisés.

## Diagnostic PNJ et vêtements gris

Quinze familles de GLB animés contiennent un mode BLEND, alors que leurs modèles sources sont opaques et que les textures examinées ont un alpha entièrement opaque. Cependant, les **27 SkeletalMesh correspondants chargés dans l'ADK utilisent déjà des matériaux opaques**. Aucun matériau PNJ n'a donc été reconverti. Vérifier ensuite les versions réellement livrées et les personnages observés dans le client ; ne pas annoncer la transparence corrigée sur la seule base de cette sonde.

Les huit Material Instances manquantes de MetaCustom restent absentes du dossier source indiqué par Aniss. Le nettoyage des overrides ne recrée pas ces matériaux : les 19 slots concernés restent à réparer à partir des affectations exactes ou d'une source complète. Les cinq slots du Rogue_Rig étaient déjà vides dans la source.

## Autres véhicules : extraction et qualification

Une passe sur **70 104 fichiers** a relevé **1 636 fichiers candidats**, avant les nouvelles extractions Multiversal. Ce sont des pièces, assemblages, variantes et archives, pas 1 636 véhicules. En particulier, 769 STL proviennent du pack pour impression 3D ; ils ne doivent pas être ajoutés comme autant de véhicules pilotables.

Packs à poursuivre : Drivable Cars, Hover Vehicles, modèles DCC, POLYGON Sci-Fi Worlds, Echo One, Spaceship Engine et Multiversal Vehicle Controller. Les voitures City Traffic Pro et les motos déjà branchées sont conservées. Les 107 fichiers Echo One / Spaceship Engine extraits le 14 restent disponibles.

Multiversal : le premier niveau ne contenait aucun FBX, mais **12 archives Unity internes**. Elles ont été conservées et extraites séparément, sans mélange silencieux des variantes Built-in/URP/HDRP. **428 fichiers importables vérifiés par SHA-256**, dont **83 FBX**, et **2 484 références** `.mat`, `.prefab` et métadonnées conservées. Détails dans `ASTRA_multiversal_verified_20260915.json`. Les familles de modèles identifiées sont BMW M3 GTR E46, Lexus LFA, Porsche Taycan Turbo S, Toyota Supra MK4, VW Golf GTI et Subaru WRX police ; les 83 FBX incluent aussi leurs sous-meshes, des pièces communes, le circuit et des animations. Aucun de ces nouveaux véhicules Unity n'est encore importé/pilotable dans nanos. L'extracteur commun corrige désormais aussi les chemins d'archives dépassant MAX_PATH, qui étaient signalés à tort comme absents.

## Skills et contrôles

Skill `nanos-world` précisé avec `skill-creator` : absence de classe native ≠ impossibilité d'un adaptateur. Les obligations de qualification des entrées/sorties, collisions et réseau sont conservées. La référence Unreal précise les API de matériaux réellement accessibles aux Blueprints UE5.7. Le commentaire du catalogue web qui disait « jamais pilotable » est corrigé sans changer ses données.

Batterie : 94 harnais exécutés, 10 657 assertions annoncées réussies ; 93 harnais verts et un échec de lecture du catalogue par `cablage-check`. Le catalogue a ensuite été aligné sur la convention de retour d'une table nommée ; **retest ciblé de câblage réussi**, comme celui du menu. Ne pas présenter le premier journal comme une batterie intégralement verte : sa seule erreur et son retest sont conservés séparément. Skill validé avec `quick_validate.py` ; syntaxe des scripts du pont contrôlée.

## Reprise suivante

1. Terminer la qualification des véhicules par assemblage et contrôleur, en réutilisant les composants du pack. Les scènes de démonstration et modèles imprimables ne constituent pas des contrôleurs nanos.
2. Poursuivre les matériaux MCS manquants, les contrôles faciaux et l'alignement mains/armes. La caméra, déclarée correcte par Aniss, est préservée.
3. Vérifier les dépendances des assets modifiés, puis cook et livraison contrôlée. Ne pas lancer aveuglément `narvos-chaine-cook.sh` : sa règle « Packages Remain 0 » ne suffit pas à exclure les erreurs d'assets et son builder vide la destination avant copie.
4. Après livraison vérifiée, raccorder la nouvelle destination `megastructure` distincte d'Azur et le passage orbital de Sylve. Les maps et planètes préparées le 14 ne doivent pas être dupliquées.
5. Valider réellement dans nanos : corps, vêtements, mains/armes, PNJ, ciel étoilé, nouveaux passages et véhicules.

Dernière sonde : éditeur ouvert sur `NanosWorldEntryMap`, zéro map et zéro asset non sauvegardé. Aucun cook en cours.

## Preuves

Chemins relatifs à `D:/mes_projet/narvosprime-web-prototype` :

- `.hermes/ASTRA_mcs_overrides_validation_20260915.json`
- `.hermes/ASTRA_pnj_live_20260915.json` et `ASTRA_pnj_transparence_sources_20260915.json`
- `.hermes/ASTRA_spaceships_stage_20260915.json`, `ASTRA_spaceships_promotion_20260915.json`, `ASTRA_spaceships_blueprints_20260915.json`, `ASTRA_spaceships_assemblages_20260915.json`
- `.hermes/ASTRA_vehicules_inventaire_20260915.json`
- `.hermes/ASTRA_multiversal_archives_20260915.json`, `ASTRA_multiversal_verified_20260915.json`
- `.hermes/ASTRA_tests_20260915.txt`, `ASTRA_cablage_retest_20260915.txt`
- `.hermes/ASTRA_etat_reprise_20260915.json`

Référence API consultée : [UMeshComponent, Epic](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/UMeshComponent), confrontée aux en-têtes locaux UE5.7 ; [référence principale nanos](https://docs.nanos-world.com/fr/docs).