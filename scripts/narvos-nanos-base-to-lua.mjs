// ══════════════════════════════════════════════════════════════════════════════
// narvos-nanos-base-to-lua.mjs — catalogue les assets du PACK DE BASE nanos.
//
//   node scripts/narvos-nanos-base-to-lua.mjs [--apply]
//
// Produit deux catalogues Lua :
//   Shared/Catalogs/Vfx.lua    particules (pouvoirs, impacts, fumées, réacteurs)
//   Shared/Catalogs/Props.lua  static meshes de décor, par catégorie
//
// ── POURQUOI LE PACK DE BASE, ET PAS LE NÔTRE ─────────────────────────────────
// Notre pack cuit contient 0 particule et 0 son : mesuré dans son `Assets.toml`
// (`[assets.particles]` vide). Les 10 dossiers `public/models/vfx/VFX/` ne sont
// PAS des `.uasset` mais des GLB — or un système Niagara ne survit pas à un
// export glTF : il n'en reste que des plans texturés, aucune simulation.
//
// Le pack de base, lui, embarque 88 particules dont 21 de magie (FXVarietyPack)
// et 451 static meshes de décor. Ils sont déjà chez chaque joueur : zéro import,
// zéro cook, zéro octet de téléchargement.
//
// ── POURQUOI ON LIT LE DISQUE, PAS LA DOC ─────────────────────────────────────
// La doc nanos ne liste que 6 particules « template » et renvoie vers un fichier
// GitHub pour le reste. Le contenu installé est la seule source qui dise ce que
// le client possède RÉELLEMENT. Un nom inventé ne lève pas : `Particle()` sur un
// asset absent ne fait simplement rien.
//
// ── LA CLÉ N'EST PAS LE NOM DE FICHIER — CORRIGÉ LE 2026-09-14 ─────────────────
// Ce générateur supposait `clé = nom du .uasset`. Mesuré dans le manifeste du
// pack de base (`DefaultAssetPack.toml`, [assets.particles]) : 95 clés sur 173
// DIFFÈRENT de leur fichier — `P_FXVariety_FireBall` pointe `P_ky_fireBall`,
// `P_RocketExhaust_Blue` pointe `NS_RocketExhaust_Blue`. Vfx.lua citait donc 39
// effets par leur nom de fichier : `Particle("nanos-world::P_ky_fireBall")` ne
// charge RIEN, sans erreur — les sorts de feu, de foudre et de soin partaient
// sans effet 3D (rapport d'enquête du 14/09, retour de jeu « effets 3D »).
// La clé vient désormais du MANIFESTE, et le fichier ne sert qu'à prouver que le
// client l'a. Même règle pour les props (3 écarts sur 580).
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");

/** Racine du contenu installé par Steam. Surchargeable : l'install peut bouger. */
const BASE = process.env.NANOS_CONTENT
  || "D:/steam/steamapps/common/nanos-world-playtest/NanosWorld/Content/NanosWorldAssets";

const CIBLE = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs";

/** Le manifeste du pack de base : clé -> chemin, la seule source des CLÉS. */
const MANIFESTE = process.env.NANOS_MANIFESTE
  || "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/game-mod/nanos-world-server-main/nanos-world-server-main/DefaultAssetPack.toml";
const CONTENU = path.dirname(BASE);

if (!fs.existsSync(MANIFESTE)) {
  console.error(`Manifeste du pack de base introuvable : ${MANIFESTE}`);
  process.exit(1);
}

/** Section -> [{ cle, chemin, fichier }] ; deux formes de valeur : chaîne, ou { path = … }. */
function lireManifeste() {
  const sections = {};
  let section = null;
  for (const ligne of fs.readFileSync(MANIFESTE, "utf8").split(/\r?\n/)) {
    const t = ligne.match(/^\s*\[([^\]]+)\]\s*$/);
    if (t) { section = t[1]; continue; }
    const m = ligne.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(?:"([^"]+)"|\{\s*path\s*=\s*"([^"]+)")/);
    if (!m || !section) continue;
    const chemin = m[2] || m[3];
    (sections[section] ??= []).push({ cle: m[1], chemin, fichier: chemin.split("/").pop() });
  }
  return sections;
}
const manifeste = lireManifeste();
/** Nom de fichier -> clé, pour une section. Premier gagnant, comme le manifeste. */
const cleParFichier = (section) => {
  const table = new Map();
  for (const e of manifeste[section] ?? []) if (!table.has(e.fichier)) table.set(e.fichier, e.cle);
  return table;
};

if (!fs.existsSync(BASE)) {
  console.error(`Contenu de base introuvable : ${BASE}`);
  console.error("Definir NANOS_CONTENT si l'install Steam est ailleurs.");
  process.exit(1);
}

