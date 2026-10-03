// ══════════════════════════════════════════════════════════════════════════════
// nanos-build-asset-pack.mjs — assemble l'asset pack NARVOS à partir du cook.
//
//   node scripts/nanos-build-asset-pack.mjs [--apply --staging <identifiant>]
//
// ── CE QU'IL FAIT ─────────────────────────────────────────────────────────────
// Après un cook de l'ADK, Unreal dépose ses assets cuits dans
// `Saved/Cooked/Windows/NanosWorldADK/Content/`. Ce script en tire le pack que
// nanos sait monter :
//
//   Server/Assets/narvos/
//   ├── Narvos/           les dossiers cuits, au NOM UNREAL EXACT
//   │   └── *.uasset / *.uexp / *.ubulk
//   └── Assets.toml       manifeste — c'est lui qui donne des noms au Lua
//
// ── DEUX RÈGLES QUE LA DOC IMPOSE ET QU'ON NE PEUT PAS DEVINER ────────────────
//   1. Le dossier du pack est en **kebab-case** (`narvos`) : « mandatory standard
//      for nanos world Assets & Packages names ».
//   2. `unreal_folders` liste le nom EXACT du dossier racine tel qu'il existait
//      sous `Content/` dans Unreal (`Narvos`, avec sa majuscule). C'est ce qui
//      permet aux références relatives entre assets de continuer à résoudre — se
//      tromper ici casse silencieusement matériaux et textures.
//
// ── POURQUOI GÉNÉRER LE TOML PLUTÔT QUE L'ÉCRIRE ─────────────────────────────
// `[assets.skeletal_meshes]` associe un NOM (celui qu'on écrira en Lua,
// `narvos::SK_Truc`) à un CHEMIN. Avec 611 meshes et 452 animations, une liste
// tenue à la main serait périmée au premier réimport. On la dérive du cook.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const ADK = "E:/narvosprime-web-prototype/WebPortal/Server/adk";
const MOTEUR = "D:/Epic Games/UE_5.7/Engine";

/**
 * Version exacte du moteur qui a cuit le pack.
 *
 * ⚠ NE PAS écrire ce numéro en dur. Le gabarit officiel d'`Assets.toml` porte
 * `5.7.0` ; recopié tel quel, il a fait refuser le pack au démarrage :
 *
 *   Failed to load Asset Pack because it is incompatible with the server Unreal
 *   Version. Asset Pack Unreal Version: '5.7.0'.
 *   Compatible Unreal Versions: '5.7.1, 5.7.2, 5.7.3, 5.7.4'.
 *
 * nanos compare la version DÉCLARÉE, pas le contenu. La lire dans
 * `Engine/Build/Build.version` garantit qu'elle suit le moteur installé, y
 * compris après une mise à jour d'Epic.
 */
const versionMoteur = () => {
  const f = `${MOTEUR}/Build/Build.version`;
  if (!fs.existsSync(f)) {
    console.error(`Version du moteur introuvable : ${f}`);
    process.exit(1);
  }
  const v = JSON.parse(fs.readFileSync(f, "utf8"));
  return `${v.MajorVersion}.${v.MinorVersion}.${v.PatchVersion}`;
};
const COOK = `${ADK}/Saved/Cooked/Windows/NanosWorldADK/Content`;
const DOSSIER_UNREAL = "Narvos";           // nom exact sous Content/
const PACK = "narvos";                      // kebab-case imposé
const APPLY = process.argv.includes("--apply");
const stagingIndex = process.argv.indexOf('--staging');
const staging = stagingIndex < 0 ? null : process.argv[stagingIndex + 1];
if (APPLY && (!staging || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(staging))) {
  throw new Error('--apply exige --staging <identifiant> : le builder ne remplace plus le pack actif.');
}
const builds = path.resolve(ADK, '../AssetBuilds');
const SORTIE = APPLY ? path.join(builds, staging) : path.resolve(ADK, '../Assets');
if (APPLY) {
  // Refuser aussi les jonctions preexistantes : un nom de staging ne doit pas
  // permettre de rediriger l'ecriture dans le pack actif ou dans les sources.
  for (const p of [builds, SORTIE, path.join(SORTIE, PACK)]) {
    if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) throw new Error(`Jonction interdite : ${p}`);
  }
  const target = path.join(SORTIE, PACK);
  if (fs.existsSync(target) && fs.readdirSync(target).length) throw new Error(`Staging non vide : ${target}`);
}

