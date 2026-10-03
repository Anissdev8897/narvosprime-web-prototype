// ══════════════════════════════════════════════════════════════════════════════
// nanos-deploy-server.mjs — Câble le serveur nanos installé par Steam sur le
// contenu du projet.
//
//   node scripts/nanos-deploy-server.mjs [--apply]
//
// POURQUOI ICI ET PAS AILLEURS : les binaires du serveur (NanosWorldServer.exe,
// steam_api64.dll…) appartiennent à Steam, qui les met à jour en place. En avoir
// une copie dans le dépôt garantissait qu'elle serait un jour périmée face au
// client — et un client plus récent que le serveur refuse la connexion. Donc :
//
//   binaires  → Steam,  jamais copiés, jamais versionnés
//   contenu   → projet, source de vérité unique
//   le lien   → ce script
//
// Ce qu'il pose dans le dossier Steam :
//   Config.toml            copié depuis le projet (le serveur le lit au boot)
//   Packages/<pack>        jonctions vers nos packages Lua
//   Assets/<pack>          jonctions vers nos packs cuits (plusieurs Go : les
//                          copier serait absurde, et deux exemplaires
//                          divergeraient)
//
// ⚠ À RELANCER après toute mise à jour Steam de nanos : une réinstallation du
// dossier `Server/` emporte les jonctions et le Config.toml avec elle. Le
// symptôme est un serveur qui démarre sur la map par défaut sans nos packages.
//
// La jonction (et pas la copie) est délibérée : éditer un .lua dans le projet
// doit être visible par le serveur au redémarrage suivant, sans étape de
// synchronisation qu'on oubliera.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const STEAM = "D:/steam/steamapps/common/nanos-world-playtest/Server";
const PROJET = "E:/narvosprime-web-prototype/WebPortal/Server";
const PACKAGES_SRC = path.join(PROJET, "nanos_world/packages");

// Les packages à exposer au serveur. `nanos-world-discord-main` est volontairement
// absent : c'est un exemple du dépôt nanos, pas du contenu NARVOS.
const PACKAGES = ["narvos", "narvos-map-proto"];

// Packs d assets cuits, produits par scripts/nanos-build-asset-pack.mjs.
const ASSETS_SRC = path.join(PROJET, "Assets");
const ASSET_PACKS = ["narvos"];

const APPLY = process.argv.includes("--apply");

const actions = [];
const erreurs = [];

// ─── vérifications préalables ─────────────────────────────────────────────────

if (!fs.existsSync(path.join(STEAM, "NanosWorldServer.exe"))) {
  console.error(`ERREUR : pas de NanosWorldServer.exe dans ${STEAM}`);
  console.error("Vérifier l'intégrité des fichiers nanos world dans Steam.");
  process.exit(1);
}

if (!fs.existsSync(path.join(PROJET, "Config.toml"))) {
  console.error(`ERREUR : Config.toml introuvable dans ${PROJET}`);
  process.exit(1);
}

/**
 * Décrit ce qu'est réellement une entrée du système de fichiers.
 *
 * `existsSync` suit les liens : une jonction cassée répond « absent », ce qui
 * ferait recréer par-dessus sans nettoyer. `lstatSync` regarde le lien lui-même.
 */
const etat = (p) => {
  let l;
  try {
    l = fs.lstatSync(p);
  } catch {
    return "absent";
  }
  if (l.isSymbolicLink()) return fs.existsSync(p) ? "jonction" : "jonction-cassee";
  if (l.isDirectory()) return "dossier-reel";
  return "fichier";
};

// ─── plan ─────────────────────────────────────────────────────────────────────

// 1. Config.toml — copie, car un fichier ne peut pas être une jonction (seul un
//    lien symbolique le pourrait, et il exige le mode développeur Windows).
actions.push({ quoi: "Config.toml", type: "copie", detail: `${PROJET}/Config.toml` });

// 2. Assets/ — nos packs cuits, exposés par jonction comme les packages.
//    Le pack `narvos` pèse plusieurs Go : le copier à chaque déploiement serait
//    absurde, et en garder deux exemplaires garantirait qu'ils divergent.
if (etat(path.join(STEAM, "Assets")) === "absent") {
  actions.push({ quoi: "Assets/", type: "mkdir", detail: "dossier vide" });
}

for (const pack of ASSET_PACKS) {
  const src = path.join(ASSETS_SRC, pack);
  if (!fs.existsSync(src)) {
    // Absent n'est pas une erreur : le pack se produit par un cook, qu'on ne
    // relance pas à chaque déploiement.
    actions.push({ quoi: `Assets/${pack}`, type: "absent", detail: "pas encore cuit" });
    continue;
  }
  const dst = path.join(STEAM, "Assets", pack);
  const e = etat(dst);
  if (e === "jonction") {
    actions.push({ quoi: `Assets/${pack}`, type: "ok", detail: "jonction en place" });
  } else if (e === "absent") {
    actions.push({ quoi: `Assets/${pack}`, type: "jonction-asset", detail: `-> ${src}` });
  } else {
    actions.push({ quoi: `Assets/${pack}`, type: "rejonction-asset", detail: `etat: ${e}` });
  }
}

