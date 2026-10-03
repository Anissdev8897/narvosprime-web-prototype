# ══════════════════════════════════════════════════════════════════════════════
# adk-valider-coiffures.py — les coiffures copiées se chargent-elles VRAIMENT ?
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript
#       -script=".../adk-valider-coiffures.py"
#
# ── POURQUOI CE CONTRÔLE ──────────────────────────────────────────────────────
# Les 24 meshes de coiffure viennent d'un pack Unreal 4.26, copiés en `.uasset`
# bruts sous `/Game/Narvos/StylizedModularChar/Meshes/*/Hair`. Deux choses
# peuvent avoir échoué sans que la copie ne s'en aperçoive :
#
#   1. la version du format — un asset 4.26 chargé par 5.7 ;
#   2. les RÉFÉRENCES INTERNES. Le pack d'origine se monte sous
#      `/Game/StylizedModularChar/…` ; ici il vit sous `/Game/Narvos/…`. Un
#      matériau référencé par son ancien chemin ne résoudra pas, et le mesh
#      sortira GRIS — le défaut qu'on vient de corriger sur les troopers.
#
# Un fichier présent sur le disque ne prouve donc rien. On CHARGE chaque asset et
# on suit ses slots de matériau jusqu'aux textures, comme
# `adk-verifier-textures.py` le fait pour les SkeletalMesh.
# ══════════════════════════════════════════════════════════════════════════════

import unreal


def journal(message):
    unreal.log("[NARVOS] " + message)


RACINE = "/Game/Narvos/StylizedModularChar/Meshes"

registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)

donnees = [d for d in registre.get_assets_by_path(RACINE, recursive=True)]
journal("%d asset(s) sous %s" % (len(donnees), RACINE))

if not donnees:
    journal("ARRET : le registre ne voit rien. La copie n'a pas ete prise en compte,")
    journal("  ou le chemin de package differe du chemin disque.")
    raise SystemExit(1)

charges, illisibles = [], []
sans_texture, avec_texture = [], []

for d in donnees:
    nom = str(d.asset_name)
    actif = None
    try:
        actif = d.get_asset()
    except Exception as erreur:                              # noqa: BLE001
        illisibles.append((nom, str(erreur)))
        continue

    if actif is None:
        illisibles.append((nom, "get_asset a rendu None"))
        continue

    charges.append(nom)

    # Les StaticMesh exposent leurs materiaux par `static_materials`. Un nom
    # different selon la version : on tente les deux plutot que de supposer.
    slots = None
    for propriete in ("static_materials", "materials"):
        try:
            slots = actif.get_editor_property(propriete)
            break
        except Exception:                                    # noqa: BLE001
            continue

    if not slots:
        sans_texture.append(nom + " (aucun slot)")
        continue

    n = 0
    for slot in slots:
        interface = None
        for propriete in ("material_interface", "material_slot_name"):
            try:
                v = slot.get_editor_property(propriete)
                if isinstance(v, unreal.MaterialInterface):
                    interface = v
                    break
            except Exception:                                # noqa: BLE001
                continue

        if interface is None:
            continue

        # Un MaterialInstance expose ses textures ; un Material brut les garde
        # dans son graphe, hors de portee du Python. On compte alors le materiau
        # comme present sans pouvoir en mesurer les textures — c'est explicite.
        try:
            for v in interface.get_editor_property("texture_parameter_values"):
                if v.get_editor_property("parameter_value") is not None:
                    n += 1
        except Exception:                                    # noqa: BLE001
            n += 1        # Material brut : materiau lie, textures non mesurables

    (avec_texture if n > 0 else sans_texture).append(nom)

journal("")
journal("=== bilan ===")
journal("  %d charge(s)" % len(charges))
journal("  %d illisible(s)" % len(illisibles))
journal("  %d avec un materiau resolu" % len(avec_texture))
journal("  %d SANS materiau — ils sortiraient GRIS" % len(sans_texture))

for etiquette, liste in (("ILLISIBLES", [n for n, _ in illisibles]),
                         ("GRIS", sans_texture)):
    if liste:
        journal("")
        journal("  %s (%d) :" % (etiquette, len(liste)))
        for n in liste[:12]:
            journal("      " + n)

for nom, raison in illisibles[:5]:
    journal("  %s : %s" % (nom, raison))

if illisibles:
    raise SystemExit(1)