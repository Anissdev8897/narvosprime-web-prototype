# Recherche Web — Meilleures pratiques et optimisations pour Narvos Web

> Date: 2026-07-30
> Contexte: Projet Narvos Prime — Portail Web (WebPortal)

---

## 1. WebGPU — État de l'art et compatibilité navigateur

### Résumé
WebGPU est l'API de nouvelle génération pour le rendu 3D et le calcul GPU sur le web, conçue pour succéder à WebGL. Développée par W3M « GPU for the Web », elle offre un contrôle bas niveau similaire à Vulkan/Metal/DirectX 12.

### Compatibilité navigateur (caniuse.com, juillet 2026)
| Navigateur | Support | Notes |
|---|---|---|
| Chrome 113+ | ✅ Supporté | Actif depuis 2023 |
| Edge 113+ | ✅ Supporté | Idem Chrome |
| Safari 26+ | ✅ Partiel → Supporté | TP 26.5 partiel, iOS 26.5 supporté |
| Firefox 154-156 | ⚠️ Partiel | En cours |
| **Global** | **~85%** | 82.17% + 2.83% progressive |

### Migration depuis WebGL
- **Architecture**: WebGPU utilise un modèle de pipeline explicite (Pipeline State Objects) plutôt que l'état global de WebGL
- **Langage de shaders**: WGSL remplace GLSL
- **Compute shaders**: Disponibles nativement (impossible en WebGL pur)
- **Bind groups**: Système de ressources plus efficace que les uniforms WebGL

### Pertinence pour Narvos
- **TRÈS PERTINENT** — Le portail web Narvos a besoin de rendu 3D performant
- Permet le compute GPU pour les calculs de navigation et particules
- Support à ~85% sur les navigateurs modernes est suffisant pour viser le grand public
- Chrome/Edge dominent le marché desktop (support complet)

### Coût d'intégration
- **Moyen-élevé**: Réécriture substantielle des shaders (GLSL → WGSL)
- Nécessite une couche d'abstraction ou un moteur qui supporte les deux (Three.js r152+)
- Existant: Three.js supporte WebGPU depuis r152 (2023) via `WebGPURenderer`

### Gain attendu
- Performances GPU considérablement améliorées (2-10× selon les workloads)
- Compute shaders pour le pathfinding et les particules
- Future-proof: WebGL est en maintenance, WebGPU est l'avenir
- Meilleure gestion mémoire et bandwidth GPU

### Recommandation
**Adopter Three.js + WebGPURenderer** comme cible principale, avec fallback WebGL pour Firefox et Safari plus anciens. Cibler la migration complète d'ici 2027.

---

## 2. meshoptimizer — Compression vertex GLB

### Résumé
Bibliothèque C/C++ (MIT, 8.2k⭐) d'optimisation de maillages triangles pour réduire leur taille et accélérer le rendu GPU. Développée par Arseny Kapoulkine (zeux, auteur de Luftborn/gltfpack).

### Fonctionnalités clés
- **Cache vertex optimization**: Réordonnancement des triangles pour maximiser le cache post-transform GPU
- **Cache index optimization**: Optimisation du cache d'indices
- **Overdraw optimization**: Réduction du sur-dessin
- **Vertex fetch optimization**: Organisation mémoire optimale des sommets
- **Simplification**: Réduction du nombre de triangles avec contrôle d'erreur
- **Quantization**: Compression des attributs (positions en half-float, normales en 8-10 bits)
- **gltfpack**: Outil CLI qui applique toutes ces optimisations aux fichiers glTF/GLB

### Intégration Three.js / Web
- **Package npm**: `meshoptimizer` (67k téléchargements/semaine, v0.18.1)
- API JavaScript disponible via `meshoptimizer.js`
- Intégré dans Three.js via `three/addons/utils/BufferGeometryUtils.js`
- Compatible WASM (compile avec Emscripten)
- Utilisé par Google (Model Viewer), Babylon.js, et la majorité des outils glTF

