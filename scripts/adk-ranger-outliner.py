# ══════════════════════════════════════════════════════════════════════════════
# adk-ranger-outliner.py — ranger les acteurs de Map_Narvos en dossiers.
#
#   exec(open(r"...\adk-ranger-outliner.py", encoding="utf-8").read())
#
#   NARVOS_RANGER_APPLIQUER=1 pour ecrire ; sans, il MESURE et annonce le plan.
#
# ── LE CONSTAT ────────────────────────────────────────────────────────────────
# Mesure du 2026-09-09 : 15 559 StaticMeshActor dans le niveau, dont
# **13 513 a la racine** de l'Outliner. Une liste plate de treize mille lignes
# ne se lit pas : on ne peut ni retrouver un batiment, ni masquer un quartier,
# ni verifier qu'une copie a bien atterri.
#
# 1 873 acteurs sont DEJA dans `orbital`, 207 dans `Meshes`, 20 dans `Planets`.
#
# ⚠ ON NE DEPLACE RIEN DE CE QUI EST DEJA RANGE. Quelqu'un a construit cette
# arborescence a la main ; la refaire « proprement » effacerait son travail et
# son intention. On ne touche qu'aux acteurs SANS dossier.
#
# ── LE DOSSIER EST DERIVE DE L'ETIQUETTE, JAMAIS DEVINE ───────────────────────
# `adk-copier-ville-vers-narvos.py` a etiquete chaque acteur copie
# `NARVOS_VILLE_<MAP>_<n>`. Le nom de la map est donc DANS l'etiquette : on la
# lit, on ne la reconstruit pas depuis une position ou une liste recopiee.
#
# Les autres familles, relevees et non inventees :
#   NarvosEspace*   303   le decor spatial pose par nos scripts
#   SM_*            266   meshes poses a la main
#   -xxx            ~450  les acteurs du pack Halo (prefixe tiret, ex. -m45, -facade)
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io
import os
from collections import Counter

RAPPORT = "E:/narvosprime-web-prototype/.hermes/outliner_range.txt"
APPLIQUER = os.environ.get("NARVOS_RANGER_APPLIQUER") == "1"

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))

def ecrire():
    io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
    unreal.log("[NARVOS] ecrit : " + RAPPORT)


def dossier_pour(acteur):
    """Le dossier d'un acteur, deduit de son etiquette et de sa classe.

    Rend None quand aucune regle ne s'applique : mieux vaut laisser un acteur a
    la racine que l'enfouir dans un « Divers » ou personne n'ira le chercher.
    """
    classe = acteur.get_class().get_name()

    # Le terrain d'abord : c'est ce qu'on cherche le plus souvent, et ces
    # acteurs sont rares. Les noyer dans la masse leur ferait perdre leur
    # visibilite.
    if "Landscape" in classe:
        return "Terrain"
    if classe == "InstancedFoliageActor":
        return "Terrain/Vegetation"
    if classe in ("SphereReflectionCapture", "BoxReflectionCapture", "PlanarReflection"):
        return "Eclairage/Captures"
    if classe == "Emitter":
        return "Effets"

    lab = acteur.get_actor_label()

    if lab.startswith("NARVOS_VILLE_"):
        reste = lab[len("NARVOS_VILLE_"):]
        # `<MAP>_<n>` : on coupe au DERNIER souligne, le suffixe etant l'index.
        map_nom = reste.rsplit("_", 1)[0] if "_" in reste else reste
        return "Ville/" + map_nom

    if lab.startswith("NarvosEspace"):
        return "Espace/Narvos"

    if lab.startswith("BP_Mothership") or lab.startswith("BP_Spacestation") or lab.startswith("BP_electricity"):
        return "Espace/Structures"

    # Le pack Halo exporte ses acteurs avec un tiret en tete.
    if lab.startswith("-"):
        return "Espace/Halo"

    if lab.startswith("SM_"):
        return "Decor"

    return None


acteurs = unreal.EditorLevelLibrary.get_all_level_actors()
dire("=== RANGEMENT ===" + ("" if APPLIQUER else "   (MESURE — NARVOS_RANGER_APPLIQUER=1 pour ecrire)"))
dire("")
dire("%d acteur(s) dans le monde" % len(acteurs))

a_ranger = []
deja = 0
sans_regle = Counter()

for a in acteurs:
    try:
        actuel = a.get_folder_path()
        actuel = str(actuel) if actuel else ""
    except Exception:
        actuel = ""
    if actuel and actuel != "None":
        deja += 1
        continue
    cible = dossier_pour(a)
    if cible is None:
        sans_regle[a.get_actor_label().split("_")[0][:24]] += 1
        continue
    a_ranger.append((a, cible))

plan = Counter(c for _, c in a_ranger)

dire("  deja dans un dossier          %6d  (intouches)" % deja)
dire("  a ranger                      %6d" % len(a_ranger))
dire("  sans regle, laisses a la racine %4d" % sum(sans_regle.values()))

dire("")
dire("=== ARBORESCENCE PROPOSEE ===")
for k, v in sorted(plan.items()):
    dire("  %-34s %6d" % (k, v))

if sans_regle:
    dire("")
    dire("=== SANS REGLE (racine) — familles ===")
    for k, v in sans_regle.most_common(12):
        dire("  %-34s %6d" % (k, v))
    dire("  (laisses volontairement : un dossier « Divers » ne se consulte jamais)")

if not APPLIQUER:
    dire("")
    dire("Rien ecrit.")
    ecrire()
    raise SystemExit

# ── Pose ─────────────────────────────────────────────────────────────────────
dire("")
dire("=== POSE ===")
ranges, echecs = 0, 0
for a, cible in a_ranger:
    try:
        a.set_folder_path(cible)
        ranges += 1
    except Exception as e:
        if echecs < 5:
            dire("  ECHEC %s : %s" % (a.get_actor_label()[:40], str(e)[:50]))
        echecs += 1

dire("  %d range(s), %d echec(s)" % (ranges, echecs))

# ── Recomptage — seule preuve ────────────────────────────────────────────────
#
# ⚠ Une ecriture Unreal qui rate ne dit rien. On relit les dossiers.
final = Counter()
racine = 0
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    try:
        d = a.get_folder_path()
        d = str(d) if d else ""
    except Exception:
        d = ""
    if not d or d == "None":
        racine += 1
    else:
        final[d] += 1

dire("")
dire("=== RECOMPTAGE ===")
dire("  %d acteur(s) encore a la racine  (avant : 13 513)" % racine)
dire("  %d dossier(s) :" % len(final))
for k, v in sorted(final.items()):
    dire("    %-36s %6d" % (k, v))

unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
sales = len(unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages() or [])
dire("  sauvegarde : %d map(s) sale(s) restante(s)" % sales)

ecrire()