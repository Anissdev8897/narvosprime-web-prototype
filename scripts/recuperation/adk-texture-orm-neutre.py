# ══════════════════════════════════════════════════════════════════════════════
# adk-texture-orm-neutre.py — refait `/Game/Narvos/TechDefaults/T_ORM_Neutre`.
#
#   bash scripts/recuperation/adk-lancer.sh recuperation/adk-texture-orm-neutre.py
#
# ── CE QUE C'EST ──────────────────────────────────────────────────────────────
# Le repli PBR pose par Astra le 15/09 (`.hermes/astra_city_orm_repli_20260915.py`) : deux
# materiaux parents de CITY_PACK avaient leur parametre `AO_Rough_Metal` a NULL — les textures
# d'origine n'existent pas — et ne compilaient pas. Une texture neutre (AO = 1, rugosite = 0,5,
# metal = 0) leur rend un materiau, sans inventer de detail.
#
# Les deux parents ont survecu, DEJA branches sur ce chemin ; la texture, elle, vivait dans un
# dossier que la recuperation n'a pas rendu. Mesure au cook du 04/10 : six materiaux de
# CITY_PACK « Param2D> Found NULL, requires Texture2D ». Il ne manque donc que le paquet.
#
# La source `.hermes/generated/T_ORM_Neutre.png` (32 x 32, R 255, V 128, B 0) a ete regeneree
# le 04/10 : meme contenu par definition, taille d'origine inconnue.
#
# ⚠ `InterchangeManager.import_asset`, pas `import_asset_tasks` : ce dernier synchronise le
# navigateur de contenu et tue un commandlet (assertion Slate) — c'est ce qui etait arrive a
# l'import d'origine.
# ⚠ Lineaire, pas sRGB : ce sont des DONNEES. En sRGB la rugosite 0,5 deviendrait 0,21.
# ══════════════════════════════════════════════════════════════════════════════
import os

import unreal

SOURCE = "E:/narvosprime-web-prototype/.hermes/generated/T_ORM_Neutre.png"
DOSSIER = "/Game/Narvos/TechDefaults"
CIBLE = DOSSIER + "/T_ORM_Neutre"


def journal(message):
    unreal.log("[NARVOS] " + message)


if not os.path.isfile(SOURCE):
    journal("ARRET orm-neutre : source absente " + SOURCE)
    raise SystemExit(1)

if unreal.EditorAssetLibrary.does_asset_exist(CIBLE):
    journal("orm-neutre : %s existe deja" % CIBLE)
else:
    gestionnaire = unreal.InterchangeManager.get_interchange_manager_scripted()
    parametres = unreal.ImportAssetParameters()
    parametres.set_editor_property("is_automated", True)
    if not gestionnaire.import_asset(DOSSIER, gestionnaire.create_source_data(SOURCE), parametres):
        journal("ARRET orm-neutre : import refuse")
        raise SystemExit(1)

texture = unreal.load_asset(CIBLE)
if not isinstance(texture, unreal.Texture2D):
    journal("ARRET orm-neutre : %s n'est pas une Texture2D (%s)" % (CIBLE, type(texture).__name__))
    raise SystemExit(1)

texture.set_editor_property("srgb", False)
texture.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_DEFAULT)
ecrit = unreal.EditorAssetLibrary.save_loaded_asset(texture, False)
journal("orm-neutre : %s — sRGB %s, %dx%d, sauve %s" % (
    CIBLE, texture.get_editor_property("srgb"),
    texture.blueprint_get_size_x(), texture.blueprint_get_size_y(), bool(ecrit)))
