#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# cook_pont_metahuman_2026-09-11.sh — cuire le pont MetaHuman, prouver, régénérer.
#
#   bash .hermes/cook_pont_metahuman_2026-09-11.sh
#
# Après, dans l'éditeur : scripts/adk-rapatrier-metacustom.py (MetaCustom ne
# nomme plus le pack stagé), scripts/adk-recharger-et-resauver.py (le disque suit)
# et scripts/adk-pont-metahuman.py (rigs, retargeter, ABP, 14 porteurs).
#
# ── RÈGLES (celles de cook_squelettes_2026-09-11.sh) ──────────────────────────
#   · serveur, client ET éditeur fermés ;
#   · « Packages Remain 0 » ou rien : un cook partiel ne reconstruit pas le pack ;
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
COOK="$RACINE/.hermes/cook_pont_metahuman_$(date +%Y-%m-%d_%H%M).log"
JOURNAL="$RACINE/.hermes/cook_pont_metahuman_2026-09-11.log"
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
dire "    avertissements nommant PontMetaHuman : $(grep -c 'PontMetaHuman' "$COOK")"
grep -E "PontMetaHuman" "$COOK" | grep -iE "warning|error" | head -5 | cut -c1-240 | tee -a "$JOURNAL"
dire "    dependances vers le pack stage (MetaCustom) : $(grep -c 'Metahuman_Customization_System.*does not exist\|NeverCook.*Metahuman_Customization_System' "$COOK")"

dire "=== 2. inventaire"
"$UE" "$ADK" -run=pythonscript -script="$RACINE/scripts/adk-dump-assets.py" -unattended -nosplash -nopause > /dev/null 2>&1
dire "    inventaire : $(grep -c 'PontMetaHuman' "$RACINE/WebPortal/Server/adk/_assets-inventory.json") entree(s) PontMetaHuman"

dire "=== 3. pack"
node "$RACINE/scripts/nanos-build-asset-pack.mjs" --apply > "$RACINE/.hermes/pack_pont_metahuman_2026-09-11.log" 2>&1
grep -E "ABSENT\(S\) DE L'INVENTAIRE|Assets.toml :" "$RACINE/.hermes/pack_pont_metahuman_2026-09-11.log" | tee -a "$JOURNAL"

dire "=== 4. temoins disque"
dire "    fichiers cuits du pont : $(ls "$PACK/Narvos/PontMetaHuman/" 2>/dev/null | grep -c '\.uasset$') (attendu : 18 = 2 rigs + 1 retargeter + 1 ABP + 14 porteurs)"
dire "    porteurs declares dans Assets.toml : $(grep -c 'PontMetaHuman/BP_NarvosMH_' "$TOML") (attendu : 14)"
CORPS="$PACK/Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/SK_Meta_Female_Base.uasset"
if [ -f "$CORPS" ] && grep -a -q "/Game/Narvos/MetaCustom/Meta_Body_Tool/Skeletal_Meshes/Skel_Dummy" "$CORPS"; then
  dire "    OUI : le corps CUIT nomme le Skel_Dummy PROMU"
else
  dire "    NON (ou absent) : $CORPS"
fi
dire "    corps cuit nommant encore le pack stage : $(grep -a -c '/Game/Metahuman_Customization_System/' "$CORPS" 2>/dev/null)"

dire "=== 5. catalogues (sorties completes)"
node "$RACINE/scripts/narvos-metahumain-to-lua.mjs" --apply 2>&1 | tee -a "$JOURNAL"
node "$RACINE/scripts/narvos-spawnables-to-lua.mjs" --apply 2>&1 | tee -a "$JOURNAL" | tail -4
[ -f "$RACINE/scripts/narvos-anims-to-lua.mjs" ] && node "$RACINE/scripts/narvos-anims-to-lua.mjs" --apply 2>&1 | tee -a "$JOURNAL" | tail -3
node "$RACINE/scripts/narvos-verifier-catalogues.mjs" 2>&1 | tail -3 | tee -a "$JOURNAL"
dire "    pieces MetaHuman posables : $(grep -c 'cuit = true' "$RACINE/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/MetaHumain.lua") / 14"

dire "=== 6. batterie"
node "$RACINE/scripts/lua-harness/tout.mjs" > "$RACINE/.hermes/batterie_pont_metahuman_2026-09-11.log" 2>&1
dire "    $(tail -1 "$RACINE/.hermes/batterie_pont_metahuman_2026-09-11.log")"
dire "=== TERMINE en $(( ($(date +%s) - DEBUT) / 60 )) min ==="