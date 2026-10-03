# -*- coding: utf-8 -*-
"""
test_scripts.py — preuves du rejeu des scripts d'historique dans la reconstruction
(`derouler_scripts` d'extraire-historiques.py) : ce qu'un script a fait à un fichier
devient un événement de ce fichier, à sa date, et rien de plus.

  python scripts/recuperation/test_scripts.py
"""
import importlib.util
import io
import os
import shutil
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
spec = importlib.util.spec_from_file_location("extraire", os.path.join(ICI, "extraire-historiques.py"))
ex = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ex)

reussis = echecs = 0
AS = chr(92)
RACINE = "D:" + AS + "mes_projet" + AS + "narvosprime-web-prototype"
A = RACINE + AS + "WebPortal" + AS + "a.lua"
B = RACINE + AS + "WebPortal" + AS + "b.lua"
CLE_A, CLE_B = "webportal" + AS + "a.lua", "webportal" + AS + "b.lua"


def verifier(condition, nom):
    global reussis, echecs
    if condition:
        reussis += 1
    else:
        echecs += 1
        print("ECHEC :", nom)


def derouler(dossier):
    journal = io.StringIO()
    bilan = ex.derouler_scripts(dossier, journal)
    return bilan, journal.getvalue()


def rendu(dossier, cle):
    r, _, _ = ex.rejouer(dossier.evts[cle])
    texte, bilan = r.assembler()
    return r, texte, bilan


V1 = ["local a = 1", "local b = 2", "local c = 3", "local d = 4", "local e = 5", "return a"]

# ── 1. Un script rejoué sur un fichier entier : la modification exacte, à sa date ──
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
code1 = '''p = "WebPortal/a.lua"
s = open(p, encoding="utf-8").read()
assert "local c = 3" in s
s = s.replace("local c = 3", "local c = 30\\nlocal c2 = 31")
open(p, "w", encoding="utf-8").write(s)
'''
d.ajouter_script(200.0, "python", code1, None, [], RACINE, "claude-script", "entree")
bilan, journal = derouler(d)
r, texte, b = rendu(d, CLE_A)
verifier(texte.split("\n") == V1[:2] + ["local c = 30", "local c2 = 31"] + V1[3:] and b["trous"] == 0 and b["anciennes"] == 0,
         "1. remplacement rejoué : le fichier est celui d'après, entier  " + journal.strip())

# ── 2. L'ancre est dans un trou : la modification ATTEND, et se place sur la version d'avant ──
# Version 2 du fichier (trois lignes d'en-tête de plus) : on n'en a lu que deux lignes.
# Le script modifie plus bas, là où l'on ne voit pas. Son remplacement part avec l'époque,
# et s'applique à elle une fois complétée par la version 1.
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
d.ajouter(A, 150.0, "lire", ([(1, "-- entete"), (2, "-- version deux")], 9), "claude")
code2 = '''p = "WebPortal/a.lua"
s = open(p, encoding="utf-8").read()
ancien = "local b = 2\\nlocal c = 3"
assert ancien in s, "ancre introuvable"
s = s.replace(ancien, "local b = 20\\nlocal c = 30\\nlocal x = 0", 1)
open(p, "w", encoding="utf-8").write(s)
'''
d.ajouter_script(200.0, "python", code2, None, [], RACINE, "claude-script", "entree")
d.ajouter(A, 250.0, "lire", ([(1, "-- entete"), (2, "-- version deux")], 10), "claude")
bilan, journal = derouler(d)
r, texte, b = rendu(d, CLE_A)
lignes = texte.split("\n")
verifier("local x = 0" in lignes and "local b = 20" in lignes and "local b = 2" not in lignes and b["modifs_placees"] == 1,
         "2. ancre dans un trou : la modification est faite sur la version d'avant, pas perdue  " + journal.strip())
verifier(not any(e[2] == "douter" for e in d.evts[CLE_A]), "2. … et le fichier n'est pas mis en doute")

