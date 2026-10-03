#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// adk-mcs-fonctions.mjs — ÉCRIT les fonctions `Narvos*` dans BP_NarvosMH_M/F.
//
//   node scripts/adk-mcs-fonctions.mjs                 # construit, compile, sauve
//   node scripts/adk-mcs-fonctions.mjs --bp BP_NarvosMH_M   # un seul Blueprint
//
// Éditeur COMPLET ouvert, serveur MCP de l'éditeur à l'écoute (13579).
//
// ── LE CONTRAT ────────────────────────────────────────────────────────────────
// `Shared/Logic/MetaCustom.lua` (`Operations`) rend une liste d'appels ;
// `Client/MetaCustom.lua` les joue par `bp:CallBlueprintEvent(nom, …)`. Ces
// fonctions sont les récepteurs, une par sorte d'appel :
//   NarvosMaillage(Composant, Chemin)              SkeletalMesh d'un composant
//   NarvosMateriau(Composant, Index, Chemin)       matériau d'un emplacement
//   NarvosGroom(Composant, Groom, Liaison)         groom + binding
//   NarvosParamReel(Composant, Param, Valeur)      scalaire sur tous ses matériaux
//   NarvosParamCouleur(Composant, Param, R, G, B)  vecteur sur tous ses matériaux
//   NarvosParamTexture(Composant, Index, Param, Chemin)
//   NarvosAnimReel(Composant, Variable, Valeur)    variable de l'AnimBP de post-traitement
//   NarvosAnimBool(Composant, Variable, Valeur)
// Un chemin VIDE vide l'emplacement (le chargement rend None, la conversion échoue).
//
// ── POURQUOI UN SCRIPT ET PAS L'ÉDITEUR À LA MAIN ─────────────────────────────
// Deux Blueprints, neuf fonctions, ~80 nœuds : à la main, une connexion oubliée
// ne lève rien — la fonction compile et ne fait rien. Ici chaque liaison est
// vérifiée à la réponse du serveur, et une fonction existante est RECONSTRUITE
// (retirée par `BlueprintEditorLibrary.remove_function_graph`) : relancer donne
// toujours le même graphe.
//
// ── CE QUE LE PYTHON DE L'ÉDITEUR NE SAIT PAS FAIRE ───────────────────────────
// Créer des nœuds et les relier : c'est le serveur MCP (UnrealMCPServer) qui le fait.
// ══════════════════════════════════════════════════════════════════════════════
import { execFileSync } from "node:child_process";
import path from "node:path";
import { outil, outilJson } from "./lib/ue-mcp-client.mjs";
import { brancherNettoyageMateriaux } from "./lib/mcs-nettoyer-materiaux.mjs";

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const DOSSIER = "/Game/Narvos/PontMetaHuman";
const args = process.argv.slice(2);
const seul = args.includes("--bp") ? args[args.indexOf("--bp") + 1] : null;
const fonctionSeule = args.includes("--fonction") ? args[args.indexOf("--fonction") + 1] : null;
const BLUEPRINTS = ["BP_NarvosMH_M", "BP_NarvosMH_F"].filter((b) => !seul || b === seul).map((b) => `${DOSSIER}/${b}`);

// ── Python dans l'éditeur (retirer une fonction, sauver) ──────────────────────
// ⚠ `--statement` évalue UNE instruction : un bloc multiligne lève « multiple
// statements found ». On l'enveloppe dans `exec("…")` — une chaîne JSON est une
// chaîne Python valide (mêmes échappements \n, \", \\).
function python(code) {
  try {
    return execFileSync("py", ["-3", path.join(RACINE, "scripts", "ue-remote.py"), "--statement", `exec(${JSON.stringify(code)})`], { encoding: "utf8" });
  } catch (e) {
    return String(e.stdout ?? "") + String(e.stderr ?? "") + " ECHEC_PYTHON";
  }
}

// Chemins de classe pour `K2_GetComponentsByClass` (broche de classe, valeur par défaut).
const CHEMINS_CLASSES = {
  SkeletalMeshComponent: "/Script/Engine.SkeletalMeshComponent",
  PrimitiveComponent: "/Script/Engine.PrimitiveComponent",
  MeshComponent: "/Script/Engine.MeshComponent",
  LODSyncComponent: "/Script/Engine.LODSyncComponent",
  GroomComponent: "/Script/HairStrandsCore.GroomComponent",
};

