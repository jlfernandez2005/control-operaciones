const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/finance-ui.js','utf8');
const draw=source.slice(source.indexOf('function drawReport(){'),source.indexOf('function drawDetail(){'));
function render(groups){
 const nodes=new Map(), $=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);};
 const report={title:'Operaciones por rubro',context:'Prueba',groups,totals:{count:groups.length,amount:groups.reduce((s,g)=>s+g.amount,0),paid:0,pending:0}};
 const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;');
 vm.runInNewContext(draw+'\ndrawReport();',{report,$,esc,fm:n=>`S/ ${n}`,drawDetail:()=>{}});return nodes;
}
test('gráfico y tabla muestran los 34 rubros sin truncamiento',()=>{
 const groups=Array.from({length:34},(_,i)=>({group:`Rubro ${i+1}`,count:1,amount:34-i,paid:34-i,pending:0}));const n=render(groups);
 assert.equal((n.get('#fin-chart').innerHTML.match(/class="fin-bar"/g)||[]).length,34);
 assert.equal((n.get('#fin-groups').innerHTML.match(/<tr>/g)||[]).length,34);
 assert.match(n.get('#fin-chart').innerHTML,/>Rubro 34</);assert.match(n.get('#fin-groups').innerHTML,/>Rubro 34</);assert.match(n.get('#fin-group-count').textContent,/34 de 34/);
});
test('reporte sin grupos no muestra barras ni contador engañoso',()=>{const n=render([]);assert.match(n.get('#fin-chart').innerHTML,/Sin registros/);assert.match(n.get('#fin-group-count').textContent,/No hay grupos/);});
