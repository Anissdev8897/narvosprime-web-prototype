"""
adk-sonder-ako.py — LIT, sans rien ecrire, ce que la minimap Ako attend :
les valeurs du DataAsset de reglages, la forme de ses structures, les defauts de
sa classe, les composants de BP_MAP_Bounds et les variables des deux widgets.

    UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="<...>/scripts/adk-sonder-ako.py" -unattended -nosplash

Sortie : WebPortal/Server/adk/_manifests/ako-sonde.json (et le journal [NARVOS]).

-- POURQUOI UNE SONDE AVANT TOUT BRANCHEMENT ------------------------------------
Le plan de branchement (proxies d'acteurs, bornes par monde) repose sur des NOMS
lus dans les tables de noms des paquets : `player ref`, `item_setting`,
`all TR_actor class`. Un nom cite n'est pas une propriete renseignee
(feedback du 2026-09-11) : seul le registre Unreal dit QUELLE classe de la demo
sert de joueur, laquelle porte quel pictogramme, et ce que vaut la methode de suivi.

-- ⚠ LECTURE SEULE ---------------------------------------------------------------
`Content/Ako_Mini_Map_sys` est une JONCTION vers le pack achete. Aucun
save_asset, aucun set_editor_property ici.
"""
import json
import traceback

import unreal

RACINE = "/Game/Ako_Mini_Map_sys/ako_mini_map_Content"
SORTIE = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/ako-sonde.json"
rapport = {"erreurs": []}


def journal(message):
    unreal.log("[NARVOS] " + message)
    print("[NARVOS] " + message)


def texte(valeur):
    """Une valeur Unreal, lisible dans un JSON."""
    try:
        if isinstance(valeur, (bool, int, float, str)) or valeur is None:
            return valeur
        if isinstance(valeur, unreal.Array) or isinstance(valeur, (list, tuple)):
            return [texte(v) for v in valeur]
        if isinstance(valeur, unreal.Object):
            return "%s <%s>" % (valeur.get_path_name(), valeur.get_class().get_name())
        if isinstance(valeur, unreal.StructBase):
            return proprietes(valeur)
        return repr(valeur)
    except Exception as e:
        return "illisible : %s" % e


def proprietes(objet):
    """Toutes les proprietes lisibles par get_editor_property, par nom Python."""
    sortie = {}
    for nom in dir(objet):
        if nom.startswith("_"):
            continue
        try:
            valeur = objet.get_editor_property(nom)
        except Exception:
            continue
        sortie[nom] = texte(valeur)
    return sortie


# Les variables d'une classe BLUEPRINT n'apparaissent pas dans dir() : Python ne
# genere son type que pour l'ancetre natif (PrimaryDataAsset). On les demande par
# leur nom — lu dans la table de noms du paquet — sous ses graphies possibles.
NOMS_REGLAGES = [
    "player ref", "item_setting", "actor path", "add_paths", "location_Track_METHOD",
    "EM draw METHOD", "zoom value", "zoom factor", "player pointer form", "player POINTER Size",
    "hidden MAP Bounds in game?", "rotation_type", "MAPBouns_type", "draw custom Map Border",
    "draw simple Map Border?", "draw map bounds", "opacity map", "minimap background opacity",
    "smooth factor", "tangent factor", "end lenght", "Turn of Warning", "center scale",
    "MAX SIDE VALUE", "UpdatePath in runtime", "LINE NOT SPLINE?",
]


def graphies(nom):
    snake = "".join(c if c.isalnum() else "_" for c in nom).strip("_").lower()
    while "__" in snake:
        snake = snake.replace("__", "_")
    return [nom, snake, nom.replace(" ", "_")]


def par_noms(objet, noms):
    sortie = {}
    for nom in noms:
        for g in graphies(nom):
            try:
                sortie[nom] = {"graphie": g, "valeur": texte(objet.get_editor_property(g))}
                break
            except Exception:
                continue
        else:
            sortie[nom] = "ABSENT sous toutes les graphies"
    return sortie


def t3d(objet, fichier):
    """Export texte T3D : toutes les proprietes non par defaut, structures comprises."""
    try:
        tache = unreal.AssetExportTask()
        tache.object = objet
        tache.filename = fichier
        tache.automated = True
        tache.prompt = False
        tache.replace_identical = True
        tache.exporter = unreal.ObjectExporterT3D()
        ok = unreal.Exporter.run_asset_export_task(tache)
        return "ok" if ok else "refuse"
    except Exception as e:
        return "exception : %s" % e


def charger(chemin):
    objet = unreal.load_asset(chemin)
    if objet is None:
        rapport["erreurs"].append("introuvable : " + chemin)
        journal("INTROUVABLE " + chemin)
    return objet


def composants(chemin_bp):
    """Les composants d'un Blueprint d'acteur, par le sous-systeme des sous-objets."""
    bp = charger(chemin_bp)
    if bp is None:
        return None
    sortie = []
    sous = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
    for poignee in sous.k2_gather_subobject_data_for_blueprint(bp):
        donnee = unreal.SubobjectDataBlueprintFunctionLibrary.get_data(poignee)
        objet = unreal.SubobjectDataBlueprintFunctionLibrary.get_object(donnee)
        if objet is None:
            continue
        fiche = {"nom": objet.get_name(), "classe": objet.get_class().get_name()}
        for nom in ("box_extent", "relative_scale3d", "relative_location", "static_mesh",
                    "hidden_in_game", "visible"):
            try:
                fiche[nom] = texte(objet.get_editor_property(nom))
            except Exception:
                pass
        sortie.append(fiche)
    return sortie


