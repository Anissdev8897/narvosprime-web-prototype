# -*- coding: utf-8 -*-
"""
adk-sonder-landscapes.py — où sont les terrains, et à quelle distance du bord de
leur monde ? Ne modifie rien.

    python scripts/ue-remote.py --fichier scripts/adk-sonder-landscapes.py

── LA QUESTION ───────────────────────────────────────────────────────────────
Demande de Hanibes le 2026-09-12, capture à l'appui : « place la map plus loin du
bord ». Avant de déplacer un terrain de plusieurs kilomètres, il faut savoir :

  · quels Landscape existent dans le niveau ouvert, et où ;
  · quelle est leur emprise réelle (bornes, pas le point d'origine) ;
  · à quel monde ils appartiennent, et à quelle distance du CENTRE de ce monde.

`Catalogs/Mondes.lua` donne les centres et `RAYON_MONDE` (6 km) : un terrain dont
l'emprise déborde ce rayon est « au bord », et les repères du monde voisin
commencent à 20 km. C'est cette marge qu'on mesure.

⚠ Le catalogue dit aussi que le terrain de la FORGE a été SUPPRIMÉ du niveau.
Map_Forge.umap pèse 481 ko contre 225 Mo pour Map_Tower : la sonde le confirmera
ou non, mais un monde sans terrain fait tomber son portail dans le vide.
"""
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

MONDES = ("E:/narvosprime-web-prototype/WebPortal/Server/nanos_world"
          "/packages/narvos/Shared/Catalogs/Mondes.lua")


def dire(t):
    print(t)
    unreal.log("[NARVOS] " + t)


# ── Les centres des mondes, lus dans le catalogue ────────────────────────────

centres = {}
rayon = 600000.0
try:
    with open(MONDES, encoding="utf-8") as f:
        texte = f.read()
    for m in re.finditer(r"(\w+)\s*=\s*Vector\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)", texte):
        centres[m.group(1)] = (float(m.group(2)), float(m.group(3)), float(m.group(4)))
    r = re.search(r"RAYON_MONDE\s*=\s*([\d.]+)", texte)
    if r:
        rayon = float(r.group(1))
except Exception as err:
    dire("catalogue des mondes illisible : %s" % err)

dire("%d centre(s) de monde lus ; rayon = %.0f m" % (len(centres), rayon / 100.0))

# ── Le niveau ouvert ─────────────────────────────────────────────────────────

sous_systeme = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
acteurs = sous_systeme.get_all_level_actors()
dire("%d acteur(s) dans le niveau ouvert" % len(acteurs))

terrains = [a for a in acteurs if "Landscape" in a.get_class().get_name()]
dire("%d acteur(s) de type Landscape" % len(terrains))
dire("")

for a in terrains:
    nom = a.get_actor_label()
    loc = a.get_actor_location()
    try:
        origine, etendue = a.get_actor_bounds(False)
    except Exception:
        origine, etendue = loc, unreal.Vector(0, 0, 0)

    taille_km = (etendue.x * 2 / 100000.0, etendue.y * 2 / 100000.0)
    dire("%s  (%s)" % (nom, a.get_class().get_name()))
    dire("    position : %.0f, %.0f, %.0f" % (loc.x, loc.y, loc.z))
    dire("    emprise  : %.2f km x %.2f km   centre (%.0f, %.0f, %.0f)"
         % (taille_km[0], taille_km[1], origine.x, origine.y, origine.z))

    # Le monde le plus proche, et la marge qui reste jusqu'au bord.
    meilleur, distance = None, None
    for monde, c in centres.items():
        d = ((origine.x - c[0]) ** 2 + (origine.y - c[1]) ** 2) ** 0.5
        if distance is None or d < distance:
            meilleur, distance = monde, d
    if meilleur:
        demi = max(etendue.x, etendue.y)
        marge = rayon - (distance + demi)
        dire("    monde le plus proche : %s a %.2f km du centre" % (meilleur, distance / 100000.0))
        dire("    marge jusqu au bord  : %.2f km %s"
             % (marge / 100000.0, "" if marge > 0 else "  ⚠ DEBORDE"))
    dire("")

# ── Les sous-niveaux, et ce qu'ils portent ───────────────────────────────────

try:
    monde = unreal.EditorLevelLibrary.get_editor_world()
    dire("niveau ouvert : " + monde.get_name())
    niveaux = unreal.EditorLevelUtils.get_levels(monde) if hasattr(
        unreal.EditorLevelUtils, "get_levels") else []
    for n in niveaux:
        dire("    sous-niveau : " + str(n.get_name()))
except Exception as err:
    dire("sous-niveaux illisibles : %s" % err)

dire("Fin de sonde — rien n a ete modifie.")