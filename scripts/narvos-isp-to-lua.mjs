// ══════════════════════════════════════════════════════════════════════════════
// narvos-isp-to-lua.mjs — les DONNÉES d'InventorySystemPro vers NOS catalogues.
//
//   node scripts/narvos-isp-to-lua.mjs [--apply]
//
// Produit `Shared/Catalogs/ObjetsIsp.lua` (objets au format d'`Items.ITEM_DB`,
// recettes au format de `Recettes.RECETTES`), versé au chargement par
// `Logic/ObjetsHyper.lua` (`IntegrerPack`) — le MÊME module que Hyper : ajout sans
// écrasement, recette refusée si un ingrédient manque.
//
// ── POURQUOI LES DONNÉES ET PAS LES BLUEPRINTS ───────────────────────────────
// Même raison que Hyper Inventory V2 (voir narvos-hyper-to-lua.mjs) : ISP est un
// inventaire Blueprint complet ; notre inventaire, notre craft et notre WebUI
// existent. « Ne recrée pas inutilement des systèmes déjà existants. »
//
// Source : `adk/_isp/objets.json` et `recettes.json`, écrits par
// `scripts/adk-exporter-isp.py` dans la session d'éditeur du lot 3 (2026-09-13).
//
// ── CE QUI N'ENTRE PAS, ET POURQUOI ──────────────────────────────────────────
//   · les MONNAIES (Gold, Pesetas) : les crédits NARVOS les remplacent ;
//   · l'EXTENSION DE SAC (BP_ExpandInventoryAction) : notre grille est fixe ;
//   · les recettes de CUISSON/FONTE (PDA_BurnRecipe_C) et les TABLES DE BUTIN :
//     leurs champs ne sont pas sortis de l'export (« echecs » du JSON) ;
//   · les MONTANTS de soin, mana, faim, soif : ils vivent dans les Blueprints
//     d'action du pack, pas dans les Data Assets. Aucun `useEffect` n'est
//     inventé : ces consommables restent inertes (la roue les refuse), comme ceux
//     de Hyper, jusqu'à ce qu'un montant soit MESURÉ.
//
// ── ⚠ AUCUNE RÉFÉRENCE MORTE, AUCUN RANG ─────────────────────────────────────
// `mesh` n'est écrit que si Assets.toml porte une clé dont le CHEMIN est celui du
// paquet sous Narvos/ — cherchée par chemin, jamais par nom : `SM_Door` d'ISP est
// déclaré `SM_Door_3`, les deux premiers sont d'autres packs.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import { lireUnreal, nomAsset, cheminPaquet, champNu, nombre } from "./lib/unreal-texte.mjs";

const RACINE = "E:/narvosprime-web-prototype";
const ISP = `${RACINE}/WebPortal/Server/adk/_isp`;
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;
const SORTIE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/ObjetsIsp.lua`;
const APPLY = process.argv.includes("--apply");

const lireJson = (nom) => {
  const f = `${ISP}/${nom}.json`;
  if (!fs.existsSync(f)) {
    console.error(`ARRET : ${f} absent — lancer scripts/adk-exporter-isp.py (session d'editeur).`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(f, "utf8"));
};
const exportObjets = lireJson("objets");
const exportRecettes = lireJson("recettes");
const items = (exportObjets.objets || []).filter((o) => o.classe === "PDA_Item_C");
if (items.length === 0) {
  // Un export VIDE n'est pas un pack sans objets : les Data Assets ne se sont pas
  // chargés. Générer un catalogue vide effacerait l'ancien sans un mot.
  console.error("ARRET : aucun PDA_Item_C dans l'export — rien n'est ecrit.");
  process.exit(1);
}

