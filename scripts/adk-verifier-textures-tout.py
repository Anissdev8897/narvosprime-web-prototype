# ══════════════════════════════════════════════════════════════════════════════
# adk-verifier-textures-tout.py — inventaire des meshes GRIS, tout le pack.
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="…"
#
# `NARVOS_RACINE` : chemin de package (défaut `/Game/Narvos`)
#
# ── CE QU'IL RÉPOND ───────────────────────────────────────────────────────────
# « Est-ce que TOUS nos modèles — véhicules, armes, personnages, décor — ont
# leurs textures ? » Et surtout : lesquels ne les ont pas, et dans quel dossier.
#
# ── POURQUOI IL REGROUPE PAR DOSSIER ──────────────────────────────────────────
# Un total ne sert à rien. « 312 meshes gris » n'oriente vers aucune action ;
# « 312 meshes gris, tous dans `vehicule/` » désigne un pack à réimporter. Le
# dossier de premier niveau sous la racine EST l'unité d'action, puisque c'est
# ce qu'on réimporte ou rebranche d'un bloc.
#
# ── LES DEUX CLASSES, PAS UNE ─────────────────────────────────────────────────
# `adk-verifier-textures.py` ne voit que les SkeletalMesh, celui de la map que
# les StaticMesh. Un véhicule peut être l'un ou l'autre selon son import : ne
# regarder qu'une classe donnerait un rapport vert sur un pack entièrement gris.
#
# ── LA MÉTHODE : LES DÉPENDANCES DE PAQUET ────────────────────────────────────
# Un `Material` brut ne publie pas `texture_parameter_values` (ses textures sont
# câblées dans le graphe) ; une `MaterialInstance` oui. Le registre d'assets, lui,
# connaît les dépendances des deux. On compte donc les `Texture2D` dont dépend le
# paquet du matériau — sans dépendre d'une convention de nommage ni du type de
# matériau.
# ══════════════════════════════════════════════════════════════════════════════

import json
import os
from collections import defaultdict

import unreal

RACINE = os.environ.get("NARVOS_RACINE", "/Game/Narvos").replace("\\", "/").strip().rstrip("/")
SORTIE = os.environ.get(
    "NARVOS_TEXTURES_SORTIE",
    "E:/narvosprime-web-prototype/WebPortal/Server/adk/_textures-tout.json",
)

# ── JUGER SUR LE CHEMIN, PAS SUR LE NOM ──────────────────────────────────────
# Première version de ce script : `DEFAUTS = {"WorldGridMaterial", …}`, comparé
# au NOM du matériau. Il a rendu 7 faux positifs sur la Forge — les meshes
# pointaient un matériau de PROJET, dûment texturé, qui portait simplement le
# même nom que celui du moteur.
#
# C'est la faute que ce dépôt paie en boucle : classer par nom au lieu de la
# nature de la chose (cf. les 611 SkeletalMesh dont 44 seulement portaient `SK_`).
# Le critère juste est le CHEMIN : un matériau du moteur vit sous `/Engine/`.
PREFIXE_MOTEUR = "/Engine/"

# Noms réservés du moteur. Un asset de PROJET qui les porte n'est pas gris pour
# autant, mais il crée un homonyme dont rien ne garantit lequel gagne au montage
# du pack — c'est un RISQUE, signalé à part, pas une panne constatée.
NOMS_RESERVES = {"WorldGridMaterial", "DefaultMaterial", "DefaultDeferredDecalMaterial"}


def journal(message):
    unreal.log("[NARVOS] " + message)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
options = unreal.AssetRegistryDependencyOptions(include_hard_package_references=True)

cache = {}


def textures_du_materiau(paquet):
    """Nombre de Texture2D dont dépend le paquet d'un matériau."""
    if paquet in cache:
        return cache[paquet]
    total = 0
    try:
        deps = registre.get_dependencies(unreal.Name(paquet), options) or []
    except Exception:
        deps = []
    for dep in deps:
        for d in registre.get_assets_by_package_name(dep) or []:
            if str(d.asset_class_path.asset_name) == "Texture2D":
                total += 1
    cache[paquet] = total
    return total


def dossier_de(paquet):
    """Dossier de premier niveau sous la racine — l'unité qu'on réimporte."""
    p = str(paquet)
    if not p.startswith(RACINE + "/"):
        return "(hors racine)"
    reste = p[len(RACINE) + 1:]
    return reste.split("/")[0] if "/" in reste else "(racine)"


