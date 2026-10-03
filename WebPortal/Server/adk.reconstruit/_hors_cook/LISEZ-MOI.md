# Assets retirés du cook — 2026-09-04

Deux maps importées puis **sorties du Content avant le cook**. Elles ne sont pas
supprimées : elles sont inutilisables en l'état, et les cuire coûtait des heures
pour du contenu que le serveur n'aurait jamais pu charger.

## Le chiffre qui décide

**Interchange crée un asset par NŒUD glTF, pas par mesh.**

| Map | nœuds source | assets produits | entités nanos que ça ferait |
|---|---:|---:|---:|
| `tower_map` | 33 227 | **33 978** | ~30 000 |
| `Orbital` | 26 031 | (import coupé) | ~26 000 |
| **Forge — la référence qui fonctionne** | — | 4 496 | **1 461** |

Mesure de référence, consignée dans `scripts/adk-import-narvos.py` : la Forge à
**12 987 entités** donnait un tick serveur à **113 ms** pour une cible de 33 ms
— soit 8 images/s au lieu de 30. Ce n'est pas le volume de géométrie qui coûte,
c'est le NOMBRE d'entités : chacune a son transform, sa pertinence réseau et sa
place dans la boucle.

La Forge d'aujourd'hui n'expose que 1 461 meshes parce qu'elle passe par des
chunks (`chunks_v3`). C'est le chemin à reprendre.

## La tentative de fusion, et pourquoi elle est abandonnée

`NARVOS_COMBINE=1` fusionne tout le GLB en un seul mesh — une entité au lieu de
30 000. Lancé sur Tower : Unreal a annoncé **12 Go de mémoire nécessaires**, a
tourné **une heure** sur ~2 cœurs sans écrire une ligne de log, et a été coupé.
Ne pas relancer sans découper d'abord.

## La sortie — une commande

`puzzle-chunks.mjs` accepte `--format`. Son défaut, `webp`, produit des chunks
qu'**Interchange refuse** : `EXT_texture_webp` en `extensionsRequired` fait
rejeter le fichier entier. Les 24 chunks Orbital déjà présents sous
`public/models/Maps/Orbital/chunks/` sont dans ce cas, en pire — ils portent
`KHR_texture_basisu` (KTX2), dont `sharp` n'a même pas le décodeur.

Leur géométrie, elle, est exactement ce qu'il faut : **2 211 nœuds pour les 24
fichiers**, contre 26 031 pour le monolithe.

Il suffit donc de les régénérer en PNG :

```bash
cd WebPortal
node scripts/puzzle-chunks.mjs \
  public/models/Maps/Orbital/Orbital_map.gltf \
  public/models/Maps/Orbital/chunks_png 8 --format=png

node scripts/puzzle-chunks.mjs \
  public/models/Maps/tower_map/tower_map.gltf \
  public/models/Maps/tower_map/chunks_png 8 --format=png
```

Puis, pour chacune :

```bash
cd ..
node scripts/narvos-manifeste-brut.mjs <chunks_png> <nom>
# ⚠ repointer `racine` du manifeste sur public/models/Maps
NARVOS_SANS_SQUELETTE=1 NARVOS_MANIFEST=<manifeste> UnrealEditor-Cmd … adk-import-narvos.py
# puis cook, pack, et :
node scripts/narvos-map-to-lua.mjs --map <nom> --apply
```

`KHR_draco_mesh_compression`, lui, **est** lu par Interchange — le découpeur peut
garder Draco.

## Ce qui attend ici

| Dossier | Contenu | Sort |
|---|---|---|
| `tower_map_monolithe` | 33 978 `.uasset`, 1 608 Mo | à supprimer une fois les chunks importés |
| `Orbital_partiel` | (absent — l'import avait été coupé avant tout écrit) | — |

## Rappel des pièges de la nuit

- **Chemins ABSOLUS dans un manifeste.** Un commandlet tourne depuis
  `Engine/Binaries/Win64/` : un chemin relatif y est résolu, et Interchange
  répond « There was no data to import » sur un fichier qu'il n'a jamais ouvert.
- **Effacer l'asset avant un réimport.** Le script saute ce qui est « déjà
  présent » : un asset à moitié écrit serait conservé en silence.
- **Une seule instance d'Unreal à la fois.** Deux commandelets sur le même projet
  se disputent le registre d'assets et le DerivedDataCache. `TaskStop` rend
  « succès » sans tuer le processus : vérifier par la liste des processus.