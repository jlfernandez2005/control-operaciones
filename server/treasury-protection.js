import crypto from 'node:crypto';
import {seal,unseal,keyAvailable} from './security-core.js';
export const treasuryContext=(r)=>`treasury:${r.company_id}:${r.kind}:${r.month}:${r.account||''}`;
export function protectedAccount(cid,account){if(!account)return '';if(!keyAvailable())throw Error('Configura PAYROLL_DATA_KEY para proteger los documentos.');return 'h1:'+crypto.createHmac('sha256',Buffer.from(process.env.PAYROLL_DATA_KEY,'base64')).update(JSON.stringify([cid,String(account)])).digest('hex');}
export function encodeTreasury(cid,d){const account=protectedAccount(cid,d.account);return {account,content:seal(d,treasuryContext({company_id:cid,kind:d.kind,month:d.month,account}))};}
export function decodeTreasury(row){const raw=String(row.content_json);const d=/^v[12]\./.test(raw)?unseal(raw,treasuryContext(row)):JSON.parse(raw);if(!d||typeof d!=='object'||!Array.isArray(d.rows))throw Error('Documento de tesorería inválido');return d;}
export function isProtected(row){return /^v[12]\./.test(String(row.content_json));}
