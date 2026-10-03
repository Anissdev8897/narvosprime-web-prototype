# ══════════════════════════════════════════════════════════════════════════════
# adk-sonder-metahuman-rendu.py — pourquoi le MetaHuman n'affiche-t-il que ses tongs ?
#
# DANS l'editeur ouvert (scripts/ue-remote.py). Pose des acteurs TEMPORAIRES dans le
# monde de l'editeur, ne sauve RIEN. Trois temps, appeles separement pour laisser
# l'editeur rafraichir les poses entre deux :
#
#   poser()     porteur Manny (SKM_Manny_3 du pack) + BP_NarvosMH_M attache a son os
#               `root` en SnapToTarget — exactement le geste de MetaHumainBP.Poser ;
#               un second BP_NarvosMH_M SEUL a 3 m, pour separer « attache » et « BP ».
#   mesurer()   par composant squelettique : maillage, visibilite, parent d'attache,
#               ABP, leader pose, materiaux EFFECTIFS, position des os pelvis/head.
#   nettoyer()  detruit les acteurs poses.
#
# Vu en jeu le 2026-09-13 18h : a l'apercu de creation, seules les tongs (Feet)
# s'affichent ; corps, tete, cheveux absents. Pas de crash (visage sans LiveLink).
# ══════════════════════════════════════════════════════════════════════════════
import math

import unreal

PORTEUR = "/Game/Narvos/Defender/Demo/Characters/Manny/SKM_Manny"
IDLE = "/Game/Narvos/BlacksmithAnimations/Animations/Idle/ANIM_IP_customer_idle_Anim"
BP = "/Game/Narvos/PontMetaHuman/BP_NarvosMH_M"
ORIGINE = unreal.Vector(0.0, 0.0, 200.0)
TAG = "NarvosSondeMH"


def dire(texte):
    print("[SONDE-MH] " + texte)
    unreal.log("[SONDE-MH] " + texte)


def acteurs_sonde():
    sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    return [a for a in sub.get_all_level_actors() if a.actor_has_tag(TAG)]


def nettoyer():
    sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for a in acteurs_sonde():
        sub.destroy_actor(a)
    dire("acteurs de sonde retires")


def poser():
    nettoyer()
    sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    porteur = sub.spawn_actor_from_class(unreal.SkeletalMeshActor, ORIGINE)
    porteur.tags = [TAG, "porteur"]
    comp = porteur.skeletal_mesh_component
    comp.set_skinned_asset_and_update(unreal.load_asset(PORTEUR))
    comp.set_update_animation_in_editor(True)
    idle = unreal.load_asset(IDLE)
    if idle is not None:
        comp.play_animation(idle, True)
    classe = unreal.load_asset(BP).generated_class()
    attache = sub.spawn_actor_from_class(classe, ORIGINE)
    attache.tags = [TAG, "attache"]
    regle = unreal.AttachmentRule.SNAP_TO_TARGET
    ok = attache.attach_to_component(comp, "root", regle, regle, regle, False)
    seul = sub.spawn_actor_from_class(classe, ORIGINE + unreal.Vector(300.0, 0.0, 0.0))
    seul.tags = [TAG, "seul"]
    dire("pose : porteur=%s, BP attache (ok=%s), BP seul a +3 m" % (porteur.get_name(), ok))
    # Cadrer la vue sur la scene pour la capture.
    unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).set_level_viewport_camera_info(
        ORIGINE + unreal.Vector(150.0, -450.0, 60.0), unreal.Rotator(0.0, -5.0, 70.0))


def os_monde(comp, nom):
    try:
        loc = comp.get_socket_location(nom)
        return "(%.0f %.0f %.0f)" % (loc.x, loc.y, loc.z) if not any(math.isnan(v) for v in (loc.x, loc.y, loc.z)) else "NaN"
    except Exception as e:
        return "? %s" % e


def mesurer():
    for a in acteurs_sonde():
        role = [str(t) for t in a.tags if str(t) != TAG]
        dire("== acteur %s %s @ %s" % (a.get_name(), role, a.get_actor_location()))
        for c in a.get_components_by_class(unreal.SkeletalMeshComponent):
            maillage = c.get_skinned_asset()
            parent = c.get_attach_parent()
            try:
                instance = c.get_anim_instance()
            except Exception:
                instance = None
            try:
                leader = c.get_editor_property("leader_pose_component")
            except Exception:
                leader = "?"
            mats = [m.get_path_name().rsplit("/", 1)[-1] if m else "None" for m in c.get_materials()]
            dire("  %-10s maillage=%s visible=%s cache_en_jeu=%s parent=%s abp=%s leader=%s" % (
                c.get_name(), maillage.get_name() if maillage else "None", c.is_visible(),
                c.get_editor_property("hidden_in_game"), parent.get_name() if parent else None,
                instance.get_class().get_name() if instance else None,
                leader.get_name() if hasattr(leader, "get_name") else leader))
            dire("             materiaux=%s" % mats[:8])
            dire("             pelvis=%s head=%s  os=%d" % (os_monde(c, "pelvis"), os_monde(c, "head"), c.get_num_bones()))


def capturer(nom="sonde_metahuman"):
    unreal.SystemLibrary.execute_console_command(None, "HighResShot 1600x900 filename=%s" % nom)
    dire("capture demandee : Saved/Screenshots/WindowsEditor/%s.png" % nom)