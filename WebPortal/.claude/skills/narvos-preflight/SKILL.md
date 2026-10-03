# narvos-preflight

Checklist obligatoire AVANT de publier un rapport ou de déclarer un bug. À invoquer AVANT chaque conclusion écrite sur le projet NARVOS PRIME.

## Checklist pré-publication

- [ ] **1. Chaque numéro de ligne vérifié par grep (pas de mémoire)**
  * Commande : `grep -n "contenu pertinent" src/rpg/chemin/fichier.ts`
  * Si impossible à trouver → écrire `[À VÉRIFIER]`, jamais de valeur inventée

- [ ] **2. Chaque « manquant » vérifié en lisant le fichier ENTIER**
  * Si le fichier fait >500 lignes → lire en 2 passes (offset/limit)
  * Chercher : `catch`, `retry`, `try {`, boucle avec re-tentative, `localStorage.setItem`
  * Ne jamais conclure « pas de X » à partir d'un extrait partiel de <100 lignes

- [ ] **3. Chaque CRIT a un scénario de perte/crash RÉEL documenté**
  * Un bug CRIT = perte de données, crash, ou blocage utilisateur réel
  * Avant « perte d'état sur reload » → vérifier la persistance :
    ```
    grep -rn "localStorage.setItem\|saveNow\|persistToStorage" src/rpg/
    ```
  * Si tous les stores sauvent synchrone → pas de perte → pas CRIT

- [ ] **4. Compteur de tests = `npm test` frais (pas mémorisé)**
  * Commande : `npm test 2>&1 | tail -5`
  * Noter : nombre de tests + nombre de fichiers
  * Ne jamais réutiliser un compteur d'une session précédente

