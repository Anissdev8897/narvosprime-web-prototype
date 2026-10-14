#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# adk-lancer.sh — lance UN script Python de l'ADK en commandlet, et rend son bilan.
#
#   bash scripts/recuperation/adk-lancer.sh <script.py> [NARVOS_X=valeur ...] [--projet <uproject>]
#   ex. bash scripts/recuperation/adk-lancer.sh adk-promouvoir-packs.py NARVOS_PACKS=Sewer
#       bash scripts/recuperation/adk-lancer.sh adk-promouvoir-packs.py NARVOS_PACKS=Sewer NARVOS_APPLIQUER=1
#
# <script.py> : chemin sous scripts/ (`recuperation/x.py` compris), ou chemin complet. `adk-importer.sh` reste la porte des
# imports (il connaît le manifeste) ; celui-ci sert à tout le reste — promotion, inventaire,
# vérifications — avec les mêmes règles.
#
# ⚠ UN SEUL UNREAL À LA FOIS : refuse de démarrer si un Unreal tourne.
# ⚠ Le journal du PROJET est le seul témoin (`unreal.log` n'écrit pas sur stdout), et le
# code de sortie d'un commandlet ne dit rien : on lit les lignes [NARVOS], par mot-clé.
# ⚠ Variables passées en ARGUMENT, pas en préfixe de commande : Git Bash réécrit toute
# valeur commençant par `/` (`/Game/X` → `C:/Program Files/Git/Game/X`).
# ══════════════════════════════════════════════════════════════════════════════
set -u

RACINE="E:/narvosprime-web-prototype"
PROJET="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"

script="${1:?script requis}"
shift
case "$script" in
  [A-Za-z]:*|/*) ;;
  *) script="$RACINE/scripts/$script" ;;
esac
[ -f "$script" ] || { echo "ARRET : script introuvable $script"; exit 1; }
[ -f "$UE" ] || { echo "ARRET : UnrealEditor-Cmd introuvable"; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --projet) PROJET="${2:?--projet demande un .uproject}"; shift ;;
    NARVOS_*=*) export MSYS_NO_PATHCONV=1; export "$1" ;;
    *) echo "ARRET : argument inattendu « $1 » (attendu NARVOS_X=valeur ou --projet)"; exit 1 ;;
  esac
  shift
done
[ -f "$PROJET" ] || { echo "ARRET : projet introuvable $PROJET"; exit 1; }
if tasklist 2>/dev/null | grep -qi "UnrealEditor"; then
  echo "ARRET : un Unreal tourne deja."; exit 1
fi
JOURNAL="$(dirname "$PROJET")/Saved/Logs/$(basename "$PROJET" .uproject).log"

echo "=== $(basename "$script")  $(date +%H:%M:%S)  $(env | grep -E '^NARVOS_' | tr '\n' ' ')"
"$UE" "$PROJET" -run=pythonscript -script="$script" -unattended -nosplash > /dev/null 2>&1
code=$?
echo "=== fin $(date +%H:%M:%S)  code $code (ne prouve rien : lire ci-dessous)"
grep -a "\[NARVOS\]" "$JOURNAL" 2>/dev/null | sed 's/.*\[NARVOS\] //' | awk '!vu[$0]++' | cut -c1-220
echo "--- erreurs du journal : $(grep -acE 'Error:' "$JOURNAL" 2>/dev/null) ; plantage : $(grep -acE 'Assertion failed|Fatal error|Unhandled Exception' "$JOURNAL" 2>/dev/null)"
