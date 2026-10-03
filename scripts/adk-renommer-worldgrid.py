# ══════════════════════════════════════════════════════════════════════════════
# adk-renommer-worldgrid.py — sortir les matériaux trooper d'un nom réservé.
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript
#       -script=".../adk-renommer-worldgrid.py"
#
# ── LE DÉFAUT ─────────────────────────────────────────────────────────────────
# Les GLB de SciFi_Trooper_Set nomment leur matériau **`WorldGridMaterial`**,
# c'est-à-dire exactement le nom du matériau de remplacement d'Unreal
# (`/Engine/EngineMaterials/WorldGridMaterial`). Interchange a donc créé, dans
# chacun des quatre sous-dossiers :
#
#     WorldGridMaterial                    (Material)
#     WorldGridMaterial_BaseColor          (Texture2D)
#     WorldGridMaterial_MetallicRoughness  (Texture2D)
#     WorldGridMaterial_Normal             (Texture2D)
#
# Tout est présent, y compris dans le pack cuit — et les 67 pièces sortent
# GRISES en jeu. Un asset de projet qui porte le nom d'un asset moteur est un
# risque de résolution qu'on ne devrait jamais courir : le pack est monté sous un
# autre point de montage, et rien ne garantit lequel des deux gagne.
#
# ── CE QUE CE SCRIPT NE PROUVE PAS ────────────────────────────────────────────
# Il ne prouve PAS que la collision de nom est la cause du gris. Le graphe du
# matériau n'est pas lisible depuis Python (`expressions` est protégé), donc on
# ne sait pas si ses textures y sont câblées.
#
# Ce qu'il fait est utile dans les deux cas : il retire un homonyme dangereux, et
# il rend le diagnostic suivant lisible — si le gris persiste après renommage, la
# cause est le câblage du graphe, et il faudra construire un vrai matériau.
#
# `rename_asset` réécrit les références : les 67 meshes suivront sans qu'on y
# touche.
# ══════════════════════════════════════════════════════════════════════════════

import unreal


def journal(message):
    unreal.log("[NARVOS] " + message)


RACINE = "/Game/Narvos/Meshes/Trooper_Set"

# Sous-dossier -> suffixe lisible. Écrit à la main : ces quatre-là sont les
# morphologies du pack, et un nom dérivé automatiquement donnerait
# `M_Trooper_Male_Thinner_Armor`, qu'on ne relit pas.
MORPHOS = {
    "Male": "Male",
    "Male_Thinner_Armor": "MaleFin",
    "Petite_Female": "PetiteFemale",
    "Tall_Female": "TallFemale",
}

registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)

renommes = 0
absents = []

for sous, suffixe in MORPHOS.items():
    base = "%s/%s" % (RACINE, sous)

    # Le matériau d'abord : renommer une texture avant lui laisserait le
    # matériau pointer une seconde vers un nom disparu.
    paires = [
        ("WorldGridMaterial", "M_Trooper_%s" % suffixe),
        ("WorldGridMaterial_BaseColor", "T_Trooper_%s_BaseColor" % suffixe),
        ("WorldGridMaterial_MetallicRoughness", "T_Trooper_%s_ORM" % suffixe),
        ("WorldGridMaterial_Normal", "T_Trooper_%s_Normal" % suffixe),
    ]

    for ancien, neuf in paires:
        source = "%s/%s" % (base, ancien)
        cible = "%s/%s" % (base, neuf)

        if not unreal.EditorAssetLibrary.does_asset_exist(source):
            absents.append(source)
            continue

        if unreal.EditorAssetLibrary.does_asset_exist(cible):
            journal("  DEJA FAIT %s" % cible)
            continue

        ok = unreal.EditorAssetLibrary.rename_asset(source, cible)
        if ok:
            renommes += 1
            journal("  %s -> %s" % (ancien, neuf))
        else:
            journal("  ECHEC %s" % source)

journal("")
journal("%d asset(s) renomme(s)" % renommes)
if absents:
    journal("%d absent(s) — deja renommes, ou jamais importes :" % len(absents))
    for a in absents[:8]:
        journal("    " + a)

# Les meshes ont vu leurs références réécrites : il faut les resauver, sinon le
# prochain cook repartirait de l'ancien nom.
unreal.EditorAssetLibrary.save_directory(RACINE, only_if_is_dirty=False, recursive=True)
journal("meshes resauves sous " + RACINE)

# ── Contrôle ──────────────────────────────────────────────────────────────────

registre.search_all_assets(True)
restants = [str(d.asset_name) for d in registre.get_assets_by_path(RACINE, recursive=True)
            if "WorldGridMaterial" in str(d.asset_name)]
if restants:
    journal("ATTENTION %d asset(s) portent encore le nom reserve : %s"
            % (len(restants), restants[:6]))
else:
    journal("Plus aucun asset nomme WorldGridMaterial sous " + RACINE)