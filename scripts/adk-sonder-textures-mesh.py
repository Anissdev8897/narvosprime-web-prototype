# ══════════════════════════════════════════════════════════════════════════════
# adk-sonder-textures-mesh.py — de QUELLES textures dépend vraiment un mesh ?
#
#   NARVOS_RACINE=/Game/Narvos/pnj_monstre \
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="…"
#
# ── POURQUOI CE SONDAGE EXISTE ────────────────────────────────────────────────
# `adk-verifier-textures-tout.py` comptait « le paquet du matériau dépend-il d'au
# moins une Texture2D ». Ce critère est FAUX, et il a produit un rapport vert sur
# des monstres gris en jeu.
#
# La raison : un `Material` d'Unreal dépend TOUJOURS de quelques textures du
# MOTEUR — `T_White_srgb`, `T_White_Linear`, `T_Generic_N`,
# `T_Anisotropy_Direction_Linear` — que le graphe utilise comme valeurs de repli.
# Un matériau entièrement vide en référence donc trois ou quatre, et passait le
# contrôle.
#
# Ce script sépare les deux : textures du PROJET d'un côté, textures du MOTEUR de
# l'autre. Un mesh dont toutes les textures sont du moteur est gris, quoi qu'en
# dise un total.
#
# C'est la même faute que celle déjà consignée : juger sur un proxy commode
# plutôt que sur la chose. Elle s'est reproduite ici parce que le proxy avait
# l'air spécifique.
# ══════════════════════════════════════════════════════════════════════════════

import json
import os

import unreal

RACINE = os.environ.get("NARVOS_RACINE", "/Game/Narvos/pnj_monstre").replace("\\", "/").strip()
SORTIE = os.environ.get(
    "NARVOS_SONDAGE_SORTIE",
    "E:/narvosprime-web-prototype/WebPortal/Server/adk/_sondage-textures.json",
)
LIMITE = int(os.environ.get("NARVOS_LIMITE", "40"))


def journal(message):
    unreal.log("[NARVOS] " + message)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
options = unreal.AssetRegistryDependencyOptions(include_hard_package_references=True)

cache = {}


def textures_du_materiau(paquet):
    """(textures du projet, textures du moteur) dont dépend ce matériau."""
    if paquet in cache:
        return cache[paquet]
    projet, moteur = [], []
    try:
        deps = registre.get_dependencies(unreal.Name(paquet), options) or []
    except Exception:
        deps = []
    for dep in deps:
        for d in registre.get_assets_by_package_name(dep) or []:
            if str(d.asset_class_path.asset_name) != "Texture2D":
                continue
            chemin = str(d.package_name)
            (moteur if chemin.startswith("/Engine/") else projet).append(str(d.asset_name))
    cache[paquet] = (projet, moteur)
    return cache[paquet]


meshes = [d for d in registre.get_assets_by_path(RACINE, recursive=True)
          if str(d.asset_class_path.asset_name) in ("StaticMesh", "SkeletalMesh")]

journal("%d mesh(es) sous %s" % (len(meshes), RACINE))

lignes = []
gris = 0
for donnees in sorted(meshes, key=lambda d: str(d.asset_name)):
    mesh = donnees.get_asset()
    if mesh is None:
        continue
    nom = str(donnees.asset_name)
    classe = str(donnees.asset_class_path.asset_name)
    champ = "static_materials" if classe == "StaticMesh" else "materials"

    total_projet, total_moteur, mats = 0, 0, []
    for slot in mesh.get_editor_property(champ) or []:
        interface = slot.get_editor_property("material_interface")
        if interface is None:
            mats.append("(slot vide)")
            continue
        paquet = interface.get_path_name().split(".")[0]
        p, m = textures_du_materiau(paquet)
        total_projet += len(p)
        total_moteur += len(m)
        mats.append("%s [projet %d, moteur %d]" % (interface.get_name(), len(p), len(m)))

    vraiment_gris = total_projet == 0
    if vraiment_gris:
        gris += 1
    lignes.append({"nom": nom, "classe": classe, "projet": total_projet,
                   "moteur": total_moteur, "gris": vraiment_gris, "materiaux": mats})

journal("")
journal("=== %d mesh(es), %d SANS AUCUNE texture de projet" % (len(lignes), gris))
journal("")
for l in lignes[:LIMITE]:
    marque = "GRIS " if l["gris"] else "  ok "
    journal("%s %-40s projet=%-3d moteur=%-3d  %s"
            % (marque, l["nom"][:40], l["projet"], l["moteur"], " | ".join(l["materiaux"][:2])))
if len(lignes) > LIMITE:
    journal("  … et %d autre(s)" % (len(lignes) - LIMITE))

os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
with open(SORTIE, "w", encoding="utf-8") as fh:
    json.dump({"racine": RACINE, "total": len(lignes), "gris": gris, "meshes": lignes}, fh, indent=1)
journal("")
journal("ecrit : " + SORTIE)