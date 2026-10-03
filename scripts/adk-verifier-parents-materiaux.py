# ══════════════════════════════════════════════════════════════════════════════
# adk-verifier-parents-materiaux.py — quelles MaterialInstance ont perdu leur
# parent ?
#
#   NARVOS_RACINE=/Game/Narvos  UnrealEditor-Cmd … -run=pythonscript -script="…"
#
# ── POURQUOI ─────────────────────────────────────────────────────────────────
# Une `MaterialInstanceConstant` sans parent rend le materiau PAR DEFAUT du
# moteur — damier gris — et n'expose AUCUN parametre dans l'editeur. Rien ne le
# signale : ni erreur, ni avertissement au cook.
#
# Constate le 2026-09-05 sur les trois instances de terrain de
# MWLandscapeAutoMaterial : leurs 12 surcharges de texture etaient posees, mais
# ne resolvaient rien. C'est le piege des `.uasset` COPIES plutot que deplaces
# par l'editeur : les references se perdent.
#
# Ca ne frappe jamais un seul asset — d'ou ce balayage.
# ══════════════════════════════════════════════════════════════════════════════
import os, unreal

RACINE = os.environ.get("NARVOS_RACINE", "/Game/Narvos").replace("\\", "/").rstrip("/")
def j(m): unreal.log("[NARVOS] " + m)

registre = unreal.AssetRegistryHelpers.get_asset_registry()
instances = [d for d in registre.get_assets_by_path(RACINE, recursive=True)
             if str(d.asset_class_path.asset_name) == "MaterialInstanceConstant"]
j("%d MaterialInstanceConstant sous %s" % (len(instances), RACINE))

orphelines = []
for d in instances:
    a = d.get_asset()
    if a is None: continue
    try:
        p = a.get_editor_property("parent")
    except Exception:
        p = None
    if p is None:
        orphelines.append(str(d.package_name))

j("")
j("=== %d instance(s) SANS PARENT" % len(orphelines))
for c in sorted(orphelines)[:60]:
    j("  " + c)
if len(orphelines) > 60:
    j("  … et %d autre(s)" % (len(orphelines) - 60))