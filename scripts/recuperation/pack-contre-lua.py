# -*- coding: utf-8 -*-
"""
pack-contre-lua.py — un pack STAGÉ donne-t-il au jeu ce que le Lua lui demande ?
Lecture seule. À lancer avant de promouvoir un staging vers `Server/Assets/narvos`.

  python scripts/recuperation/pack-contre-lua.py <staging>/narvos/Assets.toml
  python scripts/recuperation/pack-contre-lua.py <staging>/narvos/Assets.toml --reference <autre Assets.toml>

Deux mesures :
  · les clés `narvos::X` ÉCRITES dans le Lua des deux packages (catalogues compris) et
    absentes du pack : le jeu les demandera en vain, sans erreur (un asset inconnu est ignoré) ;
  · avec `--reference` (par défaut le manifeste actif `Server/Assets/narvos/Assets.toml`, seul
    témoin de la liste des clés du pack du 26/09) : ce que la référence déclarait et que le
    staging n'a plus, par dossier de pack — et l'inverse, en nombre.

Ne juge pas le contenu cuit : seulement ce qui est DÉCLARÉ. Un asset déclaré et gris se voit
ailleurs (`textures-rebaties.py`, journal du cook).
"""
import collections
import io
import os
import re
import sys

# Le DEPOT, pas les lots : le Lua vit dans le depot (`lots.RACINE` designe la ou sont les
# jonctions `public` et `Server/adk`).
RACINE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "WebPortal"))
PACKAGES = [os.path.join(RACINE, "Server", "nanos_world", "packages", p) for p in ("narvos", "narvos-map-proto")]
ACTIF = os.path.join(RACINE, "Server", "Assets", "narvos", "Assets.toml")
SECTION = re.compile(r"\s*\[assets\.([a-z_]+)\]")
ENTREE = re.compile(r'\s*"?([^"=\s]+)"?\s*=\s*"(.*?)"')
CLE = re.compile(r"narvos::([A-Za-z0-9_\-\.]+)")


def lire_manifeste(chemin: str) -> dict[str, tuple[str, str]]:
    """{clé: (section, chemin dans le pack)} d'un `Assets.toml`."""
    cles: dict[str, tuple[str, str]] = {}
    section = None
    with io.open(chemin, encoding="utf-8", errors="replace") as f:
        for ligne in f:
            m = SECTION.match(ligne)
            if m:
                section = m.group(1)
                continue
            m = ENTREE.match(ligne)
            if m and section:
                cles[m.group(1)] = (section, m.group(2))
    return cles


def cles_du_lua() -> dict[str, set[str]]:
    """{clé: fichiers qui l'écrivent} pour tout `narvos::X` du Lua et des pages WebUI."""
    citees: dict[str, set[str]] = collections.defaultdict(set)
    for racine in PACKAGES:
        for dossier, _, fichiers in os.walk(racine):
            for nom in fichiers:
                if not nom.endswith((".lua", ".js", ".html", ".toml")):
                    continue
                chemin = os.path.join(dossier, nom)
                try:
                    with io.open(chemin, encoding="utf-8", errors="replace") as f:
                        texte = f.read()
                except OSError:
                    continue
                if nom.endswith(".lua"):
                    # Une clé citée dans un COMMENTAIRE n'est pas demandée au moteur
                    # (`AM_Counter_Front` n'a jamais existé : deux commentaires en parlent).
                    texte = "\n".join(ligne.split("--", 1)[0] for ligne in texte.splitlines())
                for cle in CLE.findall(texte):
                    citees[cle.rstrip(".")].add(os.path.relpath(chemin, os.path.dirname(racine)))
    return citees


def est_prefixe(cle: str) -> bool:
    """`narvos::MI_NarvosPeau_` .. teinte : un début de clé, complété à l'exécution."""
    return cle.endswith("_") or len(cle) < 3


def dossier_de(chemin_pack: str) -> str:
    """`Narvos/Locomotion/Idle/X` -> `Locomotion` : le dossier qui dit de quel pack vient la clé."""
    parties = chemin_pack.split("/")
    return parties[1] if len(parties) > 2 else "(racine)"


def main() -> None:
    arguments = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not arguments:
        print(__doc__)
        sys.exit(2)
    staging = lire_manifeste(arguments[0])
    sections = collections.Counter(s for s, _ in staging.values())
    print(f"staging : {len(staging)} clé(s) — " + ", ".join(f"{s} {n}" for s, n in sections.most_common()))

    citees = cles_du_lua()
    prefixes = sorted(c for c in citees if est_prefixe(c))
    absentes = sorted(c for c in citees if c not in staging and not est_prefixe(c))
    print(f"\nLua : {len(citees)} clé(s) `narvos::` écrites (hors commentaires), dont {len(prefixes)} préfixe(s) "
          f"complétés à l'exécution {prefixes} ; {len(absentes)} ABSENTE(S) du staging")
    for cle in absentes:
        print(f"    {cle:<44} {sorted(citees[cle])[0]}"
              + (f"  (+{len(citees[cle]) - 1})" if len(citees[cle]) > 1 else ""))

    reference = sys.argv[sys.argv.index("--reference") + 1] if "--reference" in sys.argv else ACTIF
    if not os.path.isfile(reference) or os.path.abspath(reference) == os.path.abspath(arguments[0]):
        return
    ancien = lire_manifeste(reference)
    perdues = [c for c in ancien if c not in staging]
    neuves = [c for c in staging if c not in ancien]
    print(f"\nréférence {os.path.relpath(reference, RACINE)} : {len(ancien)} clé(s) ; "
          f"{len(perdues)} que le staging n'a plus, {len(neuves)} qu'il a en plus")
    par_dossier = collections.Counter(dossier_de(ancien[c][1]) for c in perdues)
    for dossier, n in par_dossier.most_common(25):
        demandees = sorted(c for c in perdues if dossier_de(ancien[c][1]) == dossier and c in citees)
        print(f"    {dossier:<36} {n:>6}" + (f"   dont {len(demandees)} demandée(s) par le Lua : "
                                              + " ".join(demandees[:6]) if demandees else ""))
    if len(par_dossier) > 25:
        print(f"    … et {len(par_dossier) - 25} autre(s) dossier(s)")


if __name__ == "__main__":
    main()
