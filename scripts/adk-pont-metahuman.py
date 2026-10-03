# -*- coding: utf-8 -*-
"""
adk-pont-metahuman.py — le PONT qui fait suivre un MetaHuman au personnage nanos.

  python scripts/ue-remote.py --statement "exec(open(r'E:/narvosprime-web-prototype/scripts/adk-pont-metahuman.py', encoding='utf-8').read()); etape_rigs()"

── LE PROBLÈME ───────────────────────────────────────────────────────────────
Le joueur nanos est un `Character` sur SKEL_Mannequin (UE4). Les corps et la
garde-robe du Meta Customization System sont sur un squelette MetaHuman : 40 à
67 % du poids d'un vêtement repose sur des os absents du Mannequin (mesuré le
2026-09-10). Aucun re-skinning ne rattrape ça proprement.

── LA SOLUTION, MONTRÉE PAR LE PACK LUI-MÊME ─────────────────────────────────
Ses personnages « Playable » cachent un mesh pilote et font COPIER sa pose au
MetaHuman par un retarget vivant. Unreal a le nœud pour ça :
`AnimNode_RetargetPoseFromMesh`, `retarget_from = PARENT_SKELETAL_MESH_COMPONENT`
par défaut. Donc : un acteur dont le composant RACINE porte le corps MetaHuman et
un Anim Blueprint « copier la pose du parent », ATTACHÉ au mesh du Character
nanos ; le retargeter traduit SKEL_Mannequin -> MetaHuman.

── LES ÉTAPES (chacune rejouable, chacune rapporte) ───────────────────────────
  etape_rigs()        IK_NanosMannequin (sur SKEL_Mannequin), IK_NarvosMetaHuman,
                      RTG_NanosVersMetaHuman — ASSETS NEUFS seulement.
  etape_abp()         duplique l'Anim Blueprint de retarget du pack et lui donne
                      NOTRE retargeter (après rebranchement de MetaCustom).
  etape_porteur()     BP_NarvosMetaHuman : racine = corps MetaHuman + cet ABP.

Dossier : /Game/Narvos/PontMetaHuman (sous Narvos : monté et cuit).
Journal : WebPortal/Server/adk/_pont-metahuman.log
"""
import sys
import unreal

EAL = unreal.EditorAssetLibrary
AT = unreal.AssetToolsHelpers.get_asset_tools()
DOSSIER = "/Game/Narvos/PontMetaHuman"
JOURNAL = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_pont-metahuman.log"

# Le mesh de REFERENCE du squelette nanos : le retargeter calcule ses decalages sur
# sa pose de reference, il faut donc celle que le Character a vraiment au runtime.
MESH_NANOS = "/Game/NanosWorld/Characters/Mannequin/SK_Mannequin"
MESH_MH = "/Game/Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/SK_Meta_Female_Base"
ABP_SOURCE = "/Game/Narvos/MetaCustom/Meta_Body_Tool/Animations/AnimBP_RTG_metahuman_base_skel"


def dire(texte):
    sys.stdout.write(str(texte) + "\n")
    with open(JOURNAL, "a", encoding="utf-8") as f:
        f.write(str(texte) + "\n")


def _creer_ou_charger(nom, classe, fabrique):
    chemin = DOSSIER + "/" + nom
    if EAL.does_asset_exist(chemin):
        return unreal.load_asset(chemin), False
    return AT.create_asset(nom, DOSSIER, classe, fabrique), True


def _qualifier_ik_mains(rig):
    """La definition des chaines ne cree pas les objectifs ni le solveur UE5.7."""
    rc = unreal.IKRigController.get_controller(rig)
    avant = {str(c.chain_name): (str(rc.get_retarget_chain_start_bone(c.chain_name)),
             str(rc.get_retarget_chain_end_bone(c.chain_name))) for c in rc.get_retarget_chains()}
    if rc.get_num_solvers() == 0:
        if not rc.apply_auto_fbik():
            raise RuntimeError("Generation FBIK refusee : " + rig.get_name())
    apres = {str(c.chain_name): (str(rc.get_retarget_chain_start_bone(c.chain_name)),
             str(rc.get_retarget_chain_end_bone(c.chain_name))) for c in rc.get_retarget_chains()}
    if avant != apres:
        raise RuntimeError("La generation FBIK a change les chaines existantes")
    goals = {str(g.get_editor_property("goal_name")) for g in rc.get_all_goals()}
    for chain in ("LeftArm", "RightArm"):
        if str(rc.get_retarget_chain_goal(chain)) not in goals:
            raise RuntimeError("Objectif de main absent : " + chain)
    return {"solvers": rc.get_num_solvers(), "goals": sorted(goals)}


