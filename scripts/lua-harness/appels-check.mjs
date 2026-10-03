import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// appels-check.mjs — quelles fonctions publiques ne sont JAMAIS appelées ?
//
//   node scripts/lua-harness/appels-check.mjs
//
// ── POURQUOI CE HARNAIS EXISTE ────────────────────────────────────────────────
// `cablage-check.mjs` répond à « le module est-il branché ». Celui-ci répond à la
// question du dessus : **est-il déclenché ?**
//
// Le 2026-09-08, une fois le câblage réparé, le serveur a démarré propre — 6
// portails posés, 4 classes, 2 784 animations, zéro erreur Lua. Et pourtant, en
// jeu : aucun marchand, aucun peuplement. Mesuré :
//
//   Peuplement.Charger(liste, decalage)   défini · AUCUN appel dans Index.lua
//   Narvos.Merchants                      catalogue câblé · zéro ligne qui spawne
//   SurKillJoueur(player, folder)         défini ligne 857 · appelé nulle part
//
// Un module chargé que personne n'appelle ne lève rien, ne loge rien, et coûte
// exactement zéro milliseconde. C'est le défaut le plus discret du dépôt : il
// n'a aucun symptôme technique, seulement un manque en jeu.
//
// ⚠ CE CONTRÔLE N'EST PAS BLOQUANT, et c'est délibéré. Beaucoup de fonctions
// publiques sont là pour les harnais, pour une commande admin, ou pour un
// chantier à venir. Un contrôle qui échoue sur du travail légitime ne serait pas
// relu. Il RAPPORTE, trié par vraisemblance, et c'est à la lecture de trancher.
//
// Ce qu'il classe en PROBABLE : une fonction d'un module `Server/` ou d'un
// module de logique qui n'est appelée QUE dans son propre fichier. Personne
// d'autre ne s'en sert — soit c'est un exécutant oublié, soit c'est du privé
// qui devrait être `local`.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages";

function luaFiles(dir, sortie = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) luaFiles(p, sortie);
    else if (e.name.endsWith(".lua")) sortie.push(p.replace(/\\/g, "/"));
  }
  return sortie;
}

const sansCommentaire = (l) => {
  const i = l.indexOf("--");
  return i < 0 ? l : l.slice(0, i);
};

const fichiers = luaFiles(RACINE);
const source = new Map();   // rel -> lignes sans commentaire
for (const f of fichiers) {
  source.set(
    f.replace(`${RACINE}/`, ""),
    fs.readFileSync(f, "utf8").split("\n").map(sansCommentaire)
  );
}

// ── Les fonctions publiques déclarées : `function Module.Nom(` ───────────────

