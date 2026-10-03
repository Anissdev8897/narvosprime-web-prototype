#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# cook_ville_2026-09-11.sh — cuire les textures rendues à la ville (et aux mondes
# OpenWorlds / Megastructure), prouver sur les fichiers CUITS, régénérer.
#
#   bash .hermes/cook_ville_2026-09-11.sh
#
# Après, dans l'éditeur : scripts/adk-session-ville.py `seance(appliquer=True)`
# (mortes à jumeau -> reparer, stagées -> rapatrier_pack, sans jumeau ->
# substituer, puis finaliser). Mêmes règles que cook_pont_metahuman_2026-09-11.sh :
#   · serveur, client ET éditeur fermés ;
#   · « Packages Remain 0 » ou rien ;
#   · inventaire ENTRE le cook et le pack ;
#   · chaque étape a un témoin qui mesure la question posée ;
#   · la sortie des --apply n'est jamais masquée.
# ══════════════════════════════════════════════════════════════════════════════
set -u

RACINE="E:/narvosprime-web-prototype"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
PACK="$RACINE/WebPortal/Server/Assets/narvos"
COOK="$RACINE/.hermes/cook_ville_$(date +%Y-%m-%d_%H%M).log"
JOURNAL="$RACINE/.hermes/cook_ville_2026-09-11.log"
DEBUT=$(date +%s)

dire() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$JOURNAL"; }
: > "$JOURNAL"

dire "=== 0. rien ne doit tourner"
if tasklist 2>/dev/null | grep -qiE "NanosWorld|UnrealEditor"; then
  dire "ARRET : un processus nanos ou Unreal tourne encore :"
  tasklist 2>/dev/null | grep -iE "NanosWorld|UnrealEditor" | tee -a "$JOURNAL"
  exit 1
fi

dire "=== 1. cook (borne a 100 min)"
timeout 6000 "$UE" "$ADK" -run=Cook -targetplatform=Windows -unattended -nosplash > "$COOK" 2>&1
dire "    cook rendu apres $(( ($(date +%s) - DEBUT) / 60 )) min"
if ! grep -qE "Packages Remain 0 " "$COOK"; then
  dire "ARRET : « Packages Remain 0 » ABSENT — cook partiel. Pack NON reconstruit."
  grep -E "Fatal|Assertion failed" "$COOK" | head -5 | cut -c1-220 | tee -a "$JOURNAL"
  exit 1
fi
dire "    TEMOIN OK : Packages Remain 0"
for P in CITY_PACK OpenWorlds Megastructure_Scifi_World; do
  dire "    dependances encore mortes vers /Game/$P/ : $(grep -c "dependency on package /Game/$P/.*does not exist" "$COOK")"
done

dire "=== 2. inventaire"
"$UE" "$ADK" -run=pythonscript -script="$RACINE/scripts/adk-dump-assets.py" -unattended -nosplash -nopause > /dev/null 2>&1
dire "    inventaire : $(grep -c 'Narvos/CITY_PACK' "$RACINE/WebPortal/Server/adk/_assets-inventory.json") entree(s) CITY_PACK"

dire "=== 3. pack"
node "$RACINE/scripts/nanos-build-asset-pack.mjs" --apply > "$RACINE/.hermes/pack_ville_2026-09-11.log" 2>&1
grep -E "ABSENT\(S\) DE L'INVENTAIRE|Assets.toml :" "$RACINE/.hermes/pack_ville_2026-09-11.log" | tee -a "$JOURNAL"

dire "=== 4. temoins disque (fichiers CUITS)"
temoin() {  # $1 = fichier cuit, $2 = chemin qui DOIT y figurer, $3 = chemin qui ne doit PLUS y figurer
  if [ ! -f "$1" ]; then dire "    ABSENT : $1"; return; fi
  local oui non
  oui=$(grep -a -c "$2" "$1"); non=$(grep -a -c "$3" "$1")
  dire "    $(basename "$1") : nomme la texture promue/remplacante $oui fois, l'ancien chemin $non fois"
}
temoin "$PACK/Narvos/CITY_PACK/BIG_CITY/MATERIALS/MATERIAL_INSTANCES/MI_ApartmentHologram1.uasset" \
  "/Game/Narvos/CITY_PACK/BIG_CITY/TEXTURES/T_BillboardHologram_04b_BaseColor" \
  "/Game/CITY_PACK/BIG_CITY/TEXTURES/T_BillboardHologram_04b_BaseColor"
temoin "$PACK/Narvos/OpenWorlds/Materials/Instances/RocksCliffs/MI_Cliff3.uasset" \
  "/Game/Narvos/OpenWorlds/" \
  "/Game/OpenWorlds/Textures/RocksCliffs/T_RockCliff3_BC"

dire "=== 5. catalogues (sorties completes)"
node "$RACINE/scripts/narvos-metahumain-to-lua.mjs" --apply 2>&1 | tee -a "$JOURNAL"
node "$RACINE/scripts/narvos-spawnables-to-lua.mjs" --apply 2>&1 | tee -a "$JOURNAL" | tail -4
[ -f "$RACINE/scripts/narvos-anims-to-lua.mjs" ] && node "$RACINE/scripts/narvos-anims-to-lua.mjs" --apply 2>&1 | tee -a "$JOURNAL" | tail -3
node "$RACINE/scripts/narvos-verifier-catalogues.mjs" 2>&1 | tail -3 | tee -a "$JOURNAL"

dire "=== 6. batterie"
node "$RACINE/scripts/lua-harness/tout.mjs" > "$RACINE/.hermes/batterie_ville_2026-09-11.log" 2>&1
dire "    $(tail -1 "$RACINE/.hermes/batterie_ville_2026-09-11.log")"
dire "=== TERMINE en $(( ($(date +%s) - DEBUT) / 60 )) min ==="