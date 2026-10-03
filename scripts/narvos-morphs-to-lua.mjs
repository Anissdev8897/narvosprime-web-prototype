// ══════════════════════════════════════════════════════════════════════════════
// narvos-morphs-to-lua.mjs — catalogue de curseurs depuis les morphs du GLB.
//
//   node scripts/narvos-morphs-to-lua.mjs [--apply]
//
// ── POURQUOI GÉNÉRER PLUTÔT QU'ÉCRIRE ────────────────────────────────────────
// 290 morphs. Une table écrite à la main serait juste le jour où on l'écrit et
// fausse à la première régénération du GLB — avec des curseurs qui pilotent des
// morphs inexistants, et rien pour le signaler : `SetMorphTarget` sur un nom
// inconnu ne lève pas.
//
// La source de vérité est donc `mesh.extras.targetNames` du GLB lui-même.
//
// ── DEUX FORMES DE RÉGLAGE, ET ELLES NE SE MÉLANGENT PAS ─────────────────────
// Les noms MakeHuman suivent `<zone>-<trait>-<sens>`, et les sens vont par
// couples opposés : `decr`/`incr`, `down`/`up`, `in`/`out`,
// `backward`/`forward`, `concave`/`convex`, `compress`/`uncompress`.
//
//   CURSEUR   deux morphs opposés, un axe continu de -1 à +1. Le signe choisit
//             lequel des deux s'applique — jamais les deux à la fois, ils se
//             contrarieraient.
//   FORME     un groupe exclusif (`round`, `square`, `triangle`…). Ce ne sont
//             pas les extrémités d'un axe : un menton n'est pas « entre rond et
//             carré », il est l'un ou l'autre.
//
// Les fondre en un seul type produirait des curseurs absurdes, du genre « 40 %
// de triangle ».
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const GLB = "E:/narvosprime-web-prototype/WebPortal/public/models/personnages/_body/base_morphable.glb";
const CIBLE = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Morphs.lua";

const APPLY = process.argv.includes("--apply");

/** Couples d'opposés : [négatif, positif]. L'ordre décide du sens du curseur —
 *  vers la droite, le trait AUGMENTE. */
const OPPOSES = [
  ["decr", "incr"],
  ["down", "up"],
  ["in", "out"],
  ["backward", "forward"],
  ["concave", "convex"],
  ["compress", "uncompress"],
];

/** Nom court de chaque axe, pour desambiguïser un trait qui en porte plusieurs.
 *
 *  ⚠ UN TRAIT PEUT AVOIR DEUX AXES, et c'est le cas de treize d'entre eux :
 *  `l-ear-trans` se regle en HAUTEUR (`down`/`up`) ET en PROFONDEUR
 *  (`backward`/`forward`). Les nommer tous deux `l-ear-trans` donnait deux
 *  curseurs de meme identifiant — le second ecrasait le premier dans les
 *  reglages du joueur, et un des deux axes devenait inatteignable.
 *
 *  Trouve par le test « les identifiants de curseur sont uniques ». */
const LIBELLE_AXE = {
  decr: "",                 // axe par defaut : pas de suffixe
  down: "vert",
  in: "lat",
  backward: "prof",
  concave: "courbe",
  compress: "compr",
};

/** Suffixes qui décrivent une FORME et non un sens. */
const FORMES = new Set([
  "round", "square", "triangle", "triangular", "invertedtriangular",
  "pointed", "diamond", "oval", "rectangular", "lozenge",
]);

/** Libellés français par zone, pour l'écran de création. Écrits à la main : ce
 *  sont dix mots, et une traduction automatique donnerait « forehead ». */
