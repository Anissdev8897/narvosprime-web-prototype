#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// narvos-pnj-facteur-anim.mjs — l'échelle que porte l'ANIMATION de repos d'un PNJ
// simple, rapportée à celle de son SQUELETTE.
//
//   node scripts/narvos-pnj-facteur-anim.mjs            # constat
//   node scripts/narvos-pnj-facteur-anim.mjs --apply    # écrit le manifeste
//
// Sortie : WebPortal/Server/adk/_manifests/pnj-facteur-anim.json, lu par
// narvos-spawnables-to-lua.mjs (champ `echelle_animee` du catalogue).
//
// ── LE DÉFAUT (mesuré le 2026-09-13, enquête PNJ) ─────────────────────────────
// Les GLB Meshy ont un nœud `Armature` à l'échelle 0,01. À l'import :
//   · SQUELETTE : os racine à s = 0,0001 -> le mesh au repos mesure 1,7 cm ;
//   · ANIMATION : piste racine à s = 0,01 -> le mesh ANIMÉ mesure 1,7 m.
// Le catalogue pose `echelle = 100` (mesure du mesh AU REPOS, 05/09). Tant que le
// PNJ était une statue, c'était juste ; depuis que `Spawner.ANIM_REPOS` joue
// une séquence (09/09), les deux ×100 se cumulent : 29 PNJ de 150 à 175 m.
//
// Le facteur n'est pas « 100 pour tout le monde » : le crabe Aquarys porte 78,9,
// les monstres Monster03/04 et le lézard 1. On le MESURE donc par entrée, dans les
// sources de l'ADK (le modèle de données d'animation n'est pas cuit).
// ═══════════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { lirePaquet, premiereTransform, canauxRacine } from "./lib/uasset-paquet.mjs";

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const WEB = path.join(RACINE, "WebPortal");
const PACK = path.join(WEB, "Server", "Assets", "narvos");
const CONTENT = path.join(WEB, "Server", "adk", "Content");
const LUA = path.join(WEB, "Server", "nanos_world", "packages");
const SORTIE = path.join(WEB, "Server", "adk", "_manifests", "pnj-facteur-anim.json");

/** En deçà de cet écart relatif, l'animation ne change pas la taille. */
const TOLERANCE = 0.01;

const appliquer = process.argv.includes("--apply");
const lire = (f) => fs.readFileSync(f, "utf8");

function entreesSimples() {
    const texte = lire(path.join(LUA, "narvos", "Shared", "Catalogs", "Spawnables.lua"));
    return [...texte.matchAll(/\{ id = "([^"]+)", asset = "([^"]+)"([^}]*)\}/g)]
        .filter((m) => /simple = true/.test(m[3]))
        .map((m) => ({ id: m[1], asset: m[2] }));
}

function animationsDeRepos() {
    const texte = lire(path.join(LUA, "narvos-map-proto", "Server", "Spawner.lua"));
    const bloc = texte.match(/Spawner\.ANIM_REPOS = \{([\s\S]*?)\n\}/);
    if (!bloc) throw new Error("Spawner.ANIM_REPOS introuvable dans Server/Spawner.lua");
    return Object.fromEntries([...bloc[1].matchAll(/(\w+) = "([^"]+)"/g)].map((m) => [m[1], m[2]]));
}

function clesDuPack() {
    const cles = {};
    for (const m of lire(path.join(PACK, "Assets.toml")).matchAll(/^\s+([A-Za-z0-9_\-+.]+) = "([^"]+)"/gm)) {
        if (!(m[1] in cles)) cles[m[1]] = m[2];
    }
    return cles;
}

const source = (chemin) => path.join(CONTENT, `${chemin}.uasset`);
const cuit = (chemin) => path.join(PACK, `${chemin}.uasset`);

// La SOURCE d'abord : le pack cuit est réécrit par la chaîne de cook pendant
// l'étape PACK, et ses fichiers peuvent manquer à ce moment-là.
function squeletteDe(cheminMesh) {
    for (const f of [source(cheminMesh), cuit(cheminMesh)]) {
        if (!fs.existsSync(f)) continue;
        const im = lirePaquet(f).imports.find((x) => x.className === "Skeleton");
        if (im) return im.path.split(".")[0].replace(/^\/Game\//, "");
    }
    return null;
}

function main() {
    const cles = clesDuPack();
    const anims = animationsDeRepos();
    const resultat = {};
    const refus = [];

    for (const e of entreesSimples()) {
        const anim = anims[e.id];
        if (!anim) continue;
        const cheminMesh = cles[e.asset];
        const cheminAnim = cles[anim];
        if (!cheminMesh || !cheminAnim) { refus.push(`${e.id} : cle absente d'Assets.toml`); continue; }
        const squelette = squeletteDe(cheminMesh);
        if (!squelette) { refus.push(`${e.id} : squelette illisible dans le mesh cuit`); continue; }
        const ref = premiereTransform(source(squelette));
        const canaux = canauxRacine(source(cheminAnim));
        if (!ref || !canaux || !canaux.echelle) {
            refus.push(`${e.id} : ${!ref ? "pose de reference" : "piste racine"} illisible`);
            continue;
        }
        const facteur = canaux.echelle[0] / ref.s[0];
        if (!(facteur > 0) || !Number.isFinite(facteur)) { refus.push(`${e.id} : facteur non fini`); continue; }
        resultat[e.id] = {
            anim,
            squelette,
            echelle_racine_squelette: +ref.s[0].toPrecision(6),
            echelle_racine_anim: +canaux.echelle[0].toPrecision(6),
            facteur: Math.abs(facteur - 1) < TOLERANCE ? 1 : +facteur.toFixed(3),
        };
    }

    const ids = Object.keys(resultat).sort();
    for (const id of ids) {
        const r = resultat[id];
        console.log(`${id.padEnd(30)} facteur ${String(r.facteur).padStart(8)}  (squelette ${r.echelle_racine_squelette}, anim ${r.echelle_racine_anim})`);
    }
    for (const r of refus) console.log(`REFUS ${r}`);
    console.log(`${ids.length} entree(s) mesuree(s), ${ids.filter((i) => resultat[i].facteur !== 1).length} avec un facteur != 1, ${refus.length} refus`);

    if (!appliquer) { console.log("(constat seul — --apply pour ecrire le manifeste)"); return; }
    const manifeste = {
        genere_par: "scripts/narvos-pnj-facteur-anim.mjs",
        explication: "facteur = echelle de la piste racine de ANIM_REPOS / echelle de l'os racine du squelette ; echelle_animee = echelle / facteur",
        entrees: Object.fromEntries(ids.map((id) => [id, resultat[id]])),
    };
    fs.writeFileSync(SORTIE, JSON.stringify(manifeste, null, 2) + "\n");
    console.log(`manifeste ecrit : ${SORTIE}`);
    if (refus.length) process.exitCode = 1;
}

main();