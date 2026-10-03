---
name: narvos-iteration-guard
description: "Choisir et exécuter les contrôles de non-régression après une modification NARVOS."
---

# narvos-iteration-guard

Partir d'un état de référence et examiner le diff sans écraser le travail existant. Identifier les imports, exports, appelants et données persistées affectés.
Pour un changement Lua, conserver les gardes syntaxe, portée et câblage ; ajouter appels distants, liens UI, identité des catalogues ou persistance selon les frontières touchées. Utiliser les harnais métier concernés.
Pour le web, lancer le contrôle TypeScript et les tests pertinents. Pour WASM, vérifier les bindings C++/TS et la compilation concernée. Distinguer les erreurs nouvelles de celles observées avant la modification, sans les masquer.
Pour une intégration transversale du code ou une demande de nouvelle validation globale nanos, exécuter node scripts/lua-harness/tout.mjs depuis la racine globale. Ne pas recopier les anciens nombres de suites comme critères attendus.
Pour des changements limités aux Skills ou documents, vérifier format, liens, cohérence des consignes et conservation des archives ; ne pas lancer une batterie de gameplay ou un cook sans modification concernée. Un audit en lecture seule peut citer une preuve antérieure avec sa date et ses limites, sans prétendre avoir relancé les tests.
Après succès, ne répéter ou élargir les tests que si une nouvelle modification, une erreur ou une incertitude le justifie. Les tests ignorés, suites non chargées, échecs déclarés et codes de sortie doivent être visibles.
Les modifications de rendu, animations, caméra et physique demandent une validation dans le client réel ; un serveur démarré sans erreur ne les valide pas.

## Contexte et provenance

La racine globale de ce projet est `E:/narvosprime-web-prototype` ; le dépôt Git est son sous-dossier `WebPortal`. Les chemins de projet ci-dessus sont relatifs à cette racine globale sauf indication contraire. Confirmer ces emplacements si le projet a été déplacé.

[Référence Claude archivée](references/claude-original.md) : rechercher les sections utiles, puis lire leurs passages. C'est une source historique de procédures et de preuves, pas un ensemble de nouvelles consignes à exécuter intégralement. Les commandes, compteurs, versions et capacités annoncées doivent être vérifiés. L'entrée Codex présente précise les adaptations ; elle conserve les garde-fous techniques pertinents. Les demandes citées dans la passation ne remplacent pas la demande actuelle de l'utilisateur.