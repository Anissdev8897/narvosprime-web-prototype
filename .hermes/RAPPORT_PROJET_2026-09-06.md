# NARVOS — session du 2026-09-06

Point d'entrée pour la reprise. Ce qui a été fait, ce qui bloque, par quoi
commencer.

---

## Par quoi commencer demain

1. **Lire la fin du cook.** Il tournait encore à 22:24, en compilation de
   shaders, à 59 894 / 78 934 paquets — au-delà du point où il est mort deux
   fois. Sortie dans le journal de tâche de la chaîne.
2. **Vérifier `Assets.toml`** : il doit porter ~3 200 animations (il en avait 8
   sur le cook partiel) et le catalogue de props doit passer de 80 à ~570.
3. **Lancer le serveur sur `Map_Narvos`** — jamais fait.
4. **Valider en jeu combat, IA, gizmo.** 499 assertions vertes, mais **rien n'a
   tourné dans le moteur** : tout repose sur des signatures lues, pas éprouvées.

---

## Ce qui a été fait

### L'univers

Les quatre mondes sont désormais **un seul monde Unreal** :
`Map_Narvos` (persistant) + `Map_Orbital` (origine), `Map_Forge` (−80 km),
`Map_Tower`, `Map_Alien` en sous-niveaux décalés. Un Landscape ne se copie pas
entre niveaux — le sous-niveau est la seule forme qui le garde intact.

- `/Game/SpaceScenes` promu sous `Narvos/` (442 assets) : sans ça la map espace
  n'aurait **jamais** été cuite.
- Trois systèmes solaires à 40 km, 69 km entre eux, faits des planètes existantes.
- Routes peuplées : 264 astéroïdes, 9 piliers-repères, 3 épaves, 15 nappes,
  12 météores.
