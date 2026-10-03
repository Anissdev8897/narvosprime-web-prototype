#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# cook_stations_2026-09-12.sh — cuire les stations de craft promues sous Narvos/,
# reconstruire le pack, et PROUVER que les 4 ateliers cessent d'être des cubes.
#
#   bash .hermes/cook_stations_2026-09-12.sh
#
# Mêmes règles que cook_ville_2026-09-11.sh, et pour les mêmes raisons :
#   · serveur, client ET éditeur fermés ;
#   · « Packages Remain 0 » ou rien ;
#   · l'inventaire se refait ENTRE le cook et le pack ;
#   · chaque étape a un témoin qui mesure la question posée ;
#   · la sortie des --apply n'est jamais masquée.
#
# Ce que ce cook doit rendre vrai : 832 assets promus le 2026-09-12 (256 meshes,
# 81 skeletal, 47 animations, 103 matériaux, 264 textures plafonnées à 1024,
# 80 sons) deviennent des clés d'Assets.toml, et `narvos-ateliers-to-lua.mjs`
# bascule alors les 4 stations du cube vers leur vrai mesh, tout seul.
# ══════════════════════════════════════════════════════════════════════════════
set -u

RACINE="E:/narvosprime-web-prototype"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
TOML="$RACINE/WebPortal/Server/Assets/narvos/Assets.toml"
COOK="$RACINE/.hermes/cook_stations_$(date +%Y-%m-%d_%H%M).log"
JOURNAL="$RACINE/.hermes/cook_stations_2026-09-12.log"
DEBUT=$(date +%s)

dire() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$JOURNAL"; }
: > "$JOURNAL"

dire "=== 0. rien ne doit tourner"
if tasklist 2>/dev/null | grep -qiE "NanosWorld|UnrealEditor"; then
  dire "ARRET : un processus nanos ou Unreal tourne encore :"
  tasklist 2>/dev/null | grep -iE "NanosWorld|UnrealEditor" | tee -a "$JOURNAL"
  exit 1
fi

AVANT_TOML=$(grep -c "Narvos/CraftingStations" "$TOML" 2>/dev/null || echo 0)
dire "    cles CraftingStations AVANT : $AVANT_TOML"

dire "=== 1. cook (borne a 100 min)"
timeout 6000 "$UE" "$ADK" -run=Cook -targetplatform=Windows -unattended -nosplash > "$COOK" 2>&1
dire "    cook rendu apres $(( ($(date +%s) - DEBUT) / 60 )) min"
if ! grep -qE "Packages Remain 0 " "$COOK"; then
  dire "ARRET : « Packages Remain 0 » ABSENT — cook partiel. Pack NON reconstruit."
  grep -E "Fatal|Assertion failed" "$COOK" | head -5 | cut -c1-220 | tee -a "$JOURNAL"
  exit 1
fi
dire "    TEMOIN OK : Packages Remain 0"
dire "    erreurs de cook sur CraftingStations : $(grep -c "CraftingStations.*\(Error\|Failed\)" "$COOK")"

CUITS="$RACINE/WebPortal/Server/adk/Saved/Cooked/Windows/NanosWorldADK/Content/Narvos/CraftingStations"
dire "    fichiers CUITS sous CraftingStations : $(find "$CUITS" -name '*.uasset' 2>/dev/null | wc -l)"

dire "=== 2. inventaire (entre le cook et le pack)"
"$UE" "$ADK" -run=pythonscript -script="$RACINE/scripts/adk-dump-assets.py" -unattended -nosplash -nopause > /dev/null 2>&1
dire "    inventaire : $(grep -c 'Narvos/CraftingStations' "$RACINE/WebPortal/Server/adk/_assets-inventory.json") entree(s) CraftingStations"

dire "=== 3. pack"
node "$RACINE/scripts/nanos-build-asset-pack.mjs" --apply > "$RACINE/.hermes/pack_stations_2026-09-12.log" 2>&1
grep -E "ABSENT\(S\) DE L'INVENTAIRE|Assets.toml :|blueprints|animations" "$RACINE/.hermes/pack_stations_2026-09-12.log" | tee -a "$JOURNAL"

APRES_TOML=$(grep -c "Narvos/CraftingStations" "$TOML" 2>/dev/null || echo 0)
dire "    cles CraftingStations APRES : $APRES_TOML  (avant : $AVANT_TOML)"
dire "    poids du pack : $(du -sh "$RACINE/WebPortal/Server/Assets/narvos" 2>/dev/null | cut -f1)"

dire "=== 4. le catalogue des ateliers bascule TOUT SEUL"
node "$RACINE/scripts/narvos-ateliers-to-lua.mjs" --apply 2>&1 | tee -a "$JOURNAL"

dire "=== 5. verificateur et batterie"
node "$RACINE/scripts/narvos-verifier-catalogues.mjs" 2>&1 | tail -3 | tee -a "$JOURNAL"
node "$RACINE/scripts/lua-harness/tout.mjs" > "$RACINE/.hermes/batterie_stations_2026-09-12.log" 2>&1
dire "    $(tail -1 "$RACINE/.hermes/batterie_stations_2026-09-12.log")"

dire "=== TERMINE en $(( ($(date +%s) - DEBUT) / 60 )) min ==="
dire "    Si « 4 avec leur vrai mesh » apparait ci-dessus, les cubes ont disparu."