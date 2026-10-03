# -*- coding: utf-8 -*-
"""
test_bac.py — preuves du bac à sable (bac.py, bac_python.py, bac_node.js) : un script
d'historique y tourne sans rien toucher de réel, et rend la modification exacte.

  python scripts/recuperation/test_bac.py
"""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bac  # noqa: E402

reussis = echecs = 0
AS = chr(92)


def verifier(condition, nom):
    global reussis, echecs
    if condition:
        reussis += 1
    else:
        echecs += 1
        print("ECHEC :", nom)


RACINE = "D:/mes_projet/narvosprime-web-prototype"
CONNUS = ["WebPortal" + AS + "a.lua", "WebPortal" + AS + "ui" + AS + "index.js", "scripts" + AS + "x.mjs"]


def monde(fichiers):
    demandes = []

    def fournir(cle):
        demandes.append(cle)
        return fichiers.get(cle)
    return fournir, demandes


# ── 1. Python : remplacement exact sur un fichier entier ─────────────────────
lua = "local a = 1\nlocal b = 2\nreturn a + b\n"
fournir, demandes = monde({"p:webportal" + AS + "a.lua": lua})
code = '''import io
p = "WebPortal/a.lua"
s = io.open(p, encoding="utf-8").read()
ancien = "local b = 2"
assert s.count(ancien) == 1
s = s.replace(ancien, "local b = 3\\nlocal c = 4")
io.open(p, "w", encoding="utf-8").write(s)
print("fait")
'''
r = bac.executer("python", code, [], RACINE, fournir, CONNUS)
verifier(r["ok"] and r["ecrits"] == {"p:webportal" + AS + "a.lua": "local a = 1\nlocal b = 3\nlocal c = 4\nreturn a + b\n"},
         "1. python : la modification est rendue, rien d'autre")
verifier(demandes == ["p:webportal" + AS + "a.lua"], "1. le fichier est demandé par sa clé de projet")
verifier(not os.path.exists(os.path.join(RACINE, "WebPortal", "a.lua")), "1. aucun fichier réel n'est créé")

# ── 2. Fichier troué : les témoins voyagent avec la modification ─────────────
carte = {1: "local a = 1", 2: "local b = 2", 5: "return a + b"}
virtuel = bac.texte_virtuel(carte, 6)
fournir, _ = monde({"p:webportal" + AS + "a.lua": virtuel})
r = bac.executer("python", code, [], RACINE, fournir, CONNUS)
lignes, fin = bac.relire(r["ecrits"]["p:webportal" + AS + "a.lua"])
verifier(r["ok"] and lignes == ["local a = 1", "local b = 3", "local c = 4", None, None, "return a + b", None] and fin,
         "2. les lignes inconnues restent inconnues, DÉCALÉES d'une ligne comme le reste")
verifier(bac.relire(bac.texte_virtuel({2: "x"}, None)) == ([None, "x"], False), "2. fin ouverte : dite au retour")

# ── 3. Ancre ABSENTE d'un fichier entier : le script échoue, comme il aurait échoué ──
# (Dans un fichier troué, l'ancre peut être dans un trou : voir le cas 11.)
fournir, _ = monde({"p:webportal" + AS + "a.lua": "local a = 1\nreturn a\n"})
r = bac.executer("python", code, [], RACINE, fournir, CONNUS)
verifier(not r["ok"] and "AssertionError" in r["erreur"] and not r["ecrits"], "3. assertion du script : échec, rien d'écrit")

# ── 4. Chemins : absolus, MSYS, relatifs après chdir, pathlib, arguments ─────
fournir, demandes = monde({"p:webportal" + AS + "ui" + AS + "index.js": "a\n", "p:webportal" + AS + "a.lua": "x\n"})
code4 = '''import os, sys, pathlib, glob
os.chdir("/d/mes_projet/narvosprime-web-prototype/WebPortal")
t = open(sys.argv[1]).read()
pathlib.Path("ui/index.js").write_text(t + "b\\n", encoding="utf-8")
assert os.path.exists("a.lua") and not os.path.exists("absent.lua")
assert sorted(os.listdir(".")) == ["a.lua", "ui"], os.listdir(".")
assert glob.glob("ui/*.js") == ["ui" + chr(92) + "index.js"], glob.glob("ui/*.js")
os.remove("a.lua")
'''
r = bac.executer("python", code4, ["D:" + AS + "mes_projet" + AS + "narvosprime-web-prototype" + AS + "WebPortal" + AS + "ui" + AS + "index.js"],
                 "C:/ailleurs", fournir, CONNUS)
