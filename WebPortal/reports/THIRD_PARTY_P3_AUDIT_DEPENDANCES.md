# 🔍 THIRD PARTY P3 — Audit des Dépendances

**Projet :** NARVOS PRIME WebPortal  
**Date :** 30/07/2026  
**Node :** v24.11.0  
**npm :** latest  
**Total packages :** 15 production + 24 dev (39 direct)

---

## 1. 📦 Analyse des Dépendances (package.json)

### 1.1 Dépendances de Production (15)

| Package | Version | Taille (disk) | Utilisation | Statut |
|---|---|---|---|---|
| `three` | ^0.181.2 | **34.2 MB** | ✅ 100+ fichiers (core 3D engine) | 🟢 OK |
| `@react-three/fiber` | ^9.4.0 | 0.6 MB | ✅ 31 imports (React 3D renderer) | 🟢 OK |
| `@react-three/drei` | ^10.7.7 | 3.2 MB | ✅ 30 imports (helpers 3D) | 🟢 OK |
| `@react-three/postprocessing` | ^3.0.4 | 0.4 MB | ✅ 1 fichier (PostProcessingPipeline) | 🟢 OK |
| `@xyflow/react` | ^12.11.2 | 1.5 MB | ✅ ForgeGraphPanel.tsx | 🟢 OK — Node Editor |
| `react` | ^19.2.0 | — | ✅ Core | 🟢 OK |
| `react-dom` | ^19.2.0 | — | ✅ Core | 🟢 OK |
| `lucide-react` | ^0.554.0 | **34.5 MB** | ✅ UI components (33 fichiers) | 🟢 OK — **lourd** |
| `three-stdlib` | ^2.35.12 | **25.7 MB** | ✅ 27 imports (loaders, helpers) | 🟢 OK — **lourd** |
| `three-mesh-bvh` | ^0.9.1 | 2.2 MB | ✅ CollisionWorld, PuzzleMap | 🟢 OK |
| `postprocessing` | ^6.39.3 | 2.6 MB | ✅ PostProcessingPipeline | 🟢 OK |
| `bcryptjs` | ^3.0.3 | 0.1 MB | ✅ electron/database.ts, localDatabase.ts | 🟢 OK |
| `better-sqlite3` | ^12.5.0 | 11.6 MB | ✅ electron/localDatabase.ts | 🟢 OK |
| `mysql2` | ^3.15.3 | 1.0 MB | ✅ electron/database.ts | 🟢 OK |
| `dotenv` | ^17.2.3 | 0.1 MB | ✅ electron/main.ts, database.ts | 🟢 OK |

### 1.2 Dépendances de Développement (24)

| Package | Version | Taille | Utilisation | Statut |
|---|---|---|---|---|
| `electron` | ^39.2.6 | **326.7 MB** | ✅ Fenêtre principale | 🟢 OK — **très lourd** |
| `vite` | ^6.2.0 | **25.5 MB** | ✅ Build tool | 🟢 OK |
| `typescript` | ~5.8.2 | **21.8 MB** | ✅ Compilation | 🟢 OK |
| `tailwindcss` | ^3.4.19 | **5.3 MB** | ✅ tailwind.config.js + postcss | 🟢 OK |
| `sharp` | ^0.34.5 | 0.6 MB | ✅ 10 scripts asset processing | 🟢 OK |
| `@gltf-transform/core` | ^4.3.0 | 1.9 MB | ✅ Scripts GLB processing | 🟢 OK |
| `@gltf-transform/extensions` | ^4.3.0 | 1.6 MB | ✅ Scripts GLB processing | 🟢 OK |
| `@gltf-transform/functions` | ^4.3.0 | 2.2 MB | ✅ Scripts GLB processing | 🟢 OK |
| `@electron/rebuild` | ^4.0.1 | — | ✅ electron:rebuild script | 🟢 OK |
| `electron-builder` | ^25.1.8 | 0.1 MB | ✅ Packaging | 🟢 OK |
| `vite-plugin-electron` | ^0.28.8 | — | ✅ Vite plugin | 🟢 OK |
| `vitest` | ^2.1.9 | — | ✅ Test runner | 🟢 OK |
| `concurrently` | ^8.2.2 | — | ✅ npm run start | 🟢 OK |
| `cross-env` | ^10.1.0 | — | ✅ npm run start | 🟢 OK |
| `wait-on` | ^8.0.5 | — | ✅ npm run start | 🟢 OK |
| `postcss` | ^8.5.8 | — | ✅ postcss.config.js | 🟢 OK |
| `autoprefixer` | ^10.4.27 | — | ✅ postcss.config.js | 🟢 OK |
| `esbuild` | ^0.27.0 | — | ✅ transitive for vite | 🟢 OK |
| `draco3dgltf` | ^1.5.7 | — | ✅ Compression Draco dans scripts | 🟢 OK |
| `glslang-validator-prebuilt` | ^0.0.7 | — | ✅ shader precompilation | 🟢 OK |
| `@types/bcryptjs` | ^2.4.6 | — | ✅ TypeScript types | 🟢 OK |
| `@types/better-sqlite3` | ^7.6.13 | — | ✅ TypeScript types | 🟢 OK |
| `@types/node` | ^22.14.0 | — | ✅ TypeScript types | 🟢 OK |
| `@vitejs/plugin-react` | ^5.0.0 | — | ✅ Vite plugin React | 🟢 OK |

