// Schema contains ordinary DDL and PRAGMA statements. Triggers are executed
// separately by periodTriggers(), since their bodies contain semicolons.
// Remove SQL comments outside quoted literals before splitting statements.
export function schemaStatements(sql, {remote=false}={}) {
  const out=[];
  let part='', quote=null;
  const flush=()=>{
    const stmt=part.trim(); part='';
    if(stmt && !(remote && /^PRAGMA\s+journal_mode\b/i.test(stmt))) out.push(stmt);
  };
  for(let i=0;i<sql.length;i++){
    const c=sql[i], next=sql[i+1];
    if(quote){
      part+=c;
      if(c===quote){
        if(quote!==']' && next===quote){part+=next;i++;}
        else quote=null;
      }
      continue;
    }
    if(c==='-' && next==='-'){
      part+=' '; i+=2;
      while(i<sql.length && sql[i]!=='\n' && sql[i]!=='\r')i++;
      if(i<sql.length)part+=sql[i];
      continue;
    }
    if(c==='/' && next==='*'){
      const end=sql.indexOf('*/',i+2);
      if(end<0)throw new Error('Comentario SQL sin cerrar en schema.sql');
      part+=' ';i=end+1;continue;
    }
    if(c==="'" || c==='"' || c==='`' || c==='['){quote=c==='['?']':c;part+=c;continue;}
    if(c===';'){flush();continue;}
    part+=c;
  }
  if(quote)throw new Error('Literal SQL sin cerrar en schema.sql');
  flush();
  return out;
}
