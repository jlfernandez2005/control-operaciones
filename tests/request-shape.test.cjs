const test=require('node:test'); const assert=require('node:assert/strict');
const load=()=>import('../server/request-shape.js');
test('permite máximo existente de referencia mensual y archivos codificados',async()=>{const {requestShapeOK:f}=await load();assert.equal(f({rows:Array.from({length:3000},()=>({date:'2026-11-27',concept:'Prueba',amount:1,reference:'1'}))}),true);assert.equal(f({data:'A'.repeat(12_000_000)}),true);});
test('rechaza colecciones y objetos excesivos antes del esquema',async()=>{const {requestShapeOK:f}=await load();assert.equal(f({rows:Array(3001).fill(0)}),false);assert.equal(f(Object.fromEntries(Array.from({length:129},(_,i)=>[i,0]))),false);});
test('rechaza anidamiento y complejidad acumulada',async()=>{const {requestShapeOK:f}=await load();let x=0;for(let i=0;i<21;i++)x=[x];assert.equal(f(x),false);assert.equal(f(Array.from({length:1000},()=>Array(60).fill(0))),false);});
