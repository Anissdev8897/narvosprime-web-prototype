// ══════════════════════════════════════════════════════════════════════════════
// narvos-preuve-metahuman.mjs — la preuve DISQUE, relue dans un processus NEUF, de
// la session du 2026-09-13 : drapeaux skeletal des materiaux de PNJ, et vrais
// MetaHumans (BP_NarvosMH_M / BP_NarvosMH_F).
//
//   node scripts/narvos-preuve-metahuman.mjs session   apres l'editeur, AVANT le cook
//   node scripts/narvos-preuve-metahuman.mjs cuit      apres le pack
//
// ── POURQUOI UN PROCESSUS NEUF ────────────────────────────────────────────────
// Une ecriture Unreal qui rate ne dit rien, et la relecture dans le MEME processus
// repond avec l'objet en memoire (feedback_ecriture_muette_unreal). Seuls les octets
// sur le disque tranchent :
//   session  le nom `bUsedWithSkeletalMesh` dans la table de noms du .uasset source
//            (un booleen a sa valeur par defaut n'est pas serialise : present = vrai) ;
//   cuit     `FGPUSkinVertexFactory` dans la shader map cuite — le type de sommets
//            qui manquait (les PNJ n'avaient que FLocalVertexFactory).
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype";
const CONTENT = `${RACINE}/WebPortal/Server/adk/Content`;
const PACK = `${RACINE}/WebPortal/Server/Assets/narvos`;
const USAGE = `${RACINE}/WebPortal/Server/adk/_manifests/usage-skeletal.json`;
const STANDARDS = `${RACINE}/WebPortal/Server/adk/_manifests/metahuman-standards.json`;
const ETAPE = process.argv[2];

if (!["session", "cuit"].includes(ETAPE)) {
  console.error("usage : node scripts/narvos-preuve-metahuman.mjs session|cuit");
  process.exit(2);
}

let defauts = 0;
const dire = (m) => console.log(m);
const defaut = (m) => { defauts++; console.log(`  DEFAUT  ${m}`); };
const relatif = (paquet) => paquet.replace(/^\/Game\//, "");
const octets = (fichiers) => fichiers.filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f).toString("latin1")).join("");
const source = (paquet) => octets([`${CONTENT}/${relatif(paquet)}.uasset`]);
const cuit = (paquet) => octets([".uasset", ".uexp"].map((e) => `${PACK}/${relatif(paquet)}${e}`));
const lireJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);

// ── 1. Materiaux ─────────────────────────────────────────────────────────────
const usage = lireJson(USAGE);
if (!usage) {
  defaut(`rapport absent : ${USAGE} (la session n'a pas tourne ?)`);
} else {
  const ecrits = (usage.corriges || []).filter((c) => c.ecrit);
  dire(`[materiaux] mode ${usage.mode} ; ${usage.meshes} SkeletalMesh, ${usage.bases} base(s) ; deja bonnes ${usage.deja} ; ` +
    `ecrites ${ecrits.length}/${(usage.corriges || []).length} ; liees en dur ${(usage.lies_en_dur || []).length} ; echecs ${(usage.echecs || []).length}`);
  if (usage.mode !== "appliquer") defaut("le rapport est une PASSE A BLANC");
  // Plus de 600 SkeletalMesh importes sous personnages seuls (skill nanos-world §2 bis) :
  // en dessous, le registre n'avait pas fini son balayage quand le script a tourne.
  if (usage.meshes < 300) defaut(`seulement ${usage.meshes} SkeletalMesh vus — registre partiel ?`);
  for (const e of (usage.echecs || []).slice(0, 5)) defaut(`echec editeur ${e.materiau} : ${e.raison}`);
  let prouves = 0;
  const manquants = [];
  // ── CUIT : UNE COPIE PORTE LA SHADER MAP, SES JUMELLES NON ─────────────────
  // Mesure du 2026-09-13 : 180 materiaux corriges n'avaient AUCUNE shader map en
  // ligne (ni FGPUSkinVertexFactory ni FLocalVertexFactory, 15 Ko contre 316 Ko) —
  // tous des copies d'un meme materiau de demo (M_UE4Man_ChestLogo x66,
  // M_UE4Man_Body x56, M_Male_Body x38). Leur jumelle cuite, elle, porte le type
  // skinne. Une telle copie n'est pas « sans preuve » : la chaine ne s'y applique
  // pas. On la compte a part, et on exige qu'une jumelle du MEME nom soit prouvee.
  const sansShaderMap = [];
  const horsPack = [];
  const prouvesParNom = new Set();
  for (const c of ecrits) {
    const texte = ETAPE === "session" ? source(c.materiau) : cuit(c.materiau);
    const attendu = ETAPE === "session"
      ? c.drapeaux.every((d) => texte.includes(d === "used_with_morph_targets" ? "bUsedWithMorphTargets" : "bUsedWithSkeletalMesh"))
      : texte.includes("FGPUSkinVertexFactory");
    if (attendu) {
      prouves++;
      prouvesParNom.add(c.materiau.split("/").pop());
    } else if (ETAPE === "cuit" && !texte) {
      // Absent du pack : dossier exclu du cook (NeverCook, demos) — jamais charge en jeu.
      horsPack.push(c.materiau);
    } else if (ETAPE === "cuit" && !texte.includes("FLocalVertexFactory")) {
      sansShaderMap.push(c.materiau);
    } else {
      manquants.push(c.materiau);
    }
  }
  const orphelines = sansShaderMap.filter((m) => !prouvesParNom.has(m.split("/").pop()));
  dire(`  ${ETAPE === "session" ? "drapeau dans la table de noms" : "FGPUSkinVertexFactory dans la shader map cuite"} : ${prouves}/${ecrits.length}` +
    (ETAPE === "cuit" ? ` ; ${sansShaderMap.length} copie(s) sans shader map en ligne, dont ${orphelines.length} sans jumelle prouvee ; ${horsPack.length} hors pack (exclus du cook)` : ""));
  for (const m of manquants.slice(0, 8)) defaut(`sans preuve : ${m}`);
  if (manquants.length > 8) defaut(`... et ${manquants.length - 8} autre(s)`);
  for (const m of orphelines.slice(0, 5)) defaut(`copie sans shader map ET sans jumelle prouvee : ${m}`);
}

