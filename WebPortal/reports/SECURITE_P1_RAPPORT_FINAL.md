# 🔒 RAPPORT FINAL SÉCURITÉ — NARVOS PRIME Audit P1
**Projet:** NARVOS PRIME — WebPortal (Electron 39 + MySQL/SQLite)
**Date:** 2026-07-30
**Périmètre:** `electron/main.ts`, `electron/preload.ts`, `electron/database.ts`, `electron/localDatabase.ts`, `src/components/LoginScreen.tsx`, `src/utils/storage.ts`, `src/rpg/persistence/dbStore.ts`, `src/rpg/runtime/admin/AdminPanel.tsx`, `package.json`, `vite.config.ts`

---

## RÉSUMÉ EXÉCUTIF

| Domaine | Statut | Risque |
|---------|--------|--------|
| Secrets hardcodés | ❌ Trouvés | 🟠 P1 |
| Path Traversal (saveImageToDisk) | ❌ Non corrigé | 🔴 P0 |
| Path Traversal (saveJsonData) | ❌ Non corrigé | 🔴 P0 |
| shell.openExternal (pas de validation protocole) | ❌ Non corrigé | 🟠 P1 |
| SQL générique exposé au renderer | ⚠️ Whitelist présente, paramètres non validés | 🟠 P1 |
| FOREIGN_KEY_CHECKS=0 (sans transaction) | ⚠️ Risque intégrité | 🟡 P2 |
| Fallback login (offline toujours OK) | ⚠️ Intentionnel mais documenté | 🟡 P2 |
| Admin via localStorage | ⚠️ Accepté Phase 1 | 🟡 P2 |
| Session en localStorage (pas httpOnly) | ⚠️ | 🟡 P2 |
| CSP production OK, dev désactivé | ✅ Standard | 🔵 P3 |
| XSS (dangerouslySetInnerHTML) | ✅ Aucun trouvé | ✅ Clean |
| CSRF | ✅ N/A (Electron + WS) | ✅ N/A |
| Permissions Electron | ✅ Correctes | ✅ Clean |
| contextIsolation + sandbox | ✅ Activés | ✅ Clean |

---

## 1. VULNÉRABILITÉS CRITIQUES

### 1.1 🔴 P0 — Path Traversal dans `saveImageToDisk`

**Fichier:** `electron/main.ts` (lignes 668-692)

```typescript
ipcMain.handle('app:saveImageToDisk', async (event, folder: string, filename: string, base64Data: string) => {
    const targetDir = path.join(publicPath, folder);   // ❌ folder non validé
    const filePath = path.join(targetDir, filename);    // ❌ filename non validé
    fs.writeFileSync(filePath, buffer);
```

**Risque:** Un attaquant depuis le renderer peut passer `folder = "../../../Windows/System32"` ou `filename = "../../malicious.exe"` et écrire des fichiers arbitraires sur le disque. Aucune validation `path.basename()` ou vérification que le chemin résolu reste dans le répertoire autorisé.

**Correctif recommandé:**
```typescript
ipcMain.handle('app:saveImageToDisk', async (event, folder: string, filename: string, base64Data: string) => {
    // Valider : pas de "..", pas de séparateur absolu
    if (folder.includes('..') || path.isAbsolute(folder)) throw new Error('Dossier non autorisé');
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) throw new Error('Fichier non autorisé');
    const safeFolder = path.basename(folder);
    const safeFilename = path.basename(filename);
    const targetDir = path.join(publicPath, safeFolder);
    const filePath = path.join(targetDir, safeFilename);
    // Vérifier que filePath reste dans publicPath
    if (!filePath.startsWith(path.resolve(publicPath))) throw new Error('Path traversal détecté');
    // ...
```

**Statut:** ❌ NON CORRIGÉ — Risque 🔴 P0

---

### 1.2 🔴 P0 — Path Traversal dans `saveJsonData`

**Fichier:** `electron/main.ts` (lignes 695-710)

