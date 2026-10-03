"""
adk-session-metahuman.py — UNE session d'editeur COMPLET (2026-09-13) :

  0. controle du redirect Interchange : une instance de la Forge doit trouver son
     parent sous /Game/Narvos/Interchange/ (journal seulement) ;
  1. drapeaux d'usage « skeletal mesh » des materiaux de PNJ, monstres, zombies
     (adk-usage-skeletal.py, NARVOS_APPLIQUER=1) ;
  2. voie (a) MetaHuman : rig + retargeter + ABP sur le vrai corps, duplicata des
     Blueprints STANDARDS BP_MCSGavin / BP_Hana (adk-pont-metahuman.py, etape_voie_a) ;
  3. fermeture de l'editeur, QUOI QU'IL ARRIVE.

    UnrealEditor.exe <ADK>.uproject -ExecutePythonScript="<...>/scripts/adk-session-metahuman.py" -unattended -nosplash

-- L'ORDRE -----------------------------------------------------------------------
Les PNJ d'abord : l'etape la plus simple, et « en esperant que ca regle les textures
des PNJ » est la derniere demande de Hanibes. Si le MetaHuman tue l'editeur, les
materiaux sont deja sauves un par un.

-- POURQUOI L'EDITEUR COMPLET ------------------------------------------------------
Un UMaterial sauve en commandlet perd son graphe (reference_automaterial_gris), et
les graphes d'Anim Blueprint ne sont editables qu'avec les donnees editeur.

-- PRECONDITIONS (verifiees par le lanceur, .hermes/session-metahuman.sh) ------------
  · Metahuman_Ref lie en dur sous Content/Narvos/MetaCustom/ AVANT le demarrage ;
  · aucun autre Unreal, aucun serveur ni client nanos.
"""
import os
import runpy
import traceback

import unreal

SCRIPTS = "E:/narvosprime-web-prototype/scripts"


def journal(message):
    unreal.log("[NARVOS] " + message)
    print("[NARVOS] " + message)


def etape(nom, fonction):
    journal("=== %s" % nom)
    try:
        fonction()
        journal("=== %s : termine" % nom)
    except SystemExit as e:
        journal("=== %s : ARRET (%s)" % (nom, e))
    except Exception:
        journal("=== %s : EXCEPTION" % nom)
        for ligne in traceback.format_exc().splitlines():
            journal("    " + ligne)


FORGE_TEMOIN = ("/Game/Narvos/halo_map/halo_map/Materials/"
                "forge_halo_rocks_-forge_halo_rock_med_special_b01___forge_halo_rocks_island_")


def redirect_interchange():
    """Avant de cuire 88 000 paquets : une instance de la Forge trouve-t-elle son
    parent dans NOTRE copie ? Le premier redirect du 13/09 menait a un chemin double
    (/Game/Narvos/Game/Narvos/...) et le cook ne l'a dit qu'en « Display »."""
    mi = unreal.load_asset(FORGE_TEMOIN)
    if mi is None:
        journal("    instance Forge temoin introuvable : " + FORGE_TEMOIN)
        return
    parent = mi.get_editor_property("parent")
    base = mi.get_base_material()
    chemin = parent.get_path_name() if parent else None
    journal("    parent de l'instance Forge : %s" % chemin)
    journal("    materiau de base           : %s" % (base.get_path_name() if base else None))
    if not chemin or not chemin.startswith("/Game/Narvos/Interchange/"):
        journal("    ATTENTION : le redirect /InterchangeAssets/ ne mene PAS a la copie Narvos/Interchange")


def usage_skeletal():
    # Reprise sans refaire les materiaux (NARVOS_SANS_USAGE=1) : la passe du 13/09 08:20
    # a corrige et PROUVE 433 bases ; la refaire ecraserait son rapport — la liste que
    # la preuve CUITE relit — par une passe vide.
    if os.environ.get("NARVOS_SANS_USAGE") == "1":
        journal("    passe sautee (NARVOS_SANS_USAGE=1) : rapport precedent conserve")
        return
    os.environ["NARVOS_APPLIQUER"] = "1"
    try:
        runpy.run_path(SCRIPTS + "/adk-usage-skeletal.py", run_name="__main__")
    finally:
        os.environ.pop("NARVOS_APPLIQUER", None)


def voie_a():
    # run_name different de __main__ : le module ne definit que des fonctions.
    pont = runpy.run_path(SCRIPTS + "/adk-pont-metahuman.py", run_name="narvos_pont_metahuman")
    pont["etape_voie_a"]()


try:
    etape("redirect Interchange (Forge)", redirect_interchange)
    etape("drapeaux skeletal mesh des materiaux", usage_skeletal)
    etape("MetaHumans standards (voie a)", voie_a)
finally:
    journal("=== fermeture de l'editeur")
    unreal.SystemLibrary.quit_editor()