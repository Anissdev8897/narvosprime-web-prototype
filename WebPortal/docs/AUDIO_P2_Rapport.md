# AUDIO P2 — Rapport de compression audio

## 1. Audit des formats audio

| Format | Fichiers | Taille totale |
|--------|----------|---------------|
| WAV    | 601      | 794.4 MB      |
| MP3    | 16       | 111 MB        |
| OGG    | 5        | 13 MB         |
| **Total** | **704** | **~918 MB** |

### Répartition par dossier

- `Footsteps_Sound_Effects_Pro/WAV/` — 26 catégories de bruit de pas, tout en WAV
- `sfx/` — Ambiances, boutons, transitions, glitch, chargement, mouvement → WAV majoritairement
- `music/` — Musiques de fond → WAV
- `sfx/ambiant_*` — Ambiances de map → WAV
- `sfx/dojon_s/` — Musique adaptative → OGG (déjà compressé)

## 2. Pipeline de conversion

**Script** : `scripts/convert-audio.mjs`

**Stratégie par catégorie** :

| Catégorie | Format cible | Codec | Débit |
|-----------|-------------|-------|-------|
| SFX (bruitage, UI, pas) | MP3 | libmp3lame | 192 kbps |
| Musique | WebM (Opus) | libopus | 96 kbps |
| Ambiance | Opus | libopus | 96 kbps |

**Comportement** :
- Idempotent : ne reconvertit que les fichiers source plus récents que la cible
- Fallback silencieux : si un format échoue, essaie le format suivant sans crash
- `--dry` : aperçu sans conversion
- `--force` : reconversion intégrale
- `--fast` : seulement les fichiers sans aucune sortie
- Les originaux WAV sont conservés (suppression manuelle si souhaité)

**Dépendance** : FFmpeg (installé sur le poste)

## 3. Résultats de la conversion

| Métrique | Valeur |
|----------|--------|
| Fichiers convertis | **601** |
| Échecs | **0** |
| Volume avant | **794.4 MB** |
| Volume après | **64.6 MB** |
| Économie | **91.9%** |

**Détail par format produit** :
- MP3 : 593 fichiers (SFX, footsteps, UI)
- Opus : 15 fichiers (ambiances)
- WebM : 9 fichiers (musique)
- Originaux WAV conservés : 601

## 4. Impact navigateur

Tous les formats produits (MP3, Opus, WebM) sont nativement supportés par les navigateurs modernes et Electron. Le code existant dans `AudioManager.ts` utilise déjà `AudioContext.decodeAudioData()` qui supporte ces formats.

## 5. TypeScript (tsc)

Le script est en `.mjs` — invisible pour `tsc`. Aucune erreur TypeScript introduite.
(Note : des erreurs préexistantes dans `ForgePanels.tsx` ne sont pas liées à ce travail.)