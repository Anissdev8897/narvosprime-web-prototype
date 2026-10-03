# ══════════════════════════════════════════════════════════════════════════════
# adk-audit-skeletons.py — quel squelette porte chaque asset d'un projet ?
#
#   UnrealEditor-Cmd.exe <projet>.uproject -run=pythonscript
#       -script=".../adk-audit-skeletons.py"
#
# Variable d'environnement `NARVOS_RACINE` : chemin de package à auditer
# (défaut `/Game`). Ex : `/Game/MetaHumans`, `/Game/Characters`.
#
# POURQUOI CE SCRIPT EN PLUS DE adk-verify-skeletons.py : celui-là vérifie qu'un
# mesh pointe sur SKEL_Mannequin, la cible imposée. Celui-ci ne suppose AUCUNE
# cible : il recense ce qui existe, groupe par squelette et compte. C'est ce
# qu'il faut pour juger un pack qu'on vient de télécharger, avant de décider
# s'il entre dans nanos.
#
# Ce qui décide : nanos exige `SKEL_Mannequin`, le Mannequin UE4 (68 os). Un
# asset sur un autre squelette demande un retargeting — travail réel, pas une
# case à cocher. Le compte par squelette dit donc immédiatement le coût du pack.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal

def _racine():
    """Chemin de package à auditer, protégé contre Git Bash.

    ⚠ MSYS (Git Bash sur Windows) convertit toute valeur commençant par `/` en
    chemin Windows avant de la passer au processus. `NARVOS_RACINE=/Game` arrive
    donc ici en `C:/Program Files/Git/Game`, et l'audit rend 0 asset sans erreur
    — le pire des retours, puisqu'on conclurait que le pack est vide.

    `MSYS_NO_PATHCONV=1` ne suffit pas toujours selon la version. On répare donc
    ici : une valeur qui ressemble à un chemin Windows n'est pas un chemin de
    package Unreal, et on garde la dernière partie utile.
    """
    v = os.environ.get("NARVOS_RACINE", "/Game").replace("\\", "/").strip()
    if not v:
        return "/Game"

    # Un chemin de package commence toujours par un point de montage connu. Le
    # retrouver DANS la chaîne récupère aussi les sous-dossiers, là où un simple
    # `rsplit` sur le dernier segment transformait
    # `C:/Program Files/Git/Game/Narvos/stylized_modular` en `/stylized_modular`
    # — un chemin inexistant, donc un audit à zéro asset sans la moindre erreur.
    for montage in ("/Game/", "/Engine/", "/Script/"):
        i = v.find(montage)
        if i >= 0:
            return v[i:].rstrip("/")

    # Cas exacts, sans sous-dossier (`C:/Program Files/Git/Game`).
    for montage in ("/Game", "/Engine", "/Script"):
        if v.endswith(montage):
            return montage

    # Valeur déjà propre, ou saisie sans barre initiale (`Game/Narvos`) — forme
    # à préférer sous Git Bash, que MSYS ne réécrit pas.
    return v if v.startswith("/") else "/" + v


RACINE = _racine()


def journal(message):
    unreal.log("[NARVOS] " + message)


registre = unreal.AssetRegistryHelpers.get_asset_registry()

# ⚠ FORCER LE SCAN AVANT D'INTERROGER.
#
# Mesuré le 2026-09-03 : sur un projet fraîchement installé, ce script a rendu
# ZÉRO asset en 5 ms et s'est déclaré « executed successfully ». Le registre
# n'est peuplé que par un scan, et un commandlet n'en lance aucun tout seul — il
# se contente du cache `Intermediate/CachedAssetRegistry_*.bin`, qui n'existe pas
# tant que le projet n'a jamais été ouvert dans l'éditeur.
#
# Un audit qui rend 0 sans erreur est le pire des retours : on conclurait que le
# pack est vide.
journal("scan du registre (peut prendre une minute sur un projet neuf)...")
registre.search_all_assets(True)          # True = bloquant
journal("scan termine.")

actifs = registre.get_assets_by_path(RACINE, recursive=True)

journal("racine : %s — %d asset(s)" % (RACINE, len(actifs)))

if len(actifs) == 0:
    journal("AUCUN asset. Verifier le chemin de package (--racine) : sur un projet")
    journal("tiers, le contenu peut vivre sous /Game/<NomDuPack>/ et non /Game.")

par_classe = {}
for a in actifs:
    c = str(a.asset_class_path.asset_name)
    par_classe[c] = par_classe.get(c, 0) + 1

journal("")
journal("=== par classe ===")
for c in sorted(par_classe, key=lambda k: -par_classe[k])[:12]:
    journal("    %-28s %d" % (c, par_classe[c]))

# ── Meshes et animations, groupés par squelette ───────────────────────────────
#
# On charge chaque asset : c'est lent, mais le registre ne porte pas la
# référence de squelette de façon fiable selon les versions, et deviner ici
# coûterait plus cher qu'attendre.

par_squelette = {}
illisibles = 0

for a in actifs:
    classe = str(a.asset_class_path.asset_name)
    if classe not in ("SkeletalMesh", "AnimSequence", "AnimMontage", "BlendSpace"):
        continue

    actif = unreal.load_asset(str(a.package_name))
    if actif is None:
        illisibles += 1
        continue

    try:
        squelette = actif.get_editor_property("skeleton")
    except Exception:                                        # noqa: BLE001
        illisibles += 1
        continue

    nom = squelette.get_path_name().split(".")[0] if squelette else "(aucun)"
    entree = par_squelette.setdefault(nom, {"meshes": 0, "anims": 0})
    if classe == "SkeletalMesh":
        entree["meshes"] += 1
    else:
        entree["anims"] += 1

journal("")
journal("=== par squelette ===")
for nom in sorted(par_squelette, key=lambda k: -(par_squelette[k]["meshes"] + par_squelette[k]["anims"])):
    e = par_squelette[nom]
    journal("    %5d mesh · %5d anim   %s" % (e["meshes"], e["anims"], nom))

if illisibles:
    journal("")
    journal("%d asset(s) illisible(s)" % illisibles)

# ── Le verdict qui compte ─────────────────────────────────────────────────────
journal("")
mannequin = [n for n in par_squelette if "SKEL_Mannequin" in n or "UE4_Mannequin" in n]
if mannequin:
    total = sum(par_squelette[n]["meshes"] + par_squelette[n]["anims"] for n in mannequin)
    journal("SUR MANNEQUIN UE4 : %d asset(s) — entrent dans nanos sans retargeting" % total)
else:
    journal("AUCUN asset sur le Mannequin UE4 — retargeting obligatoire pour tout le pack.")