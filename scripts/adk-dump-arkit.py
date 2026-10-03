# ══════════════════════════════════════════════════════════════════════════════
# adk-dump-arkit.py — extrait la table de correspondance ARKit d'Epic.
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript
#       -script="D:/.../scripts/adk-dump-arkit.py"
#
# POURQUOI : nos têtes portent 52 morph targets — le compte exact du jeu ARKit —
# mais le glTF ne les nomme pas, alors Unreal les a numérotés
# `..._mesh_0_17_MorphTarget`. La géométrie est intacte, l'étiquette manque.
#
# Le plugin MetaHumanCharacter livre `AS_MetaHuman_ARKit_Mapping` : la table
# officielle d'Epic. On la LIT plutôt que d'écrire une liste ARKit de mémoire —
# c'est l'ORDRE qui compte, et se tromper d'ordre étiquette un sourire en
# clignement d'œil, sans que rien ne le signale.
#
# Sortie : un JSON consommé par `scripts/narvos-nommer-morphs.mjs`, qui écrit les
# noms dans les GLB avant réimport.
# ══════════════════════════════════════════════════════════════════════════════

import json
import os

import unreal

SORTIE = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_arkit-mapping.json"

CANDIDATS = [
    "/MetaHumanCharacter/Face/ARKit/PA_MetaHuman_ARKit_Mapping",
    "/MetaHumanCharacter/Face/ARKit/AS_MetaHuman_ARKit_Mapping",
]


def journal(message):
    unreal.log("[NARVOS] " + message)


def proprietes(objet, titre):
    """Déballe un asset inconnu : on ne sait pas encore sous quel nom la table
    est rangée, donc on regarde tout ce qui ressemble à une liste de noms."""
    journal("--- %s (%s)" % (titre, type(objet).__name__))
    trouve = {}
    for p in sorted(n for n in dir(objet) if not n.startswith("_")):
        try:
            v = objet.get_editor_property(p)
        except Exception:                                    # noqa: BLE001
            continue
        t = type(v).__name__
        if isinstance(v, (list, tuple)) and len(v) > 10:
            journal("    %-40s %s[%d]" % (p, t, len(v)))
            trouve[p] = v
        elif isinstance(v, unreal.Map) if hasattr(unreal, "Map") else False:
            journal("    %-40s Map[%d]" % (p, len(v)))
            trouve[p] = v
        else:
            texte = str(v)
            if len(texte) < 70:
                journal("    %-40s = %s" % (p, texte))
    return trouve


resultat = {"source": None, "noms": [], "brut": {}}

for chemin in CANDIDATS:
    actif = unreal.load_asset(chemin)
    if actif is None:
        journal("absent : %s" % chemin)
        continue

    journal("")
    tables = proprietes(actif, chemin)

    for cle, valeur in tables.items():
        # Une piste de courbe ARKit porte son nom : c'est ce qu'on cherche.
        try:
            noms = [str(x) for x in valeur]
        except Exception:                                    # noqa: BLE001
            continue
        if len(noms) >= 40:
            journal("    -> %d entrees sous '%s'" % (len(noms), cle))
            for n in noms[:8]:
                journal("         %s" % n)
            resultat["brut"][chemin + "#" + cle] = noms
            if len(noms) == 52 and not resultat["noms"]:
                resultat["source"] = chemin + "#" + cle
                resultat["noms"] = noms

journal("")
if resultat["noms"]:
    journal("TABLE RETENUE : %s (%d noms)" % (resultat["source"], len(resultat["noms"])))
else:
    journal("Aucune liste de 52 noms trouvee — voir 'brut' dans le JSON.")

os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
with open(SORTIE, "w", encoding="utf-8") as fh:
    json.dump(resultat, fh, indent=1, ensure_ascii=False)
journal("ecrit : %s" % SORTIE)