// ── Un graphe de fonction, et ses nœuds ───────────────────────────────────────
class Graphe {
  constructor(bp, nom) { this.bp = bp; this.nom = nom; this.x = 300; }

  async creer(entrees, sorties = []) {
    const nomBp = this.bp.split("/").pop();
    python(`import unreal\nbp = unreal.load_asset('${this.bp}.${nomBp}')\nif unreal.BlueprintEditorLibrary.find_graph(bp, '${this.nom}'):\n    unreal.BlueprintEditorLibrary.remove_function_graph(bp, '${this.nom}')`);
    const r = await outilJson("add_function_graph", { asset_path: this.bp, function_name: this.nom, access: "Public", pure: false });
    this.entree = { id: r.entryNodeId };
    for (const [nom, type] of entrees) {
      const { texte, erreur } = await outil("add_function_pin", { asset_path: this.bp, function_name: this.nom, pin_name: nom, pin_type: type, direction: "Input" });
      if (erreur) throw new Error(`${this.nom}.${nom} : ${texte}`);
    }
    for (const [nom, type] of sorties) {
      const { texte, erreur } = await outil("add_function_pin", { asset_path: this.bp, function_name: this.nom, pin_name: nom, pin_type: type, direction: "Output" });
      if (erreur) throw new Error(`${this.nom}.${nom} (sortie) : ${texte}`);
    }
    if (sorties.length > 0) {
      const info = await outilJson("get_blueprint_info", { asset_path: this.bp });
      const f = info.functions.find((x) => x.name === this.nom);
      const retour = f && f.nodes.find((n) => n.class === "K2Node_FunctionResult");
      if (!retour) throw new Error(`${this.nom} : noeud de retour introuvable`);
      this.retour = { id: retour.id };
    }
    return this;
  }

  place() { this.x += 280; return { node_x: this.x, node_y: 0 }; }

  static epingles(r) {
    return Object.fromEntries((r.pins ?? []).map((p) => [p.name, p]));
  }

  async appel(classe, fonction) {
    const r = await outilJson("add_function_call_node", { asset_path: this.bp, graph_name: this.nom, function_name: fonction, target: classe, ...this.place() });
    return { id: r.nodeId, pins: Graphe.epingles(r), quoi: `${classe}.${fonction}` };
  }

  async conversion(classe) {
    const r = await outilJson("add_cast_node", { asset_path: this.bp, graph_name: this.nom, target_class: classe, ...this.place() });
    const pins = Graphe.epingles(r);
    const sortie = Object.keys(pins).find((n) => n.startsWith("As") && pins[n].direction === "Output");
    if (!sortie) throw new Error(`${this.nom} : conversion ${classe} sans sortie typee (${Object.keys(pins).join(", ")})`);
    return { id: r.nodeId, pins, as: sortie, quoi: `Cast ${classe}` };
  }

  async boucle() {
    const r = await outilJson("add_for_each_loop_node", { asset_path: this.bp, graph_name: this.nom, with_break: false, ...this.place() });
    return { id: r.nodeId, pins: Graphe.epingles(r), quoi: "ForEachLoop" };
  }

  async branche() {
    const r = await outilJson("add_branch_node", { asset_path: this.bp, graph_name: this.nom, ...this.place() });
    return { id: r.nodeId ?? r.node_id, pins: Graphe.epingles(r), quoi: "Branch" };
  }

  async lier(a, pinA, b, pinB) {
    const { texte, erreur } = await outil("connect_pins", {
      asset_path: this.bp, graph_name: this.nom,
      source_node_id: a.id, source_pin_name: pinA, target_node_id: b.id, target_pin_name: pinB,
    });
    if (erreur || !/^\s*Connected\b/.test(texte)) {
      throw new Error(`${this.nom} : liaison ${a.quoi ?? "entree"}.${pinA} -> ${b.quoi ?? "?"}.${pinB} refusee : ${texte.slice(0, 300)}`);
    }
  }

  async defaut(n, pin, valeur) {
    const { texte, erreur } = await outil("set_pin_default_value", { asset_path: this.bp, graph_name: this.nom, node_id: n.id, pin_name: pin, default_value: valeur });
    if (erreur) throw new Error(`${this.nom} : defaut ${n.quoi}.${pin} : ${texte}`);
  }

