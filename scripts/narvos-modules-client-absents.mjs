#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// narvos-modules-client-absents.mjs — le pack cuit cite-t-il des modules natifs
// (/Script/) que le CLIENT nanos n'a pas compiles ?
//
//   node scripts/narvos-modules-client-absents.mjs              # tout le pack
//   node scripts/narvos-modules-client-absents.mjs PontMetaHuman # un sous-dossier
//   node scripts/narvos-modules-client-absents.mjs --json
//
// ── LE DEFAUT QU'IL FERME (vu en jeu le 2026-09-13, 14:14:42) ──────────────────
// Le client a CRASHE (violation d'acces, lecture a 0x44) des la pose de
// `BP_NarvosMH_M` a l'apercu de creation. Minidump Sentry deroule : chargement de
// l'asset -> PostLoad d'un Anim Blueprint -> lecture d'une propriete de noeud NULLE.
// Le visage du MetaHuman utilise `Face_AnimBP`, dont un noeud est
// `AnimNode_LiveLinkPose` — module `LiveLinkAnimationCore`, ABSENT du client. Le
// type du noeud n'existe pas, sa case dans la table des noeuds reste nulle, et
// l'initialisation de l'ABP la lit. Le serveur, lui, n'a rien vu : il ne charge
// pas les assets.
//
// Aucun controle ne le voyait. L'asset etait declare, present, du bon type, et ses
// imports /Game/ resolvaient tous. `narvos-dependances-moteur.mjs` tient /Script/
// pour « classes natives » : permis d'office. C'est l'angle mort.
//
// ── METHODE ────────────────────────────────────────────────────────────────────
// Les noms de paquets natifs (`/Script/Engine`) et de structures (`AnimNode_Root`)
// sont en clair dans la table de noms des .uasset cuits ; le client porte le nom
// de chaque module et structure compiles dans son executable. On cherche le nom
// TERMINE PAR NUL : `/Script/LiveLink` est une sous-chaine de
// `/Script/LiveLinkInterface`, et une recherche nue le declare present a tort
// (premiere version de ce script, meme jour).
//
// ── CE QUI BLOQUE, CE QUI EST SIGNALE ─────────────────────────────────────────
//   BLOQUANT  un Anim Blueprint dont un TYPE DE NOEUD manque au client, et qui est
//             ATTEIGNABLE depuis un asset declare dans Assets.toml (nanos charge par
//             cle declaree, puis les dependances) : crash au chargement, prouve.
//   SIGNALE   le meme ABP sans chemin depuis une cle declaree ; et tout autre asset
//             citant un module absent (cast, variable) : la reference tombe a nul
//             au chargement, sans crash tant que la branche ne s'execute pas.
//             Mesure : `BP_MH_Male`, qui caste vers `LiveLinkInstance`, a ete pose
//             a 06:22 le meme jour sans une erreur client.
//
// ── ET LES ABP COMPILES EN ERREUR ─────────────────────────────────────────────
// Le meme `Face_AnimBP` avait ete CUIT avec 4 erreurs de compilation (« mh_arkit_
// mapping_pose references Pose Asset that uses a missing skeleton » -> « Missing
// allocated node ») : un noeud non alloue laisse lui aussi une case vide. Les deux
// causes etaient presentes, le minidump ne les departage pas. Le dernier journal de
// cook complet (« Packages Remain 0 ») est donc lu : un Anim Blueprint en erreur de
// compilation ET atteignable est BLOQUANT ; un autre Blueprint, SIGNALE.
//
// Code de sortie : 1 s'il existe un BLOQUANT, 0 sinon.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const DOSSIER_PACK = path.join(RACINE, "WebPortal", "Server", "Assets", "narvos");
const PACK = path.join(DOSSIER_PACK, "Narvos");
const ASSETS_TOML = path.join(DOSSIER_PACK, "Assets.toml");
const CLIENT_EXE = process.env.NANOS_CLIENT_EXE
    ?? "D:/steam/steamapps/common/nanos-world-playtest/NanosWorld/Binaries/Win64/NanosWorld-Win64-Shipping.exe";
const JOURNAUX_ADK = path.join(RACINE, "WebPortal", "Server", "adk", "Saved", "Logs");
const TEMOIN_COOK_COMPLET = "Packages Remain 0";

// La table de noms d'un .uasset cuit vit en tete de fichier.
const OCTETS_EN_TETE = 8 * 1024 * 1024;
const MOTIF_NOM = /[\x20-\x7e]{3,}/g;
const TEMOIN_ABP = "AnimNode_Root";

const args = process.argv.slice(2);
const enJson = args.includes("--json");
const sousDossier = args.find((a) => !a.startsWith("--")) ?? "";