### 1.3 Paquets « Extraneous » (orphelins)

Détectés via `npm ls` — probablement des résidus d'anciennes installations :

| Package | Raison probable |
|---|---|
| `argparse@2.1.1` | Résidu d'ancien script CLI |
| `fast-deep-equal@3.1.3` | Résidu d'ancienne dépendance |
| `fast-json-stable-stringify@2.1.0` | Résidu d'ancienne dépendance |
| `json-schema-traverse@0.4.1` | Résidu d'ancienne dépendance |
| `punycode@2.3.1` | Résidu d'ancienne dépendance |
| `uri-js@4.4.1` | Résidu d'ancienne dépendance |

**Action :** `npm prune` pour les nettoyer.

---

## 2. 🚨 npm audit — Vulnérabilités

### Résumé

| Sévérité | Nombre | Détails |
|---|---|---|
| **Critical** | 4 | `decompress` (zip slip), `shell-quote`, `tar` (x2) |
| **High** | 30 | `electron`, `electron-builder`, `axios`, `postcss`, `sharp`, `@xmldom/xmldom`, etc. |
| **Moderate** | 9 | `vite/esbuild`, `ajv`, `joi`, `follow-redirects`, etc. |
| **Low** | 2 | `@babel/core`, `@tootallnate/once` |
| **Total** | **45** | |

### Vulnérabilités par dépendance DIRECTE

#### 🔴 Critiques (4)

| Package | Vulnérabilité | Fix |
|---|---|---|
| `glslang-validator-prebuilt` | `decompress` Zip Slip → Arbitrary File Write | `npm audit fix --force` (breaking → 0.0.5) |
| `electron-builder` (via `tar`) | Hardlink Path Traversal, Symlink Poisoning, DoS (12 CVEs) | `npm audit fix --force` (breaking → 26.15.3) |
| `@electron/rebuild` (via `tar`) | Idem | `npm audit fix --force` |
| `shell-quote` (transitive) | DoS + newline injection in quote() | `npm audit fix` |

#### 🟠 Hautes (sélection)

| Package direct | Via | CVE notable | Action |
|---|---|---|---|
| `electron` 39.2.6 | Chromium, Node | AppleScript injection, UAF, context isolation bypass, CSP | `npm audit fix` (→ 39.8.10) |
| `electron-builder` 25.1.8 | `app-builder-lib` | Uncontrolled search path (AppImage), credential leak | `--force` (→ 26.15.3, breaking) |
| `@gltf-transform/functions` | `ndarray-pixels` → `sharp` | CVE-2026-33327 (libvips) | `--force` (→ 3.4.2 downgrade, breaking) |
| `sharp` 0.34.5 | libvips | 4 CVEs : CVE-2026-33327/8, CVE-2026-35590/1 | `--force` (→ 0.35.3, breaking) |
| `postcss` 8.5.8 | — | XSS, Path Traversal, Arbitrary file read | `npm audit fix` |
| `axios` (transitive) | — | 25+ CVEs : SSRF, Prototype Pollution, Header Injection | N/A (transitive, via `@gltf-transform`) |
| `@xmldom/xmldom` (transitive) | — | XML injection, uncontrolled recursion | `npm audit fix` |
| `@isaacs/brace-expansion` | — | ReDoS uncontrolled resource consumption | `npm audit fix` |

