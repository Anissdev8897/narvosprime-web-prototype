# 🔒 RAPPORT D'AUDIT SÉCURITÉ — NARVOS PRIME (WebPortal)

**Date :** 29 juillet 2026  
**Périmètre :** `D:\mes_projet\narvosprime-web-prototype\WebPortal\`  
**Équipe :** Équipe AUDIT SÉCURITÉ (10 agents)  
**Niveau de sévérité :** 🔴 Critique | 🟠 Élevé | 🟡 Moyen | 🔵 Faible

---

## SYNTHÈSE DES RISQUES

| # | Risque | Sévérité | Correctif prioritaire |
|---|-------|----------|----------------------|
| 1 | Injection SQL générique via `db:mysqlQuery` IPC | 🔴 **Critique** | Restreindre les requêtes SQL autorisées |
| 2 | Mots de passe en clair sur WebSocket (AUTH_LOGIN) | 🔴 **Critique** | Ajouter TLS/WSS + hachage côté client |
| 3 | Aucune validation anti-triche côté serveur | 🔴 **Critique** | Ajouter validation des états sur le serveur |
| 4 | shell.openExternal sans validation d'URL | 🟠 **Élevé** | Bloquer les protocoles dangereux (file://, javascript:) |
| 5 | Données localStorage non chiffrées (XSS) | 🟠 **Élevé** | Chiffrer les tokens sensibles + CSP renforcée |
| 6 | WebSocket en ws:// (non sécurisé) | 🟠 **Élevé** | Migrer vers wss:// en production |
| 7 | Pas de Content-Security-Policy en mode dev | 🟡 **Moyen** | Appliquer CSP aussi en dev avec compromis |
| 8 | `sandbox: false` dans Electron | 🟡 **Moyen** | Activer sandbox et adapter les loaders Three.js |
| 9 | Injection de commandes chat sans échappement | 🟡 **Moyen** | Valider les entrées utilisateur |
| 10 | Fallback `fallbackLogin` toujours réussi | 🟡 **Moyen** | Nécessite confirmation utilisateur en offline |
| 11 | Secrets exposés au renderer via `mysqlQuery` générique | 🟠 **Élevé** | Supprimer le canal SQL générique du preload |
| 12 | Pas de rate-limiting sur WebSocket | 🟡 **Moyen** | Rate-limiter côté serveur |
| 13 | Stockage du jeton d'authentification en localStorage | 🟡 **Moyen** | Utiliser sessionStorage ou httpOnly cookies |
| 14 | `admin:verify` sans suivi de session robuste | 🟡 **Moyen** | Remplacer le TTL par des tokens JWT |

---

## 1. 🔴 STOCKAGE LOCALSTORAGE — DONNÉES NON CHIFFRÉES

### Fichiers analysés
- `src/rpg/quests/questStore.ts` — clé `narvos:quests:{charId}`
- `src/rpg/reputation/reputationStore.ts` — clé `narvos:reputation:{charId}`
- `src/rpg/pets/petStore.ts` — clé `narvos:pets:{charId}`
- `src/rpg/weapons/equippedWeaponStore.ts` — pas de localStorage
- `src/rpg/combat/ammoStore.ts` — clé `narvos:ammo`
- `src/rpg/persistence/dbStore.ts` — bridge MySQL
- `src/rpg/stats/progressionStore.ts` — clé `narvos:progress:{charId}`
- `src/rpg/persistence/appearance.ts` — clé `narvos:tint:{charId}`
- `src/services/authService.ts` — stocke `narvos_user`
- `src/utils/storage.ts` — IndexedDB (legacy)

### Risques identifiés

**R1.1 — Données non chiffrées (🔴 Critique)**
Toutes les données localStorage sont en JSON clair. En cas de XSS (cross-site scripting), un attaquant peut :
- Lire les quêtes, réputation, inventaire, munitions, progression, tokens
- Modifier arbitrairement ces valeurs (ex: XP, niveau, armes)
- Voler le jeton d'authentification (`narvos_user`)

**R1.2 — Injection de données (🟠 Élevé)**
Les stores utilisent `JSON.parse()` sur `localStorage.getItem()` sans validation de schéma stricte :
```typescript
// questStore.ts ligne 49
const raw = localStorage.getItem(keyOf(charId));
return sanitize(raw ? JSON.parse(raw) : null);
```
Le `sanitize` filtre les quêtes inconnues mais ne protège pas contre l'injection de données malveillantes.

**R1.3 — Bridge SQL générique (🔴 Critique)**
`dbStore.ts` expose un canal SQL générique au renderer via `window.narvosLauncher.mysqlQuery(sql, params)` (preload.ts ligne 84-85). Le renderer peut exécuter **n'importe quelle requête SQL** sur la base de données :
```typescript
// preload.ts
contextBridge.exposeInMainWorld('narvosLauncher', {
  mysqlQuery: (sql: string, params: any[] = []) =>
    ipcRenderer.invoke('db:mysqlQuery', sql, params),
});
```
Un renderer compromis (via XSS ou Electron sandbox désactivé) peut exécuter `DROP TABLE`, `SELECT * FROM users`, etc.

### Corrections proposées

1. **Chiffrer localStorage** : Utiliser `crypto.subtle.encrypt` avec une clé dérivée du mot de passe pour les données sensibles (token, progression).
2. **Valider les schémas** : Ajouter Zod ou io-ts pour valider les entrées JSON.parse().
3. **Supprimer le canal SQL générique** : Remplacer `db:mysqlQuery` par des handlers IPC spécifiques et typés (`db:saveQuest`, `db:loadQuest`, etc.) qui valident les entrées.
4. **Rotation de clé** : Ne pas stocker le jeton d'auth en localStorage éternellement — utiliser un refresh token.

---

## 2. 🔴 COMMUNICATION RÉSEAU — WEBSOCKET NON SÉCURISÉ

### Fichier analysé
- `net/socket.ts` — Client WebSocket NARVOS PRIME

### Risques identifiés

**R2.1 — WebSocket en clair ws:// (🔴 Critique)**
```typescript
// net/socket.ts ligne 334-336
url: (import.meta as any).env?.VITE_GAME_WS_URL
    || `ws://${window.location.hostname || 'localhost'}:8082/ws`
