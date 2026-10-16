// Read dependency manifests only; never import the old business server.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const [anchor,output]=process.argv.slice(2);
const root=path.join(path.dirname(fs.realpathSync(anchor)),'node_modules');
const out=path.resolve(output);
if(out.toLowerCase().startsWith(root.toLowerCase()+path.sep))throw Error('Output cannot be in original dependencies');
const found=new Map(),missingOptional=[];
function find(name,parent,optional=false){
 const req=createRequire(parent);
 for(const candidate of req.resolve.paths(name)||[]){
  const file=path.join(candidate,name,'package.json');
  if(!fs.existsSync(file))continue;
  const real=fs.realpathSync(file);
  if(!real.startsWith(root+path.sep))throw Error('Dependency resolves outside the approved vendor root');
  const manifest=JSON.parse(fs.readFileSync(real,'utf8'));
  if(manifest.name!==name)throw Error('Unexpected dependency name');
  return {file:real,dir:path.dirname(real),manifest};
 }
 if(optional){missingOptional.push(name);return null;}
 throw Error('Required installed dependency missing: '+name);
}
function visit(pkg){
 if(!pkg||found.has(pkg.dir))return;
 if(found.size>=300)throw Error('Bounded dependency graph limit exceeded');
 found.set(pkg.dir,{source:pkg.dir,relative:path.relative(root,pkg.dir),name:pkg.manifest.name,version:pkg.manifest.version,license:pkg.manifest.license||null});
 for(const name of Object.keys(pkg.manifest.dependencies||{}))visit(find(name,pkg.file));
 for(const name of Object.keys(pkg.manifest.optionalDependencies||{}))visit(find(name,pkg.file,true));
 for(const name of Object.keys(pkg.manifest.peerDependencies||{}))visit(find(name,pkg.file,!!pkg.manifest.peerDependenciesMeta?.[name]?.optional));
}
visit(find('@modelcontextprotocol/sdk',path.resolve(anchor)));
const payload={sourceRoot:root,packages:[...found.values()],missingOptional:[...new Set(missingOptional)],oldBusinessServerImported:false};
fs.writeFileSync(out,JSON.stringify(payload,null,2));
console.log(JSON.stringify({packages:found.size,sdk:payload.packages.find(p=>p.name==='@modelcontextprotocol/sdk').version,oldBusinessServerImported:false}));