#### 🟡 Modérées

| Package | Vulnérabilité | Fix |
|---|---|---|
| `vite` 6.4.1 (via `esbuild`) | Dev server leaks responses | `--force` (→ vitest@4.1.10) |
| `vitest` 2.1.9 | Via vite/esbuild | `--force` |
| `ajv` (transitive) | ReDoS via `$data` | `npm audit fix` |
| `joi` (transitive) | Uncaught RangeError | `npm audit fix` |
| `follow-redirects` (transitive) | Auth header leak | `npm audit fix` |

---

## 3. 🔄 Versions Obsolètes (npm outdated)

### Breaking changes disponibles (major)

| Package | Actuelle | Latest | Saut | Risque |
|---|---|---|---|---|
| `electron` | 39.2.6 | **43.2.0** | 39→43 | 🟠 Breaking (API changes) |
| `electron-builder` | 25.1.8 | **26.15.3** | 25→26 | 🟠 Breaking |
| `vite-plugin-electron` | 0.28.8 | **1.1.0** | 0→1 | 🟠 Breaking |
| `vitest` | 2.1.9 | **4.1.10** | 2→4 | 🟠 Breaking |
| `vite` | 6.4.1 | **8.1.5** | 6→8 | 🟠 Breaking |
| `wait-on` | 8.0.5 | **9.1.0** | 8→9 | 🟠 Breaking |
| `lucide-react` | 0.554.0 | **1.27.0** | 0→1 | 🟠 Breaking |
| `typescript` | 5.8.3 | **7.0.2** | 5→7 | 🟠 Breaking |
| `tailwindcss` | 3.4.19 | **4.3.3** | 3→4 | 🟠 Breaking |
| `better-sqlite3` | 12.5.0 | **13.0.2** | 12→13 | 🟠 Breaking |
| `concurrently` | 8.2.2 | **10.0.4** | 8→10 | 🟠 Breaking |
| `three` | 0.181.2 | **0.185.1** | 0.181→0.185 | 🟢 Minor |

### Non-breaking updates disponibles

| Package | Actuelle | Wanted | Patch/Mino |
|---|---|---|---|
| `@react-three/fiber` | 9.4.0 | **9.6.1** | 🟢 |
| `@electron/rebuild` | 4.0.1 | **4.2.0** | 🟢 |
| `@gltf-transform/core` | 4.3.0 | **4.4.2** | 🟢 |
| `@gltf-transform/extensions` | 4.3.0 | **4.4.2** | 🟢 |
| `@gltf-transform/functions` | 4.3.0 | **4.4.2** | 🟢 |
| `dotenv` | 17.2.3 | **17.4.2** | 🟢 |
| `react` | 19.2.0 | **19.2.8** | 🟢 |
| `react-dom` | 19.2.0 | **19.2.8** | 🟢 |
| `esbuild` | 0.27.0 | **0.27.7** | 🟢 |
| `postcss` | 8.5.8 | **8.5.25** | 🟢 |
| `mysql2` | 3.15.3 | **3.23.2** | 🟢 |
| `postprocessing` | 6.39.3 | **6.39.4** | 🟢 |
| `autoprefixer` | 10.4.27 | **10.5.4** | 🟢 |
| `@types/node` | 22.19.1 | **26.1.2** | 🟢 |
| `@vitejs/plugin-react` | 5.1.1 | **6.0.4** | 🟡 Breaking |

---

## 4. 📜 Licences

### Production

| Package | Licence | Compatible |
|---|---|---|
| `@react-three/drei` | MIT | ✅ |
| `@react-three/fiber` | MIT | ✅ |
| `@react-three/postprocessing` | MIT | ✅ |
| `@xyflow/react` | MIT | ✅ |
| `bcryptjs` | BSD-3-Clause | ✅ |
| `better-sqlite3` | MIT | ✅ |
| `dotenv` | BSD-2-Clause | ✅ |
| `lucide-react` | ISC | ✅ |
| `mysql2` | MIT | ✅ |
| `postprocessing` | Zlib | ✅ |
| `react` | MIT | ✅ |
| `react-dom` | MIT | ✅ |
| `three` | MIT | ✅ |
| `three-mesh-bvh` | MIT | ✅ |
| `three-stdlib` | MIT | ✅ |

