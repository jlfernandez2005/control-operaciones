import crypto from 'node:crypto';
export function parseKey(s){if(!/^[A-Za-z0-9+/]{43}=$/.test(s||''))throw Error('Clave de cifrado inválida: requiere 32 bytes en Base64.');const k=Buffer.from(s,'base64');if(k.length!==32||k.toString('base64')!==s)throw Error('Clave de cifrado inválida.');return k;}
function key(){return parseKey(process.env.PAYROLL_DATA_KEY);}
export function activeKey(){return process.env.SISFIA_ENCRYPTION_KEY?parseKey(process.env.SISFIA_ENCRYPTION_KEY):key();}
export const keyAvailable=()=>{try{key();activeKey();return true}catch{return false}};
export function sealWithKey(value,context,k,version='v2'){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',k,iv);c.setAAD(Buffer.from(context));const out=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);return [version,iv.toString('base64'),c.getAuthTag().toString('base64'),out.toString('base64')].join('.');}
export function seal(value,context){return sealWithKey(value,context,activeKey(),process.env.SISFIA_ENCRYPTION_KEY?'v2':'v1');}
export function unsealWithKey(value,context,k){const [v,i,t,c,...rest]=String(value).split('.');if(!['v1','v2'].includes(v)||!c||rest.length)throw Error('Formato cifrado inválido');const iv=Buffer.from(i,'base64'),tag=Buffer.from(t,'base64');if(iv.length!==12||tag.length!==16)throw Error('Formato cifrado inválido');const d=crypto.createDecipheriv('aes-256-gcm',k,iv);d.setAAD(Buffer.from(context));d.setAuthTag(tag);return JSON.parse(Buffer.concat([d.update(Buffer.from(c,'base64')),d.final()]).toString('utf8'));}
export function unseal(value,context){return unsealWithKey(value,context,String(value).startsWith('v1.')?key():parseKey(process.env.SISFIA_ENCRYPTION_KEY));}
export const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newTotp(){let s='',bits=0,v=0;for(const x of crypto.randomBytes(20)){v=(v<<8)|x;bits+=8;while(bits>=5){s+=alphabet[(v>>>(bits-5))&31];bits-=5;}}return s;}
function decode(s){let v=0,bits=0,out=[];for(const c of s){const x=alphabet.indexOf(c);if(x<0)throw Error('TOTP inválido');v=(v<<5)|x;bits+=5;if(bits>=8){out.push((v>>>(bits-8))&255);bits-=8;}}return Buffer.from(out);}
export function totp(secret,counter){const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(counter));const h=crypto.createHmac('sha1',decode(secret)).update(b).digest(),i=h[h.length-1]&15;return String((h.readUInt32BE(i)&0x7fffffff)%1000000).padStart(6,'0');}
export function matchTotp(secret,code,last=-1,now=Date.now()){if(!/^\d{6}$/.test(String(code)))return null;const t=Math.floor(now/30000);for(const c of [t,t-1,t+1])if(c>last&&c>=0&&crypto.timingSafeEqual(Buffer.from(totp(secret,c)),Buffer.from(String(code))))return c;return null;}
export function employeeCode(cid,value){return 'EMP-'+crypto.createHmac('sha256',key()).update(`employee:${cid}:${value}`).digest('hex').slice(0,20).toUpperCase();}
