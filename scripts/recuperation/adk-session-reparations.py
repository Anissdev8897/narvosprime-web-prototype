"""
adk-session-reparations.py — UNE session d'editeur COMPLET qui rejoue, sur les dossiers
REBATIS de l'ADK, les passes de reparation que leurs originaux avaient recues apres import.

    UnrealEditor.exe <ADK>.uproject -ExecutePythonScript="<...>/scripts/recuperation/adk-session-reparations.py" -unattended -nosplash
    (lance par scripts/recuperation/adk-session-reparations.sh, qui prouve ; garde de duree : adk-session.sh)

-- POURQUOI ----------------------------------------------------------------------------
Un import refait redonne les paquets de l'IMPORT, pas ceux du 23/09 : entre les deux, trois
passes avaient modifie les materiaux. Mesure du 04/10 sur les dossiers rebatis (pnj,
pnj_monstre, WW100, ThirdPerson, tr_*, ue4_mannequin...) :
  · aucun materiau ne porte `bUsedWithSkeletalMesh` (cause mesuree des PNJ gris, 13/09) ;
  · les pieces Trooper portent `WorldGridMaterial*` au lieu de `M_/T_<dossier>` ;
  · leurs instances `MI_<dossier>` (textures cablees sur Mat_Clothing_Master) manquent.

-- L'ORDRE, QUI EST CELUI D'ORIGINE (08/09 puis 13/09) -----------------------------------
  1. adk-renommer-worldgrid-tout.py   : le nom reserve d'abord, les textures prennent leur nom ;
  1 bis. adk-renommer-asset.py        : les `MTL_*` nes sous le nom de leur GLB reprennent celui
     de l'inventaire (voir noms_d_origine) ;
  2. adk-brancher-materiaux-modulaires.py : il cherche les textures PAR ces noms ;
  3. adk-materiau-couleur-sommet.py   : `M_NarvosCouleurSommet` de mob_boss (04/09), avant
     les drapeaux pour qu'il les recoive ;
  4. adk-usage-skeletal.py (NARVOS_APPLIQUER=1) : en dernier, il voit les materiaux neufs ;
  5. adk-blend-space-locomotion.py    : `BS_Narvos_Locomotion` (23/09), que seul l'editeur
     complet sait finir (il faut OUVRIR l'editeur de l'asset) ;
  6. fermeture de l'editeur, QUOI QU'IL ARRIVE.

-- POURQUOI L'EDITEUR COMPLET ------------------------------------------------------------
Un UMaterial sauve en commandlet perd son graphe (reference_automaterial_gris) : les passes
1, 3 et 4 creent ou resauvent des UMaterial. Chaque script garde ses propres regles (fichiers lies en dur
jamais ecrits, /Game/Narvos seulement).
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


def noms_reserves():
    runpy.run_path(SCRIPTS + "/adk-renommer-worldgrid-tout.py", run_name="__main__")


INVENTAIRE = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_assets-inventory.2026-09-23.avant-recook.json"


def noms_d_origine():
    """Rend aux materiaux `MTL_*` le nom que la passe du 05/09 leur avait donne dans l'ADK.

    Le 05/09 le nom reserve `WorldGridMaterial` a ete retire DEUX fois, par deux outils qui ne
    derivent pas le meme nom : dans l'ADK (`adk-renommer-asset.py`, mode AUTO : les deux
    derniers segments parlants du chemin -> `MTL_SovietZombieTankman1_UE4`) et dans les GLB
    sources (`glb-renommer-materiau.mjs`, mode AUTO a longueur contrainte -> `MTL_UE4`). Un
    import refait depuis ces GLB nait donc sous le nom du GLB, pas sous celui de l'inventaire.

    Regle, lue dans l'inventaire et non tenue a la main : un materiau `MTL_*` attendu et absent,
    dans un dossier qui porte EXACTEMENT UN materiau `MTL_*` inconnu de l'inventaire. Plusieurs
    inconnus : on ne devine pas lequel, on le dit."""
    import json
    with open(INVENTAIRE, encoding="utf-8-sig") as f:
        attendus = json.load(f)["assets"]
    connus = set(a["paquet"] for a in attendus)
    registre = unreal.AssetRegistryHelpers.get_asset_registry()
    faits = 0
    for a in attendus:
        if a["classe"] != "Material" or not a["nom"].startswith("MTL_"):
            continue
        dossier = a["paquet"].rpartition("/")[0]
        if unreal.EditorAssetLibrary.does_asset_exist(a["paquet"]) \
                or not unreal.EditorAssetLibrary.does_directory_exist(dossier):
            continue
        inconnus = [str(d.asset_name) for d in registre.get_assets_by_path(dossier, recursive=False)
                    if str(d.asset_class_path.asset_name) == "Material"
                    and str(d.asset_name).startswith("MTL_") and str(d.package_name) not in connus]
        if len(inconnus) != 1:
            journal("    %s attendu, %d candidat(s) %s : laisse" % (a["paquet"], len(inconnus), inconnus[:4]))
            continue
        os.environ["NARVOS_RACINE"] = dossier
        os.environ["NARVOS_ANCIEN"] = inconnus[0]
        os.environ["NARVOS_NOUVEAU"] = a["nom"]
        try:
            runpy.run_path(SCRIPTS + "/adk-renommer-asset.py", run_name="__main__")
            faits += 1
        except SystemExit:
            pass
        finally:
            for cle in ("NARVOS_RACINE", "NARVOS_ANCIEN", "NARVOS_NOUVEAU"):
                os.environ.pop(cle, None)
    journal("    %d materiau(x) rendu(s) a leur nom d'origine" % faits)


def dossiers_a_instance_manquante():
    """Les dossiers ou l'inventaire du 23/09 attend l'instance `MI_<dossier>` que cette passe
    fabrique, et ou elle n'existe pas : le perimetre exact de ce qu'il reste a refaire. Un
    dossier rendu avec son instance n'y est pas ; un dossier qui n'en avait pas non plus."""
    import json
    with open(INVENTAIRE, encoding="utf-8-sig") as f:
        attendus = json.load(f)["assets"]
    dossiers = []
    for a in attendus:
        if a["classe"] != "MaterialInstanceConstant":
            continue
        dossier, _, nom = a["paquet"].rpartition("/")
        if nom == "MI_" + dossier.rpartition("/")[2] and not unreal.EditorAssetLibrary.does_asset_exist(a["paquet"]):
            if unreal.EditorAssetLibrary.does_directory_exist(dossier):
                dossiers.append(dossier)
    return sorted(dossiers)


def materiaux_modulaires():
    dossiers = dossiers_a_instance_manquante()
    journal("    %d dossier(s) attendent leur instance : %s" % (len(dossiers), ", ".join(d.rpartition("/")[2] for d in dossiers)[:300]))
    if not dossiers:
        return
    os.environ["NARVOS_DOSSIERS"] = ",".join(dossiers)
    try:
        runpy.run_path(SCRIPTS + "/adk-brancher-materiaux-modulaires.py", run_name="__main__")
    finally:
        os.environ.pop("NARVOS_DOSSIERS", None)


def couleur_sommet():
    runpy.run_path(SCRIPTS + "/recuperation/adk-materiau-couleur-sommet.py", run_name="__main__")


# Les fichiers rendus par DMDE gardent leur date d'origine (23/09 au plus tard) ; tout ce
# qui a ete rebati porte une date d'apres la perte. La date du FICHIER dit donc, sans liste a
# tenir, ce qui releve de cette session.
REBATIS_DEPUIS = "2026-10-03"


def usage_skeletal():
    os.environ["NARVOS_APPLIQUER"] = "1"
    os.environ["NARVOS_ECRITS_DEPUIS"] = REBATIS_DEPUIS
    try:
        runpy.run_path(SCRIPTS + "/adk-usage-skeletal.py", run_name="__main__")
    finally:
        os.environ.pop("NARVOS_APPLIQUER", None)
        os.environ.pop("NARVOS_ECRITS_DEPUIS", None)


def blend_space_locomotion():
    runpy.run_path(SCRIPTS + "/recuperation/adk-blend-space-locomotion.py", run_name="__main__")


try:
    # Dans l'editeur complet le registre se remplit en arriere-plan : une requete lancee au
    # demarrage rendrait une liste PARTIELLE, et les trois passes partent du registre.
    unreal.AssetRegistryHelpers.get_asset_registry().wait_for_completion()
    etape("noms reserves du moteur (WorldGridMaterial)", noms_reserves)
    etape("noms d'origine des materiaux MTL_*", noms_d_origine)
    etape("materiaux des pieces modulaires", materiaux_modulaires)
    etape("materiau a couleur de sommet (mob_boss)", couleur_sommet)
    etape("drapeaux skeletal mesh des materiaux", usage_skeletal)
    etape("blend space de locomotion", blend_space_locomotion)
finally:
    journal("=== fermeture de l'editeur")
    unreal.SystemLibrary.quit_editor()
