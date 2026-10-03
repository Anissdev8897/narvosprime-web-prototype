// ══════════════════════════════════════════════════════════════════════════════
// uasset-materiaux.mjs — un maillage cuit s'affichera-t-il TEXTURÉ ?
//
//   import { diagnostiquerMaillage } from "./lib/uasset-materiaux.mjs";
//   diagnostiquerMaillage("Narvos/Defender/Demo/Characters/Murdock/SK_Murdock")
//     -> { ok: false, erreurs: ["M_Murdock : non compile pour le skin …"] }
//
// ── CE QUI REND UN PERSONNAGE GRIS, MESURÉ LE 2026-09-13 ──────────────────────
// (RAPPORT_PNJ_2026-09-13 §4, 85 entrées remontées une à une)
//   · matériau ABSENT du pack cuit (référence vers un package jamais cuit) ;
//   · parent HORS PACK : les `M_TrainingSoldier*` importent un matériau resté
//     sous `/Game/Defender/` (NeverCook) → Default Material ;
//   · matériau de base NON COMPILÉ pour le skin : pas de `FGPUSkinVertexFactory`
//     dans son .uexp cuit (Defender : « Missing Material Function », 8 corps) ;
//   · matériau par défaut du moteur (`WorldGridMaterial`, `DefaultMaterial`).
// Un matériau sain au bout de la chaîne porte `FGPUSkinVertexFactory` : c'est le
// témoin retenu, lu dans le cuit, pas dans le journal du cook.
//
// ⚠ Ne juge PAS la qualité d'une texture (512 px, uniforme) : seulement si le
// moteur a de quoi afficher autre chose que le damier gris.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import { lireProprietes } from "./uasset-proprietes.mjs";

const PACK = "E:/narvosprime-web-prototype/WebPortal/Server/Assets/narvos";
const PROFONDEUR_MAX = 6;

const fichierCuit = (pkg) => `${PACK}/${pkg.replace(/^\/Game\//, "")}`;
const cheminMoteur = (p) => /^\/(Engine|Script)\//.test(p) || p.startsWith("/Game/NanosWorld/");
const EST_MATERIAU = /^(Material|MaterialInstanceConstant)$/;

const cache = new Map();

/** Diagnostic d'un matériau (chemin d'objet `/Game/…/M.M`), en remontant ses parents. */
export function diagnostiquerMateriau(objet, profondeur = 0) {
  const pkg = String(objet).split(".")[0];
  const nom = pkg.split("/").pop();
  if (cache.has(pkg)) return cache.get(pkg);

  let verdict;
  if (cheminMoteur(pkg)) {
    verdict = /DefaultMaterial|WorldGridMaterial/.test(pkg)
      ? { ok: false, raison: `${nom} : materiau par defaut du moteur (damier)` }
      : { ok: true };
  } else if (!fs.existsSync(fichierCuit(pkg) + ".uasset")) {
    verdict = { ok: false, raison: `${nom} : reference cassee, ${pkg} absent du pack cuit` };
  } else if (profondeur > PROFONDEUR_MAX) {
    verdict = { ok: false, raison: `${nom} : chaine de parents trop longue` };
  } else {
    let P;
    try { P = lireProprietes(fichierCuit(pkg) + ".uasset"); } catch (e) {
      verdict = { ok: false, raison: `${nom} : illisible (${e.message})` };
    }
    if (P) {
      const exp = P.exports.find((e) => EST_MATERIAU.test(e.classe));
      if (!exp) {
        verdict = { ok: false, raison: `${nom} : aucun materiau dans le paquet` };
      } else if (exp.classe === "Material") {
        const uexp = fichierCuit(pkg) + ".uexp";
        const texte = fs.existsSync(uexp) ? fs.readFileSync(uexp).toString("latin1") : "";
        // Translucide : relevé À PART, ce n'est pas un gris. Les Meshy exportés en
        // `alphaMode: BLEND` se voient « à travers » (RAPPORT_PNJ §3).
        const translucide = P.names.some((n) => n === "BLEND_Translucent" || n === "EBlendMode::BLEND_Translucent")
          || texte.includes("BLEND_Translucent");
        verdict = texte.includes("FGPUSkinVertexFactory")
          ? { ok: true, translucide }
          : { ok: false, translucide, raison: `${nom} : materiau non compile pour le skin (gris en jeu)` };
      } else {
        const parent = P.imports.find((i) => EST_MATERIAU.test(i.classe)
          && !i.chemin.startsWith("/Script/") && i.chemin.split(".")[0] !== pkg);
        verdict = parent
          ? diagnostiquerMateriau(parent.chemin, profondeur + 1)
          : { ok: false, raison: `${nom} : instance sans parent` };
      }
    }
  }
  cache.set(pkg, verdict);
  return verdict;
}

/**
 * Diagnostic des matériaux d'un maillage, depuis son chemin de pack
 * (`Narvos/…/SK_X`, la valeur d'Assets.toml).
 * @returns {{ ok: boolean, erreurs: string[], materiaux: number }}
 */
export function diagnostiquerMaillage(cheminPack) {
  const f = `${PACK}/${cheminPack}.uasset`;
  if (!fs.existsSync(f)) return { ok: false, erreurs: [`maillage absent du pack : ${cheminPack}`], materiaux: 0 };
  let P;
  try { P = lireProprietes(f); } catch (e) {
    return { ok: false, erreurs: [`maillage illisible : ${e.message}`], materiaux: 0 };
  }
  const materiaux = P.imports.filter((i) => EST_MATERIAU.test(i.classe) && !i.chemin.startsWith("/Script/"));
  if (materiaux.length === 0) return { ok: false, erreurs: ["aucun materiau reference (texture absente)"], materiaux: 0 };
  const erreurs = [];
  let translucide = false;
  for (const m of materiaux) {
    const v = diagnostiquerMateriau(m.chemin);
    if (v.translucide) translucide = true;
    if (!v.ok && !erreurs.includes(v.raison)) erreurs.push(v.raison);
  }
  return { ok: erreurs.length === 0, erreurs, translucide, materiaux: materiaux.length };
}