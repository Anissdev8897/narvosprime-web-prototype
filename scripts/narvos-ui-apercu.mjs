// ══════════════════════════════════════════════════════════════════════════════
// narvos-ui-apercu.mjs — fabrique un aperçu autonome des écrans de création.
//
//   node scripts/narvos-ui-apercu.mjs          écrit _apercu.html
//   node scripts/narvos-ui-apercu.mjs --purge  le supprime
//
// ── POURQUOI ──────────────────────────────────────────────────────────────────
// `Client/UI/creation/index.html` ne rend RIEN hors de nanos : tout son contenu
// arrive du serveur par `Events`, qui n'existe pas dans un navigateur. Ouvrir le
// fichier tel quel donne une page noire, et on ne peut donc pas juger le design
// sans lancer le jeu.
//
// Ce script produit un fichier unique — CSS et JS intégrés, faux pont `Events`,
// données réalistes — servi par la configuration `ui-creation` de
// `.claude/launch.json`. Il ne modifie AUCUN des trois fichiers de production.
//
// ⚠ `_apercu.html` vit dans le dossier du package : il partirait dans le pack
// cuit si on l'oubliait. D'où `--purge`, à lancer quand on a fini de regarder.
// Le préfixe `_` le signale comme non livrable.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const UI =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages" +
  "/narvos-map-proto/Client/UI/creation";

const SORTIE = path.join(UI, "_apercu.html");

if (process.argv.includes("--purge")) {
  if (fs.existsSync(SORTIE)) {
    fs.unlinkSync(SORTIE);
    console.log(`supprimé : ${SORTIE}`);
  } else {
    console.log("rien à supprimer.");
  }
  process.exit(0);
}

// ── Données d'exemple ─────────────────────────────────────────────────────────
//
// Elles reproduisent la forme exacte de ce qu'envoie `Server/Session.lua`. Si
// cette forme change, l'aperçu casse — et c'est voulu : un aperçu qui survit à
// un changement de contrat ne prouve plus rien.

const faction = (id, sous, accent, clair, lueur, classes) => ({
  id, label: id, sous_titre: sous, accent, accent_clair: clair, lueur,
  description: "",
  classes: classes.map(([cid, label, class_id]) => ({
    id: cid, label, class_id, faction: id, description: "",
  })),
});

const piece = (id, label, registre) => ({ id, label, registre });

const OPTIONS = {
  factions: [
    faction("AKARLYS", "Humains", "#3b82f6", "#60a5fa", "rgba(59,130,246,0.5)", [
      ["PRESSURE_MANIPULATOR", "Manipulateur de Pression", "warrior_tank"],
      ["BIO_SCOUT", "Bio-Éclaireur", "warrior_bruiser"],
      ["CURRENT_BREAKER", "Brise-Courant", "warrior_bruiser"],
      ["AQUARYS_SHADOW", "Ombre d'Aquarys", "warrior_dps"],
    ]),
    faction("ZAYAN", "Aliens", "#a855f7", "#c084fc", "rgba(168,85,247,0.5)", [
      ["PARASITE_SOWER", "Semeur de Parasites", "warrior_heal"],
      ["CANOPY_PROPHET", "Prophète de la Canopée", "warrior_heal"],
      ["MYCELIUM_HOST", "Hôte Mycélien", "warrior_tank"],
      ["VENOM_STALKER", "Traqueur Venimeux", "warrior_dps"],
    ]),
    faction("MEZALAYIS", "Mercenaires", "#eab308", "#fbbf24", "rgba(234,179,8,0.5)", [
      ["PYRO_ALCHEMIST", "Alchimiste Pyro", "warrior_dps"],
      ["FLUX_SCAVENGER", "Charognard de Flux", "warrior_bruiser"],
      ["DESERT_MIRAGE", "Mirage du Désert", "warrior_dps"],
      ["DUST_JUGGERNAUT", "Juggernaut de Poussière", "warrior_tank"],
    ]),
  ],
  genres: ["M", "F"],
  nom_min: 2,
  nom_max: 16,
  max_persos: 5,
  slots: ["visage", "torse", "jambes", "mains", "tete"],
  pieces: {
    M: {
      visage: [piece("bodyface_default_m", "Visage — Default", "base"),
               piece("bodyface_african_m", "Visage — African", "base"),
               piece("soldier_face_m", "Soldat — Face", "guerre")],
      torse: [piece("body_chest_m", "Corps nu — Chest", "base"),
              piece("casual_chest_m", "Civil — Chest", "civil"),
              piece("soldier_chest_m", "Soldat — Chest", "guerre"),
              piece("cop_chest_m", "Police — Chest", "uniforme"),
              piece("spacesuit_chest_m", "Combinaison spatiale — Chest", "guerre"),
              piece("smoking_chest_m", "Smoking — Chest", "civil")],
      jambes: [piece("body_legs_m", "Corps nu — Legs", "base"),
               piece("soldier_legs_m", "Soldat — Legs", "guerre"),
               piece("aviator_legs_m", "Aviateur — Legs", "civil")],
      mains: [piece("body_hands_m", "Corps nu — Hands", "base"),
              piece("casual_hands_m", "Civil — Hands", "civil")],
      tete: [],
    },
    F: {
      visage: [piece("bodyface_default_f", "Visage — Default", "base")],
      torse: [piece("body_chest_f", "Corps nu — Chest", "base"),
              piece("soldier_chest_f", "Soldat — Chest", "guerre")],
      jambes: [piece("body_legs_f", "Corps nu — Legs", "base")],
      mains: [],
      tete: [piece("soldier_balaclava_f", "Soldat — Balaclava", "guerre")],
    },
  },
};

const SESSION = {
  etat: "connexion",
  persos: [],
  serveur: "NARVOS-LOCAL · 127.0.0.1:7777",
  steam_pseudo: "aniss",
};

// ── Assemblage ────────────────────────────────────────────────────────────────

const lire = (f) => fs.readFileSync(path.join(UI, f), "utf8");

let html = lire("index.html")
  .replace('<link rel="stylesheet" href="style.css">', `<style>\n${lire("style.css")}\n</style>`)
  .replace('<script src="index.js"></script>', `<script>\n${lire("index.js")}\n</script>`);

// Faux pont : il enregistre les abonnements et rejoue Options puis Session, dans
// l'ordre où le serveur les envoie. `window.__abo` reste accessible pour piloter
// l'aperçu depuis la console (changer d'état, injecter des personnages).
const pont = `
<script>
window.__OPT = ${JSON.stringify(OPTIONS)};
window.__SES = ${JSON.stringify(SESSION)};
window.Events = {
  Subscribe: (n, f) => { (window.__abo ||= {})[n] = f; },
  Call: (n, ...a) => console.log("-> Lua", n, a),
};
document.addEventListener("DOMContentLoaded", () => setTimeout(() => {
  const A = window.__abo || {};
  A["NarvosCreation:Options"] && A["NarvosCreation:Options"](window.__OPT);
  A["NarvosCreation:Session"] && A["NarvosCreation:Session"](window.__SES);
}, 40));
</script>
`;

html = html.replace("</body>", pont + "</body>");
fs.writeFileSync(SORTIE, html, "utf8");

console.log(`écrit : ${SORTIE}  (${(html.length / 1024).toFixed(1)} ko)`);
console.log("");
console.log("  npm/preview : configuration « ui-creation » de .claude/launch.json");
console.log("  URL         : http://localhost:8777/creation/_apercu.html");
console.log("");
console.log("⚠ Lancer `node scripts/narvos-ui-apercu.mjs --purge` avant de cuire le pack.");