// ─── vérifications ────────────────────────────────────────────────────────────

const source = path.join(COOK, DOSSIER_UNREAL);
if (!fs.existsSync(source)) {
  console.error(`Cook introuvable : ${source}`);
  console.error("Lancer d'abord le cook :");
  console.error('  UnrealEditor-Cmd.exe <ADK>.uproject -run=Cook -targetplatform=Windows -unattended');
  process.exit(1);
}

// ─── inventaire du cook ───────────────────────────────────────────────────────

/**
 * Un asset cuit est un TRIO : `.uasset` (en-tête), `.uexp` (contenu sérialisé),
 * `.ubulk` (données lourdes). Seul le `.uasset` porte le nom logique ; les deux
 * autres l'accompagnent. On énumère donc les `.uasset` et on copiera tout.
 */
const uassets = [];
const parcourir = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) parcourir(p);
    else if (e.name.endsWith(".uasset") || e.name.endsWith(".umap")) uassets.push(p);
  }
};
parcourir(source);

/**
 * Inventaire TYPÉ, produit par `scripts/adk-dump-assets.py` depuis le registre
 * d'assets d'Unreal.
 *
 * ⚠ NE PAS revenir à un classement par préfixe de nom. Ça a été essayé : sur les
 * 611 SkeletalMesh réellement importés, **44 seulement** portent `SK_`. Les
 * autres s'appellent `FaceRigTest`, `ThirdPersonIdle`, `SovietZombie1`… et
 * partaient en `others`, où le Lua ne saurait pas les attacher. Seul le registre
 * connaît la classe réelle, et il n'est lisible que depuis Unreal.
 */
const INVENTAIRE = `${ADK}/_assets-inventory.json`;

if (!fs.existsSync(INVENTAIRE)) {
  console.error(`Inventaire absent : ${INVENTAIRE}`);
  console.error("Le produire :");
  console.error('  UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script=".../adk-dump-assets.py"');
  process.exit(1);
}

const inventaire = JSON.parse(fs.readFileSync(INVENTAIRE, "utf8"));

// Classe Unreal → section d'Assets.toml. Ce qui n'est pas listé n'est pas
// exposé : textures, physics assets et squelettes doivent exister pour que les
// meshes fonctionnent, mais le Lua ne les référence jamais par leur nom.
const SECTION_PAR_CLASSE = {
  SkeletalMesh: "skeletal_meshes",
  StaticMesh: "static_meshes",
  AnimSequence: "animations",
  AnimMontage: "animations",
  BlendSpace: "animations",
  // ⚠ AJOUTÉES LE 2026-09-12. Le moteur nanos anime la locomotion par BLEND
  // SPACE (SetAnimationIdleWalkRunStanding/Crouching/Proning prennent un
  // AnimationPath). Seul `BlendSpace` était exposé : les 10 BlendSpace1D et les
  // 10 AimOffset de l'ADK étaient cuits et copiés dans le pack, jamais déclarés
  // — donc inatteignables depuis le Lua, sans un mot. Même famille de défaut que
  // les 257 Blueprints muets du 11/09.
  BlendSpace1D: "animations",
  AimOffsetBlendSpace: "animations",
  AimOffsetBlendSpace1D: "animations",
  Material: "materials",
  MaterialInstanceConstant: "materials",
  SoundWave: "sounds",
  SoundCue: "sounds",
  NiagaraSystem: "particles",
  ParticleSystem: "particles",
  Blueprint: "blueprints",
  // ⚠ AJOUTÉE LE 2026-09-13. `Widget(path)` [client] prend un BlueprintPath, le
  // même type que `Blueprint()` : un WidgetBlueprint se déclare sous
  // [assets.blueprints]. Sans cette ligne, les 47 WidgetBlueprint de l'ADK étaient
  // cuits, copiés et « classe muette » — `Widget("narvos::ui_minimap_showup")` ne
  // pouvait rien résoudre (plan minimap Ako, bloqueur (a)).
  WidgetBlueprint: "blueprints",
  World: "maps",
};

