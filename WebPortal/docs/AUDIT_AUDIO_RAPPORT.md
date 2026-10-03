# 🎵 AUDIT AUDIO — Rapport d'Analyse

**Projet** : Narvos Prime — WebPortal  
**Date** : 29 juillet 2026  
**Périmètre** : Système audio complet (AudioManager, Web Audio API, spatialisation, footsteps, musique, SFX, voix, annonces)  
**Fichiers analysés** :
- `src/utils/AudioManager.ts` (725 lignes) — cœur du système
- `src/rpg/audio/killStreakAudio.ts` — système de séquences de kills
- `src/rpg/audio/bossWarningAudio.ts` — alerte AoE boss
- `src/rpg/audio/areaAnnouncements.ts` — annonces d'entrée de zone
- `src/rpg/audio/audioEventManager.ts` — façade des événements audio
- `docs/AUDIO_SETUP.md` — documentation (obsolète)
- `docs/AUDIO_SYSTEM_EXAMPLE.md` — documentation (obsolète)
- 614 fichiers audio sur disque (WAV/MP3/OGG)

---

## Résumé Exécutif

| Domaine | État | Critique |
|---------|------|----------|
| Architecture | ✅ Architecture duale solide (HTMLAudio + Web Audio) | — |
| Documentation | ❌ **Obsolète** — docs réfèrent `soun_effect/` et `audioService` inexistants | Haute |
| Spatialisation 3D | ❌ **Absente** — volume-distance uniquement, pas de PannerNode | Haute |
| Footsteps | ⚠️ **Sous-exploité** — 3 fichiers utilisés sur 490 disponibles | Moyenne |
| Fuites mémoire | ⚠️ Présentes — buffers Web Audio non libérés, Audio elements orphelins | Moyenne |
| Gestion erreurs | ✅ Bon diagnostic, fallback .mp3→.wav, unlock autoplay | — |
| Musique | ⚠️ Chargement complet en mémoire (6-59 Mo par piste WAV) | Moyenne |

---

## 1. Architecture

### État actuel
L'architecture est **duale** et globalement bien conçue :

| Technologie | Usage | Fichier |
|-------------|-------|---------|
| `HTMLAudioElement` | Musique streaming legacy, SFX one-shot, voix PNJ, annonces | `AudioManager.ts` |
| `AudioContext` + `decodeAudioData` | Ambiances bouclées, musique de map, one-shots ambiants | `AudioManager.ts` |
| `AudioBufferSourceNode` + `GainNode` | Gestion des boucles ambiantes et musique avec fade | `AudioManager.ts` |

Sous-systèmes spécialisés bien découplés :
- **`KillStreakAudioSystem`** → séquences de kills (double/triple/quadra/penta/massacre)
- **`BossWarningAudioSystem`** → alerte AoE unique par boss
- **`AreaAnnouncementSystem`** → annonces d'entrée de zone + niveau conseillé
- **`AudioEventManager`** → façade orchestrant les 3 systèmes ci-dessus

### Points forts
✅ Singleton bien implémenté (lazy init via `getInstance()`)  
✅ `AbortController` pour les ambiances (annulation au changement de map)  
✅ Token anti-orphelin pour la musique (`musicToken`)  
✅ File d'annonces anti-chevauchement (`announceQueue` + `pumpAnnounce`)  
✅ Anti-backlog (max 6 annonces dans la file)  
✅ Volume normalisé via `clamp01()` partout  
✅ `tryWavFallback()` pour les MP3 qui échouent  

---

## 2. Documentation — OBSOLÈTE ❌ [CRITIQUE]

**BUG #1 — Documentation totalement décalée par rapport à l'implémentation réelle**

| Élément | Dans les docs | Réalité |
|---------|--------------|---------|
| Chemin audio | `/soun_effect/...` | `/models/audio/sfx/...` |
| Service | `audioService` de `../services/audioService` | `audioManager` de `../utils/AudioManager` |
| Dossier `public/` | `public/soun_effect/` | N'existe PAS sur disque |
| Fichiers d'exemple | `TAH Digital SFX Button 01.wav` dans `Buttons/` | Existe dans `sfx/Buttons/` mais chemin différent |

**Impact** : Tout nouveau développeur suivant les docs aura 100% d'échec.  
**Solution** : Réécrire AUDIO_SETUP.md et AUDIO_SYSTEM_EXAMPLE.md avec les chemins et l'API réels.

---

## 3. Web Audio API

### État
```
AudioContext (ctx) ──► masterGain (GainNode) ──► ctx.destination
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         AmbientNodes   MusicNode    OneShotNodes
         (boucles)      (boucle)     (one-shot)
```

