# Récupération du projet — état au 02/10/2026 au soir

Suite du rapport du 01/10 (`RAPPORT_RECUPERATION_2026-10-01.md`). Le projet est
toujours à un seul endroit : `E:\narvosprime-web-prototype`. Les outils et leur mode
d'emploi sont dans `scripts\recuperation\README.md`.

## 1. L'essentiel

**Le code Lua de nanos n'est plus « le point faible ».** Trois choses trouvées
aujourd'hui, dont deux hors du disque E: :

| trouvé | où | ce que ça rend |
|---|---|---|
| **le cache du client nanos** | `C:\Users\aniss\AppData\Local\NanosWorld\Saved\Packages` | tout `narvos\Shared` (catalogues GÉNÉRÉS compris — `Animations.lua`, `ObjetsHyper.lua`, `Items.lua`, `Loot.lua`…) et tout `narvos-map-proto\Client` (Lua, WebUI, 781 images), dans leur état FINAL |
| **la base d'historique d'Astra** | `C:\Users\aniss\.codex\thread_history_1.sqlite` | ses 368 modifications avec leurs numéros de ligne, ses commandes résolues et leurs sorties entières — dont 43 modifications du 18/09 que les sessions ne laissaient pas lire |
| **les scripts des commandes** | dans les trois historiques | 967 commandes modifiaient des fichiers par un script (`python - <<'FIN'`, `node -e`, `sed -i`, `cat >>`, `mv`, `rm`…) : rejouées en bac à sable, dans l'ordre |

| | 01/10 | 02/10 |
|---|---|---|
| packages nanos complets | 137 sur 204 | **197 sur 198** (le dernier est un journal de diagnostic) |
| lignes manquantes dans les packages | 15 404 | **0** |
| lignes d'ancienne version dans les packages | 11 341 | 31 |
| `.lua` qui compilent | 136 sur 164 (25 troués) | **175 sur 175** |
| batterie `lua-harness\tout.mjs` | 39 verts, 64 rouges | **85 verts, 22 rouges** — 11 621 assertions réussies |

## 2. Le cache du client

