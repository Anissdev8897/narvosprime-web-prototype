// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/bodySlots.ts — Taxonomie des emplacements de personnage.
//
// Un personnage modulaire = UN squelette + N pièces, une par emplacement.
// Chaque emplacement n'accepte qu'une pièce à la fois ; certaines pièces en
// MASQUENT d'autres (des gants remplacent les mains nues, un casque intégral
// remplace les cheveux) — d'où `SLOT_HIDES`.
//
// ── DEUX COUCHES, JAMAIS LE MÊME EMPLACEMENT (02/08/2026) ────────────────────
//
// `torso`, `legs` et `feet` désignaient les VÊTEMENTS (« veste, chemise »,
// « pantalon », « bottes »). Quand le découpeur a commencé à produire des torses
// et des jambes NUS, ils ont atterri dans ces mêmes emplacements : un blouson de
// cuir et le buste de Wraith se disputaient une seule case, et équiper l'un
// effaçait l'autre.
//
// Les deux couches sont donc désormais distinctes :
//
//   ANATOMIE   head · hair · beard · torso · arms · hands · legs · feet
//   VÊTEMENTS  top  · pants · shoes · gloves · headwear · eyewear
//   ACCESSOIRE back · accessory
//
// `body` reste à part : c'est le corps de base complet fourni par l'archétype
// (cf. `bodyArchetypes.ts`), que les pièces d'anatomie viennent remplacer
// région par région.
// ══════════════════════════════════════════════════════════════════════════════

/** Emplacement d'équipement/anatomie sur le personnage. */
export type BodySlot =
  // ── Anatomie ──────────────────────────────────────────────────────────────
  | "body"        // corps de base complet (archétype + morphologie)
  | "head"        // tête / visage
  | "hair"
  | "beard"
  | "torso"       // buste NU
  | "arms"
  | "hands"
  | "legs"        // jambes NUES
  | "feet"        // pieds NUS
  // ── Vêtements ─────────────────────────────────────────────────────────────
  | "top"         // veste, chemise, débardeur, armure de buste
  | "pants"       // pantalon, jambières
  | "shoes"       // bottes, chaussures
  | "gloves"
  | "headwear"    // casque, bandana, chapeau
  | "eyewear"
  // ── Accessoires ───────────────────────────────────────────────────────────
  | "back"        // sac à dos, cape, ailes
  | "accessory";  // bracelet, bague, ceinture

/** Regroupement de haut niveau — c'est le premier niveau de choix dans l'UI. */
export type SlotCategory = "anatomy" | "clothing" | "accessory";

export const SLOT_CATEGORY: Record<BodySlot, SlotCategory> = {
  body: "anatomy", head: "anatomy", hair: "anatomy", beard: "anatomy",
  torso: "anatomy", arms: "anatomy", hands: "anatomy", legs: "anatomy", feet: "anatomy",
  top: "clothing", pants: "clothing", shoes: "clothing",
  gloves: "clothing", headwear: "clothing", eyewear: "clothing",
  back: "accessory", accessory: "accessory",
};

export const CATEGORY_ORDER: SlotCategory[] = ["anatomy", "clothing", "accessory"];

export const CATEGORY_LABELS: Record<SlotCategory, string> = {
  anatomy: "Corps",
  clothing: "Vêtements",
  accessory: "Accessoires",
};

/** Ordre d'assemblage : anatomie d'abord, vêtements par-dessus, accessoires en dernier. */
export const SLOT_ORDER: BodySlot[] = [
  "body", "head", "torso", "arms", "hands", "legs", "feet",
  "hair", "beard",
  "pants", "shoes", "top", "gloves",
  "headwear", "eyewear", "back", "accessory",
];

/**
 * Emplacements masqués quand une pièce occupe l'emplacement clé.
 *
 * Un vêtement recouvre l'anatomie qu'il habille : laisser les deux produirait du
 * z-fighting là où le tissu épouse la peau. C'est exactement ce que le cahier
 * des charges appelle « les vêtements viennent se superposer au corps » — la
 * superposition est visuelle, pas géométrique.
 */
