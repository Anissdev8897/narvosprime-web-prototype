// ══════════════════════════════════════════════════════════════════════════════
// animation/humanoidBones.ts — SQUELETTE HUMANOÏDE CANONIQUE (hub de conversion)
//
// POURQUOI un hub plutôt que des paires :
// Le projet mélange plusieurs conventions de nommage d'os — Meshy/Mixamo
// ("Hips", "LeftArm"), UE4/UE5 Paragon ("pelvis", "upperarm_l"), et demain
// d'autres packs. Une table d'alias deux-à-deux demande N² entrées pour N
// conventions. En passant par un EMPLACEMENT canonique intermédiaire, il n'en
// faut que N : chaque convention se déclare une fois face au canon.
//
//   os source ──► emplacement canonique ──► os cible
//   "LeftArm"        leftUpperArm            "upperarm_l"
//
// Le vocabulaire d'emplacements reprend celui du standard VRM (repris tel quel
// par le plugin UniGLB/VRM4U), qui est la référence de fait pour l'échange
// d'animation humanoïde.
//
// ⚠ CE MODULE NE TOUCHE À AUCUNE GÉOMÉTRIE. Il ne fait que traduire des NOMS.
// Les sommets, les poids d'influence et les poses de bind restent intacts —
// c'est précisément ce qui rend l'opération non destructive. Deux personnages
// aux proportions différentes ne peuvent PAS partager un même jeu de
// transformations d'os ; ils peuvent en revanche partager un vocabulaire, ce
// qui rend leurs animations interchangeables.
// ══════════════════════════════════════════════════════════════════════════════

/** Emplacement humanoïde canonique (vocabulaire VRM). */
export type HumanoidSlot =
  | "hips" | "spine" | "chest" | "upperChest" | "neck" | "head"
  | "leftShoulder" | "leftUpperArm" | "leftLowerArm" | "leftHand"
  | "rightShoulder" | "rightUpperArm" | "rightLowerArm" | "rightHand"
  | "leftUpperLeg" | "leftLowerLeg" | "leftFoot" | "leftToes"
  | "rightUpperLeg" | "rightLowerLeg" | "rightFoot" | "rightToes"
  | "leftThumbProximal" | "leftThumbIntermediate" | "leftThumbDistal"
  | "leftIndexProximal" | "leftIndexIntermediate" | "leftIndexDistal"
  | "leftMiddleProximal" | "leftMiddleIntermediate" | "leftMiddleDistal"
  | "leftRingProximal" | "leftRingIntermediate" | "leftRingDistal"
  | "leftLittleProximal" | "leftLittleIntermediate" | "leftLittleDistal"
  | "rightThumbProximal" | "rightThumbIntermediate" | "rightThumbDistal"
  | "rightIndexProximal" | "rightIndexIntermediate" | "rightIndexDistal"
  | "rightMiddleProximal" | "rightMiddleIntermediate" | "rightMiddleDistal"
  | "rightRingProximal" | "rightRingIntermediate" | "rightRingDistal"
  | "rightLittleProximal" | "rightLittleIntermediate" | "rightLittleDistal";

/**
 * Parent canonique de chaque emplacement humanoïde.
 *
 * Sert au REPLI D'ANCÊTRE : quand un squelette d'accueil ne possède pas
 * l'emplacement demandé, on remonte la chaîne jusqu'à en trouver un qu'il a.
 *
 * ── POURQUOI ─────────────────────────────────────────────────────────────────
 *
 * Les rigs n'ont pas tous la même densité. Le mannequin UE5 a `spine_01..05`,
 * Quaternius `spine_01..03`, un rig Mixamo `Spine..Spine2`. Sans repli, un
 * sommet pesé sur `spine_04` voit son influence ANNULÉE : il cesse de suivre le
 * torse et s'effondre. Avec repli, il suit `spine_03` — approximatif, mais
 * anatomiquement juste et visuellement correct.
 *
 * Mesuré le 03/08/2026 : sur le corps Quaternius (65 os), 19 de nos 39 pièces
 * étaient refusées faute de ces os intermédiaires.
 *
 * ⚠ `hips` n'a pas de parent : c'est la racine de la chaîne. Un os qui n'y
 * remonte pas reste non apparié, et c'est le bon comportement — il n'appartient
 * pas à l'anatomie humanoïde.
 */