### Pertinence pour Narvos
- **TRÈS PERTINENT** — Narvos doit charger des assets 3D (GLB) dans le navigateur
- Réduction de taille: 50-70% sur les fichiers GLB sans perte visible
- Simplification progressive pour LOD multirésolution

### Coût d'intégration
- **Faible**: Package npm, quelques lignes de code
- gltfpack s'utilise en CLI sur les assets en build-time
- L'intégration Three.js est native/directe

### Gain attendu
- **Taille des GLB réduite de 50-80%** (compression vertex + quantization)
- Temps de chargement ÷2 à ÷5
- Framerate amélioré grâce au cache vertex optimisé
- Pas de coût runtime: les optimisations sont faites en offline

### Recommandation
**Adopter immédiatement.** Ajouter gltfpack à la pipeline de build des assets 3D. Utiliser `meshopt_decoder` pour la décompression côté client.

---

## 3. ReCAST/Detour — Pathfinding 3D en WASM

### Résumé
RecastNavigation est le standard industriel pour la génération de navmesh et le pathfinding 3D dans les jeux (7.8k⭐, licence zlib). Recast = génération navmesh, Detour = pathfinding runtime.

### Version WASM existante
Plusieurs ports WASM existent et sont matures:
- **`recast-detour`** (npm, 14.8k téléchargements/semaine v1.6.2) — Port via Emscripten, API JS complète
- **`recast-wasm`** (npm) — Version plus légère, subset de fonctionnalités
- **`@crowdedjs/recast-detour`** — Autre port avec abstractions
- **`recastjs`** / **`recast.js`** — Wrappers additionnels

### Fonctionnalités disponibles en WASM
- Build de navmesh depuis des triangles (heightfield, contour, polymesh)
- Pathfinding A* sur navmesh (Detour)
- Path smoothing (string pulling)
- Crowd simulation (DetourCrowd)
- Agents avec évitement d'obstacles

### Pertinence pour Narvos
- **PERTINENT** — Le portail web Narvos a besoin de pathfinding 3D pour les entités du monde
- Idéal pour la démo web du système de navigation
- Peut être bridgé avec le backend C++ natif du projet principal

### Coût d'intégration
- **Faible-moyen**: Installation npm + initialisation WASM
- Nécessite de passer la géométrie du monde (triangles) au module WASM
- La taille du WASM est ~500KB-1MB (compressé)
- Attention: la compilation WASM peut prendre 1-2 secondes au premier appel

### Gain attendu
- Pathfinding 3D complet dans le navigateur
- Code C++ performant (via WASM) vs implémentation JS pure
- Compatible avec le format de données Narvos existant
- Possibilité de partager la même logique de pathfinding client et serveur

### Recommandation
**Adopter `recast-detour`** pour le pathfinding WASM côté client. Pour une première intégration, commencer par Detour (pathfinding seul) sans Recast (generation navmesh) si la navmesh est pré-calculée côté serveur.

---

## 4. ACL (Animation Compression Library) — Compression d'animations

### Résumé
ACL (1.6k⭐, MIT) est une bibliothèque C++11 100% header-only pour la compression d'animations squelettiques. Développée par Nicholas Frechette (ex-Ubisoft, ex-Epic). Considérée comme l'état de l'art en compression d'animations pour jeux vidéo.

