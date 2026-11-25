import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
let active=0;
export function financeWorker(mode,payload){
 if(active>=1)return Promise.reject(Object.assign(new Error('Hay otra importación o exportación en curso. Intenta nuevamente.'),{status:429}));
 active++;
 return new Promise((resolve,reject)=>{
  const child=spawn(process.env.FINANCE_PYTHON||'python3',[fileURLToPath(new URL('../scripts/finance_io.py',import.meta.url)),mode],{stdio:['pipe','pipe','pipe'],env:{PATH:process.env.PATH,LANG:'C.UTF-8',PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});
  let out=[],size=0,err='',reason='';const timer=setTimeout(()=>{reason='El documento excedió el tiempo de procesamiento.';child.kill('SIGKILL');},90000);
  child.stdout.on('data',b=>{size+=b.length;if(size>24*1024*1024){reason='El resultado es demasiado grande.';child.kill('SIGKILL');}else out.push(b);});
  child.stderr.on('data',b=>{if(err.length<3000)err+=b.toString().slice(0,3000-err.length);});
  child.stdin.on('error',()=>{});
  child.on('error',e=>{reason='Motor de documentos no disponible. Verifica Python y sus dependencias.';});
  child.on('close',code=>{clearTimeout(timer);active--;if(code!==0||reason)return reject(Object.assign(new Error(reason||err.trim().slice(0,500)||'No se pudo procesar el documento.'),{status:422}));resolve(Buffer.concat(out));});
  child.stdin.end(JSON.stringify(payload));
 });
}
