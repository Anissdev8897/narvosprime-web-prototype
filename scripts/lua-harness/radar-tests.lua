-- Tests de Shared/Logic/Radar.lua (filtre/tri/plafond).
local reussis, echecs = 0, 0
local function ok(cond, nom) if (cond) then reussis = reussis + 1 else echecs = echecs + 1; print("  ÉCHEC: " .. nom) end end
local function egal(a, b, nom) ok(a == b, nom .. "  (obtenu=" .. tostring(a) .. ", attendu=" .. tostring(b) .. ")") end

-- ── Points : filtre par rayon autour d'un joueur ──────────────────────────────
local points = {
    { id = "A", x = 10, z = 0, label = "portail N" },
    { id = "B", x = -30, z = 40, label = "gisement" },
    { id = "C", x = 0, z = 5, label = "portail E" },
    { id = "D", x = 200, z = 200, label = "loin" },
}
local dans = Radar.Points(points, 0, 0, 50, nil) -- rayon 50 m
egal(#dans, 3, "3 points dans le rayon 50 m")
egal(dans[1].point.id, "C", "le plus proche en premier (C à 5 m)")
egal(dans[2].point.id, "A", "puis A (10 m)")
egal(dans[3].point.id, "B", "puis B (50 m)")

-- ── Plafond : max limite la liste, les plus proches restent ──────────────────
local cap = Radar.Points(points, 0, 0, 50, 2)
egal(#cap, 2, "plafond à 2 points")
egal(cap[1].point.id, "C", "plafond garde le plus proche (C)")
egal(cap[2].point.id, "A", "plafond garde le second (A)")

-- ── Rayon 0 : ne garde que les points exactement sur le joueur ───────────────
egal(#Radar.Points(points, 0, 0, 0, nil), 0, "rayon 0 → aucun (aucun point à distance 0)")

-- ── DansRayon : comptage sans tri ─────────────────────────────────────────────
egal(Radar.DansRayon(points, 0, 0, 50), 3, "DansRayon 50 m = 3")
egal(Radar.DansRayon(points, 0, 0, 9), 1, "DansRayon 9 m = 1 (C à 5 m)")

-- ── Points hors rayon ignorés, même au-delà du bord monde ─────────────────────
local p2 = { { id = "far", x = -500, z = 0 }, { id = "near", x = 7, z = 4 } }
local d2 = Radar.Points(p2, 0, 0, 10, nil)
egal(#d2, 1, "seul 'near' dans le rayon 10 m")
egal(d2[1].point.id, "near", "near (distance 8.06) retenu")

-- ══ Styles des repères (B5, /editionpnj) ══════════════════════════════════════

-- Chaque sorte a son défaut, complet.
for _, sorte in ipairs(Radar.SORTES) do
    local s = Radar.STYLE_SORTE[sorte]
    ok(s and #s.teinte == 3 and type(s.taille) == "number" and s.visible == true, "defaut complet : " .. sorte)
    ok(Radar.LIBELLES_SORTES[sorte] ~= nil, "libelle : " .. sorte)
end

-- Sans réglage : défaut de sorte, couleur de rôle pour un PNJ.
local s0 = Radar.Style({ sorte = "pnj", id = "sk_murdock", role = "ennemi" }, nil)
egal(s0.teinte[1], Radar.TEINTE_ROLE.ennemi[1], "PNJ ennemi : teinte du role")
egal(s0.taille, Radar.STYLE_SORTE.pnj.taille, "PNJ : taille de sorte")
local sa = Radar.Style({ sorte = "animal", id = "fox" }, nil)
egal(sa.teinte[1], Radar.STYLE_SORTE.animal.teinte[1], "animal : teinte de sorte")
egal(Radar.Style({ sorte = "inconnue" }, nil).taille, Radar.STYLE_SORTE.pnj.taille, "sorte inconnue : repli PNJ")

-- Priorité sorte < rôle < entrée ; un réglage partiel ne touche que son champ.
local reglages = {
    sortes = { pnj = { taille = 5 } },
    roles = { ennemi = { teinte = { 0, 0, 1 } } },
    ids = { [Radar.CleEntree("pnj", "sk_murdock")] = { visible = false } },
}
local s1 = Radar.Style({ sorte = "pnj", id = "sk_murdock", role = "ennemi" }, reglages)
egal(s1.taille, 5, "reglage de sorte applique (taille)")
egal(s1.teinte[3], 1, "reglage de role applique (teinte)")
egal(s1.visible, false, "reglage d'entree applique (visible)")
local s2 = Radar.Style({ sorte = "pnj", id = "autre", role = "ennemi" }, reglages)
egal(s2.visible, true, "reglage d'entree limite a son entree")
local s3 = Radar.Style({ sorte = "animal", id = "sk_murdock" }, reglages)
egal(s3.visible, true, "cle d'entree prefixee par la sorte : un animal de meme id n'herite pas")
-- Le style rendu est une COPIE : le muter ne touche ni le défaut ni le réglage.
s1.teinte[1] = 0.123
egal(Radar.STYLE_SORTE.pnj.teinte[1], 1.00, "defaut intact apres mutation du style rendu")

-- Normalisation : bornes, champs partiels, refus.
local n1 = Radar.NormaliserStyle({ teinte = { 2, -1, 0.5 }, taille = 99 })
egal(n1.teinte[1], 1, "teinte bornee haut")
egal(n1.teinte[2], 0, "teinte bornee bas")
egal(n1.taille, Radar.TAILLE_MAX, "taille bornee")
egal(n1.visible, nil, "champ non fourni absent")
egal(select(1, Radar.NormaliserStyle(nil)), nil, "reglage absent refuse")
egal(select(1, Radar.NormaliserStyle({})), nil, "reglage vide refuse")
egal(select(1, Radar.NormaliserStyle({ teinte = { "x", 0, 0 } })), nil, "teinte non numerique refusee")
egal(select(1, Radar.NormaliserStyle({ visible = "oui" })), nil, "visible non booleen refuse")
egal(Radar.NormaliserStyle({ visible = false }).visible, false, "visible false accepte")

-- Classement des entités.
local cat = function(id) if (id == "sk_murdock") then return { role = "ennemi", famille = "Defender", label = "Murdock" } end end
local c1 = Radar.Classer({ pnj = "sk_murdock" }, cat)
egal(c1.sorte, "pnj", "PNJ du catalogue : sorte pnj")
egal(c1.role, "ennemi", "PNJ du catalogue : role lu")
egal(c1.label, "Murdock", "PNJ du catalogue : libelle lu")
egal(Radar.Classer({ pnj = "compagnon:fox" }, cat).sorte, "animal", "compagnon : sorte animal")
egal(Radar.Classer({ pnj = "compagnon:fox" }, cat).id, "fox", "compagnon : id = espece")
egal(Radar.Classer({ marchand = "lyra", pnj = "lyra_pnj" }, cat).role, "marchand", "marchand : role marchand")
egal(Radar.Classer({ vehicule = "pickup" }, cat).sorte, "vehicule", "vehicule : sorte vehicule")
egal(Radar.Classer({ pnj = "inconnu" }, cat).role, "neutre", "PNJ hors catalogue : neutre")
egal(Radar.Classer({}, cat), nil, "rien ne le nomme : nil (joueur, decor)")
egal(Radar.Classer(nil, cat), nil, "valeurs absentes : nil")

print(("\ncomportement : %d reussis, %d echec(s)"):format(reussis, echecs))
if (echecs > 0) then os.exit(1) end