# ══════════════════════════════════════════════════════════════════════════════
# adk-promouvoir-packs.py — faire passer un pack tiers de `/Game/<Pack>` a
# `/Game/Narvos/<Pack>`, c.-a-d. de « present dans l'editeur » a « cuit dans le
# pack nanos ».
#
#   NARVOS_PACKS=Defender/Demo/Animations,SmartLocomotion \
#   NARVOS_EXCLURE=WidgetBP,Demo/Levels \
#   NARVOS_APPLIQUER=1 \
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="…"
#
# ⚠ EDITEUR FERME. Un commandlet et l'editeur ne cohabitent pas.
# ⚠ La sortie part dans `Saved/Logs/NanosWorldADK.log`, PAS sur stdout :
#    `unreal.log` ecrit dans la categorie LogPython, que la redirection du shell
#    ne voit pas. Lire le log, jamais le terminal.
#
# ── POURQUOI CE SCRIPT EXISTE ─────────────────────────────────────────────────
# `Assets.toml` declare `unreal_folders = ["Narvos"]`. Un asset hors de
# `Narvos/` existe dans l'editeur et n'est JAMAIS cuit — present a l'ecran de
# l'editeur, absent du jeu.
#
# ── POURQUOI PAS `rename_directory` ───────────────────────────────────────────
# Mesure le 2026-09-06, et c'est le piege de ce script :
#
#   • sur `/Game/Defender` elle rend False et ne deplace RIEN — un seul asset
#     illisible (widgets qui referencent `/Script/CommonUI`, plugin non active)
#     fait echouer le dossier ENTIER, tout ou rien ;
#   • sur `/Game/SmartLocomotion` elle rend **True** en ne creant qu'un dossier
#     VIDE. Les 357 fichiers etaient toujours a l'ancienne place. Un succes
#     annonce qui n'a rien ecrit — exactement le mode d'echec de
#     `save_asset(only_if_is_dirty=True)` paye la veille.
#
# `AssetTools.rename_assets([AssetRenameData…])` prend la liste des assets, les
# deplace en UNE passe et reecrit les referents. Ce qui ne se charge pas echoue
# SEUL, et se compte.
#
# ── ⚠ LE SEUL CONTROLE QUI VAUT ───────────────────────────────────────────────
# Un recomptage a l'arrivee, dans ce processus puis dans un processus NEUF.
# « rename a rendu True » ne prouve rien : ci-dessus, il a menti.
#
# ── ⚠ CE QUI PASSE SOUS `Narvos/` PART AU COOK ────────────────────────────────
# Le pack fait deja 31 Go. Promouvoir par SOUS-DOSSIER, pas par pack entier :
# les animations et les meshes, jamais les niveaux de demonstration ni les
# widgets UMG (l'UI de nanos est en WebUI).
# Refus au-dela de NARVOS_PLAFOND_GO (defaut 4) sans NARVOS_FORCER=1.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal


def chemin_unreal(p):
    """Rend un chemin `/Game/...` meme si le shell l'a converti.

    ⚠ Git Bash REECRIT tout argument commencant par `/`. Le script normalise
    lui-meme plutot que de dependre d'un `MSYS_NO_PATHCONV=1` qu'on oublie.
    """
    p = p.replace("\\", "/").strip().strip("/")
    for marque in ("/Game/", "/Engine/"):
        i = ("/" + p).find(marque)
        if i > 0:
            return ("/" + p)[i:]
    if p.startswith("Game/"):
        return "/" + p
    return "/Game/" + p


RACINE = "/Game/Narvos"
PACKS = [chemin_unreal(p) for p in os.environ.get("NARVOS_PACKS", "").split(",") if p.strip()]
EXCLURE = [x.strip().replace("\\", "/") for x in os.environ.get("NARVOS_EXCLURE", "").split(",") if x.strip()]
APPLIQUER = os.environ.get("NARVOS_APPLIQUER") == "1"
FORCER = os.environ.get("NARVOS_FORCER") == "1"
PLAFOND_GO = float(os.environ.get("NARVOS_PLAFOND_GO", "4"))

