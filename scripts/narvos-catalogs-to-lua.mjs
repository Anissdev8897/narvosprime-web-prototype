// ══════════════════════════════════════════════════════════════════════════════
// narvos-catalogs-to-lua.mjs — Transpile les catalogues TS du runtime RPG en
// tables Lua consommables par un package nanos world.
//
//   node scripts/narvos-catalogs-to-lua.mjs [--apply]
//
// POURQUOI : le contenu de NARVOS vit dans des objets TS statiques — classes,
// éléments, sorts, loot, PNJ, marchands, véhicules, manifeste d'assets. Ce sont
// des DONNÉES, pas du code de rendu : elles traversent vers nanos sans perte.
// Les ressaisir à la main garantirait une divergence à la première évolution.
//
// COMMENT : on n'analyse pas le TypeScript, on l'EXÉCUTE. esbuild bundle chaque
// module (imports de types compris, effacés à la compilation), on l'importe, et
// on sérialise les valeurs exportées. Un parseur maison se casserait sur la
// première syntaxe inattendue ; l'évaluation, elle, voit exactement ce que voit
// le jeu.
//
// CE QU'ON GARDE : objets, tableaux, chaînes, nombres, booléens, Map et Set.
// CE QU'ON JETTE : les fonctions. `rollLoot()` est de la logique, elle se
// réécrit en Lua — seule sa table de données part ici.
//
// PIÈGE LUA : un index de tableau commence à 1, et une clé qui n'est pas un
// identifiant valide s'écrit ["clé"]. Les deux sont gérés à la sérialisation.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { lireSquelette } from "./lib/uasset-squelette.mjs";
import * as esbuild from "../WebPortal/node_modules/esbuild/lib/main.js";

const RPG = "E:/narvosprime-web-prototype/WebPortal/src/rpg";
const PACKAGE = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos";
const APPLY = process.argv.includes("--apply");

/**
 * Catalogues à transpiler. `exports` limite aux valeurs voulues : un module
 * exporte aussi ses types et ses helpers, qui n'ont rien à faire en Lua.
 */
const CATALOGUES = [
  { source: "classes/classes.ts", sortie: "Classes", exports: null },
  { source: "elements/elements.ts", sortie: "Elements", exports: null },
  { source: "spells/spellCatalog.ts", sortie: "Spells", exports: null },
  { source: "loot/LootRegistry.ts", sortie: "Loot", exports: null },
  // Sans ce catalogue, Inventory.lua dégrade en nil sur chaque GetItemDef :
  // toute la chaîne d'inventaire reste inerte, sans erreur visible.
  { source: "items/itemCatalog.ts", sortie: "Items", exports: null },
  { source: "npc/npcCatalog.ts", sortie: "Npc", exports: null },
  { source: "npc/merchants.ts", sortie: "Merchants", exports: null },
  { source: "runtime/vehicles/vehicleCatalog.ts", sortie: "Vehicles", exports: null },
  // PlayerStats.ts n'exporte que des FONCTIONS : le générateur n'en tire que
  // MAX_LEVEL. Sa logique est portée à la main dans Shared/Logic/Stats.lua.
  { source: "stats/PlayerStats.ts", sortie: "Stats", exports: null },
  // Les METIERS (2026-09-12). Hanibes demandait « Hyper Skill Level Manager » :
  // niveaux de metier, XP gagnee en pratiquant. La mesure a montre que ce
  // systeme EXISTAIT deja dans le prototype web — 6 metiers, niveaux 1 a 50,
  // paliers de ressources, recettes a niveau requis, store teste — et qu'il
  // n'avait JAMAIS ete porte vers nanos. On porte l'existant plutot que
  // d'importer la logique Blueprint d'un pack concu pour un serveur Unreal.
  //
  // Seules les DONNEES sortent ici (PROFESSIONS, RECIPES, RESOURCE_BY_ID...) :
  // `xpForLevel` et la montee de niveau sont des fonctions, portees a la main
  // dans `Logic/Metiers.lua` et prouvees par harnais.
  { source: "professions/professionCatalog.ts", sortie: "Metiers", exports: null },
  // Arbre de talents : nécessaire à effectiveStats, qui agrège les rangs investis
  // avant de calculer PV, mana, défense et critique.
  { source: "talents/talentCatalog.ts", sortie: "Talents", exports: null },
  // Niveaux des PNJ et XP de victoire (2026-09-13, menu Compétences) : plages de
  // niveaux par zone, croissance PV/dégâts, K de l'XP par victoire, taux du
  // serveur héroïque. Seules les DONNÉES sortent ; `xpForKill` et la courbe du
  // joueur sont portées dans `Logic/Progression.lua`, prouvées par harnais
  // (scripts/lua-harness/progression.mjs) contre le TS exécuté.
  { source: "npc/npcLeveling.ts", sortie: "NiveauxPnj", exports: null },
];