def _ancrer_mains_source(c):
    # La position suit les mains du porteur nanos qui tient l'arme. Conserver
    # la rotation retargetee : les axes locaux des deux squelettes different.
    found = set()
    for index in range(c.get_num_retarget_ops()):
        op = c.get_op_controller(index)
        if not isinstance(op, unreal.IKRetargetIKChainsController):
            continue
        settings = op.get_settings()
        chains = list(settings.chains_to_retarget)
        for i, chain in enumerate(chains):
            name = str(chain.target_chain_name)
            if name not in ("LeftArm", "RightArm"):
                continue
            chain.enable_ik = True
            chain.blend_to_source = 1.0
            chain.blend_to_source_translation = 1.0
            chain.blend_to_source_rotation = 0.0
            chains[i] = chain
            found.add(name)
        settings.chains_to_retarget = chains
        op.set_settings(settings)
    if found != {"LeftArm", "RightArm"}:
        raise RuntimeError("Operation IK des deux bras absente")


def _rig(nom, chemin_mesh):
    mesh = unreal.load_asset(chemin_mesh)
    if mesh is None:
        dire("  %s : mesh introuvable %s" % (nom, chemin_mesh))
        return None
    rig, neuf = _creer_ou_charger(nom, unreal.IKRigDefinition, unreal.IKRigDefinitionFactory())
    if rig is None:
        dire("  %s : creation refusee" % nom)
        return None
    rc = unreal.IKRigController.get_controller(rig)
    if neuf or not rc.get_retarget_chains():
        ok_mesh = rc.set_skeletal_mesh(mesh)
        ok_def = rc.apply_auto_generated_retarget_definition()
        dire("  %s : mesh %s, definition auto %s" % (nom, ok_mesh, ok_def))
    chaines = [str(c.get_editor_property("chain_name")) for c in rc.get_retarget_chains()]
    dire("  %s : %d chaine(s) %s | racine %s"
         % (nom, len(chaines), chaines[:16], rc.get_retarget_root()))
    if nom in ("IK_NarvosMetaHuman", "IK_NarvosMetaHumanCorps"):
        dire("  IK mains : %s" % _qualifier_ik_mains(rig))
    EAL.save_loaded_asset(rig, False)
    return rig


def etape_rigs():
    dire("[RIGS] dossier %s" % DOSSIER)
    rig_nanos = _rig("IK_NanosMannequin", MESH_NANOS)
    rig_mh = _rig("IK_NarvosMetaHuman", MESH_MH)
    if rig_nanos is None or rig_mh is None:
        dire("[RIGS] ARRET : un rig manque")
        return
    _retargeter("RTG_NanosVersMetaHuman", rig_nanos, rig_mh, MESH_NANOS, MESH_MH)