# ── 3. Le doute est ÉTROIT ───────────────────────────────────────────────────
# (a) un script en ligne dont la vérification échoue sur un fichier ENTIER : seul le
#     dernier fichier lu est mis en doute.
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
d.ajouter(B, 100.0, "ecrire", "-- b\nreturn 1", "claude")
code3 = '''a = open("WebPortal/a.lua").read()
b = open("WebPortal/b.lua").read()
assert "passage que nous ne tenons pas" in b
open("WebPortal/b.lua", "w").write(b + a)
'''
d.ajouter_script(200.0, "python", code3, None, [], RACINE, "claude-script", "entree")
bilan, journal = derouler(d)
verifier([e[2] for e in d.evts[CLE_B]] == ["ecrire", "douter"] and [e[2] for e in d.evts[CLE_A]] == ["ecrire"],
         "3. vérification en échec : le dernier fichier lu est mis en doute, lui seul  " + journal.strip())
# (b) une panne du bac (module absent) ne dit rien des fichiers.
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
d.ajouter_script(200.0, "python", 'a = open("WebPortal/a.lua").read()\nimport module_inexistant_du_bac\n'
                 'open("WebPortal/a.lua", "w").write(a)\n', None, [], RACINE, "claude-script", "entree")
bilan, journal = derouler(d)
verifier([e[2] for e in d.evts[CLE_A]] == ["ecrire"], "3. panne du bac : aucun doute  " + journal.strip())
if shutil.which("node"):
    # (c) un script FICHIER (un générateur) qui échoue ne met rien en doute : il lit dix
    #     sources et n'en réécrit aucune.
    d = ex.Dossier()
    d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
    gen = RACINE + AS + "scripts" + AS + "narvos-gen.mjs"
    d.ajouter(gen, 100.0, "ecrire", 'import fs from "node:fs";\nconst s = fs.readFileSync("WebPortal/a.lua", "utf8");\n'
              'if (!s.includes("absent du fichier")) throw new Error("source inattendue");\n'
              'fs.writeFileSync("WebPortal/sortie.lua", s);\n', "claude")
    d.ajouter_script(200.0, "node", None, "scripts/narvos-gen.mjs", [], RACINE, "claude-script", "fichier")
    bilan, journal = derouler(d)
    verifier([e[2] for e in d.evts[CLE_A]] == ["ecrire"] and "échecs" in journal,
             "3. générateur en échec : ses sources ne sont pas mises en doute  " + journal.strip())
else:
    print("(node absent : cas 3c sauté)")

# ── 4. Un texte versé en FIN de fichier (`Add-Content`) ──────────────────────
NOTES = RACINE + AS + ".hermes" + AS + "REPRISE.md"
CLE_N = ".hermes" + AS + "reprise.md"
d = ex.Dossier()
d.ajouter(NOTES, 100.0, "ecrire", "# Reprise\n\n- point un\n", "codex")
d.ajouter_script(200.0, "ajout", None, None, ["\n## Suite du 15 septembre\n- lot5 cuit", NOTES], "", "codex-script")
bilan, journal = derouler(d)
r, texte, b = rendu(d, CLE_N)
verifier(texte.split("\n") == ["# Reprise", "", "- point un", "", "## Suite du 15 septembre", "- lot5 cuit"] and b["trous"] == 0,
         "4. ajout en fin d'un fichier connu : les lignes se posent après la dernière  " + journal.strip())
# Si l'on ne sait pas où le fichier finit, on ne sait pas où poser : rien n'est inventé.
d = ex.Dossier()
d.ajouter(NOTES, 100.0, "lire", ([(1, "# Reprise"), (2, "")], 0), "codex-shell")
d.ajouter_script(200.0, "ajout", None, None, ["## Suite", NOTES], "", "codex-script")
bilan, journal = derouler(d)
verifier([e[2] for e in d.evts[CLE_N]] == ["lire"] and "fin inconnus" in journal,
         "4. fin de fichier inconnue : l'ajout n'est pas posé au hasard  " + journal.strip())

# ── 5. `mv`, `cp`, `rm` : le fichier suit, le contenu ne change pas ──────────
ANCIEN = RACINE + AS + "scripts" + AS + "adk-sonde.py"
d = ex.Dossier()
d.ajouter(ANCIEN, 100.0, "ecrire", "# sonde\nprint(1)\n", "claude")
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
d.ajouter(RACINE + AS + "scripts" + AS + "_tmp-a.mjs", 100.0, "ecrire", "// a\n", "claude")
d.ajouter(RACINE + AS + "scripts" + AS + "_tmp-b.mjs", 100.0, "ecrire", "// b\n", "claude")
ex.actions_de_shell(d, 200.0, "mv scripts/adk-sonde.py scripts/adk-sonder-foret.py && cp WebPortal/a.lua WebPortal/b.lua; "
                    "rm -f scripts/_tmp-*.mjs", RACINE.replace(AS, "/"), "claude-script", True)
