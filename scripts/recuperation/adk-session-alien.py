"""
adk-session-alien.py — rebatit `/Game/Narvos/Maps/Map_Alien` (le monde « Azur », perdu le 26/09)
depuis la carte d'exemple du pack MW Landscape, puis la monte dans `Map_Narvos`.
UNE session d'editeur complet.

    bash scripts/recuperation/adk-session-alien.sh        (copie la source, lance, prouve)

-- D'OU VIENT LA RECETTE --------------------------------------------------------------------
  . `monde-2026-09-06/32_univers_2.py` : `Map_Alien` EST `LandscapeAutoMaterial_Island_Example`
    renommee. La source est dans le cache d'Epic (C:, jamais formate), datee du 05/09 12:58 :
    le jour et l'heure ou le pack est entre dans le projet.
  . `36_univers_4.py` : chaque carte d'exemple porte son ciel (soleil, atmosphere, nuages,
    brume, post-traitement), ses cameras et sa mire de couleurs ; reunis dans un meme monde
    ils s'additionnent. Otes — le ciel unique est dans `Map_Narvos`.
  . La POSITION du terrain. Le releve du 06/09 13:19 (`47_reparer_land.py`, sortie relue dans
    les historiques) donne l'acteur Landscape de Map_Alien en (-8 614 220, 4 284 620, 152 020)
    monde, soit (-614 220, 284 620, 152 020) dans son niveau ; sa place d'exemple est
    (-100 800, -100 800, 100). C'est la position DEPLACEE qui est restee : `Mondes.lua`
    (remesure du 08/09) attend le sol de l'ile en (-8 513 420, 4 385 420, 153 406), et
    `Map_Tower`, sa jumelle survivante, porte son terrain au meme ecart (sonde du 04/10).

-- CE QUI PROUVE QUE C'EST LA MEME ILE -------------------------------------------------------
Avant de deplacer : le sol au centre de la carte d'exemple doit etre a z = 1 486 — c'est
153 406 moins l'ecart (151 920), et c'est aussi l'ancienne arrivee du Lua (1 586 = sol + 1 m).
Apres : le sol en (-513 420, 385 420) doit etre a 153 406. Hors tolerance, rien n'est sauve.

Le montage dans `Map_Narvos` est celui de `adk-session-monde.py`, rejoue tel quel a la fin
(idempotent : il ne monte que ce qui manque, ne sauve que la carte persistante, et ferme).
Rapport : WebPortal/Server/adk/_manifests/session-alien.json
"""
import json
import runpy
import traceback

import unreal

SOURCE = "/Game/Narvos/MWLandscapeAutoMaterial/Maps/LandscapeAutoMaterial_Island_Example"
CIBLE = "/Game/Narvos/Maps/Map_Alien"
RAPPORT = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/session-alien.json"
MONTAGE = "E:/narvosprime-web-prototype/scripts/recuperation/adk-session-monde.py"

PLACE_EXEMPLE = (-100800.0, -100800.0, 100.0)       # l'acteur Landscape dans la carte d'exemple
PLACE_FINALE = (-614220.0, 284620.0, 152020.0)      # releve du 06/09, moins le decalage du sous-niveau
SOL_EXEMPLE = (0.0, 0.0, 1486.0)                    # sol au centre, avant deplacement
SOL_FINAL = (-513420.0, 385420.0, 153406.0)         # Mondes.CENTRES.alien moins Mondes.DECALAGES.alien
TOLERANCE = 2.0                                     # cm
PORTEE = 800000.0

# 36_univers_4.py : le ciel, les cameras et la mire des cartes d'exemple.
CLASSES_A_OTER = {
    "CineCameraActor", "SkyLight", "SkyAtmosphere", "VolumetricCloud", "ExponentialHeightFog",
    "DirectionalLight", "PostProcessVolume", "AtmosphericFog", "TextRenderActor",
}
LABELS_A_OTER = ("SM_MW_ColorChecker", "Galaxy_Dome")

EAL = unreal.EditorAssetLibrary
rapport = {"etapes": []}


def journal(message):
    unreal.log("[NARVOS] " + message)
    print("[NARVOS] " + message)


def sol(monde, x, y, z):
    """Hauteur du sol sous (x, y), ou None : raycast vertical de part et d'autre de z."""
    touche = unreal.SystemLibrary.line_trace_single(
        monde, unreal.Vector(x, y, z + PORTEE), unreal.Vector(x, y, z - PORTEE),
        unreal.TraceTypeQuery.TRACE_TYPE_QUERY1, False, [], unreal.DrawDebugTrace.NONE, True)
    return touche.to_tuple()[4].z if touche else None


def renommer():
    if EAL.does_asset_exist(CIBLE):
        journal("    %s existe deja : pas de renommage" % CIBLE)
        return "deja la"
    if not EAL.does_asset_exist(SOURCE):
        raise RuntimeError("source absente : " + SOURCE)
    renomme = False
    try:
        renomme = bool(EAL.rename_asset(SOURCE, CIBLE))
    except Exception as erreur:
        journal("    rename_asset : " + str(erreur)[:200])
    if not renomme and not EAL.does_asset_exist(CIBLE):
        # Repli de 32_univers_2.py : un World refuse parfois le renommage.
        if EAL.duplicate_asset(SOURCE, CIBLE):
            EAL.save_asset(CIBLE, only_if_is_dirty=False)
            EAL.delete_asset(SOURCE)
    if not EAL.does_asset_exist(CIBLE):
        raise RuntimeError("renommage ET duplication ont echoue")
    # Un redirecteur laisse a l'ancien nom ferait revenir la carte d'exemple dans le pack.
    if EAL.does_asset_exist(SOURCE):
        journal("    reste a l'ancien nom (redirecteur) : supprime %s" % bool(EAL.delete_asset(SOURCE)))
    return "renomme" if renomme else "duplique"


