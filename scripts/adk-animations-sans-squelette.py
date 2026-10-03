# ══════════════════════════════════════════════════════════════════════════════
# adk-animations-sans-squelette.py — trouver AVANT le cook ce qui va le tuer.
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript \
#     -script="<...>/scripts/adk-animations-sans-squelette.py" -unattended -nosplash
#
# ⚠ ÉDITEUR FERMÉ (commandlet).
#
# ── POURQUOI CE SCRIPT EXISTE ─────────────────────────────────────────────────
# Le 2026-09-06, trois cooks de suite sont morts sur la MÊME assertion :
#
#     LogAnimation: Warning: Animation Compression request for X failed,
#                   Skeleton == nullptr.
#     Assertion failed: !Hash.IsZero()  AnimSequence.cpp:2151
#
# Une AnimSequence dont le squelette est nul n'échoue pas à la compression : elle
# TUE LE PROCESSUS. Et comme le cook s'arrête à la première, on ne découvre la
# suivante qu'au cook d'après — à deux heures la tentative.
#
# Trois coupables trouvés un par un : le contenu d'exemple d'UniGLB, puis
# Metahuman_Customization_System, puis SmartLocomotion. Chercher la quatrième de
# la même façon coûterait deux heures de plus.
#
# Ce script les liste TOUTES en quelques minutes, sans rien cuire.
#
# ── CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS ────────────────────────────────────
# Il LIT. Il ne supprime rien, ne modifie rien, ne corrige rien : il écrit un
# rapport JSON et propose les lignes `DirectoriesToNeverCook` à coller.
#
# Réparer serait un autre travail — réimporter l'animation en imposant le
# squelette, ce que fait `adk-import-narvos.py`. Exclure est la décision de qui
# veut cuire aujourd'hui ; réparer, celle de qui veut l'animation.
# ══════════════════════════════════════════════════════════════════════════════

import json
import os

import unreal

SORTIE = os.environ.get(
    "NARVOS_SORTIE",
    "E:/narvosprime-web-prototype/WebPortal/Server/adk/_animations-orphelines.json")
RACINE = os.environ.get("NARVOS_RACINE", "/Game/Narvos")


def journal(m):
    unreal.log("[NARVOS] " + m)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)

donnees = registre.get_assets_by_path(RACINE, recursive=True)
anims = [d for d in donnees if str(d.asset_class_path.asset_name) == "AnimSequence"]

journal("%d AnimSequence sous %s" % (len(anims), RACINE))

orphelines = []
illisibles = []

for i, d in enumerate(anims, 1):
    chemin = str(d.package_name)
    try:
        asset = unreal.EditorAssetLibrary.load_asset(chemin)
    except Exception as e:
        illisibles.append([chemin, str(e)[:120]])
        continue
    if asset is None:
        illisibles.append([chemin, "load_asset a rendu None"])
        continue
    try:
        # `get_editor_property("skeleton")` leve si la propriete manque ; un
        # squelette absent rend None. Les deux cas comptent comme orphelin.
        squelette = asset.get_editor_property("skeleton")
    except Exception as e:
        orphelines.append([chemin, "propriete illisible : " + str(e)[:80]])
        continue
    if squelette is None:
        orphelines.append([chemin, "skeleton = None"])

    if i % 500 == 0:
        journal("  %d / %d examinees, %d orpheline(s)" % (i, len(anims), len(orphelines)))

# ── Les dossiers a exclure ───────────────────────────────────────────────────
#
# On remonte au dossier PARENT de chaque orpheline plutot que de lister les
# assets un par un : `DirectoriesToNeverCook` prend des dossiers, et une
# animation orpheline a presque toujours des soeurs.
dossiers = {}
for chemin, _ in orphelines:
    parent = chemin.rsplit("/", 1)[0]
    dossiers[parent] = dossiers.get(parent, 0) + 1

journal("")
journal("=== %d AnimSequence ORPHELINE(S), dans %d dossier(s)" % (len(orphelines), len(dossiers)))
for dossier, n in sorted(dossiers.items(), key=lambda x: -x[1]):
    journal("  %4d  %s" % (n, dossier))

if illisibles:
    journal("")
    journal("=== %d asset(s) illisible(s)" % len(illisibles))
    for c, e in illisibles[:10]:
        journal("  %s : %s" % (c, e))

# Les lignes a coller dans Config/DefaultGame.ini, chemin relatif a Content/.
lignes = []
for dossier in sorted(dossiers):
    relatif = dossier[len("/Game/"):] if dossier.startswith("/Game/") else dossier
    lignes.append('+DirectoriesToNeverCook=(Path="%s")' % relatif)

journal("")
journal("=== a coller dans Config/DefaultGame.ini")
for l in lignes:
    journal("  " + l)

with open(SORTIE, "w", encoding="utf-8") as fh:
    json.dump({
        "racine": RACINE,
        "anim_sequences": len(anims),
        "orphelines": orphelines,
        "illisibles": illisibles,
        "dossiers": dossiers,
        "lignes_ini": lignes,
    }, fh, indent=1, ensure_ascii=False)

journal("")
journal("ecrit : " + SORTIE)