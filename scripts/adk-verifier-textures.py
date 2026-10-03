# ══════════════════════════════════════════════════════════════════════════════
# adk-verifier-textures.py — un mesh a-t-il VRAIMENT des textures ?
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript
#       -script=".../adk-verifier-textures.py"
#
# `NARVOS_RACINE` : chemin de package à mesurer (ex. `Game/Narvos/stylized_modular`)
#
# ── POURQUOI CELUI-CI EXISTE À CÔTÉ DE adk-verify-import.py ───────────────────
# `adk-verify-import.py` a menti DEUX FOIS sur ce projet. Il annonçait
# « 4 texture(s) » sur chacune des 40 pièces de `stylized_modular` alors que
# l'inventaire typé de l'ADK y comptait **zéro Texture2D**. Il cherchait les
# textures dans tout le registre au lieu de suivre les matériaux DU MESH, et
# ramassait celles des packs voisins.
#
# Ici, le chemin est strict et ne quitte jamais le mesh :
#
#     SkeletalMesh -> slots de matériau -> MaterialInstance -> texture_parameter_values
#
# Un matériau dont aucun paramètre de texture n'est renseigné est compté à ZÉRO,
# même si mille textures existent ailleurs dans le projet. C'est exactement la
# situation qui produit un personnage gris, et c'est celle qu'on veut voir.
#
# ── CE QU'IL NE PEUT PAS VOIR ─────────────────────────────────────────────────
# Un `Material` brut (non-instance) n'expose pas `texture_parameter_values` : ses
# textures sont câblées dans le graphe. Le mesh est alors marqué `GRAPHE` plutôt
# que compté à zéro — l'ignorer donnerait un faux négatif aussi trompeur que le
# faux positif qu'on corrige.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal


def journal(message):
    unreal.log("[NARVOS] " + message)


def _racine():
    """Chemin de package, protégé de la conversion de chemins de Git Bash.

    ⚠ MSYS réécrit toute valeur commençant par `/`. On retrouve donc le point de
    montage DANS la chaîne au lieu de découper sur le dernier segment.
    """
    v = os.environ.get("NARVOS_RACINE", "/Game/Narvos").replace("\\", "/").strip()

    # Trois formes acceptees, et il FAUT les trois :
    #   /Game/x            forme canonique
    #   Game/x             forme SANS barre, celle qu'on ecrit sous Git Bash
    #   C:/.../Game/x      ce que MSYS fabrique quand on ecrit /Game/x
    #
    # La version precedente ne testait que la troisieme et la premiere : passer
    # `Game/Narvos/stylized_modular` retombait sur le defaut `/Game/Narvos`, et
    # l'outil mesurait le PROJET ENTIER — 2 026 meshes au lieu de 40. Le chiffre
    # absurde est ce qui a revele le defaut ; un ecart plus discret serait passe.
    i = v.find("/Game/")
    if i >= 0:
        return v[i:]
    if v.startswith("Game/") or v == "Game":
        return "/" + v
    return v if v.startswith("/Game") else "/Game/Narvos"


RACINE = _racine()
journal("racine : " + RACINE)

registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)

meshes = [d for d in registre.get_assets_by_path(RACINE, recursive=True)
          if str(d.asset_class_path.asset_name) == "SkeletalMesh"]

if not meshes:
    journal("AUCUN SkeletalMesh sous " + RACINE)
    raise SystemExit(1)

journal("%d SkeletalMesh" % len(meshes))
journal("")


def textures_du_materiau(interface):
    """Textures atteignables depuis UN matériau. Rend (nombre, mode)."""
    if interface is None:
        return 0, "AUCUN"

    # `texture_parameter_values` n'existe que sur MaterialInstance. Sur un
    # Material brut, l'absence n'est pas une erreur : les textures sont dans le
    # graphe, hors de portée du Python.
    try:
        valeurs = interface.get_editor_property("texture_parameter_values")
    except Exception:                                        # noqa: BLE001
        return 0, "GRAPHE"

    n = 0
    for v in valeurs:
        try:
            if v.get_editor_property("parameter_value") is not None:
                n += 1
        except Exception:                                    # noqa: BLE001
            pass
    return n, "INSTANCE"


gris = []
graphe = []
sans_slot = []
total_textures = 0

for donnee in meshes:
    mesh = donnee.get_asset()
    if mesh is None:
        continue

    nom = str(donnee.asset_name)

    try:
        slots = mesh.get_editor_property("materials")
    except Exception as erreur:                              # noqa: BLE001
        journal("  ILLISIBLE %s (%s)" % (nom, erreur))
        continue

    if len(slots) == 0:
        sans_slot.append(nom)
        continue

    n_mesh = 0
    modes = set()
    for slot in slots:
        interface = slot.get_editor_property("material_interface")
        n, mode = textures_du_materiau(interface)
        n_mesh += n
        modes.add(mode)

    total_textures += n_mesh

    if n_mesh == 0:
        if "GRAPHE" in modes:
            graphe.append(nom)
        else:
            gris.append(nom)

journal("=== bilan ===")
journal("  %d mesh(es) examine(s)" % len(meshes))
journal("  %d texture(s) atteinte(s) au total, via les slots" % total_textures)
journal("  %d SANS AUCUNE TEXTURE — ils sortiront GRIS" % len(gris))
journal("  %d avec un Material brut (textures dans le graphe, non mesurables)" % len(graphe))
journal("  %d sans le moindre slot de materiau" % len(sans_slot))

for etiquette, liste in (("GRIS", gris), ("GRAPHE", graphe), ("SANS SLOT", sans_slot)):
    if liste:
        journal("")
        journal("  %s (%d) :" % (etiquette, len(liste)))
        for n in liste[:15]:
            journal("      " + n)
        if len(liste) > 15:
            journal("      … et %d autre(s)" % (len(liste) - 15))

if gris:
    journal("")
    journal("ACTION : ces meshes n'ont aucune texture atteignable depuis leurs")
    journal("  materiaux. Rebrancher avec scripts/adk-rebrancher-materiaux.py,")
    journal("  apres avoir importe les materiaux d'origine du pack.")
    raise SystemExit(1)