# [recupere de l'historique : ecrit le 2026-09-06T11:34:54Z sous le nom _audit_foliage.py, lance dans l'editeur par ue-remote.py]
# Audit du semis : chaque type de foliage est-il CUISIBLE (sous /Game/Narvos)
# et texture ? Un mesh hors de Narvos/ n'est jamais cuit : present a l'ecran de
# l'editeur, absent du jeu.
import unreal, json, io, os
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/audit_foliage.json"
res = {}
if os.path.exists(OUT):
    try: res = json.loads(io.open(OUT, encoding="utf-8").read())
    except Exception: res = {}
nom = unreal.EditorLevelLibrary.get_editor_world().get_name()
types = []
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    if type(a).__name__ != "InstancedFoliageActor": continue
    for comp in a.get_components_by_class(unreal.FoliageInstancedStaticMeshComponent):
        sm = comp.static_mesh
        if not sm: continue
        chemin = sm.get_path_name().split(".")[0]
        mats = []
        for i in range(comp.get_num_materials()):
            m = comp.get_material(i)
            mats.append([m.get_name() if m else None,
                         (m.get_path_name().split(".")[0] if m else None)])
        types.append({"mesh": sm.get_name(), "chemin": chemin,
                      "cuisible": chemin.startswith("/Game/Narvos/"),
                      "n": comp.get_instance_count(), "mats": mats})
res[nom] = types
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
