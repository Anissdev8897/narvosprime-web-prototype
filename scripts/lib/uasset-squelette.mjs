// uasset-squelette.mjs — noms, parents et pose de référence d'un Skeleton (.uasset).
// FReferenceSkeleton : RawRefBoneInfo [n] (FName, ParentIndex, ExportName?)
// puis RawRefBonePose [n] (FTransform double : quat 4, trans 3, echelle 3).
import fs from "node:fs";

export function lireSquelette(f) {
  const b = fs.readFileSync(f);
  // ── table de noms ──
  let p = 4;
  const i32 = () => { const v = b.readInt32LE(p); p += 4; return v; };
  const u32 = () => { const v = b.readUInt32LE(p); p += 4; return v; };
  const fstr = () => {
    const n = i32();
    if (n === 0) return "";
    if (n > 0) { const s = b.toString("latin1", p, p + n - 1); p += n; return s; }
    const m = -n; const s = b.toString("utf16le", p, p + (m - 1) * 2); p += m * 2; return s;
  };
  const legacy = i32();
  if (legacy !== -4) i32();
  i32();
  const ue5 = legacy <= -8 ? i32() : 0;
  i32();
  if (ue5 >= 1016) { p += 20; i32(); }
  const nCustom = i32(); p += nCustom * 20;
  if (ue5 < 1016) i32();
  fstr();
  u32();
  const nameCount = i32(), nameOffset = i32();
  p = nameOffset;
  const names = [];
  for (let k = 0; k < nameCount; k++) { names.push(fstr()); p += 4; }

  // ── pose : suites de FTransform doubles, la plus longue ──
  const poses = [];
  for (let o = 0; o + 84 <= b.length; o++) {
    const n = b.readInt32LE(o);
    if (n < 1 || n > 2000) continue;
    const debut = o + 4;
    if (debut + n * 80 > b.length) continue;
    let valide = true;
    for (let k = 0; k < n && valide; k++) {
      const q = [0, 8, 16, 24].map((d) => b.readDoubleLE(debut + k * 80 + d));
      const norme = Math.hypot(...q);
      if (!(Math.abs(norme - 1) < 1e-3)) valide = false;
      const s = [56, 64, 72].map((d) => b.readDoubleLE(debut + k * 80 + d));
      if (!s.every((x) => Number.isFinite(x) && Math.abs(x) > 1e-7 && Math.abs(x) < 1e5)) valide = false;
    }
    if (valide) poses.push({ o, n });
  }
  poses.sort((a, c) => c.n - a.n);
  const pose = poses[0];
  if (!pose) throw new Error(`${f} : pose de reference introuvable`);

  // ── infos d'os : juste avant, count = n, entrees (FName, parent[, ExportName]) ──
  const lireInfos = (o, avecExport) => {
    let q = o;
    if (b.readInt32LE(q) !== pose.n) return null;
    q += 4;
    const infos = [];
    for (let k = 0; k < pose.n; k++) {
      const idx = b.readInt32LE(q), num = b.readInt32LE(q + 4), parent = b.readInt32LE(q + 8);
      q += 12;
      if (idx < 0 || idx >= names.length || num < 0 || num > 1000) return null;
      if (!(parent === -1 ? k === 0 : parent >= 0 && parent < k)) return null;
      if (avecExport) {
        const len = b.readInt32LE(q);
        if (len < 0 || len > 256) return null;
        q += 4 + len;
      }
      infos.push({ nom: names[idx] + (num > 0 ? `_${num - 1}` : ""), parent });
    }
    return { fin: q, infos };
  };
  let infos = null;
  for (let o = pose.o - 12; o >= 0 && !infos; o--) {
    for (const avec of [false, true]) {
      const r = lireInfos(o, avec);
      if (r && r.fin === pose.o) { infos = r.infos; break; }
    }
  }
  if (!infos) throw new Error(`${f} : infos d'os introuvables avant la pose @${pose.o}`);

  const os = infos.map((inf, k) => {
    const d = pose.o + 4 + k * 80;
    const r = (x) => b.readDoubleLE(d + x);
    return { ...inf, q: [r(0), r(8), r(16), r(24)], t: [r(32), r(40), r(48)], s: [r(56), r(64), r(72)] };
  });
  return { names, os };
}

if (process.argv[1] && process.argv[1].endsWith("uasset-squelette.mjs")) {
  const { os } = lireSquelette(process.argv[2]);
  os.forEach((o, k) => console.log(String(k).padStart(3), o.nom.padEnd(20), "parent", String(o.parent).padStart(3),
    "t", o.t.map((x) => x.toFixed(1)).join(","), "s", o.s[0].toPrecision(3)));
}