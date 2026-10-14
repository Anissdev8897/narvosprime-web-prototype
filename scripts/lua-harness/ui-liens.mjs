import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// ui-liens.mjs — vérifie que la page et le Lua se parlent réellement.
//
//   node scripts/lua-harness/ui-liens.mjs
//
// ── POURQUOI CE HARNAIS EXISTE ────────────────────────────────────────────────
// Le pont WebUI ↔ Lua repose ENTIÈREMENT sur des chaînes de caractères. Rien ne
// les vérifie : ni `tsc`, ni `luac`, ni les harnais existants.
//
//   Events.Call("Narvos:UIQuiter")     -- une lettre en moins
//   Page("hud", "Narvos:UIQuitter", …) -- le récepteur, jamais atteint
//
// Le bouton ne fait RIEN. Pas d'erreur, pas de log, pas de trace. Sur ce projet
// c'est le défaut le plus cher qui existe : `Roster.EncoderCouleurs` itérait des
// clés recopiées à la main, rendait une chaîne vide, et effaçait les couleurs en
// base sans le moindre signal.
//
// Quatre liens sont contrôlés, tous de la même FORME — un nom écrit deux fois,
// des deux côtés d'une frontière que le compilateur ne franchit pas :
//
//   1. `Events.Call` du JS      -> `Page("hud", …)` du Lua
//   2. `HUD:CallEvent` du Lua   -> `Events.Subscribe` du JS
//   3. `$("id")` du JS          -> `id="…"` du HTML
//   4. `data-pause="x"` du HTML -> une branche `quoi === "x"` du JS
//   5. `PANNEAUX` du JS         -> `<section id="…">` du HTML
//
// ⚠ Les COMMENTAIRES de ligne du JS sont retirés avant analyse. L'en-tête du
// fichier documente le contrat avec un exemple, `Events.Call("Nom", args...)`,
// qui n'est pas un appel réel. Sans ce filtre, le contrôle crie au loup à chaque
// exécution — et un contrôle qui crie toujours n'est plus lu.
//
// ⚠ Les commentaires HTML, eux, sont GARDÉS. C'est délibéré : le 2026-09-08 ce
// contrôle a attrapé un commentaire qui annonçait `data-pause="parametres-retour"`
// alors que l'attribut réel valait `retour`. Un commentaire faux se propage à la
// prochaine personne qui le lit — il mérite d'échouer.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const BASE =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos-map-proto/Client";

const lire = (p) => fs.readFileSync(`${BASE}/${p}`, "utf8");

const html = lire("UI/index.html");
const lua = lire("Index.lua");

// ⚠ LA LISTE DES SCRIPTS EST DERIVEE DU HTML, JAMAIS RECOPIEE.
//
// Premiere version de ce contrôle : `index.js` en dur. Elle a signalé 22 liens
// morts qui n'en étaient pas — ils sont abonnés dans `ateliers.js`, le second
// script de la page. Un contrôle qui se trompe 22 fois sur 23 ne sera pas relu.
//
// C'est la règle du dépôt appliquée au garde-fou lui-même : une liste recopiée
// diverge toujours de sa source. Ici la source est la page.
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
if (scripts.length === 0) {
  console.error("Aucun <script src> dans index.html — le contrôle ne peut rien vérifier.");
  process.exit(1);
}
console.log(`Scripts de la page : ${scripts.join(", ")}\n`);

// Les commentaires de ligne du JS documentent le contrat avec de faux exemples.
const jsCode = scripts
  .map((f) => lire(`UI/${f}`))
  .join("\n")
  .replace(/^\s*\/\/.*$/gm, "");

const tous = (source, motif) => [...source.matchAll(motif)].map((m) => m[1]);
const uniq = (liste) => [...new Set(liste)].sort();

let echecs = 0;
const ok = (msg) => console.log(`  OK        ${msg}`);
const nok = (msg) => { console.log(`  MANQUANT  ${msg}`); echecs += 1; };

// ── 1. Les événements que la page émet ont un récepteur ──────────────────────

