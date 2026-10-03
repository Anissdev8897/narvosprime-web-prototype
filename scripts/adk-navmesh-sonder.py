# ══════════════════════════════════════════════════════════════════════════════
# adk-navmesh-sonder.py — SONDER (lecture seule) la map Map_Narvos avant d'y
# bâtir un NavMesh. Répond :
#   1. quels sous-niveaux sont chargés, et les bornes des acteurs de chacun ;
#   2. s'il existe déjà des NavMeshBoundsVolume / RecastNavMesh (attendu : 0) ;
#   3. les bornes GLOBALES par niveau (min/max X/Y/Z).
# Sortie : journal du projet (LogPython [NARVOS]) + .hermes/navmesh_sonde.txt
#
#   UnrealEditor-Cmd.exe NanosWorldADK.uproject -run=pythonscript
#       -script=scripts/adk-navmesh-sonder.py -unattended -nosplash
#
# ══ MESURE PAR LES COMPOSANTS (2026-09-20) ════════════════════════════════════
# La V1 mesurait via `actor.get_actor_bounds()`. En commandlet headless, cette
# méthode rend des bounds VIDES pour la quasi-totalité des acteurs (aucun tick
# de rendu ne les recalcule) : 16 248 acteurs lus, ZÉRO borne sortie — le
# rapport s'arrêtait à l'en-tête de la section. La V2 mesure les COMPOSANTS
# (StaticMeshComponent.bounds, LandscapeComponent.bounds), toujours calculés à
# l'import — et compte tout ce qui échoue pour le dire.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io

RAPPORT = "E:/narvosprime-web-prototype/.hermes/navmesh_sonde.txt"
MAPE = "/Game/Narvos/Maps/Map_Narvos"

def journal(txt):
    try:
        unreal.log("[NARVOS] " + txt)
    except Exception:
        pass
    journal.buf.write(txt + "\n")

journal.buf = io.StringIO()

journal("SONDE NAVMESH V2 — lecture seule (aucune modification)")
journal("carte : " + MAPE)

# ── 1. Le monde chargé ────────────────────────────────────────────────────────
monde = unreal.EditorLevelLibrary.get_editor_world()
nom_monde = str(monde.get_name() if monde else "AUCUN")
journal("monde au demarrage : " + nom_monde)

# ⚠ Chargement EXPLICITE systématique (mesuré 2026-09-20) : au premier boot
# post-migration l'éditeur démarre sur un monde vierge « Untitled ».
journal("chargement explicite de la carte...")
unreal.EditorLevelLibrary.load_level(MAPE)
monde = unreal.EditorLevelLibrary.get_editor_world()
nom_monde = str(monde.get_name() if monde else "AUCUN")
journal("monde apres chargement : " + nom_monde)

# ── 2. Mesure par composants ──────────────────────────────────────────────────
acteurs = unreal.EditorLevelLibrary.get_all_level_actors()
journal("acteurs au total : %d" % len(acteurs))

niveaux = {}      # nom du niveau -> [minx,miny,minz,maxx,maxy,maxz,compte]
n_volume = 0
n_recast = 0
n_sans_borne = 0
n_sans_niveau = 0

def verser(nom, mnx, mny, mnz, mxx, mxy, mxz):
    e = niveaux.get(nom)
    if e is None:
        e = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9, 0]
        niveaux[nom] = e
    e[0] = min(e[0], mnx); e[1] = min(e[1], mny); e[2] = min(e[2], mnz)
    e[3] = max(e[3], mxx); e[4] = max(e[4], mxy); e[5] = max(e[5], mxz)
    e[6] += 1

def bounds_comp(comp):
    b = comp.bounds
    return (b.origin.x - b.extent.x, b.origin.y - b.extent.y, b.origin.z - b.extent.z,
            b.origin.x + b.extent.x, b.origin.y + b.extent.y, b.origin.z + b.extent.z)

for a in acteurs:
    try:
        cls = a.get_class().get_name()
    except Exception:
        continue
    if cls == "NavMeshBoundsVolume":
        n_volume += 1
    if "RecastNavMesh" in cls:
        n_recast += 1
    try:
        niveau = a.get_outer().get_name()
    except Exception:
        niveau = None

    mesure = False
    try:
        for comp in a.get_components_by_class(unreal.StaticMeshComponent):
            verser(niveau or "?", *bounds_comp(comp))
            mesure = True
    except Exception:
        pass
    if not mesure:
        try:
            for comp in a.get_components_by_class(unreal.LandscapeComponent):
                verser(niveau or "?", *bounds_comp(comp))
                mesure = True
        except Exception:
            pass
    if not mesure:
        # Dernier recours : bounds d'acteur (souvent vides en headless).
        try:
            origine, etendue = a.get_actor_bounds()
            if etendue.x > 1 or etendue.y > 1:
                verser(niveau or "?", origine.x - etendue.x, origine.y - etendue.y,
                       origine.z - etendue.z, origine.x + etendue.x,
                       origine.y + etendue.y, origine.z + etendue.z)
                mesure = True
        except Exception:
            pass
    if not mesure:
        n_sans_borne += 1
    if niveau is None and mesure:
        n_sans_niveau += 1

journal("NavMeshBoundsVolume existants : %d (attendu 0)" % n_volume)
journal("RecastNavMesh existants : %d (attendu 0)" % n_recast)
journal("acteurs sans borne mesurable : %d / %d" % (n_sans_borne, len(acteurs)))
journal("mesures sans niveau identifiable : %d" % n_sans_niveau)

journal("")
journal("─ bornes par niveau (metres) ─")
for nom, e in sorted(niveaux.items(), key=lambda kv: kv[0]):
    if e[6] < 3:
        continue
    journal("%-46s n=%5d  X[%.0f..%.0f]  Y[%.0f..%.0f]  Z[%.0f..%.0f]"
            % (nom[:46], e[6], e[0]/100, e[3]/100, e[1]/100, e[4]/100, e[2]/100, e[5]/100))

# ── 3. Rapport fichier (AVANT les journaux finaux : si unreal.log tombe pendant
#    l'arrêt de l'éditeur, le fichier est déjà écrit) ─────────────────────────
with io.open(RAPPORT, "w", encoding="utf-8") as f:
    f.write(journal.buf.getvalue())
journal("rapport ecrit : " + RAPPORT)
journal("SONDE TERMINEE")