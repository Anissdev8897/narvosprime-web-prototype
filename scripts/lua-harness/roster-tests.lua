-- [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 96 ligne(s) attendue(s) ici, 71 connue(s)]
-- ══════════════════════════════════════════════════════════════════════════════
-- roster-tests.lua — assertions sur Shared/Logic/Roster.lua.
-- Chargé par roster.mjs, qui fournit `Roster` et le global `FausseBasePersos`.
-- ══════════════════════════════════════════════════════════════════════════════

local reussis, echecs = 0, 0

local function ok(condition, nom)
    if (condition) then
        reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom)
    end
end

local function egal(obtenu, attendu, nom)
    if (obtenu == attendu) then
        reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom .. "  obtenu=" .. tostring(obtenu) .. "  attendu=" .. tostring(attendu))
    end
end

local function section(nom) print("[" .. nom .. "]") end

local CLASSE = Narvos.Classes.CLASSES_ORDER[1]

-- ── Sérialisation ─────────────────────────────────────────────────────────────

section("Encoder / DecoderTenue")

local tenue = { torse = "soldier_chest_m", jambes = "soldier_legs_m" }
local encode = Roster.EncoderTenue(tenue)

ok(encode:find("torse:soldier_chest_m", 1, true) ~= nil, "le torse est encode")
ok(encode:find("|", 1, true) ~= nil, "les couples sont separes par |")

local decode = Roster.DecoderTenue(encode)
egal(decode.torse, "soldier_chest_m", "aller-retour : torse")
egal(decode.jambes, "soldier_legs_m", "aller-retour : jambes")

-- L'ordre doit être STABLE : `pairs` n'en garantit aucun, et deux
-- enregistrements de la même tenue donneraient deux chaînes differentes.
egal(Roster.EncoderTenue(tenue), Roster.EncoderTenue(tenue), "encodage stable")

egal(Roster.EncoderTenue(nil), "", "nil encode en chaine vide")
egal(Roster.EncoderTenue({}), "", "table vide encode en chaine vide")

local vide = Roster.DecoderTenue("")
egal(next(vide), nil, "chaine vide decode en table vide")
egal(next(Roster.DecoderTenue(nil)), nil, "nil decode en table vide")
egal(next(Roster.DecoderTenue("n'importe quoi sans separateur")), nil,
     "chaine malformee decode sans lever")

-- ── Création ──────────────────────────────────────────────────────────────────

section("Creer")

local base = FausseBasePersos()
Roster.UtiliserBase(base)

-- ── UN CORPS MODULAIRE, NOMME ────────────────────────────────────────────────
--
-- Depuis le 2026-09-12, le corps propose d'office est celui du Meta
-- Customization System : un Blueprint qui s'habille LUI-MEME. Sa famille n'a
-- aucune piece, exprès — un personnage cree sans preciser de corps sort donc
-- avec une tenue VIDE, et c'est juste.
--
-- Ce fichier teste la tenue, la garde-robe et leur persistance : il lui faut un
-- corps qui porte des pieces. On le CHERCHE dans le catalogue plutot que de
-- l'ecrire : un identifiant recopie divergerait au prochain pack.
local familles_habillees = {}
for _, p in pairs(Narvos.Modular.PIECES) do
    if (p.registre ~= "base") then familles_habillees[p.famille] = true end
end

local CORPS_M
for id, c in pairs(Narvos.Modular.CORPS) do
    if (c.genre == "M" and familles_habillees[c.famille]
        and (not CORPS_M or id < CORPS_M)) then
        CORPS_M = id
    end
end
ok(CORPS_M ~= nil, "un corps modulaire masculin habillable existe")

local perso, raison = Roster.Creer(1, { nom = "Hanibes", class_id = CLASSE, genre = "M",
                                        corps = CORPS_M })
ok(perso ~= nil, "creation reussie (" .. tostring(raison) .. ")")
egal(perso and perso.compte, 1, "le personnage porte son compte")
ok(perso and perso.tenue and perso.tenue.torse ~= nil, "une tenue par defaut est posee")

egal(select(1, Roster.Creer(1, { nom = "Hanibes", class_id = CLASSE, genre = "M" })), nil,
     "nom deja pris refuse")
egal(select(1, Roster.Creer(1, { nom = "hanibes", class_id = CLASSE, genre = "M" })), nil,
-- [ANCIENNE VERSION ↑]
     "nom deja pris, casse differente, refuse")

