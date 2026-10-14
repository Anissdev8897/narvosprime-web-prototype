# -*- coding: utf-8 -*-
"""
restaurer-copies-de-packs.py — remet dans l'ADK les dossiers de `Content\\Narvos` qui
n'étaient que la COPIE OCTET POUR OCTET d'un pack d'origine (liens durs posés par
`adk-jonction-pack.ps1`, le pack vivant sous `WebPortal\\public\\asset_game`).

DMDE n'a jamais copié ces dossiers (voir etat-adk.py), mais son second passage en a rendu
la LISTE exacte — nom, taille, date de chaque paquet (`<lots>\\Nouveau dossier\\$F09232`,
contenu faux). Un paquet manquant dont un fichier d'un pack d'origine porte le même nom, la
même taille et le même sous-chemin était un lien dur : on recopie l'original.

  python restaurer-copies-de-packs.py                 # simulation : ce qui serait copié
  python restaurer-copies-de-packs.py --ecrire        # copie (jamais par-dessus un fichier)
  python restaurer-copies-de-packs.py --origine <dossier> [--origine …]   # autres packs d'origine

`--origine` ajoute des racines où chercher les jumeaux — les copies HORS du disque perdu :
le cache d'Epic (`C:/ProgramData/Epic/EpicGamesLauncher/VaultCache`) et les projets
d'exemple (`…/OneDrive/Documents/Unreal Projects`), trouvés le 04/10.

Ne restaure qu'un dossier ENTIÈREMENT couvert : si un seul de ses paquets n'a pas de
jumeau, le dossier venait d'Unreal (import, resauvegarde) et se refait dans l'éditeur —
un dossier à moitié recopié ferait croire qu'il est là.

  python restaurer-copies-de-packs.py --resauves Weapon,UI [--ecrire]

`--resauves` lève cette règle pour les dossiers NOMMÉS, et pour eux seulement : un paquet
sans jumeau de même taille mais dont l'original existe au MÊME sous-chemin a été copié
puis resauvé par une passe connue (les 47 instances de matériau des dossiers Mutable,
re-parentées le 05/09 par `adk-appliquer-parents-source.py`). On recopie l'original, et la
liste de ces paquets est écrite : la passe est à REJOUER, sinon le dossier n'est pas rendu.
Un seul paquet sans original au même chemin, et le dossier est laissé.
"""
import collections
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lots import LOTS, RACINE  # noqa: E402

FANTOME = os.path.join(LOTS, "Nouveau dossier", "$F09232")
CONTENT = os.path.join(RACINE, "Server", "adk", "Content")
ORIGINES = [os.path.join(RACINE, "public", "asset_game")]
ORIGINES += [sys.argv[i + 1] for i, a in enumerate(sys.argv[:-1]) if a == "--origine"]
RESAUVES = {d for i, a in enumerate(sys.argv[:-1]) if a == "--resauves"
            for d in sys.argv[i + 1].split(",") if d}
A_REJOUER = os.path.join(RACINE, "Server", "adk", "_manifests", "copies-resauvees-a-rejouer.json")
MAGIE = b"\xc1\x83\x2a\x9e"


def marcher(racine):
    """(chemin, taille) de chaque .uasset/.umap sous `racine`, sans ouvrir de fichier."""
    pile = [racine]
    while pile:
        d = pile.pop()
        try:
            entrees = list(os.scandir(d))
        except OSError:
            continue
        for e in entrees:
            if e.is_dir(follow_symlinks=False):
                pile.append(e.path)
            elif e.name.lower().endswith((".uasset", ".umap")):
                try:
                    yield e.path, e.stat().st_size
                except OSError:
                    pass


def suffixe_commun(a, b):
    """Nombre de composants de chemin identiques en partant de la fin (casse ignorée)."""
    x, y = a.lower().split(os.sep), b.lower().split(os.sep)
    k = 0
    while k < min(len(x), len(y)) and x[-1 - k] == y[-1 - k]:
        k += 1
    return k


