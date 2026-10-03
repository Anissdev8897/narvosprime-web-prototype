# ══════════════════════════════════════════════════════════════════════════════
# adk-verifier-morphs.py — les morph targets ont-ils survécu, et sous QUELS noms ?
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript
#       -script=".../adk-verifier-morphs.py"
#
# `NARVOS_MESH` : chemin de package du SkeletalMesh
#                 (défaut /Game/Narvos/personnages/_body/base_morphable)
#
# ── POURQUOI LE NOM EST TOUTE LA QUESTION ─────────────────────────────────────
# nanos pilote la morphologie par `SetMorphTarget(nom, valeur)`. Un morph
# importé mais NUMÉROTÉ — `..._mesh_0_17_MorphTarget` — existe, se voit dans
# l'éditeur, gonfle le fichier… et reste inatteignable depuis le Lua.
#
# C'est exactement ce qui est arrivé aux 52 cibles ARKit des têtes
# CyberpunkSamurai : le glTF ne les nommait pas, Interchange les a numérotées,
# et il a fallu un script dédié pour leur rendre un nom.
#
# Ici les noms viennent de `mesh.extras.targetNames`, écrits par
# `narvos-morphs-vers-glb.mjs`. Ce contrôle vérifie qu'Interchange les a bien
# repris — et non qu'il a « importé des morphs », ce qui ne prouve rien.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal


def journal(message):
    unreal.log("[NARVOS] " + message)


def _chemin():
    """Chemin de package, protégé de la conversion de chemins de Git Bash.

    ⚠ MSYS réécrit toute valeur commençant par `/`. On retrouve donc le point de
    montage DANS la chaîne plutôt que de découper sur le dernier segment.
    """
    v = os.environ.get("NARVOS_MESH", "/Game/Narvos/personnages/_body/base_morphable")
    v = v.replace("\\", "/").strip()
    i = v.find("/Game/")
    if i >= 0:
        return v[i:]
    if v.startswith("Game/"):
        return "/" + v
    return v


CHEMIN = _chemin()
journal("mesh : " + CHEMIN)

mesh = unreal.load_asset(CHEMIN)
if mesh is None:
    journal("ARRET : introuvable. Le chemin de package correspond-il au disque ?")
    raise SystemExit(1)

journal("classe : %s" % type(mesh).__name__)

# `get_all_morph_target_names` n'existe pas sur toutes les versions ; on tente
# les deux voies plutôt que de supposer.
noms = None
for methode in ("get_all_morph_target_names",):
    try:
        noms = list(getattr(mesh, methode)())
        journal("noms lus par %s()" % methode)
        break
    except Exception:                                        # noqa: BLE001
        continue

if noms is None:
    try:
        cibles = mesh.get_editor_property("morph_targets")
        noms = [str(c.get_name()) for c in cibles]
        journal("noms lus par la propriete morph_targets")
    except Exception as erreur:                              # noqa: BLE001
        journal("ARRET : impossible de lire les morph targets (%s)" % erreur)
        raise SystemExit(1)

journal("")
journal("%d morph target(s)" % len(noms))

if not noms:
    journal("ARRET : AUCUN morph target. Interchange les a ecartes a l'import.")
    raise SystemExit(1)

# ── Nommés, ou numérotés ? ────────────────────────────────────────────────────
#
# Un nom généré porte la marque d'Interchange : il finit par `MorphTarget` ou
# contient l'indice du mesh. Un nom repris de `targetNames` ressemble à
# `nose-base-down`.
numerotes = [n for n in noms if "MorphTarget" in n or n.rstrip("0123456789_") != n]
nommes = [n for n in noms if n not in numerotes]

journal("  %d nomme(s), %d numerote(s)" % (len(nommes), len(numerotes)))
journal("")
journal("echantillon :")
for n in sorted(nommes)[:10]:
    journal("    " + n)

if numerotes:
    journal("")
    journal("NUMEROTES (inatteignables depuis le Lua) :")
    for n in numerotes[:10]:
        journal("    " + n)

# ── Les zones attendues sont-elles toutes representees ? ──────────────────────
#
# Compter ne suffit pas : 290 morphs dont aucun de nez serait un echec qu'un
# total correct masquerait.
ZONES = ["nose", "mouth", "eye", "ear", "cheek", "chin", "forehead", "eyebrow", "head", "neck"]

journal("")
journal("par zone :")
manquantes = []
for zone in ZONES:
    n = len([x for x in noms if x.lower().startswith(zone)
             or ("-" + zone) in x.lower()])
    journal("    %-10s %3d" % (zone, n))
    if n == 0:
        manquantes.append(zone)

if manquantes:
    journal("")
    journal("ZONES ABSENTES : " + ", ".join(manquantes))

if numerotes:
    journal("")
    journal("ACTION : les morphs numerotes ne repondront pas a SetMorphTarget(nom).")
    journal("  Verifier que mesh.extras.targetNames est bien ecrit dans le GLB.")
    raise SystemExit(1)

journal("")
journal("Tous les morph targets portent un nom exploitable depuis le Lua.")