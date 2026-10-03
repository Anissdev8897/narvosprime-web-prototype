// ══════════════════════════════════════════════════════════════════════════════
// narvos-api-vers-markdown.mjs — l'API nanos en un seul Markdown transmissible.
//
//   node scripts/narvos-api-vers-markdown.mjs [sortie.md]
//
// ── POURQUOI ──────────────────────────────────────────────────────────────────
// L'API nanos vit dans `libraries/api-main/api-main/` sous forme de 66 fichiers
// JSON. C'est la SEULE source de vérité : la documentation `.mdx` du site ne la
// contient pas, elle l'injecte à la compilation.
//
// Un agent externe qui ne lit pas le dépôt ne peut donc rien vérifier — et sur
// ce projet, trois signatures inventées ont coûté trois corrections. Ce script
// aplatit l'API en un fichier qu'on peut transmettre tel quel.
//
// ⚠ IL NE RÉSUME PAS, IL APLATIT. Chaque fonction garde son nom exact, ses
// paramètres avec leur type, et son AUTORITÉ. L'autorité est ce qui décide si un
// appel a le droit d'exister là où on l'écrit : une méthode `[server]` appelée
// depuis le client échoue en silence.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/libraries/api-main/api-main";
const SORTIE = process.argv[2] || "E:/narvosprime-web-prototype/.hermes/API_NANOS_COMPLETE.md";

const GROUPES = [
  ["StaticClasses", "Classes statiques", "Appelées directement : `Client.GetLocalPlayer()`, `Events.Call(...)`. Pas d'instance à créer."],
  ["Classes", "Classes instanciables", "Créées par appel : `Character(location, rotation, mesh)`. Héritent souvent d'une `Base*`."],
  ["UtilityClasses", "Classes utilitaires", "Vector, Rotator, Color… manipulées en valeur."],
  ["Structs", "Structures", "Tables de données passées aux fonctions."],
];

const lire = (p) => {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
};

const propre = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, "")          // les descriptions contiennent du HTML
    .replace(/\s+/g, " ")
    .trim();

/** `float x, string? nom, Vector location` */
function signature(fn) {
  const ps = fn.parameters || fn.arguments || [];
  return ps
    .map((a) => {
      const def = a.default !== undefined && a.default !== null ? ` = ${a.default}` : "";
      return `${a.type || "?"} ${a.name || "?"}${def}`;
    })
    .join(", ");
}

function retour(fn) {
  const r = fn.return || fn.returns;
  if (!r || !r.length) return "";
  return r.map((x) => x.type || "?").join(" | ");
}

const out = [];
const dire = (l = "") => out.push(l);

dire("# API nanos world — référence complète");
dire();
dire(`Aplatie depuis \`libraries/api-main/api-main/\` le ${new Date().toISOString().slice(0, 10)}.`);
dire();
dire("**C'est la seule source de vérité de l'API.** La documentation `.mdx` du site");
dire("ne la contient pas — elle l'injecte à la compilation. Toute signature écrite");
dire("sans avoir été lue ici est une supposition.");
dire();
dire("## Lire l'autorité avant d'écrire un appel");
dire();
dire("Chaque fonction porte une autorité, et c'est elle qui décide si l'appel a le");
dire("droit d'exister là où on l'écrit :");
dire();
dire("| autorité | appelable depuis |");
dire("|---|---|");
dire("| `server` | le serveur seulement |");
dire("| `client` | le client seulement |");
dire("| `both` | les deux |");
dire("| `authority` | le côté qui a spawné l'entité |");
dire("| `network authority` | le serveur, ou le client s'il détient l'autorité réseau |");
dire();
dire("⚠ **Une méthode `server` appelée depuis le client échoue EN SILENCE.** Pas");
dire("d'erreur, pas de log. C'est le défaut le plus discret de cette API.");
dire();

// ── Sommaire ─────────────────────────────────────────────────────────────────
const inventaire = [];
for (const [dossier] of GROUPES) {
  const dir = path.join(BASE, dossier);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const d = lire(path.join(dir, f));
    if (d && d.name) inventaire.push([dossier, d]);
  }
}

dire("## Sommaire");
dire();
for (const [dossier, titre] of GROUPES) {
  const noms = inventaire.filter(([g]) => g === dossier).map(([, d]) => d.name);
  if (!noms.length) continue;
  dire(`**${titre}** (${noms.length}) — ${noms.join(" · ")}`);
  dire();
}

// ── Corps ────────────────────────────────────────────────────────────────────
let nbFn = 0;
for (const [dossier, titre, note] of GROUPES) {
  const lot = inventaire.filter(([g]) => g === dossier);
  if (!lot.length) continue;

  dire("---");
  dire();
  dire(`# ${titre}`);
  dire();
  dire(note);
  dire();

  for (const [, d] of lot) {
    dire(`## ${d.name}`);
    dire();
    const desc = propre(d.description);
    if (desc) { dire(desc); dire(); }
    if (d.inheritance && d.inheritance.length) {
      dire(`Hérite de : \`${d.inheritance.join("` → `")}\``);
      dire();
    }
    if (d.authority) { dire(`Autorité de la classe : \`${d.authority}\``); dire(); }

    // Le constructeur, quand il existe : c'est ce qu'on écrit en premier.
    if (d.constructors && d.constructors.length) {
      dire("**Construction**");
      dire();
      for (const c of d.constructors) {
        dire(`- \`${d.name}(${signature(c)})\``);
        const cd = propre(c.description);
        if (cd) dire(`  - ${cd}`);
      }
      dire();
    }

    const sections = [
      ["static_functions", "Fonctions statiques"],
      ["functions", "Méthodes"],
      ["events", "Événements"],
      ["static_events", "Événements statiques"],
      ["properties", "Propriétés"],
    ];

    for (const [cle, libelle] of sections) {
      const liste = d[cle];
      if (!liste || !liste.length) continue;
      dire(`**${libelle}**`);
      dire();
      for (const fn of liste) {
        nbFn++;
        const aut = fn.authority ? ` — \`${fn.authority}\`` : "";
        const ret = retour(fn);
        const fleche = ret ? ` → \`${ret}\`` : "";
        dire(`- \`${fn.name}(${signature(fn)})\`${fleche}${aut}`);
        const fd = propre(fn.description);
        if (fd) dire(`  - ${fd}`);
        // La valeur de retour porte parfois la clause qui compte — « Return
        // false to block it » sur les événements clavier, par exemple.
        const r = fn.return || fn.returns;
        if (r && r.length) {
          for (const x of r) {
            const xd = propre(x.description);
            if (xd) dire(`  - retour : ${xd}`);
          }
        }
      }
      dire();
    }
  }
}

dire("---");
dire();
dire(`${inventaire.length} classes, ${nbFn} fonctions et événements.`);

fs.writeFileSync(SORTIE, out.join("\n"), "utf8");
console.log(`${inventaire.length} classes, ${nbFn} fonctions`);
console.log(`ecrit : ${SORTIE}  (${(fs.statSync(SORTIE).size / 1024).toFixed(0)} ko)`);