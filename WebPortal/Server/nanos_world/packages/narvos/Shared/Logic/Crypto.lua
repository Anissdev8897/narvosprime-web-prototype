-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Crypto.lua — SHA-256, HMAC et PBKDF2 en Lua 5.4 pur.
--
-- Câblage : Narvos.Crypto = Package.Require("Logic/Crypto.lua")
--
-- ── ⚠ LIRE AVANT D'UTILISER ────────────────────────────────────────────────────
-- Ce fichier existe parce que nanos n'expose AUCUNE primitive de hachage :
-- recherche exhaustive dans toute la référence de scripting, zéro résultat pour
-- sha/md5/bcrypt/hmac/pbkdf2. Sans lui, un mot de passe ne pourrait être stocké
-- qu'en clair, ce qui est inacceptable.
--
-- CE QUE C'EST : une implémentation de SHA-256 (FIPS 180-4), HMAC (RFC 2104) et
-- PBKDF2 (RFC 8018), vérifiée sur les vecteurs de test officiels — voir
-- scripts/lua-harness/crypto-tests.lua. Les vecteurs sont la seule chose qui
-- distingue une implémentation juste d'une qui « a l'air » de marcher.
--
-- CE QUE CE N'EST PAS : bcrypt, scrypt ou Argon2. PBKDF2 étire la clé par
-- itérations, mais il reste peu coûteux en mémoire — un attaquant équipé de GPU
-- le casse bien plus vite qu'Argon2. C'est le meilleur compromis atteignable en
-- Lua pur, pas un état de l'art.
--
-- CE QUI SERAIT MIEUX, le jour du VPS : déléguer l'authentification à un service
-- HTTP (nanos expose la classe `HTTP`) qui, lui, dispose d'une vraie bibliothèque
-- de crypto. Ce module reste alors pour le mode local.
--
-- ── POURQUOI LUA 5.4 SUFFIT ────────────────────────────────────────────────────
-- 5.4 a des entiers 64 bits natifs et les opérateurs binaires `& | ~ << >>`.
-- SHA-256 travaille sur 32 bits : chaque opération est donc masquée par
-- `& 0xFFFFFFFF`, sans quoi les retenues déborderaient dans les bits hauts et le
-- condensat serait faux — sans jamais lever d'erreur.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosCrypto
local Crypto = {}

local MASQUE = 0xFFFFFFFF

-- Constantes de FIPS 180-4 : 32 premiers bits des parties fractionnaires des
-- racines cubiques des 64 premiers nombres premiers.
local K = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
}

-- Valeurs initiales : 32 premiers bits des racines carrées des 8 premiers premiers.
local H0 = {
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
}

--- Rotation à droite sur 32 bits.
--- `>>` en Lua est un décalage LOGIQUE (il injecte des zéros), donc pas de
--- propagation de signe à corriger ; le masque, lui, reste indispensable sur la
--- partie gauche qui déborde au-delà du 32e bit.
local function rotr(x, n)
    return ((x >> n) | (x << (32 - n))) & MASQUE
end

