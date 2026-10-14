"""
adk-verifier-textures-rebatis.py — l'inventaire des meshes GRIS (scripts/adk-verifier-textures-tout.py),
borné aux dossiers de /Game/Narvos REBATIS depuis la perte, un dossier après l'autre.

    bash scripts/recuperation/adk-lancer.sh recuperation/adk-verifier-textures-rebatis.py
    NARVOS_ECRITS_DEPUIS=AAAA-MM-JJ   (défaut 2026-10-03)
    NARVOS_DOSSIERS=Sewer,pnj         (défaut : tout dossier portant un paquet écrit depuis)

-- POURQUOI CE SCRIPT EN PLUS DE textures-rebaties.py -----------------------------------------
Le contrôle sur disque lit des CHEMINS : il dit qu'une texture existe et qu'un matériau la
cite. Il ne dit pas que le maillage PORTE ce matériau, ni que le slot n'est pas vide. Ici c'est
Unreal qui répond, maillage par maillage : slot vide, matériau du moteur, matériau sans texture.

-- POURQUOI PAR DOSSIER ET PAS /Game/Narvos D'UN BLOC ------------------------------------------
Le vérificateur CHARGE chaque maillage. Tout le pack, c'est ~30 000 meshes dont la Forge et
ses 12 989 : des dizaines de minutes pour relire ce que la récupération a rendu tel quel.

Rapports : WebPortal/Server/adk/_manifests/textures-rebaties/<dossier>.json, et un bilan
`_bilan.json` (dossier -> meshes, ok, gris).
"""
import datetime
import json
import os
import runpy
import traceback

import unreal

SCRIPT = "E:/narvosprime-web-prototype/scripts/adk-verifier-textures-tout.py"
SORTIES = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/textures-rebaties"
CONTENT = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_content_dir())
SEUIL = datetime.datetime.strptime(
    os.environ.get("NARVOS_ECRITS_DEPUIS", "2026-10-03"), "%Y-%m-%d").timestamp()


def journal(message):
    unreal.log("[NARVOS] " + message)


def dossiers_rebatis():
    """Les dossiers de premier niveau de Narvos/ qui portent au moins un paquet écrit depuis
    le seuil : la date du FICHIER dit ce qui a été refait (la récupération garde les dates)."""
    racine = os.path.join(CONTENT, "Narvos")
    rebatis = []
    for nom in sorted(os.listdir(racine), key=str.lower):
        chemin = os.path.join(racine, nom)
        if not os.path.isdir(chemin):
            continue
        for d, _, fichiers in os.walk(chemin):
            if any(f.endswith(".uasset") and os.path.getmtime(os.path.join(d, f)) >= SEUIL for f in fichiers):
                rebatis.append(nom)
                break
    return rebatis


demandes = [d.strip() for d in os.environ.get("NARVOS_DOSSIERS", "").split(",") if d.strip()]
dossiers = demandes or dossiers_rebatis()
os.makedirs(SORTIES, exist_ok=True)
journal("=== textures des dossiers rebatis : %d dossier(s) — %s" % (len(dossiers), ", ".join(dossiers)))

bilan = {}
for dossier in dossiers:
    sortie = "%s/%s.json" % (SORTIES, dossier)
    os.environ["NARVOS_RACINE"] = "/Game/Narvos/" + dossier
    os.environ["NARVOS_TEXTURES_SORTIE"] = sortie
    journal("")
    journal("##### %s" % dossier)
    try:
        runpy.run_path(SCRIPT, run_name="__main__")
        with open(sortie, encoding="utf-8") as f:
            rendu = json.load(f)
        bilan[dossier] = {"meshes": rendu["total"], "ok": rendu["ok"], "gris": rendu["total"] - rendu["ok"]}
    except SystemExit as e:
        bilan[dossier] = {"arret": str(e)}
    except Exception:
        bilan[dossier] = {"exception": traceback.format_exc()[-400:]}
    unreal.SystemLibrary.collect_garbage()

os.environ.pop("NARVOS_RACINE", None)
os.environ.pop("NARVOS_TEXTURES_SORTIE", None)
with open(SORTIES + "/_bilan.json", "w", encoding="utf-8") as f:
    json.dump(bilan, f, ensure_ascii=False, indent=1)

journal("")
journal("=== BILAN DES DOSSIERS REBATIS")
total = ok = 0
for dossier, b in bilan.items():
    if "meshes" not in b:
        journal("  %-34s %s" % (dossier, b))
        continue
    total += b["meshes"]
    ok += b["ok"]
    journal("  %-34s %6d mesh(es) %6d ok %6d GRIS" % (dossier, b["meshes"], b["ok"], b["gris"]))
journal("  TOTAL : %d mesh(es), %d ok, %d a probleme" % (total, ok, total - ok))
