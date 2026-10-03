-- ══════════════════════════════════════════════════════════════════════════════
-- frappes-tests.lua — assertions sur Shared/Logic/Frappes.lua.
-- Chargé par frappes.mjs, qui fournit `Frappes` et `AnimNoms` (catalogue RÉEL).
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

-- ── Catalogue ─────────────────────────────────────────────────────────────────

section("catalogue")

local presents = Frappes.EnsembleNoms(AnimNoms.NOMS)
ok(next(presents) ~= nil, "le catalogue d'animations cuites n'est pas vide")

-- LE TEST QUI COMPTE : chaque coup a un geste dans le pack CUIT. Sans lui le coup
-- blesse et le personnage reste immobile.
local manquants = Frappes.Verifier(presents)
egal(#manquants, 0, "chaque coup a au moins un clip cuit (" .. table.concat(manquants, ", ") .. ")")

-- Chaque entrée mène à un coup existant, pour toutes les natures possibles.
for entree, geste in pairs(Frappes.ENTREES) do
    if (geste.famille == "poing") then
        for _, nature in ipairs(Frappes.NATURE_PAR_ETAPE) do
            ok(Frappes.COUPS[Frappes.Identifiant(nature, geste.cote)] ~= nil,
                "coup present : " .. nature .. "_" .. geste.cote .. " (" .. entree .. ")")
        end
    else
        ok(Frappes.COUPS[Frappes.Identifiant("pied", geste.cote)] ~= nil,
            "coup present : pied_" .. geste.cote)
    end
end

-- La latéralité ne se perd pas : un coup « g » ne cite aucun clip de main droite.
for id, coup in pairs(Frappes.COUPS) do
    ok(coup.impact_ms < coup.duree_ms, "impact dans le clip : " .. id)
    ok(coup.recup_ms > coup.impact_ms, "on recupere APRES l'impact : " .. id)
    if (coup.nature ~= "pied") then
        for _, c in ipairs(coup.clips) do
            local main = c:match("_([LR])hand_")
            egal(main, coup.cote == "g" and "L" or "R", "cote du clip " .. c .. " pour " .. id)
        end
    end
end

-- Le pied droit est celui du pack : il doit se résoudre sur son propre clip.
egal(Frappes.Clip(Frappes.COUPS.pied_d, presents), "attack_special_kick_Anim", "pied droit = clip du pack")
-- Le pied gauche retombe sur le droit tant que son miroir n'est pas cuit.
ok(Frappes.Clip(Frappes.COUPS.pied_g, presents) ~= nil, "pied gauche resolu (miroir ou repli)")

-- ── Choisir : entrées invalides ───────────────────────────────────────────────

section("entrees invalides")

local e = Frappes.NouvelEtat()
egal(select(1, Frappes.Choisir(nil, 0, "principale")), false, "etat absent refuse")
egal(select(1, Frappes.Choisir(e, nil, "principale")), false, "instant absent refuse")
egal(select(1, Frappes.Choisir(e, 0, "coup_de_boule")), false, "geste inconnu refuse")
egal(select(1, Frappes.Choisir(e, 0, 42)), false, "geste non chaine refuse")
egal(e.etape, 0, "un refus ne touche pas l'etat")

-- ── Enchaînement des poings ───────────────────────────────────────────────────

section("enchainement")

e = Frappes.NouvelEtat()
local okc, _, p = Frappes.Choisir(e, 1000, "principale")
egal(okc, true, "premier coup accepte")
egal(p.id, "jab_d", "clic principal = jab main droite")
egal(p.etape, 1, "etape 1")
egal(p.finisher, false, "pas de finisher au premier coup")
egal(p.slot, "haut", "poing en UpperBody")
egal(p.cibles_max, 1, "un poing touche une cible")

-- Trop tôt : le coup précédent n'est pas récupéré.
local ok2, raison = Frappes.Choisir(e, 1000 + 100, "secondaire")
egal(ok2, false, "coup refuse pendant la recuperation")
egal(raison, "Coup en cours", "raison dite")

-- Dans la fenêtre : le coup ENCHAÎNE, de l'autre main.
local t = 1000 + Frappes.COUPS.jab_d.recup_ms
local _, _, p2 = Frappes.Choisir(e, t, "secondaire")
egal(p2.id, "jab_g", "clic secondaire = jab main gauche")
egal(p2.etape, 2, "etape 2")

t = t + Frappes.COUPS.jab_g.recup_ms
local _, _, p3 = Frappes.Choisir(e, t, "principale")
egal(p3.id, "crochet_d", "3e coup = crochet")
t = t + Frappes.COUPS.crochet_d.recup_ms
local _, _, p4 = Frappes.Choisir(e, t, "principale")
egal(p4.id, "crochet_d", "4e coup = crochet, meme main si meme bouton")
t = t + Frappes.COUPS.crochet_d.recup_ms
local _, _, p5 = Frappes.Choisir(e, t, "secondaire")
egal(p5.id, "uppercut_g", "5e coup = uppercut")
egal(p5.finisher, true, "l'uppercut conclut")
ok(math.abs(p5.mult - Frappes.COUPS.uppercut_g.mult * Frappes.MULT_FINISHER) < 1e-9,
    "le finisher compose son multiplicateur")
egal(e.etape, 0, "la serie est close apres le finisher")

t = t + Frappes.COUPS.uppercut_g.recup_ms
local _, _, p6 = Frappes.Choisir(e, t, "principale")
egal(p6.id, "jab_d", "apres le finisher, la serie repart du jab")

-- Hors fenêtre : la série repart de zéro.
t = t + Frappes.COUPS.jab_d.recup_ms + Frappes.FENETRE_ENCHAINE_MS + 1
local _, _, p7 = Frappes.Choisir(e, t, "principale")
egal(p7.etape, 1, "hors fenetre, retour a l'etape 1")
egal(p7.id, "jab_d", "hors fenetre, retour au jab")

-- ── Coups de pied ─────────────────────────────────────────────────────────────

section("coups de pied")

e = Frappes.NouvelEtat()
local _, _, k1 = Frappes.Choisir(e, 0, "pied_droit")
egal(k1.id, "pied_d", "G = pied droit")
egal(k1.slot, "corps", "pied en FullBody")
egal(k1.finisher, false, "pied seul : pas de finisher")
egal(k1.cibles_max, 2, "un pied peut toucher deux cibles")
egal(e.etape, 0, "un pied n'ouvre pas de serie de poings")

local _, _, k2 = Frappes.Choisir(e, Frappes.COUPS.pied_d.recup_ms, "pied_gauche")
egal(k2.id, "pied_g", "K = pied gauche")

-- Pied en fin de série : il conclut.
e = Frappes.NouvelEtat()
t = 0
Frappes.Choisir(e, t, "principale"); t = t + Frappes.COUPS.jab_d.recup_ms
Frappes.Choisir(e, t, "secondaire"); t = t + Frappes.COUPS.jab_g.recup_ms
local _, _, k3 = Frappes.Choisir(e, t, "pied_droit")
egal(k3.etape, 3, "pied au 3e rang")
egal(k3.finisher, true, "pied au 3e rang = finisher")
egal(e.etape, 0, "le pied finisher clot la serie")

-- Le plan porte une COPIE des clips : le muter ne touche pas le catalogue.
k3.clips[1] = "trafique"
egal(Frappes.COUPS.pied_d.clips[1], "attack_special_kick_Anim", "catalogue intact apres mutation du plan")

-- ── Cibles ────────────────────────────────────────────────────────────────────

section("cibles")

local plan = { portee_cm = 180, demi_angle = 50, cibles_max = 1 }
local origine = { x = 0, y = 0, z = 0 }
local devant = { x = 1, y = 0 }

local cands = {
    { cle = "loin",     x = 400, y = 0,   z = 0 },
    { cle = "derriere", x = -100, y = 0,  z = 0 },
    { cle = "cote",     x = 0,   y = 150, z = 0 },
    { cle = "proche",   x = 120, y = 20,  z = 0 },
    { cle = "etage",    x = 100, y = 0,   z = 300 },
    { cle = "bord",     x = 210, y = 0,   z = 0 },
}
local r = Frappes.Cibles(origine, devant, cands, plan)
egal(#r, 1, "un seul poing, une seule cible")
egal(r[1] and r[1].cle, "proche", "la plus proche devant")

plan.cibles_max = 5
r = Frappes.Cibles(origine, devant, cands, plan)
local vus = {}
for _, c in ipairs(r) do vus[c.cle] = true end
ok(vus.proche, "devant a portee retenu")
ok(vus.bord, "portee + rayon de la cible retenue (210 <= 180 + 40)")
ok(not vus.loin, "trop loin ecarte")
ok(not vus.derriere, "derriere ecarte")
ok(not vus.cote, "hors cone ecarte")
ok(not vus.etage, "etage du dessus ecarte")
egal(r[1].cle, "proche", "tri par distance")

-- Direction non normée : même résultat.
r = Frappes.Cibles(origine, { x = 50, y = 0 }, cands, plan)
egal(r[1] and r[1].cle, "proche", "avant non norme accepte")
-- Direction nulle : rien, plutôt qu'une division par zéro.
egal(#Frappes.Cibles(origine, { x = 0, y = 0 }, cands, plan), 0, "avant nul : aucune cible")
-- Collé à l'attaquant : touche, quel que soit l'angle.
r = Frappes.Cibles(origine, devant, { { cle = "colle", x = 0.2, y = -0.2, z = 0 } }, plan)
egal(r[1] and r[1].cle, "colle", "cible collee touchee")
-- Égalité de distance : l'ordre d'arrivée départage (tri stable).
r = Frappes.Cibles(origine, devant, {
    { cle = "a", x = 100, y = 10, z = 0 }, { cle = "b", x = 100, y = -10, z = 0 } },
    { portee_cm = 180, demi_angle = 50, cibles_max = 1 })
egal(r[1] and r[1].cle, "a", "egalite : premier arrive")
-- Entrées pourries : jamais d'erreur.
egal(#Frappes.Cibles(nil, devant, cands, plan), 0, "origine absente")
egal(#Frappes.Cibles(origine, devant, { "pas une table", { x = "x" } }, plan), 1,
    "candidat invalide ignore, coordonnees non numeriques lues comme 0")

-- ── Lacet ─────────────────────────────────────────────────────────────────────

section("lacet")

egal(Frappes.LacetVers({ x = 0, y = 0 }, { x = 0, y = 0 }), nil, "points confondus : nil")
ok(math.abs(Frappes.LacetVers({ x = 0, y = 0 }, { x = 10, y = 0 }) - 0) < 1e-9, "face a +X = 0 deg")
ok(math.abs(Frappes.LacetVers({ x = 0, y = 0 }, { x = 0, y = 10 }) - 90) < 1e-9, "face a +Y = 90 deg")

-- ── Bilan ─────────────────────────────────────────────────────────────────────

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
if (echecs > 0) then error(echecs .. " test(s) en echec") end