// Index par chemin de paquet : c'est la clé commune entre l'inventaire (qui a
// les types) et le cook (qui a les fichiers).
const typeParPaquet = new Map();
for (const a of inventaire.assets) {
  // ⚠ UN PAQUET, PLUSIEURS ENTRÉES. Un Blueprint est inventorié DEUX fois sous le
  // même paquet : l'asset (`Blueprint`) et sa classe générée (`…_C`,
  // `BlueprintGeneratedClass`). Écrire la dernière vue rendait le résultat
  // dépendant de l'ORDRE de l'inventaire : BP_Change_Lane (`_C` lu d'abord) était
  // déclaré, les 14 porteurs MetaHuman (`_C` lu ensuite) passaient en « classe
  // muette » — cuits, copiés, jamais déclarés, sans un mot (2026-09-11). Une
  // classe EXPOSABLE n'est donc jamais écrasée par une qui ne l'est pas.
  if (!typeParPaquet.has(a.paquet) || SECTION_PAR_CLASSE[a.classe]) {
    typeParPaquet.set(a.paquet, a.classe);
  }
}

// ⚠ DEUX RAISONS DE NE PAS EXPOSER UN ASSET, ET UNE SEULE EST NORMALE.
//
//   · `classe_muette` — l'asset a une classe CONNUE qu'on n'expose pas
//     volontairement (Texture2D, PhysicsAsset, Skeleton). Le Lua ne les
//     référence jamais par leur nom. C'est le cas courant, sans conséquence.
//
//   · `hors_inventaire` — l'asset est CUIT et COPIÉ, mais le registre ne le
//     connaît pas. Ça ne veut dire qu'une chose : **l'inventaire est périmé**.
//     Il faut relancer `adk-dump-assets.py` APRÈS le cook et AVANT ce script.
//
// Les confondre a coûté une soirée le 2026-09-10 : 41 espèces d'animaux
// importées, cuites (204 uassets), copiées dans le pack (204 fichiers) — et
// ZÉRO déclarée dans Assets.toml. Le compteur existait déjà, mais son libellé
// disait « (textures, physics, squelettes) » : 204 de plus se lisaient comme du
// bruit normal. **Le nombre était juste, son étiquette mentait.**
const categoriser = (paquetLogique) => {
  const classe = typeParPaquet.get(paquetLogique);
  if (!classe) return { section: null, raison: "hors_inventaire" };
  const section = SECTION_PAR_CLASSE[classe] ?? null;
  return { section, raison: section ? null : "classe_muette", classe };
};

const categories = {
  maps: [], static_meshes: [], skeletal_meshes: [], sounds: [],
  animations: [], particles: [], materials: [], blueprints: [], others: [],
};

const nomsPris = new Map();
let muets = 0;                 // classe connue, volontairement non exposee
const horsInventaire = [];     // CUIT mais inconnu du registre : defaut