// 3. Packages/<pack> — une jonction par package.
for (const pack of PACKAGES) {
  const src = path.join(PACKAGES_SRC, pack);
  if (!fs.existsSync(src)) {
    erreurs.push(`package source absent : ${src}`);
    continue;
  }
  const dst = path.join(STEAM, "Packages", pack);
  const e = etat(dst);
  if (e === "jonction") {
    // Une jonction peut pointer ailleurs : vérifier la cible, pas sa seule existence.
    const cible = fs.readlinkSync(dst).replace(/\\/g, "/").replace(/\/+$/, "");
    if (cible.toLowerCase() === src.toLowerCase().replace(/\//g, "\\").toLowerCase().replace(/\\/g, "/")) {
      actions.push({ quoi: `Packages/${pack}`, type: "ok", detail: "jonction déjà correcte" });
      continue;
    }
    actions.push({ quoi: `Packages/${pack}`, type: "rejonction", detail: `pointait sur ${cible}` });
  } else if (e === "jonction-cassee") {
    actions.push({ quoi: `Packages/${pack}`, type: "rejonction", detail: "jonction cassée" });
  } else if (e === "dossier-reel") {
    // Un déplacement Windows transforme une jonction en dossier réel VIDE. Le
    // supprimer est sans risque tant qu'il l'est ; sinon on refuse d'y toucher.
    const contenu = fs.readdirSync(dst);
    if (contenu.length > 0) {
      erreurs.push(`${dst} est un vrai dossier NON VIDE (${contenu.length} entrées) — à traiter à la main`);
      continue;
    }
    actions.push({ quoi: `Packages/${pack}`, type: "rejonction", detail: "vrai dossier vide" });
  } else {
    actions.push({ quoi: `Packages/${pack}`, type: "jonction", detail: `-> ${src}` });
  }
}

// ─── rapport ──────────────────────────────────────────────────────────────────

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`  binaires : ${STEAM}`);
console.log(`  contenu  : ${PACKAGES_SRC}`);
console.log("");
for (const a of actions) {
  console.log(`  ${a.type.padEnd(11)} ${a.quoi.padEnd(22)} ${a.detail}`);
}
if (erreurs.length) {
  console.log("");
  for (const e of erreurs) console.log(`  ERREUR  ${e}`);
}

if (!APPLY) {
  console.log("");
  console.log("Rien écrit.");
  process.exit(erreurs.length ? 1 : 0);
}

// ─── application ──────────────────────────────────────────────────────────────

fs.mkdirSync(path.join(STEAM, "Packages"), { recursive: true });

for (const a of actions) {
  try {
    if (a.type === "copie") {
      fs.copyFileSync(path.join(PROJET, "Config.toml"), path.join(STEAM, "Config.toml"));
    } else if (a.type === "mkdir") {
      fs.mkdirSync(path.join(STEAM, "Assets"), { recursive: true });
    } else if (a.type === "jonction-asset" || a.type === "rejonction-asset") {
      const pack = a.quoi.replace("Assets/", "");
      const dst = path.join(STEAM, "Assets", pack);
      if (a.type === "rejonction-asset") fs.rmSync(dst, { recursive: true, force: true });
      fs.symlinkSync(path.join(ASSETS_SRC, pack), dst, "junction");
    } else if (a.type === "jonction" || a.type === "rejonction") {
      const pack = a.quoi.replace("Packages/", "");
      const dst = path.join(STEAM, "Packages", pack);
      if (a.type === "rejonction") fs.rmSync(dst, { recursive: true, force: true });
      // 'junction' : le seul type de lien Windows qui ne demande pas les droits
      // administrateur ni le mode développeur.
      fs.symlinkSync(path.join(PACKAGES_SRC, pack), dst, "junction");
    }
  } catch (err) {
    console.log(`  ÉCHEC  ${a.quoi} — ${err.message}`);
    erreurs.push(a.quoi);
  }
}

// ─── vérification post-application ────────────────────────────────────────────

console.log("");
console.log("Vérification :");
for (const pack of PACKAGES) {
  const dst = path.join(STEAM, "Packages", pack);
  const lua = fs.existsSync(dst)
    ? fs.readdirSync(dst, { recursive: true }).filter((f) => String(f).endsWith(".lua")).length
    : 0;
  console.log(`  Packages/${pack.padEnd(20)} ${etat(dst).padEnd(16)} ${lua} fichier(s) .lua visibles`);
}
console.log(`  Config.toml${" ".repeat(18)} ${etat(path.join(STEAM, "Config.toml"))}`);

console.log("");
console.log("Lancer le serveur :");
// ⚠ `--playtest` EST OBLIGATOIRE tant que le client installé est la build
// Playtest — c'est écrit dans `quick-start.mdx:141`. Sans lui, le serveur tourne
// sous un autre AppID Steam : il démarre normalement, annonce « Server started! »
// et « connected to Steam! VAC Secure! », puis ignore EN SILENCE les paquets UDP
// du client, qui échoue sur `5003 (Timed out)` au bout de 10 s. Rien côté serveur
// ne le laisse deviner — on croit à un problème de réseau et on perd du temps sur
// les ports, le pare-feu et les jonctions, tous sains.
console.log(`  cd "${STEAM.replace(/\//g, "\\")}"; .\\NanosWorldServer.exe --playtest`);

process.exit(erreurs.length ? 1 : 0);