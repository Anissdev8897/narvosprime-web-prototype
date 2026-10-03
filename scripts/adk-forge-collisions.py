"""Corrige les collisions du décor GLB statique de Forge après audit.

Exécuter dans Unreal, après sauvegarde indépendante des paquets recensés dans
ASTRA_forge_collisions_20260915.json. Aucune source GLB ni map n'est modifiée.
"""
import json,traceback,unreal
from pathlib import Path
root=Path(__file__).resolve().parents[1]
audit=json.loads((root/'.hermes/ASTRA_forge_collisions_20260915.json').read_text())
backup=root/'sauvegardes/forge-collisions-20260915'
out={'ok':False,'modified':[],'errors':[]}
try:
 assert audit['ok'] and len(audit['meshes'])==623
 for row in audit['meshes']:
  path=row['path'];assert path.startswith('/Game/Narvos/chunks_unreal_v3/')
  assert (backup/(path.split('/')[-1]+'.uasset')).is_file(),path
  mesh=unreal.load_asset(path);assert mesh,path
  body=mesh.get_editor_property('body_setup');assert body,path
  # Une enveloppe convexe unique bouche les vallées et espaces entre objets.
  # Ces meshes ne sont jamais simulés : ils servent au décor StaticMesh Lua.
  body.set_editor_property('collision_trace_flag',unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
  assert unreal.EditorAssetLibrary.save_loaded_asset(mesh,False),path
  assert body.get_editor_property('collision_trace_flag')==unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE,path
  out['modified'].append(path)
 out['ok']=True
except Exception:out['errors'].append(traceback.format_exc())
(root/'.hermes/ASTRA_forge_collisions_reparation_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')