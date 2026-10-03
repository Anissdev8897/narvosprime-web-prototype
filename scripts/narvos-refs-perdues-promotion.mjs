#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// narvos-refs-perdues-promotion.mjs — un pack PROMU sous Narvos/ a-t-il PERDU des
// references par rapport a son original, et un redirect de prefixe suffirait-il ?
//
//   node scripts/narvos-refs-perdues-promotion.mjs <pack> <dossier original Content>
//   ex. node scripts/narvos-refs-perdues-promotion.mjs OpenWorlds \
//         "WebPortal/public/asset_game/nature_et_tech/Open Worlds/Open Worlds/OpenWorlds"
//
// ── LE DEFAUT QU'IL MESURE (vu en jeu et dans l'editeur le 2026-09-13) ──────────
// La foret (sous-niveau ForestKitONE du pack OpenWorlds) est grise : 7 materiaux
// maitres « Failed to compile Material ... Default Material will be used in game ».
// Deux natures, qui n'appellent pas le meme geste :
//   PERIMEE  la reference pointe l'ancien chemin /Game/<pack>/, la cible existe sous
//            /Game/Narvos/<pack>/ -> un PackageRedirect de prefixe la recolle ;
//   PERDUE   l'original citait une cible, la copie de l'ADK ne la cite PLUS : elle a
//            ete resauvee pendant que la cible manquait, la valeur nulle est ecrite.
//            Aucun redirect ne rend une valeur qui n'est plus ecrite -> restaurer le
//            fichier d'origine (M_TreesBarks : MF_VertexPaint et 2 textures perdus).
//
// Methode : noms /Game/ en clair dans la table de noms des .uasset NON cuits (ADK et
// original). Surestime (une mention n'est pas un import) : une perte reelle n'echappe
// pas ; une « perte » dont la cible n'existe nulle part est classee a part.
// ══════════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const CONTENT = path.join(RACINE, "WebPortal", "Server", "adk", "Content");
const MOTIF = /[\x20-\x7e]{6,}/g;

// Options : --niveau <paquet> restreint les PERDUES a la fermeture de ce niveau, calculee
// sur l'UNION des references ADK + original (les references effacees ne menent a
// rien dans l'ADK : une fermeture calculee sur l'ADK seul oublie ce que les originaux
// restaures citeront) ; --json <fichier> ecrit la liste pour adk-restaurer-originaux.mjs.
const args = process.argv.slice(2);
const option = (nom) => {
    const i = args.indexOf(nom);
    return i >= 0 ? args.splice(i, 2)[1] : null;
};
// ⚠ Git Bash reecrit tout argument commencant par `/` en `C:/Program Files/Git/...` :
// premiere execution du 2026-09-13, fermeture de 0 paquet et sortie VERTE. On recupere
// le chemin a partir de `Game/`, et un niveau introuvable arrete le script.
const brut = option("--niveau");
const niveau = brut ? `/${brut.slice(brut.indexOf("Game/"))}` : null;
if (brut && !brut.includes("Game/")) {
    console.error(`--niveau illisible : ${brut}`);
    process.exit(2);
}
const sortieJson = option("--json");
const [pack, dossierOriginal] = args;
if (!pack || !dossierOriginal) {
    console.error("usage : narvos-refs-perdues-promotion.mjs <pack> <dossier original> [--niveau /Game/Narvos/<pack>/Levels/X] [--json f]");
    process.exit(2);
}
const ORIGINAL = path.resolve(RACINE, dossierOriginal);
const PROMU = path.join(CONTENT, "Narvos", pack);
const ANCIEN = `/Game/${pack}/`;
const NOUVEAU = `/Game/Narvos/${pack}/`;

function* fichiers(dossier) {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
        const p = path.join(dossier, e.name);
        if (e.isDirectory()) yield* fichiers(p);
        else if (/\.(uasset|umap)$/.test(e.name)) yield p;
    }
}

const refsDe = (f) => new Set((fs.readFileSync(f).toString("latin1").match(MOTIF) ?? [])
    .filter((n) => n.startsWith("/Game/")).map((n) => n.split(".")[0]));

// Un paquet /Game/... existe-t-il sur le disque de l'ADK ?
const existe = (paquet) => ["uasset", "umap"].some((ext) => fs.existsSync(path.join(CONTENT, `${paquet.slice("/Game/".length)}.${ext}`)));
const versNarvos = (p) => (p.startsWith(ANCIEN) ? NOUVEAU + p.slice(ANCIEN.length) : p);

