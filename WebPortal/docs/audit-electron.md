# AUDIT ÉLECTRON — NARVOS PRIME Web Portal

**Date** : 2026-07-29  
**Périmètre** : `electron/main.ts`, `electron/preload.ts`, `package.json`, `scripts/build-electron.js`, `vite.config.ts`  
**Profil de risque** : **ÉLEVÉ** (plusieurs failles critiques)

---

## RÉSUMÉ EXÉCUTIF

| Domaine | Statut | Risque |
|---------|--------|--------|
| nodeIntegration | `false` ✅ | OK |
| contextIsolation | `true` ✅ | OK |
| Preload API surface | Très large ⚠️ | ÉLEVÉ |
| shell.openExternal | Appel sans validation de protocole ⚠️ | HAUT |
| IPC — Validation entrées | Absente sur canaux critiques ❌ | CRITIQUE |
| db:mysqlQuery (SQL brut) | Exposé au renderer ❌ | CRITIQUE |
| app:saveImageToDisk | Path traversal possible ⚠️ | HAUT |
| Auto-updates | NON configurés ❌ | MOYEN |
| CSP | Présente en prod, absente en dev ✅/⚠️ | MOYEN |
| Build config | Complète, multi-plateforme ✅ | OK |

---

## 1. CONFIGURATION DE SÉCURITÉ GLOBALE ✅

### Points positifs

| Paramètre | Valeur | Statut |
|-----------|--------|--------|
| `nodeIntegration` | `false` | ✅ |
| `contextIsolation` | `true` | ✅ |
| `sandbox` | `false` (volontaire : loaders Three.js) | ⚠️ documenté |
| `webSecurity` | `true` | ✅ |
| `allowRunningInsecureContent` | `false` | ✅ |
| `setWindowOpenHandler` | `{ action: 'deny' }` | ✅ |
| `will-navigate` | Bloque les origines non locales | ✅ |
| CSP (prod) | restrictive + `wasm-unsafe-eval` | ✅ |
| Renderer crash recovery | `render-process-gone` → recréation | ✅ |
| Admin gate | TTL 5 min pour opérations sensibles | ✅ |

### ⚠️ Note : sandbox=false

Le sandbox est désactivé (`sandbox: false`, main.ts:90) pour les loaders Three.js (Draco, Basis — nécessitent WebAssembly). Cela signifie que le renderer a plus de capacités système en cas de compromission. La décision est justifiée par les besoins techniques (GLB chunks ~428 MB), mais la surface d'attaque est plus grande.

---

## 2. PRELOAD SCRIPT — API EXPOSÉES

### Bridge `window.electronAPI` (21 méthodes)

```typescript
getVersion()          // IPC: app:getVersion
getPath(name)         // IPC: app:getPath        ← ARBITRAIRE
quit()                // IPC: app:quit
platform, isDev       // Variables statiques
initDatabase()        // IPC: db:init
saveSceneToDatabase() // IPC: db:saveScene
loadSceneFromDatabase()// IPC: db:loadScene
deleteSceneFromDatabase()// IPC: db:deleteScene
hasSaveInDatabase()   // IPC: db:hasSave
getAllSavesFromDatabase()// IPC: db:getAllSaves
cleanDatabase()       // IPC: db:cleanDatabase    ← PROTÉGÉ (admin)
saveBackupToDatabase()// IPC: db:saveBackup
getBackupsFromDatabase()// IPC: db:getBackups
loadBackupFromDatabase()// IPC: db:loadBackup
deleteBackupFromDatabase()// IPC: db:deleteBackup
deletePlanetSaves()   // IPC: db:deletePlanetSaves
verifyUser()          // IPC: db:verifyUser       ← mot de passe en clair
getCharacters()       // IPC: db:getCharacters
createCharacter()     // IPC: db:createCharacter
saveImageToDisk()     // IPC: app:saveImageToDisk ← PATH TRAVERSAL
on(channel, callback) // canaux filtrés ✅
sendFlushDone()       // IPC: app:flush-done
```

