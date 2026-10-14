# [recupere de l'historique : ecrit le 2026-09-06T12:07:34Z sous le nom _godray.py, lance dans l'editeur par ue-remote.py]
# SM_GodRay_Plane est un plan de FX translucide : Nanite ne s'y applique pas.
# Il est passe parce qu'il vit sous /Scenery/, pas sous /Effects/.
import unreal, json, io
p = "/Game/Narvos/SpaceScenes/Scenery/GodRay/Mesh/SM_GodRay_Plane"
sm = unreal.EditorAssetLibrary.load_asset(p)
ns = sm.get_editor_property("nanite_settings"); ns.enabled = False
sm.set_editor_property("nanite_settings", ns)
unreal.EditorAssetLibrary.save_asset(p, only_if_is_dirty=False)
io.open(r"C:/Users/aniss/AppData/Local/Temp/claude/godray.json","w").write(json.dumps({"nanite": False}))
