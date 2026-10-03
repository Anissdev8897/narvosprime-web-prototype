-- ══════════════════════════════════════════════════════════════════════════════
-- metahumain-bp-tests.lua — assertions sur Server/MetaHumainBP.lua.
-- Chargé par metahumain-bp.mjs, qui fournit `MetaHumainBP`, `VRAI_MODULAR`,
-- `DECLARES` (Blueprints d'Assets.toml) et `CHARGER` (recharge le module).
-- ══════════════════════════════════════════════════════════════════════════════

local reussis, echecs = 0, 0

local function ok(condition, nom)
    if (condition) then reussis = reussis + 1
    else echecs = echecs + 1; print("  ECHEC  " .. nom) end
end

local function egal(obtenu, attendu, nom)
    if (obtenu == attendu) then reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom .. "  obtenu=" .. tostring(obtenu) .. "  attendu=" .. tostring(attendu))
    end
end

local function section(nom) print("[" .. nom .. "]") end

--- Le nom nu d'une clé `narvos::X`.
local function nu(cle) return type(cle) == "string" and (cle:match("::(.+)$") or cle) or nil end

-- ── Le porteur vient du catalogue ─────────────────────────────────────────────

section("porteur lu dans le catalogue")

local homme = MetaHumainBP.PorteurDe("M")
local femme = MetaHumainBP.PorteurDe("F")
ok(homme ~= nil, "un porteur existe pour le genre M")
ok(femme ~= nil, "un porteur existe pour le genre F")

-- LE test qui aurait vu la table en dur : tout porteur rendu est DECLARE.
ok(homme ~= nil and DECLARES[nu(homme)] == true,
   "le porteur M est declare dans Assets.toml (" .. tostring(homme) .. ")")
ok(femme ~= nil and DECLARES[nu(femme)] == true,
   "le porteur F est declare dans Assets.toml (" .. tostring(femme) .. ")")

-- Et il est exactement celui que le catalogue donne au corps jouable du genre.
local attendu = { M = nil, F = nil }
for _, id in ipairs(VRAI_MODULAR.JOUABLES) do
    local c = VRAI_MODULAR.CORPS[id]
    if (c and c.blueprint and attendu[c.genre] == nil) then attendu[c.genre] = c.blueprint end
end
egal(homme, attendu.M, "le porteur M est le blueprint du premier corps jouable M")
egal(femme, attendu.F, "le porteur F est le blueprint du premier corps jouable F")

-- La casse ne doit rien changer : `/mhbp poser m` arrive en minuscule.
egal(MetaHumainBP.PorteurDe("m"), homme, "le genre en minuscule donne le meme porteur")

-- Sans genre, ou avec un genre inconnu, un porteur jouable quand meme — jamais
-- une cle inventee.
local sans = MetaHumainBP.PorteurDe(nil)
local inconnu = MetaHumainBP.PorteurDe("X")
ok(sans ~= nil and DECLARES[nu(sans)] == true, "sans genre : un porteur declare")
ok(inconnu ~= nil and DECLARES[nu(inconnu)] == true, "genre inconnu : repli sur un porteur declare")

-- ── Aucune table en dur ne survit ─────────────────────────────────────────────

section("plus de table recopiee")

egal(MetaHumainBP.PORTEURS, nil, "la table PORTEURS ecrite en dur n existe plus")

-- ── Poser, retirer, cacher : le porteur n'est jamais laisse invisible ─────────
--
-- Deux defauts du 2026-09-13 (rapport Fable) : `Retirer` et `Cacher` passaient
-- un vecteur d'« echelle » comme POSITION relative, avec `false` dans les deux
-- sens — quitter un corps MetaHuman laissait un personnage INVISIBLE ; et le
-- retour d'`AttachTo` n'etait jamais lu.

section("poser / retirer / cacher")