```
Aucun TLS. Les paquets transitent en clair → **MitM total** :
- Vol de mots de passe (AUTH_LOGIN envoie `{ username, password }`)
- Vol de token de session
- Modification des paquets de jeu (MOVE, CAST_SPELL, etc.)
- Injection de paquets malveillants

**R2.2 — AUTH_LOGIN envoie le mot de passe en clair (🔴 Critique)**
```typescript
// net/socket.ts ligne 147
this.send({ type: 'AUTH_LOGIN', data: { username, password } });
```
Le mot de passe est envoyé en clair sur le WebSocket. Même avec WSS, le hash devrait être fait côté client.

**R2.3 — Token non validé côté serveur visiblement (🟡 Moyen)**
```typescript
// net/socket.ts ligne 160-163
if (this.token && !packet.token) {
    packet.token = this.token;
}
```
Le token est ré-attaché automatiquement aux paquets. Si le serveur ne valide pas chaque paquet, un attaquant peut rejouer des paquets avec un token volé.

**R2.4 — Aucun rate-limiting côté client (🔵 Faible)**
Aucune limitation du nombre de tentatives de connexion ou de paquets envoyés.

### Corrections proposées

1. **Migrer vers WSS** : `wss://` en production, avec certificat valide.
2. **Hacher le mot de passe côté client** : Envoyer `SHA-256(password)` ou mieux, utiliser un challenge-response (SCRAM).
3. **Valider chaque paquet côté serveur** : Vérifier le token + signature HMAC.
4. **Rate-limiting** : Limiter le nombre de paquets par seconde côté serveur.
5. **Timeout de connexion** : Ajouter un timeout sur `connect()` pour éviter les attentes infinies.

---

## 3. 🟠 ELECTRON — CONFIGURATION DE SÉCURITÉ

### Fichiers analysés
- `electron/main.ts` — Processus principal Electron
- `electron/preload.ts` — Pont sécurisé
- `electron-builder.yml` — Configuration de build

### Risques identifiés

**R3.1 — `sandbox: false` (🟠 Élevé)**
```typescript
// electron/main.ts ligne 89-90
nodeIntegration: false,
contextIsolation: true,
sandbox: false, // Nécessaire pour certains loaders Three.js
```
`contextIsolation: true` est bon, mais `sandbox: false` permet au renderer d'accéder à Node.js via le preload. Si un XSS est exploité, l'attaquant peut utiliser les API exposées (`mysqlQuery`, `app:getPath`, `app:saveImageToDisk`) pour des opérations dangereuses.

