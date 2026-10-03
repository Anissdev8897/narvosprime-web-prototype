// ══════════════════════════════════════════════════════════════════════════════
// narvos-emotes-to-lua.mjs — catalogue Lua des animations contextuelles.
//
//   node scripts/narvos-emotes-to-lua.mjs [--apply]
//
// ── CE QU'IL CLASSE, ET CE QU'IL ÉCARTE ───────────────────────────────────────
// Source : le manifeste d'import des packs d'animation. On ne lit pas le disque
// brut — le manifeste ne contient QUE ce qui est réellement importable sur
// SKEL_Mannequin, donc le catalogue ne peut pas référencer une animation qui
// n'entrera jamais dans le pack.
//
// On ne garde que les animations CONTEXTUELLES : s'asseoir, s'appuyer, signaux
// de la main, travail, ramassage. La locomotion (Stealth_*, AnimSeq_Traversal_*)
// et le combat (FPP_*, MoCap*, ACB_*) sont écartés — ils appartiennent au
// système de déplacement, pas au menu d'emotes, et les mêler donnerait une liste
// de 600 entrées illisible.
//
// ── RÈGLE ─────────────────────────────────────────────────────────────────────
// Ce qu'on ne sait pas classer est ÉCARTÉ et COMPTÉ, jamais rangé au hasard. Une
// animation mal classée arrive dans la mauvaise catégorie du menu et le joueur
// ne la retrouve jamais ; une animation écartée se voit dans le bilan.
//
// ── ⚠ CE QUI N'EXISTE PAS ─────────────────────────────────────────────────────
// Recherche exhaustive sur les 10 073 GLB du dépôt (2026-09-03) : AUCUNE
// animation de danse, AUCUNE animation de cigarette. Ce n'est pas un défaut de
// ce script — ces animations ne sont sur aucun des 208 packs. Les ajouter
// demande d'acheter un pack ; le catalogue les accueillera sans changement de
// structure.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

// ── LE NOM DE L'ANIMATION N'EST PAS CELUI DU FICHIER ─────────────────────────
//
// ⚠ Interchange produit DEUX assets par GLB d'animation : un SkeletalMesh qui
// porte le nom du fichier, et une AnimSequence suffixee `_Anim`.
//
// Le catalogue referencait le premier. `PlayAnimation` cherchant une Animation,
// nanos repondait :
//
//     Asset 'ANIM_IP_customer_idle' of type 'Animation' not found
//
// Les 166 emotes etaient dans ce cas — le menu B n'a jamais rien joue. Trouve
// le 2026-09-04 en lisant les logs du serveur, pas le code : le verificateur
// de catalogues confirmait « 166 references ok », car il verifiait l'EXISTENCE
// du nom sans regarder son TYPE.

const PACK_TOML =
  "E:/narvosprime-web-prototype/WebPortal/Server/Assets/narvos/Assets.toml";

/** Noms declares comme animations dans le pack cuit, s'il existe. */
function animationsDuPack() {
  if (!fs.existsSync(PACK_TOML)) return null;

  const noms = new Set();
  let section = null;
  for (const l of fs.readFileSync(PACK_TOML, "utf8").split(/\r?\n/)) {
    const s = l.match(/^\s*\[assets\.([a-z_]+)\]/);
    if (s) { section = s[1]; continue; }
    if (section !== "animations") continue;
    const m = l.match(/^\s+([A-Za-z0-9_]+) = /);
    if (m) noms.add(m[1]);
  }
  return noms;
}

const ANIMS_DU_PACK = animationsDuPack();

/** Nom d'asset a referencer pour cette animation.
 *
 *  On CONSTATE contre le pack plutot que de supposer la convention : si un
 *  jour Interchange cesse de suffixer, le catalogue suivra sans qu'on y touche.
 *  Sans pack sous la main, on applique la convention connue. */
function nomAnimation(nom) {
  if (!ANIMS_DU_PACK) return `${nom}_Anim`;
  if (ANIMS_DU_PACK.has(`${nom}_Anim`)) return `${nom}_Anim`;
  if (ANIMS_DU_PACK.has(nom)) return nom;
  return null;   // ni l'un ni l'autre : l'appelant ecarte l'entree
}

const MANIFESTE =
  "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/animations-rp.json";
const CIBLE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages" +
  "/narvos/Shared/Catalogs/Emotes.lua";
const PACK = "narvos";

const APPLY = process.argv.includes("--apply");

/**
 * Règles de classement, dans l'ordre. La PREMIÈRE qui correspond gagne, donc
 * l'ordre compte : `AS_Sit_Phone01` doit tomber dans « téléphone » et pas dans
 * « assis », d'où la règle téléphone en premier.
 */
