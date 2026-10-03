# Hachage — trois runtimes, un compte qui casse

Date : 2026-09-08 · Auteur : Hermes · Lot 7, tâche 2. **Décision d'architecture, aucun
code modifié** (consigne du lot). Chaque citation vérifiée ligne par ligne — la
citation du lot 6 (`authService.ts:67` "SHA-256 nu") était **fausse** : la ligne 67
est `};`, et ce fichier ne hache rien. Il n'y a **aucun SHA-256 nu** dans ce dépôt.

---

## 1. Les trois schémas mesurés

| runtime | algorithme | sel | itérations | format stocké | citation |
|---|---|---|---|---|---|
| **Electron** (`database.ts`) | **bcryptjs** (`bcrypt.compare`) | salage interne bcrypt | coût bcrypt | `$2a$/`$2b$...` | `database.ts:455` (refus non-bcrypt `:449-453`) |
| **Electron** (`localDatabase.ts`) | **bcryptjs** (`bcrypt.compareSync`) | idem | idem | `$2a$...` | `localDatabase.ts:553` (refus `:548-551`) |
| **Web** (`storage.ts`) | **PBKDF2 via WebCrypto** (`crypto.subtle.deriveBits`, hash `SHA-256`) | **aléatoire 16 o** | **1000** | `selHex:iters:hash` | `storage.ts:22-30`, utilisé `:621` |
| **nanos Lua** (`Comptes.lua`) | **PBKDF2-HMAC-SHA256** (`Crypto.Pbkdf2`) | **hex par compte** | **1000** (itération stockée par compte dans la colonne `iterations`) | `hash`, `sel`, `iterations` (colonnes SQL) | `Comptes.lua:445-461`, table `:103/:547` |

**Tous les faits ci-dessus ont été relus dans le code.** Le PBKDF2 du Web et celui
du Lua sont **différents** (WebCrypto `deriveBits` vs `Crypto.Pbkdf2` Lua) même à
itération égale — deux jeux d'octets différents pour le même mot de passe, sel et
itération. Lecteur = même format logique (`sel:iters:hash`), mais **pairage
impossible** sans réimplémenter le même PBKDF2 des deux côtés.

## 2. Qui écrit dans quelle base — et la VRAIE séparation des comptes

⚠ **Après traçage complet (lot 7)**, le vrai tableau est différent de ce que je
pensais. **Le login réel du Web passe par le SOCKET, pas par MySQL** :
`authService.ts:24-30` `login(password)` → `socket.login(username, password)` →
serveur nanos → **`Comptes.lua`** (PBKDF2-Lua, table `comptes`).

| base | table(s) de crédential | **login réel** | écriture | lecture |
|---|---|---|---|---|
| **SQL serveur nanos** | **`comptes`** (`hash`, `sel`, `iterations`) | **Web (via socket, `authService.ts:30`)** ET **jeu** | nanos `Comptes.lua:547` (PBKDF2-Lua) | nanos `Comptes.lua` |
| **MySQL** | **`users`** (`password_hash`) | **Electron** (`database.ts:437-455`) | Electron `database.ts` (bcrypt) ; **+ legacy** : web `storage.ts:621` (placeholder FK) | Electron `database.ts:440` (bcrypt, refus non-bcrypt) |
| `worldnevaros.db` (better-sqlite3) | (local) | Electron-local | `localDatabase.ts` (bcrypt) | `localDatabase.ts` |

**⚠ Ce que ça change** : le fameux « `users.password_hash` écrite par le Web et
lue par l'Electron » est un **demi-mythe**. Le **login réel du Web** ne touche
PAS `users` — il va au **socket → `comptes`**. Le `storage.ts:621` qui écrit
`users.password_hash` (PBKDF2 **de l'identifiant**) est un **placeholder de clé
étrangère** (`storage.ts:13` "jamais un mot de passe"), pas le login Web.

**Donc la vraie séparation** : **`comptes` = les comptes du jeu/web (PBKDF2-Lua)** ;
**`users` (MySQL) = les comptes Electron (bcrypt)**. Deux magasins distincts.

## 3. Le scénario de casse — le VRAI (après traçage)

**Revérifié après le retour** : le Web fait bien un **login réel**, mais **via le
socket** (`authService.ts:30 socket.login`), donc contre **`comptes`** (nanos,
PBKDF2-Lua). L'**Electron** se logue contre **`users`** (MySQL, bcrypt).

Donc la casse réelle n'est pas « deux runtimes écrivent la MÊME ligne », c'est
**deux magasins de comptes SÉPARÉS** :

1. Un joueur se crée / se connecte sur le **Web** → son compte vit dans **`comptes`**
   (PBKDF2-Lua, sel+iterations par compte).
2. Il lance **l'Electron** (le « launcher ») → qui se logue contre **`users`**
   (MySQL, bcrypt). **Son compte Web n'existe pas dans `users`** → il doit créer un
   **second compte** Electron, avec un mot de passe différent, stocké en bcrypt.

**Deux comptes pour un seul joueur, deux mots de passe possibles, deux schémas.**
C'est le vrai problème — pas une colonne partagée, mais **deux systèmes d'identité
qui ne se parlent pas**.

Le `storage.ts:621` qui écrit un **placeholder** dans `users.password_hash` n'est
ni le login Web (qui va au socket) ni un conflit : c'est un **artefact legacy** de
clé étrangère, hors de l'auth. Qu'Electron refuse son hash est sans conséquence
(cette ligne-là n'est jamais un vrai compte Electron).

**La vraie question de fond** : faut-il **un seul magasin de comptes** (le jeu
`comptes`) et faire que Web + Electron **délèguent** au lieu de détenir chacun le
leur ? (Voir §4 : un service autoritaire.)

## 4. Recommandation (contraintes mesurées)

Contraintes connues : PBKDF2 à 1000 itérations coûte **~0,25 s en Lua** (mesuré
240 µs/iter → 29 s pour 120 000, thread serveur bloqué) ; **bcrypt n'existe pas
en Lua pur**. Donc « mettre du bcrypt partout » et « passer à 120 000 itérations »
sont **impossibles côté nanos**.

**La seule décision qui supprime la casse : UN SEUL runtime possède les comptes.**
Les autres ne font que **déléguer** (au lieu de hacher eux-mêmes dans une table
partagée).

- **Runtime autoritaire = le jeu (`comptes`, nanos)** : c'est là qu'un joueur se
  connecte pour jouer. Son schéma (PBKDF2-1000, sel+iterations par compte) reste
  le **format de référence**.
- **Web + Electron** ne doivent **plus écrire `users.password_hash`** à leur
  sauce : soit ils **réutilisent** le hash du serveur de jeu (même `comptes`),
  soit ils gardent leur propre table **mais** en **déléguant la vérification**
  au service autoritaire.
- **À terme (VPS/infra)**, porter `Crypto.Pbkdf2` vers un **service HTTP
  bcrypt/Argon2** qui hache une seule fois, retourne le format, et que **tous**
  les runtimes appellent. C'est le vrai correctif aux **trois** écueils :
  cross-runtime, coût en Lua (29 s), sel non cryptographique (`math.random`).

**Ce qui est INSENSÉ de faire** : « harmoniser » en mettant 1000 partout → le
problème Web↔Electron reste (bcrypt vs PBKDF2, refus explicite). Le pb n'est pas
le nombre d'itérations, c'est **l'algorithme** + **qui hache**.

---

## Ce dont je ne suis pas sûr (tâche 2)

1. Le hash Web est décrit comme un **PBKDF2 de l'identifiant** (`storage.ts:14-16`,
   "Legacy MySQL... clé étrangère d'un personnage") — pas du mot de passe. Si c'est
   un **placeholder de bootstrap** (pas un vrai login), alors la casse réelle est :
   *Electron refuse le placeholder Web*, et le Web **ne fait pas de vrai login**
   (il crée juste la ligne FK). À confirmer : y a-t-il un vrai `login` Web qui
   vérifie un mot de passe, ou juste ce bootstrap ?
2. `localDatabase.ts` (`worldnevaros.db`) est-il vraiment **distinct** de
   `database.ts` (pool MySQL) pour le même utilisateur, ou partagent-ils la
   connectivité ? Le schéma (better-sqlite3 vs `this.pool.execute`) suggère deux
   choses, mais je n'ai pas tracé tous les appels.
3. Je n'ai **pas modifié de code** (consigne). La décision ci-dessus (run time
   autoritaire = jeu, délégation) est une **recommandation**, pas encore appliquée.