def _retargeter(nom, rig_nanos, rig_mh, mesh_source, mesh_cible):
    """SKEL_Mannequin -> MetaHuman. Extrait d'etape_rigs() le 2026-09-13 pour servir
    aussi au corps MetaHuman REEL (etape_corps) : un seul reglage, deux retargeters."""
    rtg, neuf = _creer_ou_charger(nom, unreal.IKRetargeter, unreal.IKRetargetFactory())
    if rtg is None:
        dire("[RIGS] ARRET : retargeter %s refuse" % nom)
        return None
    c = unreal.IKRetargeterController.get_controller(rtg)
    src, cib = unreal.RetargetSourceOrTarget.SOURCE, unreal.RetargetSourceOrTarget.TARGET
    c.set_ik_rig(src, rig_nanos)
    c.set_ik_rig(cib, rig_mh)
    c.set_preview_mesh(src, unreal.load_asset(mesh_source))
    c.set_preview_mesh(cib, unreal.load_asset(mesh_cible))
    # 5.6+ : le retarget passe par une pile d'operations (bassin, chaines FK, IK...).
    # Un retargeter neuf peut n'en avoir aucune : sans elles, il ne bouge RIEN.
    if c.get_num_retarget_ops() == 0:
        c.add_default_ops()
    c.assign_ik_rig_to_all_ops(src, rig_nanos)
    c.assign_ik_rig_to_all_ops(cib, rig_mh)
    cibles = [str(x.get_editor_property("chain_name"))
              for x in unreal.IKRigController.get_controller(rig_mh).get_retarget_chains()]
    # EXACT seulement. Les 8 chaines « Metacarpal » du MetaHuman n'ont pas d'os
    # equivalent dans le Mannequin UE4 : sans source, elles restent en pose de
    # retarget, ce qui est juste. FUZZY les reliait aux doigts (mesure du
    # 2026-09-11 : 28/28) — le metacarpe aurait copie la phalange et replie la main.
    c.auto_map_chains(unreal.AutoMapChainType.EXACT, True)
    relies = {t: str(c.get_source_chain(t)) for t in cibles}
    sans = [t for t, s in relies.items() if s in ("None", "")]
    dire("  correspondance EXACT : %d/%d chaines reliees, sans source %s"
         % (len(cibles) - len(sans), len(cibles), sans))
    hors_metacarpe = [t for t in sans if "Metacarpal" not in t]
    if hors_metacarpe:
        dire("  ATTENTION : chaines majeures sans source %s" % hors_metacarpe)
    try:
        c.auto_align_all_bones(cib)
    except Exception as e:
        dire("  alignement auto impossible : %s" % str(e)[:100])
    _ancrer_mains_source(c)
    EAL.save_loaded_asset(rtg, False)
    dire("[RIGS] retargeter %s %s : %d operation(s), source=%s cible=%s"
         % (nom, "cree" if neuf else "mis a jour", c.get_num_retarget_ops(),
            c.get_ik_rig(src).get_name(), c.get_ik_rig(cib).get_name()))
    return rtg


# ── ÉTAPE 2 : l'Anim Blueprint « copier la pose du parent » ──────────────────
ABP_NOM = "ABP_NanosVersMetaHuman"


def _noeuds_retarget(abp):
    paquet = abp.get_outermost().get_name()
    return [n for n in unreal.ObjectIterator(unreal.AnimGraphNode_RetargetPoseFromMesh)
            if n.get_outermost().get_name() == paquet]


def etape_abp():
    """Duplique l'ABP de retarget du pack (le noeud existe deja dans son graphe :
    Python ne sait pas en creer) et lui donne NOTRE retargeter."""
    return _abp(ABP_NOM, ABP_SOURCE, "RTG_NanosVersMetaHuman")


def _abp(abp_nom, abp_source, rtg_nom):
    rtg = unreal.load_asset(DOSSIER + "/" + rtg_nom)
    if rtg is None:
        dire("[ABP] ARRET : retargeter %s absent" % rtg_nom)
        return None
    chemin = DOSSIER + "/" + abp_nom
    abp = unreal.load_asset(chemin) if EAL.does_asset_exist(chemin) else EAL.duplicate_asset(abp_source, chemin)
    if abp is None:
        dire("[ABP] ARRET : duplication refusee depuis %s" % abp_source)
        return None
    noeuds = _noeuds_retarget(abp)
    for n in noeuds:
        nd = n.get_editor_property("node")
        nd.set_editor_property("ik_retargeter_asset", rtg)
        nd.set_editor_property("retarget_from", unreal.RetargetSourceMode.PARENT_SKELETAL_MESH_COMPONENT)
        n.set_editor_property("node", nd)
    unreal.BlueprintEditorLibrary.compile_blueprint(abp)
    EAL.save_loaded_asset(abp, False)
    relus = [str(n.get_editor_property("node").get_editor_property("ik_retargeter_asset")) for n in _noeuds_retarget(abp)]
    sq = abp.get_editor_property("target_skeleton")
    dire("[ABP] %s : %d noeud(s) de retarget, relus %s ; squelette cible %s"
         % (abp_nom, len(noeuds), [r.split("'")[-2] if "'" in r else r for r in relus],
            sq.get_path_name() if sq else None))
    return abp