export const SLOT_HIDES: Partial<Record<BodySlot, BodySlot[]>> = {
  gloves: ["hands"],
  shoes: ["feet"],
  pants: ["legs"],
  // Un haut couvre le buste, mais PAS les bras : un débardeur laisse les bras
  // nus. Les manches sont une propriété de la pièce, pas du slot — une veste
  // longue déclarera `arms` dans `hidesExtra` (cf. `ModularPart`).
  top: ["torso"],
  headwear: ["hair"],
};

/** Libellés FR pour l'UI de création. */
export const SLOT_LABELS: Record<BodySlot, string> = {
  body: "Corps", head: "Tête", hair: "Cheveux", beard: "Barbe",
  torso: "Buste", arms: "Bras", hands: "Mains", legs: "Jambes", feet: "Pieds",
  top: "Haut", pants: "Pantalon", shoes: "Chaussures", gloves: "Gants",
  headwear: "Casque", eyewear: "Lunettes",
  back: "Dos", accessory: "Accessoire",
};

/**
 * Titres des carrousels du créateur — plus explicites que `SLOT_LABELS`.
 *
 * Deux jeux de libellés parce que les deux endroits n'ont pas la même place ni
 * le même rôle : le rail latéral est étroit et sert à NAVIGUER (« Buste »), le
 * carrousel est large et doit dire ce qu'on y choisit (« Anatomie du buste »).
 * Un libellé unique obligerait à sacrifier l'un des deux.
 *
 * Un emplacement absent d'ici retombe sur `SLOT_LABELS` — ajouter un slot ne
 * peut donc pas produire de titre vide.
 */
export const SLOT_CAROUSEL_LABELS: Partial<Record<BodySlot, string>> = {
  head: "Têtes et cheveux",
  hair: "Coiffures",
  beard: "Pilosité faciale",
  torso: "Anatomie du buste",
  arms: "Structure des épaules et bras",
  hands: "Types de mains",
  legs: "Anatomie des jambes",
  feet: "Anatomie des pieds",
  body: "Corps de base",
};

/** Titre du carrousel d'un emplacement, avec repli sur le libellé court. */
export function carouselLabel(slot: BodySlot): string {
  return SLOT_CAROUSEL_LABELS[slot] ?? SLOT_LABELS[slot];
}

/**
 * Anciens noms d'emplacement → nouveaux. Les personnages sauvegardés avant la
 * séparation anatomie/vêtements référencent `torso` pour une veste ; sans cette
 * table, leur tenue se retrouverait rangée dans l'anatomie et remplacerait un
 * buste nu.
 */
export const LEGACY_SLOT_MIGRATION: Record<string, BodySlot> = {
  torso: "top",
  legs: "pants",
  feet: "shoes",
};

/**
 * Emplacements dont l'absence laisserait un trou visible dans le personnage.
 *
 * ── Pourquoi `head` N'Y EST PAS (mesuré le 02/08/2026) ───────────────────────
 *
 * `head` y avait été ajouté pour empêcher un personnage sans tête. La mesure
 * montre que le trou n'existe pas : les corps du pack sont COMPLETS.
 *
 *   mesh          sommets   skinnés sur l'os `head`   skinnés « mains »
 *   m_body         17 306          43 %                    15 %
 *   f_body         18 026          50 %                    21 %
 *   m_head_01       8 053          93 %                     0 %
 *   m_hands         2 801           0 %                   100 %
 *
 * Les deux corps portent déjà la géométrie de tête (et de mains). `head`,
 * `hands` et `arms` sont donc des slots de VARIANTE — un autre visage, d'autres
 * mains — pas des pièces qui comblent une absence.
 */
export const REQUIRED_SLOTS: BodySlot[] = ["body"];

/** Emplacements d'une catégorie, dans l'ordre d'assemblage. */
export function slotsInCategory(category: SlotCategory): BodySlot[] {
  return SLOT_ORDER.filter((s) => SLOT_CATEGORY[s] === category);
}

