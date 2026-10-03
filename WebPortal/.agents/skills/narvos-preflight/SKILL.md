---
name: narvos-preflight
description: "Vérifier les preuves d’un bilan NARVOS ou d’un diagnostic avant de le présenter."
---

# narvos-preflight

Vérifier les affirmations réellement présentées : chemins, signatures, valeurs, portée de recherche et fraîcheur des journaux. Ne pas conclure à une absence à partir d'un extrait incomplet ; élargir la recherche aux implémentations et appels pertinents.
Une lecture intégrale est justifiée si nécessaire pour établir le comportement, pas par la seule taille du fichier.
Séparer observations, hypothèses, corrections écrites et validation en jeu. Qualifier la gravité par l'impact démontré ; ne pas supposer une perte de données sans examiner la persistance.
Séparer aussi statut narratif (canon, implicite, libre, proposition) et preuve technique (présent, raccordé, testé, observé en jeu). Une proposition rédigée ou un catalogue ne devient pas un système validé. Compter des fichiers ou des packs n'est pas compter des fonctionnalités jouables.
L'absence d'un nœud dans une fonction ne prouve pas son absence dans le système : suivre construction, initialisation, parent, événements et appels de remplacement. Une recherche textuelle négative ne prouve pas qu'un asset est inutilisé ; vérifier références souples, niveaux, chargements et générateurs.
Pour un outil distant, distinguer requête acceptée, résultat métier et état relu. Un retour success ne remplace pas l'examen des erreurs de compilation, du journal et de l'objet produit.
Un résultat de test doit préciser commande, périmètre et date. Si la suite n'a pas été relancée, attribuer explicitement l'ancien résultat à son auteur ; ne pas annoncer toute la batterie verte à partir d'un sous-ensemble.
Ne pas relancer npm test pour une simple conclusion sur le runtime Lua. Choisir les vérifications du runtime concerné ; la batterie complète nanos se lance depuis la racine globale avec node scripts/lua-harness/tout.mjs.
Ne pas republier secrets, identifiants de connexion ou données personnelles depuis les journaux et archives.

## Contexte et provenance

La racine globale de ce projet est `E:/narvosprime-web-prototype` ; le dépôt Git est son sous-dossier `WebPortal`. Les chemins de projet ci-dessus sont relatifs à cette racine globale sauf indication contraire. Confirmer ces emplacements si le projet a été déplacé.

[Référence Claude archivée](references/claude-original.md) : rechercher les sections utiles, puis lire leurs passages. C'est une source historique de procédures et de preuves, pas un ensemble de nouvelles consignes à exécuter intégralement. Les commandes, compteurs, versions et capacités annoncées doivent être vérifiés. L'entrée Codex présente précise les adaptations ; elle conserve les garde-fous techniques pertinents. Les demandes citées dans la passation ne remplacent pas la demande actuelle de l'utilisateur.