#!/usr/bin/env bash
# Attend la fin du cook, VERIFIE qu'il a reussi, puis enchaine la chaine.
#
# Le code de sortie du cook NE DIT PAS s'il a plante : il peut rendre 1 en ayant
# tout cuit (11 585 erreurs non fatales, dont 525 « Content is missing from cook »
# qui sont la consequence de nos propres exclusions). Le seul temoin est
# « Packages Remain 0 » dans le journal.
set -u
RACINE="E:/narvosprime-web-prototype"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
JOURNAL="$RACINE/WebPortal/Server/adk/Saved/Logs/NanosWorldADK.log"
LOG="$RACINE/.hermes/cook_2026-09-09b.log"

for i in $(seq 1 720); do
  if ! tasklist 2>/dev/null | grep -qi "UnrealEditor-Cmd"; then break; fi
  sleep 10
done

echo "=== le cook a rendu la main a $(date +%H:%M:%S) ==="
if grep -qE "Packages Remain 0 " "$LOG"; then
  echo "  TEMOIN OK : Packages Remain 0"
else
  echo "  ARRET : « Packages Remain 0 » ABSENT du journal."
  echo "  Le cook n'a pas fini son travail. On NE reecrit PAS le pack a partir"
  echo "  d'un cook partiel — Assets.toml deviendrait faux et le serveur"
  echo "  refuserait des assets pourtant presents."
  grep -oE "Cooked packages [0-9]+ Packages Remain [0-9]+" "$LOG" | tail -1
  exit 1
fi

echo ""
echo "=== INVENTAIRE  $(date +%H:%M:%S) ==="
"$UE" "$ADK" -run=pythonscript -script="$RACINE/scripts/adk-dump-assets.py" \
  -unattended -nosplash > /dev/null 2>&1
grep "NARVOS" "$JOURNAL" 2>/dev/null | sed 's/.*\[NARVOS\] /  /' | tail -12

echo ""
echo "=== PACK  $(date +%H:%M:%S) ==="
node "$RACINE/scripts/nanos-build-asset-pack.mjs" --apply 2>&1 | tail -8

echo ""
echo "=== CATALOGUE DES PROPS  $(date +%H:%M:%S) ==="
node "$RACINE/scripts/narvos-pack-props-to-lua.mjs" --apply 2>&1 | tail -8

echo ""
echo "=== VERIFICATION  $(date +%H:%M:%S) ==="
node "$RACINE/scripts/narvos-verifier-catalogues.mjs" 2>&1 | tail -14

echo ""
echo "=== LES DEUX GARDES PEUVENT-ILS TOMBER ? ==="
for m in BIG_CITY_NIGHT_1 ForestKitONE; do
  printf "  %-20s %s occurrence(s) dans Assets.toml\n" "$m" \
    "$(grep -c "$m" "$RACINE/WebPortal/Server/Assets/narvos/Assets.toml" 2>/dev/null)"
done
echo "  (>0 = le garde cuit=false peut etre retire pour ce monde)"
echo ""
echo "=== TERMINE  $(date +%H:%M:%S) ==="