# ══════════════════════════════════════════════════════════════════════════════
# adk-rebrancher-apres-renommage.py — rend ses dependances a un asset sauve TROP TOT pendant
# un renommage. EDITEUR COMPLET (il resauve un UMaterial).
#
#   bash scripts/recuperation/adk-session.sh recuperation/adk-rebrancher-apres-renommage.py \
#       NARVOS_REFERENCEUR=/Game/Narvos/.../MTL_SovietZombieTankman1_UE4 \
#       NARVOS_ANCIEN=MTL_UE4 NARVOS_NOUVEAU=MTL_SovietZombieTankman1_UE4
#
# ── LE DEFAUT, MESURE LE 04/10 ────────────────────────────────────────────────
# `adk-renommer-asset.py` renomme le materiau D'ABORD, puis ses textures. `rename_asset`
# SAUVE le materiau au moment ou il le renomme — avec les noms que ses textures portent
# encore. Les textures renommees ensuite, le materiau en memoire les suit (memes objets),
# mais son paquet n'est pas marque sale : `save_directory(only_if_is_dirty=True)` le saute.
# Sur le disque il cite `MTL_UE4_BaseColor`, qui n'existe plus : un holster GRIS au prochain
# chargement, et aucune erreur. Le controle du script (« plus aucun asset nomme MTL_UE4* »)
# passait ; c'est `textures-rebaties.py` qui l'a vu (3 references mortes).
#
# ── LA REPARATION ─────────────────────────────────────────────────────────────
# Charger le materiau tel quel le figerait avec trois textures NULLES. On rend donc d'abord
# aux dependances le nom que le referenceur cite, on le charge (il les retrouve), on les
# renomme de nouveau, et on sauve DE FORCE le referenceur et ses dependances.
#
# La cause est corrigee dans `adk-renommer-asset.py` (sauvegarde forcee des renommes) : cet
# outil ne sert qu'a un paquet deja abime.
# ══════════════════════════════════════════════════════════════════════════════
import os
import traceback

import unreal

REFERENCEUR = os.environ.get("NARVOS_REFERENCEUR", "").strip()
ANCIEN = os.environ.get("NARVOS_ANCIEN", "").strip()
NOUVEAU = os.environ.get("NARVOS_NOUVEAU", "").strip()
EAL = unreal.EditorAssetLibrary


def journal(message):
    unreal.log("[NARVOS] " + message)
    print("[NARVOS] " + message)


def rebrancher():
    if not REFERENCEUR or not ANCIEN or not NOUVEAU:
        journal("ARRET rebrancher : NARVOS_REFERENCEUR, NARVOS_ANCIEN et NARVOS_NOUVEAU sont requis.")
        return
    if not EAL.does_asset_exist(REFERENCEUR):
        journal("ARRET rebrancher : referenceur introuvable " + REFERENCEUR)
        return
    dossier = REFERENCEUR.rpartition("/")[0]
    registre = unreal.AssetRegistryHelpers.get_asset_registry()
    # Les dependances renommees : `<NOUVEAU>_<suffixe>` a cote du referenceur.
    paires = []
    for d in registre.get_assets_by_path(dossier, recursive=False):
        nom = str(d.asset_name)
        if nom.startswith(NOUVEAU + "_"):
            paires.append((dossier + "/" + ANCIEN + nom[len(NOUVEAU):], str(d.package_name)))
    if not paires:
        journal("ARRET rebrancher : aucune dependance %s_* sous %s" % (NOUVEAU, dossier))
        return
    deja_la = [a for a, _ in paires if EAL.does_asset_exist(a)]
    if deja_la:
        journal("ARRET rebrancher : l'ancien nom existe encore (%s) — renommage inacheve, pas abime." % deja_la[0])
        return

    journal("=== 1. les dependances reprennent le nom que le referenceur cite")
    for ancien, neuf in paires:
        journal("    %s <- %s : %s" % (ancien.rpartition("/")[2], neuf.rpartition("/")[2], bool(EAL.rename_asset(neuf, ancien))))
    journal("=== 2. chargement du referenceur (il retrouve ses dependances)")
    referenceur = unreal.load_asset(REFERENCEUR)
    if referenceur is None:
        journal("ARRET rebrancher : chargement impossible — dependances laissees a l'ancien nom.")
        return
    journal("=== 3. renommage, referenceur en memoire")
    for ancien, neuf in paires:
        journal("    %s -> %s : %s" % (ancien.rpartition("/")[2], neuf.rpartition("/")[2], bool(EAL.rename_asset(ancien, neuf))))
    journal("=== 4. sauvegarde forcee")
    for chemin in [REFERENCEUR] + [neuf for _, neuf in paires]:
        journal("    %s : %s" % (chemin.rpartition("/")[2], bool(EAL.save_asset(chemin, only_if_is_dirty=False))))
    restants = [a for a, _ in paires if EAL.does_asset_exist(a)]
    journal("=== anciens noms restants : %d %s" % (len(restants), restants[:3]))


try:
    unreal.AssetRegistryHelpers.get_asset_registry().wait_for_completion()
    rebrancher()
except Exception:
    for ligne in traceback.format_exc().splitlines():
        journal("    " + ligne)
finally:
    journal("=== fermeture de l'editeur")
    unreal.SystemLibrary.quit_editor()