actifs = registre.get_assets_by_path(RACINE, recursive=True)
meshes = [d for d in actifs
          if str(d.asset_class_path.asset_name) in ("StaticMesh", "SkeletalMesh")]

journal("%d mesh(es) sous %s" % (len(meshes), RACINE))

stats = defaultdict(lambda: {"meshes": 0, "ok": 0, "sans_slot": 0, "defaut": 0, "sans_texture": 0,
                             "homonyme": 0, "exemples": []})

for donnees in meshes:
    paquet = str(donnees.package_name)
    dossier = dossier_de(paquet)
    s = stats[dossier]
    s["meshes"] += 1

    mesh = donnees.get_asset()
    if mesh is None:
        continue
    nom = str(donnees.asset_name)
    classe = str(donnees.asset_class_path.asset_name)

    # Les deux classes ne nomment pas leurs slots pareil.
    if classe == "StaticMesh":
        slots = mesh.get_editor_property("static_materials") or []
        interfaces = [x.get_editor_property("material_interface") for x in slots]
    else:
        slots = mesh.get_editor_property("materials") or []
        interfaces = [x.get_editor_property("material_interface") for x in slots]

    if len(interfaces) == 0:
        s["sans_slot"] += 1
        if len(s["exemples"]) < 6:
            s["exemples"].append("SANS SLOT  " + nom)
        continue

    propre = True
    for interface in interfaces:
        if interface is None:
            s["defaut"] += 1
            propre = False
            if len(s["exemples"]) < 6:
                s["exemples"].append("SLOT VIDE  " + nom)
            continue
        nom_mat = interface.get_name()
        chemin_mat = interface.get_path_name().split(".")[0]

        # Matériau du MOTEUR : le mesh est réellement gris.
        if chemin_mat.startswith(PREFIXE_MOTEUR):
            s["defaut"] += 1
            propre = False
            if len(s["exemples"]) < 6:
                s["exemples"].append("MOTEUR     " + nom + " (" + chemin_mat + ")")
            continue

        # Matériau de projet portant un nom réservé : pas gris, mais homonyme.
        if nom_mat in NOMS_RESERVES:
            s["homonyme"] += 1
            if len(s["exemples"]) < 6:
                s["exemples"].append("HOMONYME   " + nom + " (" + chemin_mat + ")")

        if textures_du_materiau(chemin_mat) == 0:
            s["sans_texture"] += 1
            propre = False
            if len(s["exemples"]) < 6:
                s["exemples"].append("0 TEXTURE  " + nom + " (" + nom_mat + ")")

    if propre:
        s["ok"] += 1

# ── Rapport ───────────────────────────────────────────────────────────────────

lignes = []
for dossier in sorted(stats, key=lambda d: -(stats[d]["meshes"] - stats[d]["ok"])):
    s = stats[dossier]
    gris = s["meshes"] - s["ok"]
    lignes.append({"dossier": dossier, "meshes": s["meshes"], "ok": s["ok"], "gris": gris,
                   "sans_slot": s["sans_slot"], "defaut": s["defaut"],
                   "sans_texture": s["sans_texture"], "homonyme": s["homonyme"],
                   "exemples": s["exemples"]})

total_meshes = sum(l["meshes"] for l in lignes)
total_ok = sum(l["ok"] for l in lignes)

journal("")
journal("=== BILAN  %d mesh(es), %d OK, %d a probleme" % (total_meshes, total_ok, total_meshes - total_ok))
journal("")
journal("  %-34s %7s %7s %7s" % ("dossier", "meshes", "OK", "gris"))
for l in lignes:
    if l["gris"] == 0 and l["meshes"] < 20:
        continue
    journal("  %-34s %7d %7d %7d" % (l["dossier"], l["meshes"], l["ok"], l["gris"]))

journal("")
for l in lignes:
    if l["gris"] == 0 and l["homonyme"] == 0:
        continue
    journal("--- %s : %d gris (materiau moteur %d, 0 texture %d, sans slot %d) — homonymes %d"
            % (l["dossier"], l["gris"], l["defaut"], l["sans_texture"], l["sans_slot"], l["homonyme"]))
    for e in l["exemples"]:
        journal("      " + e)

os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
with open(SORTIE, "w", encoding="utf-8") as fh:
    json.dump({"racine": RACINE, "total": total_meshes, "ok": total_ok, "dossiers": lignes}, fh, indent=1)

journal("")
journal("ecrit : " + SORTIE)