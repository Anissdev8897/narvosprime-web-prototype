// ══════════════════════════════════════════════════════════════════════════════
// appels-distants-check.mjs — un appel distant sans sa fiabilité perd sa charge.
//
//   node scripts/lua-harness/appels-distants-check.mjs
//
// Signatures relevées dans l'API (libraries/api-main/.../StaticClasses/Events.json) :
//   serveur  Events.CallRemote(event_name, player, reliability, args...)
//   client   Events.CallRemote(event_name, reliability, args...)
//   serveur  Events.BroadcastRemote(event_name, reliability, args...)
//
// La fiabilité a une valeur par défaut, mais elle est POSITIONNELLE : écrire
// `CallRemote("Narvos:AtelierErreur", player, "recette inconnue")` passe le
// message comme fiabilité. Rien ne lève ; le client reçoit la raison à nil.
// Mesuré le 2026-09-11 : 21 appels dans Server/Index.lua (erreurs d'atelier,
// de gisement, de boutique, fin de dialogue).
//
// Ce garde refuse la FORME : tout appel qui porte une charge sans poser
// `Reliability.<x>` à sa place. Shared/ est exclu : la logique pure n'appelle
// pas le réseau.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const PKG = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages";

function luaDe(dossier) {
  const sortie = [];
  (function descendre(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) descendre(p);
      else if (e.name.endsWith(".lua")) sortie.push(p);
    }
  })(dossier);
  return sortie;
}

/** Vrai si la position `k` suit un `--` hors chaîne sur sa ligne : un appel
 *  commenté n'est pas un appel. */
function dansCommentaire(t, k) {
  let chaine = null;
  for (let j = t.lastIndexOf("\n", k) + 1; j < k; j++) {
    const c = t[j];
    if (chaine) { if (c === "\\") { j++; continue; } if (c === chaine) chaine = null; continue; }
    if (c === '"' || c === "'") { chaine = c; continue; }
    if (t.startsWith("--", j)) return true;
  }
  return false;
}

/** Arguments de premier niveau d'un appel dont `debut` suit la parenthèse.
 *  ⚠ Saute les commentaires `--` : une apostrophe dans « -- l'état » ouvrait
 *  une fausse chaîne et faisait perdre le compte des parenthèses (vu le
 *  2026-09-11 sur le correctif qui a précédé ce garde). */
function argumentsDe(t, debut) {
  let prof = 1, cur = debut, chaine = null;
  const args = [];
  for (let j = debut; j < t.length; j++) {
    const c = t[j];
    if (chaine) { if (c === "\\") { j++; continue; } if (c === chaine) chaine = null; continue; }
    if (t.startsWith("--", j)) { const f = t.indexOf("\n", j); j = f < 0 ? t.length : f; continue; }
    if (c === '"' || c === "'") { chaine = c; continue; }
    if ("({[".includes(c)) prof++;
    else if (")}]".includes(c)) {
      prof--;
      if (prof === 0) { args.push(t.slice(cur, j).trim()); return args; }
    } else if (c === "," && prof === 1) { args.push(t.slice(cur, j).trim()); cur = j + 1; }
  }
  return args;
}

let examines = 0;
const fautes = [];
for (const fichier of luaDe(PKG)) {
  const rel = path.relative(PKG, fichier).replace(/\\/g, "/");
  if (rel.includes("/Shared/")) continue;
  const cote = rel.includes("/Client/") ? "client" : rel.includes("/Server/") ? "serveur" : null;
  if (!cote) continue;
  const t = fs.readFileSync(fichier, "utf8");
  for (const [motif, rang] of [["Events.CallRemote(", cote === "client" ? 1 : 2], ["Events.BroadcastRemote(", 1]]) {
    let i = 0;
    for (;;) {
      const k = t.indexOf(motif, i);
      if (k < 0) break;
      i = k + motif.length;
      if (dansCommentaire(t, k)) continue;
      const args = argumentsDe(t, i);
      if (args.length <= rang) continue;          // aucune charge : défaut sans risque
      examines++;
      if (!args[rang].startsWith("Reliability.")) {
        const ligne = t.slice(0, k).split("\n").length;
        fautes.push(`${rel}:${ligne}  ${args[0]}  ← « ${args[rang].slice(0, 40)} » à la place de la fiabilité`);
      }
    }
  }
}

if (examines === 0) {
  console.error("ROUGE : aucun appel distant examiné — le motif ne correspond plus au code.");
  process.exit(1);
}
if (fautes.length > 0) {
  for (const f of fautes) console.log("  ECHEC  " + f);
  console.log(`${examines - fautes.length} réussi(s), ${fautes.length} echec(s)`);
  process.exit(1);
}
console.log(`${examines} réussi(s) — tout appel distant porteur d'une charge pose sa fiabilité.`);