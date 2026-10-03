# adk-navmesh-api.py — SONDER l'API python du NavigationSystem en UE 5.7.
# Journalise les attributs contenant "nav" ou "build" des modules principaux,
# pour savoir quelle méthode force une génération SYNCHRONE en commandlet.
import unreal

def journal(txt):
    try:
        unreal.log("[NARVOS] " + txt)
    except Exception:
        pass

journal("─ sonde API navigation ─")
for nom_mod, mod in (("EditorLevelLibrary", unreal.EditorLevelLibrary),
                     ("NavigationSystemV1", unreal.NavigationSystemV1),
                     ("RecastNavMesh", unreal.RecastNavMesh)):
    try:
        attrs = [a for a in dir(mod) if not a.startswith("_")]
    except Exception as e:
        journal("%s : dir echoue (%s)" % (nom_mod, e))
        continue
    nav = [a for a in attrs if "nav" in a.lower() or "build" in a.lower()]
    journal("%s (%d attributs) : %s" % (nom_mod, len(attrs), ", ".join(sorted(nav))))

journal("─ sonde API terminee ─")