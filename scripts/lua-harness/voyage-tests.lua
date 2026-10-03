-- ══════════════════════════════════════════════════════════════════════════════
-- voyage-tests.lua — assertions sur Catalogs/Mondes.lua et Logic/Voyage.lua.
-- Chargé par voyage.mjs, qui fournit `Mondes`, `Voyage` et le global `Narvos`.
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

-- ── Le catalogue des mondes ───────────────────────────────────────────────────

section("Mondes")

ok(#Mondes.MONDES >= 3, "au moins trois mondes")

-- ⚠ DIMENSIONS UNIQUES. Deux mondes partageant une dimension se superposeraient :
-- le joueur verrait les deux decors imbriques, sans qu'aucune erreur ne parte.
local vues_dim, vus_id = {}, {}
for _, m in ipairs(Mondes.MONDES) do
    ok(vus_id[m.id] == nil, "identifiant unique : " .. m.id)
    vus_id[m.id] = true

    ok(type(m.dimension) == "number", "dimension numerique : " .. m.id)
    vues_dim[m.dimension] = m.id

    -- ⚠ CE TEST A ETE INVERSE LE 2026-09-06, ET C'EST VOULU.
    -- Il exigeait une dimension UNIQUE par monde et un catalogue de meshes.
    -- Les deux appartenaient a l'architecture precedente : des mondes empiles a
    -- l'origine, separes par des dimensions. Ils sont maintenant des
    -- sous-niveaux Unreal separes de 80 km, tous en dimension 1 — mettre un
    -- joueur ailleurs qu'en 1 le rendrait aveugle au decor, qui, lui, y reste.
    --
    -- Ce qui definit un monde aujourd'hui, c'est son `niveau` et son decalage.
    -- ⚠ TROIS FORMES DE DECOR DEPUIS LE 2026-09-09, PAS UNE.
    -- Cette assertion exigeait un `niveau` de TOUS les mondes. La capitale n'en
    -- a pas : ses 13 490 acteurs CITY_PACK sont dans `Map_Narvos` meme
    -- (`decor_persistant`). Elle est donc passee au ROUGE le jour ou la
    -- capitale est devenue jouable — et elle avait raison de le faire, parce que
    -- `VoyageServeur.Charger` ignorait la meme forme. On aligne le test sur les
    -- trois formes que le code connait, ni plus ni moins.
    ok(type(m.niveau) == "string" and m.niveau ~= ""
        or m.decor_persistant == true
        or type(m.catalogue) == "string",
        "une forme de decor : " .. m.id)

    -- ⚠ LE DECALAGE NE CONCERNE QUE LE DECOR GLB.
    -- `Mondes.DECALAGES` sert a UN endroit : l'offset passe a
    -- `MapLoader.Charger` (Server/Voyage.lua) quand un monde pose son decor
    -- depuis un catalogue de meshes. Un sous-niveau est place par le moteur, et
    -- un decor persistant est deja en place : ni l'un ni l'autre n'en lit.
    -- L'exiger de tous rendait ROUGE la foret, dont la `level_transform` a
    -- justement ete remise a l'IDENTITE (adk-poser-foret.py:132 — ce sont les
    -- acteurs qu'on a deplaces, pas le niveau).
    if (type(m.catalogue) == "string") then
        ok(Mondes.DECALAGES[m.id] ~= nil, "decalage declare : " .. m.id)
    end

    ok(m.arrivee ~= nil, "point d'arrivee defini : " .. m.id)
end

-- La Forge doit occuper la dimension 1 : c'est celle ou nanos place tout le
-- monde par defaut. L'y mettre evite de deplacer chaque joueur a la connexion.
egal(Mondes.Trouver("forge").dimension, 1, "la Forge occupe la dimension par defaut")

egal(Mondes.Trouver("monde_inexistant"), nil, "monde inconnu rend nil")
egal(Mondes.Trouver(nil), nil, "Trouver(nil) ne leve pas")
egal(Mondes.ParDimension(1).id, "forge", "recherche par dimension")
egal(Mondes.ParDimension(9999), nil, "dimension inconnue rend nil")
egal(Mondes.ParDimension("x"), nil, "dimension non numerique rend nil")

-- ── Les passages ──────────────────────────────────────────────────────────────

section("Liaisons")

-- Les QUATRE passages demandes, nommement. Un test qui compterait seulement les
-- liaisons passerait au vert avec quatre passages dans le mauvais sens.
egal(Mondes.Liaison("forge", "orbital") ~= nil, true, "Forge -> Orbital")
egal(Mondes.Liaison("tower", "orbital") ~= nil, true, "Tour -> Orbital")
egal(Mondes.Liaison("orbital", "forge") ~= nil, true, "Orbital -> Forge")
egal(Mondes.Liaison("orbital", "tower") ~= nil, true, "Orbital -> Tour")
egal(Mondes.Liaison("alien", "orbital") ~= nil, true, "Azur -> Orbital")
egal(Mondes.Liaison("orbital", "alien") ~= nil, true, "Orbital -> Azur")
-- ⚠ ON NE RECOPIE PLUS LE NOMBRE. « trois portails depuis Orbital » etait un 3
-- ecrit a la main : il a survecu a la capitale (4) et serait devenu faux a
-- chaque monde ajoute. Pire, il ne DISAIT PAS lequel manquait — il rendait
-- « obtenu=4 attendu=3 », ce qui se lit comme un portail EN TROP alors qu'il
-- s'agissait d'un monde en plus.
--
-- ⚠ ET L'INVARIANT N'EST PAS « UN LIEN DIRECT VERS ORBITAL ».
-- Premiere version de cette correction : j'exigeais de chaque monde une arete
-- directe dans les deux sens. C'etait vrai des quatre premiers mondes, faux de
-- la Sylve, qui se rejoint PAR la capitale (20 km au sol, aucun corps celeste
-- libre en orbite — voir le commentaire de la liaison dans Mondes.lua). Le test
-- aurait force une topologie en etoile que le monde ne veut plus.
--
-- Ce qui compte pour un joueur, c'est de POUVOIR ALLER et REVENIR. On parcourt
-- donc le graphe des liaisons depuis Orbital, dans les deux sens. Un monde
-- ajoute sans aucun passage est signale nommement — c'est exactement le defaut
-- qu'on vient de trouver sur la foret, declaree et praticable mais injoignable.
local function atteignables(depuis, suivant)
    local vus, pile = { [depuis] = true }, { depuis }
    while (#pile > 0) do
        local ici = table.remove(pile)
        for _, l in ipairs(Mondes.LIAISONS) do
            local a, b = suivant(l)
            if (a == ici and not vus[b]) then
                vus[b] = true
                pile[#pile + 1] = b
            end
        end
    end
    return vus
end

-- Sens aller : on suit `de -> vers` depuis Orbital.
local joignables = atteignables("orbital", function(l) return l.de, l.vers end)
-- Sens retour : on remonte `vers -> de`, ce qui donne les mondes D'OU l'on peut
-- revenir a Orbital. Un monde sans issue est une souriciere, pas un lieu.
local sortables = atteignables("orbital", function(l) return l.vers, l.de end)

for _, m in ipairs(Mondes.MONDES) do
    ok(joignables[m.id] == true, "joignable depuis Orbital : " .. m.id)
    ok(sortables[m.id] == true, "peut revenir a Orbital : " .. m.id)
end

egal(#Mondes.LiaisonsDepuis("forge"), 1, "un portail depuis la Forge")
egal(#Mondes.LiaisonsDepuis("tower"), 1, "un portail depuis la Tour")
egal(#Mondes.LiaisonsDepuis("alien"), 1, "un portail depuis Azur")
egal(#Mondes.LiaisonsDepuis("inexistant"), 0, "monde inconnu : aucun portail")
egal(#Mondes.LiaisonsDepuis(nil), 0, "nil : aucun portail sans lever")

for _, l in ipairs(Mondes.LIAISONS) do
    local nom = l.de .. " -> " .. l.vers
    -- Un passage vers un monde qui n'existe pas poserait un Trigger menant nulle
    -- part : le joueur le franchirait et resterait sur place.
    ok(Mondes.Trouver(l.de) ~= nil, "monde de depart connu : " .. nom)
    ok(Mondes.Trouver(l.vers) ~= nil, "monde d'arrivee connu : " .. nom)
    ok(l.de ~= l.vers, "un passage ne boucle pas sur lui-meme : " .. nom)
    ok(type(l.rayon) == "number" and l.rayon > 0, "rayon positif : " .. nom)
    ok(l.position ~= nil, "position definie : " .. nom)
end

-- La montee exige un vaisseau, la descente non : c'est la gravite qui s'en
-- charge. Le sens de la regle compte autant que son existence.
egal(Mondes.Liaison("forge", "orbital").exige_vol, true, "monter exige un vaisseau")
egal(Mondes.Liaison("tower", "orbital").exige_vol, true, "monter depuis la Tour aussi")
egal(Mondes.Liaison("orbital", "forge").exige_vol, false, "descendre n'exige rien")
egal(Mondes.Liaison("orbital", "tower").exige_vol, false, "descendre vers la Tour non plus")

egal(Mondes.Liaison("forge", "tower"), nil, "aucun passage direct Forge -> Tour")

-- ── Praticabilite ─────────────────────────────────────────────────────────────

section("MondePraticable")

-- D5 retire temporairement la Forge sans effacer son catalogue. Le drapeau
-- `ouvert = false` doit donc primer sur la presence du sous-niveau et du decor.
local forge_praticable, forge_raison = Voyage.MondePraticable("forge")
egal(forge_praticable, false, "Forge temporairement fermee")
ok(forge_raison ~= nil, "la fermeture de la Forge explique sa raison")
egal(select(1, Voyage.MondePraticable("alien")), true, "Azur : ouvert")
egal(select(1, Voyage.MondePraticable("monde_inexistant")), false, "monde inconnu : ferme")
egal(select(1, Voyage.MondePraticable(nil)), false, "nil : ferme sans lever")
-- Meme correction que pour les portails : on affirme la RELATION (tous les
-- mondes du catalogue sont praticables), pas un compte recopie. Ce n'est pas
-- tautologique — `MondesPraticables` filtre sur le decor, donc un monde qui
-- perdrait le sien ferait tomber ce test en nommant l'ecart.
local mondes_ouverts = 0
for _, monde in ipairs(Mondes.MONDES) do
    if (monde.ouvert ~= false) then mondes_ouverts = mondes_ouverts + 1 end
end
egal(#Voyage.MondesPraticables(), mondes_ouverts, "seuls les mondes ouverts sont praticables")

-- La voie CATALOGUE reste testee : un monde sans sous-niveau retombe dessus, et
-- un catalogue sans liste de meshes n'est toujours pas une map — l'accepter
-- chargerait zero objet et declarerait le monde ouvert.
-- ⚠ ON MODIFIE UN MONDE EXISTANT, on n'en ajoute pas un. `Mondes.Trouver` lit un
-- index construit UNE FOIS au chargement du module : une entree ajoutee a
-- `MONDES` apres coup reste introuvable, et le test mesurerait « monde inconnu »
-- en croyant mesurer « sans catalogue ».
local forge = Mondes.Trouver("forge")
local niveau_forge, catalogue_forge, ouvert_forge = forge.niveau, forge.catalogue, forge.ouvert
forge.niveau, forge.catalogue, forge.ouvert = nil, "MapFantome", nil
Narvos.MapFantome = nil
egal(select(1, Voyage.MondePraticable("forge")), false, "ni niveau ni catalogue : ferme")
Narvos.MapFantome = { NOM = "fantome" }
egal(select(1, Voyage.MondePraticable("forge")), false, "catalogue sans MESHES : ferme")
Narvos.MapFantome = { NOM = "fantome", MESHES = { "a", "b" } }
egal(select(1, Voyage.MondePraticable("forge")), true, "catalogue complet : ouvert")
forge.niveau, forge.catalogue, forge.ouvert = niveau_forge, catalogue_forge, ouvert_forge

-- ── Depart ────────────────────────────────────────────────────────────────────

section("PeutPartir")

local monter = Mondes.Liaison("forge", "orbital")
local descendre = Mondes.Liaison("orbital", "forge")

egal(select(1, Voyage.PeutPartir(monter, { pilote_vol = true })), true,
    "monter en vaisseau : accepte")
egal(select(1, Voyage.PeutPartir(monter, { pilote_vol = false })), false,
    "monter a pied : refuse")
egal(select(1, Voyage.PeutPartir(monter, {})), false, "contexte vide : refuse")
egal(select(1, Voyage.PeutPartir(monter, nil)), false, "contexte nil : refuse sans lever")

egal(select(1, Voyage.PeutPartir(descendre, { pilote_vol = false })), false,
    "descendre vers la Forge fermee : refuse")

egal(select(1, Voyage.PeutPartir(nil, {})), false, "liaison nil : refusee sans lever")

-- Un passage vers un monde ferme est refuse MEME en vaisseau : la condition de
-- depart ne remplace pas l'existence du monde d'arrivee. Les quatre mondes
-- etant tous ouverts, on fabrique la liaison manquante pour le verifier.
local vers_nulle_part = { de = "orbital", vers = "fantome", exige_vol = true }
egal(select(1, Voyage.PeutPartir(vers_nulle_part, { pilote_vol = true })), false,
    "monde d'arrivee ferme : refuse malgre le vaisseau")

-- ── Arrivee ───────────────────────────────────────────────────────────────────

section("Arrivee")

local dim, pos = Voyage.Arrivee("orbital")
egal(dim, Mondes.Trouver("orbital").dimension, "dimension d'arrivee")
ok(pos ~= nil, "position d'arrivee")

egal(select(1, Voyage.Arrivee("monde_inexistant")), nil, "monde inconnu : pas d'arrivee")
egal(select(1, Voyage.Arrivee(nil)), nil, "nil : pas d'arrivee sans lever")

-- ── Diagnostic ────────────────────────────────────────────────────────────────

section("Etat")

local etat = Voyage.Etat()
egal(#etat, #Mondes.LIAISONS, "une ligne par passage")

local ouverts = 0
for _, e in ipairs(etat) do
    if (e.praticable) then ouverts = ouverts + 1 end
    -- Un passage ferme DOIT dire pourquoi : c'est cette phrase qui evite de
    -- chercher dans le code pourquoi un portail n'apparait pas en jeu.
    if (not e.praticable) then ok(e.raison ~= nil, "raison donnee : " .. e.de .. " -> " .. e.vers) end
end
-- `praticable` qualifie le monde d'ARRIVEE. Les passages qui menent a la Forge
-- sont les seuls a devoir disparaitre pendant son retrait temporaire.
local vers_forge = 0
for _, liaison in ipairs(Mondes.LIAISONS) do
    if (liaison.vers == "forge") then vers_forge = vers_forge + 1 end
end
egal(ouverts, #Mondes.LIAISONS - vers_forge, "les passages vers les mondes ouverts restent disponibles")

local fermes = 0
for _, e in ipairs(etat) do
    if (not e.praticable) then fermes = fermes + 1 end
end
egal(fermes, vers_forge, "seuls les passages vers la Forge sont fermes")

-- ── Bilan ─────────────────────────────────────────────────────────────────────

section("Alien dédiée et Sylve orbitale")
egal(Mondes.Trouver("alien").niveau, "Map_Alien", "Azur conserve son niveau")
egal(Mondes.Trouver("megastructure").niveau, "Map_Megastructure", "Alien dédiée distincte d'Azur")
for _, id in ipairs({ "megastructure", "foret" }) do
    egal(Mondes.ParPosition(Mondes.Trouver(id).arrivee).id, id, "arrivée dans son monde : " .. id)
    local aller, retour = Mondes.Liaison("orbital", id), Mondes.Liaison(id, "orbital")
    ok(aller ~= nil and retour ~= nil, "orbite aller-retour : " .. id)
    egal(Mondes.ParPosition(aller.position).id, "orbital", "planète dans l'espace : " .. id)
    egal(Mondes.ParPosition(retour.position).id, id, "balise dans son monde : " .. id)
    ok(aller.rayon > 41567.30859375, "entrée avant collision avec planète : " .. id)
    egal(select(1, Voyage.PeutPartir(retour, { pilote_vol = false })), false, "retour réservé au vol : " .. id)
end
ok(Mondes.Liaison("capitale", "foret") ~= nil and Mondes.Liaison("foret", "capitale") ~= nil,
    "route capitale-Sylve conservée")
for i, a in ipairs(Mondes.LIAISONS) do
    for j = i + 1, #Mondes.LIAISONS do
        local b = Mondes.LIAISONS[j]
        if a.de == b.de then
            local dx, dy, dz = a.position.X - b.position.X, a.position.Y - b.position.Y, a.position.Z - b.position.Z
            ok(dx*dx + dy*dy + dz*dz > (a.rayon+b.rayon)^2,
                "déclencheurs distincts : " .. a.de .. " -> " .. a.vers .. "/" .. b.vers)
        end
    end
end

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
if (echecs > 0) then error(echecs .. " test(s) en echec") end