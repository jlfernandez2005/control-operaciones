import {db} from './db.js';
import {unseal,matchTotp} from './security-core.js';
export const mfaContext=(cid,uid)=>`mfa:${cid}:${uid}`;
export const getMfa=async(cid,uid)=>(await db.execute({sql:'SELECT * FROM auth_mfa WHERE company_id=? AND user_id=?',args:[cid,uid]})).rows[0];
export async function consumeMfa(m,code){if(!m)return false;const counter=matchTotp(unseal(m.secret_box,mfaContext(m.company_id,m.user_id)),code,Number(m.last_counter));if(counter===null)return false;const q=await db.execute({sql:'UPDATE auth_mfa SET last_counter=? WHERE company_id=? AND user_id=? AND last_counter<? AND secret_box=?',args:[counter,m.company_id,m.user_id,counter,m.secret_box]});return q.rowsAffected===1;}
