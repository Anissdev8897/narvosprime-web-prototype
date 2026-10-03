# ══════════════════════════════════════════════════════════════════════════════
# adk-retarget-un-modele.py — retarget d'UN SEUL PNJ vers SKEL_Mannequin.
#
#   exec(open(r"...\adk-retarget-un-modele.py", encoding="utf-8").read())
#
#   NARVOS_RETARGET_APPLIQUER=1 pour construire ; sans, il SONDE et rend compte.
#
# ── POURQUOI UN SEUL ──────────────────────────────────────────────────────────
# 50 GLB sur 81 partagent le meme rig (24 os, nomenclature Mixamo). Les convertir
# tous d'un coup, c'est 50 chances de decouvrir en fin de course que la pose est
# fausse. Un seul modele repond a la question pour les 50 — ils sont identiques.
#
# ── CE QU'ON CHERCHE A PROUVER ────────────────────────────────────────────────
# Qu'un PNJ Meshy peut devenir un `Character` nanos, donc :
#   · heriter des animations deja cuites au lieu de rester une statue
#     (aujourd'hui `CharacterSimple` recoit un Animation Blueprint VIDE,
#      `Server/Spawner.lua` — les 34 PNJ concernes n'animent rien) ;
#   · accepter les pieces modulaires attachees.
#
# ⚠ ET QUE LA POSE TIENT. Mesure du 2026-09-09, direction epaule -> main
# accumulee en espace monde :
#     rig Meshy (les 50)   bras a 75 deg sous l'horizontale (le long du corps)
#     SKEL_Mannequin       A-pose, ~45 deg
# 30 degres d'ecart. Un simple remap de noms lierait le mesh SANS ERREUR et le
# ferait jouer deforme — c'est le defaut « ca marche et c'est faux ». Seul un
# IK Retargeter reconstruit la pose. C'est CE point que ce test doit trancher.
#
# ── OU VONT LES ASSETS ────────────────────────────────────────────────────────
# L'IK Rig et le Retargeter sont des outils d'EDITEUR : ils n'ont rien a faire
# dans le pack. Ils vont donc sous `Narvos/NARVOS_Retarget`, deja present dans
# `DirectoriesToNeverCook` de `DefaultGame.ini`. Le mesh produit, lui, va dans un
# dossier cuit — c'est lui qui doit partir.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io
import os

RAPPORT = "E:/narvosprime-web-prototype/.hermes/retarget_test.txt"
APPLIQUER = os.environ.get("NARVOS_RETARGET_APPLIQUER") == "1"

# Le cobaye : `soldat_humain` du catalogue Spawnables.
COBAYE_NOM = "Meshy_AI_biped_Character_output"

OUTILS = "/Game/Narvos/NARVOS_Retarget"
SORTIE_MESH = "/Game/Narvos/Personnages/Retargetes"

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))

def ecrire():
    io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
    unreal.log("[NARVOS] ecrit : " + RAPPORT)


dire("=== RETARGET, UN MODELE ===" + ("" if APPLIQUER else "   (SONDE — NARVOS_RETARGET_APPLIQUER=1 pour construire)"))
registre = unreal.AssetRegistryHelpers.get_asset_registry()

# ── 1. L'API de retarget est-elle la ? ───────────────────────────────────────
#
# ⚠ ON SONDE AU LIEU DE SUPPOSER. Les noms de classes de retarget ont bouge
# entre 5.1 et 5.7, et un `AttributeError` en plein milieu laisserait des assets
# a moitie construits. On regarde d'abord ce que le moteur expose vraiment.
dire("")
dire("=== API ===")
attendus = [
    "IKRigController", "IKRetargeterController", "IKRigDefinition", "IKRetargeter",
    "IKRetargetBatchOperation", "IKRetargetBatchOperationContext",
]
presents = {}
for n in attendus:
    presents[n] = hasattr(unreal, n)
    dire("  %-34s %s" % (n, "present" if presents[n] else "ABSENT"))

