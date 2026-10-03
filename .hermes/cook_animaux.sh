#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# cook_animaux.sh — cuire les 41 especes importees, et PROUVER qu'elles sont la.
#
#   bash .hermes/cook_animaux.sh
#
# Les 41 SkeletalMesh sont dans `Content/Narvos/JSAnimals/` (import verifie dans
# un processus neuf : 41/41 sous le nom promis, tous SkeletalMesh). Le pack cuit,
# lui, ne les connait pas : `Catalogs/Animaux.lua` porte `cuit = false` pour les
# 41, et l'executant refuse donc toute invocation.
#
# ⚠ Le pack d'assets est une JONCTION vers le depot. Le serveur nanos doit etre
# ARRETE : il lirait un Assets.toml a moitie reecrit.
# ══════════════════════════════════════════════════════════════════════════════
set -u

RACINE="E:/narvosprime-web-prototype"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
COOK="$RACINE/.hermes/cook_animaux_$(date +%Y-%m-%d_%H%M).log"
TOML="$RACINE/WebPortal/Server/Assets/narvos/Assets.toml"
DEBUT=$(date +%s)

dire() { echo "[$(date +%H:%M:%S)] $*"; }

if tasklist 2>/dev/null | grep -qi "UnrealEditor"; then
  dire "ARRET : un processus Unreal tourne deja."
  exit 1
fi
if tasklist 2>/dev/null | grep -qi "NanosWorldServer"; then
  dire "ARRET : le serveur nanos tourne — il lit le pack par une jonction."
  exit 1
fi
dire "=== 0. voie libre"

AVANT=$(grep -cE '= "Narvos/JSAnimals/' "$TOML" 2>/dev/null; true)
dire "    cles JSAnimals dans Assets.toml AVANT : ${AVANT:-0}"

dire "=== 1. cook"
"$UE" "$ADK" -run=Cook -targetplatform=Windows -unattended -nosplash > "$COOK" 2>&1
dire "    le cook a rendu la main apres $(( ($(date +%s) - DEBUT) / 60 )) min"

if grep -qE "Packages Remain 0 " "$COOK"; then
  dire "    TEMOIN OK : Packages Remain 0"
else
  dire "    ARRET : « Packages Remain 0 » ABSENT — cook partiel."
  dire "    On NE reecrit PAS le pack a partir d'un cook partiel."
  grep -oE "Cooked packages [0-9]+ Packages Remain [0-9]+" "$COOK" | tail -1
  exit 1
fi

# ⚠ L'INVENTAIRE, ENTRE LE COOK ET LE PACK. NE PAS SAUTER CETTE ETAPE.
#
# `nanos-build-asset-pack.mjs` ne classe pas les assets par leur nom (essaye,
# rate : 44 SkeletalMesh sur 611 portent `SK_`). Il lit `_assets-inventory.json`,
# produit depuis le REGISTRE d'Unreal. Un asset absent de cet inventaire est
# copie dans le pack et declare NULLE PART.
#
# Incident du 2026-09-10 : ce script, copie de `recook_roues.sh` ou aucun asset
# neuf n'apparaissait, avait perdu cette etape. Les 41 especes ont ete cuites
# (204 uassets), copiees (204 fichiers), et Assets.toml en declarait ZERO.
dire "=== 2. inventaire (le registre, pas les noms de fichiers)"
"$UE" "$ADK" -run=pythonscript -script="$RACINE/scripts/adk-dump-assets.py" \
  -unattended -nosplash -nopause > /dev/null 2>&1
dire "    inventaire : $(grep -c JSAnimals "$RACINE/WebPortal/Server/adk/_assets-inventory.json") entree(s) JSAnimals"

dire "=== 3. reconstruction du pack"
node "$RACINE/scripts/nanos-build-asset-pack.mjs" --apply 2>&1 | tail -4

# ── LE TEMOIN QUI COMPTE ─────────────────────────────────────────────────────
# Pas « le cook a tourne » : le nombre de SkeletalMesh d'animaux DECLARES. Une
# chaine comptee au lieu de la chose comptee a deja fait annoncer « P1 debloque »
# sur 88 voitures statiques.
APRES=$(grep -cE '^\s*SK_[A-Za-z0-9_]+ = "Narvos/JSAnimals/' "$TOML" 2>/dev/null; true)
ANIMS=$(grep -cE '^\s*A_[A-Za-z0-9_]+ = "Narvos/JSAnimals/' "$TOML" 2>/dev/null; true)
dire "=== 4. temoin"
dire "    SkeletalMesh d'animaux declares : ${APRES:-0}   (attendu : 41)"
dire "    AnimSequence declarees          : ${ANIMS:-0}  (attendu : 227)"

dire "=== 5. bascule des drapeaux du catalogue"
node "$RACINE/scripts/narvos-animaux-to-lua.mjs" --apply 2>&1 | head -4

dire "=== 6. le harnais relit tout"
node "$RACINE/scripts/lua-harness/animaux.mjs" 2>&1 | tail -4

dire "=== 7. aucune reference morte ailleurs ?"
node "$RACINE/scripts/narvos-verifier-catalogues.mjs" 2>&1 | tail -3

dire "=== TERMINE en $(( ($(date +%s) - DEBUT) / 60 )) min ==="
dire "    journal du cook : $COOK"