# -*- coding: utf-8 -*-
"""
adk-quarantaine-anims-sans-squelette.py — sortir de Narvos/ les AnimSequence dont
le squelette est NUL, pour qu'elles cessent de tuer le cook.

    NARVOS_DOSSIER=/Game/Narvos/CraftingStations/Animations NARVOS_APPLIQUER=1 \
    UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript \
      -script="<...>/scripts/adk-quarantaine-anims-sans-squelette.py" \
      -unattended -nosplash -nopause

⚠ ÉDITEUR FERMÉ (commandlet). Essai par défaut : sans NARVOS_APPLIQUER=1, il
liste et ne déplace rien.

── POURQUOI ─────────────────────────────────────────────────────────────────
Cook du 2026-09-12, mort à 68 952 paquets sur 85 612 après 26 minutes :

    LogAnimation: Warning: Animation Compression request for AS_BuildingFirstPerson
                  failed, Skeleton == nullptr.
    LogAnimation: Warning: Zero key hash compressed animation data for ...
    Assertion failed: !Hash.IsZero()  [AnimSequence.cpp:2151]

Une AnimSequence sans squelette n'échoue pas à la compression : elle TUE le
processus. C'est une leçon déjà payée trois fois le 2026-09-06
(`scripts/adk-animations-sans-squelette.py` existe pour la dépister AVANT) —
et que j'ai sautée en cuisant les stations de craft.

Les coupables sont les animations du PERSONNAGE de démonstration du pack
(Building/Idle, FirstPerson et ThirdPerson) : elles visent un squelette qui n'a
jamais été importé. Les animations de STATIONS (AS_Lathe_03, AS_Bellows,
AS_FuelDistiller_08…) ont le leur et doivent rester.

── POURQUOI DÉPLACER PLUTÔT QUE SUPPRIMER ───────────────────────────────────
`DirectoriesToNeverCook` exclurait le dossier ENTIER, donc aussi les animations
de stations qui y vivent. Et on ne supprime rien sur ce projet : hors de
`Narvos/`, un asset n'est plus cuit — il reste consultable dans l'éditeur.
"""
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

DOSSIER = os.environ.get("NARVOS_DOSSIER", "/Game/Narvos/CraftingStations/Animations")
QUARANTAINE = os.environ.get("NARVOS_QUARANTAINE", "/Game/Quarantaine/AnimsSansSquelette")
APPLIQUER = os.environ.get("NARVOS_APPLIQUER") == "1"


def dire(t):
    print(t)
    unreal.log("[NARVOS] " + t)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
donnees = registre.get_assets_by_path(DOSSIER, recursive=True) or []
anims = [d for d in donnees if str(d.asset_class_path.asset_name) in
         ("AnimSequence", "AnimMontage", "AnimComposite")]

dire("%d animation(s) sous %s" % (len(anims), DOSSIER))
if not APPLIQUER:
    dire("ESSAI — NARVOS_APPLIQUER=1 pour deplacer")

sans, avec, illisibles = [], 0, []
for d in sorted(anims, key=lambda x: str(x.asset_name)):
    chemin = str(d.package_name)
    a = unreal.EditorAssetLibrary.load_asset(chemin)
    if a is None:
        illisibles.append(chemin)
        continue
    try:
        squelette = a.get_editor_property("skeleton")
    except Exception:
        squelette = None
    if squelette is None:
        sans.append((str(d.asset_name), chemin))
    else:
        avec += 1

dire("")
dire("  avec squelette : %d" % avec)
dire("  SANS squelette : %d   (ce sont elles qui tuent le cook)" % len(sans))
dire("  illisibles     : %d" % len(illisibles))
for nom, _ in sans:
    dire("      %s" % nom)

if not sans:
    dire("")
    dire("Rien a deplacer.")
    raise SystemExit(0)

if not APPLIQUER:
    raise SystemExit(0)

# ── Le déplacement ───────────────────────────────────────────────────────────
outils = unreal.AssetToolsHelpers.get_asset_tools()
deplacements = []
for nom, chemin in sans:
    deplacements.append(unreal.AssetRenameData(
        unreal.EditorAssetLibrary.load_asset(chemin), QUARANTAINE, nom))

try:
    outils.rename_assets(deplacements)
except Exception as err:
    dire("ECHEC du deplacement : %s" % err)

# ⚠ LE SEUL CONTROLE QUI VAUT : un recomptage. `rename_assets` a deja rendu
# « vrai » en ne creant qu un dossier vide sur ce projet (2026-09-06).
restants = 0
for nom, chemin in sans:
    if unreal.EditorAssetLibrary.does_asset_exist(chemin):
        restants += 1

dire("")
dire("=== BILAN ===")
dire("  demandees   : %d" % len(sans))
dire("  encore sous %s : %d" % (DOSSIER, restants))
arrivees = len(registre.get_assets_by_path(QUARANTAINE, recursive=True) or [])
dire("  arrivees en quarantaine : %d" % arrivees)
if restants:
    dire("  ⚠ le cook mourra ENCORE sur celles-la — ne pas relancer avant d avoir compris")