### Bridge `window.narvosLauncher` (7 méthodes — LEGACY)

```typescript
isElectron: true
mysqlQuery(sql, params)    // IPC: db:mysqlQuery ← CRITIQUE
saveImageToDisk(...)       // Dupliqué
getCharacters(...)         // Dupliqué
createCharacter(...)       // Dupliqué
deleteCharacter(...)       // Dupliqué
deleteAllCharacters()      // Dupliqué, PROTÉGÉ (admin)
verifyUser(...)            // Dupliqué
```

### ⚠️ Problème : double bridge

Fonctionnalités **dupliquées** entre `electronAPI` et `narvosLauncher`. Cela double la surface d'attaque et complique la maintenance. Le bridge `narvosLauncher` semble être un vestige à migrer.

### ✅ Bon point : filtrage des canaux d'écoute

```typescript
const validChannels = ['show-about', 'update-available', 'app:flush-before-quit'];
```

Les canaux d'écoute `on()` sont filtrés. Le canal `update-available` est déclaré mais jamais utilisé.

---

## 3. RISQUES DE SÉCURITÉ

### 🔴 CRITIQUE : `db:mysqlQuery` — Exécution SQL arbitraire

**Fichier** : `main.ts:755-768`  
**Canal** : `db:mysqlQuery(sql, params)`

```typescript
ipcMain.handle('db:mysqlQuery', async (_event, sql: string, params: any[]) => {
  const result = await worldDatabase.query(sql, params);
  return { data: result };
});
```

Exposé au renderer via `window.narvosLauncher.mysqlQuery()`.

**Risque** : Si le renderer est compromis (XSS, malveillance dans un GLB, extension tierce), l'attaquant peut exécuter **n'importe quelle requête SQL** — SELECT, DROP TABLE, DELETE, GRANT, etc.

**Exploitation** :
```javascript
// Depuis le renderer compromise :
narvosLauncher.mysqlQuery("DROP TABLE scene_saves", []);
narvosLauncher.mysqlQuery("SELECT load_extension('/tmp/evil.so')", []);
```

**Correctif** :
1. Remplacer `db:mysqlQuery` par des handlers IPC spécifiques pour chaque opération métier.
2. Si un pont SQL générique est vraiment nécessaire, limiter les privilèges de la connexion DB (CREATE/READ-only sur des tables précises) et/ou restreindre les requêtes autorisées avec une whitelist (regex de commandes SELECT/INSERT/UPDATE uniquement).

---

### 🔴 CRITIQUE : `app:getPath` — Exposition de chemins système arbitraires

**Fichier** : `main.ts:249-251`  
**Canal** : `app:getPath(name)`

```typescript
ipcMain.handle('app:getPath', (event, name: string) => {
  return app.getPath(name as any);
});
```

**Risque** : Un renderer compromis peut interroger n'importe quel chemin géré par Electron (`home`, `userData`, `temp`, `exe`, `desktop`, `documents`, `downloads`, `crashDumps`, etc.), ce qui leak des informations sensibles sur le système de l'utilisateur.

**Correctif** : Valider `name` contre une whitelist :
```typescript
const ALLOWED_PATHS = ['userData', 'home', 'temp'];
if (!ALLOWED_PATHS.includes(name)) throw new Error('Chemin non autorisé');
```

---

### 🟠 HAUT : `shell.openExternal` — Aucune validation de protocole

**Fichier** : `main.ts:140-144, 147-155`

```typescript
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
  shell.openExternal(url);   // ← n'importe quelle URL
  return { action: 'deny' };
});
```

**Risque** : `shell.openExternal` URL sans restriction de protocole. Bien qu'Electron filtre `javascript:` dans les versions récentes, des protocoles comme `file://`, `ftp://`, ou des protocoles OS custom (`steam://`, `slack://`, etc.) pourraient être exploités.

**Correctif** : Ajouter une validation de protocole :
```typescript
const parsed = new URL(url);
if (!['http:', 'https:'].includes(parsed.protocol)) return;
shell.openExternal(url);
```

