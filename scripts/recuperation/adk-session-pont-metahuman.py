"""
adk-session-pont-metahuman.py — rebatit la partie PYTHON de `/Game/Narvos/PontMetaHuman` (perdu
le 26/09) : rigs, retargeters, Anim Blueprints de retarget, les 14 Blueprints porteurs.
UNE session d'editeur complet.

    bash scripts/recuperation/adk-session.sh recuperation/adk-session-pont-metahuman.py

-- CE QU'ELLE REFAIT (scripts/adk-pont-metahuman.py, tel quel) ---------------------------------
  etape_rigs()     IK_NanosMannequin, IK_NarvosMetaHuman, RTG_NanosVersMetaHuman
  etape_abp()      ABP_NanosVersMetaHuman (duplicata de l'ABP de retarget du pack + notre retargeter)
  etape_porteur()  les 14 BP_NarvosMH_<piece> — tout est dans les defauts du composant, aucun graphe
  etape_corps()    IK_NarvosMetaHumanCorps, RTG_NanosVersMetaHumanCorps, ABP_NanosVersMetaHumanCorps

-- CE QU'ELLE NE REFAIT PAS, EXPRES ------------------------------------------------------------
`etape_voie_a()` (BP_NarvosMH_M / BP_NarvosMH_F) et les quatre ABP de visage et de sculpture.
Les duplicatas M/F gardent le visage du pack, `Face_AnimBP`, dont le noeud LiveLink n'existe
pas dans le client nanos : cuits tels quels ils le font PLANTER (crash du 13/09 14:14). Le
visage sans LiveLink, les fonctions `Narvos*` et les adaptateurs de sculpture sont des
chirurgies de GRAPHE : elles passaient par le plugin UnrealMCPServer, dont il ne reste sur le
disque que les noms (contenu recouvert — sonde du 04/10). Ne pas lancer `etape_voie_a` sans elles.

Temoin de fidelite : `WebPortal/Server/adk/_pont-metahuman.log` (sorties des 11 et 13/09) —
20 chaines sur 28 reliees en EXACT, 6 operations par retargeter, 2 noeuds de retarget par ABP,
14 porteurs « Actor, SkeletalMeshComponent* ».
"""
import runpy
import traceback

import unreal

PONT = "E:/narvosprime-web-prototype/scripts/adk-pont-metahuman.py"
ETAPES = ("etape_rigs", "etape_abp", "etape_porteur", "etape_corps")


def journal(message):
    unreal.log("[NARVOS] " + message)
    print("[NARVOS] " + message)


try:
    unreal.AssetRegistryHelpers.get_asset_registry().wait_for_completion()
    # run_name different de __main__ : le module ne definit que des fonctions.
    pont = runpy.run_path(PONT, run_name="narvos_pont_metahuman")
    globaux = pont["etape_rigs"].__globals__
    dire_origine = globaux["dire"]

    def dire(texte):
        """Le journal du pont (fichier + stdout), ET le journal d'Unreal que la session relit."""
        dire_origine(texte)
        unreal.log("[NARVOS] " + str(texte))

    globaux["dire"] = dire
    for nom in ETAPES:
        journal("=== %s" % nom)
        try:
            globaux[nom]()
            journal("=== %s : termine" % nom)
        except Exception:
            journal("=== %s : EXCEPTION" % nom)
            for ligne in traceback.format_exc().splitlines():
                journal("    " + ligne)
except Exception:
    for ligne in traceback.format_exc().splitlines():
        journal("    " + ligne)
finally:
    journal("=== fermeture de l'editeur")
    unreal.SystemLibrary.quit_editor()
