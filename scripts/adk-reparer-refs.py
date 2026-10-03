# ══════════════════════════════════════════════════════════════════════════════
# adk-reparer-refs.py — rebrancher les 2 382 assets promus qui pointent dans le
# vide.
#
#   exec(open(r"...\adk-reparer-refs.py", encoding="utf-8").read())
#
#   NARVOS_REFS_APPLIQUER=1 pour ecrire ; sans, il MESURE.
#   NARVOS_REFS_LIMITE=200  pour n'en traiter que 200 (rodage).
#
# ── LE DEFAUT ─────────────────────────────────────────────────────────────────
# `adk-promouvoir-packs.py` ne sauvegardait que le dossier DESTINATION. Les
# redirecteurs, crees a la SOURCE par `rename_asset`, n'ont jamais ete ecrits :
# ils ont disparu a l'extinction du 2026-09-09. Mesure : 2 382 assets promus
# avec au moins une dependance morte, 3 400 cibles distinctes, dont **3 328
# (98 %) existent au chemin miroir** sous `/Game/Narvos`.
#
# ── DEUX VOIES ESSAYEES ET ECARTEES, POUR NE PAS Y REVENIR ───────────────────
#   · `fixup_referencers` : n'existe plus en 5.7 (AttributeError).
#   · `consolidate_assets` : exige l'asset MORT en objet. Il n'existe plus.
#   · l'aller-retour de `rename_asset` (miroir -> ancien chemin -> miroir) :
#     ESSAYE le 2026-09-09 sur `MI_Deadtree1`. Ses trois textures sont restees
#     `NULL`. `rename_asset` repare les referents qu'il peut CHARGER ; une
#     reference vers un paquet absent est deja nulle en memoire, il n'y a plus
#     rien a recoller. Voie morte, mesuree.
#
# Il reste donc la reecriture explicite, propriete par propriete.
#
# ── LE PROBLEME D'APPARIEMENT, ET COMMENT IL SE LEVE ─────────────────────────
# Quand la texture a disparu, le parametre du materiau rend `None` : on connait
# le NOM du parametre et la liste des cibles mortes, pas la correspondance.
# Mesure sur 400 instances : 27 % ont un seul parametre nul pour une seule cible
# (certain), mais 55 % en ont trois pour trois — ambigu. Un remplissage dans
# l'ordre serait faux la majorite du temps.
#
# Le nom porte le CANAL, des deux cotes :
#     BaseColor                    <-  T_DeadTree1_2_BC
#     Grunge_rough_Metal(GrunRoM)  <-  T_DeadTree1_2_GrunRom
#     NORMAL_BASE_TEXTURE          <-  T_DeadTree1_2_N
#
# On apparie donc par canal, et **on n'ecrit que quand un canal donne
# exactement UNE cible pour UN parametre**. Tout le reste est rapporte, pas
# devine : une normale posee dans le slot de couleur de base ne leve aucune
# erreur et rend un modele violet.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io
import os
import json
from collections import Counter, defaultdict

RAPPORT = "E:/narvosprime-web-prototype/.hermes/refs_reparees.txt"
RESTE = "E:/narvosprime-web-prototype/.hermes/refs_restantes.json"
LISTE_MAP = "E:/narvosprime-web-prototype/.hermes/refs_map.json"
APPLIQUER = os.environ.get("NARVOS_REFS_APPLIQUER") == "1"
LIMITE = int(os.environ.get("NARVOS_REFS_LIMITE") or "0")

# ⚠ PAR DEFAUT ON NE TRAITE QUE CE QUE LA MAP UTILISE.
#
# 2 376 assets promus portent une dependance morte, mais seulement **691** sont
# dans la fermeture des acteurs de `Map_Narvos` (mesure du 2026-09-09,
# `adk-refs-cassees-map.py`). Les 1 685 autres appartiennent a des packs de
# demonstration ou a des variantes qu'aucun acteur ne porte : les reparer
# d'abord, c'est passer des heures sur ce qui ne se voit pas.
#
# NARVOS_REFS_TOUT=1 pour traiter les 2 376.
MAP_SEULEMENT = os.environ.get("NARVOS_REFS_TOUT") != "1"

ANCIENNES = ("/Game/OpenWorlds", "/Game/CITY_PACK", "/Game/SpaceScenes",
             "/Game/Defender", "/Game/SmartLocomotion")

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))

def ecrire():
    io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
    unreal.log("[NARVOS] ecrit : " + RAPPORT)


