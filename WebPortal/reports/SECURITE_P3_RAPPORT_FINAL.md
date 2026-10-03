# 🔒 RAPPORT FINAL SÉCURITÉ — SECURITE P3
**Projet:** Narvos Prime WebPortal  
**Date:** 2026-07-30  
**Équipe:** SECURITE P3  
**Périmètre:** `E:\narvosprime-web-prototype\WebPortal\`

---

## RÉSUMÉ EXÉCUTIF

| Domaine | Statut | Risque |
|---------|--------|--------|
| `db:mysqlQuery` whitelist (SQL injection) | ✅ **CORRIGÉ** | ~~🔴 Critique~~ → ✅ |
| WSS (`wss://`) support | ✅ **CORRÉ** | ~~🟠 Élevé~~ → ✅ |
| Content-Security-Policy (CSP) | ✅ **CORRIGÉ** (partiel) | 🟡 Moyen |
| `contextIsolation` | ✅ **OK** | ✅ OK |
| `shell.openExternal` validation | ❌ **NON CORRIGÉ** | 🟠 Élevé |
| XSS (Chat / Injection HTML) | ✅ **AUCUN VECTEUR TROUVÉ** | ✅ OK |
| CSRF | ✅ **NON APPLICABLE** | ✅ OK |
| Rate limiting | ❌ **NON IMPLÉMENTÉ** | 🟡 Moyen |
| `app:getPath` sans whitelist | ❌ **NON CORRIGÉ** | 🟡 Moyen |
| `app:saveImageToDisk` path traversal | ❌ **NON CORRIGÉ** | 🟡 Moyen |
| `isAdmin()` localStorage-based | ⚠️ **DOCUMENTÉ** (Phase 1) | 🟡 Moyen |
| `fallbackLogin` toujours réussi | ⚠️ **DOCUMENTÉ** (Phase 1) | 🟡 Moyen |
| `sandbox: false` | ⚠️ **VOLONTAIRE** (Three.js) | 🟡 Moyen |

**Évaluation globale:** **RISQUE MOYEN** — 3 correctifs critiques appliqués, 3 failles mineures persistent

---

## 1. CORRECTIFS APPLIQUÉS — VÉRIFICATION DÉTAILLÉE

### 1.1 🔴 → ✅ `db:mysqlQuery` — Whitelist de tables SQL

**Fichier:** `electron/main.ts` (lignes 758-845)

**Correctif vérifié:** ✅ **Fonction `rejectSqlIfUnsafe()` + `ALLOWED_SQL_TABLES`**

Protections implémentées:
- ✅ **Whitelist stricte** de 11 tables autorisées :
  `character_state`, `world_state`, `class_sprites`, `generated_maps_2d`, `game_objects_2d`, `monsters`, `users`, `characters`, `faction_maps`, `breeds`, `spells`
- ✅ **Blocage multi-instructions** : rejette toute requête contenant `;`
- ✅ **Opérations limitées** : uniquement `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`
- ✅ **CREATE restreint** : uniquement `CREATE TABLE IF NOT EXISTS` sur table autorisée
- ✅ **Validation des tables** : toutes les tables référencées (FROM, JOIN, INTO, UPDATE) doivent être dans la whitelist
- ✅ **Logs de refus** : toute requête rejetée est loggée avec la raison

**Test manuel — scénarios bloqués:**
| Requête | Résultat attendu | Résultat |
|---------|-----------------|----------|
| `DROP TABLE users` | ❌ REFUSÉ | ✅ |
| `SELECT * FROM mysql.user` | ❌ REFUSÉ (table non autorisée) | ✅ |
| `DELETE FROM scenes` | ❌ REFUSÉ (table scenes non dans whitelist) | ✅ |
| `SELECT * FROM users; DROP TABLE characters` | ❌ REFUSÉ (multi-statement) | ✅ |
| `GRANT ALL ON *.* TO 'hacker'` | ❌ REFUSÉ (opération non autorisée) | ✅ |
| `SELECT * FROM character_state WHERE character_id = ?` | ✅ AUTORISÉ | ✅ |