// ── Collecte ──────────────────────────────────────────────────────────────────

/** Tous les `.uasset` sous BASE, avec leur dossier de premier niveau. */
const assets = [];
const parcourir = (d, racine) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { parcourir(p, racine ?? e.name); continue; }
    if (!e.name.endsWith(".uasset")) continue;
    assets.push({ nom: e.name.slice(0, -7), categorie: racine ?? "Racine" });
  }
};
parcourir(BASE, null);

/** `SM_Traffic_Cone_01` -> `Traffic Cone 01`. Un identifiant d'asset n'est pas
 *  un libellé : affiché tel quel dans un menu, il donne l'air d'un outil interne. */
function lisible(nom) {
  return nom
    .replace(/^(SM|P|NS)_/, "")
    .replace(/^ky_/, "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

// ── Particules ────────────────────────────────────────────────────────────────

/** Élément NARVOS -> particules du pack de base, par rôle dans la mise en scène.
 *
 *  ⚠ Ce n'est PAS de la décoration. `Spells.lua` porte un `element` pour chacun
 *  de ses 12 sorts, et sans cette table un sort de feu et un sort de foudre
 *  rendraient le même effet — le joueur ne verrait plus la différence entre ce
 *  qu'il lance et ce qu'il reçoit. */
const PAR_ELEMENT = {
  fire: { projectile: "P_ky_fireBall", impact: "P_ky_explosion", zone: "P_ky_fireStorm", aura: "P_Explosion_Fire_03" },
  electric: { projectile: "P_ky_thunderBall", impact: "P_ky_ThunderBallHit", zone: "P_ky_thunderStorm", aura: "P_ky_lightning2" },
  water: { projectile: "P_ky_waterBall", impact: "P_ky_waterBallHit", zone: "P_ky_aquaStorm", aura: "P_ky_magicCircle1" },
  ice: { projectile: "P_ky_waterBall", impact: "P_ky_waterBallHit", zone: "P_ky_aquaStorm", aura: "P_ky_magicCircle1" },
  earth: { projectile: "P_ky_hit1", impact: "P_ShockWave_03", zone: "P_ShockWave_09", aura: "P_ky_magicCircle1" },
  wind: { projectile: "P_ky_shootingStar1", impact: "P_ky_hit2", zone: "P_ky_storm", aura: "P_Streamer" },
  light: { projectile: "P_ky_shootingStar1", impact: "P_FlareShimmer_01", zone: "P_ky_healAura", aura: "P_ky_healAura" },
  dark: { projectile: "P_ky_laser01", impact: "P_ky_hit2", zone: "P_ky_darkStorm", aura: "P_ky_magicCircle1" },
  void: { projectile: "P_ky_laser01", impact: "P_Distortion_01", zone: "P_ky_darkStorm", aura: "P_Distortion_3D" },
  poison: { projectile: "P_ky_hit1", impact: "P_ky_hit2", zone: "P_Smoke_04", aura: "P_ky_magicCircle1" },
};

/** Familles de particules, pour le menu VFX et le débogage. */
const FAMILLES = [
  [/^P_ky_/, "magie"],
  [/^P_(Explosion_Fire|Explode|Explosive|RBExplode)/, "explosion"],
  [/^P_ShockWave/, "onde"],
  [/^P_Smoke/, "fumee"],
  [/^P_(Impact|Burst|HighImpact|Destruction)/, "impact"],
  [/^P_(Distortion|FlareShimmer|SparksFlair|Streamer|Jets|Leaders)/, "ambiance"],
  [/^NS_RocketExhaust/, "reacteur"],
];

// Les particules du MANIFESTE dont le fichier est présent chez le client. La
// famille se lit sur le NOM DE FICHIER (P_ky_* = magie), la clé sur le manifeste.
const clesParticules = cleParFichier("assets.particles");
const particules = (manifeste["assets.particles"] ?? [])
  .filter((e) => fs.existsSync(`${CONTENU}/${e.chemin}.uasset`))
  .filter((e, i, t) => t.findIndex((b) => b.cle === e.cle) === i)
  .map((e) => {
    const f = FAMILLES.find(([r]) => r.test(e.fichier));
    return { nom: e.cle, famille: f ? f[1] : "autre", label: lisible(e.fichier) };
  })
  .sort((a, b) => a.famille.localeCompare(b.famille) || a.nom.localeCompare(b.nom));

// `PAR_ELEMENT` est écrit en noms de FICHIER (lisibles, et c'est ce qu'on voit
// dans l'éditeur) : chacun est traduit en clé, et un nom sans clé ARRÊTE tout.
for (const [element, roles] of Object.entries(PAR_ELEMENT)) {
  for (const [role, fichier] of Object.entries(roles)) {
    const cle = clesParticules.get(fichier);
    if (!cle) {
      console.error(`ARRET : PAR_ELEMENT.${element}.${role} = ${fichier} n'a pas de cle dans le manifeste`);
      process.exit(1);
    }
    roles[role] = cle;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

/** Dossier du pack de base -> (identifiant, libellé français).
 *  Les dossiers absents de cette table sont ignorés : ce sont des bibliothèques
 *  de matériaux ou de logique, pas du décor plaçable. */
const CATEGORIES = {
  AncientTreasures: ["tresors", "Tresors anciens"],
  Appliances: ["electro", "Electromenager"],
  Cemetery: ["cimetiere", "Cimetiere"],
  Construction: ["chantier", "Chantier"],
  Food: ["nourriture", "Nourriture"],
  Funny: ["divers", "Divers"],
  Furniture: ["mobilier", "Mobilier"],
  Instruments: ["musique", "Instruments"],
  Particles: ["effets", "Supports d'effets"],
  Street: ["rue", "Mobilier urbain"],
  Tools: ["outils", "Outils"],
  Toys: ["jouets", "Jouets"],
  Vehicles: ["vehicules", "Vehicules"],
};

// Props : la clé du manifeste quand il connaît le fichier (3 écarts sur 580) ;
// sinon le nom de fichier, la convention qui tient pour les 577 autres. Le
// manifeste recopié date du 13/08 : 42 meshes installés depuis (AncientTreasures…)
// n'y figurent pas, et les retirer du menu supprimerait des props qui existent.
const clesMeshes = cleParFichier("assets.static_meshes");
let propsHorsManifeste = 0;
const props = assets
  .filter((a) => a.nom.startsWith("SM_") && CATEGORIES[a.categorie])
  .filter((a, i, t) => t.findIndex((b) => b.nom === a.nom) === i)
  .map((a) => {
    if (!clesMeshes.has(a.nom)) propsHorsManifeste++;
    return { nom: clesMeshes.get(a.nom) ?? a.nom, categorie: CATEGORIES[a.categorie][0], label: lisible(a.nom) };
  })
  .sort((a, b) => a.categorie.localeCompare(b.categorie) || a.label.localeCompare(b.label));

// ── Rendu ─────────────────────────────────────────────────────────────────────

function q(s) {
  return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

const ENTETE = (quoi) => [
  "-- Genere par scripts/narvos-nanos-base-to-lua.mjs depuis le contenu nanos",
  "-- installe. Ne pas editer a la main : regenerer apres toute mise a jour du",
  "-- client (Steam peut ajouter ou retirer des assets du pack de base).",
  "--",
  "-- " + quoi,
  "",
].join("\n");

const familles = [...new Set(particules.map((p) => p.famille))].sort();
const vfx = ENTETE(`Particules du pack de base : ${particules.length} effets, ${familles.length} familles.`) + [
  "local Vfx = {}",
  "",
  "--- Prefixe d'asset. Ces particules appartiennent au pack de base nanos, pas",
  "--- au notre : elles sont deja chez chaque joueur, rien a telecharger.",
  "Vfx.PACK = " + q("nanos-world"),
  "",
  "Vfx.FAMILLES = {",
  ...familles.map((f) => "    " + q(f) + ","),
  "}",
  "",
  "Vfx.EFFETS = {",
  ...particules.map((p) => `    { id = ${q(p.nom)}, famille = ${q(p.famille)}, label = ${q(p.label)} },`),
  "}",
  "",
  "--- Element de sort -> effets, par role dans la mise en scene.",
  "--- projectile = ce qui voyage · impact = ce qui touche · zone = l'aire",
  "--- d'effet · aura = ce qui reste sur le lanceur.",
  "Vfx.PAR_ELEMENT = {",
  ...Object.entries(PAR_ELEMENT).map(([el, r]) =>
    `    ${el} = { projectile = ${q(r.projectile)}, impact = ${q(r.impact)}, zone = ${q(r.zone)}, aura = ${q(r.aura)} },`),
  "}",
  "",
  "local par_id = {}",
  "for _, e in ipairs(Vfx.EFFETS) do par_id[e.id] = e end",
  "",
  "--- Effet par identifiant, ou nil.",
  "---@param id string",
  "---@return table|nil",
  "function Vfx.Trouver(id)",
  "    if (type(id) ~= " + q("string") + ") then return nil end",
  "    return par_id[id]",
  "end",
  "",
  "--- Chemin complet pour `Particle(...)`.",
  "--- Rend nil si l'effet est inconnu : mieux vaut ne rien jouer qu'appeler",
  "--- `Particle()` sur un asset absent, qui echoue en silence.",
  "---@param id string",
  "---@return string|nil",
  "function Vfx.Asset(id)",
  "    if (not Vfx.Trouver(id)) then return nil end",
  "    return Vfx.PACK .. " + q("::") + " .. id",
  "end",
  "",
  "--- Effets d'un element, avec repli sur `light`.",
  "--- Un element sans table dediee ne doit pas faire disparaitre le sort.",
  "---@param element string|nil",
  "---@return table",
  "function Vfx.PourElement(element)",
  "    return Vfx.PAR_ELEMENT[element or " + q("") + "] or Vfx.PAR_ELEMENT.light",
  "end",
  "",
  "--- Effets d'une famille.",
  "---@param famille string",
  "---@return table",
  "function Vfx.ParFamille(famille)",
  "    local sortie = {}",
  "    for _, e in ipairs(Vfx.EFFETS) do",
  "        if (e.famille == famille) then sortie[#sortie + 1] = e end",
  "    end",
  "    return sortie",
  "end",
  "",
  "return Vfx",
].join("\n") + "\n";

const cats = [...new Set(props.map((p) => p.categorie))].sort();
const labelCat = Object.fromEntries(Object.values(CATEGORIES));
const plua = ENTETE(`Props placables : ${props.length} static meshes, ${cats.length} categories.`) + [
  "local Props = {}",
  "",
  "Props.PACK = " + q("nanos-world"),
  "",
  "--- Categories, dans l'ordre d'affichage du menu.",
  "Props.CATEGORIES = {",
  ...cats.map((c) => `    { id = ${q(c)}, label = ${q(labelCat[c] ?? c)} },`),
  "}",
  "",
  "Props.PIECES = {",
  ...props.map((p) => `    { id = ${q(p.nom)}, categorie = ${q(p.categorie)}, label = ${q(p.label)} },`),
  "}",
  "",
  "local par_id = {}",
  "for _, p in ipairs(Props.PIECES) do par_id[p.id] = p end",
  "",
  "---@param id string",
  "---@return table|nil",
  "function Props.Trouver(id)",
  "    if (type(id) ~= " + q("string") + ") then return nil end",
  "    return par_id[id]",
  "end",
  "",
  "--- Chemin complet pour `Prop(...)` ou `StaticMesh(...)`.",
  "---@param id string",
  "---@return string|nil",
  "function Props.Asset(id)",
  "    if (not Props.Trouver(id)) then return nil end",
  "    return Props.PACK .. " + q("::") + " .. id",
  "end",
  "",
  "---@param categorie string",
  "---@return table",
  "function Props.ParCategorie(categorie)",
  "    local sortie = {}",
  "    for _, p in ipairs(Props.PIECES) do",
  "        if (p.categorie == categorie) then sortie[#sortie + 1] = p end",
  "    end",
  "    return sortie",
  "end",
  "",
  "--- Recherche par sous-chaine, insensible a la casse. Sert au champ de",
  "--- filtrage du menu : 450 props ne se parcourent pas a la molette.",
  "---@param texte string",
  "---@param maximum? integer",
  "---@return table",
  "function Props.Chercher(texte, maximum)",
  "    local sortie = {}",
  "    if (type(texte) ~= " + q("string") + " or texte == " + q("") + ") then return sortie end",
  "    local recherche = texte:lower()",
  "    local n = maximum or 60",
  "    for _, p in ipairs(Props.PIECES) do",
  "        if (p.label:lower():find(recherche, 1, true) or p.id:lower():find(recherche, 1, true)) then",
  "            sortie[#sortie + 1] = p",
  "            if (#sortie >= n) then break end",
  "        end",
  "    end",
  "    return sortie",
  "end",
  "",
  "return Props",
].join("\n") + "\n";

// ── Écriture ──────────────────────────────────────────────────────────────────

console.log(APPLY ? "=== APPLIQUE ===" : "=== SIMULATION (ajouter --apply) ===");
console.log("  source   : " + BASE);
console.log("  uassets  : " + assets.length);
console.log("  effets   : " + particules.length + "  (" + familles.join(", ") + ")");
console.log("  props    : " + props.length + "  (" + cats.length + " categories)");
for (const c of cats) {
  console.log("      " + c.padEnd(12) + props.filter((p) => p.categorie === c).length);
}

if (APPLY) {
  fs.writeFileSync(path.join(CIBLE, "Vfx.lua"), vfx, "utf8");
  fs.writeFileSync(path.join(CIBLE, "Props.lua"), plua, "utf8");
  console.log("\n  ecrit : Vfx.lua, Props.lua");
} else {
  console.log("\nRien ecrit.");
}