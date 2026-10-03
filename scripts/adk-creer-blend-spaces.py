"""
adk-creer-blend-spaces.py — fabrique le blend space de locomotion NARVOS dans l'ADK.

Contexte : la locomotion nanos tourne sur la native tant que `Builder.LOCOMOTION = nil`
(Shared/Logic/Character.lua:250). Le commentaire prévoit : blend spaces NARVOS fabriqués
dans l'éditeur, cuits, puis la constante Lua change seule.

Recette BS_Narvos_Locomotion (1D, axe vitesse cm/s) :
    Idle   M_Neutral_Stand_Idle_Loop   @ 0
    Walk   M_Neutral_Walk_Loop_F       @ 150
    Run    M_Neutral_Run_Loop_F        @ 375
    Sprint M_Neutral_Sprint_Loop_F     @ 600
Squelette : /Game/NanosWorld/Characters/Common/SKEL_Mannequin

Usage :
  UnrealEditor-Cmd.exe E:/narvosprime-web-prototype/WebPortal/Server/adk/NanosWorldADK.uproject \
    -run=pythonscript -script="E:/narvosprime-web-prototype/scripts/adk-creer-blend-spaces.py" \
    -unattended -nosplash -stdout -log
  NARVOS_BS_APPLIQUER=1  ->  crée réellement l'asset (sinon : sonde seule).
"""
import os
import unreal

APPLIQUER = os.environ.get("NARVOS_BS_APPLIQUER") == "1"

SKELETON = "/Game/NanosWorld/Characters/Common/SKEL_Mannequin"
DESTINATION = "/Game/Narvos/Locomotion"
NOM = "BS_Narvos_Locomotion"

# (libellé, chemin asset, position sur l'axe vitesse)
SAMPLES = [
    ("Idle", "/Game/Narvos/Locomotion/Idle/M_Neutral_Stand_Idle_Loop", 0.0),
    ("Walk", "/Game/Narvos/Locomotion/Walk/M_Neutral_Walk_Loop_F", 150.0),
    ("Run", "/Game/Narvos/Locomotion/Run/M_Neutral_Run_Loop_F", 375.0),
    ("Sprint", "/Game/Narvos/Locomotion/Sprint/M_Neutral_Sprint_Loop_F", 600.0),
]


def log(msg):
    try:
        unreal.log("[NARVOS_BS] " + msg)
    except Exception:
        pass


def main():
    rapport = []

    skel = unreal.load_asset(SKELETON)
    log("squelette %s -> %s" % (SKELETON, "OK" if skel else "ABSENT"))
    if not skel:
        rapport.append("ECHEC squelette absent : " + SKELETON)
        return rapport

    manquantes = []
    for libelle, chemin, _ in SAMPLES:
        a = unreal.load_asset(chemin)
        ok = a is not None
        log("sample %s %s -> %s" % (libelle, chemin, "OK" if ok else "ABSENT"))
        if not ok:
            manquantes.append(chemin)

    if manquantes:
        rapport.append("ECHEC %d anim(s) manquante(s) : %s"
                       % (len(manquantes), ", ".join(manquantes)))
        return rapport

    if not APPLIQUER:
        rapport.append("SONDE OK : %d samples disponibles ; "
                       "creation possible (NARVOS_BS_APPLIQUER=1 pour creer)."
                       % len(SAMPLES))
        return rapport

    # ── Création de l'asset ────────────────────────────────────────────────
    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    factory = unreal.BlendSpaceFactoryNew()
    factory.set_editor_property("target_skeleton", skel)

    bs = asset_tools.create_asset(NOM, DESTINATION, unreal.BlendSpace, factory)
    if not bs:
        rapport.append("ECHEC create_asset a rendu None")
        return rapport
    log("asset cree : %s" % bs.get_path_name())

    # ── Axe X (vitesse) : plusieurs voies, la première qui marche gagne ─────
    axe_pose = False
    try:  # voie 1 : affectation directe des champs + property python
        param = unreal.BlendParameter()
        param.display_name = "Speed"
        param.min = 0.0
        param.max = 600.0
        param.grid_num = 4
        bs.blend_parameter_x = param
        axe_pose = True
        log("axe X pose via voie 1 (affectation champs + property)")
    except Exception as e:
        log("voie 1 KO : %s" % str(e))

    if not axe_pose:
        try:  # voie 2 : set_editor_property champ par champ sur le struct
            param = unreal.BlendParameter()
            param.set_editor_property("display_name", "Speed")
            param.set_editor_property("min", 0.0)
            param.set_editor_property("max", 600.0)
            param.set_editor_property("grid_num", 4)
            bs.set_editor_property("blend_parameter_x", param)
            axe_pose = True
            log("axe X pose via voie 2 (set_editor_property)")
        except Exception as e:
            log("voie 2 KO : %s" % str(e))

    if not axe_pose:
        rapport.append("ECHEC axe X : aucune voie d'ecriture n'a marche")
        return rapport

    # ── Samples ─────────────────────────────────────────────────────────────
    poses = 0
    for libelle, chemin, x in SAMPLES:
        anim = unreal.load_asset(chemin)
        ok = bs.add_sample(anim, unreal.Vector(x, 0.0, 0.0))
        log("sample %s a x=%.0f -> %s" % (libelle, x, "OK" if ok else "REFUSE"))
        if ok:
            poses += 1

    if poses == 0:
        rapport.append("ECHEC aucun sample accepte par add_sample")
        return rapport

    sauve = unreal.EditorAssetLibrary.save_loaded_asset(bs)
    log("save -> %s" % ("OK" if sauve else "ECHEC"))
    rapport.append("CREE %s/%s (%d/%d samples poses, axe=%s, save=%s)"
                   % (DESTINATION, NOM, poses, len(SAMPLES), axe_pose, sauve))
    return rapport


if __name__ == "__main__":
    lignes = main()
    chemin = os.path.join(unreal.Paths.project_dir(), "Saved", "adk_blend_spaces.txt")
    try:
        with open(chemin, "w", encoding="utf-8") as f:
            f.write("\n".join(lignes) + "\n")
        log("rapport ecrit : " + chemin)
    except Exception as e:
        log("rapport impossible : " + str(e))