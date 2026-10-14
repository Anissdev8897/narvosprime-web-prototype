# -*- coding: utf-8 -*-
"""
cook-materiaux.py — dans un journal de cook, quels matériaux n'ont PAS compilé, et pourquoi.
Lecture seule.

  python scripts/recuperation/cook-materiaux.py [journal] [--detail N] [--contre <autre journal>]

Sans argument : le journal courant de l'ADK (`Saved/Logs/NanosWorldADK.log`).

« Failed to compile Material … Default Material will be used in game » n'est qu'un
avertissement, et le cook finit à « Packages Remain 0 » : mais en jeu l'objet est GRIS. Le
journal donne la cause dans les lignes indentées qui SUIVENT l'échec. Trois mesures :
  · les matériaux en échec (uniques — le journal répète chaque échec par plateforme) par dossier ;
  · les causes, ramenées à leur forme (texture nulle, fonction absente, nœud inconnu…) ;
  · avec `--contre` : ce qui a disparu et ce qui est apparu par rapport à un autre cook.

Un échec n'est pas forcément VU : beaucoup sont les matériaux de maillages porteurs d'imports
d'animations, jamais spawnés. Pour trancher ce qu'un niveau charge vraiment :
`scripts/narvos-echecs-materiaux.py <journal> <manifeste>` (dans / hors de sa fermeture).
"""
import collections
import io
import os
import re
import sys

ADK = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                                   "WebPortal", "Server", "adk"))
COURANT = os.path.join(ADK, "Saved", "Logs", "NanosWorldADK.log")
ECHEC = "Failed to compile Material"
# `[AssetLog] E:\…\Content\Narvos\<dossier>\…\<Asset>.uasset: <message>`
ASSET = re.compile(r"\[AssetLog\] (?P<chemin>[A-Za-z]:[^:]*?[\\/]Content[\\/](?P<jeu>[^:]*?))\.uasset: (?P<message>.*)")


def lire(journal: str) -> tuple[dict[str, list[str]], int]:
    """{paquet en échec: [causes]} et nombre de lignes d'échec.

    La cause suit la ligne d'échec, en lignes INDENTÉES (« \\t(Node TextureObject) Texture
    Object> Requires valid texture ») ; une instance dit en plus son maître (« with Base X »)."""
    echecs: dict[str, list[str]] = {}
    lignes = 0
    courant = None
    with io.open(journal, encoding="utf-8", errors="replace") as f:
        for ligne in f:
            if courant is not None and ligne[:1] in ("\t", " ") and ligne.strip():
                cause = ligne.strip()
                if cause not in echecs[courant]:
                    echecs[courant].append(cause)
                continue
            courant = None
            if ECHEC not in ligne:
                continue
            m = ASSET.search(ligne)
            if not m:
                continue
            lignes += 1
            courant = m.group("jeu").replace("\\", "/")
            causes = echecs.setdefault(courant, [])
            maitre = re.search(r"with Base (\S+)", m.group("message"))
            if maitre and ("instance de " + maitre.group(1)) not in causes:
                causes.append("instance de " + maitre.group(1))
    return echecs, lignes


def forme(message: str) -> str:
    """Le message sans ce qui ne dit que l'asset : chemins, noms longs, nombres."""
    m = re.sub(r"/(Game|Engine|Script)/[A-Za-z0-9_/\.\-]+", "<chemin>", message)
    m = re.sub(r"'[^']{3,}'", "'<nom>'", m)
    m = re.sub(r"\b\d+\b", "N", m)
    return m[:110]


def dossier(paquet: str) -> str:
    parties = paquet.split("/")
    return parties[1] if parties[0] == "Narvos" and len(parties) > 1 else parties[0]


def option(nom: str, defaut: str | None = None) -> str | None:
    return sys.argv[sys.argv.index(nom) + 1] if nom in sys.argv and sys.argv.index(nom) + 1 < len(sys.argv) else defaut


def main() -> None:
    libres = [a for i, a in enumerate(sys.argv[1:], 1)
              if not a.startswith("--") and sys.argv[i - 1] not in ("--detail", "--contre")]
    journal = libres[0] if libres else COURANT
    detail = int(option("--detail", "3"))
    echecs, lignes = lire(journal)
    print(f"{os.path.basename(journal)} : {len(echecs)} matériau(x) en échec ({lignes} ligne(s))")

    par_dossier = collections.defaultdict(list)
    for paquet in echecs:
        par_dossier[dossier(paquet)].append(paquet)
    for nom, paquets in sorted(par_dossier.items(), key=lambda kv: -len(kv[1])):
        print(f"    {nom:<36} {len(paquets):>4}")
        for paquet in sorted(paquets)[:detail]:
            cause = " | ".join(echecs[paquet][:2]) if echecs[paquet] else "(cause non écrite)"
            print(f"        {paquet[-78:]:<78}  {cause[:120]}")

    causes = collections.Counter()
    for messages in echecs.values():
        for f_ in {forme(m) for m in messages} or {"(cause non écrite)"}:
            causes[f_] += 1
    print("\ncauses (matériaux concernés) :")
    for cause, n in causes.most_common(14):
        print(f"    {n:>4}  {cause}")

    contre = option("--contre")
    if contre:
        avant, _ = lire(contre)
        disparus = sorted(set(avant) - set(echecs))
        apparus = sorted(set(echecs) - set(avant))
        print(f"\ncontre {os.path.basename(contre)} ({len(avant)} en échec) : {len(disparus)} réparé(s), {len(apparus)} apparu(s)")
        for titre, liste in (("réparés", disparus), ("APPARUS", apparus)):
            compte = collections.Counter(dossier(p) for p in liste)
            if compte:
                print(f"    {titre} : " + ", ".join(f"{d} {n}" for d, n in compte.most_common(12)))
        for paquet in apparus[:detail * 4]:
            print(f"        apparu : {paquet}")


if __name__ == "__main__":
    main()