verifier(r["ok"] and r["ecrits"] == {"p:webportal" + AS + "ui" + AS + "index.js": "a\nb\n", "p:webportal" + AS + "a.lua": None},
         "4. chdir, argument absolu, pathlib, listdir, glob, suppression : tout est virtuel  " + r["erreur"])

# ── 5. Rien ne sort du bac ───────────────────────────────────────────────────
temoin_reel = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_bac_temoin.txt")
code5 = '''import subprocess, os, shutil
open(r"%s", "w").write("fuite")
subprocess.run(["cmd", "/c", "echo fuite > %s"], shell=True)
os.system("echo fuite")
shutil.rmtree("C:/Windows/Temp/inexistant")
try:
    import socket
    raise SystemExit("le réseau est joignable")
except ImportError:
    pass
''' % (temoin_reel, temoin_reel.replace(AS, "/"))
fournir, _ = monde({})
r = bac.executer("python", code5, [], RACINE, fournir, CONNUS)
verifier(r["ok"] and not os.path.exists(temoin_reel), "5. écriture réelle, sous-processus, réseau : inertes  " + r["erreur"])
verifier(list(r["ecrits"].values()) == ["fuite"], "5. l'écriture hors projet est captée, pas faite")

# ── 6. Un fichier hors projet que personne ne fournit n'existe pas ───────────
fournir, demandes = monde({})
r = bac.executer("python", "import json\njson.load(open('C:/Users/aniss/scratch/donnees.json'))", [], RACINE, fournir, CONNUS)
verifier(not r["ok"] and "FileNotFoundError" in r["erreur"] and demandes == ["h:c:" + AS + "users" + AS + "aniss" + AS + "scratch" + AS + "donnees.json"],
         "6. fichier hors projet inconnu : FileNotFoundError, comme sur un disque vide")

if shutil.which("node"):
    # ── 7. Node : require("fs"), import, chemins ─────────────────────────────
    js = '''const fs = require("fs");
const path = require("path");
const f = path.join(process.argv[2], "a.lua");
let s = fs.readFileSync(f, "utf8");
if (!s.includes("local b = 2")) throw new Error("ancre absente");
s = s.replace("local b = 2", "local b = 3");
fs.writeFileSync(f, s);
console.log("fait");
'''
    fournir, demandes = monde({"p:webportal" + AS + "a.lua": lua})
    r = bac.executer("node", js, ["WebPortal"], RACINE, fournir, CONNUS)
    verifier(r["ok"] and r["ecrits"] == {"p:webportal" + AS + "a.lua": "local a = 1\nlocal b = 3\nreturn a + b\n"},
             "7. node (CommonJS) : la modification est rendue  " + r["erreur"])
    esm = '''import fs from "node:fs";
import { readFileSync, writeFileSync } from "fs";
import * as path from "node:path";
const f = "D:/mes_projet/narvosprime-web-prototype/WebPortal/a.lua";
const s = readFileSync(f, "utf8").split("\\n");
s.splice(1, 0, "-- ajout");
writeFileSync(f, s.join("\\n"));
if (!fs.existsSync(path.dirname(f) + "/ui/index.js")) throw new Error("existsSync");
'''
    fournir, _ = monde({"p:webportal" + AS + "a.lua": lua, "p:webportal" + AS + "ui" + AS + "index.js": "x"})
    r = bac.executer("node", esm, [], "C:/", fournir, CONNUS)
    verifier(r["ok"] and r["ecrits"] == {"p:webportal" + AS + "a.lua": "local a = 1\n-- ajout\nlocal b = 2\nreturn a + b\n"},
             "7. node (import … from) : modules fs et path, existsSync  " + r["erreur"])
    fournir, _ = monde({})
    r = bac.executer("node", 'require("child_process").execSync("echo fuite > %s"); require("fs").writeFileSync("%s", "x")'
                     % (temoin_reel.replace(AS, "/"), temoin_reel.replace(AS, "/")), [], RACINE, fournir, CONNUS)
    verifier(not os.path.exists(temoin_reel), "7. node : sous-processus et écriture réelle inertes")
    # ── 9. Node : un script ESM qui redéclare `require`/`__dirname`, et argv selon le mode ──
    esm9 = '''import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fs = require("fs");
fs.writeFileSync(path.join(__dirname, "..", "WebPortal", "a.lua"), process.argv.slice(1).join("|"));
'''
    fournir, _ = monde({})
    r = bac.executer("node", esm9, ["x", "y"], RACINE, fournir, CONNUS, RACINE + "/scripts/x.mjs", "fichier")
    verifier(r["ok"] and list(r["ecrits"].values()) == ["D:" + AS + "mes_projet" + AS + "narvosprime-web-prototype" + AS
                                                        + "scripts" + AS + "x.mjs|x|y"],
             "9. node : `const require = createRequire(…)` ne heurte pas le bac ; argv d'un fichier  " + r["erreur"])
    r = bac.executer("node", 'require("fs").writeFileSync("WebPortal/a.lua", process.argv.slice(1).join("|"))',
                     ["x", "y"], RACINE, fournir, CONNUS, None, "arg")
    verifier(r["ok"] and list(r["ecrits"].values()) == ["x|y"], "9. node -e CODE x y : argv = [node, x, y]  " + r["erreur"])
