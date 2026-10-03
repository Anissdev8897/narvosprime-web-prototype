import fs from 'node:fs';
const dir='E:/narvosprime-web-prototype/.hermes';
const read=n=>JSON.parse(fs.readFileSync(`${dir}/ASTRA_${n}_20260915.json`,'utf8'));
const widget=read('face_widget_pins'),abp=read('face_source_EventGraph'),anim=read('face_source_AnimGraph');
const byId=new Map(widget.nodes.map(n=>[n.id,n]));
function sets(start) {
 const queue=[start],seen=new Set(),result=[];
 while(queue.length) {
  const n=queue.shift();if(!n||seen.has(n.id))continue;seen.add(n.id);
  if(n.class==='K2Node_VariableSet')result.push(n.name.slice(4));
  for(const p of n.pins??[])if(p.direction==='Output'&&p.type==='exec')for(const c of p.connections)queue.push(byId.get(c.nodeId));
 }
 return result;
}
const abpById=new Map(abp.nodes.map(n=>[n.id,n]));const mapped={};
for(const n of abp.nodes) {
 if(n.class!=='K2Node_VariableSet')continue;
 const variable=n.name.slice(4);
 const p=n.pins.find(p=>p.direction==='Input'&&p.name===variable);
 for(const c of p?.connections??[]) {
  const src=abpById.get(c.nodeId);
  if(src?.class==='K2Node_VariableGet') (mapped[src.name.slice(4)]??=new Set()).add(variable);
 }
}
const getters=new Set(anim.nodes.filter(n=>n.class==='K2Node_VariableGet').map(n=>n.name.slice(4)));
const result={sliders:[],checkboxes:[]};const bounds=read('widgets_voitures').sliders;
for(const n of widget.nodes) {
 const slider=n.name.match(/^On Value Changed \((.+)\)$/),check=n.name.match(/^On Check State Changed \((.+)\)$/);
 if(!slider&&!check)continue;
 const values=sets(n);
 const rows=values.map(field=>({field,variables:[...(mapped[field]??[])],read_by_animgraph:[...(mapped[field]??[])].filter(v=>getters.has(v))}));
 result[slider?'sliders':'checkboxes'].push({name:(slider??check)[1],bounds:bounds[(slider??check)[1]],mappings:rows});
}
fs.writeFileSync(`${dir}/ASTRA_face_contrats_20260915.json`,JSON.stringify(result,null,2));
for(const row of result.sliders)console.log(row.name,JSON.stringify(row.mappings.filter(x=>x.variables.length)));