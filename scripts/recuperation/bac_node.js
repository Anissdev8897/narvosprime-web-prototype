// ══════════════════════════════════════════════════════════════════════════════
// bac_node.js — exécute UN script Node d'historique dans un bac à sable : aucun
// fichier réel n'est lu ni écrit, aucune commande n'est lancée. Lancé par bac.py,
// qui passe le travail en JSON sur l'entrée standard et lit le résultat en sortie.
// Même contrat que bac_python.py (clés "p:<relatif>" / "h:<absolu>", `manque`).
//
// Le script reçoit un faux `require` : `fs` et `child_process` sont des coquilles
// (fichiers en mémoire, commandes inertes), `path`, `url`, `util`, `os`, `assert`,
// `crypto` sont les vrais, tout autre paquet est absent. Les modules LOCAUX
// (`./lib/x.mjs`) sont chargés depuis les fichiers en mémoire. Les `import … from`
// sont réécrits en `require` : un script d'historique n'a pas besoin de plus.
// ══════════════════════════════════════════════════════════════════════════════
"use strict";
const chemin = require("path").win32;
const vraiUrl = require("url");

const TRAVAIL = JSON.parse(require("fs").readFileSync(0, "utf8"));
const RACINES = TRAVAIL.racines.map((r) => r.toLowerCase().replace(/\\+$/, ""));
const FICHIERS = TRAVAIL.fichiers;
const CONNUS = TRAVAIL.connus || [];
const ETAT = { cwd: "C:\\", ecrits: {}, lus: [], manque: null, noms: {}, aveugles: [], generes: [], troues: [] };
const MANQUE = Symbol("manque");

// ── L'horloge : celle de la commande d'origine ───────────────────────────────
// Un script qui date ce qu'il écrit (`genere_le: new Date().toISOString()`) y poserait
// sinon l'heure du REJEU : une date d'après la perte dans un fichier d'avant, et deux
// extractions de suite qui ne rendent pas le même fichier. `TRAVAIL.instant` (secondes)
// est l'instant où la commande a rendu son résultat.
if (typeof TRAVAIL.instant === "number") {
  const VraieDate = Date;
  const INSTANT = Math.round(TRAVAIL.instant * 1000);
  globalThis.Date = new Proxy(VraieDate, {
    construct: (cible, args) => (args.length ? new cible(...args) : new cible(INSTANT)),
    apply: (cible) => new cible(INSTANT).toString(),
    get: (cible, nom) => (nom === "now" ? () => INSTANT : cible[nom]),
  });
}

// ── Les réponses À L'AVEUGLE ─────────────────────────────────────────────────
// Même règle que bac_python.py : le bac ne tient que le TEXTE vu par les historiques.
// Un fichier binaire y est toujours « absent », un dossier inconnu toujours vide. Chaque
// réponse de ce genre est notée ; l'appelant ne posera pas ce que le script a écrit.
const BINAIRE = new RegExp("\\.(?:glb|gltf|bin|uasset|umap|uexp|ubulk|pak|png|jpe?g|webp|ktx2|basis|tga|bmp|gif|ico|wav|ogg"
  + "|mp3|mp4|webm|fbx|obj|blend|vrm|ttf|otf|woff2?|zip|7z|rar|gz|tar|exe|dll|pdb|db|sqlite3?|pdf|psd|hdr|exr|dds|wasm"
  + "|pyc|unitypackage|asset|prefab|anim)$", "i");
function aveugle(quoi) {
  if (ETAT.aveugles.indexOf(quoi) < 0) ETAT.aveugles.push(quoi);
}
// Avant la PREMIÈRE écriture d'un fichier : GÉNÉRÉ (écrit sans avoir été lu) ou MODIFIÉ en
// place (lu puis réécrit, ou prolongé) ? Un fichier généré tient son contenu de ce que le
// script a vu — réponses à l'aveugle comprises : l'appelant ne le posera pas.
function noterEcriture(c, prolonge) {
  if (!Object.prototype.hasOwnProperty.call(ETAT.ecrits, c) && ETAT.lus.indexOf(c) < 0 && !prolonge
      && ETAT.generes.indexOf(c) < 0) ETAT.generes.push(c);
}

