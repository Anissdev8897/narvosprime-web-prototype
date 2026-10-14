# -*- coding: utf-8 -*-
"""
chercher-nom.py — AVANT de dire qu'une chose est perdue : la chercher par son NOM dans tout le
projet, lots de récupération compris. Lecture seule.

  python scripts/recuperation/chercher-nom.py <regex> [--racine <dossier> ...] [--sortie f.tsv]

Sans `--racine` : tout `E:/narvosprime-web-prototype`, donc `mes_projet/` aussi (2,2 millions
de fichiers, ~4 min à froid, ~15 s ensuite). La regex porte sur le NOM (fichier ou dossier),
casse ignorée.

── POURQUOI ─────────────────────────────────────────────────────────────────────────────────
Le 04/10 le plugin `UnrealMCPServer` a été déclaré « introuvable sur C: et D: » sans que le
projet lui-même ait été fouillé. Son dossier était dans `mes_projet/Nouveau dossier/$F10497/
Plugins/` (Hanibes : « c'est toi qui cherche mal, logiquement tout est ici »). Un nom se
cherche d'abord ICI.

⚠ Un nom trouvé n'est pas un contenu rendu : les lots de la seconde passe (`Nouveau dossier`,
`recup_dir.1`, `scripts-astra/$F…`) gardent noms, tailles et dates justes sur un contenu
recouvert. Toujours enchaîner : `python scripts/recuperation/sonder-contenu.py <dossier>`.

Les jonctions (`WebPortal/public`, `WebPortal/Server/adk`…) ne sont pas suivies : elles mènent
dans `mes_projet`, parcouru par son vrai chemin. `node_modules` et `.git` sont sautés.
"""
import collections
import os
import re
import sys
import time

DEPOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SAUTES = {"node_modules", ".git"}
REPARSE = 0x400


def options(nom: str) -> list[str]:
    return [sys.argv[i + 1] for i, a in enumerate(sys.argv[:-1]) if a == nom]


def marcher(racine: str, motif: re.Pattern):
    """(type, taille, date, chemin) de chaque entrée dont le nom correspond."""
    pile = [racine]
    while pile:
        dossier = pile.pop()
        try:
            entrees = list(os.scandir(dossier))
        except OSError:
            continue
        for e in entrees:
            try:
                etat = e.stat(follow_symlinks=False)
                est_dossier = e.is_dir(follow_symlinks=False)
            except OSError:
                continue
            if motif.search(e.name):
                date = time.strftime("%Y-%m-%d %H:%M", time.localtime(etat.st_mtime))
                yield ("D" if est_dossier else "F"), (-1 if est_dossier else etat.st_size), date, e.path.replace("\\", "/")
            jonction = bool(getattr(etat, "st_file_attributes", 0) & REPARSE)
            if est_dossier and not jonction and e.name not in SAUTES:
                pile.append(e.path)


def lot_de(chemin: str, racine: str) -> str:
    """Les deux ou trois premiers segments : de quel lot (ou de quelle partie du dépôt) vient-il."""
    rel = os.path.relpath(chemin, racine).replace("\\", "/").split("/")
    return "/".join(rel[:3] if rel[0] == "mes_projet" else rel[:2])


def main() -> None:
    libres = [a for i, a in enumerate(sys.argv[1:], 1)
              if not a.startswith("--") and sys.argv[i - 1] not in ("--racine", "--sortie")]
    if not libres:
        print(__doc__)
        sys.exit(2)
    motif = re.compile(libres[0], re.I)
    racines = options("--racine") or [DEPOT]
    sortie = (options("--sortie") or [None])[0]
    debut = time.time()
    trouves = []
    for racine in racines:
        trouves += [(t, taille, date, chemin, lot_de(chemin, racine)) for t, taille, date, chemin in marcher(racine, motif)]
    if sortie:
        with open(sortie, "w", encoding="utf-8", newline="\n") as f:
            for t, taille, date, chemin, _ in trouves:
                f.write("%s\t%d\t%s\t%s\n" % (t, taille, date, chemin))
    par_lot = collections.defaultdict(list)
    for entree in trouves:
        par_lot[entree[4]].append(entree)
    print("%d nom(s) pour /%s/ en %d s" % (len(trouves), libres[0], time.time() - debut))
    for lot, entrees in sorted(par_lot.items(), key=lambda kv: -len(kv[1])):
        dossiers = sum(1 for e in entrees if e[0] == "D")
        print("  %-64s %5d  (%d dossier(s))" % (lot[:64], len(entrees), dossiers))
        for t, taille, date, chemin, _ in sorted(entrees, key=lambda e: (e[0] != "D", len(e[3])))[:3]:
            print("      %s %10s %s  %s" % (t, "" if taille < 0 else taille, date, chemin[-110:]))
    if any(lot.startswith(("mes_projet/Nouveau dossier", "mes_projet/recup_dir", "mes_projet/narvos-restaure/scripts-astra"))
           for lot in par_lot):
        print("\n⚠ lots de la seconde passe : noms justes, contenu souvent recouvert — sonder avec sonder-contenu.py")


if __name__ == "__main__":
    main()