export const HUMANOID_PARENT: Partial<Record<HumanoidSlot, HumanoidSlot>> = {
  head: "neck", neck: "upperChest", upperChest: "chest", chest: "spine", spine: "hips",

  leftShoulder: "upperChest", leftUpperArm: "leftShoulder",
  leftLowerArm: "leftUpperArm", leftHand: "leftLowerArm",
  rightShoulder: "upperChest", rightUpperArm: "rightShoulder",
  rightLowerArm: "rightUpperArm", rightHand: "rightLowerArm",

  leftUpperLeg: "hips", leftLowerLeg: "leftUpperLeg", leftFoot: "leftLowerLeg", leftToes: "leftFoot",
  rightUpperLeg: "hips", rightLowerLeg: "rightUpperLeg", rightFoot: "rightLowerLeg", rightToes: "rightFoot",

  leftThumbProximal: "leftHand", leftThumbIntermediate: "leftThumbProximal", leftThumbDistal: "leftThumbIntermediate",
  leftIndexProximal: "leftHand", leftIndexIntermediate: "leftIndexProximal", leftIndexDistal: "leftIndexIntermediate",
  leftMiddleProximal: "leftHand", leftMiddleIntermediate: "leftMiddleProximal", leftMiddleDistal: "leftMiddleIntermediate",
  leftRingProximal: "leftHand", leftRingIntermediate: "leftRingProximal", leftRingDistal: "leftRingIntermediate",
  leftLittleProximal: "leftHand", leftLittleIntermediate: "leftLittleProximal", leftLittleDistal: "leftLittleIntermediate",

  rightThumbProximal: "rightHand", rightThumbIntermediate: "rightThumbProximal", rightThumbDistal: "rightThumbIntermediate",
  rightIndexProximal: "rightHand", rightIndexIntermediate: "rightIndexProximal", rightIndexDistal: "rightIndexIntermediate",
  rightMiddleProximal: "rightHand", rightMiddleIntermediate: "rightMiddleProximal", rightMiddleDistal: "rightMiddleIntermediate",
  rightRingProximal: "rightHand", rightRingIntermediate: "rightRingProximal", rightRingDistal: "rightRingIntermediate",
  rightLittleProximal: "rightHand", rightLittleIntermediate: "rightLittleProximal", rightLittleDistal: "rightLittleIntermediate",
};

/**
 * Remonte la chaîne humanoïde jusqu'au premier emplacement présent dans
 * `available`. Renvoie `null` si aucun ancêtre n'est disponible.
 */
export function nearestAvailableAncestor(
  slot: HumanoidSlot,
  available: ReadonlySet<HumanoidSlot> | Map<HumanoidSlot, unknown>,
): HumanoidSlot | null {
  const has = (s: HumanoidSlot) =>
    available instanceof Map ? available.has(s) : available.has(s);

  // Garde anti-boucle : une table mal éditée qui ferait `chest → chest`
  // bloquerait le chargement sans le moindre message.
  const vus = new Set<HumanoidSlot>([slot]);
  let cur = HUMANOID_PARENT[slot];
  while (cur && !vus.has(cur)) {
    if (has(cur)) return cur;
    vus.add(cur);
    cur = HUMANOID_PARENT[cur];
  }
  return null;
}

/** Forme canonique d'un nom d'os : sans préfixe "mixamorig", minuscule, sans
 *  séparateurs. "mixamorig:LeftArm" · "Left_Arm" · "leftarm" → "leftarm". */
export function normalizeBoneName(name: string): string {
  return name.replace(/^mixamorig:?/i, "").replace(/[\s_.:-]/g, "").toLowerCase();
}

