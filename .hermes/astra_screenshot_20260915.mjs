import fs from 'node:fs';
import {rpc} from '../scripts/lib/ue-mcp-client.mjs';
const r=await rpc('tools/call',{name:'take_screenshot',arguments:{width:1280,height:900,quality:85}});
for(const c of r.content??[])if(c.type==='image'){
 const path='.hermes/ASTRA_work_preview_20260915.'+(c.mimeType.includes('png')?'png':'jpg');
 fs.writeFileSync(path,Buffer.from(c.data,'base64'));console.log(path);
}else if(c.type==='text')console.log(c.text.slice(0,300));