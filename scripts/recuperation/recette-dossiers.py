# -*- coding: utf-8 -*-
"""
recette-dossiers.py — pour chaque dossier de `/Game/Narvos` que DMDE n'a pas rendu, croise
les faits qui disent COMMENT le rebâtir, et avec quelle urgence.

Ne décide rien tout seul : il aligne, par dossier, cinq colonnes mesurées —
  · manquants  : paquets attendus par l'inventaire du 23/09 et absents (etat-adk.py) ;
  · besoin jeu : le dossier est-il appelé par le Lua (narvos::Clé) — donc nécessaire au jeu ;
  · copie pack : tous ses paquets sont la copie octet pour octet d'un pack d'origine
                 (restaurer-copies-de-packs.py) → recopie, sans éditeur ;
  · GLB source : des GLB existent sous public/models pour ce dossier → réimport Interchange ;
  · dernière recette : la commande qui a écrit ces paquets en dernier (historique).

La colonne « recette » est une DÉDUCTION de ces faits, marquée comme telle.

  python recette-dossiers.py                     # le tableau
  python recette-dossiers.py --json <fichier>    # pour un autre outil

Dépend des sondes de session (sous le scratchpad), passées en option si déplacées :
  --jumeaux <json>  --besoins <json>  --glb <tsv>  --fantome <tsv>
"""
import collections
import datetime
import importlib.util
import json
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

# `etat-adk.py` porte un tiret : import par chemin (la logique « attendus / présents » vit là
# et nulle part ailleurs, pour ne pas en tenir deux copies).
_spec = importlib.util.spec_from_file_location("etat_adk", os.path.join(ICI, "etat-adk.py"))
E = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(E)


def option(nom, defaut=None):
    return sys.argv[sys.argv.index(nom) + 1] if nom in sys.argv else defaut


SCRATCH = option("--scratch",
                 r"C:\Users\aniss\AppData\Local\Temp\claude\D--mes-projet-narvosprime-web-prototype"
                 r"\c5bc94d0-912d-414c-84ac-36e52b2548ee\scratchpad")
JUMEAUX = option("--jumeaux", os.path.join(SCRATCH, "jumeaux_originaux.json"))
BESOINS = option("--besoins", os.path.join(SCRATCH, "besoins_du_jeu.json"))
GLB = option("--glb", os.path.join(SCRATCH, "sources_glb.tsv"))
FANTOME = option("--fantome", os.path.join(SCRATCH, "f09232_inventaire.tsv"))


def charger_json(p, defaut):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return defaut


# ── Les faits ─────────────────────────────────────────────────────────────────────────────
attendus = E.lire_inventaire()
presents = E.paquets_du_disque()
tableau = E.tableau(attendus, presents)
incomplets = {n: v for n, v in tableau.items() if v["manquants"]}

jumeaux = charger_json(JUMEAUX, {})       # dossier -> {"jumeau":[...], "seul":[...]}
besoins = charger_json(BESOINS, {})       # jeton -> {"candidats":[paquets], "etat":...}
besoin_dossier = collections.Counter()
for b in besoins.values():
    for p in b.get("candidats", []):
        if p.startswith("/Game/Narvos/"):
            besoin_dossier[p.split("/")[3]] += 1
            break

# GLB présents, par dossier de public/models (approché par le nom de dossier).
glb_present = collections.Counter()
try:
    with open(GLB, encoding="utf-8") as f:
        for ligne in f:
            rel = ligne.split("\t")[0]
            for m in rel.replace("/", "\\").split("\\"):
                glb_present[m.lower()] += 1
except OSError:
    pass

# Dernière date d'écriture d'un dossier (lot fantôme) + sous-dossiers.
derniere = {}
try:
    with open(FANTOME, encoding="utf-8") as f:
        for ligne in f:
            c = ligne.rstrip("\n").split("\t")
            if len(c) >= 3:
                d = c[0].split("\\")[0]
                derniere[d] = max(derniere.get(d, 0), int(c[2]))
except OSError:
    pass


def recette(nom, v):
    """Déduction, à partir des faits, de la façon de rebâtir — ou None si incertain."""
    j = jumeaux.get(nom, {})
    copie_totale = j.get("jumeau") and not j.get("seul")
    glb = glb_present.get(nom.lower(), 0)
    if copie_totale:
        return "copie de pack (restaurer-copies-de-packs.py)"
    if glb >= max(3, len(v["manquants"]) // 20):
        return f"réimport GLB ({glb} sous public/models) — adk-importer.sh"
    if j.get("jumeau"):
        return f"copie partielle ({len(j['jumeau'])}/{len(j['jumeau']) + len(j.get('seul', []))}) + éditeur"
    return "ÉDITEUR / création (aucune source directe)"


lignes = []
for nom, v in sorted(incomplets.items(), key=lambda x: (-besoin_dossier.get(x[0], 0), -len(x[1]["manquants"]))):
    d = derniere.get(nom)
    lignes.append({
        "dossier": nom,
        "manquants": len(v["manquants"]),
        "besoin_jeu": besoin_dossier.get(nom, 0),
        "copie_pack": len(jumeaux.get(nom, {}).get("jumeau", [])),
        "glb": glb_present.get(nom.lower(), 0),
        "derniere_ecriture": datetime.datetime.fromtimestamp(d).strftime("%m-%d") if d else "",
        "recette": recette(nom, v),
    })

print(f"{'dossier':32} {'manq.':>6} {'jeu':>4} {'copie':>5} {'glb':>5} {'écrit':>6}  recette déduite")
for r in lignes:
    print(f"{r['dossier']:32} {r['manquants']:6} {r['besoin_jeu']:4} {r['copie_pack']:5} {r['glb']:5} "
          f"{r['derniere_ecriture']:>6}  {r['recette']}")
par_recette = collections.Counter(r["recette"].split(" (")[0].split(" —")[0] for r in lignes)
print("\nrésumé :", ", ".join(f"{k}×{v}" for k, v in par_recette.most_common()))
besoin_sans_source = [r["dossier"] for r in lignes if r["besoin_jeu"] and "ÉDITEUR" in r["recette"]]
print("appelés par le jeu et SANS source directe :", ", ".join(besoin_sans_source) or "aucun")
if "--json" in sys.argv:
    with open(sys.argv[sys.argv.index("--json") + 1], "w", encoding="utf-8", newline="\n") as f:
        json.dump(lignes, f, ensure_ascii=False, indent=1)