// ─── sérialisation Lua ────────────────────────────────────────────────────────
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 68 ligne(s) attendue(s) ici, 48 connue(s)]

const IDENTIFIANT = /^[A-Za-z_][A-Za-z0-9_]*$/;
// Mots réservés Lua : utilisés comme clé, ils doivent passer par ["..."].
const RESERVES = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function",
  "goto", "if", "in", "local", "nil", "not", "or", "repeat", "return", "then",
  "true", "until", "while",
]);

const chaineLua = (s) =>
  `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`;

const cleLua = (k) =>
  IDENTIFIANT.test(k) && !RESERVES.has(k) ? k : `[${chaineLua(k)}]`;

/** Rend une valeur JS en Lua. Retourne null pour ce qui ne se transpose pas. */
const valeurLua = (v, indent) => {
  const pad = "    ".repeat(indent);
  const padInterne = "    ".repeat(indent + 1);

  if (v === null || v === undefined) return "nil";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "string") return chaineLua(v);
  if (typeof v === "function") return null; // logique : ne traverse pas
  if (v instanceof Map) return valeurLua(Object.fromEntries(v), indent);
  if (v instanceof Set) return valeurLua([...v], indent);

  if (Array.isArray(v)) {
    if (v.length === 0) return "{}";
    const items = v.map((x) => valeurLua(x, indent + 1)).filter((x) => x !== null);
    return `{\n${items.map((x) => padInterne + x).join(",\n")},\n${pad}}`;
  }

  if (typeof v === "object") {
    const lignes = [];
    for (const [k, val] of Object.entries(v)) {
      const rendu = valeurLua(val, indent + 1);
      if (rendu === null) continue; // fonction ignorée
      lignes.push(`${padInterne}${cleLua(k)} = ${rendu}`);
    }
    if (lignes.length === 0) return "{}";
    return `{\n${lignes.join(",\n")},\n${pad}}`;
  }

  return null;
};

