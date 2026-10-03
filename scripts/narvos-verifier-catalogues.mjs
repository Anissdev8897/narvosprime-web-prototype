// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 269 ligne(s) attendue(s) ici, 259 connue(s)]
// ══════════════════════════════════════════════════════════════════════════════
// narvos-verifier-catalogues.mjs — chaque asset référencé existe-t-il VRAIMENT ?
//
//   node scripts/narvos-verifier-catalogues.mjs
//
// Sort en code 1 si une seule référence est morte. À lancer après tout cook,
// tout réimport, et toute mise à jour Steam du client.
//
// ── LE DÉFAUT QUE CE SCRIPT EXISTE POUR ATTRAPER ──────────────────────────────
// nanos ne lève PAS sur un asset manquant. Selon la classe :
//   · `Character`  affiche la CAPSULE DE COLLISION — un cylindre blanc ;
//   · `Particle`   ne joue rien du tout ;
//   · `Prop`       ne pose rien ;
//   · `StaticMesh` ne pose rien.
// Dans les quatre cas la partie continue, aucune erreur n'est écrite, et le
// joueur conclut que la touche n'a pas répondu.
//
// Ce projet a payé ce défaut trois fois : 67 animations mortes au catalogue,
// 76 pièces trooper jamais importées, 55 PNJ sans mesh. À chaque fois la cause
// était la même — un catalogue construit depuis une liste de SOUHAITS plutôt que
// depuis un inventaire de ce qui EST.
//
// ── DEUX INVENTAIRES, PAS UN ──────────────────────────────────────────────────
//   · `narvos::…`      -> Server/Assets/narvos/Assets.toml (notre pack cuit)
//   · `nanos-world::…` -> le contenu installé par Steam (le pack de base)
// Les confondre laisserait passer la moitié des références.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = "E:/narvosprime-web-prototype";
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;
const CATALOGS = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs`;
const BASE = process.env.NANOS_CONTENT
  || "D:/steam/steamapps/common/nanos-world-playtest/NanosWorld/Content/NanosWorldAssets";

let echecs = 0;
const manquant = (quoi) => { console.log(`    MANQUE  ${quoi}`); echecs++; };
// ⚠ UN ETAT DE CATALOGUE PERIME N'EST PAS UNE REFERENCE MORTE. Le 2026-09-13, le
// constructeur a enfin declare les WidgetBlueprint : 28 fiches de Widgets.lua
// disaient encore « cuit_non_declare », et le bilan annoncait « 28 reference(s)
// morte(s) — le jeu les ignorera EN SILENCE » alors que les 28 assets etaient
// la, declares, chargeables. Le compte etait juste, l'etiquette fausse — le
// defaut exact de feedback_compteur_juste_etiquette_fausse. Les deux echouent,
// mais chacun sous SON nom.
let perimes = 0;
const perime = (quoi) => { console.log(`    ETAT    ${quoi}`); perimes++; };

// ── Inventaire de notre pack ──────────────────────────────────────────────────

const nosAssets = new Set();
if (fs.existsSync(TOML)) {
  for (const ligne of fs.readFileSync(TOML, "utf8").split("\n")) {
    const m = ligne.match(/^\s*([^\s=[]+)\s*=\s*"/);
    if (m) nosAssets.add(m[1]);
  }
} else {
  console.log(`  Assets.toml ABSENT : ${TOML}`);
  echecs++;
}

// ── Inventaire du pack de base ────────────────────────────────────────────────

const assetsBase = new Set();
if (fs.existsSync(BASE)) {
  const parcourir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { parcourir(p); continue; }
      if (e.name.endsWith(".uasset")) assetsBase.add(e.name.slice(0, -7));
    }
  };
  parcourir(BASE);
} else {
  console.log(`  Contenu nanos ABSENT : ${BASE}`);
  console.log("  (definir NANOS_CONTENT si l'install Steam est ailleurs)");
  echecs++;
}

// ── Les CLÉS du pack de base : le manifeste, pas les noms de fichier ─────────
//
// ⚠ 2026-09-14 : ce vérificateur jugeait `nanos-world::X` sur les NOMS DE FICHIER
// installés. Or 95 particules sur 173 ont une clé différente de leur fichier
// (`P_FXVariety_FireBall` -> `P_ky_fireBall.uasset`) : Vfx.lua citait les noms
// de fichier, ce contrôle les disait « ok », et `Particle()` ne chargeait rien.
// Règle : une clé du manifeste est valide ; un nom de fichier que le manifeste
// connaît SOUS UNE AUTRE CLÉ est FAUX ; un fichier inconnu du manifeste (copie
// datée du 13/08, 42 meshes installés depuis) garde la convention nom = clé.
const MANIFESTE_BASE = process.env.NANOS_MANIFESTE
  || `${RACINE}/WebPortal/Server/nanos_world/game-mod/nanos-world-server-main/nanos-world-server-main/DefaultAssetPack.toml`;
const clesBase = new Set();
const cleDuFichierBase = new Map();
if (fs.existsSync(MANIFESTE_BASE)) {
  for (const ligne of fs.readFileSync(MANIFESTE_BASE, "utf8").split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(?:"([^"]+)"|\{\s*path\s*=\s*"([^"]+)")/);
    if (!m) continue;
    clesBase.add(m[1]);
    const fichier = (m[2] || m[3]).split("/").pop();
    if (!cleDuFichierBase.has(fichier)) cleDuFichierBase.set(fichier, m[1]);
  }
} else {
  console.log(`  Manifeste du pack de base ABSENT : ${MANIFESTE_BASE}`);
  echecs++;
}

/** Une référence `nanos-world::X` est-elle chargeable ? Rend null si oui, la raison sinon. */
function refusBase(cle) {
  if (clesBase.has(cle)) return null;
  const vraie = cleDuFichierBase.get(cle);
  if (vraie && vraie !== cle) return `nom de FICHIER, la cle est ${vraie}`;
  if (assetsBase.has(cle)) return null;
  return "absent du pack de base";
}

// ── Type de chaque asset du pack ──────────────────────────────────────────────
//
// ⚠ L'EXISTENCE D'UN NOM NE SUFFIT PAS. Le 2026-09-04, ce vérificateur annonçait
// « Emotes 166 references ok » alors qu'AUCUNE ne jouait : elles pointaient
// toutes le SkeletalMesh produit par Interchange au lieu de l'AnimSequence
// suffixée `_Anim`. nanos répondait, en jeu et en jeu seulement :
//
//     Asset 'ANIM_IP_customer_idle' of type 'Animation' not found
//
// Un catalogue peut donc être entièrement « vert » et entièrement inerte. On
// relève désormais la SECTION de chaque asset, et chaque contrôle déclare le
// type qu'il attend.

// [SÛRE dans une version intermédiaire, non replacée] const PACK_CUIT = `${RACINE}/WebPortal/Server/Assets/narvos`;
// [SÛRE dans une version intermédiaire, non replacée]   const pile = [PACK_CUIT];
// [SÛRE dans une version intermédiaire, non replacée]   while (pile.length) {
// [SÛRE dans une version intermédiaire, non replacée]     const d = pile.pop();
// [SÛRE dans une version intermédiaire, non replacée]     let entrees;
// [SÛRE dans une version intermédiaire, non replacée]     try { entrees = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
// [SÛRE dans une version intermédiaire, non replacée]     for (const e of entrees) {
// [SÛRE dans une version intermédiaire, non replacée]       const q = d + "/" + e.name;
// [SÛRE dans une version intermédiaire, non replacée]       if (e.isDirectory()) pile.push(q);
// [SÛRE dans une version intermédiaire, non replacée]       else if (e.name.endsWith(".uasset")) {
// [SÛRE dans une version intermédiaire, non replacée]         const base = e.name.slice(0, -".uasset".length);
// [SÛRE dans une version intermédiaire, non replacée]         if (!_indexPack.has(base)) {
// [SÛRE dans une version intermédiaire, non replacée]           _indexPack.set(base, "/Game/" + q.slice(PACK_CUIT.length + 1, -".uasset".length));
// [SÛRE dans une version intermédiaire, non replacée]         }
// [SÛRE dans une version intermédiaire, non replacée]       }
// [SÛRE dans une version intermédiaire, non replacée]     }
// [SÛRE dans une version intermédiaire, non replacée]   }
// [SÛRE dans une version intermédiaire, non replacée]   return _indexPack;
// [SÛRE dans une version intermédiaire, non replacée] }
const nosTypes = new Map();
const nosChemins = new Map();
if (fs.existsSync(TOML)) {
  let section = null;
  for (const ligne of fs.readFileSync(TOML, "utf8").split("\n")) {
    const s = ligne.match(/^\s*\[assets\.([a-z_]+)\]/);
    if (s) { section = s[1]; continue; }
    const m = ligne.match(/^\s*([^\s=[]+)\s*=\s*"([^"]*)"/);
    if (m && section) {
      nosTypes.set(m[1], section);
      // Le chemin DANS le pack, pour aller lire le paquet cuit lui-meme.
      // Un Blueprint peut etre declare, present, du bon type — et refuse par
      // le client parce que SES imports manquent. Voir le controle
      // « Modular jouables ».
      nosChemins.set(m[1], m[2]);
    }
  }
}

/** Signale une référence dont le TYPE ne correspond pas à l'usage.
 *
 *  Ce n'est pas une référence morte — l'asset existe — mais le résultat est le
 *  même en jeu : l'appel échoue, en silence côté Lua. */
function mauvaisType(nom, attendu, trouve) {
  console.log(`    TYPE    narvos::${nom} est ${trouve}, attendu ${attendu}`);
  echecs++;
}

/** Vérifie que toutes les références sont du type attendu. */
function controlerType(refs, attendu) {
  for (const r of refs) {
    const t = nosTypes.get(r);
    // Un asset absent est deja signale comme reference morte : ne pas le
    // compter deux fois.
    if (t !== undefined && t !== attendu) mauvaisType(r, attendu, t);
  }
}

// ── Contrôles ─────────────────────────────────────────────────────────────────

const lire = (f) => {
  const p = path.join(CATALOGS, f);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
};

/** Toutes les references `<pack>::<nom>` d'un fichier. */
function references(source, prefixe) {
  const motif = new RegExp(prefixe + "::([A-Za-z0-9_.-]+)", "g");
  return [...new Set([...source.matchAll(motif)].map((m) => m[1]))];
}

function controler(titre, fichier, verifier) {
  const source = lire(fichier);
  if (source === null) {
    console.log(`  ${titre.padEnd(14)} ABSENT (${fichier})`);
    echecs++;
    return;
  }
  const avant = echecs;
  const n = verifier(source);
  const etat = echecs === avant ? "ok" : `${echecs - avant} MORTE(S)`;
  console.log(`  ${titre.padEnd(14)} ${String(n).padStart(4)} references  ${etat}`);
}

console.log("Verification des catalogues");
console.log(`  notre pack   : ${nosAssets.size} assets`);
console.log(`  pack de base : ${assetsBase.size} assets`);
console.log("");

controler("Modular", "Modular.lua", (s) => {
  const refs = references(s, "narvos");

  // ── LE CHAMP `blueprint` EST UNE TROISIEME NATURE ───────────────────────────
  // Depuis le 2026-09-12, un corps peut etre un BLUEPRINT (Meta Customization
  // System) : il porte sa propre logique et n'est ni un SkeletalMesh ni un
  // StaticMesh. Les relever a part plutot qu'elargir le type accepte partout —
  // une coiffure declaree en blueprint resterait une faute.
  const refsBlueprint = new Set(
    [...s.matchAll(/blueprint\s*=\s*"narvos::([^"]+)"/g)].map((m) => m[1]),
  );
  for (const r of refsBlueprint) {
    const type = nosTypes.get(r);
    if (type !== undefined && type !== "blueprints") {
      mauvaisType(r, "blueprints", type);
    }
  }

  // Modular melange SkeletalMesh (corps, vetements) et StaticMesh (coiffures,
  // couvre-chefs) : les deux sont legitimes, on refuse seulement le reste.
  for (const r of refs) {
    if (refsBlueprint.has(r)) continue;
    const type = nosTypes.get(r);
    if (type !== undefined && type !== "skeletal_meshes" && type !== "static_meshes") {
      mauvaisType(r, "skeletal_meshes ou static_meshes", type);
    }
  }
  for (const r of refs) if (!nosAssets.has(r)) manquant(`narvos::${r}`);
  return refs.length;
});

// -- UN BLUEPRINT JOUABLE DOIT POUVOIR SE CHARGER ----------------------------
//
// Le defaut qu il ferme, vu a l ecran le 2026-09-12 : `BP_MH_Male_Playable`
// etait cuit, present sur le disque, declare dans Assets.toml — et le client
// affichait un BLOC ROUGE.
//
//     Failed to load Unreal Asset: 'narvos::BP_MH_Male_Playable'
//     (.../BP_MH_Male_Playable.BP_MH_Male_Playable_C)!
//     Asset File not found or is from a different type.
//     Required type 'BlueprintGeneratedClass'.
//
// Ses IMPORTS pointaient `/Game/Metahuman_Customization_System/...`, l adresse
// [ANCIENNE VERSION ↑]
// d avant la promotion sous `Narvos/`. Sa classe PARENTE n etait donc nulle
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 433 ligne(s) attendue(s) ici, 497 connue(s)]
// part, et une classe sans parent n existe pas.
//
// Trois controles disaient « ok » : la cle est dans Assets.toml, le fichier est
// sur le disque, le type est `blueprints`. Aucun ne regardait ce que le paquet
// DEMANDE. Pour un mesh, declare = chargeable ; pour un Blueprint, non.
//
// Ne juge QUE les corps de `Modular.JOUABLES` : ce sont les seuls qu un joueur
// peut faire spawner. Les autres Blueprints du pack restent au catalogue en
// attendant leurs dependances, et crier sur eux ferait du bruit sans defaut.
// -- LA LOCOMOTION -----------------------------------------------------------
// `Builder.LOCOMOTION` n'est pas dans un catalogue : c'est une constante de
// `Logic/Character.lua`, posee sur CHAQUE personnage au spawn. Une reference
// morte la rendrait muette — `SetAnimationIdleWalkRunStanding` sur un asset
// absent ne leve pas, le moteur garde simplement sa locomotion, et personne ne
// saurait pourquoi nos animations ne sortent pas.
controler("Locomotion", "../Logic/Character.lua", (s) => {
  // `nil` DECLARE est un choix : la locomotion NATIVE de nanos (retour de jeu du
  // 2026-09-13 : BS_EnemyWalk, une marche de COMBAT, gardait le personnage en garde).
  if (/Builder.LOCOMOTION = nil/.test(s)) {
    console.log("    NATIF   Builder.LOCOMOTION = nil : locomotion du moteur (idle, marche, course, transitions)");
    return 1;
  }
  const m = s.match(/Builder.LOCOMOTION = "narvos::([^"]+)"/);
  if (!m) {
    console.log("    ABSENT  Builder.LOCOMOTION n'est plus declaree dans Logic/Character.lua");
    manquant("Builder.LOCOMOTION");
    return 0;
  }
  if (!nosAssets.has(m[1])) manquant(`narvos::${m[1]}`);
  const t = nosTypes.get(m[1]);
  if (t !== undefined && t !== "blendspaces" && t !== "animations" && t !== "other") {
    mauvaisType(m[1], "un blend space", t);
  }
  return 1;
});

controler("Modular jouables", "Modular.lua", (s) => {
  const jouables = [...s.matchAll(/Modular.JOUABLES = { ([^}]*)}/g)]
    .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
  if (jouables.length === 0) {
    console.log("    VIDE    Modular.JOUABLES : aucun corps jouable");
    manquant("Modular.JOUABLES");
    return 0;
  }

  let examines = 0;
  for (const id of jouables) {
    // La ligne du corps, puis son champ `blueprint` s il en a un.
    const ligne = s.match(new RegExp("^ +" + id + " = {[^}]*}", "m"));
    const bp = ligne && ligne[0].match(/blueprint = "narvos::([^"]+)"/);
    if (!bp) continue;

    const chemin = nosChemins.get(bp[1]);
    if (!chemin) continue; // deja signale par le controle de presence
    const fichier = PACK_CUIT + "/" + chemin + ".uasset";
    if (!fs.existsSync(fichier)) continue;

    examines++;
    const texte = fs.readFileSync(fichier).toString("latin1");
    const absents = new Set();
    for (const m of texte.matchAll(new RegExp("/Game/[A-Za-z0-9_./-]{3,180}", "g"))) {
      const ref = m[0].replace(new RegExp("[./]+$"), "");
      if (ref.length < 7) continue;
      if (ref.endsWith("/" + bp[1])) continue;
      if (!fs.existsSync(PACK_CUIT + "/" + ref.slice("/Game/".length) + ".uasset")) {
        absents.add(ref);
      }
    }
    if (absents.size > 0) {
      console.log(`    IMPORTS ${id} -> narvos::${bp[1]} : ${absents.size} paquet(s) ABSENT(S) du pack`);
      for (const a of [...absents].sort()) console.log(`            ${a}`);
      console.log(`            un Blueprint sans sa classe parente ne se charge PAS`);
      manquant(`narvos::${bp[1]} (imports)`);
    }
  }
  return examines;
});

// ── COHÉRENCE INTERNE — le second inventaire, celui du catalogue lui-même ─────
//
// Le contrôle ci-dessus ne regarde que les `narvos::<asset>` : il confronte le
// catalogue au pack CUIT. Mais un catalogue se cite aussi LUI-MÊME —
// `TENUE_BASE` nomme `"body_chest_m"`, que seul `PIECES` définit ; `CORPS`
// annonce une `famille` que seul `FAMILLES` liste. Ces liens-là ne quittent
// jamais le fichier, donc aucun inventaire externe ne peut les valider.
//
// Le 2026-09-04 ils ne s'accordaient pas : `TENUE_BASE` portait 3 familles
// trooper absentes de `FAMILLES`, soit 15 identifiants de pièces définis nulle
// part — et ce vérificateur annonçait « Modular 47 references ok ».
//
// Muet en jeu, aussi : `TENUE_BASE[famille .. "|" .. genre]` ne matchait pas,
// `Modular.TenueBase` rendait `{}`, le personnage sortait nu sans une ligne de
// log. Même silence que la référence morte, autre source de vérité.

/** Signale un lien interne rompu : un identifiant cité ici, défini nulle part.
 *
 *  Ce n'est pas une référence morte — aucun asset n'est en cause. C'est le
 *  catalogue qui ne se recoupe plus avec lui-même. */
function lienRompu(ou, quoi) {
  console.log(`    LIEN    ${ou} : ${quoi}`);
  echecs++;
}

/** Corps d'une table Lua de premier niveau `Modular.<nom> = { … }`.
 *
 *  Compte les accolades plutôt que de couper au premier `}` : les entrées de
 *  `PIECES` sont elles-mêmes des tables. */
function tableLua(source, nom) {
  const i = source.indexOf(`Modular.${nom} = {`);
  if (i < 0) return "";
  const debut = source.indexOf("{", i);
  let n = 0;
  for (let j = debut; j < source.length; j++) {
    if (source[j] === "{") n++;
    else if (source[j] === "}" && --n === 0) return source.slice(debut + 1, j);
  }
  return "";
}

/** Éléments d'une liste Lua de chaînes : `{ "a", "b" }`. */
const listeLua = (bloc) => new Set([...bloc.matchAll(/"([^"]+)"/g)].map((m) => m[1]));

/** Entrées `  identifiant = { … },` d'une table Lua, en (clé, corps). */
const entreesLua = (bloc) => [...bloc.matchAll(/^ {4}([A-Za-z_][A-Za-z0-9_]*) = \{([^}]*)\}/gm)];

controler("Modular liens", "Modular.lua", (s) => {
  const familles = listeLua(tableLua(s, "FAMILLES"));
  const slots = listeLua(tableLua(s, "SLOTS"));
  const registres = listeLua(tableLua(s, "REGISTRES"));
  const blocPieces = tableLua(s, "PIECES");
  const pieces = new Set(entreesLua(blocPieces).map((m) => m[1]));

  let n = 0;
  const champ = (corps, nom) => (corps.match(new RegExp(nom + ' = "([^"]+)"')) || [])[1];

  // Un corps dont la famille n'est pas listée n'a pas de tenue nue : il sort
  // visible alors qu'on le cache, ou nu alors qu'on l'habille.
  for (const [, id, corps] of entreesLua(tableLua(s, "CORPS"))) {
    n++;
    const f = champ(corps, "famille");
    if (f && !familles.has(f)) lienRompu(`CORPS.${id}`, `famille "${f}" absente de FAMILLES`);
  }

  // Une pièce dont le slot n'existe pas ne sera jamais posée ; dont le registre
  // n'existe pas, jamais filtrée du bon côté de la frontière création/marchand.
  for (const [, id, corps] of entreesLua(blocPieces)) {
    n++;
    const f = champ(corps, "famille");
    const sl = champ(corps, "slot");
    const rg = champ(corps, "registre");
    if (f && !familles.has(f)) lienRompu(`PIECES.${id}`, `famille "${f}" absente de FAMILLES`);
    if (sl && !slots.has(sl)) lienRompu(`PIECES.${id}`, `slot "${sl}" absent de SLOTS`);
    if (rg && !registres.has(rg)) lienRompu(`PIECES.${id}`, `registre "${rg}" absent de REGISTRES`);
  }

  // La tenue nue : sa clé doit désigner une famille vivante, et chacune de ses
  // valeurs une pièce qui existe.
  for (const m of tableLua(s, "TENUE_BASE").matchAll(/\["([^"|]+)\|([^"]+)"\] = \{([^}]*)\}/g)) {
    const [, famille, genre, corps] = m;
    const cle = `TENUE_BASE["${famille}|${genre}"]`;
    n++;
    if (!familles.has(famille)) lienRompu(cle, `famille "${famille}" absente de FAMILLES`);
    for (const [, slot, piece] of corps.matchAll(/([a-z]+) = "([^"]+)"/g)) {
      n++;
      if (!slots.has(slot)) lienRompu(cle, `slot "${slot}" absent de SLOTS`);
      if (!pieces.has(piece)) lienRompu(`${cle}.${slot}`, `piece "${piece}" absente de PIECES`);
    }
  }

  return n;
});

// Spawnables ne porte pas le prefixe dans ses entrees : il le compose au
// runtime (`Spawnables.PACK .. "::" .. e.asset`). On lit donc le champ `asset`.
controler("Spawnables", "Spawnables.lua", (s) => {
  const refs = [...new Set([...s.matchAll(/asset = "([A-Za-z0-9_.-]+)"/g)].map((m) => m[1]))];
  for (const r of refs) if (!nosAssets.has(r)) manquant(`narvos::${r}`);
  return refs.length;
});

// Les dalles qui bouchent les trous. Elles n'utilisent qu'UN mesh et UN
// matériau, mais c'est justement le piège : une seule référence morte et les
// 43 dalles disparaissent d'un coup, sans que rien ne le dise en jeu.
// ⚠ `SM_Patch_Sol` n'entre dans le pack qu'au prochain cook : tant qu'il n'a pas
// eu lieu, ce contrôle signale — et c'est le comportement voulu.
controler("Patches", "Patches.lua", (s) => {
  const refs = [...new Set([...s.matchAll(/narvos::([A-Za-z0-9_.-]+)/g)].map((m) => m[1]))];
  for (const r of refs) if (!nosAssets.has(r)) manquant(`narvos::${r}`);
  return refs.length;
});

// Le semis d'herbe. Les 4 meshes viennent du pack MWLandscapeAutoMaterial :
// ils sont sous Narvos/ donc cuisibles, mais ils n'entrent dans le pack qu'au
// prochain cook — ce controle le dit au lieu de laisser 300 touffes disparaitre
// en silence.
controler("Vegetation", "Vegetation.lua", (s) => {
  const refs = [...new Set([...s.matchAll(/mesh = "([A-Za-z0-9_.-]+)"/g)].map((m) => m[1]))];
  for (const r of refs) if (!nosAssets.has(r)) manquant(`narvos::${r}`);
  return refs.length;
});

controler("Props", "Props.lua", (s) => {
  const refs = [...new Set([...s.matchAll(/\{ id = "(SM_[A-Za-z0-9_.-]+)"/g)].map((m) => m[1]))];
  for (const r of refs) { const raison = refusBase(r); if (raison) manquant(`nanos-world::${r} (${raison})`); }
  return refs.length;
});

controler("Vfx", "Vfx.lua", (s) => {
  const refs = [...new Set([...s.matchAll(/"((?:P|NS)_[A-Za-z0-9_.-]+)"/g)].map((m) => m[1]))];
  for (const r of refs) { const raison = refusBase(r); if (raison) manquant(`nanos-world::${r} (${raison})`); }
  return refs.length;
});

controler("Emotes", "Emotes.lua", (s) => {
  const refs = references(s, "narvos");
  controlerType(refs, "animations");
  for (const r of refs) if (!nosAssets.has(r)) manquant(`narvos::${r}`);
  return refs.length;
});

// ── Apparence : les materiaux poses par la teinte ─────────────────────────────
//
// ⚠ CE CONTROLE MANQUAIT, et le trou etait exactement du type que ce fichier
// existe pour fermer. `Apparence.CIBLES` a gagne le 2026-09-05 un champ
// `materiau` — l'instance a poser AVANT la couleur, faute de quoi la teinte vise
// `MI_Body` qui n'a pas le parametre et ne peint rien.
//
// Une instance absente du pack ne leverait pas davantage : `SetMaterial` sur un
// asset introuvable est silencieux. Le joueur choisirait une couleur, rien ne se
// passerait, et aucun log ne le dirait.
//
// ⚠ LE NOM PORTE UN `%s` — le genre. On developpe les deux formes plutot que de
// verifier le gabarit : c'est `MI_NarvosPeau_M` et `MI_NarvosPeau_F` qui doivent
// exister, pas `MI_NarvosPeau_%s`.
//
// `Apparence.lua` vit dans `Logic/`, pas dans `Catalogs/` : d'ou le chemin.
controler("Apparence peau", "../Logic/Apparence.lua", (s) => {
  const gabarits = [...s.matchAll(/materiau\s*=\s*"narvos::([^"]+)"/g)].map((m) => m[1]);
  const refs = [];
  for (const g of gabarits) {
    if (g.includes("%s")) {
      for (const genre of ["M", "F"]) refs.push(g.replace("%s", genre));
// [SÛRE dans une version intermédiaire, non replacée] // SA section d'Assets.toml : SK_ → skeletal_meshes (le VehicleWheeled exige
// [SÛRE dans une version intermédiaire, non replacée]     const attendu = r.startsWith("SK_") ? "skeletal_meshes"
// [SÛRE dans une version intermédiaire, non replacée]     if (attendu) {
// [SÛRE dans une version intermédiaire, non replacée]       if (t !== undefined && t !== attendu) mauvaisType(r, attendu, t);
// [SÛRE dans une version intermédiaire, non replacée]     return refs.length;
// [SÛRE dans une version intermédiaire, non replacée]   });
// [SÛRE dans une version intermédiaire, non replacée] }
// [SÛRE dans une version intermédiaire, non replacée] 
// [SÛRE dans une version intermédiaire, non replacée] // 2026-09-08, aucun UserWidget n'est déclaré dans Assets.toml (contrat
// [SÛRE dans une version intermédiaire, non replacée] //   declare           → la clé EST dans Assets.toml [assets.blueprints]
// [SÛRE dans une version intermédiaire, non replacée] controler("Widgets", "Widgets.lua", (s) => {
// [SÛRE dans une version intermédiaire, non replacée]   const entrees = [...s.matchAll(
// [SÛRE dans une version intermédiaire, non replacée]   )];
// [SÛRE dans une version intermédiaire, non replacée]   for (const [, cle, chemin, etat] of entrees) {
// [SÛRE dans une version intermédiaire, non replacée]     const dansToml = nosAssets.has(cle);
// [SÛRE dans une version intermédiaire, non replacée]     if (etat === "declare") {
// [SÛRE dans une version intermédiaire, non replacée]       if (!dansToml) manquant(`Widgets : ${cle} dit "declare" mais absent d'Assets.toml`);
// [SÛRE dans une version intermédiaire, non replacée]       else if (nosTypes.get(cle) !== "blueprints") mauvaisType(cle, "blueprints", nosTypes.get(cle));
// [SÛRE dans une version intermédiaire, non replacée]     } else if (etat === "cuit_non_declare") {
// [SÛRE dans une version intermédiaire, non replacée]       if (!dansPack) manquant(`Widgets : ${chemin} dit "cuit_non_declare" mais .uasset absent du pack cuit`);
// [SÛRE dans une version intermédiaire, non replacée]       if (dansToml) {
// [SÛRE dans une version intermédiaire, non replacée]         console.log(`    ETAT    Widgets : ${cle} dit "cuit_non_declare" mais EST déclaré — mettre à jour`);
// [SÛRE dans une version intermédiaire, non replacée]         echecs++;
// [SÛRE dans une version intermédiaire, non replacée]       }
// [SÛRE dans une version intermédiaire, non replacée]     } else if (etat === "adk_seul") {
// [SÛRE dans une version intermédiaire, non replacée]       if (dansPack) {
// [SÛRE dans une version intermédiaire, non replacée]         console.log(`    ETAT    Widgets : ${chemin} dit "adk_seul" mais EST cuit — mettre à jour`);
// [SÛRE dans une version intermédiaire, non replacée]         echecs++;
// [SÛRE dans une version intermédiaire, non replacée]       }
// [SÛRE dans une version intermédiaire, non replacée]       if (!dansAdk) manquant(`Widgets : ${chemin} dit "adk_seul" mais absent de l'ADK`);
// [SÛRE dans une version intermédiaire, non replacée] //
// [SÛRE dans une version intermédiaire, non replacée] // ⚠ REFUS DU ZÉRO-CIBLE : un Plans.lua sans plan ou sans référence d'item
// [SÛRE dans une version intermédiaire, non replacée] // n'est pas « vert » — c'est la garde du générateur qui a tout exclu.
// [SÛRE dans une version intermédiaire, non replacée] controler("Plans", "Plans.lua", (s) => {
// [SÛRE dans une version intermédiaire, non replacée]   // Les commentaires citent la FORME des références (`narvos::SK_…`) pour la
// [SÛRE dans une version intermédiaire, non replacée]   // documenter : un gabarit n'est pas une référence. On les retire, même
// [SÛRE dans une version intermédiaire, non replacée]   // discipline que le contrôle de câblage d'Index.lua (leçon du 2026-09-08).
// [SÛRE dans une version intermédiaire, non replacée]   const code = s.replace(/^\s*--.*$/gm, "");
// [SÛRE dans une version intermédiaire, non replacée]   const sourceItems = lire("Items.lua");
// [SÛRE dans une version intermédiaire, non replacée]   if (sourceItems === null) {
// [SÛRE dans une version intermédiaire, non replacée]     console.log("    MANQUE  Items.lua — impossible de prouver les pièces des plans");
// [SÛRE dans une version intermédiaire, non replacée]     echecs++;
// [SÛRE dans une version intermédiaire, non replacée]     return 0;
// [SÛRE dans une version intermédiaire, non replacée]   }
// [SÛRE dans une version intermédiaire, non replacée]   const blocItems = tableLua(sourceItems.replace("Items.ITEM_DB = {", "Modular.ITEM_DB = {"), "ITEM_DB");
// [SÛRE dans une version intermédiaire, non replacée]   const itemIds = new Set(
// [SÛRE dans une version intermédiaire, non replacée]     [...blocItems.matchAll(/^ {4}([A-Za-z_][A-Za-z0-9_]*) = \{$/gm)].map((m) => m[1])
// [SÛRE dans une version intermédiaire, non replacée]   );
// [SÛRE dans une version intermédiaire, non replacée]   if (itemIds.size === 0) {
// [SÛRE dans une version intermédiaire, non replacée]     console.log("    VIDE    Items.ITEM_DB : 0 clé extraite — le motif est périmé");
// [SÛRE dans une version intermédiaire, non replacée]     echecs++;
// [SÛRE dans une version intermédiaire, non replacée]     return 0;
// [SÛRE dans une version intermédiaire, non replacée]   }
// [SÛRE dans une version intermédiaire, non replacée] 
// [SÛRE dans une version intermédiaire, non replacée]   let n = 0;
// [SÛRE dans une version intermédiaire, non replacée] 
// [SÛRE dans une version intermédiaire, non replacée]   // Les plans eux-mêmes : entrées de Plans.PLANS.
// [SÛRE dans une version intermédiaire, non replacée]   const plansEmis = [...code.matchAll(/^ {4}(plan_[A-Za-z0-9_]+) = \{$/gm)].map((m) => m[1]);
// [SÛRE dans une version intermédiaire, non replacée]   if (plansEmis.length === 0) {
// [SÛRE dans une version intermédiaire, non replacée]     console.log("    VIDE    Plans : aucun plan émis — la garde du générateur a tout exclu ?");
// [SÛRE dans une version intermédiaire, non replacée]     echecs++;
// [SÛRE dans une version intermédiaire, non replacée]   }
// [SÛRE dans une version intermédiaire, non replacée]   n += plansEmis.length;
// [SÛRE dans une version intermédiaire, non replacée] 
// [SÛRE dans une version intermédiaire, non replacée]   // Les résultats : item_id = "…".
// [SÛRE dans une version intermédiaire, non replacée]   for (const m of code.matchAll(/item_id = "([^"]+)"/g)) {
// [SÛRE dans une version intermédiaire, non replacée]     n++;
// [SÛRE dans une version intermédiaire, non replacée]     if (!itemIds.has(m[1])) manquant(`Plans : item « ${m[1]} » absent d'Items.ITEM_DB`);
// [SÛRE dans une version intermédiaire, non replacée]   }
// [SÛRE dans une version intermédiaire, non replacée] 
// [SÛRE dans une version intermédiaire, non replacée]   // Les listes blanches des filtres : items = { "…", … } (blocs sans sous-table).
// [SÛRE dans une version intermédiaire, non replacée]   for (const bloc of code.matchAll(/items = \{([^}]*)\}/gs)) {
// [SÛRE dans une version intermédiaire, non replacée]     for (const m of bloc[1].matchAll(/"([^"]+)"/g)) {
// [SÛRE dans une version intermédiaire, non replacée]       n++;
// [SÛRE dans une version intermédiaire, non replacée]       if (!itemIds.has(m[1])) manquant(`Plans : pièce « ${m[1]} » absente d'Items.ITEM_DB`);
// [SÛRE dans une version intermédiaire, non replacée]     }
// [SÛRE dans une version intermédiaire, non replacée]   }
// [SÛRE dans une version intermédiaire, non replacée] 
// [SÛRE dans une version intermédiaire, non replacée]   // Les meshes d'aperçu : visuel.mesh = "narvos::SK_…".
// [SÛRE dans une version intermédiaire, non replacée]   const meshes = references(code, "narvos");
// [SÛRE dans une version intermédiaire, non replacée]   controlerType(meshes, "skeletal_meshes");
// [SÛRE dans une version intermédiaire, non replacée]   for (const r of meshes) if (!nosAssets.has(r)) manquant(`narvos::${r}`);
// [SÛRE dans une version intermédiaire, non replacée]   n += meshes.length;
// [SÛRE dans une version intermédiaire, non replacée] 
// [SÛRE dans une version intermédiaire, non replacée]   if (n === plansEmis.length) {
// [SÛRE dans une version intermédiaire, non replacée]     console.log("    VIDE    Plans : des plans mais AUCUNE référence d'item — contrôle sans cible");
// [SÛRE dans une version intermédiaire, non replacée]     echecs++;
// [SÛRE dans une version intermédiaire, non replacée]   }
// [SÛRE dans une version intermédiaire, non replacée]   return n;
// [SÛRE dans une version intermédiaire, non replacée] });
// [SÛRE dans une version intermédiaire, non replacée] 
// [SÛRE dans une version intermédiaire, non replacée] // ── TOUTE citation littérale `narvos::X` du code Lua ─────────────────────────
// [SÛRE dans une version intermédiaire, non replacée] //
// [SÛRE dans une version intermédiaire, non replacée] // Les contrôles ci-dessus suivent des FICHIERS. Le 2026-09-13, en écrivant les
// [SÛRE dans une version intermédiaire, non replacée] // meshes de `Gisements.lua` (catalogue écrit à la main), la mesure a montré que
// [SÛRE dans une version intermédiaire, non replacée] // ni lui, ni `ObjetsHyper.lua` (203 références), ni `Ateliers.lua`, ni
// [SÛRE dans une version intermédiaire, non replacée] // `MetaHumain.lua`, ni les `Server/*.lua` n'étaient lus par personne. Un contrôle
// [SÛRE dans une version intermédiaire, non replacée] // par lieu ne voit que les lieux du premier incident (CLAUDE.md, « un garde-fou
// [SÛRE dans une version intermédiaire, non replacée] // doit filtrer sur la FORME du défaut ») : celui-ci filtre sur la forme — une
// [SÛRE dans une version intermédiaire, non replacée] // chaîne `narvos::NOM` écrite dans du code, où qu'elle soit.
// [SÛRE dans une version intermédiaire, non replacée] //
// [SÛRE dans une version intermédiaire, non replacée] // Ce qu'il ne voit pas : les clés COMPOSÉES au runtime (`"narvos::" .. anim`),
// [SÛRE dans une version intermédiaire, non replacée] // qui n'ont pas de forme littérale. Les catalogues qui les portent gardent leur
// [SÛRE dans une version intermédiaire, non replacée] // contrôle dédié (Spawnables).
// [SÛRE dans une version intermédiaire, non replacée] //
// [SÛRE dans une version intermédiaire, non replacée] // Les commentaires sont retirés avant la lecture : ils citent des GABARITS
// [SÛRE dans une version intermédiaire, non replacée] // (`narvos::SM_X`), pas des références. Les maps (`Map_*.lua`) ont leur contrôle.
// [SÛRE dans une version intermédiaire, non replacée] controler("Citations Lua", "Items.lua", () => {
// [SÛRE dans une version intermédiaire, non replacée]   const PAQUETS = path.join(CATALOGS, "..", "..", "..");
// [SÛRE dans une version intermédiaire, non replacée]   const dossiers = [
// [SÛRE dans une version intermédiaire, non replacée]     path.join(PAQUETS, "narvos", "Shared", "Catalogs"),
// [SÛRE dans une version intermédiaire, non replacée]     path.join(PAQUETS, "narvos", "Shared", "Logic"),
// [SÛRE dans une version intermédiaire, non replacée]     path.join(PAQUETS, "narvos-map-proto", "Server"),
// [SÛRE dans une version intermédiaire, non replacée]     path.join(PAQUETS, "narvos-map-proto", "Client"),
// [SÛRE dans une version intermédiaire, non replacée]   ];
// [SÛRE dans une version intermédiaire, non replacée]   let n = 0;
// [SÛRE dans une version intermédiaire, non replacée]   for (const dossier of dossiers) {
// [SÛRE dans une version intermédiaire, non replacée]     if (!fs.existsSync(dossier)) {
// [SÛRE dans une version intermédiaire, non replacée]       console.log(`    ABSENT  ${dossier}`);
// [SÛRE dans une version intermédiaire, non replacée]       echecs++;
// [SÛRE dans une version intermédiaire, non replacée]       continue;
// [SÛRE dans une version intermédiaire, non replacée]     }
// [SÛRE dans une version intermédiaire, non replacée]     for (const nom of fs.readdirSync(dossier)) {
// [SÛRE dans une version intermédiaire, non replacée]       if (!nom.endsWith(".lua") || /^Map_/.test(nom)) continue;
// [SÛRE dans une version intermédiaire, non replacée]       const source = fs.readFileSync(path.join(dossier, nom), "utf8");
// [SÛRE dans une version intermédiaire, non replacée]       // Retire les commentaires de ligne et de fin de ligne. Une chaîne qui
// [SÛRE dans une version intermédiaire, non replacée]       // contiendrait « -- » serait tronquée : aucune clé d'asset n'en porte.
// [SÛRE dans une version intermédiaire, non replacée]       const code = source.replace(/--\[\[[\s\S]*?\]\]/g, "").replace(/--.*$/gm, "");
// [SÛRE dans une version intermédiaire, non replacée]       // Une CHAÎNE ENTIÈRE, fermée juste après le nom, et pas un préfixe qu'on
// [SÛRE dans une version intermédiaire, non replacée]       // complète : `"narvos::MI_NarvosPeau_%s"` (format) ou `"narvos::SK_" .. x`
// [SÛRE dans une version intermédiaire, non replacée]       // (concaténation) ne nomment aucun asset à eux seuls.
// [SÛRE dans une version intermédiaire, non replacée]       const entieres = new Set(
// [SÛRE dans une version intermédiaire, non replacée]         [...code.matchAll(/(["'])narvos::([A-Za-z0-9_.-]+)\1(?!\s*\.\.)/g)].map((m) => m[2])
// [SÛRE dans une version intermédiaire, non replacée]       );
// [SÛRE dans une version intermédiaire, non replacée]       for (const r of entieres) {
// [SÛRE dans une version intermédiaire, non replacée]         n++;
// [SÛRE dans une version intermédiaire, non replacée]         if (!nosAssets.has(r)) manquant(`narvos::${r}  (cite dans ${nom})`);
// [SÛRE dans une version intermédiaire, non replacée]       }
// [SÛRE dans une version intermédiaire, non replacée]     }
// [SÛRE dans une version intermédiaire, non replacée]   }
// [SÛRE dans une version intermédiaire, non replacée]   if (n === 0) {
// [SÛRE dans une version intermédiaire, non replacée]     console.log("    VIDE    aucune citation lue — le parcours est casse");
// [SÛRE dans une version intermédiaire, non replacée]     echecs++;
// [SÛRE dans une version intermédiaire, non replacée]   }
// [SÛRE dans une version intermédiaire, non replacée]   return n;
// [SÛRE dans une version intermédiaire, non replacée] });
// [SÛRE dans une version intermédiaire, non replacée] 
// [SÛRE dans une version intermédiaire, non replacée] // ── L'IDENTITÉ d'une clé citée : elle doit désigner le MÊME asset ─────────────
// [SÛRE dans une version intermédiaire, non replacée] //
// [SÛRE dans une version intermédiaire, non replacée] // Mesuré le 2026-09-13 : `narvos::SKM_Manny_3`, porteur de tous les corps
// [SÛRE dans une version intermédiaire, non replacée] // MetaHuman, n'est pas un nom — c'est le RANG d'homonyme que le constructeur du
// [SÛRE dans une version intermédiaire, non replacée] // pack donne aux `SKM_Manny` dans l'ordre des dossiers (BaconCombatGraphU,
// [SÛRE dans une version intermédiaire, non replacée] // BlacksmithAnimations, Defender…). Un pack promu qui trie avant `Defender` et
// [SÛRE dans une version intermédiaire, non replacée] // livre un `SKM_Manny` décale tout : la clé EXISTE toujours, tous les contrôles
// [SÛRE dans une version intermédiaire, non replacée] // d'existence restent verts, et le porteur a changé de squelette. Même panne pour
// [SÛRE dans une version intermédiaire, non replacée] // une clé sans suffixe : un nouveau `SM_Foo` qui trie avant l'ancien lui prend
// [SÛRE dans une version intermédiaire, non replacée] // son nom, et l'ancien devient `SM_Foo_2`.
// [SÛRE dans une version intermédiaire, non replacée] //
// [SÛRE dans une version intermédiaire, non replacée] // Le verrou mémorise le CHEMIN de chaque clé citée par le code. Une clé qui
// [SÛRE dans une version intermédiaire, non replacée] // change de chemin est une référence fausse, pas morte — et bloque de la même
// [SÛRE dans une version intermédiaire, non replacée] // façon. Accepter un changement voulu : `--reverrouiller`.
// [SÛRE dans une version intermédiaire, non replacée] const VERROU = `${RACINE}/WebPortal/Server/adk/_manifests/cles-citees.lock.json`;
// [SÛRE dans une version intermédiaire, non replacée] const REVERROUILLER = process.argv.includes("--reverrouiller");
// [SÛRE dans une version intermédiaire, non replacée] // ── QUI EST VERROUILLÉ, ET POURQUOI PAS TOUT ─────────────────────────────────
// [SÛRE dans une version intermédiaire, non replacée] // Huit catalogues sont RÉGÉNÉRÉS depuis Assets.toml par la chaîne de cook, et
// [SÛRE dans une version intermédiaire, non replacée] // choisissent leurs assets par CHEMIN : si `SK_Mannequin_10` change de corps, leur
// [SÛRE dans une version intermédiaire, non replacée] // générateur réécrit l'entrée avec la clé qui désigne désormais le BON corps. Les
// [SÛRE dans une version intermédiaire, non replacée] // verrouiller crierait à chaque promotion pour un catalogue juste — une alarme qui
// [SÛRE dans une version intermédiaire, non replacée] // sonne toujours n'alarme plus.
// [SÛRE dans une version intermédiaire, non replacée] // TOUT LE RESTE est verrouillé : fichiers écrits à la main, maps, et catalogues
// [SÛRE dans une version intermédiaire, non replacée] // générés depuis le TS (Vehicles, Items…) — leurs clés sont écrites en dur dans
// [SÛRE dans une version intermédiaire, non replacée] // la source TS, une régénération ne les corrigerait pas.
// [SÛRE dans une version intermédiaire, non replacée] // ⚠ Cette liste engage les chaînes de cook : chacun de ces générateurs DOIT y
// [SÛRE dans une version intermédiaire, non replacée] // tourner après la reconstruction du pack, sinon son catalogue est hors verrou ET
// [SÛRE dans une version intermédiaire, non replacée] // périmé.
// [SÛRE dans une version intermédiaire, non replacée] const REGENERES_PAR_LA_CHAINE = new Set([
// [SÛRE dans une version intermédiaire, non replacée]   "Spawnables.lua",     // narvos-spawnables-to-lua.mjs (mannequins par chemin depuis le 13/09)
// [SÛRE dans une version intermédiaire, non replacée]   "PropsNarvos.lua",    // narvos-pack-props-to-lua.mjs
// [SÛRE dans une version intermédiaire, non replacée]   "Animations.lua",     // narvos-anims-to-lua.mjs
// [SÛRE dans une version intermédiaire, non replacée]   "ObjetsHyper.lua",    // narvos-hyper-to-lua.mjs
// [SÛRE dans une version intermédiaire, non replacée]   "Modular.lua",        // narvos-modular-to-lua.mjs (porteur par chemin depuis le 13/09)
// [SÛRE dans une version intermédiaire, non replacée]   "ObjetsDivers.lua",   // narvos-objets-divers-to-lua.mjs (talkie, smartphone, porte a code — par chemin)
// [SÛRE dans une version intermédiaire, non replacée]   "Minimap.lua",        // narvos-minimap-to-lua.mjs (widget, bornes et proxies Ako — par chemin)
// [SÛRE dans une version intermédiaire, non replacée]   "ObjetsIsp.lua",      // narvos-isp-to-lua.mjs (objets d'InventorySystemPro — meshes par chemin)
// [SÛRE dans une version intermédiaire, non replacée] ]);
// [SÛRE dans une version intermédiaire, non replacée] {
// [SÛRE dans une version intermédiaire, non replacée]   const PAQUETS = path.join(CATALOGS, "..", "..", "..");
// [SÛRE dans une version intermédiaire, non replacée]   const dossiers = [
// [SÛRE dans une version intermédiaire, non replacée]     path.join(PAQUETS, "narvos", "Shared", "Catalogs"),
// [SÛRE dans une version intermédiaire, non replacée]     path.join(PAQUETS, "narvos", "Shared", "Logic"),
// [SÛRE dans une version intermédiaire, non replacée]     path.join(PAQUETS, "narvos-map-proto", "Server"),
// [SÛRE dans une version intermédiaire, non replacée]     path.join(PAQUETS, "narvos-map-proto", "Client"),
// [SÛRE dans une version intermédiaire, non replacée]   ];
// [SÛRE dans une version intermédiaire, non replacée]   const citees = new Set();
// [SÛRE dans une version intermédiaire, non replacée]   let fichiersGeneresIgnores = 0;
// [SÛRE dans une version intermédiaire, non replacée]   for (const dossier of dossiers) {
// [SÛRE dans une version intermédiaire, non replacée]     if (!fs.existsSync(dossier)) continue;
// [SÛRE dans une version intermédiaire, non replacée]     for (const nom of fs.readdirSync(dossier)) {
// [SÛRE dans une version intermédiaire, non replacée]       if (!nom.endsWith(".lua")) continue;
// [SÛRE dans une version intermédiaire, non replacée]       const brut = fs.readFileSync(path.join(dossier, nom), "utf8");
// [SÛRE dans une version intermédiaire, non replacée]       const estMap = /^Map_.*\.lua$/.test(nom);
// [SÛRE dans une version intermédiaire, non replacée]       // ⚠ Dans Catalogs/ SEULEMENT : `Logic/Animations.lua` et `Logic/ObjetsHyper.lua`
// [SÛRE dans une version intermédiaire, non replacée]       // portent les mêmes noms et sont écrits à la main.
// [SÛRE dans une version intermédiaire, non replacée]       if (dossier === dossiers[0] && REGENERES_PAR_LA_CHAINE.has(nom)) { fichiersGeneresIgnores++; continue; }
// [SÛRE dans une version intermédiaire, non replacée]       const code = brut.replace(/--\[\[[\s\S]*?\]\]/g, "").replace(/--.*$/gm, "");
// [SÛRE dans une version intermédiaire, non replacée]       for (const m of code.matchAll(/(["'])narvos::([A-Za-z0-9_.-]+)\1(?!\s*\.\.)/g)) citees.add(m[2]);
// [SÛRE dans une version intermédiaire, non replacée]       // Les maps listent des clés NUES (`"-000_006_2"`) — des suffixes
// [SÛRE dans une version intermédiaire, non replacée]       // d'homonymes pour la plupart, donc les plus exposées au décalage.
// [SÛRE dans une version intermédiaire, non replacée]       if (estMap) {
// [SÛRE dans une version intermédiaire, non replacée]         for (const m of code.matchAll(/^\s*"(.+?)",\s*$/gm)) citees.add(m[1]);
// [SÛRE dans une version intermédiaire, non replacée]       }
// [SÛRE dans une version intermédiaire, non replacée]     }
// [SÛRE dans une version intermédiaire, non replacée]   }
// [SÛRE dans une version intermédiaire, non replacée] 
// [SÛRE dans une version intermédiaire, non replacée]   const ancien = fs.existsSync(VERROU) ? JSON.parse(fs.readFileSync(VERROU, "utf8")) : { cles: {} };
// [SÛRE dans une version intermédiaire, non replacée]   const cles = {};
// [SÛRE dans une version intermédiaire, non replacée]   let changees = 0, ajoutees = 0, acceptees = 0;
// [SÛRE dans une version intermédiaire, non replacée]   for (const cle of [...citees].sort()) {
// [SÛRE dans une version intermédiaire, non replacée]     const chemin = nosChemins.get(cle);
// [SÛRE dans une version intermédiaire, non replacée]     if (chemin === undefined) continue;   // absente : déjà signalée plus haut
// [SÛRE dans une version intermédiaire, non replacée]     const connu = ancien.cles[cle];
// [SÛRE dans une version intermédiaire, non replacée]     if (connu === undefined) {
// [SÛRE dans une version intermédiaire, non replacée]       cles[cle] = chemin;
// [SÛRE dans une version intermédiaire, non replacée]       ajoutees++;
// [SÛRE dans une version intermédiaire, non replacée]     } else if (connu !== chemin) {
// [SÛRE dans une version intermédiaire, non replacée]       if (REVERROUILLER) {
// [SÛRE dans une version intermédiaire, non replacée]         cles[cle] = chemin;
// [SÛRE dans une version intermédiaire, non replacée]         acceptees++;
// [SÛRE dans une version intermédiaire, non replacée]       } else {
// [SÛRE dans une version intermédiaire, non replacée]         console.log(`    IDENTITE narvos::${cle} a change d'asset :`);
// [SÛRE dans une version intermédiaire, non replacée]         console.log(`             avant ${connu}`);
// [SÛRE dans une version intermédiaire, non replacée]         console.log(`             now   ${chemin}`);
// [SÛRE dans une version intermédiaire, non replacée]         cles[cle] = connu;   // on garde la référence tant que personne n'a tranché
// [SÛRE dans une version intermédiaire, non replacée]         changees++;
// [SÛRE dans une version intermédiaire, non replacée]         echecs++;
// [SÛRE dans une version intermédiaire, non replacée]       }
    } else {
      cles[cle] = chemin;
    }
  }
  // Une clé qui n'est plus citée sort du verrou : garder sa trace ferait crier
  // le jour où un AUTRE fichier citera la même clé pour un autre asset.
  const retirees = Object.keys(ancien.cles).filter((c) => !(c in cles)).length;
  if (ajoutees > 0 || acceptees > 0 || retirees > 0) {
    fs.mkdirSync(path.dirname(VERROU), { recursive: true });
    fs.writeFileSync(VERROU, JSON.stringify({ genere: new Date().toISOString(), cles }, null, 1));
  }
  console.log(`  ${"Identite".padEnd(14)} ${String(citees.size).padStart(4)} cles citees  `
    + (changees === 0 ? "ok" : `${changees} CHANGEE(S)`)
    + (ajoutees ? `  (+${ajoutees} verrouillee(s))` : "")
    + (acceptees ? `  (${acceptees} reverrouillee(s))` : "")
    + (retirees ? `  (-${retirees} plus citee(s))` : "")
    + `  [${fichiersGeneresIgnores} catalogue(s) regenere(s) hors verrou]`);
  if (citees.size === 0) {
    console.log("    VIDE    aucune cle citee lue — le parcours est casse");
// [ANCIENNE VERSION ↑]
// [DERNIÈRE VERSION ↓ — ligne(s) sûre(s) du fichier final, lue(s) dans le tronçon ci-dessus mais non replacée(s) : il a changé de longueur. Leur n° final est entre crochets]
// [SÛRE n°346]         //              le promouvoir DANS l editeur avant de recuire.
// [SÛRE n°705]   return n;
// [SÛRE n°706] });
// [SÛRE n°707] 
// [SÛRE n°708] // ── TOUTE citation littérale `narvos::X` du code Lua ─────────────────────────
// [SÛRE n°709] //
// [SÛRE n°710] // Les contrôles ci-dessus suivent des FICHIERS. Le 2026-09-13, en écrivant les
// [SÛRE n°711] // meshes de `Gisements.lua` (catalogue écrit à la main), la mesure a montré que
// [SÛRE n°712] // ni lui, ni `ObjetsHyper.lua` (203 références), ni `Ateliers.lua`, ni
// [SÛRE n°713] // `MetaHumain.lua`, ni les `Server/*.lua` n'étaient lus par personne. Un contrôle
// [SÛRE n°714] // par lieu ne voit que les lieux du premier incident (CLAUDE.md, « un garde-fou
// [SÛRE n°715] // doit filtrer sur la FORME du défaut ») : celui-ci filtre sur la forme — une
// [SÛRE n°716] // chaîne `narvos::NOM` écrite dans du code, où qu'elle soit.
// [SÛRE n°717] //
// [SÛRE n°718] // Ce qu'il ne voit pas : les clés COMPOSÉES au runtime (`"narvos::" .. anim`),
// [SÛRE n°719] // qui n'ont pas de forme littérale. Les catalogues qui les portent gardent leur
// [SÛRE n°720] // contrôle dédié (Spawnables).
// [SÛRE n°721] //
// [SÛRE n°722] // Les commentaires sont retirés avant la lecture : ils citent des GABARITS
// [SÛRE n°723] // (`narvos::SM_X`), pas des références. Les maps (`Map_*.lua`) ont leur contrôle.
// [SÛRE n°724] controler("Citations Lua", "Items.lua", () => {
// [SÛRE n°725]   const PAQUETS = path.join(CATALOGS, "..", "..", "..");
// [SÛRE n°726]   const dossiers = [
// [SÛRE n°727]     path.join(PAQUETS, "narvos", "Shared", "Catalogs"),
// [SÛRE n°728]     path.join(PAQUETS, "narvos", "Shared", "Logic"),
// [SÛRE n°729]     path.join(PAQUETS, "narvos-map-proto", "Server"),
// [SÛRE n°730]     path.join(PAQUETS, "narvos-map-proto", "Client"),
// [SÛRE n°731]   ];
// [SÛRE n°732]   let n = 0;
// [SÛRE n°733]   for (const dossier of dossiers) {
// [SÛRE n°734]     if (!fs.existsSync(dossier)) {
// [SÛRE n°735]       console.log(`    ABSENT  ${dossier}`);
// [SÛRE n°736]       echecs++;
// [SÛRE n°737]       continue;
// [SÛRE n°738]     }
// [SÛRE n°739]     for (const nom of fs.readdirSync(dossier)) {
// [SÛRE n°740]       if (!nom.endsWith(".lua") || /^Map_/.test(nom)) continue;
// [SÛRE n°741]       const source = fs.readFileSync(path.join(dossier, nom), "utf8");
// [SÛRE n°742]       // Retire les commentaires de ligne et de fin de ligne. Une chaîne qui
// [SÛRE n°743]       // contiendrait « -- » serait tronquée : aucune clé d'asset n'en porte.
// [SÛRE n°744]       const code = source.replace(/--\[\[[\s\S]*?\]\]/g, "").replace(/--.*$/gm, "");
// [SÛRE n°745]       // Une CHAÎNE ENTIÈRE, fermée juste après le nom, et pas un préfixe qu'on
// [SÛRE n°746]       // complète : `"narvos::MI_NarvosPeau_%s"` (format) ou `"narvos::SK_" .. x`
// [SÛRE n°747]       // (concaténation) ne nomment aucun asset à eux seuls.
// [SÛRE n°748]       const entieres = new Set(
// [SÛRE n°749]         [...code.matchAll(/(["'])narvos::([A-Za-z0-9_.-]+)\1(?!\s*\.\.)/g)].map((m) => m[2])
// [SÛRE n°750]       );
// [SÛRE n°751]       for (const r of entieres) {
// [SÛRE n°752]         n++;
// [SÛRE n°753]         if (!nosAssets.has(r)) manquant(`narvos::${r}  (cite dans ${nom})`);
// [SÛRE n°754]       }
// [SÛRE n°755]     }
// [SÛRE n°756]   }
// [SÛRE n°757]   if (n === 0) {
// [SÛRE n°758]     console.log("    VIDE    aucune citation lue — le parcours est casse");
// [DERNIÈRE VERSION ↑]
    echecs++;
  }
  return n;
});