def apparier(fantomes, index):
    """{dossier: ([(relatif, original)], [relatifs sans jumeau])}.

    `fantomes` : [(chemin relatif sous Narvos, taille)] ; `index` : {(nom, taille): [chemins]}.
    Le jumeau doit partager avec le paquet manquant tout son sous-chemin À L'INTÉRIEUR du
    dossier du pack : même nom et même taille ailleurs dans l'arbre ne suffisent pas (deux
    textures par défaut de même poids existent dans presque tous les packs)."""
    plan = collections.defaultdict(lambda: ([], []))
    for rel, taille in fantomes:
        dossier = rel.split(os.sep)[0]
        profondeur = len(rel.split(os.sep))
        candidats = [c for c in index.get((os.path.basename(rel).lower(), taille), [])
                     if suffixe_commun(c, rel) == profondeur]
        if len(candidats) >= 1 and len({os.path.getsize(c) for c in candidats}) == 1:
            plan[dossier][0].append((rel, sorted(candidats)[0]))
        else:
            plan[dossier][1].append(rel)
    return plan


def original_au_meme_chemin(rel, par_nom, prefere):
    """L'original qui occupe le même sous-chemin que `rel`, quelle que soit sa taille — celui
    de la racine `prefere` (celle des jumeaux du dossier) d'abord — ou None."""
    profondeur = len(rel.split(os.sep))
    candidats = [c for c in par_nom.get(os.path.basename(rel).lower(), [])
                 if suffixe_commun(c, rel) == profondeur]
    candidats.sort(key=lambda c: (not c.lower().startswith(prefere.lower()), c))
    return candidats[0] if candidats else None


def court(chemin):
    """Chemin relatif au projet s'il y est, tel quel sinon (une origine sur un autre lecteur
    n'a pas de chemin relatif : `relpath` y lève)."""
    try:
        return os.path.relpath(chemin, RACINE)
    except ValueError:
        return chemin


def sain(chemin):
    try:
        with open(chemin, "rb") as f:
            return f.read(4) == MAGIE
    except OSError:
        return False


def main():
    ecrire = "--ecrire" in sys.argv
    index = collections.defaultdict(list)
    par_nom = collections.defaultdict(list)
    for o in ORIGINES:
        for p, taille in marcher(o):
            index[(os.path.basename(p).lower(), taille)].append(p)
            par_nom[os.path.basename(p).lower()].append(p)
    fantomes = [(os.path.relpath(p, FANTOME), t) for p, t in marcher(FANTOME)]
    plan = apparier(fantomes, index)
    copies = 0
    a_rejouer = {}
    for dossier, (jumeaux, seuls) in sorted(plan.items()):
        if seuls and dossier in RESAUVES and jumeaux:
            # La racine d'où viennent les jumeaux : `…/Content/` devant le sous-chemin du pack.
            prefere = jumeaux[0][1][: -len(jumeaux[0][0])]
            resauves = [(rel, original_au_meme_chemin(rel, par_nom, prefere)) for rel in seuls]
            orphelins = [rel for rel, o in resauves if o is None]
            if orphelins:
                print(f"{dossier} : {len(orphelins)} paquet(s) sans original au même chemin — dossier laissé ({orphelins[0]})")
                continue
            a_rejouer[dossier] = [rel.replace(os.sep, "/") for rel, _ in resauves]
            print(f"{dossier} : {len(resauves)} paquet(s) RESAUVÉS après copie — original recopié, passe à rejouer")
            jumeaux, seuls = jumeaux + resauves, []
        if seuls or not jumeaux:
            continue                                  # dossier fabriqué par Unreal : pas ici
        malades = [o for _, o in jumeaux if not sain(o)]
        if malades:
            print(f"{dossier} : {len(malades)} original(aux) MALADE(S) — dossier laissé ({malades[0]})")
            continue
        deja = 0
        for rel, original in jumeaux:
            cible = os.path.join(CONTENT, "Narvos", rel)
            if os.path.exists(cible):
                deja += 1
                continue
            if ecrire:
                os.makedirs(os.path.dirname(cible), exist_ok=True)
                shutil.copy2(original, cible)
            copies += 1
        print(f"{dossier} : {len(jumeaux)} paquets, {deja} déjà là, {len(jumeaux) - deja} "
              f"{'copiés' if ecrire else 'à copier'} depuis {court(os.path.dirname(jumeaux[0][1]))[:110]}…")
    print(f"{copies} paquet(s) {'copié(s)' if ecrire else 'à copier — passer --ecrire'}")
    if a_rejouer and ecrire:
        with open(A_REJOUER, "w", encoding="utf-8", newline=chr(10)) as f:
            json.dump(a_rejouer, f, ensure_ascii=False, indent=1)
        print(f"paquets à repasser : {court(A_REJOUER)}")


if __name__ == "__main__":
    main()
