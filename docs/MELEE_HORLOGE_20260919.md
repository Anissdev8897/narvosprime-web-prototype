# Mêlée — l'enchaînement ne quittait jamais l'étape 1 (horloge de combat)

**Date :** 2026-09-19 · **Auteur :** Hermes · **Portée :** `narvos-map-proto/Server/Combat.lua`, `narvos-map-proto/Server/Frappes.lua`
**Statut :** corrigé, harnais dédié vert, batterie complète verte — **pas encore vu en jeu**.

---

## 1. Le défaut, tel que le code le portait

`Server/Combat.lua` tenait le temps de la mêlée d'un **compteur de minuterie** :

```lua
--- Compteur monotone, en millisecondes. …
local horloge_ms = 0
Timer.SetInterval(function() horloge_ms = horloge_ms + 50 end, 50)
```

Ce compteur avance de **50 ms par tour**, mais un tour de minuterie nanos ne vaut pas 50 ms :
`Server/Sorts.lua` a relevé, le 2026-09-15, des tours de **475 à 685 ms pour 500 ms demandés**
et le serveur en perd quand il peine. Le compteur **retarde** donc sur le temps réel.

Conséquence sur l'enchaînement (règles de `Shared/Logic/Combat.lua`) :

| Coup | Fenêtre réelle (`cadence = 1`) |
|---|---|
| 1 → 2 | entre +420 ms et +740 ms |
| 2 → 3 | entre +460 ms et +760 ms |

`enchaine_de` restait **devant** l'horloge : chaque second coup était refusé « Coup en cours »,
et la chaîne **ne quittait jamais l'étape 1** — exactement le symptôme relevé au rapport du 15/09.

`Timer.SetInterval` figurait aussi dans `Server/Frappes.lua` (même copie), qui pilote la série
des coups de poing (`Frappes.Choisir`) : même défaut, même correction.

## 2. Le harnais qui ferme le défaut

`scripts/lua-harness/combat-horloge.mjs` charge le **module réel** (`Server/Combat.lua` +
`Shared/Logic/Combat.lua` + catalogues réels) et **simule l'horloge** :

- **minuterie gelée** (aucun tour joué) — `Server.GetTime` avance seul ;
- **minuterie en avance** (100 tours = 5 000 ms de faux temps) — le temps réel n'avance que de 100 ms.

Sorties brutes :

```
AVANT correction (code du 15/09) — harnais ROUGE
  ECHEC  a +500 ms, minuterie GELEE : etape 2 (obtenu 1, attendu 2)
  ECHEC  minuterie en avance : le coup reste refuse
  ECHEC  minuterie en avance : l'etape annoncee ne bouge pas
  ECHEC  dans la fenetre : etape 3 (finisher) (obtenu 1, attendu 3)
  ECHEC  Server.GetTime est consulte (appels = 0)
  5 assertions reussies, 5 echec(s)

APRES correction — harnais VERT
  10 assertion(s) reussie(s), 0 echec(s)
```

Le harnais est découvert automatiquement par `tout.mjs` (aucun enregistrement à faire).

## 3. La correction

Les deux horloges passent au **temps réel** `Server.GetTime()` (millisecondes Unix,
`StaticClasses/Server.json`), comme `Sorts.lua` depuis le 15/09 :

```lua
local function horloge_ms() return Server.GetTime() end
```

- `Server/Combat.lua` : 1 horloge + **8 sites d'appel** (`Frapper` arme, `Frapper` poings,
  `Contrer`, `Telegraphier` ×2, `PeutReagir`, `reactions[…]` ×2).
- `Server/Frappes.lua` : 1 horloge + **1 site d'appel** (`Frappes.Choisir`).
- `os.time()` n'aurait pas suffi : secondes entières, et toute la mécanique se joue sous la seconde.

**Sauvegardes (pas de git sur ce dépôt) :** `.hermes/sauvegardes/melee-horloge-20260919/`
`Combat.lua.avant` (27 810 o) · `Frappes.lua.avant` (12 441 o).

## 4. Vérifications

| Contrôle | Résultat |
|---|---|
| `node scripts/lua-harness/combat-horloge.mjs` | 10 assertions, 0 échec |
| `node scripts/lua-harness/tout.mjs` | **105 harnais · 13 892 assertions · 0 échec · 0 harnais ROUGE** (avant : 104 / 13 882) |
| Syntaxe des 2 fichiers modifiés (`load()`, moteur wasmoon) | OK |
| `bash scripts/narvos-lancer-serveur.sh --verifier` | 9/9 contrôles passent (aucun cook, jonctions, version 5.7.4, Map_Narvos) |

## 5. Comment tester en jeu

```bash
bash scripts/narvos-lancer-serveur.sh     # contrôle PUIS lance NanosWorldServer --playtest (port 7777)
```

Puis, manette/écran en main :

1. prendre une arme de mêlée (commande `/arme` ou objet du sac) ;
2. frapper **au rythme d'un joueur** (deux clics espacés de ~0,5 s) : la série doit passer
   **coup 1 → coup 2 → coup 3** au lieu de rester bloquée au premier ;
3. vérifier la **récupération** : deux clics trop rapprochés (~0,1–0,3 s) doivent toujours être
   refusés — le correctif rend le temps vrai, il ne supprime pas la cadence.

Le correctif se charge au **démarrage du serveur** : sans relance, l'ancienne horloge reste en mémoire.

## 6. Reste à faire (inchangé, pour mémoire)

- **Mêlée** : harnais de familles (`melee.mjs` : prise/échelle par famille à l'œil, filtres
  épées / bâtons / distance, boucliers) ; contre avec riposte (`AS_CounterFront_A`) à régler.
- **Animations PNJ** : `blackorn` et `mob_boss` restent **BLOQUÉS** (`docs/pnj-anims-verdicts.json`,
  32 PNJ OK) — leurs clips ne sont **pas cuits** dans le pack : chantier ADK/cook, pas Lua.
- **NavMesh**, La Tour (arrivée sans sol), marchands autour de la Forge, relance + test en jeu
  de tout l'« ÉCRIT » du rapport du 15/09.