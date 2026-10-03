// ══════════════════════════════════════════════════════════════════════════════
// narvos-icones-ui.mjs — le jeu d'icônes vectorielles des pages WebUI nanos.
//
//   node scripts/narvos-icones-ui.mjs            # simulation
//   node scripts/narvos-icones-ui.mjs --apply    # écrit Client/UI/icones.js
//
// ── POURQUOI (2026-09-14) ─────────────────────────────────────────────────────
// Retour de Hanibes sur le menu Compétences : « améliore les icônes, mets des
// icônes qui ne font pas IA ». Les branches de talents portaient des EMOJI
// (⚔️ 🛡️ 💨 🔮) venus du catalogue web, et les métiers aussi : un rendu qui
// dépend de la police du système, des couleurs imposées, et l'aspect « généré ».
//
// ── LA SOURCE ─────────────────────────────────────────────────────────────────
// Lucide (licence ISC), DÉJÀ présent dans WebPortal/node_modules (lucide-react,
// employé par le prototype web). Rien n'est téléchargé : on lit la définition de
// chaque icône (`__iconNode`) dans le paquet installé et on l'écrit en SVG. Un
// seul trait (2 px sur 24), une seule grille : un jeu cohérent, là où des emoji
// de trois origines ne le sont jamais.
//
// La page ne charge AUCUN fichier SVG externe : `<use href="x.svg#id">` est
// refusé par Chromium sous file:// (origine opaque). Les tracés vivent dans un
// script, et `Icone(nom)` fabrique l'élément.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const WEB = "E:/narvosprime-web-prototype/WebPortal";
const LUCIDE = `${WEB}/node_modules/lucide-react`;
const SORTIE = `${WEB}/Server/nanos_world/packages/narvos-map-proto/Client/UI/icones.js`;
const APPLY = process.argv.includes("--apply");

/** Nom de page -> icône Lucide. Les noms de page sont ceux que lisent les scripts. */
const JEU = {
  // Branches de talents (BRANCH_META de talentCatalog.ts)
  branche_damage: "swords",
  branche_survival: "shield-half",
  branche_mobility: "footprints",
  branche_mana: "sparkles",
  // Effets de talent (champs de TalentEffect)
  effet_damagePct: "flame",
  effet_critFlat: "crosshair",
  effet_maxHpPct: "heart-pulse",
  effet_defenseFlat: "shield",
  effet_maxManaPct: "droplets",
  effet_manaCostReductionPct: "badge-percent",
  effet_manaRegenPct: "refresh-cw",
  effet_moveSpeedPct: "gauge",
  // Statistiques de la fiche
  stat_vie: "heart",
  stat_mana: "droplet",
  stat_puissance: "swords",
  stat_defense: "shield",
  stat_critique: "crosshair",
  stat_vitesse: "gauge",
  stat_pouvoirs: "wand-sparkles",
  // Métiers (PROFESSIONS de professionCatalog.ts)
  metier_bucheron: "axe",
  metier_mineur: "pickaxe",
  metier_recolteur: "sprout",
  metier_forgeron: "anvil",
  metier_alchimiste: "flask-conical",
  metier_joaillier: "gem",
  // Gestes et états
  investir: "plus",
  rembourser: "minus",
  reinitialiser: "rotate-ccw",
  verrou: "lock",
  niveau: "star",
  talent: "orbit",
  recharge: "activity",
  portee: "target",
};

const ATTRIBUTS_AUTORISES = new Set(["d", "points", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height"]);
const echapper = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const traces = {};
const absentes = [];
for (const [nom, lucide] of Object.entries(JEU)) {
  const fichier = path.join(LUCIDE, "dist", "esm", "icons", `${lucide}.js`);
  if (!fs.existsSync(fichier)) { absentes.push(`${nom} -> ${lucide}`); continue; }
  const { __iconNode } = await import(pathToFileURL(fichier).href);
  traces[nom] = __iconNode.map(([balise, attrs]) => {
    const a = Object.entries(attrs)
      .filter(([k]) => ATTRIBUTS_AUTORISES.has(k))
      .map(([k, v]) => `${k}="${echapper(v)}"`).join(" ");
    return `<${balise} ${a}/>`;
  }).join("");
}

if (absentes.length > 0) {
  console.error(`ARRET : ${absentes.length} icône(s) introuvable(s) dans lucide-react :\n  ${absentes.join("\n  ")}`);
  process.exit(1);
}

const version = JSON.parse(fs.readFileSync(`${LUCIDE}/package.json`, "utf8")).version;
const licence = fs.readFileSync(`${LUCIDE}/LICENSE`, "utf8").split("\n").slice(0, 3).join("\n// ");

const contenu = `// ══════════════════════════════════════════════════════════════════════════════
// icones.js — GÉNÉRÉ par scripts/narvos-icones-ui.mjs. Ne pas éditer à la main.
//
// Tracés Lucide ${version} (lucide-react, WebPortal/node_modules) :
// ${licence}
// Licence ISC complète : WebPortal/node_modules/lucide-react/LICENSE
// ══════════════════════════════════════════════════════════════════════════════

const ICONES = ${JSON.stringify(traces, null, "\t")};

/** Élément <svg> d'une icône du jeu, ou null si le nom est inconnu.
 *  Trait en \`currentColor\` : la couleur vient du CSS de l'endroit où on la pose. */
function Icone(nom, classe) {
	const traces = ICONES[nom];
	if (!traces) return null;
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", "2");
	svg.setAttribute("stroke-linecap", "round");
	svg.setAttribute("stroke-linejoin", "round");
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute("class", classe ? \`ico \${classe}\` : "ico");
	svg.innerHTML = traces;
	return svg;
}
`;

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`  ${Object.keys(traces).length} icône(s) Lucide ${version}`);
if (APPLY) {
  fs.writeFileSync(SORTIE, contenu, "utf8");
  console.log(`  écrit : ${SORTIE}`);
} else {
  console.log("  Rien écrit.");
}