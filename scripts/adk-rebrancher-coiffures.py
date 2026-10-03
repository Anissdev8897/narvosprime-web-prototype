# ══════════════════════════════════════════════════════════════════════════════
# adk-rebrancher-coiffures.py — rend leurs matériaux aux StaticMesh copiés.
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript
#       -script=".../adk-rebrancher-coiffures.py"
#
# ── LE DÉFAUT ─────────────────────────────────────────────────────────────────
# Les 24 coiffures viennent du pack Stylized 4.26, copiées en `.uasset` bruts.
# Elles se chargent (vérifié : 24/24, 0 illisible), mais AUCUN de leurs matériaux
# ne résout : le pack d'origine se monte sous `/Game/StylizedModularChar/…`, et
# ici il vit sous `/Game/Narvos/StylizedModularChar/…`. Les références internes
# pointent donc dans le vide, et les meshes sortiraient GRIS.
#
# Les matériaux, eux, SONT présents — ils avaient été copiés plus tôt.
# `MI_HairSet_01`, `MI_FemaleHairSet_01`, `M_MasterHair`… Il ne manque que le
# lien.
#
# ── COMMENT ON RETROUVE LE BON MATÉRIAU ───────────────────────────────────────
# L'interface étant nulle, son nom d'origine est perdu. Reste le NOM DU SLOT,
# qu'Unreal conserve : c'est le nom du matériau d'origine dans la quasi-totalité
# des packs. On cherche donc un homonyme parmi les matériaux présents.
#
# Un mesh dont aucun slot ne trouve d'homonyme est laissé INTACT et signalé.
# Mieux vaut une coiffure grise nommée qu'un remplacement au hasard : un cheveu
# texturé avec une peau serait pris pour un bug de rendu, pas pour un mauvais
# appariement.
#
# ⚠ SAUVER APRÈS CHAQUE MESH. La compilation des textures est asynchrone : un
# seul `save_directory` à la fin écrit des matériaux avant que leurs images
# soient prêtes. C'est le défaut qui avait déjà produit des personnages gris.
# ══════════════════════════════════════════════════════════════════════════════

import unreal


def journal(message):
    unreal.log("[NARVOS] " + message)


MESHES = "/Game/Narvos/StylizedModularChar/Meshes"
MATS = "/Game/Narvos/StylizedModularChar/Materials"

registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)

# ── Les matériaux disponibles, indexés par nom ────────────────────────────────

vrais = {}
for d in registre.get_assets_by_path(MATS, recursive=True):
    actif = d.get_asset()
    if isinstance(actif, (unreal.MaterialInstance, unreal.Material)):
        vrais[str(d.asset_name)] = actif

journal("%d materiau(x) disponible(s) sous %s" % (len(vrais), MATS))
if not vrais:
    journal("ARRET : aucun materiau. Verifier que Materials/ a bien ete copie.")
    raise SystemExit(1)

# ── Correspondance mesh → matériau ────────────────────────────────────────────
#
# ⚠ L'APPARIEMENT PAR NOM DE SLOT NE MARCHE PAS ICI. Mesuré : les 24 meshes
# n'exposent que huit noms de slot, et ce sont des noms d'ATELIER —
# `Hair`, `Hat`, `lambert1`, `lambert2`, `China_mat`, `Short_mat`, `Pany_hat`.
# Un seul, `MI_HairSet_01`, correspond à un matériau existant.
#
# On apparie donc par le nom du MESH, qui est parlant. La règle suit la
# numérotation du pack : `SM_Hair_03` → `MI_HairSet_03`.
#
# ⚠ C'EST UNE DÉDUCTION, pas une donnée du pack. Elle est cohérente (mêmes
# numéros, mêmes familles) mais n'a pas été vue en jeu. Une coiffure qui
# sortirait de la mauvaise couleur se corrige ici, en une ligne.