RACINE_DISQUE = unreal.Paths.project_content_dir()


def journal(m):
    unreal.log("[NARVOS] " + m)


def poids_go(chemin_jeu):
    """Poids sur disque du dossier, en Go. `/Game/X` -> <Content>/X."""
    dossier = os.path.join(RACINE_DISQUE, chemin_jeu[len("/Game/"):])
    total = 0
    for base, _, fichiers in os.walk(dossier):
        for f in fichiers:
            try:
                total += os.path.getsize(os.path.join(base, f))
            except OSError:
                pass
    return total / (1024.0 ** 3)


def exclu(paquet):
    return any(x in paquet for x in EXCLURE)


if not PACKS:
    journal("ARRET : NARVOS_PACKS est vide")
    journal("   ex. NARVOS_PACKS=Defender/Demo/Animations,SmartLocomotion")
    raise SystemExit(0)

# ── ⚠ JAMAIS A TRAVERS UNE JONCTION ───────────────────────────────────────────
# Ce script DEPLACE (`rename_assets`). Depuis le 2026-09-12, certains packs
# d'origine ne sont plus COPIES dans l'ADK mais relies par une JONCTION vers
# `WebPortal/public/asset_game/` — ou ils sont la SEULE copie connue de ce que
# Hanibes a achete (`Content/Hyper` le premier).
#
# Deplacer un asset a travers une jonction le SUPPRIME de sa source. Le pack
# d'origine perdrait ses fichiers, sans corbeille, et `asset_game` ne serait plus
# qu'une coquille.
#
# Pour ces packs, la voie est `scripts/adk-copier-hyper.mjs` : liens durs sous
# `Narvos/`, un PackageRedirects de prefixe, et l'original n'est jamais ecrit.
#
# ⚠ `realpath` SUR LA RACINE D'ABORD (2026-10-04). Depuis la recuperation, l'ADK
# est lui-meme atteint par une jonction (`WebPortal/Server/adk` -> lot DMDE) :
# compare depuis le chemin tel que lance, TOUT dossier « passait par une
# jonction » et la garde arretait chaque promotion. Ce qu'elle doit refuser est
# une jonction SOUS `Content/` — la racine resolue, il ne reste qu'elles.
# `normcase` : `realpath` rend la casse du disque, `NARVOS_PACKS` celle du shell.
_CONTENT = os.path.realpath(
    os.path.join(os.path.dirname(unreal.Paths.get_project_file_path()), "Content"))
for _p in PACKS:
    _rel = _p[len("/Game/"):] if _p.startswith("/Game/") else _p
    _morceaux = [m for m in _rel.split("/") if m]
    _chemin = _CONTENT
    for _m in _morceaux:
        _chemin = os.path.join(_chemin, _m)
        if os.path.isdir(_chemin) and (os.path.normcase(os.path.realpath(_chemin))
                                       != os.path.normcase(os.path.abspath(_chemin))):
            journal("ARRET : %s passe par une JONCTION (%s -> %s)." % (
                _p, _chemin, os.path.realpath(_chemin)))
            journal("   Deplacer ici SUPPRIMERAIT les fichiers du pack d'origine.")
            journal("   Utiliser scripts/adk-copier-hyper.mjs (liens durs + redirect).")
            raise SystemExit(1)

journal("mode : %s" % ("APPLIQUER" if APPLIQUER else "passe a blanc"))
journal("plafond : %.1f Go par dossier%s" % (PLAFOND_GO, " (FORCE)" if FORCER else ""))
if EXCLURE:
    journal("exclus : %s" % ", ".join(EXCLURE))
journal("")

registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)

# ── Releve ────────────────────────────────────────────────────────────────────

