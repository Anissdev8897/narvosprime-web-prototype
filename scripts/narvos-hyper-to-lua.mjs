// ══════════════════════════════════════════════════════════════════════════════
// narvos-hyper-to-lua.mjs — les DONNEES de Hyper Inventory V2 vers NOS catalogues.
//
//   node scripts/narvos-hyper-to-lua.mjs [--apply]
//
// Produit `Shared/Catalogs/ObjetsHyper.lua` : des objets au format de
// `Items.ITEM_DB` et des recettes au format de `Recettes.RECETTES`.
//
// ── POURQUOI CE PACK ENTRE PAR SES DONNEES ET PAS PAR SES BLUEPRINTS ─────────
// Hyper Inventory V2 est un systeme Blueprint complet — composant d'inventaire,
// file de craft, marchands, UMG — concu pour un serveur UNREAL. Le serveur nanos
// est Lua : notre inventaire (grille persistee), notre craft (`Logic/Craft.lua`,
// 4 stations), notre ramassage et notre WebUI existent deja. Porter ses Blueprints
// aurait cree un SECOND inventaire concurrent — ce que Hanibes a interdit :
// « ne recree pas inutilement des systemes deja existants ».
//
// Ce qui s'integre, ce sont ses DONNEES : 251 objets, 148 recettes, avec leurs
// meshes et icones. Elles sortent de l'editeur par
// `scripts/adk-exporter-datatables.py` (colonne par colonne — l'export JSON
// d'Unreal tue le processus sur certaines structures 5.1).
//
// ── ⚠ AUCUNE REFERENCE MORTE ────────────────────────────────────────────────
// `mesh` et `icone` ne sont ecrits QUE si leur cle existe dans Assets.toml. Tant
// que le ResourcePack n'est pas promu sous Narvos/ et cuit, les objets sortent
// sans eux : utilisables dans le sac et le craft, pas encore ramassables au sol.
// Ils le deviendront SEULS apres le cook, en relancant ce script.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { lireUnreal, nomAsset, cheminPaquet, champNu, vrai, nombre } from "./lib/unreal-texte.mjs";

const RACINE = "E:/narvosprime-web-prototype";
const TABLES = `${RACINE}/WebPortal/Server/adk/_datatables`;
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;
const SORTIE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/ObjetsHyper.lua`;
const APPLY = process.argv.includes("--apply");
const ICONES_WEB = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/UI/img/items`;

// ── Entrees ──────────────────────────────────────────────────────────────────

