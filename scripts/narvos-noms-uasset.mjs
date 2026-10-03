// ══════════════════════════════════════════════════════════════════════════════
// narvos-noms-uasset.mjs — la TABLE DE NOMS d'un .uasset, sans l'éditeur.
//
//   node scripts/narvos-noms-uasset.mjs <fichier.uasset> [motif]
//
// ── POURQUOI ──────────────────────────────────────────────────────────────────
// `Blueprint:CallBlueprintEvent(nom, ...)` (nanos, autorité BOTH) déclenche une
// fonction ou un événement d'un Blueprint Unreal. Un nom FAUX ne lève rien : le
// jeu continue, rien ne se passe, et on cherche la panne ailleurs. Il faut donc
// la liste RÉELLE des noms exposés.
//
// L'éditeur ne la donne pas : mesuré le 2026-09-12, `dir()` sur l'objet par
// défaut d'une classe générée rend ZÉRO fonction propre — les bindings Python
// d'Unreal n'exposent pas les fonctions Blueprint. La table de noms du paquet,
// elle, les porte toutes, et elle se lit sur le disque.
//
// ⚠ CE QUE ÇA NE DIT PAS. La table contient AUSSI des noms de variables, de
// composants, de pins et de types. Elle donne des CANDIDATS à vérifier, pas une
// API. Le seul verdict est l'appel réel en jeu.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const fichier = process.argv[2];
const motif = process.argv[3] ? new RegExp(process.argv[3], "i") : null;

if (!fichier || !fs.existsSync(fichier)) {
  console.error(`Usage : node scripts/narvos-noms-uasset.mjs <fichier.uasset> [motif]`);
  process.exit(1);
}

const octets = fs.readFileSync(fichier);
const texte = octets.toString("latin1");

// Suites imprimables d'au moins trois caractères. Les noms Unreal sont stockés
// en ASCII (ou UTF-16 pour les rares non-ASCII, qu'on ignore ici).
const brut = texte.match(/[\x20-\x7E]{3,80}/g) ?? [];

// Un nom de fonction Blueprint ressemble à un identifiant : lettre en tête,
// lettres/chiffres/underscore/espace ensuite. On écarte les chemins, les
// extensions et le bruit binaire.
const IDENT = /^[A-Za-z][A-Za-z0-9_ ]{2,63}$/;
const BRUIT = /^(None|True|False|Class|Object|Default|Package|Function|Property|Struct|Enum|Bool|Int|Float|Byte|Name|Text|String|Array|Map|Set|Transform|Vector|Rotator)$/i;

const vus = new Map();
for (const s of brut) {
  const n = s.trim();
  if (!IDENT.test(n) || BRUIT.test(n)) continue;
  if (motif && !motif.test(n)) continue;
  vus.set(n, (vus.get(n) ?? 0) + 1);
}

const noms = [...vus.keys()].sort((a, b) => a.localeCompare(b));
console.log(`${fichier.split(/[\\/]/).pop()} : ${noms.length} nom(s) retenu(s)`);
for (const n of noms) console.log("  " + n);