def preparer():
    """Renomme, ote le ciel, deplace le terrain, sauve. Rend True si la carte est PROUVEE."""
    rapport["renommage"] = renommer()
    journal("    renommage : " + rapport["renommage"])

    niveaux = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if not niveaux.load_level(CIBLE):
        raise RuntimeError("ouverture impossible : " + CIBLE)
    monde = unreal.EditorLevelLibrary.get_editor_world()
    if monde is None or monde.get_name() != "Map_Alien":
        raise RuntimeError("Map_Alien n'est pas le monde ouvert (%s)" % (monde.get_name() if monde else None))

    acteurs = unreal.EditorLevelLibrary.get_all_level_actors()
    rapport["acteurs_avant"] = sorted("%s:%s" % (type(a).__name__, a.get_actor_label()) for a in acteurs)
    journal("    %d acteur(s) : %s" % (len(acteurs), ", ".join(rapport["acteurs_avant"])[:400]))

    otes = {}
    for acteur in acteurs:
        classe = type(acteur).__name__
        if classe in CLASSES_A_OTER or acteur.get_actor_label().startswith(LABELS_A_OTER):
            if unreal.EditorLevelLibrary.destroy_actor(acteur):
                otes[classe] = otes.get(classe, 0) + 1
    rapport["otes"] = otes
    journal("    ciel, cameras et mire otes : %s" % otes)

    terrains = [a for a in unreal.EditorLevelLibrary.get_all_level_actors()
                if type(a).__name__.startswith("Landscape") and "Gizmo" not in type(a).__name__]
    principal = [a for a in terrains if type(a).__name__ == "Landscape"]
    if len(principal) != 1:
        raise RuntimeError("%d acteur(s) Landscape, un seul attendu" % len(principal))
    place = principal[0].get_actor_location()
    rapport["landscape_avant"] = [round(place.x, 1), round(place.y, 1), round(place.z, 1)]

    def a(lieu):
        return all(abs(v - c) <= TOLERANCE for v, c in zip((place.x, place.y, place.z), lieu))

    if a(PLACE_FINALE):
        journal("    terrain deja a sa place finale")
    elif a(PLACE_EXEMPLE):
        avant = sol(monde, *SOL_EXEMPLE)
        rapport["sol_exemple"] = avant
        journal("    sol au centre de la carte d'exemple : %s (attendu %.0f)" % (avant, SOL_EXEMPLE[2]))
        if avant is None or abs(avant - SOL_EXEMPLE[2]) > TOLERANCE:
            raise RuntimeError("ce n'est pas l'ile attendue : terrain NON deplace, carte NON sauvee")
        ecart = unreal.Vector(*[f - e for f, e in zip(PLACE_FINALE, PLACE_EXEMPLE)])
        for terrain in terrains:
            lieu = terrain.get_actor_location()
            terrain.set_actor_location(
                unreal.Vector(lieu.x + ecart.x, lieu.y + ecart.y, lieu.z + ecart.z), False, False)
        journal("    %d acteur(s) de terrain deplace(s) de (%.0f, %.0f, %.0f)" % (len(terrains), ecart.x, ecart.y, ecart.z))
    else:
        raise RuntimeError("terrain a une place inconnue %s : rien n'est touche" % rapport["landscape_avant"])

    place = principal[0].get_actor_location()
    centre, demi = principal[0].get_actor_bounds(False)
    apres = sol(monde, *SOL_FINAL)
    rapport["landscape_apres"] = [round(place.x, 1), round(place.y, 1), round(place.z, 1)]
    rapport["bornes_centre"] = [round(centre.x, 1), round(centre.y, 1), round(centre.z, 1)]
    rapport["bornes_demi"] = [round(demi.x, 1), round(demi.y, 1), round(demi.z, 1)]
    rapport["sol_final"] = apres
    journal("    terrain en %s ; bornes centre %s demi %s" % (rapport["landscape_apres"], rapport["bornes_centre"], rapport["bornes_demi"]))
    journal("    sol a l'arrivee du Lua : %s (attendu %.0f)" % (apres, SOL_FINAL[2]))
    if apres is None or abs(apres - SOL_FINAL[2]) > TOLERANCE:
        raise RuntimeError("le sol n'est pas ou le Lua l'attend : carte NON sauvee")

    rapport["acteurs_apres"] = sorted("%s:%s" % (type(x).__name__, x.get_actor_label())
                                      for x in unreal.EditorLevelLibrary.get_all_level_actors())
    rapport["sauve"] = bool(unreal.EditorLoadingAndSavingUtils.save_map(monde, CIBLE))
    journal("    sauvegarde de %s : %s" % (CIBLE, rapport["sauve"]))
    return rapport["sauve"]


prete = False
try:
    unreal.AssetRegistryHelpers.get_asset_registry().wait_for_completion()
    journal("=== Map_Alien : carte d'exemple -> monde Azur")
    prete = preparer()
except Exception:
    rapport["exception"] = traceback.format_exc()
    for ligne in rapport["exception"].splitlines():
        journal("    " + ligne)
finally:
    with open(RAPPORT, "w", encoding="utf-8") as f:
        json.dump(rapport, f, ensure_ascii=False, indent=1)

if prete:
    try:
        journal("=== montage dans Map_Narvos (adk-session-monde.py)")
        runpy.run_path(MONTAGE, run_name="__main__")      # ferme l'editeur dans son `finally`
    finally:
        unreal.SystemLibrary.quit_editor()
else:
    journal("=== Map_Alien NON prete : pas de montage ; fermeture de l'editeur")
    unreal.SystemLibrary.quit_editor()