console.log("[page -> Lua]");
// ⚠ `ateliers.js` emet aussi par son helper `Lua(nom, ...)` : ne chercher que
// `Events.Call("` laissait passer deux evenements morts, garde VERT (audit du
// 2026-09-11). On filtre sur la FORME (un appel d'emission), pas sur le nom.
const emis = uniq(tous(jsCode, /(?:Events\.Call|\bLua)\("([^"]+)"/g));
const recus = new Set(tous(lua, /Page\("hud",\s*"([^"]+)"/g));
for (const e of emis) (recus.has(e) ? ok : nok)(`${e}${recus.has(e) ? "" : "  — aucun Page(\"hud\", …) ne l'écoute"}`);

// ── 2. Les événements que le Lua pousse ont un abonné ────────────────────────

// ⚠ TROUS CONNUS, DÉCLARÉS ET DATÉS — pas une exemption de complaisance.
//
// Vide depuis le 2026-09-08 : les quatre événements de mêlée (NarvosCoup,
// NarvosCoupAnnonce, NarvosCoupRefuse, NarvosContre), qui attendaient leur
// retour visuel, sont désormais écoutés par la couche HUD (`#melee`, dans
// `UI/index.html` + `index.js` + `hud.css`).
//
// Le principe de la liste reste : un garde-fou qui échoue à chaque exécution
// cesse d'être lu, et le jour où un VRAI nouveau lien casse, personne ne le
// verra dans le bruit. Un orphelin connu et daté se déclare ICI plutôt qu'en
// échec permanent — ce qu'on veut, c'est qu'un orphelin NON déclaré fasse
// tomber le contrôle.
//
// Retirer une ligne d'ici dès que la page s'y abonne. Un nom qui n'est plus
// poussé par le Lua, ou désormais écouté, fait aussi échouer — la liste ne
// peut pas pourrir.
const TROUS_CONNUS = [];

console.log("\n[Lua -> page]");
const pousses = uniq(tous(lua, /HUD:CallEvent\("([^"]+)"/g));
const abonnes = new Set(tous(jsCode, /Events\.Subscribe\("([^"]+)"/g));
for (const e of pousses) {
  if (abonnes.has(e)) { ok(e); continue; }
  if (TROUS_CONNUS.includes(e)) { console.log(`  CONNU     ${e}  — trou déclaré, attend le panneau de combat`); continue; }
  nok(`${e}  — la page ne s'y abonne pas`);
}

// Un trou déclaré qui n'existe plus doit sortir de la liste, sinon elle finit
// par décrire un état passé — c'est ainsi qu'une exemption devient un mensonge.
for (const e of TROUS_CONNUS) {
  if (!pousses.includes(e)) nok(`TROUS_CONNUS cite « ${e} », que le Lua ne pousse plus — retirer la ligne`);
  else if (abonnes.has(e)) nok(`TROUS_CONNUS cite « ${e} », désormais écouté par la page — retirer la ligne`);
}

// ── 3. Les identifiants lus existent dans le HTML ────────────────────────────

console.log("\n[identifiants]");
const idsHtml = new Set(tous(html, /id="([^"]+)"/g));
const idsJs = uniq(tous(jsCode, /\$\("([^"]+)"\)/g));
const absents = idsJs.filter((i) => !idsHtml.has(i));
if (absents.length === 0) ok(`les ${idsJs.length} identifiants lus par le JS existent dans le HTML`);
else for (const i of absents) nok(`#${i} lu par le JS, absent du HTML`);

// ── 4. Chaque panneau déclaré a sa section ───────────────────────────────────

console.log("\n[panneaux]");
const bloc = jsCode.match(/const PANNEAUX = \[([\s\S]*?)\];/);
const panneaux = bloc ? tous(bloc[1], /"([^"]+)"/g) : [];
const sections = new Set(tous(html, /<section id="([^"]+)"/g));
if (panneaux.length === 0) nok("PANNEAUX introuvable dans index.js");
for (const p of panneaux) (sections.has(p) ? ok : nok)(`${p}${sections.has(p) ? "" : "  — pas de <section id=\"" + p + "\">"}`);

// ── 5. Chaque action du menu de pause a sa branche ───────────────────────────

console.log("\n[actions du menu de pause]");
const actions = uniq(tous(html, /data-pause="([^"]+)"/g));
for (const a of actions) {
  const branche = jsCode.includes(`quoi === "${a}"`);
  (branche ? ok : nok)(`${a}${branche ? "" : "  — aucune branche `quoi === \"" + a + "\"` dans le JS"}`);
}

// ── 6. Les deux listes de sous-menus disent la même chose ────────────────────
//
// `SOUS_MENUS` (JS) et `SOUS_MENUS_PAUSE` (Lua) décrivent le même ensemble : les
// panneaux d'où Échap remonte à la pause au lieu de tout fermer.
//
// Elles ne PEUVENT pas être une seule source — le JS s'exécute dans la page, le
// Lua dans le jeu, et la touche arrive à l'un ou à l'autre selon qui a le focus.
// Un écart ne casse donc rien franchement : Échap ferme tout au lieu de remonter,
// mais seulement quand le focus est du mauvais côté. Un bug intermittent, le
// genre qu'on met des heures à reproduire.
//
// Puisqu'on ne peut pas les fusionner, on les confronte.

console.log("\n[sous-menus de la pause]");
const blocJs = jsCode.match(/const SOUS_MENUS = \[([\s\S]*?)\];/);
const sousJs = new Set(blocJs ? tous(blocJs[1], /"([^"]+)"/g) : []);
const blocLua = lua.match(/local SOUS_MENUS_PAUSE = \{([\s\S]*?)\}/);
const sousLua = new Set(blocLua ? tous(blocLua[1], /(\w+)\s*=\s*true/g) : []);

if (sousJs.size === 0) nok("SOUS_MENUS introuvable dans le JS");
if (sousLua.size === 0) nok("SOUS_MENUS_PAUSE introuvable dans le Lua");

for (const n of uniq([...sousJs, ...sousLua])) {
  const dansJs = sousJs.has(n);
  const dansLua = sousLua.has(n);
  if (dansJs && dansLua) ok(`${n}  — déclaré des deux côtés`);
  else nok(`${n}  — ${dansJs ? "dans le JS seulement" : "dans le Lua seulement"}`);
}

// ── 6. LA PAGE DE CRÉATION — la moitié que ce contrôle ne regardait pas ──────
//
// ⚠ CE BLOC MANQUAIT, ET C'EST LE PLUS GROS TROU QU'AIT EU CE HARNAIS.
// Tout ce qui précède ne lit que `UI/index.html` et `Page("hud", …)`. Or il y a
// DEUX pages WebUI, et la seconde porte tout le flux d'entrée : connexion,
// inscription, roster, création de personnage, et depuis le 2026-09-09 le choix
// du point de départ. Aucun de ces liens n'était vérifié.
//
// Le contrôle disait pourtant « Tous les liens page <-> Lua sont relies » — une
// phrase vraie sur ce qu'il regardait, fausse sur ce qu'elle laissait croire.
// C'est la forme exacte du défaut déjà payé ici : un garde-fou partiel ne garde
// rien, et il rassure en plus.
//
// Le Lua pousse vers cette page par DEUX formes (`Creation:CallEvent` et
// `OuvrirCreation():CallEvent`). On les attrape par le nom de l'événement, pas
// par celui de l'appelant : une troisième forme apparaîtrait sans casser le
// contrôle.

console.log("\n[page creation <-> Lua]");

const htmlC = lire("UI/creation/index.html");
const scriptsC = [...htmlC.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
if (scriptsC.length === 0) nok("aucun <script src> dans UI/creation/index.html");

const jsC = scriptsC
  .map((f) => lire(`UI/creation/${f}`))
  .join("\n")
  .replace(/^\s*\/\/.*$/gm, "");

// 6a. Ce que la page émet doit avoir un `Page("creation", …)`.
//
// ⚠ CETTE PAGE N'APPELLE PAS `Events.Call` DIRECTEMENT. Elle passe par deux
// enveloppes maison, `versLua(nom, …)` et `versLuaJSON(nom, …)`, qui gardent le
// pont derrière un seul point. Écrit d'abord avec le seul motif `Events.Call`,
// ce contrôle ne trouvait AUCUN émetteur et affichait… rien du tout. Pas un
// échec : le vide. Un garde-fou qui ne trouve rien à vérifier et se tait est
// pire qu'absent, puisqu'il compte pour vert dans le bilan.
//
// On accepte donc les trois formes, et on EXIGE d'en trouver au moins une —
// c'est cette exigence qui empêche le vide de repasser inaperçu si une
// quatrième enveloppe apparaît.
const emisC = uniq(tous(jsC, /(?:Events\.Call|versLua|versLuaJSON)\("([^"]+)"/g));
if (emisC.length === 0) {
  nok("aucun émetteur trouvé dans le JS de création — le motif de recherche est périmé");
}
const recusC = new Set(tous(lua, /Page\("creation",\s*"([^"]+)"/g));
for (const e of emisC) {
  (recusC.has(e) ? ok : nok)(`${e}${recusC.has(e) ? "" : "  — aucun Page(\"creation\", …) ne l'écoute"}`);
}

// 6b. Ce que le Lua pousse doit avoir un abonné.
const poussesC = uniq(tous(lua, /:CallEvent\("(NarvosCreation:[^"]+)"/g));
const abonnesC = new Set(tous(jsC, /Events\.Subscribe\("([^"]+)"/g));
for (const e of poussesC) {
  (abonnesC.has(e) ? ok : nok)(`${e}${abonnesC.has(e) ? "" : "  — la page de création ne s'y abonne pas"}`);
}

// 6c. Les identifiants lus existent dans SON html.
const idsHtmlC = new Set(tous(htmlC, /id="([^"]+)"/g));
const idsJsC = uniq(tous(jsC, /\$\("([^"]+)"\)/g));
const absentsC = idsJsC.filter((i) => !idsHtmlC.has(i));
if (absentsC.length === 0) ok(`les ${idsJsC.length} identifiants lus par le JS existent dans le HTML`);
else for (const i of absentsC) nok(`#${i} lu par le JS de création, absent de son HTML`);

// 6d. Chaque écran déclaré a sa balise. Même défaut que les panneaux du HUD :
// un écran absent du HTML laisse `afficherEcran` masquer les autres et n'en
// montrer aucun — page noire, zéro erreur.
const blocEcrans = jsC.match(/const ECRANS = \[([\s\S]*?)\];/);
const ecrans = blocEcrans ? tous(blocEcrans[1], /"([^"]+)"/g) : [];
if (ecrans.length === 0) nok("ECRANS introuvable dans le JS de création");
for (const e of ecrans) {
  (idsHtmlC.has(`ecran-${e}`) ? ok : nok)(`écran ${e}${idsHtmlC.has(`ecran-${e}`) ? "" : "  — pas de <main id=\"ecran-" + e + "\"> dans le HTML"}`);
}

// ── Bilan ────────────────────────────────────────────────────────────────────

console.log("");
if (echecs > 0) {
  console.error(`${echecs} lien(s) manquant(s).`);
  process.exitCode = 1;
} else {
  console.log("Tous les liens page <-> Lua sont relies.");
}