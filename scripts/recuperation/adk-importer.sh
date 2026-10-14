#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# adk-importer.sh — rejoue UN import de GLB dans l'ADK (rebâtir les sources perdues).
#
#   bash scripts/recuperation/adk-importer.sh <manifeste.json> [VAR=valeur ...]
#   ex. bash scripts/recuperation/adk-importer.sh pnj NARVOS_SANS_SQUELETTE=1
#
# <manifeste> : nom (sans .json) sous adk/_manifests, ou chemin complet.
# Les variables NARVOS_* sont celles de scripts/adk-import-narvos.py ; elles viennent de
# l'historique de la commande d'origine, jamais d'une supposition.
#
# ⚠ UN SEUL UNREAL À LA FOIS : deux commandlets sur le même projet se disputent le
# registre d'assets et le DDC. Le script refuse de démarrer si un Unreal tourne.
# ⚠ Le journal du PROJET est le seul témoin : `journal()` écrit par `unreal.log`, pas sur
# stdout. On lit donc Saved/Logs/NanosWorldADK.log après coup.
# ══════════════════════════════════════════════════════════════════════════════
set -u

RACINE="E:/narvosprime-web-prototype"
ADK="$RACINE/WebPortal/Server/adk"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
JOURNAL="$ADK/Saved/Logs/NanosWorldADK.log"

manifeste="${1:?manifeste requis}"
shift
case "$manifeste" in
  *.json) ;;
  *) manifeste="$ADK/_manifests/$manifeste.json" ;;
esac
[ -f "$manifeste" ] || { echo "ARRET : manifeste introuvable $manifeste"; exit 1; }
[ -f "$UE" ] || { echo "ARRET : UnrealEditor-Cmd introuvable"; exit 1; }
if tasklist 2>/dev/null | grep -qi "UnrealEditor"; then
  echo "ARRET : un Unreal tourne deja."; exit 1
fi

for affectation in "$@"; do
  case "$affectation" in
    NARVOS_*=*) export "$affectation" ;;
    *) echo "ARRET : argument inattendu « $affectation » (attendu NARVOS_X=valeur)"; exit 1 ;;
  esac
done
export NARVOS_MANIFEST="$manifeste"

echo "=== import $(basename "$manifeste")  $(date +%H:%M:%S)  $*"
"$UE" "$ADK/NanosWorldADK.uproject" -run=pythonscript \
  -script="$RACINE/scripts/adk-import-narvos.py" -unattended -nosplash > /dev/null 2>&1
code=$?
echo "=== fin $(date +%H:%M:%S)  code $code"
# Le bilan de l'import, puis ce qui a mal tourné — par mot-clé, jamais par `tail`.
grep -a "\[NARVOS\]" "$JOURNAL" 2>/dev/null | sed 's/.*\[NARVOS\] //' \
  | grep -E "^manifeste|^import :|^registre|ARRET|ECHEC|echec|introuvable|^MODE|^destination" | cut -c1-200
echo "--- erreurs du journal : $(grep -acE 'Error:' "$JOURNAL" 2>/dev/null) ; plantage : $(grep -acE 'Assertion failed|Fatal error|Unhandled Exception' "$JOURNAL" 2>/dev/null)"
