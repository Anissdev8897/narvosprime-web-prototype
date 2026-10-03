// ══════════════════════════════════════════════════════════════════════════════
// cablage-check.mjs — le module est-il BRANCHÉ, et expose-t-il ce qu'on lui demande ?
//
//   node scripts/lua-harness/cablage-check.mjs
//
// ── POURQUOI CE HARNAIS EXISTE ────────────────────────────────────────────────
// Le 2026-09-08, premier lancement réel du serveur sur `Map_Narvos`. Il est mort
// à la première ligne qui lisait un module non câblé :
//
//   ERROR  Lua Error on loading file 'narvos-map-proto/Server/Index.lua':
//          :55: attempt to index a nil value (field 'Mondes')
//
// `Catalogs/Mondes.lua` existait depuis deux jours. Il n'était pas dans
// `Shared/Index.lua`. Le script serveur s'est arrêté là, et
// `Player.Subscribe("Spawn")` — ligne 460 — n'a jamais été enregistré : pas de
// session, pas d'écran de création, pas de spawn, pas de ciel, pas de peuplement.
// **Une ligne, six symptômes.**
//
// L'audit qui a suivi a trouvé **35 modules lus et jamais câblés**.
//
// ⚠ CE QUE LES AUTRES HARNAIS NE PEUVENT PAS VOIR. Ils chargent chaque module
// EN DIRECT (`readFileSync` puis `doString`) et lui fournissent ses dépendances
// à la main. Ils prouvent que le code est JUSTE. Ils ne prouvent pas qu'il est
// BRANCHÉ. Plus de 2 700 assertions vertes, et le serveur mourait à la ligne 55.
//
// Deux contrôles, tous deux sur la FORME du défaut — « un nom écrit d'un côté
// d'une frontière que le compilateur ne franchit pas » :
//
//   1. Chaque `Narvos.X` LU a une assignation `Narvos.X = …` quelque part.
//   2. Chaque champ `Narvos.X.Y` ACCÉDÉ existe dans le module que le câblage
//      désigne. C'est ce contrôle-là qui a trouvé `Narvos.Dialogue.Injecter` —
//      une méthode inventée, que `Logic/Dialogue.lua` n'a jamais eue (la vraie
//      s'appelle `Callbacks`).
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages";
const SHARED = `${RACINE}/narvos/Shared`;

/** Tous les .lua des packages, chemin relatif à `RACINE`. */
function fichiersLua(dir, base = dir, sortie = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fichiersLua(p, base, sortie);
    else if (e.name.endsWith(".lua")) sortie.push(p.replace(/\\/g, "/"));
  }
  return sortie;
}

/**
 * Retire les commentaires de ligne.
 *
 * ⚠ Nécessaire, et pas cosmétique : les en-têtes de module documentent leur
 * propre câblage (`-- Câblage : Narvos.Ciel = Package.Require(...)`). Sans ce
 * filtre, chaque module se déclarerait câblé tout seul.
 */
const sansCommentaire = (l) => {
  const i = l.indexOf("--");
  return i < 0 ? l : l.slice(0, i);
};

// `(?<![\w.])` : `PropsNarvos.Asset` n'est PAS `Narvos.Asset`. Sans ce garde,
// le contrôle signalait 8 champs qui n'existent pas.
const LU_CHAMP = /(?<![\w.])Narvos\.(\w+)\.(\w+)/g;
const LU = /(?<![\w.])Narvos\.(\w+)/g;
const AFFECTE = /^\s*(?<![\w.])Narvos\.(\w+)\s*=/;

const luaFiles = fichiersLua(RACINE);

// ── 1. Ce qui est câblé, et vers quel fichier ────────────────────────────────

const cible = new Map();   // "Mondes" -> "Catalogs/Mondes.lua"
const cablesAilleurs = new Set();

for (const f of luaFiles) {
  const rel = f.replace(`${RACINE}/`, "");
  for (const brut of fs.readFileSync(f, "utf8").split("\n")) {
    const m = AFFECTE.exec(sansCommentaire(brut));
    if (!m) continue;
    const req = /Package\.Require\("([^"]+)"\)/.exec(brut);
    if (rel === "narvos/Shared/Index.lua" && req) cible.set(m[1], req[1]);
    else cablesAilleurs.add(m[1]);
  }
}

