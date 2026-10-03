# -*- coding: utf-8 -*-
"""
unity-extraire-package.py — sortir d'un .unitypackage ce qui sert a Unreal.

    python scripts/unity-extraire-package.py <fichier> [--appliquer] [--sortie DOSSIER]

Sans --appliquer : simulation. Il dit ce qu'il sortirait, ce qu'il jetterait, et
combien pese chaque famille. Rien n'est ecrit.

── CE QU'UN .unitypackage CONTIENT VRAIMENT ─────────────────────────────────────
C'est un **tar.gz**, pas un format proprietaire. Chaque asset y occupe un dossier
nomme par son GUID :

    <guid>/asset          le FICHIER BRUT, octet pour octet (le .fbx, le .png)
    <guid>/pathname       son chemin d'origine ("Assets/JSAllAnimals/.../Wolf.FBX")
    <guid>/asset.meta     les reglages d'import Unity
    <guid>/preview.png    la vignette

Le `asset` n'est PAS transforme : un FBX exporte par Unity reste un FBX que
Blender et Unreal lisent. C'est pourquoi « pack Unity » n'est pas un verdict
d'inutilisabilite — seulement une couche d'emballage.

── CE QUI PASSE ET CE QUI NE PASSE PAS ──────────────────────────────────────────
Passe : la GEOMETRIE et les IMAGES. Un `.fbx` porte le maillage, le squelette et
les animations ; un `.png`/`.tga` porte la texture.

Ne passe pas : tout ce qui decrit le COMPORTEMENT ou le RENDU dans Unity.
  · `.cs`         du C# pour le moteur Unity — sans objet ici, notre logique est en Lua ;
  · `.prefab`     un assemblage d'objets Unity (references par GUID) ;
  · `.mat`        un materiau Unity : il pointe des shaders Unity, pas des
                  materiaux Unreal. Les TEXTURES qu'il reference, elles, sortent ;
  · `.controller` une machine a etats d'animation Unity (Mecanim) ;
  · `.unity`      une scene ;
  · `.physicmaterial`, `.asset`  des reglages internes.

⚠ Le materiau est donc a REFAIRE cote Unreal. C'est du travail, pas un blocage :
les textures sortent nommees, il reste a les brancher sur un master material.

── LES NOMS ────────────────────────────────────────────────────────────────────
On ecrit chaque fichier a son chemin d'ORIGINE (celui du `pathname`), pas sous
son GUID. Sans ca on obtient dix mille fichiers nommes par des hexadecimaux, et
plus personne ne sait quel maillage est quel animal.
"""
import argparse
import collections
import gzip
import io
import os
import shutil
import sys
import tarfile
import tempfile
import zipfile

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# Ce qu'Unreal sait importer directement.
GARDER = {
    ".fbx": "maillage / animation",
    ".obj": "maillage",
    ".dae": "maillage",
    ".png": "texture",
    ".tga": "texture",
    ".jpg": "texture",
    ".jpeg": "texture",
    ".tif": "texture",
    ".tiff": "texture",
    ".psd": "texture (calques)",
    ".exr": "texture HDR",
    ".hdr": "texture HDR",
    ".wav": "son",
    ".ogg": "son",
    ".mp3": "son",
    ".ttf": "police",
    ".otf": "police",
}

# Ce qui n'a de sens que dans Unity. Liste EXPLICITE : une extension inconnue
# n'est pas jetee en silence, elle est rapportee a part (voir INCONNUES).
UNITY_SEUL = {
    ".cs": "script C# Unity",
    ".js": "script Unity",
    ".prefab": "assemblage Unity",
    ".mat": "materiau Unity (shaders Unity)",
    ".controller": "machine a etats Mecanim",
    ".anim": "animation Unity native (pas un FBX)",
    ".unity": "scene Unity",
    ".asset": "reglages internes",
    ".physicmaterial": "materiau physique Unity",
    ".shader": "shader Unity (HLSL Unity)",
    ".shadergraph": "shader graph Unity",
    ".guiskin": "skin GUI Unity",
    ".meta": "reglages d'import",
    ".renderTexture": "cible de rendu Unity",
    ".cubemap": "cubemap Unity",
    ".flare": "flare Unity",
    ".mixer": "mixer audio Unity",
    ".preset": "preset Unity",
    ".signal": "signal Timeline",
    ".playable": "Timeline",
    ".inputactions": "Input System Unity",
    ".dll": "binaire",
    ".pdb": "symboles de debogage",
    ".md": "documentation",
    ".txt": "documentation",
    ".pdf": "documentation",
    ".rtf": "documentation",
}


