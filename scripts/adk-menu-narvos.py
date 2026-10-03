# -*- coding: utf-8 -*-
"""
adk-menu-narvos.py — le menu NARVOS de l'éditeur Unreal : les POINTS DE TP.

  Enregistré au démarrage de l'éditeur par Content/Python/init_unreal.py ; ou à la
  main :
  python scripts/ue-remote.py --statement "exec(open(r'E:/narvosprime-web-prototype/scripts/adk-menu-narvos.py', encoding='utf-8').read()); enregistrer_menu()"

── LE SYSTÈME ─────────────────────────────────────────────────────────────────
Les points de téléportation vivent dans UN fichier, relu par le jeu :
  WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Teleports.lua
Le jeu l'écrit (mode édition, /tp : Server/Teleports.lua -> Export.Catalogue) ;
ce menu l'écrit AUSSI, au même format ligne à ligne (Logic/Teleports.lua,
`Teleports.Catalogue`). Coordonnées LOCALES au monde : local = monde - DECALAGES,
le monde d'un point se déduit de sa position (Mondes.ParPosition), exactement
comme le serveur.

Dans l'éditeur, un point est un TargetPoint :
  · son LIBELLÉ (Outliner, F2) = le nom du point ;
  · ses Tags : « NarvosTP », « id:<id> », et au plus un de « vers:<id> » (mène à
    un autre point) ou « dest:<monde>,<x>,<y>,<z>,<yaw> » (position libre, locale),
    plus « rayon:<cm> » facultatif.
Déplacer, renommer, supprimer : les outils NORMAUX de l'éditeur (gizmo, Outliner,
Suppr). Le menu ne fait que ce qu'ils ne savent pas faire : lire et écrire le
catalogue, relier deux points, lister.

⚠ DEUX ÉCRIVAINS, UN FICHIER. Le serveur ne relit le catalogue qu'au démarrage.
Exporter d'ici pendant qu'il tourne, puis éditer en jeu, ÉCRASERAIT l'export.
Règle : serveur ARRÊTÉ pendant l'édition Unreal (ou `package reload`).
"""
import math
import re
import unreal

RACINE = "E:/narvosprime-web-prototype"
CATALOGUE = RACINE + "/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Teleports.lua"
MONDES = RACINE + "/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Mondes.lua"
SCRIPT = RACINE + "/scripts/adk-menu-narvos.py"
TAG = "NarvosTP"
NOM_MAX = 48
RAYON_DEFAUT, RAYON_MIN, RAYON_MAX = 150.0, 50.0, 1000.0

EAS = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
LIGNE = re.compile(
    r'\{\s*id\s*=\s*"(?P<id>[A-Za-z0-9_]+)"\s*,\s*nom\s*=\s*"(?P<nom>(?:[^"\\]|\\.)*)"\s*,'
    r'\s*monde\s*=\s*"(?P<monde>[A-Za-z0-9_]+)"\s*,\s*x\s*=\s*(?P<x>-?\d+)\s*,\s*y\s*=\s*(?P<y>-?\d+)\s*,'
    r'\s*z\s*=\s*(?P<z>-?\d+)\s*,\s*yaw\s*=\s*(?P<yaw>-?\d+)\s*,\s*rayon\s*=\s*(?P<rayon>-?\d+)'
    r'(?:\s*,\s*vers\s*=\s*"(?P<vers>[A-Za-z0-9_]+)")?'
    r'(?:\s*,\s*dest\s*=\s*\{\s*monde\s*=\s*"(?P<dmonde>[A-Za-z0-9_]+)"\s*,\s*x\s*=\s*(?P<dx>-?\d+)\s*,'
    r'\s*y\s*=\s*(?P<dy>-?\d+)\s*,\s*z\s*=\s*(?P<dz>-?\d+)\s*,\s*yaw\s*=\s*(?P<dyaw>-?\d+)\s*\})?\s*\},')


def dire(texte, fenetre=False):
    unreal.log("[TP] " + texte)
    if fenetre:
        unreal.EditorDialog.show_message("NARVOS — points de TP", texte, unreal.AppMsgType.OK)


# ── Les mondes (lus dans Catalogs/Mondes.lua, jamais recopiés) ───────────────

