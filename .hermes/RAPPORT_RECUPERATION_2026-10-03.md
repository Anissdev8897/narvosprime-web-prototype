# Récupération du projet — état au 03/10/2026 (nuit du 02 au 03)

Suite des rapports du 01/10 et du 02/10 (`RAPPORT_RECUPERATION_2026-10-02.md`). Le
projet est toujours à un seul endroit : `E:\narvosprime-web-prototype`. Les outils et
leur mode d'emploi sont dans `scripts\recuperation\README.md`.

## 0. Mise à jour du matin (03/10, 10 h) — à lire avant le reste

Le projet a été réassemblé une seconde fois à 09 h 56 (sauvegardes :
`E:\mes_projet\_avant_reassemblage_2026-10-03_09h56`). Les chiffres des sections
suivantes datent de la nuit ; ceux-ci les remplacent :

| | nuit (00 h 30) | matin (09 h 56) |
|---|---|---|
| `scripts\` complets | 374 sur 394 | **376 sur 394** |
| batterie | 85 verts, 22 rouges, 11 626 assertions | **87 verts, 20 rouges, 11 745 assertions** (`creation`, `sorts-vfx-check` au vert) |
| historiques SEULS, web | 820 identiques, 36 complets mais différents | **828**, 30 |
| historiques SEULS, Lua | 125 identiques, 3 complets mais différents | **130**, 1 |
| preuves des outils | 348 assertions | 387 |
| journaux du jeu | 0 faux | 0 faux, 108 messages sur 108 |

Ce qui a changé dans les outils (détail et tests : `scripts\recuperation\README.md`) :

- **un segment inconnu n'emporte plus la commande** : 21 457 commandes sur 30 904
  étaient jetées en entier pour un `ls` ou un `node x.mjs` au milieu de lectures
  séparées par des `echo`. +1 581 commandes alignées, +32 663 lignes lues ;
- `$(…)` rend un mot insoluble, pas la commande illisible ; lectures « flottantes »
  (plage courte en tête de sortie) calées contre le fichier ou ignorées ;
- **contamination entre projets corrigée** : un chemin relatif était replié sur la
  racine de NARVOS même quand la commande tournait dans un autre projet — notre
  `.env.example` portait des lignes de `goldluxuryking-shop` ;
- le bac Node reçoit l'environnement stable de la machine (plus de fichier fantôme
  `undefined\…`).

Pistes ouvertes, non traitées : 20 commandes PowerShell qui modifient des fichiers en
place (`[regex]::Replace` puis `WriteAllText`, fichiers web déjà couverts par DMDE) ;
les `cat > f <<FIN` sans guillemets (sonde écrite, résultat non vérifié).

## 0 bis. Reprise de l'après-midi (03/10) — les gardes « du vrai code »

Batterie : **90 verts, 17 rouges, 11 750 assertions** (`E:\mes_projet\BATTERIE_12_reprise_2026-10-03.txt`).
Fichiers d'avant : `E:\mes_projet\_avant_reprise_2026-10-03`.

| garde | cause | ce qui a été fait |
|---|---|---|
| `menottes-cablage-check` | vrai défaut : `Server/Dash.lua:127` et `Server/Traversee.lua:299` refusent `esquive` / `traversee`, absentes de `Menottes.CAPACITES` — `Refuse` rendait false, le menotté esquivait et escaladait | les deux capacités ajoutées à `Shared/Logic/Menottes.lua` (s'écarte donc du cache client d'une ligne) |
| `z-absolu-check` | faux positif : `Client/Traversee.lua:164`, Z = `pieds_z - 40`, relatif au personnage | exception déclarée dans `TOLERES` |
| `zaaps-serveur` | test périmé : attendait « Zaap Zaap du port », que `Zaaps.Libelle` (cache, état final) interdit exprès | attente corrigée |
| `roster` | NON TOUCHÉ : `roster-tests.lua` est une ancienne version (263 lignes d'ancienne version) ; il cherche un torse de famille `metahuman` (aucune pièce au catalogue final) et une « tenue offerte » que la décision du 14/09 (aucun vêtement d'office) contredit | à réécrire quand la règle voulue est confirmée |

Les 16 autres rouges : pack cuit / ADK (9), harnais ou générateurs troués (7).

## 1. L'essentiel

Rien de nouveau n'a été trouvé hors du disque ; ce passage a corrigé **quatre défauts
de l'extracteur** qui faisaient entrer des faussetés dans le projet, et a ajouté une
contre-épreuve indépendante sur `Server\`.

| défaut | ce qu'il faisait | mesuré |
|---|---|---|
| une commande « réussie » tenue pour un script réussi | `python - <<'PY' … PY` échoue (AssertionError), `node x.mjs` qui suit réussit : la commande n'est pas en erreur. Le script était rejoué avec indulgence et appliquait une modification qui n'avait jamais eu lieu — ou mettait en doute un fichier qu'il n'avait pas touché | 61 scripts ; un générateur complet rendu « ancienne version » |
| une commande « en erreur » tenue pour une commande sans effet | le script modifie le fichier, puis `node --check` échoue : « Exit code 1 ». Toute la commande était ignorée | 159 commandes : 37 scripts menés à bien, 53 fichiers écrits par heredoc puis lancés ; `nanos-build-asset-pack.mjs` (59 trous) revenu complet, `narvos-audit-packs.mjs`, `narvos-nanos-base-to-lua.mjs`, `schema-check.mjs` aussi |
| l'horloge du rejeu | un manifeste du 04/09 rejoué portait `"genere_le": "2026-10-02T21:27…"` ; deux extractions de suite ne rendaient pas le même fichier | l'horloge du bac est celle de la commande d'origine |
| ce que le bac ne peut pas savoir | un `.glb`, un `.uasset` y est toujours « absent », un dossier d'assets toujours vide, `Assets.toml` connu à 1 % : les générateurs rejoués écrivaient « lus : 0 », « 22 assets manquants sur 22 », `"entrees": {}` — et c'était posé dans le projet | 6 fichiers inventés retirés du projet ; un fichier généré à partir de ce que le bac ignore n'est plus posé, un fichier modifié en place l'est toujours |

Chaque règle a sa preuve (348 assertions, 6 suites) et sa mesure : les deux vérités
(901 fichiers web de DMDE, 164 fichiers du cache client) n'ont pas bougé — 820 et 125
identiques à partir des seuls historiques —, et quatre scripts de plus sont complets.

## 2. Le projet remonté (03/10, 00 h 30)

| | 02/10 | 03/10 |
|---|---|---|
| packages nanos complets | 197 sur 198 | 197 sur 198 (le dernier est un journal de diagnostic) |
| `.lua` qui compilent | 175 sur 175 | 175 sur 175 |
| `scripts\` complets (générateurs, harnais) | 366 sur 394 | **374 sur 394** |
| fichiers texte sains (`sante.py`) | — | 5 726, 1 « corrompu » (un octet de contrôle vrai dans une ligne commentée de `narvos-verifier-catalogues.mjs`) |
| batterie `lua-harness\tout.mjs` | 85 verts, 22 rouges, 11 621 assertions | 85 verts, 22 rouges, **11 626** assertions |
| journaux du jeu (`verifier-journaux.py`) | — | 4 cadres de pile justes, 0 faux ; 108 messages du 26/09 sur 108 retrouvés dans le code |

- **Remplacés** : 229 fichiers (presque tous pour un chemin `D:` → `E:` que
  `chemins-vers-e.py` a remis ensuite) ; chacun copié avant dans
  `E:\mes_projet\_avant_reassemblage_2026-10-03_00h29`.
- **Sortis** (`E:\mes_projet\_orphelins_reassemblage_2026-10-03_00h30`) : cinq manifestes
  de `adk.reconstruit\_manifests` et `WebPortal\regression-report.json`, au contenu
  inventé par le bac ; `src\rpg\wasm\animationPipeline.benchmark.ts`, renommé
  `…benchmark.test.ts` le 30/07 (une commande en erreur que l'on ne lisait pas). La
  reconstruction honnête du rapport de régression (anciennes lignes, marqueurs) est
  posée à côté : `WebPortal\regression-report.json.reconstruit`.
- **`Server\` (33 fichiers Lua)** : contenu identique à celui du 02/10. La contre-épreuve
  des journaux porte sur lui : `Voyage.lua:282`, `Voyage.lua:328`, `Index.lua:4116`
  tombent à la ligne près ; tout avertissement du 26/09 se retrouve dans le code.

## 3. Les 22 harnais rouges

| cause | harnais |
|---|---|
| **pack cuit perdu** (`Assets.toml`, manifeste ADK) — 7 | `animaux`, `incarnations-check`, `metahumain-bp`, `pas`, `pose-recolte`, `vehicules`, `minimap-cablage-check` |
| **`DefaultEngine.ini` de l'ADK** incomplet — 2 | `redirects-idempotents-check`, `rendu-client-check` |
| **harnais ou générateur lui-même incomplet** — 8 | `parcours`, `pnj-anims`, `pnj-anims-verif`, `assemblage-ui` (tests absents), `creation`, `modular`, `syntaxe-check`, `chaine-generateurs-check` (lit une ligne commentée de `narvos-verifier-catalogues.mjs`) |
| **gardes qui parlent du vrai code** — 5 | `menottes-cablage-check`, `sorts-vfx-check`, `z-absolu-check`, `zaaps-serveur` (1 assertion sur 71), `roster` (2 assertions) |

`pack-staging-check` est passé au vert (son harnais est revenu complet). Les cinq
derniers portent sur des fichiers dont le contenu est certain (cache) : des rouges du
projet, pas de la récupération.

## 4. Ce qui reste

1. **Le pack d'assets cuit** (88,7 Go, 231 710 fichiers) et son `Assets.toml` : un
   cook. Tout est là pour le faire — l'ADK du lot DMDE (`Content` de 76 Go,
   `NanosWorldADK.uproject`, `_assets-inventory.json` du 23/09), le moteur
   `D:\Epic Games\UE_5.7`, et `scripts\nanos-build-asset-pack.mjs`, revenu complet
   cette nuit, qui dérive `Assets.toml` du cook. Cuire écrit à travers la jonction
   `WebPortal\Server\adk` dans le lot : à décider, pas à lancer par un outil.
2. **20 scripts incomplets** sous `scripts\` (`narvos-verifier-catalogues.mjs`,
   `narvos-emotes-to-lua.mjs`, `narvos-modular-to-lua.mjs`, `creation-tests.lua`,
   `roster-tests.lua`, `menottes-tests.lua`…) : `python scripts\recuperation\bilan.py
   E:\mes_projet\narvos-reconstruit-final --detail scripts`.
3. **39 fichiers que DMDE a rendus corrompus et qu'aucun agent n'avait lus** (31 sous
   `docs\`, 8 fichiers de build).
4. Relire les cinq gardes rouges du point 3.

## 5. Ce que Hanibes seul peut faire

DMDE tourne en administrateur : je peux le voir, pas le piloter.

- **Balayer D: avec DMDE** (1,5 To libres sur 1,9 : ce qui a été « supprimé » le
  19/09 a de bonnes chances de n'avoir pas été réécrit). Le projet a été DÉPLACÉ de
  `D:\mes_projet\narvosprime-web-prototype` vers E: : `Server\` et le pack cuit peuvent
  revenir dans leur état du 19/09. Uniquement « Récupérer », jamais Appliquer / Écrire /
  Réparer / Initialiser ; récupérer VERS E:.
- **Les « Versions précédentes » de `D:\mes_projet`** (clic droit → Propriétés), si la
  protection du système était active sur D: ; `vssadmin list shadows` en administrateur
  le dit.
- `$F32992\nanos_world` sur E: — toujours vu par DMDE, jamais rendu.
- Changer le disque d'installation par défaut de l'application Xbox.
- **Garder une copie du code hors de E:** (quelques dizaines de Mo sans les assets).
- Supprimer le dossier vide `D:\mes_projet\narvosprime-web-prototype`.

## 6. Sous `E:\mes_projet\`

| dossier | rôle |
|---|---|
| `cache-client-nanos\` | le cache du client, déchiffré (lot de vérité) |
| `narvos-reconstruit-v15\` | ce que les historiques savent seuls (la mesure du 03/10) |
| `narvos-reconstruit-v14\` | idem, avec `INDEX_DMDE.tsv` (celui qu'a utilisé l'extraction finale) |
| `narvos-reconstruit-final\` | l'extraction finale du 03/10, avec `EVENEMENTS.pickle` pour les outils de diagnostic |
| `narvos-reconstruit-final-2026-10-02-20h16\`, `…-23h22\`, `…-2026-10-01\` | les extractions finales précédentes, gardées pour comparaison |
| `_avant_reassemblage_2026-10-03_00h29\` | chaque fichier du projet remplacé cette nuit, tel qu'il était |
| `_orphelins_reassemblage_2026-10-03_00h30\` | les 7 fichiers sortis du projet, et pourquoi |
| `BATTERIE_9_avant_…`, `BATTERIE_10_apres_reassemblage_2026-10-03.txt` | la batterie avant et après |
| `narvos-reconstruit-v4` … `v13` | extractions intermédiaires de mesure (140 Mo chacune) — supprimables |
