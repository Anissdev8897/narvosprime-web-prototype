# -*- coding: utf-8 -*-
"""
lots.py — où DMDE a rendu quoi, et à quel endroit du projet cela correspond.

Partagé par indexer-dmde.py (qui rapproche les fichiers sains du projet) et
assembler-final.py (qui remonte le projet). Une seule table : deux copies
divergeraient au premier lot ajouté.
"""
import os

PROJET = r"E:\narvosprime-web-prototype"
LOTS = r"E:\mes_projet"
RESTAURE = os.path.join(LOTS, "narvos-restaure")
# ⚠ Hermes avait étiqueté ce lot « outil-react » : c'est la RACINE de WebPortal
# (src, wasm, tools…), retrouvée le 01/10/2026.
WEB = os.path.join(RESTAURE, "scripts-astra", "outil-react", "$F66389")
RACINE = os.path.join(RESTAURE, "racine-projet")
# Pas un lot de DMDE : la copie que le CLIENT nanos gardait sur C: de `narvos/Shared` et
# `narvos-map-proto/Client`, déchiffrée par cache-client-nanos.py. État FINAL de ces
# fichiers (voir l'en-tête de l'outil) : ils se traitent comme des fichiers sains du disque.
CACHE_CLIENT = os.path.join(LOTS, "cache-client-nanos", "packages")

# (dossier rendu par DMDE, chemin relatif dans le projet) — le chemin d'origine est
# CONNU : un fichier de ces dossiers va à sa place, sans avoir à le reconnaître.
COPIES = [
    (os.path.join(WEB, "src"), r"WebPortal\src"),
    (os.path.join(WEB, "wasm"), r"WebPortal\wasm"),
    (os.path.join(WEB, "tools"), r"WebPortal\tools"),
    (os.path.join(WEB, "_legacy_archive"), r"WebPortal\_legacy_archive"),
    (os.path.join(WEB, "smoke-results"), r"WebPortal\smoke-results"),
    (os.path.join(RACINE, "scripts"), r"WebPortal\scripts"),
    (os.path.join(RACINE, "Prototype"), r"WebPortal\Prototype"),
    (os.path.join(RACINE, "reports"), r"WebPortal\reports"),
    (os.path.join(RACINE, "renderer"), r"WebPortal\renderer"),
    (os.path.join(RACINE, "$F00191", "docs"), r"docs"),
    (CACHE_CLIENT, r"WebPortal\Server\nanos_world\packages"),
]
# (cible de la jonction, chemin relatif dans le projet) — gros lots d'assets : jamais
# copiés, une JONCTION pointe vers le lot (même volume, zéro octet déplacé).
JONCTIONS = [
    (os.path.join(RACINE, "public"), r"WebPortal\public"),
    (os.path.join(RACINE, "Server", "adk"), r"WebPortal\Server\adk"),
    (os.path.join(RACINE, "$F00191", "archive"), r"archive_recupere"),
    (os.path.join(RACINE, "$F00191", "asset_decompile"), r"asset_decompile"),
    (os.path.join(RACINE, "$F00191", "Assets"), r"Assets"),
    (os.path.join(RACINE, "$F00191", "inpi"), r"inpi"),
]
# Ce qui, sous LOTS, n'est PAS un lot rendu par DMDE : nos propres sorties, et le lot
# qu'Hermes a RÉÉCRIT après la perte (ce ne sont pas des fichiers du disque).
DERIVES = ("narvos-reconstruit", "narvos-fusion", "narvos-base", "narvos-rebuild", "_ecartes", "_avant_")
IGNORES = {"node_modules", ".git", ".vite", "__pycache__", "DerivedDataCache", "Intermediate", "Saved", "Binaries"}
MARQUES = ("[TROU —", "[ANCIENNE VERSION", "[FIN INCONNUE", "[DERNIÈRE VERSION", "[SÛRE ",
           "[MODIFICATIONS NON REPLACÉES")


def chemin_connu(fichier):
    """Le chemin dans le projet d'un fichier rendu à sa place par DMDE, ou None."""
    bas = os.path.normcase(fichier)
    for source, rel in COPIES:
        s = os.path.normcase(source) + os.sep
        if bas.startswith(s):
            return os.path.join(rel, fichier[len(s):])
    return None
