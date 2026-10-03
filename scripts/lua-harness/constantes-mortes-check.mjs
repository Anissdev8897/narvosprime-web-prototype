import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// constantes-mortes-check.mjs — une CONSTANTE indexée mais jamais déclarée.
//
//   node scripts/lua-harness/constantes-mortes-check.mjs
//
// ── LE DÉFAUT QU'IL FERME ─────────────────────────────────────────────────────
// Le 2026-09-12, j'ai retiré la table `ARME_PAR_CLASSE` de `Logic/Character.lua`
// — l'arme posée d'office au spawn, que Hanibes voulait voir disparaître — et
// j'ai laissé la ligne qui la LIT, vingt lignes plus bas :
//
//     local arme = ARME_PAR_CLASSE[class_id]
//
// En Lua, lire un global inexistant rend `nil` ; l'INDEXER lève. Le serveur a
// donc démarré, puis est mort au premier spawn de PNJ :
//
//     Character.lua:158: attempt to index a nil value (global 'ARME_PAR_CLASSE')
//     in field 'ApplyClass' -> Spawn -> PoserArmurier
//
// Rien ne l'a vu : `portee-check` surveille les LOCALES employées avant leur
// déclaration, `syntaxe-check` compile, et aucun harnais n'appelle `ApplyClass`.
// Le défaut n'apparaissait qu'en jeu.
//
// ── POURQUOI CE CONTRÔLE EST VOLONTAIREMENT ÉTROIT ────────────────────────────
// Il ne juge QUE la forme qui lève : un nom en CAPITALES_SOULIGNÉES, INDEXÉ
// (`NOM[...]` ou `NOM.champ`), sans aucune déclaration dans le même fichier.
//
// Première version, le même jour : elle cherchait toute lecture de constante et
// nettoyait commentaires et chaînes à la main. Son nettoyage avalait les blocs
// `[[ ]]`, décalait les numéros de ligne, et elle a crié sur 18 constantes dont
// `SOL_Z` et `DEV_COMMANDES` — déclarées toutes les deux. Un garde qui crie à
// tort finit ignoré : c'est la raison d'être de cette version-ci, qui préfère
// RATER une détection plutôt qu'en inventer une.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages";

/** Fournies par Lua ou par le moteur. */
const FOURNIES = new Set(["_G", "_ENV", "_VERSION"]);

const fichiers = [];
(function descendre(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) descendre(p);
    else if (e.name.endsWith(".lua")) fichiers.push(p);
  }
})(RACINE);

/** Un nom de constante du projet : MAJUSCULES, au moins un souligné. */
const NOM = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+";

let morts = 0;
let examinees = 0;

for (const f of fichiers) {
  const brut = fs.readFileSync(f, "utf8");
  const lignes = brut.split("\n");

  // Les lectures qui LÈVENT : le nom suivi d'une indexation, hors commentaire.
  const lus = new Map(); // nom -> première ligne
  lignes.forEach((ligne, i) => {
    // Une ligne ENTIEREMENT en commentaire ne s execute pas. Le test explicite
    // vaut mieux que le retrait par expression : sur `-- il transpose
    // docs/UI_UMG_CONTRAT.md`, le retrait laissait passer le nom et le garde
    // criait sur une phrase de documentation.
    if (ligne.trimStart().startsWith("--")) return;
    const sansCommentaire = ligne.replace(/--.*$/, "");
    for (const m of sansCommentaire.matchAll(new RegExp(`\\b(${NOM})\\s*[\\[.]`, "g"))) {
      if (!lus.has(m[1])) lus.set(m[1], i + 1);
    }
  });

  for (const [nom, ligne] of lus) {
    if (FOURNIES.has(nom)) continue;
    examinees++;

    // Déclarée QUELQUE PART dans le fichier ? On cherche large — commentaires
    // compris — parce qu'un doute doit profiter au silence.
    const declaree =
      new RegExp(`\\blocal\\s+${nom}\\b`).test(brut) ||
      new RegExp(`\\b${nom}\\s*=`).test(brut) ||
      new RegExp(`[.:]${nom}\\b`).test(brut) ||
      new RegExp(`\\bfunction\\b[^\\n]*\\b${nom}\\b`).test(brut);

    if (!declaree) {
      morts++;
      const relatif = f.replace(/\\/g, "/").split("/packages/")[1] ?? f;
      console.log(`    MORTE   ${nom}`);
      console.log(`            ${relatif}:${ligne}`);
      console.log(`            indexee, jamais declaree ici — leve a l execution`);
      console.log(`            > ${(lignes[ligne - 1] || "").trim().slice(0, 110)}`);
    }
  }
}

console.log("");
console.log(`${fichiers.length} fichier(s) Lua, ${examinees} constante(s) indexee(s) examinee(s).`);
if (morts > 0) {
  console.log(`${morts} constante(s) indexee(s) SANS declaration — le jeu levera.`);
  process.exit(1);
}
console.log("Aucune constante morte.");