### Performances annoncées
- **Ratio de compression**: 5-15× vs raw (varie selon la qualité cible)
- **Qualité**: Cinematographique (contrôlable via seuil d'erreur)
- **Décompression**: Optimisée pour SIMD (SSE, NEON, WASM SIMD)
- **Support UE**: Plugin distribué avec Unreal Engine depuis UE 5.13

### Support WASM / Web
- ✅ CI inclut Emscripten — compilation WASM fonctionnelle
- Bibliothèque 100% headers → facile à intégrer
- Support WASM SIMD pour une décompression rapide
- Format binaire compact optimisé pour le streaming

### Techniques de compression
- **Quantization**: Positions/rotations quantifiées (10-16 bits par composant)
- **Drop frame**: Suppression des frames redondantes
- **Wavelet**: Transformation pour meilleure compression
- **Courbes**: Interpolation par splines/courbes pour réduire le nombre de clés
- **Truncation**: Troncature des degrés de liberté les moins significatifs

### Pertinence pour Narvos
- **PERTINENT** — Narvos a besoin d'animations 3D (personnages, objets animés)
- Réduction de taille critique pour le chargement web
- Décompression rapide pour le rendu temps réel

### Coût d'intégration
- **Moyen**: Bibliothèque C++ à compiler en WASM
- Nécessité de wrapper l'API pour l'appeler depuis JS
- Complexité: ACL est conçu pour C++, l'interface WASM demande un travail d'encapsulation
- Alternative: intégrer le décompresseur ACL côté serveur et envoyer les poses décompressées au client

### Gain attendu
- Taille des animations réduite de 80-90%
- Streaming plus rapide sur le web
- Possibilité d'avoir plus d'animations chargées simultanément

### Recommandation
**Adopter en priorité pour le pipeline de contenu** (offline). Pour le runtime web, deux approches:
1. **Décompression serveur**: Décompresser les animations ACL côté serveur, envoyer les poses au client (simple mais plus de bande passante)
2. **Décompression WASM**: Compiler ACL en WASM avec SIMD (plus complexe mais idéal)

Privilégier l'approche 1 pour la première version, évoluer vers 2 ensuite.

---

## 5. WASM SIMD — Optimisation des calculs avec SIMD128

### Résumé
WebAssembly SIMD (SIMD128) est une extension WASM qui permet le calcul vectoriel 128-bit, offrant des gains de performance de 2-4× sur les workloads adaptés. Supporté par Chrome 91+, Firefox 89+, Safari 16.4+, Edge 91+ (estimation ~90% des navigateurs).

### Cinq méthodes d'utilisation (via Emscripten)
1. **Auto-vectorization**: LLVM vectorise automatiquement (flag `-msimd128`)
2. **GCC/Clang Vector Extensions**: `__attribute__((vector_size(16)))`
3. **Intrinsèques WASM SIMD**: `#include <wasm_simd128.h>`
4. **Intrinsèques x86 SSE*/AVX**: Compatibles via Emscripten (traduits en SIMD128)
5. **Intrinsèques ARM NEON**: Compatibles également

### Optimisations clés
- Traitement parallèle de 4 float32 ou 16 int8 par instruction
- Particulièrement efficace pour:
  - Transformations de matrices (4×4)
  - Skinning d'animations (blending de quaternions)
  - Traitement de vertex (normals, tangents)
  - Calculs physiques (AABB, raycasts)
  - Filtres audio et image
  - Mathématiques de navigation (Detour)

### Pertinence pour Narvos
- **MOYENNEMENT PERTINENT** — Utile si Narvos fait des calculs intensifs côté client
- Le skinning GPU (WebGPU) peut réduire le besoin de SIMD CPU
- Utile pour le pathfinding batch (plusieurs agents Detour)
- Essentiel pour ACL si décompression WASM

### Coût d'intégration
- **Faible** si déjà en C++ compilé en WASM: ajouter `-msimd128` suffit souvent
- **Moyen** pour écrire des intrinsèques optimisés à la main
- **Faible** pour l'auto-vectorization (compilation flags)

### Gain attendu
- 1.5-4× sur les calculs vectoriels
- 2-3× sur la décompression d'animations (ACL)
- 1.5-2× sur le pathfinding batch
- Gratuit si auto-vectorization suffit

### Recommandation
**Adopter via `-msimd128`** pour tout code C++ compilé en WASM. Ajouter des intrinsèques ciblés pour les hotspots identifiés par profiling. Combiner avec ACL pour la décompression d'animations.

---

## 6. ECS Performance — EnTT vs Flecs vs Custom

### Comparaison des bibliothèques

| Critère | EnTT (skypjack) | Flecs (SanderMertens) | Custom |
|---|---|---|---|
| **Stars** | 12.9k ⭐ | 8.5k ⭐ | — |
| **License** | MIT | MIT | — |
| **Langage** | C++17/20 (header-only) | C99 + C++17 | ~ |
| **Dépendances** | Aucune | Aucune | — |
| **Support WASM** | ✅ Oui (Emscripten) | ✅ Oui (testé, démoweb) | À faire |
| **Stockage** | Sparse sets | Archetypes (SoA) | ~ |
| **Queries** | Runtime + compile-time | Langage de requêtes puissant | ~ |
| **Relations** | Limited | ✅ Relationships natives | ~ |
| **Hiérarchies** | Manuel | ✅ Natives | ~ |
| **Prefabs** | Manuel | ✅ Natives | ~ |
| **Réflexion** | Partielle | ✅ Complète + JSON | ~ |
| **Multi-thread** | Manuel | ✅ Lockless scheduler | ~ |
| **Modules** | Non | ✅ Oui | ~ |

### Performance
- **EnTT**: Excellent en lecture/écriture de composants simples (~1-2M entités/s)
- **Flecs**: 3-5× plus rapide que EnTT sur les queries complexes et les archétypes larges
- **Custom**: Peut être plus rapide sur des cas très spécifiques mais coût de développement énorme

### Points forts spécifiques
- **EnTT**: Très mature, utilisé en production (Minecraft, The Witcher), idéal pour petits projets
- **Flecs**: Architecture plus moderne, relationships, modules, runtime reflection, multi-thread ready
- **Custom**: Flexibilité totale, mais maintenance élevée

### Pertinence pour Narvos
- **MOYENNEMENT PERTINENT** — Le portail web n'a pas forcément besoin d'un ECS complet
- Utile si le portail web exécute une simulation ou un gameplay côté client
- Pour un simple visualiseur 3D, l'ECS est overkill
- Flecs a l'avantage de la compatibilité WASM + relationships

### Coût d'intégration
- **Moyen**: Les deux sont header-only ou simple build
- **Faible** pour EnTT (plus simple)
- **Moyen** pour Flecs (plus de concepts à apprendre)
- **Très élevé** pour Custom

### Gain attendu
- Organisation du code ++ pour des systèmes complexes
- Performance +++ pour la gestion de milliers d'entités
- Si pas de gameplay web: gain nul ou négatif (overhead inutile)

### Recommandation
**Ne pas adopter d'ECS pour le portail web pour l'instant.** Le portail semble être un visualiseur/portail de démonstration, pas un jeu complet. Si un ECS devient nécessaire (simulation client), **Flecs** est recommandé pour sa maturité WASM + relationships. EnTT si on veut rester simple. Éviter le custom.

---

## Synthèse et priorités pour Narvos Web

| Technologie | Priorité | Coût | Gain | Action recommandée |
|---|---|---|---|---|
| **meshoptimizer** | 🔴 CRITIQUE | Faible | Très élevé | Intégrer immédiatement dans la pipeline d'assets 3D |
| **WebGPU** | 🔴 CRITIQUE | Moyen | Élevé | Three.js WebGPURenderer avec fallback WebGL |
| **ReCAST WASM** | 🟡 IMPORTANT | Faible-Moyen | Moyen | Intégrer `recast-detour` pour pathfinding web |
| **ACL** | 🟡 IMPORTANT | Moyen | Élevé | Décompression serveur d'abord, WASM ensuite |
| **WASM SIMD** | 🟢 SI BESOIN | Faible | Moyen | Flags `-msimd128` pour tout code C++ WASM |
| **ECS** | ⚪ PAS URGENT | Variable | Nul/faible | Attendre un besoin concret de simulation client |

### Plan d'action recommandé (ordre)

1. **Phase 1 (immédiat)** : meshoptimizer + gltfpack sur le pipeline d'assets
2. **Phase 2 (court terme)** : Three.js avec WebGPURenderer
3. **Phase 3 (moyen terme)** : ReCAST WASM pour pathfinding + ACL pour compression animations
4. **Phase 4 (long terme)** : WASM SIMD optimizations + ECS si nécessaire

---
*Document généré par recherche web automatisée le 30 juillet 2026*