# ══════════════════════════════════════════════════════════════════════════════
# adk-dumper-parents-source.py — relever, dans le projet SOURCE, le parent de
# chaque MaterialInstance.
#
#   UnrealEditor-Cmd.exe "<GameAnimationSample>.uproject" -run=pythonscript \
#       -script=".../adk-dumper-parents-source.py"
#
# ⚠ LECTURE SEULE. Ce script n'ecrit rien dans le projet source.
#
# ── POURQUOI ─────────────────────────────────────────────────────────────────
# 141 MaterialInstance de l'ADK n'ont plus de parent : elles viennent de
# `GameAnimationSample`, copiees de `/Game/<X>` vers `/Game/Narvos/<X>`, et un
# `.uasset` porte son chemin de package EN DUR — les references ne resolvent plus.
#
# Deviner le parent par convention de nom a echoue sur ces 141 : `M_Hair`,
# `M_PeachFuzz`, `M_CoreC_Base_M_Body` n'existent NI dans l'ADK NI dans la
# source. Leurs vrais parents portent d'autres noms, ou vivent dans un plugin.
#
# Plutot que d'inventer, on va LIRE la reponse la ou elle est encore juste : le
# projet source, ou les memes instances ont garde leur parent.
#
# Le fichier produit sert d'entree a `adk-appliquer-parents-source.py`, qui
# traduit `/Game/<X>` en `/Game/Narvos/<X>` et ne pose que ce qui existe.
# ══════════════════════════════════════════════════════════════════════════════

import json
import os

import unreal

SORTIE = os.environ.get(
    "NARVOS_PARENTS_SOURCE",
    "E:/narvosprime-web-prototype/WebPortal/Server/adk/_parents-source.json",
)


def journal(m):
    unreal.log("[NARVOS] " + m)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)

instances = [d for d in registre.get_assets_by_path("/Game", recursive=True)
             if str(d.asset_class_path.asset_name) == "MaterialInstanceConstant"]

journal("%d MaterialInstanceConstant dans le projet source" % len(instances))

table = {}
sans_parent = 0
illisibles = 0

for d in instances:
    paquet = str(d.package_name)
    a = d.get_asset()
    if a is None:
        illisibles += 1
        continue
    try:
        p = a.get_editor_property("parent")
    except Exception:
        illisibles += 1
        continue
    if p is None:
        sans_parent += 1
        continue
    # `get_path_name()` rend `/Game/X/M_Y.M_Y` : on ne garde que le paquet.
    table[paquet] = p.get_path_name().split(".")[0]

journal("%d parent(s) releve(s), %d sans parent a la source, %d illisible(s)"
        % (len(table), sans_parent, illisibles))

os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
with open(SORTIE, "w", encoding="utf-8") as fh:
    json.dump({"total": len(instances), "parents": table}, fh, indent=1)

journal("ecrit : " + SORTIE)