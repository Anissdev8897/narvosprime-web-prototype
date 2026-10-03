// ══════════════════════════════════════════════════════════════════════════════
// narvos-audit-packs.mjs — un pack est-il BRANCHÉ, ou seulement présent ?
//
//   node scripts/narvos-audit-packs.mjs [--detail <motif>]
//
// ── LA RÈGLE QUE CE SCRIPT APPLIQUE ──────────────────────────────────────────
// Posée par Hanibes le 2026-09-12 : « asset présent ≠ système branché ».
// On mesure donc CINQ étages, et seul le dernier vaut branchement :
//
//   1. SOURCE   le pack est sur le disque (asset_game / public/models)
//   2. ADK      il est importé dans le projet Unreal
//   3. CUIT     il est sorti du cook
//   4. DÉCLARÉ  ses clés sont dans Assets.toml — sinon le Lua ne peut pas le nommer
//   5. APPELÉ   une de ses clés est citée par notre code Lua
//
// Un pack qui s'arrête à 4 est livré au client (il pèse dans le téléchargement)
// et ne sert à rien. Un pack qui s'arrête à 2 n'est même pas dans le jeu.
//
// ⚠ CE QUE « APPELÉ » NE PROUVE PAS : qu'on l'ait vu tourner. C'est une citation
// dans le code, pas une capture d'écran. Le dernier mot reste le jeu.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = "E:/narvosprime-web-prototype";
const SOURCES = `${RACINE}/WebPortal/public/asset_game`;
const ADK = `${RACINE}/WebPortal/Server/adk/Content`;
const CUIT = `${RACINE}/WebPortal/Server/adk/Saved/Cooked/Windows/NanosWorldADK/Content`;
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;
const PAQUETS = `${RACINE}/WebPortal/Server/nanos_world/packages`;

/** Les packs demandés, avec ce qui permet de les reconnaître.
 *  `source` : chemin sous asset_game. `motifs` : fragments cherchés dans les noms
 *  de dossiers Unreal, les chemins d'Assets.toml et le code. */
const PACKS = [
  { nom: "Farming And Mining Pack", source: "mixte_epoques/Farming And Mining Pack", motifs: ["Farming", "Mining"] },
  { nom: "Crystals and Crafting Environment", source: "mixte_epoques/Crystals and Crafting Environment", motifs: ["Crystal"] },
  { nom: "Survival Crafting Stations", source: "mixte_epoques/Survival Crafting Stations", motifs: ["SurvivalCrafting", "Crafting_Station", "CraftingStation"] },
  { nom: "Hyper Skill Level Manager v2", source: "systemes_sans_epoque/Hyper Skill Level Manager v2 UE51 - 5.4", motifs: ["Hyper"] },
  { nom: "AI Behavior System", source: "systemes_sans_epoque/AI Behavior System - Unreal Engine", motifs: ["AIBehavior", "AI_Behavior"] },
  { nom: "AIBehaviorToolkit UE5.6", source: "systemes_sans_epoque/AIBehaviorToolkitUE56_v1.9.6", motifs: ["AIBehaviorToolkit", "BehaviorToolkit"] },
  { nom: "AdvancedGASSystem UE5.6", source: "systemes_sans_epoque/AdvancedGASSystemUE56_v1.0", motifs: ["AdvancedGAS", "GASSystem"] },
  { nom: "Enhanced AI Movement", source: "systemes_sans_epoque/Enhanced_AI_Movement_-_Unreal_Engine", motifs: ["EnhancedAI", "Enhanced_AI"] },
  { nom: "Survival Crafting System", source: "systemes_sans_epoque/Survival Crafting System", motifs: ["SurvivalCraftingSystem", "SurvivalSystem"] },
  { nom: "Ako Minimap System", source: "systemes_sans_epoque/Ako_Minimap_System", motifs: ["Ako", "Minimap", "MiniMap"] },
  { nom: "Modern Tanks and Vehicles (3D print)", source: "sources_dcc/Modern Tanks and Vehicles - 3D Print Model", motifs: ["ModernTank", "Tanks"] },
  { nom: "Security Camera Vol 01", source: "sources_dcc/Security Camera Vol 01", motifs: ["SecurityCamera", "Security_Camera"] },
  { nom: "SciFi Plantation Lab", source: "sources_dcc/IM00082113-01_ScifiPlantationLab", motifs: ["Plantation", "PlantationLab"] },
  { nom: "Brendonrise 89 — Sci-Fi Props", source: "sources_dcc/Brendonrise 89 - Sci-Fi Props", motifs: ["Brendonrise"] },
  { nom: "20x Vehicles 3D Models Pack 2", source: "sources_dcc/20x Vehicles 3D Models Pack 2", motifs: ["20x", "VehiclesPack"] },
  { nom: "Quarantine Medical Tent", source: "asset_epoque_moderne/Quarantine Medical Tent", motifs: ["Quarantine", "MedicalTent"] },
  { nom: "Ridable Motor Bikes", source: "asset_epoque_moderne/RidableMotorBikesMultipla", motifs: ["Ridable", "MotorBike", "Bike"] },
  { nom: "Ridable Motor Bikes — Advanced Pack 3", source: "asset_epoque_moderne/Ridable_MotorBikes_Multiplayer_Advanced_Pack_3", motifs: ["Ridable", "MotorBike"] },
  { nom: "Freeflow Combat v2.6", source: "asset_epoque_moderne/Freeflow Combat v2.6 UE4.26-5.6", motifs: ["Freeflow"] },
  { nom: "Drivable Cars — Basic Vehicle System", source: "asset_epoque_moderne/Drivable Cars - Basic Vehicle System - Unreal Engine", motifs: ["DrivableCars", "BasicVehicle", "Drivable"] },
  { nom: "SmartLocomotion UE5.2", source: "animations_neutres/SmartLocomotionUE52", motifs: ["SmartLocomotion"] },
  { nom: "Procedural Weapon Animation System", source: "animations_neutres/Procedural Weapon Animation System UE5.1__5.7", motifs: ["ProceduralWeapon"] },
  { nom: "Crafting Animations", source: "animations_neutres/Crafting_Animations", motifs: ["Crafting_Anim", "CraftingAnim"] },

  // -- Ajoutes le 2026-09-12, a la demande de Hanibes --------------------------
  { nom: "Hyper Inventory/Crafting/Hotbar V2", source: "mixte_epoques/Hyper Inventory, Crafting, Hotbar, Lootchest & Vendor System V2", motifs: ["HyperInventory", "Hyper_Inventory", "HyperCrafting", "Hotbar", "Lootchest"] },
  { nom: "Hyper Slot Based Inventory V3", source: "systemes_sans_epoque/Hyper_Slot_Based_Inventory_V3_-_Unreal_Engine", motifs: ["SlotBased", "HyperSlot"] },
  { nom: "InventorySystemPro (Moonville)", source: "asset_epoque_moderne/InventorySystemProbyMoonvilleUE54", motifs: ["InventorySystemPro", "Moonville", "ISP_"] },
  { nom: "CityTrafficPro UE5.6", source: "asset_epoque_moderne/CityTrafficProUE56", motifs: ["CityTraffic", "City_Traffic"] },
  { nom: "Multiplayer Handcuffs System", source: "asset_epoque_moderne/MultiplayerHandcuffsSyste", motifs: ["Handcuff", "Handcuffs"] },
];

