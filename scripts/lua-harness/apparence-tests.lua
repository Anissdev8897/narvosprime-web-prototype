-- ══════════════════════════════════════════════════════════════════════════════
-- apparence-tests.lua — silhouette et couleurs.
--
-- Ce module est le SEUL réglage que les deux corps Stylized acceptent : ils n'ont
-- aucun morph target, et `SetMorphTarget` n'a pas d'`attachable_id`. Chaque test
-- ici verrouille donc une chose sans laquelle ces corps n'auraient rien du tout.
-- ══════════════════════════════════════════════════════════════════════════════

local Apparence = Narvos.Apparence

local reussis, echoues = 0, 0

local function ok(condition, nom)
    if (condition) then
        reussis = reussis + 1
    else
        echoues = echoues + 1
        print("  ECHEC : " .. nom)
    end
end

local function egal(obtenu, attendu, nom)
    if (obtenu == attendu) then
        reussis = reussis + 1
    else
        echoues = echoues + 1
        print("  ECHEC : " .. nom .. "  (obtenu " .. tostring(obtenu)
            .. ", attendu " .. tostring(attendu) .. ")")
    end
end

local function section(nom) print("[" .. nom .. "]") end

-- ── Silhouette ────────────────────────────────────────────────────────────────

section("silhouette")

do
    local neutre = Apparence.Echelle(nil)
    egal(neutre.x, 1, "sans réglage, aucune mise à l'échelle en X")
    egal(neutre.y, 1, "ni en Y")
    egal(neutre.z, 1, "ni en Z")
end

do
    -- Le point fixe du milieu : un curseur au neutre doit rendre le personnage
    -- à sa taille RÉELLE. Sans lui, ouvrir l'écran et ne rien toucher
    -- redimensionnerait déjà le corps.
    local e = Apparence.Echelle({ ["#taille"] = 0.5, ["#carrure"] = 0.5 })
    egal(e.z, 1, "curseur au milieu = taille réelle")
    egal(e.x, 1, "curseur au milieu = carrure réelle")
end

do
    local grand = Apparence.Echelle({ ["#taille"] = 1 })
    local petit = Apparence.Echelle({ ["#taille"] = 0 })
    ok(grand.z > 1, "à droite, le personnage grandit")
    ok(petit.z < 1, "à gauche, il rapetisse")
    -- Les bornes protègent la capsule de collision, que nanos calcule sur les
    -- bounds du mesh au spawn. Au-delà, le personnage traverse les portes.
    -- ⚠ LES BORNES SE LISENT DANS LE CATALOGUE, jamais recopiées ici. Une copie
    -- diverge toujours de sa source : le jour où un curseur change de plage, un
    -- test qui porte l'ancienne valeur échoue sans qu'aucun défaut existe — ou
    -- pire, passe alors que la borne réelle a sauté.
    local function curseur(id)
        for _, c in ipairs(Apparence.CURSEURS) do
            if (c.id == id) then return c end
        end
        return nil
    end

    local taille = curseur("taille")
    ok(taille ~= nil, "le curseur taille existe dans le catalogue")
    ok(grand.z <= taille.max, "la borne haute est respectée")
    ok(petit.z >= taille.min, "la borne basse est respectée")
end

do
    -- ⚠ LA HAUTEUR EST EN Z, LA LARGEUR EN X ET Y. Unreal est Z-up ; intervertir
    -- ne lève rien, le personnage s'aplatit au sol au lieu de grandir — ce qui
    -- se lit comme un bug de modèle et non comme une erreur d'axe.
    local e = Apparence.Echelle({ ["#taille"] = 1, ["#carrure"] = 0 })
    ok(e.z > 1, "la taille agit sur Z")
    ok(e.y < 1, "la carrure agit sur Y (largeur, vue de face)")

    local prof = Apparence.Echelle({ ["#corpulence"] = 0 })
    ok(prof.x < 1, "la corpulence agit sur X (epaisseur, vue de profil)")
    egal(prof.z, 1, "la corpulence ne touche pas la taille")

    -- ⚠ CE QUE GARDAIT L'ANCIENNE ASSERTION `x == y`. Deux axes libres
    -- permettraient « large de face, mince de profil » : un personnage en carton.
    -- On ne les force plus egaux — ce serait perdre le second curseur — mais leur
    -- RAPPORT est borne. Regler les deux aux extremes opposes doit rester lisible.
    local extreme = Apparence.Echelle({ ["#carrure"] = 1, ["#corpulence"] = 0 })
    local grand_h = math.max(extreme.x, extreme.y)
    local petit_h = math.min(extreme.x, extreme.y)
    ok(grand_h / petit_h <= Apparence.RATIO_MAX + 1e-9,
        "le rapport largeur/epaisseur reste borne : pas d'aplatissement")

    local inverse = Apparence.Echelle({ ["#carrure"] = 0, ["#corpulence"] = 1 })
    ok(math.max(inverse.x, inverse.y) / math.min(inverse.x, inverse.y) <= Apparence.RATIO_MAX + 1e-9,
        "borne aussi dans l'autre sens")
