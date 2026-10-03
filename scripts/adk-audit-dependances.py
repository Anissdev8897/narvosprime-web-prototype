# -*- coding: utf-8 -*-
"""
adk-audit-dependances.py — la mesure qui a trouvé la panne MetaHuman, sur TOUT
/Game/Narvos : chaque paquet, chacune de ses dépendances, et ce qu'elles valent.

  python scripts/ue-remote.py --statement "exec(open(r'E:/narvosprime-web-prototype/scripts/adk-audit-dependances.py', encoding='utf-8').read()); auditer()"

Puis : node scripts/narvos-audit-dependances.mjs   (le classement et le rapport)

── CE QU'ON CHERCHE (le motif du 2026-09-11) ─────────────────────────────────
MetaCustom était CUIT, mais ses maillages nommaient un squelette resté dans le
dossier d'origine, jamais cuit : dans le pack, référence morte, rien à l'écran,
aucune erreur. Même mal chez Defender (squelette disparu à la promotion). Une
dépendance vaut donc l'une de quatre choses : livrée (sous Narvos/NanosWorld,
cuite), jamais cuite (dossier NeverCook), hors pack (dossier stagé, peut-être avec
un jumeau promu), ou morte (plus aucun asset à ce chemin).

LECTURE SEULE du registre d'assets : rien n'est chargé. Une sonde qui charge un
asset alors que sa référence est morte l'empoisonne (voir
adk-recharger-et-resauver.py) : ne pas remplacer ce script par des load_asset.

Sortie : WebPortal/Server/adk/_audit-dependances.json
"""
import json
import sys
import unreal

AR = unreal.AssetRegistryHelpers.get_asset_registry()
SORTIE = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_audit-dependances.json"


def auditer(racine="/Game/Narvos"):
    opts = unreal.AssetRegistryDependencyOptions(
        include_soft_package_references=True, include_hard_package_references=True,
        include_searchable_names=False, include_soft_management_references=False,
        include_hard_management_references=False)
    assets = AR.get_assets(unreal.ARFilter(package_paths=[racine], recursive_paths=True))
    paquets = {}
    for a in assets:
        p = str(a.package_name)
        if p not in paquets:
            paquets[p] = {"classe": str(a.asset_class_path.asset_name), "deps": []}
    cibles = set()
    for p, e in paquets.items():
        deps = sorted({str(d) for d in (AR.get_dependencies(p, opts) or []) if str(d).startswith("/Game/")})
        e["deps"] = deps
        cibles.update(deps)
    existe = {}
    for c in cibles:
        if c in paquets:
            existe[c] = paquets[c]["classe"]
            continue
        trouves = AR.get_assets_by_package_name(c)
        existe[c] = str(trouves[0].asset_class_path.asset_name) if trouves else None
    with open(SORTIE, "w", encoding="utf-8") as f:
        json.dump({"racine": racine, "paquets": paquets, "existe": existe}, f)
    mortes = sum(1 for v in existe.values() if v is None)
    sys.stdout.write("[AUDIT] %d paquet(s) sous %s, %d cible(s) distincte(s), %d morte(s) ; %s\n"
                     % (len(paquets), racine, len(cibles), mortes, SORTIE))