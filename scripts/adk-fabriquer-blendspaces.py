# -*- coding: utf-8 -*-
"""
adk-fabriquer-blendspaces.py — fabriquer NOS blend spaces de locomotion, sur le
squelette nanos, depuis des animations DÉJÀ cuites et déclarées.

    python scripts/ue-remote.py --fichier scripts/adk-fabriquer-blendspaces.py

⚠ JAMAIS EXÉCUTÉ (écrit le 2026-09-12, éditeur fermé). Il SONDE avant d'agir et
n'écrit qu'à la fin : lire son journal avant de croire qu'il a réussi.

── POURQUOI ─────────────────────────────────────────────────────────────────
Mesuré le 2026-09-12 :
  · l'API nanos anime la locomotion par BLEND SPACE 2D —
    `Character:SetAnimationIdleWalkRunStanding(chemin, tourner_sur_place)`,
    autorité serveur (Stable/Classes/Character.json) ;
  · AUCUN appel de ce genre n'existait dans notre code : le jeu tourne donc sur
    la locomotion NATIVE de nanos ;
  · le pack déclare UN SEUL blend space (`BS_EnemyWalk`, Freeflow) ;
  · mais 1 947 animations de déplacement SONT déclarées, dont 1 253 du dossier
    `Narvos/Locomotion`, et ce dossier est sur `SKEL_Mannequin` (7 371 mentions
    relevées dans les .uasset) — c'est-à-dire NOTRE squelette.

Il ne manque donc pas d'animations : il manque les deux blend spaces qui les
rendent utilisables. On ne réimporte rien, on assemble ce qui est déjà là.

── CE QUE LE SCRIPT NE SUPPOSE PAS ──────────────────────────────────────────
L'API Python d'Unreal n'expose pas toujours l'ajout d'échantillons dans un blend
space. Le script commence donc par DIRE ce que la classe expose, essaie la voie
la plus directe, et rapporte honnêtement si elle manque — plutôt que d'écrire un
asset vide qui passerait pour un succès.
"""
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

DOSSIER = "/Game/Narvos/PontMetaHuman"          # à côté du pont, même famille d'outils
SOURCE = "/Game/Narvos/Locomotion"
MESH_NANOS = "/Game/NanosWorld/Characters/Mannequin/SK_Mannequin"

# Les échantillons d'un blend space 2D : (nom, vitesse X, vitesse Y).
# X = avant/arrière, Y = droite/gauche, en cm/s — mêmes axes que nanos.
#
# ⚠ AUCUN NOM D'ANIMATION EN DUR. On décrit ce qu'on cherche par motifs, et le
# script prend la PREMIÈRE animation du dossier qui correspond, en journalisant
# son choix. Un nom écrit à la main ici deviendrait faux au premier renommage du
# pack, et une référence morte ne lève rien.
PLAN_DEBOUT = [
    ("idle",    ["Idle"],                          0.0,    0.0),
    ("walk_f",  ["Walk", "_F_"],                  200.0,   0.0),
    ("walk_b",  ["Walk", "_B_"],                 -200.0,   0.0),
    ("walk_l",  ["Walk", "_L_"],                    0.0, -200.0),
    ("walk_r",  ["Walk", "_R_"],                    0.0,  200.0),
    ("run_f",   ["Run", "_F_"],                   500.0,   0.0),
    ("run_b",   ["Run", "_B_"],                  -500.0,   0.0),
    ("run_l",   ["Run", "_L_"],                     0.0, -500.0),
    ("run_r",   ["Run", "_R_"],                     0.0,  500.0),
]

PLAN_ACCROUPI = [
    ("idle",    ["Crouch", "Idle"],                 0.0,   0.0),
    ("walk_f",  ["Crouch", "Walk", "_F_"],        150.0,   0.0),
    ("walk_b",  ["Crouch", "Walk", "_B_"],       -150.0,   0.0),
    ("walk_l",  ["Crouch", "Walk", "_L_"],          0.0, -150.0),
    ("walk_r",  ["Crouch", "Walk", "_R_"],          0.0,  150.0),
]


def dire(t):
    print(t)
    unreal.log("[NARVOS] " + t)


# ── Ce que la classe expose VRAIMENT ─────────────────────────────────────────