end

do
    -- Une valeur hors bornes vient du client, pas d'un bug : on la ramène, on ne
    -- lève pas. Un écran modifié ne doit pas pouvoir fabriquer un géant.
    local bornes
    for _, c in ipairs(Apparence.CURSEURS) do
        if (c.id == "taille") then bornes = c end
    end

    local haut = Apparence.Echelle({ ["#taille"] = 50 })
    local bas = Apparence.Echelle({ ["#taille"] = -50 })
    ok(haut.z <= bornes.max, "une valeur trop grande est ramenée à la borne")
    ok(bas.z >= bornes.min, "une valeur trop petite aussi")

    local texte = Apparence.Echelle({ ["#taille"] = "grand" })
    egal(texte.z, 1, "une valeur non numérique retombe sur le neutre")
end

do
    -- Les réglages d'apparence VOYAGENT DANS LA TABLE DES MORPHS, préfixés `#`.
    -- Le préfixe est ce qui les sépare des 138 identifiants MakeHuman : sans
    -- lui, `Morphs.Resoudre` et `Apparence.Echelle` se disputeraient les clés.
    ok(Apparence.EstReglage("#taille"), "un identifiant préfixé est un réglage")
    ok(not Apparence.EstReglage("nose-scale-vert-decr"), "un morph n'en est pas un")
    ok(not Apparence.EstReglage("@gender"), "une macro non plus")
    ok(not Apparence.EstReglage(nil), "nil n'en est pas un")
    ok(not Apparence.EstReglage(42), "un nombre non plus")
end

do
    -- Aucun identifiant MakeHuman ni aucune macro ne doit commencer par le
    -- préfixe : c'est l'hypothèse qui rend la table plate sans ambiguïté.
    local collisions = 0
    for _, c in ipairs(Narvos.Morphs.CURSEURS) do
        if (Apparence.EstReglage(c.id)) then collisions = collisions + 1 end
    end
    for _, c in ipairs(Narvos.Macros.CURSEURS) do
        if (Apparence.EstReglage(Narvos.Macros.PREFIXE .. c.id)) then
            collisions = collisions + 1
        end
    end
    egal(collisions, 0, "aucun morph ni macro n'entre en collision avec le préfixe")
end

do
    local s = Apparence.Silhouette(nil)
    for _, c in ipairs(Apparence.CURSEURS) do
        egal(s[Apparence.PREFIXE .. c.id], c.defaut, c.id .. " : défaut sans entrée")
    end

    local borne = Apparence.Silhouette({ ["#taille"] = 9 })
    egal(borne["#taille"], 1, "la silhouette normalisée reste dans 0..1")
end

-- ── Couleurs ──────────────────────────────────────────────────────────────────

-- ── Capsule de collision ──────────────────────────────────────────────────────
--
-- Sans elle, la silhouette et la collision divergent : le grand flotte, le petit
-- s'enfonce, le large traverse les murs. Et rien ne le signale — c'est ce qui
-- avait fait plafonner les curseurs a plus ou moins 12 %.

section("capsule")

