-- ══════════════════════════════════════════════════════════════════════════════
-- communications-tests.lua — assertions sur Logic/TexteChat.lua, Logic/Radio.lua
-- et Logic/Telephone.lua. Chargé par communications.mjs, qui fournit les trois
-- modules et le VRAI catalogue d'objets (`VRAIS_ITEMS`).
--
-- Ce que ces tests ferment (2026-09-13, à la demande de Hanibes : « branche les
-- trois fonctions ») : le talkie-walkie et le smartphone étaient des GLB rangés
-- dans `a_trier/`, sans système. Un objet de sac qui ne fait rien est un décor
-- qu'on porte.
-- ══════════════════════════════════════════════════════════════════════════════

local reussis, echecs = 0, 0

local function ok(condition, nom)
    if (condition) then reussis = reussis + 1
    else echecs = echecs + 1; print("  ECHEC  " .. nom) end
end

local function egal(obtenu, attendu, nom)
    ok(obtenu == attendu, nom .. "  obtenu=" .. tostring(obtenu) .. "  attendu=" .. tostring(attendu))
end

local function section(nom) print("[" .. nom .. "]") end

-- ══════════════════════════════════════════════════════════════════════════════
section("texte de chat — ce qu'un joueur a le droit d'écrire")

egal(TexteChat.Nettoyer(nil, 50), nil, "nil : refusé")
egal(select(2, TexteChat.Nettoyer(nil, 50)), "message vide", "nil : la raison est nommée")
egal(TexteChat.Nettoyer("   ", 50), nil, "blancs seuls : refusé")
egal(TexteChat.Nettoyer(42, 50), nil, "non-chaîne : refusé")
egal(TexteChat.Nettoyer("  salut  ", 50), "salut", "les bords sont rognés")

-- ⚠ LES BALISES DU CHAT NANOS. `Chat.SendMessage` interprète `<cyan>…</>` : un
-- joueur qui écrit `<red>ADMIN</>` se ferait passer pour le système.
local sans_balise = TexteChat.Nettoyer("<red>ADMIN</> : donnez vos codes", 80)
ok(sans_balise ~= nil and sans_balise:find("<", 1, true) == nil and sans_balise:find(">", 1, true) == nil,
   "aucun chevron ne survit (" .. tostring(sans_balise) .. ")")

egal(TexteChat.Nettoyer("a\nb\tc", 50), "a b c", "retours à la ligne et tabulations deviennent des espaces")

-- La coupe compte des CARACTÈRES, pas des octets : couper « é » en deux ferait
-- un message invalide que le client afficherait en losanges.
local long = string.rep("é", 30)
local coupe = TexteChat.Nettoyer(long, 10)
egal(utf8.len(coupe), 10, "coupe à 10 CARACTÈRES sur un texte accentué")
ok(utf8.len(coupe) ~= nil, "la coupe laisse de l'UTF-8 valide")

-- ══════════════════════════════════════════════════════════════════════════════
section("radio — canaux")

ok(Radio.OBJET ~= nil and VRAIS_ITEMS[Radio.OBJET] ~= nil,
   "l'objet radio existe au catalogue d'objets (" .. tostring(Radio.OBJET) .. ")")
egal(Radio.Canal(12), 12, "canal 12 accepté")
egal(Radio.Canal("7"), 7, "canal écrit en texte accepté")
egal(Radio.Canal(Radio.CANAL_MIN - 1), nil, "sous le minimum : refusé")
egal(Radio.Canal(Radio.CANAL_MAX + 1), nil, "au-delà du maximum : refusé")
egal(Radio.Canal(3.5), nil, "canal non entier : refusé")
egal(Radio.Canal("abc"), nil, "canal illisible : refusé")
ok(type(select(2, Radio.Canal(0))) == "string", "le refus d'un canal porte sa raison")
egal(Radio.Canal(Radio.CANAL_DEFAUT), Radio.CANAL_DEFAUT, "le canal par défaut est valide")

section("radio — qui entend")

local emetteur = { id = "a", a_radio = true, canal = 5, dimension = 1 }
local auditeurs = {
    emetteur,
    { id = "b", a_radio = true, canal = 5, dimension = 1 },   -- entend
    { id = "c", a_radio = true, canal = 6, dimension = 1 },   -- autre canal
    { id = "d", a_radio = false, canal = 5, dimension = 1 },  -- sans talkie
    { id = "e", a_radio = true, canal = 5, dimension = 2 },   -- autre dimension
}
local dest, raison_dest = Radio.Destinataires(auditeurs, emetteur)
ok(dest ~= nil, "un porteur peut émettre (raison=" .. tostring(raison_dest) .. ")")
local ids = {}
for _, id in ipairs(dest or {}) do ids[id] = true end
egal(ids.a, true, "l'émetteur s'entend (écho)")
egal(ids.b, true, "même canal, même dimension : entend")
egal(ids.c, nil, "autre canal : n'entend pas")
egal(ids.d, nil, "sans talkie : n'entend pas")
egal(ids.e, nil, "autre dimension : n'entend pas")

