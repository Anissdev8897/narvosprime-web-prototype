"""
adk-chaine-stylized.py — rejoue EN UN SEUL commandlet la fin de la chaine des personnages
Stylized du 04/09 et du 05/09, une fois les materiaux du pack promus sous Narvos/.

    bash scripts/recuperation/adk-lancer.sh recuperation/adk-chaine-stylized.py

-- CE QUI DOIT ETRE EN PLACE AVANT (fichiers, puis promotion) --------------------------------
  · `Content/Narvos/stylized_modular` : les 40 meshes importes (inv-stylized_modular) ;
  · `Content/Narvos/StylizedModularChar/Materials|Textures` : le pack 4.26 copie sous
    `Content/StylizedModularChar` puis PROMU (adk-promouvoir-packs.py — le 04/09 c'etait un
    `rename_directory`, qui a menti ailleurs depuis) ;
  · `Content/Narvos/StylizedModularChar/Meshes/<genre>/Hair` : les 24 coiffures, copiees.

-- LES ETAPES, DANS L'ORDRE D'ORIGINE --------------------------------------------------------
  1. adk-rebrancher-materiaux.py : les 40 meshes sortent de l'import avec des materiaux
     VIDES homonymes des vrais (`MI_Aviator`...) ; on les echange par nom ;
  2. adk-valider-coiffures.py    : les 24 StaticMesh copies se chargent-ils ;
  3. adk-rebrancher-coiffures.py : leurs slots sans materiau recoivent celui de leur numero ;
  4. adk-creer-materiau-peau.py  : `M_NarvosPeau` + `MI_NarvosPeau_M/F` (peau teintable, 05/09).

Un commandlet par etape couterait quatre demarrages d'Unreal (~5 min chacun) pour des scripts
qui tournent en secondes. Chaque etape est isolee : un `SystemExit` de l'une n'emporte pas les
suivantes, et le journal dit laquelle s'est arretee.
"""
import os
import runpy
import traceback

import unreal

SCRIPTS = "E:/narvosprime-web-prototype/scripts"


def journal(message):
    unreal.log("[NARVOS] " + message)


def etape(nom, script, environnement=None):
    journal("=== %s" % nom)
    for cle, valeur in (environnement or {}).items():
        os.environ[cle] = valeur
    try:
        runpy.run_path(SCRIPTS + "/" + script, run_name="__main__")
        journal("=== %s : termine" % nom)
    except SystemExit as e:
        journal("=== %s : ARRET (%s)" % (nom, e))
    except Exception:
        journal("=== %s : EXCEPTION" % nom)
        for ligne in traceback.format_exc().splitlines():
            journal("    " + ligne)
    finally:
        for cle in (environnement or {}):
            os.environ.pop(cle, None)


etape("materiaux des 40 meshes Stylized", "adk-rebrancher-materiaux.py", {
    "NARVOS_MESHES": "/Game/Narvos/stylized_modular",
    "NARVOS_MATS": "/Game/Narvos/StylizedModularChar/Materials",
})
etape("coiffures : validation", "adk-valider-coiffures.py")
etape("coiffures : materiaux", "adk-rebrancher-coiffures.py")
etape("peau teintable", "adk-creer-materiau-peau.py")
