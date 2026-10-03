// ═══════════════════════════════════════════════════════════════════════════════
// scripts/lib/uasset-paquet.mjs — en-tête d'un paquet UE 5.7 (.uasset), LECTURE SEULE.
//
// Rend : nom du paquet, table de noms ORDONNÉE, imports résolus (classe + chemin),
// exports (classe + nom). Calibré le 2026-09-13 sur les paquets cuits ET sources
// de l'ADK (LegacyFileVersion -9, UE5 1018).
//
// ⚠ Une table de noms extraite par motif (`/[\x20-\x7e]{3,}/`) n'a PAS d'ordre :
// elle suffit pour « ce nom est-il cité ? », jamais pour relire un FName (index).
// ═══════════════════════════════════════════════════════════════════════════════
import fs from "node:fs";

const TAG_PAQUET = 0x9e2a83c1;
const DRAPEAU_FILTRE_EDITEUR = 0x80000000;

/**
 * @param {string} fichier chemin d'un .uasset
 * @returns {{ packageName: string, names: string[], imports: object[], exports: object[] }}
 */
export function lirePaquet(fichier) {
    const b = fs.readFileSync(fichier);
    let o = 0;
    const i32 = () => { const v = b.readInt32LE(o); o += 4; return v; };
    const u32 = () => { const v = b.readUInt32LE(o); o += 4; return v; };
    const fstr = () => {
        const n = i32();
        if (n === 0) return "";
        if (n > 0) { const s = b.toString("latin1", o, o + n - 1); o += n; return s; }
        const m = -n; const s = b.toString("utf16le", o, o + (m - 1) * 2); o += m * 2; return s;
    };
    if (b.readUInt32LE(0) !== TAG_PAQUET) throw new Error(`tag de paquet invalide : ${fichier}`);
    o = 4;
    const legacy = i32();
    if (legacy !== -4) i32();                       // LegacyUE3Version
    const ue4 = i32();
    const ue5 = legacy <= -8 ? i32() : 0;
    i32();                                          // licensee
    if (ue5 >= 1016) { o += 20; i32(); }            // SavedHash + TotalHeaderSize
    const nCustom = i32(); o += nCustom * 20;
    if (ue5 < 1016) i32();
    const packageName = fstr();
    const flags = u32();
    const nameCount = i32(), nameOffset = i32();
    if (ue5 >= 1008) { i32(); i32(); }              // SoftObjectPaths
    if (!(flags & DRAPEAU_FILTRE_EDITEUR)) fstr();  // LocalizationId
    i32(); i32();                                   // GatherableTextData
    const exportCount = i32(), exportOffset = i32();
    const importCount = i32(), importOffset = i32();
    // Cellules Verse : champs du résumé à partir de UE5 1015 (VERSE_CELLS). Les lire
    // plus tôt décalait tout l'en-tête des paquets UE 5.4 (1012) du Meta Customization System.
    let cellExportOffset = null;
    if (ue5 >= 1015) { i32(); cellExportOffset = i32(); i32(); i32(); }

    o = nameOffset;
    const names = [];
    for (let k = 0; k < nameCount; k++) { names.push(fstr()); o += 4; }
    const fname = (idx, num) => (names[idx] ?? `?${idx}`) + (num > 0 ? `_${num - 1}` : "");

    const tailleImport = importCount ? Math.round((exportOffset - importOffset) / importCount) : 32;
    const imports = [];
    for (let k = 0; k < importCount; k++) {
        o = importOffset + k * tailleImport;
        const classPackage = fname(i32(), i32());
        const className = fname(i32(), i32());
        const outer = i32();
        const objectName = fname(i32(), i32());
        imports.push({ classPackage, className, outer, objectName });
    }
    const chemin = (idx) => {
        const im = imports[-idx - 1];
        if (!im) return "?";
        return im.outer === 0 ? im.objectName : `${chemin(im.outer)}.${im.objectName}`;
    };
    for (const im of imports) im.path = im.outer === 0 ? im.objectName : `${chemin(im.outer)}.${im.objectName}`;

    const exports = [];
    const finExports = cellExportOffset ?? (exportOffset + exportCount * 112);
    const tailleExport = exportCount ? Math.round((finExports - exportOffset) / exportCount) : 0;
    for (let k = 0; k < exportCount; k++) {
        o = exportOffset + k * tailleExport;
        const cls = i32(); o += 12;
        const nom = fname(i32(), i32());
        exports.push({ classe: cls < 0 ? imports[-cls - 1]?.objectName : `export#${cls}`, nom });
    }
    return { fichier, packageName, ue4, ue5, flags, names, imports, exports };
}

