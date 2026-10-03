"""
adk-session-lot3.py — UNE session d'editeur COMPLET pour le lot 3 du 2026-09-13 :

  1. les trois proxies Blueprint de la minimap Ako (adk-creer-bp-minimap.py) ;
  2. l'import des trois objets GLB — talkie-walkie, clavier a code, smartphone —
     (adk-import-narvos.py, manifeste import-objets-a-trier.json) ;
  3. export des objets et recettes d'InventorySystemPro (adk-exporter-isp.py) ;
  4. retarget des animations d'AI Behavior System, Manny UE5 -> Mannequin UE4
     (adk-retarget-anims.py, parametre ici) ;
  5. fermeture de l'editeur, QUOI QU'IL ARRIVE.

L'ORDRE est celui de la demande en cours (« branche les trois fonctions et ajoute
la minimap ») : si une etape tue l'editeur, ce qui a deja tourne est sauve.

    UnrealEditor.exe <ADK>.uproject -ExecutePythonScript="<...>/scripts/adk-session-lot3.py" -unattended -nosplash

-- POURQUOI L'EDITEUR COMPLET ET PAS UN COMMANDLET ----------------------------------
Le retarget range ses sorties par `rename_asset`, qui passe par AssetTools et veut
une application Slate : en commandlet il tue le processus (voir
reference_unreal_deplacer_assets). L'export, lui, tournerait en commandlet — on le
met dans la meme session pour ne payer qu'un demarrage.

-- POURQUOI LES CHEMINS SONT POSES ICI, EN PYTHON ----------------------------------
Git Bash reecrit toute valeur commencant par `/` (`/Game/...` devient
`C:/Program Files/Git/Game/...`), variables d'environnement comprises. Poser les
chemins dans le script evite le shell.

-- ⚠ PRECONDITIONS (verifiees par le lanceur, .hermes/lot3.sh) ----------------------
  · jonctions `Content/InventorySystemPro`, `Content/AIBehaviorSystem` et
    `Content/Ako_Mini_Map_sys` posees ;
  · le PackageRedirect de /Game/InventorySystemPro/ COMMENTE pendant la session
    (sinon les Data Assets sont cherches sous Narvos/, ou ils n'existent pas) ;
  · AUCUN PackageRedirect pour /Game/AIBehaviorSystem/ : les animations SOURCES
    doivent se charger a leur chemin d'origine.
"""
import os
import runpy
import traceback

import unreal

SCRIPTS = "E:/narvosprime-web-prototype/scripts"


def journal(message):
    unreal.log("[NARVOS] " + message)
    print("[NARVOS] " + message)


def etape(nom, chemin):
    journal("=== %s" % nom)
    try:
        runpy.run_path(chemin, run_name="__main__")
        journal("=== %s : termine" % nom)
    except SystemExit as e:
        journal("=== %s : ARRET (%s)" % (nom, e))
    except Exception:
        journal("=== %s : EXCEPTION" % nom)
        for ligne in traceback.format_exc().splitlines():
            journal("    " + ligne)


IMPORT_GLB = {
    "NARVOS_MANIFEST": "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/import-objets-a-trier.json",
    # Accessoires rigides : un seul StaticMesh par GLB (fusion), sans squelette.
    "NARVOS_STATIC": "1",
    "NARVOS_COMBINE": "1",
    "NARVOS_SANS_SQUELETTE": "1",
}

try:
    etape("proxies de la minimap Ako", SCRIPTS + "/adk-creer-bp-minimap.py")

    os.environ.update(IMPORT_GLB)
    etape("import des trois objets GLB", SCRIPTS + "/adk-import-narvos.py")
    # Les variables d'import ne doivent pas deborder sur les etapes suivantes.
    for cle in IMPORT_GLB:
        os.environ.pop(cle, None)

    etape("export InventorySystemPro", SCRIPTS + "/adk-exporter-isp.py")

    os.environ["NARVOS_APPLY"] = "1"
    os.environ["NARVOS_RT_SOURCE"] = "/Game/AIBehaviorSystem/Demo/Animation"
    os.environ["NARVOS_RT_MESH_SOURCE"] = "/Game/AIBehaviorSystem/Demo/Characters/Mannequins/Meshes/SKM_Manny"
    os.environ["NARVOS_RT_MESH_CIBLE"] = "/Game/NanosWorld/Characters/Mannequin/SK_Mannequin"
    os.environ["NARVOS_RT_RETARGETER"] = "/Game/AIBehaviorSystem/Demo/Characters/Mannequin_UE4/Rigs/RTG_UE5Manny_UE4Manny"
    os.environ["NARVOS_RT_DESTINATION"] = "/Game/Narvos/AIBehaviorSystem/Retarget"
    os.environ["NARVOS_RT_QUITTER"] = ""   # la fermeture est faite ICI, en finally
    etape("retarget AI Behavior System", SCRIPTS + "/adk-retarget-anims.py")
finally:
    journal("=== fermeture de l'editeur")
    unreal.SystemLibrary.quit_editor()