a_faire = []          # (paquet_source, chemin_cible_dossier, nom)
for source in PACKS:
    if not unreal.EditorAssetLibrary.does_directory_exist(source):
        journal("ABSENT      %s  (pack non stage ?)" % source)
        continue

    donnees = registre.get_assets_by_path(source, recursive=True)
    retenus, ecartes, deja = [], 0, 0
    for d in donnees:
        paquet = str(d.package_name)
        if exclu(paquet):
            ecartes += 1
            continue
        cible = RACINE + paquet[len("/Game"):]
        if unreal.EditorAssetLibrary.does_asset_exist(cible):
            deja += 1
            continue
        retenus.append((paquet, cible.rsplit("/", 1)[0], cible.rsplit("/", 1)[-1]))

    go = poids_go(source)
    trop = go > PLAFOND_GO and not FORCER
    journal("%-8s %-52s %5d a deplacer  %4d exclus  %4d deja  %6.2f Go"
            % ("REFUSE" if trop else "PREND", source, len(retenus), ecartes, deja, go))
    if trop:
        journal("         > au-dela du plafond : decouper en sous-dossiers,")
        journal("           ou NARVOS_FORCER=1 si le cook doit vraiment le porter")
        continue
    a_faire.extend(retenus)

if not a_faire:
    journal("")
    journal("rien a promouvoir")
    raise SystemExit(0)

journal("")
journal("total : %d asset(s)" % len(a_faire))

if not APPLIQUER:
    journal("passe a blanc : rien n'a ete ecrit. NARVOS_APPLIQUER=1 pour ecrire.")
    raise SystemExit(0)

# ── Le deplacement ────────────────────────────────────────────────────────────
#
# ⚠ NE PAS repasser a `AssetTools.rename_assets([AssetRenameData…])`. Essaye le
# 2026-09-06 : le commandlet MEURT sur
#   Assertion failed: !"Enclosing block should never be called"
#   PackagePath.cpp:751
# — un `FAssetRenameData` construit positionnellement depuis Python ne remplit
# pas le champ attendu, et le moteur part dans une branche non implementee.
# Le processus tombe AVANT le moindre deplacement : 1 912 assets annonces,
# zero ecrit.
#
# `EditorAssetLibrary.rename_asset(source, cible)` est la voie eprouvee sur ce
# projet (166 materiaux ranges le 2026-09-05). Un asset par appel : c'est plus
# lent, mais un asset illisible echoue SEUL au lieu d'emporter le lot.

outils = unreal.AssetToolsHelpers.get_asset_tools()

journal("")
journal("=== deplacement")
faits, rates = 0, 0
for i, (paquet, dossier, nom) in enumerate(a_faire, 1):
    try:
        if unreal.EditorAssetLibrary.rename_asset(paquet, dossier + "/" + nom):
            faits += 1
        else:
            rates += 1
            if rates <= 20:
                journal("  ECHEC  %s" % paquet)
    except Exception as e:
        rates += 1
        if rates <= 20:
            journal("  ERREUR %s : %s" % (paquet, e))
    if i % 200 == 0:
        journal("  %d / %d  (%d ok, %d rates)" % (i, len(a_faire), faits, rates))

journal("  %d / %d  (%d ok, %d rates)" % (len(a_faire), len(a_faire), faits, rates))
charges = faits

# ── Recomptage — le seul controle qui prouve quelque chose ───────────────────

journal("")
journal("=== recomptage")
registre.search_all_assets(True)
arrives, restes = 0, 0
for paquet, dossier, nom in a_faire:
    if unreal.EditorAssetLibrary.does_asset_exist(dossier + "/" + nom):
        arrives += 1
    else:
        restes += 1

journal("%d arrive(s) sous %s" % (arrives, RACINE))
journal("%d rate(s)" % restes)
if arrives == 0:
    journal("⚠ ZERO deplacement reel malgre %d chargement(s)." % charges)
    journal("   Ne pas conclure au succes sur l'absence d'erreur.")
    raise SystemExit(1)

