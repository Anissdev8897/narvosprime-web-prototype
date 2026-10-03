"""
adk-creer-bp-minimap.py — cree les trois Actor Blueprint VIDES que la minimap Ako
suit a la place des classes de sa demo :

  /Game/Narvos/Minimap/BP_NarvosCarteJoueur   le joueur (player ref du DataAsset)
  /Game/Narvos/Minimap/BP_NarvosCarteRepere   un repere du radar (item_setting)
  /Game/Narvos/Minimap/BP_NarvosCarteVide     jamais spawne : cible des classes de
                                              demo qu'on ne veut pas voir dessinees

A lancer dans l'EDITEUR COMPLET (adk-session-lot3.py) : create_asset passe par
AssetTools, qui veut une application Slate — en commandlet, c'est l'assertion
`CurrentApplication.IsValid()` deja payee pour les imports.

-- POURQUOI DES BLUEPRINTS VIDES ------------------------------------------------
Sonde du 2026-09-13 : le widget cherche le joueur par GetActorOfClass(player ref).
Le Character de nanos est une classe C++ du CLIENT, que l'ADK ne connait pas : on
ne peut pas la mettre dans le DataAsset. Client/Minimap.lua spawne ces proxies et
attache le premier au personnage local ; les ClassRedirects de DefaultEngine.ini
ramenent les classes de la demo sur eux. Rien d'autre n'est modifie : le DataAsset
et les widgets restent les fichiers ACHETES, lies en dur, jamais resauves.

-- CE QUI EST PROUVE ICI ----------------------------------------------------------
Chaque Blueprint est compile, sauve, puis RELU : sa racine de scene (sans elle,
AttachTo n'a rien a attacher) et son fichier sur disque. Le rapport va dans
WebPortal/Server/adk/_manifests/minimap-bp.json.
"""
import json
import os

import unreal

DOSSIER = "/Game/Narvos/Minimap"
NOMS = ["BP_NarvosCarteJoueur", "BP_NarvosCarteRepere", "BP_NarvosCarteVide"]
CONTENT = "E:/narvosprime-web-prototype/WebPortal/Server/adk/Content"
SORTIE = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/minimap-bp.json"


def journal(message):
    unreal.log("[NARVOS] " + message)
    print("[NARVOS] " + message)


def composants(bp):
    sous = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
    sortie = []
    for poignee in sous.k2_gather_subobject_data_for_blueprint(bp):
        donnee = unreal.SubobjectDataBlueprintFunctionLibrary.get_data(poignee)
        objet = unreal.SubobjectDataBlueprintFunctionLibrary.get_object(donnee)
        if objet is not None:
            sortie.append("%s <%s>" % (objet.get_name(), objet.get_class().get_name()))
    return sortie


rapport = {}
outils = unreal.AssetToolsHelpers.get_asset_tools()
for nom in NOMS:
    chemin = DOSSIER + "/" + nom
    fiche = {}
    if unreal.EditorAssetLibrary.does_asset_exist(chemin):
        bp = unreal.load_asset(chemin)
        fiche["cree"] = False
    else:
        fabrique = unreal.BlueprintFactory()
        fabrique.set_editor_property("parent_class", unreal.Actor)
        bp = outils.create_asset(nom, DOSSIER, unreal.Blueprint, fabrique)
        fiche["cree"] = bp is not None
    if bp is None:
        fiche["erreur"] = "creation refusee"
        journal("ECHEC : %s" % chemin)
        rapport[nom] = fiche
        continue
    unreal.BlueprintEditorLibrary.compile_blueprint(bp)
    # Sauver CE Blueprint, et lui seul : Narvos/ porte des liens durs vers des packs
    # achetes, qu'une sauvegarde de dossier pourrait reecrire.
    fiche["sauve"] = bool(unreal.EditorAssetLibrary.save_asset(chemin, only_if_is_dirty=False))
    fiche["composants"] = composants(bp)
    fiche["racine"] = any("SceneComponent" in c for c in fiche["composants"])
    fiche["fichier"] = os.path.isfile("%s/Narvos/Minimap/%s.uasset" % (CONTENT, nom))
    journal("%s : cree=%s sauve=%s racine=%s fichier=%s composants=%s" % (
        nom, fiche["cree"], fiche["sauve"], fiche["racine"], fiche["fichier"], fiche["composants"]))
    rapport[nom] = fiche

with open(SORTIE, "w", encoding="utf-8") as f:
    json.dump(rapport, f, ensure_ascii=False, indent=1)
journal("rapport : " + SORTIE)