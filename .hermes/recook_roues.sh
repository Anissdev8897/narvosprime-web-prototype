#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# recook_roues.sh — recuire apres le vidage des collisions de roue, et PROUVER.
#
#   bash .hermes/recook_roues.sh
#
# Les 12 PhysicsAsset de City_Traffic_Pro ont ete modifies dans l'ADK
# (`scripts/adk-reparer-roues.py`) : 48 corps de roue vides de leur volume,
# verifie dans un processus NEUF. Le pack cuit, lui, porte encore les anciens.
#
# Le cook est INCREMENTAL : 12 assets modifies, pas 83 000. La mesure du
# 2026-09-10 donne 36 min a DDC chaude contre 3 h 08 a froid — ici on n'a change
# que 12 fichiers, ce devrait etre court. « Devrait » : c'est mesure a la fin.
#
# ⚠ Le pack d'assets est une JONCTION vers le depot. Le serveur nanos doit etre
# ARRETE : il lirait un Assets.toml a moitie reecrit.
# ══════════════════════════════════════════════════════════════════════════════
set -u

RACINE="E:/narvosprime-web-prototype"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
COOK="$RACINE/.hermes/cook_roues_$(date +%Y-%m-%d_%H%M).log"
DEBUT=$(date +%s)

dire() { echo "[$(date +%H:%M:%S)] $*"; }

# ── 0. Personne d'autre ne doit toucher au projet ────────────────────────────
if tasklist 2>/dev/null | grep -qi "UnrealEditor"; then
  dire "ARRET : un processus Unreal tourne deja. Deux Unreal sur le meme projet"
  dire "        corrompent le registre d'assets."
  exit 1
fi
if tasklist 2>/dev/null | grep -qi "NanosWorldServer"; then
  dire "ARRET : le serveur nanos tourne. Il lit le pack par une jonction ; le"
  dire "        cook le reecrirait sous ses pieds."
  exit 1
fi
dire "=== 0. voie libre (aucun Unreal, aucun serveur)"

# ── 1. Cook ──────────────────────────────────────────────────────────────────
# Invocation identique a celle du 2026-09-09 et du 2026-09-10 : c'est la seule
# dont on sache qu'elle a rendu « Packages Remain 0 » sur ce projet. Ne pas y
# ajouter de drapeau sans raison.
dire "=== 1. cook incremental (12 assets modifies)"
"$UE" "$ADK" -run=Cook -targetplatform=Windows -unattended -nosplash > "$COOK" 2>&1
dire "    le cook a rendu la main apres $(( ($(date +%s) - DEBUT) / 60 )) min"

if grep -qE "Packages Remain 0 " "$COOK"; then
  dire "    TEMOIN OK : Packages Remain 0"
else
  dire "    ARRET : « Packages Remain 0 » ABSENT."
  dire "    On NE reecrit PAS le pack a partir d'un cook partiel : Assets.toml"
  dire "    deviendrait faux et le serveur refuserait des assets pourtant presents."
  grep -oE "Cooked packages [0-9]+ Packages Remain [0-9]+" "$COOK" | tail -1
  exit 1
fi

# ── 2. Le pack ───────────────────────────────────────────────────────────────
# ⚠ `--apply` OBLIGATOIRE : sans le drapeau il SIMULE, ecrit « Rien ecrit. » et
# sort en code 0.
dire "=== 2. reconstruction du pack"
node "$RACINE/scripts/nanos-build-asset-pack.mjs" --apply 2>&1 | tail -6

# ── 3. LE TEMOIN QUI COMPTE ──────────────────────────────────────────────────
# Il ne mesure pas « le cook a tourne » ni « le pack a ete ecrit » : il relit les
# .uasset CUITS et compte les corps sur les os de roue. C'est la question posee.
dire "=== 3. temoin : les roues sont-elles libres dans le PACK ?"
node "$RACINE/scripts/narvos-phys-roues.mjs" 2>&1 | tail -4

# ── 4. Rien d'autre n'a bouge ────────────────────────────────────────────────
dire "=== 4. les catalogues pointent-ils toujours juste ?"
node "$RACINE/scripts/narvos-verifier-catalogues.mjs" 2>&1 | tail -4

dire "=== TERMINE en $(( ($(date +%s) - DEBUT) / 60 )) min ==="
dire "    journal du cook : $COOK"