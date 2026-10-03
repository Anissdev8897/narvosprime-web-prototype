# -*- coding: utf-8 -*-
"""
chemins-vers-e.py — le projet vit sur E:\\narvosprime-web-prototype et NULLE PART
AILLEURS (consigne de Hanibes, 01/10/2026 : plus aucun dossier sur D:).

Réécrit, dans le code du projet, l'ancien emplacement
    D:\\mes_projet\\narvosprime-web-prototype
vers
    E:\\narvosprime-web-prototype
sous ses quatre écritures (barres obliques, antislashs simples, antislashs
doublés des chaînes JS/JSON, chemin MSYS /d/…).

Ne touche ni aux assets, ni aux modules installés, ni aux lots récupérés.

  python chemins-vers-e.py [--ecrire]
"""
import io
import os
import sys

RACINE = r"E:\narvosprime-web-prototype"
PAIRES = [
    ("D:/mes_projet/narvosprime-web-prototype", "E:/narvosprime-web-prototype"),
    ("d:/mes_projet/narvosprime-web-prototype", "E:/narvosprime-web-prototype"),
    ("D:\\\\mes_projet\\\\narvosprime-web-prototype", "E:\\\\narvosprime-web-prototype"),
    ("D:\\mes_projet\\narvosprime-web-prototype", "E:\\narvosprime-web-prototype"),
    ("/d/mes_projet/narvosprime-web-prototype", "/e/narvosprime-web-prototype"),
]
EXT = {".mjs", ".js", ".cjs", ".ts", ".py", ".sh", ".ps1", ".lua", ".json", ".md", ".toml", ".txt", ".bat"}
# Dossiers jamais parcourus : assets, dépendances, lots récupérés montés par jonction.
EXCLUS = {"node_modules", "public", "public.reconstruit", "adk", "adk.reconstruit", "archive_recupere",
          "asset_decompile", "Assets", "inpi", "tools", "wasm", ".git", "_legacy_archive", "archive",
          # Documents d'époque : un rapport qui dit « sur D: » dit vrai pour sa date.
          ".hermes", "docs", "reports", "smoke-results",
          # Ce dossier raconte la récupération (et ce script porte les motifs eux-mêmes).
          "recuperation"}


def main():
    ecrire = "--ecrire" in sys.argv
    n_fichiers = n_occ = 0
    for d, dirs, fichiers in os.walk(RACINE):
        dirs[:] = [x for x in dirs if x not in EXCLUS
                   and not (os.lstat(os.path.join(d, x)).st_file_attributes & 0x400)]
        for f in fichiers:
            if os.path.splitext(f)[1].lower() not in EXT:
                continue
            p = os.path.join(d, f)
            try:
                t = io.open(p, encoding="utf-8", errors="surrogateescape", newline="").read()
            except Exception:
                continue
            u = t
            for a, b in PAIRES:
                u = u.replace(a, b)
            if u != t:
                n_fichiers += 1
                n_occ += sum(t.count(a) for a, _ in PAIRES)
                if ecrire:
                    io.open(p, "w", encoding="utf-8", errors="surrogateescape", newline="").write(u)
    print(f"{n_fichiers} fichier(s), {n_occ} occurrence(s)" + ("" if ecrire else "  (simulation — passer --ecrire)"))


if __name__ == "__main__":
    main()