// Fermeture d'un niveau sur l'union des references (ADK + original), bornee au pack.
function fermeture(racine) {
    const fichierDe = (base, rel) => ["uasset", "umap"].map((e) => path.join(base, `${rel}.${e}`)).find((f) => fs.existsSync(f));
    const vus = new Set();
    const pile = [racine];
    while (pile.length > 0) {
        const p = versNarvos(pile.pop());
        if (vus.has(p) || !p.startsWith(NOUVEAU)) continue;
        vus.add(p);
        const rel = p.slice(NOUVEAU.length);
        for (const f of [fichierDe(PROMU, rel), fichierDe(ORIGINAL, rel)]) {
            if (f) for (const r of refsDe(f)) pile.push(r);
        }
    }
    return vus;
}
const perimetre = niveau ? fermeture(versNarvos(niveau)) : null;
if (perimetre && !existe(versNarvos(niveau))) {
    console.error(`Niveau introuvable dans l'ADK : ${versNarvos(niveau)}`);
    process.exit(2);
}

const perdues = []; // { asset, refs, carte }
const perimees = new Map(); // ancien chemin -> nb de citants
const introuvables = new Map(); // cible ni ancienne ni Narvos
let comparees = 0;
for (const f of fichiers(PROMU)) {
    const rel = path.relative(PROMU, f);
    const orig = path.join(ORIGINAL, rel);
    const paquet = NOUVEAU + rel.replaceAll("\\", "/").replace(/\.(uasset|umap)$/, "");
    if (perimetre && !perimetre.has(paquet)) continue;
    const refsAdk = refsDe(f);
    for (const r of refsAdk) {
        if (!r.startsWith(ANCIEN)) continue;
        if (existe(versNarvos(r))) perimees.set(r, (perimees.get(r) ?? 0) + 1);
        else introuvables.set(r, (introuvables.get(r) ?? 0) + 1);
    }
    if (!fs.existsSync(orig)) continue;
    comparees += 1;
    const adkNormalises = new Set([...refsAdk].map(versNarvos));
    const soi = `/Game/${pack}/${rel.replaceAll("\\", "/").replace(/\.(uasset|umap)$/, "")}`;
    // Seules comptent les cibles qui existeront APRES le redirect (sous Narvos/).
    const manquantes = [...refsDe(orig)]
        .filter((r) => r !== soi && !adkNormalises.has(versNarvos(r)))
        .filter((r) => existe(versNarvos(r)));
    if (manquantes.length > 0) {
        perdues.push({ asset: rel.replaceAll("\\", "/"), refs: manquantes, carte: f.endsWith(".umap") });
    }
}

if (sortieJson) {
    fs.writeFileSync(sortieJson, JSON.stringify({
        pack, original: ORIGINAL, promu: PROMU, niveau, fermeture: perimetre?.size ?? null,
        fermeture_paquets: perimetre ? [...perimetre].sort() : null,
        perdues: perdues.map((p) => ({ ...p, refs: p.refs.map(versNarvos) })),
    }, null, 1));
}

console.log(`Pack ${pack} : ${comparees} asset(s) compare(s) a l'original (${ORIGINAL})`
    + (perimetre ? ` — fermeture de ${niveau} : ${perimetre.size} paquet(s)` : ""));
console.log(`PERIMEES : ${perimees.size} cible(s) distincte(s) sous ${ANCIEN} presentes sous ${NOUVEAU} -> PackageRedirect de prefixe`);
console.log(`INTROUVABLES apres redirect : ${introuvables.size}`);
for (const [r, n] of [...introuvables].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`   ${r}  (${n} citant(s))`);
console.log(`PERDUES : ${perdues.length} asset(s) resauve(s) sans des references que l'original porte -> restaurer l'original`
    + ` (dont ${perdues.filter((p) => p.carte).length} carte(s) .umap : a trancher a la main, un placement peut vivre dans l'ADK)`);
for (const p of perdues) console.log(`   ${p.carte ? "[carte] " : ""}${p.asset}\n       ${p.refs.join("\n       ")}`);
process.exit(perdues.length + introuvables.size > 0 ? 1 : 0);