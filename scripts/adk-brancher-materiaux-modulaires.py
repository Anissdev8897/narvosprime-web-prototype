# ══════════════════════════════════════════════════════════════════════════════
# adk-brancher-materiaux-modulaires.py — donner leurs textures aux pieces grises.
#
#   Depuis l'editeur ouvert :
#       exec(open(r"...\adk-brancher-materiaux-modulaires.py", encoding="utf-8").read())
#
# ── LE DEFAUT, ET SES DEUX COUCHES ────────────────────────────────────────────
# Les 64 pieces modulaires reimportees le 2026-09-08 sont sorties grises. Deux
# causes empilees, corrigees dans cet ordre :
#
#   1. KTX2 — Interchange refuse `KHR_texture_basisu` et n'importe AUCUNE image.
#      Corrige par `narvos-textures-vers-png.mjs` (ktx.exe), 221 GLB transcodes.
#   2. Nom reserve — 42 materiaux sur 70 s'appelaient `WorldGridMaterial`, le
#      materiau gris du moteur. Corrige par `adk-renommer-worldgrid-tout.py`.
#
# Restait la troisieme : le materiau renomme existe, les textures existent a cote,
# **et le graphe ne les cable pas**. C'est ce que ce script fait.
#
# ── POURQUOI UNE INSTANCE ET PAS UN GRAPHE ────────────────────────────────────
# Ecrire un graphe de materiau depuis Python est fragile : `expression_collection`
# n'existe pas en 5.7, et la memoire du depot dit de ne jamais sauver un UMaterial
# en commandlet. Une MaterialInstanceConstant, elle, ne fait que POSER des valeurs
# sur un maitre deja compile — rien a compiler, rien a casser.
#
# Le maitre est `Mat_Clothing_Master` du pack MetaCustom, releve et non suppose :
#     parametres TEXTURE : Diffuse, Normal_Map, MetalRoughOcclusion
#     opaque, default lit
# C'est le pack modulaire SAIN du projet (57 SkeletalMesh, 231 textures) : son
# maitre est deja celui qui rend correctement des vetements.
#
# ⚠ NE TOUCHE QUE CE QUI EST CASSE. Un dossier dont le materiau porte deja une
# texture propre (cs_torso, samurai : MI_Body/MI_Head avec 5 textures) est laisse
# tel quel. Remplacer un materiau qui marche par une instance generique perdrait
# ses reglages — et c'est la faute qu'on ne verrait qu'a l'ecran.
# ══════════════════════════════════════════════════════════════════════════════

import unreal

RACINE = "/Game/Narvos"
MAITRE = "/Game/Narvos/MetaCustom/Material/Mat_Clothing_Master"

# Suffixe de notre texture -> parametre du maitre. Les deux listes sont relevees,
# pas devinees : `adk-renommer-worldgrid-tout.py` ecrit les premiers,
# `MaterialEditingLibrary.get_texture_parameter_names` a donne les seconds.
LIAISONS = [
    ("_BaseColor", "Diffuse"),
    ("_Normal", "Normal_Map"),
    ("_ORM", "MetalRoughOcclusion"),
]

DEFAUTS = set([
    "T_Anisotropy_Direction_Linear", "T_Generic_N", "T_White_Linear",
    "T_White_srgb", "DefaultTexture", "DefaultNormal",
])


def journal(m):
    unreal.log("[NARVOS] " + str(m))


ar = unreal.AssetRegistryHelpers.get_asset_registry()
ar.search_all_assets(True)
maitre = unreal.load_asset(MAITRE)
if maitre is None:
    journal("ARRET : maitre introuvable " + MAITRE)
    raise SystemExit

outils = unreal.AssetToolsHelpers.get_asset_tools()
MEL = unreal.MaterialEditingLibrary

# ── Recensement : quels dossiers ont un materiau SANS texture propre ? ───────

candidats = {}
for a in ar.get_assets_by_path(unreal.Name(RACINE), recursive=True):
    if str(a.asset_class_path.asset_name) != "Material":
        continue
    dossier = str(a.package_path)
    deps = ar.get_dependencies(unreal.Name(str(a.package_name)),
                               unreal.AssetRegistryDependencyOptions()) or []
    propres = 0
    for d in deps:
        for b in ar.get_assets_by_package_name(d):
            if str(b.asset_class_path.asset_name).startswith("Texture") \
               and str(b.asset_name) not in DEFAUTS:
                propres += 1
    # ⚠ UN DOSSIER N'EST CANDIDAT QUE SI **AUCUN** DE SES MATERIAUX N'A DE
    # TEXTURE. La premiere version prenait le dossier des qu'UN SEUL materiau
    # etait sans texture — et condamnait tout le reste avec lui.
    #
    # Mesure du 2026-09-08 : le dossier `murdock` a ete pris pour reparable a
    # cause de `M_Eye_Occlusion`, dont l'unique texture est un defaut moteur.
    # Ses sept autres materiaux en portaient de 4 a 10 — dont
    # `M_Murdock_Head_Murdock` et ses 9 textures. Resultat : le `head` a perdu
    # ses cinq materiaux distincts au profit d'une instance generique.
    #
    # On compte donc par dossier, et on ne tranche qu'a la fin.
    etat = candidats.setdefault(dossier, {"sans": 0, "avec": 0})
    if propres == 0:
        etat["sans"] += 1
    else:
        etat["avec"] += 1

