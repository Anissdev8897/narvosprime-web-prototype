# -*- coding: utf-8 -*-
"""
adk-importer-animaux.py — importer les 41 especes du pack J.Suko dans l'ADK.

    UnrealEditor-Cmd.exe <uproject> -run=pythonscript \
        -script=scripts/adk-importer-animaux.py -unattended -nosplash -nopause

    NARVOS_APPLIQUER=1  pour importer (sinon : constat de ce qui serait fait)

── LE MAILLON QUI MANQUE ────────────────────────────────────────────────────────
`Shared/Catalogs/Animaux.lua` liste 41 especes avec `cuit = false` pour les 41 :
leurs FBX sont sur le disque, aucun n'est un asset Unreal. `CharacterSimple` sur
une reference morte ne leve RIEN — la bete n'apparait pas, sans le moindre
signal. Ce script fait entrer les meshes dans le projet ; le cook les declare
ensuite dans `Assets.toml`, et une re-execution du generateur bascule les
drapeaux.

── LA CONVENTION DE NOM, ET POURQUOI ELLE N'EST PAS NEGOCIABLE ─────────────────
Le catalogue promet `SK_<Espece>` (ex. `SK_Capybara`). L'import DOIT produire
exactement ce nom, sinon `Assets.toml` declarera une cle que le catalogue ne
cherche pas — et personne ne le verra avant d'essayer d'invoquer.

⚠ `CreateUniqueAssetName` renomme sans le dire quand un nom existe deja
([[reference-retarget-batch-ue]]). On verifie donc le nom OBTENU, pas le nom
demande.

── STATIQUE OU SQUELETTIQUE ────────────────────────────────────────────────────
On demande `import_as_skeletal`. Si un FBX n'a pas de peau, Unreal produit un
StaticMesh — ce qui reste utilisable (`CharacterSimple` accepte les deux) mais
ne s'animera pas. Le script RAPPORTE la classe obtenue espece par espece plutot
que de la supposer : c'est la difference entre un compagnon vivant et une
statue qui glisse.
"""
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal


PREFIXE_LONG = "\\\\?\\"      # quatre antislashs en source = \\?\ a l'execution


def chemin_long(p):
    """Contourne MAX_PATH sur Windows (260 caracteres).

    Le prefixe est `\\\\?\\` — deux antislashs, un point d'interrogation, un
    antislash. L'ecrire a la main dans une chaine Python est le genre de detail
    qui se rate en silence : `"\\?\\"` donne UN antislash et le chemin devient
    invalide sans que rien ne le dise. D'ou la constante, ecrite une fois.
    """
    if os.name != "nt":
        return p
    a = os.path.abspath(p)
    if a.startswith(PREFIXE_LONG):
        return a
    return PREFIXE_LONG + a

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


# ── Lire le catalogue : c'est LUI qui dit quoi importer ──────────────────────
# Pas un re-parcours du disque. Le catalogue a deja tranche les cas (dossiers
# `Old/`, especes sans libelle, corps range sous `Models/Bodies/`) ; refaire ce
# tri ici le ferait diverger au premier changement.
if not os.path.exists(CATALOGUE):
    dire("ARRET : catalogue absent — node scripts/narvos-animaux-to-lua.mjs --apply")
    sys.exit(1)

import re

texte = open(CATALOGUE, encoding="utf-8").read()
entrees = []
for bloc in re.finditer(
    r'\{\s*id\s*=\s*"([^"]+)".*?mesh\s*=\s*"([^"]+)".*?source\s*=\s*"([^"]+)"\s*\}',
    texte,
    re.S,
):
    entrees.append({"id": bloc.group(1), "mesh": bloc.group(2), "source": bloc.group(3)})

if not entrees:
    # Zero cible = ROUGE. Un import qui n'importe rien n'est pas un succes.
    dire("ARRET : aucune espece lue dans le catalogue — regex ou format changes.")
    sys.exit(1)

dire("%d espece(s) au catalogue — mode : %s"
     % (len(entrees), "IMPORT" if APPLIQUER else "constat seul"))

