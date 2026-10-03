# 🔭 CATALOGUE VEILLE TECHNOLOGIQUE — Narvos Prime

**Date :** 29 juillet 2026
**Équipe :** Veille Technologique (10-20 agents)
**Stack cible :** Three.js + React Three Fiber (Web) / C++20 + Vulkan (Nativ) / Blender → GLB → Three.js / Vite + TypeScript / Electron
**Contexte :** Projet Narvos Prime — MMORPG low-poly cartoon (style Dofus-like)

---

## SOMMAIRE

1. [Assets 3D gratuits Low-Poly Cartoon](#1-assets-3d-gratuits-low-poly-cartoon)
2. [Shaders WebGL / Vulkan réutilisables](#2-shaders-webgl--vulkan-réutilisables)
3. [Outils d'optimisation GLB](#3-outils-doptimisation-glb)
4. [Systèmes d'animation alternatifs](#4-systèmes-danimation-alternatifs)
5. [Bibliothèques de pathfinding](#5-bibliothèques-de-pathfinding)
6. [Outils de sound design procéduraux](#6-outils-de-sound-design-procéduraux)
7. [Modèles IA légers pour navigateur](#7-modèles-ia-légers-pour-navigateur)
8. [Outils de profiling WebGL](#8-outils-de-profiling-webgl)
9. [Synthèse et recommandations](#9-synthèse-et-recommandations)

---

## 1. ASSETS 3D GRATUITS LOW-POLY CARTOON

### 1.1 Quaternius — Low Poly Pack (CC0)

| Champ | Valeur |
|-------|--------|
| **URL** | https://quaternius.com / https://poly.pizza |
| **Licence** | CC0 (domaine public) |
| **Description** | Centaines de modèles low-poly : personnages humanoïdes, animaux, bâtiments, arbres, armes, mobilier. Style cartoon proche Dofus. Format GLB natif. |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — style parfait, licence libre, GLB natif, animations incluses |
| **Effort d'intégration** | Faible — téléchargement direct, import Three.js standard via `GLTFLoader` |
| **Recommandation** | **Adopter immédiatement** — base d'assets pour prototypage rapide |

### 1.2 Kenney.nl — Game Assets Pack

| Champ | Valeur |
|-------|--------|
| **URL** | https://kenney.nl/assets |
| **Licence** | CC0 (domaine public) |
| **Description** | Pack géant (>2000 assets) low-poly coloré : personnages, UI, icônes, véhicules, bâtiments, décors. Format FBX/OBJ/GLTF. |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — complet, style cartoon, compatible pipeline GLB |
| **Effort d'intégration** | Faible — conversion FBX→GLB via Blender automatisable |
| **Recommandation** | **Adopter** — particulièrement les packs UI et icônes pour le HUD |

### 1.3 poly.pizza — Base de données CC0

| Champ | Valeur |
|-------|--------|
| **URL** | https://poly.pizza |
| **Licence** | CC0 / Attribution |
| **Description** | Moteur de recherche d'assets 3D libres. Filtre par licence CC0, inclut Quaternius + contributeurs. Téléchargement GLB direct. |
| **Pertinence Narvos** | ⭐⭐⭐⭐ **Élevée** — agrégateur, pas un fournisseur direct |
| **Effort d'intégration** | Faible — search + download GLB |
| **Recommandation** | **Utiliser comme source d'approvisionnement** secondaire |

### 1.4 OpenGameArt.org — Section 3D

| Champ | Valeur |
|-------|--------|
| **URL** | https://opengameart.org/art-search-advanced?keys=&field_art_type_tid%5B%5D=12 |
| **Licence** | CC0 / CC-BY / GPL |
| **Description** | Grande communauté d'artistes, section 3D avec filtres licence. Qualité variable mais pépites possibles. Formats divers (BLEND, OBJ, FBX). |
| **Pertinence Narvos** | ⭐⭐⭐ **Moyenne** — qualité inégale, vérification licence nécessaire |
| **Effort d'intégration** | Moyen — conversion Blender→GLB, nettoyage fréquent |
| **Recommandation** | **Source complémentaire** — utile pour assets rares (créatures, structures) |

### 1.5 Sketchfab — Section Free Download

| Champ | Valeur |
|-------|--------|
| **URL** | https://sketchfab.com/search?type=models&downloadable=true |
| **Licence** | CC0 / CC-BY |
| **Description** | Grande bibliothèque d'assets 3D, filtre "Downloadable" pour modèles gratuits. Nombreux modèles low-poly. Export GLB natif. |
| **Pertinence Narvos** | ⭐⭐⭐ **Moyenne** — majorité payante, vérification licence par modèle |
| **Effort d'intégration** | Faible — GLB natif si disponible |
| **Recommandation** | **Source occasionnelle** — chercher des modèles spécifiques manquants ailleurs |

### 1.6 Jeux BDD (Blender Direct Download)

| Champ | Valeur |
|-------|--------|
| **URL** | https://blendermarket.com/ + assets gratuits sur Gumroad |
| **Licence** | CC0 / Royalty-free |
| **Description** | Artistes Blender proposant des packs low-poly gratuits (ex: KayKit, SyntyStudios-like). |
| **Pertinence Narvos** | ⭐⭐⭐ **Moyenne** — peu de contenu vraiment gratuit |
| **Effort d'intégration** | Moyen — format BLEND → export GLB |

---

## 2. SHADERS WEBGL / VULKAN RÉUTILISABLES

### 2.1 Three.js EffectComposer & Post-Processing (natifs)

| Champ | Valeur |
|-------|--------|
| **URL** | https://threejs.org/docs/#manual/en/introduction/How-to-use-post-processing |
| **Licence** | MIT (Three.js) |
| **Description** | Effets inclus natifs : UnrealBloomPass (bloom), SSAOPass (ambient occlusion), SSRPass (screen-space reflections), OutlinePass, FXAAPass, SMAAPass, GlitchPass, AfterimagePass, HalftonePass, LUTPass, BokehPass (DOF), FilmPass, DotScreenPass. |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — zéro dépendance externe, passe-partout pour l'ambiance cartoon |
| **Effort d'intégration** | Faible — déjà inclus dans le bundle Three.js |
| **Recommandation** | **Adopter immédiatement** — OutlinePass pour highlight objets interactifs, UnrealBloomPass pour effets magiques |

### 2.2 drei (React Three Fiber) — Post-Processing

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/pmndrs/drei |
| **Licence** | MIT |
| **Description** | Bibliothèque R3F avec composants prêts à l'emploi : `<Effects>`, `<Bloom>`, `<DepthOfField>`, `<SSAO>`, `<Vignette>`, `<Glitch>`, `<Noise>`, `<Select>` (outline sélectif). |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — stack identique (R3F), composants React natifs |
| **Effort d'intégration** | Très faible — `npm i @react-three/postprocessing` + composants JSX |
| **Recommandation** | **Adopter immédiatement** — c'est le standard R3F pour post-processing |

### 2.3 ShaderToy → Three.js (shaders personnalisés)

| Champ | Valeur |
|-------|--------|
| **URL** | https://www.shadertoy.com |
| **Licence** | CC BY-NC-SA (adaptation possible) |
| **Description** | Milliers de shaders GLSL pour eau, feu, particules, ciel, nuages, terrain, distortion. Portables vers Three.js `ShaderMaterial` ou `RawShaderMaterial`. |
| **Pertinence Narvos** | ⭐⭐⭐⭐ **Élevée** — source d'inspiration et base pour shaders custom |
| **Effort d'intégration** | Moyen — adaptation GLSL → Three.js uniforms, certains shaders complexes |
| **Recommandation** | **Utiliser pour** : eau stylisée (lac, rivière), feu magique, auras, transitions |

### 2.4 Three.js Water / Ocean Shaders

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/mrdoob/three.js/tree/dev/examples/jsm/objects/Water.js |
| **Licence** | MIT |
| **Description** | Shader d'eau inclus dans Three.js avec réflexions/translucidité. Version avancée : Water2 (reflect+refract). Paramétrable (couleur, distortion, normales). |
| **Pertinence Narvos** | ⭐⭐⭐⭐ **Élevée** — eau cartoon adaptable |
| **Effort d'intégration** | Faible — importer `Water` depuis les exemples |
| **Recommandation** | **Adopter** — pour lacs, rivières, zones d'eau dans le monde |

### 2.5 Three.js ToonMaterial & Custom Toon Shader

| Champ | Valeur |
|-------|--------|
| **URL** | https://threejs.org/docs/#api/en/materials/MeshToonMaterial |
| **Licence** | MIT |
| **Description** | `MeshToonMaterial` natif avec ramp texture pour ombrage cartoon. Extensible via `onBeforeCompile` pour effets cel-shading, outline ink, hatching. |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — cœur du rendu cartoon Dofus-like |
| **Effort d'intégration** | Faible — `new THREE.MeshToonMaterial({ map, gradientMap })` |
| **Recommandation** | **Adopter immédiatement** — matériau de base pour tous les personnages et décors |

### 2.6 pmndrs/postprocessing (bibliothèque standalone)

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/pmndrs/postprocessing |
| **Licence** | MIT |
| **Description** | Bibliothèque post-processing indépendante de Three.js, compatible R3F. Effets : bloom, depth of field, motion blur, SMAA, SSR, God rays, tonemapping LUT. |
| **Pertinence Narvos** | ⭐⭐⭐⭐ **Élevée** — plus d'effets que le natif Three.js |
| **Effort d'intégration** | Faible — `npm i postprocessing` + wrapper R3F |
| **Recommandation** | **Adopter** — meilleure qualité que les passes natifs Three.js |

### 2.7 Shaders Vulkan (pour Narvos Engine natif)

| Champ | Valeur |
|-------|--------|
| **Nom** | GLSL → SPIR-V toolchain |
| **Licence** | Diverse |
| **Description** | Les shaders Three.js/WebGL (GLSL ES) peuvent servir de référence pour les shaders Vulkan (GLSL → SPIR-V via `glslangValidator` ou `shaderc`). |
| **Pertinence Narvos** | ⭐⭐⭐⭐ **Élevée** — nécessaire pour le moteur natif C++/Vulkan |
| **Effort d'intégration** | Élevé — réécriture des shaders dans le pipeline Vulkan |
| **Recommandation** | **Planifier** — shaders communs (eau, toon, ombres) à porter en priorité |

### 2.8 The Forge — Cross-Platform Rendering (Vulkan)

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/ConfettiFX/The-Forge |
| **Licence** | Apache 2.0 |
| **Description** | Framework de rendu cross-platform avec des exemples de shaders Vulkan avancés : ombres, eau, post-processing, occlusion culling, GI. |
| **Pertinence Narvos** | ⭐⭐⭐ **Moyenne** — utile comme référence pour le moteur natif Vulkan |
| **Effort d'intégration** | Élevé — framework complexe à intégrer |
| **Recommandation** | **Inspiration / référence** — ne pas intégrer directement, mais s'en inspirer |

---

## 3. OUTILS D'OPTIMISATION GLB

### 3.1 glTF-Transform (meshoptimizer)

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/donmccurdy/glTF-Transform |
| **Licence** | MIT |
| **Description** | SDK JavaScript pour pipeline glTF. Fonctions : meshoptimizer compression, Draco compression, KTX2 textures, quantisation, dédoublonnage, LOD, instancing, draco→meshopt transcodage. |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — outil central pour tout le pipeline GLB |
| **Effort d'intégration** | Faible — script Node.js, ligne de commande ou API |
| **Recommandation** | **Adopter immédiatement** — indispensable pour le pipeline Blender→GLB |

### 3.2 Draco 3D Compression (Google)

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/google/draco |
| **Licence** | Apache 2.0 |
| **Description** | Compression de maillages 3D par Google. Support Three.js natif via `DRACOLoader`. Réduction taille 10-15x. |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — déjà utilisé dans le projet (visible dans loaders/) |
| **Effort d'intégration** | Faible — déjà intégré, configurer `DRACOLoader` decoder path |
| **Recommandation** | **Déjà adopté** — optimiser la configuration (chemin du décodeur WASM) |

### 3.3 KTX2 / Basis Universal

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/KhronosGroup/KTX-Software |
| **Licence** | Apache 2.0 |
| **Description** | Compression de textures GPU via Basis Universal. Support Three.js via `KTX2Loader`. Réduction VRAM 3-5x. Transcodage GPU natif (BC7, ETC2, ASTC). |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — critique pour performances WebGL/Vulkan |
| **Effort d'intégration** | Moyen — conversion Blender→KTX2 en post-process, config `KTX2Loader` |
| **Recommandation** | **Adopter immédiatement** — pipeline KTX2 obligatoire pour textures production |

### 3.4 glTF-WebGL-Pipeline (Microsoft)

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/microsoft/glTF-WebGL-Pipeline |
| **Licence** | MIT |
| **Description** | Outils de conversion glTF : compression Draco, conversion textures (PNG→KTX2, PNG→WebP), optimisation maillage. |
| **Pertinence Narvos** | ⭐⭐⭐ **Moyenne** — partiellement redondant avec glTF-Transform |
| **Effort d'intégration** | Faible — outil CLI Node.js |
| **Recommandation** | **Optionnel** — utiliser glTF-Transform qui couvre plus de cas |

### 3.5 Blender glTF 2.0 Exporter (officiel)

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/KhronosGroup/glTF-Blender-IO |
| **Licence** | Apache 2.0 |
| **Description** | Exportateur glTF officiel pour Blender 4.x. Support : armatures, animations, morph targets, Draco, KTX2 (via extension). Version intégrée à Blender 4.x. |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — outil principal de la pipeline Blender→GLB |
| **Effort d'intégration** | Déjà intégré — configurer les paramètres d'export (Draco, KTX2) |
| **Recommandation** | **Documenter les paramètres d'export optimaux** pour l'équipe artiste |

### 3.6 gltf-transform CLI Commands

| Champ | Valeur |
|-------|--------|
| **Commande** | `npx gltf-transform optimize input.glb output.glb` ou `meshopt`, `draco`, `ktx2`, `dedup`, `quantize`, `flatten` |
| **Licence** | MIT |
| **Description** | Pipeline CLI complète : `gltf-transform optimize` applique meshopt+dedup+quantize en une commande. Scriptable dans le build process. |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — intégration dans le pipeline Vite/Build |
| **Effort d'intégration** | Faible — npm script dans package.json |
| **Recommandation** | **Adopter immédiatement** — ajouter au pipeline de build |

---

## 4. SYSTÈMES D'ANIMATION ALTERNATIFS

### 4.1 Rive

| Champ | Valeur |
|-------|--------|
| **URL** | https://rive.app |
| **Licence** | Gratuit (rive-app.com) / licence runtime MIT |
| **Description** | Éditeur d'animations vectorielles temps réel. Export en .riv avec runtime WebGL. State machine intégrée (idle→walk→run→attack). Poids < 100KB. Animations fluides UI et 2D. |
| **Pertinence Narvos** | ⭐⭐⭐⭐ **Élevée** — pour UI animée, transitions de menus, icônes, avatars 2D. Pas pour animations 3D. |
| **Effort d'intégration** | Moyen — nouvel outil d'édition + runtime additionnel |
| **Recommandation** | **Adopter pour UI/2D uniquement** — HUD animé, écrans de chargement, menus |

### 4.2 Lottie (LottieFiles + lottie-web)

| Champ | Valeur |
|-------|--------|
| **URL** | https://lottiefiles.com |
| **Licence** | MIT (runtime) / Gratuit |
| **Description** | Animations vectorielles exportées d'After Effects (format JSON). Runtime WebGL/canvas. Poids très faible. Bibliothèque immense d'animations gratuites. |
| **Pertinence Narvos** | ⭐⭐⭐ **Moyenne** — animations UI 2D uniquement, pas 3D |
| **Effort d'intégration** | Faible — `npm i lottie-web` + player React |
| **Recommandation** | **Adopter si besoin UI** — chargement, transitions, notifications |

### 4.3 GSAP (GreenSock Animation Platform)

| Champ | Valeur |
|-------|--------|
| **URL** | https://gsap.com |
| **Licence** | Standard (gratuit pour usage non commercial) / Club GreenSock payant |
| **Description** | Bibliothèque d'animations JavaScript ultra-performante. Timeline, easing custom, stagger, scrub. Idéal pour UI et animations de caméra/mouvement dans Three.js. |
| **Pertinence Narvos** | ⭐⭐⭐⭐ **Élevée** — animations de scène, transitions de vue, UI complexes |
| **Effort d'intégration** | Faible — `npm i gsap` + animations déclaratives |
| **Recommandation** | **Adopter** — complémentaire à Three.js AnimationMixer pour transitions UI et caméra |

### 4.4 Anime.js

| Champ | Valeur |
|-------|--------|
| **URL** | https://animejs.com |
| **Licence** | MIT |
| **Description** | Bibliothèque légère d'animations JS. APIs fluides pour DOM, CSS, SVG, JS objects. Chaînage, timelines, physiques springs. |
| **Pertinence Narvos** | ⭐⭐ **Faible** — redondant avec GSAP pour l'essentiel |
| **Effort d'intégration** | Faible |
| **Recommandation** | **Ne pas adopter** — GSAP est plus complet pour nos besoins |

### 4.5 Motion Canvas

| Champ | Valeur |
|-------|--------|
| **URL** | https://motioncanvas.io |
| **Licence** | MIT |
| **Description** | Éditeur d'animations programmatique (code-first). Animations 2D vectorielles via API TypeScript. Cible : vidéos explicatives, tutoriels. |
| **Pertinence Narvos** | ⭐ **Faible** — orienté production vidéo, pas jeu |
| **Effort d'intégration** | Élevé |
| **Recommandation** | **Ne pas adopter** — hors scope jeu |

### 4.6 Three.js AnimationMixer (existant)

| Champ | Valeur |
|-------|--------|
| **URL** | https://threejs.org/docs/#api/en/animation/AnimationMixer |
| **Licence** | MIT |
| **Description** | Système d'animation natif Three.js : crossfade, blending, additive blending, morph targets, skinning. Utilisé actuellement via AnimationController. |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — déjà en place, à améliorer |
| **Effort d'intégration** | Déjà intégré — optimiser les transitions, ajouter retargeting avancé |
| **Recommandation** | **Renforcer** — priorité à l'existant avant d'ajouter des systèmes externes |

---

## 5. BIBLIOTHÈQUES DE PATHFINDING

### 5.1 pathfinding.js (maintenu)

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/qiao/PathFinding.js |
| **Licence** | MIT |
| **Description** | Bibliothèque JavaScript de pathfinding 2D grid-based. Algorithmes : A*, Dijkstra, Best-First, Jump Point Search, Trace. |
| **Pertinence Narvos** | ⭐⭐⭐ **Moyenne** — 2D grid uniquement, pas 3D navmesh |
| **Effort d'intégration** | Faible — pur JS sans dépendances |
| **Recommandation** | **Adopter si pathfinding 2D** — pour minimap, écran de carte du monde |

### 5.2 ngraph.path

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/anvaka/ngraph.path |
| **Licence** | MIT |
| **Description** | Bibliothèque de pathfinding graph-based (pas grid). A* avec heuristiques custom. Support nœuds/poids. Idéal pour navigation sur graphe de map. |
| **Pertinence Narvos** | ⭐⭐⭐ **Moyenne** — pathfinding basé graphe, pas navmesh 3D |
| **Effort d'intégration** | Moyen — conversion map → graphe |
| **Recommandation** | **Optionnel** — si système de navigation en graphe utilisé |

### 5.3 three-pathfinding (navmesh + Three.js)

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/donmccurdy/three-pathfinding |
| **Licence** | MIT |
| **Description** | Intégration navmesh pour Three.js. Utilise les algorithmes A* sur navigation mesh 3D. Génération navmesh via Blender ou RecastJS. Compatible R3F. |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — navmesh 3D natif pour Three.js |
| **Effort d'intégration** | Moyen — génération navmesh + intégration au système NPC |
| **Recommandation** | **Adopter immédiatement** — remplacer le pathfinding actuel (WASM?) par celui-ci |

### 5.4 RecastJS / Recast4J (Détour navigation)

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/benwinding/recastjs / https://github.com/memononen/recastnavigation |
| **Licence** | Zlib |
| **Description** | Port JavaScript de Recast/Detour (Mikko Mononen). Génération navmesh + pathfinding 3D complet (A*, funnel, crowd simulation). |
| **Pertinence Narvos** | ⭐⭐⭐⭐ **Élevée** — standard de l'industrie, port JS fonctionnel |
| **Effort d'intégration** | Élevé — compilation WASM, intégration complexe |
| **Recommandation** | **Planifier** — pour le moteur natif C++/Vulkan, version originale C++ directement |

### 5.5 Yuka

| Champ | Valeur |
|-------|--------|
| **URL** | https://mugen87.github.io/yuka/ |
| **Licence** | MIT |
| **Description** | Moteur d'IA complet pour jeux 3D JavaScript : pathfinding (navmesh A*), steering behaviors, perception, state machine, décision. Compatible Three.js. |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — IA + pathfinding intégré, Three.js natif |
| **Effort d'intégration** | Moyen — remplacer/supplémenter le système NPC actuel |
| **Recommandation** | **Adopter immédiatement** — excellent pour NPC, ennemis, IA de foule |

### 5.6 Simple Pathfinding (Three.js + R3F wrapper)

| Champ | Valeur |
|-------|--------|
| **URL** | Nom générique — pattern combinant `three-pathfinding` + R3F |
| **Licence** | MIT |
| **Description** | Combinaison de `@react-three/rapier` (physique) + `three-pathfinding` (navigation) pour pathfinding 3D dans R3F. |
| **Pertinence Narvos** | ⭐⭐⭐⭐ **Élevée** — architecture R3F native |
| **Effort d'intégration** | Moyen — wrapper React à créer |
| **Recommandation** | **Adopter** — pattern recommandé pour NPC dans l'environnement R3F |

---

## 6. OUTILS DE SOUND DESIGN PROCÉDURAUX

### 6.1 jsfxr (JS port of sfxr)

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/mneubrand/jsfxr |
| **Licence** | MIT |
| **Description** | Générateur d'effets sonores procéduraux 8-bit (laser, explosion, saut, pièce, power-up). Synthèse temps réel via Web Audio API. Poids < 10KB. |
| **Pertinence Narvos** | ⭐⭐⭐ **Moyenne** — style 8-bit, pas cohérent avec le rendu cartoon moderne |
| **Effort d'intégration** | Faible — `npm i jsfxr` + génération programmatique |
| **Recommandation** | **Utiliser pour** — UI sounds, notifications, feedback d'interface pur |

### 6.2 sfxr / bfxr (desktop)

| Champ | Valeur |
|-------|--------|
| **URL** | https://www.bfxr.net |
| **Licence** | Gratuit (abandonware) |
| **Description** | Éditeur desktop d'effets sonores procéduraux (BFXR = amélioration de sfxr). Export WAV. Plus de contrôle que jsfxr. |
| **Pertinence Narvos** | ⭐⭐⭐ **Moyenne** — outils desktop, pas intégration web directe |
| **Effort d'intégration** | Faible — export WAV → Web Audio API |
| **Recommandation** | **Adopter** — pour génération rapide de sons de prototypage |

### 6.3 Chipmunk / SunVox / MilkyTracker

| Champ | Valeur |
|-------|--------|
| **URL** | https://www.warmplace.ru/soft/sunvox/ |
| **Licence** | Gratuit (SunVox) |
| **Description** | Traqueurs musicaux modulaires (module tracker). SunVox : synthétiseur modulaire + tracker. Production de musiques cartoon/chip. |
| **Pertinence Narvos** | ⭐⭐⭐ **Moyenne** — production musicale hors ligne, pas runtime web |
| **Effort d'intégration** | Élevé — production sonore séparée du code |
| **Recommandation** | **Utiliser pour** — bande originale, thèmes musicaux |

### 6.4 Tone.js

| Champ | Valeur |
|-------|--------|
| **URL** | https://tonejs.github.io |
| **Licence** | MIT |
| **Description** | Framework audio Web complet : synthèse, séquencement, effets, transport, échantillonnage. Synthétiseurs : FM, AM, Synth, Pluck, Membrane, Metal. |
| **Pertinence Narvos** | ⭐⭐⭐⭐ **Élevée** — musique procédurale adaptative, sound design runtime |
| **Effort d'intégration** | Moyen — apprentissage API, architecture audio à mettre en place |
| **Recommandation** | **Adopter** — pour musique adaptative, SFX générés en runtime, ambiance dynamique |

### 6.5 Howler.js

| Champ | Valeur |
|-------|--------|
| **URL** | https://howlerjs.com |
| **Licence** | MIT |
| **Description** | Bibliothèque audio Web simplifiée avec sprite sheets audio, spatialisation (Web Audio API), pooling. Pas de synthèse, que de la lecture. |
| **Pertinence Narvos** | ⭐⭐⭐ **Moyenne** — redondant avec AudioManager existant |
| **Effort d'intégration** | Faible — mais nécessite évaluation si l'existant est suffisant |
| **Recommandation** | **Optionnel** — n'adopter que si AudioManager actuel manque de fonctionnalités spatiales |

### 6.6 Web Audio API (natif)

| Champ | Valeur |
|-------|--------|
| **URL** | https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API |
| **Licence** | Standard Web |
| **Description** | API intégrée aux navigateurs : AudioContext, OscillatorNode, GainNode, Convolver, spatialisation 3D (ambisonic), analyseurs, Worklets. |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — fondation de tout le système audio |
| **Effort d'intégration** | Déjà utilisé (AudioManager existant) |
| **Recommandation** | **Renforcer** — ajouter spatialisation 3D PannerNode pour positions des entités |

---

## 7. MODÈLES IA LÉGERS POUR NAVIGATEUR

### 7.1 Transformers.js (HuggingFace)

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/xenova/transformers.js |
| **Licence** | Apache 2.0 |
| **Description** | Inference transformers dans le navigateur via ONNX Runtime Web. Modèles disponibles : embeddings (all-MiniLM-L6-v2), classification, QA, sentiment, vision. Poids 20-80MB quantifiés. |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — NLP pour quêtes, dialogues, modération chat |
| **Effort d'intégration** | Moyen — chargement modèle ONNX, intégration pipeline NLP |
| **Recommandation** | **Adopter immédiatement** — pour système de dialogue NPC, analyse de texte, chat |

### 7.2 ONNX Runtime Web

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/microsoft/onnxruntime |
| **Licence** | MIT |
| **Description** | Runtime ONNX pour navigateur (WebGL / WebGPU / WASM). Exécution de modèles ML optimisés. Support WebNN (nouvelle API hardware ML). |
| **Pertinence Narvos** | ⭐⭐⭐⭐ **Élevée** — backend pour exécution de modèles ML |
| **Effort d'intégration** | Moyen — conversion/export modèles PyTorch/TF → ONNX |
| **Recommandation** | **Adopter** — comme backbone pour tout ML browser-side |

### 7.3 WebNN API

| Champ | Valeur |
|-------|--------|
| **URL** | https://www.w3.org/TR/webnn/ |
| **Licence** | W3C Standard |
| **Description** | API navigateur pour accélération ML hardware (NPU, GPU, CPU). Supporte Chrome/Edge (dernières versions). Accélère l'inférence 2-10x vs WASM. |
| **Pertinence Narvos** | ⭐⭐⭐ **Moyenne** — API émergente, pas encore standardisée partout |
| **Effort d'intégration** | Moyen — fallback nécessaire pour compatibilité |
| **Recommandation** | **Surveiller** — adopter quand support navigateur suffisant (fin 2026+) |

### 7.4 MediaPipe (Google)

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/google/mediapipe |
| **Licence** | Apache 2.0 |
| **Description** | Framework ML pour applications temps réel (Web + natif). Modèles : face mesh, hand tracking, pose detection, object detection. Version Web via WASM. |
| **Pertinence Narvos** | ⭐⭐ **Faible** — tracking/vision, pas pertinent sauf pour avatar capture |
| **Effort d'intégration** | Élevé — surdimensionné pour les besoins jeu |
| **Recommandation** | **Ne pas adopter** — sauf si fonctionnalité webcam/avatar motion capture |

### 7.5 tinygrad / micrograd (port JS)

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/tinygrad/tinygrad |
| **Licence** | MIT |
| **Description** | Frameworks autograd légers. Version JS possible pour petits réseaux dans le navigateur. Poids < 50KB. |
| **Pertinence Narvos** | ⭐⭐ **Faible** — trop bas niveau, préférer Transformers.js |
| **Effort d'intégration** | Élevé — nécessite entraînement et déploiement spécifique |
| **Recommandation** | **Ne pas adopter** — Transformers.js couvre les besoins |

### 7.6 TensorFlow.js

| Champ | Valeur |
|-------|--------|
| **URL** | https://www.tensorflow.org/js |
| **Licence** | Apache 2.0 |
| **Description** | Framework ML complet pour navigateur. Modèles pré-entraînés : pose estimation, classification, segmentation, NMT. Backends WebGL/WebGPU/WASM. |
| **Pertinence Narvos** | ⭐⭐⭐ **Moyenne** — plus lourd que Transformers.js pour NLP |
| **Effort d'intégration** | Moyen |
| **Recommandation** | **Optionnel** — préférer Transformers.js pour NLP, TF.js si vision models nécessaires |

### 7.7 Modèles GGUF (llama.cpp) via WASM

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/ggerganov/llama.cpp |
| **Licence** | MIT |
| **Description** | llama.cpp peut compiler en WASM pour exécution navigateur. Modèles quantifiés Q4/Q5 (3-8GB RAM). Très lourd pour navigateur (1-10min chargement). |
| **Pertinence Narvos** | ⭐ **Faible** — trop lourd pour web, réservé au moteur natif |
| **Effort d'intégration** | Très élevé — compilation WASM, taille modèle gigantesque |
| **Recommandation** | **Ne pas adopter pour le web** — réserver au moteur natif C++/Vulkan |

---

## 8. OUTILS DE PROFILING WEBGL

### 8.1 Spector.js

| Champ | Valeur |
|-------|--------|
| **URL** | https://spector.babylonjs.com |
| **Licence** | Apache 2.0 |
| **Description** | Débogueur WebGL avancé (Babylon.js). Capture de frames, inspection des calls WebGL (draw calls, textures, shaders, buffers, uniforms). Export JSON de frame capture. Extension Chrome/Firefox + version script injectable. |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — outil de debugging WebGL indispensable |
| **Effort d'intégration** | Aucun — extension navigateur, ou `<script>` injecté |
| **Recommandation** | **Adopter immédiatement** — extension navigateur obligatoire pour tous les devs |

### 8.2 WebGL Inspector (Firefox)

| Champ | Valeur |
|-------|--------|
| **URL** | Intégré à Firefox DevTools |
| **Licence** | MPL 2.0 |
| **Description** | Outils de débogage WebGL intégrés à Firefox DevTools : inspecteur de shaders, textures, buffers, canvas. Timeline des calls WebGL. |
| **Pertinence Narvos** | ⭐⭐⭐⭐ **Élevée** — outil natif Firefox |
| **Effort d'intégration** | Aucun — intégré au navigateur |
| **Recommandation** | **Utiliser** — complémentaire à Spector.js, test cross-navigateur |

### 8.3 Chrome DevTools — WebGL Tab

| Champ | Valeur |
|-------|--------|
| **URL** | chrome://inspect |
| **Licence** | Intégré Chrome |
| **Description** | Outils WebGL dans Chrome DevTools : capture frame, inspect textures/shaders, vérification erreurs GL, performance timeline, source des shaders compilés. |
| **Pertinence Narvos** | ⭐⭐⭐⭐ **Élevée** — outil natif Chrome |
| **Effort d'intégration** | Aucun — intégré au navigateur |
| **Recommandation** | **Utiliser** — pour le profiling GPU et la vérification des shaders |

### 8.4 stats.js (Three.js)

| Champ | Valeur |
|-------|--------|
| **URL** | https://github.com/mrdoob/stats.js/ |
| **Licence** | MIT |
| **Description** | Overlay FPS/ms/MB pour Three.js. Affichage en temps réel des métriques : framerate, temps de frame, mémoire GPU (approximative). |
| **Pertinence Narvos** | ⭐⭐⭐⭐ **Élevée** — monitoring temps réel en développement |
| **Effort d'intégration** | Faible — `npm i stats.js` + import dans la scène |
| **Recommandation** | **Adopter** — affichage permanent en mode debug |

### 8.5 three.js Inspector (Chrome Extension)

| Champ | Valeur |
|-------|--------|
| **URL** | https://chrome.google.com/webstore/detail/threejs-inspector/ |
| **Licence** | Gratuit |
| **Description** | Extension Chrome dédiée à Three.js : inspecter la scène, les objets, les matériaux, les textures, les lumières, les animations. |
| **Pertinence Narvos** | ⭐⭐⭐⭐ **Élevée** — inspection visuelle de la scène |
| **Effort d'intégration** | Aucun — extension Chrome |
| **Recommandation** | **Adopter** — pour déboguer la hiérarchie de scène et les matériaux |

### 8.6 WebGPU Profiling (pour futur)

| Champ | Valeur |
|-------|--------|
| **URL** | https://developer.chrome.com/docs/web-platform/webgpu/ |
| **Licence** | Standard Chrome |
| **Description** | Chrome DevTools support WebGPU : profiler de compute passes, inspection de ressources, debug des shaders WGSL. Utile si migration future WebGPU. |
| **Pertinence Narvos** | ⭐⭐ **Faible** — WebGPU pas encore dans la stack |
| **Effort d'intégration** | Aucun pour l'instant |
| **Recommandation** | **Surveiller** — WebGPU pourrait remplacer WebGL à moyen terme |

### 8.7 RenderDoc (pour moteur natif Vulkan)

| Champ | Valeur |
|-------|--------|
| **URL** | https://renderdoc.org |
| **Licence** | MIT |
| **Description** | Débogueur GPU frame-by-frame pour Vulkan/D3D11/D3D12/OpenGL. Capture frame, inspection shaders, pipelines, resources, mesh, textures. |
| **Pertinence Narvos** | ⭐⭐⭐⭐⭐ **Maximale** — standard de debug pour le moteur natif Vulkan |
| **Effort d'intégration** | Moyen — compilation du projet avec support RenderDoc |
| **Recommandation** | **Adopter immédiatement** — outil de debugging Vulkan n°1 |

### 8.8 NVIDIA Nsight Graphics (Vulkan)

| Champ | Valeur |
|-------|--------|
| **URL** | https://developer.nvidia.com/nsight-graphics |
| **Licence** | Gratuit (NVIDIA) |
| **Description** | Profiling GPU avancé pour Vulkan. Analyse frame, shader profiling, optimisation pipelines, memory viewer. |
| **Pertinence Narvos** | ⭐⭐⭐ **Moyenne** — dépend du GPU (réservé NVIDIA) |
| **Effort d'intégration** | Moyen |
| **Recommandation** | **Adopter si GPU NVIDIA** — profiling plus avancé que RenderDoc |

---

## 9. SYNTHÈSE ET RECOMMANDATIONS

### Tableau prioritaire par catégorie

| Priorité | Catégorie | Actions immédiates |
|----------|-----------|-------------------|
| **P0 — Critique** | Optimisation GLB | glTF-Transform + KTX2 pipeline + Draco → intégrer dans le build Vite |
| **P0 — Critique** | Shaders cartoon | MeshToonMaterial + post-processing (drei/@react-three/postprocessing) |
| **P1 — Urgent** | Pathfinding NPC | Yuka + three-pathfinding → remplacer/infrastructure NPC |
| **P1 — Urgent** | Profiling | Spector.js + RenderDoc + stats.js → équiper tous les devs |
| **P1 — Urgent** | Assets 3D | Quaternius + Kenney → base assets pour prototypage immédiat |
| **P2 — Important** | Audio procédural | Tone.js + Web Audio API spatialisation → améliorer l'immersion |
| **P2 — Important** | IA légère | Transformers.js → dialogues NPC, modération, NLP |
| **P2 — Important** | Animation UI | Rive ou GSAP → animations de HUD et transitions |
| **P3 — Souhaitable** | Shaders avancés | ShaderToy → water, fire, portals (port Three.js ShaderMaterial) |
| **P3 — Souhaitable** | Recast/Detour | Navmesh natif pour moteur C++ (Narvos Engine) |

### Évaluation par effort d'intégration

```
FAIBLE (heures)       MOYEN (jours)          ÉLEVÉ (semaines)
│                     │                      │
├─ Quaternius/Kenney  ├─ glTF-Transform      ├─ Recast/Detour C++
├─ drei/EffectComposer ├─ Yuka IA             ├─ Shaders Vulkan natifs
├─ Transformers.js    ├─ Tone.js audio       ├─ MediaPipe vision
├─ Spector.js         ├─ Rive animation UI   ├─ LLM WASM (llama.cpp)
├─ stats.js           ├─ three-pathfinding   ├─ WebNN integration
├─ MeshToonMaterial   ├─ KTX2 pipeline       └─ The Forge rendering
├─ Draco (déjà dans   ├─ RenderDoc setup
   le projet)         ├─ Post-processing avancé
├─ jsfxr/bfxr         └─ GSAP animations
└─ Chrome extensions
```

### Risques identifiés

1. **Surcharge de dépendances** — Trop de bibliothèques externes augmente le poids bundle et la surface de bugs. **Privilégier les solutions intégrées à Three.js avant d'ajouter des dépendances externes.**

2. **Pathfinding hybride (WASM + JS)** — Le projet a déjà un système WASM de collision/pathfinding. Évaluer si Yuka/three-pathfinding doit le remplacer ou le compléter. **Éviter deux systèmes concurrents.**

3. **Pipeline assets complexe** — Blender → GLB → gltf-transform (meshopt+KTX2) → Draco → Three.js. **Automatiser dans le build script Vite** pour éviter des étapes manuelles sujettes à erreur.

4. **Performance WebGL** — Les post-processing (bloom, SSR) sont chers sur GPU mobile. **Implémenter un système de qualité adaptative** (auto-détection GPU et réduction des effets).

5. **Licences** — Vérifier systématiquement les licences CC0 vs CC-BY (attribution obligatoire) pour tous les assets téléchargés.

---

*Document généré par l'Équipe Veille Technologique (10-20 agents)*
*Projet Narvos Prime — Juillet 2026*