do
    local base = { rayon = 42, demi_hauteur = 96, demi_hauteur_accroupi = 60 }

    local neutre = Apparence.Capsule(base, { x = 1, y = 1, z = 1 })
    egal(neutre.rayon, 42, "au neutre, le rayon ne bouge pas")
    egal(neutre.demi_hauteur, 96, "ni la demi-hauteur")
    egal(neutre.demi_hauteur_accroupi, 60, "ni celle accroupie")

    local grand = Apparence.Capsule(base, { x = 1, y = 1, z = 1.18 })
    ok(grand.demi_hauteur > 96, "un personnage plus grand a une capsule plus haute")
    egal(grand.rayon, 42, "et un rayon inchange")

    -- ⚠ LE RAYON SUIT LE PLUS GRAND DES DEUX AXES. Une capsule est ronde : elle
    -- ne sait pas etre large de face et mince de profil. Prendre le max empeche
    -- de rentrer DANS un mur ; prendre le min ou la moyenne l'autoriserait sous
    -- un certain angle.
    local large = Apparence.Capsule(base, { x = 0.9, y = 1.15, z = 1 })
    egal(large.rayon, 48, "le rayon suit le plus grand des axes horizontaux")

    local epais = Apparence.Capsule(base, { x = 1.15, y = 0.9, z = 1 })
    egal(epais.rayon, large.rayon, "peu importe lequel des deux est le plus grand")

    -- `SetCapsuleSize` prend des ENTIERS : un flottant serait tronque en silence,
    -- donc une capsule systematiquement plus petite que la silhouette.
    local r = Apparence.Capsule(base, { x = 1.07, y = 1, z = 1.07 })
    egal(r.rayon, math.floor(r.rayon), "le rayon est entier")
    egal(r.demi_hauteur, math.floor(r.demi_hauteur), "la demi-hauteur aussi")

    egal(Apparence.Capsule(nil, { x = 1, y = 1, z = 1 }), nil, "sans base, aucune capsule")
    egal(Apparence.Capsule(base, nil), nil, "sans echelle non plus")
    egal(Apparence.Capsule({ rayon = "x" }, { x = 1, y = 1, z = 1 }), nil,
        "une base illisible ne fabrique pas de capsule")
end

-- ── Teint de peau ─────────────────────────────────────────────────────────────
--
-- Ajoute le 2026-09-05. `MI_Body` n'a aucun parametre de couleur : la teinte ne
-- peut passer que par `MI_NarvosPeau_<genre>`, pose AVANT elle. Ces assertions
-- gardent les deux invariants dont depend le fait que les corps de base ne
-- changent pas d'apparence.

section("peau")

do
    local peau
    for _, c in ipairs(Apparence.CIBLES) do
        if (c.id == "peau") then peau = c end
    end

    ok(peau ~= nil, "la cible peau existe")

    -- ⚠ LE NEUTRE EST LE BLANC. `M_NarvosPeau` multiplie la texture par la
    -- teinte : blanc laisse la texture intacte. Un defaut different changerait
    -- l'apparence d'Operateur et de Valkiria des l'ajout du reglage, ce qu'on
    -- s'est expressement interdit.
    egal(peau.defaut, "#ffffff", "le neutre du teint est le blanc")

    egal(peau.param, "Teinte", "le parametre est celui du materiau fabrique")

    -- ⚠ SANS `materiau`, la teinte viserait `MI_Body` qui n'a pas ce parametre :
    -- `SetMaterialColorParameter` ne leve pas et ne peint rien. Le defaut serait
    -- muet, c'est-a-dire le pire cas.
    ok(type(peau.materiau) == "string", "la cible porte un materiau a poser")
    ok(peau.materiau:find("%%s") ~= nil,
        "le materiau est genre : les textures M et F sont distinctes")

    -- La peau, ce sont les pieces du registre `base` : le corps, pas la tenue.
    local vises = {}
    for _, s in ipairs(peau.slots or {}) do vises[s] = true end
    for _, s in ipairs({ "torse", "jambes", "mains", "visage" }) do
        ok(vises[s] == true, "le teint atteint le slot " .. s)
    end

    -- Une couleur invalide ne doit pas fabriquer une teinte : mieux vaut la peau
    -- d'origine qu'une couleur arbitraire.
    local palette = Apparence.Couleurs({ peau = "pas une couleur" })
    ok(palette.peau == peau.defaut or palette.peau == nil,
        "une valeur illisible retombe sur le neutre")
end

section("couleurs")

do
    ok(Apparence.CouleurValide("#1a2b3c"), "un hexadécimal à six chiffres passe")
    ok(Apparence.CouleurValide("#FFFFFF"), "les majuscules passent")
    ok(not Apparence.CouleurValide("#1a2b3"), "cinq chiffres ne passent pas")
    ok(not Apparence.CouleurValide("1a2b3c"), "sans dièse non plus")
    ok(not Apparence.CouleurValide("#gggggg"), "des lettres hors hexa non plus")
    ok(not Apparence.CouleurValide("rouge"), "un nom de couleur non plus")
    ok(not Apparence.CouleurValide(nil), "nil non plus")
    ok(not Apparence.CouleurValide(0x1a2b3c), "un nombre non plus")
    -- ⚠ Le motif doit être ANCRÉ aux deux bouts. Sans `$`, une chaîne plus
    -- longue passerait, et `HexToColor` en lirait les six premiers chiffres en
    -- ignorant le reste — une injection silencieuse dans la table persistée.
    ok(not Apparence.CouleurValide("#1a2b3c ; rm"), "rien ne peut suivre les six chiffres")
