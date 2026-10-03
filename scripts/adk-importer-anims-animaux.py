# -*- coding: utf-8 -*-
"""
adk-importer-anims-animaux.py — importer les animations des 41 especes.

    UnrealEditor-Cmd.exe <uproject> -run=pythonscript \
        -script=scripts/adk-importer-anims-animaux.py -unattended -nosplash -nopause

    NARVOS_APPLIQUER=1  pour importer (sinon : constat)

── LE SQUELETTE N'EST PAS OPTIONNEL ─────────────────────────────────────────────
⚠ **Une AnimSequence sans squelette TUE le cook.** Ce depot l'a paye : 1 925
AnimSequence orphelines sur 5 234 (`scripts/adk-balayer-anims-orphelines.py`).
Chaque animation doit donc etre importee EN VISANT le `USkeleton` de son espece,
`SK_<Espece>_Skeleton`, cree par l'import du modele.

Une animation visant le mauvais squelette n'echoue pas : elle deforme la bete.
On resout donc le squelette par le chemin de l'espece, jamais par ressemblance
de nom.

── ON NE PREDIT PAS LES NOMS ────────────────────────────────────────────────────
Un FBX peut porter PLUSIEURS prises, et Unreal cree alors une AnimSequence par
prise, nommee a sa facon. Predire ces noms dans le catalogue produirait des
references mortes muettes.

Ce script importe et RAPPORTE ce qui existe. Le catalogue lira ensuite
`Assets.toml` — la verite cuite — au lieu de la deviner.

── LES DEUX PIEGES DEJA PAYES CE SOIR ───────────────────────────────────────────
· `Interchange` ouvre une fenetre de resultats qu'un commandlet n'a pas :
  `Assertion failed: CurrentApplication.IsValid()`. On le desactive pour le FBX.
· Un `appError` tue le processus, Python ne peut pas l'attraper : on importe UN
  fichier a la fois et on sauve tout de suite, pour que la relance reprenne.
"""
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

RACINE = "E:/narvosprime-web-prototype"
SOURCE = (
    RACINE
    + "/WebPortal/public/asset_game/moteur_unity/jsuko_extrait/Assets/JSAllAnimals"
)
CATALOGUE = (
    RACINE + "/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Animaux.lua"
)
DESTINATION = "/Game/Narvos/JSAnimals"
APPLIQUER = os.environ.get("NARVOS_APPLIQUER") == "1"


def dire(t):
    print(t)
    unreal.log(t)


import re

if not os.path.exists(CATALOGUE):
    dire("ARRET : catalogue absent — node scripts/narvos-animaux-to-lua.mjs --apply")
    sys.exit(1)

with open(CATALOGUE, encoding="utf-8") as f:
    texte = f.read()

entrees = []
for bloc in re.finditer(
    r'\{\s*id\s*=\s*"([^"]+)".*?mesh\s*=\s*"([^"]+)".*?source\s*=\s*"([^"]+)"\s*\}',
    texte,
    re.S,
):
    entrees.append({"id": bloc.group(1), "mesh": bloc.group(2), "source": bloc.group(3)})

if not entrees:
    dire("ARRET : aucune espece lue dans le catalogue.")
    sys.exit(1)

dire("%d espece(s) — mode : %s" % (len(entrees), "IMPORT" if APPLIQUER else "constat"))

# ── Recensement : quelles animations, pour quel squelette ────────────────────
travaux = []          # (espece, dossier_cible, squelette, [fbx…])
sans_anim = []
sans_squelette = []

for e in entrees:
    nom_espece = e["mesh"][3:]                       # SK_Capybara -> Capybara
    # Le dossier d'animations vit a cote de `Models/`, donc au niveau de
    # l'espece — que `source` porte sous la forme "<taxon>/Models[/Bodies]/x.FBX".
    taxon = e["source"].split("/Models")[0]
    dossier_anims = os.path.join(SOURCE, taxon, "Animations")

    if not os.path.isdir(dossier_anims):
        sans_anim.append(e["id"])
        continue

    # ⚠ DESCENDRE DANS LES SOUS-DOSSIERS. Un premier jet lisait `os.listdir`
    # et annoncait 205 fichiers la ou le disque en porte 230 : huit especes
    # rangent une partie de leurs animations dans un sous-dossier. Vingt-cinq
    # animations perdues sans un mot.
    #
    # Deux natures, et elles ne se traitent pas pareil :
    #   · `Old/`     — versions perimees. Ecartees, comme pour les modeles :
    #                  deux animations pour le meme geste, dont une ancienne,
    #                  et rien ne dirait laquelle est laquelle.
    #   · `OnPlace/` — variantes SUR PLACE, sans root motion. Gardees, et
    #                  precieuses : le compagnon est deplace par `MoveTo`, une
    #                  animation qui translate AUSSI se battrait avec lui. Leur
    #                  nom se termine par « OnPlace », donc l'executant peut les
    #                  preferer sans qu'on ait a les etiqueter.
    fbx = []
    for racine, dossiers, fichiers in os.walk(dossier_anims):
        dossiers[:] = [d for d in dossiers if d.lower() != "old"]
        for f in fichiers:
            if f.lower().endswith(".fbx"):
                fbx.append(os.path.relpath(os.path.join(racine, f), dossier_anims))
    fbx.sort()
    if not fbx:
        sans_anim.append(e["id"])
        continue

    # ⚠ LE SQUELETTE. Resolu par le CHEMIN de l'espece, jamais par ressemblance.
    chemin_sk = "%s/%s/%s_Skeleton" % (DESTINATION, nom_espece, e["mesh"])
    squelette = unreal.EditorAssetLibrary.load_asset(chemin_sk)
    if squelette is None:
        sans_squelette.append("%s : %s" % (e["id"], chemin_sk))
        continue

    travaux.append({
        "id": e["id"],
        "espece": nom_espece,
        "dossier_source": dossier_anims,
        "cible": "%s/%s/Anims" % (DESTINATION, nom_espece),
        "squelette": squelette,
        "fbx": fbx,
    })

