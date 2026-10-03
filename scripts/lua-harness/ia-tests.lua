-- ══════════════════════════════════════════════════════════════════════════════
-- ia-tests.lua — assertions sur Shared/Logic/Ia.lua.
-- Charge par ia.mjs, qui fournit `Ia`, le global `Narvos` (Spawnables, Npc) et
-- un `Vector` reduit.
--
-- Tout est deterministe : le temps est un parametre, et chaque etat de test
-- recoit une source d'aleatoire injectee. Aucun test ne depend de l'heure, de
-- l'ordre de `pairs`, ni d'un `math.randomseed`.
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

-- Outils de scenario ---------------------------------------------------------

local function pos(x, y, z) return { x = x, y = y, z = z or 0 } end

--- Etat de test : aleatoire fige a 0, donc phase initiale nulle et attente
--- minimale. Les tests qui portent sur l'aleatoire l'injectent autrement.
local function nouveau(profil, opts)
    local o = opts or {}
    o.alea = o.alea or function() return 0 end
    o.maintenant_ms = o.maintenant_ms or 0
    return Ia.NouvelEtat(profil, o)
end

local function monde(x, y, cibles, vie, vie_max)
    return { position = pos(x, y, 0), cibles = cibles, vie = vie, vie_max = vie_max }
end

-- ══════════════════════════════════════════════════════════════════════════════
-- COHERENCE AVEC LES CATALOGUES REELS
--
-- C'est la partie qui rapporte le plus. Un role qui ne trouve pas son profil ne
-- LEVE PAS : il retombe sur `passif`, et le monstre reste planté — exactement le
-- symptome que ce module est cense supprimer.
-- ══════════════════════════════════════════════════════════════════════════════

section("coherence catalogues")