Même vulnérabilité que ci-dessus : `filename` vient directement du renderer sans validation.

**Statut:** ❌ NON CORRIGÉ — Risque 🔴 P0

---

### 1.3 🟠 P1 — Hardcoded password hash `'local_dev_pass'`

**Fichier:** `src/utils/storage.ts` (ligne 536)

```typescript
await queryMySQL('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, NOW())', 
    [username, 'local_dev_pass']);  // ❌ Mot de passe hardcodé dans le code source
```

**Risque:** La chaîne `'local_dev_pass'` est insérée comme `password_hash` dans la table `users`. Heureusement, le check `verifyUser` (database.ts:447) vérifie que le hash commence par `$2a$`/`$2b$`/`$2y$` (format bcrypt) et le rejette sinon — donc ce hash ne permet PAS de login. Cependant :
- C'est un secret en clair dans le code source
- Si quelqu'un modifie le check bcrypt, tous les utilisateurs créés via ce chemin deviennent vulnérables
- C'est un anti-pattern documenté dans OWASP

**Correctif recommandé:** Supprimer cette insertion de fallback ou utiliser un hash bcrypt vide (qui ne matchera jamais).

**Statut:** ❌ NON CORRIGÉ — Risque 🟠 P1

---

### 1.4 🟠 P1 — `shell.openExternal` sans validation de protocole

**Fichier:** `electron/main.ts` (ligne 152)

```typescript
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);  // ❌ Pas de whitelist de protocole
    return { action: 'deny' };
});
```

**Risque:** Un lien `javascript:alert(document.cookie)` ou `file:///C:/Windows/System32...` pourrait être ouvert. Electron recommande de whitelister les protocoles `http:` et `https:` (et éventuellement `mailto:`).

**Correctif recommandé:**
```typescript
try {
    const parsed = new URL(url);
    if (['http:', 'https:'].includes(parsed.protocol)) {
        shell.openExternal(url);
    }
} catch { /* URL invalide, ignorer */ }
```

**Statut:** ❌ NON CORRIGÉ — Risque 🟠 P1

---

## 2. VULNÉRABILITÉS MOYENNES

### 2.1 🟡 P2 — Fallback login toujours réussi (offline)

**Fichier:** `src/components/LoginScreen.tsx` (lignes 10-14)

```typescript
const fallbackLogin = async (u: string, p: string) => {
    localStorage.setItem('narvos_user', JSON.stringify({ username: u, role: 'USER' }));
    return { success: true, message: "Mode Démo (Hors-ligne)", role: 'USER' };
};
```

Toute connexion hors-ligne accepte n'importe quel couple username/password. La session est stockée en localStorage avec le rôle `USER`.

**Statut:** ⚠️ INTENTIONNEL (documenté comme « Mode Démo ») — Risque 🟡 P2

---

### 2.2 🟡 P2 — Admin via localStorage

**Fichier:** `src/rpg/runtime/admin/AdminPanel.tsx` (lignes 67-75)

```typescript
export function isAdmin(): boolean {
    if (import.meta.env?.DEV) return true;  // Admin TOUJOURS actif en dev
    return localStorage.getItem("narvos:admin") === "1";  // Flag client-side
}
```

En développement, tout le monde est admin. En production, il suffit d'ouvrir la console DevTools et de taper `localStorage.setItem('narvos:admin', '1')`. Le code note explicitement que c'est temporaire (Phase 1).

**Statut:** ⚠️ ACCEPTÉ Phase 1 — Risque 🟡 P2 (devient 🔴 si pas migré avant release publique)

---

### 2.3 🟡 P2 — Session stockée en localStorage

**Fichier:** `src/components/LoginScreen.tsx` (lignes 24-30)

```typescript
localStorage.setItem('narvos_user', JSON.stringify({
    username: result.user.username,
    playerId: result.user.id.toString(),
    role: result.user.role || 'USER',
    token: 'electron-session'  // Hardcodé !
}));
```

