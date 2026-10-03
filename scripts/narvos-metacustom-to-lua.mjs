#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// narvos-metacustom-to-lua.mjs — le catalogue Lua du Meta Customization System.
//
//   node scripts/narvos-metacustom-to-lua.mjs           # constat
//   node scripts/narvos-metacustom-to-lua.mjs --apply   # écrit Catalogs/MetaCustom.lua
//
// Entrées (toutes MESURÉES, aucune écrite à la main) :
//   adk/_manifests/metacustom-options.json          narvos-metacustom-options.mjs
//   adk/_manifests/metacustom-curseurs-corps.json   narvos-metacustom-curseurs.mjs
//   adk/_manifests/metacustom-curseurs-visage.json  (facultatif, même générateur)
//   Server/Assets/narvos/…                          le pack cuit : drapeau `cuit`
//
// ── LE CONTRAT AVEC LE BLUEPRINT ───────────────────────────────────────────────
// Les chemins écrits ici sont des chemins d'OBJETS (`/Game/Narvos/MetaCustom/...`),
// chargés à l'exécution par les fonctions `Narvos*` des Blueprints BP_NarvosMH_M/F
// (`LoadAsset_Blocking`). Ils ne passent PAS par une clé `narvos::` : la clé est
// un rang d'homonyme, le chemin est l'identité (voir CLAUDE.md, « une clé n'est
// pas un nom »).
//
// ── POURQUOI `cuit` ────────────────────────────────────────────────────────────
// Une option dont le paquet n'est pas dans le pack cuit est un bouton mort : le
// client chargerait un chemin absent et n'afficherait rien. La logique ne propose
// que `cuit = true` ; le drapeau se relit à chaque reconstruction du pack.
// ═══════════════════════════════════════════════════════════════════════════════
import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype";
const MANIFESTES = `${RACINE}/WebPortal/Server/adk/_manifests`;
const PACK = `${RACINE}/WebPortal/Server/Assets/narvos`;
const SORTIE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/MetaCustom.lua`;
const APPLY = process.argv.includes("--apply");

const lire = (nom, facultatif = false) => {
    const f = `${MANIFESTES}/${nom}`;
    if (!fs.existsSync(f)) {
        if (facultatif) return null;
        console.error(`ARRET : ${f} absent`);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(f, "utf8"));
};

/** `/Game/Narvos/X/Y` cuit ? (le pack garde l'arborescence sous Narvos/) */
const cuit = (chemin) => typeof chemin === "string" && chemin.startsWith("/Game/")
    && fs.existsSync(`${PACK}/${chemin.split(".")[0].slice("/Game/".length)}.uasset`);
/** `/Game/Narvos/X/Y` -> `/Game/Narvos/X/Y.Y`, la forme que `LoadAsset` attend. */
const objet = (chemin) => (chemin && !chemin.includes(".") ? `${chemin}.${chemin.split("/").pop()}` : chemin);

const q = (v) => JSON.stringify(v);
const n = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000));

function ligneOption(o, champs) {
    return `        { ${champs.map(([k, v]) => `${k} = ${v}`).join(", ")} },`;
}

function main() {
    const options = lire("metacustom-options.json");
    const corps = lire("metacustom-curseurs-corps.json");
    const visage = lire("metacustom-curseurs-visage.json", true);
    const materiaux = lire("metacustom-materiaux.json");
    const liaisons = lire("metacustom-liaisons.json", true);
    if (liaisons && (liaisons.version !== 1 || !liaisons.ok)) throw Error("Liaisons de coiffure incompletes");
    if (materiaux.version !== 1) throw Error("Version du manifeste materiaux inconnue");
    function slots(famille, id, asset) {
        const entree = materiaux[famille]?.[id];
        if (entree?.asset !== objet(asset) || !entree.materials?.length)
            throw Error(`Materiaux non qualifies pour ${id} : relancer adk-metacustom-materiaux.py`);
        return entree.materials.map((m, index) => {
            if (m.index !== index || !cuit(m.material))
                throw Error(`Slot materiau absent du pack : ${id}/${index} (${m.material})`);
            return q(objet(m.material));
        }).join(", ");
    }

    const lignes = [];
    const compte = { total: 0, cuits: 0 };
    const noter = (estCuit) => { compte.total++; if (estCuit) compte.cuits++; };

    lignes.push(
        "-- ══════════════════════════════════════════════════════════════════════════════",
        "-- MetaCustom.lua — les options et les curseurs du Meta Customization System.",
        "--",
        "-- FICHIER GENERE par scripts/narvos-metacustom-to-lua.mjs depuis",
        "-- adk/_manifests/metacustom-options.json (fichiers d'ORIGINE du pack) et",
        "-- metacustom-curseurs-*.json (graphes du widget et de l'AnimBP, lus a l'editeur).",
        "-- Ne pas editer a la main : regenerer apres chaque construction du pack.",
        "--",
        "-- `cuit` = le paquet est dans le pack cuit. La logique (Logic/MetaCustom.lua) ne",
        "-- propose QUE les options cuites.",
        "-- ══════════════════════════════════════════════════════════════════════════════",
        "",
        "local MetaCustom = {}",
        "",
        "--- Les emplacements de sauvegarde du pack (Slots 1-18).",
        "MetaCustom.EMPLACEMENTS = 18",
        "",
        "--- Les curseurs du CORPS : variable de l'AnimBP de post-traitement",
        "--- (ABP_NarvosPersonnalisationCorps) et ses cases d'activation.",
        "MetaCustom.CORPS = {",
    );
    for (const c of corps.curseurs) {
        lignes.push(`    { id = ${q(c.id)}, label = ${q(c.label)}, variable = ${q(c.variable)}, min = ${n(c.min)}, max = ${n(c.max)}, defaut = ${n(c.defaut)}, pas = ${n(c.pas)}, activation = { ${c.activation.map(q).join(", ")} } },`);
    }
    lignes.push("}", "");

    if (visage && visage.qualification?.geometrie !== true) throw Error("Curseurs visage sans qualification géométrique");
    lignes.push("--- Les curseurs du VISAGE : ABP_NarvosPersonnalisationVisage, sculpture MCS qualifiee.",
        "MetaCustom.VISAGE = {");
    for (const c of visage?.curseurs ?? []) {
        lignes.push(`    { id = ${q(c.id)}, label = ${q(c.label)}, variable = ${q(c.variable)}, min = ${n(c.min)}, max = ${n(c.max)}, defaut = ${n(c.defaut)}, pas = ${n(c.pas)}, activation = { ${(c.activation ?? []).map(q).join(", ")} } },`);
    }
    lignes.push("}", "");

    lignes.push("--- Les identites MetaHuman du pack : visage, peau du corps et du visage.",
        "MetaCustom.IDENTITES = {");
    for (const i of options.identites) {
        const estCuit = cuit(i.visage) && cuit(i.materiau_corps) && cuit(i.materiau_visage);
        noter(estCuit);
        lignes.push(`    { id = ${q(i.id)}, label = ${q(i.label)}, genre = ${q(i.genre)}, visage = ${q(objet(i.visage))}, materiau_corps = ${q(objet(i.materiau_corps))}, materiau_visage = ${q(objet(i.materiau_visage))}, materiaux_visage = { ${slots("faces", i.id, i.visage)} }, cuit = ${estCuit} },`);
    }
    lignes.push("}", "");

    lignes.push("--- Vetements par emplacement. `genre` : m, f, ou mf (les deux).",
        "MetaCustom.VETEMENTS = {");
    for (const [sorte, liste] of Object.entries(options.vetements)) {
        lignes.push(`    ${sorte} = {`);
        for (const o of liste) {
            const estCuit = cuit(o.chemin);
            noter(estCuit);
            lignes.push(ligneOption(o, [["id", q(o.id)], ["label", q(o.label)], ["genre", q(o.genre)], ["chemin", q(objet(o.chemin))], ["cuit", String(estCuit)]]));
        }
        lignes.push("    },");
    }
    lignes.push("}", "");

    lignes.push("--- Grooms (cheveux, sourcils, cils, duvet) et leur liaison au visage.",
        "MetaCustom.GROOMS = {");
    const parSorte = {};
    for (const g of options.grooms) (parSorte[g.sorte] ??= []).push(g);
    for (const [sorte, liste] of Object.entries(parSorte)) {
        lignes.push(`    ${sorte} = {`);
        for (const g of liste) {
            const variantes = liaisons?.grooms[g.id];
            if (liaisons && !variantes) throw Error(`Liaisons absentes : ${g.id}`);
            const disponibles = Object.entries(variantes ?? {}).filter(([id, v]) => {
                const identite = options.identites.find(i => i.id === id);
                if (!identite || v.cible !== objet(identite.visage) || v.groom !== objet(g.groom))
                    throw Error(`Liaison incompatible : ${g.id}/${id}`);
                return cuit(v.liaison);
            });
            const estCuit = cuit(g.groom) && (variantes ? disponibles.length > 0 : cuit(g.liaison));
            noter(estCuit);
            const champs = [["id", q(g.id)], ["label", q(g.label)], ["genre", q(g.genre ?? "mf")], ["composant", q(g.composant)], ["groom", q(objet(g.groom))], ["liaison", q(objet(g.liaison))], ["materiaux", `{ ${slots("grooms", g.id, g.groom)} }`], ["cuit", String(estCuit)]];
            if (variantes) champs.push(["liaisons", `{ ${disponibles.map(([id, v]) => `[${q(id)}] = ${q(objet(v.liaison))}`).join(", ")} }`]);
            lignes.push(ligneOption(g, champs));
        }
        lignes.push("    },");
    }
    lignes.push("}", "");

    lignes.push("--- Tatouages : masque et diffuse, par zone (Body ou Face).",
        "MetaCustom.TATOUAGES = {");
    for (const t of options.tatouages) {
        const estCuit = cuit(t.masque) && (!t.diffuse || t.diffuse.startsWith("/Engine/") || cuit(t.diffuse));
        noter(estCuit);
        lignes.push(`    { id = ${q(t.id)}, label = ${q(t.label)}, zone = ${q(t.zone)}, masque = ${q(objet(t.masque))}, diffuse = ${q(objet(t.diffuse))}, cuit = ${estCuit} },`);
    }
    lignes.push("}", "");

    const d = options.defauts_styler;
    lignes.push(
        "--- Les parametres de materiau que le pack pose (lus dans BP_MH_Male).",
        "MetaCustom.PARAMS = {",
        `    teinte_actif = "Tint on(1) off(0)", teinte_couleur = "BaseColortint",`,
        `    tatouage_actif = "Tattoo on(1) off(0)", tatouage_masque = "Tattoo", tatouage_diffuse = "Tattoo_Diffuse",`,
        `    cheveux_teinture = "hairDye", cheveux_rugosite = "HairRoughness", rugosite = 0.29,`,
        "}",
        "",
        "--- Les yeux : trois scalaires sur les materiaux du visage.",
        "MetaCustom.YEUX = {",
        `    { id = "exterieur", label = "Couleur exterieure", param = "IrisColor1U", min = 0, max = 1, defaut = ${n(d.yeux.IrisColor1U)} },`,
        `    { id = "interieur", label = "Couleur interieure", param = "IrisColor2U", min = 0, max = 1, defaut = ${n(d.yeux.IrisColor2U)} },`,
        `    { id = "eclat", label = "Eclat", param = "IrisBrightness", min = 0, max = 4, defaut = ${n(d.yeux.IrisBrightness)} },`,
        "}",
        "",
        "--- Valeurs de depart du Styler : teinte de peau (HSV) et couleur des cheveux.",
        `MetaCustom.DEFAUT_TEINTE = { h = ${n(d.teinte.H % 360)}, s = ${n(d.teinte.S)}, v = ${n(d.teinte.V)} }`,
        `MetaCustom.DEFAUT_CHEVEUX = { h = ${n(d.cheveux.H)}, v = ${n(d.cheveux.V)} }`,
        "",
        "--- Les composants des Blueprints BP_NarvosMH_M/F, par emplacement de vetement.",
        "MetaCustom.COMPOSANTS = { haut = \"Torso\", bas = \"Legs\", chaussures = \"Feet\", tenue = \"Torso\", accessoire = \"Prop\" }",
        "",
        "return MetaCustom",
        "",
    );

    const texte = lignes.join("\n");
    console.log(`${compte.cuits}/${compte.total} option(s) cuite(s) ; ${corps.curseurs.length} curseur(s) de corps, ${visage?.curseurs?.length ?? 0} de visage`);
    if (!APPLY) { console.log("(constat seul — --apply pour ecrire)"); return; }
    fs.writeFileSync(SORTIE, texte);
    console.log(`ecrit : ${SORTIE}`);
}

main();