// ── 2. Ce qui est lu ─────────────────────────────────────────────────────────

const lus = new Map();      // "Mondes" -> [{rel, ligne, texte}]
const champs = new Map();   // "Mondes" -> Map(champ -> {rel, ligne})

for (const f of luaFiles) {
  const rel = f.replace(`${RACINE}/`, "");
  const lignes = fs.readFileSync(f, "utf8").split("\n");
  lignes.forEach((brut, i) => {
    const l = sansCommentaire(brut);
    if (AFFECTE.test(l)) return;
    for (const m of l.matchAll(LU)) {
      if (!lus.has(m[1])) lus.set(m[1], []);
      lus.get(m[1]).push({ rel, ligne: i + 1, texte: brut.trim().slice(0, 76) });
    }
    for (const m of l.matchAll(LU_CHAMP)) {
      if (!champs.has(m[1])) champs.set(m[1], new Map());
      if (!champs.get(m[1]).has(m[2])) champs.get(m[1]).set(m[2], { rel, ligne: i + 1 });
    }
  });
}

// ── 3. Ce que chaque module EXPORTE ──────────────────────────────────────────

/** Champs publics d'un module Lua : `M.X = …`, `function M.X`, `function M:X`. */
function exportsDe(relLua) {
  const p = `${SHARED}/${relLua}`;
  if (!fs.existsSync(p)) return null;
  const s = fs.readFileSync(p, "utf8");
  const nom = /^local\s+(\w+)\s*=\s*\{\}/m.exec(s) || /^local\s+(\w+)\s*=/m.exec(s);
  if (!nom) return null;
  const M = nom[1];
  const out = new Set();
  for (const m of s.matchAll(new RegExp(`^\\s*${M}\\.(\\w+)\\s*=`, "gm"))) out.add(m[1]);
  for (const m of s.matchAll(new RegExp(`^\\s*function\\s+${M}[.:](\\w+)`, "gm"))) out.add(m[1]);
  // Une table écrite d'un bloc : `local M = { A = …, B = … }`
  const bloc = new RegExp(`^local\\s+${M}\\s*=\\s*\\{([\\s\\S]*?)^\\}`, "m").exec(s);
  if (bloc) for (const m of bloc[1].matchAll(/^\s{4}(\w+)\s*=/gm)) out.add(m[1]);
  return out;
}

// ── Rapport ──────────────────────────────────────────────────────────────────

let echecs = 0;
const nok = (m) => { console.log(`  MANQUANT  ${m}`); echecs += 1; };

console.log(`${luaFiles.length} fichier(s) Lua · ${cible.size} module(s) câblé(s) dans Shared/Index.lua`);
console.log(`${cablesAilleurs.size} autre(s) assignation(s) Narvos.* (exécutants serveur)\n`);

console.log("[1. tout ce qui est lu est câblé]");
let orphelins = 0;
for (const nom of [...lus.keys()].sort()) {
  if (cible.has(nom) || cablesAilleurs.has(nom)) continue;
  orphelins += 1;
  nok(`Narvos.${nom} — lu ${lus.get(nom).length} fois, jamais câblé`);
  for (const u of lus.get(nom).slice(0, 2)) console.log(`              ${u.rel}:${u.ligne}  ${u.texte}`);
}
if (orphelins === 0) console.log(`  OK        les ${lus.size} modules lus sont tous câblés`);

console.log("\n[2. chaque champ accédé existe dans le module câblé]");
let inconnus = 0, verifies = 0;
for (const [nom, fichier] of [...cible].sort()) {
  const dispo = exportsDe(fichier);
  if (!dispo) { nok(`Narvos.${nom} — impossible de lire les exports de ${fichier}`); continue; }
  for (const [champ, ou] of champs.get(nom) ?? []) {
    verifies += 1;
    if (dispo.has(champ)) continue;
    inconnus += 1;
    nok(`Narvos.${nom}.${champ} — absent de ${fichier}`);
    console.log(`              lu en ${ou.rel}:${ou.ligne}`);
  }
}
if (inconnus === 0) console.log(`  OK        les ${verifies} champs accédés existent tous`);

console.log("");
if (echecs > 0) {
  console.error(`${echecs} défaut(s) de câblage. Le serveur mourrait au premier atteint.`);
  process.exitCode = 1;
} else {
  console.log("Câblage complet et cohérent.");
}