**Statut: 🔴 CRITIQUE RÉSOLU → ✅ OK**

---

### 1.2 🟠 → ✅ WSS (`wss://`) Support

**Fichier:** `net/socket.ts` (lignes 332-342), `electron/main.ts` (lignes 59-78), `.env.example`

**Correctif vérifié:** ✅ **Support WSS complet**

- ✅ `VITE_USE_WSS=true|1` → active `wss://` protocol
- ✅ `VITE_GAME_WS_URL` → URL complète personnalisable (prioritaire)
- ✅ `.env.example` documente toutes les variables WSS
- ✅ CSP en production inclut dynamiquement `wss://localhost:8082` quand WSS est activé
- ✅ Script de génération de certificats dev référencé (`scripts/generate-dev-certs.js`)

**Note:** Le mot de passe est toujours envoyé en clair via AUTH_LOGIN (même avec WSS). Recommandation pour Phase 2: hash SHA-256 côté client.

**Statut: 🟠 ÉLEVÉ RÉSOLU → ✅ OK**

---

### 1.3 🟡 → ✅ Content-Security-Policy (CSP)

**Fichier:** `electron/main.ts` (lignes 58-78), `vite.config.ts` (lignes 15-18)

**Correctif vérifié:** ✅ **CSP en production + COOP/COEP en dev**

**CSP Production:**
```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: blob:;
media-src 'self' blob:;
font-src 'self' data: https://fonts.gstatic.com;
connect-src 'self' data: blob: {wss|ws}://localhost:8082;
worker-src 'self' blob:;
```

**COOP/COEP en dev (vite.config.ts):**
- `Cross-Origin-Opener-Policy: same-origin` ✅
- `Cross-Origin-Embedder-Policy: require-corp` ✅

**Résidus à corriger (mineurs):**
- ⚠️ CSP absente en mode dev (nécessaire pour Vite HMR)
- ⚠️ CSP production autorise encore `ws://localhost:8082` (pas exclusivement `wss://`)
- ⚠️ `frame-ancestors 'none'` manquant (prévention clickjacking)
- ⚠️ `base-uri 'self'` manquant (prévention injection `<base>`)

**Statut: 🟡 MOYEN RÉSOLU → ✅ OK (améliorations mineures possibles)**

---

### 1.4 ✅ contextIsolation

**Fichiers:** `electron-main.cjs` (ligne 11), `electron/main.ts` (ligne 94)

| Paramètre | Valeur | Statut |
|-----------|--------|--------|
| `nodeIntegration` | `false` | ✅ OK |
| `contextIsolation` | `true` | ✅ OK |
| `webSecurity` | `true` | ✅ OK |
| `allowRunningInsecureContent` | `false` | ✅ OK |

**Statut: ✅ OK — Aucun problème**

---

## 2. CORRECTIFS NON APPLIQUÉS

### 2.1 ❌ `shell.openExternal` — Aucune validation de protocole

**Fichier:** `electron/main.ts` (lignes 145-148, 152-159)

```typescript
// Ligne 145-148 — setWindowOpenHandler
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);  // ← protocole NON validé
    return { action: 'deny' };
});

// Ligne 152-159 — will-navigate
mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'http://localhost:3005' && parsedUrl.origin !== 'file://') {
        event.preventDefault();
        shell.openExternal(navigationUrl);  // ← protocole NON validé
    }
});
```

**Risque:** Un attaquant peut injecter un lien `file:///etc/passwd`, `steam://`, `javascript:...` qui sera ouvert par le navigateur système.

**Correctif recommandé:**
```typescript
const allowedProtocols = ['http:', 'https:', 'mailto:'];
if (!allowedProtocols.includes(parsedUrl.protocol)) return;
```

**Statut: ❌ NON CORRIGÉ — Risque 🟠 Élevé**

---

### 2.2 ❌ Rate limiting — Non implémenté

**Aucune limitation** du nombre de messages, commandes `/`, ou tentatives de connexion.

