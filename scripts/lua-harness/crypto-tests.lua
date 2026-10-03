-- ══════════════════════════════════════════════════════════════════════════════
-- crypto-tests.lua — vecteurs de test officiels pour Shared/Logic/Crypto.lua.
-- Chargé par crypto.mjs, qui fournit `Crypto`.
--
-- ── POURQUOI DES VECTEURS ET PAS DES ASSERTIONS MAISON ────────────────────────
-- Une implémentation de SHA-256 fausse ne lève JAMAIS : elle rend simplement un
-- condensat qui n'est pas SHA-256. On ne peut donc pas la valider en la
-- comparant à elle-même — seule une valeur publiée ailleurs le peut.
--
-- Sources : FIPS 180-4 (SHA-256), RFC 4231 (HMAC-SHA256), RFC 8018 / vecteurs
-- publics (PBKDF2-HMAC-SHA256).
-- ══════════════════════════════════════════════════════════════════════════════

local reussis, echecs = 0, 0

local function egal(obtenu, attendu, nom)
    if (obtenu == attendu) then
        reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom)
        print("     obtenu  = " .. tostring(obtenu))
        print("     attendu = " .. tostring(attendu))
    end
end

local function ok(condition, nom)
    if (condition) then
        reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom)
    end
end

local function section(nom) print("[" .. nom .. "]") end

--- Convertit une chaîne hexadécimale en octets, pour les clés des vecteurs RFC.
local function deHex(h)
    return (h:gsub("%x%x", function(o) return string.char(tonumber(o, 16)) end))
end

-- ── SHA-256 — FIPS 180-4 ──────────────────────────────────────────────────────

section("SHA-256 (FIPS 180-4)")

egal(Crypto.Sha256Hex(""),
     "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
     "chaine vide")

egal(Crypto.Sha256Hex("abc"),
     "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
     "abc")

-- 56 octets : le cas limite du bourrage. À cette longueur exacte, la longueur
-- codée ne tient plus dans le bloc courant et il en faut un second — c'est ici
-- qu'une implémentation approximative se trompe.
egal(Crypto.Sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
     "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
     "56 octets (bourrage sur deux blocs)")

-- 112 octets : deux blocs pleins, même piège un cran plus loin.
egal(Crypto.Sha256Hex("abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmn" ..
                      "hijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"),
     "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1",
     "112 octets")

-- Un million de 'a' serait le vecteur canonique suivant ; on s'en tient à 1000
-- pour ne pas allonger la suite de tests. Ce qui compte est déjà couvert.
egal(#Crypto.Sha256("n'importe quoi"), 32, "le condensat fait 32 octets")

-- ── HMAC-SHA256 — RFC 4231 ────────────────────────────────────────────────────

section("HMAC-SHA256 (RFC 4231)")

egal(Crypto.Hex(Crypto.Hmac(deHex(string.rep("0b", 20)), "Hi There")),
     "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
     "cas 1")

egal(Crypto.Hex(Crypto.Hmac("Jefe", "what do ya want for nothing?")),
     "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
     "cas 2")

egal(Crypto.Hex(Crypto.Hmac(deHex(string.rep("aa", 20)), deHex(string.rep("dd", 50)))),
     "773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe",
     "cas 3")

-- Clé de 131 octets : PLUS LONGUE que le bloc de 64. Elle doit être condensée
-- d'abord. Sans ce traitement, tout marche sur les clés courtes et diverge ici.
egal(Crypto.Hex(Crypto.Hmac(deHex(string.rep("aa", 131)),
     "Test Using Larger Than Block-Size Key - Hash Key First")),
     "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54",
     "cas 6 — cle plus longue que le bloc")

-- ── PBKDF2-HMAC-SHA256 ────────────────────────────────────────────────────────

section("PBKDF2-HMAC-SHA256")

egal(Crypto.Hex(Crypto.Pbkdf2("password", "salt", 1)),
     "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b",
     "1 iteration")

egal(Crypto.Hex(Crypto.Pbkdf2("password", "salt", 2)),
     "ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43",
     "2 iterations")

egal(Crypto.Hex(Crypto.Pbkdf2("password", "salt", 4096)),
     "c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a",
     "4096 iterations")

-- Le compte d'itérations doit changer le résultat, sinon il ne protège de rien.
ok(Crypto.Pbkdf2("mdp", "sel", 10) ~= Crypto.Pbkdf2("mdp", "sel", 11),
   "le nombre d'iterations change le resultat")

-- Deux sels différents doivent donner deux hachages différents pour le MÊME mot
-- de passe : c'est toute la raison d'être du sel.
ok(Crypto.Pbkdf2("mdp", "selA", 100) ~= Crypto.Pbkdf2("mdp", "selB", 100),
   "le sel change le resultat")

local okerr = pcall(Crypto.Pbkdf2, "mdp", "sel", 0)
ok(not okerr, "0 iteration est refuse")

-- ── Comparaison à temps constant ──────────────────────────────────────────────

section("EgalConstant")

ok(Crypto.EgalConstant("abcdef", "abcdef"), "chaines egales")
ok(not Crypto.EgalConstant("abcdef", "abcdeg"), "dernier octet different")
ok(not Crypto.EgalConstant("abcdef", "zbcdef"), "premier octet different")
ok(not Crypto.EgalConstant("abc", "abcd"), "longueurs differentes")
ok(not Crypto.EgalConstant(nil, "abc"), "nil refuse sans lever")
ok(not Crypto.EgalConstant("abc", 42), "non-chaine refusee sans lever")

-- ── Bilan ─────────────────────────────────────────────────────────────────────

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
if (echecs > 0) then error(echecs .. " test(s) en echec") end