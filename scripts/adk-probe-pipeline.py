# ══════════════════════════════════════════════════════════════════════════════
# adk-probe-pipeline.py — que contient réellement InterchangeGenericAssetsPipeline ?
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript
#       -script="D:/.../scripts/adk-probe-pipeline.py"
#
# POURQUOI : l'import produit des meshes et des matériaux, mais PAS les textures
# des personnages — sans une seule erreur. Le suspect est le pipeline, que
# `adk-import-narvos.py` construit à neuf en ne réglant que le squelette. Ses
# sous-pipelines matériaux/textures gardent donc des valeurs par défaut que
# personne n'a jamais regardées.
#
# On ne devine pas les noms de propriétés : on les DEMANDE à l'objet. Les quatre
# tentatives à l'aveugle (`import_textures`, `bImportTextures`…) échouaient
# peut-être toutes en silence, ce qui expliquerait que rien ne change.
#
# Ce script n'importe rien et n'écrit rien : il lit et il rapporte.
# ══════════════════════════════════════════════════════════════════════════════

import unreal


def journal(message):
    unreal.log("[NARVOS] " + message)


pipeline = unreal.InterchangeGenericAssetsPipeline()

journal("=== proprietes de InterchangeGenericAssetsPipeline ===")

# `get_editor_property` lève sur ce qui n'est pas une propriété : c'est le seul
# moyen fiable de distinguer une vraie propriété d'une méthode Python.
noms = [n for n in dir(pipeline) if not n.startswith("_")]

sous_objets = []
for nom in sorted(noms):
    try:
        valeur = pipeline.get_editor_property(nom)
    except Exception:                                        # noqa: BLE001
        continue

    type_nom = type(valeur).__name__
    if "Pipeline" in type_nom or "Properties" in type_nom:
        sous_objets.append((nom, valeur, type_nom))
        journal("  %-52s -> %s  (sous-objet)" % (nom, type_nom))
    else:
        texte = str(valeur)
        if len(texte) > 60:
            texte = texte[:57] + "..."
        journal("  %-52s = %s" % (nom, texte))

journal("")
journal("=== contenu des sous-objets ===")
for nom, objet, type_nom in sous_objets:
    journal("--- %s (%s)" % (nom, type_nom))
    for p in sorted(n for n in dir(objet) if not n.startswith("_")):
        try:
            v = objet.get_editor_property(p)
        except Exception:                                    # noqa: BLE001
            continue
        texte = str(v)
        if len(texte) > 50:
            texte = texte[:47] + "..."
        journal("      %-46s = %s" % (p, texte))

journal("")
journal("=== ce que le PROJET utilise par defaut ===")
# Le stack de pipelines configuré du projet : c'est lui qui importe correctement
# quand on double-clique un GLB dans l'éditeur. Comparer ses réglages aux nôtres
# dit exactement ce qu'on a oublié.
try:
    reglages = unreal.get_default_object(unreal.InterchangeProjectSettings)
    journal("InterchangeProjectSettings lu : %s" % type(reglages).__name__)
    for p in sorted(n for n in dir(reglages) if not n.startswith("_")):
        if "pipeline" not in p.lower() and "stack" not in p.lower():
            continue
        try:
            journal("  %-46s = %s" % (p, str(reglages.get_editor_property(p))[:80]))
        except Exception:                                    # noqa: BLE001
            pass
except Exception as erreur:                                  # noqa: BLE001
    journal("InterchangeProjectSettings illisible : %s" % erreur)