const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
const schema=fs.readFileSync('server/schema.sql','utf8');
const parser=()=>import('../server/schema-statements.js');
test('regression: comment containing semicolon produces no empty SQL statement',async()=>{
 const {schemaStatements}=await parser();
 assert.ok(schema.split(';').some(s=>/^\s*-- Daily batches are metadata only\s*$/.test(s)));
 const stmts=schemaStatements(schema,{remote:true});
 assert.ok(stmts.every(s=>/^\s*(CREATE|PRAGMA)\b/i.test(s)));
 assert.ok(stmts.some(s=>/^CREATE TABLE IF NOT EXISTS daily_batches\b/.test(s)));
 assert.ok(!stmts.some(s=>/^PRAGMA journal_mode/i.test(s)));
 assert.ok(stmts.some(s=>/^PRAGMA foreign_keys/i.test(s)));
});
test('comments, empty statements, quoted semicolons and escaped quotes',async()=>{
 const {schemaStatements}=await parser();
 const sql="-- only; comment\r\n; /* x;y */ SELECT 'a;--b/*c*/''d';; SELECT 2 /* ; */ + 3; -- tail;";
 const stmts=schemaStatements(sql);
 assert.equal(stmts.length,2);
 const db=new DatabaseSync(':memory:');
 assert.equal(Object.values(db.prepare(stmts[0]).get())[0],"a;--b/*c*/'d");
 assert.equal(Object.values(db.prepare(stmts[1]).get())[0],5);db.close();
 assert.deepEqual(schemaStatements('-- only;\n; /* nothing */'),[]);
});
test('one statement at a time: startup on empty DB and repeated startup preserves records',async()=>{
 const {schemaStatements}=await parser();
 const db=new DatabaseSync(':memory:');
 const stmts=schemaStatements(schema,{remote:true});
 for(const s of stmts)db.prepare(s).run();
 db.exec("INSERT INTO companies(id,name,code) VALUES(1,'Prueba','TEST'); INSERT INTO users(id,company_id,username,name,role,pass_hash) VALUES(1,1,'admin','Admin','admin','synthetic-hash'); INSERT INTO ops(id,company_id,date,concept,amount,ruc) VALUES(7,1,'2026-11-27','Ejemplo',125.5,''); INSERT INTO daily_batches(company_id,request_id,report_date,digest,op_ids) VALUES(1,'batch','2026-11-27','digest','[7]');");
 for(const s of stmts)db.prepare(s).run();
 assert.equal(db.prepare('SELECT amount FROM ops WHERE id=7').get().amount,125.5);
 assert.equal(db.prepare('SELECT pass_hash FROM users WHERE id=1').get().pass_hash,'synthetic-hash');
 assert.equal(db.prepare('SELECT op_ids FROM daily_batches').get().op_ids,'[7]');
 assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');db.close();
});
test('migration from previous structure creates daily metadata without modifying old records',async()=>{
 const {schemaStatements}=await parser();const db=new DatabaseSync(':memory:');
 const old=schema.slice(0,schema.indexOf('-- Daily batches'));
 for(const s of schemaStatements(old,{remote:true}))db.prepare(s).run();
 db.exec("INSERT INTO companies(id,name,code) VALUES(1,'Prueba','TEST'); INSERT INTO ops(id,company_id,date,concept,amount,ruc) VALUES(9,1,'2026-11-26','Histórico',88,'');");
 assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='daily_batches'").get().n,0);
 for(const s of schemaStatements(schema,{remote:true}))db.prepare(s).run();
 assert.equal(db.prepare('SELECT amount FROM ops WHERE id=9').get().amount,88);
 assert.equal(db.prepare('SELECT count(*) n FROM daily_batches').get().n,0);db.close();
});
