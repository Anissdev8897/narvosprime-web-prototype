"""
adk-sonder-monde.py — `Map_Narvos` rebatie met-elle chaque monde LA OU LE LUA L'ATTEND ?
Editeur complet, LECTURE SEULE (aucune sauvegarde), puis fermeture.

    bash scripts/recuperation/adk-session.sh recuperation/adk-sonder-monde.py

-- POURQUOI ----------------------------------------------------------------------------------
Le Lua ne peut pas lire la transform d'un sous-niveau : `Shared/Catalogs/Mondes.lua` REPETE
ou se trouve chaque monde (`Mondes.CENTRES`, sols mesures au raycast les 06, 08, 09 et 15/09).
Un sous-niveau remonte avec un decalage faux — ou monte deux fois decale, si ses acteurs sont
deja a leur place physique — donne une carte qui se charge, se cuit, et ou le joueur arrive
dans le vide, sans une erreur. Le seul temoin est le SOL, la ou le Lua pose le joueur.

-- CE QU'ELLE MESURE -------------------------------------------------------------------------
  · chaque sous-niveau monte : classe, decalage, nombre d'acteurs, centre de leurs bornes ;
  · chaque Landscape : son niveau et le centre de ses bornes, en coordonnees MONDE ;
  · un raycast vertical au centre de chaque monde du Lua : y a-t-il un sol, a quelle hauteur,
    et a combien de celle que le Lua attend ;
  · la capitale : nombre d'acteurs `NARVOS_VILLE_*` et bornes.

Rapport : WebPortal/Server/adk/_manifests/sonde-monde.json
"""
import json
import traceback

import unreal

PERSISTANT = "/Game/Narvos/Maps/Map_Narvos"
RAPPORT = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/sonde-monde.json"
SOUS_NIVEAUX = ["Map_Orbital", "Map_Forge", "Map_Tower", "Map_Alien", "ForestKitONE", "Map_Megastructure"]
# Mondes.CENTRES (Shared/Catalogs/Mondes.lua) : le sol que le Lua attend, par monde.
CENTRES = {
    "forge": (-8599410.0, 195426.0, 180134.0),
    "tower": (-8513420.0, 2385420.0, 151834.0),
    "alien": (-8513420.0, 4385420.0, 153406.0),
    "capitale": (-8513420.0, 6385420.0, 157859.0),
    "foret": (-8513420.0, 8385420.0, -8062.0),
    "megastructure": (-8513420.0, 10385420.0, 150000.0),
}
# Le hub orbital : « centre (-363 190, 85 940), sol a z=246 429 » (Mondes.lua, mesure du 08/09).
CENTRES["orbital"] = (-363190.0, 85940.0, 246429.0)
PORTEE = 800000.0     # 8 km de part et d'autre : la portee des mesures d'origine

rapport = {"sous_niveaux": [], "landscapes": [], "sols": {}, "capitale": {}}


def journal(message):
    unreal.log("[NARVOS] " + message)
    print("[NARVOS] " + message)


def niveau_de(acteur):
    try:
        return acteur.get_outer().get_outer().get_name()
    except Exception:
        return "?"