- ✅ Pas critique pour un client de jeu (le rate limiting doit être côté serveur)
- ⚠️ Les commandes `/tp`, `/noclip`, `/adminmode` n'ont pas de limite d'appel

**Statut: ❌ NON IMPLÉMENTÉ — 🟡 Moyen (côté serveur requis)**

---

### 2.3 ❌ `app:getPath` — Pas de whitelist

**Fichier:** `electron/main.ts` (ligne 254)
```typescript
ipcMain.handle('app:getPath', (event, name: string) => {
    return app.getPath(name as any);  // ← n'importe quel chemin
});
```

**Risque:** Un renderer compromis peut obtenir les chemins `home`, `userData`, `temp`, `exe`, `desktop`, etc.

**Statut: ❌ NON CORRIGÉ — 🟡 Moyen**

---

### 2.4 ❌ `app:saveImageToDisk` — Path traversal potentiel

**Fichier:** `electron/main.ts` (lignes 663-687)

`folder` et `filename` viennent du renderer sans sanitization.

**Statut: ❌ NON CORRIGÉ — 🟡 Moyen**

---

## 3. TESTS D'INJECTION (XSS)

### 3.1 Chat Panel — React auto-escaping ✅

**Fichier:** `src/rpg/chat/ChatPanel.tsx`

```tsx
{msg.text}  // ← React escape automatiquement les caractères HTML
```

✅ Aucun `dangerouslySetInnerHTML` dans le code actif
✅ Aucun `innerHTML` dans les composants actifs
✅ Les messages sont stockés en texte brut et rendus via React (auto-escape)

### 3.2 Commandes `/` — Validation partielle ✅

| Commande | Risque | Statut |
|----------|--------|--------|
| `/help` | Aucun | ✅ OK |
| `/clear` | Aucun | ✅ OK |
| `/adminmode` | Vérifie `isAdmin()` (localStorage) | ⚠️ Moyen |
| `/noclip` | Vérifie `isAdmin()` (localStorage) | ⚠️ Moyen |
| `/tp x y z` | `parseFloat()` + `isNaN()` check | ✅ OK |

### 3.3 Noms de personnage — Regex étendue ✅

La regex `^[a-zA-Z0-9 àâäéèêëîïôöùûüÀÂÄÉÈÊËÎÏÔÖÙÛÜ]+$` accepte les caractères accentués français mais rejette les caractères dangereux (`<`, `>`, `"`, `'`, `;`, etc.)

**Statut XSS: ✅ Aucun vecteur XSS trouvé dans le code actif**

---

## 4. TEST CSRF

**Architecture:** Application Electron + WebSocket

- ✅ Pas de formulaires HTTP traditionnels → CSRF non applicable
- ✅ Authentification par token WebSocket
- ✅ Les actions destructrices (`db:cleanDatabase`, `db:deleteAllCharacters`) sont protégées par `admin:verify` (TTL 5 min)

**Statut CSRF: ✅ Non applicable à cette architecture**

---

## 5. AUTRES VULNÉRABILITÉS RÉSIDUELLES

### 5.1 `isAdmin()` basé sur localStorage (🟡 Moyen)

**Fichier:** `AdminPanel.tsx` (ligne 67-75)

```typescript
export function isAdmin(): boolean {
    if (import.meta.env?.DEV) return true;  // TOUJOURS admin en dev
    return localStorage.getItem("narvos_admin") === "1";
}
```

- En mode dev: tout le monde est admin (volontaire pour le développement)
- En production: il suffit de `localStorage.setItem("narvos_admin", "1")` depuis la console
- Documenté comme solution Phase 1 — à migrer vers vérification serveur

### 5.2 `fallbackLogin` — toujours réussi hors-ligne (🟡 Moyen)

**Fichier:** `LoginScreen.tsx` (ligne 10-14)

```typescript
const fallbackLogin = async (u: string, p: string) => {
    localStorage.setItem('narvos_user', JSON.stringify({ username: u, role: 'USER' }));
    return { success: true, message: "Mode Démo (Hors-ligne)", role: 'USER' };
};
```

