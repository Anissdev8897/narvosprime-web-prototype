#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# cook_squelettes_2026-09-11.sh — cuire les squelettes reparés, prouver, régénérer.
#
#   bash .hermes/cook_squelettes_2026-09-11.sh
#
# Après `scripts/adk-reparer-squelettes-promus.py` (Defender, Freeflow) : les
# SkeletalMesh et les animations pointent enfin SKEL_Mannequin SUR DISQUE. Ce
# script les fait entrer dans le pack et le prouve à chaque étape.
#
# ── RÈGLES ────────────────────────────────────────────────────────────────────
#   · serveur, client ET éditeur fermés : le pack est une jonction, et un cook
#     commandlet à côté d'un éditeur ouvert se dispute les paquets ;
#   · un cook partiel (« Packages Remain 0 » absent) NE reconstruit PAS le pack ;
#   · l'inventaire est régénéré ENTRE le cook et le pack ;
#   · chaque étape a un témoin qui mesure la question posée ;
#   · la sortie des --apply n'est jamais masquée (copiée dans le journal).
# ══════════════════════════════════════════════════════════════════════════════
set -u

RACINE="E:/narvosprime-web-prototype"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
TOML="$RACINE/WebPortal/Server/Assets/narvos/Assets.toml"
PACK="$RACINE/WebPortal/Server/Assets/narvos"
COOK="$RACINE/.hermes/cook_squelettes_$(date +%Y-%m-%d_%H%M).log"
JOURNAL="$RACINE/.hermes/cook_squelettes_2026-09-11.log"
DEBUT=$(date +%s)
NANOS="/Game/NanosWorld/Characters/Common/SKEL_Mannequin"

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
dire "    dependances encore mortes vers Defender : $(grep -c 'dependency on package /Game/Defender/.*does not exist' "$COOK")"

dire "=== 2. inventaire"
"$UE" "$ADK" -run=pythonscript -script="$RACINE/scripts/adk-dump-assets.py" -unattended -nosplash -nopause > /dev/null 2>&1
dire "    inventaire : $(grep -c 'Narvos/Defender' "$RACINE/WebPortal/Server/adk/_assets-inventory.json") entree(s) Defender"

dire "=== 3. pack"
node "$RACINE/scripts/nanos-build-asset-pack.mjs" --apply > "$RACINE/.hermes/pack_squelettes_2026-09-11.log" 2>&1
grep -E "ABSENT\(S\) DE L'INVENTAIRE|Assets.toml :" "$RACINE/.hermes/pack_squelettes_2026-09-11.log" | tee -a "$JOURNAL"

dire "=== 4. temoin disque : SK_Hero CUIT pointe-t-il le squelette nanos ?"
HERO="$PACK/Narvos/Defender/Demo/Characters/Hero/SK_Hero.uasset"
if [ -f "$HERO" ] && grep -a -q "$NANOS" "$HERO"; then
  dire "    OUI : $HERO nomme $NANOS"
else
  dire "    NON (ou absent) : $HERO"
fi

dire "=== 5. catalogues (sorties completes)"
node "$RACINE/scripts/narvos-spawnables-to-lua.mjs" --apply 2>&1 | tee -a "$JOURNAL" | tail -12
[ -f "$RACINE/scripts/narvos-anims-to-lua.mjs" ] && node "$RACINE/scripts/narvos-anims-to-lua.mjs" --apply 2>&1 | tee -a "$JOURNAL" | tail -6
node "$RACINE/scripts/narvos-verifier-catalogues.mjs" 2>&1 | tail -3 | tee -a "$JOURNAL"
dire "    Defender au menu de spawn : $(grep -c 'famille = \"Defender\"' "$RACINE/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Spawnables.lua")"

dire "=== 6. batterie"
node "$RACINE/scripts/lua-harness/tout.mjs" > "$RACINE/.hermes/batterie_squelettes_2026-09-11.log" 2>&1
dire "    $(tail -1 "$RACINE/.hermes/batterie_squelettes_2026-09-11.log")"
dire "=== TERMINE en $(( ($(date +%s) - DEBUT) / 60 )) min ==="