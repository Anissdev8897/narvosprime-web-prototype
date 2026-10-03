// pnj-anims-verif.mjs — choisit, pour chaque PNJ « simple » du catalogue
// Spawnables, l'AnimSequence cuite qui joue son VRAI idle — par le CONTENU
// du clip, jamais par son nom.
//
// Pourquoi le contenu : mesuré le 2026-09-09, les noms de clips Meshy sont
// parfois DÉCALÉS d'un dossier à l'autre (dans mercenaire_humain_tank, le
// clip nommé « Walking » contient l'idle — 1,90 s / 3,7 rad / hanches
// stables — et « Running » contient la mort). Un choix par nom jouerait la
// course en boucle sur un PNJ immobile.
//
// Signature d'un idle, mesurée sur les dossiers sains (soldat_humain & co) :
//   durée ≥ 0,5 s · activité de rotation > 1 rad (écarte les poses figées de
//   0,03 s) · déplacement XZ < 4 (sur place ; la visée fusil fait 42-63) ·
//   hanches stables (écarte la mort, qui finit au sol).
// Parmi les candidats : le MOINS actif — un idle respire, il ne gesticule pas.
//
// Règle de nommage cuit, vérifiée : <baseGlb><clip assaini> + suffixes de
// déduplication Unreal « _N » absents du GLB ; <baseGlb>_Anim pour les clips
// au nom générique (« Armature|… »).
//
// Lecture seule. Écrit docs/pnj-anims-verdicts.json.

import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(process.cwd());
const TOML = path.join(RACINE, "WebPortal/Server/Assets/narvos/Assets.toml");
const SPAWNABLES = path.join(RACINE, "WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Spawnables.lua");
const SPAWNER = path.join(RACINE, "WebPortal/Server/nanos_world/packages/narvos-map-proto/Server/Spawner.lua");
const MODELES = path.join(RACINE, "WebPortal/public/models");

// ── GLB ─────────────────────────────────────────────────────────────────────

function lireGlb(fichier) {
    const buf = fs.readFileSync(fichier);
    const jsonLen = buf.readUInt32LE(12);
    const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
    let off = 20 + jsonLen, bin = null;
    while (off < buf.length) {
        const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
        if (type === 0x004e4942) { bin = buf.subarray(off + 8, off + 8 + len); break; }
        off += 8 + len;
    }
    return { json, bin };
}

function accessor(json, bin, idx) {
    const a = json.accessors[idx];
    if (a.bufferView === undefined) return null;
    const bv = json.bufferViews[a.bufferView];
    const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const compN = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
    const out = new Float32Array(a.count * compN);
    for (let i = 0; i < a.count * compN; i++) out[i] = bin.readFloatLE(start + i * 4);
    return { data: out, count: a.count };
}

