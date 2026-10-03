# -*- coding: utf-8 -*-
"""
doute.py --extraction <dossier> <instant ISO> [...] — POURQUOI un script d'historique a
échoué dans le bac à sable, et mis un fichier en doute.

Pour chaque instant (celui que donne `scripts-bilan.py --doutes`) : retrouve la commande
dans les transcriptions de Claude Code, l'état que l'extraction tenait du dernier
fichier lu à cet instant, et, pour chaque texte que le script y cherchait (ses chaînes
de plus d'une ligne ou de plus de 30 caractères), dit s'il s'y trouve — sinon montre le
passage le plus proche et ce qui en diffère.

C'est ce qui départage un fichier RÉELLEMENT périmé (le passage n'existe pas chez nous :
une modification nous a échappé) d'un défaut de nos outils (le passage existe à un
blanc, une tabulation ou un antislash près).

  python doute.py --extraction E:\\mes_projet\\narvos-reconstruit-final 2026-09-12T08:29:06Z
"""
import ast
import difflib
import glob
import importlib.util
import json
import os
import re
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
spec = importlib.util.spec_from_file_location("extraire", os.path.join(ICI, "extraire-historiques.py"))
ex = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ex)
from reconstitution import Reconstitution  # noqa: E402
from commandes import actions  # noqa: E402
import bac  # noqa: E402


def commande_a(instant):
    """(commande, cwd) de l'appel Bash dont le RÉSULTAT porte cet instant (à la seconde)."""
    prefixe = instant[:19]
    for jsonl in glob.glob(os.path.join(ex.PROJETS, "**", "*.jsonl"), recursive=True):
        appels, trouve = {}, None
        with open(jsonl, encoding="utf-8", errors="replace") as f:
            for ligne in f:
                if '"tool_use"' not in ligne and prefixe not in ligne:
                    continue
                try:
                    rec = json.loads(ligne)
                except Exception:
                    continue
                contenu = (rec.get("message") or {}).get("content")
                if not isinstance(contenu, list):
                    continue
                for b in contenu:
                    if not isinstance(b, dict):
                        continue
                    if b.get("type") == "tool_use" and b.get("name") == "Bash":
                        appels[b.get("id")] = ((b.get("input") or {}).get("command") or "", rec.get("cwd") or "")
                    elif (b.get("type") == "tool_result" and (rec.get("timestamp") or "").startswith(prefixe)
                          and b.get("tool_use_id") in appels):
                        trouve = appels[b["tool_use_id"]]
        if trouve:
            return trouve
    return None, None


def chaines_python(code):
    """Les chaînes littérales d'un script Python (les textes qu'il cherche ou pose)."""
    try:
        arbre = ast.parse(code)
    except SyntaxError:
        return re.findall(r"'''(.*?)'''|\"\"\"(.*?)\"\"\"", code, re.S) and [
            a or b for a, b in re.findall(r"'''(.*?)'''|\"\"\"(.*?)\"\"\"", code, re.S)]
    return [n.value for n in ast.walk(arbre) if isinstance(n, ast.Constant) and isinstance(n.value, str)]


def chaines_js(code):
    out = []
    for m in re.finditer(r"`((?:[^`\\]|\\.)*)`|\"((?:[^\"\\\n]|\\.)*)\"|'((?:[^'\\\n]|\\.)*)'", code, re.S):
        t = next(g for g in m.groups() if g is not None)
        try:
            out.append(bytes(t, "utf-8").decode("unicode_escape").encode("latin-1", "ignore").decode("utf-8", "ignore")
                       if "\\" in t else t)
        except Exception:
            out.append(t)
    return out


def etat_a(dossier, cle, instant):
    """La Reconstitution du fichier juste AVANT l'événement de doute posé à cet instant."""
    r = Reconstitution()
    for ts, _, genre, charge, source in sorted(dossier.evts.get(cle, []), key=ex.ordre):
        if ex.iso(ts) >= instant and genre == "douter":
            break
        if ex.iso(ts) > instant:
            break
        ex.appliquer(r, genre, charge, source)
    return r


def main():
    dossier, arguments = ex.charger_pour_diagnostic(None, sys.argv[1:])
    for instant in arguments:
        echec = next((e for e in dossier.echecs if e[0] == instant and "⚠ MIS EN DOUTE" in e[4]), None)
        print(f"\n═══ {instant}")
        if echec is None:
            print("    aucun doute à cet instant dans cette extraction")
            continue
        cle = echec[4][-2]
        commande, cwd = commande_a(instant)
        if commande is None:
            print("    commande introuvable dans les transcriptions de Claude (script d'Hermes ?)")
            continue
        r = etat_a(dossier, cle, instant)
        connu = bac.texte_virtuel(r.carte, r.total) or ""
        lignes = connu.split("\n")
        print(f"    {echec[2]} — {echec[3]}\n    fichier : {cle} — {len(r.carte)} lignes connues sur {r.total}, "
              f"{sum(1 for l in lignes if chr(0) in l)} inconnue(s)")
        for genre, action in actions(commande, cwd):
            if genre != "script" or action[1] is None:
                continue
            langage, code = action[0], action[1]
            cherchees = [c for c in (chaines_python(code) if langage == "python" else chaines_js(code))
                         if isinstance(c, str) and (c.count("\n") >= 1 or len(c) >= 30) and "/" + cle.rsplit(chr(92), 1)[-1] not in c]
            for c in cherchees:
                if c in connu:
                    continue                              # trouvée (ou c'est le texte NEUF, déjà là)
                tete = c.strip().split("\n")[0][:70]
                # Le passage de nos lignes le plus proche de la première ligne cherchée.
                proches = difflib.get_close_matches(c.strip().split("\n")[0], lignes, n=1, cutoff=0.6)
                print(f"    ✗ absente : {tete!r}  ({c.count(chr(10)) + 1} ligne(s))")
                if proches:
                    i = lignes.index(proches[0])
                    notre = "\n".join(lignes[i:i + c.strip().count("\n") + 1])
                    for d in list(difflib.ndiff(c.strip().split("\n"), notre.split("\n")))[:12]:
                        if d[:1] in "-+?":
                            print("        " + d.rstrip()[:150].replace("\t", "→"))
                else:
                    print("        (rien de proche dans ce qu'on tient du fichier)")


if __name__ == "__main__":
    main()
