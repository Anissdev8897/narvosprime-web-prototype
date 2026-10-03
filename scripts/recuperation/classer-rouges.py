# -*- coding: utf-8 -*-
"""classer-rouges.py <sortie de tout.mjs> — range chaque harnais rouge par cause."""
import collections
import re
import sys

t = open(sys.argv[1], encoding="utf-8", errors="replace").read()
sections = re.split(r"\n───── (\S+) \(code \d+\) ─────\n", t)
causes = collections.defaultdict(list)
for i in range(1, len(sections), 2):
    nom, corps = sections[i], sections[i + 1]
    m = re.search(r"ENOENT[^']*'([^']+)'", corps)
    if m:
        p = re.sub(r".*narvosprime-web-prototype[/\\]", "", m.group(1).replace("\\", "/"))
        causes["fichier absent"].append((nom, p))
        continue
    m = re.search(r"(CIBLE ABSENTE[^\n]{0,100}|ARRET :[^\n]{0,100})", corps)
    if m:
        causes["fichier absent"].append((nom, m.group(1)[:110]))
        continue
    if "MODULE_NOT_FOUND" in corps or "Cannot find module" in corps or "Cannot find package" in corps:
        m = re.search(r"Cannot find (?:module|package) '([^']+)'", corps)
        causes["dependance npm absente"].append((nom, m.group(1) if m else ""))
        continue
    if "SyntaxError" in corps and ".mjs:" in corps:
        m = re.search(r"(SyntaxError[^\n]{0,80})", corps)
        causes["harnais lui-meme incomplet (JS)"].append((nom, m.group(1)[:90] if m else ""))
        continue
    m = re.search(r"(attempt to [^\n]{0,90}|expected[^\n]{0,70}|unexpected symbol[^\n]{0,60}|syntax error[^\n]{0,60})", corps)
    if m:
        causes["erreur Lua (fichier troue ou ancien)"].append((nom, m.group(1)[:100]))
        continue
    m = re.search(r"(ECHEC[^\n]{0,100}|MANQUANT[^\n]{0,80}|ORPHELIN[^\n]{0,80}|SANS MIGRATION[^\n]{0,60}|"
                  r"Z ABSOLU[^\n]{0,60}|MORTE[^\n]{0,60})", corps)
    if m:
        causes["assertion / garde"].append((nom, m.group(1)[:100]))
        continue
    causes["autre"].append((nom, corps.strip()[:120].replace("\n", " | ")))

for k, v in sorted(causes.items(), key=lambda kv: -len(kv[1])):
    print(f"\n### {k} ({len(v)})")
    for nom, d in v:
        print(f"  {nom:34s} {d}")
