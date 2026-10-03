import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// minimap-cablage-check.mjs — la minimap Ako est-elle BRANCHÉE, de l'ADK au client ?
//
//   node scripts/lua-harness/minimap-cablage-check.mjs
//
// ── CE QUI NE PEUT PAS SE VOIR AILLEURS ───────────────────────────────────────
// La minimap traverse cinq frontières que rien d'autre ne relie : la config du
// cook (NeverCook, redirections), la fermeture en liens durs, le constructeur de
// pack (WidgetBlueprint), le catalogue généré, et le client. Chaque maillon est une
// CHAÎNE écrite deux fois ; un seul qui glisse, et le widget ne trouve plus son
// joueur — sans une erreur.
//
// ── LA SOURCE DES ATTENTES EST LA MESURE, PAS UNE COPIE ───────────────────────
// Les classes de démo à rediriger ne sont pas recopiées ici : elles sont LUES dans
// l'export T3D du DataAsset (`adk/_manifests/ako-sonde-da.t3d`, sonde du
// 2026-09-13). Si le pack changeait de DataAsset, ce contrôle suivrait la mesure.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const RACINE = RACINE_DEPOT + "";
const ADK = `${RACINE}/WebPortal/Server/adk`;
const PAQUETS = `${RACINE}/WebPortal/Server/nanos_world/packages`;

let reussis = 0;
let echecs = 0;
const ok = (condition, nom) => {
  if (condition) reussis++;
  else { echecs++; console.log(`  ECHEC  ${nom}`); }
};
const lire = (chemin) => {
  if (!fs.existsSync(chemin)) { ok(false, `fichier présent : ${chemin}`); return ""; }
  return fs.readFileSync(chemin, "utf8");
};
const sansCommentairesLua = (s) => s.replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, "").replace(/--.*$/gm, "");
const sansCommentairesIni = (s) => s.split(/\r?\n/).filter((l) => !/^\s*;/.test(l)).join("\n");
const tous = (source, motif) => [...source.matchAll(motif)].map((m) => m[1]);

// ── 1. La mesure : ce que le DataAsset cite ──────────────────────────────────
console.log("[mesure]");
const t3d = lire(`${ADK}/_manifests/ako-sonde-da.t3d`);
const classeDe = (ligne) => ligne.match(/BlueprintGeneratedClass'([^']+)'/)?.[1] ?? null;
const lignes = t3d.split(/\r?\n/).map((l) => l.trim());
const joueur = classeDe(lignes.find((l) => l.startsWith("player ref=")) ?? "");
const items = lignes.filter((l) => l.startsWith("item_setting("));
const chemins = lignes.filter((l) => l.startsWith("actor path=") || l.startsWith("add_paths(")).map(classeDe).filter(Boolean);
const uniques = items.filter((l) => /justonespecificactor\?_[0-9]+_[0-9A-F]+=True/.test(l)).map(classeDe);
const multiples = items.filter((l) => !/justonespecificactor\?_[0-9]+_[0-9A-F]+=True/.test(l)).map(classeDe);
ok(joueur !== null, "la sonde donne la classe du joueur (player ref)");
ok(items.length > 0, `la sonde donne les repères (item_setting : ${items.length})`);
const demo = new Set([joueur, ...chemins, ...uniques, ...multiples].filter(Boolean));
ok([...demo].every((c) => c.includes("/Example_Content_Demo/")), "toutes les classes citées viennent de la démo");

// ── 2. La config du cook ─────────────────────────────────────────────────────
console.log("[config]");
const game = sansCommentairesIni(lire(`${ADK}/Config/DefaultGame.ini`));
const engine = sansCommentairesIni(lire(`${ADK}/Config/DefaultEngine.ini`));
ok(/\+DirectoriesToNeverCook=\(Path="Ako_Mini_Map_sys"\)/.test(game), "la jonction Ako_Mini_Map_sys ne cuit pas");
ok(engine.includes('+PackageRedirects=(OldName="/Game/Ako_Mini_Map_sys/",NewName="/Game/Narvos/Ako_Mini_Map_sys/",MatchSubstring=true)'),
  "PackageRedirect /Game/Ako_Mini_Map_sys/ -> Narvos/");

