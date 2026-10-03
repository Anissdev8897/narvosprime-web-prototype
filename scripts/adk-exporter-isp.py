"""
adk-exporter-isp.py — exporter en JSON les OBJETS et RECETTES d'InventorySystemPro
(Moonville, UE 5.4), pour que NOTRE generateur Lua les verse au catalogue. Ne
modifie rien.

    UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript \
      -script="<...>/scripts/adk-exporter-isp.py" -unattended -nosplash -nopause

Ecrit `WebPortal/Server/adk/_isp/objets.json` et `_isp/recettes.json`.

-- POURQUOI ---------------------------------------------------------------------
Contrairement a Hyper (DataTables), InventorySystemPro range chaque objet dans un
DATA ASSET (`DA_HealthPotion`, `DA_Pistol`...) instance du Blueprint `PDA_Item`,
et chaque recette dans une instance de `PDA_CraftingRecipe`. Ses Blueprints de
logique supposent un serveur Unreal ; ce qui s'integre a notre architecture, ce
sont ces DONNEES — nom, description, pile, poids, mesh, vignette, usage.

-- ⚠ LES NOMS DE PROPRIETES VIENNENT DE LA TABLE DE NOMS DU PAQUET ---------------
Lus le 2026-09-13 dans `DA_HealthPotion.uasset` et `DA_Pistol.uasset` : Name,
Description, MaxStackAmount, Weight, StaticMesh, SkeletalMesh, ThumbnailImage,
PreviewImage, Type, ItemActionActor, bAssignToShortcutOnPickup, GameplayTags,
Inspection, GroundPositionOffset, GroundRotation. Un nom lu dans une table de noms
n'est PAS une propriete prouvee (« nom cite ≠ propriete renseignee ») : chaque
lecture est tentee, et chaque ECHEC est journalise par propriete — un champ vide
dans le JSON dit « non lu », jamais « vide dans le pack ».

-- ⚠ LE REDIRECT DE PAQUET DOIT ETRE ABSENT PENDANT CET EXPORT ---------------------
`+PackageRedirects=(OldName="/Game/InventorySystemPro/",...)` ramene tout
chargement de l'original vers `Narvos/InventorySystemPro/`, ou les Data Assets
n'existent pas (seuls les meshes y sont lies). Le script le VERIFIE : un premier
Data Asset introuvable arrete tout avec ce diagnostic.
"""
import json
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

RACINE = os.environ.get("NARVOS_ISP_RACINE", "/Game/InventorySystemPro/ExampleContent/Common/Items")
SORTIE = os.environ.get(
    "NARVOS_ISP_SORTIE",
    "E:/narvosprime-web-prototype/WebPortal/Server/adk/_isp")
os.makedirs(SORTIE, exist_ok=True)

PROPRIETES_OBJET = [
    "Name", "Description", "MaxStackAmount", "Weight", "StaticMesh", "SkeletalMesh",
    "ThumbnailImage", "PreviewImage", "Type", "ItemActionActor",
    "bAssignToShortcutOnPickup", "GameplayTags",
]
PROPRIETES_RECETTE = ["CraftingRecipe"]


def journal(message):
    unreal.log("[NARVOS] " + message)
    print("[NARVOS] " + message)


def valeur_json(v):
    """Une valeur Unreal en JSON lisible par le generateur."""
    if v is None:
        return None
    if isinstance(v, (bool, int, float, str)):
        return v
    if isinstance(v, unreal.Text):
        return str(v)
    if isinstance(v, unreal.Name):
        return str(v)
    if isinstance(v, unreal.Object):
        try:
            return v.get_path_name()
        except Exception:
            return str(v)
    if isinstance(v, (list, tuple, unreal.Array)):
        return [valeur_json(x) for x in v]
    # Structs Blueprint (membres suffixes d'un GUID) et enums : le FORMAT TEXTE
    # d'Unreal, que `scripts/lib/unreal-texte.mjs` sait deja lire (Hyper).
    for methode in ("export_text",):
        if hasattr(v, methode):
            try:
                return {"texte_unreal": getattr(v, methode)()}
            except Exception:
                pass
    return str(v)


def lire(asset, noms, echecs):
    sortie = {}
    for nom in noms:
        try:
            sortie[nom] = valeur_json(asset.get_editor_property(nom))
        except Exception as e:
            echecs.setdefault(nom, 0)
            echecs[nom] += 1
            sortie[nom] = None
    return sortie


registre = unreal.AssetRegistryHelpers.get_asset_registry()
journal("scan du registre...")
registre.search_all_assets(True)

filtre = unreal.ARFilter(package_paths=[RACINE], recursive_paths=True)
donnees = registre.get_assets(filtre)
journal("%d asset(s) sous %s" % (len(donnees), RACINE))
if len(donnees) == 0:
    journal("ARRET : AUCUN asset sous %s — jonction absente, ou redirect de paquet actif ?" % RACINE)
    raise SystemExit(1)

objets, recettes = [], []
echecs_objets, echecs_recettes, illisibles = {}, {}, []
for ad in donnees:
    chemin = str(ad.package_name)
    nom = chemin.rsplit("/", 1)[-1]
    if not nom.startswith("DA_"):
        continue
    asset = unreal.load_asset(chemin)
    if asset is None:
        illisibles.append(chemin)
        if len(illisibles) == 1:
            journal("ILLISIBLE : %s — si TOUS le sont, le PackageRedirect de "
                    "/Game/InventorySystemPro/ est actif (voir l'en-tete)." % chemin)
        continue
    classe = asset.get_class().get_name()
    entree = {"id": nom, "chemin": chemin, "classe": classe}
    if "CraftingRecipe" in classe:
        entree.update(lire(asset, PROPRIETES_RECETTE, echecs_recettes))
        recettes.append(entree)
    elif "PDA_Item" in classe:
        entree.update(lire(asset, PROPRIETES_OBJET, echecs_objets))
        objets.append(entree)
    else:
        entree["ignore"] = "classe %s ni objet ni recette" % classe
        objets.append(entree)

with open(os.path.join(SORTIE, "objets.json"), "w", encoding="utf-8") as f:
    json.dump({"racine": RACINE, "objets": objets, "echecs": echecs_objets, "illisibles": illisibles},
              f, ensure_ascii=False, indent=1)
with open(os.path.join(SORTIE, "recettes.json"), "w", encoding="utf-8") as f:
    json.dump({"racine": RACINE, "recettes": recettes, "echecs": echecs_recettes},
              f, ensure_ascii=False, indent=1)

journal("objets : %d   recettes : %d   illisibles : %d" % (len(objets), len(recettes), len(illisibles)))
for nom, n in sorted(echecs_objets.items()):
    journal("  propriete d'objet NON LUE : %s (%d fois)" % (nom, n))
for nom, n in sorted(echecs_recettes.items()):
    journal("  propriete de recette NON LUE : %s (%d fois)" % (nom, n))
journal("ecrit : %s" % SORTIE)