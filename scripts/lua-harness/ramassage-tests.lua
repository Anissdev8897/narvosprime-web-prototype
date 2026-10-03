-- ══════════════════════════════════════════════════════════════════════════════
-- ramassage-tests.lua — assertions sur Logic/Ramassage.lua et
-- Logic/ArmesInventaire.lua. Chargé par ramassage.mjs, qui fournit les deux
-- modules ainsi que les VRAIS catalogues du jeu.
--
-- Ce que ces tests ferment : le jour où Hanibes a signalé pour la troisième fois
-- « je ne peux pas stocker les armes », la mesure a donné 24 armes spawnables,
-- 81 objets de sac, ZÉRO identifiant commun. Rien ne l'avait vu — les deux
-- catalogues sont générés séparément et aucun contrôle ne les confrontait.
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

-- ── Portée ────────────────────────────────────────────────────────────────────

section("portee")

ok(Ramassage.PORTEE_CM > 0, "la portee est positive")
egal(Ramassage.DistanceCarree(0, 0, 3, 4), 25, "distance au carre : 3-4-5")
egal(Ramassage.DistanceCarree(0, 0, 0, 0), 0, "distance nulle sur le meme point")

-- La hauteur est VOLONTAIREMENT ignoree : un objet sur une table doit se
-- ramasser comme un objet au sol.
ok(Ramassage.APortee(0, 0, 100, 0), "un objet a 1 m est a portee")
ok(not Ramassage.APortee(0, 0, 10000, 0), "un objet a 100 m ne l est pas")
ok(Ramassage.APortee(0, 0, 0, Ramassage.PORTEE_CM), "la borne exacte est INCLUSE")
ok(not Ramassage.APortee(0, 0, 0, Ramassage.PORTEE_CM + 1), "un centimetre au-dela ne l est pas")

-- Une portee explicite l emporte sur le defaut.
ok(Ramassage.APortee(0, 0, 500, 0, 600), "une portee elargie accepte plus loin")
ok(not Ramassage.APortee(0, 0, 500, 0, 400), "une portee reduite refuse")

-- ── Le plus proche ────────────────────────────────────────────────────────────

section("plus proche")

egal(Ramassage.PlusProche({}, 0, 0), nil, "aucun candidat rend nil")
egal(Ramassage.PlusProche(nil, 0, 0), nil, "une entree nil rend nil sans lever")

local loin = { id = "loin", x = 200, y = 0 }
local pres = { id = "pres", x = 50, y = 0 }
local hors = { id = "hors", x = 99999, y = 0 }

-- ⚠ L ORDRE DE LA LISTE NE DOIT RIEN CHANGER. C est la raison d etre de cette
-- fonction : rendre le PLUS PROCHE, pas le premier venu. Ramasser un objet qu on
-- ne regarde pas est plus deroutant que de ne rien ramasser.
egal(Ramassage.PlusProche({ loin, pres, hors }, 0, 0).id, "pres", "le plus proche gagne")
egal(Ramassage.PlusProche({ pres, loin, hors }, 0, 0).id, "pres", "l ordre de la liste n y change rien")
egal(Ramassage.PlusProche({ hors }, 0, 0), nil, "un candidat hors portee est ecarte")

-- Une entree qui n est pas une table ne doit pas tuer le parcours : les
-- candidats viennent du moteur, et une entite detruite entre-temps arrive nil.
egal(Ramassage.PlusProche({ false, pres, 42 }, 0, 0).id, "pres", "les entrees non-table sont ignorees")

-- ── Etiquette vers objet ──────────────────────────────────────────────────────

section("etiquette vers objet")

local ITEMS = {
    ak47 = { id = "ak47", label = "AK-47" },
    caisse = { id = "caisse", label = "Caisse", mesh = "narvos::SM_Caisse" },
}

egal(Ramassage.ItemDe("narvos_arme", "ak47", ITEMS).id, "ak47", "une arme se retrouve par son id")
egal(Ramassage.ItemDe("narvos_arme", "inconnue", ITEMS), nil, "une arme inconnue rend nil")
egal(Ramassage.ItemDe("narvos_arme", nil, ITEMS), nil, "une valeur nil rend nil sans lever")
egal(Ramassage.ItemDe("narvos_arme", 42, ITEMS), nil, "une valeur non-chaine rend nil")
egal(Ramassage.ItemDe("narvos_arme", "ak47", nil), nil, "un catalogue absent rend nil")

-- Le prop se retrouve par son MESH, et le prefixe de pack ne doit pas y faire
-- obstacle : le catalogue ecrit tantot narvos::SM_X, tantot SM_X.
egal(Ramassage.ItemDe("narvos_asset", "narvos::SM_Caisse", ITEMS).id, "caisse",
     "un prop se retrouve par son mesh, prefixe compris")
egal(Ramassage.ItemDe("narvos_asset", "SM_Caisse", ITEMS).id, "caisse",
     "le meme mesh sans prefixe donne le meme objet")
egal(Ramassage.ItemDe("narvos_asset", "narvos::SM_Rocher", ITEMS), nil,
     "un decor sans objet correspondant n est PAS ramassable")

-- ── Projection du sac ─────────────────────────────────────────────────────────

section("projection du sac")

-- La duplication du 2026-09-13 : TAB equipe une arme qui RESTE dans le sac, T la
-- lache au sol, Y la ramassait — un exemplaire de plus a chaque tour.
ok(type(Ramassage.MARQUE_PROJECTION) == "string" and Ramassage.MARQUE_PROJECTION ~= "",
   "la marque de projection est une cle nommee")
