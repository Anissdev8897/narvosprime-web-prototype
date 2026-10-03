# Récupération après le formatage du disque E: (26/09/2026)

Le 26/09 vers 20:46, l'application Xbox a formaté le disque E: (10 To) en y
installant Dune. Le projet y vivait depuis sa migration du 19/09 (déplacé, pas
copié) : l'ancien emplacement sur D: n'était plus qu'une coquille vide.

**Le projet vit de nouveau sur `E:\narvosprime-web-prototype`, et nulle part
ailleurs** (consigne de Hanibes, 01/10/2026 : plus aucun dossier sur D:). Les
lots de récupération et les sorties des outils sont sous `E:\mes_projet\`.

## Les sources

Le code survit à trois endroits : ce que DMDE a pu rendre du disque, ce que le jeu
lui-même gardait en cache sur C:, et ce que les agents ont lu, écrit et modifié —
consigné dans leurs historiques.

| source | où | ce qu'elle porte |
|---|---|---|
| **DMDE, fichiers sains** | `E:\mes_projet\narvos-restaure\` et autres lots | le disque à la date de modification du fichier. Le runtime web (`WebPortal\src`, `wasm`, `tools`, `scripts`), `public`, l'ADK. ⚠ Hermes avait classé la racine de WebPortal sous `scripts-astra\outil-react\$F66389`. |
| **cache du CLIENT nanos** (02/10) | `C:\Users\aniss\AppData\Local\NanosWorld\Saved\Packages\` → déchiffré dans `E:\mes_projet\cache-client-nanos\` | tout `narvos/Shared` (catalogues générés compris) et tout `narvos-map-proto/Client` (Lua, WebUI, 781 images), dans leur état FINAL. Voir « Le cache du client ». |
| **Claude Code, fils principaux** | `C:\Users\aniss\.claude\projects\*\*.jsonl` | lectures (lignes numérotées), écritures (fichier entier), modifications (diff positionné) |
| **Claude Code, sous-agents** | `…\<session>\subagents\**\agent-*.jsonl` | les mêmes, mais seul le texte AFFICHÉ est gardé |
| **Hermes** | `…\AppData\Local\hermes\state.db` | `read_file`, `write_file`, `patch` (diff unifié), `terminal`, `search_files` |
| **Codex (« Astra »), base d'historique** (02/10) | `C:\Users\aniss\.codex\thread_history_1.sqlite` | 14 → 18/09 : 368 fichiers modifiés avec leur DIFF POSITIONNÉ, 1 652 commandes résolues et leurs sorties ENTIÈRES. Voir « La base d'Astra ». |
| **Codex, sessions** | `C:\Users\aniss\.codex\sessions\**\rollout-*.jsonl` | ce que la base ne couvre pas (patchs sans position, sorties tronquées) |
| **sorties de shell** | dans les trois historiques | `sed -n`, `cat`, `head`, `grep -n`, `cat -n`, `Get-Content`, `rg -n` |
| **actions de shell** (02/10) | dans les trois historiques | ce qu'une commande FAIT à un fichier sans outil de fichiers : scripts Python et Node rejoués en bac à sable, `sed -i`, `cat > f` / `cat >> f` + heredoc, `@'…'@ \| Set-Content / Add-Content`, `mv`, `cp`, `rm`, `git restore` |
| **skills invoqués** | transcriptions Claude | le `SKILL.md` entier moins son en-tête, injecté à chaque invocation |

⚠ **Seul `narvos-map-proto\Server\` (33 fichiers Lua) ne vient QUE des
historiques** : DMDE voit le dossier (`$F32992\nanos_world`) sans jamais l'avoir
rendu, et le serveur n'envoie pas son code au client. Les 33 sortent complets —
voir « Ce que valent les historiques seuls » pour ce que « complet » garantit.

Non exploités : `C:\Users\aniss\.gemini\antigravity`, `.cursor` et l'historique local
de VS Code (traces de 11/2025 à 07/2026, époque Godot/React — rien de la période
nanos), et le lot `E:\mes_projet\narvos-rebuild` d'Hermes (voir plus bas).

## La chaîne, dans l'ordre

```bash
cd E:\narvosprime-web-prototype\scripts\recuperation

# 0. Les preuves des outils (387 assertions)
python test_reconstitution.py && python test_commandes.py && python test_codex.py
python test_bac.py && python test_scripts.py && python test_cache_client.py

# 1. Le cache du client nanos, déchiffré comme un lot de plus (ne touche pas à C:)
python cache-client-nanos.py --ecrire

