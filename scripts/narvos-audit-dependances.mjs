// ══════════════════════════════════════════════════════════════════════════════
// narvos-audit-dependances.mjs — classe les dépendances de /Game/Narvos et écrit
// le rapport. Lit le dump de scripts/adk-audit-dependances.py (registre d'assets).
//
//   node scripts/narvos-audit-dependances.mjs
//
// ── LE MOTIF CHERCHÉ (payé deux fois le 2026-09-11) ──────────────────────────
// Un paquet CUIT dont une dépendance n'est pas livrée : Defender (squelette
// disparu à la promotion) et MetaCustom (squelette resté dans le dossier stagé,
// jamais cuit). Dans le pack : référence morte, rien à l'écran, aucune erreur.
//
// Une dépendance vaut :
//   livree        sous /Game/Narvos ou /Game/NanosWorld, hors NeverCook
//   jamais_cuite  existe, mais dans un dossier DirectoriesToNeverCook
//   rapatriable   hors pack (dossier stagé) ET un jumeau promu existe
//                 -> scripts/adk-rapatrier-metacustom.py (même méthode)
//   a_promouvoir  hors pack, sans jumeau
//   morte         plus aucun asset à ce chemin
// Seuls comptent les paquets SOURCES qui sont eux-mêmes cuits.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype";
const DUMP = `${RACINE}/WebPortal/Server/adk/_audit-dependances.json`;
const INI = `${RACINE}/WebPortal/Server/adk/Config/DefaultGame.ini`;
const RAPPORT = `${RACINE}/.hermes/AUDIT_DEPENDANCES_2026-09-11.md`;

if (!fs.existsSync(DUMP)) {
  console.error(`ARRÊT : ${DUMP} absent — lancer auditer() dans l'éditeur (scripts/adk-audit-dependances.py).`);
  process.exit(1);
}
const { paquets, existe } = JSON.parse(fs.readFileSync(DUMP, "utf8"));

// DirectoriesToNeverCook : chemins écrits « Narvos/… » ou « /Game/… ».
const jamais = [...fs.readFileSync(INI, "utf8").matchAll(/DirectoriesToNeverCook=\(Path="([^"]+)"\)/g)]
  .map((m) => (m[1].startsWith("/") ? m[1] : `/Game/${m[1]}`).replace(/\/+$/, ""));
const sousJamais = (p) => jamais.some((d) => p === d || p.startsWith(`${d}/`));

const racinesNarvos = [...new Set(Object.keys(paquets).map((p) => p.split("/")[3]).filter(Boolean))];
const jumeau = (d) => {
  const queue = d.split("/").slice(3).join("/");
  if (!queue) return null;
  for (const r of racinesNarvos) {
    const c = `/Game/Narvos/${r}/${queue}`;
    if (paquets[c]) return c;
  }
  return null;
};

const classer = (d) => {
  if (existe[d] === null || existe[d] === undefined) return "morte";
  if (sousJamais(d)) return "jamais_cuite";
  if (d.startsWith("/Game/Narvos/") || d.startsWith("/Game/NanosWorld/")) return "livree";
  return jumeau(d) ? "rapatriable" : "a_promouvoir";
};

const CATS = ["morte", "jamais_cuite", "rapatriable", "a_promouvoir"];
const parPack = new Map();
const cibles = new Map();       // dépendance défaillante -> { cat, referents }
const maillagesSansSquelette = [];
let sources = 0;

for (const [p, e] of Object.entries(paquets)) {
  if (sousJamais(p)) continue;
  sources += 1;
  const pack = p.split("/")[3] ?? "?";
  if (!parPack.has(pack)) parPack.set(pack, { paquets: 0, touches: 0, ...Object.fromEntries(CATS.map((c) => [c, 0])) });
  const st = parPack.get(pack);
  st.paquets += 1;
  let touche = false;
  let squeletteLivre = e.classe !== "SkeletalMesh";
  for (const d of e.deps) {
    const cat = classer(d);
    if (e.classe === "SkeletalMesh" && existe[d] === "Skeleton" && cat === "livree") squeletteLivre = true;
    if (cat === "livree") continue;
    touche = true;
    st[cat] += 1;
    const c = cibles.get(d) ?? { cat, referents: [] };
    c.referents.push(p);
    cibles.set(d, c);
  }
  if (touche) st.touches += 1;
  if (!squeletteLivre) maillagesSansSquelette.push(p);
}

const lignesPacks = [...parPack.entries()]
  .filter(([, s]) => s.touches > 0)
  .sort((a, b) => b[1].touches - a[1].touches)
  .map(([pack, s]) => `| ${pack} | ${s.paquets} | ${s.touches} | ${s.morte} | ${s.jamais_cuite} | ${s.rapatriable} | ${s.a_promouvoir} |`);

const pire = (cat, n) => [...cibles.entries()]
  .filter(([, c]) => c.cat === cat)
  .sort((a, b) => b[1].referents.length - a[1].referents.length)
  .slice(0, n)
  .map(([d, c]) => `| \`${d}\` | ${c.referents.length} | \`${c.referents[0]}\` |`);

const totaux = Object.fromEntries(CATS.map((c) => [c, [...cibles.values()].filter((x) => x.cat === c).length]));
const md = `# AUDIT DES DÉPENDANCES — /Game/Narvos (${new Date().toISOString().slice(0, 16).replace("T", " ")})

Généré par \`scripts/narvos-audit-dependances.mjs\` depuis le registre d'assets de l'ADK
(\`scripts/adk-audit-dependances.py\`). ${sources} paquets cuits examinés, ${jamais.length} dossiers NeverCook.

Cibles défaillantes distinctes : **${totaux.morte} mortes**, **${totaux.jamais_cuite} jamais cuites**,
**${totaux.rapatriable} rapatriables** (jumeau promu), **${totaux.a_promouvoir} à promouvoir**.
SkeletalMesh cuits SANS squelette livré : **${maillagesSansSquelette.length}**.

## Par pack (paquets touchés = au moins une dépendance non livrée)

| pack | paquets | touchés | mortes | jamais cuites | rapatriables | à promouvoir |
|---|---|---|---|---|---|---|
${lignesPacks.join("\n")}

## SkeletalMesh sans squelette livré (${maillagesSansSquelette.length})

${maillagesSansSquelette.slice(0, 60).map((p) => `- \`${p}\``).join("\n") || "aucun"}