def ouvrir_tar(chemin):
    """Rend (tarfile, menage) — le tar, et une fonction a appeler a la fin.

    ⚠ `tarfile` en mode flux (`r|gz`) echoue sur un flux zip : il fait des
    lectures non sequentielles que le deflate ne sait pas servir (mesure le
    2026-09-10 : « invalid stored block lengths » des le premier bloc, alors que
    la decompression manuelle du meme flux marche). On materialise donc le
    .unitypackage dans un fichier temporaire SEEKABLE avant de l'ouvrir.
    """
    temporaires = []

    def menage():
        for t in temporaires:
            try:
                os.unlink(t)
            except OSError:
                pass

    reel = chemin_long(chemin)
    if chemin.lower().endswith(".zip"):
        z = zipfile.ZipFile(reel)
        dedans = [n for n in z.namelist() if n.lower().endswith(".unitypackage")]
        if not dedans:
            raise SystemExit("ARRET : aucun .unitypackage dans %s" % chemin)
        print("  zip -> %s (extraction temporaire)" % dedans[0])
        fd, tmp = tempfile.mkstemp(suffix=".unitypackage")
        os.close(fd)
        temporaires.append(tmp)
        with z.open(dedans[0]) as src, open(tmp, "wb") as dst:
            shutil.copyfileobj(src, dst, 1 << 22)
        reel = tmp

    return tarfile.open(reel, "r:gz"), menage


def sur(base, relatif):
    """Chemin de sortie sur, sans echappement hors du dossier cible."""
    propre = relatif.replace("\\", "/").lstrip("/")
    morceaux = [m for m in propre.split("/") if m not in ("", ".", "..")]
    return os.path.join(base, *morceaux)


