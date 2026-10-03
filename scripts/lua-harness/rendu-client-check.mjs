import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// rendu-client-check.mjs — le projet qui CUIT a-t-il les memes reglages de rendu que
// le CLIENT nanos qui DESSINE ?
//
//   node scripts/lua-harness/rendu-client-check.mjs
//
// ── LE DEFAUT QU'IL FERME (vu en jeu le 2026-09-13) ─────────────────────────────
// Du MetaHuman, seules les tongs s'affichaient. Le client mesurait un squelette
// parfait (/diag : bornes 172 cm, os a quelques cm du porteur) : rien n'etait dessine.
// L'ADK avait gagne trois reglages que l'invite MetaHuman ajoute au projet —
// r.GPUSkin.Support16BitBoneIndex, r.GPUSkin.UnlimitedBoneInfluences,
// SkeletalMesh.UseExperimentalChunking — et que le client n'a pas. Ils changent le
// FORMAT des sommets cuits : l'editeur (qui les a) rend tout, le client non.
//
// ── LA REGLE, SUR LA FORME ─────────────────────────────────────────────────────
// Chaque cle de [/Script/Engine.RendererSettings] doit avoir la meme valeur dans
// l'ADK et dans NanosWorld/Config/DefaultEngine.ini du client. Une cle presente d'un
// seul cote est un ecart aussi. Le client est la reference : c'est lui qui dessine.
// Sortie 1 sur tout ecart.
// ══════════════════════════════════════════════════════════════════════════════
import fs from "node:fs";

const ADK = RACINE_DEPOT + "/WebPortal/Server/adk/Config/DefaultEngine.ini";
const CLIENT = process.env.NANOS_CLIENT_INI
    ?? "D:/steam/steamapps/common/nanos-world-playtest/NanosWorld/Config/DefaultEngine.ini";
const SECTION = "[/Script/Engine.RendererSettings]";

function bloc(chemin) {
    const reglages = new Map();
    let dedans = false;
    for (const brute of fs.readFileSync(chemin, "utf8").split(/\r?\n/)) {
        const l = brute.trim();
        if (l.startsWith("[")) {
            dedans = l === SECTION;
            continue;
        }
        if (!dedans || l === "" || l.startsWith(";") || !l.includes("=")) continue;
        const i = l.indexOf("=");
        reglages.set(l.slice(0, i).trim().replace(/^[+-]/, ""), l.slice(i + 1).trim());
    }
    return reglages;
}

if (!fs.existsSync(CLIENT)) {
    console.log(`  ECHEC  configuration du client introuvable : ${CLIENT} (NANOS_CLIENT_INI)`);
    process.exit(1);
}
const adk = bloc(ADK);
const client = bloc(CLIENT);
let ecarts = 0;
for (const cle of [...new Set([...adk.keys(), ...client.keys()])].sort()) {
    const a = adk.get(cle);
    const c = client.get(cle);
    if (a !== c) {
        ecarts += 1;
        console.log(`  ECHEC  ${cle} : ADK=${a ?? "(absent)"} client=${c ?? "(absent)"}`);
    }
}
console.log(`${adk.size} reglage(s) de rendu ADK, ${client.size} client — ${ecarts} ecart(s)`);
console.log(`${ecarts === 0 ? 1 : 0} reussi(s), ${ecarts === 0 ? 0 : 1} echec(s)`);
process.exit(ecarts === 0 ? 0 : 1);