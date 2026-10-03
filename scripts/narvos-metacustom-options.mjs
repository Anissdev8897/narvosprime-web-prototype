#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// narvos-metacustom-options.mjs — CE QUE le Meta Customization System propose,
// relu dans les fichiers D'ORIGINE du pack (hors Content/), et ce qui existe
// VRAIMENT sur disque.
//
//   node scripts/narvos-metacustom-options.mjs           # constat
//   node scripts/narvos-metacustom-options.mjs --apply   # écrit les manifestes
//
// Sorties :
//   WebPortal/Server/adk/_manifests/metacustom-options.json   options par catégorie
//   WebPortal/Server/adk/_manifests/metahuman_ref-passe2.json racines à lier (copier)
//
// ── POURQUOI LES ORIGINAUX ─────────────────────────────────────────────────────
// Les copies de l'ADK ont été resauvées sans les MetaHumans : leurs références
// valent null (sonde du 2026-09-13, `adk-sonder-mcs.py`). L'original de
// BP_Meta_Styler, lui, porte encore ses 102 chemins — lus par
// `scripts/lib/uasset-proprietes.mjs` (valeurs par défaut + gabarits de composants).
//
// ── POURQUOI FILTRER SUR LE DISQUE ─────────────────────────────────────────────
// Le Styler cite des identités ABSENTES du pack livré (FCS4, FCS7, FCS8, MCS3 à 8) :
// seules FCS0, FCS1, FCS2, FCSBase, MCS2 et MCSGavin existent. Une option dont le
// fichier manque ne serait jamais cuite ; la proposer en jeu serait un bouton mort.
// ═══════════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { lireProprietes } from "./lib/uasset-proprietes.mjs";

const RACINE = "E:/narvosprime-web-prototype";
const SOURCE = `${RACINE}/WebPortal/public/asset_game/mixte_epoques/Meta Customization System - Unreal Engine`;
const MANIFESTES = `${RACINE}/WebPortal/Server/adk/_manifests`;
const PREFIXE_ORIGINE = "/Game/Metahuman_Customization_System/";
const PREFIXE_NARVOS = "/Game/Narvos/MetaCustom/";
const STYLER = `${SOURCE}/Meta_Styler/Bluepritns/BP_Meta_Styler.uasset`;
// MetaWardrobe (Relentless Games, même éditeur que le MCS) : la garde-robe COMPLÈTE
// dont le MCS n'embarque que quelques pièces. Demandé par Hanibes le 2026-09-13 soir.
const WARDROBE = `${RACINE}/WebPortal/public/asset_game/mixte_epoques/Unreal Engine – Fab - MetaWardrobe - Weekly Update v5.4+/Metawadrobe`;
const PREFIXE_WARDROBE = "/Game/Metawadrobe/";
const PREFIXE_WARDROBE_NARVOS = "/Game/Narvos/MetaCustom/Metawadrobe/";
const APPLY = process.argv.includes("--apply");

const paquetDe = (ref) => (ref ? ref.split(":")[0].split(".")[0] : null);
const surDisque = (paquet) => paquet?.startsWith(PREFIXE_ORIGINE)
    && fs.existsSync(`${SOURCE}/${paquet.slice(PREFIXE_ORIGINE.length)}.uasset`);
const versNarvos = (paquet) => PREFIXE_NARVOS + paquet.slice(PREFIXE_ORIGINE.length);
const nomCourt = (paquet) => paquet.split("/").pop();