egal(Ramassage.EstRamassable(true), false, "une projection du sac n entre JAMAIS dans un sac")
egal(Ramassage.EstRamassable(nil), true, "une arme sans marque (posee par /arme) se ramasse")
egal(Ramassage.EstRamassable(false), true, "le repli false de GetValue ne bloque rien")
-- Seul `true` exclut : une valeur fantaisiste ne doit pas rendre un objet du
-- monde imprenable (il resterait au sol pour toujours).
egal(Ramassage.EstRamassable("oui"), true, "une valeur non booleenne n exclut pas")

egal(Ramassage.SortDuLacher(true), "detruire", "une projection lachee est detruite")
egal(Ramassage.SortDuLacher(nil), "laisser", "un objet du monde lache reste au sol")
egal(Ramassage.SortDuLacher(false), "laisser", "le repli false laisse au sol")

-- Les deux regles disent la meme chose : ce qui se detruit au lacher est
-- exactement ce qui ne se ramasse pas. Deux fonctions qui divergeraient
-- rouvriraient la duplication par l autre porte.
for _, v in ipairs({ true, false, "x", 0 }) do
    egal(Ramassage.SortDuLacher(v) == "detruire", not Ramassage.EstRamassable(v),
         "detruit au lacher <=> non ramassable (" .. tostring(v) .. ")")
end
egal(Ramassage.SortDuLacher(nil) == "detruire", not Ramassage.EstRamassable(nil),
     "detruit au lacher <=> non ramassable (nil)")

-- ── Armes dans le sac ─────────────────────────────────────────────────────────

section("armes stockables")

local ARMES = {
    { id = "ak47", label = "AK-47", categorie = "rifles", mesh = "nanos-world::SK_AK47" },
    { id = "glock", label = "Glock", categorie = "pistols", mesh = "nanos-world::SK_Glock" },
    { id = "exotique", label = "Exotique", categorie = "categorie_inventee" },
}

local o = ArmesInventaire.Objet(ARMES[1])
egal(o.id, "ak47", "l objet garde l identifiant de l arme")
egal(o.type, "weapon", "il est de type arme")
egal(o.arme, "ak47", "il porte le pont de retour vers le monde")
egal(o.stackable, false, "une arme ne s empile pas")
egal(o.gridW, ArmesInventaire.TAILLES.rifles.w, "la taille vient de la categorie")
egal(o.gridH, ArmesInventaire.TAILLES.rifles.h, "la hauteur aussi")

-- Une categorie inconnue ne doit pas rendre nil : un pack qui ajoute une famille
-- d armes ne doit pas rendre ses armes inaccessibles au sac.
local x = ArmesInventaire.Objet(ARMES[3])
ok(x ~= nil, "une categorie inconnue produit quand meme un objet")
egal(x.gridW, ArmesInventaire.TAILLES.defaut.w, "elle retombe sur la taille par defaut")

egal(ArmesInventaire.Objet(nil), nil, "une arme nil rend nil")
egal(ArmesInventaire.Objet({ label = "sans id" }), nil, "une arme sans id rend nil")

-- ── Integration ───────────────────────────────────────────────────────────────

section("integration")

local db = {}
local ajoutees, deja = ArmesInventaire.Integrer(db, ARMES)
egal(ajoutees, 3, "les trois armes entrent au catalogue")
egal(deja, 0, "aucune n etait deja presente")
ok(db.ak47 ~= nil and db.glock ~= nil, "elles sont retrouvables par leur id")

-- ⚠ LE SECOND PASSAGE N AJOUTE RIEN. Shared/Index.lua peut etre recharge ;
-- doubler les entrees ferait grossir le catalogue a chaque rechargement.
local a2, d2 = ArmesInventaire.Integrer(db, ARMES)
egal(a2, 0, "un second passage n ajoute rien")
egal(d2, 3, "il les compte comme deja presentes")

-- ⚠ UNE ENTREE EXISTANTE N EST JAMAIS ECRASEE. Si ITEM_DB porte un jour un ak47
-- regle a la main, c est LUI qui doit gagner.
local mien = { id = "ak47", label = "MON AK", type = "weapon" }
local db2 = { ak47 = mien }
ArmesInventaire.Integrer(db2, ARMES)
egal(db2.ak47.label, "MON AK", "une entree ecrite a la main l emporte")

egal(ArmesInventaire.Integrer(nil, nil), 0, "sans catalogue, rien n est ajoute")

-- ── Le pont qui manquait ──────────────────────────────────────────────────────

section("armes reelles du jeu")

-- LE test qui aurait evite trois signalements : toute arme spawnable DOIT etre
-- stockable. On oppose les deux VRAIS catalogues, pas des exemples.
local db3 = {}
for id, def in pairs(VRAIS_ITEMS) do db3[id] = def end
ArmesInventaire.Integrer(db3, VRAIES_ARMES)

local absentes = {}
for i = 1, #VRAIES_ARMES do
    local a = VRAIES_ARMES[i]
    if (a and a.id and db3[a.id] == nil) then absentes[#absentes + 1] = a.id end
end
egal(#absentes, 0, "toute arme spawnable est stockable dans le sac")
ok(#VRAIES_ARMES > 0, "le catalogue d armes n est pas vide")

-- Et chacune se retrouve par le chemin que le serveur emprunte reellement.
local perdues = 0
for i = 1, #VRAIES_ARMES do
    local a = VRAIES_ARMES[i]
    if (a and a.id and Ramassage.ItemDe("narvos_arme", a.id, db3) == nil) then
        perdues = perdues + 1
    end
end
egal(perdues, 0, "chaque arme se retrouve par ItemDe, le chemin du serveur")

print("")
print(reussis .. " reussis, " .. echecs .. " echec(s)")
if (echecs > 0) then error(echecs .. " test(s) en echec") end