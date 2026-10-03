# ══════════════════════════════════════════════════════════════════════════════
# adk-visage-sans-livelink.py — ABP de visage MetaHuman SANS LiveLink (2026-09-13)
#
# Execute DANS l'editeur ouvert (scripts/ue-remote.py), en trois temps :
#
#   dupliquer()   Face_AnimBP -> PontMetaHuman/ABP_NarvosVisage[Outil] (assets NEUFS)
#   (graphe)      noeud LiveLinkPose retire par le serveur MCP (scripts/ue-mcp.mjs) :
#                 le Python de l'editeur ne sait ni lire ni modifier un graphe
#   sauver()      compile + sauvegarde, puis etat() relu
#
# ── POURQUOI ──────────────────────────────────────────────────────────────────
# Crash client du 2026-09-13 14:14:42 a la pose de BP_NarvosMH_M : son visage
# utilise Face_AnimBP, dont le noeud AnimNode_LiveLinkPose appartient au module
# LiveLinkAnimationCore — ABSENT du client nanos. La propriete du noeud n'existe
# pas au chargement, sa case dans la table des noeuds est nulle, l'initialisation
# de l'ABP la lit (minidump : lecture a 0x44 = FProperty::Offset_Internal).
#
# On ne resauve JAMAIS l'original : Metahuman_Ref est en liens durs
# (reference_jonction_liens_durs_packs). Les references a Face_AnimBP (gabarit
# Face.AnimClass ET noeud Cast du graphe des BP MetaHuman) sont renvoyees vers la
# copie par ClassRedirects/ObjectRedirects dans DefaultEngine.ini.
# ══════════════════════════════════════════════════════════════════════════════
import unreal

EAL = unreal.EditorAssetLibrary
DOSSIER = "/Game/Narvos/PontMetaHuman"
COPIES = [
    # copie,                   original (jamais resauve)
    ("ABP_NarvosVisage", "/Game/Narvos/MetaCustom/Metahuman_Ref/Common/Face/Face_AnimBP"),
    ("ABP_NarvosVisageOutil", "/Game/Narvos/MetaCustom/Meta_Face_Tool/Animations/Face_AnimBP"),
]


def dire(texte):
    unreal.log("[VISAGE] " + texte)
    print("[VISAGE] " + texte)


def dupliquer():
    unreal.AssetRegistryHelpers.get_asset_registry().wait_for_completion()
    for nom, source in COPIES:
        chemin = DOSSIER + "/" + nom
        if EAL.does_asset_exist(chemin):
            dire("%s existe deja : conserve" % chemin)
            continue
        if not EAL.does_asset_exist(source):
            dire("ARRET %s : original introuvable %s" % (nom, source))
            continue
        copie = EAL.duplicate_asset(source, chemin)
        if copie is None:
            dire("ARRET %s : duplication refusee" % nom)
            continue
        EAL.save_asset(chemin, only_if_is_dirty=False)
        dire("%s <- %s (duplique et sauve)" % (chemin, source))
    etat()


def refaire():
    """Supprime les COPIES (jamais les originaux) et les refait depuis les originaux :
    la chirurgie de graphe se rejoue alors sur un etat connu."""
    for nom, source in COPIES:
        chemin = DOSSIER + "/" + nom
        # Les originaux partent en _quarantaine/ apres la chirurgie : sans eux, une
        # copie supprimee ne se refait plus. Les remettre d'abord (POURQUOI.md).
        if not EAL.does_asset_exist(source):
            dire("ARRET %s : original absent (%s) — copie CONSERVEE" % (nom, source))
            continue
        if EAL.does_asset_exist(chemin):
            dire("%s supprime : %s" % (chemin, EAL.delete_asset(chemin)))
    dupliquer()


def sauver():
    for nom, _source in COPIES:
        chemin = DOSSIER + "/" + nom
        abp = unreal.load_asset(chemin)
        if abp is None:
            dire("ARRET %s : introuvable" % chemin)
            continue
        unreal.BlueprintEditorLibrary.compile_blueprint(abp)
        # only_if_is_dirty=False : le graphe modifie par le serveur MCP est marque
        # modifie, mais une ecriture qui rate ne dit rien (feedback_ecriture_muette_unreal).
        ok = EAL.save_asset(chemin, only_if_is_dirty=False)
        dire("%s : compile, sauvegarde=%s" % (chemin, ok))
    etat()


def etat():
    for nom, _source in COPIES:
        chemin = DOSSIER + "/" + nom
        abp = unreal.load_asset(chemin) if EAL.does_asset_exist(chemin) else None
        if abp is None:
            dire("%s : ABSENT" % chemin)
            continue
        sq = abp.get_editor_property("target_skeleton")
        classe = abp.generated_class()
        dire("%s : squelette=%s classe=%s" % (
            chemin, sq.get_path_name() if sq else None, classe.get_path_name() if classe else None))