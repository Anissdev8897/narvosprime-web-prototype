// ══════════════════════════════════════════════════════════════════════════════
// tout.mjs — lance TOUTE la batterie, et rend un seul verdict.
//
//   node scripts/lua-harness/tout.mjs
//
// ── POURQUOI ──────────────────────────────────────────────────────────────────
// Il n'existait aucune commande pour tout lancer. On lançait donc les harnais
// qu'on avait en tête, et la règle « lancer TOUTE la batterie » n'était qu'une
// intention. Le 2026-09-09, quatre harnais étaient ROUGES pendant qu'on
// annonçait « 9 verts » — un sous-ensemble, choisi de mémoire.
//
// Une règle sans commande n'est pas un garde-fou, c'est un souhait.
//
// ── CE QU'IL EXCLUT, ET POURQUOI ──────────────────────────────────────────────
// Les générateurs et les outils de mesure vivent dans le même dossier mais ne
// répondent pas « vert / rouge » : les lancer produirait du bruit et des sorties
// non nulles qui ne veulent rien dire. La liste est EXPLICITE ci-dessous — un
// filtre par motif de nom se serait trompé au premier fichier bien nommé.
// ══════════════════════════════════════════════════════════════════════════════

import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "../..");

const HORS = new Set([
  "tout.mjs",                 // lui-même
  "arenas-gen.mjs",           // génère des arènes
  "generateur-cartes.mjs",    // génère des cartes
  "pnj-clips-mesure.mjs",     // mesure, ne juge pas
  "pnj-squelettes.mjs",       // idem
  "distance-optim.mjs",       // idem
  "syntax2.mjs",              // doublon expérimental de syntaxe-check
  "assemblage-visuel.mjs",    // capture des PNG, ne juge pas — exige Chrome
]);

const fichiers = readdirSync(ICI)
  .filter((f) => f.endsWith(".mjs") && !HORS.has(f))
  .sort();

const rouges = [];
let reussis = 0;
let echecs = 0;

for (const f of fichiers) {
  let code = 0;
  let sortie = "";
  try {
    sortie = execFileSync(process.execPath, [path.join(ICI, f)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 300000,
      cwd: RACINE,
    });
  } catch (e) {
    code = e.status ?? 1;
    sortie = (e.stdout || "") + (e.stderr || "");
  }

  // Les harnais ne parlent pas tous pareil. Relevé dans les .lua :
  //   « 131 reussis, 0 echec(s) »   « 12 reussi(s), 0 echec(s) »
  //   « 67 reussis, 0 echoue(s) »   et les accents selon les fichiers.
  // ⚠ Un premier motif exigeait « reussis » au pluriel nu : il ratait
  // « reussi(s) » et sous-comptait SANS RIEN DIRE — un compteur faux est pire
  // qu'aucun compteur, il rassure. Le motif s'arrête donc à la racine.
  // ⚠ Récidive du 2026-09-15 : « 46 assertion(s) reussie(s) » (reapparition,
  // zaaps, zaaps-serveur, metacustom) n'était PAS compté — le nombre y précède
  // « assertion(s) », pas la racine. Le mot intercalé est donc accepté.
  for (const m of sortie.matchAll(/(\d+)\s+(?:assertion\(s\)\s+)?r[eé]ussi/gi)) reussis += Number(m[1]);
  for (const m of sortie.matchAll(/(\d+)\s+echec|(\d+)\s+echoue/gi)) {
    echecs += Number(m[1] ?? m[2] ?? 0);
  }

  console.log(`${code === 0 ? "vert " : "ROUGE"} ${f}`);
  if (code !== 0) rouges.push({ f, code, sortie: sortie.slice(-2000) });
}

console.log(
  `\n${fichiers.length} harnais · ${reussis} assertion(s) réussie(s) · ` +
    `${echecs} échec(s) déclaré(s) · ${rouges.length} harnais ROUGE(S)`
);

for (const r of rouges) {
  console.error(`\n───── ${r.f} (code ${r.code}) ─────\n${r.sortie}`);
}

// ⚠ Un harnais peut sortir 0 en n'ayant rien vérifié. Le compte d'assertions est
// là pour ça : s'il s'effondre d'une session à l'autre alors que tout est
// « vert », c'est qu'un harnais s'est tu.
if (reussis === 0) {
  console.error("\nROUGE : zéro assertion comptée — le format de sortie a changé.");
  process.exit(1);
}

process.exit(rouges.length === 0 ? 0 : 1);