# ── ÉTAPE 3 : les porteurs — un Blueprint par piece, SANS graphe ─────────────
# Chaque piece est un acteur dont le composant RACINE est le maillage MetaHuman,
# anime par l'ABP ci-dessus. Lua l'attache au mesh du Character (os « root ») :
# le noeud trouve son parent et en copie la pose. Pas un seul noeud de graphe a
# ecrire : tout est dans les valeurs par defaut du composant.
def _porteur(nom, chemin_mesh, abp):
    mesh = unreal.load_asset(chemin_mesh)
    if mesh is None:
        dire("  %s : mesh introuvable %s" % (nom, chemin_mesh))
        return None
    chemin = DOSSIER + "/" + nom
    if EAL.does_asset_exist(chemin):
        bp = unreal.load_asset(chemin)
    else:
        fab = unreal.BlueprintFactory()
        fab.set_editor_property("parent_class", unreal.Actor)
        bp = AT.create_asset(nom, DOSSIER, unreal.Blueprint, fab)
    sds = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
    lib = unreal.SubobjectDataBlueprintFunctionLibrary
    poignees = sds.k2_gather_subobject_data_for_blueprint(bp)
    corps = None
    for h in poignees:
        o = lib.get_object(sds.k2_find_subobject_data_from_handle(h))
        if isinstance(o, unreal.SkeletalMeshComponent):
            corps = (h, o)
    if corps is None:
        h, raison = sds.add_new_subobject(unreal.AddNewSubobjectParams(
            parent_handle=poignees[0], new_class=unreal.SkeletalMeshComponent, blueprint_context=bp))
        if not lib.is_handle_valid(h):
            dire("  %s : composant refuse (%s)" % (nom, raison))
            return None
        sds.rename_subobject(h, unreal.Text("Corps"))
        sds.make_new_scene_root(poignees[0], h, bp)
        corps = (h, lib.get_object(sds.k2_find_subobject_data_from_handle(h)))
    comp = corps[1]
    try:
        comp.set_editor_property("skeletal_mesh_asset", mesh)
    except Exception:
        comp.set_skeletal_mesh_asset(mesh)
    comp.set_editor_property("animation_mode", unreal.AnimationMode.ANIMATION_BLUEPRINT)
    comp.set_editor_property("anim_class", abp.generated_class())
    comp.set_editor_property("visibility_based_anim_tick_option",
                             unreal.VisibilityBasedAnimTickOption.ALWAYS_TICK_POSE_AND_REFRESH_BONES)
    comp.set_collision_profile_name("NoCollision")
    comp.set_editor_property("generate_overlap_events", False)
    unreal.BlueprintEditorLibrary.compile_blueprint(bp)
    EAL.save_loaded_asset(bp, False)
    etat = []
    for h in sds.k2_gather_subobject_data_for_blueprint(bp):
        d = sds.k2_find_subobject_data_from_handle(h)
        o = lib.get_object(d)
        etat.append("%s%s" % (type(o).__name__, "*" if lib.is_root_component(d) else ""))
    dire("  %s : %s (* = racine)" % (nom, etat))
    return bp


