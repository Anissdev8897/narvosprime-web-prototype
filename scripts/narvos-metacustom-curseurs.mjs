#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// narvos-metacustom-curseurs.mjs — les CURSEURS du Meta Customization System, reliés
// de bout en bout : curseur du widget -> champ de la sauvegarde -> variable de l'ABP.
//
//   node scripts/narvos-metacustom-curseurs.mjs --corps <widget.pins.json> <abp.pins.json> [--apply]
//
// Entrées : deux dumps `get_node_pins` du serveur MCP de l'éditeur (EventGraph du
// widget Meta_Body_Tool/Widgets/Widget_Customization et de l'AnimBP_Body_Tool),
// plus `_manifests/metacustom-curseurs.json` (bornes lues dans l'éditeur par
// `find_object` : min, max, valeur des Slider).
// Sortie : `_manifests/metacustom-curseurs-corps.json`, lu par le générateur Lua.
//
// ── POURQUOI TROIS SOURCES ───────────────────────────────────────────────────
// Le pack ne relie PAS le curseur à l'os : le widget écrit un champ de SaveGame
// (`Saved_Head_Size`), et l'ABP recopie ce champ dans SA variable (`Head_Size`)
// à chaque image. Les noms ne se correspondent pas toujours — `Enable_Upper_Hip_Size`
// reçoit `Enable_Head_Size`, `Spine_5_size` reçoit `Saved_Spine_04_Size`. On ne
// devine donc aucun lien : chacun est LU dans un graphe.
// ═══════════════════════════════════════════════════════════════════════════════
import fs from "node:fs";

const MANIFESTES = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests";
const args = process.argv.slice(2);
const i = args.indexOf("--corps");
if (i < 0 || !args[i + 1] || !args[i + 2]) {
    console.error("usage : narvos-metacustom-curseurs.mjs --corps <widget.pins.json> <abp.pins.json> [--apply]");
    process.exit(2);
}
const APPLY = args.includes("--apply");

// Libellés français, décidés ici : les noms de widgets du pack ne sont pas des libellés.
const LIBELLES = {
    HeadSize_Slider_401: "Tête",
    UpperBodySize_Slider_646: "Haut du corps",
    BreastSize_Slider_594: "Poitrine",
    UpperWaistSize_Slider_549: "Taille haute",
    MiddleWaistSizeSlider_478: "Taille (milieu)",
    LowerWaistSize_Slider_448: "Taille basse",
    Thigh_Spacing_Slider_708: "Écart des cuisses",
    LowerHipSize_Slider_338: "Bas des hanches",
    Buttockssize_Slider_338: "Fessiers",
    Thigh_Size_Slider: "Cuisses",
    ShinSizeSlider_96: "Tibias",
    FootSizeSlider_305: "Pieds",
    Height_Slider: "Taille (hauteur)",
    Arm_LengthSlider_305: "Longueur des bras",
    ArmSizeSlider_305: "Bras",
    HandSizeSlider_305: "Mains",
};

const lire = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const graphe = (f) => {
    const g = lire(f);
    return { g, parId: new Map(g.nodes.map((n) => [n.id, n])) };
};

/** Dans une chaîne d'exécution partant d'un nœud, le premier « Set <var> » rencontré. */
function premierSet(parId, depart, motif) {
    const vus = new Set();
    const file = [depart];
    while (file.length) {
        const n = file.shift();
        if (!n || vus.has(n.id)) continue;
        vus.add(n.id);
        const m = n.class === "K2Node_VariableSet" && n.name.match(/^Set (.+)$/);
        if (m && motif.test(m[1])) return { variable: m[1], noeud: n };
        for (const p of n.pins ?? []) {
            if (p.direction === "Output" && p.type === "exec") {
                for (const c of p.connections) file.push(parId.get(c.nodeId));
            }
        }
    }
    return null;
}

/** La borne d'un Clamp placé devant la valeur, s'il y en a un. */
function clampDe(parId, noeudSet) {
    const entree = (noeudSet.pins ?? []).find((p) => p.direction === "Input" && p.type !== "exec" && p.isConnected && p.name !== "self");
    const suivre = (pin, profondeur) => {
        if (!pin || profondeur > 4) return null;
        for (const c of pin.connections) {
            const n = parId.get(c.nodeId);
            if (!n) continue;
            if (/Clamp/.test(n.name)) {
                const min = n.pins.find((p) => p.name === "Min");
                const max = n.pins.find((p) => p.name === "Max");
                return { min: Number(min?.defaultValue), max: Number(max?.defaultValue) };
            }
            const amont = (n.pins ?? []).find((p) => p.direction === "Input" && p.isConnected);
            const r = suivre(amont, profondeur + 1);
            if (r) return r;
        }
        return null;
    };
    return suivre(entree, 0);
}

