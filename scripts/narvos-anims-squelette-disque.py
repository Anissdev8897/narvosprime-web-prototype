# -*- coding: utf-8 -*-
"""
narvos-anims-squelette-disque.py — quel squelette chaque animation reference,
lu DANS LE FICHIER, sans ouvrir l editeur.

    python scripts/narvos-anims-squelette-disque.py <dossier Content relatif> [...]

-- POURQUOI HORS EDITEUR ------------------------------------------------------
`adk-lister-anims-sans-squelette.py` fait mieux (il lit le registre) mais exige
l editeur. Or la question « puis-je retirer cette exclusion de cook ? » se pose
AVANT de lancer quoi que ce soit : une animation dont le squelette est absent ne
rate pas la compression, elle TUE le cook (Assertion !Hash.IsZero(),
AnimSequence.cpp:2151) — deux fois deja sur ce projet.

-- CE QU IL LIT ---------------------------------------------------------------
Les noms d un paquet Unreal sont stockes en clair. Une animation porte le chemin
de son USkeleton sous la forme :

    /Script/Engine.Skeleton'/Game/.../Skel_Dummy.Skel_Dummy'

On le releve et on verifie que le fichier existe.

-- ⚠ CE QUE « SAIN » NE VEUT PAS DIRE ------------------------------------------
Le 2026-09-12, cette sonde a declare `mh_arkit_mapping_anim` SAIN. Le cook est
mort dessus 40 minutes plus tard, a 52 441 paquets :

    Animation Compression request for mh_arkit_mapping_anim failed,
    Skeleton == nullptr.

Le nom `head2_Skeleton` etait bien dans le fichier — mais la PROPRIETE Skeleton
de l AnimSequence etait nulle. Un nom CITE n est pas une propriete RENSEIGNEE :
un paquet garde dans sa table de noms des references heritees, des chaines de
commentaire, des restes d imports supprimes.

Cette sonde repond donc a UNE question : « les squelettes qu il nomme
existent-ils ? ». Elle ne repond pas a « son squelette est-il renseigne ? » —
seul `scripts/adk-lister-anims-sans-squelette.py`, qui lit l etiquette du
REGISTRE Unreal, le sait. Elle sert a preparer, jamais a conclure.
"""
import os
import re
import sys

CONTENT = "E:/narvosprime-web-prototype/WebPortal/Server/adk/Content"
MOTIF = re.compile(rb"/Script/Engine\.Skeleton'(/Game/[^.']+)\.")

def squelettes(chemin):
    with open(chemin, "rb") as f:
        d = f.read()
    return sorted({m.group(1).decode("latin1") for m in MOTIF.finditer(d)})

def existe(paquet):
    return os.path.isfile(os.path.join(CONTENT, paquet[len("/Game/"):] + ".uasset"))

dossiers = sys.argv[1:] or ["Narvos/MetaCustom/Meta_Body_Tool/Animations",
                            "Narvos/MetaCustom/Meta_Face_Tool/Animations"]

total = sains = casses = muets = 0
liste_cassees = []

for rel in dossiers:
    base = os.path.join(CONTENT, rel)
    if not os.path.isdir(base):
        print("!! dossier absent : " + rel)
        continue
    print("== " + rel)
    for racine, _, fichiers in os.walk(base):
        for nom in sorted(fichiers):
            if not nom.endswith(".uasset"):
                continue
            total += 1
            chemin = os.path.join(racine, nom)
            sk = squelettes(chemin)
            court = os.path.relpath(chemin, base).replace(os.sep, "/")
            if not sk:
                muets += 1
                print("   MUET      %-52s (aucun squelette cite)" % court)
                continue
            absents = [s for s in sk if not existe(s)]
            if absents:
                casses += 1
                liste_cassees.append(rel + "/" + court)
                print("   CASSE     %-52s" % court)
                for a in absents:
                    print("             squelette ABSENT : " + a)
            else:
                sains += 1
                print("   sain      %-52s %s" % (court, ", ".join(s.split("/")[-1] for s in sk)))

print()
print("%d paquet(s) : %d avec leurs squelettes presents, %d casse(s), %d muet(s)."
      % (total, sains, casses, muets))
print()
print("⚠ « squelettes presents » n est PAS « squelette renseigne ». Un paquet peut")
print("  NOMMER un squelette existant et porter une propriete Skeleton nulle — c est")
print("  ce qui a tue le cook le 2026-09-12. Pour trancher : editeur ouvert,")
print("  scripts/adk-lister-anims-sans-squelette.py (il lit le registre).")
if liste_cassees:
    print()
    print("CES PAQUETS TUERAIENT LE COOK — a mettre en Quarantaine avant de retirer")
    print("l exclusion du dossier :")
    for c in liste_cassees:
        print("   " + c)