else:
    print("(node absent : cas 7 et 9 sautés)")

# ── 8. Python : argv selon la façon dont le code est venu, sortie reconfigurable ──
code8 = '''import sys
sys.stdout.reconfigure(encoding="utf-8")
open("WebPortal/a.lua", "w").write("|".join(sys.argv))
'''
fournir, _ = monde({})
r = bac.executer("python", code8, ["x"], RACINE, fournir, CONNUS, None, "arg")
verifier(r["ok"] and list(r["ecrits"].values()) == ["-c|x"], "8. python -c CODE x : argv = [-c, x]  " + r["erreur"])
r = bac.executer("python", code8, ["x"], RACINE, fournir, CONNUS, None, "entree")
verifier(r["ok"] and list(r["ecrits"].values()) == ["-|x"], "8. python - x <<FIN : argv = [-, x]  " + r["erreur"])

# ── 10. Un script qui balaie un dossier : le lot est donné d'un coup ──────────
nombreux = ["WebPortal" + AS + "lot" + AS + f"f{i:02}.lua" for i in range(40)]
contenus = {"p:" + c.lower(): f"-- {i}\n" for i, c in enumerate(nombreux)}
fournir, demandes = monde(contenus)
code10 = '''import glob
total = 0
for f in sorted(glob.glob("WebPortal/lot/*.lua")):
    total += len(open(f).read())
open("WebPortal/lot/somme.txt", "w").write(str(total))
'''
anciens_essais, bac.ESSAIS = bac.ESSAIS, 8
r = bac.executer("python", code10, [], RACINE, fournir, nombreux)
bac.ESSAIS = anciens_essais
verifier(r["ok"] and r["ecrits"] == {"p:webportal" + AS + "lot" + AS + "somme.txt": str(sum(len(v) for v in contenus.values()))},
         "10. quarante fichiers d'un dossier lus en moins de huit relances  " + r["erreur"])
verifier(len(set(demandes)) == 40, "10. chaque fichier du lot a été fourni")

# ── 11. Ancre dans une zone INCONNUE : la modification n'est pas perdue, elle ATTEND ──
# La commande avait réussi : la vérification du script est donc passée, sur le vrai
# fichier. Dans le bac, le passage cherché tombe dans un trou. Le bac retourne alors la
# DERNIÈRE vérification incertaine avant l'échec et relance : le remplacement, qu'il ne
# sait pas placer, ressort comme modification sans position (voir `bac.executer`).
CLE = "p:webportal" + AS + "a.lua"
troue = bac.texte_virtuel({1: "local a = 1", 5: "return a + b"}, 6)
ancien11, neuf11 = "local b = 2\nlocal c = 3", "local b = 20\nlocal c = 30\nlocal d = 40"
code11 = '''p = "WebPortal/a.lua"
s = open(p, encoding="utf-8").read()
ancien = "local b = 2\\nlocal c = 3"
neuf = "local b = 20\\nlocal c = 30\\nlocal d = 40"
if neuf in s:
    raise SystemExit(0)                      # déjà fait : ce test-là ne doit PAS être retourné
assert ancien in s, "ancre introuvable"
assert s.count(ancien) == 1
s = s.replace(ancien, neuf, 1)
open(p, "w", encoding="utf-8").write(s)
'''
fournir, _ = monde({CLE: troue})
r = bac.executer("python", code11, [], RACINE, fournir, CONNUS)
verifier(r["ok"] and r.get("attentes") == {CLE: [(ancien11, neuf11, False)]},
         "11. python : l'ancre inconnue devient une modification en attente  " + r["erreur"])