total_fbx = sum(len(t["fbx"]) for t in travaux)
dire("  %d espece(s) animee(s), %d fichier(s) d'animation" % (len(travaux), total_fbx))
if sans_anim:
    dire("  sans animation (%d) : %s" % (len(sans_anim), ", ".join(sans_anim)))
if sans_squelette:
    # ⚠ ROUGE, pas une note. Sans squelette on ne peut PAS importer l'animation,
    # et une AnimSequence orpheline tuerait le cook entier.
    dire("")
    dire("SQUELETTE INTROUVABLE (%d) :" % len(sans_squelette))
    for s in sans_squelette:
        dire("  %s" % s)
    dire("  Le modele de ces especes n'est pas importe : lancer d'abord")
    dire("  scripts/adk-importer-animaux.py")

if total_fbx == 0:
    dire("")
    dire("ROUGE : aucune animation a importer — rien n'a ete mesure.")
    sys.exit(1)

if not APPLIQUER:
    dire("")
    dire("(constat — poser NARVOS_APPLIQUER=1 pour importer)")
    sys.exit(1 if sans_squelette else 0)

# ── Import ───────────────────────────────────────────────────────────────────
unreal.SystemLibrary.execute_console_command(
    None, "Interchange.FeatureFlags.Import.FBX 0")
dire("Interchange desactive pour le FBX.")

outils = unreal.AssetToolsHelpers.get_asset_tools()
faits, ignores = 0, 0
reglages_refuses = {}      # propriete d'import absente de cette version
echecs = []                # fichier -> rien produit

