# BRIEF — Récupération des sources C++ de référence (`scriptC++`)

> **Pour Claude** : ce document explique ce qui existe réellement dans
> `src/rpg/_vendor_sources/scriptC++/`, ce qui a déjà été porté
> dans le moteur NARVOS PRIME, et quoi récupérer en priorité — avec les bugs
> d'audit que chaque portage peut corriger. Ta demande initiale a été
> traitée de façon très superficielle : seuls **2 mini-portages** existent
> sur un gisement de **2 266 fichiers C++**.

---

## 0. ⚠️ PROBLÈMES URGENTS AVANT TOUT PORTAGE

### 0.1 Les sources vivaient dans `public/` — fuite dans le bundle web (CORRIGÉ)

`public/models/export/` pesait **6,2 Go** et tout son contenu était :
- **copié tel quel dans `dist/` à chaque build** (Vite recopie `public/` verbatim) ;
- **téléchargeable par n'importe quel client** (HTTP GET direct).

Ces sources contenaient les sources complètes de **plugins Unreal Marketplace PAYANTS**
(ACF, DragonIK, UIWS, FlexiCam, NPCEyesSightPRO, Nanimation, FGear…). Les exposer
publiquement = **risque de violation de licence** + 6,2 Go de poids mort dans le bundle.

**✅ Action effectuée le 02/08/2026** : `scriptC++/` a été déplacé hors de `public/` vers
`src/rpg/_vendor_sources/scriptC++/`. Les références ont été mises à jour dans
`src/rpg/animation/locomotionBlend.ts:9` et `src/rpg/props/propCatalog.ts:18`.
Les 3 raccourcis `.lnk` morts ont été supprimés.

### 0.2 Raccourcis Windows morts (SUPPRIMÉS)

