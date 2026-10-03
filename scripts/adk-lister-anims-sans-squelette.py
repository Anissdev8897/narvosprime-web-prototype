# -*- coding: utf-8 -*-
"""
adk-lister-anims-sans-squelette.py — lister les AnimSequence dont le squelette est
NUL, SANS les charger. Ne modifie rien.

    NARVOS_DOSSIER=/Game/Narvos/CraftingStations/Animations \
    UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript \
      -script="<...>/scripts/adk-lister-anims-sans-squelette.py" \
      -unattended -nosplash -nopause

Écrit `WebPortal/Server/adk/_anims-sans-squelette.json`.

── ⚠ POURQUOI ON NE CHARGE PAS ──────────────────────────────────────────────
Première version de cette sonde, 2026-09-12 : elle appelait `load_asset` pour
lire la propriété `skeleton`. Sur une animation cassée, `load_asset` ne rend pas
None — il LÈVE :

    RuntimeError: EditorAssetLibrary: .../AS_BuildingFirstPerson :
                  Invalid USkeleton supplied

La sonde mourait donc sur la première coupable, exactement comme le cook. Or le
REGISTRE porte déjà la réponse : chaque AnimSequence y expose une étiquette
`Skeleton`. La lire ne charge rien et ne peut pas lever.

Règle : pour juger un asset cassé, interroger le registre, jamais l'objet.
"""
import json
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

DOSSIER = os.environ.get("NARVOS_DOSSIER", "/Game/Narvos")
SORTIE = os.environ.get(
    "NARVOS_SORTIE",
    "E:/narvosprime-web-prototype/WebPortal/Server/adk/_anims-sans-squelette.json")

CLASSES = ("AnimSequence", "AnimMontage", "AnimComposite", "BlendSpace", "BlendSpace1D")


def dire(t):
    print(t)
    unreal.log("[NARVOS] " + t)


registre = unreal.AssetRegistryHelpers.get_asset_registry()

# En COMMANDLET, le registre n est pas balaye tout seul : sans cette attente, la
# sonde a rendu « 0 animation » sur un dossier qui en porte des milliers
# (mesure du 2026-09-12). Un zero sans balayage n est pas une absence.
registre.scan_paths_synchronous([DOSSIER], True)
registre.wait_for_completion()

donnees = registre.get_assets_by_path(DOSSIER, recursive=True) or []
anims = [d for d in donnees if str(d.asset_class_path.asset_name) in CLASSES]

dire("%d animation(s) sous %s" % (len(anims), DOSSIER))

sans, avec = [], 0
for d in sorted(anims, key=lambda x: str(x.package_name)):
    # L'etiquette du REGISTRE : presente sans charger l'asset, et elle ne leve pas.
    try:
        squelette = d.get_tag_value("Skeleton")
    except Exception:
        squelette = None
    valide = squelette is not None and str(squelette) not in ("", "None")
    if valide:
        avec += 1
    else:
        sans.append({
            "nom": str(d.asset_name),
            "paquet": str(d.package_name),
            "classe": str(d.asset_class_path.asset_name),
        })

dire("  avec squelette : %d" % avec)
dire("  SANS squelette : %d  (elles tuent le cook : Assertion !Hash.IsZero())" % len(sans))
for s in sans[:40]:
    dire("      %-42s %s" % (s["nom"], s["paquet"]))

with open(SORTIE, "w", encoding="utf-8") as f:
    json.dump({"dossier": DOSSIER, "avec": avec, "sans": sans}, f, ensure_ascii=False, indent=1)
dire("")
dire("Ecrit : " + SORTIE)
dire("Les deplacer HORS de Narvos/ (editeur ferme) suffit : hors de Narvos/, rien n est cuit.")