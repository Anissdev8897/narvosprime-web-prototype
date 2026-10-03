# ══════════════════════════════════════════════════════════════════════════════
# adk-poser-foret.py — deplacer les acteurs de ForestKitONE a leur place.
#
#   exec(open(r"...\adk-poser-foret.py", encoding="utf-8").read())
#
#   NARVOS_POSER_APPLIQUER=1 pour ecrire ; sans, il MESURE.
#
# ── POURQUOI CE SCRIPT EXISTE, ALORS QUE LA TRANSFORMATION EST DEJA POSEE ─────
# `adk-ajouter-foret.py` a monte le niveau et lui a donne une
# `level_transform`. Mesure juste apres : les 238 acteurs sont TOUJOURS a leurs
# coordonnees d'origine (X de -25 200 a 24 277). Une transformation de niveau
# n'est appliquee qu'au CHARGEMENT du sous-niveau, pas a la pose. Le raycast au
# nouvel emplacement ne touchait donc aucun sol : il n'y avait rien.
#
# ── ET SURTOUT : CE N'EST PAS LA CONVENTION DU PROJET ─────────────────────────
# Mesure des mediane de position, par paquet :
#     Map_Forge     X -8 524 560   Y   409 710   Z 149 540
#     Map_Tower     X -8 011 140   Y 2 024 290   Z  -4 540
#     Map_Alien     X -8 513 420   Y 4 284 620   Z 152 012
#     Map_Orbital   X       951    Y  -399 626   Z  47 589
#
# Les quatre mondes portent des coordonnees MONDE reelles, et AUCUNE
# transformation de niveau. La foret doit suivre : un assemblage ou trois mondes
# sur quatre sont poses d'une facon et le dernier d'une autre se paie au premier
# bug de position, quand personne ne sait plus quelle regle s'applique.
#
# ⚠ ON ANNULE LA TRANSFORMATION AVANT DE DEPLACER. La garder ferait appliquer le
# decalage DEUX FOIS au chargement : une fois par les coordonnees des acteurs,
# une fois par le niveau. La foret partirait a 17 000 km.
#
# ── Z INCHANGE, ET C'EST VOULU ────────────────────────────────────────────────
# On decale en X/Y seulement. Le terrain de la foret vit vers Z ~ 0..252 ; les
# autres mondes vers Z ~ 150 000. Ca ne gene rien — ils sont a 2 km l'un de
# l'autre en Y — et `Mondes.CENTRES` stocke un Z PAR monde, mesure par raycast.
# Soulever un Landscape de 150 km serait un risque pris pour une symetrie que
# rien ne consomme.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io
import os

RAPPORT = "E:/narvosprime-web-prototype/.hermes/foret_posee.txt"
APPLIQUER = os.environ.get("NARVOS_POSER_APPLIQUER") == "1"

PAQUET = "ForestKitONE"
CIBLE_X = -8513420.0
CIBLE_Y = 8385420.0

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))

def ecrire():
    io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
    unreal.log("[NARVOS] ecrit : " + RAPPORT)


monde = unreal.EditorLevelLibrary.get_editor_world()
dire("=== POSE DE LA FORET ===" + ("" if APPLIQUER else "   (MESURE — NARVOS_POSER_APPLIQUER=1 pour ecrire)"))

# ── 1. Les acteurs du paquet ─────────────────────────────────────────────────
acteurs = []
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    try:
        pkg = a.get_outermost().get_name()
    except Exception:
        continue
    if PAQUET in pkg:
        acteurs.append(a)

dire("")
dire("%d acteur(s) du paquet %s" % (len(acteurs), PAQUET))
if not acteurs:
    dire("ARRET : le sous-niveau n'est pas monte, ou il est vide.")
    ecrire()
    raise SystemExit

xs = [a.get_actor_location().x for a in acteurs]
ys = [a.get_actor_location().y for a in acteurs]
cx = (min(xs) + max(xs)) / 2.0
cy = (min(ys) + max(ys)) / 2.0
dx = CIBLE_X - cx
dy = CIBLE_Y - cy

dire("  emprise X   %.0f .. %.0f" % (min(xs), max(xs)))
dire("  emprise Y   %.0f .. %.0f" % (min(ys), max(ys)))
dire("  centre      (%.0f, %.0f)" % (cx, cy))
dire("  cible       (%.0f, %.0f)" % (CIBLE_X, CIBLE_Y))
dire("  decalage    (%.0f, %.0f, 0)" % (dx, dy))

# ── 2. La transformation de niveau en place ──────────────────────────────────
# ⚠ `level_transform` VIT SUR `LevelStreaming`, PAS SUR `Level`.
#
# Premiere version : `EditorLevelUtils.get_levels(monde)`, qui rend des objets
# `Level`. Lire `level_transform` dessus leve « Level: Failed to find property
# 'level_transform' », et le garde-fou a REFUSE de deplacer les acteurs — a
# raison : sans pouvoir annuler la transformation, le decalage aurait ete
# applique DEUX FOIS au chargement et la foret serait partie a 17 000 km.
#
# La voie qui marche : `GameplayStatics.get_streaming_level(monde, nom)`, qui
# accepte le nom court comme le chemin complet et rend bien un
# `LevelStreamingAlwaysLoaded`.
flux = None
try:
    flux = unreal.GameplayStatics.get_streaming_level(monde, PAQUET)
