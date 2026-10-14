# -*- coding: utf-8 -*-
"""
test_ini_moteur.py — preuves de rebatir-ini-moteur.py : un trou de la reconstitution n'est
comblé que s'il est encadré, rien n'est inventé hors d'un commentaire, et les redirects
exacts de la ville suivent la règle d'Astra (copie promue, sinon DependancesVille).

  python scripts/recuperation/test_ini_moteur.py
"""
import importlib.util
import json
import os
import struct
import sys
import tempfile

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
spec = importlib.util.spec_from_file_location("ini_moteur", os.path.join(ICI, "rebatir-ini-moteur.py"))
ini = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ini)

reussis = echecs = 0


def verifier(condition, nom):
    global reussis, echecs
    if condition:
        reussis += 1
    else:
        echecs += 1
        print("ECHEC :", nom)


TROU = "# [TROU — ligne jamais lue dans les transcriptions]"

# ── 1. Le squelette : trous et marqueurs ────────────────────────────────────────────────
recon = ["[A]", TROU, "x=1",
         "# [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : ? ligne(s) attendue(s) ici, 3 connue(s)]",
         "y=2", TROU, "# [ANCIENNE VERSION ↑]", ""]
s = ini.squelette(recon)
verifier(s == ["[A]", None, "x=1", "y=2", None], "1. un trou devient None, un marqueur disparaît, la fin vide tombe")
verifier(ini.squelette(["# commentaire ordinaire", "k=v"]) == ["# commentaire ordinaire", "k=v"],
         "1. une ligne `#` qui n'est pas un marqueur reste")

# ── 2. Combler : seulement un trou ENCADRÉ, de la bonne longueur ───────────────────────
base = ["[A]", "a=0", "x=1", "[B]", "p=1", "p=2", "p=3", "z=9"]
f, n, laisses = ini.combler(["[A]", None, "x=1", "[B]", None, None, None, "z=9"], base)
verifier(f == base and n == 4 and laisses == [], "2. deux trous encadrés sont comblés par le vrai fichier")
f, n, laisses = ini.combler([None, None, "x=1", "[B]"], base)
verifier(f[:2] == ["[A]", "a=0"] and n == 2, "2. un trou de tête se comble quand la ligne suivante est à la même place")
f, n, laisses = ini.combler([None, "x=1", "[B]"], base)
verifier(f[0] is None and laisses == [(0, 0)], "2. un trou de tête trop court n'est pas comblé")
f, n, laisses = ini.combler(["[B]", None, None, "z=9"], base)
verifier(n == 0 and laisses == [(1, 2)], "2. deux lignes de trou pour trois lignes dans la base : laissé")
f, n, laisses = ini.combler(["[B]", None, "neuf=1", None, "z=9"], base)
verifier(n == 0 and len(laisses) == 2, "2. une borne absente de la base (ligne plus récente) : rien n'est comblé")
f, n, laisses = ini.combler(["x=1", "[B]", None, None, None], base)
verifier(n == 0 and laisses == [(2, 4)], "2. un trou de queue n'a qu'une borne : laissé")

# ── 3. Un trou restant : toléré dans un commentaire, jamais ailleurs ───────────────────
f = ini.noter_commentaires(["; début", None, None, None, "; fin", "k=v"], [(1, 3)])
verifier(len(f) == 6 and f[1].startswith("; [rebâti") and "3 ligne(s)" in f[1] and f[2:4] == [";", ";"],
         "3. le trou garde sa longueur : une note puis des lignes `;`")
try:
    ini.noter_commentaires(["[A]", None, "k=v"], [(1, 1)])
    verifier(False, "3. un trou hors commentaire doit arrêter l'outil")
except SystemExit:
    verifier(True, "3. un trou hors commentaire arrête l'outil")

# ── 4. Les mentions hors pack d'un en-tête ─────────────────────────────────────────────
octets = (b"\x1a\x00\x00\x00/Game/CITY_PACK/MAT/M_A\x00" b"\x00\x00/Game/Narvos/X/Y\x00"
          b"/Game/NanosWorld/Characters/Common/SKEL_Mannequin\x00" b"/Game/Hyper/BP/M.M_C\x00"
          b"/Game/Seul\x00" b"/Game/City_Traffic_Pro/Demo/T:Sub\x00")