function lireNoms(fichier) {
    const fd = fs.openSync(fichier, "r");
    try {
        const taille = Math.min(fs.fstatSync(fd).size, OCTETS_EN_TETE);
        const tampon = Buffer.alloc(taille);
        fs.readSync(fd, tampon, 0, taille, 0);
        return new Set(tampon.toString("latin1").match(MOTIF_NOM) ?? []);
    } finally {
        fs.closeSync(fd);
    }
}

function* uassets(dossier) {
    for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
        const chemin = path.join(dossier, entree.name);
        if (entree.isDirectory()) yield* uassets(chemin);
        else if (entree.name.endsWith(".uasset") || entree.name.endsWith(".umap")) yield chemin;
    }
}

// `/Game/Narvos/X/Y.Y_C` -> `/Game/Narvos/X/Y`
const paquetDe = (nom) => nom.split(".")[0];

function paquetDuFichier(fichier) {
    const rel = path.relative(DOSSIER_PACK, fichier).replaceAll("\\", "/").replace(/\.(uasset|umap)$/, "");
    return `/Game/${rel}`;
}

function nomsPresentsDansLeClient(noms) {
    const exe = fs.readFileSync(CLIENT_EXE);
    const presents = new Set();
    for (const nom of noms) {
        if (exe.includes(Buffer.from(`${nom}\0`, "latin1")) || exe.includes(Buffer.from(`${nom}\0`, "utf16le"))) {
            presents.add(nom);
        }
    }
    return presents;
}