function mesurerClip(json, bin, anim) {
    let deplXZ = 0, activite = 0, duree = 0, hanches = null;
    const nomHanche = (json.skins && json.skins[0])
        ? json.skins[0].joints.map(j => (json.nodes[j].name || "")).find(n => /hip|pelvis|root/i.test(n))
        : null;
    for (const ch of anim.channels) {
        const s = anim.samplers[ch.sampler];
        const times = accessor(json, bin, s.input);
        const vals = accessor(json, bin, s.output);
        if (!times || !vals) continue;
        duree = Math.max(duree, times.data[times.count - 1]);
        const nomNoeud = json.nodes[ch.target.node].name || "";
        if (ch.target.path === "translation") {
            let minX = 1e30, maxX = -1e30, minZ = 1e30, maxZ = -1e30;
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]

const sections = {}; let courante = null;
for (const ligne of fs.readFileSync(TOML, "utf8").split("\n")) {
    const s = ligne.match(/^\s*\[assets\.(\w+)\]/);
    if (s) { courante = s[1]; sections[courante] = sections[courante] || {}; continue; }
    const e = ligne.match(/^\s*([A-Za-z0-9_\-]+) = "([^"]+)"/);
    if (e && courante) sections[courante][e[1]] = e[2];
}
const dossierDe = (p) => p.split("/").slice(0, -1).join("/");

const simples = fs.readFileSync(SPAWNABLES, "utf8").split("\n")
    .filter(l => l.includes("simple = true"))
    .map(l => ({ id: l.match(/id = "([^"]+)"/)[1], asset: l.match(/asset = "([^"]+)"/)[1] }));

// Les entrées DÉCLARÉES bloquées dans Spawner.ANIM_BLOQUES n'ont aucune
// PlayAnimation scriptée à vérifier (corps MetaCustom : leurs animations
// vivent dans le squelette, pas dans des clips cuits). Leur dossier source
// n'existe d'ailleurs pas sous public/models/ — les mesurer serait un ENOENT.
const bloques = new Set(
  [...fs.readFileSync(SPAWNER, "utf8").matchAll(/^\s*(\w+) = true/gm)].map(m => m[1]),
);

// ── Verdict par PNJ ─────────────────────────────────────────────────────────

const verdicts = {};

for (const { id, asset } of simples) {
    if (bloques.has(id)) {
        verdicts[id] = { saute: "ANIM_BLOQUES — aucune PlayAnimation scriptée à vérifier" };
        continue;
    }
    const cheminMesh = sections.skeletal_meshes[asset];
    const dirCuit = dossierDe(cheminMesh);
    const rel = dirCuit.replace(/^Narvos\//, "");
    const dossierSource = path.join(MODELES, rel);
    const animsCuits = Object.entries(sections.animations)
        .filter(([k, v]) => dossierDe(v) === dirCuit).map(([k]) => k);

    // Chaque clip de chaque GLB du dossier, mesuré, avec son nom cuit résolu.
    const clips = [];
    for (const g of fs.readdirSync(dossierSource).filter(f => f.endsWith(".glb"))) {
        const base = g.replace(/\.glb$/, "");
        const { json, bin } = lireGlb(path.join(dossierSource, g));
        const anims = json.animations || [];
        for (const anim of anims) {
            const m = mesurerClip(json, bin, anim);
            // Nom cuit candidat : base+clip, ou base+"_Anim" si clip générique.
            const generique = /^Armature[|.]/i.test(anim.name) || anims.length === 1;
            const candidat = generique ? base + "_Anim" : base + assainir(anim.name);
            const cuit = animsCuits.find(a =>
                a === candidat || (a.startsWith(candidat) && /^(_\d+)+$/.test(a.slice(candidat.length))));
            clips.push({ clip: anim.name, glb: g, cuit: cuit || null, mesure: m });
        }
    }

    // Candidats par le contenu, en deux tiers.
    //   Tier 1 « idle » : sur place, calme (< 50 rad — un idle respire, il ne
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
        anim: choisi.cuit,
        clip_source: choisi.clip,
        duree_s: +m.duree.toFixed(2),
        activite_rad: +m.activite.toFixed(1),
        deplXZ: +m.deplXZ.toFixed(2),
        marche_sur_place: tier === 2 || undefined,
        nom_decale: !/idle/i.test(choisi.clip) || undefined,
    };
}

let ok = 0, bloque = 0, decales = 0, marche = 0;
for (const [id, v] of Object.entries(verdicts)) {
    if (v.verdict === "OK") {
        ok++;
        if (v.nom_decale) decales++;
        if (v.marche_sur_place) marche++;
        console.log(`OK(t${v.tier}) ${id} -> ${v.anim}  [clip « ${v.clip_source} » ${v.duree_s}s ${v.activite_rad}rad depl=${v.deplXZ}]${v.marche_sur_place ? "  [marche sur place]" : ""}${v.nom_decale ? "  ⚠ NOM DÉCALÉ" : ""}`);
    } else {
        bloque++;
        console.log(`BLOQUE  ${id} :`);
        if (v.saute) console.log("         " + v.saute);
        else if (v.detail) v.detail.forEach(d => console.log("         " + d));
    }
}
console.log(`\n${ok} corrigibles (${ok - marche} idle, ${marche} marche sur place, ${decales} à nom décalé), ${bloque} bloqués, ${simples.length} total`);
fs.writeFileSync(path.join(RACINE, "docs/pnj-anims-verdicts.json"), JSON.stringify(verdicts, null, 2));
console.log("verdicts -> docs/pnj-anims-verdicts.json");