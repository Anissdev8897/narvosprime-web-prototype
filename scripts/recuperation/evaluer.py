# -*- coding: utf-8 -*-
"""
evaluer.py — mesure une extraction contre la VÉRITÉ DU DISQUE : les fichiers que
DMDE a rendus sains, pour lesquels on connaît donc le contenu réel au 26/09.

Ce n'est pas un test de non-régression de l'extracteur seul : une partie des
écarts est irréductible (fichier modifié par un agent ou une main dont
l'historique n'est pas dans nos sources). C'est une mesure COMPARATIVE : entre
deux versions de l'extracteur, celle qui colle le mieux au disque est la meilleure.

  python evaluer.py <dossier d'extraction> [<autre dossier> ...]
"""
import difflib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sante import texte_sain, TEXTE  # noqa: E402

from lots import WEB, RACINE, MARQUES, CACHE_CLIENT  # noqa: E402

VERITE = [
    (os.path.join(WEB, "src"), r"WebPortal\src"),
    (os.path.join(WEB, "wasm"), r"WebPortal\wasm"),
    (os.path.join(RACINE, "scripts"), r"WebPortal\scripts"),
    (os.path.join(RACINE, "Prototype"), r"WebPortal\Prototype"),
    (os.path.join(RACINE, "reports"), r"WebPortal\reports"),
]
# Seconde vérité, trouvée le 02/10/2026 : le cache du client nanos (cache-client-nanos.py),
# état FINAL de `narvos/Shared` et `narvos-map-proto/Client`. C'est la seule mesure qu'on
# ait sur le code Lua — et `Server/`, que le client ne reçoit pas, n'a que les historiques.
VERITE_CACHE = [(CACHE_CLIENT, os.path.join("WebPortal", "Server", "nanos_world", "packages"))]
GROUPES = [("runtime web (fichiers sains de DMDE)", VERITE), ("packages nanos (cache du client)", VERITE_CACHE)]


def norme(b):
    return [l.rstrip("\r") for l in b.decode("utf-8", "replace").replace("\r\n", "\n").rstrip("\n").split("\n")]


def evaluer(extraction, titre="runtime web (fichiers sains de DMDE)", verites=None):
    base = os.path.join(extraction, "fichiers")
    n = {"compares": 0, "identiques": 0, "complets_differents": 0, "incomplets": 0, "absents": 0}
    sim_diff, sim_incomplets, lignes_fausses, lignes_totales = [], [], 0, 0
    for verite, rel in (VERITE if verites is None else verites):
        for d, dirs, fichiers in os.walk(verite):
            dirs[:] = [x for x in dirs if x not in ("node_modules", "build", "build_old", "build_fail")]
            for f in fichiers:
                p = os.path.join(d, f)
                r = os.path.join(base, rel, os.path.relpath(p, verite))
                if not os.path.exists(r):
                    # Un vrai fichier texte dont l'extraction ne sait rien : jamais lu par un agent.
                    n["absents"] += os.path.splitext(f)[1].lower() in TEXTE
                    continue
                a = open(p, "rb").read()
                if not texte_sain(a):
                    continue
                vrai = norme(a)
                recon = norme(open(r, "rb").read())
                n["compares"] += 1
                incomplet = any(m in l for l in recon for m in MARQUES)
                utiles = [l for l in recon if not any(m in l for m in MARQUES)]
                if not incomplet and recon == vrai:
                    n["identiques"] += 1
                    continue
                ratio = difflib.SequenceMatcher(None, utiles, vrai, autojunk=False).ratio()
                # Lignes posées qui n'existent NULLE PART dans le vrai fichier : du faux.
                ensemble = set(vrai)
                lignes_fausses += sum(1 for l in utiles if l not in ensemble)
                lignes_totales += len(utiles)
                if incomplet:
                    n["incomplets"] += 1
                    sim_incomplets.append(ratio)
                else:
                    n["complets_differents"] += 1
                    sim_diff.append(ratio)
    moy = lambda x: (sum(x) / len(x)) if x else 0.0
    print(f"{extraction} — {titre}")
    print(f"  comparés {n['compares']} | identiques au disque {n['identiques']} "
          f"({100 * n['identiques'] // max(n['compares'], 1)} %) | vrais fichiers inconnus de l'extraction {n['absents']}")
    print(f"  complets mais différents {n['complets_differents']} (ressemblance moyenne {moy(sim_diff):.3f})")
    print(f"  incomplets {n['incomplets']} (ressemblance moyenne {moy(sim_incomplets):.3f})")
    print(f"  lignes posées absentes du vrai fichier : {lignes_fausses} / {lignes_totales} "
          f"({100.0 * lignes_fausses / max(lignes_totales, 1):.2f} %)")


if __name__ == "__main__":
    for e in sys.argv[1:]:
        for titre, verites in GROUPES:
            evaluer(e, titre, verites)
