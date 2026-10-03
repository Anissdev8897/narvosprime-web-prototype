# -*- coding: utf-8 -*-
"""
tracer.py <chemin relatif> [...] — déroule les événements d'UN fichier, dans l'ordre
du temps, tels que l'extracteur les rejoue. Sert à comprendre pourquoi une
reconstruction diffère du disque (voir ecarts.py).

  python tracer.py "WebPortal\\src\\rpg\\wasm\\MathWasm.ts"
  python tracer.py --extraction E:\\mes_projet\\narvos-reconstruit-v5 "WebPortal\\…\\Session.lua"

`--extraction <dossier>` relit les événements gardés par cette extraction (dix minutes
de chargement en moins) : ce sont exactement ceux qu'elle a rejoués.
"""
import importlib.util
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
spec = importlib.util.spec_from_file_location("extraire", os.path.join(ICI, "extraire-historiques.py"))
ex = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ex)
from reconstitution import Reconstitution  # noqa: E402


class Muet:
    def write(self, *_):
        pass


def resume(genre, charge):
    if genre == "supprimer":
        return "fichier supprimé"
    if genre == "douter":
        return "modifié par un script qu'on ne sait pas rejouer"
    if genre == "poser":
        connues = sum(1 for l in charge[0] if l is not None)
        return f"script rejoué : {len(charge[0])} lignes dont {connues} connues, fin {'connue' if charge[1] else 'ouverte'}"
    if genre == "ecrire":
        return f"{len(charge.split(chr(10)))} lignes"
    if genre == "lire":
        frag, total = charge[0], charge[1]
        rogne = charge[2] if len(charge) > 2 else None
        nums = [n for n, _ in frag]
        if isinstance(rogne, tuple):
            suite = f", FLOTTANTE (plage depuis {rogne[1]}, marge {rogne[2]})"
        else:
            suite = f", ligne {rogne} rognée" if rogne else ""
        return f"lignes {min(nums)}-{max(nums)} ({len(nums)}), total annoncé {total}{suite}" if nums else "vide"
    h = charge["hunks"]
    pos = ", ".join(f"-{x.avant},{x.n_avant} +{x.apres},{x.n_apres}" for x in h[:4])
    return (f"{len(h)} hunk(s) [{pos}] original={'oui' if charge['original'] is not None else 'non'} "
            f"tout={charge['tout']} ancien={charge['ancien'][:50]!r}")


def main():
    d, arguments = ex.charger_pour_diagnostic(Muet(), sys.argv[1:])
    for arg in arguments:
        cle = arg.lower().replace("/", "\\")
        evts = sorted(d.evts.get(cle, []), key=ex.ordre)
        print(f"\n=== {arg} — {len(evts)} événement(s)")
        r = Reconstitution()
        for ts, _, genre, charge, source in evts:
            avant = (r.epoques, len(r.non_appliquees), len(r.attente))
            ex.appliquer(r, genre, charge, source)
            apres = (r.epoques, len(r.non_appliquees), len(r.attente))
            notes = []
            if apres[0] != avant[0]:
                notes.append("NOUVELLE ÉPOQUE")
            if apres[1] != avant[1]:
                notes.append("NON APPLIQUÉE")
            if apres[2] != avant[2]:
                notes.append("mise en attente")
            print(f"  {ex.iso(ts)} {source:11} {genre:9} {resume(genre, charge)}"
                  f"  → total {r.total}, connues {len(r.carte)}" + ("  ⚠ " + ", ".join(notes) if notes else ""))


if __name__ == "__main__":
    main()