bilan, journal = derouler(d)
cle = lambda *p: AS.join(p).lower()
verifier(rendu(d, cle("scripts", "adk-sonder-foret.py"))[1] == "# sonde\nprint(1)"
         and rendu(d, cle("scripts", "adk-sonde.py"))[1] is None,
         "5. mv : le contenu passe sous le nouveau nom, l'ancien n'est plus rendu  " + journal.strip())
verifier(rendu(d, CLE_B)[1] == "\n".join(V1) and rendu(d, CLE_A)[1] == "\n".join(V1), "5. cp : deux fichiers, même contenu")
verifier(rendu(d, cle("scripts", "_tmp-a.mjs"))[1] is None and rendu(d, cle("scripts", "_tmp-b.mjs"))[1] is None,
         "5. rm avec joker : les fichiers connus qui y répondent ne sont plus rendus")
# `cat >> f <<'FIN'` passe par le même chemin que l'ajout de PowerShell.
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "local a = 1\n", "claude")
ex.actions_de_shell(d, 200.0, "cat >> WebPortal/a.lua <<'EOF'\nreturn a\nEOF", RACINE.replace(AS, "/"), "claude-script", True)
derouler(d)
verifier(rendu(d, CLE_A)[1] == "local a = 1\nreturn a", "5. `cat >>` : la ligne se pose en fin de fichier")
# `git restore` : le fichier n'est plus celui qu'on tient.
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
ex.actions_de_shell(d, 200.0, "git restore WebPortal/a.lua", RACINE.replace(AS, "/"), "hermes-script", False)
derouler(d)
verifier([e[2] for e in d.evts[CLE_A]] == ["ecrire", "douter"], "5. git restore : le fichier est mis en doute")

# ── 6. L'ORDRE d'une commande : sauver, casser exprès, restaurer ──────────────
# Mesuré sur `Zones.lua` : un défaut volontaire, posé le temps de voir le harnais rougir.
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
temoin = ('Z=WebPortal/a.lua; cp "$Z" "$Z.bak"; python -c "\n'
          "import io\n"
          "p='$Z'\n"
          "s=io.open(p,encoding='utf-8').read()\n"
          "s=s.replace('local b = 2','local b = nil  -- DEFAUT VOLONTAIRE')\n"
          "io.open(p,'w',encoding='utf-8').write(s)\n"
          '"; node scripts/lua-harness/zones.mjs | tail -2; mv "$Z.bak" "$Z"; echo restaure')
ex.actions_de_shell(d, 200.0, temoin, RACINE.replace(AS, "/"), "claude-script", True)
bilan, journal = derouler(d)
verifier(rendu(d, CLE_A)[1] == "\n".join(V1),
         "6. cp → script → mv : le fichier RESTAURÉ est celui d'avant, le défaut volontaire n'y reste pas  " + journal.strip())
verifier(rendu(d, CLE_A + ".bak")[1] is None if (CLE_A + ".bak") in d.evts else True, "6. la copie de sauvegarde ne survit pas au `mv`")

# ── 7. Le disque photographié PENDANT la commande porte déjà ce qu'elle a fait ──
# Une commande est datée de son résultat (210) ; le script qu'elle lance écrit avant
# (le fichier sain du lot est daté de 200). Rejoué après l'instantané, le script s'y
# appliquerait une seconde fois — ou, ne retrouvant plus son ancre, le mettrait en doute.
APRES = V1[:2] + ["local c = 30", "local c2 = 31"] + V1[3:]
for nom_cas, code7 in (("insertion", '''p = "WebPortal/a.lua"
s = open(p, encoding="utf-8").read()
s = s.replace("local b = 2", "local b = 2\\nlocal c = 30\\nlocal c2 = 31").replace("local c = 3\\n", "")
open(p, "w", encoding="utf-8").write(s)
'''), ("vérification", code1)):
    d = ex.Dossier()
    d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
    d.ajouter(A, 200.0 + ex.MARGE_DMDE, "ecrire", "\n".join(APRES), "dmde")
    d.fenetres.append((190.0, 210.0))
    d.ajouter_script(210.0, "python", code7, None, [], RACINE, "claude-script", "entree")
    bilan, journal = derouler(d)
    r, texte, b = rendu(d, CLE_A)
    verifier(texte.split("\n") == APRES and b["anciennes"] == 0 and not any(e[2] == "douter" for e in d.evts[CLE_A]),
             f"7. instantané pris pendant la commande ({nom_cas}) : ni refait, ni mis en doute  " + journal.strip())