  // ── Motifs réutilisés ──

  /** Entrée → composants de <classe> → celui dont le nom = Composant → Cast<classe>.
   *  Rend { cast } : l'opération s'enchaîne sur `cast.then`, cible `cast.as`. */
  //
  // ⚠ RECHERCHE EN LIGNE, SANS FONCTION D'AIDE. Une aide « NarvosComposant »
  // rendant le composant a été écrite puis retirée le 2026-09-13 : le type
  // « Object » de `add_function_pin` / `add_variable` crée une broche SANS classe
  // (« PinSubCategoryObject on pin 'Composant' is NULL ») et le Blueprint ne
  // compile plus. Ici : tableau des composants de la classe voulue, boucle, nom
  // d'objet comparé, et l'opération part de la branche « vrai » — aucune broche
  // Object à déclarer.
  async composant(classe, pinNom = "Composant") {
    const liste = await this.appel("Actor", "K2_GetComponentsByClass");
    await this.defaut(liste, "ComponentClass", CHEMINS_CLASSES[classe] ?? `/Script/Engine.${classe}`);
    const boucle = await this.boucle();
    await this.lier(this.entree, "then", boucle, "Exec");
    await this.lier(liste, "ReturnValue", boucle, "Array");
    const nomObjet = await this.appel("KismetSystemLibrary", "GetObjectName");
    await this.lier(boucle, "Array Element", nomObjet, "Object");
    // FName ne conserve pas necessairement la casse hors editeur : dans nanos,
    // Face devient face. La comparaison sensible a la casse ignorait toute la
    // personnalisation de la tete, sans erreur. Respecter l'identite FName.
    const egal = await this.appel("KismetStringLibrary", "EqualEqual_StriStri");
    await this.lier(nomObjet, "ReturnValue", egal, "A");
    await this.lier(this.entree, pinNom, egal, "B");
    const si = await this.branche();
    await this.lier(boucle, "LoopBody", si, "execute");
    await this.lier(egal, "ReturnValue", si, "Condition");
    const cast = await this.conversion(classe);
    await this.lier(si, "then", cast, "execute");
    await this.lier(boucle, "Array Element", cast, "Object");
    return { cast };
  }

  /** Chemin (chaîne) → objet chargé. Rend le nœud LoadAsset_Blocking (exec + ReturnValue). */
  async charger(depuisNoeud, depuisPin) {
    const chemin = await this.appel("KismetSystemLibrary", "MakeSoftObjectPath");
    await this.lier(depuisNoeud, depuisPin, chemin, "PathString");
    const ref = await this.appel("KismetSystemLibrary", "Conv_SoftObjPathToSoftObjRef");
    await this.lier(chemin, "ReturnValue", ref, "SoftObjectPath");
    const charge = await this.appel("KismetSystemLibrary", "LoadAsset_Blocking");
    await this.lier(ref, "ReturnValue", charge, "Asset");
    return charge;
  }

  async versNom(depuisNoeud, depuisPin) {
    const n = await this.appel("KismetStringLibrary", "Conv_StringToName");
    await this.lier(depuisNoeud, depuisPin, n, "InString");
    return n;
  }
}

// ── Les fonctions ─────────────────────────────────────────────────────────────

