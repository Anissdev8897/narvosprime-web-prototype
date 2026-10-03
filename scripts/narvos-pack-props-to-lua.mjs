// ══════════════════════════════════════════════════════════════════════════════
// narvos-pack-props-to-lua.mjs — catalogue les décors de NOTRE pack cuit.
//
//   node scripts/narvos-pack-props-to-lua.mjs [--apply]
//
// Produit `Shared/Catalogs/PropsNarvos.lua`, frère de `Props.lua`.
//
// ── LE DÉFAUT QUE CE FICHIER RÉPARE ──────────────────────────────────────────
// `Props.lua` est produit par `narvos-nanos-base-to-lua.mjs`, qui lit le pack de
// BASE nanos : 449 meshes, déjà chez chaque joueur. Nos propres meshes — les 138
// de Mars Sanctuary, les 123 de nature, ceux de Defender — sont cuits dans le
// pack et **invisibles au Lua** : rien ne les nomme, donc rien ne peut les poser.
//
// ── ⚠ ON LIT `Assets.toml`, PAS L'INVENTAIRE DU PROJET ───────────────────────
// `_assets-inventory.json` liste les `.uasset` du projet, avec leur nom d'asset.
// Ce nom n'est PAS toujours la clé du pack : le constructeur SUFFIXE les
// collisions. Mesuré dans le pack courant —
//
//     -000_001   = "Narvos/chunks_unreal_v3/-000_001"
//     -000_001_2 = "Narvos/tower_map/chunks_png/-000_001"
//
// — deux meshes homonymes, deux clés différentes. Générer depuis l'inventaire
// produirait des `narvos::<nom>` que le moteur ignorerait en silence, ce qui est
// le mode d'échec le plus coûteux du projet.
//
// ⚠ CONSÉQUENCE DIRECTE : ce script doit tourner APRÈS le cook et APRÈS
// `nanos-build-asset-pack.mjs --apply`. Lancé avant, il catalogue le pack
// précédent — et se déclare content.
//
// ── POURQUOI LES CARTES SONT EXCLUES ─────────────────────────────────────────
// Sur les 42 409 StaticMesh de `Narvos`, **41 830 sont de la géométrie de carte**
// (`tower_map` 26 673, `halo_map` 12 988, `Orbital` 1 546, `chunks_unreal_v3`
// 623). Ils vivent déjà dans les catalogues `Map_*.lua`, que `MapLoader` pose
// d'un bloc. Les verser dans un menu de props donnerait 41 830 entrées de
// fragments de terrain — inutilisable, et plusieurs mégaoctets poussés au client
// à chaque ouverture du menu.
//
// Le filtre porte sur le CHEMIN (`Narvos/tower_map/…`), pas sur le nom : les
// noms de fragments n'ont aucune convention commune.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = "E:/narvosprime-web-prototype";
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;
const SORTIE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/PropsNarvos.lua`;

const APPLIQUER = process.argv.includes("--apply");

// ── Ce qu'on écarte, et pourquoi ─────────────────────────────────────────────
//
// Chaque entrée dit ce qu'elle retire ET la raison. Un filtre sans raison finit
// par retirer autre chose que ce qu'on croyait.
const ECARTES = [
  ["Narvos/tower_map/", "geometrie de carte — deja dans Map_tower_map.lua"],
  ["Narvos/halo_map/", "geometrie de carte — deja dans Map_forge_map.lua"],
  ["Narvos/Orbital/", "geometrie de carte — deja dans Map_Orbital.lua"],
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 81 ligne(s) attendue(s) ici, 77 connue(s)]
  ["Narvos/chunks_unreal_v3/", "geometrie de carte — deja dans Map_forge_map.lua"],
  ["Narvos/UI/", "images d'interface, pas du decor"],
  ["Narvos/StylizedModularChar/", "pieces de personnage — voir Modular.lua"],
  ["Narvos/MetaHumans/", "pieces de personnage"],
  ["Narvos/Levels/", "assets de niveau, pas des props"],
];

// ── Les catégories, par dossier de premier niveau ────────────────────────────
//
// Un dossier = une catégorie. C'est grossier, et c'est voulu : la taxonomie fine
// vit dans `public/models/CATALOG.md`, qui décrit les packs SOURCE. Ici on
// décrit ce qui est CUIT, et le seul groupement fiable est l'arborescence.
const CATEGORIES = {
  Mars_Sanctuary: { id: "mars", label: "Mars — sanctuaire" },
  // Cuits depuis le 09/09 et JAMAIS nommes : 243 et 58 cles dans Assets.toml,
  // zero reference dans notre code (mesure du 2026-09-11,
  // scripts/narvos-assets-cuits-jamais-appeles.mjs). Un dossier absent de
  // cette table tombe en « sans categorie » — et il le disait a chaque
  // execution, sans que personne ne lise cette ligne du rapport.
  Sewer: { id: "egouts", label: "Egouts et tunnels" },
  Megastructure_Scifi_World: { id: "megastructure", label: "Megastructure sci-fi" },
  nature: { id: "nature", label: "Nature" },
  SpaceScenes: { id: "spatial", label: "Spatial" },
  Defender: { id: "militaire", label: "Militaire" },
  FreeflowCombatSystem: { id: "armes", label: "Armes de melee" },
  MWLandscapeAutoMaterial: { id: "terrain", label: "Terrain et rochers" },
  ExternalAssets: { id: "divers", label: "Divers" },
  Showcase: { id: "divers", label: "Divers" },
  CoreC: { id: "divers", label: "Divers" },
  CyberpunkSamurai: { id: "divers", label: "Divers" },
  Planet_Project: { id: "spatial", label: "Spatial" },
  SFSHelmet: { id: "divers", label: "Divers" },
  SmartLocomotion: { id: "divers", label: "Divers" },
  Infinite: { id: "divers", label: "Divers" },

  // -- Ajoutees le 2026-09-12, a la demande de Hanibes -------------------------
  //
  // 256 assets de `CraftingStations` et 348 d `OpenWorlds` etaient cuits,
  // declares dans Assets.toml, et ECARTES ici pour la seule raison que leur
  // dossier n avait pas de ligne dans cette table. « dossier sans categorie »
  // n est pas un jugement sur l asset : c est un trou dans ce fichier.
  //
  // CraftingStations porte les etablis, coffres, barils, alambics et outils du
  // pack Survival Crafting — exactement ce qu il faut pouvoir POSER autour des
  // quatre stations deja branchees.
  CraftingStations: { id: "artisanat", label: "Artisanat et survie" },
  OpenWorlds: { id: "urbain", label: "Mobilier urbain" },

  // -- Packs entres par jonction + liens durs, nuit du 2026-09-12 au 13 ---------
  // Leurs meshes sont sous `Narvos/<Racine>/` : sans ces lignes, ils seraient
  // ecartes pour « dossier sans categorie », comme CraftingStations l'etait.
  Hyper: { id: "objets", label: "Objets et ressources" },
  Hypernova: { id: "cristaux", label: "Cristaux et construction" },
  Farming_And_Mining: { id: "outils", label: "Outils agricoles" },
  // En attente du cook : stagé dans `adk/Content/City_Traffic_Pro/` (587
  // .uasset) et compté 0 fois dans Assets.toml au 10/09. La ligne ne produit
  // rien tant que le dossier n'apparaît pas dans le pack ; elle évite que le
  // mobilier urbain (feux, panneaux, abris) tombe en « sans categorie » le
  // jour du cook.
  // ⚠ SUPPOSITION DE CHEMIN : le build du pack ne lit que `Content/Narvos/`
  // (DOSSIER_UNREAL dans nanos-build-asset-pack.mjs) — on parie donc sur
  // `Narvos/City_Traffic_Pro/…`. Si le cook choisit un autre nom, le compteur
  // « dossier sans categorie » le montrera.
  City_Traffic_Pro: { id: "urbain", label: "Mobilier urbain" },

  // -- Lot du 2026-09-13 (jonction + liens durs, cook en attente) ---------------
  // Meme regle que ci-dessus : une ligne ecrite AVANT le cook, qui ne produit rien
  // tant que le dossier n'est pas dans le pack, et evite « sans categorie » apres.
  //   QuarantineTent               121 StaticMesh medicaux (lits, perfusions,
  //                                tentes, masques, seringues) — UE 4.26
  //   InventorySystemPro           114 objets de la demo (potions, cles, lingots,
  //                                minerais, armes posees, tresors, etabli, forge)
  //   Multiplayer_Handcuff_System  SM_Handcuff, l'objet que l'executant des
  //                                menottes attache au poignet
  QuarantineTent: { id: "medical", label: "Medical et quarantaine" },
  InventorySystemPro: { id: "objets", label: "Objets et ressources" },
  Multiplayer_Handcuff_System: { id: "objets", label: "Objets et ressources" },
// [ANCIENNE VERSION ↑]
};

if (!fs.existsSync(TOML)) {
  console.error(`ARRÊT : ${TOML} est absent.`);
  console.error("  Le pack n'a pas encore été construit. Lancer d'abord :");
  console.error("    bash scripts/narvos-chaine-cook.sh");
  process.exit(1);
}

// ── Lecture du bloc `[assets.static_meshes]` ─────────────────────────────────
//
// On ne parse pas tout le TOML : une seule section nous intéresse, et un parseur
// complet apporterait une dépendance pour rien.
const texte = fs.readFileSync(TOML, "utf8");
const lignes = texte.split(/\r?\n/);

let dans = false;
const meshes = [];
for (const ligne of lignes) {
  const section = ligne.match(/^\s*\[([^\]]+)\]\s*$/);
  if (section) {
    dans = section[1] === "assets.static_meshes";
    continue;
  }
  if (!dans) continue;
  const m = ligne.match(/^\s*([^\s=#]+)\s*=\s*"([^"]+)"\s*$/);
  if (m) meshes.push({ cle: m[1], chemin: m[2] });
}

if (meshes.length === 0) {
  console.error("ARRÊT : aucun static mesh dans [assets.static_meshes].");
  console.error("  Le pack est-il construit ? `nanos-build-asset-pack.mjs --apply`");
  process.exit(1);
}

// ── Tri ──────────────────────────────────────────────────────────────────────
const ecartes = new Map();
const retenus = [];

for (const m of meshes) {
  const motif = ECARTES.find(([prefixe]) => m.chemin.startsWith(prefixe));
  if (motif) {
    ecartes.set(motif[1], (ecartes.get(motif[1]) ?? 0) + 1);
    continue;
  }
  const dossier = m.chemin.split("/")[1] ?? "?";
  const cat = CATEGORIES[dossier];
  if (!cat) {
    ecartes.set(`dossier sans categorie : ${dossier}`, (ecartes.get(`dossier sans categorie : ${dossier}`) ?? 0) + 1);
    continue;
  }
  retenus.push({ cle: m.cle, categorie: cat.id, label: libelle(m.cle) });
}

/** Un libellé lisible depuis une clé d'asset. */
function libelle(cle) {
  return cle
    .replace(/^SM_/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

retenus.sort((a, b) => (a.categorie === b.categorie
  ? a.cle.localeCompare(b.cle)
  : a.categorie.localeCompare(b.categorie)));

const cats = [...new Set(retenus.map((r) => r.categorie))]
  .map((id) => {
    const trouve = Object.values(CATEGORIES).find((c) => c.id === id);
    return { id, label: trouve ? trouve.label : id };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

const parCat = new Map();
for (const r of retenus) parCat.set(r.categorie, (parCat.get(r.categorie) ?? 0) + 1);

// ── Rapport ──────────────────────────────────────────────────────────────────
console.log(`Assets.toml : ${meshes.length} static mesh(es) déclarés`);
console.log("");
console.log("écartés :");
for (const [raison, n] of [...ecartes].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(6)}  ${raison}`);
}
console.log("");
console.log(`retenus : ${retenus.length}`);
for (const c of cats) {
  console.log(`  ${String(parCat.get(c.id)).padStart(6)}  ${c.label}`);
}