---

### 🟠 HAUT : `app:saveImageToDisk` — Path traversal possible (Directory Traversal)

**Fichier** : `main.ts:658-682`

```typescript
const targetDir = path.join(publicPath, folder);  // folder = renderer-controlled
const filePath = path.join(targetDir, filename);   // filename = renderer-controlled
fs.writeFileSync(filePath, buffer);
```

**Risque** : Le renderer peut fournir `folder = "../../../evil"` et `filename = "malicious.exe"` pour écrire hors du répertoire prévu.

**Correctif** : Sanitiser `folder` et `filename` :
```typescript
const safeFolder = path.basename(folder);                    // supprime les ..
if (!/^[\w\-. ]+$/.test(safeFolder)) throw new Error('Nom de dossier invalide');
if (!/^[\w\-. ]+$/.test(filename)) throw new Error('Nom de fichier invalide');
```

---

### 🟡 MOYEN : `db:verifyUser` / `admin:verify` — Mots de passe en clair dans IPC

**Fichier** : `main.ts:369, 593`

**Risque** : Les mots de passe transitent via IPC en clair. Bien que ce soit inter-processus local (pas de réseau), les mots de passe apparaissent dans l'objet `event`, les logs console, et les devtools. Un renderer compromis peut intercepter les credentials des autres utilisateurs.

**Correctif** : 
1. Hacher le mot de passe côté renderer (SHA-256 côté client) avant envoi, et comparer le hash côté serveur.
2. S'assurer que les mots de passe ne sont jamais loggés.
3. Pour `admin:verify`, utiliser un token temporaire ou une session.

---

### 🟡 MOYEN : `db:deleteAllCharacters` — `FOREIGN_KEY_CHECKS=0` dangereux

**Fichier** : `main.ts:736-741`

```typescript
await worldDatabase.query('SET FOREIGN_KEY_CHECKS = 0', []);
// tables delete…
await worldDatabase.query('SET FOREIGN_KEY_CHECKS = 1', []);
```

**Risque** : Si une exception survient entre les deux `SET FOREIGN_KEY_CHECKS`, les FK restent désactivées (le `finally` tente de les réactiver, mais une erreur dans le cleanup pourrait les laisser désactivées). Une transaction SQL serait plus sûre.

**Correctif** : Utiliser une transaction SQL explicite :
```typescript
await worldDatabase.query('START TRANSACTION', []);
try { /* deletes */ await worldDatabase.query('COMMIT', []); }
catch (e) { await worldDatabase.query('ROLLBACK', []); throw e; }
```

---

### 🟡 MOYEN : Auto-updates non configurés

**Fichier** : `main.ts:839-842`

```typescript
// app.on('ready', () => {
//   // Initialiser les mises à jour automatiques
// });
```

**Risque** : Les utilisateurs ne recevront jamais de mises à jour automatiques. En production, les correctifs de sécurité ne seront pas déployés. Le canal `update-available` est déclaré dans preload.ts mais jamais utilisé.

**Correctif** : 
1. Ajouter `electron-updater` aux dépendances.
2. Configurer `publish` dans `package.json` (GitHub Releases, S3, etc.).
3. Implémenter la logique d'update check au démarrage.

---

### 🟢 BAS : Legacy `electron-main.cjs` à la racine

**Fichier** : `D:\mes_projet\narvosprime-web-prototype\WebPortal\electron-main.cjs`

Ancienne config sur port 5173, plus utilisée. Supprimer pour éviter la confusion.

---

### 🟢 BAS : Double surface d'attaque (deux bridges)

**Risque** : Fonctionnalités dupliquées entre `electronAPI` et `narvosLauncher`. Si une modification de sécurité est appliquée à l'un mais pas à l'autre, le maillon faible persiste.

**Correctif** : Unifier les deux bridges en un seul (`electronAPI`), supprimer `narvosLauncher` après migration complète du code client (`storage.ts`, `dbStore.ts`).

---

