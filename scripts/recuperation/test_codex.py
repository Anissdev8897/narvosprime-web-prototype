# -*- coding: utf-8 -*-
"""
test_codex.py — preuves de la lecture des sessions Codex (« Astra ») : codex.py, et les
deux gestes du cœur qu'elles demandent (modification sans position, suppression).

  python scripts/recuperation/test_codex.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from codex import (litteral_js, appels, operations_patch, analyser_powershell,  # noqa: E402
                   lectures_powershell)
from reconstitution import Reconstitution  # noqa: E402

reussis = echecs = 0
AS = chr(92)                 # un antislash, sans passer par les échappements


def verifier(condition, nom):
    global reussis, echecs
    if condition:
        reussis += 1
    else:
        echecs += 1
        print("ECHEC :", nom)


# ── 1. Chaînes et appels JavaScript ──────────────────────────────────────────
verifier(litteral_js('"a' + AS + 'nb' + AS + '"c' + AS + AS + 'd" suite', 0) == ('a\nb"c' + AS + 'd', 12),
         "1. échappements usuels d'une chaîne JS")
verifier(litteral_js('"caf' + AS + 'u00e9 ' + AS + 'x41"', 0)[0] == "café A", "1. \\u00e9 et \\x41")
verifier(litteral_js('"' + AS + 'uD83D' + AS + 'uDE00"', 0)[0] == "\U0001F600", "1. paire de substitution recollée")
verifier(litteral_js("`a ${x} b`", 0)[0] is None and litteral_js('"sans fin', 0)[0] is None,
         "1. gabarit dynamique ou chaîne ouverte : illisible")
code = ('text(await tools.exec_command({cmd:"Get-Content ' + "'D:/p/a.lua'" + ' -TotalCount 3",max_output_tokens:500,'
        'workdir:"D:/p"}));\n'
        'text(await tools.apply_patch("*** Begin Patch' + AS + 'n*** Add File: D:/p/b.lua' + AS + 'n+local x' + AS
        + 'n*** End Patch"));\nconst r = await tools.mcp__node_repl__js({code:"x"});')
liste = appels(code)
verifier([n for n, _ in liste] == ["exec_command", "apply_patch", "mcp__node_repl__js"], "1. appels dans l'ordre")
verifier(liste[0][1] == {"cmd": "Get-Content 'D:/p/a.lua' -TotalCount 3", "max_output_tokens": "500", "workdir": "D:/p"},
         "1. objet de exec_command lu")
verifier(liste[1][1] == "*** Begin Patch\n*** Add File: D:/p/b.lua\n+local x\n*** End Patch" and liste[2][1] is None,
         "1. chaîne du patch décodée ; appel sans intérêt : None")

# ── 2. Les patchs ────────────────────────────────────────────────────────────
patch = "\n".join([
    "*** Begin Patch",
    "*** Add File: docs/NOTE.md",
    "+# Titre",
    "+",
    "+corps",
    "*** Update File: src/a.lua",
    "@@ local function f()",
    " local x = 1",
    "-return x",
    "+return x + 1",
    "",
    " -- suite",
    "@@",
    "-vieux()",
    "*** Delete File: src/vieux.lua",
    "*** Update File: src/b.lua",
    "@@ local M = {}",
    "+M.neuf = true",
    "*** End Patch",
    "",
])
ops = operations_patch(patch)
verifier(ops[0] == ("ajouter", "docs/NOTE.md", "# Titre\n\ncorps\n"), "2. Add File : contenu complet")
verifier(ops[1] == ("modifier", "src/a.lua", [("local x = 1\nreturn x\n\n-- suite", "local x = 1\nreturn x + 1\n\n-- suite"),
                                              ("vieux()", "")]),
         "2. Update File : contexte + retraits / contexte + ajouts ; ligne vide de contexte gardée")
verifier(ops[2] == ("supprimer", "src/vieux.lua"), "2. Delete File")
verifier(ops[3] == ("modifier", "src/b.lua", [("local M = {}", "local M = {}\nM.neuf = true")]),
         "2. ajout pur : posé après la ligne d'en-tête du morceau ; vide final ignoré")

# ── 3. PowerShell : ce qu'une commande a lu ──────────────────────────────────
P = lectures_powershell
verifier(P("Get-Content -LiteralPath 'D:/p/a.lua'", "\r\n  x = 1\r\n\r\ny = 2\r\n")
         == [(("D:/p/a.lua", ""), [(1, ""), (2, "  x = 1"), (3, ""), (4, "y = 2")], 4, None)],
         "3. Get-Content : fichier entier, lignes vides de tête gardées (sortie non rognée), longueur connue")
verifier(P("Get-Content 'a.lua' -TotalCount 3", "l1\r\nl2\r\nl3\r\n", "D:/p") == [(("a.lua", "D:/p"), [(1, "l1"), (2, "l2"), (3, "l3")], 0, None)],
         "3. -TotalCount N : les N premières, longueur inconnue")
verifier(P("Get-Content 'a.lua' -TotalCount 9", "l1\r\nl2\r\n") == [(("a.lua", ""), [(1, "l1"), (2, "l2")], 2, None)],
         "3. moins de lignes que demandé : fin du fichier prouvée")
verifier(P("Get-Content 'a.lua' | Select-Object -Skip 10 -First 2", "l11\r\nl12\r\n")
         == [(("a.lua", ""), [(11, "l11"), (12, "l12")], 0, None)], "3. Select-Object -Skip/-First : une plage")
verifier(P("Get-Content 'a.lua' -Tail 5", "x\r\n") == [] and P("Get-Content 'a.lua' | Select-Object -Last 5", "x") == [],
         "3. -Tail / -Last : positions inconnues")
verifier(P("Get-Content 'a.lua' -TotalCount 2; Get-Content 'j.log' -Tail 3; rg -n x 'b.lua' | Select-Object -First 2",
           "a1\r\na2\r\nj1\r\nj2\r\nj3\r\n4:x\r\n9:x\r\n")
         == [(("a.lua", ""), [(1, "a1"), (2, "a2")], 0, None), (("b.lua", ""), [(4, "x"), (9, "x")], 0, None)],
         "3. un `-Tail K` au milieu se COMPTE : la sortie atteint tous les maxima, la coupe est certaine")
verifier(P("Get-Content 'a.lua' -TotalCount 2; Get-Content 'j.log' -Tail 3; rg -n x 'b.lua' | Select-Object -First 2",
           "a1\r\na2\r\nj1\r\nj2\r\n4:x\r\n9:x\r\n") == [], "3. … mais pas si l'un d'eux a été court")
verifier(P("$p='D:/p/a.lua'; Get-Content $p -TotalCount 1", "l1\r\n") == [(("D:/p/a.lua", ""), [(1, "l1")], 0, None)],
         "3. affectation sans espaces : `$p='…'`")
deux = ("Warning: truncated output (original token count: 9000)\nTotal output lines: 7\n\n"
        "a1\na2\na3 cou…50 tokens truncated…pé b2\nb3\n")
verifier(P("Get-Content 'a.lua' -TotalCount 4; Get-Content 'b.lua' -TotalCount 3", deux)
         == [(("a.lua", ""), [(1, "a1"), (2, "a2")], 0, None), (("b.lua", ""), [(3, "b3")], 0, None)],
         "3. deux lectures pleines, sortie tronquée au milieu : le total annoncé (7 = 4 + 3) place les deux bouts")
verifier(P("Get-Content 'a.lua' -TotalCount 4; Get-Content 'b.lua' -TotalCount 9", deux) == [],
         "3. total annoncé inférieur à la somme : une lecture a été courte, rien n'est pris")
verifier(P("$p = 'D:/p/a.lua'; Get-Content -LiteralPath $p -TotalCount 1", "l1\r\n")
         == [(("D:/p/a.lua", ""), [(1, "l1")], 0, None)], "3. variable posée dans la commande")
verifier(P("rg -n 'local' 'D:/p/a.lua' | Select-Object -First 5", "3:local x\r\n17:  local y\r\n")
         == [(("D:/p/a.lua", ""), [(3, "local x"), (17, "  local y")], 0, None)], "3. rg -n sur un fichier")
verifier(P("rg -n 'x' 'D:/p/src' -g '*.lua'", "D:/p/src" + AS + "a.lua:3:x\r\nD:/p/src" + AS + "b.lua:5:  x\r\n")
         == [(("D:/p/src" + AS + "a.lua", ""), [(3, "x")], 0, None), (("D:/p/src" + AS + "b.lua", ""), [(5, "  x")], 0, None)],
         "3. rg -n sur un dossier : chaque ligne porte son fichier")
verifier(P("rg 'x' a.lua", "x") == [] and P("rg -n --files a", "a") == [] and P("rg -no 'x' a.lua", "3:x") == [],
         "3. rg sans -n, --files, -o : écartés")
verifier(P("Get-Content 'a.lua'; Get-Content 'b.lua'", "a1\r\nb1\r\n") == [], "3. deux fichiers entiers à la suite : frontière inconnue")
verifier(P("Get-Content 'a.lua' -TotalCount 2; Get-Content 'b.lua' -TotalCount 1", "a1\r\na2\r\nb1\r\n")
         == [(("a.lua", ""), [(1, "a1"), (2, "a2")], 0, None), (("b.lua", ""), [(1, "b1")], 0, None)],
         "3. deux plages qui se comptent")
verifier(P("Get-Content 'a.lua'", "Get-Content : Cannot find path 'a.lua'\r\n    + CategoryInfo : ObjectNotFound") == [],
         "3. message d'erreur PowerShell : jamais pris pour un contenu")
verifier(P("(Get-Content 'a.lua').Count", "12") == [] and P("Get-Content 'a.lua' | ForEach-Object { $_ }", "x") == [],
         "3. parenthèses, blocs : écartés")
tronquee = ("Warning: truncated output (original token count: 9000)\nTotal output lines: 400\n\n"
            "l1\nl2\nl3 coup…120 tokens truncated…ée l398\nl399\nl400\n")
verifier(P("Get-Content 'a.lua'", tronquee)
         == [(("a.lua", ""), [(1, "l1"), (2, "l2"), (399, "l399"), (400, "l400")], 400, None)],
         "3. fichier entier, sortie tronquée : les deux bouts à leur place, longueur = total annoncé")
verifier(P("rg -n 'l' a.lua", tronquee.replace("l1\nl2\nl3 coup", "1:l1\n2:l2\n3:l3 coup").replace("l399\nl400", "399:l399\n400:l400"))
         == [(("a.lua", ""), [(1, "l1"), (2, "l2"), (399, "l399"), (400, "l400")], 0, None)],
         "3. lignes numérotées : valables des deux côtés de la coupure")

# ── 4. Modification sans position : appliquée là où le bloc se reconnaît ─────
r = Reconstitution()
r.lire([(10, "local x = 1"), (11, "return x"), (12, ""), (13, "-- suite"), (30, "fin de fichier")], 30)
r.remplacer("local x = 1\nreturn x\n\n-- suite", "local x = 1\nlocal y = 2\nreturn x + y\n\n-- suite", False, True)
verifier(r.epoques == 1 and r.carte[11] == "local y = 2" and r.carte[12] == "return x + y" and r.carte[31] == "fin de fichier"
         and r.total == 31 and not r.attente,
         "4. fichier troué : le bloc reconnu est remplacé, la suite décalée, l'époque tenue")
r.remplacer("local y = 2", "", False, True)
verifier(r.carte[11] == "return x + y" and r.total == 30 and r.carte[30] == "fin de fichier",
         "4. retrait de lignes entières : pas de ligne vide laissée à la place")
r.remplacer("absent du fichier connu", "x", False, True)
verifier(len(r.attente) == 1 and r.epoques == 1, "4. bloc introuvable, même nombre de lignes : en attente, l'époque tient")
r.remplacer("absent aussi", "x\ny\nz", False, True)
verifier(r.attente == [] and len(r.anciennes[0][2]) == 2 and r.epoques == 2 and not r.carte,
         "4. bloc introuvable ET nombre de lignes changé : l'époque est close, les modifications partent avec elle")
texte, bilan = r.assembler()
verifier("local x = 1" in texte and "return x + y" in texte and bilan["modifs_perdues"] == 2,
         "4. … ses lignes ne sont pas perdues : elles reviennent par leur contenu ; les deux modifications sont comptées")

# ── 6. Une modification en attente s'applique à l'époque où elle a eu lieu, COMPLÉTÉE ──
complet = [f"ligne_{i:02d} = valeur_{i:02d}  -- contenu d'origine" for i in range(1, 41)]
r = Reconstitution()
r.ecrire("\n".join(complet))                                        # version entière
r.lire([(5, complet[4]), (30, complet[30])], 0)                     # une ligne a disparu plus haut : nouvelle époque, 2 lignes
verifier(r.epoques == 2 and len(r.carte) == 2, "6. époque clairsemée ouverte")
# Astra modifie un bloc que cette époque ne tient pas (lignes 12-13 d'origine), en y ajoutant une ligne.
r.remplacer(complet[11] + "\n" + complet[12], complet[11] + "\nligne_ajoutee_par_astra()\n" + complet[12], False, True)
verifier(r.epoques == 3 and len(r.anciennes[0][2]) == 1, "6. introuvable dans l'époque clairsemée : en attente, époque close")
r.lire([(8, complet[7]), (38, "derniere_lecture()")], 0)             # lectures d'après
texte, bilan = r.assembler()
lignes = texte.split("\n")
k = lignes.index(complet[11])
verifier(lignes[k + 1] == "ligne_ajoutee_par_astra()" and lignes[k + 2] == complet[12] and bilan["modifs_perdues"] == 0
         and bilan["modifs_placees"] == 1,
         "6. la modification est retrouvée dans le texte final : placée sur la version complétée par les précédentes")
r = Reconstitution()
r.lire([(1, "a = f(1)"), (2, "b = f(2)")], 2)
r.remplacer("f(", "g(", False)
verifier(r.carte[1] == "a = f(1)" and len(r.attente) == 1, "4. deux occurrences sans `replace_all` : en attente")
r.remplacer("f(", "g(", True)
verifier(r.carte == {1: "a = g(1)", 2: "b = g(2)"}, "4. `replace_all` : toutes les occurrences connues")
r = Reconstitution()
r.lire([(1, "titre"), (2, "mot à retirer ici"), (3, "fin")], 3)
r.remplacer("mot à retirer ici", "", False)
verifier(r.carte == {1: "titre", 2: "", 3: "fin"} and r.total == 3,
         "4. outil à texte libre (pas de lignes entières) : la ligne reste, vide")

# ── 5. Suppression ───────────────────────────────────────────────────────────
r = Reconstitution()
r.ecrire("a\nb\n")
r.supprimer()
texte, bilan = r.assembler()
verifier(texte is None and bilan["supprime"] == 1, "5. dernier événement = suppression : le fichier n'est pas rendu")
r.ecrire("c\n")
texte, bilan = r.assembler()
verifier(texte == "c" and r.epoques == 2, "5. recréé ensuite : c'est une autre version")

# ── 7. PowerShell : une chaîne littérale versée dans un fichier ───────────────
import json  # noqa: E402
import sqlite3  # noqa: E402
import tempfile  # noqa: E402
from codex import ecritures_powershell, evenements_base, fenetres_base  # noqa: E402
from reconstitution import hunks_depuis_diff  # noqa: E402

E = ecritures_powershell
suite = "@'\n## Suite du 15 septembre\n- lot5 cuit\n'@ | Add-Content -LiteralPath '.hermes/REPRISE.md' -Encoding utf8; Get-Content x -Tail 3"
verifier(E(suite, "D:/p") == [("ajouter", ".hermes/REPRISE.md", "D:/p", "## Suite du 15 septembre\n- lot5 cuit")],
         "7. `@'…'@ | Add-Content` : le texte ajouté, tel quel")
verifier(E("@'\r\nlocal x = 1\r\n'@ | Set-Content -LiteralPath 'D:/p/a.lua' -Encoding UTF8")
         == [("ecrire", "D:/p/a.lua", "", "local x = 1")], "7. `Set-Content` : le fichier entier (fins de ligne ramenées à LF)")
verifier(E('Set-Location "D:' + AS + 'p' + AS + "WebPortal\"; @'\nimport x\n'@ | Out-File -Encoding utf8 scripts/_s.mjs; node scripts/_s.mjs", "C:/")
         == [("ecrire", "scripts/_s.mjs", "D:" + AS + "p" + AS + "WebPortal", "import x")],
         "7. `Out-File` après un `Set-Location` : le chemin relatif part du nouveau dossier")
verifier(E("@'\nx\n'@ | Out-File -Append -FilePath 'j.log'") == [("ajouter", "j.log", "", "x")], "7. `Out-File -Append` ajoute")
verifier(E("@'\nx\n'@ | Set-Content -LiteralPath \"$racine" + AS + "Package.toml\"") == []
         and E('@"\n$x\n"@ | Set-Content a.txt') == [] and E("Get-Content a | Set-Content b") == [],
         "7. chemin à variable, chaîne à variables, contenu venu d'une commande : rien")

# ── 8. La base d'historique de Codex : diffs positionnés, commandes résolues ──
dossier_tmp = tempfile.mkdtemp(prefix="narvos-codex-")
base = os.path.join(dossier_tmp, "thread_history_1.sqlite")
c = sqlite3.connect(base)
c.execute("create table thread_items (thread_id text, turn_id text, item_id text, rollout_ordinal integer, "
          "created_at_ms integer, item_json text, item_type text)")


def element(ms, genre, **champs):
    c.execute("insert into thread_items values ('fil-1', 't', ?, ?, ?, ?, ?)",
              (str(ms), ms, ms, json.dumps(dict(champs, type=genre)), genre))


element(1000_000, "fileChange", status="completed", changes=[
    {"path": "D:" + AS + "p" + AS + "a.lua", "kind": {"type": "add"}, "diff": "local a = 1\nlocal b = 2\nreturn a\n"}])
element(1002_000, "fileChange", status="completed", changes=[
    {"path": "D:" + AS + "p" + AS + "a.lua", "kind": {"type": "update", "move_path": None},
     "diff": "@@ -1,3 +1,4 @@\n local a = 1\n-local b = 2\n+local b = 20\n+-- ajout\n return a\n"}])
element(1003_000, "fileChange", status="failed", changes=[
    {"path": "D:" + AS + "p" + AS + "a.lua", "kind": {"type": "add"}, "diff": "jamais écrit\n"}])
element(1004_000, "commandExecution", status="completed", exitCode=0, cwd="D:" + AS + "p",
        command='"pwsh.exe" -Command "Get-Content a.lua -TotalCount 2"', aggregatedOutput="local a = 1\r\nlocal b = 20\r\n",
        commandActions=[{"type": "unknown", "command": "Get-Content 'a.lua' -TotalCount 2"}])
element(1005_000, "commandExecution", status="completed", exitCode=0, cwd="D:" + AS + "p", command="…", aggregatedOutput="",
        commandActions=[{"type": "unknown", "command": "@'\n## suite\n'@ | Add-Content -LiteralPath 'NOTES.md'"}])
element(1006_000, "commandExecution", status="failed", exitCode=1, cwd="D:" + AS + "p", command="…", aggregatedOutput="",
        commandActions=[{"type": "unknown", "command": "@'\nrefusé\n'@ | Set-Content -LiteralPath 'NOTES.md'"}])
c.commit()
c.close()
evts = list(evenements_base(base))
verifier([(t, g) for t, g, _, _, _ in evts] == [(1000.0, "ecrire"), (1002.0, "diff"), (1004.0, "lire"), (1005.0, "ajouter")],
         "8. ajout, modification, lecture, ajout en fin — dans l'ordre ; ce qui a échoué n'est pas rendu")
verifier(evts[0][4] == "local a = 1\nlocal b = 2\nreturn a\n" and evts[2][4] == ([(1, "local a = 1"), (2, "local b = 20")], 0, None)
         and evts[3][2:] == ("NOTES.md", ["D:" + AS + "p"], "## suite"),
         "8. un ajout porte le fichier entier ; la commande est celle, résolue, de `commandActions`")
r = Reconstitution()
r.ecrire(evts[0][4])
r.modifier(hunks_depuis_diff(evts[1][4]))
verifier(r.epoques == 1 and [r.carte[i] for i in range(1, 5)] == ["local a = 1", "local b = 20", "-- ajout", "return a"],
         "8. le diff de la base est POSITIONNÉ : la modification tombe à sa ligne, sans rien chercher")
verifier(fenetres_base(base) == [(1000.0 - 2.0, 1006.0 + 2.0)] and fenetres_base(os.path.join(dossier_tmp, "absente.sqlite")) == []
         and list(evenements_base(os.path.join(dossier_tmp, "absente.sqlite"))) == [],
         "8. la fenêtre couverte par la base ; base absente : rien, sans erreur")
import shutil  # noqa: E402
shutil.rmtree(dossier_tmp, ignore_errors=True)

print(f"codex : {reussis} assertion(s) reussie(s), {echecs} echec(s)")
sys.exit(1 if echecs or not reussis else 0)
