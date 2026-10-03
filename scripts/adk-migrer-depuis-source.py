# ══════════════════════════════════════════════════════════════════════════════
# adk-migrer-depuis-source.py — migrer des assets du projet SOURCE vers l'ADK.
#
#   NARVOS_A_MIGRER=/Game/Character/Materials/M_Master_Cloth_HS \
#   UnrealEditor-Cmd.exe "<GameAnimationSample>.uproject" -run=pythonscript \
#       -script=".../adk-migrer-depuis-source.py"
#
# ⚠ SE LANCE SUR LE PROJET SOURCE, PAS SUR L'ADK. `migrate_packages` exporte
# depuis le projet courant vers le dossier Content d'un autre.
#
# ── POURQUOI MIGRATE ET PAS UNE COPIE DE FICHIER ──────────────────────────────
# C'est une copie de `.uasset` par l'explorateur qui a produit les 166 instances
# sans parent de ce projet : un `.uasset` porte son chemin de package EN DUR, et
# le deplacer a la main laisse un asset qui se croit ailleurs. Aucune reference
# ne resout, et rien ne le signale.
#
# `migrate_packages` fait ce qu'il faut : il emporte l'asset ET ses dependances,
# en preservant l'arborescence `/Game/...`.
#
# ── CE QU'IL RESTE A FAIRE APRES ──────────────────────────────────────────────
# L'asset atterrit sous `<ADK>/Content/Character/...`, donc HORS de `Narvos/`.
# Or `Assets.toml` declare `unreal_folders = ["Narvos"]` : un asset ailleurs ne
# serait jamais cuit dans le pack.
#
# Le deplacer se fait ensuite DANS l'ADK, avec `EditorAssetLibrary.rename_asset`
# — qui est un vrai Move et reecrit les references. Voir
# `adk-ranger-migres.py`.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal

def chemin_unreal(p):
    """Rend un chemin `/Game/...` meme si le shell l'a converti.

    ⚠ Git Bash REECRIT tout argument commencant par `/` en chemin Windows :
    `/Game/Character/...` devient `C:/Program Files/Git/Game/Character/...`.
    Ca a fait echouer deux commandes aujourd'hui, avec pour seul symptome un
    « ABSENT de la source » parfaitement trompeur.
    `MSYS_NO_PATHCONV=1` l'evite, mais l'oubli est trop facile : on repare ici.
    """
    p = p.replace("\\", "/").strip()
    for marque in ("/Game/", "/Engine/"):
        i = p.find(marque)
        if i > 0:
            return p[i:]
    if p and not p.startswith("/"):
        return "/" + p
    return p


ADK_CONTENT = os.environ.get(
    "NARVOS_ADK_CONTENT",
    "E:/narvosprime-web-prototype/WebPortal/Server/adk/Content",
)
A_MIGRER = [chemin_unreal(p) for p in os.environ.get("NARVOS_A_MIGRER", "").split(",") if p.strip()]




def journal(m):
    unreal.log("[NARVOS] " + m)


if not A_MIGRER:
    journal("ARRET : NARVOS_A_MIGRER est vide")
    raise SystemExit(0)

# Un asset absent ferait migrer une liste vide sans rien dire.
presents, absents = [], []
for p in A_MIGRER:
    (presents if unreal.EditorAssetLibrary.does_asset_exist(p) else absents).append(p)

for p in absents:
    journal("ABSENT de la source : " + p)
if not presents:
    journal("ARRET : rien a migrer")
    raise SystemExit(0)

journal("%d asset(s) a migrer vers %s" % (len(presents), ADK_CONTENT))
for p in presents:
    journal("  " + p)

# Les dependances partent avec, c'est tout l'interet.
registre = unreal.AssetRegistryHelpers.get_asset_registry()
options = unreal.AssetRegistryDependencyOptions(include_hard_package_references=True)
for p in presents:
    paquet = p.split(".")[0]
    deps = registre.get_dependencies(unreal.Name(paquet), options) or []
    journal("  %s : %d dependance(s) directe(s)" % (paquet.rsplit("/", 1)[-1], len(deps)))

noms = [unreal.Name(p.split(".")[0]) for p in presents]
migration = unreal.MigrationOptions()
try:
    # ⚠ ECRASER plutot que SKIP : sans ca, un asset deja present cote ADK — meme
    # casse — serait conserve, et la migration paraitrait reussie.
    migration.set_editor_property("asset_conflict", unreal.AssetMigrationConflict.OVERWRITE)
except Exception as e:
    journal("options par defaut (%s)" % e)

outils = unreal.AssetToolsHelpers.get_asset_tools()
try:
    outils.migrate_packages(noms, ADK_CONTENT, migration)
    journal("migration lancee")
except Exception as e:
    journal("ECHEC migration : %s" % e)
    raise SystemExit(0)

# ── Controle sur le DISQUE de l'ADK ──────────────────────────────────────────
#
# On ne peut pas relire l'ADK depuis ici : on verifie donc que les fichiers
# existent, ce qui est le seul signal disponible et suffit a dire si la
# migration a ecrit quelque chose.

journal("")
journal("=== fichiers ecrits cote ADK")
for p in presents:
    rel = p.split(".")[0].replace("/Game/", "") + ".uasset"
    cible = os.path.join(ADK_CONTENT, rel).replace("\\", "/")
    journal("  %-58s %s" % (rel, "OK" if os.path.exists(cible) else "ABSENT"))