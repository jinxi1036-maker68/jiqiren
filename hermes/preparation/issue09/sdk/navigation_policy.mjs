// Unchanged simulation boundary inherited from PR #8.
export function allowedNavigation(value,origin,paths){
 try{const target=new URL(value),base=new URL(origin);return base.hostname==='127.0.0.1'&&target.origin===base.origin&&!target.username&&!target.password&&!target.search&&paths.includes(target.pathname);}catch{return false;}
}

