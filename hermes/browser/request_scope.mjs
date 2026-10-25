// Synthetic workplace grants, not a business workflow or production API policy.
// Reads remain free; the Agent chooses its own order and interaction method.
const grants={
 'read-only':[],
 analysis:['/api/qa-refresh'],
 binding:['/api/projects','/api/tasks','/api/reorder'],
 recovery:['/api/projects','/api/reorder'],
};

export function requestScope(caseId='read-only'){
 if(!Object.hasOwn(grants,caseId))throw Error('Unknown synthetic task scope');
 const writes=new Set(grants[caseId]);
 return{caseId,allows(method,pathname){
  if(method==='GET'||method==='HEAD')return true;
  return method==='POST'&&writes.has(pathname);
 }};
}