--- Condensat SHA-256 d'une chaîne d'octets.
---@param message string
---@return string  32 octets bruts (non hexadécimaux)
function Crypto.Sha256(message)
    if (type(message) ~= "string") then
        error("Crypto.Sha256 attend une chaine, recu " .. type(message))
    end

    local h = { table.unpack(H0) }

    -- Bourrage : un bit à 1, des zéros, puis la longueur en BITS sur 64 bits
    -- gros-boutiste. La longueur est en bits, pas en octets — l'erreur classique.
    local taille_bits = #message * 8
    local m = message .. "\128"
    m = m .. string.rep("\0", (56 - #m % 64) % 64)
    m = m .. string.pack(">I8", taille_bits)

    for bloc = 1, #m, 64 do
        local w = {}
        for i = 0, 15 do
            w[i + 1] = string.unpack(">I4", m, bloc + i * 4)
        end
        for i = 17, 64 do
            local s0 = rotr(w[i - 15], 7) ~ rotr(w[i - 15], 18) ~ (w[i - 15] >> 3)
            local s1 = rotr(w[i - 2], 17) ~ rotr(w[i - 2], 19) ~ (w[i - 2] >> 10)
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) & MASQUE
        end

        local a, b, c, d, e, f, g, hh =
            h[1], h[2], h[3], h[4], h[5], h[6], h[7], h[8]

        for i = 1, 64 do
            local S1 = rotr(e, 6) ~ rotr(e, 11) ~ rotr(e, 25)
            local ch = (e & f) ~ ((~e & MASQUE) & g)
            local t1 = (hh + S1 + ch + K[i] + w[i]) & MASQUE
            local S0 = rotr(a, 2) ~ rotr(a, 13) ~ rotr(a, 22)
            local maj = (a & b) ~ (a & c) ~ (b & c)
            local t2 = (S0 + maj) & MASQUE

            hh, g, f, e = g, f, e, (d + t1) & MASQUE
            d, c, b, a = c, b, a, (t1 + t2) & MASQUE
        end

        h[1] = (h[1] + a) & MASQUE
        h[2] = (h[2] + b) & MASQUE
        h[3] = (h[3] + c) & MASQUE
        h[4] = (h[4] + d) & MASQUE
        h[5] = (h[5] + e) & MASQUE
        h[6] = (h[6] + f) & MASQUE
        h[7] = (h[7] + g) & MASQUE
        h[8] = (h[8] + hh) & MASQUE
    end

    local sortie = {}
    for i = 1, 8 do sortie[i] = string.pack(">I4", h[i]) end
    return table.concat(sortie)
end

--- Représentation hexadécimale minuscule d'une chaîne d'octets.
---@param octets string
---@return string
function Crypto.Hex(octets)
    return (octets:gsub(".", function(c) return string.format("%02x", c:byte()) end))
end

--- SHA-256 rendu directement en hexadécimal.
function Crypto.Sha256Hex(message)
    return Crypto.Hex(Crypto.Sha256(message))
end

local BLOC = 64          -- taille de bloc de SHA-256, en octets

--- HMAC-SHA256 (RFC 2104).
---@param cle string
---@param message string
---@return string  32 octets bruts
function Crypto.Hmac(cle, message)
    -- Une clé plus longue que le bloc est d'abord condensée ; plus courte, elle
    -- est complétée de zéros. Omettre ce cas donne un HMAC qui marche sur les
    -- clés courtes et diverge sur les longues — le pire des bogues.
    if (#cle > BLOC) then cle = Crypto.Sha256(cle) end
    cle = cle .. string.rep("\0", BLOC - #cle)

    local interne, externe = {}, {}
    for i = 1, BLOC do
        local o = cle:byte(i)
        interne[i] = string.char(o ~ 0x36)
        externe[i] = string.char(o ~ 0x5c)
    end

    return Crypto.Sha256(table.concat(externe) .. Crypto.Sha256(table.concat(interne) .. message))
end

--- PBKDF2-HMAC-SHA256 (RFC 8018), dkLen fixé à 32 octets.
---
--- Une seule itération suffirait à cacher le mot de passe ; il en faut beaucoup
--- pour rendre une attaque par dictionnaire coûteuse. `Comptes.lua` enregistre le
--- compte d'itérations AVEC le hachage, pour pouvoir l'augmenter plus tard sans
--- invalider les comptes existants.
---@param motdepasse string
---@param sel string
---@param iterations integer
---@return string  32 octets bruts
function Crypto.Pbkdf2(motdepasse, sel, iterations)
    if (type(iterations) ~= "number" or iterations < 1) then
        error("Crypto.Pbkdf2 : iterations doit etre un entier >= 1")
    end

    -- dkLen = 32 = la taille d'un condensat : un seul bloc, donc l'indice est
    -- toujours 1. Pas de boucle sur les blocs à écrire.
    local u = Crypto.Hmac(motdepasse, sel .. string.pack(">I4", 1))
    local resultat = u

    for _ = 2, iterations do
        u = Crypto.Hmac(motdepasse, u)
        local melange = {}
        for i = 1, 32 do
            melange[i] = string.char(resultat:byte(i) ~ u:byte(i))
        end
        resultat = table.concat(melange)
    end

    return resultat
end

--- Comparaison à temps constant.
---
--- ⚠ NE PAS remplacer par `a == b`. L'égalité de chaînes de Lua s'arrête au
--- premier octet différent : le temps de réponse révèle alors combien d'octets
--- de tête sont justes, ce qui permet de reconstruire un condensat octet par
--- octet. On compare donc TOUJOURS toute la longueur.
---@param a string
---@param b string
---@return boolean
function Crypto.EgalConstant(a, b)
    if (type(a) ~= "string" or type(b) ~= "string") then return false end
    if (#a ~= #b) then return false end

    local diff = 0
    for i = 1, #a do
        diff = diff | (a:byte(i) ~ b:byte(i))
    end
    return diff == 0
end

return Crypto
