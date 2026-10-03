# -*- coding: utf-8 -*-
"""
adk-reparer-roues.py — retirer les volumes de collision des OS DE ROUE.

    # constat seul (par defaut) :
    UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script=scripts/adk-reparer-roues.py -unattended -nosplash -nopause

    # reparer :
    NARVOS_APPLIQUER=1  (variable d'environnement)  puis la meme commande

── LE DEFAUT ────────────────────────────────────────────────────────────────────
Le doc nanos l'interdit noir sur blanc :
    « Do not add physics shapes to the Wheels! it will only cause physics
      problems »
    (docs/assets-modding/creating-assets/skeletal-meshes/vehicles-meshes.mdx)

Mesure du 2026-09-10 (`scripts/narvos-phys-roues.mjs`, sur le pack CUIT) :
**les 12 voitures City_Traffic_Pro portent un corps sur `Wheel_FL/FR/RL/RR`.**
Pas 8 sur 12 — les 12. Les quatre que je croyais propres portent des CAPSULES
au lieu de spheres ; un volume quand meme.

Symptome attendu en jeu : voiture qui tremble, s'enfonce ou decolle. Ca ne vient
PAS des reglages de suspension.

── POURQUOI VIDER LA GEOMETRIE PLUTOT QUE SUPPRIMER LE CORPS ────────────────────
`unreal.PhysicsAsset` n'expose AUCUNE propriete editeur en 5.7 : `SkeletalBodySetups`
est une UPROPERTY `instanced` sans `BlueprintReadWrite` (mesure :
`scripts/adk-sonder-api-physics.py`). On ne peut donc pas RETIRER une entree du
tableau depuis Python.

En revanche les corps sont des SOUS-OBJETS nommes du PhysicsAsset, joignables par
`unreal.load_object(pa, "SkeletalBodySetup_<n>")` (mesure :
`scripts/adk-sonder-corps-routes.py`). Un corps dont la geometrie est VIDE ne
porte plus aucune forme de collision — c'est exactement ce que le doc demande.
Le corps subsiste comme coquille inerte, sans volume.

⚠ La suppression franche reste possible A LA MAIN dans l'editeur de PhysicsAsset.
Ce script fait ce qui est scriptable, et le dit.

── LE TEMOIN ────────────────────────────────────────────────────────────────────
`save_asset` a `only_if_is_dirty=True` PAR DEFAUT : une ecriture peut ne rien
ecrire et ne rien dire (lecon du 2026-09-04, [[feedback-ecriture-muette-unreal]]).
On force le drapeau, ET on recompte apres. Mais le seul vrai temoin est un
PROCESSUS NEUF : relancer `node scripts/narvos-phys-roues.mjs` apres le recook.
"""
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

DOSSIER = "/Game/Narvos/City_Traffic_Pro/Cars/Meshes/Skeletal_Meshes"
ROUES = ("Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR")
APPLIQUER = os.environ.get("NARVOS_APPLIQUER") == "1"

# Les noms de sous-objet a essayer. Unreal nomme les corps d'un PhysicsAsset
# `SkeletalBodySetup_<n>`, n croissant SANS garantie de continuite (un corps
# supprime laisse un trou). On balaie large plutot que de s'arreter au premier
# manquant — s'arreter au trou raterait les corps suivants, en silence.
PLAGE = 64

# Les familles de formes d'un FKAggregateGeom. Vider les cinq, pas seulement
# celle qu'on s'attend a trouver : c'est en presumant « ce sont des spheres »
# que le premier releve s'est trompe.
FAMILLES = ("sphere_elems", "box_elems", "sphyl_elems", "convex_elems",
            "tapered_capsule_elems")


def dire(t):
    print(t)
    unreal.log(t)


def lire(obj, nom):
    """get_editor_property qui rend (ok, valeur) au lieu de lever."""
    try:
        return True, obj.get_editor_property(nom)
    except Exception:
        return False, None


def compter_formes(agg):
    """Nombre de volumes, par famille. Rend (total, detail)."""
    total, detail = 0, []
    for f in FAMILLES:
        ok, v = lire(agg, f)
        if ok and v is not None:
            n = len(v)
            if n:
                detail.append("%s x%d" % (f.replace("_elems", ""), n))
            total += n
    return total, ", ".join(detail) or "aucune"


ar = unreal.AssetRegistryHelpers.get_asset_registry()
assets = ar.get_assets_by_path(DOSSIER, recursive=False)
phys = sorted(
    (a for a in assets if str(a.asset_class_path.asset_name) == "PhysicsAsset"),
    key=lambda x: str(x.package_name),
)

if not phys:
    # Zero cible = ROUGE. Un balayage qui ne trouve rien n'est pas un succes.
    dire("ARRET : aucun PhysicsAsset sous %s" % DOSSIER)
    sys.exit(1)

dire("%d PhysicsAsset(s) — mode : %s" % (len(phys), "REPARATION" if APPLIQUER else "constat seul"))
dire("")