function clesDeclarees() {
    const racines = new Set();
    const texte = fs.readFileSync(ASSETS_TOML, "utf8");
    for (const m of texte.matchAll(/^\s*[^\s=#]+\s*=\s*"(Narvos\/[^"]+)"/gm)) racines.add(`/Game/${m[1]}`);
    return racines;
}

// Parcours en largeur depuis les cles declarees ; `parent` garde UN chemin d'exemple.
function atteignables(racines, references) {
    const parent = new Map();
    const file = [];
    for (const r of racines) {
        if (references.has(r) && !parent.has(r)) {
            parent.set(r, null);
            file.push(r);
        }
    }
    for (let i = 0; i < file.length; i += 1) {
        for (const cible of references.get(file[i]) ?? []) {
            if (!parent.has(cible) && references.has(cible)) {
                parent.set(cible, file[i]);
                file.push(cible);
            }
        }
    }
    return parent;
}

// Dernier journal de l'ADK qui contient un cook COMPLET ; rend { journal, erreurs:
// Map(paquet -> premier message [Compiler]) } ou null.
function erreursDeCompilationDuDernierCook() {
    if (!fs.existsSync(JOURNAUX_ADK)) return null;
    const journaux = fs.readdirSync(JOURNAUX_ADK)
        .filter((n) => /^NanosWorldADK.*\.log$/.test(n))
        .map((n) => ({ n, t: fs.statSync(path.join(JOURNAUX_ADK, n)).mtimeMs }))
        .sort((a, b) => b.t - a.t);
    for (const { n } of journaux) {
        const texte = fs.readFileSync(path.join(JOURNAUX_ADK, n), "utf8");
        if (!texte.includes(TEMOIN_COOK_COMPLET)) continue;
        const erreurs = new Map();
        for (const m of texte.matchAll(/\[AssetLog\] (.+?): \[Compiler\] (.*)$/gm)) {
            const paquet = m[1].replaceAll("\\", "/")
                .replace(/^.*?\/Content\//, "/Game/").replace(/\.uasset$/, "").split(".")[0];
            if (!erreurs.has(paquet)) erreurs.set(paquet, m[2].replace(/\s+/g, " ").trim().slice(0, 140));
        }
        return { journal: n, erreurs };
    }
    return null;
}

function chaineVers(parent, paquet) {
    const chaine = [];
    for (let p = paquet; p !== null && p !== undefined; p = parent.get(p)) chaine.unshift(p.split("/").pop());
    return chaine.join(" -> ");
}

function main() {
    for (const [chemin, quoi] of [[PACK, "pack"], [CLIENT_EXE, "client nanos (NANOS_CLIENT_EXE)"], [ASSETS_TOML, "Assets.toml"]]) {
        if (!fs.existsSync(chemin)) {
            console.error(`Introuvable : ${quoi} — ${chemin}`);
            process.exit(2);
        }
    }

    // Lecture : tout le pack pour l'atteignabilite, le sous-dossier pour le rapport.
    const references = new Map(); // paquet -> Set(paquets cites)
    const fiches = new Map(); // paquet -> { fichier, scripts, noeuds, abp }
    const perimetre = path.join(PACK, sousDossier);
    for (const fichier of uassets(PACK)) {
        const noms = lireNoms(fichier);
        const paquet = paquetDuFichier(fichier);
        const cites = new Set();
        for (const n of noms) if (n.startsWith("/Game/")) cites.add(paquetDe(n));
        cites.delete(paquet);
        references.set(paquet, cites);
        if (fichier.startsWith(perimetre)) {
            fiches.set(paquet, {
                fichier: path.relative(PACK, fichier).replaceAll("\\", "/"),
                scripts: [...noms].filter((n) => n.startsWith("/Script/")),
                noeuds: [...noms].filter((n) => n.startsWith("AnimNode_")),
                abp: noms.has(TEMOIN_ABP),
            });
        }
    }

    const modules = new Set();
    const noeuds = new Set();
    for (const f of fiches.values()) {
        f.scripts.forEach((s) => modules.add(s));
        if (f.abp) f.noeuds.forEach((n) => noeuds.add(n));
    }
    const presents = nomsPresentsDansLeClient([...modules, ...noeuds]);
    const parent = atteignables(clesDeclarees(), references);

    const bloquants = [];
    const signales = [];
    for (const [paquet, f] of fiches) {
        const absents = f.scripts.filter((s) => !presents.has(s));
        if (absents.length === 0) continue;
        // Une structure de base (AnimNode_Base, ..Base) peut n'etre qu'un parent : seuls
        // les types de noeuds manquants au client comptent pour le crash.
        const noeudsAbsents = f.abp ? f.noeuds.filter((n) => !presents.has(n)) : [];
        const fiche = { asset: f.fichier, modules: absents, noeuds_absents: noeudsAbsents };
        if (f.abp && noeudsAbsents.length > 0 && parent.has(paquet)) {
            bloquants.push({ ...fiche, charge_par: chaineVers(parent, paquet) });
        } else {
            signales.push({ ...fiche, atteignable: parent.has(paquet), abp: f.abp });
        }
    }

    const cook = erreursDeCompilationDuDernierCook();
    const compilation = { journal: cook?.journal ?? null, bloquants: [], signales: [] };
    for (const [paquet, message] of cook?.erreurs ?? []) {
        const f = fiches.get(paquet);
        if (!f || !parent.has(paquet)) continue; // hors perimetre, ou jamais charge
        const fiche = { asset: f.fichier, message, charge_par: chaineVers(parent, paquet) };
        (f.abp ? compilation.bloquants : compilation.signales).push(fiche);
    }

    if (enJson) {
        console.log(JSON.stringify({ perimetre, assets_lus: fiches.size, bloquants, signales, compilation }, null, 2));
    } else {
        console.log(`Perimetre : ${perimetre}`);
        console.log(`${fiches.size} asset(s) lu(s), ${modules.size} module(s) /Script/ cite(s), `
            + `${[...modules].filter((m) => !presents.has(m)).length} absent(s) du client`);
        console.log(`BLOQUANT(S) : ${bloquants.length} — Anim Blueprint a type de noeud absent, charge par une cle declaree`);
        for (const b of bloquants) {
            console.log(`  ${b.asset}`);
            console.log(`      noeuds absents : ${b.noeuds_absents.join(", ")}  (${b.modules.join(", ")})`);
            console.log(`      charge par     : ${b.charge_par}`);
        }
        console.log(`SIGNALE(S) : ${signales.length} — reference nulle au chargement, sans crash prouve`);
        for (const s of signales) {
            const nature = s.abp ? (s.atteignable ? "ABP atteignable, noeuds presents" : "ABP NON atteignable") : "reference hors ABP";
            console.log(`  ${s.asset}  [${nature}]  ${s.modules.join(", ")}`
                + (s.noeuds_absents.length ? `  noeuds absents : ${s.noeuds_absents.join(", ")}` : ""));
        }
        if (!cook) {
            console.log("COMPILATION : aucun journal de cook complet dans Saved/Logs — non verifie");
        } else {
            console.log(`COMPILATION (${cook.journal}) : ${compilation.bloquants.length} ABP BLOQUANT(S), `
                + `${compilation.signales.length} autre(s) Blueprint(s) atteignable(s) en erreur`);
            for (const b of compilation.bloquants) {
                console.log(`  ${b.asset}\n      ${b.message}\n      charge par : ${b.charge_par}`);
            }
            for (const s of compilation.signales) console.log(`  [signale] ${s.asset} — ${s.message}`);
        }
    }
    process.exit(bloquants.length + compilation.bloquants.length > 0 ? 1 : 0);
}

main();