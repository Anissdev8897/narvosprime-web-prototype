# -*- coding: utf-8 -*-
"""
assembler-final.py — remonte le projet à son emplacement (E:\\narvosprime-web-prototype)
à partir de l'extraction FINALE (extraire-historiques.py --dmde=…) et des lots DMDE.

CE QUI VA OÙ
  1. Chaque fichier de l'extraction va à sa place. S'il est identique, aux fins de
     ligne près, au fichier sain que DMDE a rendu au même endroit, ce sont les
     OCTETS DE DMDE qu'on pose (fins de ligne et BOM d'origine).
  2. Les fichiers sains des lots DMDE que nul agent n'a jamais touchés (donc absents
     de l'extraction) sont copiés tels quels. Un fichier DMDE corrompu sans
     reconstruction n'est PAS posé : il est listé.
  3. Les gros dossiers d'assets ne sont pas copiés : une JONCTION pointe vers le lot.

CE QU'ON NE CASSE PAS
  · On n'écrit JAMAIS à travers une jonction : un fichier reconstruit destiné à
    `WebPortal\\public\\…` irait écraser le fichier d'origine dans le lot DMDE. Il part
    dans `WebPortal\\public.reconstruit\\…`.
  · Les outils nés après la perte (`scripts\\recuperation`, `node_modules`) ne sont pas
    touchés.
  · Tout fichier remplacé par un contenu DIFFÉRENT est d'abord copié dans
    `E:\\mes_projet\\_avant_reassemblage_<date>\\`.
  · Un `.json` reconstruit INCOMPLET (des marqueurs en font un JSON invalide) ne
    remplace pas un JSON valide déjà en place : il est posé à côté, en `.reconstruit`.
  · Rien n'est supprimé. Les fichiers du projet qu'aucune source ne produit plus sont
    listés (ORPHELIN) dans ASSEMBLAGE.tsv.

  python assembler-final.py [--ecrire] [--extraction=<dossier>]
"""
import datetime
import json
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sante import fichier_sain  # noqa: E402
from lots import PROJET, LOTS, RACINE, COPIES, JONCTIONS, IGNORES, MARQUES  # noqa: E402

EXTRACTION = next((a[13:] for a in sys.argv if a.startswith("--extraction=")),
                  os.path.join(LOTS, "narvos-reconstruit-final"))
BASE = os.path.join(EXTRACTION, "fichiers")
CLAUDE_MD = os.path.join(LOTS, "recup", "_claude_md")
# Un dossier PAR PASSAGE (date et heure) : deux assemblages le même jour écrivaient dans
# le même dossier, et le second y écrasait la copie « d'avant » faite par le premier.
AVANT = os.path.join(LOTS, "_avant_reassemblage_" + datetime.datetime.now().strftime("%Y-%m-%d_%Hh%M"))
FICHIERS_SERVEUR = ["Config.toml"]     # depuis racine-projet\Server
# Ce que l'assemblage ne touche pas et ne compte pas comme orphelin.
PROTEGES = (r"scripts\recuperation", "node_modules", r"WebPortal\node_modules")
REPARSE = 0x400


def norme(octets):
    return octets.replace(b"\r\n", b"\n").rstrip(b"\n")


def est_jonction(chemin):
    try:
        return bool(os.lstat(chemin).st_file_attributes & REPARSE)
    except OSError:
        return False


def protege(rel):
    bas = rel.lower()
    return any(bas == p.lower() or bas.startswith(p.lower() + os.sep) for p in PROTEGES)


def destination(rel):
    """Le chemin RÉEL où écrire `rel` : jamais à travers une jonction."""
    morceaux = rel.split(os.sep)
    for i in range(1, len(morceaux)):
        prefixe = os.path.join(PROJET, *morceaux[:i])
        if est_jonction(prefixe) or any(os.path.normcase(os.path.join(PROJET, j)) == os.path.normcase(prefixe)
                                        for _, j in JONCTIONS):
            return prefixe + ".reconstruit" + os.sep + os.path.join(*morceaux[i:])
    return os.path.join(PROJET, rel)


