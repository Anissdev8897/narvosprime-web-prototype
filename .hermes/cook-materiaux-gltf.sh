#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# cook-materiaux-gltf.sh — recook apres l'entree de la chaine de materiaux glTF
# d'Interchange dans NOTRE pack (2026-09-13), puis toute la chaine.
#
#   bash .hermes/cook-materiaux-gltf.sh
#
# Le defaut corrige : la Forge au DAMIER en jeu. 13 304 instances cuites avaient pour
# parent /InterchangeAssets/gltf/... (plugin moteur, hors pack) ; le client utilisait
# SA copie d'origine du M_Default, sans les usages de la notre -> materiau par defaut.
# Detail et mesures : bloc « Materiaux glTF d'Interchange » de DefaultEngine.ini.
#
# Regles : « Packages Remain 0 » ou rien ; inventaire ENTRE cook et pack ; les NEUF
# generateurs hors verrou d'identite tournent apres le pack ; bilans lus par mot-cle.
# ══════════════════════════════════════════════════════════════════════════════
set -u
RACINE="E:/narvosprime-web-prototype"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
BILAN="$RACINE/.hermes/bilan_materiaux_gltf_2026-09-13.log"
CONTENT="$RACINE/WebPortal/Server/adk/Content"
PACK="$RACINE/WebPortal/Server/Assets/narvos/Narvos"
cd "$RACINE" || exit 1

dire() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$BILAN"; }

if tasklist 2>/dev/null | grep -qiE "UnrealEditor|NanosWorldServer|NanosWorld.exe"; then
  dire "ARRET : Unreal ou nanos tourne (le pack serait reecrit sous un serveur actif)."
  exit 1
fi
if [ ! -f "$CONTENT/Narvos/InterchangeAssets/gltf/M_Default.uasset" ]; then
  dire "ARRET : Content/Narvos/InterchangeAssets/gltf/M_Default.uasset absent."
  exit 1
fi
if ! grep -qE '^\+PackageRedirects=\(OldName="/InterchangeAssets/"' WebPortal/Server/adk/Config/DefaultEngine.ini; then
  dire "ARRET : PackageRedirect /InterchangeAssets/ absent de DefaultEngine.ini."
  exit 1
fi

AVANT=$(grep -rla --include="*.uasset" "/InterchangeAssets/" "$PACK" 2>/dev/null | wc -l)
dire "=== AVANT : $AVANT paquet(s) du pack dependent de /InterchangeAssets/ (plugin moteur)"

COOK=".hermes/cook_gltf_$(date +%H%M).log"
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

dire "=== 2. inventaire"
"$UE" "$ADK" -run=pythonscript -script="$RACINE/scripts/adk-dump-assets.py" -unattended -nosplash > .hermes/dump_gltf.log 2>&1
dire "    inventaire : $(stat -c %s WebPortal/Server/adk/_assets-inventory.json) octets"

dire "=== 3. pack"
node scripts/nanos-build-asset-pack.mjs --apply > .hermes/pack_gltf.log 2>&1
grep -E "copiés|cle\(s\) uniques|Assets.toml :|EN DOUBLE|ABSENT|ERREUR" .hermes/pack_gltf.log | tee -a "$BILAN"

dire "=== 4. PREUVE : dependances au plugin moteur apres le cook"
APRES=$(grep -rla --include="*.uasset" "/InterchangeAssets/" "$PACK" 2>/dev/null | grep -v "/Narvos/InterchangeAssets/" | wc -l)
dire "    paquets hors copie qui citent encore /InterchangeAssets/ : $APRES (avant : $AVANT)"
F=$(find "$PACK/halo_map/halo_map/Materials" -name "forge_halo_rocks_-forge_halo_rock_med_special_b01___forge_halo_rocks_island_.uasset" | head -1)
if [ -n "$F" ]; then
  python -c "
import re
d=open(r'$F','rb').read().decode('latin1')
print('    instance Forge — parents cites :', sorted(set(x for x in re.findall(r'/[A-Za-z]+/[A-Za-z0-9_/]*MaterialInstances/[A-Za-z0-9_]+', d))))
" | tee -a "$BILAN"
fi
dire "    notre M_Default dans le pack : $(ls -la "$PACK/InterchangeAssets/gltf/M_Default.uexp" 2>/dev/null | awk '{print $5}') octets (.uexp)"
dire "    copie cuite : $(find "$PACK/InterchangeAssets" -name '*.uasset' 2>/dev/null | wc -l) paquet(s)"

dire "=== 5. les NEUF catalogues regeneres (hors verrou d'identite)"
node scripts/narvos-spawnables-to-lua.mjs --apply > .hermes/spawnables_gltf.log 2>&1
grep -E "ecrit|ARR" .hermes/spawnables_gltf.log | tee -a "$BILAN"
node scripts/narvos-pack-props-to-lua.mjs --apply > .hermes/props_gltf.log 2>&1
grep -E "retenus|sans categorie" .hermes/props_gltf.log | tee -a "$BILAN"
node scripts/narvos-anims-to-lua.mjs --apply > .hermes/anims_gltf.log 2>&1
grep -E "animation|ecrit|écrit|ARR" .hermes/anims_gltf.log | head -4 | tee -a "$BILAN"
node scripts/narvos-hyper-to-lua.mjs --apply > .hermes/hyper_gltf.log 2>&1
grep -E "objets    :|recettes  :|meshes cuits" .hermes/hyper_gltf.log | tee -a "$BILAN"
node scripts/narvos-modular-to-lua.mjs --apply > .hermes/modular_gltf.log 2>&1
grep -E "ARR|écrit" .hermes/modular_gltf.log | tee -a "$BILAN"
node scripts/narvos-objets-divers-to-lua.mjs --apply > .hermes/objets_divers_gltf.log 2>&1
grep -E "talkie_walkie|smartphone|digicode|porte\.|ARR|écrit" .hermes/objets_divers_gltf.log | tee -a "$BILAN"
node scripts/narvos-minimap-to-lua.mjs --apply > .hermes/minimap_gltf.log 2>&1
grep -E "prete|ARR|écrit" .hermes/minimap_gltf.log | tee -a "$BILAN"
node scripts/narvos-isp-to-lua.mjs --apply > .hermes/isp_gltf.log 2>&1
grep -E "objets   :|recettes :|meshes cuits|ecrit" .hermes/isp_gltf.log | tee -a "$BILAN"
node scripts/narvos-gestes-to-lua.mjs --apply > .hermes/gestes_gltf.log 2>&1
grep -E "Infectes|ARR|écrit" .hermes/gestes_gltf.log | tee -a "$BILAN"

dire "=== 6. imports de la copie et de la Forge"
for R in "Narvos/InterchangeAssets" "Narvos/halo_map"; do
  dire "    -- $R"
  node scripts/narvos-imports-casses.mjs "$R" 2>&1 | grep -E "examinee|Aucun import|ABSENT\(S\) :|base nanos|Imports de" | head -4 | tee -a "$BILAN"
done

dire "=== 7. verificateur (existence ET identite) et batterie"
node scripts/narvos-verifier-catalogues.mjs > .hermes/verif_gltf.log 2>&1
grep -E "MANQUE|IDENTITE|TYPE |Identite|Aucune reference morte|morte\(s\)|PERIME" .hermes/verif_gltf.log | tee -a "$BILAN"
node scripts/lua-harness/tout.mjs > .hermes/batterie_gltf.log 2>&1
grep -E "assertion\(s\)" .hermes/batterie_gltf.log | tee -a "$BILAN"
dire "FIN"