### Problèmes identifiés

**BUG #2 — `playOneShotWebAudio()` bypass le masterGain** ⚠️
```typescript
// Ligne 408
gain.connect(ctx.destination);
// Devrait être :
gain.connect(this.masterGain ?? ctx.destination);
```
Les one-shots ambiants (sons surprises) sont envoyés directement à la sortie, contournant le masterGain. Si le masterGain est modifié pour un fade global, ces sons ne seront pas affectés.

**BUG #3 — Absence de PannerNode pour la spatialisation 3D** ❌
- Three.js `PositionalAudio` est disponible dans node_modules mais jamais utilisé
- Aucune spatialisation réelle (pas de `PannerNode`, pas de HRTF, pas de panoramique stéréo)
- Les voix PNJ simulent la distance par un simple calcul de volume linéaire (volume = 1 - dist/14)

**BUG #4 — `ensureContext()` ne reconnecte pas masterGain après un resume** ⚠️
```typescript
private ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});  // ← ici masterGain existe toujours
    }
    return this.ctx;
}
```
Si le contexte est fermé puis recréé, `masterGain` est reconnecté. OK. Mais si le contexte est simplement suspendu et repris, la chaîne de connexion reste intacte. OK aussi. Ce bug est en fait un **non-bug**, la logique est correcte.

---

## 4. Spatialisation 3D du Son

**État** : ❌ Absente

| Système | Spatialisation | Détail |
|---------|---------------|--------|
| Voix PNJ | Pseudo (gain distance) | `Math.max(0, 1 - dist/14) * voiceVolume` — linéaire, pas de stéréo |
| Footsteps | Aucune | Joués en full 2D |
| SFX | Aucune | `fireOnce()` → `new Audio()` → play |
| Ambiances | Aucune | Boucles 2D |
| Annonces | Aucune | Volontairement 2D (design) |

**BUG #5 — Implémentation pseudo-spatialisation incorrecte**
```typescript
// Ligne 496-497
const dist = Math.hypot(playerX - playerZ, npcX - npcZ);
const vol  = Math.max(0, 1 - dist / 14) * this.voiceVolume;
```
- La distance de cutoff est fixe à 14 unités — peu adaptée aux grandes maps
- Le rolloff est linéaire — la perception réelle suit une loi logarithmique
- Pas de différenciation par type d'environnement (intérieur/extérieur)
- Un PNJ derrière un mur a le même volume qu'un PNJ en ligne de vue directe

**Recommandation** : Utiliser `PannerNode` de Web Audio API pour une vraie spatialisation stéréo/HRTF, avec occlusion basée sur le raycasting.

---

## 5. Footsteps — SOUS-EXPLOITÉS ⚠️

**BUG #6 — 3 fichiers utilisés sur 490 disponibles**

| Ressource | Sur disque | Dans le code |
|-----------|-----------|--------------|
| Fichiers footsteps | 490 WAV dans 27 catégories (Armor, Wood, Grass, Sand, Water, Snow, etc.) | 3 fichiers herbe |
| `sfx_mouvement/` | 10 fichiers (herbe, gravier, parquet, flaques) | 3 utilisés |
| `Footsteps_Sound_Effects_Pro/` | 490 fichiers, 27 terrains | 0 utilisés |

Le code actuel :
```typescript
private footstepFiles = [
    "sfx_mouvement/bruit-de-pas-dans-lherbe1.wav",
    "sfx_mouvement/pasdherbe.wav",
    "sfx_mouvement/pasdherbe2.wav",
];
```

- Pas de sélection par type de surface (sol → son de sol)
- Pas de différenciation course/marche
- L'immense librairie `Footsteps_Sound_Effects_Pro` est sur disque mais complètement ignorée par le code

**Recommandation** : Créer un système de footsteps avec mapping surface → échantillons, variété par vitesse, et spatialisation légère.

---

## 6. Musique

### État
- **Musique de map** : Chargée via Web Audio API (`startMapMusic()` → fetch + decodeAudioData + loop)
- **Musique legacy** : `HTMLAudioElement` + playlist (utilisé par `playMusic()`)
- **Musique adaptative de donjon** : 3 phases (explore/combat/boss), changement contrôlé par `RpgGameWorld`

### Problèmes

**BUG #7 — Musiques WAV chargées entièrement en mémoire (6-59 Mo)**
Les fichiers de `public/models/audio/music/` sont des WAV non compressés :
- `Batlle_1.wav` : 58 Mo
- `station.wav` : 59 Mo
- `login.wav` : 47 Mo
- `batle_3.wav` : 37 Mo
- `exploration_1.wav` : 36 Mo

