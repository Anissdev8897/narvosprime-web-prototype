#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// adk-restaurer-originaux.mjs — remettre dans l'ADK les fichiers d'ORIGINE des paquets
// qui ont PERDU des references (liste produite par narvos-refs-perdues-promotion.mjs).
//
//   node scripts/adk-restaurer-originaux.mjs <manifeste.json>            # simulation
//   node scripts/adk-restaurer-originaux.mjs <manifeste.json> --apply    # ecrit
//   node scripts/adk-restaurer-originaux.mjs <manifeste.json> --annuler --apply
//
// ── POURQUOI ──────────────────────────────────────────────────────────────────
// Une reference ecrite a NULL par une resauvegarde ne revient par aucun redirect.
// Le fichier d'origine, lui, la porte encore — vers l'ancien chemin, que le
// PackageRedirect du pack recolle (methode « original + redirect » prouvee sur
// MetaCustom, Hyper, Farming). Cas du 2026-09-13 : la foret ForestKitONE.
//
// ── REGLES ────────────────────────────────────────────────────────────────────
// · AUCUN Unreal ouvert : un editeur qui sauverait apres coup ecraserait la
//   restauration avec sa version en memoire (references nulles comprises).
// · Jamais de carte (.umap) : un placement peut vivre dans l'ADK seul.
// · La version ADK part en _sauvegardes/<date>-<pack>-restauration/ (chemin miroir) ;
//   --annuler la remet.
// · On SUPPRIME puis on copie : ecrire DANS un lien dur modifierait aussi l'original
//   d'achat qui partage son inode (reference_jonction_liens_durs_packs).
// ══════════════════════════════════════════════════════════════════════════════
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const ADK = path.join(RACINE, "WebPortal", "Server", "adk");

const args = process.argv.slice(2);
const appliquer = args.includes("--apply");
const annuler = args.includes("--annuler");
const manifeste = args.find((a) => !a.startsWith("--"));
if (!manifeste) {
    console.error("usage : adk-restaurer-originaux.mjs <manifeste.json> [--annuler] [--apply]");
    process.exit(2);
}

const empreinte = (f) => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex");

function unrealOuvert() {
    try {
        return /UnrealEditor/i.test(execSync("tasklist", { encoding: "latin1" }));
    } catch {
        return false;
    }
}

function main() {
    const m = JSON.parse(fs.readFileSync(path.resolve(RACINE, manifeste), "utf8"));
    const sauvegarde = path.join(ADK, "_sauvegardes", `2026-09-13-${m.pack}-restauration`);
    const entrees = m.perdues.filter((p) => !p.carte);
    const cartes = m.perdues.filter((p) => p.carte);

    console.log(`${annuler ? "ANNULATION" : "RESTAURATION"} ${m.pack} : ${entrees.length} paquet(s)`
        + `${cartes.length ? `, ${cartes.length} carte(s) ecartee(s)` : ""}${appliquer ? "" : "  (simulation)"}`);
    if (appliquer && unrealOuvert()) {
        console.error("ARRET : un Unreal tourne. Le fermer SANS sauvegarder, puis relancer.");
        return 1;
    }

    let faits = 0;
    let echecs = 0;
    for (const e of entrees) {
        const dansAdk = path.join(m.promu, e.asset);
        const original = path.join(m.original, e.asset);
        const copie = path.join(sauvegarde, e.asset);
        const [source, cible] = annuler ? [copie, dansAdk] : [original, dansAdk];
        if (!fs.existsSync(source)) {
            console.log(`  ABSENT ${source}`);
            echecs += 1;
            continue;
        }
        if (!appliquer) {
            console.log(`  ${e.asset}  ${fs.statSync(cible).size} o -> ${fs.statSync(source).size} o`);
            continue;
        }
        if (!annuler && !fs.existsSync(copie)) {
            fs.mkdirSync(path.dirname(copie), { recursive: true });
            fs.copyFileSync(dansAdk, copie);
        }
        fs.unlinkSync(cible);
        fs.copyFileSync(source, cible);
        if (empreinte(source) !== empreinte(cible)) {
            console.log(`  ECHEC copie ${e.asset}`);
            echecs += 1;
            continue;
        }
        faits += 1;
    }
    if (appliquer) {
        console.log(`${faits} fichier(s) ${annuler ? "remis" : "restaure(s)"}, ${echecs} echec(s) ; sauvegardes : ${sauvegarde}`);
    } else {
        console.log("Simulation : rien ecrit (--apply pour ecrire).");
    }
    return echecs > 0 ? 1 : 0;
}

process.exitCode = main();