# ══════════════════════════════════════════════════════════════════════════════
# adk-reparer-plan-gris.py — le plan de 4,6 km qui grise la capitale.
#
#   exec(open(r"...\adk-reparer-plan-gris.py", encoding="utf-8").read())
#
#   NARVOS_PLAN_APPLIQUER=1 pour ecrire ; sans, il MESURE.
#
# ── CE QU'ON A VU, ET CE QUE C'ETAIT ─────────────────────────────────────────
# Depuis le viewport, la capitale est une immense surface grise. Ce n'est ni un
# Landscape (les deux du niveau ont leurs 12 textures, 0 vide) ni une texture
# perdue a l'import. C'est UN acteur :
#
#   NARVOS_VILLE_BIG_CITY_NIGHT_1_0   Shape_Plane   6000 x 7000   M_Basic_Wall
#
# Soit un plan de 4 610 m portant le materiau de mur basique du moteur. Mesure
# des Z :
#   plan gris  Z = 156 949
#   plan d'eau Z = 157 485   (MI_Water_2, 5 m AU-DESSUS)
#
# L'eau n'est donc pas cassee : elle est transparente, et c'est le plan gris
# pose dessous qu'on voit a travers. Le cyan sur les bords, c'est la ou l'eau
# depasse du gris.
#
# ⚠ ON NE SUPPRIME PAS, ON NE MASQUE PAS. Ce plan est le FOND sous l'eau : le
# retirer laisserait voir le vide a travers une eau transparente, ce qui serait
# pire. On lui donne un fond de bassin.
#
# ── POURQUOI `MI_PIER_CONCRETE` ET PAS DU SABLE ──────────────────────────────
# Le candidat evident etait `M_AIRCAB_GROUND` : c'est du SABLE, et il est dans
# BIG_CITY. Il a ete ECARTE apres mesure de ses dependances — il tire
# `T_MacroVariation`, qui n'existe qu'a deux endroits :
#     /Game/CITY_PACK/DEMO/TEXTURES/          <- DirectoriesToNeverCook
#     /Game/AdvancedARPGCombat/.../StarterContent/   <- hors de Narvos/
# Aucun des deux ne part au cook. Le materiau serait donc correct dans
# l'editeur et amoindri en jeu — exactement le defaut « ca marche ici ».
#
# `MI_PIER_CONCRETE` : toutes ses textures sont promues sous `Narvos/`, il vient
# du meme dossier que les plans d'eau, et le pack le pose DEJA sur 72 acteurs de
# cette map. C'est le beton de quai de la ville portuaire — un fond de bassin.
# Choix derive du pack, pas invente.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io
import os

RAPPORT = "E:/narvosprime-web-prototype/.hermes/plan_gris.txt"
APPLIQUER = os.environ.get("NARVOS_PLAN_APPLIQUER") == "1"

CIBLE = "NARVOS_VILLE_BIG_CITY_NIGHT_1_0"
MAT = "/Game/Narvos/CITY_PACK/BIG_CITY/MATERIALS/MATERIAL_INSTANCES/MI_PIER_CONCRETE"

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))

def ecrire():
    io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
    unreal.log("[NARVOS] ecrit : " + RAPPORT)


dire("=== PLAN GRIS ===" + ("" if APPLIQUER else "   (MESURE — NARVOS_PLAN_APPLIQUER=1 pour ecrire)"))

mat = unreal.load_asset(MAT)
if mat is None:
    dire("ARRET : materiau introuvable — %s" % MAT)
    ecrire()
    raise SystemExit

acteur = None
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    if a.get_actor_label() == CIBLE:
        acteur = a
        break

if acteur is None:
    dire("ARRET : acteur introuvable — %s" % CIBLE)
    dire("  (a-t-il ete renomme ou supprime ?)")
    ecrire()
    raise SystemExit

comps = acteur.get_components_by_class(unreal.StaticMeshComponent)
if not comps:
    dire("ARRET : l'acteur n'a pas de StaticMeshComponent")
    ecrire()
    raise SystemExit

c = comps[0]


def noms_slots(comp):
    out = []
    for i in range(comp.get_num_materials()):
        m = comp.get_material(i)
        out.append(m.get_name() if m is not None else "VIDE")
    return out


loc = acteur.get_actor_location()
ech = acteur.get_actor_scale3d()
dire("")
dire("acteur     %s" % CIBLE)
dire("mesh       %s" % (c.static_mesh.get_name() if c.static_mesh else "?"))
dire("Z          %.0f" % loc.z)
dire("echelle    %.0f x %.0f x %.0f" % (ech.x, ech.y, ech.z))
dire("avant      %s" % ", ".join(noms_slots(c)))
dire("cible      MI_PIER_CONCRETE")

if not APPLIQUER:
    dire("")
    dire("Rien ecrit.")
    ecrire()
    raise SystemExit

for i in range(c.get_num_materials()):
    c.set_material(i, mat)

# ── Recomptage — seule preuve ────────────────────────────────────────────────
#
# ⚠ Une ecriture Unreal qui rate ne dit rien. On relit le composant plutot que
# de faire confiance a l'absence d'exception.
apres = noms_slots(c)
dire("")
dire("apres      %s" % ", ".join(apres))
ok = all(n == "MI_PIER_CONCRETE" for n in apres)
dire("verdict    %s" % ("POSE" if ok else "ECHEC — le composant n'a pas pris"))

if ok:
    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    sales = len(unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages() or [])
    dire("sauvegarde : %d map(s) sale(s) restante(s)" % sales)

ecrire()