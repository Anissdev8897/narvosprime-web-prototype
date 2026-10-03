-- ══════════════════════════════════════════════════════════════════════════════
-- creation-tests.lua — assertions sur Shared/Logic/CharacterCreation.lua.
-- Chargé par creation.mjs, qui fournit `Creation` et le global `Narvos`.
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

-- Une classe réelle du catalogue, pour ne pas coder un id en dur qui pourrait
-- disparaître à la prochaine régénération.
local CLASSE = Narvos.Classes.CLASSES_ORDER[1]

-- ── Validation du nom ─────────────────────────────────────────────────────────

section("nom")

ok(not Creation.ValiderNom(nil), "nil est refusé")
ok(not Creation.ValiderNom(42), "un nombre est refusé")
ok(not Creation.ValiderNom(""), "vide est refusé")
ok(not Creation.ValiderNom("   "), "que des espaces est refusé")
ok(not Creation.ValiderNom("a"), "un caractère est trop court")
ok(Creation.ValiderNom("ab"), "deux caractères passent")
ok(Creation.ValiderNom(string.rep("a", 16)), "seize caractères passent")
ok(not Creation.ValiderNom(string.rep("a", 17)), "dix-sept caractères sont refusés")

-- La divergence assumée vis-à-vis du TS : là-bas la borne haute testait la
-- chaîne NON rognée, donc ce cas était refusé alors que sa forme enregistrée
-- tient dans seize caractères.
ok(Creation.ValiderNom("  " .. string.rep("a", 16) .. "  "),
    "seize caractères entourés d'espaces passent (divergence documentée)")

ok(Creation.ValiderNom("Jean Luc"), "un espace interne est conservé")
egal(Creation.Rogner("  Hanibes  "), "Hanibes", "Rogner retire les deux bords")
egal(Creation.Rogner("Jean Luc"), "Jean Luc", "Rogner ne touche pas l'intérieur")

local _, raison = Creation.ValiderNom("a")
ok(type(raison) == "string" and raison:find("court"), "la raison nomme le défaut")

-- ── Classe et genre ───────────────────────────────────────────────────────────

section("classe et genre")

ok(Creation.ClasseValide(CLASSE), "une classe du catalogue est valide")
ok(not Creation.ClasseValide("classe_qui_n_existe_pas"), "une classe inconnue est refusée")
ok(not Creation.ClasseValide(nil), "nil n'est pas une classe")

ok(Creation.GenreValide("M"), "M est un genre")
ok(Creation.GenreValide("F"), "F est un genre")
ok(not Creation.GenreValide("X"), "X n'est pas un genre")
ok(not Creation.GenreValide("m"), "la casse compte")

-- ── Identité ──────────────────────────────────────────────────────────────────

section("identité")

-- Horloge et RNG injectés : c'est la seule façon de vérifier le FORMAT d'un
-- identifiant sans dépendre de l'heure.
local id = Creation.NouvelId(function() return 1234 end, function() return 0 end)
egal(id, "char_1234_000000", "format char_<ms>_<6 base36>")

local id2 = Creation.NouvelId(function() return 1234 end, function() return 0.999 end)
egal(id2, "char_1234_zzzzzz", "rng à 1 donne le haut de l'alphabet base 36")

ok(Creation.NouvelId() ~= Creation.NouvelId(), "deux ids consécutifs diffèrent")

-- ── Construction ──────────────────────────────────────────────────────────────

section("construction")

local perso, motif = Creation.Construire({
    nom = "  Hanibes  ", class_id = CLASSE, genre = "M",
    compte = "aniss", serveur = "local",
    horloge = function() return 1000 end, rng = function() return 0 end,
})