// ── Convention UE4/UE5 mannequin (Paragon, BikerBundle, ZombieSoldierPack) ───
// Portée depuis UniGLBUtil::table_ue4_vrm. Les os SANS équivalent humanoïde
// (torsion, IK) sont volontairement absents : ils ne doivent recevoir aucune
// piste retargetée, mais restent présents sur le rig.
const UE_BONES: Record<string, HumanoidSlot> = {
  pelvis: "hips", spine01: "spine", spine02: "chest", spine03: "upperChest",
  // ── UE5 : cinq vertèbres, pas trois (mesuré le 03/08/2026) ────────────────
  // Cette table décrivait le mannequin UE4. Le mannequin UE5 du projet a
  // `spine_01..05` et `neck_01/02` : `spine_04`, `spine_05` et `neck_02`
  // n'avaient donc AUCUN emplacement humanoïde, et le remappage à deux sauts
  // ne démarrait même pas pour eux. Conséquence mesurée : sur un corps
  // Quaternius (3 vertèbres), tout le poids porté par le haut du dos était
  // annulé et 19 de nos 39 pièces refusées.
  //
  // Les deux dernières vertèbres partagent `upperChest`. La table est indexée
  // premier-arrivé, donc côté CIBLE c'est `spine_03` qui garde l'emplacement —
  // exactement l'os sur lequel on veut que le haut du dos retombe.
  spine04: "upperChest", spine05: "upperChest",
  neck01: "neck", neck02: "neck", head: "head",
  claviclel: "leftShoulder", upperarml: "leftUpperArm", lowerarml: "leftLowerArm", handl: "leftHand",
  clavicler: "rightShoulder", upperarmr: "rightUpperArm", lowerarmr: "rightLowerArm", handr: "rightHand",
  thighl: "leftUpperLeg", calfl: "leftLowerLeg", footl: "leftFoot", balll: "leftToes",
  thighr: "rightUpperLeg", calfr: "rightLowerLeg", footr: "rightFoot", ballr: "rightToes",
  thumb01l: "leftThumbProximal", thumb02l: "leftThumbIntermediate", thumb03l: "leftThumbDistal",
  index01l: "leftIndexProximal", index02l: "leftIndexIntermediate", index03l: "leftIndexDistal",
  middle01l: "leftMiddleProximal", middle02l: "leftMiddleIntermediate", middle03l: "leftMiddleDistal",
  ring01l: "leftRingProximal", ring02l: "leftRingIntermediate", ring03l: "leftRingDistal",
  pinky01l: "leftLittleProximal", pinky02l: "leftLittleIntermediate", pinky03l: "leftLittleDistal",
  thumb01r: "rightThumbProximal", thumb02r: "rightThumbIntermediate", thumb03r: "rightThumbDistal",
  index01r: "rightIndexProximal", index02r: "rightIndexIntermediate", index03r: "rightIndexDistal",
  middle01r: "rightMiddleProximal", middle02r: "rightMiddleIntermediate", middle03r: "rightMiddleDistal",
  ring01r: "rightRingProximal", ring02r: "rightRingIntermediate", ring03r: "rightRingDistal",
  pinky01r: "rightLittleProximal", pinky02r: "rightLittleIntermediate", pinky03r: "rightLittleDistal",
};

// ── Convention Meshy / Mixamo (PNJ du projet, packs d'animation) ─────────────
// "spine1"/"spine2" chez Mixamo correspondent à chest/upperChest chez UE.
const MIXAMO_BONES: Record<string, HumanoidSlot> = {
  // Mixamo écrit "Spine1"/"Spine2" ; les rigs Meshy du projet écrivent
  // "Spine01"/"Spine02" (mesuré sur soldat_humain). Les deux graphies sont
  // nécessaires — sans "spine01" ici, la chaîne dorsale Meshy tombe à l'eau.
  hips: "hips", spine: "spine",
  spine1: "chest", spine01: "chest",
  spine2: "upperChest", spine02: "upperChest",
  neck: "neck", head: "head",
  leftshoulder: "leftShoulder", leftarm: "leftUpperArm", leftforearm: "leftLowerArm", lefthand: "leftHand",
  rightshoulder: "rightShoulder", rightarm: "rightUpperArm", rightforearm: "rightLowerArm", righthand: "rightHand",
  leftupleg: "leftUpperLeg", leftleg: "leftLowerLeg", leftfoot: "leftFoot", lefttoebase: "leftToes",
  rightupleg: "rightUpperLeg", rightleg: "rightLowerLeg", rightfoot: "rightFoot", righttoebase: "rightToes",
  lefthandthumb1: "leftThumbProximal", lefthandthumb2: "leftThumbIntermediate", lefthandthumb3: "leftThumbDistal",
  lefthandindex1: "leftIndexProximal", lefthandindex2: "leftIndexIntermediate", lefthandindex3: "leftIndexDistal",
  lefthandmiddle1: "leftMiddleProximal", lefthandmiddle2: "leftMiddleIntermediate", lefthandmiddle3: "leftMiddleDistal",
  lefthandring1: "leftRingProximal", lefthandring2: "leftRingIntermediate", lefthandring3: "leftRingDistal",
  lefthandpinky1: "leftLittleProximal", lefthandpinky2: "leftLittleIntermediate", lefthandpinky3: "leftLittleDistal",
  righthandthumb1: "rightThumbProximal", righthandthumb2: "rightThumbIntermediate", righthandthumb3: "rightThumbDistal",
  righthandindex1: "rightIndexProximal", righthandindex2: "rightIndexIntermediate", righthandindex3: "rightIndexDistal",
  righthandmiddle1: "rightMiddleProximal", righthandmiddle2: "rightMiddleIntermediate", righthandmiddle3: "rightMiddleDistal",
  righthandring1: "rightRingProximal", righthandring2: "rightRingIntermediate", righthandring3: "rightRingDistal",
  righthandpinky1: "rightLittleProximal", righthandpinky2: "rightLittleIntermediate", righthandpinky3: "rightLittleDistal",
};

