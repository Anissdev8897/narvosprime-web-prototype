#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// adk-visage-sans-livelink.mjs — retirer LiveLink des ABP de visage MetaHuman
// DANS L'EDITEUR OUVERT, par le serveur MCP (le Python de l'editeur ne lit ni ne
// modifie un graphe).
//
//   node scripts/adk-visage-sans-livelink.mjs            # simulation : plan seul
//   node scripts/adk-visage-sans-livelink.mjs --apply    # modifie + compile
//   puis : python scripts/ue-remote.py --code "exec(open(r'.../adk-visage-sans-livelink.py').read()); sauver()"
//
// Precondition : les copies existent (adk-visage-sans-livelink.py, dupliquer()).
//
// ── POURQUOI ──────────────────────────────────────────────────────────────────
// Crash client du 2026-09-13 14:14:42 : `Face_AnimBP` (visage des MetaHumans) a un
// noeud `AnimNode_LiveLinkPose`, module `LiveLinkAnimationCore`, ABSENT du client
// nanos -> propriete de noeud nulle au chargement de l'ABP -> lecture a 0x44.
// Releve le meme jour dans l'executable du client (nom termine par NUL) :
//   ABSENTS  LiveLinkAnimationCore (AnimNode_LiveLinkPose, LiveLinkRemapAsset),
//            /Script/LiveLink (LiveLinkBlueprintLibrary : EvaluateLiveLinkFrame...,
//            GetPropertyValue)
//   PRESENTS LiveLinkInterface (LiveLinkSubjectName, LiveLinkBasicBlueprintData)
//
// ── LA CHIRURGIE, par la FORME du defaut (aucun GUID ecrit a la main) ──────────
//   AnimGraph  chaque noeud `AnimGraphNode_*LiveLink*` est CONTOURNE : la source de
//              sa pose d'entree est rebranchee sur les cibles de sa pose de sortie.
//              Sans sujet LiveLink, le noeud n'etait qu'un passe-plat : le rendu ne
//              change pas.
//   EventGraph noeuds de classe `*LiveLink*` et appels de fonction portant une broche
//              LiveLink (GetPropertyValue) retires. Ce qui n'etait atteignable que
//              par eux est elague a la compilation (ARKit_HeadRotation reste a 0,
//              comme aujourd'hui sans LiveLink).
//   Cascade    un noeud dont TOUS les liens menaient a des noeuds retires est retire
//              (le getter de LLink_Face_Subj). Les variables restent : les BP
//              MetaHuman les ecrivent par nom, les retirer casserait leur bytecode.
// ══════════════════════════════════════════════════════════════════════════════
import { attendre, outil, outilJson } from "./lib/ue-mcp-client.mjs";

const ABPS = [
    "/Game/Narvos/PontMetaHuman/ABP_NarvosVisage",
    "/Game/Narvos/PontMetaHuman/ABP_NarvosVisageOutil",
];
const GRAPHE_ANIM = "AnimGraph";
const PINS_POSE = new Set(["PoseLink", "ComponentSpacePoseLink"]);
const INTOUCHABLES = /^(AnimGraphNode_Root|K2Node_Event|K2Node_FunctionEntry|K2Node_FunctionResult|EdGraphNode_Comment|K2Node_Tunnel)/;

const appliquer = process.argv.includes("--apply");

const estLiveLink = (texte) => /LiveLink/i.test(texte ?? "");
const court = (n) => `${n.class}#${n.id.slice(0, 6)} « ${n.name.split("\n")[0]} »`;

const entreePose = (n) => n.pins.find((p) => p.direction === "Input" && PINS_POSE.has(p.subType));
const sortiePose = (n) => n.pins.find((p) => p.direction === "Output" && PINS_POSE.has(p.subType));

function primaires(graphe, noeuds) {
    const parId = new Map(noeuds.map((n) => [n.id, n]));
    const retires = new Set();
    for (const n of noeuds) {
        if (INTOUCHABLES.test(n.class)) continue;
        if (estLiveLink(n.class)) retires.add(n.id);
        else if (graphe !== GRAPHE_ANIM && n.class === "K2Node_CallFunction"
            && n.pins.some((p) => estLiveLink(p.subType))) retires.add(n.id);
    }
    // La pose de correspondance ARKit (PoseBlendNode) lit les courbes que LiveLink
    // ecrit : alimentee par un noeud LiveLink, elle ne sert qu'a lui et part avec.
    // Mesure du 2026-09-13 : dans Metahuman_Ref, sa PoseAsset (celle de Meta_Body_Tool)
    // n'a pas de squelette dans l'ADK — « references Pose Asset that uses a missing
    // skeleton », l'ABP d'origine ne compilait deja PAS.
    if (graphe === GRAPHE_ANIM) {
        for (const n of noeuds) {
            if (n.class !== "AnimGraphNode_PoseBlendNode") continue;
            const sources = entreePose(n)?.connections ?? [];
            if (sources.some((c) => retires.has(c.nodeId) && estLiveLink(parId.get(c.nodeId)?.class))) retires.add(n.id);
        }
    }
    return retires;
}

// Contournement TRANSITIF des noeuds de pose retires : chaque source restante qui
// entre dans une chaine retiree est rebranchee sur les cibles restantes en sortie de
// chaine (BodyPose -> LiveLinkPose -> PoseBlendNode -> ModifyCurve devient
// BodyPose -> ModifyCurve).
function contournements(noeuds, retires) {
    const parId = new Map(noeuds.map((n) => [n.id, n]));
    const ponts = [];
    const ciblesRestantes = (id, vus = new Set()) => {
        if (vus.has(id)) return [];
        vus.add(id);
        const sortie = sortiePose(parId.get(id));
        return (sortie?.connections ?? []).flatMap((c) => (retires.has(c.nodeId) ? ciblesRestantes(c.nodeId, vus) : [c]));
    };
    for (const id of retires) {
        const n = parId.get(id);
        const entree = entreePose(n);
        if (!entree || !sortiePose(n)) continue;
        const sources = (entree.connections ?? []).filter((c) => !retires.has(c.nodeId));
        for (const s of sources) for (const c of ciblesRestantes(id)) ponts.push({ source: s, cible: c });
    }
    return ponts;
}