// ─── chargement d'un module TS ────────────────────────────────────────────────
// [ANCIENNE VERSION ↑]
// [DERNIÈRE VERSION ↓ — ligne(s) sûre(s) du fichier final, lue(s) dans le tronçon ci-dessus mais non replacée(s) : il a changé de longueur. Leur n° final est entre crochets]
// [SÛRE n°146]   return clesAssetsToml;
// [SÛRE n°147] };
// [SÛRE n°148] 
// [SÛRE n°149] /** { cle -> chemin de pack } d'Assets.toml, lu une fois. */
// [SÛRE n°150] let cheminsToml = null;
// [SÛRE n°151] const cheminsAssetsToml = () => {
// [SÛRE n°152]   if (cheminsToml) return cheminsToml;
// [SÛRE n°153]   cheminsToml = new Map();
// [SÛRE n°154]   const toml = "E:/narvosprime-web-prototype/WebPortal/Server/Assets/narvos/Assets.toml";
// [SÛRE n°155]   if (fs.existsSync(toml)) {
// [SÛRE n°156]     for (const ligne of fs.readFileSync(toml, "utf8").split("\n")) {
// [SÛRE n°157]       const m = ligne.match(/^\s*([^\s=[]+)\s*=\s*"([^"]*)"/);
// [SÛRE n°158]       if (m && !cheminsToml.has(m[1])) cheminsToml.set(m[1], m[2]);
// [SÛRE n°159]     }
// [SÛRE n°160]   }
// [SÛRE n°161]   return cheminsToml;
// [SÛRE n°162] };
// [SÛRE n°163] 
// [SÛRE n°164] /** Hauteur moyenne des os `Wheel_*` au-dessus de l'origine, lue dans le
// [SÛRE n°165]  *  squelette du mesh SOURCE (ADK). nil si illisible ou hors bornes plausibles. */
// [SÛRE n°166] const rayonRoueMesure = (cheminPack) => {
// [SÛRE n°167]   const f = `E:/narvosprime-web-prototype/WebPortal/Server/adk/Content/${cheminPack}.uasset`;
// [SÛRE n°168]   if (!fs.existsSync(f)) return null;
// [SÛRE n°169]   try {
// [SÛRE n°170]     const { os: osListe } = lireSquelette(f);
// [SÛRE n°171]     const hauteurs = osListe.filter((o) => /^Wheel_/i.test(o.nom) && o.parent >= 0).map((o) => o.t[2]);
// [SÛRE n°172]     if (hauteurs.length < 4) return null;
// [SÛRE n°173]     const moyenne = hauteurs.reduce((a, b) => a + b, 0) / hauteurs.length;
// [SÛRE n°174]     return moyenne >= 15 && moyenne <= 80 ? Math.round(moyenne * 10) / 10 : null;
// [SÛRE n°175]   } catch {
// [SÛRE n°176]     return null;
// [SÛRE n°177]   }
// [SÛRE n°178] };
// [DERNIÈRE VERSION ↑]

/**
 * Bundle puis importe un module TS. Le bundle est nécessaire : un catalogue
 * importe souvent des types ou des constantes d'autres modules.
 */
const chargerModule = async (fichierTs) => {
  const temp = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "narvos-lua-")),
    "module.mjs",
  );
  await esbuild.build({
    entryPoints: [fichierTs],
    outfile: temp,
    bundle: true,
    format: "esm",
    platform: "node",
    // On bundle TOUT, y compris three et react. Les marquer externes laisserait
    // des `import "react"` que Node ne résout pas depuis le dossier temporaire.
    // C'est sans risque ici : ces modules tournent déjà en environnement `node`
    // sous vitest, donc leur code de chargement ne touche ni au DOM ni au GPU
    // (cf. les gardes `typeof document === "undefined"` du dépôt).
    // `import.meta.env` est fourni par Vite, pas par Node : sans ces définitions
    // le module plante au chargement sur `import.meta.env.DEV`.
    define: {
      "import.meta.env.DEV": "false",
      "import.meta.env.PROD": "true",
      "import.meta.env.MODE": '"production"',
      "import.meta.env": "{}",
      "process.env.NODE_ENV": '"production"',
    },
    logLevel: "silent",
  });
  const mod = await import(pathToFileURL(temp).href);
  return { mod, nettoyer: () => fs.rmSync(path.dirname(temp), { recursive: true, force: true }) };
};

// ─── main ─────────────────────────────────────────────────────────────────────

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`vers : ${PACKAGE}/Shared/Catalogs/`);
console.log("");

const produits = [];