ok(#Narvos.Spawnables.ENTREES > 0, "le catalogue d'invocables n'est pas vide")
ok(#Narvos.Npc.NPC_CATALOG > 0, "le catalogue de PNJ n'est pas vide")

-- Chaque role du catalogue que Spawner manipule doit tomber sur un vrai profil.
for _, e in ipairs(Narvos.Spawnables.ENTREES) do
    local p = Ia.ProfilPourRole(e.role)
    ok(Ia.PROFILS[p] ~= nil, "profil connu pour " .. e.id .. " (role " .. tostring(e.role) .. ")")
end

for _, r in ipairs(Narvos.Spawnables.ROLES) do
    ok(Ia.PROFIL_PAR_ROLE[r.id] ~= nil, "role du menu couvert explicitement : " .. r.id)
end

-- ⚠ LE VOCABULAIRE ANGLAIS DE Npc.lua AUSSI. Les deux catalogues divergent, et
-- c'est la seule chose qui empeche `ally` de retomber en silence sur le defaut.
for _, n in ipairs(Narvos.Npc.NPC_CATALOG) do
    ok(Ia.PROFIL_PAR_ROLE[n.role] ~= nil,
        "role anglais couvert : " .. n.folder .. " = " .. tostring(n.role))
end

-- ⚠ LE CROISEMENT QUI COMPTE : ce que le catalogue declare hostile doit recevoir
-- un profil AGRESSIF, et rien d'autre ne doit en recevoir un. Sans lui, un
-- marchand pourrait charger les joueurs, ou un monstre rester inerte.
for _, e in ipairs(Narvos.Spawnables.ENTREES) do
    local hostile = Narvos.Spawnables.EstHostile(e.id)
    local profil = Ia.PROFILS[Ia.ProfilPourRole(e.role)]
    egal(profil.agressif, hostile, "agressivite conforme au catalogue : " .. e.id)
end

egal(Ia.ProfilPourRole("role_inexistant"), Ia.PROFIL_DEFAUT, "role inconnu : profil par defaut")
egal(Ia.ProfilPourRole(nil), Ia.PROFIL_DEFAUT, "role nil : profil par defaut sans lever")
egal(Ia.ProfilPourRole(42), Ia.PROFIL_DEFAUT, "role numerique : profil par defaut sans lever")
egal(Ia.PROFILS[Ia.PROFIL_DEFAUT].agressif, false, "le profil par defaut n'attaque pas")

-- ── Forme des profils ────────────────────────────────────────────────────────

section("profils")

egal(#Ia.PROFILS_ORDRE, 3, "la sequence de profils couvre le catalogue")
for _, id in ipairs(Ia.PROFILS_ORDRE) do
    ok(Ia.PROFILS[id] ~= nil, "profil de la sequence present : " .. id)
end
-- L'inverse aussi : un profil ajoute sans etre inscrit dans la sequence serait
-- invisible a tout parcours ordonne.
local n_profils = 0
for _ in pairs(Ia.PROFILS) do n_profils = n_profils + 1 end
egal(n_profils, #Ia.PROFILS_ORDRE, "aucun profil hors de la sequence")

for _, id in ipairs(Ia.PROFILS_ORDRE) do
    local p = Ia.PROFILS[id]
    ok(p.portee_abandon >= p.portee_detection, "on lache plus loin qu'on n'accroche : " .. id)
    ok(p.portee_attaque <= p.portee_detection, "on frappe plus pres qu'on ne detecte : " .. id)
    ok(p.seuil_repli >= 0 and p.seuil_repli < 1, "seuil de repli dans [0,1[ : " .. id)
    ok(p.cadence_ms > 0, "cadence strictement positive : " .. id)
    ok(p.repos_max_ms >= p.repos_min_ms, "fourchette de repos coherente : " .. id)
end

egal(Ia.Profil("inexistant"), Ia.PROFILS[Ia.PROFIL_DEFAUT], "profil inconnu : repli")
egal(Ia.Profil(nil), Ia.PROFILS[Ia.PROFIL_DEFAUT], "profil nil : repli sans lever")

-- ══════════════════════════════════════════════════════════════════════════════
-- CREATION D'UN ETAT
-- ══════════════════════════════════════════════════════════════════════════════

section("NouvelEtat")

local e = nouveau("patrouilleur")
egal(e.profil, "patrouilleur", "le profil est retenu")
egal(e.etat, "repos", "on demarre au repos")
egal(e.cible_id, false, "aucune cible au depart")
egal(e.ancre, false, "sans ancre : false, jamais un point par defaut")
egal(e.faction, false, "sans faction : false")
egal(#e.route, 0, "sans route : sequence vide")

egal(nouveau("profil_inexistant").profil, Ia.PROFIL_DEFAUT, "profil inconnu : repli au defaut")

-- ⚠ TOUTES LES CLES DE L'INTENTION SONT PRESENTES DES LA CREATION : un champ a
-- `nil` disparait de la table, et l'executant ne distinguerait plus une case
-- videe d'une case jamais ecrite.
local i0 = e.intention
for _, cle in ipairs({ "type", "etat", "cible_id", "x", "y", "z", "urgence" }) do
    ok(i0[cle] ~= nil, "champ d'intention present des la creation : " .. cle)
end

-- L'ancre accepte la forme du moteur (majuscules) comme celle des tests.
local avec_ancre = nouveau("patrouilleur", { ancre = Vector(10, 20, 30) })
egal(avec_ancre.ancre.x, 10, "ancre lue depuis un Vector nanos (X)")
egal(avec_ancre.ancre.z, 30, "ancre lue depuis un Vector nanos (Z)")

-- La route est recopiee en sequence dense : les entrees illisibles sautent.
local avec_route = nouveau("patrouilleur", {
    route = { pos(0, 0), { x = 1 }, Vector(100, 0, 0), "pas un point" },
})
egal(#avec_route.route, 2, "route densifiee : les points illisibles sont ecartes")
egal(avec_route.route[2].x, 100, "un Vector nanos est un point de route valide")

egal(#nouveau("patrouilleur", { route = "pas une table" }).route, 0, "route invalide : vide")
egal(#nouveau("patrouilleur", { route = { pos(0, 0), nil, pos(5, 5) } }).route, 1,
    "un trou tronque la route, sans lever")

-- ── Cadence et etalement ─────────────────────────────────────────────────────

section("cadence")

-- Aleatoire fige a 0 : la phase initiale est nulle, donc la premiere decision
-- tombe pile a l'instant de creation.
egal(nouveau("patrouilleur", { maintenant_ms = 5000 }).prochain_ms, 5000,
    "alea nul : aucune phase")

-- ⚠ LE TEST QUI TIENT L'ARGUMENT DE COUT. Sans phase distincte par PNJ, les 400
-- decident sur le meme tick une fois sur six. On cree 30 etats SANS injecter
-- d'aleatoire : le generateur interne doit les repartir.
local vus, distincts = {}, 0
for _ = 1, 30 do
    local x = Ia.NouvelEtat("patrouilleur", { maintenant_ms = 0 }).prochain_ms
    if (not vus[x]) then vus[x] = true distincts = distincts + 1 end
end
ok(distincts >= 5, "les phases initiales s'etalent (" .. distincts .. " valeurs sur 30)")

local cadence = Ia.PROFILS.patrouilleur.cadence_ms
for _ = 1, 30 do
    local x = Ia.NouvelEtat("patrouilleur", { maintenant_ms = 0 }).prochain_ms
    ok(x >= 0 and x <= cadence, "la phase reste dans une periode")
end

-- Deux etats de meme graine sont identiques : le determinisme est reproductible
-- d'une VM a l'autre, ce que `math.random` n'aurait pas donne.
local g1 = Ia.NouvelEtat("patrouilleur", { graine = 12345, maintenant_ms = 0 })
local g2 = Ia.NouvelEtat("patrouilleur", { graine = 12345, maintenant_ms = 0 })
egal(g1.prochain_ms, g2.prochain_ms, "meme graine, meme phase")
egal(g1.attente_ms, g2.attente_ms, "meme graine, meme attente")

local c = nouveau("patrouilleur")
egal(Ia.DoitExaminer(c, 0), true, "l'examen est du a l'instant de creation")
local _, frais = Ia.Decider(c, monde(0, 0, {}), 0)
egal(frais, true, "premiere decision : fraiche")
egal(Ia.DoitExaminer(c, 0), false, "plus rien a examiner juste apres")
local _, frais2 = Ia.Decider(c, monde(0, 0, {}), 100)
egal(frais2, false, "avant la cadence : la decision precedente est rendue")
egal(select(2, Ia.Decider(c, monde(0, 0, {}), 200)), true, "a la cadence : nouvelle decision")

egal(Ia.DoitExaminer(nil, 0), false, "etat nil : rien a examiner, sans lever")
egal(Ia.DoitExaminer(c, "pas un nombre"), false, "instant illisible : sans lever")

-- Reveil hors cadence : le PNJ frappe ne doit pas attendre 200 ms.
local r = nouveau("patrouilleur")
Ia.Decider(r, monde(0, 0, {}), 0)
egal(Ia.DoitExaminer(r, 50), false, "sans reveil : rien avant la cadence")
Ia.Reveiller(r, 50)
egal(Ia.DoitExaminer(r, 50), true, "apres reveil : decision immediate")
Ia.Reveiller(nil, 0)
Ia.Reveiller(r, "abc")
ok(true, "Reveiller sur des entrees invalides ne leve pas")

-- ══════════════════════════════════════════════════════════════════════════════
-- CHOIX DE LA CIBLE
-- ══════════════════════════════════════════════════════════════════════════════

section("ChoisirCible")

local PP = Ia.PROFILS.patrouilleur
local vide = nouveau("patrouilleur")

egal(Ia.ChoisirCible(vide, Ia.PROFILS.passif, monde(0, 0, { { id = "a", position = pos(10, 0) } }), 0, 0, 0),
    nil, "un profil passif ne cible personne")
egal(Ia.ChoisirCible(vide, PP, monde(0, 0, nil), 0, 0, 0), nil, "sans liste : aucune cible")
egal(Ia.ChoisirCible(vide, PP, "pas une table", 0, 0, 0), nil, "monde illisible : aucune cible")
egal(Ia.ChoisirCible(vide, PP, monde(0, 0, {}), 0, 0, 0), nil, "liste vide : aucune cible")

local proche = { { id = "loin", position = pos(900, 0) }, { id = "pres", position = pos(300, 0) } }
egal(Ia.ChoisirCible(vide, PP, monde(0, 0, proche), 0, 0, 0).id, "pres", "la plus proche l'emporte")

-- ⚠ DEPARTAGE STABLE. A distance egale, l'ordre de parcours d'une table decide —
-- et il varie d'une VM a l'autre. Le plus petit identifiant tranche.
local ex_aequo = { { id = "zulu", position = pos(0, 500) }, { id = "alpha", position = pos(500, 0) } }
egal(Ia.ChoisirCible(vide, PP, monde(0, 0, ex_aequo), 0, 0, 0).id, "alpha", "egalite : plus petit id")

-- ⚠ DONNEES EXTERNES : rien de ce qui suit ne doit lever. `nil < 0` leve en Lua,
-- et une position absente ferait planter le calcul de distance.
local sales = {
    {},
    { id = 42 },
    { id = "sans_position" },
    { id = "position_vide", position = {} },
    { id = "mort", position = pos(10, 0), vie = 0 },
    { id = "negatif", position = pos(20, 0), vie = -5 },
    { id = "valide", position = pos(800, 0) },
}
local choisie = Ia.ChoisirCible(vide, PP, monde(0, 0, sales), 0, 0, 0)
ok(choisie ~= nil and choisie.id == "valide", "les entrees illisibles ou mortes sont ecartees")

-- Une cible sans PV est tenue pour vivante : c'est au serveur de les transmettre.
local sans_pv = { { id = "inconnu", position = pos(100, 0) } }
ok(Ia.ChoisirCible(vide, PP, monde(0, 0, sans_pv), 0, 0, 0) ~= nil, "cible sans vie : vivante")

-- Feu ami : on ne cible pas sa propre faction.
local allie = nouveau("patrouilleur", { faction = "zayan" })
local memes = { { id = "frere", position = pos(100, 0), faction = "zayan" } }
egal(Ia.ChoisirCible(allie, PP, monde(0, 0, memes), 0, 0, 0), nil, "meme faction : pas de cible")
local autres = { { id = "ennemi", position = pos(100, 0), faction = "akarlys" } }
ok(Ia.ChoisirCible(allie, PP, monde(0, 0, autres), 0, 0, 0) ~= nil, "autre faction : cible valide")

-- Collage : on ne change pas de cible pour quelques centimetres.
local colle = nouveau("patrouilleur")
colle.cible_id = "courante"
local duo = { { id = "courante", position = pos(500, 0) }, { id = "autre", position = pos(400, 0) } }
egal(Ia.ChoisirCible(colle, PP, monde(0, 0, duo), 0, 0, 0).id, "courante",
    "on garde sa cible pour un ecart sous la marge")
local duo2 = { { id = "courante", position = pos(500, 0) }, { id = "autre", position = pos(200, 0) } }
egal(Ia.ChoisirCible(colle, PP, monde(0, 0, duo2), 0, 0, 0).id, "autre",
    "au-dela de la marge, on change de cible")

-- ══════════════════════════════════════════════════════════════════════════════
-- MACHINE A ETATS
-- ══════════════════════════════════════════════════════════════════════════════

section("passif")

-- Un allie colle a un joueur reste au repos : il ne le detecte meme pas.
local marchand = nouveau("passif")
local intention = Ia.Decider(marchand, monde(0, 0, { { id = "joueur", position = pos(50, 0) } }), 0)
egal(marchand.etat, "repos", "un passif ne poursuit jamais")
egal(intention.type, Ia.ATTENDRE, "un passif attend")
egal(intention.cible_id, false, "un passif n'a pas de cible")

section("detection et poursuite")

local garde = nouveau("patrouilleur", { ancre = pos(0, 0) })
local loin = { { id = "j", position = pos(2000, 0) } }
Ia.Decider(garde, monde(0, 0, loin), 0)
egal(garde.etat, "repos", "hors de portee de detection : rien ne bouge")

local vu = { { id = "j", position = pos(1000, 0) } }
local plan = Ia.Decider(garde, monde(0, 0, vu), 200)
egal(garde.etat, "poursuite", "cible detectee : poursuite")
egal(plan.type, Ia.ALLER, "en poursuite, on va vers la cible")
egal(plan.cible_id, "j", "l'intention nomme la cible")
egal(plan.urgence, "course", "on poursuit en courant")
egal(plan.x, 1000, "l'intention porte le point vise")

-- Une transition par decision : c'est ce qui rend la machine relisible. Le PNJ
-- passe donc par la poursuite avant de frapper, meme deja au contact.
local contact = { { id = "j", position = pos(150, 0) } }
local frappe = Ia.Decider(garde, monde(0, 0, contact), 400)
egal(garde.etat, "attaque", "au contact : attaque")
egal(frappe.type, Ia.FRAPPER, "l'intention est de frapper")
egal(frappe.cible_id, "j", "la cible frappee est nommee")

-- ⚠ HYSTERESIS : entre 100 % et 125 % de la portee, on reste en attaque.
Ia.Decider(garde, monde(0, 0, { { id = "j", position = pos(210, 0) } }), 600)
egal(garde.etat, "attaque", "juste au-dela de la portee : toujours en attaque")
Ia.Decider(garde, monde(0, 0, { { id = "j", position = pos(260, 0) } }), 800)
egal(garde.etat, "poursuite", "au-dela de l'hysteresis : retour en poursuite")

-- Abandon : au-dela de la portee d'abandon, la cible est lachee.
local perdu = Ia.Decider(garde, monde(0, 0, { { id = "j", position = pos(3000, 0) } }), 1000)
egal(garde.etat, "repos", "cible trop loin : abandon")
egal(perdu.cible_id, false, "⚠ la cible precedente ne reste PAS dans l'intention")
egal(perdu.type, Ia.ATTENDRE, "sans cible et a son poste : on attend")

-- Cible disparue en cours de poursuite.
local seul = nouveau("patrouilleur", { ancre = pos(0, 0) })
Ia.Decider(seul, monde(0, 0, { { id = "j", position = pos(800, 0) } }), 0)
egal(seul.etat, "poursuite", "poursuite engagee")
Ia.Decider(seul, monde(0, 0, {}), 200)
egal(seul.etat, "repos", "cible disparue : retour au repos")

-- Cible morte en cours de combat.
local tueur = nouveau("patrouilleur", { ancre = pos(0, 0) })
Ia.Decider(tueur, monde(0, 0, { { id = "j", position = pos(100, 0) } }), 0)
Ia.Decider(tueur, monde(0, 0, { { id = "j", position = pos(100, 0) } }), 200)
egal(tueur.etat, "attaque", "en attaque avant la mort de la cible")
Ia.Decider(tueur, monde(0, 0, { { id = "j", position = pos(100, 0), vie = 0 } }), 400)
egal(tueur.etat, "repos", "cible morte : on cesse de frapper")

section("patrouille")

local ronde = nouveau("patrouilleur", { ancre = pos(0, 0), route = { pos(0, 0), pos(1000, 0) } })
egal(ronde.attente_ms, Ia.PROFILS.patrouilleur.repos_min_ms, "alea nul : attente minimale")

Ia.Decider(ronde, monde(0, 0, {}), 200)
egal(ronde.etat, "repos", "avant la fin de l'attente : toujours au repos")

local p1 = Ia.Decider(ronde, monde(0, 0, {}), ronde.attente_ms)
egal(ronde.etat, "patrouille", "l'attente ecoulee, la ronde commence")
egal(p1.type, Ia.ALLER, "en ronde, on va quelque part")
egal(p1.urgence, "marche", "une ronde se fait au pas")
-- Depart pose SUR le premier point : il est atteint, donc on vise deja le second.
egal(p1.x, 1000, "point de ronde suivant vise")

-- Arrive au second point, la ronde reboucle sur le premier.
local p2 = Ia.Decider(ronde, monde(1000, 0, {}), ronde.attente_ms + 200)
egal(p2.x, 0, "la ronde boucle sur le premier point")

-- Une sentinelle est un patrouilleur SANS route : elle ne part jamais.
local sentinelle = nouveau("patrouilleur", { ancre = pos(0, 0) })
local veille = Ia.Decider(sentinelle, monde(0, 0, {}), 100000)
egal(sentinelle.etat, "repos", "sans route, on ne patrouille pas")
egal(veille.type, Ia.ATTENDRE, "une sentinelle tient son poste")

-- La ronde s'interrompt des qu'une cible entre dans la portee de detection.
local interrompu = nouveau("patrouilleur", { ancre = pos(0, 0), route = { pos(0, 0), pos(1000, 0) } })
Ia.Decider(interrompu, monde(0, 0, {}), interrompu.attente_ms)
egal(interrompu.etat, "patrouille", "en ronde")
Ia.Decider(interrompu, monde(0, 0, { { id = "j", position = pos(500, 0) } }), interrompu.attente_ms + 200)
egal(interrompu.etat, "poursuite", "la ronde cede devant une cible")

section("laisse et repli")

-- Laisse : trop loin de son ancre, le PNJ rentre au lieu de poursuivre.
local tenu = nouveau("patrouilleur", { ancre = pos(0, 0) })
Ia.Decider(tenu, monde(0, 0, { { id = "j", position = pos(800, 0) } }), 0)
egal(tenu.etat, "poursuite", "poursuite engagee pres de l'ancre")
local retour = Ia.Decider(tenu, monde(4000, 0, { { id = "j", position = pos(4100, 0) } }), 200)
egal(tenu.etat, "repli", "au bout de la laisse : repli")
egal(retour.type, Ia.ALLER, "un repli est un deplacement")
egal(retour.x, 0, "on se replie vers l'ancre")
egal(retour.cible_id, false, "en repli, plus de cible designee")
egal(retour.urgence, "course", "on se replie en courant")

-- Le repli s'acheve au retour a l'ancre.
Ia.Decider(tenu, monde(100, 0, {}), 400)
egal(tenu.etat, "repos", "revenu pres de l'ancre : repos")

-- Repli sur blessure, puis fin par expiration meme sans avoir regagne l'ancre :
-- rien ne soigne les PNJ, exiger la guerison les figerait pour toujours.
local blesse = nouveau("patrouilleur", { ancre = pos(0, 0) })
local cible_proche = { { id = "j", position = pos(500, 0) } }
Ia.Decider(blesse, monde(0, 0, cible_proche), 0)
egal(blesse.etat, "poursuite", "poursuite avant la blessure")
Ia.Decider(blesse, monde(0, 0, cible_proche, 10, 100), 200)
egal(blesse.etat, "repli", "sous le seuil de vie : repli")
Ia.Decider(blesse, monde(5000, 0, cible_proche, 10, 100), 400)
egal(blesse.etat, "repli", "loin de l'ancre : toujours en repli")
local duree = Ia.PROFILS.patrouilleur.duree_repli_ms
Ia.Decider(blesse, monde(5000, 0, cible_proche, 10, 100), 400 + duree)
egal(blesse.etat, "repos", "le repli expire, meme loin de l'ancre")

-- ⚠ ET IL NE REPART PAS AU CONTACT tant qu'il est sous son seuil : sinon la
-- boucle poursuite -> repli -> poursuite tournerait sans fin.
Ia.Decider(blesse, monde(5000, 0, { { id = "j", position = pos(5100, 0) } }, 10, 100), 400 + duree + 200)
egal(blesse.etat, "repos", "blesse sous son seuil : aucun reengagement")

-- Un traqueur engage en bonne sante, puis fuit lui aussi sous 25 %.
local bete = nouveau("traqueur", { ancre = pos(0, 0) })
Ia.Decider(bete, monde(0, 0, { { id = "j", position = pos(1000, 0) } }, 100, 100), 0)
egal(bete.etat, "poursuite", "un traqueur en bonne sante engage")
Ia.Decider(bete, monde(0, 0, { { id = "j", position = pos(1000, 0) } }, 1, 100), 200)
egal(bete.etat, "repli", "un traqueur blesse se replie")

-- Derive : pousse loin de son poste, un PNJ au repos rentre au pas.
local pousse = nouveau("patrouilleur", { ancre = pos(0, 0) })
local rentre = Ia.Decider(pousse, monde(2000, 0, {}), 0)
egal(rentre.type, Ia.ALLER, "loin de son poste : on rentre")
egal(rentre.urgence, "marche", "on rentre au pas, sans urgence")
egal(rentre.x, 0, "on rentre vers l'ancre")

-- Sans ancre, il n'y a nulle part ou rentrer : on ne l'invente pas.
local sans_ancre = nouveau("patrouilleur")
egal(Ia.Decider(sans_ancre, monde(9000, 0, {}), 0).type, Ia.ATTENDRE,
    "sans ancre : on attend, on ne marche pas vers (0,0,0)")

-- ══════════════════════════════════════════════════════════════════════════════
-- CONTRAT DE `Decider`
-- ══════════════════════════════════════════════════════════════════════════════

section("Decider : robustesse")

-- ⚠ JAMAIS `nil` : l'executant n'a aucun test de nullite a oublier.
local rien, f1 = Ia.Decider(nil, monde(0, 0, {}), 0)
ok(rien ~= nil and rien.type == Ia.ATTENDRE, "etat nil : intention inerte, jamais nil")
egal(f1, false, "etat nil : decision non fraiche")
ok(Ia.Decider({}, monde(0, 0, {}), 0) ~= nil, "etat sans intention : intention inerte")
ok(Ia.Decider("chaine", nil, nil) ~= nil, "entrees absurdes : aucune levee")

local sans_monde = nouveau("patrouilleur")
egal(Ia.Decider(sans_monde, nil, 0).type, Ia.ATTENDRE, "monde nil : on attend")
local sans_pos = nouveau("patrouilleur")
egal(Ia.Decider(sans_pos, { cibles = {} }, 0).type, Ia.ATTENDRE, "sans position : on attend")

local t_invalide = nouveau("patrouilleur")
egal(select(2, Ia.Decider(t_invalide, monde(0, 0, {}), "hier")), false,
    "instant illisible : on rend la decision precedente")

-- La position du PNJ peut arriver sous la forme du moteur.
local moteur = nouveau("patrouilleur", { ancre = pos(0, 0) })
local vu_moteur = Ia.Decider(moteur, { position = Vector(0, 0, 0),
    cibles = { { id = "j", position = Vector(600, 0, 0) } } }, 0)
egal(moteur.etat, "poursuite", "un Vector nanos est une position lisible")
egal(vu_moteur.x, 600, "la cible aussi peut arriver en Vector")

-- ⚠ L'INTENTION EST LA MEME TABLE, REECRITE : c'est ce qui tient la promesse de
-- zero allocation par decision. L'appelant ne doit donc rien en conserver.
local reutil = nouveau("patrouilleur", { ancre = pos(0, 0) })
local a = Ia.Decider(reutil, monde(0, 0, {}), 0)
local b = Ia.Decider(reutil, monde(0, 0, { { id = "j", position = pos(500, 0) } }), 200)
ok(a == b, "l'intention est reutilisee, pas reallouee")
egal(a.cible_id, "j", "et elle porte bien la derniere decision")

-- Le Z compte : un joueur dix metres plus bas n'est pas a portee.
local perche = nouveau("patrouilleur", { ancre = pos(0, 0) })
Ia.Decider(perche, { position = pos(0, 0, 0),
    cibles = { { id = "j", position = pos(100, 0, 2000) } } }, 0)
egal(perche.etat, "repos", "la distance verticale compte : pas de detection a travers le sol")

-- Le meme scenario rejoue donne exactement la meme suite d'etats.
--
-- ⚠ IL Y A UNE SEULE TRANSITION PAR DECISION, et cette suite le montre : la cible
-- part a 3000 cm d'un coup, le PNJ passe d'abord de `attaque` a `poursuite`, puis
-- de `poursuite` a `repos`. Enchainer deux transitions dans le meme appel rendrait
-- la machine impossible a relire, pour gagner 200 ms sur un abandon.
local function scenario()
    local s = Ia.NouvelEtat("patrouilleur", { ancre = pos(0, 0), graine = 7, maintenant_ms = 0 })
    local suite = {}
    local pistes = { pos(1000, 0), pos(150, 0), pos(150, 0), pos(3000, 0), pos(3000, 0) }
    for k, p in ipairs(pistes) do
        Ia.Decider(s, monde(0, 0, { { id = "j", position = p } }), 1000 * k)
        suite[#suite + 1] = s.etat
    end
    return table.concat(suite, ">")
end
egal(scenario(), scenario(), "le meme scenario rejoue rend la meme suite d'etats")
egal(scenario(), "poursuite>attaque>attaque>poursuite>repos", "suite d'etats attendue")

-- ── Reancrer (2026-09-15) ──────────────────────────────────────────────────────
section("Reancrer")
-- Ne en l'air (peuplement : sol + 5 m), pose au sol : l'ancre suit le sol.
local aerien = nouveau("patrouilleur", { ancre = pos(0, 0, 500) })
Ia.Decider(aerien, { position = pos(0, 0, 0), cibles = {} }, 0)
local visee_avant = aerien.intention.type == Ia.ALLER and aerien.intention.z
egal(visee_avant, 500, "sans recalage : un PNJ tombe au sol vise son ancre en l'air")
egal(Ia.Reancrer(aerien, { X = 0, Y = 0, Z = 0 }), true, "Reancrer accepte un Vector nanos (majuscules)")
egal(aerien.ancre.z, 0, "l'ancre est au sol")
aerien.prochain_ms = 0
Ia.Decider(aerien, { position = pos(0, 0, 0), cibles = {} }, 1000)
egal(aerien.intention.type, Ia.ATTENDRE, "recale : il reste a son poste au lieu de viser le ciel")
egal(Ia.Reancrer(aerien, { x = "a" }), false, "point illisible : refuse")
egal(aerien.ancre.z, 0, "et l'ancre est intacte")
egal(Ia.Reancrer(nil, pos(1, 2, 3)), false, "etat absent : refuse")

-- La perception au FORMAT DU SERVEUR (x,y,z + position + vie) : le joueur est vu.
local vu = nouveau("patrouilleur", { ancre = pos(0, 0) })
Ia.Decider(vu, { position = pos(0, 0, 0), vie = 100, vie_max = 100,
    cibles = { { id = "1", x = 90, y = 0, z = 0, position = pos(90, 0, 0), vie = 132 } } }, 0)
egal(vu.etat, "poursuite", "cible au format serveur : detectee")

-- ── Bilan ────────────────────────────────────────────────────────────────────

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
if (echecs > 0) then error(echecs .. " test(s) en echec") end