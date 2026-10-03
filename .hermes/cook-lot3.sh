#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# cook-lot3.sh — cook du lot 3 du 2026-09-13 (motos Ridable, animations AI
# Behavior retargetees, InventorySystemPro recuit AVEC son redirect, minimap Ako,
# talkie-walkie / clavier a code / smartphone importes), puis toute la chaine.
#
#   bash .hermes/cook-lot3.sh
#
# ⚠ PRECONDITIONS (faites avant, et verifiees ici) :
#   · jonctions Content/RidableMotorBikes_Advanced, AIBehaviorSystem, Ako_Mini_Map_sys ;
#   · liens durs sous Narvos/RidableMotorBikes_Advanced et Narvos/Ako_Mini_Map_sys ;
#   · les trois proxies Narvos/Minimap/BP_NarvosCarte*.uasset (session editeur) ;
#   · PackageRedirect de /Game/InventorySystemPro/ ACTIF (decommente apres la
#     session d'export).
# SIGNALES sans arreter (le reste du lot vaut le cook) : les animations
# retargetees (Narvos/AIBehaviorSystem/Retarget) et les trois GLB (Narvos/divers).
#
# Regles : « Packages Remain 0 » ou rien ; inventaire ENTRE cook et pack ; les
# SEPT generateurs hors verrou d'identite (REGENERES_PAR_LA_CHAINE du
# verificateur) tournent TOUS apres le pack ; bilans lus par mot-cle.
# ══════════════════════════════════════════════════════════════════════════════
set -u
RACINE="E:/narvosprime-web-prototype"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
BILAN="$RACINE/.hermes/bilan_lot3_2026-09-13.log"
CONTENT="$RACINE/WebPortal/Server/adk/Content"
CUIT="$RACINE/WebPortal/Server/adk/Saved/Cooked/Windows/NanosWorldADK/Content/Narvos"
cd "$RACINE" || exit 1

dire() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$BILAN"; }

if tasklist 2>/dev/null | grep -qi "UnrealEditor"; then dire "ARRET : un UnrealEditor tourne deja."; exit 1; fi
for D in RidableMotorBikes_Advanced AIBehaviorSystem Ako_Mini_Map_sys Narvos/RidableMotorBikes_Advanced Narvos/Ako_Mini_Map_sys; do
  if [ ! -d "$CONTENT/$D" ]; then dire "ARRET : precondition absente : Content/$D"; exit 1; fi
done
for B in BP_NarvosCarteJoueur BP_NarvosCarteRepere BP_NarvosCarteVide; do
  if [ ! -f "$CONTENT/Narvos/Minimap/$B.uasset" ]; then dire "ARRET : proxy minimap absent : Narvos/Minimap/$B.uasset"; exit 1; fi
done
for D in Narvos/AIBehaviorSystem/Retarget Narvos/divers; do
  if [ ! -d "$CONTENT/$D" ]; then dire "    SIGNAL : $D absent — le cook continue sans"; fi
done
if ! grep -qE '^\+PackageRedirects=\(OldName="/Game/InventorySystemPro/"' WebPortal/Server/adk/Config/DefaultEngine.ini; then
  dire "ARRET : le PackageRedirect InventorySystemPro n'est pas ACTIF."
  exit 1
fi

COOK=".hermes/cook_lot3_$(date +%H%M).log"
echo "$COOK" > .hermes/.cook_en_cours
dire "=== 0. cook : $COOK"
"$UE" "$ADK" -run=Cook -targetplatform=Windows -unattended -nosplash > "$COOK" 2>&1
dire "    sortie du commandlet : $? (ne vaut rien comme temoin)"

dire "=== 1. verdict du cook"
if ! grep -qE "Packages Remain 0 " "$COOK"; then
  dire "ARRET : « Packages Remain 0 » ABSENT — pack NON reconstruit."
  grep -E "Assertion failed|Fatal error" "$COOK" | head -3 | cut -c1-240 | tee -a "$BILAN"
  exit 1
fi
dire "    $(grep -E 'Packages Remain 0 ' "$COOK" | tail -1 | grep -oE 'Cooked packages [0-9]+')"
dire "    assertions : $(grep -cE 'Assertion failed|Fatal error' "$COOK")"
for R in RidableMotorBikes_Advanced AIBehaviorSystem InventorySystemPro Ako_Mini_Map_sys Minimap divers; do
  dire "    cuits $R : $(find "$CUIT/$R" -name '*.uasset' 2>/dev/null | wc -l)"
done

dire "=== 2. inventaire"
"$UE" "$ADK" -run=pythonscript -script="$RACINE/scripts/adk-dump-assets.py" -unattended -nosplash > .hermes/dump_lot3.log 2>&1
dire "    inventaire : $(stat -c %s WebPortal/Server/adk/_assets-inventory.json) octets"

dire "=== 3. pack"
node scripts/nanos-build-asset-pack.mjs --apply > .hermes/pack_lot3.log 2>&1
grep -E "copiés|cle\(s\) uniques|Assets.toml :|EN DOUBLE|ABSENT|ERREUR" .hermes/pack_lot3.log | tee -a "$BILAN"
for K in SK_Naked_Body_LOD0 SK_Enduro_Body_LOD0 SK_Custom_Body_LOD0 S_NakedIdle S_Enduro_Idle S_CustomIdle ZombieAttack_Left ZombieScream Fire_Rifle_Hip SM_PotionHealth ui_minimap_showup BP_MAP_Bounds BP_NarvosCarteJoueur BP_NarvosCarteRepere; do
  dire "    $K : $(grep -m1 -E "^\s*$K = " WebPortal/Server/Assets/narvos/Assets.toml | sed -E 's/^\s+//' || true)"
