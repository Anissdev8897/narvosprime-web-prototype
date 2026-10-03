# MISSION KIMI — le craft par ASSEMBLAGE (véhicules, armes, objets)

Rédigée le 2026-09-10. **Elle vient APRÈS ta mission véhicule** — ne la commence
pas avant qu'une voiture roule pour de vrai. Assembler un véhicule qui ne se
conduit pas ne prouverait rien.

Pendant ce temps je prends l'édition de map : souris libre, zones et
permissions, mode édition F3. On ne se croise pas — tu es dans
`Shared/Logic/Craft*`, je suis dans `narvos-map-proto/Client|Server`.

---

## 0. Ce qui existe DÉJÀ — ne le refais pas

C'est la contrainte que le patron a posée en toutes lettres : *« intégrer ce
système avec les systèmes déjà existants plutôt que de recréer des
fonctionnalités qui sont déjà présentes »*. Ce dépôt a payé cette faute trois
fois.

| existant | ce qu'il fait | lignes |
|---|---|---|
| `Shared/Logic/Craft.lua` | recette → sortie, avec consommation **UID-correcte** | 263 |
| `Shared/Catalogs/Recettes.lua` | le catalogue de recettes | 445 |
| `Shared/Logic/Inventory.lua` | grille, piles, uid par instance | — |
| `Shared/Logic/Recolte.lua` + `Catalogs/Gisements.lua` | la récolte en amont | 364 |

⚠ **Lis l'en-tête de `Craft.lua` avant d'écrire une ligne.** Il documente un
piège que tu réintroduirais sinon : `Inventory.RemoveItemFromGrid` prend un
**UID**, pas un `item_id`. `CountItem(grid, "metal_rare")` peut dire 12 alors
que ces 12 sont répartis sur trois piles d'uids différents. Consommer avec un
`item_id` **échoue en silence** — rien n'est retiré et la fabrication réussit
quand même. `Craft.Consommer` planifie les `(uid, prise)` en lecture seule
d'abord, puis applique. Ton assemblage doit passer par lui, pas à côté.

Deuxième décision déjà prise dans ce fichier, et à respecter : **la place avant
la consommation**. `Craft.Fabriquer` simule l'ajout de la sortie sur la grille
AVANT de retirer quoi que ce soit ; s'il n'y a pas de place, il rend
`nil, "pas de place…"` sans avoir rien détruit. Un assemblage qui consomme puis
découvre qu'il ne peut pas rendre le résultat aurait mangé les pièces du joueur.

## 1. Ce qu'on te demande d'ajouter

Un **assemblage pièce par pièce**, là où `Craft.lua` fait recette → sortie d'un
bloc.

> carrosserie + portes + moteur + roues + propulsion → véhicule

Le joueur place réellement les éléments, il ne clique pas sur « fabriquer ».

### A. D'abord le modèle, en Lua pur et testable

`Shared/Logic/Assemblage.lua` — **aucun appel à l'API nanos**, comme `Craft.lua`.
Il doit répondre à :

- quelles **emplacements** (slots) un plan comporte, et lesquels sont obligatoires ;
- quelle **pièce** est acceptable dans quel emplacement (et pourquoi celle-là non) ;
- l'assemblage est-il **complet** ? sinon, que manque-t-il, **nommément** ;
- que rend-on si le joueur abandonne en cours de route — les pièces posées lui
  reviennent-elles ? (réponds à cette question dans l'en-tête, ne la laisse pas
  au hasard : c'est celle qui fait perdre l'inventaire d'un joueur.)

⚠ **Un emplacement vide n'est pas `nil`.** En Lua un champ à `nil` DISPARAÎT de
la table : tu ne peux plus distinguer « vidé » de « jamais existé », et `pairs`
ne le voit pas. Itère une **liste d'emplacements**, ne compte jamais sur `#` ni
sur `pairs` pour une table à trous.

### B. Le catalogue de plans — GÉNÉRÉ, pas écrit à la main

`Shared/Catalogs/Plans.lua`, produit par un `scripts/narvos-plans-to-lua.mjs`.
Source : les recettes existantes + les pièces réelles.

⚠ **Chaque pièce nommée doit exister dans `Assets.toml`.** Un plan qui nomme un
mesh absent ne lève pas : le jeu l'ignore. Ajoute la vérification à
`scripts/narvos-verifier-catalogues.mjs` — il couvre déjà Props, Vfx, Emotes,
Widgets et les maps, ajoute Plans à la même liste.

### C. Le mini-jeu, en dernier

Une WebUI. Elle vient **après** que le modèle soit vert sous harnais : une
interface sur un modèle non prouvé ne se débogue pas.

Rappels du pont, chacun a coûté une journée ici :
- **page → Lua : `ui:Subscribe`**, jamais `Events.Subscribe`. 25 abonnements
  posés sur la mauvaise API : toutes les interfaces s'affichaient, aucune
  n'agissait, et rien ne le signalait.
- **un objet JS ne traverse pas.** `Events.Call(nom, objet)` se perd en silence ;
  sérialise en JSON et décode côté Lua (accepte les deux formes).
- **client → serveur : `Events.CallRemote("X", Reliability.Reliable, …)`.**
  L'omettre ne lève rien, la charge utile disparaît.
- un WebUI ne reçoit pas les `CallEvent` émis dans le même tick : tamponne le
  dernier état et laisse la page le réclamer quand elle est prête.

## 2. Le même principe pour armes et objets

Le patron le demande explicitement. Donc : **un seul modèle d'assemblage**,
paramétré par le plan — pas un pour les véhicules et un autre pour les armes.
Si tu écris deux fois la même logique, la seconde divergera.

## 3. Non négociable

- `node scripts/lua-harness/tout.mjs` avant de rendre — **55 harnais**, la
  commande existe. Pas un sous-ensemble.
- `node scripts/lua-harness/listes-recopiees-check.mjs` : aucun littéral de
  chaînes qui recopie les clés d'un catalogue.
- `local function` déclarée après son appelant = global `nil`, muet. Tables
  indexées par joueur en tête de fichier.
- **Ne masque jamais la sortie d'un `--apply`** : trois échecs silencieux le
  04/09, chaque fois un backtick dans un template literal de générateur.
- Ton harnais doit **compter ses assertions** et le dire. Un harnais qui ne
  vérifie rien sort en 0 et compte pour vert.

## 4. Le témoin

Pas « l'écran d'assemblage s'ouvre ». **« Le joueur pose quatre roues, un moteur
et une carrosserie, et repart avec un véhicule qui roule. »** Une caisse rendue
à l'inventaire ne prouve rien tant qu'elle ne se conduit pas — c'est la même
règle que sur ta mission véhicule, et je viens de me faire prendre par elle en
comptant 88 voitures statiques comme un déblocage.