# ══════════════════════════════════════════════════════════════════════════════
# adk-probe-textures.py — descend dans material_pipeline.texture_pipeline.
#
# La sonde précédente s'arrêtait au premier niveau. Or `texture_pipeline` est
# imbriqué DANS `material_pipeline` : c'est donc lui qu'il fallait regarder pour
# comprendre pourquoi les textures des personnages n'arrivent pas alors que
# `import_materials` vaut déjà True.
#
# On lit aussi `material_import` et `search_location` en clair : LOCAL signifie
# « réutiliser un asset existant du dossier plutôt que d'en créer un », et c'est
# un candidat sérieux pour un import qui ne crée rien sans se plaindre.
# ══════════════════════════════════════════════════════════════════════════════

import unreal


def journal(message):
    unreal.log("[NARVOS] " + message)


def dumper(objet, titre, indent="  "):
    journal("--- %s (%s)" % (titre, type(objet).__name__))
    imbriques = []
    for p in sorted(n for n in dir(objet) if not n.startswith("_")):
        try:
            v = objet.get_editor_property(p)
        except Exception:                                    # noqa: BLE001
            continue
        t = type(v).__name__
        if "Pipeline" in t or "Properties" in t:
            imbriques.append((p, v))
            journal("%s%-46s -> %s" % (indent, p, t))
        else:
            journal("%s%-46s = %s" % (indent, p, str(v)[:70]))
    return imbriques


pipeline = unreal.InterchangeGenericAssetsPipeline()
materiaux = pipeline.get_editor_property("material_pipeline")

imbriques = dumper(materiaux, "material_pipeline")

for nom, objet in imbriques:
    journal("")
    dumper(objet, "material_pipeline." + nom, "      ")

# Valeurs d'enum en clair : `str()` les tronque, et c'est justement leur nom qui
# porte le sens.
journal("")
journal("=== enums en clair ===")
for nom in ("material_import", "search_location"):
    try:
        v = materiaux.get_editor_property(nom)
        journal("  %-24s = %s" % (nom, repr(v)))
    except Exception as e:                                   # noqa: BLE001
        journal("  %-24s illisible (%s)" % (nom, e))

journal("")
journal("=== valeurs possibles ===")
for enum_nom in ("InterchangeMaterialImportOption", "InterchangeMaterialSearchLocation"):
    try:
        enum = getattr(unreal, enum_nom)
        valeurs = [n for n in dir(enum) if n.isupper()]
        journal("  %s : %s" % (enum_nom, ", ".join(valeurs)))
    except Exception as e:                                   # noqa: BLE001
        journal("  %s illisible (%s)" % (enum_nom, e))