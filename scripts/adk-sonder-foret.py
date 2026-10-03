# ══════════════════════════════════════════════════════════════════════════════
# adk-sonder-foret.py — que faut-il encore pour la map forêt ?
#
#   exec(open(r"...\adk-sonder-foret.py", encoding="utf-8").read())
#
# ⚠ AUCUNE ECRITURE. Il compte, il ne touche à rien.
#
# La question précise : `Narvos/OpenWorlds` porte 581 assets et ZERO `.umap`.
# Or c'est le NIVEAU qui porte le Landscape — un Landscape ne se copie pas entre
# niveaux, seul un sous-niveau le garde intact. Sans le `.umap` sous `Narvos/`,
# le pack ne le verra jamais : le builder ne prend que ce dossier.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io

SORTIE = "E:/narvosprime-web-prototype/.hermes/diag_foret.txt"

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))


ar = unreal.AssetRegistryHelpers.get_asset_registry()

def compter(racine):
    """Compte par classe sous une racine, sans charger les assets."""
    par_classe = {}
    for a in ar.get_assets_by_path(racine, recursive=True):
        c = str(a.asset_class_path.asset_name)
        par_classe[c] = par_classe.get(c, 0) + 1
    return par_classe


dire("=== SOURCE  /Game/OpenWorlds ===")
src = compter("/Game/OpenWorlds")
for c, n in sorted(src.items(), key=lambda kv: -kv[1])[:12]:
    dire("  %-32s %5d" % (c, n))
dire("  TOTAL %d" % sum(src.values()))

dire("")
dire("=== PROMU  /Game/Narvos/OpenWorlds ===")
dst = compter("/Game/Narvos/OpenWorlds")
for c, n in sorted(dst.items(), key=lambda kv: -kv[1])[:12]:
    dire("  %-32s %5d" % (c, n))
dire("  TOTAL %d" % sum(dst.values()))

dire("")
dire("=== CE QUI MANQUE, PAR CLASSE ===")
for c in sorted(set(src) | set(dst)):
    a, b = src.get(c, 0), dst.get(c, 0)
    if a > b:
        dire("  %-32s source %5d  promu %5d  MANQUE %5d" % (c, a, b, a - b))

# ── Le niveau forêt : que contient-il vraiment ? ─────────────────────────────
#
# On ne charge PAS le niveau (ça détruirait les modifications non sauvegardées
# du niveau courant). On lit ses dépendances dans le registre : c'est ce que
# `migrate_packages` aurait dû emporter.
dire("")
dire("=== NIVEAUX de /Game/OpenWorlds ===")
for a in ar.get_assets_by_path("/Game/OpenWorlds", recursive=True):
    if str(a.asset_class_path.asset_name) != "World":
        continue
    nom = str(a.package_name)
    deps = ar.get_dependencies(nom, unreal.AssetRegistryDependencyOptions()) or []
    hors = [str(d) for d in deps if not str(d).startswith("/Game/Narvos")
            and str(d).startswith("/Game")]
    dire("  %s" % nom)
    dire("     %d dependance(s), dont %d hors /Game/Narvos" % (len(deps), len(hors)))
    for d in hors[:8]:
        dire("       %s" % d)

# ── Map_Narvos a-t-elle deja des sous-niveaux ? ──────────────────────────────
dire("")
dire("=== SOUS-NIVEAUX de Map_Narvos ===")
monde = unreal.EditorLevelLibrary.get_editor_world()
if monde is None:
    dire("  (pas de monde charge)")
else:
    dire("  monde courant : %s" % monde.get_path_name())
    niveaux = monde.get_editor_property("streaming_levels") or []
    dire("  %d sous-niveau(x)" % len(niveaux))
    for n in niveaux:
        dire("    %s" % n.get_editor_property("world_asset"))

io.open(SORTIE, "w", encoding="utf-8").write(chr(10).join(lignes))
unreal.log("[NARVOS] ecrit : " + SORTIE)