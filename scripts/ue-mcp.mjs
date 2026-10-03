#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// ue-mcp.mjs — appeler un outil du serveur MCP de l'éditeur (UnrealMCPServer)
// depuis le shell, SANS passer par la connexion MCP de Claude Code.
//
//   node scripts/ue-mcp.mjs --attendre 900              # attend que le serveur reponde
//   node scripts/ue-mcp.mjs --lister                    # noms des outils
//   node scripts/ue-mcp.mjs get_node_pins '{"asset_path":"/Game/X","graph_name":"AnimGraph"}'
//
// ── POURQUOI ──────────────────────────────────────────────────────────────────
// Le connecteur `unreal-mcp` de Claude Code ne se branche qu'au DEMARRAGE de la
// session : si l'editeur n'etait pas ouvert a ce moment-la, il reste en
// ConnectionRefused toute la session (reference_mcp_unreal). Le serveur, lui,
// parle JSON-RPC 2.0 sur HTTP (`POST http://127.0.0.1:13579/mcp`) et ne valide
// pas l'identifiant de session sur un POST (MCPHttpServer.cpp, HandleMCPPost).
//
// Ce que le Python de l'editeur ne sait pas faire et que ce serveur fait :
// lire et modifier les GRAPHES (get_node_pins, remove_node, connect_pins...).
//
// Sortie : le texte rendu par l'outil sur stdout ; code 1 si l'outil signale une
// erreur (isError) ou si le serveur ne repond pas.
// ══════════════════════════════════════════════════════════════════════════════
import { attendre, outil, rpc } from "./lib/ue-mcp-client.mjs";

async function main() {
    const [premier, second] = process.argv.slice(2);
    if (!premier) {
        console.error("usage : ue-mcp.mjs --attendre <s> | --lister | <outil> '<json>'");
        return 2;
    }
    if (premier === "--attendre") {
        const etat = await attendre(Number(second ?? 600));
        if (etat.pret) console.log(`serveur MCP pret : ${etat.outils} outil(s)`);
        else console.error(`serveur MCP muet (${etat.raison})`);
        return etat.pret ? 0 : 1;
    }
    if (premier === "--lister") {
        const outils = await rpc("tools/list");
        for (const o of outils.tools ?? []) console.log(o.name);
        return 0;
    }
    const { texte, erreur } = await outil(premier, second ? JSON.parse(second) : {});
    console.log(texte);
    return erreur ? 1 : 0;
}

main()
    .then((code) => { process.exitCode = code; })
    .catch((e) => {
        console.error(`ue-mcp : ${e.message}`);
        process.exitCode = 1;
    });