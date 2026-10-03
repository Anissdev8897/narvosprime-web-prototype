import unreal
b=unreal.load_asset('/Game/Narvos/PontMetaHuman/ABP_NarvosPersonnalisationCorps')
try:
 v=b.get_editor_property('new_variables')
 print('VARS',len(v),[(str(x.var_name),str(x.var_type)) for x in v if str(x.var_name) in ['Main_Save_Slot','Save_Game_Data']])
except Exception as e: print(type(e).__name__,str(e))