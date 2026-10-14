# [recupere de l'historique : ecrit le 2026-09-06T11:37:27Z sous le nom _oter_roches.py, lance dans l'editeur par ue-remote.py]
# Retire les deux semis de roches fautifs :
#   SM_Rock_01  = mesh de debris de PARTICULES (SpaceScenes/Effects), materiau
#                 d'emetteur sans texture -> gris plat en jeu comme en editeur ;
#   Rock_SM     = vit hors de /Game/Narvos -> jamais cuit, absent du jeu.
# Et remet le materiau d'origine sur les montagnes de fond : MTL_MWAM_CoverRocks
# a ses deux textures a None, il n'ameliore rien.
import unreal, json, io, os
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/oter_roches.json"
FAUTIFS = ("SM_Rock_01", "Rock_SM")
res = {}
if os.path.exists(OUT):
    try: res = json.loads(io.open(OUT, encoding="utf-8").read())
    except Exception: res = {}
nom = unreal.EditorLevelLibrary.get_editor_world().get_name()
enleves = []
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    if type(a).__name__ != "InstancedFoliageActor": continue
    for comp in a.get_components_by_class(unreal.FoliageInstancedStaticMeshComponent):
        sm = comp.static_mesh
        if not sm or sm.get_name() not in FAUTIFS: continue
        n = comp.get_instance_count()
        comp.clear_instances()
        enleves.append([sm.get_name(), n])
res[nom] = enleves
if enleves: unreal.EditorLevelLibrary.save_current_level()
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
