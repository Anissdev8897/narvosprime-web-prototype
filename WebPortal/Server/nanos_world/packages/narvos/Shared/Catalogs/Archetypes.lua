-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Catalogs/Archetypes.lua — les 10 archétypes de compétences
-- (port de skills/archetypes.ts `ARCHETYPES`).
--
-- SOURCE : WebPortal/src/rpg/skills/archetypes.ts. Le générateur (Competences.lua)
-- combine : classe (élément, attackPower) × archétype (mult, cooldown) → compétence.
-- ═══════════════════════════════════════════════════════════════════════════════

local Archetypes = {}

Archetypes.ARCHETYPES = {
    basic =      { archetype = "basic",      nom_suffixe = "Frappe",       degats_mult = 1.0, soin_mult = 0.0, mana_cost = 0,  cooldown = 0.5,  animation = "attack",      desc_template = "Attaque de base {element}. Rapide, sans coût de mana." },
    projectile = { archetype = "projectile", nom_suffixe = "Trait",        degats_mult = 1.8, soin_mult = 0.0, mana_cost = 12, cooldown = 0.9,  animation = "cast",        desc_template = "Projectile {element} à tête chercheuse. Dégâts directs élevés." },
    aoe =        { archetype = "aoe",        nom_suffixe = "Tempête",      degats_mult = 2.2, soin_mult = 0.0, mana_cost = 25, cooldown = 2.5,  animation = "ultimate",    desc_template = "Zone d'effet {element}. Frappe tous les ennemis alentour." },
    shield =     { archetype = "shield",     nom_suffixe = "Égide",        degats_mult = 0.0, soin_mult = 4.0, mana_cost = 20, cooldown = 8.0,  animation = "channeling",  desc_template = "Bouclier {element} qui absorbe les dégâts pendant 6s." },
    dash =       { archetype = "dash",       nom_suffixe = "Élan",         degats_mult = 0.8, soin_mult = 0.0, mana_cost = 10, cooldown = 4.0,  animation = "dodge",       desc_template = "Déplacement rapide {element}. Inflige des dégâts sur le passage." },
    summon =     { archetype = "summon",     nom_suffixe = "Invocation",   degats_mult = 1.5, soin_mult = 0.0, mana_cost = 30, cooldown = 12.0, animation = "channeling",  desc_template = "Invoque une entité {element} qui combat à vos côtés 15s." },
    ultimate =   { archetype = "ultimate",   nom_suffixe = "Apocalypse",   degats_mult = 5.0, soin_mult = 0.0, mana_cost = 60, cooldown = 30.0, animation = "ultimate",    desc_template = "Capacité ultime {element}. Dégâts dévastateurs sur large zone." },
    cc =         { archetype = "cc",         nom_suffixe = "Emprise",      degats_mult = 0.5, soin_mult = 0.0, mana_cost = 18, cooldown = 6.0,  animation = "cast",        desc_template = "Contrôle {element} : immobilise/étourdit l'ennemi 3s." },
    buff =       { archetype = "buff",       nom_suffixe = "Bénédiction",  degats_mult = 0.0, soin_mult = 2.0, mana_cost = 22, cooldown = 15.0, animation = "channeling",  desc_template = "Améliore les alliés : +30% dégâts {element} pendant 10s." },
    debuff =     { archetype = "debuff",     nom_suffixe = "Affliction",   degats_mult = 0.6, soin_mult = 0.0, mana_cost = 16, cooldown = 7.0,  animation = "cast",        desc_template = "Affaiblit l'ennemi : -30% résistance {element} pendant 8s." },
}

-- Clés des archétypes, dans l'ordre de définition (parité ARCHETYPE_IDS).
Archetypes.IDS = { "basic", "projectile", "aoe", "shield", "dash", "summon", "ultimate", "cc", "buff", "debuff" }

return Archetypes