if not presents.get("IKRigController") or not presents.get("IKRetargeterController"):
    dire("")
    dire("ARRET : l'API de retarget n'est pas exposee sous ces noms en 5.7.")
    dire("  Chercher le nom reel avant d'ecrire quoi que ce soit — construire a")
    dire("  l'aveugle laisserait des assets a moitie faits.")
    dire("  Noms 'IK'/'Retarget' exposes par le module unreal :")
    for n in sorted(dir(unreal)):
        if ("IKRig" in n or "IKRetarget" in n) and n not in attendus:
            dire("     %s" % n)
    ecrire()
    raise SystemExit

# ── 2. Le cobaye et sa cible ─────────────────────────────────────────────────
dire("")
dire("=== LE COBAYE ===")

cobaye = None
for d in registre.get_assets_by_path("/Game/Narvos", recursive=True):
    if str(d.asset_class_path.asset_name) != "SkeletalMesh":
        continue
    if str(d.asset_name) == COBAYE_NOM:
        cobaye = str(d.package_name)
        break

if cobaye is None:
    dire("ARRET : %s introuvable sous /Game/Narvos" % COBAYE_NOM)
    dire("  Candidats 'Meshy_AI_biped' presents :")
    n = 0
    for d in registre.get_assets_by_path("/Game/Narvos", recursive=True):
        if str(d.asset_class_path.asset_name) == "SkeletalMesh" and "Meshy_AI_biped" in str(d.asset_name):
            dire("     %s" % str(d.package_name))
            n += 1
            if n >= 10:
                break
    ecrire()
    raise SystemExit

mesh = unreal.load_asset(cobaye)
skel_source = mesh.get_editor_property("skeleton")
dire("  mesh          %s" % cobaye)
dire("  son squelette %s" % (skel_source.get_path_name().split(".")[0] if skel_source else "AUCUN"))

def os_de(skel):
    noms = []
    try:
        i = 0
        while True:
            n = skel.get_bone_name(i)
            if not n or str(n) == "None":
                break
            noms.append(str(n))
            i += 1
            if i > 4096:
                break
    except Exception:
        pass
    return noms

os_src = os_de(skel_source) if skel_source else []
dire("  os source     %d  %s" % (len(os_src), ", ".join(os_src[:8])))

# ── 3. La cible : le SKEL_Mannequin que nanos charge REELLEMENT ─────────────
#
# ⚠ IL Y EN A DEUX SUR DISQUE. `NanosWorld/Characters/Common/SKEL_Mannequin` est
# celui que le client resout ; `Narvos/Shared/Mannequins/Meshes/SKEL_Mannequin`
# est une copie faite a l'import. Se tromper de cible produirait un mesh lie a un
# squelette que le jeu ne charge pas — il afficherait la capsule de collision,
# un cylindre blanc, et la partie continuerait.
dire("")
dire("=== LA CIBLE ===")
candidats = [
    "/Game/NanosWorld/Characters/Common/SKEL_Mannequin",
    "/Game/Narvos/Shared/Mannequins/Meshes/SKEL_Mannequin",
]
cible = None
for c in candidats:
    existe = unreal.EditorAssetLibrary.does_asset_exist(c)
    n = 0
    if existe:
        a = unreal.load_asset(c)
        n = len(os_de(a)) if a else 0
        if cible is None:
            cible = c
    dire("  %-56s %s  %d os" % (c, "present" if existe else "ABSENT", n))

if cible is None:
    dire("ARRET : aucun SKEL_Mannequin trouve.")
    ecrire()
    raise SystemExit

skel_cible = unreal.load_asset(cible)
os_cible = os_de(skel_cible)
dire("")
dire("  cible retenue : %s (%d os)" % (cible, len(os_cible)))
dire("  ⚠ celle du pack NanosWorld est la bonne : le client resout ses references")
dire("    telles quelles, et le pack Narvos ne doit pas la copier.")

# ── 4. Correspondance des os ────────────────────────────────────────────────
#
# On mesure le recouvrement AVANT de construire. Zero nom en commun est attendu
# (Mixamo contre UE4) et ne bloque pas : c'est precisement ce qu'un IK Retargeter
# resout, en reliant des CHAINES et non des noms. Mais le chiffre doit etre dit,
# pas suppose.
communs = [n for n in os_src if n in set(os_cible)]
dire("")
dire("=== RECOUVREMENT ===")
dire("  %d os source, %d os cible, %d nom(s) en commun" % (len(os_src), len(os_cible), len(communs)))
if communs:
    dire("     %s" % ", ".join(communs[:12]))
