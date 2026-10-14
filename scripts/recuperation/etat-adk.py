# -*- coding: utf-8 -*-
"""
etat-adk.py — où en sont les SOURCES de l'ADK face à l'inventaire du 23/09/2026 ?

DMDE n'a rendu que 60 % de `adk\\Content\\Narvos` (la copie s'est arrêtée en plein
`Orbital`). Le reste se rebâtit dossier par dossier depuis `WebPortal\\public` ; cet outil
est la règle graduée : pour chaque dossier de `/Game/Narvos`, combien de paquets
l'inventaire du 23/09 (`_assets-inventory.2026-09-23.avant-recook.json`, dernière liste
complète) attend, combien sont sur le disque, et ce que le JEU en appelle.

  python etat-adk.py                       # le tableau, dossiers incomplets d'abord
  python etat-adk.py --manquants pnj       # les paquets attendus et absents d'un dossier
  python etat-adk.py --en-trop pnj         # ceux du disque que l'inventaire ne connaît pas
  python etat-adk.py --json <fichier>      # le tableau, pour un autre outil

Un dossier est « rebâti » quand il n'a plus NI manquant NI en trop : un paquet en trop
porte un nom que les catalogues Lua ne connaissent pas, et décale les clés suffixées `_N`
du pack (le builder numérote les homonymes dans l'ordre où il les rencontre).
"""
import collections
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lots import RACINE  # noqa: E402

ADK = os.path.join(RACINE, "Server", "adk")
CONTENT = os.path.join(ADK, "Content")
INVENTAIRE = os.path.join(ADK, "_assets-inventory.2026-09-23.avant-recook.json")
PREFIXE = "/Game/Narvos/"


def lire_inventaire(chemin=INVENTAIRE):
    """{paquet: classe de son asset principal} — un paquet peut porter deux assets (un
    Blueprint et sa classe générée) : la première classe rencontrée suffit à le nommer."""
    with open(chemin, encoding="utf-8-sig") as f:
        attendus = {}
        for e in json.load(f)["assets"]:
            attendus.setdefault(e["paquet"], e["classe"])
    return attendus


def paquets_du_disque(content=CONTENT):
    """Les paquets présents sous Content\\Narvos, en chemins `/Game/Narvos/…`."""
    presents = set()
    racine = os.path.join(content, "Narvos")
    for d, _, fichiers in os.walk(racine):
        rel = "/Game/" + os.path.relpath(d, content).replace(os.sep, "/")
        for f in fichiers:
            if f.lower().endswith((".uasset", ".umap")):
                presents.add(rel + "/" + os.path.splitext(f)[0])
    return presents


def dossier(paquet):
    reste = paquet[len(PREFIXE):]
    return reste.split("/", 1)[0] if "/" in reste else "(racine)"


def tableau(attendus, presents):
    """{dossier: {"attendus", "presents", "manquants", "en_trop"}} (ensembles de paquets)."""
    t = collections.defaultdict(lambda: {"attendus": set(), "presents": set()})
    for p in attendus:
        t[dossier(p)]["attendus"].add(p)
    for p in presents:
        t[dossier(p)]["presents"].add(p)
    for v in t.values():
        v["manquants"] = v["attendus"] - v["presents"]
        v["en_trop"] = v["presents"] - v["attendus"]
    return t


def main():
    attendus = lire_inventaire()
    presents = paquets_du_disque()
    t = tableau(attendus, presents)

    for option, cle in (("--manquants", "manquants"), ("--en-trop", "en_trop")):
        if option in sys.argv:
            nom = sys.argv[sys.argv.index(option) + 1]
            if nom not in t:
                raise SystemExit(f"dossier inconnu : {nom}")
            for p in sorted(t[nom][cle]):
                print(f"{attendus.get(p, '?'):28} {p}")
            print(f"{len(t[nom][cle])} paquet(s) {cle.replace('_', ' ')} dans {nom}")
            return

    total_a = sum(len(v["attendus"]) for v in t.values())
    total_m = sum(len(v["manquants"]) for v in t.values())
    total_t = sum(len(v["en_trop"]) for v in t.values())
    print(f"inventaire du 23/09 : {total_a} paquets ; sur le disque : {len(presents)} ; "
          f"MANQUANTS : {total_m} ; en trop : {total_t}")
    incomplets = sorted(((n, v) for n, v in t.items() if v["manquants"] or v["en_trop"]),
                        key=lambda x: (-len(x[1]["manquants"]), x[0].lower()))
    print(f"{len(t) - len(incomplets)} dossier(s) conformes, {len(incomplets)} à rebâtir :")
    print(f"   {'dossier':34} {'attendus':>8} {'présents':>8} {'manquants':>9} {'en trop':>7}  classes manquantes")
    for nom, v in incomplets:
        classes = collections.Counter(attendus[p] for p in v["manquants"])
        print(f"   {nom:34} {len(v['attendus']):8} {len(v['presents'] & v['attendus']):8} {len(v['manquants']):9} "
              f"{len(v['en_trop']):7}  " + ", ".join(f"{k}×{n}" for k, n in classes.most_common(4)))
    if "--json" in sys.argv:
        with open(sys.argv[sys.argv.index("--json") + 1], "w", encoding="utf-8", newline="\n") as f:
            json.dump({n: {k: sorted(x) for k, x in v.items() if k in ("manquants", "en_trop")}
                       for n, v in incomplets}, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
