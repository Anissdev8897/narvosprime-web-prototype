# ══════════════════════════════════════════════════════════════════════════════
# adk-blend-space-locomotion.py — refait `/Game/Narvos/Locomotion/BS_Narvos_Locomotion`.
#
#   EDITEUR COMPLET seulement : etape de scripts/recuperation/adk-session-reparations.py.
#
# ── D'OU IL VIENT ─────────────────────────────────────────────────────────────
# Le blend space pose par `Builder.LOCOMOTION` (Shared/Logic/Character.lua:253) avait ete
# fabrique le 23/09 par le serveur MCP de l'editeur (`create_blend_space` +
# `add_blend_space_sample`) : un plugin C++ que la perte du disque a emporte. La recette, elle,
# est ecrite dans le Lua : axe X « Speed » 0..600, quatre boucles a y = 0.
#
# ── POURQUOI PAS `adk-creer-blend-spaces.py` ──────────────────────────────────
# Rejoue le 04/10, il cree l'asset et s'arrete a l'axe : `blend_parameter_x` n'existe pas en
# 5.7 (le champ est `BlendParameters[3]`, un tableau fixe) et `add_sample` n'est pas une
# UFUNCTION — Python ne le voit pas. Les deux se contournent par les proprietes d'editeur
# `blend_parameters` et `sample_data`.
#
# ── POURQUOI L'EDITEUR OUVERT SUR L'ASSET ─────────────────────────────────────
# Lu dans la source du moteur (BlendSpace.cpp, SAnimationBlendSpace.cpp) : poser `sample_data`
# ne construit PAS les donnees d'execution (`BlendSpaceData.Segments`). `ResampleData()` n'est
# appele que par l'editeur de blend space — a sa construction, et a chaque propriete changee
# tant qu'il est ouvert. Un blend space sauve sans cela se charge, se cuit, et ne joue RIEN.
# On ouvre donc son editeur, on pose axe et echantillons, on le referme, on sauve — et la
# session prouve sur le disque que `Segments` est dans le paquet.
# ══════════════════════════════════════════════════════════════════════════════
import unreal

SQUELETTE = "/Game/NanosWorld/Characters/Common/SKEL_Mannequin"
DOSSIER = "/Game/Narvos/Locomotion"
NOM = "BS_Narvos_Locomotion"
VITESSE_MAX = 600.0
DIVISIONS = 4
# (animation, vitesse en cm/s) — Character.lua:250.
ECHANTILLONS = [
    ("/Game/Narvos/Locomotion/Idle/M_Neutral_Stand_Idle_Loop", 0.0),
    ("/Game/Narvos/Locomotion/Walk/M_Neutral_Walk_Loop_F", 150.0),
    ("/Game/Narvos/Locomotion/Run/M_Neutral_Run_Loop_F", 375.0),
    ("/Game/Narvos/Locomotion/Sprint/M_Neutral_Sprint_Loop_F", 600.0),
]


def journal(message):
    unreal.log("[NARVOS] " + message)


def arret(message):
    journal("ARRET blend-space : " + message)
    raise SystemExit(1)


try:
    _EDITEUR_VIVANT = unreal.EditorLevelLibrary.get_editor_world() is not None
except Exception:
    _EDITEUR_VIVANT = False
if not _EDITEUR_VIVANT:
    arret("pas de monde editeur (commandlet) — l'editeur de blend space ne peut pas s'ouvrir.")

complet = DOSSIER + "/" + NOM
if unreal.EditorAssetLibrary.does_asset_exist(complet):
    journal("    blend space deja present : %s — laisse tel quel" % complet)
    raise SystemExit(0)

squelette = unreal.load_asset(SQUELETTE)
if squelette is None:
    arret("squelette introuvable " + SQUELETTE)
animations = []
for chemin, vitesse in ECHANTILLONS:
    animation = unreal.load_asset(chemin)
    if not isinstance(animation, unreal.AnimSequence):
        arret("animation introuvable " + chemin)
    animations.append((animation, vitesse))

fabrique = unreal.BlendSpaceFactoryNew()
fabrique.set_editor_property("target_skeleton", squelette)
blend = unreal.AssetToolsHelpers.get_asset_tools().create_asset(NOM, DOSSIER, unreal.BlendSpace, fabrique)
if blend is None:
    arret("create_asset a rendu None")

editeurs = unreal.get_editor_subsystem(unreal.AssetEditorSubsystem)
if not editeurs.open_editor_for_assets([blend]):
    arret("l'editeur de blend space ne s'est pas ouvert : les donnees d'execution ne seraient pas construites.")
try:
    axes = blend.get_editor_property("blend_parameters")
    vitesse_axe = unreal.BlendParameter()
    vitesse_axe.set_editor_property("display_name", "Speed")
    vitesse_axe.set_editor_property("min", 0.0)
    vitesse_axe.set_editor_property("max", VITESSE_MAX)
    vitesse_axe.set_editor_property("grid_num", DIVISIONS)
    axes[0] = vitesse_axe
    blend.set_editor_property("blend_parameters", axes)

    echantillons = []
    for animation, vitesse in animations:
        echantillon = unreal.BlendSample()
        echantillon.set_editor_property("animation", animation)
        echantillon.set_editor_property("sample_value", unreal.Vector(vitesse, 0.0, 0.0))
        echantillon.set_editor_property("rate_scale", 1.0)
        echantillons.append(echantillon)
    # Editeur OUVERT : ce changement de propriete declenche ValidateSampleData + ResampleData.
    blend.set_editor_property("sample_data", echantillons)
finally:
    editeurs.close_all_editors_for_asset(blend)

# Relecture : ne pas croire l'ecriture sur parole.
axe_relu = blend.get_editor_property("blend_parameters")[0]
poses = blend.get_editor_property("sample_data")
journal("    axe X : %s %.0f..%.0f, %d divisions" % (
    axe_relu.get_editor_property("display_name"), axe_relu.get_editor_property("min"),
    axe_relu.get_editor_property("max"), axe_relu.get_editor_property("grid_num")))
for echantillon in poses:
    animation = echantillon.get_editor_property("animation")
    journal("    echantillon %-34s x = %.0f" % (
        animation.get_name() if animation else "AUCUNE", echantillon.get_editor_property("sample_value").x))
if len(poses) != len(ECHANTILLONS) or axe_relu.get_editor_property("max") != VITESSE_MAX:
    arret("relecture differente de la recette (%d echantillon(s)) — asset NON sauve." % len(poses))

ecrit = unreal.EditorAssetLibrary.save_loaded_asset(blend, False)
journal("    blend space cree : %s, sauve %s" % (complet, bool(ecrit)))
