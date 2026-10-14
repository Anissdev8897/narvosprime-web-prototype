# [recupere de l'historique : ecrit le 2026-09-06T11:46:55Z sous le nom _univers_4b.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
from collections import Counter
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/univers4.json"
CLASSES_A_OTER = {"CineCameraActor","SkyLight","SkyAtmosphere","VolumetricCloud",
                  "ExponentialHeightFog","DirectionalLight","PostProcessVolume",
                  "AtmosphericFog","TextRenderActor"}
LABELS_A_OTER = ("SM_MW_ColorChecker", "Galaxy_Dome")
w = unreal.EditorLevelLibrary.get_editor_world()
res = {"monde": w.get_name()}
sub = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
# reste-t-il des acteurs a oter ?
restants = []
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    cn = type(a).__name__; lab = a.get_actor_label()
    if cn in CLASSES_A_OTER or any(lab.startswith(x) for x in LABELS_A_OTER):
        restants.append(a)
n = 0
for a in restants:
    try:
        if unreal.EditorLevelLibrary.destroy_actor(a): n += 1
    except Exception: pass
res["otes_ce_tour"] = n
# niveau courant = le persistant
try:
    res["courant"] = bool(sub.set_current_level_by_name("Map_Narvos"))
except Exception as e:
    res["courant"] = "ERR " + str(e)[:140]
poses = []
def poser(classe, loc, rot, label):
    a = unreal.EditorLevelLibrary.spawn_actor_from_class(classe, loc, rot)
    if a:
        a.set_actor_label(label)
        try: a.set_editor_property("tags", [unreal.Name("Sun")])
        except Exception: pass
        poses.append(label)
    return a
deja = {a.get_actor_label() for a in unreal.EditorLevelLibrary.get_all_level_actors()}
if "Narvos_Soleil" not in deja:
    poser(unreal.DirectionalLight, unreal.Vector(0,0,20000), unreal.Rotator(0,-42,25), "Narvos_Soleil")
    poser(unreal.SkyLight, unreal.Vector(0,0,20000), unreal.Rotator(), "Narvos_CielAmbiant")
    poser(unreal.SkyAtmosphere, unreal.Vector(), unreal.Rotator(), "Narvos_Atmosphere")
    poser(unreal.ExponentialHeightFog, unreal.Vector(), unreal.Rotator(), "Narvos_Brume")
res["ciel_pose"] = poses
res["classes_restantes"] = Counter(type(a).__name__ for a in unreal.EditorLevelLibrary.get_all_level_actors()).most_common(20)
res["sauve"] = bool(sub.save_all_dirty_levels())
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