**R3.2 — `shell.openExternal` sans validation de protocole (🟠 Élevé)**
```typescript
// electron/main.ts ligne 140-144
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);  // ← ouvre n'importe quelle URL
    return { action: 'deny' };
});
```
```typescript
// electron/main.ts ligne 147-155
mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'http://localhost:3005' && parsedUrl.origin !== 'file://') {
        event.preventDefault();
        shell.openExternal(navigationUrl);  // ← ouvre dans le navigateur par défaut
    }
});
```
Un lien `javascript:alert(1)` ou `file:///etc/passwd` ou `steam://` / `xbox://` pourrait être injecté et déclenché via `shell.openExternal`. Même si l'action est `deny`, la fenêtre système est ouverte.

**R3.3 — Certificats SSL acceptés en dev (🟡 Moyen)**
```typescript
if (isDev) {
  app.on('certificate-error', (event, ...) => {
    event.preventDefault();
    callback(true);  // ← Accepte TOUS les certificats
  });
}
```

**R3.4 — Menu de débogage accessible en production (🔵 Faible)**
Le menu "Recharger" et "Forcer le rechargement" est accessible même en production, ce qui permet de contourner certaines protections.

**R3.5 — `app:getPath` exposé (🟡 Moyen)**
```typescript
// preload.ts ligne 13
getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
```
Expose les chemins système au renderer (userData, home, temp, etc.), utile pour un attaquant cherchant à placer des fichiers.

### Corrections proposées

1. **Activer `sandbox: true`** et adapter les loaders Three.js pour fonctionner sans accès Node.
2. **Valider les schémas d'URL** dans `setWindowOpenHandler` et `will-navigate` :
   ```typescript
   const allowedSchemes = ['http:', 'https:', 'mailto:'];
   if (!allowedSchemes.includes(parsedUrl.protocol)) {
     event.preventDefault();
     return;
   }
   ```
3. **Supprimer `app:getPath` du preload** si non utilisé.
4. **Supprimer `app:saveImageToDisk`** ou le restreindre à un sous-dossier spécifique.
5. **Retirer le menu de rechargement** en production.
6. **Ne pas exposer `isDev`** au renderer — information de footprinting.

---

## 4. 🟡 INJECTION — LLM / URLS / NOMS DE PERSONNAGES

### Fichiers analysés
- `src/rpg/chat/chatStore.ts` — Gestionnaire de chat
- `src/rpg/chat/registerAdminCommands.ts` — Commandes admin
- `src/rpg/chat/ChatPanel.tsx` — UI du chat
- `src/components/LoginScreen.tsx` — Écran de login
- `src/components/character/CharacterCreateScreen.tsx` — Création de personnage

### Risques identifiés

**R4.1 — Injection de commandes via chat (🟡 Moyen)**
```typescript
// chatStore.ts ligne 83-116
send(sender: string, text: string): void {
    if (trimmed.startsWith("/")) {
        const handler = this.commands.get(cmd.toLowerCase());
        if (handler) {
            handler(args);  // ← args non échappés, passés directement
        }
    }
    this.pushMessage({ sender, text: trimmed, type: "player" }); // ← texte stocké tel quel
}
```
Les messages sont stockés et affichés sans échappement HTML. XSS potentiel si le message contient `<script>`.

**R4.2 — Téléportation sans validation des limites (🟡 Moyen)**
```typescript
// registerAdminCommands.ts ligne 97-123
const x = parseFloat(parts[0]);
const y = parseFloat(parts[1]);
const z = parseFloat(parts[2]);
if (onTeleport) { onTeleport(x, y, z); }
```
Aucune validation des bornes (NaN, Infinity, très grandes valeurs). Pourrait causer des bugs de position ou OOB (out-of-bounds).

**R4.3 — Noms de personnages non validés (🟡 Moyen)**
Le système de création de personnage peut accepter des noms contenant des caractères dangereux (SQL injection, HTML injection).

**R4.4 — Injection LLM dans les dialogues NPC (🔵 Faible)**
Si les dialogues NPC utilisent des sorties LLM qui sont rendues dans l'interface, cela peut entraîner une injection de contenu malveillant.

### Corrections proposées