class Assemblage:
    def __init__(self, ecrire):
        self.ecrire = ecrire
        self.journal = []
        self.poses = set()            # chemins réels écrits (ou identiques), en minuscules
        self.n = {"extraction": 0, "octets_dmde": 0, "dmde_seul": 0, "inchanges": 0, "remplaces": 0,
                  "nouveaux": 0, "corrompu_sans_repli": 0, "json_a_cote": 0, "hors_jonction": 0, "jonctions": 0}

    def poser(self, rel, octets, origine):
        dst = destination(rel)
        if dst != os.path.join(PROJET, rel):
            self.n["hors_jonction"] += 1
            self.journal.append(f"HORS_JONCTION\t{rel}\t->\t{os.path.relpath(dst, PROJET)}")
        if rel.lower().endswith(".json") and any(m.encode("utf-8") in octets for m in MARQUES) and os.path.exists(dst):
            try:
                with open(dst, encoding="utf-8-sig") as f:
                    json.load(f)
                dst += ".reconstruit"
                self.n["json_a_cote"] += 1
                self.journal.append(f"JSON_A_COTE\t{rel}\tle fichier en place est un JSON valide, le reconstruit ne l'est pas")
            except Exception:
                pass
        self.poses.add(os.path.normcase(dst))
        if os.path.exists(dst):
            with open(dst, "rb") as f:
                ancien = f.read()
            if ancien == octets:
                self.n["inchanges"] += 1
                return
            self.n["remplaces"] += 1
            if self.ecrire:
                sauvegarde = os.path.join(AVANT, os.path.relpath(dst, PROJET))
                os.makedirs(os.path.dirname(sauvegarde), exist_ok=True)
                shutil.copy2(dst, sauvegarde)
        else:
            self.n["nouveaux"] += 1
        self.journal.append(f"{origine}\t{rel}")
        if self.ecrire:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, "wb") as f:
                f.write(octets)

    def lancer(self):
        # Où DMDE a-t-il rendu, à sa place, un fichier sain ?
        dmde = {}
        for source, rel_base in COPIES:
            if not os.path.isdir(source):
                self.journal.append(f"ABSENT\t{source}")
                continue
            for d, dirs, fichiers in os.walk(source):
                dirs[:] = [x for x in dirs if x not in IGNORES]
                for f in fichiers:
                    src = os.path.join(d, f)
                    dmde[os.path.normcase(os.path.join(rel_base, os.path.relpath(src, source)))] = (
                        os.path.join(rel_base, os.path.relpath(src, source)), src)

        for f in FICHIERS_SERVEUR:
            src = os.path.join(RACINE, "Server", f)
            if os.path.exists(src):
                rel = os.path.join("WebPortal", "Server", f)
                dmde[os.path.normcase(rel)] = (rel, src)

        # 1. L'extraction.
        dans_extraction = set()
        for d, _, fichiers in os.walk(BASE):
            for f in fichiers:
                if f.lower() == "nul":
                    continue                      # nom réservé de Windows
                src = os.path.join(d, f)
                rel = os.path.relpath(src, BASE)
                dans_extraction.add(os.path.normcase(rel))
                if protege(rel):
                    continue
                with open(src, "rb") as b:
                    octets = b.read()
                jumeau = dmde.get(os.path.normcase(rel))
                if jumeau and fichier_sain(jumeau[1]):
                    with open(jumeau[1], "rb") as b:
                        vrai = b.read()
                    if norme(vrai) == norme(octets):
                        self.n["octets_dmde"] += 1
                        self.poser(rel, vrai, "DMDE_EXACT")
                        continue
                    if any(m.encode("utf-8") in octets for m in MARQUES):
                        # Plus récente mais INCOMPLÈTE : le fichier sain reste en place, la
                        # reconstruction est posée à côté pour qui voudra la relire.
                        self.n["octets_dmde"] += 1
                        self.poser(rel, vrai, "DMDE_PREFERE")
                        self.poser(rel + ".reconstruit", octets, "EXTRACTION_A_COTE")
                        self.journal.append(f"DMDE_PREFERE\t{rel}\tl'extraction diffère mais porte des marqueurs")
                        continue
                    self.journal.append(f"EXTRACTION_PLUS_RECENTE\t{rel}\tdiffère du fichier DMDE : des "
                                        "événements postérieurs à sa date s'y appliquent")
                self.n["extraction"] += 1
                self.poser(rel, octets, "EXTRACTION")

        # 2. Les fichiers DMDE que l'extraction ne connaît pas.
        for cle, (rel, src) in sorted(dmde.items()):
            if cle in dans_extraction or protege(rel):
                continue
            if fichier_sain(src):
                with open(src, "rb") as b:
                    self.poser(rel, b.read(), "DMDE")
                self.n["dmde_seul"] += 1
            else:
                self.n["corrompu_sans_repli"] += 1
                self.journal.append(f"CORROMPU_SANS_REPLI\t{rel}")

        # 3. Les instructions injectées (jamais lues par un outil, donc hors extraction).
        for d, _, fichiers in os.walk(CLAUDE_MD):
            for f in fichiers:
                src = os.path.join(d, f)
                rel = os.path.relpath(src, CLAUDE_MD)
                if os.path.normcase(rel) in dans_extraction:
                    continue
                with open(src, "rb") as b:
                    self.poser(rel, b.read(), "CLAUDE_MD")

        # 4. Les jonctions vers les gros lots.
        for cible, rel in JONCTIONS:
            lien = os.path.join(PROJET, rel)
            if not os.path.isdir(cible):
                self.journal.append(f"JONCTION_SANS_CIBLE\t{rel}\t{cible}")
                continue
            self.n["jonctions"] += 1
            if est_jonction(lien):
                continue                          # déjà posée
            self.journal.append(f"JONCTION\t{rel}\t->\t{cible}")
            if self.ecrire:
                if os.path.lexists(lien):
                    if os.listdir(lien):
                        os.replace(lien, lien + ".reconstruit")
                    else:
                        os.rmdir(lien)
                os.makedirs(os.path.dirname(lien), exist_ok=True)
                r = subprocess.run(["cmd", "/c", "mklink", "/J", lien, cible], capture_output=True, text=True)
                if r.returncode != 0:
                    self.journal.append(f"JONCTION_ECHEC\t{rel}\t{r.stderr.strip() or r.stdout.strip()}")

        # 5. Ce que le projet contient et qu'aucune source ne produit plus.
        orphelins = 0
        for d, dirs, fichiers in os.walk(PROJET):
            dirs[:] = [x for x in dirs if x not in IGNORES and not est_jonction(os.path.join(d, x))
                       and not protege(os.path.relpath(os.path.join(d, x), PROJET))]
            for f in fichiers:
                p = os.path.join(d, f)
                if os.path.normcase(p) not in self.poses and f != "ASSEMBLAGE.tsv":
                    orphelins += 1
                    self.journal.append(f"ORPHELIN\t{os.path.relpath(p, PROJET)}")
        self.n["orphelins"] = orphelins

        # En simulation, le journal part à côté des lots : on lit ce qui SERAIT fait
        # (les orphelins surtout) avant de le faire.
        journal = os.path.join(PROJET, "ASSEMBLAGE.tsv") if self.ecrire else os.path.join(LOTS, "ASSEMBLAGE_simulation.tsv")
        if self.ecrire and os.path.exists(journal):
            # Le journal du passage précédent dit ce qu'IL avait posé : `ecarter-orphelins.py`
            # s'en sert pour reconnaître, dans les dossiers `.reconstruit`, ce qui vient
            # d'un assemblage et que plus rien ne produit.
            shutil.copy2(journal, os.path.join(LOTS, "ASSEMBLAGE_precedent.tsv"))
        with open(journal, "w", encoding="utf-8", newline="\n") as f:
            f.write("\n".join(self.journal) + "\n")
        print(self.n)
        for l in self.journal:
            if l.startswith(("ABSENT", "JONCTION", "CORROMPU", "JSON_A_COTE", "EXTRACTION_PLUS", "HORS_JONCTION",
                             "DMDE_PREFERE")):
                print(" ", l[:190])
        print("projet :", PROJET, "| sauvegardes :", AVANT if self.ecrire else "(simulation — passer --ecrire)")


if __name__ == "__main__":
    Assemblage("--ecrire" in sys.argv).lancer()
