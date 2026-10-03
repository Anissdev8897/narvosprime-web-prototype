#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# session-skinning-client.sh — recuire sans les reglages MetaHuman que le client
# nanos n'a pas (index d'os 16 bits, influences illimitees, chunking experimental).
# 2026-09-13 soir.
#
# VU EN JEU : du MetaHuman, seules les tongs. /diag client : squelette parfait,
# rien de dessine. Editeur : tout rendu. Seul ecart ADK / client : ces reglages.
#
#   bash .hermes/session-skinning-client.sh
#
# Bilan : .hermes/bilan_skinning_2026-09-13.log
# ══════════════════════════════════════════════════════════════════════════════
set -u
RACINE="E:/narvosprime-web-prototype"
BILAN="$RACINE/.hermes/bilan_skinning_2026-09-13.log"
PACK="$RACINE/WebPortal/Server/Assets/narvos/Narvos"
LOGS="$RACINE/WebPortal/Server/adk/Saved/Logs"
CORPS="$PACK/MetaCustom/Metahuman_Ref/MCSGavin/Male/Tall/NormalWeight/Body/m_tal_nrw_body.uexp"
VISAGE="$PACK/MetaCustom/Metahuman_Ref/MCSGavin/Face/MCSGavin_FaceMesh.uexp"
cd "$RACINE" || exit 1

dire() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$BILAN"; }

dire "=== 0. preconditions"
node scripts/lua-harness/rendu-client-check.mjs 2>&1 | tee -a "$BILAN"
if [ "${PIPESTATUS[0]}" -ne 0 ]; then dire "ARRET : rendu ADK != client"; exit 1; fi
if ! node scripts/lua-harness/redirects-idempotents-check.mjs > /dev/null 2>&1; then dire "ARRET : redirects"; exit 1; fi
if tasklist 2>/dev/null | grep -qi "UnrealEditor"; then dire "ARRET : un Unreal tourne"; exit 1; fi
AVANT_CORPS=$(stat -c %s "$CORPS" 2>/dev/null); AVANT_VISAGE=$(stat -c %s "$VISAGE" 2>/dev/null)
dire "    avant : corps .uexp $AVANT_CORPS o, visage .uexp $AVANT_VISAGE o"

dire "=== 1. chaine de cook (le pack attend la fermeture de nanos)"
bash scripts/narvos-chaine-cook.sh > .hermes/chaine_skinning.log 2>&1
CODE=$?
grep -aE "^===|ARRET|attente|reference\(s\) morte|morte\(s\)|BLOQUANT|IDENTITE" .hermes/chaine_skinning.log | head -60 | tee -a "$BILAN"
if [ "$CODE" -ne 0 ] || ! grep -q "=== TERMINE" .hermes/chaine_skinning.log; then
  dire "ARRET : chaine incomplete (code $CODE)"; exit 1
fi

dire "=== 2. preuves cuites"
APRES_CORPS=$(stat -c %s "$CORPS" 2>/dev/null); APRES_VISAGE=$(stat -c %s "$VISAGE" 2>/dev/null)
dire "    corps .uexp : $AVANT_CORPS -> $APRES_CORPS o ; visage .uexp : $AVANT_VISAGE -> $APRES_VISAGE o (un format de sommets different change la taille)"
COOK_LOG=$(grep -l "Packages Remain 0" $(ls -t "$LOGS"/NanosWorldADK*.log) 2>/dev/null | head -1)
dire "    journal du cook : $(basename "$COOK_LOG")"
dire "    avertissements skinning : $(grep -a -ciE "bone influence|16.?bit bone|MaxBonesPerChunk|too many bones|exceeds.*bones" "$COOK_LOG")"
grep -a -iE "bone influence|16.?bit bone|MaxBonesPerChunk|too many bones|exceeds.*bones" "$COOK_LOG" | sed -E 's/^\[[^]]*\]\[[^]]*\]//' | sort | uniq -c | sort -rn | head -8 | tee -a "$BILAN"
python scripts/narvos-echecs-materiaux.py "$COOK_LOG" WebPortal/Server/adk/_manifests/openworlds-foret-restauration.json 2>&1 | sed 's/^/    foret : /' | tee -a "$BILAN"
node scripts/narvos-modules-client-absents.mjs > .hermes/modules_absents_skinning.log 2>&1
grep -E "^BLOQUANT|^COMPILATION|absent\(s\) du client" .hermes/modules_absents_skinning.log | tee -a "$BILAN"
node scripts/lua-harness/tout.mjs > .hermes/batterie_skinning.log 2>&1
grep -E "harnais ·" .hermes/batterie_skinning.log | tee -a "$BILAN"
dire "FIN"