# Les pieces sur Skel_Dummy (mesure disque du 2026-09-11 : 14 feminines + le corps).
# Les 13 de Metawadrobe sont sur metahuman_base_skel : il leur faudra un second ABP.
# Le catalogue Lua est GENERE depuis le manifeste ecrit ici
# (scripts/narvos-metahumain-to-lua.mjs) : ne pas recopier cette liste ailleurs.
F = "/Game/Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/"
PORTEURS = [
    # id,                  slot,         genre, libelle,                    mesh
    ("corps_f_base",       "corps",      "F", "Corps MetaHuman",          F + "SK_Meta_Female_Base"),
    ("haut_f_crop_top",    "haut",       "F", "Brassiere",                F + "SK_Set_1_Crop_Top"),
    ("haut_f_travail",     "haut",       "F", "Haut de travail",          F + "SK_Set_3_Work_Top"),
    ("bas_f_short",        "bas",        "F", "Short",                    F + "SK_Set_1Shorts"),
    ("bas_f_pantalon",     "bas",        "F", "Pantalon",                 F + "SK_Pants"),
    ("bas_f_pantalon_2",   "bas",        "F", "Pantalon ajuste",          F + "SK_Set_2_Pants"),
    ("bas_f_jupe",         "bas",        "F", "Jupe de travail",          F + "SK_Set_3_Work_Skirt"),
    ("pieds_f_bottes",     "pieds",      "F", "Bottes",                   F + "SK_Boots"),
    ("tenue_f_une_piece",  "tenue",      "F", "Une-piece",                F + "SK_1_peace"),
    ("tenue_f_armure",     "tenue",      "F", "Armure sci-fi",            F + "SK_Sci_Fi_Armor"),
    ("tenue_f_combinaison", "tenue",     "F", "Combinaison sci-fi",       F + "SK_Sci_Fi_Jumpsuit"),
    ("tenue_f_fantasy",    "tenue",      "F", "Tenue fantasy",            F + "SK_Fantasy_Outfit_F_Tal_Med1"),
    ("tenue_f_meta_p",     "tenue",      "F", "Tenue MetaP",              F + "SK_MetaP"),
    ("tenue_f_meta_p1",    "tenue",      "F", "Tenue MetaP II",           F + "SK_MetaP1"),
]
MANIFESTE = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_pont-metahuman.json"


def etape_porteur():
    import json
    abp = unreal.load_asset(DOSSIER + "/" + ABP_NOM)
    if abp is None:
        dire("[BP] ARRET : lancer etape_abp()")
        return
    dire("[BP] %d porteur(s)" % len(PORTEURS))
    faits = []
    for pid, slot, genre, libelle, mesh in PORTEURS:
        nom = "BP_NarvosMH_" + pid
        if _porteur(nom, mesh, abp) is not None:
            faits.append({"id": pid, "blueprint": nom, "slot": slot, "genre": genre,
                          "libelle": libelle, "mesh": mesh.rsplit("/", 1)[1]})
    with open(MANIFESTE, "w", encoding="utf-8") as f:
        json.dump({"abp": ABP_NOM, "porteurs": faits}, f, ensure_ascii=False, indent=2)
    dire("[BP] %d/%d porteur(s) ecrits ; manifeste %s" % (len(faits), len(PORTEURS), MANIFESTE))


# ══════════════════════════════════════════════════════════════════════════════
# VOIE (a), 2026-09-13 — les VRAIS MetaHumans du pack (Metahuman_Ref)
# ══════════════════════════════════════════════════════════════════════════════
# Vu en jeu le 13/09 : l'apercu de creation INVISIBLE. BP_MH_Male/Female de l'ADK
# avaient ete resauves pendant que Metahuman_Ref etait absent de Content/ : leurs
# 30 references (corps, visage, grooms) sont NULLES dans le fichier. Aucun redirect
# ne rend une valeur qui n'est plus ecrite.
#
# Architecture retenue (rapport Fable du 13/09, voie a) : Character porteur
# SKEL_Mannequin + UN Blueprint MetaHuman par joueur, DUPLIQUE des Blueprints
# STANDARDS du pack (BP_MCSGavin, BP_Hana), defauts intacts. On ne change que :
#   · Body : ABP de retarget depuis le PARENT, sur le vrai squelette metahuman_base_skel ;
#   · Body devient la RACINE de l'acteur — le noeud RetargetPoseFromMesh lit le
#     parent d'attache IMMEDIAT ; sous le SceneComponent « Root » du BP standard, il
#     ne trouverait pas le mesh du Character ;
#   · post-process du corps et du visage coupes en passe 1 (neckPoses, control rigs
#     et Metahuman_Face_Customization ne sont pas lies).
#
# Precondition : Metahuman_Ref lie en dur sous Narvos/MetaCustom/ AVANT le demarrage
# de l'editeur (adk-copier-hyper.mjs --racine Metahuman_Customization_System ...).
# Toutes les ecritures portent sur des assets NEUFS sous Narvos/PontMetaHuman : un
# fichier lie en dur n'est jamais resauve.
MH_REF = "/Game/Narvos/MetaCustom/Metahuman_Ref"
CORPS_REEL_M = MH_REF + "/MCSGavin/Male/Tall/NormalWeight/Body/m_tal_nrw_body"
ABP_SOURCE_CORPS = MH_REF + "/Common/RTG_metahuman_base_skel_AnimBP"
RIG_CORPS = "IK_NarvosMetaHumanCorps"
RTG_CORPS = "RTG_NanosVersMetaHumanCorps"
ABP_CORPS = "ABP_NanosVersMetaHumanCorps"
BP_STANDARDS = [
    # duplicata,        genre, BP standard du pack
    ("BP_NarvosMH_M", "M", MH_REF + "/MCSGavin/BP_MCSGavin"),
    ("BP_NarvosMH_F", "F", MH_REF + "/FCSBase/BP_Hana"),
]
MANIFESTE_STANDARDS = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/metahuman-standards.json"


