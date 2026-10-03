# -*- coding: utf-8 -*-
"""
bilan.py <dossier d'extraction> [--detail <préfixe>] — ce que l'extraction a rendu,
par grande zone du projet, d'après MANIFESTE.tsv.

  python bilan.py E:\\mes_projet\\narvos-reconstruit-v4
  python bilan.py E:\\mes_projet\\narvos-reconstruit-v4 --detail WebPortal/Server/nanos_world/packages
"""
import csv
import os
import sys

ZONES = [
    ("WebPortal/Server/nanos_world/packages", "packages nanos (Lua, UI)"),
    ("scripts/lua-harness", "harnais Lua"),
    ("scripts", "scripts racine"),
    ("WebPortal/scripts", "scripts WebPortal"),
    ("WebPortal/src", "WebPortal/src"),
    ("WebPortal/wasm", "WebPortal/wasm"),
    (".hermes", ".hermes (rapports)"),
    (".claude", ".claude (skills)"),
    ("docs", "docs"),
    ("", "TOUT"),
]


def norme(p):
    return p.replace(chr(92), "/").lower()


def main():
    ex = sys.argv[1]
    detail = norme(sys.argv[sys.argv.index("--detail") + 1]) if "--detail" in sys.argv else None
    with open(os.path.join(ex, "MANIFESTE.tsv"), encoding="utf-8") as f:
        lignes = list(csv.reader(f, delimiter="\t"))
    ix = {n: i for i, n in enumerate(lignes[0])}
    rangs = lignes[1:]

    def entier(r, nom):
        return int(r[ix[nom]]) if nom in ix and len(r) > ix[nom] and r[ix[nom]].isdigit() else 0

    def complet(r):
        return not (entier(r, "trous") or entier(r, "lignes_ancienne_version") or entier(r, "fin_inconnue")
                    or entier(r, "modifs_non_appliquees"))

    print(f"{'zone':28} {'fichiers':>8} {'complets':>8} {'troués':>7} {'anc.ver.':>8} {'fin ?':>6} "
          f"{'modif ?':>7} {'indent ?':>8}")
    for prefixe, titre in ZONES:
        p = norme(prefixe)
        sel = [r for r in rangs if norme(r[0]).startswith(p + "/") or not p]
        print(f"{titre:28} {len(sel):8} {sum(1 for r in sel if complet(r)):8} "
              f"{sum(1 for r in sel if entier(r, 'trous')):7} "
              f"{sum(1 for r in sel if entier(r, 'lignes_ancienne_version')):8} "
              f"{sum(1 for r in sel if entier(r, 'fin_inconnue')):6} "
              f"{sum(1 for r in sel if entier(r, 'modifs_non_appliquees')):7} "
              f"{sum(entier(r, 'indentation_perdue') for r in sel):8}")
    if detail is None:
        return
    sel = [r for r in rangs if norme(r[0]).startswith(detail)]
    inc = [r for r in sel if not complet(r)]
    print(f"\n{detail} : {len(sel)} fichier(s), {len(inc)} incomplet(s)")
    print(f"{'trous':>6} {'anc.':>6} {'fin?':>4} {'lignes':>7} {'couv.':>6}  fichier   (historiques)")
    for r in sorted(inc, key=lambda r: -(entier(r, "trous") + entier(r, "lignes_ancienne_version"))):
        print(f"{entier(r, 'trous'):6} {entier(r, 'lignes_ancienne_version'):6} {entier(r, 'fin_inconnue'):4} "
              f"{entier(r, 'lignes'):7} {r[ix['couverture%']]:>5}%  {norme(r[0])[len(detail):].lstrip('/')}"
              f"   ({r[ix['historiques']]})")


if __name__ == "__main__":
    main()
