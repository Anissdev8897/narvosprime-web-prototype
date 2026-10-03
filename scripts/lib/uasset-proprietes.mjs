// ═══════════════════════════════════════════════════════════════════════════════
// scripts/lib/uasset-proprietes.mjs — relire les PROPRIÉTÉS SÉRIALISÉES d'un paquet
// Unreal 5.4+ (éditeur, propriétés TAGUÉES), sans Unreal. LECTURE SEULE.
//
// Rend, pour chaque export : sa classe, son nom, son outer et ses propriétés de
// premier niveau (références d'objets et d'objets « soft », nombres, booléens,
// chaînes). Les structures et tableaux sont nommés, pas dépliés.
//
// ── POURQUOI ─────────────────────────────────────────────────────────────────
// Les copies du Meta Customization System dans l'ADK ont été RESAUVÉES sans les
// MetaHumans : leurs références valent null (mesuré le 2026-09-13). Seuls les
// fichiers d'ORIGINE, hors Content/, disent quelles options le Styler propose.
// Ils ne sont pas montés dans l'éditeur : on les lit donc octet par octet.
//
// ── LE FORMAT (versions d'objet UE5, relevées sur BP_Meta_Styler, UE5 1012) ─────
//   · résumé : SoftObjectPaths (1008+) ; entrée d'export de 112 octets, dont
//     ScriptSerializationStart/End (1010+) aux octets 96 et 104 ;
//   · propriétés : un octet de contrôle de sérialisation (1011+), puis des
//     FPropertyTag au TYPE COMPLET (1012+) : Nom, arbre de type aplati
//     (nom, nombre d'enfants), Taille, Drapeaux, [index], [guid], [extensions] ;
//   · une référence « soft » est un INDEX dans la liste SoftObjectPaths.
// ═══════════════════════════════════════════════════════════════════════════════
import fs from "node:fs";

const TAG_PAQUET = 0x9e2a83c1;
const DRAPEAU_FILTRE_EDITEUR = 0x80000000;
const TAILLE_EXPORT_1010 = 112;
const TAG_A_INDEX = 0x01;
const TAG_A_GUID = 0x02;
const TAG_A_EXTENSIONS = 0x04;
const TAG_BOOLEEN_VRAI = 0x10;
const MAX_PROPRIETES = 20000;

function lecteur(b) {
    let o = 0;
    const r = {
        get pos() { return o; },
        set pos(v) { o = v; },
        i32() { const v = b.readInt32LE(o); o += 4; return v; },
        u32() { const v = b.readUInt32LE(o); o += 4; return v; },
        i64() { const v = Number(b.readBigInt64LE(o)); o += 8; return v; },
        u8() { const v = b.readUInt8(o); o += 1; return v; },
        fstr() {
            const n = r.i32();
            if (n === 0) return "";
            if (n > 0) { const s = b.toString("latin1", o, o + n - 1); o += n; return s; }
            const m = -n; const s = b.toString("utf16le", o, o + (m - 1) * 2); o += m * 2; return s;
        },
    };
    return r;
}

/**
 * @param {string} fichier un .uasset (et son .uexp s'il existe)
 */
