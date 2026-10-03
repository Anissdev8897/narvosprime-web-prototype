// ══════════════════════════════════════════════════════════════════════════════
// ue-mcp-client.mjs — client JSON-RPC du serveur MCP de l'editeur (UnrealMCPServer,
// POST http://127.0.0.1:13579/mcp). Utilise par scripts/ue-mcp.mjs (ligne de
// commande) et par les scripts qui modifient des GRAPHES — ce que le Python de
// l'editeur ne sait pas faire.
//
// ⚠ Un cook lance pendant la session VOLE le port 13579 (le plugin se charge aussi
// dans les commandlets) : le serveur accepte la connexion et ne repond jamais.
// ══════════════════════════════════════════════════════════════════════════════
import http from "node:http";

const URL_MCP = new URL(process.env.UE_MCP_URL ?? "http://127.0.0.1:13579/mcp");
const DELAI_REQUETE_MS = 120_000;
const PAS_ATTENTE_MS = 5_000;

let prochainId = 1;

// `node:http` sans agent et `Connection: close`, pas `fetch` : le socket keep-alive
// d'undici encore en fermeture au `process.exit` fait lever a libuv
// « Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) » (code 127, mesure).
export function rpc(methode, params = {}) {
    const corps = JSON.stringify({ jsonrpc: "2.0", id: prochainId++, method: methode, params });
    return new Promise((resoudre, rejeter) => {
        const requete = http.request({
            hostname: URL_MCP.hostname,
            port: URL_MCP.port,
            path: URL_MCP.pathname,
            method: "POST",
            agent: false,
            timeout: DELAI_REQUETE_MS,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json, text/event-stream",
                Connection: "close",
                "Content-Length": Buffer.byteLength(corps),
            },
        }, (reponse) => {
            const morceaux = [];
            reponse.on("data", (m) => morceaux.push(m));
            reponse.on("end", () => {
                try {
                    const json = JSON.parse(Buffer.concat(morceaux).toString("utf8"));
                    if (json.error) {
                        rejeter(new Error(`${methode} : ${json.error.message ?? JSON.stringify(json.error)}`));
                    } else {
                        resoudre(json.result);
                    }
                } catch (e) {
                    rejeter(new Error(`${methode} : reponse illisible (${e.message})`));
                }
            });
        });
        requete.on("timeout", () => requete.destroy(new Error(`${methode} : pas de reponse en ${DELAI_REQUETE_MS} ms`)));
        requete.on("error", rejeter);
        requete.end(corps);
    });
}

/** Appelle un outil ; rend { texte, erreur } — `erreur` vrai si l'outil signale isError. */
// ⚠ LE SERVEUR LIMITE A 120 REQUETES PAR MINUTE (MCPSettings.cpp:9,
// `MaxRequestsPerMinute`, fenetre glissante de 60 s, MCPHttpServer.cpp:585) et rend
// alors `{"error":"Rate limit exceeded"}`. Mesure le 2026-09-13 : un graphe de
// ~80 noeuds depasse la limite au bout de trois fonctions. On ATTEND et on
// reprend, plutot que de laisser un graphe a moitie relie.
const PAUSE_LIMITE_MS = 15_000;
const REPRISES_LIMITE = 8;

export async function outil(nom, args = {}) {
    let resultat;
    for (let essai = 0; ; essai++) {
        try {
            resultat = await rpc("tools/call", { name: nom, arguments: args });
            break;
        } catch (e) {
            if (!/Rate limit exceeded/i.test(e.message) || essai >= REPRISES_LIMITE) throw e;
            await new Promise((r) => setTimeout(r, PAUSE_LIMITE_MS));
        }
    }
    const texte = (resultat.content ?? []).map((c) => c.text ?? "").join("\n");
    return { texte, erreur: Boolean(resultat.isError) };
}

/** Comme `outil`, mais leve si l'outil echoue, et decode le JSON rendu. */
export async function outilJson(nom, args = {}) {
    const { texte, erreur } = await outil(nom, args);
    if (erreur) throw new Error(`${nom} : ${texte}`);
    return JSON.parse(texte);
}

export async function attendre(secondes) {
    const fin = Date.now() + secondes * 1000;
    let derniere = "";
    while (Date.now() < fin) {
        try {
            await rpc("initialize", {
                protocolVersion: "2025-06-18",
                capabilities: {},
                clientInfo: { name: "ue-mcp-client.mjs", version: "1" },
            });
            const outils = await rpc("tools/list");
            return { pret: true, outils: outils.tools?.length ?? 0 };
        } catch (e) {
            derniere = e.message;
            await new Promise((r) => setTimeout(r, PAS_ATTENTE_MS));
        }
    }
    return { pret: false, raison: derniere };
}