## 4. CANAUX IPC — INVENTAIRE COMPLET

| Canal | Direction | Paramètres | Validation | Risque |
|-------|-----------|------------|------------|--------|
| `app:getVersion` | ← renderer | rien | — | ✅ OK |
| `app:getPath` | ← renderer | `name: string` | ❌ aucune | 🔴 CRITIQUE |
| `app:quit` | ← renderer | rien | — | ✅ OK |
| `app:saveImageToDisk` | ← renderer | `folder, filename, base64` | ❌ path traversal | 🟠 HAUT |
| `app:flush-before-quit` | → renderer | rien | — | ✅ OK |
| `app:flush-done` | ← renderer | rien | — | ✅ OK |
| `db:init` | ← renderer | rien | — | ✅ OK |
| `db:saveScene` | ← renderer | objets scène | ❌ non typée | 🟡 MOYEN |
| `db:loadScene` | ← renderer | planetId, sceneMode | ❌ string libre | 🟢 BAS |
| `db:deleteScene` | ← renderer | planetId, sceneMode | ❌ string libre | 🟢 BAS |
| `db:hasSave` | ← renderer | planetId, sceneMode | ❌ string libre | 🟢 BAS |
| `db:getAllSaves` | ← renderer | rien | — | ✅ OK |
| `db:verifyUser` | ← renderer | username, **password** | ❌ clair | 🟡 MOYEN |
| `db:getCharacters` | ← renderer | username, serverId | ❌ string libre | 🟢 BAS |
| `db:createCharacter` | ← renderer | username, serverId, data | ❌ non typée | 🟢 BAS |
| `db:deleteCharacter` | ← renderer | characterId, username | ❌ string libre | 🟢 BAS |
| `db:deleteAllCharacters` | ← renderer | rien (admin gate) | — | 🟡 MOYEN |
| `db:mysqlQuery` | ← renderer | **sql, params** | ❌ AUCUNE | 🔴 CRITIQUE |
| `db:cleanDatabase` | ← renderer | rien (admin gate) | — | 🟡 MOYEN |
| `db:saveBackup` | ← renderer | objets scène + name | ❌ non typée | 🟢 BAS |
| `db:getBackups` | ← renderer | planetId, sceneMode | ❌ string libre | 🟢 BAS |
| `db:loadBackup` | ← renderer | backupId: number | ✅ typé | 🟢 BAS |
| `db:deleteBackup` | ← renderer | backupId: number | ✅ typé | 🟢 BAS |
| `db:deletePlanetSaves` | ← renderer | planetId: string | ❌ string libre | 🟢 BAS |
| `admin:verify` | ← renderer | username, **password** | ❌ clair | 🟡 MOYEN |
| `show-about` | → renderer | rien | — | ✅ OK |

---

## 5. BUILD CONFIG (electron-builder)

### Configuration actuelle (package.json)

| Option | Valeur | Commentaire |
|--------|--------|-------------|
| `appId` | `com.narvosprime.app` | ✅ OK |
| Output | `release/` | ✅ OK |
| Files included | `dist/**/*`, `dist-electron/**/*.cjs`, `dist-electron/**/*.cjs.map`, `package.json` | ✅ |
| Win | NSIS, x64 | ✅ |
| Mac | DMG, x64 + arm64 | ✅ |
| Linux | AppImage + deb | ✅ |
| NSIS oneClick | `false` ✅ | Permet de choisir le dossier |
| NSIS allowToChangeDir | `true` | ✅ |
| Icon | `build/icon.ico` / `.icns` / `.png` | Vérifier que ces fichiers existent |
| `electron:build` | `clean → build → rebuild → build:ts → electron-builder` | ✅ |
| `postinstall` | `electron-builder install-app-deps` | ✅ rebuild natif auto |

### ⚠️ Points à vérifier
- Fichiers d'icônes dans `build/` : `icon.ico`, `icon.icns`, `icon.png` — non vérifiés, à confirmer.
- Pas de `asar: true` explicite (par défaut `true` dans electron-builder, donc OK).
- Pas de `extraResources` ou `extraFiles` — si besoin de ressources natives supplémentaires plus tard.
- Pas de configuration `publish` pour auto-update.

