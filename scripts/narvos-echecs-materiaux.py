# ══════════════════════════════════════════════════════════════════════════════
# narvos-echecs-materiaux.py — « Failed to compile Material » d'un journal Unreal,
# separes en DANS / HORS de la fermeture d'un niveau.
#
#   python scripts/narvos-echecs-materiaux.py <journal.log> <manifeste.json> [--code]
#
# Le manifeste est celui de narvos-refs-perdues-promotion.mjs (cle fermeture_paquets).
#
# ── POURQUOI ──────────────────────────────────────────────────────────────────
# Premiere verification du 2026-09-13 : « 14 echecs sous OpenWorlds » affiche sous
# le titre « la foret compile encore mal ». Les 14 etaient M_Generic et 13 maisons,
# qu'aucun paquet de la foret ne cite. Un compteur juste sous une etiquette fausse
# (feedback_compteur_juste_etiquette_fausse) : on compte ce que le niveau CHARGE.
#
# --code : sortie 1 s'il y a un echec DANS la fermeture.
# ══════════════════════════════════════════════════════════════════════════════
import json
import re
import sys

ANTISLASH = chr(92)


def main():
    journal, manifeste = sys.argv[1], sys.argv[2]
    fermeture = set(json.load(open(manifeste, encoding="utf-8")).get("fermeture_paquets") or [])
    if not fermeture:
        print("fermeture absente du manifeste : rien a trancher")
        return 2
    dans, hors = [], []
    for ligne in open(journal, encoding="utf-8", errors="replace"):
        if "Failed to compile Material" not in ligne:
            continue
        m = re.search(r"Content[" + re.escape(ANTISLASH) + r"/](.+?)\.uasset", ligne)
        if not m:
            continue
        paquet = "/Game/" + m.group(1).replace(ANTISLASH, "/")
        (dans if paquet in fermeture else hors).append(paquet)
    dans, hors = sorted(set(dans)), sorted(set(hors))
    print("echecs DANS la fermeture du niveau : %d" % len(dans))
    for p in dans:
        print("    " + p)
    print("echecs HORS fermeture (non charges par le niveau) : %d%s" % (
        len(hors), (" ex. " + ", ".join(p.rsplit("/", 1)[-1] for p in hors[:4])) if hors else ""))
    return 1 if ("--code" in sys.argv and dans) else 0


if __name__ == "__main__":
    sys.exit(main())