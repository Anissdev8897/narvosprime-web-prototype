# -*- coding: utf-8 -*-
"""
adk-usage-skeletal.py — pose le drapeau d'usage « skeletal mesh » (et « morph
targets » si le maillage en porte) sur les MATERIAUX DE BASE des SkeletalMesh de
/Game/Narvos qui ne l'ont pas.

    UnrealEditor.exe <ADK>.uproject -ExecutePythonScript=".../adk-usage-skeletal.py"
    NARVOS_APPLIQUER=1   ecrire ; sinon passe a blanc (liste seulement)
    NARVOS_ECRITS_DEPUIS=AAAA-MM-JJ   ne corriger que les materiaux dont le FICHIER a ete
                         ecrit depuis cette date (2026-10-04 : ADK a moitie rebati — un
                         materiau rendu tel qu'il etait le 23/09 a deja eu sa passe, ou
                         etait LIE EN DUR ce jour-la et ne l'est plus depuis la recuperation)

-- LE DEFAUT (mesure du 2026-09-13) ------------------------------------------------
PNJ, monstres, zombies, Cyberpunk Samurai GRIS en jeu. Leurs materiaux glTF
(UMaterial `Material_1`...) n'ont pas `bUsedWithSkeletalMesh` : absent de la table
de noms de pnj 70/71, pnj_monstre 31, ZombieSoldierPack_original 545,
CyberpunkSamurai 30. Leurs shader maps CUITES ne portent que FLocalVertexFactory,
aucun FGPUSkinVertexFactory ; le materiau de peau du Defender porte les deux.
Le client n'a donc aucun shader pour les dessiner skinnes -> materiau par defaut.

Pourquoi personne ne l'a vu : dans l'EDITEUR, le drapeau se pose tout seul au
premier affichage du maillage (`SetMaterialUsage`). Le cook, lui, n'affiche rien.

-- REGLES ----------------------------------------------------------------------------
  · editeur COMPLET seulement : un UMaterial sauve en commandlet perd son graphe
    (mesure du 2026-09-06, reference_automaterial_gris) ;
  · jamais un fichier LIE EN DUR (st_nlink > 1) : il partage ses octets avec le pack
    d'origine achete ;
  · seulement /Game/Narvos/ — ni /Engine/, ni un plugin, ni le pack de base nanos ;
  · SAUVER CHAQUE MATERIAU AUSSITOT (only_if_is_dirty=False) ;
  · la preuve n'est pas la relecture dans ce processus : c'est le nom
    `bUsedWithSkeletalMesh` dans la table de noms du .uasset, relu APRES (le lanceur
    le fait).

Rapport : WebPortal/Server/adk/_manifests/usage-skeletal.json
"""
import json
import os
import sys

import unreal

APPLIQUER = os.environ.get("NARVOS_APPLIQUER") == "1"
_DEPUIS = os.environ.get("NARVOS_ECRITS_DEPUIS", "").strip()
if _DEPUIS:
    import datetime
    SEUIL = datetime.datetime.strptime(_DEPUIS, "%Y-%m-%d").timestamp()
else:
    SEUIL = None
RAPPORT = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/usage-skeletal.json"
RACINE = "/Game/Narvos/"
CONTENT = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_content_dir())
CLASSES_MATERIAU = ("Material", "MaterialInstanceConstant")
LOT_GC = 100


def journal(m):
    unreal.log("[NARVOS] " + m)
    sys.stdout.write("[NARVOS] " + m + "\n")


# ── Garde-fou : la FORME du danger (sommes-nous dans un vrai editeur ?) ─────────
try:
    _EDITEUR_VIVANT = unreal.EditorLevelLibrary.get_editor_world() is not None
except Exception:
    _EDITEUR_VIVANT = False
if not _EDITEUR_VIVANT:
    journal("ARRET usage-skeletal : pas de monde editeur (commandlet) — un UMaterial sauve ici perd son graphe.")
    raise SystemExit(1)

AR = unreal.AssetRegistryHelpers.get_asset_registry()
# ⚠ Dans l'editeur complet, le registre se remplit en ARRIERE-PLAN : lance au
# demarrage (-ExecutePythonScript), une requete rendrait une liste PARTIELLE — des
# PNJ oublies sans un mot. On attend la fin du balayage, dependances comprises.
AR.wait_for_completion()


def fichier_de(paquet):
    return os.path.join(CONTENT, paquet[len("/Game/"):] + ".uasset")


def lie_en_dur(paquet):
    try:
        return os.stat(fichier_de(paquet)).st_nlink > 1
    except OSError:
        return False


def anterieur_au_seuil(paquet):
    """Vrai si le fichier du materiau date d'AVANT le seuil demande : il n'a pas ete rebati."""
    if SEUIL is None:
        return False
    try:
        return os.path.getmtime(fichier_de(paquet)) < SEUIL
    except OSError:
        return False


def dossier_de(paquet):
    return "/".join(paquet[len(RACINE):].split("/")[:2])


def dependances_dures(paquet):
    opts = unreal.AssetRegistryDependencyOptions()
    opts.set_editor_property("include_soft_package_references", False)
    opts.set_editor_property("include_hard_package_references", True)
    opts.set_editor_property("include_searchable_names", False)
    opts.set_editor_property("include_soft_management_references", False)
    opts.set_editor_property("include_hard_management_references", False)
    return [str(d) for d in (AR.get_dependencies(unreal.Name(paquet), opts) or [])]


def classe_de(paquet):
    for ad in AR.get_assets_by_package_name(unreal.Name(paquet)) or []:
        return str(ad.asset_class_path.asset_name)
    return None