# ── Resorber les redirecteurs ────────────────────────────────────────────────
#
# Un deplacement laisse un redirecteur a l'ancienne place. Cuits, ils
# alourdissent le pack et font resoudre les references par un saut inutile.

journal("")
journal("=== redirecteurs")
redirecteurs = []
for source in PACKS:
    for d in registre.get_assets_by_path(source, recursive=True):
        if str(d.asset_class_path.asset_name) == "ObjectRedirector":
            a = d.get_asset()
            if a is not None:
                redirecteurs.append(a)
journal("%d redirecteur(s)" % len(redirecteurs))
if redirecteurs:
    # ⚠ NON FATAL. `AssetTools.fixup_referencers` n’existe plus en UE 5.7 :
    #   AttributeError: ’AssetTools’ object has no attribute ’fixup_referencers’
    # Mesure le 2026-09-07 — le script mourait ICI, APRES un deplacement reussi,
    # en laissant croire a un echec global.
    #
    # Un redirecteur reste hors de `Narvos/` : il n’est donc PAS cuit, et il est
    # inoffensif. Ce qui compte est qu’aucun asset PROMU ne pointe encore dessus
    # — c’est ce que verifie `adk-verifier-refs-promues.py`.
    try:
        outils.fixup_referencers(redirecteurs)
        journal("resorbes")
    except AttributeError:
        journal("fixup_referencers absent en 5.7 — %d redirecteur(s) laisse(s)" % len(redirecteurs))
        journal("   controle : scripts/adk-verifier-refs-promues.py")

# ── Sauvegarde ───────────────────────────────────────────────────────────────
#
# ⚠ `save_asset` a `only_if_is_dirty=True` PAR DEFAUT. Le deplacement salit les
# paquets, donc `True` suffit ici et evite de reecrire les 32 000 assets deja
# propres de `/Game/Narvos` (13 Go a chaque passage).

journal("")
journal("=== sauvegarde")
# ⚠ ON SAUVEGARDE AUSSI LES DOSSIERS SOURCE, ET C'EST LA CORRECTION LA PLUS
# COUTEUSE DE CE SCRIPT.
#
# `rename_asset` laisse un REDIRECTEUR a l'ancienne place. Ce redirecteur est ce
# qui garde vivantes les references des assets qui n'etaient pas CHARGES pendant
# le deplacement — et ils ne le sont jamais tous : un niveau non ouvert, un
# materiau qu'aucun acteur ne porte.
#
# Cette boucle ne sauvegardait que la DESTINATION. Les redirecteurs restaient en
# memoire, non ecrits. Tant que l'editeur vivait, tout resolvait ; a sa
# fermeture, ils disparaissaient et 2 382 assets promus se retrouvaient a
# pointer dans le vide — mesure le 2026-09-09, apres l'extinction automatique de
# la nuit. Symptome : une foret entierement BLANCHE avec le damier par defaut,
# et le log qui dit « a dependent package /Game/OpenWorlds/... was not
# available ».
#
# Le piege etait parfait : le defaut n'apparait qu'au redemarrage SUIVANT, donc
# jamais dans la session qui l'a cause.
#
# Les redirecteurs restent hors de `Narvos/` : ils ne sont donc PAS cuits et ne
# pesent rien dans le pack. Les ecrire ne coute qu'un peu de disque.
dossiers = sorted({RACINE + s[len("/Game"):] for s in PACKS})
sources = sorted(set(PACKS))
for d in dossiers + sources:
    if unreal.EditorAssetLibrary.does_directory_exist(d):
        unreal.EditorAssetLibrary.save_directory(d, only_if_is_dirty=True, recursive=True)
        journal("  %s" % d)

journal("")
journal("⚠ Confirmer dans un processus NEUF : adk-dump-assets.py,")
journal("   puis nanos-build-asset-pack.mjs --apply (sans le drapeau, il SIMULE).")