const LIBELLE_ZONE = {
  nose: "Nez",
  mouth: "Bouche",
  eyes: "Yeux",
  eye: "Yeux",
  ears: "Oreilles",
  ear: "Oreilles",
  cheek: "Joues",
  chin: "Menton",
  forehead: "Front",
  eyebrows: "Sourcils",
  eyebrow: "Sourcils",
  head: "Tête",
  neck: "Cou",
  // Prefixe MakeHuman des MESURES : `measure-neck-circ` regle une
  // circonference, pas un trait de visage. Deux curseurs seulement, et ils
  // touchent le cou — d'ou le libelle.
  measure: "Mensurations",
};

// ── Lecture des noms ─────────────────────────────────────────────────────────

const buf = fs.readFileSync(GLB);
if (buf.toString("utf8", 0, 4) !== "glTF") throw new Error("pas un GLB : " + GLB);
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.toString("utf8", 20, 20 + jsonLen));

const noms = gltf.meshes?.[0]?.extras?.targetNames;
if (!Array.isArray(noms) || noms.length === 0) {
  throw new Error("le GLB ne porte pas de targetNames — regenerer avec narvos-morphs-vers-glb.mjs");
}

console.log(`${noms.length} morph(s) lus dans ${GLB.split("/").pop()}`);

// ── Appariement ──────────────────────────────────────────────────────────────

const presents = new Set(noms);
const consommes = new Set();

const curseurs = [];
const formes = new Map();     // racine -> [{ suffixe, morph }]

for (const nom of noms) {
  if (consommes.has(nom)) continue;

  const morceaux = nom.split("-");
  const suffixe = morceaux[morceaux.length - 1];
  const racine = morceaux.slice(0, -1).join("-");

  // Forme : on regroupe, on tranchera après.
  if (FORMES.has(suffixe)) {
    if (!formes.has(racine)) formes.set(racine, []);
    formes.get(racine).push({ suffixe, morph: nom });
    consommes.add(nom);
    continue;
  }

  const couple = OPPOSES.find(([a, b]) => suffixe === a || suffixe === b);
  if (!couple) continue;

  const [neg, pos] = couple;
  const nomNeg = `${racine}-${neg}`;
  const nomPos = `${racine}-${pos}`;

  // Les deux extrémités doivent exister. Une seule ferait un curseur qui ne
  // bouge que d'un côté, ce qui se lit comme un bug.
  if (!presents.has(nomNeg) || !presents.has(nomPos)) continue;

  consommes.add(nomNeg);
  consommes.add(nomPos);

  curseurs.push({
    racine,
    axe: neg,
    zone: racine.startsWith("l-") || racine.startsWith("r-")
      ? racine.split("-")[1]
      : racine.split("-")[0],
    cote: racine.startsWith("l-") ? "gauche" : racine.startsWith("r-") ? "droit" : null,
    negatif: nomNeg,
    positif: nomPos,
  });
}

// ── Identifiants ──────────────────────────────────────────────────────────────
//
// On suffixe par l'axe UNIQUEMENT quand la racine en porte plusieurs. Suffixer
// systematiquement donnerait `nose-hump-` la ou `nose-hump` suffit ; ne jamais
// suffixer redonnerait les collisions.

const axesParRacine = new Map();
for (const c of curseurs) {
  if (!axesParRacine.has(c.racine)) axesParRacine.set(c.racine, new Set());
  axesParRacine.get(c.racine).add(c.axe);
}

for (const c of curseurs) {
  const plusieurs = axesParRacine.get(c.racine).size > 1;
  const suffixe = LIBELLE_AXE[c.axe] ?? c.axe;
  c.id = plusieurs && suffixe ? `${c.racine}-${suffixe}` : c.racine;
}

// Une « forme » seule n'en est pas une : c'est un morph isolé, qu'on expose en
// curseur unipolaire plutôt que de le perdre.
const choix = [];
for (const [racine, liste] of formes) {
  if (liste.length < 2) {
    for (const f of liste) {
      curseurs.push({
        id: f.morph,
        zone: racine.split("-")[0],
        cote: null,
        negatif: null,
        positif: f.morph,
      });
    }
    continue;
  }
  choix.push({
    id: racine,
    zone: racine.split("-")[0],
    options: liste.sort((a, b) => a.suffixe.localeCompare(b.suffixe)),
  });
}

