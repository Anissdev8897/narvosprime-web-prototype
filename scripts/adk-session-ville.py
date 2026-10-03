# -*- coding: utf-8 -*-
"""
adk-session-ville.py — la séance éditeur qui rend leurs textures à la ville
(CITY_PACK) et aux mondes OpenWorlds / Megastructure. Trois méthodes DÉJÀ
PROUVÉES, enchaînées dans l'ordre, chacune dans son propre espace de noms.

  python scripts/ue-remote.py --statement "exec(open(r'E:/narvosprime-web-prototype/scripts/adk-session-ville.py', encoding='utf-8').read()); seance(appliquer=False)"

── CE QUI EST CASSÉ (audit des dépendances du 2026-09-11) ─────────────────────
CITY_PACK : 815 textures MORTES (leur chemin d'avant la promotion n'existe plus,
dont 778 ont un jumeau promu) + 583 cibles dans le dossier STAGÉ jamais cuit.
OpenWorlds : 307 mortes (274 à jumeau) + 231 stagées. Megastructure : 4 + 41.
Cuites, ces références sont vides : matériaux gris, sans la moindre erreur.

── LES ÉTAPES, PAR PACK ──────────────────────────────────────────────────────
  1. mortes AVEC jumeau  -> adk-reparer-squelettes-promus.py `reparer` (duplicata
     du jumeau à l'ancien chemin, puis consolidation : la méthode Defender) ;
  2. stagées AVEC jumeau -> adk-rapatrier-pack.py `rapatrier_pack` (la méthode
     MetaCustom, 371/371) ;
  3. mortes SANS jumeau  -> `substituer` : la remplaçante proposée par
     scripts/narvos-substituer-textures.mjs (même canal, mots partagés), posée au
     chemin mort puis consolidée — une texture qui fait l'affaire, choisie et
     NOMMÉE dans le journal, jamais inventée ;
  4. `finaliser` (adk-recharger-et-resauver.py) : les référents non chargés
     passent par un redirecteur ; les recharger et les resauver fait suivre le
     disque. La PREUVE se lit ensuite sur disque, dans un autre processus.

Sauvegarde préalable : adk/_sauvegardes/2026-09-11_city/ (15 Go, 6 447 fichiers).
Journal : adk/_session-ville.log (+ les journaux propres de chaque méthode).
"""
import json
import sys
import unreal

RACINE = "E:/narvosprime-web-prototype"
SCRIPTS = RACINE + "/scripts/"
ADK = RACINE + "/WebPortal/Server/adk"
PACKS = ("CITY_PACK", "OpenWorlds", "Megastructure_Scifi_World")
CLASSES_FINALES = ("Material", "MaterialInstanceConstant", "MaterialFunction",
                   "StaticMesh", "SkeletalMesh", "PhysicsAsset")

EAL = unreal.EditorAssetLibrary
REG = unreal.AssetRegistryHelpers.get_asset_registry()
OPTS = unreal.AssetRegistryDependencyOptions(
    include_soft_package_references=True, include_hard_package_references=True,
    include_searchable_names=False, include_soft_management_references=False,
    include_hard_management_references=False)


def dire(texte):
    sys.stdout.write(str(texte) + "\n")
    with open(ADK + "/_session-ville.log", "a", encoding="utf-8") as f:
        f.write(str(texte) + "\n")


def _module(nom):
    """Chaque méthode dans SON espace : leurs `dire` n'ont pas la même signature."""
    espace = {"__name__": nom}
    with open(SCRIPTS + nom, encoding="utf-8") as f:
        exec(compile(f.read(), nom, "exec"), espace)
    return espace


def substituer(pack, appliquer=False):
    chemin = "%s/_substitutions-%s.json" % (ADK, pack)
    try:
        with open(chemin, encoding="utf-8") as f:
            entrees = json.load(f)
    except FileNotFoundError:
        dire("[S] %s : pas de %s — lancer narvos-substituer-textures.mjs" % (pack, chemin))
        return
    faits, sans, echecs = [], 0, []
    for e in entrees:
        mort, remplacante = e["cible"], e.get("remplacante")
        if not remplacante:
            sans += 1
            continue
        if not EAL.does_asset_exist(remplacante):
            echecs.append((mort, "remplacante absente"))
            continue
        if not appliquer:
            continue
        try:
            if not EAL.does_asset_exist(mort) and EAL.duplicate_asset(remplacante, mort) is None:
                echecs.append((mort, "duplication"))
                continue
            # Les référents du chemin mort d'abord : consolidate ne patche que
            # ce qui est CHARGÉ.
            for r in REG.get_referencers(mort, OPTS) or []:
                try:
                    unreal.load_asset(str(r))
                except Exception:
                    pass
            cible, source = unreal.load_asset(remplacante), unreal.load_asset(mort)
            if cible is not None and source is not None and EAL.consolidate_assets(cible, [source]):
                faits.append("%s -> %s" % (mort.rsplit("/", 1)[1], remplacante.rsplit("/", 1)[1]))
            else:
                echecs.append((mort, "consolidation"))
        except Exception as ex:
            echecs.append((mort, str(ex)[:60]))
    if appliquer:
        unreal.EditorLoadingAndSavingUtils.save_dirty_packages(False, True)
    dire("[S] %s : %d substitution(s), %d sans candidat (laissees mortes), %d echec(s) %s"
         % (pack, len(faits), sans, len(echecs), echecs[:4]))
    for ligne in faits:
        dire("    " + ligne)


def seance(appliquer=False, packs=PACKS):
    rep = _module("adk-reparer-squelettes-promus.py")
    rap = _module("adk-rapatrier-pack.py")
    fin = _module("adk-recharger-et-resauver.py")
    dire("=== seance ville : appliquer=%s, packs=%s" % (appliquer, list(packs)))
    for pack in packs:
        racine = "/Game/Narvos/" + pack
        dire("--- %s" % pack)
        rep["reparer"](racine, appliquer=appliquer)
        rap["rapatrier_pack"](pack, appliquer=appliquer, lot=5000)
        substituer(pack, appliquer=appliquer)
        if appliquer:
            fin["finaliser"](racine, classes=CLASSES_FINALES)
    dire("=== seance terminee")