À chaque changement de map, l'un de ces fichiers est chargé intégralement en RAM via `fetch()` + `decodeAudioData()`. C'est acceptable pour un jeu Electron desktop mais problématique pour un navigateur web.

**BUG #8 — Gestion du ratio musique/ambiance confuse**
```typescript
// Ligne 337 : Le volume des ambiances est lié au volume musique
const targetVol = clamp01(this.musicVolume * 0.28 * volMult);
```
Les utilisateurs qui baissent le volume musique perdent aussi leurs ambiances. Il n'y a pas de volume ambiant indépendant.

**BUG #9 — `THEME_PLAYLISTS` partiellement incohérent**
```typescript
const THEME_PLAYLISTS: Record<MusicTheme, string[]> = {
  login:       [sfxUrl("login_connection/login.wav")],     // OK
  exploration: Object.values(MAP_MUSIC),                     // OK
  combat:      [sfxUrl("ambiant_forge_map/music/Cercle_de_Cendre.mp3")], // ⚠
};
```
- Le thème `combat` pointe vers un fichier d'ambiance forge, pas vers les fichiers de combat du donjon
- Les véritables musiques de combat (`dojon_s/combat/combat1.ogg`, `combat2.ogg`) ne sont utilisées que par `setDungeonPhase()`

---

## 7. SFX

### État actuel
```typescript
playSfx(name: string, mult = 1.0) { this.fireOnce(`/models/audio/sfx/${name}`, mult); }
playSfxKey(key: string, mult = 1.0) { /* SFX_KEYS lookup */ }
playButtonClick() { /* raccourci bouton */ }
```

### Problèmes

**BUG #10 — Absence de catalogue SFX organisé**
- `playSfx()` prend un nom de fichier brut — pas de type-safe, pas d'autocomplétion
- Les armes, sorts, UI, pas de sous-système dédié
- Aucune spatialisation pour les SFX de combat (tirs, sorts, impacts)

**BUG #11 — Pas de vérification de doublon (anti-spam)** ⚠️
- `fireOnce()` crée un `new Audio()` à chaque appel sans vérifier si le même son joue déjà
- Un sort spammé peut créer 10 instances Audio simultanées
- La doc mentionne `antiSpamDelay` mais n'est pas implémentée dans AudioManager

**BUG #12 — Gestion des SFX "Loading" et fichiers non référencés**
- De nombreux SFX existent sur disque (`Backgrounds/`, `Buttons/`, `Cinematic Glitch/`, `Glitch/`, `Transitions/`) mais ne sont pas utilisés par le code
- 14 fichiers MP3 dans `sfx/desert_map/` ne sont référencés nulle part

---

## 8. Gestion des Erreurs

### Points forts ✅
- `diagnoseAudioFailure()` : diagnostic complet (HTTP 404, Content-Type non-audio, codec manquant)
- `tryWavFallback()` : fallback .mp3 → .wav automatique
- Anti-dédiag : `diagnosedUrls` Set pour éviter les logs répétitifs
- `attachUnlockListeners()` : déverrouillage autoplay au 1er geste utilisateur
- `pendingPlays` : file de rattrapage pour les play() bloqués
- `AbortController` : annulation des fetches en cours au changement de map
- `musicToken` : empêche les orphelins de nœuds musique
- Guard `settled` dans `pumpAnnounce` : évite les double-appels

### Problèmes

**BUG #13 — Pas de fallback pour l'absence de Web Audio API** ⚠️
- `AudioContext` est créé sans vérifier si l'API est disponible
- Certains navigateurs très anciens ou contextes restreints peuvent ne pas avoir Web Audio API
- Pas de feature detection avant `new AudioContext()`

**BUG #14 — `catch(() => {})` silencieux sur plusieurs promesses**
```typescript
this.ctx?.resume().catch(() => {});       // ligne 595
a.play().catch(() => {});                  // ligne 665
fetch(wavUrl, ...).catch(() => {});        // ligne 80
```
Les erreurs silencieuses rendent le débogage difficile en production.

---

## 9. Fuites Mémoire

### Problèmes

**BUG #15 — Buffers Web Audio non libérés** ❌
- `playOneShotWebAudio()` crée un `AudioBufferSourceNode` + `GainNode` mais ne les libère pas
- Pas de `source.onended = () => { gain.disconnect(); source.disconnect(); }`
- Si beaucoup de one-shots sont joués (ex: session de jeu longue), les accumulateurs de buffers et nœuds peuvent grimper