const detail = process.argv.includes("--detail")
  ? process.argv[process.argv.indexOf("--detail") + 1]
  : null;

// ── Outils de parcours ───────────────────────────────────────────────────────

function compter(dossier, extension) {
  if (!fs.existsSync(dossier)) return 0;
  let n = 0;
  const pile = [dossier];
  while (pile.length) {
    const d = pile.pop();
    let entrees;
    try { entrees = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entrees) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) pile.push(p);
      else if (!extension || e.name.toLowerCase().endsWith(extension)) n++;
    }
  }
  return n;
}

/** Dossiers de premier et second niveau, pour reconnaître un pack par son nom. */
function dossiers(racine) {
  const sortie = [];
  if (!fs.existsSync(racine)) return sortie;
  for (const e of fs.readdirSync(racine, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    sortie.push({ nom: e.name, chemin: path.join(racine, e.name) });
    const sous = path.join(racine, e.name);
    if (e.name === "Narvos") {
      for (const s of fs.readdirSync(sous, { withFileTypes: true })) {
        if (s.isDirectory()) sortie.push({ nom: s.name, chemin: path.join(sous, s.name) });
      }
    }
  }
  return sortie;
}

const correspond = (nom, motifs) =>
  motifs.some((m) => nom.toLowerCase().includes(m.toLowerCase()));

// ── Les clés déclarées, par chemin ───────────────────────────────────────────

const declares = [];
{
  let section = "";
  for (const ligne of fs.readFileSync(TOML, "utf8").split(/\r?\n/)) {
    const s = ligne.match(/^\s*\[([^\]]+)\]\s*$/);
    if (s) { section = s[1]; continue; }
    const m = ligne.match(/^\s*(?:"((?:[^"\\]|\\.)*)"|([A-Za-z0-9_-]+))\s*=\s*"([^"]+)"/);
    if (!m) continue;
    const cle = m[1] !== undefined ? JSON.parse(`"${m[1]}"`) : m[2];
    declares.push({ cle, chemin: m[3], section });
  }
}

// ── Le corpus Lua, lu une fois ───────────────────────────────────────────────

let corpus = "";      // tout le code Lua et JS
let catalogues = "";  // les seuls Catalogs/ generes : une cle y figure = le
                      // runtime peut la nommer en fabriquant "narvos::" .. cle
{
  const pile = [PAQUETS];
  while (pile.length) {
    const d = pile.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) pile.push(p);
      else if (e.name.endsWith(".lua") || e.name.endsWith(".js")) {
        const t = fs.readFileSync(p, "utf8");
        corpus += t;
        if (p.split(String.fromCharCode(92)).join("/").includes("/Shared/Catalogs/")) catalogues += t;
      }
    }
  }
}

