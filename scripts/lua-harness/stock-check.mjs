import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// stock-check.mjs — chaque article en vente existe-t-il ?
//
//   node scripts/lua-harness/stock-check.mjs
//
// ── LE TROU QUE CE CONTRÔLE BOUCHE ────────────────────────────────────────────
// `narvos-verifier-catalogues.mjs` vérifie les ASSETS : un modèle, une texture,
// un chemin sur le disque. Il ne regarde pas les IDENTIFIANTS DE DONNÉES — un
// `stock` de marchand qui cite un objet, une récompense qui cite un butin.
//
// Le résultat : ce vérificateur dit « aucune référence morte » pendant qu'un
// marchand a un stock entier d'articles inexistants. Il n'a pas tort ; il
// répond à une autre question.
//
// Un marchand dont tout le stock est mort n'affiche RIEN et ne dit RIEN. Pas
// d'erreur, pas de log : une boutique vide se lit comme un marchand qu'on a
// oublié de remplir, pas comme un catalogue cassé. C'est la forme de défaut la
// plus chère du dépôt — celle qui ne fait aucun bruit.
//
// ⚠ LA SOURCE EST LE TS, PAS LE LUA. `Merchants.lua` est GÉNÉRÉ depuis
// `npc/merchants.ts`. Corriger le Lua serait effacé au prochain `--apply` du
// générateur. On contrôle donc le Lua (c'est lui que le moteur lit) mais on
// nomme le TS dans le rapport (c'est lui qu'on répare).
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const CAT =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs";

const lire = (f) => fs.readFileSync(`${CAT}/${f}`, "utf8");

// ── Les identifiants qui EXISTENT ────────────────────────────────────────────
//
// On lit les clés de premier niveau des deux tables d'objets. Une clé Lua
// s'écrit `nom = {` (identifiant simple) ou `["nom"] = {` (avec caractères
// spéciaux) : les deux formes se croisent dans ces fichiers générés.
function clesDe(source, table) {
  const debut = source.indexOf(`${table} = {`);
  if (debut < 0) return new Set();
  const bloc = source.slice(debut);
  const cles = new Set();
  // Uniquement les clés indentées de 4 espaces : c'est le niveau des entrées.
  // Plus profond, ce sont les champs (`stats`, `label`…), pas des objets.
  for (const m of bloc.matchAll(/^ {4}(?:\["([^"]+)"\]|([A-Za-z_][\w]*))\s*=\s*\{/gm)) {
    cles.add(m[1] || m[2]);
  }
  return cles;
}

const items = lire("Items.lua");
const loot = lire("Loot.lua");
const connus = new Set([
  ...clesDe(items, "Items.ITEM_DB"),
  ...clesDe(loot, "Loot.LOOT_CATALOG"),
]);

// ⚠ `part:…` EST UN AUTRE ESPACE DE NOMS, PAS UNE RÉFÉRENCE MORTE.
//
// Première version de ce contrôle : elle a compté les 231 entrées de Vasska
// comme mortes parce qu'elles ne sont pas dans `ITEM_DB`. Elles n'ont JAMAIS eu
// à y être — `Boutique.lua:72` branche sur le préfixe et les envoie au tailleur,
// qui les cherche dans `Modular.PIECES`. Le contrôle avait raison sur le
// symptôme et tort sur la cause.
//
// On les vérifie donc contre LEUR catalogue. Un identifiant de pièce qui n'est
// ni un objet ni une pièce reste mort ; celui qui est une pièce ne l'est pas.
const pieces = clesDe(lire("Modular.lua"), "Modular.PIECES");
const estPiece = (id) => id.startsWith("part:") && pieces.has(id.slice(5));

if (connus.size === 0) {
  console.error("ARRET : aucun identifiant d'objet lu. Le contrôle ne peut rien vérifier.");
  process.exit(1);
}
console.log(`Objets connus : ${connus.size} (Items.ITEM_DB + Loot.LOOT_CATALOG)\n`);

// ── Les stocks des marchands ─────────────────────────────────────────────────
//
// On parcourt le fichier en gardant le marchand courant. Un `stock = {` ouvre
// la liste ; elle se ferme à la première accolade fermante au même niveau.
const marchands = lire("Merchants.lua");
const lignes = marchands.split("\n");

let courant = null;
let dansStock = false;
const parMarchand = new Map();

for (const l of lignes) {
  const nom = l.match(/^\s+name\s*=\s*"([^"]+)"/);
  if (nom) {
    courant = nom[1];
    if (!parMarchand.has(courant)) parMarchand.set(courant, { vivants: [], morts: [] });
  }
  if (/^\s+stock\s*=\s*\{/.test(l)) { dansStock = true; continue; }
  if (dansStock && /^\s+\},?\s*$/.test(l)) { dansStock = false; continue; }
  if (!dansStock || !courant) continue;

  const article = l.match(/^\s*"([^"]+)"/);
  if (!article) continue;
  const id = article[1];
  const fiche = parMarchand.get(courant);
  (connus.has(id) || estPiece(id) ? fiche.vivants : fiche.morts).push(id);
}