# Hors de la fenêtre de la commande, l'instantané est un état ANTÉRIEUR : le script s'applique.
d = ex.Dossier()
d.ajouter(A, 150.0 + ex.MARGE_DMDE, "ecrire", "\n".join(V1), "dmde")
d.fenetres.append((190.0, 210.0))
d.ajouter_script(210.0, "python", code1, None, [], RACINE, "claude-script", "entree")
derouler(d)
verifier(rendu(d, CLE_A)[1].split("\n") == APRES, "7. instantané antérieur à la commande : le script s'applique par-dessus")

# ── 8. Une commande « réussie » peut porter un script qui a ÉCHOUÉ ───────────
# Mesuré sur `narvos-ateliers-to-lua.mjs` (12/09). Le script cherche `join("\n")`, écrit
# `join("\\n")` dans son heredoc ; le shell réduit la paire, Python lit un vrai retour à la
# ligne, l'ancre est introuvable : AssertionError. La commande n'est pas en erreur — le
# `node --check` qui suit a réussi. L'agent s'y reprend ensuite sans antislash.
# Rejouer le premier script comme réussi mettait le générateur en doute (« ancienne
# version » de bout en bout) ; ne pas réduire les antislashs le faisait « réussir », et le
# second, trouvant l'ajout déjà là, sortait sur « deja fait ».
GEN = RACINE + AS + "scripts" + AS + "narvos-gen.mjs"
CLE_G = "scripts" + AS + "narvos-gen.mjs"
js = ['const lua = `Ateliers.STATIONS = {', '${lignes.join("' + AS + 'n")}', '}`;']
premier = ("python - <<'PY'\nimport io\np = \"scripts/narvos-gen.mjs\"\ns = io.open(p, encoding=\"utf-8\").read()\n"
           "a = '''${lignes.join(\"" + AS * 2 + "n\")}\n}`;'''\n"
           "n = '''${lignes.join(\"" + AS * 2 + "n\")}\n}\nAteliers.ETABLI = {}`;'''\n"
           "assert a in s, 'ancre'\ns = s.replace(a, n, 1)\nio.open(p, \"w\", encoding=\"utf-8\").write(s)\nPY\n"
           "node --check scripts/narvos-gen.mjs && echo 'JS OK'")
sortie_1 = 'Traceback (most recent call last):\n  File "<stdin>", line 6, in <module>\nAssertionError: ancre\nJS OK\n'
second = ("python - <<'PY'\nimport io\np = \"scripts/narvos-gen.mjs\"\nl = io.open(p, encoding=\"utf-8\").read().split(chr(10))\n"
          "if any('Ateliers.ETABLI' in x for x in l):\n    raise SystemExit('deja fait')\n"
          "j = l.index('}`;')\nl = l[:j] + ['}', 'Ateliers.ETABLI = {}`;'] + l[j + 1:]\n"
          "io.open(p, \"w\", encoding=\"utf-8\").write(chr(10).join(l))\nprint('generateur : etabli ajoute')\nPY")
d = ex.Dossier()
d.ajouter(GEN, 100.0, "ecrire", "\n".join(js), "claude")
ex.actions_de_shell(d, 200.0, premier, RACINE.replace(AS, "/"), "claude-script", ex.REDUIRE_CLAUDE, sortie_1)
ex.actions_de_shell(d, 300.0, second, RACINE.replace(AS, "/"), "claude-script", ex.REDUIRE_CLAUDE, "generateur : etabli ajoute\n")
bilan, journal = derouler(d)
verifier(rendu(d, CLE_G)[1].split("\n") == js[:2] + ["}", "Ateliers.ETABLI = {}`;"]
         and not any(e[2] == "douter" for e in d.evts[CLE_G]) and "échecs fidèles" in journal,
         "8. le script qui avait échoué échoue ici de même, sans doute ; le second fait le travail  " + journal.strip())
