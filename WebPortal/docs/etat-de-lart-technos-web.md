# État de l'Art — Technologies Web pour Narvos Prime

> **Projet**: WebPortal (Electron + React + Vite + Three.js/R3F)
> **Date**: 30 juillet 2026
> **Contexte**: ARPG/Sci-Fi MMORPG — render 3D, physique, audio spatialisé, réseau temps réel, ECS

---

## TABLE DES MATIÈRES

1. [Moteurs 3D Web](#1-moteurs-3d-web)
2. [Physique Web](#2-physique-web)
3. [Audio Web](#3-audio-web)
4. [Réseau Web](#4-réseau-web)
5. [ECS Web](#5-ecs-web)

---

## 1. MOTEURS 3D WEB

### Stack actuel du projet
**Three.js v0.181.2 + @react-three/fiber v9.4.0 + @react-three/drei v10.7.7**

### Comparatif

| Critère | Three.js | Babylon.js | PlayCanvas | R3F |
|---------|----------|------------|------------|-----|
| **GitHub Stars** | 114 090 | 25 869 | 16 366 | 31 570 |
| **Forks** | 36 455 | 3 675 | 1 943 | 1 908 |
| **Première release** | 2010 | 2013 | 2014 | 2019 |
| **Dernière mise à jour** | Juil 2026 | Juil 2026 | Juil 2026 | Juil 2026 |
| **License** | MIT | Apache 2.0 | MIT | MIT |
| **npm downloads/sem** | ~10M+ | ~800k | ~200k | ~2M |
| **Type** | Bibliothèque 3D | Moteur 3D complet | Moteur + éditeur cloud | Wrapper React |
| **WebGPU** | ✅ Oui (r152+) | ✅ Oui (natif) | ✅ Experimental | ✅ via Three |
| **React natif** | ❌ Non | ❌ Non | ❌ Non | ✅ Oui |

### Three.js
- **Forces**: Écosystème le plus vaste (addons, tutoriels, exemples). R3F permet une intégration React fluide déjà en place. Flexibilité maximale — on compose ce dont on a besoin. WebGPU support natif. 
- **Faiblesses**: Ce n'est PAS un game engine — pas de physique intégrée, pas d'audio, pas d'ECS, pas d'éditeur. Tout est à construire ou intégrer séparément.
- **Pertinence Narvos**: ✅ **Excellent choix**. Le projet utilise déjà Three+R3F. Migration inutile et risquée. L'écosystème permet d'ajouter chaque brique (physique, audio, réseau) indépendamment.

### Babylon.js
- **Forces**: Moteur complet avec inspector intégré, GUI, physics, audio, animation, particles out-of-the-box. Documentation excellente. Supporté par Microsoft. 
- **Faiblesses**: Plus lourd (~30% bundle vs Three). Écosystème React quasi inexistant. Verrouillage Microsoft. Courbe d'apprentissage si on vient de Three.
- **Pertinence Narvos**: ⚠️ **Coût de migration très élevé** (réécriture complète du renderer, perte de R3F). Gain nul — Three.js fait le travail.

### PlayCanvas
- **Forces**: Éditeur cloud-based puissant, optimisation mobile excellente, physics Ammo intégré, outillage pro.
- **Faiblesses**: Éditeur payant (abonnement), pas de React, verrouillage éditeur, agentivité réduite.
- **Pertinence Narvos**: ❌ **Déconseillé**. Modèle SaaS incompatible avec une app Electron offline-capable.

### React Three Fiber (R3F)
- **Forces**: API déclarative React pour Three.js. État de la scène réactif. Intégration avec l'écosystème React (zustand, etc.). Drei fournit des composants prêts à l'emploi (controls, textures, post-processing).
- **Faiblesses**: Abstraction qui peut masquer Three.js brut. Performances légèrement inférieures au Three.js nu dans les cas extrêmes (mais négligeable pour un ARPG).
- **Pertinence Narvos**: ✅ **Déjà en place et excellent**. À garder.

### Verdict 3D
```
✅ THREE.JS + R3F — STACK ACTUEL. À CONSERVER.
❌ BABYLON / PLAYCANVAS — migration non justifiée.
```

---

## 2. PHYSIQUE WEB

### Actuellement absent du projet
**Aucune librairie physique dans les dépendances**

### Comparatif

| Critère | cannon-es | Ammo.js (Bullet) | Rapier | Jolt Physics |
|---------|-----------|-----------------|--------|--------------|
| **GitHub Stars** | 2 044 | 4 544 | 5 586 (+695 bindings) | 11 162 |
| **Forks** | 153 | 581 | 374 | 869 |
| **Dernier commit** | **Jan 2024** | Juin 2026 | Juil 2026 | Juil 2026 |
| **License** | MIT | zlib (Bullet) | Apache 2.0 | MIT |
| **Langage** | JS (pur) | C++ → WASM | Rust → WASM | C++ → WASM |
| **Type** | 3D seulement | 3D seulement | 2D + 3D | 3D seulement |
| **Performances** | ★★☆☆☆ | ★★★☆☆ | ★★★★★ | ★★★★☆ |
| **Dev actif** | ❌ NON (abandonné) | ✅ Oui | ✅ Oui | ✅ Oui |

### cannon-es
- **Forces**: API simple et propre. Léger (~50KB). Intégration Three.js facile (cannon-es-debugger). Très utilisé dans des projets Three.js.
- **Faiblesses**: **⚠️ NON MAINTENU depuis janvier 2024** (1.5 an). Pas de WASM — tout en JS, 10-50x plus lent que Rapier/Jolt. Features limitées (pas de CCD avancé, pas de constraints complexes).
- **Pertinence Narvos**: ❌ **Déconseillé**. Projet mort. Risque de bugs sans correctifs.

### Ammo.js (Bullet Physics via Emscripten)
- **Forces**: Bullet Physics complet (éprouvé par des AAA). WASM natif. Support large. Connu (utilisé par PlayCanvas, Three.js examples).
- **Faiblesses**: API encombrante (portage direct). Bundle WASM ~1.5MB. Documentation peu claire. Moins performant que Rapier.
- **Pertinence Narvos**: ⚠️ **Alternative acceptable** mais Rapier ou Jolt sont meilleurs.

### Rapier (par Dimforge)
- **Forces**: **🏆 Meilleures performances** (benchmarks: 2-3x plus rapide que Bullet). API Rust propre avec bindings JS officiels. Déterministe (utile pour réseau). 2D + 3D. Très actif.
- **Faiblesses**: Bundle WASM ~800KB. Build chain Rust si on veut personnaliser. Communauté JS plus petite.
- **Pertinence Narvos**: ✅ **Recommandé** pour un ARPG nécessitant physique performante.

### Jolt Physics
- **Forces**: **🏆 Moteur AAA** (Horizon Forbidden West, Death Stranding 2). Multi-threaded. Collision detection avancée. 11k stars — très populaire.
- **Faiblesses**: Port WASM web encore jeune (jolt-ts: 1 star, bindings immatures). Pas de package npm officiel mature. Documentation C++ uniquement.
- **Pertinence Narvos**: ⚠️ **À surveiller**. Excellent moteur mais bindings WASM/web pas encore prêts pour la production.

### Verdict Physique
```
🥇 RAPIER — RECOMMANDÉ (performance + bindings JS matures)
🥈 JOLT — À SURVEILLER (quand les bindings WASM seront stables)
❌ CANNON-ES — Abandonné, ne pas utiliser
⚠️ AMMO.JS — Solution de repli acceptable
```

### Recommandation intégration
```bash
npm install @dimforge/rapier3d-compat
# Ou: npm install @dimforge/rapier3d
```

Intégration avec Three.js/R3F via `useRapier` ou pont manuel (synchronisation des transforms à chaque frame).

---

## 3. AUDIO WEB

### Actuellement absent du projet
**Aucune librairie audio dans les dépendances**

### Comparatif

| Critère | Web Audio API (native) | Howler.js | Tone.js |
|---------|----------------------|-----------|---------|
| **GitHub Stars** | — (standard HTML) | 25 327 | 14 695 |
| **Forks** | — | 2 278 | 1 055 |
| **Dernier commit** | — | Nov 2025 | Juil 2026 |
| **License** | — | MIT | MIT |
| **Type** | API bas niveau | Playback audio | Framework musique |
| **Bundle size** | 0 kB | ~12 kB | ~200 kB |
| **Spatial audio** | ✅ Oui (PannerNode) | ✅ Oui (Howler.pos) | ✅ Oui (PannerNode wrapper) |
| **Synthesis** | ✅ Basique | ❌ Non | ✅ Avancé (synthés, FX) |

### Web Audio API (native)
- **Forces**: Zéro dépendance. Supporté partout. Contrôle total (AudioContext, PannerNode, Convolver, etc.).
- **Faiblesses**: **API très verbeuse**. Pas de sprites audio, pas de gestion de fallback, pas de loader. Gestion complexe des ressources.
- **Pertinence Narvos**: ⚠️ Si les besoins audio sont simples (SFX + musique spatialisée), c'est suffisant mais verbeux.

### Howler.js
- **Forces**: API ultra-simple (jouer un son en 1 ligne). Sprites audio. Spatial audio (position 3D). Fallback automatique Web Audio → HTML5 Audio. Légèreté.
- **Faiblesses**: **⚠️ Maintenu au ralenti** (dernier commit Nov 2025). Pas de synthèse sonore. Pas de scheduling avancé. Features limitées pour un ARPG complexe.
- **Pertinence Narvos**: ✅ **Bon choix** pour SFX + musique spatialisée. Simple, fiable, léger. Suffisant pour un ARPG.

### Tone.js
- **Forces**: Synthèse sonore puissante (oscillateurs, FM, AM, Granular). Scheduling musical avancé (Transport). Effets (reverb, delay, distortion, chorus). Sequençage.
- **Faiblesses**: **Surdimensionné** pour un jeu vidéo. Bundle ~200KB. Orienté production musicale, moins jeu vidéo. Latence supplémentaire.
- **Pertinence Narvos**: ⚠️ **Trop lourd** si on veut juste des SFX. Intéressant seulement si Narvos a une composante musicale procédurale.

### Verdict Audio
```
🥇 HOWLER.JS — RECOMMANDÉ (SFX + spatial audio, léger)
🥈 WEB AUDIO API — Si on veut zéro dépendance
❌ TONE.JS — Trop lourd pour des besoins jeu standard
```

### Recommandation intégration
```bash
npm install howler
# Utilisation: new Howl({ src: ['sfx.mp3'], sprite: { hit: [0, 500] } })
```

---

## 4. RÉSEAU WEB

### Actuellement absent du projet
**Aucune librairie réseau dans les dépendances**

### Comparatif

| Critère | WebSocket | Socket.IO | WebRTC DataChannel | QUIC |
|---------|-----------|-----------|-------------------|------|
| **Stars** | 22 790 (ws) | 63 175 | 13 409 (PeerJS) / 7 801 (simple-peer) | — |
| **Transport** | TCP | TCP + HTTP long-polling | UDP-like (SCTP) | UDP |
| **P2P** | ❌ Non (client-serveur) | ❌ Non | ✅ Oui | ⚠️ Partiel |
| **Browser natif** | ✅ Oui | ✅ Oui | ✅ Oui | ❌ Non |
| **Ordre messages** | ✅ Garanti | ✅ Garanti | ⚠️ Semi-ordonné | ❌ Pas garanti |
| **Fiabilité** | ✅ Fiable | ✅ Fiable | ⚠️ Configurable | ❌ Pas fiable |
| **Latence** | ★★★☆☆ | ★★☆☆☆ | ★★★★★ | ★★★★★ |
| **Débit** | ★★★☆☆ | ★★☆☆☆ | ★★★★☆ | ★★★★★ |

### WebSocket
- **Forces**: Simple, fiable, ordonné. Écosystème immense (ws, Socket.IO, uWebSockets). Natif dans les navigateurs.
- **Faiblesses**: TCP overhead (head-of-line blocking). Pas de P2P. Latence plus élevée que WebRTC.
- **Pertinence Narvos**: ✅ **Choix par défaut** pour un serveur de jeu Electron. Socket.IO simplifie la gestion des rooms et events.

### WebRTC DataChannel
- **Forces**: **Latence ultra-faible** (UDP-like). P2P (pas de bottleneck serveur). SCTP semi-fiable/ordonné. Bon débit.
- **Faiblesses**: **Complexité élevée** (STUN/TURN/ICE). Pas de garantie d'ordre/ fiabilité selon config. Handshake complexe. Nécessite un serveur de signalement.
- **Pertinence Narvos**: ⚠️ **Utile pour P2P** (chat vocal, snapshots d'état). Complexité superflue si on a un serveur dédié.

### QUIC
- **Forces**: Latence très basse (0-RTT). Multiplexage sans HoL blocking. Standards ouverts.
- **Faiblesses**: **❌ PAS DISPONIBLE en JavaScript navigateur** pour données custom (réservé aux protocoles internes Chrome). Serveur requis.
- **Pertinence Narvos**: ❌ **Pas viable aujourd'hui** en web. À revoir dans 2-3 ans.

### Verdict Réseau
```
🥇 WEBSOCKET + SOCKET.IO — RECOMMANDÉ (client-serveur classique)
🥈 WEBRTC DATACHANNEL — Pour P2P / chat vocal si nécessaire
❌ QUIC — Pas encore disponible en web
```

### Recommandation architecture
```
Serveur dédié (Node.js) ← WebSocket/Socket.IO → Client Electron
└→ WebRTC DataChannel (optionnel) → Clients entre eux (P2P snapshots)
```

---

## 5. ECS WEB

### Actuellement absent du projet
**Aucune librairie ECS dans les dépendances**

### Comparatif

| Critère | bitecs | geotic | perfom-ecs | becsy (bonus) |
|---------|--------|--------|-------------|-------|
| **GitHub Stars** | **1 478** | 198 | **28** | 298 |
| **Forks** | 114 | — | — | — |
| **Dernier commit** | Avr 2026 | Mar 2025 | Avr 2023 | Actif |
| **License** | MPL-2.0 | MIT | MIT | MIT |
| **TypeScript** | ✅ Natif | ⚠️ Partiel | ✅ Natif | ✅ Natif |
| **Bundle size** | ~8 KB | ~15 KB | ~5 KB | ~30 KB |
| **Approche** | Data-oriented, fonctionnelle | Event-driven | Array-based | Multi-threaded |
| **Dépendances** | 0 | 0 | 0 | 0 |

### bitecs
- **Forces**: **🏆 Leader ECS TypeScript**. Data-oriented (SoA), pas d'allocations superflues. API fonctionnelle pure. 0 dépendance. Performant (cache-friendly). Design inspiré d'Aphrodite/ECS (Unity). 
- **Faiblesses**: API peu conventionnelle (pas de classes). Documentation de base. Communauté petite mais active.
- **Pertinence Narvos**: ✅ **Recommandé**. Approche data-oriented idéale pour un ARPG avec beaucoup d'entités. Léger.

### geotic
- **Forces**: API intuitive, event-driven, sérialisation intégrée.
- **Faiblesses**: **Projet très petit** (198 stars). Maintenu au ralenti. Pas purement data-oriented.
- **Pertinence Narvos**: ⚠️ Trop petit et peu actif.

### perform-ecs
- **Forces**: Simple, Swift-like.
- **Faiblesses**: **⚠️ 28 stars, abandonné (2023). Projet mort.**
- **Pertinence Narvos**: ❌ Déconseillé.

### becsy (bonus)
- **Forces**: **Multi-threaded** (Web Workers). Scheduleur parallèle. Inspiré d'ECSY. 
- **Faiblesses**: Très petit (298 stars). Complexité du threading web. Overkill pour la plupart des cas.
- **Pertinence Narvos**: ⚠️ Intéressant pour un projet ambitieux mais immature.

### Verdict ECS
```
🥇 BITECS — RECOMMANDÉ (data-oriented, TS natif, léger, actif)
🥈 BECSY — À SURVEILLER (multithreaded, intéressant pour scale)
❌ GEOTIC / PERFOM-ECS — Trop petits ou abandonnés
```

---

## SYNTHÈSE GLOBALE

### Recommandations par domaine

| Domaine | Technologie | Statut | Priorité | Coût intégration |
|---------|-------------|--------|----------|-----------------|
| **3D** | ✅ Three.js + R3F | **Déjà en place** | — | Gratuit |
| **Physique** | 🆕 **Rapier** (@dimforge/rapier3d-compat) | **À ajouter** | 🔴 Haute | Faible (npm + wrapper) |
| **Audio** | 🆕 **Howler.js** | **À ajouter** | 🟡 Moyenne | Faible (npm + assets) |
| **Réseau** | 🆕 **Socket.IO** | **À ajouter** | 🟠 Haute (multi) | Moyen (serveur + client) |
| **Réseau P2P** | 🆕 **WebRTC (PeerJS)** | **Optionnel** | 🟢 Basse | Moyen (signaling) |
| **ECS** | 🆕 **bitecs** | **À étudier** | 🟡 Moyenne | Faible (npm) |

### Priorités d'intégration

1. **🔴 RAPIER** — La physique est critique pour un ARPG (collisions, ragdolls, projectiles). cannon-es est mort, Rapier est le meilleur remplaçant.
2. **🟠 SOCKET.IO** — Si le jeu est multijoueur dès la V1, prioritaire. Sinon, repoussable.
3. **🟡 HOWLER.JS** — Audio spatialisée importante pour l'immersion mais peut être Web Audio API native dans un premier temps.
4. **🟡 BITECS** — Architecture ECS utile pour la maintenabilité mais pas bloquant. Peut être introduit progressivement.
5. **🟢 WEBRTC** — Seulement si chat vocal P2P ou snapshots d'état décentralisés.

### Stack cible recommandée
```
Three.js v0.181 + R3F v9     → 3D rendering (actuel)
@dimforge/rapier3d-compat     → Physique
howler                         → Audio spatialisé
socket.io                      → Réseau client-serveur
bitecs                         → ECS (optionnel, progressif)
```

### Ressources et références
- Rapier Three.js: https://github.com/behreajj/three-rapier (exemples d'intégration)
- Three Rapier R3F: https://github.com/isaac-mason/react-three-rapier (wrapper R3F)
- bitecs docs: https://github.com/NateTheGreatt/bitecs
- Socket.IO: https://socket.io/

---

*Rapport généré le 30 juillet 2026 — Données GitHub API, npm trends, Wikipedia*