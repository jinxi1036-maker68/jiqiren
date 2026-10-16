// Explicit neutral SDK resolution. No search/fallback into old business tools.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
export function resolveSdk(anchor){
 if(typeof anchor!=='string'||!path.isAbsolute(anchor))throw Error('An absolute neutral sdkAnchorPackage is required');
 const realAnchor=fs.realpathSync(anchor);
 const legacy=value=>value.toLowerCase().split(/[\\/]/).includes('xianyu-browser-tools');
 if(legacy(realAnchor))throw Error('Old business SDK anchor is forbidden');
 const req=createRequire(realAnchor);
 const pkgRoot=fs.realpathSync(path.join(path.dirname(realAnchor),'node_modules/@modelcontextprotocol/sdk'));
 if(legacy(pkgRoot))throw Error('Old business SDK package is forbidden');
 const manifest=JSON.parse(fs.readFileSync(path.join(pkgRoot,'package.json'),'utf8'));
 if(manifest.name!=='@modelcontextprotocol/sdk'||manifest.version!=='1.30.0')throw Error('Expected the pinned SDK 1.30.0');
 const load=module=>{
  const resolved=fs.realpathSync(req.resolve('@modelcontextprotocol/sdk/'+module));
  if(legacy(resolved)||!resolved.startsWith(pkgRoot+path.sep))throw Error('SDK resolved outside the explicitly selected neutral package');
  return req(resolved);
 };
 return {...load('client/index.js'),...load('client/stdio.js'),...load('server/index.js'),...load('server/stdio.js'),...load('types.js'),sdkVersion:manifest.version,sdkRoot:pkgRoot};
}
