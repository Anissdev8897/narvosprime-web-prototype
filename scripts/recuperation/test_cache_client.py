# -*- coding: utf-8 -*-
"""
test_cache_client.py — preuves de cache-client-nanos.py : le brouillage des .lua du
cache client de nanos se défait exactement, et rien d'illisible n'est posé.

  python scripts/recuperation/test_cache_client.py
"""
import importlib.util
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
spec = importlib.util.spec_from_file_location("cache_client", os.path.join(ICI, "cache-client-nanos.py"))
cc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cc)

reussis = echecs = 0
AS = chr(92)


def verifier(condition, nom):
    global reussis, echecs
    if condition:
        reussis += 1
    else:
        echecs += 1
        print("ECHEC :", nom)


CHEMIN = AS.join(["narvos-map-proto", "Client", "Ciel.lua"])
LUA = "-- ═══ Ciel ═══\nlocal Ciel = {}\nfunction Ciel.Poser(heure)\n\treturn heure % 24\nend\nreturn Ciel\n".encode("utf-8")

# ── 1. La clé : le chemin dans le cache, minuscules, barres obliques ─────────
verifier(cc.cle(CHEMIN) == b"narvos-map-proto/client/ciel.lua" and len(cc.cle(CHEMIN)) == 32,
         "1. clé = chemin en minuscules, barres obliques (32 octets pour Ciel.lua : la période observée)")

# ── 2. Brouiller puis rétablir rend le fichier, octet pour octet ─────────────
brouille = cc.combiner(LUA, CHEMIN)
verifier(brouille != LUA and cc.combiner(brouille, CHEMIN) == LUA, "2. la même opération brouille et rétablit")
verifier(cc.combiner(b"-- Point d'entree", AS.join(["narvos", "Shared", "Index.lua"]))[:3] == b"CLR",
         "2. « -- » sous le package `narvos…` devient « CLR » : ce n'est pas un en-tête de fichier")
verifier(cc.contenu_clair(brouille, CHEMIN) == LUA, "2. un .lua du cache est rendu en clair")

# ── 3. Ce qui n'est pas un .lua est déjà en clair : on n'y touche pas ────────
js = b"const a = 1;\n"
verifier(cc.contenu_clair(js, AS.join(["narvos-map-proto", "Client", "UI", "mort.js"])) == js, "3. un .js est rendu tel quel")
png = bytes(range(256))
verifier(cc.contenu_clair(png, AS.join(["narvos-map-proto", "Client", "UI", "img", "a.png"])) == png,
         "3. une image est rendue telle quelle")

# ── 4. Un .lua qui ne se déchiffre pas en texte sain n'est pas posé ──────────
autre = cc.combiner(LUA, AS.join(["narvos", "Shared", "Logic", "Ciel.lua"]))        # brouillé avec une AUTRE clé
verifier(cc.contenu_clair(autre, CHEMIN) is None, "4. mauvaise clé : refusé, pas posé en charabia")
verifier(cc.contenu_clair(bytes([0xFF, 0xFE, 0x00, 0x01]) * 40, CHEMIN) is None, "4. binaire : refusé")

# ── 5. Le vrai cache, s'il est là : tout .lua se déchiffre ───────────────────
if os.path.isdir(cc.CACHE):
    total = bons = 0
    for package in cc.PACKAGES:
        for dossier, _, noms in os.walk(os.path.join(cc.CACHE, package)):
            for nom in noms:
                if nom.lower().endswith(".lua"):
                    total += 1
                    chemin = os.path.join(dossier, nom)
                    with open(chemin, "rb") as f:
                        bons += cc.contenu_clair(f.read(), os.path.relpath(chemin, cc.CACHE)) is not None
    verifier(total > 0 and bons == total, f"5. cache réel : {bons}/{total} .lua déchiffrés")
else:
    print("(cache client absent : cas 5 sauté)")

print(f"cache client : {reussis} assertion(s) reussie(s), {echecs} echec(s)")
sys.exit(1 if echecs or not reussis else 0)