verifier(r["ok"] and bac.relire(r["ecrits"].get(CLE, "")) == (["local a = 1", None, None, None, "return a + b", None], True),
         "11. … et le fichier écrit est celui qu'on tenait, sans marque du bac")
# Un fichier ENTIER ne laisse aucun doute : l'ancre n'y est pas, le script échoue.
fournir, _ = monde({CLE: lua})
r = bac.executer("python", code11, [], RACINE, fournir, CONNUS)
verifier(not r["ok"] and "AssertionError" in r["erreur"] and not r.get("attentes"),
         "11. fichier entier : aucune indulgence, l'échec reste un échec")
# Un remplacement sans vérification, sur un fichier troué : présumé fait là où l'on ne voit pas.
code11b = '''import io
p = "WebPortal/a.lua"
s = io.open(p, encoding="utf-8").read().replace("\\r\\n", "\\n")
s = s.replace("Narvos.AncienNom", "Narvos.NouveauNom").replace("local a = 1", "local a = 100")
io.open(p, "w", encoding="utf-8").write(s)
'''
fournir, _ = monde({CLE: troue})
r = bac.executer("python", code11b, [], RACINE, fournir, CONNUS)
verifier(r["ok"] and r.get("attentes") == {CLE: [("Narvos.AncienNom", "Narvos.NouveauNom", True)]}
         and bac.relire(r["ecrits"][CLE])[0][0] == "local a = 100",
         "11. remplacement non vérifié : ce qui est connu est fait, le reste attend ; `\\r\\n` n'attend pas  " + r["erreur"])

if shutil.which("node"):
    js11 = '''const fs = require("fs");
const p = "WebPortal/a.lua";
let s = fs.readFileSync(p, "utf8");
const ancien = "local b = 2\\nlocal c = 3";
const neuf = "local b = 20\\nlocal c = 30\\nlocal d = 40";
if (s.includes(neuf)) process.exit(0);
if (!s.includes(ancien)) throw new Error("ancre introuvable");
s = s.replace(ancien, neuf);
fs.writeFileSync(p, s);
'''
    fournir, _ = monde({CLE: troue})
    r = bac.executer("node", js11, [], RACINE, fournir, CONNUS)
    verifier(r["ok"] and r.get("attentes") == {CLE: [(ancien11, neuf11, False)]}
             and bac.relire(r["ecrits"].get(CLE, "")) == (["local a = 1", None, None, None, "return a + b", None], True),
             "11. node : même indulgence (includes, replace)  " + r["erreur"])
    fournir, _ = monde({CLE: lua})
    r = bac.executer("node", js11, [], RACINE, fournir, CONNUS)
    verifier(not r["ok"] and "ancre introuvable" in r["erreur"], "11. node, fichier entier : l'échec reste un échec")

# ── 12. L'horloge du script est celle de sa commande, pas celle du rejeu ─────
# Mesuré le 02/10/2026 : `corps-morphable.json` rejoué portait "genere_le": "2026-10-02T21:27…",
# une date d'APRÈS la perte, et deux extractions de suite ne rendaient pas le même fichier.
import datetime  # noqa: E402
import json  # noqa: E402

INSTANT = 1789200000.25
UTC = datetime.datetime.fromtimestamp(INSTANT, datetime.timezone.utc)
code12 = '''import datetime, time, json
from datetime import datetime as dt
open("WebPortal/a.lua", "w").write(json.dumps([
    dt.now(datetime.timezone.utc).isoformat(), time.time(), time.strftime("%Y-%m-%d", time.gmtime()),
    datetime.date.today().isoformat(), datetime.datetime.utcnow().isoformat(), dt.now().isoformat(),
    isinstance(dt.now(), datetime.date), dt(2026, 1, 2).isoformat()]))
'''
fournir, _ = monde({CLE: lua})
r = bac.executer("python", code12, [], RACINE, fournir, CONNUS, instant=INSTANT)
verifier(r["ok"] and json.loads(r["ecrits"].get(CLE, "[]")) == [
    UTC.isoformat(), INSTANT, UTC.strftime("%Y-%m-%d"), datetime.date.fromtimestamp(INSTANT).isoformat(),
    UTC.replace(tzinfo=None).isoformat(), datetime.datetime.fromtimestamp(INSTANT).isoformat(), True, "2026-01-02T00:00:00"],
         "12. python : now, utcnow, today, time.time, strftime rendent l'instant de la commande  " + r["erreur"]
         + " " + str(r["ecrits"].get(CLE)))