ok(perso ~= nil, "un personnage valide est construit")
egal(motif, nil, "aucun motif de refus")
egal(perso.name, "Hanibes", "le nom est enregistré rogné")
egal(perso.classId, CLASSE, "la classe est reportée")
egal(perso.gender, "M", "le genre est reporté")
egal(perso.level, 1, "niveau de départ 1")
egal(perso.username, "aniss", "le compte est reporté")
egal(perso.server, "local", "le serveur est reporté")
egal(perso.headIndex, 0, "headIndex 0")
egal(perso.spriteDataUrl, "", "pas de vignette côté serveur")
egal(perso.lastMap.x, 0, "lastMap.x 0")
egal(perso.lastMap.y, 0, "lastMap.y 0")
-- ⚠ CE TEST VERROUILLE UNE SUPPRESSION. Il exigeait `perso.colors.skin`, la
-- palette Dofus que `Construire` fabriquait sans que rien ne la lise. Le jour du
-- branchement des couleurs, ce champ mort a repris la place du choix du joueur.
-- On verifie donc l'inverse : les couleurs sont ce qu'on a DEMANDE, et rien ne
-- s'y ajoute d'office.
ok(type(perso.colors) == "table", "la table de couleurs existe")
egal(perso.colors.skin, nil, "aucune couleur heritee ne se glisse dans la fiche")

local teinte = Creation.Construire({
    nom = "Aniss", class_id = CLASSE, genre = "M", compte = "aniss",
    couleurs = { tenue = "#112233", yeux = "#445566" },
})
egal(teinte.colors.tenue, "#112233", "la couleur choisie est reportee telle quelle")
egal(teinte.colors.yeux, "#445566", "chaque cible garde la sienne")

-- Une valeur mal formee n'est PAS filtree ici : ce module ne connait pas le
-- catalogue des cibles. C'est `Roster.EncoderCouleurs` qui normalise avant la
-- base, et le test de Roster le verifie. Ce partage est delibere, pas un oubli.
local sale = Creation.Construire({
    nom = "Aniss", class_id = CLASSE, genre = "M", couleurs = { tenue = "rouge" },
})
egal(sale.colors.tenue, "rouge", "la validation des teintes n'appartient pas a ce module")

-- L'élément et le rôle sont recopiés du catalogue : le roster doit être lisible
-- sans recharger les catalogues.
egal(perso.element, Narvos.Classes.CLASSES[CLASSE].element, "élément recopié du catalogue")
egal(perso.role, Narvos.Classes.CLASSES[CLASSE].role, "rôle recopié du catalogue")

local absent, r1 = Creation.Construire({ nom = "a", class_id = CLASSE, genre = "M" })
egal(absent, nil, "un nom trop court ne construit rien")
ok(r1:find("court"), "et dit pourquoi")

local absent2, r2 = Creation.Construire({ nom = "Hanibes", class_id = "bidon", genre = "M" })
egal(absent2, nil, "une classe inconnue ne construit rien")
ok(r2:find("Classe"), "et dit pourquoi")

-- Le TS typait le genre ; ici on refuse au lieu de replier en silence sur "M",
-- ce qui donnerait un personnage que le joueur n'a pas demandé.
local absent3, r3 = Creation.Construire({ nom = "Hanibes", class_id = CLASSE, genre = "Z" })
egal(absent3, nil, "un genre invalide ne construit rien")
ok(r3:find("Genre"), "et dit pourquoi")

egal(Creation.Construire(nil), nil, "aucun paramètre ne construit rien")

-- ── Hors moteur : valeurs neutres ─────────────────────────────────────────────

section("hors moteur")