# ── Le vocabulaire des canaux, cote TEXTURE ──────────────────────────────────
#
# ⚠ LE CANAL EST LE DERNIER JETON DU NOM, PAS UNE SOUS-CHAINE N'IMPORTE OU.
#
# Ma premiere version cherchait des sous-chaines, avec des jetons d'une lettre
# (`_r` pour rough, `_m` pour metallic). Resultat mesure le 2026-09-09 :
#
#     T_BioReactorLP_Material_Normal
#                          ^^ "_m" matche « _Material_ » AU MILIEU du nom
#
# La texture partait dans `orm`, le canal `normal` se retrouvait a ZERO cible et
# l'`orm` en avait deux. Comme tout CITY_PACK nomme ses textures
# `T_<objet>_DefaultMaterial_<canal>` ou `T_<objet>_Material_<canal>`, le defaut
# touchait des centaines d'assets : 146 « normal ambigu (1 noeud / 0 cible) »
# et 87 « orm ambigu (2 param / 2 cible) » venaient de la.
#
# On decoupe donc le nom en jetons et on lit le DERNIER. Les abreviations d'une
# ou deux lettres ne sont acceptees qu'a cette place — c'est la seule ou elles
# veulent dire quelque chose.
SUFFIXES = {
    "bc": "base", "basecolor": "base", "d": "base", "diffuse": "base",
    "albedo": "base", "col": "base", "color": "base", "colour": "base",
    "base": "base",
    "n": "normal", "normal": "normal", "nrm": "normal", "norm": "normal",
    "orm": "orm", "grunrom": "orm", "grunrommap": "orm",
    "occlusionroughnessmetallic": "orm", "mrao": "orm", "rma": "orm",
    "r": "orm", "m": "orm", "ao": "orm", "rough": "orm", "roughness": "orm",
    "metallic": "orm", "metal": "orm", "specular": "orm", "spec": "orm",
    "e": "emissive", "em": "emissive", "emissive": "emissive",
    "emission": "emissive", "glow": "emissive",
    "a": "opacity", "alpha": "opacity", "mask": "opacity", "masks": "opacity",
    "opacity": "opacity", "op": "opacity",
    "h": "height", "height": "height", "disp": "height", "displacement": "height",
}

# Repli par sous-chaine : uniquement des mots LONGS, sans ambiguite possible.
# Sert aux noms qui ne finissent pas par un suffixe reconnu.
CANAUX_TEXTURE = [
    ("orm",      ("grunrom", "occlusionroughnessmetallic", "roughness", "metallic",
                  "specular")),
    ("normal",   ("normal",)),
    ("emissive", ("emissive", "emission")),
    ("opacity",  ("opacity", "alpha")),
    ("height",   ("height", "displac")),
    ("base",     ("basecolor", "base_color", "albedo", "diffuse")),
]


def canal_texture(nom):
    """Le canal d'une texture, lu sur son DERNIER jeton d'abord."""
    bas = "".join(c if c.isalnum() else " " for c in nom.lower())
    jetons = [j for j in bas.split() if j]
    # On remonte depuis la fin : certains noms finissent par un numero de
    # variante (`T_Sand_3_BASECOLOR_33`), le canal est juste avant.
    for j in reversed(jetons[-3:] if len(jetons) >= 3 else jetons):
        if j.isdigit():
            continue
        if j in SUFFIXES:
            return SUFFIXES[j]
    return canal(nom, CANAUX_TEXTURE)

# ⚠ L'ORDRE FAIT LE TRAVAIL, et il est fragile a l'envers.
#
# `normal` est teste AVANT `base` : sans ca, le parametre `NORMAL_BASE_TEXTURE`
# de `M_Lights` tomberait dans `base` a cause du mot « base », et on lui
# poserait une couleur de base au lieu d'une normale — un modele violet, sans
# aucune erreur.
#
# ⚠ « base » SEUL a ete ajoute le 2026-09-09, apres mesure. Les instances de
# CITY_PACK nomment leurs parametres `AO | BASE | EMISSIVE | NORMAL` — quatre
# mots nus. Ma premiere table ne connaissait que `basecolor`, `albedo`,
# `diffuse`, `color` : `BASE` ne s'appariait a rien, et 32 instances restaient
# grises en annoncant « 1 param / 0 cible ». Le vocabulaire se MESURE sur les
# noms reels, il ne se devine pas.
CANAUX_PARAM = [
    ("orm",      ("grunrom", "orm", "rough", "metal", "occlusion", "ao", "mrao",
                  "rma", "specular")),
    ("normal",   ("normal", "nrm")),
    ("emissive", ("emissi", "emission", "glow")),
    ("opacity",  ("opacit", "alpha", "mask", "transparen")),
    ("height",   ("height", "displac", "bump")),
    ("base",     ("basecolor", "base_color", "base color", "albedo", "diffuse",
                  "color", "colour", "tint", "_bc", "base")),
]


