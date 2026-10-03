// ══════════════════════════════════════════════════════════════════════════════
// narvos-assets-cuits-jamais-appeles.mjs — quel paquet CUIT n'est JAMAIS employé ?
//
//   node scripts/narvos-assets-cuits-jamais-appeles.mjs
//
// ── LA QUESTION ───────────────────────────────────────────────────────────────
// Retour de jeu du 2026-09-11 : « rien n'a été branché visuellement, à part les
// maps ». Les paquets achetés (asset_game/) ont été importés dans l'ADK et cuits
// — Assets.toml les DÉCLARE. Mais déclaré n'est pas employé : un asset qu'aucun
// catalogue ne nomme n'existe pas en jeu. C'est la même règle que pour les
// modules Lua (`modules-orphelins-check`), appliquée aux assets.
//
// Ce script fait la JOINTURE :
//   Assets.toml            → clé → paquet de premier niveau (Narvos/<paquet>/…)
//   packages/**            → toutes les références `narvos::<clé>` dans notre code
//   ⇒ par paquet : clés déclarées, clés RÉFÉRENCÉES, et le verdict.
//
// Un paquet à 0 référence est cuit pour rien — sauf s'il est consommé par un
// NIVEAU (sous-niveau Unreal), ce que ce script ne voit pas : il le DIT.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = "E:/narvosprime-web-prototype";
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;
const PACKAGES = `${RACINE}/WebPortal/Server/nanos_world/packages`;

// ── 1. Assets.toml : clé → (section, paquet) ─────────────────────────────────
const parCle = new Map();
let section = null;
for (const ligne of fs.readFileSync(TOML, "utf8").split("\n")) {
  const s = /^\s*\[assets\.([a-z_]+)\]/.exec(ligne);
  if (s) { section = s[1]; continue; }
  const m = /^\s*([A-Za-z0-9_\-]+)\s*=\s*"Narvos\/([^/"]+)/.exec(ligne);
  if (m && section) parCle.set(m[1], { section, paquet: m[2] });
}
if (parCle.size === 0) {
  console.error("ARRET : aucune cle lue dans Assets.toml.");
  process.exit(1);
}

// ── 2. Notre code : chaque `narvos::<clé>` et le fichier qui le porte ────────
const refs = new Map(); // clé → Set(fichiers)
(function descendre(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { descendre(p); continue; }
    if (!/\.(lua|js|html|toml)$/.test(e.name)) continue;
    const src = fs.readFileSync(p, "utf8");
    const rel = path.relative(PACKAGES, p).replace(/\\/g, "/");
    for (const m of src.matchAll(/narvos::([A-Za-z0-9_\-]+)/g)) {
      if (!refs.has(m[1])) refs.set(m[1], new Set());
      refs.get(m[1]).add(rel);
    }
  }
})(PACKAGES);

// ⚠ Les catalogues portent souvent le paquet à part : `PACK = "narvos"` puis
// `asset = "SK_Truc"` et la concaténation se fait à l'exécution. On ramasse
// donc AUSSI toute chaîne `"<clé>"` qui est une clé d'Assets.toml, dans les
// catalogues et la logique Lua. Plus large, donc plus de faux « employés »
// (un mot commun qui serait aussi une clé) — le biais va dans le sens de la
// prudence : ce script sous-estime les orphelins, il ne les invente pas.
(function descendre(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { descendre(p); continue; }
    if (!/\.lua$/.test(e.name)) continue;
    const src = fs.readFileSync(p, "utf8");
    const rel = path.relative(PACKAGES, p).replace(/\\/g, "/");
    for (const m of src.matchAll(/"([A-Za-z0-9_\-]{3,})"/g)) {
      if (parCle.has(m[1])) {
        if (!refs.has(m[1])) refs.set(m[1], new Set());
        refs.get(m[1]).add(rel);
      }
    }
  }
})(PACKAGES);

// ── 3. La jointure, par paquet ───────────────────────────────────────────────
const parPaquet = new Map();
for (const [cle, { paquet, section }] of parCle) {
  if (!parPaquet.has(paquet)) parPaquet.set(paquet, { declarees: 0, referencees: 0, sections: new Set(), fichiers: new Set() });
  const p = parPaquet.get(paquet);
  p.declarees++;
  p.sections.add(section);
  if (refs.has(cle)) {
    p.referencees++;
    for (const f of refs.get(cle)) p.fichiers.add(f);
  }
}

const lignes = [...parPaquet.entries()].sort((a, b) => b[1].declarees - a[1].declarees);
console.log(`${parCle.size} clé(s) déclarées dans Assets.toml, ${refs.size} clé(s) référencées dans packages/.\n`);
console.log("paquet cuit                     déclarées  employées   sections                         par");
console.log("─".repeat(118));
let orphelins = 0, orphelinesCles = 0;
for (const [paquet, p] of lignes) {
  const verdict = p.referencees === 0 ? "JAMAIS EMPLOYÉ" : "";
  if (p.referencees === 0) { orphelins++; orphelinesCles += p.declarees; }
  const par = [...p.fichiers].map((f) => f.replace(/^narvos(-map-proto)?\//, "")).slice(0, 3).join(", ");
  console.log(
    `${paquet.padEnd(30)} ${String(p.declarees).padStart(9)}  ${String(p.referencees).padStart(9)}   ` +
    `${[...p.sections].join(",").padEnd(32)} ${verdict || par}`
  );
}
console.log("─".repeat(118));
console.log(`${orphelins} paquet(s) sur ${parPaquet.size} sans AUCUNE référence dans notre code — ${orphelinesCles} clé(s) cuites pour rien.`);
console.log("(un paquet consommé par un sous-niveau Unreal n'apparaît pas ici : les niveaux ne passent pas par Assets.toml)");