Le client nanos télécharge, à chaque connexion, les fichiers `Client\` et `Shared\`
du serveur et les garde sur C:. C: n'a jamais été formaté.

- Les `.lua` y sont **brouillés** : chaque octet combiné (OU exclusif) avec le chemin
  du fichier en minuscules, répété. 143 sur 143 se déchiffrent en UTF-8 strict.
  Les `.js`, `.css`, `.html`, `.json`, `.toml` et les images sont en clair.
- C'est **l'état final**. Le journal du client dit « Downloading 2 Package file(s) »
  le 26/09 à 13:48:01 ; la dernière connexion (20:35, sur un serveur lancé à
  14:52:54) n'a rien téléchargé ; le dernier événement de nos historiques est à
  13:52:37. Ces fichiers sont donc ce que le projet contenait dix minutes avant le
  formatage.
- Le lot déchiffré est dans `E:\mes_projet\cache-client-nanos\` (960 fichiers, le
  cache d'origine n'est pas touché). 17 fichiers n'avaient jamais été lus par un
  agent et manquaient entièrement : `Catalogs\Pas.lua`, `Emotes.lua`, `Props.lua`,
  `ObjetsIsp.lua`, les trois `Map_*.lua`, `Logic\Assemblage.lua`, `OsVehicules.lua`…
- Le serveur n'envoie pas `Server\` au client : **`narvos-map-proto\Server\` (33
  fichiers) reste la seule partie qui ne vient que des historiques.**

Ce cache sert aussi de MESURE : 164 fichiers dont on connaît le vrai contenu et que
les historiques reconstruisent de leur côté.

## 3. Ce que valent les historiques seuls

| vérité | comparés | identiques | complets mais différents | incomplets |
|---|---|---|---|---|
| runtime web (fichiers sains de DMDE) | 902 | 820 (90 %) | 37 | 45 |
| packages nanos (cache du client) | 164 | 123 (75 %) | 3 | 38 |

Sur les packages, la même mesure rendait 97 identiques ce matin, 111 après le rejeu
des scripts, 120 avec la base d'Astra, 123 avec les ajouts, copies et suppressions
rejoués dans l'ordre de la commande.

**Les 33 fichiers de `Server\` sortent tous complets** (`Index.lua` : 4 269 lignes,
`Session.lua` : 878, `Ia.lua` : 647…). Ce que « complet » garantit : sur les 126
fichiers de `Shared\` et `Client\` que les historiques rendent complets, 3 diffèrent
du vrai fichier — deux catalogues régénérés par leur générateur, un bloc ajouté par
une source absente de tout historique. À ce taux, un fichier de `Server\` peut porter
une modification que personne n'a consignée.

Contre-épreuve : les gardes de la batterie qui confrontent `Server\` au VRAI `Shared\`
et au VRAI `Client\` sont verts — `appels-check`, `appels-distants-check`,
`cablage-check`, `ui-liens`, `portee-check`, `schema-check`, `modules-orphelins-check`.
Un appel vers une fonction disparue ou un événement sans relais s'y verrait.

## 4. Défauts corrigés dans les outils (chacun a son test — 308 assertions)

- une modification en attente dont le texte neuf contient son ancre (une insertion)
  était appliquée une seconde fois sur un fichier où elle se voyait déjà ;
- mettre en doute tout ce qu'un script en échec avait ouvert fermait l'époque de
  fichiers simplement lus : 295 doutes, presque tous à tort — le doute ne porte plus
  que sur le dernier fichier lu par un script en ligne dont la vérification échoue ;
- un script cherchant un passage dans un fichier troué échouait : il est relancé en
  tenant ce passage pour présent, et son remplacement attend d'être placé ;
- les actions d'une commande étaient rejouées par genre : un défaut volontaire
  (`cp f f.bak` → script → harnais → `mv f.bak f`) restait dans le fichier ;
- un script daté de la fin de sa commande passait après l'instantané du disque
  qu'il avait lui-même produit ;
- `cat >> f` + heredoc, `@'…'@ | Add-Content`, `mv`, `cp`, `rm`, `git restore` :
  aucun n'était vu. 45 fichiers supprimés pendant le développement ne sont plus
  rendus (vérifié : absents aussi du cache et des lots DMDE).

## 5. Les 22 harnais rouges

| cause | harnais |
|---|---|
| **pack cuit perdu** (`Assets.toml`, manifeste ADK) — 7 | `animaux`, `incarnations-check`, `metahumain-bp`, `pas`, `pose-recolte`, `vehicules`, `minimap-cablage-check` |
| **`DefaultEngine.ini` de l'ADK** incomplet — 2 | `redirects-idempotents-check`, `rendu-client-check` |
| **harnais ou générateur lui-même incomplet** — 8 | `pack-staging-check`, `parcours`, `pnj-anims`, `pnj-anims-verif`, `assemblage-ui` (tests absents), `creation`, `modular`, `syntaxe-check` |
| **gardes qui parlent du vrai code** — 5 | `menottes-cablage-check` (`Dash.lua:127` et `Traversee.lua:299` nomment une capacité que `Menottes.lua` ne déclare pas), `sorts-vfx-check` (contrôle des images 2D, abandonnées le 14/09), `z-absolu-check` (`Client\Traversee.lua:164`), `zaaps-serveur` (1 assertion sur 71), `roster` (2 assertions) |

Les cinq derniers portent sur des fichiers dont le contenu est certain (cache) : ce
sont des rouges du projet, pas de la récupération — sans doute déjà rouges le 26/09.

## 6. Ce qui reste

1. **Le pack d'assets cuit** (`WebPortal\Server\Assets\narvos`, 88,7 Go, 231 710
   fichiers) et son `Assets.toml` (68 418 lignes, 580 connues). Sans lui le serveur
   ne charge pas le pack ; les catalogues, eux, sont revenus par le cache. Il faudra
   un cook — ou le retrouver sur D: (point 7).
2. **28 scripts incomplets** sous `scripts\` : des générateurs
   (`narvos-verifier-catalogues.mjs`, `narvos-emotes-to-lua.mjs`,
   `narvos-nanos-base-to-lua.mjs`, `narvos-modular-to-lua.mjs`, `narvos-ateliers-to-lua.mjs`…)
   et des harnais (`tests.lua`, `creation-tests.lua`, `roster-tests.lua`,
   `menottes-tests.lua`). Liste : `python scripts\recuperation\bilan.py
   E:\mes_projet\narvos-reconstruit-final --detail scripts`.
3. **39 fichiers que DMDE a rendus corrompus et qu'aucun agent n'avait lus**
   (`CORROMPU_SANS_REPLI` dans `ASSEMBLAGE.tsv`) : 31 sous `docs\` (audits, passations
   du 09 et du 10/09, `pnj-anims-mapping.json`), 8 fichiers de build sans valeur.
4. Relire les cinq gardes rouges du point 5.

## 7. Ce que Hanibes seul peut faire

DMDE tourne en administrateur : je peux le voir, pas le piloter.

- **Balayer D: avec DMDE.** Le projet a été DÉPLACÉ de `D:\mes_projet\narvosprime-web-prototype`
  vers E: le 19/09. Sur D: ses fichiers ont été « supprimés », pas formatés : ce qui
  n'a pas été réécrit depuis peut revenir — `narvos-map-proto\Server\` et le pack cuit
  dans leur état du 19/09. Dans DMDE : uniquement « Récupérer », jamais Appliquer /
  Écrire / Réparer / Initialiser, et récupérer VERS E:, pas vers D:.
- `$F32992\nanos_world` sur E: — toujours vu par DMDE, jamais rendu.
- Changer le disque d'installation par défaut de l'application Xbox.
- **Garder une copie du code hors de E:.** Tout tient sur un disque USB qui a déjà
  été formaté une fois ; le code seul (sans assets) pèse quelques dizaines de Mo.
- Supprimer le dossier vide `D:\mes_projet\narvosprime-web-prototype`.

## 8. Sous `E:\mes_projet\`

| dossier | rôle |
|---|---|
| `cache-client-nanos\` | le cache du client, déchiffré (lot de vérité) |
| `narvos-reconstruit-v8\` | ce que les historiques savent seuls (la mesure) + `INDEX_DMDE.tsv` |
| `narvos-reconstruit-final\` | l'extraction finale, avec `EVENEMENTS.pickle` pour les outils de diagnostic |
| `narvos-reconstruit-final-2026-10-01\` | l'extraction finale d'hier, gardée pour comparaison |
| `_avant_reassemblage_2026-10-02\` | chaque fichier du projet remplacé aujourd'hui, tel qu'il était |
| `_orphelins_reassemblage_2026-10-02\` | 37 fichiers sortis du projet : supprimés pendant le développement |
| `BATTERIE_8_apres_reassemblage_2026-10-02.txt` | la sortie de la batterie |
| `narvos-reconstruit-v4` … `v7` | extractions intermédiaires de mesure — supprimables |