/** La cible d'une classe de démo, lue dans les redirections — et exigée sous les 4 formes. */
const cibleDe = (classe) => {
  const cibles = new Set();
  const narvos = classe.replace("/Game/Ako_Mini_Map_sys/", "/Game/Narvos/Ako_Mini_Map_sys/");
  for (const type of ["ClassRedirects", "ObjectRedirects"]) {
    for (const ancien of [classe, narvos]) {
      const m = engine.match(new RegExp(`\\+${type}=\\(OldName="${ancien.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}",NewName="([^"]+)"\\)`));
      ok(m !== null, `${type} pour ${ancien.split("/").pop()} (${ancien === classe ? "chemin d'origine" : "chemin Narvos"})`);
      if (m) cibles.add(m[1]);
    }
  }
  ok(cibles.size <= 1, `${classe.split("/").pop()} : une seule cible pour les quatre formes`);
  return [...cibles][0] ?? null;
};
const proxy = (nom) => `/Game/Narvos/Minimap/${nom}.${nom}_C`;
if (joueur) ok(cibleDe(joueur) === proxy("BP_NarvosCarteJoueur"), "player ref -> BP_NarvosCarteJoueur");
for (const c of new Set(uniques)) ok(cibleDe(c) === proxy("BP_NarvosCarteVide"),
  `${c.split("/").pop()} (« un acteur précis » : artefact de démo) -> BP_NarvosCarteVide`);
for (const c of new Set(chemins)) ok(cibleDe(c) === proxy("BP_NarvosCarteVide"), `${c.split("/").pop()} (chemins) -> BP_NarvosCarteVide`);
const repere = [...new Set(multiples)].filter((c) => !uniques.includes(c));
ok(repere.length >= 1, "au moins une classe de repère n'est pas partagée avec « un acteur précis »");
for (const c of repere) ok(cibleDe(c) === proxy("BP_NarvosCarteRepere"), `${c.split("/").pop()} (repères) -> BP_NarvosCarteRepere`);

