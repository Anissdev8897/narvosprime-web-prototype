#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# session-metahuman.sh — Forge (materiaux glTF) + PNJ (drapeaux skeletal) + VRAIS
# MetaHumans, en UN seul cook, sans intervention (2026-09-13).
#
# Le cook des materiaux lance a 06:48 a ete ARRETE a 08:1x : son redirect
# /InterchangeAssets/ se reappliquait a son resultat (voir DefaultEngine.ini). Un
# cook est TOUJOURS complet ici (« FULL COOK », mesure) : autant y mettre les trois
# correctifs.
#
#   0. preconditions : redirects idempotents, copie Interchange presente, aucun
#      Unreal ; attendre que nanos soit ferme ;
#   1. liens durs de la fermeture Metahuman_Ref, passe 1 (Gavin + Hana) ;
#   2. session d'EDITEUR COMPLET (scripts/adk-session-metahuman.py), garde de duree ;
#   3. PREUVE disque de la session, dans un processus neuf ;
#   4. chaine de cook GENERALE (scripts/narvos-chaine-cook.sh : cook, inventaire,
#      pack — apres fermeture de nanos —, les neuf catalogues, verification) ;
#   5. PREUVE cuite, imports de Metahuman_Ref et PontMetaHuman, dependances
#      moteur, batterie.
#
#   bash .hermes/session-metahuman.sh
#
# Bilan unique : .hermes/bilan_metahuman_2026-09-13.log
# ══════════════════════════════════════════════════════════════════════════════
set -u
RACINE="E:/narvosprime-web-prototype"
UE_GUI="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
BILAN="$RACINE/.hermes/bilan_metahuman_2026-09-13.log"
PACK="$RACINE/WebPortal/Server/Assets/narvos/Narvos"
CONTENT="$RACINE/WebPortal/Server/adk/Content"
JOURNAL_ADK="$RACINE/WebPortal/Server/adk/Saved/Logs/NanosWorldADK.log"
MH_SOURCE="$RACINE/WebPortal/public/asset_game/mixte_epoques/Meta Customization System - Unreal Engine"
# Passe 1 : ni poses du cou (265 Mo), ni control rigs, ni archetype de visage —
# le post-process du visage est coupe dans les Blueprints — ni les correctifs du
# corps d'APERCU f_med_nrw (88 AnimSequence/PoseAsset : les huit cooks morts de ce
# projet l'ont tous ete sur des animations). Mesure du 13/09 : la fermeture ne
# contient alors AUCUNE AnimSequence.
# 2026-09-13 soir : Face_AnimBP exclu — noeud LiveLinkPose (module absent du client,
# CRASH vu en jeu) ; remplace par PontMetaHuman/ABP_NarvosVisage + ClassRedirects
# (DefaultEngine.ini). Le relier le ferait cuire a cote de sa copie redirigee.
EXCLURE='Metahuman_Ref/Common/Face/Face_AnimBP$,Metahuman_Ref/Common/Face/neckPoses/,Metahuman_Ref/Common/Face/Face_Archetype$,Metahuman_Ref/Common/Face/Face_PostProcess_AnimBP$,Metahuman_Ref/Common/Face/Neck_CtrlRig$,Metahuman_Ref/Common/Face/HeadMovementIK_Proc_CtrlRig$,Metahuman_Ref/Common/Face/Face_ControlBoard_CtrlRig$,Metahuman_Ref/Common/MetaHuman_ControlRig$,Metahuman_Ref/Common/metahuman_proc_ControlRig$,Metahuman_Ref/Common/Female/Medium/NormalWeight/Body/f_med_nrw_animbp$,Metahuman_Ref/Common/Female/Medium/NormalWeight/Poses/'
# Garde-fou : une boite de dialogue que -unattended n'aurait pas levee bloquerait
# tout. Reference : la session du lot 3 (4 etapes) a tenu en moins d'une heure.
DELAI_MAX_S=$((120 * 60))
cd "$RACINE" || exit 1

dire() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$BILAN"; }
nanos_ouvert() { tasklist 2>/dev/null | grep -qiE "NanosWorldServer|NanosWorld\.exe"; }