m = ini.mentions_hors_pack(octets)
verifier(m == {"/Game/CITY_PACK/MAT/M_A", "/Game/Hyper/BP/M", "/Game/City_Traffic_Pro/Demo/T"},
         "4. chemins de paquet hors Narvos/NanosWorld, sans l'objet ni le sous-objet")

# ── 5. Les dossiers jamais cuits ────────────────────────────────────────────────────────
jamais = ini.jamais_cuits('+DirectoriesToNeverCook=(Path="Narvos/CoreC")\n+DirectoriesToNeverCook=(Path="/Game/Hyper/")\n')
verifier(jamais == ["/Game/Narvos/CoreC", "/Game/Hyper"], "5. chemins ramenés à /Game/…, sans barre finale")
verifier(ini.sous("/Game/Narvos/CoreC/A/B", jamais) and ini.sous("/Game/Hyper", jamais)
         and not ini.sous("/Game/Narvos/CoreCible/A", jamais), "5. `sous` compare des dossiers entiers, pas des préfixes")

# ── 6. Redirects déjà écrits : sous-chaîne ou exact ────────────────────────────────────
lignes = ['+PackageRedirects=(OldName="/Game/Hyper/",NewName="/Game/Narvos/Hyper/",MatchSubstring=true)',
          '+PackageRedirects=(OldName="/Game/CITY_PACK/A",NewName="/Game/Narvos/CITY_PACK/A")',
          '; +PackageRedirects=(OldName="/Game/Mort/",NewName="/Game/Narvos/Mort/",MatchSubstring=true)',
          '+ObjectRedirects=(OldName="/Game/X/S.S",NewName="/Game/NanosWorld/S.S")', None, "k=v"]
r = ini.redirects_actifs(lignes)
verifier(len(r) == 3 and r[0] == ("Package", "/Game/Hyper/", "/Game/Narvos/Hyper/", True) and r[1][3] is False,
         "6. trois redirects actifs ; la ligne commentée et le trou n'en sont pas")
verifier(ini.couvert("/Game/Hyper/BP/M", r) and ini.couvert("/Game/CITY_PACK/A", r)
         and not ini.couvert("/Game/CITY_PACK/AB", r) and not ini.couvert("/Game/Mort/M", r)
         and not ini.couvert("/Game/X/S", r),
         "6. sous-chaîne, exact (pas de préfixe), commenté, et un ObjectRedirect ne couvre pas un paquet")

# ── 7. La règle d'Astra ─────────────────────────────────────────────────────────────────
disque = {"/Game/Narvos/CITY_PACK/MAT/M_A", "/Game/Narvos/DependancesVille/CITY_PACK/DEMO/T_B",
          "/Game/Narvos/CITY_PACK/DEMO/T_C", "/Game/Narvos/DependancesVille/CITY_PACK/DEMO/T_C"}
existe = disque.__contains__
verifier(ini.redirect_exact("/Game/CITY_PACK/MAT/M_A", existe) == "/Game/Narvos/CITY_PACK/MAT/M_A",
         "7. la copie promue d'abord")
verifier(ini.redirect_exact("/Game/CITY_PACK/DEMO/T_B", existe) == "/Game/Narvos/DependancesVille/CITY_PACK/DEMO/T_B",
         "7. sinon la copie de DependancesVille")
verifier(ini.redirect_exact("/Game/CITY_PACK/DEMO/T_C", existe) == "/Game/Narvos/CITY_PACK/DEMO/T_C",
         "7. les deux existent : la copie promue gagne (règle d'Astra)")
verifier(ini.redirect_exact("/Game/CITY_PACK/NULLE_PART", existe) is None, "7. aucune cible : aucun redirect")

# ── 8. Le bloc de la ville ──────────────────────────────────────────────────────────────
cites = {"/Game/Narvos/CITY_PACK/MAT/MI_1": {"/Game/CITY_PACK/MAT/M_A", "/Game/Hyper/BP/M", "/Game/CITY_PACK/NULLE_PART"},
         "/Game/Narvos/Maps/Map_X": {"/Game/CITY_PACK/DEMO/T_B", "/Game/CITY_PACK/DEMO/T_C", "/Game/CITY_PACK/A"},
         "/Game/Narvos/Autre/P": {"/Game/AutrePack/Z"}}
