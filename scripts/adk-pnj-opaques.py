# -*- coding: utf-8 -*-
"""
adk-pnj-opaques.py — rend OPAQUES les materiaux translucides des PNJ Meshy.

    (editeur COMPLET ouvert)  py -3 scripts/ue-remote.py --statement \
        "import os; os.environ['NARVOS_APPLIQUER']='1'; exec(open(r'E:/narvosprime-web-prototype/scripts/adk-pnj-opaques.py', encoding='utf-8').read())"
    NARVOS_APPLIQUER=1   ecrire ; sinon passe a blanc (liste seulement)

-- LE DEFAUT (RAPPORT_PNJ_2026-09-13 §3, retour de jeu « on voit a travers ») -----
Les glTF « Merged_Animations » des PNJ Meshy (export Blender I/O 4.2.57) portent
`alphaMode: BLEND`. Interchange en a fait des UMaterial `BLEND_Translucent` : tri
de profondeur casse, faces internes visibles, PNJ « transparents ». Aucune de leurs
images n'a d'alpha (WebP VP8 sans alpha, PNG RGB) : le mode BLEND ne sert a rien.
Mesure cote pack cuit : 12 maillages translucides (lib/uasset-materiaux.mjs).

-- REGLES ----------------------------------------------------------------------
  · editeur COMPLET seulement : un UMaterial sauve en commandlet perd son graphe
    (reference_automaterial_gris) ;
  · seulement /Game/Narvos/pnj/ et /Game/Narvos/pnj_monstre/, seulement les
    UMaterial en BLEND_Translucent ;
  · jamais un fichier LIE EN DUR (st_nlink > 1) ;
  · recompiler puis SAUVER chaque materiau aussitot (only_if_is_dirty=False) ;
  · la preuve n'est pas la relecture dans ce processus : c'est l'absence de
    `BLEND_Translucent` dans le .uasset relu apres, et dans le pack cuit apres cook.

Rapport : WebPortal/Server/adk/_manifests/pnj-opaques.json
"""
import json
import os
import sys

import unreal

APPLIQUER = os.environ.get("NARVOS_APPLIQUER") == "1"
RAPPORT = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/pnj-opaques.json"
RACINES = ("/Game/Narvos/pnj", "/Game/Narvos/pnj_monstre")
CONTENT = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_content_dir())


def journal(m):
    unreal.log("[NARVOS] " + m)
    sys.stdout.write("[NARVOS] " + m + "\n")


def fichier_de(package_name):
    return os.path.join(CONTENT, package_name[len("/Game/"):] + ".uasset")


registre = unreal.AssetRegistryHelpers.get_asset_registry()
filtre = unreal.ARFilter(
    package_paths=list(RACINES),
    recursive_paths=True,
    class_paths=[unreal.TopLevelAssetPath("/Script/Engine", "Material")],
)
donnees = registre.get_assets(filtre)
journal("=== pnj-opaques (%s) : %d materiau(x) sous %s"
        % ("APPLIQUER" if APPLIQUER else "passe a blanc", len(donnees), ", ".join(RACINES)))

translucides, corriges, lies, echecs, deja = [], [], [], [], 0
for d in donnees:
    pkg = str(d.package_name)
    objet = "%s.%s" % (pkg, d.asset_name)
    mat = unreal.load_asset(objet)
    if mat is None:
        echecs.append({"materiau": objet, "raison": "chargement impossible"})
        continue
    if mat.get_editor_property("blend_mode") != unreal.BlendMode.BLEND_TRANSLUCENT:
        deja += 1
        continue
    translucides.append(objet)
    f = fichier_de(pkg)
    try:
        if os.path.exists(f) and os.stat(f).st_nlink > 1:
            lies.append(objet)
            continue
    except OSError:
        pass
    if not APPLIQUER:
        continue
    try:
        mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_OPAQUE)
        unreal.MaterialEditingLibrary.recompile_material(mat)
        ecrit = unreal.EditorAssetLibrary.save_loaded_asset(mat, False)
        relu = mat.get_editor_property("blend_mode") == unreal.BlendMode.BLEND_OPAQUE
        corriges.append({"materiau": objet, "ecrit": bool(ecrit), "relu_opaque": bool(relu)})
        if not ecrit:
            echecs.append({"materiau": objet, "raison": "sauvegarde refusee"})
    except Exception as e:
        echecs.append({"materiau": objet, "raison": str(e)[:160]})

journal("    translucides %d ; %s %d ; deja opaques %d ; lies en dur (non touches) %d ; echecs %d"
        % (len(translucides), "corriges" if APPLIQUER else "a corriger",
           len(corriges) if APPLIQUER else len(translucides) - len(lies), deja, len(lies), len(echecs)))
for e in echecs[:10]:
    journal("    ECHEC %s : %s" % (e["materiau"], e["raison"]))

with open(RAPPORT, "w", encoding="utf-8") as fh:
    json.dump({
        "mode": "appliquer" if APPLIQUER else "passe_a_blanc",
        "examines": len(donnees),
        "translucides": translucides,
        "corriges": corriges,
        "lies_en_dur": lies,
        "echecs": echecs,
    }, fh, ensure_ascii=False, indent=1)
journal("=== pnj-opaques : rapport %s" % RAPPORT)