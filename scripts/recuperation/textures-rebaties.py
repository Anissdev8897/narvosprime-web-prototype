# -*- coding: utf-8 -*-
"""
textures-rebaties.py — les paquets REBÂTIS de l'ADK ont-ils leurs textures ? Sans Unreal.

  python scripts/recuperation/textures-rebaties.py                 # tout ce qui date d'après la perte
  python scripts/recuperation/textures-rebaties.py --depuis 2026-10-04
  python scripts/recuperation/textures-rebaties.py --dossier Sewer --detail 20

Un import ou une promotion peut se déclarer complet et laisser des matériaux sans images
(textures perdues à la sauvegarde, références restées à l'ancien chemin, format refusé) :
le modèle s'affiche GRIS, et rien ne le dit. Trois mesures, par dossier de `/Game/Narvos`,
sur les seuls fichiers écrits depuis `--depuis` (ce que la récupération a rendu garde sa
date d'origine) :

  · RÉFÉRENCES MORTES : un chemin `/Game/…` cité par un matériau ou un maillage rebâti qui
    ne mène à aucun fichier, redirects de `DefaultEngine.ini` appliqués. C'est LE défaut.
  · MATÉRIAUX SANS IMAGE : ni texture citée, ni parent (une instance hérite des siennes).
    Un indice, pas un verdict : un matériau à couleur de sommet n'en a pas, exprès.
  · TEXTURES ATTENDUES ABSENTES : celles que l'inventaire du 23/09 place dans le dossier.

Ce qu'elle ne voit pas : un graphe qui ne CÂBLE pas une texture présente, un matériau qui ne
compile pas. Ça, c'est le journal du cook (« Missing input texture », « Failed to compile
Material ») et `scripts/adk-verifier-textures-tout.py` (registre d'Unreal) qui le disent.

Les chemins sont lus dans la table de noms, en clair : la mesure SURESTIME (une simple mention
compte), jamais l'inverse. Un nom fini par `_<chiffres>` y est stocké sans son numéro :
`…/Material` vaut pour `…/Material_1`, on cherche donc aussi les numérotés.
"""
import collections
import datetime
import json
import os
import re
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from lots import RACINE  # noqa: E402

ADK = os.path.join(RACINE, "Server", "adk")
CONTENT = os.path.join(ADK, "Content")
INI = os.path.join(ADK, "Config", "DefaultEngine.ini")
INVENTAIRE = os.path.join(ADK, "_assets-inventory.2026-09-23.avant-recook.json")
CHEMIN = re.compile(rb"/Game/[A-Za-z0-9_\-/\. ]{3,200}")
MATERIAUX = ("Material", "MaterialInstanceConstant")
MAILLAGES = ("SkeletalMesh", "StaticMesh")


def option(nom: str, defaut: str | None = None) -> str | None:
    return sys.argv[sys.argv.index(nom) + 1] if nom in sys.argv else defaut


def lire_redirects(ini: str = INI) -> tuple[list[tuple[str, str]], dict[str, str]]:
    """([(ancien préfixe, nouveau préfixe)], {ancien paquet exact: nouveau paquet})."""
    prefixes, exacts = [], {}
    motif = re.compile(r'\+PackageRedirects=\(OldName="([^"]+)",NewName="([^"]+)"(,MatchSubstring=true)?\)')
    with open(ini, encoding="utf-8", errors="replace") as f:
        for ligne in f:
            m = motif.match(ligne.strip())
            if not m:
                continue
            if m.group(3):
                prefixes.append((m.group(1), m.group(2)))
            else:
                exacts[m.group(1)] = m.group(2)
    return prefixes, exacts


def rediriger(paquet: str, prefixes: list[tuple[str, str]], exacts: dict[str, str]) -> str:
    if paquet in exacts:
        return exacts[paquet]
    for ancien, neuf in prefixes:
        if paquet.startswith(ancien):
            return neuf + paquet[len(ancien):]
    return paquet


class Disque:
    """Existence d'un paquet `/Game/…`, mémorisée par dossier (un listdir par dossier)."""

    def __init__(self, content: str = CONTENT) -> None:
        self.content = content
        self.dossiers: dict[str, set[str] | None] = {}

    def noms(self, dossier_jeu: str) -> set[str] | None:
        if dossier_jeu not in self.dossiers:
            d = os.path.join(self.content, dossier_jeu[len("/Game/"):].replace("/", os.sep))
            try:
                self.dossiers[dossier_jeu] = {os.path.splitext(n)[0].lower() for n in os.listdir(d)
                                              if n.lower().endswith((".uasset", ".umap"))}
            except OSError:
                self.dossiers[dossier_jeu] = None
        return self.dossiers[dossier_jeu]

    def existe(self, paquet: str) -> bool:
        dossier, _, nom = paquet.rpartition("/")
        noms = self.noms(dossier)
        if noms is None:
            return False
        nom = nom.lower()
        if nom in noms:
            return True
        # FName numéroté : `Material` dans la table pour `Material_1` sur le disque.
        prefixe = nom + "_"
        return any(n.startswith(prefixe) and n[len(prefixe):].isdigit() for n in noms)

    def est_dossier(self, chemin_jeu: str) -> bool:
        return os.path.isdir(os.path.join(self.content, chemin_jeu[len("/Game/"):].replace("/", os.sep)))


