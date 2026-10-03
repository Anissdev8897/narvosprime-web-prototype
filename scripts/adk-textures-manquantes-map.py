# ══════════════════════════════════════════════════════════════════════════════
# adk-textures-manquantes-map.py — ce qui MANQUE VRAIMENT dans la map.
#
#   exec(open(r"...\adk-textures-manquantes-map.py", encoding="utf-8").read())
#
# ⚠ AUCUNE ECRITURE.
#
# ── POURQUOI CETTE MESURE REMPLACE LA PRECEDENTE ─────────────────────────────
# Je comptais les « dependances mortes declarees » par chaque asset. Cette
# mesure SURESTIME, et je l'ai vu sur un cas :
#
#   MI_ApartmentHologram1 : UN seul parametre nul (`Mask`), mais QUATRE
#   dependances mortes declarees. Les trois autres parametres sont remplis et
#   pointent les textures promues — les entrees mortes sont des restes de la
#   table d'import du paquet, sans aucun effet a l'affichage.
#
# La question qui compte n'est pas « quelles references sont declarees » mais
# « qu'est-ce qui est VIDE ». On mesure donc l'etat fonctionnel :
#   · un slot de mesh sans materiau      -> gris a l'ecran
#   · un parametre de texture a NULL     -> canal manquant
#   · un noeud de texture a NULL         -> idem, dans un Material
#   · un parent d'instance a NULL        -> instance inutilisable
#
# Et on part des ACTEURS, pas du registre : ce qui n'est pose nulle part ne se
# voit pas, quel que soit son etat.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io
import json
from collections import Counter

RAPPORT = "E:/narvosprime-web-prototype/.hermes/textures_manquantes.txt"
SORTIE = "E:/narvosprime-web-prototype/.hermes/textures_manquantes.json"

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))


lib = unreal.MaterialEditingLibrary

dire("=== CE QUI MANQUE VRAIMENT DANS LA MAP ===")

acteurs = unreal.EditorLevelLibrary.get_all_level_actors()
dire("")
dire("%d acteur(s)" % len(acteurs))

# ── 1. Les slots de mesh vides, vus depuis les acteurs ──────────────────────
#
# Un composant peut surcharger le slot que l'ASSET laisse vide : c'est donc
# l'etat du COMPOSANT qui decide de ce qu'on voit, pas celui du mesh.
slots_vides = 0
acteurs_gris = []
materiaux = set()
for a in acteurs:
    for c in a.get_components_by_class(unreal.StaticMeshComponent):
        n = c.get_num_materials()
        v = 0
        for i in range(n):
            m = c.get_material(i)
            if m is None:
                v += 1
            else:
                materiaux.add(m.get_path_name().split(".")[0])
        if v:
            slots_vides += v
            o, e = a.get_actor_bounds(False)
            diag = (e.x * e.x + e.y * e.y + e.z * e.z) ** 0.5
            acteurs_gris.append({"acteur": a.get_actor_label(),
                                 "mesh": (c.static_mesh.get_name() if c.static_mesh else "?"),
                                 "vides": v, "total": n, "taille_m": round(diag / 100.0, 1)})

dire("")
dire("=== SLOTS DE MESH VIDES (gris a l'ecran) ===")
dire("  %d acteur(s), %d slot(s) vide(s)" % (len(acteurs_gris), slots_vides))
acteurs_gris.sort(key=lambda x: -x["taille_m"])
for x in acteurs_gris[:10]:
    dire("    %8.1f m  %-32s %-28s %d/%d vide(s)" % (
        x["taille_m"], x["acteur"][:32], x["mesh"][:28], x["vides"], x["total"]))
gros = [x for x in acteurs_gris if x["taille_m"] >= 20]
dire("  dont %d acteur(s) de 20 m ou plus" % len(gros))

# ── 2. Les materiaux poses : leurs canaux sont-ils remplis ? ────────────────
dire("")
dire("=== MATERIAUX REELLEMENT POSES DANS LA MAP ===")
dire("  %d materiau(x) distinct(s)" % len(materiaux))

inst_parent_nul = []
inst_params_nuls = []
mat_noeuds_nuls = []
n_inst = n_mat = 0

for p in sorted(materiaux):
    o = unreal.load_asset(p)
    if o is None:
        continue
    cl = o.get_class().get_name()
    if cl == "MaterialInstanceConstant":
        n_inst += 1
        try:
            if o.get_editor_property("parent") is None:
                inst_parent_nul.append(p)
        except Exception:
            pass
        try:
            nuls = [str(x.parameter_info.name) for x in o.get_editor_property("texture_parameter_values")
                    if x.parameter_value is None]
            if nuls:
                inst_params_nuls.append({"asset": p, "params": nuls})
        except Exception:
            pass
    elif cl == "Material":
        n_mat += 1
        try:
            vus = set()
            noeuds = []

            def marcher(n, prof=0):
                if n is None or prof > 12:
                    return
                k = n.get_path_name()
                if k in vus:
                    return
                vus.add(k)
                noeuds.append(n)
                try:
                    for e in (lib.get_inputs_for_material_expression(o, n) or []):
                        marcher(e, prof + 1)
                except Exception:
                    pass

            for nom in dir(unreal.MaterialProperty):
                if nom.startswith("MP_"):
                    try:
                        marcher(lib.get_material_property_input_node(o, getattr(unreal.MaterialProperty, nom)))
                    except Exception:
                        pass
            vides = 0
            for n in noeuds:
                if "Texture" not in n.get_class().get_name():
                    continue
                try:
                    if n.get_editor_property("texture") is None:
                        vides += 1
                except Exception:
                    pass
            if vides:
                mat_noeuds_nuls.append({"asset": p, "noeuds_vides": vides})
        except Exception:
            pass

dire("  dont %d instance(s) et %d materiau(x) de base" % (n_inst, n_mat))
dire("")
dire("=== CE QUI EST ENCORE VIDE ===")
dire("  instances SANS PARENT              %5d" % len(inst_parent_nul))
dire("  instances avec un parametre a NULL %5d  (%d parametre(s) au total)" % (
    len(inst_params_nuls), sum(len(x["params"]) for x in inst_params_nuls)))
dire("  Material avec un noeud a NULL      %5d  (%d noeud(s) au total)" % (
    len(mat_noeuds_nuls), sum(x["noeuds_vides"] for x in mat_noeuds_nuls)))

if inst_parent_nul:
    dire("")
    dire("  sans parent (les 10 premieres) :")
    for p in inst_parent_nul[:10]:
        dire("    %s" % p)

if inst_params_nuls:
    dire("")
    dire("  parametres nuls les plus frequents :")
    c = Counter()
    for x in inst_params_nuls:
        for n in x["params"]:
            c[n.strip()] += 1
    for k, v in c.most_common(12):
        dire("    %-34s %5d" % (k[:34], v))

json.dump({"acteurs_gris": acteurs_gris,
           "instances_sans_parent": inst_parent_nul,
           "instances_params_nuls": inst_params_nuls,
           "materiaux_noeuds_nuls": mat_noeuds_nuls},
          io.open(SORTIE, "w", encoding="utf-8"), indent=1)
dire("")
dire("detail ecrit : %s" % SORTIE)

io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
unreal.log("[NARVOS] ecrit : " + RAPPORT)