end

do
    local defauts = Apparence.Couleurs(nil)
    for _, c in ipairs(Apparence.CIBLES) do
        egal(defauts[c.id], c.defaut, c.id .. " : défaut sans entrée")
    end
end

do
    local melange = Apparence.Couleurs({ tenue = "#010203", yeux = "pas une couleur" })
    egal(melange.tenue, "#010203", "une teinte valide est gardée")
    egal(melange.yeux, Apparence.Cible("yeux").defaut,
        "une teinte invalide retombe sur son défaut, pas sur du noir")
    ok(melange.cheveux ~= nil, "les cibles absentes sont quand même remplies")
end

do
    -- Une cible en trop vient d'un client modifié. La garder la ferait partir en
    -- base, où elle ne serait jamais relue — du bruit qui grossit.
    local sortie = Apparence.Couleurs({ tenue = "#010203", inconnue = "#ffffff" })
    egal(sortie.inconnue, nil, "une cible hors catalogue est écartée")
end

do
    egal(Apparence.Cible("tenue").param, "Color 1", "le paramètre de matériau est celui qui a été sondé")
    egal(Apparence.Cible("cheveux").param, "Hair Color", "les cheveux ont leur propre paramètre")
    egal(Apparence.Cible("inconnue"), nil, "une cible inconnue rend nil")
    egal(Apparence.Cible(nil), nil, "nil rend nil")
end