def classe_de(octets: bytes, connue: str | None) -> str | None:
    """La classe d'un paquet : celle de l'inventaire si elle y est, sinon lue aux noms de
    classes que porte sa table de noms (un paquet neuf n'est dans aucun inventaire)."""
    if connue:
        return connue
    if b"MaterialInstanceConstant" in octets:
        return "MaterialInstanceConstant"
    if b"SkeletalMesh" in octets and b"SkeletalMeshLODSettings" not in octets[:4000]:
        return "SkeletalMesh" if b"PhysicsAsset" in octets or b"Skeleton" in octets else None
    if b"StaticMesh" in octets and b"BodySetup" in octets:
        return "StaticMesh"
    if b"Texture2D" in octets and b"MaterialExpression" not in octets and b"Material" not in octets[:6000]:
        return "Texture2D"
    if b"MaterialExpression" in octets or b"MaterialEditorOnlyData" in octets:
        return "Material"
    return None


def main() -> None:
    depuis = datetime.datetime.strptime(option("--depuis", "2026-10-03"), "%Y-%m-%d").timestamp()
    seul = option("--dossier")
    detail = int(option("--detail", "6"))
    prefixes, exacts = lire_redirects()
    disque = Disque()
    with open(INVENTAIRE, encoding="utf-8-sig") as f:
        inventaire = {e["paquet"]: e["classe"] for e in json.load(f)["assets"]}
    textures_attendues = collections.Counter()
    textures_absentes = collections.defaultdict(list)
    for paquet, classe in inventaire.items():
        if classe.startswith("Texture") and paquet.startswith("/Game/Narvos/"):
            dossier = paquet.split("/")[3]
            textures_attendues[dossier] += 1
            if not disque.existe(paquet):
                textures_absentes[dossier].append(paquet)

    bilan = collections.defaultdict(lambda: collections.Counter())
    exemples = collections.defaultdict(lambda: collections.defaultdict(list))
    racine = os.path.join(CONTENT, "Narvos")
    for d, _, fichiers in os.walk(racine):
        relatif = os.path.relpath(d, racine)
        dossier = relatif.split(os.sep)[0]
        if dossier == "." or (seul and dossier != seul):
            continue
        for f in fichiers:
            if not f.lower().endswith(".uasset"):
                continue
            chemin = os.path.join(d, f)
            if os.path.getmtime(chemin) < depuis:
                continue
            paquet = "/Game/Narvos/" + os.path.relpath(chemin, racine)[:-7].replace(os.sep, "/")
            with open(chemin, "rb") as h:
                octets = h.read(3_000_000)
            classe = classe_de(octets, inventaire.get(paquet))
            bilan[dossier]["paquets rebâtis"] += 1
            if classe not in MATERIAUX + MAILLAGES:
                continue
            cites = {m.decode("ascii", "replace").rstrip("/. ").split(".")[0] for m in CHEMIN.findall(octets)}
            cites.discard(paquet)
            textures = parents = 0
            for cite in sorted(cites):
                cible = rediriger(cite, prefixes, exacts)
                if disque.existe(cible):
                    c = inventaire.get(cible) or ""
                    nom = cible.rsplit("/", 1)[1]
                    if c.startswith("Texture") or (not c and (nom.startswith("T_") or "BaseColor" in nom
                                                             or "Normal" in nom or "Roughness" in nom)):
                        textures += 1
                    elif c in MATERIAUX or nom.startswith(("M_", "MI_", "Mat")):
                        parents += 1
                elif not disque.est_dossier(cible):
                    bilan[dossier]["RÉFÉRENCES MORTES"] += 1
                    if len(exemples[dossier]["mortes"]) < detail:
                        exemples[dossier]["mortes"].append(f"{paquet[len('/Game/Narvos/'):]}  ->  {cite}")
            if classe in MATERIAUX:
                bilan[dossier]["matériaux"] += 1
                if textures:
                    bilan[dossier]["matériaux avec image"] += 1
                elif classe == "MaterialInstanceConstant" and parents:
                    bilan[dossier]["instances héritant du parent"] += 1
                else:
                    bilan[dossier]["MATÉRIAUX SANS IMAGE"] += 1
                    if len(exemples[dossier]["sans"]) < detail:
                        exemples[dossier]["sans"].append(paquet[len("/Game/Narvos/"):])
            else:
                bilan[dossier]["maillages"] += 1

    print(f"{'dossier':30} {'rebâtis':>8} {'matér.':>7} {'image':>6} {'hérit.':>6} {'SANS':>5} {'maill.':>7} "
          f"{'MORTES':>7} {'tex. attendues':>14} {'ABSENTES':>8}")
    totaux = collections.Counter()
    for dossier in sorted(bilan, key=str.lower):
        b = bilan[dossier]
        absentes = len(textures_absentes.get(dossier, []))
        print(f"{dossier:30} {b['paquets rebâtis']:8} {b['matériaux']:7} {b['matériaux avec image']:6} "
              f"{b['instances héritant du parent']:6} {b['MATÉRIAUX SANS IMAGE']:5} {b['maillages']:7} "
              f"{b['RÉFÉRENCES MORTES']:7} {textures_attendues.get(dossier, 0):14} {absentes:8}")
        totaux.update(b)
        totaux["absentes"] += absentes
        for e in exemples[dossier]["mortes"]:
            print(f"{'':6}morte : {e[:170]}")
        for e in exemples[dossier]["sans"]:
            print(f"{'':6}sans image : {e[:150]}")
        for p in textures_absentes.get(dossier, [])[:detail]:
            print(f"{'':6}texture attendue absente : {p[len('/Game/Narvos/'):][:150]}")
    print(f"\ntotal : {totaux['paquets rebâtis']} paquets rebâtis ; {totaux['matériaux']} matériaux dont "
          f"{totaux['MATÉRIAUX SANS IMAGE']} sans image ; {totaux['RÉFÉRENCES MORTES']} référence(s) morte(s) ; "
          f"{totaux['absentes']} texture(s) attendue(s) absente(s) dans ces dossiers")


if __name__ == "__main__":
    main()