1. **Échapper le HTML** dans `ChatPanel.tsx` — utiliser `textContent` au lieu de `innerHTML`, ou React normalement le fait.
2. **Valider les noms de personnage** : regex `^[a-zA-Z0-9_]{3,20}$` avec rejet des caractères spéciaux.
3. **Limiter les coordonnées de téléportation** à la taille de la carte.
4. **Filtrer les messages LLM** avant de les afficher (DOMPurify si rendu HTML nécessaire).
5. **Ajouter des rate-limites** sur les commandes `/`.

---

## 5. 🔴 ANTI-TRICHE — VALIDATION CÔTÉ SERVEUR MANQUANTE

### Fichiers analysés
- `src/rpg/stats/progressionStore.ts` — Progression joueur
- `src/rpg/runtime/gameModeStore.ts` — Mode de jeu
- `src/rpg/runtime/admin/AdminPanel.tsx` — Panneau admin
- `net/socket.ts` — Tous les paquets

### Risques identifiés

**R5.1 — État modifiable via console navigateur (🔴 Critique)**
Tous les stores sont des singletons JS mutables. Un joueur peut :
```javascript
// Ouvrir DevTools et taper :
localStorage.setItem('narvos:progress:CHAR_ID', JSON.stringify({
  classId: 'PRESSURE_MANIPULATOR',
  stats: { level: 999, currentHp: 99999, maxHp: 99999, credits: 999999 },
  inventory: { ... }
}));
// Ou directement :
window.ammoStore.set({ arrows: 9999, cells: 9999 });
```

**R5.2 — Aucune validation côté serveur (🔴 Critique)**
Le client envoie des INTENTIONS, mais le serveur WebSocket (si présent) doit valider :
- Le niveau et l'XP sont-ils cohérents avec l'historique ?
- Le joueur a-t-il vraiment assez de munitions ?
- Les crédits sont-ils cohérents ?
- Le personnage existe-t-il vraiment ?

**R5.3 — Mode admin accessible sans serveur d'auth (🟠 Élevé)**
```typescript
// registerAdminCommands.ts
chatStore.registerCommand("adminmode", () => {
    if (!isAdmin()) {
        chatStore.pushError("Acces refuse — droits admin requis.");
        return;
    }
    gameModeStore.toggle();
});
```
La fonction `isAdmin()` vérifie le rôle stocké en localStorage (`narvos_user`). En mode offline (fallback login), n'importe qui peut définir son rôle :
```javascript
localStorage.setItem('narvos_user', JSON.stringify({ username: 'hacker', role: 'ADMIN' }));
```

**R5.4 — `/noclip` et `/tp` sans vérification serveur (🟠 Élevé)**
Les commandes noclip et téléportation sont purement côté client — un joueur peut les activer depuis la console.

**R5.5 — `db:mysqlQuery` permet destruction de données (🔴 Critique)**
Le handler `db:cleanDatabase` nécessite une vérification admin, mais `db:mysqlQuery` peut exécuter `DELETE FROM characters` sans vérification.

### Corrections proposées

1. **Valider TOUS les états côté serveur** : Le serveur doit être la source de vérité pour l'XP, le niveau, les crédits, l'inventaire.
2. **Signer les données localStorage** : Ajouter un HMAC aux données stockées pour détecter les modifications.
3. **Vérifier `isAdmin()` via le serveur** : Ne jamais se fier au localStorage pour les permissions.
4. **Console détection** : Désactiver le mode admin si DevTools sont détectées (technique anti-triche basique).
5. **Restreindre `db:mysqlQuery`** : Remplacer par des handlers nommés avec validation stricte.
6. **Route `/tp` et `/noclip` côté serveur uniquement** : Ces commandes doivent être validées par le serveur de jeu.

---

## 6. 🟡 CSP ET SÉCURITÉ DES PAGES WEB

### Fichier analysé
- `electron/main.ts` (CSP en prod)
- `vite.config.ts` (COOP/COEP headers)

### Risques identifiés

**R6.1 — CSP absente en mode dev (🟡 Moyen)**
```typescript
if (!isDev) {
    // CSP uniquement en production
}
```
En dev, il n'y a pas de Content-Security-Policy, rendant les attaques XSS possibles pendant le développement.

