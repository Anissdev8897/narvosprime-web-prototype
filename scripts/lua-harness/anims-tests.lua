-- ══════════════════════════════════════════════════════════════════════════════
-- anims-tests.lua — assertions sur Shared/Logic/Animations.lua.
-- Les noms utilisés ici sont de VRAIS noms relevés dans public/models/armes,
-- pas des exemples inventés : c'est ce qui rend le test représentatif.
-- ══════════════════════════════════════════════════════════════════════════════

local reussis, echecs = 0, 0

local function ok(c, nom)
    if (c) then reussis = reussis + 1
    else echecs = echecs + 1; print("  ECHEC  " .. nom) end
end

local function egal(obtenu, attendu, nom)
    if (obtenu == attendu) then reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom .. "  obtenu=" .. tostring(obtenu) .. "  attendu=" .. tostring(attendu))
    end
end

local function section(n) print("[" .. n .. "]") end

-- ── Décomposition ─────────────────────────────────────────────────────────────

section("decomposition")

local b, v, m = Animations.Decomposer("ACB_Attack_01_A_IP")
egal(b, "ACB_Attack_01", "base garde le numero d'attaque")
egal(v, "A", "variante alphabetique")
egal(m, "IP", "mode IP")

b, v, m = Animations.Decomposer("ACB_Hurt_01_IP")
egal(b, "ACB_Hurt", "base sans le numero de prise")
egal(v, "01", "variante numerique")
egal(m, "IP", "mode IP")

-- Le piège d'ordre : retirer la variante avant le mode donnerait la variante
-- « 01_IP » et une base « ACB_Hurt_0 ».
b, v, m = Animations.Decomposer("ACB_Hurt_Knockback_02_RM")
egal(b, "ACB_Hurt_Knockback", "base composee preservee")
egal(v, "02", "variante 02")
egal(m, "RM", "mode RM")

b, v, m = Animations.Decomposer("Anim_Mann_PAS_SideReloading_03")
egal(b, "Anim_Mann_PAS_SideReloading", "base sans mode")
egal(v, "03", "variante 03")
egal(m, nil, "aucun mode")

b, v, m = Animations.Decomposer("ACB_Dead_IP")
egal(b, "ACB_Dead", "action sans variante")
egal(v, nil, "pas de variante")
egal(m, "IP", "mode seul")

b, v, m = Animations.Decomposer("A_Glock_Fire")
egal(b, "A_Glock_Fire", "nom sans suffixe reste entier")
egal(v, nil, "pas de variante")
egal(m, nil, "pas de mode")

-- Le suffixe `_Anim` qu'Interchange ajoute a tout AnimSequence importe. Sans son
-- retrait prealable, le mode n'est plus en fin de chaine : le chargement avait
-- annonce « 0 action en IP et RM » sur 657, alors que 26 le sont.
b, v, m = Animations.Decomposer("ACB_Attack_03_B_RM_Anim")
egal(b, "ACB_Attack_03", "base malgre le suffixe _Anim")
egal(v, "B", "variante malgre _Anim")
egal(m, "RM", "mode retrouve malgre _Anim")

b, v, m = Animations.Decomposer("ACB_Hurt_01_IP_Anim")
egal(b, "ACB_Hurt", "base numerique malgre _Anim")
egal(m, "IP", "mode IP malgre _Anim")

b, v, m = Animations.Decomposer("ThirdPersonRun_Anim")
egal(b, "ThirdPersonRun", "action simple sans mode ni variante")
egal(m, nil, "aucun mode a inventer")

-- ── Regroupement ──────────────────────────────────────────────────────────────

section("regroupement")

local noms = {
    "ACB_Attack_01_A_IP", "ACB_Attack_01_B_IP", "ACB_Attack_01_C_IP",
    "ACB_Attack_01_A_RM", "ACB_Attack_01_B_RM", "ACB_Attack_01_C_RM",
    "ACB_Hurt_01_IP", "ACB_Hurt_02_IP", "ACB_Hurt_03_IP",
    "ACB_Dead_IP",
    "Anim_Mann_PAS_SideReloading_01", "Anim_Mann_PAS_SideReloading_02",
}
local sets = Animations.Grouper(noms)

