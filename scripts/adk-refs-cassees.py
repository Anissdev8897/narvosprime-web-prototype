# ══════════════════════════════════════════════════════════════════════════════
# adk-refs-cassees.py — quels assets promus pointent dans le vide ?
#
#   exec(open(r"...\adk-refs-cassees.py", encoding="utf-8").read())
#
# ⚠ AUCUNE ECRITURE. Il compte et il classe.
#
# ── LE DEFAUT, ET POURQUOI IL EST APPARU AU REDEMARRAGE ──────────────────────
# `adk-promouvoir-packs.py` deplace les assets avec `rename_asset`, qui laisse
# un REDIRECTEUR a l'ancienne place. Sa derniere etape sauvegarde ensuite :
#
#     for d in dossiers:                       # dossiers = RACINE + ...
#         EditorAssetLibrary.save_directory(d, only_if_is_dirty=True, recursive=True)
#
# Elle ne sauvegarde que la DESTINATION. Les redirecteurs, eux, sont a la SOURCE
# (`/Game/OpenWorlds/...`) : crees en memoire, jamais ecrits sur disque. Tant que
# l'editeur restait ouvert, tout resolvait. A l'extinction de la nuit du
# 2026-09-09, ils ont disparu.
#
# Mesure : `/Game/OpenWorlds/Textures` ne contient plus qu'UN asset, contre 389
# sous `/Game/Narvos/OpenWorlds/Textures`. Et `T_Moss_N` a l'ancien chemin :
# `does_asset_exist` = False. Les 611 redirecteurs comptes par le verificateur
# sont ailleurs (Meshes, autres dossiers) — pas sur les chemins que la foret lit.
#
# ── POURQUOI LE VERIFICATEUR A DIT « 0 » ─────────────────────────────────────
# `adk-verifier-refs-promues.py` interroge le REGISTRE. Le registre ne connait
# que les assets qui EXISTENT : une dependance vers un paquet disparu n'y figure
# plus, donc elle ne se compte pas. Il a repondu juste a sa question, et sa
# question n'etait pas la bonne. Ici on part des DEPENDANCES DECLAREES par
# chaque asset promu, et on teste chacune contre le disque.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io
import json
from collections import Counter

RAPPORT = "E:/narvosprime-web-prototype/.hermes/refs_cassees.txt"
SORTIE = "E:/narvosprime-web-prototype/.hermes/refs_cassees.json"

# Les racines dont les assets ont ete promus sous /Game/Narvos.
ANCIENNES = ("/Game/OpenWorlds", "/Game/CITY_PACK", "/Game/SpaceScenes",
             "/Game/Defender", "/Game/SmartLocomotion")

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))


registre = unreal.AssetRegistryHelpers.get_asset_registry()
options = unreal.AssetRegistryDependencyOptions(include_hard_package_references=True)

dire("=== REFERENCES CASSEES ===")
dire("")

# Cache d'existence : le meme paquet est cite des dizaines de fois.
connu = {}
def existe(p):
    if p not in connu:
        connu[p] = unreal.EditorAssetLibrary.does_asset_exist(p)
    return connu[p]


assets = list(registre.get_assets_by_path("/Game/Narvos", recursive=True))
dire("%d asset(s) sous /Game/Narvos a controler" % len(assets))

par_classe = Counter()
par_racine = Counter()
casses = {}       # asset promu -> [dependances mortes]
cibles_mortes = Counter()

for d in assets:
    paquet = str(d.package_name)
    deps = registre.get_dependencies(paquet, options) or []
    morts = []
    for dep in deps:
        s = str(dep)
        if not s.startswith("/Game/"):
            continue
        # On ne s'interesse qu'aux anciennes racines : une dependance vers
        # /Game/Narvos qui manquerait serait un autre probleme.
        if not any(s.startswith(a + "/") for a in ANCIENNES):
            continue
        if not existe(s):
            morts.append(s)
            cibles_mortes[s] += 1
            par_racine["/".join(s.split("/")[:3])] += 1
    if morts:
        casses[paquet] = morts
        par_classe[str(d.asset_class_path.asset_name)] += 1

dire("")
dire("=== BILAN ===")
dire("  %d asset(s) promu(s) avec au moins une dependance MORTE" % len(casses))
dire("  %d cible(s) morte(s) distincte(s)" % len(cibles_mortes))

dire("")
dire("=== PAR CLASSE D'ASSET CASSE ===")
for k, v in par_classe.most_common(12):
    dire("  %-34s %6d" % (k, v))

dire("")
dire("=== PAR ANCIENNE RACINE ===")
for k, v in par_racine.most_common(8):
    dire("  %-34s %6d reference(s)" % (k, v))

# ── La cible existe-t-elle au chemin MIROIR sous Narvos ? ────────────────────
#
# C'est la question qui decide de la reparation : si oui, il suffit de reecrire
# la reference ; si non, l'asset est reellement perdu et il faut le retrouver.
dire("")
dire("=== LES CIBLES MORTES SONT-ELLES RETROUVABLES ? ===")
retrouvables = 0
perdues = []
for cible in cibles_mortes:
    miroir = "/Game/Narvos" + cible[len("/Game"):]
    if existe(miroir):
        retrouvables += 1
    else:
        perdues.append(cible)

dire("  %d retrouvable(s) au chemin miroir sous /Game/Narvos" % retrouvables)
dire("  %d REELLEMENT perdue(s)" % len(perdues))
if perdues:
    dire("")
    dire("  les perdues (les 20 premieres) :")
    for p in perdues[:20]:
        dire("     %-66s cite %d fois" % (p[:66], cibles_mortes[p]))

dire("")
dire("=== LES PLUS CITEES ===")
for k, v in cibles_mortes.most_common(10):
    miroir = "/Game/Narvos" + k[len("/Game"):]
    dire("  %-62s x%-4d %s" % (k[:62], v, "miroir OK" if existe(miroir) else "PERDUE"))

json.dump({"casses": casses,
           "cibles": dict(cibles_mortes),
           "perdues": perdues},
          io.open(SORTIE, "w", encoding="utf-8"), indent=1)
dire("")
dire("plan ecrit : %s" % SORTIE)

io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
unreal.log("[NARVOS] ecrit : " + RAPPORT)