// ── Convention VRM native (noms d'emplacement utilisés tels quels comme os) ──
const VRM_BONES: Record<string, HumanoidSlot> = {};
for (const slot of Object.values(MIXAMO_BONES)) VRM_BONES[slot.toLowerCase()] = slot;

/** Toutes les conventions connues, testées dans l'ordre. */
const CONVENTIONS: Record<string, HumanoidSlot>[] = [UE_BONES, MIXAMO_BONES, VRM_BONES];

/**
 * COLLISION DE NOMS ENTRE CONVENTIONS — cas mesuré et corrigé.
 *
 * `normalizeBoneName` supprime les séparateurs, donc l'os Meshy "Spine01"
 * devient "spine01"… qui est aussi la clé UE de `spine_01`. Comme UE_BONES est
 * testé en premier, "Spine01" (= chest chez Meshy) était résolu en "spine".
 * Résultat : "Spine" ET "Spine01" visaient le même os `spine_01`, et `spine_03`
 * ne recevait plus aucune piste — le torse se figeait.
 *
 * Ces noms sont donc traités par la convention du squelette D'ORIGINE, déduite
 * d'un marqueur non ambigu.
 */
const AMBIGUOUS = new Set(["spine01", "spine02", "spine03"]);

/** Marqueurs exclusifs d'une convention (aucun rig ne porte les deux). */
const UE_MARKERS = ["pelvis", "thighl", "thighr", "upperarml", "clavicler"];
const MIXAMO_MARKERS = ["hips", "leftupleg", "rightupleg", "leftarm", "leftforearm"];

/** Convention d'un squelette, déduite de ses marqueurs. */
export function detectConvention(boneNames: Iterable<string>): "UE" | "MIXAMO" | "UNKNOWN" {
  let ue = 0, mx = 0;
  for (const n of boneNames) {
    const k = normalizeBoneName(n);
    if (UE_MARKERS.includes(k)) ue++;
    if (MIXAMO_MARKERS.includes(k)) mx++;
  }
  if (ue > mx) return "UE";
  if (mx > ue) return "MIXAMO";
  return "UNKNOWN";
}

/**
 * Emplacement humanoïde d'un os, quelle que soit sa convention.
 * `null` = os hors squelette humanoïde (torsion, IK, sac à dos, muscle, tissu…)
 * → il doit garder son nom et ne recevoir aucune piste retargetée.
 *
 * @param convention convention du squelette d'origine. À fournir dès qu'elle est
 *   connue : elle seule permet de trancher les noms ambigus (spine01/02/03).
 */
export function humanoidSlotOf(
  boneName: string,
  convention: "UE" | "MIXAMO" | "UNKNOWN" = "UNKNOWN",
): HumanoidSlot | null {
  const n = normalizeBoneName(boneName);
  if (AMBIGUOUS.has(n)) {
    if (convention === "MIXAMO") return MIXAMO_BONES[n] ?? null;
    if (convention === "UE") return UE_BONES[n] ?? null;
    // Convention inconnue : on ne devine pas. Le repli par nom exact de
    // remapOne reste disponible et vaut mieux qu'un mauvais os.
    return null;
  }
  for (const table of CONVENTIONS) {
    const slot = table[n];
    if (slot) return slot;
  }
  return null;
}

/**
 * Indexe un squelette par emplacement humanoïde : emplacement → nom RÉEL de l'os.
 *
 * Le 1er os gagne en cas de doublon — les rigs exportés depuis UE portent parfois
 * un os de mesh homonyme après le vrai os. C'est la même précaution que le
 * suffixe `_renamed_uniglb` côté UniGLB, en moins destructif : on ne renomme
 * rien, on ignore simplement le doublon.
 */
export function indexSkeletonBySlot(boneNames: Iterable<string>): Map<HumanoidSlot, string> {
  const names = [...boneNames];
  // La convention est déduite du squelette LUI-MÊME, ce qui lève l'ambiguïté
  // spine01/02/03 sans que l'appelant ait à la connaître.
  const conv = detectConvention(names);
  const out = new Map<HumanoidSlot, string>();
  for (const name of names) {
    const slot = humanoidSlotOf(name, conv);
    if (slot && !out.has(slot)) out.set(slot, name);
  }
  return out;
}

/** Nombre d'emplacements canoniques (sert aux diagnostics de couverture). */
export const HUMANOID_SLOT_COUNT = new Set(Object.values(MIXAMO_BONES)).size;
