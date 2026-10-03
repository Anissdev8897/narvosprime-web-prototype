# Lot 7 — quatre tâches, aucune n'exige Unreal

Pour l'agent Hermes. Rédigé le 2026-09-08.

Ta note d'hier : **17/20**. Le détail est dans `.hermes/NOTE_HERMES_2026-09-07.md`.
Ce lot part de ce que tu y as laissé.

## Une correction, et elle porte sur ta trouvaille de sécurité

Tu écris dans `PORTAGES_SOURCES.md` :

> **SHA-256 nu, sans sel ni itérations** (`authService.ts:67` `crypto.subtle.digest`)

**J'ai vérifié : c'est faux.** La ligne 67 d'`authService.ts` est un `};`, et ce
fichier ne hache rien. Mesuré :

```
electron/database.ts:455       bcrypt.compare  — et REFUSE explicitement un hash non-bcrypt
electron/localDatabase.ts:553  bcrypt.compareSync
src/utils/storage.ts:25-27     PBKDF2 + SHA-256 via WebCrypto
```

**Il n'y a aucun SHA-256 nu dans ce dépôt.** Une alerte de sécurité fausse coûte
plus qu'une absence d'alerte : elle envoie corriger ce qui va bien.

**Mais tu as touché quelque chose de réel en cherchant** — et c'est la tâche 2.

---

# Tâche 1 — Porter la mini-carte et le radar

**Ils existent déjà**, en TypeScript, jamais portés :

```
src/rpg/runtime/radar/projection.ts     28 lignes  ← LA LOGIQUE, c'est tout
src/rpg/runtime/MinimapHud.tsx          92 lignes  rendu React
src/rpg/runtime/radar/SpaceRadar.tsx   122 lignes  rendu React
```

**Seul `projection.ts` se porte.** `worldToRadar` est pur, testé
(`projection.test.ts`), et ne dépend d'aucun moteur. Les deux `.tsx` sont du
rendu React : l'UI nanos est du HTML, ils ne se transposent pas — ils se
**redessinent**.

## Ce que tu écris

1. **`Shared/Logic/Radar.lua`** — port de `worldToRadar`, plus ce qu'il faut pour
   une mini-carte : filtrer les points par rayon, les trier, plafonner leur
   nombre.
2. **`scripts/lua-harness/radar.mjs` + `radar-tests.lua`** — dont un test de
   **parité avec le TypeScript**, comme tu l'as fait pour le craft (214/214).
   C'est ce qui prouve un portage.
3. **Un panneau WebUI** dans `narvos-map-proto/Client/UI/`. Le moteur de menus
   existe : une seule page bascule de panneau sur `NarvosOuvrir`, six panneaux
   tournent déjà (`menu_inventaire`, `menu_spawn`, `menu_props`…). Le tien en est
   un septième, il n'y a pas d'architecture à inventer.

## La maquette existe, ne la dessine pas de zéro

`asset_game/a_trier/asset_trier/Soulslike Framework - Complete Soulslike Kit/`
contient un radar complet :

```
W_Radar   W_Radar_Cardinal   W_Radar_TrackedElement
AC_RadarManager   AC_RadarElement   T_RadarComponent
```

Le code est Blueprint, donc **mort pour nous** — nanos exécute du Lua. Mais la
**disposition** est exactement ce qu'il nous faut : une bande avec les points
cardinaux, et des marqueurs suivis qui glissent dessus. Lis-la avec la technique
d'extraction de chaînes du lot 5, et reprends-en la structure.

⚠ `UGUI_MiniMap_v2.5.0` est un `.unitypackage` — **Unity, inutilisable**. Ne
perds pas de temps dessus.

## Ce que le radar doit montrer

`Mondes.lua` sait déjà tout : `LIAISONS` (les six portails, avec `position`,
`rayon`, `label`, `teinte`), `CENTRES`, `RAYON_MONDE`. `Gisements.lua` a les
points de récolte. Le radar les consomme, il ne les redéfinit pas.

---

# Tâche 2 — Trois schémas de hachage pour un seul jeu

Ce que tu cherchais existe, mais ce n'est pas ce que tu as écrit :

| runtime | schéma |
|---|---|
| Electron (`database.ts`, `localDatabase.ts`) | **bcryptjs** |
| nanos Lua (`Comptes.lua`) | **PBKDF2-HMAC-SHA256, 1000 itérations** |
| Web (`utils/storage.ts`) | **PBKDF2 via WebCrypto** |

**Un compte créé dans un runtime ne peut pas se connecter dans un autre.** Ce
n'est pas une faille, c'est une incompatibilité — et elle se verra le jour où un
joueur passera du portail web au jeu nanos.

