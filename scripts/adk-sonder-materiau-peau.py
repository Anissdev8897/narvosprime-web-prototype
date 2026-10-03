# ══════════════════════════════════════════════════════════════════════════════
# adk-sonder-materiau-peau.py — pourquoi la peau teintee rend-elle GRIS ?
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="…"
#
# ── L'HYPOTHESE A TESTER ──────────────────────────────────────────────────────
# `M_NarvosPeau` a ete fabrique par script. Le sampler branche sur `MP_NORMAL`
# n'a PAS recu de `sampler_type` : par defaut il est `SAMPLERTYPE_Color`, et
# Unreal REFUSE de compiler une normal map lue en Color vers l'entree Normal.
# Un materiau qui ne compile pas rend le materiau par defaut — gris uni.
#
# Ce sondage lit ce que le moteur SAIT du materiau, au lieu de le deviner :
# ses parametres exposes, les textures reellement posees sur chaque instance, et
# le type de sampler de chaque expression.
# ══════════════════════════════════════════════════════════════════════════════

import unreal

DOSSIER = "/Game/Narvos/StylizedModularChar/Materials"


def journal(m):
    unreal.log("[NARVOS] " + m)


edition = unreal.MaterialEditingLibrary

master = unreal.EditorAssetLibrary.load_asset(DOSSIER + "/M_NarvosPeau")
if master is None:
    journal("ARRET : M_NarvosPeau introuvable")
    raise SystemExit(0)

# ── Les parametres que le master EXPOSE ──────────────────────────────────────
# Si la compilation a echoue, cette liste est vide ou incomplete : c'est le
# signal le plus direct.

journal("=== parametres exposes par M_NarvosPeau")
for nom_fn, libelle in (("get_texture_parameter_names", "texture"),
                        ("get_vector_parameter_names", "vecteur"),
                        ("get_scalar_parameter_names", "scalaire")):
    fn = getattr(edition, nom_fn, None)
    if fn is None:
        journal("  (%s : accesseur absent de cette version)" % libelle)
        continue
    try:
        noms = fn(master) or []
    except Exception as e:
        journal("  %s : ECHEC %s" % (libelle, e))
        continue
    journal("  %-9s : %s" % (libelle, ", ".join(str(n) for n in noms) or "(aucun)"))

# ── Le type de sampler de chaque expression de texture ───────────────────────
#
# ⚠ C'EST LE POINT. `SAMPLERTYPE_Normal` est obligatoire pour alimenter
# l'entree Normal ; `SAMPLERTYPE_Color` y provoque une erreur de compilation.

journal("")
journal("=== expressions de texture et leur sampler_type")
try:
    expressions = master.get_editor_property("expression_collection").expressions
except Exception:
    expressions = []
for e in expressions:
    if not isinstance(e, unreal.MaterialExpressionTextureSampleParameter2D):
        continue
    try:
        nom = e.get_editor_property("parameter_name")
        st = e.get_editor_property("sampler_type")
        tex = e.get_editor_property("texture")
        journal("  %-12s sampler_type=%-26s texture=%s"
                % (nom, st, tex.get_name() if tex else "(aucune)"))
    except Exception as ex:
        journal("  lecture impossible : %s" % ex)

# ── Ce que chaque instance pose reellement ───────────────────────────────────

journal("")
journal("=== textures posees sur les instances")
for nom in ("MI_NarvosPeau_M", "MI_NarvosPeau_F"):
    inst = unreal.EditorAssetLibrary.load_asset(DOSSIER + "/" + nom)
    if inst is None:
        journal("  %s : ABSENTE" % nom)
        continue
    for param in ("BaseColor", "Normal"):
        try:
            t = edition.get_material_instance_texture_parameter_value(inst, param)
            journal("  %-18s %-10s -> %s" % (nom, param, t.get_name() if t else "(aucune)"))
        except Exception as e:
            journal("  %-18s %-10s ECHEC %s" % (nom, param, e))
    try:
        c = edition.get_material_instance_vector_parameter_value(inst, "Teinte")
        journal("  %-18s Teinte     -> %s" % (nom, c))
    except Exception as e:
        journal("  %-18s Teinte     ECHEC %s" % (nom, e))