---

## 6. SCRIPTS NPM — ÉTAT DE FONCTIONNEMENT

| Script | Commande | État probable |
|--------|----------|---------------|
| `electron:dev` | `electron:rebuild && start` | ⏳ dépend de `better-sqlite3` rebuild |
| `electron:build` | `clean && build && rebuild && build:ts && electron-builder` | ⏳ nécessite outils natifs |
| `electron:pack` | same + `--dir` | ⏳ |
| `electron:build:ts` | `node scripts/build-electron.js` | ✅ esbuild |
| `electron:rebuild` | `@electron/rebuild -f -w better-sqlite3` | ⏳ dépend du compilateur C++ |
| `postinstall` | `electron-builder install-app-deps` | ✅ |

**⚠️ Dépendance native** : `better-sqlite3` nécessite un compilateur C++ (node-gyp / build tools). Sur Windows, vérifier que `windows-build-tools` ou Visual Studio Build Tools est installé. Le script `electron:rebuild` recompile `better-sqlite3` spécifiquement pour l'architecture Electron (ex: 39.x).

---

## 7. MATRICE DES CORRECTIFS PRIORISÉS

| # | Priorité | Risque | Correctif | Effort |
|---|----------|--------|-----------|--------|
| 1 | 🔴 IMMÉDIAT | `db:mysqlQuery` SQL brut au renderer | Remplacer par handlers métier spécifiques ; ou restreindre à SELECT avec whitelist | 2-3j |
| 2 | 🔴 IMMÉDIAT | `app:getPath` noms arbitraires | Whitelist des chemins autorisés | 1h |
| 3 | 🟠 URGENT | `shell.openExternal` protocole libre | Valider protocole (https:// seulement) | 30min |
| 4 | 🟠 URGENT | `app:saveImageToDisk` path traversal | Sanitiser folder/filename + path.basename | 1h |
| 5 | 🟡 MOYEN | Mots de passe en clair dans IPC | Hachage SHA-256 côté renderer avant envoi | 1j |
| 6 | 🟡 MOYEN | `FOREIGN_KEY_CHECKS=0` non transactionnel | Wrapper en START TRANSACTION/COMMIT/ROLLBACK | 2h |
| 7 | 🟡 MOYEN | Auto-updates absents | Ajouter electron-updater + config publish | 1j |
| 8 | 🟢 BAS | Legacy `electron-main.cjs` racine | Supprimer | 5min |
| 9 | 🟢 BAS | Double bridge electronAPI/narvosLauncher | Fusionner dans electronAPI, migrer code client | 2j |
| 10 | 🟢 BAS | Fichier `electron/electron-env.d.ts` manquant | Créer avec déclarations de type | 1h |

---

## 8. CONCLUSION

L'intégration Electron de Narvos Prime a **de bonnes fondations** : `contextIsolation: true`, `nodeIntegration: false`, CSP en production, protection `will-navigate`, et un gate admin pour les opérations destructrices.

Cependant, **deux failles critiques** (`db:mysqlQuery` SQL brut exposé au renderer et `app:getPath` sans whitelist) annulent une grande partie de ces protections. En cas de compromission du renderer (XSS, GLB malveillant, extension), l'attaquant a un **accès complet à la base de données** et peut **lire des chemins système sensibles**.

La priorité absolue est de :
1. **Remplacer ou restreindre drastiquement** `db:mysqlQuery` par des handlers IPC métier
2. **Protéger `app:getPath`** avec une whitelist
3. **Valider les protocoles** de `shell.openExternal`
4. **Sanitiser les chemins** de `app:saveImageToDisk`

Une fois ces 4 correctifs appliqués, le profil de sécurité passe de **ÉLEVÉ** à **MOYEN-BAS**, ce qui est acceptable pour une application Electron avec des besoins 3D lourds.