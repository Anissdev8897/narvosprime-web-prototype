# ══════════════════════════════════════════════════════════════════════════════
# adk-sonder-mutable.py — que peut-on piloter de Mutable depuis Python ?
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="…"
#
# ── LA QUESTION QUI DÉCIDE DU CHANTIER ────────────────────────────────────────
# Mutable est activé dans l'ADK, et il n'existe **zéro** `CustomizableObject`
# (mesuré le 2026-09-05 sur l'inventaire typé). Avant de promettre un système
# modulaire Mutable, il faut savoir si son graphe est CONSTRUCTIBLE par script ou
# si c'est de l'édition à la main.
#
# La différence n'est pas de confort : un graphe scriptable se régénère depuis
# les catalogues à chaque ajout de pièce ; un graphe à la main se périme au
# premier import et devient une liste recopiée — la panne que ce dépôt paie en
# boucle.
#
# On ne conclut donc pas d'après la doc : on demande au moteur ce qu'il expose.
# ══════════════════════════════════════════════════════════════════════════════

import unreal


def journal(message):
    unreal.log("[NARVOS] " + message)


# ── Quelles classes Mutable existent côté Python ? ───────────────────────────

ATTENDUES = [
    "CustomizableObject",
    "CustomizableObjectInstance",
    "CustomizableSkeletalComponent",
    "CustomizableSkeletalMeshActor",
    "CustomizableObjectFactory",
    "CustomizableObjectInstanceFactory",
    "CustomizableObjectNodeObject",
    "CustomizableObjectNodeSkeletalMesh",
    "CustomizableObjectNodeMaterial",
]

journal("=== classes Mutable exposees a Python")
presentes = []
for nom in ATTENDUES:
    ok = hasattr(unreal, nom)
    journal("  %-38s %s" % (nom, "OUI" if ok else "absent"))
    if ok:
        presentes.append(nom)

# ── Ce qu'on peut faire d'une classe présente ────────────────────────────────

journal("")
journal("=== ce que CustomizableObject expose")
if hasattr(unreal, "CustomizableObject"):
    co = unreal.CustomizableObject
    methodes = sorted(m for m in dir(co) if not m.startswith("_"))
    journal("  %d membre(s)" % len(methodes))
    # Les noms qui trahissent une construction de graphe.
    interessants = [m for m in methodes
                    if any(k in m.lower() for k in ("node", "graph", "source", "compile", "param", "mesh"))]
    for m in interessants[:40]:
        journal("    " + m)
    if not interessants:
        journal("    AUCUN membre de graphe/parametre — l'objet est LISIBLE, pas CONSTRUCTIBLE ici.")
else:
    journal("  classe absente : rien n'est pilotable depuis Python.")

journal("")
journal("=== instance : les setters de parametres")
if hasattr(unreal, "CustomizableObjectInstance"):
    coi = unreal.CustomizableObjectInstance
    setters = sorted(m for m in dir(coi)
                     if m.startswith(("set_", "get_")) and "param" in m.lower())
    journal("  %d setter(s)/getter(s) de parametre" % len(setters))
    for m in setters[:24]:
        journal("    " + m)
else:
    journal("  classe absente.")

# ── Une fabrique permettrait de CRÉER l'asset ────────────────────────────────

journal("")
journal("=== fabriques disponibles")
for nom in ("CustomizableObjectFactory", "CustomizableObjectInstanceFactory"):
    if hasattr(unreal, nom):
        journal("  %s : presente — creation d'asset possible" % nom)
    else:
        journal("  %s : absente" % nom)

journal("")
journal("Verdict a lire ainsi : sans fabrique NI membre de graphe, un")
journal("CustomizableObject ne peut etre cree qu'a la main dans l'editeur.")