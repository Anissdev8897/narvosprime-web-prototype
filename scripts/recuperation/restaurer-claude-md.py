# -*- coding: utf-8 -*-
"""
restaurer-claude-md.py — retrouve les fichiers d'instructions CLAUDE.md du projet.

Claude Code ne LIT pas ces fichiers avec l'outil Read : il les injecte dans le
contexte, sous la forme « Contents of <chemin> (project instructions, checked
into the codebase): ». L'extracteur d'historiques ne les voit donc pas. On les
reprend ici dans les transcriptions, en gardant pour chaque chemin la version
la plus RÉCENTE.
"""
import glob
import json
import os
import re
import sys

PROJETS = r"C:\Users\aniss\.claude\projects"
MOTIF = re.compile(
    r"Contents of ((?:[A-Za-z]:\\)[^\n]*?CLAUDE\.md) \(project instructions, checked into the codebase\):\n\n"
    r"(.*?)(?=\n\nContents of [A-Za-z]:\\|\n</system-reminder>|\Z)", re.S)
RACINES = [r"d:\mes_projet\narvosprime-web-prototype", r"e:\narvosprime-web-prototype"]


def textes(rec):
    """Tous les textes d'un enregistrement (messages, résultats d'outils)."""
    pile = [rec]
    while pile:
        x = pile.pop()
        if isinstance(x, str):
            if "CLAUDE.md (project instructions" in x:
                yield x
        elif isinstance(x, dict):
            pile.extend(x.values())
        elif isinstance(x, list):
            pile.extend(x)


def main():
    sortie = sys.argv[1]
    meilleurs = {}   # chemin relatif -> (horodatage, contenu)
    for jsonl in glob.glob(os.path.join(PROJETS, "D--mes-projet-narvosprime-web-prototype*", "*.jsonl")):
        with open(jsonl, encoding="utf-8", errors="replace") as f:
            for ligne in f:
                if "CLAUDE.md (project instructions" not in ligne:
                    continue
                try:
                    rec = json.loads(ligne)
                except Exception:
                    continue
                ts = rec.get("timestamp") or ""
                for t in textes(rec):
                    for m in MOTIF.finditer(t):
                        chemin, contenu = m.group(1), m.group(2).strip("\n") + "\n"
                        bas = chemin.lower()
                        for r in RACINES:
                            if bas.startswith(r + "\\"):
                                rel = chemin[len(r) + 1:]
                                if rel not in meilleurs or ts > meilleurs[rel][0]:
                                    meilleurs[rel] = (ts, contenu)
    for rel, (ts, contenu) in sorted(meilleurs.items()):
        cible = os.path.join(sortie, rel)
        os.makedirs(os.path.dirname(cible) or sortie, exist_ok=True)
        with open(cible, "w", encoding="utf-8", newline="\n") as f:
            f.write(contenu)
        print(f"{rel:40s} {len(contenu.splitlines()):4d} lignes  (version du {ts[:10]})")
    if not meilleurs:
        print("aucun CLAUDE.md retrouvé")


if __name__ == "__main__":
    main()
