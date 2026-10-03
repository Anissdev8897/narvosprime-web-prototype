--- ── Qualite graphique — trois niveaux ─────────────────────────────────────────
---
--- Module PUR : aucune dependance a l'API nanos, donc testable au harnais
--- (`scripts/lua-harness/graphismes.mjs`). L'application des valeurs est le
--- travail de `narvos-map-proto/Client/Index.lua`, qui est l'executant.
---
--- ── CE QUE NANOS PERMET REELLEMENT DE REGLER, ET CE QU'IL NE PERMET PAS ───────
---
--- Releve fait le 2026-09-08 dans `libraries/api-main/api-main/`, classe par
--- classe. Le resultat contredit ce qu'on attend d'un menu graphique :
---
---   IMPOSSIBLE depuis Lua                       POURQUOI
---   ─────────────────────────────────────────   ───────────────────────────────
---   sg.ShadowQuality, sg.ViewDistanceQuality…   `Console.RunCommand` : « only
---   r.ScreenPercentage, antialiasing,           scripting-registered commands
---   resolution des ombres, qualite de texture   can be triggered ». Les
---                                               commandes moteur sont fermees.
---
--- Ces reglages-la vivent dans le menu de nanos, et le joueur les regle une fois
--- pour toutes. Ce module ne les remplace pas : il regle ce qui est A NOUS —
--- l'ambiance post-process, le ciel, la distance d'affichage de nos acteurs.
---
--- Les leviers RETENUS, tous verifies `[client]` sauf mention :
---
---   PostProcess.SetBloom(intensity, threshold)
---   PostProcess.SetChromaticAberration(intensity, start_offset)
---   PostProcess.SetImageEffects(vignette_intensity, film_grain_intensity)
---   Sky.SetCloudCoverage(cloud_coverage)     nuages volumetriques = tres cher
---   Sky.SetFog(fog_percentage)               brouillard volumetrique
---   Client.SetNearClipPlane(near_clip_plane)
---   Viewport.SetBloodScreenEnabled(boolean)
---   Actor:SetCastShadow(boolean)             [both] — par acteur
---   Actor:SetRenderCullDistance(integer)     [both] — par acteur
---
--- ⚠ « Eleve » n'est PAS « les valeurs par defaut d'Unreal ». Aucun getter
--- n'existe pour le post-process : on ne peut pas lire l'etat initial pour y
--- revenir. « Eleve » est donc un rendu de reference CHOISI, ecrit ici en clair.
--- Le jour ou l'ambiance du jeu change, c'est cette table qu'on modifie.

local Graphismes = {}

--- Du moins cher au plus cher. L'ordre fait foi : l'interface l'affiche ainsi,
--- et `Suivant` y tourne en rond.
Graphismes.NIVEAUX = { "faible", "moyen", "eleve" }

Graphismes.LIBELLES = {
    faible = "Faible",
    moyen  = "Moyen",
    eleve  = "Eleve",
}

--- Ce que chaque niveau coute et rend, en une phrase — affiche sous le bouton.
Graphismes.RESUMES = {
    faible = "Aucun effet d'image, ciel degage, portee reduite. Pour tenir 60 fps sur une machine modeste.",
    moyen  = "Effets d'ambiance mesures, nuages legers, ombres conservees.",
    eleve  = "Rendu de reference : grain, aberration, nuages et brouillard complets.",
}