if shutil.which("node"):
    js12 = '''const fs = require("fs");
fs.writeFileSync("WebPortal/a.lua", JSON.stringify([new Date().toISOString(), Date.now(), new Date(0).getTime(),
  typeof Date(), new Date() instanceof Date, Date.UTC(2026, 0, 1), new Date(2026, 0, 2, 3).getHours()]));
'''
    fournir, _ = monde({CLE: lua})
    r = bac.executer("node", js12, [], RACINE, fournir, CONNUS, instant=INSTANT)
    verifier(r["ok"] and json.loads(r["ecrits"].get(CLE, "[]")) == [
        UTC.strftime("%Y-%m-%dT%H:%M:%S.250Z"), 1789200000250, 0, "string", True, 1767225600000, 3],
             "12. node : `new Date()` et `Date.now()` rendent l'instant de la commande, le reste de Date est intact  "
             + r["erreur"] + " " + str(r["ecrits"].get(CLE)))

# ── 13. Réponses À L'AVEUGLE : ce que le bac ne peut pas savoir ──────────────
# Il ne tient que le TEXTE vu par les historiques. Un `.glb`, un `.uasset` y est toujours
# « absent », un dossier d'assets toujours vide : mesuré le 02/10/2026, `regression-report.json`
# rejoué disait « 22 assets manquants sur 22 », `trooper-squelettes.json` « lus : 0 ».
CLE_GLB = "p:webportal" + AS + "public" + AS + "models" + AS + "a.glb"
code13 = '''import os, json
present = os.path.exists("WebPortal/public/models/a.glb")
neuf = os.path.exists("WebPortal/rapport.json")
open("WebPortal/rapport.json", "w").write(json.dumps({"present": present, "neuf": neuf}))
'''
fournir, _ = monde({})
r = bac.executer("python", code13, [], RACINE, fournir, CONNUS)
verifier(r["ok"] and r.get("aveugles") == [CLE_GLB],
         "13. python : l'existence d'un binaire est une réponse à l'aveugle — signalée ; celle d'un texte, non  "
         + r["erreur"] + " " + str(r.get("aveugles")))
verifier(r.get("generes") == ["p:webportal" + AS + "rapport.json"],
         "13. python : un fichier écrit sans avoir été lu est GÉNÉRÉ  " + str(r.get("generes")))
code13b = '''import os, glob
noms = []
try:
    noms = os.listdir("WebPortal/Server/adk/Content/Narvos")
except FileNotFoundError:
    pass
vus = glob.glob("WebPortal/public/models/**/*.glb", recursive=True) + glob.glob("scripts/_tmp*.mjs")
open("WebPortal/a.lua", "w").write("-- %d %d" % (len(noms), len(vus)))
'''
fournir, _ = monde({CLE: lua})
r = bac.executer("python", code13b, [], RACINE, fournir, CONNUS)
verifier(r["ok"] and len(r.get("aveugles") or []) == 2 and r["aveugles"][0].endswith("narvos" + AS)
         and r["aveugles"][1].startswith("glob:") and r["aveugles"][1].endswith(".glb"),
         "13. python : dossier inconnu listé, motif de binaires sans résultat — signalés ; un motif de texte vide, non  "
         + r["erreur"] + " " + str(r.get("aveugles")))
code13c = '''p = "WebPortal/a.lua"
s = open(p).read()
open(p, "w").write(s.replace("local b = 2", "local b = 3"))
'''
fournir, _ = monde({CLE: lua})
r = bac.executer("python", code13c, [], RACINE, fournir, CONNUS)
verifier(r["ok"] and not r.get("aveugles") and not r.get("generes"),
         "13. python : un correctif ordinaire ne répond jamais à l'aveugle, et ne GÉNÈRE rien (il lit, puis réécrit)")
code13d = '''import os
vu = os.path.isdir("WebPortal/public/models") or os.path.exists("WebPortal/Server/Assets/narvos")
connu = os.path.isdir("WebPortal/ui")
with open("WebPortal/a.lua", "a") as f:
    f.write("-- %s %s" % (vu, connu))
'''
fournir, _ = monde({CLE: lua})
r = bac.executer("python", code13d, [], RACINE, fournir, CONNUS)
verifier(r["ok"] and len(r.get("aveugles") or []) == 2 and all(a.endswith(AS) for a in r["aveugles"])
         and not r.get("generes") and r["ecrits"][CLE].endswith("-- False True"),
         "13. python : un dossier dont on ne connaît aucun fichier — « absent » à l'aveugle ; un fichier prolongé n'est pas généré  "
         + r["erreur"] + " " + str(r.get("aveugles")) + str(r.get("generes")))
