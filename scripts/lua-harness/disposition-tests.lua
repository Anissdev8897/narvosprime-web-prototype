-- ══════════════════════════════════════════════════════════════════════════════
-- disposition-tests.lua — assertions sur Shared/Logic/Disposition.lua.
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

local function proche(a, b, nom)
    ok(type(a) == "number" and math.abs(a - b) < 1e-9, nom .. "  obtenu=" .. tostring(a) .. " attendu=" .. tostring(b))
end

local function section(nom) print("[" .. nom .. "]") end

-- ── Défaut ────────────────────────────────────────────────────────────────────
section("defaut")

local d = Disposition.Defaut()
for _, z in ipairs(Disposition.ZONES) do
    ok(d.zones[z.id] ~= nil, "zone par defaut : " .. z.id)
    ok(z.x > 0 and z.x < 1 and z.y > 0 and z.y < 1, "defaut dans l'ecran : " .. z.id)
    ok(type(z.libelle) == "string" and z.libelle ~= "", "libelle : " .. z.id)
end
for _, o in ipairs(Disposition.OPTIONS) do
    egal(d.options[o.id], o.defaut, "option par defaut : " .. o.id)
end
-- Deux appels rendent deux tables : muter l'une ne touche pas l'autre.
d.zones.vitalite.x = 0.9
ok(Disposition.Defaut().zones.vitalite.x ~= 0.9, "Defaut rend une table neuve")

-- ── Normaliser ────────────────────────────────────────────────────────────────
section("normaliser")

local n = Disposition.Normaliser({
    zones = { vitalite = { x = 0.2, y = 0.3 }, fantome = { x = 0.5, y = 0.5 },
              arme = { x = 5, y = -2 }, sorts = { x = "x", y = 0.5 } },
    options = { boussole = false, carte = "oui", inconnue = true },
})
proche(n.zones.vitalite.x, 0.2, "position lue")
egal(n.zones.fantome, nil, "zone inconnue ecartee")
proche(n.zones.arme.x, 1 - Disposition.MARGE, "x borne haut")
proche(n.zones.arme.y, Disposition.MARGE, "y borne bas")
proche(n.zones.sorts.x, 0.50, "position non numerique : defaut garde")
egal(n.options.boussole, false, "option booleenne lue")
egal(n.options.carte, false, "option non booleenne : defaut garde")
egal(n.options.inconnue, nil, "option inconnue ecartee")
egal(Disposition.Normaliser(nil).options.boussole, true, "rien : defaut complet")
egal(Disposition.Normaliser("texte").zones.messages.y, 0.10, "type faux : defaut complet")

-- ── Placer, Regler ────────────────────────────────────────────────────────────
section("placer et regler")

local base = Disposition.Defaut()
local placee = Disposition.Placer(base, "carte", 0.3, 0.4)
proche(placee.zones.carte.x, 0.3, "zone placee")
proche(base.zones.carte.x, 0.90, "l'ancienne disposition n'est pas mutee")
egal(select(1, Disposition.Placer(base, "zone_x", 0.3, 0.4)), nil, "zone inconnue refusee")
egal(select(1, Disposition.Placer(base, "carte", "a", 0.4)), nil, "position invalide refusee")
proche(Disposition.Placer(base, "carte", -1, 2).zones.carte.x, Disposition.MARGE, "placement borne")

local reglee = Disposition.Regler(base, "carte", true)
egal(reglee.options.carte, true, "option reglee")
egal(base.options.carte, false, "option : ancienne non mutee")
egal(select(1, Disposition.Regler(base, "carte", 1)), nil, "valeur non booleenne refusee")
egal(select(1, Disposition.Regler(base, "inconnue", true)), nil, "option inconnue refusee")

-- ── Boussole ──────────────────────────────────────────────────────────────────
section("boussole")

-- Convention du radar : nord = -Y (en haut), est = +X (à droite).
proche(Disposition.Cap(-90), 0, "regard vers -Y = nord")
proche(Disposition.Cap(0), 90, "regard vers +X = est")
proche(Disposition.Cap(90), 180, "regard vers +Y = sud")
proche(Disposition.Cap(180), 270, "regard vers -X = ouest")
proche(Disposition.Cap(-180), 270, "lacet -180 = ouest aussi")
proche(Disposition.Cap(630), 0, "lacet hors tour ramene")
egal(Disposition.Cap(nil), nil, "lacet absent : nil")

local attendus = { [0] = "N", [45] = "NE", [90] = "E", [135] = "SE", [180] = "S", [225] = "SO", [270] = "O", [315] = "NO" }
for cap, nom in pairs(attendus) do egal(Disposition.Cardinal(cap), nom, "cardinal " .. cap) end
egal(Disposition.Cardinal(22.4), "N", "22,4 : encore nord")
egal(Disposition.Cardinal(22.5), "NE", "22,5 : bascule nord-est")
egal(Disposition.Cardinal(359), "N", "359 : nord")
egal(Disposition.Cardinal(-45), "NO", "cap negatif ramene")
egal(Disposition.Cardinal("x"), nil, "cap invalide : nil")
egal(#Disposition.CARDINAUX, 8, "huit directions")

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
if (echecs > 0) then error(echecs .. " test(s) en echec") end