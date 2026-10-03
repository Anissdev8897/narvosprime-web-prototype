# ══════════════════════════════════════════════════════════════════════════════
# ue-remote.py — exécuter du Python DANS l'éditeur Unreal ouvert, depuis dehors.
#
#   python scripts/ue-remote.py --fichier scripts/adk-retarget-anims.py
#   python scripts/ue-remote.py --statement "import unreal; unreal.log('coucou')"
#   python scripts/ue-remote.py --noeuds
#
# ── POURQUOI CE SCRIPT EXISTE ─────────────────────────────────────────────────
#
# Le pont UnrealMCP (port 55557) expose des Blueprints, des acteurs et des
# matériaux — mais AUCUNE exécution de Python. Or tout le pipeline d'assets du
# projet est en Python `unreal` : retargeting, sondes de matériaux, audits de
# squelette. Sans ce chemin-là, chaque script doit être collé à la main dans la
# console de l'éditeur.
#
# Unreal a déjà la réponse : `PythonScriptPlugin` sait écouter des commandes
# distantes, et livre son propre client, `remote_execution.py`. On ne réinvente
# rien, on s'y branche.
#
# ── CE QU'IL FAUT ACTIVER, UNE SEULE FOIS ─────────────────────────────────────
#
# Éditeur ouvert → Edit > Project Settings > Plugins > Python
#                → cocher « Enable Remote Execution? »
#
# Ce réglage-là n'a PAS `ConfigRestartRequired` dans
# `PythonScriptPluginSettings.h:126` — contrairement à tous ses voisins. Il prend
# donc effet immédiatement, sans redémarrer l'éditeur.
#
# Il écrit `bRemoteExecution=True` dans `Config/DefaultEngine.ini`, section
# `[/Script/PythonScriptPlugin.PythonScriptPluginSettings]`. Écrire la ligne à la
# main pendant que l'éditeur tourne ne sert à rien : le fichier n'est relu qu'au
# démarrage. Passer par la case à cocher.
#
# ── PORTÉE ────────────────────────────────────────────────────────────────────
#
# UDP multicast 239.0.0.1:6766 avec TTL 0 — donc strictement local à la machine,
# rien ne sort de l'hôte. Le client ouvre ensuite une connexion TCP au nœud qui
# a répondu.
#
# S'il y a plusieurs éditeurs ouverts, `--noeuds` les liste et `--noeud <id>`
# choisit. Sans précision, on prend le seul nœud trouvé, et on refuse s'il y en a
# plusieurs plutôt que d'en tirer un au hasard.
# ══════════════════════════════════════════════════════════════════════════════

import argparse
import os
import sys
import time

# La sortie de l'editeur contient des caracteres hors cp1252 (accents,
# filets ──). Sur Windows, `print` vers un flux cp1252 leve
# UnicodeEncodeError et TUE le pilote alors que la commande distante, elle,
# a parfaitement tourne. Reconfigurer AVANT le premier print.
for flux in (sys.stdout, sys.stderr):
    try:
        flux.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

MOTEUR_PYTHON = os.environ.get(
    "UE_PYTHON_DIR",
    "D:/Epic Games/UE_5.7/Engine/Plugins/Experimental/PythonScriptPlugin/Content/Python",
)

if not os.path.isdir(MOTEUR_PYTHON):
    sys.exit("Dossier Python du moteur introuvable : %s\n"
             "Definir UE_PYTHON_DIR si le moteur est ailleurs." % MOTEUR_PYTHON)

sys.path.insert(0, MOTEUR_PYTHON)
import remote_execution  # noqa: E402

# Délai d'attente des « pong » multicast. Le broadcast ping est périodique : sous
# ~2 s on conclurait « aucun editeur » alors qu'il n'a pas encore répondu.
ATTENTE_NOEUDS_S = 5.0


def noeuds(rex, delai=ATTENTE_NOEUDS_S):
    """Attend qu'au moins un nœud réponde, ou rend une liste vide."""
    fin = time.time() + delai
    while time.time() < fin:
        trouves = rex.remote_nodes
        if trouves:
            return trouves
        time.sleep(0.25)
    return rex.remote_nodes


def choisir(trouves, demande):
    if demande:
        for n in trouves:
            if n["node_id"] == demande:
                return n
        sys.exit("Noeud inconnu : %s" % demande)
    if not trouves:
        sys.exit("Aucun editeur ne repond.\n"
                 "  · l'editeur est-il ouvert ?\n"
                 "  · « Enable Remote Execution? » est-il coche dans\n"
                 "    Project Settings > Plugins > Python ?")
    if len(trouves) > 1:
        print("Plusieurs editeurs repondent — preciser --noeud :")
        for n in trouves:
            print("   %s  %s" % (n["node_id"], n.get("project_name", "?")))
        sys.exit(1)
    return trouves[0]


def executer(args):
    rex = remote_execution.RemoteExecution()
    rex.start()
    try:
        trouves = noeuds(rex)

        if args.noeuds:
            if not trouves:
                print("Aucun noeud.")
                return 1
            for n in trouves:
                print("%s  projet=%s  moteur=%s"
                      % (n["node_id"], n.get("project_name", "?"), n.get("engine_version", "?")))
            return 0

        noeud = choisir(trouves, args.noeud)
        print("noeud : %s (%s)" % (noeud["node_id"], noeud.get("project_name", "?")))
        rex.open_command_connection(noeud["node_id"])

        if args.fichier:
            chemin = os.path.abspath(args.fichier)
            if not os.path.isfile(chemin):
                sys.exit("Fichier introuvable : %s" % chemin)
            # MODE_EXEC_FILE accepte un chemin de fichier : l'editeur le lit
            # lui-meme, en UTF-8. Passer le CONTENU marcherait aussi, mais on
            # perdrait les numeros de ligne dans les traces d'erreur.
            commande = chemin
            mode = remote_execution.MODE_EXEC_FILE
        elif args.code:
            # MODE_EXEC_FILE accepte AUSSI du code litteral multi-lignes, pas
            # seulement un chemin. MODE_EXEC_STATEMENT, lui, refuse tout ce qui
            # depasse une instruction : « multiple statements found while
            # compiling a single statement ».
            commande = args.code
            mode = remote_execution.MODE_EXEC_FILE
        else:
            commande = args.statement
            mode = remote_execution.MODE_EXEC_STATEMENT

        resultat = rex.run_command(commande, unattended=True, exec_mode=mode)

        for ligne in resultat.get("output") or []:
            print("%-7s %s" % (ligne.get("type", ""), ligne.get("output", "")))

        if resultat.get("result"):
            print("resultat : %s" % resultat["result"])

        if not resultat.get("success"):
            print("ECHEC")
            return 1
        return 0
    finally:
        rex.stop()


def principal():
    p = argparse.ArgumentParser(description="Executer du Python dans l'editeur Unreal ouvert.")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--fichier", help="Chemin d'un script .py a executer dans l'editeur.")
    g.add_argument("--statement", help="UNE instruction Python (une seule).")
    g.add_argument("--code", help="Code Python litteral, plusieurs lignes permises.")
    g.add_argument("--noeuds", action="store_true", help="Lister les editeurs qui repondent.")
    p.add_argument("--noeud", help="Identifiant du noeud, si plusieurs editeurs sont ouverts.")
    return executer(p.parse_args())


if __name__ == "__main__":
    sys.exit(principal())