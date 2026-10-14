# [recupere de l'historique : ecrit le 2026-09-06T13:20:47Z sous le nom _reparer_foliage.py, lance dans l'editeur par ue-remote.py]
# Le semis n'a pas suivi le Landscape. On lui applique le MEME ecart, mesure
# acteur par acteur : le terrain a ete remis, les touffes doivent l'accompagner.
#
# ⚠ ON VERIFIE APRES. Un InstancedFoliageActor peut porter ses instances en
# coordonnees de composant ou d'acteur ; si `set_actor_location` ne les emmene
# pas, les bornes ne bougeront pas et il faudra passer par les instances.
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/reparer_foliage.json"
ECART = {
    "Map_Tower": (513420.0, -385420.0, -151590.0),
    "Map_Alien": (513420.0, -385420.0, -151920.0),
}
w = unreal.EditorLevelLibrary.get_editor_world()
res = {"monde": w.get_name(), "actions": []}
if w.get_name() != "Map_Narvos":
    res["arret"] = "Map_Narvos n'est pas ouvert"
else:
    for a in unreal.EditorLevelLibrary.get_all_level_actors():
        if type(a).__name__ != "InstancedFoliageActor": continue
        niveau = "?"
        try: niveau = a.get_outer().get_outer().get_name()
        except Exception: pass
        if niveau not in ECART: continue
        dx, dy, dz = ECART[niveau]
        o1, _ = a.get_actor_bounds(False)
        l1 = a.get_actor_location()
        a.set_actor_location(unreal.Vector(l1.x + dx, l1.y + dy, l1.z + dz), False, False)
        o2, _ = a.get_actor_bounds(False)
        bouge = (abs(o2.x - o1.x) + abs(o2.y - o1.y) + abs(o2.z - o1.z)) > 1.0
        d = {"niveau": niveau, "ecart": [dx, dy, dz],
             "bornes_avant": [round(o1.x), round(o1.y), round(o1.z)],
             "bornes_apres": [round(o2.x), round(o2.y), round(o2.z)],
             "acteur_a_suffi": bouge}
        # Repli : deplacer les INSTANCES une a une si l'acteur ne les emmene pas.
        if not bouge:
            a.set_actor_location(l1, False, False)
            n = 0
            for c in a.get_components_by_class(unreal.FoliageInstancedStaticMeshComponent):
                for i in range(c.get_instance_count()):
                    ok, t = c.get_instance_transform(i, True)
                    if not ok: continue
                    p = t.translation
                    t.translation = unreal.Vector(p.x + dx, p.y + dy, p.z + dz)
                    c.update_instance_transform(i, t, True, False, True)
                    n += 1
                c.build_tree_if_outdated(True, False)
            o3, _ = a.get_actor_bounds(False)
            d["instances_deplacees"] = n
            d["bornes_apres"] = [round(o3.x), round(o3.y), round(o3.z)]
        res["actions"].append(d)
    res["sauve"] = bool(unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_all_dirty_levels())
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