function main() {
    const widget = graphe(args[i + 1]);
    const abp = graphe(args[i + 2]);
    const bornes = lire(`${MANIFESTES}/metacustom-curseurs.json`);

    // 1. curseur -> champ de sauvegarde (et case -> champ d'activation)
    const curseurs = [];
    const cases = {};
    for (const n of widget.g.nodes) {
        const mc = n.name.match(/^On Value Changed \((.+)\)$/);
        const mk = n.name.match(/^On Check State Changed \((.+)\)$/);
        if (mc) {
            const s = premierSet(widget.parId, n, /^Saved_/);
            if (s) curseurs.push({ curseur: mc[1], champ: s.variable, clamp: clampDe(widget.parId, s.noeud) });
        } else if (mk) {
            const s = premierSet(widget.parId, n, /^Enable_/);
            if (s) cases[mk[1]] = s.variable;
        }
    }

    // 2. champ de sauvegarde -> variable(s) de l'ABP. Un champ peut en nourrir
    // DEUX : `Enable_Chest_Size` pose `Modify_Chest` ET `Enable_Chest_Size`.
    const versAbp = {};
    for (const n of abp.g.nodes) {
        const m = n.class === "K2Node_VariableSet" && n.name.match(/^Set (.+)$/);
        if (!m) continue;
        const valeur = (n.pins ?? []).find((p) => p.direction === "Input" && p.type !== "exec" && p.name === m[1]);
        const c = valeur?.connections?.[0];
        const src = c && abp.parId.get(c.nodeId);
        const g = src && src.name.match(/^Get (Saved_.+|Enable_.+)$/);
        if (!g) continue;
        const liste = (versAbp[g[1]] ??= []);
        if (!liste.includes(m[1])) liste.push(m[1]);
    }

    // 3. les cases d'activation. Les noms du widget sont irreguliers (la case de
    // l'ecart des cuisses s'appelle Pelvis_SizeCheckBox_0) : l'appariement est
    // DECIDE ici, et verifie — une case ou un curseur absent du graphe fait echouer.
    const CASE_DU_CURSEUR = {
        Thigh_Size_Slider: "Thigh_SizeCheckBox_0",
        Height_Slider: "HeightCheckBox_0",
        Thigh_Spacing_Slider_708: "Pelvis_SizeCheckBox_0",
        UpperBodySize_Slider_646: "UpperBodyCheckBox_0",
        BreastSize_Slider_594: "ChestSizeCheckbox",
        UpperWaistSize_Slider_549: "UpperWaistCheckbox",
        MiddleWaistSizeSlider_478: "MiddleWaistCheckbox",
        LowerWaistSize_Slider_448: "LowerWaistCheckbox",
        HeadSize_Slider_401: "HeadCheckbox",
        LowerHipSize_Slider_338: "LowerHipCheckbox",
        Buttockssize_Slider_338: "ButtocksCheckbox",
        ShinSizeSlider_96: "ShinCheckbox",
        FootSizeSlider_305: "FootCheckbox",
        Arm_LengthSlider_305: "ArmLengthCheckbox",
        ArmSizeSlider_305: "ArmSizeCheckbox",
        HandSizeSlider_305: "HandCheckbox",
    };

    const sortie = curseurs.map((c) => {
        const b = bornes.corps_widgets[c.curseur] ?? {};
        const caseUi = CASE_DU_CURSEUR[c.curseur];
        const champActivation = caseUi ? cases[caseUi] : null;
        const variables = versAbp[c.champ] ?? [];
        return {
            id: c.curseur.replace(/_?Slider(_\d+)?$/i, "").replace(/_(\d+)$/, "").toLowerCase(),
            label: LIBELLES[c.curseur] ?? c.curseur,
            curseur: c.curseur,
            champ: c.champ,
            variable: variables[0] ?? null,
            min: c.clamp?.min ?? b.min_value ?? 0,
            max: c.clamp?.max ?? b.max_value ?? 1,
            defaut: b.value ?? bornes.corps_abp_defauts?.[variables[0]] ?? 1,
            pas: b.step_size ?? 0.01,
            case_ui: caseUi ?? null,
            activation: champActivation ? (versAbp[champActivation] ?? []) : [],
        };
    });

    const orphelins = sortie.filter((s) => !s.variable || s.activation.length === 0);
    for (const s of sortie) {
        console.log(`${s.label.padEnd(20)} ${s.curseur.padEnd(28)} ${String(s.champ).padEnd(28)} -> ${String(s.variable).padEnd(22)} [${s.min}..${s.max}] defaut ${s.defaut} actif=${s.activation.join("+")}`);
    }
    console.log(`${sortie.length} curseur(s), ${orphelins.length} sans variable ou sans activation`);
    if (!APPLY) return;
    fs.writeFileSync(`${MANIFESTES}/metacustom-curseurs-corps.json`, JSON.stringify({
        genere_par: "scripts/narvos-metacustom-curseurs.mjs",
        curseurs: sortie,
    }, null, 1) + "\n");
    console.log("ecrit : metacustom-curseurs-corps.json");
    if (orphelins.length) process.exitCode = 1;
}

main();