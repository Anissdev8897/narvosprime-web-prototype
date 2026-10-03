-- ══════════════════════════════════════════════════════════════════════════════
-- sorts-tests.lua — assertions sur Shared/Logic/Sorts.lua.
-- Chargé par sorts.mjs, qui fournit `Sorts` et le global `Narvos`
-- (Spells, Classes, Vfx).
-- ══════════════════════════════════════════════════════════════════════════════

local reussis, echecs = 0, 0

local function ok(condition, nom)
    if (condition) then reussis = reussis + 1
    else echecs = echecs + 1 print("  ECHEC  " .. nom) end
end

local function egal(obtenu, attendu, nom)
    if (obtenu == attendu) then reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom .. "  obtenu=" .. tostring(obtenu) .. "  attendu=" .. tostring(attendu))
    end
end

local function section(nom) print("[" .. nom .. "]") end

-- ══════════════════════════════════════════════════════════════════════════════
-- COHERENCE DES CATALOGUES
--
-- C'est la partie qui rapporte le plus. Un sort dont l'element n'a pas de table
-- d'effets, ou dont l'effet a disparu du pack de base, ne LEVE PAS : il part
-- sans rien afficher. Le joueur croit que la touche n'a pas repondu.
-- ══════════════════════════════════════════════════════════════════════════════

section("coherence catalogue")