ecrire, orphelins, hors_cook = ini.bloc_ville(cites, r, existe, ["/Game/Narvos/CITY_PACK/DEMO"])
verifier([a for a, _ in ecrire] == ["/Game/CITY_PACK/DEMO/T_B", "/Game/CITY_PACK/DEMO/T_C", "/Game/CITY_PACK/MAT/M_A"],
         "8. un redirect par ancien chemin de la ville encore cité, trié ; le déjà couvert et les autres packs n'y sont pas")
verifier(list(orphelins) == ["/Game/CITY_PACK/NULLE_PART"] and orphelins["/Game/CITY_PACK/NULLE_PART"] == ["/Game/Narvos/CITY_PACK/MAT/MI_1"],
         "8. un ancien chemin sans cible est rendu avec qui le cite")
verifier(hors_cook == [("/Game/CITY_PACK/DEMO/T_C", "/Game/Narvos/CITY_PACK/DEMO/T_C")],
         "8. une cible dans un dossier jamais cuit est signalée")

# ── 9. L'en-tête d'un paquet : seulement l'en-tête, et rien d'un fichier malade ────────
with tempfile.TemporaryDirectory() as d:
    def ecrire_fichier(nom, octets):
        p = os.path.join(d, nom)
        with open(p, "wb") as f:
            f.write(octets)
        return p
    nom = b"/Game/CITY_PACK/MAT/M_A\x00"
    # UE 5.7 (≥ 1016) : marque, -9, UE3, UE4, UE5, licencié, empreinte (20), taille d'en-tête.
    resume = ini.MAGIE + struct.pack("<iiiii", -9, 864, 522, 1018, 0) + b"\x11" * 20
    total = len(resume) + 4 + len(nom)
    recent = ecrire_fichier("recent.uasset", resume + struct.pack("<i", total) + nom + b"/Game/APRES/Entete\x00" * 50)
    e = ini.entete(recent)
    verifier(e is not None and len(e) == total and b"M_A" in e and b"APRES" not in e,
             "9. paquet 5.7 : on s'arrête à la taille d'en-tête annoncée")
    # UE 5.4 (1012) : les versions personnalisées précèdent la taille d'en-tête.
    resume = ini.MAGIE + struct.pack("<iiiii", -8, 864, 522, 1012, 0) + struct.pack("<i", 2) + b"\x22" * 40
    total = len(resume) + 4 + len(nom)
    ancien = ecrire_fichier("ancien.uasset", resume + struct.pack("<i", total) + nom + b"\x00" * 300)
    e = ini.entete(ancien)
    verifier(e is not None and len(e) == total and e.endswith(nom), "9. paquet 5.4 : versions personnalisées sautées")
    # Un en-tête plus long que le premier bloc lu est relu en entier.
    resume = ini.MAGIE + struct.pack("<iiiii", -9, 864, 522, 1018, 0) + b"\x11" * 20
    gros_total = 200000
    corps = b"\x00" * (gros_total - len(resume) - 4 - len(nom)) + nom
    gros = ecrire_fichier("gros.umap", resume + struct.pack("<i", gros_total) + corps + b"\x00" * 1000)
    e = ini.entete(gros)
    verifier(e is not None and len(e) == gros_total and e.endswith(nom), "9. en-tête de 200 Ko : lu jusqu'au bout")
    verifier(ini.entete(ecrire_fichier("bruit.uasset", b"\xff" * 5000)) is None, "9. un fichier sans la marque : None")
    verifier(ini.entete(ecrire_fichier("court.uasset", ini.MAGIE + b"\x00" * 8)) is None, "9. un fichier tronqué : None")

    # ── 10. Le balayage : Narvos seulement, dossiers jamais cuits sautés ─────────────────
    content = os.path.join(d, "Content")
    for rel, octets in (("Narvos/A/P1.uasset", open(recent, "rb").read()),
                        ("Narvos/CoreC/P2.uasset", open(recent, "rb").read()),
                        ("Narvos/A/malade.uasset", b"\xff" * 100),
                        ("Narvos/A/notes.txt", b"/Game/CITY_PACK/MAT/M_A"),
                        ("Hors/P3.uasset", open(recent, "rb").read())):
        p = os.path.join(content, *rel.split("/"))
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "wb") as f:
            f.write(octets)
    cites2, lus, malades = ini.balayer(content, ["/Game/Narvos/CoreC"])
    verifier(cites2 == {"/Game/Narvos/A/P1": {"/Game/CITY_PACK/MAT/M_A"}} and lus == 1,
             "10. un seul paquet lu : ni le dossier jamais cuit, ni ce qui est hors de Narvos, ni le .txt")
    verifier(malades == ["/Game/Narvos/A/malade.uasset"], "10. le fichier malade est nommé, pas ignoré")
    verifier(ini.existe_sur_disque(content)("/Game/Narvos/A/P1") and not ini.existe_sur_disque(content)("/Game/Narvos/A/P9"),
             "10. l'existence d'un paquet se lit sur le disque (.uasset ou .umap)")

    # ── 11. Les lectures de Codex ────────────────────────────────────────────────────────
    jour = os.path.join(d, "codex", "2026", "09", "15")
    os.makedirs(jour)

    def appel(ident, commande, sortie, quand="2026-09-15T07:40:24.000Z"):
        morceau = json.dumps({"chunk_id": "x", "exit_code": 0, "output": sortie})
        return [json.dumps({"timestamp": quand, "payload": {"type": "custom_tool_call", "call_id": ident, "input": commande}}),
                json.dumps({"timestamp": quand, "payload": {"type": "custom_tool_call_output", "call_id": ident,
                                                            "output": json.dumps([{"type": "input_text", "text": "Script completed"},
                                                                                  {"type": "input_text", "text": morceau}])}})]
    tete = "\r\n".join(["[URL]", "GameName=X"] + [f"l{i}" for i in range(3, 66)]) + "\r\nD:/autre.md:68: bruit"
    lignes = (appel("c1", "Get-Content -LiteralPath 'D:/p/WebPortal/Server/adk/Config/DefaultEngine.ini' -TotalCount 65; rg -n 'x' 'D:/p/.hermes'", tete)
              + appel("c2", "rg -n 'CoreRedirects' WebPortal/Server/adk/Config/DefaultEngine.ini; python -c 1", "218:[CoreRedirects]\r\n4…1 tokens truncated…\r\n")
              + appel("c3", "rg -n 'GPUSkin' WebPortal/Server/adk/Config/DefaultEngine.ini 'D:/steam/Engine.ini'", "36:pas un témoin\r\n")
              + appel("c4", "rg -n 'x' WebPortal/Server/adk/Config/DefaultEngine.ini", "9:trop tôt\r\n", "2026-09-14T20:00:00.000Z"))
    with open(os.path.join(jour, "rollout-a.jsonl"), "w", encoding="utf-8") as f:
        f.write("\n".join(lignes) + "\n")
    temoins = ini.lectures_codex(os.path.join(d, "codex"))
    verifier(len(temoins) == 66 and temoins[1] == "[URL]" and temoins[65] == "l65" and temoins[218] == "[CoreRedirects]",
             "11. les 65 lignes de tête et la ligne numérotée d'un `rg -n` sur l'ini seul")
    verifier(temoins[36] == "l36" and temoins[9] == "l9",
             "11. ni un rg sur deux fichiers (préfixé par le chemin), ni une lecture d'avant le 15/09 04 h, "
             "ne remplacent une ligne de tête")

# ── 12. Confronter : le bloc du 23/09 décale les numéros du 15/09 ───────────────────────
final = ["a", "b", "; ── 2026-09-23 : re-ajoutes", "; r.X=True", "; SkeletalMesh.UseExperimentalChunking=1", "c", "d"]
numeros = ini.numeros_du_15_09(final)
verifier(numeros == [1, 2, None, None, None, 3, 4], "12. les lignes du 23/09 n'ont pas de numéro du 15/09")
acc, ecarts = ini.confronter(final, numeros, {1: "a", 3: "c", 4: "X", 9: "hors fichier"})
verifier(acc == 2 and ecarts == [(4, "X", "d"), (9, "hors fichier", None)], "12. accords comptés, écarts rendus avec le lu et le rebâti")
verifier(ini.numeros_du_15_09(["a", "b"]) == [1, 2], "12. sans bloc du 23/09 : numérotation directe")

print(f"ini moteur : {reussis} assertion(s) reussie(s), {echecs} echec(s)")
sys.exit(1 if echecs else 0)