def defauts_classe(chemin_classe):
    classe = unreal.load_object(None, chemin_classe)
    if classe is None:
        rapport["erreurs"].append("classe introuvable : " + chemin_classe)
        return None
    return proprietes(unreal.get_default_object(classe))


try:
    da = charger(RACINE + "/DA_MinimapSettings_Track")
    if da is not None:
        rapport["da_classe"] = da.get_class().get_path_name()
        rapport["da"] = par_noms(da, NOMS_REGLAGES)
        rapport["da_t3d"] = t3d(da, SORTIE.replace(".json", "-da.t3d"))
        journal("DA : export T3D %s" % rapport["da_t3d"])

    classe = unreal.load_object(None, RACINE + "/map_data_blueprint/BP_MinimapSettings.BP_MinimapSettings_C")
    if classe is not None:
        rapport["classe_reglages_defauts"] = par_noms(unreal.get_default_object(classe), NOMS_REGLAGES)
    for nom, chemin in (("showup", "/ui/ui_minimap_showup"), ("minimap", "/ui/ui_minimap"),
                        ("bounds", "/map_data_blueprint/ACTORS/BP_MAP_Bounds")):
        bp = charger(RACINE + chemin)
        if bp is not None:
            cdo = unreal.get_default_object(unreal.load_object(None, RACINE + chemin + "." + chemin.split("/")[-1] + "_C"))
            rapport[nom + "_t3d"] = t3d(cdo, SORTIE.replace(".json", "-" + nom + ".t3d"))

    for enum in ("EM_location_Track_METHOD", "EM_draw_METHOD", "EM_MAPBouns_type", "EM_rotation_type"):
        e = charger(RACINE + "/map_data_blueprint/" + enum)
        if e is None:
            continue
        noms = []
        try:
            for i in range(unreal.EnumLibrary.get_num_enum_values(e) if hasattr(unreal, "EnumLibrary") else 0):
                noms.append(str(unreal.EnumLibrary.get_display_name_by_index(e, i)))
        except Exception as ex:
            noms.append("illisible : %s" % ex)
        rapport["enum_" + enum] = noms or proprietes(e)

    # La taille du mesh de bornes : l'echelle de BP_MAP_Bounds pour couvrir un monde en depend.
    boite = charger("/Game/Ako_Mini_Map_sys/Example_Content_Demo/static_mesh_proj/Box_board")
    if boite is not None:
        bornes = boite.get_bounds()
        rapport["box_board_bornes"] = {"origine": texte(bornes.origin), "demi_etendue": texte(bornes.box_extent)}

    # EDITER les structures, sur une COPIE Python — jamais sur l'asset (lecture seule).
    # get_editor_property rend une copie du tableau : la modifier ne touche pas le paquet.
    essai = {}
    if da is not None:
        copie = da.get_editor_property("item_setting")
        element = copie[0]
        for g in ("all TR_actor class", "allTR_actorclass_6_DE8E5F4749A19023668DBAA02BEF45E3", "all_tr_actor_class"):
            try:
                essai["lecture:" + g] = texte(element.get_editor_property(g))
                element.set_editor_property(g, unreal.Actor.static_class())
                essai["ecriture:" + g] = texte(element.get_editor_property(g))
                break
            except Exception as e:
                essai["refus:" + g] = str(e)
        try:
            del copie[1]
            essai["suppression"] = len(copie)
        except Exception as e:
            essai["suppression"] = "refus : %s" % e
        essai["asset_intact"] = texte(da.get_editor_property("item_setting")[0])
        try:
            essai["asset_classe_0"] = texte(da.get_editor_property("item_setting")[0].get_editor_property(
                "allTR_actorclass_6_DE8E5F4749A19023668DBAA02BEF45E3"))
        except Exception as e:
            essai["asset_classe_0"] = "refus : %s" % e
    rapport["essai_structures"] = essai

    rapport["bounds_composants"] = composants(RACINE + "/map_data_blueprint/ACTORS/BP_MAP_Bounds")
    rapport["bounds_defauts"] = defauts_classe(
        RACINE + "/map_data_blueprint/ACTORS/BP_MAP_Bounds.BP_MAP_Bounds_C")
    rapport["showup_defauts"] = defauts_classe(RACINE + "/ui/ui_minimap_showup.ui_minimap_showup_C")
    rapport["minimap_defauts"] = defauts_classe(RACINE + "/ui/ui_minimap.ui_minimap_C")
except Exception:
    rapport["erreurs"].append(traceback.format_exc())
    journal("EXCEPTION : " + traceback.format_exc())
finally:
    with open(SORTIE, "w", encoding="utf-8") as f:
        json.dump(rapport, f, ensure_ascii=False, indent=1)
    journal("sonde ecrite : " + SORTIE)