const declarees = [];
for (const [rel, lignes] of source) {
  lignes.forEach((l, i) => {
    const m = /^\s*function\s+(\w+)[.:](\w+)\s*\(/.exec(l);
    if (m) declarees.push({ module: m[1], nom: m[2], rel, ligne: i + 1 });
  });
}

// ── Où chaque nom est-il appelé ? ────────────────────────────────────────────

/**
 * Fichiers (hors celui de déclaration) qui appellent RÉELLEMENT `Module.Nom(`.
 *
 * ⚠ LE NOM SEUL NE SUFFIT PAS, et le premier jet de ce contrôle s'y est fait
 * prendre : il cherchait `[.:]Charger\s*\(` et trouvait `Dialogue.Charger` et
 * `Quetes.Charger`. Il déclarait donc `Peuplement.Charger` appelée — alors
 * qu'elle ne l'est nulle part, et que c'est précisément le défaut qui laisse
 * la map vide de PNJ.
 *
 * On n'accepte un appel que si le RÉCEPTEUR peut être ce module :
 *   · `Peuplement.Charger(`  — le module par son nom
 *   · un alias local du fichier appelant, `local Combat = Narvos.Combat`
 *     puis `Combat.Charger(` — c'est la forme courante ici, chaque exécutant
 *     commence par capturer ses dépendances.
 *
 * Un `local X = Package.Require(...)` est accepté sans plus d'analyse : on ne
 * peut pas savoir quel module il ramène sans résoudre le chemin, et un faux
 * NÉGATIF (rater un appel réel) coûte moins qu'un faux positif qui envoie
 * brancher ce qui l'est déjà.
 */
function appelsAilleurs(nom, relDecl, moduleDecl) {
  const out = [];
  for (const [rel, lignes] of source) {
    if (rel === relDecl) continue;

    const alias = new Set([moduleDecl]);
    for (const l of lignes) {
      const m = /^\s*local\s+(\w+)\s*=\s*(?:Narvos\.)?(\w+)\s*$/.exec(l.trim());
      if (m && m[2] === moduleDecl) alias.add(m[1]);
      const m2 = /^\s*local\s+(\w+)\s*=\s*Package\.Require\(/.exec(l);
      if (m2) alias.add(m2[1]);
    }

    // ⚠ DEUX FORMES, et oublier la seconde produit un FAUX POSITIF.
    //   `VoyageServeur.Diagnostic()`         appel direct
    //   `Narvos.VoyageServeur.Diagnostic()`  via la table globale
    // Le premier jet n'acceptait que la première : son lookbehind `(?<![\w.])`
    // rejetait le point de `Narvos.`, et il annonçait `Diagnostic` jamais
    // appelée alors qu'elle l'est à `Server/Index.lua:458`. Un garde-fou qui
    // envoie corriger ce qui marche coûte plus qu'une absence de garde-fou.
    let vu = false;
    for (const l of lignes) {
      for (const a of alias) {
        const direct = new RegExp(`(?<![\\w.])${a}\\.${nom}\\s*\\(`);
        const parNarvos = new RegExp(`(?<![\\w.])Narvos\\.${a}\\.${nom}\\s*\\(`);
        if (direct.test(l) || parNarvos.test(l)) { vu = true; break; }
      }
      if (vu) break;
    }
    if (vu) out.push(rel);
  }
  return out;
}

/** Appels dans le fichier de déclaration, en excluant la déclaration même. */
function appelsDedans(nom, relDecl) {
  const motif = new RegExp(`[.:]${nom}\\s*\\(`);
  const decl = new RegExp(`^\\s*function\\s+\\w+[.:]${nom}\\s*\\(`);
  return source.get(relDecl).filter((l) => motif.test(l) && !decl.test(l)).length;
}

const jamais = [];
const queChezSoi = [];

for (const d of declarees) {
  const dehors = appelsAilleurs(d.nom, d.rel, d.module);
  if (dehors.length > 0) continue;
  const dedans = appelsDedans(d.nom, d.rel);
  (dedans === 0 ? jamais : queChezSoi).push({ ...d, dedans });
}

// ── Rapport ──────────────────────────────────────────────────────────────────

const EXECUTANT = (rel) => rel.includes("/Server/") || rel.includes("/Client/");

console.log(`${declarees.length} fonction(s) publique(s) déclarée(s) dans ${source.size} fichier(s)\n`);

console.log("[JAMAIS APPELÉES — nulle part, pas même chez elles]");
const chauds = jamais.filter((d) => EXECUTANT(d.rel));
const froids = jamais.filter((d) => !EXECUTANT(d.rel));

if (chauds.length === 0) console.log("  (aucune dans Server/ ou Client/)");
for (const d of chauds.sort((a, b) => a.rel.localeCompare(b.rel))) {
  console.log(`  PROBABLE  ${d.module}.${d.nom}   ${d.rel}:${d.ligne}`);
}
console.log(`\n  + ${froids.length} dans Shared/ — souvent légitime (harnais, API réservée) :`);
for (const d of froids.slice(0, 12)) console.log(`            ${d.module}.${d.nom}   ${d.rel}:${d.ligne}`);
if (froids.length > 12) console.log(`            … et ${froids.length - 12} autres`);

console.log("\n[APPELÉES SEULEMENT DANS LEUR PROPRE FICHIER]");
console.log("  (candidates à `local`, ou exécutants dont l'appelant manque)");
const csChauds = queChezSoi.filter((d) => EXECUTANT(d.rel));
if (csChauds.length === 0) console.log("  (aucune dans Server/ ou Client/)");
for (const d of csChauds.sort((a, b) => a.rel.localeCompare(b.rel)).slice(0, 20)) {
  console.log(`  ${d.module}.${d.nom}   ${d.rel}:${d.ligne}  (${d.dedans} appel interne)`);
}

console.log("");
console.log(`Bilan : ${jamais.length} jamais appelée(s) · ${queChezSoi.length} confinée(s) à leur fichier.`);
console.log("Ce contrôle RAPPORTE, il ne bloque pas — voir l'en-tête pour pourquoi.");