**R6.2 — CSP autorise `ws://localhost:8082` (🟡 Moyen)**
```typescript
"connect-src 'self' data: blob: ws://localhost:8082",
```
En production, `ws://` devrait être interdit au profit de `wss://`.

**R6.3 — `unsafe-inline` pour les styles (🔵 Faible)**
```typescript
"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
```
React nécessite `unsafe-inline` pour les styles en ligne, mais cela affaiblit la CSP.

### Corrections proposées

1. **Appliquer une CSP en dev** avec `'unsafe-inline'` pour les scripts (Vite en a besoin)
2. **Migrer `ws://` vers `wss://`** dans la CSP de production
3. **Utiliser un nonce** pour les styles critiques au lieu de `unsafe-inline`
4. **Ajouter `frame-ancestors 'none'`** pour prévenir le clickjacking
5. **Ajouter `base-uri 'self'`** pour empêcher l'injection de balises `<base>`

---

## CORRECTIONS PRIORITAIRES — PLAN D'ACTION

### 🔴 Immédiat (24h)
| Action | Fichier | Effort |
|--------|---------|--------|
| Supprimer `db:mysqlQuery` du preload | `electron/preload.ts` | 1h |
| Remplacer par 2 handlers typés (`db:persistState`, `db:loadState`) | `electron/main.ts` + `electron/preload.ts` | 2h |
| Ajouter WSS support | `net/socket.ts` | 2h |
| Hasher le password côté client avant AUTH_LOGIN | `net/socket.ts`, `authService.ts` | 1h |
| Valider les schémas d'URL dans `shell.openExternal` | `electron/main.ts` | 1h |
| Ajouter validation serveur pour `/adminmode`, `/noclip`, `/tp` | `registerAdminCommands.ts` + serveur | 4h |

### 🟠 Court terme (1 semaine)
| Action | Fichier | Effort |
|--------|---------|--------|
| Activer `sandbox: true` dans Electron | `electron/main.ts` | 4h |
| Chiffrer les tokens en localStorage | `authService.ts` | 3h |
| Ajouter Zod validation des schémas pour JSON.parse | Tous les stores | 4h |
| HMAC sur les données progression | `progressionStore.ts` | 2h |
| Rate-limiting côté serveur WebSocket | Serveur de jeu | 4h |
| CSP en mode dev | `electron/main.ts` | 1h |

### 🟡 Moyen terme (1 mois)
| Action | Fichier | Effort |
|--------|---------|--------|
| Implémenter anti-triche complet côté serveur | Serveur de jeu | 40h |
| Migrer vers JWT pour les sessions | `electron/main.ts` | 8h |
| Audit de toutes les commandes `/` | `registerAdminCommands.ts` | 4h |
| Valider les noms de personnages | `CharacterCreateScreen.tsx` | 2h |
| Échappement HTML des messages de chat | `ChatPanel.tsx` | 1h |

---

## ANNEXE A : Schéma des flux critiques (menace MitM)

```
[Joueur Navigateur/Electron]           [Serveur de Jeu]
         |                                     |
         |  ws://host:8082/ws (non chiffré)    |
         |══════════════════════════════════════>|  🔴 MitM possible
         |  AUTH_LOGIN {username, password}     |
         |══════════════════════════════════════>|  🔴 Password en clair
         |                                     |
         |  AUTH_SUCCESS {token}               |
         |<══════════════════════════════════════|
         |                                     |
         |  MOVE {x, y} + token                |  🟡 Token non signé
         |══════════════════════════════════════>|
         |                                     |
         |  db:mysqlQuery (Electron bridge)    |  🔴 SQL générique
         |  → DELETE FROM users                |
```

## ANNEXE B : Détails de configuration Electron

| Paramètre | Valeur actuelle | Recommandée | Statut |
|-----------|----------------|-------------|--------|
| `nodeIntegration` | `false` ✅ | `false` | OK |
| `contextIsolation` | `true` ✅ | `true` | OK |
| `sandbox` | `false` ❌ | `true` | 🟠 CORRIGER |
| `webSecurity` | `true` ✅ | `true` | OK |
| `allowRunningInsecureContent` | `false` ✅ | `false` | OK |
| CSP prod | Partielle ❌ | Complète | 🟡 AMÉLIORER |
| preload exposition | Trop large ❌ | Minimale | 🔴 CORRIGER |

---

**Rapport généré par l'Équipe AUDIT SÉCURITÉ (10 agents)**