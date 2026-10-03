# -*- coding: utf-8 -*-
"""
chaine.py <chemin relatif> — pour UN fichier, déroule le REPORT ENTRE ÉPOQUES : ce que
chaque version sait par elle-même, et ce qu'elle tient une fois complétée par celle
qui la précède. Sert à comprendre un fichier qui sort troué alors qu'une version
antérieure était riche.

  python chaine.py "WebPortal\\Server\\…\\ateliers.js"
"""
import importlib.util
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
spec = importlib.util.spec_from_file_location("extraire", os.path.join(ICI, "extraire-historiques.py"))
ex = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ex)
import reconstitution as rc  # noqa: E402


class Muet:
    def write(self, *_):
        pass


def resume(c):
    return (f"sûres {sum(1 for e in c if e[0] == 'L'):5} | trous {sum(e[1] for e in c if e[0] == 'T'):5} | "
            f"anciennes {sum(sum(1 for l in e[1] if l is not None) for e in c if e[0] == 'A'):5} | "
            f"témoins {sum(1 for e in c if e[0] == 'C'):4} | fin {'ouverte' if any(e[0] == 'O' for e in c) else 'connue'}")


def main():
    d, arguments = ex.charger_pour_diagnostic(Muet(), sys.argv[1:])
    for arg in arguments:
        cle = arg.lower().replace("/", "\\")
        if cle not in d.evts:
            print("inconnu :", arg)
            continue
        r, _, _ = ex.rejouer(d.evts[cle])
        epoques = list(reversed(r.anciennes)) + [(r.carte, r.total, r.attente)]
        print(f"\n=== {arg} — {len(epoques)} époque(s), de la plus ancienne à la dernière")
        modele = None
        for k, (carte, total, attente) in enumerate(epoques):
            incertaines = r.incertaines if k == len(epoques) - 1 else {}
            composite, _ = rc._composite(carte, incertaines, total)
            seule = resume(composite)
            if modele is not None:
                composite, reprises = rc.combler(composite, modele[0], modele[1])
            print(f"  époque {k + 1:2} : {len(carte):5} lignes, total {str(total):>5} | seule : {seule}")
            if modele is not None:
                print(f"             complétée par la précédente ({len(modele[0])} lignes, total {modele[1]}) : {resume(composite)}")
            plat, longueur = rc._aplatir(composite, lambda s: s)
            placees = 0
            for edit in attente:
                fait = rc._substituer(plat, longueur, rc._net(edit[0]), rc._net(edit[1]), edit[2], edit[3])
                if fait is not None:
                    plat, longueur, placees = fait[0], fait[1], placees + 1
            if attente:
                print(f"             {len(attente)} modification(s) en attente pendant cette époque : {placees} placée(s) "
                      "sur la version complétée")
            modele = (plat, longueur)


if __name__ == "__main__":
    main()
