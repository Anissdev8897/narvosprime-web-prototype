# ══════════════════════════════════════════════════════════════════════════════
# adk-remplir-slots-citypack.py — combler les slots que CITY_PACK livre VIDES.
#
#   exec(open(r"...\adk-remplir-slots-citypack.py", encoding="utf-8").read())
#
#   NARVOS_SLOTS_APPLIQUER=1 pour ecrire ; sans, il MESURE et soumet ses choix.
#
# ── CE QUI DISTINGUE CE SCRIPT DE `adk-reparer-refs.py` ──────────────────────
# `adk-reparer-refs.py` RESTAURE : la reference existait, elle pointait dans le
# vide, et la cible se retrouvait au chemin miroir. Aucun choix.
#
# Ici il n'y a rien a restaurer. Mesure du 2026-09-09 sur la recolte des 18 maps
# de CITY_PACK : **32 des 36 slots vides l'etaient DEJA dans le pack d'origine**.
# Verifie acteur par acteur — 38 des 41 `SM_CHAIR_L` de la source n'avaient
# AUCUNE surcharge sur leur slot `light`. Le pack les livre ainsi.
#
# Combler demande donc de CHOISIR. Ce script ne devine pas : il derive du pack
# lui-meme, par ordre de preference decroissante, et il ECRIT SES RAISONS.
#
# ── L'ORDRE DE PREFERENCE ────────────────────────────────────────────────────
#   1. un materiau du MEME DOSSIER dont le nom partage un jeton avec le slot
#      (`glass` -> `M_ELEVATOR_GLASS` de ce dossier)  — le plus local gagne
#   2. la CONVENTION du pack : ce que les autres meshes mettent sur un slot de
#      ce nom, si un seul materiau domine
#   3. un materiau du meme dossier dont le nom porte le meme CANAL
#      (`light` -> un emissif du dossier)
#   4. rien. On rapporte.
#
# ⚠ ON N'ECRIT JAMAIS SUR UNE EGALITE. Le slot `light` est le cas type : le pack
# y met `M_LIGHT` 13 fois, `M_Light_red_1` 13 fois et `MI_Light_Bloom_blue2`
# 11 fois. Trancher au hasard teinterait deux cents lampes en rouge ou en bleu
# sans que personne l'ait demande. Une egalite se rapporte, elle ne se resout
# pas.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io
import os
import json
from collections import Counter, defaultdict

RAPPORT = "E:/narvosprime-web-prototype/.hermes/slots_citypack.txt"
SORTIE = "E:/narvosprime-web-prototype/.hermes/slots_citypack.json"
APPLIQUER = os.environ.get("NARVOS_SLOTS_APPLIQUER") == "1"

# Repli neutre sur les slots qu aucune regle ne tranche. Explicite, jamais par
# defaut : c est un CHOIX visuel, pas une reparation.
REPLI = os.environ.get("NARVOS_SLOTS_REPLI") == "1"

RACINE = "/Game/Narvos/CITY_PACK"

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))


def jetons(s):
    bas = "".join(c if c.isalnum() else " " for c in s.lower())
    return set(j for j in bas.split() if len(j) >= 3 and not j.isdigit())


CANAUX = [
    ("light", ("light", "lamp", "emissive", "glow", "neon", "bloom")),
    ("glass", ("glass", "window", "vitre")),
    ("screen", ("screen", "monitor", "display", "gif", "video", "billboard")),
    ("metal", ("metal", "chrome", "steel")),
    ("floor", ("floor", "ground", "sol")),
    ("wall", ("wall", "mur", "concrete")),
]


def canal(nom):
    bas = nom.lower()
    for c, mots in CANAUX:
        for m in mots:
            if m in bas:
                return c
    return None


registre = unreal.AssetRegistryHelpers.get_asset_registry()

# ── 1. Index des materiaux, par dossier ─────────────────────────────────────
par_dossier = defaultdict(list)
tous = {}
for d in registre.get_assets_by_path(RACINE, recursive=True):
    if str(d.asset_class_path.asset_name) not in ("Material", "MaterialInstanceConstant"):
        continue
    p = str(d.package_name)
    nom = str(d.asset_name)
    tous[p] = nom
    # Le « dossier de pack » : les trois premiers niveaux sous CITY_PACK.
    # `INTERIORS/LIBRARY` plutot que `INTERIORS/LIBRARY/MATERIALS`, pour que les
    # materiaux d'un meme interieur se voient entre eux.
    parts = p[len(RACINE) + 1:].split("/")
    cle = "/".join(parts[:2])
    par_dossier[cle].append((p, nom))

