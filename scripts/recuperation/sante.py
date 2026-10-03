# -*- coding: utf-8 -*-
"""
sante.py — LE test de santé d'un fichier texte récupéré, partagé par tous les outils.

Leçon du 01/10/2026 : « aucun octet de contrôle » ne suffit pas. Un cluster
réalloué peut ne contenir que des octets hauts (tables binaires, 0xFF en série) :
il passait pour du texte, et un Assets.toml 100 % binaire a été déclaré « sain
à 89 % ». Un fichier texte est donc sain si, À LA FOIS :
  · il ne contient aucun octet de contrôle (hors tabulation, LF, CR) ;
  · il se décode en UTF-8 strict — ou, à défaut, c'est du cp1252 avec très peu
    d'octets hauts (un vieux fichier accentué, pas une table binaire).

  python sante.py <dossier> [--liste]      contrôle un arbre, sans rien modifier
"""
import os
import sys

TEXTE = {".lua", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".css", ".html", ".md", ".txt",
         ".toml", ".py", ".sh", ".ps1", ".yaml", ".yml", ".cpp", ".h", ".hpp", ".c", ".ini",
         ".cs", ".glsl", ".svg", ".xml", ".bat", ".cmake"}
PART_HAUTE_MAX = 0.08        # au-delà, du cp1252 « plein d'accents » est en réalité du binaire


NUL_TOLERES = 8              # un source peut porter quelques NUL littéraux (séparateur, joker)


def texte_sain(b):
    """Vrai si ces octets sont du texte lisible (voir l'en-tête)."""
    if not b:
        return False
    # ⚠ Quelques octets NUL ne font pas un fichier corrompu : `mirrorClip.ts` écrit
    # `replace(/_l$/i, "\0")` avec un vrai NUL, `nanos-build-asset-pack.mjs` s'en sert
    # de séparateur de clé. Un cluster réalloué, lui, en porte des centaines et
    # d'autres octets de contrôle avec. On tolère donc une poignée de NUL, rien d'autre.
    if any((o < 9 and o != 0) or (13 < o < 32) or o == 127 for o in b):
        return False
    if b.count(0) > NUL_TOLERES:
        return False
    try:
        b.decode("utf-8")
        return True
    except UnicodeDecodeError:
        pass
    hauts = sum(1 for o in b if o >= 128)
    if hauts > len(b) * PART_HAUTE_MAX:
        return False
    try:
        b.decode("cp1252")
        return True
    except UnicodeDecodeError:
        return False


def fichier_sain(chemin):
    """Un fichier d'extension texte est jugé ; un binaire (image, modèle…) ne l'est pas."""
    if os.path.splitext(chemin)[1].lower() not in TEXTE:
        return True
    try:
        with open(chemin, "rb") as f:
            return texte_sain(f.read())
    except Exception:
        return False


def est_reparse(p):
    try:
        return bool(os.lstat(p).st_file_attributes & 0x400)
    except Exception:
        return False


def main():
    racine = sys.argv[1]
    liste = "--liste" in sys.argv
    sains = 0
    mauvais = []
    for d, dirs, fichiers in os.walk(racine):
        dirs[:] = [x for x in dirs if x not in ("node_modules", ".git") and not est_reparse(os.path.join(d, x))]
        for f in fichiers:
            p = os.path.join(d, f)
            if os.path.splitext(f)[1].lower() not in TEXTE:
                continue
            if os.path.getsize(p) == 0:
                continue
            if fichier_sain(p):
                sains += 1
            else:
                mauvais.append(os.path.relpath(p, racine))
    print(f"{racine} : {sains} fichiers texte sains, {len(mauvais)} corrompus")
    if liste:
        for m in mauvais:
            print("  CORROMPU", m)


if __name__ == "__main__":
    main()
