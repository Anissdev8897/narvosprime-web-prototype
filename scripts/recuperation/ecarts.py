# -*- coding: utf-8 -*-
"""
ecarts.py <dossier d'extraction> [--detail N] — pour chaque fichier reconstruit
COMPLET mais DIFFÉRENT du disque (fichier sain de DMDE), dit de quel côté est le
retard :

  disque plus récent     : le fichier a été modifié après notre dernier événement
                           connu — une main ou un agent hors de nos sources.
                           Irréductible : c'est DMDE qui a raison.
  historique plus récent : nous avons un événement postérieur à la date du
                           fichier et nous différons quand même — défaut de
                           l'extracteur, à comprendre.
"""
import csv
import datetime
import difflib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sante import texte_sain  # noqa: E402
from evaluer import VERITE, VERITE_CACHE, norme, MARQUES  # noqa: E402


def main():
    ex = sys.argv[1]
    detail = int(sys.argv[sys.argv.index("--detail") + 1]) if "--detail" in sys.argv else 0
    man = {r[0].lower(): r for r in csv.reader(open(os.path.join(ex, "MANIFESTE.tsv"), encoding="utf-8"),
                                                delimiter="\t")}
    disque, historique = [], []
    # `--cache` : contre le cache du client nanos. C'est l'état FINAL des fichiers : tout
    # écart y est du côté « historique » — un défaut de l'extracteur, ou une modification
    # qu'aucun historique ne porte.
    cache = "--cache" in sys.argv
    for verite, rel in (VERITE_CACHE if cache else VERITE):
        for d, dirs, fichiers in os.walk(verite):
            dirs[:] = [x for x in dirs if x not in ("node_modules", "build", "build_old", "build_fail")]
            for f in fichiers:
                p = os.path.join(d, f)
                relp = os.path.join(rel, os.path.relpath(p, verite))
                r = os.path.join(ex, "fichiers", relp)
                if not os.path.exists(r):
                    continue
                a = open(p, "rb").read()
                if not texte_sain(a):
                    continue
                vrai, recon = norme(a), norme(open(r, "rb").read())
                if any(m in l for l in recon for m in MARQUES) or recon == vrai:
                    continue
                m = man.get(relp.lower())
                dernier = m[11] if m else ""
                mt = datetime.datetime.fromtimestamp(os.path.getmtime(p), datetime.timezone.utc).strftime(
                    "%Y-%m-%dT%H:%M:%SZ")
                ops = [o for o in difflib.SequenceMatcher(None, recon, vrai, autojunk=False).get_opcodes()
                       if o[0] != "equal"]
                ligne = (relp, mt, dernier, m[12] if m else "?", ops, recon, vrai)
                (disque if mt > dernier and not cache else historique).append(ligne)
    print(f"disque plus récent : {len(disque)}   |   historique plus récent : {len(historique)}")
    for relp, mt, dernier, src, ops, recon, vrai in historique[:detail]:
        print(f"\n=== {relp}\n    disque {mt} | dernier événement {dernier} | {src} | {len(ops)} écart(s)")
        for tag, i1, i2, j1, j2 in ops[:3]:
            print(f"    {tag} recon[{i1 + 1}:{i2}] vs disque[{j1 + 1}:{j2}]")
            for l in recon[i1:min(i2, i1 + 3)]:
                print("      - recon :", l[:110])
            for l in vrai[j1:min(j2, j1 + 3)]:
                print("      + disque:", l[:110])


if __name__ == "__main__":
    main()