--- ⚠ `cull` en centimetres — Unreal travaille en cm, pas en metres. 15 000 =
--- 150 m. Confondre les deux donne une portee de 150 m la ou on voulait 15 km,
--- ou l'inverse : c'est l'erreur qui a rendu 31 PNJ hauts de 1,7 cm.
---
--- ⚠ `cull = 0` n'est PAS documente comme « illimite ». La description dit
--- seulement « Sets this Actor's render cull distance ». On met donc une valeur
--- grande et explicite plutot que de parier sur une convention.
Graphismes.PROFILS = {
    faible = {
        bloom_intensite      = 0.0,
        bloom_seuil          = -1.0,
        aberration_intensite = 0.0,
        aberration_depart    = 0.0,
        vignette             = 0.0,
        grain                = 0.0,
        nuages               = 0.0,
        brouillard           = 0.0,
        plan_proche          = 15.0,
        ecran_sang           = false,
        ombres               = false,
        cull                 = 15000,
    },
    moyen = {
        bloom_intensite      = 0.35,
        bloom_seuil          = -1.0,
        aberration_intensite = 0.0,
        aberration_depart    = 0.0,
        vignette             = 0.2,
        grain                = 0.0,
        nuages               = 0.35,
        brouillard           = 0.3,
        plan_proche          = 10.0,
        ecran_sang           = true,
        ombres               = true,
        cull                 = 60000,
    },
    eleve = {
        bloom_intensite      = 0.675,
        bloom_seuil          = -1.0,
        aberration_intensite = 0.1,
        aberration_depart    = 0.0,
        vignette             = 0.4,
        grain                = 0.15,
        nuages               = 0.6,
        brouillard           = 0.5,
        plan_proche          = 5.0,
        ecran_sang           = true,
        ombres               = true,
        cull                 = 250000,
    },
}

Graphismes.DEFAUT = "moyen"

--- Vrai si `nom` designe un niveau connu.
---@param nom any
---@return boolean
function Graphismes.Existe(nom)
    return type(nom) == "string" and Graphismes.PROFILS[nom] ~= nil
end

--- Ramene une entree quelconque a un niveau valide.
---
--- ⚠ Retourne TOUJOURS un niveau, jamais nil. Un menu graphique qui rend nil
--- laisse l'executant appliquer nil a `SetBloom`, et le rendu part en vrille
--- sans qu'aucune ligne ne signale d'ou ca vient.
---@param nom any
---@return string
function Graphismes.Normaliser(nom)
    if (Graphismes.Existe(nom)) then return nom end
    return Graphismes.DEFAUT
end

--- Copie du profil. On rend une COPIE et pas la table interne : l'executant
--- ecrirait dedans, et le niveau suivant hériterait de la modification sans que
--- rien ne l'explique.
---@param nom any
---@return table
function Graphismes.Profil(nom)
    local source = Graphismes.PROFILS[Graphismes.Normaliser(nom)]
    local copie = {}
    for cle, valeur in pairs(source) do copie[cle] = valeur end
    return copie
end

--- Niveau suivant dans l'ordre, en boucle. Sert au raccourci clavier.
---@param nom any
---@return string
function Graphismes.Suivant(nom)
    local actuel = Graphismes.Normaliser(nom)
    for i, n in ipairs(Graphismes.NIVEAUX) do
        if (n == actuel) then
            return Graphismes.NIVEAUX[(i % #Graphismes.NIVEAUX) + 1]
        end
    end
    return Graphismes.DEFAUT
end

--- Ce que l'interface affiche : la liste complete, avec le niveau courant
--- marque. Construite ici et pas dans le JavaScript pour que les libelles et
--- l'ordre aient UNE seule source — une liste recopiee finit toujours par
--- diverger de la sienne.
---@param actuel any
---@return table
function Graphismes.PourInterface(actuel)
    local courant = Graphismes.Normaliser(actuel)
    local liste = {}
    for i, nom in ipairs(Graphismes.NIVEAUX) do
        local p = Graphismes.PROFILS[nom]
        liste[i] = {
            id      = nom,
            libelle = Graphismes.LIBELLES[nom],
            resume  = Graphismes.RESUMES[nom],
            actif   = (nom == courant),
            -- ⚠ Chiffres DERIVES du profil, jamais recopies. Un menu graphique
            -- qui annonce « portee reduite » sans dire combien ne se verifie
            -- pas ; un qui annonce 150 m se verifie en marchant. Et si le profil
            -- change, la ligne affichee change avec lui.
            --
            -- ⚠ `cull` est en CENTIMETRES (Unreal), l'affichage en METRES.
            -- La division par 100 est ici, une seule fois, et pas dans le
            -- JavaScript : c'est exactement la conversion qui a rendu 31 PNJ
            -- hauts de 1,7 cm quand elle a ete faite au mauvais endroit.
            details = {
                portee_m = math.floor(p.cull / 100),
                ombres   = p.ombres,
                effets   = (p.bloom_intensite > 0) or (p.grain > 0)
                           or (p.vignette > 0) or (p.aberration_intensite > 0),
            },
        }
    end
    return liste
end

return Graphismes
