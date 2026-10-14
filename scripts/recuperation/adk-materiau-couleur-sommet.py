# ══════════════════════════════════════════════════════════════════════════════
# adk-materiau-couleur-sommet.py — refait `M_NarvosCouleurSommet` et le pose sur `mob_boss`.
#
#   EDITEUR COMPLET seulement (cree et sauve un UMaterial) : etape de
#   scripts/recuperation/adk-session-reparations.py.
#
# ── D'OU IL VIENT ─────────────────────────────────────────────────────────────
# Le materiau avait ete fabrique le 04/09 dans l'editeur ouvert, par deux scripts de session
# (`mat_vertexcolor.py`, `mat_vc2.py`) jamais ranges dans le depot : celui-ci est leur
# reunion, relue dans les historiques le 04/10 apres la perte du disque.
#
# ── POURQUOI CE MATERIAU ──────────────────────────────────────────────────────
# `mob_boss.glb` ne porte AUCUN materiau et AUCUNE texture : sa couleur est dans l'attribut
# `COLOR_0` de ses sommets. Interchange l'importe sans materiau, et le secours du moteur
# ignore les couleurs de sommet — le modele sort GRIS. Il faut un materiau qui LISE la
# couleur de sommet. Rugosite fixe a 0,75 : sans elle le modele est miroir, ce qui se lit
# comme un bug.
#
# ⚠ `materials` est un tableau de STRUCTS `SkeletalMaterial`. Modifier un element rendu par
# `get_editor_property` agit sur une COPIE : la relecture montrait toujours l'ancien materiau,
# sans erreur (mesure du 04/09). On reconstruit le tableau entier, puis on RELIT.
# ══════════════════════════════════════════════════════════════════════════════
import unreal

CHEMIN = "/Game/Narvos/pnj_monstre"
NOM = "M_NarvosCouleurSommet"
CIBLE = "/Game/Narvos/pnj_monstre/mob_boss/mob_boss"
RUGOSITE = 0.75


def journal(message):
    unreal.log("[NARVOS] " + message)


try:
    _EDITEUR_VIVANT = unreal.EditorLevelLibrary.get_editor_world() is not None
except Exception:
    _EDITEUR_VIVANT = False
if not _EDITEUR_VIVANT:
    journal("ARRET couleur-sommet : pas de monde editeur (commandlet) — on n'y sauve pas un UMaterial.")
    raise SystemExit(1)

complet = CHEMIN + "/" + NOM
if unreal.EditorAssetLibrary.does_asset_exist(complet):
    materiau = unreal.load_asset(complet)
    journal("    materiau deja present : " + complet)
else:
    outils = unreal.AssetToolsHelpers.get_asset_tools()
    materiau = outils.create_asset(NOM, CHEMIN, unreal.Material, unreal.MaterialFactoryNew())
    couleur = unreal.MaterialEditingLibrary.create_material_expression(
        materiau, unreal.MaterialExpressionVertexColor, -400, 0)
    unreal.MaterialEditingLibrary.connect_material_property(
        couleur, "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
    rugosite = unreal.MaterialEditingLibrary.create_material_expression(
        materiau, unreal.MaterialExpressionConstant, -400, 250)
    rugosite.set_editor_property("r", RUGOSITE)
    unreal.MaterialEditingLibrary.connect_material_property(
        rugosite, "", unreal.MaterialProperty.MP_ROUGHNESS)
    unreal.MaterialEditingLibrary.recompile_material(materiau)
    unreal.EditorAssetLibrary.save_asset(complet, only_if_is_dirty=False)
    journal("    materiau cree : " + complet)

mesh = unreal.load_asset(CIBLE)
if mesh is None:
    journal("ARRET couleur-sommet : maillage introuvable " + CIBLE)
    raise SystemExit(1)

neufs = []
for ancien in mesh.get_editor_property("materials"):
    slot = unreal.SkeletalMaterial()
    slot.set_editor_property("material_interface", materiau)
    slot.set_editor_property("material_slot_name", ancien.get_editor_property("material_slot_name"))
    neufs.append(slot)
mesh.set_editor_property("materials", neufs)
unreal.EditorAssetLibrary.save_asset(CIBLE, only_if_is_dirty=False)

# Relecture : ne pas croire l'ecriture sur parole.
for slot in unreal.load_asset(CIBLE).get_editor_property("materials"):
    interface = slot.get_editor_property("material_interface")
    chemin = interface.get_path_name().split(".")[0] if interface else "AUCUN"
    journal("    mob_boss -> %s (%s)" % (chemin, "local" if chemin.startswith("/Game/") else "ECHEC"))