// Les ANCRES de corps ne sont pas des curseurs et ne doivent pas être comptées
// comme des restes. Elles sont pilotées par `Logic/Macros.lua`, qui répartit
// six réglages de haut niveau entre elles.
//
// Sans cette distinction, la sortie annonçait « 232 orphelins » — un chiffre
// alarmant pour un fonctionnement normal, et le genre de bruit qui fait qu'on
// finit par ne plus lire les avertissements.
const estMacro = (n) => /^(african|asian|caucasian)-/.test(n)
  || n.startsWith("universal-") || n.startsWith("height/");

const restants = noms.filter((n) => !consommes.has(n)
  && !curseurs.some((c) => c.negatif === n || c.positif === n));

const macros = restants.filter(estMacro);
const orphelins = restants.filter((n) => !estMacro(n));

console.log(`  ${curseurs.length} curseur(s), ${choix.length} choix de forme`);
console.log(`  ${macros.length} ancre(s) de corps — pilotees par Logic/Macros.lua`);

// Un VRAI orphelin, lui, mérite d'être vu : c'est un morph cuit que rien ne
// peut activer.
if (orphelins.length) {
  console.log(`  ⚠ ${orphelins.length} morph(s) sans curseur ni macro : ${orphelins.slice(0, 8).join(", ")}`);
}

// ── Sérialisation ────────────────────────────────────────────────────────────

