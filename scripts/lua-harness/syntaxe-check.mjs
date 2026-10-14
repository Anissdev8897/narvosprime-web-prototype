import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// syntaxe-check.mjs — chaque fichier Lua des packages COMPILE-t-il ?
//
//   node scripts/lua-harness/syntaxe-check.mjs
//
// `load` analyse sans exécuter : les appels à `Package.*`, `Database` ou `Events`
// n'ont donc pas besoin d'exister pour que la vérification passe. C'est
// exactement ce qu'on veut — on cherche des fautes de frappe, pas à jouer.
//
// POURQUOI : une erreur de syntaxe dans un package nanos ne se manifeste qu'au
// démarrage du serveur, noyée dans le log, et souvent bien après la ligne
// fautive. Deux secondes ici valent mieux qu'un redémarrage et une lecture de log.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const P = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages";

// ⚠ ON PARCOURT LE DISQUE, ON NE TIENT PLUS DE LISTE.
//
// La liste écrite à la main qui vivait ici avait le défaut de toutes les listes
// écrites à la main : un fichier ajouté et non inscrit n'était jamais vérifié.
// Le 2026-09-03, quatre modules serveur et trois catalogues sont entrés dans les
// packages ; le contrôle affichait « Tous les fichiers compilent » sans en avoir
// lu un seul.
//
// Le parcours a l'effet inverse : créer un fichier suffit à le faire vérifier.
const FICHIERS = (() => {
  const sortie = [];
  const parcourir = (rel) => {
    for (const e of fs.readdirSync(`${P}/${rel}`, { withFileTypes: true })) {
      const chemin = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { parcourir(chemin); continue; }
      if (e.name.endsWith(".lua")) sortie.push(chemin);
    }
  };
  parcourir("");
  return sortie.sort();
})();

const lua = await new LuaFactory().createEngine();

// La source passe par `global.set`, jamais par interpolation dans le script Lua :
// un fichier contenant `]]` ou des guillemets casserait toute mise en chaîne.
let ko = 0;

for (const f of FICHIERS) {
  const chemin = `${P}/${f}`;
  if (!fs.existsSync(chemin)) {
    console.log(`  ABSENT ${f}`);
    ko++;
    continue;
  }

  lua.global.set("SRC", fs.readFileSync(chemin, "utf8"));
  lua.global.set("NOM", f);
  lua.global.set("OK", true);

  await lua.doString(`
    local fn, err = load(SRC, NOM)
    if (fn) then
      print(string.format("  OK      %s", NOM))
    else
      print(string.format("  ERREUR  %s", NOM))
      print("      " .. tostring(err))
      OK = false
    end
  `);

  if (lua.global.get("OK") === false) ko++;
}

lua.global.close();

console.log("");
console.log(ko === 0 ? "Tous les fichiers compilent." : `${ko} fichier(s) en erreur.`);
process.exitCode = ko === 0 ? 0 : 1;

// ══════════════════════════════════════════════════════════════════════════════
// Contrôle supplémentaire : les GÉNÉRATEURS compilent-ils ?
//
// ⚠ TROIS FOIS le 2026-09-04, un backtick glissé dans le texte Lua d'un
// générateur a terminé son template literal et cassé le script. Le symptôme est
// trompeur : `--apply` échoue, mais si sa sortie est masquée on croit avoir
// régénéré le catalogue alors qu'on lit l'ancien.
//
// `node --check` coûte quelques millisecondes et rend cette panne impossible à
// livrer.
// ══════════════════════════════════════════════════════════════════════════════

// `fs` est deja importe en tete de fichier ; `path` ne l'etait pas. Ce controle
// vient en complement du precedent, il ne se relance pas seul.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS = RACINE_DEPOT + "/scripts";

// ⚠ LES HARNAIS AUSSI. La quatrieme occurrence du meme defaut, le 2026-09-04,
// n'etait pas dans un generateur mais dans parcours.mjs et roster.mjs : un
// commentaire ajoute dans le script Lua contenait des backticks, qui ont termine
// le template literal. Le controle ci-dessus ne les regardait pas, parce qu'ils
// ne s'appellent pas narvos-*. Un garde-fou qui ne couvre que l'endroit ou la
// panne s'est produite la premiere fois ne garde rien.
const HARNAIS = path.dirname(fileURLToPath(import.meta.url));

const generateurs = [
  ...fs.readdirSync(SCRIPTS)
    .filter((f) => f.endsWith(".mjs") && f.startsWith("narvos-"))
    .map((f) => path.join(SCRIPTS, f)),
  ...fs.readdirSync(HARNAIS)
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => path.join(HARNAIS, f)),
];

let casses = 0;
for (const g of generateurs) {
  try {
    execFileSync(process.execPath, ["--check", g], { stdio: "pipe" });
  } catch (e) {
    casses++;
    const msg = String(e.stderr || e.message).split("\n").slice(0, 3).join(" ");
    console.log(`  CASSE   ${path.basename(g)} — ${msg}`);
  }
}

console.log("");
if (casses > 0) {
  console.log(`${casses} generateur(s) ne compilent pas.`);
  process.exitCode = 1;
} else {
  console.log(`${generateurs.length} generateur(s) compilent.`);
}