# ── 0. Preconditions ─────────────────────────────────────────────────────────
dire "=== 0. preconditions"
if ! node scripts/lua-harness/redirects-idempotents-check.mjs > .hermes/redirects_metahuman.log 2>&1; then
  dire "ARRET : un redirect par sous-chaine n'est pas idempotent (ou sa cible manque) :"
  grep "ECHEC" .hermes/redirects_metahuman.log | tee -a "$BILAN"
  exit 1
fi
dire "    redirects idempotents : $(tail -1 .hermes/redirects_metahuman.log)"
if [ ! -f "$CONTENT/Narvos/Interchange/gltf/M_Default.uasset" ]; then
  dire "ARRET : copie Interchange absente (Content/Narvos/Interchange/gltf/M_Default.uasset)."
  exit 1
fi
if tasklist 2>/dev/null | grep -qi "UnrealEditor"; then
  dire "ARRET : un Unreal tourne deja."
  exit 1
fi
if nanos_ouvert; then dire "    nanos ouvert : attente de sa fermeture (on ne tue rien)"; fi
while nanos_ouvert; do sleep 60; done
AVANT=$(grep -rla --include="*.uasset" "/InterchangeAssets/" "$PACK" 2>/dev/null | wc -l)
dire "    AVANT : $AVANT paquet(s) du pack en place citent /InterchangeAssets/ (plugin moteur)"

# ── 1. Liens durs ────────────────────────────────────────────────────────────
dire "=== 1. liens durs Metahuman_Ref (passe 1 : MCSGavin + FCSBase)"
node scripts/adk-copier-hyper.mjs --racine Metahuman_Customization_System --source "$MH_SOURCE" \
  --cible MetaCustom --seulement "Metahuman_Ref/" \
  --manifeste WebPortal/Server/adk/_manifests/metahuman_ref-promotion.json \
  --exclure "$EXCLURE" --apply > .hermes/liens_metahuman.log 2>&1
CODE=$?
grep -E "Racines|Fichiers a copier|Hors perimetre|introuvable|Liens durs|conflit|ARRET" .hermes/liens_metahuman.log | tee -a "$BILAN"
if [ "$CODE" -ne 0 ]; then dire "ARRET : liens durs (code $CODE)"; exit 1; fi

# ── 2. Session d'editeur ─────────────────────────────────────────────────────
# Tailles AVANT : un UMaterial qui perd son graphe fond (171 Ko -> 124 Ko, 06/09).
find "$CONTENT/Narvos" -name "*.uasset" -printf "%s\t%p\n" > .hermes/tailles_avant_metahuman.tsv 2>/dev/null
SESSION_LOG=".hermes/session_metahuman_$(date +%H%M).log"
dire "=== 2. session editeur (journal $SESSION_LOG)"
"$UE_GUI" "$ADK" -ExecutePythonScript="$RACINE/scripts/adk-session-metahuman.py" -unattended -nosplash > "$SESSION_LOG" 2>&1 &
PID=$!
ecoule=0
while kill -0 "$PID" 2>/dev/null; do
  sleep 30
  ecoule=$((ecoule + 30))
  if [ "$ecoule" -ge "$DELAI_MAX_S" ]; then
    dire "    DELAI DEPASSE ($((DELAI_MAX_S / 60)) min) : l'editeur lance par CE script est arrete."
    kill "$PID" 2>/dev/null
    sleep 10
    taskkill //F //IM UnrealEditor.exe > /dev/null 2>&1
    break
  fi
done
dire "    editeur termine apres $((ecoule / 60)) min"
sleep 20
grep -a "\[NARVOS\]" "$JOURNAL_ADK" 2>/dev/null | sed 's/.*\[NARVOS\] /    /' | tail -30 | tee -a "$BILAN"
dire "    -- journal du pont (fin)"
tail -16 WebPortal/Server/adk/_pont-metahuman.log 2>/dev/null | sed 's/^/    /' | tee -a "$BILAN"

