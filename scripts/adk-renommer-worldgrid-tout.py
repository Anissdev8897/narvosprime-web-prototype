# ══════════════════════════════════════════════════════════════════════════════
# adk-renommer-worldgrid-tout.py — sortir TOUT asset d'un nom réservé du moteur.
#
#   Depuis l'éditeur ouvert (MCP / Python console) :
#       exec(open(r"...\adk-renommer-worldgrid-tout.py", encoding="utf-8").read())
#
# ── POURQUOI CE FICHIER EN PLUS DE `adk-renommer-worldgrid.py` ────────────────
# Le premier est codé en dur sur `/Game/Narvos/Meshes/Trooper_Set` et sur ses
# quatre morphologies, écrites à la main. C'était juste quand le défaut n'était
# connu que là.
#
# Mesuré le 2026-09-08 : sur les 64 pièces modulaires réimportées depuis
# `_parts_png`, **42 matériaux sur 70 s'appellent `WorldGridMaterial`** — le nom
# du matériau de remplacement d'Unreal (`/Engine/EngineMaterials/WorldGridMaterial`).
# Le défaut n'était pas propre à Trooper : il vient de l'exportateur glTF, et il
# touche tout pack passé par lui.
#
# Un garde-fou qui ne couvre que le lieu du premier incident ne garde rien. Ce
# script filtre sur la FORME du défaut — « un asset de projet portant un nom
# réservé du moteur » — partout sous /Game/Narvos.
#
# ── CE QU'IL NE PROUVE PAS ────────────────────────────────────────────────────
# Il ne prouve PAS que la collision de nom est la cause du gris. Le graphe du
# matériau n'est pas lisible depuis Python (`expression_collection` n'existe pas
# en 5.7). Ce qu'il fait est utile dans les deux cas : il retire un homonyme
# dangereux, et il rend le diagnostic suivant lisible — si le gris persiste, la
# cause est le câblage du graphe, et il faudra construire un vrai matériau.
#
# `rename_asset` réécrit les références : les meshes suivent sans qu'on y touche.
# ══════════════════════════════════════════════════════════════════════════════

import unreal

RACINE = "/Game/Narvos"

# Suffixe d'origine -> suffixe lisible. Le matériau (clé vide) passe EN PREMIER :
# renommer une texture avant lui laisserait le matériau pointer une seconde vers
# un nom disparu.
SUFFIXES = [
    ("", "M_{nom}"),
    ("_BaseColor", "T_{nom}_BaseColor"),
    ("_MetallicRoughness", "T_{nom}_ORM"),
    ("_Normal", "T_{nom}_Normal"),
    ("_Occlusion", "T_{nom}_AO"),
    ("_Emissive", "T_{nom}_Emissive"),
    ("_Specular", "T_{nom}_Specular"),
]


def journal(message):
    unreal.log("[NARVOS] " + str(message))


registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)

# Les DOSSIERS qui contiennent au moins un asset au nom réservé.
dossiers = set()
for d in registre.get_assets_by_path(unreal.Name(RACINE), recursive=True):
    if str(d.asset_name).startswith("WorldGridMaterial"):
        dossiers.add(str(d.package_path))

journal("%d dossier(s) portent un asset nomme WorldGridMaterial*" % len(dossiers))

renommes, echecs, deja = 0, 0, 0
touches = set()

for dossier in sorted(dossiers):
    # ⚠ LE NOM VIENT DU CHEMIN, ET IL DOIT ETRE UNIQUE.
    # `/Game/Narvos/ue4_mannequin` -> `Narvos_ue4_mannequin`. Deux dossiers
    # differents ne peuvent pas produire le meme nom : c'est ce qui evite de
    # remplacer une collision moteur par une collision entre nos propres packs.
    relatif = dossier[len(RACINE) + 1:] if dossier.startswith(RACINE + "/") else dossier.strip("/")
    base = relatif.replace("/", "_") or "Narvos"

    for suffixe, gabarit in SUFFIXES:
        source = "%s/WorldGridMaterial%s" % (dossier, suffixe)
        if not unreal.EditorAssetLibrary.does_asset_exist(source):
            continue
        cible = "%s/%s" % (dossier, gabarit.format(nom=base))
        if unreal.EditorAssetLibrary.does_asset_exist(cible):
            deja += 1
            continue
        if unreal.EditorAssetLibrary.rename_asset(source, cible):
            renommes += 1
            touches.add(dossier)
        else:
            echecs += 1
            journal("  ECHEC %s" % source)

journal("")
journal("%d renomme(s), %d deja fait(s), %d echec(s), %d dossier(s) touche(s)"
        % (renommes, deja, echecs, len(touches)))

# Les meshes ont vu leurs références réécrites : les resauver, sinon le prochain
# cook repartirait de l'ancien nom.
#
# ⚠ `only_if_is_dirty=False` sur les DOSSIERS TOUCHES seulement. Le passer sur
# /Game/Narvos entier reecrirait les 80 000 assets du pack — 13 Go, mesure le
# 2026-09-02 sur exactement cette erreur.
for dossier in sorted(touches):
    unreal.EditorAssetLibrary.save_directory(dossier, only_if_is_dirty=False, recursive=True)
journal("%d dossier(s) resauve(s)" % len(touches))

# ── Contrôle : seul un recomptage prouve une écriture ─────────────────────────
registre.search_all_assets(True)
restants = [str(d.package_name) for d in registre.get_assets_by_path(unreal.Name(RACINE), recursive=True)
            if str(d.asset_name).startswith("WorldGridMaterial")]
if restants:
    journal("ATTENTION %d asset(s) portent encore le nom reserve :" % len(restants))
    for r in restants[:8]:
        journal("    " + r)
else:
    journal("Plus aucun asset nomme WorldGridMaterial sous " + RACINE)