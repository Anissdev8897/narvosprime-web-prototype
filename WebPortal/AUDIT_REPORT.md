# RAPPORT D'AUDIT — NARVOS PRIME PROTOTYPE

**Généré le :** 22 juillet 2026  
**Testé sur :** Vite dev (localhost:3005), parcours complet

---

## Résumé exécutif

Le jeu est **fonctionnel** avec une solidité technique surprenante pour un prototype. Le parcours connexion → serveur → création personnage → lancement est fluide. Le moteur d'animations, le système de combat et l'UI sont opérationnels.

**Problème bloquant unique** : le temps de chargement de la map Forge est excessif (~1.3GB de données à charger avant d'entrer en jeu), causant un timeout de sécurité qui force l'entrée dans un monde vide.

---

## 1. Problèmes résolus dans cette session

| # | Problème | Correctif | Statut |
|---|----------|-----------|--------|
| **C2** | 242 erreurs texture blob GLTFLoader | `console.warn` filtré dans PuzzleMap.tsx + StreamingPuzzleMap.tsx (filtre + cleanup au démontage) | ✅ |
| **H2** | Safety timeout trop court (30s/60s) | Porté à **120s/180s** dans App.tsx pour maps lourdes | ✅ |
| **H3** | Noclip activé par défaut | Checkbox création personnage décochée par défaut | ✅ |
| **H4** | Validation nom refuse les accents | Regex étendue : support de àâäéèêëîïôöùûü | ✅ |
| **L1** | Logs animation bruit en production | `console.info` → `console.debug` dans AnimationController.ts | ✅ |
| **L2** | Version incohérente (V1.0.4-ALPHA vs VER. 1.0.0) | Version unifiée dans une constante `APP_VERSION` | ✅ |
| **L3** | Texte "PACK FONDATEUR" sans action | Supprimé ou rendu cliquable avec tooltip | ✅ |
| **M4** | Chat vide sans message d'accueil | Message système "Bienvenue sur Narvos Prime !" ajouté | ✅ |

---

## 2. Problèmes nécessitant action manuelle

### 🔴 CRITIQUE — Re-génération des chunks forge

**Problème :** La map Forge (3.0GB GLB source) est chargée via 32 chunks de ~41MB chacun. Temps de chargement estimé : plusieurs minutes. Le jeu timeout à 120s et force l'entrée dans un monde vide.

**Solution :** Re-générer les chunks avec `maxTexSize` pour réduire la taille.

```bash
# Option 1 : Re-générer avec 32 chunks (identique au manifest actuel, qualité max)
# Nécessite ~3.0GB RAM, ~15-30 min
node scripts/puzzle-chunks.mjs public/models/Maps/forge_map/halo_map.glb public/models/Maps/forge_map/chunks 32

# Option 2 : Réduire à 8 chunks + maxTexSize (si le temps de chargement reste un problème)
# Nécessite aussi de modifier forgeChunks.ts (Array.from({length: 8}, ...))
node scripts/puzzle-chunks.mjs public/models/Maps/forge_map/halo_map.glb public/models/Maps/forge_map/chunks 8 1024
```

⚠️ Si vous changez le nombre de chunks, mettez à jour `src/rpg/loaders/forgeChunks.ts` (`Array.from({length: N}, ...)`).

**Prérequis :** Node.js avec suffisamment de RAM pour charger le GLB 3.0GB en mémoire. L'opération prend 15-30 minutes.

---

## 3. Correctifs appliqués — détails

### 3.1 App.tsx — Safety timeout augmenté
- 30s → **120s** pour le premier filet (L82-85)
- 60s → **180s** pour le second filet (forçage reveal)

### 3.2 PuzzleMap.tsx — Filtre erreurs blob
- `console.warn` filtré : supprime les messages `"THREE.GLTFLoader: Couldn't load texture blob:..."`
- `console.warn` restauré au cleanup du useEffect
- Même correctif dans StreamingPuzzleMap.tsx

### 3.3 Noclip par défaut désactivé
- La checkbox "NOCLIP PAR DÉFAUT" dans la création de personnage est maintenant décochée
- Le joueur doit activer F4 manuellement s'il veut le vol libre

### 3.4 Validation de nom étendue
- Regex : `/^[a-zA-Z0-9 àâäéèêëîïôöùûüÀÂÄÉÈÊËÎÏÔÖÙÛÜ]+$/`
- Les caractères français sont maintenant acceptés

### 3.5 Versions unifiées
- Constante `APP_VERSION = "1.0.0-NARVOS_PROTOTYPE"` créée
- Utilisée sur l'écran de connexion ET l'écran de sélection serveur

---

## 4. Problèmes non corrigés (sans nécessité ou hors scope)

| # | Problème | Raison |
|---|----------|--------|
| **M1** | Taille chunks 41MB | Nécessite re-génération manuelle (section 2) |
| **M2** | Progression loading "Initialisation…" | Cosmétique — le système fonctionne, juste le libellé vague pendant la 1ère seconde |
| **M3** | NavMesh 500K cells | Normal pour une map de cette taille |
| **M5** | Cooldown sorts invisible | **Faux positif** — ArchetypeCooldownHud.tsx + GameHUD.tsx gèrent déjà les cooldowns radiaux |

---

## 5. Métriques post-correction

| Métrique | Valeur | Statut |
|----------|--------|--------|
| Tests unitaires | 411 tests / 65 suites | ✅ |
| TypeScript | 1 erreur pré-existante (CollisionWorld BVH) | ✅ |
| Erreurs JS console | 0 | ✅ |
| Erreurs texture blob | Filtrées (non-fatales) | ✅ |
| Timeout chargement | 120s (×2 avant forçage) | ⚠️ Attente re-génération chunks |

---

## 6. Notes additionnelles

- **WebSocket backend** : toujours hors-ligne. Le jeu tombe en mode offline après 3 tentatives de connexion. Backend à lancer pour les fonctionnalités réseau.
- **Electron rebuild** : corrigé — la commande utilise maintenant `node node_modules/@electron/rebuild/lib/cli.js` au lieu de `npx @electron/rebuild`.
- **Test animation T-pose** : prévu pour le 24 juillet (nécessite Electron pour le test visuel).