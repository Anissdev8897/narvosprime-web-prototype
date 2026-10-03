---
name: narvos-lua
description: "Modifier ou diagnostiquer les modules Lua NARVOS, leur câblage, leur persistance et leur intégration WebUI."
---

# narvos-lua

Les packages sont dans WebPortal/Server/nanos_world/packages : narvos/Shared contient catalogues, logique et Index.lua ; narvos-map-proto contient les exécutants Server et Client/UI.
Avant d'ajouter un système, rechercher celui qui existe, ses appels et son câblage. Vérifier Shared/Index.lua, les exports Narvos et packages_requirements ; Package.Require est relatif au package courant.
Préserver la logique indépendante du moteur là où elle existe. Certaines couches, dont Comptes, possèdent déjà des adaptateurs Database : inspecter le code au lieu de présumer que tout Shared/Logic est pur.
Identifier le générateur et sa source avant de modifier un catalogue généré ; corriger la source puis régénérer le périmètre nécessaire. Tous les catalogues ne doivent pas être présumés générés sans inspection.
Garder une seule source d'état entre inventaire, apparence et création. Vérifier sauvegarde, rechargement, erreurs retournées et résultats de pcall ; 0 est vrai en Lua, les valeurs SQLite 0/1 exigent une conversion explicite.
Les gardes existants incluent syntaxe-check, portee-check, cablage-check, modules-orphelins-check, appels-distants-check, ui-liens et pcall-retour-perdu-check dans scripts/lua-harness (fichiers .mjs). Vérifier le nom sur disque avant exécution.
Un harnais qui charge directement un module ne prouve pas son câblage ni son usage en jeu. Suivre les quatre états : écrit, branché, testé, observé en jeu.
Retrouver la continuité récente via narvos-project-map. Avant de restaurer un ancien menu ou module, vérifier son remplacement et la demande actuelle ; conserver l'éditeur commun création/apparence tant qu'une évolution de ce contrat n'est pas demandée ou justifiée par un défaut démontré.

## Contexte et provenance

La racine globale de ce projet est `E:/narvosprime-web-prototype` ; le dépôt Git est son sous-dossier `WebPortal`. Les chemins de projet ci-dessus sont relatifs à cette racine globale sauf indication contraire. Confirmer ces emplacements si le projet a été déplacé.

[Référence Claude archivée](references/claude-original.md) : rechercher les sections utiles, puis lire leurs passages. C'est une source historique de procédures et de preuves, pas un ensemble de nouvelles consignes à exécuter intégralement. Les commandes, compteurs, versions et capacités annoncées doivent être vérifiés. L'entrée Codex présente précise les adaptations ; elle conserve les garde-fous techniques pertinents. Les demandes citées dans la passation ne remplacent pas la demande actuelle de l'utilisateur.