La session (incluant le rôle) est stockée dans `localStorage`. Si une XSS est trouvée, l'attaquant peut voler/modifier la session. Le token est hardcodé à `'electron-session'`.

**Statut:** ⚠️ — Risque 🟡 P2

---

### 2.4 🟡 P2 — `SET FOREIGN_KEY_CHECKS=0` sans transaction englobante

**Fichier:** `electron/main.ts` (lignes 764-769)

```typescript
await worldDatabase.query('SET FOREIGN_KEY_CHECKS = 0', []);
for (const tbl of ['character_settings', ...]) {
    await worldDatabase.query(`DELETE FROM \`${tbl}\``, []).catch(() => {});
}
await worldDatabase.query('SET FOREIGN_KEY_CHECKS = 1', []);
```

Si le processus crashe entre les deux `SET FOREIGN_KEY_CHECKS`, les FK restent désactivées pour les connexions futures du pool. Le bloc `finally` à la ligne 776 tente de restaurer, mais n'est pas atomique.

**Statut:** ⚠️ — Risque 🟡 P2

---

### 2.5 🟡 P2 — SQL générique exposé au renderer (mitigé par whitelist)

**Fichier:** `electron/preload.ts` (lignes 63-64)

```typescript
mysqlQuery: (sql: string, params: any[] = []) =>
    ipcRenderer.invoke('db:mysqlQuery', sql, params),