if (!APPLIQUER) {
  console.log("");
  console.log(`Simulation — rien écrit. Ajouter --apply pour produire :`);
  console.log(`  ${SORTIE}`);
  process.exit(0);
}

// ── Écriture ─────────────────────────────────────────────────────────────────
const lignesLua = retenus
  .map((r) => `    { id = ${JSON.stringify(r.cle)}, categorie = "${r.categorie}", label = ${JSON.stringify(r.label)} },`)
  .join("\n");

const lignesCats = cats
  .map((c) => `    { id = "${c.id}", label = ${JSON.stringify(c.label)} },`)
  .join("\n");

const repartition = [...parCat.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([id, n]) => `--   ${String(n).padStart(5)}  ${id}`)
  .join("\n");

const lua = `-- Genere par scripts/narvos-pack-props-to-lua.mjs depuis Assets.toml de NOTRE
-- pack cuit. Ne pas editer a la main : regenerer apres chaque cook.
--
-- Frere de Props.lua, qui catalogue le pack de BASE nanos. Celui-ci catalogue le
-- NOTRE : sans lui, nos meshes sont cuits et personne ne peut les nommer.
--
-- ${retenus.length} decors, ${cats.length} categories :
${repartition}
--
-- Les cles viennent d'Assets.toml et NON du nom d'asset : le constructeur de
-- pack suffixe les collisions, et deux meshes homonymes n'ont pas la meme cle.
--
-- La geometrie de carte est ECARTEE : elle vit dans les catalogues Map_*.lua,
-- que MapLoader pose d'un bloc. Sur ${meshes.length} static meshes du pack,
-- ${meshes.length - retenus.length} sont ecartes a ce titre ou parce qu'ils ne sont pas du decor.
local PropsNarvos = {}

PropsNarvos.PACK = "narvos"

PropsNarvos.CATEGORIES = {
${lignesCats}
}

PropsNarvos.PIECES = {
${lignesLua}
}

local par_id = {}
for _, p in ipairs(PropsNarvos.PIECES) do par_id[p.id] = p end

---@param id any
---@return table|nil
function PropsNarvos.Trouver(id)
    if (type(id) ~= "string") then return nil end
    return par_id[id]
end

--- Chemin complet, prefixe du pack compris.
---@param id any
---@return string|nil
function PropsNarvos.Asset(id)
    if (not PropsNarvos.Trouver(id)) then return nil end
    return PropsNarvos.PACK .. "::" .. id
end

---@param categorie any
---@return table
function PropsNarvos.ParCategorie(categorie)
    local sortie = {}
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : ? ligne(s) attendue(s) ici, 14 connue(s)]
    for _, p in ipairs(PropsNarvos.PIECES) do
        if (p.categorie == categorie) then sortie[#sortie + 1] = p end
    end
    return sortie
end

return PropsNarvos
`;

fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, lua, "utf8");
console.log("");
console.log(`Écrit : ${SORTIE}`);
console.log(`${retenus.length} décors, ${cats.length} catégories.`);
// [ANCIENNE VERSION ↑]
// [MODIFICATIONS NON REPLACÉES — 1 modification(s) faite(s) à ce fichier n'ont pas pu y être reportées (texte d'origine introuvable ou ambigu) : voir EDITS_NON_APPLIQUES]