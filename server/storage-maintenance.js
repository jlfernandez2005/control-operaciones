import {seal,sealWithKey,unseal,parseKey,keyAvailable} from './security-core.js';
import {decodeTreasury,protectedAccount,treasuryContext,isProtected} from './treasury-protection.js';
const sql=(sql,...args)=>({sql,args});
// All operations happen in a caller-owned transaction. In dry-run no rows are changed.
export async function protectStorage(tx,{nextKey=null,apply=false}={}){
 if(!keyAvailable())throw Error('Configura la clave original y, si corresponde, la clave activa.');
 const next=nextKey?parseKey(nextKey):null;
 if(nextKey&&nextKey===process.env.PAYROLL_DATA_KEY)throw Error('La nueva clave de cifrado debe ser independiente de la clave original.');
 const pack=(d,c)=>next?sealWithKey(d,c,next):seal(d,c);
 const counts={treasury:0,payroll:0,history:0,mfa:0};
 const treasury=(await tx.execute('SELECT * FROM treasury_documents ORDER BY id')).rows;
 const accounts=new Set();
 for(const r of treasury){const d=decodeTreasury(r);if(d.kind!==r.kind||d.month!==r.month)throw Error('Metadatos de tesorería inconsistentes');const account=protectedAccount(r.company_id,d.account);const k=JSON.stringify([r.company_id,r.kind,r.month,account]);if(accounts.has(k))throw Error('Duplicidad de cuenta/periodo: resolver antes de migrar.');accounts.add(k);if(!next&&isProtected(r)&&r.account===account)continue;const content=pack(d,treasuryContext({...r,account}));counts.treasury++;if(apply)await tx.execute(sql('UPDATE treasury_documents SET account=?,content_json=? WHERE id=? AND company_id=?',account,content,r.id,r.company_id));}
 if(next){
  for(const [table,query,where,context,category,field] of [
   ['payroll_documents','SELECT * FROM payroll_documents','id=? AND company_id=?',r=>`payroll:${r.company_id}:${r.period}:${r.kind}`,'payroll','content_box'],
   ['payroll_history','SELECT h.*,d.period,d.kind FROM payroll_history h JOIN payroll_documents d ON d.id=h.document_id AND d.company_id=h.company_id','document_id=? AND company_id=? AND revision=?',r=>`payroll:${r.company_id}:${r.period}:${r.kind}`,'history','content_box'],
   ['auth_mfa','SELECT * FROM auth_mfa','user_id=? AND company_id=?',r=>`mfa:${r.company_id}:${r.user_id}`,'mfa','secret_box']]){
   const rows=(await tx.execute(query)).rows;
   for(const r of rows){const c=context(r),v=pack(unseal(r[field],c),c),args=category==='history'?[r.document_id,r.company_id,r.revision]:[category==='mfa'?r.user_id:r.id,r.company_id];counts[category]++;if(apply)await tx.execute(sql(`UPDATE ${table} SET ${field}=? WHERE ${where}`,v,...args));}
  }
  for(const r of (await tx.execute('SELECT * FROM erp_attachments')).rows){const c=`erp-document:${r.company_id}:${r.record_id}`,v=pack(unseal(r.content_box,c),c);counts.documents=(counts.documents||0)+1;if(apply)await tx.execute(sql('UPDATE erp_attachments SET content_box=? WHERE company_id=? AND record_id=?',v,r.company_id,r.record_id));}
  if(apply)await tx.execute('DELETE FROM auth_sessions');
 }
 return counts;
}
// On startup detect missing/wrong keys without displaying any decrypted values.
export async function verifyStorageKeys(tx){
 for(const version of ['v1.','v2.']){
  const t=(await tx.execute(sql('SELECT * FROM treasury_documents WHERE substr(content_json,1,3)=? LIMIT 1',version))).rows[0];if(t)decodeTreasury(t);
  const p=(await tx.execute(sql('SELECT * FROM payroll_documents WHERE substr(content_box,1,3)=? LIMIT 1',version))).rows[0];if(p)unseal(p.content_box,`payroll:${p.company_id}:${p.period}:${p.kind}`);
  const h=(await tx.execute(sql('SELECT h.*,d.period,d.kind FROM payroll_history h JOIN payroll_documents d ON d.id=h.document_id AND d.company_id=h.company_id WHERE substr(h.content_box,1,3)=? LIMIT 1',version))).rows[0];if(h)unseal(h.content_box,`payroll:${h.company_id}:${h.period}:${h.kind}`);
  const a=(await tx.execute(sql('SELECT * FROM erp_attachments WHERE substr(content_box,1,3)=? LIMIT 1',version))).rows[0];if(a)unseal(a.content_box,`erp-document:${a.company_id}:${a.record_id}`);
  const m=(await tx.execute(sql('SELECT * FROM auth_mfa WHERE substr(secret_box,1,3)=? LIMIT 1',version))).rows[0];if(m)unseal(m.secret_box,`mfa:${m.company_id}:${m.user_id}`);
 }
}