## Ce que tu produis — `docs/HACHAGE_TROIS_RUNTIMES.md`

1. **Les trois schémas mesurés** : algorithme, sel, itérations, format stocké,
   avec fichier et ligne. Vérifie chaque citation — celle du lot 6 était fausse.
2. **Qui écrit dans quelle base**, et si deux runtimes partagent une table.
3. **Le scénario de casse** : décris précisément ce que vit un joueur.
4. **Une recommandation.** Contrainte connue et mesurée : PBKDF2 à 1000
   itérations coûte déjà ~0,25 s en Lua, et 120 000 gèleraient le serveur
   29 secondes. bcrypt n'existe pas en Lua pur. Tiens-en compte.

⚠ **Aucune modification de code dans cette tâche.** C'est une décision
d'architecture, elle se prend avant de toucher à de l'authentification.

---

# Tâche 3 — Deux bugs ont été corrigés hier sans test. Écris-les.

J'ai corrigé deux défauts que tes harnais ne voyaient pas. **Aucun des deux n'a
de test** — donc rien n'empêche leur retour.

## 3a. Le curseur de dialogue partagé

`Logic/Dialogue.lua` garde `local actif` **unique pour tout le module**. Deux
joueurs en conversation : le second écrasait, et le choix du premier faisait
avancer le dialogue du second.

Corrigé par `Dialogue.Etat()` / `Dialogue.Charger(etat)` — le patron que tu
avais **déjà écrit correctement pour les quêtes** (`ChargerQuetes` /
`SauverQuetes`), vingt lignes plus haut.

**Le test à écrire** : deux curseurs, deux conversations différentes, alternées.
Prouve que le choix de A n'avance pas B. `dialogue-tests.lua` n'a aujourd'hui
**aucune** occurrence de « player » — j'ai compté.

## 3b. Les deux tables déclarées après leur usage

```
atelier_du_joueur  employé ligne 500, déclaré ligne 613
gisement_proche    employé ligne 501, déclaré ligne 719
```

Dans le gestionnaire de **déconnexion**. `nil[player] = nil` lève, et tout ce qui
suivait était sauté — dont `arme_suivante[player] = nil`, un correctif de fuite
mémoire.

`portee-check.mjs` les signalait. Tu les avais qualifiés d'**informatifs**.

**Ce qu'il faut, ce n'est pas un test unitaire** — c'est que `portee-check`
devienne **bloquant**. Regarde son code de sortie : s'il rend 0 en signalant des
cas, personne ne les verra jamais. Fais-le rendre non-zéro, et dis dans ton
rapport combien de fichiers du dépôt échouent alors.

---

# Tâche 4 — Trancher les divergences que tu as mesurées

Ton `PORTAGES_SOURCES.md` liste sept modules réinventés avec des écarts de
valeur. Ce sont des **bugs dormants** : deux runtimes qui ne donnent pas le même
résultat sur la même donnée. Trois sont chiffrés, tranche-les.

| divergence | TS | Lua | à décider |
|---|---|---|---|
| Crédits de départ | `STARTER_CREDITS = 50` | `CREDITS_DEPART = 500` | **facteur 10** |
| Portée de désengagement IA | `LEASH_MULT = 1.5` | `HYSTERESIS_ATTAQUE = 1.25` | lequel a été joué ? |
| Touche de vue | `F3` | `viewFps/viewTps = "KeyV"` | F1/F3 sont capturées par le navigateur |

## Ce que tu produis — `docs/DIVERGENCES_TRANCHEES.md`

Pour chacune : **quelle valeur fait foi et pourquoi**. Pas « aligner » — dire
laquelle est juste. Les crédits de départ à 500 ou 50 est une décision
d'équilibrage, pas de cohérence ; dis ce que chacune implique.

Puis **applique la décision aux deux côtés**, avec un commentaire à l'endroit
exact qui nomme l'autre runtime. Une valeur alignée sans commentaire diverge à
nouveau au premier changement.

---

# Règles du lot

- **Français.**
- Tâches 2 et 4 (rapport) : `docs/`, pas `.hermes/` — le garde-fou t'y bloque.
- **Vérifie chaque citation de fichier et de ligne.** Celle du lot 6 était
  fausse, et c'était l'alerte de sécurité.
- **Aucun avertissement d'outil n'est informatif.** C'est ce qui a coûté deux
  points hier.
- Colle les sorties brutes.

## Ce que tu rends

Les deux `.md`, le module `Radar.lua` et ses harnais, le panneau WebUI, les
tests de la tâche 3, et le `portee-check` rendu bloquant.

Et ta rubrique **« ce dont je ne suis pas sûr »**. Elle t'a valu la note d'hier.