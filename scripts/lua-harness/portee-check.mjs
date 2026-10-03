// ══════════════════════════════════════════════════════════════════════════════
// portee-check.mjs — un nom est-il employé AVANT sa déclaration `local` ?
//
//   node scripts/lua-harness/portee-check.mjs
//
// ── LE BUG QUE ÇA ATTRAPE ─────────────────────────────────────────────────────
// En Lua, `local X` ne crée le local qu'À PARTIR DE SA LIGNE. Une fonction
// compilée plus haut qui écrit `X` ne capture donc pas ce local : elle résout le
// nom comme une GLOBALE, c'est-à-dire `nil`.
//
// Rien ne le signale. Le fichier compile, le package charge, et l'appel échoue
// des minutes plus tard — quand le joueur appuie sur la touche.
//
// Rencontré CINQ fois dans une seule session sur `Client/Index.lua` :
//
//   | symptôme observé              | cause                                    |
//   |-------------------------------|------------------------------------------|
//   | aucun aperçu 3D, jamais       | `SessionDans` appelée 9 lignes avant     |
//   | entrer en jeu plante          | `DetruireApercu` appelée 48 lignes avant |
//   | F3 et molette lèvent          | `CreationOuverte` déclarée 50 lignes après |
//   | plantage à la déconnexion     | `arme_suivante` déclarée 600 lignes après |
//   | un menu ouvert ne bloque rien | `panneau` déclaré après le répartiteur   |
//
// ⚠ `syntaxe-check.mjs` NE L'ATTRAPE PAS : `load()` valide la grammaire, pas la
// portée. Les deux contrôles sont complémentaires.
//
// ── CE QUE CE CONTRÔLE NE PROMET PAS ──────────────────────────────────────────
// C'est une analyse TEXTUELLE, pas un interpréteur. Elle ne regarde que les
// `local` de premier niveau (colonne 0) : un local dans une fonction a sa propre
// portée et ne se compare pas à ce qui l'entoure.
//
// Elle peut donc signaler un faux positif — un paramètre ou un local imbriqué
// qui porte le même nom. C'est le compromis voulu : un faux positif se lit en
// dix secondes, le bug qu'il cherche coûte une session.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const P = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages";

const FICHIERS = (() => {
  const sortie = [];
  const parcourir = (rel) => {
    for (const e of fs.readdirSync(`${P}/${rel}`, { withFileTypes: true })) {
      const chemin = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { parcourir(chemin); continue; }
      // Les catalogues sont GÉNÉRÉS et n'ont pas de fonctions croisées :
      // les analyser n'apporterait que du bruit sur des milliers de lignes.
      if (e.name.endsWith(".lua") && !chemin.includes("/Catalogs/")) sortie.push(chemin);
    }
  };
  parcourir("");
  return sortie.sort();
})();

/** Retire commentaires et chaînes d'une ligne, pour ne comparer que du code.
 *
 *  ⚠ LE `\r` D'ABORD, ET C'EST LE PIÈGE. Les fichiers du dépôt sont en CRLF, et
 *  en JavaScript `.` ne franchit AUCUN terminateur de ligne — `\r` compris. Le
 *  motif `/--.*$/` s'arrêtait donc avant le `\r` tandis que `$` exigeait la fin
 *  de chaîne, située APRÈS : plus aucun commentaire n'était retiré, et les 23
 *  premières alertes de ce contrôle étaient toutes de faux positifs pris dans
 *  des phrases françaises. */
function nu(ligne) {
  return ligne
    .replace(/\r+$/, "")
    .replace(/--\[\[[\s\S]*?\]\]/g, " ")
    .replace(/--.*$/, " ")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

let signales = 0;
let examines = 0;

for (const f of FICHIERS) {
  const lignes = fs.readFileSync(path.join(P, f), "utf8").split("\n");
  const code = lignes.map(nu);

  // Déclarations `local` de PREMIER NIVEAU seulement : colonne 0, pas d'indentation.
  const declarations = new Map();
  code.forEach((l, i) => {
    const m = l.match(/^local(?:\s+function)?\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (!m) return;
    // La PREMIÈRE déclaration fait foi : une seconde plus bas est un autre
    // problème (ombrage), que ce contrôle ne traite pas.
    if (!declarations.has(m[1])) declarations.set(m[1], i);
  });

  examines += declarations.size;

  for (const [nom, ligneDecl] of declarations) {
    const motif = new RegExp(`\\b${nom}\\b`);
    for (let i = 0; i < ligneDecl; i++) {
      const l = code[i];
      if (!motif.test(l)) continue;

      // Une déclaration avancée assignée plus bas est le REMÈDE, pas le bug :
      // `local X` en tête puis `X = function()`. On ne signale donc que les
      // emplois situés avant la PREMIÈRE déclaration du nom.
      console.log(`  ${f}`);
      console.log(`      ${nom} employe ligne ${i + 1}, declare ligne ${ligneDecl + 1}`);
      console.log(`      ${lignes[i].trim().slice(0, 96)}`);
      signales++;
      break;
    }
  }
}

console.log("");
console.log(`${examines} declaration(s) de premier niveau examinee(s) dans ${FICHIERS.length} fichier(s).`);

if (signales === 0) {
  console.log("Aucun emploi avant declaration.");
} else {
  console.log(`${signales} cas a verifier — un nom employe avant son \`local\` vaut nil, SANS erreur.`);
  process.exitCode = 1;
}