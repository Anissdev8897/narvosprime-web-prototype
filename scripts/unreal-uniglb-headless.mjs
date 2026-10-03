#!/usr/bin/env node
/**
 * Rend UniGLB pilotable sans interface (import en commandlet).
 *
 * UniGLB est un importateur d'editeur : son chemin d'import touche Slate a
 * quatre endroits — fenetre d'options, barre de progression, ouverture d'un
 * editeur pour rafraichir une vignette, synchronisation du Content Browser.
 * En commandlet il n'existe pas d'application Slate : chacun de ces appels
 * declenche une assertion.
 *
 * Aucun de ces appels ne participe a la conversion : ce sont des retours
 * visuels. On les conditionne donc a `!IsRunningCommandlet()`, ce qui laisse
 * le comportement interactif rigoureusement identique.
 *
 * S'y ajoute l'exposition des drapeaux d'import : `UPROPERTY(Transient)` seul
 * inscrit la propriete au systeme de reflexion mais ne l'expose ni a Python ni
 * au Blueprint. Sans `EditAnywhere`, un script ne peut pas supprimer la fenetre
 * d'options, donc pas importer sans interface.
 *
 * Les motifs couvrent UniGLB 1.0 et 1.1 (noms de fichiers et libelles differents).
 *
 * Simulation par defaut ; `--apply` ecrit, en laissant un .orig par fichier.
 *
 * Usage :
 *   node scripts/unreal-uniglb-headless.mjs <racine-UniGLB> [--apply]
 */

import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
const APPLY = process.argv.includes("--apply");

if (!root || !fs.existsSync(root)) {
  console.error("Usage : node scripts/unreal-uniglb-headless.mjs <racine-UniGLB> [--apply]");
  process.exit(1);
}

/**
 * Chaque regle cible un fichier par nom de base (les deux versions d'UniGLB
 * n'utilisent pas les memes) et transforme le texte par expression reguliere.
 */
const RULES = [
  {
    nom: "exposer les drapeaux d'import a Python",
    fichiers: ["UniGLBImporterFactory.h", "VrmImporterFactory.h"],
    // Transient seul = reflechi mais non expose. EditAnywhere le rend
    // atteignable par set_editor_property.
    motif: /UPROPERTY\(Transient\)/g,
    remplacement: 'UPROPERTY(Transient, EditAnywhere, BlueprintReadWrite, Category = "UniGLB")',
  },
  {
    nom: "barre de progression conditionnelle",
    fichiers: ["UniGLBImporterFactory.cpp", "VrmImporterFactory.cpp"],
    // Le second argument de BeginSlowTask demande la fenetre de progression.
    motif: /(GWarn->BeginSlowTask\(\s*NSLOCTEXT\([^)]*\)[^,]*,\s*)true(\s*\))/g,
    remplacement: "$1!IsRunningCommandlet()$2",
  },
  {
    nom: "pas d'ouverture d'editeur pour la vignette",
    fichiers: ["UniGLBImporterFactory.cpp", "VrmImporterFactory.cpp"],
    // Ouvrir puis refermer un editeur d'asset juste pour la vignette.
    motif: /(\/\/ for thumbnail update\s*\n\s*)if \(GEditor\)\s*\{/g,
    remplacement: "$1if (GEditor && !IsRunningCommandlet()){",
  },
  {
    // On vise les DEUX appels de synchronisation, pas le `if` qui les entoure :
    // ce meme `if (IsImportMode())` protege ailleurs des `PostEditChange()`,
    // qui sont de la logique d'import et doivent absolument continuer a
    // s'executer en commandlet. Garder le bloc entier casserait les assets.
    nom: "pas de synchronisation du Content Browser",
    fichiers: ["UniGLB_LoaderBPFunctionLibrary.cpp", "LoaderBPFunctionLibrary.cpp"],
    motif: /(\s*)(ContentBrowserModule\.Get\(\)\.(?:SyncBrowserToFolders|SetSelectedPaths)\([^;]*\);)/g,
    remplacement: "$1if (!IsRunningCommandlet()) { $2 }",
  },
];

const walk = (dir, acc = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "Intermediate" || entry.name === "Binaries") continue;
      walk(path.join(dir, entry.name), acc);
    } else acc.push(path.join(dir, entry.name));
  }
  return acc;
};

const fichiers = walk(root);
let totalRemplacements = 0;

for (const regle of RULES) {
  const cibles = fichiers.filter((f) => regle.fichiers.includes(path.basename(f)));
  if (cibles.length === 0) {
    console.log(`  IGNORE  ${regle.nom} — aucun fichier ${regle.fichiers.join(" / ")}`);
    continue;
  }

  for (const fichier of cibles) {
    const avant = fs.readFileSync(fichier, "utf8");
    // On compte a part : String.replace gere `$1` nativement pour une chaine,
    // et passe les groupes a une fonction. Inutile de reimplementer l'un ou
    // l'autre — il suffit de compter les correspondances d'abord.
    const compte = (avant.match(regle.motif) || []).length;
    const apres = avant.replace(regle.motif, regle.remplacement);

    if (compte === 0) {
      console.log(`  0       ${regle.nom} — ${path.basename(fichier)} (motif absent)`);
      continue;
    }

    totalRemplacements += compte;
    console.log(`  ${String(compte).padStart(2)}      ${regle.nom} — ${path.basename(fichier)}`);

    if (APPLY) {
      const sauvegarde = `${fichier}.orig`;
      if (!fs.existsSync(sauvegarde)) fs.copyFileSync(fichier, sauvegarde);
      fs.writeFileSync(fichier, apres, "utf8");
    }
  }
}

console.log("");
console.log(
  `${APPLY ? "APPLIQUE" : "SIMULATION (ajouter --apply)"} : ${totalRemplacements} remplacement(s)`,
);