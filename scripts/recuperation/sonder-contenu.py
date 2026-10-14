# -*- coding: utf-8 -*-
"""
sonder-contenu.py — dans un dossier récupéré, chaque fichier a-t-il le contenu que son NOM
promet ? Lecture seule.

  python scripts/recuperation/sonder-contenu.py <dossier> [--detail N]

Nom, taille et date justes ne prouvent rien (lots de la seconde passe : le contenu a été
recouvert par la copie des premiers lots sur E:). On lit donc la MARQUE de chaque type :
  · texte (.h .cpp .py .md .ini .json .uplugin .lua .mjs…) : UTF-8 lisible, sans octets de contrôle ;
  · .dll / .exe : en-tête `MZ`, signature `PE`, sections dans les bornes du fichier ;
  · .pdb : « Microsoft C/C++ MSF 7.00 » ;  .uasset / .umap : `C1 83 2A 9E` ;
  · .png, .zip, .7z, .glb : leur marque.
Le reste est « non jugé » (objets de compilation, binaires sans marque).

Verdict typique d'un dossier recouvert : tout ce qui dépasse ~700 octets est FAUX, seuls les
petits fichiers (résidents dans la table du disque) sont sains — le script donne ce seuil.
Mesuré le 04/10 sur `Nouveau dossier/$F10497/Plugins/UnrealMCPServer` : 69 FAUX, 52 sains,
plus petit FAUX 712 octets, plus grand sain 672 ; la « DLL » contient des paquets Unreal.
"""
import collections
import os
import struct
import sys

TEXTE = {".h", ".hpp", ".c", ".cpp", ".cs", ".py", ".md", ".ini", ".json", ".uplugin", ".uproject", ".modules",
         ".txt", ".toml", ".js", ".mjs", ".ts", ".tsx", ".html", ".css", ".lua", ".xml", ".yml", ".yaml", ".bat",
         ".sh", ".usf", ".ush", ".log", ".csv", ".tsv", ".inl", ".rsp", ".target", ".version"}
MARQUES = {
    ".pdb": b"Microsoft C/C++ MSF 7.00",
    ".uasset": b"\xc1\x83\x2a\x9e",
    ".umap": b"\xc1\x83\x2a\x9e",
    ".png": b"\x89PNG\r\n\x1a\n",
    ".zip": b"PK",
    ".7z": b"7z\xbc\xaf\x27\x1c",
    ".glb": b"glTF",
}


def texte_lisible(octets: bytes) -> bool:
    if octets[:3] == b"\xef\xbb\xbf":
        octets = octets[3:]
    if octets[:2] in (b"\xff\xfe", b"\xfe\xff"):
        try:
            octets.decode("utf-16")
            return True
        except UnicodeDecodeError:
            return False
    for fin in (len(octets), len(octets) - 4):      # une coupure en fin d'échantillon n'accuse pas
        try:
            texte = octets[:max(fin, 0)].decode("utf-8")
            break
        except UnicodeDecodeError:
            texte = None
    if texte is None:
        return False
    controles = sum(1 for c in texte if ord(c) < 32 and c not in "\t\r\n\f")
    return controles <= len(texte) // 200


def pe_coherent(chemin: str, tete: bytes) -> str | None:
    """None si l'exécutable est cohérent, sinon ce qui cloche."""
    if tete[:2] != b"MZ":
        return "pas d'en-tête MZ"
    decalage = struct.unpack_from("<I", tete, 0x3C)[0]
    if decalage + 24 > len(tete) or tete[decalage:decalage + 4] != b"PE\0\0":
        return "pas de signature PE"
    nombre = struct.unpack_from("<H", tete, decalage + 6)[0]
    table = decalage + 24 + struct.unpack_from("<H", tete, decalage + 20)[0]
    with open(chemin, "rb") as f:
        f.seek(table)
        sections = f.read(40 * nombre)
    fin = max((sum(struct.unpack_from("<II", sections, i * 40 + 16)) for i in range(nombre)), default=0)
    return None if fin <= os.path.getsize(chemin) else "sections au-delà du fichier"


def sonder(chemin: str) -> tuple[str, str]:
    ext = os.path.splitext(chemin)[1].lower()
    if os.path.getsize(chemin) == 0:
        return "vide", ""
    with open(chemin, "rb") as f:
        tete = f.read(65536)
    if ext in (".dll", ".exe"):
        defaut = pe_coherent(chemin, tete)
        return ("sain", "exécutable") if defaut is None else ("FAUX", defaut)
    if ext in MARQUES:
        return ("sain" if tete.startswith(MARQUES[ext]) else "FAUX"), "marque " + ext
    if ext in TEXTE:
        return ("sain" if texte_lisible(tete) else "FAUX"), "texte"
    return "non jugé", ext


def main() -> None:
    libres = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith("--") and sys.argv[i - 1] != "--detail"]
    if not libres:
        print(__doc__)
        sys.exit(2)
    detail = int(sys.argv[sys.argv.index("--detail") + 1]) if "--detail" in sys.argv else 12
    racine = libres[0]
    verdicts = collections.Counter()
    faux, sains = [], []
    for dossier, _, fichiers in os.walk(racine):
        for nom in fichiers:
            chemin = os.path.join(dossier, nom)
            try:
                verdict, raison = sonder(chemin)
                taille = os.path.getsize(chemin)
            except OSError as erreur:
                verdict, raison, taille = "illisible", str(erreur), 0
            verdicts[verdict] += 1
            if verdict == "FAUX":
                faux.append((taille, os.path.relpath(chemin, racine).replace("\\", "/"), raison))
            elif verdict == "sain":
                sains.append(taille)
    print("%s : %s" % (racine, ", ".join("%d %s" % (n, v) for v, n in verdicts.most_common())))
    for taille, rel, raison in sorted(faux, reverse=True)[:detail]:
        print("    FAUX %11d  %-84s %s" % (taille, rel[-84:], raison))
    if faux:
        print("plus petit FAUX : %d octets ; plus grand sain : %d octets" % (min(f[0] for f in faux), max(sains, default=0)))
        if sains and max(sains) < min(f[0] for f in faux):
            print("→ contenu RECOUVERT : seuls les petits fichiers (résidents) sont justes ; rien à tirer de ce dossier.")
    sys.exit(1 if faux else 0)


if __name__ == "__main__":
    main()