E_PY, E_NODE = ("python", "entree", None), ("node", "entree", None)
sortie_node = ('[stdin]:6\nif (!a.includes(vieux)) throw new Error("DessinerRadar introuvable");\n'
               "                        ^\n\nError: DessinerRadar introuvable\n    at [stdin]:6:31\n"
               "    at runScriptInThisContext (node:internal/vm:219:10)\n\nNode.js v24.15.0\n2\n")
verifier(ex.echecs_reels(sortie_1, [E_PY]) == [(True, 6)] and ex.echecs_reels("ok\n", [E_PY, E_NODE]) == [(False, None)] * 2
         and ex.echecs_reels(sortie_1, [E_PY, E_PY]) == [(True, 6), (False, None)] and ex.echecs_reels(None, [E_NODE]) == [(None, None)]
         and ex.echecs_reels(sortie_node, [E_PY, E_NODE]) == [(False, None), (True, 6)],
         "8. la sortie dit qui a échoué, et à quelle ligne : une trace va au script d'où elle vient")
verifier(ex.echecs_reels("E:\\p\\x.mjs:12\n  });\n   ^\n\nSyntaxError: Unexpected token\n    at wrapSafe (node:internal)\n\nNode.js v24.15.0\n",
                         [E_NODE]) == [(False, None)],
         "8. la trace d'un `node --check x.mjs` n'accuse pas le script lu sur l'entrée")
# Réussi ICI, échoué ALORS, sans savoir où : rien n'est appliqué.
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
d.ajouter_script(200.0, "python", code1, None, [], RACINE, "claude-script", "entree", (True, None), sortie_1)
bilan, journal = derouler(d)
verifier(rendu(d, CLE_A)[1] == "\n".join(V1) and "rien n'est appliqué" in journal,
         "8. réussi ici mais échoué alors, ligne inconnue : rien n'est appliqué  " + journal.strip())
if shutil.which("node"):
    # … en sachant où : le script est arrêté à la même ligne. Ce qu'il avait écrit AVANT est
    # réel (interface.js), ce qui suit ne l'est pas (ateliers.js) — mesuré le 13/09.
    d = ex.Dossier()
    d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
    d.ajouter(B, 100.0, "ecrire", "-- b\nreturn 1", "claude")
    js8 = ('const fs = require("fs");\nlet s = fs.readFileSync("WebPortal/a.lua", "utf8");\n'
           's = s.replace("local b = 2", "local b = 20");\nfs.writeFileSync("WebPortal/a.lua", s);\n'
           'let a = fs.readFileSync("WebPortal/b.lua", "utf8");\n'
           'if (!a.includes("return 1")) throw new Error("DessinerRadar introuvable");\n'
           'fs.writeFileSync("WebPortal/b.lua", a.replace("return 1", "return 2"));\n')
    d.ajouter_script(200.0, "node", js8, None, [], RACINE, "claude-script", "entree", (True, 6), sortie_node)
    bilan, journal = derouler(d)
    verifier(rendu(d, CLE_A)[1].split("\n")[1] == "local b = 20" and rendu(d, CLE_B)[1] == "-- b\nreturn 1"
             and not any(e[2] == "douter" for evts in d.evts.values() for e in evts),
             "8. arrêté à la ligne où il s'était arrêté : la première écriture vaut, la seconde n'a pas eu lieu  " + journal.strip())
verifier(ex.arret_force("python", "a = 1\nfor x in (1, 2):\n    assert x < 2, (\n        x)\nb = 2\n", 4)
         == "a = 1\nfor x in (1, 2):\n    raise SystemExit('ARRET_FORCE_NARVOS')\n    assert x < 2, (\n        x)\nb = 2\n"
         and ex.arret_force("node", "const a = f(\n  1,\n  2);\n", 2) is None,
         "8. l'arrêt se pose avant l'INSTRUCTION qui tournait (pas au milieu d'elle) ; sinon on renonce")
