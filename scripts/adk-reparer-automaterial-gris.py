# ══════════════════════════════════════════════════════════════════════════════
# adk-reparer-automaterial-gris.py — NE PLUS UTILISER EN COMMANDLET.
#
# ⚠⚠ CE SCRIPT A DÉTRUIT LE MATÉRIAU QU'IL DEVAIT RÉPARER, le 2026-09-06.
#
# Lancé en commandlet, il a fait `set_editor_property` (drapeaux d'usage) puis
# `save_asset(only_if_is_dirty=False)` sur un UMaterial. Un commandlet charge un
# matériau SANS ses données éditeur complètes : la sauvegarde a réécrit l'asset
# amputé de son graphe. Mesuré, avant / après :
#
#     171 219 octets, 12 références `MF_MWAM_*`   ->   124 798 octets, 0
#
# Restauré depuis `_sauvegarde-materiaux/`. La version cassée est conservée sous
# `MTL_MWAM_AutoMaterial_MASTER.CASSE-2026-09-06.uasset` — ne pas la remettre.
#
# RÈGLE : **ne jamais sauver un UMaterial depuis un commandlet.** Un
# MaterialInstance, oui (c'est de la donnée plate) ; un Material, non (c'est un
# graphe, et le graphe est éditeur-seul). Le drapeau se pose dans l'ÉDITEUR, par
# le MCP ou à la main.
#
# Le script refuse donc désormais de tourner hors éditeur.
#
# ── ET DE TOUTE FAÇON CE N'ÉTAIT PAS LA CAUSE ────────────────────────────────
# Le gris venait de références de package périmées : 78 des 97 assets du pack
# pointent `/Game/MWLandscapeAutoMaterial/` alors qu'il a été rangé sous
# `/Game/Narvos/`. Corrigé par un `[CoreRedirects]` dans
# `Config/DefaultEngine.ini`, qui remappe tout le sous-arbre sans toucher aux
# assets. Voir le rapport de session.
#
#   NARVOS_APPLIQUER=1  (dans l'éditeur uniquement, via MCP `execute_python`)
#
# Sortie dans `Saved/Logs/NanosWorldADK.log` (LogPython).
#
# ── CE QUI A ETE MESURE (adk-sonder-automaterial-gris.py, 2026-09-06) ─────────
#
#   32 Texture2D, 0 suspecte      4096x4096, sRGB correct  -> LES TEXTURES VONT BIEN
#   3 instances de biome          12 surcharges chacune, 0 VIDE
#   material_domain               MD_SURFACE
#   used_with_skeletal_mesh              False   <--
#   used_with_instanced_static_meshes    False   <--  causes de gris
#   used_with_static_lighting            False   <--
#   LandscapeLayerInfoObject      1 SEUL dans tout /Game/Narvos (RemoveFoliage)
#
# Donc ce n'est PAS un problème de texture. Deux causes distinctes restent, et
# on les lève toutes les deux plutôt que de parier sur l'une :
#
# 1. DRAPEAUX D'USAGE. Un matériau sans le drapeau de sa cible ne compile pas
#    pour elle, et Unreal affiche le matériau par DEFAUT — qui est gris. Posé
#    sur du feuillage, un ISM/HISM ou un mesh squelettique, ce matériau-ci
#    tombe donc en gris sans le moindre message. Activer un drapeau est ADDITIF :
#    ça n'ajoute que des permutations de shader, ça n'enlève rien.
#
# 2. AUCUNE COUCHE PEIGNABLE. Le master échantillonne une couche de terrain
#    (`LandscapeLayerSample`, chaîne `Layer_RockCliff` dans l'asset). Peindre une
#    couche exige un `LandscapeLayerInfoObject` ; sans lui, la couche apparaît
#    avec un « + » dans l'onglet Paint, son poids reste à 0, et le mélange sort
#    plat. On crée le LayerInfo manquant.
#
# ⚠ CE QUE CE SCRIPT NE PEUT PAS REPARER : si le matériau est posé sur autre
#    chose qu'un Landscape, son mélange pente/altitude fonctionne, mais tout ce
#    qui vient des couches PEINTES reste nul par construction. Ce n'est pas un
#    défaut à corriger, c'est la nature d'un auto-material de terrain.
#
# ⚠ `save_asset` a `only_if_is_dirty=True` PAR DEFAUT — on force False ici, sinon
#    la réparation ne s'écrit pas et la relecture dans le MEME processus dit
#    quand même OK (piège payé le 2026-09-05 sur 162 assets).
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal

RACINE = "/Game/Narvos/MWLandscapeAutoMaterial"
MASTER = RACINE + "/Materials/MASTER/MTL_MWAM_AutoMaterial_MASTER"
DOSSIER_LAYERS = RACINE + "/Materials/Landscape"

APPLIQUER = os.environ.get("NARVOS_APPLIQUER") == "1"

# Drapeaux à activer. `used_with_nanite` est déjà True et n'est pas touché.
DRAPEAUX = (
    "used_with_static_lighting",
    "used_with_skeletal_mesh",
    "used_with_instanced_static_meshes",
)

# Couches peignables. `RockCliff` est relevé dans les chaînes du master
# (`Layer_RockCliff`) ; les autres sont les noms de couche du pack MW.
COUCHES = ("RockCliff",)


