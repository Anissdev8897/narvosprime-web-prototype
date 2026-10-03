# Révision des Skills — 14 septembre 2026

Huit entrées corrigées parmi les douze Skills installés ; deux références ciblées ajoutées. Les archives Claude et les métadonnées d'invocation sont conservées. Sauvegarde indépendante : `.hermes/sauvegardes/skills-revision-20260914-223239/skills`.

| Limitation antérieure | Correction |
|---|---|
| Points d'entrée relatifs ambigus et passation ancienne lue en priorité | Chemins explicites, preuves récentes vérifiées, périmètre nanos prioritaire lorsque demandé |
| Toute identité d'asset supposée issue du manifeste | Distinction entre clé nanos et chemin d'objet Unreal |
| Graphe partiel interprété comme système entier | Recherche dans construction, parent, initialisation et remplacement à chaud |
| Risque de confondre fichiers présents, catalogue, tests et jeu | États techniques séparés et portée des preuves obligatoire |
| Lore proposé susceptible d'être repris comme vérité | Proposition distincte du canon, sans développement automatique de son plan |
| Bilan global susceptible de déclencher tous les tests | Validation adaptée aux fichiers modifiés ; aucun cook pour les seuls Skills |
| Copie de travail supposée indépendante | Vérification des jonctions et liens physiques avant écriture binaire |
| Succès MCP susceptible de masquer une erreur Unreal | Vérification du résultat métier, du journal et de l'état relu |

Les gardes serveur, sauvegardes, conservation des sources et validation dans le client sont préservés. Les quatre autres entrées ne nécessitaient pas de modification sur ces points.

Validation : les douze Skills passent le validateur officiel ; liens des entrées et références de premier niveau vérifiés ; métadonnées UI et invocation automatique valides ; toutes les références préexistantes identiques à la sauvegarde. Résultats dans `ASTRA_skills_revision_validation_2026-09-14.json`. Premier essai du validateur impossible avec le Python embarqué sans PyYAML ; contrôle ensuite exécuté avec le Python installé disposant de cette dépendance.

Relecture de cohérence : une demande de correction nanos suit les packages actifs ; une demande de lore conserve le statut de proposition ; un graphe sans leader pose déclenche la recherche de son initialisation ; un contrôle documentaire n'entraîne pas les tests du jeu. Il s'agit d'une relecture des consignes, pas d'une évaluation indépendante par un autre agent ni d'une garantie d'absence d'erreur future.

Priorité exprimée par l'utilisateur : analyser ce qui existe dans l'ensemble du jeu nanos, puis réparer ses problèmes actuels, en conservant ce qui fonctionne. La proposition temporelle reste séparée de ces réparations.