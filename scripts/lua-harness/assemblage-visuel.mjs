import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// assemblage-visuel.mjs — captures de l'établi d'assemblage, hors du jeu.
//
//   node scripts/lua-harness/assemblage-visuel.mjs
//
// Ce qu'il prouve : la section RÉELLE de index.html, les VRAIS fichiers
// (style.css, assemblage.css, index.js, assemblage.js) et le VRAI contrat
// d'état poussé par Server/Assemblage.lua donnent un panneau dessiné et
// cohérent, dans trois situations : choix du plan, assemblage en cours avec
// manquants nommés, assemblage complet prêt à finaliser.
//
// La page de test est GÉNÉRÉE : la section est extraite du vrai index.html à
// chaque run (un copier-coller figé mentirait). Les données sont un état
// fictif conforme au contrat serveur — les valeurs (labels, iconFile) sont
// celles du vrai catalogue du chantier B, lues à la main. Les iconFile absents
// du paquet webp tombent sur le repli émoji prévu par RoueIcone : la capture
// montre le comportement réel, pas un maquillage.
//
// ⚠ Un harnais qui ne trouve pas sa cible doit ÉCHOUER, pas rendre vert.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const UI =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/UI";
const SORTIE = RACINE_DEPOT + "/docs/assemblage-ui";

const CHROME_CANDIDATS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];

// ── 1. La VRAIE section, extraite du vrai index.html ─────────────────────────

const indexHtml = fs.readFileSync(`${UI}/index.html`, "utf8");
const m = /<section id="assemblage"[\s\S]*?<\/section>/.exec(indexHtml);
if (!m) {
  console.error('SECTION ABSENTE : <section id="assemblage"> introuvable dans index.html');
  process.exit(1);
}
const section = m[0];

for (const f of ["index.js", "assemblage.js", "style.css", "assemblage.css"]) {
  const p = `${UI}/${f}`;
  if (!fs.existsSync(p) || fs.readFileSync(p, "utf8").trim().length === 0) {
    console.error(`CIBLE ABSENTE OU VIDE : ${p}`);
    process.exit(1);
  }
}

// ── 2. L'état fictif — la forme EXACTE de Server/Assemblage.lua (Envoyer) ────
//
//   { etabli, plans: [{ id, label, resultat: { item_id, nom, rarete, icone,
//     iconFile, quantite }, emplacements: [{ id, label, obligatoire, quantite }] }],
//     sac: [{ item_id, nom, rarete, icone, iconFile, uid, quantite }],
//     session: { plan_id, label, resultat, slots: [{ id, label, obligatoire,
//       quantite, pose, pieces: [...], accepte: [uid] }], manquants:
//       [{ id, label, requis, pose, manque }], complet } | null }
//
// Labels et iconFile : les valeurs du VRAI catalogue (Items.lua, chantier B).
// tex_strings_02 / tex_spare_parts_12 / tex_container_06 / tex_ingots_05 ne
// sont PAS dans le paquet webp actuel : le repli émoji doit se voir.

const piece = (item_id, nom, rarete, icone, iconFile, uid, quantite) => ({
  item_id, nom, rarete, icone, iconFile, uid, quantite,
});

const SAC = [
  piece("piece_moteur", "Moteur de véhicule", "rare", "🔧", "tex_spare_parts_12", "inst_moteur", 1),
  piece("piece_roue", "Roue de véhicule", "common", "🛞", "tex_strings_02", "inst_roues", 5),
  piece("piece_plaque", "Plaque d'immatriculation", "common", "🪪", "tex_ingots_05", "inst_plaque", 1),
  // Une pile dont le webp EXISTE dans le paquet : le chemin icône doit se voir.
  piece("piece_moteur", "Moteur de véhicule", "rare", "🔧", "tex_spare_parts_06", "inst_moteur2", 1),
  piece("consommable", "Ration", "common", "🥫", null, "inst_ration", 3),
];