for (const f of uassets) {
  const base = path.basename(f).replace(/\.(uasset|umap)$/i, "");

  // Chemin RELATIF au dossier Unreal, préfixé de son nom : c'est la forme que
  // nanos attend (`Narvos/Sous/Dossier/SK_Truc`), sans extension.
  const relatif = path.relative(source, f).replace(/\\/g, "/").replace(/\.(uasset|umap)$/i, "");
  const chemin = `${DOSSIER_UNREAL}/${relatif}`;

  // Le registre indexe par chemin LOGIQUE (/Game/Narvos/...), le cook par
  // chemin de fichier. On reconstruit le premier pour faire le lien.
  const { section: cat, raison } = categoriser(`/Game/${DOSSIER_UNREAL}/${relatif}`);
  if (!cat) {
    if (raison === "hors_inventaire") horsInventaire.push(relatif);
    else muets++;
    continue;
  }

  // Les noms doivent être uniques dans le TOML : deux packs peuvent contenir un
  // `SK_Head`. On suffixe plutôt que d'écraser en silence.
  //
  // ⚠ LE NOM FABRIQUÉ DOIT ÊTRE VÉRIFIÉ LIBRE, ET INSCRIT.
  //
  // La version précédente faisait `nom = base + "_" + n` sans jamais confronter
  // le résultat à `nomsPris`, ni l'y inscrire. Elle produisait donc des
  // doublons dès qu'un asset portait DÉJÀ le nom suffixé. Mesuré le 2026-09-08
  // sur le pack du 07/09 :
  //
  //   chunks_unreal_v3/-large_mountain___forge_halo_shared_poops__2   ← nom réel
  //   halo_map/.../-large_mountain___forge_halo_shared_poops_         ← + "_2"
  //                                    -> même clé, deux fois
  //
  // Conséquence : nanos refuse le pack ENTIER.
  //
  //   ERROR  Failed to load Asset Pack 'narvos'. Reason: 'toml::insert_value:
  //          failed to insert a value, value already exists'
  //   ERROR  Invalid Map Asset 'narvos::Map_Narvos'! Could not find Asset Pack!
  //   ERROR  Failed to load map. Closing the server...
  //
  // **2 clés en double sur 64 403 ont coûté les 64 403.** Même forme que les 26
  // noms d'AimOffset qui avaient coûté 12 441 assets le 04/09 : nanos ne
  // dégrade pas, il refuse tout.
  //
  // La boucle incrémente jusqu'à trouver un nom réellement libre, et inscrit ce
  // nom-là. Un nom généré ne peut donc plus être repris par un asset réel qui
  // arriverait après, ni par un second suffixage.
  let nom = base;
  if (nomsPris.has(nom)) {
    let n = nomsPris.get(nom);
    do {
      n += 1;
      nom = `${base}_${n}`;
    } while (nomsPris.has(nom));
    nomsPris.set(base, n);
  }
  nomsPris.set(nom, 1);

  categories[cat].push({ nom, chemin });
}

// ─── rapport ──────────────────────────────────────────────────────────────────

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`  cook   : ${source}`);
console.log(`  pack   : ${SORTIE}/${PACK}`);
console.log("");
console.log(`  ${uassets.length} asset(s) cuit(s), ${muets} non exposé(s) volontairement (textures, physics, squelettes)`);
if (horsInventaire.length > 0) {
  // Un asset cuit ET copié mais absent du registre ne sera JAMAIS joignable
  // depuis le Lua : `narvos::<nom>` ne le trouvera pas, et rien ne le dira au
  // moment de l'appel. On le crie ici, c'est le seul endroit qui le sait.
  console.log("");
  console.log(`  ⚠ ${horsInventaire.length} asset(s) CUIT(S) MAIS ABSENT(S) DE L'INVENTAIRE.`);
  console.log("     Ils sont copiés dans le pack et ne seront déclarés NULLE PART.");
  console.log("     L'inventaire est périmé : le regénérer APRÈS le cook, AVANT ce script :");
  console.log("       UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript \\");
  console.log("         -script=scripts/adk-dump-assets.py -unattended -nosplash");
  const echantillon = [...new Set(horsInventaire.map((r) => r.split("/")[0]))].slice(0, 8);
  console.log(`     dossiers concernés : ${echantillon.join(", ")}`);
}
console.log("");
for (const [cat, liste] of Object.entries(categories)) {
  if (liste.length) console.log(`  ${cat.padEnd(18)} ${liste.length}`);
}

if (!APPLY) {
  console.log("");
  console.log("Rien écrit.");
  process.exit(0);
}

// ─── copie ────────────────────────────────────────────────────────────────────

const destination = path.join(SORTIE, PACK);
const destinationUnreal = path.join(destination, DOSSIER_UNREAL);

fs.mkdirSync(destination, { recursive: true });