/**
 * Première FTransform (doubles, UE5 LWC) d'un fichier : quaternion unitaire,
 * translation, échelle UNIFORME. Dans un .uasset de Skeleton source, c'est la
 * pose de référence de l'os racine.
 * @param {string} fichier
 * @returns {{ q: number[], t: number[], s: number[] } | null}
 */
export function premiereTransform(fichier) {
    if (!fs.existsSync(fichier)) return null;
    const b = fs.readFileSync(fichier);
    for (let o = 0; o + 80 <= b.length; o++) {
        const q = [0, 1, 2, 3].map((k) => b.readDoubleLE(o + 8 * k));
        if (!q.every(Number.isFinite) || Math.abs(Math.hypot(...q) - 1) > 1e-3 || q.every((v) => v === 0)) continue;
        const t = [4, 5, 6].map((k) => b.readDoubleLE(o + 8 * k));
        const s = [7, 8, 9].map((k) => b.readDoubleLE(o + 8 * k));
        if (![...t, ...s].every(Number.isFinite)) continue;
        if (!s.every((v) => Math.abs(v) > 1e-6 && Math.abs(v) < 1e6) || !t.every((v) => Math.abs(v) < 1e7)) continue;
        if (!(Math.abs(s[0] - s[1]) <= 1e-3 * Math.abs(s[0]) && Math.abs(s[1] - s[2]) <= 1e-3 * Math.abs(s[0]))) continue;
        return { q, t, s };
    }
    return null;
}

/**
 * Les neuf canaux de la piste RACINE d'une AnimSequence SOURCE (modèle de données
 * éditeur : [4][n][temps][28][n][valeurs][défaut][a_défaut][fps]) — position
 * X/Y/Z, rotation, puis échelle X/Y/Z en 6, 7, 8.
 * @param {string} fichier
 * @returns {{ locZ: number[], echelle: number[] } | { incomplet: number } | null}
 */
export function canauxRacine(fichier) {
    if (!fs.existsSync(fichier)) return null;
    const b = fs.readFileSync(fichier);
    const canaux = [];
    for (let o = 0; o + 16 < b.length && canaux.length < 9; o++) {
        if (b.readInt32LE(o) !== 4) continue;
        const n = b.readInt32LE(o + 4);
        if (n < 0 || n > 100000) continue;
        const v = o + 8 + n * 4;
        if (v + 8 > b.length || b.readInt32LE(v) !== 28 || b.readInt32LE(v + 4) !== n) continue;
        const e = v + 8 + n * 28;
        if (e + 16 > b.length) continue;
        let mn = Infinity, mx = -Infinity;
        for (let k = 0; k < n; k++) { const x = b.readFloatLE(v + 8 + k * 28); mn = Math.min(mn, x); mx = Math.max(mx, x); }
        canaux.push(n ? { n, mn, mx } : { n: 0, defaut: b.readFloatLE(e) });
        o = e - 1;
    }
    if (canaux.length < 9) return { incomplet: canaux.length };
    const val = (c) => (c.n ? (c.mn + c.mx) / 2 : c.defaut);
    return {
        locZ: canaux[2].n ? [canaux[2].mn, canaux[2].mx] : [canaux[2].defaut, canaux[2].defaut],
        echelle: [val(canaux[6]), val(canaux[7]), val(canaux[8])],
    };
}