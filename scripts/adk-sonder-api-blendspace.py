"""
adk-sonder-api-blendspace.py — sonde l'API python des blend spaces (LECTURE SEULE).

Contexte : la création de BS_Narvos_Locomotion bute sur deux murs mesurés le
2026-09-23 : le struct FBlendParameter n'expose AUCUN champ en python, et la
propriété `blend_parameter_x` n'existe pas sur la classe python BlendSpace.
Cette sonde liste ce que l'API expose VRAIMENT (dir() sur les classes lib,
existence de BlendSpace1D et de sa factory), sans rien créer.

Usage :
  UnrealEditor-Cmd.exe E:/narvosprime-web-prototype/WebPortal/Server/adk/NanosWorldADK.uproject \
    -run=pythonscript -script="E:/narvosprime-web-prototype/scripts/adk-sonder-api-blendspace.py" \
    -unattended -nosplash -stdout -log
"""
import os
import unreal

rapport = []


def log(msg):
    try:
        unreal.log("[NARVOS_BS_SONDE] " + msg)
    except Exception:
        pass


def attrs(klass, filtres):
    """Attributs de la classe contenant l'un des filtres (insensible à la casse)."""
    try:
        tous = dir(klass)
        return [a for a in tous
                if any(f in a.lower() for f in filtres)]
    except Exception as e:
        return ["DIR_ERREUR: " + str(e)]


def main():
    log("debut sonde 1/4 : BlendSpace")
    rapport.append("== BlendSpace (blend/axis/sample/param/skeleton) ==")
    rapport.extend(attrs(unreal.BlendSpace,
                         ["blend", "axis", "sample", "param", "skeleton"]))

    log("debut sonde 2/4 : BlendParameter")
    rapport.append("== BlendParameter (tous) ==")
    try:
        tous = dir(unreal.BlendParameter)
        rapport.extend(tous[:40])
    except Exception as e:
        rapport.append("DIR_ERREUR: " + str(e))

    log("debut sonde 3/4 : BlendSample")
    rapport.append("== BlendSample (animation/value/rate) ==")
    rapport.extend(attrs(unreal.BlendSample,
                         ["anim", "value", "rate", "grid", "sample"]))

    log("debut sonde 4/4 : BlendSpace1D + factory")
    for nom in ("BlendSpace1D", "BlendSpace1DFactoryNew", "BlendSpaceFactoryNew"):
        try:
            k = getattr(unreal, nom, None)
            rapport.append("%s : %s" % (nom, "EXISTE" if k else "ABSENT"))
            if k and nom == "BlendSpace1D":
                rapport.extend(attrs(k, ["blend", "axis", "sample", "mapping", "param"]))
        except Exception as e:
            rapport.append("%s : SONDE KO (%s)" % (nom, str(e)))

    log("fin sonde")
    return rapport


if __name__ == "__main__":
    lignes = main()
    chemin = os.path.join(unreal.Paths.project_dir(), "Saved", "adk_sonde_blendspace.txt")
    try:
        with open(chemin, "w", encoding="utf-8") as f:
            f.write("\n".join(lignes) + "\n")
        log("rapport ecrit : " + chemin)
    except Exception as e:
        log("rapport impossible : " + str(e))