// ══════════════════════════════════════════════════════════════════════════════
// animation/emoteRegistry.ts — Catalogue des émotes (animations sociales)
//
// Mappe chaque emoteId à son GLB externe (WW100IdleAnimPack, Blacksmith…),
// son label FR, sa catégorie et son icône. Source de vérité statique.
//
// RÈGLE : aucune animation de gameplay ici (déplacement, combat, idle, saut,
// escalade, nage, visée, rechargement, accroupissement, roulade).
// ══════════════════════════════════════════════════════════════════════════════

export type EmoteCategory =
  | "social"    // saluer, discuter, accepter, refuser
  | "sitting"   // s'asseoir (variantes)
  | "resting"   // dormir, méditer
  | "festive"   // célébrer, danser
  | "working"   // forger, inspecter, polir
  | "leaning"   // s'appuyer (mur, poteau, sangle)
  | "phone";    // téléphone (assis)

export interface EmoteDef {
  id: string;
  label: string;
  category: EmoteCategory;
  /** Chemin GLB relatif à public/ (servi par Vite). */
  glbPath: string;
  /** Icône emoji affichée dans le menu. */
  icon: string;
  /** true = boucle (sit, sleep, lean) ; false = one-shot (saluer, applaudir). */
  loop: boolean;
}

const WW = "/models/animations/WW100IdleAnimPack/Animations/UE4";
const BS = "/models/animations/BlacksmithAnimations/Animations";

