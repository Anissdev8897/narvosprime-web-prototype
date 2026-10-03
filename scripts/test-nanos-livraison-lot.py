import importlib.util,unittest,tomllib
from pathlib import Path
spec=importlib.util.spec_from_file_location('livraison',Path(__file__).with_name('nanos-livraison-lot.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class Livraison(unittest.TestCase):
 def test_cook_scope(self):
  p='/Game/Narvos/Maps/Map_Megastructure'
  m.check_scope({'required_packages':[p]},[p,'/Game/Narvos/Other'])
  for process,packages in [({},[p]),({'required_packages':[]},[p]),({'required_packages':[p]},[]),({'required_packages':['/Game/Elsewhere']},[p])]:
   with self.subTest(process=process),self.assertRaises(ValueError):m.check_scope(process,packages)

 def test_cook_gate(self):
  good={'status':'exited','exit_code':0};done='LogCook: Display: Cooked packages 100 Packages Remain 0 Total 100'
  m.check_cook(good,done)
  for p in [{'status':'running','exit_code':0},{'status':'exited','exit_code':1},{'status':'exited'}]:
   with self.subTest(p=p),self.assertRaises(ValueError):m.check_cook(p,done)
  for error in ['LogBlueprint: Error: bad class','Default Material will be used in game.',"Cooking a material resource that doesn't have a valid ShaderMap",'Failed to compile Material for platform SM6','Unable to find package for cooking']:
   with self.subTest(error=error),self.assertRaises(ValueError):m.check_cook(good,done+'\n'+error)
  with self.assertRaises(ValueError):m.check_cook(good,'still running')

 def test_preserve_manifest_keys(self):
  text='[unreal]\nunreal_version="5.7.4"\n[assets]\n[assets.static_meshes]\nSM_Ship="Narvos/Old/SM_Ship"\nSM_Ship_2="Narvos/Other/SM_Ship"\n[assets.maps]\nMap_Alien="Narvos/Maps/Map_Alien"\n'
  rows=[{'nom':'SM_Ship','classe':'StaticMesh','paquet':'/Game/Narvos/New/SM_Ship'},
        {'nom':'Map_Alien','classe':'World','paquet':'/Game/Narvos/Maps/Map_Alien'},
        {'nom':'Map_Megastructure','classe':'World','paquet':'/Game/Narvos/Maps/Map_Megastructure'},
        {'nom':'BP_New','classe':'Blueprint','paquet':'/Game/Narvos/New/BP_New'},
        {'nom':'T_Texture','classe':'Texture2D','paquet':'/Game/Narvos/New/T_Texture'}]
  result,added=m.extend_manifest(text,rows);data=tomllib.loads(result)
  self.assertEqual(data['assets']['static_meshes']['SM_Ship'],'Narvos/Old/SM_Ship')
  self.assertEqual(data['assets']['static_meshes']['SM_Ship_2'],'Narvos/Other/SM_Ship')
  self.assertEqual(data['assets']['static_meshes']['SM_Ship_3'],'Narvos/New/SM_Ship')
  self.assertEqual(data['assets']['maps']['Map_Alien'],'Narvos/Maps/Map_Alien')
  self.assertEqual(data['assets']['maps']['Map_Megastructure'],'Narvos/Maps/Map_Megastructure')
  self.assertEqual(data['assets']['blueprints']['BP_New'],'Narvos/New/BP_New')
  self.assertEqual(len(added),3)
  second,added2=m.extend_manifest(result,rows)
  self.assertEqual(tomllib.loads(second),data);self.assertEqual(added2,[])
  for row in [{'nom':'Bad+Key','classe':'StaticMesh','paquet':'/Game/Narvos/Bad'}, {'nom':'Outside','classe':'StaticMesh','paquet':'/Game/Outside'}]:
   with self.subTest(row=row),self.assertRaises(ValueError):m.extend_manifest(text,[row])

 def test_identifier(self):
  self.assertEqual(m.identifier('astra-20260915_03'),'astra-20260915_03')
  for value in ['../narvos','D:/foo','', 'a/b', 'a\\b', 'a'*81]:
   with self.subTest(value=value),self.assertRaises(ValueError):m.identifier(value)

if __name__=='__main__':unittest.main()