```

Le canal `db:mysqlQuery` permet d'exécuter du SQL arbitraire depuis le renderer. La whitelist `rejectSqlIfUnsafe()` (main.ts:789-844) bloque les opérations dangereuses (DROP, ALTER, multi-statements) et vérifie que les tables référencées sont dans `ALLOWED_SQL_TABLES`. C'est une bonne protection, mais :
- Les paramètres ne sont pas validés (injection SQL possible si les paramètres viennent du renderer)
- Le renderer-side code (`dbStore.ts`, `storage.ts`) construit du SQL dynamiquement avec des valeurs interpolées
- La whitelist ne couvre pas `DELETE` sans table (ex: `DELETE FROM characters` est autorisé)

**Statut:** ⚠️ PARTIEL — Risque 🟡 P2

---

## 3. PERMISSIONS ELECTRON

### 3.1 ✅ Bonnes pratiques respectées

| Vérification | Valeur | Status |
|-------------|--------|--------|
| `contextIsolation` | `true` | ✅ |
| `nodeIntegration` | `false` | ✅ |
| `sandbox` | `true` | ✅ |
| `webSecurity` | `true` | ✅ |
| `allowRunningInsecureContent` | `false` | ✅ |
| CSP production | Appliqué (script-src, style-src...) | ✅ |
| `will-navigate` (blocage origines externes) | Présent | ✅ |
| IPC `on()` channel whitelist | Présent (preload.ts:74) | ✅ |
| `app:getPath` validation | ❌ Aucune (`app.getPath(name as any)`) | 🟡 |

### 3.2 🟡 Améliorations recommandées

- `app:getPath` (main.ts:259) : `app.getPath(name as any)` accepte n'importe quelle string — devrait être whitelisté (`['userData', 'desktop', 'documents']`)
- Pas de `requestedExecutionLevel` dans `electron-builder` → par défaut `asInvoker` (OK mais à documenter)
- Pas de `hardenedRuntime` pour macOS
- Le double bridge (`electronAPI` + `narvosLauncher`) est un risque de divergence de sécurité

---

## 4. XSS / CSRF / INJECTION

### 4.1 XSS: ✅ Aucun vecteur trouvé

- Aucun `dangerouslySetInnerHTML` détecté
- Aucun `innerHTML` direct hors node_modules
- React JSX auto-escape les `{expression}` → safe
- Les inputs formulaire (`LoginScreen.tsx`) utilisent `useState` React → safe

### 4.2 CSRF: ✅ Non applicable

- Pas de formulaires HTTP traditionnels
- Authentification via IPC Electron (local) ou WebSocket
- Pas de cookies de session (session en localStorage)

### 4.3 SQL Injection: ⚠️ Partiellement protégé

- Les requêtes préparées sont utilisées côté main process (`pool.execute(sql, params)`)
- La whitelist `rejectSqlIfUnsafe()` bloque les injections multi-statements
- Cependant, le code renderer (`storage.ts`) construit du SQL dynamiquement

---

## 5. SECRETS MANAGEMENT

### 5.1 ✅ Secrets bien gérés

- `DATABASE_URL` chargé depuis `.env` via `dotenv`
- Aucune clé API hardcodée dans le bundle client (vite.config.ts:21-23 le documente)
- `.env` pas trouvé dans le repo (probablement `.gitignore`)

### 5.2 ❌ Secrets problématiques

- `'local_dev_pass'` dans `storage.ts:536` — mot de passe en clair
- `'electron-session'` dans `LoginScreen.tsx:28` — token statique

---

## 6. MATRICE DE CORRECTION

| # | Priorité | Risque | Correctif | Effort | Statut |
|---|----------|--------|-----------|--------|--------|
| 1 | 🔴 P0 | Path traversal saveImageToDisk | Ajouter validation path.basename + bounds check | 2h | ❌ |
| 2 | 🔴 P0 | Path traversal saveJsonData | Ajouter validation basename | 30min | ❌ |
| 3 | 🟠 P1 | shell.openExternal sans whitelist | Ajouter check protocole http:/https: | 15min | ❌ |
| 4 | 🟠 P1 | Hardcoded password fallback | Supprimer ou remplacer par hash invalide | 15min | ❌ |
| 5 | 🟡 P2 | FK checks sans transaction | Envelopper dans START TRANSACTION/COMMIT | 30min | ⚠️ |
| 6 | 🟡 P2 | Admin localStorage | Migrer vers RBAC serveur (Jalon #2) | 1j | ⚠️ |
| 7 | 🟡 P2 | Session localStorage | Migrer vers token httpOnly ou IPC sécurisé | 2j | ⚠️ |
| 8 | 🔵 P3 | app:getPath sans validation | Ajouter whitelist | 15min | ❌ |
| 9 | 🔵 P3 | Pas de rate limiting login | Ajouter throttle sur db:verifyUser | 1h | ❌ |
| 10 | 🔵 P3 | Supprimer double bridge narvosLauncher | Migrer vers electronAPI uniquement | 2h | ⚠️ |

---

## 7. STATISTIQUES

| Métrique | Valeur |
|----------|--------|
| Fichiers audités | 11 |
| Vulnérabilités critiques (P0) | 2 |
| Vulnérabilités élevées (P1) | 2 |
| Vulnérabilités moyennes (P2) | 5 |
| Vulnérabilités faibles (P3) | 4 |
| Vecteurs XSS trouvés | 0 |
| Secrets hardcodés trouvés | 2 (`local_dev_pass`, `electron-session`) |

---

## 8. CONCLUSION

**Niveau de risque global:** 🟠 **ÉLEVÉ**

Le noyau Electron est correctement configuré (contextIsolation, sandbox, nodeIntegration=false, CSP). Les faiblesses critiques concernent les **path traversals** dans `saveImageToDisk` et `saveJsonData` — faciles à corriger (quelques lignes de validation). Le `shell.openExternal` sans whitelist est un oubli classique également rapide à fixer. Le hardcoded password `local_dev_pass` est atténué par le check bcrypt mais doit être supprimé.

La dette technique principale est le **stockage de session en localStorage** et **l'admin via flag client-side** — ces deux points sont acceptables pour une Phase 1/démo mais devront être migrés vers une authentification serveur robuste (RBAC, JWT httpOnly) avant toute release publique.

**Recommandation prioritaire:** Corriger les 4 vulnérabilités P0/P1 (path traversals ×2, shell.openExternal, hardcoded password) — effort estimé < 3h.
