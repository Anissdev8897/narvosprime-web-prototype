# ══════════════════════════════════════════════════════════════════════════════
# adk-ranger-migres.py — deplacer sous `Narvos/` un asset migre, puis rebrancher
# les instances qui l'attendaient.
#
#   NARVOS_A_RANGER=/Game/Character/Materials/M_Master_Cloth_HS \
#   NARVOS_APPLIQUER=1 \
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="…"
#
# ⚠ EDITEUR FERME.
#
# ── POURQUOI DEPLACER ─────────────────────────────────────────────────────────
# `migrate_packages` depose l'asset a l'arborescence qu'il avait dans la source :
# `/Game/Character/Materials/...`. Or `Assets.toml` declare
# `unreal_folders = ["Narvos"]` — un asset hors de `Narvos/` n'est JAMAIS cuit
# dans le pack. Il serait present dans l'editeur et absent du jeu.
#
# ── POURQUOI `rename_asset` ET PAS UN `mv` ────────────────────────────────────
# `rename_asset` est un vrai Move : il reecrit les references et laisse un
# redirecteur. Deplacer le fichier a la main reproduirait exactement le defaut
# qui a coute 166 instances sans parent sur ce projet.
#
# ── ET LE REBRANCHEMENT ───────────────────────────────────────────────────────
# Les instances orphelines ne pointent plus rien : `rename_asset` n'a donc rien
# a reecrire pour elles. On leur repose le parent explicitement, puis on relit.
#
# ⚠ `save_asset` a `only_if_is_dirty=True` PAR DEFAUT. Sans `False`, la
# sauvegarde ne fait rien et la relecture en memoire dit quand meme OK — piege
# paye le 2026-09-05 sur 162 assets.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal

def chemin_unreal(p):
    """Rend un chemin `/Game/...` meme si le shell l'a converti.

    ⚠ Git Bash REECRIT tout argument commencant par `/` en chemin Windows :
    `/Game/Character/...` devient `C:/Program Files/Git/Game/Character/...`.
    Ca a fait echouer deux commandes aujourd'hui, avec pour seul symptome un
    « ABSENT de la source » parfaitement trompeur.
    `MSYS_NO_PATHCONV=1` l'evite, mais l'oubli est trop facile : on repare ici.
    """
    p = p.replace("\\", "/").strip()
    for marque in ("/Game/", "/Engine/"):
        i = p.find(marque)
        if i > 0:
            return p[i:]
    if p and not p.startswith("/"):
        return "/" + p
    return p


RACINE = "/Game/Narvos"
A_RANGER = [chemin_unreal(p) for p in os.environ.get("NARVOS_A_RANGER", "").split(",") if p.strip()]
APPLIQUER = os.environ.get("NARVOS_APPLIQUER") == "1"




def journal(m):
    unreal.log("[NARVOS] " + m)


if not A_RANGER:
    journal("ARRET : NARVOS_A_RANGER est vide")
    raise SystemExit(0)

journal("mode : %s" % ("APPLIQUER" if APPLIQUER else "passe a blanc"))

deplaces = []
for source in A_RANGER:
    cible = RACINE + source[len("/Game"):] if source.startswith("/Game/") else None
    if cible is None:
        journal("chemin inattendu, ignore : " + source)
        continue

    if unreal.EditorAssetLibrary.does_asset_exist(cible):
        journal("deja range : " + cible)
        deplaces.append(cible)
        continue

    if not unreal.EditorAssetLibrary.does_asset_exist(source):
        journal("ABSENT (migration non faite ?) : " + source)
        continue

    journal("%s\n            -> %s" % (source, cible))
    if APPLIQUER:
        if unreal.EditorAssetLibrary.rename_asset(source, cible):
            deplaces.append(cible)
            journal("  deplace")
        else:
            journal("  ECHEC du deplacement")
    else:
        deplaces.append(cible)

if not APPLIQUER:
    journal("")
    journal("passe a blanc : rien n'a ete ecrit")
    raise SystemExit(0)

# ── Rebrancher les orphelines qui attendaient ce parent ──────────────────────

journal("")
journal("=== rebranchement des instances sans parent")

registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)
mel = unreal.MaterialEditingLibrary

orphelines = []
for d in registre.get_assets_by_path(RACINE, recursive=True):
    if str(d.asset_class_path.asset_name) != "MaterialInstanceConstant":
        continue
    a = d.get_asset()
    if a is None:
        continue
    try:
        if a.get_editor_property("parent") is None:
            orphelines.append(str(d.package_name))
    except Exception:
        pass

journal("%d instance(s) encore sans parent" % len(orphelines))

# Le parent voulu vient du releve fait sur la source.
import json
RELEVE = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_parents-source.json"
table = {}
if os.path.exists(RELEVE):
    with open(RELEVE, "r", encoding="utf-8") as fh:
        table = json.load(fh).get("parents", {})

poses = 0
for paquet in sorted(orphelines):
    origine = "/Game" + paquet[len(RACINE):]
    parent_source = table.get(origine)
    if parent_source is None:
        journal("  %-40s aucun parent releve" % paquet.rsplit("/", 1)[-1])
        continue
    cible = RACINE + parent_source[len("/Game"):] if parent_source.startswith("/Game/") else parent_source
    if not unreal.EditorAssetLibrary.does_asset_exist(cible):
        journal("  %-40s parent toujours absent : %s" % (paquet.rsplit("/", 1)[-1], cible))
        continue
    inst = unreal.EditorAssetLibrary.load_asset(paquet)
    parent = unreal.EditorAssetLibrary.load_asset(cible)
    try:
        mel.set_material_instance_parent(inst, parent)
        unreal.EditorAssetLibrary.save_asset(paquet, only_if_is_dirty=False)
        poses += 1
        journal("  %-40s -> %s" % (paquet.rsplit("/", 1)[-1], cible.rsplit("/", 1)[-1]))
    except Exception as e:
        journal("  %-40s ECHEC : %s" % (paquet.rsplit("/", 1)[-1], e))

journal("")
journal("%d parent(s) repose(s)" % poses)
journal("⚠ Le vrai controle est un RECOMPTAGE dans un processus neuf :")
journal("   adk-verifier-parents-materiaux.py")