/** Libellé lisible à partir d'un nom d'asset : « SK_Set_3_Work_Top » -> « Set 3 Work Top ». */
function libelle(nom) {
    return nom.replace(/^(SK|Sk|SM|MI|M|T)_/, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

// Les identifiants d'assets restent stables ; seuls les noms visibles sont traduits.
const LIBELLES_GROOM = {
    Hair_L_MessyClumps: "Longs ondulés",
    Hair_L_Straight: "Longs lisses",
    Hair_S_BobLayered: "Carré dégradé",
    Hair_S_Cornrows: "Tresses plaquées",
    Hair_S_Messy: "Courts ébouriffés",
    Eyelashes_L_SlightCurl: "Longs recourbés",
    Eyelashes_S_Sparse: "Courts clairsemés",
    Eyelashes_S_Thin: "Courts fins",
    Peachfuzz_M_Thin: "Duvet fin",
    Eyebrows_L_Scraggly: "Broussailleux",
    Eyebrows_M_Fine: "Fins",
    Eyebrows_M_FlatThick: "Droits épais",
    Eyebrows_M_Thick: "Épais",
};

// ── 1. Le Styler d'origine : valeurs par défaut et gabarits ───────────────────
function lireStyler() {
    const P = lireProprietes(STYLER);
    const cdo = P.exports.find((e) => e.nom.startsWith("Default__"));
    const vars = P.proprietes(cdo);
    const gabarits = {};
    for (const e of P.exports.filter((x) => /_GEN_VARIABLE$/.test(x.nom))) {
        gabarits[e.nom.replace(/_GEN_VARIABLE$/, "")] = P.proprietes(e);
    }
    return { vars, gabarits };
}

// ── 2. Les catégories ─────────────────────────────────────────────────────────
const SORTES_VETEMENT = {
    haut: { variable: "Top", gabarits: /^(Additional_)?Top_\d+$/ },
    bas: { variable: "Bottoms", gabarits: /^(Additional_)?Bottoms_\d+$/ },
    chaussures: { variable: "Shoes", gabarits: /^(Additional_)?Shoes_\d+$/ },
    tenue: { variable: "Costume", gabarits: /^(Additional_)?Costume_\d+$/ },
    accessoire: { variable: "Prop", gabarits: /^(Additional_)?Prop(_\d+)?$|^Rigged_horns$|^Piercings$|^Orc_Teeth$/ },
};

function ajouter(liste, vus, entree) {
    if (!entree.paquet || vus.has(entree.paquet)) return;
    // Le mannequin du Face Tool (SK_Dummy_*) est un OUTIL du pack, pas un vêtement :
    // proposé en « tenue », il habillait le personnage d'un mannequin gris.
    if (/dummy/i.test(nomCourt(entree.paquet))) return;
    vus.add(entree.paquet);
    liste.push(entree);
}

function vetements(styler) {
    const sortie = {};
    for (const [sorte, def] of Object.entries(SORTES_VETEMENT)) {
        const liste = [];
        const vus = new Set();
        for (const genre of ["Male", "Female"]) {
            for (let i = 1; i <= 8; i++) {
                const p = paquetDe(styler.vars[`${genre}_${def.variable}_${i}`]);
                if (p) ajouter(liste, vus, { paquet: p, genre: genre === "Male" ? "m" : "f", source: `${genre}_${def.variable}_${i}` });
            }
        }
        // Les gabarits de composants (Top_1…) sont les options FÉMININES par défaut :
        // le Styler démarre en femme (`Female? = true`) et y recopie les Male_* à la bascule.
        for (const [nom, props] of Object.entries(styler.gabarits)) {
            if (!def.gabarits.test(nom)) continue;
            const p = paquetDe(props.SkinnedAsset ?? props.SkeletalMesh);
                if (p) ajouter(liste, vus, { paquet: p, genre: sorte === "accessoire" ? "mf" : "f", source: nom });
        }
        sortie[sorte] = liste.map((o) => ({
            // Le genre fait partie de l identite : le pack a un SK_Pants homme ET femme.
            id: `${sorte}_${o.genre}_${nomCourt(o.paquet).toLowerCase()}`,
            label: libelle(nomCourt(o.paquet)),
            genre: o.genre,
            chemin: versNarvos(o.paquet),
            origine: o.paquet,
            source: o.source,
            disque: surDisque(o.paquet),
        }));
    }
    return sortie;
}

function tatouages(styler) {
    const sortie = [];
    for (const zone of ["Face", "Body"]) {
        for (let i = 1; i <= 8; i++) {
            const masque = paquetDe(styler.vars[`${zone}_Tattoo_${i}`]);
            if (!masque) continue;
            const diffuse = paquetDe(styler.vars[`${zone}_Tattoo_Diffuse_${i}`]);
            const moteur = (p) => p?.startsWith("/Engine/");
            sortie.push({
                id: `tatouage_${zone === "Face" ? "visage" : "corps"}_${i}`,
                label: `${zone === "Face" ? "Visage" : "Corps"} ${i} — ${libelle(nomCourt(masque))}`,
                zone: zone === "Face" ? "Face" : "Body",
                masque: masque.startsWith(PREFIXE_ORIGINE) ? versNarvos(masque) : masque,
                diffuse: diffuse ? (moteur(diffuse) ? diffuse : versNarvos(diffuse)) : null,
                disque: surDisque(masque) && (!diffuse || moteur(diffuse) || surDisque(diffuse)),
            });
        }
    }
    return sortie;
}

// ── 3. Les identités MetaHuman présentes sur disque ───────────────────────────
const LIBELLES_IDENTITE = {
    FCSBase: "Hana", FCS0: "Natalia", FCS1: "Amelia", FCS2: "Anime", MCSGavin: "Gavin", MCS2: "Idris",
};

function identites() {
    const racineRef = `${SOURCE}/Metahuman_Ref`;
    const sortie = [];
    for (const dossier of fs.readdirSync(racineRef).sort()) {
        if (!/^(F|M)CS/.test(dossier)) continue;
        const faceDir = `${racineRef}/${dossier}/Face`;
        const faces = fs.existsSync(faceDir)
            ? fs.readdirSync(faceDir).filter((f) => /_FaceMesh\.uasset$/.test(f)) : [];
        const corpsMat = `Metahuman_Ref/${dossier}/Materials/M_BodySynthesized`;
        const visageMat = `Metahuman_Ref/${dossier}/Face/Materials/Baked/MI_HeadSynthesized_Baked`;
        const bp = fs.readdirSync(`${racineRef}/${dossier}`).find((f) => /^BP_.*\.uasset$/.test(f));
        sortie.push({
            id: dossier.toLowerCase(),
            label: LIBELLES_IDENTITE[dossier] ?? dossier,
            genre: dossier.startsWith("M") ? "m" : "f",
            blueprint: bp ? `${PREFIXE_ORIGINE}Metahuman_Ref/${dossier}/${bp.replace(/\.uasset$/, "")}` : null,
            visage: faces.length ? `${PREFIXE_NARVOS}Metahuman_Ref/${dossier}/Face/${faces[0].replace(/\.uasset$/, "")}` : null,
            materiau_corps: fs.existsSync(`${SOURCE}/${corpsMat}.uasset`) ? PREFIXE_NARVOS + corpsMat : null,
            materiau_visage: fs.existsSync(`${SOURCE}/${visageMat}.uasset`) ? PREFIXE_NARVOS + visageMat : null,
        });
    }
    return sortie;
}

// ── 4. Les grooms et leurs liaisons ───────────────────────────────────────────
/** Genre de la tête pour laquelle une LIAISON de groom a été calculée, ou null.
 *
 * Une liaison suit la tête qu'elle cible : posée sur une tête de l'autre archétype,
 * les racines tombent à côté du crâne (« cheveux éclatés », retour de jeu du
 * 2026-09-14 — Cornrows, liaison `f_med_nrw`, posé d'office sur Gavin). Le nom de la
 * liaison le dit (`_f_med_`, `_m_head_`) ; à défaut, le dossier (FemaleHair /
 * MaleHair). */
function genreLiaison(chemin) {
    const base = chemin.split("/").pop();
    if (/(^|_)f_(med|tal|srt|head)/i.test(base)) return "f";
    if (/(^|_)m_(med|tal|srt|head)/i.test(base)) return "m";
    if (/female/i.test(chemin)) return "f";
    if (/(^|[^e])male/i.test(chemin)) return "m";
    return null;
}

const SORTES_GROOM = [
    { sorte: "cheveux", motif: /^Hair_/, composant: "Hair" },
    { sorte: "sourcils", motif: /^Eyebrows_/, composant: "Eyebrows" },
    { sorte: "cils", motif: /^Eyelashes_/, composant: "Eyelashes" },
    { sorte: "duvet", motif: /^Peachfuzz_/, composant: "Fuzz" },
    { sorte: "barbe", motif: /^Beard_/, composant: "Beard" },
    { sorte: "moustache", motif: /^Mustache_/, composant: "Mustache" },
];

function grooms() {
    const racineRef = `${SOURCE}/Metahuman_Ref`;
    const parNom = new Map();
    for (const dossier of fs.readdirSync(racineRef)) {
        if (!/^(F|M)CS/.test(dossier)) continue;
        for (const famille of fs.readdirSync(`${racineRef}/${dossier}`)) {
            const hairDir = `${racineRef}/${dossier}/${famille}/Hair`;
            const bindDir = `${racineRef}/${dossier}/${famille}/GroomBinding`;
            if (!fs.existsSync(hairDir)) continue;
            for (const f of fs.readdirSync(hairDir)) {
                if (!f.endsWith(".uasset") || /CardsMesh|_LOD\d/.test(f)) continue;
                const nom = f.replace(/\.uasset$/, "");
                const def = SORTES_GROOM.find((s) => s.motif.test(nom));
                if (!def) continue;
                const liaisons = fs.existsSync(bindDir)
                    ? fs.readdirSync(bindDir).filter((b) => b.startsWith(nom + "_") && b.endsWith(".uasset")).sort() : [];
                if (!liaisons.length) continue;
                // Un même groom existe dans plusieurs identités : UNE entrée par genre de
                // liaison (voir `genreLiaison`), la première trouvée dans l'ordre trié.
                const genre = genreLiaison(`${famille}/GroomBinding/${liaisons[0]}`);
                const cle = `${nom}|${genre ?? "mf"}`;
                if (parNom.has(cle)) continue;
                parNom.set(cle, {
                    // L'id historique reste celui du premier genre rencontré ; un second
                    // genre du même groom prend un suffixe (réécrit après la boucle).
                    id: `${def.sorte}_${nom.toLowerCase()}`,
                    genre: genre ?? "mf",
                    sorte: def.sorte,
                    composant: def.composant,
                    label: LIBELLES_GROOM[nom] ?? libelle(nom.replace(def.motif, "")),
                    groom: `${PREFIXE_NARVOS}Metahuman_Ref/${dossier}/${famille}/Hair/${nom}`,
                    liaison: `${PREFIXE_NARVOS}Metahuman_Ref/${dossier}/${famille}/GroomBinding/${liaisons[0].replace(/\.uasset$/, "")}`,
                    origine_groom: `${PREFIXE_ORIGINE}Metahuman_Ref/${dossier}/${famille}/Hair/${nom}`,
                    origine_liaison: `${PREFIXE_ORIGINE}Metahuman_Ref/${dossier}/${famille}/GroomBinding/${liaisons[0].replace(/\.uasset$/, "")}`,
                });
            }
        }
    }
    // Deux entrées du même groom (un genre chacune) : ids suffixés par le genre,
    // sinon la normalisation confondrait les deux liaisons.
    const parId = new Map();
    for (const g of parNom.values()) parId.set(g.id, (parId.get(g.id) ?? 0) + 1);
    for (const g of parNom.values()) if (parId.get(g.id) > 1) g.id = `${g.id}_${g.genre}`;
    return [...parNom.values()].sort((a, b) => a.id.localeCompare(b.id));
}

// ── 5. MetaWardrobe : les SkeletalMesh de Meshes/<Genre>_Tal_Nrm[_Theme] ─────────
//
// L'emplacement se DÉCIDE par le nom : le pack ne range pas ses pièces par slot
// (Meshes/M_Tal_Nrm mélange vestes, jeans et bottes) et ne porte aucune donnée qui
// le dise. La règle est écrite ici, une fois, dans l'ordre où elle s'applique.
// Les tenues paramétriques de `Outfits/` (Chaos Outfit Asset, UE 5.6) sont exclues :
// leur plugin n'est pas dans le client nanos.
const EMPLACEMENT_PAR_NOM = [
    ["accessoire", /helmet|bag\b|belt|cape|suspender|hat\b|mask|goggle/i],
    ["chaussures", /boot|sneaker|flip_?flop|sock|shoe/i],
    ["tenue", /dress|bikini|suit|outfit|knight|witch|wizard|victorian|survivor|gold_armor|armor_inside|inside_clothing/i],
    // `sweat(?!er)` : « SK_Sweater » est un HAUT. Teste avant la regle `haut`,
    // `sweat` seul le rangeait en bas (releve le 2026-09-14).
    ["bas", /pant|jean|short|skirt|sweat(?!er)|bottom|lowerarmor/i],
    ["haut", /top|jacket|shirt|blouse|sweater|vest|upperarmor|crop|sleeveless/i],
];
const THEMES = { CyberPunk: "Cyberpunk", Fantasy: "Fantasy", Medieval: "Médiéval", Sci_Fi: "Sci-Fi" };

function metawardrobe() {
    const sortie = { haut: [], bas: [], chaussures: [], tenue: [], accessoire: [] };
    const nonClasses = [];
    const racines = [];
    const meshes = `${WARDROBE}/Meshes`;
    if (!fs.existsSync(meshes)) return { sortie, nonClasses, racines };
    for (const dossier of fs.readdirSync(meshes).sort()) {
        const m = dossier.match(/^(F|M)_Tal_Nrm(?:_(.+))?$/);
        if (!m || !fs.statSync(`${meshes}/${dossier}`).isDirectory()) continue;
        const genre = m[1] === "F" ? "f" : "m";
        const theme = m[2] ? (THEMES[m[2]] ?? m[2]) : null;
        for (const f of fs.readdirSync(`${meshes}/${dossier}`).sort()) {
            if (!/^S[Kk]_.*\.uasset$/.test(f) || /_Anim\.|_Sim\.|PhysicsAsset/.test(f)) continue;
            const nom = f.replace(/\.uasset$/, "");
            const regle = EMPLACEMENT_PAR_NOM.find(([, motif]) => motif.test(nom));
            if (!regle) { nonClasses.push(`${dossier}/${nom}`); continue; }
            const origine = `${PREFIXE_WARDROBE}Meshes/${dossier}/${nom}`;
            racines.push(origine);
            sortie[regle[0]].push({
                id: `mw_${regle[0]}_${genre}_${(m[2] ?? "base").toLowerCase()}_${nom.toLowerCase()}`,
                label: libelle(nom) + (theme ? ` (${theme})` : ""),
                genre,
                chemin: `${PREFIXE_WARDROBE_NARVOS}Meshes/${dossier}/${nom}`,
                origine,
                source: "MetaWardrobe",
                disque: true,
            });
        }
    }
    return { sortie, nonClasses, racines };
}

function main() {
    const styler = lireStyler();
    const wardrobe = metawardrobe();
    const options = {
        genere_par: "scripts/narvos-metacustom-options.mjs",
        source: path.relative(RACINE, SOURCE),
        vetements: (() => {
            const v = vetements(styler);
            for (const [sorte, liste] of Object.entries(wardrobe.sortie)) v[sorte] = [...(v[sorte] ?? []), ...liste];
            return v;
        })(),
        tatouages: tatouages(styler),
        identites: identites(),
        grooms: grooms(),
        defauts_styler: {
            yeux: { IrisColor1U: styler.vars.Eye_Outer_Value, IrisColor2U: styler.vars.Eye_Inner_Value, IrisBrightness: styler.vars.Eye_Brightness_Value },
            teinte: { H: styler.vars.Skin_Tint_H_Value, S: styler.vars.Skin_Tint_S_Value, V: styler.vars.Skin_Tint_V_Value },
            cheveux: { H: styler.vars.Hair_Value_1, V: styler.vars.Hair_Value_2 },
        },
    };

    let total = 0, absents = 0;
    for (const [sorte, liste] of Object.entries(options.vetements)) {
        const ok = liste.filter((o) => o.disque).length;
        total += liste.length; absents += liste.length - ok;
        console.log(`${sorte.padEnd(11)} ${ok}/${liste.length} sur disque`);
    }
    console.log(`tatouages   ${options.tatouages.filter((t) => t.disque).length}/${options.tatouages.length}`);
    console.log(`identites   ${options.identites.map((i) => `${i.label}(${i.genre})`).join(", ")}`);
    const parSorte = {};
    for (const g of options.grooms) parSorte[g.sorte] = (parSorte[g.sorte] ?? 0) + 1;
    console.log(`grooms      ${Object.entries(parSorte).map(([s, n]) => `${s} ${n}`).join(", ")}`);
    console.log(`vetements   ${total - absents}/${total} au total`);

    // Racines à lier : identités (fermeture = visage, corps, matériaux, textures,
    // grooms de l'identité) + chaque groom et sa liaison, trouvés hors des Blueprints.
    const racines = new Set();
    for (const i of options.identites) if (i.blueprint) racines.add(i.blueprint);
    for (const g of options.grooms) { racines.add(g.origine_groom); racines.add(g.origine_liaison); }

    console.log(`metawardrobe ${wardrobe.racines.length} piece(s) classee(s), ${wardrobe.nonClasses.length} non classee(s)${wardrobe.nonClasses.length ? " : " + wardrobe.nonClasses.join(", ") : ""}`);

    if (!APPLY) { console.log(`(constat seul — ${racines.size} racine(s) a lier ; --apply pour ecrire)`); return; }
    fs.writeFileSync(`${MANIFESTES}/metawardrobe-promotion.json`, JSON.stringify({
        note: "Racines MetaWardrobe (vetements classes par emplacement). Consomme par scripts/adk-copier-hyper.mjs --racine Metawadrobe --cible MetaCustom/Metawadrobe. Genere par scripts/narvos-metacustom-options.mjs.",
        racines: wardrobe.racines.sort(),
    }, null, 2) + "\n");
    fs.writeFileSync(`${MANIFESTES}/metacustom-options.json`, JSON.stringify(options, null, 1) + "\n");
    fs.writeFileSync(`${MANIFESTES}/metahuman_ref-passe2.json`, JSON.stringify({
        note: "Racines de la fermeture Metahuman_Ref, passe 2 (2026-09-13 soir) : toutes les identites presentes et tous les grooms, pour les menus du Meta Customization System. Genere par scripts/narvos-metacustom-options.mjs.",
        racines: [...racines].sort(),
    }, null, 2) + "\n");
    console.log(`ecrit : metacustom-options.json, metahuman_ref-passe2.json (${racines.size} racines)`);
}

main();