#!/usr/bin/env bash
# apres_cook_2026-09-11.sh — étapes 2 à 6 de cook_squelettes_2026-09-11.sh,
# pour le cook de 18:03 lancé hors chaîne (il a fini seul : « Packages Remain 0 »,
# 31 min 22 s). Même témoins, mêmes journaux.
set -u
RACINE="E:/narvosprime-web-prototype"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
PACK="$RACINE/WebPortal/Server/Assets/narvos"
COOK="$RACINE/.hermes/cook_squelettes_2026-09-11_1803.log"
JOURNAL="$RACINE/.hermes/cook_squelettes_2026-09-11.log"
NANOS="/Game/NanosWorld/Characters/Common/SKEL_Mannequin"
DEBUT=$(date +%s)
dire() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$JOURNAL"; }

dire "=== 1. témoin du cook"
grep -qE "Packages Remain 0 " "$COOK" && dire "    TEMOIN OK : Packages Remain 0" || { dire "ARRET : cook partiel"; exit 1; }
dire "    dependances encore mortes vers Defender : $(grep -c 'dependency on package /Game/Defender/.*does not exist' "$COOK")"

dire "=== 2. inventaire"
"$UE" "$ADK" -run=pythonscript -script="$RACINE/scripts/adk-dump-assets.py" -unattended -nosplash -nopause > /dev/null 2>&1
dire "    inventaire : $(grep -c 'Narvos/Defender' "$RACINE/WebPortal/Server/adk/_assets-inventory.json") entree(s) Defender"

dire "=== 3. pack"
node "$RACINE/scripts/nanos-build-asset-pack.mjs" --apply > "$RACINE/.hermes/pack_squelettes_2026-09-11.log" 2>&1
grep -E "ABSENT\(S\) DE L'INVENTAIRE|Assets.toml :" "$RACINE/.hermes/pack_squelettes_2026-09-11.log" | tee -a "$JOURNAL"

dire "=== 4. temoin disque : SK_Hero CUIT pointe-t-il le squelette nanos ?"
HERO="$PACK/Narvos/Defender/Demo/Characters/Hero/SK_Hero.uasset"
if [ -f "$HERO" ] && grep -a -q "$NANOS" "$HERO"; then dire "    OUI : SK_Hero cuit nomme $NANOS"; else dire "    NON (ou absent) : $HERO"; fi

dire "=== 5. catalogues (sorties completes dans le journal)"
node "$RACINE/scripts/narvos-spawnables-to-lua.mjs" --apply 2>&1 | tee -a "$JOURNAL" | tail -12
[ -f "$RACINE/scripts/narvos-anims-to-lua.mjs" ] && node "$RACINE/scripts/narvos-anims-to-lua.mjs" --apply 2>&1 | tee -a "$JOURNAL" | tail -6
node "$RACINE/scripts/narvos-verifier-catalogues.mjs" 2>&1 | tail -3 | tee -a "$JOURNAL"
dire "    Defender au menu de spawn : $(grep -c 'famille = \"Defender\"' "$RACINE/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Spawnables.lua")"

dire "=== 6. batterie"
node "$RACINE/scripts/lua-harness/tout.mjs" > "$RACINE/.hermes/batterie_squelettes_2026-09-11.log" 2>&1
dire "    $(tail -1 "$RACINE/.hermes/batterie_squelettes_2026-09-11.log")"
dire "=== TERMINE en $(( ($(date +%s) - DEBUT) / 60 )) min ==="