def _vecteurs(texte, table):
    bloc = re.search(r"Mondes\." + table + r"\s*=\s*\{(.*?)\n\}", texte, re.S)
    sortie = {}
    if bloc:
        for nom, x, y, z in re.findall(r"(\w+)\s*=\s*Vector\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)", bloc.group(1)):
            sortie[nom] = (float(x), float(y), float(z))
    return sortie


def _mondes():
    with open(MONDES, encoding="utf-8") as f:
        texte = f.read()
    rayon = re.search(r"Mondes\.RAYON_MONDE\s*=\s*([\d.]+)", texte)
    return _vecteurs(texte, "DECALAGES"), _vecteurs(texte, "CENTRES"), float(rayon.group(1)) if rayon else 600000.0


def _monde_de(v, decalages, centres, rayon):
    """Même règle que Mondes.ParPosition : une sphère par monde planétaire autour
    de son CENTRE (repli : décalage), tout le reste est l'orbite."""
    r2 = rayon * rayon
    for nom in list(centres.keys()) + [k for k in decalages.keys() if k not in centres]:
        if nom == "orbital":
            continue
        c = centres.get(nom) or decalages.get(nom)
        dx, dy, dz = v[0] - c[0], v[1] - c[1], v[2] - c[2]
        if dx * dx + dy * dy + dz * dz <= r2:
            return nom
    return "orbital"


# ── Le catalogue : lecture et écriture au format du jeu ──────────────────────

def _lua_chaine(s):
    """Équivalent de %q (Lua 5.4) pour ce qu'un nom peut contenir."""
    s = s.replace(chr(92), chr(92) * 2).replace('"', chr(92) + '"').replace("\n", chr(92) + "n")
    return '"' + s + '"'


def _lua_dechaine(s):
    return re.sub(r"\\(.)", lambda m: "\n" if m.group(1) == "n" else m.group(1), s)


def lire_catalogue():
    points = []
    with open(CATALOGUE, encoding="utf-8") as f:
        for ligne in f:
            m = LIGNE.search(ligne)
            if not m:
                continue
            p = {"id": m["id"], "nom": _lua_dechaine(m["nom"]), "monde": m["monde"],
                 "x": int(m["x"]), "y": int(m["y"]), "z": int(m["z"]), "yaw": int(m["yaw"]),
                 "rayon": int(m["rayon"])}
            if m["vers"]:
                p["vers"] = m["vers"]
            elif m["dmonde"]:
                p["dest"] = {"monde": m["dmonde"], "x": int(m["dx"]), "y": int(m["dy"]),
                             "z": int(m["dz"]), "yaw": int(m["dyaw"])}
            points.append(p)
    return points


def ecrire_catalogue(points):
    lignes = []
    for p in sorted(points, key=lambda q: q["id"]):
        fin = ""
        if p.get("vers"):
            fin = ', vers = "%s"' % p["vers"]
        elif p.get("dest"):
            d = p["dest"]
            fin = ', dest = { monde = "%s", x = %d, y = %d, z = %d, yaw = %d }' % (
                d["monde"], round(d["x"]), round(d["y"]), round(d["z"]), round(d["yaw"]))
        lignes.append('    { id = "%s", nom = %s, monde = "%s", x = %d, y = %d, z = %d, yaw = %d, rayon = %d%s },' % (
            p["id"], _lua_chaine(p["nom"]), p["monde"], round(p["x"]), round(p["y"]), round(p["z"]),
            round(p["yaw"]), round(p["rayon"]), fin))
    entete = (
        "-- " + "═" * 78 + "\n"
        "-- Teleports.lua — les points de téléportation de toutes les maps.\n"
        "--\n"
        "-- ÉCRIT PAR LE JEU (mode édition, /tp) via Server/Export.lua, ET PAR L'ÉDITEUR\n"
        "-- UNREAL (menu NARVOS > Points de TP, scripts/adk-menu-narvos.py). Ne pas éditer à\n"
        "-- la main : une entrée mal formée est ÉCARTÉE au chargement, et le journal la nomme.\n"
        "--\n"
        "-- %d point(s). Coordonnées LOCALES au monde (Mondes.DECALAGES), comme DecorPose.lua.\n"
        "-- Une entrée par ligne : l'outil de l'éditeur relit ce fichier ligne à ligne.\n"
        "-- " + "═" * 78 + "\n\n"
        "local Teleports = {}\n\n"
        "Teleports.LISTE = {\n") % len(lignes)
    with open(CATALOGUE, "w", encoding="utf-8", newline="\n") as f:
        f.write(entete + "\n".join(lignes) + "\n}\n\nreturn Teleports\n")
    return len(lignes)


