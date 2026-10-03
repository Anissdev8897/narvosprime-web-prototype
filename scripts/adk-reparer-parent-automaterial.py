# ══════════════════════════════════════════════════════════════════════════════
# adk-reparer-parent-automaterial.py — rendre leur PARENT aux instances du
# terrain.
#
# ── LE DEFAUT, MESURE LE 2026-09-05 ───────────────────────────────────────────
# Les trois `MTL_MWAM_Landscape_*Example` ont `parent = (AUCUN)`. Une
# MaterialInstanceConstant sans parent rend le materiau PAR DEFAUT du moteur —
# le damier gris — et n'expose aucun parametre dans l'editeur. D'ou les deux
# symptomes vus en jeu : vignettes grises, et impossible d'assigner une texture.
#
# Leurs 12 surcharges de texture etaient pourtant deja posees (12/12 relues) :
# elles ne resolvaient simplement rien, faute de parent.
#
# C'est le piege deja consigne pour ce depot : un `.uasset` copie plutot que
# deplace par l'editeur perd ses references. Ici c'est la reference au master.
# ══════════════════════════════════════════════════════════════════════════════
import unreal

PACK = "/Game/Narvos/MWLandscapeAutoMaterial"
MASTER = PACK + "/Materials/MASTER/MTL_MWAM_AutoMaterial_MASTER"
INSTANCES = [PACK + "/Materials/Landscape/MTL_MWAM_Landscape_IslandExample",
             PACK + "/Materials/Landscape/MTL_MWAM_Landscape_MountainRangeExample",
             PACK + "/Materials/Landscape/MTL_MWAM_Landscape_DesertExample"]

def j(m): unreal.log("[NARVOS] " + m)

mel = unreal.MaterialEditingLibrary
master = unreal.EditorAssetLibrary.load_asset(MASTER)
if master is None:
    j("ARRET : master introuvable"); raise SystemExit(0)
j("master : " + master.get_name())

for chemin in INSTANCES:
    inst = unreal.EditorAssetLibrary.load_asset(chemin)
    if inst is None:
        j("ABSENTE : " + chemin); continue
    nom = chemin.rsplit("/", 1)[-1]
    avant = inst.get_editor_property("parent")
    if avant is not None:
        j("%-44s parent deja pose (%s)" % (nom, avant.get_name())); continue
    try:
        mel.set_material_instance_parent(inst, master)
        unreal.EditorAssetLibrary.save_asset(chemin, only_if_is_dirty=False)
        apres = unreal.EditorAssetLibrary.load_asset(chemin).get_editor_property("parent")
        j("%-44s parent -> %s" % (nom, apres.get_name() if apres else "ECHEC (toujours vide)"))
    except Exception as e:
        j("%-44s ECHEC : %s" % (nom, e))