-- Package n'existe pas ici. Les fonctions de roster doivent rendre du neutre
-- plutôt que de lever : c'est ce qui permet de charger le module dans un test.
ok(type(Creation.Tous()) == "table" and #Creation.Tous() == 0, "roster vide hors moteur")
ok(#Creation.ParCompte("aniss") == 0, "aucun personnage par compte hors moteur")
ok(not Creation.NomPris("Hanibes"), "aucun nom pris hors moteur")
ok(Creation.Trouver("char_1") == nil, "Trouver rend nil hors moteur")
ok(Creation.Supprimer("char_1") == false, "Supprimer rend false hors moteur")

-- Creer construit quand même : hors moteur elle rend le personnage sans
-- l'écrire, ce qui la rend testable.
local cree = Creation.Creer({ nom = "Hanibes", class_id = CLASSE, genre = "F" })
ok(cree ~= nil and cree.name == "Hanibes", "Creer construit hors moteur sans persister")

-- ── Options de l'écran de création ────────────────────────────────────────────

section("options")

local opts = Creation.Options()
egal(#opts.classes, #Narvos.Classes.CLASSES_ORDER, "toutes les classes sont proposées")
egal(opts.classes[1].id, Narvos.Classes.CLASSES_ORDER[1], "l'ordre suit CLASSES_ORDER, pas pairs")
ok(opts.classes[1].label ~= nil, "chaque classe porte son label")
egal(opts.classes[1].label, Narvos.Classes.CLASSES[CLASSE].label, "le label vient du catalogue")
ok(opts.classes[1].baseStats ~= nil, "chaque classe porte ses stats de base")
egal(#opts.genres, 2, "deux genres")
egal(opts.nom_min, 2, "borne basse exposée")
egal(opts.nom_max, 16, "borne haute exposée")


-- ── Tenue modulaire ───────────────────────────────────────────────────────────

section("tenue modulaire")

local base = { nom = "Tenue", class_id = CLASSE, genre = "M" }

-- ── UN CORPS MODULAIRE POUR LES TESTS DE TENUE ───────────────────────────────
--
-- Depuis le 2026-09-12, le corps propose d'office est celui du Meta
-- Customization System : un BLUEPRINT, qui s'habille LUI-MEME. Sa famille
-- (`metahuman`) n'a aucune piece, exprès — il n'y a rien a lui poser.
--
-- Les tests de tenue MODULAIRE doivent donc nommer un corps modulaire. Le
-- choisir ici plutot que de le coder en dur : le catalogue est genere, et un
-- identifiant recopie divergerait au prochain pack.
local function premierCorpsAvecPieces(genre)
    local avec = {}
    for _, p in pairs(Narvos.Modular.PIECES) do avec[p.famille] = true end
    local ids = {}
    for id, c in pairs(Narvos.Modular.CORPS) do
        if (c.genre == genre and avec[c.famille]) then ids[#ids + 1] = id end
    end
    table.sort(ids)
    return ids[1]
end

local CORPS_MODULAIRE_M = premierCorpsAvecPieces("M")
ok(CORPS_MODULAIRE_M ~= nil, "un corps modulaire masculin existe au catalogue")
base.corps = CORPS_MODULAIRE_M

local perso = Creation.Construire(base)
ok(perso.tenue ~= nil, "une tenue est posée quand aucune n'est fournie")
ok(perso.tenue.torse ~= nil, "la tenue par défaut habille le torse")

-- ── LE CORPS DU SYSTEME ACHETE, LUI, SORT SANS PIECE ─────────────────────────
-- Et c'est la regle, pas un manque : son Blueprint porte ses propres vetements.
local perso_mh = Creation.Construire({ nom = "Paye", class_id = CLASSE, genre = "M" })
local corps_mh = Narvos.Modular.Corps(perso_mh.corps)
egal(corps_mh.famille, "metahuman", "le corps propose d'office est celui du systeme achete")
ok(corps_mh.blueprint ~= nil, "ce corps porte un Blueprint, pas seulement un mesh")
egal(next(perso_mh.tenue), nil, "il sort sans aucune piece modulaire")
egal(Narvos.Modular.ValiderTenue(perso_mh.tenue, "M", "metahuman"), true,
     "une tenue vide reste valide pour lui")

-- La tenue posée d'office doit passer sa propre validation, sinon un personnage
-- neuf naîtrait déjà invalide.
-- ⚠ La famille se DÉDUIT du corps retenu, elle ne se suppose pas. `Construire`
-- choisit le premier corps du genre ; coder « stylized » ici casserait dès qu'un
-- pack ajoute un corps qui passe devant dans l'ordre alphabétique.
local famM = Narvos.Modular.Corps(perso.corps).famille
egal(Narvos.Modular.ValiderTenue(perso.tenue, "M", famM), true, "la tenue par défaut est valide")
ok(perso.corps ~= nil, "un corps est retenu d'office")

-- Le genre doit gouverner la tenue : un personnage féminin ne doit pas recevoir
-- des pièces masculines par défaut.
local persoF = Creation.Construire({ nom = "Tenue", class_id = CLASSE, genre = "F",
                                    corps = premierCorpsAvecPieces("F") })
local famF = Narvos.Modular.Corps(persoF.corps).famille
egal(Narvos.Modular.ValiderTenue(persoF.tenue, "F", famF), true, "tenue par défaut féminine valide")

-- Les deux genres reçoivent des CORPS distincts. Leurs vêtements, eux, peuvent
-- être les mêmes : les pièces MetaHuman sont mixtes (genre « * »).
ok(persoF.corps ~= perso.corps, "les deux genres n'ont pas le même corps")
egal(Narvos.Modular.Corps(persoF.corps).genre, "F", "le corps féminin est bien féminin")

-- Une tenue explicite est conservée telle quelle.
-- ⚠ La piece doit appartenir a la MEME famille que le corps retenu. Prendre
-- « un torse masculin » au hasard donnait une piece Stylized sur un corps
-- MetaHuman, que `ValiderTenue` refuse — a juste titre.
local un_torse
for id, p in pairs(Narvos.Modular.PIECES) do
    local bon_genre = (p.genre == "M") or (p.genre == "*")
    if (p.slot == "torse" and bon_genre and p.famille == famM) then un_torse = id break end
end
ok(un_torse ~= nil, "un torse de la famille " .. tostring(famM) .. " existe")
-- ⚠ LE CORPS EST NOMME. Sans lui, `Construire` retomberait sur le corps propose
-- d'office — celui du systeme achete, dont la famille n'a aucune piece — et
-- `ValiderTenue` refuserait ce torse a juste titre.
local choisi = Creation.Construire({ nom = "Tenue", class_id = CLASSE, genre = "M",
                                     corps = CORPS_MODULAIRE_M,
                                     tenue = { torse = un_torse } })
egal(choisi.tenue.torse, un_torse, "une tenue fournie est conservée")

-- Un corps du mauvais genre est refusé : il fixe la morphologie, l'accepter
-- donnerait un personnage dont les vêtements ne vont pas.
local corpsF
for id, c in pairs(Narvos.Modular.CORPS) do
    if (c.genre == "F") then corpsF = id break end
end
egal(Creation.Construire({ nom = "Croise", class_id = CLASSE, genre = "M", corps = corpsF }), nil,
     "corps féminin sur personnage masculin refusé")

-- [TROU — ligne jamais lue dans les transcriptions]
-- l'attachement : AddSkeletalMeshAttached échouerait alors en jeu, sans recours.
-- [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : ? ligne(s) attendue(s) ici, 14 connue(s)]
local rate, motif = Creation.Construire({ nom = "Tenue", class_id = CLASSE, genre = "M",
                                          tenue = { torse = "piece_inexistante" } })
egal(rate, nil, "tenue référençant une pièce absente refusée")
ok(motif ~= nil, "un motif est donné")

local croise = Creation.Construire({ nom = "Tenue", class_id = CLASSE, genre = "F",
                                     tenue = { torse = un_torse } })
egal(croise, nil, "pièce masculine sur personnage féminin refusée")
ok(un_torse ~= nil, "un torse de la famille " .. tostring(famM) .. " existe")
-- ── Bilan ─────────────────────────────────────────────────────────────────────

print("")
print(reussis .. " réussis, " .. echecs .. " échoués")
if (echecs > 0) then error("des tests ont échoué", 0) end
-- [ANCIENNE VERSION ↑]