dire("=== SLOTS VIDES DE CITY_PACK ===" + ("" if APPLIQUER else "   (MESURE — NARVOS_SLOTS_APPLIQUER=1 pour ecrire)"))
dire("")
dire("%d materiau(x) indexes dans %d dossier(s)" % (len(tous), len(par_dossier)))

# ── 2. La convention du pack, par nom de slot ───────────────────────────────
convention = defaultdict(Counter)
meshes = []
for d in registre.get_assets_by_path(RACINE, recursive=True):
    if str(d.asset_class_path.asset_name) != "StaticMesh":
        continue
    p = str(d.package_name)
    o = unreal.load_asset(p)
    if o is None:
        continue
    try:
        slots = o.get_editor_property("static_materials")
    except Exception:
        continue
    vides = []
    for i, s in enumerate(slots):
        nom_slot = str(s.material_slot_name)
        if s.material_interface is None:
            vides.append((i, nom_slot))
        else:
            convention[nom_slot][s.material_interface.get_name()] += 1
    if vides:
        parts = p[len(RACINE) + 1:].split("/")
        meshes.append({"asset": p, "dossier": "/".join(parts[:2]), "vides": vides,
                       "obj": o, "slots": slots})

dire("  %d mesh(es) avec au moins un slot vide" % len(meshes))

# ── 3. Le choix, avec sa raison ─────────────────────────────────────────────
decisions = []
stats = Counter()

for m in meshes:
    for i, nom_slot in m["vides"]:
        js = jetons(nom_slot)
        choix = None
        raison = None

        # 1. meme dossier, jeton partage, unique
        locaux = par_dossier.get(m["dossier"], [])
        cands = [(p, n) for p, n in locaux if js & jetons(n)]
        if len(cands) == 1:
            choix, raison = cands[0][0], "jeton partage, meme dossier"

        # 2. convention du pack — DEUX CONDITIONS, apprises en relisant mes
        #    propres choix le 2026-09-09 :
        #
        #    · au moins TROIS exemples. Avec un seul, ce n'est pas une
        #      convention : `SM_LANDFLY_BODY` recevait `MI_Bloom_Light_Red` sur
        #      la foi d'UNE occurrence.
        #
        #    · le materiau doit exister dans le MEME DOSSIER. Sans cette
        #      condition, `SM_BioReactorLP` (laboratoire) recevait
        #      `MI_BILLBOARD_GIF` — une texture de panneau publicitaire anime —
        #      parce que six meshes de BIG_CITY mettent ca sur un slot nomme
        #      `Material`. Un nom de slot generique (`Material`, `02 - Default`,
        #      `WorldGridMaterial`) ne dit RIEN de l'intention : la convention
        #      d'un autre dossier n'y apprend rien.
        if choix is None and convention.get(nom_slot):
            c = convention[nom_slot].most_common()
            if c[0][1] >= 3 and (len(c) == 1 or c[0][1] > c[1][1]):
                nom_mat = c[0][0]
                trouve = [p for p, n in locaux if n == nom_mat]
                if trouve:
                    choix = trouve[0]
                    raison = "convention du pack (%s x%d), meme dossier" % (nom_mat, c[0][1])
                else:
                    stats["convention hors du dossier, refusee (%s)" % nom_mat[:22]] += 1
            elif c[0][1] < 3:
                stats["convention a %d exemple(s) seulement, refusee" % c[0][1]] += 1
            else:
                stats["egalite dans la convention, non tranche"] += 1

        # 3. meme dossier, meme canal, unique
        if choix is None:
            ca = canal(nom_slot)
            if ca:
                cands = [(p, n) for p, n in locaux if canal(n) == ca]
                if len(cands) == 1:
                    choix, raison = cands[0][0], "canal %s, meme dossier" % ca
                elif len(cands) > 1:
                    stats["canal %s : %d candidats, non tranche" % (ca, len(cands))] += 1

        # 4. REPLI NEUTRE, seulement si on le demande explicitement.
        #
        # ⚠ CE N'EST PAS UNE RESTAURATION, C'EST UN CHOIX. Ces slots sont vides
        # dans le pack D'ORIGINE : l'auteur ne les a jamais remplis, et ils
        # rendent gris dans ses propres maps de demonstration. Il n'existe donc
        # aucune valeur « juste » a retrouver.
        #
        # Ce que ce repli apporte : une surface NEUTRE au lieu du damier par
        # defaut du moteur. Le blanc se lit comme « simple », le damier comme
        # « casse ». Sur un slot de lampe on prend `M_LIGHT` — le seul des trois
        # candidats a egalite (`M_LIGHT` x13, `M_Light_red_1` x13,
        # `MI_Light_Bloom_blue2` x11) qui n'impose PAS de couleur.
        #
        # Entierement reversible : la liste exacte est dans le JSON.
        if choix is None and REPLI:
            ca = canal(nom_slot)
            vise = "M_LIGHT" if ca == "light" else "M_WHITE"
            trouve = [p for p, n in locaux if n == vise] or \
                     [p for p in tous if tous[p] == vise]
            if trouve:
                choix = trouve[0]
                raison = "REPLI NEUTRE (%s) — choix, pas restauration" % vise

        decisions.append({"asset": m["asset"], "index": i, "slot": nom_slot,
                          "choix": choix, "raison": raison})
        stats["RETENU : " + raison if raison else "non tranche"] += 1