// ── OÙ SE RÈGLE UN EMPLACEMENT (03/08/2026) ──────────────────────────────────
//
// Le créateur de personnage ne règle plus QUE l'anatomie : ce qu'un joueur EST.
// Casques, plastrons, gants, bottes, sacs — ce qu'il PORTE — s'achètent chez un
// marchand en jeu. Le personnage démarre avec la tenue de départ seule
// (`starterOutfit`), qui reste équipée mais n'est pas modifiable à la création.
//
// Pourquoi la distinction est ici et pas dans l'UI : trois écrans consomment
// déjà cette taxonomie (créateur, inventaire, forge). Laisser chacun décider par
// lui-même de ce qui est « équipement » les ferait diverger au premier ajout de
// slot — c'est déjà arrivé avec `torso` (cf. l'entête de ce fichier).

/** Où se règle un emplacement : à la création du personnage, ou en jeu. */
export type SlotSource = "creator" | "merchant";

/**
 * Anatomie → créateur. Vêtements et accessoires → marchand.
 *
 * Dérivé de `SLOT_CATEGORY` plutôt que réécrit à la main : une nouvelle entrée
 * dans la taxonomie ne peut pas être oubliée ici.
 */
export function slotSource(slot: BodySlot): SlotSource {
  return SLOT_CATEGORY[slot] === "anatomy" ? "creator" : "merchant";
}

/** Emplacements réglables dans le créateur de personnage, dans l'ordre. */
export const CREATOR_SLOTS: BodySlot[] = SLOT_ORDER.filter((s) => slotSource(s) === "creator");

/** Emplacements qui s'obtiennent en jeu (marchand, butin), dans l'ordre. */
export const MERCHANT_SLOTS: BodySlot[] = SLOT_ORDER.filter((s) => slotSource(s) === "merchant");

// ── LES TROIS ONGLETS DE L'ÉDITEUR ───────────────────────────────────────────
//
// `SlotCategory` dit ce qu'une pièce EST (anatomie / vêtement / accessoire).
// `EditorTab` dit OÙ on la règle. Les deux ne se confondent pas : l'anatomie se
// répartit sur DEUX onglets, parce que choisir un gabarit de corps et choisir un
// visage ne sont pas le même geste.
//
//   CORPS      le mannequin nu lui-même — gabarit, morphologie, teintes.
//              Un seul emplacement : `body`. C'est la base modulaire sur
//              laquelle tout le reste vient se poser.
//   CRÉATION   les variantes d'anatomie — tête, cheveux, buste, bras, mains…
//              Elles REMPLACENT une région du corps de base, elles ne s'ajoutent
//              pas (cf. la mesure dans `REQUIRED_SLOTS` : les corps sont déjà
//              complets, ces pièces sont des variantes, pas des rustines).
//   MARCHAND   ce que le personnage PORTE. Vêtements et accessoires, issus des
//              personnages découpés. Visible ici pour l'essayage, mais ce n'est
//              pas de la création de personnage : en jeu ça s'achète.
//
// La table est DÉRIVÉE de `slotSource` et `REQUIRED_SLOTS`, jamais réécrite à la
// main — un nouvel emplacement dans la taxonomie tombe automatiquement dans le
// bon onglet, et ne peut pas être oublié.

export type EditorTab = "corps" | "creation" | "marchand";

export const EDITOR_TABS: EditorTab[] = ["corps", "creation", "marchand"];

export const EDITOR_TAB_LABELS: Record<EditorTab, string> = {
  corps: "Corps",
  creation: "Création",
  marchand: "Marchand",
};

