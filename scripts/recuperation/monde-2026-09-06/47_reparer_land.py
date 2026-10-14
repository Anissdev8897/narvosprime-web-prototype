# [recupere de l'historique : ecrit le 2026-09-06T13:19:25Z sous le nom _reparer_land.py, lance dans l'editeur par ue-remote.py]
# Remet les Landscape d'Azur (Map_Alien) et de la Tour (Map_Tower) ou ils
# etaient. Map_Forge est LAISSEE TELLE QUELLE : elle a ete deplacee volontairement
# et ses 12 989 meshes de decor sont alignes dessus.
#
# ── ON VISE LE CENTRE DES BORNES, PAS LA LOCATION DE L'ACTEUR ────────────────
# La location d'un Landscape est le coin de sa heightmap, pas son milieu. Viser
# les bornes rend le calcul independant de cette convention : on relit ou est le
# terrain, et on le repousse la ou il doit etre.
#
# Valeurs de reference, mesurees le 2026-09-06 dans les maps AVANT assemblage :
#     Map_Alien  centre des bornes (0, 0, 92.3)   demi (100800, 100800, 5127.6)
#     Map_Tower  centre des bornes (0, 0, 99.9)   demi (100800, 100800, 4351.9)
# plus le decalage du sous-niveau.
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/reparer_land.json"

CIBLES = {
    "Map_Alien": (-8000000.0, 4000000.0, 92.3),
    "Map_Tower": (-8000000.0, 2000000.0, 99.9),
}
TOLERANCE = 1.0     # en dessous, le terrain est deja en place

w = unreal.EditorLevelLibrary.get_editor_world()
res = {"monde": w.get_name(), "actions": []}
if w.get_name() != "Map_Narvos":
    res["arret"] = "Map_Narvos n'est pas ouvert"
else:
    for a in unreal.EditorLevelLibrary.get_all_level_actors():
        if type(a).__name__ != "Landscape": continue
        niveau = "?"
        try: niveau = a.get_outer().get_outer().get_name()
        except Exception: pass
        if niveau not in CIBLES: continue

        o, e = a.get_actor_bounds(False)
        l = a.get_actor_location()
        cx, cy, cz = CIBLES[niveau]
        d = {"niveau": niveau, "label": a.get_actor_label(),
             "avant_acteur": [round(l.x, 1), round(l.y, 1), round(l.z, 1)],
             "avant_bornes": [round(o.x, 1), round(o.y, 1), round(o.z, 1)],
             "cible_bornes": [cx, cy, cz]}

        dx, dy, dz = cx - o.x, cy - o.y, cz - o.z
        d["ecart"] = [round(dx, 1), round(dy, 1), round(dz, 1)]
        if (abs(dx) < TOLERANCE and abs(dy) < TOLERANCE and abs(dz) < TOLERANCE):
            d["etat"] = "deja en place"
            res["actions"].append(d); continue

        a.set_actor_location(unreal.Vector(l.x + dx, l.y + dy, l.z + dz), False, False)
        o2, e2 = a.get_actor_bounds(False)
        l2 = a.get_actor_location()
        d["apres_acteur"] = [round(l2.x, 1), round(l2.y, 1), round(l2.z, 1)]
        d["apres_bornes"] = [round(o2.x, 1), round(o2.y, 1), round(o2.z, 1)]
        d["reste"] = [round(cx - o2.x, 1), round(cy - o2.y, 1), round(cz - o2.z, 1)]
        d["etat"] = "remis"
        res["actions"].append(d)
    res["sauve"] = bool(unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_all_dirty_levels())
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
