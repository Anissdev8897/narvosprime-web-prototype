# -*- coding: utf-8 -*-
# init_unreal.py — exécuté par le PythonScriptPlugin à chaque démarrage de
# l'éditeur (tout fichier de ce nom dans un Content/Python du projet).
#
# Il ne fait qu'UNE chose : enregistrer le menu NARVOS (points de téléportation)
# écrit dans scripts/adk-menu-narvos.py. Isolé par try : un script d'outillage qui
# échoue ne doit JAMAIS empêcher l'éditeur de s'ouvrir — il le dit dans le journal.
#
# Rien ici n'est cuit : le cooker ignore les .py, et le pack nanos ne livre que
# les .uasset cuits.
import unreal

_SCRIPT = "D:/mes_projet/narvosprime-web-prototype/scripts/adk-menu-narvos.py"

try:
    with open(_SCRIPT, encoding="utf-8") as _f:
        _code = _f.read()
    _espace = {"__name__": "adk_menu_narvos"}
    exec(compile(_code, _SCRIPT, "exec"), _espace)
    _espace["enregistrer_menu"]()
except Exception as _e:
    unreal.log_warning("[NARVOS] menu non enregistre : %s" % _e)