def a_des_morphs(ad):
    # Le tag de registre evite de charger le maillage (et ses textures) ; on ne
    # charge qu'en son absence.
    valeur = ad.get_tag_value("MorphTargets")
    if valeur not in (None, "", "None"):
        try:
            return int(valeur) > 0
        except ValueError:
            pass
    try:
        mesh = ad.get_asset()
        return bool(mesh and len(mesh.get_editor_property("morph_targets")) > 0)
    except Exception:
        # Dans le doute, le drapeau de plus ne coute que des permutations de shader.
        return True


# ── 1. Les SkeletalMesh de Narvos et leurs materiaux (registre, sans charger) ──
filtre = unreal.ARFilter(
    class_paths=[unreal.TopLevelAssetPath("/Script/Engine", "SkeletalMesh")],
    package_paths=[RACINE.rstrip("/")],
    recursive_paths=True,
)
meshes = AR.get_assets(filtre) or []
journal("=== usage-skeletal (%s) : %d SkeletalMesh sous %s"
        % ("APPLIQUER" if APPLIQUER else "passe a blanc", len(meshes), RACINE))

materiaux = {}  # paquet du materiau cite -> {"morphs": bool, "meshes": int}
for k, ad in enumerate(meshes):
    if (k + 1) % LOT_GC == 0:
        unreal.SystemLibrary.collect_garbage()
    paquet_mesh = str(ad.package_name)
    morphs = None
    for dep in dependances_dures(paquet_mesh):
        if classe_de(dep) not in CLASSES_MATERIAU:
            continue
        if morphs is None:
            morphs = a_des_morphs(ad)
        entree = materiaux.setdefault(dep, {"morphs": False, "meshes": 0})
        entree["morphs"] = entree["morphs"] or morphs
        entree["meshes"] += 1
journal("    %d materiau(x) cite(s) par ces maillages" % len(materiaux))

# ── 2. Remonter a la base, decider ─────────────────────────────────────────────
bases = {}  # paquet de la base -> {"morphs": bool, "via": int}
illisibles = []
for i, (paquet, info) in enumerate(sorted(materiaux.items())):
    mi = unreal.load_asset(paquet)
    base = mi.get_base_material() if mi else None
    if base is None:
        illisibles.append(paquet)
        continue
    pb = base.get_outermost().get_name()
    entree = bases.setdefault(pb, {"morphs": False, "via": 0})
    entree["morphs"] = entree["morphs"] or info["morphs"]
    entree["via"] += 1
    if (i + 1) % LOT_GC == 0:
        mi = base = None
        unreal.SystemLibrary.collect_garbage()

deja, corriges, lies, hors, echecs, anciens = [], [], [], [], [], []
par_dossier = {}
for n, (pb, info) in enumerate(sorted(bases.items())):
    if not pb.startswith(RACINE):
        hors.append(pb)
        continue
    base = unreal.load_asset(pb)
    if base is None:
        echecs.append({"materiau": pb, "raison": "chargement"})
        continue
    drapeaux = ["used_with_skeletal_mesh"] + (["used_with_morph_targets"] if info["morphs"] else [])
    manquants = [d for d in drapeaux if not base.get_editor_property(d)]
    if not manquants:
        deja.append(pb)
        continue
    if lie_en_dur(pb):
        lies.append({"materiau": pb, "manquants": manquants})
        continue
    if anterieur_au_seuil(pb):
        anciens.append({"materiau": pb, "manquants": manquants})
        continue
    par_dossier[dossier_de(pb)] = par_dossier.get(dossier_de(pb), 0) + 1
    if not APPLIQUER:
        corriges.append({"materiau": pb, "drapeaux": manquants, "ecrit": False})
        continue
    try:
        for d in manquants:
            base.set_editor_property(d, True)
        ecrit = unreal.EditorAssetLibrary.save_loaded_asset(base, False)
        relus = [d for d in manquants if base.get_editor_property(d)]
        corriges.append({"materiau": pb, "drapeaux": manquants, "ecrit": bool(ecrit), "relus": relus})
        if not ecrit:
            echecs.append({"materiau": pb, "raison": "sauvegarde refusee"})
    except Exception as e:
        echecs.append({"materiau": pb, "raison": str(e)[:160]})
    if (n + 1) % LOT_GC == 0:
        base = None
        unreal.SystemLibrary.collect_garbage()
        journal("    ... %d/%d bases examinees" % (n + 1, len(bases)))

journal("    bases : %d ; deja bonnes %d ; %s %d ; liees en dur (non touchees) %d ; hors Narvos %d ; echecs %d ; illisibles %d"
        % (len(bases), len(deja), "corrigees" if APPLIQUER else "a corriger", len(corriges),
           len(lies), len(hors), len(echecs), len(illisibles)))
if SEUIL is not None:
    journal("    anterieures au %s (etat du 23/09, non touchees) : %d" % (_DEPUIS, len(anciens)))
for d, c in sorted(par_dossier.items(), key=lambda x: -x[1])[:15]:
    journal("      %5d  %s" % (c, d))
for e in echecs[:10]:
    journal("    ECHEC %s : %s" % (e["materiau"], e["raison"]))

with open(RAPPORT, "w", encoding="utf-8") as f:
    json.dump({
        "mode": "appliquer" if APPLIQUER else "passe_a_blanc",
        "meshes": len(meshes),
        "materiaux_cites": len(materiaux),
        "bases": len(bases),
        "deja": len(deja),
        "corriges": corriges,
        "lies_en_dur": lies,
        "anterieurs_au_seuil": anciens,
        "hors_narvos": hors,
        "echecs": echecs,
        "illisibles": illisibles,
        "par_dossier": par_dossier,
    }, f, ensure_ascii=False, indent=1)
journal("=== usage-skeletal : rapport %s" % RAPPORT)