## Cibles mortes les plus référencées

| cible | référents | exemple |
|---|---|---|
${pire("morte", 25).join("\n")}

## Jamais cuites les plus référencées

| cible | référents | exemple |
|---|---|---|
${pire("jamais_cuite", 25).join("\n")}

## Hors pack, rapatriables (jumeau promu)

| cible | référents | exemple |
|---|---|---|
${pire("rapatriable", 25).join("\n")}

## Hors pack, sans jumeau (à promouvoir)

| cible | référents | exemple |
|---|---|---|
${pire("a_promouvoir", 25).join("\n")}
`;

fs.writeFileSync(RAPPORT, md, "utf8");
console.log(`${sources} paquets cuits ; cibles défaillantes : ${JSON.stringify(totaux)} ; SK sans squelette livré : ${maillagesSansSquelette.length}`);
console.log(`packs touchés : ${lignesPacks.length} ; rapport : ${RAPPORT}`);

// ── --paires <pack> : la liste de travail du rapatriement d'UN pack ──────────
// Écrit adk/_rapatrier-<pack>.json, lu par scripts/adk-rapatrier-pack.py :
// chaque dépendance « rapatriable » (dossier stagé + jumeau promu) avec son
// jumeau, et les mortes avec leurs référents — les textures qui manquent VRAIMENT.
const iPaires = process.argv.indexOf("--paires");
if (iPaires > 0 && process.argv[iPaires + 1]) {
  const pack = process.argv[iPaires + 1];
  const prefixe = `/Game/Narvos/${pack}/`;
  const paires = new Map();
  const mortes = new Map();
  for (const [p, e] of Object.entries(paquets)) {
    if (!p.startsWith(prefixe) || sousJamais(p)) continue;
    for (const d of e.deps) {
      const cat = classer(d);
      if (cat === "rapatriable" && !paires.has(d)) paires.set(d, { stage: d, jumeau: jumeau(d), classe: existe[d] });
      if (cat === "morte") mortes.set(d, (mortes.get(d) ?? 0) + 1);
    }
  }
  const racinesStage = [...new Set([...paires.keys()].map((d) => d.split("/").slice(0, 3).join("/")))];
  const sortie = `${RACINE}/WebPortal/Server/adk/_rapatrier-${pack}.json`;
  fs.writeFileSync(sortie, JSON.stringify({
    pack, racines_stage: racinesStage,
    paires: [...paires.values()],
    mortes: [...mortes.entries()].sort((a, b) => b[1] - a[1]).map(([cible, referents]) => ({ cible, referents })),
  }, null, 1), "utf8");
  console.log(`${pack} : ${paires.size} paire(s) a rapatrier depuis ${racinesStage.join(", ") || "—"} ; ${mortes.size} cible(s) morte(s) ; ${sortie}`);
}