# 2. Ce que les historiques savent SEULS — c'est ce passage qu'on mesure
python extraire-historiques.py E:\mes_projet\narvos-reconstruit-v17 --ecrire
python evaluer.py E:\mes_projet\narvos-reconstruit-v17     # contre DMDE (web) ET contre le cache (Lua)
python ecarts.py  E:\mes_projet\narvos-reconstruit-v17 --detail 10            # web
python ecarts.py  E:\mes_projet\narvos-reconstruit-v17 --cache --detail 10    # packages nanos
python bilan.py   E:\mes_projet\narvos-reconstruit-v17 --detail WebPortal/Server/nanos_world/packages

# 3. Les fichiers sains des lots (DMDE et cache), où qu'ils soient rangés
python indexer-dmde.py E:\mes_projet\narvos-reconstruit-v17

# 4. L'extraction FINALE : historiques + instantanés des lots à leur date
python extraire-historiques.py E:\mes_projet\narvos-reconstruit-final --ecrire --dmde=E:\mes_projet\narvos-reconstruit-v17\INDEX_DMDE.tsv
python evaluer.py E:\mes_projet\narvos-reconstruit-final   # doit rendre 100 % : sinon un événement contredit le disque

# 5. Remonter le projet
python assembler-final.py --ecrire       # sauvegarde tout fichier remplacé dans E:\mes_projet\_avant_reassemblage_<date>
python ecarter-orphelins.py --ecrire     # sort ce qu'aucune source ne produit plus
python chemins-vers-e.py --ecrire        # ramène tout chemin du projet à E:
python sante.py E:\narvosprime-web-prototype

