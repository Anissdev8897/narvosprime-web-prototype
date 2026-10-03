#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// ue-bp-lire.mjs — un graphe Blueprint lu comme du PSEUDO-CODE.
//
//   node scripts/ue-bp-lire.mjs <dump get_node_pins.json> [evenement...]
//
// Entrée : la sortie de `node scripts/ue-mcp.mjs get_node_pins '{...}'` (serveur
// MCP de l'éditeur). Sortie : pour chaque nœud d'entrée (événement, fonction),
// la chaîne d'exécution, et pour chaque nœud ses entrées de données remontées
// jusqu'à leur source (valeur par défaut ou nœud qui la calcule).
//
// ── POURQUOI ─────────────────────────────────────────────────────────────────
// Un EventGraph de 400 nœuds rendu en JSON pèse 400 Ko : illisible à l'œil, et
// c'est pourtant la seule description exacte de ce que fait un Blueprint du
// Meta Customization System (quels événements, quels paramètres, qui lit quoi).
// ═══════════════════════════════════════════════════════════════════════════════
import fs from "node:fs";

const [fichier, ...filtres] = process.argv.slice(2);
if (!fichier) {
    console.error("usage : ue-bp-lire.mjs <dump.json> [evenement...]");
    process.exit(2);
}

const PROFONDEUR_DONNEES = 3;
const MAX_ETAPES = 400;

const graphe = JSON.parse(fs.readFileSync(fichier, "utf8"));
const parId = new Map(graphe.nodes.map((n) => [n.id, n]));
const nom = (n) => n.name.replace(/\n/g, " · ");

function source(n, pin, profondeur) {
    if (!pin.isConnected) {
        const d = pin.defaultValue ?? pin.default ?? pin.defaultObject ?? "";
        return d === "" ? "∅" : JSON.stringify(d);
    }
    return pin.connections.map((c) => {
        const amont = parId.get(c.nodeId);
        if (!amont) return `?${c.nodeId}`;
        if (profondeur <= 0 || /K2Node_Event|CustomEvent|FunctionEntry/.test(amont.class)) {
            return `${nom(amont)}.${c.pinName}`;
        }
        const entrees = (amont.pins ?? []).filter((p) => p.direction === "Input" && p.type !== "exec" && !p.isHidden);
        const args = entrees.map((p) => `${p.name}=${source(amont, p, profondeur - 1)}`).join(", ");
        return `${nom(amont)}(${args}).${c.pinName}`;
    }).join(" | ");
}

function suivants(n) {
    return (n.pins ?? [])
        .filter((p) => p.direction === "Output" && p.type === "exec" && p.isConnected)
        .map((p) => ({ pin: p.name, cibles: p.connections.map((c) => parId.get(c.nodeId)).filter(Boolean) }));
}

function derouler(depart) {
    const vus = new Set();
    let etapes = 0;
    const marcher = (n, retrait) => {
        if (etapes++ > MAX_ETAPES) return;
        if (vus.has(n.id)) { console.log(`${retrait}↺ ${nom(n)}`); return; }
        vus.add(n.id);
        const entrees = (n.pins ?? []).filter((p) => p.direction === "Input" && p.type !== "exec" && !p.isHidden);
        const args = entrees.map((p) => `${p.name}=${source(n, p, PROFONDEUR_DONNEES)}`).join(", ");
        console.log(`${retrait}${nom(n)}${args ? `  [${args}]` : ""}`);
        const sorties = suivants(n);
        for (const s of sorties) {
            const etiquette = sorties.length > 1 || s.pin !== "then" ? `${retrait}  ${s.pin} →` : null;
            if (etiquette) console.log(etiquette);
            for (const c of s.cibles) marcher(c, retrait + (etiquette ? "    " : ""));
        }
    };
    marcher(depart, "  ");
}

const entrees = graphe.nodes.filter((n) => /K2Node_Event|K2Node_CustomEvent|K2Node_FunctionEntry|ComponentBoundEvent/.test(n.class));
for (const e of entrees) {
    if (filtres.length && !filtres.some((f) => nom(e).toLowerCase().includes(f.toLowerCase()))) continue;
    const params = (e.pins ?? []).filter((p) => p.direction === "Output" && p.type !== "exec" && p.type !== "delegate");
    console.log(`\n■ ${nom(e)}(${params.map((p) => `${p.name}:${p.subType ?? p.type}`).join(", ")})`);
    derouler(e);
}