/**
 * Anatomie désormais couverte par la MORPHOLOGIE CONTINUE — retirée du créateur.
 *
 * ── LE DOUBLON QU'ON SUPPRIME (10/08/2026) ──────────────────────────────────
 *
 * Deux systèmes répondaient à la même question — « à quoi ressemble ce corps ? »
 * — par deux mécanismes incompatibles :
 *
 *   onglet Corps      1 maillage + 1 250 cibles MakeHuman → 199 curseurs continus
 *   onglet Création   pièces découpées, variantes DISCRÈTES
 *
 * Mesuré : sur 103 packs, **2 seulement** sont de vrais corps modulaires
 * interchangeables (`biker_m`, `biker_f`). Choisir un buste parmi deux là où un
 * curseur offre un continuum, c'est offrir moins en paraissant offrir plus — et
 * les deux réglages se contredisaient à l'écran, chacun sur son propre aperçu.
 *
 * ── CE QUI RESTE, ET POURQUOI ───────────────────────────────────────────────
 *
 * `head`, `hair`, `beard` NE SONT PAS des doublons : aucun morph ne fabrique une
 * coiffure ni un maillage de visage différent. Les morphs sculptent le nez, les
 * joues, les oreilles, le menton d'UNE tête ; ils n'en changent pas le modèle.
 *
 * ── RÉVERSIBLE PAR CONSTRUCTION ─────────────────────────────────────────────
 *
 * Vider ce tableau ramène les emplacements dans l'onglet Création à l'identique.
 * Aucune pièce n'a été supprimée du disque ni du catalogue : `partsFor` les rend
 * toujours, `SLOT_HIDES` et l'assemblage les connaissent encore. C'est un
 * retrait d'INTERFACE, pas de contenu — le seul geste sûr sans dépôt git.
 */
export const SLOTS_COUVERTS_PAR_MORPHS: BodySlot[] = [
  "torso", "arms", "hands", "legs", "feet",
];

/** Onglet où se règle un emplacement. `null` = absent du créateur. */
export function tabForSlot(slot: BodySlot): EditorTab | null {
  if (slotSource(slot) === "merchant") return "marchand";
  if (SLOTS_COUVERTS_PAR_MORPHS.includes(slot)) return null;
  return REQUIRED_SLOTS.includes(slot) ? "corps" : "creation";
}

/** Emplacements d'un onglet, dans l'ordre d'assemblage. */
export function slotsInTab(tab: EditorTab): BodySlot[] {
  return SLOT_ORDER.filter((s) => tabForSlot(s) === tab);
}

/**
 * Cet onglet fait-il partie de la CRÉATION de personnage ?
 *
 * Le garde-fou de la règle métier : « les équipements ne doivent pas apparaître
 * dans l'édition de création du personnage ». Ce qu'on sauvegarde comme
 * personnage ne vient que des onglets qui répondent `true` ici — le Marchand
 * sert à essayer, pas à définir qui l'on est.
 */
export function isCreationTab(tab: EditorTab): boolean {
  return tab !== "marchand";
}

/**
 * Résout les emplacements réellement rendus, en appliquant les masquages.
 * Pur → testable sans Three.js.
 */
export function resolveVisibleSlots(equipped: Partial<Record<BodySlot, string>>): BodySlot[] {
  const hidden = new Set<BodySlot>();
  for (const slot of Object.keys(equipped) as BodySlot[]) {
    if (!equipped[slot]) continue;
    for (const h of SLOT_HIDES[slot] ?? []) hidden.add(h);
  }
  return SLOT_ORDER.filter((s) => equipped[s] && !hidden.has(s));
}

/**
 * Traduit une tenue sauvegardée vers la taxonomie courante.
 *
 * N'applique la migration QUE si l'ancien sens est certain : une tenue qui
 * contient déjà `top` vient forcément du nouveau format, et son `torso` est un
 * buste nu qu'il ne faut surtout pas déplacer.
 */
export function migrateLegacyOutfit(
  outfit: Record<string, string | undefined>,
): Partial<Record<BodySlot, string>> {
  const nouveau = "top" in outfit || "pants" in outfit || "shoes" in outfit;
  const out: Partial<Record<BodySlot, string>> = {};
  for (const [slot, id] of Object.entries(outfit)) {
    if (!id) continue;
    const cible = !nouveau && LEGACY_SLOT_MIGRATION[slot] ? LEGACY_SLOT_MIGRATION[slot] : (slot as BodySlot);
    out[cible] = id;
  }
  return out;
}