// ── L'indulgence : un texte TROUÉ ne répond pas « non » comme un texte entier ──
// Même règle que bac_python.py (le détail de la relance est dans bac.executer) :
//   · `s.includes(a)` sur un texte troué répond d'abord non ; si le script échoue ensuite,
//     bac.py relance en imposant « oui » à la dernière vérification incertaine ;
//   · un `replace` dont l'ancre n'est pas dans ce qu'on tient a eu lieu dans un trou : il
//     ressort comme modification SANS POSITION, signalée par une marque en fin de texte.
// Une chaîne JavaScript n'a pas de sous-classe : on reconnaît un texte troué à ses
// lignes-témoins, et ce sont les méthodes de String qui sont remplacées.
const DECISIONS = TRAVAIL.decisions || [];
const PRESUMES = new Set();
const ATTENTE = []; // modifications sans position : [ancien, neuf, partout]
let incertains = 0;
const VRAIES = {
  includes: String.prototype.includes,
  replace: String.prototype.replace,
  replaceAll: String.prototype.replaceAll,
  endsWith: String.prototype.endsWith,
};
const partiel = (t) => VRAIES.includes.call(t, "\x00TROU") || VRAIES.includes.call(t, "\x00FIN");
const substantiel = (a) => typeof a === "string" && a.trim().length >= 6 && !VRAIES.includes.call(a, "\x00");

function presume(texte, a) {
  if (!substantiel(a) || !partiel(texte)) return false;
  if (PRESUMES.has(a)) return true;
  const i = incertains++;
  if (i < DECISIONS.length && DECISIONS[i]) {
    PRESUMES.add(a);
    return true;
  }
  return false;
}

function enAttente(texte, a, neuf, partout) {
  ATTENTE.push([a, neuf, partout]);
  return texte + (VRAIES.endsWith.call(texte, "\n") ? "" : "\n") + "\x00MODIF" + (ATTENTE.length - 1) + "\x00\n";
}

String.prototype.includes = function (a, position) {
  return VRAIES.includes.call(this, a, position) || (!position && presume(String(this), a));
};
String.prototype.replace = function (a, b) {
  const fait = VRAIES.replace.call(this, a, b);
  if (!substantiel(a) || typeof b !== "string" || !partiel(String(this)) || VRAIES.includes.call(this, a)) return fait;
  const neuf = VRAIES.replace.call(a, a, b); // développe `$&`, `$$`… comme l'aurait fait le remplacement
  return neuf === a ? fait : enAttente(fait, a, neuf, false);
};
String.prototype.replaceAll = function (a, b) {
  const fait = VRAIES.replaceAll.call(this, a, b);
  if (!substantiel(a) || typeof b !== "string" || !partiel(String(this)) || VRAIES.includes.call(this, a)) return fait;
  const neuf = VRAIES.replace.call(a, a, b);
  return neuf === a ? fait : enAttente(fait, a, neuf, true);
};