dire("BlendSpace : methodes exposees par les bindings Python")
exposees = [n for n in dir(unreal.BlendSpace) if not n.startswith("_")]
interessantes = [n for n in exposees if any(
    m in n.lower() for m in ("sample", "axis", "skeleton", "animation"))]
dire("   " + ", ".join(interessantes) if interessantes else "   (aucune)")

peut_poser = hasattr(unreal.BlendSpace, "add_sample")
if not peut_poser:
    dire("")
    dire("⚠ `add_sample` n est PAS expose : le script peut CREER les blend spaces")
    dire("  et poser leur squelette, mais pas y placer les echantillons. Il faudra")
    dire("  les deposer a la main dans l editeur (glisser les animations sur la")
    dire("  grille), ou passer par un Blueprint d editeur. Le script continue et")
    dire("  laisse des assets PRETS, en le disant.")

# ── Le squelette : lu sur le mesh nanos, jamais devine ───────────────────────

mesh = unreal.EditorAssetLibrary.load_asset(MESH_NANOS)
if mesh is None:
    dire("ARRET : mesh nanos introuvable : " + MESH_NANOS)
    raise SystemExit(1)
squelette = mesh.get_editor_property("skeleton")
dire("squelette cible : " + squelette.get_path_name())

# ── Les animations candidates ────────────────────────────────────────────────

registre = unreal.AssetRegistryHelpers.get_asset_registry()
donnees = registre.get_assets_by_path(SOURCE, recursive=True) or []
animations = [d for d in donnees
              if str(d.asset_class_path.asset_name) == "AnimSequence"]
dire("%d AnimSequence sous %s" % (len(animations), SOURCE))

noms = sorted((str(d.asset_name), str(d.package_name)) for d in animations)


def trouver(motifs):
    """Première animation dont le nom porte TOUS les motifs. None sinon."""
    for nom, paquet in noms:
        bas = nom.lower()
        if all(m.lower() in bas for m in motifs):
            return nom, paquet
    return None


def fabriquer(nom_asset, plan):
    outils = unreal.AssetToolsHelpers.get_asset_tools()
    existant = unreal.EditorAssetLibrary.load_asset(DOSSIER + "/" + nom_asset)
    if existant is not None:
        dire("%s existe deja — laisse tel quel" % nom_asset)
        bs = existant
    else:
        bs = outils.create_asset(nom_asset, DOSSIER, unreal.BlendSpace,
                                 unreal.BlendSpaceFactoryNew())
        if bs is None:
            dire("ECHEC de creation : " + nom_asset)
            return None
        try:
            bs.set_editor_property("skeleton", squelette)
        except Exception as err:
            dire("  squelette non pose sur %s : %s" % (nom_asset, err))

    poses, manquantes = 0, []
    for cle, motifs, vx, vy in plan:
        trouve = trouver(motifs)
        if trouve is None:
            manquantes.append(cle + " (" + "+".join(motifs) + ")")
            continue
        nom, paquet = trouve
        dire("  %-8s -> %s" % (cle, nom))
        if peut_poser:
            anim = unreal.EditorAssetLibrary.load_asset(str(paquet) + "." + nom)
            try:
                bs.add_sample(anim, unreal.Vector(vx, vy, 0.0))
                poses += 1
            except Exception as err:
                dire("    echantillon refuse : %s" % err)

    if manquantes:
        dire("  ⚠ sans animation trouvee : " + ", ".join(manquantes))
    dire("  %d echantillon(s) pose(s)" % poses)
    unreal.EditorAssetLibrary.save_asset(DOSSIER + "/" + nom_asset)
    return bs


dire("")
dire("── BS_Narvos_Debout ──")
fabriquer("BS_Narvos_Debout", PLAN_DEBOUT)
dire("")
dire("── BS_Narvos_Accroupi ──")
fabriquer("BS_Narvos_Accroupi", PLAN_ACCROUPI)

dire("")
dire("Ensuite, et SEULEMENT si les echantillons sont poses :")
dire("  1. cuire (les deux assets vivent sous /Game/Narvos/PontMetaHuman) ;")
dire("  2. reconstruire le pack — le builder expose BlendSpace depuis le 12/09 ;")
dire("  3. en jeu : /locomotion narvos::BS_Narvos_Debout, puis marcher.")