const lire = (nom) => {
  const f = path.join(TABLES, `${nom}.json`);
  if (!fs.existsSync(f)) {
    console.error(`ARRET : ${f} absent — lancer d'abord scripts/adk-exporter-datatables.py`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(f, "utf8"));
};
const items = lire("DT_Items");
if (!Array.isArray(items) || items.length === 0) {
  // Un export VIDE n'est pas un pack sans objets : sa structure ne s'est pas
  // chargee. Generer un catalogue vide effacerait l'ancien sans un mot.
  console.error("ARRET : DT_Items est vide — l'export a echoue, rien n'est ecrit.");
  process.exit(1);
}

/** Cles declarees dans notre pack cuit : nom -> CHEMIN dans le pack.
 *
 *  ⚠ LE CHEMIN, PAS SEULEMENT LE NOM. Premiere generation, 2026-09-12 : « 4
 *  meshes cuits » alors que rien de Hyper ne l'etait. C'etaient des HOMONYMES
 *  d'autres packs — `SM_Pipe` pointait un tuyau de la discotheque du CITY_PACK,
 *  `SM_Grenade` la grenade de Defender. Un objet Hyper aurait porte le mesh d'un
 *  autre pack, sans une erreur. On juge sur la nature, jamais sur le nom. */
const clesPack = new Map();
if (fs.existsSync(TOML)) {
  for (const ligne of fs.readFileSync(TOML, "utf8").split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"/);
    if (m) clesPack.set(m[1], m[2]);
  }
}

/** La cle nanos d'un asset Hyper, SEULEMENT si elle designe ce paquet-la une
 *  fois promu sous Narvos/ : `/Game/Hyper/X/SM_Y` doit etre `Narvos/Hyper/X/SM_Y`. */
const cleSiPromu = (reference) => {
  const nom = nomAsset(reference);
  const paquet = cheminPaquet(reference);
  if (!nom || !paquet) return null;
  const attendu = "Narvos/" + paquet.slice("/Game/".length);
  return clesPack.get(nom) === attendu ? `narvos::${nom}` : null;
};

const champ = (ligne, nom) => {
  const brut = Object.entries(ligne).find(([k]) => champNu(k) === nom)?.[1];
  try { return lireUnreal(brut) || {}; } catch { return {}; }
};

// ── Regles de correspondance ─────────────────────────────────────────────────

/** Categorie Hyper (la premiere de la liste) -> notre `type`. Les categories
 *  absentes de cette table sont ECARTEES, avec leur motif. */
const TYPE_PAR_CATEGORIE = {
  "Resource": "material",
  "Ingredient": "material",
  "Plants and Flowers": "material",
  "Farming": "material",
  "Misc": "material",
  "Weapon": "weapon",
  "Tool": "tool",
  "Equipment": "armor",
  "Consumeable": "consumable",   // sic : l'orthographe du pack
  "Ammunition": "ammo",
  "Quest Item": "quest",
};
const MOTIF_ECART = {
  "Structure": "systeme de CONSTRUCTION absent chez nous (DT_Buildables tue l'export)",
  "Recipe": "apprentissage de recettes absent chez nous",
  "Book": "apprentissage de recettes absent chez nous",
};

/** Lieu de craft Hyper -> notre station. `null` = a la main. Absent = recette
 *  ECARTEE : la coller a une station sans rapport ferait cuire de la viande
 *  a la forge. */
const STATION_PAR_LIEU = {
  "Forge": "forge",
  "Smelter": "forge",            // fonderie de minerai : la forge est la plus proche
  "Workbench": "workbench",
  "Tanning Rack": "workbench",   // tannerie : artisanat
  "Alchemy Lab": "alchemy",
  "Mortar and Pestle": "alchemy",
  "Player": null,                // a la main, sans station
};

/** Encombrement dans la grille par type — un CHOIX de gameplay, le pack n'a pas
 *  de grille (inventaire a cases). */
const TAILLE = {
  material: [1, 1], consumable: [1, 1], ammo: [1, 1], quest: [1, 1],
  tool: [1, 3], weapon: [1, 3], armor: [2, 2],
};

const idDe = (nomLigne) => "hyper_" + String(nomLigne).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// ── Objets ───────────────────────────────────────────────────────────────────

const objets = [];
const ecartesObjets = {};
const recettesBrutes = [];

for (const ligne of items) {
  const nom = ligne.Name;
  if (!nom || nom === "Empty") continue;

  const g = champ(ligne, "GenericAttributes");
  const categories = Array.isArray(g.Categories) ? g.Categories : [];
  const categorie = categories[0] || "Misc";
  const type = TYPE_PAR_CATEGORIE[categorie];
  if (!type) {
    const motif = MOTIF_ECART[categorie] || `categorie « ${categorie} » sans type chez nous`;
    (ecartesObjets[motif] ??= []).push(nom);
    continue;
  }

  const st = champ(ligne, "StackableAttributes");
  const vente = champ(ligne, "Sellable_Attributes");
  const empilable = vrai(st.Stackable);
  const [w, h] = TAILLE[type] || [1, 1];

  const mesh = nomAsset(g.Mesh);
  const icone = nomAsset(g.Icon);

  objets.push({
    id: idDe(nom),
    source: nom,
    label: g["Item Name"] || nom,
    description: g.Description || "",
    type,
    categories,
    rarity: "common",
    gridW: w,
    gridH: h,
    stackable: empilable,
    maxStack: empilable ? Math.max(1, Math.round(nombre(st["Max stack size"], 1))) : 1,
    equipSlot: (type === "weapon" || type === "tool") ? "weapon" : (type === "armor" ? "armor" : null),
    poids: nombre(g.Weight, 0),
    prix: vrai(vente["Is Sellable"]) ? Math.round(nombre(vente["Base Sell Price"]?.Amount, 0)) : 0,
    // ⚠ Seulement si la cle existe dans le pack cuit. Voir l'en-tete.
    mesh: cleSiPromu(g.Mesh),
    icone: cleSiPromu(g.Icon),
    // L'icone de la WebUI : `img/items/<iconFile>.webp`, convention deja servie
    // par `RoueIcone`. Ecrite SEULEMENT si le fichier existe — la page a un repli
    // emoji, mais une reference vers un fichier absent ferait une requete perdue
    // par objet a chaque ouverture du sac.
    iconFile: icone && fs.existsSync(`${ICONES_WEB}/${icone}.webp`) ? icone : null,
    mesh_source: mesh,
    icone_source: icone,
  });

  const c = champ(ligne, "CraftingAttributes");
  if (vrai(c["Is Craftable"])) {
    recettesBrutes.push({ nom, c });
  }
}

const idsObjets = new Set(objets.map((o) => o.id));

// ── Recettes ─────────────────────────────────────────────────────────────────

const recettes = [];
const ecartesRecettes = {};

for (const { nom, c } of recettesBrutes) {
  const lieux = Array.isArray(c["Crafting Locations"]) ? c["Crafting Locations"] : [];
  // Le premier lieu que nous savons servir. Un objet fabricable « a la forge OU
  // a l'etabli » prend la premiere station connue, pas la derniere.
  const lieu = lieux.find((l) => Object.prototype.hasOwnProperty.call(STATION_PAR_LIEU, l));
  if (lieu === undefined) {
    (ecartesRecettes[`aucune station pour : ${lieux.join(", ") || "(aucun lieu)"}`] ??= []).push(nom);
    continue;
  }

  const sortie = idDe(nom);
  if (!idsObjets.has(sortie)) {
    (ecartesRecettes["l'objet produit a lui-meme ete ecarte"] ??= []).push(nom);
    continue;
  }

  const entrees = [];
  let entreeMorte = null;
  for (const e of Array.isArray(c.Recipe) ? c.Recipe : []) {
    const rn = e?.Item?.RowName;
    if (!rn) continue;
    const id = idDe(rn);
    if (!idsObjets.has(id)) { entreeMorte = rn; break; }
    entrees.push({ item_id: id, quantite: Math.max(1, Math.round(nombre(e.Amount, 1))) });
  }
  if (entreeMorte) {
    (ecartesRecettes[`ingredient ecarte ou inconnu : ${entreeMorte}`] ??= []).push(nom);
    continue;
  }
  if (entrees.length === 0) {
    (ecartesRecettes["recette sans ingredient"] ??= []).push(nom);
    continue;
  }

  recettes.push({
    id: `craft_${sortie}`,
    label: objets.find((o) => o.id === sortie).label,
    sortie: { item_id: sortie, quantite: Math.max(1, Math.round(nombre(c["Output Amount"], 1))) },
    entrees,
    station: STATION_PAR_LIEU[lieu],
    palier: 0,
    duree_ms: Math.round(nombre(c["Required Crafting Time"], 5) * 1000),
  });
}

// ── Sortie Lua ───────────────────────────────────────────────────────────────

const q = (v) => (v === null || v === undefined) ? "nil" : JSON.stringify(String(v));
const liste = (arr) => `{ ${arr.map(q).join(", ")} }`;

const avecMesh = objets.filter((o) => o.mesh).length;
const avecIcone = objets.filter((o) => o.icone).length;
const totalEcartesObj = Object.values(ecartesObjets).reduce((n, a) => n + a.length, 0);
const totalEcartesRec = Object.values(ecartesRecettes).reduce((n, a) => n + a.length, 0);

const lignesObjets = objets.sort((a, b) => a.id.localeCompare(b.id)).map((o) => [
  `    ${o.id} = {`,
  `        id = ${q(o.id)}, source = ${q(o.source)},`,
  `        label = ${q(o.label)}, type = ${q(o.type)}, rarity = ${q(o.rarity)},`,
  `        description = ${q(o.description)},`,
  `        categories = ${liste(o.categories)},`,
  `        gridW = ${o.gridW}, gridH = ${o.gridH},`,
  `        stackable = ${o.stackable}, maxStack = ${o.maxStack},`,
  o.equipSlot ? `        equipSlot = ${q(o.equipSlot)},` : null,
  `        poids = ${o.poids}, prix = ${o.prix},`,
  o.mesh ? `        mesh = ${q(o.mesh)},` : null,
  o.icone ? `        icone = ${q(o.icone)},` : null,
  o.iconFile ? `        iconFile = ${q(o.iconFile)},` : null,
  `    },`,
].filter(Boolean).join("\n"));

const lignesRecettes = recettes.sort((a, b) => a.id.localeCompare(b.id)).map((r) => [
  `    ${r.id} = {`,
  `        id = ${q(r.id)}, label = ${q(r.label)},`,
  `        sortie = { item_id = ${q(r.sortie.item_id)}, quantite = ${r.sortie.quantite} },`,
  `        entrees = {`,
  ...r.entrees.map((e) => `            { item_id = ${q(e.item_id)}, quantite = ${e.quantite} },`),
  `        },`,
  `        station = ${q(r.station)}, palier = ${r.palier}, duree_ms = ${r.duree_ms},`,
  `    },`,
].join("\n"));

const commentaireEcarts = (table) => Object.entries(table)
  .sort((a, b) => b[1].length - a[1].length)
  .map(([motif, noms]) => `--   ${String(noms.length).padStart(3)}  ${motif}`)
  .join("\n");

const lua = `-- ══════════════════════════════════════════════════════════════════════════════
-- ObjetsHyper.lua — les donnees de Hyper Inventory V2, au format de NOS catalogues.
--
-- FICHIER GENERE par scripts/narvos-hyper-to-lua.mjs — ne pas editer a la main.
-- Source : WebPortal/Server/adk/_datatables/DT_Items.json (export de l'editeur).
--
-- ${objets.length} objet(s), ${recettes.length} recette(s).
-- ${avecMesh} objet(s) avec leur mesh cuit, ${avecIcone} avec leur icone cuite.
--
-- Objets ECARTES (${totalEcartesObj}) :
${commentaireEcarts(ecartesObjets) || "--   aucun"}
--
-- Recettes ECARTEES (${totalEcartesRec}) :
${commentaireEcarts(ecartesRecettes) || "--   aucune"}
--
-- Branche par Logic/ObjetsHyper.lua, qui AJOUTE ces entrees a Items.ITEM_DB et
-- Recettes.RECETTES sans jamais ecraser une entree existante.
-- ══════════════════════════════════════════════════════════════════════════════

local ObjetsHyper = {}

ObjetsHyper.OBJETS = {
${lignesObjets.join("\n")}
}

ObjetsHyper.RECETTES = {
${lignesRecettes.join("\n")}
}

--- Ordre d'affichage des recettes : \`pairs\` n'a aucun ordre garanti.
ObjetsHyper.ORDRE_RECETTES = ${liste(recettes.map((r) => r.id))}

return ObjetsHyper
`;

// ── LE MANIFESTE DE PROMOTION ────────────────────────────────────────────────
// Les paquets que les objets RETENUS referencent — meshes et icones. C'est la
// racine de ce qui doit sortir du cook, et RIEN d'autre : le pack pese 10 Go, ses
// objets retenus en utilisent une fraction. `scripts/adk-copier-hyper.mjs` en
// calcule la fermeture de dependances puis COPIE (jamais ne deplace : `Hyper/`
// est une jonction vers le pack d'origine).
const racines = new Set();
for (const ligne of items) {
  if (!ligne.Name || ligne.Name === "Empty") continue;
  if (!objets.some((o) => o.source === ligne.Name)) continue;
  const g = champ(ligne, "GenericAttributes");
  for (const ref of [g.Mesh, g.Icon]) {
    const p = cheminPaquet(ref);
    if (p && p.startsWith("/Game/Hyper/")) racines.add(p);
  }
}
const MANIFESTE = `${RACINE}/WebPortal/Server/adk/_manifests/hyper-promotion.json`;
if (APPLY) {
  fs.writeFileSync(MANIFESTE, JSON.stringify({
    genere: new Date().toISOString(),
    objets_retenus: objets.length,
    racines: [...racines].sort(),
  }, null, 1), "utf8");
}

console.log(`Hyper Inventory V2 -> nos catalogues`);
console.log(`  racines a promouvoir : ${racines.size} paquet(s) (meshes + icones des objets retenus)`);
console.log(`  objets    : ${objets.length} retenus, ${totalEcartesObj} ecartes`);
for (const [m, n] of Object.entries(ecartesObjets)) console.log(`      ${String(n.length).padStart(3)}  ${m}`);
console.log(`  recettes  : ${recettes.length} retenues, ${totalEcartesRec} ecartees`);
for (const [m, n] of Object.entries(ecartesRecettes)) console.log(`      ${String(n.length).padStart(3)}  ${m}`);
console.log(`  meshes cuits : ${avecMesh}/${objets.length}   icones cuites : ${avecIcone}/${objets.length}`);
if (avecMesh === 0) {
  console.log("  (normal avant le cook : le ResourcePack n'est pas encore promu sous Narvos/)");
}

if (APPLY) {
  fs.writeFileSync(SORTIE, lua, "utf8");
  console.log(`\n  ecrit : ${SORTIE}`);
} else {
  console.log("\nRien ecrit (--apply pour ecrire).");
}