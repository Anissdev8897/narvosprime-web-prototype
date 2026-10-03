# ══════════════════════════════════════════════════════════════════════════════
# adk-renommer-asset.py — sort un asset d'un nom réservé, références comprises.
#
#   NARVOS_RACINE=/Game/Narvos/chunks_unreal_v3 \
#   NARVOS_ANCIEN=WorldGridMaterial NARVOS_NOUVEAU=MTL_NarvosTerrain \
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="…"
#
# ── POURQUOI UNE VERSION GÉNÉRIQUE À CÔTÉ DE adk-renommer-worldgrid.py ────────
# Celui-là est câblé sur les quatre morphologies de SciFi_Trooper_Set, avec des
# noms de sortie écrits à la main (`M_Trooper_PetiteFemale`). Sa tâche est faite.
# Le même défaut est réapparu ailleurs — la Forge — et recopier le script pour en
# changer les chemins produirait deux fichiers qui divergeront.
#
# ── CE QU'IL RENOMME ─────────────────────────────────────────────────────────
# L'asset `<ancien>` ET tous ceux dont le nom COMMENCE par `<ancien>_` : un
# import Interchange nomme les textures d'après leur matériau
# (`X_BaseColor`, `X_MetallicRoughness`, `X_Normal`). Les laisser derrière
# garderait la moitié de l'homonymie, et surtout un jeu de noms incohérent.
#
# ── L'ORDRE, ET LA SAUVEGARDE ────────────────────────────────────────────────
# Le matériau EN PREMIER : renommer une texture avant lui ferait pointer le
# matériau, une seconde durant, vers un nom disparu.
#
# Et il FAUT resauver après : `rename_asset` réécrit les références des meshes en
# mémoire, mais un paquet non sauvé revient à l'ancien nom au prochain
# chargement — et le cook repartirait de là, sans rien signaler.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal

RACINE = os.environ.get("NARVOS_RACINE", "").replace("\\", "/").strip().rstrip("/")
ANCIEN = os.environ.get("NARVOS_ANCIEN", "").strip()
NOUVEAU = os.environ.get("NARVOS_NOUVEAU", "").strip()

# ── MODE AUTO ─────────────────────────────────────────────────────────────────
# `NARVOS_NOUVEAU=AUTO` dérive un nom PAR DOSSIER au lieu d'en imposer un seul.
#
# Pourquoi : le même nom réservé traîne dans 30 dossiers sans rapport — des corps,
# des vêtements, des mannequins, un PNJ. Les renommer tous pareil retirerait bien
# l'homonymie avec le moteur, mais en créerait trente entre eux : impossible de
# savoir, en lisant `MTL_NarvosBase`, de quel pack il sort.
#
# Le nom dérive des deux derniers segments PARLANTS du chemin :
#   /Game/Narvos/Meshes/BodyForms/Male                  -> MTL_BodyForms_Male
#   /Game/Narvos/Common/Male/…/Bottoms/Cargopants       -> MTL_Bottoms_Cargopants
#
# Deux dossiers peuvent produire le même nom — c'est sans conséquence, chacun a
# son propre chemin de paquet.
AUTO = NOUVEAU.upper() == "AUTO"

# Segments qui ne disent rien sur le contenu : les sauter donne un nom utile.
SEGMENTS_MUETS = {"Meshes", "Mesh", "Parts", "Characters", "Content", "SkeletalMeshes"}


def journal(message):
    unreal.log("[NARVOS] " + message)


def nom_derive(dossier):
    """Nom de matériau lisible, tiré des deux derniers segments parlants."""
    segments = [s for s in dossier.split("/") if s and s not in SEGMENTS_MUETS]
    # `/Game/Narvos` en tête n'apprend rien non plus.
    while segments and segments[0] in ("Game", "Narvos"):
        segments.pop(0)
    retenus = segments[-2:] if len(segments) >= 2 else segments
    return "MTL_" + "_".join(retenus) if retenus else "MTL_Sans_Dossier"


if not RACINE or not ANCIEN or not NOUVEAU:
    journal("ARRET : NARVOS_RACINE, NARVOS_ANCIEN et NARVOS_NOUVEAU sont requis.")
    raise SystemExit(0)

journal("racine  : " + RACINE)
journal("renomme : %s -> %s" % (ANCIEN, NOUVEAU))

registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)

# Recenser avant d'agir : on veut la liste exacte, et savoir si elle est vide.
concernes = []
for d in registre.get_assets_by_path(RACINE, recursive=True):
    nom = str(d.asset_name)
    if nom == ANCIEN or nom.startswith(ANCIEN + "_"):
        concernes.append((str(d.package_name), nom))

if not concernes:
    journal("Aucun asset nomme %s* sous %s — deja fait, ou jamais importe." % (ANCIEN, RACINE))
    raise SystemExit(0)

# Le materiau d'abord : c'est celui dont le nom est EXACTEMENT `ANCIEN`.
concernes.sort(key=lambda c: (c[1] != ANCIEN, c[1]))

renommes = 0
echecs = []
for paquet, nom in concernes:
    dossier = paquet.rsplit("/", 1)[0]
    base = nom_derive(dossier) if AUTO else NOUVEAU
    # Le suffixe des textures suit le matériau : `X_BaseColor` -> `<base>_BaseColor`.
    neuf = base + nom[len(ANCIEN):]
    cible = "%s/%s" % (dossier, neuf)

    if unreal.EditorAssetLibrary.does_asset_exist(cible):
        journal("  DEJA  %s" % cible)
        continue

    if unreal.EditorAssetLibrary.rename_asset(paquet, cible):
        renommes += 1
        journal("  %-40s -> %s" % (nom, neuf))
    else:
        echecs.append(paquet)
        journal("  ECHEC %s" % paquet)

journal("")
journal("%d asset(s) renomme(s), %d echec(s)" % (renommes, len(echecs)))

# ⚠ Sans cette sauvegarde, les references reecrites ne survivent pas au
# dechargement, et le cook repartirait de l'ancien nom.
if renommes > 0:
    # ⚠ `only_if_is_dirty=True`, PAS False. Avec False et une racine large comme
    # `/Game/Narvos`, cet appel réécrit les 32 000 assets du projet — 13 Go, map
    # comprise — pour quelques renommages. Le piège est déjà consigné dans
    # `adk-import-narvos.py`, où il avait été payé.
    #
    # `True` suffit : `rename_asset` marque sales le paquet renommé ET tous ceux
    # dont il a réécrit les références. Ce sont exactement ceux qu'il faut sauver.
    unreal.EditorAssetLibrary.save_directory(RACINE, only_if_is_dirty=True, recursive=True)
    journal("assets sales resauves sous " + RACINE)

# ── Controle ─────────────────────────────────────────────────────────────────

registre.search_all_assets(True)
restants = [str(d.asset_name) for d in registre.get_assets_by_path(RACINE, recursive=True)
            if str(d.asset_name) == ANCIEN or str(d.asset_name).startswith(ANCIEN + "_")]
if restants:
    journal("ATTENTION %d asset(s) portent encore le nom : %s" % (len(restants), restants[:6]))
else:
    journal("Plus aucun asset nomme %s* sous %s" % (ANCIEN, RACINE))