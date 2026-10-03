# -*- coding: utf-8 -*-
"""
verifier-journaux.py [--extraction <dossier>] [--tout] — confronte les fichiers Lua
reconstruits aux JOURNAUX de nanos, qui n'étaient pas sur le disque perdu :

    D:\\steam\\steamapps\\common\\nanos-world-playtest\\Server\\.logs\\      (serveur)
    C:\\Users\\aniss\\AppData\\Local\\NanosWorld\\Saved\\Logs\\              (client)

Chaque avertissement et chaque erreur Lua y laisse sa pile d'appels :

    2026-09-26 13:45:56  S_WARN  [narvos-map-proto] Portail '…' non pose : …
        - [1] [narvos-map-proto/Server/Voyage.lua]:282: in field 'PoserPortails'
        - [2] [narvos-map-proto/Server/Voyage.lua]:328: in field 'DeclarerCharge'
        - [3] [narvos-map-proto/Server/Index.lua]:4116: in upvalue 'callback'

C'est une PREUVE DATÉE sur les numéros de ligne : à cet instant, la ligne 328 de
`Voyage.lua` APPELAIT `PoserPortails`, et la ligne 4116 d'`Index.lua` appelait
`DeclarerCharge`. Pour `Server\\`, que le client ne reçoit jamais et qui ne vient que
des historiques, c'est la seule vérité indépendante qu'on ait.

Deux contrôles par cadre de pile :
  · un cadre APPELANT ([2], [3]…) : sa ligne doit nommer la fonction du cadre d'avant ;
  · le cadre d'ORIGINE ([1]) : sa ligne doit être dans la fonction que dit le journal.

Verdicts :
    juste      le fichier reconstruit dit la même chose que le journal
    périmé     le fichier a été modifié APRÈS ce journal : la preuve ne vaut plus
    FAUX       le journal est postérieur à notre dernier événement, et la ligne dit
               autre chose — le fichier reconstruit n'est pas celui qui tournait

Second contrôle, sur les MESSAGES : voir `messages`.

  python verifier-journaux.py                       piles récentes + messages du dernier jour de jeu
  python verifier-journaux.py --tout                toutes les piles, périmées comprises
  python verifier-journaux.py --depuis 2026-09-20   messages des journaux à partir de cette date
"""
import csv
import datetime
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lots import PROJET, LOTS  # noqa: E402

JOURNAUX = [r"D:\steam\steamapps\common\nanos-world-playtest\Server\.logs\NanosWorldCore*.log",
            r"C:\Users\aniss\AppData\Local\NanosWorld\Saved\Logs\NanosWorldCore*.log"]
PAQUETS = os.path.join("WebPortal", "Server", "nanos_world", "packages")
HORODATE = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s")
CADRE = re.compile(r"-\s*\[(\d+)\]\s*\[((?:narvos|narvos-map-proto)/[^\]]+\.lua)\]:(\d+): in (\w+(?: \w+)?) '([^']+)'")
DEBUT = re.compile(r"^\s*(?:local\s+)?function\s+([\w.:]+)\s*\(|^\s*(?:local\s+)?([\w.]+)\s*=\s*function\s*\(")
DECALAGE_LOCAL = datetime.timedelta(hours=2)          # les journaux sont en heure locale (été)


def court(nom):
    return re.split(r"[.:]", nom)[-1]


def piles():
    """[(instant UTC, [(rang, fichier, ligne, genre, nom)])] : une entrée par pile."""
    out = []
    for motif in JOURNAUX:
        for journal in sorted(glob.glob(motif)):
            quand, courante = None, None
            with open(journal, encoding="utf-8", errors="replace") as f:
                for l in f:
                    m = HORODATE.match(l)
                    if m:
                        quand = datetime.datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S") - DECALAGE_LOCAL
                        courante = None
                        continue
                    m = CADRE.search(l)
                    if not m or quand is None:
                        continue
                    cadre = (int(m.group(1)), m.group(2), int(m.group(3)), m.group(4), m.group(5))
                    if courante is None or cadre[0] == 1:
                        courante = []
                        out.append((quand, courante))
                    courante.append(cadre)
    return out


def fonction_a(lignes, n):
    """La fonction NOMMÉE la plus proche au-dessus de la ligne n."""
    for i in range(min(n, len(lignes)) - 1, -1, -1):
        m = DEBUT.match(lignes[i])
        if m:
            return m.group(1) or m.group(2)
    return None