export const EMOTE_CATALOG: EmoteDef[] = [
  // ── Social ──────────────────────────────────────────────────────────────────
  { id: "discuss",        label: "Discuter",         category: "social",  icon: "💬", loop: true,  glbPath: `${BS}/Discuss/ANIM_IP_discuss.glb` },
  { id: "discuss_accept", label: "Accepter",         category: "social",  icon: "✅", loop: false, glbPath: `${BS}/Discuss/ANIM_IP_discuss_accept.glb` },
  { id: "discuss_deny",   label: "Refuser",          category: "social",  icon: "❌", loop: false, glbPath: `${BS}/Discuss/ANIM_IP_discuss_denied.glb` },
  { id: "inspect",        label: "Inspecter",        category: "social",  icon: "🔍", loop: false, glbPath: `${BS}/Idle/ANIM_RM_customer_inspect.glb` },
  { id: "test_sword",     label: "Tester l'épée",    category: "social",  icon: "⚔️", loop: false, glbPath: `${BS}/Idle/ANIM_RM_testing_sword.glb` },

  // ── Sitting ─────────────────────────────────────────────────────────────────
  { id: "sit_normal_1",   label: "S'asseoir (1)",    category: "sitting", icon: "🪑", loop: true,  glbPath: `${WW}/AS_Sit_Normal01_Loop01.glb` },
  { id: "sit_normal_2",   label: "S'asseoir (2)",    category: "sitting", icon: "🪑", loop: true,  glbPath: `${WW}/AS_Sit_Normal01_Loop02.glb` },
  { id: "sit_normal_3",   label: "S'asseoir (3)",    category: "sitting", icon: "🪑", loop: true,  glbPath: `${WW}/AS_Sit_Normal03_Loop01.glb` },
  { id: "sit_normal_4",   label: "S'asseoir (4)",    category: "sitting", icon: "🪑", loop: true,  glbPath: `${WW}/AS_Sit_Normal04_Loop01.glb` },
  { id: "sit_normal_5",   label: "S'asseoir (5)",    category: "sitting", icon: "🪑", loop: true,  glbPath: `${WW}/AS_Sit_Normal05_Loop01.glb` },
  { id: "sit_normal_6",   label: "S'asseoir (6)",    category: "sitting", icon: "🪑", loop: true,  glbPath: `${WW}/AS_Sit_Normal06_Loop01.glb` },
  { id: "sit_stretch_1",  label: "S'étirer assis",   category: "sitting", icon: "🙆", loop: false, glbPath: `${WW}/AS_Sit_Normal01_Action01.glb` },
  { id: "sit_stretch_2",  label: "Geste assis (1)",  category: "sitting", icon: "🙆", loop: false, glbPath: `${WW}/AS_Sit_Normal01_Action02.glb` },
  { id: "sit_stretch_3",  label: "Geste assis (2)",  category: "sitting", icon: "🙆", loop: false, glbPath: `${WW}/AS_Sit_Normal01_Action03.glb` },
  { id: "sit_stretch_4",  label: "Geste assis (3)",  category: "sitting", icon: "🙆", loop: false, glbPath: `${WW}/AS_Sit_Normal01_Action04.glb` },
  { id: "sit_blacksmith", label: "Assis atelier",    category: "sitting", icon: "🔨", loop: true,  glbPath: `${BS}/Idle/ANIM_IP_sit_idle_01.glb` },

  // ── Resting ─────────────────────────────────────────────────────────────────
  { id: "sleep_sit_1",    label: "Dormir assis (1)", category: "resting", icon: "😴", loop: true,  glbPath: `${WW}/AS_Sit_Sleep01_Loop01.glb` },
  { id: "sleep_sit_2",    label: "Dormir assis (2)", category: "resting", icon: "😴", loop: true,  glbPath: `${WW}/AS_Sit_Sleep02_Loop01.glb` },
  { id: "sleep_sit_3",    label: "Dormir assis (3)", category: "resting", icon: "😴", loop: true,  glbPath: `${WW}/AS_Sit_Sleep03_Loop01.glb` },
  { id: "sleep_sit_4",    label: "Dormir assis (4)", category: "resting", icon: "😴", loop: true,  glbPath: `${WW}/AS_Sit_Sleep04_Loop01.glb` },
  { id: "sleep_sit_5",    label: "Dormir assis (5)", category: "resting", icon: "💤", loop: true,  glbPath: `${WW}/AS_Sit_Sleep05_Loop01.glb` },
  { id: "sleep_sit_6",    label: "Dormir assis (6)", category: "resting", icon: "💤", loop: true,  glbPath: `${WW}/AS_Sit_Sleep06_Loop01.glb` },
  { id: "sleep_stretch",  label: "Se réveiller",     category: "resting", icon: "🥱", loop: false, glbPath: `${WW}/AS_Sit_Sleep01_Action01.glb` },
  { id: "sleep_yawn",     label: "Bâiller",          category: "resting", icon: "🥱", loop: false, glbPath: `${WW}/AS_Sit_Sleep01_Action02.glb` },
  { id: "sleep_snore",    label: "Ronfler (geste)",  category: "resting", icon: "😴", loop: false, glbPath: `${WW}/AS_Sit_Sleep02_Action01.glb` },

  // ── Phone (sitting) ─────────────────────────────────────────────────────────
  { id: "phone_sit_1",    label: "Téléphone (1)",    category: "phone",   icon: "📱", loop: true,  glbPath: `${WW}/AS_Sit_Phone01_Loop01.glb` },
  { id: "phone_sit_2",    label: "Téléphone (2)",    category: "phone",   icon: "📱", loop: true,  glbPath: `${WW}/AS_Sit_Phone02_Loop01.glb` },
  { id: "phone_sit_3",    label: "Téléphone (3)",    category: "phone",   icon: "📱", loop: true,  glbPath: `${WW}/AS_Sit_Phone03_Loop01.glb` },
  { id: "phone_sit_4",    label: "Téléphone (4)",    category: "phone",   icon: "📱", loop: true,  glbPath: `${WW}/AS_Sit_Phone04_Loop01.glb` },
  { id: "phone_sit_5",    label: "Téléphone (5)",    category: "phone",   icon: "📱", loop: true,  glbPath: `${WW}/AS_Sit_Phone05_Loop01.glb` },
  { id: "phone_sit_6",    label: "Téléphone (6)",    category: "phone",   icon: "📱", loop: true,  glbPath: `${WW}/AS_Sit_Phone06_Loop01.glb` },
  { id: "phone_action_1", label: "Parler au tél.",   category: "phone",   icon: "📞", loop: false, glbPath: `${WW}/AS_Sit_Phone01_Action01.glb` },
  { id: "phone_action_2", label: "Raccrocher",       category: "phone",   icon: "📞", loop: false, glbPath: `${WW}/AS_Sit_Phone01_Action02.glb` },
  { id: "phone_action_3", label: "Envoyer SMS",      category: "phone",   icon: "✉️", loop: false, glbPath: `${WW}/AS_Sit_Phone02_Action01.glb` },
  { id: "phone_action_4", label: "Lire écran",       category: "phone",   icon: "👀", loop: false, glbPath: `${WW}/AS_Sit_Phone02_Action02.glb` },

  // ── Leaning ─────────────────────────────────────────────────────────────────
  { id: "lean_wall_1",    label: "S'appuyer (mur)",  category: "leaning", icon: "🧱", loop: true,  glbPath: `${WW}/AS_StandLean_Normal01_Loop01.glb` },
  { id: "lean_wall_2",    label: "Appuyé détendu",   category: "leaning", icon: "🧱", loop: true,  glbPath: `${WW}/AS_StandLean_Normal02_Loop01.glb` },
  { id: "lean_wall_3",    label: "Appuyé contemplatif", category: "leaning", icon: "🧱", loop: true, glbPath: `${WW}/AS_StandLean_Normal03_Loop01.glb` },
  { id: "lean_wall_g1",   label: "Geste appuyé (1)", category: "leaning", icon: "🧱", loop: false, glbPath: `${WW}/AS_StandLean_Normal01_Action01.glb` },
  { id: "lean_wall_g2",   label: "Geste appuyé (2)", category: "leaning", icon: "🧱", loop: false, glbPath: `${WW}/AS_StandLean_Normal01_Action02.glb` },
  { id: "lean_pole_1",    label: "S'appuyer (poteau)", category: "leaning", icon: "🪵", loop: true, glbPath: `${WW}/AS_StandPole_Normal01_Loop01.glb` },
  { id: "lean_pole_2",    label: "Appuyé poteau (2)", category: "leaning", icon: "🪵", loop: true,  glbPath: `${WW}/AS_StandPole_Normal02_Loop01.glb` },
  { id: "lean_pole_g1",   label: "Geste poteau (1)", category: "leaning", icon: "🪵", loop: false, glbPath: `${WW}/AS_StandPole_Normal01_Action01.glb` },
  { id: "lean_pole_g2",   label: "Geste poteau (2)", category: "leaning", icon: "🪵", loop: false, glbPath: `${WW}/AS_StandPole_Normal01_Action02.glb` },
  { id: "lean_strap_1",   label: "S'appuyer (sangle)", category: "leaning", icon: "🎒", loop: true, glbPath: `${WW}/AS_StandStrap_Normal01_Loop01.glb` },
  { id: "lean_strap_2",   label: "Sangle détendu",   category: "leaning", icon: "🎒", loop: true,  glbPath: `${WW}/AS_StandStrap_Normal02_Loop01.glb` },
  { id: "lean_strap_g1",  label: "Geste sangle (1)", category: "leaning", icon: "🎒", loop: false, glbPath: `${WW}/AS_StandStrap_Normal01_Action01.glb` },
  { id: "lean_strap_g2",  label: "Geste sangle (2)", category: "leaning", icon: "🎒", loop: false, glbPath: `${WW}/AS_StandStrap_Normal01_Action02.glb` },

  // ── Working (forge) ─────────────────────────────────────────────────────────
  { id: "forge_hit",      label: "Frapper (forge)",  category: "working", icon: "🔨", loop: true,  glbPath: `${BS}/Forge/ANIM_IP_hit_loop.glb` },
  { id: "forge_triple",   label: "Triple frappe",    category: "working", icon: "🔨", loop: true,  glbPath: `${BS}/Forge/ANIM_IP_three_hit_loop.glb` },
  { id: "forge_polish",   label: "Polir (debout)",   category: "working", icon: "✨", loop: true,  glbPath: `${BS}/Forge/ANIM_IP_standing_polish_loop.glb` },
  { id: "forge_inspect",  label: "Inspecter (debout)", category: "working", icon: "🔍", loop: false, glbPath: `${BS}/Forge/ANIM_IP_standing_inspect.glb` },
  { id: "forge_sit_hit",  label: "Frapper (assis)",  category: "working", icon: "🔨", loop: false, glbPath: `${BS}/Forge/ANIM_IP_sit_hit.glb` },
  { id: "forge_sit_insp", label: "Inspecter (assis)", category: "working", icon: "🔎", loop: false, glbPath: `${BS}/Forge/ANIM_IP_sit_inspect.glb` },

  // ── Festive ─────────────────────────────────────────────────────────────────
  { id: "stand_idle_bs",  label: "Attente détendue", category: "festive", icon: "🧍", loop: true,  glbPath: `${BS}/Idle/ANIM_IP_standing_idle_01.glb` },
  { id: "customer_idle",  label: "Client curieux",   category: "festive", icon: "🤔", loop: true,  glbPath: `${BS}/Idle/ANIM_IP_customer_idle.glb` },
  { id: "stand_gesture_2",label: "Geste debout (2)", category: "festive", icon: "🙌", loop: false, glbPath: `${BS}/Idle/ANIM_RM_standing_idle_02.glb` },
  { id: "stand_gesture_3",label: "Geste debout (3)", category: "festive", icon: "🙌", loop: false, glbPath: `${BS}/Idle/ANIM_RM_standing_idle_03.glb` },
  { id: "lean_stretch_1", label: "Célébrer (1)",     category: "festive", icon: "🎉", loop: false, glbPath: `${WW}/AS_StandLean_Normal02_Action01.glb` },
  { id: "lean_stretch_2", label: "Célébrer (2)",     category: "festive", icon: "🎉", loop: false, glbPath: `${WW}/AS_StandLean_Normal02_Action02.glb` },
  { id: "pole_stretch_1", label: "Saluer (poteau)",  category: "festive", icon: "👋", loop: false, glbPath: `${WW}/AS_StandPole_Normal02_Action01.glb` },
  { id: "pole_stretch_2", label: "Applaudir",        category: "festive", icon: "👏", loop: false, glbPath: `${WW}/AS_StandPole_Normal02_Action02.glb` },
  { id: "strap_stretch_1",label: "Geste festif (1)", category: "festive", icon: "🕺", loop: false, glbPath: `${WW}/AS_StandStrap_Normal02_Action01.glb` },
  { id: "strap_stretch_2",label: "Geste festif (2)", category: "festive", icon: "💃", loop: false, glbPath: `${WW}/AS_StandStrap_Normal02_Action02.glb` },
];

/** Map rapide par id. */
export const EMOTE_MAP: ReadonlyMap<string, EmoteDef> = new Map(
  EMOTE_CATALOG.map((e) => [e.id, e])
);

/** Catégories uniques avec labels FR. */
export const EMOTE_CATEGORIES: { key: EmoteCategory; label: string }[] = [
  { key: "social",  label: "Social" },
  { key: "festive", label: "Festif" },
  { key: "sitting", label: "Assis" },
  { key: "leaning", label: "Appuyé" },
  { key: "resting", label: "Repos" },
  { key: "phone",   label: "Téléphone" },
  { key: "working", label: "Forge" },
];

/** Émotes filtrées par catégorie. */
export function emotesByCategory(cat: EmoteCategory): EmoteDef[] {
  return EMOTE_CATALOG.filter((e) => e.category === cat);
}
