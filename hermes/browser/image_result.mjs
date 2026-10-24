// Only attach a just-created screenshot from this run's controlled output root.
import fs from 'node:fs/promises';
import path from 'node:path';
export async function attachScreenshot(result,args,output){
 if(result.isError||(result.content||[]).some(b=>b.type==='image')||!args.filename)return result;
 const base=await fs.realpath(output),p=await fs.realpath(path.resolve(base,args.filename));
 if(!p.startsWith(base+path.sep))throw Error('Screenshot escaped run output');
 const bytes=await fs.readFile(p);
 if(bytes.length>4*1024*1024)throw Error('Screenshot exceeds 4 MiB attachment limit');
 let mimeType;
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mimeType='image/png';
 else if(bytes[0]===255&&bytes[1]===216)mimeType='image/jpeg';
 else if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')mimeType='image/webp';
 else throw Error('Screenshot is not a supported image');
 return{...result,content:[...(result.content||[]),{type:'image',mimeType,data:bytes.toString('base64')}]};
}