const PLAN_BERLINE = {
  id: "plan_vehicule_executive_sedan",
  label: "Berline Exécutive",
  resultat: {
    item_id: "vehicule_executive_sedan", nom: "Berline Exécutive",
    rarete: "rare", icone: "🚗", iconFile: "tex_recipes_01", quantite: 1,
  },
  emplacements: [
    { id: "carrosserie", label: "Carrosserie", obligatoire: true, quantite: 1 },
    { id: "moteur", label: "Moteur", obligatoire: true, quantite: 1 },
    { id: "roues", label: "Roues", obligatoire: true, quantite: 4 },
    { id: "plaque", label: "Plaque d'immatriculation", obligatoire: false, quantite: 1 },
  ],
};

const PLANS = [
  PLAN_BERLINE,
  {
    id: "plan_vehicule_pickup", label: "Pickup",
    resultat: {
      item_id: "vehicule_pickup", nom: "Pickup",
      rarete: "uncommon", icone: "🚙", iconFile: null, quantite: 1,
    },
    emplacements: [
      { id: "carrosserie", label: "Carrosserie", obligatoire: true, quantite: 1 },
      { id: "moteur", label: "Moteur", obligatoire: true, quantite: 1 },
      { id: "roues", label: "Roues", obligatoire: true, quantite: 4 },
    ],
  },
  {
    id: "plan_craft_plasma_blade", label: "Lame Plasma",
    resultat: {
      item_id: "plasma_blade", nom: "Lame Plasma",
      rarete: "epic", icone: "⚔️", iconFile: null, quantite: 1,
    },
    emplacements: [
      { id: "metal_rare", label: "Métal rare", obligatoire: true, quantite: 2 },
      { id: "noyau", label: "Noyau plasma", obligatoire: true, quantite: 1 },
    ],
  },
];

const slot = (id, label, obligatoire, quantite, pose, pieces, accepte) => ({
  id, label, obligatoire, quantite, pose, pieces: pieces || [], accepte: accepte || [],
});

const ETATS = {
  // 1. Choix du plan : pas de session, le catalogue de l'établi.
  plans: { etabli: true, plans: PLANS, sac: SAC, session: null },

  // 2. En cours : carrosserie posée, 2 roues sur 4, le moteur manque — le
  //    slot « moteur » est choisi, seules les piles qu'il accepte sont actives.
  "en-cours": {
    etabli: true, plans: PLANS, sac: SAC,
    session: {
      plan_id: "plan_vehicule_executive_sedan",
      label: "Berline Exécutive",
      resultat: PLAN_BERLINE.resultat,
      slots: [
        slot("carrosserie", "Carrosserie", true, 1, 1,
          [{ item_id: "piece_carrosserie", nom: "Carrosserie de véhicule", rarete: "rare",
             icone: "🚗", iconFile: "tex_container_06", quantite: 1 }]),
        slot("moteur", "Moteur", true, 1, 0, [], ["inst_moteur", "inst_moteur2"]),
        slot("roues", "Roues", true, 4, 2,
          [{ item_id: "piece_roue", nom: "Roue de véhicule", rarete: "common",
             icone: "🛞", iconFile: "tex_strings_02", quantite: 2 }]),
        slot("plaque", "Plaque d'immatriculation", false, 1, 0, []),
      ],
      manquants: [
        { id: "moteur", label: "Moteur", requis: 1, pose: 0, manque: 1 },
        { id: "roues", label: "Roues", requis: 4, pose: 2, manque: 2 },
      ],
      complet: false,
    },
  },

  // 3. Complet : tout est posé (même l'optionnel), Finaliser actif.
  complet: {
    etabli: true, plans: PLANS,
    sac: [SAC[4]],
    session: {
      plan_id: "plan_vehicule_executive_sedan",
      label: "Berline Exécutive",
      resultat: PLAN_BERLINE.resultat,
      slots: [
        slot("carrosserie", "Carrosserie", true, 1, 1,
          [{ item_id: "piece_carrosserie", nom: "Carrosserie de véhicule", rarete: "rare",
             icone: "🚗", iconFile: "tex_container_06", quantite: 1 }]),
        slot("moteur", "Moteur", true, 1, 1,
          [{ item_id: "piece_moteur", nom: "Moteur de véhicule", rarete: "rare",
             icone: "🔧", iconFile: "tex_spare_parts_12", quantite: 1 }]),
        slot("roues", "Roues", true, 4, 4,
          [{ item_id: "piece_roue", nom: "Roue de véhicule", rarete: "common",
             icone: "🛞", iconFile: "tex_strings_02", quantite: 4 }]),
        slot("plaque", "Plaque d'immatriculation", false, 1, 1,
          [{ item_id: "piece_plaque", nom: "Plaque d'immatriculation", rarete: "common",
             icone: "🪪", iconFile: "tex_ingots_05", quantite: 1 }]),
      ],
      manquants: [],
      complet: true,
    },
  },
};