const FONCTIONS = {
  // Diagnostic local : mesure le composant réellement animé dans le client cuit.
  // Aucune modification ni activation automatique de ces sondes.
  async NarvosDiagnosticMaillage(bp) {
    const g = await new Graphe(bp, "NarvosDiagnosticMaillage").creer(
      [["Composant", "String"], ["Os", "String"], ["Morph", "String"]],
      [["Detail", "Integer"], ["PostProcess", "String"], ["Desactive", "Boolean"], ["PositionOs", "Vector"], ["ValeurMorph", "Float"]]);
    const { cast } = await g.composant("SkeletalMeshComponent");
    const detail = await g.appel("SkinnedMeshComponent", "GetPredictedLODLevel");
    const pp = await g.appel("SkeletalMeshComponent", "GetPostProcessInstance");
    const nom = await g.appel("KismetSystemLibrary", "GetObjectName");
    const desactive = await g.appel("SkeletalMeshComponent", "GetDisablePostProcessBlueprint");
    const os = await g.versNom(g.entree, "Os");
    const position = await g.appel("SceneComponent", "GetSocketLocation");
    const morph = await g.versNom(g.entree, "Morph");
    const valeur = await g.appel("SkeletalMeshComponent", "GetMorphTarget");
    for (const n of [detail, pp, desactive, position, valeur]) await g.lier(cast, cast.as, n, "self");
    await g.lier(pp, "ReturnValue", nom, "Object");
    await g.lier(os, "ReturnValue", position, "InSocketName");
    await g.lier(morph, "ReturnValue", valeur, "MorphTargetName");
    for (const [n, pin] of [[detail,"Detail"],[nom,"PostProcess"],[desactive,"Desactive"],[position,"PositionOs"],[valeur,"ValeurMorph"]])
      await g.lier(n, "ReturnValue", g.retour, pin);
    // Relier l'execution apres les sorties, puis verifier le graphe final.
    // Un retour deconnecte compile mais renvoie uniquement les valeurs par defaut.
    await g.lier(cast, "then", g.retour, "execute");
    const controle = await outilJson("get_node_pins", { asset_path: bp, graph_name: g.nom });
    const retour = controle.nodes.find(n => n.id === g.retour.id);
    if (!retour?.pins.find(p => p.name === "execute")?.isConnected)
      throw new Error(`${g.nom} : retour sans execution`);
  },

  // Diagnostic cible des cheveux : conserve le groom, sa liaison et ses materiaux.
  // Aucun appel automatique ; permet de distinguer simulation et attachement.
  async NarvosSimulationGroom(bp) {
    const g = await new Graphe(bp, "NarvosSimulationGroom").creer([["Composant", "String"], ["Actif", "Boolean"]]);
    const { cast } = await g.composant("GroomComponent");
    const poser = await g.appel("GroomComponent", "SetEnableSimulation");
    await g.lier(cast, cast.as, poser, "self");
    await g.lier(g.entree, "Actif", poser, "bInEnableSimulation");
    await g.lier(cast, "then", poser, "execute");
  },

  async NarvosDetailSynchronise(bp) {
    const g = await new Graphe(bp, "NarvosDetailSynchronise").creer([["Composant", "String"], ["Niveau", "Integer"]]);
    const { cast } = await g.composant("LODSyncComponent");
    const poser = await g.appel("KismetSystemLibrary", "SetIntPropertyByName");
    await g.lier(cast, "then", poser, "execute");
    await g.lier(cast, cast.as, poser, "Object");
    await g.defaut(poser, "PropertyName", "ForcedLOD");
    await g.lier(g.entree, "Niveau", poser, "Value");
  },

  async NarvosMaillage(bp) {
    const g = await new Graphe(bp, "NarvosMaillage").creer([["Composant", "String"], ["Chemin", "String"]]);
    const { cast } = await g.composant("SkeletalMeshComponent");
    const charge = await g.charger(g.entree, "Chemin");
    await g.lier(cast, "then", charge, "execute");
    const mesh = await g.conversion("SkeletalMesh");
    await g.lier(charge, "then", mesh, "execute");
    await g.lier(charge, "ReturnValue", mesh, "Object");
    const poser = await g.appel("SkeletalMeshComponent", "SetSkeletalMeshAsset");
    await g.lier(mesh, "then", poser, "execute");
    await g.lier(cast, cast.as, poser, "self");
    await g.lier(mesh, mesh.as, poser, "NewMesh");
    // La construction s'exécute avant les choix du joueur. Après remplacement,
    // réutiliser la liaison existante, qui préserve les composants ayant leur AnimBP.
    const pose = await g.appel("Self", "EnableMasterPose");
    await brancherNettoyageMateriaux({bp, entree:g.entree.id, composant:cast.id,
      sortieComposant:cast.as, apres:poser.id, suite:pose.id});
    await g.lier(cast, cast.as, pose, "SkeletalMeshComponent");
    const vider = await g.appel("SkeletalMeshComponent", "SetSkeletalMeshAsset");
    await g.lier(mesh, "CastFailed", vider, "execute");
    await g.lier(cast, cast.as, vider, "self");
  },

  async NarvosMateriau(bp) {
    const g = await new Graphe(bp, "NarvosMateriau").creer([["Composant", "String"], ["Index", "Integer"], ["Chemin", "String"]]);
    const { cast } = await g.composant("PrimitiveComponent");
    const charge = await g.charger(g.entree, "Chemin");
    await g.lier(cast, "then", charge, "execute");
    const mat = await g.conversion("MaterialInterface");
    await g.lier(charge, "then", mat, "execute");
    await g.lier(charge, "ReturnValue", mat, "Object");
    const poser = await g.appel("PrimitiveComponent", "SetMaterial");
    await g.lier(mat, "then", poser, "execute");
    await g.lier(cast, cast.as, poser, "self");
    await g.lier(g.entree, "Index", poser, "ElementIndex");
    await g.lier(mat, mat.as, poser, "Material");
  },

  async NarvosGroom(bp) {
    const g = await new Graphe(bp, "NarvosGroom").creer([["Composant", "String"], ["Groom", "String"], ["Liaison", "String"]]);
    const { cast } = await g.composant("GroomComponent");
    // Binding d'abord à None : un groom posé sur le binding de l'ANCIEN groom
    // échoue à l'initialisation (topologie différente).
    const sansLiaison = await g.appel("GroomComponent", "SetBindingAsset");
    await g.lier(cast, "then", sansLiaison, "execute");
    await g.lier(cast, cast.as, sansLiaison, "self");
    const chargeG = await g.charger(g.entree, "Groom");
    await g.lier(sansLiaison, "then", chargeG, "execute");
    const asset = await g.conversion("GroomAsset");
    await g.lier(chargeG, "then", asset, "execute");
    await g.lier(chargeG, "ReturnValue", asset, "Object");
    const poser = await g.appel("GroomComponent", "SetGroomAsset");
    await g.lier(asset, "then", poser, "execute");
    await g.lier(cast, cast.as, poser, "self");
    await g.lier(asset, asset.as, poser, "Asset");
    const vider = await g.appel("GroomComponent", "SetGroomAsset");
    await g.lier(asset, "CastFailed", vider, "execute");
    await g.lier(cast, cast.as, vider, "self");
    const chargeL = await g.charger(g.entree, "Liaison");
    await g.lier(poser, "then", chargeL, "execute");
    const liaison = await g.conversion("GroomBindingAsset");
    await g.lier(chargeL, "then", liaison, "execute");
    await g.lier(chargeL, "ReturnValue", liaison, "Object");
    const lier = await g.appel("GroomComponent", "SetBindingAsset");
    await g.lier(liaison, "then", lier, "execute");
    await g.lier(cast, cast.as, lier, "self");
    await g.lier(liaison, liaison.as, lier, "InBinding");
  },

  async NarvosParamReel(bp) {
    const g = await new Graphe(bp, "NarvosParamReel").creer([["Composant", "String"], ["Param", "String"], ["Valeur", "Float"]]);
    const { cast } = await g.composant("MeshComponent");
    const n = await g.versNom(g.entree, "Param");
    const poser = await g.appel("MeshComponent", "SetScalarParameterValueOnMaterials");
    await g.lier(cast, "then", poser, "execute");
    await g.lier(cast, cast.as, poser, "self");
    await g.lier(n, "ReturnValue", poser, "ParameterName");
    await g.lier(g.entree, "Valeur", poser, "ParameterValue");
  },

  async NarvosParamCouleur(bp) {
    const g = await new Graphe(bp, "NarvosParamCouleur").creer([["Composant", "String"], ["Param", "String"], ["R", "Float"], ["G", "Float"], ["B", "Float"]]);
    const { cast } = await g.composant("MeshComponent");
    const n = await g.versNom(g.entree, "Param");
    const v = await g.appel("KismetMathLibrary", "MakeVector");
    await g.lier(g.entree, "R", v, "X");
    await g.lier(g.entree, "G", v, "Y");
    await g.lier(g.entree, "B", v, "Z");
    const poser = await g.appel("MeshComponent", "SetVectorParameterValueOnMaterials");
    await g.lier(cast, "then", poser, "execute");
    await g.lier(cast, cast.as, poser, "self");
    await g.lier(n, "ReturnValue", poser, "ParameterName");
    await g.lier(v, "ReturnValue", poser, "ParameterValue");
  },

  async NarvosParamTexture(bp) {
    const g = await new Graphe(bp, "NarvosParamTexture").creer([["Composant", "String"], ["Index", "Integer"], ["Param", "String"], ["Chemin", "String"]]);
    const { cast } = await g.composant("PrimitiveComponent");
    const mid = await g.appel("PrimitiveComponent", "CreateDynamicMaterialInstance");
    await g.lier(cast, "then", mid, "execute");
    await g.lier(cast, cast.as, mid, "self");
    await g.lier(g.entree, "Index", mid, "ElementIndex");
    const charge = await g.charger(g.entree, "Chemin");
    await g.lier(mid, "then", charge, "execute");
    const tex = await g.conversion("Texture");
    await g.lier(charge, "then", tex, "execute");
    await g.lier(charge, "ReturnValue", tex, "Object");
    const n = await g.versNom(g.entree, "Param");
    const poser = await g.appel("MaterialInstanceDynamic", "SetTextureParameterValue");
    await g.lier(tex, "then", poser, "execute");
    await g.lier(mid, "ReturnValue", poser, "self");
    await g.lier(n, "ReturnValue", poser, "ParameterName");
    await g.lier(tex, tex.as, poser, "Value");
  },

  async NarvosAnimReel(bp) {
    const g = await new Graphe(bp, "NarvosAnimReel").creer([["Composant", "String"], ["Variable", "String"], ["Valeur", "Float"]]);
    const { cast } = await g.composant("SkeletalMeshComponent");
    const pp = await g.appel("SkeletalMeshComponent", "GetPostProcessInstance");
    await g.lier(cast, cast.as, pp, "self");
    const n = await g.versNom(g.entree, "Variable");
    const poser = await g.appel("KismetSystemLibrary", "SetDoublePropertyByName");
    await g.lier(cast, "then", poser, "execute");
    await g.lier(pp, "ReturnValue", poser, "Object");
    await g.lier(n, "ReturnValue", poser, "PropertyName");
    await g.lier(g.entree, "Valeur", poser, "Value");
  },

  async NarvosMorph(bp) {
    const g = await new Graphe(bp, "NarvosMorph").creer([["Composant", "String"], ["Morph", "String"], ["Valeur", "Float"]]);
    const { cast } = await g.composant("SkeletalMeshComponent");
    const nom = await g.versNom(g.entree, "Morph");
    const poser = await g.appel("SkeletalMeshComponent", "SetMorphTarget");
    await g.lier(cast, "then", poser, "execute");
    await g.lier(cast, cast.as, poser, "self");
    await g.lier(nom, "ReturnValue", poser, "MorphTargetName");
    await g.lier(g.entree, "Valeur", poser, "Value");
  },

  async NarvosAnimBool(bp) {
    const g = await new Graphe(bp, "NarvosAnimBool").creer([["Composant", "String"], ["Variable", "String"], ["Valeur", "Boolean"]]);
    const { cast } = await g.composant("SkeletalMeshComponent");
    const pp = await g.appel("SkeletalMeshComponent", "GetPostProcessInstance");
    await g.lier(cast, cast.as, pp, "self");
    const n = await g.versNom(g.entree, "Variable");
    const poser = await g.appel("KismetSystemLibrary", "SetBoolPropertyByName");
    await g.lier(cast, "then", poser, "execute");
    await g.lier(pp, "ReturnValue", poser, "Object");
    await g.lier(n, "ReturnValue", poser, "PropertyName");
    await g.lier(g.entree, "Valeur", poser, "Value");
  },
};

