# GLB retaillés + manifeste d'import — 2026-09-10

Suite de [MISSION_KIMI_BRANCHEMENT_2026-09-10.md](MISSION_KIMI_BRANCHEMENT_2026-09-10.md)
(§3.C et §3.D). Tout est mesuré sur disque ; les originaux n'ont jamais été modifiés,
rien n'a été supprimé.

---

## §3.C — le script et les 3 GLB

### Le script

`scripts/narvos-resize-glb-textures.mjs` — comble le trou entre
`narvos-degraisser-glb.mjs` (animations seules, les ignorerait en silence) et
`narvos-textures-vers-png.mjs` (extensions illisibles seules). Motif de
compression repris de `WebPortal/scripts/puzzle-chunks.mjs:203-213` :
`textureCompress({ encoder: sharp, resize: [MAX, MAX] })`, dépendances déjà dans
`WebPortal/` (sharp, @gltf-transform/core, /functions).

Règles implémentées :

- **sortie PNG, jamais WebP** (`targetFormat: "png"` — alpha et normales
  préservées, aucun `EXT_texture_webp` introduit) ;
- **simulation par défaut, `--apply` pour écrire** ;
- **original jamais modifié** : convention de `narvos-degraisser-glb.mjs` —
  dossier frère `<dossier>_retailles/` (fichier seul : `<nom>_retaille.glb`) ;
- **deux seuils** : `--seuil 2048` (acceptable tel quel) et `--max 1024` (cible
  de retaillage). Un seul seuil aurait forcé à retailler le smartphone, que la
  mission veut intact ;
- **intégrité par relecture** du fichier écrit : nodes / meshes / accessors /
  materials / animations / skins / textures identiques à l'original, toutes les
  textures ≤ cible, aucune extension illisible dans `extensionsRequired` ;
- **garde non vide** : 0 GLB trouvé = arrêt sur erreur, pas un succès silencieux.

`node scripts/lua-harness/syntaxe-check.mjs` : **92 générateurs compilent**
(91 + le nouveau script, qui est couvert par le harnais).

### Exécution — sorties brutes

Simulation :

```
=== SIMULATION (ajouter --apply) ===
Cible : WebPortal/public/asset_game/a_trier/glb_a_degraisser (dossier) — retaillage à 1024px au-delà de 2048px
3 fichier(s) .glb trouvé(s)

✓ cc0_-_keypad_door_lock.glb  22.8 Mo → 2.4 Mo estimés  (−89.5 %)  [4096², 4096², 4096², 4096²]
· modern_generic_smartphone.glb  (0.6 Mo)  CONFORME — 3 texture(s) : 2048², 2048², 2048² — non touché
✓ sci-fi_walkie-talkie.glb  57.3 Mo → 3.3 Mo estimés  (−94.3 %)  [8192², 8192², 8192², 8192²]

Poids avant : 80.1 Mo   après : 5.7 Mo   gain : 74.4 Mo (92.9 %)
```

`--apply` (tailles relues sur disque, en octets) :

| GLB | avant | après | gain | intégrité |
|---|---:|---:|---:|---|
| `sci-fi_walkie-talkie.glb` | 60 106 856 o (57,3 Mio) | 3 447 940 o (3,3 Mio) | −94,3 % | OK (relecture) |
| `cc0_-_keypad_door_lock.glb` | 23 918 964 o (22,8 Mio) | 2 520 340 o (2,4 Mio) | −89,5 % | OK (relecture) |
| `modern_generic_smartphone.glb` | 676 976 o | **inchangé** | — | DÉCLARÉ CONFORME (3 × 2048² ≤ seuil) |

(Les « 60,1 / 23,9 Mo » des audits sont des Mo décimaux ; les chiffres du script
sont des Mio binaires — mêmes fichiers, 60 106 856 o dans les deux cas.)

### Re-vérification indépendante

`node scripts/narvos-origine-glb.mjs` sur les copies retaillées **et** en place
dans `models/` :

```
=== defauts qui rendent un GLB muet a l'import Unreal ===
       0  KHR_texture_basisu
       0  EXT_texture_webp
       0  WorldGridMaterial
```