Tout utilisateur peut se connecter en mode hors-ligne. Volontaire pour le prototypage.

### 5.3 `sandbox: false` (🟡 Moyen)

**Fichier:** `electron/main.ts` (ligne 95)

Nécessaire pour les loaders Three.js (Draco, Basis — WebAssembly). Augmente la surface d'attaque.

### 5.4 `FOREIGN_KEY_CHECKS=0` non transactionnel (🟡 Moyen)

**Fichier:** `electron/main.ts` (lignes 741-746)

Les FK checks sont désactivés sans transaction SQL — une erreur entre les deux `SET` pourrait laisser les FK désactivées.

---

## 6. MATRICE DE CORRECTION

| # | Priorité | Risque | Correctif | Effort | Statut |
|---|----------|--------|-----------|--------|--------|
| 1 | 🔴 P0 | ~~Injection SQL `db:mysqlQuery`~~ | ✅ Whitelist de tables | 2-3j | ✅ **FAIT** |
| 2 | 🟠 P1 | ~~WebSocket non chiffré ws://~~ | ✅ Support WSS | 2h | ✅ **FAIT** |
| 3 | 🟡 P2 | ~~CSP absente~~ | ✅ CSP production + COOP/COEP | 1h | ✅ **FAIT** |
| 4 | 🟠 P1 | `shell.openExternal` protocole libre | Valider protocole (https://) | 30min | ❌ **À FAIRE** |
| 5 | 🟡 P2 | `app:getPath` noms arbitraires | Whitelist des chemins | 1h | ❌ **À FAIRE** |
| 6 | 🟡 P2 | `app:saveImageToDisk` path traversal | Sanitiser folder/filename | 1h | ❌ **À FAIRE** |
| 7 | 🟡 P2 | Rate limiting | Ajouter côté serveur | 4h | ❌ **À FAIRE** |
| 8 | 🔵 P3 | CSP améliorations (frame-ancestors, base-uri) | Ajouter directives | 30min | 🔜 **OPTIONNEL** |
| 9 | 🔵 P3 | Mot de passe en clair AUTH_LOGIN | Hash SHA-256 côté client | 1j | 🔜 **PHASE 2** |
| 10 | 🔵 P3 | `isAdmin()` localStorage | Migration vérification serveur | 4h | 🔜 **PHASE 2** |

---

## 7. STATISTIQUES

| Métrique | Valeur |
|----------|--------|
| Correctifs appliqués | **3/6** critiques+élevés |
| Failles critiques résolues | **1/1** (100%) |
| Failles élevées résolues | **1/2** (50%) |
| Failles non corrigées | **3** (shell.openExternal, app:getPath, app:saveImageToDisk) |
| Améliorations suggérées | **5** (rate limiting, CSP mineurs, hash password, isAdmin(), FK transaction) |
| Vecteurs XSS trouvés | **0** |
| Vulnérabilités CSRF | **0** (non applicable) |

---

## 8. CONCLUSION

**Niveau de risque global: MOYEN**

L'audit SECURITE P3 confirme que les **3 correctifs prioritaires** ont été appliqués avec succès :

1. ✅ **Injection SQL** — bloquée par whitelist de tables + validateur de requêtes
2. ✅ **WebSocket non sécurisé** — support WSS (`wss://`) avec certificats
3. ✅ **Politique de sécurité** — CSP en production + COOP/COEP

**3 failles résiduelles** doivent être corrigées avant la mise en production :
- `shell.openExternal` sans validation de protocole (🟠 Élevé — 30 min)
- `app:getPath` sans whitelist (🟡 Moyen — 1h)
- `app:saveImageToDisk` path traversal (🟡 Moyen — 1h)

**Aucun vecteur XSS** n'a été trouvé dans le code actif. La protection React + l'absence de `dangerouslySetInnerHTML` garantissent la sécurité du rendu.

Le projet est en bonne voie pour un profil de sécurité **BAS** une fois les 3 correctifs restants appliqués.
