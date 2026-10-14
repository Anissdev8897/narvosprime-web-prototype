"""
adk-session-monde.py — rebatit le niveau PERSISTANT `Map_Narvos` (perdu le 26/09) : le niveau
lui-meme, ses sous-niveaux a leurs decalages, et le ciel unique. UNE session d'editeur complet.

    UnrealEditor.exe <ADK>.uproject -ExecutePythonScript="<...>/scripts/recuperation/adk-session-monde.py" -unattended -nosplash
    (lance par scripts/recuperation/adk-session.sh monde, qui garde la duree)

-- D'OU VIENT LA RECETTE --------------------------------------------------------------------
Du 06/09 : `monde-2026-09-06/30_univers_1.py` (creer), `33_univers_3.py` (monter les mondes
en LevelStreamingDynamic decales), `36_univers_4.py` / `37_univers_4b.py` (un seul ciel, tague
`Sun`). Puis du 09/09 et du 15/09 : la foret et la Megastructure, montees en
LevelStreamingAlwaysLoaded a l'IDENTITE — leurs acteurs ont ete deplaces DANS leur niveau
(`adk-ajouter-foret.py`, `.hermes/astra_megastructure_monter.py`), et ces niveaux-la ont
survecu avec leurs acteurs deja en place : on ne rejoue donc que le MONTAGE, jamais le
deplacement (leurs scripts d'origine refuseraient d'ailleurs : « deja deplace »).

Les decalages sont ceux de `Shared/Catalogs/Mondes.lua` (`Mondes.DECALAGES`) : le Lua ne peut
pas lire la transform d'un sous-niveau, il la REPETE. Les changer ici sans les changer la-bas
fait atterrir le joueur dans le vide, sans une erreur.

-- CE QUE CETTE SESSION NE FAIT PAS ----------------------------------------------------------
  · la capitale (13 490 acteurs copies de CITY_PACK) : `adk-recolter-maps-ville.py` puis
    `adk-copier-ville-vers-narvos.py`, session suivante ;
  · `Map_Alien` : absente tant qu'elle n'est pas rebatie — elle est montee si elle existe ;
  · aucun sous-niveau n'est SAUVE : seule la carte persistante l'est. Les sous-niveaux sont
    les survivants du disque, on ne les reecrit pas pour les avoir charges.

Idempotente : un sous-niveau deja monte est laisse, un ciel deja pose n'est pas double.
Rapport : WebPortal/Server/adk/_manifests/session-monde.json
"""
import json
import traceback

import unreal

PERSISTANT = "/Game/Narvos/Maps/Map_Narvos"
RAPPORT = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/session-monde.json"

# (niveau, decalage du LevelStreaming) — Mondes.DECALAGES.
DYNAMIQUES = [
    ("/Game/Narvos/Maps/Map_Orbital", (0.0, 0.0, 0.0)),
    ("/Game/Narvos/Maps/Map_Forge", (-8000000.0, 0.0, 0.0)),
    ("/Game/Narvos/Maps/Map_Tower", (-8000000.0, 2000000.0, 0.0)),
    ("/Game/Narvos/Maps/Map_Alien", (-8000000.0, 4000000.0, 0.0)),
]
# Montes a l'identite : leurs acteurs sont deja a leur place physique.
TOUJOURS_CHARGES = [
    "/Game/Narvos/OpenWorlds/Levels/ForestKitONE",
    "/Game/Narvos/Maps/Map_Megastructure",
]
# Le ciel unique : (classe, position, rotation, label) — 36_univers_4.py.
CIEL = [
    (unreal.DirectionalLight, (0.0, 0.0, 20000.0), (0.0, -42.0, 25.0), "Narvos_Soleil"),
    (unreal.SkyLight, (0.0, 0.0, 20000.0), (0.0, 0.0, 0.0), "Narvos_CielAmbiant"),
    (unreal.SkyAtmosphere, (0.0, 0.0, 0.0), (0.0, 0.0, 0.0), "Narvos_Atmosphere"),
    (unreal.ExponentialHeightFog, (0.0, 0.0, 0.0), (0.0, 0.0, 0.0), "Narvos_Brume"),
]

EAL = unreal.EditorAssetLibrary
rapport = {"etapes": []}


def journal(message):
    unreal.log("[NARVOS] " + message)
    print("[NARVOS] " + message)


def flux_de(monde, chemin):
    """Le LevelStreaming qui monte ce sous-niveau dans `monde`, ou None.

    `World.streaming_levels` n'est PAS expose a Python en 5.7 (« Failed to find property »,
    mesure le 04/10 — et deja le 06/09 : `34_univers_3b.py` en est mort, `35_univers_3c.py`
    passe par GameplayStatics). On interroge donc niveau par niveau, par son nom court."""
    try:
        return unreal.GameplayStatics.get_streaming_level(monde, chemin.rsplit("/", 1)[1])
    except Exception:
        return None


def ouvrir_ou_creer(niveaux):
    if EAL.does_asset_exist(PERSISTANT):
        journal("    %s existe : ouverture" % PERSISTANT)
        ok = niveaux.load_level(PERSISTANT)
        rapport["persistant"] = "ouvert" if ok else "ECHEC ouverture"
    else:
        ok = niveaux.new_level(PERSISTANT)
        rapport["persistant"] = "cree" if ok else "ECHEC creation"
        journal("    %s : %s" % (PERSISTANT, rapport["persistant"]))
    monde = unreal.EditorLevelLibrary.get_editor_world()
    if monde is None or monde.get_name() != "Map_Narvos":
        raise RuntimeError("Map_Narvos n'est pas le monde ouvert (%s)" % (monde.get_name() if monde else None))
    return monde