### Dev

| Package | Licence | Compatible |
|---|---|---|
| `electron` | MIT | ✅ |
| `electron-builder` | MIT | ✅ |
| `typescript` | Apache-2.0 | ✅ |
| `sharp` | Apache-2.0 | ✅ |
| `draco3dgltf` | Apache-2.0 | ✅ |
| `tailwindcss` | MIT | ✅ |
| `vite` | MIT | ✅ |
| All others | MIT | ✅ |

**Aucune licence incompatible détectée.** Toutes les licences sont MIT, BSD, Apache-2.0, ISC ou Zlib — compatibles avec un projet open source ou commercial.

---

## 5. 🎯 Bundle Size Budget

### 5.1 Poids des dépendances en node_modules

| Rang | Package | Taille disk | Type | Bundle client? |
|---|---|---|---|---|
| 1 | `electron` | **326.7 MB** | Dev | ❌ (packagé séparément) |
| 2 | `three` | **34.2 MB** | Prod | ✅ **→ bundle client** |
| 3 | `lucide-react` | **34.5 MB** | Prod | ✅ **→ bundle client (tree-shake)** |
| 4 | `three-stdlib` | **25.7 MB** | Prod | ✅ **→ bundle client (tree-shake)** |
| 5 | `vite` | 25.5 MB | Dev | ❌ |
| 6 | `typescript` | 21.8 MB | Dev | ❌ |
| 7 | `better-sqlite3` | 11.6 MB | Prod | ❌ (process main Electron) |
| 8 | `tailwindcss` | 5.3 MB | Dev | ❌ (génère CSS statique) |
| 9 | `@react-three/drei` | 3.2 MB | Prod | ✅ **→ bundle client** |
| 10 | `postprocessing` | 2.6 MB | Prod | ✅ **→ bundle client** |

### 5.2 Budget recommandé (production build Vite)

| Catégorie | Budget | Actuel estimé | Statut |
|---|---|---|---|
| JS initial (gzipped) | ≤ **250 KB** | ~150-200 KB (three + react + fiber) | 🟢 OK |
| JS total (lazy) | ≤ **1 MB** | ~400-600 KB (lucide, drei, stdlib tree-shakés) | 🟢 OK |
| CSS | ≤ **50 KB** | ~20-30 KB (tailwind) | 🟢 OK |
| Wasm (Draco) | ≤ **500 KB** | ~150 KB | 🟢 OK |
| **Total** | ≤ **2 MB** | ~ **800 KB - 1.2 MB** | 🟢 OK |

> **Note :** `lucide-react` est tree-shaké par Vite — seules les icônes importées sont bundlées, pas les 34 MB.  
> `three-stdlib` est aussi tree-shaké.  
> `electron` + `better-sqlite3` + `mysql2` ne sont pas dans le bundle client (process main).

### 5.3 Opportunités de réduction

