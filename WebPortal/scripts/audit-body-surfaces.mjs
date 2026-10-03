// ══════════════════════════════════════════════════════════════════════════════
// scripts/audit-body-surfaces.mjs — Le mannequin morphable est-il correct ?
//
//   node scripts/audit-body-surfaces.mjs
//
// POURQUOI CET AUDIT EXISTE
//
// `base_skinned.glb` sort d'une chaîne en trois scripts. Chacun peut produire un
// fichier PARFAITEMENT VALIDE et pourtant faux au rendu :
//
//   • une surface perdue en route (le riggeur ne traitait qu'une primitive
//     avant l'ajout des yeux) — le GLB s'ouvre, il manque juste les yeux ;
//   • des globes plantés à l'origine, entre les pieds, faute de poids ;
//   • un facteur d'échelle oublié — des yeux de la taille de la tête ;
//   • des plages canoniques qui se CHEVAUCHENT, ce qui ferait s'écraser les
//     surfaces entre elles au premier morph.
//
// Aucun de ces cas ne lève d'erreur. Ils se voient à l'œil, une fois le jeu
// lancé, l'écran de création atteint et un curseur bougé. D'où des seuils
// numériques ici, vérifiables en deux secondes après chaque régénération.
//
// Les bornes viennent de l'anatomie, pas d'un relevé sur le fichier courant :
// les yeux d'un humain sont à ~93 % de sa taille et espacés de ~6,5 cm. Un
// audit calé sur sa propre sortie ne vérifierait rien.
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";

const CIBLE = "public/models/personnages/_body/base_skinned.glb";

/** Surfaces attendues, et ce qu'on exige de chacune. */
const ATTENDU = ["skin", "Eyes"];

/** Hauteur des yeux, en fraction de la taille. Humain : ~93 %. */
const HAUTEUR_YEUX = [0.90, 0.97];

/** Écart entre les bords externes des deux globes, en mètres. */
const ECART_YEUX = [0.04, 0.10];

/** Taille du corps, en mètres. Un adulte MakeHuman neutre. */
const TAILLE = [1.5, 2.0];

function boite(arr) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < arr.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (arr[i + k] < min[k]) min[k] = arr[i + k];
      if (arr[i + k] > max[k]) max[k] = arr[i + k];
    }
  }
  return { min, max };
}

const problemes = [];
const verifie = (ok, message) => { if (!ok) problemes.push(message); };

async function main() {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });

  const doc = await io.read(CIBLE);
  const prims = doc.getRoot().listMeshes()[0].listPrimitives();

  const par = {};
  for (const p of prims) {
    const nom = p.getMaterial()?.getName() ?? "?";
    const pos = p.getAttribute("POSITION").getArray();
    par[nom] = {
      boite: boite(pos),
      n: pos.length / 3,
      morph: p.getAttribute("_MORPH_INDEX")?.getArray() ?? null,
      skinne: !!p.getAttribute("JOINTS_0"),
    };
  }

  console.info(`[audit] ${CIBLE}`);
  for (const [nom, s] of Object.entries(par)) {
    const b = s.boite;
    console.info(
      `[audit] ${nom.padEnd(6)} ${String(s.n).padStart(6)} sommets · ` +
      `X[${b.min[0].toFixed(3)} ${b.max[0].toFixed(3)}] ` +
      `Y[${b.min[1].toFixed(3)} ${b.max[1].toFixed(3)}] ` +
      `Z[${b.min[2].toFixed(3)} ${b.max[2].toFixed(3)}]` +
      `${s.skinne ? "" : "  ⚠ NON SKINNÉE"}`,
    );
  }

  // ── Présence ───────────────────────────────────────────────────────────────
  for (const nom of ATTENDU) {
    verifie(par[nom], `surface « ${nom} » absente — le riggeur en a-t-il perdu une ?`);
  }
  if (problemes.length) return rapport();

  for (const [nom, s] of Object.entries(par)) {
    verifie(s.skinne, `« ${nom} » n'a pas de JOINTS_0 : elle ne suivra pas le squelette`);
    verifie(s.morph, `« ${nom} » n'a pas de _MORPH_INDEX : elle ne sera pas morphée`);
  }

  // ── Échelle et placement ───────────────────────────────────────────────────
  const peau = par.skin.boite, yeux = par.Eyes.boite;
  const taille = peau.max[1] - peau.min[1];
  // ⚠ MESURÉ DEPUIS LES PIEDS, pas depuis l'origine. Le corps MakeHuman est
  // CENTRÉ sur l'origine (Y de -0,82 à +0,85), pas posé dessus : diviser la
  // hauteur brute des yeux par la taille donne 44 % et fait crier l'audit sur
  // un corps parfaitement correct.
  const frac = ((yeux.min[1] + yeux.max[1]) / 2 - peau.min[1]) / taille;
  const ecart = yeux.max[0] - yeux.min[0];

  console.info(
    `[audit] taille ${taille.toFixed(3)} m · yeux à ${(frac * 100).toFixed(1)} % ` +
    `de la taille · écart ${(ecart * 100).toFixed(1)} cm`,
  );

  verifie(taille >= TAILLE[0] && taille <= TAILLE[1],
    `taille ${taille.toFixed(2)} m hors de [${TAILLE}] — facteur d'unité perdu ?`);
  verifie(frac >= HAUTEUR_YEUX[0] && frac <= HAUTEUR_YEUX[1],
    `yeux à ${(frac * 100).toFixed(1)} % de la taille, attendu ${HAUTEUR_YEUX.map((v) => v * 100).join("–")} %` +
    ` — globes hors des orbites`);
  verifie(ecart >= ECART_YEUX[0] && ecart <= ECART_YEUX[1],
    `écart des yeux ${(ecart * 100).toFixed(1)} cm hors de ` +
    `[${ECART_YEUX.map((v) => v * 100).join(", ")}] cm — mauvaise échelle`);

  // ── Espaces canoniques disjoints ───────────────────────────────────────────
  // C'est ce qui autorise `MorphedBody` à n'allouer QU'UN `canonBase` et à ne
  // faire QU'UNE passe de morphs. Un chevauchement ferait s'écraser les
  // surfaces l'une l'autre, silencieusement.
  const sPeau = new Set(par.skin.morph);
  const commun = [...new Set(par.Eyes.morph)].filter((i) => sPeau.has(i));
  console.info(`[audit] indices canoniques partagés entre surfaces : ${commun.length}`);
  verifie(commun.length === 0,
    `${commun.length} indice(s) canonique(s) partagé(s) entre peau et yeux — ` +
    `les surfaces s'écraseraient au morph`);

  rapport();
}

function rapport() {
  if (problemes.length === 0) {
    console.info("[audit] ✓ toutes les surfaces sont conformes");
    process.exit(0);
  }
  for (const p of problemes) console.error(`[audit] ✗ ${p}`);
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