- [ ] **4b. Chercher les suites « (0 test) » — c'est un ÉCHEC, pas un vide**
  * Commande : `npm test 2>&1 | Select-String "\(0 test\)"`
  * Un fichier qui ne se charge pas (import cassé, module natif absent) est
    rapporté « (0 test) ». Ça se lit comme « suite vide, rien à signaler » alors
    que ses tests n'ont JAMAIS tourné.
  * Vécu le 02/08 : `monitoring.test.ts` (chemin d'import faux) et
    `ktx2-encode.test.mjs` (DLL `sharp` orpheline) — 18 tests invisibles.

- [ ] **5. Durées/valeurs (timeout, seuils) = copiées du code, pas approximées**
  * Grep la valeur exacte (ms, secondes, pourcentages)
  * Exemple : `grep -n "setTimeout\|30000\|safety" src/App.tsx`

- [ ] **6. Fichiers/LOC comptés par commande, pas estimés**
  * Fichiers : `Get-ChildItem src/rpg -Recurse -Include *.ts,*.tsx | Measure-Object | Select-Object -ExpandProperty Count`
  * LOC : `Get-ChildItem src/rpg -Recurse -Include *.ts,*.tsx | Get-Content | Measure-Object -Line | Select-Object -ExpandProperty Lines`
  * ⚠️ **`Get-Content` est OBLIGATOIRE au milieu.** Sans lui, `Measure-Object -Line`
    compte la représentation texte des objets `FileInfo` — soit **une ligne par
    fichier**. La commande écrite ici jusqu'au 02/08 l'omettait et renvoyait donc
    « 731 fichiers / 731 LOC » et « RpgGameWorld.tsx = 1 ligne ».
  * Utiliser PowerShell (référence du projet), pas `wc -l` bash

- [ ] **7. Si une correction est apportée, vérifier qu'elle n'introduit pas une nouvelle erreur**
  * Relire le diff complet avant de publier
  * Vérifier que les numéros de ligne cités sont toujours valides après la correction

## Erreurs connues à ne PAS répéter

| N° | Erreur | Rappel |
|----|--------|--------|
| 1 | Safety timeout 60s (était 30s App.tsx:82) | Toujours grep le timeout exact |
| 2 | GPU reload = perte d'état (était faux) | Vérifier localStorage synchrone AVANT |
| 3 | PuzzleMap pas de retry (retry existait) | Lire le fichier ENTIER |
| 4 | 344 tests au lieu de 411 | `npm test` FRAIS à chaque rapport |
| 5 | recordCollect pas implémenté (existe L142) | Grep avant de dire « manquant » |
| 6 | 412 fichiers au lieu de 421 | Commande de comptage à chaque fois |
| 7 | ~47k LOC / ~24k LOC (44k réel) | PowerShell Measure-Object -Line |
| 8 | RpgGameWorld 3999 (était 3753) | Mesurer avec `Get-Content \| Measure-Object -Line` |
| 9 | La commande LOC de cette checklist était elle-même fausse (02/08) | Un skill n'est pas une source de vérité : si son chiffre est absurde (LOC = nombre de fichiers), c'est la COMMANDE qu'il faut corriger |
| 10 | « 15 suites rouges pré-existantes » (31/07) | 6 des correctifs touchaient du code de PRODUCTION. Un test rouge n'est pas présumé périmé — lire l'erreur avant de classer |

## Rappel des règles inviolables

1. TOUJOURS vérifier par grep, JAMAIS citer de mémoire
2. TOUJOURS lire le fichier ENTIER avant de conclure « manquant »
3. TOUJOURS vérifier l'impact réel avant de classer CRIT
4. Compter les tests au moment du rapport
5. Les numéros de ligne sont ÉPHÉMÈRES (le code change entre sessions)
6. Les compteurs (fichiers, LOC) se vérifient par commande

---

## Avant de dire qu'un système nanos « fonctionne »

Le portage nanos a sa propre liste, parce que ses défauts ne ressemblent pas à
ceux du runtime web : **nanos n'échoue presque jamais**. Un asset manquant, une
touche non enregistrée, une fonction résolue en globale nil — tout cela produit
un jeu qui tourne et ne fait rien.

- [ ] `node scripts/lua-harness/syntaxe-check.mjs` — la grammaire
- [ ] `node scripts/lua-harness/portee-check.mjs` — un nom employé avant son `local`
- [ ] `node scripts/narvos-verifier-catalogues.mjs` — **0 référence morte**
- [ ] Les 11 suites de `scripts/lua-harness/` — 980 tests
- [ ] Le système a-t-il été **vu à l'écran** ? Sinon, le dire.

### Ce qui échoue en silence dans nanos, et à quoi ça ressemble

| Défaut | Ce que voit le joueur | Ce qui l'attrape |
|---|---|---|
| Asset absent du pack (`Character`) | un cylindre blanc — la capsule de collision | `narvos-verifier-catalogues.mjs` |
| Asset absent (`Particle`, `Prop`) | rien du tout | idem |
| `local` déclaré après son appelant | la touche ne répond pas, puis plante | `portee-check.mjs` |
| `Reliability.Reliable` oublié en 2ᵉ argument | l'événement ne quitte jamais le client | relecture, aucun outil |
| Touche du serveur absente de `TouchesAssignables()` | raccourci mort | `commandes.mjs` |
| `CallEvent` émis avant que le WebUI ait chargé | écran noir | poignée de main `NarvosHud:Pret` |

### Erreurs connues à ne PAS répéter — côté nanos

| N° | Erreur | Rappel |
|----|--------|--------|
| 11 | Chemins RELATIFS dans un manifeste d'import (2 fois : 584 puis 60 fichiers perdus) | `path.resolve` à l'écriture. Un commandlet tourne depuis `Engine/Binaries/Win64/` |
| 12 | Vérifier un catalogue contre les ÉCHECS d'import | Un fichier jamais tenté n'est ni succès ni échec. Vérifier contre ce qui EXISTE |
| 13 | Comparer des ensembles de noms d'os sans la hiérarchie | MetaHuman intercale `spine_04/05`. Voir `narvos-measure-first` Règle 12 |
| 14 | `split("\n")` sur un fichier CRLF puis `/…$/` | `.` ne franchit pas `\r` en JS : le filtre ne filtre rien |
| 15 | Écrire un fichier à antislashs par heredoc bash | L'outil les mange. Passer par `Write`/`Edit` |
| 16 | Liste de fichiers écrite à la main dans un contrôle | `syntaxe-check` ne couvrait plus que 13 fichiers sur 40. Parcourir le disque |