# ── 3. Preuve de session ─────────────────────────────────────────────────────
dire "=== 3. preuve disque de la session"
node scripts/narvos-preuve-metahuman.mjs session > .hermes/preuve_session_metahuman.log 2>&1
CODE_SESSION=$?
tee -a "$BILAN" < .hermes/preuve_session_metahuman.log
# Un materiau corrige qui a FONDU a perdu son graphe : on ne cuit pas ca.
FONDUS=$(python - <<'PY'
# Sans barre oblique inverse : un heredoc en a deja mange (feedback_heredoc_backslash).
import json, os
avant = {}
for ligne in open(".hermes/tailles_avant_metahuman.tsv", encoding="utf-8", errors="replace"):
    taille, _, chemin = ligne.rstrip(chr(10)).rstrip(chr(13)).partition(chr(9))
    avant[os.path.normcase(os.path.normpath(chemin))] = int(taille)
chemin_rapport = "WebPortal/Server/adk/_manifests/usage-skeletal.json"
# Sans rapport, rien n'a ete ecrit : rien n'a pu fondre (la preuve de session le signale).
rapport = json.load(open(chemin_rapport, encoding="utf-8")) if os.path.exists(chemin_rapport) else {}
content = "WebPortal/Server/adk/Content/"
fondus = 0
for c in rapport.get("corriges", []):
    f = os.path.normcase(os.path.normpath(os.path.abspath(content + c["materiau"][len("/Game/"):] + ".uasset")))
    if f in avant and os.path.exists(f) and os.path.getsize(f) < 0.8 * avant[f]:
        fondus += 1
print(fondus)
PY
)
dire "    materiaux FONDUS (< 80 % de leur taille) : ${FONDUS:-?}"
if [ "${FONDUS:-1}" != "0" ]; then
  dire "ARRET : des materiaux ont fondu — graphe perdu ? Pas de cook. Sauvegardes : aucune ecriture sur un fichier lie."
  exit 1
fi
if [ "$CODE_SESSION" -ne 0 ]; then
  dire "    preuve de session INCOMPLETE : le cook part quand meme (les PNJ et les MetaHumans sont independants) — a lire ci-dessus."
fi

# ── 4. Chaine generale ───────────────────────────────────────────────────────
dire "=== 4. chaine de cook generale"
bash scripts/narvos-chaine-cook.sh > .hermes/chaine_metahuman.log 2>&1
CODE=$?
grep -aE "^===|ARRET|attente|metahuman :|reference\(s\) morte|morte\(s\)|PERIME|IDENTITE|MANQUE" .hermes/chaine_metahuman.log | head -60 | tee -a "$BILAN"
if [ "$CODE" -ne 0 ] || ! grep -q "=== TERMINE" .hermes/chaine_metahuman.log; then
  dire "ARRET : chaine incomplete (code $CODE)"
  exit 1
fi

# ── 5. Preuves cuites ────────────────────────────────────────────────────────
dire "=== 5. preuve cuite"
APRES=$(grep -rla --include="*.uasset" "/InterchangeAssets/" "$PACK" 2>/dev/null | grep -v "/Narvos/Interchange/" | wc -l)
dire "    Forge : paquets hors copie citant encore /InterchangeAssets/ : $APRES (avant : $AVANT)"
F=$(find "$PACK/halo_map/halo_map/Materials" -name "forge_halo_rocks_-forge_halo_rock_med_special_b01___forge_halo_rocks_island_.uasset" | head -1)
if [ -n "$F" ]; then
  dire "    instance Forge temoin : $(grep -aoE "/Game/Narvos/Interchange/gltf/MaterialInstances/MI_[A-Za-z_]+|/Game/Narvos/Game/[A-Za-z/]+|/InterchangeAssets/gltf/MaterialInstances/MI_[A-Za-z_]+" "$F" | sort -u | tr "\n" " ")"
fi
dire "    copie Interchange cuite : $(find "$PACK/Interchange" -name "*.uasset" 2>/dev/null | wc -l) paquet(s)"
node scripts/narvos-preuve-metahuman.mjs cuit 2>&1 | tee -a "$BILAN"
for R in "Narvos/MetaCustom/Metahuman_Ref" "Narvos/PontMetaHuman"; do
  dire "    -- imports $R"
  node scripts/narvos-imports-casses.mjs "$R" 2>&1 | grep -E "examinee|Aucun import|ABSENT\(S\) :|base nanos|Imports de" | head -4 | tee -a "$BILAN"
done
dire "    -- dependances moteur"
node scripts/narvos-dependances-moteur.mjs 2>&1 | tail -8 | tee -a "$BILAN"
node scripts/lua-harness/tout.mjs > .hermes/batterie_metahuman.log 2>&1
grep -E "harnais ·" .hermes/batterie_metahuman.log | tee -a "$BILAN"
dire "FIN"