def journal(m):
    unreal.log("[NARVOS] " + m)


# ── Le garde-fou qui manquait ────────────────────────────────────────────────
#
# Un commandlet n'a pas les données éditeur d'un UMaterial. Y sauver un matériau
# le réécrit sans son graphe. Le contrôle porte sur la FORME du danger (est-on
# dans un vrai éditeur ?), pas sur le nom du script qui a fauté.
try:
    _EDITEUR_VIVANT = unreal.EditorLevelLibrary.get_editor_world() is not None
except Exception:
    _EDITEUR_VIVANT = False

if not _EDITEUR_VIVANT:
    journal("ARRET : pas de monde editeur — on est en commandlet.")
    journal("   Sauver un UMaterial ici le REECRIT SANS SON GRAPHE (mesure du")
    journal("   2026-09-06 : 171 219 o / 12 fonctions -> 124 798 o / 0).")
    journal("   Lancer ce script depuis l'editeur (MCP execute_python).")
    raise SystemExit(1)

journal("mode : %s" % ("APPLIQUER" if APPLIQUER else "passe a blanc"))
journal("")

master = unreal.EditorAssetLibrary.load_asset(MASTER)
if master is None:
    journal("ARRET : master introuvable — " + MASTER)
    raise SystemExit(1)

# ── 1. Drapeaux d'usage ──────────────────────────────────────────────────────

journal("=== DRAPEAUX D'USAGE")
a_changer = []
for d in DRAPEAUX:
    try:
        avant = master.get_editor_property(d)
    except Exception as e:
        journal("  %-36s illisible : %s" % (d, e))
        continue
    journal("  %-36s %s%s" % (d, avant, "" if avant else "   -> a activer"))
    if not avant:
        a_changer.append(d)

if APPLIQUER and a_changer:
    for d in a_changer:
        master.set_editor_property(d, True)
    # ⚠ False, pas le défaut : c'est une réparation, l'asset doit partir au disque.
    unreal.EditorAssetLibrary.save_asset(MASTER, only_if_is_dirty=False)
    journal("  %d drapeau(x) active(s) et sauve(s)" % len(a_changer))

# ── 2. LandscapeLayerInfoObject manquants ────────────────────────────────────

journal("")
journal("=== COUCHES PEIGNABLES")
outils = unreal.AssetToolsHelpers.get_asset_tools()
crees = 0
for couche in COUCHES:
    nom = "%s_LayerInfo" % couche
    chemin = "%s/%s" % (DOSSIER_LAYERS, nom)
    if unreal.EditorAssetLibrary.does_asset_exist(chemin):
        journal("  DEJA LA  %s" % chemin)
        continue
    journal("  MANQUE   %s" % chemin)
    if not APPLIQUER:
        continue
    try:
        actif = outils.create_asset(nom, DOSSIER_LAYERS,
                                    unreal.LandscapeLayerInfoObject, None)
        if actif is None:
            journal("           ECHEC de creation")
            continue
        # Le nom de couche DOIT correspondre a celui du materiau, sinon le
        # LayerInfo existe et ne se relie a rien.
        actif.set_editor_property("layer_name", couche)
        unreal.EditorAssetLibrary.save_asset(chemin, only_if_is_dirty=False)
        crees += 1
        journal("           cree, layer_name=%s" % couche)
    except Exception as e:
        journal("           ECHEC : %s" % e)

# ── 3. Recompiler ────────────────────────────────────────────────────────────
#
# Un matériau dont les shaders n'ont jamais été compilés s'affiche gris jusqu'à
# ce qu'ils le soient. Changer les drapeaux d'usage force de toute façon une
# recompilation : autant l'attendre ici, dans un commandlet qui a le temps,
# plutôt qu'à l'ouverture de l'éditeur.

if APPLIQUER:
    journal("")
    journal("=== RECOMPILATION")
    try:
        unreal.MaterialEditingLibrary.recompile_material(master)
        journal("  master recompile")
    except Exception as e:
        journal("  master : %s" % e)
    for nom in ("DesertExample", "IslandExample", "MountainRangeExample"):
        chemin = "%s/MTL_MWAM_Landscape_%s" % (DOSSIER_LAYERS, nom)
        inst = unreal.EditorAssetLibrary.load_asset(chemin)
        if inst is None:
            continue
        try:
            unreal.MaterialEditingLibrary.update_material_instance(inst)
            unreal.EditorAssetLibrary.save_asset(chemin, only_if_is_dirty=False)
            journal("  %s mis a jour" % nom)
        except Exception as e:
            journal("  %s : %s" % (nom, e))

# ── 4. Relecture ─────────────────────────────────────────────────────────────

journal("")
journal("=== RELECTURE")
for d in DRAPEAUX:
    try:
        journal("  %-36s %s" % (d, master.get_editor_property(d)))
    except Exception:
        pass
journal("  %d LayerInfo cree(s)" % crees)

if not APPLIQUER:
    journal("")
    journal("passe a blanc : rien n'a ete ecrit. NARVOS_APPLIQUER=1 pour ecrire.")
else:
    journal("")
    journal("⚠ La relecture ci-dessus est faite dans le MEME processus : elle lit")
    journal("   la memoire. Seul un recomptage dans un processus NEUF prouve")
    journal("   l'ecriture — relancer adk-sonder-automaterial-gris.py.")