const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`;

const parZone = {};
for (const c of curseurs) (parZone[c.zone] ||= []).push(c);

const zonesTriees = Object.keys(parZone).sort();

const lignesCurseurs = curseurs
  .slice()
  .sort((a, b) => a.zone.localeCompare(b.zone) || a.id.localeCompare(b.id))
  .map((c) =>
    `    { id = ${q(c.id)}, zone = ${q(c.zone)}, ` +
    (c.cote ? `cote = ${q(c.cote)}, ` : "") +
    (c.negatif ? `negatif = ${q(c.negatif)}, ` : "") +
    `positif = ${q(c.positif)} },`)
  .join("\n");

const lignesChoix = choix
  .slice()
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((c) =>
    `    { id = ${q(c.id)}, zone = ${q(c.zone)}, options = { ` +
    c.options.map((o) => `{ nom = ${q(o.suffixe)}, morph = ${q(o.morph)} }`).join(", ") +
    " } },")
  .join("\n");

const lignesZones = zonesTriees
  .map((z) => `    { id = ${q(z)}, label = ${q(LIBELLE_ZONE[z] ?? z)} },`)
  .join("\n");

const lua = `-- ══════════════════════════════════════════════════════════════════════════════
-- Morphs.lua — reglages de morphologie du corps morphable.
--
-- FICHIER GENERE par scripts/narvos-morphs-to-lua.mjs — ne pas editer a la main.
-- Il est reconstruit depuis les targetNames du GLB, ce qui garantit qu'aucun
-- curseur ne pilote un morph absent du mesh cuit.
--
-- ${curseurs.length} curseurs, ${choix.length} choix de forme, sur ${zonesTriees.length} zones.
--
-- ── COMMENT UN CURSEUR S'APPLIQUE ─────────────────────────────────────────────
-- Un curseur va de -1 a +1 et porte DEUX morphs opposes. Le signe choisit lequel
-- s'applique, et l'autre est remis a zero :
--
--     valeur < 0  ->  SetMorphTarget(negatif, -valeur) ; positif a 0
--     valeur > 0  ->  SetMorphTarget(positif,  valeur) ; negatif a 0
--
-- ⚠ REMETTRE L'AUTRE A ZERO N'EST PAS FACULTATIF. Les deux morphs tirent les
-- memes sommets en sens contraire : les laisser tous deux actifs les annule
-- partiellement, et le curseur semble ne rien faire passe un certain point.
--
-- ── COTES GAUCHE ET DROIT ─────────────────────────────────────────────────────
-- Les morphs prefixes \`l-\` et \`r-\` portent un champ \`cote\`. L'ecran peut les
-- lier (symetrie) ou les separer (asymetrie) ; le catalogue ne tranche pas.
-- ══════════════════════════════════════════════════════════════════════════════

local Morphs = {}

--- Mesh qui porte ces morphs. Un autre corps ne les a PAS : les appliquer
--- ailleurs ne leve rien et ne fait rien.
Morphs.MESH = "narvos::base_morphable"

--- Zones, dans l'ordre d'affichage.
Morphs.ZONES = {
${lignesZones}
}

--- Curseurs bipolaires. \`negatif\` absent = curseur unipolaire (0 a 1).
Morphs.CURSEURS = {
${lignesCurseurs}
}

--- Choix de forme : options exclusives, une seule active a la fois.
Morphs.CHOIX = {
${lignesChoix}
}

--- Curseurs d'une zone, ordre stable.
---@param zone string
---@return table[]
function Morphs.ParZone(zone)
    local sortie = {}
    for _, c in ipairs(Morphs.CURSEURS) do
        if (c.zone == zone) then sortie[#sortie + 1] = c end
    end
    return sortie
end

--- Un curseur par son identifiant, ou nil.
---@param id string
---@return table|nil
function Morphs.Curseur(id)
    if (type(id) ~= "string") then return nil end
    for _, c in ipairs(Morphs.CURSEURS) do
        if (c.id == id) then return c end
    end
    return nil
end

--- Un choix de forme par son identifiant, ou nil.
---@param id string
---@return table|nil
function Morphs.Choix(id)
    if (type(id) ~= "string") then return nil end
    for _, c in ipairs(Morphs.CHOIX) do
        if (c.id == id) then return c end
    end
    return nil
end

--- Borne une valeur de curseur.
--- Un curseur unipolaire ne descend pas sous zero : son morph negatif n'existe
--- pas, et une valeur negative ne ferait rien du tout — silencieusement.
---@param curseur table
---@param valeur any
---@return number
function Morphs.Borner(curseur, valeur)
    local v = tonumber(valeur) or 0
    local mini = (curseur and curseur.negatif) and -1 or 0
    if (v < mini) then return mini end
    if (v > 1) then return 1 end
    return v
end

--- Traduit un reglage en morphs a poser : { [nom_de_morph] = poids }.
---
--- Rend TOUJOURS les deux extremites d'un curseur, dont une a zero. C'est ce qui
--- annule le morph oppose quand le joueur traverse le milieu — sans quoi tirer
--- un curseur a droite puis a gauche laisserait les deux actifs.
---@param reglages table  { [id_curseur] = nombre, [id_choix] = "nom_option" }
---@return table
function Morphs.Resoudre(reglages)
    local sortie = {}
    if (type(reglages) ~= "table") then return sortie end

    for _, c in ipairs(Morphs.CURSEURS) do
        local v = Morphs.Borner(c, reglages[c.id])
        if (c.negatif) then
            sortie[c.negatif] = (v < 0) and -v or 0
            sortie[c.positif] = (v > 0) and v or 0
        else
            sortie[c.positif] = (v > 0) and v or 0
        end
    end

    for _, c in ipairs(Morphs.CHOIX) do
        local choisi = reglages[c.id]
        for _, o in ipairs(c.options) do
            sortie[o.morph] = (o.nom == choisi) and 1 or 0
        end
    end

    return sortie
end

return Morphs
`;

if (!APPLY) {
  console.log("");
  console.log("=== SIMULATION (ajouter --apply) ===");
  console.log(`  ${lua.split("\\n").length} lignes seraient ecrites dans ${CIBLE}`);
} else {
  fs.writeFileSync(CIBLE, lua, "utf8");
  console.log("");
  console.log(`  ecrit : ${CIBLE}`);
}