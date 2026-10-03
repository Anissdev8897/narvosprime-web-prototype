# -*- coding: utf-8 -*-
"""
cache-client-nanos.py [--ecrire] — sort du cache du CLIENT nanos la copie qu'il gardait
des packages du projet, et la pose comme un LOT de plus sous E:\\mes_projet.

CE QUE C'EST (trouvé le 02/10/2026). Quand le client se connecte à un serveur, il
télécharge les fichiers `Client/` et `Shared/` de chaque package et les garde dans

    C:\\Users\\aniss\\AppData\\Local\\NanosWorld\\Saved\\Packages\\<package>\\…

C: n'a jamais été formaté. On y trouve donc, pour `narvos` et `narvos-map-proto` :
tout `Shared/` (catalogues GÉNÉRÉS compris, logique, `Index.lua`), tout `Client/`
(Lua, pages WebUI, images) et les `Package.toml`. Pas `Server/` : le serveur ne
l'envoie jamais.

LES .lua SONT BROUILLÉS, PAS PERDUS. Chaque octet est combiné (OU exclusif) avec le
chemin du fichier dans le cache, en minuscules, barres obliques, répété :
`narvos-map-proto/client/ciel.lua`. Un fichier qui commence par `-- ` sous le package
`narvos…` commence donc par « CLR » — ce n'est pas un en-tête. Les autres fichiers
(js, css, html, json, toml, images) sont en clair. 143 .lua sur 143 se déchiffrent en
UTF-8 strict ; le test est refait à chaque passage, et un fichier qui ne passe pas
n'est PAS posé.

DE QUAND DATE CETTE COPIE. À chaque connexion le client ne télécharge que ce qui a
changé (journal : « Downloading 2 Package file(s) » le 26/09 à 13:48:01) ; le reste est
donc identique à ce que tient le serveur. La dernière connexion est du 26/09 à 20:35
(heure locale), sur un serveur lancé à 14:52:54 : elle n'a rien téléchargé. Le dernier
événement connu des historiques est à 13:52:37. Le cache est donc l'état de ces
fichiers APRÈS tout ce que nous savons d'eux — le dernier, à dix minutes du formatage.

  preuves : …\\NanosWorld\\Saved\\Logs\\NanosWorldCore_2026.09.26_13.52.42.log (client)
            D:\\steam\\…\\nanos-world-playtest\\Server\\.logs\\NanosWorldCore_2026.09.26_20.40.10.log
            …\\Saved\\Packages\\.cache\\*.cache réécrits le 26/09 à 20:36

Chaque fichier du lot porte donc pour date INSTANT (le lancement du serveur) : rejoué
par `extraire-historiques.py --dmde=…`, il est la dernière écriture du fichier. La date
où le client l'a REÇU (au plus tard celle où cette version est née) est gardée dans
MANIFESTE.tsv.

Le cache n'est JAMAIS modifié : on lit, on déchiffre, on écrit ailleurs.

  python cache-client-nanos.py            simulation : compte, vérifie, n'écrit rien
  python cache-client-nanos.py --ecrire   pose le lot
"""
import datetime
import hashlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sante import texte_sain  # noqa: E402
from lots import CACHE_CLIENT  # noqa: E402

CACHE = r"C:\Users\aniss\AppData\Local\NanosWorld\Saved\Packages"
PACKAGES = ("narvos", "narvos-map-proto")
# Le serveur qui a servi la dernière connexion a lu ses packages à son lancement.
INSTANT = datetime.datetime(2026, 9, 26, 12, 52, 54, tzinfo=datetime.timezone.utc)


def cle(rel):
    """La clé d'un fichier : son chemin dans le cache, minuscules et barres obliques."""
    return rel.replace("\\", "/").lower().encode("utf-8")


def combiner(octets, rel):
    """Le OU exclusif avec la clé répétée. La même opération brouille et rétablit."""
    k = cle(rel)
    return bytes(b ^ k[i % len(k)] for i, b in enumerate(octets))


def contenu_clair(octets, rel):
    """Le contenu d'un fichier du cache tel qu'il était sur le serveur, ou None si un
    .lua ne se déchiffre pas en texte sain (on ne pose pas ce qu'on ne sait pas lire)."""
    if not rel.lower().endswith(".lua"):
        return octets
    clair = combiner(octets, rel)
    try:
        clair.decode("utf-8")
    except UnicodeDecodeError:
        return None
    return clair if texte_sain(clair) else None


def main():
    ecrire = "--ecrire" in sys.argv
    if not os.path.isdir(CACHE):
        sys.exit(f"cache introuvable : {CACHE}")
    manifeste, refuses, n = [], [], {"lua": 0, "texte": 0, "images": 0, "octets": 0}
    for package in PACKAGES:
        for dossier, _, noms in os.walk(os.path.join(CACHE, package)):
            for nom in sorted(noms):
                source = os.path.join(dossier, nom)
                rel = os.path.relpath(source, CACHE)
                with open(source, "rb") as f:
                    brut = f.read()
                clair = contenu_clair(brut, rel)
                if clair is None:
                    refuses.append(rel)
                    continue
                ext = os.path.splitext(nom)[1].lower()
                n["lua" if ext == ".lua" else "images" if ext in (".png", ".webp", ".jpg", ".jpeg") else "texte"] += 1
                n["octets"] += len(clair)
                recu = datetime.datetime.fromtimestamp(os.path.getmtime(source), datetime.timezone.utc)
                manifeste.append((rel, len(clair), recu.strftime("%Y-%m-%dT%H:%M:%SZ"), hashlib.sha256(clair).hexdigest()))
                if ecrire:
                    cible = os.path.join(CACHE_CLIENT, rel)
                    os.makedirs(os.path.dirname(cible), exist_ok=True)
                    with open(cible, "wb") as f:
                        f.write(clair)
                    os.utime(cible, (INSTANT.timestamp(), INSTANT.timestamp()))
    if ecrire:
        racine = os.path.dirname(CACHE_CLIENT)
        with open(os.path.join(racine, "MANIFESTE.tsv"), "w", encoding="utf-8", newline="\n") as f:
            f.write("chemin\toctets\trecu_par_le_client\tsha256\n")
            for ligne in manifeste:
                f.write("\t".join(str(x) for x in ligne) + "\n")
        with open(os.path.join(racine, "LISEZMOI.md"), "w", encoding="utf-8", newline="\n") as f:
            f.write("# Cache du client nanos, déchiffré\n\n"
                    f"Source : `{CACHE}` (jamais modifié).\n"
                    "Produit par `scripts/recuperation/cache-client-nanos.py --ecrire` — son en-tête dit ce que\n"
                    "c'est, comment les .lua sont brouillés et pourquoi cette copie est l'état FINAL de\n"
                    "`narvos/Shared` et `narvos-map-proto/Client`.\n\n"
                    f"Chaque fichier est daté du {INSTANT:%Y-%m-%d %H:%M:%S} UTC (lancement du dernier serveur) ;\n"
                    "la date où le client l'avait reçu est dans `MANIFESTE.tsv`.\n")
    print(f"{len(manifeste)} fichier(s) : {n['lua']} .lua déchiffrés, {n['texte']} textes en clair, {n['images']} images "
          f"— {n['octets'] / 1e6:.1f} Mo")
    for rel in refuses:
        print("  REFUSÉ (ne se déchiffre pas en texte sain) :", rel)
    print("lot :", os.path.dirname(CACHE_CLIENT) if ecrire else "(simulation — passer --ecrire)")
    return 1 if refuses else 0


if __name__ == "__main__":
    sys.exit(main())
