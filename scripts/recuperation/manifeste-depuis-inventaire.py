# -*- coding: utf-8 -*-
"""
manifeste-depuis-inventaire.py — fabrique le manifeste d'import d'un dossier MANQUANT de
l'ADK à partir de ce que l'inventaire du 23/09 y attend, et non d'une règle de tri.

  python manifeste-depuis-inventaire.py <dossier de Narvos> [<dossier> ...] [--ecrire]
  python manifeste-depuis-inventaire.py --tous [--ecrire]        # tous les dossiers incomplets

POURQUOI PAS REJOUER LA COMMANDE D'ORIGINE. Le trieur (`narvos-skeleton-compat.mjs`) a
changé depuis les imports : le 02/09 il rangeait en SUR-ENSEMBLE ce qu'il range depuis le
08/09 en INTERCALE ou REPARENTE, et n'importe plus. Rejouer « la même commande » importerait
donc un AUTRE ensemble de fichiers — et un paquet en trop ou en moins décale les clés `_N`
du pack. L'inventaire, lui, dit exactement ce qui existait : un import Interchange nomme
le mesh d'après son fichier, donc

    /Game/Narvos/<chemin>/<nom>   (SkeletalMesh ou StaticMesh attendu)
        <->   <racine source>/<chemin>/<nom>.glb

On cherche ce GLB sous les racines connues, dans l'ordre : les conversions faites pour
Unreal d'abord (textures passées en PNG, animations dégraissées), puis `public/models`.

Par dossier, l'outil dit :
  · combien de meshes attendus ont leur GLB, et sous quelle racine ;
  · le MODE d'import : `NARVOS_SANS_SQUELETTE=1` si l'inventaire y montre des squelettes
    propres (classe Skeleton), sinon squelette imposé (SKEL_Mannequin) ;
  · les GLB dont les textures sont en KTX2/WebP (Interchange les refuse : à convertir avant,
    `narvos-textures-vers-png.mjs` pour un mesh, `narvos-degraisser-anim.mjs` pour une anim).

Avec --ecrire : un manifeste par (dossier, racine) sous adk/_manifests/inv-<dossier>[-n].json.
"""
import collections
import importlib.util
import json
import os
import struct
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from lots import PROJET  # noqa: E402

_spec = importlib.util.spec_from_file_location("etat_adk", os.path.join(ICI, "etat-adk.py"))
E = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(E)

ADK = os.path.join(PROJET, "WebPortal", "Server", "adk")
MODELES = os.path.join(PROJET, "WebPortal", "public", "models")
MANIFESTES = os.path.join(ADK, "_manifests")
MESHES = ("SkeletalMesh", "StaticMesh")
ILLISIBLES = ("KHR_texture_basisu", "EXT_texture_webp")


def racines_sources():
    """Les racines où chercher un GLB, dans l'ordre de préférence : (étiquette, dossier).
    Une racine est le dossier dont le chemin relatif d'un GLB reproduit le chemin du paquet
    sous /Game/Narvos."""
    # `personnages/_parts_png` : les pièces modulaires (`<famille>/<pièce>.glb`), importées le
    # 08/09 avec CETTE racine — d'où `/Game/Narvos/samurai/arms`, sans `personnages/` devant.
    racines = [("png", os.path.join(ADK, "_textures_png")),
               ("degraissees", os.path.join(ADK, "_anim_degraissees")),
               ("parts_png", os.path.join(MODELES, "personnages", "_parts_png")),
               ("export", os.path.join(ADK, "_export"))]
    if os.path.isdir(MODELES):
        for nom in sorted(os.listdir(MODELES)):
            d = os.path.join(MODELES, nom)
            if os.path.isdir(d):
                racines.append((nom, d))
        racines.append(("models", MODELES))
    return [(e, d) for e, d in racines if os.path.isdir(d)]


def extensions_requises(glb):
    """Les extensions glTF qu'un GLB déclare REQUISES (lecture du seul bloc JSON)."""
    try:
        with open(glb, "rb") as f:
            tete = f.read(20)
            if len(tete) < 20 or tete[:4] != b"glTF":
                return None
            longueur, genre = struct.unpack("<I4s", tete[12:20])
            if genre != b"JSON":
                return None
            return json.loads(f.read(longueur).decode("utf-8", errors="replace")).get("extensionsRequired", [])
    except (OSError, ValueError):
        return None


