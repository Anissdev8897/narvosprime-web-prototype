# ══════════════════════════════════════════════════════════════════════════════
# adk-sonder-parametres-materiaux.py — quels paramètres de couleur nos matériaux
# exposent-ils vraiment ?
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript
#       -script=".../adk-sonder-parametres-materiaux.py"
#
# `NARVOS_MATS` : chemin de package (défaut /Game/Narvos/StylizedModularChar/Materials)
#
# ── POURQUOI SONDER PLUTÔT QUE SUPPOSER ───────────────────────────────────────
# `SetMaterialColorParameter(param, Color, index, attachable_id)` prend le NOM
# du paramètre. Un nom qui n'existe pas ne lève RIEN : la couleur n'est pas
# appliquée, le personnage garde sa teinte, et on cherche la panne dans l'écran.
#
# C'est exactement le mode d'échec qui a coûté le plus cher sur ce projet — un
# nom d'asset faux, ignoré en silence. On demande donc au matériau ce qu'il
# accepte, au lieu de parier sur « Tint » ou « BaseColor ».
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal


def journal(message):
    unreal.log("[NARVOS] " + message)


def _chemin():
    """Chemin de package, protégé de la conversion de chemins de Git Bash."""
    v = os.environ.get("NARVOS_MATS", "/Game/Narvos/StylizedModularChar/Materials")
    v = v.replace("\\", "/").strip()
    i = v.find("/Game/")
    if i >= 0:
        return v[i:]
    if v.startswith("Game/"):
        return "/" + v
    return v


RACINE = _chemin()
journal("racine : " + RACINE)

registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)

donnees = registre.get_assets_by_path(RACINE, recursive=True)
if not donnees:
    journal("ARRET : aucun asset sous " + RACINE)
    raise SystemExit(1)

# Un paramètre est utile s'il est PARTAGÉ : recolorer la peau doit marcher sur
# toutes les pièces de peau, pas sur une seule.
frequence = {}
par_materiau = {}

for d in donnees:
    actif = d.get_asset()
    if not isinstance(actif, (unreal.MaterialInstance, unreal.Material)):
        continue

    nom = str(d.asset_name)
    trouves = []

    # MaterialInstance : les valeurs surchargées, celles qu'on peut réellement
    # piloter au runtime.
    try:
        for v in actif.get_editor_property("vector_parameter_values"):
            info = v.get_editor_property("parameter_info")
            trouves.append(str(info.get_editor_property("name")))
    except Exception:                                        # noqa: BLE001
        pass

    # Material brut : ses paramètres vivent dans le graphe. `get_vector_parameter_names`
    # existe selon les versions ; on tente sans en faire une erreur.
    if not trouves:
        for methode in ("get_vector_parameter_names",):
            try:
                trouves = [str(x) for x in getattr(unreal.MaterialEditingLibrary, methode)(actif)]
                break
            except Exception:                                # noqa: BLE001
                continue

    if trouves:
        par_materiau[nom] = trouves
        for p in trouves:
            frequence[p] = frequence.get(p, 0) + 1

journal("%d materiau(x) examine(s), %d avec parametre(s) de couleur"
        % (len(donnees), len(par_materiau)))
journal("")

if not frequence:
    journal("AUCUN parametre vectoriel expose.")
    journal("  Les couleurs sont alors cuites dans les textures : les changer")
    journal("  demanderait un materiau parent avec un parametre, pas du Lua.")
    raise SystemExit(1)

journal("parametres, du plus partage au moins :")
for p, n in sorted(frequence.items(), key=lambda kv: (-kv[1], kv[0])):
    journal("    %-28s %d materiau(x)" % (p, n))

journal("")
journal("par materiau :")
for nom in sorted(par_materiau)[:20]:
    journal("    %-28s %s" % (nom, ", ".join(par_materiau[nom])))