// ─── contrôle du staging neuf ────────────────────────────────────────────────
//
// Le pack est construit dans un dossier neuf : aucun ancien asset ne s'accumule.
//
// `cpSync` ECRASE mais n'EFFACE PAS. Un asset retire de `Content/`, ou ajoute a
// `DirectoriesToNeverCook`, cesse d'etre cuit — et reste dans le pack livre,
// indefiniment, parce que plus rien ne le recouvre.
//
// Mesure du 2026-09-08, sur un pack de 67,82 Go :
//   `chunks_unreal`          6,25 Go   absent de Content/ ET de Saved/Cooked/,
//                                      date du 05/09, encore livre le 08/09
//   15 des 32 exclusions     ~1,2 Go   toujours dans le pack apres exclusion
//
// Autrement dit : neuf vagues d'exclusions ecrites en trois jours n'avaient
// allege le pack que pour ce qui n'y etait pas deja entre.
//
// Le staging exige une source contenant au moins 1 000 fichiers pour detecter
// un chemin faux ou presque vide. Ce seuil ne valide PAS le cook : un cook
// partiel peut le depasser. Verifier aussi code de sortie, erreurs d'assets et
// shaders avant toute livraison. Le pack actif n'est jamais vide par ce script.
{
  const compterVite = (d) => {
    let n = 0;
    for (const e of fs.readdirSync(d, { withFileTypes: true, recursive: true })) {
      if (e.isFile()) n++;
    }
    return n;
  };

  const nSource = compterVite(source);
  const nAvant = fs.existsSync(destinationUnreal) ? compterVite(destinationUnreal) : 0;

  if (nSource < 1000) {
    console.error("");
    console.error(`  ARRET : la sortie cuite ne compte que ${nSource} fichier(s).`);
    console.error("  Un cook incomplet ne doit pas remplacer un pack valide.");
    console.error(`  source : ${source}`);
    process.exit(1);
  }

  if (nAvant > 0) throw new Error(`Staging deja rempli : ${destinationUnreal}`);
}

// `cpSync` récursif copie le trio complet sans qu'on ait à l'énumérer.
console.log("");
console.log("copie des assets cuits...");
fs.cpSync(source, destinationUnreal, { recursive: true, force: true });

// ─── Assets.toml ──────────────────────────────────────────────────────────────

/**
 * Clé TOML sûre pour un nom d'asset.
 *
 * ⚠ UNE CLÉ NUE TOML N'ADMET QUE `A-Za-z0-9_-`. Le 2026-09-04, 26 animations
 * d'AimOffset nommées `M_Neutral_AO_Crouch_X+135_Y+90` ont rendu le fichier
 * ENTIER invalide :
 *
 *   TOMLDecodeError: Expected '=' after a key in a key/value pair (ligne 7726)
 *
 * nanos aurait refusé le pack complet — 12 441 assets perdus pour 26 noms. Et
 * rien ne l'annonçait : le builder sortait en code 0, le vérificateur de
 * catalogues ne lisait pas le TOML avec un vrai analyseur.
 *
 * Les guillemets sont la forme standard pour une clé quelconque. On ne quote
 * QUE ce qui l'exige : garder les clés nues quand elles sont légales laisse le
 * fichier lisible et le diff stable.
 */
// ⚠ NE PAS RÉINTRODUIRE LE QUOTAGE. Mesuré le 2026-09-04 : quoter les clés
// illégales produit un TOML valide, le serveur le charge — puis **nanos réécrit
// le fichier** en le mettant en cache (« Loading and caching local Asset
// Pack »), sans quoter et en CRLF. Empreintes relevées :
//
//   avant démarrage  1 532 868 o  CRLF=0      valide
//   après démarrage  1 544 716 o  CRLF=12502  invalide
//
// Le serveur charge donc UNE fois, sur notre fichier, puis le corrompt pour
// tout ce qui vient après — le client compris, qui lit le même fichier par la
// jonction et n'a alors AUCUN asset.
//
// La seule correction qui tient est que les noms d'assets soient légaux en clé
// TOML nue. Le contrôle ci-dessous refuse le build et nomme les coupables.
const cleToml = (nom) => nom;

/** Un nom d'asset utilisable tel quel comme clé TOML nue. */
const NOM_LEGAL = /^[A-Za-z0-9_-]+$/;


