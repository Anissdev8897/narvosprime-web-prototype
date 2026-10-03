# ══════════════════════════════════════════════════════════════════════════════
# adk-bornes-meshes.py — lit les boîtes englobantes de StaticMesh dans l'ADK.
#
#   NARVOS_BORNES_MOTIF=planet NARVOS_BORNES_DOSSIER=/Game/Narvos/Orbital \
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script=".../adk-bornes-meshes.py"
#
# ── POURQUOI PASSER PAR UNREAL PLUTÔT QUE PAR LE GLB ──────────────────────────
# `Catalogs/Mondes.lua` le dit noir sur blanc : « Ne pas déduire les coordonnées
# du glTF — le découpeur travaille en Y-up, nanos en Z-up, et la conversion
# appliquée par Interchange n'a pas été vérifiée ici. »
#
# L'asset cuit, lui, EST dans l'espace du jeu. Ses transforms sont cuites dans
# les sommets (`bake_meshes = True`), donc ses bornes locales SONT ses bornes
# monde — c'est exactement ce que `MapLoader` reproduit en spawnant à
# Vector(0,0,0). Aucune conversion à supposer.
#
# ⚠ Les bornes rendues sont en UNITÉS UNREAL (centimètres). Mondes.lua écrit ses
# positions en `<n> * M` avec `M = 100.0` : diviser par 100 pour obtenir le
# nombre à écrire.
# ══════════════════════════════════════════════════════════════════════════════

import json
import os

import unreal

DOSSIER = os.environ.get("NARVOS_BORNES_DOSSIER", "/Game/Narvos")
MOTIF = os.environ.get("NARVOS_BORNES_MOTIF", "").lower()
SORTIE = os.environ.get(
    "NARVOS_BORNES_SORTIE",
    "E:/narvosprime-web-prototype/WebPortal/Server/adk/_bornes-meshes.json",
)


def journal(message):
    unreal.log("[NARVOS] " + message)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
actifs = registre.get_assets_by_path(DOSSIER, recursive=True)

resultats = []
for donnees in actifs:
    nom = str(donnees.asset_name)
    if MOTIF and MOTIF not in nom.lower():
        continue
    if str(donnees.asset_class_path.asset_name) != "StaticMesh":
        continue

    mesh = donnees.get_asset()
    if mesh is None:
        continue

    # `get_bounds()` rend un FBoxSphereBounds : origine + demi-étendue.
    bornes = mesh.get_bounds()
    o = bornes.box_extent
    c = bornes.origin
    resultats.append({
        "nom": nom,
        "paquet": str(donnees.package_name),
        "centre": [round(c.x, 1), round(c.y, 1), round(c.z, 1)],
        "demi_etendue": [round(o.x, 1), round(o.y, 1), round(o.z, 1)],
        "rayon": round(bornes.sphere_radius, 1),
    })

resultats.sort(key=lambda r: r["nom"])

os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
with open(SORTIE, "w", encoding="utf-8") as fh:
    json.dump({"dossier": DOSSIER, "motif": MOTIF, "total": len(resultats), "meshes": resultats}, fh, indent=1)

journal("%d mesh(es) mesures -> %s" % (len(resultats), SORTIE))
for r in resultats[:40]:
    journal("  %-34s centre=%s rayon=%.1f" % (r["nom"], r["centre"], r["rayon"]))