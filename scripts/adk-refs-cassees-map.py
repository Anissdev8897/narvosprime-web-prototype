# ══════════════════════════════════════════════════════════════════════════════
# adk-refs-cassees-map.py — parmi les assets casses, lesquels la MAP utilise ?
#
#   exec(open(r"...\adk-refs-cassees-map.py", encoding="utf-8").read())
#
# ⚠ AUCUNE ECRITURE.
#
# ── POURQUOI CETTE MESURE AVANT DE REPARER ───────────────────────────────────
# 2 376 assets promus portent une dependance morte. Mais la consigne est
# precise : « le plus important c'est que toutes les textures soient presentes
# dans notre map ». Reparer dans l'ordre du registre, c'est passer des heures sur
# des assets qu'aucun acteur ne porte — un pack de demo, une variante non posee.
#
# On part donc des ACTEURS de `Map_Narvos` et de ses sous-niveaux, on remonte
# leurs meshes, leurs materiaux et les parents de ceux-ci, et on croise avec la
# liste des casses. Ce qui tombe dans l'intersection est ce qui se voit.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io
import json
from collections import Counter

RAPPORT = "E:/narvosprime-web-prototype/.hermes/refs_map.txt"
SORTIE = "E:/narvosprime-web-prototype/.hermes/refs_map.json"

ANCIENNES = ("/Game/OpenWorlds", "/Game/CITY_PACK", "/Game/SpaceScenes",
             "/Game/Defender", "/Game/SmartLocomotion")

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))


registre = unreal.AssetRegistryHelpers.get_asset_registry()
options = unreal.AssetRegistryDependencyOptions(include_hard_package_references=True)

connu = {}
def existe(p):
    if p not in connu:
        connu[p] = unreal.EditorAssetLibrary.does_asset_exist(p)
    return connu[p]


dire("=== CE QUE LA MAP UTILISE ===")

# ── 1. Les assets que les acteurs portent, directement ──────────────────────
acteurs = unreal.EditorLevelLibrary.get_all_level_actors()
dire("")
dire("%d acteur(s) dans le monde (persistant + sous-niveaux)" % len(acteurs))

directs = set()
for a in acteurs:
    for c in a.get_components_by_class(unreal.StaticMeshComponent):
        m = c.static_mesh
        if m is not None:
            directs.add(m.get_path_name().split(".")[0])
        for i in range(c.get_num_materials()):
            mm = c.get_material(i)
            if mm is not None:
                directs.add(mm.get_path_name().split(".")[0])
    for c in a.get_components_by_class(unreal.SkeletalMeshComponent):
        try:
            m = c.get_editor_property("skeletal_mesh")
        except Exception:
            m = None
        if m is not None:
            directs.add(m.get_path_name().split(".")[0])

dire("  %d asset(s) portes directement par un acteur" % len(directs))

# ── 2. Fermeture transitive, bornee ─────────────────────────────────────────
#
# On descend les dependances : mesh -> materiau -> parent -> texture. Trois
# niveaux suffisent pour cette chaine, et borner evite de ramasser tout le
# projet par un Blueprint qui reference une map.
vus = set(directs)
front = set(directs)
for profondeur in range(3):
    suivant = set()
    for p in front:
        for dep in (registre.get_dependencies(p, options) or []):
            s = str(dep)
            if not s.startswith("/Game/"):
                continue
            if s not in vus:
                vus.add(s)
                suivant.add(s)
    dire("  niveau %d : +%d asset(s)" % (profondeur + 1, len(suivant)))
    front = suivant

dire("  %d asset(s) dans la fermeture de la map" % len(vus))

# ── 3. Croisement avec les casses ───────────────────────────────────────────
casses_map = []
par_classe = Counter()
cibles = Counter()

for p in sorted(vus):
    if not p.startswith("/Game/Narvos"):
        continue
    morts = []
    for dep in (registre.get_dependencies(p, options) or []):
        s = str(dep)
        if not any(s.startswith(a + "/") for a in ANCIENNES):
            continue
        if not existe(s):
            morts.append(s)
            cibles[s] += 1
    if morts:
        d = registre.get_asset_by_object_path(p + "." + p.split("/")[-1])
        try:
            cl = str(d.asset_class_path.asset_name)
        except Exception:
            cl = "?"
        par_classe[cl] += 1
        casses_map.append({"asset": p, "classe": cl, "morts": morts})

dire("")
dire("=== INTERSECTION ===")
dire("  %d asset(s) UTILISES PAR LA MAP portent une dependance morte" % len(casses_map))
dire("  %d cible(s) morte(s) distincte(s)" % len(cibles))
dire("")
dire("=== PAR CLASSE ===")
for k, v in par_classe.most_common(14):
    dire("  %-34s %6d" % (k, v))

retrouvables = sum(1 for c in cibles if existe("/Game/Narvos" + c[len("/Game"):]))
dire("")
dire("  %d / %d cible(s) existent au chemin miroir" % (retrouvables, len(cibles)))

dire("")
dire("=== LES PLUS CITEES DANS LA MAP ===")
for k, v in cibles.most_common(12):
    dire("  %-62s x%d" % (k[:62], v))

json.dump(casses_map, io.open(SORTIE, "w", encoding="utf-8"), indent=1)
dire("")
dire("liste ecrite : %s" % SORTIE)

io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
unreal.log("[NARVOS] ecrit : " + RAPPORT)