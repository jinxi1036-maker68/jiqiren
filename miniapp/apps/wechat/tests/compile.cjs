const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const { runtime } = require('./harness.cjs');

const compiler = require(process.env.LINGJU_COMPILER || 'miniprogram-compiler');
const r = runtime();
const manifest = require('../app.json');
const wxml = compiler.wxmlToJs(r.root);
const wxss = compiler.wxssToJs(r.root);
assert.ok(typeof wxml === 'string' && wxml.length > 0, String(wxml));
assert.ok(typeof wxss === 'string' && wxss.length > 0, String(wxss));
const render = new Function('window', 'global', wxml)({}, {});

for (const route of manifest.pages) {
  for (const ext of ['js', 'json', 'wxml']) assert.ok(existsSync(path.join(r.root, route + '.' + ext)));
  const pageName = route.split('/')[1];
  const page = r.open(pageName, pageName === 'task' ? { id: 's1' } : {});
  const view = render(route + '.wxml')(page.data);
  assert.equal(view.tag, 'wx-page');
  assert.ok(view.children.length);
  const template = readFileSync(path.join(r.root, route + '.wxml'), 'utf8');
  for (const [, handler] of template.matchAll(/\b(?:bind|catch)[a-z]+="([\w]+)"/g)) {
    assert.equal(typeof page[handler], 'function', route + ' missing handler ' + handler);
  }
  console.log('WXML compiled and rendered:', route);
}
console.log('WXSS compiled:', wxss.length, 'characters');