candidats = {d: e for d, e in candidats.items() if e["avec"] == 0 and e["sans"] > 0}
journal("%d dossier(s) dont AUCUN materiau n'a de texture propre" % len(candidats))

# ── Perimetre optionnel (2026-10-04) ──────────────────────────────────────────
# `NARVOS_DOSSIERS` : chemins de paquet separes par des virgules. Rejouer cette
# passe sur un ADK a moitie rebati ne doit toucher QUE les dossiers rebatis : un
# dossier rendu tel qu'il etait le 23/09 a deja recu sa passe, ou ne l'avait pas
# recue expres. Sans la variable, comportement d'origine (tout /Game/Narvos).
import os as _os
_limite = set(d.strip().rstrip("/") for d in _os.environ.get("NARVOS_DOSSIERS", "").split(",") if d.strip())
if _limite:
    candidats = {d: e for d, e in candidats.items() if d in _limite}
    journal("perimetre NARVOS_DOSSIERS : %d candidat(s) retenu(s) sur %d dossier(s) demandes"
            % (len(candidats), len(_limite)))

# ── Reparation ───────────────────────────────────────────────────────────────

faits, sautes, sans_textures = 0, 0, []

for dossier in sorted(candidats):
    # Les textures presentes DANS CE DOSSIER, par suffixe.
    presentes = {}
    for a in ar.get_assets_by_path(unreal.Name(dossier), recursive=False):
        if not str(a.asset_class_path.asset_name).startswith("Texture"):
            continue
        for suffixe, _ in LIAISONS:
            if str(a.asset_name).endswith(suffixe):
                presentes[suffixe] = str(a.package_name)

    # Sans couleur de base, l'instance serait grise elle aussi : rien a gagner.
    if "_BaseColor" not in presentes:
        sans_textures.append(dossier)
        continue

    nom_inst = "MI_" + dossier.split("/")[-1]
    chemin_inst = dossier + "/" + nom_inst
    if unreal.EditorAssetLibrary.does_asset_exist(chemin_inst):
        sautes += 1
        continue

    inst = outils.create_asset(nom_inst, dossier,
                               unreal.MaterialInstanceConstant,
                               unreal.MaterialInstanceConstantFactoryNew())
    if inst is None:
        journal("  ECHEC creation " + chemin_inst)
        continue
    MEL.set_material_instance_parent(inst, maitre)

    poses = 0
    for suffixe, param in LIAISONS:
        if suffixe not in presentes:
            continue
        tex = unreal.load_asset(presentes[suffixe])
        if tex is None:
            continue
        MEL.set_material_instance_texture_parameter_value(inst, param, tex)
        poses += 1

    # ── Poser l'instance sur les meshes du dossier ───────────────────────────
    meshes = 0
    for a in ar.get_assets_by_path(unreal.Name(dossier), recursive=False):
        if str(a.asset_class_path.asset_name) != "SkeletalMesh":
            continue
        obj = unreal.load_asset(str(a.package_name))
        if obj is None:
            continue
        slots = obj.get_editor_property("materials")

        # ⚠ NE JAMAIS APLATIR UN MESH MULTI-MATERIAUX.
        #
        # Poser une instance unique sur TOUS les slots est juste pour une piece a
        # matiere unique — un pantalon, une botte. C'est FAUX des qu'un mesh
        # distingue ses parties.
        #
        # Mesure du 2026-09-08, apres coup : sur 1 079 meshes a 2+ slots, 36 se
        # sont retrouves avec un seul materiau. La plupart sans consequence
        # (`Manny_*_anim`, des artefacts d'import d'animation), mais le `head` de
        # Murdock avait CINQ materiaux distincts — peau, yeux, larmoiement,
        # occlusion, conduit lacrymal — aplatis en un.
        #
        # On ne touche donc que les meshes dont les slots portent DEJA la meme
        # chose (ou rien) : ceux-la n'ont aucune distinction a perdre.
        distincts = set()
        for s in slots:
            mi = s.material_interface
            distincts.add(mi.get_name() if mi else "VIDE")
        if len(distincts) > 1:
            journal("    GARDE  %s : %d materiaux distincts, non touche"
                    % (str(a.asset_name), len(distincts)))
            continue

        neuf = []
        for s in slots:
            s.material_interface = inst
            neuf.append(s)
        obj.set_editor_property("materials", neuf)
        meshes += 1

    unreal.EditorAssetLibrary.save_directory(dossier, only_if_is_dirty=False, recursive=False)
    faits += 1
    journal("  %-28s %d texture(s) posee(s), %d mesh(es)" % (nom_inst, poses, meshes))

journal("")
journal("%d instance(s) creee(s), %d deja faite(s), %d sans couleur de base"
        % (faits, sautes, len(sans_textures)))
for d in sans_textures[:10]:
    journal("    SANS COULEUR  " + d)