local sans, raison_sans = Radio.Destinataires(auditeurs, { id = "d", a_radio = false, canal = 5, dimension = 1 })
egal(sans, nil, "sans talkie-walkie : on n'émet pas")
ok(type(raison_sans) == "string" and #raison_sans > 0, "le refus d'émettre porte sa raison")

-- L'ordre rendu suit la liste reçue : deux appels identiques, deux réponses
-- identiques (pas de `pairs`).
local d1 = table.concat(Radio.Destinataires(auditeurs, emetteur), ",")
local d2 = table.concat(Radio.Destinataires(auditeurs, emetteur), ",")
egal(d1, d2, "la liste des destinataires est déterministe")

section("radio — la ligne affichée")

local ligne = Radio.Ligne("<b>Hanibes", 5, "on se retrouve au spatioport")
ok(ligne:find("spatioport", 1, true) ~= nil, "la ligne porte le message")
ok(ligne:find("5", 1, true) ~= nil, "la ligne porte le canal")
ok(ligne:find("<b>", 1, true) == nil, "le NOM du joueur est nettoyé lui aussi")

-- ══════════════════════════════════════════════════════════════════════════════
section("téléphone — boîte de réception")

ok(Telephone.OBJET ~= nil and VRAIS_ITEMS[Telephone.OBJET] ~= nil,
   "l'objet téléphone existe au catalogue d'objets (" .. tostring(Telephone.OBJET) .. ")")

local boite = Telephone.NouvelleBoite()
egal(#boite.messages, 0, "boîte neuve vide")
egal(Telephone.NonLus(boite), 0, "aucun non lu")

local b1 = Telephone.Deposer(boite, { de = "Kira", texte = "rdv 20h", quand = 100 })
egal(#boite.messages, 0, "Deposer ne modifie pas la boîte d'origine")
egal(#b1.messages, 1, "le message est déposé")
egal(Telephone.NonLus(b1), 1, "un message déposé est NON LU")

local pleine = boite
for i = 1, Telephone.BOITE_MAX + 5 do
    pleine = Telephone.Deposer(pleine, { de = "x", texte = "m" .. i, quand = i })
end
egal(#pleine.messages, Telephone.BOITE_MAX, "la boîte est plafonnée")
egal(pleine.messages[#pleine.messages].texte, "m" .. (Telephone.BOITE_MAX + 5), "le plus récent est gardé")
egal(pleine.messages[1].texte, "m6", "les plus anciens partent en premier")

local lue = Telephone.MarquerLus(b1)
egal(Telephone.NonLus(lue), 0, "MarquerLus : plus aucun non lu")
egal(Telephone.NonLus(b1), 1, "MarquerLus ne modifie pas la boîte d'origine")

section("téléphone — qui peut écrire à qui")

local moi = { id = "1", nom = "Hanibes", a_telephone = true }
local kira = { id = "2", nom = "Kira", a_telephone = true, en_ligne = true }
egal(Telephone.PeutEnvoyer(moi, kira), true, "deux porteurs en ligne : accepté")
egal(Telephone.PeutEnvoyer({ id = "1", nom = "H", a_telephone = false }, kira), false, "expéditeur sans téléphone : refusé")
egal(Telephone.PeutEnvoyer(moi, nil), false, "destinataire inconnu : refusé")
egal(Telephone.PeutEnvoyer(moi, { id = "3", nom = "Zed", a_telephone = false, en_ligne = true }), false,
     "destinataire sans téléphone : hors réseau")
egal(Telephone.PeutEnvoyer(moi, { id = "4", nom = "Off", a_telephone = true, en_ligne = false }), false,
     "destinataire déconnecté : refusé")
egal(Telephone.PeutEnvoyer(moi, { id = "1", nom = "Hanibes", a_telephone = true, en_ligne = true }), false,
     "s'écrire à soi-même : refusé")
ok(type(select(2, Telephone.PeutEnvoyer(moi, nil))) == "string", "chaque refus porte sa raison")

section("téléphone — contacts")

local joueurs = {
    { id = "3", nom = "zed", a_telephone = false },
    { id = "1", nom = "Hanibes", a_telephone = true },
    { id = "2", nom = "Kira", a_telephone = true },
}
local contacts = Telephone.Contacts(joueurs, "1")
egal(#contacts, 2, "on ne se voit pas soi-même dans ses contacts")
egal(contacts[1].nom, "Kira", "les contacts sont triés par nom, sans tenir compte de la casse")
egal(contacts[1].joignable, true, "un porteur de téléphone est joignable")
egal(contacts[2].joignable, false, "un joueur sans téléphone ne l'est pas")

ok(type(Telephone.APPLICATIONS) == "table" and #Telephone.APPLICATIONS >= 3, "le téléphone propose au moins trois applications")
local apps = {}
for _, a in ipairs(Telephone.APPLICATIONS) do apps[a.id] = true end
ok(apps.carte and apps.messages and apps.contacts, "carte, messages et contacts sont proposés")

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
REUSSIS, ECHECS = reussis, echecs
if (echecs > 0) then error(echecs .. " test(s) en echec") end