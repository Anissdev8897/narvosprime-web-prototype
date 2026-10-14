"""
adk-session-capitale.py — repose la capitale (CITY_PACK) dans `Map_Narvos`, en UNE session
d'editeur complet : la recolte des 18 cartes du pack, puis la copie de leurs acteurs.

    bash scripts/recuperation/adk-session.sh recuperation/adk-session-capitale.py

-- D'OU VIENT LA RECETTE --------------------------------------------------------------------
Du 08/09, lancee alors a la main dans l'editeur ouvert (`exec(open(...))`) :
  1. scripts/adk-recolter-maps-ville.py     -> .hermes/maps_ville.json (acteurs, bornes) ;
  2. scripts/adk-copier-ville-vers-narvos.py, NARVOS_VILLE_APPLIQUER=1 -> ~13 490 acteurs
     `NARVOS_VILLE_<carte>_<n>` dans le niveau PERSISTANT, ville recentree sur
     `Mondes.CENTRES.capitale`, interieurs alignes au nord.
Le plan (`maps_ville.json`) a ete perdu avec le disque : il est refait par la recolte.

-- PRECONDITION -----------------------------------------------------------------------------
`Map_Narvos` existe (adk-session-monde.py). Sans elle, la recolte finit sur un `load_level`
qui echoue et la copie poserait la ville dans la derniere carte du pack ouverte.

-- GARDE ------------------------------------------------------------------------------------
Si la carte porte deja des acteurs `NARVOS_VILLE_*`, on ne repose RIEN : une seconde passe
dedoublerait la ville, acteur sur acteur, sans que rien le montre.

⚠ La copie finit par `save_dirty_packages(True, True)` : un sous-niveau sali par son seul
chargement serait reecrit. Le lanceur compare donc les sous-niveaux a leur sauvegarde.
"""
import os
import runpy
import traceback

import unreal

SCRIPTS = "E:/narvosprime-web-prototype/scripts"
PERSISTANT = "/Game/Narvos/Maps/Map_Narvos"
PREFIXE = "NARVOS_VILLE_"


def journal(message):
    unreal.log("[NARVOS] " + message)
    print("[NARVOS] " + message)


def etape(nom, fonction):
    journal("=== %s" % nom)
    try:
        fonction()
        journal("=== %s : termine" % nom)
        return True
    except SystemExit as e:
        journal("=== %s : ARRET (%s)" % (nom, e))
    except Exception:
        journal("=== %s : EXCEPTION" % nom)
        for ligne in traceback.format_exc().splitlines():
            journal("    " + ligne)
    return False


def acteurs_de_ville():
    return [a for a in unreal.EditorLevelLibrary.get_all_level_actors()
            if a.get_actor_label().startswith(PREFIXE)]


def recolter():
    runpy.run_path(SCRIPTS + "/adk-recolter-maps-ville.py", run_name="__main__")


def copier():
    os.environ["NARVOS_VILLE_APPLIQUER"] = "1"
    try:
        runpy.run_path(SCRIPTS + "/adk-copier-ville-vers-narvos.py", run_name="__main__")
    finally:
        os.environ.pop("NARVOS_VILLE_APPLIQUER", None)


try:
    unreal.AssetRegistryHelpers.get_asset_registry().wait_for_completion()
    if not unreal.EditorAssetLibrary.does_asset_exist(PERSISTANT):
        journal("ARRET capitale : %s n'existe pas (lancer adk-session-monde.py d'abord)" % PERSISTANT)
    else:
        unreal.EditorLevelLibrary.load_level(PERSISTANT)
        deja = len(acteurs_de_ville())
        if deja:
            journal("ARRET capitale : %d acteur(s) %s* deja dans la carte — rien repose" % (deja, PREFIXE))
        elif etape("recolte des cartes CITY_PACK", recolter):
            etape("pose de la capitale", copier)
            journal("=== releve : %d acteur(s) %s* dans la carte ouverte (%s)"
                    % (len(acteurs_de_ville()), PREFIXE,
                       unreal.EditorLevelLibrary.get_editor_world().get_name()))
finally:
    journal("=== fermeture de l'editeur")
    unreal.SystemLibrary.quit_editor()