// ── 3. La page de test ────────────────────────────────────────────────────────

const page = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Test visuel — établi d'assemblage</title>
<base href="file:///${UI}/">
<link rel="stylesheet" href="hud.css">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="ateliers.css">
<link rel="stylesheet" href="assemblage.css">
</head>
<body>
<script>
// Bouchon du pont nanos, AVANT les vrais scripts : Subscribe capturé (le
// pilote rejoue les envois du serveur), Call enregistré sur window.APPELS.
window.APPELS = [];
window.Events = {
  Subscribe: function (nom, fn) { (this._s = this._s || {})[nom] = fn; },
  Call: function (nom) {
    window.APPELS.push({ nom: nom, args: Array.prototype.slice.call(arguments, 1) });
  },
};
</script>
<div id="voile" hidden></div>
${section}
<script src="index.js"></script>
<script src="ateliers.js"></script>
<script src="assemblage.js"></script>
<script>
// Le pilote : le serveur pousse l'état, la page ouvre le panneau — l'ordre
// réel (l'état est tamponné côté Lua, l'ouverture le réclame).
var etat = ${JSON.stringify(ETATS)};
var cle = (location.hash || "#plans").slice(1);
var pousse = etat[cle];
if (!pousse) { document.title = "ETAT INCONNU : " + cle; }
else {
  Events._s["NarvosAssemblage"](pousse);
  Ouvrir("assemblage");
  Events._s["NarvosAssemblage"](pousse);
}
</script>
</body>
</html>
`;

fs.mkdirSync(SORTIE, { recursive: true });
const pagePath = path.join(SORTIE, "test-visuel.html");
fs.writeFileSync(pagePath, page, "utf8");

// ── 4. Les captures ───────────────────────────────────────────────────────────

const chrome = CHROME_CANDIDATS.find((c) => fs.existsSync(c));
if (!chrome) {
  console.error("CHROME INTROUVABLE — page de test écrite, captures à faire à la main :");
  console.error("  " + pagePath + "#plans | #en-cours | #complet");
  process.exit(1);
}

let echecs = 0;
for (const cle of Object.keys(ETATS)) {
  const png = path.join(SORTIE, `assemblage-${cle}.png`);
  const url = `file:///${pagePath.replace(/\\/g, "/")}#${cle}`;
  try {
    execFileSync(chrome, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars",
      "--allow-file-access-from-files",
      "--window-size=1600,900", "--virtual-time-budget=6000",
      `--screenshot=${png}`, url,
    ], { stdio: "pipe", timeout: 60000 });
  } catch (e) {
    console.error(`  ECHEC  capture ${cle} : ${e.message.slice(0, 120)}`);
    echecs += 1;
    continue;
  }
  const taille = fs.existsSync(png) ? fs.statSync(png).size : 0;
  if (taille < 10000) {
    console.error(`  ECHEC  ${cle} : capture vide ou quasi (${taille} o)`);
    echecs += 1;
  } else {
    console.log(`  vert  ${cle} -> ${png} (${Math.round(taille / 1024)} Ko)`);
  }
}

if (echecs > 0) { console.error(`${echecs} capture(s) manquante(s).`); process.exitCode = 1; }
else console.log("3 captures, page de test régénérée depuis le vrai index.html.");