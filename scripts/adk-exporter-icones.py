# -*- coding: utf-8 -*-
"""
adk-exporter-icones.py — exporter en PNG les icones d'objets listees par un
manifeste, pour que la WebUI puisse les afficher. Ne modifie aucun asset.

    UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript \
      -script="<...>/scripts/adk-exporter-icones.py" \
      -unattended -nosplash -nopause

Entree : WebPortal/Server/adk/_manifests/hyper-promotion.json (champ `racines`,
         seuls les chemins sous `/Icons/` sont retenus).
Sortie : WebPortal/Server/adk/_icones_png/<Nom>.png  +  _journal.txt

La conversion en WebP et la depose dans `Client/UI/img/items/` sont faites
ensuite par `scripts/narvos-icones-webp.mjs` : sharp est dans le projet web, pas
dans le Python d'Unreal.

-- POURQUOI ------------------------------------------------------------------
L'inventaire est une page WEB. Il affiche `img/items/<iconFile>.webp` (voir
`RoueIcone` dans Client/UI/index.js) et ne peut pas lire une Texture2D Unreal.
Les 198 icones des objets Hyper retenus n'existent que comme textures : sans
export, les objets s'afficheraient avec leur emoji de repli.

-- ⚠ LECTURE SEULE ------------------------------------------------------------
`Narvos/Hyper/` est fait de LIENS DURS vers le pack d'origine. Une resauvegarde
modifierait l'original. Ce script EXPORTE (ecrit un PNG ailleurs) et ne sauve
jamais un asset.

-- ⚠ LE CHEMIN CHARGE ---------------------------------------------------------
On charge `/Game/Narvos/Hyper/...` — les liens promus — et non `/Game/Hyper/...`.
Le PackageRedirects les rend equivalents, mais charger explicitement la cible
evite de dependre du redirect pour un simple export.
"""
import json
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

RACINE = "E:/narvosprime-web-prototype"
MANIFESTE = RACINE + "/WebPortal/Server/adk/_manifests/hyper-promotion.json"
SORTIE = os.environ.get("NARVOS_SORTIE", RACINE + "/WebPortal/Server/adk/_icones_png")
os.makedirs(SORTIE, exist_ok=True)
JOURNAL = os.path.join(SORTIE, "_journal.txt")
_lignes = []


def dire(t):
    print(t)
    unreal.log("[NARVOS] " + t)
    _lignes.append(t)
    # Au fil de l'eau : un processus tue ne laisse pas de journal de fin.
    with open(JOURNAL, "w", encoding="utf-8") as f:
        f.write("\n".join(_lignes))


with open(MANIFESTE, encoding="utf-8") as f:
    racines = json.load(f).get("racines", [])

icones = [r for r in racines if "/Icons/" in r]
dire("%d icone(s) au manifeste" % len(icones))

exportees, illisibles, refusees = 0, [], []
for paquet in icones:
    nom = paquet.rsplit("/", 1)[-1]
    promu = "/Game/Narvos/" + paquet[len("/Game/"):]
    texture = unreal.EditorAssetLibrary.load_asset(promu)
    if texture is None:
        illisibles.append(promu)
        continue

    tache = unreal.AssetExportTask()
    tache.object = texture
    tache.filename = os.path.join(SORTIE, nom + ".png")
    tache.automated = True
    tache.prompt = False
    tache.replace_identical = True
    tache.exporter = unreal.TextureExporterPNG()

    ok = unreal.Exporter.run_asset_export_task(tache)
    # ⚠ `ok` ne suffit pas : on a deja vu des ecritures annoncees et absentes.
    # Le fichier doit exister ET peser quelque chose.
    fichier = tache.filename
    if ok and os.path.isfile(fichier) and os.path.getsize(fichier) > 0:
        exportees += 1
    else:
        refusees.append(nom)

dire("exportees : %d" % exportees)
dire("illisibles (non charges) : %d" % len(illisibles))
for x in illisibles[:10]:
    dire("    " + x)
dire("refusees par l'exporteur : %d" % len(refusees))
for x in refusees[:10]:
    dire("    " + x)
dire("FIN")