const bloc = (titre, cle) => {
  const liste = categories[cle];
  const lignes = [`    # ${titre}`, `    [assets.${cle}]`];
  for (const { nom, chemin } of liste.sort((a, b) => a.nom.localeCompare(b.nom))) {
    lignes.push(`        ${cleToml(nom)} = "${chemin}"`);
  }
  lignes.push("");
  return lignes.join("\n");
};

const toml = `# ══════════════════════════════════════════════════════════════════════════════
# GÉNÉRÉ par scripts/nanos-build-asset-pack.mjs — ne pas éditer à la main.
# Régénérer après tout réimport ou recook : les noms exposés ici sont ceux que
# le Lua utilise (narvos::<nom>), et une entrée périmée échoue au chargement.
# ══════════════════════════════════════════════════════════════════════════════

# vault configurations
[meta]
    # friendly name
    title =                 "NARVOS PRIME — personnages"
    # contributors
    author =                "aniss"
    # version
    version =               "0.1.0"

# asset pack configurations
[asset_pack]
    # asset packs requirements
    assets_requirements = [

    ]

# unreal engine configurations
[unreal]
    # ⚠ Nom EXACT du dossier tel qu'il était sous Content/ dans Unreal. C'est lui
    # qui garde valides les références relatives entre assets — s'en écarter
    # casse matériaux et textures sans message d'erreur.
    unreal_folders = [
        "${DOSSIER_UNREAL}"
    ]
    # ⚠ Version RÉELLE du moteur qui a cuit, lue dans Engine/Build/Build.version.
    # nanos compare ce nombre à sa propre version et REFUSE le pack s'il ne
    # figure pas dans sa liste de compatibilité — le 5.7.0 du gabarit officiel
    # est justement hors de cette liste.
    unreal_version =        "${versionMoteur()}"
    # whether this asset pack was created as a plugin content
    is_plugin_content =     false

# assets files
[assets]
${bloc("maps", "maps")}
${bloc("static meshes", "static_meshes")}
${bloc("skeletal meshes", "skeletal_meshes")}
${bloc("sounds", "sounds")}
${bloc("animations", "animations")}
${bloc("particles", "particles")}
${bloc("materials", "materials")}
${bloc("blueprints", "blueprints")}
${bloc("other assets", "others")}`;

// ─── relecture du TOML avant de l'écrire ──────────────────────────────────────
//
// ⚠ CE CONTRÔLE EXISTE PARCE QUE LE FICHIER A DÉJÀ ÉTÉ LIVRÉ INVALIDE.
//
// Le 2026-09-04, 26 animations nommées `M_Neutral_AO_Crouch_X+135_Y+90` ont
// rendu le manifeste ENTIER illisible — une clé nue TOML n'admet que
// `A-Za-z0-9_-`. Le serveur a répondu :
//
//   Failed to load Asset Pack 'narvos'. Reason:
//   toml::parse_key_value_pair: invalid key value separator `=`
//
// 12 441 assets perdus pour 26 noms. Et rien ne l'annonçait avant le serveur :
// ce script sortait en code 0, l'inventaire donnait les bons comptes, et le
// vérificateur de catalogues lit le TOML à la ligne, jamais avec un analyseur.
//
// Le filtre porte sur la FORME du défaut — « une ligne de clé/valeur qui ne
// parserait pas » — et non sur le caractère `+` du premier incident.
// Clé NUE uniquement : une clé quotée passerait notre analyse et ne survivrait
// pas au premier démarrage du serveur (voir `cleToml`).
const LIGNE_VALIDE = /^ {8}[A-Za-z0-9_-]+ = "[^"]*"$/;
const malformees = toml
  .split("\n")
  .map((l, i) => [i + 1, l])
  // `l.includes(' = ')` écarte les ÉLÉMENTS DE TABLEAU, indentés pareil mais
  // sans affectation — `unreal_folders` en contient, et les prendre pour des
  // clés faisait échouer le build sur `"Narvos",`.
  .filter(([, l]) => l.startsWith("        ") && l.includes(' = ') && !LIGNE_VALIDE.test(l));