const REGLES = [
  { motif: /Phone/i, categorie: "telephone", label: "Téléphone" },
  { motif: /HandSignal/i, categorie: "signaux", label: "Signaux" },
  { motif: /^AS_Sit_/i, categorie: "assis", label: "Assis" },
  { motif: /^AS_Stand(Lean|Pole|Strap)/i, categorie: "appui", label: "Appui" },
  { motif: /^AS_StandUpright/i, categorie: "debout", label: "Debout" },
  { motif: /Kneel/i, categorie: "genou", label: "À genou" },
  // Le pack Blacksmith livre chaque animation en deux modes : IP (in place) et
  // RM (root motion). Les deux sont utiles ; ne capter que IP en perdait la
  // moitié en silence.
  { motif: /^ANIM_(IP|RM)_/i, categorie: "travail", label: "Travail" },
  { motif: /Taunt/i, categorie: "provocation", label: "Provocation" },
  // Menottes : `AS_Handcuffed` (pack MultiplayerHandcuffs) cible
  // UE4_Mannequin_Skeleton, le bon squelette nanos — réutilisable telle quelle.
  // La règle est posée AVANT l'import : si l'animation entre un jour dans un
  // manifeste, elle se classe ici au lieu de tomber en « non classée ».
  { motif: /Handcuff/i, categorie: "contrainte", label: "Contrainte" },
];

/** Écartés d'office : locomotion, combat, et ce qui n'est pas une animation.
 *
 *  ⚠ Les MESHES doivent être exclus explicitement. Importer un GLB d'animation
 *  crée aussi un SkeletalMesh (la pose de liaison embarquée), et les packs
 *  livrent leur mannequin de référence : sans cette règle, `SKM_Manny` et
 *  `SK_Mannequin` se retrouvaient dans le menu d'emotes. */
const EXCLUS = [
  /^SKM?_/i,
  /^SK_/i,
  /^Loot_(?!.*Kneel)/i, // le ramassage debout est du gameplay, pas une emote
];

/** Packs entiers qui n'ont rien à faire dans un menu d'emotes.
 *
 *  ⚠ Filtrer sur le PACK et non sur le nom de fichier. Ces packs nomment leurs
 *  animations sans préfixe (`attack_hook_fast_Lhand_01`) : une règle sur le nom
 *  en laissait passer 190, qui se seraient retrouvées dans le menu comme
 *  « animations non classées ». Le dossier, lui, ne ment pas. */
const PACKS_EXCLUS = [
  "StealthLocomotion",            // locomotion furtive
  "uta_locomotion",               // traversée, saut, escalade
  "FPP_combat_fists",             // combat au poing
  "MoCapCombatAnimations_DualCharacter",
  "BaconCombatGraphU",
  "ProceduralWeaponAnimationSystem",
];

/** Ordre d'affichage des catégories dans le menu. */
const ORDRE = ["assis", "appui", "debout", "telephone", "signaux", "genou", "travail", "provocation"];

// ── Lecture ───────────────────────────────────────────────────────────────────

if (!fs.existsSync(MANIFESTE)) {
  console.error(`Manifeste introuvable : ${MANIFESTE}`);
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : ? ligne(s) attendue(s) ici, 200 connue(s)]
  console.error("Lancer d'abord : node scripts/narvos-skeleton-compat.mjs <dossier> --json <sortie>");
  process.exit(1);
}

const manifeste = JSON.parse(fs.readFileSync(MANIFESTE, "utf8"));

/**
 * Une animation est-elle une BOUCLE ? Les noms le disent : `_Loop01`, `_Idle`.
 * Ça change tout à l'usage — une boucle se maintient jusqu'à ce que le joueur
 * bouge, une action se joue une fois et rend la main.
 */
const estBoucle = (nom) => /(_Loop\d*|_Idle)$/i.test(nom) || /Loop/i.test(nom);

/** Une transition (`_To_`) n'a aucun sens seule dans un menu. */
const estTransition = (nom) => /_To_/i.test(nom);

const entrees = [];
const ecartes = { exclus: 0, transitions: 0, nonClasses: [] };

for (const f of manifeste.fichiers) {
  const nom = path.basename(f.fichier).replace(/\.glb$/i, "");
  // Le manifeste écrit déjà ses chemins en `/` (voir narvos-skeleton-compat.mjs).
  const chemin = f.fichier;

  if (PACKS_EXCLUS.some((p) => chemin.includes(`/${p}/`))) {
    ecartes.exclus++;
    continue;
  }
  if (EXCLUS.some((r) => r.test(nom))) {
    ecartes.exclus++;
    continue;
  }
  if (estTransition(nom)) {
    ecartes.transitions++;
    continue;
  }

  const regle = REGLES.find((r) => r.motif.test(nom));
  if (!regle) {
    ecartes.nonClasses.push(nom);
    continue;
  }

  // Une animation absente du pack ne doit pas entrer au catalogue : elle
  // produirait une entree de menu qui ne joue rien.
  const asset = nomAnimation(nom);
  if (!asset) {
    ecartes.horsPack = (ecartes.horsPack ?? 0) + 1;
    continue;
  }

  entrees.push({
    id: nom.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
    asset: `${PACK}::${asset}`,
    categorie: regle.categorie,
    boucle: estBoucle(nom),
    // Libellé lisible : on retire le préfixe technique et on aère.
    label: nom
      .replace(/^(AS_|ANIM_IP_|Pistol_|Rifle_|Loot_)/i, "")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  });
}

