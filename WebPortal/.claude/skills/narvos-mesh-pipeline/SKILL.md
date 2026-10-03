# narvos-mesh-pipeline

Mémoire du pipeline Unreal → GLB → chunks → runtime. **À invoquer avant toute modification de `scripts/puzzle-chunks.mjs`, `scripts/assets-to-ktx2.mjs`, `StreamingPuzzleMap.tsx`, ou avant tout diagnostic de « morceaux de map manquants / textures délavées / trous ».**

Tout ce qui suit a été MESURÉ sur `halo_map.glb` (12 987 primitives, 2 435 643 triangles). Les chiffres sont là pour être re-mesurés, pas crus sur parole.

---

## 1. Chaîne complète et où chaque étage peut mentir

```
Unreal  ──(NarvosExporter, GLB + bake)──▶  halo_map.glb
        ──(puzzle-chunks.mjs)──▶  chunks_v2/chunk_NN.glb
        ──(assets-to-ktx2.mjs)──▶  textures KTX2
        ──(StreamingPuzzleMap)──▶  écran
```

| Étage | Ce qu'il perd ou abîme | Comment le vérifier |
|---|---|---|
| Export Unreal | Landscape, foliage instancié, BSP | Le plugin l'AUDITE tout seul — lire le bloc `AUDIT COUVERTURE` du journal d'export |
| Export Unreal | Auto-materials → une texture par objet, à taille FIXE | Comparer densité de texels vs taille d'objet (§3) |
| `puzzle-chunks.mjs` | Triangles d'aire nulle — **mesuré 16,4 % sur un chunk, 0 dans la source** | `scripts/clean-chunk-slivers.mjs <dir> --dry-run` |
| `chunks-to-ktx2.mjs` | En fabrique AUSSI : son `prune()+dedup()+draco()` a produit 1,89 % (7,15 % sur le pire chunk) **sur une entrée déjà nettoyée** | idem — d'où l'ordre ci-dessous |
| `assets-to-ktx2.mjs` | Résolution (défaut `--max=1024`) | Lire les en-têtes KTX2, pas le nom de fichier |
| Runtime | Culling, variantes de qualité, saturation mémoire | F7 (culling), F10 (chunks), console |

---

## 2. Erreurs de méthode déjà commises — ne pas les refaire

Ces quatre-là ont coûté plusieurs heures chacune. Elles ont toutes la même forme : **une mesure qui semble réfuter une hypothèse, mais qui mesure la mauvaise chose.**

### 2.1 Tester un traitement sur des données qui l'ont déjà subi
Hypothèse « la quantification Draco détruit la géométrie » réfutée en ré-encodant `chunk_01.glb` à 14 puis 18 bits : aucun changement. **Le test était vide** — le chunk était déjà quantifié à 14 bits, ses sommets étaient déjà sur la grille.
→ **Toujours partir d'une entrée qui n'a PAS subi l'étage testé.**