// Chaque cible est un Blueprint que la session éditeur crée.
const creation = lire(`${RACINE}/scripts/adk-creer-bp-minimap.py`);
const noms = tous(creation.match(/NOMS = \[([^\]]*)\]/)?.[1] ?? "", /"([^"]+)"/g);
for (const cible of new Set(tous(engine, /NewName="\/Game\/Narvos\/Minimap\/([A-Za-z0-9_]+)\./g))) {
  ok(noms.includes(cible), `la cible ${cible} est créée par adk-creer-bp-minimap.py`);
}
ok(/adk-creer-bp-minimap\.py/.test(lire(`${RACINE}/scripts/adk-session-lot3.py`)), "la session du lot 3 crée les proxies");

// ── 3. La fermeture en liens durs ────────────────────────────────────────────
console.log("[fermeture]");
const manifeste = JSON.parse(lire(`${ADK}/_manifests/ako_mini_map_sys-promotion.json`) || "{}");
for (const r of ["ui/ui_minimap_showup", "ui/ui_minimap", "DA_MinimapSettings_Track", "map_data_blueprint/ACTORS/BP_MAP_Bounds"]) {
  ok((manifeste.racines ?? []).includes(`/Game/Ako_Mini_Map_sys/ako_mini_map_Content/${r}`), `racine liée : ${r}`);
}
ok((manifeste.racines ?? []).some((r) => r.endsWith("/Box_board")), "Box_board (mesh de la boîte de bornes) est lié");
ok(fs.existsSync(`${ADK}/Content/Narvos/Ako_Mini_Map_sys/ako_mini_map_Content/ui/ui_minimap_showup.uasset`), "le widget est lié sous Narvos/");
ok(!fs.existsSync(`${ADK}/Content/Narvos/Ako_Mini_Map_sys/Example_Content_Demo/blueprint_proj`), "aucune classe de la démo n'est liée");

// ── 4. Constructeur de pack et catalogue généré ──────────────────────────────
console.log("[pack]");
const builder = lire(`${RACINE}/scripts/nanos-build-asset-pack.mjs`);
ok(/^\s*WidgetBlueprint: "blueprints",/m.test(builder), "le constructeur déclare les WidgetBlueprint sous [assets.blueprints]");
const generateur = lire(`${RACINE}/scripts/narvos-minimap-to-lua.mjs`);
const ids = tous(generateur, /\{ id: "([A-Z]+)", chemin:/g);
const client = sansCommentairesLua(lire(`${PAQUETS}/narvos-map-proto/Client/Minimap.lua`));
const lus = new Set(tous(client, /Catalogue\(\)\.([A-Z_]+)/g));
for (const champ of lus) {
  ok(ids.includes(champ) || champ === "BOITE_DEMI_ETENDUE_CM" || champ === "PRETE", `Client/Minimap.lua lit Minimap.${champ}, que le générateur produit`);
}
for (const id of ids) ok(lus.has(id), `le générateur produit Minimap.${id}, que le client lit`);
const shared = sansCommentairesLua(lire(`${PAQUETS}/narvos/Shared/Index.lua`));
ok(shared.includes('Package.Require("Catalogs/Minimap.lua")'), "Shared/Index.lua charge le catalogue Minimap");
const verif = lire(`${RACINE}/scripts/narvos-verifier-catalogues.mjs`);
ok(/REGENERES_PAR_LA_CHAINE = new Set\(\[[\s\S]*?"Minimap\.lua"/.test(verif), "Minimap.lua est hors verrou (régénéré par la chaîne)");
const lance = (script) => /narvos-minimap-to-lua\.mjs"?\s+--apply/.test(script);
ok(lance(lire(`${RACINE}/.hermes/cook-lot3.sh`)), "le lot 3 régénère Minimap.lua");
ok(lance(lire(`${RACINE}/scripts/narvos-chaine-cook.sh`)), "la chaîne de cook générale régénère Minimap.lua");
ok(fs.existsSync(`${ADK}/_manifests/ako-bornes.json`), "la boîte de bornes est MESURÉE (ako-bornes.json)");

// ── 5. Le client et le serveur ───────────────────────────────────────────────
console.log("[client]");
const index = sansCommentairesLua(lire(`${PAQUETS}/narvos-map-proto/Client/Index.lua`));
ok(index.includes('Package.Require("Client/Minimap.lua")'), "Client/Index.lua charge Client/Minimap.lua");
for (const e of ["Narvos:Radar", "Narvos:Voyage", "Narvos:Minimap:Regler"]) {
  ok(client.includes(`Events.SubscribeRemote("${e}"`), `Client/Minimap.lua écoute ${e}`);
}
ok(client.includes('Events.CallRemote("Narvos:DemanderRadar"'), "la minimap demande le radar (source unique)");
ok(/AttachTo\(character, AttachmentRule\.SnapToTarget/.test(client), "le proxy joueur est attaché au personnage");
ok(/SetVisibility\([^)]*VisibleNotHitTestable/.test(client), "le widget ne capte pas la souris");
ok(/if \(Pret\(\)\) then/.test(client), "rien n'est posé tant que le catalogue n'est pas prêt");
const serveur = sansCommentairesLua(lire(`${PAQUETS}/narvos-map-proto/Server/Index.lua`));
ok(serveur.includes('Events.SubscribeRemote("Narvos:DemanderRadar"'), "le serveur répond au radar");
ok(/COMMANDES\.minimap = function/.test(serveur) && serveur.includes('Events.CallRemote("Narvos:Minimap:Regler"'),
  "/minimap relaie le réglage au client");

console.log("");
console.log(`${reussis} reussis, ${echecs} echec(s)`);
if (echecs > 0) process.exitCode = 1;