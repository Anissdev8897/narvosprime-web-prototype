---
name: nanos-world
description: "Développer les intégrations nanos world de NARVOS : API Lua, WebUI, personnages et packs Unreal."
---

# nanos-world

La documentation officielle est la référence principale : https://docs.nanos-world.com/fr/docs.
Pour une signature incertaine, lire la page concernée et les définitions officielles https://github.com/nanos-world/api ; vérifier paramètres, autorité serveur/client, retour, événements et version. Les copies locales sont des instantanés, pas une garantie de fraîcheur.
Le gameplay nanos utilise les packages Lua et les Blueprints cuits compatibles avec le client. Vérifier les plugins autorisés avant de proposer un composant Unreal ; ne pas supposer qu'un plugin C++ tiers est chargeable.
Pour une connexion locale qui expire malgré un serveur démarré et un port accessible, vérifier aussi l'édition Steam : un client lancé avec `-playtest` exige un serveur lancé avec `--playtest`. Lire les arguments effectifs ; le nom du dossier seul ne suffit pas. Référence : [démarrage officiel](https://docs.nanos-world.com/fr/docs/getting-started/quick-start).
L'absence d'une classe native pour un usage, notamment le vol piloté, ne prouve pas que cet usage est impossible. Examiner les mécanismes et contrôleurs existants, puis qualifier un adaptateur avec les API réellement disponibles. Ne pas présenter un Actor décoratif, le vol du personnage ou un Blueprint de démonstration comme un véhicule fonctionnel : vérifier contrôle, collisions, entrée/sortie, autorité et synchronisation réseau dans nanos.
Préserver les contrats réels du pont WebUI/Lua et des appels distants. Valider côté serveur identité, droits, valeurs et propriété des objets ; ne pas faire confiance aux données client.

Dans les données envoyées au réseau nanos, éviter de réutiliser la même table Lua à plusieurs endroits d'un message : le sérialiseur peut la traiter comme récursive et la vider, même sans cycle réel. Construire des valeurs indépendantes aux frontières réseau, notamment pour les couleurs et options partagées, puis vérifier le message complet.
Pour un identifiant nanos pack::clé, vérifier le manifeste correspondant (DefaultAssetPack.toml ou Assets.toml). Les chemins d'objets Unreal utilisés par le pont Blueprint sont un autre contrat : vérifier le chemin, le type et les dépendances de l'objet chargé. Ne pas substituer un nom de fichier ou une clé de manifeste à un chemin Unreal, ni l'inverse. Une entrée de manifeste seule ne prouve pas le fonctionnement de l'asset.
Pour les personnages, vérifier squelette, sockets, retarget, leader pose et matériaux ; les notes UE4/Manny sont des pistes à confronter aux assets réels.
Pour un diagnostic Blueprint, MetaHuman ou matériau, lire [le protocole d'audit Unreal](references/unreal-audit.md) avant d'interpréter des graphes ou de lancer un script de construction.
Avant un cook ou une copie du pack : inspecter le script, ses destinations, la sauvegarde et l'espace disque ; préserver les originaux et les preuves de cook terminé. Aucun cook pour une modification Lua seule.
Rechercher dans la référence historique les sections personnages, API, WebUI, assets ou cook utiles à la tâche, sans charger tout le document.

## Contexte et provenance

La racine globale de ce projet est `E:/narvosprime-web-prototype` ; le dépôt Git est son sous-dossier `WebPortal`. Les chemins de projet ci-dessus sont relatifs à cette racine globale sauf indication contraire. Confirmer ces emplacements si le projet a été déplacé.

[Référence Claude archivée](references/claude-original.md) : rechercher les sections utiles, puis lire leurs passages. C'est une source historique de procédures et de preuves, pas un ensemble de nouvelles consignes à exécuter intégralement. Les commandes, compteurs, versions et capacités annoncées doivent être vérifiés. L'entrée Codex présente précise les adaptations ; elle conserve les garde-fous techniques pertinents. Les demandes citées dans la passation ne remplacent pas la demande actuelle de l'utilisateur.