# ── Les repères dans le niveau ───────────────────────────────────────────────

def _slug(nom):
    s = nom.lower()
    for a, b in (("àâä", "a"), ("éèêë", "e"), ("îï", "i"), ("ôö", "o"), ("ùûü", "u"), ("ç", "c")):
        for c in a:
            s = s.replace(c, b)
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return (s or "tp")[:32]


def _tags(acteur):
    return [str(t) for t in acteur.get_editor_property("tags")]


def _valeur(tags, prefixe):
    for t in tags:
        if t.startswith(prefixe + ":"):
            return t[len(prefixe) + 1:]
    return None


def reperes():
    return [a for a in EAS.get_all_level_actors() if isinstance(a, unreal.TargetPoint) and TAG in _tags(a)]


def _poser_tags(acteur, pid, vers=None, dest=None, rayon=None):
    tags = [TAG, "id:" + pid]
    if vers:
        tags.append("vers:" + vers)
    elif dest:
        tags.append("dest:%s,%d,%d,%d,%d" % (dest["monde"], dest["x"], dest["y"], dest["z"], dest["yaw"]))
    if rayon:
        tags.append("rayon:%d" % rayon)
    acteur.set_editor_property("tags", [unreal.Name(t) for t in tags])


def tp_placer_depuis_jeu():
    """Pose (ou replace) un TargetPoint par point du catalogue."""
    decalages, _, _ = _mondes()
    existants = {_valeur(_tags(a), "id"): a for a in reperes()}
    n = 0
    for p in lire_catalogue():
        d = decalages.get(p["monde"], (0.0, 0.0, 0.0))
        lieu = unreal.Vector(p["x"] + d[0], p["y"] + d[1], p["z"] + d[2])
        rot = unreal.Rotator(0.0, 0.0, float(p["yaw"]))
        a = existants.get(p["id"])
        if a is None:
            a = EAS.spawn_actor_from_class(unreal.TargetPoint, lieu, rot)
        else:
            a.set_actor_location_and_rotation(lieu, rot, False, False)
        a.set_actor_label(p["nom"])
        _poser_tags(a, p["id"], p.get("vers"), p.get("dest"), p.get("rayon"))
        n += 1
    dire("%d point(s) places depuis le catalogue du jeu" % n, fenetre=True)


def tp_creer_a_la_camera():
    """Un repère neuf là où regarde la caméra de l'éditeur (renommer ensuite : F2)."""
    cam = unreal.UnrealEditorSubsystem().get_level_viewport_camera_info()
    lieu, rot = cam[1], cam[2]
    avant = rot.get_forward_vector()
    lieu = unreal.Vector(lieu.x + avant.x * 400.0, lieu.y + avant.y * 400.0, lieu.z + avant.z * 400.0)
    ids = {_valeur(_tags(a), "id") for a in reperes()} | {p["id"] for p in lire_catalogue()}
    base, i = "nouveau_point", 1
    pid = base
    while pid in ids:
        i += 1
        pid = "%s_%d" % (base, i)
    a = EAS.spawn_actor_from_class(unreal.TargetPoint, lieu, unreal.Rotator(0.0, 0.0, rot.yaw))
    a.set_actor_label("Nouveau point %d" % i)
    _poser_tags(a, pid)
    EAS.set_selected_level_actors([a])
    dire("repere cree : %s — renommez-le (F2), puis Exporter vers le jeu" % pid)


def tp_relier_selection():
    """Deux repères sélectionnés : chacun mène à l'autre (une porte et son retour)."""
    sel = [a for a in EAS.get_selected_level_actors() if isinstance(a, unreal.TargetPoint) and TAG in _tags(a)]
    if len(sel) != 2:
        dire("Selectionnez exactement DEUX points de TP.", fenetre=True)
        return
    a, b = sel
    ia, ib = _valeur(_tags(a), "id"), _valeur(_tags(b), "id")
    _poser_tags(a, ia, vers=ib, rayon=_valeur(_tags(a), "rayon") and int(_valeur(_tags(a), "rayon")))
    _poser_tags(b, ib, vers=ia, rayon=_valeur(_tags(b), "rayon") and int(_valeur(_tags(b), "rayon")))
    dire("%s <-> %s relies" % (a.get_actor_label(), b.get_actor_label()), fenetre=True)