def monter(monde):
    plan = [(c, unreal.LevelStreamingDynamic, d) for c, d in DYNAMIQUES]
    plan += [(c, unreal.LevelStreamingAlwaysLoaded, (0.0, 0.0, 0.0)) for c in TOUJOURS_CHARGES]
    for chemin, classe, (x, y, z) in plan:
        ligne = {"niveau": chemin, "classe": classe.__name__, "decalage": [x, y, z]}
        if flux_de(monde, chemin) is not None:
            ligne["etat"] = "deja monte"
        elif not EAL.does_asset_exist(chemin):
            ligne["etat"] = "ABSENT (non monte)"
        else:
            transform = unreal.Transform(unreal.Vector(x, y, z), unreal.Rotator(), unreal.Vector(1, 1, 1))
            flux = unreal.EditorLevelUtils.add_level_to_world_with_transform(monde, chemin, classe, transform)
            if flux is None:
                ligne["etat"] = "ECHEC add_level_to_world_with_transform"
            else:
                flux.set_editor_property("should_be_loaded", True)
                flux.set_editor_property("should_be_visible", True)
                ligne["etat"] = "monte"
        journal("    %-52s %-28s %s" % (chemin, classe.__name__, ligne["etat"]))
        rapport["etapes"].append(ligne)


def poser_ciel(niveaux):
    # Le ciel va dans le niveau PERSISTANT : un acteur pose alors qu'un sous-niveau est
    # courant partirait dans ce sous-niveau, et ne serait pas sauve avec la carte.
    rapport["niveau_courant"] = bool(niveaux.set_current_level_by_name("Map_Narvos"))
    labels = {a.get_actor_label() for a in unreal.EditorLevelLibrary.get_all_level_actors()}
    poses = []
    for classe, (x, y, z), (roulis, tangage, lacet), label in CIEL:
        if label in labels:
            continue
        acteur = unreal.EditorLevelLibrary.spawn_actor_from_class(
            classe, unreal.Vector(x, y, z), unreal.Rotator(roulis, tangage, lacet))
        if acteur is None:
            journal("    ECHEC ciel : " + label)
            continue
        acteur.set_actor_label(label)
        # Regle 2 de importing-maps.mdx : le tag `Sun` rend le ciel surchargeable par le
        # script (Shared/Logic/Ciel.lua pilote Ultra Dynamic Sky par joueur).
        try:
            acteur.set_editor_property("tags", [unreal.Name("Sun")])
        except Exception:
            acteur.tags = ["Sun"]                 # la forme de 36_univers_4.py
        poses.append(label)
    rapport["ciel_pose"] = poses
    journal("    ciel : %d acteur(s) pose(s) %s" % (len(poses), poses))


def relever(monde):
    """Ce que la carte porte APRES : la preuve se relit dans un processus neuf, mais ce
    releve dit deja si le montage a pris."""
    releve = []
    for chemin in [c for c, _ in DYNAMIQUES] + TOUJOURS_CHARGES:
        flux = flux_de(monde, chemin)
        if flux is None:
            continue
        t = flux.get_editor_property("level_transform").translation
        releve.append({"niveau": chemin, "classe": type(flux).__name__,
                       "decalage": [round(t.x), round(t.y), round(t.z)],
                       "charge": bool(flux.get_editor_property("should_be_loaded")),
                       "visible": bool(flux.get_editor_property("should_be_visible"))})
    rapport["sous_niveaux"] = releve
    acteurs = unreal.EditorLevelLibrary.get_all_level_actors()
    rapport["acteurs_charges"] = len(acteurs)
    rapport["ciel_present"] = sorted(a.get_actor_label() for a in acteurs
                                     if a.get_actor_label().startswith("Narvos_"))
    journal("    releve : %d sous-niveau(x), %d acteur(s) charges, ciel %s"
            % (len(releve), len(acteurs), rapport["ciel_present"]))


try:
    unreal.AssetRegistryHelpers.get_asset_registry().wait_for_completion()
    niveaux = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    journal("=== Map_Narvos : niveau persistant")
    monde = ouvrir_ou_creer(niveaux)
    journal("=== sous-niveaux")
    monter(monde)
    journal("=== ciel unique")
    poser_ciel(niveaux)
    # La carte persistante SEULE : `save_all_dirty_levels` reecrirait un sous-niveau que son
    # simple chargement aurait sali.
    rapport["sauve"] = bool(unreal.EditorLoadingAndSavingUtils.save_map(monde, PERSISTANT))
    journal("=== sauvegarde de %s : %s" % (PERSISTANT, rapport["sauve"]))
    relever(monde)
except Exception:
    rapport["exception"] = traceback.format_exc()
    for ligne in rapport["exception"].splitlines():
        journal("    " + ligne)
finally:
    with open(RAPPORT, "w", encoding="utf-8") as f:
        json.dump(rapport, f, ensure_ascii=False, indent=1)
    journal("=== fermeture de l'editeur")
    unreal.SystemLibrary.quit_editor()