def canal(nom, table):
    """Le canal d'un nom, ou None si aucun jeton ne s'y trouve.

    ⚠ ON RETIRE TOUTES LES ESPACES, PAS SEULEMENT CELLES DES BORDS.
    #
    Les noms releves dans CITY_PACK portent des espaces n'importe ou :
        "Mask "                  espace de fin
        "Em issive"              espace AU MILIEU — 8 instances
        "Base Color"             espace separateur
        "METALLIC COLOR TEXTURE" trois mots
    Un `strip()` ne rattrape que le premier cas. `"em issive"` ne contient pas
    `"emissi"`, donc 8 instances restaient sans canal ; en collant les mots,
    `"emissive"` matche. Meme effet pour `"Base Color"` -> `"basecolor"`.
    """
    bas = "".join(nom.lower().split())
    for c, jetons in table:
        for j in jetons:
            if j in bas:
                return c
    return None


registre = unreal.AssetRegistryHelpers.get_asset_registry()
options = unreal.AssetRegistryDependencyOptions(include_hard_package_references=True)

connu = {}
def existe(p):
    if p not in connu:
        connu[p] = unreal.EditorAssetLibrary.does_asset_exist(p)
    return connu[p]


def miroir_de(p):
    """Le chemin de la cible sous /Game/Narvos, si elle y est."""
    m = "/Game/Narvos" + p[len("/Game"):]
    return m if existe(m) else None


def poser_slots(obj, prop, affectations):
    """Pose des materiaux sur les slots d'un mesh. `affectations` : {index: materiau}.

    ⚠ ON RECONSTRUIT LES STRUCTS. On ne mute pas ceux qu'on a lus.

    `get_editor_property("static_materials")` rend les `StaticMaterial` PAR
    VALEUR. Muter `slots[i].material_interface` puis reposer la liste n'ecrit
    RIEN — la mutation porte sur une copie. Mesure du 2026-09-09 sur
    `SM_GrassGroup2B` :

        AVANT                      [('Grassgroup2', 'VIDE')]
        mutation + set_property    ['VIDE']                 <- aucun effet
        reconstruction + set       ['MI_GrassGroup2ABC']    <- ecrit

    C'est ce piege qui a rendu SILENCIEUSEMENT inoperantes toutes mes
    reparations de slots : les compteurs annoncaient des centaines de
    rebranchements, et le recomptage des slots vides ne bougeait pas d'un.
    Aucune exception, aucun avertissement — le cas d'ecriture muette que ce
    depot connait bien.
    """
    lus = obj.get_editor_property(prop)
    neufs = []
    for i, s in enumerate(lus):
        n = unreal.StaticMaterial()
        cible = affectations.get(i, s.material_interface)
        n.set_editor_property("material_interface", cible)
        n.set_editor_property("material_slot_name", s.material_slot_name)
        try:
            n.set_editor_property("imported_material_slot_name", s.imported_material_slot_name)
        except Exception:
            pass
        neufs.append(n)
    obj.set_editor_property(prop, neufs)

    # Relecture : seule preuve. Rend le nombre de slots reellement remplis.
    relu = obj.get_editor_property(prop)
    return sum(1 for i in affectations if relu[i].material_interface is not None)


dire("=== REECRITURE DES REFERENCES ===" + ("" if APPLIQUER else "   (MESURE — NARVOS_REFS_APPLIQUER=1 pour ecrire)"))
if LIMITE:
    dire("  LIMITE : %d asset(s) seulement" % LIMITE)

# ── Releve ───────────────────────────────────────────────────────────────────
travail = []      # (chemin, classe, [dependances mortes])

if MAP_SEULEMENT and os.path.exists(LISTE_MAP):
    # La liste produite par `adk-refs-cassees-map.py` : deja croisee avec les
    # acteurs. On la RELIT plutot que de refaire la fermeture, mais on
    # revalidera chaque dependance contre le disque — le fichier peut datter.
    for e in json.load(io.open(LISTE_MAP, encoding="utf-8")):
        morts = [m for m in e["morts"] if not existe(m)]
        if morts:
            travail.append((e["asset"], e["classe"], morts))
    dire("")
    dire("perimetre : LA MAP (%s)" % LISTE_MAP.split("/")[-1])
    dire("  %d asset(s) utilises par la map avec une dependance morte" % len(travail))
