#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# apres-cook-nuit.sh — tout ce qui suit le cook Crystals + Farming, d'une traite.
#
#   bash .hermes/apres-cook-nuit.sh
#
# POURQUOI UN SEUL SCRIPT : le veilleur d'arret (.hermes/arret-apres-travail.ps1)
# eteint le PC apres 03:00 des qu'il constate 3 minutes sans cook ni
# reconstruction de pack. Enchaine a la main, un trou de quelques minutes entre
# deux etapes suffirait. Ici les etapes se suivent sans pause.
#
# Regles reprises de cook_stations_2026-09-12.sh : « Packages Remain 0 » ou rien ;
# l'inventaire se refait ENTRE le cook et le pack ; la sortie des --apply n'est
# jamais masquee ; les bilans se lisent par MOT-CLE, jamais par `tail`.
# ══════════════════════════════════════════════════════════════════════════════
set -u
RACINE="E:/narvosprime-web-prototype"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
BILAN="$RACINE/.hermes/bilan_nuit_2026-09-13.log"
cd "$RACINE" || exit 1

dire() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$BILAN"; }

COOK=$(cat .hermes/.cook_en_cours)
dire "=== 1. cook : $COOK"
if ! grep -qE "Packages Remain 0 " "$COOK"; then
  dire "ARRET : « Packages Remain 0 » ABSENT — pack NON reconstruit."
  grep -E "Assertion failed|Fatal error" "$COOK" | head -3 | cut -c1-200 | tee -a "$BILAN"
  exit 1
fi
dire "    $(grep -E 'Packages Remain 0 ' "$COOK" | tail -1 | grep -oE 'Cooked packages [0-9]+')"
dire "    assertions : $(grep -cE 'Assertion failed|Fatal error' "$COOK")"
dire "    cuits Hypernova : $(find WebPortal/Server/adk/Saved/Cooked/Windows/NanosWorldADK/Content/Narvos/Hypernova -name '*.uasset' 2>/dev/null | wc -l)"
dire "    cuits Farming   : $(find WebPortal/Server/adk/Saved/Cooked/Windows/NanosWorldADK/Content/Narvos/Farming_And_Mining -name '*.uasset' 2>/dev/null | wc -l)"

dire "=== 2. inventaire (entre le cook et le pack)"
"$UE" "$ADK" -run=pythonscript -script="$RACINE/scripts/adk-dump-assets.py" -unattended -nosplash -nopause > .hermes/dump_nuit.log 2>&1
dire "    inventaire : $(stat -c %s WebPortal/Server/adk/_assets-inventory.json) octets"

dire "=== 3. pack"
node scripts/nanos-build-asset-pack.mjs --apply > .hermes/pack_nuit.log 2>&1
grep -E "copiés|cle\(s\) uniques|Assets.toml :|ABSENT|ERREUR" .hermes/pack_nuit.log | tee -a "$BILAN"

dire "=== 4. catalogues"
node scripts/narvos-hyper-to-lua.mjs --apply 2>&1 | grep -E "objets|recettes|meshes cuits|ecrit" | tee -a "$BILAN"
node scripts/narvos-pack-props-to-lua.mjs --apply 2>&1 | grep -E "retenus|Objets|Cristaux|Outils|decors" | tee -a "$BILAN"

dire "=== 5. imports des paquets promus"
for R in "Narvos/Hyper/ResourcePack/Icons" "Narvos/Hypernova/CrystalKeeper/Meshes" "Narvos/Farming_And_Mining/Animations"; do
  dire "    -- $R"
  node scripts/narvos-imports-casses.mjs "$R" 2>&1 | grep -E "examinee|Aucun import|ABSENT\(S\) :" | tee -a "$BILAN"
done

dire "=== 6. PARI Farming : quel squelette citent les animations CUITES ?"
ANIM=$(find WebPortal/Server/Assets/narvos/Narvos/Farming_And_Mining/Animations -name "Pick_Swing_High_Anim.uasset" | head -1)
if [ -n "$ANIM" ]; then
  python -c "
import re,sys
d=open(r'$ANIM','rb').read().decode('latin1')
sk=sorted(set(re.findall(r'/Game/[A-Za-z0-9_/]*(?:SKEL_Mannequin|UE4_Mannequin_Skeleton)', d)))
print('    squelettes cites :', sk)
print('    VERDICT :', 'PRIS (SKEL_Mannequin)' if any('SKEL_Mannequin' in s for s in sk) and not any('UE4_Mannequin_Skeleton' in s for s in sk) else 'NON PRIS — consolider dans l editeur ouvert')
" | tee -a "$BILAN"
else
  dire "    Pick_Swing_High_Anim absent du pack — pari NON verifiable"
fi

dire "=== 7. verificateur et batterie"
node scripts/narvos-verifier-catalogues.mjs 2>&1 | grep -E "MORTE|MANQUE|Aucune reference morte" | tee -a "$BILAN"
node scripts/lua-harness/tout.mjs > .hermes/batterie_nuit.log 2>&1
grep -E "assertion\(s\)" .hermes/batterie_nuit.log | tee -a "$BILAN"
dire "FIN"