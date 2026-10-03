# -*- coding: utf-8 -*-
"""
adk-mesurer-personnages.py — taille ET textures de TOUS les personnages, lues
dans l'ADK. Ne modifie rien.

    python scripts/ue-remote.py --fichier scripts/adk-mesurer-personnages.py

── LA QUESTION, POSÉE PAR LE JOUEUR ──────────────────────────────────────────
Retour de jeu du 2026-09-12 : « la plupart des PNJ sont beaucoup trop grands »
et « beaucoup ont encore des textures manquantes ».

Deux sondes existaient, chacune borgne :
  · `adk-bornes-pnj.py` mesure la hauteur — mais seulement les 74 entrées de
    Spawnables.lua, et sa dernière passe date du 2026-09-05 : les 12 corps
    Defender/Trooper promus depuis n'ont JAMAIS été mesurés. Ce sont exactement
    ceux que le peuplement emploie aujourd'hui.
  · `adk-sonder-textures-mesh.py` sépare textures du PROJET et textures du
    MOTEUR (un matériau vide en référence toujours trois ou quatre : juger sur
    le total rend un rapport vert sur des monstres gris). Il ne mesure pas la
    taille.

Celle-ci fait les deux, sur le même balayage, et écrit un JSON pour que les
générateurs travaillent sur des mesures et non sur des souvenirs.

── ⚠ CE QUE CETTE SONDE NE PEUT PAS DIRE ─────────────────────────────────────
La hauteur lue ici est celle des BORNES DU MESH. Un squelette importé peut
porter une échelle sur son os racine : les bornes disent 1,7 cm, le rendu fait
1,7 m (en-tête de `narvos-map-proto/Client/Diagnostic.lua`). Seule la mesure EN
JEU (`/diag`, `Actor:GetBounds()` côté client) tranche ce cas.
Cette sonde donne donc une PRÉSOMPTION, jamais un verdict de rendu.
"""
import json
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

RACINE = "E:/narvosprime-web-prototype"
CATALOGUE = RACINE + "/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Spawnables.lua"
INDEX_SERVEUR = RACINE + "/WebPortal/Server/nanos_world/packages/narvos-map-proto/Server/Index.lua"
TOML = RACINE + "/WebPortal/Server/Assets/narvos/Assets.toml"
SORTIE = RACINE + "/WebPortal/Server/adk/_personnages-mesures.json"

# Familles modulaires à mesurer en plus des PNJ : ce sont les pièces que
# l'écran de création peut proposer, et une pièce grise s'y verrait autant.
PREFIXES = (
    "Narvos/Meshes/Trooper_Set/",
    # Les corps NUS du pack Trooper : la peau qui va sous l'armure. Ils vivent
    # dans un dossier voisin, pas dans Trooper_Set/ — les oublier, c'est mesurer
    # l'armure sans jamais mesurer ce qu'elle recouvre.
    "Narvos/Meshes/BodyForms/",
    "Narvos/Defender/Demo/Meshes/ModularMeshes/",
    "Narvos/MetaCustom/",
)

# Taille humaine plausible, en centimètres (mêmes bornes que adk-bornes-pnj.py).
HUMAIN_MIN, HUMAIN_MAX = 120.0, 260.0


def dire(t):
    print(t)
    unreal.log("[NARVOS] " + t)


# ── Ce qu'on va mesurer ───────────────────────────────────────────────────────

chemins = {}
with open(TOML, encoding="utf-8") as f:
    for ligne in f:
        m = re.match(r'\s*(?:"((?:[^"\\]|\\.)*)"|([A-Za-z0-9_\-]+))\s*=\s*"([^"]+)"', ligne)
        if m:
            cle = m.group(1) if m.group(1) is not None else m.group(2)
            chemins.setdefault(cle, m.group(3))

cibles = {}   # cle -> {origine, echelle}

with open(CATALOGUE, encoding="utf-8") as f:
    texte = f.read()
for bloc in re.finditer(r"\{[^{}]*?id\s*=\s*\"([^\"]+)\"[^{}]*?\}", texte, re.S):
    corps = bloc.group(0)
    m_asset = re.search(r'asset\s*=\s*"([^"]+)"', corps)
    if not m_asset:
        continue
    m_ech = re.search(r"echelle\s*=\s*([0-9.]+)", corps)
    cle = m_asset.group(1).split("::")[-1]
    cibles[cle] = {
        "origine": "spawnable:" + bloc.group(1),
        "echelle": float(m_ech.group(1)) if m_ech else 1.0,
    }

# Les corps qui incarnent les marchands : ils sont posés à l'échelle 1 autour de
# l'aire de spawn, donc en plein champ de vision du joueur qui arrive.
with open(INDEX_SERVEUR, encoding="utf-8") as f:
    for m in re.finditer(r'mer_[a-z_]+\s*=\s*"([a-z0-9_]+)"', f.read()):
        ident = m.group(1)
        for cle, ch in chemins.items():
            if cle.lower() == ident:
                cibles.setdefault(cle, {"origine": "marchand", "echelle": 1.0})

