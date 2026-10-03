#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# lot3.sh — le lot 3 du 2026-09-13 de bout en bout, sans intervention :
#
#   1. redirection /Game/InventorySystemPro/ COMMENTEE (l'export lit les Data
#      Assets a leur chemin d'origine) ;
#   2. session d'EDITEUR COMPLET (scripts/adk-session-lot3.py) : proxies de la
#      minimap, import des trois GLB, export ISP, retarget AI Behavior ;
#   3. redirection RETABLIE — quoi qu'il arrive (trap) ;
#   4. bilan de la session, puis .hermes/cook-lot3.sh (cook + toute la chaine).
#
#   bash .hermes/lot3.sh
#
# Bilan unique : .hermes/bilan_lot3_2026-09-13.log (le cook y ecrit a la suite).
# ══════════════════════════════════════════════════════════════════════════════
set -u
RACINE="E:/narvosprime-web-prototype"
UE_GUI="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
INI="$RACINE/WebPortal/Server/adk/Config/DefaultEngine.ini"
BILAN="$RACINE/.hermes/bilan_lot3_2026-09-13.log"
CONTENT="$RACINE/WebPortal/Server/adk/Content"
JOURNAL_ADK="$RACINE/WebPortal/Server/adk/Saved/Logs/NanosWorldADK.log"
# Garde-fou : une boite de dialogue que -unattended n'aurait pas levee bloquerait
# la nuit entiere. Mesure de reference : 66 animations a retargeter, 3 GLB.
DELAI_MAX_S=$((150 * 60))
cd "$RACINE" || exit 1

dire() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$BILAN"; }

redirect_isp() {
  # $1 = commenter | retablir. Python : le fichier est en CRLF, sed le casserait.
  python - "$INI" "$1" <<'PY'
import io, sys
chemin, geste = sys.argv[1], sys.argv[2]
s = io.open(chemin, encoding="utf-8", newline="").read()
ligne = '+PackageRedirects=(OldName="/Game/InventorySystemPro/",NewName="/Game/Narvos/InventorySystemPro/",MatchSubstring=true)'
commentee = ";LOT3-SESSION " + ligne
if geste == "commenter":
    if s.count(commentee) == 0 and s.count(ligne) == 1:
        s = s.replace(ligne, commentee)
else:
    s = s.replace(commentee, ligne)
io.open(chemin, "w", encoding="utf-8", newline="").write(s)
actives = sum(1 for l in s.splitlines() if l.startswith(ligne))
print("redirection ISP active : %d" % actives)
PY
}

if tasklist 2>/dev/null | grep -qi "UnrealEditor"; then dire "ARRET : un UnrealEditor tourne deja."; exit 1; fi
for D in InventorySystemPro AIBehaviorSystem Ako_Mini_Map_sys Narvos/Ako_Mini_Map_sys; do
  if [ ! -d "$CONTENT/$D" ]; then dire "ARRET : precondition absente : Content/$D"; exit 1; fi
done

dire "=== LOT 3 — session editeur"
dire "    $(redirect_isp commenter)"
trap 'dire "    $(redirect_isp retablir)"' EXIT

SESSION_LOG=".hermes/session_lot3_$(date +%H%M).log"
"$UE_GUI" "$ADK" -ExecutePythonScript="$RACINE/scripts/adk-session-lot3.py" -unattended -nosplash > "$SESSION_LOG" 2>&1 &
PID=$!
dire "    editeur lance (pid $PID), journal $SESSION_LOG"

ecoule=0
while kill -0 "$PID" 2>/dev/null; do
  sleep 30
  ecoule=$((ecoule + 30))
  if [ "$ecoule" -ge "$DELAI_MAX_S" ]; then
    dire "    DELAI DEPASSE ($((DELAI_MAX_S / 60)) min) : l'editeur lance par CE script est arrete."
    kill "$PID" 2>/dev/null
    sleep 10
    taskkill //F //IM UnrealEditor.exe > /dev/null 2>&1
    break
  fi
done
dire "    editeur termine apres $((ecoule / 60)) min"
sleep 20

dire "=== bilan de la session (journal de l'ADK, lignes [NARVOS])"
grep -a "\[NARVOS\] ===\|\[NARVOS\] BP_Narvos\|\[NARVOS\] import :\|\[NARVOS\] \[.*\] OK\|\[NARVOS\] .*ECHEC\|\[NARVOS\] .*EXCEPTION\|\[NARVOS\] .*retarget" "$JOURNAL_ADK" 2>/dev/null \
  | sed 's/.*\[NARVOS\] /    /' | tail -40 | tee -a "$BILAN"
dire "    proxies minimap : $(ls "$CONTENT"/Narvos/Minimap/BP_NarvosCarte*.uasset 2>/dev/null | wc -l)/3"
dire "    objets GLB      : $(find "$CONTENT/Narvos/divers" -name '*.uasset' 2>/dev/null | wc -l) paquet(s) sous Narvos/divers"
dire "    retarget        : $(find "$CONTENT/Narvos/AIBehaviorSystem/Retarget" -name '*.uasset' 2>/dev/null | wc -l) paquet(s)"

# La redirection doit etre RETABLIE avant le cook : cook-lot3.sh le verifie et
# s'arrete sinon. Le trap le refait a la sortie, sans effet si c'est deja fait.
dire "    $(redirect_isp retablir)"

dire "=== LOT 3 — cook et chaine"
bash .hermes/cook-lot3.sh