# ══════════════════════════════════════════════════════════════════════════════
# adk-sonder-slots-composants.py — l'asset ou le composant : lequel est vide ?
#
#   exec(open(r"...\adk-sonder-slots-composants.py", encoding="utf-8").read())
#
# ⚠ AUCUNE ECRITURE.
#
# ── LA QUESTION ──────────────────────────────────────────────────────────────
# `adk-reparer-refs.py` annonce 286 slots de mesh rebranches, 562 assets sauves,
# aucun refus — et sa relecture confirme que le materiau EST pose sur l'asset.
# Pourtant le comptage des slots vides vus depuis les ACTEURS ne bouge pas :
# 836 avant, 836 apres.
#
# Trois explications possibles, et il faut savoir laquelle :
#   1. le composant porte une SURCHARGE explicite a `None`, qui gagne sur
#      l'asset (`adk-copier-ville-vers-narvos.py` en pose une par slot) ;
#   2. le composant n'est pas un `StaticMeshComponent` ordinaire — un
#      `FoliageInstancedStaticMeshComponent` tire ses materiaux du FoliageType,
#      pas du mesh ;
#   3. l'asset n'est pas reellement ecrit et sa relecture mentait.
#
# On les distingue en lisant les TROIS etats cote a cote.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io
from collections import Counter

RAPPORT = "E:/narvosprime-web-prototype/.hermes/slots_composants.txt"

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))


classes = Counter()
diagnostics = Counter()
exemples = []

for a in unreal.EditorLevelLibrary.get_all_level_actors():
    for c in a.get_components_by_class(unreal.StaticMeshComponent):
        n = c.get_num_materials()
        vides = [i for i in range(n) if c.get_material(i) is None]
        if not vides:
            continue
        m = c.static_mesh
        classes[c.get_class().get_name()] += 1

        etat_asset = []
        if m is not None:
            try:
                for s in m.get_editor_property("static_materials"):
                    etat_asset.append(s.material_interface.get_name() if s.material_interface else "VIDE")
            except Exception:
                etat_asset = ["(illisible)"]

        etat_ov = []
        try:
            for x in (c.get_editor_property("override_materials") or []):
                etat_ov.append(x.get_name() if x is not None else "None")
        except Exception:
            etat_ov = ["(illisible)"]

        # Le verdict : l'asset porte-t-il ce que le composant ne montre pas ?
        asset_rempli = [i for i, v in enumerate(etat_asset) if v not in ("VIDE", "(illisible)")]
        masques = [i for i in vides if i in asset_rempli]
        if masques:
            diagnostics["asset REMPLI mais composant vide (surcharge)"] += len(masques)
        else:
            diagnostics["asset vide aussi"] += len(vides)

        if len(exemples) < 6:
            exemples.append({
                "acteur": a.get_actor_label(),
                "mesh": (m.get_name() if m else "?"),
                "classe": c.get_class().get_name(),
                "asset": etat_asset,
                "override": etat_ov,
                "composant": [(c.get_material(i).get_name() if c.get_material(i) else "VIDE")
                              for i in range(n)],
            })
        break

dire("=== CLASSES DE COMPOSANT CONCERNEES ===")
for k, v in classes.most_common(10):
    dire("  %-46s %6d" % (k, v))

dire("")
dire("=== VERDICT ===")
for k, v in diagnostics.most_common(6):
    dire("  %-46s %6d slot(s)" % (k, v))

dire("")
dire("=== EXEMPLES ===")
for e in exemples:
    dire("  %-30s %-24s %s" % (e["acteur"][:30], e["mesh"][:24], e["classe"]))
    dire("     asset     : %s" % str(e["asset"])[:110])
    dire("     override  : %s" % str(e["override"])[:110])
    dire("     composant : %s" % str(e["composant"])[:110])

io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
unreal.log("[NARVOS] ecrit : " + RAPPORT)