function absolu(p) {
  p = String(p instanceof URL ? vraiUrl.fileURLToPath(p) : p);
  if (p.startsWith("file:")) p = vraiUrl.fileURLToPath(p);
  const m = /^\/([a-zA-Z])(?:\/(.*))?$/.exec(p);
  if (m) p = m[1] + ":\\" + (m[2] || "");
  if (p.startsWith("~")) p = "C:\\Users\\aniss" + p.slice(1);
  p = p.replace(/\//g, "\\");
  if (!/^[A-Za-z]:\\/.test(p)) p = chemin.join(ETAT.cwd, p);
  return chemin.normalize(p).replace(/\\$/, (s, i, t) => (t.length <= 3 ? s : ""));
}

function cle(p) {
  const origine = absolu(p);
  const a = origine.toLowerCase();
  let c = "h:" + a;
  for (const r of RACINES) {
    if (a === r || a.startsWith(r + "\\")) {
      c = "p:" + a.slice(r.length + 1);
      break;
    }
  }
  ETAT.noms[c] = origine; // le chemin tel que le script le nomme (casse gardée)
  return c;
}

function introuvable(c) {
  const e = new Error("ENOENT: no such file or directory (bac à sable), '" + c + "'");
  e.code = "ENOENT";
  return e;
}

function contenu(c) {
  let v;
  if (Object.prototype.hasOwnProperty.call(ETAT.ecrits, c)) v = ETAT.ecrits[c];
  else if (Object.prototype.hasOwnProperty.call(FICHIERS, c)) v = FICHIERS[c];
  else {
    ETAT.manque = c;
    throw { [MANQUE]: c };
  }
  if (v === null || v === undefined) {
    if (BINAIRE.test(c)) aveugle(c); // « absent » : on n'en sait rien
    throw introuvable(c);
  }
  return v;
}

function existe(c) {
  try {
    contenu(c);
    return true;
  } catch (e) {
    if (e && e[MANQUE]) throw e;
    return false;
  }
}

function enfants(dossier) {
  const c = cle(dossier);
  const out = new Map();
  if (c.startsWith("p:")) {
    const base = c.slice(2);
    for (const rel of CONNUS) {
      const bas = rel.toLowerCase();
      if (base && !bas.startsWith(base + "\\")) continue;
      const reste = base ? rel.slice(base.length + 1) : rel;
      const i = reste.indexOf("\\");
      const nom = i < 0 ? reste : reste.slice(0, i);
      if (nom) out.set(nom, i >= 0 || out.get(nom) === true);
    }
  }
  for (const source of [ETAT.ecrits, FICHIERS]) {
    for (const [k, v] of Object.entries(source)) {
      if (v === null || !k.startsWith(c + "\\")) continue;
      const reste = k.slice(c.length + 1);
      const i = reste.indexOf("\\");
      const nom = i < 0 ? reste : reste.slice(0, i);
      if (nom && ![...out.keys()].some((x) => x.toLowerCase() === nom.toLowerCase())) out.set(nom, i >= 0);
    }
  }
  return out;
}

const estDossier = (p) => enfants(absolu(p)).size > 0;

// `existsSync` d'un chemin SANS extension dont on ne connaît aucun fichier : un dossier
// d'assets aussi bien qu'un dossier absent. « Non » est une réponse à l'aveugle.
function dossierExiste(p) {
  if (estDossier(p)) return true;
  if (!chemin.extname(absolu(p))) aveugle(cle(p) + "\\");
  return false;
}

function stat(p) {
  if (dossierExiste(p)) {
    return { isFile: () => false, isDirectory: () => true, size: 0, mtimeMs: 0, mtime: new Date(0) };
  }
  const t = contenu(cle(p));
  return { isFile: () => true, isDirectory: () => false, size: Buffer.byteLength(t, "utf8"), mtimeMs: 0, mtime: new Date(0) };
}

function lire(p, options) {
  const c = cle(p);
  const t = contenu(c);
  ETAT.lus.push(c);
  if (partiel(t) && ETAT.troues.indexOf(c) < 0) ETAT.troues.push(c); // une entrée dont on ne tient pas tout
  const enc = typeof options === "string" ? options : options && options.encoding;
  return enc ? t : Buffer.from(t, "utf8");
}

function ecrire(p, data, prolonge) {
  const c = cle(p);
  noterEcriture(c, prolonge);
  ETAT.ecrits[c] = Buffer.isBuffer(data) || data instanceof Uint8Array ? Buffer.from(data).toString("utf8") : String(data);
}

const fauxFs = {
  readFileSync: lire,
  writeFileSync: ecrire,
  appendFileSync(p, data) {
    let avant = "";
    try {
      avant = contenu(cle(p));
    } catch (e) {
      if (e && e[MANQUE]) throw e;
    }
    ecrire(p, avant + (Buffer.isBuffer(data) ? data.toString("utf8") : String(data)), avant !== "");
  },
  existsSync(p) {
    return dossierExiste(p) || existe(cle(p));
  },
  readdirSync(p, options) {
    const e = enfants(absolu(p));
    if (!e.size) {
      aveugle(cle(p) + "\\"); // dossier dont on ne connaît rien
      throw introuvable(cle(p));
    }
    const noms = [...e.keys()].sort();
    if (options && options.withFileTypes) {
      return noms.map((n) => ({ name: n, isFile: () => !e.get(n), isDirectory: () => !!e.get(n) }));
    }
    return noms;
  },
  statSync: stat,
  lstatSync: stat,
  mkdirSync() {},
  rmSync() {},
  rmdirSync() {},
  utimesSync() {},
  chmodSync() {},
  unlinkSync(p) {
    contenu(cle(p));
    ETAT.ecrits[cle(p)] = null;
  },
  renameSync(a, b) {
    ETAT.ecrits[cle(b)] = contenu(cle(a));
    ETAT.ecrits[cle(a)] = null;
  },
  copyFileSync(a, b) {
    ETAT.ecrits[cle(b)] = contenu(cle(a));
  },
  openSync(p) {
    aveugle(cle(p));
    throw new Error("openSync : lecture binaire hors du bac à sable");
  },
  constants: {},
};
fauxFs.promises = {
  readFile: async (p, o) => lire(p, o),
  writeFile: async (p, d) => ecrire(p, d),
  mkdir: async () => {},
  readdir: async (p, o) => fauxFs.readdirSync(p, o),
  stat: async (p) => stat(p),
  access: async (p) => {
    if (!fauxFs.existsSync(p)) throw introuvable(cle(p));
  },
};
fauxFs.readFile = (p, o, cb) => (typeof o === "function" ? o(null, lire(p)) : cb(null, lire(p, o)));
fauxFs.writeFile = (p, d, o, cb) => {
  ecrire(p, d);
  (typeof o === "function" ? o : cb || (() => {}))(null);
};

const acheve = { status: 0, signal: null, stdout: "", stderr: "", output: [null, "", ""], pid: 0 };
const fauxProcessus = {
  execSync: () => "",
  execFileSync: () => "",
  spawnSync: () => acheve,
  spawn: () => ({ on() {}, stdout: { on() {} }, stderr: { on() {} }, kill() {} }),
  exec: (c, o, cb) => (typeof o === "function" ? o : cb || (() => {}))(null, "", ""),
  execFile: (f, a, o, cb) => [a, o, cb].find((x) => typeof x === "function")?.(null, "", ""),
};

class Sortie extends Error {
  constructor(code) {
    super("process.exit(" + code + ")");
    this.codeSortie = code;
  }
}

// ── L'environnement ──────────────────────────────────────────────────────────
// Ce qui ne change pas d'un jour à l'autre sur cette machine est donné ; le reste est
// INCONNU, et le dire vide serait répondre à l'aveugle. Mesuré le 03/10/2026 :
// `fs.writeFileSync(process.env.TEMP + "/anims_cuites.json", …)` écrivait, avec un
// environnement vide, dans `undefined/anims_cuites.json` — un fichier fantôme DANS le projet.
const MAISON = "C:\\Users\\aniss";
const ENV_CONNU = {
  TEMP: MAISON + "\\AppData\\Local\\Temp", TMP: MAISON + "\\AppData\\Local\\Temp", TMPDIR: MAISON + "\\AppData\\Local\\Temp",
  USERPROFILE: MAISON, HOME: MAISON, HOMEDRIVE: "C:", HOMEPATH: "\\Users\\aniss", USERNAME: "aniss",
  APPDATA: MAISON + "\\AppData\\Roaming", LOCALAPPDATA: MAISON + "\\AppData\\Local", OS: "Windows_NT",
  SystemRoot: "C:\\WINDOWS", windir: "C:\\WINDOWS", SystemDrive: "C:", ProgramFiles: "C:\\Program Files",
  ...(TRAVAIL.env || {}),
};
// Des réglages qu'un script consulte sans que son résultat en dépende : absents, sans plus.
const ENV_SANS_EFFET = /^(NODE_|npm_|FORCE_COLOR$|NO_COLOR$|TERM$|CI$|DEBUG$|COLUMNS$|LINES$|PATH$|LANG$|LC_|TZ$)/;
const fauxEnv = new Proxy(ENV_CONNU, {
  get(cible, nom) {
    if (typeof nom !== "string" || Object.prototype.hasOwnProperty.call(cible, nom)) return cible[nom];
    if (!ENV_SANS_EFFET.test(nom) && !(nom in Object.prototype)) aveugle("env:" + nom);
    return undefined;
  },
});

// `node x.js a` : argv = [node, x.js, a] ; `node - a` : [node, -, a] ; `node -e CODE a` : [node, a].
const fauxProcess = {
  argv: ["node", ...(TRAVAIL.script ? [absolu(TRAVAIL.script)] : TRAVAIL.mode === "arg" ? [] : ["-"]), ...(TRAVAIL.args || [])],
  env: fauxEnv,
  platform: "win32",
  version: process.version,
  versions: process.versions,
  cwd: () => ETAT.cwd,
  chdir(p) {
    ETAT.cwd = absolu(p);
  },
  exit(code) {
    throw new Sortie(code || 0);
  },
  exitCode: 0,
  stdout: { write: () => true, isTTY: false },
  stderr: { write: () => true, isTTY: false },
  hrtime: process.hrtime,
  memoryUsage: process.memoryUsage,
  on() {},
  nextTick: process.nextTick,
};
const fauxConsole = { log() {}, error() {}, warn() {}, info() {}, debug() {}, table() {}, dir() {}, time() {}, timeEnd() {} };

// ── Modules ──────────────────────────────────────────────────────────────────
const VRAIS = new Set(["path", "url", "util", "os", "assert", "crypto", "zlib", "string_decoder", "events", "buffer"]);
const charges = new Map();

function versRequire(code) {
  // `import … from "m"` -> `const … = __req("m")` ; `export …` -> affectations à `exports`.
  const exportes = [];
  code = code.replace(/^[ \t]*import\s+([\s\S]*?)\s+from\s+(["'][^"']+["'])\s*;?/gm, (tout, quoi, mod) => {
    quoi = quoi.trim();
    const lignes = [];
    const accolades = /\{([\s\S]*)\}/.exec(quoi);
    const reste = quoi.replace(/,?\s*\{[\s\S]*\}/, "").trim().replace(/,$/, "");
    const etoile = /^\*\s+as\s+([\w$]+)$/.exec(reste);
    if (etoile) lignes.push(`const ${etoile[1]} = __req(${mod});`);
    else if (reste) lignes.push(`const ${reste} = __defaut(__req(${mod}));`);
    if (accolades) lignes.push(`const {${accolades[1].replace(/\s+as\s+/g, ": ")}} = __req(${mod});`);
    return lignes.join(" ");
  });
  code = code.replace(/^[ \t]*import\s+(["'][^"']+["'])\s*;?/gm, (tout, mod) => `__req(${mod});`);
  code = code.replace(/^([ \t]*)export\s+default\s+/gm, "$1module.exports.default = ");
  code = code.replace(/^([ \t]*)export\s+((?:async\s+)?function\*?|class|const|let|var)\s+([\w$]+)/gm, (tout, blanc, genre, nom) => {
    exportes.push(nom);
    return `${blanc}${genre} ${nom}`;
  });
  code = code.replace(/^[ \t]*export\s*\{([^}]*)\}\s*;?/gm, (tout, noms) => {
    return noms.split(",").map((n) => n.trim()).filter(Boolean).map((n) => {
      const [a, b] = n.split(/\s+as\s+/);
      return `module.exports.${(b || a).trim()} = ${a.trim()};`;
    }).join(" ");
  });
  code = code.replace(/\bimport\.meta\.url\b/g, "__meta_url").replace(/\bimport\.meta\.dirname\b/g, "__dirname")
    .replace(/\bimport\.meta\.filename\b/g, "__filename");
  if (exportes.length) code += "\n" + exportes.map((n) => `module.exports.${n} = ${n};`).join("\n");
  return code;
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function fabriquerRequire(dossier) {
  return function requis(nom) {
    nom = String(nom).replace(/^node:/, "");
    if (nom === "fs") return fauxFs;
    if (nom === "fs/promises") return fauxFs.promises;
    if (nom === "child_process") return fauxProcessus;
    if (nom === "process") return fauxProcess;
    if (nom === "module") return { createRequire: (base) => fabriquerRequire(chemin.dirname(absolu(base))) };
    if (VRAIS.has(nom)) return require(nom);
    if (!/^(\.|[A-Za-z]:|\/)/.test(nom)) throw new Error("module absent du bac à sable : " + nom);
    let cible = /^\./.test(nom) ? chemin.join(dossier, nom) : absolu(nom);
    if (!chemin.extname(cible)) cible += [".js", ".mjs", ".cjs", ".json"].find((x) => existe(cle(cible + x))) || ".js";
    const c = cle(cible);
    if (charges.has(c)) return charges.get(c).exports;
    const source = contenu(c);
    const module = { exports: {} };
    charges.set(c, module);
    if (c.endsWith(".json")) {
      module.exports = JSON.parse(source);
      return module.exports;
    }
    // Un module local est chargé de façon SYNCHRONE : un `await` de premier niveau n'y a pas sa place.
    const f = new Function("require", "module", "exports", "__filename", "__dirname", "process", "console", "__req",
      "__defaut", "__meta_url", "fetch", "{\n" + versRequire(source) + "\n}");
    const r = fabriquerRequire(chemin.dirname(cible));
    f(r, module, module.exports, cible, chemin.dirname(cible), fauxProcess, fauxConsole, r, defaut,
      vraiUrl.pathToFileURL(cible).href, undefined);
    return module.exports;
  };
}

function defaut(m) {
  return m && typeof m === "object" && "default" in m ? m.default : m;
}

async function main() {
  ETAT.cwd = absolu(TRAVAIL.cwd || "C:\\");
  const script = TRAVAIL.script ? absolu(TRAVAIL.script) : chemin.join(ETAT.cwd, "[stdin]");
  const dossier = TRAVAIL.script ? chemin.dirname(script) : ETAT.cwd;
  const requis = fabriquerRequire(dossier);
  const module = { exports: {} };
  let ok = true;
  let erreur = "";
  try {
    // Le code est mis dans un BLOC : un script qui déclare lui-même `const require = …` ou
    // `const __dirname = …` (courant en ESM) masque alors nos paramètres au lieu de buter
    // sur « Identifier has already been declared ».
    const f = new AsyncFunction("require", "module", "exports", "__filename", "__dirname", "process", "console", "__req",
      "__defaut", "__meta_url", "fetch", "{\n" + versRequire(TRAVAIL.code.replace(/^#!.*\n/, "\n")) + "\n}");
    await f(requis, module, module.exports, script, dossier, fauxProcess, fauxConsole, requis, defaut,
      vraiUrl.pathToFileURL(script).href, undefined);
  } catch (e) {
    if (e instanceof Sortie) {
      if (e.codeSortie) {
        ok = false;
        erreur = "sortie " + e.codeSortie;
      }
    } else if (e && e[MANQUE]) {
      ok = false;
      erreur = "manque";
    } else {
      ok = false;
      erreur = String((e && (e.name + ": " + e.message)) || e).slice(0, 400);
    }
  }
  if (ETAT.manque && erreur !== "manque" && !Object.prototype.hasOwnProperty.call(FICHIERS, ETAT.manque)) {
    ok = false;
    erreur = "manque";          // un `try/catch` du script l'avait avalé
  }
  const noms = {};
  for (const c of Object.keys(ETAT.ecrits)) noms[c] = ETAT.noms[c] || null;
  const resultat = {
    ok, erreur, manque: erreur === "manque" ? ETAT.manque : null, ecrits: ETAT.ecrits, lus: ETAT.lus, noms,
    incertains, attente: ATTENTE, aveugles: ETAT.aveugles, generes: ETAT.generes, troues: ETAT.troues,
  };
  require("fs").writeSync(1, JSON.stringify(resultat));
}

main();
