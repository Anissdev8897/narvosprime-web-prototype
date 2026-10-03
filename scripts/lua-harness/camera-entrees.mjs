// Exécute les vrais callbacks Client/Index.lua avec les arguments de l'API nanos.
// Ferme les régressions observées le 14/09 : X utilisé comme cran de molette,
// zoom sous un menu et HUD visible pendant la création.
import fs from 'node:fs';
import { LuaFactory } from 'wasmoon';

const source = fs.readFileSync(new URL('../../WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/Index.lua', import.meta.url), 'utf8');
function callbacks(event, count) {
  const pattern = new RegExp(`Input\\.Subscribe\\("${event}", function\\([^]*?^end\\)`, 'gm');
  const matches = [...source.matchAll(pattern)].map(m => m[0]);
  if (matches.length !== count) throw new Error(`${event}: ${matches.length} callbacks, ${count} attendus pour couvrir chaque gestionnaire`);
  return matches;
}
function fonction(name) {
  const match = source.match(new RegExp(`local function ${name}\\([^]*?^end$`, 'm'));
  if (!match) throw new Error(`Fonction de production absente : ${name}`);
  return match[0];
}
const [zoomJeu, zoomCreation] = callbacks('MouseScroll', 2);
const [rotation] = callbacks('MouseMove', 1);
const constructor = source.match(/^local HUD = WebUI\([^\n]+/m)?.[0];
if (!constructor) throw new Error('Constructeur HUD absent');
const lua = await new LuaFactory().createEngine();
try {
  await lua.doString(`
local reussis = 0
local function egal(a, b, message)
  assert(a == b, message .. ' : obtenu=' .. tostring(a) .. ', attendu=' .. tostring(b))
  reussis = reussis + 1
end
local handlers = {}
Input = { Subscribe = function(n, f) handlers[n] = f end, SetMouseEnabled = function() end }
local creation_ouverte = false
local function CreationOuverte() return creation_ouverte end
local panneau, menu_emotes_ouvert, roue_ouverte = nil, false, false
local deplacement = 0
local function Zoomer(delta) deplacement = deplacement + delta end
do
  local PAS_ZOOM = 150
  ${zoomJeu}
end
local zoom = handlers.MouseScroll
zoom(900, 400, 1)
egal(deplacement, -150, 'zoom avant utilise le cran, pas la coordonnee X')
zoom(10, 980, -1)
egal(deplacement, 0, 'zoom arriere independant de la position du curseur')
zoom(900, 400, 0)
egal(deplacement, 0, 'cran nul ne deplace pas la camera')
creation_ouverte = true; zoom(900, 400, 1)
egal(deplacement, 0, 'creation ne zoome pas le monde')
creation_ouverte = false; panneau = 'inventaire'; zoom(900, 400, 1)
egal(deplacement, 0, 'inventaire conserve sa molette')
panneau = nil; menu_emotes_ouvert = true; zoom(900, 400, 1)
egal(deplacement, 0, 'menu emotes conserve sa molette')
menu_emotes_ouvert = false; roue_ouverte = true; zoom(900, 400, 1)
egal(deplacement, 0, 'roue conserve sa molette')
roue_ouverte = false

local poses = 0
local orbite = { active = true, survol_ui = false, distance = 300, yaw = 180, pitch = -3, tourne = false }
local DIST_MIN, DIST_MAX, PAS_ZOOM, SENSIBILITE = 90, 700, 28, 0.45
local function PoserCamera() poses = poses + 1 end
${zoomCreation}
handlers.MouseScroll(900, 400, 1)
egal(orbite.distance, 272, 'creation avance de 28, pas jusqu a la butee')
handlers.MouseScroll(20, 800, -1)
egal(orbite.distance, 300, 'creation recule quel que soit le curseur')
orbite.survol_ui = true; handlers.MouseScroll(900, 400, 1)
egal(orbite.distance, 300, 'liste UI ne zoome pas le personnage')
orbite.survol_ui = false; orbite.active = false; handlers.MouseScroll(900, 400, 1)
egal(orbite.distance, 300, 'orbite inactive reste inerte')
orbite.active = true; handlers.MouseScroll(900, 400, 100)
egal(orbite.distance, 90, 'distance minimale')
handlers.MouseScroll(900, 400, -100)
egal(orbite.distance, 700, 'distance maximale')

${rotation}
handlers.MouseMove(20, 20, 900, 400)
egal(orbite.yaw, 180, 'rotation sans bouton inerte')
orbite.tourne = true; local avant = poses
handlers.MouseMove(20, 20, 900, 400)
egal(orbite.yaw, 189, 'rotation horizontale utilise delta X')
egal(orbite.pitch, 6, 'rotation verticale utilise delta Y')
egal(poses, avant + 1, 'une mise a jour pour les deux axes')
handlers.MouseMove(0, 1000, 0, 0); egal(orbite.pitch, 45, 'pitch maximal')
handlers.MouseMove(0, -1000, 0, 0); egal(orbite.pitch, -55, 'pitch minimal')

WidgetVisibility = { Hidden = 0, Visible = 1 }
local hud_detruit = false
WebUI = function(nom, chemin, visibilite)
  return { visibilite = visibilite,
    SetVisibility = function(self, v) self.visibilite = v end,
    BringToFront = function() end,
    Destroy = function() if nom == 'NARVOS HUD' then hud_detruit = true end end }
end
Chat = { SetVisibility = function() end }
local function FermerAutresMenus() end
local function Basculer() end
local function BrancherPage() end
local Creation = nil
${constructor}
${fonction('OuvrirCreation')}
${fonction('FermerCreation')}
egal(HUD.visibilite, WidgetVisibility.Hidden, 'HUD cache avant le premier etat serveur')
FermerCreation()
egal(HUD.visibilite, WidgetVisibility.Visible, 'session deja en jeu affiche le HUD sans page creation')
OuvrirCreation()
egal(HUD.visibilite, WidgetVisibility.Hidden, 'ouvrir creation cache le HUD')
OuvrirCreation()
egal(HUD.visibilite, WidgetVisibility.Hidden, 'ouvrir deux fois reste cache')
FermerCreation()
egal(HUD.visibilite, WidgetVisibility.Visible, 'entrer en jeu restaure le HUD')
egal(hud_detruit, false, 'le HUD et son etat sont conserves')
print(tostring(reussis) .. ' reussis, 0 echec(s)')
`);
} finally {
  lua.global.close();
}