# Un `SystemExit("message")` retrouvé dans la sortie d'alors est un échec fidèle, pas un doute.
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
garde = 'a = open("WebPortal/a.lua").read()\nif "local e = 5" in a:\n    raise SystemExit("deja fait")\nopen("WebPortal/a.lua", "w").write(a)\n'
d.ajouter_script(200.0, "python", garde, None, [], RACINE, "claude-script", "entree", (False, None), "deja fait\n")
bilan, journal = derouler(d)
verifier([e[2] for e in d.evts[CLE_A]] == ["ecrire"] and "échecs fidèles" in journal,
         "8. sortie volontaire retrouvée dans la sortie d'alors : fidèle, aucun doute  " + journal.strip())

# ── 9. Une commande FINIE EN ERREUR n'est pas une commande qui n'a rien fait ──
# Mesuré le 02/10/2026 (`narvos-audit-packs.mjs`, 12/09 07:49:27) : le script Python modifie
# le fichier, puis `node --check` échoue — « Exit code 1 ». Toute la commande était ignorée.
CWD = RACINE.replace(AS, "/")
script9 = ("python - <<'PY'\np = \"WebPortal/a.lua\"\ns = open(p, encoding=\"utf-8\").read()\n"
           "assert \"local c = 3\" in s\ns = s.replace(\"local c = 3\", \"local c = 30\")\n"
           "open(p, \"w\", encoding=\"utf-8\").write(s)\nprint(\"modifie\")\nPY")
suite9 = "\nnode --check WebPortal/x.mjs && node WebPortal/x.mjs | tail -n 3"
trace9 = ("file:///D:/p/WebPortal/x.mjs:135\n    if (p.replace(/x/g)) y;\n       ^^^\n\nSyntaxError: missing ) after argument list\n"
          "    at checkSyntax (node:internal/main/check_syntax:72:5)\n\nNode.js v24.15.0\n")
d, ecrits = ex.Dossier(), []
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
n = ex.commande_en_erreur(d, 200.0, script9 + suite9, CWD, "claude-script", ex.REDUIRE_CLAUDE,
                          "Exit code 1\nmodifie\n" + trace9, ecrits)
bilan, journal = derouler(d)
verifier(n == 1 and rendu(d, CLE_A)[1].split("\n")[2] == "local c = 30" and not ecrits,
         "9. le script d'avant la vérification en échec est rejoué : sa modification a eu lieu  " + journal.strip())
# Le script est le DERNIER segment et la commande a échoué sans trace : c'est lui qui a échoué.
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
n = ex.commande_en_erreur(d, 200.0, script9, CWD, "claude-script", ex.REDUIRE_CLAUDE, "Exit code 1\n", [])
bilan, journal = derouler(d)
verifier(n == 1 and rendu(d, CLE_A)[1] == "\n".join(V1) and "rien n'est appliqué" in journal,
         "9. dernier segment d'une commande en erreur : tenu pour échoué, rien n'est appliqué  " + journal.strip())
# Un fichier écrit par heredoc puis lancé : le lancement échoue, le fichier est écrit quand même.
d, ecrits = ex.Dossier(), []
d.ajouter(B, 100.0, "ecrire", "-- b\nreturn 1", "claude")
n = ex.commande_en_erreur(d, 200.0, "cat > WebPortal/b.lua <<'EOF'\n-- neuf\nreturn 2\nEOF\nnode WebPortal/verif.mjs", CWD,
                          "claude-script", ex.REDUIRE_CLAUDE, "Exit code 1\nverif : 1 echec\n", ecrits)
ex.rattacher_sorties(d, ecrits, io.StringIO())
verifier(n >= 1 and [e[6] for e in ecrits] == ["claude-heredoc"] and rendu(d, CLE_B)[1] == "-- neuf\nreturn 2",
         "9. l'écriture par heredoc d'une commande en erreur est posée")
# Ce qui n'a pas tourné, ou qu'on ne sait pas suivre : rien.
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
refus = [ex.commande_en_erreur(d, 200.0 + k, script9 + suite9, CWD, "claude-script", ex.REDUIRE_CLAUDE, s, [])
         for k, s in enumerate(["The user doesn't want to proceed with this tool use.", "Exit code 124\nmodifie\n",
                                "Command timed out after 2m 0s\nmodifie\n", None,
                                "Exit code 1\n/usr/bin/bash: line 1: cd: /d/absent: No such file or directory\n"])]
