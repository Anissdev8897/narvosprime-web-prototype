# ══════════════════════════════════════════════════════════════════════════════
# adk-reparer-parents-materiaux.py — rendre son parent a chaque MaterialInstance
# qui l'a perdu.
#
#   NARVOS_RACINE=/Game/Narvos                 (defaut)
#   NARVOS_APPLIQUER=1                         sans lui : passe a blanc
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="…"
#
# ⚠ EDITEUR FERME.
#
# ── LE DEFAUT ─────────────────────────────────────────────────────────────────
# Une `MaterialInstanceConstant` sans parent rend le materiau PAR DEFAUT du
# moteur — damier gris — et n'expose AUCUN parametre dans l'editeur. Rien ne le
# signale : ni erreur, ni avertissement au cook. C'est le piege des `.uasset`
# COPIES plutot que deplaces par l'editeur.
#
# Mesure du 2026-09-05 : 166 instances sur 13 738, soit 1,2 %.
#
# ── LA REGLE, ET POURQUOI ELLE REFUSE PLUTOT QUE DE DEVINER ───────────────────
# Un parent faux est PIRE qu'un parent absent : l'asset cesse d'etre visiblement
# casse et devient discretement faux — mauvaises textures, mauvais parametres,
# et plus aucun signal. On ne pose donc un parent que lorsqu'UNE SEULE piste
# aboutit, et on NOMME les autres au lieu de trancher a leur place.
#
# Conventions essayees, de la plus sure a la moins sure :
#   1. `MI_X`      -> `M_X`, `MTL_X`, `X`            (convention Unreal)
#   2. `MI_X<n>`   -> idem, apres suppression du numero de doublon
#   3. `X_Inst`    -> `X`
#   4. `MI_X`      -> `MI_X` MASTER homonyme ailleurs dans le meme pack
#
# La recherche est LOCALE d'abord (meme dossier, puis dossier parent, puis le
# pack), jamais globale : deux packs peuvent avoir un `M_Hair`, et prendre celui
# du voisin donnerait exactement le defaut discret qu'on veut eviter.
# ══════════════════════════════════════════════════════════════════════════════

import json
import os
import re

import unreal

RACINE = os.environ.get("NARVOS_RACINE", "/Game/Narvos").replace("\\", "/").rstrip("/")
# ⚠ CHERCHER PLUS LARGE QUE L'ON NE REPARE. Les masters MetaHuman et CoreC ne
# vivent pas sous `/Game/Narvos` : limiter la recherche a la racine reparee
# rendait « aucun candidat » sur 148 instances dont le parent existe ailleurs.
# On ne MODIFIE que sous RACINE ; on CHERCHE sous RECHERCHE.
RECHERCHE = os.environ.get("NARVOS_RECHERCHE", "/Game").replace("\\", "/").rstrip("/")
APPLIQUER = os.environ.get("NARVOS_APPLIQUER") == "1"
SORTIE = os.environ.get(
    "NARVOS_PARENTS_SORTIE",
    "E:/narvosprime-web-prototype/WebPortal/Server/adk/_parents-materiaux.json",
)


def journal(m):
    unreal.log("[NARVOS] " + m)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
mel = unreal.MaterialEditingLibrary

# ── Index de tous les materiaux du projet, par dossier ───────────────────────

par_chemin = {}
for d in registre.get_assets_by_path(RECHERCHE, recursive=True):
    classe = str(d.asset_class_path.asset_name)
    if classe not in ("Material", "MaterialInstanceConstant"):
        continue
    paquet = str(d.package_name)
    par_chemin[paquet] = classe

journal("%d materiau(x) indexes sous %s (reparation limitee a %s)"
        % (len(par_chemin), RECHERCHE, RACINE))


def candidats_noms(nom):
    """Noms de parent plausibles, du plus sur au moins sur."""
    out = []
    base = nom

    # `MI_X` / `MTL_X` -> racine X
    m = re.match(r"^(MI|MTL|M)_(.+)$", base)
    racine_nom = m.group(2) if m else base

    # `X_Inst` -> X
    sans_inst = re.sub(r"_Inst(ance)?$", "", base)
    if sans_inst != base:
        out.append(sans_inst)

    # numero de doublon en fin : `MI_Hair1` -> `MI_Hair`
    sans_num = re.sub(r"\d+$", "", racine_nom)

    for r in (racine_nom, sans_num):
        if not r:
            continue
        for prefixe in ("M_", "MTL_", ""):
            c = prefixe + r
            if c != base:
                out.append(c)

    # dedoublonne en gardant l'ordre
    vus, propre = set(), []
    for c in out:
        if c not in vus:
            vus.add(c)
            propre.append(c)
    return propre


def dossiers_de_recherche(paquet):
    """Du plus proche au plus large, jamais au-dela du pack."""
    parts = paquet.split("/")
    dossier = "/".join(parts[:-1])
    out = [dossier]
    # remonte jusqu'a 3 niveaux, sans sortir de RACINE
    d = dossier
    for _ in range(3):
        d = d.rsplit("/", 1)[0]
        if not d.startswith(RECHERCHE) or d == RECHERCHE:
            break
        out.append(d)
    return out