local journal = {}
Console = {
    Log = function(m) journal[#journal + 1] = m end,
    Warn = function(m) journal[#journal + 1] = "W:" .. m end,
    Error = function(m) journal[#journal + 1] = "E:" .. m end,
}
Vector = function(x, y, z) return { X = x, Y = y, Z = z } end
AttachmentRule = { SnapToTarget = "snap" }
CollisionType = { NoCollision = "aucune" }
local REPONSE_ATTACHE = true
local spawnes = {}
Blueprint = function(_, _, chemin)
    local bp = { chemin = chemin, detruit = false }
    function bp:IsValid() return not self.detruit end
    function bp:Destroy() self.detruit = true end
    function bp:AttachTo(autre, regle, os, vie) self.attache = { autre = autre, regle = regle, os = os, vie = vie }; return REPONSE_ATTACHE end
    spawnes[#spawnes + 1] = bp
    return bp
end
local function FauxPerso()
    local p = { mesh = {} }
    function p:IsValid() return true end
    function p:GetLocation() return {} end
    function p:GetRotation() return {} end
    function p:SetMeshSettings(loc, rot, visible) self.mesh[#self.mesh + 1] = { loc = loc, visible = visible } end
    return p
end
local function Journalise(motif)
    for _, l in ipairs(journal) do if (l:find(motif, 1, true)) then return true end end
    return false
end

local constructeur = { masques = 0, rendus = 0 }
function constructeur.MasquerPorteur() constructeur.masques = constructeur.masques + 1; return "materiau" end
function constructeur.RendrePorteur() constructeur.rendus = constructeur.rendus + 1 end
Narvos.CharacterBuilder = constructeur
local MHBP = CHARGER()

local perso = FauxPerso()
local okPose = MHBP.Poser(perso, "M", "narvos::BP_Essai")
ok(okPose, "Poser rend true")
ok(spawnes[1] and spawnes[1].attache and spawnes[1].attache.os == "root", "le Blueprint est attache a l'os root du personnage")
ok(Journalise("attached=true"), "le retour d'AttachTo est JOURNALISE")

MHBP.Poser(perso, "M", "narvos::BP_Essai2")
ok(spawnes[1].detruit, "reposer detruit l'ancien Blueprint")
egal(constructeur.rendus, 0, "reposer ne REND PAS le porteur (il resterait visible sous le nouveau MetaHuman)")

egal(MHBP.Retirer(perso), true, "Retirer rend true quand un Blueprint etait pose")
ok(spawnes[2].detruit, "Retirer detruit le Blueprint")
egal(constructeur.rendus, 1, "Retirer REND le porteur (sinon personnage invisible)")
egal(MHBP.Retirer(perso), false, "Retirer sans Blueprint rend false")
egal(constructeur.rendus, 1, "Retirer sans Blueprint ne touche pas au mesh")

MHBP.Poser(perso, "F", "narvos::BP_Essai3")
ok(MHBP.Cacher(perso, true), "Cacher(true) passe")
egal(constructeur.masques, 1, "Cacher(true) passe par la methode COMMUNE MasquerPorteur")
local pose, cache = MHBP.Etat(perso)
ok(pose and cache, "Etat : pose et cache")
ok(MHBP.Cacher(perso, false), "Cacher(false) passe")
egal(constructeur.rendus, 2, "Cacher(false) rend le porteur")

REPONSE_ATTACHE = false
MHBP.Poser(perso, "M", "narvos::BP_Essai4")
ok(Journalise("E:[MHBP] AttachTo a ECHOUE"), "un AttachTo refuse est une ERREUR journalisee")
REPONSE_ATTACHE = true

-- Sans constructeur : repli, et le mesh est rendu VISIBLE a sa position d'origine.
Narvos.CharacterBuilder = nil
local seul = FauxPerso()
MHBP.Poser(seul, "M", "narvos::BP_Essai5")
MHBP.Retirer(seul)
local dernier = seul.mesh[#seul.mesh]
ok(dernier and dernier.visible == true, "repli : Retirer rend le mesh VISIBLE")
ok(dernier and dernier.loc.X == 0 and dernier.loc.Y == 0 and dernier.loc.Z == 0,
   "repli : position relative (0, 0, 0), pas un vecteur d'echelle")
Narvos.CharacterBuilder = constructeur

-- ── Un personnage détruit emporte son MetaHuman (2026-09-14) ─────────────────

section("destruction du personnage")

local detruit_perso = FauxPerso()
MHBP.Poser(detruit_perso, "F", "narvos::BP_Essai6")
local bp6 = spawnes[#spawnes]
egal(bp6.attache and bp6.attache.vie, 0, "AttachTo : duree de vie 0 une fois detache (detruit avec le porteur)")
ok(type(ABONNEMENTS_CHARACTER.Destroy) == "function", "abonne a Character Destroy")
ABONNEMENTS_CHARACTER.Destroy(detruit_perso)
ok(bp6.detruit, "Destroy du personnage : son MetaHuman est detruit (plus d'orphelin superpose)")
local pose_apres = MHBP.Etat(detruit_perso)
egal(pose_apres, false, "Destroy du personnage : plus rien de pose pour lui")
ABONNEMENTS_CHARACTER.Destroy(FauxPerso())
ok(true, "Destroy d'un personnage sans MetaHuman ne leve rien")

-- ── Catalogue absent : nil, pas d'erreur ──────────────────────────────────────

section("catalogue absent")

local sauve = Narvos
Narvos = {}
local isole = CHARGER()
egal(isole.PorteurDe("M"), nil, "sans Narvos.Modular, aucun porteur")
Narvos = { Modular = { JOUABLES = { "x" }, CORPS = { x = { genre = "M" } } } }
egal(isole.PorteurDe("M"), nil, "un corps jouable SANS blueprint ne donne aucun porteur")
Narvos = sauve

print("")
print(reussis .. " reussis, " .. echecs .. " echec(s)")
if (echecs > 0) then error(echecs .. " test(s) en echec") end