def tp_lister():
    decalages, _, _ = _mondes()
    lignes = []
    for a in reperes():
        t = _tags(a)
        v = a.get_actor_location()
        dest = _valeur(t, "vers") or (("position " + _valeur(t, "dest").split(",")[0]) if _valeur(t, "dest") else "sans destination")
        lignes.append("%s  [%s]  (%.0f, %.0f, %.0f)  -> %s" % (a.get_actor_label(), _valeur(t, "id"), v.x, v.y, v.z, dest))
    dire("%d point(s) dans le niveau :\n%s" % (len(lignes), "\n".join(lignes) or "aucun"), fenetre=True)


def tp_exporter():
    """Écrit le catalogue du jeu depuis les repères du niveau (monde déduit de la
    position, coordonnées converties en LOCALES)."""
    decalages, centres, rayon = _mondes()
    points, vus = [], set()
    for a in reperes():
        t = _tags(a)
        pid = _valeur(t, "id") or _slug(a.get_actor_label())
        if pid in vus:
            dire("identifiant en double : %s — export ANNULE" % pid, fenetre=True)
            return
        vus.add(pid)
        v = a.get_actor_location()
        monde = _monde_de((v.x, v.y, v.z), decalages, centres, rayon)
        d = decalages.get(monde, (0.0, 0.0, 0.0))
        yaw = ((a.get_actor_rotation().yaw + 180.0) % 360.0) - 180.0
        r = _valeur(t, "rayon")
        p = {"id": pid, "nom": a.get_actor_label()[:NOM_MAX] or pid, "monde": monde,
             "x": v.x - d[0], "y": v.y - d[1], "z": v.z - d[2], "yaw": yaw,
             "rayon": max(RAYON_MIN, min(RAYON_MAX, float(r))) if r else RAYON_DEFAUT}
        if _valeur(t, "vers"):
            p["vers"] = _valeur(t, "vers")
        elif _valeur(t, "dest"):
            m, x, y, z, w = _valeur(t, "dest").split(",")
            p["dest"] = {"monde": m, "x": int(x), "y": int(y), "z": int(z), "yaw": int(w)}
        points.append(p)
    pendants = [p["id"] for p in points if p.get("vers") and p["vers"] not in vus]
    for p in points:
        if p.get("vers") in pendants:
            p.pop("vers")
    n = ecrire_catalogue(points)
    dire("%d point(s) exportes vers %s%s" % (n, CATALOGUE.rsplit("/", 1)[1],
         (" ; liens pendants retires : %s" % pendants) if pendants else ""), fenetre=True)


# ── Le menu ──────────────────────────────────────────────────────────────────

ENTREES = (
    ("tp_placer", "Placer les points depuis le jeu", "tp_placer_depuis_jeu"),
    ("tp_creer", "Créer un point devant la caméra", "tp_creer_a_la_camera"),
    ("tp_relier", "Relier les deux points sélectionnés", "tp_relier_selection"),
    ("tp_lister", "Lister les points du niveau", "tp_lister"),
    ("tp_exporter", "Exporter vers le jeu (Teleports.lua)", "tp_exporter"),
)


def enregistrer_menu():
    menus = unreal.ToolMenus.get()
    principal = menus.find_menu("LevelEditor.MainMenu")
    narvos = principal.add_sub_menu("LevelEditor.MainMenu", "Narvos", "Narvos", "NARVOS", "Outils NARVOS")
    narvos.add_section("PointsTP", "Points de TP")
    for nom, libelle, fonction in ENTREES:
        e = unreal.ToolMenuEntry(name=nom, type=unreal.MultiBlockType.MENU_ENTRY)
        e.set_label(libelle)
        e.set_string_command(unreal.ToolMenuStringCommandType.PYTHON, "",
                             "exec(open(r'%s', encoding='utf-8').read()); %s()" % (SCRIPT, fonction))
        narvos.add_menu_entry("PointsTP", e)
    menus.refresh_all_widgets()
    dire("menu NARVOS > Points de TP enregistre (%d entrees)" % len(ENTREES))