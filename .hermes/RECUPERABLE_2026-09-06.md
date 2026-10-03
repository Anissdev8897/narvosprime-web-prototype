# Ce qu'on peut récupérer sur les ~250 Go d'assets — décisions à prendre

**Date :** 2026-09-06 — **Source :** audit du 2026-09-03 (≈ 65 Go récupérables, non exécuté).
**Aucun fichier n'a été supprimé, renommé ni déplacé.** Ce document est une liste de **décisions**, pas un inventaire.

---

## 0. Mesures (faites le 2026-09-06, lecture seule)

**Inventaire du disque** (`WebPortal/public/models/`) :
```
33 958 fichiers   (find . -type f | wc -l)
```
Poids par dossier racine (mesuré `du -sh */`) :

| Dossier | Poids | Dossier | Poids |
|---|---|---|---|
| personnages | 83 Go | vehicules | 5,0 Go |
| systemes | 28 Go | export | 4,5 Go |
| creatures | 28 Go | vfx | 2,4 Go |
| environnements | 25 Go | materials | 1,6 Go |
| Maps | 21 Go | pnj | 1,2 Go |
| nature | 13 Go | audio | 994 Mo |
| armes | 13 Go | interface | 808 Mo |
| batiments | 11 Go | launcher | 564 Mo |
| divers | 8,0 Go | textures | 227 Mo |
| assets_character | 7,4 Go | plugins_cpp | 185 Mo |
| animations | 6,9 Go | vehicule | 113 Mo |
| | | spells · pet · pnj_monstre · voice · HUD_ | 33+53+13+0+0 Go |

**Ce que le RUNTIME charge réellement** (`WebPortal/scripts/audit-runtime-assets.mjs` — attention : il est dans `WebPortal/scripts/`, pas `scripts/` ; à lancer depuis `WebPortal`) :
```
GLB référencés par src/rpg/** : 380 présents, 0 introuvables
Poids disque total : 6195.9 MB
Poids par dossier charge : Maps 2985.5 · armes 1481.7 · personnages 913.5 ·
animations 534.3 · assets_character 168.2 · divers 70.3 · vehicule 15.1 ·
creatures 11.3 · pet 7.2 · pnj 4.2 · pnj_monstre 3.0 · nature 1.6 (MB)
```
**Donc : 6,2 Go référencés par `src/rpg` sur ~244 Go mesurés (2,5 %).** Le plus lourd référencé est `Maps/forge_map/halo_map.glb` (2 984,5 Mo à lui seul).

⚠ **Ce qu'il ne faut PAS en conclure seul :** `audit-runtime-assets.mjs` ne lit que `src/rpg/**` (et exclut `.test`/`.bench`). D'autres référents existent :
- `src/data/asset-catalog.json` : 243 occurrences de `/models/` · `src/data/parts-manifest.json` : 221 occurrences — catalogues consommés par le WebPortal ;
- les packages nanos (navigateur) chargent des GLB par chemin web : `Vehicles.lua`, `Npc.lua` (`/models/pnj_monstre`), `MapLoader.lua`, `Weapons.lua`, `Emotes.lua`/`Animations.lua` — **beaucoup de chemins sont construits par concaténation** (interdit n°3 du cahier : en cas de doute → « à vérifier », jamais « supprimable »).

---

## 1. Décisions à prendre (une ligne par lot)

