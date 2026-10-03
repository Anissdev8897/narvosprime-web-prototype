# -*- coding: utf-8 -*-
"""
adk-sonder-corps-routes.py — par ou atteindre les CORPS d'un PhysicsAsset ?

Ne modifie rien.

`unreal.PhysicsAsset` n'expose AUCUNE propriete editeur en 5.7 (mesure du
2026-09-10) : `SkeletalBodySetups` et `ConstraintSetup` sont des UPROPERTY
`instanced` sans `BlueprintReadWrite`. La porte d'entree evidente n'existe pas.

Restent trois portes possibles, testees ici l'une apres l'autre. On les essaie
TOUTES meme si la premiere marche : savoir laquelle echoue vaut autant, et une
route qui marche sur le Sedan doit marcher sur les 12.
"""
import sys
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

BASE = "/Game/Narvos/City_Traffic_Pro/Cars/Meshes/Skeletal_Meshes"
CIBLE = BASE + "/SK_Executive_Sedan_PhysicsAsset"
ROUES = ("Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR")


def dire(t):
    print(t)
    unreal.log(t)


pa = unreal.EditorAssetLibrary.load_asset(CIBLE)
if pa is None:
    dire("ARRET : cible introuvable.")
    sys.exit(1)

# ── PORTE 1 : les contraintes, seules methodes exposees ──────────────────────
# Si elles rendent de vrais objets, les corps sont probablement joignables par
# le meme mecanisme (sous-objets du meme package).
dire("=== PORTE 1 : get_constraints() ===")
try:
    cs = pa.get_constraints()
    dire("  %d contrainte(s)" % len(cs))
    for c in cs[:8]:
        try:
            nom = c.get_name()
        except Exception:
            nom = "?"
        dire("    %s  (%s)" % (nom, type(c).__name__))
        # De quoi est faite une contrainte ?
        props = [n for n in dir(c) if not n.startswith("_") and not n.startswith("get_")]
        dire("      membres : %s" % ", ".join(sorted(props)[:14]))
        break
except Exception as e:
    dire("  ECHEC : %s" % e)

# ── PORTE 2 : les corps comme SOUS-OBJETS nommes du PhysicsAsset ─────────────
# En C++ les `USkeletalBodySetup` sont « outered » au `UPhysicsAsset`. S'ils le
# sont, `load_object(pa, nom)` les trouve. Reste a deviner le nom : Unreal les
# nomme souvent par l'os, parfois `BodySetup_N`.
dire("\n=== PORTE 2 : sous-objets nommes ===")
candidats = list(ROUES) + ["Body"]
candidats += ["BodySetup_%d" % i for i in range(6)]
candidats += ["SkeletalBodySetup_%d" % i for i in range(6)]
trouves = 0
for nom in candidats:
    obj = None
    for tentative in (
        lambda: unreal.load_object(pa, nom),
        lambda: unreal.find_object(pa, nom),
    ):
        try:
            obj = tentative()
            if obj is not None:
                break
        except Exception:
            obj = None
    if obj is not None:
        trouves += 1
        dire("  TROUVE  %-22s -> %s" % (nom, type(obj).__name__))
        if trouves == 1:
            props = []
            for n in dir(obj):
                if n.startswith("_"):
                    continue
                try:
                    obj.get_editor_property(n)
                    props.append(n)
                except Exception:
                    pass
            dire("      proprietes lisibles : %s" % (", ".join(sorted(props)) or "AUCUNE"))
if trouves == 0:
    dire("  aucun sous-objet joignable par nom.")

# ── PORTE 3 : refabriquer un PhysicsAsset propre ─────────────────────────────
# `PhysicsAssetFactory` existe. S'il accepte des parametres de generation, on
# peut fabriquer un asset qui ne porte QUE la carrosserie et pointer le mesh
# dessus — sans jamais editer l'asset du pack.
dire("\n=== PORTE 3 : PhysicsAssetFactory ===")
try:
    f = unreal.PhysicsAssetFactory()
    props = []
    for n in dir(f):
        if n.startswith("_"):
            continue
        try:
            f.get_editor_property(n)
            props.append(n)
        except Exception:
            pass
    dire("  proprietes de la factory : %s" % (", ".join(sorted(props)) or "AUCUNE"))
    dire("  methodes : %s" % ", ".join(n for n in dir(f) if not n.startswith("_"))[:400])
except Exception as e:
    dire("  ECHEC : %s" % e)

# Les parametres de generation, s'ils sont exposes.
for nom in ("PhysicsAssetGenerationParameters", "SkeletalMeshSimplificationSettings"):
    if hasattr(unreal, nom):
        dire("  unreal.%s EXISTE" % nom)

# ── PORTE 4 : le mesh peut-il pointer ailleurs ? ─────────────────────────────
dire("\n=== PORTE 4 : SkeletalMesh.physics_asset ===")
sk = unreal.EditorAssetLibrary.load_asset(BASE + "/SK_Executive_Sedan")
if sk is not None:
    try:
        actuel = sk.get_editor_property("physics_asset")
        dire("  physics_asset actuel : %s" % (actuel.get_name() if actuel else "None"))
        dire("  -> la propriete est LISIBLE ; reste a savoir si elle est ECRIVABLE")
    except Exception as e:
        dire("  ECHEC : %s" % e)

dire("\nSonde terminee — RIEN n'a ete modifie.")