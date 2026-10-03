-- ══════════════════════════════════════════════════════════════════════════════
-- commandes-tests.lua — assertions sur Shared/Logic/Commandes.lua.
-- Chargé par commandes.mjs, qui fournit `Commandes` et `FausseBaseCommandes`.
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

-- ── Le catalogue lui-meme ─────────────────────────────────────────────────────

section("catalogue")

ok(#Commandes.ACTIONS > 0, "le catalogue n'est pas vide")
ok(#Commandes.CATEGORIES > 0, "au moins une categorie")

-- ⚠ LE TEST QUI COMPTE. Une touche par defaut que la validation refuse donne une
-- commande inutilisable des le premier demarrage, sans aucune erreur : le joueur
-- appuie, rien ne se passe, et rien ne lui dit pourquoi.
for _, a in ipairs(Commandes.ACTIONS) do
    egal(select(1, Commandes.ToucheValide(a.defaut)), true,
        "defaut assignable : " .. a.id .. " = " .. tostring(a.defaut))
end

-- Deux actions sur la meme touche par defaut : le joueur decouvrirait le conflit
-- sans l'avoir provoque, et l'ecran de reglages le montrerait comme normal.
local vues = {}
for _, a in ipairs(Commandes.ACTIONS) do
    ok(vues[a.defaut] == nil, "defaut unique : " .. tostring(a.defaut))
    vues[a.defaut] = a.id
end

-- Chaque action appartient a une categorie declaree, sinon elle disparait de
-- l'ecran : le rendu boucle sur les categories, pas sur les actions.
local cat = {}
for _, c in ipairs(Commandes.CATEGORIES) do cat[c] = true end
for _, a in ipairs(Commandes.ACTIONS) do
    ok(cat[a.categorie] == true, "categorie declaree : " .. a.categorie)
end

egal(Commandes.Trouver("menu_props") ~= nil, true, "Trouver rend une action connue")
egal(Commandes.Trouver("action_inexistante"), nil, "action inconnue rend nil")
egal(Commandes.Trouver(nil), nil, "Trouver(nil) ne leve pas")
egal(Commandes.Trouver(42), nil, "Trouver(nombre) ne leve pas")

-- ── Validation de touche ──────────────────────────────────────────────────────

section("ToucheValide")

egal(select(1, Commandes.ToucheValide("E")), true, "lettre acceptee")
egal(select(1, Commandes.ToucheValide("7")), true, "chiffre accepte")
egal(select(1, Commandes.ToucheValide("F12")), true, "F12 accepte")
egal(select(1, Commandes.ToucheValide("F13")), false, "F13 refuse")
egal(select(1, Commandes.ToucheValide("EE")), false, "deux lettres refusees")
egal(select(1, Commandes.ToucheValide("Ctrl+E")), false, "combinaison refusee")
egal(select(1, Commandes.ToucheValide("NumPad3")), false, "pave numerique refuse")
egal(select(1, Commandes.ToucheValide("")), false, "chaine vide refusee")
egal(select(1, Commandes.ToucheValide(nil)), false, "nil refuse sans lever")
egal(select(1, Commandes.ToucheValide(7)), false, "nombre refuse sans lever")

for _, t in ipairs({ "W", "A", "S", "D" }) do
    egal(select(1, Commandes.ToucheValide(t)), false, "touche de deplacement refusee : " .. t)
end

egal(Commandes.Normaliser("e"), "E", "normalisation en majuscule")
egal(Commandes.Normaliser(nil), "", "normalisation de nil sans lever")

-- ── Sans base ─────────────────────────────────────────────────────────────────

section("sans base")

Commandes.UtiliserBase(nil)
egal(Commandes.Prete(), false, "Prete() faux sans base")

-- ⚠ Les DEFAUTS doivent sortir meme sans base. Rendre une table vide laisserait
-- le client sans aucune touche : le jeu serait entierement muet si la base
-- tombait, alors que rien n'empeche de jouer avec les touches d'usine.
local sans_base = Commandes.ParCompte(1)
egal(sans_base.menu_inventaire, "I", "defauts rendus meme sans base")
egal(select(1, Commandes.Definir(1, "menu_props", "K")), false, "ecriture impossible sans base")

-- ── Lecture et ecriture ───────────────────────────────────────────────────────

section("Definir / ParCompte")

local base = FausseBaseCommandes()
Commandes.UtiliserBase(base)
egal(Commandes.Prete(), true, "Prete() vrai avec base")

egal(select(1, Commandes.Definir(1, "menu_props", "K")), true, "assignation reussie")
egal(Commandes.ParCompte(1).menu_props, "K", "touche relue")
egal(Commandes.ParCompte(1).menu_spawn, "N", "les autres gardent leur defaut")

-- Un autre compte n'est pas touche : c'est la propriete la plus facile a casser
-- en oubliant `compte_id` dans un WHERE.
egal(Commandes.ParCompte(2).menu_props, "P", "compte voisin intact")

egal(Commandes.Normaliser("k"), "K", "minuscule normalisee")
Commandes.Definir(1, "menu_props", "j")
egal(Commandes.ParCompte(1).menu_props, "J", "minuscule stockee en majuscule")

egal(select(1, Commandes.Definir(1, "action_inconnue", "K")), false, "action inconnue refusee")
egal(select(1, Commandes.Definir(1, "menu_props", "W")), false, "touche de deplacement refusee")
egal(select(1, Commandes.Definir(nil, "menu_props", "K")), false, "compte absent refuse")

-- ── Le vol de touche ──────────────────────────────────────────────────────────

section("conflit entre commandes")

local base2 = FausseBaseCommandes()
Commandes.UtiliserBase(base2)

-- `menu_spawn` a `N` par defaut. Le donner a `menu_props` doit le lui REPRENDRE
-- et le DIRE : un vol silencieux laisserait le joueur decouvrir plus tard que
-- son menu de spawn ne repond plus.
local ok_vol, raison, liberee = Commandes.Definir(5, "menu_props", "N")
egal(ok_vol, true, "assignation sur une touche prise reussit")
egal(raison, nil, "aucune raison d'echec")
egal(liberee, "menu_spawn", "l'action depouillee est annoncee")

local apres = Commandes.ParCompte(5)
egal(apres.menu_props, "N", "la touche est passee au demandeur")
egal(apres.menu_spawn, "", "l'ancienne detentrice n'a plus de touche")

-- ⚠ CHAINE VIDE, PAS SUPPRESSION. Supprimer la ligne ferait revenir le DEFAUT de
-- l'action depouillee au prochain chargement, donc le meme conflit. Le test le
-- verifie en relisant : `menu_spawn` doit RESTER vide.
egal(Commandes.ParCompte(5).menu_spawn, "", "l'action depouillee le reste apres relecture")

-- Reassigner une action a la touche qu'elle a deja ne doit RIEN liberer.
local ok2, _, liberee2 = Commandes.Definir(5, "menu_props", "N")
egal(ok2, true, "reassignation a l'identique acceptee")
egal(liberee2, nil, "reassignation a l'identique ne libere rien")

-- ── L'arbitre ─────────────────────────────────────────────────────────────────

section("ToucheOccupee")

egal(Commandes.ToucheOccupee(5, "N"), "menu_props", "touche occupee reconnue")
egal(Commandes.ToucheOccupee(5, "n"), "menu_props", "casse indifferente")
-- ⚠ LA TOUCHE LIBRE EST CHERCHEE, PLUS CODEE EN DUR.
--
-- Ce test a porte « K », puis « Z », et les deux ont fini par etre attribuees —
-- K a `gizmo_precedent` le 2026-09-06, Z au menu des vehicules le 2026-09-12.
-- Chaque fois, le test tombait pour une raison sans aucun rapport avec ce qu'il
-- verifie : que `ToucheOccupee` rend nil sur une touche que rien n'occupe.
--
-- On la DERIVE donc du catalogue. Le test devient insensible aux ajouts, et son
-- echec ne peut plus signifier qu'une chose : la fonction s'est mise a repondre
-- pour une touche libre.
local libre = nil
for lettre in ("ABCDEFGHIJKLMNOPQRSTUVWXYZ"):gmatch(".") do
    if (libre == nil and Commandes.ToucheOccupee(5, lettre) == nil) then libre = lettre end
end
ok(libre ~= nil, "le clavier garde au moins une touche libre")
if (libre) then
    egal(Commandes.ToucheOccupee(5, libre), nil, "touche libre rend nil")
end
egal(Commandes.ToucheOccupee(5, ""), nil, "chaine vide rend nil")
egal(Commandes.ToucheOccupee(5, nil), nil, "nil ne leve pas")

-- ⚠ Une action SANS touche ne doit pas repondre a la chaine vide : sinon toute
-- emote assignee a "" serait refusee au motif d'un conflit imaginaire.
egal(Commandes.ToucheOccupee(5, ""), nil, "l'action sans touche n'occupe pas la chaine vide")

-- ── Dédoublonnage base > defaut ─────────────────────────────────────────────

section("dedoublonnage base > defaut")

-- TAB est le defaut de `roue_objets` depuis le 2026-09-08. Un compte qui
-- l'avait EXPLICITEMENT assignee a `equipement_retirer` avant cette date garde
-- sa ligne en base : c'est elle qui gagne, et la roue reste sans touche —
-- reassignable depuis l'ecran des commandes, jamais en conflit.
local base3 = FausseBaseCommandes()
Commandes.UtiliserBase(base3)
base3:Injecter(9, "equipement_retirer", "TAB")
local arbitre = Commandes.ParCompte(9)
egal(arbitre.equipement_retirer, "TAB", "la ligne en base garde sa touche")
egal(arbitre.roue_objets, "", "le defaut en conflit s'efface")
egal(Commandes.ToucheOccupee(9, "TAB"), "equipement_retirer", "l'arbitre tranche pour la ligne en base")
-- Un compte SANS ligne explicite n'est pas touche : la roue a bien TAB.
egal(Commandes.ParCompte(10).roue_objets, "TAB", "sans ligne en base, le defaut de la roue s'applique")
egal(Commandes.ParCompte(10).equipement_retirer, "T", "et equipement_retirer est sur T")

-- Les sections suivantes travaillent sur compte 5, dont les lignes vivent dans
-- base2 : on la repose. Les laisser sur base3 leur ferait relire des defauts.
Commandes.UtiliserBase(base2)

-- ── Reinitialisation ──────────────────────────────────────────────────────────

section("Reinitialiser")

egal(Commandes.Reinitialiser(5, "menu_spawn"), true, "reinitialisation acceptee")
-- ⚠ Le defaut NE revient PAS ici, et c'est voulu (2026-09-08) : N est encore
-- explicitement tenue par menu_props (vol de touche plus haut). La rendre
-- recreerait le conflit que le dedoublonnage de ParCompte existe pour
-- empecher ; l'action reste reassignable a la main.
egal(Commandes.ParCompte(5).menu_spawn, "", "le defaut cede devant la touche explicitement prise")
egal(Commandes.Reinitialiser(5, "action_inconnue"), false, "action inconnue refusee")
egal(Commandes.Reinitialiser(nil, "menu_spawn"), false, "compte absent refuse")

Commandes.Definir(5, "menu_props", "K")
Commandes.Definir(5, "vue", "G")
egal(Commandes.ReinitialiserTout(5), true, "reinitialisation globale acceptee")
local remis = Commandes.ParCompte(5)

-- ⚠ ON N'ECRIT PLUS AUCUNE TOUCHE EN DUR ICI.
--
-- Ces deux lignes portaient « P » et « F3 » recopies du catalogue. Elles ont
-- casse DEUX FOIS pour la meme raison : le 2026-09-07 quand `vue` est passe a
-- KeyV, puis le 2026-09-10 quand `vue` est passe a F4 pour liberer F3 au mode
-- edition. Le commentaire qui accompagnait la seconde valeur expliquait
-- doctement pourquoi c'etait F3 — il etait faux au moment ou on le lisait.
--
-- Un test qui recopie sa reference ne teste plus la fonction : il teste que
-- personne n'a touche au catalogue. On affirme donc la RELATION — apres
-- reinitialisation, chaque action retrouve LE defaut que le catalogue declare,
-- quel qu'il soit — et le test survit au prochain changement de touche.
local ecarts = 0
for _, action in ipairs(Commandes.ACTIONS) do
    if (remis[action.id] ~= nil and remis[action.id] ~= action.defaut) then
        ecarts = ecarts + 1
        print(string.format("  ECART : %s = %s, catalogue dit %s",
            action.id, tostring(remis[action.id]), tostring(action.defaut)))
    end
end
egal(ecarts, 0, "toute action reinitialisee retrouve le defaut du catalogue")

-- Et le tableau n'est pas vide : un `ParCompte` qui ne rendrait rien passerait
-- la boucle ci-dessus sans rien verifier. Un garde qui ne trouve rien a
-- verifier compte pour vert.
ok(remis.menu_props ~= nil, "ParCompte rend bien les actions par defaut")

-- ── La vue de l'ecran ─────────────────────────────────────────────────────────

section("Vue")

local vue = Commandes.Vue(5)
egal(#vue, #Commandes.ACTIONS, "une entree par action")
egal(vue[1].id, Commandes.ACTIONS[1].id, "ordre du catalogue conserve")
egal(vue[1].modifiee, false, "non modifiee au depart")

Commandes.Definir(5, vue[1].id, "Y")
local vue2 = Commandes.Vue(5)
egal(vue2[1].touche, "Y", "la vue reflete la nouvelle touche")
egal(vue2[1].modifiee, true, "le drapeau modifiee suit")
egal(vue2[1].defaut, Commandes.ACTIONS[1].defaut, "le defaut reste visible")

-- ── Nouvelles touches (2026-09-19) ────────────────────────────────────────────

section("Touches etendues")

-- Pavé numérique, directionnelles et touches spéciales : acceptées.
egal(select(1, Commandes.ToucheValide("NUM5")), true, "pave numerique accepte (NUM5)")
egal(select(1, Commandes.ToucheValide("NUM+")), true, "pave numerique accepte (NUM+)")
egal(select(1, Commandes.ToucheValide("HAUT")), true, "fleche acceptee (HAUT)")
egal(select(1, Commandes.ToucheValide("DROITE")), true, "fleche acceptee (DROITE)")
egal(select(1, Commandes.ToucheValide("ESPACE")), true, "touche speciale acceptee (ESPACE)")
egal(select(1, Commandes.ToucheValide("ENTREE")), true, "touche speciale acceptee (ENTREE)")
egal(select(1, Commandes.ToucheValide("PGSUIV")), true, "touche speciale acceptee (PGSUIV)")

-- Une valeur inventée reste refusée : la liste blanche s'est elargie, elle n'a
-- pas disparu.
egal(select(1, Commandes.ToucheValide("NUMX")), false, "pave invente refuse (NUMX)")
egal(select(1, Commandes.ToucheValide("KEYV")), false, "code navigateur toujours refuse")

-- AZERTY/QWERTY : les touches de deplacement NATIVES rapportees par le client
-- deviennent intouchables, en plus des W A S D de la liste fixe.
egal(select(1, Commandes.ToucheValide("W")), false, "W reste reservee (QWERTY)")
egal(select(1, Commandes.ToucheValide("Z")), true, "Z assignable par defaut (QWERTY)")
egal(select(1, Commandes.ToucheValide("Z", { Z = true })), false, "Z refuse quand le clavier la reserve (AZERTY)")
egal(select(1, Commandes.ToucheValide("Z", { Q = true })), true, "Z accepte si le clavier reserve Q (QWERTY)")

-- Les deux nouvelles actions existent avec des defauts uniques et valides.
local fouiller = Commandes.Trouver("fouiller")
local auto_marche = Commandes.Trouver("auto_marche")
ok(fouiller ~= nil and fouiller.defaut == "F1", "action fouiller presente (F1)")
ok(auto_marche ~= nil and auto_marche.defaut == "F2", "action auto_marche presente (F2)")
egal(select(1, Commandes.ToucheValide(fouiller.defaut)), true, "defaut fouiller assignable")
egal(select(1, Commandes.ToucheValide(auto_marche.defaut)), true, "defaut auto_marche assignable")

-- ── Bilan ─────────────────────────────────────────────────────────────────────

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
if (echecs > 0) then error(echecs .. " test(s) en echec") end