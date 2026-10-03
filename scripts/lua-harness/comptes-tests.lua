-- ══════════════════════════════════════════════════════════════════════════════
-- comptes-tests.lua — assertions sur Shared/Logic/Comptes.lua.
-- Chargé par comptes.mjs, qui fournit `Comptes` et le global `FausseBase`.
--
-- ── CE QUI EST TESTÉ, ET COMMENT ──────────────────────────────────────────────
-- La classe `Database` de nanos n'existe pas hors moteur. Plutôt que d'émuler
-- SQLite — ce qui reviendrait à tester l'émulateur — on injecte une fausse base
-- qui répond aux QUATRE requêtes réellement émises par le module, et qui
-- ENREGISTRE ce qu'on lui passe. C'est ce registre qui permet de vérifier le
-- point le plus important : aucune valeur du joueur n'est concaténée dans le SQL.
-- ══════════════════════════════════════════════════════════════════════════════

local reussis, echecs = 0, 0

local function ok(condition, nom)
    if (condition) then
        reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom)
    end
end

local function egal(obtenu, attendu, nom)
    if (obtenu == attendu) then
        reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom .. "  obtenu=" .. tostring(obtenu) .. "  attendu=" .. tostring(attendu))
    end
end

local function section(nom) print("[" .. nom .. "]") end

-- ── Validation de l'identifiant ───────────────────────────────────────────────

section("ValiderIdentifiant")

egal(Comptes.ValiderIdentifiant("aniss"), true, "identifiant normal")
egal(Comptes.ValiderIdentifiant("a_b-c.1"), true, "caracteres autorises")
egal(Comptes.ValiderIdentifiant(""), false, "vide refuse")
egal(Comptes.ValiderIdentifiant("  "), false, "espaces seuls refuses")
egal(Comptes.ValiderIdentifiant("ab"), false, "trop court refuse")
egal(Comptes.ValiderIdentifiant(string.rep("a", 25)), false, "trop long refuse")
egal(Comptes.ValiderIdentifiant("ani ss"), false, "espace interne refuse")
egal(Comptes.ValiderIdentifiant("a'; DROP TABLE comptes;--"), false, "injection refusee")
egal(Comptes.ValiderIdentifiant("héllo"), false, "accents refuses")
egal(Comptes.ValiderIdentifiant(nil), false, "nil refuse sans lever")

-- Un identifiant entouré d'espaces doit être jugé sur sa forme ROGNÉE, celle
-- qui sera enregistrée. Sinon un nom valide serait refusé pour sa décoration.
egal(Comptes.ValiderIdentifiant("  aniss  "), true, "espaces exterieurs rognes avant jugement")

-- ── Validation du mot de passe ────────────────────────────────────────────────

section("ValiderMotDePasse")

egal(Comptes.ValiderMotDePasse("motdepasse"), true, "mot de passe assez long")
egal(Comptes.ValiderMotDePasse("court"), false, "trop court refuse")
egal(Comptes.ValiderMotDePasse(""), false, "vide refuse")
egal(Comptes.ValiderMotDePasse(nil), false, "nil refuse sans lever")

-- Les espaces comptent : un mot de passe n'est jamais rogné, sinon
-- « mon mot de passe » et « mon mot de passe  » ouvriraient le même compte.
egal(Comptes.ValiderMotDePasse("        "), true, "8 espaces acceptes tels quels")

-- ── Sel ───────────────────────────────────────────────────────────────────────

section("NouveauSel")

