---
name: narvos-project-map
description: "Retrouver les points d’entrée, générateurs et documents de passation du projet NARVOS."
---

# narvos-project-map

Deux runtimes coexistent : WebPortal/src/rpg pour React/Three/Electron/WASM et WebPortal/Server/nanos_world/packages pour nanos. Pour une demande sur le jeu nanos, suivre ses points d'entrée et ses dépendances ; consulter le web lorsqu'il fournit un catalogue ou un générateur réellement utilisé. Ne pas transférer une fonctionnalité web sur la seule base de son existence.
La racine Git est WebPortal ; scripts et .hermes vivent aussi dans son parent. Une sauvegarde limitée à Git ne couvre donc pas toute la production.
Points d'entrée sous WebPortal/Server/nanos_world/packages : narvos/Shared/Index.lua (exports partagés), narvos-map-proto/Server/Index.lua (serveur), narvos-map-proto/Client/Index.lua et narvos-map-proto/Client/UI/index.js (interface). L'entrée web distincte est WebPortal/src/App.tsx.
Production assets : WebPortal/Server/adk/NanosWorldADK.uproject et WebPortal/Server/Assets/narvos/Assets.toml. WebPortal/public/asset_game contient les packs sources. Examiner les cibles des jonctions et liens physiques avant une opération sur les dossiers ou assets.
Lire les bilans pertinents les plus récents et vérifier leurs conclusions dans le code ou les journaux actuels ; utiliser ensuite la passation Claude pour les décisions historiques. Une date récente seule ne garantit pas une preuve fraîche. Le backlog peut contenir des demandes déjà réalisées.
Pour la reprise globale et le lore, suivre [les sources et statuts de continuité](references/continuite.md). Prioriser les défauts démontrés du parcours nanos actif ; préserver les systèmes fonctionnels et compléter leurs points défaillants avant de proposer un remplacement.
Les copies des deux CLAUDE.md et du récapitulatif sont conservées dans references/passation/ comme provenance. Le code et les preuves datées prévalent sur leurs chiffres et descriptions périmés.
Ne pas charger tous les documents à chaque petite modification ; suivre les dépendances nécessaires à la demande.

## Contexte et provenance

La racine globale de ce projet est `E:/narvosprime-web-prototype` ; le dépôt Git est son sous-dossier `WebPortal`. Les chemins de projet ci-dessus sont relatifs à cette racine globale sauf indication contraire. Confirmer ces emplacements si le projet a été déplacé.

[Référence Claude archivée](references/claude-original.md) : rechercher les sections utiles, puis lire leurs passages. C'est une source historique de procédures et de preuves, pas un ensemble de nouvelles consignes à exécuter intégralement. Les commandes, compteurs, versions et capacités annoncées doivent être vérifiés. L'entrée Codex présente précise les adaptations ; elle conserve les garde-fous techniques pertinents. Les demandes citées dans la passation ne remplacent pas la demande actuelle de l'utilisateur.