except Exception as e:
    dire("  get_streaming_level a leve : %s" % str(e)[:70])

dire("")
dire("  niveau trouve : %s" % (flux.get_class().get_name() if flux is not None else "NON"))

if not APPLIQUER:
    dire("")
    dire("=== CE QUI SERAIT FAIT ===")
    dire("  1. level_transform remise a l'identite (sinon double decalage)")
    dire("  2. les %d acteurs deplaces de (%.0f, %.0f, 0)" % (len(acteurs), dx, dy))
    dire("  3. raycast de controle sur le sol")
    dire("")
    dire("Rien ecrit.")
    ecrire()
    raise SystemExit

# ── 3. Annuler la transformation de niveau ───────────────────────────────────
#
# ⚠ AVANT le deplacement. Si le processus s'arretait entre les deux, mieux vaut
# une foret restee a l'origine (visible, corrigeable) qu'une foret decalee deux
# fois (introuvable).
if flux is not None:
    try:
        flux.set_editor_property("level_transform", unreal.Transform())
        relu = flux.get_editor_property("level_transform").translation
        dire("")
        dire("  transformation remise a : (%.0f, %.0f, %.0f)" % (relu.x, relu.y, relu.z))
    except Exception as e:
        dire("")
        dire("  ⚠ transformation NON remise a zero : %s" % str(e)[:70])
        dire("    ARRET — deplacer les acteurs maintenant donnerait un DOUBLE decalage.")
        ecrire()
        raise SystemExit

# ── 4. Deplacement ───────────────────────────────────────────────────────────
dire("")
dire("=== DEPLACEMENT ===")
deplaces, echecs = 0, 0
for a in acteurs:
    p = a.get_actor_location()
    try:
        a.set_actor_location(unreal.Vector(p.x + dx, p.y + dy, p.z), False, False)
        deplaces += 1
    except Exception as e:
        if echecs < 5:
            dire("  ECHEC %-30s %s" % (a.get_actor_label()[:30], str(e)[:50]))
        echecs += 1
dire("  %d deplace(s), %d echec(s)" % (deplaces, echecs))

# ── 5. Recomptage — seule preuve ─────────────────────────────────────────────
xs2 = [a.get_actor_location().x for a in acteurs]
ys2 = [a.get_actor_location().y for a in acteurs]
cx2 = (min(xs2) + max(xs2)) / 2.0
cy2 = (min(ys2) + max(ys2)) / 2.0
dire("")
dire("=== RECOMPTAGE ===")
dire("  nouveau centre : (%.0f, %.0f)" % (cx2, cy2))
dire("  conforme       : %s" % ("oui" if abs(cx2 - CIBLE_X) < 2.0 and abs(cy2 - CIBLE_Y) < 2.0 else "NON"))

# Le Landscape a-t-il suivi ? C'est lui qui portait tout l'interet du
# sous-niveau, et c'est l'acteur le plus susceptible de refuser un deplacement.
for a in acteurs:
    if "Landscape" in a.get_class().get_name():
        p = a.get_actor_location()
        dire("  Landscape %-14s -> (%.0f, %.0f, %.0f)" % (a.get_actor_label()[:14], p.x, p.y, p.z))

# ── 6. Le sol repond-il ? ────────────────────────────────────────────────────
dire("")
dire("=== RAYCAST DE CONTROLE ===")
sols = []
for ddx, ddy in ((0, 0), (5000, 0), (-5000, 0), (0, 5000), (0, -5000), (10000, 10000)):
    debut = unreal.Vector(CIBLE_X + ddx, CIBLE_Y + ddy, 30000.0)
    fin = unreal.Vector(CIBLE_X + ddx, CIBLE_Y + ddy, -30000.0)
    r = unreal.SystemLibrary.line_trace_single(
        monde, debut, fin, unreal.TraceTypeQuery.TRACE_TYPE_QUERY1, False, [],
        unreal.DrawDebugTrace.NONE, True)
    if r:
        z = r.to_tuple()[4].z
        sols.append(z)
        dire("  (%+7d, %+7d)  sol Z = %9.1f" % (ddx, ddy, z))
    else:
        dire("  (%+7d, %+7d)  AUCUN SOL" % (ddx, ddy))

if sols:
    sols.sort()
    med = sols[len(sols) // 2]
    dire("")
    dire("  %d/%d sonde(s) touchent. min %.1f  median %.1f  max %.1f" % (
        len(sols), 6, sols[0], med, sols[-1]))
    dire("")
    dire("  A ECRIRE dans Shared/Catalogs/Mondes.lua :")
    dire("    CENTRES.foret = Vector(%.0f, %.0f, %.0f)" % (CIBLE_X, CIBLE_Y, med))
    dire("    arrivee       = Vector(%.0f, %.0f, %.0f)   -- sol %.0f + 1 m" % (
        CIBLE_X, CIBLE_Y, med + 100, med))
else:
    dire("")
    dire("  ⚠ AUCUNE sonde ne touche. Le Landscape n'a pas de collision a cet")
    dire("    endroit, ou il n'a pas suivi le deplacement. NE PAS declarer de")
    dire("    point d'arrivee : le joueur tomberait sans fin.")

unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
sales = len(unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages() or [])
dire("  sauvegarde : %d map(s) sale(s) restante(s)" % sales)

ecrire()