# 6. Mesurer
node verifier-lua.mjs E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages --detail
node ../lua-harness/tout.mjs > E:\mes_projet\batterie.txt
python classer-rouges.py E:\mes_projet\batterie.txt      # range les rouges par cause
python verifier-journaux.py                              # Server\ contre les journaux du jeu (voir plus bas)
```

Pour comprendre UN fichier, sans relancer dix minutes de chargement (une extraction
garde ses événements dans `EVENEMENTS.pickle`) :

```bash
python tracer.py   --extraction E:\mes_projet\narvos-reconstruit-v17 "WebPortal\Server\…\Session.lua"
python ruptures.py --extraction E:\mes_projet\narvos-reconstruit-v17 "…"     # où une époque s'ouvre, et pourquoi
python chaine.py   --extraction E:\mes_projet\narvos-reconstruit-v17 "…"     # le report d'une époque à la suivante
python scripts-bilan.py --extraction E:\mes_projet\narvos-reconstruit-v17 [--doutes]   # les scripts qu'on n'a pas su rejouer
python doute.py    --extraction E:\mes_projet\narvos-reconstruit-v17 2026-09-12T07:49:40Z   # UN doute : ce que le script cherchait, ce qu'on tenait
python comparer-manifestes.py <extraction A> <extraction B> [--zone webportal/server/]
```

## Les fichiers

| fichier | rôle |
|---|---|
| `reconstitution.py` | le CŒUR, sans dépendance aux sources : époques, décalages, report entre versions |
| `commandes.py` | ce qu'une commande de shell a lu, écrit ou fait aux fichiers (`actions` : dans l'ordre) |
| `codex.py` | Codex : base d'historique, sessions, `apply_patch`, PowerShell |
| `bac.py`, `bac_python.py`, `bac_node.js` | le BAC À SABLE : rejoue un script d'historique sans rien toucher de réel |
| `cache-client-nanos.py` | déchiffre le cache du client nanos et le pose comme lot |
| `extraire-historiques.py` | lit les sources, pose les événements, rejoue, écrit `fichiers/` + `MANIFESTE.tsv` + `EVENEMENTS.pickle` |
| `indexer-dmde.py`, `lots.py` | rapproche les fichiers sains des lots du projet ; la table des lots |
| `assembler-final.py`, `ecarter-orphelins.py`, `chemins-vers-e.py` | remonte le projet |
| `restaurer-claude-md.py` | les `CLAUDE.md` sont INJECTÉS dans le contexte, jamais lus par un outil : on les reprend dans les transcriptions |
| `evaluer.py`, `ecarts.py`, `bilan.py`, `comparer-manifestes.py`, `tracer.py`, `ruptures.py`, `chaine.py`, `scripts-bilan.py`, `doute.py`, `sante.py`, `verifier-lua.mjs`, `classer-rouges.py` | mesure et diagnostic |
| `verifier-journaux.py` | confronte le Lua reconstruit aux journaux du serveur et du client nanos (piles d'appels, messages) |
| `fusionner.py` | compare le lot d'Hermes à l'extraction (ne sert plus à remonter le projet) |
| `test_*.py` | les preuves : chaque cas est un défaut réel ou une règle à ne pas voir régresser |

## Le cache du client

Quand le client nanos se connecte, il télécharge les fichiers `Client/` et `Shared/` de
chaque package et les garde sur C:. C: n'a jamais été formaté.

- **Les `.lua` y sont brouillés, pas perdus** : chaque octet est combiné (OU exclusif)
  avec le chemin du fichier dans le cache, en minuscules, barres obliques, répété —
  `narvos-map-proto/client/ciel.lua`. Un fichier qui commence par `-- ` sous le package
  `narvos…` commence donc par « CLR » : ce n'est pas un en-tête. 143 `.lua` sur 143 se
  déchiffrent en UTF-8 strict ; un fichier qui ne passerait pas n'est pas posé.
- **C'est l'état FINAL.** À chaque connexion le client ne télécharge que ce qui a
  changé ; la dernière (26/09 à 20:35, serveur lancé à 14:52:54) n'a rien téléchargé,
  et le dernier événement connu des historiques est à 13:52:37. Les journaux le
  prouvent (`…\NanosWorld\Saved\Logs`, `D:\steam\…\Server\.logs`).
- **C'est aussi une MESURE.** 164 fichiers dont on connaît le vrai contenu et que les
  historiques reconstruisent de leur côté : `evaluer.py` les confronte. C'est la seule
  mesure qu'on ait sur le code Lua, et elle vaut pour `Server/`, reconstruit par les
  mêmes moyens.

## La base d'Astra

Les sessions de Codex ne gardent d'un `apply_patch` que le patch — du contexte, pas de
numéro de ligne — et coupent les longues sorties (« …N tokens truncated… »). Sa base
d'historique (`thread_history_1.sqlite`, table `thread_items`), elle, range pour
l'affichage :

- `fileChange` : chaque fichier touché, avec son **diff unifié** (donc ses positions) ;
  un ajout porte le fichier entier ;
- `commandExecution` : la commande **résolue** et sa sortie **entière**.

Les sessions du 18/09 fabriquent leurs commandes par gabarits (`${path}`) que l'analyse
du JavaScript ne suivait pas : 43 modifications et 180 commandes n'avaient jamais été
vues. La base est donc la source ; les sessions ne servent plus que hors des fenêtres
de temps qu'elle couvre.

## Le bac à sable

967 commandes ont modifié des fichiers du projet par un script — `python - <<'FIN' …
s = s.replace(ancien, neuf) … FIN`, `node -e …` — plutôt que par l'outil de
modification. C'était la première cause des fichiers « complets mais périmés ».

Le script est dans la transcription : on le RELANCE, dans l'ordre du temps, contre
l'état reconstitué des fichiers à cet instant. Rien de réel n'est touché : `open`, `os`,
`pathlib`, `glob` (et `fs` pour Node) sont remplacés par un système de fichiers en
mémoire ; `subprocess`, le réseau, etc. sont inertes ou absents.

- Une ligne jamais lue est donnée au script comme une ligne-témoin ; ce qu'il écrit se
  relit, les témoins redeviennent des trous à leur NOUVELLE place.
- **L'horloge du script est celle de sa commande.** `new Date()`, `Date.now()`,
  `datetime.now()`, `time.time()` rendent l'instant où la commande d'origine a rendu son
  résultat. Sans cela un script qui date ce qu'il écrit (`"genere_le"`) y posait l'heure
  du REJEU — une date d'après la perte dans un fichier d'avant — et deux extractions de
  suite ne rendaient pas les mêmes fichiers. ⚠ L'heure posée est celle de la commande à
  quelques secondes près, pas celle, exacte, que le fichier portait.
- **Ce qu'un script GÉNÈRE à l'aveugle n'est pas posé.** Le bac ne tient que le TEXTE que
  les historiques ont vu : un `.glb`, un `.uasset`, un `.png` y est toujours « absent »,
  un dossier dont on ne connaît aucun fichier toujours vide. Un script qui en dépend
  écrit ici autre chose qu'alors (`regression-report.json` rejoué : « 22 assets manquants
  sur 22 » ; `trooper-squelettes.json` : « lus : 0 »). Le bac note chaque réponse de ce
  genre (`aveugles`) et chaque fichier GÉNÉRÉ — écrit sans avoir été lu (`generes`).
  Un fichier généré par un script qui a répondu à l'aveugle n'est pas posé ; s'il était
  connu, il est mis en doute (le script l'a bien réécrit, on ne sait pas avec quoi).
  Un fichier MODIFIÉ EN PLACE (lu, puis réécrit, et qui se ressemble encore) reste
  posé : il tient son contenu de lui-même. L'existence d'un fichier TEXTE inconnu reste
  une réponse ordinaire (un script vérifie le plus souvent sa propre sortie), comme
  celle d'un dossier où le script écrit ensuite.
- **Ce qui est CALCULÉ d'une entrée TROUÉE n'est pas posé non plus.**
  `narvos-manifeste-squelettes.mjs` lit `Assets.toml`, dont on tient 580 lignes sur
  68 418 : il n'y trouve aucune clé et écrit « lus : 0 » sans rien demander à l'aveugle.
  Le bac note les fichiers troués qu'un script a lus (`troues`) ; un fichier qu'il
  génère ensuite n'est posé que s'il PORTE ses trous (une copie, un découpage : les
  lignes inconnues l'ont traversé). Deux gardes contre l'excès, pour les deux règles :
  un contenu LITTÉRAL — ses lignes sont écrites dans le script — ne doit rien à ce que
  le script a lu, et reste posé (le cas courant « créer un module, puis l'inscrire dans
  un `Index.lua` troué ») ; et c'est le script qui l'a écrit qui est en cause, jamais le
  fichier lu.
- **L'indulgence.** La commande d'origine avait réussi. Si le script échoue ici après
  avoir cherché dans un fichier troué un passage qu'on ne tient pas, c'est que ce
  passage est dans un trou : on relance en imposant « présent » à la DERNIÈRE
  vérification incertaine avant l'échec (pas aux précédentes, souvent des gardes
  « déjà fait ? »). Le remplacement ressort comme modification sans position, qui
  attendra d'être placée sur une version où l'ancre se voit.
- **Le doute est étroit.** Un script en ligne dont la vérification échoue sur un
  fichier ENTIER dit que ce fichier n'est pas celui qu'on tient : il est mis en doute
  (son époque est close), lui seul. Une panne du bac, ou un générateur qui lit dix
  sources, ne met rien en doute.
- **Ce que le script a fait POUR DE VRAI se lit dans la sortie de la commande.** Une
  commande « réussie » peut contenir un script qui a ÉCHOUÉ (`python - <<'FIN' … FIN ;
  node autre.mjs` : seul le dernier code de retour compte). Sa trace est dans la sortie
  (`Traceback … File "<stdin>", line N`, `[eval]:N` + `Node.js v…`) : `traces` la lit,
  `echecs_reels` l'attribue à SON script par l'origine (`<stdin>`, `<string>`, `[stdin]`,
  `[eval]`, nom du fichier). Trois cas :
  - il avait échoué, il échoue ici → échec FIDÈLE : pas d'indulgence, pas de doute ;
  - il avait échoué, il réussit ici → on le relance ARRÊTÉ à la ligne où il s'était
    arrêté (`arret_force`) : ce qu'il avait écrit avant compte, le reste non. Si l'arrêt
    ne peut pas se poser, rien n'est appliqué ;
  - il avait réussi (aucune trace) → indulgence et doute comme ci-dessus.
- **Une commande FINIE EN ERREUR n'est pas une commande qui n'a rien fait.** Son code de
  sortie est celui de sa dernière liste : `python - <<'PY' … PY` (le fichier est
  modifié) puis `node --check f && node f` (échec) rend « Exit code 1 ». On suit
  l'enchaînement comme le shell (`commandes.actions_lancees`) : une liste (`;`, retour)
  repart de zéro, `&&` exige que ce qui précède ait réussi, `||` qu'il ait échoué. N'est
  rejoué que ce qui a tourné À COUP SÛR ; l'action qui DÉCIDE du code de sortie a
  échoué, même sans trace. Une commande refusée, arrêtée par son délai, ou dont la
  sortie montre le shell lui-même en défaut (`cd: … No such file`) n'est pas reprise.

## Lire un fichier reconstruit

Un fichier complet ne porte aucun marqueur. Sinon, en commentaire du langage :

| marqueur | sens |
|---|---|
| `[TROU — ligne jamais lue…]` | une ligne par ligne manquante : on sait qu'elle existe, pas ce qu'elle dit |
| `[ANCIENNE VERSION ↓ — … N attendue(s) ici, M connue(s)]` … `[ANCIENNE VERSION ↑]` | ce tronçon a changé de longueur depuis la dernière fois qu'on l'a lu en entier : voici son ancienne forme. `N ≠ M` dit combien de lignes ont été ajoutées ou retirées, pas où |
| `[DERNIÈRE VERSION ↓ …]` `[SÛRE n°K] texte` | des lignes certaines du fichier FINAL, lues dans le tronçon ci-dessus, qu'on ne sait pas replacer dans l'ancien bloc. Posées en commentaire pour ne pas le casser ; `K` est leur numéro final |
| `[SÛRE dans une version intermédiaire…]` | idem, d'une version plus ancienne |
| `[FIN INCONNUE — …]` | la fin du fichier n'a jamais été lue dans sa dernière version |
| `[MODIFICATIONS NON REPLACÉES — N …]` | N modifications connues n'ont pas pu être reportées : leur texte est dans `EDITS_NON_APPLIQUES\` de l'extraction |

Le détail par fichier est dans `MANIFESTE.tsv` (trous, lignes d'ancienne version,
époques, sources, dernier instant connu).

## Règles que les outils appliquent

- **Jamais d'invention.** Ce qu'on ne sait pas est marqué, pas deviné.
- **Une ÉPOQUE est un état du fichier où les numéros de ligne se tiennent.** On ne
  mélange jamais deux époques par numéro : une écriture complète en ouvre une,
  un diff positionné décale les lignes, une lecture qui contredit ce qu'on tient
  prouve que le fichier a changé hors de notre vue.
- **Le report se fait en chaîne**, de la plus ancienne époque à la dernière :
  chaque version est d'abord complétée par celle qui la précède. Entre deux
  repères, même longueur des deux côtés → les lignes se reprennent une à une ;
  longueur changée → l'ancien bloc est posé étiqueté. Les repères partent des
  lignes UNIQUES des deux côtés (un filet décoratif répété n'en est pas un).
- **Une modification sans position attend**, attachée à l'époque où elle a eu lieu,
  et s'applique à cette époque une fois complétée. Une modification DÉJÀ visible ne
  se refait pas, même si son texte neuf contient encore son ancre (insertion).
- **Rien d'après la perte n'entre** (`PERTE`, 26/09 18:00 UTC) : relire un fichier
  reconstruit en ferait « la version la plus récente ».
- **Un événement n'est rejoué qu'une fois** : une session reprise recopie son
  historique.
- **Une sortie de shell ne s'aligne que si elle se COMPTE ou se BORNE** ; sinon on
  n'en garde rien. Elle ne crée jamais de fichier : elle complète un fichier connu.
  - Un programme quelconque au milieu de la commande (`ls`, `node x.mjs`, `wc -l`) est
    un émetteur INCONNU : il emporte son groupe — ce qui n'est séparé de lui par aucun
    `echo` —, pas la commande. Ce qui change l'ÉTAT du shell (`pushd`, `export`,
    `for … do`, `cd -`, une redirection, `||`) écarte toujours tout.
  - Un `grep -n` non borné entre des voisins qui se comptent se reconnaît à la FORME
    de ses lignes ; la coupe n'est prise que si aucune ligne numérotée ne tombe du
    mauvais côté.
  - `$(…)` et les accents graves rendent leur mot INSOLUBLE, pas la commande illisible ;
    `F=$(…)` fait OUBLIER l'ancienne valeur de `F`.
  - Une plage courte en tête de sortie (lignes vides rognées ?) part en lecture
    FLOTTANTE : elle n'est prise que si le fichier tel qu'on le tient la CALE — trois
    lignes reconnaissables d'accord, aucune contre, un seul décalage possible. Elle ne
    prouve jamais, seule, qu'un fichier a changé.
- **Les actions d'une commande se rejouent dans SON ordre** : `cp f f.bak ; python … ;
  mv f.bak f` sauve, casse exprès, restaure.
- **Un fichier sain d'un lot est un instantané à sa date** ; les modifications
  postérieures s'appliquent par-dessus, comme pour toute autre source. Une commande
  est datée de son RÉSULTAT mais écrit avant : si le disque a été photographié pendant
  qu'elle tournait, ce qu'elle a fait à ce fichier y est déjà et n'est pas rejoué.
- **Rien n'est supprimé ni écrasé sans copie.**

## Les pièges payés (chacun a son test)

| piège | effet |
|---|---|
| recoudre par numéro de ligne toutes dates confondues | le même bloc posé deux fois — « already been declared » dans 19 générateurs |
| `Grep` de Claude Code sous Windows | chaque ligne rendue est normalisée comme un chemin : `//` devient `\`. Toute ligne à barre oblique est écartée |
| sortie Bash de Claude Code | ROGNÉE : lignes vides de début et indentation de la première ligne perdues. Un `sed -n '10,20p'` peut décaler d'un rang |
| diff de Claude Code (`structuredPatch`) | chaque TABULATION y devient deux espaces : sans en tenir compte, toute modification d'un fichier tabulé passait pour une nouvelle version |
| lecture Hermes | finit par le numéro de la ligne suivante, vide ; coupe à 2 000 caractères ; compte les retours, pas les lignes |
| diff Hermes d'un fichier Lua | `-` + `-- commentaire` = `--- commentaire` : pris pour un en-tête de fichier, le hunk était amputé |
| session reprise ou compactée | chaque opération figure deux fois |
| heredoc `<<'FIN'` (Bash de Claude Code sous Windows) | chaque paire `\\` est réduite à un seul `\`, sauf devant un guillemet double : le script s'exécute avec le texte réduit |
| sous-agents | pas de résultat brut : seul le texte affiché existe, lignes de plus de 2 000 caractères tronquées |
| sessions Codex | commandes fabriquées par gabarit, patchs sans position, sorties coupées : la base d'historique porte les trois |
| modification en attente dont le texte neuf contient l'ancre | appliquée une seconde fois sur un fichier où elle se voyait déjà : une insertion doublée, « = 1 » devenu « = 100 » |
| mettre en doute tout ce qu'un script en échec avait OUVERT | fermait l'époque de fichiers simplement lus : 295 doutes, presque tous à tort |
| rejouer les actions d'une commande par genre | un défaut volontaire (`cp` → script → `mv`) restait dans le fichier |
| dater de sa FIN un script qui écrit à son début | il passait après l'instantané du disque qu'il avait lui-même produit, et s'y appliquait une seconde fois (362 lignes vraies, 372 rejouées) |
| test « sans octet de contrôle » | laissait passer des clusters binaires : `sante.py` exige de l'UTF-8 strict |
| écrire à travers une jonction | un fichier reconstruit irait écraser l'original dans le lot DMDE |
| écrire un script de correction par heredoc | même piège que plus haut, côté outil : `\\n` devient un vrai retour. Tout code à antislashs s'écrit par l'outil d'écriture |
| tenir pour réussi le script d'une commande réussie | `is_error` ne dit que le DERNIER code de retour : 61 scripts avaient échoué dans des commandes « réussies ». Rejoués avec indulgence, ils appliquaient une modification qui n'avait jamais eu lieu |
| mesurer la réduction des antislashs par « lequel des deux textes réussit » | 9 scripts ne réussissaient que NON réduits — parce qu'ils avaient échoué pour de vrai (une `SyntaxError` née de la réduction). Contre la sortie réelle : texte réduit conforme 53 fois sur 54, texte brut 46. Un rejeu qui réussit ne prouve rien tant qu'on n'a pas regardé ce qui s'était passé |
| ignorer tout d'un script qui avait échoué | il avait écrit un premier fichier AVANT de lever : ne rien appliquer perdait cette écriture (`interface.js` complet mais différent). D'où l'arrêt forcé à la même ligne |
| ignorer toute commande « en erreur » | 157 commandes avaient agi sur des fichiers AVANT d'échouer : 35 scripts en ligne menés à bien, 53 fichiers écrits par heredoc puis lancés. `narvos-audit-packs.mjs` y perdait une modification, et le script suivant, ne retrouvant plus son ancre, le mettait en doute |
| laisser un script rejoué dater ce qu'il écrit | `"genere_le": "2026-10-02T21:27…"` dans un manifeste du 04/09 : l'heure du rejeu. L'horloge du bac est maintenant celle de la commande |
| poser ce qu'écrit un générateur rejoué sans ses binaires | des manifestes et des rapports au contenu INVENTÉ (« lus : 0 », « 22 manquants sur 22 ») : le bac répondait « absent » pour tout `.glb` et tout `.uasset` |
| ne RIEN poser d'un script qui a regardé à l'aveugle | le script de migration du 19/09 parcourt aussi un dossier inconnu : les 159 fichiers qu'il n'avait fait que corriger passaient en doute. Seul ce qui est GÉNÉRÉ et CALCULÉ est écarté |
| poser ce qu'un générateur calcule d'une entrée trouée | `trooper-squelettes.json` : « lus : 0 » — `Assets.toml` connu à 1 %, les lignes inconnues comptées pour rien, aucune réponse à l'aveugle pour le trahir |
| attribuer une trace au premier script venu | `node --check f.mjs` échoue, la trace nomme `f.mjs` : elle n'appartient pas au `node -e` voisin. L'origine de la trace tranche |
| écarter toute commande pour UN segment inconnu | 21 457 commandes sur 30 904 « non analysables » pour un `ls`, un `node x.mjs`, un `wc -l` au milieu de lectures séparées par des `echo`. Rendu opaque au lieu de fatal : 7 573 → 9 154 commandes alignées, +32 663 lignes lues ; à partir des seuls historiques, 8 fichiers web et 5 fichiers Lua de plus identiques au disque, et les « complets mais différents » passent de 36 à 30 et de 3 à 1 (une lecture de plus révèle un fichier périmé) |
| croire la sortie d'erreur rejetée en fin de sortie | elle est entrelacée dans l'ordre (`ls: cannot access …` précède le `echo` suivant) : la précaution prise pour les fins de sortie écartait des lectures sûres |
| `grep -rn motif UN_FICHIER` | `-r` ne nomme les fichiers que s'il en parcourt plusieurs : on attendait `chemin:N:`, les lignes `N:` étaient jetées |
| environnement vide dans le bac Node | `process.env.TEMP + "/x.json"` écrivait dans `undefined/x.json`, un fichier fantôme DANS le projet. L'environnement stable de la machine est donné ; une variable inconnue est une réponse à l'aveugle |
| écrire un correctif de test par heredoc (encore) | le 03/10, deux fois dans la même matinée : `"f\\nl1"` devenu un vrai retour dans `test_commandes.py`, et `E:\\narvosprime…` coupé en deux lignes dans l'index de la mémoire. L'outil d'écriture, toujours |
| replier un chemin relatif sur la racine du projet « au cas où » | les transcriptions de TOUS les projets de la machine sont lues : un `grep -n … .env.example` lancé dans `C:/…/goldluxuryking-shop/server` devenait une époque de NOTRE `.env.example` (50 lignes rendues 88, dont 72 trous). Un dossier courant connu fait foi ; le repli ne vaut que s'il est inconnu (`Dossier.cle_connue`) |

## Ce que valent les historiques seuls

Mesuré le 03/10/2026 sur l'extraction SANS lots (`narvos-reconstruit-v17`) :

| vérité | comparés | identiques | complets mais différents | incomplets |
|---|---|---|---|---|
| runtime web (fichiers sains de DMDE) | 901 | 828 (92 %) | 30 | 43 |
| packages nanos (cache du client) | 164 | 130 (79 %) | 1 | 33 |

Le 01/10 : 804 sur 901 pour le web, et aucune mesure sur le Lua. Sur les packages, la
même mesure rendait 97 identiques avant le rejeu des scripts, 111 après, 120 avec la
base d'Astra, 123 avec les ajouts, copies et suppressions rejoués dans l'ordre, 125 en
lisant dans la sortie de chaque commande ce que son script avait fait pour de vrai,
130 en ne jetant plus une commande entière pour un seul segment inconnu.
Reprendre les commandes finies en erreur n'a pas changé ces comptes mais a complété
quatre scripts de plus et retiré un fichier renommé depuis juillet ; écarter ce qui est
calculé à l'aveugle a fait sortir de la comparaison un fichier « complet mais
différent » (un cache de manifeste inventé par le bac). Dans `scripts\` (les
générateurs et les harnais, qu'aucune vérité ne mesure), 338 fichiers sortaient
complets au départ, 376 à la fin.

Le « complet mais différent » qui reste côté Lua est un catalogue RÉGÉNÉRÉ par son
générateur (`Widgets.lua` : une vraie exécution, que le bac ne refait pas et dont nul
n'a relu la sortie). Les deux autres du 02/10 n'en sont plus : une lecture du 15/09,
jetée jusque-là avec sa commande, montrait le bloc ajouté à `inventaire.css`, et une
autre a révélé que `Spawnables.lua` avait changé (il sort maintenant « ancienne
version », ce qui est vrai). Côté web, 24 des 30 sont des fichiers que le DISQUE
connaît plus récents que tout historique, et 20 commandes PowerShell du 02 et du
03/08 modifiaient des fichiers en place (`[regex]::Replace` puis `WriteAllText`) :
ce genre-là n'est pas rejoué. **C'est le risque qui reste sur `Server/`** : 33
fichiers complets, dont — à ce taux, 1 sur 131 — un peut porter une modification que
personne n'a consignée. Deux contre-épreuves indépendantes :

- les gardes de la batterie (`appels-check`, `cablage-check`, `appels-distants-check`,
  `ui-liens`) confrontent `Server/` au vrai `Shared/` et au vrai `Client/` : un appel
  vers une fonction disparue s'y voit ;
- **les journaux du jeu** (`verifier-journaux.py`), qui n'étaient pas sur le disque
  perdu. Chaque avertissement Lua y laisse sa pile d'appels, donc des numéros de ligne
  DATÉS : `Voyage.lua:282`, `Voyage.lua:328` et `Index.lua:4116` du 26/09 tombent à la
  ligne près dans les fichiers reconstruits, et les 108 messages que le serveur et le
  client ont écrits ce jour-là se retrouvent tous dans le code. Aucun cadre de pile
  n'est faux. Ce contrôle ne couvre que les lignes par où un avertissement est passé.

## Où en est le projet remonté (03/10/2026)

L'extraction finale rend 100 % des deux vérités (901 fichiers web, 164 fichiers des
packages). Dans `E:\narvosprime-web-prototype` :

| | 01/10 | 02/10 | 03/10 |
|---|---|---|---|
| packages nanos complets | 137 sur 204 | 197 sur 198 | 197 sur 198 (le dernier est un journal de diagnostic) |
| lignes manquantes dans les packages | 15 404 | 0 | 0 |
| `.lua` qui compilent | 136 sur 164 (25 troués) | 175 sur 175 | 175 sur 175 |
| `scripts\` (générateurs, harnais) complets | — | 366 sur 394 | 376 sur 394 |
| batterie `lua-harness/tout.mjs` | 39 verts, 64 rouges | 85 verts, 22 rouges | 87 verts, 20 rouges — 11 745 assertions réussies (réassemblage du 03/10 à 09 h 56 : `creation` et `sorts-vfx-check` passés au vert ; le détail des rouges ci-dessous date de la nuit) |
| journaux du jeu (`verifier-journaux.py`) | — | — | 4 cadres justes, 0 faux ; 108 messages sur 108 retrouvés |

Les 22 rouges : 9 demandent le pack cuit ou l'ADK (`Assets.toml`, `DefaultEngine.ini`,
un manifeste), 8 sont des harnais ou générateurs eux-mêmes incomplets (dont
`chaine-generateurs-check`, qui lit une ligne commentée de `narvos-verifier-catalogues.mjs`),
5 sont des gardes qui parlent du vrai code (`z-absolu-check`, `zaaps-serveur`,
`sorts-vfx-check`, `menottes-cablage-check`, `roster`) — à lire un par un, ils étaient
peut-être déjà rouges avant la perte. `python classer-rouges.py <sortie de tout.mjs>`
les range. Le 03/10, `pack-staging-check` est passé au vert (son harnais est revenu
complet par une commande finie en erreur) et sept fichiers qu'aucune source ne produit
plus ont quitté le projet — cinq manifestes et un rapport au contenu inventé par le
bac, un fichier renommé en juillet (`E:\mes_projet\_orphelins_reassemblage_2026-10-03_00h30`).

## Ce que le lot d'Hermes vaut

`E:\mes_projet\narvos-rebuild` (28/09) n'est PAS une source : c'est une
reconstruction faite par Hermes après la perte, à partir de sa seule base. Mesuré
sur ses 52 fichiers : 27 identiques à l'extraction (bonne contre-épreuve), les
autres sont des reconstructions PARTIELLES sans marqueur exploitable (« LIGNES
141-239 NON RÉCUPÉRÉES » en commentaire), des versions plus anciennes, des
fichiers rangés au mauvais endroit (`narvos/Server/…` au lieu de
`narvos-map-proto/Server/…`), des échafaudages réécrits (`narvos/Client/Index.lua`),
ou des fichiers DMDE corrompus. L'extraction, qui rejoue aussi la base d'Hermes,
sait tout ce qu'il sait.

## Limites connues

- **« Complet » ne veut pas dire « à jour »** pour ce qui n'a que les historiques :
  voir le taux mesuré plus haut. Une modification faite par un outil dont on n'a pas la
  trace (un générateur lancé pour de vrai, une main dans un éditeur) ne se voit pas.
- **Le pack d'assets cuit est perdu** (`Server\Assets\narvos`, 88,7 Go, 231 710
  fichiers) et son `Assets.toml` avec lui : 68 418 lignes dont 580 connues. Les
  catalogues générés sont revenus par le cache du client ; les régénérer demandera un
  nouveau cook. Ce qu'il faut pour cuire est là : l'ADK du lot DMDE
  (`E:\mes_projet\narvos-restaure\racine-projet\Server\adk`, `Content` de 76 Go,
  `NanosWorldADK.uproject`, `_assets-inventory.json` du 23/09), le moteur
  (`D:\Epic Games\UE_5.7`), et `scripts\nanos-build-asset-pack.mjs`, revenu complet le
  03/10, qui dérive `Assets.toml` du cook (`Saved\Cooked`, vide dans le lot). Cuire
  écrirait à travers la jonction `WebPortal\Server\adk` dans le lot : c'est une
  décision de Hanibes, pas de l'outil.
- **Des générateurs restent incomplets** (`narvos-verifier-catalogues.mjs`,
  `narvos-emotes-to-lua.mjs`, `narvos-modular-to-lua.mjs`… : 20 sous `scripts\`) :
  voir `bilan.py … --detail scripts`. Une ligne d'ancienne version de
  `narvos-verifier-catalogues.mjs` porte un vrai octet de contrôle (un `\b` de
  regex devenu retour arrière dans une version intermédiaire) : `sante.py` le
  compte « corrompu », c'est le seul.
- **Un rejeu n'est ni la vérité ni une invention, mais entre les deux.** Un
  fichier généré par un script rejoué porte l'heure de sa commande à quelques secondes
  près ; ce que le bac ne pouvait pas savoir (binaires, dossiers inconnus, entrées
  trouées) n'est plus posé — mais un script qui lit un fichier texte que nul agent
  n'a jamais lu reçoit encore « absent » sans que rien le signale.
- **Trois pistes que seul Hanibes peut suivre** (DMDE tourne en administrateur, et les
  clichés de volume demandent une console élevée) : `$F32992\nanos_world` sur E: ;
  surtout **D:** (1,5 To libres sur 1,9), d'où le projet a été DÉPLACÉ le 19/09 — ses
  fichiers y sont « supprimés », pas formatés : un balayage de D: peut rendre `Server\`
  et le pack dans leur état du 19/09 ; et les « Versions précédentes » de
  `D:\mes_projet` (clic droit → Propriétés), si la protection du système était active
  sur D: — `vssadmin list shadows` en administrateur le dit en dix secondes.
- Tout est sur UN disque USB que l'application Xbox a déjà formaté une fois.
  Changer son disque d'installation par défaut, et garder une copie du code
  ailleurs.