done

dire "=== 4. les SEPT catalogues regeneres (hors verrou d'identite)"
node scripts/narvos-spawnables-to-lua.mjs --apply > .hermes/spawnables_lot3.log 2>&1
grep -E "ecrit|ARR" .hermes/spawnables_lot3.log | tee -a "$BILAN"
node scripts/narvos-pack-props-to-lua.mjs --apply > .hermes/props_lot3.log 2>&1
grep -E "retenus|Medical|Objets|sans categorie" .hermes/props_lot3.log | tee -a "$BILAN"
node scripts/narvos-anims-to-lua.mjs --apply > .hermes/anims_lot3.log 2>&1
grep -E "animation|ecrit|écrit|ARR" .hermes/anims_lot3.log | head -4 | tee -a "$BILAN"
node scripts/narvos-hyper-to-lua.mjs --apply > .hermes/hyper_lot3.log 2>&1
grep -E "objets    :|recettes  :|meshes cuits" .hermes/hyper_lot3.log | tee -a "$BILAN"
node scripts/narvos-modular-to-lua.mjs --apply > .hermes/modular_lot3.log 2>&1
grep -E "ARR|écrit" .hermes/modular_lot3.log | tee -a "$BILAN"
# Talkie-walkie, smartphone, clavier (GLB importes en session) et porte : par CHEMIN.
node scripts/narvos-objets-divers-to-lua.mjs --apply > .hermes/objets_divers_lot3.log 2>&1
grep -E "talkie_walkie|smartphone|digicode|porte\.|ARR|écrit" .hermes/objets_divers_lot3.log | tee -a "$BILAN"
# La minimap : widget, bornes, proxies par CHEMIN + boite mesuree ; PRETE = true attendu.
node scripts/narvos-minimap-to-lua.mjs --apply > .hermes/minimap_lot3.log 2>&1
grep -E "WIDGET|BORNES|JOUEUR|REPERE|prete|ARR|écrit" .hermes/minimap_lot3.log | tee -a "$BILAN"
node scripts/narvos-catalogs-to-lua.mjs --apply > .hermes/catalogs_lot3.log 2>&1
grep -E "garde Vehicles|garde Motos|ÉCHEC" .hermes/catalogs_lot3.log | tee -a "$BILAN"

dire "=== 5. imports des paquets du lot"
for R in "Narvos/RidableMotorBikes_Advanced" "Narvos/AIBehaviorSystem" "Narvos/InventorySystemPro" "Narvos/Ako_Mini_Map_sys" "Narvos/Minimap"; do
  dire "    -- $R"
  node scripts/narvos-imports-casses.mjs "$R" 2>&1 | grep -E "examinee|Aucun import|ABSENT\(S\) :|base nanos|INTROUVABLE" | tee -a "$BILAN"
done

dire "=== 5b. minimap : les redirections de classes ont-elles pris ? (DataAsset CUIT)"
F=$(find WebPortal/Server/Assets/narvos/Narvos/Ako_Mini_Map_sys -name "DA_MinimapSettings_Track.uasset" | head -1)
if [ -n "$F" ]; then
  python -c "
import re
d=open(r'$F','rb').read().decode('latin1')
nos=sorted(set(re.findall(r'/Game/Narvos/Minimap/[A-Za-z0-9_]+', d)))
demo=sorted(set(re.findall(r'/Game/[A-Za-z0-9_/]*Example_Content_Demo/[A-Za-z0-9_/]+', d)))
print('    proxies cites :', nos)
print('    demo encore citee :', demo if demo else 'AUCUNE')
" | tee -a "$BILAN"
else
  dire "    DA_MinimapSettings_Track absent du pack"
fi

dire "=== 6. squelette des animations retargetees (CUITES)"
F=$(find WebPortal/Server/Assets/narvos/Narvos/AIBehaviorSystem -name "ZombieAttack_Left.uasset" | head -1)
if [ -n "$F" ]; then
  python -c "
import re
d=open(r'$F','rb').read().decode('latin1')
sk=sorted(set(re.findall(r'/Game/[A-Za-z0-9_/]*(?:SKEL_Mannequin|SK_Mannequin)[A-Za-z0-9_]*', d)))
print('    ZombieAttack_Left :', sk)
" | tee -a "$BILAN"
else
  dire "    ZombieAttack_Left absent du pack"
fi

dire "=== 7. verificateur (existence ET identite) et batterie"
node scripts/narvos-verifier-catalogues.mjs > .hermes/verif_lot3.log 2>&1
grep -E "MANQUE|IDENTITE|TYPE |Identite|Aucune reference morte|morte\(s\)" .hermes/verif_lot3.log | tee -a "$BILAN"
node scripts/lua-harness/tout.mjs > .hermes/batterie_lot3.log 2>&1
grep -E "assertion\(s\)" .hermes/batterie_lot3.log | tee -a "$BILAN"
dire "FIN"