// ── 2. MetaHumans standards ──────────────────────────────────────────────────
const standards = lireJson(STANDARDS);
const CORPS = { M: "m_tal_nrw_body", F: "f_tal_nrw_body" };
if (!standards) {
  defaut(`manifeste absent : ${STANDARDS}`);
} else {
  dire(`[metahumans] ${standards.blueprints.length} Blueprint(s) ; ABP ${standards.abp} ; retargeter ${standards.retargeter}`);
  if (standards.blueprints.length < 2) defaut("il faut un homme ET une femme");
  for (const b of standards.blueprints) {
    const paquet = `/Game/Narvos/PontMetaHuman/${b.blueprint}`;
    const texte = ETAPE === "session" ? source(paquet) : cuit(paquet);
    if (!texte) { defaut(`${b.blueprint} absent (${ETAPE})`); continue; }
    const attendus = [CORPS[b.genre], "_FaceMesh", standards.abp, "Metahuman_Ref"];
    const absents = attendus.filter((a) => !texte.includes(a));
    dire(`  ${b.blueprint} (${b.genre}) : ${absents.length === 0 ? "corps, visage, ABP et Metahuman_Ref cites" : "MANQUE " + absents.join(", ")}`);
    if (absents.length) defaut(`${b.blueprint} ne cite pas ${absents.join(", ")}`);
    if (!(b.composants || []).some((c) => c.startsWith("Body*"))) defaut(`${b.blueprint} : Body n'etait pas la racine a la sauvegarde`);
  }
  for (const nom of [standards.abp, standards.retargeter]) {
    const texte = ETAPE === "session" ? source(`/Game/Narvos/PontMetaHuman/${nom}`) : cuit(`/Game/Narvos/PontMetaHuman/${nom}`);
    if (!texte) defaut(`${nom} absent (${ETAPE})`);
  }
}

// ── 3. Apres le pack : cuit ET declare ───────────────────────────────────────
if (ETAPE === "cuit") {
  const dossier = `${PACK}/Narvos/MetaCustom/Metahuman_Ref`;
  let n = 0;
  const compter = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) compter(`${d}/${e.name}`); else if (e.name.endsWith(".uasset")) n++; } };
  if (fs.existsSync(dossier)) compter(dossier);
  dire(`[pack] Metahuman_Ref cuit : ${n} paquet(s)`);
  if (n === 0) defaut("Metahuman_Ref absent du pack");
  const toml = fs.existsSync(`${PACK}/Assets.toml`) ? fs.readFileSync(`${PACK}/Assets.toml`, "utf8") : "";
  for (const b of standards?.blueprints || []) {
    const declare = new RegExp(`^\\s*${b.blueprint}\\s*=`, "m").test(toml);
    dire(`  ${b.blueprint} declare dans Assets.toml : ${declare}`);
    if (!declare) defaut(`${b.blueprint} non declare`);
  }
}

dire("");
dire(defauts === 0 ? `PREUVE ${ETAPE} : complete.` : `PREUVE ${ETAPE} : ${defauts} defaut(s).`);
process.exitCode = defauts === 0 ? 0 : 1;