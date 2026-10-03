#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# cook-lot2.sh — cook du lot du 2026-09-13 (menottes, tente de quarantaine,
# objets InventorySystemPro), puis TOUTE la chaine qui le suit, d'une traite.
#
#   bash .hermes/cook-lot2.sh
#
# Regles reprises de apres-cook-nuit.sh : « Packages Remain 0 » ou rien ;
# l'inventaire se refait ENTRE le cook et le pack ; la sortie des --apply n'est
# jamais masquee (elle part dans un journal, et le bilan en extrait par
# MOT-CLE) ; les bilans se lisent par mot-cle, jamais par `tail`.
# ══════════════════════════════════════════════════════════════════════════════
set -u
RACINE="E:/narvosprime-web-prototype"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
BILAN="$RACINE/.hermes/bilan_lot2_2026-09-13.log"
CUIT="$RACINE/WebPortal/Server/adk/Saved/Cooked/Windows/NanosWorldADK/Content/Narvos"
cd "$RACINE" || exit 1

dire() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$BILAN"; }

if tasklist 2>/dev/null | grep -qi "UnrealEditor"; then
  dire "ARRET : un UnrealEditor tourne deja."
  exit 1
fi

COOK=".hermes/cook_lot2_$(date +%H%M).log"
echo "$COOK" > .hermes/.cook_en_cours
dire "=== 0. cook : $COOK"
"$UE" "$ADK" -run=Cook -targetplatform=Windows -unattended -nosplash > "$COOK" 2>&1
dire "    sortie du commandlet : $? (ne vaut rien comme temoin — lire le journal)"

dire "=== 1. verdict du cook"
if ! grep -qE "Packages Remain 0 " "$COOK"; then
  dire "ARRET : « Packages Remain 0 » ABSENT — pack NON reconstruit."
  grep -E "Assertion failed|Fatal error" "$COOK" | head -3 | cut -c1-240 | tee -a "$BILAN"
  exit 1
fi
dire "    $(grep -E 'Packages Remain 0 ' "$COOK" | tail -1 | grep -oE 'Cooked packages [0-9]+')"
dire "    assertions : $(grep -cE 'Assertion failed|Fatal error' "$COOK")"
for R in Multiplayer_Handcuff_System QuarantineTent InventorySystemPro; do
  dire "    cuits $R : $(find "$CUIT/$R" -name '*.uasset' 2>/dev/null | wc -l)"
done
dire "    erreurs de chargement sur le lot :"
grep -E "Error:" "$COOK" | grep -E "Multiplayer_Handcuff_System|QuarantineTent|InventorySystemPro" \
  | sed -E 's/^\[[^]]*\]\[[^]]*\]//' | cut -c1-200 | sort | uniq -c | sort -rn | head -12 | tee -a "$BILAN"

dire "=== 2. inventaire (entre le cook et le pack)"
"$UE" "$ADK" -run=pythonscript -script="$RACINE/scripts/adk-dump-assets.py" -unattended -nosplash > .hermes/dump_lot2.log 2>&1
dire "    inventaire : $(stat -c %s WebPortal/Server/adk/_assets-inventory.json) octets"

dire "=== 3. pack"
node scripts/nanos-build-asset-pack.mjs --apply > .hermes/pack_lot2.log 2>&1
grep -E "copiés|cle\(s\) uniques|Assets.toml :|EN DOUBLE|ABSENT|ERREUR" .hermes/pack_lot2.log | tee -a "$BILAN"
for K in SM_Handcuff AS_Handcuffed AS_Interaction Wav_Handcuff_Sound SM_MedicalBed_01a SM_PotionHealth; do
  dire "    $K : $(grep -m1 -E "^\s*$K = " WebPortal/Server/Assets/narvos/Assets.toml | sed -E 's/^\s+//' || true)"
done

dire "=== 4. catalogues"
node scripts/narvos-pack-props-to-lua.mjs --apply > .hermes/props_lot2.log 2>&1
grep -E "retenus|Medical|Objets|sans categorie" .hermes/props_lot2.log | tee -a "$BILAN"
node scripts/narvos-anims-to-lua.mjs --apply > .hermes/anims_lot2.log 2>&1
grep -E "animation|ecrit|écrit|ARR" .hermes/anims_lot2.log | head -4 | tee -a "$BILAN"
node scripts/narvos-hyper-to-lua.mjs --apply > .hermes/hyper_lot2.log 2>&1
grep -E "objets    :|recettes  :|meshes cuits" .hermes/hyper_lot2.log | tee -a "$BILAN"
node scripts/narvos-modular-to-lua.mjs --apply > .hermes/modular_lot2.log 2>&1
grep -E "ARR|écrit" .hermes/modular_lot2.log | tee -a "$BILAN"

dire "=== 5. imports des paquets du lot"
for R in "Narvos/Multiplayer_Handcuff_System" "Narvos/QuarantineTent" "Narvos/InventorySystemPro"; do
  dire "    -- $R"
  node scripts/narvos-imports-casses.mjs "$R" 2>&1 | grep -E "examinee|Aucun import|ABSENT\(S\) :|base nanos|INTROUVABLE" | tee -a "$BILAN"
done

dire "=== 6. squelette des animations des menottes (CUITES)"
for A in AS_Handcuffed AS_Interaction; do
  F=$(find WebPortal/Server/Assets/narvos/Narvos/Multiplayer_Handcuff_System -name "$A.uasset" | head -1)
  if [ -n "$F" ]; then
    python -c "
import re
d=open(r'$F','rb').read().decode('latin1')
sk=sorted(set(re.findall(r'/Game/[A-Za-z0-9_/]*(?:SKEL_Mannequin|UE4_Mannequin_Skeleton)', d)))
ok=any('SKEL_Mannequin' in s for s in sk) and not any('UE4_Mannequin_Skeleton' in s for s in sk)
print('    $A :', sk, '->', 'PRIS' if ok else 'NON PRIS')
" | tee -a "$BILAN"
  else
    dire "    $A absent du pack"
  fi
done

dire "=== 7. verificateur (existence ET identite) et batterie"
node scripts/narvos-verifier-catalogues.mjs > .hermes/verif_lot2.log 2>&1
grep -E "MANQUE|IDENTITE|TYPE |Identite|Aucune reference morte|morte\(s\)" .hermes/verif_lot2.log | tee -a "$BILAN"
node scripts/lua-harness/tout.mjs > .hermes/batterie_lot2.log 2>&1
grep -E "assertion\(s\)" .hermes/batterie_lot2.log | tee -a "$BILAN"
dire "FIN"