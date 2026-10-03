# ══════════════════════════════════════════════════════════════════════════════
# adk-verify-import.py — un import a-t-il RÉELLEMENT abouti ?
#
#   UnrealEditor-Cmd.exe <projet>.uproject -run=pythonscript
#       -script=".../adk-verify-import.py"
#
# `NARVOS_RACINE` : chemin de package à vérifier (ex. `Game/Narvos/stylized_modular`).
#     Écrire la forme SANS barre initiale sous Git Bash : MSYS ne la réécrit pas.
#
# ── POURQUOI CE SCRIPT ────────────────────────────────────────────────────────
# « 40 ok, 0 en échec » ne prouve rien. Les deux défauts déjà payés sur ce projet
# passent tous les deux le contrôle de l'importeur :
#
#   1. LE SQUELETTE. Le pipeline Interchange accepte qu'on lui pose `skeleton`
#      et l'ignore parfois. Un mesh lié à un squelette fabriqué à l'import ne
#      jouera AUCUNE animation nanos, sans jamais lever d'erreur.
#
#   2. LES TEXTURES. La compilation des textures est asynchrone : sauver une
#      seule fois à la fin écrivait des matériaux sans image. Les personnages
#      sortaient GRIS, l'import se déclarant réussi. (Correctif : sauver après
#      chaque fichier — voir adk-import-narvos.py.)
#
# On compte donc, par mesh, le squelette ET le nombre de textures réellement
# atteignables depuis ses matériaux. Zéro texture sur un mesh censé être habillé
# est le symptôme exact du personnage gris.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal


def journal(message):
    unreal.log("[NARVOS] " + message)


def _racine():
    """Chemin de package, protégé contre la conversion de chemins de Git Bash.

    ⚠ MSYS réécrit toute valeur commençant par `/`. `NARVOS_RACINE=/Game/x`
    arrive donc en `C:/Program Files/Git/Game/x`. On retrouve le point de
    montage DANS la chaîne — un simple découpage sur le dernier segment perdrait
    les sous-dossiers et rendrait un audit à zéro asset sans la moindre erreur.
    """
    v = os.environ.get("NARVOS_RACINE", "/Game/Narvos").replace("\\", "/").strip()
    if not v:
        return "/Game/Narvos"

    for montage in ("/Game/", "/Engine/", "/Script/"):
        i = v.find(montage)
        if i >= 0:
            return v[i:].rstrip("/")
    for montage in ("/Game", "/Engine", "/Script"):
        if v.endswith(montage):
            return montage
    return v if v.startswith("/") else "/" + v


RACINE = _racine()
ATTENDU = "SKEL_Mannequin"

registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)

actifs = registre.get_assets_by_path(RACINE, recursive=True)
meshes = [a for a in actifs if str(a.asset_class_path.asset_name) == "SkeletalMesh"]

journal("racine : %s — %d asset(s), %d SkeletalMesh" % (RACINE, len(actifs), len(meshes)))

if not meshes:
    journal("AUCUN SkeletalMesh. Verifier NARVOS_RACINE : un chemin de package")
    journal("inexistant rend zero asset SANS erreur.")
    raise SystemExit(1)

bons, mauvais, gris = 0, [], []

for a in sorted(meshes, key=lambda x: str(x.package_name)):
    chemin = str(a.package_name)
    nom = chemin.split("/")[-1]
    mesh = unreal.load_asset(chemin)
    if mesh is None:
        mauvais.append((nom, "illisible"))
        continue

    # ── squelette ─────────────────────────────────────────────────────────────
    squelette = mesh.get_editor_property("skeleton")
    nom_squelette = squelette.get_name() if squelette else "(aucun)"

    # ── textures atteignables depuis les matériaux ────────────────────────────
    #
    # On passe par les matériaux du mesh plutôt que par le registre : ce qui
    # compte n'est pas qu'une texture existe quelque part, mais qu'un matériau
    # du mesh la référence. C'est cette liaison-là qui manquait quand les
    # personnages sortaient gris.
    # ⚠ NE PAS appeler `get_texture_parameter_names()` : elle vit sur
    # `MaterialInstance`, pas sur `Material`. Sur un matériau brut elle lève, et
    # si le repli par dépendances partage le même `try`, il saute avec elle — on
    # rapporte alors « 0 texture » sur TOUT, c'est-à-dire un faux personnage gris
    # produit par l'outil de mesure lui-même. Mesuré le 2026-09-03.
    #
    # On interroge donc le registre, seule voie qui vaut pour les deux types :
    # les dépendances dures du paquet du matériau, filtrées sur la CLASSE réelle
    # de l'asset — jamais sur son préfixe de nom, qui ne se vérifie pas.
    textures = set()
    materiaux = []
    try:
        for m in mesh.get_editor_property("materials"):
            interface = m.get_editor_property("material_interface")
            if interface is not None:
                materiaux.append(interface.get_path_name().split(".")[0])
    except Exception as erreur:                                  # noqa: BLE001
        journal("  %-46s materiaux illisibles (%s)" % (nom, erreur))

    for chemin_mat in materiaux:
        try:
            deps = registre.get_dependencies(
                unreal.Name(chemin_mat),
                unreal.AssetRegistryDependencyOptions(include_hard_package_references=True),
            ) or []
        except Exception:                                        # noqa: BLE001
            continue
        for dep in deps:
            for d in registre.get_assets_by_package_name(unreal.Name(str(dep))) or []:
                if "Texture" in str(d.asset_class_path.asset_name):
                    textures.add(str(d.package_name))

    ok_squelette = ATTENDU in nom_squelette
    if not ok_squelette:
        mauvais.append((nom, nom_squelette))
    elif not textures:
        gris.append(nom)
    else:
        bons += 1

    journal("  %-46s %-22s %d texture(s)" % (nom, nom_squelette, len(textures)))

# ── bilan ─────────────────────────────────────────────────────────────────────
journal("")
journal("=== bilan ===")
journal("  %d mesh sur %s avec textures" % (bons, ATTENDU))

if gris:
    journal("")
    journal("  %d MESH SANS TEXTURE — symptome du personnage gris :" % len(gris))
    for nom in gris[:20]:
        journal("      " + nom)

if mauvais:
    journal("")
    journal("  %d MESH SUR LE MAUVAIS SQUELETTE — ne joueront aucune animation :" % len(mauvais))
    for nom, squelette in mauvais[:20]:
        journal("      %-46s %s" % (nom, squelette))

if not gris and not mauvais:
    journal("")
    journal("  TOUT EST BON : squelette et textures verifies sur les %d mesh." % bons)