def etape_corps():
    """Rig sur le vrai corps, retargeter SKEL_Mannequin -> metahuman_base_skel, ABP."""
    dire("[CORPS] corps de reference %s" % CORPS_REEL_M)
    rig_nanos = _rig("IK_NanosMannequin", MESH_NANOS)
    rig_corps = _rig(RIG_CORPS, CORPS_REEL_M)
    if rig_nanos is None or rig_corps is None:
        dire("[CORPS] ARRET : un rig manque")
        return None
    if _retargeter(RTG_CORPS, rig_nanos, rig_corps, MESH_NANOS, CORPS_REEL_M) is None:
        return None
    abp = _abp(ABP_CORPS, ABP_SOURCE_CORPS, RTG_CORPS)
    sq = abp.get_editor_property("target_skeleton") if abp else None
    if sq is None or "metahuman_base_skel" not in sq.get_path_name():
        dire("[CORPS] ATTENTION : squelette cible de %s = %s (attendu metahuman_base_skel)"
             % (ABP_CORPS, sq.get_path_name() if sq else None))
    return abp


def _maillage(comp):
    """Le maillage d'un composant squelettique GABARIT (composant de Blueprint).

    ⚠ `skeletal_mesh_asset` est un champ que le fichier ne SERIALISE PAS : le paquet
    stocke `SkinnedAsset` (table de noms de BP_MCSGavin : SkinnedAsset oui,
    SkeletalMeshAsset non). Lu sur un gabarit charge depuis le disque, il vaut None
    alors que le maillage est la. Faux negatif du 2026-09-13 : « Body SANS maillage »
    a arrete la voie (a) sur les deux Blueprints, dont le fichier cite pourtant
    m_tal_nrw_body / f_tal_nrw_body. On lit le champ serialise d'abord."""
    for nom in ("skinned_asset", "skeletal_mesh_asset"):
        try:
            m = comp.get_editor_property(nom)
        except Exception:
            m = None
        if m is not None:
            return m
    return None


def _sous_objets(bp):
    sds = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
    lib = unreal.SubobjectDataBlueprintFunctionLibrary
    poignees = sds.k2_gather_subobject_data_for_blueprint(bp)
    noms = {}
    for h in poignees:
        d = sds.k2_find_subobject_data_from_handle(h)
        o = lib.get_object(d)
        if o is None or not isinstance(o, unreal.ActorComponent):
            continue
        try:
            nom = str(lib.get_variable_name(d))
        except Exception:
            nom = o.get_name().replace("_GEN_VARIABLE", "")
        noms[nom] = (h, o, d)
    return sds, lib, poignees, noms