export function lireProprietes(fichier) {
    const b = fs.readFileSync(fichier);
    if (b.readUInt32LE(0) !== TAG_PAQUET) throw new Error(`tag de paquet invalide : ${fichier}`);
    const uexpChemin = fichier.replace(/\.uasset$/i, ".uexp");
    const uexp = fs.existsSync(uexpChemin) ? fs.readFileSync(uexpChemin) : null;
    const L = lecteur(b);
    L.pos = 4;
    const legacy = L.i32();
    if (legacy !== -4) L.i32();
    L.i32();
    const ue5 = legacy <= -8 ? L.i32() : 0;
    L.i32();
    if (ue5 >= 1016) { L.pos += 20; L.i32(); }
    const nCustom = L.i32(); L.pos += nCustom * 20;
    if (ue5 < 1016) L.i32();
    const packageName = L.fstr();
    const flags = L.u32();
    const nameCount = L.i32(), nameOffset = L.i32();
    let softCount = 0, softOffset = 0;
    if (ue5 >= 1008) { softCount = L.i32(); softOffset = L.i32(); }
    if (!(flags & DRAPEAU_FILTRE_EDITEUR)) L.fstr();
    L.i32(); L.i32();
    const exportCount = L.i32(), exportOffset = L.i32();
    const importCount = L.i32(), importOffset = L.i32();
    if (ue5 < 1012) throw new Error(`${fichier} : UE5 ${ue5}, format de propriete non gere (>= 1012 attendu)`);

    L.pos = nameOffset;
    const names = [];
    for (let k = 0; k < nameCount; k++) { names.push(L.fstr()); L.pos += 4; }
    const fname = () => { const i = L.i32(), n = L.i32(); return (names[i] ?? `?${i}`) + (n > 0 ? `_${n - 1}` : ""); };

    L.pos = softOffset;
    const softs = [];
    for (let k = 0; k < softCount; k++) {
        const pk = fname(); const as = fname(); const sub = L.fstr();
        softs.push(pk + (as !== "None" ? "." + as : "") + (sub ? ":" + sub : ""));
    }

    const tailleImport = importCount ? Math.round((exportOffset - importOffset) / importCount) : 0;
    const imports = [];
    for (let k = 0; k < importCount; k++) {
        L.pos = importOffset + k * tailleImport;
        fname(); const cn = fname(); const outer = L.i32(); const on = fname();
        imports.push({ classe: cn, outer, nom: on });
    }
    const cheminImport = (idx) => {
        const im = imports[-idx - 1];
        if (!im) return "?";
        return im.outer === 0 ? im.nom : `${cheminImport(im.outer)}.${im.nom}`;
    };

    const exports = [];
    for (let k = 0; k < exportCount; k++) {
        const base = exportOffset + k * TAILLE_EXPORT_1010;
        L.pos = base;
        const cls = L.i32(); L.i32(); L.i32(); const outer = L.i32();
        const nom = fname(); L.u32();
        const taille = L.i64(); const offset = L.i64();
        const debutScript = Number(b.readBigInt64LE(base + 96));
        const finScript = Number(b.readBigInt64LE(base + 104));
        exports.push({ index: k + 1, cls, outer, nom, taille, offset, debutScript, finScript });
    }
    const nomExport = (idx) => exports[idx - 1]?.nom ?? `export#${idx}`;
    const classeDe = (e) => (e.cls < 0 ? imports[-e.cls - 1]?.nom : e.cls > 0 ? nomExport(e.cls) : "Class");

    const reference = (idx) => (idx < 0 ? cheminImport(idx) : idx > 0 ? `${packageName}.${nomExport(idx)}` : null);

    function proprietes(e) {
        const src = e.offset >= b.length && uexp ? uexp : b;
        const debut = (e.offset >= b.length && uexp ? e.offset - b.length : e.offset) + e.debutScript;
        const fin = (e.offset >= b.length && uexp ? e.offset - b.length : e.offset) + e.finScript;
        const P = lecteur(src);
        P.pos = debut;
        const rname = () => { const i = P.i32(), n = P.i32(); return (names[i] ?? `?${i}`) + (n > 0 ? `_${n - 1}` : ""); };
        const rtype = () => {
            const parts = []; let reste = 1;
            while (reste > 0) { const n = rname(); const enfants = P.i32(); parts.push(n); reste += enfants - 1; }
            return parts;
        };
        const sortie = {};
        const controle = P.u8();
        if (controle & 0x02) P.u8();
        for (let garde = 0; garde < MAX_PROPRIETES && P.pos < fin; garde++) {
            const nom = rname();
            if (nom === "None") break;
            const type = rtype();
            const taille = P.i32();
            const fl = P.u8();
            let index = 0;
            if (fl & TAG_A_INDEX) index = P.i32();
            if (fl & TAG_A_GUID) P.pos += 16;
            if (fl & TAG_A_EXTENSIONS) { const ext = P.u8(); if (ext & 0x02) P.u8(); }
            const deb = P.pos;
            const t = type[0];
            let val;
            if (t === "SoftObjectProperty" || t === "SoftClassProperty") val = softs[src.readInt32LE(deb)] ?? null;
            else if (t === "ObjectProperty" || t === "ClassProperty" || t === "WeakObjectProperty") val = reference(src.readInt32LE(deb));
            else if (t === "FloatProperty") val = src.readFloatLE(deb);
            else if (t === "DoubleProperty") val = src.readDoubleLE(deb);
            else if (t === "IntProperty") val = src.readInt32LE(deb);
            else if (t === "BoolProperty") val = !!(fl & TAG_BOOLEEN_VRAI);
            else if (t === "StrProperty") { P.pos = deb; val = P.fstr(); }
            else if (t === "NameProperty") { P.pos = deb; val = rname(); }
            // FByteProperty/FEnumProperty::SerializeItem : une énumération
            // sauvegardée est un FName, contrairement à un octet numérique.
            else if ((t === "ByteProperty" || t === "EnumProperty") && taille === 8) { P.pos = deb; val = rname(); }
            else if (t === "ByteProperty" && taille === 1) val = src.readUInt8(deb);
            else if (t === "ArrayProperty") {
                const n = src.readInt32LE(deb);
                const inner = type[1];
                if (inner === "ObjectProperty" || inner === "SoftObjectProperty") {
                    val = [];
                    for (let k = 0; k < n; k++) {
                        const idx = src.readInt32LE(deb + 4 + k * 4);
                        val.push(inner === "ObjectProperty" ? reference(idx) : softs[idx] ?? null);
                    }
                } else val = { tableau: inner, taille: n };
            } else val = { type: type.join("/"), octets: taille };
            sortie[index ? `${nom}[${index}]` : nom] = val;
            P.pos = deb + taille;
        }
        return sortie;
    }

    return {
        packageName,
        ue5,
        names,
        softs,
        imports: imports.map((im, k) => ({ ...im, chemin: cheminImport(-(k + 1)) })),
        exports: exports.map((e) => ({ ...e, classe: classeDe(e), outerNom: e.outer > 0 ? nomExport(e.outer) : null })),
        proprietes: (e) => proprietes(e),
    };
}