// ── La mesure ────────────────────────────────────────────────────────────────

const dossiersAdk = dossiers(ADK);
const dossiersCuit = dossiers(CUIT);

const lignes = [];
for (const pack of PACKS) {
  const src = `${SOURCES}/${pack.source}`;
  const source = fs.existsSync(src) ? compter(src, null) : 0;

  const adk = dossiersAdk.filter((d) => correspond(d.nom, pack.motifs));
  const nbAdk = adk.reduce((t, d) => t + compter(d.chemin, ".uasset"), 0);

  const cuit = dossiersCuit.filter((d) => correspond(d.nom, pack.motifs));
  const nbCuit = cuit.reduce((t, d) => t + compter(d.chemin, ".uasset"), 0);

  // ── DÉCLARÉ : les clés qui vivent SOUS les dossiers réels du pack ───────────
  //
  // ⚠ PAS un simple motif sur le chemin. Première version du 2026-09-12 : le
  // motif « Crystal » comptait `crystal_foot1`, `crystal_run2`… — les SONS DE PAS
  // du jeu, qui n'ont rien à voir avec le pack « Crystals and Crafting
  // Environment ». Et « 20x Vehicles » sortait 455 clés déclarées alors qu'il
  // n'est ni importé ni cuit : un pack absent du projet ne PEUT pas avoir de clé.
  //
  // La règle refermée : les clés se cherchent sous le PRÉFIXE du dossier trouvé
  // dans l'ADK ou dans le cook, jamais sur une ressemblance de nom.
  const prefixes = [...adk, ...cuit].map((d) => {
    const rel = d.chemin.split(String.fromCharCode(92)).join("/").split("/Content/")[1];
    return rel ? rel + "/" : null;
  }).filter(Boolean);
  const cles = prefixes.length === 0
    ? []
    : declares.filter((d) => prefixes.some((pre) => d.chemin.startsWith(pre)));

  // APPELÉ : une clé déclarée de ce pack est-elle citée par le code ?
  //
  // ⚠ SEULE LA FORME `narvos::cle` COMPTE. Une chaîne nue peut être n'importe
  // quoi — un identifiant de recette, un libellé, un nom d'animation homonyme.
  const citees = [];
  const auCatalogue = [];
  for (const { cle } of cles) {
    if (corpus.includes(`narvos::${cle}`)) citees.push(cle);
    else if (catalogues.includes(`"${cle}"`)) auCatalogue.push(cle);
  }

  lignes.push({
    nom: pack.nom,
    source,
    adk: nbAdk,
    adkDossiers: adk.map((d) => d.nom),
    cuit: nbCuit,
    declare: cles.length,
    appele: citees.length,
    catalogue: auCatalogue.length,
    exemples: (citees.length ? citees : auCatalogue).slice(0, 3),
  });

  if (detail && pack.nom.toLowerCase().includes(detail.toLowerCase())) {
    console.log(`\n── ${pack.nom} ──`);
    console.log(`  dossiers ADK  : ${adk.map((d) => d.nom).join(", ") || "aucun"}`);
    console.log(`  dossiers cuits: ${cuit.map((d) => d.nom).join(", ") || "aucun"}`);
    console.log(`  clés déclarées: ${cles.length}`);
    console.log(`  clés citées   : ${citees.length}`);
    for (const c of citees.slice(0, 30)) console.log(`      ${c}`);
  }
}

// ── Sortie ───────────────────────────────────────────────────────────────────

const etat = (l) => {
  if (l.appele > 0) return "APPELE (narvos::)";
  if (l.catalogue > 0) return "AU CATALOGUE (nommable)";
  if (l.declare > 0) return "declare, jamais cite";
  if (l.cuit > 0) return "cuit, non declare";
  if (l.adk > 0) return "importe, non cuit";
  if (l.source > 0) return "source seulement";
  return "ABSENT";
};

console.log("");
console.log("pack".padEnd(40) + "source".padStart(8) + "ADK".padStart(8)
  + "cuit".padStart(8) + "declare".padStart(9) + "cite".padStart(6) + "catal.".padStart(8) + "   etat");
console.log("-".repeat(100));
for (const l of lignes) {
  console.log(
    l.nom.slice(0, 39).padEnd(40)
    + String(l.source).padStart(8)
    + String(l.adk).padStart(8)
    + String(l.cuit).padStart(8)
    + String(l.declare).padStart(9)
    + String(l.appele).padStart(6)
    + String(l.catalogue).padStart(8)
    + "   " + etat(l)
    + (l.exemples.length ? "  (" + l.exemples.join(", ") + ")" : ""),
  );
}

const par = {};
for (const l of lignes) par[etat(l)] = (par[etat(l)] ?? 0) + 1;
console.log("");
for (const [e, n] of Object.entries(par).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(2)}  ${e}`);
}