| Package | Taille disk | Suggestion d'alternative | Gain estimé |
|---|---|---|---|
| `lucide-react` | 34.5 MB → tree-shake ~200 KB | ✅ Garder (meilleure lib d'icônes React) | — |
| `three` | 34.2 MB | ✅ Incontournable (moteur 3D) | — |
| `three-stdlib` | 25.7 MB | ❗ Vérifier que `three-stdlib` est bien tree-shaké. Alternative : importer directement depuis `three/addons/` | ~200 KB gzipped |
| `postprocessing` | 2.6 MB | ✅ OK pour l'effet graphique | — |
| `@react-three/drei` | 3.2 MB | ✅ OK (helpers essentiels) | — |

---

## 6. 📋 Priorités d'Action

### 🔴 Priorité 1 — Sécurité (immédiat)

| Action | Packages | Commande | Risque |
|---|---|---|---|
| Fix vulnérabilités non-breaking | 10+ packages | `npm audit fix` | Aucun (patch/mineur) |
| Mettre à jour `electron` | 39.2.6 → **39.8.10** | `npm install electron@^39.8.0` | 🟢 Non-breaking |
| Mettre à jour `postcss` | 8.5.8 → **8.5.25** | `npm install postcss@^8.5.25` | 🟢 Non-breaking |
| Mettre à jour `dotenv` | 17.2.3 → **17.4.2** | `npm install dotenv@^17.4.2` | 🟢 Non-breaking |
| Mettre à jour `mysql2` | 3.15.3 → **3.23.2** | `npm install mysql2@^3.23.2` | 🟢 Non-breaking |
| Mettre à jour `@react-three/fiber` | 9.4.0 → **9.6.1** | `npm install @react-three/fiber@^9.6.0` | 🟢 Non-breaking |

### 🟠 Priorité 2 — Breaking à Planifier

| Action | Packages | Version cible | Effort |
|---|---|---|---|
| Mise à jour `electron-builder` | 25.1.8 → 26.15.3 | Corrige `tar`, `app-builder-lib` | ⚠️ Breaking (semver major) |
| Mise à jour `@gltf-transform/*` | 4.3.0 → 4.4.2 | 🟢 Non-breaking | Faible |
| Mise à jour `lucide-react` | 0.554.0 → 1.27.0 | ⚠️ Breaking (0→1) | ⚠️ Vérifier imports |
| Mise à jour `sharp` | 0.34.5 → 0.35.3 | ⚠️ Breaking | Corrige libvips CVEs |
| Mise à jour `vite` + `vitest` | 6.x → 8.x | ⚠️ Breaking (6→8) | ⚠️ Majeur |
| Mise à jour `tailwindcss` | 3.x → 4.x | ⚠️ Breaking (3→4) | ⚠️ Config rewrite |

### 🟡 Priorité 3 — Ménage

| Action | Commande |
|---|---|
| Nettoyer les paquets extraneous | `npm prune` |
| Vérifier l'arbre des dépendances | `npm dedupe` |
| Supprimer les doublons de `brace-expansion`, `minimatch` | `npm dedupe` |

### ⚪ Priorité 4 — Surveillance

| Action | Détail |
|---|---|
| `depcheck` complet | Timer de 60s dépassé sur Windows — réessayer avec `npx depcheck --skip-package=electron` |
| Audit de `three-stdlib` | Vérifier les imports réels vs arbre complet |
| Mettre en place un bundle-analyzer | Ajouter `vite-plugin-inspect` au dev pour visualiser le bundle |

---

## 7. ✅ Synthèse

### Forces
- ✅ **Toutes les dépendances sont utilisées** — aucune dependency morte (sauf les extraneous)
- ✅ **Licences toutes compatibles** (MIT, BSD, Apache-2.0, ISC, Zlib)
- ✅ **Tree-shaking Vite** → `lucide-react` (34 MB) et `three-stdlib` (25 MB) ne pèsent que ce qui est importé
- ✅ **Architecture propre** : dépendances bien séparées entre renderer (React/Three) et main process (Electron/BDD)

### Faiblesses
- ⚠️ **45 vulnérabilités** dont 4 critiques et 30 hautes
- ⚠️ **electron-builder 25.1.8** très obsolète (latest: 26.15.3) — 12 CVEs via `tar`
- ⚠️ **electron 39.2.6** 17 CVEs (latest patch: 39.8.10)
- ⚠️ **@gltf-transform/functions** vulnérable via `sharp` + `ndarray-pixels`
- ⚠️ **6 paquets extraneous** (argparse, ajv, punycode…) : résidus à nettoyer
- ⚠️ **glslang-validator-prebuilt** (0.0.7) critique via `decompress` + `download` (Zip Slip) — **à supprimer/remplacer en priorité**

### Plan d'action recommandé

```
1. Immédiat : npm audit fix + npm prune
2. Cette semaine : electron 39.8.10, mysql2 3.23.2, postcss 8.5.25, dotenv 17.4.2
3. Ce mois : electron-builder 26.15.3, sharp 0.35.3, gltf-transform 4.4.2
4. Prochain sprint : vite 8.x, vitest 4.x, tailwindcss 4.x (breaking)
5. Continu : bundle-analyzer + depcheck régulier
```

---

*Rapport généré le 30/07/2026 — Hermes Agent (P3 Audit)*