// ── L'IDENTITÉ d'une clé citée : elle doit désigner le MÊME asset ─────────────
//
// Mesuré le 2026-09-13 : `narvos::SKM_Manny_3`, porteur de tous les corps
// MetaHuman, n'est pas un nom — c'est le RANG d'homonyme que le constructeur du
// pack donne aux `SKM_Manny` dans l'ordre des dossiers (BaconCombatGraphU,
// BlacksmithAnimations, Defender…). Un pack promu qui trie avant `Defender` et
// livre un `SKM_Manny` décale tout : la clé EXISTE toujours, tous les contrôles
// d'existence restent verts, et le porteur a changé de squelette. Même panne pour
// une clé sans suffixe : un nouveau `SM_Foo` qui trie avant l'ancien lui prend
// son nom, et l'ancien devient `SM_Foo_2`.
//
// Le verrou mémorise le CHEMIN de chaque clé citée par le code. Une clé qui
// change de chemin est une référence fausse, pas morte — et bloque de la même
// façon. Accepter un changement voulu : `--reverrouiller`.
const VERROU = `${RACINE}/WebPortal/Server/adk/_manifests/cles-citees.lock.json`;
const REVERROUILLER = process.argv.includes("--reverrouiller");
// ── QUI EST VERROUILLÉ, ET POURQUOI PAS TOUT ─────────────────────────────────
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// verrouiller crierait à chaque promotion pour un catalogue juste — une alarme qui
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// et qui demande l EDITEUR pour etre corrige (promotion + CoreRedirect + cook).
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : ? ligne(s) attendue(s) ici, 7 connue(s)]
// Le laisser faire echouer la batterie la rendrait rouge en permanence — et une
// batterie toujours rouge ne signale plus rien. Il crie, il ne bloque pas.
if (avertissements > 0) {
  console.log("");
  console.log(`${avertissements} Blueprint(s) jouable(s) avec des imports absents du pack.`);
// [SÛRE dans une version intermédiaire, non replacée]     const attendu = r.startsWith("SK_") ? "skeletal_meshes"
// [SÛRE dans une version intermédiaire, non replacée]   controlerType(meshes, "skeletal_meshes");
// [ANCIENNE VERSION ↑]
// [DERNIÈRE VERSION ↓ — ligne(s) sûre(s) du fichier final, lue(s) dans le tronçon ci-dessus mais non replacée(s) : il a changé de longueur. Leur n° final est entre crochets]
// [SÛRE n°889]   console.log("               Narvos/ mais jamais cuit : verifier AVANT de promouvoir.");
// [DERNIÈRE VERSION ↑]
// [FIN INCONNUE — la suite du fichier n'a jamais été lue dans sa dernière version]
// [MODIFICATIONS NON REPLACÉES — 2 modification(s) faite(s) à ce fichier n'ont pas pu y être reportées (texte d'origine introuvable ou ambigu) : voir EDITS_NON_APPLIQUES]