ok(#Narvos.Spells.SPELL_CATALOG > 0, "le catalogue de sorts n'est pas vide")
ok(#Narvos.Vfx.EFFETS > 0, "le catalogue d'effets n'est pas vide")

for _, s in ipairs(Narvos.Spells.SPELL_CATALOG) do
    -- La classe du sort doit exister, sinon aucun personnage ne peut le lancer.
    ok(Narvos.Classes.CLASSES[s.classId] ~= nil,
        "classe connue pour " .. s.id .. " : " .. tostring(s.classId))

    -- L'element doit avoir sa table d'effets. Sans elle, `PourElement` retombe
    -- sur `light` et tous les sorts d'un element se mettent a rendre la meme
    -- lumiere blanche — un bug purement visuel, donc invisible aux tests
    -- fonctionnels.
    ok(Narvos.Vfx.PAR_ELEMENT[s.element] ~= nil,
        "element avec effets : " .. s.id .. " = " .. tostring(s.element))
end

-- ⚠ CHAQUE EFFET REFERENCE DOIT EXISTER. `Vfx.Asset` rend nil sur un inconnu, et
-- `Sorts.Plan` laisse alors le champ a nil : le sort part SANS particule. C'est
-- exactement le defaut silencieux que ce projet a deja paye trois fois
-- (67 animations mortes, 76 pieces trooper, 55 PNJ sans mesh).
for element, roles in pairs(Narvos.Vfx.PAR_ELEMENT) do
    for role, id in pairs(roles) do
        ok(Narvos.Vfx.Trouver(id) ~= nil,
            "effet present : " .. element .. "." .. role .. " = " .. tostring(id))
    end
end

egal(Narvos.Vfx.Asset("effet_inexistant"), nil, "asset inconnu rend nil")
ok(Narvos.Vfx.Asset(Narvos.Vfx.EFFETS[1].id):find("nanos-world::", 1, true) == 1,
    "l'asset porte le prefixe du pack de base")

-- Un element inconnu ne doit pas faire disparaitre le sort.
ok(Narvos.Vfx.PourElement("element_inexistant") ~= nil, "element inconnu : repli")
ok(Narvos.Vfx.PourElement(nil) ~= nil, "element nil : repli")

-- ── Barre de sorts ────────────────────────────────────────────────────────────

section("Barre")

local CLASSE = Narvos.Spells.SPELL_CATALOG[1].classId

local barre = Sorts.Barre(CLASSE)
egal(#barre, Sorts.EMPLACEMENTS, "la barre a toujours EMPLACEMENTS cases")

-- ⚠ Les cases vides valent `false`, pas `nil` : un `nil` disparaitrait de la
-- table et `#barre` ne dirait plus rien.
for i = 1, Sorts.EMPLACEMENTS do
    ok(barre[i] ~= nil, "case " .. i .. " presente (jamais nil)")
end

local liste = Sorts.ParClasse(CLASSE)
ok(#liste > 0, "la classe a au moins un sort")
egal(barre[1].id, liste[1].id, "ordre du catalogue conserve")

egal(#Sorts.ParClasse("classe_inexistante"), 0, "classe inconnue : aucun sort")
egal(#Sorts.ParClasse(nil), 0, "classe nil : aucun sort")

egal(Sorts.ParEmplacement(CLASSE, 1).id, liste[1].id, "emplacement 1")
egal(Sorts.ParEmplacement(CLASSE, 0), nil, "emplacement 0 refuse")
egal(Sorts.ParEmplacement(CLASSE, 99), nil, "emplacement hors barre refuse")
egal(Sorts.ParEmplacement(CLASSE, nil), nil, "emplacement nil refuse")
egal(Sorts.ParEmplacement(CLASSE, "2").id, liste[2].id, "emplacement en chaine accepte")

-- ── Etat de lancement ─────────────────────────────────────────────────────────

section("NouvelEtat")

local etat = Sorts.NouvelEtat(CLASSE)
egal(etat.class_id, CLASSE, "la classe est retenue")
egal(etat.mana, etat.mana_max, "on demarre plein")
egal(etat.mana_max, Narvos.Classes.CLASSES[CLASSE].baseStats.mana,
    "le mana vient des statistiques de la classe")
egal(Sorts.ManaMax("classe_inexistante"), 100, "classe inconnue : repli a 100")

-- ── Lancement ─────────────────────────────────────────────────────────────────

section("PeutLancer / Lancer")

local SORT = liste[1]
local e = Sorts.NouvelEtat(CLASSE)

egal(select(1, Sorts.PeutLancer(e, SORT.id, 0)), true, "premier lancement possible")
egal(select(1, Sorts.PeutLancer(e, "sort_inexistant", 0)), false, "sort inconnu refuse")
egal(select(1, Sorts.PeutLancer(e, nil, 0)), false, "sort nil refuse sans lever")
egal(select(1, Sorts.PeutLancer(nil, SORT.id, 0)), false, "etat absent refuse sans lever")

-- ⚠ LE CONTROLE DE PROPRIETE. `sort_id` arrive du client : sans cette regle, un
-- soigneur lancerait le barrage plasma du DPS.
local autre = nil
for _, s in ipairs(Narvos.Spells.SPELL_CATALOG) do
    if (s.classId ~= CLASSE) then autre = s break end
end
ok(autre ~= nil, "il existe un sort d'une autre classe pour le test")
egal(select(1, Sorts.PeutLancer(e, autre.id, 0)), false, "sort d'une autre classe refuse")

local lance, raison, plan = Sorts.Lancer(e, SORT.id, 100)
egal(lance, true, "lancement accepte")
egal(raison, nil, "aucune raison d'echec")
ok(plan ~= nil, "un plan est rendu")
egal(plan.sort_id, SORT.id, "le plan designe le bon sort")

egal(e.mana, etat.mana_max - SORT.manaCost, "le mana est consomme")

-- ── Recharge ──────────────────────────────────────────────────────────────────

section("recharge")

if (SORT.cooldown > 0) then
    egal(select(1, Sorts.PeutLancer(e, SORT.id, 100)), false, "refuse pendant la recharge")
    ok(Sorts.Restant(e, SORT.id, 100) > 0, "restant positif pendant la recharge")

    -- Juste avant la fin : encore refuse.
    egal(select(1, Sorts.PeutLancer(e, SORT.id, 100 + SORT.cooldown - 0.01)), false,
        "refuse juste avant la fin")

    -- Exactement a la fin : accepte. La borne compte — un `<` au lieu d'un `<=`
    -- laisserait la derniere fraction de seconde bloquee pour toujours si le pas
    -- de temps tombait pile dessus.
    e.mana = e.mana_max
    egal(select(1, Sorts.PeutLancer(e, SORT.id, 100 + SORT.cooldown)), true,
        "accepte a la fin de la recharge")
    egal(Sorts.Restant(e, SORT.id, 100 + SORT.cooldown), 0, "restant nul a la fin")
else
    ok(true, "sort sans recharge : rien a verifier")
    ok(true, "sort sans recharge : rien a verifier")
    ok(true, "sort sans recharge : rien a verifier")
    ok(true, "sort sans recharge : rien a verifier")
    ok(true, "sort sans recharge : rien a verifier")
end

egal(Sorts.Restant(e, "jamais_lance", 100), 0, "sort jamais lance : restant nul")
egal(Sorts.Restant(nil, SORT.id, 100), 0, "etat nil : restant nul sans lever")
egal(Sorts.Restant(e, SORT.id, nil), 0, "instant nil : restant nul sans lever")

-- ── Mana ──────────────────────────────────────────────────────────────────────

section("mana")

local pauvre = Sorts.NouvelEtat(CLASSE)
pauvre.mana = 0
egal(select(1, Sorts.PeutLancer(pauvre, SORT.id, 0)), false, "mana insuffisant refuse")

-- La regeneration ne doit jamais depasser le plafond : une jauge a 103 % se voit.
pauvre.mana = pauvre.mana_max - 1
Sorts.Regenerer(pauvre, 10000)
egal(pauvre.mana, pauvre.mana_max, "la regeneration plafonne au maximum")

pauvre.mana = 10
Sorts.Regenerer(pauvre, 0)
egal(pauvre.mana, 10, "pas de temps nul : rien ne bouge")
Sorts.Regenerer(pauvre, -5)
egal(pauvre.mana, 10, "pas de temps negatif : rien ne bouge")
Sorts.Regenerer(nil, 1)
ok(true, "Regenerer(nil) ne leve pas")

-- Le mana ne descend jamais sous zero, meme si un cout depassait la reserve.
local ric = Sorts.NouvelEtat(CLASSE)
ric.mana = SORT.manaCost
Sorts.Lancer(ric, SORT.id, 0)
ok(ric.mana >= 0, "le mana ne passe jamais sous zero")

-- ── Mise en scene ─────────────────────────────────────────────────────────────

section("Plan")

-- ⚠ CHAQUE ARCHETYPE DOIT PRODUIRE AU MOINS UN EFFET. Un plan entierement vide
-- donne un sort qui consomme du mana et n'affiche rien : indistinguable d'une
-- touche qui n'a pas repondu.
for _, s in ipairs(Narvos.Spells.SPELL_CATALOG) do
    local p = Sorts.Plan(s)
    ok(p.vfx_lanceur ~= nil or p.vfx_voyage ~= nil or p.vfx_impact ~= nil,
        "au moins un effet pour " .. s.id .. " (" .. tostring(s.archetype) .. ")")
    egal(p.element, s.element, "element reporte : " .. s.id)
    egal(p.degats, s.damage, "degats reportes : " .. s.id)
    -- ⚠ TOUT sort porte un geste. Un lanceur immobile pendant que la particule
    -- part se lit comme un bug, pas comme un style.
    ok(p.geste ~= nil, "un geste pour " .. s.id)
end

-- ── LES GESTES EXISTENT-ILS DANS LE PACK ? ────────────────────────────────────
--
-- LE test qui compte : `PlayAnimation` sur une animation absente echoue EN
-- SILENCE. Un nom mal orthographie donnerait douze sorts sans geste, et rien
-- dans le journal. On oppose donc les gestes au catalogue des animations cuites.
local cuites = {}
for _, nom in ipairs(Narvos.Animations.NOMS) do cuites[nom] = true end
ok(next(cuites) ~= nil, "le catalogue d animations n est pas vide")

for archetype, chemin in pairs(Sorts.GESTES) do
    local nu = chemin:match("::(.+)$") or chemin
    ok(cuites[nu] == true, "le geste de " .. archetype .. " est cuit (" .. nu .. ")")
    ok(chemin:match("^narvos::") ~= nil, "le geste de " .. archetype .. " porte son prefixe de pack")
end

-- Les gestes ARME EN MAIN (2026-09-15) : memes exigences, pour chaque prise.
for prise, jeu in pairs(Sorts.GESTES_ARME) do
    for archetype, chemin in pairs(jeu) do
        local nu = chemin:match("::(.+)$") or chemin
        ok(cuites[nu] == true, "geste arme " .. prise .. "/" .. archetype .. " cuit (" .. nu .. ")")
        ok(chemin:match("^narvos::") ~= nil, "geste arme " .. prise .. "/" .. archetype .. " prefixe")
    end
    for _, archetype in ipairs({ "projectile", "aoe", "buff", "shield", "basic" }) do
        ok(type(jeu[archetype]) == "string", "prise " .. prise .. " : un geste pour " .. archetype)
    end
end
egal(Sorts.Prise(0), "une_main", "prise : arme a une main")
egal(Sorts.Prise(1), "deux_mains", "prise : arme a deux mains")
egal(Sorts.Prise(2), "une_main", "prise : melee a une main")
egal(Sorts.Prise(3), "deux_mains", "prise : melee a deux mains")
egal(Sorts.Prise(4), nil, "prise : objet lance, pas de jeu d'arme")
egal(Sorts.Prise(nil), nil, "prise : rien en main")
egal(Sorts.GesteAvecArme("shield", "deux_mains"), "narvos::Rifle_HandSignal_Halt_Anim", "bouclier au fusil : paume en garde, PAS la pose de tir")
egal(Sorts.GesteAvecArme("projectile", "une_main"), "narvos::Pistol_HandSignal_Forward_Anim", "projectile au pistolet : la main designe")
egal(Sorts.GesteAvecArme("projectile", nil), Sorts.GESTES.projectile, "mains nues : geste d'origine")
egal(Sorts.GesteAvecArme("invente", "deux_mains"), Sorts.GESTES_ARME.deux_mains.basic, "archetype inconnu arme en main : basic du jeu")
egal(Sorts.GESTES.aoe, "narvos::AS_GroundTakedownPunch", "aoe : la sequence, pas le montage aux imports manquants")

-- Rythme : chaque geste employe a un delai de liberation borne et une vitesse positive.
local employes = {}
for _, g in pairs(Sorts.GESTES) do employes[g] = true end
for _, jeu in pairs(Sorts.GESTES_ARME) do for _, g in pairs(jeu) do employes[g] = true end end
for g in pairs(employes) do
    local vitesse, delai = Sorts.Rythme(g)
    ok(vitesse > 0, "rythme : vitesse positive pour " .. g)
    ok(delai >= 0 and delai <= Sorts.LIBERATION_MAX_MS, "rythme : delai borne pour " .. g .. " (" .. delai .. " ms)")
end
local v_signal, d_signal = Sorts.Rythme("narvos::Rifle_HandSignal_Forward_Anim")
egal(d_signal, math.floor(2.333 * 0.30 / 1.6 * 1000 + 0.5), "rythme : duree x liberation / vitesse")
egal(v_signal, 1.6, "rythme : vitesse de lecture du signal")
local v_def, d_def = Sorts.Rythme("narvos::geste_inconnu")
egal(v_def, 1.0, "rythme : geste inconnu lu a vitesse normale")
egal(d_def, 300, "rythme : geste inconnu libere a 300 ms")

-- Un archetype inconnu ne doit pas laisser le lanceur immobile.
egal(Sorts.Geste("archetype_invente"), Sorts.GESTES.basic, "un archetype inconnu retombe sur basic")
egal(Sorts.Geste(nil), Sorts.GESTES.basic, "un archetype nil retombe sur basic")
egal(Sorts.Geste(42), Sorts.GESTES.basic, "un archetype non-chaine retombe sur basic")

-- Les archetypes se distinguent : un projectile voyage, une zone se pose, un
-- buff reste sur le lanceur. Les confondre rendrait les douze sorts identiques.
for _, s in ipairs(Narvos.Spells.SPELL_CATALOG) do
    local p = Sorts.Plan(s)
    if (s.archetype == "projectile") then
        ok(p.vfx_voyage ~= nil, "projectile : un effet de voyage (" .. s.id .. ")")
    elseif (s.archetype == "buff" or s.archetype == "shield") then
        ok(p.vfx_lanceur ~= nil, "buff : un effet sur le lanceur (" .. s.id .. ")")
        ok(p.vfx_voyage == nil, "buff : rien ne voyage (" .. s.id .. ")")
    elseif (s.archetype == "aoe") then
        ok(p.vfx_impact ~= nil, "zone : un effet au point d'impact (" .. s.id .. ")")
    end
end

-- ── Effets 3D choisis sort par sort (2026-09-14) ──────────────────────────────

section("Effets 3D")

local ids_catalogue = {}
for _, s in ipairs(Narvos.Spells.SPELL_CATALOG) do
    ids_catalogue[s.id] = true
    -- Chaque sort du jeu a SES effets choisis : sans entree, il retombe sur ceux
    -- de son element dans le pack de base — un repli, pas un choix.
    ok(Sorts.EFFETS_3D[s.id] ~= nil, "effets 3D choisis pour " .. s.id)
    local e = Sorts.Effets(s)
    local n = #e.lanceur + #e.voyage + #e.impact + #e.zone + (e.aura and 1 or 0)
    ok(n > 0, "au moins un effet 3D pour " .. s.id)
    if (s.archetype == "projectile") then ok(#e.voyage > 0, "projectile : un effet qui voyage (" .. s.id .. ")") end
    if (s.archetype == "aoe") then ok(#e.zone > 0 or #e.impact > 0, "zone : un effet sur l'aire (" .. s.id .. ")") end
end

for id, roles in pairs(Sorts.EFFETS_3D) do
    ok(ids_catalogue[id] == true, "EFFETS_3D." .. id .. " designe un sort du catalogue (pas une entree perimee)")
    local e = Sorts.Effets({ id = id })
    local tous = {}
    for _, role in ipairs(Sorts.ROLES_EFFETS) do
        for _, effet in ipairs(e[role]) do tous[#tous + 1] = effet end
    end
    if (e.aura) then tous[#tous + 1] = e.aura end
    for _, effet in ipairs(tous) do
        local pack, cle = effet.asset:match("^([%w%-]+)::(.+)$")
        ok(pack == "narvos" or pack == "nanos-world", "prefixe de pack pour " .. effet.asset)
        -- Les cles narvos:: sont confrontees a Assets.toml par le verificateur ;
        -- celles du pack de base, ici, a Vfx.lua (cles du MANIFESTE).
        if (pack == "nanos-world") then
            ok(Narvos.Vfx.Trouver(cle) ~= nil, "cle du pack de base connue : " .. effet.asset)
        end
        ok(effet.echelle > 0, "echelle positive pour " .. effet.asset)
    end
end

-- Normalisation : chaine seule, table, duree et echelle invalides.
local e_norm = Sorts.Effets({ id = "tank_iron_wall" })
egal(e_norm.aura.echelle, 0.25, "aura : echelle reportee")
egal(e_norm.aura.duree_s, 10, "aura : duree reportee")
egal(e_norm.lanceur[1].echelle, 1, "effet ecrit en chaine : echelle 1")
egal(e_norm.lanceur[1].duree_s, nil, "effet ecrit en chaine : duree par defaut du serveur")

-- Repli : un sort sans choix prend les effets de son ELEMENT, par archetype.
local repli = Sorts.Effets({ id = "sort_invente", element = "fire", archetype = "projectile" })
egal(repli.voyage[1] and repli.voyage[1].asset, "nanos-world::" .. Narvos.Vfx.PAR_ELEMENT.fire.projectile, "repli projectile : boule de l'element")
ok(#repli.lanceur == 0 and repli.aura == nil, "repli projectile : rien sur le lanceur")
local repli_buff = Sorts.Effets({ element = "light", archetype = "buff" })
ok(#repli_buff.lanceur == 1 and #repli_buff.voyage == 0, "repli buff : un effet sur le lanceur, rien ne voyage")

-- Le plan porte les effets, et son resume reste lisible.
local plan_feu = Sorts.Plan(Sorts.Trouver and Sorts.Trouver("dps_fire_shot") or { id = "dps_fire_shot", archetype = "projectile", element = "fire" })
egal(plan_feu.vfx_voyage, "nanos-world::P_FXVariety_FireBall", "plan : premier effet de voyage en resume")
egal(#plan_feu.effets.voyage, 2, "plan : la boule et ses braises voyagent")

-- ── Vue du HUD ────────────────────────────────────────────────────────────────

section("VueBarre")

local vue = Sorts.VueBarre(Sorts.NouvelEtat(CLASSE), 0)
egal(#vue, Sorts.EMPLACEMENTS, "une entree par emplacement")
egal(vue[1].emplacement, 1, "l'emplacement est reporte")
egal(vue[1].pret, true, "pret a plein mana et sans recharge")
egal(#Sorts.VueBarre(nil, 0), 0, "etat nil : vue vide sans lever")

-- ── Icônes et trajet (2026-09-14) ──────────────────────────────────────────────
-- Les effets EN JEU sont des particules 3D ; les images web ne servent qu'aux
-- icônes. Le billboard 2D du même jour est retiré.

section("IconePage / TempsDeVol")

for _, s in ipairs(Narvos.Spells.SPELL_CATALOG) do
    local icone = Sorts.IconePage(s.id)
    -- Chaque sort du catalogue a SON icône : un emplacement sans image
    -- retomberait sur la lettre de repli, le défaut que ce chantier corrige.
    ok(type(icone) == "string" and icone == "img/sorts/" .. s.id .. ".png", "icone de page pour " .. s.id)
    local p = Sorts.Plan(s)
    ok(p.sprite == nil, "le plan ne porte plus de sprite 2D pour " .. s.id)
    ok((p.vitesse_cm_s or 0) > 0, "le plan porte une vitesse de vol pour " .. s.id)
end

ok(Sorts.Sprite == nil, "Sorts.Sprite retire (billboards 2D abandonnes)")
egal(Sorts.IconePage("sort_inexistant"), nil, "sort inconnu : pas d'icone")
egal(Sorts.IconePage(nil), nil, "id nil : pas d'icone")
egal(Sorts.TempsDeVol(0, 1400), Sorts.VOL_MIN_S, "vol borne en bas")
egal(Sorts.TempsDeVol(1400, 1400), 1, "1 400 cm a 14 m/s = 1 s")
egal(Sorts.TempsDeVol(99999, 1400), Sorts.VOL_MAX_S, "vol borne en haut")
egal(Sorts.TempsDeVol(900, 0), 900 / Sorts.VITESSE_DEFAUT_CM_S, "vitesse nulle : vitesse par defaut")
egal(Sorts.VueBarre(Sorts.NouvelEtat(CLASSE), 0)[1].icone, Sorts.IconePage(Sorts.Barre(CLASSE)[1].id),
     "la barre porte l'icone du sort")

-- ── Modificateurs du personnage (niveau, talents — 2026-09-13) ─────────────────

section("Moduler / Cout")

local neutre = Sorts.NouvelEtat(CLASSE)
egal(neutre.cout_mult, 1, "etat neuf : cout neutre")
egal(neutre.degats_mult, 1, "etat neuf : degats neutres")
egal(Sorts.Cout(neutre, SORT), math.floor((tonumber(SORT.manaCost) or 0) + 0.5), "cout neutre = cout du catalogue")

local module = Sorts.NouvelEtat(CLASSE)
module.mana = module.mana_max
Sorts.Moduler(module, { mana_max = 10, cout_mult = 0.5, regen_mult = 2, degats_mult = 1.5 })
egal(module.mana_max, 10, "Moduler pose le mana max")
egal(module.mana, 10, "le mana courant est BORNE au nouveau max, jamais rempli")
egal(Sorts.Cout(module, { manaCost = 15 }), 8, "cout x0.5 arrondi .5 vers le haut (7.5 -> 8)")
egal(Sorts.Cout(module, { manaCost = 25 }), 13, "cout x0.5 : 12.5 -> 13")

local haut = Sorts.NouvelEtat(CLASSE)
haut.mana = 5
Sorts.Moduler(haut, { mana_max = 500 })
egal(haut.mana, 5, "monter le max ne remplit pas la barre")
egal(haut.cout_mult, 1, "un multiplicateur absent retombe a 1")

-- Valeurs aberrantes : ignorees, jamais un cout negatif ou nul par multiplicateur.
local bizarre = Sorts.NouvelEtat(CLASSE)
Sorts.Moduler(bizarre, { cout_mult = -3, regen_mult = 0, degats_mult = "x" })
egal(bizarre.cout_mult, 1, "cout_mult negatif ignore")
egal(bizarre.regen_mult, 1, "regen_mult nul ignore")
egal(bizarre.degats_mult, 1, "degats_mult illisible ignore")

-- Le plan porte les degats modules, le reste du plan est celui du catalogue.
local lanceur = Sorts.NouvelEtat(CLASSE)
Sorts.Moduler(lanceur, { mana_max = 1000, degats_mult = 2 })
lanceur.mana = 1000
local okl, _, planl = Sorts.Lancer(lanceur, SORT.id, 0)
egal(okl, true, "lancement module possible")
egal(planl and planl.degats, (tonumber(SORT.damage) or 0) * 2, "degats du plan x degats_mult")
egal(lanceur.mana, 1000 - Sorts.Cout(lanceur, SORT), "le mana consomme est le cout MODULE")

-- La regeneration suit regen_mult.
local r1, r2 = Sorts.NouvelEtat(CLASSE), Sorts.NouvelEtat(CLASSE)
r1.mana, r2.mana = 0, 0
Sorts.Moduler(r2, { regen_mult = 2 })
Sorts.Regenerer(r1, 1)
Sorts.Regenerer(r2, 1)
ok(math.abs(r2.mana - 2 * r1.mana) < 1e-9, "regen_mult 2 regenere deux fois plus")

egal(Sorts.VueBarre(module, 0)[1] and Sorts.VueBarre(module, 0)[1].cout,
     Sorts.Cout(module, Sorts.Barre(CLASSE)[1]), "la barre affiche le cout module")

-- ── Bilan ─────────────────────────────────────────────────────────────────────
section("contrat 5 / 4 / 60 et refus sans consommation")
for _, sort in ipairs(Narvos.Spells.SPELL_CATALOG) do
    local attendu = ({ ["1"] = 5, ["2"] = 4, ["3"] = 60 })[sort.hotkey]
    egal(sort.cooldown, attendu, sort.id .. " recharge demandee")
    local etat = Sorts.NouvelEtat(sort.classId)
    etat.mana = 1000
    egal(select(1, Sorts.Lancer(etat, sort.id, 10)), true, sort.id .. " premier lancement")
    local mana = etat.mana
    egal(select(1, Sorts.Lancer(etat, sort.id, 10 + attendu - 0.001)), false, sort.id .. " pas avant echeance")
    egal(etat.mana, mana, sort.id .. " refus sans cout supplementaire")
    egal(select(1, Sorts.Lancer(etat, sort.id, 10 + attendu)), true, sort.id .. " disponible a echeance")
end

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
if (echecs > 0) then error(echecs .. " test(s) en echec") end