manquants, taches, deja = [], [], []
for e in entrees:
    fbx = os.path.join(SOURCE, e["source"]).replace("\\", "/")
    # ⚠ MAX_PATH. La taxonomie du pack (regne/classe/ordre/espece/Models/Old)
    # depasse 260 caracteres pour au moins une espece — la tortue alligator a
    # deja fait echouer l'extraction pour cette raison. `os.path.exists` rend
    # False sur un chemin trop long, ce qui se lit « fichier absent ».
    if not os.path.exists(chemin_long(fbx)):
        manquants.append("%s : %s" % (e["id"], e["source"]))
        continue

    dossier = "%s/%s" % (DESTINATION, e["mesh"][3:])   # SK_Capybara -> Capybara
    chemin = "%s/%s" % (dossier, e["mesh"])
    if unreal.EditorAssetLibrary.does_asset_exist(chemin):
        deja.append(e["mesh"])
        continue

    if not APPLIQUER:
        continue

    options = unreal.FbxImportUI()
    options.set_editor_property("import_mesh", True)
    options.set_editor_property("import_textures", True)
    options.set_editor_property("import_materials", True)
    # Les animations viennent dans un second temps : un FBX de modele n'en
    # porte pas, et les demander ferait echouer l'import sur une piste absente.
    options.set_editor_property("import_animations", False)
    options.set_editor_property("import_as_skeletal", True)
    options.set_editor_property("mesh_type_to_import",
                                unreal.FBXImportType.FBXIT_SKELETAL_MESH)

    sk = options.skeletal_mesh_import_data
    sk.set_editor_property("import_morph_targets", True)
    sk.set_editor_property("update_skeleton_reference_pose", False)
    # ⚠ Unity exporte en METRES, Unreal travaille en CENTIMETRES. Sans facteur,
    # les betes arrivent hautes de 1,7 cm : presentes, invisibles. Le depot a
    # deja paye ce piege sur 31 PNJ ([[reference-unites-metre-centimetre]]).
    sk.set_editor_property("import_uniform_scale", 100.0)

    tache = unreal.AssetImportTask()
    tache.set_editor_property("filename", fbx)
    tache.set_editor_property("destination_path", dossier)
    tache.set_editor_property("destination_name", e["mesh"])
    tache.set_editor_property("automated", True)
    tache.set_editor_property("replace_existing", True)
    # ⚠ `save = True` FAIT PLANTER le commandlet. Mesure du 2026-09-10 :
    # l'import de la premiere espece a reussi (SK_Ammonite + squelette +
    # materiaux ecrits), puis :
    #     Assertion failed: CurrentApplication.IsValid()
    #     [SlateApplication.h:321]   Script Stack : AssetTools.ImportAssetTasks
    # `save = True` passe par `InternalPromptForCheckoutAndSave`, qui veut une
    # application Slate — inexistante sous `-unattended -nosplash`. On sauve
    # apres coup avec `save_directory`, qui est headless.
    tache.set_editor_property("save", False)
    tache.set_editor_property("options", options)
    taches.append((e, tache))

if manquants:
    dire("")
    dire("FBX ABSENTS (%d) — le catalogue cite un fichier qui n'est pas la :" % len(manquants))
    for m in manquants:
        dire("  %s" % m)

if deja:
    dire("")
    dire("DEJA IMPORTE(S) (%d) : %s" % (len(deja), ", ".join(sorted(deja)[:8])
                                        + (" …" if len(deja) > 8 else "")))

if not APPLIQUER:
    dire("")
    dire("%d espece(s) seraient importee(s) sous %s" % (
        len(entrees) - len(manquants) - len(deja), DESTINATION))
    dire("(constat seul — poser NARVOS_APPLIQUER=1 pour importer)")
    sys.exit(1 if manquants else 0)

if not taches:
    dire("")
    dire("Rien a importer.")
    sys.exit(1 if manquants else 0)

dire("")