-- Le nom est rogné par Construire : tester la chaîne brute laisserait passer un
-- doublon décoré d'espaces.
egal(select(1, Roster.Creer(1, { nom = "  Hanibes  ", class_id = CLASSE, genre = "M" })), nil,
     "nom deja pris entoure d'espaces refuse")

-- [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 181 ligne(s) attendue(s) ici, 190 connue(s)]
egal(select(1, Roster.Creer(1, { nom = "X", class_id = CLASSE, genre = "M" })), nil,
     "nom invalide refuse (validation deleguee a Creation)")
egal(select(1, Roster.Creer(nil, { nom = "Orphelin", class_id = CLASSE, genre = "M" })), nil,
     "compte absent refuse")

-- ── Plafond ───────────────────────────────────────────────────────────────────

section("plafond par compte")

for i = 2, Roster.MAX_PAR_COMPTE do
    Roster.Creer(1, { nom = "Perso" .. i, class_id = CLASSE, genre = "M" })
end
egal(Roster.Compter(1), Roster.MAX_PAR_COMPTE, "le compte est plein")

local trop, motif = Roster.Creer(1, { nom = "UnDeTrop", class_id = CLASSE, genre = "M" })
egal(trop, nil, "au-dela du plafond, refuse")
ok(motif ~= nil, "un motif est donne")

-- Le plafond est PAR COMPTE : un autre compte doit pouvoir créer.
ok(Roster.Creer(2, { nom = "AutreCompte", class_id = CLASSE, genre = "F" }) ~= nil,
   "le plafond ne deborde pas sur un autre compte")

-- ── Lecture ───────────────────────────────────────────────────────────────────

section("ParCompte / Trouver")

