// ══════════════════════════════════════════════════════════════════════════════
// uasset-physique.mjs — lit les corps d'un PhysicsAsset (source OU cuit).
//
//   import { lireCorps } from "./lib/uasset-physique.mjs";
//
// Rend, pour chaque `SkeletalBodySetup` : l'os, et chaque volume de son
// `AggGeom` avec ses valeurs ET la position de ces valeurs dans le fichier —
// c'est ce qui permet de réécrire un rayon sur place, sans changer une taille.
//
// ── FORMAT (lu, pas supposé) ──────────────────────────────────────────────────
//   · UE5 ≥ 1012 : noms de type complets dans l'étiquette de propriété, octet de
//     contrôle de sérialisation en tête d'objet (≥ 1011), entrée d'export de
//     112 octets avec ScriptSerializationStart/End (≥ 1010).
//   · Le paquet CUIT par l'ADK nanos garde les propriétés ÉTIQUETÉES (vérifié
//     le 2026-09-13 : `Radius` 0,505 retrouvé 44 fois à l'identique dans le
//     .uexp cuit et dans le .uasset source). Même décodeur pour les deux.
//   · Vector / Rotator : 3 doubles natifs (LWC). Radius / Length : float.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const NATIFS = { Vector: 24, Rotator: 24, Quat: 32, Vector2D: 16, LinearColor: 16, Color: 4, Guid: 16, IntPoint: 8, Vector3f: 12, Vector4: 32, Box: 49 };

function lecteur(buf) {
  return {
    pos: 0,
    i32() { const v = buf.readInt32LE(this.pos); this.pos += 4; return v; },
    u32() { const v = buf.readUInt32LE(this.pos); this.pos += 4; return v; },
    u8() { const v = buf.readUInt8(this.pos); this.pos += 1; return v; },
    i64() { const v = Number(buf.readBigInt64LE(this.pos)); this.pos += 8; return v; },
    fstr() {
      const n = this.i32();
      if (n === 0) return "";
      if (n > 0) { const s = buf.toString("latin1", this.pos, this.pos + n - 1); this.pos += n; return s; }
      const m = -n; const s = buf.toString("utf16le", this.pos, this.pos + (m - 1) * 2); this.pos += m * 2; return s;
    },
  };
}

/**
 * @param {string} fichier  chemin du .uasset (le .uexp voisin est lu s'il existe)
 * @returns {{ ue5:number, corps: Array<{ os:string, fichierDonnees:string, volumes: Array<object> }> }}
 */
export function lireCorps(fichier) {
  const b = fs.readFileSync(fichier);
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
  L.fstr();
  const flags = L.u32();
  const nameCount = L.i32(), nameOffset = L.i32();
  if (ue5 >= 1008) { L.i32(); L.i32(); }
  if (!(flags & 0x80000000)) L.fstr();
  L.i32(); L.i32();
  const exportCount = L.i32(), exportOffset = L.i32();
  const importCount = L.i32(), importOffset = L.i32();
  if (ue5 < 1012) throw new Error(`${fichier} : UE5 ${ue5}, format non gere (>= 1012 attendu)`);

  L.pos = nameOffset;
  const names = [];
  for (let k = 0; k < nameCount; k++) { names.push(L.fstr()); L.pos += 4; }
  const fname = (R) => { const i = R.i32(), n = R.i32(); return (names[i] ?? `?${i}`) + (n > 0 ? `_${n - 1}` : ""); };

  const tailleImport = importCount ? Math.round((exportOffset - importOffset) / importCount) : 0;
  const imports = [];
  for (let k = 0; k < importCount; k++) {
    L.pos = importOffset + k * tailleImport;
    fname(L); fname(L); L.i32(); imports.push(fname(L));
  }
  const exps = [];
  for (let k = 0; k < exportCount; k++) {
    const base = exportOffset + k * 112;
    L.pos = base;
    const cls = L.i32(); L.i32(); L.i32(); L.i32();
    const nom = fname(L); L.u32();
    L.i64(); const offset = L.i64();
    exps.push({ cls, nom, offset, ds: Number(b.readBigInt64LE(base + 96)), fs: Number(b.readBigInt64LE(base + 104)) });
  }
  const classe = (e) => (e.cls < 0 ? imports[-e.cls - 1] : e.cls > 0 ? exps[e.cls - 1]?.nom : "Class");

  // Décode des propriétés étiquetées ; chaque valeur feuille porte `@` = son
  // offset ABSOLU dans le tampon de données.
  function decoder(src, pos, fin) {
    const R = lecteur(src);
    R.pos = pos;
    const out = {};
    for (let g = 0; g < 500 && R.pos < fin; g++) {
      const nom = fname(R);
      if (nom === "None") break;
      const type = []; let reste = 1;
      while (reste > 0) { type.push(fname(R)); reste += R.i32() - 1; }
      const taille = R.i32();
      const fl = R.u8();
      if (fl & 0x01) R.i32();
      if (fl & 0x02) R.pos += 16;
      if (fl & 0x04) { const ext = R.u8(); if (ext & 0x02) R.u8(); }
      const deb = R.pos;
      const t = type[0];
      let val;
      if (t === "FloatProperty") val = { v: src.readFloatLE(deb), "@": deb, t: "f" };
      else if (t === "DoubleProperty") val = { v: src.readDoubleLE(deb), "@": deb, t: "d" };
      else if (t === "IntProperty") val = src.readInt32LE(deb);
      else if (t === "BoolProperty") val = !!(fl & 0x10);
      else if (t === "NameProperty") { const R2 = lecteur(src); R2.pos = deb; val = fname(R2); }
      else if (t === "StructProperty" && (type[1] === "Vector" || type[1] === "Rotator")) {
        val = { v: [src.readDoubleLE(deb), src.readDoubleLE(deb + 8), src.readDoubleLE(deb + 16)], "@": deb, t: "v3" };
      } else if (t === "StructProperty" && !NATIFS[type[1]]) {
        val = decoder(src, deb, deb + taille);
      } else if (t === "ArrayProperty" && type[1] === "StructProperty" && !NATIFS[type[2]]) {
        const n = src.readInt32LE(deb);
        val = [];
        let p = deb + 4;
        for (let k = 0; k < n; k++) {
          const o = decoder(src, p, deb + taille);
          val.push(o.__proprietes);
          p = o.__fin;
        }
      } else val = { type: type.join("/"), octets: taille };
      out[nom] = val;
      R.pos = deb + taille;
    }
    // `None` final lu : la position suivante est la fin de cet objet.
    return { __proprietes: out, __fin: R.pos, ...out };
  }

  const corps = [];
  for (const e of exps) {
    if (classe(e) !== "SkeletalBodySetup") continue;
    const dansUexp = e.offset >= b.length && uexp;
    const src = dansUexp ? uexp : b;
    const base = dansUexp ? e.offset - b.length : e.offset;
    const R = lecteur(src);
    R.pos = base + e.ds;
    const ctl = R.u8(); if (ctl & 0x02) R.u8();
    const p = decoder(src, R.pos, base + e.fs).__proprietes;
    const volumes = [];
    const g = p.AggGeom && p.AggGeom.__proprietes ? p.AggGeom.__proprietes : p.AggGeom || {};
    for (const [sorte, liste] of Object.entries(g)) {
      if (!Array.isArray(liste)) continue;
      for (const el of liste) volumes.push({ sorte, ...el });
    }
    corps.push({ os: String(p.BoneName), fichierDonnees: dansUexp ? uexpChemin : fichier, volumes });
  }
  return { ue5, corps };
}