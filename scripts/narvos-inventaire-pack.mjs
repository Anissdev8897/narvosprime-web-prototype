#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// narvos-inventaire-pack.mjs — TOUT le contenu d'un pack Unreal, fichier par fichier,
// sans Unreal : classe de chaque asset, Blueprints et leur classe parente, widgets,
// AnimBP, maps. LECTURE SEULE.
//
//   node scripts/narvos-inventaire-pack.mjs <dossier Content du pack> [--md sortie.md]
//
// ── POURQUOI ─────────────────────────────────────────────────────────────────
// Retour de Hanibes, 2026-09-13 soir : « tu n'as pas vraiment consulté tous les
// fichiers qu'il y avait à l'intérieur ». Juger un pack sur ses dossiers les plus
// visibles laisse passer des systèmes entiers. Ce script ne choisit rien : il liste
// tout, et classe par NATURE (classe de l'export principal), jamais par nom.
// ═══════════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { lirePaquet } from "./lib/uasset-paquet.mjs";

const [dossier, ...reste] = process.argv.slice(2);
if (!dossier || !fs.existsSync(dossier)) {
    console.error("usage : narvos-inventaire-pack.mjs <dossier Content du pack> [--md sortie.md]");
    process.exit(2);
}
const iMd = reste.indexOf("--md");
const SORTIE_MD = iMd >= 0 ? reste[iMd + 1] : null;

const CLASSES_LOGIQUE = /Blueprint|WidgetBlueprint|AnimBlueprint|ControlRig|GameMode|SaveGame|DataTable|Struct|Enum|Interface|InputAction|InputMappingContext|LevelSequence/;

function* fichiers(d) {
    for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        const st = fs.statSync(p);
        if (st.isDirectory()) yield* fichiers(p);
        else if (/\.(uasset|umap)$/i.test(f)) yield { p, taille: st.size };
    }
}

function nature(P, nomFichier) {
    const principal = P.exports.find((e) => e.nom === nomFichier)
        ?? P.exports.find((e) => !/^Default__/.test(e.nom) && !/_GEN_VARIABLE$/.test(e.nom));
    return principal?.classe ?? "?";
}

/** La classe parente d'un Blueprint : l'import de la classe générée dont hérite `<Nom>_C`. */
function parentDe(P) {
    const imp = P.imports.find((i) => i.className === "BlueprintGeneratedClass" || i.className === "WidgetBlueprintGeneratedClass" || i.className === "AnimBlueprintGeneratedClass");
    const natif = P.imports.find((i) => i.className === "Class" && !/^(Object|Package|BlueprintGeneratedClass|Class)$/.test(i.objectName)
        && /Actor|Character|Pawn|UserWidget|AnimInstance|SaveGame|GameMode|PlayerController|ActorComponent|Object/.test(i.objectName));
    return imp?.path ?? natif?.objectName ?? null;
}

const racine = path.resolve(dossier);
const parDossier = new Map();
const logique = [];
const erreurs = [];
let total = 0, octets = 0;

for (const { p, taille } of fichiers(racine)) {
    total++; octets += taille;
    const rel = path.relative(racine, p).replace(/\\/g, "/");
    const dos = rel.includes("/") ? rel.split("/").slice(0, 2).join("/") : ".";
    let classe = "?";
    try {
        const P = lirePaquet(p);
        classe = nature(P, path.basename(p).replace(/\.(uasset|umap)$/i, ""));
        if (/\.umap$/i.test(p)) classe = "World";
        if (CLASSES_LOGIQUE.test(classe) || /\.umap$/i.test(p)) {
            logique.push({ rel, classe, parent: parentDe(P), taille });
        }
    } catch (e) {
        erreurs.push(`${rel} : ${e.message}`);
    }
    const d = parDossier.get(dos) ?? { total: 0, octets: 0, classes: {} };
    d.total++; d.octets += taille; d.classes[classe] = (d.classes[classe] ?? 0) + 1;
    parDossier.set(dos, d);
}

const lignes = [];
lignes.push(`# Inventaire — ${path.basename(racine)}`, "",
    `${total} fichier(s), ${(octets / 1048576).toFixed(0)} Mo, ${erreurs.length} illisible(s).`, "",
    "## Par dossier (classe de l'export principal)", "");
for (const [d, info] of [...parDossier.entries()].sort()) {
    const classes = Object.entries(info.classes).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(", ");
    lignes.push(`- **${d}** — ${info.total} fichier(s), ${(info.octets / 1048576).toFixed(1)} Mo : ${classes}`);
}
lignes.push("", "## Logique : Blueprints, widgets, AnimBP, sauvegardes, maps", "");
for (const l of logique.sort((a, b) => a.rel.localeCompare(b.rel))) {
    lignes.push(`- \`${l.rel}\` — ${l.classe}${l.parent ? ` (parent ${l.parent})` : ""}`);
}
if (erreurs.length) lignes.push("", "## Illisibles", "", ...erreurs.map((e) => `- ${e}`));
const texte = lignes.join("\n") + "\n";
if (SORTIE_MD) { fs.writeFileSync(SORTIE_MD, texte); console.log(`ecrit : ${SORTIE_MD}`); }
console.log(`${total} fichier(s), ${logique.length} asset(s) de logique, ${erreurs.length} illisible(s)`);