for t in travaux:
    for nom_fichier in t["fbx"]:
        # `nom_fichier` peut porter un sous-dossier ("OnPlace/xxx.FBX") : le nom
        # d'asset ne garde que la feuille. Les noms de fichier portent deja
        # « OnPlace », donc rien ne se perd — verifie : aucun doublon sur les
        # 230 fichiers, sous-dossiers compris.
        base = os.path.splitext(os.path.basename(nom_fichier))[0]
        # Prefixe `A_` : convention du depot pour une AnimSequence. Les noms de
        # fichier portent deja l'espece (CapybaraAnimationIdle1), et aucun
        # doublon n'existe entre especes — verifie sur les 232 fichiers.
        nom_asset = "A_" + base
        chemin = "%s/%s" % (t["cible"], nom_asset)

        # Reprise : une animation deja importee n'est pas refaite.
        if unreal.EditorAssetLibrary.does_asset_exist(chemin):
            ignores += 1
            continue

        options = unreal.FbxImportUI()
        options.set_editor_property("import_mesh", False)
        options.set_editor_property("import_materials", False)
        options.set_editor_property("import_textures", False)
        options.set_editor_property("import_as_skeletal", True)
        options.set_editor_property("import_animations", True)
        options.set_editor_property("mesh_type_to_import",
                                    unreal.FBXImportType.FBXIT_ANIMATION)
        # LE point qui compte.
        options.set_editor_property("skeleton", t["squelette"])

        anim = options.anim_sequence_import_data
        # Meme facteur que le modele : Unity exporte en metres, Unreal travaille
        # en centimetres. Une animation a l'echelle 1 sur un mesh a l'echelle 100
        # donnerait des translations cent fois trop petites.
        anim.set_editor_property("import_uniform_scale", 100.0)
        anim.set_editor_property("import_custom_attribute", True)
        anim.set_editor_property("remove_redundant_keys", True)

        # ⚠ LA CADENCE. 102 imports sur 227 ont echoue au premier passage, tous
        # sur la meme erreur, dite mot pour mot par le moteur :
        #
        #   Animation length 27,917 is not compatible with import frame-rate
        #   30 fps (sub frame 0,5), animation has to be frame-border aligned.
        #
        # Unity n'echantillonne pas a 30 fps entiers : la duree du clip tombe
        # entre deux frames, et l'importeur REFUSE. Rien n'apparaissait ensuite
        # cote Unreal — 102 animations perdues sans autre trace que cette ligne
        # au milieu de 40 000.
        #
        # Deux reglages, ensemble :
        #   · ne pas imposer 30 fps — prendre la cadence du FICHIER ;
        #   · accepter d'aligner sur la frontiere la plus proche quand elle
        #     tombe quand meme entre deux frames.
        for propriete, valeur in (
            ("use_default_sample_rate", False),
            ("custom_sample_rate", 0),            # 0 = cadence du fichier
            ("snap_to_closest_frame_boundary", True),
        ):
            try:
                anim.set_editor_property(propriete, valeur)
            except Exception as err:
                # Une propriete absente de cette version du moteur doit se VOIR,
                # pas se taire : sans elle l'import echouera de nouveau, et on
                # chercherait ailleurs.
                if propriete not in reglages_refuses:
                    reglages_refuses[propriete] = str(err)

        tache = unreal.AssetImportTask()
        tache.set_editor_property("filename",
                                  os.path.join(t["dossier_source"], nom_fichier))
        tache.set_editor_property("destination_path", t["cible"])
        tache.set_editor_property("destination_name", nom_asset)
        tache.set_editor_property("automated", True)
        tache.set_editor_property("replace_existing", True)
        tache.set_editor_property("save", False)
        tache.set_editor_property("options", options)

        outils.import_asset_tasks([tache])
        unreal.EditorAssetLibrary.save_directory(t["cible"], only_if_is_dirty=False,
                                                 recursive=True)
        # ⚠ `import_asset_tasks` ne leve pas quand l'import echoue : il ecrit un
        # avertissement au milieu du journal et rend la main. Le seul temoin est
        # l'existence de l'asset.
        if not unreal.EditorAssetLibrary.does_asset_exist(chemin):
            echecs.append("%s / %s" % (t["id"], nom_fichier))
        faits += 1
        if faits % 10 == 0 or faits == total_fbx:
            dire("  [%3d/%3d] %s" % (faits, total_fbx, nom_asset))

# ── LE TEMOIN ────────────────────────────────────────────────────────────────
# Pas « l'import a tourne » : combien d'AnimSequence existent, et ONT-ELLES un
# squelette. Une orpheline tue le cook — mieux vaut le savoir ici.
dire("")
if reglages_refuses:
    dire("REGLAGES D'IMPORT REFUSES PAR LE MOTEUR :")
    for k, v in reglages_refuses.items():
        dire("  %s : %s" % (k, v))
    dire("  Sans eux, les clips non alignes sur la frame echouent.")

if echecs:
    dire("")
    dire("N'ONT RIEN PRODUIT (%d) :" % len(echecs))
    for e in echecs[:20]:
        dire("  %s" % e)
    if len(echecs) > 20:
        dire("  ... et %d autre(s)." % (len(echecs) - 20))
    dire("  Chercher la raison dans le journal : FBXImport: Error:")

dire("")
dire("=== TEMOIN : ce qui existe vraiment ===")
ar = unreal.AssetRegistryHelpers.get_asset_registry()
total, orphelines, par_espece = 0, [], {}

for t in travaux:
    assets = ar.get_assets_by_path(t["cible"], recursive=True)
    n = 0
    for a in assets:
        if str(a.asset_class_path.asset_name) != "AnimSequence":
            continue
        total += 1
        n += 1
        obj = unreal.EditorAssetLibrary.load_asset(str(a.package_name))
        sk = None
        try:
            sk = obj.get_editor_property("skeleton")
        except Exception:
            pass
        if sk is None:
            orphelines.append(str(a.package_name))
    par_espece[t["id"]] = n

dire("  %d AnimSequence sous %s" % (total, DESTINATION))
dire("  %d fichier(s) importe(s) ce passage, %d deja present(s)" % (faits, ignores))
manquantes = [i for i, n in par_espece.items() if n == 0]
if manquantes:
    dire("  ESPECES SANS AUCUNE ANIMSEQUENCE : %s" % ", ".join(manquantes))

if orphelines:
    dire("")
    dire("ROUGE : %d AnimSequence SANS SQUELETTE. Elles tueraient le cook."
         % len(orphelines))
    for o in orphelines[:15]:
        dire("  %s" % o)
    sys.exit(1)

if total == 0:
    dire("")
    dire("ROUGE : aucune AnimSequence produite.")
    sys.exit(1)

dire("")
dire("  Toutes les AnimSequence portent un squelette.")
dire("  ⚠ Importe n'est pas cuit : cook, inventaire, pack, puis regenerer le")
dire("    catalogue (il lira Assets.toml, il ne devinera pas les noms de prise).")