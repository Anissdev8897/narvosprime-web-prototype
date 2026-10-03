# -*- coding: utf-8 -*-
"""
test_reconstitution.py — preuves du cœur de la reconstruction.

  python scripts/recuperation/test_reconstitution.py

Chaque cas est un défaut RÉEL de la première version, ou une règle qu'on ne
veut pas voir régresser.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reconstitution import (Reconstitution, Hunk, TROU, hunks_depuis_diff,  # noqa: E402
                            hunks_depuis_structure)

reussis = echecs = 0


def verifier(condition, nom):
    global reussis, echecs
    if condition:
        reussis += 1
    else:
        echecs += 1
        print("ECHEC :", nom)


def fichier(n, prefixe="ligne"):
    """Un fichier de n lignes distinctes et assez longues pour servir de repères."""
    return [f"{prefixe} numero {i} — contenu assez long pour faire un repere solide" for i in range(1, n + 1)]


def frag(lignes, debut, fin):
    return [(i, lignes[i - 1]) for i in range(debut, fin + 1)]


# ── 1. Lectures partielles d'une seule version : trous marqués, rien d'inventé ──
v1 = fichier(100)
r = Reconstitution()
r.lire(frag(v1, 1, 30), 100)
r.lire(frag(v1, 61, 100), 100)
texte, bilan = r.assembler()
lignes = texte.split("\n")
verifier(len(lignes) == 100, "1. longueur conservée")
verifier(lignes[:30] == v1[:30] and lignes[60:] == v1[60:], "1. lignes lues exactes")
verifier(all(l == TROU for l in lignes[30:60]) and bilan["trous"] == 30, "1. trou marqué, 30 lignes")

# ── 2. Écriture complète puis modification positionnée : exact ─────────────────
r = Reconstitution()
r.ecrire("\n".join(v1))
neuves = ["ajout A", "ajout B"]
h = Hunk(10, 3, 10, 5, [(" ", v1[9]), ("+", "ajout A"), ("+", "ajout B"), (" ", v1[10]), (" ", v1[11])])
r.modifier([h])
texte, bilan = r.assembler()
attendu = v1[:10] + neuves + v1[10:]
verifier(texte.split("\n") == attendu and bilan["trous"] == 0, "2. hunk appliqué exactement, décalage compris")

# ── 3. LE défaut d'origine : un bloc décalé ne doit JAMAIS être posé deux fois ──
# v1 lue en 1-100. Puis 20 lignes insérées (hors de notre vue) après la ligne 9.
# La v2 n'est lue qu'en 50-120 : ce sont les lignes 30-100 de v1.
v2 = v1[:9] + [f"insertion inconnue {i} — texte assez long pour compter" for i in range(20)] + v1[9:]
r = Reconstitution()
r.lire(frag(v1, 1, 100), 100)
r.lire(frag(v2, 50, 120), 120)
texte, bilan = r.assembler()
lignes = texte.split("\n")
utiles = [l for l in lignes if l in v1]
verifier(len(utiles) == len(set(utiles)), "3. aucune ligne de v1 en double (le défaut « already declared »)")
verifier(lignes[-71:] == v2[49:], "3. la fin lue en v2 fait foi")
verifier(any("ANCIENNE VERSION ↓" in l for l in lignes), "3. le début, d'une version antérieure, est étiqueté")
verifier(all(l in lignes for l in v1[:29]), "3. le début ancien est repris (pas perdu)")
verifier(r.epoques == 2, "3. deux époques détectées")

# ── 4. Même longueur entre deux repères : les lignes anciennes comblent exactement ──
r = Reconstitution()
r.lire(frag(v1, 1, 100), 100)
v3 = list(v1)
v3[4] = "ligne 5 changée sur place — même longueur de fichier, autre contenu ici"
v3 = v3 + ["ajout final un", "ajout final deux"]            # 102 lignes : nouvelle époque
r.lire(frag(v3, 1, 20), 102)
r.lire(frag(v3, 80, 102), 102)
texte, bilan = r.assembler()
lignes = texte.split("\n")
verifier(lignes == v3, "4. trou 21-79 comblé à l'identique depuis l'époque précédente")
verifier(bilan["trous"] == 0 and bilan["anciennes"] == 0, "4. ni trou ni bloc étiqueté")

# ── 5. Modification qui contredit l'époque : on ne garde que ce que le diff montre ──
r = Reconstitution()
r.lire(frag(v1, 1, 40), 100)
faux = [(" ", "contexte qui ne correspond a rien de connu, ligne A"),
        (" ", "contexte qui ne correspond a rien de connu, ligne B"),
        ("-", "ancienne ligne inconnue"), ("+", "nouvelle ligne"),
        (" ", "contexte qui ne correspond a rien de connu, ligne C")]
r.modifier([Hunk(10, 4, 10, 4, faux)])
verifier(r.epoques == 2, "5. un diff contradictoire ouvre une époque")
verifier(r.carte.get(12) == "nouvelle ligne", "5. le contenu du diff est posé à sa position d'après")

# ── 6. Lecture sans longueur (grep) au-delà de la fin connue : nouvelle époque ──
r = Reconstitution()
r.lire(frag(v1, 1, 100), 100)
r.lire([(130, "une ligne trouvée par grep bien après la fin connue du fichier")], 0)
verifier(r.epoques == 2, "6. un numéro hors du fichier connu prouve qu'il a grandi")

# ── 7. Modification sans position : appliquée seulement si l'ancre est unique ──
r = Reconstitution()
r.lire(frag(v1, 1, 50), 100)
r.remplacer(v1[9], "ligne 10 remplacée", False)
texte, _ = r.assembler()
verifier("ligne 10 remplacée" in texte and v1[9] not in texte, "7. ancre unique : appliquée")
r = Reconstitution()
r.lire([(1, "doublon"), (2, "doublon"), (3, "fin")], 3)
r.carte.pop(3)
r.remplacer("doublon", "X", False)
texte, _ = r.assembler()
verifier("X" not in texte and len(r.non_appliquees) == 1, "7. ancre double : refusée, gardée de côté")

# ── 8. Retours chariot : un fichier CRLF et un LF se recouvrent sans rupture ──
r = Reconstitution()
r.lire([(i, l + "\r") for i, l in frag(v1, 1, 50)], 100)
r.lire(frag(v1, 40, 100), 100)
texte, bilan = r.assembler()
verifier(texte.split("\n") == v1 and r.epoques == 1, "8. CRLF et LF : même époque, fichier exact")

# ── 9. Lecture des diffs ───────────────────────────────────────────────────────
d = "--- a/x\n+++ b/x\n@@ -21,3 +21,5 @@\n ligne a\r\n+ajout 1\r\n+ajout 2\r\n ligne b\r\n ligne c\r\n"
hs = hunks_depuis_diff(d)
verifier(len(hs) == 1 and (hs[0].avant, hs[0].n_avant, hs[0].apres, hs[0].n_apres) == (21, 3, 21, 5),
         "9. en-tête de hunk lu")
verifier([s for s, _ in hs[0].lignes] == [" ", "+", "+", " ", " "] and hs[0].lignes[0][1] == "ligne a",
         "9. lignes signées, sans retour chariot")
# Un commentaire Lua supprimé s'écrit `--- texte` dans un diff : ce n'est pas un en-tête.
d = ("--- a/x.lua\n+++ b/x.lua\n@@ -10,4 +10,4 @@\n local a = 1\n--- ancien commentaire\n-local b = 2\n"
     "+-- nouveau commentaire\n+local b = 3\n local c = 4\n")
hs = hunks_depuis_diff(d)
verifier(len(hs) == 1 and hs[0].lignes == [(" ", "local a = 1"), ("-", "-- ancien commentaire"), ("-", "local b = 2"),
                                           ("+", "-- nouveau commentaire"), ("+", "local b = 3"), (" ", "local c = 4")],
         "9. `--- texte` dans un hunk : suppression d'un commentaire Lua, pas un en-tête")
r = Reconstitution()
r.ecrire("\n".join(f"l{i}" for i in range(1, 10)) + "\nlocal a = 1\n-- ancien commentaire\nlocal b = 2\nlocal c = 4\nfin")
r.modifier(hs)
verifier(r.epoques == 1 and r.carte[11] == "-- nouveau commentaire" and r.carte[12] == "local b = 3" and r.total == 14,
         "9. … et la modification s'applique sans ouvrir d'époque")
d2 = "--- a/x\n+++ b/x\n@@ -1,2 +1,2 @@\n-a\n+b\n c\n--- a/y\n+++ b/y\n@@ -5,1 +5,1 @@\n-d\n+e\n"
hs2 = hunks_depuis_diff(d2)
verifier(len(hs2) == 2 and hs2[0].lignes == [("-", "a"), ("+", "b"), (" ", "c")] and hs2[1].lignes == [("-", "d"), ("+", "e")],
         "9. diff de deux fichiers : l'en-tête qui suit un hunk complet reste un en-tête")
hs = hunks_depuis_structure([{"oldStart": 5, "oldLines": 2, "newStart": 5, "newLines": 3,
                              "lines": [" a", "-b", "+c", "+d"]}])
verifier(len(hs) == 1 and hs[0].lignes == [(" ", "a"), ("-", "b"), ("+", "c"), ("+", "d")],
         "9. structuredPatch lu")

# ── 11. La ligne vide finale : deux outils, deux comptes, UN fichier ──────────
# Claude compte la « ligne » vide après le dernier retour (101), Hermes non (100).
r = Reconstitution()
r.lire(frag(v1, 1, 60), 100)                                   # façon Hermes
r.lire(frag(v1, 50, 100) + [(101, "")], 101)                   # façon Claude, jusqu'à la fin
texte, bilan = r.assembler()
verifier(r.epoques == 1, "11. 100 et 101 lignes annoncées : même version")
verifier(texte.split("\n") == v1 and bilan["trous"] == 0, "11. fichier exact, sans ligne vide parasite")
r = Reconstitution()
r.lire(frag(v1, 1, 60), 100)
r.lire(frag(v1, 40, 70), 101)                                  # lecture partielle : fin non vue
verifier(r.epoques == 1 and r.total == 100, "11. écart d'une ligne sans voir la fin : pas de rupture")
r = Reconstitution()
r.ecrire("\n".join(v1) + "\n")
verifier(r.total == 100, "11. écriture terminée par un retour : 100 lignes, pas 101")
r.lire(frag(v1, 90, 100), 100)
verifier(r.epoques == 1, "11. relecture après écriture : même époque")

# ── 12. Une vraie ligne de plus n'est pas confondue avec l'ambiguïté finale ───
r = Reconstitution()
r.lire(frag(v1, 1, 100), 100)
r.lire([(101, "une cent-unième ligne bien réelle, ajoutée à la fin du fichier")], 101)
texte, _ = r.assembler()
verifier(texte.split("\n")[-1].startswith("une cent-unième") and len(texte.split("\n")) == 101,
         "12. ligne ajoutée en fin de fichier conservée")

# ── 13. Amorce de fin des lectures Hermes ─────────────────────────────────────
import importlib.util  # noqa: E402
spec = importlib.util.spec_from_file_location(
    "extraire", os.path.join(os.path.dirname(os.path.abspath(__file__)), "extraire-historiques.py"))
extraire = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extraire)
f = extraire.fragment_hermes('99|avant\n100|  | "torso"\n101|')
verifier(f == [(99, "avant"), (100, '  | "torso"')], "13. l'amorce « 101| » n'est pas une ligne")
f = extraire.fragment_hermes("1|a\n2|\n3|c")
verifier(f == [(1, "a"), (2, ""), (3, "c")], "13. une vraie ligne vide au milieu est gardée")
f = extraire.fragment_hermes("1|a\n2|" + "9, " * 667 + "... [truncated]\n3|c\n4|")
verifier(f == [(1, "a"), (3, "c")], "13. une ligne coupée par Hermes à 2 000 caractères devient un trou")
r = Reconstitution()
r.lire(frag(v1, 1, 100), 100)
r.lire(extraire.fragment_hermes("\n".join(f"{i}|{v1[i - 1]}" for i in range(1, 51)) + "\n51|"), 100)
texte, _ = r.assembler()
verifier(texte.split("\n")[50] == v1[50], "13. la ligne 51 garde son contenu après une lecture limitée à 50")

# ── 14. Chemins et marqueurs ──────────────────────────────────────────────────
verifier(extraire.relatif(r"E:\narvosprime-web-prototype\WebPortal\src\a.ts")[1] == r"WebPortal\src\a.ts",
         "14. racine E: reconnue, casse gardée")
verifier(extraire.relatif("/d/mes_projet/narvosprime-web-prototype/scripts/x.mjs")[0] == r"scripts\x.mjs",
         "14. chemin MSYS reconnu")
verifier(extraire.relatif(r"D:\mes_projet\narvosprime-web-prototype\WebPortal\node_modules\x\i.js") == (None, None),
         "14. node_modules exclu")
verifier(extraire.marque_pour("a.lua")("X") == "-- X" and extraire.marque_pour("a.mjs")("X") == "// X"
         and extraire.marque_pour("a.py")("X") == "# X", "14. marqueur en commentaire du langage")
# (L'alignement des sorties de shell a son module et ses preuves : test_commandes.py.)

# ── 15. Un événement recopié par une session reprise n'est rejoué qu'une fois ──
d = extraire.Dossier()
chemin = r"E:\narvosprime-web-prototype\WebPortal\src\x.ts"
charge = {"original": None, "ancien": "a", "neuf": "b", "tout": False,
          "hunks": [Hunk(134, 15, 134, 14, [(" ", "c")])]}
verifier(d.ajouter(chemin, 1000.0, "modifier", charge, "claude") is True, "15. premier exemplaire pris")
copie = {"original": None, "ancien": "a", "neuf": "b", "tout": False,
         "hunks": [Hunk(134, 15, 134, 14, [(" ", "c")])]}
verifier(d.ajouter(chemin, 1000.0, "modifier", copie, "claude") is False, "15. même événement, même instant : refusé")
verifier(d.ajouter(chemin, 1001.0, "modifier", copie, "claude") is True, "15. même contenu plus tard : c'est un autre événement")
verifier(d.ajouter(chemin, 1000.0, "lire", ([(1, "x")], 5), "claude") is True
         and d.ajouter(chemin, 1000.0, "lire", ([(1, "x")], 5), "claude") is False, "15. lecture en double refusée")
# Le défaut mesuré : une modification qui retire une ligne, rejouée deux fois, décale tout.
r = Reconstitution()
r.ecrire("\n".join(v1))
h = Hunk(10, 3, 10, 2, [(" ", v1[9]), ("-", v1[10]), (" ", v1[11])])
r.modifier([h])
texte, _ = r.assembler()
verifier(len(texte.split("\n")) == 99 and v1[10] not in texte, "15. une seule application : 99 lignes")

# ── 16. Recherche Claude sous Windows : toute ligne à barre oblique est écartée ──
g = extraire.fragments_grep('12:local x = 1\n13:\\ Utilisation future :\n14:Package.Require("Catalogs\\X.lua")\n'
                            '15:return a / b\n16:fin', r"E:\p\a.lua", True)
verifier([n for _, n, _ in g] == [12, 16], "16. lignes avec / ou \\ écartées (normalisation de chemin)")

# ── 17. Dernière ligne sans retour final (Hermes : numérotée total + 1) ───────
r = Reconstitution()
r.lire(frag(v1, 1, 99) + [(100, "}")], 99)        # Hermes annonce 99 retours, la ligne 100 existe
texte, _ = r.assembler()
verifier(texte.split("\n")[-1] == "}" and len(texte.split("\n")) == 100, "17. la dernière ligne est gardée")
r = Reconstitution()
r.lire(frag(v1, 1, 99) + [(100, "")], 99)         # amorce vide : artefact
texte, _ = r.assembler()
verifier(len(texte.split("\n")) == 99, "17. l'amorce vide en total+1 est retirée")

# ── 18. Fin ouverte : on ne fait pas passer un fichier amputé pour complet ────
r = Reconstitution()
r.lire(frag(v1, 1, 100), 100)                     # ancienne version entière
v4 = v1[:50] + ["ligne insérée dans la nouvelle version, assez longue pour compter"] + v1[50:]
r.lire(frag(v4, 40, 70), 0)                       # nouvelle version vue par sed : pas de longueur
texte, bilan = r.assembler()
lignes = texte.split("\n")
verifier(r.epoques == 2, "18. la lecture décalée ouvre une époque")
verifier(any("ANCIENNE VERSION" in l for l in lignes) and v1[99] in lignes,
         "18. la suite vient de l'ancienne version, étiquetée")
verifier(len([l for l in lignes if l in v4]) == len(set(l for l in lignes if l in v4)), "18. sans doublon")
r = Reconstitution()
r.lire([(i, v1[i - 1]) for i in range(10, 30)], 0)   # jamais de longueur, aucune version antérieure
texte, bilan = r.assembler()
verifier(bilan["fin_inconnue"] == 1 and "FIN INCONNUE" in texte.split("\n")[-1], "18. fin inconnue marquée")
verifier(bilan["trous"] == 9, "18. le début jamais lu reste un trou")

# ── 19. La coupure : rien de postérieur à la perte n'entre dans la reconstruction ──
d = extraire.Dossier()
avant, apres = extraire.PERTE - 3600, extraire.PERTE + 3600
verifier(d.ajouter(chemin, avant, "lire", ([(1, "vrai")], 1), "claude") is True, "19. événement d'avant la perte pris")
verifier(d.ajouter(chemin, apres, "lire", ([(1, "-- [TROU — relu après coup]")], 1), "claude") is False
         and d.apres_perte == 1, "19. relecture d'un fichier reconstruit écartée et comptée")
verifier(len(d.evts[extraire.relatif(chemin)[0]]) == 1, "19. un seul événement retenu")
verifier(d.ajouter(r"E:\narvosprime-web-prototype\scripts\recuperation\outil.py", apres, "ecrire", "x", "claude")
         is False and not d.connu(r"scripts\recuperation\outil.py"), "19. un outil né après la perte n'est pas reconstruit")

# ── 20. Une longueur prouvée ne se perd pas à la relecture du début ───────────
# Hermes : 597 retours annoncés, la ligne 598 (`}` sans retour final) lue une fois,
# puis les 500 premières lignes relues. Le `}` doit rester.
gros = fichier(597) + ["}"]
r = Reconstitution()
r.lire(frag(gros, 1, 500), 597)
r.lire(frag(gros, 501, 598), 597)
r.lire(frag(gros, 1, 500), 597)
texte, bilan = r.assembler()
verifier(texte.split("\n")[-1] == "}" and len(texte.split("\n")) == 598 and bilan["trous"] == 0,
         "20. la dernière ligne survit à une relecture partielle")

# … mais un fichier RACCOURCI d'une ligne ne garde pas sa vieille fin : la ligne 65,
# lue quand le fichier en comptait 65, n'existe plus quand il en annonce 64.
court = fichier(65)
r = Reconstitution()
r.lire(frag(court, 1, 65), 65)
apres_retrait = court[:59] + court[60:]            # la ligne 60 a disparu
r.lire(frag(apres_retrait, 1, 64), 64)
texte, _ = r.assembler()
verifier(texte.split("\n") == apres_retrait, "20. fichier raccourci d'une ligne : pas de vieille fin en trop")

# ── 24. Une seule ligne, mais connue ailleurs : la numérotation est périmée ──
r = Reconstitution()
r.lire(frag(v1, 1, 100), 100)
r.lire([(17, v1[17])], 0)          # la ligne 18 de notre version, vue en 17 par un `grep -n`
texte, bilan = r.assembler()
lignes = texte.split("\n")
verifier(r.epoques == 2, "24. ligne reconnue à un autre numéro : nouvelle époque")
verifier(lignes.count(v1[17]) == 1, "24. pas de doublon (le défaut « class déclarée deux fois »)")
verifier(any("ANCIENNE VERSION" in l for l in lignes) and bilan["anciennes"] > 0,
         "24. le reste est repris de l'ancienne version, étiqueté")
r = Reconstitution()
r.lire(frag(v1, 1, 100), 100)
r.lire([(17, "ligne 17 retouchée sur place, texte entièrement nouveau ici")], 0)
verifier(r.epoques == 1 and r.carte[17].startswith("ligne 17 retouchée"),
         "24. ligne nouvelle au même numéro : retouche sur place, même époque")
r = Reconstitution()
r.lire([(1, "}"), (2, "x"), (3, "}")], 3)
r.lire([(2, "}")], 0)
verifier(r.epoques == 1, "24. une ligne légère (`}`) ne prouve aucun déplacement")

# ── 25. Une version vue par trois lignes se rattache à la version complète ───
# Lignes courtes (25 caractères) : trop légères pour un repère de bloc, mais UNIQUES.
courtes = [f"local valeur_{i:03d} = {i * 7:05d}" for i in range(1, 61)]
r = Reconstitution()
r.lire(frag(courtes, 1, 60), 60)
neuf = courtes[:20] + ["-- ligne ajoutee A", "-- ligne ajoutee B"] + courtes[20:]     # +2 après la ligne 20
r.lire([(10, neuf[9]), (40, neuf[39]), (55, neuf[54])], 0)                        # trois lignes de grep
texte, bilan = r.assembler()
lignes = texte.split("\n")
verifier(r.epoques == 2, "25. la ligne 40 connue en 38 : nouvelle époque")
verifier(lignes[:9] == courtes[:9] and lignes[9] == courtes[9], "25. avant le premier repère : repris exactement")
verifier(lignes[-1] == "[ANCIENNE VERSION ↑]" and courtes[59] in lignes, "25. la suite vient de l'ancienne version")
verifier(len([l for l in lignes if l in courtes]) == len(set(l for l in lignes if l in courtes)),
         "25. aucune ligne en double")
verifier(sum(1 for l in lignes if l in courtes) == 60, "25. les 60 lignes de l'ancienne version sont toutes là")
verifier(bilan["trous"] == 0 and bilan["anciennes"] > 0, "25. le tronçon qui a changé de longueur est étiqueté")

# ── 26. Longueur changée entre deux repères : des repères plus fins à l'intérieur ──
tete, queue_ = "-- repere de tete, assez long pour compter seul", "-- repere de queue, assez long pour compter seul"
legeres = [f"x_{i:03d} = {i}" for i in range(2, 60)]             # lignes légères mais toutes distinctes
ancien = [tete] + legeres + [queue_]                             # 60 lignes
neuf = ancien[:30] + ["ajout_a()", "ajout_b()"] + ancien[30:]    # 62 lignes : +2 après la ligne 30
r = Reconstitution()
r.lire(frag(ancien, 1, 60), 60)
r.lire([(1, neuf[0]), (20, neuf[19]), (45, neuf[44]), (62, neuf[61])], 62)
texte, bilan = r.assembler()
lignes = texte.split("\n")
verifier(r.epoques == 2 and bilan["trous"] == 0, "26. aucune ligne perdue")
verifier(lignes[:20] == ancien[:20] and lignes[-17:] == ancien[-17:],
         "26. de part et d'autre du tronçon modifié : repris exactement, sans étiquette")
verifier(bilan["anciennes"] == 22 and any("24 ligne(s) attendue(s) ici, 22 connue(s)" in l for l in lignes),
         "26. seul le tronçon qui a changé de longueur est étiqueté (22 lignes pour 24)")
verifier(len([l for l in lignes if l in ancien]) == 60 == len(set(l for l in lignes if l in ancien)),
         "26. chaque ligne ancienne posée une fois et une seule")

# ── 27. Tronçon irréductible : le bloc ancien, puis les lignes sûres en témoins ──
lourdes = [f"appel_de_fonction_numero_{i:03d}(argument)" for i in range(1, 41)]
r = Reconstitution()
r.lire(frag(lourdes, 1, 40), 40)
r.lire([(1, lourdes[0]), (20, "ligne toute neuve, jamais vue dans l'ancienne version"), (43, lourdes[39])], 43)
texte, bilan = r.assembler(lambda s: "-- " + s)
lignes = texte.split("\n")
verifier(bilan["trous"] == 0 and bilan["anciennes"] == 38 and bilan["non_replacees"] == 1,
         "27. 38 lignes anciennes posées, 1 ligne sûre non replacée, aucun trou")
verifier("-- [SÛRE n°20] ligne toute neuve, jamais vue dans l'ancienne version" in lignes,
         "27. la ligne sûre est un TÉMOIN commenté, avec son numéro — elle ne casse pas le bloc ancien")
verifier(lignes[0] == lourdes[0] and lignes[-1] == lourdes[39]
         and lignes.index("-- [ANCIENNE VERSION ↑]") < lignes.index("-- " + "[DERNIÈRE VERSION ↑]"),
         "27. repères en place, témoins après le bloc ancien")

# ── 28. Un petit vieux fichier ne noie pas une dernière version bien connue ──
r = Reconstitution()
r.lire([(i, f"vieille ligne {i} d'un tout premier jet du fichier") for i in range(1, 6)], 5)
r.lire(frag(v1, 1, 30), 100)
texte, bilan = r.assembler()
verifier(bilan["anciennes"] == 0 and bilan["non_replacees"] == 0 and bilan["trous"] == 70
         and texte.split("\n")[:30] == v1[:30], "28. lignes sûres intactes, trous laissés en trous")

# ── 29. Modification contradictoire, sans aucun repère : l'ancienne version entière ──
# (Le cas `Character.lua` : 831 lignes connues, puis un diff qui ne s'y accorde pas.)
r = Reconstitution()
r.lire(frag(v1, 1, 50), 50)
r.modifier([Hunk(20, 3, 20, 4, [(" ", "contexte inconnu, premiere ligne du diff"), ("-", "ligne retiree inconnue"),
                                ("+", "ligne ajoutee numero un"), ("+", "ligne ajoutee numero deux"),
                                (" ", "contexte inconnu, derniere ligne du diff")])])
texte, bilan = r.assembler()
lignes = texte.split("\n")
verifier(r.epoques == 2 and bilan["fin_inconnue"] == 0 and bilan["trous"] == 0,
         "29. ni trou ni fin inconnue : rien de l'ancienne version n'est perdu")
verifier(bilan["anciennes"] == 50 and all(l in lignes for l in v1[:50]), "29. les 50 lignes anciennes, étiquetées")
verifier(bilan["non_replacees"] == 4 and "[SÛRE n°21] ligne ajoutee numero un" in lignes,
         "29. les 4 lignes du diff, sûres, gardées en témoins numérotés")

# ── 30. Le report se fait EN CHAÎNE : ce qu'on a appris entre-temps n'est pas sauté ──
# (Le cas `Comptes.lua` : la plus vieille version était entière, les suivantes non.)
origine = [f"fonction_a_{i:02d}() -- ligne d'origine" for i in range(1, 31)]                     # 30 lignes
milieu = origine[:10] + [f"ajout_m_{i:02d}() -- ligne de la version du milieu" for i in range(1, 11)] + origine[10:]
finale = milieu[:20] + ["nouvelle_f_1() -- derniere version", "nouvelle_f_2() -- derniere version"] + milieu[20:]
r = Reconstitution()
r.lire(frag(origine, 1, 30), 30)                 # la plus ancienne : entière
r.lire(frag(milieu, 1, 25), 40)                  # celle du milieu : 25 lignes sur 40
r.lire([(5, finale[4]), (21, finale[20]), (40, finale[39])], 42)     # la dernière : trois lignes
texte, bilan = r.assembler()
lignes = texte.split("\n")
verifier(r.epoques == 3 and bilan["trous"] == 0, "30. trois époques, aucun trou")
verifier(all(l in lignes for l in milieu[10:20]),
         "30. les lignes apprises à la version du MILIEU sont là — on n'est pas reparti de la plus vieille")
verifier(all(lignes.count(l) == 1 for l in origine), "30. chaque ligne d'origine, une fois")
verifier(lignes[:5] == finale[:5] and lignes[-3:] == finale[-3:], "30. de part et d'autre du tronçon changé : exact")
verifier("[SÛRE n°21] nouvelle_f_1() -- derniere version" in lignes and bilan["non_replacees"] == 1,
         "30. la ligne propre à la dernière version reste en témoin")
# La version du milieu, complétée par la précédente, doit valoir le vrai fichier du milieu.
r2 = Reconstitution()
r2.lire(frag(origine, 1, 30), 30)
r2.lire(frag(milieu, 1, 25), 40)
texte2, bilan2 = r2.assembler()
verifier(texte2.split("\n") == milieu and bilan2["anciennes"] == 0,
         "30. une époque partielle se complète exactement quand l'écart a la même longueur")

# ── 31. Un bloc ancien peut avoir ses propres trous : ils restent des trous ──
r = Reconstitution()
r.lire(frag(lourdes, 1, 30) + frag(lourdes, 34, 40), 40)        # 31-33 jamais lues
r.lire([(1, lourdes[0]), (45, lourdes[39])], 45)                 # +5 lignes quelque part
texte, bilan = r.assembler()
verifier(bilan["trous"] == 3 and bilan["anciennes"] == 35, "31. bloc ancien posé, ses 3 lignes inconnues comptées")

# ── 21. Sous-agents : le résultat n'existe que tel qu'il est AFFICHÉ ──────────
f, vues = extraire.fragment_affiche("1\tpremière\n2\t\n3\ttroisième\n\n<system-reminder>\n4\tfaux\n</system-reminder>")
verifier(f == [(1, "première"), (2, ""), (3, "troisième")] and vues == 3,
         "21. lignes numérotées lues, le rappel système qui suit est ignoré")
f, vues = extraire.fragment_affiche("     7→ancien format\n     8→suite")
verifier(f == [(7, "ancien format"), (8, "suite")], "21. ancien format à flèche")
f, vues = extraire.fragment_affiche("1\tcourte\n2\t" + "x" * 2000 + "\n3\tfin")
verifier(f == [(1, "courte"), (3, "fin")] and vues == 3, "21. une ligne tronquée à l'affichage devient un trou")
d = extraire.Dossier()
chemin_lua = r"D:\mes_projet\narvosprime-web-prototype\WebPortal\Server\x.lua"
rendu = "\n".join(f"{i}\t{l}" for i, l in enumerate(v1[:60], 1))
verifier(extraire.operation_affichee(d, "Read", {"file_path": chemin_lua}, rendu, 1000.0) is True,
         "21. lecture de sous-agent prise")
evt = d.evts[extraire.relatif(chemin_lua)[0]][0]
verifier(evt[3][1] == 60 and evt[4] == "claude-agent", "21. moins de lignes que la limite : fin de fichier connue")
d = extraire.Dossier()
extraire.operation_affichee(d, "Read", {"file_path": chemin_lua, "limit": 60}, rendu, 1000.0)
verifier(d.evts[extraire.relatif(chemin_lua)[0]][0][3][1] == 0, "21. limite atteinte : longueur inconnue")
d = extraire.Dossier()
verifier(extraire.operation_affichee(d, "Write", {"file_path": chemin_lua, "content": "a\nb\n"},
                                     "File created successfully at: x", 1000.0) is True
         and extraire.operation_affichee(d, "Write", {"file_path": chemin_lua, "content": "zzz"},
                                         "<tool_use_error>refusé</tool_use_error>", 1001.0) is False,
         "21. écriture réussie prise, écriture refusée écartée")
verifier(extraire.operation_affichee(d, "Edit", {"file_path": chemin_lua, "old_string": "a", "new_string": "c"},
                                     "The file x has been updated successfully.", 1002.0) is True,
         "21. modification de sous-agent prise")
r, sources, _ = extraire.rejouer(d.evts[extraire.relatif(chemin_lua)[0]])
verifier(r.assembler()[0] == "c\nb", "21. écriture puis modification sans position : rejouées dans l'ordre")

# ── 22. Remplacement partout (`replace_all`) resté en attente ─────────────────
r = Reconstitution()
r.lire([(1, "engine.f(1)"), (2, "autre"), (3, "engine.f(2)")], 5)      # lignes 4-5 jamais lues
r.remplacer("engine.f(", "engine.f?.(", True)
texte, _ = r.assembler()
verifier(texte.count("engine.f?.(") == 2 and not r.non_appliquees, "22. toutes les occurrences visibles remplacées")
r = Reconstitution()
r.lire([(1, "engine.f(1)"), (2, "autre"), (3, "engine.f(2)")], 5)
r.remplacer("engine.f(", "engine.f?.(", False)
texte, _ = r.assembler()
verifier("?." not in texte and len(r.non_appliquees) == 1, "22. sans `replace_all`, deux occurrences : refusé")

# ── 32. Un skill invoqué : le fichier entier moins son en-tête, lu sans l'avoir demandé ──
base_skill = r"D:\mes_projet\narvosprime-web-prototype\.claude\skills\demo"
invocation = ("Base directory for this skill: " + base_skill + "\n\n# demo — mémoire du projet\r\n\r\nPremière règle du skill."
              "\r\nSeconde règle du skill.\r\n\n\nARGUMENTS: une demande passée au skill")
c = extraire.corps_de_skill(invocation)
verifier(len(c) == 1 and c[0][0] == base_skill + "\\SKILL.md" and len(c[0][1]) == 4
         and c[0][1][0].startswith("# demo") and "ARGUMENTS" not in "".join(c[0][1]),
         "32. corps pris jusqu'aux arguments exclus, chemin du SKILL.md déduit")
verifier(extraire.corps_de_skill("### Skill: demo\nBase directory for this skill: X\n\ncorps\n\n[... skill content truncated") == [],
         "32. rappel tronqué d'après compaction : écarté")
d = extraire.Dossier()
fichier_skill = base_skill + "\\SKILL.md"
d.ajouter(fichier_skill, 500.0, "lire", ([(1, "---"), (2, "name: demo"), (3, "---"), (4, ""),
                                         (5, "# demo — mémoire du projet")], 9), "claude")
journal_muet = type("J", (), {"write": lambda self, *_: None})()
extraire.rattacher_sorties(d, [(1000.0, fichier_skill, [], c[0][1], None, None, "claude-skill")], journal_muet)
r, _, _ = extraire.rejouer(d.evts[extraire.relatif(fichier_skill)[0]])
texte, bilan = r.assembler()
verifier(texte.split("\n")[4:8] == ["# demo — mémoire du projet", "", "Première règle du skill.", "Seconde règle du skill."]
         and bilan["trous"] == 1, "32. le corps est posé à la ligne où il commence (5), le reste du fichier s'en trouve comblé")

# ── 33. Les diffs de Claude Code ont perdu leurs tabulations ─────────────────
from reconstitution import etaler  # noqa: E402

T = "\t"
js = ["function f() {", T + "if (a) {", T + T + "appel(1);", T + T + "autre();", T + "}", "}"]
verifier(etaler(T + T + "appel(1);") == "    appel(1);", "33. une tabulation s'étale en deux espaces")
# (a) on tient l'ancien côté : le remplacement est refait sur le texte EXACT.
r = Reconstitution()
r.ecrire("\n".join(js))
diff = Hunk(2, 4, 2, 5, [(" ", "  if (a) {"), ("-", "    appel(1);"), ("+", "    appel(2);"), ("+", "    encore();"),
                         (" ", "    autre();"), (" ", "  }")])
r.modifier([diff], T + T + "appel(1);", T + T + "appel(2);\n" + T + T + "encore();", etale=True)
verifier(r.epoques == 1, "33. un diff étalé ne contredit pas un fichier à tabulations")
verifier([r.carte[i] for i in range(2, 7)] == [T + "if (a) {", T + T + "appel(2);", T + T + "encore();", T + T + "autre();", T + "}"],
         "33. lignes posées AVEC leurs tabulations, contexte intact")
# (b) modification au milieu d'une ligne : la ligne neuve n'est pas une ligne entière du texte posé.
r = Reconstitution()
r.ecrire("\n".join(js))
r.modifier([Hunk(3, 1, 3, 1, [("-", "    appel(1);"), ("+", "    appel(42);")])], "(1)", "(42)", etale=True)
verifier(r.carte[3] == T + T + "appel(42);", "33. remplacement en milieu de ligne : refait sur la ligne exacte")
# (c) ancien côté inconnu : ligne entière du texte posé, sinon l'indentation du fichier.
r = Reconstitution()
r.lire([(1, js[0]), (2, js[1])], 6)
r.modifier([Hunk(3, 1, 3, 2, [("-", "    appel(1);"), ("+", "    appel(2);"), ("+", "    reste = `a  b`;")])],
           T + T + "appel(1);", T + T + "appel(2);\n" + T + T + "reste = `a  b`;", etale=True)
verifier(r.carte[3] == T + T + "appel(2);" and r.carte[4] == T + T + "reste = `a  b`;",
         "33. ancien côté inconnu : lignes entières reprises du texte posé (les espaces du milieu restent)")
r = Reconstitution()
r.lire([(1, js[0]), (2, js[1])], 6)
r.modifier([Hunk(3, 1, 3, 1, [("-", "    appel(1);"), ("+", "    appel(42);")])], "(1)", "(42)", etale=True)
verifier(r.carte[3] == T + T + "appel(42);", "33. … à défaut, deux espaces de tête = une tabulation dans un fichier tabulé")
# (d) fichier indenté par ESPACES : rien n'est changé.
r = Reconstitution()
r.ecrire("a\n    b\nc")
r.modifier([Hunk(2, 1, 2, 1, [("-", "    b"), ("+", "    B")])], "b", "B", etale=True)
verifier(r.carte[2] == "    B", "33. fichier à espaces : les espaces restent des espaces")
# (e) un diff EXACT (Hermes) qui diffère par ses blancs reste un conflit.
r = Reconstitution()
r.ecrire("\n".join(js))
r.modifier([Hunk(2, 3, 2, 3, [(" ", "  if (a) {"), ("-", "    appel(1);"), ("+", "    appel(2);"), (" ", "    autre();")])])
verifier(r.epoques == 2, "33. sans `etale`, espaces contre tabulations : le diff contredit le fichier")

# ── 34. Un filet décoratif répété n'est pas un repère ────────────────────────
filet = "// " + "═" * 60
bloc = lambda nom: ["}", "", filet, f"// SECTION {nom} — titre de la section", filet, f"function {nom}Rendre() {{",
                    f"\tconst boite_{nom} = chercher('{nom}');", f"\tboite_{nom}.hidden = false;"]
ancien34 = [l for nom in ("alpha", "beta", "gamma", "delta", "epsilon") for l in bloc(nom)]          # 40 lignes
neuf34 = ancien34[:16] + ["\tappel_neuf_1();", "\tappel_neuf_2();"] + ancien34[16:]                  # +2 après beta
r = Reconstitution()
r.lire(frag(ancien34, 1, 40), 40)
# La dernière version n'est vue que par : le `}`, la ligne vide et le filet du bloc epsilon
# (lignes répétées cinq fois), et une ligne unique du bloc gamma.
r.lire([(35, neuf34[34]), (36, neuf34[35]), (37, neuf34[36]), (24, neuf34[23])], 42)
texte, bilan = r.assembler()
lignes = texte.split("\n")
verifier(r.epoques == 2 and bilan["trous"] == 0, "34. deux époques, aucun trou")
verifier(lignes[-8:] == neuf34[-8:] and all(lignes.count(l) == 1 for l in neuf34 if l.startswith("function")),
         "34. le filet répété n'accroche pas le mauvais bloc : la fin est juste, chaque fonction posée une fois")
verifier(sum(1 for l in lignes if l == filet) == 10, "34. les dix filets sont là, pas un de plus")

# ── 35. Une modification déjà visible ne se refait pas (ancre CONTENUE dans le texte neuf) ──
# Une insertion garde son ancre : « local x = 1 » devient « local x = 1 / local y = 2 ».
# Si une lecture postérieure montre déjà le résultat, l'ancre s'y trouve encore — DANS le
# texte neuf. La reprendre pour une ancre libre, c'est insérer deux fois.
r = Reconstitution()
r.remplacer("local x = 1", "local x = 1\nlocal y = 2")            # rien n'est connu : elle attend
r.lire([(1, "-- tete du fichier"), (2, "-- suite de la tete"), (3, "local x = 1"), (4, "local y = 2"), (5, "return x")], 5)
texte, bilan = r.assembler()
verifier(texte.split("\n").count("local y = 2") == 1 and bilan["modifs_refletees"] == 1 and bilan["modifs_placees"] == 0,
         "35. insertion déjà lue : reflétée, pas refaite")
# … de même quand elle a clos une époque et n'a pas trouvé son ancre dans celle-ci.
r = Reconstitution()
r.lire([(1, "-- tete du fichier"), (2, "-- suite de la tete")], 0)
r.remplacer("local x = 1", "local x = 1\nlocal y = 2")
r.lire([(3, "local x = 1"), (4, "local y = 2"), (5, "return x")], 5)
texte, bilan = r.assembler()
verifier(r.epoques == 2 and texte.split("\n").count("local y = 2") == 1 and texte.split("\n")[-3:] == [
    "local x = 1", "local y = 2", "return x"] and bilan["modifs_refletees"] == 1,
         "35. … même partie avec son époque : la lecture d'après la montre faite")
# Même ligne, même nombre de lignes : « x = 1 » devenu « x = 10 » ne devient pas « x = 100 ».
r = Reconstitution()
r.lire([(1, "-- tete du fichier")], 3)
r.remplacer("niveau_max = 1", "niveau_max = 10")
r.lire([(2, "niveau_max = 10"), (3, "return niveau_max")], 3)
texte, bilan = r.assembler()
verifier("niveau_max = 100" not in texte and "niveau_max = 10" in texte and bilan["modifs_refletees"] == 1,
         "35. retouche déjà lue : « = 10 » ne devient pas « = 100 »")
# Une ancre LIBRE à côté d'une modification déjà faite reste remplaçable (remplacement partout).
r = Reconstitution()
r.lire([(1, "local palier = 1"), (2, "local palier = 12"), (3, "fin")], 3)
r.remplacer("local palier = 1", "local palier = 12", tout=True)
verifier(r.carte[1] == "local palier = 12" and r.carte[2] == "local palier = 12",
         "35. l'ancre libre est remplacée, celle déjà faite reste intacte")
# Sans ancre libre, une modification à une seule place n'a plus rien à faire : elle attend.
r = Reconstitution()
r.lire([(1, "local palier = 12"), (2, "fin")], 2)
r.remplacer("local palier = 1", "local palier = 12")
verifier(r.carte[1] == "local palier = 12" and len(r.attente) == 1, "35. aucune ancre libre : rien n'est touché")

# ── 36. Fichier ENTIER, ancre disparue : la modification a eu lieu, elle n'est pas « perdue » ──
# Elle attendait (son ancre était dans un trou) ; depuis, tout le fichier a été relu, et
# son résultat a encore changé. Ni l'ancre ni le texte posé ne s'y lisent : la marquer
# « non replacée » salirait un fichier complet et juste.
r = Reconstitution()
r.lire([(1, "-- tete du fichier")], 4)
r.remplacer("local vitesse_de_base = 100", "local vitesse_de_base = 250")      # ligne 3, pas encore lue
r.lire([(2, "local nom = 'x'"), (3, "local vitesse_de_base = 300"), (4, "return nom")], 4)   # relue : encore changée
texte, bilan = r.assembler(lambda s: "-- " + s)
verifier(bilan["modifs_perdues"] == 0 and bilan["modifs_refletees"] == 1 and "NON REPLAC" not in texte,
         "36. fichier entier où l'ancre ne se lit plus : modification tenue pour faite")
# … mais si l'ancre s'y lit ENCORE deux fois (ambiguë), elle reste signalée.
r = Reconstitution()
r.remplacer("appliquer_la_vitesse(joueur)", "appliquer_la_vitesse(joueur, 250)")
r.lire([(1, "appliquer_la_vitesse(joueur)"), (2, "appliquer_la_vitesse(joueur)")], 2)
texte, bilan = r.assembler(lambda s: "-- " + s)
verifier(bilan["modifs_perdues"] == 1, "36. ancre encore là, deux fois : on ne sait pas où — elle reste signalée")
# … et si le fichier a des trous, rien ne dit qu'elle n'est pas dedans.
r = Reconstitution()
r.lire([(1, "-- tete du fichier")], 4)
r.remplacer("local vitesse_de_base = 100", "local vitesse_de_base = 250")
texte, bilan = r.assembler(lambda s: "-- " + s)
verifier(bilan["modifs_perdues"] == 1, "36. fichier troué : la modification attend toujours")

# ── 37. Lecture FLOTTANTE : calée par ce qu'on tient, ou ignorée ─────────────
# `sed -n '21,30p'` dont la ligne 21 est vide : la sortie, rognée, commence à la ligne 22 et
# compte 9 lignes au lieu de 10. Prise telle quelle, elle serait fausse d'un rang partout.
v = fichier(40)
v[20] = ""                                               # la ligne 21 est vide
r = Reconstitution()
r.lire(frag(v, 18, 25), 0)                               # on tient 18-25
sortie = [(21 + k, l) for k, l in enumerate([v[21].lstrip()] + v[22:30])]   # lignes 22-30, comptées depuis 21
r.lire(sortie, 0, ("flottant", 21, 1))
verifier(r.epoques == 1 and r.carte.get(30) == v[29] and r.carte.get(26) == v[25] and 31 not in r.carte,
         "37. flottante, calée d'UN rang par les lignes connues : les trous 26-30 sont comblés, à leur place")
r = Reconstitution()
r.lire(frag(v, 1, 5), 0)
r.lire(sortie, 0, ("flottant", 21, 1))
verifier(r.epoques == 1 and 22 not in r.carte and 23 not in r.carte,
         "37. flottante, rien de connu dans la plage : elle n'est pas calée — ignorée")
r = Reconstitution()
r.lire(frag(v, 18, 25), 0)
autre = [(21 + k, l) for k, l in enumerate(["une ligne toute différente, assez longue pour compter"] * 4)]
r.lire(autre, 0, ("flottant", 21, 2))
verifier(r.epoques == 1 and r.carte.get(22) == v[21],
         "37. flottante qui contredit ce qu'on tient à tous les décalages : ignorée — elle ne prouve aucun changement")
w = ["bloc repete, une ligne longue et parfaitement identique"] * 30
r = Reconstitution()
r.lire([(i, w[i - 1]) for i in range(12, 31)], 30)       # 10 et 11 inconnues : rien ne dit si elles étaient vides
r.lire([(10 + k, w[0]) for k in range(6)], 0, ("flottant", 10, 2))
verifier(r.epoques == 1 and r.lectures == 1 and 10 not in r.carte and 11 not in r.carte,
         "37. flottante que plusieurs décalages accordent (lignes répétées) : ambiguë — ignorée")
r = Reconstitution()
r.lire([(i, w[i - 1]) for i in range(1, 31)], 30)
r.lire([(10 + k, w[0]) for k in range(6)], 0, ("flottant", 10, 4))
verifier(r.epoques == 1 and r.lectures == 2,
         "37. … mais si la première ligne de la plage est connue et NON vide, rien n'a pu être rogné : décalage nul")
r = Reconstitution()
r.lire(frag(v, 18, 25), 0)
r.lire([(20 + k, l) for k, l in enumerate([v[19].lstrip()] + v[20:27])], 0, ("flottant", 20, 3))
verifier(r.carte.get(27) == v[26] and r.carte.get(21) == "",
         "37. flottante sans décalage (la première ligne n'était pas vide) : calée à zéro")

# ── 10. Un fichier jamais vu ne produit rien ─────────────────────────────────
texte, bilan = Reconstitution().assembler()
verifier(texte is None and bilan["lignes"] == 0, "10. aucun événement : aucun fichier")

print(f"reconstitution : {reussis} assertion(s) reussie(s), {echecs} echec(s)")
sys.exit(1 if echecs or not reussis else 0)
