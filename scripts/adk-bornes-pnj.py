# -*- coding: utf-8 -*-
"""
adk-bornes-pnj.py — la TAILLE REELLE des PNJ, lue dans l'ADK. Ne modifie rien.

    UnrealEditor-Cmd.exe <uproject> -run=pythonscript \
        -script=scripts/adk-bornes-pnj.py -unattended -nosplash -nopause

── LA QUESTION ──────────────────────────────────────────────────────────────────
Retour de jeu du 2026-09-10 : « les PNJ sont tres grands ».

`Catalogs/Spawnables.lua` applique `echelle = 100` a 30 entrees (et 40 000 au
crabe). Cette echelle a ete posee le 2026-09-05 pour une raison mesuree :
31 PNJ sur 72 sortaient de l'import hauts de 1,7 CENTIMETRE — des GLB en metres
lus comme des centimetres ([[reference-unites-metre-centimetre]]).

Si ces meshes ont ete REIMPORTES depuis a la bonne echelle, la correction
s'applique DEUX FOIS : 1,7 m x 100 = 170 m. Ce serait exactement le symptome.

On ne corrige pas une echelle a l'oeil. On lit la hauteur de chaque mesh dans
le projet, on la multiplie par l'echelle du catalogue, et on compare a une
taille humaine.
"""
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
TOML = RACINE + "/WebPortal/Server/Assets/narvos/Assets.toml"

# Une taille humaine plausible, en centimetres. Au-dela de ces bornes, un PNJ
# humanoide est soit une poupee, soit un geant.
HUMAIN_MIN, HUMAIN_MAX = 120.0, 260.0


def dire(t):
    print(t)
    unreal.log(t)


with open(CATALOGUE, encoding="utf-8") as f:
    texte = f.read()

# Chaque entree : id, asset, echelle (defaut 1), simple.
entrees = []
for bloc in re.finditer(r"\{[^{}]*?id\s*=\s*\"([^\"]+)\"[^{}]*?\}", texte, re.S):
    corps = bloc.group(0)
    m_asset = re.search(r'asset\s*=\s*"([^"]+)"', corps)
    if not m_asset:
        continue
    m_ech = re.search(r"echelle\s*=\s*([0-9.]+)", corps)
    entrees.append({
        "id": bloc.group(1),
        "asset": m_asset.group(1),
        "echelle": float(m_ech.group(1)) if m_ech else 1.0,
    })

if not entrees:
    dire("ARRET : aucune entree lue dans Spawnables.lua — format change.")
    sys.exit(1)

# Cle d'asset -> chemin, depuis le pack. Toutes sections confondues : un PNJ
# peut etre un SkeletalMesh ou un StaticMesh (CharacterSimple accepte les deux).
chemins = {}
with open(TOML, encoding="utf-8") as f:
    for ligne in f:
        m = re.match(r'\s*([A-Za-z0-9_\-]+)\s*=\s*"([^"]+)"', ligne)
        if m:
            chemins.setdefault(m.group(1), m.group(2))

dire("%d entree(s) dans Spawnables.lua" % len(entrees))
dire("")
dire("%-28s %8s %9s %11s  %s" % ("id", "mesh cm", "echelle", "en jeu", "verdict"))

geants, poupees, absents, sains = [], [], [], []
for e in entrees:
    cle = e["asset"].split("::")[-1]
    chemin = chemins.get(cle)
    if not chemin:
        absents.append(e["id"])
        dire("%-28s %8s %9s %11s  ABSENT du pack (%s)" % (e["id"], "-", "-", "-", cle))
        continue

    obj = unreal.EditorAssetLibrary.load_asset("/Game/" + chemin)
    if obj is None:
        absents.append(e["id"])
        dire("%-28s %8s %9s %11s  non chargeable" % (e["id"], "-", "-", "-"))
        continue

    try:
        bornes = obj.get_bounds()
        hauteur = float(bornes.box_extent.z) * 2.0
    except Exception as err:
        dire("%-28s bornes illisibles : %s" % (e["id"], err))
        continue

    en_jeu = hauteur * e["echelle"]
    if en_jeu > HUMAIN_MAX * 3:
        verdict = "GEANT"
        geants.append((e["id"], hauteur, e["echelle"], en_jeu))
    elif en_jeu < HUMAIN_MIN / 3:
        verdict = "POUPEE"
        poupees.append((e["id"], hauteur, e["echelle"], en_jeu))
    else:
        verdict = "ok"
        sains.append(e["id"])

    dire("%-28s %8.1f %9g %9.0f cm  %s" % (e["id"], hauteur, e["echelle"], en_jeu, verdict))

dire("")
dire("=== BILAN ===")
dire("  sains   : %d" % len(sains))
dire("  geants  : %d" % len(geants))
dire("  poupees : %d" % len(poupees))
dire("  absents : %d" % len(absents))

if geants:
    dire("")
    dire("  ⚠ GEANTS : la hauteur du mesh est DEJA humaine, l'echelle la multiplie.")
    for i, h, ech, j in geants:
        dire("    %-26s mesh %.0f cm x %g = %.0f m" % (i, h, ech, j / 100.0))

if not (sains or geants or poupees):
    dire("")
    dire("ROUGE : aucune taille lue — la sonde n'a rien mesure.")
    sys.exit(1)