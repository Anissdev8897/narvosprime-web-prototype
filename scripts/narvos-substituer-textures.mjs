// ══════════════════════════════════════════════════════════════════════════════
// narvos-substituer-textures.mjs — pour chaque texture MORTE d'un pack qui n'a
// PAS de jumeau promu, propose une remplaçante qui fasse l'affaire à l'écran.
//
//   node scripts/narvos-substituer-textures.mjs CITY_PACK [OpenWorlds …]
//
// N'écrit RIEN dans le projet Unreal : produit adk/_substitutions-<pack>.json,
// que l'éditeur applique ensuite (duplicata de la remplaçante AU CHEMIN MORT,
// comme adk-reparer-squelettes-promus.py). Hanibes l'a demandé le 2026-09-11 :
// « si tu ne les trouves pas, trouve une texture qui peut faire l'affaire ».
//
// ── L'ORDRE DE PRÉFÉRENCE ─────────────────────────────────────────────────────
//   1. le MÊME nom ailleurs dans le projet (la texture a seulement déménagé) ;
//   2. une texture du MÊME CANAL (couleur, normale, masques, émissif) dont le nom
//      partage le plus de mots (Water, Rock, Door…) — dans le même pack d'abord ;
//   3. rien : dit « aucun candidat », jamais inventé.
// Un canal n'est JAMAIS mélangé : une couleur à la place d'une normale casserait
// l'éclairage, pire que la texture absente.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype/WebPortal/Server/adk";
const CONTENT = `${RACINE}/Content`;
const packs = process.argv.slice(2);
if (packs.length === 0) {
  console.error("usage : node scripts/narvos-substituer-textures.mjs <pack> [<pack>…]");
  process.exit(1);
}

const inventaire = JSON.parse(fs.readFileSync(`${RACINE}/_assets-inventory.json`, "utf8"));
const textures = inventaire.assets.filter((a) => a.classe === "Texture2D").map((a) => a.paquet);

const CANAUX = [
  ["normale", /(^|_)(normal|normalmap|nrm|n)$/i],
  ["emissif", /(^|_)(emissive|emissif|emis|e)$/i],
  ["masques", /(^|_)(occlusionroughnessmetallic|orm|rma|grunrom|roughness|metallic|ao|mask|m|r)$/i],
  ["couleur", /(^|_)(basecolor|bc|albedo|diffuse|color|colour|d)$/i],
];
const canal = (nom) => {
  const n = nom.replace(/\.uasset$/i, "");
  for (const [c, re] of CANAUX) if (re.test(n)) return c;
  return "inconnu";
};

const VIDES = new Set(["t", "default", "defaultmaterial", "material", "fbx", "lp", "mat", "tex", "texture",
  "basecolor", "normal", "occlusionroughnessmetallic", "emissive", "bc", "n", "orm", "d", "m", "r", "e",
  "grunrom", "roughness", "metallic", "ao", "small", "big"]);
const mots = (nom) => new Set(nom
  .replace(/([a-z])([A-Z])/g, "$1_$2")
  .toLowerCase()
  .split(/[^a-z]+/)
  .filter((w) => w.length > 1 && !VIDES.has(w)));

const parNom = new Map();
for (const t of textures) {
  const n = t.split("/").pop();
  if (!parNom.has(n)) parNom.set(n, []);
  parNom.get(n).push(t);
}

for (const pack of packs) {
  const source = `${RACINE}/_rapatrier-${pack}.json`;
  if (!fs.existsSync(source)) {
    console.error(`ARRET : ${source} absent — node scripts/narvos-audit-dependances.mjs --paires ${pack}`);
    continue;
  }
  const { mortes } = JSON.parse(fs.readFileSync(source, "utf8"));
  const sortie = [];
  let exacts = 0;
  let proches = 0;
  let aucun = 0;
  for (const { cible, referents } of mortes) {
    const queue = cible.split("/").slice(3).join("/");
    if (fs.existsSync(`${CONTENT}/Narvos/${pack}/${queue}.uasset`)) continue;   // jumeau : pas notre affaire
    const nom = cible.split("/").pop();
    const c = canal(nom);
    // 1. même nom, ailleurs
    const memes = (parNom.get(nom) || []).filter((t) => t !== cible && t.startsWith("/Game/Narvos/"));
    if (memes.length > 0) {
      exacts += 1;
      sortie.push({ cible, referents, canal: c, remplacante: memes[0], raison: "meme nom" });
      continue;
    }
    // 2. même canal, mots partagés
    const m = mots(nom);
    let meilleur = null;
    let score = 0;
    for (const t of textures) {
      if (!t.startsWith("/Game/Narvos/")) continue;
      const tn = t.split("/").pop();
      if (canal(tn) !== c || c === "inconnu") continue;
      const tm = mots(tn);
      let s = 0;
      for (const w of m) if (tm.has(w)) s += 1;
      if (t.startsWith(`/Game/Narvos/${pack}/`)) s += 0.5;
      if (s > score) { score = s; meilleur = t; }
    }
    if (meilleur && score >= 1) {
      proches += 1;
      sortie.push({ cible, referents, canal: c, remplacante: meilleur, raison: `mots partages (${score})` });
    } else {
      aucun += 1;
      sortie.push({ cible, referents, canal: c, remplacante: null, raison: "aucun candidat" });
    }
  }
  const fichier = `${RACINE}/_substitutions-${pack}.json`;
  fs.writeFileSync(fichier, JSON.stringify(sortie, null, 1), "utf8");
  console.log(`${pack} : ${sortie.length} texture(s) sans jumeau — ${exacts} même nom ailleurs, ${proches} remplaçante(s) proche(s), ${aucun} sans candidat ; ${fichier}`);
  for (const s of sortie.slice(0, 8)) {
    console.log(`   ${s.cible.split("/").pop()}  ->  ${s.remplacante ? s.remplacante.split("/").pop() : "—"}  (${s.canal}, ${s.raison})`);
  }
}