egal(#Roster.ParCompte(1), Roster.MAX_PAR_COMPTE, "les personnages du compte 1")
egal(#Roster.ParCompte(2), 1, "les personnages du compte 2")
egal(#Roster.ParCompte(999), 0, "compte sans personnage rend une liste vide")
egal(#Roster.ParCompte(nil), 0, "compte nil rend une liste vide")

local retrouve = Roster.Trouver(perso.id)
ok(retrouve ~= nil, "un personnage se retrouve par son id")
egal(retrouve and retrouve.name, "Hanibes", "le nom est relu")
ok(retrouve and retrouve.tenue and retrouve.tenue.torse ~= nil, "la tenue survit a l'aller-retour")
egal(Roster.Trouver("inexistant"), nil, "id inconnu rend nil")
egal(Roster.Trouver(nil), nil, "id nil rend nil sans lever")

-- ── Propriété ─────────────────────────────────────────────────────────────────
--
-- Le point de sécurité du fichier : l'id vient du client.

section("Appartient / Supprimer")

egal(Roster.Appartient(1, perso.id), true, "le proprietaire est reconnu")
egal(Roster.Appartient(2, perso.id), false, "un autre compte n'est pas proprietaire")
egal(Roster.Appartient(nil, perso.id), false, "compte nil n'est pas proprietaire")

-- ⚠ LA suppression croisée doit échouer. Sans le compte_id dans le WHERE,
-- n'importe quel joueur effacerait le personnage d'un autre.
local vole, motif_vol = Roster.Supprimer(2, perso.id)
egal(vole, false, "suppression par un autre compte REFUSEE")
ok(Roster.Trouver(perso.id) ~= nil, "le personnage existe toujours apres la tentative")

local supprime = Roster.Supprimer(1, perso.id)
egal(supprime, true, "le proprietaire peut supprimer")
egal(Roster.Trouver(perso.id), nil, "le personnage a disparu")

egal(select(1, Roster.Supprimer(1, "inexistant")), false, "supprimer un inconnu echoue")
egal(select(1, Roster.Supprimer(1, nil)), false, "id nil refuse sans lever")

-- Le message ne doit pas distinguer « pas a vous » de « n'existe pas », sinon on
-- peut sonder quels identifiants sont valides.
local _, motif_absent = Roster.Supprimer(1, "inexistant")
egal(motif_vol, motif_absent, "meme message pour vol et inexistant")

-- ── Mise a jour de tenue ──────────────────────────────────────────────────────

section("MajTenue")

-- ⚠ UN PERSONNAGE AU CORPS HABILLABLE, CRÉÉ ICI. « Hanibes » vient d'être
-- supprimé, et les « PersoN » restants ont le corps d'office (famille
-- `metahuman`, sans aucune pièce) : prendre le premier de la liste faisait
-- échouer tout ce bloc pour une raison étrangère à ce qu'il vérifie.
local cible = Roster.Creer(1, { nom = "Habillable", class_id = CLASSE, genre = "M", corps = CORPS_M })
ok(cible ~= nil, "un personnage au corps habillable est cree pour le test")

-- ⚠ La piece doit etre de la MEME famille que le corps du personnage : c'est
-- `Roster.MajTenue` qui le verifie, en lisant la famille du corps et non un
-- argument du client.
local fam = Narvos.Modular.Corps(cible.corps).famille
local un_torse
for id, p in pairs(Narvos.Modular.PIECES) do
    local bon_genre = (p.genre == "M") or (p.genre == "*")
    if (p.slot == "torse" and bon_genre and p.famille == fam) then un_torse = id break end
end
ok(un_torse ~= nil, "un torse de la famille " .. tostring(fam) .. " existe")

egal(select(1, Roster.MajTenue(1, cible.id, { torse = un_torse })), true, "tenue mise a jour")
egal(Roster.Trouver(cible.id).tenue.torse, un_torse, "la nouvelle tenue est relue")

egal(select(1, Roster.MajTenue(2, cible.id, { torse = un_torse })), false,
     "un autre compte ne peut pas rhabiller")
egal(select(1, Roster.MajTenue(1, cible.id, { torse = "inexistante" })), false,
     "piece inconnue refusee")

-- Genre croisé : la pièce ne se déformerait pas correctement.
local un_torse_f
for id, p in pairs(Narvos.Modular.PIECES) do
    if (p.slot == "torse" and p.genre == "F") then un_torse_f = id break end
end
egal(select(1, Roster.MajTenue(1, cible.id, { torse = un_torse_f })), false,
     "piece strictement feminine sur personnage masculin refusee")

-- ⚠ LE MELANGE DE FAMILLES. Les os concordent, les volumes non : une piece
-- d'une autre morphologie doit etre refusee meme si son genre convient.
local autre_famille
for id, p in pairs(Narvos.Modular.PIECES) do
    if (p.slot == "torse" and p.famille ~= fam) then autre_famille = id break end
end
if (autre_famille) then
    egal(select(1, Roster.MajTenue(1, cible.id, { torse = autre_famille })), false,
         "piece d'une autre morphologie refusee")
end

-- ── Garde-robe ────────────────────────────────────────────────────────────────

section("garde-robe")

local vide_gr = { possede = {}, porte = {} }
egal(Roster.EncoderGardeRobe(vide_gr), "P=;O=", "garde-robe vide encodee sans perte")
egal(Roster.EncoderGardeRobe(nil), "", "nil encode en chaine vide")

local gr = { possede = { b = true, a = true }, porte = { torse = "a" } }
local encode = Roster.EncoderGardeRobe(gr)
egal(encode, "P=torse:a;O=a,b", "les possedes sortent tries, l ordre est stable")

local decode = Roster.DecoderGardeRobe(encode)
egal(decode.porte.torse, "a", "aller-retour : la piece portee survit")
egal(decode.possede.a, true, "aller-retour : le premier possede survit")
egal(decode.possede.b, true, "aller-retour : le second possede survit")

egal(next(Roster.DecoderGardeRobe(nil).possede), nil, "decoder nil rend une garde-robe vide")
egal(next(Roster.DecoderGardeRobe("nawak").porte), nil, "decoder du bruit ne casse pas")

-- Un personnage neuf recoit sa tenue, et elle traverse la base.
-- ⚠ COMPTE 2, PAS 1. Le compte 1 a deja ses cinq personnages plus haut : le
-- creer sur 1 echouerait sur le plafond, et le test dirait « garde-robe cassee »
-- pour une raison qui n'a rien a voir.
-- [SÛRE dans une version intermédiaire, non replacée] -- ⚠ La piece doit etre de la MEME famille que le corps du personnage : c'est
-- [SÛRE dans une version intermédiaire, non replacée] -- `Roster.MajTenue` qui le verifie, en lisant la famille du corps et non un
-- [SÛRE dans une version intermédiaire, non replacée] local fam = Narvos.Modular.Corps(cible.corps).famille
-- [SÛRE dans une version intermédiaire, non replacée]     if (p.slot == "torse" and bon_genre and p.famille == fam) then un_torse = id break end
-- [SÛRE dans une version intermédiaire, non replacée] ok(un_torse ~= nil, "un torse de la famille " .. tostring(fam) .. " existe")
-- [SÛRE dans une version intermédiaire, non replacée] local autre_famille
-- [SÛRE dans une version intermédiaire, non replacée]     if (p.slot == "torse" and p.famille ~= fam) then autre_famille = id break end
-- [SÛRE dans une version intermédiaire, non replacée] if (autre_famille) then
-- [SÛRE dans une version intermédiaire, non replacée]     egal(select(1, Roster.MajTenue(1, cible.id, { torse = autre_famille })), false,
-- ⚠ UN CORPS DONT LA FAMILLE A DES PIECES. Depuis l'arrivee du corps morphable
-- (famille `mpfb`, sans aucun vetement), prendre le PREMIER corps masculin par
-- ordre alphabetique tombait sur lui — et tous les tests de tenue echouaient
-- pour une raison qui n'avait rien a voir avec ce qu'ils verifient.
local familles_habillees = {}
for _, p in pairs(Narvos.Modular.PIECES) do familles_habillees[p.famille] = true end

local CORPS_M
for id, c in pairs(Narvos.Modular.CORPS) do
    if (c.genre == "M" and familles_habillees[c.famille]
        and (not CORPS_M or id < CORPS_M)) then
        CORPS_M = id
    end
end

local neuf = Roster.Creer(2, { nom = "Vestiaire", class_id = CLASSE, genre = "M", corps = CORPS_M })
ok(neuf ~= nil, "personnage neuf cree")

if (neuf) then
    -- Règle de Hanibes (2026-10-03) : AUCUNE tenue offerte. Le personnage neuf
    -- reçoit 1 500 pièces et achète sa tenue à un PNJ.
    egal(Roster.CREDITS_DEPART, 1500, "la bourse de depart vaut 1 500 pieces")
    egal(neuf.credits, Roster.CREDITS_DEPART, "le personnage neuf recoit sa bourse")
    egal(next(neuf.gardeRobe.porte), nil, "le personnage neuf ne porte aucun vetement")
    egal(next(neuf.gardeRobe.possede), nil, "le personnage neuf ne possede aucun vetement")

    -- La relecture est ce qui compte : une garde-robe correcte en memoire mais
    -- perdue a l'ecriture ne se verrait qu'a la reconnexion suivante.
    local relu
    for _, p in ipairs(Roster.ParCompte(2)) do
        if (p.id == neuf.id) then relu = p end
    end
    ok(relu ~= nil, "le personnage neuf est relu depuis la base")
    if (relu) then
        egal(next(relu.gardeRobe.porte), nil,
             "la garde-robe vide survit a l aller-retour en base")
        egal(relu.credits, Roster.CREDITS_DEPART, "la bourse survit a l aller-retour")
    end

    -- ⚠ LE CONTROLE QUI COMPTE. L'id du personnage vient du client : sans
    -- `compte_id` dans le WHERE, n'importe qui rhabillerait le perso d'un autre.
    local majee = { possede = { z = true }, porte = { torse = "z" } }
    egal(select(1, Roster.MajGardeRobe(2, neuf.id, majee, 42)), true,
         "le proprietaire peut enregistrer sa garde-robe")
    egal(select(1, Roster.MajGardeRobe(999, neuf.id, majee, 42)), false,
         "un autre compte ne peut PAS toucher cette garde-robe")

    egal(select(1, Roster.MajGardeRobe(2, neuf.id, majee, -1)), false,
         "un solde negatif est refuse")
    egal(select(1, Roster.MajGardeRobe(2, neuf.id, "pas une table", 10)), false,
-- [ANCIENNE VERSION ↑]
         "une garde-robe non tabulaire est refusee")
end

-- ── Progression du personnage (2026-09-13) ────────────────────────────────────

section("progression : niveau, XP, talents")

if (neuf) then
    local relu0 = Roster.Trouver(neuf.id)
    egal(relu0 and relu0.xp, 0, "un personnage sans colonne xp relit 0 XP")
    egal(relu0 and next(relu0.talents), nil, "un personnage sans colonne talents relit aucun talent")

    egal(select(1, Roster.EnregistrerProgression(2, neuf.id, 7, 133, { dmg_sharp = 1 })), true,
         "le proprietaire enregistre sa progression")
    local relu1 = Roster.Trouver(neuf.id)
    egal(relu1 and relu1.level, 7, "le niveau survit a l'aller-retour")
    egal(relu1 and relu1.xp, 133, "l'XP survit a l'aller-retour")
    egal(relu1 and relu1.talents.dmg_sharp, 1, "les talents survivent a l'aller-retour")

    -- ⚠ Meme controle que la garde-robe : l'id vient du client.
    egal(select(1, Roster.EnregistrerProgression(999, neuf.id, 50, 0, {})), false,
         "un autre compte ne peut PAS ecrire cette progression")
    egal(Roster.Trouver(neuf.id).level, 7, "le refus n'a rien ecrit")

    -- Bornes a l'ecriture : niveau >= 1, XP >= 0.
    Roster.EnregistrerProgression(2, neuf.id, -3, -40, nil)
    local relu2 = Roster.Trouver(neuf.id)
    egal(relu2.level, 1, "un niveau negatif est ramene a 1")
    egal(relu2.xp, 0, "une XP negative est ramenee a 0")

    -- ⚠ LES TROIS SAUVEGARDES QUI LISAIENT `Roster.Base()` (2026-09-14) : une
    -- fonction qui n'a jamais existe. Chacune rendait « Base indisponible »,
    -- et aucun test ne les parcourait avec une base branchee.
    section("sauvegardes a une colonne : sac, compagnons, metiers")
    egal(select(1, Roster.EnregistrerMetiers(2, neuf.id, { mineur = { niveau = 4, xp = 12 } })), true,
         "EnregistrerMetiers ecrit avec la base branchee")
    egal(Roster.Trouver(neuf.id).metiers.mineur.niveau, 4, "les metiers sont relus depuis la base")
    egal(select(1, Roster.EnregistrerMetiers(999, neuf.id, {})), false,
         "EnregistrerMetiers refuse un autre compte")

    egal(select(1, Roster.EnregistrerAnimaux(2, neuf.id, { possedes = {}, compagnon_actif = nil })), true,
         "EnregistrerAnimaux ecrit avec la base branchee")

    -- Cite de depart et de reapparition (2026-09-15).
    egal(Roster.Trouver(neuf.id).cite, nil, "cite : jamais choisie = nil")
    egal(select(1, Roster.EnregistrerCite(2, neuf.id, "foret")), true, "EnregistrerCite ecrit avec la base branchee")
    egal(Roster.Trouver(neuf.id).cite, "foret", "la cite est relue depuis la base")
    egal(select(1, Roster.EnregistrerCite(999, neuf.id, "tower")), false, "EnregistrerCite refuse un autre compte")
    egal(Roster.Trouver(neuf.id).cite, "foret", "le refus n'a rien ecrit")
    egal(select(1, Roster.EnregistrerCite(2, neuf.id, "x'; DROP TABLE personnages; --")), false,
         "une cite hors forme de cle est refusee avant la base")
    egal(select(1, Roster.EnregistrerCite(2, neuf.id, string.rep("a", 41))), false, "cite trop longue refusee")
    egal(Roster.CiteValide("capitale"), "capitale", "CiteValide : cle de catalogue acceptee")
    egal(Roster.CiteValide(""), nil, "CiteValide : vide refuse")
    egal(Roster.CiteValide(42), nil, "CiteValide : nombre refuse")
    egal(Roster.CiteValide("mon monde"), nil, "CiteValide : espace refuse")

    -- Dernier Zaap active, point de reapparition (2026-09-15, D4).
    egal(Roster.Trouver(neuf.id).zaap, nil, "zaap : jamais active = nil")
    egal(select(1, Roster.EnregistrerZaap(2, neuf.id, "zaap_du_port")), true, "EnregistrerZaap ecrit avec la base branchee")
    egal(Roster.Trouver(neuf.id).zaap, "zaap_du_port", "le zaap est relu depuis la base")
    egal(Roster.Trouver(neuf.id).cite, "foret", "ecrire le zaap ne touche pas la cite")
    egal(select(1, Roster.EnregistrerZaap(2, neuf.id, "zaap_nord")), true, "un second zaap remplace le premier")
    egal(Roster.Trouver(neuf.id).zaap, "zaap_nord", "seul le DERNIER zaap active est retenu")
    egal(select(1, Roster.EnregistrerZaap(999, neuf.id, "zaap_sud")), false, "EnregistrerZaap refuse un autre compte")
    egal(Roster.Trouver(neuf.id).zaap, "zaap_nord", "le refus n'a rien ecrit")
    egal(select(1, Roster.EnregistrerZaap(2, neuf.id, "x'; DROP TABLE personnages; --")), false,
         "un zaap hors forme de cle est refuse avant la base")
    egal(select(1, Roster.EnregistrerZaap(2, neuf.id, nil)), false, "zaap absent refuse")
    egal(select(1, Roster.EnregistrerZaap(2, "", "zaap_nord")), false, "personnage vide refuse")
    egal(Roster.ZaapValide("zaap_nord"), "zaap_nord", "ZaapValide : cle acceptee")
    egal(Roster.ZaapValide(string.rep("z", 41)), nil, "ZaapValide : trop long refuse")

    local ok_inv, raison_inv = Roster.EnregistrerInventaire(2, neuf.id, { grid = { cells = {} }, equipment = {} })
    egal(ok_inv, true, "EnregistrerInventaire ecrit avec la base branchee (" .. tostring(raison_inv) .. ")")
    egal(select(1, Roster.EnregistrerInventaire(999, neuf.id, { grid = {}, equipment = {} })), false,
         "EnregistrerInventaire refuse un autre compte")
end

local t_enc = Roster.EncoderTalents({ sur_vitality = 2, dmg_sharp = 3, rien = 0, ["a:b"] = 1 })
egal(t_enc, "dmg_sharp:3|sur_vitality:2", "talents : tri, rang nul omis, separateur refuse")
egal(Roster.DecoderTalents("dmg_sharp:3|dmg_sharp:9|x:0|n'importe").dmg_sharp, 3,
     "talents : un doublon garde la premiere occurrence")
egal(Roster.DecoderTalents("x:0").x, nil, "talents : un rang nul n'est pas relu")
egal(next(Roster.DecoderTalents(nil)), nil, "talents : nil decode en table vide")

-- ── Hors base ─────────────────────────────────────────────────────────────────

section("hors base")

Roster.UtiliserBase(nil)
egal(Roster.Prete(), false, "Prete() faux sans base")
egal(#Roster.ParCompte(1), 0, "liste vide sans base")
egal(select(1, Roster.Creer(1, { nom = "Rien", class_id = CLASSE, genre = "M" })), nil,
     "creation impossible sans base")
egal(select(1, Roster.Supprimer(1, "x")), false, "suppression impossible sans base")

-- ── L'inventaire ──────────────────────────────────────────────────────────────
--
-- ⚠ CES TESTS EXISTENT PARCE QUE L'INVENTAIRE N'ETAIT PAS SAUVEGARDE DU TOUT.
-- `Inventory.lua` fait 1 021 lignes et ne touchait aucune base : le sac etait
-- vide a chaque deconnexion, sans le moindre signal. Le defaut le plus couteux
-- ici n'est pas une erreur, c'est un silence.

section("Inventaire : aller-retour")

local sac = {
    grid = { cols = 8, rows = 10, instances = {
        { itemId = "arch_sword", quantity = 1, gridX = 0, gridY = 0, gridW = 2, gridH = 3, uid = "u1" },
        { itemId = "iron_ore",   quantity = 47, gridX = 3, gridY = 1, gridW = 1, gridH = 1, uid = "u2" },
    } },
    equipment = { weapon = { uid = "u1" } },
}

local chaine = Roster.EncoderInventaire(sac)
local relu = Roster.DecoderInventaire(chaine)

egal(relu.grid.cols, 8, "colonnes conservees")
egal(relu.grid.rows, 10, "lignes conservees")
egal(#relu.grid.instances, 2, "deux piles relues")
egal(relu.grid.instances[1].itemId, "arch_sword", "premier objet")
egal(relu.grid.instances[2].quantity, 47, "quantite conservee")
egal(relu.grid.instances[1].gridW, 2, "largeur conservee")

-- ⚠ L'equipement REFERENCE une pile, il ne la recopie pas. Si le decodeur
-- fabriquait une copie, le joueur retrouverait son epee DEUX fois : dans la
-- grille et dans sa main.
ok(relu.equipment.weapon == relu.grid.instances[1],
   "l'equipement pointe la MEME pile que la grille")

-- ⚠ MODELE ACTUEL (2026-09-15) : equiper RETIRE la pile de la grille
-- (Inventory.EquiperDepuisGrille). L'ancien encodeur n'ecrivait que `slot=uid`,
-- le decodeur ignorait l'uid absent : l'objet equipe disparaissait a la
-- reconnexion.
section("Inventaire : pile portee hors grille")

local sac_porte = {
    grid = { cols = 8, rows = 10, instances = {
        { itemId = "iron_ore", quantity = 12, gridX = 0, gridY = 0, gridW = 1, gridH = 1, uid = "g1" },
    } },
    equipment = {
        weapon = { itemId = "lewis", quantity = 1, gridX = 4, gridY = 2, gridW = 3, gridH = 2, uid = "e1" },
        helmet = { itemId = "casque_tactique", quantity = 1, gridX = 0, gridY = 0, gridW = 2, gridH = 2, uid = "e2" },
    },
}
local chaine_porte = Roster.EncoderInventaire(sac_porte)
local relu_porte = Roster.DecoderInventaire(chaine_porte)
egal(#relu_porte.grid.instances, 1, "la grille relue ne contient PAS les piles portees")
egal(relu_porte.equipment.weapon and relu_porte.equipment.weapon.itemId, "lewis", "l'arme portee revient apres reconnexion")
egal(relu_porte.equipment.weapon and relu_porte.equipment.weapon.uid, "e1", "son uid est conserve")
egal(relu_porte.equipment.weapon and relu_porte.equipment.weapon.gridW, 3, "ses dimensions sont conservees")
egal(relu_porte.equipment.helmet and relu_porte.equipment.helmet.itemId, "casque_tactique", "le casque porte revient aussi")
egal(Roster.EncoderInventaire(relu_porte), chaine_porte, "aller-retour stable (meme chaine)")

-- Une pile portee dont l'uid est aussi dans la grille : jamais dedoublee.
local double = Roster.DecoderInventaire("8,10;iron_ore:5:0:0:1:1:x1;weapon=lewis:1:0:0:1:1:x1")
egal(#double.grid.instances, 1, "uid present dans la grille : la pile portee n'est pas recreee")
egal(double.equipment.weapon, nil, "et l'emplacement ne pointe pas une copie")

-- Ancien format (reference) toujours lu.
local ancien = Roster.DecoderInventaire("8,10;arch_sword:1:0:0:2:3:u9;weapon=u9")
ok(ancien.equipment.weapon == ancien.grid.instances[1], "ancien format slot=uid toujours lu")

section("Inventaire : ce qui est refuse")

egal(#Roster.DecoderInventaire("").grid.instances, 0, "chaine vide : sac vide")
egal(#Roster.DecoderInventaire(nil).grid.instances, 0, "nil : sac vide sans lever")
egal(#Roster.DecoderInventaire(42).grid.instances, 0, "nombre : sac vide sans lever")
egal(#Roster.DecoderInventaire("n'importe quoi").grid.instances, 0, "charabia : sac vide")
egal(Roster.EncoderInventaire(nil), "", "nil s'encode en chaine vide")

-- Une pile a quantite nulle n'est pas une pile : l'ecrire obligerait le
-- decodeur a deviner ce qu'elle represente.
local zero = { grid = { cols = 8, rows = 10, instances = {
    { itemId = "x", quantity = 0, gridX = 0, gridY = 0, gridW = 1, gridH = 1, uid = "z" } } } }
egal(#Roster.DecoderInventaire(Roster.EncoderInventaire(zero)).grid.instances, 0,
     "quantite nulle ecartee")

-- Un identifiant portant un separateur casserait le decodage EN SILENCE :
-- l'encodeur le refuse plutot que de tronquer.
local sale = { grid = { cols = 8, rows = 10, instances = {
    { itemId = "mauvais:id", quantity = 1, gridX = 0, gridY = 0, gridW = 1, gridH = 1, uid = "s" } } } }
egal(#Roster.DecoderInventaire(Roster.EncoderInventaire(sale)).grid.instances, 0,
     "identifiant contenant un separateur ecarte")

-- Deux piles sous le meme uid : l'uid EST l'identite, un doublon rendrait le
-- glisser-deposer ambigu.
local double = { grid = { cols = 8, rows = 10, instances = {
    { itemId = "a", quantity = 1, gridX = 0, gridY = 0, gridW = 1, gridH = 1, uid = "meme" },
    { itemId = "b", quantity = 1, gridX = 1, gridY = 0, gridW = 1, gridH = 1, uid = "meme" } } } }
egal(#Roster.DecoderInventaire(Roster.EncoderInventaire(double)).grid.instances, 1,
     "uid en double : une seule pile gardee")

-- Un slot qui designe une pile absente est ignore, pas devine.
local orphelin = Roster.DecoderInventaire("8,10;epee:1:0:0:1:1:u1;weapon=INCONNU")
egal(orphelin.equipment.weapon, nil, "equipement vers un uid absent : ignore")

section("Inventaire : deterministe")

-- Deux encodages du meme sac doivent donner la MEME chaine, sinon toute
-- comparaison « a-t-il change ? » serait fausse. `pairs` n'a pas d'ordre
-- garanti : c'est pour ca qu'on itere des LISTES.
egal(Roster.EncoderInventaire(sac), Roster.EncoderInventaire(sac),
     "deux encodages donnent la meme chaine")
egal(Roster.EncoderInventaire(relu), chaine, "encoder(decoder(x)) == x")

-- ── Métiers : aller-retour ────────────────────────────────────────────────────
--
-- La progression des métiers est portée du web le 2026-09-12. Une XP qui ne
-- survit pas à la reconnexion n'est pas une progression : c'est l'exact défaut
-- qu'avait l'inventaire avant le 2026-09-06.

section("Metiers : aller-retour")

local etat_m = {
    mineur = { niveau = 12, xp = 340 },
    forgeron = { niveau = 3, xp = 0 },
}
local relu = Roster.DecoderMetiers(Roster.EncoderMetiers(etat_m))
egal(relu.mineur and relu.mineur.niveau, 12, "le niveau survit a l'aller-retour")
egal(relu.mineur and relu.mineur.xp, 340, "l'XP survit a l'aller-retour")
egal(relu.forgeron and relu.forgeron.niveau, 3, "un second metier survit aussi")

-- ⚠ Ordre stable : la meme table, encodee deux fois, doit donner la meme ligne.
-- Sans tri, `pairs` changerait l'ordre et chaque sauvegarde passerait pour une
-- modification.
egal(Roster.EncoderMetiers(etat_m), Roster.EncoderMetiers(etat_m), "encodage deterministe")

-- Une base vide, nil ou illisible rend un etat VIDE, jamais une erreur.
egal(next(Roster.DecoderMetiers(nil)), nil, "nil decode en etat vide")
egal(next(Roster.DecoderMetiers("")), nil, "chaine vide decode en etat vide")
egal(next(Roster.DecoderMetiers("n'importe quoi")), nil, "chaine illisible decode en etat vide")

-- ⚠ Une cle portant un separateur est REFUSEE, pas nettoyee : la nettoyer
-- fabriquerait un metier qui n'existe pas.
local pollue = Roster.EncoderMetiers({ ["min:eur"] = { niveau = 5, xp = 1 }, mineur = { niveau = 2, xp = 0 } })
ok(not pollue:find("min:eur", 1, true), "une cle avec separateur n'est pas ecrite")
egal(Roster.DecoderMetiers(pollue).mineur.niveau, 2, "les cles saines passent quand meme")

-- Un doublon edite a la main garde la PREMIERE occurrence : repeter une ligne
-- ne doit pas faire gagner de niveaux.
egal(Roster.DecoderMetiers("mineur:9:0|mineur:40:0").mineur.niveau, 9, "un doublon garde la premiere occurrence")

-- Des valeurs aberrantes sont ramenees dans les bornes a l'ecriture.
local borne = Roster.DecoderMetiers(Roster.EncoderMetiers({ mineur = { niveau = -4, xp = -30 } }))
egal(borne.mineur.niveau, 1, "un niveau negatif est ramene a 1")
egal(borne.mineur.xp, 0, "une XP negative est ramenee a 0")

-- ── Bilan ─────────────────────────────────────────────────────────────────────

print("")
-- [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 3 ligne(s) attendue(s) ici, 2 connue(s)]
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
if (echecs > 0) then error(echecs .. " test(s) en echec") end
-- [ANCIENNE VERSION ↑]
-- [MODIFICATIONS NON REPLACÉES — 1 modification(s) faite(s) à ce fichier n'ont pas pu y être reportées (texte d'origine introuvable ou ambigu) : voir EDITS_NON_APPLIQUES]