// ── Le composant « Prop » (accessoires) ───────────────────────────────────────
//
// Le catalogue range les accessoires du MCS sur un composant `Prop`
// (Catalogs/MetaCustom.lua, COMPOSANTS.accessoire) ; les BP MetaHuman standard n'en
// ont pas. On l'ajoute sous `Body`, et le script de construction lui applique la
// MÊME `EnableMasterPose` que Torso/Legs/Feet — sinon l'accessoire resterait en
// pose de référence pendant que le corps s'anime. Idempotent : rien si `Prop` existe.
async function ajouterProp(bp) {
  const info = await outilJson("get_blueprint_info", { asset_path: bp });
  if (info.components.some((c) => c.name === "Prop")) return "deja present";

  const ajout = await outil("add_component", { asset_path: bp, component_class: "SkeletalMeshComponent", component_name: "Prop", parent_component: "Body" });
  if (ajout.erreur) throw new Error(`add_component Prop : ${ajout.texte}`);

  const graphe = "UserConstructionScript";
  const lu = await outilJson("get_node_pins", { asset_path: bp, graph_name: graphe });
  const poses = lu.nodes.filter((n) => /Enable Master Pose/.test(n.name));
  const estPose = (id) => poses.some((n) => n.id === id);
  // La DERNIÈRE pose de la chaîne : son `then` mène hors des poses.
  const derniere = poses.find((n) => {
    const t = n.pins.find((p) => p.name === "then");
    return t && t.connections.length === 1 && !estPose(t.connections[0].nodeId);
  });
  if (!derniere) throw new Error("chaine EnableMasterPose introuvable dans le script de construction");
  const suite = derniere.pins.find((p) => p.name === "then").connections[0];

  const pose = await outilJson("add_function_call_node", { asset_path: bp, graph_name: graphe, function_name: "EnableMasterPose", target: "Self", node_x: derniere.posX, node_y: (derniere.posY ?? 0) + 220 });
  const lire = await outilJson("add_variable_get_node", { asset_path: bp, graph_name: graphe, variable_name: "Prop", node_x: (derniere.posX ?? 0) - 200, node_y: (derniere.posY ?? 0) + 260 });
  const sortieProp = (lire.pins ?? []).find((p) => p.direction === "Output")?.name ?? "Prop";

  const relier = async (a, pa, b, pb) => {
    const { texte, erreur } = await outil("connect_pins", { asset_path: bp, graph_name: graphe, source_node_id: a, source_pin_name: pa, target_node_id: b, target_pin_name: pb });
    if (erreur || !/^\s*Connected\b/.test(texte)) throw new Error(`Prop : liaison ${pa} -> ${pb} refusee : ${texte.slice(0, 200)}`);
  };
  const coupe = await outil("disconnect_pin", { asset_path: bp, graph_name: graphe, node_id: derniere.id, pin_name: "then" });
  if (coupe.erreur) throw new Error(`disconnect then : ${coupe.texte}`);
  await relier(derniere.id, "then", pose.nodeId, "execute");
  await relier(pose.nodeId, "then", suite.nodeId, suite.pinName);
  await relier(lire.nodeId, sortieProp, pose.nodeId, "SkeletalMeshComponent");
  return "ajoute";
}