def _etat_composants(bp):
    sds, lib, _, noms = _sous_objets(bp)
    etat = []
    for nom, (_, o, d) in sorted(noms.items()):
        detail = ""
        if isinstance(o, unreal.SkeletalMeshComponent):
            m = _maillage(o)
            detail = "=" + (m.get_name() if m else "VIDE")
        etat.append("%s%s%s" % (nom, "*" if lib.is_root_component(d) else "", detail))
    return etat


def _bp_standard(nom, source, abp):
    chemin = DOSSIER + "/" + nom
    bp = unreal.load_asset(chemin) if EAL.does_asset_exist(chemin) else EAL.duplicate_asset(source, chemin)
    if bp is None:
        dire("  %s : duplication refusee depuis %s" % (nom, source))
        return None
    sds, lib, poignees, noms = _sous_objets(bp)
    if "Body" not in noms or "Face" not in noms:
        dire("  %s : ARRET, composants Body/Face introuvables : %s" % (nom, sorted(noms)))
        return None
    h_corps, corps, d_corps = noms["Body"]
    if _maillage(corps) is None:
        # Le defaut qu'on repare : une copie resauvee sans Metahuman_Ref. Ne rien
        # sauver par-dessus — le duplicata serait invisible comme BP_MH_Male.
        dire("  %s : ARRET, Body SANS maillage (Metahuman_Ref non lie ?)" % nom)
        return None
    corps.set_editor_property("animation_mode", unreal.AnimationMode.ANIMATION_BLUEPRINT)
    corps.set_editor_property("anim_class", abp.generated_class())
    corps.set_editor_property("visibility_based_anim_tick_option",
                              unreal.VisibilityBasedAnimTickOption.ALWAYS_TICK_POSE_AND_REFRESH_BONES)
    # Les adaptateurs NARVOS conservent la sculpture MCS sans ses sauvegardes de
    # demonstration. Ne pas les desactiver lors d'une reprise du generateur.
    for composant, nom_adaptateur in ((corps, "ABP_NarvosPersonnalisationCorps"),
                                      (noms["Face"][1], "ABP_NarvosPersonnalisationVisage")):
        chemin_adaptateur = DOSSIER + "/" + nom_adaptateur
        adaptateur = unreal.load_asset(chemin_adaptateur) if EAL.does_asset_exist(chemin_adaptateur) else None
        classe = adaptateur.generated_class() if adaptateur else None
        if classe:
            composant.set_override_post_process_anim_bp(classe, False)
        composant.set_editor_property("disable_post_process_blueprint", classe is None)
    corps.set_collision_profile_name("NoCollision")
    corps.set_editor_property("generate_overlap_events", False)
    if not lib.is_root_component(d_corps):
        sds.make_new_scene_root(poignees[0], h_corps, bp)
    unreal.BlueprintEditorLibrary.compile_blueprint(bp)
    EAL.save_loaded_asset(bp, False)
    etat = _etat_composants(bp)
    dire("  %s : %s (* = racine)" % (nom, etat))
    if not any(e.startswith("Body*") for e in etat):
        dire("  %s : ATTENTION, Body n'est PAS la racine apres sauvegarde" % nom)
    return etat


def etape_voie_a():
    import json
    # Lance au demarrage de l'editeur, le registre balaie encore : `does_asset_exist`
    # dirait « absent » d'un duplicata deja la, et la duplication echouerait.
    unreal.AssetRegistryHelpers.get_asset_registry().wait_for_completion()
    abp = etape_corps()
    if abp is None:
        dire("[VOIE A] ARRET : pas d'ABP de corps")
        return
    faits = []
    for nom, genre, source in BP_STANDARDS:
        etat = _bp_standard(nom, source, abp)
        if etat is not None:
            faits.append({"blueprint": nom, "genre": genre, "source": source, "composants": etat})
    with open(MANIFESTE_STANDARDS, "w", encoding="utf-8") as f:
        json.dump({"abp": ABP_CORPS, "retargeter": RTG_CORPS, "blueprints": faits},
                  f, ensure_ascii=False, indent=2)
    dire("[VOIE A] %d/%d Blueprint(s) MetaHuman standards ; manifeste %s"
         % (len(faits), len(BP_STANDARDS), MANIFESTE_STANDARDS))