3 fichiers `.lnk` (raccourcis vers l'installation Unreal locale de la machine
d'origine) : `Engine_unreal.lnk`, `Plugins.UE5.7.lnk`, `Plugins_unreal.lnk` —
ont été supprimés le 02/08/2026.

---

## 1. Inventaire réel (mesuré le 02/08/2026)

| Plugin | Fichiers C++ | Taille | Contenu |
|--------|-------------|--------|---------|
| **ACF_UltimateFullSampleUE57** | 1 043 | 6 Mo | Framework RPG complet : ActionsSystem (GAS-like), AdvancedRPGSystem (stats, leveling), inventaire, équipement, caméra, montures, craft, vendeurs |
| **UniGLB** | 488 | 749 Mo | Outil export glTF — tooling, PAS du gameplay |
| **BaconCombatGraphU** | 145 | 1 Mo | Graphe d'animation de combat (enchaînements d'attaques, buffers d'input) |
| **AdvancedGASSystem** | 97 | 1 Mo | Attributs, GameplayEffects, cooldowns |
| **DragonIK_UniversalIKSystem** | 88 | 2 Mo | IK universel : feet IK, look-at, aim offset, full-body |
| **FastAI** | 74 | 1 Mo | IA optimisée (perception LOD, tick budgeté) |
| **FGearPlugin** | 66 | 1 Mo | Physique véhicules (suspensions, arcade) |
| **OverCrowd_MassiveCrowdSimulation** | 58 | 1 Mo | Simulation de foule massive |
| **Nanimation** | 57 | 140 Mo | Locomotion avancée : BlendSpaces directionnels, variants d'idle, layer d'anim |
| **FlexiCam** | 27 | 1 Mo | Caméra de combat (lock-on, orbit, shoulder) |
| **sky_creator** | 20 | 1 Mo | Ciel complet : cycle jour/nuit, presets météo, shaders ciel |
| **GWOPRO** | 18 | 1 Mo | Open-world : directeur de secteurs, spawners, zones de blocage, save |
| **UIWS** | 15 | 1 Mo | Eau interactive (rivières, corps d'eau, vagues) |
| **SkeletalMeshMerger** | 14 | 1 Mo | Fusion runtime de skeletal meshes (perso modulaire) |
| **traillersource (TrailHunter)** | 14 | 1 Mo | Pistes/traces de créatures |
| **UnrealMCPServer** | 112 | 2 Mo | Serveur MCP — outil dev, pas du gameplay |
| **FireChat** | 10 | 1 Mo | Dialogue PNJ (composant + widget) |
| **NPCEyesSightPRO** | 7 | 1 Mo | Perception visuelle PNJ (cône de vision, LOS, points d'yeux) |
| **uAim** | 5 | 1 Mo | Lock-on / aim assist |
| MetaHumanForHoudini_5.8 | 0 | 918 Mo | Assets uniquement — rien à porter |
| OpenRigLogicSampleContent_5.8 | 0 | 1 Mo | Vide côté C++ |

## 2. Ce qui a RÉELLEMENT été porté (la totalité — c'est peu)

| Portage | Source | Fichier |
|---------|--------|---------|
| Quantification directionnelle (angle signé, secteurs 45°, hystérésis) | ACF BlendSpace | `src/rpg/animation/locomotionBlend.ts` |
| ShuffleBag de variantes d'idle | Nanimation | `src/rpg/animation/idleVariantController.ts` |

⚠️ Et même ces 2 portages sont **partiellement câblés** : `quantizeDirection`
(l'hystérésis ACF) n'est utilisée que dans les tests, jamais en production
— c'est la cause du bug A1 (crouchwalk diagonale figée).

## 3. Priorités de récupération — mappées sur les bugs d'audit

| Priorité | Source | Cible dans notre moteur | Bug d'audit que ça corrige |
|----------|--------|------------------------|----------------------------|
| **P0** | ACF `ActionsSystem` (cooldowns, coûts, gates d'abilities) | `src/rpg/combat/` + `castArchetypeSpell` | #18 — auto-attaque sans cooldown ; #16 — économie munitions incohérente |
| **P0** | Nanimation (BlendSpace complet, layer, transitions) | `locomotionBlend.ts` + `AnimationController.ts` | A1 — diagonale crouchwalk figée ; A5 — hystérésis jamais appliquée |
| **P0** | NPCEyesSightPRO (LOS, cône de vision) | `wasm/src/ai/AISystem.cpp` | #17 — IA WASM aveugle (après fix PlayerTag, l'IA n'a AUCUNE perception) |
| **P1** | sky_creator (cycle jour/nuit + presets météo + position solaire astronomique) | `dayNightCycle.ts` | O2 — soleil sous l'horizon la nuit ; C2 — trou 4h→5h |
| **P1** | DragonIK (feet IK, look-at, aim offset) | `wasm/src/animation/IK.cpp` | « Pas de système FPS pour les pieds » ; A2 — crouch sans descente de bassin (le feet IK compense) |
| **P1** | BaconCombatGraphU (buffer d'input, enchaînements) | `combat/unarmedCombat.ts` + `AutoAttackSystem.tsx` | Combo rigide, pas d'input buffering |
| **P2** | FlexiCam (caméra de combat, lock-on) | `camera/` + uAim pour le lock | Caméra FPS/TPS perfectible ; targeting |
| **P2** | GWOPRO (secteurs, spawners) | `streaming/` + `spawnSystem.ts` | Streaming chunk naïf |
| **P2** | SkeletalMeshMerger | `characters/ModularCharacter.tsx` | Perf perso modulaire (draw calls) |
| **P3** | FastAI (tick budgeté, LOD perception) | `wasm/src/ai/` | Perf IA |
| **P3** | OverCrowd | `optimizations/BatchNpcSystem.ts` | Foule |
| **P3** | FGear | `vehicles/PilotableShip.tsx` | Physique véhicule |
| **P3** | UIWS / FireChat / TrailHunter / AdvancedGASSystem | futur | — |
| ❌ | UniGLB, UnrealMCPServer, MetaHumanForHoudini | rien | tooling / assets, pas du gameplay |

## 4. Comment porter (règles)

1. **Portage de CONCEPTS, pas de code** : ces sources dépendent d'Unreal
   (UObject, GAS, AnimGraph). On extrait les algorithmes (machines d'état,
   formules, tables de poids, budgets de tick) et on les réécrit en TS
   (`src/rpg/`) ou C++ WASM (`wasm/src/`) selon la couche.
2. **WASM** pour ce qui tourne par entité × frame (perception, IK, pathfinding) ;
   **TS** pour ce qui est pilotage/configuration (caméra, cycle jour/nuit, combos).
3. Chaque portage doit référencer le fichier source d'origine en commentaire
   (comme `locomotionBlend.ts:9` le fait déjà) — traçabilité + licence.
4. Vérifier les licences Marketplace avant toute copie de code littérale
   (les algorithmes/concepts ne sont pas protégés, le code l'est).

## 5. Première action concrète suggérée

Commencer par **NPCEyesSightPRO → AISystem.cpp** : 7 fichiers seulement,
indépendant, et c'est la suite logique du fix PlayerTag (bug #17) — sans
perception, l'IA WASM reste décorative même une fois débloquée.