| Lot | Poids mesuré | Pourquoi c'est récupérable | **Ce qu'on perd si on se trompe** |
|---|---|---|---|
| **A. Fichiers de 0 octet** | **5 570 fichiers** (≈ 0 Mo) | Aucun contenu : un fichier de 0 octet ne charge rien, ne se lit pas, ne se cuite pas. Artefacts d'exports/échecs manifestes. | Rien, **à condition** qu'aucun ne serve de marqueur de présence (ex. `.keep`, verrous de scripts, routes `readFile` qui testent l'existence). **À vérifier** : lister le chemin des 5 570, croiser avec `src/` et `scripts/`, puis décider. |
| **B. Packs jamais chargés** (tout ce que ni `src/rpg`, ni les catalogues JSON, ni les packages nanos ne référencent) | **≈ 238 Go non référencés par `src/rpg`** (244,2 mesurés − 6,2 chargés) ; les gros suspects : personnages 83 Go, systemes 28 Go, environnements 25 Go, Maps 21 Go (seul `halo_map.glb` 2,98 Go est chargé), nature 13 Go, armes 13 Go, batiments 11 Go, divers 8 Go, assets_character 7,4 Go, animations 6,9 Go, export 4,5 Go | C'est le gisement évoqué par l'audit du 03/09 (≈ 65 Go). Le runtime ne charge que 380 GLB nominativement. | **Lourd.** (1) Le WebPortal sert `public/` : *toute* route qui pointe un chemin supprimé rend `text/html` 200 au lieu de 404 — casse silencieuse, `tsc` ne la voit jamais (interdit n°2). (2) Les packages nanos référencent des `path = "/models/…"` (Vehicles.lua etc.) non couverts par `audit-runtime-assets.mjs`. **Décision à prendre en deux temps** : lancer l'extension du croisement (audit + catalogues JSON + packages) → produire la liste exacte par fichier → seulement alors supprimer par **fichier**, jamais par dossier. |
| **C. Variantes `.med.glb` / `.low.glb`** | **48 fichiers · 0,73 Go** | Aucune référence `*.med.glb`/`*.low.glb` détectée dans `src/rpg` (le runtime ne charge que des `*.glb` nus) ; ce sont des qualités intermédiaires d'un pack d'origine. | **Qualité d'affichage** si un loader sélectionne la variante par suffixe (à vérifier par grep `\.med\.glb`/`\.low\.glb` dans `src/` + packages avant toute décision). Risque faible mais à confirmer. |
| **D. LOD isolés `*_LOD*`** | **161 fichiers · 0,62 Go** | La convention du dépôt (commentaire de `narvos-manifeste-brut.mjs`) : « les LOD séparés, qu'Unreal sait reconstruire lui-même » — ils ne doivent jamais être importés comme assets. | Peu : si un importeur Unreal les consomme directement (à vérifier : aucun manifeste ne les liste — le `--exclure 'LODs'` du manifeste FBX le confirme pour les 8 packs). |
| **E. Paires `<pack>` / `<pack>_original` (KTX2 vs original)** | **1 seule paire mesurée** : `personnages/ZombieSoldierPack_original` (1 fichier, 0 octet — apparemment vide/placeholder) | La piste KTX2/original **ne se vérifie pas** sur ce disque : presque aucune paire `_original` trouvée (les appellations différentes ?). | Le seul `ZombieSoldierPack_original` peut être un dossier de travail en cours → **à ouvrir** avant toute action : rien à décider pour l'instant. |
| **F. Doublons exacts (mêmes octets, deux noms)** | **NON MESURÉ — 7 min de timeout** sur le hachage complet (250 Go). Groupes de tailles identiques observés : 69×1 398 560 o, 50×8 181 872 o, 42×8 181 868 o, 41×5 140 593 o, 40×398 845 o, 40×328 986 o, 39×371 739 o, 36×56 640 o, 35×10 626 848 o, 28×10 626 852 o, 26×8 288 732 o, 22×8 261 456 o… | Des groupes de même taille ne sont **pas** des doublons prouvés (deux GLB différents peuvent faire exactement la même taille — peu probable mais possible). Le hachage md5 par groupe ≤ 3 Go était trop long combiné au walk. | **Moyen.** Supprimer un « doublon » qui ne l'est pas = perte d'une variante. **Décision :** lancer UNIQUEMENT le hachage des groupes de taille identiques (script dédié, en fond, en excluant les fichiers > 2 Go), pas le disque entier : on vérifie alors en minutes ce que 250 Go ne justifiaient pas. |
| **G. `audio` / `textures` / `launcher` / `plugins_cpp` / `interface` / `vfx` / `materials` / `export`…** | audio 994 Mo · interface 808 Mo · launcher 564 Mo · textures 227 Mo · plugins_cpp 185 Mo · vfx 2,4 Go · materials 1,6 Go · export 4,5 Go | Aucun de ces dossiers n'apparaît dans les 380 GLB du runtime (ce sont des binaires/audio/UI — le runtime audit ne les mesure pas, à eux seuls) ; `export` et `launcher` ressemblent à des artefacts de build. | **À vérifier avant tout** : audio/textures/interface sont souvent servis au navigateur du jeu (WebUI) — les catalogues nanos peuvent y faire référence. « À vérifier », pas « supprimable » (interdit n°3). |
| **H. 5 570 fichiers de 0 octet** (revoir) | cf. lot A | idem | idem |

---

## 2. Recommandation d'ordre (zéro suppression tant que non prouvé)

1. **Lot A** — lister les 5 570 chemins vides, croiser avec grep dans `src/`, `scripts/`, `packages/` ; s'il n'y a aucune lecture, décider la suppression (le rapport de gain est nul mais le bruit de disque en clusters est réel).
2. **Lot F** — hachage ciblé des groupes de tailles identiques (script dédié, exclusion des > 2 Go) → liste des doublons EXACTS.
3. **Lot C/D** — deux greps ciblés (`.med.glb`, `.low.glb`, `_LOD`) dans `src/`, `WebPortal/scripts/`, `packages/` → verdict supprimable ou non (probablement supprimable).
4. **Lot B** — étendre le croisement : sortie de `audit-runtime-assets.mjs` (fait, 380 GLB) + `asset-catalog.json`/`parts-manifest.json` (464 chemins) + `grep "/models/"` dans `packages/` (Vehicles.lua : 6+, Npc.lua : 6+, MapLoader, Emotes/Animations construits par concaténation) → **liste ferme par fichier** → décision par fichier.
5. **Lot E** — ouvrir `ZombieSoldierPack_original` (1 fichier 0 o) pour comprendre ; au pire, décision nulle.
6. **Lot G** — ne pas toucher sans croisement avec les catalogues nanos (audio/interface/textures très probablement référencés par la WebUI).

## 3. Ce qui n'a PAS pu être mesuré (dit franchement)

- **Hachage complet des doublons : non fait** (250 Go, temps estimé > 10 min en lecture disque ; timeout à 7 min ; reporté en lot F ciblé).
- **Poids exact par fichier des gros dossiers** : mesuré par `du` agrégé par dossier racine, pas fichier par fichier (walk complet trop long en Python ; le `du` shell est fiable pour les totaux).
- **Lectures `Server/Assets` (cook) : non faites** — consigne explicite « pas de cook » ; l'audit du 03/09 (≈ 65 Go) reste à revalider contre l'état actuel du cook.