else:
    assets = list(registre.get_assets_by_path("/Game/Narvos", recursive=True))
    dire("")
    dire("perimetre : TOUT /Game/Narvos")
    dire("  %d asset(s) a controler" % len(assets))
    for d in assets:
        paquet = str(d.package_name)
        morts = []
        for dep in (registre.get_dependencies(paquet, options) or []):
            s = str(dep)
            if not any(s.startswith(a + "/") for a in ANCIENNES):
                continue
            if not existe(s):
                morts.append(s)
        if morts:
            travail.append((paquet, str(d.asset_class_path.asset_name), morts))
    dire("  %d avec une dependance morte" % len(travail))
if LIMITE:
    travail = travail[:LIMITE]

stats = Counter()
restants = []
sauves = set()


def sauver(paquet):
    if paquet in sauves:
        return
    try:
        unreal.EditorAssetLibrary.save_asset(paquet, only_if_is_dirty=True)
        sauves.add(paquet)
    except Exception as e:
        stats["sauvegarde impossible"] += 1


# ── Reparation, par classe ───────────────────────────────────────────────────
for paquet, classe, morts in travail:
    obj = unreal.load_asset(paquet)
    if obj is None:
        stats["asset illisible"] += 1
        restants.append({"asset": paquet, "classe": classe, "morts": morts,
                         "raison": "illisible"})
        continue

    reste = list(morts)

    # ── Le parent d'une instance : une seule propriete, aucune ambiguite ────
    if classe == "MaterialInstanceConstant":
        try:
            if obj.get_editor_property("parent") is None:
                cands = [m for m in morts if not existe(m)]
                # Le parent est un Material, pas une Texture : on le reconnait a
                # ce qu'aucun canal ne s'y lit et que son miroir est un materiau.
                pris = None
                for m in cands:
                    mi = miroir_de(m)
                    if mi is None:
                        continue
                    p = unreal.load_asset(mi)
                    if p is not None and "Material" in p.get_class().get_name():
                        pris = (m, p)
                        break
                if pris is not None:
                    if APPLIQUER:
                        obj.set_editor_property("parent", pris[1])
                        sauver(paquet)
                    stats["parent d'instance rebranche"] += 1
                    if pris[0] in reste:
                        reste.remove(pris[0])
        except Exception as e:
            stats["parent : echec"] += 1

        # ── Les textures, par canal ─────────────────────────────────────────
        try:
            params = obj.get_editor_property("texture_parameter_values")
            nuls = [p for p in params if p.parameter_value is None]
            # On ne retient comme cibles que celles qui SONT des textures.
            cibles = []
            for m in reste:
                mi = miroir_de(m)
                if mi is None:
                    continue
                t = unreal.load_asset(mi)
                if t is not None and "Texture" in t.get_class().get_name():
                    cibles.append((m, mi, t))

            # ⚠ UN SEUL DE CHAQUE : LE CANAL NE SERT PLUS A RIEN.
            #
            # `MI_BIG_BILLBOARD_1` a un unique parametre nul, `Diffuse`, et une
            # unique cible, `T_VERY_BIG_BILLBOARD_DefaultMaterial_EMISSIVE`.
            # Les canaux ne concordent pas (base contre emissive) et mon
            # appariement refusait — alors qu'avec une seule candidate et un
            # seul trou, il n'y a rien a choisir. L'auteur a nomme son parametre
            # `Diffuse` et y a branche une emissive : c'est son affaire, pas la
            # notre.
            if len(nuls) == 1 and len(cibles) == 1:
                nom = str(nuls[0].parameter_info.name)
                m, mi, t = cibles[0]
                if APPLIQUER:
                    unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(
                        obj, nom, t)
                    sauver(paquet)
                stats["texture rebranchee (1 pour 1, canal ignore)"] += 1
                if m in reste:
                    reste.remove(m)
                cibles = []
                nuls = []

            par_canal_param = defaultdict(list)
            for p in nuls:
                par_canal_param[canal(str(p.parameter_info.name), CANAUX_PARAM)].append(p)
            par_canal_cible = defaultdict(list)
            for m, mi, t in cibles:
                par_canal_cible[canal_texture(m.split("/")[-1])].append((m, mi, t))

            for c in list(par_canal_param.keys()):
                if c is None:
                    continue
                ps = par_canal_param[c]
                cs = par_canal_cible.get(c, [])
                # ⚠ UNE SEULE CIBLE SUFFIT, MEME POUR PLUSIEURS PARAMETRES.
                #
                # Le cas `2 param / 1 cible` s'est presente 127 fois : les
                # parametres `AO` et `Roughness` d'une meme instance, pour une
                # seule texture `..._OcclusionRoughnessMetallic`. Ce n'est PAS
                # une ambiguite — une texture packee est faite pour alimenter
                # ses trois canaux, et avec une seule candidate il n'y a aucun
                # risque de la mettre au mauvais endroit.
                #
                # Ce qui reste interdit, c'est PLUSIEURS cibles pour plusieurs
                # parametres : la, rien ne dit laquelle va ou.
                if len(cs) == 1 and len(ps) >= 1:
                    m, mi, t = cs[0]
                    for p in ps:
                        nom = str(p.parameter_info.name)
                        if APPLIQUER:
                            unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(
                                obj, nom, t)
                    if APPLIQUER:
                        sauver(paquet)
                    stats["texture rebranchee (canal %s)" % c] += len(ps)
                    if m in reste:
                        reste.remove(m)
                else:
                    stats["canal %s ambigu (%d param / %d cible)" % (c, len(ps), len(cs))] += 1
        except Exception as e:
            stats["textures : echec %s" % str(e)[:30]] += 1

    # ── Les slots d'un mesh ────────────────────────────────────────────────
    elif classe in ("StaticMesh", "SkeletalMesh"):
        prop = "static_materials" if classe == "StaticMesh" else "materials"
        try:
            slots = obj.get_editor_property(prop)
            vides = [i for i, s in enumerate(slots) if s.material_interface is None]
            cibles = []
            for m in reste:
                mi = miroir_de(m)
                if mi is None:
                    continue
                a = unreal.load_asset(mi)
                if a is not None and "Material" in a.get_class().get_name():
                    cibles.append((m, a))
            # Un seul slot vide et une seule cible : certain.
            if len(vides) == 1 and len(cibles) == 1:
                if APPLIQUER:
                    n = poser_slots(obj, prop, {vides[0]: cibles[0][1]})
                    if n:
                        sauver(paquet)
                        stats["slot de mesh rebranche"] += n
                    else:
                        stats["slot de mesh : ECRITURE REFUSEE"] += 1
                else:
                    stats["slot de mesh rebranche"] += 1
                reste.remove(cibles[0][0])

            # ⚠ SINON ON APPARIE PAR LE NOM DU SLOT, qui est de la donnee.
            #
            # Un slot d'import porte le nom que l'auteur a donne au materiau dans
            # son logiciel : `WHITE` -> `M_White_3`, `W_CASE` -> `M_WALL_STAND`,
            # `ELEVATOR_2` -> `M_ELEVATOR_...`. Releve le 2026-09-09 sur les
            # slots de CITY_PACK. Ce n'est pas systematique, donc on ne s'y fie
            # que quand la correspondance est UNIQUE dans les deux sens.
            #
            # On compare des JETONS, pas les chaines entieres : un slot `WHITE`
            # et un materiau `M_White_3` ne sont egaux ni en casse ni en forme.
            elif vides and cibles:
                def jetons(s):
                    bas = "".join(c if c.isalnum() else " " for c in s.lower())
                    return set(j for j in bas.split() if len(j) >= 3 and not j.isdigit())

                # ⚠ UN JETON INCLUS COMPTE COMME UN JETON EGAL.
                #
                # `SM_GrassGroup2B` a le slot `Grassgroup2` et la cible
                # `MI_GrassGroup2ABC` : « grassgroup2 » est un PREFIXE de
                # « grassgroup2abc », pas le meme jeton. L'egalite stricte
                # laissait ce cas — et tous les `*_LOD`, `*_Inst`, `*ABC` du
                # meme genre — sans appariement.
                #
                # Longueur minimale de 5 : en dessous, l'inclusion attrape
                # n'importe quoi (`tree` dans `street`).
                def relie(ja, jb):
                    if ja & jb:
                        return True
                    for a in ja:
                        for b in jb:
                            if len(a) >= 5 and len(b) >= 5 and (a in b or b in a):
                                return True
                    return False

                # ⚠ ON GROUPE LES SLOTS PAR NOM.
                #
                # `SM_Tree6C` porte DEUX slots nommes `Tree6Leaves_BC`. Ma
                # verification de reciprocite les voyait comme deux pretendants
                # a la meme cible et refusait tout — alors que deux slots de
                # meme nom veulent evidemment le MEME materiau. On decide par
                # NOM, puis on pose sur tous les slots qui le portent.
                par_nom = defaultdict(list)
                for iv in vides:
                    par_nom[str(slots[iv].material_slot_name)].append(iv)

                poses_ici = 0
                pris_slots = set()
                pris_noms = set()
                pris_cibles = set()
                a_poser = {}

                # ⚠ DEUX PASSES : L'EXACT D'ABORD, LA SOUS-CHAINE ENSUITE.
                #
                # En une seule passe tolerante, ma propre tolerance creait
                # l'ambiguite. Mesure sur `SM_Tree3E` :
                #     slots   Tree3E_Billboard | Tree3Leaves_BC | Bark
                #     cibles  MI_Tree3 | MI_Tree3_Bark | MI_Tree3E_Lod2
                # `Bark` ne devrait matcher que `MI_Tree3_Bark`. Mais
                # « tree3 » est inclus dans « tree3leaves », donc
                # `MI_Tree3_Bark` semblait aussi convenir a `Tree3Leaves_BC` :
                # deux pretendants, refus. Tous les arbres de la foret
                # tombaient la — c'est ce qui la laissait blanche.
                #
                # En passant l'exact d'abord, `Bark` et `Tree3E_Billboard` se
                # placent sans hesitation ; `Tree3Leaves_BC` prend ce qui reste
                # par inclusion, et il ne reste plus qu'un candidat.
                for strict in (True, False):
                    for nom_slot, indices in par_nom.items():
                        if nom_slot in pris_noms:
                            continue
                        js = jetons(nom_slot)
                        if not js:
                            continue
                        test = (lambda a, b: bool(a & b)) if strict else relie
                        match = [k for k, (m, a) in enumerate(cibles)
                                 if k not in pris_cibles and test(js, jetons(a.get_name()))]
                        if len(match) != 1:
                            continue
                        k = match[0]
                        # Reciproque : ce nom de slot est-il le seul pretendant ?
                        jc = jetons(cibles[k][1].get_name())
                        inverse = [n for n in par_nom
                                   if n not in pris_noms and test(jetons(n), jc)]
                        if len(inverse) != 1:
                            continue
                        for iv in indices:
                            a_poser[iv] = cibles[k][1]
                            pris_slots.add(iv)
                            poses_ici += 1
                        pris_noms.add(nom_slot)
                        pris_cibles.add(k)
                        if cibles[k][0] in reste:
                            reste.remove(cibles[k][0])
                if poses_ici:
                    if APPLIQUER:
                        n = poser_slots(obj, prop, a_poser)
                        if n:
                            sauver(paquet)
                            stats["slot de mesh rebranche (nom du slot)"] += n
                        if n < poses_ici:
                            stats["slot de mesh : ECRITURE REFUSEE"] += poses_ici - n
                    else:
                        stats["slot de mesh rebranche (nom du slot)"] += poses_ici
                if len(pris_slots) < len(vides):
                    stats["mesh ambigu (%d slot / %d cible)" % (len(vides) - len(pris_slots), len(cibles) - len(pris_cibles))] += 1
            elif vides:
                stats["mesh : %d slot vide, aucune cible materiau" % len(vides)] += 1
        except Exception as e:
            stats["mesh : echec %s" % str(e)[:30]] += 1

    # ── Le squelette d'une animation : NON REPARABLE, et c'est mesure ──────
    #
    # Premiere version : on tentait `set_editor_property("skeleton", s)`. Les
    # 434 tentatives ont ECHOUE. Sonde du 2026-09-09 sur `Anim_Attack` : la
    # propriete se LIT (`skeleton -> None`) mais ne se pose pas, et la classe
    # n'expose que `get_skeleton` — aucun setter. Unreal l'interdit parce que
    # changer le squelette d'une animation demande un retargeting, pas une
    # affectation.
    #
    # ⚠ ET CE N'EST PAS UN PROBLEME DE COOK. Mesure : 1 978 animations sans
    # squelette sous `/Game/Narvos`, et les 34 exclusions de `DefaultGame.ini`
    # en couvrent **1 978 sur 1 978** — dont 1 418 dans `NARVOS_Retarget`. Aucune
    # ne part au cook, donc aucune ne peut le tuer
    # (cf. reference_cook_animations_orphelines).
    #
    # On le RAPPORTE au lieu de le tenter : un compteur « rebranche » en
    # simulation qui devient « echec » a l'application est un rapport qui ment.
    elif classe in ("AnimSequence", "AnimMontage", "BlendSpace", "AimOffsetBlendSpace1D"):
        stats["animation : squelette non reparable (aucun setter, cook exclu)"] += 1

    # ── Le graphe d'un Material ────────────────────────────────────────────
    #
    # `expression_collection` et `expressions` ne sont PAS accessibles sur
    # `Material` en 5.7 (sonde du 2026-09-09 : « Failed to find property »), et
    # `MaterialEditingLibrary` n'offre aucune enumeration — seulement
    # `get_num_material_expressions`, qui compte.
    #
    # La voie qui marche : partir de chaque propriete du materiau
    # (`get_material_property_input_node`) et descendre par
    # `get_inputs_for_material_expression`. Verifie sur `M_Lights` : 11 noeuds
    # atteints, dont l'unique `TextureSampleParameter2D` a `texture = NULL`.
    # Apres ecriture + `recompile_material` + sauvegarde, la RELECTURE rend
    # `get_used_textures = ['T_Lights_EM']`.
    elif classe == "Material":
        try:
            lib = unreal.MaterialEditingLibrary
            vus_n = set()
            noeuds = []

            def marcher(n, prof=0):
                # Borne de profondeur : un graphe de materiau peut boucler par
                # une fonction, et une recursion sans borne tue l'editeur.
                if n is None or prof > 12:
                    return
                k = n.get_path_name()
                if k in vus_n:
                    return
                vus_n.add(k)
                noeuds.append(n)
                try:
                    for e in (lib.get_inputs_for_material_expression(obj, n) or []):
                        marcher(e, prof + 1)
                except Exception:
                    pass

            for nom_prop in dir(unreal.MaterialProperty):
                if not nom_prop.startswith("MP_"):
                    continue
                try:
                    marcher(lib.get_material_property_input_node(
                        obj, getattr(unreal.MaterialProperty, nom_prop)))
                except Exception:
                    pass

            # Les noeuds de texture vides, et leur canal quand ils sont nommes.
            vides = []
            for n in noeuds:
                if "Texture" not in n.get_class().get_name():
                    continue
                try:
                    if n.get_editor_property("texture") is not None:
                        continue
                except Exception:
                    continue
                # Le nom du parametre quand le noeud en a un.
                etiquette = ""
                try:
                    etiquette = str(n.get_editor_property("parameter_name") or "")
                except Exception:
                    pass
                c = canal(etiquette, CANAUX_PARAM) if etiquette else None

                # ⚠ REPLI SUR LE `sampler_type`, et c'est ce qui debloque la
                # majorite des Material.
                #
                # Mesure du 2026-09-09 : dans `M_AIRCAB_GROUND`, les SIX noeuds
                # de texture sont `(sans nom)` — ce sont des `TextureSample`
                # nus, pas des parametres. Aucun canal ne se lit dans leur nom,
                # donc 177 Material restaient « N noeuds / N cibles, non
                # apparie ».
                #
                # Mais Unreal leur impose un type d'echantillonneur, et ce type
                # EST le canal :
                #     SAMPLERTYPE_NORMAL        -> normale
                #     SAMPLERTYPE_MASKS         -> donnee packee (ORM)
                #     SAMPLERTYPE_LINEAR_COLOR  -> donnee lineaire (releve sur
                #                                  le noeud `AO` de M_AlgeaFluid)
                #     SAMPLERTYPE_COLOR         -> couleur de base
                if c is None:
                    try:
                        st = str(n.get_editor_property("sampler_type"))
                        if "NORMAL" in st:
                            c = "normal"
                        elif "MASKS" in st or "LINEAR_COLOR" in st:
                            c = "orm"
                        elif "COLOR" in st:
                            c = "base"
                    except Exception:
                        pass
                vides.append((n, c))

            cibles = []
            for m in reste:
                mi = miroir_de(m)
                if mi is None:
                    continue
                t = unreal.load_asset(mi)
                if t is not None and "Texture" in t.get_class().get_name():
                    cibles.append((m, t, canal_texture(m.split("/")[-1])))

            touche = False
            if len(vides) == 1 and len(cibles) == 1:
                # Un seul de chaque : aucune ambiguite, le canal ne sert a rien.
                if APPLIQUER:
                    vides[0][0].set_editor_property("texture", cibles[0][1])
                    touche = True
                stats["texture de Material rebranchee (1 pour 1)"] += 1
                reste.remove(cibles[0][0])
            elif vides and cibles:
                # Sinon on apparie par canal, et SEULEMENT sur du 1 pour 1.
                for c in set(x[1] for x in vides if x[1]):
                    ns = [x for x in vides if x[1] == c]
                    cs = [x for x in cibles if x[2] == c]
                    # Meme regle que pour les instances : une seule cible dans
                    # le canal suffit, quel que soit le nombre de noeuds. Un
                    # graphe echantillonne souvent la MEME texture deux fois
                    # (deux UV, deux echelles) — 79 cas mesures en
                    # « 2 noeuds / 1 cible ».
                    if len(cs) == 1 and len(ns) >= 1:
                        for n_vide, _ in ns:
                            if APPLIQUER:
                                n_vide.set_editor_property("texture", cs[0][1])
                                touche = True
                        stats["texture de Material rebranchee (canal %s)" % c] += len(ns)
                        if cs[0][0] in reste:
                            reste.remove(cs[0][0])
                    else:
                        stats["Material canal %s ambigu (%d noeud / %d cible)" % (c, len(ns), len(cs))] += 1
                # ⚠ DERNIER RECOURS SUR : une seule cible pour des noeuds dont
                # le canal est illisible.
                #
                # 187 Material tombaient ici. Leurs noeuds n'ont ni nom de
                # parametre ni `sampler_type` lisible (`(sans type)` releve
                # dans `M_AIRCAB_GROUND`) : aucun canal ne se lit, donc aucun
                # appariement. Mais s'il ne reste qu'UNE texture candidate, il
                # n'y a rien a choisir — la poser partout ne peut pas se
                # tromper. Avec deux candidates ou plus, on s'arrete.
                if not touche and len(cibles) == 1:
                    for n_vide, _ in vides:
                        if APPLIQUER:
                            n_vide.set_editor_property("texture", cibles[0][1])
                            touche = True
                    stats["texture de Material rebranchee (cible unique)"] += len(vides)
                    if cibles[0][0] in reste:
                        reste.remove(cibles[0][0])
                elif not touche:
                    stats["Material : %d noeud vide / %d cible, non apparie" % (len(vides), len(cibles))] += 1
            elif cibles and not vides:
                # Les cibles mortes ne passent pas par un noeud atteignable :
                # fonction de materiau, ou branche qu'aucune propriete n'alimente.
                stats["Material : cible morte hors du graphe atteignable"] += 1

            if touche:
                lib.recompile_material(obj)
                sauver(paquet)
        except Exception as e:
            stats["Material : echec %s" % str(e)[:30]] += 1

    else:
        stats["classe non traitee : %s" % classe] += 1

    if reste:
        restants.append({"asset": paquet, "classe": classe, "morts": reste})

