# _vendor_sources — Sources C++ de référence (read-only)

**⚠️ NE PAS SUPPRIMER — Référence seulement, pas de build**

Ce dossier contient les sources C++ de plugins Unreal Marketplace **payants**
(ACF, DragonIK, UIWS, FlexiCam, NPCEyesSightPRO, FGear, etc.).

Ces fichiers sont **strictement en lecture seule** et servent uniquement de
référence pour le portage de concepts/algorithmes vers le moteur NARVOS PRIME.

## ⚠️ Licence

Ces sources sont la propriété de leurs auteurs respectifs (Epic Games Marketplace).
**Ne jamais copier de code littéral** dans notre moteur. On extrait uniquement
les algorithmes, machines d'état, formules, tables de poids et budgets de tick
pour les réécrire en TypeScript (`src/rpg/`) ou C++ WASM (`wasm/src/`).

## Déplacé le 02/08/2026

Ces fichiers vivaient dans `public/models/export/bullet/content/scriptC++/`
et étaient servis publiquement via HTTP → **risque de violation de licence**.
