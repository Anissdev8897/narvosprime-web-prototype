import fs from 'node:fs';
const root='E:/narvosprime-web-prototype';
const contracts=JSON.parse(fs.readFileSync(root+'/.hermes/ASTRA_face_contrats_20260915.json','utf8'));
const definitions=[
 ['EyePositionV_Slider_646','Yeux : hauteur','EnableBrowShapeCheckBox_0'],
 ['EyePositionH_Slider_549','Yeux : écart','EyePositionHCheckbox'],
 ['EyeShape_Slider_708','Yeux : forme','Eye_ShapeCheckBox_0'],
 ['EyeShapeIntensity_Slider_338','Yeux : intensité','EyeShapeIntensityCheckbox'],
 ['BrowShape_Slider_401','Arcades : forme','BrowShapeCheckbox'],
 ['EarShapeSlider_478','Oreilles : forme','EarShapeCheckbox'],
 ['NoseShape_Slider','Nez : forme','NoseShapeCheckBox_0'],
 ['NoseShapeIntensitySlider_305','Nez : intensité','NoseShapeIntensityCheckbox'],
 ['UpperLipSize_Slider','Lèvre supérieure','UpperLipSizeCheckBox_0'],
 ['LowerLipSize_Slider_448','Lèvre inférieure','LowerLipSizeCheckbox'],
 ['LipShapeSlider_305','Bouche : forme','LipShapeCheckbox'],
 ['LipShapeIntansitySlider_305','Bouche : intensité','LipShapeIntansityCheckbox'],
 ['MouthWidthSlider_305','Bouche : largeur','MouthWidthCheckbox'],
 ['Jaw_Shape_Slider_338','Mâchoire : forme','JawShapeCheckbox'],
 ['JawShapeSlider_96','Mâchoire : intensité','JawShapeIntensityCheckbox'],
];
const curseurs=definitions.map(([name,label,checkbox])=>{
 const row=contracts.sliders.find(r=>r.name===name),check=contracts.checkboxes.find(r=>r.name===checkbox);
 const vars=[...new Set(row.mappings.flatMap(m=>m.variables))],activation=[...new Set(check.mappings.flatMap(m=>m.variables))];
 if(vars.length!==1||activation.length!==1||!row.bounds)throw Error('Contrat ambigu '+name);
 return {id:vars[0].toLowerCase(),label,variable:vars[0],min:row.bounds.min_value,max:row.bounds.max_value,defaut:row.bounds.value,pas:row.bounds.step_size,activation,preuve_widget:name,preuve_case:checkbox};
});
fs.writeFileSync(root+'/.hermes/ASTRA_face_candidats_20260915.json',JSON.stringify({qualified:false,curseurs,excluded:{EyeBrow_Slider_594:'Variable Clavicle_pec_r_Size sans consommateur facial identifié',FaceTypeSlider_478:'Aucune variable du postprocess reliée'}},null,2));
console.log(curseurs.length,'contrats candidats ; qualification géométrique requise');