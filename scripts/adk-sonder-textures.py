# -*- coding: utf-8 -*-
"""
adk-sonder-textures.py — quels materiaux n'ont AUCUNE texture du projet ?

    UnrealEditor-Cmd.exe <uproject> -run=pythonscript \
        -script=scripts/adk-sonder-textures.py -unattended -nosplash -nopause

Ne modifie rien.

── LA QUESTION ──────────────────────────────────────────────────────────────────
Retour de jeu du 2026-09-10 : « textures manquantes en gris », sur la capitale
et sur les PNJ. Un chantier connu ([[project-textures-grises]]) : le 2026-09-08,
1 073 materiaux sur 2 485 ne pointaient que les bouche-trous du moteur
(`T_White_srgb`, `T_Generic_N`...). L'import glTF cree le materiau et ne
connecte jamais la texture du pack — sans erreur.

On mesure ICI les deux cibles vues en jeu, pas tout le projet :
  A. les materiaux de la capitale (`/Game/Narvos/CITY_PACK`) ;
  B. les materiaux references par les meshes des PNJ (`Catalogs/Spawnables.lua`).

── LA METHODE, ET POURQUOI ─────────────────────────────────────────────────────
Par les DEPENDANCES DE PACKAGE, sans charger les assets : charger 14 000
MaterialInstance fait expirer l'appel (mesure du 2026-09-08). Une dependance
`/Game/...` de classe Texture est une vraie texture du projet ; une dependance
`/Engine/...` ou `/Interchange/...` est un bouche-trou.

Un materiau SANS aucune texture `/Game/` est gris en jeu. On remonte UN niveau
de parent pour les MaterialInstance : une instance sans texture propre qui herite
d'un parent texture n'est pas grise.
"""
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

CLASSES_MATERIAU = ("Material", "MaterialInstanceConstant")
CLASSES_TEXTURE = ("Texture2D", "TextureCube", "Texture2DArray", "VirtualTexture2D")


def dire(t):
    print(t)
    unreal.log(t)


ar = unreal.AssetRegistryHelpers.get_asset_registry()
OPTS = unreal.AssetRegistryDependencyOptions(
    include_soft_package_references=True,
    include_hard_package_references=True,
    include_searchable_names=False,
    include_soft_management_references=False,
    include_hard_management_references=False,
)

_classe_cache = {}


def classe_de(paquet):
    """Classe du premier asset d'un package, ou None."""
    p = str(paquet)
    if p in _classe_cache:
        return _classe_cache[p]
    try:
        donnees = ar.get_assets_by_package_name(p)
        c = str(donnees[0].asset_class_path.asset_name) if donnees else None
    except Exception:
        c = None
    _classe_cache[p] = c
    return c


def deps(paquet):
    try:
        return [str(d) for d in (ar.get_dependencies(paquet, OPTS) or [])]
    except Exception:
        return []


def textures_projet(paquet):
    """Les dependances /Game/ de classe texture d'un materiau."""
    return [d for d in deps(paquet)
            if d.startswith("/Game/") and classe_de(d) in CLASSES_TEXTURE]


def est_gris(paquet, profondeur=0):
    """Vrai si le materiau n'atteint AUCUNE texture du projet."""
    if textures_projet(paquet):
        return False
    if profondeur >= 1:
        return True
    # Une instance herite de son parent : on remonte un niveau.
    for d in deps(paquet):
        if classe_de(d) in CLASSES_MATERIAU and d != paquet:
            if not est_gris(d, profondeur + 1):
                return False
    return True


def bilan(nom, paquets_materiaux, exemples=6):
    gris = [p for p in paquets_materiaux if est_gris(p)]
    dire("")
    dire("=== %s ===" % nom)
    dire("  %d materiau(x), %d GRIS (aucune texture du projet), %d textures"
         % (len(paquets_materiaux), len(gris), len(paquets_materiaux) - len(gris)))
    for p in gris[:exemples]:
        dire("    gris : %s" % p)
    return len(paquets_materiaux), len(gris)


# ── A. La capitale ───────────────────────────────────────────────────────────
capitale = []
for a in ar.get_assets_by_path("/Game/Narvos/CITY_PACK", recursive=True):
    if str(a.asset_class_path.asset_name) in CLASSES_MATERIAU:
        capitale.append(str(a.package_name))
n_cap, g_cap = bilan("CAPITALE (/Game/Narvos/CITY_PACK)", capitale)

# ── B. Les PNJ du catalogue ──────────────────────────────────────────────────
with open(CATALOGUE, encoding="utf-8") as f:
    texte = f.read()
assets = sorted(set(m.group(1).split("::")[-1]
                    for m in re.finditer(r'asset\s*=\s*"([^"]+)"', texte)))
chemins = {}
with open(TOML, encoding="utf-8") as f:
    for ligne in f:
        m = re.match(r'\s*([A-Za-z0-9_\-]+)\s*=\s*"([^"]+)"', ligne)
        if m:
            chemins.setdefault(m.group(1), m.group(2))

par_pnj = []
mats_pnj = set()
for cle in assets:
    chemin = chemins.get(cle)
    if not chemin:
        continue
    paquet = "/Game/" + chemin
    mats = [d for d in deps(paquet) if classe_de(d) in CLASSES_MATERIAU]
    gris = [m for m in mats if est_gris(m)]
    par_pnj.append((cle, len(mats), len(gris)))
    mats_pnj.update(mats)

n_pnj, g_pnj = bilan("PNJ (meshes de Spawnables.lua)", sorted(mats_pnj))
dire("")
dire("  par mesh (materiaux / gris) :")
for cle, n, g in par_pnj:
    marque = "  <<< TOUT GRIS" if (n and g == n) else ""
    dire("    %-44s %2d / %2d%s" % (cle, n, g, marque))

if (n_cap + n_pnj) == 0:
    dire("")
    dire("ROUGE : aucun materiau trouve — la sonde n'a rien mesure.")
    sys.exit(1)
dire("")
dire("Sonde terminee — RIEN n'a ete modifie.")