def chemin_long(p):
    """Sur Windows, contourne la limite MAX_PATH (260 caracteres).

    ⚠ Ce paquet la depasse pour de vrai. Mesure du 2026-09-10, premiere
    extraction :

        FileNotFoundError: ...Complete J.Suko Animals Pack_extrait\\Assets\\
        JSAllAnimals\\Vertebrata\\Reptiles\\Turtles\\AlligatorSnappingTurtle\\
        Models\\Old\\AlligatorSnappingTurtleModelVer1.0.FBX

    `os.makedirs` avait bien tourne : c'est l'ouverture qui echoue, et l'erreur
    dit « No such file or directory » — un message qui envoie chercher un
    probleme de dossier alors que le chemin est simplement trop long. La
    taxonomie du pack (regne/classe/ordre/espece/Models/Old) empile les niveaux,
    et le dossier de sortie est deja profond.

    Le prefixe `\\\\?\\` lui dit d'accepter jusqu'a 32 767 caracteres. Il exige
    un chemin ABSOLU, en antislashs, sans `.` ni `..` — d'ou le `abspath`.
    """
    if os.name != "nt":
        return p
    a = os.path.abspath(p)
    if a.startswith("\\\\?\\"):
        return a
    if a.startswith("\\\\"):                      # chemin UNC
        return "\\\\?\\UNC\\" + a.lstrip("\\")
    return "\\\\?\\" + a


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("fichier")
    ap.add_argument("--appliquer", action="store_true",
                    help="ecrire les fichiers (sinon : simulation)")
    ap.add_argument("--sortie", default=None,
                    help="dossier de sortie (defaut : <fichier>_extrait/)")
    args = ap.parse_args()

    # Les archives peuvent elles-mêmes dépasser MAX_PATH, pas seulement leurs
    # fichiers extraits (Multiversal Vehicle Controller, 15/09/2026).
    args.fichier = chemin_long(args.fichier)

    if not os.path.exists(args.fichier):
        raise SystemExit("ARRET : %s est absent." % args.fichier)

    sortie = args.sortie or (os.path.splitext(args.fichier)[0] + "_extrait")

    print("Paquet : %s (%.2f Go)" % (args.fichier, os.path.getsize(args.fichier) / 1e9))
    tar, menage = ouvrir_tar(args.fichier)

    # Passe 1 : lire les `pathname` pour savoir a quoi correspond chaque GUID.
    # Un tar en lecture sequentielle ne permet pas de revenir en arriere ; on
    # ouvre donc le fichier DEUX fois plutot que de tout garder en memoire.
    chemins = {}
    for m in tar:
        if m.isfile() and m.name.endswith("/pathname"):
            guid = m.name.rsplit("/", 1)[0]
            f = tar.extractfile(m)
            if f:
                chemins[guid] = f.read().decode("utf-8", "replace").strip().split("\n")[0]
    tar.close()

    if not chemins:
        # Zero cible = rouge : un paquet sans `pathname` n'est pas un paquet vide,
        # c'est un paquet qu'on n'a pas su lire.
        menage()
        raise SystemExit("ARRET : aucun `pathname` trouve — format inattendu.")

    print("  %d asset(s) declare(s)" % len(chemins))

    gardes = collections.Counter()
    gardes_octets = collections.Counter()
    jetes = collections.Counter()
    inconnues = collections.Counter()
    rates = []
    ecrits = 0

    tar, menage2 = ouvrir_tar(args.fichier)
    for m in tar:
        if not m.isfile() or not m.name.endswith("/asset"):
            continue
        guid = m.name.rsplit("/", 1)[0]
        origine = chemins.get(guid)
        if not origine:
            continue
        ext = os.path.splitext(origine)[1].lower()

        if ext in GARDER:
            gardes[ext] += 1
            gardes_octets[ext] += m.size
            if args.appliquer:
                cible = sur(sortie, origine)
                # ⚠ Un chemin fautif ne doit pas faire perdre les 662 autres.
                # La premiere version levait sur le premier echec et perdait
                # tout le travail deja fait ; on compte et on rapporte a la fin.
                try:
                    os.makedirs(chemin_long(os.path.dirname(cible)), exist_ok=True)
                    long = chemin_long(cible)
                    # Reprise bon marche : un fichier deja sorti a la bonne
                    # taille n'est pas reecrit (relancer coute alors des
                    # secondes, pas dix minutes).
                    if os.path.exists(long) and os.path.getsize(long) == m.size:
                        ecrits += 1
                        continue
                    src = tar.extractfile(m)
                    if src:
                        with open(long, "wb") as dst:
                            shutil.copyfileobj(src, dst, 1 << 20)
                        ecrits += 1
                except OSError as e:
                    rates.append("%s : %s" % (origine, e))
        elif ext in UNITY_SEUL:
            jetes[ext] += 1
        else:
            inconnues[ext] += 1
    tar.close()
    menage()
    menage2()

    total_octets = sum(gardes_octets.values())
    print("\n── GARDE (importable dans Unreal) ──")
    if not gardes:
        print("  RIEN — ce paquet ne porte aucun maillage ni texture.")
    for e, n in gardes.most_common():
        print("  %-8s %5d   %7.1f Mo   %s" % (e, n, gardes_octets[e] / 1e6, GARDER[e]))
    print("  %-8s %5d   %7.1f Mo   TOTAL" % ("", sum(gardes.values()), total_octets / 1e6))

    print("\n── JETE (Unity seulement) ──")
    for e, n in jetes.most_common(12):
        print("  %-16s %5d   %s" % (e, n, UNITY_SEUL[e]))

    if inconnues:
        # Une extension non classee n'est pas jetee en silence : elle se voit.
        print("\n── NON CLASSEE (a decider a la main) ──")
        for e, n in inconnues.most_common(12):
            print("  %-16s %5d" % (e or "(sans extension)", n))

    if args.appliquer:
        print("\nECRIT : %d fichier(s) sous %s" % (ecrits, sortie))
        if rates:
            # Un echec partiel qui ne se voit pas est pire qu'un arret net :
            # on croirait avoir le pack entier.
            print("\n-- NON ECRITS (%d) --" % len(rates))
            for r in rates[:20]:
                print("  %s" % r)
            if len(rates) > 20:
                print("  ... et %d autre(s)." % (len(rates) - 20))
            raise SystemExit(1)
    else:
        print("\n(simulation — relancer avec --appliquer pour ecrire dans %s)" % sortie)


if __name__ == "__main__":
    main()