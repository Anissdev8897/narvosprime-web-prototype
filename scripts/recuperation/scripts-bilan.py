# -*- coding: utf-8 -*-
"""
scripts-bilan.py [--detail N] [--extraction <dossier>] [--doutes] — ce que donne le rejeu
des scripts d'historique (`derouler_scripts`) : combien tournent, combien échouent, et
pourquoi. `--extraction` relit une extraction déjà faite (immédiat) ; `--doutes` liste
les scripts dont l'échec a mis un fichier en doute, avec leur code.

Un échec n'est pas forcément un défaut : le script cherchait un passage qu'on ne tient
pas, ou lisait un fichier hors du projet. Mais une MÊME raison qui revient cent fois
désigne ce que le bac à sable ne sait pas encore faire.
"""
import collections
import importlib.util
import io
import os
import re
import sys
import time

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
spec = importlib.util.spec_from_file_location("extraire", os.path.join(ICI, "extraire-historiques.py"))
ex = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ex)


def main():
    detail = int(sys.argv[sys.argv.index("--detail") + 1]) if "--detail" in sys.argv else 0
    journal = io.StringIO()
    debut = time.time()
    if "--extraction" in sys.argv:
        # Une extraction déjà faite : ses événements et ses échecs sont gardés à côté du manifeste.
        d = ex.relire_evenements(sys.argv[sys.argv.index("--extraction") + 1])
    else:
        d = ex.charger(journal)
        print(journal.getvalue().strip())
        print(f"({len(d.scripts)} scripts retenus, {time.time() - debut:.0f} s)")
    bavard = d.echecs
    genres = collections.Counter(e[2] for evts in d.evts.values() for e in evts if e[4].endswith("-script"))
    print("événements versés par les scripts :", dict(genres))
    if "--doutes" in sys.argv:
        doutes = [e for e in bavard if "⚠ MIS EN DOUTE" in e[4]]
        print(f"\n{len(doutes)} script(s) dont l'échec a mis un fichier en doute :")
        for instant, source, langage, erreur, lus, code in doutes:
            print(f"\n── {instant} {source} {langage} — {erreur}")
            print(f"   lus : {lus[:-1]}")
            print("   " + code[:detail or 600])
        return
    # Un échec ne nous concerne que si le script avait LU un fichier du projet : les
    # autres travaillaient ailleurs (d'autres dépôts, des dossiers d'assets).
    for titre, garde in (("ayant lu un fichier du projet", lambda lus: bool(lus)), ("sans fichier du projet", lambda lus: not lus)):
        raisons = collections.Counter()
        exemples = {}
        total = 0
        for instant, source, langage, erreur, lus, code in bavard:
            if not garde(lus):
                continue
            total += 1
            r = re.sub(r"['\"][^'\"]{12,}['\"]", "'…'", erreur)
            r = re.sub(r"\d+", "N", r)[:90]
            raisons[(langage, r)] += 1
            exemples.setdefault((langage, r), (instant, source, lus, code))
        print(f"\n{total} échec(s) {titre}, par raison :")
        for (langage, r), n in raisons.most_common(40 if garde([1]) else 12):
            print(f"  {n:4}  {langage:6} {r}")
            if detail and garde([1]):
                instant, source, lus, code = exemples[(langage, r)]
                print(f"          {instant} {source} lus={lus}")
                print(f"          {code[:detail]}")


if __name__ == "__main__":
    main()