verifier(refus == [0] * 5 and not d.scripts,
         "9. refus, délai dépassé, sortie absente, shell en défaut : la commande n'est pas reprise")
# « Exit code 127 » : un mot parasite en fin de commande, introuvable. Tout le reste a tourné
# (mesuré : `voyage-tests.lua`, 06/09 11:59:15 — le script dit « ok », le harnais tourne, puis `p`).
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
n = ex.commande_en_erreur(d, 200.0, script9 + "\nnode WebPortal/harnais.mjs 2>&1 | tail -n 12\np", CWD, "claude-script",
                          ex.REDUIRE_CLAUDE, "Exit code 127\nmodifie\n95 reussis, 1 echec(s)\n"
                          "/usr/bin/bash: line 136: p: command not found\n", [])
bilan, journal = derouler(d)
verifier(n >= 1 and rendu(d, CLE_A)[1].split("\n")[2] == "local c = 30",
         "9. commande introuvable en fin de ligne (127) : ce qui précède a tourné  " + journal.strip())
verifier(ex.commande_en_erreur(ex.Dossier(), 200.0, script9 + suite9, CWD, "claude-script", ex.REDUIRE_CLAUDE,
                               "Exit code 127\n/usr/bin/bash: line 1: python: command not found\n", []) == 0,
         "9. l'interpréteur lui-même introuvable : le script n'a pas tourné")

# ── 10. Rejoué À L'AVEUGLE : rien n'est posé, ce que le script a écrit est mis en doute ──
# Le bac ne voit aucun fichier binaire : un script qui compte des `.glb` y écrit « 0 ». Poser
# ce « 0 » serait inventer ; garder l'ancien contenu comme s'il était à jour serait mentir
# aussi — le script, lui, a bien réécrit le fichier.
code10 = '''import os
n = sum(os.path.exists("WebPortal/public/models/%s.glb" % x) for x in ("a", "b"))
open("WebPortal/a.lua", "w", encoding="utf-8").write("-- %d modeles" % n)
open("WebPortal/rapport-modeles.json", "w").write('{"presents": %d}' % n)
'''
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
d.ajouter_script(200.0, "python", code10, None, [], RACINE, "claude-script", "entree", (False, None), "")
bilan, journal = derouler(d)
verifier([e[2] for e in d.evts[CLE_A]] == ["ecrire", "douter"] and not any("rapport-modeles" in k for k in d.evts)
         and "aveugle" in journal,
         "10. script qui dépend de binaires : son résultat n'est pas posé, le fichier qu'il a réécrit est mis en doute  "
         + journal.strip())
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
d.ajouter_script(200.0, "python", code10, None, [], RACINE, "claude-script", "entree", (True, None), "")
bilan, journal = derouler(d)
verifier([e[2] for e in d.evts[CLE_A]] == ["ecrire"],
         "10. … mais s'il avait ÉCHOUÉ pour de vrai, rien n'a été réécrit : aucun doute  " + journal.strip())
# Le même regard à l'aveugle, mais le fichier est MODIFIÉ EN PLACE (lu, puis réécrit) : il
# tient son contenu de lui-même, la modification est posée. (Le script de migration du 19/09
# parcourt un dossier inconnu puis corrige 159 fichiers : tous passaient en doute.)
code10b = '''import os
n = 0
for racine in ("WebPortal", "scripts/v3_setup"):
    for r, ds, fs in os.walk(racine):
        for f in fs:
            p = os.path.join(r, f)
            s = open(p, encoding="utf-8").read()
            if "local c = 3" in s:
                open(p, "w", encoding="utf-8").write(s.replace("local c = 3", "local c = 30"))
                n += 1
open("WebPortal/sortie/liste.txt", "w").write("%d fichier(s) corrige(s) sous %s" % (n, racine))
'''
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
d.ajouter_script(200.0, "python", code10b, None, [], RACINE, "claude-script", "entree", (False, None), "")
bilan, journal = derouler(d)
verifier(rendu(d, CLE_A)[1].split("\n")[2] == "local c = 30" and not any(e[2] == "douter" for e in d.evts[CLE_A])
         and not any("liste.txt" in k for k in d.evts),
         "10. modification en place dans un script qui a regardé à l'aveugle : posée ; ce qu'il GÉNÈRE, non  "
         + journal.strip())