// Cascade : tous les liens d'un noeud menaient a des noeuds retires. Les extremites
// d'un contournement sont PROTEGEES — sinon la source de pose (le cache 'BodyPose',
// dont le seul lien allait au LiveLinkPose) partirait avec lui : premiere simulation
// du 2026-09-13, zero contournement.
function cascade(noeuds, retires, proteges) {
    for (let change = true; change;) {
        change = false;
        for (const n of noeuds) {
            if (retires.has(n.id) || proteges.has(n.id) || INTOUCHABLES.test(n.class)) continue;
            const liens = n.pins.flatMap((p) => p.connections ?? []);
            if (liens.length > 0 && liens.every((c) => retires.has(c.nodeId))) {
                retires.add(n.id);
                change = true;
            }
        }
    }
    return retires;
}

async function traiterGraphe(abp, graphe) {
    const { nodes: noeuds } = await outilJson("get_node_pins", { asset_path: abp, graph_name: graphe });
    const parId = new Map(noeuds.map((n) => [n.id, n]));
    const initiaux = primaires(graphe, noeuds);
    const ponts = graphe === GRAPHE_ANIM ? contournements(noeuds, initiaux) : [];
    const proteges = new Set(ponts.flatMap(({ source, cible }) => [source.nodeId, cible.nodeId]));
    const retires = cascade(noeuds, new Set(initiaux), proteges);

    console.log(`  ${graphe} : ${noeuds.length} noeud(s), ${retires.size} a retirer, ${ponts.length} contournement(s)`);
    for (const id of retires) console.log(`    - ${court(parId.get(id))}`);
    for (const { source, cible } of ponts) {
        console.log(`    + ${court(parId.get(source.nodeId))}.${source.pinName} -> ${court(parId.get(cible.nodeId))}.${cible.pinName}`);
    }
    if (!appliquer) return { retires: retires.size, ponts: ponts.length };

    for (const id of retires) {
        const { texte, erreur } = await outil("remove_node", { asset_path: abp, graph_name: graphe, node_id: id });
        if (erreur) throw new Error(`remove_node ${court(parId.get(id))} : ${texte}`);
    }
    for (const { source, cible } of ponts) {
        const { texte, erreur } = await outil("connect_pins", {
            asset_path: abp, graph_name: graphe,
            source_node_id: source.nodeId, source_pin_name: source.pinName,
            target_node_id: cible.nodeId, target_pin_name: cible.pinName,
        });
        if (erreur) throw new Error(`connect_pins : ${texte}`);
        console.log(`    ${texte}`);
    }
    return { retires: retires.size, ponts: ponts.length };
}

async function verifier(abp, graphes) {
    const restes = [];
    for (const graphe of graphes) {
        const { nodes: noeuds } = await outilJson("get_node_pins", { asset_path: abp, graph_name: graphe });
        for (const n of noeuds) {
            if (estLiveLink(n.class)) restes.push(`${graphe} : ${court(n)}`);
            if (graphe === GRAPHE_ANIM && n.class !== "AnimGraphNode_Root" && n.class.startsWith("AnimGraphNode_")) {
                const entreeVide = n.pins.find((p) => p.direction === "Input" && PINS_POSE.has(p.subType) && !p.isConnected);
                const sortieLiee = n.pins.some((p) => p.direction === "Output" && PINS_POSE.has(p.subType) && p.isConnected);
                if (entreeVide && sortieLiee) restes.push(`${graphe} : entree de pose VIDE sur ${court(n)}.${entreeVide.name}`);
            }
        }
    }
    return restes;
}

async function main() {
    const etat = await attendre(60);
    if (!etat.pret) {
        console.error(`ARRET : serveur MCP de l'editeur muet (${etat.raison})`);
        return 1;
    }
    let echecs = 0;
    for (const abp of ABPS) {
        console.log(`\n${abp}${appliquer ? "" : "  (simulation)"}`);
        const info = await outilJson("get_blueprint_info", { asset_path: abp });
        const graphes = [
            ...(info.functions ?? []).map((g) => g.name),
            ...(info.eventGraphs ?? []).map((g) => g.name),
        ];
        for (const graphe of graphes) await traiterGraphe(abp, graphe);
        if (!appliquer) continue;

        // L'outil rend « Compilation of 'X': Error » en SUCCES de requete (isError
        // seulement si BS_Error... selon la version) : lire le statut dans le texte.
        const { texte } = await outil("compile_blueprint", { asset_path: abp });
        console.log(`  ${texte}`);
        const restes = await verifier(abp, graphes);
        if (!/:\s*Success/.test(texte)) restes.push(`compilation : ${texte} — lire [Compiler] dans Saved/Logs/NanosWorldADK.log`);
        if (restes.length > 0) {
            echecs += 1;
            console.log("  ECHEC — restent :");
            for (const r of restes) console.log(`    ${r}`);
        } else {
            console.log("  OK : aucun noeud LiveLink, aucune entree de pose vide sur un noeud utilise");
        }
    }
    if (!appliquer) console.log("\nSimulation : rien modifie (--apply pour ecrire).");
    return echecs > 0 ? 1 : 0;
}

main()
    .then((code) => { process.exitCode = code; })
    .catch((e) => {
        console.error(`ARRET : ${e.message}`);
        process.exitCode = 1;
    });