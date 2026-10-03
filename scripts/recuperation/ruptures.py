# -*- coding: utf-8 -*-
"""
ruptures.py <chemin relatif> [--depuis AAAA-MM-JJ] — pour UN fichier, montre POURQUOI
chaque époque s'ouvre : les lignes de l'événement qui contredisent ce qu'on tenait.

Une rupture est normale quand le fichier a changé hors de notre vue. Elle est un
DÉFAUT de l'extracteur quand l'événement est mal placé (sortie mal alignée, numéro
faux) : c'est ce que cet outil sert à distinguer.

  python ruptures.py "WebPortal\\Server\\…\\ateliers.js" --depuis 2026-09-13
"""
import importlib.util
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
spec = importlib.util.spec_from_file_location("extraire", os.path.join(ICI, "extraire-historiques.py"))
ex = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ex)
from reconstitution import Reconstitution, etaler  # noqa: E402


class Muet:
    def write(self, *_):
        pass


def court(s, n=78):
    s = s.replace("\t", "→")
    return s if len(s) <= n else s[:n - 1] + "…"


def main():
    depuis = sys.argv[sys.argv.index("--depuis") + 1] if "--depuis" in sys.argv else ""
    d, arguments = ex.charger_pour_diagnostic(Muet(), sys.argv[1:])
    for arg in (a for a in arguments if not a.startswith("--") and a != depuis):
        cle = arg.lower().replace("/", "\\")
        evts = sorted(d.evts.get(cle, []), key=ex.ordre)
        print(f"\n=== {arg} — {len(evts)} événement(s)")
        r = Reconstitution()
        for ts, _, genre, charge, source in evts:
            avant = r.epoques
            carte, total = dict(r.carte), r.total
            ex.appliquer(r, genre, charge, source)
            if r.epoques == avant or ex.iso(ts) < depuis:
                continue
            print(f"\n  ⚠ {ex.iso(ts)} {source} {genre} — on tenait {len(carte)} lignes, total {total}")
            if genre == "ecrire":
                print("      écriture complète d'un contenu différent")
            elif genre == "lire":
                frag, annonce = charge[0], charge[1]
                nums = [n for n, _ in frag]
                print(f"      lecture de {len(frag)} ligne(s) {min(nums)}–{max(nums)}, total annoncé {annonce}")
                ailleurs = {}
                for n, l in carte.items():
                    ailleurs.setdefault(l.rstrip("\r"), []).append(n)
                for n, l in sorted(frag):
                    l = l.rstrip("\r")
                    v = carte.get(n)
                    if v is not None and v.rstrip() != l.rstrip():
                        ou = [x for x in ailleurs.get(l, []) if x != n][:3]
                        print(f"      {n:5}  tenu : {court(v)}")
                        print(f"             lu   : {court(l)}" + (f"      ← connue en {ou}" if ou else ""))
            elif genre == "modifier" and charge["hunks"]:
                for h in charge["hunks"]:
                    n = h.avant if h.n_avant else h.avant + 1
                    for signe, texte in h.lignes:
                        if signe in " -":
                            v = carte.get(n)
                            if v is not None and v.rstrip() != texte.rstrip() and etaler(v).rstrip() != texte.rstrip():
                                print(f"      {n:5}  tenu : {court(v)}")
                                print(f"             diff : {court(texte)}")
                            n += 1


if __name__ == "__main__":
    main()
