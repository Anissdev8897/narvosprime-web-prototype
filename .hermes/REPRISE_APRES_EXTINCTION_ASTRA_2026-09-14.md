# Reprise après l'arrêt demandé par Aniss

Le 14 septembre au soir, Aniss demande d'éteindre le PC après le travail parce qu'il va dormir. L'arrêt ne signifie pas que tous les défauts du jeu sont corrigés.

Rapport principal : `WebPortal/docs/narvos/AUDIT_NANOS_DEMANDES_ET_REPRISE_2026-09-14.md` depuis la racine `E:/narvosprime-web-prototype`.

## Sauvegardé dans l'ADK

- Corps : ABP_NarvosPersonnalisationCorps et initialisation Body dans BP_NarvosMH_M/F. 275 nœuds de pose conservés ; branche de sauvegarde locale par frame déconnectée dans la copie. 16 contrôles par sexe écrits/relus sur le récepteur ; compilation et sauvegarde réussies.
- Vêtements : NarvosMaillage appelle désormais EnableMasterPose après affectation réussie du mesh. Même correction dans `scripts/adk-mcs-fonctions.mjs`. Dix remplacements M/F relisent Body comme leader. Ne pas relancer le générateur complet comme sonde : il reconstruit neuf fonctions.
- MEGASTRUCTURE : parents des deux matériaux émissifs rétablis d'après les sources, valeurs conservées. Copie Map_Megastructure montée et déplacée ; point d'arrivée mesuré. Six acteurs d'environnement global enlevés seulement de la copie. Source intacte vérifiée par hash.
- Planètes Alien et Sylve créées par réutilisation de corps SpaceScenes, rangées dans Map_Orbital. Le rapport donne leurs coordonnées et rayons. Les liaisons Lua ne sont pas encore ouvertes.
- Douze Skills installés, huit entrées améliorées, validation finale passée ; archives Claude conservées.
- Echo One et Spaceship Engine : 107 fichiers extraits dont 13 FBX, identiques par SHA-256 aux contenus d'archives. Pas encore importés/pilotables.

## Ce qui reste réellement ouvert

**Pas de cook, de remplacement du pack ni de validation visuelle nanos sur ces modifications.** Le serveur utilisait encore l'ancien pack. Ne pas employer `--depuis-pack` pour les nouveaux assets : ils doivent être cuits.

1. Restaurer les Material Instances manquantes de MetaCustom et leurs dépendances exactes. `ASTRA_mcs_material_imports.json` contient les affectations par slot décodées des sources ; `ASTRA_mcs_materials_plan.json` constate 19 slots de huit meshes avec cible promue absente. Les cinq slots Rogue_Rig étaient déjà sans matériau dans la source : ne pas inventer leurs correspondances. Les 23 meshes inspectés sont sous MetaCustom/Skeletal_Meshes, pas tous les autres packs.
2. Nettoyer les overrides de matériau persistants lors du changement de chaussures, sans écraser les matériaux du visage. `EmptyOverrideMaterials` n'est PAS BlueprintCallable dans UE5.7 ; ne pas inventer cet appel. `GetNumMaterials` renvoie le nombre de matériaux du mesh, pas la longueur des anciens overrides.
3. Visages : Control Rig invalides, zéro contrôle facial généré ; ne pas réactiver les dépendances LiveLink qui faisaient planter nanos.
4. Mains/armes : caméra déclarée globalement correcte par Aniss ; inspecter retarget/sockets et mains avant tout changement de caméra.
5. PNJ transparents : diagnostic actuel par famille de matériaux, sans conversion aveugle en opaque.
6. Avant cook : contrôler références et shaders des assets concernés, sauvegarder, fermer proprement l'éditeur. Ne pas lancer de cook concurrent : il peut prendre le port MCP 13579.
7. Après cook réellement terminé et pack vérifié/livré : raccorder une nouvelle destination `megastructure` distincte d'`alien` (Azur), les deux sens de voyage et la Sylve orbitale. Conserver la route terrestre ; mesurer un point de retour distinct. Tests de voyages/autorité/arrivées puis vérification dans le client avec Aniss.
8. Ciel étoilé et vrais véhicules : le mode Space existe ; `/vaisseau` active le vol du personnage, ce n'est pas un véhicule. Vérifier le rendu client puis intégrer les FBX et les ressources Unity correctement.

## Preuves et prudence de reprise

- Les fichiers `ASTRA_megastructure_montage_verifie.json`, `ASTRA_planetes_ajout.json`, `ASTRA_mcs_vetements_apres.json`, `ASTRA_mcs_corps_verification.json` portent les vérifications finales. Certaines tentatives antérieures sont conservées avec leurs erreurs.
- Monter un sous-niveau peut changer le niveau courant d'édition. Les deux planètes ont été déplacées explicitement vers Map_Orbital après création ; Map_Narvos a ensuite été remis comme niveau courant. Ne pas dupliquer à nouveau les planètes.
- Les scripts `.hermes/astra_*` sont des interventions ciblées, plusieurs refusent les doublons. Lire leurs conditions avant reprise ; ne pas les lancer tous.
- Dernier contrôle : zéro map et zéro asset non sauvegardé. Aucun cook ou packaging lancé.
- Les sources sous asset_game sont préservées. Les sauvegardes binaires avant modifications sont dans `.hermes/sauvegardes/` ; pas de reset Git ni de nettoyage du grand diff préexistant.
- Tests du générateur : `node --check scripts/adk-mcs-fonctions.mjs` passé. Contrôle rendu : 14 réglages ADK/client concordants. Les anciennes 93 suites / 10647 assertions ne sont pas une nouvelle exécution de ce soir.