def chercher(relatif, racines):
    """(étiquette, racine, chemin du GLB) du premier GLB trouvé pour ce chemin relatif.

    Deux formes : le fichier porte le nom du mesh (`…/SK_Truc.glb` -> `SK_Truc`), ou c'est
    un GLB de SCÈNE dont Interchange tire plusieurs meshes nommés `<fichier>_<nœud>`
    (`Showcase.glb` -> `Showcase_node_680`, `Showcase_node_681`…) : on prend alors, dans le
    même dossier, le GLB dont le nom est le plus long préfixe du nom du mesh."""
    dossier, _, nom = relatif.rpartition("/")
    for etiquette, racine in racines:
        ici = os.path.join(racine, dossier.replace("/", os.sep))
        for ext in (".glb", ".gltf"):
            p = os.path.join(ici, nom + ext)
            if os.path.isfile(p):
                return etiquette, racine, p
        try:
            voisins = [f for f in os.listdir(ici) if f.lower().endswith((".glb", ".gltf"))]
        except OSError:
            continue
        prefixes = [f for f in voisins if nom.startswith(os.path.splitext(f)[0] + "_")]
        if prefixes:
            return etiquette, racine, os.path.join(ici, max(prefixes, key=len))
    return None


def plan(dossier, attendus, presents, racines):
    """Ce qu'il faut importer pour rebâtir `dossier` :
    {"mode", "trouves": {racine: [glb]}, "introuvables": [paquets], "a_convertir": [glb],
     "attendus": n, "deja": n}."""
    prefixe = E.PREFIXE + dossier + "/"
    meshes = sorted(p for p, c in attendus.items() if p.startswith(prefixe) and c in MESHES)
    squelettes = sum(1 for p, c in attendus.items() if p.startswith(prefixe) and c == "Skeleton")
    trouves, introuvables, a_convertir, deja = collections.defaultdict(list), [], [], 0
    for paquet in meshes:
        if paquet in presents:
            deja += 1
            continue
        resultat = chercher(paquet[len(E.PREFIXE):], racines)
        if not resultat:
            introuvables.append(paquet)
            continue
        _, racine, glb = resultat
        requises = extensions_requises(glb) or []
        if any(x in requises for x in ILLISIBLES):
            if glb not in a_convertir:
                a_convertir.append(glb)
            continue
        if glb not in trouves[racine]:                    # un GLB de scène sert plusieurs meshes
            trouves[racine].append(glb)
    return {"mode": "NARVOS_SANS_SQUELETTE=1" if squelettes else "squelette imposé",
            "squelettes": squelettes, "attendus": len(meshes), "deja": deja,
            "trouves": dict(trouves), "introuvables": introuvables, "a_convertir": a_convertir}


def ecrire_manifestes(dossier, p):
    os.makedirs(MANIFESTES, exist_ok=True)
    ecrits = []
    for n, (racine, glbs) in enumerate(sorted(p["trouves"].items())):
        nom = "inv-" + dossier + ("" if n == 0 else f"-{n + 1}")
        chemin = os.path.join(MANIFESTES, nom + ".json")
        with open(chemin, "w", encoding="utf-8", newline="\n") as f:
            json.dump({"reference": f"inventaire du 23/09 — dossier {dossier} ({p['mode']})",
                       "racine": racine.replace("\\", "/"), "total_analyses": len(glbs),
                       "importables": len(glbs), "ecartes_ktx2": 0,
                       "fichiers": [{"fichier": g.replace("\\", "/"), "verdict": "INVENTAIRE", "os": 0}
                                    for g in sorted(glbs)]}, f, ensure_ascii=False, indent=2)
        ecrits.append((nom, racine, len(glbs)))
    return ecrits


def main():
    attendus = E.lire_inventaire()
    presents = E.paquets_du_disque()
    tableau = E.tableau(attendus, presents)
    if "--tous" in sys.argv:
        dossiers = sorted(n for n, v in tableau.items() if v["manquants"])
    else:
        dossiers = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not dossiers:
        raise SystemExit(__doc__)
    racines = racines_sources()
    print(f"{'dossier':32} {'meshes':>6} {'déjà':>5} {'GLB':>5} {'à conv.':>7} {'sans':>5}  mode / racine(s)")
    for dossier in dossiers:
        if dossier not in tableau:
            print(f"{dossier:32} inconnu de l'inventaire")
            continue
        p = plan(dossier, attendus, presents, racines)
        n_glb = sum(len(v) for v in p["trouves"].values())
        ou = ", ".join(f"{os.path.relpath(r, PROJET)}×{len(v)}" for r, v in sorted(p["trouves"].items()))
        print(f"{dossier:32} {p['attendus']:6} {p['deja']:5} {n_glb:5} {len(p['a_convertir']):7} "
              f"{len(p['introuvables']):5}  {p['mode']} ; {ou[:110]}")
        for paquet in p["introuvables"][:3]:
            print(f"{'':34}introuvable : {paquet[-90:]}")
        for glb in p["a_convertir"][:2]:
            print(f"{'':34}à convertir : {os.path.relpath(glb, PROJET)[-90:]}")
        if "--ecrire" in sys.argv:
            for nom, racine, n in ecrire_manifestes(dossier, p):
                print(f"{'':34}écrit : _manifests/{nom}.json ({n} fichiers, racine {os.path.relpath(racine, PROJET)})")


if __name__ == "__main__":
    main()