// Collision d'identifiant = une entrée écrasée en silence.
const vus = new Map();
for (const e of entrees) {
  if (vus.has(e.id)) {
    console.error(`COLLISION « ${e.id} » : ${vus.get(e.id)} et ${e.asset}`);
    process.exit(1);
  }
  vus.set(e.id, e.asset);
}

// ── Sérialisation ─────────────────────────────────────────────────────────────

const q = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const parCat = {};
for (const e of entrees) (parCat[e.categorie] ||= []).push(e);

const lignes = entrees
  .sort((a, b) => a.id.localeCompare(b.id))
  .map(
    (e) =>
      `    ${e.id} = { asset = ${q(e.asset)}, categorie = ${q(e.categorie)}, ` +
      `boucle = ${e.boucle}, label = ${q(e.label)} },`,
  )
  .join("\n");

const categories = ORDRE.filter((c) => parCat[c])
  .map((c) => {
    const r = REGLES.find((x) => x.categorie === c);
    return `    { id = ${q(c)}, label = ${q(r.label)}, nombre = ${parCat[c].length} },`;
  })
  .join("\n");

const lua = `-- ══════════════════════════════════════════════════════════════════════════════
-- Emotes.lua — animations contextuelles (non liées au déplacement).
--
-- ⚠ FICHIER GÉNÉRÉ par scripts/narvos-emotes-to-lua.mjs — ne pas éditer à la
-- main. Il est reconstruit depuis le manifeste d'import, ce qui garantit
-- qu'aucune entrée ne référence une animation absente du pack cuit.
--
-- ${entrees.length} animations, ${Object.keys(parCat).length} catégories.
--
-- Ne contient PAS la locomotion ni le combat : ceux-là appartiennent au système
-- de déplacement. Voir Logic/Animations.lua pour les variantes de locomotion.
--
-- ⚠ NI DANSE NI CIGARETTE. Recherche exhaustive sur les 10 073 GLB du dépôt le
-- 2026-09-03 : ces animations n'existent sur aucun des 208 packs. Le catalogue
-- les accueillera sans changement de structure le jour où un pack en fournit.
-- ══════════════════════════════════════════════════════════════════════════════

local Emotes = {}

--- Catégories, dans l'ordre d'affichage du menu.
--- Une SÉQUENCE et non une table : \`pairs\` n'a aucun ordre garanti en Lua, et
--- les onglets du menu changeraient de place entre deux ouvertures.
Emotes.CATEGORIES = {
${categories}
}

--- Toutes les animations, indexées par identifiant.
Emotes.ANIMATIONS = {
${lignes}
}

--- Animations d'une catégorie, ordre stable.
---@param categorie string
---@return table[]
function Emotes.ParCategorie(categorie)
    local ids = {}
    for id, a in pairs(Emotes.ANIMATIONS) do
        if (a.categorie == categorie) then ids[#ids + 1] = id end
    end
    table.sort(ids)

    local sortie = {}
    for i = 1, #ids do
        local a = Emotes.ANIMATIONS[ids[i]]
        sortie[i] = { id = ids[i], asset = a.asset, label = a.label, boucle = a.boucle }
    end
    return sortie
end

--- Une animation par son identifiant, ou nil.
--- Rend nil plutôt qu'un défaut : l'appelant décide, et une emote inconnue
--- venant du client ne doit surtout pas en jouer une autre.
---@param id string
---@return table|nil
function Emotes.Trouver(id)
    if (type(id) ~= "string") then return nil end
    return Emotes.ANIMATIONS[id]
end

--- Tout ce qu'il faut au menu, en une table.
---@return table
function Emotes.Options()
    local sortie = {}
    for i, c in ipairs(Emotes.CATEGORIES) do
        sortie[i] = {
            id = c.id, label = c.label, nombre = c.nombre,
            animations = Emotes.ParCategorie(c.id),
        }
    end
    return sortie
end

return Emotes
`;

// ── Bilan ─────────────────────────────────────────────────────────────────────

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`  ${manifeste.fichiers.length} animations au manifeste`);
console.log(`  ${entrees.length} classée(s) en ${Object.keys(parCat).length} catégorie(s)`);
console.log("");
for (const c of ORDRE) {
  if (parCat[c]) console.log(`  ${c.padEnd(12)} ${String(parCat[c].length).padStart(4)}`);
}
console.log("");
console.log(`  écartés : ${ecartes.exclus} locomotion/combat, ${ecartes.transitions} transitions`);

if (ecartes.nonClasses.length) {
  console.log(`  ⚠ ${ecartes.nonClasses.length} NON CLASSÉE(S) — absentes du menu :`);
  for (const n of ecartes.nonClasses.slice(0, 12)) console.log(`      ${n}`);
  if (ecartes.nonClasses.length > 12) console.log(`      … et ${ecartes.nonClasses.length - 12} autres`);
}

if (APPLY) {
  fs.mkdirSync(path.dirname(CIBLE), { recursive: true });
  fs.writeFileSync(CIBLE, lua, "utf8");
  console.log("");
  console.log(`  écrit : ${CIBLE}`);
} else {
  console.log("");
  console.log("Rien écrit.");
}
// [ANCIENNE VERSION ↑]