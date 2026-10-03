"""Prepare une restauration unique du brouillon local, sans creer de personnage."""
import json
from pathlib import Path
root = Path('E:/narvosprime-web-prototype')
draft = json.loads((root/'.hermes/ASTRA_creation_brouillon_20260915.json').read_text(encoding='utf-8-sig'))
script = """if (typeof OPTIONS !== 'undefined' && OPTIONS && SESSION.etat === 'selection' && !brouillon && !window.astraBrouillonRestaure) {
const sauvegarde = %s;
brouillon=sauvegarde.brouillon; morphs=sauvegarde.morphs; couleurs=sauvegarde.couleurs; etape=sauvegarde.etape;
window.astraBrouillonRestaure=true; rendreCreation(); majApercu(brouillon.genre,brouillon.tenue,brouillon.corps);
versLua('Astra:Restaure','brouillon restaure sans creation');
}""" % json.dumps(draft,ensure_ascii=True,separators=(',',':'))
lua = '''-- Diagnostic ponctuel, charge manuellement APRES l'arrivee en selection.
Timer.SetTimeout(function()
 for _,ui in pairs(WebUI.GetAll()) do
  if ui:GetName()=="NARVOS Creation" then
   ui:Subscribe("Astra:Restaure", function(message) Console.Log("[ASTRA] "..tostring(message)) end)
   ui:ExecuteJavaScript([==[%s]==])
  end
 end
end,1500)
''' % script
(Path('D:/steam/steamapps/common/nanos-world-playtest/Server/Packages/astra-mcs-diagnostic/Client/Index.lua')).write_text(lua,encoding='utf-8')
print('Restauration preparee ; aucun appel Create et aucune activation automatique.')