if (malformees.length > 0) {
  console.error(`\n  ${malformees.length} ligne(s) de clé/valeur INVALIDE(S) — rien écrit :`);
  for (const [n, l] of malformees.slice(0, 10)) console.error(`    ${n}: ${l.trim()}`);
  const coupables = [...new Set(malformees.map(([, l]) => l.trim().split(" = ")[0]))];
  console.error(`\n  ${coupables.length} nom(s) d'asset illégal(aux) en clé TOML nue :`);
  for (const n of coupables.slice(0, 30)) {
    console.error(`    ${n}   ->   ${n.replace(/\+/g, "")}`);
  }
  console.error("\n  nanos refuserait le pack ENTIER — et quoter ne sert à rien :");
  console.error("  il réécrit Assets.toml au démarrage, sans quotes. RENOMMER les assets");
  console.error("  dans l'ADK (`rename_asset`), puis recuire.");
  process.exit(1);
}

// ── Deuxième refus : une clé écrite DEUX FOIS dans la même section ───────────
//
// Le contrôle précédent ne regarde que la FORME de chaque ligne. Deux lignes
// parfaitement formées peuvent porter la même clé — et nanos refuse le pack
// entier, exactement comme pour un caractère illégal :
//
//   ERROR  Failed to load Asset Pack 'narvos'. Reason: 'toml::insert_value:
//          failed to insert a value, value already exists'
//   ERROR  Invalid Map Asset 'narvos::Map_Narvos'! Could not find Asset Pack!
//
// Vécu le 2026-09-08 : 2 clés en double sur 64 403 ont coûté les 64 403, et
// aucun contrôle du dépôt ne les voyait. Le premier lancement du serveur, lui,
// les a vues en quatre secondes.
//
// ⚠ Ce contrôle reste utile MÊME AVEC la boucle de désambiguïsation corrigée
// plus haut. Un garde-fou qui ne garde que contre la cause connue ne garde
// rien : on vérifie ici le RÉSULTAT — « nanos peut-il parser ce fichier » —
// pas la mécanique qui l'a produit.
{
  // Cle composite `section|cle` : deux sections peuvent legitimement porter le
  // meme nom d'asset, TOML ne l'interdit qu'a l'interieur d'une meme table.
  const vues = new Map();   // "section|cle" -> premier numero de ligne
  const doublons = [];
  let section = null;

  toml.split("\n").forEach((l, i) => {
    const s = l.trim();
    if (s.startsWith("[")) { section = s; return; }
    if (!section || !l.startsWith("        ") || !l.includes(" = ")) return;
    const cle = s.split(" = ")[0];
    const id = `${section}|${cle}`;
    if (vues.has(id)) doublons.push([section, cle, vues.get(id), i + 1]);
    else vues.set(id, i + 1);
  });

  if (doublons.length > 0) {
    console.error(`\n  ${doublons.length} cle(s) EN DOUBLE — rien ecrit :`);
    for (const [sec, cle, a, b] of doublons.slice(0, 20)) {
      console.error(`    ${sec}  ${cle}`);
      console.error(`      lignes ${a} et ${b}`);
    }
    console.error("\n  nanos refuserait le pack ENTIER. Deux assets portent le meme nom");
    console.error("  apres desambiguisation — verifier la boucle `nomsPris` ci-dessus.");
    process.exit(1);
  }

  console.log(`  ${vues.size} cle(s) uniques verifiees, aucun doublon`);
}

fs.writeFileSync(path.join(destination, "Assets.toml"), toml);

// ─── vérification ─────────────────────────────────────────────────────────────

const compter = (dir) => {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += compter(path.join(dir, e.name));
    else n++;
  }
  return n;
};

console.log("");
console.log("Vérification :");
console.log(`  ${compter(destinationUnreal)} fichier(s) copiés dans ${PACK}/${DOSSIER_UNREAL}/`);
console.log(`  Assets.toml : ${(fs.statSync(path.join(destination, "Assets.toml")).size / 1024).toFixed(1)} ko`);
console.log("");
console.log("Ensuite :");
console.log(`  1. ajouter "${PACK}" aux assets_requirements du package Lua narvos`);
console.log(`  2. ajouter "${PACK}" aux [game] assets de Config.toml`);
console.log(`  3. remplacer les nanos-world::SK_* de Character.lua par ${PACK}::<nom>`);