const selection = process.argv.includes("--catalogue") ? process.argv[process.argv.indexOf("--catalogue") + 1] : null;
if (process.argv.includes("--catalogue") && !CATALOGUES.some(c => c.sortie === selection)) throw new Error("Catalogue inconnu : " + selection);
for (const cat of CATALOGUES.filter(c => !selection || c.sortie === selection)) {
  const fichier = path.join(RPG, cat.source);
  if (!fs.existsSync(fichier)) {
    console.log(`  MANQUE   ${cat.source}`);
    continue;
  }

  let mod, nettoyer;
  try {
    ({ mod, nettoyer } = await chargerModule(fichier));
  } catch (err) {
    console.log(`  ÉCHEC    ${cat.source} — ${err.message.split("\n")[0]}`);
    continue;
  }

  // ── GARDE « Véhicules » : seul sort ce dont le mesh EST cuit ─────────────
  //
  // `VOITURES_NANOS` nomme des assets du pack (`narvos::SK_…`). Une entrée
  // dont le mesh est absent d'Assets.toml serait une référence morte — et
  // nanos ignore un asset manquant EN SILENCE (le joueur conclut que la
  // touche n'a pas répondu). La garde filtre donc sur l'inventaire RÉEL du
  // pack cuit, et DIT chaque exclusion : un retrait muet referait le défaut
  // que ce générateur existe pour tuer (catalogue construit depuis une liste
  // de souhaits plutôt que depuis ce qui EST).
  //
  // Le filtre ne porte que sur le MESH (la mission) ; sons et plaques de
  // chaque entrée retenue sont vérifiés par narvos-verifier-catalogues.mjs.
  if (cat.sortie === "Vehicles" && Array.isArray(mod.VOITURES_NANOS)) {
    const cles = inventaireAssetsToml();
    const retenues = [];
    const exclues = [];
    for (const v of mod.VOITURES_NANOS) {
      const cle = String(v && v.asset || "").replace(/^narvos::/, "");
      if (cles.has(cle)) retenues.push(v);
      else exclues.push(String(v && v.id));
    }
    // ── RAYON DE ROUE MESURÉ, PAR MODÈLE (2026-09-13) ─────────────────────────
    // Retour de jeu : « les roues sont bloquées au niveau du sol ». Le réglage
    // commun imposait `rayon = 30` à toutes les voitures ; or l'origine des
    // modèles City_Traffic_Pro est AU SOL (toits à 141-191 cm, bas de carrosserie
    // à 15-42 cm, mesurés dans leurs PhysicsAssets) et le centre de roue y est à
    // 28,7 cm (Panel Van) … 40,0 cm (SUV). Avec 30 + 7 de débattement, le rayon de
    // suspension de Crossover, Pickup et SUV n'atteint JAMAIS le sol : la voiture
    // repose sur son châssis. Le rayon vrai = hauteur moyenne des os `Wheel_*`,
    // lue dans le Skeleton SOURCE du mesh — mesurée, jamais recopiée.
    for (let i = 0; i < retenues.length; i++) {
      const cle = String(retenues[i].asset || "").replace(/^narvos::/, "");
      const chemin = cheminsAssetsToml().get(cle);
      const rayon = chemin ? rayonRoueMesure(chemin) : null;
      if (rayon) retenues[i] = { ...retenues[i], rayon_roue: rayon };
      else console.log(`  garde Vehicles : ⚠ ${retenues[i].id} — rayon de roue NON mesure (squelette illisible), reglage commun`);
    }
    mod = { ...mod, VOITURES_NANOS: retenues };
    if (exclues.length > 0) {
      console.log(`  garde Vehicles : ${exclues.length} voiture(s) EXCLUE(S) — mesh absent d'Assets.toml :`);
      for (const id of exclues) console.log(`    EXCLUE  ${id}`);
    }
    if (retenues.length === 0) {
      // Un catalogue vide qui se tairait compterait pour vert : on le dit.
      console.log("  garde Vehicles : ⚠ AUCUNE voiture retenue — VOITURES_NANOS sortira vide.");
    } else {
      console.log(`  garde Vehicles : ${retenues.length} voiture(s) retenue(s) (mesh présent dans Assets.toml).`);
    }
  }

  // ── Même garde pour les MOTOS (Ridable MotorBikes, 2026-09-13) ─────────────
  // Avant leur cook, les trois sortent EXCLUES, et c'est dit : le harnais
  // vehicules.mjs confronte le nombre retenu aux corps réellement déclarés.
  if (cat.sortie === "Vehicles" && Array.isArray(mod.MOTOS_NANOS)) {
    const cles = inventaireAssetsToml();
    const retenues = [];
    const exclues = [];
    for (const v of mod.MOTOS_NANOS) {
      const cle = String(v && v.asset || "").replace(/^narvos::/, "");
      if (cles.has(cle)) retenues.push(v);
      else exclues.push(String(v && v.id));
    }
    mod = { ...mod, MOTOS_NANOS: retenues };
    for (const id of exclues) console.log(`  garde Motos : EXCLUE  ${id} (corps absent d'Assets.toml)`);
    console.log(`  garde Motos : ${retenues.length} moto(s) retenue(s).`);
  }

  const lignes = [
    `-- Généré depuis ${cat.source} par scripts/narvos-catalogs-to-lua.mjs`,
    "-- Ne pas éditer à la main : régénérer après toute évolution du catalogue TS.",
    "",
    `local ${cat.sortie} = {}`,
    "",
  ];

  let valeurs = 0;
  let ignorees = 0;

  for (const [nom, valeur] of Object.entries(mod)) {
    if (cat.exports && !cat.exports.includes(nom)) continue;
    if (typeof valeur === "function") {
      ignorees++;
      continue;
    }
    const rendu = valeurLua(valeur, 0);
    if (rendu === null) {
      ignorees++;
      continue;
    }
    lignes.push(`${cat.sortie}.${nom} = ${rendu}`, "");
    valeurs++;

    // JS garantit l'ordre d'insertion des clés d'un objet, `pairs` en Lua n'en
    // garantit aucun — et il varie d'une VM à l'autre. Un tirage indexé sur
    // `pairs` donnerait donc un item différent côté serveur et côté client pour
    // la même valeur de RNG. On fige l'ordre TS dans une séquence à part.
    if (valeur && typeof valeur === "object" && !Array.isArray(valeur)) {
      const cles = Object.keys(valeur);
      if (cles.length > 1 && cles.every((k) => typeof valeur[k] === "object")) {
        lignes.push(
          `-- Ordre d'insertion du catalogue TS : à utiliser pour tout tirage indexé.`,
          `${cat.sortie}.${nom}_ORDER = ${valeurLua(cles, 0)}`,
          "",
        );
      }
    }
  }

  lignes.push(`return ${cat.sortie}`, "");
  nettoyer();

  if (valeurs === 0) {
    console.log(`  VIDE     ${cat.source} (aucune donnée exportée)`);
    continue;
  }

  const contenu = lignes.join("\n");
  const cible = path.join(PACKAGE, "Shared", "Catalogs", `${cat.sortie}.lua`);
  console.log(
    `  ${cat.sortie.padEnd(10)} ${String(valeurs).padStart(2)} table(s), ${String(ignorees).padStart(2)} ignorée(s)   ${(contenu.length / 1024).toFixed(1)} ko`,
  );
  produits.push(cat.sortie);

  if (APPLY) {
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.writeFileSync(cible, contenu, "utf8");
  }
}