def materiau_pour(nom_mesh):
    """Nom du matériau attendu pour ce mesh, ou None si on ne sait pas.

    Rendre None plutôt qu'un défaut : un cheveu texturé avec une peau serait
    pris pour un bug de rendu, pas pour un mauvais appariement.
    """
    n = nom_mesh

    # Coiffures : la numérotation du mesh est celle du matériau. Le pack a cinq
    # coupes masculines pour quatre jeux de matériau — la cinquième reprend le
    # premier, faute de mieux.
    if n.startswith("SM_FemaleHair_"):
        return "MI_FemaleHairSet_" + n[-2:]
    if n.startswith("SM_Hair_"):
        indice = n[-2:]
        return "MI_HairSet_" + (indice if indice in ("01", "02", "03", "04") else "01")

    # Barbes et sourcils partagent le matériau de cheveux : même mèche, même
    # rendu. Le pack ne livre pas de matériau dédié.
    if n.startswith("SM_Beard_") or n.startswith("SM_Eyebrow_"):
        return "MI_HairSet_01"
    if n.startswith("SM_FemaleEyebrow_"):
        return "MI_FemaleHairSet_01"

    # Couvre-chefs : le matériau de la tenue à laquelle ils appartiennent.
    if "Aviator_Hat" in n:
        return "MI_Aviator"
    if "Cop_Hat" in n:
        return "MI_Cop"
    if "Soldier_Helmet" in n:
        return "MI_Soldier"

    return None


# ── Rebranchement ─────────────────────────────────────────────────────────────

meshes = [d for d in registre.get_assets_by_path(MESHES, recursive=True)
          if str(d.asset_class_path.asset_name) == "StaticMesh"]
journal("%d StaticMesh a traiter" % len(meshes))

touches, remplaces = 0, 0
inchanges, noms_de_slot = [], set()

for d in meshes:
    mesh = d.get_asset()
    if mesh is None:
        continue

    nom_mesh = str(d.asset_name)

    try:
        slots = mesh.get_editor_property("static_materials")
    except Exception as erreur:                              # noqa: BLE001
        journal("  ILLISIBLE %s (%s)" % (nom_mesh, erreur))
        continue

    change = False
    neufs = []

    for slot in slots:
        # Le nom du slot survit à la rupture de référence : c'est notre seule
        # piste vers le matériau d'origine.
        try:
            nom_slot = str(slot.get_editor_property("material_slot_name"))
        except Exception:                                    # noqa: BLE001
            nom_slot = ""

        if nom_slot:
            noms_de_slot.add(nom_slot)

        actuel = slot.get_editor_property("material_interface")

        # Le nom du slot d'abord — quand il porte un vrai nom de materiau, c'est
        # la source la plus sure. La table sert de repli.
        vise = nom_slot if nom_slot in vrais else materiau_pour(nom_mesh)

        if actuel is None and vise in vrais:
            slot.set_editor_property("material_interface", vrais[vise])
            change = True
            remplaces += 1

        neufs.append(slot)

    if not change:
        inchanges.append(nom_mesh)
        continue

    mesh.set_editor_property("static_materials", neufs)

    # ⚠ SAUVER MAINTENANT, pas à la fin. Voir l'en-tête.
    unreal.EditorAssetLibrary.save_loaded_asset(mesh, only_if_is_dirty=False)
    touches += 1
    if touches <= 6:
        journal("  REBRANCHE %s" % nom_mesh)

journal("")
journal("%d mesh(es) rebranche(s), %d slot(s) remplace(s)" % (touches, remplaces))

if inchanges:
    journal("%d mesh(es) INCHANGE(s) :" % len(inchanges))
    for n in inchanges[:12]:
        journal("    " + n)

    # Si rien n'a été rebranché, la cause la plus probable est que les noms de
    # slot ne correspondent à aucun matériau. Les afficher évite de deviner.
    journal("")
    journal("noms de slot rencontres (%d) :" % len(noms_de_slot))
    for n in sorted(noms_de_slot)[:20]:
        journal("    %s%s" % (n, "  ← trouve" if n in vrais else ""))
    journal("noms de materiaux disponibles (%d) :" % len(vrais))
    for n in sorted(vrais)[:20]:
        journal("    " + n)