try:
    unreal.AssetRegistryHelpers.get_asset_registry().wait_for_completion()
    unreal.EditorLevelLibrary.load_level(PERSISTANT)
    monde = unreal.EditorLevelLibrary.get_editor_world()
    journal("=== monde ouvert : %s" % monde.get_name())
    acteurs = unreal.EditorLevelLibrary.get_all_level_actors()

    par_niveau = {}
    for a in acteurs:
        par_niveau.setdefault(niveau_de(a), []).append(a)

    journal("=== sous-niveaux")
    for nom in SOUS_NIVEAUX:
        flux = unreal.GameplayStatics.get_streaming_level(monde, nom)
        if flux is None:
            journal("    %-20s NON MONTE" % nom)
            rapport["sous_niveaux"].append({"niveau": nom, "monte": False})
            continue
        t = flux.get_editor_property("level_transform").translation
        siens = par_niveau.get(nom, [])
        ligne = {"niveau": nom, "monte": True, "classe": type(flux).__name__,
                 "decalage": [round(t.x), round(t.y), round(t.z)], "acteurs": len(siens)}
        if siens:
            xs = sorted(a.get_actor_location().x for a in siens)
            ys = sorted(a.get_actor_location().y for a in siens)
            zs = sorted(a.get_actor_location().z for a in siens)
            ligne["mediane"] = [round(xs[len(xs) // 2]), round(ys[len(ys) // 2]), round(zs[len(zs) // 2])]
        rapport["sous_niveaux"].append(ligne)
        journal("    %-20s %-28s decalage %-26s %5d acteur(s), mediane %s"
                % (nom, ligne["classe"], ligne["decalage"], len(siens), ligne.get("mediane")))
    journal("    (persistant Map_Narvos : %d acteur(s))" % len(par_niveau.get("Map_Narvos", [])))

    journal("=== landscapes (bornes en coordonnees MONDE)")
    for a in acteurs:
        if "Landscape" not in type(a).__name__:
            continue
        centre, demi = a.get_actor_bounds(False)
        ligne = {"niveau": niveau_de(a), "classe": type(a).__name__, "label": a.get_actor_label(),
                 "centre": [round(centre.x), round(centre.y), round(centre.z)],
                 "demi": [round(demi.x), round(demi.y), round(demi.z)]}
        rapport["landscapes"].append(ligne)
        journal("    %-20s %-26s centre %-34s demi %s" % (ligne["niveau"], ligne["classe"], ligne["centre"], ligne["demi"]))

    journal("=== sols aux centres du Lua (raycast vertical, +-8 km)")
    for nom, (x, y, z) in CENTRES.items():
        touche = unreal.SystemLibrary.line_trace_single(
            monde, unreal.Vector(x, y, z + PORTEE), unreal.Vector(x, y, z - PORTEE),
            unreal.TraceTypeQuery.TRACE_TYPE_QUERY1, False, [], unreal.DrawDebugTrace.NONE, True)
        if touche:
            champs = touche.to_tuple()
            point = champs[4]
            acteur = None
            for champ in champs:
                if isinstance(champ, unreal.Actor):
                    acteur = champ
                    break
            ligne = {"attendu": z, "sol": round(point.z, 1), "ecart": round(point.z - z, 1),
                     "acteur": acteur.get_actor_label() if acteur else None,
                     "niveau": niveau_de(acteur) if acteur else None}
            journal("    %-14s attendu z=%10.0f   sol z=%10.1f   ecart %9.1f   (%s, %s)"
                    % (nom, z, point.z, point.z - z, ligne["acteur"], ligne["niveau"]))
        else:
            ligne = {"attendu": z, "sol": None, "voisins": []}
            journal("    %-14s attendu z=%10.0f   AUCUN SOL sur 16 km" % (nom, z))
            # Pas de sol : qu'y a-t-il autour ? Les cinq acteurs les plus proches du point
            # attendu disent si le monde est ailleurs, absent, ou sans collision.
            proches = []
            for a in acteurs:
                centre, demi = a.get_actor_bounds(False)
                d = ((centre.x - x) ** 2 + (centre.y - y) ** 2 + (centre.z - z) ** 2) ** 0.5
                proches.append((d, a, centre, demi))
            proches.sort(key=lambda p: p[0])
            for d, a, centre, demi in proches[:5]:
                voisin = {"distance": round(d), "label": a.get_actor_label(), "classe": type(a).__name__,
                          "niveau": niveau_de(a), "centre": [round(centre.x), round(centre.y), round(centre.z)],
                          "demi": [round(demi.x), round(demi.y), round(demi.z)]}
                ligne["voisins"].append(voisin)
                journal("        a %8d : %-34s %-22s %-18s centre %s demi %s"
                        % (voisin["distance"], voisin["label"][:34], voisin["classe"][:22], voisin["niveau"],
                           voisin["centre"], voisin["demi"]))
        rapport["sols"][nom] = ligne

    ville = [a for a in acteurs if a.get_actor_label().startswith("NARVOS_VILLE_")]
    rapport["capitale"]["acteurs"] = len(ville)
    if ville:
        xs = [a.get_actor_location().x for a in ville]
        ys = [a.get_actor_location().y for a in ville]
        zs = [a.get_actor_location().z for a in ville]
        rapport["capitale"]["bornes"] = [round(min(xs)), round(max(xs)), round(min(ys)), round(max(ys)),
                                         round(min(zs)), round(max(zs))]
    journal("=== capitale : %d acteur(s) NARVOS_VILLE_*, bornes %s"
            % (len(ville), rapport["capitale"].get("bornes")))
except Exception:
    rapport["exception"] = traceback.format_exc()
    for ligne in rapport["exception"].splitlines():
        journal("    " + ligne)
finally:
    with open(RAPPORT, "w", encoding="utf-8") as f:
        json.dump(rapport, f, ensure_ascii=False, indent=1)
    journal("=== fermeture de l'editeur (rien n'est sauve)")
    unreal.SystemLibrary.quit_editor()