# Un contenu LITTÉRAL (écrit dans le script) ne doit rien à ce que le script a vu : posé,
# même si le script a regardé à l'aveugle — « créer le module, puis l'inscrire dans l'Index ».
code10c = '''import os
if os.path.exists("WebPortal/public/models/a.glb"):
    print("modele present")
open("WebPortal/Neuf.lua", "w", encoding="utf-8").write("""local Neuf = {}
--- Un module tout neuf, ecrit en clair dans le script.
function Neuf.Dire() return "bonjour" end
return Neuf
""")
'''
d = ex.Dossier()
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
d.ajouter_script(200.0, "python", code10c, None, [], RACINE, "claude-script", "entree", (False, None), "")
bilan, journal = derouler(d)
CLE_N = "webportal" + AS + "neuf.lua"
verifier(CLE_N in d.evts and rendu(d, CLE_N)[1].split("\n")[0] == "local Neuf = {}",
         "10. fichier généré mais LITTÉRAL dans le script : posé malgré le regard à l'aveugle  " + journal.strip())
# Une ENTRÉE TROUÉE : ce qui en est CALCULÉ sans porter ses trous n'est pas posé (« lus : 0 »).
code10d = '''import json
n = sum(1 for l in open("WebPortal/a.lua", encoding="utf-8") if l.startswith("local"))
open("WebPortal/compte.json", "w").write(json.dumps({"locaux": n}))
copie = open("WebPortal/a.lua", encoding="utf-8").read()
open("WebPortal/a.copie.lua", "w", encoding="utf-8").write(copie)
'''
d = ex.Dossier()
d.ajouter(A, 100.0, "lire", ([(1, "local a = 1"), (6, "return a")], 6), "claude")   # trouée : lignes 2-5 inconnues
d.ajouter_script(200.0, "python", code10d, None, [], RACINE, "claude-script", "entree", (False, None), "")
bilan, journal = derouler(d)
CLE_C = "webportal" + AS + "a.copie.lua"
verifier(not any("compte.json" in k for k in d.evts) and CLE_C in d.evts and rendu(d, CLE_C)[2]["trous"] == 4
         and "entrée trouée" in journal,
         "10. compte calculé sur une entrée trouée : non posé ; la copie, qui porte ses trous, est posée  " + journal.strip())

# ── 11. Un dossier courant CONNU fait foi : pas de repli sur la racine du projet ──
# Les transcriptions de TOUS les projets sont lues. Mesuré le 03/10/2026 : un `grep -n` lancé
# dans `C:/…/goldluxuryking-shop/server` sur SON `.env.example` devenait une nouvelle époque
# du nôtre (50 lignes rendues 88, dont 72 trous).
d = ex.Dossier()
d.ajouter(RACINE + AS + ".env.example", 100.0, "ecrire", "A=1\nB=2", "claude")
d.ajouter(A, 100.0, "ecrire", "\n".join(V1), "claude")
AILLEURS = "C:/Users/aniss/autre-projet/server"
verifier(d.cle_connue(".env.example", [AILLEURS, CWD]) is None and d.cle_connue("WebPortal/a.lua", [AILLEURS]) is None,
         "11. commande lancée dans un autre projet : son fichier n'est pas le nôtre, même s'il porte le même nom")
verifier(d.cle_connue(".env.example", [CWD, AILLEURS]) is not None and d.cle_connue("a.lua", [CWD + "/WebPortal"]) is not None,
         "11. commande lancée dans le projet : le fichier est trouvé")
verifier(d.cle_connue(".env.example", ["", ""]) is not None and d.cle_connue("a.lua", ["WebPortal"]) is not None,
         "11. dossier courant inconnu, ou relatif : repli sur les racines du projet")
verifier(d.cle_connue("WebPortal/a.lua", [AILLEURS, CWD], toutes=True) is not None,
         "11. recherche : la racine fouillée PUIS le dossier de la session — les deux sont connus")
verifier(d.cle_connue(A, [AILLEURS]) is not None, "11. chemin absolu : il se suffit")

print(f"scripts : {reussis} assertion(s) reussie(s), {echecs} echec(s)")
sys.exit(1 if echecs or not reussis else 0)