# ── Bilan ────────────────────────────────────────────────────────────────────
dire("")
dire("=== CE QUI A ETE FAIT ===" if APPLIQUER else "=== CE QUI SERAIT FAIT ===")
for k, v in stats.most_common(24):
    dire("  %-52s %6d" % (k[:52], v))

dire("")
dire("  %d asset(s) sauve(s)" % len(sauves))
dire("  %d asset(s) gardent une dependance morte" % len(restants))

json.dump(restants, io.open(RESTE, "w", encoding="utf-8"), indent=1)
dire("  reste ecrit : %s" % RESTE)

if not APPLIQUER:
    dire("")
    dire("Rien ecrit.")
    ecrire()
    raise SystemExit

# ── Recomptage — seule preuve ────────────────────────────────────────────────
#
# ⚠ On RELIT le disque. `save_asset` a `only_if_is_dirty=True` et une ecriture
# ratee ne dit rien : seul un recomptage prouve quelque chose.
connu.clear()
encore = 0
for paquet, classe, morts in travail:
    for m in morts:
        if not existe(m):
            # la dependance est-elle encore declaree ?
            deps = [str(x) for x in (registre.get_dependencies(paquet, options) or [])]
            if m in deps:
                encore += 1
            break

dire("")
dire("=== RECOMPTAGE ===")
dire("  %d / %d asset(s) declarent encore une dependance morte" % (encore, len(travail)))

ecrire()