egal(#sets["ACB_Attack_01"].IP, 3, "trois prises IP pour ACB_Attack_01")
egal(#sets["ACB_Attack_01"].RM, 3, "trois prises RM")
egal(#sets["ACB_Hurt"].IP, 3, "trois prises pour ACB_Hurt")
egal(sets["ACB_Hurt"].RM, nil, "ACB_Hurt n'a pas de RM")
egal(#sets["ACB_Dead"].IP, 1, "ACB_Dead a une seule prise")
egal(#sets["Anim_Mann_PAS_SideReloading"]["-"], 2, "les sans-mode vont sous la cle -")

-- L'ordre doit etre stable : deux serveurs avec la meme graine doivent tirer
-- la meme variante.
egal(sets["ACB_Attack_01"].IP[1], "ACB_Attack_01_A_IP", "liste triee")

-- ── Choix du mode ─────────────────────────────────────────────────────────────

section("mode")

egal(Animations.ModePour({}), "RM", "par defaut, root motion")
egal(Animations.ModePour({ verrouille = true }), "IP", "cible verrouillee -> sur place")
egal(Animations.ModePour({ pilote_par_code = true }), "IP", "deplacement deja pilote -> sur place")
egal(Animations.ModePour({ au_sol = false }), "IP", "en l'air -> sur place")
egal(Animations.ModePour({ au_sol = true }), "RM", "au sol -> root motion")
egal(Animations.ModePour(nil), "RM", "contexte absent ne plante pas")

-- ── Tirage ────────────────────────────────────────────────────────────────────

section("tirage")

egal(Animations.Choisir(sets, "action_inconnue"), nil, "action inconnue rend nil")
egal(Animations.Choisir(nil, "ACB_Attack_01"), nil, "sets nil rend nil")
egal(Animations.Choisir(sets, "ACB_Dead", "IP"), "ACB_Dead_IP", "prise unique rendue directement")

-- Repli : ACB_Hurt n'existe qu'en IP. Demander du RM doit quand meme jouer.
local hurt = Animations.Choisir(sets, "ACB_Hurt", "RM", nil, function() return 0 end)
egal(hurt, "ACB_Hurt_01_IP", "repli du RM vers l'IP quand le RM manque")

-- Le mode demande est prioritaire.
local ip = Animations.Choisir(sets, "ACB_Attack_01", "IP", nil, function() return 0 end)
egal(ip, "ACB_Attack_01_A_IP", "mode IP respecte")
local rm = Animations.Choisir(sets, "ACB_Attack_01", "RM", nil, function() return 0 end)
egal(rm, "ACB_Attack_01_A_RM", "mode RM respecte")

-- Anti-repetition : avec un rng constant, un tirage naif redonnerait toujours
-- la meme. L'etat doit forcer le decalage.
local etat = {}
local rngFixe = function() return 0 end
local a1 = Animations.Choisir(sets, "ACB_Attack_01", "IP", etat, rngFixe)
local a2 = Animations.Choisir(sets, "ACB_Attack_01", "IP", etat, rngFixe)
local a3 = Animations.Choisir(sets, "ACB_Attack_01", "IP", etat, rngFixe)
-- Le contrat est « jamais la MÊME deux fois de suite », pas une rotation.
-- A puis B puis A est donc conforme : c'est le doublon IMMÉDIAT qu'on interdit,
-- et vouloir davantage rendrait la séquence prévisible, ce qui est le défaut
-- qu'on cherchait à corriger.
ok(a1 ~= a2, "deux tirages consecutifs different")
ok(a2 ~= a3, "trois tirages consecutifs sans doublon immediat")
egal(a1, "ACB_Attack_01_A_IP", "premier tirage")
egal(a2, "ACB_Attack_01_B_IP", "decalage quand le tirage redonne le precedent")

local valides = { ACB_Attack_01_A_IP = true, ACB_Attack_01_B_IP = true, ACB_Attack_01_C_IP = true }
ok(valides[a3], "le troisieme tirage reste une prise de l'ensemble")

-- Les historiques IP et RM sont separes : alterner ne doit pas effacer l'un.
local etat2 = {}
Animations.Choisir(sets, "ACB_Attack_01", "IP", etat2, rngFixe)
Animations.Choisir(sets, "ACB_Attack_01", "RM", etat2, rngFixe)
local retourIP = Animations.Choisir(sets, "ACB_Attack_01", "IP", etat2, rngFixe)
ok(retourIP ~= "ACB_Attack_01_A_IP", "l'historique IP survit a un detour par le RM")

-- Sans etat, le module ne doit pas planter.
ok(Animations.Choisir(sets, "ACB_Attack_01", "IP", nil, rngFixe) ~= nil, "tirage sans historique")

-- ── Nom d'asset ───────────────────────────────────────────────────────────────

section("asset")

egal(Animations.Asset("ACB_Attack_01_A_IP"), "narvos::ACB_Attack_01_A_IP", "prefixe du pack")

-- ── Resume ────────────────────────────────────────────────────────────────────

section("resume")

local r = Animations.Resume(sets)
egal(r.actions, 4, "quatre actions distinctes")
egal(r.a_variantes, 3, "trois actions a prises multiples")
egal(r.a_deux_modes, 1, "une seule action en IP et RM")

print("")
print(reussis .. " réussis, " .. echecs .. " échoués")
if (echecs > 0) then error("des tests ont échoué", 0) end