# ⚠ INTERCHANGE OUVRE UNE FENETRE, ET UN COMMANDLET N'EN A PAS.
#
# Deux plantages identiques le 2026-09-10 :
#     Assertion failed: CurrentApplication.IsValid()  [SlateApplication.h:321]
#     Script Stack : AssetTools.ImportAssetTasks
# Le premier a ete impute a `save = True` (qui passe par
# `InternalPromptForCheckoutAndSave`). Faux : avec `save = False`, le mesh a ete
# BATI (« Built Skeletal Mesh SK_Anomalocaris ») et l'assertion est revenue au
# meme endroit, juste apres deux `LogInterchangeEngine: Warning:`.
#
# C'est le pipeline **Interchange** qui, en fin d'import, affiche sa fenetre de
# resultats des qu'il a un avertissement. `automated = True` ne l'en empeche pas.
# On le desactive pour le FBX : l'importeur historique fait le meme travail sans
# Slate.
unreal.SystemLibrary.execute_console_command(
    None, "Interchange.FeatureFlags.Import.FBX 0")
dire("Interchange desactive pour le FBX (il ouvre une fenetre que le commandlet n'a pas).")

dire("Import de %d espece(s)…" % len(taches))
outils = unreal.AssetToolsHelpers.get_asset_tools()

# ⚠ UNE ESPECE A LA FOIS, SAUVEE TOUT DE SUITE. Un `appError` tue le processus :
# Python ne peut pas l'attraper. En important le lot d'un bloc, un plantage a la
# 39e perdait les 38 precedentes. Espece par espece, le travail deja fait reste
# sur le disque et la relance reprend ou elle s'est arretee (les especes deja
# importees sont ignorees plus haut).
faits = 0
for e, tache in taches:
    outils.import_asset_tasks([tache])
    dossier = "%s/%s" % (DESTINATION, e["mesh"][3:])
    unreal.EditorAssetLibrary.save_directory(dossier, only_if_is_dirty=False,
                                             recursive=True)
    faits += 1
    dire("  [%2d/%2d] %s" % (faits, len(taches), e["mesh"]))

# ── LE TEMOIN ────────────────────────────────────────────────────────────────
# `import_asset_tasks` ne leve pas sur echec, et `imported_object_paths` peut
# porter un nom AUTRE que celui demande. On relit ce qui existe VRAIMENT, sous
# le nom que le catalogue promet.
dire("")
dire("=== TEMOIN : ce qui existe vraiment ===")
ok, rates, classes = 0, [], {}
for e, tache in taches:
    chemin = "%s/%s/%s" % (DESTINATION, e["mesh"][3:], e["mesh"])
    if not unreal.EditorAssetLibrary.does_asset_exist(chemin):
        obtenus = list(tache.get_editor_property("imported_object_paths") or [])
        rates.append("%s : attendu %s, obtenu %s"
                     % (e["id"], chemin, obtenus or "RIEN"))
        continue
    obj = unreal.EditorAssetLibrary.load_asset(chemin)
    classe = type(obj).__name__ if obj else "?"
    classes[classe] = classes.get(classe, 0) + 1
    ok += 1

dire("  %d / %d importe(s) sous le nom promis" % (ok, len(taches)))
for c, n in sorted(classes.items()):
    dire("    %-20s %d" % (c, n))
for r in rates[:20]:
    dire("  ECHEC : %s" % r)

if classes.get("StaticMesh"):
    dire("")
    dire("  ⚠ %d espece(s) sont arrivees en StaticMesh : leur FBX n'a pas de peau."
         % classes["StaticMesh"])
    dire("    CharacterSimple les accepte — elles glisseront sans s'animer.")

if rates or ok == 0:
    dire("")
    dire("ROUGE : %d echec(s) sur %d." % (len(rates), len(taches)))
    sys.exit(1)

dire("")
dire("  ⚠ Importe n'est pas cuit. Prochaine etape : cook, puis")
dire("    node scripts/narvos-animaux-to-lua.mjs --apply  (bascule les drapeaux)")