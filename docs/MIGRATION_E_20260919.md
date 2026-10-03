# Migration du projet vers E:\narvosprime-web-prototype

**Date :** 2026-09-19 · **Auteur :** Hermes
**État :** MIGRATION TERMINÉE + vérifiée par la batterie (111 harnais · 14 078 assertions · 0 rouge, exécutée depuis E:).

---

## 1. Ce qui a été fait

### 1.1 Remplacement des chemins

Toutes les références `D:\mes_projet\narvosprime-web-prototype` et
`D:/mes_projet/narvosprime-web-prototype` (les deux styles de slash) ont été
remplacées vers `E:\narvosprime-web-prototype` dans :

- les **109 harnais** de `scripts/lua-harness/` (les `const RACINE/LUA/SRC` en dur) ;
- `scripts/` (247 fichiers : ADK, cook, vérificateurs, générateurs) ;
- les **196 scripts de sessions** de `.hermes/` (cook lots, sondes ADK, notes de reprise) ;
- configs Unreal, `.ini`, `.ps1`, `.bat`, `.sh`, `.md`, `.ts`, `.py`, `.toml`, `.json`.

Total : **~700 fichiers texte migrés**, aucun binaire réécrit, fins de ligne
préservées (CRLF intact), rapport détaillé dans le script
`maintenance_scripts/migrer-chemins.py` (ré-exécutable).

### 1.2 Vérification des résidus

| zone | résultat |
|---|---|
| Sources actives (scripts, WebPortal, configs) | **0 référence** vers `D:\mes_projet\narvosprime-web-prototype` |
| `scripts/v3_setup/README_V3_SETUP.md` | 1 référence vers `D:/mes_projet/mlo_converter_local/...` — **laissée volontairement** : c'est un AUTRE projet (converter MLO), pas le projet migré |
| Archives (`archive/`, `.hermes/sauvegardes/`, `scratch/`, `logs/`) | non migrées (historique), non actives |

### 1.3 ADK

`WebPortal/Server/adk/NanosWorldADK.uproject` est bien présent sur E: (déplacé par
toi). Le fichier de préférences éditeur (`Saved/Config/.../EditorPerProjectUserSettings.ini`,
8 occurrences) a été migré — UE le régénérera de toute façon au premier lancement.

## 2. Le test ultime : la batterie depuis E:

Premier passage : **1 harnais rouge** (`reputation.mjs`). Cause : le harnais
exécutait esbuild sur un **artefact orphelin** de `%TEMP%`
(`_rep_entry.ts`, daté du 8 sept) dont les imports pointaient encore `D:/...`.
Ce n'était PAS un chemin du projet : c'était un fichier temporaire que le harnais
supposait présent au lieu de le créer.

**Corrigé dans le harnais lui-même** : `reputation.mjs` écrit désormais son
entrée esbuild à chaque exécution (auto-suffisant) — plus jamais ce piège,
même après une prochaine relocalisation.

**Résultat final : 111 harnais · 14 078 assertions · 0 rouge, exécuté depuis E:.**

## 3. Points d'attention restants

1. **`D:\mes_projet\narvosprime-web-prototype` existe ENCORE** (ancienne copie).
   L'ADK en a été retiré par toi. Tant que D: reste, aucun fichier du projet
   actif n'y pointe plus — tu peux le supprimer quand tu veux.
2. **`mlo_converter_local`** : toujours référencé depuis `scripts/v3_setup` — si
   ce projet bouge aussi, préviens-moi.
3. **Astuce pour le futur** : `python maintenance_scripts/migrer-chemins.py`
   refait la migration (idempotent) si un fichier y échappe un jour.