-- Tests de Shared/Logic/Competences.lua (comportement).
local reussis, echecs = 0, 0
local function ok(c, n) if c then reussis = reussis + 1 else echecs = echecs + 1; print("  ÉCHEC: " .. n) end end
local function egal(a, b, n) ok(a == b, n .. " (obtenu " .. tostring(a) .. ", attendu " .. tostring(b) .. ")") end

-- ── Statistiques globales ──────────────────────────────────────────────────────
local stats = Competences.Stats()
egal(stats.total, 40, "total compétences = 40 (4 classes × 10 archétypes)")
egal(stats.par_classe, 10, "10 archétypes / classe")
egal(stats.classes, 4, "4 classes")

-- ── Génération pour une classe ─────────────────────────────────────────────────
-- warrior_bruiser + basic → "Frappe de Électrique", damage = round(26 × 1.0)
local comp = Competences.PourClasse("warrior_bruiser")
egal(#comp, 10, "warrior_bruiser → 10 compétences")
egal(comp[1].id, "warrior_bruiser_basic", "id = classe_archetype")
egal(comp[1].label, "Frappe de Électrique", "label non-ultimate = suffixe de élément")
egal(comp[1].damage, 26, "damage = round(26 × 1.0)")
egal(comp[1].mana_cost, 0, "basic : mana gratuit")
egal(comp[1].vfx, "electric_basic", "vfx = element_archetype")

-- Ultimate + label "Apocalypse ..." (pas "de")
local ult = Competences.PourClasse("warrior_dps")
egal(ult[7].label, "Apocalypse Feu", "ultimate label = 'Apocalypse <element>'")
egal(ult[7].damage, 150, "ultimate damage = round(30 × 5.0)")
egal(ult[7].mana_cost, 60, "ultimate mana 60")

-- ── Obtenir (parité getSkill) ──────────────────────────────────────────────────
local skill = Competences.Obtenir("warrior_tank_shield")
egal(skill.heal, 40, "shield heal = round(4.0 × 10)")
egal(skill.animation, "channeling", "shield animation")
egal(skill.description, "Bouclier terre qui absorbe les dégâts pendant 6s.", "description {element} substitué")
egal(Competences.Obtenir("inexistant"), nil, "id inconnu → nil")

print(("\ncomportement : %d reussis, %d echec(s)"):format(reussis, echecs))
if (echecs > 0) then os.exit(1) end