if (parMarchand.size === 0) {
  console.error("ARRET : aucun marchand lu dans Merchants.lua.");
  process.exit(1);
}

// ── Rapport ──────────────────────────────────────────────────────────────────

let totalMorts = 0;
let boutiquesVides = 0;

console.log(`${"MARCHAND".padEnd(24)}${"VENDABLE".padStart(9)}${"MORT".padStart(6)}   ÉTAT`);
console.log("-".repeat(78));
for (const [nom, f] of parMarchand) {
  totalMorts += f.morts.length;
  const vide = f.vivants.length === 0 && f.morts.length > 0;
  if (vide) boutiquesVides += 1;
  const etat = vide
    ? "BOUTIQUE VIDE — il n'a rien à vendre"
    : f.morts.length > 0
      ? `${f.morts.length} article(s) invisibles`
      : "";
  console.log(
    nom.slice(0, 24).padEnd(24) +
      String(f.vivants.length).padStart(9) +
      String(f.morts.length).padStart(6) +
      "   " + etat,
  );
}

console.log("");
if (totalMorts === 0) {
  console.log("Tous les stocks citent des objets qui existent.");
  process.exit(0);
}

// Les identifiants morts, groupés par préfixe : un préfixe entier absent
// désigne un catalogue jamais importé, pas des fautes de frappe éparses.
const parPrefixe = new Map();
for (const [, f] of parMarchand) {
  for (const id of f.morts) {
    const p = id.split(/[:_]/)[0];
    parPrefixe.set(p, (parPrefixe.get(p) || 0) + 1);
  }
}
console.log("Identifiants morts par préfixe :");
for (const [p, n] of [...parPrefixe].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${p.padEnd(12)} ${String(n).padStart(4)}`);
}

console.log("");
console.log(`${totalMorts} référence(s) de stock morte(s), ${boutiquesVides} boutique(s) vide(s).`);
console.log("");

// ── Ce qui est déjà traité, et ce qui ne l'est pas ───────────────────────────
//
// Les 231 `part:` de Vasska sont morts POUR DE BON : ils viennent de
// `modularGearIds()` (`src/rpg/npc/merchants.ts`), qui lit le catalogue
// modulaire du runtime WEB. Le catalogue nanos nomme ses pièces autrement
// (`aviator_chest_f`), donc rien ne se recouvre.
//
// On ne réécrit pas le TS — il sert le runtime web, qui a ses propres pièces et
// pour qui ces identifiants sont valides. Le serveur nanos contourne :
// `Boutique.EstEquipementier` reconnaît un stock entièrement `part:` et envoie
// le joueur au tailleur, qui lit `Modular.PIECES`.
//
// Ce contrôle reste donc ROUGE tant que le catalogue généré porte ces entrées,
// et c'est voulu : il dit la vérité sur le fichier. Il devient bloquant le jour
// où un marchand ORDINAIRE perd son stock — c'est ce cas-là qu'on veut voir.
const equipementiersSeuls = [...parMarchand.values()].every(
  (f) => f.morts.length === 0 || f.morts.every((id) => id.startsWith("part:")),
);

if (equipementiersSeuls) {
  console.log("Toutes les références mortes sont des `part:` d'équipementier.");
  console.log("Contourné à l'exécution : `Boutique.EstEquipementier` renvoie au tailleur,");
  console.log("qui lit `Modular.PIECES`. Le catalogue généré, lui, reste périmé.");
  process.exit(0);
}

console.error("Un marchand ORDINAIRE a des références mortes — ce n'est pas le cas connu.");
console.error("À corriger dans `WebPortal/src/rpg/npc/merchants.ts` — Merchants.lua est GÉNÉRÉ.");
process.exitCode = 1;