for cle, ch in chemins.items():
    if ch.startswith(PREFIXES):
        cibles.setdefault(cle, {"origine": "modulaire", "echelle": 1.0})

dire("%d asset(s) à mesurer (PNJ, marchands, pièces modulaires)" % len(cibles))

# ── Textures : projet contre moteur ───────────────────────────────────────────

registre = unreal.AssetRegistryHelpers.get_asset_registry()
options = unreal.AssetRegistryDependencyOptions(include_hard_package_references=True)
cache = {}


def textures_du_materiau(paquet):
    """(nb textures du projet, nb textures du moteur) pour ce matériau."""
    if paquet in cache:
        return cache[paquet]
    projet, moteur = 0, 0
    try:
        deps = registre.get_dependencies(unreal.Name(paquet), options) or []
    except Exception:
        deps = []
    for dep in deps:
        for d in registre.get_assets_by_package_name(dep) or []:
            if str(d.asset_class_path.asset_name) != "Texture2D":
                continue
            if str(d.package_name).startswith("/Engine/"):
                moteur += 1
            else:
                projet += 1
    cache[paquet] = (projet, moteur)
    return cache[paquet]


# ── Le balayage ───────────────────────────────────────────────────────────────

mesures = {}
absents, illisibles = [], []

for cle in sorted(cibles):
    chemin = chemins.get(cle)
    if not chemin:
        absents.append(cle)
        continue
    obj = unreal.EditorAssetLibrary.load_asset("/Game/" + chemin)
    if obj is None:
        illisibles.append(cle)
        continue

    classe = obj.get_class().get_name()
    champ = "static_materials" if classe == "StaticMesh" else "materials"

    hauteur = None
    try:
        hauteur = float(obj.get_bounds().box_extent.z) * 2.0
    except Exception:
        pass

    slots_vides, projet, moteur, noms = 0, 0, 0, []
    try:
        for slot in obj.get_editor_property(champ) or []:
            interface = slot.get_editor_property("material_interface")
            if interface is None:
                slots_vides += 1
                noms.append("(vide)")
                continue
            p, m = textures_du_materiau(interface.get_path_name().split(".")[0])
            projet += p
            moteur += m
            noms.append(interface.get_name())
    except Exception as err:
        noms.append("materiaux illisibles : %s" % err)

    mesures[cle] = {
        "chemin": chemin,
        "classe": classe,
        "origine": cibles[cle]["origine"],
        "echelle": cibles[cle]["echelle"],
        "hauteur": hauteur,
        "materiaux": len(noms),
        "slots_vides": slots_vides,
        "textures_projet": projet,
        "textures_moteur": moteur,
        "noms_materiaux": noms,
    }

# ── Verdicts ──────────────────────────────────────────────────────────────────

geants, poupees, gris, sains = [], [], [], []
for cle, m in mesures.items():
    if m["hauteur"] and m["hauteur"] > 0:
        en_jeu = m["hauteur"] * (m["echelle"] or 1.0)
        if en_jeu > HUMAIN_MAX * 3:
            geants.append((cle, en_jeu))
        elif en_jeu < HUMAIN_MIN / 3:
            poupees.append((cle, en_jeu))
    # Un mesh dont AUCUNE texture ne vient du projet est gris en jeu, quel que
    # soit le nombre de matériaux : les textures du moteur sont des replis.
    if m["materiaux"] > 0 and m["textures_projet"] == 0:
        gris.append(cle)
    elif m["slots_vides"] > 0:
        gris.append(cle)
    else:
        sains.append(cle)

dire("")
dire("=== BILAN ===")
dire("  mesurés        : %d" % len(mesures))
dire("  absents du pack: %d" % len(absents))
dire("  non chargeables: %d" % len(illisibles))
dire("  géants (bornes): %d" % len(geants))
dire("  poupées        : %d" % len(poupees))
dire("  gris / sans texture de projet : %d" % len(gris))

for cle in sorted(gris)[:60]:
    m = mesures[cle]
    dire("    GRIS  %-52s %2d materiau(x), %d slot(s) vide(s), moteur %d"
         % (cle, m["materiaux"], m["slots_vides"], m["textures_moteur"]))

for cle, h in sorted(geants, key=lambda t: -t[1])[:30]:
    dire("    GEANT %-52s %.1f m" % (cle, h / 100.0))

os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
with open(SORTIE, "w", encoding="utf-8") as f:
    json.dump({
        "mesures": mesures,
        "absents": absents,
        "illisibles": illisibles,
    }, f, ensure_ascii=False, indent=1)
dire("")
dire("Écrit : " + SORTIE)