do
    -- ⚠ CHAQUE CIBLE DOIT VISER AU MOINS UN SLOT. `SetMaterialColorParameter`
    -- sans `attachable_id` viserait le mesh de BASE, qui est caché sur toutes
    -- les familles à peau découpée : la couleur serait posée sur l'invisible.
    for _, c in ipairs(Apparence.CIBLES) do
        ok(type(c.slots) == "table" and #c.slots > 0, c.id .. " vise au moins un slot")
        ok(Apparence.CouleurValide(c.defaut), c.id .. " a un défaut bien formé")
    end
end

do
    -- Les slots visés doivent EXISTER au catalogue modulaire. Un slot mal
    -- orthographié ne lève rien : la teinte n'est simplement jamais posée.
    local connus = {}
    for _, s in ipairs(Narvos.Modular.SLOTS) do connus[s] = true end

    local inconnus = 0
    for _, c in ipairs(Apparence.CIBLES) do
        for _, s in ipairs(c.slots) do
            if (not connus[s]) then inconnus = inconnus + 1 end
        end
    end
    egal(inconnus, 0, "tous les slots visés existent dans Modular.SLOTS")
end

do
    -- Deux cibles peuvent partager un slot (`tenue` et `tenue2` sur `torse`) :
    -- ce sont deux paramètres du MÊME matériau. Mais elles ne doivent pas
    -- partager le même paramètre sur le même slot, sinon la seconde écrase la
    -- première et un des deux nuanciers ne ferait visiblement rien.
    local vus = {}
    local doublons = 0
    for _, c in ipairs(Apparence.CIBLES) do
        for _, s in ipairs(c.slots) do
            local cle = s .. "|" .. c.param
            if (vus[cle]) then doublons = doublons + 1 end
            vus[cle] = true
        end
    end
    egal(doublons, 0, "aucune cible n'écrase le paramètre d'une autre sur le même slot")
end

do
    ok(#Apparence.PALETTE >= 8, "la palette offre un vrai choix")
    local mal = 0
    for _, t in ipairs(Apparence.PALETTE) do
        if (not Apparence.CouleurValide(t)) then mal = mal + 1 end
    end
    egal(mal, 0, "toutes les teintes de la palette sont bien formées")
end

-- ── Persistance ───────────────────────────────────────────────────────────────

section("persistance des couleurs")

do
    -- ⚠ LA PANNE QUI EST REVENUE DEUX FOIS. `EncoderCouleurs` itérait une liste
    -- écrite en dur (`skin`/`hair`/`jacket`, héritée de Dofus) au lieu du
    -- catalogue : aucune clé ne correspondait, la fonction rendait une chaîne
    -- VIDE, et les couleurs partaient en base effacées sans le moindre signal.
    -- Ce test échoue si quelqu'un recopie à nouveau une liste de cibles.
    local chaine = Narvos.Roster.EncoderCouleurs({ tenue = "#010203", cheveux = "#0a0b0c" })
    ok(chaine ~= "", "encoder une palette ne rend PAS une chaîne vide")
    ok(chaine:find("tenue:#010203", 1, true) ~= nil, "la teinte de tenue est écrite")
    ok(chaine:find("cheveux:#0a0b0c", 1, true) ~= nil, "celle des cheveux aussi")
end

do
    local aller = { tenue = "#010203", tenue2 = "#040506", yeux = "#070809", cheveux = "#0a0b0c" }
    local retour = Narvos.Roster.DecoderCouleurs(Narvos.Roster.EncoderCouleurs(aller))
    for id, v in pairs(aller) do
        egal(retour[id], v, id .. " survit à l'aller-retour")
    end
end

do
    -- L'ordre doit être FIGÉ : deux enregistrements de la même palette doivent
    -- produire la même chaîne, sinon rien n'est comparable au débogage.
    local a = Narvos.Roster.EncoderCouleurs({ cheveux = "#0a0b0c", tenue = "#010203" })
    local b = Narvos.Roster.EncoderCouleurs({ tenue = "#010203", cheveux = "#0a0b0c" })
    egal(a, b, "l'ordre d'écriture ne dépend pas de l'ordre des clés")
end

do
    -- Dernier point avant la base : une teinte mal formée doit y arriver
    -- normalisée, sinon elle ressort au rechargement et `HexToColor` rend nil —
    -- la couleur disparaît au lieu de retomber sur son défaut.
    local chaine = Narvos.Roster.EncoderCouleurs({ tenue = "'; DROP TABLE personnages; --" })
    ok(chaine:find("DROP", 1, true) == nil, "une valeur hostile n'atteint jamais la chaîne persistée")
    local relu = Narvos.Roster.DecoderCouleurs(chaine)
    egal(relu.tenue, Apparence.Cible("tenue").defaut, "elle est remplacée par le défaut")
end

do
    egal(Narvos.Roster.EncoderCouleurs(nil), "", "nil s'encode en chaîne vide")
    local vide = Narvos.Roster.DecoderCouleurs("")
    for _, c in ipairs(Apparence.CIBLES) do
        egal(vide[c.id], c.defaut, c.id .. " : une chaîne vide rend les défauts")
    end
end

section("persistance de la silhouette")

do
    -- ⚠ `EncoderMorphs` ÉCARTE LES ZÉROS pour ne pas stocker 138 neutres. Mais
    -- un curseur de silhouette est neutre à 0,5 et vaut 0 à son EXTRÉMITÉ : le
    -- rejeter effaçait « le plus petit possible », qui revenait à la taille
    -- moyenne au rechargement.
    local chaine = Narvos.Roster.EncoderMorphs({ ["#taille"] = 0, ["nose-scale-vert-decr"] = 0 })
    ok(chaine:find("#taille", 1, true) ~= nil, "un réglage d'apparence à zéro est conservé")
    ok(chaine:find("nose", 1, true) == nil, "un morph à zéro reste écarté")
end

do
    local aller = { ["#taille"] = 0.25, ["#carrure"] = 0.75, ["nose-scale-vert-incr"] = 0.4 }
    local retour = Narvos.Roster.DecoderMorphs(Narvos.Roster.EncoderMorphs(aller))
    for id, v in pairs(aller) do
        ok(math.abs((retour[id] or 0) - v) < 0.002, id .. " survit à l'aller-retour")
    end

    -- Et la table relue doit rendre la MÊME échelle : c'est la seule chose qui
    -- prouve que la persistance sert à quelque chose.
    local avant = Apparence.Echelle(aller)
    local apres = Apparence.Echelle(retour)
    ok(math.abs(avant.z - apres.z) < 0.002, "l'échelle relue est celle qui a été enregistrée")
    ok(math.abs(avant.x - apres.x) < 0.002, "la carrure aussi")
end

do
    -- Les deux tables cohabitent dans le même champ : `Morphs.Resoudre` doit
    -- ignorer les clés préfixées, sinon il tenterait `SetMorphTarget("#taille")`
    -- sur un morph qui n'existe pas.
    local poids = Narvos.Morphs.Resoudre({ ["#taille"] = 1, ["#carrure"] = 0 })
    egal(poids["#taille"], nil, "Resoudre ignore les réglages d'apparence")
    egal(poids["#carrure"], nil, "les deux")
end

-- ── Bilan ──────────────────────────────────────────────────────────────────

print(string.format("%d reussi(s), %d echec(s)", reussis, echoues))
if (echoues > 0) then error("tests apparence en echec") end