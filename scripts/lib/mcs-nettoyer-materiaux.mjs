// Après affectation du nouveau mesh, libérer ses slots des overrides précédents.
// GetMaterials est BlueprintCallable en UE5.7 ; EmptyOverrideMaterials ne l'est pas.
// Chaque nouveau mesh est traité, même après un emplacement vide ou plus petit :
// un ancien override hors plage ne pourra donc pas redevenir visible au prochain choix.
import { outil, outilJson } from './ue-mcp-client.mjs';

export async function brancherNettoyageMateriaux({bp, graph='NarvosMaillage', entree, composant, sortieComposant, apres, suite}) {
  const ctx = {asset_path:bp, graph_name:graph};
  let x=700;
  async function appel(target,function_name) {
    const r=await outilJson('add_function_call_node',{...ctx,target,function_name,node_x:x+=230,node_y:550});
    return r.nodeId;
  }
  async function lien(a,pa,b,pb) {
    const r=await outil('connect_pins',{...ctx,source_node_id:a,source_pin_name:pa,target_node_id:b,target_pin_name:pb});
    if(r.erreur||!/^Connected/.test(r.texte.trim()))throw Error(r.texte);
  }
  let condition;
  for(const nom of ['Torso','Legs','Feet','Prop']) {
    const egal=await appel('KismetStringLibrary','EqualEqual_StrStr');
    await lien(entree,'Composant',egal,'A');
    const r=await outil('set_pin_default_value',{...ctx,node_id:egal,pin_name:'B',default_value:nom});
    if(r.erreur)throw Error(r.texte);
    if(condition) {
      const ou=await appel('KismetMathLibrary','BooleanOR');
      await lien(condition,'ReturnValue',ou,'A');
      await lien(egal,'ReturnValue',ou,'B');
      condition=ou;
    } else condition=egal;
  }
  const branche=await outilJson('add_branch_node',{...ctx,node_x:x+=230,node_y:550});
  const si=branche.nodeId??branche.node_id;
  await lien(apres,'then',si,'execute');
  await lien(condition,'ReturnValue',si,'Condition');
  await lien(si,'else',suite,'execute');
  const liste=await appel('MeshComponent','GetMaterials');
  await lien(composant,sortieComposant,liste,'self');
  const boucle=await outilJson('add_for_each_loop_node',{...ctx,with_break:false,node_x:x+=230,node_y:550});
  await lien(si,'then',boucle.nodeId,'Exec');
  await lien(liste,'ReturnValue',boucle.nodeId,'Array');
  const vider=await appel('PrimitiveComponent','SetMaterial');
  await lien(boucle.nodeId,'LoopBody',vider,'execute');
  await lien(boucle.nodeId,'Array Index',vider,'ElementIndex');
  await lien(composant,sortieComposant,vider,'self');
  // Material non raccordé = None : reprendre le matériau du mesh, pas un substitut.
  await lien(boucle.nodeId,'Completed',suite,'execute');
}