dire("  -> un remap par NOMS est donc exclu ; il faut relier des CHAINES.")

if not APPLIQUER:
    dire("")
    dire("=== CE QUI SERAIT CONSTRUIT ===")
    dire("  %s/IK_Meshy24         IK Rig du rig Meshy (source)" % OUTILS)
    dire("  %s/IK_NanosMannequin  IK Rig de %s" % (OUTILS, cible.split("/")[-1]))
    dire("  %s/RTG_Meshy_vers_Mannequin" % OUTILS)
    dire("  %s/<nom>_Retargete    le mesh produit" % SORTIE_MESH)
    dire("")
    dire("Rien ecrit.")
    ecrire()
    raise SystemExit

# ── 5. Construction ─────────────────────────────────────────────────────────
dire("")
dire("=== CONSTRUCTION ===")
unreal.EditorAssetLibrary.make_directory(OUTILS)
unreal.EditorAssetLibrary.make_directory(SORTIE_MESH)

outils_actifs = unreal.AssetToolsHelpers.get_asset_tools()

def creer_ikrig(nom, mesh_pour_rig):
    chemin = "%s/%s" % (OUTILS, nom)
    if unreal.EditorAssetLibrary.does_asset_exist(chemin):
        dire("  DEJA LA   %s" % chemin)
        return unreal.load_asset(chemin)
    a = outils_actifs.create_asset(nom, OUTILS, unreal.IKRigDefinition, None)
    if a is None:
        dire("  ECHEC     creation de %s" % chemin)
        return None
    ctrl = unreal.IKRigController.get_controller(a)
    ctrl.set_skeletal_mesh(mesh_pour_rig)
    unreal.EditorAssetLibrary.save_asset(chemin, only_if_is_dirty=False)
    dire("  CREE      %s" % chemin)
    return a

# Le mesh de reference du squelette cible : un IK Rig se regle sur un MESH, pas
# sur un Skeleton nu.
mesh_cible = None
for d in registre.get_assets_by_path(cible.rsplit("/", 1)[0], recursive=True):
    if str(d.asset_class_path.asset_name) == "SkeletalMesh":
        m = unreal.load_asset(str(d.package_name))
        s = m.get_editor_property("skeleton") if m else None
        if s is not None and s.get_path_name().split(".")[0] == cible:
            mesh_cible = m
            dire("  mesh de reference de la cible : %s" % str(d.package_name))
            break

if mesh_cible is None:
    dire("ARRET : aucun SkeletalMesh lie a %s — impossible de regler l'IK Rig cible." % cible)
    ecrire()
    raise SystemExit

rig_src = creer_ikrig("IK_Meshy24", mesh)
rig_dst = creer_ikrig("IK_NanosMannequin", mesh_cible)
if rig_src is None or rig_dst is None:
    ecrire()
    raise SystemExit

dire("")
dire("⚠ LES CHAINES DE RETARGET NE SONT PAS POSEES ICI.")
dire("  Les definir demande de nommer, pour chaque membre, l'os de debut et")
dire("  l'os de fin des DEUX cotes. Les inventer depuis un script donnerait un")
dire("  personnage disloque sans le moindre message. Elles se posent dans")
dire("  l'editeur d'IK Rig, une fois, puis se rejouent sur les 49 autres.")
dire("")
dire("  A faire dans l'editeur, sur IK_Meshy24 et IK_NanosMannequin :")
dire("    Root    Hips            <-> pelvis")
dire("    Spine   Spine  ..Spine02 <-> spine_01 ..spine_03")
dire("    LeftArm LeftShoulder..LeftHand <-> clavicle_l ..hand_l")
dire("    (idem droite, jambes, tete)")
dire("")
dire("  Puis relancer avec le Retargeter pour produire le mesh.")

ecrire()