// ── Chemin -> clé, section [assets.static_meshes] ────────────────────────────
const cleParChemin = new Map();
if (fs.existsSync(TOML)) {
  let dans = false;
  for (const ligne of fs.readFileSync(TOML, "utf8").split(/\r?\n/)) {
    const section = ligne.match(/^\s*\[([^\]]+)\]\s*$/);
    if (section) { dans = section[1] === "assets.static_meshes"; continue; }
    if (!dans) continue;
    const m = ligne.match(/^\s*([^\s=#]+)\s*=\s*"([^"]+)"\s*$/);
    if (m) cleParChemin.set(m[2], m[1]);
  }
}
const meshPromu = (reference) => {
  const paquet = cheminPaquet(reference);
  if (!paquet || !paquet.startsWith("/Game/InventorySystemPro/")) return null;
  const cle = cleParChemin.get("Narvos/" + paquet.slice("/Game/".length));
  return cle ? `narvos::${cle}` : null;
};

// ── Règles de correspondance ─────────────────────────────────────────────────
const serpent = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
  .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const idDe = (daNom) => "isp_" + serpent(String(daNom).replace(/^DA_/, ""));
const tagsDe = (o) => [...String(o.GameplayTags?.texte_unreal || "").matchAll(/TagName="([^"]+)"/g)].map((m) => m[1]);
const actionDe = (o) => nomAsset(o.ItemActionActor || "") || "";

/** Encombrement dans la grille par type — même choix que Hyper. */
const TAILLE = {
  material: [1, 1], consumable: [1, 1], ammo: [1, 1], quest: [1, 1],
  tool: [1, 3], weapon: [1, 3], armor: [2, 2],
};

const objets = [];
const ecartes = {};
for (const o of items) {
  const tags = tagsDe(o);
  const action = actionDe(o);
  let type;
  if (tags.some((t) => t.startsWith("Inventory.Currency"))) {
    (ecartes["monnaie : les credits NARVOS la remplacent"] ??= []).push(o.id);
    continue;
  } else if (/ExpandInventory/.test(action)) {
    (ecartes["extension de sac : notre grille est fixe"] ??= []).push(o.id);
    continue;
  } else if (tags.some((t) => t.startsWith("Inventory.Equipment.Weapon"))) {
    type = "weapon";
  } else if (tags.some((t) => t.startsWith("Inventory.Equipment."))) {
    type = "armor";
  } else if (tags.some((t) => t.startsWith("Inventory.Ammo."))) {
    type = "ammo";
  } else if (/^BP_Consume/.test(action)) {
    type = "consumable";
  } else {
    type = "material";
  }
  const pile = Math.max(1, Math.round(nombre(o.MaxStackAmount, 1)));
  const [w, h] = TAILLE[type];
  objets.push({
    id: idDe(o.id),
    source: o.id,
    label: o.Name || o.id,
    description: o.Description || "",
    type,
    categories: tags,
    gridW: w,
    gridH: h,
    stackable: pile > 1,
    maxStack: pile,
    equipSlot: type === "weapon" ? "weapon" : (type === "armor" ? "armor" : null),
    poids: nombre(o.Weight, 0),
    mesh: meshPromu(o.StaticMesh),
    mesh_source: nomAsset(o.StaticMesh || ""),
  });
}
const parSource = new Map(objets.map((o) => [o.source, o]));

// ── Recettes ─────────────────────────────────────────────────────────────────
const recettes = [];
const ecartesRecettes = {};
for (const r of exportRecettes.recettes || []) {
  if (r.classe !== "PDA_CraftingRecipe_C") {
    (ecartesRecettes[`${r.classe} : contenu non exporte`] ??= []).push(r.id);
    continue;
  }
  let brut;
  try { brut = lireUnreal(r.CraftingRecipe?.texte_unreal) || {}; } catch { brut = {}; }
  const champs = Object.fromEntries(Object.entries(brut).map(([k, v]) => [champNu(k), v]));
  const produit = parSource.get(nomAsset(champs.ResultItem || ""));
  if (!produit) {
    (ecartesRecettes["objet produit ecarte ou inconnu"] ??= []).push(r.id);
    continue;
  }
  const entrees = [];
  let manquant = null;
  for (const e of Array.isArray(champs.RequiredItems) ? champs.RequiredItems : []) {
    const ce = Object.fromEntries(Object.entries(e || {}).map(([k, v]) => [champNu(k), v]));
    const ing = parSource.get(nomAsset(ce.Item || ""));
    if (!ing) { manquant = nomAsset(ce.Item || "") || "?"; break; }
    // Un Amount absent est le DEFAUT de la structure : 1 (recette du médaillon).
    entrees.push({ item_id: ing.id, quantite: Math.max(1, Math.round(nombre(ce.Amount, 1))) });
  }
  if (manquant) {
    (ecartesRecettes[`ingredient ecarte ou inconnu : ${manquant}`] ??= []).push(r.id);
    continue;
  }
  if (entrees.length === 0) {
    (ecartesRecettes["recette sans ingredient"] ??= []).push(r.id);
    continue;
  }
  recettes.push({
    id: "craft_" + idDe(r.id.replace(/^DA_Recipe/, "DA_")),
    label: produit.label,
    sortie: { item_id: produit.id, quantite: Math.max(1, Math.round(nombre(champs.ResultAmount, 1))) },
    entrees,
    // ⚠ CHOIX, PAS MESURE : les collections de recettes (Workbench, Example) ne sont
    // pas sorties de l'export. Un consommable se prépare à l'alchimie, le reste à
    // l'établi — les deux stations les plus proches de ce que fabrique le pack.
    station: produit.type === "consumable" ? "alchemy" : "workbench",
    palier: 0,
    duree_ms: Math.round(nombre(champs.CraftingTime, 5) * 1000),
  });
}

// ── Sortie Lua ───────────────────────────────────────────────────────────────
const q = (v) => (v === null || v === undefined) ? "nil" : JSON.stringify(String(v));
const liste = (arr) => `{ ${arr.map(q).join(", ")} }`;
const avecMesh = objets.filter((o) => o.mesh).length;
const total = (t) => Object.values(t).reduce((n, a) => n + a.length, 0);
const commentaire = (t) => Object.entries(t).sort((a, b) => b[1].length - a[1].length)
  .map(([motif, ids]) => `--   ${String(ids.length).padStart(3)}  ${motif}`).join("\n");

const lignesObjets = objets.sort((a, b) => a.id.localeCompare(b.id)).map((o) => [
  `    ${o.id} = {`,
  `        id = ${q(o.id)}, source = ${q(o.source)},`,
  `        label = ${q(o.label)}, type = ${q(o.type)}, rarity = "common",`,
  `        description = ${q(o.description)},`,
  `        categories = ${liste(o.categories)},`,
  `        gridW = ${o.gridW}, gridH = ${o.gridH},`,
  `        stackable = ${o.stackable}, maxStack = ${o.maxStack},`,
  o.equipSlot ? `        equipSlot = ${q(o.equipSlot)},` : null,
  `        poids = ${o.poids}, prix = 0,`,
  o.mesh ? `        mesh = ${q(o.mesh)},` : null,
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

const lua = `-- ══════════════════════════════════════════════════════════════════════════════
-- ObjetsIsp.lua — les donnees d'InventorySystemPro, au format de NOS catalogues.
--
-- FICHIER GENERE par scripts/narvos-isp-to-lua.mjs — ne pas editer a la main.
-- Source : WebPortal/Server/adk/_isp/objets.json et recettes.json (session d'editeur).
--
-- ${objets.length} objet(s), ${recettes.length} recette(s) ; ${avecMesh} objet(s) avec leur mesh cuit (cle par CHEMIN).
--
-- Objets ECARTES (${total(ecartes)}) :
${commentaire(ecartes) || "--   aucun"}
--
-- Recettes ECARTEES (${total(ecartesRecettes)}) :
${commentaire(ecartesRecettes) || "--   aucune"}
--
-- Aucun useEffect : les montants vivent dans les Blueprints d'action du pack.
-- Verse par Logic/ObjetsHyper.lua (IntegrerPack), sans jamais ecraser.
-- ══════════════════════════════════════════════════════════════════════════════

local ObjetsIsp = {}

ObjetsIsp.OBJETS = {
${lignesObjets.join("\n")}
}

ObjetsIsp.RECETTES = {
${lignesRecettes.join("\n")}
}

--- Ordre d'affichage des recettes : \`pairs\` n'a aucun ordre garanti.
ObjetsIsp.ORDRE_RECETTES = ${liste(recettes.map((r) => r.id))}

return ObjetsIsp
`;

console.log("InventorySystemPro -> nos catalogues");
console.log(`  objets   : ${objets.length} retenus, ${total(ecartes)} ecartes`);
for (const [m, ids] of Object.entries(ecartes)) console.log(`      ${String(ids.length).padStart(3)}  ${m}`);
console.log(`  recettes : ${recettes.length} retenues, ${total(ecartesRecettes)} ecartees`);
for (const [m, ids] of Object.entries(ecartesRecettes)) console.log(`      ${String(ids.length).padStart(3)}  ${m}`);
console.log(`  meshes cuits : ${avecMesh}/${objets.length}`);
const sansMesh = objets.filter((o) => !o.mesh && o.mesh_source).map((o) => `${o.source} (${o.mesh_source})`);
if (sansMesh.length) console.log(`  sans cle de mesh : ${sansMesh.slice(0, 12).join(", ")}${sansMesh.length > 12 ? " ..." : ""}`);

if (APPLY) {
  fs.writeFileSync(SORTIE, lua, "utf8");
  console.log(`\n  ecrit : ${SORTIE}`);
} else {
  console.log("\nRien ecrit (--apply pour ecrire).");
}