#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# adk-session.sh — lance UN script Python dans l'EDITEUR COMPLET de l'ADK, garde sa duree,
# et rend son journal. Le script doit fermer l'editeur lui-meme (`quit_editor`, en `finally`).
#
#   bash scripts/recuperation/adk-session.sh <script.py> [NARVOS_X=valeur ...]
#   ex. bash scripts/recuperation/adk-session.sh recuperation/adk-session-monde.py
#
# <script.py> : chemin sous scripts/, ou chemin complet.
#
# QUAND L'EDITEUR COMPLET ET PAS LE COMMANDLET (`adk-lancer.sh`) : des qu'on sauve un
# UMaterial (un commandlet l'ampute de son graphe), qu'on edite un niveau, ou un graphe.
#
# ⚠ Ouvre la fenetre d'Unreal Editor sur le bureau, et la referme. Rien d'autre ne doit
# tourner : ni Unreal, ni serveur ni client nanos.
# ⚠ `-unattended` ne leve pas toutes les boites de dialogue : d'ou la garde de duree
# (NARVOS_DELAI_MIN, 90 par defaut), qui arrete l'editeur lance par CE script.
# ══════════════════════════════════════════════════════════════════════════════
set -u
RACINE="E:/narvosprime-web-prototype"
UE_GUI="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
JOURNAL="$RACINE/WebPortal/Server/adk/Saved/Logs/NanosWorldADK.log"

script="${1:?script requis}"
shift
case "$script" in
  [A-Za-z]:*|/*) ;;
  *) script="$RACINE/scripts/$script" ;;
esac
[ -f "$script" ] || { echo "ARRET : script introuvable $script"; exit 1; }
[ -f "$UE_GUI" ] || { echo "ARRET : UnrealEditor.exe introuvable"; exit 1; }
for affectation in "$@"; do
  case "$affectation" in
    NARVOS_*=*) export MSYS_NO_PATHCONV=1; export "$affectation" ;;
    *) echo "ARRET : argument inattendu « $affectation » (attendu NARVOS_X=valeur)"; exit 1 ;;
  esac
done
if tasklist 2>/dev/null | grep -qi "UnrealEditor"; then echo "ARRET : un Unreal tourne deja."; exit 1; fi
if tasklist 2>/dev/null | grep -qiE "NanosWorldServer|NanosWorld\.exe"; then echo "ARRET : nanos tourne."; exit 1; fi
DELAI_MAX_S=$(( ${NARVOS_DELAI_MIN:-90} * 60 ))

echo "=== session editeur : $(basename "$script")  $(date +%H:%M:%S)"
"$UE_GUI" "$ADK" -ExecutePythonScript="$script" -unattended -nosplash > /dev/null 2>&1 &
PID=$!
ecoule=0
while kill -0 "$PID" 2>/dev/null; do
  sleep 15
  ecoule=$((ecoule + 15))
  if [ "$ecoule" -ge "$DELAI_MAX_S" ]; then
    echo "    DELAI DEPASSE ($((DELAI_MAX_S / 60)) min) : l'editeur lance par CE script est arrete."
    kill "$PID" 2>/dev/null
    sleep 10
    taskkill //F //IM UnrealEditor.exe > /dev/null 2>&1
    break
  fi
done
echo "=== editeur termine apres $((ecoule / 60)) min $((ecoule % 60)) s  ($(date +%H:%M:%S))"
sleep 10
grep -a "\[NARVOS\]" "$JOURNAL" 2>/dev/null | sed 's/.*\[NARVOS\] //' | awk '!vu[$0]++' | cut -c1-230
echo "--- erreurs du journal : $(grep -acE 'Error:' "$JOURNAL" 2>/dev/null) ; plantage : $(grep -acE 'Assertion failed|Fatal error|Unhandled Exception' "$JOURNAL" 2>/dev/null)"