total_roues, total_vides, total_sauves, illisibles = 0, 0, 0, 0
inaccessibles = []

for a in phys:
    chemin = str(a.package_name)
    nom_asset = chemin.rsplit("/", 1)[-1]
    pa = unreal.EditorAssetLibrary.load_asset(chemin)
    if pa is None:
        dire("%-34s NON CHARGEABLE" % nom_asset)
        illisibles += 1
        continue

    corps_vus, touche = [], False
    for i in range(PLAGE):
        bs = None
        for tentative in (
            lambda: unreal.load_object(pa, "SkeletalBodySetup_%d" % i),
            lambda: unreal.find_object(pa, "SkeletalBodySetup_%d" % i),
        ):
            try:
                bs = tentative()
                if bs is not None:
                    break
            except Exception:
                bs = None
        if bs is None:
            continue

        ok_os, os_nom = lire(bs, "bone_name")
        os_nom = str(os_nom) if ok_os else "?"
        ok_agg, agg = lire(bs, "agg_geom")
        if not ok_agg or agg is None:
            corps_vus.append("%s(agg illisible)" % os_nom)
            illisibles += 1
            continue

        n, detail = compter_formes(agg)
        est_roue = os_nom in ROUES
        corps_vus.append("%s[%s]" % (os_nom, detail))
        if not est_roue:
            continue

        total_roues += 1
        if n == 0:
            total_vides += 1
            continue

        if not APPLIQUER:
            continue

        # Vider les cinq familles. Un `KAggregateGeom` neuf serait plus propre,
        # mais rien ne garantit que la propriete accepte un objet construit en
        # Python : on vide en place, ce qui se verifie tout de suite.
        avant = n
        for f in FAMILLES:
            try:
                agg.set_editor_property(f, [])
            except Exception as e:
                inaccessibles.append("%s / %s / %s : %s" % (nom_asset, os_nom, f, e))
        try:
            bs.set_editor_property("agg_geom", agg)
        except Exception as e:
            inaccessibles.append("%s / %s / agg_geom : %s" % (nom_asset, os_nom, e))

        apres, _ = compter_formes(lire(bs, "agg_geom")[1] or agg)
        if apres == 0:
            touche = True
            total_vides += 1
        else:
            inaccessibles.append("%s / %s : %d volume(s) subsistent" % (nom_asset, os_nom, apres))
        dire("   %-30s %-12s %d volume(s) -> %d" % (nom_asset, os_nom, avant, apres))

    # ⚠ `corps_vus` a ete rempli AVANT le vidage : en mode reparation, cette
    # ligne decrit l'etat d'ENTREE, pas celui de sortie. Le dire, sinon elle se
    # lit comme un echec (« Wheel_FL[sphere x1] » juste apres « 1 -> 0 »).
    suffixe = "   [etat d'entree]" if APPLIQUER and touche else ""
    dire("%-34s %s%s" % (nom_asset, " · ".join(corps_vus) or "AUCUN CORPS JOIGNABLE", suffixe))

    if APPLIQUER and touche:
        # ⚠ `only_if_is_dirty` vaut True par defaut : sans ce False, une
        # sauvegarde peut ne rien ecrire et ne rien dire.
        if unreal.EditorAssetLibrary.save_asset(chemin, only_if_is_dirty=False):
            total_sauves += 1
        else:
            inaccessibles.append("%s : save_asset a rendu False" % nom_asset)

dire("")
dire("=== BILAN ===")
dire("  corps sur des os de roue trouves : %d  (attendu : %d = 4 x %d)"
     % (total_roues, 4 * len(phys), len(phys)))
dire("  corps de roue sans volume        : %d" % total_vides)
if APPLIQUER:
    dire("  PhysicsAsset sauves              : %d" % total_sauves)
if illisibles:
    dire("  proprietes illisibles            : %d" % illisibles)
for m in inaccessibles[:20]:
    dire("  ECHEC : %s" % m)

# ── Les conditions de ROUGE ──────────────────────────────────────────────────
if total_roues == 0:
    dire("")
    dire("ROUGE : aucun corps de roue atteint — la sonde n'a rien mesure.")
    dire("        Ce n'est PAS « les roues sont propres ». Verifier les noms de")
    dire("        sous-objet, ou l'exposition Python de cette version du moteur.")
    dire("        Repli sans editeur : node scripts/narvos-phys-roues.mjs")
    sys.exit(1)

if inaccessibles:
    dire("")
    dire("ROUGE : %d operation(s) ont echoue." % len(inaccessibles))
    sys.exit(1)

if APPLIQUER:
    dire("")
    dire("  ⚠ Une sauvegarde reussie ne prouve pas une ecriture. Le temoin est un")
    dire("    PROCESSUS NEUF, apres recook : node scripts/narvos-phys-roues.mjs")
else:
    dire("")
    dire("  (constat seul — poser NARVOS_APPLIQUER=1 pour reparer)")