⚠ Effet de bord attendu : `asset.generator` passe de « Sketchfab-N » à
« glTF-Transform vN » sur les deux copies retaillées — gltf-transform réécrit
l'en-tête. Aucun impact à l'import, mais la provenance n'est plus lisible dans
le fichier : elle reste traçable via les originaux, laissés en place.

### Destinations dans models/

La taxonomie ([CATALOG.md](../WebPortal/public/models/CATALOG.md)) n'a **pas de
catégorie `props/`** : les props tombent dans `divers/` (« Props et objets non
classés ailleurs »). `interface/` est l'UI 2D (HUD, icônes) — mauvaise réponse
pour des meshes. Un dossier par prop, comme `divers/chest` ou `divers/ball` :

| GLB | triangles (audits) | destination |
|---|---:|---|
| walkie-talkie retaillé | 28 670 | `WebPortal/public/models/divers/walkie_talkie/sci-fi_walkie-talkie.glb` |
| keypad retaillé | 1 986 | `WebPortal/public/models/divers/keypad_door_lock/cc0_-_keypad_door_lock.glb` |
| smartphone (copie conforme, identique à l'original) | 2 656 | `WebPortal/public/models/divers/smartphone/modern_generic_smartphone.glb` |

Les originaux restent dans `asset_game/a_trier/glb_a_degraisser/` et les copies
retaillées intermédiaires dans `…/glb_a_degraisser_retailles/` — rien supprimé.
CATALOG.md est généré par `asset-catalog.mjs` et non édité à la main : il sera
régénéré au prochain passage du catalogue (script absent de `scripts/` à cette
date — voir incertitudes).

---

## §3.D — le manifeste d'import

**Fichier : `docs/MANIFESTE_IMPORT_20260910.json`.**

### Le format — trouvé, pas inventé

Le script qui exige la clé est `scripts/adk-import-narvos.py` :
`donnees["racine"]` et `[e["fichier"] for e in donnees["fichiers"]]`, lus sans
valeur par défaut (d'où le `KeyError: 'racine'`), chemins **absolus en slashes
avant** (un commandlet Unreal tourne depuis `Engine/Binaries/Win64/` — un chemin
relatif n'y est jamais résolu contre le dépôt, mesuré deux fois sur le projet).
Le gabarit exact est celui produit par `narvos-manifeste-brut.mjs` (clés
`genere_le / reference / racine / total_analyses / importables / ecartes_ktx2 /
fichiers[{fichier, verdict, os}]`). Le manifeste suit ce gabarit et ajoute par
ligne `type`, `action`, `exclusions`, `notes` — ignorés par le consommateur,
lus par le patron.

`racine` = `E:/narvosprime-web-prototype` (contient les 17 lignes ;
aucune ne produit de `..` en `relpath` — vérifié).

### Contenu — 17 lignes

| # | asset | ligne(s) |
|---|---|---:|
| 1 | City_Traffic_Pro | 1 — `DEJA_STAGE` dans `adk/Content/City_Traffic_Pro/` : **à cuire, pas à importer** (587 uasset, 0 fois dans Assets.toml) |
| 2 | Retro Police Station | 1 (Content/RetroPoliceStation ; Developers/ hors du chemin) |
| 3 | Crystals and Crafting | 3 (Meshes/ + Materials/ + Textures/ — jamais Levels/, 897 Mo de démo) |
| 4 | MultiplayerHandcuffs | 1 (SM_Handcuff + AS_Handcuffed sur UE4_Mannequin) |
| 5 | Ridable MotorBikes | 3 (Meshes + Materials + Textures — MESHES SEULEMENT, PhysX/Apex morts) |
| 6 | Security Camera Vol 01 | 1 (10 FBX + 90 PNG 4096² → downsizing 1024² à prévoir) |
| 7 | POLYGON Sci-Fi Worlds | 1 (hydroponie + cristaux ; Developers/Collections exclus) |
| 8 | Quarantine Medical Tent | 1 (Maps/ 104 Mo exclues) |
| 9 | Orion Mars Med Lab | 2 (MedLab — SM_VideoCamera + BP — et LivingQuarters ; Maps/ 196 Mo et Movies/ 83 Mo exclus) |
| 10 | Cartes Defender | 3 fichiers (Lvl1/2/3) + parent `BP_LootSecurityClearanceCardParent` nommé en dépendance |

Exclusions nommées dans le bloc `exclusions_nommees` : Maps/+BuiltData
(196/104 Mo/1,3 Go), Movies/ (83 Mo), Developers/+Collections/, le pack Unity
entier (`moteur_unity/`, DesireFX invérifiable + doublon), Blueprints/ des motos.

### Preuve d'existence — et la trouvaille Defender

Chaque chemin du manifeste a été testé par `os.path.exists` avant écriture, puis
**revalidé après écriture en relisant le JSON** : **17/17 lignes, 0 chemin mort**
(+ les 3 GLB du bloc informatif). La première validation a trouvé **3 chemins
morts** — les cartes Defender. Ce n'était pas une faute de frappe :

### Renommages effectués (tous réversibles, `mv` inverse)

1. **Motos** (demandé par la mission). Le ` & ` de « damage & animations » +
   la triple imbrication portaient les chemins à **426 caractères** :
   `os.walk` lisait **0 fichier en silence**. Mesuré avant de toucher quoi que
   ce soit : le renommage seul ne suffisait PAS (365 > 260). Les trois
   enveloppes ne contenaient **aucun fichier** (vérifié) — le dossier projet a
   été remonté directement sous `asset_epoque_moderne/RidableMotorBikesMultipla/`.
   Preuve après coup : **os.walk lit 1 462 fichiers, chemin le plus long 250
   caractères**. Les enveloppes vides sont laissées en place.
2. **Defender** (découvert en validant le manifeste — même pathologie, non
   signalée dans les audits). Double emboîtement « Defender - Co-Op Top-Down
   Shooter - Unreal Engine » ×2 → chemins jusqu'à **326 caractères** ; les 3
   cartes (276) étaient invisibles à Python tout en existant pour bash. Les deux
   enveloppes renommées `Defender/Defender`. Preuve : **os.walk lit 3 824
   fichiers, plus long 244**, les 3 cartes + le parent existent pour Python.

Les deux renommages sont documentés dans le bloc `renommages` du manifeste avec
chemins avant/après.

---

## Ce dont je ne suis pas sûr

- **Le manifeste n'est pas un plan d'exécution testé.** Les entrées « dossier »
  ne sont pas consommables par `adk-import-narvos.py` (qui importe des FICHIERS
  via Interchange) : elles adressent la filière staging/migration (copie vers
  `adk/Content/` + ouverture 5.7 + `adk-ranger-migres.py`), qui est TA chaîne.
  Le format respecte les clés que ton script exige ; l'ordonnancement des
  migrations 4.19/4.22/4.26/5.0/5.2 → 5.7 est à ta main.
- **`SM_Prop_Hydroponic_Plant_01/02/03` : 3 espèces ou 3 tailles ?** Toujours
  ouvert — tranché à ton import par lecture des bbox (mission §3.B).
- **Cinematics/ d'Orion** : ni nommé en exclusion par la mission ni mesuré dans
  les audits ; il suit Maps/Movies dans l'esprit (démo), mais je ne l'ai pas
  exclu formellement.
- **Versions UE du pack Defender non re-mesurées** : le manifeste liste les 3
  cartes au niveau fichier ; l'audit qui couvre Defender ne chiffre pas la
  version moteur dans les sections lues ici.
- **Licences** : Security Camera Vol 01 n'a aucun fichier de licence ; les GLB
  Sketchfab ne déclarent CC0 que dans le nom du keypad. Rien de neuf depuis les
  audits — rappel, pas un contrôle refait.
- **CATALOG.md** renvoie à `scripts/asset-catalog.mjs`, absent de `scripts/` à
  cette date : le régénérer suppose de retrouver ce script ailleurs ou d'accepter
  un catalogue en retard sur les 3 nouveaux dossiers de `divers/`.
- **`glb_a_degraisser_retailles/`** (copies intermédiaires) et les originaux
  coexistent désormais avec `models/divers/` : trois copies du même asset. Je
  n'ai rien supprimé (règle) — le ménage est une décision du patron.
