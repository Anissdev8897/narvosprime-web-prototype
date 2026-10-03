#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# narvos-chaine-cheveux.sh — importe les coiffures Trooper, cuit, repackage.
#
#   bash scripts/narvos-chaine-cheveux.sh
#
# ── POURQUOI UN IMPORT À PART ─────────────────────────────────────────────────
# Les coiffures de SciFi_Trooper_Set portent leur PROPRE squelette : 2 os
# (`root_heaD`, `head_acc`) là où les pièces d'armure en ont 68. Mesuré le
# 2026-09-04 sur les 127 GLB du pack — 67 à 68 os, 60 à 2 os, sans recouvrement.
#
# `AddSkeletalMeshAttached` exige le même squelette que le corps : importées en
# SkeletalMesh, elles seraient refusées. On les importe donc en STATIC MESH
# (`NARVOS_STATIC=1`) pour les attacher au socket `head`, qui existe bien dans
# les 68 os du corps.
#
# ── UN SEUL UNREAL À LA FOIS ──────────────────────────────────────────────────
# Deux commandlets sur le même projet se marchent dessus : l'un verrouille le
# DDC, l'autre échoue sans le dire clairement. Ce script refuse de démarrer si
# un UnrealEditor tourne déjà — ça s'est produit une fois sur ce projet, avec
# deux chaînes lancées en parallèle sur Orbital et Tower.
# ══════════════════════════════════════════════════════════════════════════════

set -u

RACINE="E:/narvosprime-web-prototype"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
MANIFESTE="$RACINE/WebPortal/Server/adk/_manifests/trooper-cheveux.json"

horodate() { date +%H:%M:%S; }

if [ ! -f "$UE" ]; then echo "ARRET : UnrealEditor-Cmd introuvable"; exit 1; fi
if [ ! -f "$ADK" ]; then echo "ARRET : projet ADK introuvable"; exit 1; fi
if [ ! -f "$MANIFESTE" ]; then echo "ARRET : manifeste des coiffures absent"; exit 1; fi

if tasklist 2>/dev/null | grep -qi "UnrealEditor"; then
  echo "ARRET : un UnrealEditor tourne deja. Le fermer avant de relancer."
  exit 1
fi

echo "=== IMPORT  $(horodate) ==="
echo "  manifeste : $MANIFESTE"

# `NARVOS_SANS_SQUELETTE=1` : ces meshes n'ont pas le squelette du corps, les
# lier au notre produirait un remap silencieux et faux.
NARVOS_MANIFEST="$MANIFESTE" \
NARVOS_SANS_SQUELETTE=1 \
NARVOS_STATIC=1 \
"$UE" "$ADK" -run=pythonscript \
  -script="$RACINE/scripts/adk-import-narvos.py" \
  -unattended -nosplash > /dev/null 2>&1
CODE=$?

# ⚠ `journal()` ecrit par `unreal.log`, qui sort en `LogPython: [NARVOS] …` dans
# le JOURNAL DU PROJET — pas sur stdout. Filtrer stdout ne montrait donc AUCUN
# message NARVOS, et trois diagnostics ont ete faits a l'aveugle le 2026-09-04.
JOURNAL="$RACINE/WebPortal/Server/adk/Saved/Logs/NanosWorldADK.log"
if [ -f "$JOURNAL" ]; then
  grep "NARVOS" "$JOURNAL" | sed 's/.*\[NARVOS\] /  /' | tail -30
fi

echo "  code=$CODE  fin $(horodate)"

# Un import rate ne doit pas entrainer dix minutes de cook pour rien.
if grep -q "NARVOS. ARRET" "$JOURNAL" 2>/dev/null; then
  echo "ARRET : l'import a echoue, le cook est annule."
  exit 1
fi

echo
echo "=== COOK  $(horodate) ==="
"$UE" "$ADK" -run=Cook -targetplatform=Windows -unattended -nosplash 2>&1 | tail -5
echo "  fin $(horodate)"

echo
echo "=== INVENTAIRE  $(horodate) ==="
"$UE" "$ADK" -run=pythonscript \
  -script="$RACINE/scripts/adk-dump-assets.py" \
  -unattended -nosplash 2>&1 | grep -E "NARVOS" | tail -20

echo
echo "=== PACK  $(horodate) ==="
# ⚠ `--apply` OBLIGATOIRE. Sans lui le script SIMULE : il dit « Rien ecrit »
# et sort en code 0. Assets.toml reste perime, et la verification signale des
# references mortes pour des assets pourtant bien cuits. Piege du 2026-09-04.
node "$RACINE/scripts/nanos-build-asset-pack.mjs" --apply 2>&1 | tail -8

echo
echo "=== CATALOGUE  $(horodate) ==="
node "$RACINE/scripts/narvos-modular-to-lua.mjs" --apply 2>&1 | tail -12

echo
echo "=== VERIFICATION  $(horodate) ==="
node "$RACINE/scripts/narvos-verifier-catalogues.mjs" 2>&1 | tail -14

echo
echo "=== TERMINE  $(horodate) ==="