#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# adk-session-reparations.sh — rejoue les passes de reparation d'origine sur les dossiers
# rebatis (adk-session-reparations.py, editeur complet), puis PROUVE leur effet sur le disque
# dans un processus neuf.
#
#   bash scripts/recuperation/adk-session-reparations.sh
#
# ⚠ A lancer APRES tous les imports : la passe des drapeaux part des maillages presents.
#
# Modele : .hermes/session-metahuman.sh (13/09), dont elle reprend les deux preuves — le nom
# du drapeau dans la table de noms, et la garde « materiau FONDU » (un UMaterial qui perd son
# graphe perd du poids : 171 Ko -> 124 Ko, mesure du 06/09).
# ══════════════════════════════════════════════════════════════════════════════
set -u
RACINE="E:/narvosprime-web-prototype"
CONTENT="$RACINE/WebPortal/Server/adk/Content"
AVANT="$RACINE/WebPortal/Server/adk/_manifests/session-reparations-tailles-avant.tsv"
cd "$RACINE" || exit 1

# Tailles AVANT, pour la garde « fondu ».
find "$CONTENT/Narvos" -name "*.uasset" -printf "%s\t%p\n" > "$AVANT" 2>/dev/null
echo "$(wc -l < "$AVANT") paquets releves avant la session"
bash scripts/recuperation/adk-session.sh recuperation/adk-session-reparations.py || exit 1

echo "=== preuves, relues sur le disque"
python - "$AVANT" <<'PY'
# Sans barre oblique inverse dans ce bloc : un heredoc en a deja mange.
import json, os, sys
avant = {}
for ligne in open(sys.argv[1], encoding="utf-8", errors="replace"):
    taille, _, chemin = ligne.rstrip(chr(10)).rstrip(chr(13)).partition(chr(9))
    avant[os.path.normcase(os.path.normpath(chemin))] = int(taille)
content = "E:/narvosprime-web-prototype/WebPortal/Server/adk/Content/"
rapport_chemin = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/usage-skeletal.json"
if not os.path.exists(rapport_chemin):
    print("    AUCUN rapport usage-skeletal : la passe des drapeaux n'a rien ecrit.")
    sys.exit(1)
rapport = json.load(open(rapport_chemin, encoding="utf-8"))
corriges = rapport.get("corriges", [])
prouves = fondus = absents = 0
for c in corriges:
    f = content + c["materiau"][len("/Game/"):] + ".uasset"
    if not os.path.exists(f):
        absents += 1
        continue
    if b"bUsedWithSkeletalMesh" in open(f, "rb").read():
        prouves += 1
    cle = os.path.normcase(os.path.normpath(f))
    if cle in avant and os.path.getsize(f) < 0.8 * avant[cle]:
        fondus += 1
        print("    FONDU :", c["materiau"], avant[cle], "->", os.path.getsize(f))
print("    drapeaux : %d corrige(s) annonces ; %d portent bUsedWithSkeletalMesh sur le disque ; %d fichier(s) absents"
      % (len(corriges), prouves, absents))
print("    anterieurs au seuil (non touches) : %d ; lies en dur : %d ; echecs : %d ; illisibles : %d"
      % (len(rapport.get("anterieurs_au_seuil", [])), len(rapport.get("lies_en_dur", [])),
         len(rapport.get("echecs", [])), len(rapport.get("illisibles", []))))
print("    materiaux FONDUS (< 80 %% de leur taille) : %d" % fondus)
reserves = sum(1 for d, _, fs in os.walk(content + "Narvos") for x in fs if x.startswith("WorldGridMaterial"))
print("    assets au nom reserve WorldGridMaterial* restants : %d" % reserves)
# Le blend space : `Segments` n'entre dans le paquet que si ResampleData a tourne. Sans lui
# l'asset se charge, se cuit, et ne joue rien (voir adk-blend-space-locomotion.py).
blend = content + "Narvos/Locomotion/BS_Narvos_Locomotion.uasset"
octets = open(blend, "rb").read() if os.path.exists(blend) else b""
blend_ok = b"BlendSpaceData" in octets and b"Segments" in octets and b"SampleData" in octets
print("    blend space de locomotion : %s" % (
    "%d octets, donnees d'execution presentes" % len(octets) if blend_ok
    else ("ABSENT" if not octets else "SANS donnees d'execution (Segments) — ne jouerait rien")))
sys.exit(1 if (fondus or prouves != len(corriges) - absents or reserves or not blend_ok) else 0)
PY
code=$?
echo "=== verdict : $([ "$code" -eq 0 ] && echo "session prouvee" || echo "A LIRE — une preuve manque (voir ci-dessus)")"
python scripts/recuperation/etat-adk.py | head -2
exit "$code"
