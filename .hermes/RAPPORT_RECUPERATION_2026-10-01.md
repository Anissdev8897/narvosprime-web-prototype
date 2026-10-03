# Récupération du projet — état au 01/10/2026 au soir

Suite du formatage du disque E: par l'application Xbox (26/09, vers 20 h 46).
Ce rapport dit où est le projet, ce qui a été retrouvé, ce qui ne l'est pas, et
ce qui reste à faire. Les outils et leur mode d'emploi sont dans
`scripts\recuperation\README.md`.

## 1. Où est quoi

| quoi | où |
|---|---|
| **le projet** — le seul exemplaire | `E:\narvosprime-web-prototype` |
| lots rendus par DMDE, sorties des outils, sauvegardes | `E:\mes_projet\` |
| l'ancien emplacement | `D:\mes_projet\narvosprime-web-prototype` — dossier VIDE, à supprimer à la main (Windows le refusait tant que la session y était ouverte). Plus rien de NARVOS sur D:. |

Les gros dossiers (`WebPortal\public`, `WebPortal\Server\adk`, `Assets`,
`archive_recupere`, `asset_decompile`, `inpi`) sont des JONCTIONS vers les lots
DMDE : rien n'a été copié, les lots restent intacts.

## 2. Ce qui a été fait le 01/10

L'extracteur a été refait de fond en comble, mesuré à chaque pas contre les
fichiers que DMDE a rendus sains (901 fichiers dont on connaît le vrai contenu).

**Trois sources retrouvées, jamais exploitées jusque-là :**

- **744 transcriptions de sous-agents Claude** (`<session>\subagents\`) : 915
  opérations sur des fichiers du projet.
- **Les sessions Codex — « Astra »** (`C:\Users\aniss\.codex\sessions`), 14 → 18/09 :
  159 fichiers écrits, 306 modifications. C'est ce qui manquait aux fichiers que
  le disque montrait plus récents que nos historiques.
- **Les sorties de shell** : `cat`, `head`, `grep -n`, `cat -n` (6 000 lectures de
  plus), les fichiers écrits par heredoc, et le corps des skills injecté à chaque
  invocation (`nanos-world/SKILL.md` : 33 trous → 0 ; `wasm-engine` : 126 → 1).

**Défauts corrigés dans la reconstruction** (chacun a son test — 187 assertions) :

- un commentaire Lua supprimé (`--- texte` dans un diff) était pris pour un en-tête
  de fichier : chaque modification d'un fichier Lua commenté ouvrait une fausse
  « nouvelle version » ;
- le report entre versions repartait de la plus VIEILLE version entière au lieu
  d'enchaîner (`Comptes.lua` rendu d'après l'écriture du 03/09) ;
- la sortie Bash de Claude Code est rognée (lignes vides de tête et indentation
  de la première ligne perdues) : un `sed -n` pouvait décaler un fichier d'un rang ;
- rien n'empêchait de rejouer une relecture d'APRÈS la perte (coupure posée au
  26/09 18:00 UTC) ;
- le lot d'Hermes (`narvos-rebuild`) passait pour « complet » alors qu'il porte des
  reconstructions partielles : il n'est plus une source (27 de ses 52 fichiers
  sont identiques à l'extraction — bonne contre-épreuve ; les autres sont plus
  anciens, partiels, mal rangés ou corrompus).

## 3. Les mesures

| | |
|---|---|
| historiques SEULS, contre le disque (901 fichiers) | **804 identiques (89 %)**, 50 complets mais différents, 47 marqués incomplets |
| le matin même, avant ces travaux | 657 / 848 (77 %) |
| extraction finale (historiques + instantanés DMDE) | **901 / 901 identiques** — aucun événement ne contredit le disque |
| fichiers reconstruits | 2 030 vus : 1 848 complets, 174 incomplets, 8 sans contenu |
| fichiers texte du projet | 5 688 sains, 0 corrompu |
| batterie Lua (`scripts/lua-harness/tout.mjs`) | 103 harnais : **39 verts, 64 rouges**, 2 025 assertions réussies (27 verts le matin) |

Les 50 « complets mais différents » sont le plafond de la méthode : des fichiers
modifiés par un script lancé dans un shell (`sed -i`, un `python` qui réécrit) et
jamais relus ensuite. Sur le web, DMDE les corrige. **Sur le Lua nanos, rien ne
les corrige : un fichier sans marqueur peut être en retard d'une modification.**

## 4. Le code Lua nanos — le point faible

`WebPortal\Server\nanos_world\packages` ne vient QUE des historiques : DMDE voit
le dossier (`$F32992\nanos_world`) mais ne l'a jamais rendu.

| | fichiers | lignes |
|---|---|---|
| total | 204 | 78 248 |
| complets | 137 | |
| incomplets — catalogues GÉNÉRÉS | 19 | 12 372 lignes manquantes sur 17 309 |
| incomplets — code écrit à la main | 48 | 3 032 lignes manquantes, 9 506 lignes d'ancienne version, sur 30 429 |

Compilation (fengari) : 136 `.lua` compilent, 3 échouent (`Catalogs/Animaux.lua`,
`Catalogs/Recettes.lua`, `Server/Voitures.lua`), 25 portent encore des trous.

Les fichiers écrits à la main les plus touchés :

| fichier | lignes | manquantes | ancienne version |
|---|---|---|---|
| `narvos-map-proto/Server/Index.lua` | 4 315 | 47 | 196 |
| `narvos-map-proto/Client/Index.lua` | 3 161 | 20 | 1 048 |
| `narvos-map-proto/Server/Session.lua` | 869 | 0 | 843 |
| `narvos/Shared/Logic/Comptes.lua` | 716 | 4 | 555 |
| `narvos/Shared/Logic/Roster.lua` | 1 104 | 269 | 374 |
| `narvos/Shared/Catalogs/Mondes.lua` (écrit à la main) | 742 | 0 | 714 |
| `narvos/Shared/Logic/Agriculture.lua` | 629 | 548 | 0 |
| `narvos/Shared/Logic/Quetes.lua` | 372 | 249 | 0 |
| `narvos/Shared/Logic/Loot.lua` | 520 | 172 | 0 |
| `narvos-map-proto/Client/UI/index.html` | 1 131 | 344 | 584 |
| `narvos-map-proto/Client/UI/creation/style.css` | 1 420 | 632 | 242 |

« Ancienne version » ne veut pas dire perdu : le texte est là, entre deux marques,
tel qu'on l'a lu en entier la dernière fois. La marque dit que ce tronçon a
changé de longueur depuis (`N attendue(s), M connue(s)`), pas où. Les lignes
qu'on SAIT être dans la version finale y sont listées en commentaire, avec leur
numéro (`[SÛRE n°…]`). Le détail par fichier est dans
`E:\mes_projet\narvos-reconstruit-final\MANIFESTE.tsv`.

## 5. Les 64 harnais rouges

| cause | nombre |
|---|---|
| erreur Lua — un fichier troué ou en ancienne version casse le chargement (beaucoup butent sur le MÊME catalogue) | 23 |
| assertion ou garde — souvent parce que `Assets.toml` et le pack cuit manquent | 17 |
| fichier absent — catalogues générés jamais relus (`Stats`, `Elements`, `Arenes`, `Emotes`, `Talents`, `Vignettes`, `ObjetsIsp`, `Pas`), `icones.js`, et `adk/Config/DefaultEngine.ini` | 15 |
| le harnais lui-même est incomplet (`pack-staging-check`, `pnj-anims`, `pnj-anims-verif`, `vaisseaux-menu`) | 4 |
| autres | 5 |

(Classement : `python scripts/recuperation/classer-rouges.py <journal>`.)

Journal complet : `E:\mes_projet\BATTERIE_7_apres_reassemblage.txt`.

## 6. Ce qui reste, dans l'ordre

1. **Régénérer les catalogues.** 23 générateurs `scripts/narvos-*-to-lua.mjs` : 14
   sont complets et passent `node --check` ; 9 sont incomplets (`animaux`,
   `armes-base`, `catalogs`, `emotes`, `metacustom`, `modular`, `nanos-base`,
   `pack-props`, `spawnables`), dont `narvos-catalogs-to-lua.mjs` (69 lignes
   manquantes), le principal. Aucun n'a été lancé aujourd'hui. Les sources TS (`WebPortal\src`) sont celles du
   disque. ⚠ Lancer un générateur sans ses entrées écrase un catalogue en partie
   reconstruit par un catalogue vide : le faire un par un, en regardant la sortie.
2. **Relire les 48 fichiers Lua incomplets**, en commençant par `Session.lua`,
   `Comptes.lua`, `Roster.lua` (comptes et sauvegardes), puis les deux `Index.lua`.
   Pour chacun : `python scripts/recuperation/tracer.py "<chemin>"`.
3. **Reprendre les modifications non reportées** : 13 fichiers portent le marqueur
   `[MODIFICATIONS NON REPLACÉES]` ; leur texte est dans
   `E:\mes_projet\narvos-reconstruit-final\EDITS_NON_APPLIQUES\`.
4. **Recuire le pack** depuis l'ADK : le pack cuit et `Assets.toml` sont perdus
   (toutes les copies retrouvées sont binaires).
5. Fichiers reconstruits destinés à `public\` et à `adk\` : posés dans
   `WebPortal\public.reconstruit\` et `WebPortal\Server\adk.reconstruit\` (30
   fichiers), pour ne pas écraser les originaux à travers la jonction. À reporter à
   la main là où le lot DMDE n'a pas le fichier (`adk\Config\DefaultEngine.ini`).

## 7. Ce que Hanibes seul peut faire

- **DMDE, `$F32992\nanos_world`** : c'est le dossier des packages Lua. Je vois
  l'écran de DMDE mais Windows bloque mes clics (il tourne en administrateur). Si
  DMDE le rend avec son contenu, c'est le disque qui parle, et la moitié de ce
  rapport devient inutile. Dans DMDE : seulement « Récupérer », jamais Appliquer,
  Écrire, Réparer ni Initialiser. Liste : `E:\mes_projet\recup-passe2\A_CHERCHER_DANS_DMDE.txt`.
- **Application Xbox** : changer son disque d'installation par défaut. Elle a
  formaté E: une fois ; tout le projet y est de nouveau.
- **Une copie du code ailleurs que sur E:.** Le code tient en quelques centaines
  de Mo ; aujourd'hui il n'existe qu'en un exemplaire, sur un disque USB.
- Supprimer le dossier vide `D:\mes_projet\narvosprime-web-prototype`.

## 8. Sous `E:\mes_projet\`

| dossier | rôle |
|---|---|
| `narvos-restaure\`, `Nouveau dossier\`, `recup*\`, `recovery-*\` | lots DMDE — NE PAS TOUCHER (le projet y pointe par jonctions) |
| `narvos-reconstruit-final\` | l'extraction qui a servi à remonter le projet (`MANIFESTE.tsv`, `EDITS_NON_APPLIQUES\`) |
| `narvos-reconstruit-v4\` | l'extraction « historiques seuls », l'étalon des mesures (`INDEX_DMDE.tsv`) |
| `_avant_reassemblage_2026-10-01\` | les 745 fichiers du projet remplacés aujourd'hui, tels qu'ils étaient |
| `_orphelins_reassemblage_2026-10-01\` | 8 fichiers sortis du projet (5 du lot Hermes mal rangés, 3 corrompus) |
| `narvos-rebuild\` | le lot d'Hermes — plus une source |
| `narvos-reconstruit\`, `-v2\`, `-v3\`, `narvos-fusion\`, `narvos-fusion-v4\`, `_evts_cache.pkl` | sorties d'anciennes versions des outils : périmées, peuvent être supprimées |

## 9. Non exploité

`C:\Users\aniss\.gemini\antigravity` et `C:\Users\aniss\.cursor` gardent des traces
du projet, de 11/2025 à 06/2026 (époque Godot puis React). Rien de la période
nanos : laissé de côté.