**BUG #16 — HTMLAudioElement jetables jamais collectés**
- Chaque appel à `fireOnce()` crée `new Audio()` qui n'est pas tracké/nettoyé
- Idem pour `playVoice()`, `playFootstep()`, `playSfx()`, `playSfxKey()`
- Ces éléments sont automatiquement GC par le navigateur, mais sur des sessions longues avec beaucoup d'effets, ils peuvent s'accumuler

**BUG #17 — `currentMusicNode` non déconnecté après stop**
```typescript
stopMusic() {
    // ...
    this.currentMusicNode = null;  // le source/gain ne sont pas déconnectés silencieusement
}
```
Alors que les nœuds sont bien arrêtés via `src.stop()` avant, les connexions (gain → destination) ne sont pas explicitement rompues. Les nœuds déconnectés restent en mémoire jusqu'à ce que le cycle GC du navigateur les libère.

---

## 10. Tests

| Fichier | Tests | Couverture |
|---------|-------|------------|
| `killStreakAudio.test.ts` | ✅ Tests unitaires (vitest) | Logique killstreak : bon |
| `AudioManager.ts` | ❌ Aucun test | 0% — tout le cœur du système non testé |

Le seul fichier audio testé est `killStreakAudio.ts`. Le `AudioManager.ts` (725 lignes, logique complexe) n'a aucun test — ni unitaire ni d'intégration.

---

## Synthèse des Recommandations

| Priorité | Action | Effort | Impact |
|----------|--------|--------|--------|
| 🔴 **P0** | Mettre à jour la documentation (AUDIO_SETUP.md, AUDIO_SYSTEM_EXAMPLE.md) | Faible | Critique |
| 🔴 **P0** | Implémenter la spatialisation 3D (PannerNode ou Three.js PositionalAudio) | Moyen | Haute |
| 🟠 **P1** | Système de footsteps par surface (utiliser les 490 fichiers disponibles) | Moyen | Haute |
| 🟠 **P1** | Nettoyer les fuites mémoire (onended handlers, disconnect) | Faible | Haute |
| 🟠 **P1** | Ajouter un volume ambiant indépendant du volume musique | Faible | Moyenne |
| 🟡 **P2** | Écrire des tests unitaires pour AudioManager.ts | Moyen | Haute |
| 🟡 **P2** | Ajouter anti-spam SFX (tracker d'URL avec Date.now) | Faible | Moyenne |
| 🟡 **P2** | Connecter `playOneShotWebAudio` au masterGain | Très faible | Faible |
| 🟡 **P2** | Compresser les WAV en MP3/OGG pour réduire l'empreinte mémoire | Moyen | Moyenne |
| 🟢 **P3** | Nettoyer les fichiers audio orphelins (desert_map, etc.) | Faible | Faible |
| 🟢 **P3** | Ajouter un volume master dans AudioManager | Faible | Faible |
| 🟢 **P3** | Ajouter 1er geste utilisateur → `pointerdown` pour meilleure compatibilité mobile | Très faible | Faible |
| 🟢 **P3** | Remplacer les `catch(() => {})` par des logs conditionnels DEV | Très faible | Faible |

---

## Métriques Clés

| Métrique | Valeur |
|----------|--------|
| Lignes de code audio | ~900 (725 AudioManager + ~180 sous-systèmes) |
| Fichiers audio sur disque | 614 |
| Footsteps utilisés / disponibles | 3 / 490 |
| Sous-systèmes audio | 5 (AudioManager, KillStreak, BossWarning, AreaAnnounce, AudioEventManager) |
| Fichiers de tests audio | 1 (killStreakAudio.test.ts) |
| Couverture AudioManager | 0% |
| Docs à jour | 0% (2 docs obsolètes) |
| Mémoire WAV max par piste | 59 Mo (station.wav) |

---

## Fichiers à Modifier / Créer

1. **`docs/AUDIO_SETUP.md`** → Réécrire avec chemins `/models/audio/sfx/` et `/models/audio/music/`
2. **`docs/AUDIO_SYSTEM_EXAMPLE.md`** → Réécrire avec API `audioManager` réelle
3. **`src/utils/AudioManager.ts`** → Patch bugs (masterGain one-shot, onended cleanup, etc.)
4. **Nouveau : `src/rpg/audio/SpatialAudioSystem.ts`** → Vraie spatialisation 3D
5. **Nouveau : `src/rpg/audio/FootstepSystem.ts`** → Footsteps par surface
6. **Nouveaux tests : `src/utils/AudioManager.test.ts`**

---

*Rapport généré par l'Équipe AUDIT AUDIO (5 agents)*