// ─── Index.lua : ON VÉRIFIE, ON N'ÉCRIT PLUS ─────────────────────────────────
//
// ⚠ CE GÉNÉRATEUR ÉCRASAIT `Shared/Index.lua`. C'était le défaut le plus
// destructeur du dépôt, et il a frappé DEUX FOIS le 2026-09-08.
//
// Il reconstruisait le fichier avec les catalogues générés plus TROIS lignes de
// logique recopiées en dur. L'auteur le savait — son commentaire disait
// « Écrite à la main, PAS générée : ne pas la perdre en régénérant les
// catalogues » — mais une liste recopiée diverge toujours de sa source. Le
// fichier porte **64 câblages** aujourd'hui : un `--apply` en détruisait 61.
//
// Et le prix était connu : le 2026-09-08, `Narvos.Mondes` non câblé a tué le
// serveur à la ligne 55 de `Server/Index.lua`. Pas de session, pas d'écran de
// création, pas de spawn, pas de ciel. **Une ligne manquante, six systèmes.**
//
// On ne génère donc plus ce fichier. On VÉRIFIE que chaque catalogue produit y
// est câblé, et on refuse en nommant les lignes exactes à ajouter. C'est
// non destructeur, et c'est impossible à manquer — un simple avertissement se
// serait perdu dans la sortie.

