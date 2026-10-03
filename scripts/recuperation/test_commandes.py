# -*- coding: utf-8 -*-
"""
test_commandes.py — preuves de l'alignement des sorties de shell (commandes.py).

  python scripts/recuperation/test_commandes.py

Chaque cas est un piège mesuré le 01/10/2026 ou une règle à ne pas voir régresser.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from commandes import lectures, analyser, jetons  # noqa: E402
from reconstitution import Reconstitution  # noqa: E402

reussis = echecs = 0


def verifier(condition, nom):
    global reussis, echecs
    if condition:
        reussis += 1
    else:
        echecs += 1
        print("ECHEC :", nom)


def L(fichier, lignes, total=0, rogne=None, cwd=""):
    return ((fichier, cwd), lignes, total, rogne)


# ── 1. Découpage : guillemets, variables, ce qu'on refuse d'analyser ──────────
verifier(jetons("grep -n 'a;b|c' x.lua") == [("mot", [("lit", "grep")]), ("mot", [("lit", "-n")]),
                                             ("mot", [("lit", "a;b|c")]), ("mot", [("lit", "x.lua")])],
         "1. un `;` ou un `|` entre guillemets n'est pas un opérateur")
verifier(analyser('sed -n "1,3p" $(ls)') == [("inconnu",)] and analyser("cat `ls`") == [("inconnu",)]
         and lectures('sed -n "1,3p" $(ls)', "a\nb\nc") == [],
         "1. substitution de commande : un mot insoluble, donc un segment inconnu — rien n'en est lu")
verifier(jetons('echo "pas fermé') is None, "1. guillemet ouvert : non analysable")
verifier(analyser('grep -n "fin$" a.lua') == [("num", "a.lua", "", None)], "1. `$` de fin de motif : littéral")
verifier(analyser("grep -n x a.lua | head -5") == [("num", "a.lua", "", 5)]
         and analyser("cat -n a.lua | sed -n '10,19p'") == [("num", "a.lua", "", 10)],
         "1. un filtre borne le nombre de lignes numérotées")
verifier(analyser('D=/d/proj; sed -n "1,2p" "$D/a.lua"') == [("pos", "/d/proj/a.lua", "", 1, 2)],
         "1. variable posée dans la commande : résolue")
verifier(analyser('sed -n "1,2p" "$INCONNUE/a.lua"') == [("inconnu",)] and lectures('sed -n "1,2p" "$INCONNUE/a.lua"', "x") == []
         and analyser('$OUTIL a.lua') is None,
         "1. variable inconnue : le segment est INCONNU (rien n'en est lu) ; si c'est la commande elle-même, tout est écarté")
verifier(analyser("cd /d/proj && cd src; head -5 a.ts") == [("pos", "a.ts", "/d/proj/src", 1, 5)],
         "1. `cd` suivi : absolu puis relatif")
verifier(analyser("sed -n '1,3p' a.lua 2>/dev/null") == [("pos", "a.lua", "", 1, 3)],
         "1. `2>/dev/null` ignoré")
verifier(analyser("sed -n '1,3p' a.lua > b.lua") is None and analyser("sed -i 's/a/b/' a.lua") == [("inconnu",)],
         "1. redirection : écartée ; `sed -i` : un segment inconnu, sans lecture")
verifier(analyser("sed -n '1,3p' a.lua || echo x") is None
         and analyser("ls; sed -n '1,3p' a.lua") == [("inconnu",), ("pos", "a.lua", "", 1, 3)]
         and lectures("ls; sed -n '1,3p' a.lua", "f\nl1\nl2\nl3") == [],
         "1. `||` : écartée ; segment inconnu sans séparateur : rien n'en est lu")

# ── 2. Positions déduites : sed, head, cat ───────────────────────────────────
verifier(lectures("echo deb; sed -n '10,12p' a.lua", "deb\n  x\ny\n  z") == [L("a.lua", [(10, "  x"), (11, "y"), (12, "  z")])],
         "2. plage après un echo : indentation intacte, rien de rogné")
verifier(lectures("sed -n '10,12p' a.lua", "x\ny\n  z") == [L("a.lua", [(10, "x"), (11, "y"), (12, "  z")], 0, 10)],
         "2. plage en tête de sortie, complète : première ligne signalée rognée")
verifier(lectures("sed -n '10,20p' a.lua", "x\ny") == [L("a.lua", [(10, "x"), (11, "y")], 0, ("flottant", 10, 9))],
         "2. plage en tête, incomplète, hors ligne 1 : lignes vides de début peut-être perdues — position FLOTTANTE "
         "(de 0 à 9 rangs), à caler contre le fichier")
verifier(lectures("sed -n '10,$p' a.lua", "x\ny") == [] or analyser("sed -n '10,$p' a.lua") == [("inconnu",)],
         "2. … sans borne haute, la marge est inconnue : rien")
verifier(lectures("sed -n '1,20p' a.lua", "x\ny") == [L("a.lua", [(1, "x"), (2, "y")], 0, 1)],
         "2. depuis la ligne 1 : acceptée (pas de longueur déduite en fin de sortie)")
verifier(lectures("sed -n '134p' a.h", "int x;") == [L("a.h", [(134, "int x;")], 0, 134)], "2. `sed -n 'Np'`")
verifier(lectures("sed -n '10,50p' a.lua | head -2", "x\ny") == [L("a.lua", [(10, "x"), (11, "y")], 0, 10)],
         "2. `| head` borne la plage")
verifier(lectures("sed -n '10,50p' a.lua | tail -2", "x\ny") == [], "2. `| tail` : positions inconnues")
verifier(lectures("head -3 a.md", "t\n\nu") == [L("a.md", [(1, "t"), (2, ""), (3, "u")], 0, 1)], "2. head -K")
verifier(lectures("head -n 3 a.md; echo ---", "t\nu\n---") == [L("a.md", [(1, "t"), (2, "u")], 2, 1)],
         "2. head court et borné : fin de fichier prouvée")
verifier(lectures("cat a.toml", "a = 1\n\nb = 2") == [L("a.toml", [(1, "a = 1"), (2, ""), (3, "b = 2")], 3, 1)],
         "2. cat : tout le fichier, longueur connue")
verifier(lectures("cat a.toml b.toml", "x\ny") == [], "2. cat de deux fichiers : frontière inconnue")
verifier(lectures("echo A; cat a.lua; echo B; cat b.lua", "A\na1\n\na3\nB\nb1")
         == [L("a.lua", [(1, "a1"), (2, ""), (3, "a3")], 3), L("b.lua", [(1, "b1")], 1)],
         "2. deux cat bornés par des echo")

# ── 3. Les pièges de l'alignement ────────────────────────────────────────────
verifier(lectures("sed -n '90,120p' a.lua; sed -n '1,3p' b.lua", "a90\na91\nb1\nb2\nb3") == [],
         "3. plage courte suivie d'une autre : coupe indécidable")
verifier(lectures("sed -n '1,2p' a.lua; sed -n '5,6p' b.lua", "a1\na2\nb5\nb6\n")
         == [L("a.lua", [(1, "a1"), (2, "a2")], 0, 1), L("b.lua", [(5, "b5"), (6, "b6")])],
         "3. compte exact : chaque plage a tout rendu")
verifier(lectures("sed -n '90,120p' a.lua; echo ---; sed -n '1,3p' b.lua", "a90\na91\n---\nb1\nb2\nb3")
         == [L("a.lua", [(90, "a90"), (91, "a91")], 0, ("flottant", 90, 29)), L("b.lua", [(1, "b1"), (2, "b2"), (3, "b3")])],
         "3. plage courte EN TÊTE de sortie : flottante ; ce qui suit l'`echo` reste borné et se lit")
verifier(lectures("echo ==; sed -n '90,120p' a.lua; echo ---; sed -n '1,3p' b.lua", "==\na90\na91\n---\nb1\nb2\nb3")
         == [L("a.lua", [(90, "a90"), (91, "a91")], 91), L("b.lua", [(1, "b1"), (2, "b2"), (3, "b3")])],
         "3. plage courte bornée des deux côtés : alignée, fin de fichier prouvée")
verifier(lectures("echo ==; sed -n '1,9p' a.md; echo ---; sed -n '1,3p' b.lua", "==\ntitre\n---\ntexte\n---\nb1\nb2\nb3") == [],
         "3. le séparateur figure dans le fichier lu")
verifier(lectures("sed -n '1,3p' a.lua", "a1\na2\na3\nen trop") == [], "3. plus de lignes que la plage")
verifier(lectures("sed -n '1,400p' a.lua", "a1\na2\n... [120 lines truncated] ...\na399") == [],
         "3. sortie tronquée par l'outil")
verifier(lectures("echo; sed -n '1,3p' a.lua", "a1\na2\na3") == [], "3. echo vide en tête : mangé par le rognage")
verifier(lectures("sed -n '1,3p' a.lua; echo", "a1\na2\na3") == [], "3. echo vide en fin : mangé par le rognage")

# ── 4. Numéros portés par les lignes : grep -n, cat -n ───────────────────────
verifier(lectures("grep -n 'local' a.lua", "3:local x = 1\n17:  local y") == [L("a.lua", [(3, "local x = 1"), (17, "  local y")])],
         "4. grep -n sur un fichier")
verifier(lectures("grep -n -A1 'f' a.lua", "3:function f()\n4-  return 1\n--\n9:f()")
         == [L("a.lua", [(3, "function f()"), (4, "  return 1"), (9, "f()")])],
         "4. lignes de contexte et séparateurs `--`")
verifier(lectures("grep -n 'x' a.lua | head -2", "3:x\n5:x") == [L("a.lua", [(3, "x"), (5, "x")])],
         "4. `| head` ne change pas les numéros")
verifier(lectures("grep -rn 'x' src", "src/a.ts:3:x\nsrc/b/c.lua:5:  x")
         == [L("src/a.ts", [(3, "x")]), L("src/b/c.lua", [(5, "  x")])],
         "4. grep récursif : chaque ligne porte son fichier")
verifier(lectures("grep -n 'x' a.lua b.lua", "a.lua:3:x\nb.lua:5:x") == [L("a.lua", [(3, "x")]), L("b.lua", [(5, "x")])],
         "4. deux fichiers : préfixés")
verifier(lectures("grep -hn 'x' a.lua b.lua", "3:x\n5:x") == [], "4. -h sur deux fichiers : inattribuable")
verifier(lectures("grep -on 'x' a.lua", "3:x") == [] and lectures("grep -c 'x' a.lua", "3") == []
         and lectures("grep 'x' a.lua", "x") == [], "4. -o, -c, ou sans -n : écartés")
verifier(lectures("grep -n 'x' a.lua | cut -c1-80", "3:x") == [] and lectures("grep -n 'x' a.lua | grep -n y", "1:3:x") == [],
         "4. filtre qui retouche ou renumérote : écarté")
verifier(lectures("grep -n 'x' a.lua | grep -v y", "3:x") == [L("a.lua", [(3, "x")])], "4. filtre qui ne fait que trier")
verifier(lectures("cat -n a.lua | sed -n '2,3p'", "2\tb\n     3\t  c") == [L("a.lua", [(2, "b"), (3, "  c")])],
         "4. cat -n : numéro, tabulation, texte — même rogné en tête")
verifier(lectures("grep -n -e 'x' -- a.lua", "3:x") == [L("a.lua", [(3, "x")])], "4. -e et --")
verifier(lectures("cd /d/p && grep -nE 'a|b' x.lua", "7:a", "/ailleurs") == [L("x.lua", [(7, "a")], cwd="/d/p")],
         "4. le dossier courant suit le `cd`")

# ── 5. Une ligne rognée ne détrône jamais une ligne certaine ─────────────────
r = Reconstitution()
r.lire([(1, "function f()"), (2, "    return 1"), (3, "end")], 3)
r.lire([(2, "return 1"), (3, "end")], 0, rogne=2)
texte, bilan = r.assembler()
verifier(texte.split("\n")[1] == "    return 1" and bilan["indentation_perdue"] == 0,
         "5. même texte, indentation connue : la ligne certaine reste")
r = Reconstitution()
r.lire([(1, "function f()"), (3, "end")], 3)
r.lire([(2, "return 1"), (3, "end")], 0, rogne=2)
texte, bilan = r.assembler()
verifier(texte.split("\n")[1] == "return 1" and bilan["indentation_perdue"] == 1 and bilan["trous"] == 0,
         "5. trou comblé par la ligne rognée, et compté")
r.lire([(2, "    return 1")], 3)
texte, bilan = r.assembler()
verifier(texte.split("\n")[1] == "    return 1" and bilan["indentation_perdue"] == 0,
         "5. une lecture certaine la remplace ensuite")
r = Reconstitution()
r.lire([(1, "function f()"), (2, "    return 1"), (3, "end")], 3)
r.lire([(2, "return 2"), (3, "end")], 0, rogne=2)
texte, bilan = r.assembler()
verifier(texte.split("\n")[1] == "    return 2" and bilan["indentation_perdue"] == 1,
         "5. ligne changée sur place : texte neuf, retrait de l'ancienne, comptée")

# ── 7. Tout se compte : plages et lignes numérotées bornées, sans séparateur ──
verifier(lectures("sed -n '1,2p' a.lua; grep -n x b.lua | head -2", "a1\na2\n3:x\n9:  x")
         == [L("a.lua", [(1, "a1"), (2, "a2")], 0, 1), L("b.lua", [(3, "x"), (9, "  x")])],
         "7. plage pleine + grep borné par `head`, tous deux à leur maximum : coupe certaine")
verifier(lectures("sed -n '1,2p' a.lua; grep -n x b.lua | head -2", "a1\n3:x\n9:  x") == [],
         "7. total inférieur à la somme des maxima : on ne sait pas qui a été court")
verifier(lectures("sed -n '1,2p' a.lua; grep -n x b.lua | head -2", "a1\na2\n3:x\npas un numéro") == [],
         "7. une ligne non numérotée dans la part du grep : la coupe est fausse")
verifier(lectures("grep -n -A1 x b.lua | head -3; sed -n '5,5p' a.lua", "3:x\n4-y\n--\nl5")
         == [L("b.lua", [(3, "x"), (4, "y")]), L("a.lua", [(5, "l5")])],
         "7. le séparateur de contexte `--` compte pour une ligne du grep")

# ── 8. Lignes inconnues (sortie tronquée en son milieu, total connu) ─────────
from commandes import aligner_lignes  # noqa: E402

em = [("pos", "a.lua", "", 1, 4), ("pos", "b.lua", "", 10, 12)]
verifier(aligner_lignes(em, ["a1", "a2", None, None, None, "b11", "b12"], rognee=False)
         == [L("a.lua", [(1, "a1"), (2, "a2")]), L("b.lua", [(11, "b11"), (12, "b12")])],
         "8. ce qui précède la coupure se compte depuis le début, ce qui la suit depuis la fin")
verifier(aligner_lignes(em, ["a1", "a2", None, None, "b11", "b12"], rognee=False) == [],
         "8. total différent de la somme des maxima : rien")
verifier(aligner_lignes([("pos", "a.lua", "", 1, None)], ["l1", None, None, "l4", "l5"], rognee=False)
         == [L("a.lua", [(1, "l1"), (4, "l4"), (5, "l5")], 5)],
         "8. un seul fichier entier : positions des deux côtés, longueur = total annoncé")
verifier(aligner_lignes([("echo", "=="), ("pos", "a.lua", "", 1, 3)], [None, None, "l2", "l3"], rognee=False)
         == [L("a.lua", [(2, "l2"), (3, "l3")])], "8. un séparateur perdu dans la coupure n'empêche pas le compte exact")

# ── 6. Écritures par heredoc : le contenu est dans la commande ───────────────
from commandes import ecritures  # noqa: E402

AS = chr(92)       # un antislash, écrit sans passer par les échappements du shell
cmd = "cd /d/proj && cat > scripts/x.lua <<'FIN'\nlocal a = 1\n  return a\nFIN\nnode verif.mjs"
verifier(ecritures(cmd, "/ailleurs") == [(("scripts/x.lua", "/d/proj"), "local a = 1\n  return a\n")],
         "6. heredoc cité : contenu exact, dossier courant suivi")
verifier(ecritures("cat > x.lua <<FIN\nlocal a = $HOME\nFIN", "") == [],
         "6. délimiteur non cité : le shell développe les variables — écarté")
verifier(ecritures("cd $OU && cat > x.lua <<'FIN'\na\nFIN", "") == [], "6. `cd` illisible : on ne sait pas où — écarté")
verifier(ecritures('S="/d/t"; cat > "$S/x.py" <<\'FIN\'\na\nFIN', "") == [(("/d/t/x.py", ""), "a\n")],
         "6. cible par variable posée dans la commande")
corps = "p = [/" + AS * 2 + "] et " + AS + "d+ et " + AS * 4
verifier(ecritures("cat > x.mjs <<'FIN'\n" + corps + "\nFIN", "")
         == [(("x.mjs", ""), "p = [/" + AS + "] et " + AS + "d+ et " + AS * 2 + "\n")],
         "6. chaque PAIRE d'antislashs est réduite à un seul, comme sur le disque")
deux = "cat > a.lua <<'UN'\nx\nUN\ncd sous\ncat > b.lua <<'DEUX'\ny\nDEUX"
verifier(ecritures(deux, "/r") == [(("a.lua", "/r"), "x\n"), (("b.lua", "/r/sous"), "y\n")],
         "6. deux heredocs : le `cd` entre les deux compte pour le second")

# ── 9. Antislashs : ce que le shell REÇOIT ───────────────────────────────────
from commandes import reduire_antislashs, executions  # noqa: E402

G = '"'
verifier(reduire_antislashs(G + "a" + AS * 2 + "b" + G) == G + "a" + AS + "b" + G, "9. une paire au milieu : réduite")
verifier(reduire_antislashs(G + "a" + AS * 2 + G) == G + "a" + AS * 2 + G, "9. une paire AVANT un guillemet double : gardée")
verifier(reduire_antislashs("'a" + AS * 2 + "'") == "'a" + AS + "'", "9. avant un guillemet simple : réduite")
verifier(reduire_antislashs("a" + AS * 3 + "b") == "a" + AS * 2 + "b" and reduire_antislashs("a" + AS * 4 + "b") == "a" + AS * 2 + "b",
         "9. trois et quatre : deux")
verifier(reduire_antislashs("a" + AS + "n") == "a" + AS + "n", "9. un antislash seul : intact")

# ── 10. Scripts exécutés par une commande ─────────────────────────────────────
e = executions("cd /d/proj && python - <<'PY'\nimport io\ns = io.open('a.lua').read()\nPY\necho fait", "/x")
verifier(e == [("python", "import io\ns = io.open('a.lua').read()", None, [], "/d/proj", "entree")],
         "10. python sur heredoc : le code, le dossier courant après `cd`")
e = executions('C="/d/p/ui"\npython - "$C/index.js" <<\'PYEOF\'\nimport sys\nPYEOF\nnode --check "$C/index.js" && echo ok')
verifier(e == [("python", "import sys", None, ["/d/p/ui/index.js"], "", "entree")],
         "10. arguments du script résolus ; `node --check` n'est pas une exécution")
e = executions("node -e 'const fs=require(\"fs\"); fs.writeFileSync(\"a\", \"b\")' x y | tail -2")
verifier(e == [("node", 'const fs=require("fs"); fs.writeFileSync("a", "b")', None, ["x", "y"], "", "arg")],
         "10. node -e, suivi d'un tube")
e = executions("PYTHONIOENCODING=utf-8 python outils/corrige.py --apply a.lua; node scripts/x.mjs")
verifier(e == [("python", None, "outils/corrige.py", ["--apply", "a.lua"], "", "fichier"),
               ("node", None, "scripts/x.mjs", [], "", "fichier")],
         "10. scripts dans des fichiers, variable d'environnement en tête")
e = executions("python - <<FIN\nprint('$HOME')\nFIN")
verifier(e == [], "10. heredoc non cité avec `$` : le shell y développe des variables — écarté")
e = executions("python - <<'FIN'\ns = s.replace(" + G + AS * 2 + "n" + G + ", " + G + "x" + G + ")\nFIN")
verifier(e and e[0][1] == "s = s.replace(" + G + AS + "n" + G + ", " + G + "x" + G + ")",
         "10. le code est celui que l'interpréteur a reçu (antislashs réduits)")
verifier(executions("python -m pytest; node --version; python --version") == [], "10. modules et versions : rien")

# ── 11. `sed -i` : une modification en place ─────────────────────────────────
from commandes import editions_sed  # noqa: E402

verifier(editions_sed("cd /d/p && sed -i 's/a/b/' x.lua y.lua; echo ok") == [(["-i", "s/a/b/"], ["x.lua", "y.lua"], "/d/p")],
         "11. sed -i : le script et les fichiers, après `cd`")
verifier(editions_sed("sed -i.bak -E -e 's/a+/b/' -e '2d' x.lua") == [(["-i", "-E", "-e", "s/a+/b/", "-e", "2d"], ["x.lua"], "")],
         "11. -i.bak, -E, plusieurs -e")
verifier(editions_sed("sed 's/a/b/' x.lua > y.lua") == [] and editions_sed("sed -n '1,5p' x.lua") == [],
         "11. sans -i : rien n'est modifié en place")
verifier(editions_sed("sed -i -f regles.sed x.lua") == [], "11. règles dans un fichier : on ne les a pas")

# ── 12. `cat >> f <<'FIN'` : un ajout en fin de fichier ──────────────────────
from commandes import ajouts, deplacements, ecritures as ecritures_h  # noqa: E402

cmd = "cd /d/p/ui\ncat >> style.css <<'EOF'\n\n/* Jouabilité */\n.jouabilite { display: grid; }\nEOF\necho ok"
verifier(ajouts(cmd) == [(("style.css", "/d/p/ui"), "\n/* Jouabilité */\n.jouabilite { display: grid; }\n")]
         and ecritures_h(cmd) == [], "12. `>>` : le texte ajouté, et ce n'est PAS une écriture complète")
cmd = "cat > a.lua <<'A'\nlocal a\nA\ncat >> a.lua <<'B'\nreturn a\nB\ncat > b.lua <<'C'\nlocal b\nC"
verifier(ecritures_h(cmd) == [(("a.lua", ""), "local a\n"), (("b.lua", ""), "local b\n")]
         and ajouts(cmd) == [(("a.lua", ""), "return a\n")],
         "12. écritures et ajout mêlés : chacun à sa place (un `>>` ne cache plus l'écriture qui le suit)")
verifier(ajouts("cat >> a.txt <<EOF\n$HOME\nEOF") == [], "12. délimiteur non cité : le shell développe — écarté")

# ── 13. `mv`, `cp`, `rm`, `git restore` : le fichier change, pas son contenu ──
verifier(deplacements("cd /d/p && mv scripts/a.py scripts/b.py && cp -f x.lua sauvegarde/x.lua; rm -f scripts/_tmp-*.mjs y.txt")
         == [("mv", ["scripts/a.py"], "scripts/b.py", "/d/p"), ("cp", ["x.lua"], "sauvegarde/x.lua", "/d/p"),
             ("rm", ["scripts/_tmp-*.mjs", "y.txt"], None, "/d/p")],
         "13. mv, cp, rm : sources et destination, après `cd`")
verifier(deplacements("cp -r src dst; rm -rf build; mv a b c") == [], "13. récursif, ou plus de deux noms : on ne devine pas")
verifier(deplacements("git restore src/a.ts src/b.ts; git checkout -- c.ts; git restore --staged d.ts; git status")
         == [("restaurer", ["src/a.ts", "src/b.ts"], None, ""), ("restaurer", ["c.ts"], None, "")],
         "13. git restore / checkout -- : le fichier revient à la version du dépôt ; --staged ne touche pas le fichier")

# ── 14. Une commande FINIE EN ERREUR : ce qu'elle avait fait à coup sûr ──────
from commandes import actions_lancees, actions  # noqa: E402

PY = ("python", "open('f.mjs', 'w').write('x')", None, [], "/d/p", "entree")
cmd = "cd /d/p && python - <<'PY'\nopen('f.mjs', 'w').write('x')\nPY\nnode --check f.mjs && node f.mjs | tail -n 3"
verifier(actions_lancees(cmd) == [("script", PY, 0, False)],
         "14. le script a tourné AVANT la vérification qui échoue : rendu, et pas décisif")
verifier([a for _, a, _, _ in actions_lancees(cmd)] == [a for g, a in actions(cmd) if a == PY],
         "14. la même action que celle d'`actions`")
verifier(actions_lancees("cd /d/p && python - <<'PY'\nopen('f.mjs', 'w').write('x')\nPY") == [("script", PY, 0, True)],
         "14. le script est le dernier segment : son statut EST le code de sortie — décisif")
cmd = "cat > f.mjs <<'EOF'\nthrow 1\nEOF\nnode f.mjs"
verifier(actions_lancees(cmd) == [("ecriture", (("f.mjs", ""), "throw 1\n"), None, False),
                                  ("script", ("node", None, "f.mjs", [], "", "fichier"), 0, True)],
         "14. un fichier écrit par heredoc puis lancé : l'écriture est faite, le lancement décide")
verifier(actions_lancees("node --check f.mjs && python - <<'PY'\nopen('f.mjs', 'w').write('x')\nPY") == []
         and actions_lancees("grep -q x f.lua && sed -i 's/a/b/' f.lua") == [],
         "14. après `&&` derrière une commande au statut inconnu : pas sûr d'avoir tourné — rien")
verifier(actions_lancees("node --check f.mjs &&\n python a.py") == [],
         "14. `&&` puis retour à la ligne : le lien tient toujours")
cmd = "python a.py && sed -i 's/a/b/' f.lua ; rm g.txt ; node h.mjs"
verifier(actions_lancees(cmd, echoues={0})
         == [("script", ("python", None, "a.py", [], "", "fichier"), 0, False),
             ("fichiers", ("rm", ["g.txt"], None, ""), None, False),
             ("script", ("node", None, "h.mjs", [], "", "fichier"), 1, True)],
         "14. script en échec (trace) : ce qui le suit par `&&` n'a pas tourné, la liste suivante si")
verifier(actions_lancees(cmd)
         == [("script", ("python", None, "a.py", [], "", "fichier"), 0, False),
             ("sed", (["-i", "s/a/b/"], ["f.lua"], ""), None, False),
             ("fichiers", ("rm", ["g.txt"], None, ""), None, False),
             ("script", ("node", None, "h.mjs", [], "", "fichier"), 1, True)],
         "14. sans trace, le script passe pour réussi : le `sed` qui en dépend a tourné")
verifier(actions_lancees("cd /d/p && python a.py && echo ok") == [("script", ("python", None, "a.py", [], "/d/p", "fichier"), 0, True)],
         "14. tout passe pour réussi dans la dernière liste : c'est sa dernière action qui a échoué sans rien dire")
verifier(actions_lancees("python a.py ; echo fin") == [],
         "14. échec que rien n'explique (la dernière liste ne peut pas échouer) : rien")
verifier(actions_lancees("mkdir -p out && cat > out/a.txt <<'EOF'\nx\nEOF\npython verif.py")
         == [("ecriture", (("out/a.txt", ""), "x\n"), None, False),
             ("script", ("python", None, "verif.py", [], "", "fichier"), 0, True)],
         "14. `mkdir` ne fait pas douter de la suite")
verifier(actions_lancees("if grep -q x f.lua; then python a.py; fi") == []
         and actions_lancees("set -e\npython a.py\nnode b.mjs") == []
         and actions_lancees("(cd d && python a.py)") == []
         and actions_lancees("python a.py || exit 1\nnode b.mjs") == [],
         "14. structure qu'on ne suit pas (if, set -e, sous-shell, exit) : rien")
verifier(actions_lancees("python a.py | tail -n 2") == [("script", ("python", None, "a.py", [], "", "fichier"), 0, True)],
         "14. script dans un tube, seul : la commande a échoué sans autre cause possible — tenu pour décisif")

# ── 15. Un producteur numéroté NON BORNÉ entre des voisins qui se comptent ────
# Mesuré le 03/10/2026 (`inventaire.css`, 15/09 14:41) : trois `sed -n` puis un `grep -n` sur
# deux fichiers. Le grep ne se compte pas ; toute la sortie était écartée — et avec elle la
# seule lecture d'un bloc de 20 lignes ajouté ce jour-là (fichier « complet mais différent »).
cmd = 'sed -n 2,3p a.lua; sed -n 5,6p a.lua; grep -n "x" b.toml c.toml'
verifier(lectures(cmd, "l2\nl3\nl5\nl6\nb.toml:4:x = 1\nc.toml:9:x = 2\n")
         == [L("a.lua", [(2, "l2"), (3, "l3")], 0, 2), L("a.lua", [(5, "l5"), (6, "l6")]),
             L("b.toml", [(4, "x = 1")]), L("c.toml", [(9, "x = 2")])],
         "15. sed, sed, grep sur deux fichiers : les lignes du grep se RECONNAISSENT, les sed se comptent")
verifier(lectures(cmd, "l2\nl3\nl5\nl6\n") == [L("a.lua", [(2, "l2"), (3, "l3")], 0, 2), L("a.lua", [(5, "l5"), (6, "l6")])],
         "15. le grep ne trouve rien : les sed se comptent exactement")
verifier(lectures(cmd, "l2\nl3\nl5\nb.toml:4:x = 1\nc.toml:9:x = 2\n") == [],
         "15. un sed COURT (fichier plus petit que la plage) : une ligne du grep tombe de son côté — rien")
verifier(lectures(cmd, "l3\nl5\nl6\nb.toml:4:x = 1\n") == [],
         "15. première ligne rognée (une ligne vide de moins) : même décalage — rien")
verifier(lectures(cmd, "l2\nl3\nl5\nl6\nb.toml:4:x = 1\nune ligne sans numéro\n") == [],
         "15. une ligne du bloc n'a pas la forme numérotée : rien")
cmd = "sed -n 2,3p a.lua; grep -n x a.lua; sed -n 8,9p a.lua"
verifier(lectures(cmd, "l2\nl3\n5:x\n7:xx\nl8\nl9\n")
         == [L("a.lua", [(2, "l2"), (3, "l3")], 0, 2), L("a.lua", [(5, "x"), (7, "xx")]), L("a.lua", [(8, "l8"), (9, "l9")])],
         "15. grep d'un seul fichier, au MILIEU : borné des deux côtés par des sed pleins")
verifier(lectures(cmd, "l2\nl3\n7:xx\n5:x\nl8\nl9\n") == [],
         "15. … des numéros qui reculent ne sont pas la sortie d'un grep : rien")
verifier(lectures('grep -n "a" b.toml c.toml; grep -n "b" b.toml c.toml', "b.toml:1:a\nc.toml:2:b\n") == [],
         "15. deux producteurs non bornés : on ne sait pas où l'un finit — rien")

# ── 16. Un segment INCONNU n'emporte plus la commande : il se borne par ses `echo` ──
# Mesuré le 03/10/2026 : 21 457 commandes sur 30 904 étaient « non analysables », le plus
# souvent pour un `ls`, un `node x.mjs`, un `wc -l` au milieu de lectures séparées par des
# `echo "=== … ==="`. Le programme inconnu emporte SON groupe, pas les autres.
cmd = 'ls scripts; echo "=== a ==="; sed -n 2,3p a.lua; echo "=== fin ==="; node x.mjs 2>&1 | tail -3'
verifier(lectures(cmd, "f1\nf2\n=== a ===\nl2\nl3\n=== fin ===\nn1\nn2\n") == [L("a.lua", [(2, "l2"), (3, "l3")])],
         "16. lecture bornée par deux `echo`, entre deux programmes inconnus : alignée")
verifier(lectures(cmd, "f1\n=== a ===\nf2\n=== a ===\nl2\nl3\n=== fin ===\nn1\n") == [],
         "16. le programme inconnu écrit lui-même le texte d'un séparateur : rien")
verifier(lectures('ls; echo ---; sed -n 2,3p a.lua', "f1\n---\nl2\nl3\n") == [L("a.lua", [(2, "l2"), (3, "l3")])],
         "16. après un inconnu, en fin de sortie, une plage PLEINE : alignée")
verifier(lectures('ls; echo ---; sed -n 2,9p a.lua', "f1\n---\nl2\nl3\n") == [L("a.lua", [(2, "l2"), (3, "l3")])],
         "16. … une plage courte en fin de sortie : bornée à gauche par l'`echo`, ses positions sont sûres")
verifier(lectures('ls; echo ---; grep -n l a.lua', "f1\n---\n2:l2\n3:l3\n") == [L("a.lua", [(2, "l2"), (3, "l3")])],
         "16. … des lignes numérotées en fin de sortie : prises")
verifier(lectures('ls absent; echo ---; sed -n 2,3p a.lua', "ls: cannot access 'absent': No such file or directory\n---\nl2\nl3\n")
         == [L("a.lua", [(2, "l2"), (3, "l3")])],
         "16. la sortie d'erreur de l'inconnu reste dans SON groupe (l'outil entrelace dans l'ordre)")
verifier(lectures('sed -n 2,3p a.lua; echo ---; wc -l a.lua', "l2\nl3\n---\n9 a.lua\n") == [L("a.lua", [(2, "l2"), (3, "l3")], 0, 2)],
         "16. lecture AVANT l'inconnu, bornée par un `echo` : alignée")
verifier(analyser('pushd d; echo ---; sed -n 2,3p a.lua') is None and analyser('export X=1; sed -n 2,3p a.lua') is None
         and analyser('for f in a b; do sed -n 2,3p $f; done') is None and analyser('cd -; sed -n 2,3p a.lua') is None,
         "16. ce qui change l'état du shell (pushd, export, for, cd -) : la commande entière reste écartée")
verifier(analyser('X=1 node y.mjs; echo ---; sed -n 2,3p a.lua') == [("inconnu",), ("echo", "---"), ("pos", "a.lua", "", 2, 3)]
         and analyser('LC_ALL=C grep -n x a.lua') == [("num", "a.lua", "", None)],
         "16. `NOM=valeur programme` : la variable ne vaut que pour lui — le programme est lu comme tel")
verifier(analyser('grep -c x a.lua; cat a.lua b.lua; head -c 10 a.lua') == [("inconnu",)] * 3,
         "16. formes non reconnues de grep, cat, head : des segments inconnus, plus des refus")

verifier(lectures('grep -rn "max" src/ui/index.js | head -20', "279:\tconst max = 5;\n320:\tfor (;;) {}\n")
         == [L("src/ui/index.js", [(279, "\tconst max = 5;"), (320, "\tfor (;;) {}")])]
         and analyser('grep -rn "max" src/ui') == [("num", None, "", None)],
         "16. `grep -rn` sur UN fichier : pas de nom en tête de ligne ; sur un dossier : si")

# ── 17. `$(…)` et accents graves : une valeur INSOLUBLE, plus une commande illisible ──
# 1 181 commandes du projet lisaient des fichiers et n'étaient écartées que pour un `F=$(…)`.
cmd = 'F=$(grep -rl "x" src | head -1); echo "F=$F"; echo ---; sed -n 2,3p a.lua; echo ---; grep -n y "$F"'
verifier(analyser(cmd) == [("inconnu",), ("echo", "---"), ("pos", "a.lua", "", 2, 3), ("echo", "---"), ("inconnu",)]
         and lectures(cmd, "F=src/b.ts\n---\nl2\nl3\n---\n4:y\n") == [L("a.lua", [(2, "l2"), (3, "l3")])],
         "17. `F=$(…)` : la variable est inconnue, ce qui la cite aussi — le reste se lit")
verifier(analyser('F=a.lua; F=$(ls | head -1); sed -n 2,3p "$F"') == [("inconnu",)],
         "17. une valeur recalculée fait OUBLIER l'ancienne : `$F` ne désigne plus a.lua")
verifier(jetons('echo "n=$(wc -l < a.lua) (fin)"; cat `ls *.lua`') is not None
         and analyser('echo "n=$(wc -l < a.lua)"; echo ---; sed -n 2,3p a.lua') == [("inconnu",), ("echo", "---"), ("pos", "a.lua", "", 2, 3)],
         "17. substitution dans des guillemets, parenthèses dans le texte, accents graves : découpés")
verifier(jetons('X=$(cat <<EOF\n)\nEOF\n); sed -n 2,3p a.lua') is None and jetons('echo $(ls') is None
         and jetons("X=$(echo ')'); echo ok") is not None,
         "17. substitution porteuse d'un heredoc, ou non fermée : la commande reste écartée ; une parenthèse entre apostrophes ne ferme rien")
verifier(executions('F=$(ls | head -1); python outils/corrige.py "$F"; node scripts/x.mjs a')
         == [("node", None, "scripts/x.mjs", ["a"], "", "fichier")],
         "17. actions : le segment à l'argument insoluble n'est pas une exécution connue, le suivant si")
cmd = 'D=$(pwd); cat > a.lua <<\'A\'\nlocal a\nA\nF=$(ls); cat > "$F" <<\'B\'\nx\nB'
verifier(ecritures_h(cmd) == [(("a.lua", ""), "local a\n")],
         "17. heredoc : écrit dans un fichier nommé — pas dans celui que nomme une valeur insoluble")

print(f"commandes : {reussis} assertion(s) reussie(s), {echecs} echec(s)")
sys.exit(1 if echecs or not reussis else 0)
