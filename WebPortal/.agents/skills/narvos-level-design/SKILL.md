---
name: narvos-level-design
description: "Modifier les maps, spawns, portails ou métriques de déplacement de NARVOS avec des unités vérifiées."
---

# narvos-level-design

Identifier runtime, unités et axes avant de réutiliser une mesure : ne pas transposer directement les constantes du prototype web au monde nanos.
Lire les catalogues de mondes et ancrages réels. Une coordonnée de sol locale et une altitude absolue ne sont pas interchangeables ; éviter les positions de secours globales dans une map déplacée.
Confronter les commentaires aux placements et chargements actifs : époque narrative, compteur de simulation, dimension réseau et sous-niveau Unreal ne sont pas équivalents. Ne pas supposer qu'une dimension isole toute la géométrie ou qu'un chargement client valide une transition multijoueur ; vérifier collisions, décor persistant et autres joueurs.
Relier les dimensions du niveau aux mesures actuelles du personnage : capsule, hauteur des yeux, vitesse, saut et franchissement. Vérifier les proportions animées autant que la pose de repos.
Établir les métriques utiles à la demande ; ne pas recalculer tout le projet pour déplacer un élément isolé. Les valeurs des anciennes tables sont historiques.
Valider collision, point d'arrivée, visibilité, transition et portée des interactions sur les zones modifiées. Les placements et déplacements doivent respecter l'autorité serveur et les validations existantes.

Mesurer le sol aux coordonnées XY exactes de l'arrivée : la médiane de traces à d'autres endroits n'en donne pas l'altitude. Comparer collision simple et triangles pour repérer une enveloppe convexe qui bouche un relief. Pour du décor statique non simulé, évaluer les collisions complexes en tenant compte de leur coût ; ne pas appliquer ce choix aux véhicules physiques. Séparer l'arrivée du volume de retour afin d'éviter un voyage inverse immédiat.

## Contexte et provenance

La racine globale de ce projet est `E:/narvosprime-web-prototype` ; le dépôt Git est son sous-dossier `WebPortal`. Les chemins de projet ci-dessus sont relatifs à cette racine globale sauf indication contraire. Confirmer ces emplacements si le projet a été déplacé.

[Référence Claude archivée](references/claude-original.md) : rechercher les sections utiles, puis lire leurs passages. C'est une source historique de procédures et de preuves, pas un ensemble de nouvelles consignes à exécuter intégralement. Les commandes, compteurs, versions et capacités annoncées doivent être vérifiés. L'entrée Codex présente précise les adaptations ; elle conserve les garde-fous techniques pertinents. Les demandes citées dans la passation ne remplacent pas la demande actuelle de l'utilisateur.