// ── Principal ─────────────────────────────────────────────────────────────────

async function main() {
  if (fonctionSeule && !FONCTIONS[fonctionSeule]) throw Error("Fonction inconnue : " + fonctionSeule);
  let echecs = 0;
  for (const bp of BLUEPRINTS) {
    console.log(`=== ${bp}`);
    try {
      if (!fonctionSeule) console.log(`  composant Prop : ${await ajouterProp(bp)}`);
    } catch (e) {
      echecs++;
      console.log(`  ECHEC    composant Prop : ${e.message}`);
    }
    for (const [nom, construire] of Object.entries(FONCTIONS)) {
      if (fonctionSeule && nom !== fonctionSeule) continue;
      try {
        await construire(bp);
        console.log(`  ecrite   ${nom}`);
      } catch (e) {
        echecs++;
        console.log(`  ECHEC    ${nom} : ${e.message}`);
      }
    }
    const compile = await outil("compile_blueprint", { asset_path: bp });
    const ok = !compile.erreur && !/error|fail/i.test(compile.texte);
    console.log(`  compilation : ${ok ? "OK" : "ECHEC"} ${compile.texte.slice(0, 400).replace(/\s+/g, " ")}`);
    if (!ok) echecs++;
    const nomBp = bp.split("/").pop();
    const sauve = python(`import unreal\nprint('SAUVE', unreal.EditorAssetLibrary.save_asset('${bp}.${nomBp}', only_if_is_dirty=False))`);
    console.log(`  sauvegarde : ${/SAUVE True/.test(sauve) ? "OK" : "ECHEC " + sauve.slice(-200)}`);
    if (!/SAUVE True/.test(sauve)) echecs++;
  }
  console.log(echecs ? `\n${echecs} echec(s).` : "\nToutes les fonctions ecrites, compilees et sauvees.");
  return echecs ? 1 : 0;
}

process.exitCode = await main();