if (produits.length > 0) {
  const cheminIndex = path.join(PACKAGE, "Shared", "Index.lua");
  const actuel = fs.existsSync(cheminIndex) ? fs.readFileSync(cheminIndex, "utf8") : "";

  // ⚠ LES COMMENTAIRES SONT RETIRÉS AVANT DE CHERCHER.
  //
  // Première version : `actuel.includes(…)` sur le fichier brut. Elle laissait
  // passer une ligne COMMENTÉE — `-- Narvos.Talents = Package.Require(…)`
  // contient la sous-chaîne cherchée mot pour mot. Or une ligne commentée est
  // exactement l'état qui a tué le serveur le 2026-09-08 : le câblage est
  // visible à la lecture, et le moteur ne l'exécute pas.
  //
  // Un garde-fou qui accepte la forme désactivée du défaut qu'il surveille ne
  // garde rien. Trouvé en essayant de le faire ÉCHOUER — un contrôle qu'on n'a
  // jamais vu refuser n'est pas prouvé.
  const codeSeul = actuel.replace(/^\s*--.*$/gm, "");

  // On cherche la CHAÎNE, pas une expression régulière. Un nom de catalogue est
  // un identifiant simple : le construire en regex demanderait d'échapper les
  // points, et un échappement raté rendrait le contrôle toujours vert —
  // c'est-à-dire pire qu'absent.
  const absents = produits.filter(
    (p) => !codeSeul.includes(`Narvos.${p} = Package.Require("Catalogs/${p}.lua")`)
  );

  console.log("");
  if (absents.length === 0) {
    console.log(`  Index.lua  les ${produits.length} catalogue(s) produit(s) y sont tous cables.`);
  } else {
    console.error(`  ARRET : ${absents.length} catalogue(s) produit(s) ne sont PAS cables dans Shared/Index.lua.`);
    console.error("  Un catalogue non cable tue le serveur a la premiere ligne qui le lit.");
    console.error("");
    console.error("  Lignes a ajouter (avant `Package.Export`) :");
    for (const a of absents) {
      console.error(`    Narvos.${a} = Package.Require("Catalogs/${a}.lua")`);
    }
    console.error("");
    console.error("  Puis relancer : node scripts/lua-harness/cablage-check.mjs");
    process.exitCode = 1;
  }
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : ? ligne(s) attendue(s) ici, 41 connue(s)]
}

// ─── Package.toml ────────────────────────────────────────────────────────────
//
// Celui-ci est GÉNÉRÉ, mais seulement s'il n'existe pas encore — d'où le
// `if (!fs.existsSync)`. Contrairement à `Index.lua`, il ne porte rien qui soit
// écrit à la main après coup.
if (APPLY) {
  const tomlPath = path.join(PACKAGE, "Package.toml");
  if (!fs.existsSync(tomlPath)) {
    fs.writeFileSync(
      tomlPath,
      [
        "[meta]",
        '    title =                 "NARVOS PRIME"',
        '    author =                "aniss"',
        '    version =               "0.1.0"',
        "",
        "[script]",
        "    force_no_map_package =  false",
        "    auto_cleanup =          true",
        "    load_level_entities =   false",
        '    compatibility_version = "1.139"',
        "    packages_requirements = []",
        // Vide tant qu'aucun asset pack NARVOS n'est cuit. Déclarer un pack
        // absent fait échouer son chargement au démarrage du serveur
        // (« Failed to load Asset Pack ... Folder not found! ») : le package
        // Lua se charge quand même, mais l'erreur pollue la console et masque
        // les vraies. À remplir le jour où le pack existe.
        "    assets_requirements =   [\"narvos\"]",
        "    compatible_game_modes = []",
        "",
      ].join("\n"),
      "utf8",
    );
    console.log("  Package.toml  écrit");
  }
}

console.log("");
console.log(APPLY ? `${produits.length} catalogue(s) transpilé(s).` : "Rien écrit.");
// [ANCIENNE VERSION ↑]