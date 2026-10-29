import test from 'node:test';import assert from 'node:assert/strict';
import {readTables,observationTime} from '../ego/table_readback.mjs';
import {tools,validateToolCall,guide} from '../ego/policy.mjs';
const cell=(parts,header=false)=>['        '+(header?'column_header':'table_cell'),...parts.map(p=>'          text '+JSON.stringify(p))].join('\n');
function split(headers,rows,{extra=false}={}){
 return ['root','  container','    table','      table_row',...headers.map(h=>cell([h])),'    container','      table',...rows.flatMap(row=>['        table_row',...row.map(parts=>cell(parts).split('\n').map(l=>'  '+l).join('\n'))]),...(extra?['    table','      table_row',cell(['unrelated']),cell(['competing'])]:[])].join('\n');
}
function direct(headers,rows){return ['root','  table','    row',...headers.map(h=>cell([h],true).split('\n').map(l=>l.slice(2)).join('\n')),...rows.flatMap(row=>['    row',...row.map(p=>cell(p).split('\n').map(l=>l.slice(2)).join('\n'))])].join('\n');}
test('source headers keep record IDs separate from contact identifiers, even when reordered',()=>{
 const r=readTables(split(['采集员','设备 ID'],[[['合成员工甲','SIM-CONTACT-A'],['SIM-DEVICE-001']],[['合成员工乙','SIM-CONTACT-B'],['SIM-DEVICE-002']]]));
 assert.equal(r.tables.length,1);assert.deepEqual(r.tables[0].rows[0].by_column['设备 ID'],['SIM-DEVICE-001']);assert.deepEqual(r.tables[0].rows[0].by_column['采集员'],['合成员工甲','SIM-CONTACT-A']);
});
test('blank category, group counts and dash values remain independent with an explicit blank layout row',()=>{
 const records=Array.from({length:19},(_,i)=>[[`SIM-${i}`],[],i<10?['工厂组']:i<13?['商超仓库类']:[],['—']]);
 const r=readTables(split(['设备 ID','设备类别','设备分组','软件版本'],[[[],[],[],[]],...records])).tables[0];
 assert.equal(r.raw_body_rows,20);assert.equal(r.nonempty_rows_observed,19);assert.equal(r.returned_rows,19);assert.equal(r.all_blank_rows_not_treated_as_records.length,1);
 const by=Object.fromEntries(r.column_statistics.map(s=>[s.column,s]));assert.equal(by['设备类别'].blank_cells,19);
 assert.deepEqual(by['设备分组'].value_counts.map(x=>[x.display_parts,x.count]),[[['工厂组'],10],[['商超仓库类'],3],[[],6]]);
 assert.deepEqual(by['软件版本'].value_counts,[{display_parts:['—'],count:19}]);assert.equal(by['设备 ID'].value_counts,null);assert(r.column_statistics.every(s=>s.count_sum_matches_rows));
});
test('duplicate labels or unequal widths do not silently map values to guessed fields',()=>{
 assert.equal(readTables(split(['ID','ID'],[[['a'],['b']],[['c'],['d']]])).tables.length,0);
 const bad=readTables(split(['ID','状态'],[[['a']],[['b'],['ok']]]));assert.equal(bad.tables.length,0);assert(bad.unresolved.some(x=>x.reason==='column_width_or_span_mismatch'));
});
test('unrelated or ambiguous split tables remain unresolved',()=>{
 const r=readTables(split(['ID','状态'],[[['a'],['ok']],[['b'],['ok']]],{extra:true}));assert.equal(r.tables.length,0);
 assert.equal(readTables(split(['ID','状态'],[[['a'],['ok']]])).tables.length,0,'single-row implicit pairing is not proof');
});
test('a separate one-cell pagination/layout table does not erase valid split-column evidence',()=>{
 const s=split(['ID','状态'],[[['a'],['ok']],[['b'],['ok']]])+'\n    table\n      table_row\n'+cell(['synthetic page count']);
 assert.equal(readTables(s).tables[0].returned_rows,2);
});
test('explicit headers support a standard single table without page-specific selectors',()=>{
 const r=readTables(direct(['编号','原始小时'],[[['SIM-01'],['01.50']]]));assert.equal(r.tables.length,1);assert.equal(r.tables[0].mapping,'explicit_header_cells');assert.deepEqual(r.tables[0].rows[0].by_column['原始小时'],['01.50']);
});
test('sensitive-labeled columns are suppressed in readback and never treated as a countable constant',()=>{
 const r=readTables(direct(['编号','Token'],[[['SIM-01'],['SYNTHETIC-NOT-A-CREDENTIAL']]]));assert.equal(r.tables.length,1);assert(!JSON.stringify(r).includes('SYNTHETIC-NOT-A-CREDENTIAL'));assert.equal(r.tables[0].column_statistics[1].counts_unavailable,true);
});
test('truncated statistics explicitly count only returned rows',()=>{
 const r=readTables(split(['ID','状态'],[[['a'],['ok']],[['b'],['ok']],[['c'],[]]]),{maxRows:2}).tables[0];assert.equal(r.nonempty_rows_observed,3);assert.equal(r.returned_rows,2);assert.equal(r.truncated,true);assert.equal(r.column_statistics[1].rows_counted,2);assert.equal(r.column_statistics[1].value_counts[0].count,2);
});
test('malformed/oversized/deep snapshots do not produce invented records',()=>{
 assert.equal(readTables(null).tables.length,0);assert.equal(readTables('x'.repeat(1000001)).unresolved[0].reason,'snapshot_size_unsupported');
 const deep=Array.from({length:140},(_,i)=>' '.repeat(i)+'container').join('\n');assert.equal(readTables(deep).unresolved[0].reason,'snapshot_nesting_limit');
});
test('observation time explicitly preserves UTC and Asia/Shanghai morning',()=>{
 assert.deepEqual(observationTime(new Date('2026-10-29T03:36:11Z')),{utc:'2026-10-29T03:36:11.000Z',local:'2026-10-29T11:36:11+08:00',timezone:'Asia/Shanghai'});
});
test('read formats/reporting guide add no business workflow, writable tool, or arbitrary code input',()=>{
 assert.equal(tools.length,8);for(const format of ['tables','snapshot','both'])validateToolCall('ego_browser_observe',{format});
 assert.throws(()=>validateToolCall('ego_browser_observe',{format:'execute'}));assert.throws(()=>validateToolCall('ego_browser_observe',{javascript:'arbitrary code'}));assert(guide.reporting.includes('Choose your own'));assert(!guide.reporting.includes('/device-management'));
});