dire("")
dire("=== BILAN DES CHOIX ===")
for k, v in stats.most_common(16):
    dire("  %-56s %5d" % (k[:56], v))

retenus = [d for d in decisions if d["choix"]]
dire("")
dire("  %d slot(s) sur %d recoivent un materiau" % (len(retenus), len(decisions)))

dire("")
dire("=== CHAQUE CHOIX, EN DETAIL ===")
for d in retenus[:40]:
    dire("  %-26s slot %-22s -> %-26s  (%s)" % (
        d["asset"].split("/")[-1][:26], d["slot"][:22],
        d["choix"].split("/")[-1][:26], d["raison"]))
if len(retenus) > 40:
    dire("  … %d de plus dans le JSON" % (len(retenus) - 40))

non = [d for d in decisions if not d["choix"]]
if non:
    dire("")
    dire("=== NON TRANCHES (laisses vides) ===")
    c = Counter(d["slot"] for d in non)
    for k, v in c.most_common(16):
        dire("  %-30s %5d slot(s)" % (k[:30], v))

json.dump([{k: v for k, v in d.items()} for d in decisions],
          io.open(SORTIE, "w", encoding="utf-8"), indent=1)

if not APPLIQUER:
    dire("")
    dire("Rien ecrit. Relire les choix ci-dessus avant d'appliquer.")
    io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
    unreal.log("[NARVOS] ecrit : " + RAPPORT)
    raise SystemExit

# ── 4. Pose ─────────────────────────────────────────────────────────────────
#
# ⚠ ON RECONSTRUIT LES STRUCTS. `get_editor_property("static_materials")` les
# rend PAR VALEUR : muter `slots[i].material_interface` n'ecrit rien, et ne leve
# rien. Piege paye le 2026-09-09 sur 466 slots annonces et zero ecrit.
dire("")
dire("=== POSE ===")
par_asset = defaultdict(dict)
for d in retenus:
    mat = unreal.load_asset(d["choix"])
    if mat is not None:
        par_asset[d["asset"]][d["index"]] = mat

poses, refuses = 0, 0
for chemin, affect in par_asset.items():
    o = unreal.load_asset(chemin)
    if o is None:
        continue
    lus = o.get_editor_property("static_materials")
    neufs = []
    for i, s in enumerate(lus):
        n = unreal.StaticMaterial()
        n.set_editor_property("material_interface", affect.get(i, s.material_interface))
        n.set_editor_property("material_slot_name", s.material_slot_name)
        try:
            n.set_editor_property("imported_material_slot_name", s.imported_material_slot_name)
        except Exception:
            pass
        neufs.append(n)
    o.set_editor_property("static_materials", neufs)
    # Relecture : seule preuve.
    relu = o.get_editor_property("static_materials")
    ok = sum(1 for i in affect if relu[i].material_interface is not None)
    if ok:
        unreal.EditorAssetLibrary.save_asset(chemin, only_if_is_dirty=True)
        poses += ok
    refuses += len(affect) - ok

dire("  %d slot(s) pose(s), %d refuse(s)" % (poses, refuses))

# ── 5. Recomptage ───────────────────────────────────────────────────────────
restants = 0
for d in registre.get_assets_by_path(RACINE, recursive=True):
    if str(d.asset_class_path.asset_name) != "StaticMesh":
        continue
    o = unreal.load_asset(str(d.package_name))
    if o is None:
        continue
    try:
        restants += sum(1 for s in o.get_editor_property("static_materials")
                        if s.material_interface is None)
    except Exception:
        pass

dire("")
dire("=== RECOMPTAGE ===")
dire("  %d slot(s) encore vide(s) dans CITY_PACK" % restants)

io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
unreal.log("[NARVOS] ecrit : " + RAPPORT)