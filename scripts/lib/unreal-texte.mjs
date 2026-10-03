// ══════════════════════════════════════════════════════════════════════════════
// scripts/lib/unreal-texte.mjs — lire le format TEXTE d'Unreal (ImportText).
//
// ── CE QU'IL LIT ──────────────────────────────────────────────────────────────
// Une DataTable exportee colonne par colonne rend chaque cellule dans le format
// qu'Unreal emploie pour copier-coller une propriete :
//
//   (Stackable=True,Max stack size=100)
//   (Item Name=NSLOCTEXT("ns", "cle", "Stone"),Categories=(Resource,Ore,Stone))
//   Mesh="/Script/Engine.StaticMesh'/Game/Hyper/.../SM_Ore_Stone.SM_Ore_Stone'"
//   Recipe=((Item=(DataTable="...",RowName="Stone"),Amount=4),(Item=...))
//
// ── POURQUOI UN VRAI PARSEUR ─────────────────────────────────────────────────
// Des expressions regulieres liraient `Recipe=((Item=(...),Amount=4),(...))`
// de travers des qu'une structure en contient une autre — et c'est le cas de
// TOUTES les recettes. Une virgule dans un NSLOCTEXT (« Stone, a rock ») couperait
// un champ en deux sans lever. Le format est une grammaire recursive : on le lit
// comme tel.
//
// ── CE QU'IL REND ─────────────────────────────────────────────────────────────
//   (a=1,b=2)       -> { a: "1", b: "2" }        structure
//   (x,y,z)         -> ["x", "y", "z"]           liste
//   ((a=1),(a=2))   -> [{ a: "1" }, { a: "2" }]  liste de structures
//   NSLOCTEXT(n,k,v)-> "v"                       le texte affiche, pas la cle
//   "texte"         -> "texte"
//   True / 4 / Foo  -> "True" / "4" / "Foo"      les feuilles restent en CHAINES :
//                                                c'est l'appelant qui sait si
//                                                « 4 » est un nombre
// ══════════════════════════════════════════════════════════════════════════════

/** Lit une valeur Unreal. Rend `null` sur une chaine vide. */
export function lireUnreal(texte) {
  if (texte === null || texte === undefined) return null;
  const s = String(texte);
  let i = 0;

  const espaces = () => { while (i < s.length && /\s/.test(s[i])) i++; };

  function chaine() {
    // s[i] === '"'
    i++;
    let out = "";
    while (i < s.length && s[i] !== '"') {
      if (s[i] === "\\" && i + 1 < s.length) { out += s[i + 1]; i += 2; continue; }
      out += s[i++];
    }
    i++; // guillemet fermant
    return out;
  }

  function nsloctext() {
    // NSLOCTEXT("ns", "cle", "valeur") ou LOCTEXT("cle", "valeur") ou INVTEXT("v")
    while (i < s.length && s[i] !== "(") i++;
    i++;
    const args = [];
    espaces();
    while (i < s.length && s[i] !== ")") {
      espaces();
      if (s[i] === '"') args.push(chaine());
      else i++;
      espaces();
      if (s[i] === ",") i++;
    }
    i++; // )
    return args.length ? args[args.length - 1] : "";
  }

  function atome() {
    // Jusqu'a la prochaine virgule ou parenthese fermante AU MEME NIVEAU.
    let out = "";
    while (i < s.length && s[i] !== "," && s[i] !== ")") {
      if (s[i] === '"') { out += chaine(); continue; }
      out += s[i++];
    }
    return out.trim();
  }

  function valeur() {
    espaces();
    if (i >= s.length) return "";
    if (s[i] === "(") return groupe();
    if (s[i] === '"') return chaine();
    if (/^(NSLOCTEXT|LOCTEXT|INVTEXT)\s*\(/.test(s.slice(i))) return nsloctext();
    return atome();
  }

  function groupe() {
    // s[i] === "("
    i++;
    espaces();
    if (s[i] === ")") { i++; return []; }

    // Structure ou liste ? Une structure a un `=` AVANT la premiere virgule ou
    // parenthese de son premier element. On regarde sans consommer.
    let j = i, profondeur = 0, dansChaine = false, estStruct = false;
    for (; j < s.length; j++) {
      const c = s[j];
      if (dansChaine) { if (c === '"') dansChaine = false; continue; }
      if (c === '"') { dansChaine = true; continue; }
      if (c === "(") { if (profondeur === 0 && j !== i) break; profondeur++; continue; }
      if (c === ")") { if (profondeur === 0) break; profondeur--; continue; }
      if (profondeur === 0 && c === ",") break;
      if (profondeur === 0 && c === "=") { estStruct = true; break; }
    }

    if (estStruct) {
      const obj = {};
      while (i < s.length && s[i] !== ")") {
        espaces();
        let cle = "";
        while (i < s.length && s[i] !== "=" && s[i] !== "," && s[i] !== ")") cle += s[i++];
        cle = cle.trim();
        if (s[i] === "=") { i++; obj[cle] = valeur(); }
        else if (cle) obj[cle] = "";
        espaces();
        if (s[i] === ",") i++;
      }
      i++; // )
      return obj;
    }

    const liste = [];
    while (i < s.length && s[i] !== ")") {
      liste.push(valeur());
      espaces();
      if (s[i] === ",") i++;
    }
    i++; // )
    return liste;
  }

  espaces();
  if (s.length === 0) return null;
  return valeur();
}

/** Nom d'asset nu depuis une reference d'objet Unreal :
 *  "/Script/Engine.StaticMesh'/Game/X/SM_Ore.SM_Ore'" -> "SM_Ore". */
export function nomAsset(reference) {
  if (typeof reference !== "string" || reference === "" || reference === "None") return null;
  const m = reference.match(/\/([^/.']+)\.[^/']+'?$/) || reference.match(/\/([^/.']+)'?$/);
  return m ? m[1] : null;
}

/** Chemin de paquet /Game/... depuis une reference d'objet Unreal. */
export function cheminPaquet(reference) {
  if (typeof reference !== "string") return null;
  const m = reference.match(/(\/Game\/[^.']+)/);
  return m ? m[1] : null;
}

/** Retire le suffixe GUID que les structures Blueprint collent aux noms de
 *  champs : "GenericAttributes_2_ECBA8D824275F3AB65EED8A7E46C293F" -> "GenericAttributes". */
export function champNu(nom) {
  return String(nom).replace(/_\d+_[0-9A-F]{32}$/, "");
}

export const vrai = (v) => String(v).toLowerCase() === "true";
export const nombre = (v, defaut = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : defaut;
};