local sel = Comptes.NouveauSel()
egal(#sel, 32, "sel de 32 caracteres hex (16 octets)")
ok(sel:match("^%x+$") ~= nil, "sel purement hexadecimal")
ok(Comptes.NouveauSel() ~= Comptes.NouveauSel(), "deux sels different")

-- ── Limitation des tentatives ─────────────────────────────────────────────────

section("limitation de debit")

local lim = Comptes.NouvelleLimite()
egal(select(1, Comptes.Bloque(lim, 0)), false, "libre au depart")

-- Quatre echecs ne bloquent pas : le cinquieme, si.
for i = 1, Comptes.MAX_TENTATIVES - 1 do
    Comptes.EnregistrerEchec(lim, 100)
end
egal(select(1, Comptes.Bloque(lim, 100)), false,
    "encore libre a " .. (Comptes.MAX_TENTATIVES - 1) .. " echecs")

Comptes.EnregistrerEchec(lim, 100)
egal(select(1, Comptes.Bloque(lim, 100)), true, "bloque au seuil")

local _, reste = Comptes.Bloque(lim, 100)
egal(reste, Comptes.BLOCAGE_S, "duree de blocage complete au moment de l'echec")

-- La borne compte : a l'instant EXACT de l'expiration, on est libre.
egal(select(1, Comptes.Bloque(lim, 100 + Comptes.BLOCAGE_S)), false,
    "libre a l'expiration exacte")
egal(select(1, Comptes.Bloque(lim, 100 + Comptes.BLOCAGE_S - 0.01)), true,
    "encore bloque juste avant")

-- ⚠ LE COMPTEUR NE SE REMET PAS A ZERO A L'EXPIRATION. Sinon l'attaquant
-- reprendrait MAX_TENTATIVES essais gratuits a chaque minute.
Comptes.EnregistrerEchec(lim, 200)
egal(select(1, Comptes.Bloque(lim, 200)), true,
    "un seul echec apres expiration rebloque aussitot")

-- Seule une reussite libere.
Comptes.EnregistrerSucces(lim)
egal(select(1, Comptes.Bloque(lim, 200)), false, "une reussite libere")
egal(lim.echecs, 0, "et remet le compteur a zero")

-- Robustesse : aucune de ces fonctions ne doit lever sur une entree absurde.
egal(select(1, Comptes.Bloque(nil, 0)), false, "Bloque(nil) ne leve pas")
egal(select(1, Comptes.Bloque(lim, nil)), false, "instant nil ne leve pas")
Comptes.EnregistrerEchec(nil, 0)
Comptes.EnregistrerSucces(nil)
ok(true, "EnregistrerEchec/Succes(nil) ne levent pas")

-- ── Hachage et vérification ───────────────────────────────────────────────────

section("Hacher / VerifierMotDePasse")

local SEL = "0123456789abcdef0123456789abcdef"
local ITER = 50            -- volontairement bas : ces tests tournent souvent
local HASH = Comptes.Hacher("motdepasse", SEL, ITER)

egal(#HASH, 64, "hachage de 64 caracteres hex (32 octets)")
ok(HASH ~= "motdepasse", "le mot de passe n'est pas stocke en clair")
ok(not HASH:find("motdepasse", 1, true), "le mot de passe n'apparait pas dans le hachage")

local ligne = { hash = HASH, sel = SEL, iterations = ITER }

egal(Comptes.VerifierMotDePasse("motdepasse", ligne), true, "bon mot de passe accepte")
egal(Comptes.VerifierMotDePasse("motdepassE", ligne), false, "casse differente refusee")
egal(Comptes.VerifierMotDePasse("", ligne), false, "vide refuse")
egal(Comptes.VerifierMotDePasse("motdepasse", nil), false, "ligne absente refusee")
egal(Comptes.VerifierMotDePasse("motdepasse", { hash = HASH }), false, "sel manquant refuse")
egal(Comptes.VerifierMotDePasse("motdepasse", { hash = HASH, sel = SEL }), false,
     "iterations manquantes refusees")

-- Le compte d'itérations est relu depuis la LIGNE, pas depuis la constante du
-- module : sans ça, augmenter Comptes.ITERATIONS invaliderait tous les comptes
-- existants d'un coup.
egal(Comptes.VerifierMotDePasse("motdepasse", { hash = HASH, sel = SEL, iterations = ITER + 1 }),
     false, "un autre nombre d'iterations ne valide pas")

-- ── Flux avec base ────────────────────────────────────────────────────────────

section("Inscrire / Connexion")

Comptes.ITERATIONS = ITER      -- garder les tests rapides
local base = FausseBase()
Comptes.UtiliserBase(base)

local compte, raison = Comptes.Inscrire("aniss", "motdepasse")
ok(compte ~= nil, "inscription reussie (" .. tostring(raison) .. ")")

local double, raison2 = Comptes.Inscrire("aniss", "autremotdepasse")
egal(double, nil, "identifiant deja pris refuse")
ok(raison2 ~= nil, "un motif est donne")

-- Casse : « Aniss » et « aniss » sont le même compte.
egal(Comptes.Inscrire("ANISS", "motdepasse"), nil, "meme identifiant en majuscules refuse")

egal(select(1, Comptes.Inscrire("ab", "motdepasse")), nil, "identifiant invalide refuse")
egal(select(1, Comptes.Inscrire("valide", "court")), nil, "mot de passe invalide refuse")

local connecte = Comptes.Connexion("aniss", "motdepasse")
ok(connecte ~= nil, "connexion avec le bon mot de passe")

local refuse, motif = Comptes.Connexion("aniss", "mauvais_motdepasse")
egal(refuse, nil, "mauvais mot de passe refuse")

local inconnu, motif2 = Comptes.Connexion("personne", "motdepasse")
egal(inconnu, nil, "compte inconnu refuse")

-- ⚠ Le point de sécurité : les deux refus doivent être INDISCERNABLES, sinon on
-- peut énumérer les identifiants existants.
egal(motif, motif2, "meme message pour mot de passe faux et compte inconnu")

-- ── Injection SQL ─────────────────────────────────────────────────────────────

section("injection SQL")

-- Le test qui compte vraiment : aucune valeur venant du joueur ne doit se
-- retrouver DANS la chaîne SQL. Elles doivent toutes passer par les arguments.
local sale = "x'; DROP TABLE comptes; --"
Comptes.ParIdentifiant(sale)
Comptes.ParSteam(sale)
Comptes.ConnexionSteam(sale, sale)

local concatene = false
for _, req in ipairs(base.requetes) do
    if (req.sql:find("DROP TABLE comptes", 1, true)) then concatene = true end
end
ok(not concatene, "aucune valeur joueur concatenee dans le SQL")

local avec_placeholders = 0
for _, req in ipairs(base.requetes) do
    if (req.sql:find(":0", 1, true)) then avec_placeholders = avec_placeholders + 1 end
end
ok(avec_placeholders > 0, "les requetes utilisent des placeholders")

-- ── Hors moteur ───────────────────────────────────────────────────────────────

section("hors moteur")

Comptes.Fermer()
egal(Comptes.Prete(), false, "Prete() faux apres fermeture")
egal(select(1, Comptes.Connexion("aniss", "motdepasse")), nil, "connexion sans base rend nil")
egal(select(1, Comptes.Inscrire("aniss", "motdepasse")), nil, "inscription sans base rend nil")

-- ── Bilan ─────────────────────────────────────────────────────────────────────

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
if (echecs > 0) then error(echecs .. " test(s) en echec") end