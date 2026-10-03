# ══════════════════════════════════════════════════════════════════════════════
# adk-sonder-squelettes.py — « Invalid USkeleton » : asset cassé, ou artefact ?
#
#   UnrealEditor-Cmd.exe <ADK absolu>.uproject -run=pythonscript \
#     -script="<...>/scripts/adk-sonder-squelettes.py" -unattended -nosplash
#
# ⚠ CHEMIN DE PROJET ABSOLU. Un chemin relatif ne démarre même pas : code 1,
# aucun journal. Piège payé ce soir.
#
# ── LA QUESTION ───────────────────────────────────────────────────────────────
# `adk-animations-sans-squelette.py` a trouvé 1 925 AnimSequence sur 5 234 dont
# le squelette ne résout pas, dont 1 418 dans NARVOS_Retarget — notre propre
# sortie de retargeting.
#
# Avant d'exclure un tiers de la bibliothèque d'animations du cook, il faut
# séparer deux hypothèses qui donnent le même message :
#
#   A. l'asset est CASSÉ    — son squelette n'existe pas, ou plus ;
#   B. c'est un ARTEFACT    — le squelette existe mais ne se charge pas dans ce
#                             contexte de commandlet.
#
# Si c'est B, exclure ferait perdre 1 925 animations parfaitement saines.
#
# ── COMMENT ON TRANCHE ────────────────────────────────────────────────────────
# Le registre d'assets connaît les DÉPENDANCES d'un paquet sans le charger. Si
# la dépendance « squelette » est déclarée ET que l'asset visé existe, alors
# l'asset n'est pas cassé : c'est le chargement qui échoue. Si la dépendance
# pointe un paquet absent, il est bel et bien cassé.
# ══════════════════════════════════════════════════════════════════════════════

import json
import os

import unreal

SORTIE = os.environ.get(
    "NARVOS_SORTIE",
    "E:/narvosprime-web-prototype/WebPortal/Server/adk/_sonde-squelettes.json")

# Un échantillon par pack incriminé : si la cause est commune, elle se voit sur
# quelques fichiers ; inutile d'en charger deux mille.
PACKS = [
    "/Game/Narvos/NARVOS_Retarget",
    "/Game/Narvos/SmartLocomotion",
    "/Game/Narvos/Defender",
    "/Game/Narvos/MetaHumans",
    "/Game/Narvos/CoreC",
]
PAR_PACK = 4


def journal(m):
    unreal.log("[NARVOS] " + m)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)

resultats = []

for pack in PACKS:
    anims = [d for d in registre.get_assets_by_path(pack, recursive=True)
             if str(d.asset_class_path.asset_name) == "AnimSequence"]
    journal("%s : %d AnimSequence" % (pack, len(anims)))

    for d in anims[:PAR_PACK]:
        chemin = str(d.package_name)
        fiche = {"anim": chemin, "pack": pack}

        # 1. Les dépendances déclarées, SANS charger l'asset.
        try:
            deps = registre.get_dependencies(
                chemin, unreal.AssetRegistryDependencyOptions(include_hard_package_references=True))
            deps = [str(x) for x in (deps or [])]
        except Exception as e:
            deps = ["ERR " + str(e)[:80]]
        fiche["dependances"] = deps[:8]

        # 2. Parmi elles, laquelle est un squelette — et existe-t-elle ?
        squelettes = []
        for dep in deps:
            if not dep.startswith("/"):
                continue
            for a in registre.get_assets_by_package_name(dep):
                if str(a.asset_class_path.asset_name) == "Skeleton":
                    squelettes.append({
                        "chemin": dep,
                        "existe_sur_disque": unreal.EditorAssetLibrary.does_asset_exist(dep),
                    })
        fiche["squelettes_declares"] = squelettes

        # 3. Le chargement échoue-t-il vraiment ?
        try:
            asset = unreal.EditorAssetLibrary.load_asset(chemin)
            fiche["charge"] = asset is not None
            if asset is not None:
                sk = asset.get_editor_property("skeleton")
                fiche["squelette_resolu"] = (sk.get_path_name() if sk else None)
        except Exception as e:
            fiche["charge"] = False
            fiche["erreur"] = str(e)[:200]

        resultats.append(fiche)

journal("")
journal("=== VERDICT PAR ECHANTILLON")
for f in resultats:
    sk = f.get("squelettes_declares") or []
    etat = ("CASSE : aucun squelette declare" if not sk else
            ("CASSE : squelette declare ABSENT du disque"
             if not all(s["existe_sur_disque"] for s in sk)
             else "ARTEFACT : squelette declare et PRESENT"))
    journal("  %-58s %s" % (f["anim"].split("/")[-1][:58], etat))
    journal("      charge=%s  squelette_resolu=%s" % (f.get("charge"), f.get("squelette_resolu")))

with open(SORTIE, "w", encoding="utf-8") as fh:
    json.dump({"echantillons": resultats}, fh, indent=1, ensure_ascii=False)

journal("")
journal("ecrit : " + SORTIE)