def main():
    extraction = (sys.argv[sys.argv.index("--extraction") + 1] if "--extraction" in sys.argv
                  else os.path.join(LOTS, "narvos-reconstruit-final"))
    tout = "--tout" in sys.argv
    # Les messages se contrôlent sur les journaux du DERNIER jour de jeu : le code qui
    # tournait alors est celui qu'on cherche à retrouver.
    depuis = sys.argv[sys.argv.index("--depuis") + 1] if "--depuis" in sys.argv else "2026-09-26"
    dernier = {}
    with open(os.path.join(extraction, "MANIFESTE.tsv"), encoding="utf-8") as f:
        for r in csv.DictReader(f, delimiter="\t"):
            dernier[r["chemin"].lower()] = r["dernier_instant"]
    textes = {}

    def lignes_de(fichier):
        if fichier not in textes:
            chemin = os.path.join(PROJET, PAQUETS, fichier.replace("/", os.sep))
            textes[fichier] = (open(chemin, encoding="utf-8", errors="replace").read().split("\n")
                               if os.path.exists(chemin) else None)
        return textes[fichier]

    constats = {}                    # (fichier, ligne, attendu, role) -> (verdict, instant le plus récent, texte)
    for quand, cadres in piles():
        for k, (rang, fichier, n, genre, nom) in enumerate(cadres):
            lignes = lignes_de(fichier)
            if lignes is None:
                continue
            rel = os.path.join(PAQUETS, fichier.replace("/", os.sep)).lower()
            instant = dernier.get(rel, "")
            connu = datetime.datetime.strptime(instant, "%Y-%m-%dT%H:%M:%SZ") if instant else datetime.datetime.min
            texte = lignes[n - 1] if 0 < n <= len(lignes) else ""
            if k == 0:
                role, attendu = "origine", court(nom)
                dans = fonction_a(lignes, n)
                # Une fonction anonyme (`callback`, `?`) n'a pas de nom à retrouver.
                bon = None if genre in ("upvalue", "local") and attendu in ("callback", "fn", "f") else (
                    dans is not None and court(dans) == attendu)
            else:
                role, attendu = "appel", court(cadres[k - 1][4])
                bon = None if cadres[k - 1][3] not in ("field", "function", "method", "upvalue", "local") else (
                    attendu in texte)
            if bon is None:
                continue
            verdict = "juste" if bon else ("FAUX" if quand >= connu else "périmé")
            cle = (fichier, n, attendu, role)
            if cle not in constats or quand > constats[cle][1]:
                constats[cle] = (verdict, quand, texte.strip()[:80], instant)
    bilan = {"juste": 0, "périmé": 0, "FAUX": 0}
    for (fichier, n, attendu, role), (verdict, quand, texte, instant) in sorted(constats.items()):
        bilan[verdict] += 1
        if verdict == "FAUX" or tout or (verdict == "juste" and quand.strftime("%Y-%m-%dT%H:%M:%SZ") >= instant):
            print(f"  {verdict:7} {fichier}:{n} — {role} de `{attendu}` ({quand:%m-%d %H:%M}Z ; dernier événement {instant[5:16]})"
                  f"\n{'':10}{texte}")
    print(f"\npiles : {len(constats)} constat(s) — " + " · ".join(f"{v} {k}" for k, v in bilan.items()))
    absents = messages(depuis)
    return 1 if bilan["FAUX"] or absents else 0


# ── Les messages : chaque ligne du journal vient d'une chaîne du code ────────
LIGNE = re.compile(r"^(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}:\d{2}\s+(?:SCRIPT|S_WARN|S_ERROR)\s+\[(narvos[^\]]*)\]\s?(.*)$")
CHAINE = re.compile(r'"((?:[^"\\\n]|\\.)*)"|\'((?:[^\'\\\n]|\\.)*)\'')
FORMAT = re.compile(r"%[-+ #0]*\d*(?:\.\d+)?[sdifgqxXcu]")
SEUIL = 8                    # caractères littéraux qu'une chaîne du code doit couvrir dans le message


def messages(depuis):
    """Second contrôle : un message écrit au journal (`[TP] 0 point(s) de teleportation
    poses`) vient d'un gabarit du code (`"[TP] %d point(s) de teleportation poses"`) ou
    d'un morceau de concaténation. Un message d'un journal récent qu'AUCUNE chaîne des
    fichiers reconstruits ne couvre dit qu'un fichier n'est pas celui qui tournait.
    Rend le nombre de messages introuvables."""
    gabarits = {}
    for d, _, noms in os.walk(os.path.join(PROJET, PAQUETS)):
        if not re.search(r"[\\/]packages[\\/](narvos|narvos-map-proto)([\\/]|$)", d):
            continue
        for n in noms:
            if n.endswith(".lua"):
                with open(os.path.join(d, n), encoding="utf-8", errors="replace") as f:
                    for m in CHAINE.finditer(f.read()):
                        t = m.group(1) if m.group(1) is not None else m.group(2)
                        if len(t) >= 4:
                            gabarits.setdefault(t.replace('\\"', '"').replace("\\'", "'").replace("\\n", "\n"), n)
    compiles = []
    for t, fichier in gabarits.items():
        morceaux = [x.replace("%%", "%") for x in FORMAT.split(t)]
        litteraux = sum(len(x) for x in morceaux)
        if litteraux >= 4:
            compiles.append((litteraux, max(morceaux, key=len),
                             re.compile(".*?".join(re.escape(x) for x in morceaux), re.S), fichier))
    compiles.sort(key=lambda x: -x[0])
    vus = {}
    for motif in JOURNAUX:
        for journal in sorted(glob.glob(motif)):
            with open(journal, encoding="utf-8", errors="replace") as f:
                for l in f:
                    m = LIGNE.match(l.rstrip("\n"))
                    if m and m.group(1) >= depuis and len(m.group(3).strip()) >= SEUIL + 4:
                        vus.setdefault(m.group(3), m.group(1))
    absents, par_fichier = [], {}
    for texte, jour in sorted(vus.items()):
        for litteraux, plus_long, regle, fichier in compiles:
            if plus_long in texte and regle.search(texte):
                if litteraux >= SEUIL:
                    par_fichier[fichier] = par_fichier.get(fichier, 0) + 1
                else:
                    absents.append((jour, texte))
                break
        else:
            absents.append((jour, texte))
    for jour, texte in absents:
        print(f"  INTROUVABLE ({jour}) {texte[:150]}")
    print(f"messages depuis le {depuis} : {len(vus)} distincts, {len(vus) - len(absents)} retrouvés dans le code, "
          f"{len(absents)} introuvable(s)")
    print("  par fichier : " + ", ".join(f"{k} {v}" for k, v in sorted(par_fichier.items(), key=lambda x: -x[1])[:24]))
    return len(absents)


if __name__ == "__main__":
    sys.exit(main())
