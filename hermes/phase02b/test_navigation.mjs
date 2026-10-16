import assert from 'node:assert/strict';
import {allowedNavigation as allowed} from './navigation_policy.mjs';
const origin='http://127.0.0.1:12345',paths=['/detail'];
assert(allowed(origin+'/detail',origin,paths));
for(const url of [origin+'/refresh','https://example.org/detail',origin+'/http503',origin+'/detail?key=canary','http://user:canary@127.0.0.1:12345/detail','file:///demo','not-a-url'])assert.equal(allowed(url,origin,paths),false);
console.log(JSON.stringify({navigation_positive:1,navigation_negative:7,passed:true}));
