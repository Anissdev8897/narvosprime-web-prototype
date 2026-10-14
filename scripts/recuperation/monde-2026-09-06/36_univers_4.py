# [recupere de l'historique : ecrit le 2026-09-06T11:46:32Z sous le nom _univers_4.py, lance dans l'editeur par ue-remote.py]
# Etape 4 : un seul ciel pour quatre mondes.
#
# Chaque niveau d'exemple porte SON SkyAtmosphere, SON VolumetricCloud, SON
# soleil et SON brouillard. Reunis dans un meme monde, ca fait quatre
# atmospheres et quatre soleils qui s'additionnent — un ciel n'est pas local a
# un sous-niveau, il est global.
#
# nanos regle ca autrement : `Sky` (Ultra Dynamic Sky) pilote le ciel PAR JOUEUR,
# et `Shared/Logic/Ciel.lua` lui dit quel ciel va avec quel monde (plein jour sur
# la Forge, `SkyMode.Space` en orbite, brume sur la Tour). Les ciels des niveaux
# n'ont donc plus d'emploi.
#
# On en garde UN, dans le niveau persistant, marque du tag `Sun` — la regle 2 de
# `importing-maps.mdx` : « Add a "Sun" actor-tag to all Lighting/Sky/Sun related
# actors, this will allow your light to be overridden by scripters ». Sans lui
# l'editeur serait noir et la carte impossible a peupler a l'oeil.
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/univers4.json"

CLASSES_A_OTER = {
    "CineCameraActor", "SkyLight", "SkyAtmosphere", "VolumetricCloud",
    "ExponentialHeightFog", "DirectionalLight", "PostProcessVolume",
    "AtmosphericFog", "TextRenderActor",
}
LABELS_A_OTER = ("SM_MW_ColorChecker", "Galaxy_Dome")

w = unreal.EditorLevelLibrary.get_editor_world()
res = {"monde": w.get_name(), "otes": {}, "gardes": 0}
if w.get_name() != "Map_Narvos":
    res["arret"] = "Map_Narvos n'est pas ouvert"
else:
    a_oter = []
    for a in unreal.EditorLevelLibrary.get_all_level_actors():
        cn = type(a).__name__
        lab = a.get_actor_label()
        if cn in CLASSES_A_OTER or any(lab.startswith(x) for x in LABELS_A_OTER):
            a_oter.append((a, cn if cn in CLASSES_A_OTER else lab.split("_")[0]))
        else:
            res["gardes"] += 1
    for a, cle in a_oter:
        try:
            if unreal.EditorLevelLibrary.destroy_actor(a):
                res["otes"][cle] = res["otes"].get(cle, 0) + 1
        except Exception:
            pass
    # ── Le ciel unique, dans le niveau persistant ────────────────────────────
    unreal.EditorLevelUtils.make_level_current(
        [lv for lv in unreal.EditorLevelUtils.get_levels(w)
         if lv.get_outer().get_name() == "Map_Narvos"][0])
    poses = []
    def poser(classe, loc, rot, label):
        a = unreal.EditorLevelLibrary.spawn_actor_from_class(classe, loc, rot)
        if a:
            a.set_actor_label(label)
            a.tags = ["Sun"]     # regle nanos : ciel surchargeable par le script
            poses.append(label)
        return a
    soleil = poser(unreal.DirectionalLight, unreal.Vector(0, 0, 20000),
                   unreal.Rotator(0, -42, 25), "Narvos_Soleil")
    poser(unreal.SkyLight, unreal.Vector(0, 0, 20000), unreal.Rotator(), "Narvos_CielAmbiant")
    poser(unreal.SkyAtmosphere, unreal.Vector(), unreal.Rotator(), "Narvos_Atmosphere")
    poser(unreal.ExponentialHeightFog, unreal.Vector(), unreal.Rotator(), "Narvos_Brume")
    res["ciel_pose"] = poses
    res["sauve"] = bool(unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_all_dirty_levels())
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