if shutil.which("node"):
    js13 = '''const fs = require("fs");
const present = fs.existsSync("WebPortal/public/models/a.glb");
let noms = [];
try { noms = fs.readdirSync("WebPortal/Server/adk/Content/Narvos"); } catch (e) {}
fs.writeFileSync("WebPortal/rapport.json", JSON.stringify({ present, n: noms.length, neuf: fs.existsSync("WebPortal/rapport.json") }));
'''
    fournir, _ = monde({})
    r = bac.executer("node", js13, [], RACINE, fournir, CONNUS)
    verifier(r["ok"] and len(r.get("aveugles") or []) == 2 and r["aveugles"][0] == CLE_GLB
             and r["aveugles"][1].endswith("narvos" + AS) and r.get("generes") == ["p:webportal" + AS + "rapport.json"],
             "13. node : mêmes signalements (existsSync d'un binaire, readdirSync d'un dossier inconnu), fichier généré  "
             + r["erreur"] + " " + str(r.get("aveugles")) + str(r.get("generes")))
    js13b = '''const fs = require("fs");
const vu = fs.existsSync("WebPortal/public/models");
let s = fs.readFileSync("WebPortal/a.lua", "utf8");
fs.writeFileSync("WebPortal/a.lua", s + "-- " + vu);
'''
    fournir, _ = monde({CLE: lua})
    r = bac.executer("node", js13b, [], RACINE, fournir, CONNUS)
    verifier(r["ok"] and len(r.get("aveugles") or []) == 1 and r["aveugles"][0].endswith("models" + AS)
             and not r.get("generes"),
             "13. node : dossier inconnu — à l'aveugle ; un fichier lu puis réécrit n'est pas généré  "
             + r["erreur"] + " " + str(r.get("aveugles")) + str(r.get("generes")))

# ── 14. L'environnement : celui de la machine est donné, le reste est INCONNU ──
# Mesuré le 03/10/2026 : `fs.writeFileSync(process.env.TEMP + "/anims_cuites.json", …)` écrivait,
# avec un environnement vide, dans `undefined/anims_cuites.json` — un fichier fantôme du projet.
code14 = '''import os
t = os.environ["TEMP"]
enc = os.environ.get("PYTHONIOENCODING")
sortie = os.environ.get("NARVOS_SORTIE", "defaut")
open("WebPortal/a.lua", "w").write("-- %s %s" % (bool(t), sortie))
'''
fournir, _ = monde({CLE: lua})
r = bac.executer("python", code14, [], RACINE, fournir, CONNUS)
verifier(r["ok"] and r.get("aveugles") == ["env:NARVOS_SORTIE"] and r["ecrits"][CLE] == "-- True defaut",
         "14. python : TEMP vient de la machine ; une variable inconnue du script est une réponse à l'aveugle  "
         + r["erreur"] + " " + str(r.get("aveugles")))
if shutil.which("node"):
    js14 = '''const fs = require("fs");
fs.writeFileSync(process.env.TEMP + "/anims_cuites.json", "[]");
fs.writeFileSync("WebPortal/a.lua", "-- " + process.env.NARVOS_SORTIE + " " + (process.env.NODE_ENV || "dev"));
'''
    fournir, _ = monde({CLE: lua})
    r = bac.executer("node", js14, [], RACINE, fournir, CONNUS)
    verifier(r["ok"] and r.get("aveugles") == ["env:NARVOS_SORTIE"]
             and "h:c:" + AS + "users" + AS + "aniss" + AS + "appdata" + AS + "local" + AS + "temp" + AS + "anims_cuites.json" in r["ecrits"]
             and not any("undefined" in k for k in r["ecrits"]),
             "14. node : `process.env.TEMP` est le vrai dossier temporaire (plus de `undefined/…` dans le projet)  "
             + r["erreur"] + " " + str(sorted(r["ecrits"])) + str(r.get("aveugles")))

print(f"bac : {reussis} assertion(s) reussie(s), {echecs} echec(s)")
sys.exit(1 if echecs or not reussis else 0)