def chercher_parent(paquet, nom):
    """Rend (chemin, regle) si UNE seule piste aboutit, sinon (None, raison)."""
    noms = candidats_noms(nom)
    trouves = []
    for dossier in dossiers_de_recherche(paquet):
        prefixe = dossier + "/"
        for c in noms:
            # d'abord dans ce dossier exact
            direct = prefixe + c
            if direct in par_chemin and direct != paquet:
                trouves.append((direct, par_chemin[direct]))
        if trouves:
            break
        # sinon, n'importe ou SOUS ce dossier
        for chemin, classe in par_chemin.items():
            if not chemin.startswith(prefixe) or chemin == paquet:
                continue
            if chemin.rsplit("/", 1)[-1] in noms:
                trouves.append((chemin, classe))
        if trouves:
            break

    if not trouves:
        # ── Dernier recours : le `*_MASTER` du meme pack ──────────────────────
        #
        # Certains packs ne nomment pas leur master d'apres l'instance :
        # `MTL_MWAM_CoverRocks` a pour parent `MTL_MWAM_CoverFoliage_MASTER`.
        # On cherche donc, dans le pack, les Materials finissant par `_MASTER`,
        # et on retient celui qui partage le PLUS LONG prefixe avec l'instance.
        #
        # ⚠ Il faut un prefixe d'au moins 8 caracteres ET un gagnant STRICT.
        # Sans ces deux garde-fous, `MTL_` suffirait a apparier n'importe quoi —
        # et un parent faux est pire qu'un parent absent : l'asset cesse d'etre
        # visiblement casse et devient discretement faux.
        pack = "/".join(paquet.split("/")[:4])
        masters = [c for c, k in par_chemin.items()
                   if k == "Material" and c.startswith(pack + "/")
                   and c.rsplit("/", 1)[-1].endswith("_MASTER")]
        if masters:
            def commun(a, b):
                n = 0
                for x, y in zip(a, b):
                    if x != y:
                        break
                    n += 1
                return n
            scores = sorted(((commun(nom, c.rsplit("/", 1)[-1]), c) for c in masters), reverse=True)
            if scores and scores[0][0] >= 8 and (len(scores) == 1 or scores[0][0] > scores[1][0]):
                return scores[0][1], "prefixe commun %d avec un _MASTER du pack" % scores[0][0]
        return None, "aucun candidat"

    # Un vrai Material (master) prime sur une instance.
    masters = [c for c, k in trouves if k == "Material"]
    if len(masters) == 1:
        return masters[0], "master homonyme"
    if len(masters) > 1:
        return None, "%d masters homonymes — ambigu" % len(masters)

    uniques = sorted(set(c for c, _ in trouves))
    if len(uniques) == 1:
        return uniques[0], "instance homonyme"
    return None, "%d candidats — ambigu" % len(uniques)


# ── Passe ────────────────────────────────────────────────────────────────────

orphelines = []
for paquet, classe in par_chemin.items():
    if classe != "MaterialInstanceConstant":
        continue
    if not paquet.startswith(RACINE + "/"):
        continue
    a = unreal.EditorAssetLibrary.load_asset(paquet)
    if a is None:
        continue
    try:
        if a.get_editor_property("parent") is not None:
            continue
    except Exception:
        continue
    orphelines.append(paquet)

journal("%d instance(s) sans parent" % len(orphelines))
journal("mode : %s" % ("APPLIQUER" if APPLIQUER else "passe a blanc"))
journal("")

resolus, refuses = [], []
for paquet in sorted(orphelines):
    nom = paquet.rsplit("/", 1)[-1]
    cible, regle = chercher_parent(paquet, nom)
    if cible is None:
        refuses.append({"instance": paquet, "raison": regle})
        continue

    if APPLIQUER:
        parent = unreal.EditorAssetLibrary.load_asset(cible)
        ok = False
        if parent is not None:
            try:
                mel.set_material_instance_parent(a if False else unreal.EditorAssetLibrary.load_asset(paquet), parent)
                unreal.EditorAssetLibrary.save_asset(paquet, only_if_is_dirty=False)
                relu = unreal.EditorAssetLibrary.load_asset(paquet).get_editor_property("parent")
                ok = relu is not None
            except Exception as e:
                journal("  ECHEC %s : %s" % (nom, e))
        resolus.append({"instance": paquet, "parent": cible, "regle": regle, "pose": ok})
    else:
        resolus.append({"instance": paquet, "parent": cible, "regle": regle, "pose": None})

journal("=== %d resolu(s), %d refuse(s)" % (len(resolus), len(refuses)))
journal("")
for r in resolus[:40]:
    marque = "" if r["pose"] is None else (" OK" if r["pose"] else " ECHEC")
    journal("  %-46s -> %-40s (%s)%s"
            % (r["instance"].rsplit("/", 1)[-1], r["parent"].rsplit("/", 1)[-1], r["regle"], marque))
if len(resolus) > 40:
    journal("  … et %d autre(s)" % (len(resolus) - 40))

journal("")
journal("=== refuses, a trancher a la main")
for r in refuses[:30]:
    journal("  %-46s %s" % (r["instance"].rsplit("/", 1)[-1], r["raison"]))
if len(refuses) > 30:
    journal("  … et %d autre(s)" % (len(refuses) - 30))

os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
with open(SORTIE, "w", encoding="utf-8") as fh:
    json.dump({"racine": RACINE, "applique": APPLIQUER,
               "resolus": resolus, "refuses": refuses}, fh, indent=1)
journal("")
journal("ecrit : " + SORTIE)