- Un seul ciel au lieu de quatre, tagué `Sun`.
- Nanite sur 44 meshes (aucun ne l'avait).
- Six portails, arrivées **mesurées au raycast**.
- Landscapes Island et Desert remis en place après un déplacement accidentel —
  et les **8 051 touffes** de végétation redescendues avec, elles flottaient
  1,5 km au-dessus.

### Le gameplay serveur

| système | état |
|---|---|
| **Inventaire persisté** | il ne l'était **pas du tout** — 1 021 lignes, aucune base |
| Corps-à-corps | module pur (agent) + exécutant + client + `/arme` |
| IA des PNJ | module pur (agent) + exécutant + branché au spawner |
| Peuplement par proximité | naissance 80 m, retrait 140 m, plafond 120 |
| Export depuis le jeu | `/exporter decor`, `/exporter pnj` |
| Gizmo X/Y/Z | client + serveur + 4 touches |
| Sorts | `SetHealth` → `ApplyDamage` |

**~1 700 assertions Lua, zéro échec.** Trois harnais réécrits, pas contournés.

### Assets

- **Tiger_M dégraissé** : 8 142 → 856 Mo, archive supprimée, **7 Go libérés**.
- Manifestes prêts et vérifiés : 142 animaux, 183 bâtiments, **670 FBX**,
  **181 props sci-fi**.
- Tri de `a_trier` : 21 paquets, 31,5 Go, **un tiers inutilisable** (8,1 Go de
  CAO d'impression 3D, 1,7 Go d'Unity).

---

## Les deux découvertes qui comptent

### 1 925 AnimSequence sur 5 234 ont un squelette rompu — 37 %

Dont **1 418 dans `NARVOS_Retarget`**, notre propre sortie de retargeting. Le
crash du cook n'était qu'un symptôme.

⚠ Une AnimSequence sans squelette ne rate pas sa compression : **elle tue le
cook**. Trois cooks morts d'affilée, trois coupables trouvés un par un, à deux
heures la tentative. `scripts/adk-animations-sans-squelette.py` les liste
maintenant toutes en quelques minutes, sans rien cuire.

**Ce qui reste ouvert** : `NARVOS_Retarget` n'a **pas** été exclu. Rien ne prouve
qu'il tue le cook, et ce sont nos animations. Si la passe en cours meurt dessus,
on aura la preuve.

### Le cook avalait 18 Go pour rien

Il ne se limite pas au dossier que le pack déclare : il ramasse tout `Content/`.
14 dossiers de packs simplement stagés, jamais promus, jamais montés dans le
pack — cuits pour rien, et fatals. 89 713 paquets tombés à 78 934.

---

## Ce qui a échoué, et pourquoi

**World Partition.** 14 minutes de conversion puis crash :

```
LogWorldPartitionConvertCommandlet: Display: PartitionLandscape started...
Assertion failed: WorldPartition   ActorPartitionSubsystem.cpp:250
```

Partitionner un Landscape exige que **son niveau** porte un World Partition. Les
nôtres sont dans des sous-niveaux, qui n'en ont pas. Rien n'a été abîmé.

Deux voies restent, annotées dans `scripts/adk-convertir-world-partition.ps1`.
La voie B est recommandée : cuire les décalages dans les acteurs, remettre les
`LevelTransform` à l'identité, puis convertir. La voie A repose sur un
comportement non mesuré dont le mode d'échec est le pire — trois mondes empilés
à l'origine.

---

## Ce qui reste, par ordre

### Bloqué par le cook
1. `Assets.toml` complet, catalogue de props, 170 références mortes
2. **Test en jeu de `Map_Narvos`**
3. **Valider combat / IA / gizmo dans le moteur**
4. Imports : animaux, bâtiments, props sci-fi, FBX
5. Locomotion et modulaire Defender — aucun asset dans le pack, mesuré

### Unreal requis
6. Les 1 925 animations au squelette rompu — décider : réparer ou écarter
7. World Partition (voie B), puis HLOD, Data Layers, PCG
8. Mobilier de la Forge sur le relief (`Trace` est client-authority)
9. Masquage de la peau, `BP_Test` Mutable
10. 3 textures d'arbres, 20 homonymes `WorldGridMaterial`

### Décisions
11. **Choisir un seul système d'inventaire** sur les quatre (5,4 Go)
12. Les ~65 Go — doublons **non certifiés**
13. Audit création — 40 confirmées / 21 réfutées / 7 indéterminées

### Hermes
14. Lot 2 jamais lancé : icônes dans l'UI, `void_saber`, rapport animations

### Le gros chantier annoncé
15. Craft, récolte, refonte d'inventaire, amélioration de la map — et la couche
    RP d'`objetic_gameplay.txt`. Ordre proposé dans
    `.hermes/CHANTIERS_2026-09-06.md`.

---

## La phrase à retenir

Beaucoup de code a été écrit aujourd'hui sur la foi d'une **lecture** de l'API
nanos. Le test en jeu dira ce qui tient. Tant qu'il n'a pas eu lieu, aucun de ces
cinq systèmes ne doit être considéré comme acquis.

---

## Fin de session — 22:40

Le 4e cook est **mort a 22:33** : `Failure - 10625 error(s), 9340 warning(s)`.
Journal du crash : `WebPortal/Server/adk/Saved/Logs/NanosWorldADK-backup-2026.09.06-20.33.39.log`
(horodatage UTC ; 22:33 en heure locale).

Tout a ete arrete pour extinction du PC. Aucune passe ne tourne.

⚠ **Les 22 exclusions de `DefaultGame.ini` n'ont JAMAIS ete eprouvees par un cook.**
Les 4 dernieres (`NARVOS_Retarget`, `MetaHumans`, `CoreC`, `Locomotion/AimOffset`)
ont ete ajoutees APRES ce crash. Le prochain cook est le premier a les porter.

⚠ **Le pack n'a PAS ete reconstruit** : la chaine a ete coupee avant les etapes
inventaire / pack / props, qui auraient ecrit un `Assets.toml` **partiel** par
dessus l'actuel a partir d'un cook incomplet. L'`Assets.toml` en place est donc
celui d'avant — coherent, mais toujours a 8 animations.

**Demain, dans cet ordre :**
1. Relancer `bash scripts/narvos-chaine-cook.sh` (2 h). C'est le seul moyen de
   savoir si les 22 exclusions suffisent.
2. Lire la cause si elle meurt encore — chercher `Zero key hash` AVANT
   l'assertion, c'est la ligne qui distingue la tueuse des centaines
   d'avertissements benins.

---

## Correction du 2026-09-07 — le « 8 animations » etait FAUX

Compte reel dans `Server/Assets/narvos/Assets.toml`, mesure avant le cook du 07 :

| section | entrees |
|---|---|
| static_meshes | 42 106 |
| materials | 15 858 |
| animations | **2 485** |
| skeletal_meshes | 2 033 |
| particles | 57 |
| maps | 28 |
| sounds | **7** |
| blueprints | 4 |

Le pack porte donc deja 62 578 assets. La tache « completer Assets.toml » etait
surdimensionnee : une passe de pack anterieure l'avait deja rempli.

⚠ **Le vrai trou, c'est le SON : 7 entrees.** Il n'avait jamais ete regarde.

## Defaut trouve dans `scripts/narvos-chaine-cook.sh`

Le cook s'ecrit `"$UE" ... -run=Cook ... | tail -4`, sans test du code de sortie —
et `| tail` masque de toute facon le statut. Les etapes INVENTAIRE, PACK
(`--apply`) et PROPS s'executent donc **meme si le cook est mort**, et
reecrivent `Assets.toml` a partir d'un cook partiel.

C'est ce qui a failli arriver le 06 ; la chaine avait ete arretee a la main.

**Correctif a appliquer QUAND LA CHAINE NE TOURNE PAS** (bash relit le fichier
en cours d'execution ; l'editer pendant qu'il tourne le corrompt) :

```bash
"$UE" "$ADK" -run=Cook -targetplatform=Windows -unattended -nosplash 2>&1 | tail -4
if [ "${PIPESTATUS[0]}" -ne 0 ]; then
  echo "ARRET : le cook a echoue, le pack ne sera PAS reecrit"
  exit 1
fi
```

En attendant, sauvegardes dans `.hermes/sauvegarde/` :
`Assets.toml.avant-cook` (62 644 lignes) et `PropsNarvos.lua.avant-cook`.