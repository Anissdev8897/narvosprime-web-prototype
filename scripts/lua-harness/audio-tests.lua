-- Tests de Shared/Logic/Audio.lua (logique pure de sélection).
local reussis, echecs = 0, 0
local function ok(c, n) if c then reussis = reussis + 1 else echecs = echecs + 1; print("  ÉCHEC: " .. n) end end
local function egal(a, b, n) ok(a == b, n .. " (obtenu " .. tostring(a) .. ", attendu " .. tostring(b) .. ")") end

-- ── Série de kills : palier + fenêtre (logique LoL/Halo) ─────────────────────
Audio.SerieReset()
egal(Audio.SerieKill(), 1, "1er kill → série 1")
egal(Audio.SerieNiveau(), nil, "série 1 → pas d'annonce")
egal(Audio.SerieKill(), 2, "2e kill → série 2")
egal(Audio.SerieNiveau().son, "double_kils.mp3", "palier 2 → DOUBLE")
egal(Audio.SerieKill(), 3, "3e kill → série 3")
egal(Audio.SerieNiveau().son, "triple_frague.mp3", "palier 3 → TRIPLE")
egal(Audio.SerieKill(), 4, "4e kill → série 4")
egal(Audio.SerieKill(), 5, "5e kill → série 5")
egal(Audio.SerieNiveau().son, "pentakil.mp3", "palier 5 → PENTA")
egal(Audio.SerieKill(), 6, "6e kill → série 6")
egal(Audio.SerieNiveau().son, "masacre.mp3", "palier 6+ → MASSACRE")

-- Fenêtre : au-delà de 10 s → reset
Audio.SerieReset()
Audio.SerieKill() -- série 1
Audio.SerieTick(11) -- dépasse la fenêtre
egal(Audio.SerieCount(), 0, "série remise à zéro après la fenêtre (11 s)")
egal(Audio.SerieKill(), 1, "repart à 1 après reset")

-- ── Boss : alerte AoE jouée 1× par boss ───────────────────────────────────────
Audio.BossReset()
local son1 = Audio.BossEngage("GolemLava")
local son2 = Audio.BossEngage("GolemLava")
egal(son1, "aoe.mp3", "boss : alerte jouée")
egal(son2, nil, "boss : pas rejouée pour le même boss")
egal(Audio.BossEngage("AutreBoss"), "aoe.mp3", "boss : rejouée pour un AUTRE boss")

-- ── Classif surface : matériau → catégorie (première règle qui matche) ───────
egal(Audio.ClasseSurface("MTL_MWAM_Grass__autoMaterial"), "grass", "matériau grass")
egal(Audio.ClasseSurface("Metal_Floor"), "metalbar", "matériau metal")
egal(Audio.ClasseSurface("Concrete_Slab"), "concrete", "matériau concrete")
egal(Audio.ClasseSurface("Eau_de_lac"), "water", "matériau eau")
egal(Audio.ClasseSurface("Inconnu_Solide"), "grass", "matériau inconnu → repli grass")
egal(Audio.ClasseSurface("Neige_poudreuse"), "snow", "matériau neige")

-- ── Annonce de zone ───────────────────────────────────────────────────────────
local forge = Audio.AnnounceZone("forge")
egal(forge.entree, "entre_de_la_mapforge.mp3", "forge : entrée")
egal(forge.niveau, "1_a_10_mapforge.mp3", "forge : niveau")
egal(forge.delai_ms, 3500, "forge : délai niveau")
local donjon = Audio.AnnounceZone("donjon_v1")
egal(donjon.entree, "entre_dans_le_dojon.mp3", "donjon : entrée immersive")
egal(Audio.AnnounceZone("inconnue"), nil, "map inconnue → rien")

print(("\ncomportement : %d reussis, %d echec(s)"):format(reussis, echecs))
if (echecs > 0) then os.exit(1) end