### 2.2 Mesurer la mauvaise définition
« Triangles dégénérés » compté avec « les TROIS sommets confondus » → 10 105. Avec « DEUX sommets confondus » (le vrai critère d'aire nulle) → 48 093, cinq fois plus.
→ **Écrire la définition avant de compter. Un triangle est mort dès que deux sommets coïncident.**

### 2.3 Échantillonner un défaut concentré
Scan de 406 primitives sur 12 987 (3 %) → « 0 triangle d'aire nulle dans la source ». Vrai, mais le défaut cherché était concentré : une primitive à 48,8 %.
→ **Pour un défaut soupçonné concentré, scanner TOUT. 12 987 primitives se lisent en une minute par accès direct aux offsets binaires.**

### 2.4 Lire un log périmé
Conclusion « `crouch_pose` charge encore le clip d'escalade » tirée d'un log de 02:08, alors que le fichier avait changé à 02:10.
→ **Comparer `ls -la --time-style=long-iso` du log ET du fichier incriminé avant toute conclusion.**

---

## 3. Le piège des auto-materials Unreal

L'exportateur glTF aplatit un auto-material dans **une texture par objet, à taille fixe**. La densité de détail dépend alors de la taille de l'objet :

| objets | diagonale | densité obtenue |
|---|---|---|
| 10 % les plus petits | 2,3 u | 450 texels/unité |
| médiane | 37 u | 27,6 texels/unité |
| le plus grand | 2 258 u | **0,45 texel/unité** |

Soit un facteur **75**. Cailloux nets, terrains en bouillie.

**Ce n'est pas réparable par le baking** : `UGLTFLevelExporter` reçoit UN seul objet d'options pour tout le niveau, on ne peut pas donner 4096 aux grandes surfaces et 256 aux cailloux.

**Solution retenue** : reproduire l'auto-material au runtime en projection triplanaire monde (`src/rpg/materials/`). La densité devient indépendante de la taille de l'objet, par construction. Coût : 7 textures KTX2 ≈ 26 Mo de VRAM contre ~500 Mo pour 241 bakes.

---

## 4. VRAM : ne jamais l'estimer, la mesurer

Le compteur du projet a longtemps fait `w × h × 4 × 1.33` pour TOUT — soit du RGBA8 supposé. Sur des chunks 100 % KTX2, ça surestime d'un facteur 4 (2 503 Mo annoncés pour ~570 Mo réels) et le budget évince des chunks encore utiles.

Octets par pixel réels :
- BC1 / ETC1 / ETC2 RGB → **0,5**
- BC3 / BC7 / ASTC 4×4 / ETC2 RGBA → **1**
- non compressé (RGBA8) → **4**

`bytesPerPixel()` dans `StreamingPuzzleMap.tsx` fait ce test. Un compteur `uncompressed` non nul signale un transcodage raté (KTX2 → RGBA32, ×8 en VRAM, sans aucune erreur levée).

**Piège UASTC** : les normal maps en UASTC pèsent 1113 Ko contre 77 Ko en ETC1S à résolution égale — 20 % des textures, 78 % du poids d'un chunk, et c'est le chemin qui sature le transcodeur (`RangeError` levée DANS `transcode()`). Pour une map, utiliser `--no-uastc-normals`.

---

## 5. Le fallback SPA de Vite

Un fichier absent renvoie **200 + `text/html`**, pas 404. Tout code qui teste `resp.ok` seul croira que le fichier existe.

```ts
const ct = (res.headers.get("content-type") ?? "").toLowerCase();
if (ct.startsWith("text/")) return false;   // fichier absent
```

Concerne : `assetExists`, `AudioManager`, tout chargement de variante de qualité.

---

## 6. Après régénération de chunks : la checklist

- [ ] **Incrémenter `CACHE_VERSION`** dans `runtime/loading/chunkCache.ts`. Les fichiers gardent leurs noms : sans bump, IndexedDB ressert les anciens et la régénération est **invisible**.
- [ ] Vérifier la couverture géométrique : somme des triangles des chunks vs source. Doit être à 100 %.
- [ ] Vérifier `--spatial` : `chunk-metadata.json` doit avoir `"spatial": true` et des centres DISTINCTS. En bucketing LPT, tous les chunks couvrent la carte entière et un chunk manquant troue partout au lieu d'une région.
- [ ] Passer `clean-chunk-slivers.mjs --dry-run` : au-delà de 1 %, un étage abîme la géométrie.
- [ ] Vérifier qu'aucune dimension de texture n'est non-multiple de 4 (formats à blocs → `GL_INVALID_OPERATION`, upload rejeté, map jamais assemblée).

---

## 7. Outils de mesure disponibles

| Besoin | Commande |
|---|---|
| Triangles/sommets d'un GLB sans le charger | lire l'en-tête JSON du GLB (12 o + longueur) |
| Lames et triangles morts | `scripts/clean-chunk-slivers.mjs <dir> --dry-run` |
| Formats et dimensions KTX2 réels | lire l'en-tête KTX2 : `vkFormat` à +12, `w/h` à +20/+24, `supercompressionScheme` à +44 |
| Couverture d'export | bloc `AUDIT COUVERTURE` du journal du plugin Unreal |
| Culling vs géométrie manquante | **F7** en jeu — coupe le culling par chunk |
| État par chunk | **F10** — résident, masqué, textures, VRAM |

---

## 8. L'ordre des étages — corrigé par la mesure

`scripts/rebuild-map-chunks.mjs` enchaîne toute la chaîne en une commande :

```bash
node scripts/rebuild-map-chunks.mjs <source.glb> <outDir> [chunks=8]
```

Ordre, et pourquoi il n'est pas commutatif :

1. `puzzle-chunks --spatial` — sans `--spatial`, tous les chunks couvrent la carte
   entière et un chunk manquant troue PARTOUT au lieu d'une région
2. `chunks-to-ktx2` (ETC1S, jamais `--uastc-normals`)
3. `clean-chunk-slivers` — **APRÈS l'étape 2, pas avant**

**Correction d'une règle précédemment fausse de ce fichier.** Il était écrit qu'il
fallait nettoyer AVANT la compression, au motif que Draco réordonne les sommets.
Mesuré sur la Forge réimportée : nettoyer d'abord laisse **1,89 %** de triangles
d'aire nulle (7,15 % sur le pire chunk) — c'est le `prune()+dedup()+draco()` de
l'étage KTX2 qui les FABRIQUE. Nettoyer après descend à **0,00 %**, et le
nettoyeur n'en refabrique pas (re-mesuré : 0 sur 6 064 389 triangles). Les
extensions KTX2 survivent à la réécriture — 9 985 textures vérifiées intactes.

Le raisonnement d'origine était plausible et faux. C'est la *règle 1* de
`narvos-measure-first` appliquée à ce fichier lui-même : une justification qui
n'a jamais été mesurée n'est pas une mesure.

---

## Packs d'ANIMATION — la géométrie n'a rien à y faire (mesuré 31/07/2026)

Les packs d'animation exportés depuis Unreal embarquent le personnage **entier
dans chaque fichier de clip**. Mesuré sur `FPP_combat_fists/No_Rootmotion` :

| | Avant | Après strip |
|---|---|---|
| Poids du pack (55 clips) | **520,46 Mo** | **48,03 Mo** |
| Un clip | 9,42 Mo | 0,83 Mo |
| Contenu par fichier | 1 mesh, 2 primitives, **5 textures**, 1 skin | 0 |
| Os / animations | 69 / 1 | **69 / 1** (intacts) |

Three.js lie les pistes d'animation aux **nœuds**, par leur nom. Le mesh, le
skin, les matériaux et les textures d'un fichier de clip ne sont jamais lus.
Les garder, c'est recharger le même personnage à chaque clip.

**Outil** : `node scripts/strip-anim-meshes.mjs <dossier> [--out <dossier>] [--dry-run]`
Sans `--out`, réécrit en place après archivage dans `_full_backup/`.

### Trois règles apprises en l'écrivant

1. **NE JAMAIS pruner les nœuds.** Dans un fichier de clip, les nœuds « vides »
   SONT le squelette — la seule chose à garder. Le script dispose explicitement
   meshes/skins/matériaux/textures, puis ne supprime que les accesseurs devenus
   orphelins. Un garde-fou refuse d'écrire si le compte de nœuds ou
   d'animations a bougé.
2. **`@gltf-transform/functions` tire `sharp`**, binaire natif cassé sur cette
   machine. Pour une opération sans image, n'importer que
   `@gltf-transform/core` et faire le nettoyage à la main — c'est plus explicite
   et ça ne peut pas supprimer un nœud par erreur.
3. **Vérifier l'unité avant de brancher un pack UE** : lire la translation du
   `pelvis`. Ici 0,968 → mètres, donc pas concerné par le piège des clips UE4 en
   centimètres qui projette le squelette à 60 m.

### Charger un pack : un clip par action, pas plus

`renameClip(clip, action)` donne le MÊME nom à toutes les variantes, et
`resolveActions` retient la première. `UNARMED_PACK` déclare 12 variantes pour
`punch1`, 12 pour `punch2`, 12 pour `punch3` : 43 entrées pour **7 actions**.
Les 36 autres seraient téléchargées, parsées, gardées en mémoire — jamais jouées.
D'où `firstPerAction()` dans `animation/animationPacks.ts`.

## KTX2 dans `extensionsRequired` fait refuser le GLB ENTIER

**Mesuré le 2026-09-03**, sur les packs d'animation.

Certains packs embarquent un aperçu texturé en KTX2. Le GLB déclare alors
`KHR_texture_basisu` dans **`extensionsRequired`** — et la spec glTF impose au
lecteur de refuser **tout le fichier** dans ce cas. Interchange obéit :

```
Not all required extensions are supported. (Unsupported extensions: KHR_texture_basisu)
There was no data to import in the provided source data.
```

⚠ Ce n'est **pas** « la texture est ignorée, la géométrie passe ». Rien ne passe.
La note qui dit le contraire vaut pour `extensionsUsed`, **pas** pour
`extensionsRequired` — la distinction est tout.

Coût réel : 68 animations refusées, dont **toutes** les boucles `AS_Sit_*_Loop*`
du pack WW100 — celles qui servent. Il ne restait que les transitions, et le menu
paraissait vide de contenu utile.

**Correctif** : `scripts/narvos-degraisser-anim.mjs <dossier> <sortie> --apply`.
Il retire images, textures et matériaux — une animation ne porte que des pistes
d'os. Résultat : 67 importées, 0 échec, et **1,6 Go → 537 Mo**.

**Le piège dans le piège.** Supprimer textures et matériaux NE SUFFIT PAS :
gltf-transform garde les objets `Extension` enregistrés sur le document, et
`KHR_texture_basisu` reste déclaré même quand plus rien ne l'utilise. Le premier
dégraissage n'a débloqué **aucun** import. Il faut aussi :

```js
for (const ext of root.listExtensionsUsed()) {
  if (!A_GARDER.has(ext.extensionName)) ext.dispose();
}
```

en conservant celles qui touchent la géométrie — `KHR_mesh_quantization`,
`KHR_draco_mesh_compression`, `EXT_meshopt_compression` — dont le skinning dépend.

Vérifier qu'un dégraissage a réellement pris :

```bash
python -c "
import json,struct
h=open('<fichier>.glb','rb'); h.seek(12); n=struct.unpack('<I',h.read(4))[0]; h.read(4)
j=json.loads(h.read(n).decode('utf-8'))
print(j.get('extensionsUsed'), j.get('extensionsRequired'))"
# doit rendre : None None
```

**Garde-fou** : le script REFUSE tout GLB sans animation. Il détruit l'apparence ;
l'appliquer à un personnage par erreur le laisserait sans matériaux.

---

## Extensions glTF « requises » : le fichier entier est refusé (2026-09-03)

Une extension listée dans **`extensionsRequired`** engage le lecteur : il doit la
comprendre ou refuser le document. C'est la spécification glTF, pas un caprice
d'Unreal. Interchange n'en lit ni l'une ni l'autre :

| Extension | Ce que ça bloque | Récupérable ? |
|---|---|---|
| `KHR_texture_basisu` (KTX2) | tout le GLB | **non** — décodeur Basis absent de `sharp` |
| `EXT_texture_webp` | tout le GLB | **oui** — `sharp` transcode en PNG |
| `EXT_texture_avif` | tout le GLB | oui, même voie |

Le message d'erreur trompe :

```
Not all required extensions are supported. (Unsupported extensions: EXT_texture_webp)
There was no data to import in the provided source data.
```

La seconde ligne accuse le fichier d'être vide. Il ne l'est pas : il n'a jamais
été ouvert.

**Mesuré** : `public/models/pnj_monstre`, 15 fichiers présentés à l'import →
3 acceptés, **12 refusés**, tous pour `EXT_texture_webp`. Après transcodage :
12 ok, 0 échec.

```bash
node scripts/narvos-textures-vers-png.mjs <dossier> <sortie> --apply
```

### Transcoder, pas dégraisser

`narvos-degraisser-anim.mjs` SUPPRIME les textures — correct pour une animation,
qui n'en a pas besoin. Sur un personnage, ça donne un modèle gris.
`narvos-textures-vers-png.mjs` transcode : le pixel survit, seul le conteneur
change.

⚠ Les deux doivent **`dispose()` l'objet `Extension`**, pas seulement changer les
images. gltf-transform garde l'extension enregistrée tant qu'on ne la supprime
pas : le document ressort avec `extensionsRequired` intact et Interchange le
refuse encore. Ce défaut exact avait rendu un premier dégraissage entièrement
inopérant.

---

## gltf-transform sur un export Meshy : le décodeur Draco est obligatoire

Sans dépendance Draco enregistrée, la lecture échoue sur :

```
Cannot read properties of undefined (reading 'DT_FLOAT32')
```

Le message ne parle ni de Draco ni de compression — on le prend d'abord pour un
fichier corrompu. Les 20 GLB de `pnj_monstre` sont dans ce cas.

```js
const draco = await import(".../node_modules/draco3dgltf/draco3dgltf.js");
const d = draco.default ?? draco;
io.registerDependencies({
  "draco3d.decoder": await d.createDecoderModule(),
  "draco3d.encoder": await d.createEncoderModule(),
});
```

`narvos-renommer-os.mjs` s'en passe : il n'a rencontré que des packs non
compressés. Ça ne veut pas dire qu'il n'en aura pas besoin.

---

## `ETRANGER` ne veut pas dire « pas riggé » — et confondre coûte cher

Vérifié le 2026-09-04, après s'être trompé une fois.

`narvos-skeleton-compat.mjs` compare les **NOMS d'os** à ceux de
`SKEL_Mannequin`. Son verdict `ETRANGER` dit une seule chose : *aucun nom ne
correspond*. Il ne dit RIEN sur la présence ou la qualité du rig.

Les GLB de `public/models/pnj` et `pnj_monstre` sortent tous `ETRANGER`. Ce sont
pourtant de vrais personnages animés :

| Pack | os | ce qu'Interchange en a fait |
|---|---:|---|
| `Grunt` | 24 | SkeletalMesh + squelette propre |
| `RobotGirl` | 102 | idem |
| **les 60 ensemble** | — | **37 squelettes, 208 AnimSequence** |

### ⚠ Le piège de lecture qui m'a eu

La sortie résumée aligne un NOMBRE DE FICHIERS devant chaque verdict :

```
=== par pack ===
  Grunt                          2 ETRANGER      <-- 2 FICHIERS, pas 2 os
```

Le nombre d'os n'apparaît que sous `--detail` :

```
  ETRANGER — Meshy_AI_biped_Character_output.glb (24 os)
```

Lu de travers, ce « 2 » m'a fait écrire — dans un rapport, deux scripts et un
skill — que ces packs n'étaient « pas riggés ». **Toujours passer `--detail`
avant de conclure sur un rig.**

### Ce qu'on en fait

| Verdict | Porte |
|---|---|
| `IDENTIQUE`, `SUR-ENSEMBLE`, `REPARENTE` | manifeste normal, squelette imposé, classe `Character` |
| `INTERCALE` | retargeting réel, ou rien — voir MetaHuman |
| `ETRANGER` avec un rig | `narvos-manifeste-brut.mjs` + `NARVOS_SANS_SQUELETTE=1`, classe **`CharacterSimple`** |

`CharacterSimple` est la seule classe nanos qui n'impose aucun squelette.
`Character` sur un mesh étranger affiche la capsule de collision — un cylindre
blanc, sans erreur.

Après tout import sans squelette imposé, MESURER à quoi les meshes sont liés :

```bash
UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript   -script=scripts/adk-verify-skeletons.py
```

C'est cette mesure, et elle seule, qui alimente `RACINES_SQUELETTE_PROPRE` dans
`scripts/narvos-spawnables-to-lua.mjs`.

---

## Une map de 30 000 nœuds ne s'importe pas telle quelle (2026-09-04)

**Interchange crée un asset par NŒUD glTF, pas par mesh.** C'est le chiffre qui
décide de tout, et il ne se devine pas depuis le compte de meshes.

| Map | meshes | **nœuds** | assets produits |
|---|---:|---:|---:|
| `tower_map` monolithe | 6 393 | **33 227** | **33 978** |
| `tower_map` en 8 chunks | — | 1 451 | **2 046** |
| `Orbital` en 8 chunks | — | 1 546 | **2 097** |
| Forge, la référence qui tourne | — | — | 4 496 |

Mesure de référence : la Forge à **12 987 entités** donnait un tick serveur à
**113 ms** pour une cible de 33 ms. Ce n'est pas le volume de géométrie qui
coûte, c'est le NOMBRE d'entités.

### La commande

```bash
node WebPortal/scripts/puzzle-chunks.mjs <source.gltf> <sortie> 8 2048 --format=png
```

`--format=png` est **obligatoire pour un import Unreal** : le défaut `webp` pose
`EXT_texture_webp` en `extensionsRequired`, et Interchange refuse alors le
fichier ENTIER. Draco, lui, passe.

Mesuré : Orbital découpée en **30 s**, Tower en **37 s**. À comparer à la fusion
`NARVOS_COMBINE=1`, tentée sur Tower : 12 Go de RAM annoncés, **une heure sans
aboutir**, abandonnée.

### ⚠ L'avertissement du découpeur est FAUX

```
[geo] ⚠ 39.2% des triangles perdus dans le pipeline — géométrie manquante en jeu.
```

Il compare le compte de triangles de la map ENTIÈRE, **avant** matérialisation
des instances, à celui d'**un seul** chunk. Sur les six chunks mesurés il
annonçait 39 à 51 % de perte. La réalité, mesurée en espace monde :

| | source | chunks | ratio |
|---|---:|---:|---:|
| Orbital | 4 801 009 tris | 4 801 009 | **1.00×** |
| Tower | 7 232 866 tris | 7 174 924 | **0.99×** |

Boîtes englobantes **identiques** dans les deux cas. Ne pas se fier à cet
avertissement — vérifier :

```bash
node scripts/narvos-verifier-chunks.mjs <source> <dossier-chunks>
```

⚠ Ce contrôle a lui-même menti à sa première version : il lisait le `min`/`max`
des accesseurs (périmés après Draco), puis comparait une source en espace LOCAL
à des chunks en espace MONDE — `flatten()` cuit les transforms. Il concluait
« couverture complète » quoi qu'il arrive. Il traverse maintenant le graphe de
scène et applique les matrices.

---

## Un aller-retour par glTF perd les textures — et ça ne se voit qu'en jeu

Mesuré le 2026-09-04. Les 40 pièces de `stylized_modular` sortaient **grises**.

La chaîne était : pack d'origine `.uasset` (UE 4.26) → export GLB → import ADK.
Les GLB intermédiaires portaient **`images = 0`**.

```bash
# Lire l'en-tête JSON d'un GLB, sans le charger entièrement
python -c "
import json,struct
fh=open('x.glb','rb'); fh.read(12); n=struct.unpack('<I',fh.read(4))[0]; fh.read(4)
j=json.loads(fh.read(n)); print('images',len(j.get('images',[])),'mat',len(j.get('materials',[])))"
```

L'import se déclarait réussi, créait des matériaux portant les **bons noms**
(`MI_Aviator`, `MI_Body`…) et **vides**. Rien ne levait.

### Le contrôle qui tranche en une commande

L'inventaire typé de l'ADK, par pack :

| pack | SkeletalMesh | Material | **Texture2D** |
|---|---:|---:|---:|
| stylized_modular | 40 | 14 | **0** |
| CyberpunkSamurai | 19 | 8 | 32 |

Zéro texture pour 40 meshes : le diagnostic tient dans cette ligne.

### La réparation, quand l'original existe en `.uasset`

1. Copier `Materials/` et `Textures/` du pack d'origine dans `Content/`, **sous
   leur nom d'origine** — les références internes sont absolues
   (`/Game/StylizedModularChar/Textures/…`) et un autre nom les casse en silence.
2. `scripts/adk-rebrancher-materiaux.py` — apparie par NOM et remplace le slot.
   Un mesh sans homonyme est laissé intact et signalé : un remplacement au
   hasard donnerait une pièce texturée mais fausse, pire que grise.
3. Déplacer sous le dossier exporté **avec le moteur**, jamais avec `mv` :

```python
unreal.EditorAssetLibrary.rename_directory("/Game/X", "/Game/Narvos/X")
```

`rename_directory` réécrit toutes les références. Un déplacement de fichiers
laisserait les meshes pointer vers un chemin disparu — matériaux vides, sans
erreur.

4. Cuire, packer, et **vérifier que le dossier est dans le pack livré** :
   `find Server/Assets/narvos/Narvos/<X> -name '*.uasset' | wc -l`.

Résultat mesuré : 40/40 rebranchés, 49 slots, 172 textures atteintes, 0 gris.

### ⚠ `adk-verify-import.py` ment sur les textures

Il annonçait « 4 texture(s) » sur chacune des 40 pièces qui n'en avaient AUCUNE :
il cherchait dans tout le registre et ramassait celles des packs voisins.

Employer **`scripts/adk-verifier-textures.py`**, qui ne quitte jamais le mesh :

```
SkeletalMesh -> slots -> MaterialInstance -> texture_parameter_values
```

Il distingue trois cas, et la distinction compte :

| verdict | ce que ça veut dire |
|---|---|
| `GRIS` | aucune texture atteignable — le défaut |
| `GRAPHE` | `Material` brut : textures câblées dans le graphe, **non mesurables** |
| `SANS SLOT` | le mesh n'a aucun matériau |

Marquer `GRAPHE` comme gris donnerait un faux positif aussi trompeur que le faux
négatif qu'on corrige.