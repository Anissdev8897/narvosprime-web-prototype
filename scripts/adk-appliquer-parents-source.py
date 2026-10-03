# ══════════════════════════════════════════════════════════════════════════════
# adk-appliquer-parents-source.py — rendre aux MaterialInstance de l'ADK le
# parent qu'elles ont dans le projet SOURCE.
#
#   NARVOS_APPLIQUER=1                     sans lui : passe a blanc
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="…"
#
# ⚠ EDITEUR DE L'ADK FERME.
# Entree : `_parents-source.json`, produit par `adk-dumper-parents-source.py`.
#
# ── POURQUOI CE DETOUR ────────────────────────────────────────────────────────
# 141 instances de l'ADK n'ont plus de parent. Elles viennent de
# `GameAnimationSample`, copiees de `/Game/<X>` vers `/Game/Narvos/<X>` — et un
# `.uasset` porte son chemin de package EN DUR, donc les references sont mortes.
#
# Deviner par convention de nom a echoue : `M_Hair`, `M_PeachFuzz`,
# `M_CoreC_Base_M_Body` n'existent NI ici NI dans la source. Leurs vrais parents
# portent d'autres noms.
#
# On lit donc la reponse la ou elle est encore juste, plutot que de l'inventer.
#
# ── LA TRADUCTION, ET SES DEUX CAS ────────────────────────────────────────────
# 1. Parent sous `/Game/...`  -> il a ete copie lui aussi : `/Game/Narvos/...`
# 2. Parent hors `/Game`      -> plugin ou moteur (`/MetaHuman/…`, `/Engine/…`),
#                                monte a l'identique : on garde le chemin tel quel.
#
# Dans les deux cas on VERIFIE que la cible existe avant d'ecrire. Un parent
# faux est pire qu'un parent absent : l'asset cesse d'etre visiblement casse et
# devient discretement faux, sans plus aucun signal.
# ══════════════════════════════════════════════════════════════════════════════

import json
import os

import unreal

RACINE = os.environ.get("NARVOS_RACINE", "/Game/Narvos").replace("\\", "/").rstrip("/")
ENTREE = os.environ.get(
    "NARVOS_PARENTS_SOURCE",
    "E:/narvosprime-web-prototype/WebPortal/Server/adk/_parents-source.json",
)
APPLIQUER = os.environ.get("NARVOS_APPLIQUER") == "1"


def journal(m):
    unreal.log("[NARVOS] " + m)


if not os.path.exists(ENTREE):
    journal("ARRET : releve source absent — " + ENTREE)
    journal("Lancer d'abord adk-dumper-parents-source.py sur GameAnimationSample.")
    raise SystemExit(0)

with open(ENTREE, "r", encoding="utf-8") as fh:
    donnees = json.load(fh)
source = donnees.get("parents", {})
journal("%d parent(s) releve(s) dans la source" % len(source))

registre = unreal.AssetRegistryHelpers.get_asset_registry()
mel = unreal.MaterialEditingLibrary


def vers_adk(chemin):
    """Traduit un chemin du projet source vers l'ADK."""
    if chemin.startswith("/Game/"):
        return RACINE + chemin[len("/Game"):]
    return chemin  # plugin ou moteur : monte a l'identique


# ── Les orphelines de l'ADK ──────────────────────────────────────────────────

orphelines = []
for d in registre.get_assets_by_path(RACINE, recursive=True):
    if str(d.asset_class_path.asset_name) != "MaterialInstanceConstant":
        continue
    a = d.get_asset()
    if a is None:
        continue
    try:
        if a.get_editor_property("parent") is not None:
            continue
    except Exception:
        continue
    orphelines.append(str(d.package_name))

journal("%d instance(s) sans parent dans l'ADK" % len(orphelines))
journal("mode : %s" % ("APPLIQUER" if APPLIQUER else "passe a blanc"))
journal("")

resolus, sans_releve, cible_absente = [], [], []

for paquet in sorted(orphelines):
    # Chemin qu'avait cet asset dans la source.
    if not paquet.startswith(RACINE + "/"):
        continue
    origine = "/Game" + paquet[len(RACINE):]

    parent_source = source.get(origine)
    if parent_source is None:
        sans_releve.append(paquet)
        continue

    cible = vers_adk(parent_source)
    if not unreal.EditorAssetLibrary.does_asset_exist(cible):
        cible_absente.append((paquet, cible))
        continue

    if APPLIQUER:
        inst = unreal.EditorAssetLibrary.load_asset(paquet)
        parent = unreal.EditorAssetLibrary.load_asset(cible)
        pose = False
        if inst is not None and parent is not None:
            try:
                mel.set_material_instance_parent(inst, parent)
                unreal.EditorAssetLibrary.save_asset(paquet, only_if_is_dirty=False)
                relu = unreal.EditorAssetLibrary.load_asset(paquet).get_editor_property("parent")
                pose = relu is not None
            except Exception as e:
                journal("  ECHEC %s : %s" % (paquet.rsplit("/", 1)[-1], e))
        resolus.append((paquet, cible, pose))
    else:
        resolus.append((paquet, cible, None))

journal("=== %d resolu(s) · %d absent(s) du releve · %d cible introuvable"
        % (len(resolus), len(sans_releve), len(cible_absente)))
journal("")

for paquet, cible, pose in resolus[:40]:
    marque = "" if pose is None else (" OK" if pose else " ECHEC")
    journal("  %-44s -> %s%s" % (paquet.rsplit("/", 1)[-1], cible, marque))
if len(resolus) > 40:
    journal("  … et %d autre(s)" % (len(resolus) - 40))

if cible_absente:
    journal("")
    journal("=== parent connu mais ABSENT de l'ADK (a importer depuis la source)")
    vus = set()
    for _, cible in cible_absente:
        if cible in vus:
            continue
        vus.add(cible)
        journal("  " + cible)
    journal("  (%d instance(s) concernee(s), %d cible(s) distincte(s))"
            % (len(cible_absente), len(vus)))

if sans_releve:
    journal("")
    journal("=== absentes du releve source : %d" % len(sans_releve))
    for p in sans_releve[:12]:
        journal("  " + p)