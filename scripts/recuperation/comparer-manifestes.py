# -*- coding: utf-8 -*-
"""
comparer-manifestes.py <extraction A> <extraction B> [--zone <préfixe>] — ce qui change,
fichier par fichier, entre deux extractions (avant / après une correction des outils).

  python comparer-manifestes.py E:\\mes_projet\\narvos-reconstruit-final E:\\mes_projet\\narvos-reconstruit-v4

Chaque état : (trous, lignes d'ancienne version, fin inconnue, modifications non
reportées, lignes). « PIRE » signale un fichier qui a PLUS de lignes manquantes ou
anciennes qu'avant : à regarder (tracer.py, ruptures.py, chaine.py) — ce peut être une
preuve nouvelle qui révèle un fichier périmé, ou un défaut de l'extracteur.
"""
import csv
import os
import sys


def charge(extraction):
    with open(os.path.join(extraction, "MANIFESTE.tsv"), encoding="utf-8") as f:
        r = list(csv.reader(f, delimiter="\t"))
    ix = {n: i for i, n in enumerate(r[0])}

    def n(x, c):
        return int(x[ix[c]]) if c in ix and len(x) > ix[c] and x[ix[c]].isdigit() else 0

    return {x[0].replace(chr(92), "/").lower(): (n(x, "trous"), n(x, "lignes_ancienne_version"), n(x, "fin_inconnue"),
                                                 n(x, "modifs_non_appliquees"), n(x, "lignes")) for x in r[1:]}


def main():
    a, b = charge(sys.argv[1]), charge(sys.argv[2])
    zone = (sys.argv[sys.argv.index("--zone") + 1] if "--zone" in sys.argv
            else "WebPortal/Server/nanos_world/packages").lower().rstrip("/") + "/"
    ta, tb, changes = [0, 0], [0, 0], []
    for k in sorted(set(a) | set(b)):
        if not k.startswith(zone):
            continue
        x, y = a.get(k), b.get(k)
        if x:
            ta[0] += x[0]
            ta[1] += x[1]
        if y:
            tb[0] += y[0]
            tb[1] += y[1]
        if x != y:
            changes.append((k[len(zone):], x, y))
    complets = lambda m: sum(1 for k, v in m.items() if k.startswith(zone) and not (v[0] or v[1] or v[2] or v[3]))
    print(f"{zone}")
    print(f"  A : {complets(a)} complets | {ta[0]} lignes manquantes | {ta[1]} lignes d'ancienne version")
    print(f"  B : {complets(b)} complets | {tb[0]} lignes manquantes | {tb[1]} lignes d'ancienne version")
    for k, x, y in changes:
        pire = bool(x and y and (y[0] + y[1] > x[0] + x[1]))
        print(f"  {'PIRE ' if pire else '     '}{k[:62]:62} {x} -> {y}")


if __name__ == "__main__":
    main()
